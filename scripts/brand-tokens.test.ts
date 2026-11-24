import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The Noon palette in client/brand/noon.css must stay readable in both themes: every text colour
// passes WCAG AA (4.5:1) on the page and on a card, and every chart colour 3:1 on a card.
const css = readFileSync('client/brand/noon.css', 'utf8');

function block(selector: string, from = 0): Record<string, string> {
  const start = css.indexOf(`${selector} {`, from);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--noon-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  ) as Record<string, string>;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

const TEXT = [
  'ink',
  'ink-muted',
  'ink-faint',
  'accent',
  'danger',
  'success',
  'warning',
  'primary-ink',
];
const CHARTS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6'];

const light = block(':root');
const dark = block(':root[data-theme="dark"]');
const systemDark = block(':root:not([data-theme="light"])');

describe.each([
  ['light', light],
  ['dark', dark],
])('%s palette', (_name, palette) => {
  it.each(TEXT)('text colour %s passes AA on the page and on a card', (token) => {
    for (const background of ['surface', 'card']) {
      expect(
        contrast(palette[token] as string, palette[background] as string),
        `${token} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(CHARTS)('chart colour %s reaches 3:1 on a card', (token) => {
    expect(contrast(palette[token] as string, palette.card as string)).toBeGreaterThanOrEqual(3);
  });

  it('keeps text on the primary button readable, and danger text on its surface', () => {
    expect(
      contrast(palette['on-primary'] as string, palette.primary as string),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(palette['on-primary'] as string, palette['primary-strong'] as string),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(palette.danger as string, palette['danger-surface'] as string),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

it('uses the same dark palette for a chosen dark theme and a dark system theme', () => {
  expect(systemDark).toEqual(dark);
  expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
});
