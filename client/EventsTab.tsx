import type { PublishLogEntry } from '@noonacademy/synapse-sdk';
import { useJson } from './useJson';

export function EventsTab() {
  const state = useJson<PublishLogEntry[]>('/__synapse/events');

  return (
    <section>
      <h2 className="text-base font-semibold">Events — what your app tells Noon</h2>
      <p className="mb-4 text-sm text-slate-500">
        Events are things your app reports back to Noon — like a student joining a course or a
        payment failing. This is everything your app has sent since it last started.
      </p>

      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Want to send a new kind of event?</p>
        <p className="mt-1">
          Your app can send any of the event types listed in the <strong>Catalog</strong> tab. To
          send a <em>brand-new</em> kind of event, that type has to be added to Noon's catalog first
          — that's a Noon-side step today (self-service is coming).
        </p>
        <p className="mt-1">
          The Replit agent <strong>can't create new event types for you</strong>. If you ask for a
          feature that needs one, it'll reuse a type that already fits, or tell you it needs a
          Noon-side catalog change.
        </p>
      </div>

      {state.status === 'loading' && <p className="text-sm text-slate-500">Loading…</p>}

      {state.status === 'error' && (
        <p className="text-sm text-red-600">Couldn't load events: {state.message}</p>
      )}

      {state.status === 'ready' &&
        (state.data.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
            No events yet. Published events show up here once they settle (accepted or failed).
          </p>
        ) : (
          <EventsTable events={state.data} />
        ))}
    </section>
  );
}

function EventsTable({ events }: { events: PublishLogEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Event ID / Error</th>
            <th className="px-3 py-2 font-medium">Attempts</th>
            <th className="px-3 py-2 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={`${event.at}-${event.type}-${event.status}-${event.eventId ?? event.error ?? ''}`}
              className="border-t border-slate-200"
            >
              <td className="px-3 py-2 font-mono text-slate-800">{event.type}</td>
              <td className="px-3 py-2">
                <StatusBadge status={event.status} />
              </td>
              <td className="px-3 py-2 text-slate-700">
                {event.status === 'accepted' && event.eventId != null
                  ? `#${event.eventId}`
                  : (event.error ?? '—')}
              </td>
              <td className="px-3 py-2 tabular-nums text-slate-700">{event.attempts}</td>
              <td className="px-3 py-2 text-slate-500">{formatTime(event.at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: PublishLogEntry['status'] }) {
  if (status === 'accepted') {
    return <span className="font-medium text-green-700">✓ accepted</span>;
  }
  const label = status === 'failed_permanent' ? 'failed' : 'dropped';
  return <span className="font-medium text-red-600">✗ {label}</span>;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
}
