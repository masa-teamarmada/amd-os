# Textbook Deep Source Mining v4

> Date: 2026-06-01 JST
>
> Worker: `Textbook deep source mining v4`
>
> Purpose: AMD OS / BZM / manual / spec / design / run notes / repo-external event transcriptから、公開本を一冊の実務本として厚くするためのBefore Zero素材を発掘する。本文は編集しない。
>
> Safety: This is an internal editorial artifact. Public manuscript workers must convert all source material into anonymized, composite, reader-first scenes. Do not paste raw transcript, internal paths, private project names, source snippets, DB rows, score weights, thresholds, calibration, contracts, prices, or person-level assessments into public body copy.

## 0. Executive Summary

v4 expands the prior source-mining base into a next-rewrite-ready editorial bank:

- Composite cases: **12**
- Scene bank: **36**
- Tool / question / checklist bank: **48**
- Theory bridge materials: **10 concepts** covering TRL / BRL / GRL / SRL / HRL / FRL / sigma_SU / integrated score / retrofit / ERS
- Missing chapters / appendices: **10 proposals**
- P0 rewrite materials: **14**

The biggest v4 finding is that the book should not only add more anecdotes. It should add more **operational artifacts** that let readers act:

1. Decision records that make WAIT a work plan.
2. Disclosure maps that protect IP, papers, collaborators, and researcher trust.
3. Role maps that separate researcher authenticity from CEO-function overload.
4. Customer-signal ladders that stop "interesting" from being treated as validation.
5. Institution nursery diagnostics that turn support menus into responsibility pipelines.
6. Field-note safety loops that make cases reusable without exposing raw sources.

The current 00-21 public manuscript already has a strong recurring composite case. What it still needs is more variety around customer validation, external executive fit/misfit, young commercialization talent, URA/TLO work, institution pilot gates, and public-safe SRL/GRL examples.

## 1. Source Inventory

Read-only confirmation: all sources below were read or inspected read-only. No DB write, external write, deploy, or local applier `--apply` was performed. The repo-external docx was extracted read-only through zip/XML fallback: 827 non-empty paragraphs / 46,859 chars. No repo-external file was edited.

| source family | source group read | value mined | classification |
|---|---|---|---|
| Common / repo rules | `/Users/masa/projects/AGENTS.common.md`, repo `AGENTS.md` / `CLAUDE.md`, `pwa/AGENTS.md` / `pwa/CLAUDE.md` | Work gate, public/internal boundary, no raw source leakage, no DB/external writes | internal_only |
| Publication gate | `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` | Reader-first promise, company-name policy, forbidden public words, target readers | internal_only editorial rule |
| Textbook ledger | `pwa/bzm/textbook/COMMANDER_TASKS.md` | Active loop: page-turner review, source mining, 00-06 rewrite, Stapa extraction, 15-21 theory narrative | internal_only |
| Public manuscript 00-14 | `origin/codex/textbook-public-manuscript-00-14-continuous-page-turner` | Continuous front-half spine, researcher role whiplash, customer-signal misread, WAIT, responsibility pipeline | public_ready style reference, public_rewrite for further expansion |
| Public manuscript 15-21 | `origin/codex/textbook-public-manuscript-15-21-continuous-theory-narrative` | Medical-adjacent composite case, field-first theory terms, regional PoC corridor, retrofit, ERS separation | public_ready style reference, public_rewrite for domain thickening |
| v3 source mining | `origin/codex/textbook-os-data-source-mining-v3` run note | 10 cases / 34 scenes / 36 tools, field-note pipeline, ERS, theory bridges | public_rewrite as case bank |
| field harvest | `origin/codex/textbook-field-knowledge-harvest` run note | A-I material categories, chapter injection map, new chapter ideas | public_rewrite |
| case bank v2 | `origin/codex/textbook-source-mining-case-bank-v2` run note | Base 5 cases, 15 scenes, 20 tools, safety filters | public_rewrite |
| BZM source chapters | `pwa/bzm/*.md`, `pwa/bzm/runs/*.md` | GO/WAIT/HOLD/NO_GO/RESOURCE_SHIFT, field-to-variable table, FRL/ERS/retrofit, PRS boundary | public_rewrite; some internal_only |
| L2 / Textbook specs | `pwa/spec/3-13-*`, `pwa/manual/8-3-*`, related design docs | Textbook insight categories, confidentiality, human approval, evidence refs, routing | internal_only as implementation; public_rewrite as method |
| ERS / institution specs | `pwa/design/institution_readiness.md`, `pwa/spec/4-3-*`, `pwa/bzm/7-1-*`, institution policy seed migration | unknown vs not_started, evidence-backed policy matrix, 8-axis institution readiness | public_rewrite |
| AMD Score / FRL specs | `pwa/spec/4-1-*`, `4-2-*`, manual/design/BZM score notes | FRL as character + capability, integrated score as next action, model-version safety | public_rewrite; score internals internal_only |
| Review/progress scripts | `pwa/scripts/*review*`, `pwa/scripts/*progress*`, `apply_approved_textbook_insights.mjs`, `textbook_insight_routing.mjs` | Field evidence collection, approved candidate gate, BZM review skip, local-only applier safety | internal_only; public_rewrite as learning loop |
| Repo-external transcript | `/Users/masa/projects/AMD/AMD/stapa/イベントの文字起こし.docx` | Researcher respect, 6-9 month DD before incorporation, support isolation, GAP/VC/CEO twist, local talent/funding, medical PoC | public_rewrite only; raw transcript internal_only |

