# Publication Positioning Scan

> Date: 2026-06-01 JST
>
> Scope: Direction gate for public manuscript Prologue through Chapter 14.

## Trigger

AMD総司令塔から、公開本の根本設計について方針修正が出た。

Key point:

- The book must not open as a company introduction.
- `AMD` is an internal abbreviation and should not be used in public manuscript
  body copy.
- The book should be a universal Before Zero field book, not a promotion piece
  for the support provider.

## Positioning Decision

The publication-positioning gate is now formalized in:

- `pwa/bzm/textbook/PUBLICATION_POSITIONING.md`

Core rules:

- Main subject: Before Zero, not AMD / Team ARMADA / the author company.
- Public manuscript body: do not use `AMD`, `Team ARMADA`,
  `株式会社チームアルマダ`, or `まさ`.
- Company references are allowed only in author bio, acknowledgements,
  methodology note, or a later approved appendix.
- Narrator stance: field-literate guide, not salesperson.
- Opening promise: help readers read the pre-incorporation phase through
  practical questions and decision gates.

## Existing Public Manuscript Scan

Scanned files:

- `pwa/bzm/public-manuscript/00-prologue.md`
- `pwa/bzm/public-manuscript/01-research-results-are-not-companies.md`
- `pwa/bzm/public-manuscript/02-different-clocks.md`
- `pwa/bzm/public-manuscript/03-support-can-isolate-researchers.md`
- `pwa/bzm/public-manuscript/04-before-disclosure.md`
- `pwa/bzm/public-manuscript/05-gap-vc-ceo-function.md`
- `pwa/bzm/public-manuscript/06-incorporation-timing.md`
- `pwa/bzm/public-manuscript/07-company-now-later-or-never.md`
- `pwa/bzm/public-manuscript/08-who-carries-what.md`
- `pwa/bzm/public-manuscript/09-before-risk-capital.md`
- `pwa/bzm/public-manuscript/10-turning-failure-into-learning.md`
- `pwa/bzm/public-manuscript/11-macro-tailwinds-as-conditions.md`
- `pwa/bzm/public-manuscript/12-readiness-axes.md`
- `pwa/bzm/public-manuscript/13-founder-readiness-field-language.md`
- `pwa/bzm/public-manuscript/14-institution-as-nursery.md`

Scan result:

- No hits for `AMD`, `Team ARMADA`, `チームアルマダ`, `株式会社`, `まさ`,
  `当社`, `弊社`, `私たち`, `スタジオ型`, or `経営支援会社`.
- No private event or transcript references were found in public manuscript
  body copy.
- The hits for `営業` are ordinary business-function language, not company sales
  copy.
- The Prologue explicitly says the book is not a success story or a promotion
  for a support method. This is aligned with the positioning gate.

## Direction Risk Assessment

Current public manuscript Prologue through Chapter 14 passes the positioning
gate.

Reasons:

- The protagonist is the reader's Before Zero field, not a company.
- The chapters speak to researchers, industry-collaboration staff, URA,
  support teams, companies, investors, and research institutions.
- No chapter requires knowledge of internal systems or author-company shorthand.
- Theory terms are introduced only after field language.

Remaining risks:

- Future author bio / methodology note could accidentally become company
  introduction copy.
- Future theory chapters could revive old `AMD Score` branding in a way that
  makes the book feel company-owned rather than reader-owned.
- Future case studies could over-identify the author's projects or private
  events.

## Commander Instructions Going Forward

Before cutting more drafting workers:

- Include `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` in the required reading.
- Add the company-name policy to every public-manuscript worker prompt.
- Do not cut an author-note, methodology-note, or case-study worker until the
  company/name treatment is explicitly reviewed.
- Treat public terms like `Before Zero Readiness Score` as provisional until the
  public naming of `AMD Score` is decided.
