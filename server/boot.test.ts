import { describe, expect, it } from 'vitest';
import { formatBootLog } from './boot.js';

describe('formatBootLog', () => {
  it('reports the eventId when Citadel accepted the event', () => {
    expect(formatBootLog({ status: 'accepted', eventId: 42 }, 'starter-boot-abcd1234')).toBe(
      '[synapse] OK — accepted eventId=42 runId=starter-boot-abcd1234',
    );
  });

  it('reports a queued fallback when Citadel was unreachable on the first try', () => {
    expect(formatBootLog({ status: 'queued' }, 'starter-boot-abcd1234')).toBe(
      "[synapse] queued (couldn't reach Citadel on first try) runId=starter-boot-abcd1234",
    );
  });
});
