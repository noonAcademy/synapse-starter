import { createServer as createHttpServer, type Server } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYNAPSE_EVENT_TYPES } from '@noonacademy/synapse-catalog';
import type { PublishEventResult } from '@noonacademy/synapse-sdk';
import express, { type Application } from 'express';
import { asAthenaClient } from './athena.js';
import { buildEndUserAuthDeps, type EndUserAuthDeps, installEndUserAuth } from './auth-routes.js';
import { formatBootLog } from './boot.js';
import { buildCatalog } from './catalog.js';
import { recentPublishes } from './events.js';
import { buildOverview } from './overview.js';
import { listBakedQueries } from './queries/index.js';
import { runRead } from './reads.js';
import {
  appOauthRedirectUri,
  appSessionSecret,
  authConfigError,
  googleClientId,
  synapse,
  synapseAppId,
  synapseAppSecret,
  synapseBaseUrl,
  synapseConfigError,
} from './synapse.js';
import { projectTables } from './tables.js';

const here = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
const isReplitDeployment = Boolean(process.env.REPLIT_DEPLOYMENT);
const port = Number(process.env.PORT ?? 3000);
const host = '0.0.0.0';

// Assembles the Express app's routes. Split out from the HTTP-server/dev/static wiring so tests can
// drive the exact route + gate ordering without spinning up Vite or reading the built client.
export function buildApp(opts: {
  isReplitDeployment: boolean;
  authDeps?: EndUserAuthDeps | null;
}): Application {
  const app = express();

  // Workspace-only inspection surface for the builder console (Overview / Tables / Read /
  // Catalog / Events tabs). Registered before the client middleware so the SPA catch-all
  // doesn't swallow it, and hidden once the app is a published Replit deployment so none of
  // it is exposed to end users.
  if (!opts.isReplitDeployment) {
    // Settled publish outcomes since boot.
    app.get('/__synapse/events', (_req, res) => {
      res.json(recentPublishes(synapse));
    });

    // App identity + live-ish connection check.
    app.get('/__synapse/overview', (_req, res) => {
      res.json(
        buildOverview({
          appId: synapseAppId,
          baseUrl: synapseBaseUrl,
          configError: synapseConfigError,
          recentPublishes: recentPublishes(synapse),
        }),
      );
    });

    // Bundled Citadel registry, projected for the Tables browser.
    app.get('/__synapse/tables', (_req, res) => {
      res.json(projectTables());
    });

    // Catalogued event types the SDK knows about (read-only).
    app.get('/__synapse/catalog', (_req, res) => {
      res.json(buildCatalog(SYNAPSE_EVENT_TYPES));
    });

    // List the baked reads this app ships.
    app.get('/__synapse/reads', (_req, res) => {
      res.json(
        listBakedQueries().map((q) => ({
          name: q.name,
          title: q.title,
          description: q.description,
        })),
      );
    });

    // Run one baked read (cache -> athenaQuery -> rows). runRead never rejects (read failures
    // become an `error` field), but Express 4 doesn't forward a rejected async handler to error
    // middleware, so the try/catch keeps that guarantee from resting on runRead's discipline.
    app.get('/__synapse/reads/:name', async (req, res) => {
      try {
        const result = await runRead(asAthenaClient(synapse), req.params.name);
        if (!result) {
          res.status(404).json({ error: `unknown read: ${req.params.name}` });
          return;
        }
        res.json(result);
      } catch (err) {
        console.error('[synapse] read route failed:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: 'read failed' });
      }
    });
  }

  // "Sign in with Noon" gate for the deployed app ONLY. Mounted BEFORE the public /api/views routes
  // and (later, in createServerInstance) the SPA catch-all, so it guards both: unauthenticated API
  // calls get 401 and page loads are redirected to /login, while the login screen's own routes and
  // static assets are allowlisted. Never mounted in the workspace, so the builder console stays open.
  // If the auth config is incomplete, authDeps is null and the gate stays unmounted (surfaced in the
  // boot log) rather than throwing — same "surface, don't throw" contract as the SDK secrets.
  if (opts.isReplitDeployment && opts.authDeps) {
    installEndUserAuth(app, opts.authDeps);
  }

  // Public read API for the shipped app. Unlike /__synapse/* (workspace-only), these are mounted
  // in EVERY mode — the app the builder ships renders live views for end users through them. Same
  // baked reads, same cache; just the product-facing surface. Registered before the SPA catch-all
  // so the client middleware doesn't swallow them.
  app.get('/api/views', (_req, res) => {
    res.json(
      listBakedQueries().map((q) => ({
        name: q.name,
        title: q.title,
        description: q.description,
      })),
    );
  });

  app.get('/api/views/:name', async (req, res) => {
    try {
      const result = await runRead(asAthenaClient(synapse), req.params.name);
      if (!result) {
        res.status(404).json({ error: `unknown view: ${req.params.name}` });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error('[synapse] view route failed:', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'view failed' });
    }
  });

  // Public event API for the shipped app — the events-out primitive (client/sendEvent.ts). Any
  // interaction can report to Noon by POSTing { type, payload }; the server holds the app secret and
  // calls synapse.publishEvent, so the client never sees it. In a deployment this sits behind the
  // sign-in gate above (only a signed-in user can send). The event type must already exist — a
  // built-in, or one the agent declared at build time; this route publishes, it does not declare.
  app.post('/api/events', express.json(), async (req, res) => {
    const type = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
    const rawPayload = (req.body as { payload?: unknown } | undefined)?.payload;
    const payload =
      rawPayload && typeof rawPayload === 'object' ? (rawPayload as Record<string, unknown>) : {};

    if (!type) {
      res.status(400).json({ error: 'an event "type" is required' });
      return;
    }
    if (!synapse) {
      res.status(503).json({ error: 'not connected to Noon yet — add your app secrets' });
      return;
    }

    try {
      // publishEvent is typed to built-in catalog types; declared types are runtime strings, so we
      // publish the caller's type through a string-accepting view of the same method.
      const publish = synapse.publishEvent as (
        t: string,
        p: Record<string, unknown>,
      ) => Promise<PublishEventResult>;
      res.json(await publish(type, payload));
    } catch (err) {
      console.error('[synapse] event route failed:', err instanceof Error ? err.message : err);
      res.status(502).json({ error: 'could not send the event' });
    }
  });

  return app;
}

async function createServerInstance(): Promise<Server> {
  // Wire the deployed-app auth gate from resolved config. Reuses the Citadel base URL + app secret
  // for the oauth calls; a dedicated APP_SESSION_SECRET signs the identity cookie. Null (and a boot
  // log) when anything's missing, which leaves the gate unmounted.
  const authDeps = isReplitDeployment
    ? buildEndUserAuthDeps({
        baseUrl: synapseBaseUrl,
        appId: synapseAppId,
        appSecret: synapseAppSecret,
        redirectUri: appOauthRedirectUri,
        sessionSecret: appSessionSecret,
        googleClientId,
        secure: isReplitDeployment,
      })
    : null;
  if (isReplitDeployment && !authDeps) {
    console.error(`[synapse] ${authConfigError ?? 'Sign in with Noon disabled (misconfigured).'}`);
  }

  const app = buildApp({ isReplitDeployment, authDeps });
  const httpServer = createHttpServer(app);

  if (isDev) {
    const { createServer } = await import('vite');
    // hmr.server reuses this HTTP server so dev stays on ONE port — without it,
    // Vite opens a separate HMR WebSocket on :24678, which Replit won't forward.
    const vite = await createServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const clientDist = resolve(here, '../dist/public');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(resolve(clientDist, 'index.html'));
    });
  }

  return httpServer;
}

function publishBootEvent(): void {
  if (!synapse) {
    console.error(`[synapse] ${synapseConfigError}`);
    return;
  }
  void synapse
    .publishEvent('app_booted', { startedAt: new Date().toISOString() })
    .then((result) => {
      console.log(formatBootLog('app_booted', result));
    })
    .catch((err: unknown) => {
      console.error('[synapse] publish failed:', err instanceof Error ? err.message : err);
    });
}

function installShutdown(server: Server): void {
  const shutdown = (signal: string): void => {
    console.log(`[synapse-starter] ${signal} received — shutting down`);
    synapse?.close();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

async function main(): Promise<void> {
  const server = await createServerInstance();
  server.listen(port, host, () => {
    console.log(
      `[synapse-starter] listening on http://${host}:${port} (${isDev ? 'dev' : 'production'})`,
    );
    publishBootEvent();
  });
  installShutdown(server);
}

// Start the server unless we're under Vitest, which imports buildApp directly and must not have the
// module bind a port or publish a boot event as a side effect of the import.
if (!process.env.VITEST) {
  void main();
}
