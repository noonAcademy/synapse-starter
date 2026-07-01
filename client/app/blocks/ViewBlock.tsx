import { relativeTime } from '../../format';
import { RowsTable } from '../../RowsTable';
import { Card, EmptyState } from '../../ui';
import { useView, type ViewData } from '../../useView';

// A registered view (baked read) rendered as a live data block in the shipped app — the ready-made
// table built on the useView data-in primitive. It's the building block app pages compose; when you
// want a custom UI over the same data (a chart, a game board), call useView directly instead. Copy
// stays end-user-friendly (no secret names, no console jargon).
export function ViewBlock({ name }: { name: string }) {
  const state = useView(name);

  return (
    <Card>
      {state.status === 'loading' && <p className="text-sm text-slate-500">Loading…</p>}
      {state.status === 'error' && <EmptyState>This data isn't available right now.</EmptyState>}
      {state.status === 'ready' && <ViewBlockBody view={state.data} />}
    </Card>
  );
}

function ViewBlockBody({ view }: { view: ViewData }) {
  const unavailable =
    !view.configured || view.error !== null || view.rows.length === 0 || view.columns.length === 0;

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-slate-900">{view.title}</h3>
      <p className="text-sm text-slate-500">{view.description}</p>
      {view.configured && view.dataAsOf !== null && (
        <p className="mt-1 text-xs text-slate-400">Updated {relativeTime(view.dataAsOf)}</p>
      )}

      <div className="mt-4">
        {unavailable ? (
          <EmptyState>Nothing to show here yet.</EmptyState>
        ) : (
          <>
            {view.truncated && (
              <p className="mb-2 text-xs text-amber-700">
                Showing the first {view.rows.length.toLocaleString()} rows.
              </p>
            )}
            <RowsTable columns={view.columns} rows={view.rows} />
          </>
        )}
      </div>
    </div>
  );
}
