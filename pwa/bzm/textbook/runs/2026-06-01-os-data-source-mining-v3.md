# Textbook OS/data source mining v3

> Date: 2026-06-01 JST
>
> Worker: `Textbook OS/data source mining v3`
>
> Purpose: AMD OS / BZM / spec / manual / design / schema / script / repo外docx に埋まっている Before Zero 実務知を、公開本に投入できる素材へ匿名化・一般化して採掘する。
>
> Important: this is internal editorial material. Public manuscript workers must not paste internal names, company names, paths, DB schema, thread/worker words, raw transcript text, private project names, prices, contracts, or personal evaluations into body copy.

## 0. Executive Summary

v3 expands the v2 case bank from `5 cases / 15 scenes / 20 tools` to:

- composite cases: **10**
- scene seeds: **34**
- tools / questions / checklists: **36**
- parameter bridges for chapters 15-21: **21**

The strongest new material from OS/data source mining is not a new dramatic anecdote. It is the operating layer behind the anecdotes:

1. **Evidence-bearing field notes**: L2 / Protocol / XRL / strategy-signal schemas show how raw events become reusable questions without preserving raw private data.
2. **Publication safety routing**: L2⑩ `practice_kind`, `confidentiality`, and BZM review gates can be reused as an editorial intake rubric.
3. **Institution readiness**: ERS / institution policy matrix gives concrete language for research institutions, URA, TLO, EIR, gap funds, governance, and researcher protection.
4. **Theory field-first bridge**: BZM source chapters already contain field-language hooks for sigma_SU / XRL / FRL / integrated score / ERS, but they need more scenes before formulas.
5. **Docx field texture**: the transcript adds paragraph-level seeds for researcher respect, pre-incorporation DD, support isolation, CEO-function decomposition, local ecosystem talent/funding gaps, and medical PoC pathways.

## 1. Source Map And Safety

| source family | source_hint | mined value | publication safety |
|---|---|---|---|
| Publication gate | `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` §§1-9 | Reader-first boundary, prohibited internal terms, target readers, GO/WAIT outcome promise | `internal_only` editorial rule. Use as lint, not copy. |
| Strategy | `pwa/bzm/textbook/PUBLICATION_STRATEGY.md` §§2-6 | Market gap, public structure, Part 5-6 theory transition | `public_rewrite`. Strategy language is internal; structure is reusable. |
| v2 case bank | `origin/codex/textbook-source-mining-case-bank-v2:pwa/bzm/textbook/runs/2026-06-01-source-mining-case-bank-v2.md` §§3-7 | Base 5 cases, 15 scenes, 20 tools, 15-21 bridge | `public_rewrite`. This v3 marks delta below. |
| 00-06 manuscript branch | `origin/codex/textbook-public-manuscript-00-06-editorial-integration:pwa/bzm/public-manuscript/00-06` | Scene-first case-zero pressure, disclosure, incorporation timing | `public_ready` prose style reference; branch content still must pass current gate. |
| 07-14 manuscript branch | `origin/codex/textbook-public-manuscript-07-14-bridge-expansion:pwa/bzm/public-manuscript/07-14` | Judgment words, role worksheet, failure learning, ERS bridge | `public_ready` prose style reference; use as narrative continuity. |
| BZM field chapters | `pwa/bzm/1-3-field-frictions-and-patterns.md:20-64`, `1-4-gates-and-judgment-branches.md:7-92`, `1-5-relationships-and-learning.md:5-56`, `1-6-field-elements-to-bzm-variables.md:20-80` | Repeated field patterns, decision branches, relationship-learning, field-to-variable translations | `public_rewrite`; remove AMD/internal voice. |
| BZM theory chapters | `pwa/bzm/2-1-sigma-su-triple-helix.md:17-150`, `3-1-xrl-group.md:7-120`, `4-1-frl-founder-readiness.md:63-199`, `5-1-amd-score-integration.md`, `7-1-ers-ecosystem-readiness.md:15-163` | Parameter bridge, formulas, readiness anchors, bottleneck logic, ERS layer separation | `public_rewrite`; formulas later, field scenes first. |
| L2/Textbook spec | `pwa/spec/3-13-l2-textbook-insights-current-spec.md:20-167`, `pwa/scheduled-tasks/amd-os-l10-textbook-insight-extract/SKILL.md:28-196`, `pwa/scripts/textbook_insight_routing.mjs:3-96` | Practice-kind taxonomy, routing, evidence, confidentiality, BZM review gate | `internal_only` as implementation; abstract as editorial intake pipeline. |
| L2 extraction/manual | `pwa/spec/3-1-l2-data-extraction-current-spec.md:5-17,48-87`, `pwa/manual/8-3-l2-extraction-routines-spec.md:205-237` | 5 source types, source refs not raw text, approved-to-applier safety | `internal_only` as OS operations; abstract as "field note to reusable question". |
| DB schema | `pwa/design/db_schema.md:144-184,1865-1900,2022-2060,2132-2177,2464-2501` | Data shapes for score inputs, meetings, signals, XRL evidence, textbook candidates | `internal_only`; use only to infer what kind of field facts exist. |
| ERS / institution design | `pwa/design/institution_readiness.md:59-107,138-227`, `pwa/spec/4-3-ers-current-spec.md:18-31,106-151`, `pwa/bzm/7-1-ers-ecosystem-readiness.md:15-163` | Unknown vs not_started, policy matrix, ERS 8 axes, institution cockpit contract | `public_rewrite`; drop specific institution evaluations. |
| Stapa transcript docx | `/Users/masa/projects/AMD/AMD/stapa/イベントの文字起こし.docx` paragraphs 220-305, 480-505, 590-640, 720-755, 305-386 | Researcher respect, 6-9 month DD, support isolation, CEO function, local talent/funding, medical PoC, protocolization | `public_rewrite`; raw transcript/event/speaker/company details are not public copy. |

### Docx extraction

The docx was read read-only using zip/XML fallback. Extraction result: 827 non-empty paragraphs / 46,859 chars. No repo-external file was edited.

## 2. Classification Rules Used In This Note

