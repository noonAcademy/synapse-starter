import type { Application, Request, RequestHandler, Response } from 'express';
import { createAuthRouter, createRequireEndUser, type EndUserAuthDeps } from './auth-routes.js';
import { PUBLIC_ROUTES, type PublicRoute } from './public-routes.js';
import { keyMatches, WORKSPACE_KEY_HEADER } from './workspace-key.js';

// The one door in front of every route. It is the FIRST middleware buildApp installs, so every
// route registered after it, including the ones a builder adds later, is behind it.
//
// Deployment: "Sign in with Noon". The sign-in routes answer first; then every request needs a
// session (API -> 401, page -> 302 /login), except static assets and PUBLIC_ROUTES. With the auth
// config missing, every request gets 503: an auth boundary must not fall open on a misconfig.
//
// Workspace: pages and assets stay open (they hold no data). Every /api and /__synapse request,
// and every non-GET request, needs the builder: the workspace key in a header, or (only for
// `npm run dev` off Replit) a direct call from this machine. On Replit the dev URL can be switched
// public in one click and the app cannot see that switch, so it never trusts the network there.
//
// Paths are compared in lower case: Express matches routes without regard to case, so
// `/API/views` reaches the same handler as `/api/views` and must meet the same gate.

export const GATE_HEADER = 'x-synapse-gate';
export const WORKSPACE_LOCKED = 'workspace_locked';

export type GateMode =
  | { kind: 'deployment'; authDeps: EndUserAuthDeps | null }
  | { kind: 'workspace'; workspaceKey: string; trustLocalCalls: boolean };

function lowerPath(req: Request): string {
  return req.path.toLowerCase();
}

export function isDataPath(path: string): boolean {
  return (
    path === '/api' ||
    path.startsWith('/api/') ||
    path === '/__synapse' ||
    path.startsWith('/__synapse/')
  );
}

export function isPublicRoute(req: Request, routes: PublicRoute[] = PUBLIC_ROUTES): boolean {
  const path = lowerPath(req);
  const method = req.method === 'HEAD' ? 'GET' : req.method;
  return routes.some((r) => r.method === method && r.path.toLowerCase() === path);
}

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const PROXY_HEADERS = ['forwarded', 'via', 'x-real-ip'];

function hostWithoutPort(host: string): string {
  const lower = host.toLowerCase();
  if (lower.startsWith('[')) return lower.slice(0, lower.indexOf(']') + 1);
  return lower.split(':')[0] ?? '';
}

// A request made on this machine to this server, not relayed by a proxy and not started by a
// page on another site (a page the builder visits could otherwise make their browser call it).
export function isLocalCall(req: Request): boolean {
  if (!LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? '')) return false;
  if (!LOOPBACK_HOSTS.has(hostWithoutPort(req.headers.host ?? ''))) return false;
  for (const name of Object.keys(req.headers)) {
    if (name.startsWith('x-forwarded-') || PROXY_HEADERS.includes(name)) return false;
  }
  // Only this page or a typed URL: another local app on another port is `same-site`, not ours.
  const fetchSite = req.headers['sec-fetch-site'];
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host.toLowerCase() !== (req.headers.host ?? '').toLowerCase())
        return false;
    } catch {
      return false;
    }
  }
  return true;
}

function deny(res: Response, status: number, body: Record<string, string>): void {
  res.setHeader(GATE_HEADER, 'denied');
  res.status(status).json(body);
}

export function createWorkspaceGate(options: {
  workspaceKey: string;
  // True only for `npm run dev` off Replit (server/index.ts). Never in a production start: behind
  // a plain reverse proxy (nginx `proxy_pass http://127.0.0.1:3000`) every request looks local.
  trustLocalCalls: boolean;
  publicRoutes?: PublicRoute[];
}): RequestHandler {
  return function synapseAccessGate(req, res, next) {
    const path = lowerPath(req);
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    if (!isDataPath(path) && isRead) {
      next();
      return;
    }
    if (isPublicRoute(req, options.publicRoutes)) {
      next();
      return;
    }
    if (keyMatches(options.workspaceKey, req.headers[WORKSPACE_KEY_HEADER])) {
      next();
      return;
    }
    if (options.trustLocalCalls && isLocalCall(req)) {
      next();
      return;
    }
    deny(res, 401, {
      error:
        'This workspace is locked. Open the unlock link from `npm run workspace-key` in the Replit Shell.',
      code: WORKSPACE_LOCKED,
    });
  };
}

export function createDeploymentGate(options: {
  authDeps: EndUserAuthDeps | null;
  publicRoutes?: PublicRoute[];
}): RequestHandler {
  const { authDeps } = options;
  if (!authDeps) {
    return function synapseAccessGate(_req, res) {
      deny(res, 503, { error: 'authentication is not configured' });
    };
  }
  const authRouter = createAuthRouter(authDeps);
  const requireEndUser = createRequireEndUser(authDeps);
  return function synapseAccessGate(req, res, next) {
    // The sign-in routes (/login, /auth/login, /oauth/callback, /logout, /api/me) answer first.
    authRouter(req, res, (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }
      if (isPublicRoute(req, options.publicRoutes)) {
        next();
        return;
      }
      requireEndUser(req, res, next);
    });
  };
}

// Installs the gate as the first middleware. Call it straight after `express()`.
export function installAccessGate(app: Application, mode: GateMode): void {
  app.use(
    mode.kind === 'deployment'
      ? createDeploymentGate({ authDeps: mode.authDeps })
      : createWorkspaceGate({
          workspaceKey: mode.workspaceKey,
          trustLocalCalls: mode.trustLocalCalls,
        }),
  );
}
