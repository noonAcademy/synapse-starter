import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(here, 'client'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(here, 'dist/public'),
    emptyOutDir: true,
  },
});
