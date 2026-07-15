import { relativeTime } from '../../format';
import { useView, type ViewData } from '../../useView';
import { AppCard, AppEmptyState, DataTable } from '../ui';

// A registered view (baked read) rendered as a live data block in the shipped app — the ready-made
// table built on the useView data-in primitive. It's the building block app pages compose; when you
// want a custom UI over the same data (a chart, a game board), call useView directly instead. Copy
// stays end-user-friendly (no secret names, no console jargon), and styling comes entirely from the
// theme.css tokens (via the app/ui.tsx primitives) — never hardcode colors here.
export function ViewBlock({ name }: { name: string }) {
  const state = useView(name);

  return (
    <AppCard>
      {state.status === 'loading' && <p className="text-body text-ink-muted">Loading…</p>}
      {state.status === 'error' && (
        <AppEmptyState>This data isn't available right now.</AppEmptyState>
      )}
      {state.status === 'ready' && <ViewBlockBody view={state.data} />}
    </AppCard>
  );
}

function ViewBlockBody({ view }: { view: ViewData }) {
  const unavailable =
    !view.configured || view.error !== null || view.rows.length === 0 || view.columns.length === 0;

  return (
    <div className="min-w-0">
      <h3 className="text-body font-semibold text-ink">{view.title}</h3>
      <p className="text-body text-ink-muted">{view.description}</p>
      {view.configured && view.dataAsOf !== null && (
        <p className="mt-1 text-caption text-ink-faint">Updated {relativeTime(view.dataAsOf)}</p>
      )}

      <div className="mt-4">
        {unavailable ? (
          <AppEmptyState>Nothing to show here yet.</AppEmptyState>
        ) : (
          <>
            {view.truncated && (
              <p className="mb-2 text-caption text-warning">
                Showing the first {view.rows.length.toLocaleString()} rows.
              </p>
            )}
            <DataTable columns={view.columns} rows={view.rows} />
          </>
        )}
      </div>
    </div>
  );
}
