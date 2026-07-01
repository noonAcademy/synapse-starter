import { buildHeaders } from '@noonacademy/citadel-transport';

// Thin client for Citadel's OAuth endpoints (see the local noon-citadel checkout,
// src/http/oauth-login-http.ts + oauth-token-http.ts for the wire contracts):
//   POST /api/oauth/login    — BARE (no HMAC). Exchanges a Google credential for a one-time code.
//   POST /api/oauth/token    — HMAC-signed. Exchanges the code for {accessToken, refreshToken}.
//   POST /api/oauth/refresh  — HMAC-signed. Rotates the token pair.
// Only login/token/refresh are needed here; nothing else in the SDK covers this app-as-IdP flow.

export interface CitadelOAuthConfig {
  baseUrl: string;
  appId: string;
  appSecret: string;
  redirectUri: string;
  // Injectable for tests; defaults to the global fetch.
  fetchImpl?: typeof fetch;
}

// One entry of the `profiles` array returned by /api/oauth/login (Citadel's normalized staff
// profile). Fields are optional because the upstream payload is best-effort.
export interface CitadelProfile {
  id?: number;
  name?: string;
  email?: string;
  avatarUri?: string;
  userType?: string;
  type?: string;
  account?: { email?: string; username?: string };
}

export interface OAuthLoginResult {
  code: string;
  sessionToken: string | null;
  profiles: CitadelProfile[];
  selectedProfileId: number | null;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  // Seconds until the access token expires.
  expiresIn: number;
  type: string | null;
}

export interface OAuthTokenResult {
  token: OAuthTokens;
  // Raw noon2-core profile payload, passed through untyped — identity is derived from the login
  // result's profiles instead, so callers rarely need this.
  profile: unknown;
}

// /api/oauth/refresh returns the token fields flat (not wrapped in `token` like /api/oauth/token).
export type OAuthRefreshResult = OAuthTokens;

// Surfaces Citadel's HTTP status so callers can react to it — notably 403 (external-only account)
// and 401 (expired refresh token).
export class OAuthError extends Error {
  readonly status: number;
  readonly operation: string;
  constructor(message: string, status: number, operation: string) {
    super(message);
    this.name = 'OAuthError';
    this.status = status;
    this.operation = operation;
  }
}

// Bound client so callers (and tests) can depend on a small interface rather than the free functions.
export interface CitadelOAuthClient {
  login(args: { credential: string }): Promise<OAuthLoginResult>;
  token(args: { code: string }): Promise<OAuthTokenResult>;
  refresh(args: { refreshToken: string }): Promise<OAuthRefreshResult>;
}

const trimBase = (base: string): string => base.replace(/\/+$/, '');

// Outbound Citadel calls get a timeout so a hung upstream can't block a request (e.g. during
// /auth/callback) indefinitely and exhaust connections under load.
const DEFAULT_TIMEOUT_MS = 10_000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asNumber = (value: unknown): number => (typeof value === 'number' ? value : 0);
const asOptString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asOptNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function errorMessage(data: unknown, operation: string, status: number): string {
  if (isObject(data) && typeof data.error === 'string') {
    return data.error;
  }
  return `Citadel oauth ${operation} failed (HTTP ${status})`;
}

export async function oauthLogin(
  cfg: CitadelOAuthConfig,
  { credential }: { credential: string },
): Promise<OAuthLoginResult> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const res = await doFetch(`${trimBase(cfg.baseUrl)}/api/oauth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential, appId: cfg.appId, redirectUri: cfg.redirectUri }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new OAuthError(errorMessage(data, 'login', res.status), res.status, 'login');
  }
  const obj = isObject(data) ? data : {};
  return {
    code: asString(obj.code),
    sessionToken: asOptString(obj.sessionToken),
    profiles: Array.isArray(obj.profiles) ? (obj.profiles as CitadelProfile[]) : [],
    selectedProfileId: asOptNumber(obj.selectedProfileId),
  };
}

async function signedPost(cfg: CitadelOAuthConfig, path: string, body: unknown): Promise<unknown> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const rawBody = JSON.stringify(body);
  const headers = buildHeaders(
    { baseUrl: cfg.baseUrl, appId: cfg.appId, appSecret: cfg.appSecret },
    path,
    rawBody,
  );
  const operation = path.split('/').pop() ?? path;
  const res = await doFetch(`${trimBase(cfg.baseUrl)}${path}`, {
    method: 'POST',
    headers,
    body: rawBody,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new OAuthError(errorMessage(data, operation, res.status), res.status, operation);
  }
  return data;
}

function toTokens(source: Record<string, unknown>, operation: string): OAuthTokens {
  // Fail fast on a malformed response rather than coercing missing tokens to empty strings and
  // storing/using a blank access token downstream.
  if (typeof source.accessToken !== 'string' || typeof source.refreshToken !== 'string') {
    throw new OAuthError(
      `Citadel oauth ${operation} response missing token fields`,
      502,
      operation,
    );
  }
  return {
    accessToken: source.accessToken,
    refreshToken: source.refreshToken,
    expiresIn: asNumber(source.expiresIn),
    type: asOptString(source.type),
  };
}

export async function oauthToken(
  cfg: CitadelOAuthConfig,
  { code }: { code: string },
): Promise<OAuthTokenResult> {
  const data = await signedPost(cfg, '/api/oauth/token', { code });
  const obj = isObject(data) ? data : {};
  const tokenObj = isObject(obj.token) ? obj.token : {};
  return {
    token: toTokens(tokenObj, 'token'),
    profile: obj.profile ?? null,
  };
}

export async function oauthRefresh(
  cfg: CitadelOAuthConfig,
  { refreshToken }: { refreshToken: string },
): Promise<OAuthRefreshResult> {
  const data = await signedPost(cfg, '/api/oauth/refresh', { refreshToken });
  return toTokens(isObject(data) ? data : {}, 'refresh');
}

export function createCitadelOAuthClient(cfg: CitadelOAuthConfig): CitadelOAuthClient {
  return {
    login: (args) => oauthLogin(cfg, args),
    token: (args) => oauthToken(cfg, args),
    refresh: (args) => oauthRefresh(cfg, args),
  };
}
