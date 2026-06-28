import { createServer as createHttpServer, type Server } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYNAPSE_EVENT_TYPES } from '@noonacademy/synapse-catalog';
import express from 'express';
import { asAthenaClient } from './athena.js';
import { formatBootLog } from './boot.js';
import { buildCatalog } from './catalog.js';
import { recentPublishes } from './events.js';
import { buildOverview } from './overview.js';
import { listBakedQueries } from './queries/index.js';
import { runRead } from './reads.js';
import { synapse, synapseAppId, synapseBaseUrl, synapseConfigError } from './synapse.js';
import { projectTables } from './tables.js';

const here = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
const isReplitDeployment = Boolean(process.env.REPLIT_DEPLOYMENT);
const port = Number(process.env.PORT ?? 3000);
const host = '0.0.0.0';

async function createServerInstance(): Promise<Server> {
  const app = express();
  const httpServer = createHttpServer(app);

  // Workspace-only inspection surface for the builder console (Overview / Tables / Read /
  // Catalog / Events tabs). Registered before the client middleware so the SPA catch-all
  // doesn't swallow it, and hidden once the app is a published Replit deployment so none of
  // it is exposed to end users.
  if (!isReplitDeployment) {
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

const server = await createServerInstance();
server.listen(port, host, () => {
  console.log(
    `[synapse-starter] listening on http://${host}:${port} (${isDev ? 'dev' : 'production'})`,
  );
  publishBootEvent();
});
installShutdown(server);
