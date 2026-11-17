// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleApp } from './ConsoleApp';

// Every tab loads from a /__synapse/* endpoint; this suite is about the console's own chrome, so
// the endpoints are failed deliberately — each tab's own suite covers its loaded states, and the
// chrome has to render regardless.
function stubFailingFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    }),
  );
}

describe('<ConsoleApp />', () => {
  beforeEach(() => stubFailingFetch());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('offers a way out to the builder’s own app from every tab', () => {
    render(<ConsoleApp />);

    const link = screen.getByRole('link', { name: /Preview your app/ });
    // ?surface=app is what flips main.tsx from the console to the shipped app in a workspace,
    // where the /__synapse routes exist and would otherwise always resolve to the console.
    expect(link.getAttribute('href')).toBe('/?surface=app');
    // A new tab, so the console the builder is working in survives the click.
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('keeps the console chrome up when the workspace endpoints are unreachable', () => {
    render(<ConsoleApp />);
    expect(screen.getByRole('heading', { level: 1, name: 'Synapse' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Preview your app/ })).toBeTruthy();
  });
});
