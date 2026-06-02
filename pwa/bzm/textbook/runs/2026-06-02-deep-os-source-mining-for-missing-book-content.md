# Deep OS / Source Data Mining For Missing Book Content

Date: 2026-06-02 JST

Worker: `Textbook deep OS/source data mining for missing book content`

Scope:
- Mine AMD OS, old BZM, public manuscript, specs, manuals, prior mining notes,
  and read-only external transcript material for book-content gaps.
- Do not edit public manuscript body.
- Do not perform DB writes, external service writes, deploys, main merge, main
  push, or local applier `--apply`.
- Classify all material as `public_ready`, `public_rewrite`, or
  `internal_only`.

## Executive Summary

The missing content is not another list of concepts. The manuscript needs more
field events where readers can feel why a correct-looking action breaks trust,
money, responsibility, or timing.

The richest new source pattern from the OS is:

1. `planned / actual / unconfirmed` must be kept apart.
2. `interesting / scout interest / budget owner / adoption owner` must be kept
   apart.
3. `WAIT` is work only when it has an owner, return condition, review date, and
   a line naming what the team will not do this month.
4. `company formation` starts fixed obligations and public expectations before
   the team may have a budget route, disclosure line, founder-function split,
   or survival evidence.
5. `institution readiness` is not menu count. It is whether a responsibility
   pipeline moves across IP, customer access, operator matching, funding, and
   monthly low-axis review.
6. `field notes` become public material only after being classified, sanitized,
   approved, and converted into a composite scene, tool, or question.

Count gate:
- Composite scene seeds: 28
- Tool / question / checklist seeds: 40
- Chapter insertion map: Ch00-Ch24 all mapped
- Classification terms present: `public_ready`, `public_rewrite`,
  `internal_only`

## Source Inventory

| source | mined value | classification | public route |
|---|---|---|---|
| `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` | reader-first gate, company-name ban, narrator stance | `internal_only` rule | acceptance gate |
| `pwa/bzm/textbook/AUTHOR_DIRECTIVES.md` | survival probability, earning body, too-early incorporation, J-curve / IPO caution | `public_rewrite` | Ch01, Ch06, Ch09, Ch19, Ch23 |
| `pwa/bzm/textbook/COMMANDER_TASKS.md` | current editorial loop, Act I-V status, next tasks | `internal_only` governance | keeps worker aligned |
| `2026-06-02-public-book-architecture-reset-brief.md` | composite case spine, field toolkit separation | `public_ready` architecture | book-level rewrite guide |
| `2026-06-02-os-field-knowhow-harvest-v6.md` | old-BZM conversion map, scene/tool banks, OS-to-public translation | `public_rewrite` | extend, not duplicate |
| `2026-06-02-act-iii-source-mining.md` | WAIT as work, responsibility map, investor evidence update | `public_ready` continuity | Ch07-Ch10 and later echoes |
| `2026-06-02-act-v-toolkit-source-mining.md` | score-to-survival, ERS as operating design, toolkit extraction | `public_ready` continuity | Ch19-Ch24 and appendix |
| `pwa/bzm/public-manuscript/00-24` | current chapter bodies and residue gaps | `public_ready` baseline | insertion map only |
| old `pwa/bzm/*.md` | GO/WAIT/NO_GO, retrofit, FRL/ERS/score logic, old company-subject language | `public_rewrite` / `internal_only` | convert to reader behavior |
| `pwa/spec/4-2-amd-score-current-spec.md` | bottleneck, M/X/F split, PRS comparison boundary, R_net caution | `internal_only` method source | translate to next uncertainty / survival conversation |
| `pwa/manual/4-5-management-score-and-finance-simulation-spec.md` | runway, death flags, actual/forecast/unconfirmed split, raw-before-score | `internal_only` method source | abstract into survival evidence discipline |
| `pwa/manual/6-4-finance-payment-confirm-spec.md` | expected vs actual payment, signed confirmation, freee/manual confirmation, unmatched logs | `internal_only` method source | paid-evidence scenes without amounts |
| `pwa/spec/3-9-l2-protocol-current-spec.md` | branch point, criteria, action, append-only observations | `internal_only` method source | evidence-rule repair scenes |
| `pwa/spec/3-13-l2-textbook-insights-current-spec.md` | confidentiality, review gates, evidence_refs, internal_only skip | `internal_only` method source | field-note safety chapter |
| `pwa/spec/4-3-ers-current-spec.md` | unknown vs not_started, admin-only evidence, policy matrix | `internal_only` method source | institution nursery scenes |
| `pwa/design/institution_readiness.md` | ERS 8 axes, support menu vs governance, institution policy status | `public_rewrite` | Ch14, Ch21, Ch24 |
| `pwa/bzm/8-2-field-decisions-and-branches.md` | decision branch intake template | `public_rewrite` | Ch07/23 tool |
| `pwa/bzm/8-3-failures-pivots-and-revisions.md` | failure-learning intake template | `public_rewrite` | Ch10/20 tool |
| `pwa/bzm/8-4-relationship-playbook.md` | stakeholder-specific order and expectation gaps | `public_rewrite` | Ch03, Ch08, Ch13 |
| `pwa/bzm/8-5-before-zero-checkpoints.md` | reusable question and field-transition checkpoint | `public_rewrite` | Ch22-Ch24 appendix |
| `/Users/masa/projects/AMD/AMD/stapa/イベントの文字起こし.docx` | read-only themes: researcher isolation, VC diligence clock, paper-first trust, URA route, local support pressure | `public_rewrite` after anonymization | composite only; no raw transcript |

