# BZM Restart Current-State Audit And Figure Plan

Date: 2026-06-13 JST
Worker: BZM textbook restart current-state / figure TODO inventory
Scope: read-only audit of current `/bzm` chapter structure, figure placeholders, appendix/source risks, and D-7 Textbook Insights gap. Public chapter body and UI were not changed.

## Executive Status

- Current `/bzm` is the chapter-head story textbook baseline, not the old 24-chapter textbook.
- Confirmed structure: preface + Part I 4 chapters + Part II 9 chapters + Part III 1 chapter + Part IV 1 chapter + appendix = 17 registered entries including the appendix, 16 reading chapters if appendix is counted as back matter.
- Main priority is figure backlog. I found 33 current chapter `図版 TODO` placeholders in `pwa/bzm/*.md`, plus source/reference TODOs for royalty rates, founder/team evidence, readiness sources, and S/F academic sources.
- Data figures already have a script path: `pwa/scripts/bzm_figures.py` generates F1-F9 and currently contains F6-F9 used by the new textbook. The script explicitly treats some concept figures as outside the data-figure path.
- No figure generation method was chosen in this run. Method choice remains a Masa decision: matplotlib/script, hand-drawn SVG/HTML, or external image generation.
- D-7 Textbook Insights currently remains safe but stale: routing targets old slugs, and the local applier falls back to `pwa/bzm/legacy/` when a new chapter target is absent.
- Deployment: not needed for this run because only internal run note / commander ledger changed. Commit/push is still required by repo rule.

## Current Structure Confirmed

Source checked:
- `pwa/bzm/textbook/HANDOFF.md`
- `pwa/bzm/textbook/PUBLICATION_STRATEGY.md` section 0
- `pwa/bzm/textbook/PUBLICATION_POSITIONING.md`
- `pwa/bzm/textbook/AUTHOR_DIRECTIVES.md`
- `pwa/bzm/strategic-slack.md`
- `pwa/bzm/9-5-appendix-changelog.md`
- `/Users/masa/projects/AMD/BZSF/before_zero_theory.md`
- `/Users/masa/projects/AMD/BZSF/PRS_STRATEGIC_SLACK_OVERVIEW_20260612.html`
- `pwa/src/app/(app)/bzm/bzm-chapters.ts`

Registered structure from `BZM_PARTS`:

| Part | Slugs |
|---|---|
| Preface | `preface` |
| Part I Field | `field-before-zero`, `field-clocks`, `field-gates`, `field-who-carries` |
| Part II Model | `why-valuation-fails`, `model-overview`, `p-potential`, `r-readiness`, `s-survival`, `score-and-bottleneck`, `strategic-slack`, `model-critiques`, `retrofit-verification` |
| Part III Nursery | `nursery-ers` |
| Part IV Toolkit | `field-toolkit` |
| Appendix | `9-5-appendix-changelog` |

Current doctrine confirmed:
- Chapter format is `opening story -> explanation with equations/figures in the chapter -> anonymized example -> chapter-end questions`.
- Public chapters must avoid company/author/internal-operation vocabulary and keep cases anonymized.
- PRS is officially adopted as `P x R x S`; strategic slack is the dynamic layer of S, not a tenth score axis.
- Directives to preserve: survival probability / earning body, and KPI should be placed on bargaining power rather than just closed-deal count.

## Open Tasks From Handoff

| Priority | Task | Current status |
|---|---|---|
| 1 | Conceptual figures | Active. 33 current figure placeholders found. Method decision still needed from Masa. |
| 2 | Cold-reader pass from preface to appendix | Active next worker. Risks are mostly continuity, repeated conceptual setup, and terminology drift. |
| 3 | Appendix rebuild | Watch. References, symbols, glossary, and source notes are not yet rebuilt for the new 16-chapter body. |
| 4 | D-7 Textbook Insights receiving chapters | Blocked by design gap, not runtime failure. Current applier uses legacy fallback. |
| 5 | Publication package | Watch after figures/cold read/source appendix. |

## Figure TODO Inventory

Command used: `rg -n "図版 TODO|TODO" pwa/bzm`

Legend for method candidate:
- `script`: good fit for `pwa/scripts/bzm_figures.py` or a new deterministic matplotlib function.
- `svg/html`: best as clean editorial diagram, possibly hand-authored or exported as static asset.
- `external`: may benefit from external image generation or illustration pass, especially metaphor-heavy concept art.
- `undecided`: do not generate before Masa chooses figure style.

