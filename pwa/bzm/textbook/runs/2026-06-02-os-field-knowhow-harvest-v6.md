# Textbook OS Field Knowhow Harvest v6

Date: 2026-06-02 JST

Worker: `Textbook source mining / field know-how harvest worker`

Branch: `codex/textbook-os-field-knowhow-harvest-v6`

## 0. Purpose

This note harvests additional Before Zero field know-how from the old BZM text,
public manuscript, OS specs/manual/design/scripts, previous mining notes, and the
read-only event transcript. It does not rewrite the public manuscript.

The main editorial problem is now sharper than "add more examples." The global
navigation may still expose the old `pwa/bzm/*.md` body, where AMD is often the
subject. That material is valuable, but it must not be copied into the public
book as company explanation. It must be converted into reader-owned field
know-how.

## 1. Safety Boundary

- `public_ready`: usable as a public scene or tool after normal anonymization.
- `public_rewrite`: high-value source, but it needs composite treatment,
  anonymization, or reader-first reframing before manuscript use.
- `internal_only`: do not publish as-is. Use only as editorial evidence or a
  method source after stripping internal names, paths, implementation details,
  person-level assessments, contracts, prices, DB rows, and legal conclusions.

No DB write, external service write, deploy, or local applier `--apply` was
performed.

## 2. Source Basis

| source family | read/use | harvest value | classification |
|---|---|---|---|
| `PUBLICATION_POSITIONING.md` | public voice and forbidden company-promo gate | keeps this note from turning old BZM into brochure copy | internal_only rule |
| `AUTHOR_DIRECTIVES.md` | survival probability, earning body, too-early incorporation, J-curve/IPO caution | P0 lens for Ch06/09/19/23 rewrite | public_rewrite |
| current `public-manuscript/00-24` | current artifact spine and chapter gaps | insertion map baseline | public_ready style reference |
| old `pwa/bzm/*.md` | old BZM theory and AMD-subject language | conversion map from AMD subject to reader action | public_rewrite / internal_only |
| prior mining v3/v4/v5 notes | existing scene/tool banks | avoid duplicate generic material; extend with economics and conversion map | public_rewrite |
| `pwa/spec/3-13`, `manual/8-3`, L10 skill | Textbook Insights, evidence refs, confidentiality, approval/applier gates | field-note safety loop and public editorial loop | internal_only method source |
| management score / finance specs | raw signals, runway, budget/actual, confidence, death flags | "earning body" and survival lens without exact finances | public_rewrite |
| AMD Score / FRL / ERS design docs | bottleneck, F_character/F_capability, support capability, institution readiness | convert scoring into next uncertainty and support complementability | public_rewrite |
| Stapa transcript docx | read-only zip/XML extraction; no raw transcript pasted | researcher isolation, DD timing, paper-first trust, URA/TLO route, regional talent gaps | public_rewrite |

## 3. Additional P0 Editorial Findings

1. Old BZM's strongest material is not the formulas. It is the repeated habit of
   translating messy meetings into axes, missing owners, decision branches,
   evidence rules, and return conditions.
2. The phrase `AMD が見るべきもの` should become a repeatable reader behavior:
   "what the support person, industry-collaboration staff, URA, or junior
   operator checks before the room moves on."
3. `AMD OS 運用` should become the system by which field know-how survives the
   next project: record, classify, sanitize, approve, generalize, and reuse.
4. `AMD Score` should be demoted from branded score to a practical lens:
   survival probability, ability to earn, and the next uncertainty to reduce.
5. `AMD の提供価値` should become an honest support boundary: what an external
   supporter can complement and what they cannot replace.
6. `L2/Textbook Insights` should become an editorial safety loop for converting
   field notes into public tools without leaking the field.

## 4. Old BZM to Public Book Conversion Map