## Public-Ready Composite Scenes

1. `SCENE-01` `public_ready` Ch00/01: A deck sentence sounds better after pitch training, but the young operator notices that "customer candidate" has swallowed three unknowns: scout, evaluator, and budget owner.
2. `SCENE-02` `public_ready` Ch01/09: A corporate scout says the technology is interesting. The room stops before writing "customer evidence" because nobody can name whose budget would change.
3. `SCENE-03` `public_ready` Ch02/11: Three clocks hit in one week: a grant deadline, a researcher disclosure concern, and a company meeting. The project feels urgent, but urgency points to three different tasks.
4. `SCENE-04` `public_ready` Ch03/14: The researcher repeats the same story to an accelerator, IP office, investor mentor, and corporate contact. Every room helps, yet no one owns the path across rooms.
5. `SCENE-05` `public_rewrite` Ch04/13: A researcher is praised as entrepreneurial in one room, then hears that an external CEO should take over in the next. The damage is not the phrase itself; it is that no one split functions before saying it.
6. `SCENE-06` `public_ready` Ch05/23: A send-scheduled investor deck is stopped minutes before release because one line crosses the protected disclosure boundary.
7. `SCENE-07` `public_ready` Ch05/23: The deck is marked red/yellow/blue, but the map also names who may say each line and who may receive each version.
8. `SCENE-08` `public_rewrite` Ch06/19: Incorporation is framed as "just registration," then the room lists fixed costs, representative responsibility, hiring expectations, IP negotiations, and fundraising clock.
9. `SCENE-09` `public_ready` Ch06/19: A tiny paid pilot is accepted because it reveals pain, budget route, repeatability, and no strategic distraction.
10. `SCENE-10` `public_ready` Ch06/19: A different paid offer is refused because the money is real but the work would steal the scarce technical time needed for the main path.
11. `SCENE-11` `public_ready` Ch07/23: WAIT is written with owner, return condition, review date, and "we will not take investor introductions this month."
12. `SCENE-12` `public_ready` Ch07/10: An old HOLD memo with no owner is reread. The room sees that an unnamed pause became a lost quarter.
13. `SCENE-13` `public_ready` Ch08/18: The responsibility map has names in every column except "who tells bad news without softening it." That blank cell becomes the next hire/support task.
14. `SCENE-14` `public_ready` Ch08/13: A young commercialization lead asks for authority to write "unconfirmed," not for a bigger title.
15. `SCENE-15` `public_rewrite` Ch08/18: An external CEO candidate has capital fluency but cannot repeat the researcher's protected line accurately. The meeting changes from title matching to translation trust.
16. `SCENE-16` `public_ready` Ch09: The night before an investor meeting, the team weakens its best slide to become more credible.
17. `SCENE-17` `public_ready` Ch09/20: An investor no is decomposed into market mismatch, team gap, weak business evidence, governance risk, and timing mismatch.
18. `SCENE-18` `public_ready` Ch10/20: A failed PoC becomes useful only after the old evidence rule is named and replaced.
19. `SCENE-19` `public_ready` Ch10/22: A raw field note becomes a reusable public question after names, dates, and private facts are removed.
20. `SCENE-20` `public_ready` Ch11/17: A policy program, corporate interest, and grant opportunity arrive together, but the slowest condition remains budget-owner proof.
21. `SCENE-21` `public_ready` Ch12/16: "Ready" is split into technology, business, governance, social acceptance, and human capacity because one word no longer explains the case.
22. `SCENE-22` `public_ready` Ch13/18: The founder-function split lets the researcher remain central without pretending to own every company task.
23. `SCENE-23` `public_ready` Ch14/21: A support menu looks rich, but the responsibility pipeline has no owner from IP to customer to operator to monthly review.
24. `SCENE-24` `public_ready` Ch19: A high map almost becomes GO, then the lowest unresolved condition changes the next 90 days.
25. `SCENE-25` `public_ready` Ch19/23: RESOURCE_SHIFT cuts attractive work before adding low-axis work.
26. `SCENE-26` `public_ready` Ch21/24: An institution discovers that an EIR list is `unknown`, while monthly low-axis review is truly `not_started`.
27. `SCENE-27` `public_ready` Ch24: A 90-day institution pilot chooses three seeds and three tools so the pilot does not become program theater.
28. `SCENE-28` `public_rewrite` Ch03/14/24: A region is rich in research and thin in operators. The book can show this as a pipeline design problem, not a talent complaint.

