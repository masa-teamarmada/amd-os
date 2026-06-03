# L2 expanded taxonomy and subscription automation strategy

Status: adopted as docs design on 2026-06-03; implementation remains docs/automation-registration only
Date: 2026-06-02
Scope: L2 taxonomy expansion from 10 to 16, and extraction routing under subscription token / routine count constraints.

This memo does not change DB schema, DDL, migrations, deploy state, or PWA / Vercel background LLM cron state. The taxonomy decision has been reflected into `L2_DATA.md`, `spec/3-0`, `spec/3-1`, and `manual/8-3`: Atlas Signals = L2 11, Macrotrend Evidence / Index = L2 12, Member Weekly Activities = L2 13, Finance Ops Evidence = L2 14, VC News / Funding Signals = L2 15, and Management Monthly Signal Evaluation = L2 16.

Activation note:

- MMO `amd-os-l2-consolidated-evidence` is the daily route for L2 2 / 4 / 5 / 7 / 9 / 10 / 11 / 12.
- L2 8 is excluded from the daily route and belongs to the month-end checklist audit after L2 1.
- L2 13 is not daily. It is a separate weekly subscription automation candidate.
- L2 14 is finance non-LLM cron / admin review first.
- L2 15 is weekly VC evidence automation. PWA `vc-discover` remains guarded/manual.
- L2 16 is a month-end 17:00 JST management evaluation candidate for `/management-score`. The revised UI direction is canonical: status label/icon first, natural-language headline, summary, and judgment sections rather than number recitation. The remaining design work is to align the L2 storage schema, source refs, history policy, and month-end update responsibility.
- PWA / Vercel background LLM cron remains disabled.

## Plain-language route glossary

| Term | Meaning |
|---|---|
| Codex / MMO automation | A scheduled Codex Desktop job. It reads sources, asks the model when needed, and prepares structured output. MMO means the Windows MMO machine runs it. |
| outbox | A local folder of JSON drafts. The AI job writes "please insert/update these rows" as files instead of touching the DB directly. |
| applier | A non-LLM helper that reads outbox JSON and applies it to Supabase / PWA APIs. It is the DB-writing worker, not another reasoning routine. |
| LaunchAgent applier | The Mac auto-run wrapper for the applier. In human terms: "a local non-AI sync job that wakes up periodically and applies approved JSON drafts." |
| PWA non-LLM cron | A Vercel/PWA scheduled route that only does deterministic aggregation or cache refresh. No Anthropic / Gemini / OpenAI call. |

## Terminology lock

Use the following wording in this memo and in the later `L2_DATA.md`, `spec/3-1`, and `manual/8-3` patches:

- L2 3 MS progress is **MMO machine Codex Desktop automation** `amd-os-l3-ms-progress-extract`. It is not a Claude routine / subscription routine.
- L2 6 meeting flow is **MMO machine Codex Desktop automation** `amd-os-l6-meeting-flow`. It is not a Claude routine / subscription routine.
- The daily consolidated routine target is L2 2 / 4 / 5 / 7 / 9 / 10 / 11 / 12.
- L2 1 is month-end only, sourced from Supabase internal OS/L2 evidence by default.
- L2 8 is not a daily evidence collector. It is a month-end XRL checklist audit after L2 1 monthly reports.
- L2 13 is a separate weekly candidate.
- L2 14 is Finance Ops Evidence.
- L2 15 is VC News / Funding Signals.
- L2 16 is Management Monthly Signal Evaluation.

## Premises

- Existing current truth defines L2 as structured data extracted from the 5 internal raw sources: Gmail, Drive, Calendar, Slack, and Notion.
- Before the 2026-06-03 docs patch, `pwa/design/L2_DATA.md`, `pwa/spec/3-1-l2-data-extraction-current-spec.md`, and `pwa/manual/8-3-l2-extraction-routines-spec.md` listed L2 1-10.
- Before this patch, `pwa/design/L2_DATA.md` classified Atlas, VC news, and macro index as report-related external-source data, not L2.
- PWA / Vercel background LLM cron must stay disabled. Routes with Anthropic / Gemini / OpenAI imports may remain for manual or guarded use, but must not become active Vercel cron writers.
- DB write to production, DDL/migration creation or apply, route implementation, UI implementation, active cron registration, and deploy are out of scope for this memo.

## Proposed taxonomy