`public_ready`: Already anonymized enough to become a manuscript seed with light editing.

`public_rewrite`: High-value source, but requires anonymization, composite case building, legal/IP/contract/person sensitivity reduction, and removal of internal terms.

`internal_only`: Do not use as public body copy. Use only as structure, rubric, or editorial safety rule.

`publication route` values:

- `direct_scene`: almost directly usable as anonymized scene.
- `composite_scene`: combine multiple source families into one safe composite.
- `tool_box`: checklist / worksheet / question / table.
- `theory_bridge`: chapters 15-21 field-first opening or transition.
- `appendix_only`: useful but too operational/heavy for main body.

## 3. Delta From Case Bank v2

### Newly Added Material

- **C06 Evidence-bearing field note pipeline**: from L2/Textbook spec and schema. It gives a public-safe method for turning raw observations into reusable questions without exposing raw source text.
- **C07 Institution policy matrix case**: unknown vs not_started, evidence_note, source type, admin-only evidence. This is strong for URA/TLO/institution readers.
- **C08 Founder-function education path**: docx paragraphs 590-640 show "both research and management" as a missing career path, not just external CEO insertion.
- **C09 Regional PoC corridor**: docx paragraphs 720-755 add medical/clinical/manufacturer/research-institute local PoC scene.
- **C10 Protocol as shared field memory**: docx paragraphs 373-386 + L2 Protocol / L2⑩ spec show how repeated decision points become a common corpus.
- **Scenes 16-34**: mostly OS/source derived. These are added below.
- **Tools 21-36**: editorial intake, evidence refs, institution policy, source safety, theory bridge, reader routing.

### Thickened From v2

- Case 1 "researcher CEO twist" now has stronger source separation: docx paragraphs 292-303, BZM `1-3:54-64`, `1-4:62-77`, FRL `4-1:63-125`, manuscript Ch5/8/13.
- Case 2 "disclosure order" now includes not just IP but paper, collaboration, researcher trust, and source safety from `1-4:19-43`.
- Case 4 "support isolation" now ties to ERS and institution responsibility pipeline, not only emotional isolation.
- Case 5 "institution nursery" now has concrete ERS 8 axes and unknown/not_started semantics from `institution_readiness.md:59-107`.
- Theory bridge now explicitly maps field signals to sigma_SU / XRL / FRL / integrated score / ERS with source hints.

### Still Insufficient

- **SRL public-safe cases**: still thin. Need medical/food/AI/regulatory/social acceptance examples from public sources before Ch17 SRL becomes vivid.
- **BRL paid-commitment cases**: we have "interesting is not commitment" but need stronger scenes where budget owner / evaluation metric / procurement path is visible.
- **WAIT later became GO**: v2 and v3 both have WAIT tools, but not enough retrospective evidence showing a returned WAIT succeeding.
- **External CEO fit/misfit**: high-value but high personal-evaluation risk. Needs 3+ composite sources and no identifiable details.
- **Investor / CVC misread patterns**: we have "team weak" / "too early"; need more differentiated signals by investor type.

## 4. Composite Case Bank

### C01 Researcher Is Trained To Stand Forward, Then Asked To Step Back

- `status`: `public_ready` after anonymization.
- `publication route`: `composite_scene`.
- `source_hint`: docx paragraphs 292-303; `pwa/bzm/1-3-field-frictions-and-patterns.md:54-64`; `pwa/bzm/1-4-gates-and-judgment-branches.md:62-77`; `pwa/bzm/1-6-field-elements-to-bzm-variables.md:55-68`; `pwa/bzm/4-1-frl-founder-readiness.md:63-125`.
- `public use`: Open 00-06 or Ch18 with a researcher who has practiced a startup pitch for a grant interview, then hears in an investor room that an external CEO is necessary.
- `why it matters`: The contradiction is not "researcher CEO vs external CEO"; it is the unbundled CEO function.
- `tool insertion`: CEO Function Map, Role Vacancy Questions, Founder Function Split.
- `theory bridge`: FRL = F_character + F_capability; HRL = team role coverage; ERS = whether institution can supply EIR/CXO without displacing researcher trust.
- `reader fit`: Researchers feel seen; URA sees why pushing pitch alone backfires; investors see how "team weak" lands emotionally.

### C02 Pre-Disclosure Meeting Almost Becomes An IP/Trust Accident

- `status`: `public_ready` after anonymization.
- `publication route`: `composite_scene`.
- `source_hint`: `pwa/bzm/1-4-gates-and-judgment-branches.md:19-43`; `pwa/bzm/1-3-field-frictions-and-patterns.md:38-44`; docx paragraphs 238-250, 480-498.
- `public use`: Ch4 / Ch9. A team prepares slides for company and investor conversations while paper, patent, collaboration, and researcher consent are not separated.
- `why it matters`: Disclosure is not courage or cowardice; it is order design.
- `tool insertion`: Three Disclosure Layers, Meeting Purpose x Disclosure Matrix, Pre-Disclosure Review Sheet.
- `theory bridge`: GRL is not only regulation; it includes IP, contracts, disclosure, and trust-preserving order. BRL rises only when enough information can safely reach customers.
- `reader fit`: URA/TLO and researchers especially.

### C03 Company Says "Interesting" But No Commitment Exists

- `status`: `public_ready`.
- `publication route`: `direct_scene`.
- `source_hint`: `pwa/bzm/1-3-field-frictions-and-patterns.md:22-29`; `pwa/bzm/1-6-field-elements-to-bzm-variables.md:24-29,37-43`; `pwa/bzm/3-1-xrl-group.md:34-43`; manuscript Ch1 branch.
- `public use`: Ch1 / Ch9 / Ch17 BRL.
- `why it matters`: A positive reaction is a signal, not validation. The next question is whether there is a problem owner, budget owner, evaluation criterion, and next action.
- `tool insertion`: Customer Signal Translation Table, PoC Readiness Ladder.
- `theory bridge`: BRL includes customer readiness; CRL does not need its own public axis if BRL evidence is rich.
- `reader fit`: Investors and companies will recognize this misread quickly.

