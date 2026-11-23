// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('installWorkspaceKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    window.localStorage.clear();
  });

  it('takes the key from the fragment, clears it from the address, and adds it to gated fetches only', async () => {
    const seen: Array<{ url: string; key: string | null }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : String(input);
        seen.push({ url, key: new Headers(init?.headers).get('x-synapse-workspace-key') });
        return new Response('{}');
      }),
    );
    window.history.replaceState(null, '', '/?surface=app#synapse_key=abc123&tab=views');
    const { installWorkspaceKey } = await import('./workspaceKey');
    installWorkspaceKey();

    expect(window.location.hash).toBe('#tab=views');
    expect(window.location.search).toBe('?surface=app');

    await fetch('/api/views');
    await fetch('/__synapse/overview');
    await fetch('/assets/app.js');
    await fetch('https://example.com/api/x');
    expect(seen.map((s) => s.key)).toEqual(['abc123', 'abc123', null, null]);
  });

  it('leaves fetch alone when no key is stored (a deployment)', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchSpy);
    window.history.replaceState(null, '', '/');
    const { installWorkspaceKey } = await import('./workspaceKey');
    installWorkspaceKey();
    await fetch('/api/views');
    const [input] = fetchSpy.mock.calls[0] as unknown as [RequestInfo];
    expect(input).toBe('/api/views');
  });
});
