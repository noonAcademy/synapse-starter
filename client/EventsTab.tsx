import type { PublishLogEntry } from '@noonacademy/synapse-sdk';
import { useEffect, useState } from 'react';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; events: PublishLogEntry[] };

export function EventsTab() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/__synapse/events')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`request failed (${res.status})`);
        }
        return res.json() as Promise<PublishLogEntry[]>;
      })
      .then((events) => {
        if (!cancelled) {
          setState({ status: 'ready', events });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'failed to load',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h2 className="text-base font-semibold">Events</h2>
      <p className="mb-4 text-sm text-slate-500">Settled outcomes since this app last started.</p>

      {state.status === 'loading' && <p className="text-sm text-slate-500">Loading…</p>}

      {state.status === 'error' && (
        <p className="text-sm text-red-600">Couldn't load events: {state.message}</p>
      )}

      {state.status === 'ready' &&
        (state.events.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
            No events yet. Published events show up here once they settle (accepted or failed).
          </p>
        ) : (
          <EventsTable events={state.events} />
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
                {event.status === 'accepted' ? `#${event.eventId}` : (event.error ?? '—')}
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
