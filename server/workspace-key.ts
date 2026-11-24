import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The builder's key to their own workspace. On Replit the dev URL can be made public with one
// click, and the app cannot tell, so in the workspace every /api and /__synapse request must carry
// this key (see server/access-gate.ts). It is created on first boot, stays on this Repl's disk,
// and is never committed: both files end in `.local`, which .gitignore and Vite's file server deny.
//
// A fork or remix copies the disk, so the key is bound to REPL_ID: a new Repl makes a new key.

export const WORKSPACE_KEY_HEADER = 'x-synapse-workspace-key';
export const KEY_FILE = '.synapse-workspace-key.local';
// curl reads extra headers from a file with `-H @<file>`; the Agent's skills use this.
export const HEADERS_FILE = '.synapse-workspace.headers.local';

interface StoredKey {
  replId: string | null;
  key: string;
}

export function readStoredWorkspaceKey(rootDir: string): StoredKey | null {
  return readStored(resolve(rootDir, KEY_FILE));
}

function readStored(path: string): StoredKey | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredKey>;
    return typeof parsed.key === 'string' && parsed.key.length >= 32
      ? { replId: parsed.replId ?? null, key: parsed.key }
      : null;
  } catch {
    return null;
  }
}

export function loadWorkspaceKey(options: {
  rootDir: string;
  replId: string | null;
  rotate?: boolean;
}): string {
  const keyPath = resolve(options.rootDir, KEY_FILE);
  const stored = options.rotate ? null : readStored(keyPath);
  const key =
    stored && stored.replId === options.replId ? stored.key : randomBytes(32).toString('base64url');
  if (key !== stored?.key) {
    writeFileSync(keyPath, `${JSON.stringify({ replId: options.replId, key })}\n`, { mode: 0o600 });
  }
  writeHeadersFile(options.rootDir, key);
  return key;
}

export function writeHeadersFile(rootDir: string, key: string): void {
  writeFileSync(resolve(rootDir, HEADERS_FILE), `${WORKSPACE_KEY_HEADER}: ${key}\n`, {
    mode: 0o600,
  });
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

// Compares digests so the two buffers always have the same length (timingSafeEqual needs that).
export function keyMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string' || given.length === 0 || expected.length === 0) return false;
  return timingSafeEqual(digest(expected), digest(given));
}