### C04 Support Menu Grows, Researcher Becomes More Alone

- `status`: `public_ready` after composite.
- `publication route`: `composite_scene`.
- `source_hint`: docx paragraphs 276-290; `pwa/bzm/1-3-field-frictions-and-patterns.md:54-64`; `pwa/bzm/1-5-relationships-and-learning.md:5-17,45-56`; manuscript Ch3/14 branch.
- `public use`: Ch3 / Ch14 / Ch21.
- `why it matters`: More rooms do not equal one responsibility pipeline.
- `tool insertion`: Responsibility Pipeline Check, Corridor Of Rooms Scene, Support Menu vs Responsibility Pipeline.
- `theory bridge`: ERS measures whether institutional functions are connected enough to reduce researcher burden.
- `reader fit`: URA, institution leaders, researchers.

### C05 Strong Research Town, Weak Founder Path

- `status`: `public_rewrite`.
- `publication route`: `composite_scene`.
- `source_hint`: docx paragraphs 590-640, 720-755; `pwa/design/institution_readiness.md:138-227`; `pwa/bzm/7-1-ers-ecosystem-readiness.md:55-88`.
- `public use`: Ch14 / Ch16 / Ch18 / Ch21. Use as "a research-dense region" rather than a named place.
- `why it matters`: A region can have researchers, institutes, hospitals, and companies but still lack founder-function career paths, local seed capital, and PoC orchestration.
- `tool insertion`: Institution Nursery Self-Check, Regional PoC Corridor Map, Founder-Function Career Path.
- `theory bridge`: sigma_SU may be high in academia/policy while HRL/FRL/ERS remain weak.
- `reader fit`: Institution leaders, local governments, young venture builders.

### C06 Field Notes Become Reusable Questions Without Publishing Raw Data

- `status`: `internal_only` as source, `public_rewrite` as concept.
- `publication route`: `tool_box`.
- `source_hint`: `pwa/spec/3-13-l2-textbook-insights-current-spec.md:20-105`; `pwa/manual/8-3-l2-extraction-routines-spec.md:205-237`; `pwa/design/db_schema.md:2464-2501`.
- `why not direct public`: The source names DB tables, local appliers, notifications, schema columns, and internal OS flow.
- `public use`: Convert to a chapter/tool on "How to turn field observations into reusable questions without gossip."
- `why it matters`: The book needs a method for learning from cases without becoming a case-exposure machine.
- `tool insertion`: Field Note Intake Card, Evidence Safety Filter, Confidentiality Gate.
- `theory bridge`: Retrofit validation and BZM review discipline.
- `reader fit`: All readers, especially URA and young venture builders.

### C07 Unknown Is Not The Same As Not Started

- `status`: `public_ready` after removing internal institution names.
- `publication route`: `tool_box`.
- `source_hint`: `pwa/design/institution_readiness.md:59-75`; `pwa/spec/4-3-ers-current-spec.md:18-31`; `pwa/design/db_schema.md:755-775`.
- `public use`: Ch14 / Ch21 / appendix. A research institution self-assessment separates "unconfirmed" from "confirmed absent."
- `why it matters`: Institutions are often misdiagnosed because no one distinguishes missing evidence from missing capability.
- `tool insertion`: Unknown vs Not Started Matrix, Evidence Note Table.
- `theory bridge`: ERS should not punish unknown as not_started; it should create a hearing TODO.
- `reader fit`: URA/TLO/institution leaders.

### C08 Founder Function Is A Career Path, Not Just A Hiring Gap

- `status`: `public_rewrite`.
- `publication route`: `composite_scene`.
- `source_hint`: docx paragraphs 590-640; `pwa/bzm/4-1-frl-founder-readiness.md:63-99,155-175`; `pwa/bzm/1-6-field-elements-to-bzm-variables.md:45-68`.
- `public use`: Ch13 / Ch18. Present the young "both research and management" person as a missing ecosystem role.
- `why it matters`: The external CEO narrative hides the possibility of training hybrid founder-function carriers.
- `tool insertion`: Founder Function Development Map, Non-delegable / Complementable Split.
- `theory bridge`: FRL and HRL connect: one person may carry authenticity while the team supplies execution.
- `reader fit`: Young venture builders and researchers.

### C09 Local Medical PoC Corridor

- `status`: `public_rewrite`.
- `publication route`: `composite_scene`.
- `source_hint`: docx paragraphs 720-755; `pwa/bzm/1-6-field-elements-to-bzm-variables.md:24-35`; `pwa/design/institution_readiness.md:171-227`.
- `public use`: Ch9 / Ch14 / Ch16 / Ch21. A research-dense area can test medical-adjacent applications locally if hospital, manufacturer, institute, regulatory, and researcher interfaces are deliberately connected.
- `why it matters`: Shows SRL/GRL/BRL in a concrete corridor rather than abstract axes.
- `tool insertion`: Local PoC Corridor Checklist, Clinical Access Gate.
- `theory bridge`: BRL and SRL cannot be read only from industry interest; clinical/field acceptance and governance matter.
- `reader fit`: Institutions, companies, investors, local governments.

### C10 Protocol Memory: Repeated Decision Points Become Shared Field Knowledge

- `status`: `internal_only` as source, `public_rewrite` as concept.
- `publication route`: `tool_box`.
- `source_hint`: docx paragraphs 373-386; `pwa/manual/8-3-l2-extraction-routines-spec.md:13-24,79-86`; `pwa/spec/3-1-l2-data-extraction-current-spec.md:19-33,66-77`; `pwa/scheduled-tasks/amd-os-l10-textbook-insight-extract/SKILL.md:28-48`.
- `why not direct public`: Internal protocol / L2 / candidate / OS implementation terms must not enter the manuscript.
- `public use`: Appendix or Ch10/20. "A field team should not store just stories; it should store decision point, criteria, action, result."
- `why it matters`: This is the engine for making Before Zero less dependent on one expert's memory.
- `tool insertion`: Decision Point Record, Protocol Pattern Card.
- `theory bridge`: Retrofit validation and repeated-branch learning.
- `reader fit`: Young venture builders, URA, support program operators.

