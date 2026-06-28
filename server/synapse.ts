import { createSynapseClient, type SynapseClient } from '@noonacademy/synapse-sdk';

const DEFAULT_STAGING_BASE_URL = 'https://citadel.staging.noonedu.io';

const baseUrl = process.env.SYNAPSE_BASE_URL ?? DEFAULT_STAGING_BASE_URL;
const appId = process.env.SYNAPSE_APP_ID;
const appSecret = process.env.SYNAPSE_APP_SECRET;

const missing = [
  ['SYNAPSE_APP_ID', appId],
  ['SYNAPSE_APP_SECRET', appSecret],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

// Surfaced (not thrown) so the server still boots and the page still renders when
// secrets are absent — that decouples "did the page render?" from "did secrets
// reach the server?", which is exactly the failure we want slice 1 to localise.
export const synapseConfigError =
  missing.length > 0
    ? `Missing required Replit Secret(s): ${missing.join(', ')}. Add them in the Secrets pane (or .env locally), then re-run.`
    : null;

export const synapse: SynapseClient | null =
  appId && appSecret ? createSynapseClient({ baseUrl, appId, appSecret }) : null;

// App identity for the Overview tab. appId is an identifier, not a secret, so it's safe to
// surface; appSecret is never exported. baseUrl is config (which Citadel we point at).
export const synapseAppId: string | null = appId ?? null;
export const synapseBaseUrl: string = baseUrl;
