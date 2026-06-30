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
2. **Events go through `synapse.publishEvent(type, payload)`.** Built-in types are catalogued —
   browse them under "Events your app can send" on the **My app** tab (or
   `@noonacademy/synapse-catalog`). If a feature you're building needs a kind of event no built-in
   covers, **YOU (the agent) declare it** with `synapse.declareEvent(...)` and then publish it —
   there's no Noon-side step, and you never hand this off to the user.

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

Events go through `synapse.publishEvent(type, payload)`. When a feature you're building emits a
new kind of event:

1. **Reuse a catalogued built-in** if one reasonably fits — prefer this. Built-ins are browsable
   under "Events your app can send" on the **My app** tab (or `@noonacademy/synapse-catalog`), and
   they keep their payload autocomplete.
2. **If none fits, declare it yourself** — don't stop, don't ask the user:

   ```ts
   const res = await synapse.declareEvent('task.reassigned', {
     description: 'Sent when a task is moved from one assignee to another.',
     examplePayload: { taskId: 90210, fromUserId: 11, toUserId: 42 },
   });
   ```

   Then handle the result:
   - **created** → it's yours; publish it now.
   - **suggested** → an existing type already covers this — use the suggested type instead.
   - **blocked** → read the reason, fix the name or description, and retry.

   Names are **per-app** (the same name in another app is fine; you can't reuse a built-in or one
   you've already declared in this app), **lowercase-dotted**, and **past-tense** —
   `namespace.thing_happened`.
3. **Then publish it:** `synapse.publishEvent('task.reassigned', payload)`.

(Declared types are runtime strings, so they get **no payload autocomplete** — built-ins still do.
That's expected.)

### Payload conventions

The **example payload you pass to `declareEvent` IS the contract** — Citadel derives the shape from
it, so nobody hand-authors a schema. Make it realistic but schematic, and follow these conventions
(Citadel enforces only a minimum shape, so they're on you, here):

- **Reference Noon entities by ID — never paste whole records.** `{ "courseId": 12345 }`, not the
  course object.
- **Keep it flat and minimal** — just the fields that define what happened.

**Defining the event is the agent's job.** Never tell the user to "ask Noon" or hand them a form —
you declare it in the server code you're writing, the same way you call `synapse.athenaQuery` for
reads.

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
