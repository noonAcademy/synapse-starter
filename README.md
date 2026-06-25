# Synapse starter

A clone-and-own template that connects a Replit app to Noon's Citadel via the Synapse SDK.

A builder clones this repo into Replit, pastes three secrets, and presses **Run**. On boot
the server publishes an `app_booted` event to **staging** Citadel, then serves a small
Settings page whose **Events** tab shows the outcome of every publish. That round trip
exercises the whole runtime: the published SDK installs from GitHub Packages, Replit Secrets
reach the server, the server boots, the request is HMAC-signed, the network reaches staging
Citadel, and the event lands attributed to your app.

> **Where this is in the ladder.** Slice 1 proved the clone→secrets→connect→publish runtime.
> Slice 2 (this) adds the Settings page with the Events tab. Reads, self-service event types,
> and the Slack provisioning flow are later slices. Event history is in-memory for now
> (durable history is slice 2b).

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
  throwing, so the server still boots and the page still renders.
- **`server/index.ts`** starts Express, exposes `GET /__synapse/events` (workspace only —
  see below), serves the client (built static in production, Vite middleware in dev — one
  port either way), then publishes one `app_booted` event on boot. A publish failure is
  logged, never fatal. The long-lived client is closed only on `SIGTERM` / `SIGINT`.
- **`server/events.ts`** returns `synapse.getRecentPublishes({ limit: 50 })` (newest-first,
  terminal outcomes only), or an empty list when there's no client.
- **`client/`** is the Settings page (`App.tsx`) with the **Events** tab (`EventsTab.tsx`),
  which fetches `/__synapse/events` and renders the publish-log table.

## Notes (real Replit-flow findings)

- **`/__synapse/events` is workspace-only.** It's mounted only when
  `process.env.REPLIT_DEPLOYMENT` is unset — so the Events tab works while you build in the
  Replit workspace, but the endpoint is not exposed once the app is a published deployment
  (it falls through to the SPA, returning no data).
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
  by its `^0.1.0` range. Your first authenticated `npm install` writes a correct lockfile you
  can commit if you want fully reproducible installs.

## What's next

- **Slice 2b** — durable event history (persist outcomes so the Events tab survives restarts).
- **Slice 3** — reads (an Athena-backed query helper + cache).
- **Slice 5 / 6** — self-service event types, and the `/build-app` Slack provisioning flow.
