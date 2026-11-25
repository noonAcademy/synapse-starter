import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { appFiles, checkThemeFile, findViolations } from './check-theme-tokens.js';

// A stand-in reader so the pattern tests don't need fixture files on disk.
function reader(contents: Record<string, string>) {
  return ((file: string) =>
    contents[file] ?? '') as unknown as typeof import('node:fs').readFileSync;
}

const check = (source: string) =>
  findViolations(['client/app/pages/x.tsx'], reader({ 'client/app/pages/x.tsx': source }));

describe('findViolations', () => {
  it("accepts the app's own semantic token utilities", () => {
    const source = `
      <div className="bg-surface text-ink rounded-card p-card space-y-stack">
        <p className="text-caption text-ink-faint">hello</p>
      </div>`;
    expect(check(source)).toEqual([]);
  });

  it('flags a hardcoded hex color', () => {
    expect(check('const c = "#ff0055";')[0]?.reason).toMatch(/hex color/);
  });

  it('flags rgb()/hsl() color functions', () => {
    expect(check('background: rgba(0,0,0,0.5);')[0]?.reason).toMatch(/color function/);
  });

  it('flags a Tailwind palette class, which is how a theme quietly stops applying', () => {
    expect(check('<div className="bg-slate-700 text-red-500" />')[0]?.reason).toMatch(
      /Tailwind palette class/,
    );
  });

  it('warns on fixed white and black, which do not follow dark mode', () => {
    expect(check('<div className="bg-white" />')[0]).toMatchObject({
      reason: expect.stringMatching(/white or black/),
      warning: true,
    });
    expect(check('<p className="text-black" />')[0]?.warning).toBe(true);
    expect(check('<p className="bg-white" style={{ color: "red" }} />')[0]?.reason).toMatch(
      /inline style/,
    );
    expect(check('<p className="text-on-primary bg-card" />')).toEqual([]);
  });

  it('flags an arbitrary Tailwind value', () => {
    expect(check('<div className="bg-[#fff] rounded-[3px]" />')[0]?.reason).toMatch(
      /arbitrary Tailwind value/,
    );
  });

  it('flags an inline style — the shape a visual editor is most likely to write', () => {
    expect(check('<button style={{ backgroundColor: "red" }} />')[0]?.reason).toMatch(
      /inline style/,
    );
  });

  it('does not mistake a semantic utility for a palette class', () => {
    // `bg-surface` has no numeric step; `bg-surface-500` would. This is the line being drawn.
    expect(check('<div className="bg-surface border-line ring-primary" />')).toEqual([]);
  });

  it('honours an explicit theme-tokens-ignore opt-out', () => {
    expect(check('const fallback = "#0f172a"; // theme-tokens-ignore')).toEqual([]);
  });

  it('reports the file and line so the message is actionable', () => {
    const found = check('ok\nok\nconst c = "#abc";');
    expect(found[0]?.file).toBe('client/app/pages/x.tsx');
    expect(found[0]?.line).toBe(3);
  });

  it('never exempts a whole file except theme.css itself', () => {
    const found = findViolations(
      ['client/app/theme.css', 'client/app/pages/y.tsx'],
      reader({
        'client/app/theme.css': '--color-primary: #0f172a;',
        'client/app/pages/y.tsx': 'const c = "#0f172a";',
      }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.file).toBe('client/app/pages/y.tsx');
  });
});

describe('the shipped app', () => {
  it('is token-clean — the template must not ship a violation of its own convention', () => {
    expect(findViolations(appFiles())).toEqual([]);
  });

  it('actually scans the app surface (guards against a broken walk silently passing)', () => {
    const files = appFiles();
    expect(files).toContain('client/app/pages/home.tsx');
    expect(files).toContain('client/app/blocks/ChartBlock.tsx');
  });
});

describe('checkThemeFile', () => {
  const ok = '@import "../brand/noon.css";\n:root {\n  --app-face: #64d8ae;\n}\n';

  it("accepts the template's own theme.css", () => {
    expect(checkThemeFile(readFileSync('client/app/theme.css', 'utf8'))).toEqual([]);
  });

  it('accepts a short or upper-case hex face colour without a semicolon', () => {
    expect(checkThemeFile('@import "../brand/noon.css";\n:root { --app-face: #5FA }')).toEqual([]);
  });

  it("fails a face too dark for the logo's dark smile", () => {
    const found = checkThemeFile('@import "../brand/noon.css";\n:root { --app-face: #1a1a1a; }');
    expect(found[0]?.reason).toMatch(/too dark for the logo/);
  });

  it('fails an @import that comes after a rule (CSS would ignore it)', () => {
    const [violation] = checkThemeFile(
      ':root { --app-face: #64d8ae; }\n@import "../brand/noon.css";',
    );
    expect(violation?.reason).toMatch(/must come first/);
  });

  it('fails when the brand import is missing', () => {
    expect(checkThemeFile(':root { --app-face: #64d8ae; }')[0]?.reason).toMatch(/must import/);
  });

  it('accepts any token override or new token: the Noon look is a default, not a lock', () => {
    const css = [
      '@import "../brand/noon.css";',
      '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");',
      ':root {',
      '  --app-face: #5fa0e0;',
      '  --noon-primary: #2b6cb0;',
      '  --noon-on-primary: #ffffff',
      '}',
      ':root[data-theme="dark"] { --noon-primary: #7fb3e6; }',
      '@media (prefers-color-scheme: dark) {',
      '  :root:not([data-theme="light"]) { --noon-primary: #7fb3e6; }',
      '}',
      '@theme { --color-brand: #2b6cb0; --font-display: "Inter", sans-serif; --radius-card: 4px; }',
      ':root { --hero-image: url(data:image/png;base64,AAAA); --hero-quoted: url("a;b.png"); }',
      ':root { @media print { --noon-primary: #000000; } --noon-ink: #111111; }',
      '@theme { --color-*: initial; --color-brand: #2b6cb0; }',
      '@theme inline { --*: initial; --font-app: "Inter", sans-serif; }',
      '@font-face { font-family: "Mine"; font-weight: 700; src: url("./mine.woff2") format("woff2"); }',
    ].join('\n');
    expect(checkThemeFile(css)).toEqual([]);
  });

  it('fails on a style rule, a stray declaration or a face the favicon cannot use, with its line', () => {
    const cases = [
      `${ok}.card { color: #ff0000; }`,
      `${ok}body { --noon-ink: #111111; background: #ffffff; }`,
      `${ok}@media (min-width: 40rem) { .card { padding: 2rem; } }`,
      `${ok}--noon-primary: #2b6cb0;`,
      `${ok}:root { --app-face: var(--x); }`,
      `${ok}:root { --app-face: oklch(0.8 0.1 250); }`,
      `${ok}:root[data-theme="dark"] { --app-face: #5fa0e0; }`,
      `${ok}@media print { :root { --app-face: #ffffff; } }`,
      `${ok}:root { --color-*: initial; }`,
      `${ok}@theme { --color-*: red; }`,
      `${ok}:root { --app-face: #5fa0e0; @media print { --noon-primary: #ffffff; } }`,
    ];
    for (const css of cases) {
      const [violation] = checkThemeFile(css);
      expect(violation, css).toBeDefined();
      expect(violation?.line).toBe(5);
    }
  });

  it('ignores commented-out tokens', () => {
    expect(checkThemeFile(`/* @theme { --color-ink: #000; } */\n${ok}`)).toEqual([]);
  });
});
