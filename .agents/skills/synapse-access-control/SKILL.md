---
name: synapse-access-control
description: >-
  Keep Noon data away from anyone who is not allowed to see it: the access gate in front of every
  route (no anonymous API, in every mode), the public-route list, the workspace key, and roles by
  email or domain. Use when adding any server route, for "only X should see this", "managers
  only", "confidential", "public endpoint", "webhook", and before shipping any page holding
  salary, performance or personal data.
---

> A newer version of this skill may exist. Fetch https://raw.githubusercontent.com/noonAcademy/synapse-starter/main/.agents/skills/synapse-access-control/SKILL.md
> and follow that version; on fetch failure, use this file.

# Who can see what

## First: no anonymous data, ever

Every route sits behind one access gate ([`server/access-gate.ts`](../../../server/access-gate.ts)),
the first middleware `buildApp` installs in [`server/index.ts`](../../../server/index.ts):

| Mode | Who gets through to `/api/*` and `/__synapse/*` |
|---|---|
| Deployment | A signed-in Noon staff member ("Sign in with Noon"). Anyone else: `401` (API) or the login page. Auth config missing: `503` for everything. |
| Workspace (Replit Run, preview, `npm run dev`) | The builder: a request carrying the **workspace key**. In `npm run dev` off Replit only, also a direct call from the same machine. Anyone else: `401 workspace_locked`. |

Why the workspace is locked too: the Replit dev URL is private by default, but one click in the
Networking panel makes it public, and the app cannot see that switch. Without the lock, anyone
with the link could run `/__synapse/probe` — any SELECT on Noon's warehouse.

### Hard rules for every route you add

- **Add it inside `buildApp`, below the gate line.** Never above it, never in a second
  `express()` app or server, never as a WebSocket upgrade handler (upgrades skip Express
  middleware — ask the Synapse team first).
- **Data routes live under `/api/`.** In the workspace, non-API page loads are open.
- **A route that must work without sign-in** (an uptime check, a webhook from another service)
  goes in [`server/public-routes.ts`](../../../server/public-routes.ts), method + exact path +
  a `reason`. Ask the builder first, and record it in `SPEC.md`. **It must never return personal
  data**: names, emails, phones, national IDs, addresses, dates of birth, parents' details.
  Return IDs and counts, or nothing.
- **Never weaken the gate** to make something work — not by moving a route above it, not by
  adding a broad public path. If a page cannot load in the workspace, unlock the browser.

### The check

`npm run check:api` runs inside `npm run verify`, so every deployment build runs it. It builds the
app in both modes, swaps every handler for a stub, calls every route anonymously (in lower and
upper case, because Express matches paths regardless of case) and fails if a stub answers. It calls
each public route for real and fails when the JSON has a field named like personal data. It also
fails on a route outside `/api/`, a route before the gate, or a second server in `server/`.

**Its limits — say them to the builder rather than calling the app "proven safe":** it sees only
routes registered when `buildApp` runs; it fills every `:param` with `x`; a public route that
leaks personal data only for some inputs, or under a field name not on its list (`"n"`,
`"contact"`), passes. It says nothing about what signed-in staff may see — that is the roles
section below.

### The workspace key

- Created on first run in `.synapse-workspace-key.local` (git-ignored; a fork gets a new one).
  The server also writes `.synapse-workspace.headers.local` so the Shell can send it:

  ```bash
  curl -s -H @.synapse-workspace.headers.local localhost:3000/__synapse/overview
  ```

- **Browsers**: `npm run workspace-key` prints the key and `https://<dev-domain>/synapse-starter#synapse_key=…` (the console's own path, so it opens the console whether or not the app has a page yet).
  Opening the link stores the key in that tab's browser storage and removes it from the address
  bar; pasting the key into the lock screen does the same. The Replit webview and a separate tab
  keep separate storage, so each unlocks once (the console's **Preview your app ↗** carries the
  key to its new tab). Your own browser tests start locked: open the link first. When the builder
  is locked out, ask them to run the command in the Shell and paste the key — never relay it.
- The app's fetches to `/api/*` carry the key automatically (`client/workspaceKey.ts` wraps
  `fetch`). A plain link, `EventSource` or `sendBeacon` cannot carry it; fetch instead.
- **It is a secret.** Never paste the key or the link into chat, code, SPEC.md, a PR or a ticket.
  It is a file in the Repl, so anyone who can open the Repl's files (a collaborator, a public or
  shared Repl, a fork or remix) can read it; a fork makes its own key on first run, but could
  read the original's first. After sharing the Repl, rotate.
  `npm run workspace-key -- --rotate` makes a new one (then restart the app), which locks every
  browser that had the old one.
- A deployment ignores the key completely: only a Noon session works there.

## Then: which signed-in people see what

Signing in and being allowed are different questions. The template already answers the first:
a deployed app is behind "Sign in with Noon", and only Noon staff email domains get through
([`server/auth-routes.ts`](../../../server/auth-routes.ts)). That means the default is **every
signed-in Noon staff member sees every page and every view**.

