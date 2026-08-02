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
