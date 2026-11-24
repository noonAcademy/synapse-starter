// Enforce the convention that keeps every app on the Noon design system: the shipped app's look
// lives in design tokens (client/brand/noon.css, plus any overrides in client/app/theme.css),
// and app components consume the utilities those tokens generate — never a raw color, radius, or font.
//
// WHY THIS IS A CHECK AND NOT A RULE IN A SKILL. A rule in AGENTS.md only binds whoever reads
// AGENTS.md. Replit's Agent 4 Design Canvas applies visual edits straight to the codebase
// WITHOUT running a full agent loop — nudge a button color, it lands in the file. No agent reads
// the rulebook on that path and no skill can fire, so prose cannot defend this convention. A
// check can, because `npm run verify` runs on every deployment build no matter who or what wrote
// the code.
//
// (Whether the Design Canvas actually hardcodes anything is unverified at the time of writing.
// This guard costs nothing if it doesn't, and catches it silently if it does — along with the
// far more common case of an agent or a human pasting a hex value in a hurry.)
//
// Scope: client/app/** only — the SHIPPED app. The builder console (client/console/,
// client/ui.tsx) keeps its own fixed styling on purpose and is never themed, so it is exempt.
//
// theme.css gets its own check (checkThemeFile). The Noon defaults (Ink & Light) live in the
// synapse-owned client/brand/noon.css, which upgrades keep in sync; theme.css imports them first
// and may then override any token or add new ones — an app is free to change its look. What it
// may not hold is a style rule: the look reaches pages only through tokens, so a style rule there
// would bypass dark mode and every other page.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const APP_DIR = 'client/app';
// theme.css holds the real values; .test files may assert against literal colors.
const EXEMPT = new Set([join(APP_DIR, 'theme.css')]);

export interface TokenViolation {
  file: string;
  line: number;
  text: string;
  reason: string;
  // Reported, but does not fail the check: a clone keeps these until the builder agrees to a change.
  warning?: boolean;
}

interface Pattern {
  // `global` is required — every match on a line is reported, not just the first.
  regex: RegExp;
  reason: string;
  warning?: boolean;
}

