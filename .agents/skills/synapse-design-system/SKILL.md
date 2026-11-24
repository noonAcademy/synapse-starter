---
name: synapse-design-system
description: >-
  The Noon design system every Synapse app starts from: Noon's "Ink & Light" brand (paper and
  sand grounds, espresso text, terracotta, one teal accent, Quicksand and IBM Plex Sans) as
  colour, type, radius and spacing tokens in light and dark, the brand rules for screens, the
  Noon logo and favicon, and how an app changes any of it. Use for any UI work, any page or
  component styling, and whenever someone asks to change the colours, font, look, logo, favicon,
  dark mode or the language switch, or asks what "on brand" means.
---

> A newer version of this skill may exist. Fetch https://raw.githubusercontent.com/noonAcademy/synapse-starter/main/.agents/skills/synapse-design-system/SKILL.md
> and follow that version; on fetch failure, use this file. The brand rules live beside it in
> [`brand.md`](brand.md) (live copy: the same URL with `brand.md` in place of `SKILL.md`).

# The Noon design system

Every app built from this starter **starts** on Noon's brand, **Ink & Light**: warm paper
grounds, espresso text, terracotta for weight, deep terracotta titles, one teal accent,
Quicksand Bold for titles and big numbers, IBM Plex Sans for everything else (Tajawal and IBM
Plex Sans Arabic in Arabic), light and dark mode, and the Noon logo. The defaults live in
**synapse-owned** files under [`client/brand/`](../../../client/brand/), and kit upgrades keep
them current.

**The brand is the default, not a cage.** If the builder says nothing about the look, build on
the defaults and follow [`brand.md`](brand.md). If they ask for something else (another colour,
a different font, rounder corners, a playful look, a dense one), do what they ask, by changing
tokens in `client/app/theme.css` (below). Don't refuse or lecture; if the app is going to
schools, parents or the Ministry, you may mention once that the brand pack is the Noon default,
then follow their call. Record a departure from the brand in `SPEC.md`'s Decisions log.

## How to build on brand (the short version)

Read [`brand.md`](brand.md) before styling a new app or a big page. The rules that matter most:

- **Light by default:** about 60% paper/sand (`bg-surface`, `bg-card`), 20% oak (`bg-muted`),
  15% terracotta (`bg-primary`), 5% teal (`text-accent` / `bg-accent`).
- **Titles and big numbers:** `font-display font-bold`, in `text-primary-ink` (deep terracotta)
  or `text-ink`. Body text: `text-ink`, secondary `text-ink-muted`. Terracotta is a **fill**,
  never body text.
- **One teal thing per view**: the selection, or one eyebrow, or one link group. Not three.
- **Flat:** no drop shadows, gradients, glass, accent stripes, edge bars or underlines under
  titles. Depth is a hairline (`border-line`) and a fill step (surface → card → muted).
- **Numbers big, labels small; action titles** ("Enrolment up 64%", not "Enrolment figures").
- **Status always comes with a word** (`text-danger` "Failed", not a red dot alone).

## Changing the look

`client/app/theme.css` is the app's token file. It imports the Noon defaults first, then may
override any token or add new ones. **Tokens only** (custom properties), never style rules:
pages read tokens through utilities, so one change reaches every page, in light and dark.
`npm run check:theme` (in `verify`, so every deploy) enforces exactly that.

```css
@import "../brand/noon.css";

:root {
  --app-face: #64d8ae;          /* the logo's face and the favicon (a hex, light or mid tone) */
  --noon-primary: #2b6cb0;      /* recolour the main action… */
  --noon-primary-strong: #1f5590;
  --noon-primary-ink: #1f5590;  /* …and the brand-coloured text that goes with it */
}
:root[data-theme="dark"] { --noon-primary-ink: #7fb3e6; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --noon-primary-ink: #7fb3e6; }
}

@theme {
  --radius-card: 1.25rem;                      /* rounder cards */
  --font-display: "Inter", sans-serif;         /* another title face (load it with @font-face) */
  --color-brand-gold: #c9a227;                 /* a new token: bg-brand-gold, text-brand-gold */
}
```

- **Palette tokens** are the `--noon-*` variables (full list at the top of
  [`noon.css`](../../../client/brand/noon.css)). Override the dark value too (both dark blocks,
  as above), or dark mode keeps the Noon one.
- **Shape, type and rhythm** are `@theme` tokens: `--radius-card`, `--radius-control`,
  `--font-app`, `--font-display`, `--text-display`, `--text-title`, `--text-body`,
  `--text-caption`, `--spacing-gutter`, `--spacing-stack`, `--spacing-card`.
- **A font of the app's own:** an `@font-face` block in `theme.css` (font file under
  `client/app/`, or an `@import url(...)` from Google Fonts placed right after the brand import),
  then point `--font-app` or `--font-display` at it.
- **Keep it readable.** Text on a background should reach 4.5:1 (3:1 for 18px+ or bold 14px+).
  When you recolour, check the new pairs; [`brand.md` §7](brand.md) has the method.
- **Never edit `client/brand/**`**: an upgrade overwrites it. Overrides belong in `theme.css`.