| source phrase | public rewrite direction | do_not_publish_as_is | status | chapter route |
|---|---|---|---|---|
| `AMD が見るべきもの` | `支援者/産連/URA/若手事業化人材が会議で確認すべきもの` | company-subject voice makes the book a method brochure | public_rewrite | 12, 16, 23 |
| `AMD が見る現場` | `伴走者が観察する現場のズレ` | implies private operating authority | public_rewrite | 01, 02, 03 |
| `AMD の伴走余地` | `外部支援で補完できる機能` | sounds like service sales | public_rewrite | 08, 13, 18 |
| `AMD が担う` | `支援者が一時的に引き受けられる実務` | overclaims capability and centers provider | public_rewrite | 08, 18, 23 |
| `AMD の提供価値` | `補完できる経営実務と、補完できない資質の境界` | public body should not quantify company value | public_rewrite | 13, 18, appendix |
| `frl_cap_amd` | `support capability / 補完可能な経営実行力` | internal variable name and company-specific measure | public_rewrite | 18 |
| `AMD OS` | `現場メモを次案件に渡す仕組み` | product/platform copy | public_rewrite | 10, 20, 22, 23 |
| `D-7 Textbook Insights Textbook Insights` | `現場メモを安全に本へ変換する編集ループ` | internal workflow term | public_rewrite | 22 |
| `candidate` | `掲載候補 / 未検証の素材` | internal DB state | internal_only term | 22 |
| `local applier` | `承認後にだけ反映する手順` | implementation detail | internal_only term | 22 |
| `routing` | `どの章・道具へ変換するかの編集判断` | implementation detail | internal_only term | 22 |
| `AMD Score` | `準備度・生存確率・次に下げる不確実性を見る道具` | branded score too early | public_rewrite | 15, 16, 19 |
| `点数` / `score` | `次の一手を選ぶための見取り図` | ranking frame weakens field usefulness | public_rewrite | 19, 23 |
| `律速軸` | `いま一段下げるべき不確実性` | formula-first term needs a scene first | public_ready after context | 12, 16, 19 |
| `M x X x F` | `追い風、会社側の準備、担い手の準備` | internal display/formula expression | public_rewrite | 15, 19 |
| `P x R x S` | `潜在規模、到達準備、生存条件` | model candidate; not adopted public theory | public_rewrite | 19, appendix |
| `R_net` | `小さく稼ぐ力が本命を毀損していないか` | unadopted model variable | public_rewrite | 06, 19 |
| `Management Score / VS` | `支援者自身の体力と継続可能性を見る裏側の視点` | internal company vital | internal_only source | appendix |
| `raw signal` | `根拠を一度保存してから判断する` | DB source vocabulary | public_rewrite | 22, 23 |
| `source refs + short snippet + hash` | `生の記録を出さず、根拠の所在だけ残す` | implementation vocabulary | public_rewrite | 22 |
| `BZM review required` | `理論を変える前に反例と複数事例を見る` | internal review status | public_rewrite | appendix |
| `正本` / source paths | `公開本文から削除し、編集メモに退避` | path/internal governance leakage | internal_only | none |

## 5. Composite Case Bank

### Case 01: The Meeting Where "AMD Sees" Becomes "The Room Checks"
- `status`: public_ready
- `chapters`: 12, 16, 23
- `scene`: A meeting is about to close with "company interest confirmed." The
  junior operator asks four quiet questions: who owns the pain, who owns the
  budget, what evidence would change the decision, and what must not leave the
  room yet.
- `tool`: closing checklist: owner / evidence / budget / disclosure.

### Case 02: The Old Score That Becomes A Survival Conversation
- `status`: public_rewrite
- `chapters`: 06, 09, 19, 23
- `scene`: A team sees a readiness score and wants to call it a GO. The useful
  discussion begins only after the score is translated into survival: cash path,
  first paid problem, missing operator, and the uncertainty that must fall next.
- `tool`: score-to-survival translation sheet.

### Case 03: The Small Revenue That Helps, And The Small Revenue That Distracts
- `status`: public_rewrite
- `chapters`: 06, 09, 19
- `scene`: A small paid pilot appears. One version reveals a real budget path and
  repeatable pain. Another consumes scarce technical time and pulls the team away
  from the core commercialization path.
