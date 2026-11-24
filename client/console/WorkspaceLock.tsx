import { type FormEvent, useEffect, useState } from 'react';
import {
  forgetWorkspaceKey,
  notifyUnlocked,
  saveWorkspaceKey,
  storedWorkspaceKey,
  workspaceKey,
} from '../workspaceKey';

// Shown in the Replit workspace when this browser has no workspace key yet. The server refuses
// every /api and /__synapse request without it, so that nobody else can read Noon data through
// this Repl's preview link (server/access-gate.ts).
export function WorkspaceLock() {
  const [key, setKey] = useState('');
  // A key was sent and refused: it is old (rotated) or mistyped. Say so, and drop it.
  const [refusedKey] = useState(() => workspaceKey());
  const rejected = refusedKey !== null;
  useEffect(() => {
    if (refusedKey === null) return;
    forgetWorkspaceKey(refusedKey);
    // Another tab saved a newer key: try it before asking the builder.
    const newer = storedWorkspaceKey();
    if (newer && newer !== refusedKey) notifyUnlocked();
  }, [refusedKey]);

  const unlock = (event: FormEvent) => {
    event.preventDefault();
    if (!key.trim()) return;
    saveWorkspaceKey(key);
    notifyUnlocked();
  };

  return (
    <div
      dir="ltr"
      lang="en"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">This workspace is locked to you</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your app can read Noon data, so the console and the app preview need your workspace key.
          This stops anyone else who has your preview link from reading that data.
        </p>
        <ol className="mt-4 list-decimal space-y-1 ps-5 text-sm text-slate-700">
          <li>
            In the Replit Shell, run{' '}
            <code className="rounded bg-slate-100 px-1">npm run workspace-key</code>.
          </li>
          <li>Paste the key it prints below. (Its link unlocks the tab it opens in.)</li>
        </ol>
        <p className="mt-2 text-sm text-slate-600">
          Each browser unlocks once: the Replit webview and a separate tab are separate. Keep the
          key private, like a password.
        </p>
        {rejected && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            That key did not work. Run <code>npm run workspace-key</code> again and paste the key it
            prints now.
          </p>
        )}
        <form onSubmit={unlock} className="mt-4 flex gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Workspace key"
            aria-label="Workspace key"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
