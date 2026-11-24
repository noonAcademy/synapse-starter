import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isAppBuilt, PLACEHOLDER_MARKER } from './app-built.js';

const PLACEHOLDER_HOME = `export function Page() {\n  return <${PLACEHOLDER_MARKER} />;\n}\n`;
const BUILT_HOME = 'export function Page() {\n  return <Dashboard />;\n}\n';

describe('isAppBuilt', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'app-built-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function seed(files: Record<string, string>) {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  }

  it('is false for a fresh clone: placeholder home, synapse scaffolding, registry', () => {
    seed({ 'home.tsx': PLACEHOLDER_HOME, 'synapse.tsx': '', 'index.ts': '' });
    expect(isAppBuilt(dir)).toBe(false);
  });

  it('ignores tests sitting next to the template pages', () => {
    seed({ 'home.tsx': PLACEHOLDER_HOME, 'synapse.tsx': '', 'home.test.tsx': '' });
    expect(isAppBuilt(dir)).toBe(false);
  });

  it('ignores a folder of helpers inside pages/', () => {
    seed({ 'home.tsx': PLACEHOLDER_HOME });
    mkdirSync(join(dir, 'parts'));
    expect(isAppBuilt(dir)).toBe(false);
  });

  it('is true once home.tsx no longer renders the placeholder', () => {
    seed({ 'home.tsx': BUILT_HOME, 'synapse.tsx': '', 'index.ts': '' });
    expect(isAppBuilt(dir)).toBe(true);
  });

  it('is true once the builder adds a page of their own, even with the placeholder home', () => {
    seed({ 'home.tsx': PLACEHOLDER_HOME, 'synapse.tsx': '', 'dashboard.tsx': BUILT_HOME });
    expect(isAppBuilt(dir)).toBe(true);
  });

  it('is true when home.tsx was removed in a restructure', () => {
    seed({ 'synapse.tsx': '', 'index.ts': '' });
    expect(isAppBuilt(dir)).toBe(true);
  });

  it('fails toward the console when the directory cannot be read', () => {
    expect(isAppBuilt(join(dir, 'missing'))).toBe(false);
  });
});
