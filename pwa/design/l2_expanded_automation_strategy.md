# L2 expanded taxonomy and subscription automation strategy

Status: draft for commander review
Date: 2026-06-02
Scope: L2 taxonomy expansion from 10 to 13 candidates, and extraction routing under subscription token / routine count constraints.

This memo does not change DB schema, routine registrations, cron schedules, or production deploy state. It is a design proposal for deciding whether to promote Atlas, Macrotrend, and member weekly activities into the L2 taxonomy.

## Plain-language route glossary

| Term | Meaning |
|---|---|
| Codex / MMO automation | A scheduled Codex Desktop job. It reads sources, asks the model when needed, and prepares structured output. MMO means the Windows MMO machine runs it. |
| outbox | A local folder of JSON drafts. The AI job writes "please insert/update these rows" as files instead of touching the DB directly. |
| applier | A non-LLM helper that reads outbox JSON and applies it to Supabase / PWA APIs. It is the DB-writing worker, not another reasoning routine. |
| LaunchAgent applier | The Mac auto-run wrapper for the applier. In human terms: "a local non-AI sync job that wakes up periodically and applies approved JSON drafts." |
| PWA non-LLM cron | A Vercel/PWA scheduled route that only does deterministic aggregation or cache refresh. No Anthropic / Gemini / OpenAI call. |

## Premises

- Existing current truth defines L2 as structured data extracted from the 5 internal raw sources: Gmail, Drive, Calendar, Slack, and Notion.
- `pwa/design/L2_DATA.md`, `pwa/spec/3-1-l2-data-extraction-current-spec.md`, and `pwa/manual/8-3-l2-extraction-routines-spec.md` currently list L2 1-10.
- `pwa/design/L2_DATA.md` currently classifies Atlas, VC news, and macro index as report-related external-source data, not L2.
- PWA / Vercel background LLM cron must stay disabled. Routes with Anthropic / Gemini / OpenAI imports may remain for manual or guarded use, but must not become active Vercel cron writers.
- DB write, DDL, migration apply, and deploy are out of scope for this memo.

## Proposed taxonomy

The cleanest expansion is to keep L2 1-10 as the internal operating-memory layer, then add L2 11-13 as evidence-grade observation layers. This preserves the old 5-source rule while making the new L2 boundary explicit:

| L2 | Proposed name | Provenance | Primary tables | Why this belongs in L2 |
|---|---|---|---|---|
| 11 | Atlas Signals | external | `atlas_signals`, derived `atlas_stories`, `atlas_reports` | Atlas signals influence strategy, management score evidence, venture map, and macro interpretation. They are no longer just report output once accepted into `atlas_signals`. |
| 12 | Macrotrend Evidence / Index | external + deterministic aggregate | `observation_log`, `macro_index_log`, derived `macro_lane_weights`, `triple_helix_state_log` | Macrotrend is numeric / lane-level evidence used by ASPI, Venture Map, and score interpretation. It is distinct from Atlas narrative signals. |
| 13 | Member Weekly Activities | internal hybrid | `member_activities(source='member_weekly')` | Weekly activities are primary member contribution evidence for mypage, reward allocation, L2 5 member knowledge, and MS contribution review. |

## L2 1: Monthly reports

Current route:

- Frequency: daily 05:30 JST in the current docs.
- Source: primary source is Supabase internal L2 / OS snapshot. The current spec says it looks at `project_meeting_summaries`, `project_strategy_signals`, `project_xrl_evidence`, `project_registry_diffs`, `protocols`, `project_knowledge`, `member_knowledge`, `milestone_monthly_progress`, `progress_estimate_state`, and existing `monthly_reports`.
- Fallback: when L2 coverage is thin, stale, missing source refs, or no-data-like, the existing spec allows a 5 internal raw-source gap check across Gmail / Drive / Calendar / Slack / Notion.
- Apply path: AI job writes `monthlyReports` JSON to an outbox, then the local non-LLM applier writes it into Supabase.

Proposed route:

- Frequency: month-end only. Run on the last day of each month, after normal daily L2 evidence has accumulated.
- Source: Supabase internal data only as the normal path. L2 1 should summarize already-ingested OS evidence, not re-scan raw Gmail / Drive / Calendar / Slack / Notion every day.
- Fallback: raw-source gap check should be manual or explicitly requested, not part of the normal monthly report run.
- Runner: keep it separate from the daily consolidated routine. L2 1 is a monthly synthesis job, not a daily evidence collector.

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

## Extraction routing strategy

### Keep in Codex Desktop / MMO

These jobs are high-frequency, operational, or tightly coupled to local helper/outbox state:

| L2 | Keep here | Reason |
|---|---|---|
| 3 MS progress | MMO/Codex automation, with deterministic base where possible | Needs frequent early exits, confirmed-value guards, and reward/monthly interactions. |
| 6 Meeting flow | Windows MMO Codex Desktop automation | High-frequency event window, Calendar/Drive/Gmail/Slack coupling, and workflow side effects. |
| 7 Registry diffs | Codex automation + outbox/applier | Candidate generation plus allowlisted non-LLM apply path is already shaped. |
| 8 XRL evidence | Codex automation + outbox/applier | Evidence candidates and schema/status retry need helper discipline. |
| 9 Strategy signals | Codex automation + strategy-signals outbox | Management review cadence is already separated from PWA cron. |
| 11a Atlas signal collection | Codex automation or Claude subscription, but outbox-first | External signal collection needs retryable network handling and duplicate checks. |