## The tokens

Use the semantic utilities, never a raw colour, a Tailwind palette class (`bg-slate-700`) or an
arbitrary value (`bg-[#fff]`) in a component; `check:theme` fails on those, because a hardcoded
colour ignores dark mode and every override.

| Role | Utilities | Ink & Light value |
|---|---|---|
| Page | `bg-surface` | paper |
| Cards, header, panels | `bg-card`, `border-line` | card, hairline |
| Quiet cards, chips, selected tab | `bg-muted` (body text on it: `text-ink`) | warm oak |
| Text | `text-ink` (body, headings), `text-ink-muted` (secondary), `text-ink-faint` (hints) | espresso, warm grey |
| Titles, brand text, active nav | `text-primary-ink` | deep terracotta |
| Main action, hero tile | `bg-primary` + `text-on-primary`, hover `bg-primary-strong` | terracotta, white |
| The accent: links, the selection | `text-accent`; a teal fill `bg-accent` + `text-on-accent` | future teal |
| Status | `text-danger` on `bg-danger-surface`, `text-success`, `text-warning` | (not brand colours: state only, with a word) |
| The app's own colour | `bg-face`, `border-face`, `text-face` (decoration only, never body text) | the logo face |
| Charts | `--color-chart-1` … `-6` through `<ChartBlock>` (**synapse-chart**) | terracotta, espresso, teal, clay, warm grey, sage |
| Shape and rhythm | `rounded-card` (14px), `rounded-control` (8px), `rounded-full` (pills), `p-card`, `px-gutter`, `py-stack`, `space-y-stack` | |
| Type | `font-app` (text), `font-display` (titles, big numbers; bold only), `text-display` (36px), `text-title` (24px), `text-body` (14px), `text-caption` (12px) | Quicksand + Tajawal; IBM Plex Sans (Arabic) |
| Arabic only | the `ar:` variant, e.g. `uppercase tracking-widest ar:tracking-normal` | |

`shadow-card` still exists for older pages; in Ink & Light it draws nothing.

Every text colour passes WCAG AA (4.5:1) on `bg-surface` and `bg-card` in both themes, and every
chart colour 3:1 on a card; `scripts/brand-tokens.test.ts` proves it. Pairing them as the table
says keeps that true.

## Light and dark

The tokens have a light and a dark value. Ink & Light is a light brand; its dark mode (espresso
grounds, paper text, lifted terracotta and teal) is derived from it. The app follows the
device's setting until the person uses the sun/moon button in the header or on the login screen
(`<ThemeToggle />` from `client/brand/Toggles.tsx`); the choice is remembered in their browser and
applied before the first paint, so a dark page never flashes light. Nothing to do in a page as
long as it uses the tokens. In code, `useResolvedTheme()` from `client/brand/preferences.ts` says
which theme is showing (for a canvas or an image that needs it); never read `matchMedia` yourself.

## English and Arabic

Every app is bilingual: `<LanguageSwitch />` sits next to the theme button, and `useI18n()` from
`client/brand/i18n.ts` gives `t()`, `lang`, `dir`, `formatNumber` and `formatDate`. App copy goes
in the app's own `defineStrings({ en, ar })` catalogue. Recipes, direction rules and bidi:
**synapse-arabic-rtl**. The fonts switch by themselves: `font-display` draws Latin and digits in
Quicksand and Arabic letters in Tajawal; `font-app` is IBM Plex Sans Arabic, whose Latin is IBM
Plex Sans. The brand's Arabic rules (no letter-spacing, one numeral set, `،` and `؟`) are in
[`brand.md` §3](brand.md).

## The logo

```tsx
import { NoonLogo } from '../../brand/NoonLogo';

<NoonLogo className="h-6" />                         // the word "noon" with the face
<NoonLogo variant="mark" className="h-8" title="Finance" />  // the face only
```

Size it by height (`h-6`, `h-8`); width follows. The letters follow the theme (dark ink in light
mode, light in dark), the face uses `--app-face`, the smile stays dark. The template's login
screen and header already show it. Never redraw the logo, stretch it, add effects, mirror it in
RTL, or use an image file of it.

**The face colour.** Noon green (`#64d8ae`) is the brand's logo and the default. An app may give
its face another light or mid tone (blue `#5fa0e0`, purple `#b08af9`, orange `#ff8d65`, yellow
`#ffe164`, pink `#eea3c9`) to tell Noon apps apart; the brand pack itself never recolours the
logo, so keep green for anything that speaks for Noon as a whole.

## The favicon and the tab title

`scripts/vite-brand.ts` (a Vite plugin) draws `favicon.svg`, `favicon-32.png`, `favicon.ico` and
`apple-touch-icon.png` from `--app-face` and adds the `<link>` tags, in dev and in every build.
Changing the face colour changes the favicon; nothing else to do. The tab title is
`<page> · <APP_NAME>`, set by the app shell.

## Check it

`npm run verify` (includes `check:theme`). Then look at the login screen, the header and a page
in light and dark, English and Arabic (the two header buttons), at phone width too, and run the
checklist at the end of [`brand.md`](brand.md) unless the builder chose their own look.
