// Enforce the convention that keeps every app on the Noon design system: the shipped app's look
// lives in design tokens (client/brand/noon.css, plus the one `--app-face` in client/app/theme.css),
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
// theme.css gets its own, stricter check (checkThemeFile). The Noon design system lives in the
// synapse-owned client/brand/noon.css, which upgrades keep in sync; theme.css may only import it
// and set the app's one choice, its logo face colour (`--app-face`). Any other value there would
// fork the app away from the shared Noon look, so it fails here.

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
// A hex colour only: the favicon is drawn from it (scripts/brand-icons.ts).
const FACE_DECLARATION = /^--app-face\s*:\s*#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\s*;?$/;
const ALLOWED_SELECTORS = new Set([':root']);
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

// Checks client/app/theme.css: only the brand import and `--app-face` blocks are allowed.
export function checkThemeFile(css: string, file = THEME_FILE): TokenViolation[] {
  const violations: TokenViolation[] = [];
  // Blank out comments but keep their newlines, so reported line numbers stay right.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const fail = (index: number, text: string, reason: string) => {
    const line = source.slice(0, index).split('\n').length;
    violations.push({ file, line, text: text.trim().slice(0, 100), reason });
  };

  let hasImport = false;
  let seenRule = false;
  let index = 0;
  const statement = /\s*([^{};]+;|[^{};]+\{[^{}]*\})/y;
  while (index < source.length) {
    if (source.slice(index).trim() === '') break;
    statement.lastIndex = index;
    const match = statement.exec(source);
    if (!match?.[1]) {
      fail(index, source.slice(index, index + 100), 'cannot read this part of theme.css');
      break;
    }
    const text = match[1].trim();
    const start = match.index + match[0].indexOf(match[1]);
    index = statement.lastIndex;
    if (text.startsWith('@import')) {
      if (!BRAND_IMPORT.test(text))
        fail(start, text, 'theme.css may import only "../brand/noon.css"');
      // CSS ignores an @import that comes after a rule, which would drop the whole design system.
      else if (seenRule) fail(start, text, 'the @import must come first in theme.css');
      else hasImport = true;
      continue;
    }
    seenRule = true;
    const open = text.indexOf('{');
    if (open === -1) {
      fail(start, text, 'theme.css may only set --app-face inside :root { }');
      continue;
    }
    const selector = text.slice(0, open).trim().replace(/\s+/g, ' ');
    if (!ALLOWED_SELECTORS.has(selector)) {
      fail(
        start,
        text,
        `"${selector}" is not allowed in theme.css — the Noon look lives in client/brand/noon.css; an app sets only --app-face`,
      );
      continue;
    }
    const body = text.slice(open + 1, -1);
    for (const declaration of body.split(';')) {
      const trimmed = declaration.trim();
      if (trimmed === '') continue;
      const at = start + open + 1 + body.indexOf(trimmed);
      if (!FACE_DECLARATION.test(trimmed)) {
        fail(
          at,
          trimmed,
          'theme.css may set only --app-face, as a hex colour — every other token comes from client/brand/noon.css',
        );
        continue;
      }
      const face = trimmed.match(/#[0-9a-fA-F]+/)?.[0] ?? '';
      if (smileContrast(face) < MIN_SMILE_CONTRAST) {
        fail(
          at,
          trimmed,
          `--app-face ${face} is too dark for the logo's dark smile (contrast ${smileContrast(face).toFixed(1)}:1, needs ${MIN_SMILE_CONTRAST}:1) — pick a light or mid tone`,
        );
      }
    }
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
      '[check-theme-tokens] client/app is token-clean and theme.css sets only --app-face — OK.',
    );
    return;
  }

  if (themeViolations.length > 0) {
    console.error(
      `[check-theme-tokens] client/app/theme.css changes the Noon design system.\n` +
        'Every Synapse app shares one Noon look (client/brand/noon.css, kept in sync by kit\n' +
        'upgrades). theme.css may only `@import "../brand/noon.css";` and set `--app-face` (the\n' +
        "logo's face colour) in `:root { }`. If a visual edit (for example Replit's Design Canvas)\n" +
        'put a colour, font or size here, remove it and keep only --app-face. The\n' +
        'synapse-design-system skill says what an app may change.\n',
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
