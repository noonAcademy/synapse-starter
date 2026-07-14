import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs the repo's verify steps (the same chain as `npm run verify`) as child processes and
// reports structured results for the console's verify chip. Failures are data, not errors:
// a red step comes back as `ok: false` with its output, and run() never rejects.

export interface VerifyStep {
  name: string;
  ok: boolean;
  durationMs: number;
  /** Combined stdout+stderr, truncated to roughly the last 50 lines. */
  output: string;
}

export interface VerifyResult {
  ok: boolean;
  steps: VerifyStep[];
}

export interface VerifyCommand {
  name: string;
  command: string;
  args: string[];
}

const OUTPUT_TAIL_LINES = 50;
// Keeps a wedged child from pinning the in-flight lock (and the console chip) forever.
const STEP_TIMEOUT_MS = 5 * 60_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Mirrors package.json's `verify` script: same steps, same order, same fail-fast. The secret
// scan goes first — it's the fastest step and the most urgent failure.
const VERIFY_COMMANDS: VerifyCommand[] = [
  { name: 'secrets', command: 'npm', args: ['run', 'secrets'] },
  { name: 'typecheck', command: 'npm', args: ['run', 'typecheck'] },
  { name: 'lint', command: 'npm', args: ['run', 'lint'] },
  { name: 'test', command: 'npm', args: ['run', 'test'] },
];

function truncateOutput(raw: string): string {
  const lines = raw.replace(/\n$/, '').split('\n');
  if (lines.length <= OUTPUT_TAIL_LINES) {
    return lines.join('\n');
  }
  return [`… (${lines.length - OUTPUT_TAIL_LINES} earlier lines truncated)`]
    .concat(lines.slice(-OUTPUT_TAIL_LINES))
    .join('\n');
}

function runStep(step: VerifyCommand, cwd: string): Promise<VerifyStep> {
  const startedAt = Date.now();
  return new Promise((resolveStep) => {
    let output = '';
    const append = (chunk: unknown): void => {
      output += String(chunk);
      // Cap the buffer so a chatty step can't grow memory unboundedly; only the tail is kept.
      if (output.length > 200_000) {
        output = output.slice(-100_000);
      }
    };
    const settle = (ok: boolean, note?: string): void => {
      resolveStep({
        name: step.name,
        ok,
        durationMs: Date.now() - startedAt,
        output: truncateOutput(note ? `${output}\n${note}` : output),
      });
    };

    const child = spawn(step.command, step.args, { cwd, timeout: STEP_TIMEOUT_MS });
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    // 'error' (e.g. the binary isn't installed) settles the step as failed — never a rejection.
    child.on('error', (err) => settle(false, `could not run ${step.command}: ${err.message}`));
    child.on('close', (code, signal) => {
      if (signal) {
        settle(false, `killed by ${signal} (step timed out after ${STEP_TIMEOUT_MS / 1000}s?)`);
        return;
      }
      settle(code === 0);
    });
  });
}

async function runAll(commands: VerifyCommand[], cwd: string): Promise<VerifyResult> {
  const steps: VerifyStep[] = [];
  for (const command of commands) {
    const step = await runStep(command, cwd);
    steps.push(step);
    if (!step.ok) {
      break; // fail fast, like the npm script — later steps don't run
    }
  }
  return { ok: steps.every((s) => s.ok), steps };
}

// One runner per process. Concurrent requests (say, two console tabs loading at once) share the
// in-flight run instead of stacking `tsc` + `vitest` processes: callers awaiting run() while one
// is executing all receive that run's result.
export function createVerifyRunner(
  commands: VerifyCommand[] = VERIFY_COMMANDS,
  cwd: string = repoRoot,
): { run: () => Promise<VerifyResult> } {
  let inFlight: Promise<VerifyResult> | null = null;
  return {
    run: () => {
      if (!inFlight) {
        inFlight = runAll(commands, cwd).finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}

export const verifyRunner = createVerifyRunner();
