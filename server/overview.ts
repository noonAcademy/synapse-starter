// App identity + a live-ish connection signal for the console's Home/Settings tabs. The SDK exposes no
// dedicated ping, so the most honest connectivity proof we have without extra traffic is the
// outcome of the boot publish round-trip — if Citadel accepted an event, secrets reached the
// server, the request was HMAC-signed, and the configured Citadel was reachable.
//
// "The configured Citadel", never "staging": SYNAPSE_BASE_URL can point this app at production,
// and this string is the one place in the console whose whole job is to say what you're connected
// to. A clone showing live production numbers under a panel that reads "staging" invites someone
// to treat real data as a sandbox — so the detail names the host it actually reached.

import type { PublishLogEntry } from '@noonacademy/synapse-sdk';

export interface OverviewProjection {
  appId: string | null;
  baseUrl: string;
  configured: boolean;
  configError: string | null;
  connection: {
    ok: boolean;
    detail: string;
    /**
     * Why it failed, when the failure says something Run can't fix. Absent when connected, when
     * nothing has settled yet, and for transient failures (a retry may well succeed).
     *   'credentials' — Citadel answered 401: it does not accept this app id + secret.
     *   'rejected'    — any other permanent failure (400/403/422): a re-run sends the same thing.
     */
    reason?: 'credentials' | 'rejected';
  };
}

// The SDK records a permanent failure as `publishEvent failed: <status>` and exposes no separate
// status field, so the status is read back out of the message. A 401 is singled out because it
// is the one a builder can fix alone — and the one "press Run again" can never fix: the SDK does
// not retry a 401, and a re-run signs with the same keys.
function failureReason(entry: PublishLogEntry): OverviewProjection['connection']['reason'] {
  if (entry.status !== 'failed_permanent') return undefined;
  return /\b401\b/.test(entry.error ?? '') ? 'credentials' : 'rejected';
}

// The host alone, so the status line stays short and reads as a place. Falls back to the raw
// value when it isn't a parseable URL — a baseUrl that looks wrong is still more useful than a
// guess, and this projection must never throw on bad config.
function citadelName(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
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
        detail: `Last publish accepted (eventId=${accepted.eventId}) — ${citadelName(baseUrl)} is reachable.`,
      };
    } else {
      const settled = recentPublishes[0];
      const reason = settled ? failureReason(settled) : undefined;
      connection = settled
        ? reason === 'credentials'
          ? {
              ok: false,
              // Name the host: the commonest cause is keys made on one Citadel (staging vs
              // production) while SYNAPSE_BASE_URL points at the other.
              detail: `${citadelName(baseUrl)} didn't accept this app's keys (${settled.error}).`,
              reason,
            }
          : {
              ok: false,
              detail: `Last publish ${settled.status}${settled.error ? `: ${settled.error}` : ''}.`,
              ...(reason ? { reason } : {}),
            }
        : {
            ok: false,
            detail: 'No publishes have settled yet — the boot event may still be in flight.',
          };
    }
  }

  return { appId, baseUrl, configured, configError, connection };
}
