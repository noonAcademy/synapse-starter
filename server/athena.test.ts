import { describe, expect, it } from 'vitest';
import { normalizeAthenaResult, runAthenaQuery } from './athena.js';

describe('normalizeAthenaResult', () => {
  it('passes through the canonical { columns, rows } shape', () => {
    const raw = {
      columns: ['course_type', 'course_count'],
      rows: [
        { course_type: 'SCHOOL', course_count: 10 },
        { course_type: 'O2O', course_count: 4 },
      ],
    };
    expect(normalizeAthenaResult(raw)).toEqual(raw);
  });

  it('derives columns (first-seen order) from a bare array of row objects', () => {
    const result = normalizeAthenaResult([
      { a: 1, b: 2 },
      { a: 3, c: 4 },
    ]);
    expect(result.columns).toEqual(['a', 'b', 'c']);
    expect(result.rows).toHaveLength(2);
  });

  it('derives columns when { rows } has no columns array', () => {
    const result = normalizeAthenaResult({ rows: [{ x: 1 }] });
    expect(result.columns).toEqual(['x']);
  });

  it('collapses unexpected shapes to an empty result instead of throwing', () => {
    expect(normalizeAthenaResult(null)).toEqual({ columns: [], rows: [] });
    expect(normalizeAthenaResult('nope')).toEqual({ columns: [], rows: [] });
    expect(normalizeAthenaResult({ data: 1 })).toEqual({ columns: [], rows: [] });
  });
});

describe('runAthenaQuery', () => {
  it('calls athenaQuery with the SQL and normalizes the result', async () => {
    const calls: Array<{ sql: string }> = [];
    const client = {
      athenaQuery: async (opts: { sql: string }) => {
        calls.push(opts);
        return [{ n: 1 }];
      },
    };
    const result = await runAthenaQuery(client, 'SELECT 1');
    expect(calls).toEqual([{ sql: 'SELECT 1' }]);
    expect(result).toEqual({ columns: ['n'], rows: [{ n: 1 }] });
  });
});
