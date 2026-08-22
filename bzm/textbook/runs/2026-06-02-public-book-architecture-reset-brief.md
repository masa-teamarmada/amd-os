# Public Book Architecture Reset Brief

Date: 2026-06-02 JST

Worker: `Textbook architecture / narrative strategy worker`

Scope:
- Redesign the current public manuscript `pwa/bzm/public-manuscript/00` through `24` as a book architecture.
- Do not rewrite manuscript body in this pass.
- Do not perform DB writes, deploys, external service writes, or local applier runs.

Required source basis:
- `pwa/bzm/textbook/PUBLICATION_POSITIONING.md`
- `pwa/bzm/textbook/AUTHOR_DIRECTIVES.md`
- `pwa/bzm/textbook/runs/2026-06-02-editorial-narrative-reset-audit.md`
- `pwa/bzm/textbook/runs/2026-06-02-os-field-knowhow-harvest-v6.md`
- `pwa/bzm/public-manuscript/*.md`
- `pwa/src/app/(app)/bzm/public/public-manuscript.ts`
- Old BZM body under `pwa/bzm/*.md` as internal/theory source only, not public copy.

## Executive verdict

The current 00-24 public manuscript has useful material, a safer public voice, and
several good scene seeds. It is still not yet shaped like a sellable book. It is
a strong field workbook wearing a thin narrative layer.

The reset should make one composite case carry the reader from confusion to
judgment, then make BZM feel like the map the reader has been waiting for. The
main body should stop acting as a sequence of lessons and become a chain of
consequences. Most tables, rubrics, checklists, templates, formulas, and
decision labels should move into a separated Field Toolkit or methodology
appendix unless a character uses the artifact inside a scene and the artifact
changes the next scene.

The next rewrite should not start by polishing sentences. It should rebuild the
reading contract:

1. A project is pushed toward company language before it is ready.
2. Reasonable people in different rooms create conflicting expectations.
3. A young commercialization lead makes one near-mistake, then learns to write
   weaker but truer sentences.
4. WAIT becomes visible as real work, not hesitation.
5. Only after repeated contradictions does the reader receive readiness language
   and then BZM as a map.
6. The book ends by showing how one case becomes safer institutional practice,
   not by dumping tools.

## Current manuscript failure

The failure is architectural, not only stylistic.

### 1. The chapter is still the dominant unit

The manuscript is arranged around correct topics: research results are not
companies, different clocks, support isolation, CEO function, disclosure,
incorporation timing, decision labels, readiness axes, theory, retrofit, and
toolkit. These are important, but the reader does not yet feel one accumulating
problem.

The implied question is too often "do you understand the framework?" The public
book needs the implied question to be "what happens to this project, this
researcher, this young operator, and this institution if they move too fast?"

### 2. Tension is released by tables

Tables often arrive exactly where discomfort should be held. Examples:

- Ch01 turns weak customer evidence into a table before the reader has felt the
  cost of believing the weak evidence.
- Ch04 converts the researcher-CEO contradiction into a function table before
  the betrayal risk fully lands.
- Ch06 and Ch07 introduce decision labels before the reader has lived through a
  decision that changes because of them.
- Ch15-21 repeatedly return to model language, which cools the narrative before
  the reader has demanded the model.
- Ch22-24 are useful, but they are appendices pretending to be the end of the
  story.

### 3. The protagonist system is too faint

The manuscript has a young commercialization lead, memos, slides, and recurring
evidence artifacts, but they are not yet enough to pull the reader through 24
chapters. The reader needs someone to worry about.

### 4. BZM appears because the outline says so

BZM must appear only after the reader has seen ordinary words fail: customer,
CEO, support, ready, interesting, company, and evidence. Until that need exists,
terms like score, integrated score, axis, and model should stay in the background.

### 5. The ending becomes a tool dump