- `tool`: earning-body test: signal, budget, repeatability, opportunity cost.

### Case 04: The External Supporter Who Can Run Ops But Cannot Borrow Trust
- `status`: public_ready after composite
- `chapters`: 08, 13, 18
- `scene`: A support person can organize VC meetings, disclosure maps, budgets,
  and hiring steps. They cannot substitute for the researcher's protected line,
  authenticity, or long-term technical ownership.
- `tool`: complement / cannot-replace table.

### Case 05: The Operating System Hidden Behind A Field Notebook
- `status`: public_rewrite
- `chapters`: 10, 20, 22
- `scene`: The field notebook captures a failed customer assumption. The public
  lesson is not the private case. It is the evidence rule that changes next time.
- `tool`: observe / classify / sanitize / approve / reuse loop.

### Case 06: The Budget Owner Blank Cell
- `status`: public_ready
- `chapters`: 01, 09, 16, 23
- `scene`: A corporate logo is on the slide, but the budget-owner cell is blank.
  The team must decide whether to pitch investors or return to customer evidence.
- `tool`: corporate signal role map.

### Case 07: The Grant Room Pulls Toward J-Curve Language
- `status`: public_rewrite
- `chapters`: 04, 06, 09, 19
- `scene`: A grant application rewards big market language. The project needs
  that language to win resources, but the incorporation decision still depends on
  whether the first paid problem and survival path exist.
- `tool`: J-curve language vs survival evidence split.

### Case 08: The 6-9 Month DD Clock Before Incorporation
- `status`: public_rewrite
- `chapters`: 06, 09, 23
- `scene`: Investor diligence will take months. If incorporation happens first,
  the company inherits fixed costs and expectations while the evidence is still
  unresolved.
- `tool`: pre-incorporation diligence calendar.

### Case 09: The Paper-First Trust Entry
- `status`: public_ready after anonymization
- `chapters`: 03, 08, 10, 18
- `scene`: A support person arrives with a polished pitch but has not read the
  paper. In the repaired version, they ask in the researcher's own technical
  language before turning toward market language.
- `tool`: first-meeting respect checklist.

### Case 10: The URA/TLO Route Is Not Bureaucracy
- `status`: public_ready
- `chapters`: 03, 05, 14, 24
- `scene`: Direct access to a researcher feels fast, but skipping the
  industry-collaboration route later breaks IP, conflict-of-interest, and
  joint-research trust.
- `tool`: when to go through URA/TLO route map.

### Case 11: WAIT Turns Back To GO
- `status`: public_ready
- `chapters`: 06, 07, 19, 20, 23
- `scene`: WAIT is written with owners and a 90-day return date. The team later
  returns to GO after the evaluation owner, disclosure map, and paid-problem
  path are clearer.
- `tool`: WAIT return-condition ledger.

### Case 12: The Institution With Menus But No Responsibility Pipeline
- `status`: public_rewrite
- `chapters`: 03, 14, 21, 24
- `scene`: A research institution has grants, mentors, IP consultation, and
  pitch events. The researcher still repeats the story in every room because no
  one owns the path across rooms.
- `tool`: support menu vs responsibility pipeline diagnostic.

### Case 13: The Young Operator's Authority To Say "Unconfirmed"
- `status`: public_ready
- `chapters`: 08, 10, 18, 22
- `scene`: A junior commercialization person earns trust by saying "unconfirmed"
  in a room hungry for traction.
- `tool`: fact / hypothesis / unconfirmed / promise-forbidden memo.

### Case 14: The Region Rich In Seeds But Thin In Operators
- `status`: public_rewrite
- `chapters`: 14, 18, 21, 24
- `scene`: Research density is high, but the path for venture operators and
  practical commercialization talent is thin.
- `tool`: regional operator pipeline checklist.

### Case 15: The Investor No As Evidence, Not A Verdict
- `status`: public_ready
- `chapters`: 09, 10, 19, 20
- `scene`: An investor rejection is split into market mismatch, team gap, weak
  business evidence, governance risk, and timing mismatch.
