# Textbook editorial narrative reset audit

Date: 2026-06-02 JST

Worker: `Textbook / public manuscript editor critic`

Scope:
- Read the current public manuscript `pwa/bzm/public-manuscript/00` through `24`.
- Inspect the OS routes that expose the textbook/BZM content.
- Compare the public manuscript layer with the old `pwa/bzm/*.md` BZM body.
- Do not rewrite manuscript body in this pass.

## Executive verdict

This is not yet a sellable book.

The public manuscript is no longer an obvious company brochure, but it still reads too often like a well-intentioned internal workbook that has learned to open chapters with scenes. It has moments of real narrative pressure, especially the recurring slide / memo / budget-owner thread, but the dominant unit is still "chapter explains a correct concept, then gives a table, then closes with questions." That is not a book a tired reader keeps turning pages through. It is a useful training binder with some narrative paragraphs inserted.

The more serious P0 failure is route/content mismatch. The OS navigation labeled `📚 教科書` points to `/bzm`, and `/bzm` redirects to `/bzm/0-1-preface`, which renders old `pwa/bzm/{slug}.md` content. That old first page still opens as an AMD/Team ARMADA internal textbook: it says `株式会社チームアルマダ（AMD）`, includes `AMD のメンバーおよび AMD OS の利用者` as a target reader, and later uses `AMD が見るべきもの`. So when a reader clicks "教科書", they are likely not seeing the public manuscript at all. They are seeing the old internal BZM source that violates the reader-first publication gate.

The correct editorial conclusion is not "do another surgical pass." The next cycle must be an architecture reset:

1. Fix the OS route/content mismatch first.
2. Make the public manuscript the first reader-facing textbook surface.
3. Rebuild the manuscript around one continuous composite protagonist/case arc.
4. Move most tables, checklists, rubrics, and templates out of the main narrative into appendix/toolkit sections.
5. Introduce BZM theory only after the reader has lived through the field contradiction and wants a map.

## Why this is not a book yet

### It still thinks in chapters, not in a reader's anxiety

The current 00-24 manuscript is organized by correct topics:

- research results are not companies;
- different clocks;
- support can isolate researchers;
- CEO function;
- disclosure;
- incorporation timing;
- readiness axes;
- retrofit;
- institution readiness;
- toolkit.

Those are all important. But a book is not a list of important things. A book is a controlled sequence of pressure, recognition, consequence, relief, and new uncertainty.

The current manuscript often starts chapters with a scene, then quickly exits into explanation. Once the explanation starts, the implied question becomes "do you understand this framework?" instead of "what happens to the researcher, the young commercialization lead, the university officer, and the first company conversation next?"

The strongest recurring artifact is the three-column memo / slide / evidence rule. But it is still treated as an editorial device. It does not yet carry enough consequence. A reader should feel that this piece of paper almost ruins trust, saves a meeting, misleads an investor, changes a funding decision, and later becomes a method. Right now it appears, gets explained, and returns as a table.

### The opening is better than the old BZM text, but it is still too safe

`00-prologue.md` opens with a researcher before a presentation. That is the right direction. But the scene still becomes an explanation of the book's scope before the reader has paid enough emotional attention.

A sellable opening should not begin by proving the framework is useful. It should begin with a situation the target reader recognizes and cannot unsee:

- a researcher is praised in one room for becoming an entrepreneur, then questioned in another room about whether they should be CEO at all;
- a deck gets sent with one sentence that sounds harmless but crosses the researcher's protected line;
- a university officer watches three support programs make the project look stronger while the actual company condition remains weak;
- a young commercialization lead realizes that the words they added to the deck made the researcher trust the process less.

The current prologue gestures at this, but it lets the book explain itself too early. A commercial opening should hold the contradiction longer.

### The manuscript keeps solving tension too soon

Many chapters identify a problem and then quickly introduce a table, distinction, or decision label. That gives the reader competence, but it also releases tension. A page-turner needs unresolved stakes at the end of scenes and chapters.

Examples:

- Ch01 turns `顧客候補あり` into a better evidence statement. Useful, but the reader does not yet feel the cost of having believed the weak statement.
- Ch04 explains CEO functions well, but the researcher/CEO contradiction should tear through multiple chapters, not mostly resolve into a function table.
- Ch06 names GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT, but the decision words appear before the reader has suffered through one decision that changes because of them.
- Ch15-21 repeatedly return to model language before the reader has demanded the model.

The book should make the reader say, "I need a way to distinguish these things," before the model terms arrive.

## Reader-first violations

### P0: The OS sends readers to old internal BZM copy

Evidence:

- `pwa/src/components/nav/GlobalNav.tsx` has `📚 教科書` linking to `href="/bzm"`.
- `pwa/src/app/(app)/bzm/page.tsx` redirects `/bzm` to `/bzm/0-1-preface`.
- `pwa/src/app/(app)/bzm/[slug]/page.tsx` reads `pwa/bzm/{slug}.md`.
- `pwa/bzm/0-1-preface.md` introduces the book as work by `株式会社チームアルマダ（AMD）`.
- The same old preface includes `AMD のメンバーおよび AMD OS の利用者` as a target reader.
- The old preface says the chapter structure includes `AMD が見るべきもの`.
- `pwa/bzm/1-1-why-before-zero.md` begins its substance with `AMD は、研究機関に眠るシーズを発掘し...`.

This explains the user complaint that the opening feels like "we are Team ARMADA" / AMD introduction. The public manuscript may be less promotional, but the main OS route likely bypasses it.

### P0: The visible textbook identity is ambiguous

There are two surfaces:

- `/bzm/public`: reader-first public manuscript.
- `/bzm`: old BZM/internal theory source.

But the global navigation calls `/bzm` "教科書". A reader cannot know that the sellable public manuscript lives under `/bzm/public`. The UI makes the internal source look like the book.

### P1: The public manuscript is reader-first in vocabulary, but not yet reader-first in dramatic structure

The public manuscript mostly avoids `AMD`, `Team ARMADA`, `株式会社チームアルマダ`, `まさ`, and internal workflow terms in body copy. That is good but not sufficient. Reader-first is not just "remove company names." It means:

- the reader's confusion comes before the author's framework;
- the reader's job-to-be-done comes before the table;
- the reader experiences a field contradiction before receiving the concept name;
- the reader turns the page because a situation is unresolved.

The manuscript currently passes a vocabulary gate better than it passes a book gate.

### P1: Old BZM body must be reclassified as internal/theory source

The old `pwa/bzm/*.md` files contain valuable theory, calculations, references, and operational history, but they cannot be the public book body as-is. They include:

- internal company framing;
- AMD Score implementation language;
- `AMD OS` operations;
- `L2` / candidate / local applier routing concepts;
- source paths and "正本" language;
- model-validation details that belong in appendix or internal methodology.

These files should be treated as internal/theory source material unless every reader-facing entry point is rewritten.

## Narrative failure map

### 00 Prologue

Current strength: opens with a concrete scene and recurring memo.

Failure: it releases into "this book handles this place" too quickly. The first chapter should not reassure the reader that a framework exists. It should trap the reader inside the contradiction: praised as entrepreneurial in one room, displaced as CEO in the next, and now unsure what the project is asking of the researcher.

Rewrite order: rebuild as a 6-8 page opening scene with one protagonist and one near-mistake. Hold the contradiction before naming Before Zero.

### 01-03 Field chapters

Current strength: readable field problems, fewer promotional terms.

Failure: each chapter still behaves as a correct lesson. The reader meets a problem, then receives the table/checklist too fast. The "young commercialization lead" appears but is not yet a durable protagonist with desire, fear, mistakes, and learning.

Rewrite order: combine 01-03 into Act I. One project, one researcher, one young commercialization lead, one university officer, one support-program deadline. Let the reader live through the clocks and isolation before extracting questions.

### 04-06 Trap chapters

Current strength: the GAP / VC / CEO contradiction is the right hinge.

Failure: the hinge is still too local. It should be the emotional and structural center of the first half. Ch04 should not just explain CEO functions; it should make the reader feel why the phrase "external CEO" can sound like betrayal if the previous room praised the researcher for standing up.

Rewrite order: promote this contradiction into the book's central recurring conflict. Ch05 disclosure and Ch06 incorporation timing should be consequences of the same conflict, not separate topics.

### 07-10 Decision chapters

Current strength: GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT can be useful.

Failure: the decision vocabulary arrives like a handbook. The reader sees labels before seeing one decision fail, pause, and return changed.

Rewrite order: make WAIT the dramatic engine. Show a 90-day WAIT that looks like retreat to outsiders but becomes real work: budget owner found/not found, disclosure map repaired, founder-function role clarified, and only then a branch changes.

### 11-14 Bridge chapters

Current strength: they try to bridge field language to variables.

Failure: this is where the book starts cooling down. The manuscript begins to sound like it is preparing the reader for theory rather than continuing the case. It does not yet create enough "I need the model now" demand.

Rewrite order: keep only the field pressure in the main body. Move axis definitions and broad tables to chapter-end sidebars or appendix. The main text should show what happens when macro heat, technology strength, customer uncertainty, institutional support, and founder function disagree.

### 15-21 Theory chapters

Current strength: the theory terms are more field-first than old BZM.

