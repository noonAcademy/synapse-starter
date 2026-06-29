# Synapse starter

A clone-and-own template that connects a Replit app to Noon's Citadel via the Synapse SDK.

A builder clones this repo into Replit, pastes three secrets, and presses **Run**. On boot
the server publishes an `app_booted` event to **staging** Citadel, then serves a small
**builder console** whose tabs let you watch publishes, browse the data registry, and run a
read against the lake. That round trip exercises the whole runtime: the published SDK installs
from GitHub Packages, Replit Secrets reach the server, the server boots, the request is
HMAC-signed, the network reaches staging Citadel, and the event lands attributed to your app.

> **Where this is in the ladder.** Slice 1 proved the clone→secrets→connect→publish runtime.
> Slice 2 added the Settings page with the Events tab. **Slice 3 (this)** adds **reads** — a
> baked-query helper over the Synapse SDK's `athenaQuery`, an app-side cache, a **Tables** tab
> (registry browser), an **Overview** tab (identity + connection check), an **Event catalog**
> view, and a bundled SQL-analyst **skill** so the in-Replit agent writes correct reads.
> Self-service event types and the Slack provisioning flow are later slices. Event history and
> the read cache are in-memory for now (durable history is slice 2b).

## The builder console

The page served by the app is a workspace-only console with five tabs:

- **Overview** — this app's Synapse identity (app id, staging base URL) and a live connection
  check derived from the boot round-trip, plus a "try this next" list.
- **Tables** — a searchable browser over the bundled Citadel data registry
  (`server/citadel-schema.ts`): per-table grain, refresh cadence, an informational access
  badge, the full column grid with enum chips, and copyable example queries.
- **Read** — runs the one bundled example read (active courses by type) end to end: baked
  `SELECT` → `synapse.athenaQuery` → app-side cache → rendered rows, with a "data as of …"
  freshness note and the SQL on display.
- **Events** — settled publish outcomes since boot (from slice 2).
- **Catalog** — a read-only view of the event types the SDK knows about, grouped by namespace.

All of these are served from `/__synapse/*` endpoints that are mounted **only in the Replit
workspace** (when `REPLIT_DEPLOYMENT` is unset) — they are not exposed in a published
deployment.

## Reads (slice 3)

Reads go through **`synapse.athenaQuery({ sql })`** — the HMAC-signed, **app-wide** SDK helper
that lands in `@noonacademy/synapse-sdk` 0.1.2. Never a raw `fetch`. They are app-wide, not
per-user; per-user reads and runtime NL→SQL are later slices.

- **Baked queries.** Each read is a file at `server/queries/<name>.sql.ts` exporting
  `{ sql, registryVersion, skillVersion }` (plus a `name`/`title`/`description` for wiring) —
  no params, so the SQL is reviewable in the PR diff and traceable to the schema it targets.
- **App-side cache.** Rows are cached in memory per query name with a 1h TTL — well under the
  lake's ~12h refresh — so the console stays responsive and cheap. A missing client (no
  secrets) yields an empty result, never a 500. The cache resets on restart.
- **The skill.** [`skill/SKILL.md`](skill/SKILL.md) is a Replit-adapted SQL-analyst skill
  (Trino/Presto, the full Noon business-rules brain) that writes correct reads and bakes the
  final `SELECT`. [`AGENTS.md`](AGENTS.md) briefs the in-Replit agent on how reads and events
  work. To add a read: describe the data you want and let the skill write + bake it.

## Setup (4 steps + Run)

1. **Mint app credentials.** In the Citadel **staging** portal, open `/portal/replit-apps`
   → **Create app**. Copy the `app_id` and `app_secret` — the secret is shown once and is
   not recoverable.
2. **Create a GitHub PAT (classic)** with the `read:packages` scope — the SDK is a private
   GitHub Package, so installing it requires a token whose account has read access to the
   `@noonacademy` packages. Use a **classic** token; the npm Packages registry's support for
   fine-grained tokens is unreliable.