## 5. Scene Seed Bank

Each scene has `source_hint`, `status`, and `publication route`.

1. **Pitch room / investor room role reversal**
   - `status`: `public_ready`
   - `publication route`: `direct_scene`
   - `source_hint`: docx paragraphs 292-303; `pwa/bzm/1-4-gates-and-judgment-branches.md:62-77`
   - `seed`: The same researcher is first trained to perform founder confidence, then told the company may need someone else to lead.

2. **The 6-9 month DD clock starts before incorporation**
   - `status`: `public_ready`
   - `publication route`: `direct_scene`
   - `source_hint`: docx paragraphs 238-250; manuscript Ch6 branch.
   - `seed`: Incorporation is a switch; if DD starts only after the switch, obligations move faster than readiness.

3. **Supporter arrives without reading the paper**
   - `status`: `public_ready`
   - `publication route`: `direct_scene`
   - `source_hint`: docx paragraphs 480-498.
   - `seed`: A researcher can tell whether the supporter treats the research as a living body or as pitch material.

4. **Industry collaboration office is bypassed**
   - `status`: `public_ready`
   - `publication route`: `direct_scene`
   - `source_hint`: docx paragraphs 494-498; `pwa/bzm/1-5-relationships-and-learning.md:9-17`.
   - `seed`: As institutions mature, order of greeting becomes part of trust and later contract safety.

5. **Company's "interesting" is mistaken for PoC readiness**
   - `status`: `public_ready`
   - `publication route`: `direct_scene`
   - `source_hint`: `pwa/bzm/1-3-field-frictions-and-patterns.md:22-29`; `pwa/bzm/1-6-field-elements-to-bzm-variables.md:24-27`.
   - `seed`: A scout likes the technology, but the budget owner, evaluation metric, and field pain are missing.

6. **Joint research information drifts into another deck**
   - `status`: `public_rewrite`
   - `publication route`: `composite_scene`
   - `source_hint`: `pwa/bzm/1-4-gates-and-judgment-branches.md:19-43`.
   - `seed`: A slide is technically accurate but contains information whose owner and disclosure permission are not settled.

7. **Corridor of helpful rooms**
   - `status`: `public_ready`
   - `publication route`: `direct_scene`
   - `source_hint`: docx paragraphs 276-290; manuscript Ch3 branch.
   - `seed`: The researcher walks through grant, IP, pitch, VC, and university rooms, but no one owns the integrated decision.

8. **WAIT becomes a 90-day work plan**
   - `status`: `public_ready`
   - `publication route`: `tool_box`
   - `source_hint`: `pwa/bzm/1-4-gates-and-judgment-branches.md:7-17,79-92`; manuscript Ch7 branch.
   - `seed`: The meeting ends with WAIT, but the board lists return conditions, owners, and next review date.

9. **Investor's NO is translated instead of swallowed**
   - `status`: `public_ready`
   - `publication route`: `direct_scene`
   - `source_hint`: `pwa/bzm/1-5-relationships-and-learning.md:19-31,45-56`; manuscript Ch9/10 branch.
   - `seed`: "Team weak" is decomposed into FRL, HRL, BRL, GRL, and investor-fit possibilities.

10. **Strong external CEO candidate weakens the researcher's trust**
    - `status`: `public_rewrite`
    - `publication route`: `composite_scene`
    - `source_hint`: docx paragraphs 590-640; `pwa/bzm/4-1-frl-founder-readiness.md:117-125,170-175`.
    - `seed`: Resume strength is not enough if the candidate treats the research and institution constraints as friction.

11. **Region has research, but no hybrid career path**
    - `status`: `public_ready` after anonymization
    - `publication route`: `composite_scene`
    - `source_hint`: docx paragraphs 590-620.
    - `seed`: A research-dense place has many potential CTOs, but few people trained to carry founder-function across research and management.

12. **Medical PoC could happen nearby, but no one bridges it**
    - `status`: `public_rewrite`
    - `publication route`: `composite_scene`
    - `source_hint`: docx paragraphs 720-755.
    - `seed`: Hospital, manufacturer, institute, and researchers are close, yet the corridor does not exist until someone designs it.

13. **Unknown is punished as not_started**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/design/institution_readiness.md:59-75`; `pwa/spec/4-3-ers-current-spec.md:29-31`.
    - `seed`: A support team cannot confirm an EIR rule and incorrectly records "none"; the next proposal fixes the wrong gap.

14. **High-looking score, low next-action clarity**
    - `status`: `public_rewrite`
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/bzm/1-6-field-elements-to-bzm-variables.md:70-80`; `pwa/bzm/5-1-amd-score-integration.md`律速判定 section.
    - `seed`: A case looks strong across technology and policy, but the bottleneck is first customer or founder function.

15. **Researcher's authenticity recruits better than a shiny title**
    - `status`: `public_ready`
    - `publication route`: `direct_scene`
    - `source_hint`: docx paragraphs 624-638; `pwa/bzm/1-6-field-elements-to-bzm-variables.md:55-68`.
    - `seed`: People move because the researcher speaks from real attachment to the technology, but that authenticity still does not run accounting.

16. **Field note is too private to publish but too useful to discard**
    - `status`: `internal_only` as source
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/spec/3-13-l2-textbook-insights-current-spec.md:98-105`; `pwa/scheduled-tasks/amd-os-l10-textbook-insight-extract/SKILL.md:75-91`.
    - `seed`: A field observation becomes a sanitized reusable question, while raw source stays private.

17. **Candidate approved is not the same as theory approved**
    - `status`: `internal_only`
    - `publication route`: `appendix_only`
    - `source_hint`: `pwa/spec/3-13-l2-textbook-insights-current-spec.md:120-125`.
    - `seed`: A note may be useful as a case but still require separate theory review before changing a model.

18. **Helper refuses to round unknown practice kind**
    - `status`: `internal_only`
    - `publication route`: `appendix_only`
    - `source_hint`: `pwa/scripts/textbook_insight_routing.mjs:53-75`; `pwa/manual/8-3-l2-extraction-routines-spec.md:230-231`.
    - `seed`: An intake pipeline should preserve ambiguity instead of forcing every observation into a familiar bucket.

19. **Monthly report is not final truth; it is a field snapshot**
    - `status`: `internal_only` as source
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/design/db_schema.md:1374-1401`; `pwa/spec/3-1-l2-data-extraction-current-spec.md:21-33`.
    - `seed`: A month can hold draft observations, final conclusions, and source coverage separately.