The final movement should leave the reader changed: they now know how to slow
down without freezing, how to protect trust without killing momentum, and how to
turn one messy case into institutional capability. Ch22-24 can support that, but
the narrative ending should come before the Field Toolkit.

## Reader promise

This book promises to help smart but busy readers read the phase before a
research result should become a company.

The reader should finish the book able to:

- notice when enthusiasm, funding, corporate interest, and company language are
  outrunning actual readiness;
- protect a researcher from being forced into the false choice of "researcher
  CEO or external CEO";
- separate research strength, customer truth, disclosure safety, founder
  function, budget ownership, social acceptance, and institutional support;
- treat WAIT as active work with owners, return conditions, and a date;
- understand small paid signals as evidence about customer pain, budget path,
  repeatability, and opportunity cost, not as a simplistic "earn small money"
  doctrine;
- read BZM as a map for deciding the next uncertainty to reduce, not as branded
  scoring or a replacement for judgment;
- convert field notes into reusable public questions without leaking private
  cases.

The book should not promise that every research result should become a startup,
that the author has the one method, or that the model can replace judgment.

## Composite case spine

Use one primary composite case plus one institutional echo thread.

### Primary case: the slide that became too strong

Core situation:

A researcher has a strong but still protected result. A support program wants a
clear company story. A young commercialization lead wants to help and strengthens
one sentence in the deck. The sentence reads well in a pitch room, but it crosses
the researcher's protected line and makes corporate interest look stronger than
the evidence allows.

The case should recur through the whole book:

- A technical scout says the result is interesting, but the budget owner is not
  in the room.
- A support program rewards J-curve language, but the first paid problem is
  still vague.
- A university or industry-collaboration officer sees the disclosure risk before
  the team sees it.
- An investor or external CEO candidate asks who will actually carry CEO
  functions, and the researcher hears that as being moved away from their own
  technology.
- A WAIT decision is written with owner, return condition, and review date.
- Ninety days later, the team has not merely waited. It has clarified budget
  owner, disclosure boundaries, founder-function split, and whether small
  revenue reveals or distracts from the real path.

### Institutional echo thread: one case becomes a nursery pattern

The same case later becomes a safer institutional pattern:

- the overstrong deck becomes a red/yellow/blue disclosure rule;
- the blank budget-owner cell becomes a meeting-close question;
- the failed investor conversation becomes a founder-function review;
- the WAIT ledger becomes a monthly low-axis review;
- the young lead's field note becomes a public question only after
  anonymization and approval.

This echo thread lets Ch20-24 feel like consequence, not appendix.

### Cast

| role | narrative function | must not become |
|---|---|---|
| Researcher | Holds the technical meaning, protected line, and reason the work matters | naive founder caricature |
| Young commercialization lead | Reader proxy; wants to help, overclaims once, learns evidence discipline | omniscient consultant |
| URA / industry-collaboration officer | Protects IP, disclosure order, institutional trust, and researcher continuity | bureaucratic obstacle |
| Support-program manager | Creates useful urgency and dangerous presentation pressure | villain |
| Corporate technical scout | Shows real interest without budget ownership | customer proof |
| Budget owner / evaluator | Forces the team to distinguish interest from resource commitment | late-stage procurement detail |
| Investor / external CEO candidate | Exposes missing founder function and survival evidence | simple VC antagonist |
| Institution leader | Turns one repaired case into a nursery practice | policy lecture device |

## Act structure

### Act I: The room where the mistake begins

Reader experience:

The reader enters a reasonable room where everyone is trying to help and the
project is still harmed. A deck sentence becomes too strong. Corporate interest
is recorded too cleanly. The researcher feels the project moving away from the
truth they were trying to protect.

Current source material:

- 00 Prologue
- 01 research results are not companies
- 02 different clocks
- 03 support can isolate researchers
- disclosure seeds from 05

Narrative artifact:

A three-column memo: `what we know / what we are guessing / what we must not
promise`.

End of act pull:

