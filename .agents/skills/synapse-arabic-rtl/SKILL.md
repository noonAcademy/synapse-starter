---
name: synapse-arabic-rtl
description: >-
  Make the app genuinely Arabic-first, not English pushed right: the English/Arabic switch and
  string catalogue (useI18n, defineStrings), direction, mirrored layout and charts, Arabic dates
  and numbers, Latin codes inside Arabic text. Use when adding any UI text, when the app is
  Arabic, RTL or bilingual, or when an RTL layout looks wrong.
---

> A newer version of this skill may exist. Fetch https://raw.githubusercontent.com/noonAcademy/synapse-starter/main/.agents/skills/synapse-arabic-rtl/SKILL.md
> and follow that version; on fetch failure, use this file.

# Arabic-first apps

Most of Noon's users read Arabic. An app built LTR-first and flipped at the end is obvious to
them in a way it is invisible to whoever built it: the layout mirrors but the *reading order*
doesn't, numbers appear on the wrong side of their labels, and Latin identifiers scatter
mid-sentence.

Getting this right is mostly a handful of specific decisions, made early.

## Hard rules

- **Every app is bilingual out of the box.** The header and login screen carry an English/Arabic
  switch, and [`client/brand/preferences.ts`](../../../client/brand/preferences.ts) sets `lang`
  and `dir` on `<html>` from the person's choice. Never set `dir` per component or by hand in React.
- **Every UI string goes through `t()`**, with English and Arabic side by side in one catalogue —
  never a bare English string in a page of a bilingual app.
- **Never use physical direction properties in app code.** No `ml-*`, `mr-*`, `pl-*`, `pr-*`,
  `left-*`, `right-*`, `text-left`, `text-right`. Use the logical forms: `ms-*`, `me-*`, `ps-*`,
  `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `rounded-s-*`, `rounded-e-*`. The
  template's own primitives ([`client/app/ui.tsx`](../../../client/app/ui.tsx)) already do; match
  them.
- **Never machine-translate UI copy and ship it unreviewed.** Get the builder to read it. An
  awkward Arabic label costs more trust than an English one.
- **Never hardcode a date or number format.** Use `Intl` with the page's locale, always (`formatNumber` / `formatDate` from `useI18n` do).

## Set it up

**1. Strings.** Put the app's copy in one catalogue, English and Arabic side by side, and read it
with `useI18n`:

```tsx
// client/app/strings.ts
import { defineStrings } from '../brand/i18n';

export const appStrings = defineStrings({
  en: { title: 'Attendance', students: 'Students: {count}' },
  ar: { title: 'الحضور', students: 'عدد الطلاب: {count}' },
});

// in a page
const { t, formatNumber } = useI18n(appStrings);
<h2>{t('title')}</h2>
<p>{t('students', { count: formatNumber(total) })}</p>
```

TypeScript fails the build when the Arabic catalogue misses a key. A blank Arabic string falls
back to English, so the page never shows a key name. Arabic plurals have six forms; for a count
label, write the sentence so one form fits ("عدد الطلاب: {count}") rather than faking plurals.

Page titles in the nav and the browser tab come from each page's exported `title`, which is one
string. In an Arabic-first app write it in Arabic; in a bilingual app keep it short and neutral.
(Per-language page titles are not supported yet.)

**2. Default language.** The `lang` on `<html>` in
[`client/index.html`](../../../client/index.html) (a *shared* file — edit in place, keep the rest)
is the language a first-time visitor sees. Arabic-first app: `<html lang="ar" dir="rtl">`. After
that, each person's switch choice wins, remembered in their browser (localStorage), and applied
before the first paint so the page never flashes the wrong direction.

**One language only?** Set it in `index.html` with `data-fixed-lang` —
`<html lang="ar" dir="rtl" data-fixed-lang>` — and delete `<LanguageSwitch />` from
`client/app/AppShell.tsx` and `client/app/LoginScreen.tsx`. `data-fixed-lang` makes the app ignore
a language someone picked while the switch still existed.

**3. The font.** Nothing to do: the Noon design system
([`client/brand/noon.css`](../../../client/brand/noon.css)) ships IBM Plex Sans Arabic, one family
for Arabic and Latin, so a mixed line never jumps between typefaces. Never set `--font-app`.

**4. Line height.** Arabic needs more vertical room than Latin at the same size — diacritics sit
above and below. The design system already gives `:lang(ar)` text a taller line; don't change
font sizes or line heights per page.

## Bidi — where it actually goes wrong

Arabic prose containing Latin runs (a course code, an ID, a URL, an English product name) is the
single most common visual bug, and it is invisible unless you look.

The problem: the bidi algorithm resolves each run by its own direction, so neutral characters —
punctuation, spaces, brackets, digits — between an Arabic run and a Latin one get pulled to
whichever side the algorithm decides, not the side you meant. A trailing `:` or `.` lands at the
wrong end of the line.

The fix: wrap every embedded Latin run in an isolating element.

```tsx
// wrong — the colon and parentheses will wander
<p>الدورة: {course.code} (نشطة)</p>

