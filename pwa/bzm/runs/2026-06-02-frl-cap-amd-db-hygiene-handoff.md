# FRL_cap_amd DB hygiene handoff

Date: 2026-06-02 JST
Owner: BZM worker / frl_cap_amd DB hygiene handoff
Scope: OS/DB worker handoff for stale/conflicting DB facts surfaced during FRL_cap_amd historical整理.

This handoff is documentation only. It does not execute DB writes, DDL, migrations, extractor changes, deploys, FRL value recalculation, 0-9 score tables, R_net scoring, PRS adoption, current 7-axis AMD Score replacement, or historical score recalculation.

## Read sources

Primary BZM / OS sources read:

- `pwa/bzm/runs/2026-06-02-frl-cap-amd-historical-policy.md`
- `pwa/bzm/runs/2026-06-02-frl-cap-amd-timeline-row-source-pack.md`
- `pwa/bzm/runs/2026-06-02-frl-cap-amd-timeline-date-source-lookup.md`
- `pwa/bzm/runs/2026-06-02-frl-cap-amd-notes-rubric-guard.md`
- `/Users/masa/.codex/worktrees/a5be/amd-os/pwa/bzm/runs/2026-06-02-yd-founded-at-current-truth-review.md`
- `pwa/design/db_schema.md`
- `pwa/spec/4-1-frl-ces-current-spec.md`

Source boundary:

- `official/public`: public company pages, public PDFs, public news.
- `internal_knowledge`: `/Users/masa/projects/knowledge/*.md`; internal/source-hygiene use only.
- `private_source`: Gmail / Slack / Drive / gmeet / source_cache ids; do not quote as public proof.
- `live_db_readonly`: DB rows observed by prior read-only workers; DB values are not treated as truth when they conflict with source-backed facts.

## Issue index

| issue_id | project_id | affected_table_column | classification | handoff posture |
|---|---|---|---|---|
| `db_hygiene_p18_yd_founded_at` | `p18` | `project_ventures.founded_at`; derived `project_knowledge.fact_text` | `official_company_founded_at_conflicts_with_db_current_value` | OS/DB correction candidate, pending DB owner confirmation |
| `db_hygiene_p18_yd_xrl_2019_timeline` | `p18` | `project_xrl_log` manual 2019 milestone | `manual_timeline_repeats_unknown_origin` | separate source investigation, not part of founded_at correction |
| `db_hygiene_p11_bwe_founded_at` | `p11` | `project_ventures.founded_at` | `db_stale_date_conflicts_with_public_and_internal_source` | OS/DB correction candidate |
| `db_hygiene_p11_bwe_amd_support_started_at` | `p11` | `project_ventures.amd_support_started_at` | `db_stale_support_start_conflicts_with_projects_and_internal_source` | OS/DB correction candidate, source confidence medium |
| `db_hygiene_p06_ctb_founded_at` | `p06` | `project_ventures.founded_at` | `db_stale_date_conflicts_with_official_public_source` | OS/DB correction candidate, do not touch FRL current correction |
| `db_hygiene_p09_jc_amd_join_basic_fact` | `p09` | `project_knowledge.fact_text` for `AMD参画開始日` | `source_conflict_probable_basic_fact_backfill_issue` | review/quarantine candidate; no replacement exact date yet |

## Issues

### db_hygiene_p18_yd_founded_at