- `tool`: rejection decomposition table.

## 6. Scene Seed Bank

1. `public_ready` Ch12/23: The meeting chair asks "What exactly are we checking
   before we leave?"
2. `public_ready` Ch01/09: A deck says "customer candidate," but the customer role
   is a technical scout.
3. `public_ready` Ch01/16: The budget owner is not in the room and nobody knows
   who that is.
4. `public_rewrite` Ch06/19: A small paid pilot reveals budget reality.
5. `public_rewrite` Ch06/19: A small paid pilot steals time from the main
   technology proof.
6. `public_ready` Ch05/23: A slide's red line is not legal advice; it is a trust
   boundary.
7. `public_ready` Ch05/09: A grant deck and investor deck use the same figure for
   different promises.
8. `public_ready` Ch08/18: The support person repeats the researcher's protected
   line before offering market language.
9. `public_rewrite` Ch08/18: A strong external CEO candidate smooths over the
   research constraint too quickly.
10. `public_ready` Ch03/14: The researcher walks between grant, IP, pitch, VC, and
    university rooms with no shared decision record.
11. `public_ready` Ch10/20: A failed PoC becomes useful only after the failed
    assumption is named.
12. `public_ready` Ch07/23: WAIT gets an owner, evidence target, and return date.
13. `public_ready` Ch07/23: HOLD has no owner and quietly becomes avoidance.
14. `public_rewrite` Ch09/23: Investor diligence starts before incorporation so
    the company clock does not start too early.
15. `public_ready` Ch09/19: Investor interest is separated from survival evidence.
16. `public_ready` Ch11/19: Policy heat makes urgency feel like readiness.
17. `public_ready` Ch11/12: Macro heat is strong, but the first paying problem is
    still unnamed.
18. `public_rewrite` Ch14/24: The institution has an EIR list, but nobody knows
    which candidates can work with researchers.
19. `public_ready` Ch14/21: Unknown is verified; not_started is built.
20. `public_ready` Ch22: A raw field note is converted into a reusable question.
21. `internal_only` Ch22: Candidate IDs and source hashes stay out of public copy.
22. `public_ready` Ch23: The decision log records what not to do this month.
23. `public_ready` Ch23: A customer signal ladder moves from interest to resource
    provision.
24. `public_ready` Ch24: The 90-day pilot uses only three seeds to avoid program
    theater.
25. `public_rewrite` Ch04/18: GAP pitch training and external CEO pressure create
    role whiplash.
26. `public_ready` Ch03/10: The first repair is to tell the researcher which
    assumption was overclaimed.
27. `public_ready` Ch05/10: A company email is not forwarded until disclosure
    color is set.
28. `public_rewrite` Ch16/20: The same evidence row is downgraded after a budget
    owner check.
29. `public_ready` Ch18: The founder function split prevents "researcher CEO or
    external CEO" binary thinking.
30. `public_rewrite` Ch18: Support capability is present, but character fit is
    not.
31. `public_ready` Ch19: The lowest axis decides where time goes next.
32. `public_rewrite` Ch19: A survival score improves when an unprofitable activity
    is deliberately cut.
33. `public_ready` Ch20: A rejection changes the evidence rule, not the person's
    worth.
34. `public_ready` Ch21/24: A nursery checklist exposes that enterprise connection
    exists only at the scout layer.
35. `public_rewrite` Ch24: A regional PoC corridor needs an owner across hospital,
    lab, company, and regulation.
36. `public_ready` Ch00: The opening artifact is a memo that refuses to let
    enthusiasm outrun evidence.
37. `public_ready` Ch01: A weaker evidence sentence protects trust better than a
    stronger marketing sentence.
38. `public_rewrite` Ch06: Incorporation is treated as a clock, not a ceremony.
39. `public_ready` Ch12: Readiness is shown by the lowest unaddressed axis, not by
    the thickest deck.
