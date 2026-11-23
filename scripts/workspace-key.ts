// `npm run workspace-key` — prints the link that unlocks the Synapse console (and the app preview)
// in a browser on this Repl. `npm run workspace-key -- --rotate` makes a new key, which locks every
// browser that used the old one; restart the app afterwards so the server reads the new key.
// Run it in the Replit Shell: the link carries the key, so never paste it into a chat or a ticket.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkspaceKey } from '../server/workspace-key.js';

const rotate = process.argv.includes('--rotate');
const key = loadWorkspaceKey({
  rootDir: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  replId: process.env.REPL_ID ?? null,
  rotate,
});
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