The cleanest expansion is to keep L2 1-10 as the internal operating-memory layer, then add L2 11-16 as evidence-grade observation and judgment layers. This preserves the old 5-source rule while making the new L2 boundary explicit:

| L2 | Proposed name | Provenance | Primary tables | Why this belongs in L2 |
|---|---|---|---|---|
| 11 | Atlas Signals | external | `atlas_signals`, derived `atlas_stories`, `atlas_reports` | Atlas signals influence strategy, management score evidence, venture map, and macro interpretation. They are no longer just report output once accepted into `atlas_signals`. |
| 12 | Macrotrend Evidence / Index | external + deterministic aggregate | `observation_log`, `macro_index_log`, derived `macro_lane_weights`, `triple_helix_state_log` | Macrotrend is numeric / lane-level evidence used by ASPI, Venture Map, and score interpretation. It is distinct from Atlas narrative signals. |
| 13 | Member Weekly Activities | internal hybrid | `member_activities(source='member_weekly')` | Weekly activities are primary member contribution evidence for mypage, reward allocation, L2 5 member knowledge, and MS contribution review. |
| 14 | Finance Ops Evidence | finance operations | `company_finance_recurring_items`, `company_finance_receipt_events`, derived `company_actual_monthly`, `company_budget_monthly` | Finance operations evidence drives monthly PL, cash visibility, and Management Score finance axis. |
| 15 | VC News / Funding Signals | external | `vc_news`, `vcs`, `vc_funds`, `vc_investments`, `project_vc_relations` | VC news and funding signals influence fundraising strategy, VC relationship management, and macro funding context. |
| 16 | Management Monthly Signal Evaluation | management judgment | `company_management_signal_reviews` | The month-end management-score narrative is structured L2 evidence. It translates monthly budget/score evidence into a readable business judgment with status label/icon, headline, summary, sections, source refs, and history. |

## L2 1: Monthly reports

Previous documented route before this patch:

- Frequency: daily 05:30 JST in the older docs.
- Source: primary source is Supabase internal L2 / OS snapshot. The current spec says it looks at `project_meeting_summaries`, `project_strategy_signals`, `project_xrl_evidence`, `project_registry_diffs`, `protocols`, `project_knowledge`, `member_knowledge`, `milestone_monthly_progress`, `progress_estimate_state`, and existing `monthly_reports`.
- Fallback: when L2 coverage is thin, stale, missing source refs, or no-data-like, the existing spec allows a 5 internal raw-source gap check across Gmail / Drive / Calendar / Slack / Notion.
- Apply path: AI job writes `monthlyReports` JSON to an outbox, then the local non-LLM applier writes it into Supabase.

Proposed route:

- Frequency: month-end only. Run on the last day of each month, after normal daily L2 evidence has accumulated.
- Source: Supabase internal data only as the normal path. L2 1 should summarize already-ingested OS evidence, not re-scan raw Gmail / Drive / Calendar / Slack / Notion every day.
- Fallback: raw-source gap check should be manual or explicitly requested, not part of the normal monthly report run.
- Runner: keep it separate from the daily consolidated routine. L2 1 is a monthly synthesis job, not a daily evidence collector.

## L2 8: XRL checklist audit

Recommendation: stop treating L2 8 as a daily XRL evidence collector.

XRL is a maturity/readiness assessment that normally changes over months or years, not an operational signal that needs daily evidence accumulation. Daily `project_xrl_evidence` candidate generation adds notification noise and consumes review capacity without materially improving the score.

Proposed route:

- Cadence: month-end only, immediately after L2 1 monthly reports are generated.
- Input: the completed monthly report plus the same Supabase internal L2 / OS cross-section used by L2 1. This includes `project_meeting_summaries`, `project_strategy_signals`, `project_founding_members`, `project_knowledge`, `member_knowledge`, MS progress, and any existing confirmed `project_xrl_evidence`.
- Checklist definition: `pwa/src/lib/xrl-level-definitions.ts` remains the canonical checklist source. The audit checks TRL / BRL / GRL / SRL / HRL level items against monthly evidence.
- Output: a reviewable proposal for `amd_score_inputs.xrl_checklist` and `amd_score_inputs.xrl_notes`, not direct score mutation.
- Apply: after commander / masa confirmation, update `amd_score_inputs.xrl_checklist`; the score detail UI derives `trl` / `brl` / `grl` / `srl` / `hrl` from the checklist when saved.

