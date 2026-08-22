# Public Notation Rewrite

Date: 2026-06-03 JST

Worker: Textbook commander / public method appendix rewrite

Scope:
- Convert core notation concepts from internal `pwa/bzm/9-2-notation.md` into public-safe Method Appendix prose.
- Edit only Method Appendix public manuscript files.
- Do not touch Prologue-to-Epilogue story body.
- Do not deploy.

Source basis:
- `pwa/bzm/9-2-notation.md`
- `pwa/bzm/textbook/runs/2026-06-03-model-exposition-placement-brief.md`
- `pwa/bzm/textbook/runs/2026-06-03-model-appendix-toc-draft.md`
- `pwa/bzm/textbook/runs/2026-06-03-method-appendix-stub-implementation.md`

## Summary

Expanded the Method Appendix stubs with public-safe notation and formula explanations.

The rewrite keeps the useful formal structure:

- 0 to 9 axis scale and `+1` shift.
- `sigma_SU` and `mu_A / mu_I / mu_G`.
- Macro observation weighting and optional state-space reading.
- TRL / BRL / GRL / SRL / HRL.
- FRL, `F_character`, `F_capability`, and role-fit context.
- Integrated readiness as `S = K * product((X_i + 1)^alpha_i)`.
- Sensitivity / bottleneck reading.
- ERS normalization and weighted institutional readiness.

It removes or avoids the unsafe public framing:

- No branded score name in public appendix files.
- No old internal section numbering.
- No organization-specific examples.
- No claim that a number gives permission to incorporate.
- No founder readiness as personality judgment.
- No support-menu count as institutional readiness.

## Files changed

- `pwa/bzm/public-manuscript/27-method-notation-and-scale.md`
- `pwa/bzm/public-manuscript/28-method-macro-alignment.md`
- `pwa/bzm/public-manuscript/29-method-readiness-axes.md`
- `pwa/bzm/public-manuscript/30-method-founder-function.md`
- `pwa/bzm/public-manuscript/31-method-integrated-readiness.md`
- `pwa/bzm/public-manuscript/33-method-institutional-nursery.md`
- `pwa/bzm/textbook/runs/2026-06-03-public-notation-rewrite.md`
- `pwa/bzm/textbook/COMMANDER_TASKS.md`

## Public safety

The appendix now says more about the model, but still keeps the narrative boundary:

- No formulas were added to Prologue, Epilogue, or Ch01 through Ch21.
- Formulas appear only in Method Appendix files.
- Field Toolkit remains practical reference and was not mixed with the model appendix.
- Integrated readiness is framed as next work / uncertainty reduction.
- Weights are described as calibration choices, not hidden truth.
- ERS is described as responsibility pipeline, not support-menu count.

## Verification

Completed:

- `npm run build`: passed.
- Existing build warning: `middleware` file convention deprecated.
- `git diff --check`: passed.
- H1 count for changed public manuscript files: all exactly one.
- forbidden term scan on changed public manuscript files: no hits after replacing one incidental `まさに` substring.
- old template / markdown table scan on changed public manuscript files: no hits.
- conflict marker scan: no hits.

## Next actions

1. `Model Note prototype`
   - Add only two optional notes, likely after Ch16 and Ch19.
   - Check if they interrupt the story.

2. `Appendix cold-reader review`
   - Judge whether the appendix now helps technical readers without bait-and-switch.

3. `route/main integration review`
   - Merge this story polish branch with build/deploy gates.
