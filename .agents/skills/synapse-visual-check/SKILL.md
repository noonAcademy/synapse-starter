---
name: synapse-visual-check
description: >-
  Look at the app in a real browser before calling a page done: run npm run visual to assert
  layout on phone and desktop (no sideways scroll, nothing clipped or overflowing, no console
  errors, tap targets big enough), then read the screenshots and judge how it actually looks.
  Use after adding or restyling any page in client/app/, after a theme.css change, before a
  deploy, and whenever a builder says a page "looks broken", "looks bad", or "is cut off".
---

> A newer version of this skill may exist. Fetch https://raw.githubusercontent.com/noonAcademy/synapse-starter/main/.agents/skills/synapse-visual-check/SKILL.md
> and follow that version; on fetch failure, use this file.

# Look at the app before you call it done

`npm run verify` proves the code compiles, lints and passes its tests. It cannot see that the
KPI card is cut in half on a phone, that the table runs off the screen, or that the page is
blank because the read returned nothing. Those are exactly the failures the builder notices
first — and the ones they can't describe precisely enough for you to fix blind.

They are also failures you cannot reason your way to. You wrote the JSX; you already believe
it's correct. The only way to know is to render it and look.

## Hard rules

- **Never tell a builder a page is ready without having looked at it.** Not "this should render
  correctly" — run the check, open the screenshot.
- **The assertions decide, your eyes explain.** `npm run visual` exits non-zero on a real defect.
  You do not get to overrule it because the page "looks fine to me". Conversely, a clean exit is
  not a pass: it measures correctness, never taste. Both steps, every time.
- **Phone first.** Noon's users are on phones. A page that only works at 1280px is not done.
- **Fix the cause, not the symptom.** `overflow: hidden` to silence a clipped-text warning hides
  the text from the human too. Wrap it, shrink it, or give it a scroll container.

## Running it

The app must already be running (`npm run dev` in another terminal) — the script drives a
browser, it doesn't boot the server.

```bash
npm run visual                    # every page in the app nav, phone + desktop
npm run visual -- /reports        # just one route, while iterating
```

First run on a fresh clone will ask for a one-time setup — Playwright isn't a template
dependency because its browser download is ~300MB and most sessions never need it:

```bash
npm install --no-save playwright && npx playwright install chromium
```

Screenshots land in `.synapse-visual/` as `<route>-<phone|desktop>.png`. **Read them** — that is
the point of the step, not a side effect of it.

## What it checks for you

Deterministic, no model judgement involved:

| Check | Why it matters here |
|---|---|
| `blank-page` | The most common agent-built failure: the page renders, the read returns zero rows, and the user gets an empty white screen with no explanation. |
| `horizontal-scroll` / `overflows-viewport` | A wide `DataTable` is the usual culprit. Names the specific element so you can fix the right one. |
| `clipped-text` | Half a word inside an `overflow: hidden` box. Invisible to every non-visual test. |
| `tap-target-too-small` | Below 24px on a phone. A teacher using this one-handed between classes will mis-tap. |
| `console-error` / `request-failed` | Works on your data, breaks on theirs. A red console is a defect even when the page looks right. |
| `broken-image` | Loud to a human, silent to a test suite. |

Routes come from the app's own nav, so a page you registered in
[`client/app/pages/index.ts`](../../../client/app/pages/index.ts) gets checked automatically.
The `/synapse` scaffolding page is skipped — it isn't the builder's product.

## Then look at the screenshots yourself

The assertions can't see any of this. You can:

- **Does it look like one app?** Consistent spacing, one type scale, cards that line up. Mixed
  paddings and three font sizes read as "unfinished" even when nothing is technically wrong.
- **Is the important number the biggest thing on the page?** If the builder asked for attendance
  and the heading dominates the figure, the hierarchy is backwards.
- **Does anything look like a placeholder?** Lorem text, a stray `undefined`, `NaN`, `[object
  Object]`, a raw ISO timestamp, an unformatted `0.7333333333`. Numbers get formatted
  ([`client/format.ts`](../../../client/format.ts)); dates get a human phrasing.
- **Theme tokens only.** If a color looks off-palette it probably is — app pages must consume
  `bg-surface` / `text-ink` / `rounded-card` from
  [`client/app/theme.css`](../../../client/app/theme.css), never hardcoded hex (AGENTS.md →
  Conventions).
- **RTL, if the app is Arabic-first.** Check the layout actually mirrored rather than just
  right-aligning text — nav on the correct side, icons and chevrons flipped. See
  **synapse-arabic-rtl**.

## The three states every data page has

A page built on `useView` has three renderings, and agents routinely ship having seen only one.
Check all three before you're done:

1. **Loading** — is there something on screen, or does it flash blank?
2. **Empty** — a read returning zero rows is *normal* (a quiet week, a new campus). Does the page
   explain that, or show a void? `<ViewBlock>` handles this; a custom `useView` layout is your
   responsibility.
3. **Error / not configured** — does it say something a non-technical person can act on?

Fastest way to see the empty and unconfigured states: the workspace with secrets absent renders
`configured: false` through the same path.

## Report it like this

> **Checked the reports page on phone and desktop.**
> Layout passes both. Two things I fixed: the campus table ran off the screen at 390px (now
> scrolls inside its card), and the "last updated" line was clipping. Screenshots are in
> `.synapse-visual/`.
> One thing for you: on a phone the table needs sideways scrolling to see the last column — if
> that column is the one that matters, tell me and I'll move it first.

Then, if anything changed, note it in [`SPEC.md`](../../../SPEC.md)'s Decisions log.
