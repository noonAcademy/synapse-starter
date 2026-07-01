// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { getPageForPath, listAppPages } from './pages';

// jsonResponse mimics the server's /api/me: JSON body + a JSON content-type the probe checks for.
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('app page registry', () => {
  it('resolves the home page and falls back for unknown paths', () => {
    expect(getPageForPath('/')?.title).toBe('Home');
    expect(getPageForPath('/does-not-exist')?.title).toBe('Home');
    expect(listAppPages().length).toBeGreaterThan(0);
  });
});

describe('<AppShell /> session gate', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the login screen when the probe is unauthenticated (401)', async () => {
    // Every fetch (probe + LoginScreen's config fetch) resolves to 401 here.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(401, { error: 'Not signed in' })),
    );
    render(<AppShell />);
    expect(await screen.findByText('Sign in with Noon')).toBeTruthy();
  });

  it('renders the shipped app when the probe is authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { email: 'dana@noonacademy.com', name: 'Dana' })),
    );
    render(<AppShell />);
    expect(await screen.findByText('Welcome to your app')).toBeTruthy();
  });

  it('does not wall the app when the gate is absent (non-JSON catch-all response)', async () => {
    // Local / not-deployed: /api/me falls through to the SPA catch-all and returns HTML.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<!doctype html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );
    render(<AppShell />);
    expect(await screen.findByText('Welcome to your app')).toBeTruthy();
  });
});

// The mode split in client/main.tsx (workspace console vs shipped app) and client/console/* are
// intentionally untouched by this gate: AppShell only renders in 'published' mode, so the console
// stays unauthenticated. useSynapseMode's own tests cover that split.