## 2. Public / Internal Classification

### public_ready

Material that can enter public manuscript after light anonymized prose editing:

- WAIT as work with a return condition.
- "Interesting" from a company as a signal, not customer validation.
- Three-layer disclosure: public / NDA-needed / do-not-disclose-yet.
- Researcher role whiplash: trained to stand forward, later asked to step back.
- Responsibility pipeline instead of support-menu count.
- Unknown vs not_started in institution readiness.
- Failure learning as model revision, not blame.
- Institutional nursery as support-gap self-diagnostic, not ranking.

### public_rewrite

High-value material requiring anonymization, composite construction, and removal of internal language:

- Stapa-derived scenes around researcher respect, DD timing, GAP/VC/CEO tension, and regional PoC.
- L2/Textbook insight workflow as a method for turning field notes into reusable questions.
- ERS policy matrix and institution cockpit logic as institution self-check.
- External executive fit/misfit patterns.
- Young commercialization talent / URA / TLO role development.
- PRS / score-model migration notes as a caution about model versioning, not public math.
- Scripts and schema as evidence of operating discipline, not book content.

### internal_only

Do not use as public body copy:

- AMD / Team ARMADA / company-name authority, individual names, project names, event names, worker/thread/司令塔 language.
- Raw transcript paragraphs, source paths, source permalinks, DB rows, candidate IDs, source hashes, prompts, notification payloads.
- Supabase, Vercel, local applier, schema, migration, RLS, service-role, automation schedule details.
- Patent claim strategy, legal conclusions, prices, contracts, FY revenue assumptions, named institution evaluations.
- Person-level FRL/HRL/ALQ/Grit/Resilience assessments.
- Score weights, thresholds, calibration, or formula internals beyond reader-safe conceptual framing.

## 3. Composite Case Bank

Each case includes: chapter use, reader, anonymization policy, and public route.

### Case 01: Researcher Role Whiplash

- `status`: public_ready after anonymization
- `chapters`: Prologue, Ch4, Ch8, Ch13, Ch18
- `reader`: researcher, URA, investor, young venture builder
- `scene`: A researcher is coached to pitch like a founder for a support-program interview. Later, an investor asks whether the same researcher should really be CEO.
- `usable point`: The problem is not "researcher CEO vs external CEO"; the missing work is CEO-function decomposition.
- `anonymization`: remove source event, program, investor, support provider, and any speaker identity. Use a composite "support program room" and "capital room."

### Case 02: Pre-Disclosure Trust Accident

- `status`: public_ready
- `chapters`: Ch5, Ch9, Ch16, Ch17
- `reader`: URA/TLO, researcher, company BD
- `scene`: A deck for a company meeting contains an unpublished figure, a collaboration-derived result, and a market claim added by a supporter.
- `usable point`: Disclosure is order design, not bravery.
- `anonymization`: no patentable detail, no institution, no company, no slide content. Use the three-layer map only.

### Case 03: "Interesting" Without Budget Owner

- `status`: public_ready
- `chapters`: Ch1, Ch9, Ch16, Ch20
- `reader`: company, investor, young venture builder
- `scene`: A company scout reacts positively, but the budget owner, evaluator, success condition, and procurement path are absent.
- `usable point`: Interest is a signal; commitment requires problem owner, evaluation condition, and next action.
- `anonymization`: generalize sector and buyer. Do not use deal status or company names.

### Case 04: Helpful Rooms, Lonely Researcher

- `status`: public_ready
- `chapters`: Ch3, Ch14, Ch21, appendix
- `reader`: institution leaders, URA, researcher
- `scene`: The researcher visits grant, IP, pitch, investor, university, and company rooms; every room helps, but no one owns the integrated decision.
- `usable point`: Support menus can increase loneliness when they do not become a responsibility pipeline.
- `anonymization`: remove event/program labels; use "rooms" as composite metaphor and artifact.

### Case 05: Strong Research Town, Weak Founder Path