### Candidate for Claude subscription routines

These are heavy synthesis / review jobs where subscription tokens are useful and daily routine count must stay low:

| Bundle | Contents | Cadence | Why bundle |
|---|---|---|---|
| Daily consolidated L2 evidence routine | L2 2, 4, 5, 7, 8, 9, 10, 11, 12 | daily 08:00 JST | These can share one evidence review pass, one state report, and one routine slot. |
| Weekly activity synthesis | L2 13 member weekly activities | weekly Mon 06:30 JST or Sun 20:30 JST | Member activity source scan is private and token-heavy; daily scanning is wasteful. |
| Month-end monthly reports | L2 1 | monthly, last day | Monthly reports should summarize Supabase-internal OS evidence after the month has accumulated. |

### Push to deterministic / non-LLM paths

| Job | Route |
|---|---|
| Macro aggregate indicators | PWA non-LLM cron is acceptable: `observation_log` + `atlas_signals` -> `macro_index_log`. |
| Outbox apply | Local LaunchAgent / helper, no LLM. |
| Monthly reward cache and routine progress base | PWA / local deterministic jobs. |
| Calendar upcoming card sync metadata apply | PWA route can remain non-LLM if routine supplies metadata. |
| Atlas duplicate/recent/health checks | CLI/helper deterministic diagnostics before any LLM synthesis. |

## Bundle decisions

### L2 2, 4, 5, 7, 8, 9, 10, 11, 12

Recommendation: bundle these into one daily consolidated L2 evidence routine once the commander approves the taxonomy patch.

Reasoning:

- L2 2, 4, and 5 share `monthly_reports`, `project_meeting_summaries`, feedback state, and candidate notification patterns.
- L2 7, 8, and 9 are governance / evidence / management-signal candidates and can share one state report instead of separate routine runs.
- L2 10 can run in the same routine as candidate generation, while approved application to `pwa/bzm/*.md` still stays local-only.
- L2 11 and 12 can share external source freshness, dedupe, source-url checks, and macro/Atlas evidence interpretation.
- L2 8 XRL evidence can run daily inside this consolidated routine. It does not need a 6-hour cadence unless a specific active review window requires it.
- L2 3 has stronger coupling to confirmed progress, reward/monthly views, and deterministic routine progress. It should not be forced into this consolidated routine unless the hourly need is explicitly retired.
- L2 6 must not join this bundle because meeting flow is event-window based and high-frequency.
- L2 1 must not join this bundle because monthly reports should be month-end Supabase synthesis, not daily evidence extraction.

Plain-language phase order:

1. Read current Supabase state and source freshness markers.
2. Review internal evidence candidates: L2 2 / 4 / 5 / 7 / 8 / 9 / 10.
3. Review external evidence candidates: L2 11 / 12.
4. Write candidates to the appropriate tables or outbox contract.
5. Produce one run summary: saved / skipped / needs review / blocked.

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
| 08:00 daily | Claude subscription routine | L2 2/4/5/7/8/9/10/11/12 consolidated evidence routine | One routine, one run summary. L2 8 runs daily here. |
| 09:00-21:00 hourly | MMO Codex Desktop | L2 6 meeting flow | Keep high-frequency MMO route with early exit. |
| 20:30 Sun or 06:30 Mon weekly | Claude routine | L2 13 member weekly activities | One weekly run; outbox-first. |
| Month-end, last day | Claude or Codex subscription routine | L2 1 monthly reports | Supabase-internal OS evidence only by default. |

Daily Claude routine count in this design is 1 for the consolidated evidence routine:

- L2 2/4/5/7/8/9/10/11/12: 1 daily run.
- L2 6: stays MMO hourly because it is event-window based.
- L2 13: 1 weekly run.
- L2 1: 1 monthly month-end run.
- This stays far below a 15-run/day cap.

## Token efficiency rules

- Use deterministic health/recent/dedupe checks before LLM review.
- Use `source_hash` / `(member_id, project_id, source, source_item_id)` / external `source_url` to skip unchanged evidence.
- For L2 11 and L2 12, summarize source pages into 200-400 character evidence rows rather than generating long reports first.
- For L2 13, process one weekly member window and emit compact `member_activities` rows. Do not ask Claude to produce reward calculations directly.
- Do not let report generation drive evidence collection. Evidence rows come first; reports are derived.
- Keep raw private source text outside L2 rows. Store short preview, source ref, hash, and structured metadata only.

## Next implementation candidate

Recommended first implementation: `L2 expanded taxonomy docs patch`.

Scope:

- Update `pwa/design/L2_DATA.md` from "L2 data 10 types" to a draft-approved "L2 1-13" taxonomy once commander approves this memo.
- Update `pwa/spec/3-1-l2-data-extraction-current-spec.md` and `pwa/manual/8-3-l2-extraction-routines-spec.md` with provenance classes and writer boundaries.
- Update `pwa/src/lib/operations-catalog.ts` labels so current Codex/MMO routes are not displayed as generic "Claude routine" where manual/spec already says otherwise.
- Add skeleton scheduled-task docs for L2 11-13 only after the taxonomy patch is approved.

Do not start with routine registration. The first safe step is docs and catalog alignment, then L2 13 outbox contract, then optional Claude routine bundles.
