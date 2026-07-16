import { describe, expect, it, vi } from 'vitest';
import { fetchLiveRegistryText, registryFetcher, snapshotLastUpdated } from './registry.js';

const CREDS = { baseUrl: 'https://citadel.test', appId: 'app_x', appSecret: 'rpl_test_secret' };
const SNAPSHOT = '// Last updated: 2026-05-04\nexport const ATHENA_REGISTRY = {};\n';
const LIVE_TEXT = '// Last updated: 2026-07-20\nexport const ATHENA_REGISTRY = { fresh: true };\n';

type Reply = { status: number; text?: string; json?: unknown; etag?: string };

// A tiny signed-endpoint double: replies by path, records every request's headers.
function fakeFetch(replies: Record<string, Reply | (() => Reply)>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const impl = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const path = new URL(url).pathname;
    const spec = replies[path];
    const r = typeof spec === 'function' ? spec() : spec;
    if (!r) throw new Error(`unexpected fetch: ${url}`);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (h: string) => (h.toLowerCase() === 'etag' ? (r.etag ?? null) : null) },
      text: async () => r.text ?? '',
      json: async () => r.json ?? {},
    };
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function fetcherWith(replies: Record<string, Reply | (() => Reply)>, creds = CREDS) {
  const { impl, calls } = fakeFetch(replies);
  const get = registryFetcher({ creds, snapshotText: () => SNAPSHOT, fetchImpl: impl });
  return { get, calls };
}

describe('registryFetcher', () => {
  it('serves the live text with meta, and signs the request', async () => {
    const { get, calls } = fetcherWith({
      '/api/registry': { status: 200, text: LIVE_TEXT, etag: '"v9"' },
      '/api/registry/meta': { status: 200, json: { version: 'v2.30', lastModified: '2026-07-20' } },
    });
    const result = await get();

    expect(result.text).toBe(LIVE_TEXT);
    expect(result.status).toEqual({
      source: 'live',
      reason: null,
      liveVersion: 'v2.30',
      liveLastModified: '2026-07-20',
      snapshotLastUpdated: null,
    });
    // HMAC headers on the wire (INTEGRATE.md §6): app id + t=,v1= signature.
    expect(calls[0]?.headers['x-replit-app-id']).toBe('app_x');
    expect(calls[0]?.headers['x-citadel-signature']).toMatch(/t=\d+/);
  });

  it('revalidates with If-None-Match and serves the cache on 304 — still live', async () => {
    let first = true;
    const { get, calls } = fetcherWith({
      '/api/registry': (): Reply => {
        if (first) {
          first = false;
          return { status: 200, text: LIVE_TEXT, etag: '"v9"' };
        }
        return { status: 304 };
      },
      '/api/registry/meta': { status: 200, json: { version: 'v2.30', lastModified: '2026-07-20' } },
    });
    await get();
    const second = await get();

    const registryCalls = calls.filter((c) => c.url.endsWith('/api/registry'));
    expect(registryCalls[1]?.headers['if-none-match']).toBe('"v9"');
    expect(second.status.source).toBe('live');
    expect(second.text).toBe(LIVE_TEXT);
    // meta was cached from the 200 — a 304 must not refetch it
    expect(calls.filter((c) => c.url.endsWith('/meta'))).toHaveLength(1);
  });

  it('404 (endpoint not deployed) falls back to the snapshot, labeled not-deployed', async () => {
    const { get } = fetcherWith({ '/api/registry': { status: 404 } });
    const result = await get();
    expect(result.text).toBe(SNAPSHOT);
    expect(result.status.source).toBe('snapshot');
    expect(result.status.reason).toBe('not-deployed');
    expect(result.status.snapshotLastUpdated).toBe('2026-05-04');
  });

  it('503 and network failure fall back to the snapshot, labeled unreachable', async () => {
    for (const replies of [
      { '/api/registry': { status: 503 } },
      {
        '/api/registry': () => {
          throw new Error('offline');
        },
      },
    ]) {
      const { get } = fetcherWith(replies as Record<string, Reply | (() => Reply)>);
      const result = await get();
      expect(result.status).toMatchObject({ source: 'snapshot', reason: 'unreachable' });
      expect(result.text).toBe(SNAPSHOT);
    }
  });

  it('missing secrets never touches the network', async () => {
    const { impl, calls } = fakeFetch({});
    const get = registryFetcher({ creds: null, snapshotText: () => SNAPSHOT, fetchImpl: impl });
    const result = await get();
    expect(result.status).toMatchObject({ source: 'snapshot', reason: 'no-secrets' });
    expect(calls).toHaveLength(0);
  });

  it('meta failure degrades to nulls without losing the live text', async () => {
    const { get } = fetcherWith({
      '/api/registry': { status: 200, text: LIVE_TEXT, etag: null as unknown as string },
      '/api/registry/meta': { status: 503 },
    });
    const result = await get();
    expect(result.status.source).toBe('live');
    expect(result.status.liveVersion).toBeNull();
    expect(result.text).toBe(LIVE_TEXT);
  });
});

describe('fetchLiveRegistryText (the sync script path — strict, no fallback)', () => {
  it('returns the text on 200', async () => {
    const { impl } = fakeFetch({ '/api/registry': { status: 200, text: LIVE_TEXT } });
    expect(await fetchLiveRegistryText(CREDS, impl)).toBe(LIVE_TEXT);
  });

  it('names the not-deployed case on 404, and throws on other failures', async () => {
    const notDeployed = fakeFetch({ '/api/registry': { status: 404 } });
    await expect(fetchLiveRegistryText(CREDS, notDeployed.impl)).rejects.toThrow(/not deployed/);
    const down = fakeFetch({ '/api/registry': { status: 503 } });
    await expect(fetchLiveRegistryText(CREDS, down.impl)).rejects.toThrow(/503/);
  });
});

describe('snapshotLastUpdated', () => {
  it('reads the header date and tolerates its absence', () => {
    expect(snapshotLastUpdated(SNAPSHOT)).toBe('2026-05-04');
    expect(snapshotLastUpdated('export const X = 1;')).toBeNull();
  });
});