| File:line | What to draw | Class | Method candidate | Source data / theory source | Masa confirmation needed |
|---|---|---|---|---|---|
| `field-before-zero.md:96` | Before Zero timeline from research result to zero/company start, with irreversible decisions embedded | process diagram | svg/html or external | Current chapter + public strategy section 0 | Visual tone: clean textbook timeline vs illustrated story scene |
| `field-before-zero.md:138` | Seven-uncertainty map around a research seed | concept diagram | svg/html | Current chapter, Part I field frame | Whether this becomes the recurring Part I reference map |
| `field-before-zero.md:164` | Timing window: too early / right window / too late | process diagram | script or svg/html | Current chapter | Whether to keep examples generic or use richer anonymous consequences |
| `field-clocks.md:63` | Stakeholder clock rings with different cycles | concept diagram | external or svg/html | Current chapter | Whether metaphorical clock illustration is desired |
| `field-clocks.md:77` | Twelve-month stakeholder band timeline | process diagram | script or svg/html | Current chapter | Whether to use April-March Japan fiscal year as default |
| `field-clocks.md:113` | Supporters optimize outward while the integration center is empty | architecture / concept diagram | external or svg/html | Current chapter | Whether to make this a strong editorial centerpiece |
| `field-gates.md:87` | Correct IP/open-disclosure sequence and broken reverse order | process diagram | svg/html | Current chapter, IP/disclosure gate logic | Final labels for patent/publication/deep disclosure |
| `field-gates.md:156` | Incorporate now / later / never branch plus early-registration cascade | process diagram | svg/html | Current chapter | Whether "never company" should appear as neutral option |
| `field-gates.md:227` | CEO title decomposed into four functions with tags | concept diagram | svg/html | Current chapter, founder-function doctrine | Whether to use title "CEO" or softer public wording |
| `field-gates.md:270` | GO / WAIT / NO_GO / HOLD vocabulary and WAIT parts | process diagram | svg/html | Current chapter | Whether GO/WAIT etc. remain English labels in public page |
| `field-who-carries.md:102` | Founder-function allocation matrix with example row | process / tool diagram | svg/html | Current chapter, field-toolkit role memo | Whether sample case should be embedded or blank template only |
| `field-who-carries.md:146` | Ninety-day role memo template | process / tool diagram | svg/html | Current chapter + `field-toolkit.md` | Whether to align with toolkit visual system |
| `field-who-carries.md:169` | Failure-log granularity contrast: vague note vs causal branches | process diagram | svg/html | Current chapter | Whether to make it reusable as a worksheet |
| `why-valuation-fails.md:115` | P x R x S value concept, three factor product | concept diagram | external or svg/html | PRS overview Ch2-Ch4 | Whether to merge with `model-overview.md:73` to avoid duplicate three-factor figures |
| `model-overview.md:73` | Three-factor concept: mountain height, current position, fuel/survival | concept diagram | external or svg/html | PRS overview Ch3-Ch4 | Whether to use mountain metaphor or simpler blocks |
| `model-overview.md:136` | Two-layer architecture: judgment layer and dynamic layer | architecture | svg/html; source HTML already has SVG | PRS overview HTML Figure 1 | Whether to adapt existing HTML SVG directly or redraw in house style |
| `model-overview.md:154` | Genealogy MXF -> PRS -> PRS x strategic slack | genealogy | svg/html; source HTML already has SVG | PRS overview HTML Figure 2, theory history | Whether public labels should use MXF or "first generation readiness" only |
| `p-potential.md:102` | TAM/SAM/SOM concentric circles plus evidence-quality staircase | concept diagram | svg/html | Current chapter | Whether market-size vocabulary stays in English |
| `p-potential.md:128` | P(t) stair-step graph with adjacent-use discoveries | data/concept chart | script | Current chapter; no live data needed if illustrative | Whether to keep it conceptual or require source-backed examples |
| `r-readiness.md:47` | "It is ready" splits into TRL/BRL/GRL/SRL/HRL five cards | concept diagram | external or svg/html | Current chapter, SIP/readiness source | Whether SIP/NASA source notes should be visible in caption |
| `r-readiness.md:102` | Application x organization TRL matrix with 0-9 heatmap | data/concept chart | script or svg/html | Current chapter, theory internal-vs-world TRL | Whether sample numbers are acceptable as illustrative |
| `r-readiness.md:217` | R/y split of one patent: achievement stock vs remaining protection gauge | concept diagram | svg/html | PRS overview Ch6 + current chapter | Whether to reuse this distinction in retrofit chapter too |
| `s-survival.md:64` | Survival inequality B - R_net <= F as bars/container | concept diagram | svg/html | PRS overview Ch7, theory notes | Final public labels for B/R_net/F |
| `s-survival.md:98` | Three substitutable survival pillars plus failure case | concept diagram | external or svg/html | PRS overview Ch7 | Whether to show four panels or one compressed diagram |
| `s-survival.md:155` | CES contour plot for F_char x F_cap | data chart | script | Current chapter, theory CES rho=-2 | Confirm parameters and whether comparison curve should be included |
| `score-and-bottleneck.md:83` | Weighted sum vs min vs Cobb-Douglas comparison curve | data chart | script | Current chapter equation | Confirm fixed values for other 8 axes |
| `score-and-bottleneck.md:133` | Log scale from 1 to 100,000 with example markers | data chart | script | Current chapter example values | Confirm whether example project values stay in public figure |
| `score-and-bottleneck.md:216` | Bottleneck bar chart alpha_i/(X_i+1) with weighted components | data chart | script | Current chapter example | Confirm alpha/example values before generation |
| `model-critiques.md:65` | Discount-rate jobs split into S / time / market common factor | concept diagram | svg/html | PRS overview Ch11 | Whether to show 30-70% range in figure |
| `model-critiques.md:169` | Inverted-U slack/performance curve | data/concept chart | script or svg/html | Organizational slack theory + current chapter | Whether to present as theory curve or warning schematic |
| `retrofit-verification.md:139` | Retrofit and prospective prediction two-column validation flow | process diagram | svg/html | PRS overview Ch14-Ch15 | Whether validation ledger wording is public-safe |
| `nursery-ers.md:156` | Nursery layer vs project layer, additive ERS vs multiplicative score | architecture | svg/html | Current chapter + existing F4 ERS radar | Whether to include formulas in the figure |
| `field-toolkit.md:231` | Four-paper decision set and missing-paper bias modes | process / tool diagram | svg/html or external | Toolkit chapter + prior chapters | Whether this should become the visual front door of the toolkit |

