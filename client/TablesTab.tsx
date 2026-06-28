import { useMemo, useState } from 'react';
import { useJson } from './useJson';

// Mirrors server/tables.ts TableProjection (the JSON shape served by /__synapse/tables).
// Kept local so the client stays decoupled from server module resolution.
interface TableColumn {
  name: string;
  type: string;
  description: string;
  enumValues?: string[];
}

export interface TableProjection {
  key: string;
  database: string;
  table: string;
  description: string;
  grain: string;
  refreshCadence: string;
  accessLevel: string;
  columns: TableColumn[];
  exampleQueries: string[];
}

// Match the query against the fields a builder would search by: name, location, what it
// holds, and its column names. Exported for unit testing.
export function filterTables(tables: TableProjection[], query: string): TableProjection[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return tables;
  }
  return tables.filter((t) => {
    const haystack = [t.key, t.table, t.database, t.description, ...t.columns.map((c) => c.name)]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function TablesTab() {
  const state = useJson<TableProjection[]>('/__synapse/tables');

  if (state.status === 'loading') {
    return <p className="text-sm text-slate-500">Loading registry…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-red-600">Couldn't load the registry: {state.message}</p>;
  }
  return <TablesBrowser tables={state.data} />;
}

function TablesBrowser({ tables }: { tables: TableProjection[] }) {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(tables[0]?.key ?? null);

  const filtered = useMemo(() => filterTables(tables, query), [tables, query]);
  const selected = filtered.find((t) => t.key === selectedKey) ?? filtered[0] ?? null;

  return (
    <section>
      <h2 className="text-base font-semibold">Tables</h2>
      <p className="mb-4 text-sm text-slate-500">
        The bundled Citadel data registry ({tables.length} tables). Browse it to write reads — the
        source of truth is <code className="font-mono">server/citadel-schema.ts</code>.
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tables and columns…"
        aria-label="Search tables"
        className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
      />

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
          No tables match “{query}”.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
          <ul className="max-h-[28rem] overflow-y-auto rounded-md border border-slate-200">
            {filtered.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(t.key)}
                  className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 ${
                    selected?.key === t.key
                      ? 'bg-slate-100 font-medium text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono">{t.table}</span>
                  <span className="block truncate text-xs text-slate-400">{t.grain}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected && <TableDetail table={selected} />}
        </div>
      )}
    </section>
  );
}

function TableDetail({ table }: { table: TableProjection }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-sm font-semibold text-slate-900">
          {table.database}.{table.table}
        </h3>
        <AccessBadge level={table.accessLevel} />
      </div>
      <p className="mt-1 text-sm text-slate-600">{table.description}</p>

      <dl className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-500 sm:grid-cols-2">
        <div>
          <dt className="inline font-medium text-slate-600">Grain: </dt>
          <dd className="inline">{table.grain}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-slate-600">Refresh: </dt>
          <dd className="inline">{table.refreshCadence}</dd>
        </div>
      </dl>

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Columns ({table.columns.length})
      </h4>
      <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-slate-100">
        <table className="w-full text-left text-xs">
          <tbody>
            {table.columns.map((col) => (
              <tr key={col.name} className="border-b border-slate-100 align-top last:border-b-0">
                <td className="px-2 py-1.5 font-mono text-slate-800">{col.name}</td>
                <td className="px-2 py-1.5 font-mono text-slate-400">{col.type}</td>
                <td className="px-2 py-1.5 text-slate-600">
                  {col.description}
                  {col.enumValues && col.enumValues.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {col.enumValues.map((v) => (
                        <span
                          key={v}
                          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
                        >
                          {v}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.exampleQueries.length > 0 && (
        <>
          <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Example queries
          </h4>
          <div className="mt-2 space-y-2">
            {table.exampleQueries.map((sql) => (
              <CopyableQuery key={sql} sql={sql} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AccessBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    all: 'bg-green-50 text-green-700',
    leader_and_above: 'bg-amber-50 text-amber-700',
    admin_only: 'bg-red-50 text-red-700',
  };
  return (
    <span
      title="Informational only — reads run app-wide. This reflects the registry's documented sensitivity, not an enforced limit."
      className={`rounded px-2 py-0.5 text-xs font-medium ${styles[level] ?? 'bg-slate-100 text-slate-600'}`}
    >
      access: {level}
    </span>
  );
}

function CopyableQuery({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="relative rounded-md border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded bg-white px-2 py-0.5 text-xs text-slate-500 shadow-sm hover:text-slate-800"
      >
        {copied ? 'copied' : 'copy'}
      </button>
      <pre className="overflow-x-auto px-3 py-2 pr-16 text-xs text-slate-700">{sql}</pre>
    </div>
  );
}
