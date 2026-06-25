import { randomBytes } from 'node:crypto';
import { createServer as createHttpServer, type Server } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { formatBootLog } from './boot.js';
import { synapse, synapseConfigError } from './synapse.js';

const here = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
const port = Number(process.env.PORT ?? 3000);
const host = '0.0.0.0';

async function createServerInstance(): Promise<Server> {
  const app = express();
  const httpServer = createHttpServer(app);

  // Slice 2+: API routes mount here, before the client middleware below.

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
  const runId = `starter-boot-${randomBytes(4).toString('hex')}`;
  void synapse
    .publishEvent('synapse_smoke_test', { runId })
    .then((result) => {
      console.log(formatBootLog(result, runId));
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