The team did not fail because anyone was careless. It failed because the rooms
used the same words differently.

### Act II: The company story starts running ahead

Reader experience:

The project receives support, pitch training, corporate interest, and investor
attention. Each signal looks like progress, but each also creates a stronger
expectation than the case can safely carry.

Current source material:

- 04 GAP / VC / CEO function
- 05 disclosure
- 06 incorporation timing
- 08 role allocation
- 09 risk capital

Narrative artifact:

The deck with red/yellow/blue markings, plus one blank cell labeled `budget
owner`.

End of act pull:

The hardest question is no longer "is the research strong?" It is "what will
break if this becomes a company now?"

### Act III: WAIT is work

Reader experience:

The team chooses WAIT, and outsiders misread it as retreat. The act proves that
WAIT can be the most honest form of execution: finding a budget owner, repairing
disclosure, testing small earning signals, decomposing CEO functions, and
keeping the researcher inside the center of the story.

Current source material:

- 06 incorporation timing
- 07 now / later / never
- 08 role allocation
- 09 before risk capital
- 10 failure to learning
- survival / earning body directive from `AUTHOR_DIRECTIVES.md`

Narrative artifact:

A 90-day WAIT ledger with owner, return condition, review date, and "what we
will not do this month."

End of act pull:

The project has more evidence, but the evidence points in different directions.
The reader now needs a map.

### Act IV: The map becomes necessary

Reader experience:

The same case is now impossible to read with a single label. Technology is
strong, customer evidence is partial, disclosure is fragile, social acceptance
is untested, founder function is split, and the institution is supportive but
not fully responsible. The reader feels the need to separate axes before BZM is
named.

Current source material:

- 11 macro tailwinds
- 12 readiness axes
- 13 founder readiness
- 14 institution as nursery
- 15 why model the field
- 16 readiness axes field guide
- 17 macro alignment
- 18 founder readiness field-first
- 19 integrated score as next action

Narrative artifact:

A one-page readiness map that does not yet need to be called a score.

End of act pull:

The model is introduced as the name for a problem the reader has already felt:
the lowest unresolved uncertainty should decide the next action.

### Act V: The case becomes institutional memory

Reader experience:

The project may or may not become a company immediately, but the field has
learned. The repaired evidence rules, disclosure maps, role split, WAIT ledger,
and budget-owner question become safer practice for the next project.

Current source material:

- 20 retrofit validation
- 21 institution readiness as nursery
- selected narrative parts of 22-24

Narrative artifact:

A field note converted into a reusable question, with private detail stripped.

End of act:

The reader leaves with a changed habit: before asking "can this be a startup?",
they ask "what uncertainty should fall next, and who owns the work before the
company exists?"

### Field Toolkit: separated, usable, non-narrative

Reader experience:

After the story, the reader can use tools without the tools flattening the
story.

Current source material:

- 22 field-note safety loop
- 23 decision and disclosure toolkit
- 24 institution nursery checklist
- moved tables, templates, checklists, rubrics, notation, and method notes

## Chapter remap 00-24