- `status`: public_rewrite
- `chapters`: Ch14, Ch17, Ch18, Ch21
- `reader`: local government, institution, young venture builder
- `scene`: A research-dense region has institutes, researchers, hospitals, and manufacturers, but lacks local founder-function career paths and early capital.
- `usable point`: sigma_SU can look high while FRL/HRL/ERS remain weak.
- `anonymization`: do not name region, institutions, companies, funders, or local individuals. Use "a research-dense region."

### Case 06: Local Medical PoC Corridor

- `status`: public_rewrite
- `chapters`: Ch16, Ch17, Ch21
- `reader`: hospital-adjacent researcher, institution, company, policy side
- `scene`: A technology may be useful in medical settings, but hospital access, ethics, technician workload, manufacturer conditions, and user acceptance are not connected.
- `usable point`: SRL/GRL/BRL must be separated before PoC becomes a promise.
- `anonymization`: remove disease/technology details and named facilities. Keep corridor roles only.

### Case 07: External Executive Fit/Misfit

- `status`: public_rewrite
- `chapters`: Ch8, Ch10, Ch13, Ch18, Ch20
- `reader`: investor, researcher, EIR/CXO candidate
- `scene`: An executive candidate has a strong resume but treats research constraints as friction and loses researcher trust.
- `usable point`: Founder-function complement is not just experience; it includes trust fit, technical respect, and boundary discipline.
- `anonymization`: composite from multiple cases; never include career history, identifiable sector, or personal evaluation.

### Case 08: Young Commercialization Talent Earns Authority

- `status`: public_ready after composite
- `chapters`: Ch8, Ch10, Ch18, appendix
- `reader`: young venture builder, URA, EIR program operator
- `scene`: A junior commercialization person starts by translating meetings and maintaining the decision log, then earns one real function instead of a title.
- `usable point`: Young talent can carry process memory, translation, and trust-building before becoming CEO/COO.
- `anonymization`: no real person. Use a composite role with no age, school, or employer markers.

### Case 09: WAIT Later Becomes GO

- `status`: public_rewrite, needs more outcome evidence
- `chapters`: Ch6, Ch7, Ch11, Ch19
- `reader`: support-program operator, researcher, investor
- `scene`: A team delays incorporation for 90 days, resolves disclosure and customer-condition gaps, then returns to a better GO.
- `usable point`: WAIT is not caution theater when the return condition is explicit.
- `anonymization`: build as a composite. Do not imply one real case outcome unless explicitly publishable.

### Case 10: Field Notes Become Reusable Questions

- `status`: internal_only source, public_rewrite method
- `chapters`: Ch10, Ch20, appendix
- `reader`: URA, venture studio, support program, young talent
- `scene`: A support team converts meeting observations into a reviewed question without publishing raw notes.
- `usable point`: Learning from cases should protect relationships by storing the reusable question, not the private story.
- `anonymization`: never mention DB, source hashes, candidates, local appliers, or notification flows.

### Case 11: Institution Pilot Gate Before Expansion

- `status`: public_rewrite
- `chapters`: Ch14, Ch21, appendix
- `reader`: institution leadership, TLO/URA, policy side
- `scene`: An institution wants a Before Zero support system; the team limits the first pilot to a few seeds, clear authority, data boundaries, and monthly review.
- `usable point`: Institution rollout should begin with gates and scope, not all-campus ambition.
- `anonymization`: remove named institution, pricing, contract, permissions, internal users, and specific implementation.

### Case 12: Model Revision Without Blame

- `status`: public_ready after composite
- `chapters`: Ch10, Ch20, Ch21
- `reader`: all readers
- `scene`: A case stalls after positive company reactions. Instead of blaming the researcher or supporter, the team revises the evidence rule for BRL and SRL.
- `usable point`: Failure can become model correction if the question changes for the next case.
- `anonymization`: no project identity, deal status, source date, or individual role evaluation.

## 4. Scene Bank

Each scene is marked for `opening`, `middle`, or `ending`.

### Scene 01: The Founder-Like Pitch, Then the CEO Doubt
- `use`: opening
- `status`: public_ready
- `seed`: A researcher receives applause after a founder-like pitch, then hears the next room ask whether someone else should lead.

### Scene 02: The Slide That Travels Faster Than Permission
- `use`: opening
- `status`: public_ready
- `seed`: A polished deck is forwarded before the researcher, TLO, and collaboration boundary agree on what may be shown.

### Scene 03: A Company Scout Says Interesting
- `use`: opening
- `status`: public_ready
- `seed`: A scout likes the technology, but no problem owner or budget route appears.

### Scene 04: Corridor Of Helpful Rooms
- `use`: opening
- `status`: public_ready
- `seed`: The researcher moves from grant room to IP room to pitch room to investor room, but no room holds the whole decision.

