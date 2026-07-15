// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildKickoffPrompt, HomeTab } from './HomeTab';
import type { VerifyState } from './useVerify';

const READY_OVERVIEW = {
  appId: 'app_demo',
  baseUrl: 'https://citadel.example',
  configured: true,
  configError: null,
  connection: { ok: true, detail: 'Last publish accepted — staging Citadel is reachable.' },
};

const ALL_SET_SETUP = {
  secrets: [
    { name: 'SYNAPSE_APP_ID', set: true, required: true },
    { name: 'SYNAPSE_APP_SECRET', set: true, required: true },
    { name: 'SYNAPSE_BASE_URL', set: false, required: false },
  ],
  spec: { exists: true, filled: true },
};

const GREEN_VERIFY: VerifyState = {
  status: 'ready',
  data: { ok: true, steps: [{ name: 'typecheck', ok: true, durationMs: 900, output: '' }] },
};

function stubFetch(overrides: { overview?: unknown; setup?: unknown } = {}): void {
  const payload = (url: string): unknown => {
    if (url.endsWith('/__synapse/overview')) return overrides.overview ?? READY_OVERVIEW;
    if (url.endsWith('/__synapse/setup')) return overrides.setup ?? ALL_SET_SETUP;
    if (url.endsWith('/__synapse/reads')) {
      return [{ name: 'courses-by-type', title: 'Active courses by type', description: 'd' }];
    }
    if (url.endsWith('/__synapse/catalog')) return { total: 5 };
    return {};
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => payload(url),
    })),
  );
}

describe('<HomeTab />', () => {
  beforeEach(() => stubFetch());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('leads with the question and a single obvious primary action', async () => {
    const onNavigate = vi.fn();
    render(<HomeTab onNavigate={onNavigate} verify={GREEN_VERIFY} />);

    expect(screen.getByText('What do you want to build?')).toBeTruthy();
    fireEvent.click(screen.getByText('Get Noon data into my app'));
    expect(onNavigate).toHaveBeenCalledWith('get-data');
  });

  it('shows four Done checks when everything is green', async () => {
    render(<HomeTab onNavigate={vi.fn()} verify={GREEN_VERIFY} />);
    await waitFor(() => expect(screen.getAllByText('Done')).toHaveLength(4));
    expect(screen.getByText('Secret scan, typecheck, lint, and tests are all green.')).toBeTruthy();
  });

  it('goes red on a missing required secret, by NAME only, with the Secrets-pane fix', async () => {
    stubFetch({
      setup: {
        ...ALL_SET_SETUP,
        secrets: ALL_SET_SETUP.secrets.map((s) =>
          s.name === 'SYNAPSE_APP_SECRET' ? { ...s, set: false } : s,
        ),
      },
    });
    render(<HomeTab onNavigate={vi.fn()} verify={GREEN_VERIFY} />);

    expect(await screen.findByText('SYNAPSE_APP_SECRET — missing')).toBeTruthy();
    expect(screen.getByText(/Add the missing key/)).toBeTruthy();
    // The portal pointer comes from the overview's base URL.
    expect(screen.getByText('https://citadel.example/portal/replit-apps')).toBeTruthy();
  });

  it('marks the optional base URL as default, not missing', async () => {
    render(<HomeTab onNavigate={vi.fn()} verify={GREEN_VERIFY} />);
    expect(await screen.findByText('SYNAPSE_BASE_URL — default')).toBeTruthy();
    expect(screen.queryByText('SYNAPSE_BASE_URL — missing')).toBeNull();
  });

  it('goes red when not connected, with the press-Run / error-report fix', async () => {
    stubFetch({
      overview: {
        ...READY_OVERVIEW,
        connection: { ok: false, detail: 'Last publish failed: 401.' },
      },
    });
    render(<HomeTab onNavigate={vi.fn()} verify={GREEN_VERIFY} />);

    expect(await screen.findByText('Last publish failed: 401.')).toBeTruthy();
    expect(screen.getByText(/synapse-error-report/)).toBeTruthy();
  });

  it('goes red on an unfilled SPEC.md and points at the kickoff prompt', async () => {
    stubFetch({ setup: { ...ALL_SET_SETUP, spec: { exists: true, filled: false } } });
    render(<HomeTab onNavigate={vi.fn()} verify={GREEN_VERIFY} />);

    expect(await screen.findByText('SPEC.md is still the empty template.')).toBeTruthy();
    expect(
      screen.getByText('Ask your agent to interview you — copy the kickoff prompt below.'),
    ).toBeTruthy();
  });

  it('reflects a failing verify run by step name', async () => {
    render(
      <HomeTab
        onNavigate={vi.fn()}
        verify={{
          status: 'ready',
          data: {
            ok: false,
            steps: [
              { name: 'typecheck', ok: true, durationMs: 900, output: '' },
              { name: 'lint', ok: false, durationMs: 100, output: 'boom' },
            ],
          },
        }}
      />,
    );
    expect(await screen.findByText('lint failing.')).toBeTruthy();
  });

  it('shows pending states while checks are loading or running', async () => {
    render(<HomeTab onNavigate={vi.fn()} verify={{ status: 'running' }} />);
    expect(screen.getByText('Running the secret scan, typecheck, lint, and tests…')).toBeTruthy();
    expect(screen.getAllByText('Checking…').length).toBeGreaterThan(0);
  });
});

describe('buildKickoffPrompt', () => {
  it('routes the agent through the whole first-build contract', () => {
    const prompt = buildKickoffPrompt();
    expect(prompt).toContain('<describe what you want in plain English>');
    expect(prompt).toContain('read AGENTS.md in full');
    expect(prompt).toContain('.agents/skills/synapse-plan-first/SKILL.md');
    expect(prompt).toContain('write SPEC.md');
    expect(prompt).toContain('noon-sql-analyst');
    expect(prompt).toContain('server/queries/<name>.sql.ts');
    expect(prompt).toContain('never a raw fetch');
    expect(prompt).toContain('npm run verify');
  });
});
