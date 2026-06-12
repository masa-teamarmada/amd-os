# Public Book Readiness Audit

> Date: 2026-06-01 JST
>
> Scope: `pwa/bzm/*.md` and textbook source notes. This is an internal audit.

## Summary

The current textbook source is valuable, but it is not yet ready as a commercial
book manuscript. The dominant issue is that public-facing chapters still contain
internal project language, company-first framing, and implementation notes.

Commander judgment:

- Keep the current source as working material.
- Do not treat it as the sellable manuscript.
- Create a public manuscript layer and rewrite from a reader-first position.

## Main Readiness Issues

### 1. Company-first framing

Examples found across chapters:

- `AMD が見るべきもの`
- `AMD が切るべき分岐`
- `AMD の伴走余地`
- `AMD の提供価値`
- `AMD OS 運用`

Public-book risk:

Readers will feel that the book is asking them to admire the author's company,
not helping them solve their own field problems.

Required rewrite:

- Replace company-first subject with reader-facing roles:
  - `産学連携担当者`
  - `URA`
  - `研究者`
  - `事業化チーム`
  - `伴走者`
  - `支援機関`
- Keep company references only in an author note or very small case-context
  sections.

### 2. Internal authority framing

Examples found:

- `まさの経営判断`
- `まさの実務観察`
- `まさの直感`
- named internal quotes as theory authority

Public-book risk:

The reader does not know the internal authority context and will not accept it
as a reason to believe the model.

Required rewrite:

- Convert internal authority into field evidence:
  - "複数の事業化支援の現場で観察される"
  - "研究者支援の現場では"
  - "過去ケースを遡ると"
- Use named authorship only in preface/afterword if needed.

### 3. Internal operations leakage

Examples found:

- `D-7 Textbook Insights`
- `candidate`
- `local applier`
- `routing`
- `metadata_json`
- `source_hash`
- `pwa/bzm/*.md`
- `/spec`
- `正本`
- `司令塔`
- `worker`

Public-book risk:

These are production-system words, not book words. They break immersion and make
the manuscript look like internal documentation.

Required rewrite:

- Move these terms to internal production notes.
- If a concept is useful publicly, translate it:
  - `候補` -> `本に残すべき現場知`
  - `承認済み` -> `掲載判断を通した事例`
  - `local applier` -> never public

### 4. Private event leakage

Example found:

- `スタパイベントの文字起こしで強く出ていたのは`

Public-book risk:

The reader does not know the event and should not have to. The event is a source,
not the story.

Required rewrite:

- Convert event material into anonymized field scenes:
  - "ある研究支援の場で繰り返し出る矛盾は..."
  - "GAPファンドの場面では..."
  - "資金調達の場面では..."

### 5. Theory chapters need a field-language bridge

Current problem:

The theory chapters preserve valuable model content, but some explanations start
from formulas or internal validation before the reader has felt the field issue.

Required rewrite:

For every parameter, add the same public pattern:

1. What happens in the field.
2. Why it becomes a trap.
3. What question the reader should ask.
4. How the factor appears in the model.

## Preliminary Chapter Classification

This is a rough commander-level classification. Worker 1 should replace it with
a paragraph-level audit.

| Source | Public status | Notes |
| --- | --- | --- |
| `0-1-preface.md` | `public_rewrite` | Core intent is useful, but reader definition and internal terms need full rewrite. |
| `1-1-introduction.md` | `public_rewrite` | Likely usable as concept entry after removing internal frame. |
| `1-2-before-zero-field-landscape.md` | `public_rewrite` | Good field-first direction; needs stronger public-book prose. |
| `1-3-field-frictions-and-patterns.md` | `case_seed` | Stapa-derived material is strong, but event/internal references must disappear. |
| `1-4-gates-and-judgment-branches.md` | `case_seed` | GAP/VC contradiction is central; rewrite as public field chapter. |
| `1-5-relationships-and-learning.md` | `public_rewrite` | Relationship learning is important; remove AMD/L2 loop language. |
| `1-6-field-elements-to-bzm-variables.md` | `public_rewrite` | Very important bridge chapter; must cover all parameters in human language. |
| `2-1` to `7-1` theory chapters | `public_rewrite` | Preserve model, remove internal authority/company claims, add field bridges. |
| `8-1-amd-os-operations.md` | `internal_only` or `appendix_case` | Too product/internal for main public book. |
| `8-2` to `8-5` practice skeletons | `internal_only` for now | They are applier/routing receptacles, not public chapters yet. Convert selected material later. |
| `9-1` references | `public_rewrite` | Replace internal source paths with public references and bibliography. |
| `9-2` notation | `public_keep` after light edit | Mostly useful if internal terms are removed. |
| `9-3` glossary | `public_rewrite` | Good base; remove internal source note and company-specific claims. |
| `9-4`, `9-5` appendix/changelog | `internal_only` | Changelog/source governance is not public book material. |

## Recommended Next Workers

### Worker 1: Public-Manuscript Audit

Task:

- Scan `pwa/bzm/*.md`.
- Produce paragraph-level classification:
  - `public_keep`
  - `public_rewrite`
  - `internal_only`
  - `case_seed`
- List forbidden terms by file with suggested public replacement.

Deliverable:

- `pwa/bzm/textbook/runs/2026-06-01-public-manuscript-audit.md`

### Worker 2: Public TOC Draft

Task:

- Draft the sellable table of contents from `PUBLICATION_STRATEGY.md`.
- Map existing source chapters to public chapters.
- Mark missing source material.

Deliverable:

- `pwa/bzm/textbook/runs/2026-06-01-public-toc-draft.md`

## Commander Gate

No more raw case material should be appended to public-looking chapters until
the public manuscript split is decided.