20. **Meeting summary separates decided/progress/next/risk**
    - `status`: `internal_only` as source
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/design/db_schema.md:1865-1900`.
    - `seed`: A good field record separates what was decided, what progressed, what comes next, and what remains risky.

21. **XRL evidence is a candidate before confirmation**
    - `status`: `internal_only` as source
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/design/db_schema.md:2132-2156`; `pwa/spec/3-1-l2-data-extraction-current-spec.md:192-197`.
    - `seed`: Readiness evidence should be confirmed, not silently treated as fact.

22. **Strategy signal is scoped before it affects company score**
    - `status`: `internal_only` as source
    - `publication route`: `appendix_only`
    - `source_hint`: `pwa/design/db_schema.md:2022-2060`.
    - `seed`: A signal may matter to a project without being a company-vital signal.

23. **Institution policy evidence is admin-only**
    - `status`: `internal_only`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/spec/4-3-ers-current-spec.md:18-31,81-104`; `pwa/design/db_schema.md:755-775`.
    - `seed`: Public self-checks can exist while evidence notes and internal paths remain restricted.

24. **ERS and AMD Score sit on different shelves**
    - `status`: `public_ready`
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/design/institution_readiness.md:15-23`; `pwa/bzm/7-1-ers-ecosystem-readiness.md:117-163`.
    - `seed`: The individual venture and the institution nursery are linked, but adding the nursery score into the venture score double-counts.

25. **Cobb-Douglas hides a low axis differently from ERS**
    - `status`: `public_ready`
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/bzm/7-1-ers-ecosystem-readiness.md:15-29,89-115`.
    - `seed`: Venture score punishes missing axis; institution score should reveal missing axis.

26. **One axis near zero can become bottleneck despite low weight**
    - `status`: `public_rewrite`
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/bzm/5-1-amd-score-integration.md`律速判定 / exercise section.
    - `seed`: Readers learn that a low social or governance axis can demand action even if its model weight is small.

27. **Policy is hot but customer is cold**
    - `status`: `public_ready`
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/bzm/2-1-sigma-su-triple-helix.md:17-28,146-150`; `pwa/bzm/3-1-xrl-group.md:34-43`.
    - `seed`: Government momentum can rise before industry/customer commitment; do not confuse sigma_SU with BRL.

28. **Paper is strong but real environment is untested**
    - `status`: `public_ready`
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/bzm/3-1-xrl-group.md:24-32,76-99`.
    - `seed`: TRL begins where the paper stops being enough.

29. **Society can reject what policy and industry support**
    - `status`: `public_ready`
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/bzm/3-1-xrl-group.md:48-60`.
    - `seed`: SRL remains as the public acceptance residue not captured by sigma_SU.

30. **A named advisor is not F_capability**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/bzm/4-1-frl-founder-readiness.md:155-175`.
    - `seed`: A famous advisor does not fill founder execution unless active role and decision rights are real.

31. **The raw transcript is useful because it is not quoted**
    - `status`: `internal_only`
    - `publication route`: `appendix_only`
    - `source_hint`: docx paragraphs 220-755.
    - `seed`: Use the transcript to build composite cases; do not cite the event or speakers in body copy.

32. **The first meeting is decided before the first ask**
    - `status`: `public_ready`
    - `publication route`: `direct_scene`
    - `source_hint`: docx paragraphs 480-498.
    - `seed`: Whether the supporter has read the research changes the researcher's sense of safety before any business question is asked.

33. **Internal meeting naming changes insider/outsider feel**
    - `status`: `public_rewrite`
    - `publication route`: `tool_box`
    - `source_hint`: docx paragraphs 703-715.
    - `seed`: Tiny labels can signal whether the supporter is inside the project or an external vendor.

34. **Knowledge trapped in one expert becomes an ecosystem bottleneck**
    - `status`: `public_rewrite`
    - `publication route`: `tool_box`
    - `source_hint`: docx paragraphs 330-386.
    - `seed`: The goal is not to immortalize one expert, but to turn repeated judgment points into shareable practice.

## 6. Tool / Question / Checklist Bank

1. **CEO Function Map**
   - `status`: `public_ready`
   - `publication route`: `tool_box`
   - `source_hint`: docx paragraphs 292-303, 624-638; `pwa/bzm/1-6-field-elements-to-bzm-variables.md:55-68`
   - `use`: Map technology meaning, social reason, customer learning, funding, hiring, IP/order, university interface, bad-news handling.

2. **GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT Log**
   - `status`: `public_ready`
   - `publication route`: `tool_box`
   - `source_hint`: `pwa/bzm/1-4-gates-and-judgment-branches.md:7-17,79-92`
   - `use`: Decision, reason, bottleneck, next 30-90 day work, owner, return condition, review date.

3. **WAIT Is Work Checklist**
   - `status`: `public_ready`
   - `publication route`: `tool_box`
   - `source_hint`: manuscript Ch6/7 branches; `pwa/bzm/1-4-gates-and-judgment-branches.md:45-60`
   - `use`: Convert delay into technical, IP, customer, founder-function, university, and funding tasks.

4. **Three Disclosure Layers**
   - `status`: `public_ready`
   - `publication route`: `tool_box`
   - `source_hint`: `pwa/bzm/1-4-gates-and-judgment-branches.md:19-43`
   - `use`: Public / NDA-needed / do-not-disclose-yet.

5. **Pre-Disclosure Review Sheet**
   - `status`: `public_ready`
   - `publication route`: `tool_box`
   - `source_hint`: `pwa/bzm/1-4-gates-and-judgment-branches.md:31-43`
   - `use`: Patent, paper, collaboration, meeting objective, material owner, researcher consent.

