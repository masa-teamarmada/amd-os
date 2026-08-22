# Method Appendix Stub Implementation

Date: 2026-06-03 JST

Worker: Textbook commander / method appendix implementation

Scope:
- Add public manuscript stub files for Method Appendix M0 through M8.
- Add a new manifest section after Field Toolkit.
- Keep Prologue-to-Epilogue story body unchanged.
- Do not implement full notation rewrite in this pass.
- Do not deploy.

Source basis:
- `pwa/bzm/textbook/runs/2026-06-03-model-exposition-placement-brief.md`
- `pwa/bzm/textbook/runs/2026-06-03-model-appendix-toc-draft.md`
- Internal notation source `pwa/bzm/9-2-notation.md`

## Summary

Created a public-facing Method Appendix shell so formulas and model language have a safe home outside the narrative.

The new appendix is intentionally placed after Field Toolkit in the public manuscript manifest. This keeps the story close intact: Prologue through Epilogue still ends before any formula-oriented material appears, and Ch22 through Ch24 remain practical reference tools rather than mixed model chapters.

## Added files

- `pwa/bzm/public-manuscript/26-method-how-to-read-the-model.md`
- `pwa/bzm/public-manuscript/27-method-notation-and-scale.md`
- `pwa/bzm/public-manuscript/28-method-macro-alignment.md`
- `pwa/bzm/public-manuscript/29-method-readiness-axes.md`
- `pwa/bzm/public-manuscript/30-method-founder-function.md`
- `pwa/bzm/public-manuscript/31-method-integrated-readiness.md`
- `pwa/bzm/public-manuscript/32-method-evidence-rules.md`
- `pwa/bzm/public-manuscript/33-method-institutional-nursery.md`
- `pwa/bzm/public-manuscript/34-method-misuse-warnings.md`

## Manifest update

Added a new final manifest section:

`Method Appendix — モデル補遺`

The section uses appendix numbering M0 through M8 and comes after:

1. Prologue
2. Part 1 through Part 5
3. Epilogue
4. Field Toolkit

## Public safety choices

- No formulas were added to Prologue, Epilogue, or Ch01 through Ch21.
- The appendix stubs avoid internal organization terms and old branded score positioning.
- Integrated readiness is framed as next action / uncertainty reduction, not ranking.
- Founder readiness is framed as role fit and complement design, not personal judgment.
- ERS is framed as responsibility pipeline and operating design, not support-menu count.
- Misuse warnings preserve the author directive around survival probability, earning body, delayed incorporation, and skepticism toward one-size-fits-all J-curve pressure.

## Verification

Completed:

- `npm run build`: passed.
- Existing build warning: `middleware` file convention deprecated.
- `git diff --check`: passed.
- manifest consistency check: missing markdown `[]`, unlisted public manuscript markdown `[]`.
- H1 count for new appendix files: all exactly one.
- forbidden term scan on new public manuscript files: no hits.
- old template / markdown table scan on new public manuscript files: no hits.
- conflict marker scan: no hits.

## Next actions

1. Public notation rewrite:
   - Convert `pwa/bzm/9-2-notation.md` into public-safe appendix prose.
   - Keep useful formulas.
   - Remove internal naming, old score framing, and false precision.

2. Model Note prototype:
   - Add two optional notes only, likely Ch16 and Ch19.
   - Test whether they interrupt the story.

3. Appendix cold-reader review:
   - Check whether the appendix helps technical readers without making the story feel like a bait-and-switch.

4. Route/main integration review:
   - Merge story polish and appendix changes in an ordered batch.
   - Build locally.
   - Keep production deploy bundled and quota-aware.