Role of `project_xrl_evidence`:

- Keep the table as a historical / exceptional evidence log.
- Do not make it the normal daily output of L2 8.
- Use it only when a strong event-level XRL observation needs to be preserved before the month-end audit, or when past confirmed evidence should be included in the audit.

This means L2 8 is still part of the L2 taxonomy, but its normal writer is a monthly checklist audit attached to the L2 1 close process.

### Boundary update

Current L2 definition:

```text
5 internal raw sources -> desired structured OS data
```

Proposed L2 definition:

```text
trusted raw sources -> reviewable structured OS evidence

internal L2: 5 internal raw sources
external L2: public / external observation sources with source URL and review state
hybrid L2: internal activity evidence derived from member-specific source bundles
```

This avoids pretending Atlas and Macrotrend come from the 5 internal raw sources. Instead, L2 rows carry a provenance class.

## L2 11: Atlas Signals

Recommendation: make collection and reporting one L2 family, but not one writer.

| Layer | Role | Tables | Writer strategy |
|---|---|---|---|
| L2 11a signal collection | Atomic external signal evidence | `atlas_signals` | Codex / subscription automation via `atlas_signal_review_tool.mjs` and outbox/applier |
| L2 11b story/report synthesis | Derived narrative grouping and daily/weekly/monthly reports | `atlas_stories`, `atlas_reports` | Claude subscription routine or manual synthesis after collection is healthy |

Rationale:

- `atlas_signals` is the canonical evidence layer. It has `source_url`, `source_type`, `domain`, `importance`, `status`, and `metadata`.
- `atlas_stories` and `atlas_reports` are useful product/report surfaces, but they should not define whether the evidence exists.
- Daily/weekly/monthly report generation can be skipped without losing L2 11 evidence. Signal collection should be prioritized over report prose.

Current route implication:

- Keep PWA `cron/atlas-collect`, `cron/atlas-daily`, `cron/atlas-weekly`, `cron/atlas-monthly`, and `cron/atlas-divergence` disabled if they call LLMs.
- Keep external source fetch / review on Codex Desktop or Claude subscription automation.
- Keep non-LLM ingest / applier deterministic.

## L2 12: Macrotrend Evidence / Index

Recommendation: separate Macrotrend from Atlas even though it consumes `atlas_signals`.

| Layer | Role | Tables | Writer strategy |
|---|---|---|---|
| L2 12a macro observations | Source-level numeric evidence | `observation_log` | deterministic fetchers or subscription automation, source URL / source id required |
| L2 12b macro index | Lane x month aggregate | `macro_index_log` | PWA non-LLM cron is allowed when it only aggregates `observation_log` + `atlas_signals` |
| L2 12c macro interpretation | Weight / state / narrative interpretation | `macro_lane_weights`, `triple_helix_state_log` | Claude subscription routine or manual run; do not active-schedule PWA LLM routes |

Rationale:

- `atlas_signals` captures narrative/policy signals.
- `observation_log` captures lane/date/key/value/source observations.
- `macro_index_log` is deterministic aggregation over `observation_log` and `atlas_signals`.
- Macrotrend should therefore be an evidence/index L2, not only an Atlas report subtype.

Current route implication:

- `cron/macro-aggregate-indicators` is safe as a PWA non-LLM cron because it aggregates existing rows.
- `cron/relearn-lane-weights` and `cron/macro-backfill-historical` should stay disabled as active PWA cron when they call LLMs.

## L2 13: Member Weekly Activities

Recommendation: promote `member_activities(source='member_weekly')` into L2 13, while keeping `member_activities(source='inferred')` as a lower-confidence legacy / derived source.

| Source | Meaning | Use |
|---|---|---|
| `member_weekly` | Weekly member activity evidence from member-specific Gmail / Calendar / source bundles | Primary L2 13 evidence |
| `inferred` | Older inferred activity from monthly reports, meeting summaries, or source cache | Secondary fallback; do not use as equally trusted weekly evidence |
| other explicit sources | Manual/admin/import-specific rows | Keep provenance-specific behavior |

L2 13 relationships:

- Feeds L2 5 member knowledge as direct member evidence.
- Feeds MS / reward allocation through `member_activities(project_id, ym, milestone_id)` and contribution heuristics.
- Feeds mypage and admin weekly views.
- Should not overwrite reward-confirmed or PM-confirmed values automatically.

