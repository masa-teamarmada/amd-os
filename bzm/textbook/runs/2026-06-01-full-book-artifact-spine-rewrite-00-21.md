# Textbook full-book artifact spine rewrite 00-21

Date: 2026-06-01 JST

## Summary

`Textbook full-book artifact spine rewrite 00-21` worker creation failed three times with `systemError`, so Textbook司令塔 directly performed a scoped manuscript rewrite in a clean worktree.

The goal was not to make the book final. The goal was to move the current public manuscript from a set of strong individual chapters toward one continuous reading experience by adding a recurring artifact spine: the same memo, slide, customer sentence, investor deck, readiness table, and evidence rule returning across the book with different meanings.

## Inputs

- Public positioning: `pwa/bzm/textbook/PUBLICATION_POSITIONING.md`
- Ruthless editor audit: `pwa/bzm/textbook/runs/2026-06-01-ruthless-editor-full-book-audit-00-21-v3.md`
- Deep source mining: `pwa/bzm/textbook/runs/2026-06-01-deep-source-mining-v4.md`
- 00-14 body source branch: `origin/codex/textbook-public-manuscript-00-14-continuous-page-turner`
- 15-21 body source branch: `origin/codex/textbook-public-manuscript-15-21-continuous-theory-narrative`

## What Changed

### Traveling artifact spine

- Chapter 00 now introduces a three-column memo: what can be shared outside, what can be shared only in limited contexts, and what must not leave the room yet.
- Chapter 01 turns an enterprise reaction into the dangerous line `顧客候補あり`, then decomposes it into missing evidence and next questions.
- Chapter 05 turns the memo into a slide-level red/yellow/blue disclosure map.
- Chapter 09 brings the same slide into investor-preparation tension and separates technical scout, evaluator, budget owner, field site, and procurement.
- Chapter 16 brings the `顧客候補あり` line back and rewrites it into a weaker but more decision-useful evidence statement.
- Chapter 20 brings all artifacts back as evidence rules to revise, not as proof that the case itself should be discarded.

### Ch05 / disclosure pressure

Ch05 was strengthened around a specific slide that travels through company materials and investor materials faster than protection can follow. The chapter now treats disclosure design as a way to control the speed of misunderstanding, not merely a legal/IP checklist.

### Ch11 / Ch12 cooling reduction

Ch11 and Ch12 now connect macro heat and readiness axes back to the same case pressure: grant deadlines, regional demonstration opportunities, company interest, and investor enthusiasm can all make a weak `GO` feel strong. The rewrite keeps the reader inside the ongoing case instead of shifting into abstract explanation.

### Customer-validation thread

Ch01, Ch09, and Ch16 now distinguish enterprise interest from customer truth by separating:

- technical scout
- evaluator
- budget owner
- field operator
- procurement/legal

This is intended to make `BRL` feel like a field problem before it becomes a model parameter.

### Young commercialization talent thread

Ch08 and Ch18 now give the young commercialization person a clearer arc: Day 1 / Day 3 / Day 10 / Day 20 / Day 30 work, and the small but important authority to say `未確認` without killing momentum.

### Toolkit chapters added

Three new post-theory draft chapters were added:

- `22-field-note-safety-loop.md`: how field notes become public reusable questions without leaking confidential or case-specific details.
- `23-decision-and-disclosure-toolkit.md`: decision log, disclosure map, customer signal ladder, and role map.
- `24-institution-nursery-checklist.md`: institutional nursery checklist, unknown vs not_started distinction, and a first-90-days operating design.

## Public Safety

The public manuscript still follows the positioning rule:

- Do not make the book a company introduction.
- Do not use internal organization names, thread/workflow terms, implementation paths, or product operations language.
- Treat internal materials as source material only after anonymization, generalization, and reader-first rewriting.

## Self-Critique

- The rewrite improves continuity, but it is still not a final sale-ready manuscript.
- Ch15, Ch17, Ch19, and Ch21 were mostly imported from the continuous theory branch; they now sit inside a stronger artifact spine but still need a cold-reader review against the whole 00-24 reading experience.
- Ch22-24 are useful as a toolkit scaffold, but they may need either more narrative framing or a separate appendix structure.
- Ch04/Ch05 filename/title order debt remains out of scope because route/navigation work was intentionally avoided.

## Next Review Gate

Run a cold-reader / ruthless-editor review on 00-24 with these questions:

1. Does the recurring artifact spine make the book feel like one continuous reading experience?
2. Do Ch11-12 still cool down too much?
3. Do Ch15-21 now feel earned by the preceding field chapters?
4. Should Ch22-24 be body chapters, appendices, or a toolkit section after the theory part?
5. What must be rewritten before any production deploy or public reading review?