| field | value |
|---|---|
| `issue_id` | `db_hygiene_p18_yd_founded_at` |
| `project_id` | `p18` |
| `affected_table_column` | `project_ventures.founded_at`; derived `project_knowledge.fact_text` where `category='basic_fact'` and `entity_name='法人設立日'` |
| `current_db_value` | `project_ventures.founded_at='2019-01-01'`; `project_knowledge.fact_text='2019-01-01'`, `source='pj_basic_facts_sync'` |
| `source_backed_value_or_status` | official company founded date candidate: `2023-08-04` |
| `source_evidence` | Yellow Duck official company page live checked 2026-06-02 JST says company establishment is `2023年8月4日`. The same review found no primary source supporting `2019-01-01` as法人設立日 / research start / old entity date / placeholder. |
| `classification` | `official_company_founded_at_conflicts_with_db_current_value`; `project_knowledge` row is `derived_basic_fact_not_independent_source` |
| `recommended_os_db_action` | Confirm with DB owner that `project_ventures.founded_at` means official company/legal founding date. If yes, update p18 `project_ventures.founded_at` to `2023-08-04`, then verify the `pj_basic_facts_sync` route or equivalent derived fact update so `project_knowledge` no longer repeats `2019-01-01`. |
| `candidate_sql_or_sync_note` | Candidate only, not executed: `update project_ventures set founded_at = date '2023-08-04', updated_at = now() where project_id = 'p18' and founded_at = date '2019-01-01';` Then rerun/verify the basic facts sync for `project_knowledge(category='basic_fact', entity_name='法人設立日')`. |
| `risk_if_left_stale` | Timeline and source-hygiene workers may accidentally treat 2019 as official company founding, overstate pre-AMD company age, or double-count `project_knowledge` as independent evidence. |
| `do_not_use_as` | Do not use `2019-01-01` as Yellow Duck法人設立日, research start, activity start, prototype start, old registration, PoC start, or score/PRS/R_net basis. Do not treat the derived `project_knowledge` row as a second source. |

### db_hygiene_p18_yd_xrl_2019_timeline

| field | value |
|---|---|
| `issue_id` | `db_hygiene_p18_yd_xrl_2019_timeline` |
| `project_id` | `p18` |
| `affected_table_column` | `project_xrl_log` manual timeline row containing `2019-01-01` milestone label including 設立 / TRL4; exact columns should be re-read before any OS/DB action |
| `current_db_value` | `2019-01-01` manual XRL timeline milestone, `source='manual'`, `source_note=null` per YD review |
| `source_backed_value_or_status` | unknown origin; not supported as official founded_at by current source pack |
| `source_evidence` | YD review says `project_xrl_log` repeats 2019 but has no source note. Official company page separates 2011 research start, 2022 NEDO award, and 2023 Yellow Duck founding. |
| `classification` | `manual_timeline_repeats_unknown_origin`; adjacent hygiene issue, not a direct founded_at correction |
| `recommended_os_db_action` | Keep this out of the p18 founded_at correction unless OS/DB worker runs a separate XRL timeline source investigation. Decide whether the row represents research/TRL history, a stale founding milestone, or should be archived/corrected. |
| `candidate_sql_or_sync_note` | No correction SQL candidate in this handoff. First run read-only inspection of `project_xrl_log` p18 row(s), then create a separate source pack before any write. |
| `risk_if_left_stale` | Even after correcting `project_ventures.founded_at`, XRL screens or future source packs may reintroduce the unsupported 2019 date as a company-founding fact. |
| `do_not_use_as` | Do not use this manual timeline row as independent proof of Yellow Duck official founding date or as a reason to override the official `2023-08-04` candidate. |

### db_hygiene_p11_bwe_founded_at

| field | value |
|---|---|
| `issue_id` | `db_hygiene_p11_bwe_founded_at` |
| `project_id` | `p11` |
| `affected_table_column` | `project_ventures.founded_at` |
| `current_db_value` | `2019-04-01` |
| `source_backed_value_or_status` | public/internal source-backed founding date candidate: `2025-04-28` |
| `source_evidence` | BWE public PDF states `2025-04-28`; internal knowledge agrees. Gビズ/法人番号-derived pages show法人番号指定 `2025-05-01`, not incorporation date. |
| `classification` | `db_stale_date_conflicts_with_public_and_internal_source`; public source confidence high |
| `recommended_os_db_action` | Treat `2019-04-01` as stale for company founding. OS/DB worker should confirm whether `project_ventures.founded_at` is official founding date, then update to `2025-04-28` and verify any derived basic facts / displays. |
| `candidate_sql_or_sync_note` | Candidate only, not executed: `update project_ventures set founded_at = date '2025-04-28', updated_at = now() where project_id = 'p11' and founded_at = date '2019-04-01';` Afterward verify any `project_knowledge` basic fact sync for法人設立日 if present. |
| `risk_if_left_stale` | BWE timeline rows may be evaluated against a false pre-company history; BZM/Textbook case notes could confuse SIP involvement, company founding, and pre-incorporation support. |
| `do_not_use_as` | Do not use `2019-04-01` as BWE founding snapshot, representative period start, FRL timeline evaluated_at, or company age input. |

