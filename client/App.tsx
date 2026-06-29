import { useState } from 'react';
import { CatalogTab } from './CatalogTab';
import { EventsTab } from './EventsTab';
import { OverviewTab } from './OverviewTab';
import { ReadTab } from './ReadTab';
import { TablesTab } from './TablesTab';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tables', label: 'Tables' },
  { id: 'read', label: 'Read' },
  { id: 'events', label: 'Events' },
  { id: 'catalog', label: 'Catalog' },
] as const;
export type TabId = (typeof TABS)[number]['id'];

export function App() {
  const [active, setActive] = useState<TabId>('overview');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <h1 className="text-lg font-semibold">Synapse starter</h1>
          <p className="text-sm text-slate-500">Your app's window into Noon data</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6">
        <nav className="flex gap-1 border-b border-slate-200" aria-label="Console sections">
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

        <main className="py-6">
          {active === 'overview' && <OverviewTab onNavigate={setActive} />}
          {active === 'tables' && <TablesTab />}
          {active === 'read' && <ReadTab />}
          {active === 'events' && <EventsTab />}
          {active === 'catalog' && <CatalogTab />}
        </main>
      </div>
    </div>
  );
}