### Scene 05: DD Starts Before The Company Exists
- `use`: middle
- `status`: public_ready
- `seed`: Due diligence, licensing, capital policy, and hiring preparation begin before incorporation because the company clock will be unforgiving.

### Scene 06: Paper Read Before First Meeting
- `use`: opening
- `status`: public_ready
- `seed`: The supporter's first trust act is not a pitch edit; it is reading the research deeply enough to ask in the researcher's language.

### Scene 07: URA/TLO Order Matters
- `use`: middle
- `status`: public_ready
- `seed`: Direct access to the researcher once felt efficient; now bypassing the institution's collaboration office can damage later trust.

### Scene 08: WAIT On The Whiteboard
- `use`: middle
- `status`: public_ready
- `seed`: The board says WAIT, but below it are five owners and 90-day return conditions.

### Scene 09: HOLD Because The Missing Fact Is Unknown
- `use`: middle
- `status`: public_ready
- `seed`: The team cannot choose GO or WAIT because a regulatory, IP, or researcher-intent fact is still unconfirmed.

### Scene 10: NO_GO That Protects The Research
- `use`: ending
- `status`: public_ready
- `seed`: The team chooses license or joint research instead of startup formation, and the research path remains alive.

### Scene 11: Resource Shift From Pitch To Customer Conditions
- `use`: ending
- `status`: public_ready
- `seed`: Instead of adding investor meetings, the team sends effort toward company budget owner, evaluation condition, and field pain.

### Scene 12: External Executive Resume Looks Strong
- `use`: middle
- `status`: public_rewrite
- `seed`: The candidate's achievements are impressive, but the researcher notices the candidate does not repeat the protected lines accurately.

### Scene 13: Young Talent Keeps The Decision Log
- `use`: middle
- `status`: public_ready
- `seed`: The junior member has no title, but because they keep the role map and return conditions, everyone starts asking them what changed.

### Scene 14: Regional PoC Corridor Almost Connects
- `use`: opening
- `status`: public_rewrite
- `seed`: Hospital, manufacturer, institution, and policy actors are near each other, but proximity has not yet become a corridor.

### Scene 15: Hospital Support Is Not Social Acceptance
- `use`: middle
- `status`: public_rewrite
- `seed`: A physician is supportive, but technicians, patients, ethics, data handling, and workflow burden have not been heard.

### Scene 16: Policy Heat Creates Bad Acceleration
- `use`: opening
- `status`: public_ready
- `seed`: A public program deadline makes incorporation feel urgent even though the lowest readiness axis is elsewhere.

### Scene 17: Macro Tailwind And Company Readiness Split
- `use`: middle
- `status`: public_ready
- `seed`: Research and policy waves are aligned, but the first paid customer and internal operator are still missing.

### Scene 18: Score Is High But Next Action Is Unclear
- `use`: middle
- `status`: public_rewrite
- `seed`: A high-looking composite score becomes useless until the team asks which axis is the bottleneck.

### Scene 19: The Model Was Wrong, Not The Person
- `use`: ending
- `status`: public_ready
- `seed`: A stalled case is reopened by asking which evidence rule over-read the situation.

### Scene 20: Field Note Becomes A Question
- `use`: ending
- `status`: public_ready
- `seed`: The private story is reduced to a reusable question: who owns the evaluation budget?

### Scene 21: Unknown Is Treated As Absence
- `use`: middle
- `status`: public_ready
- `seed`: An institution is marked weak because no one checked whether a policy exists.

### Scene 22: Not Started Hides Behind Unknown
- `use`: ending
- `status`: public_ready
- `seed`: A real gap stays vague because everyone keeps calling it unconfirmed.

### Scene 23: Institution Pilot Scope Shrinks To Become Real
- `use`: middle
- `status`: public_rewrite
- `seed`: A broad support-system idea becomes useful only after it is limited to a few seeds, a review cadence, and data boundaries.

### Scene 24: Researcher Time Becomes The Hidden Constraint
- `use`: middle
- `status`: public_ready
- `seed`: Everyone assumes the researcher will attend every meeting until the weekly calendar reveals the company load is impossible.

### Scene 25: Student And Lab Continuity Enters The Room
- `use`: middle
- `status`: public_rewrite
- `seed`: The startup plan affects students, lab obligations, papers, and ongoing grants, so "founder commitment" cannot be read in isolation.

### Scene 26: Joint Research Partner Is Accidentally Rewritten As Customer
- `use`: middle
- `status`: public_rewrite
- `seed`: A collaboration partner's technical interest is turned into customer validation in the pitch deck.

### Scene 27: Investor NO As Axis Diagnosis
- `use`: ending
- `status`: public_ready
- `seed`: "Too early" is split into TRL, BRL, GRL, HRL, FRL, and thesis-fit instead of being heard as personal rejection.

