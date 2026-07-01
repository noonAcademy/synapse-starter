import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express, { type Application } from 'express';
import { describe, expect, it } from 'vitest';
import { attemptRefresh, createAuthRouter, type EndUserAuthDeps } from './auth-routes.js';
import { SESSION_COOKIE_NAME, signSession, verifySession } from './endUserSession.js';
import {
  type CitadelOAuthClient,
  OAuthError,
  type OAuthLoginResult,
  type OAuthRefreshResult,
  type OAuthTokenResult,
} from './oauth.js';
import { createTokenStore, type TokenStore } from './tokenStore.js';

const SECRET = 'auth-test-secret';

// --- tiny raw HTTP client (no redirect-following, exposes set-cookie) ---
async function serve(app: Application): Promise<{ port: number; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function request(
  port: number,
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers: opts.headers },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    req.on('error', reject);
    if (opts.body) {
      req.write(opts.body);
    }
    req.end();
  });
}

// --- fake Citadel oauth client ---
function fakeOAuth(overrides: Partial<CitadelOAuthClient> = {}): CitadelOAuthClient {
  const login = async (): Promise<OAuthLoginResult> => ({
    code: 'code_1',
    sessionToken: 'st_1',
    profiles: [{ id: 42, name: 'Dana', email: 'dana@noonacademy.com', type: 'ADMIN' }],
    selectedProfileId: 42,
  });
  const token = async (): Promise<OAuthTokenResult> => ({
    token: { accessToken: 'at1', refreshToken: 'rt1', type: 'Bearer', expiresIn: 600 },
    profile: null,
  });
  const refresh = async (): Promise<OAuthRefreshResult> => ({
    accessToken: 'at2',
    refreshToken: 'rt2',
    type: 'Bearer',
    expiresIn: 600,
  });
  return { login, token, refresh, ...overrides };
}

function makeDeps(overrides: Partial<EndUserAuthDeps> = {}): EndUserAuthDeps {
  return {
    oauth: fakeOAuth(),
    tokenStore: createTokenStore(),
    sessionSecret: SECRET,
    googleClientId: 'gid',
    secure: false,
    refreshSkewSeconds: 0,
    ...overrides,
  };
}

function appWith(deps: EndUserAuthDeps): Application {
  const app = express();
  app.use(createAuthRouter(deps));
  return app;
}

