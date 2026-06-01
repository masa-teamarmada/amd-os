# Public Manuscript 07-14 Bridge / Redundancy Expansion

> Date: 2026-06-01 JST
>
> Scope: `pwa/bzm/public-manuscript/07` to `14`.
>
> Purpose: expand the middle manuscript arc so Chapters 07-10 carry the
> decision / responsibility / capital / learning sequence from the opening arc,
> and Chapters 11-14 bridge field material into the later theory without
> starting from model explanation.

## Inputs Reflected

- `PUBLICATION_POSITIONING.md` and `PUBLICATION_STRATEGY.md` were used as the
  publication gate: the manuscript keeps Before Zero field scenes and readers
  as the protagonist, not a company or internal operating system.
- The 00-06 editorial integration branch was used as the continuity reference:
  chapter endings now use action plus unresolved tension plus next pull instead
  of the old question-template ending.
- The page-turner audit was used as the main quality bar: scene before
  diagnosis, filled tools rather than empty checklists, and clear redundancy
  control across CEO-function / responsibility / founder-readiness material.
- The field-knowledge harvest was used for decision logs, role/function maps,
  risk-capital readiness, failure-learning logs, macro timing gaps, readiness
  axis examples, FRL translation, and institution nursery self-check patterns.
- Textbook commander mid-review feedback confirmed Chapter 07's direction and
  asked that the same quality be maintained across Chapters 08-14.

## Chapter-Level Changes

### 07 Company Now, Later, Or Never

- Rebuilt the chapter around a decision meeting scene and a filled
  GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT decision log.
- Reframed GO as risk-taking order, WAIT as work with return conditions, HOLD as
  a short information bridge, NO_GO as research-value preservation, and
  RESOURCE_SHIFT as resource redirection toward the lowest condition.
- Ending now pulls into responsibility allocation: judgment words fail if nobody
  carries the work behind them.

### 08 Who Carries What

- Shifted from broad role explanation to a practical responsibility map.
- Added a filled anonymous responsibility-allocation table across technical
  meaning, customer work, IP/disclosure, capital policy, hiring, researcher time,
  and failure learning.
- Added a young venture-builder / EIR first-30-days path to clarify how someone
  can carry a function before claiming a title.
- Kept Chapter 08 distinct from Chapter 04/05 and Chapter 13: this chapter is
  about actual responsibility placement, not the CEO-function hinge or founder
  readiness theory.

### 09 Before Risk Capital

- Opened with the night-before-investor-meeting tension around a polished deck
  that still mixes fact, hypothesis, expectation, and unverified claims.
- Added filled tables for fact / hypothesis / unverified / capital-to-reduce
  uncertainty, customer-signal stages, and fee-item-to-uncertainty translation.
- Reframed investor questions as a readiness diagnostic rather than a verdict on
  the research result or researcher.

### 10 Turning Failure Into Learning

- Opened after an investor meeting where short feedback becomes heavy emotional
  interpretation for different actors.
- Added filled learning logs for three cases: company interview stalls, investor
  team/capital-use criticism, and external executive trust mismatch.
- Reframed failure learning as a relationship-protecting practice: hypothesis,
  observation, missed signal, revised question, and next red flag.

### 11 Macro Tailwinds As Conditions

- Opened with a case that looks hot across policy, industry, research, capital,
  and social signals but has phase gaps underneath.
- Added a phase-gap table so tailwinds are read as conditions, not mood.
- Kept the theory bridge field-first: later theory names the phase gaps, but the
  chapter does not start from model language.

### 12 Readiness Axes

- Opened with a meeting where everyone says "ready" while meaning different
  things.
- Added a filled axis table for technology, business, governance, social, and
  human-resource readiness.
- Added failure examples caused by axis confusion, then bridged to TRL / BRL /
  GRL / SRL / HRL as later names for field distinctions.

### 13 Founder Readiness Field Language

- Opened with an external executive candidate who has strong credentials but has
  not yet earned researcher trust.
- Distinguished Chapter 13 from Chapter 08: Chapter 08 maps responsibilities;
  Chapter 13 translates founder readiness into non-delegable traits and
  complementable execution.
- Added contrasting candidate table and complementability map.
- Bridged to FRL / `F_character` / `F_capability` as names for a field lens, not
  as personality judgment.

### 14 Institution As Nursery

- Opened with a researcher facing many support menus but no visible
  responsibility path.
- Reframed institution readiness as a responsibility pipeline, not support-menu
  count.
- Added pipeline and nursery self-check tables covering seed discovery,
  IP/disclosure, use-case exploration, early capital, executive talent,
  company-formation judgment, and researcher protection.
- Bridged to ERS as the later theory name for the nursery layer, separate from
  individual venture readiness.

## Redundancy Control

- Chapter 04/05 remains the central CEO-function contradiction and hinge.
- Chapter 08 now handles "who actually carries which function" through filled
  responsibility maps and first-30-days work.
- Chapter 13 handles founder readiness as a field-to-theory lens: non-delegable
  traits versus complementable execution capacity.
- Chapter 06/07 separation is clearer: Chapter 06 handles incorporation timing
  pressure, while Chapter 07 handles the first decision conversation and
  decision-log operation.
- Chapter endings no longer use the old `明日使える問い` / `明日できる小さな行動`
  template.

## Public Safety

- Public manuscript body stayed within anonymous composite scenes and
  reader-first field language.
- No DB write, external service write, local applier `--apply`, UI, route,
  runtime, manifest, or deployment change was made.
- Internal implementation terms remain excluded from the public body.

## Still Weak / Next Review

- Chapters 07-14 now have filled tools and stronger bridges, but a future
  continuous-read editorial pass should test whether the case thread feels like
  one evolving composite case rather than adjacent anonymous scenes.
- Chapter 11's later theory bridge still names only the field-level phase-gap
  logic; the formal Chapter 15+ theory pass should decide how much notation
  belongs in main text versus appendix.
- Chapter 14 now points strongly into ERS, but the eventual ERS chapter must
  avoid turning institution readiness into ranking language.

## Handoff To 15-21 Theory Field-First Pass

- Open every theory chapter from a field scene already made visible in 07-14.
- Treat TRL / BRL / GRL / SRL / HRL / FRL / ERS as labels for problems the
  reader has already seen, not as first principles.
- Keep formulas and variable names behind field language until the reader needs
  them.
- Preserve the public-positioning gate: no company-protagonist framing, no
  internal operational vocabulary, no private case details.
- Continue using filled tools: readiness axis table, founder-readiness map,
  institution nursery self-check, bottleneck / decision-branch examples.

## Validation Plan

- Run `git diff --check`.
- Scan for conflict markers.
- Scan public manuscript 07-14 for prohibited public-manuscript terms.
- Scan 07-14 for old ending template terms.
- Check Markdown heading shape.
- Output chapter character counts.
- Skip `npm run build` because this pass changes only markdown manuscript and
  internal run-note / task-ledger files.
