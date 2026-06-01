# Textbook next rewrite gate: artifact spine follow-up

Date: 2026-06-01 JST

## Purpose

This note prepares the next manuscript rewrite after two active workers return:

- `Textbook cold-reader review artifact spine 00-24`
- `Textbook source mining budget-owner / artifact scenes v5`

The next rewrite must not merely add more paragraphs. It must make the paid-book objective more true: a reader should feel pulled through the book by unresolved tensions, recurring artifacts, and increasingly useful field tools.

## Current Base

- Base branch: `codex/textbook-full-book-artifact-spine-rewrite-00-21-v3`
- Base commit: `6234fcf docs(textbook): add artifact spine rewrite`
- Current public manuscript range: `pwa/bzm/public-manuscript/00*.md` through `24*.md`

## Rewrite Entry Criteria

Start the next rewrite only after at least one of these is true:

1. Cold-reader review returns P0/P1 rewrite orders.
2. Source-mining v5 returns P0素材 with chapter insertion map.
3. A worker stalls long enough that司令塔 must continue directly to avoid idle, in which case use partial thread evidence and mark it as partial.

## P0 Rewrite Gate

The next rewrite must satisfy all applicable P0 items:

- Keep public positioning: no company-introduction voice, no internal organization names, no implementation/workflow terms in public manuscript.
- Preserve the recurring artifact spine, but make it feel less like a device and more like a lived object that keeps causing new consequences.
- Add at least one stronger scene where enterprise interest fails to become customer truth because the budget owner or operational owner is missing.
- Add at least one stronger scene where a traveling slide/email/deck nearly causes a disclosure or trust failure.
- Add at least one case where `WAIT` becomes real work and later changes the branch decision.
- Make Ch11-12 carry narrative pressure instead of cooling into framework explanation.
- Make Ch15-21 feel earned by the field chapters, especially where theory terms appear.
- Decide whether Ch22-24 remain body chapters, become appendix/toolkit chapters, or need narrative framing.
- Remove or relocate obvious repetition across Ch04/Ch08/Ch13/Ch18.
- Address the Ch04/Ch05 title/filename/semantic-order debt, at least in a route-safe manuscript note if file rename is out of scope.

## Acceptance Evidence

The rewrite is not accepted by intuition. It needs evidence:

- Public manuscript forbidden-term scan returns no hits.
- Old template scan returns no hits.
- Conflict marker scan returns no hits.
- Every public manuscript file has exactly one H1.
- Run note maps each P0 order to changed chapters.
- `git diff --check` passes.
- Worker or司令塔 final report includes dirty/conflict/untracked classification and unpushed log.

## Next Worker Prompt Seed

Suggested next worker name:

`Textbook public manuscript artifact spine P0 rewrite`

Suggested instruction:

Use the base branch plus cold-reader review and source-mining v5. Edit public manuscript directly, but only where P0/P1 orders make the book more compelling and more content-rich. Do not add generic explanation. Add scenes, documents, conflict, consequence, and tool usefulness. Keep the book reader-first and non-promotional.
