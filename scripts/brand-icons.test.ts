import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  brandIcons,
  DEFAULT_FACE,
  faceFromThemeCss,
  markSvg,
  rasterizeMark,
} from './brand-icons.js';

describe('faceFromThemeCss', () => {
  it('reads --app-face and ignores comments', () => {
    expect(faceFromThemeCss('/* --app-face: #000000; */ :root { --app-face: #FFC; }')).toBe(
      '#ffffcc',
    );
    expect(faceFromThemeCss(':root { --app-face: #5fa0e0; }')).toBe('#5fa0e0');
    expect(
      faceFromThemeCss(
        ':root[data-theme="dark"] { --app-face: #111111; } :root { --app-face: #5fa0e0; }',
      ),
    ).toBe('#5fa0e0');
  });

  it('uses the last declaration across :root blocks, as CSS does', () => {
    expect(faceFromThemeCss(':root {} :root { --app-face: #5fa0e0; }')).toBe('#5fa0e0');
    expect(faceFromThemeCss(':root { --app-face: #64d8ae; --app-face: #ffffff; }')).toBe('#ffffff');
  });

  it('falls back to the Noon green when the value is missing or not a hex colour', () => {
    expect(faceFromThemeCss('')).toBe(DEFAULT_FACE);
    expect(faceFromThemeCss(':root { --app-face: var(--x); }')).toBe(DEFAULT_FACE);
  });
});

describe('brandIcons', () => {
  const icons = Object.fromEntries(brandIcons('#5fa0e0').map((i) => [i.fileName, i]));

  it('makes an SVG favicon in the face colour', () => {
    expect(icons['favicon.svg']?.body).toContain('fill="#5fa0e0"');
    expect(markSvg('#123456')).toContain('<circle');
  });

  it('makes valid PNGs of the right size', () => {
    for (const [name, size] of [
      ['favicon-32.png', 32],
      ['apple-touch-icon.png', 180],
    ] as const) {
      const png = icons[name]?.body as Buffer;
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });

  it('makes an ICO with 16, 32 and 48 pixel PNG frames', () => {
    const ico = icons['favicon.ico']?.body as Buffer;
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect([ico[6], ico[22], ico[38]]).toEqual([16, 32, 48]);
  });

  it('paints the face colour in the middle of the mark and keeps the corners clear', () => {
    const size = 32;
    const pixels = rasterizeMark(size, '#5fa0e0');
    const at = (x: number, y: number) => [
      ...pixels.slice((y * size + x) * 4, (y * size + x) * 4 + 4),
    ];
    expect(at(14, 10)).toEqual([0x5f, 0xa0, 0xe0, 255]);
    expect(at(0, 0)[3]).toBe(0);
  });
});

describe('PREFERENCES_SCRIPT', () => {
  it('uses the same storage keys as client/brand/preferences.ts', async () => {
    const { PREFERENCES_SCRIPT } = await import('./vite-brand.js');
    const source = readFileSync('client/brand/preferences.ts', 'utf8');
    for (const key of ['noon.theme', 'noon.lang']) {
      expect(PREFERENCES_SCRIPT).toContain(`'${key}'`);
      expect(source).toContain(`'${key}'`);
    }
  });
});
