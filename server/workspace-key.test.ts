import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HEADERS_FILE, KEY_FILE, keyMatches, loadWorkspaceKey } from './workspace-key.js';

describe('loadWorkspaceKey', () => {
  it('creates a key once, keeps it, and writes the curl header file', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'synapse-key-'));
    const first = loadWorkspaceKey({ rootDir, replId: 'repl-a' });
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(loadWorkspaceKey({ rootDir, replId: 'repl-a' })).toBe(first);
    expect(readFileSync(join(rootDir, HEADERS_FILE), 'utf8')).toBe(
      `x-synapse-workspace-key: ${first}\n`,
    );
    expect(statSync(join(rootDir, KEY_FILE)).mode & 0o077).toBe(0);
  });

  it('makes a new key for a fork (another REPL_ID) and on rotate', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'synapse-key-'));
    const original = loadWorkspaceKey({ rootDir, replId: 'repl-a' });
    const forked = loadWorkspaceKey({ rootDir, replId: 'repl-b' });
    expect(forked).not.toBe(original);
    expect(loadWorkspaceKey({ rootDir, replId: 'repl-b', rotate: true })).not.toBe(forked);
  });
});

describe('keyMatches', () => {
  it('accepts only the exact key', () => {
    expect(keyMatches('a'.repeat(40), 'a'.repeat(40))).toBe(true);
    expect(keyMatches('a'.repeat(40), 'a'.repeat(39))).toBe(false);
    expect(keyMatches('a'.repeat(40), undefined)).toBe(false);
    expect(keyMatches('', '')).toBe(false);
  });
});
