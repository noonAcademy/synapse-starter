# Synapse starter

The thinnest proof that **cloned template → secrets → connected app** works on Replit.

A builder clones this repo into Replit, pastes three secrets, and presses **Run**. On
boot, the server publishes one `synapse_smoke_test` event to **staging** Citadel and logs
the result. That single round trip exercises the whole runtime: the published SDK installs
from GitHub Packages, Replit Secrets reach the server, the server boots, the request is
HMAC-signed, the network reaches staging Citadel, and the event lands attributed to your
app.

> **Slice 1 only.** No settings UI, no reads, no self-service events, no Slack flow — those
> are later slices. The web page is a minimal placeholder; its only job here is to confirm
> Vite serves under Replit.

## Setup (4 steps + Run)

1. **Mint app credentials.** In the Citadel **staging** portal, open
   `/portal/replit-apps` → **Create app**. Copy the `app_id` and `app_secret` — the secret
   is shown once and is not recoverable.
2. **Create a GitHub PAT** with the `read:packages` scope (the SDK is a private GitHub
   Package). A classic or fine-grained token both work.
3. **Clone into Replit** via this repo's import URL.
4. **Paste into Replit Secrets** (the 🔒 pane):
   - `SYNAPSE_APP_ID` — from step 1
   - `SYNAPSE_APP_SECRET` — from step 1
   - `GITHUB_TOKEN` — from step 2
   - `SYNAPSE_BASE_URL` — optional; defaults to `https://citadel.staging.noonedu.io`
5. **Press Run.**

> **If your import auto-installed before you set `GITHUB_TOKEN`:** the first install fails
> because the private SDK can't be fetched without the token. That's expected. Set the
> three secrets and press **Run** — the run command re-runs `npm install` (now with the
> token), then builds and starts, so it self-heals in one click. See
> [Notes](#notes-real-replit-flow-findings).

## Verifying it worked

Check these in order — each failure points at one layer.

1. **GitHub Packages auth works.** After install, `node_modules/@noonacademy/synapse-sdk`
   exists. If install failed here → registry / PAT / `.npmrc`.
2. **Citadel accepted the event** — this is your success signal at the keyboard. The server
   log shows `[synapse] OK — accepted eventId=<N> runId=starter-boot-<hex>`; the
   `OK — accepted` part is the proof the round trip worked (the `eventId` is just the id of
   the landed row). An error or `Missing required Replit Secret(s)` instead → secrets or
   runtime.
3. **It landed attributed** (operator-confirmed). A builder has no direct DB access, so ask
   a noon-citadel operator to confirm the row in **staging**: a `synapse_smoke_test` event
   in the `events` table whose `actor_app_id` is your app id, carrying the same `runId` in
   its payload. If checkpoints 1–2 pass but there's no row → server-side.
4. **The page renders** (bonus). Opening the webview shows *"Synapse starter — running."* —
   confirms Vite serves under Replit and de-risks the next slice.

A `[synapse] queued (...)` log (instead of `OK — accepted`) means the SDK couldn't reach
Citadel on the first try and enqueued the event for background retry — check
`SYNAPSE_BASE_URL` and that staging is up.

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
| `npm test` | Vitest (runs without the SDK token — the boot-log unit is type-only). |

## How it fits together

- **`server/synapse.ts`** constructs the SDK client once from env. If the required secrets
  are missing it exports `null` plus a human-readable `synapseConfigError` instead of
  throwing, so the server still boots and the page still renders.
- **`server/index.ts`** starts Express, serves the client (built static in production, Vite
  middleware in dev — one port either way), then publishes one `synapse_smoke_test` event
  on boot. A publish failure is logged, never fatal. The long-lived client is closed only
  on `SIGTERM` / `SIGINT`.
- **`client/`** is a minimal Vite + React + Tailwind page.

## Notes (real Replit-flow findings)

- **Single port.** Replit exposes one port. In production (`npm start`) Express serves the
  built static client; in dev (`npm run dev`) Express mounts Vite in middleware mode and
  Vite's HMR socket is multiplexed over the *same* HTTP server (`hmr.server` in
  `server/index.ts`) — so both modes listen on one `PORT`, with no second HMR port
  (`:24678`) for Replit to forward and no CORS to configure when slice 2 adds same-origin
  API routes. The server binds `0.0.0.0` (required on Replit), not `localhost`.
- **Install order.** Replit auto-installs on import. If that runs before `GITHUB_TOKEN` is
  set, the private SDK install fails — this is a genuine property of the flow, not a bug in
  the template. The `.replit` run command puts `npm install` first so pressing **Run**
  after setting secrets recovers without a manual reinstall.
- **`.npmrc`.** Auth is `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}`, which npm
  expands from the environment at install time — so the token lives only in Replit Secrets,
  never in the repo.
- **No lockfile (yet).** Slice 1 ships without a `package-lock.json`: one generated outside
  Replit is incomplete (the private SDK can't be resolved without a token), and a partial
  lockfile is worse than none. Versions resolve fresh per clone — the SDK is bounded by its
  `^0.1.0` range (intentional, so it picks up the upcoming catalog/`app_booted` republish).
  Your first authenticated `npm install` writes a correct lockfile you can commit if you
  want fully reproducible installs.

## What's next

Once slice 1 passes, `app_booted` gets catalogued and republished, and this template swaps
its boot event from `synapse_smoke_test` to the real `app_booted` lifecycle event. Then
slice 2 adds the Settings / Events page.
