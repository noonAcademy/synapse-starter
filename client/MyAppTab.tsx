import type { PublishLogEntry } from '@noonacademy/synapse-sdk';
import { useState } from 'react';
import type { TabId } from './App';
import { Button, Disclosure, EmptyState, Pill, SectionHeading } from './ui';
import { useJson } from './useJson';

interface ReadListItem {
  name: string;
  title: string;
  description: string;
}
// Mirrors server/reads.ts ReadResult (served by /__synapse/reads/:name).
interface ReadResult {
  name: string;
  title: string;
  description: string;
  sql: string;
  registryVersion: string;
  skillVersion: string;
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  dataAsOf: string | null;
  cached: boolean;
  configured: boolean;
  error: string | null;
}
interface CatalogGroup {
  namespace: string;
  eventTypes: string[];
}
interface EventCatalog {
  total: number;
  groups: CatalogGroup[];
}

export function MyAppTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  return (
    <section className="space-y-10">
      <YourViews onNavigate={onNavigate} />
      <Activity />
      <Disclosure summary="Events your app can send">
        <div className="mt-1">
          <CatalogSection />
        </div>
      </Disclosure>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Your views — every baked read, listed from /__synapse/reads (closes the loop:
// a read the agent adds at build time shows up here automatically).
// ---------------------------------------------------------------------------

function YourViews({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const list = useJson<ReadListItem[]>('/__synapse/reads');
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <SectionHeading title="Your views">
        Pages in your app that show live Noon data.
      </SectionHeading>

      {list.status === 'loading' && <p className="text-sm text-slate-500">Loading your views…</p>}
      {list.status === 'error' && (
        <p className="text-sm text-rose-600">Couldn't load your views: {list.message}</p>
      )}

      {list.status === 'ready' &&
        (list.data.length === 0 ? (
          <EmptyState>
            <p>No views yet.</p>
            <div className="mt-3">
              <Button onClick={() => onNavigate('get-data')}>Make your first one →</Button>
            </div>
          </EmptyState>
        ) : (
          <ViewsBrowser
            views={list.data}
            selected={selected ?? list.data[0]?.name ?? null}
            onSelect={setSelected}
          />
        ))}
    </div>
  );
}

function ViewsBrowser({
  views,
  selected,
  onSelect,
}: {
  views: ReadListItem[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  // One view: skip the list and just render it. Several: master/detail.
  if (views.length === 1 && views[0]) {
    return <ViewDetail name={views[0].name} />;
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
      <ul className="min-w-0 rounded-lg border border-slate-200">
        {views.map((v) => (
          <li key={v.name}>
            <button
              type="button"
              onClick={() => onSelect(v.name)}
              className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 ${
                selected === v.name
                  ? 'bg-slate-100 font-medium text-slate-900'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="block truncate">{v.title}</span>
              <span className="block truncate text-xs text-slate-400">{v.description}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected && <ViewDetail key={selected} name={selected} />}
    </div>
  );
}

function ViewDetail({ name }: { name: string }) {
  const state = useJson<ReadResult>(`/__synapse/reads/${name}`);

  if (state.status === 'loading') {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-rose-600">Couldn't load this view: {state.message}</p>;
  }

  const read = state.data;
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{read.title}</h3>
      <p className="text-sm text-slate-500">{read.description}</p>
      <Freshness read={read} />

      <div className="mt-4">
        {!read.configured ? (
          <EmptyState>
            Not connected yet — add your Noon keys (
            <code className="font-mono text-xs">SYNAPSE_APP_ID</code> and{' '}
            <code className="font-mono text-xs">SYNAPSE_APP_SECRET</code>) in Replit's Secrets, then
            press Run to load the data.
          </EmptyState>
        ) : read.error ? (
          <p className="text-sm text-rose-600">Couldn't fetch the data: {read.error}</p>
        ) : read.rows.length === 0 || read.columns.length === 0 ? (
          <EmptyState>This view came back empty — no rows to show right now.</EmptyState>
        ) : (
          <>
            {read.truncated && (
              <p className="mb-2 text-xs text-amber-700">
                Showing the first {read.rows.length.toLocaleString()} rows (there were more).
              </p>
            )}
            <RowsTable columns={read.columns} rows={read.rows} />
          </>
        )}
      </div>

      <div className="mt-4">
        <Disclosure summary="See the query behind this">
          <pre className="min-w-0 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {read.sql}
          </pre>
          <p className="mt-1 text-xs text-slate-400">
            registry {read.registryVersion} · skill {read.skillVersion} ·{' '}
            <code className="font-mono">server/queries/{read.name}.sql.ts</code>
          </p>
        </Disclosure>
      </div>
    </div>
  );
}

function Freshness({ read }: { read: ReadResult }) {
  if (!read.configured || read.dataAsOf === null) {
    return null;
  }
  return (
    <p className="mt-1 text-xs text-slate-400">
      Updated {relativeTime(read.dataAsOf)} · Noon refreshes this about twice a day.
    </p>
  );
}

function RowsTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            // Lake rows have no stable id; index is acceptable for a static rendered table.
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are read-only and never reordered
            <tr key={i} className="border-t border-slate-200">
              {columns.map((col) => (
                <td key={col} className="break-words px-3 py-2 tabular-nums text-slate-700">
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity — what your app has sent to Noon, in plain words.
// ---------------------------------------------------------------------------

function Activity() {
  const state = useJson<PublishLogEntry[]>('/__synapse/events');

  return (
    <div className="space-y-4">
      <SectionHeading title="What your app has sent">
        Events are things your app tells Noon about — like a student joining a course. This is what
        it has sent since it last started.
      </SectionHeading>

      {state.status === 'loading' && <p className="text-sm text-slate-500">Loading…</p>}
      {state.status === 'error' && (
        <p className="text-sm text-rose-600">Couldn't load this: {state.message}</p>
      )}
      {state.status === 'ready' &&
        (state.data.length === 0 ? (
          <EmptyState>Nothing sent yet. Events show up here once they go through.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
            {state.data.map((event) => (
              <li
                key={`${event.at}-${event.type}-${event.status}-${event.eventId ?? event.error ?? ''}`}
                className="px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {event.type}
                  </span>
                  <EventStatus status={event.status} />
                  <span className="ml-auto text-xs text-slate-400">{relativeTime(event.at)}</span>
                </div>
                <EventDetailLine event={event} />
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function EventStatus({ status }: { status: PublishLogEntry['status'] }) {
  if (status === 'accepted') {
    return <Pill tone="good">Delivered</Pill>;
  }
  if (status === 'failed_permanent') {
    return <Pill tone="error">Couldn't deliver</Pill>;
  }
  return <Pill tone="warn">Didn't go through</Pill>;
}

function EventDetailLine({ event }: { event: PublishLogEntry }) {
  const parts: string[] = [];
  if (event.status === 'accepted' && event.eventId != null) {
    parts.push(`Noon ID #${event.eventId}`);
  }
  if (event.error) {
    parts.push(event.error);
  }
  if (event.attempts > 1) {
    parts.push(`${event.attempts} attempts`);
  }
  if (parts.length === 0) {
    return null;
  }
  return <p className="mt-1 break-words text-xs text-slate-400">{parts.join(' · ')}</p>;
}

// ---------------------------------------------------------------------------
// Events your app can send (the catalog) — reference, behind a disclosure.
// ---------------------------------------------------------------------------

function CatalogSection() {
  const state = useJson<EventCatalog>('/__synapse/catalog');

  if (state.status === 'loading') {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-rose-600">Couldn't load the catalog: {state.message}</p>;
  }

  const catalog = state.data;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        These are the kinds of thing your app can tell Noon about.{' '}
        <strong className="font-medium text-slate-700">
          Need a new one? Just ask the Replit agent to build the feature that needs it
        </strong>{' '}
        — it defines and sends the event for you. Nothing to set up here. What your app has actually
        sent shows under{' '}
        <strong className="font-medium text-slate-700">“What your app has sent”</strong> above.
      </p>

      {catalog.groups.map((group) => (
        <div key={group.namespace}>
          <h4 className="text-sm font-medium text-slate-700">
            {group.namespace} <span className="text-slate-400">({group.eventTypes.length})</span>
          </h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {group.eventTypes.map((type) => (
              <span
                key={type}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-400">
        For developers: send one with{' '}
        <code className="font-mono">synapse.publishEvent(type, payload)</code>.
      </p>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return iso;
  }
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) {
    return 'just now';
  }
  const mins = Math.round(secs / 60);
  if (mins < 60) {
    return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  }
  const hrs = Math.round(mins / 60);
  if (hrs < 24) {
    return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  }
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
