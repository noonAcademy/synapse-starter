# UPGRADES.md — the template change log, one entry per version

Every `TEMPLATE_VERSION` bump appends one entry here: what changed, why a clone should care,
and the exact recipe to adopt it. An agent upgrading a clone follows [`UPGRADE.md`](UPGRADE.md),
which applies the pending entries below. Maintainers: the rules for adding an entry are in
[`RELEASING.md`](RELEASING.md).

## The laws of this file

1. **Append-only.** Entries are never edited after they ship (typo fixes excepted) — clones
   that already applied one must be able to trust what it said. New entries go on top.
2. **Versions are `YYYY.MM.DD`**, with a `.N` suffix when one day ships twice
   (`2026.07.16`, then `2026.07.16.2`). Compare versions **numerically, part by part** —
   never as strings (`.10` sorts after `.2`).
3. **Single hop.** Recipe file copies come from the template's **current `main`** — there are
   no per-version snapshots. When several entries are pending, their copy steps naturally
   converge on the same files; run every entry's *commands and guided edits* in order
   (oldest pending → newest), and let the copies land wherever they land.
4. **Every step is an "ensure", not a "do".** Recipes are idempotent: each step states its
   guard ("if X is absent…", "if the file still contains Y…") and skips itself when already
   satisfied. A clone of unknown vintage — or a re-run after a failure — must be safe.
5. **Copy steps may list only synapse-owned paths** ([`.synapse/ownership.json`](.synapse/ownership.json)).
   Shared paths change only via guided edits. Builder-owned paths appear in a recipe only as
   "create if missing" — never as an edit or overwrite.

---

## 2026.11.24.6 — Noon's Ink & Light brand as the default look, and freedom to change it

### What changed

Apps used to share one locked look (the noon-apps product palette) and could change only the
logo's face colour. Now every app **starts** on Noon's brand, **Ink & Light**, and the builder may
change any part of it through tokens.

- **[`client/brand/noon.css`](client/brand/noon.css)** (synapse-owned): the default tokens are now
  Ink & Light. Paper page (`#f7f1e6`), card `#fdfbf6`, hairline borders, espresso text
  (`#3a2318`), warm grey secondary text, terracotta main action (`#b75c38`), deep terracotta
  titles and active nav (`text-primary-ink`, `#9c4a26`), future teal accent and links
  (`#647067`), a derived dark mode (espresso grounds, paper text), and the brand chart series
  (terracotta, espresso, teal, clay, warm grey, sage). Radius 14px on cards. No card shadow
  (`shadow-card` still exists and draws nothing). Same utility names, so existing pages keep
  working; they just change colour.
- **New tokens:** `bg-muted` (warm oak: quiet cards, chips), `bg-accent` + `text-on-accent` (a
  teal fill), `font-display` (Quicksand Bold for Latin and digits, Tajawal Bold for Arabic
  letters), `text-display` (36px hero numbers), and the `ar:` variant
  (`tracking-widest ar:tracking-normal`, since Arabic is never letter-spaced). Quicksand and
  Tajawal are vendored in `client/brand/fonts/` under the SIL OFL (`OFL-Quicksand.txt`,
  `OFL-Tajawal.txt`). `scripts/brand-tokens.test.ts` proves every text pair passes AA in both
  themes, now including text on teal and on oak.
- **`client/app/theme.css` (shared) may hold any token again.** After
  `@import "../brand/noon.css";` it may override any `--noon-*` colour, any `@theme` token
  (`--font-display`, `--radius-card`, …), add tokens of its own, and declare `@font-face`. What
  `npm run check:theme` still fails on: a missing or late brand import, a **style rule**
  (`.card { color: … }`), a declaration outside a block, and a `--app-face` that isn't a hex in
  `:root` (the favicon is drawn from it). Components still may not hardcode colours.
