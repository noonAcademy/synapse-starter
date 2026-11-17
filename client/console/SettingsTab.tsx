import type { ReactNode } from 'react';
import { Card, Pill, SectionHeading } from '../ui';
import { type LoadState, useJson } from '../useJson';

// Mirrors server/overview.ts OverviewProjection (served by /__synapse/overview).
interface Overview {
  appId: string | null;
  baseUrl: string;
  configured: boolean;
  configError: string | null;
  connection: { ok: boolean; detail: string };
}

// Mirrors the slice of server/setup.ts SetupProjection this tab needs (served by
// /__synapse/setup). Presence only — the server never sends values. Optional fields so an older
// server's payload renders as "unknown" rather than breaking the tab.
interface Setup {
  secrets?: Array<{ name: string; set: boolean; required: boolean; scope?: 'run' | 'deploy' }>;
  deploy?: { ready: boolean; missing: string[] };
}

// How your app connects to Noon — the connection details that used to be a disclosure on Home, now
// a first-class section. Read-only: the secrets themselves live in Replit's Secrets pane.
export function SettingsTab() {
  const overview = useJson<Overview>('/__synapse/overview');
  const setup = useJson<Setup>('/__synapse/setup');

  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <SectionHeading title="Settings">How your app connects to Noon.</SectionHeading>
        <ConnectionSettings overview={overview} />
      </div>
      <div className="space-y-4">
        <SectionHeading title="Deployment sign-in">
          How people sign in to the app you publish. Not used in this workspace.
        </SectionHeading>
        <DeploymentSettings setup={setup} overview={overview} />
      </div>
    </section>
  );
}

// The permanent home for the deploy-only half of the config. Home's notice disappears once this
// is ready; this section stays, so "is sign-in set up?" always has an answer. Presence only —
// a value that reached the server never comes back out of it.
function DeploymentSettings({
  setup,
  overview,
}: {
  setup: LoadState<Setup>;
  overview: LoadState<Overview>;
}) {
  if (setup.status === 'loading') {
    return <p className="text-sm text-slate-500">Loading your deployment config…</p>;
  }
  if (setup.status === 'error') {
    return (
      <p className="text-sm text-rose-600">Couldn't load your deployment config: {setup.message}</p>
    );
  }

  const deploy = setup.data.deploy;
  const secrets = (setup.data.secrets ?? []).filter((s) => s.scope === 'deploy');
  // The gate also needs the SYNAPSE_* pair (it signs the OAuth calls with them), so deploy.missing
  // can name a secret this section doesn't list. Without this, an app whose only gap is an empty
  // SYNAPSE_APP_SECRET shows "Needed before you deploy" above two "set" pills and names nothing.
  const deployNames = new Set(secrets.map((s) => s.name));
  const missingShared = (deploy?.missing ?? []).filter((n) => !deployNames.has(n));
  const portalBase =
    overview.status === 'ready' ? overview.data.baseUrl : 'https://citadel.staging.noonedu.io';

  // An older server sends neither field — say so rather than implying sign-in is unconfigured.
  if (!deploy && secrets.length === 0) {
    return (
      <Card>
        <Pill tone="neutral">Unknown</Pill>
        <p className="mt-2 text-sm text-slate-600">
          This app's server doesn't report deployment config yet. Upgrade the kit, or check{' '}
          <code className="font-mono text-xs">APP_OAUTH_REDIRECT_URI</code> and{' '}
          <code className="font-mono text-xs">APP_SESSION_SECRET</code> in Replit's{' '}
          <strong>Secrets</strong> pane by hand.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        {deploy?.ready ? (
          <Pill tone="good">Sign in with Noon is configured</Pill>
        ) : (
          <Pill tone="warn">Needed before you deploy</Pill>
        )}
        <p className="mt-2 text-sm text-slate-600">
          {deploy?.ready ? (
            <>
              A deployment will put your app behind Noon's own login, for Noon staff only. This
              workspace stays open either way — the login gate is never mounted here. This reads the{' '}
              <strong>workspace</strong> environment; a deployment carries its own copy of the
              secrets, so confirm they're set there too before you publish.
            </>
          ) : (
            <>
              A deployment <strong>fails closed</strong> while these are unset: every request gets a
              503 instead of your app. Add them in Replit's <strong>Secrets</strong> pane, then
              register the same callback URL in the Citadel portal (
              <code className="font-mono text-xs">{portalBase}/portal/replit-apps</code> → your app
              → redirect URI).
            </>
          )}
        </p>
      </Card>

      {missingShared.length > 0 && (
        <p className="text-sm text-slate-600">
          Sign-in also needs {missingShared.join(' and ')}, which the login flow signs its Citadel
          calls with — see the connection details above, and Home's first check.
        </p>
      )}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {secrets.map((s) => (
          <Field key={s.name} label={s.name}>
            {s.set ? <Pill tone="good">set</Pill> : <Pill tone="warn">not set</Pill>}
          </Field>
        ))}
      </dl>
    </div>
  );
}

function ConnectionSettings({ overview }: { overview: LoadState<Overview> }) {
  if (overview.status === 'loading') {
    return <p className="text-sm text-slate-500">Loading your connection…</p>;
  }
  if (overview.status === 'error') {
    return <p className="text-sm text-rose-600">Couldn't load your settings: {overview.message}</p>;
  }

  const o = overview.data;
  return (
    <div className="space-y-4">
      <Card>
        {o.connection.ok ? (
          <Pill tone="good">Connected to Noon</Pill>
        ) : (
          <Pill tone="warn">Setup needed</Pill>
        )}
        <p className="mt-2 text-sm text-slate-600">
          {o.connection.ok ? (
            o.connection.detail
          ) : o.configured ? (
            o.connection.detail
          ) : (
            <>
              Add your Noon keys in Replit's <strong>Secrets</strong> (
              <code className="font-mono text-xs">SYNAPSE_APP_ID</code> and{' '}
              <code className="font-mono text-xs">SYNAPSE_APP_SECRET</code>), then press{' '}
              <strong>Run</strong> again.
            </>
          )}
        </p>
        {o.configError && <p className="mt-1 text-sm text-slate-500">{o.configError}</p>}
      </Card>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="App ID">
          {o.appId ? (
            <span className="font-mono text-xs">{o.appId}</span>
          ) : (
            <span className="text-slate-400">not set</span>
          )}
        </Field>
        <Field label="Citadel base URL">
          <span className="break-all font-mono text-xs">{o.baseUrl}</span>
        </Field>
      </dl>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}
