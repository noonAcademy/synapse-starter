# AGENTS.md — working in the Synapse starter

This app connects a Replit project to Noon's **Citadel** via the **Synapse SDK**. It does two
things: **publishes events** and **runs reads**. Read this before adding either.

> **Your data lives in Citadel, not locally.** All Noon analytics data (students, sessions,
> courses, …) is in the Citadel warehouse, reached *only* through `synapse.athenaQuery`. The
> Replit Postgres / `DATABASE_URL` is **empty by design** — never query it for Noon data and
> don't create local tables for it. If you're looking for Noon data, it's a `synapse.athenaQuery`
> read (see "To add a read" below).

## The two rules that matter most

1. **Reads go through `synapse.athenaQuery({ sql })` — never a raw `fetch` or a direct
   Athena/Presto/HTTP client.** It's the HMAC-signed, app-wide SDK helper. The app-side
   plumbing (cache, route, rendering) already exists; you add SQL, not transport.
2. **Events go through `synapse.publishEvent(type, payload)`.** Types are catalogued — see the
   **Catalog** tab (or `@noonacademy/synapse-catalog`). You can only publish a type that
   already exists; declaring a brand-new type is a later slice (needs cataloguing in
   noon-citadel + an SDK republish).

## To add a read

1. **Describe the data you want** and let the SQL skill write it: open
   [`skill/SKILL.md`](skill/SKILL.md) (the Noon SQL analyst — Trino/Presto, all the business
   rules and gotchas). It will clarify scope, pick the right table from the registry, and
   write a correct `SELECT`.
2. **Bake the final SELECT** into `server/queries/<name>.sql.ts`, exporting
   `{ name, title, description, sql, registryVersion, skillVersion }` (no params — reads are
   app-wide). Register it in [`server/queries/index.ts`](server/queries/index.ts).
3. The read route (`GET /__synapse/reads/:name`) runs it through `synapse.athenaQuery`, caches
   the rows (~1h), and the **Read** tab renders them. Worked example:
   [`server/queries/courses-by-type.sql.ts`](server/queries/courses-by-type.sql.ts).

Don't hand-write SQL transport, and don't read data any other way.

## To publish an event

Events go through `synapse.publishEvent(type, payload)`, and the `type` **must already be in the
catalog** (browse it in the **Catalog** tab, or `@noonacademy/synapse-catalog`). When you build a
feature that would emit a new kind of event:

1. **Reuse an existing catalogued type** if one reasonably fits — prefer this.
2. If none fits, **stop and tell the user**: "this needs a new event type added to Citadel's
   catalog — a Noon-side step today (self-service is a later slice)." Don't invent one.

**Never call `publishEvent` with an uncatalogued type.** Citadel rejects it (and the SDK warns), so
it won't land — silently publishing it just looks broken to the user. The catalog is the contract.

## Where things live

| Path | What it is |
|---|---|
| [`server/citadel-schema.ts`](server/citadel-schema.ts) | **The data registry** — the one in-app source of truth for Athena tables (columns, types, enums, grain, example queries) + `BUSINESS_RULES`. Browse it in the **Tables** tab. |
| [`skill/SKILL.md`](skill/SKILL.md) | The SQL-analyst skill. Use it to write reads. |
| [`server/queries/`](server/queries/) | Baked reads (`<name>.sql.ts`) + their registry. |
| [`server/synapse.ts`](server/synapse.ts) | Constructs the SDK client from secrets; exports `null` (not a throw) when secrets are missing. |
| [`server/reads.ts`](server/reads.ts), [`server/athena.ts`](server/athena.ts), [`server/query-cache.ts`](server/query-cache.ts) | Read orchestration, the `athenaQuery` wrapper + result normaliser, and the in-memory cache. |
| [`server/index.ts`](server/index.ts) | Express server. Mounts the workspace-only `/__synapse/*` endpoints **only when `REPLIT_DEPLOYMENT` is unset** — they power the builder console and are hidden in a published deployment. |
| [`client/`](client/) | The builder console (Overview / Tables / Read / Events / Catalog tabs). |

## Schema / dialect facts

- SQL dialect: **Amazon Athena (Trino/Presto-compatible)**. Main schema: `noon2_datamart`.
- Reads are **app-wide** (app-level HMAC auth), **not per-user** — there is no per-user scope
  injection here. Prefer dimension/aggregate tables and app-wide aggregates.
- The lake refreshes roughly every 12h; the app caches reads for ~1h, so rendered rows are at
  most ~1h behind a refresh.

## Conventions

- TypeScript, ESM (`type: module`). Server uses NodeNext resolution — **relative imports need a
  `.js` extension** (e.g. `import { runRead } from './reads.js'`).
- Verify with `npm run typecheck`, `npm run lint`, and `npm test` before you're done.
- Don't commit a `package-lock.json` (the template ships without one — see the README) or `.env`.