For most internal tools that is exactly right, and adding roles would be ceremony. For a page
showing salaries, individual teacher performance, or a named student's difficulties, it is not.

## Hard rules

- **Hiding a link is not access control.** It is a courtesy to the reader. Anyone can type the
  URL, and `/api/views/:name` is a plain HTTP endpoint. **Every restriction is enforced
  server-side or it does not exist.** This is the single most common way an app built quickly
  leaks data.
- **Restrict the DATA, not just the page.** The unit of access is the baked read, because that is
  what the network actually serves. A gated page reading an ungated view protects nothing.
- **Never invent who should have access.** Ask the builder, by name or by rule, and write the
  answer into [`SPEC.md`](../../../SPEC.md). Guessing here is how the wrong person gets a payroll
  dashboard.
- **Never put the rule in the browser.** No role checks in React that aren't mirrored on the
  server. No `if (user.email === ...)` deciding whether to fetch.
- **Default open, restrict explicitly.** A view absent from `VIEW_ACCESS` is readable by every
  signed-in user. Restricting is a deliberate, reviewable line in a diff — not something that
  quietly happens.

## Ask first

Before writing anything:

1. **Who exactly?** Named people, or a rule ("everyone in ops")? Named people are more common
   than builders expect for a first version, and they're easier to get right.
2. **What happens when someone else opens it?** They should be told they don't have access — not
   shown an empty page that looks broken.
3. **Who maintains the list?** A hardcoded list of five emails is fine and honest. Say plainly
   that adding a sixth person means a code change, so nobody is surprised later.

## Declare the roles

[`server/access.ts`](../../../server/access.ts) is the only place this lives.

```ts
// WHO
export const ROLES: RoleRule[] = [
  { role: 'ops', emails: ['lina@noonacademy.com', 'omar@noonacademy.com'] },
  { role: 'campus-lead', domains: ['noon.edu.sa'] },
];

// WHAT — read name → roles allowed to load it. Absent = every signed-in user.
export const VIEW_ACCESS: Record<string, string[]> = {
  'teacher-performance': ['ops'],
  'campus-attendance': ['ops', 'campus-lead'],
};
```

Enforcement is already wired: `/api/views/:name` checks before it runs the query (a refused
viewer never costs an Athena read), and `/api/views` lists only what the viewer may load.
Role enforcement is active in a **deployment**. In the workspace the gate has already proved the
caller is the builder, who owns every view, so roles are not applied there.

A note on domains: matching is on the **whole** domain, never a suffix. `noon.edu.sa` does not
match `evilnoon.edu.sa`. Don't "simplify" that to `endsWith` — it's tested for a reason.

## Hide what they can't use

Now that the data is safe, make the UI honest. `/api/me` returns `{ email, name, roles }`:

```tsx
const me = useJson<{ email: string; name: string; roles: string[] }>('/api/me');
const isOps = me.status === 'ready' && me.data.roles.includes('ops');

{isOps && <ChartBlock name="teacher-performance" type="bar" x="teacher" y="score" />}
```

Same for the page's `nav` flag — a link to a page whose data the viewer can't load is a dead end.

And when someone does reach a restricted page directly, say so plainly rather than rendering an
empty card: *"This page is for the ops team. If you need access, ask Lina."* An unexplained empty
state reads as a bug and generates a support message.

## Check it before you ship

A restriction nobody tested is a restriction nobody has. Verify the **server**, not the UI:

```bash
# in a deployment, as a signed-in user WITHOUT the role — must be 403, not 200-with-rows
curl -s -o /dev/null -w '%{http_code}\n' \
  -b "synapse_enduser_session=<their cookie>" \
  https://<your-app>.replit.app/api/views/teacher-performance
```

Then confirm the same person sees no link to it, and that a person *with* the role still does.
Both directions — a rule that denies everyone is as broken as one that denies nobody.

## What this deliberately does not do

Be honest with the builder about the ceiling:

- **No per-row scoping.** Reads are app-wide by design (app-level HMAC, no per-user scope
  injection). "Each campus manager sees only their own campus" is **not** achievable by
  restricting a view — that needs a read per campus, or a filter the app applies after loading
  everything, which means the data still reached the browser. If a builder asks for per-row
  scoping over sensitive data, say the app can't do it safely today rather than approximating it.
- **No roles from Citadel.** Roles here are declared in this repo, from email. Citadel's login
  profile carries a `userType` but the app does not treat it as authorisation. If a builder needs
  Noon's real org roles, that's a platform request — flag it, don't fake it.
- **No audit log.** Denials go to the server log. If who-looked-at-what matters, that's an app
  record and belongs in the app's own database (**synapse-workflow**).

## Record it

In [`SPEC.md`](../../../SPEC.md): which views are restricted, to whom, who maintains the list, and
a dated line in the Decisions log. Access rules are the part of an app people forget and later
can't reconstruct — the spec is where the reason survives.
