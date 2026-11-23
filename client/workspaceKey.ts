// The browser half of the workspace lock (server/access-gate.ts). In the Replit workspace every
// /api and /__synapse request must carry the builder's key. The key arrives once through the unlock
// link (`/#synapse_key=…`, printed by `npm run workspace-key`), is kept in this browser's
// localStorage, and is added to same-origin /api and /__synapse fetches — including fetches the
// builder's own pages make. A header, not a cookie: the Replit webview is a cross-site iframe,
// where browsers block cookies. In a deployment nobody has a key, so this does nothing there.

export const WORKSPACE_KEY_HEADER = 'x-synapse-workspace-key';
const STORAGE_KEY = 'synapse.workspaceKey';
const FRAGMENT_PARAM = 'synapse_key';

export function storedWorkspaceKey(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function forgetWorkspaceKey(): void {
  sessionKey = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}

export function saveWorkspaceKey(key: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {
    // Storage blocked: the key works until the page reloads (see installWorkspaceKey).
  }
  sessionKey = key.trim();
}

let sessionKey: string | null = null;

// main.tsx listens and probes again. No page reload: where the browser blocks storage (a
// cross-site iframe can), a reload would lose the key that is kept only in memory.
export const UNLOCKED_EVENT = 'synapse:workspace-unlocked';
export function notifyUnlocked(): void {
  window.dispatchEvent(new Event(UNLOCKED_EVENT));
}

// Reads `#synapse_key=` from the address, keeps it, and removes it from the address bar so it is
// not left on screen or in a screenshot (the browser's history may still hold the first URL).
function takeKeyFromFragment(): void {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const key = params.get(FRAGMENT_PARAM);
  if (!key) return;
  saveWorkspaceKey(key);
  params.delete(FRAGMENT_PARAM);
  const rest = params.toString();
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search + (rest ? `#${rest}` : ''),
  );
}

function isGatedPath(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  return (
    url.origin === window.location.origin &&
    (path === '/api' || path.startsWith('/api/') || path.startsWith('/__synapse'))
  );
}

export function workspaceKey(): string | null {
  return sessionKey ?? storedWorkspaceKey();
}

let installed = false;

// Call once, before the first render.
export function installWorkspaceKey(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  takeKeyFromFragment();
  // The link opened in a tab that already shows this app changes only the fragment, which does not
  // reload the page; take the key and tell main.tsx to probe again with it.
  window.addEventListener('hashchange', () => {
    if (!new URLSearchParams(window.location.hash.slice(1)).has(FRAGMENT_PARAM)) return;
    takeKeyFromFragment();
    notifyUnlocked();
  });
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const key = workspaceKey();
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!key || !isGatedPath(new URL(raw, window.location.href))) {
      return originalFetch(input, init);
    }
    if (input instanceof Request) {
      const headers = new Headers(init?.headers ?? input.headers);
      headers.set(WORKSPACE_KEY_HEADER, key);
      return originalFetch(new Request(input, { ...init, headers }));
    }
    const headers = new Headers(init?.headers);
    headers.set(WORKSPACE_KEY_HEADER, key);
    return originalFetch(input, { ...init, headers });
  };
}

// Opens a gated text endpoint (for example the raw registry) in a new tab. A plain link cannot
// carry the key header, so fetch it and open the result.
export async function openGatedText(path: string): Promise<void> {
  const tab = window.open('', '_blank');
  // A blocked pop-up: do nothing rather than navigate the console away and lose its state.
  if (!tab) return;
  tab.opener = null;
  const res = await fetch(path);
  const text = res.ok ? await res.text() : `Request failed (${res.status}). Reload the console.`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  tab.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// A link to the app preview that opens unlocked in a new tab. A new tab outside the Replit webview
// does not share the webview's storage, so the key travels in the fragment (never sent to a server).
export function previewHref(path: string): string {
  const key = workspaceKey();
  return key ? `${path}#${FRAGMENT_PARAM}=${encodeURIComponent(key)}` : path;
}
