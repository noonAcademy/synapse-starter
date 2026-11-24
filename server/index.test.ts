import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Application } from 'express';
import { describe, expect, it } from 'vitest';
import { routesOutsideDataPaths } from './access-gate.js';
import { buildEndUserAuthDeps } from './auth-routes.js';
import { buildApp } from './index.js';

async function serve(app: Application): Promise<{ port: number; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const KEY = 'test-workspace-key-0123456789abcdef0123456789';
const WITH_KEY = { 'x-synapse-workspace-key': KEY };
// What a request through Replit's proxy looks like to the server.
const PROXIED = { host: 'my-app.replit.dev', 'x-forwarded-for': '203.0.113.7' };

function get(
  port: number,
  path: string,
  headers: Record<string, string> = {},
  method = 'GET',
): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    // http.request does not follow redirects, so a 302 comes through verbatim.
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers, agent: false },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function post(
  port: number,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? '' : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        // A fresh socket per call: a kept-alive one can point at a closed server on a reused port.
        agent: false,
        method: 'POST',
        path,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(data),
          ...extraHeaders,
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => {
          chunks += c;
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: chunks }));
      },
    );
    req.on('error', reject);
    req.end(data);
  });
}

const workspace = { isReplitDeployment: false, workspaceKey: KEY, trustLocalCalls: false };

const authDeps = buildEndUserAuthDeps({
  baseUrl: 'https://citadel.example',
  appId: 'app_test',
  appSecret: 'app-secret',
  redirectUri: 'https://app.example/oauth/callback',
  sessionSecret: 'sess-secret',
  secure: false,
});

