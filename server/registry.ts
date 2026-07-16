import { buildHeaders } from '@noonacademy/citadel-transport';

// Live-registry access for the workspace console (and the maintainer sync script). Citadel
// serves the registry as TS source TEXT at GET /api/registry (HMAC-signed, ETag'd, with a
// /meta sibling for cheap version checks — contract in INTEGRATE.md §6). We deliberately
// neither execute nor parse that text at runtime: agents consume it as text (the freshest
// source when writing SQL), while the Get-data tab keeps browsing the committed snapshot's
// structures (server/citadel-schema.ts via tables.ts) and only renders freshness from here.
// Every failure mode falls back to the snapshot, labeled — the tab never breaks on this.

export interface RegistryCreds {
  baseUrl: string;
  appId: string;
  appSecret: string;
}

export type SnapshotReason = 'no-secrets' | 'not-deployed' | 'unreachable';

export interface RegistryStatus {
  source: 'live' | 'snapshot';
  /** Why we're on the snapshot; null when source is 'live'. */
  reason: SnapshotReason | null;
  /** From GET /api/registry/meta — null when unavailable (meta is best-effort). */
  liveVersion: string | null;
  liveLastModified: string | null;
  /** The "Last updated:" date in the snapshot's header comment; null if the header ever changes. */
  snapshotLastUpdated: string | null;
}

export interface RegistryResult {
  status: RegistryStatus;
  text: string;
}

const FETCH_TIMEOUT_MS = 3_000;

// The snapshot's provenance line (server/citadel-schema.ts header): "// Last updated: 2026-05-04".
export function snapshotLastUpdated(snapshotText: string): string | null {
  return snapshotText.match(/Last updated:\s*(\S+)/)?.[1] ?? null;
}

// One signed GET against Citadel. GET signs an empty body; the signed path must match the
// request path exactly (INTEGRATE.md §6).
async function signedGet(
  creds: RegistryCreds,
  path: string,
  fetchImpl: typeof fetch,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return fetchImpl(`${creds.baseUrl}${path}`, {
    headers: { ...buildHeaders(creds, path, ''), ...extraHeaders },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

// Fetch the live registry text or throw — the sync script's strict path. The console route
// never uses this directly; it goes through registryFetcher below, which falls back instead.
export async function fetchLiveRegistryText(
  creds: RegistryCreds,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await signedGet(creds, '/api/registry', fetchImpl);
  if (res.status === 404) {
    throw new Error(
      'GET /api/registry returned 404 — the registry endpoint is not deployed on this Citadel yet.',
    );
  }
  if (!res.ok) {
    throw new Error(`GET /api/registry failed: ${res.status}`);
  }
  return res.text();
}

interface RegistryMeta {
  version: string | null;
  lastModified: string | null;
}

// Meta is a nicety (version + date for the freshness banner) — any failure just means nulls.
async function fetchMeta(creds: RegistryCreds, fetchImpl: typeof fetch): Promise<RegistryMeta> {
  try {
    const res = await signedGet(creds, '/api/registry/meta', fetchImpl);
    if (!res.ok) return { version: null, lastModified: null };
    const body = (await res.json()) as { version?: unknown; lastModified?: unknown };
    return {
      version: typeof body.version === 'string' ? body.version : null,
      lastModified: typeof body.lastModified === 'string' ? body.lastModified : null,
    };
  } catch {
    return { version: null, lastModified: null };
  }
}

// The console's registry source: live when Citadel answers (revalidated with If-None-Match on
// every call — a 304 costs Citadel nothing and keeps agents always-fresh), snapshot otherwise.
// `creds` is null when the app has no secrets; `snapshotText` is read lazily so the fallback
// file is only touched when needed.
export function registryFetcher(deps: {
  creds: RegistryCreds | null;
  snapshotText: () => string;
  fetchImpl?: typeof fetch;
}): () => Promise<RegistryResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  let cached: { etag: string | null; text: string; meta: RegistryMeta } | null = null;

  const snapshot = (reason: SnapshotReason): RegistryResult => {
    const text = deps.snapshotText();
    return {
      status: {
        source: 'snapshot',
        reason,
        liveVersion: null,
        liveLastModified: null,
        snapshotLastUpdated: snapshotLastUpdated(text),
      },
      text,
    };
  };

  return async () => {
    if (!deps.creds) return snapshot('no-secrets');
    const creds = deps.creds;

    let res: Response;
    try {
      res = await signedGet(
        creds,
        '/api/registry',
        fetchImpl,
        cached?.etag ? { 'if-none-match': cached.etag } : {},
      );
    } catch {
      return snapshot('unreachable'); // offline / timeout / DNS — never the tab's problem
    }

    if (res.status === 304 && cached) {
      // Unchanged since last fetch — cached text is live-fresh by definition.
    } else if (res.ok) {
      const text = await res.text();
      const meta = await fetchMeta(creds, fetchImpl);
      cached = { etag: res.headers.get('etag'), text, meta };
    } else if (res.status === 404) {
      return snapshot('not-deployed'); // endpoint not on this Citadel yet (INTEGRATE.md §6 grounding note)
    } else {
      return snapshot('unreachable'); // 503 registry-temporarily-unavailable, 5xx, auth errors
    }

    if (!cached) return snapshot('unreachable'); // 304 with no prior cache — shouldn't happen
    return {
      status: {
        source: 'live',
        reason: null,
        liveVersion: cached.meta.version,
        liveLastModified: cached.meta.lastModified,
        snapshotLastUpdated: null,
      },
      text: cached.text,
    };
  };
}
