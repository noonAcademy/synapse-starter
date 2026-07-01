import type { ReactNode } from 'react';
import { Card, Pill } from '../ui';
import { type LoadState, useJson } from '../useJson';
import type { TabId } from './ConsoleApp';

// Mirrors server/overview.ts OverviewProjection (served by /__synapse/overview).
interface Overview {
  appId: string | null;
  baseUrl: string;
  configured: boolean;
  configError: string | null;
  connection: { ok: boolean; detail: string };
}
interface ReadListItem {
  name: string;
  title: string;
  description: string;
}
interface EventCatalog {
  total: number;
}

export function HomeTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const overview = useJson<Overview>('/__synapse/overview');
  const reads = useJson<ReadListItem[]>('/__synapse/reads');
  const catalog = useJson<EventCatalog>('/__synapse/catalog');

  const readCount = reads.status === 'ready' ? reads.data.length : null;
  const firstView = reads.status === 'ready' ? reads.data[0]?.title : undefined;
  const eventKinds = catalog.status === 'ready' ? catalog.data.total : null;

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          What do you want to build?
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          This app pulls live Noon data into your pages, and tells Noon when things happen in your
          app. Describe the data you want — no SQL, no table names.
        </p>
      </div>

      <ConnectionStatus overview={overview} />

      {/* The one primary action — the buried "get data" flow, promoted to the hero slot. */}
      <button
        type="button"
        onClick={() => onNavigate('get-data')}
        className="block w-full rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-indigo-900">Get Noon data into my app</span>
          <span aria-hidden className="text-indigo-400">
            →
          </span>
        </span>
        <span className="mt-1 block text-sm text-indigo-800">
          Describe it in plain English. We turn it into a one-paste instruction for the Replit
          agent, which builds the page for you.
        </span>
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        <SecondaryCard
          onClick={() => onNavigate('views')}
          title={readCount === null ? 'Your views' : `Your views (${readCount})`}
        >
          {readCount === null
            ? 'See the live data pages in your app.'
            : readCount === 0
              ? 'No views yet — make your first one above.'
              : `${readCount} live view${readCount > 1 ? 's' : ''}${firstView ? `, including “${firstView}”` : ''}.`}
        </SecondaryCard>

        <SecondaryCard onClick={() => onNavigate('events')} title="What your app sends to Noon">
          {eventKinds === null
            ? 'The events your app can report, and the log of what it has sent.'
            : `${eventKinds} kinds of event your app can report — and the log of what it has sent.`}
        </SecondaryCard>
      </div>
    </section>
  );
}

function ConnectionStatus({ overview }: { overview: LoadState<Overview> }) {
  if (overview.status === 'loading') {
    return <p className="text-sm text-slate-500">Checking your connection to Noon…</p>;
  }
  if (overview.status === 'error') {
    return (
      <Card className="border-slate-200">
        <Pill tone="warn">Couldn't check</Pill>
        <p className="mt-2 text-sm text-slate-600">
          We couldn't reach the console: {overview.message}
        </p>
      </Card>
    );
  }

  const o = overview.data;
  if (o.connection.ok) {
    return (
      <Card>
        <Pill tone="good">Connected to Noon</Pill>
        <p className="mt-2 text-sm text-slate-600">{o.connection.detail}</p>
      </Card>
    );
  }
  return (
    <Card>
      <Pill tone="warn">Setup needed</Pill>
      <p className="mt-2 text-sm text-slate-600">
        {o.configured ? (
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
  );
}

function SecondaryCard({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <span aria-hidden className="text-slate-300 group-hover:text-indigo-500">
          →
        </span>
      </span>
      <span className="mt-1 block text-sm text-slate-500">{children}</span>
    </button>
  );
}