| current chapter | new act placement | rewrite role | order |
|---|---|---|---|
| 00 Prologue | Act I opening | Rebuild as the 6-8 page "slide became too strong" scene. Do not name BZM. | 1 |
| 01 Research results are not companies | Act I | Show weak customer evidence through the blank budget-owner cell. Keep one filled memo only. | 2 |
| 02 Different clocks | Act I | Let clocks appear through conflicting room pressures, not as a stakeholder table first. | 3 |
| 03 Support can isolate researchers | Act I / Act V echo | Make support-menu fragmentation part of the researcher's lived burden. Save institution fix for Act V. | 4 |
| 04 GAP / VC / CEO function | Act II hinge | Promote to central conflict: praised as entrepreneur, then questioned as CEO. Delay function table. | 5 |
| 05 Disclosure | Act II | Make disclosure a consequence of the overstrong deck. Use red/yellow/blue only as scene artifact. | 6 |
| 06 Incorporation timing | Act II / Act III | Treat incorporation as a clock that creates fixed expectations. Put survival and earning body here. | 7 |
| 07 Now / later / never | Act III | Make WAIT the dramatic engine. Labels appear after one decision has been argued. | 8 |
| 08 Who carries what | Act III | Use role split to protect researcher authenticity and avoid researcher CEO / external CEO binary. | 9 |
| 09 Before risk capital | Act II / Act III | Investor meeting exposes missing evidence. Move most tables to toolkit. Keep budget-owner test. | 10 |
| 10 Failure into learning | Act III / Act V | Turn one failed assumption into a changed rule and trust repair. | 11 |
| 11 Macro tailwinds | Act IV | Show policy, capital, research, and social winds disagreeing before naming axes. | 12 |
| 12 Readiness axes | Act IV | Introduce axes as names for disagreements the reader has already seen. | 13 |
| 13 Founder readiness | Act IV | Keep founder function as complementability, not personality judgment. | 14 |
| 14 Institution as nursery | Act IV / Act V | First show institution as condition around the case, then later as reusable nursery practice. | 15 |
| 15 Why model the field | Act IV reveal | Move here only after the reader asks for a map. Use as BZM entrance, not glossary. | 16 |
| 16 Readiness axes field guide | Act IV | Keep field guide material, but most tables become toolkit/method notes. | 17 |
| 17 Macro alignment | Act IV | Keep only narrative pressure of misaligned academic, industrial, governmental, and social waves. | 18 |
| 18 Founder readiness field-first | Act IV | Merge with Ch13 or use as second scene where external support can complement but not replace trust. | 19 |
| 19 Integrated score as next action | Act IV | Rename functionally. Focus on survival probability and next uncertainty, not "score" as brand. | 20 |
| 20 Retrofit validation | Act V | Use as "how the field learned" after the case. Move model logs to appendix. | 21 |
| 21 Institution readiness as nursery | Act V | End the narrative by turning case learning into institutional practice. | 22 |
| 22 Field-note safety loop | Field Toolkit, with Act V excerpt | Keep a short Act V scene, move full loop to toolkit. | A |
| 23 Decision and disclosure toolkit | Field Toolkit | Toolkit only. Pull narrative examples back into Acts II-III. | B |
| 24 Institution nursery checklist | Field Toolkit | Toolkit only. Pull the 90-day pilot ending into Act V. | C |

## Tables and toolkit extraction map

Main-body rule:

Only keep a table in the main narrative if it is a physical or digital artifact
a character fills under pressure and that filled artifact changes the next
scene.

| material type | main narrative | scene integration | Field Toolkit / appendix | cut or compress |
|---|---|---|---|---|
| Three-column memo | Keep as recurring Act I artifact | Use in opening and trust repair | Provide blank template in toolkit | Remove repeated explanatory versions |
| Customer evidence tables | Keep one blank budget-owner cell | Show the young lead downgrading "customer candidate" | Customer signal ladder | Cut duplicate "interesting" examples |
| Stakeholder clocks | Mostly scene-integrated | Show rooms pulling in different directions | Optional one-page clock map | Cut broad stakeholder table from early pages |
| CEO function tables | Keep only one partial role artifact | Use in Act II/III when researcher hears "CEO" as displacement | Full founder-function role map | Compress duplicate Ch04/08/13/18 tables |
| Disclosure maps | Keep red/yellow/blue deck markings | Show the sentence that crosses a protected line | Full disclosure map and distribution log | Remove repeated color definitions |
| GO / WAIT / HOLD labels | Introduce after the case argues itself | WAIT ledger is filled in Act III | Decision record template | Cut early label glossary feel |
| Survival / earning body checks | Keep as Act III stakes | Show one paid pilot that reveals and one that distracts | Small revenue usefulness/distraction test | Avoid "small money is always good" framing |
| Readiness axes | Keep one one-page map in Act IV | Let disagreements force the map | Field guide and axis glossary | Cut repeated axis tables in main body |
| Score / integrated score tables | Do not lead with score | Translate to next uncertainty and survival conversation | Method appendix if needed | Avoid `AMD Score` name in main public body |
| Retrofit/model logs | Keep only story of changed evidence rule | Show one old rule becoming new rule | Model validation / methodology appendix | Cut internal validation detail from body |
| Institution nursery checks | Keep Act V institutional consequence | Show one 90-day pilot | Nursery checklist | Compress duplicated ERS/rubric material |
| Field-note safety loop | Short Act V scene only | Show private note becoming public question | Full safety loop | Remove internal workflow terms |

