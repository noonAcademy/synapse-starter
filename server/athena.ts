import type { SynapseClient } from '@noonacademy/synapse-sdk';

// A read result, normalised to the one shape the client renders: an ordered list of
// column names plus row objects keyed by those columns.
export interface AthenaRows {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean; // true when the result was capped at MAX_ROWS (surfaced in the UI)
}

// Framework-level backstop: cap rows before they reach the in-memory cache and the browser, so
// an unexpectedly large baked query can't OOM the cache or freeze the page. The shipped example
// returns a handful of rows; this guards future reads. `truncated` is surfaced, never silent.
const MAX_ROWS = 10_000;

function capRows(rows: Record<string, unknown>[]): {
  rows: Record<string, unknown>[];
  truncated: boolean;
} {
  return rows.length > MAX_ROWS
    ? { rows: rows.slice(0, MAX_ROWS), truncated: true }
    : { rows, truncated: false };
}

// The slice of the SDK (>=0.1.2) the read path depends on. We declare it locally
// rather than reaching for a method on `SynapseClient` so this app type-checks against
// any installed SDK version, and so the exact contract reads rely on is documented here:
// app-wide, HMAC-signed `athenaQuery({ sql })` — never a raw fetch.
export interface AthenaQueryClient {
  athenaQuery(opts: { sql: string }): Promise<unknown>;
}

// SDK >=0.1.2 adds `athenaQuery` to the client; 0.1.1 does not. Narrow through `unknown`
// so the cast holds whichever version is installed at build time (Replit installs the
// pinned >=0.1.2 at Run; local dev may still have 0.1.1 in node_modules).
export function asAthenaClient(client: SynapseClient | null): AthenaQueryClient | null {
  return client as unknown as AthenaQueryClient | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// First-seen column order across every row — stable, and independent of which row
// happens to be first when a value is null/absent.
function deriveColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      seen.add(key);
    }
  }
  return [...seen];
}

// `athenaQuery`'s payload shape isn't pinned by this template, so normalise defensively.
// Accept the canonical `{ columns, rows }`, a `{ rows }` object without columns, or a bare
// array of row objects; anything else collapses to an empty result rather than throwing.
// NOTE: an unrecognised payload is indistinguishable from a genuinely empty read here — both
// yield `{ columns: [], rows: [] }` and are cached as a successful empty result for the TTL.
export function normalizeAthenaResult(raw: unknown): AthenaRows {
  if (Array.isArray(raw)) {
    const { rows, truncated } = capRows(raw.filter(isRecord));
    return { columns: deriveColumns(rows), rows, truncated };
  }

  if (isRecord(raw) && Array.isArray(raw.rows)) {
    const { rows, truncated } = capRows(raw.rows.filter(isRecord));
    const columns =
      Array.isArray(raw.columns) && raw.columns.every((c) => typeof c === 'string')
        ? (raw.columns as string[])
        : deriveColumns(rows);
    return { columns, rows, truncated };
  }

  return { columns: [], rows: [], truncated: false };
}

// Run one baked SELECT app-wide and hand back rendered rows. The SQL is built at
// authoring time (see server/queries/*.sql.ts), so there are no params to bind here.
export async function runAthenaQuery(client: AthenaQueryClient, sql: string): Promise<AthenaRows> {
  return normalizeAthenaResult(await client.athenaQuery({ sql }));
}
