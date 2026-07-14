import { useState } from 'react';
import { Pill } from '../ui';
import type { VerifyState } from './useVerify';

// The console header's persistent "do the checks pass?" chip. Presentational: the verify state
// lives in ConsoleApp (via useVerify) so the Home tab's checklist shares the same run instead
// of kicking off its own. The ↻ button re-runs on demand; when red, clicking the chip opens
// the failing step's output.

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function VerifyChip({ state, onRerun }: { state: VerifyState; onRerun: () => void }) {
  const [open, setOpen] = useState(false);

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
        onClick={() => {
          setOpen(false);
          onRerun();
        }}
        disabled={running}
        title="Re-run checks (secret scan, typecheck, lint, tests)"
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
