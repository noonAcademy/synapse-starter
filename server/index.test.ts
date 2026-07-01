import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Application } from 'express';
import { describe, expect, it } from 'vitest';
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

function get(
  port: number,
  path: string,
): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    // http.request does not follow redirects, so a 302 comes through verbatim.
    const req = http.request({ host: '127.0.0.1', port, method: 'GET', path }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

function post(
  port: number,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? '' : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
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

const authDeps = buildEndUserAuthDeps({
  baseUrl: 'https://citadel.example',
  appId: 'app_test',
  appSecret: 'app-secret',
  redirectUri: 'https://app.example/oauth/callback',
  sessionSecret: 'sess-secret',
  googleClientId: null,
  secure: false,
});

describe('end-user auth gate wiring', () => {
  it('gates the deployed app: API -> 401, page -> 302 /login', async () => {
    const { port, close } = await serve(buildApp({ isReplitDeployment: true, authDeps }));

    const views = await get(port, '/api/views');
    expect(views.status).toBe(401);

    const page = await get(port, '/');
    expect(page.status).toBe(302);
    expect(page.headers.location).toBe('/login');

    await close();
  });

  it('leaves the workspace open: API reachable, no /login redirect', async () => {
    const { port, close } = await serve(buildApp({ isReplitDeployment: false }));

    const views = await get(port, '/api/views');
    expect(views.status).toBe(200);

    const page = await get(port, '/');
    expect(page.status).not.toBe(302);

    await close();
  });
});

describe('app event route (/api/events)', () => {
  it('gates it in the deployed app: an unauthenticated POST -> 401', async () => {
    const { port, close } = await serve(buildApp({ isReplitDeployment: true, authDeps }));
    const res = await post(port, '/api/events', { type: 'game.round_won' });
    expect(res.status).toBe(401);
    await close();
  });

  it('requires an event type (400) in the open workspace', async () => {
    const { port, close } = await serve(buildApp({ isReplitDeployment: false }));
    const res = await post(port, '/api/events', { payload: { studentId: 1 } });
    expect(res.status).toBe(400);
    await close();
  });

  it('reports not-connected (503) when the app secrets are missing', async () => {
    const { port, close } = await serve(buildApp({ isReplitDeployment: false }));
    const res = await post(port, '/api/events', { type: 'game.round_won', payload: {} });
    expect(res.status).toBe(503);
    await close();
  });
});
