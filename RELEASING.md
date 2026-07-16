# RELEASING.md — shipping template changes to the fleet (maintainers only)

Every clone of this repo is someone's app, frozen at whatever the template looked like on
clone day. The upgrade path ([`UPGRADE.md`](UPGRADE.md) + [`UPGRADES.md`](UPGRADES.md)) is
how they catch up — and it only works if every change to the template's own surface ships
with a version bump and a recipe. That's this file's one rule:

> **Any PR that changes a synapse-owned path** (per
> [`.synapse/ownership.json`](.synapse/ownership.json)) **must bump `TEMPLATE_VERSION` and
> append an `UPGRADES.md` entry — written by whoever ships the change, in the same PR,
> while the context is fresh.** Nobody writes a recipe for someone else's change three
> weeks later.

## Enforced, not remembered

CI enforces this (the automated check, not just a checklist note):
[`.github/workflows/template-version.yml`](.github/workflows/template-version.yml) runs
[`scripts/check-template-version.ts`](scripts/check-template-version.ts) on every PR to
`main` — if the diff touches a synapse-owned path and `TEMPLATE_VERSION` + `UPGRADES.md`
didn't change with it, the PR fails. The check is guarded to this repo only and is **not**
part of `npm run verify` (clones run verify before every deploy; release discipline is not
their problem).

## How to bump

1. `TEMPLATE_VERSION` is `YYYY.MM.DD` (today's date). If today already shipped, suffix it:
   `2026.07.16` → `2026.07.16.2` (→ `.3`, …). Comparisons everywhere are numeric,
   part-by-part.
2. Append the entry at the **top** of `UPGRADES.md`, following its laws (append-only;
   every recipe step an idempotent "ensure"; copy steps list synapse-owned paths only;
   shared paths via guided edits; builder-owned paths at most "create if missing").
   Include: **what changed**, **why a clone should care**, the **recipe**, and **how to
   verify**.
3. If you changed the ownership contract itself, update `.synapse/ownership.json` **and**
   the "Who owns what" section of `AGENTS.md` together — they must never disagree.

Special case: refreshing the vendored SDK tarballs
([`scripts/sync-sdk.md`](scripts/sync-sdk.md)) changes `vendor/` — synapse-owned — so it
follows this rule like any other change: bump + entry (the entry's recipe is essentially
"copy `vendor/`, redo the `package.json` guided edit, reinstall").
