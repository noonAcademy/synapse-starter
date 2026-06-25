import { useState } from 'react';
import { EventsTab } from './EventsTab';

const TABS = [{ id: 'events', label: 'Events' }] as const;
type TabId = (typeof TABS)[number]['id'];

export function App() {
  const [active, setActive] = useState<TabId>('events');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <h1 className="text-lg font-semibold">Synapse starter</h1>
          <p className="text-sm text-slate-500">Settings</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6">
        <nav className="flex gap-1 border-b border-slate-200" aria-label="Settings sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              aria-current={active === tab.id ? 'page' : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                active === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="py-6">{active === 'events' && <EventsTab />}</main>
      </div>
    </div>
  );
}