function cookieValue(setCookie: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = raw?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]*)`));
  return match?.[1];
}

describe('POST /auth/callback', () => {
  it('completes the happy path: sets the session cookie and stores the Citadel tokens', async () => {
    const store = createTokenStore();
    const deps = makeDeps({ tokenStore: store });
    const { port, close } = await serve(appWith(deps));

    const res = await request(port, 'POST', '/auth/callback', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'goog-cred' }),
    });

    expect(res.status).toBe(204);
    const token = cookieValue(res.headers['set-cookie']);
    expect(token).toBeTruthy();

    const session = verifySession(SECRET, token);
    expect(session?.email).toBe('dana@noonacademy.com');
    expect(session?.coreProfileId).toBe(42);

    const stored = session ? store.get(session.sessionId) : undefined;
    expect(stored?.accessToken).toBe('at1');
    expect(stored?.refreshToken).toBe('rt1');

    await close();
  });

  it("surfaces Citadel's 403 for a non-staff account", async () => {
    const oauth = fakeOAuth({
      login: async () => {
        throw new OAuthError('EXTERNAL_USER only', 403, 'login');
      },
    });
    const { port, close } = await serve(appWith(makeDeps({ oauth })));

    const res = await request(port, 'POST', '/auth/callback', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'goog-cred' }),
    });

    expect(res.status).toBe(403);
    expect(JSON.parse(res.body).error).toBe("This account isn't a Noon staff account.");
    expect(res.headers['set-cookie']).toBeUndefined();

    await close();
  });

  it('rejects a missing credential', async () => {
    const { port, close } = await serve(appWith(makeDeps()));
    const res = await request(port, 'POST', '/auth/callback', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    await close();
  });
});

describe('attemptRefresh', () => {
  it('rotates the stored token pair when it is near expiry', async () => {
    const store: TokenStore = createTokenStore();
    store.set('sess-x', {
      accessToken: 'at1',
      refreshToken: 'rt1',
      expiresIn: 1,
      obtainedAt: Date.now() - 60_000,
    });
    const deps = makeDeps({ tokenStore: store });

    const outcome = await attemptRefresh(deps, 'sess-x');

    expect(outcome).toBe('refreshed');
    expect(store.get('sess-x')).toMatchObject({ accessToken: 'at2', refreshToken: 'rt2' });
  });

  it('leaves a still-fresh pair untouched', async () => {
    const store = createTokenStore();
    store.set('sess-fresh', {
      accessToken: 'at1',
      refreshToken: 'rt1',
      expiresIn: 3600,
      obtainedAt: Date.now(),
    });
    const deps = makeDeps({ tokenStore: store, refreshSkewSeconds: 60 });

    expect(await attemptRefresh(deps, 'sess-fresh')).toBe('valid');
    expect(store.get('sess-fresh')?.accessToken).toBe('at1');
  });

  it('clears the stored pair when Citadel rejects the refresh token (401)', async () => {
    const store = createTokenStore();
    store.set('sess-dead', {
      accessToken: 'at1',
      refreshToken: 'rt1',
      expiresIn: 1,
      obtainedAt: Date.now() - 60_000,
    });
    const oauth = fakeOAuth({
      refresh: async () => {
        throw new OAuthError('expired', 401, 'refresh');
      },
    });
    const deps = makeDeps({ tokenStore: store, oauth });

    expect(await attemptRefresh(deps, 'sess-dead')).toBe('expired');
    expect(store.get('sess-dead')).toBeUndefined();
  });
});

describe('GET /api/me', () => {
  it('clears the cookie and 401s when a refresh fails', async () => {
    const store = createTokenStore();
    store.set('sess-me', {
      accessToken: 'at1',
      refreshToken: 'rt1',
      expiresIn: 1,
      obtainedAt: Date.now() - 60_000,
    });
    const oauth = fakeOAuth({
      refresh: async () => {
        throw new OAuthError('expired', 401, 'refresh');
      },
    });
    const { port, close } = await serve(appWith(makeDeps({ tokenStore: store, oauth })));

    const cookie = signSession(SECRET, {
      sessionId: 'sess-me',
      email: 'dana@noonacademy.com',
      name: 'Dana',
      coreProfileId: 42,
    });
    const res = await request(port, 'GET', '/api/me', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });

    expect(res.status).toBe(401);
    expect(cookieValue(res.headers['set-cookie'])).toBe('');
    expect(store.get('sess-me')).toBeUndefined();

    await close();
  });

  it('returns the identity for a valid session (token still stored)', async () => {
    const store = createTokenStore();
    store.set('sess-ok', {
      accessToken: 'at1',
      refreshToken: 'rt1',
      expiresIn: 3600,
      obtainedAt: Date.now(),
    });
    const { port, close } = await serve(appWith(makeDeps({ tokenStore: store })));
    const cookie = signSession(SECRET, {
      sessionId: 'sess-ok',
      email: 'dana@noonacademy.com',
      name: 'Dana',
      coreProfileId: 42,
    });
    const res = await request(port, 'GET', '/api/me', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ email: 'dana@noonacademy.com', name: 'Dana' });
    await close();
  });

  it('401s a signed cookie whose token is gone (logout / restart replay)', async () => {
    // Fresh, empty store: the cookie verifies but no active token backs it.
    const { port, close } = await serve(appWith(makeDeps()));
    const cookie = signSession(SECRET, {
      sessionId: 'sess-gone',
      email: 'dana@noonacademy.com',
      name: 'Dana',
      coreProfileId: 42,
    });
    const res = await request(port, 'GET', '/api/me', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });
    expect(res.status).toBe(401);
    await close();
  });

  it('401s without a session cookie', async () => {
    const { port, close } = await serve(appWith(makeDeps()));
    const res = await request(port, 'GET', '/api/me');
    expect(res.status).toBe(401);
    await close();
  });
});
