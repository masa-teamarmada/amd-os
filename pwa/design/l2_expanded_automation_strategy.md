# L2 expanded taxonomy and subscription automation strategy

Status: draft for commander review
Date: 2026-06-02
Scope: L2 taxonomy expansion from 10 to 13 candidates, and extraction routing under subscription token / routine count constraints.

This memo does not change DB schema, routine registrations, cron schedules, or production deploy state. It is a design proposal for deciding whether to promote Atlas, Macrotrend, and member weekly activities into the L2 taxonomy.

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
| Daily internal L2 synthesis | L2 2, 4, 5, plus daily catch-up for L2 3 when needed | daily 08:00 JST | Same internal evidence base; avoids 3-4 separate routine runs. |
| Daily external evidence review | L2 11a Atlas signals + L2 12a macro observations | daily 08:40 JST | Both are external evidence; can share source freshness and duplicate checks. |
| Weekly activity synthesis | L2 13 member weekly activities | weekly Mon 06:30 JST or Sun 20:30 JST | Member activity source scan is private and token-heavy; daily scanning is wasteful. |
| Weekly macro / Atlas synthesis | L2 11b reports + L2 12c interpretation | weekly Fri 17:00 JST | Reports are derived; weekly is enough unless commander asks for ad hoc. |
| Weekly textbook insights | L2 10 | weekly or manual | Best run after L2 1-13 evidence exists; approved candidates still require local applier. |

### Push to deterministic / non-LLM paths

| Job | Route |
|---|---|
| Macro aggregate indicators | PWA non-LLM cron is acceptable: `observation_log` + `atlas_signals` -> `macro_index_log`. |
| Outbox apply | Local LaunchAgent / helper, no LLM. |
| Monthly reward cache and routine progress base | PWA / local deterministic jobs. |
| Calendar upcoming card sync metadata apply | PWA route can remain non-LLM if routine supplies metadata. |
| Atlas duplicate/recent/health checks | CLI/helper deterministic diagnostics before any LLM synthesis. |

## Bundle decisions

### L2 2-5

Recommendation: keep current MMO distribution until the commander approves a migration, but if using Claude routines, bundle L2 2, 4, and 5 into one daily internal synthesis. L2 3 can either remain MMO for higher-frequency progress checks or join as a daily catch-up phase.

Reasoning:

- L2 2, 4, and 5 share `monthly_reports`, `project_meeting_summaries`, feedback state, and candidate notification patterns.
- L2 3 has stronger coupling to confirmed progress, reward/monthly views, and deterministic routine progress. It should not be forced into a daily-only Claude writer unless the hourly need is explicitly retired.
- L2 6 must not join this bundle because meeting flow is event-window based and high-frequency.

### L2 7-9

Recommendation: keep L2 7 and 8 in the `amd-os-ms` outbox family, and keep L2 9 in the strategy-signals outbox family unless the outbox/applier contract is deliberately unified.

Reasoning:

- L2 7 and 8 are evidence/governance candidates and can share the same 6-hour review window.
- L2 9 is a management signal surface with its own commander review behavior and timing.
- The current risk is not too many routines; it is unclear health if outboxes exist outside the canonical watched paths. Unifying writers without unifying outbox drain would increase backlog risk.

### Atlas / Macrotrend / Weekly activities

Recommendation: do not bundle all three into a daily collector.

Use two lanes:

1. Daily external evidence collector: L2 11 Atlas signal collection + L2 12 macro observation review.
2. Weekly member activity collector: L2 13 member weekly activities.

Reasoning:

- Atlas/Macrotrend are external public-source evidence and can share retry / duplicate / source-url discipline.
- Member weekly activities are private internal evidence with different privacy, token, and cadence needs.
- Running member activity fusion daily burns tokens and creates noisy repeated evidence. Weekly is a better semantic unit.

## Recommended run window

This is the proposed steady-state schedule if Claude subscription routines are used without exceeding routine count limits. Times are JST.

| Time | Runner | Job | Notes |
|---|---|---|---|
| 03:20 daily | Codex automation | L2 9 strategy signals | Keep existing outbox route. |
| 04:00 monthly / deterministic | PWA non-LLM | L2 12 macro aggregate indicators | Only deterministic aggregate. |
| 05:30 daily | Codex automation | L2 1 monthly reports | Keep existing outbox route. |
| 08:00 daily | Claude or MMO | L2 2/4/5 internal synthesis, optional L2 3 daily catch-up | One routine if migrated; otherwise current MMO jobs stay. |
| 08:40 daily | Codex or Claude | L2 11/12 external evidence collector | Daily, outbox-first. |
| 09:00-21:00 hourly | MMO Codex Desktop | L2 6 meeting flow | Keep high-frequency MMO route with early exit. |
| 20:30 Sun or 06:30 Mon weekly | Claude routine | L2 13 member weekly activities | One weekly run; outbox-first. |
| 17:00 Fri weekly | Claude routine | L2 11 report + L2 12 interpretation synthesis | Derived reports, not atomic evidence. |
| weekly/manual | Codex/Claude + local applier | L2 10 textbook insights | Candidate only; approved rows require local BZM applier. |

Daily Claude routine count in this design is 0-2 depending on migration choice:

- Current conservative mode: 0 new daily Claude routines; keep Codex/MMO primary writers.
- Subscription synthesis mode: 2 daily Claude routines (`daily-internal-l2-synthesis`, `daily-external-evidence-review`) plus weekly routines. This stays far below a 15-run/day cap.

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