- **Skill [synapse-design-system](.agents/skills/synapse-design-system/SKILL.md)** rewritten:
  the brand is the default, the builder's ask wins, how to override tokens; new
  [`brand.md`](.agents/skills/synapse-design-system/brand.md) beside it holds the Ink & Light
  rules translated for screens (colour roles and proportions, type, Arabic and RTL, charts,
  imagery, voice, measured contrast, the hard don'ts, a checklist) with a link to the full pack
  on Noon's Drive. The plan-first and Arabic skills, AGENTS.md and `.synapse/ownership.json`
  follow.
- **Noon's illustrations** in [`client/brand/illustrations/`](client/brand/illustrations/)
  (synapse-owned): the 38-SVG character cast from the brand pack (12 standing figures, 7 for the
  Pakistan programme, 8 poses, 9 scenes, the doodle kit), plus a `bg-art-ground` token that stays
  light in dark mode so their espresso outlines stay visible. Which one to use, and how:
  `brand.md` §5a. `biome.json` (synapse-owned) skips that folder: the files are artwork shown
  through `<img alt>`, and Biome would otherwise ask each SVG for a `<title>`.
- `ChartBlock` (synapse-owned): Ink & Light fallback colours and solid hairline gridlines.
- Template's own app files (builder-owned in clones): page and sign-in titles use
  `font-display font-bold text-primary-ink`, the header name `font-display`, and the home page's
  step numbers are deep terracotta instead of teal (one teal thing per view). `SPEC.md`'s Look &
  feel prompt mentions the brand default.

### Why a clone should care

The app's colours, title font and card shadows change: it moves from the mint-green product
look to Noon's brand. **Tell the builder before you run this, and show them the result.** A
builder who prefers the old look can keep it (step 2). Builders can also now restyle their app
freely through `theme.css`.

### Recipe

1. **Before copying anything, ask the builder:** "Noon's apps now default to the Ink & Light brand
   (warm paper, terracotta, Quicksand titles). Move to it, or keep your current colours?" If
   they want to keep the old colours, save the old palette now, inside the clone (`*.local` is
   git-ignored, and unlike `/tmp` it survives a restart, so a retried upgrade can reuse it):
   `git show HEAD:client/brand/noon.css > .synapse-noon-old.css.local`. Guard: skip if
   `.synapse-noon-old.css.local` already exists and contains `--noon-primary: #64d8ae` (an
   earlier attempt saved it); otherwise run it only if `git show HEAD:client/brand/noon.css`
   contains `--noon-primary: #64d8ae`. Reading from `HEAD` rather than the working copy keeps
   this right on a retry where the new `noon.css` has already been copied in, as long as the
   upgrade isn't committed yet.

2. **Copy** (synapse-owned):

   ```bash
   mkdir -p client/brand/fonts .agents/skills/synapse-design-system
   cp -R <template>/client/brand/. client/brand/
   for f in scripts/check-theme-tokens.ts scripts/check-theme-tokens.test.ts \
            scripts/brand-tokens.test.ts client/app/blocks/ChartBlock.tsx .synapse/ownership.json \
            .agents/skills/synapse-design-system/SKILL.md .agents/skills/synapse-design-system/brand.md \
            .agents/skills/synapse-plan-first/SKILL.md .agents/skills/synapse-arabic-rtl/SKILL.md \
            biome.json AGENTS.md; do
## 2026.11.24.5 — your app takes over `/` once its first page is built; the console moves to `/synapse-starter`

### What changed

- **The workspace's `/` follows the app's progress.** A fresh clone still opens on the Synapse
  console at `/`. Once the builder's first page exists, `/` renders their app — the same page end
  users land on in a deployment — and the console lives at **`/synapse-starter`**.
- **"First page built"** is read off the source by
  [`server/app-built.ts`](server/app-built.ts), the same way `server/setup.ts` reads `SPEC.md`:
  `client/app/pages/home.tsx` no longer renders `<NotBuiltYet />` (or is gone), or any other page
  file sits next to it (anything but `home.tsx`, `synapse.tsx`, `index.ts` and tests). An
  unreadable directory counts as not built, so the console stays at `/`.
- `/__synapse/overview` gains **`appBuilt: boolean`**. The client's mode probe
  ([`client/useSynapseMode.ts`](client/useSynapseMode.ts)) already fetches that route, so the
  decision costs no extra request: it renders the console when the path is `/synapse-starter`
  (`CONSOLE_PATH`) or the app is not built, and the app otherwise. A published deployment never
  renders the console at any path, `/synapse-starter` included.
- `?surface=app` and `?surface=console` still force either surface, in either state. **Preview
  your app ↗** and the app's `/synapse` page link back keep using them.
- `npm run workspace-key` prints `<origin>/synapse-starter#synapse_key=…`, so the unlock link
  opens the console whether or not the app has a page yet.
- AGENTS.md rule 9, the README's "two surfaces" section and **synapse-access-control** describe
  the new behaviour.

### Why a clone should care

The builder stops landing on the console after they have an app, and `/` in the webview shows
what users will see. **A clone that already has pages changes behaviour at once:** after this
upgrade its webview opens on the app, not the console. Tell the builder before you finish: the
console is now at `/synapse-starter` (or ⚙ Synapse in the app footer → **Open the builder
console**).

### Recipe

1. **Copy** (synapse-owned):

   ```bash
   for f in server/app-built.ts server/app-built.test.ts client/useSynapseMode.ts \
            client/useSynapseMode.test.tsx client/main.tsx client/console/ConsoleApp.tsx \
            client/app/pages/synapse.tsx scripts/workspace-key.ts README.md AGENTS.md \
            .agents/skills/synapse-access-control/SKILL.md; do
     cp "<template>/$f" "$f"
   done
   ```

   **Guided edit — `client/app/theme.css` (shared).** Nothing is required: a file holding the
   import and `--app-face` passes the new check. Keep the builder's `--app-face`. You may replace
   the comment block at the top with the template's (it now explains overrides). If in step 1
   the builder chose to keep the old colours, copy the `--noon-*` lines from the three palette
   blocks of `.synapse-noon-old.css.local` into `theme.css` under the import, in the same three selectors
   (`:root`, `:root[data-theme="dark"]`, and `:root:not([data-theme="light"])` inside
   `@media (prefers-color-scheme: dark)`), and add `@theme { --radius-card: 0.75rem; }` and
   `:root { --noon-shadow-card: 0 1px 2px rgb(20 20 20 / 0.06); }` (dark:
   `0 1px 2px rgb(0 0 0 / 0.4)`) for the old shape. Record the choice in SPEC.md's Decisions log.
   Delete `.synapse-noon-old.css.local` only after `npm run check:theme` passes on the edited
   `theme.css`.

3. **After the upgrade, as app work — not part of this recipe.** Law 5 keeps upgrades out of
   builder-owned files. Tell the builder what the template's own app files now do, and make each
   change only if they say yes (skip all of it if they kept the old look):
   - Titles in the brand face: `font-display font-bold text-primary-ink` on the page `<h2>` in
     `client/app/pages/home.tsx` and the sign-in `<h1>` in `client/app/LoginScreen.tsx`;
     `font-display font-bold` on the app name in `client/app/AppShell.tsx`. The same on the
     builder's own page titles and big numbers.
   - One teal thing per view: `text-accent` is now teal. If a page uses it for several things
     (the template's home page did, for its step numbers), keep it for links or the selection and
     use `text-primary-ink` for the rest: `grep -rn "text-accent" client/app`.
   - `shadow-card` now draws nothing; nothing to do unless the builder misses it.
   The template's versions of these files show the exact code.

### Verify

- `npm run verify` green, including `[check-theme-tokens] client/app is token-clean and
  theme.css holds only tokens — OK`.
- The app (`?surface=app`) shows a paper background, a terracotta sign-in button and Quicksand
  titles (or the old look, if the builder kept it); in dark mode, espresso grounds with paper text,
  charts included; in Arabic, titles in Tajawal with digits still in Quicksand.
- `ls client/brand/illustrations/*.svg | wc -l` prints `38`.
- Add `:root { --noon-primary: #2b6cb0; }` to `theme.css`: `npm run check:theme` passes and the
  sign-in button turns blue. Add `.card { color: red; }`: the check fails naming that line. Undo
  both.

---
2. **Guided edit — `server/index.ts`** (shared). Skip if the `/__synapse/overview` handler already
   sends `appBuilt`. Otherwise:
   - add `import { isAppBuilt } from './app-built.js';` with the other local imports;
   - in the `/__synapse/overview` handler, send the overview with the flag added, keeping the
     `buildOverview({...})` arguments exactly as the clone has them:

     ```ts
     res.json({
       ...buildOverview({ /* unchanged */ }),
       appBuilt: isAppBuilt(resolve(here, '../client/app/pages')),
     });
     ```

   Touch nothing else in the file; the access gate and every builder route stay as they are.

3. **No builder-owned file changes.** `client/app/` (including `home.tsx` and
   `AppShell.test.tsx`) is untouched: the detection reads those files, it never edits them.

### Verify

- `npm run verify` green.
- `curl -s -H @.synapse-workspace.headers.local localhost:3000/__synapse/overview` includes
  `"appBuilt":false` while `home.tsx` still renders `<NotBuiltYet />` and no other page exists,
  and `"appBuilt":true` otherwise. (Kits from `2026.11.24.2` need the header; it is in every kit
  this entry can apply to.)
- In the workspace, after unlocking with the `npm run workspace-key` link: `/synapse-starter`
  shows the console. `/` shows the console if `appBuilt` is false and the app if it is true. A
  page change in `client/app/pages/` is picked up on the next reload; no restart needed.

## 2026.11.24.4 — dark mode and English/Arabic for every Synapse app

### What changed

- **A light/dark button** (`<ThemeToggle />`) and **an English/Arabic switch**
  (`<LanguageSwitch />`), both in [`client/brand/Toggles.tsx`](client/brand/Toggles.tsx). The theme
  follows the device until the person chooses; both choices are remembered in their browser
  (`localStorage` keys `noon.theme`, `noon.lang`) — per browser, because the choice must work on
  the login screen too, before anyone is signed in.
- **No flash on load:** the Vite plugin (`scripts/vite-brand.ts`) puts a small inline script at
  the top of `<head>` that sets `data-theme`, `lang` and `dir` on `<html>` before any CSS or app
  code runs. [`client/brand/preferences.ts`](client/brand/preferences.ts) applies the same keys
  at start-up (`client/main.tsx`) and follows system changes.
- **A small i18n helper**, [`client/brand/i18n.ts`](client/brand/i18n.ts): `useI18n()` gives
  `t()`, `lang`, `dir`, `setLang`, `formatNumber` (Western digits in Arabic) and `formatDate`
  (Gregorian); `defineStrings({ en, ar })` types an app's own catalogue (TypeScript fails on a
  missing Arabic key; a blank one falls back to English). The starter's own strings — login,
  header, not-found, the home placeholder — are in [`client/brand/strings.ts`](client/brand/strings.ts)
  in English and Arabic.
- **Default language = the `lang` on `<html>`** in `client/index.html`, so a clone that already
  set `lang="ar" dir="rtl"` stays Arabic-first. `<html data-fixed-lang>` marks a one-language
  app: a stored choice is then ignored.
- **The data blocks speak both languages:** `ViewBlock` and `ChartBlock` show their loading,
  empty and error states, "Updated …" (with `Intl.RelativeTimeFormat`) and "Show the numbers" in
  the chosen language; `ChartBlock` mirrors when the language changes and formats numbers in the
  app's language (Western digits in Arabic) rather than the browser's.
- Preferences keep working where the browser blocks storage (kept in memory until a reload),
  follow a change made in another tab, and the switches are 44 px touch targets.
- The console stays English, left-to-right and light whatever the app's choices: it pins `<html>`
  to `lang="en" dir="ltr" data-theme="light"`, and its tab is titled "Synapse console".
- Tailwind's `dark:` variant follows the same switch (`@custom-variant dark` on `data-theme`).
- Template app files (builder-owned in clones): the login screen and header show both buttons
  and read their copy from `t()`; the not-found state links home; the home placeholder is
  translated.
- Skills: **synapse-arabic-rtl** rewritten around the switch and `useI18n` (no more hand-set
  `dir` in React; one-language apps remove the switch), **synapse-design-system** gains the dark
  and language sections, **synapse-plan-first** asks for the default language.

### Why a clone should care

Every Noon app gets dark mode and Arabic the same way, and the agent stops hand-rolling RTL per
app. **Two things change at once, before step 3:** the copied `ViewBlock` / `ChartBlock` speak the
language on `<html lang>` (a clone with `lang="ar"` gets Arabic block copy and mirrored charts),
and `dir` now follows `lang` (a clone with `lang="ar"` but no `dir="rtl"` turns right-to-left —
check its layout; a clone with `dir="rtl"` but `lang="en"` or no `lang` turns left-to-right — set
`lang="ar"` in `client/index.html`).

### Recipe

1. **Copy** (synapse-owned):

   ```bash
   for f in client/brand/noon.css client/brand/preferences.ts client/brand/preferences.test.tsx client/brand/i18n.ts \
            client/brand/strings.ts client/brand/Toggles.tsx scripts/vite-brand.ts \
            scripts/brand-icons.test.ts client/main.tsx client/console/ConsoleApp.tsx \
            client/console/WorkspaceLock.tsx client/app/blocks/ViewBlock.tsx \
            client/app/blocks/ChartBlock.tsx .agents/skills/synapse-arabic-rtl/SKILL.md \
            .agents/skills/synapse-design-system/SKILL.md .agents/skills/synapse-plan-first/SKILL.md \
            AGENTS.md; do
     cp "<template>/$f" "$f"
   done
   ```

2. **No edit to `client/index.html`** is needed: the head script is injected at build time. Keep
   its `lang`/`dir` — they are the app's default language now. If the app is meant to stay in one
   language, ask the builder whether to add `data-fixed-lang` to `<html>` (a shared-file guided
   edit; keep everything else).

3. **After the upgrade, as app work — not part of this recipe** (law 5 keeps upgrades out of
   builder-owned files). Offer it, and make each change only if the builder says yes: add
   `<LanguageSwitch />` and `<ThemeToggle />`
   to the header in `client/app/AppShell.tsx` and to the top corner of
   `client/app/LoginScreen.tsx`, and move the login copy to `t()` (the template's versions show
   the exact code). For a one-language app, add only `<ThemeToggle />`. If the builder's pages
   have English-only copy and they want Arabic, move it into a `defineStrings` catalogue
   (**synapse-arabic-rtl**) and have a fluent reader check it.

### Verify

- `npm run verify` green.
- If the builder added `<ThemeToggle />`: in the app (`?surface=app`) the moon button turns the
  page dark, and a reload stays dark with no light flash.
- If the builder added `<LanguageSwitch />`: `العربية` turns the page Arabic and right-to-left,
  and a reload stays Arabic.
- Whatever the builder chose, in a private window (no saved `noon.theme` or `noon.lang`): with
  the device in dark mode the app opens dark (`document.documentElement.dataset.theme` is
  `dark`); with `lang="ar"` on `<html>` the page is right-to-left (`dir` is `rtl`), and any data
  block on it shows its loading, empty and error states in Arabic (an app with no `ViewBlock` or
  `ChartBlock` skips that part). Unless `data-fixed-lang` is set, a saved Arabic choice
  (`localStorage.setItem('noon.lang', 'ar')`, then reload) does the same on an English `<html>`.
- `curl -s localhost:3000/ | head -5` shows the inline `<script>` first in `<head>`.
- The console (workspace `/`) stays English, left-to-right and light after both switches.

---

## 2026.11.24.3 — one Noon design system: tokens, font, logo and favicon

### What changed

Every app used to restyle itself in `client/app/theme.css` (three presets, any token), so no two
Synapse apps looked alike and none looked like Noon. Now every app shares one Noon look, kept in
sync by upgrades, and chooses only its logo's face colour.

- **[`client/brand/noon.css`](client/brand/noon.css)** (new, synapse-owned — `client/brand/**`
  joins `synapseOwned`): the Noon palette from noon-apps, in **light and dark** (dark follows the
  device setting), as CSS variables behind the **same utility names** the starter always had
  (`bg-surface`, `bg-card`, `text-ink`, `rounded-card`, `p-card`, …), so existing pages keep
  working. New: `text-primary-ink` (green text), `bg-face` / `border-face` (the app's colour),
  `shadow-card`. Radius 12/8 px, type 24/14/12 px, 8-point spacing. Font: **IBM Plex Sans
  Arabic** (Latin + Arabic), vendored in `client/brand/fonts/` under the SIL Open Font Licence
  (`OFL.txt` alongside). A few text and chart colours are darker than noon-apps so every text
  pair passes WCAG AA and every chart colour 3:1 (`scripts/brand-tokens.test.ts`).
- **`client/app/theme.css` (shared) shrinks** to `@import "../brand/noon.css";` and one value,
  `--app-face`. **`npm run check:theme` now fails on anything else in it** (any other token,
  selector, `@theme` block or import), with a message that says what to do — including after a
  Design Canvas edit. The presets are gone.
- **[`client/brand/NoonLogo.tsx`](client/brand/NoonLogo.tsx)**: the Noon logo (`variant="full"`)
  and the face-only mark (`variant="mark"`); the face takes `--app-face`, the letters follow the
  theme.
- **Favicons from the face colour**: [`scripts/vite-brand.ts`](scripts/vite-brand.ts) (wired in
  `vite.config.ts`) draws `favicon.svg`, `favicon-32.png`, `favicon.ico` and
  `apple-touch-icon.png` with [`scripts/brand-icons.ts`](scripts/brand-icons.ts) (pure Node, no
  new dependency) and injects the `<link>` tags.
- **`ChartBlock`** reads the palette from the design system and re-reads it when the theme
  changes. The splash in `client/main.tsx` uses `bg-surface`.
- Template's own app files (builder-owned in clones): the login screen and header show the logo,
  the active nav uses `text-primary-ink`, cards use `shadow-card`, the tab title is
  `<page> · <APP_NAME>`, and `client/index.html`'s title is `noon`.
- New skill **synapse-design-system**; AGENTS.md Conventions, skills table and "Where things
  live", and the chart, add-page, plan-first and Arabic skills point at it.

### Why a clone should care

The app joins the shared Noon look (and dark mode) and gets the logo and favicon. **This changes
how the app looks** — tell the builder before you run it, and show them the result.

### Recipe

1. **Copy** (synapse-owned):

   ```bash
   mkdir -p client/brand/fonts .agents/skills/synapse-design-system
   cp -R <template>/client/brand/. client/brand/
   for f in scripts/brand-icons.ts scripts/brand-icons.test.ts scripts/brand-tokens.test.ts \
            scripts/vite-brand.ts scripts/check-theme-tokens.ts scripts/check-theme-tokens.test.ts \
            client/main.tsx client/app/blocks/ChartBlock.tsx client/console/ConsoleApp.tsx \
            client/console/WorkspaceLock.tsx .synapse/ownership.json \
            .agents/skills/synapse-design-system/SKILL.md .agents/skills/synapse-chart/SKILL.md \
            .agents/skills/synapse-add-page/SKILL.md .agents/skills/synapse-plan-first/SKILL.md \
            .agents/skills/synapse-arabic-rtl/SKILL.md AGENTS.md; do
     cp "<template>/$f" "$f"
   done
   ```

   **Guided edit — `vite.config.ts`** (it may hold the builder's own plugins, so never copy it
   over): if it does not contain `noonBrand(`, add
   `import { noonBrand } from './scripts/vite-brand.js';` and, in `plugins`,
   `noonBrand({ themeCssPath: resolve(here, 'client/app/theme.css') })` (with the `here` and
   `resolve` lines from the template's `vite.config.ts` if the file lacks them). Keep everything else.

2. **Guided edit — `client/app/theme.css` (shared). Do it in the same step as the copy above**:
   the new `check:theme` fails on the old file, and a deploy runs it. Run
   `npx tsx scripts/check-theme-tokens.ts`; if it reports any `client/app/theme.css` problem (the
   import missing or not first, or any token other than `--app-face`, even after the import), do
   this step. If the file already sets `--app-face`, keep that colour and skip the colour question:
   - **This step is the one exception to "preserve the builder's additions"** for shared paths,
     written into `.synapse/ownership.json` and AGENTS.md "Who owns what" in this version: one
     shared design system means the builder's own tokens cannot stay. Say so to the builder
     before you edit, and list what will go.
   - Ask which colour the face in their logo should be (a hex colour). Offer Noon green
     (`#64d8ae`), or their current `--color-primary` if it is a light or mid tone.
   - Note every token name the old file defined that `client/brand/noon.css` does not (for
     example `--color-brand`). Then replace the file with the template's `theme.css`, with
     `--app-face` set to the chosen colour.
   - For each noted token, `grep -rn "<utility>" client/app` (for `--color-brand`: `bg-brand`,
     `text-brand`, `border-brand`, …), and also `grep -rn "var(--<token>" client` for direct uses
     (for `--color-brand`: `var(--color-brand`). Nothing fails when a token disappears — the class
     or `var()` just stops styling — so these searches are the only way to find them. Tell the builder each hit; changing
     it to the nearest Noon token is app work (step 4).

3. **Guided edit — `client/index.html` (shared):** if the `<title>` is still `Synapse starter`,
   make it `noon`. Keep everything else (`dir`, `lang`, the builder's tags).

4. **After the upgrade, as app work — not part of this recipe.** Law 5 keeps upgrades out of
   builder-owned files, so do none of this automatically. Tell the builder what the template's
   own app files now do, and make each change only if they say yes:
   - `client/app/LoginScreen.tsx`: `<NoonLogo className="mx-auto h-8" />` instead of the text
     logo. `client/app/AppShell.tsx`: `<NoonLogo className="h-6" />` before `APP_NAME`, and
     `document.title`. `client/app/ui.tsx`: `shadow-sm` → `shadow-card`.
   - **Green text.** Noon green (`--color-primary`) is a fill colour; as text on the light page
     it is unreadable. The template's old `AppShell` used `text-primary` for the active nav item.
     Run `grep -rnE "text-primary([^-]|$)" client/app` and suggest `text-primary-ink` for each hit
     — tell the builder this one is a readability fix, not a style choice.
   - **White and black.** `bg-white` / `text-black` stay fixed while `text-ink` and `bg-card` flip
     in dark mode, and `text-white` on `bg-primary` is white on light green. `npm run check:theme`
     prints them as warnings and does not fail on them, so `verify` stays green until the builder
     decides. Run `grep -rnE "(bg|text|border)-(white|black)" client/app` and suggest
     `bg-card`, `text-ink` or `text-on-primary` for each hit.
   The template's versions of these files show the exact code.

### Verify

- `npm run verify` green, including `[check-theme-tokens] … theme.css sets only --app-face — OK`.
- `npm run build` lists `favicon.svg`, `favicon-32.png`, `favicon.ico`, `apple-touch-icon.png`.
- The app (`?surface=app`) shows Noon colours and the IBM Plex font; with the device in dark mode
  it turns dark, charts included. The browser tab shows the face in the app's colour.
- Add `--color-primary: #ff0000;` inside `:root` in `theme.css`: `npm run check:theme` fails
  naming that line. Undo.

---

## 2026.11.24.2 — no anonymous API in any mode: one access gate, a workspace key, and `check:api`

### What changed

Until now the "Sign in with Noon" gate was mounted only in a deployment, and only part-way down
`buildApp`. In the **workspace** (Replit Run, the preview, `npm run dev`) nothing was gated:
`/api/views/:name`, `/api/events` and every `/__synapse/*` route — including `/__synapse/probe`,
which runs **any SELECT on Noon's warehouse** — answered anyone who could reach the dev URL.
Replit dev URLs are private by default, but one click makes them public, and the app cannot see
that switch. A route a builder added above the old gate line was also ungated in a deployment.

- **One access gate, first, in every mode** ([`server/access-gate.ts`](server/access-gate.ts)).
  `buildApp` installs it before any route, so every route — including the ones a builder adds
  later — is behind it. Paths are compared in lower case (Express matches `/API/views` to
  `/api/views`).
  - **Deployment:** unchanged behaviour (sign-in routes, then a session on everything; static
    assets and `GET /health` open; `503` when auth config is missing), now also honouring the
    public list below.
  - **Workspace:** pages and assets stay open; every `/api` and `/__synapse` request, and every
    non-GET request, needs the **builder's workspace key** in the `x-synapse-workspace-key`
    header. Only in `npm run dev` off Replit (a laptop), a direct call from the same machine also
    passes; never in `npm start`, where a reverse proxy would make every request look local. Anyone else gets `401 {"code":"workspace_locked"}`.
- **The workspace key** ([`server/workspace-key.ts`](server/workspace-key.ts)): created on first
  boot in `.synapse-workspace-key.local` (git-ignored by `*.local`, bound to `REPL_ID` so a fork
  gets its own), plus `.synapse-workspace.headers.local` for `curl -H @…`. `npm run workspace-key`
  prints the browser unlock link (`/#synapse_key=…` — a fragment, so it never reaches a proxy
  log); `-- --rotate` makes a new key. Vite's dev file server now denies `**/*.local`.
- **Browser side:** [`client/workspaceKey.ts`](client/workspaceKey.ts) stores the key from the
  link or the lock screen's paste field and adds it to same-origin `/api` and `/__synapse` fetches (a header, because the Replit
  webview is a cross-site iframe where cookies are blocked). `useSynapseMode` gains a `locked`
  state, and `main.tsx` shows a lock screen ([`client/console/WorkspaceLock.tsx`](client/console/WorkspaceLock.tsx))
  before either surface, `?surface=app` included. The console's "view raw registry" link is now
  a button that fetches with the key, **Preview your app ↗** carries the key to its new tab, and
  `npm run visual` sends it too.
- **Public routes** ([`server/public-routes.ts`](server/public-routes.ts), **shared**, empty): the
  only way past the gate — method, exact path, and a reason.
- **`npm run check:api`** ([`scripts/check-api-gate.ts`](scripts/check-api-gate.ts)), added to
  `npm run verify` and to the console's verify chip: builds the app in both modes, replaces every
  handler with a stub, calls every route anonymously (lower and upper case) and fails if a stub
  answers; calls each public route for real and fails when its JSON has a field named like
  personal data; fails on a route outside `/api/`, a route before the gate, a second
  server/`express()` in `server/`, or a WebSocket upgrade handler. `server/index.ts` skips
  `main()` when `SYNAPSE_SKIP_MAIN` is set, so the check never binds a port or publishes.
- **Docs:** AGENTS.md rule 9 corrected (the workspace is not open), new rule 10, skills table and
  "Where things live"; **synapse-access-control** gains "No anonymous data, ever"; the
  **synapse-verify-numbers** and SQL skills' `curl` calls send the key. Kit-compatibility header
  → `2026.11.24.2`.

### Why a clone should care

Without this, a clone whose dev URL is public (or is made public to show a colleague) serves
Noon data — and an anonymous SQL console on the warehouse — to anyone with the link. Adopt it.

**What changes for the builder:** each browser that opens the console or the app preview must be
unlocked once (`npm run workspace-key`, open the link). The Agent's `curl` calls need the
`-H @.synapse-workspace.headers.local` header (the skills say so). A deployment is unchanged for
signed-in users.

### Recipe

0. **Check first, before any copy:** if `vite.config.ts` sets `server.fs.strict: false`, stop
   and ask the builder whether they still need it. Vite then ignores `fs.deny`, so anyone with
   the dev URL could read the workspace key through `/@fs/`. Do not change it without their yes,
   and do not start this upgrade while it stays `false`.

1. **Copy** (synapse-owned):

   ```bash
   for f in server/access-gate.ts server/workspace-key.ts server/workspace-key.test.ts \
            server/auth-routes.ts server/verify.ts server/index.test.ts server/setup.test.ts \
            scripts/check-api-gate.ts scripts/check-api-gate.test.ts scripts/workspace-key.ts \
            client/workspaceKey.ts client/workspaceKey.test.tsx client/main.tsx \
            client/useSynapseMode.ts client/useSynapseMode.test.tsx \
            client/console/WorkspaceLock.tsx client/console/WorkspaceLock.test.tsx \
            client/console/GetDataTab.tsx \
            client/console/GetDataTab.test.tsx client/console/ConsoleApp.tsx \
            scripts/visual-check.ts .synapse/ownership.json \
            .agents/skills/synapse-access-control/SKILL.md \
            .agents/skills/synapse-verify-numbers/SKILL.md skill/SKILL.md AGENTS.md README.md; do
     cp "<template>/$f" "$f"
   done
   ```

   **Guided edit — `vite.config.ts`** (it may hold the builder's own changes, so never copy it
   over): ensure `server.fs.deny` lists `'**/*.local'` and `'**/.synapse-visual/**'` besides
   Vite's defaults (`'.env'`, `'.env.*'`, `'*.{crt,pem}'`, `'**/.git/**'`), as in the template's
   `vite.config.ts`. Add only what is missing; keep everything else in the file.

2. **Create if missing** `server/public-routes.ts` (copy the template's). If the clone has one,
   leave it.

3. **Guided edit — `server/index.ts` (shared).** Ensure each of these; skip any already true:
   - Imports: `import { type GateMode, installAccessGate } from './access-gate.js';` and
     `import { loadWorkspaceKey } from './workspace-key.js';`; drop `installEndUserAuth` from the
     `./auth-routes.js` import.
   - Next to `isReplitDeployment`: the template's `replId`, `onReplit` and `trustLocalCalls`
     constants.
   - `buildApp`'s options gain `workspaceKey?: string; trustLocalCalls?: boolean;`, and **the first
     lines after `const app = express();`** are the template's `const gate: GateMode = …;
     installAccessGate(app, gate);` block.
   - **Delete** the old block that starts `if (opts.isReplitDeployment) { if (opts.authDeps) {
     installEndUserAuth(...)` (and its 503 fallback) — the gate does both now.
   - **Move any route the builder registered above the new gate line to below it**, and any
     data route outside `/api/` to a path under `/api/` (update its client fetch). Routes the
     builder added stay otherwise untouched.
   - In `createServerInstance`, before `buildApp`: the template's `workspaceKey` /
     `loadWorkspaceKey` lines and the boot log; pass `workspaceKey, trustLocalCalls` to `buildApp`.
   - The last line becomes `if (!process.env.VITEST && !process.env.SYNAPSE_SKIP_MAIN) {`.

4. **Guided edit — `package.json` (shared).** Ensure scripts
   `"check:api": "tsx scripts/check-api-gate.ts"` and
   `"workspace-key": "tsx scripts/workspace-key.ts"`, and that `verify` ends with
   `&& npm run check:api`. Keep the builder's other scripts.

5. **If the builder's own client code fetches `/api/*` with something other than `fetch`**
   (`EventSource`, `navigator.sendBeacon`, a plain `<a href="/api/…">`), tell them it cannot carry
   the workspace key in the workspace; offer to switch it to `fetch`.

### Verify

- `npm run verify` green, including `[check-api-gate] … OK`.
- On Replit, restart the app. In a browser with no key, `/` shows **This workspace is locked to
  you**; after opening the link from `npm run workspace-key`, the console loads, and
  **Preview your app ↗** shows the app with its data. (With `npm run dev` on a laptop, a browser
  on the same machine passes without a key and the console loads at once; a browser on another
  machine sees the lock screen.)
- From the Replit Shell: `curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/__synapse/overview`
  prints `401`; with `-H @.synapse-workspace.headers.local` it prints `200`. (With `npm run dev`
  on a laptop the plain call prints `200`.)
- From another machine, `curl -s -o /dev/null -w '%{http_code}\n' https://<dev-domain>/api/views`
  prints `401`, also as `/API/views`.
- `git status` does not list `.synapse-workspace-key.local` or `.synapse-workspace.headers.local`.

---

## 2026.11.24 — `npm install` passes on Replit again (Package Firewall)

### What changed

Replit's Package Firewall is always on. It blocks package versions with known vulnerabilities,
and it can't be configured or given an allow-list. Three tarballs in the template's lockfile are
on its block list, so `npm install` on a fresh clone failed with a 403:

| Package | Was | Now | Why it is in the tree |
|---|---|---|---|
| `vite` | 6.4.3 | 6.4.6 | direct dependency (`^6.0.7` → `^6.4.6`) |
| `proxy-addr` | 2.0.7 | 2.0.8 | through `express` (`~2.0.7`), lockfile refresh only |
| `tinypool` | 1.1.1 | 2.2.0 | through `vitest` 3.2.x (`^1.1.1`), new `overrides` entry `"tinypool": "^2.1.2"` |

Every `tinypool` 1.x is blocked, and `vitest` 3.2.x asks for `^1.1.1`. The override moves it to
2.x and keeps `vitest` on 3.2.7: the full test suite passes on the forks pool (the default) and
on the threads pool. A `vitest` major upgrade was not necessary. No other package version
changes in the lockfile.

[`AGENTS.md`](AGENTS.md) Conventions also changes. It said not to commit `package-lock.json`,
but the template commits one (see the README). It now says to commit the lockfile. A new rule
says that a dependency bump is done only when `npm install` still passes on Replit.

### Why a clone should care

A clone on the old lockfile can't run `npm install` on Replit. The 403 names one of the
packages above. Adopt this entry if you see that error, or before you add any dependency (an
install that adds a package fetches the whole tree again). Runtime behaviour doesn't change.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `AGENTS.md`.
2. **Guided edit — `package.json`** (shared; skip any part already true; leave builder-added
   dependencies, scripts and overrides alone):
   - If `dependencies.vite` is a `6.x` range lower than `^6.4.6`, set it to `"^6.4.6"`. Leave a
     `7.x` or later range as it is.
   - If `overrides` has no `tinypool` entry and `npm ls tinypool` (or `package-lock.json`)
     shows `tinypool` 1.x or 2.0.0–2.1.1, add `"tinypool": "^2.1.2"` to `overrides`. This is
     the case for `vitest` 3.x (and 2.x). `vitest` 4 and later has no `tinypool` dependency,
     so this edit does nothing there. Keep the three `@noonacademy/*` entries in `overrides`
     the same as in `dependencies`.
   - If `overrides` already has a `tinypool` entry that allows only versions below 2.1.2 (for
     example `"2.1.1"` or `"^1.1.1"`), set it to `"^2.1.2"`, and tell the builder: every such
     version is blocked, so this is the one builder override the recipe changes. Leave an entry
     that already allows 2.1.2 or later as it is. Only when this step (or the one above) sets the
     override, and the builder also lists `tinypool` in `dependencies` or `devDependencies`, set
     that direct range to the same `"^2.1.2"`, with their yes: npm fails with `EOVERRIDE` when a
     direct dependency and its override disagree. Never change one of the two alone.
3. **Regenerate the lockfile** without fetching tarballs (the firewall blocks tarballs, not
   package metadata), then install:

   ```bash
   npm install --package-lock-only --ignore-scripts
   # Only while the lockfile still locks a blocked version (this prints a match). It reads the
   # locked versions, so it works when the lockfile has no `resolved` URLs.
   npm ls proxy-addr tinypool --all --package-lock-only 2>/dev/null \
     | grep -E 'proxy-addr@2\.0\.[1-7]( |$)|tinypool@(1\.|2\.0\.|2\.1\.[01]( |$))' \
     && npm update proxy-addr tinypool --package-lock-only --ignore-scripts
   npm install
   ```

   If `npm install` still gets a 403, the message names the blocked tarball. Move that package
   to a newer version the same way (a range, an override, or `npm update <name>`): a patch if
   one is allowed, otherwise a minor or major, then run `npm run verify`. Don't downgrade it.

### Verify

- The full `npm install` (not only the Run button's `--omit=dev` one) passes on Replit with no
  403.
- `npm ls vite proxy-addr tinypool` shows `vite@6.4.6` (or later) and `proxy-addr@2.0.8`. If
  `tinypool` is in the tree (`vitest` 3.x or 2.x), it is `tinypool@2.x`, 2.1.2 or later; a clone on
  `vitest` 4 or later has no `tinypool`, which is fine.
- This prints nothing:

  ```bash
  grep -E 'vite-6\.4\.[345]\.tgz|proxy-addr-2\.0\.[1-7]\.tgz|tinypool-(1\.|2\.0\.|2\.1\.[01]\.tgz)' package-lock.json
  ```

- `npm run verify` green.
- `TEMPLATE_VERSION` reads `2026.11.24`.

---

## 2026.11.23 — a rejected key no longer says "press Run again"

### What changed

When Citadel answered the boot publish with **401**, Home's *Connected to Noon* check read
*"Last publish failed_permanent: publishEvent failed: 401."* and told the builder to **press Run
again**. That advice can't work: the SDK never retries a 401, and a re-run signs the same request
with the same keys. The message also didn't say which Citadel refused the keys, and the usual
cause is exactly that: keys created on one Citadel (staging or production) while
`SYNAPSE_BASE_URL` points at the other.

- [`server/overview.ts`](server/overview.ts): `connection` gains an optional `reason`.
  `'credentials'` is a 401. `'rejected'` is any other permanent failure (400/403/422). It is
  absent when connected, while nothing has settled yet, and for dropped (transient) failures. On
  a 401 the detail now names the host: *"citadel.staging.noonedu.io didn't accept this app's
  keys (publishEvent failed: 401)."*
- [`client/console/HomeTab.tsx`](client/console/HomeTab.tsx): the fix line follows the reason.
  - On a 401 it sends the builder to `<baseUrl>/portal/replit-apps` to check that the app is
    listed there under its App ID, warns that keys from the other Citadel won't work, and asks
    them to paste the secret again with no spaces or quotes.
  - Any other permanent failure goes straight to **synapse-error-report**.
  - Only failures with no reason keep "Press Run again".

  A payload with no `reason` (an older server) still gets the old generic fix.

### Why a clone should care

Adopt it if the builder has ever seen a red *Connected to Noon* with a 401. Without it, the
console sends them round a loop: re-run, still red, then an error report for a problem they
could have fixed in the portal. This entry changes no runtime behaviour, no auth, and no
builder-owned file.

### Recipe

1. **Copy** (all synapse-owned, safe to overwrite):

   ```bash
   cp <template>/server/overview.ts server/overview.ts
   cp <template>/server/overview.test.ts server/overview.test.ts
   cp <template>/client/console/HomeTab.tsx client/console/HomeTab.tsx
   cp <template>/client/console/HomeTab.test.tsx client/console/HomeTab.test.tsx
   ```

   No shared or builder-owned path changes. `server/index.ts` already serves the projection as is.

### Verify

- `npm run verify` green.
- Set `SYNAPSE_APP_SECRET` to a wrong value and press Run. *Connected to Noon* goes red and names
  the Citadel host. Its fix line points at `/portal/replit-apps` and does **not** say "Press Run
  again". Restore the real secret, press Run, and the check goes green with an `eventId`.
- `TEMPLATE_VERSION` reads `2026.11.23`.

---

## 2026.11.17 — the console shows the app, and says when sign-in isn't configured

### What changed

Two things the starter already supported were reachable only by reading the README, so in
practice builders hit both as surprises. Both are now visible in the console itself.

- **"Preview your app ↗" in the console header.** The workspace webview at `/` always renders
  the console — `useSynapseMode` resolves to `workspace` wherever the `/__synapse/*` routes are
  mounted, and nothing about finishing the app flips it. The way through was the `?surface=app`
  query param, documented in [`README.md`](README.md) and in a code comment and nowhere a
  builder was looking, so a freshly built app looked absent until it was deployed. The link
  opens the shipped app in a new tab (the console survives the click; the app's `/synapse` page
  already carried the `?surface=console` link back).
- **Deploy readiness is reported, not just documented.** `APP_OAUTH_REDIRECT_URI` and
  `APP_SESSION_SECRET` gate the deployed "Sign in with Noon" flow, and a deployment missing
  either **fails closed** — a 503 on every request, with the cause only in the deployment log.
  Nothing in the console mentioned them (Settings named `SYNAPSE_APP_ID` / `SYNAPSE_APP_SECRET`
  only), so the first publish of a clone could be a 503 wall. Now `/__synapse/setup` carries the
  pair, and the console surfaces it two ways:
  - **Home** grows a quiet notice — *"Before you deploy: sign-in isn't configured yet"* — naming
    what's missing, the `openssl rand -hex 32` command, the callback-URL shape, and the portal
    registration step (pointed at the Citadel the app is actually connected to). It disappears
    once all four values are set.
  - **Settings → Deployment sign-in** always shows their set/not-set state, including a missing
    `SYNAPSE_*` key that this section doesn't itself list (the gate needs it, so the card names
    it rather than showing "needed before you deploy" above two green pills).
- **Secrets now carry a `scope`** (`'run' | 'deploy'`) in the `/__synapse/setup` projection, plus
  a `deploy: { ready, missing }` verdict that deliberately mirrors `authConfigError` in
  [`server/synapse.ts`](server/synapse.ts) — all four names, since the OAuth calls are HMAC-signed
  with the `SYNAPSE_*` pair. The Home checklist's "Secrets present" row filters to `run` scope, so
  **a deploy-only gap never turns a check red**: a workspace nobody has deployed is not broken, and
  a red row there would send the builder after a problem they don't have yet. A secret with no
  `scope` (an older server) is read as `run`, and a payload with no `deploy` renders no notice.
- **[`AGENTS.md`](AGENTS.md) gains rule 9** — the two questions builders ask ("where is my app?",
  "is it protected?"), with the answers stated so an agent stops implying a workspace app has a
  login, or that a deployment is protected before those secrets exist.

Presence only, as before: no endpoint, notice or pill ever carries a secret's value, and the
agent neither holds nor mints one.

### Why a clone should care

Nothing is broken without this — it changes no runtime behaviour, no auth boundary, and no
builder-owned file. Adopt it if the builder has ever asked where their app is in the workspace,
or if the clone is heading for its first deployment.

**What it does not catch**, so nobody reads the green state as a guarantee: the check is
*presence in the workspace environment*. A deployment carries its own copy of the secrets, so a
value set here and absent there still 503s with no notice — confirm them at publish time. And a
callback URL that isn't registered in the Citadel portal, or doesn't match
`APP_OAUTH_REDIRECT_URI` exactly, fails *differently*: the gate mounts, the login screen appears,
and sign-in then fails at Citadel. Nothing local can see that.

### Recipe

1. **Copy** (all synapse-owned, safe to overwrite):

   ```bash
   cp <template>/server/setup.ts server/setup.ts
   cp <template>/server/setup.test.ts server/setup.test.ts
   cp <template>/client/console/ConsoleApp.tsx client/console/ConsoleApp.tsx
   cp <template>/client/console/ConsoleApp.test.tsx client/console/ConsoleApp.test.tsx
   cp <template>/client/console/HomeTab.tsx client/console/HomeTab.tsx
   cp <template>/client/console/HomeTab.test.tsx client/console/HomeTab.test.tsx
   cp <template>/client/console/SettingsTab.tsx client/console/SettingsTab.tsx
   cp <template>/README.md README.md
   cp <template>/AGENTS.md AGENTS.md
   ```

   If the clone's `server/index.ts` was modified by the builder, leave it alone — this entry
   needs no change there (`/__synapse/setup` already passes `process.env` to `buildSetup`).

2. **Ensure `.env.example` documents the pair** (it has since `2026.07.16`; guard, not a change).
   If the `# --- Sign in with Noon` block is absent, copy the template's `.env.example` — unless
   the builder has added their own entries, in which case append the block by hand.

3. **No secrets to set as part of this upgrade.** The notice appearing on Home is the *correct*
   state for a clone that hasn't configured deployment sign-in; it is information, not a failure.
   Tell the operator what it asks for (they hold the values, you don't) and leave it at that.

### Verify

- `npm run verify` green.
- The console header shows **Preview your app ↗**, and it opens the shipped app (not the console)
  in a new tab.
- With `APP_SESSION_SECRET` unset, Home shows *"Before you deploy: sign-in isn't configured yet"*
  naming `APP_SESSION_SECRET`, **and the four numbered checks stay green**. Settings →
  Deployment sign-in shows it as `not set`.
- `curl -s localhost:5000/__synapse/setup` includes `"scope":"deploy"` and a `deploy` verdict —
  and no secret values.
- With only `SYNAPSE_APP_SECRET` unset, **Settings → Deployment sign-in** names it, rather than
  showing "Needed before you deploy" above two `set` pills.
- `TEMPLATE_VERSION` reads `2026.11.17`.

---

## 2026.09.07 — the existing-app path stops needing a GitHub token

### What changed

The template went tokenless in `2026.08.02` — the three `@noonacademy/*` packages became
committed tarballs under `vendor/`, wired through `dependencies` + `overrides`. But
[`INTEGRATE.md`](INTEGRATE.md) and [`MIGRATE-SYNC.md`](MIGRATE-SYNC.md) were never brought
along: both still sent **existing apps** through `npm.pkg.github.com` with a `GITHUB_TOKEN`,
and both opened by telling the agent it needed "exactly four secrets".

So every integration walked into a credential the template itself had already deleted — and
when GitHub answered `401`, the guides offered nothing to diagnose with. The observed failure
mode is an agent stalling mid-integration re-checking `read:packages` scopes, which a `401`
does not test: `401` is rejection *at authentication*, before scope is evaluated (insufficient
scope is `403`). The token was never the shortest path to a working install.

- **Gate 4 is now the vendored recipe**, matching what the starter does: copy the three
  tarballs, declare them as `file:` specs in `dependencies` **and** `overrides`, verify with
  `env -u GITHUB_TOKEN npm install`. The overrides are called out as load-bearing —
  `@noonacademy/synapse-sdk` declares its two siblings as semver ranges (`^0.3.0`, `^0.1.0`),
  so without an override those resolve from the registry and reintroduce the exact 401.
- **pnpm is named.** `overrides` is npm syntax; pnpm needs `pnpm.overrides`. The old text said
  only "npm expands `${GITHUB_TOKEN}`", which is also npm-specific and silently untrue elsewhere.
- **GitHub Packages survives as an opt-in**, folded into a `<details>` block for teams that want
  the SDK to track releases without a re-copy — now carrying a `401` vs `403` vs `200` triage
  and an explicit "fall back to vendoring rather than debug a 401".
- **The vendoring trade-off is stated**, not hidden: pinned tarballs never self-update, and a
  stale SDK against a moved Citadel contract fails without announcing itself
  (the known gap in [`scripts/sync-sdk.md`](scripts/sync-sdk.md), now inherited by integrated
  apps too — so the guide tells the agent to say so to the operator).
- **Secret counts corrected** throughout both guides: three runtime `SYNAPSE_*` secrets, not
  four. Includes the Job 0 inventory checklist, the Migration Report template, the registry-fetch
  note, and the §7 environment table — where `GITHUB_TOKEN` is now marked **not required**, with
  a pointer that a `401` there means you are on the wrong path.

### Why a clone should care

If your clone never runs `INTEGRATE.md` or `MIGRATE-SYNC.md`, this is documentation-only — your
install was already tokenless and nothing about it changes. Adopt it if you hand these guides to
an agent for another app, or if you keep `GITHUB_TOKEN` around as an install credential you no
longer need.

### Recipe

1. **Copy** (synapse-owned, safe to overwrite):

   ```bash
   cp <template>/INTEGRATE.md INTEGRATE.md
   cp <template>/MIGRATE-SYNC.md MIGRATE-SYNC.md
   ```

2. **Verify your own install is tokenless** (should already be true — this is a guard, not a
   change). If it fails, you have drifted onto the registry path and this entry's Gate 4 is
   the fix:

   ```bash
   grep npm.pkg.github.com package-lock.json   # must print nothing
   ls .npmrc 2>/dev/null                       # must not exist
   env -u GITHUB_TOKEN npm install             # must succeed
   ```

3. **Secrets cleanup (tell the operator; agents don't hold secrets):** if `GITHUB_TOKEN` is set
   in this app's secrets and step 2 passed, it is unused — it can be deleted. Leave it alone if
   anything else in the app (CI, a deploy hook) still reads it.

---

## 2026.08.24 — the console says which Citadel, and stops calling a missing toolchain a failure

### What changed

Two defects in the same class: the console reported state that wasn't true. The console is the
surface a builder checks *before* trusting a number, so a wrong word here is worse than a wrong
word anywhere else in the app.

- **The connection check named the wrong environment.** `server/overview.ts` hardcoded the word
  "staging" in `connection.detail`, so an app pointed at production via `SYNAPSE_BASE_URL` still
  read *"Last publish accepted — staging Citadel is reachable"* — in the same payload that
  correctly reported `baseUrl: https://citadel.studyatnoon.com`. One response, two contradictory
  facts. It now names the host it actually reached, taken from the `baseUrl` that was already in
  scope on that line (falling back to the raw value if it isn't a parseable URL, so the projection
  still can't throw on bad config).
- **A missing dev toolchain reported as failing code.** Replit's workspace Run is
  `npm install --omit=dev`, which skips `typescript`, `@biomejs/biome` and `vitest`. So
  `server/verify.ts` shelled `npm run typecheck`, `tsc` wasn't there, and check 4 on the Home tab
  showed **"Needs you: typecheck failing"** on a clone whose code is perfectly clean. Every clone
  saw it. A verify step now has a **`status`** of `pass` | `fail` | `unavailable` instead of a
  boolean `ok`; exit 127 (the shell's "command not found") and a failed spawn both classify as
  `unavailable`, which renders neutral — *"typecheck, lint, test couldn't run in this workspace"* —
  not red. An unavailable step also doesn't stop the chain the way a failure does: the whole
  toolchain goes missing together, and listing every affected step is what makes the cause legible.
  The deployment build runs a full `npm install`, so real failures are still caught before shipping.
- **`check:theme` added to the console's run.** `2026.08.02.6` added `check:urls` and `check:theme`
  to the `verify` script but not to `VERIFY_COMMANDS`, so the chip could say "All checks pass"
  while a hardcoded color was waiting to fail the deployment build — the same misreport class.
  `check:theme` (0.4s, and it runs fine without dev deps) is now in the chip's chain. `check:urls`
  is deliberately left out and the reason is recorded in the code: it fetches every knowledge URL
  sequentially with a 3s timeout, costing ~4s online and up to ~45s offline, which is too slow for
  something that runs on every console load. `npm run verify` still runs both.

### Why a clone should care

If you have ever pointed an app at production, your console has been telling you it was on
staging — which is exactly how someone comes to treat live figures as a safe sandbox, or waves off
a real production problem as a staging artifact. And every builder who opened the Home tab in a
Replit workspace was shown a red "typecheck failing" for a bug that did not exist.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (all synapse-owned): `server/overview.ts server/overview.test.ts
   server/verify.ts server/verify.test.ts client/console/useVerify.ts client/console/VerifyChip.tsx
   client/console/VerifyChip.test.tsx client/console/HomeTab.tsx client/console/HomeTab.test.tsx`
2. **No shared or builder-owned edits.** Nothing in `package.json`, `.replit`, or your app changes.
3. **If you read `/__synapse/verify` from your own code** (unusual — it's the console's endpoint),
   note the wire change: each step now carries `status: 'pass' | 'fail' | 'unavailable'` where it
   used to carry `ok: boolean`. `result.ok` is unchanged and still means "every step ran and
   passed". Replace `step.ok` with `step.status === 'pass'`.

### Verify

- `npm run verify` green.
- Home tab, check 2: the detail names your host (`citadel.staging.noonedu.io`, or your
  `SYNAPSE_BASE_URL`'s host) — the word "staging" no longer appears unless you are on staging.
- In a Replit **workspace**, Home tab check 4 reads **"Not run here"** with
  *"typecheck, lint, test couldn't run in this workspace"* — grey, not red — and the header chip
  reads "3 not run here". A **Deploy** build still runs all of them for real.
- `grep -rn "staging Citadel is reachable" server client` returns nothing.

---

## 2026.08.02.6 — defer to Replit where it already does the job; enforce the theme tokens it can bypass

### What changed

A correction to `2026.08.02.5`, made after checking what the Replit platform actually ships.
Two of that entry's assumptions were wrong.

- **`synapse-visual-check` is removed as a skill.** Replit's Agent browser-tests the app it
  builds — buttons, forms, links, APIs — with a purpose-built system cheaper than computer-use
  models, and Agent 4's Design Canvas previews across phone/tablet/desktop with responsive
  overrides. The skill duplicated that, and on Replit duplicated agent work spends the builder's
  credits. `scripts/visual-check.ts` and `npm run visual` **stay**, as an optional layout pass for
  the consumers Replit doesn't cover (local `npm run dev`, apps that adopted the SDK via
  INTEGRATE.md). No skill points at it, so no agent is nudged into running it on Replit.
- **New: `scripts/check-theme-tokens.ts`, wired into `verify` as `check:theme`.** Agent 4's
  Design Canvas applies visual edits **straight to the codebase without running a full agent
  loop** — nothing reads `AGENTS.md` on that path and no skill can fire. So the convention that
  keeps this app rethemeable ("restyling means editing theme.css, nothing else") had no
  enforcement against the most likely thing to break it. The check fails the build on a raw hex,
  a Tailwind palette class (`bg-slate-700`), an arbitrary value (`bg-[#fff]`), or an inline style
  anywhere in `client/app/**`. Mark a genuine exception `theme-tokens-ignore` on the line so it
  stays visible in review.
- **`AGENTS.md` rules 6–7 reworded as data dependencies, not a running order.** Agent 4 splits
  work across parallel sub-agents, so "verify the read *before* wiring it to a page" described a
  sequence that no longer holds. What holds: a page must not **ship** on an unverified read.
  Rule 7 now states the division of labour — the platform owns functional browser testing; this
  kit owns whether the number is right and whether the look still comes from tokens.
- **Every skill description cut to two lines.** Replit loads the name and description of every
  installed skill on **every chat**, so a verbose description is a context tax on every message
  the builder sends. Behaviour is unchanged; the triggers are the same, just sharper.

### Why a clone should care

You stop paying twice for browser testing, and every message costs less context. More
importantly: if anyone restyles your app on the Design Canvas, a hardcoded color can no longer
slip in silently and quietly break retheming — `verify` catches it, whoever or whatever wrote it.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `AGENTS.md .agents/skills skill/SKILL.md
   scripts/check-theme-tokens.ts scripts/check-theme-tokens.test.ts scripts/check-live-urls.test.ts
   scripts/visual-check.ts`
2. **Delete if present** (synapse-owned): `.agents/skills/synapse-visual-check/` — the whole
   directory. It is no longer part of the kit.
3. **Guided edit — `package.json`** (shared; skip any part already true): add
   `"check:theme": "tsx scripts/check-theme-tokens.ts"` under `scripts`, and make `verify` end
   with `&& npm run check:theme`. Leave builder-added scripts untouched.
4. **Run `npm run check:theme` and fix what it finds.** A clone that has been restyled by hand or
   on the Design Canvas may hold hardcoded values. Move each into a token in
   `client/app/theme.css` and point the component at the token. Only mark a line
   `theme-tokens-ignore` when the value genuinely cannot be a token (a chart library needing a
   literal color, for instance). **This is the one step here that can require real work** — budget
   for it on a clone with a customised look.

### Verify

- `npm run verify` green — it now ends with `[check-theme-tokens] client/app is token-clean — OK.`
- `.agents/skills/synapse-visual-check/` no longer exists; `npm run visual` still works.
- `grep -l "A newer version of this skill may exist" .agents/skills/*/SKILL.md` lists eleven skills.

---

## 2026.08.02.5 — six new skills, and the plumbing that makes them real

### What changed

The kit could get a number onto a screen. It had nothing that checked the number was right, that
the screen looked right, or that either stayed right. This entry closes that gap — and follows
the template's own rule that a skill without plumbing under it is just a prompt, so every skill
here ships with the code it drives.

**New skills** (`.agents/skills/`):

- **synapse-verify-numbers** — the one that matters most. Runs immediately after any read is
  written or changed, *before* it reaches a page: recount the headline figure a second
  independent way, check for join fan-out, look for a cliff in the trend, spot-check one real
  entity, then sanity-check the magnitude with the builder in plain language. A failed check
  blocks the read.
- **synapse-visual-check** — `npm run visual` drives the shipped app in a real browser at phone
  and desktop widths and asserts what a builder notices but can't articulate.
- **synapse-chart** — `<ChartBlock>`, choosing the chart form from the data's shape, and the
  rules that keep charts consistent and readable.
- **synapse-scheduled-job** — recurring work as a Replit Scheduled Deployment.
- **synapse-access-control** — who may see which view, once deployed.
- **synapse-arabic-rtl** — genuinely Arabic-first apps, not an English app pushed right.

**New plumbing** (all synapse-owned):

- **`server/probe.ts` + `POST /__synapse/probe`** — run one throwaway, read-only, uncached
  SELECT. Workspace-only, SELECT/WITH/SHOW/DESCRIBE/EXPLAIN only, single statement, 1000-row cap,
  labelled `probe: cross-check` in Citadel's read ledger. This is what makes verification
  something an agent will actually do instead of skip.
- **`server/query-cost.ts`** — boot-time warnings for reads that scan more than they need: a
  partitioned table with no `dt` filter, `SELECT *` over a fact table, a row read with no
  `LIMIT`. Athena bills by bytes scanned and the builder never sees the bill, so this is a check,
  not advice. Warnings only — a regex over SQL must never block a deploy.
- **`server/access.ts`** — roles by email/domain and which views they gate, enforced in
  `/api/views/:name` **before** the query runs. Empty in a fresh clone, so existing behaviour is
  unchanged: every signed-in staff member sees everything. Domain matching is whole-domain, never
  suffix. `/api/me` now also returns `roles` for hiding links (presentation only).
- **`server/metrics.ts`** — named metric definitions that reads declare (`export const metrics`)
  and that travel to the page with the rows, so two pages can't quietly disagree about what
  "active student" means. The machine-checkable half of SPEC.md's number table.
- **`server/jobs/`** — job registry + `npm run job -- <name>` runner, failing loudly when a
  scheduled deployment lacks its own secrets.
- **`client/app/blocks/ChartBlock.tsx`** — Recharts bound to `--color-chart-*` theme tokens,
  RTL-aware, with the figures kept reachable as a table.
- **`scripts/visual-check.ts`** — `npm run visual`. Playwright is imported on demand and is
  deliberately **not** a dependency; its ~300MB browser download would tax every clone's install
  for a check most sessions never run.
- **`ViewBlock` empty states split** — "not connected", "couldn't load", and "no data yet" are
  now three different messages rather than one "Nothing to show here yet". Collapsing them is how
  a broken app gets mistaken for a quiet week.

### Why a clone should care

Your app stops being able to show a confidently wrong number without anyone noticing, and stops
being able to ship a page nobody looked at. Charts, schedules and access rules become one-line
recipes instead of things each agent reinvents. Nothing here changes existing behaviour: the new
registries are empty, access enforces nothing, and the cost checks only warn.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `AGENTS.md .agents/skills .synapse/ownership.json
   scripts/visual-check.ts server/probe.ts server/probe.test.ts server/query-cost.ts
   server/query-cost.test.ts server/access.ts server/access.test.ts server/metrics.ts
   server/jobs client/app/blocks/ChartBlock.tsx client/app/blocks/ChartBlock.test.tsx
   server/reads.ts server/auth-routes.ts`
2. **Guided edit — `package.json`** (shared; skip any part already true): add
   `"visual": "tsx scripts/visual-check.ts"` and `"job": "tsx server/jobs/run.ts"` under
   `scripts`, and `recharts` (`^3.10.1`) under `dependencies`. Then `npm install`. Leave
   builder-added scripts and dependencies untouched.
3. **Guided edit — `server/index.ts`** (shared; skip any part already true): import
   `canAccessView`, `runProbe`, `formatCostWarnings` and `formatMetricProblems`; mount
   `POST /__synapse/probe` inside the workspace-only block; gate `/api/views` and
   `/api/views/:name` with `canAccessView(...)` using `enforceAccess = opts.isReplitDeployment`;
   and call `warnAboutCostlyReads()` + `warnAboutMetricRefs()` from the listen callback.
   Preserve every builder-added route.
4. **Guided edit — `server/queries/index.ts`** (shared): add the optional
   `metrics?: readonly string[]` field to `BakedQuery` and `QueryModule`, and carry it through
   `toBakedQuery`. Leave the builder's registered reads untouched.
5. **Guided edit — `client/app/theme.css`** (shared): add the six `--color-chart-*` tokens to
   the active `@theme` block (and to the commented presets if they're still present). If the
   builder has customised their palette, pick six distinguishable colors that suit it rather
   than pasting the template's.
6. **Create if missing** (builder-owned, never overwrite): nothing — this entry adds no
   builder-owned files.

### Verify

- `npm run verify` green.
- The probe endpoint answers in the workspace:
  `curl -s localhost:3000/__synapse/probe -H 'content-type: application/json' -d '{"sql":"SELECT 1 AS n"}'`
  returns JSON, and the same call with `{"sql":"DELETE FROM t"}` comes back with a read-only
  refusal in `error`.
- The boot log is quiet about cost for a clean app, and names the read when one is missing a
  `dt` filter.
- `grep -l "A newer version of this skill may exist" .agents/skills/*/SKILL.md` lists all
  twelve skills.
- `npm run visual` either runs, or prints the one-time Playwright setup command.

---

## 2026.08.02.4 — knowledge goes fetch-live: rulebook and skills follow the template's main

### What changed

The principle, proven by `INTEGRATE.md`: knowledge that is **fetched at use-time** never goes
stale; knowledge that is **copied at clone-time** ages from day one. This entry moves the
fastest-aging layer — `AGENTS.md` and the skills — to fetch-at-use, demoting local copies to
trigger surface + fallback. Live-data paths (`/__synapse/registry`) are untouched; this is
about rule knowledge only.

- **`replit.md` is now a fetch-first bootstrap**: the agent's first action is fetching the live
  rulebook (`https://raw.githubusercontent.com/noonAcademy/synapse-starter/main/AGENTS.md`) and
  following THAT version; on fetch failure it uses the local copy and says so in its report.
  `replit.md` stays the one must-stay-local file — pure pointers, nothing else.
- **Every skill fetches itself live at trigger time**: `skill/SKILL.md` and each
  `.agents/skills/*/SKILL.md` carry a standard two-line header — fetch the skill's raw URL and
  follow that version; on fetch failure use the local file. The same rule is stated once in
  `AGENTS.md`'s Skills section for agents that discover skills through the table.
- **`AGENTS.md` gains the kit-compatibility header** (the version-skew defense): the rules name
  the kit version they describe (`2026.08.02.3` or later). A clone whose `TEMPLATE_VERSION` is
  older or missing is told: offer the **synapse-upgrade** skill before other work, and never
  follow rules that reference files the clone doesn't have. `RELEASING.md` now documents when
  maintainers move that header version (when rules start assuming new code).
- **`AGENTS.md` gains the trust note**: live-fetched instructions are trusted because `main` is
  protected (PR-only, verify CI required) — the same trust model INTEGRATE.md has always used —
  and only `raw.githubusercontent.com/noonAcademy/synapse-starter/main/` URLs are the kit's.
- **`scripts/check-live-urls.ts` (+ test) keeps the URLs honest**, wired into `npm run verify`
  as `check:urls`: every raw URL in `replit.md`, `AGENTS.md`, and the skill files must carry
  the trusted prefix and name a path that exists in the tree (hard fail — a renamed skill
  404ing its own fetch instruction is this design's one failure mode, now un-shippable), then
  each URL is fetched with a 3s timeout — network errors skip silently (`server/kit.ts`'s
  fail-silent stance), and a non-200 for a file that exists locally is a pre-merge warning,
  never a clone-breaking failure.

### Why a clone should care

Your agent stops working from rules frozen on clone day. Rule fixes, new skills, and new
recipes reach every clone's agent on its next session — no template release, no upgrade run —
while offline sessions degrade gracefully to the local copies. And when your kit is too old for
the live rules, the agent now finds out immediately (the compatibility header) and offers the
upgrade instead of following instructions your clone can't satisfy.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `replit.md AGENTS.md RELEASING.md skill/SKILL.md
   .agents/skills scripts/check-live-urls.ts scripts/check-live-urls.test.ts`
2. **Guided edit — `package.json`** (shared; skip any part already true): under `scripts`, add
   `"check:urls": "tsx scripts/check-live-urls.ts"` and make `verify` end with
   `&& npm run check:urls`. Leave builder-added scripts untouched.

### Verify

- `npm run verify` green — its final step prints `[check-live-urls] local: … — OK.`
- The bootstrap is fetch-first: `grep -q "fetch the live rulebook" replit.md` succeeds.
- Every skill carries its header: `grep -l "A newer version of this skill may exist"
  skill/SKILL.md .agents/skills/*/SKILL.md` lists all skill files.
- The compatibility header is present: `grep -q "Kit compatibility" AGENTS.md` succeeds.

---

## 2026.08.02.3 — SDK 0.4.0: every read carries its purpose (read_context)

### What changed

- **Vendored packages refreshed**: `@noonacademy/synapse-sdk` 0.2.0 → **0.4.0** and
  `@noonacademy/citadel-transport` 0.1.0 → **0.3.0** (catalog stays 0.1.1), published from
  noon-citadel `9219e84` (tags `synapse-sdk-v0.4.0`, `citadel-transport-v0.3.0`). Tarballs under
  `vendor/`, `file:` deps + overrides updated, lockfile regenerated registry-free (a token-less
  `env -u GITHUB_TOKEN npm install` is the proof).
- **Reads now carry context.** `runAthenaQuery` accepts an optional `context`; the read path
  passes a purpose label for every baked read — `"name: title"` when ≤120 chars, else the name
  (`readContext` in `server/reads.ts`). The SDK sends it as the `x-synapse-read-context` header
  on every page, and Citadel records it as `athena_read_log.read_context` — the ledger now says
  *which read, for what* instead of just *which app*.
- **0.2.0 → 0.4.0 surface audit: fully additive.** `AthenaQueryArgs`/`AthenaQueryAllArgs` gain
  `context?`; `SynapseClientOptions` gains optional `heartbeat` + `appHost`; `buildHeaders`
  gains an optional per-call `{ readContext }` argument (existing call sites in
  `server/registry.ts` are untouched). One behavior change to know about: **the 0.4.0 client
  heartbeats by default** — a signed `GET /api/whoami` every ~5 minutes (skipped when
  `NODE_ENV=test`), giving Citadel liveness telemetry per app. No template code opts out.

### Why a clone should care

Citadel's read ledger has recorded `read_context` since 2026-07-18, but a 0.2.0 clone sends
nothing — its reads are attributable to the app, never to a specific read. After upgrading,
every ledger row names the baked read that produced it (debuggability, per-read usage, and the
platform's read-quality review all key off it), and the app reports liveness via heartbeat.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `vendor/noonacademy-synapse-sdk-0.4.0.tgz
   vendor/noonacademy-citadel-transport-0.3.0.tgz server/athena.ts server/reads.ts
   server/reads.test.ts scripts/sync-sdk.md` — then delete
   `vendor/noonacademy-synapse-sdk-0.2.0.tgz` and `vendor/noonacademy-citadel-transport-0.1.0.tgz`
   if still present.
2. **Guided edit — `package.json`** (shared; skip any part already true): point
   `@noonacademy/synapse-sdk` at `file:vendor/noonacademy-synapse-sdk-0.4.0.tgz` and
   `@noonacademy/citadel-transport` at `file:vendor/noonacademy-citadel-transport-0.3.0.tgz`
   in BOTH `dependencies` and `overrides` (they must stay identical). Leave builder deps alone.
3. **Regenerate the lockfile**: `rm -rf node_modules package-lock.json && npm install`, then
   confirm `grep npm.pkg.github.com package-lock.json` prints nothing.
4. **Builder-owned reads** (`server/queries/*.sql.ts`) are never touched — context is derived
   at run time from each read's registered `name`/`title`; no query file changes.
### Verify

- `npm run verify` green.
- The SDK is 0.4.0: `grep -q "synapse-sdk-0.4.0.tgz" package.json` succeeds and
  `grep -q "context" server/athena.ts` succeeds.
- Live proof (workspace with secrets): run one read (Views tab or
  `curl -s localhost:3000/__synapse/reads/<name>`), then check Citadel's `athena_read_log` —
  the newest row's `read_context` is the read's label.

---

## 2026.08.02.2 — registry stamp + stale-read detector

### What changed

The old `registryVersion` convention (a hand-copied literal like `'v2.21'`) said nothing
verifiable about which registry a read was actually written against. It is replaced by the
**registry stamp**: an app-computed content identity of the registry text.

- **`server/registry.ts`** — `registryStamp(text, date)`: normalized content hash (UTF-8,
  CRLF→LF, trailing newlines trimmed, SHA-256 truncated to 12 hex) plus the text's date
  (live: the response's `Last-Modified`, meta as fallback; snapshot: its `Last updated:`
  header line), as a single token `<hash12>@<YYYY-MM-DD>`. The normalization rules are a
  **frozen fleet contract** — the doc comment on the helper says exactly why and what a
  format change requires. Also: `parseStampToken`, `compareStamp`, `readsFreshness`, and the
  fetcher now captures `Last-Modified` and stamps every status it returns.
- **`GET /__synapse/registry/status`** now serves `stamp` plus per-read verdicts (`reads:
  [{ name, title, registryVersion, verdict }]`) over the reads registered in
  `server/queries/index.ts`. Verdicts: same hash → `ok`; different hash + strictly older
  date → `stale`; different hash + newer-or-equal date → `ok`; unparseable (pre-stamp
  formats like `v2.21`) or missing dates → `unknown`. Only `stale` ever surfaces.
- **`client/console/HomeTab.tsx`** — a quiet stale-reads notice in the kit-update-notice
  pattern: renders only when a read is verifiably stale, never red, nothing on any failure;
  its copy button carries a paste-to-agent message naming the reads, the noon-sql-analyst
  skill, and the current stamp.
- **`client/console/GetDataTab.tsx`** — the freshness label appends the served stamp.
- **`skill/SKILL.md` ("Bake the read") + `AGENTS.md`** — `registryVersion` is now a
  **transcription**: copy the `stamp` field from `/__synapse/registry/status` verbatim. The
  example's copyable `'v2.21'` literal is gone; agents never compute or reuse a stamp.
- **The `X-Registry-Version` header idea is formally dropped** — the stamp is app-computed
  from content, not a server-asserted version header.

### Why a clone should care

Today nothing tells a builder that a read was baked against a registry that has since
changed — wrong numbers surface as user reports, not console signals. After this, the Home
tab quietly flags provably-stale reads with a ready-made re-check prompt, and every new bake
carries a verifiable content identity instead of a folklore version string.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `server/registry.ts server/registry.test.ts
   client/console/GetDataTab.tsx client/console/GetDataTab.test.tsx client/console/HomeTab.tsx
   client/console/HomeTab.test.tsx skill/SKILL.md AGENTS.md`
2. **Guided edit — `server/index.ts`** (shared; skip if already present): import
   `readsFreshness` from `./registry.js`, and in the `/__synapse/registry/status` handler
   respond with `{ ...status, reads: readsFreshness(status.stamp, listBakedQueries()) }`
   instead of the bare status. Leave every builder-added route untouched.
3. **Builder-owned reads** (`server/queries/*.sql.ts`) are **never edited** by this upgrade.
   Existing `registryVersion` literals (`'v2.21'`-style) parse as `unknown` and stay silent —
   do not rewrite them speculatively. From now on, any newly baked or re-verified read copies
   the `stamp` from `/__synapse/registry/status` into `registryVersion`, per the skill.
### Verify

- `npm run verify` green.
- The contract is present: `grep -q "FROZEN FLEET CONTRACT" server/registry.ts` succeeds.
- With the app running, `curl -s localhost:3000/__synapse/registry/status` shows a `stamp`
  token and a `reads` array with a `verdict` per registered read.
- The skill no longer carries a copyable literal: `grep -q "paste the \"stamp\"" skill/SKILL.md`
  succeeds.

---

---

## 2026.08.02 — scope the four-secrets claim to the existing-app path (docs only)

### What changed

- **`INTEGRATE.md`** and **`MIGRATE-SYNC.md`** — both openers said "you need exactly four
  secrets… `GITHUB_TOKEN`" without scope, which read as contradicting the tokenless starter
  (three secrets, vendored tarballs — the 2026.07.16 entry). Each opener now states explicitly
  that `GITHUB_TOKEN` is an install-time credential for **existing apps** installing
  `@noonacademy/*` from GitHub Packages, and that the starter template itself is tokenless.
  The integration flow itself is unchanged — no step, gate, or secret requirement moved.

### Why a clone should care

Barely — no code or behavior changes. But these two guides are synapse-owned reference docs an
agent may read mid-session, and the unscoped claim could send a starter-based app hunting for a
`GITHUB_TOKEN` it does not need. Adopting the reworded copies removes that trap.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `INTEGRATE.md MIGRATE-SYNC.md`
### Verify

- `npm run verify` green.
- The scope is present: `grep -q "existing-app" INTEGRATE.md` and
  `grep -q "existing-app" MIGRATE-SYNC.md` both succeed.

---

## 2026.07.27 — Get-data tab browses the live registry (snapshot is the fallback)

### What changed (PR #28)

- **`GET /__synapse/tables`** now serves the registry **live-parsed from Citadel** when reachable
  (same fetch + ETag cache as `/__synapse/registry`, just structured instead of raw text), falling
  back to the committed snapshot otherwise. An `X-Tables-Source: live | snapshot` header says which.
- **`server/registryParse.ts`** (new) turns the registry **text** into the browse structures by
  regex — the text is treated as data, **never executed** (same rule the registry route follows).
  It's quote-style agnostic (the S3 master uses `"`, the snapshot uses `'`) and parses columns,
  enum values, and example queries. Proven against the real registry: a round-trip test asserts
  `parse(snapshot text)` equals the structured import, table-for-table, field-for-field.
- **Fail-safe:** the live parse is trusted only when it yields at least as many tables as the
  snapshot; a short parse (registry format drift) falls back to the snapshot rather than showing a
  truncated list — so the tab degrades to "slightly stale", never breaks.

### Why a clone should care

The Get-data tab stops browsing a catalog frozen on clone day: once Citadel serves the live
registry, new tables/columns/enums show up in the browser with no template release in between. This
completes the live-registry path started in 2026.07.16.2 (which made the agent-facing registry text
live) — now the structured browser is live too, so the committed snapshot is a pure offline fallback
you never hand-maintain.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `server/registryParse.ts server/registryParse.test.ts`
2. **Guided edit — `server/index.ts`** (shared; skip any part already present): import
   `chooseBrowseTables` from `./registryParse.js`; make the `GET /__synapse/tables` handler `async`
   — fetch `getRegistry()`, pass `{ source, text }` + `projectTables()` to `chooseBrowseTables`, set
   the `X-Tables-Source` header, and fall back to the snapshot in a `catch`. The template's
   `server/index.ts` is the reference.

### Verify

- `npm run verify` green (the round-trip parser test proves live-parse ≡ snapshot import).
- With the app running against a Citadel that serves `GET /api/registry`:
  `curl -si localhost:3000/__synapse/tables | grep -i x-tables-source` returns `live`; otherwise
  `snapshot`.

---

## 2026.07.23.3 — verify CI on template PRs (maintainer tooling; no clone action)

### What changed (PR follows #25)

- **`.github/workflows/verify.yml`** — runs `npm run verify` (secret scan · typecheck · lint ·
  tests) on every PR to `main`, guarded to `noonAcademy/synapse-starter`. Until now the only
  template CI was the release-discipline check, so a typecheck/lint/test regression could land in
  `main` unnoticed (that's how two `scripts/scan-secrets.ts` lint warnings had accumulated).
- **`scripts/scan-secrets.ts`** — applied the `useRegexLiterals` autofix (`new RegExp('…')` →
  regex literal) so the tree is warning-clean under the new gate. No behavior change.

### Why a clone should care

**It doesn't** — template-repo CI, `if:`-guarded to this repo and inert in a clone (clones run
`npm run verify` themselves before every deploy). Recorded here only because the CI gate requires
an entry for any synapse-owned change.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `.github/workflows/verify.yml scripts/scan-secrets.ts`

### Verify

- `npm run verify` green.
- `.github/workflows/verify.yml` exists and its job is guarded by
  `github.repository == 'noonAcademy/synapse-starter'`.

---

## 2026.07.23.2 — pre-push release gate (maintainer tooling; no clone action)

### What changed (PR follows #24)

Moves the release-discipline check (bump `TEMPLATE_VERSION` + append an `UPGRADES.md` entry when a
synapse-owned path changes) **earlier than CI**, so a maintainer never pushes a red PR:

- **`.githooks/pre-push`** — runs `scripts/check-template-version.ts` and blocks a violating push.
- **`scripts/setup-hooks.mjs`** + a `package.json` `prepare` script — activate the hook via
  `core.hooksPath`, but **only when origin is the template repo**, so a clone's git config is
  untouched.
- **`package.json` `check:release`** — one-command manual run of the same check.
- **`AGENTS.md`** — a loud "Definition of done for any template-repo PR" callout; **`RELEASING.md`**
  documents all three layers (authoring · pre-push · CI).

### Why a clone should care

**It doesn't** — this is template-maintainer tooling. The hook is identity-gated to
`noonAcademy/synapse-starter` and no-ops everywhere else; release discipline was never a clone's
job. This entry exists only because the CI gate (correctly) requires one for any synapse-owned
change. No behavior in a running app changes.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `.githooks/pre-push scripts/setup-hooks.mjs
   AGENTS.md RELEASING.md`
2. **Guided edit — `package.json`** (shared; skip any already present): add
   `"check:release": "tsx scripts/check-template-version.ts"` and
   `"prepare": "node scripts/setup-hooks.mjs"` under `scripts`; leave builder scripts untouched.
   (In a clone the `prepare` step self-detects a non-template origin and does nothing.)

### Verify

- `npm run verify` green.
- `npm run check:release` runs and reports OK on a clean tree.
- The hook is executable: `test -x .githooks/pre-push`.

---

## 2026.07.23 — reads paginate across pages; row cap raised 1k → 100k

### What changed (PR #24)

- **`server/athena.ts` — reads now paginate.** `runAthenaQuery` follows Citadel's
  `nextToken`/`executionId` across pages instead of taking only the first ~1000-row page, and
  passes `maxRows` (default `MAX_ROWS`) so the guard's `LIMIT` ceiling is lifted off its 1000
  default. `MAX_ROWS` is raised **10,000 → 100,000**. If pages still remain when the backstop
  stops accumulation, `truncated` is surfaced — never a silent clip.
- **`server/reads.ts`** forwards an optional per-read `maxRows`.
- **`server/queries/index.ts`** (shared): `BakedQuery` gains an optional `maxRows` override.
- Pairs with Citadel's `MAX_ROWS_HARD_CAP` 10k → 100k (**noonAcademy/noon-citadel#270**). The
  client change is **decoupled from that deploy**: after upgrading, a clone gets up to **10,000**
  rows immediately against today's Citadel, and up to **100,000 automatically** once #270 ships —
  no second upgrade.

### Why a clone should care

Today a read that asks for more than 1000 rows dies with `LIMIT cannot exceed 1000 rows`, and any
other read is **silently clipped to Citadel's first ~1000-row page**. After this, reads page
through to the platform ceiling and surface `truncated` instead of quietly dropping rows. (The cap
is a ceiling, not a target — Citadel still pages at ~1000 rows, so a 100k read is ~100 sequential
fetches; prefer aggregates for large pulls.)

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `server/athena.ts server/reads.ts
   server/athena.test.ts MIGRATE-SYNC.md`
2. **Guided edit — `server/queries/index.ts`** (shared; skip if already present): add
   `maxRows?: number` to the `BakedQuery` interface; make `toBakedQuery` accept any query module
   with an optional `maxRows` (a structural `QueryModule` type) and forward `maxRows: m.maxRows`;
   leave every query registered in `BAKED_QUERIES` untouched. This is what lets the copied
   `server/reads.ts` (which passes `query.maxRows`) typecheck.
3. **Builder-owned reads** (`server/queries/*.sql.ts`) are never touched by this upgrade. Flag for
   the builder: a read that should return more than 1000 rows must carry an explicit top-level
   `LIMIT` (without one the guard appends `LIMIT 20`); set a smaller per-read ceiling with
   `export const maxRows` on the query module if it needs fewer.

### Verify

- `npm run verify` green.
- Pagination and the new cap are present: `grep -q "nextToken" server/athena.ts` and
  `grep -q "MAX_ROWS = 100_000" server/athena.ts` both succeed.
- `BakedQuery` carries the optional override: `grep -q "maxRows" server/queries/index.ts` succeeds.

---

## 2026.07.22 — registry snapshot refreshed to v2.22 (+19 tables)

### What changed (PR #23)

- **`server/citadel-schema.ts` re-synced to registry v2.22** (the `npm run sync:registry`
  equivalent). 19 new tables (57 → 76): the **Lesson Builder** model in `noon2_core`
  (`lesson`, `lesson_version`, `lesson_session_link`, `lesson_activity`,
  `lesson_activity_question`, `lesson_curriculum`, `lesson_segment`,
  `lesson_session_materialization`, `lesson_session_materialization_mapping`,
  `lesson_share_link`), a new **`datamart_v`** database (`kyy_nn_session_details`,
  `nn_activity_details`, `nn_activity_quality`), and six **`noon2_replit`** tables
  (`nn_assessment_details`, `nn_learning_gains`, `hk_f_course_session`, `hk_f_user_session`,
  `hk_session_questions`, `session_transcriptions`). `BUSINESS_RULES`,
  `COMPACT_TABLE_OVERVIEW`, and the "Last updated" header were refreshed with them.

### Why a clone should care

Until Citadel serves `GET /api/registry` live on your target environment, the Get-data tab
and the SQL skill browse this committed snapshot. Without the refresh, your agent can't see
the Lesson Builder, `datamart_v`, or `noon2_replit` tables and will write SQL as if they
don't exist.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `server/citadel-schema.ts`

### Verify

- `npm run verify` green — the refreshed snapshot still satisfies its consumers
  (`server/tables.ts` imports `ATHENA_REGISTRY`/`AthenaTableMeta`; the SQL skill parses its
  `BUSINESS_RULES`/`COMPACT_TABLE_OVERVIEW` text).
- The new tables are present: `grep -c "AthenaTableMeta = {" server/citadel-schema.ts`
  reports **76**, and `grep "key: 'noon2_core_lesson'" server/citadel-schema.ts` matches.

---

## 2026.07.16.2 — live registry in the workspace, labeled snapshot fallback

### What changed (PR #22)

- **`GET /__synapse/registry`** (workspace-only): the data registry as **text**, live from
  Citadel when reachable (HMAC-signed, ETag-revalidated per request), else the committed
  snapshot — `X-Registry-Source`/`-Reason` headers say which. Deliberately never executes or
  parses fetched code; a deployed app never fetches the registry at runtime.
- **Get-data tab freshness**: a quiet source banner (live version/date from
  `/api/registry/meta`, or a labeled snapshot state — including a no-alarm label while the
  live endpoint isn't deployed on this Citadel) + a "view raw registry" link. Browsing still
  renders from the snapshot's structures in every state.
- **`npm run sync:registry`** (maintainer-only): refreshes `server/citadel-schema.ts` from
  the live endpoint; refuses to write if required exports are missing from the wire text.
- The SQL skill now reads the freshest registry via
  `curl -s localhost:3000/__synapse/registry` (snapshot is the labeled fallback).

### Why a clone should care

Your agent stops writing SQL against a registry frozen on clone day: table/column/enum
changes reach it as soon as Citadel serves them, with no template release in between. The
console stops silently presenting stale data as current.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (synapse-owned): `server/registry.ts server/registry.test.ts
   scripts/sync-registry.ts client/console/GetDataTab.tsx client/console/GetDataTab.test.tsx
   skill/SKILL.md AGENTS.md`
2. **Guided edit — `server/index.ts`** (shared; skip any part already present): import
   `registryFetcher` from `./registry.js`; construct the process-wide `getRegistry` fetcher
   (creds from `synapse.js` exports, `snapshotText` reading `./citadel-schema.ts`); mount
   `GET /__synapse/registry` and `GET /__synapse/registry/status` inside the
   workspace-only block. The template's `server/index.ts` is the reference; if the clone
   never modified its own, take the template's wholesale.
3. **Guided edit — `package.json`**: ensure `"sync:registry": "tsx scripts/sync-registry.ts"`
   under `scripts`; leave builder scripts alone.

### Verify

- `npm run verify` green.
- With the app running: `curl -si localhost:3000/__synapse/registry | head -5` returns the
  registry text with an `x-registry-source` header (`live`, or `snapshot` with a reason).
- The Get-data tab's "browse all Noon data" section shows the source banner.

---

## 2026.07.16 — the catch-up entry: pre-versioning clones → the versioned kit

**Who this is for:** every clone made before `TEMPLATE_VERSION` existed — including the
onboarding-session clones of 2026-07-02. If your repo has no `TEMPLATE_VERSION` file, this
entry is your starting point.

### What changed (template PRs #11–#20, plus this entry's own machinery)

- **Vendored SDK — installs need no token** (#19). The three `@noonacademy/*` packages are
  committed tarballs under `vendor/`; `.npmrc` and `GITHUB_TOKEN` are gone. Secrets are down
  to three: `SYNAPSE_APP_ID`, `SYNAPSE_APP_SECRET`, and optional `SYNAPSE_BASE_URL`.
- **Sign in with Noon via Citadel's own OAuth** (#18). `GOOGLE_CLIENT_ID` is deleted;
  deployed apps gate behind Citadel login (`APP_OAUTH_REDIRECT_URI` + `APP_SESSION_SECRET`).
- **The skills pack** (#12, #14, #17). `SPEC.md` as the app's memory, the plan-first
  interview, add-page / event-design / error-report / workflow skills under `.agents/skills/`.
- **One-command verify + secret scan** (#13, #16). `npm run verify` chains secret scan →
  typecheck → lint → tests; deployments gate on it; the console header shows a verify chip.
- **First-run smoothness** (#15). `replit.md` router and the Home-tab setup checklist.
- **Scaffolding stepped aside** (#20). The starter's example views moved to a frozen
  `/synapse` corner page; the app's whole look now lives in `client/app/theme.css` tokens.
- **The upgrade path itself** (this entry). `TEMPLATE_VERSION`, the ownership map
  (`.synapse/ownership.json` + AGENTS.md section), `UPGRADE.md`, the **synapse-upgrade**
  skill, and the console's kit-update notice.

### Why a clone should care

Installs stop depending on a shared `GITHUB_TOKEN` (which will eventually rotate and break
you), a real verify gate stands between you and broken deploys, your agent gets the skills
the template's docs now assume, and future template improvements become adoptable — this
entry is what puts you on the upgrade train.

### Recipe (every step is an ensure — skip what's already true)

1. **Copy from the template** (`git checkout template/main -- <paths>`) — synapse-owned only:
   `AGENTS.md README.md INTEGRATE.md MIGRATE-SYNC.md replit.md TEMPLATE_VERSION UPGRADE.md
   UPGRADES.md RELEASING.md .synapse .agents/skills .github skill vendor scripts
   client/console client/RowsTable.tsx client/format.ts client/index.css client/main.tsx
   client/sendEvent.ts client/sendEvent.test.tsx client/ui.tsx client/useJson.ts
   client/useSynapseMode.ts client/useSynapseMode.test.tsx client/useView.ts
   client/vite-env.d.ts client/app/pages/synapse.tsx client/app/blocks/ViewBlock.tsx
   server biome.json tsconfig.json tsconfig.client.json vite.config.ts vitest.config.ts
   .gitignore .env.example`
   — then immediately restore the shared + builder-owned paths the `server` and `client`
   globs swept up: `git checkout HEAD -- server/index.ts server/queries` (guarded edits for
   those are steps 4 and 6; if `git status` shows other overwritten builder files, restore
   them too).
2. **Create if missing** (builder-owned, so never overwrite an existing one):
   `client/app/theme.css`, `client/app/config.ts`, `client/app/ui.tsx`, `SPEC.md` — copy each
   from `template/main` only when the clone has no file at that path.
3. **Retire the token install** — if `.npmrc` exists and only contains the two
   `@noonacademy` GitHub Packages lines, delete it; if it has other content, remove just
   those two lines.
4. **Guided edit — `package.json`** (preserve every builder-added dependency and script):
   - `dependencies`: the three `@noonacademy/*` entries point at `file:vendor/<tarball>`
     paths matching the tarballs now in `vendor/`; add any of
     `@tailwindcss/vite tailwindcss express-rate-limit` that are missing.
   - `overrides`: identical `file:` specs for the same three packages (npm errors if these
     drift from `dependencies`).
   - `scripts`: ensure `verify`, `secrets`, `typecheck`, `lint`, `lint:fix`, `test`,
     `build:deploy` match the template's; leave builder-added scripts alone.
   - `devDependencies`: ensure the verify toolchain is present (`@biomejs/biome`, `vitest`,
     `jsdom`, `cross-env`, `typescript`, `@testing-library/*`, `@types/*` as in the template).
5. **Guided edit — `.replit`**: workspace `run` is
   `npm install --omit=dev && npm run build && npm run start`; deployment `build` runs
   `npm install && npm run build:deploy`. Keep any builder-added sections.
6. **Guided edit — the registries** (preserve builder entries):
   - `client/app/pages/index.ts`: ensure the `toAppPage` file-plus-registry shape and that
     `synapse` is imported and registered (`nav` stays false).
   - `server/queries/index.ts`: ensure the `toBakedQuery` shape from the template; keep every
     builder-registered read.
7. **Guided edit — `server/index.ts`**: if the clone never modified it, take the template's
   (it was swept into step 1's copy — just don't restore it). If the builder added routes,
   port them into the template's version — the workspace/deployment gating and fail-closed
   auth mount must be preserved exactly.
8. **Install + regenerate the lockfile** (tokenless by design):
   `rm -rf node_modules package-lock.json && npm install` — then
   `grep npm.pkg.github.com package-lock.json` must print nothing.
9. **Hands off the builder's surface.** Do not touch `client/app/AppShell.tsx`, `home.tsx`,
   `LoginScreen.tsx`, or anything else the builder's agent has built. If the shell predates
   #20 it won't have the `/synapse` footer link or theme-token styling — note that in the
   final report as an optional ask for the builder's own agent; `/synapse` still resolves by
   URL through the registry.
10. **Secrets cleanup (tell the operator; agents don't hold secrets):** `GITHUB_TOKEN` and
    `GOOGLE_CLIENT_ID` can be deleted from Replit Secrets. Deployed apps need
    `APP_OAUTH_REDIRECT_URI` and `APP_SESSION_SECRET` for Sign in with Noon (INTEGRATE.md §5
    documents the flow).

### Verify

- `npm run verify` green (secret scan → typecheck → lint → tests).
- `npm run start` boots and logs `[synapse-starter] listening` — with **or without** secrets.
- `package-lock.json` contains no `npm.pkg.github.com` references.
- `git status` shows **no modifications** to builder-owned paths (their pages, `SPEC.md` if
  it was filled, their queries).
- `TEMPLATE_VERSION` reads `2026.07.16`.