6. **Customer Signal Translation Table**
   - `status`: `public_ready`
   - `publication route`: `tool_box`
   - `source_hint`: `pwa/bzm/1-3-field-frictions-and-patterns.md:22-29`; `pwa/bzm/1-6-field-elements-to-bzm-variables.md:24-27`
   - `use`: Convert "interesting" into problem, owner, evaluation, budget, next action.

7. **Before VC Readiness Sheet**
   - `status`: `public_ready`
   - `publication route`: `tool_box`
   - `source_hint`: docx paragraphs 238-255; manuscript Ch9 branch.
   - `use`: What uncertainty will funding reduce; what DD can start before incorporation.

8. **Failure-Learning Template**
   - `status`: `public_ready`
   - `publication route`: `tool_box`
   - `source_hint`: `pwa/bzm/1-5-relationships-and-learning.md:19-31`
   - `use`: Hypothesis, observation, missed signal, readiness misread, revised question.

9. **Responsibility Pipeline Check**
   - `status`: `public_ready`
   - `publication route`: `tool_box`
   - `source_hint`: docx paragraphs 276-290; manuscript Ch14 branch.
   - `use`: Support menu count versus integrated responsibility flow.

10. **Institution Nursery Self-Check**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/design/institution_readiness.md:138-227`; `pwa/bzm/7-1-ers-ecosystem-readiness.md:55-88`
    - `use`: Seeds, URA, TLO, gap fund, EIR/CXO, contracts, COI, equity, policy, companies.

11. **Unknown vs Not Started Matrix**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/design/institution_readiness.md:59-75`; `pwa/spec/4-3-ers-current-spec.md:29-31`
    - `use`: unknown = confirm later; not_started = evidence-backed absence.

12. **Institution Pilot Gate**
    - `status`: `public_rewrite`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/spec/4-3-ers-current-spec.md:44-58`; `pwa/design/institution_readiness.md:249-255`
    - `use`: Scope, users, data boundary, review cycles, expansion/stop conditions.

13. **First Meeting Respect Checklist**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: docx paragraphs 480-498.
    - `use`: Paper read? researcher's own words? protected lines? URA/TLO order?

14. **Role Vacancy Questions**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/bzm/1-5-relationships-and-learning.md:45-56`; manuscript Ch8 branch.
    - `use`: Who carries weekly decisions, bad news, customer pain, university process, investor homework, researcher boundary?

15. **Theory Bridge Paragraph Builder**
    - `status`: `public_ready`
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/bzm/1-6-field-elements-to-bzm-variables.md:5-18,82-92`
    - `use`: Scene -> field signal -> later theory term.

16. **Investor Feedback Translation**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/bzm/1-5-relationships-and-learning.md:45-56`; docx paragraphs 298-303.
    - `use`: team weak / market unclear / too early / IP concern / not thesis.

17. **Composite Case Safety Filter**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` §§6-9; v2 §8.
    - `use`: 3+ case elements, no identifiable combo, no money/contract/personal score, reader question remains.

18. **Chapter Ending Bridge**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: editorial branch run notes, manuscript branch style.
    - `use`: one action, one unresolved anxiety, one next-chapter bridge.

19. **Seed Discovery First Pass**
    - `status`: `public_ready`
    - `publication route`: `appendix_only`
    - `source_hint`: `pwa/bzm/1-6-field-elements-to-bzm-variables.md:20-35`; `pwa/bzm/3-1-xrl-group.md:76-99`
    - `use`: official adoption, pre-incorporation, tech/application, funding program, initial XRL hypothesis.

20. **Field Note To Reusable Question**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/spec/3-13-l2-textbook-insights-current-spec.md:37-55,98-105`
    - `use`: raw observation, lesson, confidentiality, reusable question, theory impact, validation.

21. **Evidence Ref Card**
    - `status`: `internal_only` as source, public as method
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/spec/3-13-l2-textbook-insights-current-spec.md:74-105`
    - `use`: Date/title/snippet/hash/confidentiality without storing raw transcript/email/Slack.

22. **Practice Kind Routing Card**
    - `status`: `internal_only` as source
    - `publication route`: `appendix_only`
    - `source_hint`: `pwa/scripts/textbook_insight_routing.mjs:3-51`; `pwa/spec/3-13-l2-textbook-insights-current-spec.md:144-167`
    - `use`: decision_branch -> decisions; failure_learning -> failures; relationship_playbook -> relationships; reusable_question -> checklist.

23. **Confidentiality Gate**
    - `status`: `internal_only` as source, public as safety method
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/spec/3-13-l2-textbook-insights-current-spec.md:90-105,120-125`
    - `use`: publishable / sanitized / internal_only; internal_only never becomes body copy.

24. **BZM Review Gate**
    - `status`: `internal_only`
    - `publication route`: `appendix_only`
    - `source_hint`: `pwa/spec/3-13-l2-textbook-insights-current-spec.md:120-125`; `pwa/scheduled-tasks/amd-os-l10-textbook-insight-extract/SKILL.md:149-163`
    - `use`: Theory-case and formula/rubric/weight/chapter-structure changes require separate review.

25. **Meeting Note Four-Bucket**
    - `status`: `internal_only` as source, public as method
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/design/db_schema.md:1865-1900`
    - `use`: decided / progress / next_actions / risks.

26. **Strategy Signal Scope Check**
    - `status`: `internal_only` as source
    - `publication route`: `appendix_only`
    - `source_hint`: `pwa/design/db_schema.md:2022-2060`
    - `use`: Signal may be project-specific, company-vital, or merely observed; don't overgeneralize.

27. **XRL Evidence Candidate Card**
    - `status`: `internal_only` as source, public as method
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/design/db_schema.md:2132-2177`
    - `use`: axis, evidence kind, summary, structured value, source refs, confidence, status.

28. **Institution Policy Evidence Note**
    - `status`: `public_rewrite`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/design/institution_readiness.md:59-107`; `pwa/design/db_schema.md:755-775`
    - `use`: status, attribute, evidence note, source type, URL/path, confirmed date.

29. **ERS 8-Axis Self-Diagnostic**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/bzm/7-1-ers-ecosystem-readiness.md:55-88`; `pwa/design/institution_readiness.md:143-227`
    - `use`: seeds/tech, TLO/IP, incubation, company connection, funding, EIR/CXO, governance, policy.

