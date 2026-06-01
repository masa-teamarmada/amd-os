# Public Manuscript 00-06 Editorial Integration

> Date: 2026-06-01 JST
>
> Scope: `pwa/bzm/public-manuscript/00` to `06`.
>
> Purpose: record how the editorial audit, field-knowledge harvest, and
> commander review feedback were integrated into the public opening arc. This is
> an internal editorial note, not reader-facing copy.

## Inputs Reflected

- `origin/codex/textbook-public-manuscript-00-06-scene-first-rewrite` was used as
  the manuscript base for the opening arc.
- `origin/codex/textbook-editorial-page-turner-audit` was used as the main
  quality gate: scene before diagnosis, chapter endings with action plus
  unresolved tension plus next pull, and stronger dramatic pressure.
- `origin/codex/textbook-field-knowledge-harvest` was used to add concrete
  public-safe material beyond the GAP/VC/CEO hinge: false acceleration,
  customer-signal reading, clock maps, responsibility gaps, disclosure layers,
  CEO-function mapping, and GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT examples.
- Textbook commander review feedback was reflected by removing the old
  chapter-ending template, replacing `明日できる小さな行動` wording, filling the
  CEO-function table with an anonymous example, and adding a decision-branch
  example in Chapter 6.

## Chapter-Level Changes

### 00 Prologue

- Expanded the opening from a conceptual promise into a composite pitch-room /
  later finance-room contradiction.
- Added the three-document tension: pitch deck, technical explanation, and
  funding memo with unresolved blanks.
- End now pushes into the research-strength vs company-readiness confusion
  instead of closing as a clean summary.

### 01 Research Results Are Not Companies

- Added false acceleration: paper, IP possibility, company interest, support
  program, deck polish, and apparent startup readiness.
- Added concrete customer-signal questions and a filled memo table showing why
  `面白い` is not yet customer validation.
- End gives one immediate action while leaving the reader uneasy about
  different actor clocks.

### 02 Different Clocks

- Kept the one-week / one-deadline scene and added a usable clock map around
  pitch materials, company meetings, IP review, and investor meetings.
- Reframed the ending so the next problem is not clock difference itself, but
  the missing integrator who must return those clocks to one judgment map.

### 03 Support Can Isolate Researchers

- Added the corridor-of-rooms pressure: pitch, IP, company interview, investor
  prep, and internal explanation.
- Added a responsibility-flow table showing what each support room adds and
  what remains unowned.
- Reduced premature CEO-function explanation here and made the bridge into the
  CEO-function hinge more explicit.

### 04 Current File: `04-before-disclosure.md`, Displayed As CEO-Function Hinge

- The semantic order now follows `03 -> CEO function hinge -> disclosure ->
  timing`, but file names were not renamed in this pass to avoid UI / route /
  navigation churn.
- This means the file path and historical slug are temporarily misaligned with
  the displayed chapter title. A later ordering pass should decide whether to
  rename files and update public navigation metadata.
- Added actor rationality and a filled CEO-function table for the anonymous
  case, replacing the previous empty worksheet.

### 05 Current File: `05-gap-vc-ceo-function.md`, Displayed As Disclosure Chapter

- The chapter now treats disclosure as the consequence of outward acceleration
  after CEO-function mapping.
- Added public / NDA-needed / do-not-disclose-yet layers and tied them to
  company interviews, investor meetings, and researcher consent.
- The bridge now points to incorporation timing as the next irreversible
  pressure after role and disclosure design.

### 06 Incorporation Timing

- Strengthened irreversible stakes: DD / fundraising horizon, licensing,
  accounting, representative responsibility, fixed costs, hiring, and university
  conditions.
- Added GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT as an anonymous-case decision
  table, including next work and return conditions.
- End points into Chapter 7 as a facilitation problem: timing words must become
  a first conversation format.

## Commander Review Fixes Applied

- Removed `## 明日使える問い` headings from 00-06 and replaced chapter endings
  with `今日の行動、まだ残る不安`.
- Replaced remaining `明日できる小さな行動` body phrasing with non-template
  action language.
- Removed the extra staged `2026-06-01-public-manuscript-00-06-scene-first-rewrite.md`
  run note from this branch and consolidated the pass into this integration note.
- Kept the work scoped to manuscript and run-note markdown only. No UI, route,
  DB, external service, or local applier action was performed.

## Still Weak / Next Review

- The 04/05 semantic-order mismatch is still a structural debt. The manuscript
  reads in the requested order, but file slugs still reflect the earlier order.
- The opening arc is more specific, but later Chapters 07-14 still need a
  redundancy and bridge pass so CEO function, timing, and founder readiness do
  not repeat the same explanation.
- The case-zero thread should continue to mutate through Chapters 07-14 with
  filled tools: role worksheet, investor-feedback translation, failure-learning
  log, and institution nursery self-check.
- A later editorial pass should test whether the new action / unresolved tension
  endings actually create page-turn pull when read continuously.

## Validation Plan

- Run `git diff --check`.
- Scan for conflict markers.
- Scan 00-06 for the prohibited public-manuscript terms listed in the worker
  prompt.
- Confirm `rg -n "^## 明日使える問い"` has no hits.
- Check heading shape and chapter sizes.
- Skip `npm run build` because this pass changes only markdown manuscript and
  internal run-note files.
