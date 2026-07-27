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

## 2026.07.22.2 — Get-data tab browses the live registry (snapshot is the fallback)

### What changed (PR #23)

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