## Public-Rewrite Raw Materials

### Survival / Earning Body

- `public_rewrite`: Small paid evidence should be treated as a test of pain,
  budget route, repeatability, opportunity cost, and strategic fit.
- `public_rewrite`: Payment refusal is more valuable than polite interest when
  it reveals who owns budget, what condition blocks adoption, or why the use
  case is not painful enough.
- `public_rewrite`: A small payment can create false comfort if it starts a
  service-like path that weakens the main deep-tech path.
- `public_rewrite`: J-curve / IPO language can be necessary for some seeds, but
  it should not become the default financing curve for every research result.
- `public_rewrite`: Company formation should be shown as a clock that starts
  obligations, not as a ceremony that proves seriousness.

### Local Rationality Without Villains

- `public_rewrite`: A support program may reward sharp pitch language because
  it needs selection, comparability, and momentum.
- `public_rewrite`: A university may slow down disclosure because it must
  protect IP, COI, researcher continuity, and future joint research.
- `public_rewrite`: A VC may press for CEO clarity because capital needs an
  accountable operating function, not because it dislikes researchers.
- `public_rewrite`: A company scout may be sincerely interested without having
  pain ownership, evaluation authority, or budget control.
- `public_rewrite`: A researcher may resist company language because the
  research meaning and protected line are being moved faster than trust.

### Evidence Discipline From OS Operations

- `public_rewrite`: Expected amount, actual confirmation, and unmatched payment
  are three different states. Use this as a public analogy for commercial
  evidence.
- `public_rewrite`: Forecast, actual, and unconfirmed should not be averaged
  into one optimistic story.
