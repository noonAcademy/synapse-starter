import { useEffect, useState } from 'react';
import { pinDocument } from '../brand/preferences';
import { previewHref } from '../workspaceKey';
import { EventsTab } from './EventsTab';
import { GetDataTab } from './GetDataTab';
import { HomeTab } from './HomeTab';
import { SettingsTab } from './SettingsTab';
import { useVerify } from './useVerify';
import { VerifyChip } from './VerifyChip';
import { ViewsTab } from './ViewsTab';

// The workspace-only "Synapse" management console: the builder's surface for connecting to Noon,
// getting data, and inspecting views + events. Hidden in a published deployment (see main.tsx /
// useSynapseMode). The app the builder is shipping lives under client/app/.
const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'get-data', label: 'Get data' },
  { id: 'views', label: 'Views' },
  { id: 'events', label: 'Events' },
  { id: 'settings', label: 'Settings' },
] as const;
export type TabId = (typeof TABS)[number]['id'];

// Data-heavy tabs get the full width so wide tables can breathe; prose tabs stay at a readable
// measure, left-aligned under the same nav.
const WIDE_TABS: readonly TabId[] = ['views', 'events'];

export function ConsoleApp() {
  const [active, setActive] = useState<TabId>('home');
  // One verify run, shared by the header chip and the Home tab's checklist.
  const verify = useVerify();

  // The console is English, left-to-right and light, whatever the app's language and theme were
  // in this browser: reset <html> too, so scrollbars and anything outside #root follow.
  useEffect(() => {
    document.title = 'Synapse console';
    pinDocument();
    const html = document.documentElement;
    html.lang = 'en';
    html.dir = 'ltr';
    html.dataset.theme = 'light';
  }, []);

  return (
    <div
      dir="ltr"
      lang="en"
      className="min-h-screen bg-slate-50 text-slate-900 [color-scheme:light]"
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold">Synapse</h1>
            <p className="text-sm text-slate-500">Manage your app's connection to Noon data</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* The way out to the builder's OWN app. Until their first page exists the workspace
                serves this console at `/`, so without this link the app being built would be
                unreachable until it is deployed. After that `/` is the app and the console lives
                at /synapse-starter, but `?surface=app` still forces the app in either state.
                New tab, so the console stays where it is; the app's /synapse page carries a
                `?surface=console` link back. */}
            <a
              href={previewHref('/?surface=app')}
              target="_blank"
              rel="noreferrer"
              title="Opens your app (not the console) in a new tab, exactly as a deployment serves it — minus the Sign in with Noon gate, which only a deployment mounts."
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              Preview your app <span aria-hidden>↗</span>
            </a>
            {/* Lives in the header so verify state stays visible from every tab. */}
            <VerifyChip state={verify.state} onRerun={verify.run} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
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
          <div className={WIDE_TABS.includes(active) ? '' : 'max-w-3xl'}>
            {active === 'home' && <HomeTab onNavigate={setActive} verify={verify.state} />}
            {active === 'get-data' && <GetDataTab onNavigate={setActive} />}
            {active === 'views' && <ViewsTab onNavigate={setActive} />}
            {active === 'events' && <EventsTab />}
            {active === 'settings' && <SettingsTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