### db_hygiene_p11_bwe_amd_support_started_at

| field | value |
|---|---|
| `issue_id` | `db_hygiene_p11_bwe_amd_support_started_at` |
| `project_id` | `p11` |
| `affected_table_column` | `project_ventures.amd_support_started_at` |
| `current_db_value` | `2026-02-01` |
| `source_backed_value_or_status` | `2024-04-01` as SIP/AMD support start anchor; source confidence medium, not a primary exact contract date |
| `source_evidence` | `/Users/masa/projects/knowledge/BWE.md` says AMD involvement began 2024-04; live `projects.start_ym=202404`; timeline date lookup says do not use `project_ventures.amd_support_started_at=2026-02-01`. |
| `classification` | `db_stale_support_start_conflicts_with_projects_and_internal_source`; internal/DB anchor, primary request/contract still missing |
| `recommended_os_db_action` | Review whether `amd_support_started_at` should store an internal support anchor when primary exact date is missing. If yes, update to `2024-04-01` with note/source hygiene. If field requires primary exact date, leave null or keep pending rather than false `2026-02-01`. |
| `candidate_sql_or_sync_note` | Candidate only, not executed: `update project_ventures set amd_support_started_at = date '2024-04-01', updated_at = now() where project_id = 'p11' and amd_support_started_at = date '2026-02-01';` Alternative candidate: set to null/pending and keep `2024-04` in notes until primary source is found. |
| `risk_if_left_stale` | A 2026 support start would erase the SIP/pre-company launch period and break the BWE historical timeline row boundary. |
| `do_not_use_as` | Do not use `2026-02-01` as AMD/SIP support start, BWE launch support start, or FRL_cap_amd timeline source. Do not infer exact first contract/email from the `2024-04-01` anchor. |

### db_hygiene_p06_ctb_founded_at

| field | value |
|---|---|
| `issue_id` | `db_hygiene_p06_ctb_founded_at` |
| `project_id` | `p06` |
| `affected_table_column` | `project_ventures.founded_at` |
| `current_db_value` | `2023-04-01` |
| `source_backed_value_or_status` | CTB official founding date candidate: `2021-12-09` |
| `source_evidence` | Timeline date lookup records `project_ventures.founded_at=2023-04-01` vs CTB official `2021-12-09`. CTB public AMED news is separate evidence for `2024-12-27` AMED採択 and does not establish company founding. |
| `classification` | `db_stale_date_conflicts_with_official_public_source` |
| `recommended_os_db_action` | OS/DB worker should verify CTB official founding page/source pack and, if `project_ventures.founded_at` is official company founding date, correct p06 to `2021-12-09`. Keep this separate from AMD COO/support dates and from migration 112 current FRL correction. |
| `candidate_sql_or_sync_note` | Candidate only, not executed: `update project_ventures set founded_at = date '2021-12-09', updated_at = now() where project_id = 'p06' and founded_at = date '2023-04-01';` Then verify basic fact sync if present. |
| `risk_if_left_stale` | Future workers may confuse CTB company founding with AMD COO/support entry or AMED restart timing, and use a stale company date in timeline notes. |
| `do_not_use_as` | Do not use `2023-04-01` as official CTB founding date. Do not use `2021-12-09` as AMD COO start. Do not let this correction alter `frl_cap=3`, `frl_cap_amd=0`, AMD row `left`, or the frozen/current light-support guardrail. |