- `public_rewrite`: Raw signal first, score later. The book can show a meeting
  that saves the raw observation before deciding what it means.
- `public_rewrite`: Unknown must not be softened into "probably fine." Unknown
  becomes a confirmation task.
- `public_rewrite`: Not_started must not be hidden as unknown. Not_started
  becomes a building task.

### Responsibility And Role Fit

- `public_rewrite`: External CEO fit is not title fit. It is translation trust,
  bad-news behavior, protected-line respect, and first-90-day execution.
- `public_rewrite`: A young operator can be useful before being senior if they
  own memory, evidence hygiene, and the right to keep weak evidence weak.
- `public_rewrite`: Researcher本人, external CEO, young commercialization talent,
  and institution support each misfit when one is asked to carry another's
  function without naming the transfer.

## Internal-Only Materials

Do not publish as-is:

- `internal_only`: company names, internal abbreviations, route names, source
  paths, worker/thread/commander language.
- `internal_only`: raw transcript wording, speaker identity, event-specific
  wording, private institutional relationship details.
- `internal_only`: DB table names, candidate IDs, source hashes, exact row
  references, prompt text, local applier implementation details.
- `internal_only`: exact finance amounts, runway, invoices, payout timing,
  payment tokens, billing logs, freee details, or company vital scores.
- `internal_only`: exact AMD Score / PRS values, thresholds, weights,
  calibration, unapproved P/R_net rubric, or person-level founder judgments.
- `internal_only`: legal conclusions about disclosure, IP, incorporation,
  representative liability, employment, or fundraising.
- `internal_only`: any raw case that requires a private person, project,
  institution, URL, or confidential document to be named for the reader to
  understand it.

## Missing Chapter / Content Map 00-24

| chapter | missing material to add | classification | insertion route |
|---|---|---|---|
| Ch00 | Make the opening near-mistake sharper: a sentence becomes too strong before anyone notices the budget/disclosure gap. | `public_ready` | expand scene before explanation |
| Ch01 | Add a payment refusal or budget-owner absence event so "interesting" fails on the page. | `public_ready` | replace essay-like evidence discussion with event |
| Ch02 | Tie clock conflict to concrete consequences: a grant deadline creates a deck risk, not just urgency. | `public_ready` | one scene artifact: deadline map |
| Ch03 | Show support menus fragmenting responsibility across rooms. | `public_ready` | traveling researcher scene |
| Ch04 | Make external CEO pressure emotionally understandable and locally rational. | `public_rewrite` | no villain; function split scene |
| Ch05 | Add distribution ownership to disclosure colors: who can say what to whom. | `public_ready` | deck artifact in scene |
| Ch06 | Dramatize too-early incorporation with fixed obligations and pre-company DD sequence. | `public_rewrite` | registration meeting |
| Ch07 | Tighten WAIT vs HOLD with owner, return condition, review date, and not-doing line. | `public_ready` | WAIT ledger |
| Ch08 | Make responsibility allocation about blank cells, not definitions. | `public_ready` | responsibility map in room |
| Ch09 | Add payment refusal / budget-owner email before investor meeting. | `public_ready` | night-before deck rewrite |
| Ch10 | Use failure-learning as relationship repair, not retrospective table. | `public_ready` | repair meeting |
| Ch11 | Show macro heat as a pressure that can support GO or justify WAIT. | `public_ready` | three incoming external signals |
| Ch12 | Make lowest-axis work visible as the meeting's next task. | `public_ready` | readiness split after one-word failure |
| Ch13 | Add external CEO fit/misfit through repeat-back and bad-news behavior. | `public_rewrite` | candidate meeting |
| Ch14 | Convert institutional support from menu count to responsibility pipeline. | `public_ready` | echo of Ch03 |
| Ch15 | Delay theory naming until ordinary words fail in the same case. | `public_ready` | contradiction recap |
| Ch16 | Use axes as field confusion reducers, not a glossary. | `public_ready` | "ready" breaks into five concerns |
| Ch17 | Use policy, industry, and academic clocks as asynchronous waves. | `public_ready` | same-week signal scene |
| Ch18 | Keep founder readiness away from personality judgment. | `public_ready` | function and trust test |
| Ch19 | Add score-to-survival event with paid evidence useful vs distracting split. | `public_rewrite` | survival conversation |
| Ch20 | Add append-only observation logic: old rule, observed break, new rule, later check. | `public_ready` | evidence-rule retrofit |
| Ch21 | Preserve unknown vs not_started as a live institutional conflict. | `public_ready` | policy matrix review |
| Ch22 | Make safety loop a scene of converting raw note to public question. | `public_ready` | editor / operator scene |
| Ch23 | Add concrete appendix tools but keep main scene pressure first. | `public_ready` | move dense tables to appendix |
| Ch24 | Make 90-day institution pilot a practical operating design, not a checklist dump. | `public_ready` | pilot charter |

