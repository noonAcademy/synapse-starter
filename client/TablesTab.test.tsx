// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAgentPrompt, filterTables, type TableProjection, TablesTab } from './TablesTab';

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
    exampleQueries: ['SELECT user_id FROM noon2_datamart.f_user_session'],
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

describe('buildAgentPrompt', () => {
  it('scopes the prompt to the table and hands off to the agent per AGENTS.md', () => {
    const prompt = buildAgentPrompt('f_user_session', 'students who attended last week');
    expect(prompt).toContain('`f_user_session`');
    expect(prompt).toContain('students who attended last week');
    expect(prompt).toContain('AGENTS.md');
    expect(prompt).toContain('server/queries');
    expect(prompt).toContain('synapse.athenaQuery');
  });

  it('falls back to a placeholder when no text is given', () => {
    expect(buildAgentPrompt('d_course', '   ')).toContain('describe what you want');
  });
});

describe('<TablesTab />', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => TABLES,
      })),
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

  it('offers a "Use this in my app" handoff that builds a copy-paste agent prompt', async () => {
    render(<TablesTab />);

    // Select the table that ships an example query, then open the handoff panel.
    fireEvent.click(await screen.findByText('f_user_session'));
    fireEvent.click(screen.getByRole('button', { name: /use this in my app/i }));

    // The textarea is pre-filled with the table's vetted example query as a starting point.
    const textarea = screen.getByLabelText(/what do you want from this table/i);
    expect((textarea as HTMLTextAreaElement).value).toContain(
      'SELECT user_id FROM noon2_datamart.f_user_session',
    );

    // It's a guide-to-agent handoff, not an in-app query runner. The prompt block is the only
    // place "Follow AGENTS.md" appears, so it uniquely identifies the generated prompt.
    expect(screen.getByText(/paste this to the replit agent/i)).toBeTruthy();
    const prompt = screen.getByText(/Follow AGENTS\.md/i);
    expect(prompt.textContent).toContain('`f_user_session`');

    // Typing what you want flows straight into the generated prompt.
    fireEvent.change(textarea, { target: { value: 'top 10 students by learning time' } });
    expect(screen.getByText(/Follow AGENTS\.md/i).textContent).toContain(
      'top 10 students by learning time',
    );
  });
});