// ORDER MATTERS: the first pattern to match a line is the one reported, so the most SPECIFIC
// shapes come first. `bg-[#fff]` is both an arbitrary Tailwind value and a hex color; naming it
// the former tells the reader what to do about it, naming it the latter doesn't.
const PATTERNS: Pattern[] = [
  {
    // Arbitrary-value color/radius/font classes: bg-[#fff], rounded-[3px], font-[Inter].
    regex: /\b(?:bg|text|border|rounded|font|ring|fill|stroke)-\[[^\]]+\]/g,
    reason: 'arbitrary Tailwind value — add or adjust a token in theme.css instead',
  },
  {
    // Tailwind's built-in palette classes: bg-slate-700, text-red-500, border-gray-200.
    // The app's own semantic utilities (bg-surface, text-ink) carry no numeric step, so they
    // don't match — which is exactly the line this check is drawing.
    regex:
      /\b(?:bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|shadow|accent|caret|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    reason: "Tailwind palette class — the app's look comes from theme.css tokens only",
  },
  {
    // White and black do not follow dark mode: bg-white stays white under text-ink, which turns
    // light. The token versions are bg-card, text-ink and text-on-primary.
    regex:
      /\b(?:bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|accent|caret|divide|placeholder)-(?:white|black)\b/g,
    reason:
      'fixed white or black does not follow dark mode — use a token (bg-card, text-ink, text-on-primary)',
    warning: true,
  },
  {
    // Inline styles are how a visual editor most plausibly writes a one-off tweak.
    regex: /style=\{\{[^}]*(?:color|background|border|font|radius)/gi,
    reason: 'inline style — restyling belongs in theme.css, not on the element',
  },
  {
    // #fff / #ffffff / #ffffffff — the generic catch, last.
    regex: /#[0-9a-fA-F]{3,8}\b/g,
    reason: 'hardcoded hex color — use a theme token utility (bg-surface, text-ink, …)',
  },
  {
    regex: /\b(?:rgb|rgba|hsl|hsla)\s*\(/g,
    reason: 'hardcoded color function — use a theme token utility',
  },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (['.tsx', '.ts', '.css'].includes(extname(entry))) out.push(full);
  }
  return out;
}

// A line the check must not judge: a comment explaining the rule, or a fallback constant that
// exists precisely because a token can't be read yet (ChartBlock's FALLBACK_SERIES). Both are
// marked with an explicit opt-out so an exemption is always visible in the diff.
function isExempted(line: string): boolean {
  return line.includes('theme-tokens-ignore');
}

export function findViolations(files: string[], read = readFileSync): TokenViolation[] {
  const violations: TokenViolation[] = [];
  for (const file of files) {
    if (EXEMPT.has(file)) continue;
    const lines = String(read(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      if (isExempted(line)) return;
      // One finding per line is enough to act on; a failing pattern beats a warning.
      let warning: TokenViolation | null = null;
      for (const pattern of PATTERNS) {
        pattern.regex.lastIndex = 0;
        if (!pattern.regex.test(line)) continue;
        const found = {
          file,
          line: i + 1,
          text: line.trim().slice(0, 100),
          reason: pattern.reason,
        };
        if (!pattern.warning) {
          violations.push(found);
          return;
        }
        warning ??= { ...found, warning: true };
      }
      if (warning) violations.push(warning);
    });
  }
  return violations;
}

const THEME_FILE = join(APP_DIR, 'theme.css');
const BRAND_IMPORT = /^@import\s+(["'])\.\.\/brand\/noon\.css\1\s*;$/;
const CUSTOM_PROPERTY = /^--[\w-]+\s*:/;
// Tailwind's namespace resets, valid only inside @theme: `--color-*: initial` clears one
// namespace before the app defines its own, `--*: initial` clears the whole theme.
const THEME_RESET = /^--(?:[\w-]+-)?\*\s*:\s*initial\s*;?$/;
// A hex colour only: the favicon is drawn from it (scripts/brand-icons.ts).
const FACE_DECLARATION = /^--app-face\s*:\s*#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\s*;?$/;
// The logo's smile (--color-logo-smile in client/brand/noon.css) is drawn on the face.
const LOGO_SMILE = '#151515';
const MIN_SMILE_CONTRAST = 3;

function fullHex(hex: string): string {
  return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(fullHex(hex).slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export function smileContrast(face: string): number {
  const [high, low] = [luminance(face), luminance(LOGO_SMILE)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

interface CssStatement {
  // `statement`: a declaration or at-rule ending in `;` (or the last one in a block, which may
  // omit it). `block`: a prelude and a `{ … }` body, whose bounds are bodyStart / bodyEnd.
  kind: 'statement' | 'block';
  text: string;
  start: number;
  bodyStart: number;
  bodyEnd: number;
}

// Splits source[from, to) into statements and blocks at one nesting level, matching braces and
// skipping quoted strings and parentheses (a font or data URL may hold a `;`, quoted or not, as in
// `url(data:image/png;base64,…)`). Small on purpose: theme.css is a token list.
function cssStatements(source: string, from: number, to: number): CssStatement[] {
  const out: CssStatement[] = [];
  let i = from;
  while (i < to) {
    while (i < to && /\s/.test(source[i] ?? '')) i++;
    if (i >= to) break;
    const start = i;
    let depth = 0;
    let open = -1;
    let quote = '';
    let parens = 0;
    let ended = false;
    for (; i < to; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '(') {
        parens++;
      } else if (ch === ')') {
        if (parens > 0) parens--;
      } else if (parens > 0) {
        // Inside a value's parentheses: a `;`, `{` or `}` here is part of the value.
      } else if (ch === '{') {
        if (depth === 0) open = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth <= 0) {
          const text = source.slice(start, i + 1);
          out.push({ kind: 'block', text, start, bodyStart: open + 1, bodyEnd: i });
          i++;
          ended = true;
          break;
        }
      } else if (ch === ';' && depth === 0) {
        const text = source.slice(start, i + 1);
        out.push({ kind: 'statement', text, start, bodyStart: -1, bodyEnd: -1 });
        i++;
        ended = true;
        break;
      }
    }
    if (!ended) {
      const text = source.slice(start, to);
      out.push({ kind: 'statement', text, start, bodyStart: -1, bodyEnd: -1 });
    }
  }
  return out;
}

// Checks client/app/theme.css. It holds the app's TOKENS: the brand import first, then any custom
// properties (override a --noon-* value, a --font-* or --radius-* token, or add a token of the
// app's own) in any selector, @theme or @media block, plus @font-face for a font of the app's own.
// What it may not hold is a style rule (`.card { color: … }`): elements are styled by token
// utilities in components, which is what lets one override reach every page and dark mode.
export function checkThemeFile(css: string, file = THEME_FILE): TokenViolation[] {
  const violations: TokenViolation[] = [];
  // Blank out comments but keep their newlines, so reported line numbers stay right.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const fail = (index: number, text: string, reason: string) => {
    const line = source.slice(0, index).split('\n').length;
    violations.push({ file, line, text: text.trim().slice(0, 100), reason });
  };

  // `topLevel`: the block is not inside @media or any other block. The favicon reader
  // (faceFromThemeCss) takes the last `:root` value without evaluating conditions, so a face set
  // under `@media print { :root { … } }` would draw a favicon the screen never shows.
  // `hasNested`: the same :root block also holds a nested block (CSS nesting, e.g. `@media print
  // { … }` inside :root). The favicon reader's :root match ends at the first `}`, so it would miss
  // a face declared in such a block and draw the default green instead.
  const checkFace = (
    prelude: string,
    topLevel: boolean,
    hasNested: boolean,
    at: number,
    text: string,
  ) => {
    if (prelude !== ':root' || !topLevel) {
      fail(
        at,
        text,
        '--app-face belongs in a top-level :root { }, outside @media — the favicon is drawn from it',
      );
      return;
    }
    if (hasNested) {
      fail(
        at,
        text,
        '--app-face needs a :root { } of its own, with no nested blocks — move the nested rules to another :root { } (the favicon is drawn from it)',
      );
      return;
    }
    if (!FACE_DECLARATION.test(text)) {
      fail(at, text, '--app-face must be a hex colour — the favicon is drawn from it');
      return;
    }
    const face = text.match(/#[0-9a-fA-F]+/)?.[0] ?? '';
    if (smileContrast(face) < MIN_SMILE_CONTRAST) {
      fail(
        at,
        text,
        `--app-face ${face} is too dark for the logo's dark smile (contrast ${smileContrast(face).toFixed(1)}:1, needs ${MIN_SMILE_CONTRAST}:1) — pick a light or mid tone`,
      );
    }
  };

  const checkBlock = (block: CssStatement, topLevel: boolean, inTheme = false) => {
    const prelude = source
      .slice(block.start, block.bodyStart - 1)
      .trim()
      .replace(/\s+/g, ' ');
    if (/^@font-face$/i.test(prelude)) return;
    // `@theme`, `@theme inline`, `@theme static`, …
    const isTheme = /^@theme\b/i.test(prelude);
    const children = cssStatements(source, block.bodyStart, block.bodyEnd);
    const hasNested = children.some((child) => child.kind === 'block');
    for (const child of children) {
      if (child.kind === 'block') {
        checkBlock(child, false, inTheme || isTheme);
        continue;
      }
      const text = child.text.trim();
      if (text === '' || text === ';') continue;
      if ((inTheme || isTheme) && THEME_RESET.test(text)) continue;
      if (!CUSTOM_PROPERTY.test(text)) {
        const property = text.split(':')[0]?.trim() ?? text;
        fail(
          child.start,
          text,
          `"${property}" is a style, not a token — theme.css holds tokens (custom properties such as --noon-primary); style elements with token utilities in components`,
        );
        continue;
      }
      if (/^--app-face\s*:/.test(text)) checkFace(prelude, topLevel, hasNested, child.start, text);
    }
  };

  let hasImport = false;
  let seenRule = false;
  for (const statement of cssStatements(source, 0, source.length)) {
    const text = statement.text.trim();
    if (statement.kind === 'block') {
      seenRule = true;
      checkBlock(statement, true);
      continue;
    }
    if (text.startsWith('@import')) {
      // CSS ignores an @import that comes after a rule, which would drop the whole design system.
      if (seenRule) fail(statement.start, text, 'an @import must come first in theme.css');
      else if (BRAND_IMPORT.test(text)) hasImport = true;
      continue;
    }
    fail(
      statement.start,
      text,
      'put tokens inside a block, for example :root { --noon-primary: … }',
    );
  }
  if (!hasImport) {
    violations.push({
      file,
      line: 1,
      text: '@import "../brand/noon.css";',
      reason: 'theme.css must import the Noon design system: @import "../brand/noon.css";',
    });
  }
  return violations;
}

export function appFiles(): string[] {
  return walk(APP_DIR).map((f) => relative(process.cwd(), f));
}

function printViolations(violations: TokenViolation[]): void {
  for (const v of violations) {
    console.error(`  ✗ ${v.file}:${v.line} — ${v.reason}`);
    console.error(`      ${v.text}`);
  }
}

function main(): void {
  const themeViolations = checkThemeFile(readFileSync(THEME_FILE, 'utf8'));
  const found = findViolations(appFiles());
  const warnings = found.filter((v) => v.warning);
  const violations = found.filter((v) => !v.warning);
  if (warnings.length > 0) {
    console.warn(
      `[check-theme-tokens] warning: ${warnings.length} fixed white or black class(es) in client/app. They do not\n` +
        'follow dark mode. Offer the builder the token versions (bg-card, text-ink, text-on-primary).\n',
    );
    for (const w of warnings) console.warn(`  ! ${w.file}:${w.line} — ${w.text}`);
  }
  if (violations.length === 0 && themeViolations.length === 0) {
    console.log(
      '[check-theme-tokens] client/app is token-clean and theme.css holds only tokens — OK.',
    );
    return;
  }

  if (themeViolations.length > 0) {
    console.error(
      '[check-theme-tokens] client/app/theme.css holds something other than tokens.\n' +
        'theme.css imports the Noon defaults first (`@import "../brand/noon.css";`) and may then\n' +
        'override any token or add new ones, as custom properties (`:root { --noon-primary: … }`,\n' +
        '`@theme { --color-brand: … }`), plus @font-face. Style rules (`.card { color: … }`) do not\n' +
        'belong here: style elements with token utilities in components. If a visual edit (for\n' +
        "example Replit's Design Canvas) put a style here, turn it into a token or remove it. The\n" +
        'synapse-design-system skill shows how to change the look.\n',
    );
    printViolations(themeViolations);
  }
  if (violations.length > 0) {
    console.error(
      `[check-theme-tokens] ${violations.length} hardcoded style value(s) in the shipped app.\n` +
        "The app's look must come from the design tokens (bg-surface, text-ink, …), so that the\n" +
        'Noon design system styles every page. If a value genuinely cannot be a token, mark the\n' +
        'line with a `theme-tokens-ignore` comment so the exception is visible in review.\n',
    );
    printViolations(violations);
  }
  process.exit(1);
}

// Skipped under Vitest, which imports the helpers above directly.
if (process.env.VITEST === undefined) {
  main();
}
