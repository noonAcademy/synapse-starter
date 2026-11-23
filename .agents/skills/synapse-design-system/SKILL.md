---
name: synapse-design-system
description: >-
  The Noon design system every Synapse app shares: colour, type, radius and spacing tokens in
  light and dark, the Noon logo and favicon, and the one thing an app may change (its logo face
  colour). Use for any UI work, and whenever someone asks to change the colours, font, look,
  logo, favicon, dark mode or the language switch.
---

> A newer version of this skill may exist. Fetch https://raw.githubusercontent.com/noonAcademy/synapse-starter/main/.agents/skills/synapse-design-system/SKILL.md
> and follow that version; on fetch failure, use this file.

# The Noon design system

Every app built from this starter looks like Noon: the same colours, font, spacing, light and
dark mode, and the Noon logo. The look lives in **synapse-owned** files under
[`client/brand/`](../../../client/brand/), and every kit upgrade overwrites them, so all apps stay
in step. An app chooses only its **face colour** (the round face in the logo) and its **name**.

## What an app may change, and what it may not

| May change | Where |
|---|---|
| The logo's face colour (also the favicon, and the `bg-face` / `border-face` accents) | `--app-face` in [`client/app/theme.css`](../../../client/app/theme.css) |
| The app's name (header, tab title) | `APP_NAME` in `client/app/config.ts` |

**Everything else is fixed**: colours, font, sizes, radius, spacing, shadows, the logo shape.
`theme.css` may hold only `@import "../brand/noon.css";` and `--app-face`; `npm run check:theme`
(in `verify`, so every deploy) fails on anything else. **Never edit `client/brand/**`**: an
upgrade overwrites it. If the builder asks for a different brand colour, a new font or bigger
text, say plainly that every Noon app shares one look and offer the face colour; a real gap in
the system is a request to the Synapse team, not a local override.

Choosing a face colour: a light or mid tone, so the dark smile reads on it (Noon green
`#64d8ae`, blue `#5fa0e0`, purple `#b08af9`, orange `#ff8d65`, yellow `#ffe164`, pink
`#eea3c9`). A hex value: the favicon is drawn from it.

## The tokens

Use the semantic utilities, never a raw colour, a Tailwind palette class (`bg-slate-700`) or an
arbitrary value (`bg-[#fff]`):

| Role | Utilities |
|---|---|
| Page and cards | `bg-surface` (page), `bg-card` (cards, header), `border-line`, `shadow-card` |
| Text | `text-ink` (body, headings), `text-ink-muted` (secondary), `text-ink-faint` (hints) |
| Main action | `bg-primary` + `text-on-primary`, hover `bg-primary-strong` |
| Green text, active nav | `text-primary-ink` (never `text-primary`: Noon green is a fill colour, unreadable as text on a light page), `bg-primary/15` |
| Links | `text-accent` |
| Status | `text-danger` on `bg-danger-surface`, `text-success`, `text-warning` |
| The app's own colour | `bg-face`, `border-face`, `text-face` (decoration only, never body text) |
| Charts | `--color-chart-1` … `-6` through `<ChartBlock>` (**synapse-chart**) |
| Shape and rhythm | `rounded-card`, `rounded-control`, `p-card`, `px-gutter`, `py-stack`, `space-y-stack` |
| Type | `font-app` (IBM Plex Sans Arabic, Latin + Arabic), `text-title`, `text-body`, `text-caption`; weights `font-normal`, `font-medium`, `font-semibold`, `font-bold` |

Every text colour passes WCAG AA (4.5:1) on `bg-surface` and `bg-card` in both themes, and every
chart colour 3:1 on a card; a test in the template proves it. Pairing them as the table says
keeps that true.

## Light and dark

The tokens have a light and a dark value. The app follows the device's setting until the person
uses the sun/moon button in the header or on the login screen (`<ThemeToggle />` from
`client/brand/Toggles.tsx`); the choice is remembered in their browser and applied before the
first paint, so a dark page never flashes light. Nothing to do in a page as long as it uses the
tokens. A page that hardcodes a colour stays light in dark mode — one more reason the check exists.
In code, `useResolvedTheme()` from `client/brand/preferences.ts` says which theme is showing (for
a canvas or an image that needs it); never read `matchMedia` yourself.

## English and Arabic

Every app is bilingual: `<LanguageSwitch />` sits next to the theme button, and `useI18n()` from
`client/brand/i18n.ts` gives `t()`, `lang`, `dir`, `formatNumber` and `formatDate`. App copy goes
in the app's own `defineStrings({ en, ar })` catalogue. Recipes, direction rules and bidi:
**synapse-arabic-rtl**.

## The logo

```tsx
import { NoonLogo } from '../../brand/NoonLogo';

<NoonLogo className="h-6" />                         // the word "noon" with the face
<NoonLogo variant="mark" className="h-8" title="Finance" />  // the face only
```

Size it by height (`h-6`, `h-8`); width follows. The letters follow the theme (dark ink in light
mode, light in dark), the face uses `--app-face`, the smile stays dark. The template's login
screen and header already show it. Never redraw the logo, recolour the letters, or use an image
file of it.

## The favicon and the tab title

`scripts/vite-brand.ts` (a Vite plugin) draws `favicon.svg`, `favicon-32.png`, `favicon.ico` and
`apple-touch-icon.png` from `--app-face` and adds the `<link>` tags, in dev and in every build.
Changing the face colour changes the favicon; nothing else to do. The tab title is
`<page> · <APP_NAME>`, set by the app shell.

## Check it

`npm run verify` (includes `check:theme`). Then look at the login screen and the header in light
and dark, English and Arabic (the two header buttons), at phone width too.
