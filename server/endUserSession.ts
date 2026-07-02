import { createHmac, timingSafeEqual } from 'node:crypto';

// The app's own end-user session cookie. Copies the shape of Citadel's
// src/middleware/webSession.ts: base64url(JSON payload) + "." + HMAC-SHA256(payload) verified with
// a constant-time compare. The cookie carries ONLY identity — never the Citadel access/refresh
// tokens (those live server-side in the tokenStore, keyed by sessionId).

export interface EndUserIdentity {
  sessionId: string;
  email: string;
  name: string;
  // noon2_core profile id resolved at login. Null when the login payload carried no numeric id.
  coreProfileId: number | null;
}

export interface EndUserSession extends EndUserIdentity {
  // Unix seconds. Beyond this the cookie is rejected regardless of the browser's own expiry.
  exp: number;
}

export const SESSION_COOKIE_NAME = 'synapse_enduser_session';

// Identity horizon, matched to Citadel's own web session (one week). The short-lived Citadel access
// token is refreshed behind this via the tokenStore, so the identity cookie can outlive it.
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const toBase64Url = (input: string): string => Buffer.from(input, 'utf8').toString('base64url');
const fromBase64Url = (input: string): string => Buffer.from(input, 'base64url').toString('utf8');

const sign = (secret: string, value: string): string =>
  createHmac('sha256', secret).update(value).digest('base64url');

const secureEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, so bail early — the lengths themselves aren't secret.
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export function signSession(
  secret: string,
  identity: EndUserIdentity,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): string {
  const payload: EndUserSession = { ...identity, exp: nowSeconds() + ttlSeconds };
  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${sign(secret, encoded)}`;
}

export function verifySession(secret: string, token: string | undefined): EndUserSession | null {
  if (!token) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [encoded, signature] = parts;
  if (!encoded || !signature) {
    return null;
  }
  if (!secureEqual(sign(secret, encoded), signature)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Partial<EndUserSession>;
    if (
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (parsed.exp < nowSeconds()) {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      email: parsed.email,
      name: parsed.name,
      coreProfileId: typeof parsed.coreProfileId === 'number' ? parsed.coreProfileId : null,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
}

// Options for express `res.cookie` (maxAge in milliseconds). `secure` is true only in a deployed
// (HTTPS) environment; locally it stays false so the cookie survives plain-HTTP dev.
export function sessionCookieOptions(secure: boolean): SessionCookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

// Minimal cookie reader — avoids pulling in cookie-parser for the one cookie this app sets.
export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      continue;
    }
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}