3. **Clone into Replit** via this repo's import URL.
4. **Paste into Replit Secrets** (the 🔒 pane):
   - `SYNAPSE_APP_ID` — from step 1
   - `SYNAPSE_APP_SECRET` — from step 1
   - `GITHUB_TOKEN` — from step 2
   - `SYNAPSE_BASE_URL` — optional; defaults to `https://citadel.staging.noonedu.io`
5. **Press Run.**

> **If your import auto-installed before you set `GITHUB_TOKEN`:** the first install fails
> because the private SDK can't be fetched without the token. That's expected. Set the
> secrets and press **Run** — the run command re-runs `npm install` (now with the token),
> then builds and starts, so it self-heals in one click. See
> [Notes](#notes-real-replit-flow-findings).

## Verifying it worked

Check these in order — each failure points at one layer.

1. **GitHub Packages auth works.** After install, `node_modules/@noonacademy/synapse-sdk`
   exists. If install failed here → registry / PAT / `.npmrc`.
2. **Citadel accepted the event.** The server log shows
   `[synapse] OK — app_booted accepted eventId=<N>`. An error or
   `Missing required Replit Secret(s)` instead → secrets or runtime. (A
   `[synapse] app_booted queued (...)` line means the SDK couldn't reach Citadel on the
   first try and enqueued it for background retry — check `SYNAPSE_BASE_URL` and that staging
   is up.)
3. **The Events tab shows it.** Open the webview → the **Events** tab lists an `app_booted`
   row as **✓ accepted** with its event id. This is the builder-observable proof the round
   trip settled.
4. **(operator) It landed attributed.** A builder has no direct DB access, so a
   noon-citadel operator can confirm the staging `events` row: an `app_booted` event whose
   `actor_app_id` is your app id. If 1–3 pass but there's no row → server-side.

Restart the app and the Events list resets — outcomes are kept **in memory** for the life of
the process (durable history is a later slice).

## Running locally

```bash
cp .env.example .env          # fill in SYNAPSE_APP_ID, SYNAPSE_APP_SECRET, GITHUB_TOKEN
npm install                   # needs GITHUB_TOKEN in your env for the private SDK
npm run dev                   # Vite (HMR) + the Express server on one port
```

Other scripts:

| Script | What it does |
|---|---|
| `npm run dev` | Express + Vite middleware on one port (`PORT`, default 3000), with HMR. |
| `npm run build` | `vite build` → static client into `dist/public`. |
| `npm start` | Run command on Replit: Express serves the built client + boot-publishes. |
| `npm run typecheck` | `tsc` over server and client. |
| `npm run lint` / `lint:fix` | Biome. |
| `npm test` | Vitest (runs without the SDK token — the units use type-only SDK imports). |

## How it fits together

- **`server/synapse.ts`** constructs the SDK client once from env. If the required secrets
  are missing it exports `null` plus a human-readable `synapseConfigError` instead of
  throwing, so the server still boots and the page still renders. Also exports `synapseAppId`
  / `synapseBaseUrl` for the Overview tab.
- **`server/index.ts`** starts Express, mounts the workspace-only `/__synapse/*` endpoints
  (`events`, `overview`, `tables`, `catalog`, `reads`, `reads/:name` — see below), serves the
  client (built static in production, Vite middleware in dev — one port either way), then
  publishes one `app_booted` event on boot. A publish failure is logged, never fatal. The
  long-lived client is closed only on `SIGTERM` / `SIGINT`.
- **`server/citadel-schema.ts`** is the bundled Citadel data **registry** — the one in-app
  source of truth for Athena tables (columns, types, enums, grain, example queries) plus
  `BUSINESS_RULES`. **`server/tables.ts`** projects it for the Tables tab.
- **`server/queries/`** holds the baked reads (`<name>.sql.ts`) and their registry
  (`index.ts`). **`server/reads.ts`** orchestrates registry-lookup → cache → `athenaQuery`;
  **`server/athena.ts`** wraps `synapse.athenaQuery` and normalises the result;
  **`server/query-cache.ts`** is the in-memory, per-name, 1h-TTL cache.
- **`server/events.ts`** returns `synapse.getRecentPublishes({ limit: 50 })` (newest-first,
  terminal outcomes only), or an empty list when there's no client. **`server/catalog.ts`**
  and **`server/overview.ts`** build the Catalog and Overview projections.
- **`client/`** is the builder console (`App.tsx`) with the Overview / Tables / Read / Events /
  Catalog tabs, each fetching one `/__synapse/*` endpoint through the shared `useJson` hook.

## Notes (real Replit-flow findings)

- **All `/__synapse/*` endpoints are workspace-only.** They're mounted only when
  `process.env.REPLIT_DEPLOYMENT` is unset — so the console works while you build in the
  Replit workspace, but none of the endpoints are exposed once the app is a published
  deployment (they fall through to the SPA, returning no data).
- **Single port.** In production (`npm start`) Express serves the built static client; in dev
  (`npm run dev`) Express mounts Vite in middleware mode with HMR multiplexed over the *same*
  HTTP server (`hmr.server` in `server/index.ts`) — so both modes listen on one `PORT`, with
  no second HMR port (`:24678`) for Replit to forward and no CORS for the same-origin
  `/__synapse/events` call. The server binds `0.0.0.0` (required on Replit), not `localhost`.
- **Install skips dev tooling.** The `.replit` run command is
  `npm install --omit=dev && npm run build && npm run start`. Replit's package firewall
  blocks CVE-flagged packages (it blocked `vitest`), and test/lint tooling isn't needed to
  build or run — so the build toolchain (vite, tsx, tailwind, the React plugin) lives in
  `dependencies` and `--omit=dev` skips vitest/biome. Re-running install on every Run also
  self-heals the token-set-after-import case.
- **`.npmrc`.** Auth is `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}`, which npm
  expands from the environment at install time — so the token lives only in Replit Secrets,
  never in the repo.
- **No lockfile (yet).** The template ships without a `package-lock.json`: one generated
  outside Replit is incomplete (the private SDK can't be resolved without a token), and a
  partial lockfile is worse than none. Versions resolve fresh per clone — the SDK is bounded
  by its `^0.1.1` range. Your first authenticated `npm install` writes a correct lockfile you
  can commit if you want fully reproducible installs.
- **Reads light up when SDK 0.1.2 publishes.** `synapse.athenaQuery` lands in
  `@noonacademy/synapse-sdk` 0.1.2; the read path is written against it. The dependency is
  pinned **`^0.1.1`** (not `^0.1.2`) on purpose: `^0.1.2` would fail to install until 0.1.2 is
  published, breaking the clone-and-Run flow — whereas `^0.1.1` installs today **and** picks up
  0.1.2 automatically the moment it ships (`^0.1.1` resolves to the highest `0.1.x`). Until then
  the app boots and every tab works except the **Read** tab, which shows a clear "reads need SDK
  ≥ 0.1.2" message rather than crashing. The `athenaQuery` contract is declared locally in
  `server/athena.ts`, so the app type-checks and builds on 0.1.1 too. Bump to `^0.1.2` once the
  SDK is published if you want to hard-require it.
- **Component tests use jsdom.** `npm test` runs server units in the node environment and the
  one `client/*.test.tsx` in jsdom (via `@vitejs/plugin-react` + a `@vitest-environment`
  docblock). All test tooling is `devDependencies`, so `--omit=dev` skips it on Replit.

## Event types are catalogued, not yet self-service

The **Catalog** tab lists the event types this SDK build knows about. You can publish any of
them today with `synapse.publishEvent(type, payload)`. Declaring a **brand-new** event type
still requires cataloguing it in noon-citadel and republishing the SDK — true self-service
event declaration is a later slice.

## What's next

- **Slice 2b** — durable event/read history (persist outcomes + cache so they survive restarts).
- **Slice 5 / 6** — self-service event types, and the `/build-app` Slack provisioning flow.
- **Later reads** — per-user (scoped) reads, runtime NL→SQL, and a Citadel-served registry
  (this slice bundles the registry in-repo for the POC).
