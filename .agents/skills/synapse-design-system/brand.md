# Ink & Light on a screen: the Noon brand rules for Synapse apps

The default look of every Synapse app, and the rules that keep a page on brand. Part of the
**synapse-design-system** skill ([SKILL.md](SKILL.md)).

**These are defaults.** When the builder hasn't said anything about the look, follow them. When
the builder asks for something different, their ask wins: change tokens in
`client/app/theme.css` ([SKILL.md → Changing the look](SKILL.md)) and note it in `SPEC.md`'s
Decisions log. Nothing here is enforced by a check except "components use tokens".

## 0. Where this comes from

Noon's brand pack, **Ink & Light**, is written for slide decks (points, inches, "per slide").
This file is its screen translation. Where we had to interpret a slide rule for a web page, it's
marked **(screen)**: that's our reading, not the brand owner's words.

- **The full pack** (brand book, deck templates in English and Arabic, logos, artwork,
  illustrations) is on Noon's Google Drive:
  [Noon Brand Guidelines: Ink & Light](https://drive.google.com/drive/folders/1hrXv5_zUhnrAORqO7TvyxJyDF15RWNkL)
  (Noon accounts only). `NOON_BRAND_PACK.md` in that folder is the whole system written for an
  AI; read it when this file doesn't answer the question. With a Google Drive connector, search
  that folder; without one, ask the builder for the file.
- The pack calls itself the *working* brand system. If official guidelines replace it, they win;
  the Synapse team will update the defaults.
- **The illustrations are in this repo**, in
  [`client/brand/illustrations/`](../../../client/brand/illustrations/) (§5a). The faceted
  artwork, textures, photo frames and the smile are not: if a page needs one, get the file from
  the Drive folder (ask the builder) and add it under `client/app/`.

## 1. Colour

| Brand name | Hex (light) | Token / utility | Role on a screen |
|---|---|---|---|
| Paper | `#F7F1E6` | `bg-surface` | **The page ground** |
| Card | `#FDFBF6` | `bg-card` | Cards, panels, the header |
| Warm oak | `#E6DBCA` | `bg-muted` | Quiet cards, chips, the selected tab, secondary surfaces |
| Hairline | `#E4D9C7` | `border-line` | Every border, rule and divider (1px) |
| Espresso | `#3A2318` | `text-ink`, `bg-ink` | Body text and headings; dark blocks and filled chips. Our black |
| Warm grey | `#6B6152` | `text-ink-muted` | Secondary text, captions, labels |
| Terracotta | `#B75C38` | `bg-primary` | Weight: the main button, a hero tile, a statement band. **A fill, not a text colour** |
| Deep terracotta | `#9C4A26` | `text-primary-ink`, `bg-primary-strong` | Titles and headlines; button hover. **Never a large surface** (it goes muddy) |
| Future teal | `#647067` | `text-accent`, `bg-accent` | **The accent: one thing per view** |
| White / on-teal | `#FFFFFF` | `text-on-primary`, `text-on-accent` | Text on terracotta or teal |
| Clay, sage | `#D79A70`, `#98A398` | chart 4 and 6 | **Charts only** (darkened a little in the tokens to reach 3:1 on a card) |

- **Proportions matter more than the hex codes:** about 60% paper or sand, 20% oak, 15%
  terracotta, 5% teal. Light by default, terracotta for weight, teal as a highlighter.
- **Text-on-colour pairs** (use these, don't improvise): on terracotta, teal or espresso, text is
  white (`text-on-primary`, `text-on-accent`, or `text-surface` on `bg-ink`). On paper, card or
  oak, headings are espresso or deep terracotta and body text is espresso or warm grey, **except
  on oak, where body text is espresso** (warm grey on oak is 4.4:1, under AA).
- **Teal is one thing per view (screen).** Pick what it marks: the current selection, one
  eyebrow, or the links. A teal card beside a teal selection is two. Teal on oak fails contrast;
  an eyebrow on an oak card is espresso.
- **Status colours aren't in the brand (screen).** The pack has no red, amber or green. An app
  still needs errors and warnings, so `danger`, `warning` and `success` exist as state roles:
  use them only for state, and **always with a word**. Never for decoration or brand weight.
- **Retired:** navy `#11203A` and mint `#17E4A1` belong to the old brand. The only green in Ink &
  Light is the face in the logo; don't sample it for anything else.

## 2. Type

- **Quicksand Bold** (`font-display font-bold`) for page titles, section headings, card headings
  and big numbers. Bold only. **IBM Plex Sans** (`font-app`, the default) for everything else.
- **Numbers big, labels small.** A hero figure is `font-display text-display font-bold`; its
  label under it is `text-caption`.
- **Eyebrow** (a small label above a title): `text-caption font-bold uppercase tracking-widest
  text-accent ar:tracking-normal`. One per section, never a stack of them; espresso on an oak card.
- **Tables and aligned figures:** Plex with `tabular-nums`. No monospaced numbers.
- **Generous line height** (about 1.4× in Latin, 1.6× in Arabic; the tokens already do this).
- **Floor (screen):** nothing under 11px in Latin or 12px in Arabic. The pack's floors are
  accessibility rules, not taste. Use the token scale (`text-display`, `text-title`, `text-body`,
  `text-caption`), not the slide sizes.

## 3. Arabic and right to left

Most of what Noon sends to schools, parents and the Ministry is in Arabic, so this isn't an edge
case. The mechanics (direction, `t()`, bidi, number and date formatting) are in
**synapse-arabic-rtl**; the brand adds:

- **Faces:** Tajawal Bold for display, IBM Plex Sans Arabic for text. The tokens handle it:
  `font-display` falls through to Tajawal for Arabic letters and keeps digits in Quicksand, as the
  brand asks; `font-app` is Plex Arabic. Never set a Latin-only face on Arabic text.
- **Never letter-space Arabic.** The letters join, and spacing breaks them. Use `ar:tracking-normal`
  on anything with `tracking-*`, and get emphasis from weight and colour.
- **One numeral set per page.** Western digits (`1,560`) by default for anything with data;
  Eastern Arabic-Indic only for warm, ceremonial pages.
- **Punctuation:** the Arabic comma `،` and question mark `؟`.
- **A bilingual title:** Arabic first at full size, English beneath it at about 70% in
  `text-ink-muted`. Stacked, never side by side.
- **Mirror the frame, not the picture.** Reading order, arrows, timelines, chevrons and Back links
  flip; numbers, photos of real people and rooms, and **the logo** never do.

## 4. Charts and data

`<ChartBlock>` (**synapse-chart**) already uses the brand series in order: **terracotta,
espresso, teal, clay, warm grey, sage**, with horizontal hairline gridlines only. The judgement
calls are yours:

- **Single series:** every bar terracotta (the default). Past six series, use a table.
- **One bar is the point?** Say it in the title and put the number in the text beside the chart;
  the pack's "one terracotta bar, the rest oak" needs a custom chart (`useView` + Recharts with
  token colours read from CSS variables, as ChartBlock does).
- **Total, target, benchmark, last year:** espresso, and dashed if it's a target. Never
  terracotta: terracotta means "the thing we measure".
- **Prefer direct labels to a legend.** Keep multi-series charts to two or three series so the
  legend stays short, and name the series in the title.
- **Never let colour alone carry meaning.** Terracotta and teal have nearly the same lightness;
  in greyscale or to a colour-blind reader they look alike. Labels and the table under the chart
  fix that.
- **Action titles:** the heading states the finding ("Attendance up 12% since March"); the chart
  is the evidence. Check the number first (**synapse-verify-numbers**).

## 5. Shape, surfaces and imagery

- **Corners:** `rounded-card` (14px) on cards, tiles and panels; `rounded-control` (8px) on
  buttons and inputs; `rounded-full` on pills and chips.
- **Flat:** no shadows, gradients or glass. Depth is a hairline and a fill step (surface → card →
  muted). A focus ring is not a shadow; keep it.
- **Cards stay straight.** Only photos tilt (2–4°, alternating), plus the occasional date chip.
- **Photos:** real phone photos from real schools, in a white polaroid frame (border about 5% of
  the width, deeper at the bottom), no captions, never blurred, **never stock**. No photo? Use a
  number or an illustration instead.
- **Illustrations** (§5a): for human moments, such as welcomes, empty states, a question or a
  win. Never put an illustration and a photo of people side by side.
- **Icons:** the pack says "no icon sets". On a screen **(screen)**: no decorative icons, and no
  icon as an illustration or a bullet. A functional glyph on a control (×, ‹, ⓘ, a chevron) is
  fine with an accessible name.
- **The logo:** `<NoonLogo />` (SKILL.md). Clear space around it is the height of the "n"; keep the
  full logo at least ~100px wide **(screen)**; never recolour the letters, stretch it, add
  effects or mirror it.

## 5a. The illustrations

38 SVGs in [`client/brand/illustrations/`](../../../client/brand/illustrations/), drawn on one
skeleton: a single espresso outline at a constant weight, an ellipse face, two dot eyes, one
curved smile, shoulders below. Only the garment, hair and headwear change, which is what makes
them one family. They're Noon's artwork, synapse-owned (kit upgrades keep them current): use
them in Noon apps, don't edit them in an app, and don't redraw the skeleton.

**Use one** as an image, so its colours and ids stay its own:

```tsx
import highFive from '../../brand/illustrations/scene_highfive.svg';

<div className="rounded-card bg-art-ground p-card">
  <img src={highFive} alt="" className="mx-auto h-40 w-auto" />
</div>
```

- **Put it on `bg-art-ground`** (or straight on `bg-surface` / `bg-card` in light mode). The
  outlines are espresso, so on a dark ground they vanish; `bg-art-ground` stays light in dark mode.
- **`alt=""`** when it's decoration beside text that already says the thing (the usual case);
  a short `alt` only when the picture carries meaning the text doesn't.
- **Keep the aspect ratio**: size by height (`h-40 w-auto`) or width, never both. Scenes are made
  for a half-width block or a full-width band.
- **Don't mirror them in RTL**; they read the same both ways.
- **Never import them into a page as inline SVG markup** (several share ids such as `cloth`).

**The cast** (pick by the moment, and mix them; a row of identical characters misses the point):

| Files | What | Use for |
|---|---|---|
| `char_hijab_{terracotta,teal,deep,oak}`, `char_thobe_ghutra`, `char_thobe_shemagh`, `char_curly_{terracotta,teal}`, `char_bun_{deep,oak}`, `char_short_{sand,teal}` | 12 standing figures, arms down | anywhere a person stands for "someone": avatars, lists of people |
| `char_pk_dupatta_{terra,teal,deep,oak}`, `char_pk_kurta_{sand,teal}`, `char_pk_facilitator` | 7 figures in dupatta and kurta (the facilitator is pointing) | the Pakistan programme and team |
| `char_pose_wave_hijab`, `char_pose_wave_curly` | waving | welcomes, new joiners, a first-run screen |
| `char_pose_question`, `char_pose_think` | asking, thinking | a question, an open decision, "nothing found" |
| `char_pose_thumbs` | thumbs up | an approval, a win, "all done" |
| `char_pose_point_hijab` | pointing beside her | drawing attention to the thing next to it |
| `char_pose_book`, `char_pose_laptop` | reading, on a laptop | study, work, "loading your data" |
| `scene_highfive`, `scene_celebration` | two people high-fiving; a celebration | a win, a launch, a milestone |
| `scene_presenting`, `scene_classroom` | presenting at a board; a teacher and four students | teaching, explaining, a demo |
| `scene_row`, `scene_circle` | a row of four; a circle in discussion | a team or cohort; a workshop or townhall |
| `scene_videocall`, `scene_mentoring`, `scene_reading` | a call across cities; one-to-one; quiet study | distributed teams; onboarding and coaching; research |
| `doodle_kit` | squiggles, a star, arrows, a burst, a speech bubble, a question mark, a cross | one or two as punctuation, never as a border |

A pose beats a standing figure whenever the moment has a verb in it. Use a photo when you have
a real one; reach for an illustration when you don't, or when the screen is about people in
general rather than these people.

## 6. Voice

Warm, plain and specific, like a person who was in the room.

- **Numbers, not adjectives:** "12 schools", not "significant expansion". But check the figure
  first: an unverified number is worse than an adjective.
- **Own bad news first:** acknowledge it, commit to a next step, then explain.
- **Action titles:** the heading states the finding; the content below is the evidence.
- **One idea per card, section or view.** More than about five lines of body text is two sections,
  or goes behind a fold.
- Avoid "we aim to…", "the premier…", "across multiple verticals", "we are cognisant of".

## 7. Contrast, measured

WCAG AA: 4.5:1 for body text, 3:1 for large text, which WCAG sets at 18pt
(24px) or 14pt bold (about 18.7px). The light tokens:

| Pair | Ratio |
|---|---|
| Espresso on paper / card / oak | 13.0 / 14.2 / 10.7 |
| Warm grey on paper / card | 5.4 / 5.9 |
| Deep terracotta on paper / card | 5.5 / 5.9 |
| Teal on paper / card | 4.6 / 5.0 |
| White on terracotta / deep terracotta / teal | 4.6 / 6.1 / 5.2 |

**Below AA for body text** (fine only for large text: 24px+, or bold 18.7px+):

| Pair | Instead |
|---|---|
| Terracotta as text on paper (4.1) | `text-primary-ink` (deep terracotta); terracotta stays a fill |
| Warm grey on oak (4.4) | `text-ink` on `bg-muted` |
| Teal on oak (3.8) | An espresso eyebrow on oak |
| Warm grey on teal or terracotta (1.2–1.3) | Never; it's invisible |

When you recolour a token, measure the new pairs: relative luminance per WCAG 2.x, ratio
`(L1 + 0.05) / (L2 + 0.05)`. `scripts/brand-tokens.test.ts` has a ready `contrast()` helper.

## 8. The pack's hard don'ts, on a screen

| The pack says | On a screen |
|---|---|
| No navy, no mint | The same |
| No accent stripes, edge bars or underlines beneath titles | No `border-s-4` tone edges on cards, no coloured top edge on a panel, no bar under a title. Carry a tone with a tinted fill, the figure's colour and a word. A whole 1px border is fine |
| No drop shadows, no gradients | No shadows, gradient fills or frosted glass on cards and panels |
| No icon sets | No decorative icons (§5) |
| No tilted cards | The same: only photos tilt |
| More than one teal element | One teal thing per view |
| Text below 9pt | Nothing under 11px Latin, 12px Arabic |
| Stock photography | The same |
| Walls of text | More than ~5 lines of body is two sections, or a fold |

## 9. Checklist before calling a page on brand

- [ ] The ground is paper (`bg-surface`) with card and oak surfaces. No navy, mint, or library
      default chart colours.
- [ ] Titles and big numbers in `font-display font-bold`. Terracotta for weight, never body text.
- [ ] One teal thing in view.
- [ ] No shadows, gradients, glass, edge bars, title underlines or decorative icons.
- [ ] Every status colour has a word next to it; charts are labelled.
- [ ] Body text uses the safe pairs (§7); nothing under 11px.
- [ ] Arabic: no letter-spacing, one numeral set, Arabic punctuation, logo not mirrored.
- [ ] Real photos (polaroid) or the illustration cast, never both for people; no stock.
- [ ] Headings state the finding, and the numbers in them were checked.