30. **Founder Function Development Map**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: docx paragraphs 590-640; `pwa/bzm/4-1-frl-founder-readiness.md:63-99`
    - `use`: authenticity/technical love, learning speed, resilience, capital/ops experience, complement plan.

31. **Active Advisor Test**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/bzm/4-1-frl-founder-readiness.md:155-175`
    - `use`: Is the person active, decision-bearing, time-committed, and trusted, or just a name?

32. **Local PoC Corridor Checklist**
    - `status`: `public_rewrite`
    - `publication route`: `tool_box`
    - `source_hint`: docx paragraphs 720-755; `pwa/design/institution_readiness.md:171-227`
    - `use`: research source, clinical/field site, manufacturer/operator, governance, data, user acceptance, budget.

33. **Protocol Pattern Card**
    - `status`: `internal_only` as source, public as method
    - `publication route`: `appendix_only`
    - `source_hint`: docx paragraphs 373-386; `pwa/manual/8-3-l2-extraction-routines-spec.md:79-86`
    - `use`: decision point, criteria, action, result, later observation, reusable question.

34. **Internal Term Scrubber**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` §§6-7
    - `use`: replace company/system/thread/path terms with field-first public language.

35. **Parameter Bridge Table**
    - `status`: `public_ready`
    - `publication route`: `theory_bridge`
    - `source_hint`: `pwa/bzm/1-6-field-elements-to-bzm-variables.md:20-35`
    - `use`: field signal, what goes wrong, question to ask, later theory name.

36. **Reader Route Matrix**
    - `status`: `public_ready`
    - `publication route`: `tool_box`
    - `source_hint`: `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` §§3-4
    - `use`: mark each chapter seed by primary reader: URA, researcher, young venture builder, investor/company.

## 7. Failure / Stagnation / WAIT / NO_GO / RESOURCE_SHIFT Patterns

| pattern | source_hint | status | publication route | public use |
|---|---|---|---|---|
| WAIT without return condition becomes avoidance | `pwa/bzm/1-4:7-17,79-92`; Ch7 branch | `public_ready` | `tool_box` | Ch6/7; show WAIT as work. |
| GO because grant deadline exists | docx paragraphs 292-303; `pwa/bzm/1-4:62-77` | `public_rewrite` | `composite_scene` | Ch5/6; local optimization. |
| HOLD because IP / paper / collaboration scope unclear | `pwa/bzm/1-4:19-43` | `public_ready` | `tool_box` | Ch4; information bridge. |
| NO_GO as research-value protection | Ch7 branch; `pwa/bzm/1-4:7-17` | `public_ready` | `direct_scene` | Ch7/10; not a defeat. |
| RESOURCE_SHIFT from pitch to customer condition | `pwa/bzm/1-3:22-29`; Ch7 branch | `public_ready` | `tool_box` | Ch7/9; redirect effort. |
| Investor NO misread as personal rejection | `pwa/bzm/1-5:19-31,45-56` | `public_ready` | `direct_scene` | Ch10; failure learning. |
| Support actions increase activity but not readiness | docx paragraphs 276-290; `pwa/bzm/7-1:15-29` | `public_ready` | `composite_scene` | Ch3/14/21. |
| Unknown treated as institutional failure | `pwa/design/institution_readiness.md:59-75` | `public_ready` | `tool_box` | Ch14/21. |
| Theory change smuggled through a case | `pwa/spec/3-13:120-125` | `internal_only` | `appendix_only` | Editorial appendix only. |
| Raw source quote overexposes private context | `pwa/spec/3-1:5-17,79-87`; docx all ranges | `internal_only` | `appendix_only` | Method note: composite cases only. |

## 8. Reader-Specific Hit Map

### Industry Collaboration / URA / TLO

Most resonant:

- C02 Pre-Disclosure Meeting
- C04 Support Menu Grows
- C07 Unknown Is Not Not Started
- C09 Local Medical PoC Corridor
- Tools 4, 5, 9, 10, 11, 28, 29, 32

Why:

- They live in disclosure, institutional order, evidence status, and pipeline responsibility.
- Ch14 / Ch21 should give them a self-diagnostic, not a scolding.

### Researchers

Most resonant:

- C01 Researcher Role Reversal
- C04 Support Isolation
- C08 Founder Function Career Path
- Scenes 3, 7, 15, 32, 33
- Tools 1, 3, 13, 14, 30, 34

Why:

- These protect the researcher's identity, research continuity, and non-delegable authenticity while reducing the unfair load of "be CEO alone."

### Young Commercialization / Venture-Building Talent

Most resonant:

- C03 Company Says Interesting
- C06 Field Notes Become Reusable Questions
- C08 Founder Function Career Path
- C10 Protocol Memory
- Tools 2, 6, 8, 20, 21, 30, 33, 35

Why:

- They need craft: how to ask, record, classify, translate, and learn without hiding behind generic startup playbooks.

### Investors / Business Companies

Most resonant:

- C01 Researcher Role Reversal
- C03 Company Says Interesting
- C05 Strong Research Town
- C09 Local Medical PoC Corridor
- Scenes 5, 9, 14, 24, 27, 30
- Tools 6, 7, 16, 27, 31, 32

Why:

- They often misread positive interest, team weakness, policy heat, and founder-function gaps. The material helps turn vague skepticism into actionable readiness questions.

## 9. Parameter Bridge For Chapters 15-21

### Ch15: Readiness Is Not Valuation

- `source_hint`: `pwa/bzm/1-6-field-elements-to-bzm-variables.md:70-80`; `pwa/bzm/5-1-amd-score-integration.md`律速判定.
- `field scene`: The case looks attractive to outsiders, but the lowest axis still determines the next useful action.
- `bridge`: Readiness is not price, prestige, or excitement. It is a map of which uncertainty should be reduced next.
- `routes`: `theory_bridge`, `tool_box`.
- `use materials`: C03, Scene 14, Tools 15, 27, 35.

