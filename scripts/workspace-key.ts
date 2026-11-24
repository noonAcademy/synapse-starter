// `npm run workspace-key` — prints the link that unlocks the Synapse console (and the app preview)
// in a browser on this Repl. `npm run workspace-key -- --rotate` makes a new key, which locks every
// browser that used the old one; restart the app afterwards so the server reads the new key.
// Run it in the Replit Shell: the link carries the key, so never paste it into a chat or a ticket.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadWorkspaceKey,
  readStoredWorkspaceKey,
  writeHeadersFile,
} from '../server/workspace-key.js';

const rotate = process.argv.includes('--rotate');
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const replId = process.env.REPL_ID ?? null;
const stored = rotate ? null : readStoredWorkspaceKey(rootDir);

// Only the app makes a key for a new Repl. A key made here, under another REPL_ID, would not be the
// key the app holds, and the app would replace it again at its next start.
if (stored && stored.replId !== replId && replId !== null) {
  console.error(
    'The workspace key file was made for another Repl (a fork or a remix copies it).\n' +
      'Stop the app and press Run, so the app makes the key for this Repl. Then run this again.',
  );
  process.exit(1);
}
if (stored && stored.replId !== replId) {
  console.log(
    'This Shell has no REPL_ID. It shows the key that the app wrote at its last start.\n',
  );
}
// A Replit Shell without REPL_ID would write a key that the app (which has REPL_ID) replaces.
const onReplit = Boolean(process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG);
if (!stored && replId === null && onReplit) {
  console.error(
    'This Shell has no REPL_ID, so a key made here would not be the key the app uses.\n' +
      'Stop the app and press Run (the app makes the key), then run this again without --rotate.',
  );
  process.exit(1);
}
if (stored) writeHeadersFile(rootDir, stored.key);
const key = stored?.key ?? loadWorkspaceKey({ rootDir, replId, rotate });
if (!stored && !rotate) {
  console.log('No workspace key yet: made one. Restart the app (Stop, then Run) to use it.\n');
}
const origin = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : `http://localhost:${process.env.PORT ?? 3000}`;

if (rotate) console.log('New workspace key made. Restart the app (Stop, then Run) to use it.\n');
console.log('Paste this key into the lock screen of each browser you use (the webview, a tab):\n');
console.log(`  ${key}\n`);
console.log('Or open this link, which unlocks the tab it opens in:\n');
// The key goes after '#', so the browser keeps it: it never reaches a server or a proxy log.
console.log(`  ${origin}/#synapse_key=${key}\n`);
console.log('Treat both like a password: never paste them into a chat, a ticket or code.');
