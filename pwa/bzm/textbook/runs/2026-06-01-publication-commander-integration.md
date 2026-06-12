# Publication Commander Integration

> Date: 2026-06-01 JST
>
> Scope: Integrate Public-Manuscript Audit and Public TOC Draft.

## Commander Review

Both worker outputs pass commander review.

Reviewed artifacts:

- `pwa/bzm/textbook/runs/2026-06-01-public-manuscript-audit.md`
- `pwa/bzm/textbook/runs/2026-06-01-public-toc-draft.md`

## Integrated Judgment

The textbook source should now be treated as three layers:

1. Internal source layer: current `pwa/bzm/*.md`.
2. Editorial command layer: `pwa/bzm/textbook/*.md` and `pwa/bzm/textbook/runs/*.md`.
3. Public manuscript layer: new `pwa/bzm/public-manuscript/*.md`.

Do not use the current `pwa/bzm/*.md` files directly as the sellable book.
They remain useful source material, but public chapters must be rewritten into a
reader-first voice.

## Decision: Use A Public Manuscript Directory First

Decision:

- Start with `pwa/bzm/public-manuscript/*.md`.
- Do not begin with an export/rewrite script.

Reason:

- The current gap is editorial voice, structure, and reader contract, not file
  conversion.
- A hand-authored public layer lets the team judge whether the book sounds like
  a commercial manuscript before automating anything.
- Export/lint tooling should come after the first public chapters prove the
  target tone.

## Approved Public Spine

The target spine from the TOC worker is approved as the next drafting spine:

1. Prologue: 会社になる前に勝負が決まる
2. Part 1: Before Zero の現場
3. Part 2: Before Zero の鬼門
4. Part 3: 会社にする前に聞く問い
5. Part 4: 現場要素からモデル変数へ
6. Part 5: BZM 理論
7. Part 6: Tools, Cases, And Checklists

The first drafting worker should not attempt all 26 chapters. It should draft:

- Prologue
- Chapter 1. 研究成果は、熱意だけでは会社にならない
- Chapter 2. 関係者は同じ技術を見て、別の時計で動いている
- Chapter 3. 支援制度が増えても、研究者は孤独になる

These chapters set the reader contract and prove that the book is not an AMD
promotion piece.

## Non-Negotiable Public Voice Rules

Public manuscript drafts must avoid:

- AMD as repeated subject.
- まさ as authority.
- L2, D-7 Textbook Insights, candidate, local applier, routing, metadata, source_hash.
- pwa paths, specs, 正本, 司令塔, worker, deploy, Vercel, Supabase.
- Stapa event name or "transcript" as reader-facing source.

Public manuscript drafts should use:

- `研究者`
- `産学連携担当者`
- `URA`
- `支援者`
- `事業化チーム`
- `研究機関`
- `若い事業化人材`
- anonymized composite scenes

Author/company presence is allowed only as background credibility, not as the
subject of the chapter.

## Next Worker

Cut a worker:

`Textbook public manuscript prologue ch1-3`

Goal:

- Create the first public manuscript files under `pwa/bzm/public-manuscript/`.
- Draft in Japanese commercial-book prose.
- Use audit and TOC as constraints.
- Use Stapa-derived material only as anonymized composite scenes.
- Do not rewrite the internal source files.

Suggested files:

- `pwa/bzm/public-manuscript/00-prologue.md`
- `pwa/bzm/public-manuscript/01-research-results-are-not-companies.md`
- `pwa/bzm/public-manuscript/02-different-clocks.md`
- `pwa/bzm/public-manuscript/03-support-can-isolate-researchers.md`

Acceptance:

- Reads like a book for external readers.
- Does not read like AMD promotion.
- Does not leak internal operational vocabulary.
- Each chapter makes the reader feel a field problem and closes with practical
  questions or a lens.