Current route implication:

- `/api/cron/member-weekly-activities` imports Anthropic and must not return to active PWA / Vercel cron.
- The route can remain as a guarded manual route, but the scheduled writer should move to subscription automation and write through an outbox/applier contract.
- L2 13 should store short evidence previews, source refs, source hashes, and structured metadata. It should not store raw Gmail or private calendar body text.

## L2 14: Finance Ops Evidence

Recommendation: promote the former Finance L2 extension candidate into L2 14.

Finance evidence is not just monthly reporting prose. Recurring subscriptions, automatic withdrawals, receipt events, freee/payment status, and admin confirmations are operational evidence that feed monthly PL, cash visibility, and Management Score finance.

Writer strategy:

- Deterministic finance syncs such as freee/payment cron can remain PWA non-LLM cron.
- Gmail receipt interpretation and ambiguous vendor classification should use source refs, hashes, short subjects, and review UI. Do not store raw receipt body text.
- If LLM classification is needed, use subscription automation or guarded manual review rather than active PWA / Vercel LLM cron.

## L2 15: VC News / Funding Signals

Recommendation: revive VC news as a new L2, but do not revive the old PWA LLM/web_search cron.

VC news influences fundraising strategy, fund targeting, partner relationship timing, and the macro funding environment. It should therefore be a reviewable evidence layer, not only a report-related side feed.

Writer strategy:

- Primary scheduled writer: `amd-os-l2-vc-news-funding-signals` on Codex / subscription automation.
- PWA `/api/cron/vc-discover` remains guarded/manual because it uses LLM/web_search paths.
- Output should go to VC inbox / review outbox first, then confirmed items update `vc_news`, `vcs`, `vc_funds`, `vc_investments`, or `project_vc_relations`.
- Do not auto-patch VC/fund records from public news without review.

## L2 16: Management Monthly Signal Evaluation

Recommendation: add the month-end `/management-score` evaluation as L2 16, but keep it design-first until the table/payload contract is final.

This L2 is not a UI polish note. It is the source-of-truth row that tells masa whether the company state looks good, concerning, or intervention-worthy at month end.

Source-of-truth:

- Source table: `company_management_signal_reviews`
- Inputs: `amd_management_score_snapshots`, `amd_management_score_evidence`, `company_budget_actual_monthly`, `company_budget_variance_notes`, L2 9 strategy signals, L2 14 finance ops evidence, L2 15 VC/funding signals, and relevant billing / pipeline evidence.
- Output: latest current evaluation plus historical versions/months.

Payload shape:

- `ym`, `version`, `status_label`, `status_tone`, `status_icon`
- `headline`: one-line management judgment
- `summary`: additional judgment comment
- `sections`: title / body / items / tone blocks such as near-term temperature, cost view, sales decision, variance reading, and immediate watch items
- `source_refs_json`: source tables / row ids / hashes, not raw private source text
- `payload_json`: compact calculation context, evaluation logic version, and omitted-number policy
- `generated_at`, `reviewed_at`, `codex_thread_id`, `automation_id`
- `is_current`, `superseded_at` or equivalent archived-history fields

Writing rule:

- Do not repeat the budget table numbers. The table above already shows them.
- Translate the numbers and signals into a human business judgment, for example: "まあ悪くない。ただ、新規案件の厚みがもう少しあると安心できる。"
- Use status labels: `良好`, `概ね良い`, `注意`, `要介入`, `危険`.
- UI should expand only the latest evaluation and collapse older rows as logs.

Route:

- Cadence: last day of each month, 17:00 JST.
- Runner: Codex / subscription automation candidate `amd-os-l16-management-monthly-signal-evaluation`.
- Apply: store a new version in `company_management_signal_reviews` and collapse previous evaluations into UI history. PWA / Vercel background LLM cron stays disabled.

## Extraction routing strategy

### Keep in Codex Desktop / MMO

These jobs are high-frequency, operational, or tightly coupled to local helper/outbox state:

