// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsTab } from './SettingsTab';

const READY_OVERVIEW = {
  appId: 'app_demo',
  baseUrl: 'https://citadel.example',
  configured: true,
  configError: null,
  connection: { ok: true, detail: 'Last publish accepted — citadel.example is reachable.' },
};

const DEPLOY_SECRETS = [
  { name: 'SYNAPSE_APP_ID', set: true, required: true, scope: 'run' },
  { name: 'SYNAPSE_APP_SECRET', set: true, required: true, scope: 'run' },
  { name: 'APP_OAUTH_REDIRECT_URI', set: true, required: true, scope: 'deploy' },
  { name: 'APP_SESSION_SECRET', set: true, required: true, scope: 'deploy' },
];

function stubFetch(setup: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => (url.endsWith('/__synapse/setup') ? setup : READY_OVERVIEW),
    })),
  );
}

describe('<SettingsTab /> — Deployment sign-in', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('reports a configured gate, and says the check is of the workspace', async () => {
    stubFetch({ secrets: DEPLOY_SECRETS, deploy: { ready: true, missing: [] } });
    render(<SettingsTab />);

    expect(await screen.findByText('Sign in with Noon is configured')).toBeTruthy();
    // The false-negative this can't see: values present here, absent from the deployment.
    expect(screen.getByText(/carries its own copy of the secrets/)).toBeTruthy();
    expect(screen.getAllByText('set')).toHaveLength(2);
  });

  it('names the deploy values that are not set', async () => {
    stubFetch({
      secrets: DEPLOY_SECRETS.map((s) => (s.scope === 'deploy' ? { ...s, set: false } : s)),
      deploy: { ready: false, missing: ['APP_OAUTH_REDIRECT_URI', 'APP_SESSION_SECRET'] },
    });
    render(<SettingsTab />);

    expect(await screen.findByText('Needed before you deploy')).toBeTruthy();
    expect(screen.getAllByText('not set')).toHaveLength(2);
    expect(screen.getByText('APP_SESSION_SECRET')).toBeTruthy();
  });

  it('names a missing SYNAPSE_* key too, rather than showing two "set" pills and no cause', async () => {
    stubFetch({
      secrets: DEPLOY_SECRETS.map((s) =>
        s.name === 'SYNAPSE_APP_SECRET' ? { ...s, set: false } : s,
      ),
      deploy: { ready: false, missing: ['SYNAPSE_APP_SECRET'] },
    });
    render(<SettingsTab />);

    // Both deploy-scoped values ARE set — the gap is a key this section doesn't list, so the
    // card has to name it rather than leaving "Needed before you deploy" unexplained.
    expect(await screen.findByText('Needed before you deploy')).toBeTruthy();
    expect(screen.getByText(/Sign-in also needs SYNAPSE_APP_SECRET/)).toBeTruthy();
    expect(screen.getAllByText('set')).toHaveLength(2);
  });

  it('says "unknown" for an older server that reports no deployment state', async () => {
    stubFetch({ secrets: [{ name: 'SYNAPSE_APP_ID', set: true, required: true }] });
    render(<SettingsTab />);

    expect(await screen.findByText('Unknown')).toBeTruthy();
    expect(screen.getByText(/doesn't report deployment config yet/)).toBeTruthy();
    expect(screen.queryByText('Needed before you deploy')).toBeNull();
  });
});
