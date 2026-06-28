import { useJson } from './useJson';

// Mirrors server/catalog.ts EventCatalog (served by /__synapse/catalog).
interface CatalogGroup {
  namespace: string;
  eventTypes: string[];
}
interface EventCatalog {
  total: number;
  groups: CatalogGroup[];
}

export function CatalogTab() {
  const state = useJson<EventCatalog>('/__synapse/catalog');

  if (state.status === 'loading') {
    return <p className="text-sm text-slate-500">Loading catalog…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-red-600">Couldn't load the catalog: {state.message}</p>;
  }

  const catalog = state.data;

  return (
    <section>
      <h2 className="text-base font-semibold">Event catalog</h2>
      <p className="mb-1 text-sm text-slate-500">
        The {catalog.total} event types this SDK build knows about. Publish any of them with{' '}
        <code className="font-mono">synapse.publishEvent(type, payload)</code>.
      </p>
      <p className="mb-4 text-xs text-slate-400">
        Read-only. Declaring a brand-new event type still requires cataloguing it in noon-citadel
        and republishing the SDK — self-service declaration is a later slice.
      </p>

      <div className="space-y-4">
        {catalog.groups.map((group) => (
          <div key={group.namespace}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.namespace}{' '}
              <span className="font-normal text-slate-400">({group.eventTypes.length})</span>
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.eventTypes.map((type) => (
                <span
                  key={type}
                  className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
