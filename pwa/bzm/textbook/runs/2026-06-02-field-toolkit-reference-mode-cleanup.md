# Field Toolkit reference-mode cleanup Ch22-Ch24

Date: 2026-06-02 JST

Worker: Textbook public-manuscript Field Toolkit editor

Scope:
- `pwa/bzm/public-manuscript/22-field-note-safety-loop.md`
- `pwa/bzm/public-manuscript/23-decision-and-disclosure-toolkit.md`
- `pwa/bzm/public-manuscript/24-institution-nursery-checklist.md`
- `pwa/bzm/textbook/COMMANDER_TASKS.md`

## Objective

Ch22-Ch24を、本編の散文の第二エンディングではなく、読者が必要な場面で戻って使えるField Toolkit / reference-modeへ寄せた。

Acceptance target:
- A = field note safety / メモ安全化
- B = decision / disclosure / 結論直前の四枚の紙
- C = institution pilot / 研究機関の九十日運用紙

## Source basis

- `pwa/bzm/textbook/PUBLICATION_POSITIONING.md`
- `pwa/bzm/textbook/AUTHOR_DIRECTIVES.md`
- `pwa/bzm/textbook/runs/2026-06-02-act-v-ch15-24-cold-reader-editor-review.md`
- `pwa/bzm/textbook/runs/2026-06-02-ch19-resource-shift-artifact-pass.md`
- `pwa/bzm/public-manuscript/22-field-note-safety-loop.md`
- `pwa/bzm/public-manuscript/23-decision-and-disclosure-toolkit.md`
- `pwa/bzm/public-manuscript/24-institution-nursery-checklist.md`
- `pwa/src/app/(app)/bzm/public/public-manuscript.ts`

Note: `pwa/bzm/textbook/runs/2026-06-02-field-toolkit-appendix-separation.md` was not present in this worktree.

## Changes

### Ch22

- Opening shortened so the reader sees immediately that this is a tool, not a continuation of the main narrative.
- Reframed the chapter as a six-step reference flow:
  - raw record
  - layer split
  - question conversion
  - density selection
  - keep / move / compress
  - return to the next meeting
- Compressed the author-directive bank from an editor-facing explanation into a reader-facing `残す / 移す / 圧縮する` block.
- Preserved enough case continuity: deck sentence, budget owner absence, disclosure line, external leader fit, ninety-day uncertainty reduction.

### Ch23

- Reframed the chapter around four papers used immediately before a conclusion:
  - deck sentence downgrade
  - disclosure map with speaker / audience / situation
  - WAIT ledger with do-not-do items
  - budget-owner / investor-before evidence update
- Reduced continuous explanatory prose and made each paper's use case explicit.
- Kept the balanced financing-curve question: ambitious venture paths may be right for some seeds, but importing a curve without evidence can lower survival probability.

### Ch24

- Reframed the chapter as a research-institution take-home operating sheet.
- Split it into:
  - pilot charter
  - unknown / not_started distinction
  - responsibility pipeline
  - stop / expand gate
- Added an explicit `stop` gate so the pilot does not become automatic program expansion.
- Preserved the final public question as the whole-book close after the toolkit.

## Manifest

Manifest was read and not changed.

Reason: Ch22-Ch24 already have Field Toolkit A/B/C labels and titles aligned with the new reference-mode role.

## Verification plan

Required checks:
- `git diff --check`
- `git diff --cached --check`
- conflict marker scan
- changed public manuscript forbidden term scan
- old template / markdown table scan
- H1 count exactly one for each changed public manuscript file

Build:
- Omitted. This is markdown-only public manuscript / run-note / ledger work; no manifest or code changed.
- Production deploy omitted to preserve quota, as requested.

## Next actions

1. `support boundary pass`: ensure support programs, universities, investors, and external leaders keep local rationality and are not flattened into villains.
2. `Ch00-Ch24 surgical residue pass`: reduce remaining hidden lists, meta transitions, and theory-name staging without full rewrite.
3. `Field Toolkit layout/readability pass`: after route/page layout review, decide whether the public reader needs stronger visual sectioning around Field Toolkit.