| L2 | Keep here | Reason |
|---|---|---|
| 3 MS progress | MMO machine Codex Desktop automation `amd-os-l3-ms-progress-extract`, with deterministic base where possible | Needs frequent early exits, confirmed-value guards, and reward/monthly interactions. |
| 6 Meeting flow | MMO machine Codex Desktop automation `amd-os-l6-meeting-flow` | High-frequency event window, Calendar/Drive/Gmail/Slack coupling, and workflow side effects. |
| 7 Registry diffs | Codex automation + outbox/applier | Candidate generation plus allowlisted non-LLM apply path is already shaped. |
| 9 Strategy signals | Codex automation + strategy-signals outbox | Management review cadence is already separated from PWA cron. |
| 11a Atlas signal collection | Codex automation or Claude subscription, but outbox-first | External signal collection needs retryable network handling and duplicate checks. |

### Candidate for Claude subscription routines

These are heavy synthesis / review jobs where subscription tokens are useful and daily routine count must stay low:

| Bundle | Contents | Cadence | Why bundle |
|---|---|---|---|
| Daily consolidated L2 evidence routine | L2 2, 4, 5, 7, 9, 10, 11, 12 | daily 08:00 JST | These can share one evidence review pass, one state report, and one routine slot. |
| Weekly activity synthesis | L2 13 member weekly activities | weekly Mon 06:30 JST or Sun 20:30 JST | Member activity source scan is private and token-heavy; daily scanning is wasteful. |
| Month-end monthly reports | L2 1 | monthly, last day | Monthly reports should summarize Supabase-internal OS evidence after the month has accumulated. |
| Month-end XRL checklist audit | L2 8 | monthly, after L2 1 | XRL maturity should be reviewed from the monthly cross-section and checklist, not daily evidence fragments. |
| Month-end management evaluation | L2 16 | monthly, last day 17:00 JST | Reads budget actuals and Management Score evidence after raw/calc are available, then writes a compact judgment proposal. |

### Push to deterministic / non-LLM paths

| Job | Route |
|---|---|
| Macro aggregate indicators | PWA non-LLM cron is acceptable: `observation_log` + `atlas_signals` -> `macro_index_log`. |
| Outbox apply | Local LaunchAgent / helper, no LLM. |
| Monthly reward cache and routine progress base | PWA / local deterministic jobs. |
| Calendar upcoming card sync metadata apply | PWA route can remain non-LLM if routine supplies metadata. |
| Atlas duplicate/recent/health checks | CLI/helper deterministic diagnostics before any LLM synthesis. |

## Bundle decisions

### L2 2, 4, 5, 7, 9, 10, 11, 12

Recommendation: bundle these into one daily consolidated L2 evidence routine once the commander approves the taxonomy patch.

Reasoning:

- L2 2, 4, and 5 share `monthly_reports`, `project_meeting_summaries`, feedback state, and candidate notification patterns.
- L2 7 and 9 are governance / management-signal candidates and can share one state report instead of separate routine runs.
- L2 10 can run in the same routine as candidate generation, while approved application to `pwa/bzm/*.md` still stays local-only.
- L2 11 and 12 can share external source freshness, dedupe, source-url checks, and macro/Atlas evidence interpretation.
- L2 8 must not join the daily bundle. XRL changes are maturity changes, so the normal path is a month-end checklist audit after L2 1 monthly reports.
- L2 3 has stronger coupling to confirmed progress, reward/monthly views, and deterministic progress bases. Keep it as MMO machine Codex Desktop automation `amd-os-l3-ms-progress-extract` unless the hourly need is explicitly retired.
- L2 6 must not join this bundle because meeting flow is event-window based and high-frequency. Keep it as MMO machine Codex Desktop automation `amd-os-l6-meeting-flow`.
- L2 1 must not join this bundle because monthly reports should be month-end Supabase synthesis, not daily evidence extraction.

Plain-language phase order:

1. Read current Supabase state and source freshness markers.
2. Review internal evidence candidates: L2 2 / 4 / 5 / 7 / 9 / 10.
3. Review external evidence candidates: L2 11 / 12.
4. Write candidates to the appropriate tables or outbox contract.
5. Produce one run summary: saved / skipped / needs review / blocked.

### L2 8

Recommendation: run L2 8 as the month-end XRL checklist audit, directly after L2 1.

Reasoning:

- XRL levels are not expected to move daily.
- The checklist source of truth already exists in `pwa/src/lib/xrl-level-definitions.ts`.
- The score detail UI already stores check state in `amd_score_inputs.xrl_checklist`.
- Monthly reports are the natural review surface because they summarize the month's actual evidence.
- This removes one noisy daily candidate stream while preserving a clear way to update XRL when the month has enough evidence.

### L2 13

Recommendation: keep member weekly activities as a separate weekly routine.

