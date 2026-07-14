// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVerify } from './useVerify';
import { VerifyChip } from './VerifyChip';

// The chip is presentational (state lives in ConsoleApp via useVerify), so the harness wires
// the two together the same way ConsoleApp does — these tests cover hook + chip end to end.
function Harness() {
  const verify = useVerify();
  return <VerifyChip state={verify.state} onRerun={verify.run} />;
}

function stubVerify(payload: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<VerifyChip /> + useVerify', () => {
  it('runs on load and shows green when everything passes', async () => {
    const fetchMock = stubVerify({
      ok: true,
      steps: [{ name: 'typecheck', ok: true, durationMs: 1200, output: '' }],
    });
    render(<Harness />);
    expect(await screen.findByText('All checks pass')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/__synapse/verify');
  });

  it('shows the failing count on red, and the failed step output on click', async () => {
    stubVerify({
      ok: false,
      steps: [
        { name: 'typecheck', ok: true, durationMs: 900, output: '' },
        { name: 'lint', ok: false, durationMs: 300, output: 'ui.tsx:12 lint error here' },
      ],
    });
    render(<Harness />);

    const chip = await screen.findByText('1 failing');
    fireEvent.click(chip);
    expect(screen.getByText('lint')).toBeTruthy();
    expect(screen.getByText(/lint error here/)).toBeTruthy();
  });

  it('re-runs on demand via the re-run button', async () => {
    const fetchMock = stubVerify({ ok: true, steps: [] });
    render(<Harness />);
    await screen.findByText('All checks pass');

    fireEvent.click(screen.getByLabelText('Re-run checks'));
    expect(await screen.findByText('All checks pass')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('degrades to a warning when the endpoint is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, headers: { get: () => null } })),
    );
    render(<Harness />);
    expect(await screen.findByText("Couldn't check")).toBeTruthy();
  });
});