40. `public_ready` Ch22: The public book uses patterns, not private proof.

## 7. Tool / Question / Checklist Bank

1. `public_ready`: meeting-close four checks: owner, evidence, budget, disclosure.
2. `public_ready`: "interesting" translation: scout / evaluator / budget owner /
   operator / procurement.
3. `public_ready`: weak evidence sentence template.
4. `public_rewrite`: small revenue usefulness test.
5. `public_rewrite`: small revenue distraction test.
6. `public_rewrite`: survival before incorporation checklist.
7. `public_ready`: WAIT with owner / return condition / date.
8. `public_ready`: HOLD vs WAIT separation.
9. `public_ready`: RESOURCE_SHIFT "what we will not do this month" memo.
10. `public_ready`: red/yellow/blue disclosure map.
11. `public_ready`: distribution log for slides and emails.
12. `public_ready`: first-meeting paper-read checklist.
13. `public_ready`: URA/TLO route decision tree.
14. `public_rewrite`: 6-9 month diligence calendar.
15. `public_ready`: external CEO complementability sheet.
16. `public_ready`: protected-line repeat-back test.
17. `public_ready`: founder-function split table.
18. `public_rewrite`: support capability / cannot replace table.
19. `public_ready`: rejection decomposition table.
20. `public_ready`: failure-learning record: hypothesis, observation, missed
    signal, revised rule.
21. `public_ready`: evidence rule before/after.
22. `public_ready`: fact / hypothesis / unconfirmed / promise-forbidden memo.
23. `public_ready`: field-note safety loop.
24. `internal_only`: local applier safety gate as implementation source only.
25. `public_rewrite`: editorial approval loop for public cases.
26. `public_ready`: unknown vs not_started matrix.
27. `public_ready`: research institution responsibility pipeline map.
28. `public_rewrite`: regional operator pipeline checklist.
29. `public_ready`: pilot charter with stop / expand gate.
30. `public_ready`: lowest-axis review agenda.
31. `public_rewrite`: J-curve language vs survival evidence split.
32. `public_ready`: Valuation expectation vs readiness evidence table.
33. `public_rewrite`: score-to-survival translation sheet.
34. `public_ready`: next uncertainty to reduce worksheet.
35. `public_ready`: budget-owner blank cell warning.
36. `public_ready`: customer signal ladder.
37. `public_ready`: pre-incorporation company-clock inventory.
38. `public_rewrite`: run/no-run finance visibility questions without exact
    amounts.
39. `public_ready`: support-menu vs responsibility-pipeline diagnostic.
40. `public_ready`: "what evidence would make us change this decision?" prompt.
41. `public_rewrite`: theory-change caution: single case / repeated pattern /
    counterexample / public wording.
42. `public_ready`: chapter insertion reviewer checklist.

## 8. Chapter Insertion Map 00-24