Failure: the manuscript still becomes a guided glossary. BZM appears because the outline says it is time, not because the reader is desperate for a map. The model language should feel like the name of patterns the reader already suffered through.

Rewrite order: delay formal BZM naming until after a full composite case arc. In the main body, introduce only the minimum theory needed to change action. Push formulas, notation, retrofit caveats, model boundaries, and derivations to an appendix/methodology section.

### 22-24 Toolkit

Current strength: useful tools.

Failure: these are not narrative chapters. They are appendices and should stop pretending to be the end of the story. The current placement makes the book end as a tool dump.

Rewrite order: move Toolkit A/B/C to appendices or a clearly separated "Field Toolkit" after the final narrative ending. The main book should end with a changed reader, not a checklist.

## Bullet/table overuse diagnosis

The public manuscript 00-24 currently has:

- 3,826 total lines;
- 172 H1/H2 headings;
- 555 table lines;
- 62 bullet lines.

The problem is not just count. The problem is placement. Tables appear at the exact moments where the narrative should be allowed to stay uncomfortable.

Worst patterns:

- Ch01 converts the first customer-signal tension into a table almost immediately.
- Ch04 reduces the CEO contradiction into a function table before the contradiction has fully landed.
- Ch06/07 introduce decision labels and branch tables before one decision arc has emotionally paid off.
- Ch15-21 use tables to make theory accessible, but they also flatten scenes into classification.
- Ch23 is essentially a toolkit pack, with 62 table lines in one file.

Commercial-book rule:

- Main chapters may use at most one table-like object, and only if it appears as an artifact in the scene.
- Any table that is primarily a template, rubric, glossary, decision record, signal ladder, role map, or checklist should move to appendix/toolkit.
- Chapter endings should not default to bullet questions. They should usually end on a changed situation, a specific next action, or an unresolved consequence.
- A table is allowed in the body only when a character fills it under pressure and the filled table changes the next scene.

## OS route/content mismatch

This is P0 because it makes every editorial improvement to `pwa/bzm/public-manuscript/*.md` potentially invisible to the reader.

### Current route facts

| Surface | Current behavior | Editorial consequence |
|---|---|---|
| Global nav `📚 教科書` | links to `/bzm` | Sends reader to old BZM/internal body |
| `/bzm` | redirects to `/bzm/0-1-preface` | First visible page is old preface |
| `/bzm/[slug]` | reads `pwa/bzm/{slug}.md` | Displays old BZM source, including AMD/internal terms |
| `/bzm/public` | redirects to `/bzm/public/00-prologue` | Correct public manuscript exists but is not primary nav |
| `/bzm/public/[slug]` | reads `pwa/bzm/public-manuscript/{slug}.md` | Displays the current reader-first draft |

### Why this likely caused the user complaint

If a reader enters through the visible nav, they see old `0-1-preface.md`, not `public-manuscript/00-prologue.md`. That old preface says the book is built from AMD's field judgment, names AMD members and AMD OS users, and frames later sections around what AMD sees. The public manuscript does not begin that way, but the OS does not put the public manuscript first.

### Required product/editorial decision

The "教科書" page must mean the sellable reader-first book. Internal theory source can remain available, but it must not be the first book surface.

Minimum acceptable fixes:

1. Change `GlobalNav.tsx` so `📚 教科書` links to `/bzm/public`.
2. Or change `/bzm` so it redirects to `/bzm/public/00-prologue`.
3. Reclassify old `pwa/bzm/*.md` as internal/theory source, with a different route label such as `BZM理論ソース`, `内部理論`, or admin/internal-only view.
4. If old BZM body remains publicly visible, remove all company-introduction and AMD-subject opening copy before any reader-facing release.

## Rewrite orders

### P0. Fix reader entry before editing more prose

Do not run another prose polish before fixing the route/content mismatch. Otherwise the team may keep improving files that the visible OS nav does not show.

Orders:

1. Point `📚 教科書` to `/bzm/public`, or make `/bzm` redirect to `/bzm/public/00-prologue`.
2. Decide whether old `/bzm/[slug]` remains reachable as internal/theory source.
3. If old `/bzm/[slug]` remains reachable, relabel it and stop calling it the public textbook.
4. Ensure the first reader-facing textbook body is `public-manuscript/00-prologue.md` or its rewritten successor.

### P0. Rebuild the manuscript around one composite case

The book needs a protagonist system, not just topic chapters.

Recommended composite cast:

- a researcher with a strong, still-protected result;
- a young commercialization lead who wants to help but sometimes makes the deck too strong;
- a university/industry-collaboration officer protecting IP, research continuity, and institutional trust;
- a support-program manager pushing public proof and deadlines;
- an enterprise technical scout who is interested but not the budget owner;
- an investor or external CEO candidate whose questions expose missing founder function.

