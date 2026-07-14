import { describe, expect, it } from 'vitest';
import { createVerifyRunner, type VerifyCommand } from './verify.js';

// Fake steps run tiny `node -e` programs instead of the real typecheck/lint/test chain, so the
// suite exercises the runner's contract (fail-fast, truncation, sharing) in milliseconds.
function step(name: string, program: string): VerifyCommand {
  return { name, command: process.execPath, args: ['-e', program] };
}

describe('verify runner', () => {
  it('reports all-green when every step exits 0', async () => {
    const runner = createVerifyRunner([
      step('typecheck', 'console.log("clean")'),
      step('lint', 'process.exit(0)'),
    ]);
    const result = await runner.run();
    expect(result.ok).toBe(true);
    expect(result.steps.map((s) => s.name)).toEqual(['typecheck', 'lint']);
    expect(result.steps[0]?.output).toContain('clean');
    expect(result.steps[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('fails fast: a red step is reported and later steps never run', async () => {
    const runner = createVerifyRunner([
      step('typecheck', 'console.error("TS2304: nope"); process.exit(2)'),
      step('lint', 'process.exit(0)'),
    ]);
    const result = await runner.run();
    expect(result.ok).toBe(false);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({ name: 'typecheck', ok: false });
    expect(result.steps[0]?.output).toContain('TS2304');
  });

  it('resolves (not rejects) when a step command cannot be spawned', async () => {
    const runner = createVerifyRunner([
      { name: 'typecheck', command: '/definitely/not/a/binary', args: [] },
    ]);
    const result = await runner.run();
    expect(result.ok).toBe(false);
    expect(result.steps[0]?.output).toContain('could not run');
  });

  it('keeps only the tail of a long output', async () => {
    const runner = createVerifyRunner([
      step('test', 'for (let i = 0; i < 200; i++) console.log("line " + i)'),
    ]);
    const { steps } = await runner.run();
    expect(steps[0]?.output).toContain('earlier lines truncated');
    expect(steps[0]?.output).toContain('line 199');
    expect(steps[0]?.output).not.toContain('line 10\n');
  });

  it('shares one in-flight run across concurrent callers', async () => {
    // Each run of this step would emit a different pid; identical outputs prove a single child.
    const runner = createVerifyRunner([step('test', 'console.log("pid " + process.pid)')]);
    const [a, b] = await Promise.all([runner.run(), runner.run()]);
    expect(a.steps[0]?.output).toBe(b.steps[0]?.output);

    // A run started after the first settles is a fresh one.
    const c = await runner.run();
    expect(c.steps[0]?.output).not.toBe(a.steps[0]?.output);
  });
});
