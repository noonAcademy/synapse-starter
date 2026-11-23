import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(here, 'client'),
  plugins: [react(), tailwindcss()],
  server: {
    // Replit serves the dev preview from a *.replit.dev host; Vite's
    // allowedHosts check blocks it by default ("Blocked request... not allowed").
    // Only affects the dev server (vite middleware); prod serves static files.
    allowedHosts: ['.replit.dev'],
    // Vite's defaults, plus the workspace key (`*.local`, server/workspace-key.ts) and the
    // screenshots of data pages from `npm run visual`: neither may be served through /@fs/.
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/*.local', '**/.synapse-visual/**'],
    },
  },
  build: {
    outDir: resolve(here, 'dist/public'),
    emptyOutDir: true,
  },
});
