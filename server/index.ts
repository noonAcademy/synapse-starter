import { createServer as createHttpServer, type Server } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { formatBootLog } from './boot.js';
import { recentPublishes } from './events.js';
import { synapse, synapseConfigError } from './synapse.js';

const here = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
const isReplitDeployment = Boolean(process.env.REPLIT_DEPLOYMENT);
const port = Number(process.env.PORT ?? 3000);
const host = '0.0.0.0';

async function createServerInstance(): Promise<Server> {
  const app = express();
  const httpServer = createHttpServer(app);

  // Workspace-only inspection surface for the Events tab. Registered before the
  // client middleware so the SPA catch-all doesn't swallow it, and hidden once
  // the app is a published Replit deployment so it isn't exposed to end users.
  if (!isReplitDeployment) {
    app.get('/__synapse/events', (_req, res) => {
      res.json(recentPublishes(synapse));
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