### db_hygiene_p09_jc_amd_join_basic_fact

| field | value |
|---|---|
| `issue_id` | `db_hygiene_p09_jc_amd_join_basic_fact` |
| `project_id` | `p09` |
| `affected_table_column` | `project_knowledge.fact_text` for `AMD参画開始日`; exact row should be selected by `project_id`, `category`, `entity_name`, and `source` before any update |
| `current_db_value` | `project_knowledge.AMD参画開始日='2025-11-01'` |
| `source_backed_value_or_status` | conflict unresolved. Other anchors: `projects.start_ym=202312`, `project_members.masa.join_ym=202312`, internal knowledge `2023-XX`, deep-pivot candidate `2024-01-01`; no exact support-start source yet. |
| `source_evidence` | Date source lookup says `2025-11-01` is likely basic_facts_sync/backfill and should not be adopted as exact AMD relationship start without hygiene review. `projects.end_ym=202603` and knowledge support a month-level support end, but not the start exact date. |
| `classification` | `source_conflict_probable_basic_fact_backfill_issue`; no replacement exact date approved |
| `recommended_os_db_action` | Do not overwrite with a guessed date. OS/DB worker should inspect the `project_knowledge` row source, sync job, and upstream value that produced `2025-11-01`; either mark/rewrite the fact as `source_conflict` / `needs_review`, or replace only after finding first AMD engagement source. |
| `candidate_sql_or_sync_note` | Candidate only, not executed: first run read-only select: `select id, project_id, category, entity_name, fact_text, confidence, source, status, updated_at from project_knowledge where project_id = 'p09' and entity_name = 'AMD参画開始日';` Possible quarantine candidate after owner approval: update matching row to `status='needs_review'`, `confidence='low'`, and fact text/note that exact date is source-conflicting. Do not set to `2023-12-01`, `2024-01-01`, or `2025-11-01` as exact support start without primary source. |
| `risk_if_left_stale` | JC support-start notes may use `2025-11-01`, erasing 2023-12/2024-01 AMD involvement anchors and distorting the historical FRL timeline. |
| `do_not_use_as` | Do not use `2025-11-01` as exact AMD relationship start, deep pivot start, first 野田先生 connection, FRL evaluated_at, or proof of current AMD contribution after 2026-03. |

## OS/DB worker checklist

1. Re-read `pwa/design/db_schema.md` before writing any SQL; do not assume columns beyond this handoff.
2. Re-read live rows in `project_ventures`, `project_knowledge`, and any sync/source tables before making a correction.
3. Separate official company founding dates from AMD support start/end dates.
4. Separate public proof from private/internal source. Private source IDs can guide DB hygiene but should not be copied into public-facing copy.
5. Apply any correction in its own reviewed migration or controlled DB task; this handoff is not approval to write.
6. After any `project_ventures` correction, verify `pj_basic_facts_sync` or equivalent derived `project_knowledge` rows so stale basic facts do not remain.
7. After any p06 CTB founding correction, verify that migration 112/current correction remains intact: CTB current row stays `frl_cap=3`, `frl_cap_amd=0`, AMD founding member row stays non-active/left.

## Not in scope

- No DB write, DDL, migration, extractor implementation, code implementation, or deploy.
- No FRL/PRS/R_net formal value adoption.
- No 0-9 score table.
- No current 7-axis AMD Score replacement.
- No historical score recalculation.
- No public manuscript proofing from private/internal source without a separate public-safe source pass.

## Commander judgment items

1. Can OS/DB define `project_ventures.founded_at` as official/legal company founded date across all ventures?
2. Should `project_ventures.amd_support_started_at` allow internal month anchors like `2024-04-01`, or should it remain null/pending until primary source exists?
3. Should `project_knowledge` support a `needs_review`/`source_conflict` status for stale basic facts, or should stale derived facts only be fixed by upstream sync?
4. Should p18 `project_xrl_log` 2019 milestone be preserved as a separate research/TRL timeline row, corrected, or archived after source investigation?
