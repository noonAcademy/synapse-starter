// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filterTables, type TableProjection, TablesTab } from './TablesTab';

const TABLES: TableProjection[] = [
  {
    key: 'd_course',
    database: 'noon2_datamart',
    table: 'd_course',
    description: 'Distinct list of all courses',
    grain: 'Course ID',
    refreshCadence: 'Every 12 hours',
    accessLevel: 'all',
    columns: [{ name: 'course_id', type: 'int', description: 'PK' }],
    exampleQueries: [],
  },
  {
    key: 'f_user_session',
    database: 'noon2_datamart',
    table: 'f_user_session',
    description: 'Attendance per live session',
    grain: 'User + Session',
    refreshCadence: 'Every 12 hours',
    accessLevel: 'all',
    columns: [{ name: 'learning_time', type: 'decimal', description: 'minutes with teacher' }],
    exampleQueries: [],
  },
];

describe('filterTables', () => {
  it('matches on table name, description, and column names', () => {
    expect(filterTables(TABLES, 'd_course').map((t) => t.key)).toEqual(['d_course']);
    expect(filterTables(TABLES, 'learning_time').map((t) => t.key)).toEqual(['f_user_session']);
    expect(filterTables(TABLES, 'attendance').map((t) => t.key)).toEqual(['f_user_session']);
    expect(filterTables(TABLES, '')).toHaveLength(2);
    expect(filterTables(TABLES, 'nomatch')).toHaveLength(0);
  });
});

describe('<TablesTab />', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => TABLES })),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the registry list and narrows it as you type', async () => {
    render(<TablesTab />);

    // Both tables show once the fetch resolves.
    expect(await screen.findByText('f_user_session')).toBeTruthy();
    expect(screen.getByText('d_course')).toBeTruthy();

    // Typing a query filters the list down to matches.
    fireEvent.change(screen.getByLabelText('Search tables'), { target: { value: 'attendance' } });

    expect(screen.queryByText('d_course')).toBeNull();
    expect(screen.getByText('f_user_session')).toBeTruthy();
  });
});
