// Vite plugin for the Noon brand kit: favicons in the app's face colour, served in dev and
// written into the build. The face colour is read from client/app/theme.css (`--app-face`) each
// time, so changing it there changes the favicon with no other step.

import { readFileSync } from 'node:fs';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { type BrandIcon, brandIcons, DEFAULT_FACE, faceFromThemeCss } from './brand-icons.js';

function readFace(themeCssPath: string): string {
  try {
    return faceFromThemeCss(readFileSync(themeCssPath, 'utf8'));
  } catch {
    return DEFAULT_FACE;
  }
}

export function iconLinkTags(): HtmlTagDescriptor[] {
  const link = (attrs: Record<string, string>): HtmlTagDescriptor => ({
    tag: 'link',
    attrs,
    injectTo: 'head',
  });
  return [
    link({ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }),
    link({ rel: 'icon', href: '/favicon-32.png', type: 'image/png', sizes: '32x32' }),
    link({ rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' }),
    link({ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }),
  ];
}

const ICON_PATHS = new Set([
  '/favicon.svg',
  '/favicon-32.png',
  '/favicon.ico',
  '/apple-touch-icon.png',
]);

export function noonBrand(options: { themeCssPath: string }): Plugin {
  // Drawing the icons takes a few hundred milliseconds, so keep the last set per face colour.
  let cached: { face: string; icons: BrandIcon[] } | null = null;
  const icons = (): BrandIcon[] => {
    const face = readFace(options.themeCssPath);
    if (cached?.face !== face) cached = { face, icons: brandIcons(face) };
    return cached.icons;
  };
  return {
    name: 'synapse-noon-brand',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        if (!ICON_PATHS.has(path)) {
          next();
          return;
        }
        const icon = icons().find((i) => `/${i.fileName}` === path);
        if (!icon) {
          next();
          return;
        }
        res.setHeader('content-type', icon.contentType);
        res.setHeader('cache-control', 'no-cache');
        res.end(icon.body);
      });
    },
    generateBundle() {
      for (const icon of icons()) {
        this.emitFile({ type: 'asset', fileName: icon.fileName, source: icon.body });
      }
    },
    transformIndexHtml() {
      return iconLinkTags();
    },
  };
}
