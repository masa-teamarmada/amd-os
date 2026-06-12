# Before Zero Textbook Publication Strategy

> Last updated: 2026-06-01 JST
>
> This document defines the public-book strategy for the Before Zero textbook.
> It is an internal editorial command file, not copy for readers.

## 1. Commander Diagnosis

The current `pwa/bzm/*.md` material is useful as a working source, but it is not
yet a sellable public manuscript.

The problem is not only wording. The current text still behaves like an internal
operating textbook:

- It names AMD / Team ARMADA, internal systems, local appliers, candidates,
  routing, specs, and source paths too often.
- It sometimes frames the book as "what AMD sees" instead of "what the reader
  can now see and do."
- The Stapa event material is being cited as "Stapa event transcript" inside the
  body, which makes the reader ask why they are reading an internal event memo.
- The theoretical chapters still contain valuable concepts, but many passages
  are written as model documentation rather than as chapters in a commercial
  book.

Strategic conclusion: keep `pwa/bzm` as a source-of-truth workspace, but create
a public manuscript layer with strict editorial gates. The public book should
not be "AMD is great." It should be a practical field book for people who have
to help research results become companies before the startup actually exists.

## 2. Public Book Definition

Working title candidates:

- `Before Zero: 研究成果を会社にする前に決めること`
- `研究成果を会社にする前に`
- `ディープテック事業化のBefore Zero`

One-line promise:

> 研究成果をスタートアップにする前の混乱を、研究者、産学連携担当者、
> URA、若い事業化人材が同じ地図で見られるようにする本。

What the book is:

- A practical field guide for the "before incorporation" phase of deep-tech
  startup creation.
- A reader-first explanation of the frictions, contradictions, decision gates,
  founder-readiness issues, institutional constraints, and timing problems that
  appear before a company is born.
- A bridge from field experience to theory: the field chapters make the reader
  feel the problem first, and the later theory chapters show how those field
  factors become model variables.

What the book is not:

- It is not a brochure for AMD / Team ARMADA.
- It is not an internal manual for AMD OS.
- It is not a public dump of L2/Textbook candidate operations.
- It is not a mathematical theory book that starts by asking readers to accept a
  model before they understand the pain.

## 3. Target Readers

Primary readers:

- University and public-research institute industry collaboration staff, URA,
  TLO, EIR, and startup support teams.
- Researchers who are considering commercialization but do not yet know whether
  incorporation is the right next move.
- Young people who want to become deep-tech startup founders, CEOs, COOs, or
  venture builders.

Secondary readers:

- VC, CVC, and grant-program operators who evaluate research-based ventures.
- Corporate R&D and new-business teams working with universities.
- Policymakers and ecosystem builders designing university-startup programs.

Reader jobs-to-be-done:

- "I want to know what breaks before a research startup is even incorporated."
- "I want a way to talk with researchers without forcing them to perform like a
  startup CEO too early."
- "I want to see why GAP-fund style presentation training and later VC
  fundraising expectations often contradict each other."
- "I want to distinguish missing business readiness from lack of researcher
  motivation."
- "I want practical questions and decision gates I can use before pushing a team
  toward company formation."

## 4. Market And Adjacent Book Research

This book sits between existing categories rather than inside only one of them.

### Startup Playbooks

Examples:

- Eric Ries, *The Lean Startup*.
- Steve Blank and Bob Dorf, *The Startup Owner's Manual*.
- Bill Aulet, *Disciplined Entrepreneurship*.
- Brad Feld and Jason Mendelson, *Venture Deals*.

What these books generally do well:

- Give founders structured startup-building methods.
- Explain customer development, iteration, venture design, and fundraising.
- Help readers move after they have accepted "this is a startup."

Gap for this book:

- They do not focus enough on the institutional and human mess before a
  research-based startup should exist.
- They rarely treat researcher identity, university incentives, IP timing,
  public funding, institutional support, and CEO-function decomposition as one
  connected pre-company problem.

### Technology Transfer And Academic Entrepreneurship

Examples:

- Technology transfer / university commercialization texts.
- Academic entrepreneurship and technological innovation books.
- University startup policy and support-program guides.

What these books generally do well:

