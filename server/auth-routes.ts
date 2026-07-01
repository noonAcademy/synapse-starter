import { randomUUID } from 'node:crypto';
import express, { type Application, type Request, type RequestHandler, type Router } from 'express';
import {
  type EndUserSession,
  readCookie,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  signSession,
  verifySession,
} from './endUserSession.js';
import {
  type CitadelOAuthClient,
  type CitadelProfile,
  createCitadelOAuthClient,
  OAuthError,
  type OAuthLoginResult,
} from './oauth.js';
import { type TokenStore, tokenStore } from './tokenStore.js';

// Attaches the verified session to the request for downstream handlers. The Express namespace is
// how @types/express expects Request to be augmented.
declare global {
  namespace Express {
    interface Request {
      noonUser?: EndUserSession;
    }
  }
}

const STAFF_MESSAGE = "This account isn't a Noon staff account.";
const GENERIC_FAILURE = 'Sign-in failed. Please try again.';
const DEFAULT_REFRESH_SKEW_SECONDS = 60;

export interface EndUserAuthDeps {
  oauth: CitadelOAuthClient;
  tokenStore: TokenStore;
  sessionSecret: string;
  googleClientId: string | null;
  // Set the cookie's Secure flag (true only over HTTPS / in a deployment).
  secure: boolean;
  // Refresh the Citadel token this many seconds before it actually expires.
  refreshSkewSeconds?: number;
}

// Picks the identity to put in the cookie from the login result's staff profiles. Mirrors how
// Citadel's own oauth-login-http.ts builds its web session: prefer the selected profile, then an
// ADMIN, then the first staff profile.
function deriveIdentity(login: OAuthLoginResult): {
  email: string;
  name: string;
  coreProfileId: number | null;
} | null {
  const profiles = login.profiles;
  const byId =
    login.selectedProfileId != null
      ? profiles.find((p) => p.id === login.selectedProfileId)
      : undefined;
  const admin = profiles.find((p) => (p.type ?? p.userType)?.toUpperCase() === 'ADMIN');
  const selected: CitadelProfile | undefined = byId ?? admin ?? profiles[0];
  if (!selected) {
    return null;
  }
  const email = selected.email ?? selected.account?.email ?? selected.account?.username;
  if (!email) {
    return null;
  }
  return {
    email,
    name: selected.name ?? email,
    coreProfileId: selected.id ?? login.selectedProfileId ?? null,
  };
}

export type RefreshOutcome = 'valid' | 'refreshed' | 'expired' | 'error';

// Rotates the stored Citadel token pair when it's within the skew window of expiry. Returns:
//   'valid'     — still fresh (or nothing stored to refresh), no call made
//   'refreshed' — rotated successfully, tokenStore updated
//   'expired'   — Citadel rejected the refresh token (401); tokenStore entry cleared, re-auth needed
//   'error'     — transient failure; the pair is left untouched
export async function attemptRefresh(
  deps: Pick<EndUserAuthDeps, 'oauth' | 'tokenStore' | 'refreshSkewSeconds'>,
  sessionId: string,
): Promise<RefreshOutcome> {
  const stored = deps.tokenStore.get(sessionId);
  if (!stored) {
    return 'valid';
  }
  const skewMs = (deps.refreshSkewSeconds ?? DEFAULT_REFRESH_SKEW_SECONDS) * 1000;
  const expiresAtMs = stored.obtainedAt + stored.expiresIn * 1000;
  if (Date.now() < expiresAtMs - skewMs) {
    return 'valid';
  }
  try {
    const next = await deps.oauth.refresh({ refreshToken: stored.refreshToken });
    deps.tokenStore.set(sessionId, {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      expiresIn: next.expiresIn,
      obtainedAt: Date.now(),
    });
    return 'refreshed';
  } catch (err) {
    if (err instanceof OAuthError && err.status === 401) {
      deps.tokenStore.delete(sessionId);
      return 'expired';
    }
    return 'error';
  }
}

function clearSessionCookie(res: express.Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/', httpOnly: true, secure, sameSite: 'lax' });
}

function sessionFromRequest(req: Request, secret: string): EndUserSession | null {
  return verifySession(secret, readCookie(req.headers.cookie, SESSION_COOKIE_NAME));
}

