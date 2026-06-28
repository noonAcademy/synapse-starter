import { describe, expect, it } from 'vitest';
import type { AthenaQueryClient } from './athena.js';
import { createQueryCache } from './query-cache.js';
import { runRead } from './reads.js';

const EXAMPLE = 'courses-by-type';

function mockClient(rows: Record<string, unknown>[]) {
  let calls = 0;
  const client: AthenaQueryClient = {
    athenaQuery: async () => {
      calls += 1;
      return { columns: Object.keys(rows[0] ?? {}), rows };
    },
  };
  return { client, calls: () => calls };
}

describe('runRead', () => {
  it('returns null for an unknown read name (route answers 404)', async () => {
    expect(await runRead(mockClient([]).client, 'does-not-exist')).toBeNull();
  });

  it('returns an empty, configured:false result when the client is null (never throws)', async () => {
    const result = await runRead(null, EXAMPLE);
    expect(result).not.toBeNull();
    expect(result?.configured).toBe(false);
    expect(result?.rows).toEqual([]);
    expect(result?.dataAsOf).toBeNull();
    expect(result?.error).toBeNull();
    // baked metadata still surfaces so the UI can show the SQL
    expect(result?.sql).toContain('FROM noon2_datamart.d_course');
  });

  it('runs the baked SQL via the SDK and returns rows with a freshness stamp', async () => {
    const { client, calls } = mockClient([
      { course_type: 'SCHOOL', course_count: 12 },
      { course_type: 'O2O', course_count: 5 },
    ]);
    const cache = createQueryCache<{ columns: string[]; rows: Record<string, unknown>[] }>({
      now: () => 1_700_000_000_000,
    });

    const result = await runRead(client, EXAMPLE, { cache });
    expect(calls()).toBe(1);
    expect(result?.configured).toBe(true);
    expect(result?.cached).toBe(false);
    expect(result?.columns).toEqual(['course_type', 'course_count']);
    expect(result?.rows).toHaveLength(2);
    expect(result?.dataAsOf).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it('serves the second call from cache (the SDK is hit once)', async () => {
    const { client, calls } = mockClient([{ course_type: 'SCHOOL', course_count: 1 }]);
    const cache = createQueryCache<{ columns: string[]; rows: Record<string, unknown>[] }>({
      now: () => 0,
    });

    const first = await runRead(client, EXAMPLE, { cache });
    const second = await runRead(client, EXAMPLE, { cache });
    expect(calls()).toBe(1);
    expect(first?.cached).toBe(false);
    expect(second?.cached).toBe(true);
  });

  it('surfaces a read failure as an error field, not a throw/500', async () => {
    const failing: AthenaQueryClient = {
      athenaQuery: async () => {
        throw new Error('staging unreachable');
      },
    };
    const result = await runRead(failing, EXAMPLE, { cache: createQueryCache() });
    expect(result?.configured).toBe(true);
    expect(result?.error).toBe('staging unreachable');
    expect(result?.rows).toEqual([]);
  });
});
