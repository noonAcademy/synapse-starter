import type { TabId } from './App';
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

// The "Here's what you can do" cards. Each one jumps to another tab, described in plain
// English — no jargon, so a first-time builder knows what each section is for.
const WHAT_YOU_CAN_DO: { tab: TabId; title: string; blurb: string }[] = [
  {
    tab: 'tables',
    title: 'Browse Noon data',
    blurb: 'See the Noon data you can pull into your app — students, sessions, courses and more.',
  },
  {
    tab: 'read',
    title: 'See live data in a page',
    blurb: 'A read is a page that pulls live Noon data. Open the example — or ask for your own.',
  },
  {
    tab: 'events',
    title: 'See what your app told Noon',
    blurb: 'Events are things your app reports back to Noon. Check what has been sent so far.',
  },
  {
    tab: 'catalog',
    title: 'See which events you can send',
    blurb: 'The list of event types your app is allowed to send to Noon.',
  },
];

export function OverviewTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const state = useJson<Overview>('/__synapse/overview');

  if (state.status === 'loading') {
    return <p className="text-sm text-slate-500">Checking your connection to Noon…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-red-600">Couldn't load this page: {state.message}</p>;
  }

  const o = state.data;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Welcome 👋</h2>
        <p className="text-sm text-slate-600">
          This is your app's window into Noon. It does two things: it pulls{' '}
          <strong>live Noon data</strong> into your pages, and it tells Noon when{' '}
          <strong>things happen</strong> in your app.
        </p>
      </div>

      <ConnectionCard o={o} />

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Here's what you can do</h3>
        <p className="text-sm text-slate-500">Tap a card to jump in.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {WHAT_YOU_CAN_DO.map((item) => (
            <button
              key={item.tab}
              type="button"
              onClick={() => onNavigate(item.tab)}
              className="rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">{item.title}</span>
                <span aria-hidden className="text-slate-300">
                  →
                </span>
              </span>
              <span className="mt-1 block text-sm text-slate-500">{item.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <ConnectionDetails o={o} />
    </section>
  );
}

function ConnectionCard({ o }: { o: Overview }) {
  if (o.connection.ok) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-semibold text-green-800">✓ Connected to Noon</p>
        <p className="mt-1 text-sm text-green-700">{o.connection.detail}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">Not connected yet</p>
      <p className="mt-1 text-sm text-amber-800">
        {o.configured ? (
          o.connection.detail
        ) : (
          <>
            Add your Noon keys in Replit's <strong>Secrets</strong> (
            <code className="font-mono">SYNAPSE_APP_ID</code> and{' '}
            <code className="font-mono">SYNAPSE_APP_SECRET</code>), then press <strong>Run</strong>{' '}
            again.
          </>
        )}
      </p>
      {o.configError && <p className="mt-1 text-sm text-amber-800">{o.configError}</p>}
    </div>
  );
}

// The raw identity values, tucked away — useful for debugging, but not what a first-time
// builder needs front-and-centre.
function ConnectionDetails({ o }: { o: Overview }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Connection details
      </summary>
      <dl className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2">
        <Field label="App ID">
          {o.appId ? <span className="font-mono">{o.appId}</span> : <Muted>not set</Muted>}
        </Field>
        <Field label="Citadel base URL">
          <span className="font-mono break-all">{o.baseUrl}</span>
        </Field>
      </dl>
    </details>
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