Already generated / embedded:
- `f4_ers_radar.png` is embedded in `nursery-ers.md`.
- `f6_slack_plane.png`, `f7_slack_sawtooth.png`, and `f8_slack_trajectories.png` are embedded in `strategic-slack.md` / `retrofit-verification.md`.
- `f9_hype_vs_readiness.png` is embedded in `why-valuation-fails.md`.

## Figure Method Decision Needed

Decision remains open by design. Recommended decision package for Masa:

| Option | Best for | Tradeoff |
|---|---|---|
| `script` / matplotlib | deterministic data charts, curves, heatmaps, bars, timelines with fixed values | Fast and reproducible, but can look dry for metaphor-heavy diagrams |
| `svg/html` | architecture, process, genealogy, tool templates | Public-safe and editable in repo, but needs design discipline |
| `external` image generation | concept metaphors such as clocks, empty center, mountain/fuel | Stronger editorial feel, but style consistency and text accuracy need review |

My recommendation for the next worker is mixed mode, pending Masa approval:
- Use `script` for CES contours, Cobb-Douglas comparison, log scale, bottleneck bars, P(t), and possibly stakeholder timelines.
- Use `svg/html` for two-layer architecture, genealogy, GO/WAIT/HOLD, D-7-like process flows, tool templates, R/y split, and appendix-ready diagrams.
- Use `external` only for a small set of metaphor-heavy opening concept figures if Masa wants the book to feel more illustrated.

No generation should start until style is chosen.

## Cold Read Risks

- `P x R x S` appears in both `why-valuation-fails.md` and `model-overview.md`; the cold read should decide whether these are complementary or repetitive.
- Part I intentionally avoids formulas, but it still previews later logic. Need to check that "model naming" does not leak too early.
- `strategic-slack.md` is the exemplar and is denser than some newer chapters; a cold reader should test whether newer chapters feel thinner beside it.
- Toolkit chapter uses many templates; it may read as a manual rather than a final book chapter unless the four-paper figure and chapter bridge are tightened.
- Terminology to harmonize: `ゼロ`, `会社化`, `設立`, `事業化ライン`, `BEP`, `生存`, `主導権喪失`, `余力`, `到達度`, `readiness`.
- Public safety scan should focus on body copy, not internal changelog/ledger. Existing current chapters still have source comments at the top; cold read should decide whether those comments are hidden from rendered output or need cleanup.

