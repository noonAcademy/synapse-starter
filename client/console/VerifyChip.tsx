import { useCallback, useEffect, useRef, useState } from 'react';
import { Pill } from '../ui';

// The console header's persistent "do the checks pass?" chip. It hits the workspace-only
// GET /__synapse/verify (typecheck -> lint -> tests, fail-fast) on console load and on demand
// via the re-run button; when red, clicking the chip opens the failing step's output. It can't
// use useJson directly (that loader is one-shot per URL and this needs manual re-runs), but it
// keeps the same status-shape and content-type guard.

// Mirrors server/verify.ts VerifyResult (served by /__synapse/verify).
interface VerifyStep {
  name: string;
  ok: boolean;
  durationMs: number;
  output: string;
}
interface VerifyResult {
  ok: boolean;
  steps: VerifyStep[];
}

type VerifyState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: VerifyResult };

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function VerifyChip() {
  const [state, setState] = useState<VerifyState>({ status: 'idle' });
  const [open, setOpen] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    setState({ status: 'running' });
    setOpen(false);
    try {
      const res = await fetch('/__synapse/verify');
      if (!res.ok) {
        throw new Error(`request failed (${res.status})`);
      }
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('endpoint unavailable here (the console is workspace-only)');
      }
      const data = (await res.json()) as VerifyResult;
      if (alive.current) {
        setState({ status: 'ready', data });
      }
    } catch (err) {
      if (alive.current) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'failed to run checks',
        });
      }
    }
  }, []);

  // The checks run on console load, so the chip is meaningful before anyone clicks anything.
  useEffect(() => {
    void run();
  }, [run]);

  const running = state.status === 'running' || state.status === 'idle';
  const failing = state.status === 'ready' ? state.data.steps.filter((s) => !s.ok) : [];

  return (
    <div className="relative flex shrink-0 items-center gap-1.5">
      {running && <Pill tone="neutral">Checking…</Pill>}
      {state.status === 'error' && (
        <Pill tone="warn" title={state.message}>
          Couldn't check
        </Pill>
      )}
      {state.status === 'ready' &&
        (state.data.ok ? (
          <Pill tone="good">All checks pass</Pill>
        ) : (
          // Red is a button: clicking reveals which step failed and its output.
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            {failing.length} failing
          </button>
        ))}
      <button
        type="button"
        onClick={() => void run()}
        disabled={running}
        title="Re-run checks (typecheck, lint, tests)"
        aria-label="Re-run checks"
        className="rounded-md px-1.5 py-0.5 text-sm text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ↻
      </button>

      {open && failing.length > 0 && state.status === 'ready' && (
        <div className="absolute right-0 top-full z-10 mt-2 w-[28rem] max-w-[85vw] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-lg">
          <ul className="space-y-2">
            {state.data.steps.map((step) => (
              <li key={step.name} className="min-w-0 space-y-2">
                <span className="flex items-center gap-2 text-sm text-slate-700">
                  <Pill tone={step.ok ? 'good' : 'error'}>{step.ok ? 'pass' : 'fail'}</Pill>
                  <span className="font-medium">{step.name}</span>
                  <span className="text-xs text-slate-400">{formatDuration(step.durationMs)}</span>
                </span>
                {!step.ok && (
                  <pre className="max-h-64 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    {step.output || '(no output)'}
                  </pre>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Later steps don't run after a failure — fix the red step and re-run.
          </p>
        </div>
      )}
    </div>
  );
}
