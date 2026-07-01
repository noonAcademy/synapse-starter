// THROWAWAY — sample data for the compose-in-console prototypes only. These mocks let the concepts
// show a composed page with data even without Noon secrets. Delete this folder once a direction is
// chosen (see PrototypeGallery.tsx).

export const SAMPLE_VIEWS = [
  { name: 'courses-by-type', title: 'Active courses by type' },
  { name: 'students-live', title: 'Students in live sessions (7d)' },
  { name: 'session-temp', title: 'Session temperature (7d)' },
  { name: 'big-sessions', title: 'Big live sessions — 200+ students' },
];

export const SAMPLE_COLUMNS = ['course_type', 'course_count'];

export const SAMPLE_ROWS: Record<string, unknown>[] = [
  { course_type: 'MARKETPLACE', course_count: 1284 },
  { course_type: 'O2O', course_count: 942 },
  { course_type: 'SCHOOL', course_count: 517 },
];

export const SAMPLE_EVENTS = [
  'task.created',
  'task.assigned',
  'task.reassigned',
  'sanad_ticket.created',
];
