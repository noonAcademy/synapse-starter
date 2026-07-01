// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeTab } from './HomeTab';

function payload(url: string): unknown {
  if (url.endsWith('/__synapse/overview')) {
    return {
      appId: 'app_demo',
      baseUrl: 'https://citadel.example',
      configured: true,
      configError: null,
      connection: { ok: true, detail: 'Last publish accepted — staging Citadel is reachable.' },
    };
  }
  if (url.endsWith('/__synapse/reads')) {
    return [{ name: 'courses-by-type', title: 'Active courses by type', description: 'd' }];
  }
  if (url.endsWith('/__synapse/catalog')) return { total: 5 };
  return {};
}

describe('<HomeTab />', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => payload(url),
      })),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('leads with the question and a single obvious primary action', async () => {
    const onNavigate = vi.fn();
    render(<HomeTab onNavigate={onNavigate} />);

    expect(screen.getByText('What do you want to build?')).toBeTruthy();

    // The primary action navigates to the composer.
    fireEvent.click(screen.getByText('Get Noon data into my app'));
    expect(onNavigate).toHaveBeenCalledWith('get-data');
  });

  it('shows a friendly connection status once loaded', async () => {
    render(<HomeTab onNavigate={vi.fn()} />);
    expect(await screen.findByText('Connected to Noon')).toBeTruthy();
  });
});