This cast should persist across the book. Individual chapters can still teach, but they must teach through consequences in this composite case.

### P0. Replace the current opening

New opening principle:

Start in a room where everyone is reasonable and the project still gets hurt.

Candidate opening:

1. The researcher is praised after a support-program presentation.
2. A sentence in the deck is strengthened to make the company story clearer.
3. A university-side reviewer notices that the sentence crosses a protected line.
4. A company scout says "interesting," but no budget owner exists.
5. A later investor meeting asks whether the researcher should be CEO at all.
6. The reader realizes the problem is not effort, but the absence of a map for the time before a company exists.

Only after that should the book name Before Zero.

### P1. Move tables and checklists out of the main body

Keep in main narrative only:

- one recurring artifact per act;
- one filled memo or table when it changes a decision;
- short scene-embedded notes that a character actually writes.

Move to appendices/toolkit:

- decision record templates;
- disclosure maps;
- customer signal ladders;
- role maps;
- readiness axis guides;
- ERS rubrics;
- notation;
- formulas;
- retrofit caveats;
- chapter-end bullet question lists.

### P1. Reorder the book into acts

Proposed sales-book structure:

| Act | Reader experience | Current source material |
|---|---|---|
| Act I: The room where the mistake begins | One research result is pushed toward company language before its conditions are ready | 00-03, parts of 05 |
| Act II: The CEO contradiction | The researcher is asked to stand up, then step aside | 04, 08, 13, 18 |
| Act III: The WAIT that is not retreat | The team delays incorporation while doing real work | 06, 07, 09 |
| Act IV: Why the map is needed | Repeated field contradictions force the model into existence | 11-16, 19 |
| Act V: Learning without betraying trust | The failed/paused case becomes evidence rules and institutional change | 10, 20, 21 |
| Field Toolkit | Tools separated from the reading arc | 22-24 plus moved tables |

### P1. Introduce BZM only after narrative demand exists

Do not lead with BZM theory in the public book.

Sequence:

1. Show the reader field contradictions.
2. Show why ordinary labels fail: "customer," "CEO," "support," "ready," "interesting," "company."
3. Introduce the minimum readiness language as names for observed differences.
4. Explain BZM as a map made necessary by the story, not as the author's framework.
5. Put equations, notation, weight logic, retrofit methodology, and internal validation in appendix/methodology.

### P2. Keep old BZM source useful but stop confusing it with the book

Old `pwa/bzm/*.md` should not be deleted. It is useful as:

- theory source;
- implementation/source-of-truth material;
- appendix/methodology seed;
- author/internal reference;
- BZM review gate material.

But it should be editorially demoted from "public textbook body" to "internal/theory source" until rewritten.

## Next workers

### Worker 1: OS route/content mismatch fix

Goal:
- Make the OS textbook entry show the public manuscript first.

Scope:
- `pwa/src/components/nav/GlobalNav.tsx`
- `pwa/src/app/(app)/bzm/page.tsx`
- optionally `BzmSideNav.tsx` / spec links if the old BZM surface is relabeled.

Acceptance:
- `📚 教科書` lands on `/bzm/public/00-prologue` or public equivalent.
- Old BZM source is not presented as the public textbook.
- Build passes.
- No DB/external writes.

### Worker 2: Public book architecture reset brief

Goal:
- Produce a rewrite brief that restructures 00-24 into the act structure above before any prose rewrite.

Deliverable:
- `pwa/bzm/textbook/runs/YYYY-MM-DD-public-book-architecture-reset-brief.md`

Acceptance:
- One composite case arc.
- Chapter/act map.
- Tables-to-appendix map.
- BZM-introduction timing.
- Keep/move/cut/expand orders per current chapter.

### Worker 3: Opening rewrite only

Goal:
- Rewrite only the new prologue/opening sequence after the route fix and architecture reset brief.

Scope:
- public manuscript opening file(s) only.

Acceptance:
- No company intro.
- No BZM theory before the reader feels the contradiction.
- One central composite case.
- Ends with unresolved pull into Act I.

### Worker 4: Table extraction / toolkit appendix worker

Goal:
- Move or mark table-heavy material for appendix/toolkit treatment.

Scope:
- Do not destroy author directives.
- Preserve useful tools, but remove workbook density from the main reading arc.

Acceptance:
- Main chapters no longer end as repeated checklist blocks.
- Toolkit is clearly separate from narrative body.

## Closeout note

This audit intentionally does not rewrite manuscript body. The next correct move is not a line edit. It is to fix the reader-facing route and then rebuild the manuscript architecture around a durable narrative spine.
