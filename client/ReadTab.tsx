import { useState } from 'react';
import { useJson } from './useJson';

// Mirrors server/reads.ts ReadResult (the JSON shape served by /__synapse/reads/:name).
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

// The one example read this template ships. Add your own in server/queries/ and point a
// new tab at /__synapse/reads/<name>.
const READ_NAME = 'courses-by-type';

// A ready-to-paste request for the Replit agent — the agent writes the SQL, the builder
// doesn't need to. Mirrors the "To add a read" flow in AGENTS.md.
const NEW_READ_PROMPT =
  'Build me a page showing <the data you want> from Citadel. Follow AGENTS.md: bake it as a ' +
  'read in server/queries and run it through synapse.athenaQuery — then it shows up on the Read tab.';

export function ReadTab() {
  const state = useJson<ReadResult>(`/__synapse/reads/${READ_NAME}`);

  if (state.status === 'loading') {
    return <p className="text-sm text-slate-500">Loading your data…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-red-600">Couldn't load this page: {state.message}</p>;
  }

  const read = state.data;

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Reads — live Noon data in a page</h2>
        <p className="text-sm text-slate-500">
          A read is a page that pulls live Noon data and shows it here. This is the one that comes
          with the starter — and below, here's how to ask for your own.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">{read.title}</h3>
        <p className="text-sm text-slate-500">{read.description}</p>
        <FreshnessNote read={read} />

        <div className="mt-4">
          {!read.configured ? (
            <EmptyState>
              Not connected yet — add your Noon keys (
              <code className="font-mono">SYNAPSE_APP_ID</code> and{' '}
              <code className="font-mono">SYNAPSE_APP_SECRET</code>) in Replit's Secrets, then press
              Run to fetch the data.
            </EmptyState>
          ) : read.error ? (
            <p className="text-sm text-red-600">Couldn't fetch the data: {read.error}</p>
          ) : read.rows.length === 0 || read.columns.length === 0 ? (
            <EmptyState>This read came back empty — no rows to show right now.</EmptyState>
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

        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-500">
            See the query behind this (SQL)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {read.sql}
          </pre>
          <p className="mt-1 text-xs text-slate-400">
            registry {read.registryVersion} · skill {read.skillVersion} ·{' '}
            <code className="font-mono">server/queries/{read.name}.sql.ts</code>
          </p>
        </details>
      </div>

      <AskForReadCallout />
    </section>
  );
}

// Turns "here are the reads" into "here are your reads, and here's how to get more" — the
// bridge to action. The app can't write a query at runtime; the Replit agent does it for you.
function AskForReadCallout() {
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
      <h3 className="text-sm font-semibold text-indigo-900">
        Want a different view? Ask the Replit agent.
      </h3>
      <p className="mt-1 text-sm text-indigo-800">
        The agent writes the query for you — you don't need to know SQL. Describe the data you want,
        paste this into the Replit agent chat, and it'll add a new read here.
      </p>
      <div className="mt-2">
        <CopyBox text={NEW_READ_PROMPT} />
      </div>
      <p className="mt-2 text-xs text-indigo-700">
        Tip: swap “&lt;the data you want&gt;” for something like “daily active students over the
        last 30 days”.
      </p>
    </div>
  );
}

function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="relative rounded-md border border-indigo-200 bg-white">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded bg-white px-2 py-0.5 text-xs text-slate-500 shadow-sm hover:text-slate-800"
      >
        {copied ? 'copied' : 'copy'}
      </button>
      <pre className="overflow-x-auto whitespace-pre-wrap px-3 py-2 pr-16 text-xs text-slate-700">
        {text}
      </pre>
    </div>
  );
}

function FreshnessNote({ read }: { read: ReadResult }) {
  if (!read.configured || read.dataAsOf === null) {
    return null;
  }
  return (
    <p className="mt-1 text-xs text-slate-400">
      Data as of {formatTimestamp(read.dataAsOf)}; Noon's data refreshes about every 12h.{' '}
      {read.cached ? '(served from cache)' : '(freshly fetched)'}
    </p>
  );
}

function RowsTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
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
                <td key={col} className="px-3 py-2 tabular-nums text-slate-700">
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

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
      {children}
    </p>
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

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
