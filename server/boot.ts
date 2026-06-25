import type { PublishEventResult } from '@noonacademy/synapse-sdk';

export function formatBootLog(result: PublishEventResult, runId: string): string {
  return result.status === 'accepted'
    ? `[synapse] OK — accepted eventId=${result.eventId} runId=${runId}`
    : `[synapse] queued (couldn't reach Citadel on first try) runId=${runId}`;
}