## Reader-Hook Scene Bank

1. `public_ready` `HOOK-01`: "The sentence was not false. That was why it was dangerous."
2. `public_ready` `HOOK-02`: The first customer signal fails because the customer is not in the room.
3. `public_ready` `HOOK-03`: The researcher is praised in one room and displaced in the next.
4. `public_ready` `HOOK-04`: The support program's deadline improves the deck and worsens the truth.
5. `public_ready` `HOOK-05`: The person who saves the meeting is the one willing to write `unconfirmed`.
6. `public_ready` `HOOK-06`: WAIT looks like retreat until the ledger starts deleting attractive work.
7. `public_ready` `HOOK-07`: The first payment is refused, and the project becomes clearer.
8. `public_ready` `HOOK-08`: The first payment is accepted, and the project becomes more dangerous.
9. `public_ready` `HOOK-09`: A VC no is not the wound; the wound is that every stakeholder hears a different reason.
10. `public_ready` `HOOK-10`: The institution discovers it has many doors and no corridor.
11. `public_ready` `HOOK-11`: The map's highest score is less important than the lowest unresolved condition.
12. `public_ready` `HOOK-12`: A private field note survives only by becoming a public question.

## Budget-Owner / Paid-Evidence Scene Bank

1. `public_ready` `BUDGET-01`: Corporate scout interest is downgraded after the team cannot identify the budget owner.
2. `public_ready` `BUDGET-02`: A budget owner refuses payment but names the adoption condition; the refusal becomes progress.
3. `public_ready` `BUDGET-03`: A paid pilot is accepted only after the team writes what it will teach.
4. `public_ready` `BUDGET-04`: A paid pilot is rejected because it would create service revenue and hide weak readiness.
5. `public_rewrite` `BUDGET-05`: Grant money is mapped to uncertainty reduction, not expense categories.
6. `public_ready` `BUDGET-06`: Investor prep pauses until the budget-owner cell is no longer blank.
7. `public_rewrite` `BUDGET-07`: Payment confirmation discipline becomes a public analogy: expected, actual, unmatched.
8. `public_ready` `BUDGET-08`: The room splits scout / evaluator / budget owner / adoption owner before writing "customer."
9. `public_rewrite` `BUDGET-09`: A small revenue path is marked "useful now, strategically dangerous later."
10. `public_ready` `BUDGET-10`: The next action is not more pitching; it is one meeting with the person who can say no with a budget reason.

## Failure And Repair Scene Bank