- Explain technology transfer offices, IP, licensing, academic entrepreneurship,
  and institutional mechanisms.
- Help universities understand the commercialization process as a system.

Gap for this book:

- They often describe the institution and process more than the live judgment
  moments: when to wait, when to form a team, when to bring in a CEO, when to
  protect the researcher from a premature "startup pitch" frame, and when a
  support program is optimizing the wrong local metric.

### Japanese Deep-Tech Startup / University-Startup Field

Relevant public context:

- JST START and university-startup support programs.
- NEDO TCP and research-based startup commercialization programs.
- METI / MEXT university-startup and research commercialization policies.

What this field already talks about:

- University-originated startups, social implementation, grants, acceleration,
  IP, collaboration, and ecosystem building.

Gap for this book:

- Practitioners still need a plain-language operating lens for "Before Zero":
  the stage where everyone says they want startups, but each actor is optimizing
  a different local goal.

Research links used for this positioning:

- [The Lean Startup](https://theleanstartup.com/)
- [The Startup Owner's Manual](https://steveblank.com/books-for-startups/)
- [Disciplined Entrepreneurship](https://www.d-eship.com/)
- [Venture Deals](https://www.venturedeals.com/)
- [JST START](https://www.jst.go.jp/start/)
- [NEDO TCP](https://www.nedo.go.jp/activities/ZZJP_100091.html)
- [METI university-originated ventures overview](https://www.meti.go.jp/policy/innovation_corp/start-ups/start-ups.html)
- [MEXT university startup policy](https://www.mext.go.jp/a_menu/kagaku/chiiki/venture/)

## 5. Editorial Positioning

The book's winning position:

> A field-first book about the phase before a deep-tech startup becomes a
> startup, written for the people who must make better judgments before the
> company exists.

Core editorial promise:

- First show the field contradiction.
- Then name the trap.
- Then give the reader questions and decision gates.
- Then show how the theory captures the same factor.

Example transformation:

- Internal/manual voice: "AMD sees founder readiness as FRL."
- Public-book voice: "A research startup does not fail only because the
  technology is early. It can fail because nobody has named who will carry the
  founder function. That is why founder readiness must be treated as its own
  factor, not hidden inside general team capability."

## 6. Public Manuscript Structure

Recommended public-book structure:

### Part 1: Before Zero

Purpose: define the stage before incorporation and help readers recognize why
ordinary startup advice often starts too late.

Chapters:

1. Research results do not become startups by enthusiasm alone.
2. What actually happens before company formation.
3. Why support programs create local optimization.
4. The GAP fund / VC contradiction.
5. What "ready to incorporate" should mean.

### Part 2: The Field Traps

Purpose: make the reader feel the recurring failure patterns.

Chapters:

1. The researcher is asked to perform as a CEO before the CEO function exists.
2. A pitch gets polished while the business architecture remains missing.
3. IP, disclosure, and collaboration move on different clocks.
4. The wrong person is blamed for a missing structure.
5. The ecosystem celebrates activity while nobody owns readiness.

### Part 3: The Questions To Ask Before Zero

Purpose: give practical decision gates and conversation tools.

Chapters:

1. Should this become a company now, later, or not at all?
2. What founder function is missing?
3. What needs to be proven before asking for risk capital?
4. What should stay with the researcher, and what should be carried by others?
5. What support would reduce uncertainty instead of increasing theater?

### Part 4: Relationships And Learning

Purpose: show how support teams learn without turning cases into gossip or
advertising.

Chapters:

1. How to meet a researcher without forcing a startup frame.
2. How to design disclosure before excitement takes over.
3. How to read a failed project without looking for a villain.
4. How to turn field notes into reusable questions.

### Part 5: Field Factors Behind The Model

Purpose: explain every model parameter in field language before the equations.

Rule: every parameter gets a human chapterlet:

- What the reader sees in the field.
- Why the factor matters.
- What goes wrong if it is ignored.
- How to ask about it without humiliating the researcher.
- Where it appears in the later theory.

Required parameter coverage:

- Scientific/technical strength and timing.
- Market readiness.
- Institutional readiness.
- Government/policy readiness.
- Technology readiness.
- Business readiness.
- Governance readiness.
- Social/regulatory readiness.
- Human-resource readiness.
- Founder readiness.
- Ecosystem readiness.
- Bottleneck and timing.

### Part 6: The BZM Theory

Purpose: show the formal model only after readers already understand the field
problems.

Contents:

- sigma_SU and the Triple Helix interaction.
- XRL group.
- Founder Readiness Level.
- Integrated score and bottleneck diagnosis.
- Retrofit validation.
- Ecosystem readiness.

### Part 7: Tools, Cases, And Checklists

Purpose: make the book actionable.

Contents:

- Before Zero interview questions.
- Decision-branch checklists.
- Failure-learning templates.
- Relationship playbooks.
- Case patterns, anonymized and generalized.

## 7. Public / Internal Split

Public manuscript must exclude:

- AMD, AMD OS, Team ARMADA as repeated chapter subject.
- "まさ" as a named internal authority.
- L2, D-7 Textbook Insights, candidate, approved, local applier, routing, source_hash,
  metadata_json, migration, Supabase, Vercel, `pwa/`, `/spec`, "正本",
  "司令塔", "worker".
- Internal source notes such as "Stapa event transcript says..."
- Repository paths, implementation changelogs, and production deploy notes.

Allowed public mentions:

- One short author-note mention that the book is based on the authors' field
  experience supporting research commercialization.
- Case descriptions only when anonymized, generalized, and written as field
  lessons rather than self-promotion.

Internal material should move to:

- `pwa/bzm/textbook/COMMANDER_TASKS.md`
- `pwa/bzm/textbook/runs/*.md`
- future publication-production notes

Public manuscript output should be created as either:

- `pwa/bzm/public-manuscript/*.md`, or
- an export script that filters and rewrites source chapters into a publication
  bundle.

The current `pwa/bzm/*.md` can remain the living source until the public layer is
ready, but it should no longer be treated as the sellable manuscript itself.

## 8. Editorial Quality Gates

Every public chapter must pass these checks:

- Reader-first: the chapter starts from the reader's problem, not the author's
  organization.
- No internal vocabulary: forbidden terms above are absent unless in a private
  editorial note.
- No event-name leakage: private events become generalized field scenes.
- No company bragging: author experience appears only as evidence, not as the
  product.
- Practical close: each chapter ends with questions, decision gates, or a field
  lens the reader can use.
- Theory bridge: if a parameter appears later in the model, the chapter explains
  the field version first.

## 9. Immediate Work Plan

### Worker 1: Public-Manuscript Audit

Goal: scan all public candidate chapters and classify each paragraph.

Output:

- `public_keep`: sellable as-is or with light copyedit.
- `public_rewrite`: valuable idea, but internal/company-first wording.
- `internal_only`: OS operations, L2 pipeline, changelog, source path, deploy,
  or commander content.
- `case_seed`: field material that should become anonymized public case copy.

### Worker 2: Public Outline And TOC

Goal: produce a sellable table of contents using the structure in this document.

Output:

- Public chapter list.
- One-line promise for each chapter.
- Existing source chapters mapped to the new public chapter.
- Missing chapters and required source material.

### Worker 3: Stapa Material Rewrite

Goal: rewrite the Stapa-derived material without naming the event.

Output:

- Public scenes about local optimization, GAP fund / VC contradiction,
  researcher-CEO expectations, and founder-function decomposition.
- Internal source note remains in `runs/`, not in public copy.

### Worker 4: Theory-Chapter Humanization

Goal: make every parameter feel like a field factor before a formula.

Output:

- Public explanations for all model variables.
- Removal of "AMD", "まさ", and internal authority framing.
- Theory chapters kept mathematically intact but reader-oriented.

### Worker 5: Publication Lint

Goal: add an automated check for public-manuscript forbidden terms.

Output:

- A small script or checklist that fails on internal terms in the public export.
- Manual override mechanism for author-note exceptions.

## 10. Commander Decision

Do not continue adding more raw cases directly into `pwa/bzm/*.md` as if that is
the final book. First split public manuscript strategy from internal source
operations, then rewrite chapters toward a reader-first book.

The next best move is Worker 1 + Worker 2 in parallel:

- Worker 1 protects the book from internal leakage.
- Worker 2 gives the sellable structure that future writing can aim at.