export function createAuthRouter(deps: EndUserAuthDeps): Router {
  const router = express.Router();

  // The login screen is part of the SPA. If the visitor is already signed in there's nothing to
  // show, so bounce to the app; otherwise fall through to the SPA catch-all (the gate allowlists
  // /login so this doesn't loop).
  router.get('/login', (req, res, next) => {
    if (sessionFromRequest(req, deps.sessionSecret)) {
      res.redirect(302, '/');
      return;
    }
    next();
  });

  // Public: lets the login screen fetch the Google client id without baking it into the bundle.
  router.get('/api/auth/config', (_req, res) => {
    res.json({ googleClientId: deps.googleClientId });
  });

  // Session probe used by the app shell. Also the one place a proactive token refresh is triggered
  // in v1 (no per-user read consumes the token yet).
  router.get('/api/me', async (req, res) => {
    const session = sessionFromRequest(req, deps.sessionSecret);
    if (!session) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    const outcome = await attemptRefresh(deps, session.sessionId);
    if (outcome === 'expired') {
      clearSessionCookie(res, deps.secure);
      res.status(401).json({ error: 'Session expired' });
      return;
    }
    res.json({ email: session.email, name: session.name });
  });

  // Google Identity Services hands the browser a credential; the browser POSTs it here. We exchange
  // it with Citadel (login → token), stash the Citadel tokens server-side, and set the identity
  // cookie. The cookie carries no Citadel token.
  router.post('/auth/callback', express.json(), async (req, res) => {
    const credential =
      typeof req.body?.credential === 'string' ? (req.body.credential as string) : '';
    if (!credential) {
      res.status(400).json({ error: 'Missing credential' });
      return;
    }

    let login: OAuthLoginResult;
    try {
      login = await deps.oauth.login({ credential });
    } catch (err) {
      // Surface Citadel's 403 (account isn't Noon staff) distinctly; everything else is generic.
      if (err instanceof OAuthError && err.status === 403) {
        res.status(403).json({ error: STAFF_MESSAGE });
        return;
      }
      res.status(502).json({ error: GENERIC_FAILURE });
      return;
    }

    const identity = deriveIdentity(login);
    if (!identity || !login.code) {
      res.status(403).json({ error: STAFF_MESSAGE });
      return;
    }

    try {
      const tokenResult = await deps.oauth.token({ code: login.code });
      const sessionId = randomUUID();
      deps.tokenStore.set(sessionId, {
        accessToken: tokenResult.token.accessToken,
        refreshToken: tokenResult.token.refreshToken,
        expiresIn: tokenResult.token.expiresIn,
        obtainedAt: Date.now(),
      });
      const token = signSession(deps.sessionSecret, { sessionId, ...identity });
      res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(deps.secure));
      res.status(204).end();
    } catch {
      res.status(502).json({ error: GENERIC_FAILURE });
    }
  });

  router.post('/logout', (req, res) => {
    const session = sessionFromRequest(req, deps.sessionSecret);
    if (session) {
      deps.tokenStore.delete(session.sessionId);
    }
    clearSessionCookie(res, deps.secure);
    res.status(204).end();
  });

  return router;
}

const STATIC_ASSET =
  /\.(?:js|mjs|css|map|svg|png|jpe?g|gif|ico|webp|woff2?|ttf|eot|json|txt|wasm)$/i;

// Requests that must reach through the gate unauthenticated so the login screen can load and sign in.
function isAllowlisted(req: Request): boolean {
  if (req.method === 'GET' && req.path === '/login') {
    return true;
  }
  if (req.path === '/health') {
    return true;
  }
  // The SPA bundle (login + app share one build) and other static assets.
  if (req.method === 'GET' && STATIC_ASSET.test(req.path)) {
    return true;
  }
  return false;
}

// The gate. A valid cookie attaches req.noonUser and continues; otherwise a page navigation is
// redirected to /login and an API/XHR call gets a 401 JSON. Auth-router paths (/auth/callback,
// /logout, /api/me, /api/auth/config) are handled before this runs, so they never reach it.
export function createRequireEndUser(deps: Pick<EndUserAuthDeps, 'sessionSecret'>): RequestHandler {
  return (req, res, next) => {
    if (isAllowlisted(req)) {
      next();
      return;
    }
    const session = sessionFromRequest(req, deps.sessionSecret);
    if (session) {
      req.noonUser = session;
      next();
      return;
    }
    if (req.path.startsWith('/api/') || req.method !== 'GET') {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    res.redirect(302, '/login');
  };
}

// Mounts the whole end-user auth surface on the app: the auth router first (so its routes are
// handled unauthenticated), then the gate (which guards everything registered after this call —
// /api/views and the SPA catch-all).
export function installEndUserAuth(app: Application, deps: EndUserAuthDeps): void {
  app.use(createAuthRouter(deps));
  app.use(createRequireEndUser(deps));
}

export interface EndUserAuthConfig {
  baseUrl: string;
  appId: string | null;
  appSecret: string | null;
  redirectUri: string | null;
  sessionSecret: string | null;
  googleClientId: string | null;
  secure: boolean;
}

// Builds the deps from resolved config, using the process-wide tokenStore. Returns null when any
// required secret is missing so the caller can leave auth unmounted and surface the config error
// (matching synapse.ts's "surface, don't throw" pattern).
export function buildEndUserAuthDeps(config: EndUserAuthConfig): EndUserAuthDeps | null {
  if (!config.appId || !config.appSecret || !config.redirectUri || !config.sessionSecret) {
    return null;
  }
  return {
    oauth: createCitadelOAuthClient({
      baseUrl: config.baseUrl,
      appId: config.appId,
      appSecret: config.appSecret,
      redirectUri: config.redirectUri,
    }),
    tokenStore,
    sessionSecret: config.sessionSecret,
    googleClientId: config.googleClientId,
    secure: config.secure,
  };
}