## BZM theory reveal plan

BZM should not be the book's opening promise. It should be the reader's relief
after the book has made ordinary words unstable.

### Forbidden early reveal

Do not begin with:

- BZM definition;
- formulas;
- score architecture;
- internal model names;
- old BZM body language;
- `AMD Score` as a public-facing name;
- `M x X x F`, `P x R x S`, or variable notation;
- L2, candidate, local applier, routing, source path, or OS implementation terms.

### Functional language before theory language

Use these public phrases before any theory name:

- readiness;
- survival probability;
- earning body;
- the next uncertainty to reduce;
- the lowest unresolved condition;
- what the team can safely know now;
- what should not be promised yet;
- what must be true before the company clock starts.

### Reveal sequence

1. Act I-III: Use only field language. No formal BZM naming.
2. Late Act III: Let the reader see multiple unresolved conditions disagree.
3. Act IV opening: Introduce readiness axes as names for already-seen tensions.
4. Act IV middle: Introduce BZM as a map for preserving those distinctions.
5. Act IV late: Discuss integrated judgment as "next action / next uncertainty,"
   not as branded scoring.
6. Appendix/methodology: Put formulas, notation, score name policy, weights,
   retrofit method, model boundaries, and old BZM theory references.

### `AMD Score` naming policy

In the main public narrative, avoid `AMD Score`. It makes the book feel branded
and internal before the reader needs the idea. Preferred main-body wording:

- `readiness map`;
- `survival conversation`;
- `next uncertainty map`;
- `integrated readiness view`;
- `low-axis review`.

If the exact theory name is needed, put it in a methodology note after the
reader has reached Act IV or in an appendix with a clear statement that the name
belongs to the internal/theory source layer.

## Opening rewrite order

The opening should start from a situation, not from the book's scope or the
author's framework.

### First page order

1. Start in a support-program presentation room after the applause.
2. A researcher has just been praised for entrepreneurial promise.
3. The young commercialization lead notices the deck sentence that made the
   story cleaner than the evidence.
4. The sentence says or implies that a customer exists, but the actual contact is
   a technical scout with no budget ownership.
5. A university-side reviewer or URA quietly marks one phrase as unsafe because
   it crosses a protected disclosure line.
6. The researcher does not explode. They become quieter.
7. The next room asks who will be CEO, and the same researcher who was praised in
   the first room now feels partially removed from the future company.
8. End the first page on the recognition that everyone was reasonable and the
   project still got hurt.

### What not to do on page one

- Do not say "we built this framework."
- Do not introduce the author's company.
- Do not define BZM.
- Do not list target readers.
- Do not present a full checklist.
- Do not reassure the reader that the answer is coming too quickly.

### Opening artifact

The first reusable object should be a small, incomplete memo:

| field | first-page version |
|---|---|
| what we know | the research result is strong in a protected setting |
| what we are guessing | the corporate contact may represent a real customer path |
| what we must not promise | budget ownership, deployment readiness, and unreleased technical details |

This memo should look insufficient at first. The book's movement is the memo
becoming more disciplined.

## Next rewrite worker prompt

Title:

`Textbook opening and Act I rewrite from architecture reset`

Prompt draft:

```text
【Textbook司令塔からworker依頼】public manuscript opening / Act I rewrite:
00-03を「説明章」から「読者が巻き込まれる冒頭Act」へ書き換えて

担当: Textbook narrative rewrite worker
作業repo: /Users/masa/projects/AMD/amd-os

必読:
- pwa/bzm/textbook/PUBLICATION_POSITIONING.md
- pwa/bzm/textbook/AUTHOR_DIRECTIVES.md
- pwa/bzm/textbook/runs/2026-06-02-editorial-narrative-reset-audit.md
- pwa/bzm/textbook/runs/2026-06-02-os-field-knowhow-harvest-v6.md
- pwa/bzm/textbook/runs/2026-06-02-public-book-architecture-reset-brief.md
- pwa/bzm/public-manuscript/00-prologue.md
- pwa/bzm/public-manuscript/01-research-results-are-not-companies.md
- pwa/bzm/public-manuscript/02-different-clocks.md
- pwa/bzm/public-manuscript/03-support-can-isolate-researchers.md
- 必要なら pwa/bzm/public-manuscript/04-06 と旧BZM本文。ただし旧BZMのAMD主語/AMD OS/L2/AMD Score語を公開本文へ持ち込まない。

目的:
- 00-03をAct I「The room where the mistake begins」として再構成する。
- 一つのcomposite caseを追わせる。
- 冒頭1ページを、支援プログラム発表後の部屋、強くなりすぎたdeck sentence、blank budget-owner cell、開示線、研究者の沈黙から始める。
- BZM理論、score、内部語、会社紹介は出さない。
- 表と箇条書きは最小化し、main narrativeに残すのはscene内で使われるmemoだけにする。

書き換え範囲:
- pwa/bzm/public-manuscript/00-prologue.md
- pwa/bzm/public-manuscript/01-research-results-are-not-companies.md
- pwa/bzm/public-manuscript/02-different-clocks.md
- pwa/bzm/public-manuscript/03-support-can-isolate-researchers.md
- 必要なら runs note と COMMANDER_TASKS.md 最小更新。

禁止:
- 本の主語をAMD/Team ARMADA/まさにしない。
- 旧BZM本文をそのまま貼らない。
- BZM定義、AMD Score、数式、L2、local applier、routing、source pathを本文に出さない。
- DB write / deploy / external service write禁止。
- git add . 禁止。

受入条件:
- 00の最初の1ページが、読者/現場から始まる。
- 00-03を続けて読むと、若い事業化人材、研究者、URA/産連、支援プログラム、企業探索担当が同じcase arc上にいる。
- 各章末がチェックリストで終わりすぎず、次章への未解決で引っ張る。
- 表はscene artifactとして必要なものだけ残る。
- PUBLICATION_POSITIONING.md と AUTHOR_DIRECTIVES.md に反しない。
- git diff --check、conflict marker scan、禁止語scanを通す。
- Textbook司令塔 threadへ能動報告する。
```

## Acceptance gate

This architecture reset brief is acceptable when:

- It is a design brief only and does not rewrite public manuscript body.
- It proposes an Act structure for the whole book.
- It defines one primary composite case spine and one institutional echo thread.
- It remaps current 00-24 into the Act structure.
- It classifies table/checklist/toolkit material into main narrative, scene
  integration, Field Toolkit/appendix, and cut/compress.
- It delays BZM theory until the reader needs the map.
- It gives a concrete opening rewrite order that starts from the field, not from
  the author or company.
- It gives the next rewrite worker a usable prompt.
- It references `PUBLICATION_POSITIONING.md`, `AUTHOR_DIRECTIVES.md`,
  `editorial-narrative-reset-audit`, and `os-field-knowhow-harvest-v6`.
- `git diff --check` passes.
- A conflict-marker scan finds no merge-conflict markers.