### Ch16: sigma_SU / Triple Helix

- `source_hint`: `pwa/bzm/2-1-sigma-su-triple-helix.md:17-48,86-150`; docx paragraphs 305-386, 720-755.
- `field scene`: Research, policy, and regional assets are all present, but the market/PoC corridor is not yet connected.
- `bridge`: sigma_SU is the aligned motion of academia, industry, and government; it is not equal to customer commitment.
- `routes`: `theory_bridge`, `composite_scene`.
- `use materials`: C05, C09, Scene 27.

### Ch17: XRL Field Anchors

| axis | source_hint | field signal | trap | material |
|---|---|---|---|---|
| TRL | `pwa/bzm/3-1:24-32,76-99` | paper/lab result exists | paper = company-ready | Scene 28 |
| BRL | `pwa/bzm/3-1:34-43`; `pwa/bzm/1-3:22-29` | company says interesting | interest = validation | C03 / Tool 6 |
| GRL | `pwa/bzm/1-4:19-43`; `pwa/bzm/3-1:44-47` | IP/paper/contract order matters | disclosure as bravery | C02 / Tools 4-5 |
| SRL | `pwa/bzm/3-1:48-60`; docx paragraphs 720-755 | clinical/user/social acceptance | policy/industry = acceptance | C09 |
| HRL | `pwa/bzm/3-1:62-66`; `pwa/bzm/1-6:28-34` | people exist, functions empty | titles = roles | C01 / Tool 14 |

### Ch18: FRL / F_character / F_capability

- `source_hint`: `pwa/bzm/4-1-frl-founder-readiness.md:63-125,155-199`; docx paragraphs 624-638.
- `field scene`: The researcher moves people through authentic meaning, but management execution still needs real carriers.
- `bridge`: FRL does not rank people; it separates non-delegable character from complementable execution.
- `routes`: `theory_bridge`, `tool_box`.
- `use materials`: C01, C08, Scenes 15, 30, Tools 1, 30, 31.

### Ch19: Integrated Score / Threshold / Decision Branch

- `source_hint`: `pwa/bzm/1-4:45-60,79-92`; `pwa/bzm/5-1-amd-score-integration.md`律速判定.
- `field scene`: A team asks whether to incorporate; score is useful only if it points to the bottleneck and branch.
- `bridge`: Integrated score should produce GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT with return conditions, not ranking theater.
- `routes`: `theory_bridge`, `tool_box`.
- `use materials`: Tools 2, 3, 15, 27, 35.

### Ch20: Retrofit Validation

- `source_hint`: `pwa/bzm/6-1-retrofit-verification.md:11-118`; `pwa/spec/3-13:37-55,120-125`.
- `field scene`: A failed or stalled case is reopened not to blame, but to ask which readiness signal was over/under-read.
- `bridge`: Retrospective validation should preserve evidence, confidence, and theory-review boundaries.
- `routes`: `theory_bridge`, `appendix_only`.
- `use materials`: C06, C10, Tools 8, 20, 21, 24, 33.

### Ch21: ERS / Institution Readiness

- `source_hint`: `pwa/design/institution_readiness.md:15-23,59-107,138-227`; `pwa/bzm/7-1-ers-ecosystem-readiness.md:15-163`; `pwa/spec/4-3-ers-current-spec.md:18-31`.
- `field scene`: The individual seed is strong, but the nursery has missing TLO, EIR/CXO, funds, governance, or company corridors.
- `bridge`: ERS is not a ranking; it makes support gaps visible. Unknown is not not_started. ERS should not be added directly into individual venture score.
- `routes`: `theory_bridge`, `tool_box`.
- `use materials`: C04, C05, C07, C09, Tools 10, 11, 28, 29, 32.

## 10. Public / Internal Classification Summary

| bucket | count | notes |
|---|---:|---|
| `public_ready` | 54 | Many are scene/tool seeds requiring only anonymized prose and chapter integration. |
| `public_rewrite` | 21 | Valuable but needs composite construction or removal of institution/project/company specifics. |
| `internal_only` | 25 | Use as structure/safety/rubric only. Not public body copy. |

Internal-only source families that must **not** be pasted into public manuscript:

- AMD / Team ARMADA / company name / individual names / event names / branch/path/thread/worker/司令塔 words.
- Supabase / Vercel / DB schema / local applier / candidate ID / notification implementation.
- Raw transcript paragraphs, especially speaker names, live event context, company track record, money, contracts, or named institutions.
- Specific institution evaluations and admin-only source paths.
- Personal FRL/HRL/ALQ/Grit/Resilience scores or identifiable founder assessments.

## 11. Direct Next Use For Manuscript Workers

For 00-06 rewrite:

- Use C01 as recurring pressure.
- Add C02 disclosure and C03 customer signal so the opening does not overfit to GAP/VC/CEO.
- Use Tool 2 and Tool 3 in Chapter 6/7 language, but as filled narrative examples.

For 07-14 bridge:

- Use C04, C05, C07 for Ch14.
- Use Tools 9-11 and 28-29 as filled worksheets, not empty templates.
- Use Scenes 32-34 to make relationship/playbook chapters more human.

For 15-21 theory:

- Start each theory chapter with the field scene in §9 before naming variables.
- Ch17 needs the five XRL field anchors table.
- Ch18 should contrast "authentic researcher with missing execution" and "experienced operator with weak trust fit."
- Ch21 should make unknown/not_started and ERS/AMD Score non-mixing impossible to miss.

For 22-26 tools/appendix:

- Tools 17, 20-24, 28-36 are best as appendix or method chapter.
- C06/C10 are strong meta-method material: learning from field notes without exposing private cases.

## 12. Verification Notes

- Count condition met: cases 10, scenes 34, tools/questions 36.
- Every case/scene/tool includes `source_hint`.
- Every case/scene/tool includes `publication route`.
- `public_ready`, `public_rewrite`, `internal_only` appear and are summarized.
- Internal material is explicitly marked as not direct public copy.
- No DB write, external service write, or local applier `--apply` was performed.
- Repo-external docx was read-only.