| chapter | insertable material | recommended route |
|---|---|---|
| 00 | Three-column memo as evidence boundary; do not let enthusiasm outrun evidence | tighten opening artifact with "patterns, not private proof" |
| 01 | Budget-owner blank cell; weaker evidence sentence | expand customer-truth scene |
| 02 | Different clocks: company clock, research clock, grant clock, diligence clock | add 6-9 month DD clock as quiet pressure |
| 03 | Support menus can isolate researchers | add responsibility pipeline and URA/TLO respect route |
| 04 | GAP/VC/CEO role whiplash | connect pitch training to founder-function split |
| 05 | Slide/email/deck travels faster than consent | keep red/yellow/blue map and add distribution log |
| 06 | Too-early incorporation; small earning body; survival probability | add survival-before-incorporation checklist |
| 07 | WAIT as work; WAIT returns to GO | add return-condition ledger and HOLD distinction |
| 08 | Who carries what; external support boundary | add complement/cannot-replace table |
| 09 | Risk capital before customer truth | add investor diligence calendar and budget-owner test |
| 10 | Failure as evidence-rule revision | add rejection decomposition and trust repair scene |
| 11 | Macro heat vs readiness | add policy/grant heat caution without killing opportunity |
| 12 | Readiness axes in field language | add meeting-close four checks and lowest-axis review |
| 13 | Founder readiness | add protected-line repeat-back and complementability |
| 14 | Institution as nursery | add support menu vs responsibility pipeline scene |
| 15 | Why model the field | add "old score becomes survival conversation" bridge |
| 16 | Readiness axes field guide | add weak evidence sentence downgrade after budget-owner check |
| 17 | Macro alignment / Triple Helix | add field operator resistance and social/process friction |
| 18 | Founder readiness field-first | add support capability cannot replace authenticity |
| 19 | Integrated score as next action | add score-to-survival and small revenue distraction/usefulness |
| 20 | Retrofit validation | add before/after evidence rules and investor no decomposition |
| 21 | Institution readiness as nursery | add unknown vs not_started and responsibility owner |
| 22 | Toolkit A field-note safety loop | add old-BZM-to-public conversion loop and safety levels |
| 23 | Toolkit B decision/disclosure | add meeting-close checks, small revenue test, DD calendar |
| 24 | Toolkit C institution checklist | add 90-day pilot, regional operator pipeline, URA/TLO route |

## 9. New Chapter / Appendix Judgment

### New chapter likely needed

- **Earning Body Before Incorporation**: Ch06 and Ch19 contain pieces, but the
  author directive is large enough to deserve either a new chapter or a strong
  Ch06/Ch19 paired rewrite. It should cover survival probability, small paid
  evidence, opportunity cost, and J-curve/IPO caution without becoming "small
  money is always good."
- **Support Boundary / Complementability**: Ch08/13/18 cover this, but the old
  BZM `F_capability` and `frl_cap_amd` material needs a reader-facing chapter or
  appendix because it is a distinctive practical lens.

### Appendix/toolkit is better

- Old BZM formulas, alpha weights, K recalibration, CES details, BZM review gate,
  and Textbook Insights implementation should not become main-body narrative.
  Put them in an appendix/method note if needed.
- Management Score / company vital material should not enter public body except
  as an abstract caution: supporters also need enough runway and focus to keep
  promises.

## 10. Next Rewrite Candidate Ledger

| priority | candidate | chapters | reason |
|---|---|---|---|
| P0 | old-BZM conversion pass | 00-24, especially 12/16/19/22/23 | prevents old navigation/body from reverting to AMD-subject copy |
| P0 | survival / earning body pass | 06, 09, 19, 23 | preserves author directive and makes "稼げる体質" operational |
| P0 | support boundary pass | 08, 13, 18, appendix | turns AMD提供価値 into public complementability |
| P1 | field-note safety loop expansion | 10, 20, 22 | turns OS/L2 know-how into public editorial method |
| P1 | institution responsibility pipeline | 03, 14, 21, 24 | gives URA/TLO/institution readers concrete work |
| P1 | budget-owner / customer truth integration | 01, 09, 16, 23 | keeps PoC/customer validation from being overclaimed |

## 11. Count Gate

- Composite cases: 15
- Scene seeds: 40
- Tool / question / checklist items: 42
- Chapter insertion map: 00-24 complete
- Classification terms present: `public_ready`, `public_rewrite`, `internal_only`
- Required conversion fields present: `source phrase`, `public rewrite direction`,
  `do_not_publish_as_is`

## 12. Open Editorial Risks

- If the old BZM route remains reader-visible, a public positioning pass should
  either redirect to `public-manuscript` or add a very visible editorial warning
  that the old BZM files are internal/source text.
- The public name for `AMD Score` is still not decided. Until it is, public
  prose should describe function before name: readiness, survival probability,
  earning body, and next uncertainty.
- `P x R x S` / `R_net` is useful for the author's directive but not formally
  adopted as public theory. Treat it as an editorial lens, not a settled model.
- Exact revenue, runway, customer names, institution assessments, project
  histories, and person-level FRL/HRL judgments remain `internal_only`.
