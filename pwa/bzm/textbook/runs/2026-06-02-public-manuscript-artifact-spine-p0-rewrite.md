# Textbook public manuscript artifact spine P0 rewrite

Date: 2026-06-02 JST

Worker: `Textbook public manuscript artifact spine P0 rewrite`

Branch: `codex/textbook-public-manuscript-artifact-spine-p0-rewrite`

Base: `origin/codex/textbook-full-book-artifact-spine-rewrite-00-21-v3` at `6aa6da4e6d379cc0d3708e8f891ab3219107fc1b`

## Purpose

Directly reflect the P0 orders from the cold-reader review and source-mining v5 into the public manuscript body. This pass edits `pwa/bzm/public-manuscript/*.md` only for manuscript prose and toolkit framing. It does not change routes, UI, code, DB, external services, deploy state, or public-release status.

## Inputs

- `pwa/bzm/textbook/PUBLICATION_POSITIONING.md`
- `pwa/bzm/textbook/COMMANDER_TASKS.md`
- `pwa/bzm/textbook/runs/2026-06-01-next-rewrite-gate-artifact-spine.md`
- `pwa/bzm/textbook/runs/2026-06-01-full-book-artifact-spine-rewrite-00-21.md`
- `origin/codex/textbook-cold-reader-review-artifact-spine-00-24:pwa/bzm/textbook/runs/2026-06-01-cold-reader-review-artifact-spine-00-24.md`
- `origin/codex/textbook-source-mining-budget-owner-artifact-scenes-v5:pwa/bzm/textbook/runs/2026-06-01-source-mining-budget-owner-artifact-scenes-v5.md`
- `origin/codex/textbook-ruthless-editor-full-book-audit-00-21-v3:pwa/bzm/textbook/runs/2026-06-01-ruthless-editor-full-book-audit-00-21-v3.md`
- Current public manuscript `00` through `24`

## Changed Public Manuscript Files

- `pwa/bzm/public-manuscript/01-research-results-are-not-companies.md`
- `pwa/bzm/public-manuscript/05-gap-vc-ceo-function.md`
- `pwa/bzm/public-manuscript/06-incorporation-timing.md`
- `pwa/bzm/public-manuscript/07-company-now-later-or-never.md`
- `pwa/bzm/public-manuscript/09-before-risk-capital.md`
- `pwa/bzm/public-manuscript/11-macro-tailwinds-as-conditions.md`
- `pwa/bzm/public-manuscript/12-readiness-axes.md`
- `pwa/bzm/public-manuscript/15-why-model-the-field.md`
- `pwa/bzm/public-manuscript/16-readiness-axes-field-guide.md`
- `pwa/bzm/public-manuscript/17-macro-alignment-and-triple-helix.md`
- `pwa/bzm/public-manuscript/18-founder-readiness-field-first.md`
- `pwa/bzm/public-manuscript/19-integrated-score-as-next-action.md`
- `pwa/bzm/public-manuscript/20-retrofit-validation-as-learning.md`
- `pwa/bzm/public-manuscript/21-institution-readiness-as-nursery.md`
- `pwa/bzm/public-manuscript/22-field-note-safety-loop.md`
- `pwa/bzm/public-manuscript/23-decision-and-disclosure-toolkit.md`
- `pwa/bzm/public-manuscript/24-institution-nursery-checklist.md`

## P0 Coverage

| P0 order | Coverage |
|---|---|
| Ch05 traveling slide mini-plot | Ch05 now opens on a scheduled email / deck moment stopped by the IP-side reviewer, shows who stopped it, what would have broken, and how researcher trust would have been damaged. It adds a red / yellow / blue slide map and distribution log. |
| Budget-owner failure thread | Ch01 adds a later budget-owner absence scene and before/after wording for `顧客候補あり`. Ch09 adds the pre-investor email where interest fails to reach evaluation budget. Ch16 reuses the weaker evidence statement. Ch20 rewrites old evidence rules into new rules. |
| WAIT-as-work payoff | Ch06 and Ch07 define WAIT as owner / return condition / review date, distinguish empty WAIT from HOLD or avoidance, and add a 90-day later movement toward GO. Ch19 shows RESOURCE_SHIFT increasing future GO possibility. |
| Ch11-12 cooling fix | Ch11 adds a credible objection that waiting creates opportunity loss, then resolves it by using public-program heat without treating it as company-readiness proof. Ch12 adds lowest-axis counterfactuals that change next action by business, governance, social, and people axes. |
| Ch15-21 roughness | Ch15 adds a bad meeting where the researcher rejects too-strong language. Ch17 adds field-operator resistance. Ch18 adds protected-line repeat-back. Ch19 cuts attractive premature activities. Ch20 uses old evidence rule / new evidence rule before-after wording. Ch21 turns unknown vs not_started into a live meeting conflict. |
| Ch22-24 toolkit / appendix repositioning | Ch22-24 H1s now read as Toolkit A/B/C. Openings frame them as practical appendix tools, not narrative body chapters. Ch22 and Ch23 add filled examples; Ch24 shifts toward pilot charter and first-90-days use. |
| Repetition reduction / rhythm variation | Several additions end with changed artifacts, repaired trust, cut activities, or live objections rather than the same chapter-end question pattern. Toolkit chapters carry examples instead of repeating the full Ch14/21 theory. |

## Build / Deploy

`npm run build` was omitted because this pass changes Markdown manuscript prose and one run note / ledger only. No route, UI, API, dependency, or runtime code changed. No deploy was performed.

## Verification Plan

Required after edits:

- `git diff --check`
- `git diff --cached --check`
- conflict marker scan
- public manuscript forbidden-term scan
- old template scan
- H1 count for public manuscript files
- final `git status -sb`
- final `git log --branches --not --remotes --oneline`

## Notes For Next Review

This is a P0 direct rewrite, not a final publication pass. Recommended next action is a cold-reader / editor check focused on whether the added scenes feel integrated rather than pasted in, and whether Toolkit A/B/C should eventually move to a separate route or remain as post-body manuscript files.
