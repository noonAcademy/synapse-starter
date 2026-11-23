// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSynapseMode } from './useSynapseMode';

function stubFetch(
  res: { ok: boolean; contentType: string; status?: number; body?: unknown } | Error,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (res instanceof Error) {
        throw res;
      }
      return {
        ok: res.ok,
        status: res.status ?? (res.ok ? 200 : 500),
        headers: { get: () => res.contentType },
        json: async () => res.body ?? {},
      };
    }),
  );
}

describe('useSynapseMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves to workspace when the endpoint returns JSON', async () => {
    stubFetch({ ok: true, contentType: 'application/json' });
    const { result } = renderHook(() => useSynapseMode());
    await waitFor(() => expect(result.current).toBe('workspace'));
  });

  it('resolves to published when the request falls through to the SPA (html)', async () => {
    stubFetch({ ok: true, contentType: 'text/html' });
    const { result } = renderHook(() => useSynapseMode());
    await waitFor(() => expect(result.current).toBe('published'));
  });

  it('resolves to locked when the workspace gate refuses the probe, even with ?surface=app', async () => {
    window.history.replaceState(null, '', '/?surface=app');
    stubFetch({
      ok: false,
      status: 401,
      contentType: 'application/json',
      body: { code: 'workspace_locked' },
    });
    const { result } = renderHook(() => useSynapseMode());
    await waitFor(() => expect(result.current).toBe('locked'));
    window.history.replaceState(null, '', '/');
  });

  it('treats a deployment 401 (not the workspace lock) as the shipped app', async () => {
    stubFetch({ ok: false, status: 401, contentType: 'application/json', body: { error: 'x' } });
    const { result } = renderHook(() => useSynapseMode());
    await waitFor(() => expect(result.current).toBe('published'));
  });

  it('defaults to published (never the console) when the probe errors', async () => {
    stubFetch(new Error('network'));
    const { result } = renderHook(() => useSynapseMode());
    await waitFor(() => expect(result.current).toBe('published'));
  });
});
