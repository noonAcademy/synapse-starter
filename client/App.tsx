import { useState } from 'react';
import { GetDataTab } from './GetDataTab';
import { HomeTab } from './HomeTab';
import { MyAppTab } from './MyAppTab';

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'get-data', label: 'Get data' },
  { id: 'my-app', label: 'My app' },
] as const;
export type TabId = (typeof TABS)[number]['id'];

export function App() {
  const [active, setActive] = useState<TabId>('home');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold">Synapse starter</h1>
          <p className="text-sm text-slate-500">Your app's window into Noon data</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <nav
          className="flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Console sections"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              aria-current={active === tab.id ? 'page' : undefined}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                active === tab.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="py-6">
          {active === 'home' && <HomeTab onNavigate={setActive} />}
          {active === 'get-data' && <GetDataTab onNavigate={setActive} />}
          {active === 'my-app' && <MyAppTab onNavigate={setActive} />}
        </main>
      </div>
    </div>
  );
}