Reasoning:

- Member weekly activities are private internal evidence with different privacy and cadence needs.
- Running member activity fusion daily burns tokens and creates noisy repeated evidence.
- Weekly is the natural semantic unit for mypage / reward review / member knowledge.

## Recommended run window

This is the proposed steady-state schedule if Claude subscription routines are used without exceeding routine count limits. Times are JST.

| Time | Runner | Job | Notes |
|---|---|---|---|
| 04:00 monthly / deterministic | PWA non-LLM | L2 12 macro aggregate indicators | Only deterministic aggregate. |
| 08:00 daily | Claude subscription routine | L2 2/4/5/7/9/10/11/12 consolidated evidence routine | One routine, one run summary. L2 8 is excluded. |
| hourly / existing cadence | MMO machine Codex Desktop automation | L2 3 MS progress via `amd-os-l3-ms-progress-extract` | Keep separate from the consolidated routine. |
| 09:00-21:00 hourly | MMO machine Codex Desktop automation | L2 6 meeting flow via `amd-os-l6-meeting-flow` | Keep high-frequency MMO route with early exit. |
| 20:30 Sun or 06:30 Mon weekly | Claude routine | L2 13 member weekly activities | One weekly run; outbox-first. |
| Month-end, last day | Claude or Codex subscription routine | L2 1 monthly reports | Supabase-internal OS evidence only by default. |
| Month-end, after L2 1 | Claude or Codex subscription routine | L2 8 XRL checklist audit | Review monthly evidence against `xrl-level-definitions.ts`; propose checklist / notes updates. |
| Month-end, 17:00 | Claude or Codex subscription routine candidate | L2 16 management monthly signal evaluation | Design-only until accepted. Do not register automation, route, DB write, or UI implementation yet. |

Daily Claude routine count in this design is 1 for the consolidated evidence routine:

- L2 2/4/5/7/9/10/11/12: 1 daily run.
- L2 3: stays MMO machine Codex Desktop automation because progress has confirmed-value and reward/monthly guards.
- L2 6: stays MMO machine Codex Desktop automation because it is event-window based.
- L2 13: 1 weekly run.
- L2 1: 1 monthly month-end run.
- L2 8: 1 monthly month-end audit after L2 1.
- L2 16: 1 monthly month-end 17:00 evaluation run.
- This stays far below a 15-run/day cap.

## Token efficiency rules

- Use deterministic health/recent/dedupe checks before LLM review.
- Use `source_hash` / `(member_id, project_id, source, source_item_id)` / external `source_url` to skip unchanged evidence.
- For L2 11 and L2 12, summarize source pages into 200-400 character evidence rows rather than generating long reports first.
- For L2 13, process one weekly member window and emit compact `member_activities` rows. Do not ask Claude to produce reward calculations directly.
- For L2 16, do not spend tokens restating finance table numbers. Read the facts, then emit one compact management judgment with source refs.
- Do not let report generation drive evidence collection. Evidence rows come first; reports are derived.
- Keep raw private source text outside L2 rows. Store short preview, source ref, hash, and structured metadata only.

## Next implementation candidate

Completed first implementation: `L2 expanded taxonomy docs patch` plus MMO automation prompt alignment.

Completed scope:

- Updated `pwa/design/L2_DATA.md` from L2 data 10 types to L2 1-16.
- Added `/spec` top link and `pwa/spec/3-0-l2-data-list-current-spec.md` as the readable L2 data list.
- Updated `pwa/spec/3-1-l2-data-extraction-current-spec.md` and `pwa/manual/8-3-l2-extraction-routines-spec.md` with provenance classes and writer boundaries.
- Updated L2 16 to use the revised `/management-score` UI as the canonical UX direction and documented the target storage schema: status label/tone/icon, headline, summary, sections, source refs, generated/review timestamps, Codex thread id, and automation id.
- Aligned MMO `amd-os-l2-consolidated-evidence` prompt so daily extraction covers L2 2 / 4 / 5 / 7 / 9 / 10 / 11 / 12 and explicitly skips L2 8.
- Aligned MMO `amd-os-l1-monthly-report-monthend` prompt so L2 8 checklist audit runs after L2 1 monthly report synthesis.

Recommended next implementation: create the L2 13 outbox contract and weekly automation skeleton. Do not revive `/api/cron/member-weekly-activities` as an active PWA / Vercel cron.