describe('end-user auth gate wiring', () => {
  it('gates the deployed app: API -> 401, page -> 302 /login', async () => {
    const { port, close } = await serve(buildApp({ isReplitDeployment: true, authDeps }));
    try {
      const views = await get(port, '/api/views');
      expect(views.status).toBe(401);

      const page = await get(port, '/');
      expect(page.status).toBe(302);
      expect(page.headers.location).toBe('/login');
    } finally {
      await close();
    }
  });

  it('locks the workspace API to the builder: no key -> 401, key -> 200, pages stay open', async () => {
    const { port, close } = await serve(buildApp(workspace));
    try {
      const locked = await get(port, '/api/views', PROXIED);
      expect(locked.status).toBe(401);
      expect(locked.headers['x-synapse-gate']).toBe('denied');
      expect((await get(port, '/__synapse/overview', PROXIED)).status).toBe(401);
      expect((await get(port, '/api/views', { ...PROXIED, ...WITH_KEY })).status).toBe(200);
      expect((await get(port, '/', PROXIED)).status).not.toBe(401);
    } finally {
      await close();
    }
  });

  it('does not trust a local call on Replit or in a production start', async () => {
    const { port, close } = await serve(buildApp(workspace));
    try {
      expect((await get(port, '/api/views', { host: 'localhost:3000' })).status).toBe(401);
    } finally {
      await close();
    }
  });

  it('lets a direct local call through only for npm run dev off Replit', async () => {
    const { port, close } = await serve(buildApp({ ...workspace, trustLocalCalls: true }));
    try {
      expect((await get(port, '/api/views', { host: 'localhost:3000' })).status).toBe(200);
      expect(
        (await get(port, '/api/views', { host: 'localhost', 'x-forwarded-for': '1.2.3.4' })).status,
      ).toBe(401);
      expect((await get(port, '/api/views', { host: 'my-app.replit.dev' })).status).toBe(401);
      expect(
        (await get(port, '/api/views', { host: 'localhost', 'sec-fetch-site': 'cross-site' }))
          .status,
      ).toBe(401);
      expect(
        (await get(port, '/api/views', { host: 'localhost', origin: 'https://evil.example' }))
          .status,
      ).toBe(401);
    } finally {
      await close();
    }
  });

  it('matches data paths without regard to letter case, for every method', async () => {
    const { port, close } = await serve(buildApp(workspace));
    try {
      for (const path of [
        '/API/views',
        '/Api/Views/x',
        '/__SYNAPSE/overview',
        '/__Synapse/probe',
      ]) {
        for (const method of ['GET', 'HEAD', 'OPTIONS', 'POST']) {
          expect((await get(port, path, PROXIED, method)).status, `${method} ${path}`).toBe(401);
        }
      }
      expect((await get(port, '/anything', PROXIED, 'POST')).status).toBe(401);
    } finally {
      await close();
    }
  });

  it('locks other shapes of a data path, and never lets a near-miss path reach a data route', async () => {
    const { port, close } = await serve(buildApp(workspace));
    try {
      for (const path of ['/api/views/', '/api?x', '/api/views?x=1']) {
        expect((await get(port, path, PROXIED)).status, path).toBe(401);
      }
      for (const path of ['//api/views', '/%61pi/views', '/apix']) {
        expect((await get(port, path, PROXIED)).status, path).toBe(404);
      }
    } finally {
      await close();
    }
  });

  it('lists app routes outside /api and /__synapse, so the boot log can name them', () => {
    const app = buildApp(workspace);
    expect(routesOutsideDataPaths(app)).toEqual([]);
    app.get('/export.csv', (_req, res) => {
      res.send('');
    });
    expect(routesOutsideDataPaths(app)).toEqual(['GET /export.csv']);
  });

  it('ignores the workspace key in a deployment: no session -> 401', async () => {
    const { port, close } = await serve(
      buildApp({ isReplitDeployment: true, authDeps, workspaceKey: KEY }),
    );
    try {
      expect((await get(port, '/api/views', WITH_KEY)).status).toBe(401);
      expect((await get(port, '/API/views', WITH_KEY)).status).toBe(401);
      expect((await get(port, '/API/views/x.json')).status).toBe(401);
    } finally {
      await close();
    }
  });

  it('fails closed when a deployment is misconfigured (no auth deps): 503', async () => {
    const { port, close } = await serve(buildApp({ isReplitDeployment: true, authDeps: null }));
    try {
      expect((await get(port, '/api/views')).status).toBe(503);
      expect((await get(port, '/')).status).toBe(503);
    } finally {
      await close();
    }
  });

  it('refuses to build auth deps from incomplete config (each missing value ⇒ null ⇒ the 503 path)', () => {
    const complete = {
      baseUrl: 'https://citadel.example',
      appId: 'app_test',
      appSecret: 'app-secret',
      redirectUri: 'https://app.example/oauth/callback',
      sessionSecret: 'sess-secret',
      secure: true,
    };
    expect(buildEndUserAuthDeps(complete)).not.toBeNull();
    expect(buildEndUserAuthDeps({ ...complete, redirectUri: null })).toBeNull();
    expect(buildEndUserAuthDeps({ ...complete, sessionSecret: null })).toBeNull();
    expect(buildEndUserAuthDeps({ ...complete, appId: null })).toBeNull();
    expect(buildEndUserAuthDeps({ ...complete, appSecret: null })).toBeNull();
  });
});

describe('app event route (/api/events)', () => {
  it('gates it in the deployed app: an unauthenticated POST -> 401', async () => {
    const { port, close } = await serve(buildApp({ isReplitDeployment: true, authDeps }));
    try {
      const res = await post(port, '/api/events', { type: 'game.round_won' });
      expect(res.status).toBe(401);
    } finally {
      await close();
    }
  });

  it('requires an event type (400) in the workspace', async () => {
    const { port, close } = await serve(buildApp(workspace));
    try {
      const res = await post(port, '/api/events', { payload: { studentId: 1 } }, WITH_KEY);
      expect(res.status).toBe(400);
    } finally {
      await close();
    }
  });

  it('reports not-connected (503) when the app secrets are missing', async () => {
    const { port, close } = await serve(buildApp(workspace));
    try {
      const res = await post(
        port,
        '/api/events',
        { type: 'game.round_won', payload: {} },
        WITH_KEY,
      );
      expect(res.status).toBe(503);
    } finally {
      await close();
    }
  });
});