### Scene 28: Founder Authenticity Moves A Candidate
- `use`: middle
- `status`: public_ready
- `seed`: A hire or partner responds not to the market slide, but to the researcher's reason for bringing the technology out.

### Scene 29: Founder Authenticity Cannot Run Payroll
- `use`: middle
- `status`: public_ready
- `seed`: The same authenticity that moves people does not handle contracts, hiring, compliance, and cash timing.

### Scene 30: Company Formation Creates Irreversible Expectations
- `use`: opening
- `status`: public_ready
- `seed`: The legal entity makes hiring, tax, governance, investor, and institution expectations start moving even if evidence is thin.

### Scene 31: Support Program Success Masks Readiness Gaps
- `use`: middle
- `status`: public_ready
- `seed`: A program milestone is achieved, but customer condition, IP order, and operator function remain open.

### Scene 32: Institution Funding As A Tool, Not A Push
- `use`: ending
- `status`: public_ready
- `seed`: Gap funding is used to reduce a named uncertainty, not to force incorporation.

### Scene 33: The First Customer Is Actually A Test Site
- `use`: middle
- `status`: public_rewrite
- `seed`: The first organization can host a test but cannot buy, creating a BRL/SRL split.

### Scene 34: A Supporter Becomes Outside The Researcher's Circle
- `use`: middle
- `status`: public_rewrite
- `seed`: A supporter tries to help but loses access because they did not understand the researcher's protected lines.

### Scene 35: Repeated Branches Become A Protocol
- `use`: ending
- `status`: public_rewrite
- `seed`: After many cases, the team stops relying on memory and writes the decision point, criterion, action, result, and later revision.

### Scene 36: Theory Returns To The Meeting Table
- `use`: ending
- `status`: public_ready
- `seed`: TRL/BRL/GRL/SRL/HRL/FRL/ERS are not left as terms; they return as the next meeting's questions and owners.

## 5. Tool / Question / Checklist Bank

### Tool 01: CEO Function Map
- `status`: public_ready
- `use`: Separate technical meaning, social reason, customer learning, funding, hiring, governance, university interface, and bad-news handling.

### Tool 02: Non-Delegable / Complementable Split
- `status`: public_ready
- `use`: Mark what must stay with the researcher and what can be carried by CEO/COO/CFO/BD/EIR/URA/supporter.

### Tool 03: Role Vacancy Table
- `status`: public_ready
- `use`: List each required function, current carrier, missing carrier, risk if empty, and next check.

### Tool 04: Researcher Commitment Boundary Sheet
- `status`: public_ready
- `use`: Clarify time, decision domains, research continuity, lab obligations, and non-negotiable lines.

### Tool 05: External Executive Fit Screen
- `status`: public_rewrite
- `use`: Test technical respect, researcher-boundary understanding, university constraints, time commitment, and trust-building behavior.

### Tool 06: Active Advisor Test
- `status`: public_ready
- `use`: Distinguish name-only advisor from decision-bearing, time-committed, trusted operator.

### Tool 07: Young Commercialization Talent First-30-Day Path
- `status`: public_ready
- `use`: Observe, map roles, translate stakeholder language, own one artifact, earn one function.

### Tool 08: First Meeting Respect Checklist
- `status`: public_ready
- `use`: Read paper, ask in researcher's language, name protected lines, check URA/TLO order, ask why social implementation matters.

### Tool 09: Three Disclosure Layers
- `status`: public_ready
- `use`: Public / NDA-needed / do-not-disclose-yet.

### Tool 10: Pre-Disclosure Review Sheet
- `status`: public_ready
- `use`: Check patent, paper, collaboration, meeting objective, material owner, and researcher consent.

### Tool 11: Meeting Purpose x Disclosure Matrix
- `status`: public_ready
- `use`: Split what can be said in support-program pitch, company interview, investor intro, DD, and joint research discussion.

### Tool 12: Slide Fact / Hypothesis / Hope Scrubber
- `status`: public_ready
- `use`: Mark each statement as confirmed fact, field hypothesis, supporter's interpretation, or desired future.

### Tool 13: Story-Travel Risk Check
- `status`: public_ready
- `use`: Ask where a slide, one-liner, or market claim may travel after the meeting.

### Tool 14: Customer Signal Translation Table
- `status`: public_ready
- `use`: Convert "interesting", "PoC", "introduce department", and "maybe budget" into missing evidence.

### Tool 15: Problem Owner / Budget Owner Split
- `status`: public_ready
- `use`: Identify who feels pain, who evaluates, who pays, who signs, and who bears failure.

### Tool 16: PoC Condition Ladder
- `status`: public_ready
- `use`: Interest -> field pain -> evaluation condition -> data boundary -> responsible owner -> budget path -> next decision.

### Tool 17: Before VC Readiness Sheet
- `status`: public_ready
- `use`: State what uncertainty capital will reduce, what DD can start now, and what must not be implied.

