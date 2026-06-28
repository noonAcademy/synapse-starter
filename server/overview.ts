// App identity + a live-ish connection signal for the Overview tab. The SDK exposes no
// dedicated ping, so the most honest connectivity proof we have without extra traffic is the
// outcome of the boot publish round-trip — if Citadel accepted an event, secrets reached the
// server, the request was HMAC-signed, and staging was reachable.

import type { PublishLogEntry } from '@noonacademy/synapse-sdk';

export interface OverviewProjection {
  appId: string | null;
  baseUrl: string;
  configured: boolean;
  configError: string | null;
  connection: {
    ok: boolean;
    detail: string;
  };
}

export function buildOverview(input: {
  appId: string | null;
  baseUrl: string;
  configError: string | null;
  recentPublishes: PublishLogEntry[];
}): OverviewProjection {
  const { appId, baseUrl, configError, recentPublishes } = input;
  const configured = configError === null;

  let connection: OverviewProjection['connection'];
  if (!configured) {
    connection = {
      ok: false,
      detail: 'Secrets missing — add them in the Secrets pane, then re-run.',
    };
  } else {
    const accepted = recentPublishes.find((e) => e.status === 'accepted');
    if (accepted) {
      connection = {
        ok: true,
        detail: `Last publish accepted (eventId=${accepted.eventId}) — staging Citadel is reachable.`,
      };
    } else {
      const settled = recentPublishes[0];
      connection = settled
        ? {
            ok: false,
            detail: `Last publish ${settled.status}${settled.error ? `: ${settled.error}` : ''}.`,
          }
        : {
            ok: false,
            detail: 'No publishes have settled yet — the boot event may still be in flight.',
          };
    }
  }

  return { appId, baseUrl, configured, configError, connection };
}
