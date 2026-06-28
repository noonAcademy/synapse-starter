import { useJson } from './useJson';

// Mirrors server/overview.ts OverviewProjection (served by /__synapse/overview).
interface Overview {
  appId: string | null;
  baseUrl: string;
  configured: boolean;
  configError: string | null;
  connection: {
    ok: boolean;
    detail: string;
  };
}

const TRY_NEXT = [
  <>
    Open the <strong>Tables</strong> tab to browse the bundled data registry.
  </>,
  <>
    Open the <strong>Read</strong> tab to run the example read against staging.
  </>,
  <>
    Add your own read: describe the data you want and let <code className="font-mono">/skill</code>{' '}
    bake the SELECT into <code className="font-mono">server/queries/</code> (see{' '}
    <code className="font-mono">AGENTS.md</code>).
  </>,
  <>
    Publish an event with <code className="font-mono">synapse.publishEvent</code> — outcomes show in
    the <strong>Events</strong> tab.
  </>,
];

export function OverviewTab() {
  const state = useJson<Overview>('/__synapse/overview');

  if (state.status === 'loading') {
    return <p className="text-sm text-slate-500">Checking connection…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-red-600">Couldn't load overview: {state.message}</p>;
  }

  const o = state.data;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Overview</h2>
        <p className="text-sm text-slate-500">This app's Synapse identity and connection status.</p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="App ID">
          {o.appId ? <span className="font-mono">{o.appId}</span> : <Muted>not set</Muted>}
        </Field>
        <Field label="Citadel base URL">
          <span className="font-mono break-all">{o.baseUrl}</span>
        </Field>
      </dl>

      <div className="rounded-md border border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${o.connection.ok ? 'bg-green-500' : 'bg-red-500'}`}
            aria-hidden
          />
          <span className="text-sm font-medium">
            {o.connection.ok ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{o.connection.detail}</p>
        {o.configError && <p className="mt-1 text-sm text-red-600">{o.configError}</p>}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Try this next
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          {TRY_NEXT.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static list, never reordered
            <li key={i} className="flex gap-2">
              <span className="text-slate-300">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-slate-400">{children}</span>;
}