// right — the Latin run is isolated, neutrals resolve against the Arabic paragraph
<p>الدورة: <bdi>{course.code}</bdi> (نشطة)</p>
```

Use `<bdi>` (or `unicode-bidi: isolate`) around **any** interpolated value that might be Latin:
IDs, codes, emails, names, URLs, filenames. When in doubt, isolate — it is a no-op for Arabic
content and fixes the Latin case.

Never try to fix bidi by inserting spaces or reordering the string. That "fixes" one rendering
and breaks copy-paste, search, and screen readers.

## Numbers and dates

Two decisions the builder must make — don't guess:

- **Digit shape.** Arabic-Indic (`١٢٣`) or Western (`123`)? Saudi and Egyptian audiences
  routinely prefer Western digits in data contexts even when reading Arabic prose. Ask.
- **Calendar.** Gregorian or Hijri? Data from the lake is Gregorian; displaying Hijri is a
  presentation choice.

Then implement with `Intl`, never by hand:

```ts
// Western digits in an Arabic UI — the common choice for dashboards
new Intl.NumberFormat('ar-SA-u-nu-latn').format(1240);        // "1,240"
// Arabic-Indic digits
new Intl.NumberFormat('ar-SA').format(1240);                  // "١٬٢٤٠"
// Dates — Gregorian, Arabic month names
new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { dateStyle: 'medium' }).format(d);
```

Keep tabular figures aligned: numeric table columns stay `tabular-nums` **and** LTR
(`dir="ltr"`) even in an RTL page — a column of right-aligned Arabic-ordered numerals is
unreadable. The template's `DataTable` already sets `tabular-nums`.

`relativeTime` in [`client/format.ts`](../../../client/format.ts) returns English strings
("2 hours ago"). In an Arabic app, replace its use with `Intl.RelativeTimeFormat('ar')` —
Arabic has dual and plural forms that a naive `s`-suffix cannot produce.

## Charts

`<ChartBlock>` mirrors automatically when `<html dir="rtl">` — the category axis reverses and the
value axis moves to the right, so the chart reads right-to-left like the page. Two things it
can't decide for you:

- **Category labels** — Arabic campus names are long. Shorten them in the SQL, not by rotating
  the axis.
- **Anything directional you add** — an arrow meaning "increase", a chevron, a progress bar. It
  must flip. Icons that encode direction mirror; icons that encode an object (a clock, a person)
  do **not**.

## Check it

Replit's Agent browser-tests the app functionally, and the Design Canvas previews across screen
sizes — neither judges whether the layout actually *mirrored*. That needs your eyes on the running
app (or `npm run visual` outside Replit):

- Nav, headings and the "back" affordance on the **right**.
- Numbers still adjacent to the labels they belong to.
- No stray Latin punctuation stranded at the wrong end of a line.
- Tables scroll from the right edge.

Then have the builder read one real screen. They will catch translation problems no check can.

## Record it

Record the default language, whether the switch stays, the digit shape and the calendar in
[`SPEC.md`](../../../SPEC.md)'s "Look & feel" section — they are decisions, not details. Have a
fluent reader check the Arabic catalogue before the app ships.