### Tool 18: Investor Feedback Translation
- `status`: public_ready
- `use`: Translate team weak / market unclear / too early / IP concern / not thesis into next checks.

### Tool 19: GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT Log
- `status`: public_ready
- `use`: Decision, reason, bottleneck, next 30-90 days, owner, return condition, review date.

### Tool 20: WAIT Is Work Checklist
- `status`: public_ready
- `use`: Technical validation, IP order, customer condition, CEO-function gap, university process, DD prep.

### Tool 21: HOLD Information Gap Card
- `status`: public_ready
- `use`: Missing fact, source to check, owner, deadline, and which decision the fact unlocks.

### Tool 22: NO_GO Without Blame Template
- `status`: public_ready
- `use`: Why this form is not right, what value remains, and which alternate route protects the research.

### Tool 23: Resource Shift Map
- `status`: public_ready
- `use`: Move effort away from visible activity toward the lowest readiness condition.

### Tool 24: 90-Day Return Condition Plan
- `status`: public_ready
- `use`: Define exact evidence needed to return from WAIT or RESOURCE_SHIFT.

### Tool 25: Failure-Learning Template
- `status`: public_ready
- `use`: Hypothesis, observation, missed signal, over/under-read axis, revised question, next red flag.

### Tool 26: Relationship Repair Log
- `status`: public_ready
- `use`: Record what trust was strained, what changed in conversation rule, and how next meeting avoids repeat.

### Tool 27: Field Note To Reusable Question
- `status`: public_ready
- `use`: Raw observation -> candidate lesson -> confidentiality -> reusable question -> theory impact -> validation.

### Tool 28: Composite Case Safety Filter
- `status`: public_ready
- `use`: 3+ source elements, no identifiable combo, no money/contract/person-score, reader question preserved.

### Tool 29: Confidentiality Gate
- `status`: public_ready as public method
- `use`: publishable / sanitized / internal_only. internal_only never enters body copy.

### Tool 30: Theory Change Gate
- `status`: internal_only source, public_rewrite method
- `use`: If a case would change terms, rubric, or model structure, separate evidence review from manuscript enthusiasm.

### Tool 31: Institution Nursery Self-Check
- `status`: public_ready
- `use`: Seeds, TLO/IP, URA/EIR, incubation, company connection, funding, governance, policy.

### Tool 32: Responsibility Pipeline Check
- `status`: public_ready
- `use`: For each support menu, ask where the output returns into one integrated decision.

### Tool 33: Unknown vs Not Started Matrix
- `status`: public_ready
- `use`: unknown = confirm later; not_started = evidence-backed absence; drafting = emerging; established = operating.

### Tool 34: Institution Policy Evidence Note
- `status`: public_rewrite
- `use`: Status, evidence note, source type, confirmation date, next verification without exposing private docs.

### Tool 35: Institution Pilot Gate
- `status`: public_rewrite
- `use`: Purpose, target users, target seeds, data boundary, review cadence, authority, stop/expand condition.

### Tool 36: Regional PoC Corridor Checklist
- `status`: public_rewrite
- `use`: Research source, clinical/field site, manufacturer/operator, governance, data, user acceptance, budget.

### Tool 37: Social Acceptance Split
- `status`: public_ready
- `use`: Separate expert support, operator burden, user acceptance, ethics, community narrative, and media/policy context.

### Tool 38: Clinical / Field Access Gate
- `status`: public_rewrite
- `use`: Clarify who can introduce, who approves, what data moves, and what burden the field carries.

### Tool 39: Macro Tailwind Phase Map
- `status`: public_ready
- `use`: Academia / industry / government / capital / society waves, and where they are out of phase.

### Tool 40: Tailwind Is Not GO Test
- `status`: public_ready
- `use`: Ask whether tailwind reduces a specific uncertainty or merely creates pressure.

### Tool 41: Integrated Score Next-Action Card
- `status`: public_ready
- `use`: Score is read as bottleneck and next action, not ranking, valuation, or permission.

### Tool 42: Bottleneck Axis Owner Table
- `status`: public_ready
- `use`: For each low axis, assign the person or institution function that can actually move it.

### Tool 43: Model Version Safety Note
- `status`: public_rewrite
- `use`: New model framing should be compared side-by-side before replacing past judgment.

### Tool 44: Retrofit Evidence Rule Revision
- `status`: public_ready
- `use`: Old evidence rule, what happened, revised evidence rule, next validation point.

### Tool 45: Decision Point Record
- `status`: public_ready
- `use`: Decision point, options, chosen branch, criteria, action, result, later interpretation.

### Tool 46: Reader Route Matrix
- `status`: public_ready
- `use`: Mark material by primary reader: researcher, URA/TLO, young venture builder, investor/company, institution leader.

