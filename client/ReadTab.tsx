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

export function ReadTab() {
  const state = useJson<ReadResult>(`/__synapse/reads/${READ_NAME}`);

  if (state.status === 'loading') {
    return <p className="text-sm text-slate-500">Running read…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-red-600">Couldn't run the read: {state.message}</p>;
  }

  const read = state.data;

  return (
    <section>
      <h2 className="text-base font-semibold">{read.title}</h2>
      <p className="mb-3 text-sm text-slate-500">{read.description}</p>

      <FreshnessNote read={read} />

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Baked SQL (Trino/Presto)
      </h3>
      <pre className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        {read.sql}
      </pre>
      <p className="mt-1 text-xs text-slate-400">
        registry {read.registryVersion} · skill {read.skillVersion} ·{' '}
        <code className="font-mono">server/queries/{read.name}.sql.ts</code>
      </p>

      <div className="mt-4">
        {!read.configured ? (
          <EmptyState>
            Secrets missing — add <code className="font-mono">SYNAPSE_APP_ID</code> and{' '}
            <code className="font-mono">SYNAPSE_APP_SECRET</code>, then re-run to fetch rows.
          </EmptyState>
        ) : read.error ? (
          <p className="text-sm text-red-600">Read failed: {read.error}</p>
        ) : read.rows.length === 0 || read.columns.length === 0 ? (
          <EmptyState>The read returned no rows.</EmptyState>
        ) : (
          <>
            {read.truncated && (
              <p className="mb-2 text-xs text-amber-700">
                Showing the first {read.rows.length.toLocaleString()} rows (result was capped).
              </p>
            )}
            <RowsTable columns={read.columns} rows={read.rows} />
          </>
        )}
      </div>
    </section>
  );
}

function FreshnessNote({ read }: { read: ReadResult }) {
  if (!read.configured || read.dataAsOf === null) {
    return null;
  }
  return (
    <p className="text-xs text-slate-400">
      Data as of {formatTimestamp(read.dataAsOf)}; the lake refreshes ~every 12h.{' '}
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