1. `public_ready` `REPAIR-01`: The team apologizes for an overstrong deck sentence by naming the exact assumption it added.
2. `public_ready` `REPAIR-02`: A company no is decomposed before anyone says "the market is not there."
3. `public_ready` `REPAIR-03`: A hospital PoC stalls because user support was confused with operator load and ethics readiness.
4. `public_ready` `REPAIR-04`: A founder-function mismatch is repaired by testing repeat-back, not by rejecting the candidate.
5. `public_ready` `REPAIR-05`: The investor meeting hurts, then becomes a better funding-use slide.
6. `public_ready` `REPAIR-06`: The WAIT ledger survives a morale challenge because it has a date and deleted activity.
7. `public_ready` `REPAIR-07`: A raw note is split into fact, hypothesis, interpretation, and promise-forbidden.
8. `public_rewrite` `REPAIR-08`: A premature incorporation plan is repaired by moving DD, IP negotiation, and role allocation before registration.
9. `public_ready` `REPAIR-09`: The revised rule gets a later observation date instead of a triumphant conclusion.
10. `public_ready` `REPAIR-10`: A young operator earns trust by reporting weaker evidence than the room wanted.

## Institution Nursery Scene Bank

1. `public_ready` `NURSERY-01`: The institution has grants, mentors, IP support, and events, but no owner across the path.
2. `public_ready` `NURSERY-02`: Unknown and not_started are separated in a policy matrix, changing the next week of work.
3. `public_rewrite` `NURSERY-03`: A university's strict disclosure route is shown as researcher protection, not bureaucracy.
4. `public_ready` `NURSERY-04`: A 90-day pilot tests whether researchers repeat their story fewer times.
5. `public_ready` `NURSERY-05`: The pilot uses only three seeds so operating habits can be observed.
6. `public_rewrite` `NURSERY-06`: An EIR list is useful only after fit, field, time, and protected-line behavior are known.
7. `public_ready` `NURSERY-07`: Monthly low-axis review keeps WAIT from disappearing after the first meeting.
8. `public_ready` `NURSERY-08`: Support menu count is replaced by handoff ownership between IP, customer, operator, funding, and review.
9. `public_rewrite` `NURSERY-09`: Regional talent shortage becomes operator-pipeline design, not a complaint.
10. `public_ready` `NURSERY-10`: The institution changes what the next researcher experiences before any new startup is formed.

## Tools That Should Become Appendix Artifacts

1. `TOOL-01` `public_ready`: strong sentence downgrade sheet.
2. `TOOL-02` `public_ready`: what we know / what we guess / what we must not promise memo.
3. `TOOL-03` `public_ready`: scout / evaluator / budget owner / adoption owner map.
4. `TOOL-04` `public_ready`: budget-owner blank-cell warning.
5. `TOOL-05` `public_ready`: customer signal ladder.
6. `TOOL-06` `public_ready`: payment refusal learning sheet.
7. `TOOL-07` `public_rewrite`: small paid evidence usefulness test.
8. `TOOL-08` `public_rewrite`: small paid evidence distraction test.
9. `TOOL-09` `public_rewrite`: J-curve language vs survival evidence split.
10. `TOOL-10` `public_ready`: expected / actual / unconfirmed evidence split.
11. `TOOL-11` `public_ready`: WAIT owner / return condition / review date ledger.
12. `TOOL-12` `public_ready`: WAIT "what we will not do this month" line.
13. `TOOL-13` `public_ready`: HOLD vs WAIT distinction.
14. `TOOL-14` `public_ready`: RESOURCE_SHIFT subtraction memo.
15. `TOOL-15` `public_ready`: pre-incorporation company-clock inventory.
16. `TOOL-16` `public_rewrite`: pre-company DD calendar.
17. `TOOL-17` `public_ready`: red/yellow/blue disclosure map.
18. `TOOL-18` `public_ready`: disclosure distribution log.
19. `TOOL-19` `public_ready`: protected-line repeat-back test.
20. `TOOL-20` `public_ready`: external CEO complement / cannot-replace sheet.
21. `TOOL-21` `public_ready`: founder-function split table.
22. `TOOL-22` `public_ready`: first-meeting paper-read respect checklist.
23. `TOOL-23` `public_ready`: URA / TLO / industry-collaboration route decision tree.
24. `TOOL-24` `public_ready`: relationship expectation-gap map.
25. `TOOL-25` `public_ready`: funding use as uncertainty-reduction sheet.
26. `TOOL-26` `public_ready`: rejection decomposition table.
27. `TOOL-27` `public_ready`: old evidence rule -> new evidence rule table.
28. `TOOL-28` `public_ready`: append-only observation ledger.
29. `TOOL-29` `public_ready`: fact / hypothesis / interpretation / unconfirmed / promise-forbidden memo.
30. `TOOL-30` `public_ready`: field-note safety loop.
31. `TOOL-31` `public_ready`: field-note thickness ladder.
32. `TOOL-32` `public_rewrite`: directive retention checklist.
33. `TOOL-33` `public_ready`: score-to-survival translation sheet.
34. `TOOL-34` `public_ready`: next uncertainty worksheet.
35. `TOOL-35` `public_ready`: lowest-axis review agenda.
36. `TOOL-36` `public_ready`: unknown vs not_started matrix.
37. `TOOL-37` `public_ready`: support menu vs responsibility pipeline diagnostic.
38. `TOOL-38` `public_ready`: institution 90-day pilot charter.
39. `TOOL-39` `public_ready`: stop / expand gate.
40. `TOOL-40` `public_ready`: researcher-load reduction check.

