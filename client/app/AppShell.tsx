import { useEffect, useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { type AppPage, getPageForPath, listAppPages } from './pages';

// The shipped product's chrome — what end users see at `/` in a published deployment. Deliberately
// NOT the console chrome: this is the app the builder is making, so keep it clean and rename it.
const APP_NAME = 'My app';

type AuthState = 'probing' | 'authenticated' | 'unauthenticated';

// Probe the server's session gate, mirroring useSynapseMode's philosophy: the client can't read
// REPLIT_DEPLOYMENT, so it infers auth from the server's own behaviour.
//   200 JSON {email}  -> signed in                        -> render the app
//   401               -> gate is on and we're signed out  -> render the login screen
//   anything else     -> gate isn't mounted here (local / not deployed): the request fell through
//                        to the SPA catch-all and returned index.html -> no wall, render the app
function useEndUserAuth(): AuthState {
  const [state, setState] = useState<AuthState>('probing');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((res) => {
        if (cancelled) {
          return;
        }
        const isJson = Boolean(res.headers.get('content-type')?.includes('application/json'));
        if (res.ok && isJson) {
          setState('authenticated');
        } else if (res.status === 401) {
          setState('unauthenticated');
        } else {
          setState('authenticated');
        }
      })
      .catch(() => {
        // Ambiguous (network error) — don't wall a working app behind a failed probe.
        if (!cancelled) {
          setState('authenticated');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// Hand-rolled, dependency-free routing: resolve the current path against the page registry, and
// navigate with history.pushState so end users get real, bookmarkable URLs. The server's SPA
// catch-all already serves index.html for any non-`/__synapse` path, so deep links work on reload.
function useAppPath(): [string, (path: string) => void] {
  const [path, setPath] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname,
  );

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (next: string) => {
    if (next === window.location.pathname) {
      return;
    }
    window.history.pushState(null, '', next);
    setPath(next);
  };

  return [path, navigate];
}

export function AppShell() {
  const auth = useEndUserAuth();
  const [path, navigate] = useAppPath();

  // Hold on a brand-neutral splash until the probe settles, so end users never glimpse the app
  // chrome before the login screen (or vice versa).
  if (auth === 'probing') {
    return <div className="min-h-screen bg-slate-50" aria-hidden />;
  }
  if (auth === 'unauthenticated') {
    return <LoginScreen />;
  }

  const page = getPageForPath(path);
  const navPages = listAppPages().filter((p) => p.nav);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-lg font-semibold text-slate-900"
          >
            {APP_NAME}
          </button>
          {/* One page needs no nav; it appears once the app grows past the home page. */}
          {navPages.length > 1 && <AppNav pages={navPages} current={path} onNavigate={navigate} />}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {page ? <page.Page /> : <NotFound />}
      </main>
    </div>
  );
}

function AppNav({
  pages,
  current,
  onNavigate,
}: {
  pages: AppPage[];
  current: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <nav className="flex gap-1" aria-label="App pages">
      {pages.map((p) => (
        <button
          key={p.path}
          type="button"
          onClick={() => onNavigate(p.path)}
          aria-current={current === p.path ? 'page' : undefined}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            current === p.path
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {p.title}
        </button>
      ))}
    </nav>
  );
}

function NotFound() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
      This page doesn't exist yet.
    </div>
  );
}