### Tool 47: Chapter Ending Bridge
- `status`: public_ready
- `use`: One action, one unresolved anxiety, one reason the next chapter must exist.

### Tool 48: Internal Term Scrubber
- `status`: public_ready
- `use`: Replace company/system/thread/path words with field-first public language before body copy.

## 6. Theory Bridge Materials

### TRL: "The paper worked" is not "the company can carry it"

- Field material: lab result, paper, prototype, external condition, manufacturing/operation gap.
- Public explanation: TRL asks whether the technology can survive outside the research setting.
- Scene to use: a company wants a PoC, but the technology has only worked under controlled lab conditions.
- Caution: do not turn TRL into a scolding of research. It protects the research from being over-carried by a company too early.

### BRL: A positive reaction is not a buying system

- Field material: "interesting", scout interest, problem owner, evaluator, budget owner, procurement path.
- Public explanation: BRL rises when the customer problem, evaluation condition, and decision path become concrete.
- Scene to use: exploration team likes the idea; field operator and budget route are missing.
- Caution: do not create a separate public CRL unless editorially necessary; customer evidence can be explained inside BRL.

### GRL: Governance is the order that protects future freedom

- Field material: patent, paper, NDA, collaboration, ethics, contracts, COI, disclosure boundary.
- Public explanation: GRL asks whether the team can talk, test, contract, and decide without damaging legal or trust conditions.
- Scene to use: one slide contains unpublished data and collaboration-derived information.
- Caution: not legal advice. Keep it as question/checklist framing.

### SRL: Support from powerful actors is not acceptance by the use field

- Field material: patient/user concern, technician workload, community narrative, ethics, media, field workflow.
- Public explanation: SRL asks whether the social and use environment can accept the technology.
- Scene to use: a hospital doctor is supportive, but operators and patients have not been included.
- Caution: SRL needs more public-source cases before final manuscript thickening.

### HRL: Names on a slide are not functions filled

- Field material: researcher, CEO candidate, BD, ops, regulatory, university contact, young talent.
- Public explanation: HRL asks whether the team functions required to reduce uncertainty are actually carried.
- Scene to use: a CEO candidate is named, but no one owns weekly customer learning or university process.
- Caution: separate team-function coverage from personal founder assessment.

### FRL: Founder readiness is not personality ranking

- Field material: researcher authenticity, trust, resilience, learning speed, bad-news handling, execution complement.
- Public explanation: FRL separates non-delegable founder meaning from complementable business execution.
- Scene to use: the researcher moves people through authentic meaning but cannot run all operations.
- Caution: no person scores, psychometrics, or individual assessments in public body.

### sigma_SU: Tailwinds have phase, not just heat

- Field material: research wave, policy budget, industry demand, capital theme, society timing.
- Public explanation: sigma_SU names whether academia, industry, and government are moving in compatible directions.
- Scene to use: policy and research are hot, but industry adoption and social acceptance lag.
- Caution: a tailwind can be a WAIT reason when it creates pressure before readiness.

### Integrated Score: The number should change the next action

- Field material: readiness axes, bottleneck, decision branch, resource shift, return condition.
- Public explanation: integrated score is useful only when it shows which uncertainty to reduce next.
- Scene to use: apparent high promise becomes RESOURCE_SHIFT after low BRL/SRL/GRL are separated.
- Caution: do not include private weights, thresholds, calibration, or score history.

### Retrofit / Validation: A failed case can improve the map

- Field material: old evidence rule, actual outcome, revised question, next validation.
- Public explanation: retrofit means re-reading past judgment to improve future questions, not defending the past.
- Scene to use: "company interest" was over-read; the revised rule requires budget owner and evaluation owner.
- Caution: avoid blame and identifiable failure stories.

### ERS: The nursery is not the venture

- Field material: seed discovery, TLO/IP, URA/EIR, incubation, company access, funding, governance, policy.
- Public explanation: ERS asks whether the institution can repeatedly generate, protect, and grow Before Zero cases.
- Scene to use: individual case gaps become institution-side 30-90 day actions.
- Caution: do not rank institutions or add ERS directly to individual venture readiness.

## 7. Missing Chapters / Appendices Proposal

1. **顧客検証は「面白いですね」ではない**
   - Why: BRL needs a standalone reader-gripping chapter, not only repeated warnings.
   - Materials: Case 03, Tools 14-18, Scenes 03/11/27/33.

2. **研究者の夢を壊さず、会社の形に移す**
   - Why: The book needs more emotional and practical treatment of researcher identity.
   - Materials: Case 01, Case 04, Scenes 06/24/25/28/29.

3. **外部CEOを入れる前に見ること**
   - Why: The rebuttal to "researcher CEO is impossible" needs fit/misfit nuance.
   - Materials: Case 07, Tools 05-06, Scenes 12/27/34.