## Safety Notes

- Do not paste raw transcript text into public manuscript. Use only composite
  scenes and generalized questions.
- Do not expose internal route names, source paths, branch names, candidate IDs,
  source hashes, DB row IDs, payment tokens, finance amounts, or raw URLs.
- Do not present legal, IP, incorporation, employment, finance, or investment
  conclusions as advice. Present them as conversation triggers and checklists.
- Keep survival / earning body balanced: small revenue is evidence only when it
  reveals the future path and does not steal the resource needed for the main
  path.
- Keep support actors locally rational. No villain framing for universities,
  grants, VC, companies, researchers, or external CEO candidates.
- Keep ERS separate from individual project readiness. Institution nursery
  quality can change initial conditions, but it should not be added as a hidden
  score boost to a specific case.
- Keep `unknown` and `not_started` distinct. This is a public-facing discipline,
  not just a DB status detail.
- Any theory/rubric/model change should be treated as `internal_only` until
  repeated patterns, counterexamples, and review have been handled.

## Next Rewrite Prompt

Use this note to run a surgical manuscript enrichment pass, not a full rewrite.

Task:
- Edit `pwa/bzm/public-manuscript/00-prologue.md` through
  `24-institution-nursery-checklist.md`.
- Preserve the current composite case spine.
- Insert only high-value scene/event material from this note where the current
  manuscript still explains instead of dramatizing.
- Move dense tools into appendix/toolkit sections unless a character uses the
  artifact under pressure and the artifact changes the next scene.

Priority order:
1. Ch01/06/09/19: add concrete paid-evidence, payment-refusal, and
   budget-owner scenes.
2. Ch04/08/13/18: strengthen external CEO / young operator / researcher /
   institution responsibility fit and misfit.
3. Ch05/22/23: strengthen disclosure safety and field-note safety without raw
   internal leakage.
4. Ch14/21/24: turn institution nursery from support menu/checklist into
   responsibility-pipeline scenes.
5. Ch00-Ch03 and Ch11-Ch17: add reader hooks only where the current text
   releases tension too early.

Acceptance gate:
- `public_ready`, `public_rewrite`, and `internal_only` boundaries preserved.
- No raw transcript, internal path, DB row, exact finance, private URL, or
  person-level judgment in manuscript body.
- Survival / earning directive retained as scenes, not sermon.
- Local rationality preserved for support programs, universities, companies,
  investors, and researchers.
- Ch00-Ch24 still read as one continuous case, not a list of inserted examples.
