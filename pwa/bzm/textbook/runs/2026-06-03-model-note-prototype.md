# Model Note Prototype

Date: 2026-06-03 JST

Worker: Textbook commander / model note prototype

Scope:
- Add only two optional Model Notes to the narrative body.
- Prototype whether model exposition can appear without breaking story flow.
- Do not add notes broadly.
- Do not deploy.

Source basis:
- `pwa/bzm/textbook/runs/2026-06-03-model-exposition-placement-brief.md`
- `pwa/bzm/textbook/runs/2026-06-03-model-appendix-toc-draft.md`
- `pwa/bzm/textbook/runs/2026-06-03-public-notation-rewrite.md`

## Summary

Added two short optional Model Notes:

- Ch16: `Model Note: 五つの準備度`
- Ch19: `Model Note: 統合準備度`

The notes are intentionally short and placed after the chapter's narrative movement. They do not introduce long derivations. Each note points the reader to the Method Appendix and can be skipped without losing the story.

## Files changed

- `pwa/bzm/public-manuscript/16-readiness-axes-field-guide.md`
- `pwa/bzm/public-manuscript/19-integrated-score-as-next-action.md`
- `pwa/bzm/textbook/runs/2026-06-03-model-note-prototype.md`
- `pwa/bzm/textbook/COMMANDER_TASKS.md`

## Editorial rationale

Ch16 already ends by showing that five readiness axes keep being swallowed by external timing. The Model Note names TRL / BRL / GRL / SRL / HRL after the reader has seen why one word, "ready," is too coarse.

Ch19 already dramatizes RESOURCE_SHIFT through an A4 subtraction memo. The Model Note names the integrated formula only after the reader has seen that the model changes the next action rather than ranking the case.

## Guardrails

- No formula was added to Prologue, Ch01 through Ch15, Ch17 through Ch18, Ch20 through Epilogue, or Field Toolkit.
- Ch16 note has no formula.
- Ch19 note includes one compact formula reference and sends details to Method Appendix M5.
- Notes are explicitly optional.
- Notes do not use branded score language.

## Verification

Completed:

- `npm run build`: passed.
- Existing build warning: `middleware` file convention deprecated.
- `git diff --check`: passed.
- H1 count for changed public manuscript files: both exactly one.
- forbidden term scan on changed public manuscript files: no hits.
- old template / markdown table scan on changed public manuscript files: no hits.
- conflict marker scan: no hits.

## Next actions

1. `Appendix cold-reader review`
   - Review whether the two notes help or interrupt.
   - Decide whether to keep, shorten, style differently, or remove before adding any more notes.

2. `route/main integration review`
   - Review the full branch, build gate, and deploy bundling plan.
