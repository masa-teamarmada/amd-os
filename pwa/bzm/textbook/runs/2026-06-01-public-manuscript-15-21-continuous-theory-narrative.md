# Public Manuscript 15-21 Continuous Theory Narrative Rewrite

> Date: 2026-06-01 JST
>
> Worker: `Textbook public manuscript 15-21 continuous theory narrative rewrite`
>
> Branch: `codex/textbook-public-manuscript-15-21-continuous-theory-narrative`
>
> Scope: `pwa/bzm/public-manuscript/15-why-model-the-field.md` through `21-institution-readiness-as-nursery.md`.

## P0 Orders Reflected

| P0 order | Coverage |
|---|---|
| Rewrite 15-21 as one continuous theory narrative | All seven chapters now follow one recurring composite case: a medical-adjacent research-institution seed with strong research, local hospital/manufacturer/policy tailwinds, pending gap funding, and misaligned disclosure, PoC, founder-function, and institution pathways. |
| Start each chapter from a decision unresolved by the previous chapter | Ch15 opens from expectation-only meeting conflict; Ch16 from the unresolved "ready" ambiguity; Ch17 from phase-misaligned local PoC; Ch18 from unresolved founder-function allocation; Ch19 from high-potential but wrong GO pressure; Ch20 from the model missing evidence; Ch21 from individual readiness not solving nursery readiness. |
| Introduce theory terms only after field misread is felt | TRL/BRL/GRL/SRL/HRL, sigma_SU, FRL, integrated score, retrofit/validation, and ERS are introduced after the relevant misread and artifact. |
| Ch17 absorbs local/regional regulated PoC corridor material | Ch17 contains a filled regional medical-adjacent PoC corridor: researcher, hospital, manufacturer, policy/local actor, industry-collaboration office, young venture builder, and user/patient side. |
| Ch19 integrated score changes action | Ch19 uses a filled mini-axis table and branch table to change the meeting outcome from apparent GO to RESOURCE_SHIFT. |
| Ch20 is model revision, not learning-log recap | Ch20 centers old evidence rule -> new evidence rule and a model revision log. It treats field notes as reusable questions without exposing raw cases. |
| Ch21 moves beyond Ch14 | Ch21 separates individual case readiness from nursery readiness, includes a filled unknown vs not_started artifact, and converts the case into institution-side actions. |

## Chapter Continuation Map

| Ch | Case continuation | Artifact inserted | Unresolved bridge |
|---|---|---|---|
| 15 | Same seed enters a meeting where every actor is optimistic but next action splits. | Decision memo and expectation/misread table. | "Ready" is still ambiguous. |
| 16 | The team separates technology, business, governance, social acceptance, and human-function readiness. | Readiness table, company-signal translation, disclosure layers, social acceptance table, role table. | Tailwinds are visible but phase-misaligned. |
| 17 | The local hospital/manufacturer/policy corridor is drawn and shown as close but unconnected. | Macro alignment map and PoC corridor table. | Founder function remains unassigned. |
| 18 | Researcher, young venture builder, and external executive candidate are compared by complementability. | Founder complementability map and external-executive condition table. | Case looks promising but next resource allocation is unresolved. |
| 19 | Filled axis scores show high promise but low BRL/SRL/GRL; branch changes to RESOURCE_SHIFT. | Integrated mini score, branch table, 90-day plan. | Current map may be wrong and must be validated. |
| 20 | Three months later, evidence failed in specific ways; evidence rules are rewritten. | Old evidence rule -> new evidence rule, field note card, model revision log. | Individual case learning still leaves institution workload. |
| 21 | The same case becomes an institution-readiness design problem. | Individual vs nursery table, unknown vs not_started table, institution action plan. | Theory returns to field tools and future cases. |

## Recurring Composite Case Spine

The spine is intentionally composite and non-identifying:

- A research-institution seed in a medical-adjacent domain.
- Strong lab result and positive expert reaction.
- A nearby hospital, a regional manufacturer, local policy interest, and gap-funding opportunity.
- A researcher who carries authenticity and research meaning but cannot carry all company functions.
- A young commercialization person who can translate and record but needs authority and trust.
- An external executive candidate with useful experience but uncertain trust fit.
- Institution-side gaps around disclosure review, medical PoC entrance, company budget-owner access, EIR/CXO trust formation, young-talent role definition, and monthly review.

This spine lets theory arise from repeated misreadings rather than from a curriculum sequence.

## Artifacts Added

- Ch15: filled decision memo.
- Ch16: readiness-axis table, customer-signal translation, disclosure-safety table, social-acceptance table, role-function table.
- Ch17: regional PoC corridor and macro phase map.
- Ch18: founder complementability map and external-executive condition table.
- Ch19: integrated mini score, decision branch, and 90-day resource-shift plan.
- Ch20: old evidence rule -> new evidence rule, field note card, model revision log.
- Ch21: individual-vs-nursery table, unknown vs not_started institution artifact, institution action plan, final layer table.

## Residual Risks

- The chapters are now substantially longer and more narrative than the rejected 15-21 draft, but a fresh cold-reader review should still test whether theory terms feel earned.
- The medical-adjacent PoC corridor is composite and intentionally generic; a future public-source enrichment pass could add domain texture without identifying private sources.
- Chapter 21 now changes action, but institution readers may want a later appendix with a fuller ERS worksheet.

## Verification Results

- Conflict marker scan: no hits on changed public manuscript, this run note, and Textbook task ledger.
- Forbidden term scan on changed public manuscript body: no hits for `AMD|Team ARMADA|株式会社チームアルマダ|まさ|AMD OS|L2|candidate|local applier|routing|pwa/|/spec|正本|司令塔|worker|スタパ|文字起こし|Vercel|Supabase`.
- Old template scan on changed public manuscript body: no hits for `明日使える問い|明日できる小さな行動`.
- Markdown heading check: all seven changed chapters have exactly one H1.
- Chapter char counts:
  - Ch15: 2,499 chars
  - Ch16: 3,053 chars
  - Ch17: 2,706 chars
  - Ch18: 2,620 chars
  - Ch19: 2,697 chars
  - Ch20: 2,650 chars
  - Ch21: 3,407 chars
- `git diff --check --cached`: passed after staging targeted files only.
- `npm run build` is omitted because this pass changes markdown manuscript, an internal run note, and a Textbook task ledger only. It does not change UI, route, runtime, manifest, schema, or deployment surface.