## Appendix / Source Risks

- References are not rebuilt for the new structure. Needed categories:
  - startup/venture evaluation and DCF/valuation context
  - readiness: TRL, BRL, GRL, SRL, HRL, SIP/NASA/Horizon-related sources
  - founder/team evidence: Bernstein, Korteweg & Laws 2017; founder experience / funding success
  - leadership traits: authentic leadership, grit, resilience
  - CES / Cobb-Douglas / production-function references
  - strategic slack, organizational slack, hold-up, Arrow information paradox, stage-gate, Teece
  - royalty / license-rate sources and 25% rule caveat
- Source TODOs found:
  - `s-survival.md:5` academic source consolidation for leadership / grit / resilience / team quality / CES.
  - `s-survival.md:94` founder-team quality and experience/funding evidence.
  - `score-and-bottleneck.md:6` source confirmation note.
  - `score-and-bottleneck.md:115` Bernstein, Korteweg & Laws 2017 and SIP HRL position.
  - `strategic-slack.md:259` royalty-rate sources and 25% rule caveat.
- Appendix still only contains changelog. It needs a rebuilt references chapter, notation chapter, and glossary or back-matter section plan.

## Textbook Insights Gap

Confirmed current gap:
- `pwa/spec/3-13-l2-textbook-insights-current-spec.md` says the new 2026-06-13 textbook moved old D-7 targets into `pwa/bzm/legacy/`, and `apply_approved_textbook_insights.mjs` falls back to legacy when a slug is not found in current `pwa/bzm/`.
- `pwa/scripts/textbook_insight_routing.mjs` still routes by old targets such as `8-2-field-decisions-and-branches`, `8-3-failures-pivots-and-revisions`, `8-4-relationship-playbook`, `8-5-before-zero-checkpoints`, and `6-1-retrofit-verification`.
- This is safe for now because it prevents missing-file writes, but it means approved insights do not naturally land in the new chapter-head story textbook.

Suggested redesign directions:
- Map `decision_branch` to `field-gates` or `field-toolkit` depending on whether it is a narrative case or reusable decision artifact.
- Map `failure_learning` to `field-who-carries`, `retrofit-verification`, or `field-toolkit` depending on whether it is role allocation, model validation, or template material.
- Map `relationship_playbook` to `field-clocks`, `field-who-carries`, or `field-toolkit`.
- Map `reusable_question` / `field_transition` to `field-toolkit`, with source chapter cross-reference metadata rather than appending all content into the toolkit.
- Map `theory_case` to `retrofit-verification` with BZM review gate intact.
- Preserve internal-only / public-rewrite / BZM-review gating; do not append raw L2 material straight into public chapters.

## Recommended Next Workers

1. `BZM figure method decision brief`: prepare 3 sample style directions using existing TODOs only; ask Masa to choose style family before generating the full set.
2. `BZM figure batch A`: after approval, generate or hand-author the high-priority Part II conceptual figures: three-factor, two-layer architecture, genealogy, survival inequality, CES, Cobb-Douglas comparison, bottleneck bars.
3. `BZM cold-reader pass`: read preface to appendix for repetition, terminology drift, chapter bridges, and public-safety body-copy issues.
4. `BZM references appendix rebuild`: confirm royalty, founder/team, readiness, CES/Cobb-Douglas, and strategic slack sources; propose appendix structure.
5. `D-7 new textbook routing redesign`: update routing table and local applier target strategy, but keep approved insight application dry-run until reviewed.

## Commander Ledger Update

Ledger update required:
- Mark this audit worker as complete after commit/push.
- Keep the textbook project `Active`.
- Add `Approval needed`: Masa figure-method decision before any figure generation.
- Add `Watch`: D-7 routing still legacy fallback until redesign worker.
- Deploy note: no deploy needed; internal run note and ledger only.

## Verification

Planned verification before close:
- `git status -sb`
- `git diff --check`
- conflict marker scan on touched files
- required heading scan on this run note
- circled-number scan on this run note and `pwa/bzm/textbook/COMMANDER_TASKS.md`
- targeted stage of only this run note and commander ledger
- commit: `docs(textbook): audit bzm restart figure backlog`
- push `origin main`
