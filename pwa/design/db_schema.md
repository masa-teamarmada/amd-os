# DB Schema Reference — AMD OS Supabase

> ⚠️ **このファイルは自動生成。手動で編集しないこと。**

> 生成: `cd pwa && python3 -X utf8 scripts/dump_schema.py`  最終生成: 2026-05-27 00:05 JST


## ⛔ 列名は想像で書かない

`member_activities` の列名を `code_name`/`created_at`/`activity_text`/`kind` と想像で書いてバグった事故 (BUGS.md `[GAS] member_knowledge 抽出で「きよ」に他人の活動が紐付くカオス` 参照)。新規 cron / API / Edge Function 実装時は **必ずこの md を grep して列名を確認** してから select / filter / insert を書くこと。

## 索引

[`amd_management_score_evidence`](#amd-management-score-evidence) / [`amd_management_score_raw_signals`](#amd-management-score-raw-signals) / [`amd_management_score_snapshots`](#amd-management-score-snapshots) / [`amd_management_score_source_runs`](#amd-management-score-source-runs) / [`amd_score_alpha`](#amd-score-alpha) / [`amd_score_alpha_proposals`](#amd-score-alpha-proposals) / [`amd_score_inputs`](#amd-score-inputs) / [`amd_score_revisions`](#amd-score-revisions) / [`app_notifications`](#app-notifications) / [`atlas_decisions`](#atlas-decisions) / [`atlas_divergences`](#atlas-divergences) / [`atlas_edges`](#atlas-edges) / [`atlas_nodes`](#atlas-nodes) / [`atlas_observations`](#atlas-observations) / [`atlas_reports`](#atlas-reports) / [`atlas_signals`](#atlas-signals) / [`atlas_stories`](#atlas-stories) / [`atlas_story_merges`](#atlas-story-merges) / [`atlas_story_themes`](#atlas-story-themes) / [`atlas_themes`](#atlas-themes) / [`billing_cycles`](#billing-cycles) / [`billing_log`](#billing-log) / [`company_actual_monthly`](#company-actual-monthly) / [`company_budget_actual_monthly`](#company-budget-actual-monthly) / [`company_budget_inputs`](#company-budget-inputs) / [`company_budget_monthly`](#company-budget-monthly) / [`company_budget_simulation_runs`](#company-budget-simulation-runs) / [`company_budget_variance_notes`](#company-budget-variance-notes) / [`company_finance_receipt_events`](#company-finance-receipt-events) / [`company_finance_recurring_items`](#company-finance-recurring-items) / [`freee_oauth_tokens`](#freee-oauth-tokens) / [`freeze_period_backfills`](#freeze-period-backfills) / [`issues`](#issues) / [`knowledge_sessions`](#knowledge-sessions) / [`l2_extract_state`](#l2-extract-state) / [`l2_feedbacks`](#l2-feedbacks) / [`l2_notifications`](#l2-notifications) / [`lane_suggestions`](#lane-suggestions) / [`llm_model_config`](#llm-model-config) / [`llm_prompts`](#llm-prompts) / [`macro_index_log`](#macro-index-log) / [`macro_lane_weights`](#macro-lane-weights) / [`meeting_notifications`](#meeting-notifications) / [`member_activities`](#member-activities) / [`member_app_notifications`](#member-app-notifications) / [`member_google_oauth_tokens`](#member-google-oauth-tokens) / [`member_knowledge`](#member-knowledge) / [`member_ms_activities`](#member-ms-activities) / [`members`](#members) / [`michinori_app_config`](#michinori-app-config) / [`michinori_friendships`](#michinori-friendships) / [`michinori_leaderboard_entries`](#michinori-leaderboard-entries) / [`michinori_profiles`](#michinori-profiles) / [`milestone_monthly_progress`](#milestone-monthly-progress) / [`milestone_responsibility`](#milestone-responsibility) / [`milestone_sub_items`](#milestone-sub-items) / [`monthly_report_revision_messages`](#monthly-report-revision-messages) / [`monthly_report_revisions`](#monthly-report-revisions) / [`monthly_reports`](#monthly-reports) / [`monthly_reward_payout`](#monthly-reward-payout) / [`ms_progress_proposals`](#ms-progress-proposals) / [`ms_progress_revisions`](#ms-progress-revisions) / [`ms_proposal_messages`](#ms-proposal-messages) / [`ms_revision_messages`](#ms-revision-messages) / [`narrative_feedbacks`](#narrative-feedbacks) / [`navigator_history`](#navigator-history) / [`navigator_items`](#navigator-items) / [`observation_log`](#observation-log) / [`papers_log`](#papers-log) / [`payout_agreement`](#payout-agreement) / [`payout_notices`](#payout-notices) / [`progress_estimate_state`](#progress-estimate-state) / [`project_config`](#project-config) / [`project_events`](#project-events) / [`project_founding_members`](#project-founding-members) / [`project_freeze_periods`](#project-freeze-periods) / [`project_graduation_signals`](#project-graduation-signals) / [`project_knowledge`](#project-knowledge) / [`project_meeting_summaries`](#project-meeting-summaries) / [`project_members`](#project-members) / [`project_monthly_notes`](#project-monthly-notes) / [`project_partners`](#project-partners) / [`project_pl_hearings`](#project-pl-hearings) / [`project_pl_monthly`](#project-pl-monthly) / [`project_registry_diffs`](#project-registry-diffs) / [`project_strategy_signals`](#project-strategy-signals) / [`project_vc_relations`](#project-vc-relations) / [`project_venture_members`](#project-venture-members) / [`project_ventures`](#project-ventures) / [`project_xrl_evidence`](#project-xrl-evidence) / [`project_xrl_log`](#project-xrl-log) / [`projects`](#projects) / [`protocol_examples`](#protocol-examples) / [`protocol_result_observations`](#protocol-result-observations) / [`protocols`](#protocols) / [`reimbursements`](#reimbursements) / [`seed_contact_log`](#seed-contact-log) / [`seed_funding`](#seed-funding) / [`seed_news`](#seed-news) / [`seeds`](#seeds) / [`settings`](#settings) / [`source_cache`](#source-cache) / [`tasks`](#tasks) / [`triple_helix_loading`](#triple-helix-loading) / [`triple_helix_state_log`](#triple-helix-state-log) / [`tsukuyomi_chat_logs`](#tsukuyomi-chat-logs) / [`tsukuyomi_context`](#tsukuyomi-context) / [`tsukuyomi_learnings`](#tsukuyomi-learnings) / [`tsukuyomi_learnings_status`](#tsukuyomi-learnings-status) / [`tsukuyomi_memory`](#tsukuyomi-memory) / [`tsukuyomi_nudge_queue`](#tsukuyomi-nudge-queue) / [`tsukuyomi_sessions`](#tsukuyomi-sessions) / [`tsukuyomi_usage_log`](#tsukuyomi-usage-log) / [`value_milestones`](#value-milestones) / [`value_plan_cycles`](#value-plan-cycles) / [`vc_contacts`](#vc-contacts) / [`vc_funds`](#vc-funds) / [`vc_investments`](#vc-investments) / [`vc_news`](#vc-news) / [`vcs`](#vcs) / [`xrl_feedbacks`](#xrl-feedbacks)

---

## amd_management_score_evidence

行数 (概算): 166
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `snapshot_id` | `uuid` | NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `axis` | `text` | NOT NULL | `` |
| 5 | `evidence_kind` | `text` | NOT NULL | `` |
| 6 | `summary` | `text` | NOT NULL | `` |
| 7 | `source_type` | `text` | NULL | `` |
| 8 | `source_ref` | `text` | NULL | `` |
| 9 | `source_hash` | `text` | NULL | `` |
| 10 | `impact` | `numeric` | NOT NULL | `0` |
| 11 | `confidence` | `numeric` | NOT NULL | `0.5` |
| 12 | `payload` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## amd_management_score_raw_signals

行数 (概算): 5,744
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `run_id` | `uuid` | NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `axis` | `text` | NOT NULL | `` |
| 5 | `source_kind` | `text` | NOT NULL | `` |
| 6 | `source_table` | `text` | NOT NULL | `` |
| 7 | `source_id` | `text` | NOT NULL | `` |
| 8 | `signal_key` | `text` | NOT NULL | `` |
| 9 | `signal_value_numeric` | `numeric` | NULL | `` |
| 10 | `signal_value_text` | `text` | NULL | `` |
| 11 | `project_id` | `text` | NULL | `` |
| 12 | `observed_at` | `timestamptz` | NULL | `` |
| 13 | `confidence` | `numeric` | NOT NULL | `0.5` |
| 14 | `weight_hint` | `numeric` | NOT NULL | `1` |
| 15 | `payload` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 16 | `source_hash` | `text` | NOT NULL | `` |
| 17 | `imported_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## amd_management_score_snapshots

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(ym)` (constraint: `amd_management_score_snapshots_ym_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `total_score` | `numeric` | NULL | `` |
| 4 | `initiative_score` | `numeric` | NULL | `` |
| 5 | `finance_score` | `numeric` | NULL | `` |
| 6 | `retention_score` | `numeric` | NULL | `` |
| 7 | `pipeline_score` | `numeric` | NULL | `` |
| 8 | `direction_score` | `numeric` | NULL | `` |
| 9 | `weights_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 10 | `inputs_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 11 | `next_actions_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 12 | `confidence` | `numeric` | NOT NULL | `0.5` |
| 13 | `created_by` | `text` | NOT NULL | `'automation'::text` |
| 14 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `summary` | `text` | NULL | `` |
| 17 | `finance_cap_applied` | `text` | NULL | `` |

## amd_management_score_source_runs

行数 (概算): 30
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `source_kind` | `text` | NOT NULL | `` |
| 4 | `source` | `text` | NOT NULL | `` |
| 5 | `status` | `text` | NOT NULL | `'running'::text` |
| 6 | `params` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 7 | `stats` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 8 | `error` | `text` | NULL | `` |
| 9 | `started_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `finished_at` | `timestamptz` | NULL | `` |

## amd_score_alpha

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `alpha` | `jsonb` | NOT NULL | `` |
| 3 | `effective_from` | `timestamptz` | NOT NULL | `` |
| 4 | `effective_to` | `timestamptz` | NULL | `` |
| 5 | `notes` | `text` | NULL | `` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## amd_score_alpha_proposals

行数 (概算): -1
PRIMARY KEY: `proposal_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `proposal_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `analysis_period_start` | `date` | NOT NULL | `` |
| 3 | `analysis_period_end` | `date` | NOT NULL | `` |
| 4 | `pattern_summary_md` | `text` | NOT NULL | `` |
| 5 | `proposed_alpha_diff` | `jsonb` | NOT NULL | `` |
| 6 | `reasoning_md` | `text` | NOT NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'pending'::text` |
| 8 | `applied_revisions_count` | `int4` | NOT NULL | `0` |
| 9 | `approved_by` | `text` | NULL | `` |
| 10 | `approved_at` | `timestamptz` | NULL | `` |
| 11 | `rejected_reason` | `text` | NULL | `` |
| 12 | `applied_alpha_version_id` | `uuid` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## amd_score_inputs

行数 (概算): 102
PRIMARY KEY: `id`
UNIQUE: `(project_id,evaluated_at)` (constraint: `amd_score_inputs_project_id_evaluated_at_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `evaluated_at` | `timestamptz` | NOT NULL | `` |
| 4 | `mu_a` | `float4` | NULL | `` |
| 5 | `mu_i` | `float4` | NULL | `` |
| 6 | `mu_g` | `float4` | NULL | `` |
| 7 | `trl` | `float4` | NULL | `` |
| 8 | `brl` | `float4` | NULL | `` |
| 9 | `grl` | `float4` | NULL | `` |
| 10 | `srl` | `float4` | NULL | `` |
| 11 | `hrl` | `float4` | NULL | `` |
| 12 | `frl` | `float4` | NULL | `` |
| 13 | `shallow_tech_mode` | `bool` | NOT NULL | `false` |
| 14 | `evaluator` | `text` | NULL | `` |
| 15 | `notes` | `text` | NULL | `` |
| 16 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `alq_self_awareness` | `float4` | NULL | `` |
| 19 | `alq_relational_transparency` | `float4` | NULL | `` |
| 20 | `alq_balanced_processing` | `float4` | NULL | `` |
| 21 | `alq_internalized_moral` | `float4` | NULL | `` |
| 22 | `frl_notes` | `text` | NULL | `` |
| 23 | `mu_notes` | `jsonb` | NULL | `` |
| 24 | `xrl_notes` | `jsonb` | NULL | `` |
| 25 | `frl_grit` | `float4` | NULL | `` |
| 26 | `frl_resilience` | `float4` | NULL | `` |

## amd_score_revisions

行数 (概算): -1
PRIMARY KEY: `revision_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `revision_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `score_input_id` | `uuid` | NULL | `` |
| 4 | `axis` | `text` | NOT NULL | `` |
| 5 | `old_value` | `numeric` | NULL | `` |
| 6 | `new_value` | `numeric` | NOT NULL | `` |
| 7 | `evaluated_at` | `date` | NOT NULL | `` |
| 8 | `reason_md` | `text` | NOT NULL | `` |
| 9 | `discussion_md` | `text` | NULL | `` |
| 10 | `revised_by` | `text` | NOT NULL | `` |
| 11 | `revised_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `applied_to_alpha` | `bool` | NOT NULL | `false` |
| 13 | `alpha_proposal_id` | `uuid` | NULL | `` |
| 14 | `source` | `text` | NOT NULL | `'manual'::text` |
| 15 | `status` | `text` | NOT NULL | `'active'::text` |
| 16 | `confidence` | `numeric` | NULL | `` |
| 17 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## app_notifications

行数 (概算): 51
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `kind` | `text` | NOT NULL | `` |
| 3 | `title` | `text` | NOT NULL | `` |
| 4 | `body` | `text` | NULL | `` |
| 5 | `link` | `text` | NULL | `` |
| 6 | `meta` | `jsonb` | NULL | `` |
| 7 | `related_vc_id` | `uuid` | NULL | `` |
| 8 | `source` | `text` | NOT NULL | `'system'::text` |
| 9 | `read_at` | `timestamptz` | NULL | `` |
| 10 | `dismissed_at` | `timestamptz` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `related_seed_id` | `uuid` | NULL | `` |

## atlas_decisions

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `topic_id` | `uuid` | NULL | `` |
| 3 | `decided_at` | `timestamptz` | NULL | `now()` |
| 4 | `action` | `text` | NULL | `` |
| 5 | `rationale` | `text` | NULL | `` |
| 6 | `outcome_eval_at` | `timestamptz` | NULL | `` |
| 7 | `outcome` | `text` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## atlas_divergences

行数 (概算): 54
PRIMARY KEY: `id`
UNIQUE: `(theme_id)` (constraint: `atlas_divergences_theme_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `theme_id` | `uuid` | NOT NULL | `` |
| 3 | `global_summary` | `text` | NULL | `` |
| 4 | `japan_summary` | `text` | NULL | `` |
| 5 | `divergence_message` | `text` | NULL | `` |
| 6 | `divergence_score` | `float8` | NULL | `` |
| 7 | `global_intensity` | `float8` | NULL | `` |
| 8 | `japan_intensity` | `float8` | NULL | `` |
| 9 | `global_signal_count` | `int4` | NOT NULL | `0` |
| 10 | `japan_signal_count` | `int4` | NOT NULL | `0` |
| 11 | `signal_breakdown` | `jsonb` | NULL | `` |
| 12 | `generated_at` | `timestamptz` | NOT NULL | `now()` |

## atlas_edges

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `from_node` | `uuid` | NULL | `` |
| 3 | `to_node` | `uuid` | NULL | `` |
| 4 | `relation_type` | `text` | NOT NULL | `` |
| 5 | `strength` | `numeric` | NULL | `0.5` |
| 6 | `note` | `text` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## atlas_nodes

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `type` | `text` | NOT NULL | `` |
| 3 | `title` | `text` | NOT NULL | `` |
| 4 | `summary` | `text` | NULL | `` |
| 5 | `metadata` | `jsonb` | NULL | `'{}'::jsonb` |
| 6 | `importance` | `text` | NULL | `'medium'::text` |
| 7 | `status` | `text` | NULL | `'active'::text` |
| 8 | `tags` | `_text` | NULL | `'{}'::text[]` |
| 9 | `last_updated` | `timestamptz` | NULL | `now()` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## atlas_observations

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `node_id` | `uuid` | NULL | `` |
| 3 | `observed_at` | `timestamptz` | NULL | `now()` |
| 4 | `content` | `text` | NOT NULL | `` |
| 5 | `source_url` | `text` | NULL | `` |
| 6 | `source_type` | `text` | NULL | `` |

## atlas_reports

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `type` | `text` | NOT NULL | `` |
| 3 | `title` | `text` | NOT NULL | `` |
| 4 | `period_start` | `timestamptz` | NULL | `` |
| 5 | `period_end` | `timestamptz` | NULL | `` |
| 6 | `signal_count` | `int4` | NULL | `0` |
| 7 | `high_count` | `int4` | NULL | `0` |
| 8 | `medium_count` | `int4` | NULL | `0` |
| 9 | `low_count` | `int4` | NULL | `0` |
| 10 | `signals_json` | `jsonb` | NULL | `'[]'::jsonb` |
| 11 | `macro_summary` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## atlas_signals

行数 (概算): 793
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `title` | `text` | NOT NULL | `` |
| 3 | `content` | `text` | NOT NULL | `` |
| 4 | `source_url` | `text` | NULL | `` |
| 5 | `source_type` | `text` | NULL | `` |
| 6 | `domain` | `text` | NULL | `` |
| 7 | `suggested_tags` | `_text` | NULL | `'{}'::text[]` |
| 8 | `importance` | `text` | NULL | `'medium'::text` |
| 9 | `status` | `text` | NULL | `'inbox'::text` |
| 10 | `target_node_id` | `uuid` | NULL | `` |
| 11 | `submitted_at` | `timestamptz` | NULL | `now()` |
| 12 | `reviewed_at` | `timestamptz` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `story_id` | `uuid` | NULL | `` |
| 15 | `metadata` | `jsonb` | NULL | `` |

## atlas_stories

行数 (概算): 240
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `title` | `text` | NOT NULL | `` |
| 3 | `summary` | `text` | NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'ongoing'::text` |
| 5 | `importance` | `text` | NOT NULL | `'medium'::text` |
| 6 | `tags` | `_text` | NOT NULL | `'{}'::text[]` |
| 7 | `primary_domain` | `text` | NULL | `` |
| 8 | `started_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `last_updated_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `signal_count` | `int4` | NOT NULL | `0` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## atlas_story_merges

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `merged_from_title` | `text` | NOT NULL | `` |
| 3 | `merged_from_summary` | `text` | NULL | `` |
| 4 | `merged_to_id` | `uuid` | NULL | `` |
| 5 | `merged_to_title` | `text` | NOT NULL | `` |
| 6 | `reason` | `text` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## atlas_story_themes

行数 (概算): 154
PRIMARY KEY: `story_id, theme_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `story_id` | `uuid` | NOT NULL | `` |
| 2 | `theme_id` | `uuid` | NOT NULL | `` |
| 3 | `confidence` | `float8` | NULL | `` |
| 4 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## atlas_themes

行数 (概算): 54
PRIMARY KEY: `id`
UNIQUE: `(name)` (constraint: `atlas_themes_name_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `name` | `text` | NOT NULL | `` |
| 3 | `description` | `text` | NULL | `` |
| 4 | `primary_domain` | `text` | NULL | `` |
| 5 | `tag_keywords` | `_text` | NOT NULL | `'{}'::text[]` |
| 6 | `status` | `text` | NOT NULL | `'active'::text` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## billing_cycles

行数 (概算): 147
PRIMARY KEY: `id`
UNIQUE: `(project_id,ym)` (constraint: `billing_cycles_project_id_ym_key`)
UNIQUE: `(project_id,ym)` (constraint: `billing_cycles_project_ym_unique`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `budget_yen` | `int4` | NULL | `` |
| 5 | `status` | `text` | NOT NULL | `'not_started'::text` |
| 6 | `meeting_start_at` | `timestamptz` | NULL | `` |
| 7 | `report_fixed_at` | `timestamptz` | NULL | `` |
| 8 | `invoice_sent_at` | `timestamptz` | NULL | `` |
| 9 | `payment_confirmed_at` | `timestamptz` | NULL | `` |
| 10 | `ms_progress_summary_json` | `jsonb` | NULL | `` |
| 11 | `member_allocations_json` | `jsonb` | NULL | `` |
| 12 | `reward_summary_json` | `jsonb` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `budget_confirmed_at` | `timestamptz` | NULL | `` |
| 16 | `invoice_issued_at` | `timestamptz` | NULL | `` |
| 17 | `payout_notice_uploaded_at` | `timestamptz` | NULL | `` |
| 18 | `meeting_html_link` | `text` | NULL | `` |
| 19 | `meeting_event_id` | `text` | NULL | `` |
| 20 | `invoice_ym` | `text` | NULL | `` |
| 21 | `cycle_id` | `text` | NULL | `` |
| 22 | `budget_reported_by` | `text` | NULL | `` |
| 23 | `invoice_issued_by` | `text` | NULL | `` |
| 24 | `invoice_sent_by` | `text` | NULL | `` |
| 25 | `payment_confirmed_by` | `text` | NULL | `` |
| 26 | `report_fixed_by` | `text` | NULL | `` |
| 27 | `budget_reported_amount` | `numeric` | NULL | `` |
| 28 | `budget_reported_at` | `text` | NULL | `` |
| 29 | `budget_confirmed_by` | `text` | NULL | `` |
| 30 | `reward_paid_at` | `text` | NULL | `` |
| 31 | `reward_paid_by` | `text` | NULL | `` |
| 32 | `meeting_skipped` | `bool` | NULL | `false` |
| 33 | `budget_buffer_amount` | `int4` | NULL | `0` |
| 34 | `invoice_base_lines_json` | `text` | NULL | `` |
| 35 | `invoice_subject` | `text` | NULL | `` |
| 36 | `freee_invoice_number` | `text` | NULL | `` |
| 37 | `invoice_pdf_url` | `text` | NULL | `` |

## billing_log

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `action` | `text` | NOT NULL | `` |
| 5 | `actor` | `text` | NULL | `` |
| 6 | `detail` | `jsonb` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## company_actual_monthly

行数 (概算): 41
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `scope` | `text` | NOT NULL | `'company'::text` |
| 4 | `project_id` | `text` | NULL | `` |
| 5 | `project_key` | `text` | NULL | `` |
| 6 | `category` | `text` | NOT NULL | `` |
| 7 | `account_name` | `text` | NULL | `` |
| 8 | `account_key` | `text` | NULL | `` |
| 9 | `actual_amount_yen` | `int8` | NOT NULL | `0` |
| 10 | `freee_account_item_id` | `text` | NULL | `` |
| 11 | `freee_partner_id` | `text` | NULL | `` |
| 12 | `source_ref` | `text` | NULL | `` |
| 13 | `raw_hash` | `text` | NULL | `` |
| 14 | `payload` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 15 | `imported_at` | `timestamptz` | NOT NULL | `now()` |

## company_budget_actual_monthly

行数 (概算): 0

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `ym` | `text` | NULL | `` |
| 2 | `scope` | `text` | NULL | `` |
| 3 | `project_id` | `text` | NULL | `` |
| 4 | `category` | `text` | NULL | `` |
| 5 | `account_name` | `text` | NULL | `` |
| 6 | `budget_amount_yen` | `int8` | NULL | `` |
| 7 | `actual_amount_yen` | `int8` | NULL | `` |
| 8 | `variance_yen` | `int8` | NULL | `` |
| 9 | `cash_amount_yen` | `int8` | NULL | `` |
| 10 | `runway_months` | `numeric` | NULL | `` |
| 11 | `budget_version` | `text` | NULL | `` |
| 12 | `simulation_run_id` | `uuid` | NULL | `` |
| 13 | `freee_account_item_id` | `text` | NULL | `` |
| 14 | `freee_partner_id` | `text` | NULL | `` |
| 15 | `budget_payload` | `jsonb` | NULL | `` |
| 16 | `actual_payload` | `jsonb` | NULL | `` |

## company_budget_inputs

行数 (概算): 37
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `input_kind` | `text` | NOT NULL | `` |
| 3 | `source_id` | `text` | NULL | `` |
| 4 | `source_id_key` | `text` | NULL | `` |
| 5 | `ym` | `text` | NULL | `` |
| 6 | `ym_key` | `text` | NULL | `` |
| 7 | `project_id` | `text` | NULL | `` |
| 8 | `project_key` | `text` | NULL | `` |
| 9 | `label` | `text` | NULL | `` |
| 10 | `amount_yen` | `int8` | NULL | `` |
| 11 | `payload` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 12 | `source` | `text` | NOT NULL | `'gas_monthly_pl'::text` |
| 13 | `version` | `text` | NOT NULL | `'baseline'::text` |
| 14 | `imported_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_budget_monthly

行数 (概算): 432
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `simulation_run_id` | `uuid` | NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `scope` | `text` | NOT NULL | `'company'::text` |
| 5 | `project_id` | `text` | NULL | `` |
| 6 | `project_key` | `text` | NULL | `` |
| 7 | `category` | `text` | NOT NULL | `` |
| 8 | `account_name` | `text` | NULL | `` |
| 9 | `account_key` | `text` | NULL | `` |
| 10 | `budget_amount_yen` | `int8` | NOT NULL | `0` |
| 11 | `cash_amount_yen` | `int8` | NULL | `` |
| 12 | `runway_months` | `numeric` | NULL | `` |
| 13 | `payload` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 14 | `note` | `text` | NULL | `` |
| 15 | `source` | `text` | NOT NULL | `'gas_monthly_pl'::text` |
| 16 | `source_ref` | `text` | NULL | `` |
| 17 | `version` | `text` | NOT NULL | `'baseline'::text` |
| 18 | `imported_at` | `timestamptz` | NOT NULL | `now()` |
| 19 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_budget_simulation_runs

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `scenario_id` | `text` | NULL | `` |
| 3 | `version` | `text` | NOT NULL | `'baseline'::text` |
| 4 | `source` | `text` | NOT NULL | `'gas_monthly_pl'::text` |
| 5 | `source_ref` | `text` | NULL | `` |
| 6 | `engine_version` | `text` | NULL | `` |
| 7 | `params` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 8 | `ran_at` | `timestamptz` | NOT NULL | `now()` |

## company_budget_variance_notes

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NULL | `` |
| 4 | `category` | `text` | NULL | `` |
| 5 | `variance_kind` | `text` | NOT NULL | `` |
| 6 | `note` | `text` | NOT NULL | `` |
| 7 | `source_type` | `text` | NULL | `` |
| 8 | `source_ref` | `text` | NULL | `` |
| 9 | `confidence` | `numeric` | NOT NULL | `0.5` |
| 10 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 11 | `payload` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_finance_receipt_events

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `recurring_item_id` | `uuid` | NULL | `` |
| 3 | `ym` | `text` | NULL | `` |
| 4 | `receipt_date` | `date` | NULL | `` |
| 5 | `vendor_name` | `text` | NULL | `` |
| 6 | `amount_yen` | `int8` | NULL | `` |
| 7 | `currency` | `text` | NOT NULL | `'JPY'::text` |
| 8 | `payment_method` | `text` | NULL | `` |
| 9 | `withdrawal_account` | `text` | NULL | `` |
| 10 | `subject` | `text` | NULL | `` |
| 11 | `source_kind` | `text` | NOT NULL | `'gmail'::text` |
| 12 | `source_ref` | `text` | NULL | `` |
| 13 | `raw_hash` | `text` | NULL | `` |
| 14 | `attachment_refs` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 15 | `actual_synced_at` | `timestamptz` | NULL | `` |
| 16 | `budget_suggestion` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 17 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 18 | `payload` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 19 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_finance_recurring_items

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `status` | `text` | NOT NULL | `'active'::text` |
| 3 | `item_kind` | `text` | NOT NULL | `'subscription'::text` |
| 4 | `display_name` | `text` | NOT NULL | `` |
| 5 | `vendor_name` | `text` | NULL | `` |
| 6 | `category` | `text` | NOT NULL | `'fixed_cost'::text` |
| 7 | `amount_yen` | `int8` | NOT NULL | `0` |
| 8 | `currency` | `text` | NOT NULL | `'JPY'::text` |
| 9 | `frequency` | `text` | NOT NULL | `'monthly'::text` |
| 10 | `start_ym` | `text` | NOT NULL | `` |
| 11 | `end_ym` | `text` | NULL | `` |
| 12 | `budget_forward_fill` | `bool` | NOT NULL | `false` |
| 13 | `auto_debit` | `bool` | NULL | `` |
| 14 | `withdrawal_account` | `text` | NULL | `` |
| 15 | `payment_method` | `text` | NULL | `` |
| 16 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 17 | `source_ref` | `text` | NULL | `` |
| 18 | `next_expected_ym` | `text` | NULL | `` |
| 19 | `last_receipt_at` | `timestamptz` | NULL | `` |
| 20 | `last_budget_synced_at` | `timestamptz` | NULL | `` |
| 21 | `notes` | `text` | NULL | `` |
| 22 | `payload` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 23 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 24 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## freee_oauth_tokens

行数 (概算): -1
PRIMARY KEY: `token_key`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `token_key` | `text` | NOT NULL | `'default'::text` |
| 2 | `refresh_token` | `text` | NOT NULL | `` |
| 3 | `company_id` | `text` | NULL | `` |
| 4 | `scope` | `text` | NULL | `` |
| 5 | `external_cid` | `text` | NULL | `` |
| 6 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## freeze_period_backfills

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,freeze_from_ym,restart_ym)` (constraint: `freeze_period_backfills_project_id_freeze_from_ym_restart_y_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `freeze_from_ym` | `text` | NOT NULL | `` |
| 4 | `restart_ym` | `text` | NOT NULL | `` |
| 5 | `summary` | `text` | NOT NULL | `` |
| 6 | `source_hash` | `text` | NOT NULL | `` |
| 7 | `source_meta` | `jsonb` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## issues

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(issue_id)` (constraint: `issues_issue_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `issue_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `description` | `text` | NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'open'::text` |
| 7 | `severity` | `text` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## knowledge_sessions

行数 (概算): -1
PRIMARY KEY: `base_ym`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `base_ym` | `text` | NOT NULL | `` |
| 2 | `offline_enabled` | `bool` | NOT NULL | `false` |
| 3 | `event_date` | `date` | NULL | `` |
| 4 | `venue_name` | `text` | NULL | `` |
| 5 | `venue_address` | `text` | NULL | `` |
| 6 | `venue_link` | `text` | NULL | `` |
| 7 | `participant_member_ids` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 8 | `message_to_pm` | `text` | NULL | `` |
| 9 | `announcement_draft` | `text` | NULL | `` |
| 10 | `announcement_channel_id` | `text` | NULL | `` |
| 11 | `announcement_posted_at` | `timestamptz` | NULL | `` |
| 12 | `announcement_posted_by` | `text` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## l2_extract_state

行数 (概算): 49
PRIMARY KEY: `l2_kind, target_id, scope_key`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `l2_kind` | `text` | NOT NULL | `` |
| 2 | `target_id` | `text` | NOT NULL | `` |
| 3 | `scope_key` | `text` | NOT NULL | `` |
| 4 | `source_hash` | `text` | NOT NULL | `` |
| 5 | `saved_count` | `int4` | NOT NULL | `0` |
| 6 | `total_count` | `int4` | NOT NULL | `0` |
| 7 | `llm_model` | `text` | NULL | `` |
| 8 | `message` | `text` | NULL | `` |
| 9 | `last_processed_at` | `timestamptz` | NOT NULL | `now()` |

## l2_feedbacks

行数 (概算): 32
PRIMARY KEY: `feedback_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `feedback_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `l2_kind` | `text` | NOT NULL | `` |
| 3 | `target_id` | `text` | NOT NULL | `` |
| 4 | `scope_key` | `text` | NOT NULL | `'global'::text` |
| 5 | `notification_id` | `uuid` | NULL | `` |
| 6 | `meeting_id` | `text` | NULL | `` |
| 7 | `feedback_text` | `text` | NOT NULL | `` |
| 8 | `status` | `text` | NOT NULL | `'active'::text` |
| 9 | `created_by` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `applied_count` | `int4` | NOT NULL | `0` |
| 12 | `last_applied_at` | `timestamptz` | NULL | `` |

## l2_notifications

行数 (概算): 215
PRIMARY KEY: `notification_id`
UNIQUE: `(l2_kind,target_id,scope_key)` (constraint: `l2n_unique`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `notification_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `l2_kind` | `text` | NOT NULL | `` |
| 3 | `target_id` | `text` | NOT NULL | `` |
| 4 | `scope_key` | `text` | NOT NULL | `` |
| 5 | `title` | `text` | NOT NULL | `` |
| 6 | `summary` | `text` | NULL | `` |
| 7 | `saved_count` | `int4` | NOT NULL | `0` |
| 8 | `total_count` | `int4` | NOT NULL | `0` |
| 9 | `importance` | `int4` | NOT NULL | `1` |
| 10 | `notified_at` | `timestamptz` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 14 | `read_at` | `timestamptz` | NULL | `` |

## lane_suggestions

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `suggested_lanes` | `jsonb` | NOT NULL | `` |
| 4 | `reasoning` | `text` | NULL | `` |
| 5 | `model` | `text` | NULL | `` |
| 6 | `confidence` | `numeric` | NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'pending'::text` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `reviewed_at` | `timestamptz` | NULL | `` |
| 10 | `reviewer` | `text` | NULL | `` |

## llm_model_config

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(config_id)` (constraint: `llm_model_config_config_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `config_id` | `text` | NOT NULL | `` |
| 3 | `model_name` | `text` | NOT NULL | `` |
| 4 | `provider` | `text` | NOT NULL | `` |
| 5 | `is_default` | `bool` | NULL | `false` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## llm_prompts

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(prompt_key)` (constraint: `llm_prompts_prompt_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `prompt_key` | `text` | NOT NULL | `` |
| 3 | `description` | `text` | NULL | `` |
| 4 | `body` | `text` | NOT NULL | `` |
| 5 | `model` | `text` | NULL | `` |
| 6 | `max_tokens` | `int4` | NULL | `` |
| 7 | `is_active` | `bool` | NOT NULL | `true` |
| 8 | `notes` | `text` | NULL | `` |
| 9 | `updated_by` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## macro_index_log

行数 (概算): 1,554
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `lane` | `text` | NOT NULL | `` |
| 3 | `observed_at` | `date` | NOT NULL | `` |
| 4 | `index_value` | `numeric` | NOT NULL | `` |
| 5 | `policy_density` | `numeric` | NULL | `` |
| 6 | `budget_amount` | `numeric` | NULL | `` |
| 7 | `investment_amount` | `numeric` | NULL | `` |
| 8 | `policy_mention_count` | `numeric` | NULL | `` |
| 9 | `raw_signal_count` | `int4` | NULL | `` |
| 10 | `computed_at` | `timestamptz` | NOT NULL | `now()` |

## macro_lane_weights

行数 (概算): 64
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `lane` | `text` | NOT NULL | `` |
| 3 | `alpha` | `numeric` | NOT NULL | `` |
| 4 | `beta` | `numeric` | NOT NULL | `` |
| 5 | `gamma` | `numeric` | NOT NULL | `` |
| 6 | `delta` | `numeric` | NOT NULL | `` |
| 7 | `lambda` | `numeric` | NULL | `` |
| 8 | `eta` | `numeric` | NULL | `` |
| 9 | `computed_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `computed_by` | `text` | NULL | `` |
| 11 | `source_data_window_days` | `int4` | NULL | `` |

## meeting_notifications

行数 (概算): 12
PRIMARY KEY: `meeting_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `meeting_id` | `text` | NOT NULL | `` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `title` | `text` | NOT NULL | `` |
| 4 | `source_kinds` | `text` | NOT NULL | `` |
| 5 | `summary_short` | `text` | NOT NULL | `''::text` |
| 6 | `notified_at` | `timestamptz` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `read_at` | `timestamptz` | NULL | `` |

## member_activities

行数 (概算): 182
PRIMARY KEY: `id`
UNIQUE: `(member_id,project_id,source,source_item_id)` (constraint: `member_activities_member_id_project_id_source_source_item_i_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `member_id` | `text` | NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `ym` | `text` | NOT NULL | `` |
| 5 | `source` | `text` | NOT NULL | `` |
| 6 | `source_item_id` | `text` | NOT NULL | `` |
| 7 | `title` | `text` | NULL | `` |
| 8 | `content_preview` | `text` | NULL | `` |
| 9 | `item_date` | `timestamptz` | NULL | `` |
| 10 | `raw_metadata` | `jsonb` | NULL | `` |
| 11 | `extracted_at` | `timestamptz` | NULL | `now()` |
| 12 | `milestone_id` | `text` | NULL | `` |
| 13 | `initiative_origin` | `text` | NULL | `` |
| 14 | `impact` | `int2` | NULL | `` |
| 15 | `depth` | `int2` | NULL | `` |
| 16 | `reject_reason` | `text` | NULL | `` |
| 17 | `origin_lost_reason` | `text` | NULL | `` |

## member_app_notifications

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `member_id` | `text` | NOT NULL | `` |
| 3 | `notification_type` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `body` | `text` | NOT NULL | `` |
| 6 | `project_id` | `text` | NULL | `` |
| 7 | `ym` | `text` | NULL | `` |
| 8 | `payload_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 9 | `delivered_at` | `timestamptz` | NULL | `` |
| 10 | `read_at` | `timestamptz` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `timezone('utc'::text, now())` |

## member_google_oauth_tokens

行数 (概算): -1
PRIMARY KEY: `member_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `member_id` | `text` | NOT NULL | `` |
| 2 | `email` | `text` | NOT NULL | `` |
| 3 | `provider` | `text` | NOT NULL | `'google'::text` |
| 4 | `access_token` | `text` | NULL | `` |
| 5 | `refresh_token` | `text` | NULL | `` |
| 6 | `token_expires_at` | `timestamptz` | NULL | `` |
| 7 | `scopes` | `_text` | NOT NULL | `'{}'::text[]` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## member_knowledge

行数 (概算): 38
PRIMARY KEY: `id`
UNIQUE: `(code_name,category)` (constraint: `member_knowledge_code_name_category_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `code_name` | `text` | NOT NULL | `` |
| 3 | `category` | `text` | NOT NULL | `` |
| 4 | `summary` | `text` | NULL | `` |
| 5 | `source` | `text` | NULL | `'slack_conversation'::text` |
| 6 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `status` | `text` | NOT NULL | `'active'::text` |
| 8 | `source_hash` | `text` | NULL | `` |
| 9 | `last_processed_at` | `timestamptz` | NULL | `` |

## member_ms_activities

行数 (概算): 50
PRIMARY KEY: `id`
UNIQUE: `(member_id,milestone_id,ym)` (constraint: `member_ms_activities_member_id_milestone_id_ym_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `member_id` | `text` | NOT NULL | `` |
| 3 | `milestone_id` | `text` | NOT NULL | `` |
| 4 | `ym` | `text` | NOT NULL | `` |
| 5 | `narrative` | `text` | NULL | `` |
| 6 | `source_note` | `text` | NULL | `` |
| 7 | `generated_at` | `timestamptz` | NULL | `now()` |
| 8 | `learned_addendum` | `text` | NULL | `` |

## members

行数 (概算): 29
PRIMARY KEY: `id`
UNIQUE: `(email)` (constraint: `members_email_key`)
UNIQUE: `(member_id)` (constraint: `members_member_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `member_id` | `text` | NOT NULL | `` |
| 3 | `code_name` | `text` | NOT NULL | `` |
| 4 | `email` | `text` | NOT NULL | `` |
| 5 | `role` | `text` | NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'active'::text` |
| 7 | `slack_id` | `text` | NULL | `` |
| 8 | `is_admin` | `bool` | NOT NULL | `false` |
| 9 | `join_ym` | `text` | NULL | `` |
| 10 | `leave_ym` | `text` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `member_name` | `text` | NULL | `` |
| 14 | `member_address` | `text` | NULL | `` |
| 15 | `bank_info` | `text` | NULL | `` |
| 16 | `exclude_from_payout_notice` | `bool` | NOT NULL | `false` |
| 17 | `joined_at` | `date` | NULL | `` |
| 18 | `left_at` | `date` | NULL | `` |
| 19 | `slack_plan` | `text` | NULL | `` |
| 20 | `google_plan` | `text` | NULL | `` |
| 21 | `google_calendar_status` | `text` | NOT NULL | `'missing'::text` |
| 22 | `google_calendar_checked_at` | `timestamptz` | NULL | `` |
| 23 | `google_calendar_connected_at` | `timestamptz` | NULL | `` |
| 24 | `google_calendar_error` | `text` | NULL | `` |
| 25 | `last_login_at` | `timestamptz` | NULL | `` |
| 26 | `is_officer` | `bool` | NOT NULL | `false` |

## michinori_app_config

行数 (概算): -1
PRIMARY KEY: `key`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `key` | `text` | NOT NULL | `` |
| 2 | `value` | `bool` | NOT NULL | `` |
| 3 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## michinori_friendships

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(requester_id,addressee_id)` (constraint: `michinori_friendships_unique_pair`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `requester_id` | `uuid` | NOT NULL | `` |
| 3 | `addressee_id` | `uuid` | NOT NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'pending'::text` |
| 5 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 6 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## michinori_leaderboard_entries

行数 (概算): -1
PRIMARY KEY: `user_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `user_id` | `uuid` | NOT NULL | `` |
| 2 | `total_score` | `int4` | NOT NULL | `0` |
| 3 | `rank_label` | `text` | NOT NULL | `'旅人'::text` |
| 4 | `total_km` | `float8` | NOT NULL | `0` |
| 5 | `roads_conquered` | `int4` | NOT NULL | `0` |
| 6 | `roads_driven` | `int4` | NOT NULL | `0` |
| 7 | `prefectures_unlocked` | `int4` | NOT NULL | `0` |
| 8 | `quests_earned` | `int4` | NOT NULL | `0` |
| 9 | `home_prefecture` | `text` | NULL | `` |
| 10 | `display_name` | `text` | NULL | `` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## michinori_profiles

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(username)` (constraint: `michinori_profiles_username_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `` |
| 2 | `username` | `text` | NOT NULL | `` |
| 3 | `display_name` | `text` | NOT NULL | `` |
| 4 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 5 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## milestone_monthly_progress

行数 (概算): 270
PRIMARY KEY: `id`
UNIQUE: `(milestone_key,ym)` (constraint: `milestone_monthly_progress_milestone_key_ym_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `milestone_key` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `progress_pct` | `numeric` | NOT NULL | `0` |
| 5 | `consumed_pt` | `numeric` | NOT NULL | `0` |
| 6 | `source` | `text` | NULL | `` |
| 7 | `confirmed_at` | `timestamptz` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `note` | `text` | NULL | `` |

## milestone_responsibility

行数 (概算): 240
PRIMARY KEY: `id`
UNIQUE: `(milestone_id,member_id,role)` (constraint: `milestone_responsibility_ms_member_role_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `milestone_id` | `text` | NOT NULL | `` |
| 3 | `member_id` | `text` | NOT NULL | `` |
| 4 | `share` | `numeric` | NOT NULL | `0` |
| 5 | `role` | `text` | NOT NULL | `'担当'::text` |
| 6 | `task_description` | `text` | NULL | `` |

## milestone_sub_items

行数 (概算): 173
PRIMARY KEY: `id`
UNIQUE: `(sub_item_id)` (constraint: `milestone_sub_items_sub_item_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `sub_item_id` | `text` | NOT NULL | `` |
| 3 | `milestone_id` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `weight` | `numeric` | NULL | `1` |
| 6 | `status` | `text` | NULL | `'open'::text` |
| 7 | `assignee` | `text` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## monthly_report_revision_messages

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `revision_id` | `uuid` | NOT NULL | `` |
| 3 | `sender_kind` | `text` | NOT NULL | `` |
| 4 | `body` | `text` | NOT NULL | `` |
| 5 | `created_at` | `timestamptz` | NULL | `now()` |

## monthly_report_revisions

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `instruction` | `text` | NOT NULL | `` |
| 5 | `requested_by` | `text` | NULL | `` |
| 6 | `revised_content` | `text` | NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'pending'::text` |
| 8 | `created_at` | `timestamptz` | NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NULL | `now()` |

## monthly_reports

行数 (概算): 164
PRIMARY KEY: `id`
UNIQUE: `(project_id,ym)` (constraint: `monthly_reports_project_id_ym_key`)
UNIQUE: `(report_id)` (constraint: `monthly_reports_report_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `report_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `ym` | `text` | NOT NULL | `` |
| 5 | `draft_content` | `text` | NULL | `` |
| 6 | `final_content` | `text` | NULL | `` |
| 7 | `status` | `text` | NULL | `'pending'::text` |
| 8 | `collection_summary_json` | `jsonb` | NULL | `` |
| 9 | `generated_at` | `timestamptz` | NULL | `` |
| 10 | `fixed_at` | `timestamptz` | NULL | `` |
| 11 | `slide_file_id` | `text` | NULL | `` |
| 12 | `pdf_file_id` | `text` | NULL | `` |
| 13 | `last_cron_at` | `timestamptz` | NULL | `` |
| 14 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `section_members` | `text` | NULL | `` |
| 16 | `pl_review_requested_at` | `timestamptz` | NULL | `` |
| 17 | `pl_review_requested_by` | `text` | NULL | `` |
| 18 | `confirmed_by` | `text` | NULL | `` |

## monthly_reward_payout

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,ym,member_id)` (constraint: `monthly_reward_payout_project_id_ym_member_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `member_id` | `text` | NOT NULL | `` |
| 5 | `earned_pt` | `numeric` | NULL | `0` |
| 6 | `base_pay` | `numeric` | NULL | `0` |
| 7 | `bonus_pt` | `numeric` | NULL | `0` |
| 8 | `total_pay` | `numeric` | NULL | `0` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## ms_progress_proposals

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `member_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `milestone_id` | `text` | NOT NULL | `` |
| 5 | `ym` | `text` | NOT NULL | `` |
| 6 | `suggested_pct` | `numeric` | NULL | `` |
| 7 | `suggested_text` | `text` | NULL | `` |
| 8 | `status` | `text` | NOT NULL | `'pending'::text` |
| 9 | `reject_reason_raw` | `text` | NULL | `` |
| 10 | `reviewed_by` | `text` | NULL | `` |
| 11 | `reviewed_at` | `timestamptz` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NULL | `now()` |

## ms_progress_revisions

行数 (概算): 23
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `milestone_id` | `text` | NOT NULL | `` |
| 4 | `ym` | `text` | NOT NULL | `` |
| 5 | `current_pct` | `numeric` | NULL | `` |
| 6 | `current_note` | `text` | NULL | `` |
| 7 | `revised_pct` | `numeric` | NULL | `` |
| 8 | `revised_note` | `text` | NULL | `` |
| 9 | `status` | `text` | NOT NULL | `'pending'::text` |
| 10 | `requested_by` | `text` | NULL | `` |
| 11 | `confirmed_by` | `text` | NULL | `` |
| 12 | `confirmed_at` | `timestamptz` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NULL | `now()` |

## ms_proposal_messages

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `proposal_id` | `uuid` | NOT NULL | `` |
| 3 | `sender_kind` | `text` | NOT NULL | `` |
| 4 | `body` | `text` | NOT NULL | `` |
| 5 | `created_at` | `timestamptz` | NULL | `now()` |

## ms_revision_messages

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `revision_id` | `uuid` | NOT NULL | `` |
| 3 | `sender_kind` | `text` | NOT NULL | `` |
| 4 | `body` | `text` | NOT NULL | `` |
| 5 | `created_at` | `timestamptz` | NULL | `now()` |

## narrative_feedbacks

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `item_date` | `text` | NULL | `` |
| 4 | `item_title` | `text` | NULL | `` |
| 5 | `feedback` | `text` | NOT NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'open'::text` |
| 7 | `applied_note` | `text` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `applied_at` | `timestamptz` | NULL | `` |

## navigator_history

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(history_id)` (constraint: `navigator_history_history_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `history_id` | `text` | NOT NULL | `` |
| 3 | `item_id` | `text` | NOT NULL | `` |
| 4 | `action` | `text` | NOT NULL | `` |
| 5 | `changed_by` | `text` | NULL | `` |
| 6 | `changed_at` | `timestamptz` | NOT NULL | `now()` |

## navigator_items

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(item_id)` (constraint: `navigator_items_item_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `item_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `block_type` | `text` | NULL | `` |
| 5 | `content` | `text` | NULL | `` |
| 6 | `tags` | `text` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## observation_log

行数 (概算): 384
PRIMARY KEY: `id`
UNIQUE: `(lane,observed_at,observation_key,source)` (constraint: `observation_log_lane_observed_at_observation_key_source_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `lane` | `text` | NOT NULL | `` |
| 3 | `observed_at` | `date` | NOT NULL | `` |
| 4 | `observation_key` | `text` | NOT NULL | `` |
| 5 | `value` | `numeric` | NOT NULL | `` |
| 6 | `unit` | `text` | NULL | `` |
| 7 | `source` | `text` | NOT NULL | `` |
| 8 | `raw_meta` | `jsonb` | NULL | `` |
| 9 | `computed_at` | `timestamptz` | NOT NULL | `now()` |

## papers_log

行数 (概算): 128
PRIMARY KEY: `id`
UNIQUE: `(lane,observed_at)` (constraint: `papers_log_lane_observed_at_uq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `lane` | `text` | NOT NULL | `` |
| 3 | `observed_at` | `date` | NOT NULL | `` |
| 4 | `paper_count` | `int4` | NOT NULL | `` |
| 5 | `source` | `text` | NOT NULL | `` |
| 6 | `query_hash` | `text` | NULL | `` |
| 7 | `computed_at` | `timestamptz` | NOT NULL | `now()` |

## payout_agreement

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,member_id)` (constraint: `payout_agreement_project_id_member_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `member_id` | `text` | NOT NULL | `` |
| 4 | `agreed_at` | `timestamptz` | NULL | `` |
| 5 | `token` | `text` | NULL | `` |

## payout_notices

行数 (概算): -1
PRIMARY KEY: `member_id, ym`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `member_id` | `text` | NOT NULL | `` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `sent_at` | `timestamptz` | NULL | `` |
| 4 | `notice_no` | `text` | NULL | `` |
| 5 | `pdf_url` | `text` | NULL | `` |
| 6 | `total_yen` | `int4` | NULL | `` |

## progress_estimate_state

行数 (概算): 28
PRIMARY KEY: `project_id, ym`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `source_hash` | `text` | NOT NULL | `` |
| 4 | `saved_count` | `int4` | NOT NULL | `0` |
| 5 | `skipped_count` | `int4` | NOT NULL | `0` |
| 6 | `total_count` | `int4` | NOT NULL | `0` |
| 7 | `llm_model` | `text` | NULL | `` |
| 8 | `message` | `text` | NULL | `` |
| 9 | `last_processed_at` | `timestamptz` | NOT NULL | `now()` |

## project_config

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,key)` (constraint: `project_config_project_id_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `key` | `text` | NOT NULL | `` |
| 4 | `value` | `text` | NULL | `` |
| 5 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_events

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `occurred_on` | `date` | NOT NULL | `` |
| 4 | `kind` | `text` | NOT NULL | `` |
| 5 | `label` | `text` | NOT NULL | `` |
| 6 | `meta` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 7 | `source` | `text` | NOT NULL | `'manual'::text` |
| 8 | `created_by` | `text` | NULL | `` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_founding_members

行数 (概算): 94
PRIMARY KEY: `id`
UNIQUE: `(project_id,person_name)` (constraint: `project_founding_members_project_id_person_name_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `person_name` | `text` | NOT NULL | `` |
| 4 | `affiliation` | `text` | NULL | `` |
| 5 | `role` | `text` | NULL | `` |
| 6 | `role_label_jp` | `text` | NULL | `` |
| 7 | `category` | `text` | NOT NULL | `'unknown'::text` |
| 8 | `responsibility` | `text` | NULL | `` |
| 9 | `contribution` | `text` | NULL | `` |
| 10 | `notes` | `text` | NULL | `` |
| 11 | `status` | `text` | NOT NULL | `'active'::text` |
| 12 | `extracted_by` | `text` | NOT NULL | `'llm'::text` |
| 13 | `source_documents` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 14 | `first_observed_at` | `date` | NULL | `` |
| 15 | `last_observed_at` | `date` | NULL | `` |
| 16 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_freeze_periods

行数 (概算): -1
PRIMARY KEY: `period_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `period_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `freeze_from_ym` | `text` | NOT NULL | `` |
| 4 | `restart_ym` | `text` | NULL | `` |
| 5 | `status` | `text` | NOT NULL | `'active'::text` |
| 6 | `reason` | `text` | NULL | `` |
| 7 | `source` | `text` | NOT NULL | `'manual'::text` |
| 8 | `source_ref` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 9 | `created_by` | `text` | NOT NULL | `'codex'::text` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_graduation_signals

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,ym)` (constraint: `project_graduation_signals_ym_unique`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `readiness_score` | `numeric` | NOT NULL | `` |
| 5 | `signal_1_talker` | `numeric` | NULL | `` |
| 6 | `signal_2_events` | `numeric` | NULL | `` |
| 7 | `signal_3_reports` | `numeric` | NULL | `` |
| 8 | `signal_4_milestones` | `numeric` | NULL | `` |
| 9 | `signal_5_decisions` | `numeric` | NULL | `` |
| 10 | `signal_6_keywords` | `numeric` | NULL | `` |
| 11 | `inputs_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 12 | `evidence_text` | `text` | NULL | `` |
| 13 | `matched_keywords` | `_text` | NULL | `` |
| 14 | `computed_at` | `timestamptz` | NOT NULL | `now()` |

## project_knowledge

行数 (概算): 2,498
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `category` | `text` | NOT NULL | `` |
| 4 | `entity_name` | `text` | NOT NULL | `` |
| 5 | `fact_text` | `text` | NULL | `` |
| 6 | `confidence` | `text` | NULL | `'medium'::text` |
| 7 | `source` | `text` | NULL | `` |
| 8 | `status` | `text` | NULL | `'active'::text` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_meeting_summaries

行数 (概算): 122
PRIMARY KEY: `meeting_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `meeting_id` | `text` | NOT NULL | `` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `meeting_date` | `date` | NOT NULL | `` |
| 5 | `meeting_start_at` | `timestamptz` | NULL | `` |
| 6 | `title` | `text` | NOT NULL | `` |
| 7 | `notion_url` | `text` | NULL | `` |
| 8 | `calendar_event_id` | `text` | NULL | `` |
| 9 | `summary_short` | `text` | NOT NULL | `''::text` |
| 10 | `decided` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 11 | `progress` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 12 | `next_actions` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 13 | `risks` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 14 | `source_hash` | `text` | NULL | `` |
| 15 | `generated_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `generated_by_model` | `text` | NULL | `` |
| 17 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 19 | `notion_page_id` | `text` | NULL | `` |
| 20 | `gmail_thread_ids` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 21 | `source_kinds` | `text` | NULL | `` |
| 22 | `source_url` | `text` | NULL | `` |
| 23 | `narrative_md` | `text` | NULL | `` |

## project_members

行数 (概算): 28
PRIMARY KEY: `id`
UNIQUE: `(project_id,member_id)` (constraint: `project_members_project_id_member_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `member_id` | `text` | NOT NULL | `` |
| 4 | `role` | `text` | NULL | `` |
| 5 | `is_active` | `bool` | NOT NULL | `true` |
| 6 | `join_ym` | `text` | NULL | `` |
| 7 | `leave_ym` | `text` | NULL | `` |
| 8 | `is_pm` | `bool` | NOT NULL | `false` |
| 9 | `is_closer` | `bool` | NOT NULL | `false` |
| 10 | `role_label` | `text` | NULL | `` |
| 11 | `is_pl` | `bool` | NOT NULL | `false` |

## project_monthly_notes

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,ym)` (constraint: `project_monthly_notes_project_id_ym_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `body` | `text` | NOT NULL | `''::text` |
| 5 | `updated_by` | `text` | NULL | `` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_partners

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `partner_name` | `text` | NOT NULL | `` |
| 4 | `partner_type` | `text` | NOT NULL | `` |
| 5 | `partner_role` | `text` | NULL | `` |
| 6 | `sales_target_date` | `date` | NULL | `` |
| 7 | `remaining_conditions` | `text` | NULL | `` |
| 8 | `is_sold` | `bool` | NOT NULL | `false` |
| 9 | `sales_actuals` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 10 | `notes` | `text` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_pl_hearings

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `q_a` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 4 | `status` | `text` | NOT NULL | `'in_progress'::text` |
| 5 | `generated_pl` | `jsonb` | NULL | `` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_pl_monthly

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,ym)` (constraint: `project_pl_monthly_project_id_ym_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `revenue_yen` | `int8` | NOT NULL | `0` |
| 5 | `cogs_yen` | `int8` | NOT NULL | `0` |
| 6 | `personnel_yen` | `int8` | NOT NULL | `0` |
| 7 | `rd_yen` | `int8` | NOT NULL | `0` |
| 8 | `marketing_yen` | `int8` | NOT NULL | `0` |
| 9 | `other_opex_yen` | `int8` | NOT NULL | `0` |
| 10 | `notes` | `text` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_registry_diffs

行数 (概算): -1
PRIMARY KEY: `diff_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `diff_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NULL | `` |
| 4 | `scope_key` | `text` | NULL | `` |
| 5 | `diff_kind` | `text` | NOT NULL | `` |
| 6 | `target_table` | `text` | NOT NULL | `` |
| 7 | `target_key` | `text` | NULL | `` |
| 8 | `target_key_norm` | `text` | NULL | `` |
| 9 | `current_snapshot_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 10 | `proposed_patch_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 11 | `proposed_patch_hash` | `text` | NOT NULL | `` |
| 12 | `evidence_refs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 13 | `confidence` | `numeric` | NOT NULL | `0.5` |
| 14 | `status` | `text` | NOT NULL | `'pending'::text` |
| 15 | `review_comment` | `text` | NULL | `` |
| 16 | `created_by` | `text` | NOT NULL | `'automation'::text` |
| 17 | `reviewed_by` | `text` | NULL | `` |
| 18 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 19 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `reviewed_at` | `timestamptz` | NULL | `` |
| 21 | `applied_at` | `timestamptz` | NULL | `` |

## project_strategy_signals

行数 (概算): 80
PRIMARY KEY: `signal_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `signal_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NULL | `` |
| 4 | `scope_key` | `text` | NULL | `` |
| 5 | `signal_date` | `date` | NULL | `` |
| 6 | `signal_type` | `text` | NOT NULL | `` |
| 7 | `title` | `text` | NOT NULL | `` |
| 8 | `summary` | `text` | NOT NULL | `` |
| 9 | `impact_level` | `text` | NOT NULL | `'medium'::text` |
| 10 | `decision_state` | `text` | NOT NULL | `'observed'::text` |
| 11 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 12 | `source_refs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 13 | `source_hash` | `text` | NOT NULL | `` |
| 14 | `confidence` | `numeric` | NOT NULL | `0.5` |
| 15 | `extraction_run_id` | `text` | NULL | `` |
| 16 | `created_by` | `text` | NOT NULL | `'codex_automation'::text` |
| 17 | `confirmed_by` | `text` | NULL | `` |
| 18 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 19 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `confirmed_at` | `timestamptz` | NULL | `` |
| 21 | `polarity` | `text` | NULL | `` |
| 22 | `score_impact_summary` | `text` | NULL | `` |
| 23 | `score_impact_delta_json` | `jsonb` | NULL | `` |

## project_vc_relations

行数 (概算): 113
PRIMARY KEY: `id`
UNIQUE: `(project_id,vc_id)` (constraint: `project_vc_relations_project_id_vc_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `vc_id` | `uuid` | NOT NULL | `` |
| 4 | `vc_contact_id` | `uuid` | NULL | `` |
| 5 | `amd_owner_member_id` | `text` | NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'not_contacted'::text` |
| 7 | `first_contact_at` | `date` | NULL | `` |
| 8 | `last_touch_at` | `date` | NULL | `` |
| 9 | `expected_amount_jpy` | `int8` | NULL | `` |
| 10 | `notes` | `text` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_venture_members

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `full_name` | `text` | NOT NULL | `` |
| 4 | `role` | `text` | NOT NULL | `` |
| 5 | `started_at` | `date` | NULL | `` |
| 6 | `ended_at` | `date` | NULL | `` |
| 7 | `note` | `text` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `member_kind` | `text` | NOT NULL | `'su_internal'::text` |
| 11 | `amd_member_id` | `text` | NULL | `` |

## project_ventures

行数 (概算): 10
PRIMARY KEY: `project_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `lane` | `text` | NOT NULL | `` |
| 3 | `founded_at` | `date` | NULL | `` |
| 4 | `outcome_pattern` | `text` | NOT NULL | `` |
| 5 | `origin_org` | `text` | NULL | `` |
| 6 | `origin_pi` | `text` | NULL | `` |
| 7 | `amd_role` | `text` | NULL | `` |
| 8 | `short_description` | `text` | NULL | `` |
| 9 | `is_public` | `bool` | NOT NULL | `true` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `narrative_text` | `text` | NULL | `` |
| 13 | `narrative_generated_at` | `timestamptz` | NULL | `` |
| 14 | `narrative_invalidated_at` | `timestamptz` | NULL | `` |
| 15 | `display_name` | `text` | NOT NULL | `` |
| 16 | `short_label` | `text` | NULL | `` |
| 17 | `amd_support_started_at` | `date` | NULL | `` |
| 18 | `amd_support_ended_at` | `date` | NULL | `` |
| 19 | `long_description` | `text` | NULL | `` |
| 20 | `lanes` | `jsonb` | NULL | `` |
| 21 | `master_md_text` | `text` | NULL | `` |
| 22 | `master_md_slug` | `text` | NULL | `` |
| 23 | `master_md_updated_at` | `timestamptz` | NULL | `` |

## project_xrl_evidence

行数 (概算): 37
PRIMARY KEY: `evidence_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `evidence_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NULL | `` |
| 4 | `scope_key` | `text` | NULL | `` |
| 5 | `axis` | `text` | NOT NULL | `` |
| 6 | `evidence_kind` | `text` | NOT NULL | `` |
| 7 | `summary` | `text` | NOT NULL | `` |
| 8 | `structured_value_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 9 | `source_refs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 10 | `source_hash` | `text` | NOT NULL | `` |
| 11 | `confidence` | `numeric` | NOT NULL | `0.5` |
| 12 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 13 | `created_by` | `text` | NOT NULL | `'automation'::text` |
| 14 | `confirmed_by` | `text` | NULL | `` |
| 15 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `confirmed_at` | `timestamptz` | NULL | `` |

## project_xrl_log

行数 (概算): 49
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `observed_at` | `date` | NOT NULL | `` |
| 4 | `trl` | `int4` | NULL | `` |
| 5 | `brl` | `int4` | NULL | `` |
| 6 | `hrl` | `int4` | NULL | `` |
| 7 | `grl` | `int4` | NULL | `` |
| 8 | `srl` | `int4` | NULL | `` |
| 9 | `bottleneck` | `text` | NULL | `` |
| 10 | `milestone_label` | `text` | NULL | `` |
| 11 | `source_note` | `text` | NULL | `` |
| 12 | `source` | `text` | NOT NULL | `'manual'::text` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## projects

行数 (概算): 23
PRIMARY KEY: `id`
UNIQUE: `(project_id)` (constraint: `projects_project_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `project_name` | `text` | NOT NULL | `` |
| 4 | `client_name` | `text` | NULL | `` |
| 5 | `status` | `text` | NOT NULL | `'active'::text` |
| 6 | `slack_channel_id` | `text` | NULL | `` |
| 7 | `drive_folder_id` | `text` | NULL | `` |
| 8 | `freee_partner_id` | `text` | NULL | `` |
| 9 | `start_ym` | `text` | NULL | `` |
| 10 | `end_ym` | `text` | NULL | `` |
| 11 | `report_emails` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `project_type` | `text` | NOT NULL | `'standard'::text` |
| 15 | `fee_type` | `text` | NULL | `` |
| 16 | `fee_amount` | `numeric` | NULL | `` |
| 17 | `invoice_send_deadline_rule` | `text` | NULL | `` |
| 18 | `payment_due_rule` | `text` | NULL | `` |
| 19 | `invoice_send_manual` | `bool` | NOT NULL | `true` |
| 20 | `invoice_to_emails` | `text` | NULL | `` |
| 21 | `invoice_cc_emails` | `text` | NULL | `` |
| 22 | `invoice_bcc_emails` | `text` | NULL | `` |
| 23 | `payment_due_day` | `int4` | NULL | `` |
| 24 | `freeze_from_ym` | `text` | NULL | `` |
| 25 | `restart_expected_ym` | `text` | NULL | `` |
| 26 | `project_category` | `text` | NOT NULL | `'dtsu'::text` |

## protocol_examples

行数 (概算): 86
PRIMARY KEY: `id`
UNIQUE: `(protocol_id,project_id,occurred_on)` (constraint: `protocol_examples_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `protocol_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `occurred_on` | `date` | NULL | `` |
| 5 | `summary` | `text` | NOT NULL | `` |
| 6 | `branch_point` | `text` | NULL | `` |
| 7 | `criteria` | `text` | NULL | `` |
| 8 | `action_taken` | `text` | NULL | `` |
| 9 | `result` | `text` | NULL | `` |
| 10 | `source_meeting_id` | `text` | NULL | `` |
| 11 | `source_url` | `text` | NULL | `` |
| 12 | `llm_model` | `text` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## protocol_result_observations

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `protocol_id` | `text` | NOT NULL | `` |
| 3 | `protocol_example_id` | `uuid` | NULL | `` |
| 4 | `project_id` | `text` | NULL | `` |
| 5 | `observed_on` | `date` | NOT NULL | `` |
| 6 | `horizon` | `text` | NOT NULL | `'immediate'::text` |
| 7 | `valence` | `text` | NOT NULL | `'mixed'::text` |
| 8 | `confidence` | `text` | NOT NULL | `'medium'::text` |
| 9 | `summary` | `text` | NOT NULL | `` |
| 10 | `evidence_source_type` | `text` | NULL | `` |
| 11 | `evidence_source_id` | `text` | NULL | `` |
| 12 | `evidence_url` | `text` | NULL | `` |
| 13 | `created_by` | `text` | NULL | `` |
| 14 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## protocols

行数 (概算): 88
PRIMARY KEY: `id`
UNIQUE: `(protocol_id)` (constraint: `protocols_protocol_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `protocol_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `content` | `text` | NULL | `` |
| 6 | `status` | `text` | NULL | `'candidate'::text` |
| 7 | `importance` | `int4` | NULL | `1` |
| 8 | `source` | `text` | NULL | `'manual'::text` |
| 9 | `tags` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `is_universal` | `bool` | NOT NULL | `true` |
| 13 | `kind` | `text` | NOT NULL | `'pattern'::text` |

## reimbursements

行数 (概算): -1
PRIMARY KEY: `reimbursement_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `reimbursement_id` | `text` | NOT NULL | `` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `project_name` | `text` | NULL | `` |
| 4 | `date` | `text` | NOT NULL | `` |
| 5 | `category` | `text` | NOT NULL | `` |
| 6 | `amount` | `numeric` | NOT NULL | `0` |
| 7 | `tax_rate` | `numeric` | NOT NULL | `0.1` |
| 8 | `description` | `text` | NULL | `` |
| 9 | `transport_mode` | `text` | NULL | `` |
| 10 | `transport_from` | `text` | NULL | `` |
| 11 | `transport_to` | `text` | NULL | `` |
| 12 | `transport_trip` | `text` | NULL | `` |
| 13 | `status` | `text` | NOT NULL | `'submitted'::text` |
| 14 | `created_by` | `text` | NOT NULL | `` |
| 15 | `pm_approved_by` | `text` | NULL | `` |
| 16 | `pm_approved_at` | `text` | NULL | `` |
| 17 | `admin_approved_by` | `text` | NULL | `` |
| 18 | `admin_approved_at` | `text` | NULL | `` |
| 19 | `created_at` | `timestamptz` | NULL | `now()` |
| 20 | `updated_at` | `timestamptz` | NULL | `now()` |
| 21 | `billed_ym` | `text` | NULL | `` |
| 22 | `receipt_storage_paths` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 23 | `receipt_file_names` | `jsonb` | NOT NULL | `'[]'::jsonb` |

## seed_contact_log

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `contacted_on` | `date` | NOT NULL | `` |
| 4 | `method` | `text` | NULL | `` |
| 5 | `amd_member_id` | `text` | NULL | `` |
| 6 | `note` | `text` | NOT NULL | `` |
| 7 | `next_action` | `text` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## seed_funding

行数 (概算): 133
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `program` | `text` | NOT NULL | `` |
| 4 | `program_short` | `text` | NULL | `` |
| 5 | `amount_jpy` | `int8` | NULL | `` |
| 6 | `fiscal_year` | `int4` | NULL | `` |
| 7 | `status` | `text` | NULL | `` |
| 8 | `source_url` | `text` | NULL | `` |
| 9 | `notes` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## seed_news

行数 (概算): 144
PRIMARY KEY: `id`
UNIQUE: `(seed_id,source_url)` (constraint: `seed_news_seed_id_source_url_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `kind` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `body` | `text` | NULL | `` |
| 6 | `occurred_on` | `date` | NULL | `` |
| 7 | `source_url` | `text` | NULL | `` |
| 8 | `ingested_by` | `text` | NOT NULL | `'manual'::text` |
| 9 | `verified` | `bool` | NOT NULL | `true` |
| 10 | `dismissed` | `bool` | NOT NULL | `false` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## seeds

行数 (概算): 142
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `title` | `text` | NOT NULL | `` |
| 3 | `summary` | `text` | NULL | `` |
| 4 | `org_name` | `text` | NOT NULL | `` |
| 5 | `org_type` | `text` | NULL | `` |
| 6 | `org_region` | `text` | NULL | `` |
| 7 | `org_url` | `text` | NULL | `` |
| 8 | `researcher_name` | `text` | NULL | `` |
| 9 | `researcher_title` | `text` | NULL | `` |
| 10 | `lab_name` | `text` | NULL | `` |
| 11 | `researcher_url` | `text` | NULL | `` |
| 12 | `domain_lane` | `text` | NULL | `` |
| 13 | `industry_target` | `_text` | NULL | `` |
| 14 | `keywords` | `_text` | NULL | `` |
| 15 | `trl` | `int2` | NULL | `` |
| 16 | `brl` | `int2` | NULL | `` |
| 17 | `hrl` | `int2` | NULL | `` |
| 18 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 19 | `amd_rating` | `int2` | NULL | `` |
| 20 | `amd_rating_note` | `text` | NULL | `` |
| 21 | `amd_owner_member_id` | `text` | NULL | `` |
| 22 | `next_action` | `text` | NULL | `` |
| 23 | `internal_notes` | `text` | NULL | `` |
| 24 | `public_summary` | `text` | NULL | `` |
| 25 | `is_public` | `bool` | NOT NULL | `false` |
| 26 | `spun_off_project_id` | `text` | NULL | `` |
| 27 | `source` | `text` | NULL | `` |
| 28 | `source_detail` | `text` | NULL | `` |
| 29 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 30 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 31 | `created_by` | `text` | NULL | `` |
| 32 | `updated_by` | `text` | NULL | `` |
| 33 | `discovery_status` | `text` | NOT NULL | `'reviewed'::text` |

## settings

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(key)` (constraint: `settings_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `key` | `text` | NOT NULL | `` |
| 3 | `value` | `text` | NULL | `` |
| 4 | `updated_by` | `text` | NULL | `` |
| 5 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## source_cache

行数 (概算): 3,573
PRIMARY KEY: `id`
UNIQUE: `(cache_id)` (constraint: `source_cache_cache_id_key`)
UNIQUE: `(project_id,source,item_id)` (constraint: `source_cache_project_id_source_item_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `cache_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `ym` | `text` | NOT NULL | `` |
| 5 | `source` | `text` | NOT NULL | `` |
| 6 | `item_id` | `text` | NOT NULL | `` |
| 7 | `title` | `text` | NULL | `` |
| 8 | `item_date` | `timestamptz` | NULL | `` |
| 9 | `content_text` | `text` | NULL | `` |
| 10 | `char_count` | `int4` | NULL | `0` |
| 11 | `metadata_json` | `jsonb` | NULL | `` |
| 12 | `collected_at` | `timestamptz` | NOT NULL | `now()` |

## tasks

行数 (概算): 13
PRIMARY KEY: `id`
UNIQUE: `(task_id)` (constraint: `tasks_task_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `task_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `description` | `text` | NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'todo'::text` |
| 7 | `assignee` | `text` | NULL | `` |
| 8 | `priority` | `text` | NULL | `` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## triple_helix_loading

行数 (概算): -1
PRIMARY KEY: `observation`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `observation` | `text` | NOT NULL | `` |
| 2 | `mu_a` | `float4` | NOT NULL | `` |
| 3 | `mu_i` | `float4` | NOT NULL | `` |
| 4 | `mu_g` | `float4` | NOT NULL | `` |
| 5 | `description` | `text` | NULL | `` |
| 6 | `unit` | `text` | NULL | `` |
| 7 | `data_source` | `text` | NULL | `` |
| 8 | `available` | `bool` | NOT NULL | `false` |
| 9 | `display_order` | `int4` | NOT NULL | `` |
| 10 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## triple_helix_state_log

行数 (概算): 128
PRIMARY KEY: `id`
UNIQUE: `(lane,observed_at)` (constraint: `triple_helix_state_log_lane_observed_at_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `lane` | `text` | NOT NULL | `` |
| 3 | `observed_at` | `date` | NOT NULL | `` |
| 4 | `mu_a` | `numeric` | NOT NULL | `` |
| 5 | `mu_i` | `numeric` | NOT NULL | `` |
| 6 | `mu_g` | `numeric` | NOT NULL | `` |
| 7 | `sigma_su` | `numeric` | NOT NULL | `` |
| 8 | `model` | `text` | NULL | `` |
| 9 | `raw_meta` | `jsonb` | NULL | `` |
| 10 | `computed_at` | `timestamptz` | NOT NULL | `now()` |

## tsukuyomi_chat_logs

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NULL | `` |
| 3 | `session_id` | `uuid` | NOT NULL | `` |
| 4 | `page_path` | `text` | NULL | `` |
| 5 | `role` | `text` | NOT NULL | `` |
| 6 | `content` | `text` | NOT NULL | `` |
| 7 | `applied_actions` | `jsonb` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## tsukuyomi_context

行数 (概算): 61
PRIMARY KEY: `id`
UNIQUE: `(context_id)` (constraint: `tsukuyomi_context_context_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `context_id` | `text` | NOT NULL | `` |
| 3 | `tags` | `text` | NOT NULL | `` |
| 4 | `priority` | `int4` | NULL | `0` |
| 5 | `system_prompt` | `text` | NOT NULL | `` |
| 6 | `status` | `text` | NULL | `'active'::text` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## tsukuyomi_learnings

行数 (概算): 51
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `scope` | `text` | NOT NULL | `` |
| 3 | `scope_key` | `text` | NULL | `` |
| 4 | `content` | `text` | NOT NULL | `` |
| 5 | `source` | `text` | NULL | `` |
| 6 | `source_ref` | `text` | NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'active'::text` |
| 8 | `created_at` | `timestamptz` | NULL | `now()` |
| 9 | `created_by` | `text` | NULL | `` |
| 10 | `removed_at` | `timestamptz` | NULL | `` |
| 11 | `removed_by` | `text` | NULL | `` |
| 12 | `removed_reason` | `text` | NULL | `` |

## tsukuyomi_learnings_status

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `scope` | `text` | NOT NULL | `` |
| 3 | `target_project_id` | `text` | NULL | `` |
| 4 | `lesson_text` | `text` | NOT NULL | `` |
| 5 | `source_feedback_id` | `uuid` | NULL | `` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## tsukuyomi_memory

行数 (概算): 45
PRIMARY KEY: `id`
UNIQUE: `(memory_id)` (constraint: `tsukuyomi_memory_memory_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `memory_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NULL | `` |
| 4 | `content` | `text` | NOT NULL | `` |
| 5 | `source` | `text` | NULL | `'slack_conversation'::text` |
| 6 | `status` | `text` | NULL | `'active'::text` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## tsukuyomi_nudge_queue

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(nudge_id)` (constraint: `tsukuyomi_nudge_queue_nudge_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `nudge_id` | `text` | NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `ym` | `text` | NOT NULL | `` |
| 5 | `message` | `text` | NOT NULL | `` |
| 6 | `status` | `text` | NULL | `'ready'::text` |
| 7 | `posted_at` | `timestamptz` | NULL | `` |
| 8 | `error_note` | `text` | NULL | `` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## tsukuyomi_sessions

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(session_id)` (constraint: `tsukuyomi_sessions_session_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `session_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NULL | `` |
| 4 | `member_id` | `text` | NULL | `` |
| 5 | `started_at` | `timestamptz` | NOT NULL | `now()` |

## tsukuyomi_usage_log

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `session_id` | `uuid` | NULL | `` |
| 3 | `member_id` | `text` | NULL | `` |
| 4 | `model` | `text` | NOT NULL | `` |
| 5 | `input_tokens` | `int4` | NOT NULL | `0` |
| 6 | `output_tokens` | `int4` | NOT NULL | `0` |
| 7 | `cache_read_tokens` | `int4` | NOT NULL | `0` |
| 8 | `cache_write_tokens` | `int4` | NOT NULL | `0` |
| 9 | `cost_usd` | `numeric` | NOT NULL | `0` |
| 10 | `cost_jpy` | `numeric` | NOT NULL | `0` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## value_milestones

行数 (概算): 155
PRIMARY KEY: `id`
UNIQUE: `(milestone_id)` (constraint: `value_milestones_milestone_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `milestone_id` | `text` | NOT NULL | `` |
| 3 | `plan_cycle_id` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `points` | `int4` | NOT NULL | `0` |
| 6 | `tag` | `text` | NOT NULL | `'normal'::text` |
| 7 | `goal_level` | `text` | NULL | `` |
| 8 | `is_active` | `bool` | NOT NULL | `true` |
| 9 | `success_criteria` | `text` | NULL | `` |
| 10 | `sort_order` | `int4` | NOT NULL | `0` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `period_start_ym` | `text` | NULL | `` |
| 13 | `target_ym` | `text` | NULL | `` |

## value_plan_cycles

行数 (概算): 10
PRIMARY KEY: `id`
UNIQUE: `(plan_cycle_id)` (constraint: `value_plan_cycles_plan_cycle_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `plan_cycle_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'active'::text` |
| 5 | `budget_yen` | `int4` | NOT NULL | `0` |
| 6 | `total_points` | `int4` | NOT NULL | `0` |
| 7 | `period_start_ym` | `text` | NOT NULL | `` |
| 8 | `period_end_ym` | `text` | NOT NULL | `` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## vc_contacts

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `vc_id` | `uuid` | NOT NULL | `` |
| 3 | `name` | `text` | NOT NULL | `` |
| 4 | `name_en` | `text` | NULL | `` |
| 5 | `role` | `text` | NULL | `` |
| 6 | `email` | `text` | NULL | `` |
| 7 | `phone` | `text` | NULL | `` |
| 8 | `linkedin` | `text` | NULL | `` |
| 9 | `notes` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## vc_funds

行数 (概算): 41
PRIMARY KEY: `id`
UNIQUE: `(vc_id,fund_no)` (constraint: `vc_funds_vc_id_fund_no_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `vc_id` | `uuid` | NOT NULL | `` |
| 3 | `fund_no` | `int4` | NOT NULL | `` |
| 4 | `name` | `text` | NULL | `` |
| 5 | `size_jpy` | `int8` | NULL | `` |
| 6 | `size_jpy_low` | `int8` | NULL | `` |
| 7 | `size_jpy_high` | `int8` | NULL | `` |
| 8 | `vintage_year` | `int4` | NULL | `` |
| 9 | `status` | `text` | NOT NULL | `'unknown'::text` |
| 10 | `first_close_at` | `date` | NULL | `` |
| 11 | `final_close_at` | `date` | NULL | `` |
| 12 | `target_close_at` | `date` | NULL | `` |
| 13 | `dry_powder_jpy_low` | `int8` | NULL | `` |
| 14 | `dry_powder_jpy_high` | `int8` | NULL | `` |
| 15 | `dry_powder_source` | `text` | NULL | `` |
| 16 | `dry_powder_heard_from` | `uuid` | NULL | `` |
| 17 | `dry_powder_note` | `text` | NULL | `` |
| 18 | `dry_powder_updated_at` | `timestamptz` | NULL | `` |
| 19 | `source_url` | `text` | NULL | `` |
| 20 | `notes` | `text` | NULL | `` |
| 21 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## vc_investments

行数 (概算): 117
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `vc_id` | `uuid` | NOT NULL | `` |
| 3 | `fund_id` | `uuid` | NULL | `` |
| 4 | `target_company` | `text` | NOT NULL | `` |
| 5 | `target_company_en` | `text` | NULL | `` |
| 6 | `our_project_id` | `text` | NULL | `` |
| 7 | `amount_jpy` | `int8` | NULL | `` |
| 8 | `round` | `text` | NULL | `` |
| 9 | `invested_at` | `date` | NULL | `` |
| 10 | `is_lead` | `bool` | NOT NULL | `false` |
| 11 | `source_url` | `text` | NULL | `` |
| 12 | `notes` | `text` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## vc_news

行数 (概算): 41
PRIMARY KEY: `id`
UNIQUE: `(vc_id,source_url)` (constraint: `vc_news_vc_id_source_url_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `vc_id` | `uuid` | NOT NULL | `` |
| 3 | `kind` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `body` | `text` | NULL | `` |
| 6 | `occurred_on` | `date` | NULL | `` |
| 7 | `source_url` | `text` | NULL | `` |
| 8 | `ingested_by` | `text` | NOT NULL | `'manual'::text` |
| 9 | `verified` | `bool` | NOT NULL | `false` |
| 10 | `dismissed` | `bool` | NOT NULL | `false` |
| 11 | `related_fund_id` | `uuid` | NULL | `` |
| 12 | `suggested_fund_patch` | `jsonb` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## vcs

行数 (概算): 157
PRIMARY KEY: `id`
UNIQUE: `(name)` (constraint: `vcs_name_key`)
UNIQUE: `(slug)` (constraint: `vcs_slug_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `name` | `text` | NOT NULL | `` |
| 3 | `name_en` | `text` | NULL | `` |
| 4 | `slug` | `text` | NULL | `` |
| 5 | `type` | `text` | NULL | `` |
| 6 | `thesis` | `text` | NULL | `` |
| 7 | `stage_focus` | `_text` | NULL | `` |
| 8 | `ticket_min_jpy` | `int8` | NULL | `` |
| 9 | `ticket_max_jpy` | `int8` | NULL | `` |
| 10 | `hq` | `text` | NULL | `` |
| 11 | `website` | `text` | NULL | `` |
| 12 | `logo_url` | `text` | NULL | `` |
| 13 | `notes` | `text` | NULL | `` |
| 14 | `amd_rating` | `int2` | NULL | `` |
| 15 | `amd_rating_note` | `text` | NULL | `` |
| 16 | `amd_rating_updated_by` | `text` | NULL | `` |
| 17 | `amd_rating_updated_at` | `timestamptz` | NULL | `` |
| 18 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 19 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `investment_constraints` | `text` | NULL | `` |

## xrl_feedbacks

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `xrl_log_id` | `uuid` | NULL | `` |
| 4 | `axis` | `text` | NULL | `` |
| 5 | `feedback` | `text` | NOT NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'open'::text` |
| 7 | `applied_at` | `timestamptz` | NULL | `` |
| 8 | `applied_note` | `text` | NULL | `` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |
