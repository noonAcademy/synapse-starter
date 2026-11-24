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

  it('forgets only the refused key, not a newer one another tab saved', async () => {
    const { forgetWorkspaceKey, saveWorkspaceKey, workspaceKey } = await import('./workspaceKey');
    saveWorkspaceKey('old');
    window.localStorage.setItem('synapse.workspaceKey', 'new');
    forgetWorkspaceKey('old');
    expect(window.localStorage.getItem('synapse.workspaceKey')).toBe('new');
    expect(workspaceKey()).toBe('new');
    forgetWorkspaceKey('new');
    expect(workspaceKey()).toBeNull();
  });

  it('shows an error in the opened tab when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network');
      }),
    );
    const tab = { opener: {}, location: { href: '' } };
    vi.stubGlobal(
      'open',
      vi.fn(() => tab),
    );
    const parts: string[] = [];
    vi.stubGlobal(
      'Blob',
      class {
        constructor(body: string[]) {
          parts.push(...body);
        }
      },
    );
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = () => 'blob:x';
        static revokeObjectURL = () => undefined;
      },
    );
    const { openGatedText } = await import('./workspaceKey');
    await openGatedText('/__synapse/registry');
    expect(tab.location.href).toBe('blob:x');
    expect(parts.join('')).toContain('Request failed');
  });
});