4. **若手事業化人材の最初の90日**
   - Why: Target readers include young founders/COOs/venture builders; give them a role path.
   - Materials: Case 08, Tool 07, Scenes 13/35/36.

5. **URA/TLOが会社化前に持てる実務機能**
   - Why: Institution readers need more than critique; they need role scripts.
   - Materials: Tools 08-13, 31-35.

6. **WAITを作業に変える**
   - Why: The current manuscript has WAIT language; a standalone checklist appendix can make it durable.
   - Materials: Case 09, Tools 19-24.

7. **Field Note To Reusable Question**
   - Why: This is the book's method chapter for learning without exposing private cases.
   - Materials: Case 10, Tools 25-30, Scenes 19-20/35.

8. **Institution Pilot Gate**
   - Why: Research institutions need a way to introduce Before Zero practice without over-scoping.
   - Materials: Case 11, Tools 31-36.

9. **SRL/GRL regulated-field mini cases**
   - Why: The theory section still needs more public-safe texture around social acceptance and governance.
   - Materials: Case 06, Tools 36-38, public external sources later.

10. **Composite Case Appendix By Reader**
    - Why: A commercial book can become more useful if readers can jump to their own role.
    - Materials: all 12 cases, Tool 46.

## 8. Editorial-Use Priority

P0 material for the next rewrite:

1. Case 03: "interesting" without budget owner. It thickens BRL and avoids overfitting to GAP/VC/CEO.
2. Case 07: external executive fit/misfit. It sharpens FRL/HRL without attacking external CEOs.
3. Case 08: young commercialization talent earns authority. It gives the book a practical reader identity.
4. Case 09: WAIT later becomes GO. It makes WAIT emotionally credible.
5. Tool 12: fact/hypothesis/hope scrubber. It can become a memorable reader artifact.
6. Tool 15: problem owner / budget owner split. It is the cleanest BRL reader tool.
7. Tool 21: HOLD information gap card. It prevents HOLD from becoming vague.
8. Tool 26: relationship repair log. It makes failure learning human.
9. Tool 33: unknown vs not_started matrix. It is simple and high-value for institution readers.
10. Tool 35: institution pilot gate. It turns ERS into an action plan.
11. Scene 15: hospital support is not social acceptance. It thickens SRL.
12. Scene 26: joint research partner accidentally rewritten as customer. It thickens GRL/BRL.
13. Scene 35: repeated branches become protocol. It connects field practice to method.
14. Theory bridge: integrated score as next-action card, not ranking.

## 9. Safety Notes For Public Rewrite

- Use composite cases by default. Do not present one private source as one public case.
- Remove all real names, institution names, company names, region-specific markers, event names, and source paths.
- Do not quote the transcript. Convert it into generalized scene mechanics.
- Do not mention internal tools, DB tables, scripts, local appliers, automations, source hashes, or branch names.
- Avoid legal, investment, HR, and institutional-ranking advice. Use "questions", "checks", "order", and "decision support."
- Do not expose score weights, thresholds, calibration, or individual assessments.
- If a scene needs too many details to make sense, classify it as internal_only and use only the pattern.
- For medical/regulatory/social-acceptance scenes, add public-source enrichment before final manuscript if possible.
- In chapter body, make the reader the acting subject: researcher, URA, TLO, young venture builder, investor/company, institution leader.
- Keep the public manuscript's narrator as field-literate guide, not support-provider salesperson.

## 10. Next Worker Brief

Recommended next worker:

`Textbook public manuscript rewrite materials integration v1`

Scope:

- Do not edit all chapters at once.
- Start with one high-impact band: Ch1 / Ch9 / Ch16 / Ch20 for BRL and failure learning, or Ch8 / Ch13 / Ch18 for founder-function fit.
- Use this v4 bank plus `PUBLICATION_POSITIONING.md`.
- Add filled artifacts, not only explanations.
- Run forbidden-term scan on public manuscript body.

Suggested first target:

- Rewrite/expand the "customer validation" thread across Ch1, Ch9, Ch16, Ch20 using Case 03, Tools 14-18, Tool 44, Scenes 03/11/26/27/33.
- Reason: this fixes the biggest non-GAP/VC/CEO gap and gives the book a second recurring tension.

## 11. Verification Notes

- Source inventory included.
- Classification words included: public_ready, public_rewrite, internal_only.
- Composite cases: 12.
- Scene bank: 36.
- Tool / question / checklist bank: 48.
- Theory bridge materials include: TRL, BRL, GRL, SRL, HRL, FRL, sigma_SU, integrated score, retrofit, ERS.
- Missing chapters / appendices included.
- Editorial-use P0 materials included.
- Safety notes included.
- Read-only source confirmation included.
- No DB write, external write, deploy, or local applier `--apply` was performed.
