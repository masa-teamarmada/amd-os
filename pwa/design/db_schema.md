# DB Schema Reference — AMD OS Supabase

> ⚠️ **このファイルは自動生成。手動で編集しないこと。**

> 生成: `cd pwa && python3 -X utf8 scripts/dump_schema.py`  最終生成: 2026-08-31 15:33 JST


## ⛔ 列名は想像で書かない

`member_activities` の列名を `code_name`/`created_at`/`activity_text`/`kind` と想像で書いてバグった事故 (BUGS.md `[GAS] member_knowledge 抽出で「きよ」に他人の活動が紐付くカオス` 参照)。新規 cron / API / Edge Function 実装時は **必ずこの md を grep して列名を確認** してから select / filter / insert を書くこと。

## 索引

[`action_items`](#action-items) / [`amd_deck_comments`](#amd-deck-comments) / [`amd_deck_participants`](#amd-deck-participants) / [`amd_deck_reactions`](#amd-deck-reactions) / [`amd_management_score_evidence`](#amd-management-score-evidence) / [`amd_management_score_raw_signals`](#amd-management-score-raw-signals) / [`amd_management_score_snapshots`](#amd-management-score-snapshots) / [`amd_management_score_source_runs`](#amd-management-score-source-runs) / [`amd_score_alpha`](#amd-score-alpha) / [`amd_score_alpha_proposals`](#amd-score-alpha-proposals) / [`amd_score_inputs`](#amd-score-inputs) / [`amd_score_revisions`](#amd-score-revisions) / [`app_notifications`](#app-notifications) / [`atlas_decisions`](#atlas-decisions) / [`atlas_divergences`](#atlas-divergences) / [`atlas_edges`](#atlas-edges) / [`atlas_nodes`](#atlas-nodes) / [`atlas_observations`](#atlas-observations) / [`atlas_reports`](#atlas-reports) / [`atlas_signals`](#atlas-signals) / [`atlas_stories`](#atlas-stories) / [`atlas_story_merges`](#atlas-story-merges) / [`atlas_story_themes`](#atlas-story-themes) / [`atlas_themes`](#atlas-themes) / [`billing_cycles`](#billing-cycles) / [`billing_log`](#billing-log) / [`business_card_project_links`](#business-card-project-links) / [`business_cards`](#business-cards) / [`bzm_2_1_action_evaluations`](#bzm-2-1-action-evaluations) / [`bzm_2_1_actions`](#bzm-2-1-actions) / [`bzm_2_1_cashflow_events`](#bzm-2-1-cashflow-events) / [`bzm_2_1_decision_states`](#bzm-2-1-decision-states) / [`bzm_2_1_input_observations`](#bzm-2-1-input-observations) / [`bzm_2_1_interventions`](#bzm-2-1-interventions) / [`bzm_2_1_model_revisions`](#bzm-2-1-model-revisions) / [`bzm_2_1_policy_evaluations`](#bzm-2-1-policy-evaluations) / [`bzm_2_1_transitions`](#bzm-2-1-transitions) / [`bzm_2_model_revisions`](#bzm-2-model-revisions) / [`bzm_2_parameter_observations`](#bzm-2-parameter-observations) / [`bzm_theory_edges`](#bzm-theory-edges) / [`bzm_theory_node_memos`](#bzm-theory-node-memos) / [`bzm_theory_nodes`](#bzm-theory-nodes) / [`calendar_feed_events`](#calendar-feed-events) / [`calendar_feed_sources`](#calendar-feed-sources) / [`company_actual_monthly`](#company-actual-monthly) / [`company_budget_actual_monthly`](#company-budget-actual-monthly) / [`company_budget_inputs`](#company-budget-inputs) / [`company_budget_monthly`](#company-budget-monthly) / [`company_budget_simulation_runs`](#company-budget-simulation-runs) / [`company_budget_variance_notes`](#company-budget-variance-notes) / [`company_finance_receipt_events`](#company-finance-receipt-events) / [`company_finance_recurring_items`](#company-finance-recurring-items) / [`company_history_events`](#company-history-events) / [`company_longrange_targets`](#company-longrange-targets) / [`company_management_signal_reviews`](#company-management-signal-reviews) / [`company_operating_facts`](#company-operating-facts) / [`company_payment_obligation_notifications`](#company-payment-obligation-notifications) / [`company_payment_obligations`](#company-payment-obligations) / [`company_profile_entries`](#company-profile-entries) / [`company_schedule_actions`](#company-schedule-actions) / [`company_schedule_notifications`](#company-schedule-notifications) / [`company_schedule_occurrences`](#company-schedule-occurrences) / [`company_schedule_rule_checks`](#company-schedule-rule-checks) / [`contract_documents`](#contract-documents) / [`contract_nudges`](#contract-nudges) / [`contract_signals`](#contract-signals) / [`contract_terms`](#contract-terms) / [`contracts`](#contracts) / [`eimi_slack_usage_log`](#eimi-slack-usage-log) / [`freee_oauth_tokens`](#freee-oauth-tokens) / [`freee_reconciliation_actions`](#freee-reconciliation-actions) / [`freee_reconciliation_findings`](#freee-reconciliation-findings) / [`freee_reconciliation_runs`](#freee-reconciliation-runs) / [`freeze_period_backfills`](#freeze-period-backfills) / [`guardrail_cards`](#guardrail-cards) / [`guardrail_feedbacks`](#guardrail-feedbacks) / [`guardrail_matches`](#guardrail-matches) / [`guardrail_tag_definitions`](#guardrail-tag-definitions) / [`institution_assessments`](#institution-assessments) / [`institution_capability_axes`](#institution-capability-axes) / [`institution_capability_criteria`](#institution-capability-criteria) / [`institution_policy_assessments`](#institution-policy-assessments) / [`institution_policy_items`](#institution-policy-items) / [`institution_projects`](#institution-projects) / [`institution_regulation_cells`](#institution-regulation-cells) / [`institution_regulation_types`](#institution-regulation-types) / [`institution_regulation_versions`](#institution-regulation-versions) / [`institution_regulations`](#institution-regulations) / [`institution_workspace_memberships`](#institution-workspace-memberships) / [`institution_workspace_project_scopes`](#institution-workspace-project-scopes) / [`institution_workspace_seed_scopes`](#institution-workspace-seed-scopes) / [`institution_workspaces`](#institution-workspaces) / [`institutions`](#institutions) / [`issues`](#issues) / [`jp_culture_items`](#jp-culture-items) / [`killer_factor_catalog`](#killer-factor-catalog) / [`knowledge_sessions`](#knowledge-sessions) / [`l2_coverage_gaps`](#l2-coverage-gaps) / [`l2_extract_state`](#l2-extract-state) / [`l2_feedbacks`](#l2-feedbacks) / [`l2_notifications`](#l2-notifications) / [`lane_suggestions`](#lane-suggestions) / [`legacy_reward_payout_amount_override_events`](#legacy-reward-payout-amount-override-events) / [`llm_model_config`](#llm-model-config) / [`llm_prompt_revisions`](#llm-prompt-revisions) / [`llm_prompts`](#llm-prompts) / [`macro_index_log`](#macro-index-log) / [`macro_lane_weights`](#macro-lane-weights) / [`management_knowledge_entries`](#management-knowledge-entries) / [`media_assets`](#media-assets) / [`meeting_action_items`](#meeting-action-items) / [`meeting_assets`](#meeting-assets) / [`meeting_notifications`](#meeting-notifications) / [`member_activities`](#member-activities) / [`member_app_notifications`](#member-app-notifications) / [`member_bank_transfer_aliases`](#member-bank-transfer-aliases) / [`member_google_oauth_tokens`](#member-google-oauth-tokens) / [`member_knowledge`](#member-knowledge) / [`member_microsoft_oauth_tokens`](#member-microsoft-oauth-tokens) / [`member_monthly_work_agreement_amount_change_reasons`](#member-monthly-work-agreement-amount-change-reasons) / [`member_monthly_work_agreement_payout_overrides`](#member-monthly-work-agreement-payout-overrides) / [`member_monthly_work_agreement_requests`](#member-monthly-work-agreement-requests) / [`member_monthly_work_agreements`](#member-monthly-work-agreements) / [`member_ms_activities`](#member-ms-activities) / [`member_payout_settlements`](#member-payout-settlements) / [`member_profiles`](#member-profiles) / [`member_weekly_tasks`](#member-weekly-tasks) / [`members`](#members) / [`michinori_app_config`](#michinori-app-config) / [`michinori_friendships`](#michinori-friendships) / [`michinori_leaderboard_entries`](#michinori-leaderboard-entries) / [`michinori_profiles`](#michinori-profiles) / [`microsoft_oauth_states`](#microsoft-oauth-states) / [`milestone_change_events`](#milestone-change-events) / [`milestone_monthly_contribution_allocations`](#milestone-monthly-contribution-allocations) / [`milestone_monthly_progress`](#milestone-monthly-progress) / [`milestone_responsibility`](#milestone-responsibility) / [`milestone_sub_items`](#milestone-sub-items) / [`monthly_report_edit_history`](#monthly-report-edit-history) / [`monthly_report_revision_messages`](#monthly-report-revision-messages) / [`monthly_report_revisions`](#monthly-report-revisions) / [`monthly_reports`](#monthly-reports) / [`monthly_reports_external`](#monthly-reports-external) / [`monthly_reward_payout`](#monthly-reward-payout) / [`ms_progress_proposals`](#ms-progress-proposals) / [`ms_progress_revisions`](#ms-progress-revisions) / [`ms_proposal_messages`](#ms-proposal-messages) / [`ms_revision_messages`](#ms-revision-messages) / [`narrative_feedbacks`](#narrative-feedbacks) / [`navigator_history`](#navigator-history) / [`navigator_items`](#navigator-items) / [`observation_log`](#observation-log) / [`papers_log`](#papers-log) / [`payout_agreement`](#payout-agreement) / [`payout_notices`](#payout-notices) / [`poc_companies`](#poc-companies) / [`poc_matches`](#poc-matches) / [`private_wiki_entries`](#private-wiki-entries) / [`proactive_loop_events`](#proactive-loop-events) / [`proactive_loops`](#proactive-loops) / [`proactive_outbox`](#proactive-outbox) / [`proactive_todos`](#proactive-todos) / [`progress_estimate_state`](#progress-estimate-state) / [`project_access_memberships`](#project-access-memberships) / [`project_bzm_2_2_acquisitions`](#project-bzm-2-2-acquisitions) / [`project_capital_plan_versions`](#project-capital-plan-versions) / [`project_capital_plans`](#project-capital-plans) / [`project_commander_threads`](#project-commander-threads) / [`project_company_profiles`](#project-company-profiles) / [`project_config`](#project-config) / [`project_convertible_instruments`](#project-convertible-instruments) / [`project_cost_assumptions`](#project-cost-assumptions) / [`project_cost_items`](#project-cost-items) / [`project_cost_models`](#project-cost-models) / [`project_cost_notes`](#project-cost-notes) / [`project_cost_questions`](#project-cost-questions) / [`project_documents`](#project-documents) / [`project_equity_entries`](#project-equity-entries) / [`project_equity_transactions`](#project-equity-transactions) / [`project_events`](#project-events) / [`project_financial_periods`](#project-financial-periods) / [`project_founding_members`](#project-founding-members) / [`project_freeze_periods`](#project-freeze-periods) / [`project_graduation_signals`](#project-graduation-signals) / [`project_grants`](#project-grants) / [`project_important_documents`](#project-important-documents) / [`project_important_evidence`](#project-important-evidence) / [`project_ip_assets`](#project-ip-assets) / [`project_ip_deadlines`](#project-ip-deadlines) / [`project_ip_events`](#project-ip-events) / [`project_ip_rights`](#project-ip-rights) / [`project_killer_factor_states`](#project-killer-factor-states) / [`project_knowledge`](#project-knowledge) / [`project_management_action_items`](#project-management-action-items) / [`project_management_capacity`](#project-management-capacity) / [`project_management_decisions`](#project-management-decisions) / [`project_management_evidence`](#project-management-evidence) / [`project_management_field_audit`](#project-management-field-audit) / [`project_management_funding_snapshots`](#project-management-funding-snapshots) / [`project_management_hypotheses`](#project-management-hypotheses) / [`project_management_issue_discussions`](#project-management-issue-discussions) / [`project_management_issues`](#project-management-issues) / [`project_management_kpis`](#project-management-kpis) / [`project_management_milestone_dependencies`](#project-management-milestone-dependencies) / [`project_management_milestone_issue_links`](#project-management-milestone-issue-links) / [`project_management_milestone_kpis`](#project-management-milestone-kpis) / [`project_management_milestone_partner_links`](#project-management-milestone-partner-links) / [`project_management_milestones`](#project-management-milestones) / [`project_management_objectives`](#project-management-objectives) / [`project_management_organization_roles`](#project-management-organization-roles) / [`project_management_outcomes`](#project-management-outcomes) / [`project_management_partner_commitments`](#project-management-partner-commitments) / [`project_management_partner_interactions`](#project-management-partner-interactions) / [`project_management_partner_roles`](#project-management-partner-roles) / [`project_management_partner_samples`](#project-management-partner-samples) / [`project_management_partner_tracks`](#project-management-partner-tracks) / [`project_management_partner_work_items`](#project-management-partner-work-items) / [`project_management_partners`](#project-management-partners) / [`project_management_raci`](#project-management-raci) / [`project_management_schedule_dependencies`](#project-management-schedule-dependencies) / [`project_management_tasks`](#project-management-tasks) / [`project_management_technical_tests`](#project-management-technical-tests) / [`project_management_track_value_milestones`](#project-management-track-value-milestones) / [`project_management_tracks`](#project-management-tracks) / [`project_management_update_history`](#project-management-update-history) / [`project_management_validation_runs`](#project-management-validation-runs) / [`project_media_mentions`](#project-media-mentions) / [`project_meeting_summaries`](#project-meeting-summaries) / [`project_members`](#project-members) / [`project_monthly_cashflow`](#project-monthly-cashflow) / [`project_monthly_notes`](#project-monthly-notes) / [`project_org_observations`](#project-org-observations) / [`project_organization_parties`](#project-organization-parties) / [`project_partners`](#project-partners) / [`project_pl_hearings`](#project-pl-hearings) / [`project_pl_monthly`](#project-pl-monthly) / [`project_principal_grants`](#project-principal-grants) / [`project_publication_audiences`](#project-publication-audiences) / [`project_publication_items`](#project-publication-items) / [`project_publication_revisions`](#project-publication-revisions) / [`project_registry_diffs`](#project-registry-diffs) / [`project_shareholder_meetings`](#project-shareholder-meetings) / [`project_shareholders`](#project-shareholders) / [`project_strategy_signals`](#project-strategy-signals) / [`project_tech_entries`](#project-tech-entries) / [`project_tech_topics`](#project-tech-topics) / [`project_valuation_rounds`](#project-valuation-rounds) / [`project_vc_relations`](#project-vc-relations) / [`project_venture_members`](#project-venture-members) / [`project_ventures`](#project-ventures) / [`project_weekly_effort_entries`](#project-weekly-effort-entries) / [`project_xrl_evidence`](#project-xrl-evidence) / [`project_xrl_log`](#project-xrl-log) / [`projects`](#projects) / [`protocol_examples`](#protocol-examples) / [`protocol_result_observations`](#protocol-result-observations) / [`protocols`](#protocols) / [`reimbursements`](#reimbursements) / [`reward_member_liability_offsets`](#reward-member-liability-offsets) / [`seed_bzm30_inputs`](#seed-bzm30-inputs) / [`seed_bzm30_scores`](#seed-bzm30-scores) / [`seed_bzm30_sensitivity`](#seed-bzm30-sensitivity) / [`seed_contact_log`](#seed-contact-log) / [`seed_funding`](#seed-funding) / [`seed_news`](#seed-news) / [`seed_projects`](#seed-projects) / [`seed_screening_bands`](#seed-screening-bands) / [`seed_sps_assessments`](#seed-sps-assessments) / [`seed_status_transitions`](#seed-status-transitions) / [`seed_value_ceilings`](#seed-value-ceilings) / [`seeds`](#seeds) / [`settings`](#settings) / [`source_cache`](#source-cache) / [`sps_initial_assessment_candidates`](#sps-initial-assessment-candidates) / [`sps_legacy_archives`](#sps-legacy-archives) / [`sps_model_versions`](#sps-model-versions) / [`sps_primary_model_registry`](#sps-primary-model-registry) / [`sps_reassessment_candidates`](#sps-reassessment-candidates) / [`sps_reassessment_source_events`](#sps-reassessment-source-events) / [`tally_project_syncs`](#tally-project-syncs) / [`tally_weekly_effort_entries`](#tally-weekly-effort-entries) / [`tasks`](#tasks) / [`textbook_insight_candidates`](#textbook-insight-candidates) / [`triple_helix_loading`](#triple-helix-loading) / [`triple_helix_state_log`](#triple-helix-state-log) / [`tsukuyomi_chat_logs`](#tsukuyomi-chat-logs) / [`tsukuyomi_context`](#tsukuyomi-context) / [`tsukuyomi_learnings`](#tsukuyomi-learnings) / [`tsukuyomi_learnings_status`](#tsukuyomi-learnings-status) / [`tsukuyomi_memory`](#tsukuyomi-memory) / [`tsukuyomi_nudge_queue`](#tsukuyomi-nudge-queue) / [`tsukuyomi_sessions`](#tsukuyomi-sessions) / [`tsukuyomi_usage_log`](#tsukuyomi-usage-log) / [`value_milestones`](#value-milestones) / [`value_plan_cycles`](#value-plan-cycles) / [`vc_contacts`](#vc-contacts) / [`vc_funds`](#vc-funds) / [`vc_investments`](#vc-investments) / [`vc_news`](#vc-news) / [`vcs`](#vcs) / [`workspace_access_audit_logs`](#workspace-access-audit-logs) / [`workspace_control_audit_logs`](#workspace-control-audit-logs) / [`workspace_document_assets`](#workspace-document-assets) / [`workspace_document_decks`](#workspace-document-decks) / [`workspace_document_revisions`](#workspace-document-revisions) / [`workspace_documents`](#workspace-documents) / [`workspace_email_otp_rate_limits`](#workspace-email-otp-rate-limits) / [`workspace_organization_memberships`](#workspace-organization-memberships) / [`workspace_organizations`](#workspace-organizations) / [`workspace_principals`](#workspace-principals) / [`workspace_user_accounts`](#workspace-user-accounts) / [`workspace_work_case_deadlines`](#workspace-work-case-deadlines) / [`workspace_work_cases`](#workspace-work-cases) / [`xrl_feedbacks`](#xrl-feedbacks)

---

## action_items

行数 (概算): 32
PRIMARY KEY: `action_id`
UNIQUE: `(source_hash)` (constraint: `action_items_source_hash_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `action_id` | `text` | NOT NULL | `` |
| 2 | `project_id` | `text` | NULL | `` |
| 3 | `scope` | `text` | NOT NULL | `'project'::text` |
| 4 | `category` | `text` | NULL | `` |
| 5 | `title` | `text` | NOT NULL | `` |
| 6 | `summary` | `text` | NULL | `` |
| 7 | `due_at` | `timestamptz` | NULL | `` |
| 8 | `status` | `text` | NOT NULL | `'open'::text` |
| 9 | `priority` | `text` | NULL | `` |
| 10 | `action_url` | `text` | NULL | `` |
| 11 | `assignee_member_id` | `text` | NULL | `` |
| 12 | `source` | `text` | NULL | `` |
| 13 | `source_ref` | `text` | NULL | `` |
| 14 | `source_hash` | `text` | NULL | `` |
| 15 | `detected_at` | `timestamptz` | NULL | `now()` |
| 16 | `responded_at` | `timestamptz` | NULL | `` |
| 17 | `response_note` | `text` | NULL | `` |
| 18 | `scheduled_nudge_at` | `timestamptz` | NULL | `` |
| 19 | `last_nudged_at` | `timestamptz` | NULL | `` |
| 20 | `review_status` | `text` | NULL | `'candidate'::text` |
| 21 | `metadata_json` | `jsonb` | NULL | `` |
| 22 | `created_by` | `text` | NULL | `` |
| 23 | `updated_by` | `text` | NULL | `` |
| 24 | `created_at` | `timestamptz` | NULL | `now()` |
| 25 | `updated_at` | `timestamptz` | NULL | `now()` |

## amd_deck_comments

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `document_id` | `text` | NOT NULL | `` |
| 3 | `anchor_id` | `text` | NOT NULL | `` |
| 4 | `participant_id` | `uuid` | NOT NULL | `` |
| 5 | `parent_comment_id` | `uuid` | NULL | `` |
| 6 | `body` | `text` | NOT NULL | `` |
| 7 | `quote_text` | `text` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## amd_deck_participants

行数 (概算): 3
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `document_id` | `text` | NOT NULL | `` |
| 3 | `name` | `text` | NOT NULL | `` |
| 4 | `email` | `text` | NOT NULL | `` |
| 5 | `session_token_hash` | `text` | NOT NULL | `` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `last_seen_at` | `timestamptz` | NOT NULL | `now()` |

## amd_deck_reactions

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(comment_id,participant_id,reaction_type)` (constraint: `amd_deck_reactions_comment_id_participant_id_reaction_type_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `document_id` | `text` | NOT NULL | `` |
| 3 | `comment_id` | `uuid` | NOT NULL | `` |
| 4 | `participant_id` | `uuid` | NOT NULL | `` |
| 5 | `reaction_type` | `text` | NOT NULL | `` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## amd_management_score_evidence

行数 (概算): 244
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

行数 (概算): 2,546
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

行数 (概算): 8
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

行数 (概算): 146
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

行数 (概算): 103
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
| 27 | `xrl_checklist` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 28 | `frl_cap` | `float4` | NULL | `` |
| 29 | `frl_cap_amd` | `float4` | NULL | `` |
| 30 | `frl_cap_notes` | `text` | NULL | `` |
| 31 | `frl_ces_a` | `float4` | NULL | `` |
| 32 | `frl_ces_rho` | `float4` | NULL | `` |
| 33 | `prs_potential` | `float4` | NULL | `` |
| 34 | `prs_r_net` | `float4` | NULL | `` |

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

行数 (概算): 147
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
| 14 | `native_notified_at` | `timestamptz` | NULL | `` |
| 15 | `attention_state` | `text` | NOT NULL | `'pending'::text` |
| 16 | `attention_type` | `text` | NULL | `` |
| 17 | `attention_owner` | `text` | NOT NULL | `'none'::text` |
| 18 | `requires_masa_decision` | `bool` | NOT NULL | `false` |
| 19 | `attention_reason` | `text` | NULL | `` |
| 20 | `attention_action` | `text` | NULL | `` |
| 21 | `attention_effect` | `text` | NULL | `` |
| 22 | `attention_confidence` | `numeric` | NULL | `` |
| 23 | `attention_source_hash` | `text` | NULL | `` |
| 24 | `attention_reviewed_at` | `timestamptz` | NULL | `` |
| 25 | `attention_reviewed_by` | `text` | NULL | `` |

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

行数 (概算): 1,066
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

行数 (概算): 308
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

行数 (概算): 210
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
| 38 | `extra_revenue_json` | `jsonb` | NULL | `` |
| 39 | `contract_source_term_id` | `uuid` | NULL | `` |
| 40 | `extra_budget_yen` | `int4` | NULL | `` |
| 41 | `invoice_issue_claim_id` | `uuid` | NULL | `` |
| 42 | `invoice_issue_claimed_at` | `timestamptz` | NULL | `` |
| 43 | `invoice_issue_claimed_by` | `text` | NULL | `` |

## billing_log

行数 (概算): 52
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

## business_card_project_links

行数 (概算): -1
PRIMARY KEY: `business_card_id, project_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `business_card_id` | `uuid` | NOT NULL | `` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `project_knowledge_id` | `uuid` | NULL | `` |
| 4 | `created_by_email` | `text` | NOT NULL | `` |
| 5 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 6 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## business_cards

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `full_name` | `text` | NULL | `` |
| 3 | `full_name_kana` | `text` | NULL | `` |
| 4 | `company_name` | `text` | NULL | `` |
| 5 | `department` | `text` | NULL | `` |
| 6 | `job_title` | `text` | NULL | `` |
| 7 | `email` | `text` | NULL | `` |
| 8 | `normalized_email` | `text` | NULL | `` |
| 9 | `phone` | `text` | NULL | `` |
| 10 | `mobile` | `text` | NULL | `` |
| 11 | `normalized_phone` | `text` | NULL | `` |
| 12 | `postal_code` | `text` | NULL | `` |
| 13 | `address` | `text` | NULL | `` |
| 14 | `website` | `text` | NULL | `` |
| 15 | `relationship_note` | `text` | NULL | `` |
| 16 | `met_on` | `date` | NULL | `` |
| 17 | `raw_ocr_text` | `text` | NULL | `` |
| 18 | `field_confidence` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 19 | `ocr_confidence` | `numeric` | NULL | `` |
| 20 | `ocr_model` | `text` | NULL | `` |
| 21 | `ocr_prompt_key` | `text` | NOT NULL | `'business_card.ocr'::text` |
| 22 | `ocr_error` | `text` | NULL | `` |
| 23 | `status` | `text` | NOT NULL | `'processing'::text` |
| 24 | `storage_bucket` | `text` | NOT NULL | `'business-cards'::text` |
| 25 | `storage_path` | `text` | NOT NULL | `` |
| 26 | `original_file_name` | `text` | NULL | `` |
| 27 | `mime_type` | `text` | NOT NULL | `` |
| 28 | `file_size_bytes` | `int8` | NOT NULL | `0` |
| 29 | `image_sha256` | `text` | NULL | `` |
| 30 | `captured_at` | `timestamptz` | NOT NULL | `now()` |
| 31 | `created_by_user_id` | `uuid` | NULL | `` |
| 32 | `created_by_email` | `text` | NOT NULL | `` |
| 33 | `confirmed_by_email` | `text` | NULL | `` |
| 34 | `confirmed_at` | `timestamptz` | NULL | `` |
| 35 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 36 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 37 | `updated_by_email` | `text` | NULL | `` |

## bzm_2_1_action_evaluations

行数 (概算): 72
PRIMARY KEY: `action_evaluation_id`
UNIQUE: `(action_id,objective_kind)` (constraint: `bzm_2_1_action_evaluations_action_objective_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `action_evaluation_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `action_id` | `uuid` | NOT NULL | `` |
| 3 | `objective_kind` | `text` | NOT NULL | `` |
| 4 | `selection_objective` | `text` | NULL | `` |
| 5 | `is_selected` | `bool` | NOT NULL | `false` |
| 6 | `exclusion_reason` | `text` | NULL | `` |
| 7 | `evaluation_status` | `text` | NOT NULL | `` |
| 8 | `goal_probability` | `float8` | NULL | `` |
| 9 | `plan_deadline_goal_probability` | `float8` | NULL | `` |
| 10 | `conditional_goal_value` | `float8` | NULL | `` |
| 11 | `value_unit` | `text` | NULL | `` |
| 12 | `expected_cumulative_funding_million_jpy` | `float8` | NULL | `` |
| 13 | `expected_failure_loss_million_jpy` | `float8` | NULL | `` |
| 14 | `expected_exit_value_million_jpy` | `float8` | NULL | `` |
| 15 | `expected_terminal_value_million_jpy` | `float8` | NULL | `` |
| 16 | `expected_cost_million_jpy` | `float8` | NULL | `` |
| 17 | `expected_benefit_million_jpy` | `float8` | NULL | `` |
| 18 | `expected_net_value` | `float8` | NULL | `` |
| 19 | `public_aggregation_status` | `text` | NOT NULL | `'not_applicable'::text` |
| 20 | `public_fiscal_value_million_jpy` | `float8` | NULL | `` |
| 21 | `public_social_components_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 22 | `public_social_monetized_value_million_jpy` | `float8` | NULL | `` |
| 23 | `public_aggregated_value_million_jpy` | `float8` | NULL | `` |
| 24 | `public_aggregation_input_hash` | `text` | NULL | `` |
| 25 | `uncertainty_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 26 | `issues_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 27 | `missing_inputs` | `_text` | NOT NULL | `'{}'::text[]` |
| 28 | `engine_version` | `text` | NULL | `` |
| 29 | `input_hash` | `text` | NULL | `` |
| 30 | `information_cutoff` | `timestamptz` | NOT NULL | `` |
| 31 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_2_1_actions

行数 (概算): -1
PRIMARY KEY: `action_id`
UNIQUE: `(state_id,action_key)` (constraint: `bzm_2_1_actions_state_key_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `action_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `state_id` | `uuid` | NOT NULL | `` |
| 3 | `action_key` | `text` | NOT NULL | `` |
| 4 | `bundle_id` | `text` | NOT NULL | `` |
| 5 | `action_type` | `text` | NOT NULL | `` |
| 6 | `component_types` | `_text` | NOT NULL | `` |
| 7 | `custom_components` | `_text` | NOT NULL | `'{}'::text[]` |
| 8 | `sequence_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 9 | `shared_resources_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 10 | `label` | `text` | NOT NULL | `` |
| 11 | `action_order` | `int4` | NOT NULL | `100` |
| 12 | `availability_status` | `text` | NOT NULL | `` |
| 13 | `availability_reason` | `text` | NULL | `` |
| 14 | `feasibility_gate_json` | `jsonb` | NOT NULL | `` |
| 15 | `authority_gate_json` | `jsonb` | NOT NULL | `` |
| 16 | `consents_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 17 | `financing_feasibility_json` | `jsonb` | NOT NULL | `` |
| 18 | `duration_months` | `float8` | NULL | `` |
| 19 | `immediate_cost_by_objective_json` | `jsonb` | NOT NULL | `` |
| 20 | `immediate_benefit_by_objective_json` | `jsonb` | NOT NULL | `` |
| 21 | `required_funding_million_jpy` | `float8` | NULL | `` |
| 22 | `cashflow_event_keys` | `_text` | NOT NULL | `'{}'::text[]` |
| 23 | `information_gain_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 24 | `evidence_json` | `jsonb` | NOT NULL | `` |
| 25 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_2_1_cashflow_events

行数 (概算): 156
PRIMARY KEY: `cashflow_event_id`
UNIQUE: `(revision_id,event_key)` (constraint: `bzm_2_1_cashflow_events_revision_key_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `cashflow_event_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `revision_id` | `uuid` | NOT NULL | `` |
| 3 | `state_id` | `uuid` | NULL | `` |
| 4 | `action_id` | `uuid` | NULL | `` |
| 5 | `transition_id` | `uuid` | NULL | `` |
| 6 | `event_key` | `text` | NOT NULL | `` |
| 7 | `economic_nature` | `text` | NOT NULL | `` |
| 8 | `economic_event_group_key` | `text` | NULL | `` |
| 9 | `perspective_leg` | `text` | NULL | `` |
| 10 | `label` | `text` | NOT NULL | `` |
| 11 | `owner_kind` | `text` | NOT NULL | `` |
| 12 | `owner_ref` | `text` | NOT NULL | `` |
| 13 | `counterparty_kind` | `text` | NOT NULL | `` |
| 14 | `counterparty_ref` | `text` | NOT NULL | `` |
| 15 | `scope_kind` | `text` | NOT NULL | `` |
| 16 | `scope_key` | `text` | NOT NULL | `` |
| 17 | `timing_kind` | `text` | NOT NULL | `` |
| 18 | `timing_months` | `float8` | NULL | `` |
| 19 | `amount` | `numeric` | NULL | `` |
| 20 | `currency` | `text` | NOT NULL | `'JPY'::text` |
| 21 | `model_amount_million_jpy` | `float8` | NULL | `` |
| 22 | `conversion_rule_ref` | `text` | NULL | `` |
| 23 | `conversion_rate_to_jpy` | `numeric` | NULL | `` |
| 24 | `conversion_rate_date` | `date` | NULL | `` |
| 25 | `conversion_rate_source_ref` | `text` | NULL | `` |
| 26 | `value_status` | `text` | NOT NULL | `` |
| 27 | `nominal_or_real` | `text` | NOT NULL | `` |
| 28 | `price_base_date` | `date` | NULL | `` |
| 29 | `tax_treatment` | `text` | NOT NULL | `` |
| 30 | `tax_subject_ref` | `text` | NULL | `` |
| 31 | `evidence_kind` | `text` | NOT NULL | `` |
| 32 | `evidence_ref` | `text` | NULL | `` |
| 33 | `information_cutoff` | `timestamptz` | NOT NULL | `` |
| 34 | `included_in` | `text` | NOT NULL | `` |
| 35 | `perspective_attribution_json` | `jsonb` | NOT NULL | `` |
| 36 | `public_aggregation_status` | `text` | NOT NULL | `'not_computable'::text` |
| 37 | `public_fiscal_amount_million_jpy` | `float8` | NULL | `` |
| 38 | `public_social_benefit_vector_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 39 | `public_social_converted_amount_million_jpy` | `float8` | NULL | `` |
| 40 | `public_aggregated_amount_million_jpy` | `float8` | NULL | `` |
| 41 | `public_aggregation_input_hash` | `text` | NULL | `` |
| 42 | `public_transfer_treatment` | `text` | NOT NULL | `'not_applicable'::text` |
| 43 | `public_transfer_deduplication_ref` | `text` | NULL | `` |
| 44 | `semantic_duplicate_review_ref` | `text` | NULL | `` |
| 45 | `condition_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 46 | `note` | `text` | NULL | `` |
| 47 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_2_1_decision_states

行数 (概算): -1
PRIMARY KEY: `state_id`
UNIQUE: `(revision_id,state_key)` (constraint: `bzm_2_1_decision_states_revision_key_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `state_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `revision_id` | `uuid` | NOT NULL | `` |
| 3 | `state_key` | `text` | NOT NULL | `` |
| 4 | `label` | `text` | NOT NULL | `` |
| 5 | `decision_order` | `int4` | NOT NULL | `100` |
| 6 | `is_initial` | `bool` | NOT NULL | `false` |
| 7 | `elapsed_months` | `float8` | NULL | `` |
| 8 | `current_state_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 9 | `beliefs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 10 | `reachability_history_json` | `jsonb` | NOT NULL | `` |
| 11 | `decision_controller_json` | `jsonb` | NOT NULL | `` |
| 12 | `sunk_cost_million_jpy` | `float8` | NULL | `` |
| 13 | `remaining_cost_million_jpy` | `float8` | NULL | `` |
| 14 | `remaining_time_months` | `float8` | NULL | `` |
| 15 | `available_information_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 16 | `evidence_json` | `jsonb` | NOT NULL | `` |
| 17 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_2_1_input_observations

行数 (概算): 1,212
PRIMARY KEY: `observation_id`
UNIQUE: `(revision_id,scope_kind,scope_key,parameter_key)` (constraint: `bzm_2_1_input_observations_scope_key_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `observation_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `revision_id` | `uuid` | NOT NULL | `` |
| 3 | `scope_kind` | `text` | NOT NULL | `` |
| 4 | `scope_key` | `text` | NOT NULL | `` |
| 5 | `parameter_key` | `text` | NOT NULL | `` |
| 6 | `symbol` | `text` | NOT NULL | `` |
| 7 | `label` | `text` | NOT NULL | `` |
| 8 | `value_json` | `jsonb` | NULL | `` |
| 9 | `display_value` | `text` | NOT NULL | `` |
| 10 | `value_status` | `text` | NOT NULL | `` |
| 11 | `unit` | `text` | NULL | `` |
| 12 | `evidence_kind` | `text` | NOT NULL | `` |
| 13 | `evidence_ref` | `text` | NULL | `` |
| 14 | `information_cutoff` | `timestamptz` | NOT NULL | `` |
| 15 | `condition_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 16 | `note` | `text` | NULL | `` |
| 17 | `sort_order` | `int4` | NOT NULL | `100` |
| 18 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_2_1_interventions

行数 (概算): -1
PRIMARY KEY: `intervention_id`
UNIQUE: `(revision_id,intervention_key)` (constraint: `bzm_2_1_interventions_revision_key_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `intervention_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `revision_id` | `uuid` | NOT NULL | `` |
| 3 | `intervention_key` | `text` | NOT NULL | `` |
| 4 | `label` | `text` | NOT NULL | `` |
| 5 | `enabled` | `bool` | NOT NULL | `false` |
| 6 | `effects_json` | `jsonb` | NOT NULL | `` |
| 7 | `evidence_json` | `jsonb` | NOT NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_2_1_model_revisions

行数 (概算): -1
PRIMARY KEY: `revision_id`
UNIQUE: `(project_id,revision_id)` (constraint: `bzm_2_1_model_revisions_project_id_revision_id_uniq`)
UNIQUE: `(project_id,revision_key)` (constraint: `bzm_2_1_model_revisions_project_key_uniq`)
UNIQUE: `(project_id,revision_order)` (constraint: `bzm_2_1_model_revisions_project_order_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `revision_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `revision_key` | `text` | NOT NULL | `` |
| 4 | `revision_order` | `int4` | NOT NULL | `` |
| 5 | `theory_version` | `text` | NOT NULL | `` |
| 6 | `model_version` | `text` | NOT NULL | `` |
| 7 | `data_mode` | `text` | NOT NULL | `'project'::text` |
| 8 | `currency` | `text` | NOT NULL | `'JPY'::text` |
| 9 | `valuation_date` | `date` | NULL | `` |
| 10 | `initial_state_key` | `text` | NULL | `` |
| 11 | `plan_deadline_months` | `float8` | NULL | `` |
| 12 | `evaluation_horizon_months` | `float8` | NULL | `` |
| 13 | `discount_rate_by_objective_json` | `jsonb` | NULL | `` |
| 14 | `valuation_rule_by_objective_json` | `jsonb` | NULL | `` |
| 15 | `decision_criterion_by_objective_json` | `jsonb` | NULL | `` |
| 16 | `tie_break_rule_json` | `jsonb` | NULL | `` |
| 17 | `uncertainty_rule_json` | `jsonb` | NULL | `` |
| 18 | `public_fiscal_rule_ref` | `text` | NULL | `` |
| 19 | `public_social_mandate_ref` | `text` | NULL | `` |
| 20 | `public_social_conversion_rule_ref` | `text` | NULL | `` |
| 21 | `public_aggregation_rule_ref` | `text` | NULL | `` |
| 22 | `baseline_policy_id` | `text` | NULL | `` |
| 23 | `baseline_policy_json` | `jsonb` | NULL | `` |
| 24 | `policy_definition_ref` | `text` | NULL | `` |
| 25 | `measurement_status` | `text` | NOT NULL | `` |
| 26 | `information_cutoff` | `timestamptz` | NOT NULL | `` |
| 27 | `forward_validation_count` | `int4` | NOT NULL | `0` |
| 28 | `revision_reason` | `text` | NOT NULL | `` |
| 29 | `source_ref` | `text` | NOT NULL | `` |
| 30 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_2_1_policy_evaluations

行数 (概算): 72
PRIMARY KEY: `policy_evaluation_id`
UNIQUE: `(revision_id,objective_kind,policy_kind)` (constraint: `bzm_2_1_policy_evaluations_revision_view_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `policy_evaluation_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `revision_id` | `uuid` | NOT NULL | `` |
| 3 | `objective_kind` | `text` | NOT NULL | `` |
| 4 | `policy_kind` | `text` | NOT NULL | `` |
| 5 | `selection_objective` | `text` | NULL | `` |
| 6 | `evaluation_status` | `text` | NOT NULL | `` |
| 7 | `action_coverage_status` | `text` | NOT NULL | `` |
| 8 | `goal_probability` | `float8` | NULL | `` |
| 9 | `plan_deadline_goal_probability` | `float8` | NULL | `` |
| 10 | `conditional_goal_value` | `float8` | NULL | `` |
| 11 | `expected_net_value` | `float8` | NULL | `` |
| 12 | `value_difference_from_baseline` | `float8` | NULL | `` |
| 13 | `controller_option_value` | `float8` | NULL | `` |
| 14 | `value_unit` | `text` | NULL | `` |
| 15 | `expected_cumulative_funding_million_jpy` | `float8` | NULL | `` |
| 16 | `expected_failure_loss_million_jpy` | `float8` | NULL | `` |
| 17 | `expected_exit_value_million_jpy` | `float8` | NULL | `` |
| 18 | `expected_terminal_value_million_jpy` | `float8` | NULL | `` |
| 19 | `expected_cost_million_jpy` | `float8` | NULL | `` |
| 20 | `expected_benefit_million_jpy` | `float8` | NULL | `` |
| 21 | `public_aggregation_status` | `text` | NOT NULL | `'not_applicable'::text` |
| 22 | `public_fiscal_value_million_jpy` | `float8` | NULL | `` |
| 23 | `public_social_components_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 24 | `public_social_monetized_value_million_jpy` | `float8` | NULL | `` |
| 25 | `public_aggregated_value_million_jpy` | `float8` | NULL | `` |
| 26 | `public_aggregation_input_hash` | `text` | NULL | `` |
| 27 | `controller_by_state_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 28 | `selected_action_by_state_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 29 | `state_decisions_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 30 | `uncertainty_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 31 | `issues_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 32 | `missing_inputs` | `_text` | NOT NULL | `'{}'::text[]` |
| 33 | `engine_version` | `text` | NULL | `` |
| 34 | `input_hash` | `text` | NULL | `` |
| 35 | `information_cutoff` | `timestamptz` | NOT NULL | `` |
| 36 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_2_1_transitions

行数 (概算): -1
PRIMARY KEY: `transition_id`
UNIQUE: `(action_id,transition_key)` (constraint: `bzm_2_1_transitions_action_key_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `transition_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `action_id` | `uuid` | NOT NULL | `` |
| 3 | `transition_key` | `text` | NOT NULL | `` |
| 4 | `label` | `text` | NOT NULL | `` |
| 5 | `next_state_id` | `uuid` | NULL | `` |
| 6 | `terminal_outcome` | `text` | NULL | `` |
| 7 | `probability` | `float8` | NULL | `` |
| 8 | `goal_reached_at_months` | `float8` | NULL | `` |
| 9 | `slack_lost_at_months` | `float8` | NULL | `` |
| 10 | `transition_cash_flow_by_objective_json` | `jsonb` | NOT NULL | `` |
| 11 | `terminal_value_by_objective_json` | `jsonb` | NOT NULL | `` |
| 12 | `failure_loss_by_objective_json` | `jsonb` | NOT NULL | `` |
| 13 | `cashflow_event_keys` | `_text` | NOT NULL | `'{}'::text[]` |
| 14 | `evidence_json` | `jsonb` | NOT NULL | `` |
| 15 | `transition_order` | `int4` | NOT NULL | `100` |
| 16 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_2_model_revisions

行数 (概算): 51
PRIMARY KEY: `revision_id`
UNIQUE: `(project_id,revision_key)` (constraint: `bzm_2_model_revisions_project_key_uniq`)
UNIQUE: `(project_id,revision_order)` (constraint: `bzm_2_model_revisions_project_order_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `revision_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `revision_key` | `text` | NOT NULL | `` |
| 4 | `revision_order` | `int4` | NOT NULL | `` |
| 5 | `theory_version` | `text` | NOT NULL | `` |
| 6 | `model_version` | `text` | NOT NULL | `` |
| 7 | `measurement_status` | `text` | NOT NULL | `` |
| 8 | `information_cutoff` | `timestamptz` | NOT NULL | `` |
| 9 | `forward_validation_count` | `int4` | NOT NULL | `0` |
| 10 | `revision_reason` | `text` | NOT NULL | `` |
| 11 | `source_ref` | `text` | NOT NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_2_parameter_observations

行数 (概算): 302
PRIMARY KEY: `observation_id`
UNIQUE: `(revision_id,parameter_key)` (constraint: `bzm_2_parameter_observations_revision_key_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `observation_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `revision_id` | `uuid` | NOT NULL | `` |
| 3 | `parameter_key` | `text` | NOT NULL | `` |
| 4 | `symbol` | `text` | NOT NULL | `` |
| 5 | `label` | `text` | NOT NULL | `` |
| 6 | `parameter_group` | `text` | NOT NULL | `` |
| 7 | `value_json` | `jsonb` | NULL | `` |
| 8 | `display_value` | `text` | NOT NULL | `` |
| 9 | `value_status` | `text` | NOT NULL | `` |
| 10 | `unit` | `text` | NULL | `` |
| 11 | `evidence_kind` | `text` | NOT NULL | `` |
| 12 | `evidence_ref` | `text` | NULL | `` |
| 13 | `affects` | `_text` | NOT NULL | `'{}'::text[]` |
| 14 | `condition_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 15 | `note` | `text` | NULL | `` |
| 16 | `sort_order` | `int4` | NOT NULL | `100` |
| 17 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_theory_edges

行数 (概算): 0
PRIMARY KEY: `id`
UNIQUE: `(from_node_id,relation_type,to_node_id)` (constraint: `bzm_theory_edges_from_node_id_relation_type_to_node_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `from_node_id` | `text` | NOT NULL | `` |
| 3 | `to_node_id` | `text` | NOT NULL | `` |
| 4 | `relation_type` | `text` | NOT NULL | `` |
| 5 | `note` | `text` | NULL | `` |
| 6 | `created_by` | `text` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_theory_node_memos

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `node_id` | `text` | NOT NULL | `` |
| 3 | `memo_type` | `text` | NOT NULL | `` |
| 4 | `body` | `text` | NOT NULL | `` |
| 5 | `created_by` | `text` | NULL | `` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## bzm_theory_nodes

行数 (概算): 2
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `text` | NOT NULL | `` |
| 2 | `title` | `text` | NOT NULL | `` |
| 3 | `kind` | `text` | NOT NULL | `` |
| 4 | `layer` | `text` | NOT NULL | `` |
| 5 | `status` | `text` | NOT NULL | `` |
| 6 | `summary` | `text` | NOT NULL | `` |
| 7 | `body_md` | `text` | NOT NULL | `''::text` |
| 8 | `source_ref` | `text` | NULL | `` |
| 9 | `origin` | `text` | NOT NULL | `'editor'::text` |
| 10 | `created_by` | `text` | NULL | `` |
| 11 | `updated_by` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `archived_at` | `timestamptz` | NULL | `` |
| 15 | `position_x` | `float8` | NULL | `` |
| 16 | `position_y` | `float8` | NULL | `` |

## calendar_feed_events

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(source_id,event_uid)` (constraint: `calendar_feed_events_source_id_event_uid_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `source_id` | `uuid` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `event_uid` | `text` | NOT NULL | `` |
| 5 | `summary` | `text` | NOT NULL | `` |
| 6 | `location` | `text` | NULL | `` |
| 7 | `starts_at` | `timestamptz` | NULL | `` |
| 8 | `ends_at` | `timestamptz` | NULL | `` |
| 9 | `is_all_day` | `bool` | NOT NULL | `false` |
| 10 | `ics_status` | `text` | NULL | `` |
| 11 | `linked_milestone_id` | `uuid` | NULL | `` |
| 12 | `link_state` | `text` | NOT NULL | `'unlinked'::text` |
| 13 | `link_confidence` | `text` | NOT NULL | `'unknown'::text` |
| 14 | `first_seen_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `last_seen_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `disappeared_at` | `timestamptz` | NULL | `` |
| 17 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## calendar_feed_sources

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,feed_url)` (constraint: `calendar_feed_sources_project_id_feed_url_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `owner_label` | `text` | NOT NULL | `` |
| 4 | `feed_url` | `text` | NOT NULL | `` |
| 5 | `provider` | `text` | NOT NULL | `'outlook_published_ics'::text` |
| 6 | `visibility_level` | `text` | NOT NULL | `'title_location'::text` |
| 7 | `status` | `text` | NOT NULL | `'active'::text` |
| 8 | `consent_note` | `text` | NULL | `` |
| 9 | `last_fetched_at` | `timestamptz` | NULL | `` |
| 10 | `last_fetch_status` | `text` | NULL | `` |
| 11 | `last_event_count` | `int4` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_actual_monthly

行数 (概算): 159
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

行数 (概算): 975
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

行数 (概算): 27
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

## company_history_events

行数 (概算): 98
PRIMARY KEY: `event_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `event_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `occurred_on` | `date` | NULL | `` |
| 3 | `title` | `text` | NOT NULL | `` |
| 4 | `summary` | `text` | NULL | `` |
| 5 | `event_type` | `text` | NOT NULL | `'company'::text` |
| 6 | `project_id` | `text` | NULL | `` |
| 7 | `member_ids` | `_text` | NOT NULL | `'{}'::text[]` |
| 8 | `importance` | `text` | NOT NULL | `'medium'::text` |
| 9 | `visibility` | `text` | NOT NULL | `'admin_only'::text` |
| 10 | `status` | `text` | NOT NULL | `'imported'::text` |
| 11 | `source_confidence` | `numeric` | NOT NULL | `0.50` |
| 12 | `tags` | `_text` | NOT NULL | `'{}'::text[]` |
| 13 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 14 | `source_ref` | `text` | NULL | `` |
| 15 | `notion_source_id` | `text` | NULL | `` |
| 16 | `notion_source_url` | `text` | NULL | `` |
| 17 | `notion_last_synced_at` | `timestamptz` | NULL | `` |
| 18 | `reviewed_by` | `text` | NULL | `` |
| 19 | `reviewed_at` | `timestamptz` | NULL | `` |
| 20 | `created_by` | `text` | NULL | `` |
| 21 | `updated_by` | `text` | NULL | `` |
| 22 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 23 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_longrange_targets

行数 (概算): -1
PRIMARY KEY: `fy`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `fy` | `int4` | NOT NULL | `` |
| 2 | `revenue_yen` | `int8` | NOT NULL | `0` |
| 3 | `fcf_yen` | `int8` | NOT NULL | `0` |
| 4 | `fund_aum_yen` | `int8` | NOT NULL | `0` |
| 5 | `os_institutions` | `int4` | NOT NULL | `0` |
| 6 | `partner_institutions` | `int4` | NOT NULL | `0` |
| 7 | `papers_cumulative` | `int4` | NOT NULL | `0` |
| 8 | `note` | `text` | NULL | `` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_management_signal_reviews

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(ym,status)` (constraint: `company_management_signal_reviews_ym_status_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 4 | `summary` | `text` | NOT NULL | `` |
| 5 | `forecast_summary` | `text` | NULL | `` |
| 6 | `cost_actions` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 7 | `pipeline_actions` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 8 | `variance_findings` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 9 | `risk_alerts` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 10 | `decision_signals` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 11 | `source_refs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 12 | `codex_thread_id` | `text` | NULL | `` |
| 13 | `codex_automation_id` | `text` | NULL | `` |
| 14 | `created_by` | `text` | NOT NULL | `'codex_month_end_review'::text` |
| 15 | `reviewed_at` | `timestamptz` | NULL | `` |
| 16 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_operating_facts

行数 (概算): 20
PRIMARY KEY: `fact_id`
UNIQUE: `(fact_key,source_kind,source_hash)` (constraint: `company_operating_facts_source_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `fact_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `fact_key` | `text` | NOT NULL | `` |
| 3 | `value_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 4 | `source_kind` | `text` | NOT NULL | `` |
| 5 | `source_ref` | `text` | NULL | `` |
| 6 | `source_hash` | `text` | NOT NULL | `` |
| 7 | `confidence` | `numeric` | NOT NULL | `0.500` |
| 8 | `valid_from` | `date` | NULL | `` |
| 9 | `valid_to` | `date` | NULL | `` |
| 10 | `observed_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `verified_at` | `timestamptz` | NULL | `` |
| 12 | `superseded_at` | `timestamptz` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_payment_obligation_notifications

行数 (概算): 33
PRIMARY KEY: `id`
UNIQUE: `(obligation_id,recipient_slack_id,schedule_key,stage)` (constraint: `company_payment_obligation_no_obligation_id_recipient_slack_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `obligation_id` | `uuid` | NOT NULL | `` |
| 3 | `recipient_member_id` | `text` | NULL | `` |
| 4 | `recipient_slack_id` | `text` | NOT NULL | `` |
| 5 | `schedule_key` | `text` | NOT NULL | `` |
| 6 | `stage` | `text` | NOT NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'pending'::text` |
| 8 | `slack_channel_id` | `text` | NULL | `` |
| 9 | `slack_ts` | `text` | NULL | `` |
| 10 | `error_message` | `text` | NULL | `` |
| 11 | `attempted_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `sent_at` | `timestamptz` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_payment_obligations

行数 (概算): 328
PRIMARY KEY: `id`
UNIQUE: `(source_key)` (constraint: `company_payment_obligations_source_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `source_key` | `text` | NOT NULL | `` |
| 3 | `title` | `text` | NOT NULL | `` |
| 4 | `counterparty` | `text` | NULL | `` |
| 5 | `category` | `text` | NOT NULL | `'other'::text` |
| 6 | `amount_yen` | `int8` | NULL | `` |
| 7 | `amount_status` | `text` | NOT NULL | `'unknown'::text` |
| 8 | `due_date` | `date` | NULL | `` |
| 9 | `due_date_precision` | `text` | NOT NULL | `'unknown'::text` |
| 10 | `expected_payment_ym` | `text` | NULL | `` |
| 11 | `status` | `text` | NOT NULL | `'needs_review'::text` |
| 12 | `cashflow_treatment` | `text` | NOT NULL | `'additive'::text` |
| 13 | `budget_category` | `text` | NULL | `` |
| 14 | `auto_debit` | `bool` | NULL | `` |
| 15 | `owner_member_id` | `text` | NULL | `` |
| 16 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 17 | `source_ref` | `text` | NULL | `` |
| 18 | `confidence` | `numeric` | NOT NULL | `0.500` |
| 19 | `paid_at` | `timestamptz` | NULL | `` |
| 20 | `paid_amount_yen` | `int8` | NULL | `` |
| 21 | `first_seen_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `last_seen_at` | `timestamptz` | NOT NULL | `now()` |
| 23 | `reviewed_at` | `timestamptz` | NULL | `` |
| 24 | `payload` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 25 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 26 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_profile_entries

行数 (概算): -1
PRIMARY KEY: `entry_id`
UNIQUE: `(entry_key)` (constraint: `company_profile_entries_entry_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `entry_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `entry_key` | `text` | NOT NULL | `` |
| 3 | `title` | `text` | NOT NULL | `` |
| 4 | `body_md` | `text` | NOT NULL | `''::text` |
| 5 | `visibility` | `text` | NOT NULL | `'admin_only'::text` |
| 6 | `status` | `text` | NOT NULL | `'imported'::text` |
| 7 | `source_confidence` | `numeric` | NOT NULL | `0.50` |
| 8 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 9 | `source_ref` | `text` | NULL | `` |
| 10 | `tags` | `_text` | NOT NULL | `'{}'::text[]` |
| 11 | `notion_source_id` | `text` | NULL | `` |
| 12 | `notion_source_url` | `text` | NULL | `` |
| 13 | `notion_last_synced_at` | `timestamptz` | NULL | `` |
| 14 | `reviewed_by` | `text` | NULL | `` |
| 15 | `reviewed_at` | `timestamptz` | NULL | `` |
| 16 | `created_by` | `text` | NULL | `` |
| 17 | `updated_by` | `text` | NULL | `` |
| 18 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 19 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_schedule_actions

行数 (概算): -1
PRIMARY KEY: `action_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `action_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `occurrence_id` | `uuid` | NOT NULL | `` |
| 3 | `action` | `text` | NOT NULL | `` |
| 4 | `acted_at` | `timestamptz` | NOT NULL | `now()` |
| 5 | `acted_by_member_id` | `text` | NOT NULL | `` |
| 6 | `evidence_ref` | `text` | NULL | `` |
| 7 | `reason` | `text` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## company_schedule_notifications

行数 (概算): 167
PRIMARY KEY: `notification_id`
UNIQUE: `(occurrence_id,recipient_slack_id,schedule_key,stage)` (constraint: `company_schedule_notification_occurrence_id_recipient_slack_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `notification_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `occurrence_id` | `uuid` | NOT NULL | `` |
| 3 | `recipient_member_id` | `text` | NULL | `` |
| 4 | `recipient_slack_id` | `text` | NOT NULL | `` |
| 5 | `schedule_key` | `text` | NOT NULL | `` |
| 6 | `stage` | `text` | NOT NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'pending'::text` |
| 8 | `slack_channel_id` | `text` | NULL | `` |
| 9 | `slack_ts` | `text` | NULL | `` |
| 10 | `error_message` | `text` | NULL | `` |
| 11 | `attempted_at` | `timestamptz` | NULL | `` |
| 12 | `sent_at` | `timestamptz` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_schedule_occurrences

行数 (概算): 2,171
PRIMARY KEY: `occurrence_id`
UNIQUE: `(occurrence_key,source_hash)` (constraint: `company_schedule_occurrences_source_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `occurrence_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `occurrence_key` | `text` | NOT NULL | `` |
| 3 | `source_hash` | `text` | NOT NULL | `` |
| 4 | `current_version` | `bool` | NOT NULL | `true` |
| 5 | `scope` | `text` | NOT NULL | `` |
| 6 | `category` | `text` | NOT NULL | `` |
| 7 | `event_kind` | `text` | NOT NULL | `` |
| 8 | `title` | `text` | NOT NULL | `` |
| 9 | `period_key` | `text` | NULL | `` |
| 10 | `due_on` | `date` | NULL | `` |
| 11 | `due_ym` | `text` | NULL | `` |
| 12 | `date_precision` | `text` | NOT NULL | `'unknown'::text` |
| 13 | `date_kind` | `text` | NOT NULL | `'期限'::text` |
| 14 | `amount_yen` | `int8` | NULL | `` |
| 15 | `amount_status` | `text` | NOT NULL | `'unknown'::text` |
| 16 | `amount_role` | `text` | NOT NULL | `'informational'::text` |
| 17 | `project_id` | `text` | NULL | `` |
| 18 | `owner_member_id` | `text` | NULL | `` |
| 19 | `source_kind` | `text` | NOT NULL | `` |
| 20 | `source_id` | `text` | NULL | `` |
| 21 | `source_refs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 22 | `rule_key` | `text` | NULL | `` |
| 23 | `rule_version` | `text` | NULL | `` |
| 24 | `official_refs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 25 | `resolution_href` | `text` | NULL | `` |
| 26 | `missing_reason` | `text` | NULL | `` |
| 27 | `source_observed_at` | `timestamptz` | NULL | `` |
| 28 | `rule_review_after` | `date` | NULL | `` |
| 29 | `lifecycle_status` | `text` | NOT NULL | `'open'::text` |
| 30 | `generation_state` | `text` | NOT NULL | `'generated'::text` |
| 31 | `notification_owner` | `text` | NOT NULL | `'none'::text` |
| 32 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 33 | `generated_at` | `timestamptz` | NOT NULL | `now()` |
| 34 | `last_seen_at` | `timestamptz` | NOT NULL | `now()` |
| 35 | `superseded_at` | `timestamptz` | NULL | `` |
| 36 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 37 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## company_schedule_rule_checks

行数 (概算): 7
PRIMARY KEY: `rule_check_id`
UNIQUE: `(rule_key,content_hash)` (constraint: `company_schedule_rule_checks_rule_key_content_hash_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `rule_check_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `rule_key` | `text` | NOT NULL | `` |
| 3 | `rule_version` | `text` | NOT NULL | `` |
| 4 | `official_url` | `text` | NOT NULL | `` |
| 5 | `checked_at` | `timestamptz` | NOT NULL | `now()` |
| 6 | `content_hash` | `text` | NOT NULL | `` |
| 7 | `previous_hash` | `text` | NULL | `` |
| 8 | `status` | `text` | NOT NULL | `'clean'::text` |
| 9 | `review_after` | `date` | NULL | `` |
| 10 | `note` | `text` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## contract_documents

行数 (概算): 5,763
PRIMARY KEY: `document_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `document_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `contract_id` | `uuid` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `document_kind` | `text` | NOT NULL | `'revision'::text` |
| 5 | `version_label` | `text` | NOT NULL | `'v1'::text` |
| 6 | `drive_file_id` | `text` | NOT NULL | `` |
| 7 | `drive_folder_id` | `text` | NULL | `` |
| 8 | `web_view_link` | `text` | NOT NULL | `` |
| 9 | `file_name` | `text` | NOT NULL | `` |
| 10 | `mime_type` | `text` | NOT NULL | `'application/octet-stream'::text` |
| 11 | `file_size_bytes` | `int8` | NOT NULL | `0` |
| 12 | `source_kind` | `text` | NOT NULL | `'manual_drive_link'::text` |
| 13 | `received_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `uploaded_by` | `text` | NULL | `` |
| 15 | `is_latest` | `bool` | NOT NULL | `false` |
| 16 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## contract_nudges

行数 (概算): -1
PRIMARY KEY: `nudge_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `nudge_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `contract_id` | `uuid` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 5 | `nudge_reason` | `text` | NOT NULL | `'signed_document_missing'::text` |
| 6 | `candidate_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `due_at` | `timestamptz` | NULL | `` |
| 8 | `stale_days` | `int4` | NOT NULL | `0` |
| 9 | `slack_channel_id` | `text` | NULL | `` |
| 10 | `dry_run_message` | `text` | NOT NULL | `''::text` |
| 11 | `sent_at` | `timestamptz` | NULL | `` |
| 12 | `sent_by` | `text` | NULL | `` |
| 13 | `slack_message_ts` | `text` | NULL | `` |
| 14 | `reviewed_by` | `text` | NULL | `` |
| 15 | `reviewed_at` | `timestamptz` | NULL | `` |
| 16 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## contract_signals

行数 (概算): 176
PRIMARY KEY: `signal_id`
UNIQUE: `(source_kind,source_table,source_id,signal_type)` (constraint: `contract_signals_source_kind_source_table_source_id_signal__key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `signal_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `contract_id` | `uuid` | NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `source_kind` | `text` | NOT NULL | `` |
| 5 | `source_table` | `text` | NOT NULL | `'source_cache'::text` |
| 6 | `source_id` | `text` | NOT NULL | `` |
| 7 | `source_url` | `text` | NULL | `` |
| 8 | `title` | `text` | NOT NULL | `` |
| 9 | `snippet` | `text` | NOT NULL | `''::text` |
| 10 | `detected_terms` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 11 | `signal_type` | `text` | NOT NULL | `'contract'::text` |
| 12 | `confidence` | `numeric` | NOT NULL | `0.5` |
| 13 | `review_required` | `bool` | NOT NULL | `true` |
| 14 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 15 | `detected_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 17 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## contract_terms

行数 (概算): 55
PRIMARY KEY: `term_id`
UNIQUE: `(source_kind,source_table,source_id,source_term_hash)` (constraint: `contract_terms_source_kind_source_table_source_id_source_te_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `term_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `contract_id` | `uuid` | NULL | `` |
| 3 | `signal_id` | `uuid` | NULL | `` |
| 4 | `project_id` | `text` | NOT NULL | `` |
| 5 | `source_kind` | `text` | NOT NULL | `` |
| 6 | `source_table` | `text` | NOT NULL | `'source_cache'::text` |
| 7 | `source_id` | `text` | NOT NULL | `` |
| 8 | `source_term_hash` | `text` | NOT NULL | `` |
| 9 | `source_url` | `text` | NULL | `` |
| 10 | `source_title` | `text` | NOT NULL | `` |
| 11 | `contract_no` | `text` | NULL | `` |
| 12 | `quote_no` | `text` | NULL | `` |
| 13 | `contract_title` | `text` | NULL | `` |
| 14 | `counterparty_name` | `text` | NULL | `` |
| 15 | `period_start` | `date` | NULL | `` |
| 16 | `period_end` | `date` | NULL | `` |
| 17 | `period_start_ym` | `text` | NULL | `` |
| 18 | `period_end_ym` | `text` | NULL | `` |
| 19 | `amount_tax_excl` | `numeric` | NULL | `` |
| 20 | `tax_amount` | `numeric` | NULL | `` |
| 21 | `amount_tax_incl` | `numeric` | NULL | `` |
| 22 | `currency` | `text` | NOT NULL | `'JPY'::text` |
| 23 | `billing_distribution` | `text` | NOT NULL | `'review_required'::text` |
| 24 | `billing_distribution_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 25 | `fee_type_hint` | `text` | NOT NULL | `'unknown'::text` |
| 26 | `confidence` | `numeric` | NOT NULL | `0.5` |
| 27 | `review_required` | `bool` | NOT NULL | `true` |
| 28 | `review_status` | `text` | NOT NULL | `'pending'::text` |
| 29 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 30 | `source_refs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 31 | `extracted_terms_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 32 | `created_by` | `text` | NULL | `` |
| 33 | `updated_by` | `text` | NULL | `` |
| 34 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 35 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## contracts

行数 (概算): 2,165
PRIMARY KEY: `contract_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `contract_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `contract_title` | `text` | NOT NULL | `` |
| 4 | `counterparty_name` | `text` | NULL | `` |
| 5 | `contract_type` | `text` | NOT NULL | `'contract'::text` |
| 6 | `status` | `text` | NOT NULL | `'planned'::text` |
| 7 | `expected_signing_date` | `date` | NULL | `` |
| 8 | `planned_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `detected_at` | `timestamptz` | NULL | `` |
| 10 | `last_activity_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `signed_at` | `timestamptz` | NULL | `` |
| 12 | `nudge_after_days` | `int4` | NOT NULL | `14` |
| 13 | `signal_confidence` | `numeric` | NULL | `` |
| 14 | `review_required` | `bool` | NOT NULL | `true` |
| 15 | `review_status` | `text` | NOT NULL | `'pending'::text` |
| 16 | `source_summary` | `text` | NULL | `` |
| 17 | `source_refs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 18 | `drive_folder_id` | `text` | NULL | `` |
| 19 | `signed_document_id` | `uuid` | NULL | `` |
| 20 | `created_by` | `text` | NULL | `` |
| 21 | `updated_by` | `text` | NULL | `` |
| 22 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 23 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 24 | `canonical_title` | `text` | NULL | `` |
| 25 | `registry_status` | `text` | NOT NULL | `'candidate'::text` |
| 26 | `effective_date` | `date` | NULL | `` |
| 27 | `expiration_date` | `date` | NULL | `` |
| 28 | `renewal_notice_date` | `date` | NULL | `` |
| 29 | `renewal_type` | `text` | NULL | `` |
| 30 | `contract_value_yen` | `int8` | NULL | `` |
| 31 | `business_owner` | `text` | NULL | `` |
| 32 | `ledger_notes` | `text` | NULL | `` |
| 33 | `tax_basis` | `text` | NULL | `` |
| 34 | `recipient_emails` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 35 | `canonical_contract_id` | `uuid` | NULL | `` |
| 36 | `confidentiality_coverage` | `text` | NOT NULL | `'unknown'::text` |
| 37 | `confidentiality_survival_note` | `text` | NULL | `` |
| 38 | `confidentiality_note` | `text` | NULL | `` |
| 39 | `relationship_scope` | `text` | NOT NULL | `'needs_review'::text` |
| 40 | `is_current_for_project` | `bool` | NOT NULL | `false` |
| 41 | `amd_entity_name` | `text` | NOT NULL | `'株式会社チームアルマダ'::text` |
| 42 | `amd_party_role` | `text` | NULL | `` |
| 43 | `party_confirmation_note` | `text` | NULL | `` |
| 44 | `party_confirmed_at` | `timestamptz` | NULL | `` |
| 45 | `party_confirmed_by` | `text` | NULL | `` |
| 46 | `operational_terms_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |

## eimi_slack_usage_log

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 3 | `event_id` | `text` | NULL | `` |
| 4 | `channel_id` | `text` | NULL | `` |
| 5 | `channel_type` | `text` | NULL | `` |
| 6 | `thread_ts` | `text` | NULL | `` |
| 7 | `user_id` | `text` | NULL | `` |
| 8 | `model` | `text` | NULL | `` |
| 9 | `prompt_tokens` | `int4` | NULL | `` |
| 10 | `completion_tokens` | `int4` | NULL | `` |
| 11 | `total_tokens` | `int4` | NULL | `` |
| 12 | `request_ms` | `int4` | NULL | `` |
| 13 | `history_messages_count` | `int4` | NULL | `` |
| 14 | `error_text` | `text` | NULL | `` |

## freee_oauth_tokens

行数 (概算): 1
PRIMARY KEY: `token_key`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `token_key` | `text` | NOT NULL | `'default'::text` |
| 2 | `refresh_token` | `text` | NOT NULL | `` |
| 3 | `company_id` | `text` | NULL | `` |
| 4 | `scope` | `text` | NULL | `` |
| 5 | `external_cid` | `text` | NULL | `` |
| 6 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## freee_reconciliation_actions

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(idempotency_key)` (constraint: `freee_reconciliation_actions_idempotency_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `finding_id` | `uuid` | NOT NULL | `` |
| 3 | `run_id` | `uuid` | NOT NULL | `` |
| 4 | `action_type` | `text` | NOT NULL | `` |
| 5 | `idempotency_key` | `text` | NOT NULL | `` |
| 6 | `mode` | `text` | NOT NULL | `'dry_run'::text` |
| 7 | `freee_write_status` | `text` | NOT NULL | `'not_attempted'::text` |
| 8 | `freee_wallet_txn_id` | `text` | NULL | `` |
| 9 | `freee_account_item_id` | `text` | NULL | `` |
| 10 | `before_state_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 11 | `after_state_json` | `jsonb` | NULL | `` |
| 12 | `blocked_reason` | `text` | NULL | `` |
| 13 | `error_message` | `text` | NULL | `` |
| 14 | `executed_by` | `text` | NOT NULL | `` |
| 15 | `executed_at` | `timestamptz` | NULL | `` |
| 16 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## freee_reconciliation_findings

行数 (概算): 469
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `run_id` | `uuid` | NOT NULL | `` |
| 3 | `finding_key` | `text` | NOT NULL | `` |
| 4 | `finding_type` | `text` | NOT NULL | `` |
| 5 | `severity` | `text` | NOT NULL | `'warn'::text` |
| 6 | `walletable_type` | `text` | NULL | `` |
| 7 | `walletable_id` | `text` | NULL | `` |
| 8 | `walletable_name` | `text` | NULL | `` |
| 9 | `freee_entity_type` | `text` | NULL | `` |
| 10 | `freee_entity_id` | `text` | NULL | `` |
| 11 | `member_id` | `text` | NULL | `` |
| 12 | `amount_yen` | `int8` | NULL | `` |
| 13 | `delta_yen` | `int8` | NULL | `` |
| 14 | `occurred_on` | `date` | NULL | `` |
| 15 | `title` | `text` | NOT NULL | `` |
| 16 | `summary_ja` | `text` | NOT NULL | `` |
| 17 | `decision_reason_ja` | `text` | NOT NULL | `` |
| 18 | `match_confidence` | `text` | NOT NULL | `'ambiguous'::text` |
| 19 | `eligible_for_auto_apply` | `bool` | NOT NULL | `false` |
| 20 | `evidence_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 21 | `review_status` | `text` | NOT NULL | `'pending'::text` |
| 22 | `reviewed_by` | `text` | NULL | `` |
| 23 | `reviewed_at` | `timestamptz` | NULL | `` |
| 24 | `review_note` | `text` | NULL | `` |
| 25 | `first_seen_at` | `timestamptz` | NOT NULL | `now()` |
| 26 | `last_seen_at` | `timestamptz` | NOT NULL | `now()` |
| 27 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 28 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## freee_reconciliation_runs

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(run_key)` (constraint: `freee_reconciliation_runs_run_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `run_key` | `text` | NOT NULL | `` |
| 3 | `week_start_date` | `date` | NOT NULL | `` |
| 4 | `week_end_date` | `date` | NOT NULL | `` |
| 5 | `triggered_by` | `text` | NOT NULL | `'cron'::text` |
| 6 | `dry_run` | `bool` | NOT NULL | `true` |
| 7 | `status` | `text` | NOT NULL | `'running'::text` |
| 8 | `phase` | `text` | NOT NULL | `'review_only'::text` |
| 9 | `run_sequence` | `int4` | NULL | `` |
| 10 | `finding_count` | `int4` | NOT NULL | `0` |
| 11 | `auto_applied_count` | `int4` | NOT NULL | `0` |
| 12 | `blocked_count` | `int4` | NOT NULL | `0` |
| 13 | `summary_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 14 | `error_message` | `text` | NULL | `` |
| 15 | `started_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `completed_at` | `timestamptz` | NULL | `` |
| 17 | `created_at` | `timestamptz` | NOT NULL | `now()` |

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

## guardrail_cards

行数 (概算): -1
PRIMARY KEY: `card_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `card_id` | `text` | NOT NULL | `` |
| 2 | `title` | `text` | NOT NULL | `` |
| 3 | `summary` | `text` | NOT NULL | `` |
| 4 | `rationale` | `text` | NULL | `` |
| 5 | `severity` | `text` | NOT NULL | `'medium'::text` |
| 6 | `trigger_tags` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 7 | `negative_tags` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 8 | `check_items` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 9 | `recommended_actions` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 10 | `output_template` | `text` | NULL | `` |
| 11 | `source_protocol_ids` | `_text` | NOT NULL | `'{}'::text[]` |
| 12 | `source_refs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 13 | `status` | `text` | NOT NULL | `'active'::text` |
| 14 | `created_by` | `text` | NOT NULL | `'masa'::text` |
| 15 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## guardrail_feedbacks

行数 (概算): -1
PRIMARY KEY: `feedback_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `feedback_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `match_id` | `text` | NULL | `` |
| 3 | `card_id` | `text` | NULL | `` |
| 4 | `action` | `text` | NOT NULL | `` |
| 5 | `feedback_text` | `text` | NULL | `` |
| 6 | `created_by` | `text` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## guardrail_matches

行数 (概算): -1
PRIMARY KEY: `match_id`
UNIQUE: `(source_hash)` (constraint: `guardrail_matches_source_hash_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `match_id` | `text` | NOT NULL | `` |
| 2 | `card_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NULL | `` |
| 4 | `target_type` | `text` | NOT NULL | `` |
| 5 | `target_id` | `text` | NOT NULL | `` |
| 6 | `target_title` | `text` | NULL | `` |
| 7 | `target_date` | `timestamptz` | NULL | `` |
| 8 | `project_tags` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 9 | `action_tags` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 10 | `matched_tags` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 11 | `match_score` | `numeric` | NOT NULL | `1` |
| 12 | `severity` | `text` | NOT NULL | `` |
| 13 | `status` | `text` | NOT NULL | `'open'::text` |
| 14 | `due_at` | `timestamptz` | NULL | `` |
| 15 | `source_hash` | `text` | NOT NULL | `` |
| 16 | `notification_id` | `uuid` | NULL | `` |
| 17 | `evidence_refs_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 18 | `created_by` | `text` | NOT NULL | `'guardrail_evaluator'::text` |
| 19 | `detected_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `resolved_at` | `timestamptz` | NULL | `` |
| 21 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## guardrail_tag_definitions

行数 (概算): 71
PRIMARY KEY: `tag_id`
UNIQUE: `(axis,tag)` (constraint: `guardrail_tag_definitions_axis_tag_unique`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `tag_id` | `text` | NOT NULL | `` |
| 2 | `axis` | `text` | NOT NULL | `` |
| 3 | `tag` | `text` | NOT NULL | `` |
| 4 | `label` | `text` | NOT NULL | `` |
| 5 | `description` | `text` | NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'active'::text` |
| 7 | `display_order` | `int4` | NOT NULL | `100` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_assessments

行数 (概算): 169
PRIMARY KEY: `assessment_id`
UNIQUE: `(institution_id,criterion_id,evaluated_at)` (constraint: `institution_assessments_institution_id_criterion_id_evaluat_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `assessment_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `institution_id` | `text` | NOT NULL | `` |
| 3 | `criterion_id` | `text` | NOT NULL | `` |
| 4 | `level` | `int4` | NULL | `` |
| 5 | `na` | `bool` | NOT NULL | `false` |
| 6 | `note` | `text` | NULL | `` |
| 7 | `evaluated_at` | `date` | NOT NULL | `CURRENT_DATE` |
| 8 | `evaluator` | `text` | NULL | `'まさ'::text` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `evaluation_version` | `text` | NOT NULL | `'v1'::text` |

## institution_capability_axes

行数 (概算): -1
PRIMARY KEY: `axis_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `axis_id` | `text` | NOT NULL | `` |
| 2 | `axis_no` | `int4` | NOT NULL | `` |
| 3 | `name` | `text` | NOT NULL | `` |
| 4 | `corresponds_xrl` | `text` | NULL | `` |
| 5 | `weight` | `numeric` | NOT NULL | `0.125` |
| 6 | `sort_order` | `int4` | NOT NULL | `0` |

## institution_capability_criteria

行数 (概算): -1
PRIMARY KEY: `criterion_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `criterion_id` | `text` | NOT NULL | `` |
| 2 | `axis_id` | `text` | NOT NULL | `` |
| 3 | `code` | `text` | NOT NULL | `` |
| 4 | `name` | `text` | NOT NULL | `` |
| 5 | `rubric` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 6 | `sort_order` | `int4` | NOT NULL | `0` |

## institution_policy_assessments

行数 (概算): 96
PRIMARY KEY: `policy_assessment_id`
UNIQUE: `(institution_id,policy_item_id)` (constraint: `institution_policy_assessment_institution_id_policy_item_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `policy_assessment_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `institution_id` | `text` | NOT NULL | `` |
| 3 | `policy_item_id` | `text` | NOT NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'unknown'::text` |
| 5 | `attribute_value` | `text` | NULL | `` |
| 6 | `evidence_note` | `text` | NULL | `` |
| 7 | `source_type` | `text` | NOT NULL | `'unknown'::text` |
| 8 | `source_url` | `text` | NULL | `` |
| 9 | `source_path` | `text` | NULL | `` |
| 10 | `confirmed_at` | `date` | NULL | `` |
| 11 | `evaluator` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_policy_items

行数 (概算): -1
PRIMARY KEY: `policy_item_id`
UNIQUE: `(key)` (constraint: `institution_policy_items_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `policy_item_id` | `text` | NOT NULL | `` |
| 2 | `category` | `text` | NOT NULL | `` |
| 3 | `item_kind` | `text` | NOT NULL | `` |
| 4 | `key` | `text` | NOT NULL | `` |
| 5 | `label` | `text` | NOT NULL | `` |
| 6 | `description` | `text` | NULL | `` |
| 7 | `value_type` | `text` | NOT NULL | `'text'::text` |
| 8 | `sort_order` | `int4` | NOT NULL | `100` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_projects

行数 (概算): -1
PRIMARY KEY: `project_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `institution_id` | `text` | NOT NULL | `` |
| 3 | `engagement_scope` | `text` | NULL | `` |
| 4 | `target_unit` | `text` | NULL | `` |
| 5 | `ecosystem_goal` | `text` | NULL | `` |
| 6 | `seed_discovery_in_scope` | `bool` | NOT NULL | `true` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_regulation_cells

行数 (概算): -1
PRIMARY KEY: `institution_id, regulation_type_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `institution_id` | `text` | NOT NULL | `` |
| 2 | `regulation_type_id` | `text` | NOT NULL | `` |
| 3 | `regulation_id` | `text` | NULL | `` |
| 4 | `state` | `text` | NOT NULL | `'unconfirmed'::text` |
| 5 | `confirmed_at` | `date` | NULL | `` |
| 6 | `updated_by` | `text` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_regulation_types

行数 (概算): -1
PRIMARY KEY: `regulation_type_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `regulation_type_id` | `text` | NOT NULL | `` |
| 2 | `group_key` | `text` | NOT NULL | `` |
| 3 | `label` | `text` | NOT NULL | `` |
| 4 | `short_label` | `text` | NOT NULL | `` |
| 5 | `description` | `text` | NULL | `` |
| 6 | `sort_order` | `int4` | NOT NULL | `100` |
| 7 | `is_active` | `bool` | NOT NULL | `true` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_regulation_versions

行数 (概算): -1
PRIMARY KEY: `version_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `version_id` | `text` | NOT NULL | `` |
| 2 | `regulation_id` | `text` | NOT NULL | `` |
| 3 | `label` | `text` | NOT NULL | `` |
| 4 | `file_name` | `text` | NULL | `` |
| 5 | `version_state` | `text` | NOT NULL | `'draft'::text` |
| 6 | `external_url` | `text` | NULL | `` |
| 7 | `version_date` | `date` | NULL | `` |
| 8 | `is_current` | `bool` | NOT NULL | `false` |
| 9 | `created_by` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_regulations

行数 (概算): -1
PRIMARY KEY: `regulation_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `regulation_id` | `text` | NOT NULL | `` |
| 2 | `institution_id` | `text` | NOT NULL | `` |
| 3 | `title` | `text` | NOT NULL | `` |
| 4 | `stage` | `int2` | NOT NULL | `0` |
| 5 | `lifecycle_state` | `text` | NOT NULL | `'drafting'::text` |
| 6 | `current_state_note` | `text` | NULL | `` |
| 7 | `next_gate` | `text` | NULL | `` |
| 8 | `next_gate_timing` | `text` | NULL | `` |
| 9 | `updated_by` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_workspace_memberships

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(workspace_id,user_account_id)` (constraint: `institution_workspace_membersh_workspace_id_user_account_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `workspace_id` | `uuid` | NOT NULL | `` |
| 3 | `user_account_id` | `uuid` | NOT NULL | `` |
| 4 | `role` | `text` | NOT NULL | `'member'::text` |
| 5 | `status` | `text` | NOT NULL | `'invited'::text` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_workspace_project_scopes

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(workspace_id,project_id)` (constraint: `institution_workspace_project_scope_workspace_id_project_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `workspace_id` | `uuid` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'active'::text` |
| 5 | `shared_surface` | `text` | NOT NULL | `'summary'::text` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_workspace_seed_scopes

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(workspace_id,seed_id)` (constraint: `institution_workspace_seed_scopes_workspace_id_seed_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `workspace_id` | `uuid` | NOT NULL | `` |
| 3 | `seed_id` | `uuid` | NOT NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'active'::text` |
| 5 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 6 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institution_workspaces

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(institution_id)` (constraint: `institution_workspaces_institution_id_key`)
UNIQUE: `(slug)` (constraint: `institution_workspaces_slug_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `slug` | `text` | NOT NULL | `` |
| 3 | `institution_id` | `text` | NOT NULL | `` |
| 4 | `name` | `text` | NOT NULL | `` |
| 5 | `status` | `text` | NOT NULL | `'paused'::text` |
| 6 | `is_publicly_listed` | `bool` | NOT NULL | `false` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## institutions

行数 (概算): 48
PRIMARY KEY: `institution_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `institution_id` | `text` | NOT NULL | `` |
| 2 | `name` | `text` | NOT NULL | `` |
| 3 | `short_name` | `text` | NULL | `` |
| 4 | `type` | `text` | NOT NULL | `'university'::text` |
| 5 | `description` | `text` | NULL | `` |
| 6 | `region` | `text` | NULL | `` |
| 7 | `contract_status` | `text` | NOT NULL | `'unengaged'::text` |
| 8 | `sort_order` | `int4` | NOT NULL | `100` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `identity_status` | `text` | NOT NULL | `'verified'::text` |

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

## jp_culture_items

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `title` | `text` | NOT NULL | `` |
| 3 | `description` | `text` | NULL | `` |
| 4 | `category_path` | `_text` | NOT NULL | `'{}'::text[]` |
| 5 | `prefecture` | `text` | NULL | `` |
| 6 | `city` | `text` | NULL | `` |
| 7 | `links` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 8 | `image_url` | `text` | NULL | `` |
| 9 | `metadata` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 10 | `sort_weight` | `int4` | NOT NULL | `0` |
| 11 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 12 | `status` | `text` | NOT NULL | `'active'::text` |
| 13 | `created_by` | `text` | NULL | `` |
| 14 | `updated_by` | `text` | NULL | `` |
| 15 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## killer_factor_catalog

行数 (概算): -1
PRIMARY KEY: `killer_factor_id`
UNIQUE: `(factor_type,event_description)` (constraint: `killer_factor_catalog_identity_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `killer_factor_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `factor_type` | `text` | NOT NULL | `` |
| 3 | `event_description` | `text` | NOT NULL | `` |
| 4 | `observation_clues` | `text` | NOT NULL | `` |
| 5 | `sort_order` | `int4` | NOT NULL | `100` |
| 6 | `is_active` | `bool` | NOT NULL | `true` |
| 7 | `created_by_member_id` | `text` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `operating_mode` | `text` | NOT NULL | `'monitoring'::text` |
| 11 | `preventive_action` | `text` | NULL | `` |
| 12 | `timing_guidance` | `text` | NULL | `` |

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

## l2_coverage_gaps

行数 (概算): 157
PRIMARY KEY: `gap_id`
UNIQUE: `(source_hash)` (constraint: `l2_coverage_gaps_source_hash_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `gap_id` | `text` | NOT NULL | `` |
| 2 | `source` | `text` | NOT NULL | `` |
| 3 | `source_ref` | `text` | NULL | `` |
| 4 | `source_hash` | `text` | NULL | `` |
| 5 | `title` | `text` | NULL | `` |
| 6 | `summary` | `text` | NULL | `` |
| 7 | `salience_score` | `numeric` | NULL | `` |
| 8 | `matched_patterns` | `jsonb` | NULL | `` |
| 9 | `proposed_target_l2` | `text` | NULL | `` |
| 10 | `gap_class` | `text` | NULL | `` |
| 11 | `project_id` | `text` | NULL | `` |
| 12 | `scope` | `text` | NULL | `'unknown'::text` |
| 13 | `due_at` | `timestamptz` | NULL | `` |
| 14 | `review_status` | `text` | NULL | `'candidate'::text` |
| 15 | `routed_to` | `text` | NULL | `` |
| 16 | `evidence_refs_json` | `jsonb` | NULL | `` |
| 17 | `created_by` | `text` | NULL | `'coverage_scanner'::text` |
| 18 | `detected_at` | `timestamptz` | NULL | `now()` |
| 19 | `reviewed_at` | `timestamptz` | NULL | `` |
| 20 | `routed_at` | `timestamptz` | NULL | `` |
| 21 | `created_at` | `timestamptz` | NULL | `now()` |
| 22 | `updated_at` | `timestamptz` | NULL | `now()` |

## l2_extract_state

行数 (概算): 112
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

行数 (概算): 77
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

行数 (概算): 584
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
| 15 | `attention_state` | `text` | NOT NULL | `'pending'::text` |
| 16 | `attention_type` | `text` | NULL | `` |
| 17 | `attention_owner` | `text` | NOT NULL | `'none'::text` |
| 18 | `requires_masa_decision` | `bool` | NOT NULL | `false` |
| 19 | `attention_reason` | `text` | NULL | `` |
| 20 | `attention_action` | `text` | NULL | `` |
| 21 | `attention_effect` | `text` | NULL | `` |
| 22 | `attention_confidence` | `numeric` | NULL | `` |
| 23 | `attention_source_hash` | `text` | NULL | `` |
| 24 | `attention_reviewed_at` | `timestamptz` | NULL | `` |
| 25 | `attention_reviewed_by` | `text` | NULL | `` |

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

## legacy_reward_payout_amount_override_events

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(event_key)` (constraint: `legacy_reward_payout_amount_override_events_event_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `int8` | NOT NULL | `` |
| 2 | `event_key` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `source_ym` | `text` | NOT NULL | `` |
| 5 | `member_id` | `text` | NOT NULL | `` |
| 6 | `action` | `text` | NOT NULL | `` |
| 7 | `amount_yen` | `int8` | NULL | `` |
| 8 | `reason` | `text` | NOT NULL | `` |
| 9 | `authorized_by` | `text` | NOT NULL | `` |
| 10 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |

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

## llm_prompt_revisions

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `prompt_key` | `text` | NOT NULL | `` |
| 3 | `body_before` | `text` | NULL | `` |
| 4 | `body_after` | `text` | NOT NULL | `` |
| 5 | `updated_by` | `text` | NULL | `` |
| 6 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |

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

行数 (概算): 1,578
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

## management_knowledge_entries

行数 (概算): 25
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NULL | `` |
| 3 | `title` | `text` | NOT NULL | `` |
| 4 | `category` | `text` | NOT NULL | `'other'::text` |
| 5 | `route_type` | `text` | NULL | `` |
| 6 | `maturity` | `text` | NOT NULL | `'hypothesis'::text` |
| 7 | `tags` | `_text` | NOT NULL | `'{}'::text[]` |
| 8 | `summary` | `text` | NOT NULL | `''::text` |
| 9 | `body_md` | `text` | NOT NULL | `''::text` |
| 10 | `reusable_when` | `text` | NULL | `` |
| 11 | `next_check` | `text` | NULL | `` |
| 12 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 13 | `source_ref` | `text` | NULL | `` |
| 14 | `source_excerpt` | `text` | NULL | `` |
| 15 | `confidence` | `numeric` | NOT NULL | `0.50` |
| 16 | `status` | `text` | NOT NULL | `'active'::text` |
| 17 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 18 | `created_by` | `text` | NULL | `` |
| 19 | `updated_by` | `text` | NULL | `` |
| 20 | `archived_at` | `timestamptz` | NULL | `` |
| 21 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## media_assets

行数 (概算): 419
PRIMARY KEY: `asset_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `asset_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `title` | `text` | NOT NULL | `` |
| 3 | `asset_kind` | `text` | NOT NULL | `'photo'::text` |
| 4 | `storage_bucket` | `text` | NULL | `` |
| 5 | `storage_path` | `text` | NULL | `` |
| 6 | `thumbnail_path` | `text` | NULL | `` |
| 7 | `captured_at` | `date` | NULL | `` |
| 8 | `photographer` | `text` | NULL | `` |
| 9 | `location_label` | `text` | NULL | `` |
| 10 | `project_ids` | `_text` | NOT NULL | `'{}'::text[]` |
| 11 | `member_ids` | `_text` | NOT NULL | `'{}'::text[]` |
| 12 | `event_id` | `uuid` | NULL | `` |
| 13 | `tags` | `_text` | NOT NULL | `'{}'::text[]` |
| 14 | `visibility` | `text` | NOT NULL | `'admin_only'::text` |
| 15 | `status` | `text` | NOT NULL | `'needs_review'::text` |
| 16 | `source_confidence` | `numeric` | NOT NULL | `0.50` |
| 17 | `usage_permission` | `text` | NOT NULL | `'unknown'::text` |
| 18 | `consent_status` | `text` | NOT NULL | `'unknown'::text` |
| 19 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 20 | `source_ref` | `text` | NULL | `` |
| 21 | `notion_source_id` | `text` | NULL | `` |
| 22 | `notion_source_url` | `text` | NULL | `` |
| 23 | `notion_last_synced_at` | `timestamptz` | NULL | `` |
| 24 | `reviewed_by` | `text` | NULL | `` |
| 25 | `reviewed_at` | `timestamptz` | NULL | `` |
| 26 | `created_by` | `text` | NULL | `` |
| 27 | `updated_by` | `text` | NULL | `` |
| 28 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 29 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## meeting_action_items

行数 (概算): -1
PRIMARY KEY: `action_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `action_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `source_meeting_id` | `text` | NULL | `` |
| 4 | `prep_meeting_id` | `text` | NULL | `` |
| 5 | `owner_member_id` | `text` | NULL | `` |
| 6 | `owner_code_name` | `text` | NULL | `` |
| 7 | `title` | `text` | NOT NULL | `` |
| 8 | `detail` | `text` | NULL | `` |
| 9 | `due_at` | `timestamptz` | NULL | `` |
| 10 | `status` | `text` | NOT NULL | `'todo'::text` |
| 11 | `source_hash` | `text` | NULL | `` |
| 12 | `completion_source` | `text` | NULL | `` |
| 13 | `completion_evidence_url` | `text` | NULL | `` |
| 14 | `completed_at` | `timestamptz` | NULL | `` |
| 15 | `last_nudged_at` | `timestamptz` | NULL | `` |
| 16 | `slack_message_ts` | `text` | NULL | `` |
| 17 | `scheduled_nudge_at` | `timestamptz` | NULL | `` |
| 18 | `slack_scheduled_message_id` | `text` | NULL | `` |
| 19 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## meeting_assets

行数 (概算): 137
PRIMARY KEY: `asset_id`
UNIQUE: `(storage_path)` (constraint: `meeting_assets_storage_path_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `asset_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `meeting_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `storage_bucket` | `text` | NOT NULL | `'meeting-assets'::text` |
| 5 | `storage_path` | `text` | NOT NULL | `` |
| 6 | `file_name` | `text` | NOT NULL | `` |
| 7 | `media_type` | `text` | NOT NULL | `` |
| 8 | `file_size_bytes` | `int8` | NOT NULL | `0` |
| 9 | `asset_kind` | `text` | NOT NULL | `'upload'::text` |
| 10 | `caption` | `text` | NULL | `` |
| 11 | `extracted_text` | `text` | NULL | `` |
| 12 | `source_url` | `text` | NULL | `` |
| 13 | `sort_order` | `int4` | NOT NULL | `0` |
| 14 | `created_by` | `text` | NULL | `` |
| 15 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `drive_file_id` | `text` | NULL | `` |
| 18 | `project_drive_folder_id` | `text` | NULL | `` |
| 19 | `drive_folder_id` | `text` | NULL | `` |
| 20 | `drive_folder_name` | `text` | NULL | `` |
| 21 | `drive_folder_web_view_link` | `text` | NULL | `` |
| 22 | `web_view_link` | `text` | NULL | `` |
| 23 | `folder_display_path` | `text` | NULL | `` |

## meeting_notifications

行数 (概算): 33
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

行数 (概算): 1,026
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

## member_bank_transfer_aliases

行数 (概算): -1
PRIMARY KEY: `alias`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `alias` | `text` | NOT NULL | `` |
| 2 | `member_id` | `text` | NOT NULL | `` |
| 3 | `raw_text` | `text` | NULL | `` |
| 4 | `learned_from` | `text` | NULL | `` |
| 5 | `learned_at` | `timestamptz` | NOT NULL | `now()` |

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

## member_microsoft_oauth_tokens

行数 (概算): -1
PRIMARY KEY: `member_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `member_id` | `text` | NOT NULL | `` |
| 2 | `account_label` | `text` | NULL | `` |
| 3 | `account_kind` | `text` | NULL | `` |
| 4 | `tenant_id` | `text` | NULL | `` |
| 5 | `access_token` | `text` | NULL | `` |
| 6 | `refresh_token` | `text` | NULL | `` |
| 7 | `token_expires_at` | `timestamptz` | NULL | `` |
| 8 | `scopes` | `_text` | NOT NULL | `'{}'::text[]` |
| 9 | `last_authorized_at` | `timestamptz` | NULL | `` |
| 10 | `last_used_at` | `timestamptz` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## member_monthly_work_agreement_amount_change_reasons

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(ym,member_id,project_id,agreement_snapshot_hash)` (constraint: `member_monthly_work_agreement_ym_member_id_project_id_agree_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `member_id` | `text` | NOT NULL | `` |
| 4 | `project_id` | `text` | NOT NULL | `` |
| 5 | `agreement_snapshot_hash` | `text` | NOT NULL | `` |
| 6 | `reason` | `text` | NOT NULL | `` |
| 7 | `created_by` | `text` | NOT NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_by` | `text` | NULL | `` |
| 10 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## member_monthly_work_agreement_payout_overrides

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `payment_ym` | `text` | NOT NULL | `` |
| 3 | `source_ym` | `text` | NOT NULL | `` |
| 4 | `member_id` | `text` | NOT NULL | `` |
| 5 | `project_id` | `text` | NOT NULL | `` |
| 6 | `target_action` | `text` | NOT NULL | `` |
| 7 | `blocker_status` | `text` | NOT NULL | `` |
| 8 | `reason` | `text` | NOT NULL | `` |
| 9 | `actor_email` | `text` | NOT NULL | `` |
| 10 | `snapshot_hash` | `text` | NULL | `` |
| 11 | `current_hash` | `text` | NULL | `` |
| 12 | `request_id` | `uuid` | NULL | `` |
| 13 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 14 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## member_monthly_work_agreement_requests

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `member_id` | `text` | NOT NULL | `` |
| 4 | `project_id` | `text` | NULL | `` |
| 5 | `request_type` | `text` | NOT NULL | `'other'::text` |
| 6 | `body` | `text` | NOT NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'open'::text` |
| 8 | `snapshot_hash` | `text` | NULL | `` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `resolved_at` | `timestamptz` | NULL | `` |
| 12 | `resolved_by` | `text` | NULL | `` |
| 13 | `resolution_note` | `text` | NULL | `` |

## member_monthly_work_agreements

行数 (概算): 28
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `member_id` | `text` | NOT NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'agreed'::text` |
| 5 | `agreed_at` | `timestamptz` | NOT NULL | `now()` |
| 6 | `agreed_by` | `text` | NOT NULL | `` |
| 7 | `snapshot_json` | `jsonb` | NOT NULL | `` |
| 8 | `snapshot_hash` | `text` | NOT NULL | `` |
| 9 | `current_hash` | `text` | NOT NULL | `` |
| 10 | `invalidated_at` | `timestamptz` | NULL | `` |
| 11 | `invalidation_reason` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `project_id` | `text` | NULL | `` |

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

## member_payout_settlements

行数 (概算): 145
PRIMARY KEY: `id`
UNIQUE: `(source,source_id)` (constraint: `member_payout_settlements_source_source_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `source` | `text` | NOT NULL | `` |
| 3 | `source_id` | `text` | NOT NULL | `` |
| 4 | `paid_on` | `date` | NOT NULL | `` |
| 5 | `amount_yen` | `int4` | NOT NULL | `` |
| 6 | `member_id` | `text` | NULL | `` |
| 7 | `member_match_method` | `text` | NULL | `` |
| 8 | `member_match_reason` | `text` | NULL | `` |
| 9 | `partner_name` | `text` | NULL | `` |
| 10 | `description` | `text` | NULL | `` |
| 11 | `transfer_name` | `text` | NULL | `` |
| 12 | `notice_ym` | `text` | NULL | `` |
| 13 | `notice_no` | `text` | NULL | `` |
| 14 | `notice_total_yen` | `int4` | NULL | `` |
| 15 | `amount_match` | `text` | NULL | `` |
| 16 | `confidence` | `text` | NOT NULL | `'low'::text` |
| 17 | `synced_at` | `timestamptz` | NOT NULL | `now()` |

## member_profiles

行数 (概算): 29
PRIMARY KEY: `member_profile_id`
UNIQUE: `(member_id)` (constraint: `member_profiles_member_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `member_profile_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `member_id` | `text` | NULL | `` |
| 3 | `display_name` | `text` | NOT NULL | `` |
| 4 | `public_title` | `text` | NULL | `` |
| 5 | `internal_title` | `text` | NULL | `` |
| 6 | `notion_status` | `text` | NULL | `` |
| 7 | `joined_on` | `date` | NULL | `` |
| 8 | `bio_short` | `text` | NULL | `` |
| 9 | `bio_long` | `text` | NULL | `` |
| 10 | `expertise_tags` | `_text` | NOT NULL | `'{}'::text[]` |
| 11 | `visibility` | `text` | NOT NULL | `'admin_only'::text` |
| 12 | `status` | `text` | NOT NULL | `'imported'::text` |
| 13 | `source_confidence` | `numeric` | NOT NULL | `0.50` |
| 14 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 15 | `source_ref` | `text` | NULL | `` |
| 16 | `tags` | `_text` | NOT NULL | `'{}'::text[]` |
| 17 | `photo_asset_id` | `uuid` | NULL | `` |
| 18 | `notion_source_id` | `text` | NULL | `` |
| 19 | `notion_source_url` | `text` | NULL | `` |
| 20 | `notion_last_synced_at` | `timestamptz` | NULL | `` |
| 21 | `reviewed_by` | `text` | NULL | `` |
| 22 | `reviewed_at` | `timestamptz` | NULL | `` |
| 23 | `created_by` | `text` | NULL | `` |
| 24 | `updated_by` | `text` | NULL | `` |
| 25 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 26 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 27 | `full_name` | `text` | NULL | `` |
| 28 | `effort` | `numeric` | NULL | `` |
| 29 | `mbti_tags` | `_text` | NOT NULL | `'{}'::text[]` |
| 30 | `origin_label` | `text` | NULL | `` |
| 31 | `residence_label` | `text` | NULL | `` |
| 32 | `join_context` | `text` | NULL | `` |
| 33 | `off_time_note` | `text` | NULL | `` |
| 34 | `favorite_food` | `text` | NULL | `` |
| 35 | `bucket_list` | `text` | NULL | `` |

## member_weekly_tasks

行数 (概算): 1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `member_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NULL | `` |
| 4 | `week_start` | `date` | NOT NULL | `` |
| 5 | `title` | `text` | NOT NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'open'::text` |
| 7 | `completed_at` | `timestamptz` | NULL | `` |
| 8 | `source` | `text` | NOT NULL | `'manual'::text` |
| 9 | `carried_from_task_id` | `uuid` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `candidate_key` | `text` | NULL | `` |

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
| 27 | `contractor_name` | `text` | NULL | `` |
| 28 | `invoice_registration_number` | `text` | NULL | `` |
| 29 | `os_access_scope` | `text` | NOT NULL | `'portfolio'::text` |

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

## microsoft_oauth_states

行数 (概算): -1
PRIMARY KEY: `state`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `state` | `text` | NOT NULL | `` |
| 2 | `member_id` | `text` | NOT NULL | `` |
| 3 | `redirect_after` | `text` | NULL | `` |
| 4 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 5 | `expires_at` | `timestamptz` | NOT NULL | `` |

## milestone_change_events

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `plan_cycle_id` | `text` | NOT NULL | `` |
| 4 | `revision_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 5 | `source` | `text` | NOT NULL | `'admin_ms_overview'::text` |
| 6 | `changed_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `changed_by_email` | `text` | NULL | `` |
| 8 | `reward_preview_status` | `text` | NOT NULL | `'not_checked'::text` |
| 9 | `changed_milestone_count` | `int4` | NOT NULL | `0` |
| 10 | `added_milestone_count` | `int4` | NOT NULL | `0` |
| 11 | `removed_milestone_count` | `int4` | NOT NULL | `0` |
| 12 | `updated_milestone_count` | `int4` | NOT NULL | `0` |
| 13 | `protected_cycle_count` | `int4` | NOT NULL | `0` |
| 14 | `offset_count` | `int4` | NOT NULL | `0` |
| 15 | `positive_offset_yen` | `int4` | NOT NULL | `0` |
| 16 | `negative_offset_yen` | `int4` | NOT NULL | `0` |
| 17 | `before_milestones_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 18 | `after_milestones_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 19 | `change_items_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 20 | `reward_preview_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 21 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |

## milestone_monthly_contribution_allocations

行数 (概算): 98
PRIMARY KEY: `id`
UNIQUE: `(milestone_id,ym,member_id)` (constraint: `milestone_monthly_contribution_al_milestone_id_ym_member_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `milestone_id` | `text` | NOT NULL | `` |
| 4 | `ym` | `text` | NOT NULL | `` |
| 5 | `member_id` | `text` | NOT NULL | `` |
| 6 | `planned_share` | `numeric` | NOT NULL | `0` |
| 7 | `actual_share` | `numeric` | NOT NULL | `0` |
| 8 | `confidence` | `numeric` | NOT NULL | `0` |
| 9 | `source` | `text` | NOT NULL | `'member_activities'::text` |
| 10 | `status` | `text` | NOT NULL | `'auto_applied'::text` |
| 11 | `reason` | `text` | NULL | `` |
| 12 | `evidence_count` | `int4` | NOT NULL | `0` |
| 13 | `evidence_refs` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 14 | `auto_generated_at` | `timestamptz` | NULL | `` |
| 15 | `confirmed_at` | `timestamptz` | NULL | `` |
| 16 | `confirmed_by` | `text` | NULL | `` |
| 17 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## milestone_monthly_progress

行数 (概算): 312
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

行数 (概算): 234
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

## monthly_report_edit_history

行数 (概算): 116
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `report_kind` | `text` | NOT NULL | `` |
| 5 | `action` | `text` | NOT NULL | `` |
| 6 | `actor_kind` | `text` | NOT NULL | `` |
| 7 | `actor_member_id` | `text` | NULL | `` |
| 8 | `actor_label` | `text` | NULL | `` |
| 9 | `content_before` | `text` | NULL | `` |
| 10 | `content_after` | `text` | NULL | `` |
| 11 | `changed_sections` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 12 | `detail_available` | `bool` | NOT NULL | `true` |
| 13 | `source` | `text` | NULL | `` |
| 14 | `created_at` | `timestamptz` | NOT NULL | `now()` |

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

行数 (概算): 106
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

## monthly_reports_external

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,ym)` (constraint: `monthly_reports_external_project_ym_unique`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `body_md` | `text` | NOT NULL | `` |
| 5 | `generated_at` | `timestamptz` | NOT NULL | `now()` |
| 6 | `generated_by_model` | `text` | NULL | `` |
| 7 | `pdf_drive_url` | `text` | NULL | `` |
| 8 | `pdf_local_path` | `text` | NULL | `` |
| 9 | `jargon_check_status` | `text` | NULL | `` |
| 10 | `jargon_check_findings` | `jsonb` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## monthly_reward_payout

行数 (概算): 38
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

行数 (概算): 136
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

行数 (概算): 28
PRIMARY KEY: `member_id, ym`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `member_id` | `text` | NOT NULL | `` |
| 2 | `ym` | `text` | NOT NULL | `` |
| 3 | `sent_at` | `timestamptz` | NULL | `` |
| 4 | `notice_no` | `text` | NULL | `` |
| 5 | `pdf_url` | `text` | NULL | `` |
| 6 | `total_yen` | `int4` | NULL | `` |
| 7 | `last_generated_at` | `timestamptz` | NULL | `` |
| 8 | `paid_on` | `date` | NULL | `` |
| 9 | `paid_amount_yen` | `int4` | NULL | `` |
| 10 | `reimbursement_yen` | `int4` | NULL | `` |
| 11 | `reimbursement_ids` | `jsonb` | NULL | `` |

## poc_companies

行数 (概算): 26
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `company_name` | `text` | NOT NULL | `` |
| 3 | `company_size` | `text` | NULL | `` |
| 4 | `industry_tags` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 5 | `region` | `text` | NULL | `` |
| 6 | `poc_profile` | `text` | NULL | `` |
| 7 | `poc_history_note` | `text` | NULL | `` |
| 8 | `incentive_note` | `text` | NULL | `` |
| 9 | `source_kind` | `text` | NULL | `` |
| 10 | `source_ref` | `text` | NULL | `` |
| 11 | `owner_member_id` | `text` | NULL | `` |
| 12 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 13 | `next_action` | `text` | NULL | `` |
| 14 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `created_by` | `text` | NULL | `` |
| 17 | `updated_by` | `text` | NULL | `` |

## poc_matches

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NULL | `` |
| 3 | `company_id` | `uuid` | NULL | `` |
| 4 | `project_id` | `text` | NULL | `` |
| 5 | `match_title` | `text` | NOT NULL | `` |
| 6 | `fit_hypothesis` | `text` | NULL | `` |
| 7 | `hearing_questions` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 8 | `poc_goal` | `text` | NULL | `` |
| 9 | `reward_plan` | `text` | NULL | `` |
| 10 | `contract_plan` | `text` | NULL | `` |
| 11 | `funding_plan` | `text` | NULL | `` |
| 12 | `revenue_share_note` | `text` | NULL | `` |
| 13 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 14 | `priority` | `text` | NOT NULL | `'medium'::text` |
| 15 | `owner_member_id` | `text` | NULL | `` |
| 16 | `next_action` | `text` | NULL | `` |
| 17 | `source_note` | `text` | NULL | `` |
| 18 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 19 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `created_by` | `text` | NULL | `` |
| 21 | `updated_by` | `text` | NULL | `` |

## private_wiki_entries

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NULL | `` |
| 3 | `person_name` | `text` | NOT NULL | `` |
| 4 | `person_kind` | `text` | NOT NULL | `'external_collaborator'::text` |
| 5 | `affiliation` | `text` | NULL | `` |
| 6 | `relationship_context` | `text` | NULL | `` |
| 7 | `tags` | `_text` | NOT NULL | `'{}'::text[]` |
| 8 | `memo_body` | `text` | NOT NULL | `''::text` |
| 9 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 10 | `source_ref` | `text` | NULL | `` |
| 11 | `source_excerpt` | `text` | NULL | `` |
| 12 | `confidence` | `numeric` | NOT NULL | `0.50` |
| 13 | `visibility` | `text` | NOT NULL | `'admin_private'::text` |
| 14 | `status` | `text` | NOT NULL | `'active'::text` |
| 15 | `created_by` | `text` | NULL | `` |
| 16 | `updated_by` | `text` | NULL | `` |
| 17 | `archived_at` | `timestamptz` | NULL | `` |
| 18 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 19 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `birthday_label` | `text` | NULL | `` |
| 21 | `origin_label` | `text` | NULL | `` |
| 22 | `residence_label` | `text` | NULL | `` |
| 23 | `contact_context` | `text` | NULL | `` |
| 24 | `family_note` | `text` | NULL | `` |
| 25 | `taboo_note` | `text` | NULL | `` |

## proactive_loop_events

行数 (概算): -1
PRIMARY KEY: `event_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `event_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `loop_id` | `uuid` | NULL | `` |
| 3 | `outbox_id` | `uuid` | NULL | `` |
| 4 | `project_id` | `text` | NOT NULL | `` |
| 5 | `event_type` | `text` | NOT NULL | `` |
| 6 | `event_summary` | `text` | NOT NULL | `` |
| 7 | `actor_kind` | `text` | NOT NULL | `'system'::text` |
| 8 | `actor_id` | `text` | NULL | `` |
| 9 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## proactive_loops

行数 (概算): -1
PRIMARY KEY: `loop_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `loop_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `institution_id` | `text` | NULL | `` |
| 4 | `commander_thread_id` | `text` | NULL | `` |
| 5 | `loop_kind` | `text` | NOT NULL | `` |
| 6 | `source_kind` | `text` | NOT NULL | `` |
| 7 | `source_id` | `text` | NULL | `` |
| 8 | `source_hash` | `text` | NULL | `` |
| 9 | `meeting_id` | `text` | NULL | `` |
| 10 | `calendar_event_id` | `text` | NULL | `` |
| 11 | `title` | `text` | NOT NULL | `` |
| 12 | `summary` | `text` | NULL | `` |
| 13 | `ball_owner` | `text` | NOT NULL | `'ambiguous'::text` |
| 14 | `priority` | `text` | NOT NULL | `'yellow'::text` |
| 15 | `sla_due_at` | `timestamptz` | NULL | `` |
| 16 | `status` | `text` | NOT NULL | `'open'::text` |
| 17 | `evidence_refs` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 18 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 19 | `created_by` | `text` | NOT NULL | `'codex_automation'::text` |
| 20 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 21 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `closed_at` | `timestamptz` | NULL | `` |

## proactive_outbox

行数 (概算): -1
PRIMARY KEY: `outbox_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `outbox_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `loop_id` | `uuid` | NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `institution_id` | `text` | NULL | `` |
| 5 | `meeting_id` | `text` | NULL | `` |
| 6 | `calendar_event_id` | `text` | NULL | `` |
| 7 | `source_kind` | `text` | NOT NULL | `` |
| 8 | `source_id` | `text` | NULL | `` |
| 9 | `source_hash` | `text` | NULL | `` |
| 10 | `trigger_type` | `text` | NOT NULL | `` |
| 11 | `ball_owner` | `text` | NOT NULL | `'ambiguous'::text` |
| 12 | `priority` | `text` | NOT NULL | `'yellow'::text` |
| 13 | `draft_type` | `text` | NOT NULL | `` |
| 14 | `recommended_first_move` | `text` | NOT NULL | `` |
| 15 | `risk_if_late` | `text` | NOT NULL | `` |
| 16 | `due_at` | `timestamptz` | NOT NULL | `` |
| 17 | `commander_thread_id` | `text` | NULL | `` |
| 18 | `status` | `text` | NOT NULL | `'queued'::text` |
| 19 | `sent_at` | `timestamptz` | NULL | `` |
| 20 | `drafted_at` | `timestamptz` | NULL | `` |
| 21 | `sent_to_counterpart_at` | `timestamptz` | NULL | `` |
| 22 | `closed_at` | `timestamptz` | NULL | `` |
| 23 | `blocked_reason` | `text` | NULL | `` |
| 24 | `evidence_refs` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 25 | `draft_artifact_refs` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 26 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 27 | `created_by` | `text` | NOT NULL | `'codex_automation'::text` |
| 28 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 29 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## proactive_todos

行数 (概算): 443
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `trigger_kind` | `text` | NOT NULL | `` |
| 4 | `source_meeting_id` | `text` | NOT NULL | `''::text` |
| 5 | `source_event_id` | `text` | NOT NULL | `''::text` |
| 6 | `title` | `text` | NOT NULL | `` |
| 7 | `detail` | `text` | NULL | `` |
| 8 | `ball_owner` | `text` | NOT NULL | `'ambiguous'::text` |
| 9 | `due_at` | `timestamptz` | NULL | `` |
| 10 | `priority` | `text` | NOT NULL | `'normal'::text` |
| 11 | `status` | `text` | NOT NULL | `'open'::text` |
| 12 | `resolved_note` | `text` | NULL | `` |
| 13 | `resolved_by` | `text` | NULL | `` |
| 14 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `resolved_at` | `timestamptz` | NULL | `` |
| 17 | `due_basis` | `text` | NOT NULL | `'unknown'::text` |
| 18 | `attention_state` | `text` | NOT NULL | `'pending'::text` |
| 19 | `attention_type` | `text` | NULL | `` |
| 20 | `attention_owner` | `text` | NOT NULL | `'none'::text` |
| 21 | `requires_masa_decision` | `bool` | NOT NULL | `false` |
| 22 | `attention_reason` | `text` | NULL | `` |
| 23 | `attention_action` | `text` | NULL | `` |
| 24 | `attention_effect` | `text` | NULL | `` |
| 25 | `attention_confidence` | `numeric` | NULL | `` |
| 26 | `attention_source_hash` | `text` | NULL | `` |
| 27 | `attention_reviewed_at` | `timestamptz` | NULL | `` |
| 28 | `attention_reviewed_by` | `text` | NULL | `` |
| 29 | `generation_key` | `text` | NULL | `` |
| 30 | `evidence_refs` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 31 | `completion_condition` | `text` | NULL | `` |

## progress_estimate_state

行数 (概算): 34
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

## project_access_memberships

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(user_account_id,project_id)` (constraint: `project_access_memberships_user_account_id_project_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `user_account_id` | `uuid` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `role` | `text` | NOT NULL | `'contributor'::text` |
| 5 | `status` | `text` | NOT NULL | `'invited'::text` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_bzm_2_2_acquisitions

行数 (概算): -1
PRIMARY KEY: `acquisition_id`
UNIQUE: `(project_id,canonical_event_key)` (constraint: `project_bzm_2_2_acquisitions_project_id_canonical_event_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `acquisition_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `canonical_event_key` | `text` | NOT NULL | `` |
| 4 | `occurred_on` | `date` | NOT NULL | `` |
| 5 | `title` | `text` | NOT NULL | `` |
| 6 | `summary` | `text` | NOT NULL | `''::text` |
| 7 | `audit_tags` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 8 | `evidence_stage` | `text` | NOT NULL | `'missing'::text` |
| 9 | `evidence_refs` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 10 | `state_effects` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 11 | `closed_constraints` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 12 | `consumed` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 13 | `action_delta` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 14 | `numeric_binding` | `text` | NOT NULL | `'display_only'::text` |
| 15 | `bound_target` | `text` | NOT NULL | `''::text` |
| 16 | `information_cutoff` | `date` | NULL | `` |
| 17 | `model_version` | `text` | NOT NULL | `'bzm2.2-acquisition/v1'::text` |
| 18 | `source_origin` | `text` | NOT NULL | `'manual'::text` |
| 19 | `status` | `text` | NOT NULL | `'active'::text` |
| 20 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 21 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_capital_plan_versions

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `plan_id` | `uuid` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `version` | `int4` | NOT NULL | `` |
| 5 | `source_revision` | `int4` | NOT NULL | `` |
| 6 | `document_json` | `jsonb` | NOT NULL | `` |
| 7 | `validation_summary` | `jsonb` | NULL | `` |
| 8 | `published_by_email` | `text` | NULL | `` |
| 9 | `published_at` | `timestamptz` | NOT NULL | `now()` |

## project_capital_plans

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `name` | `text` | NOT NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'active'::text` |
| 5 | `revision` | `int4` | NOT NULL | `1` |
| 6 | `document_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 7 | `latest_frozen_version` | `int4` | NULL | `` |
| 8 | `created_by_email` | `text` | NULL | `` |
| 9 | `updated_by_email` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_commander_threads

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,commander_thread_id)` (constraint: `project_commander_threads_project_id_commander_thread_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `institution_id` | `text` | NULL | `` |
| 4 | `commander_thread_id` | `text` | NOT NULL | `` |
| 5 | `thread_label` | `text` | NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'active'::text` |
| 7 | `created_by` | `text` | NOT NULL | `'codex_worker'::text` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_company_profiles

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id)` (constraint: `project_company_profiles_project_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `legal_status` | `text` | NOT NULL | `'pre_incorporation'::text` |
| 4 | `legal_name` | `text` | NULL | `` |
| 5 | `legal_name_en` | `text` | NULL | `` |
| 6 | `corporate_number` | `text` | NULL | `` |
| 7 | `entity_type` | `text` | NULL | `` |
| 8 | `incorporated_on` | `date` | NULL | `` |
| 9 | `head_office` | `text` | NULL | `` |
| 10 | `business_purpose` | `text` | NULL | `` |
| 11 | `representative_name` | `text` | NULL | `` |
| 12 | `capital_yen` | `int8` | NULL | `` |
| 13 | `authorized_shares` | `int8` | NULL | `` |
| 14 | `registered_issued_shares` | `numeric` | NULL | `` |
| 15 | `board_structure` | `text` | NULL | `` |
| 16 | `has_board` | `bool` | NULL | `` |
| 17 | `has_auditor` | `bool` | NULL | `` |
| 18 | `fiscal_year_end_month` | `int4` | NULL | `` |
| 19 | `public_notice_method` | `text` | NULL | `` |
| 20 | `invoice_registration_number` | `text` | NULL | `` |
| 21 | `source_ref` | `text` | NULL | `` |
| 22 | `source_verified_on` | `date` | NULL | `` |
| 23 | `notes` | `text` | NULL | `` |
| 24 | `created_by_email` | `text` | NULL | `` |
| 25 | `updated_by_email` | `text` | NULL | `` |
| 26 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 27 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

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

## project_convertible_instruments

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `round_id` | `uuid` | NULL | `` |
| 4 | `holder_name` | `text` | NOT NULL | `` |
| 5 | `instrument_type` | `text` | NOT NULL | `'J-KISS'::text` |
| 6 | `issued_on` | `date` | NULL | `` |
| 7 | `principal_yen` | `int8` | NULL | `` |
| 8 | `valuation_cap_yen` | `int8` | NULL | `` |
| 9 | `discount_rate` | `numeric` | NULL | `` |
| 10 | `conversion_trigger` | `text` | NULL | `` |
| 11 | `maturity_on` | `date` | NULL | `` |
| 12 | `estimated_conversion_price` | `numeric` | NULL | `` |
| 13 | `estimated_conversion_shares` | `numeric` | NULL | `` |
| 14 | `status` | `text` | NOT NULL | `'outstanding'::text` |
| 15 | `source_ref` | `text` | NULL | `` |
| 16 | `notes` | `text` | NULL | `` |
| 17 | `created_by_email` | `text` | NULL | `` |
| 18 | `updated_by_email` | `text` | NULL | `` |
| 19 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_cost_assumptions

行数 (概算): -1
PRIMARY KEY: `cost_assumption_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `cost_assumption_id` | `text` | NOT NULL | `` |
| 2 | `cost_model_id` | `text` | NOT NULL | `` |
| 3 | `code` | `text` | NULL | `` |
| 4 | `group_label` | `text` | NOT NULL | `` |
| 5 | `label` | `text` | NOT NULL | `` |
| 6 | `value` | `numeric` | NULL | `` |
| 7 | `value_text` | `text` | NULL | `` |
| 8 | `unit` | `text` | NULL | `` |
| 9 | `confidence` | `text` | NULL | `` |
| 10 | `source_kind` | `text` | NULL | `` |
| 11 | `owner` | `text` | NULL | `` |
| 12 | `is_key` | `bool` | NOT NULL | `false` |
| 13 | `role_key` | `text` | NULL | `` |
| 14 | `note` | `text` | NULL | `` |
| 15 | `visibility` | `text` | NOT NULL | `'amd_internal'::text` |
| 16 | `sort_order` | `int4` | NOT NULL | `0` |
| 17 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_cost_items

行数 (概算): 137
PRIMARY KEY: `cost_item_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `cost_item_id` | `text` | NOT NULL | `` |
| 2 | `cost_model_id` | `text` | NOT NULL | `` |
| 3 | `scenario` | `text` | NOT NULL | `` |
| 4 | `cost_type` | `text` | NOT NULL | `` |
| 5 | `group_label` | `text` | NULL | `` |
| 6 | `mid_label` | `text` | NULL | `` |
| 7 | `leaf_label` | `text` | NULL | `` |
| 8 | `basis` | `text` | NOT NULL | `` |
| 9 | `quantity` | `numeric` | NOT NULL | `1` |
| 10 | `quantity_unit` | `text` | NULL | `` |
| 11 | `unit_price` | `numeric` | NOT NULL | `0` |
| 12 | `unit_price_unit` | `text` | NULL | `` |
| 13 | `price_rule` | `text` | NULL | `` |
| 14 | `annual_factor` | `numeric` | NOT NULL | `1` |
| 15 | `useful_life_years` | `numeric` | NULL | `` |
| 16 | `is_breakdown` | `bool` | NOT NULL | `false` |
| 17 | `confidence` | `text` | NULL | `` |
| 18 | `source_kind` | `text` | NULL | `` |
| 19 | `owner` | `text` | NULL | `` |
| 20 | `note` | `text` | NULL | `` |
| 21 | `visibility` | `text` | NOT NULL | `'amd_internal'::text` |
| 22 | `sort_order` | `int4` | NOT NULL | `0` |
| 23 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 24 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_cost_models

行数 (概算): -1
PRIMARY KEY: `cost_model_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `cost_model_id` | `text` | NOT NULL | `` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `title` | `text` | NOT NULL | `` |
| 4 | `case_kind` | `text` | NOT NULL | `` |
| 5 | `case_label` | `text` | NOT NULL | `` |
| 6 | `version_label` | `text` | NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'active'::text` |
| 8 | `source_url` | `text` | NULL | `` |
| 9 | `source_note` | `text` | NULL | `` |
| 10 | `summary_md` | `text` | NULL | `` |
| 11 | `visibility` | `text` | NOT NULL | `'amd_internal'::text` |
| 12 | `created_by` | `text` | NULL | `` |
| 13 | `updated_by` | `text` | NULL | `` |
| 14 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `system_scope_md` | `text` | NULL | `` |
| 17 | `target_total_cost_per_m3` | `numeric` | NULL | `` |
| 18 | `target_margin_rate` | `numeric` | NULL | `` |
| 19 | `target_note` | `text` | NULL | `` |
| 20 | `unit_basis_label` | `text` | NOT NULL | `'m³'::text` |

## project_cost_notes

行数 (概算): -1
PRIMARY KEY: `cost_note_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `cost_note_id` | `text` | NOT NULL | `` |
| 2 | `cost_model_id` | `text` | NOT NULL | `` |
| 3 | `section` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `body_md` | `text` | NULL | `` |
| 6 | `source_url` | `text` | NULL | `` |
| 7 | `source_label` | `text` | NULL | `` |
| 8 | `visibility` | `text` | NOT NULL | `'amd_internal'::text` |
| 9 | `sort_order` | `int4` | NOT NULL | `0` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_cost_questions

行数 (概算): -1
PRIMARY KEY: `cost_question_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `cost_question_id` | `text` | NOT NULL | `` |
| 2 | `cost_model_id` | `text` | NOT NULL | `` |
| 3 | `addressee` | `text` | NOT NULL | `` |
| 4 | `question` | `text` | NOT NULL | `` |
| 5 | `why_it_matters` | `text` | NULL | `` |
| 6 | `impact_low` | `numeric` | NULL | `` |
| 7 | `impact_high` | `numeric` | NULL | `` |
| 8 | `status` | `text` | NOT NULL | `'open'::text` |
| 9 | `answer` | `text` | NULL | `` |
| 10 | `answered_on` | `date` | NULL | `` |
| 11 | `linked_assumption_id` | `text` | NULL | `` |
| 12 | `visibility` | `text` | NOT NULL | `'amd_internal'::text` |
| 13 | `sort_order` | `int4` | NOT NULL | `0` |
| 14 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_documents

行数 (概算): -1
PRIMARY KEY: `document_id`
UNIQUE: `(drive_file_id)` (constraint: `project_documents_drive_file_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `document_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `drive_file_id` | `text` | NOT NULL | `` |
| 4 | `project_drive_folder_id` | `text` | NOT NULL | `` |
| 5 | `drive_folder_id` | `text` | NOT NULL | `` |
| 6 | `web_view_link` | `text` | NOT NULL | `` |
| 7 | `file_name` | `text` | NOT NULL | `` |
| 8 | `mime_type` | `text` | NOT NULL | `'application/octet-stream'::text` |
| 9 | `file_size_bytes` | `int8` | NOT NULL | `0` |
| 10 | `upload_status` | `text` | NOT NULL | `'active'::text` |
| 11 | `source_kind` | `text` | NOT NULL | `'manual_upload'::text` |
| 12 | `uploaded_by` | `text` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `delivered_to_client_at` | `timestamptz` | NULL | `` |

## project_equity_entries

行数 (概算): 57
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `transaction_id` | `uuid` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `holder_type` | `text` | NULL | `` |
| 5 | `holder_name` | `text` | NOT NULL | `` |
| 6 | `security_class` | `text` | NOT NULL | `'普通株式'::text` |
| 7 | `outstanding_delta` | `numeric` | NOT NULL | `0` |
| 8 | `diluted_delta` | `numeric` | NOT NULL | `0` |
| 9 | `paid_in_yen_delta` | `int8` | NOT NULL | `0` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## project_equity_transactions

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `round_id` | `uuid` | NULL | `` |
| 4 | `effective_on` | `date` | NOT NULL | `` |
| 5 | `transaction_type` | `text` | NOT NULL | `` |
| 6 | `description` | `text` | NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'confirmed'::text` |
| 8 | `source_ref` | `text` | NULL | `` |
| 9 | `notes` | `text` | NULL | `` |
| 10 | `created_by_email` | `text` | NULL | `` |
| 11 | `updated_by_email` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

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

## project_financial_periods

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,fiscal_year)` (constraint: `project_financial_periods_project_id_fiscal_year_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `fiscal_year` | `int4` | NOT NULL | `` |
| 4 | `period_start_on` | `date` | NULL | `` |
| 5 | `period_end_on` | `date` | NULL | `` |
| 6 | `statement_status` | `text` | NOT NULL | `'draft'::text` |
| 7 | `revenue_yen` | `int8` | NULL | `` |
| 8 | `operating_income_yen` | `int8` | NULL | `` |
| 9 | `ordinary_income_yen` | `int8` | NULL | `` |
| 10 | `net_income_yen` | `int8` | NULL | `` |
| 11 | `total_assets_yen` | `int8` | NULL | `` |
| 12 | `total_liabilities_yen` | `int8` | NULL | `` |
| 13 | `net_assets_yen` | `int8` | NULL | `` |
| 14 | `cash_yen` | `int8` | NULL | `` |
| 15 | `debt_yen` | `int8` | NULL | `` |
| 16 | `filed_on` | `date` | NULL | `` |
| 17 | `source_ref` | `text` | NULL | `` |
| 18 | `notes` | `text` | NULL | `` |
| 19 | `created_by_email` | `text` | NULL | `` |
| 20 | `updated_by_email` | `text` | NULL | `` |
| 21 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

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

行数 (概算): 48
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

## project_grants

行数 (概算): 51
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `grant_name` | `text` | NOT NULL | `` |
| 4 | `agency` | `text` | NULL | `` |
| 5 | `grant_type` | `text` | NULL | `` |
| 6 | `amount_yen` | `int8` | NULL | `` |
| 7 | `disbursed_yen` | `int8` | NULL | `` |
| 8 | `status` | `text` | NOT NULL | `'active'::text` |
| 9 | `is_current` | `bool` | NULL | `true` |
| 10 | `adopted_date` | `date` | NULL | `` |
| 11 | `period_start_ym` | `text` | NULL | `` |
| 12 | `period_end_ym` | `text` | NULL | `` |
| 13 | `source_ref` | `text` | NULL | `` |
| 14 | `notes` | `text` | NULL | `` |
| 15 | `created_by` | `text` | NULL | `` |
| 16 | `updated_by` | `text` | NULL | `` |
| 17 | `created_at` | `timestamptz` | NULL | `now()` |
| 18 | `updated_at` | `timestamptz` | NULL | `now()` |
| 19 | `amd_contribution_status` | `text` | NOT NULL | `'unreviewed'::text` |
| 20 | `amd_contributed_yen` | `int8` | NULL | `` |
| 21 | `amd_contribution_note` | `text` | NULL | `` |

## project_important_documents

行数 (概算): -1
PRIMARY KEY: `important_document_id`
UNIQUE: `(project_id,content_sha256)` (constraint: `project_important_documents_content_uniq`)
UNIQUE: `(source_gap_id)` (constraint: `project_important_documents_gap_uniq`)
UNIQUE: `(source_hash)` (constraint: `project_important_documents_source_hash_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `important_document_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `source_gap_id` | `text` | NOT NULL | `` |
| 4 | `source_hash` | `text` | NOT NULL | `` |
| 5 | `content_sha256` | `text` | NOT NULL | `` |
| 6 | `document_class` | `text` | NOT NULL | `` |
| 7 | `document_title` | `text` | NOT NULL | `` |
| 8 | `company_name` | `text` | NOT NULL | `` |
| 9 | `mime_type` | `text` | NOT NULL | `` |
| 10 | `reporting_period_start` | `date` | NOT NULL | `` |
| 11 | `reporting_period_end` | `date` | NOT NULL | `` |
| 12 | `balance_sheet_date` | `date` | NULL | `` |
| 13 | `audited` | `bool` | NOT NULL | `false` |
| 14 | `audit_opinion` | `text` | NOT NULL | `'unknown'::text` |
| 15 | `audit_signed_on` | `date` | NULL | `` |
| 16 | `canonical_file_id` | `text` | NOT NULL | `` |
| 17 | `lineage_json` | `jsonb` | NOT NULL | `` |
| 18 | `version_family_key` | `text` | NOT NULL | `` |
| 19 | `version_rank` | `int4` | NOT NULL | `` |
| 20 | `version_state` | `text` | NOT NULL | `` |
| 21 | `facts_json` | `jsonb` | NOT NULL | `` |
| 22 | `bzm_input_candidates_json` | `jsonb` | NOT NULL | `` |
| 23 | `missing_fields_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 24 | `status` | `text` | NOT NULL | `'confirmed'::text` |
| 25 | `confirmed_by` | `text` | NOT NULL | `` |
| 26 | `confirmed_at` | `timestamptz` | NOT NULL | `` |
| 27 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 28 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_important_evidence

行数 (概算): -1
PRIMARY KEY: `important_evidence_id`
UNIQUE: `(project_id,content_sha256)` (constraint: `project_important_evidence_content_uniq`)
UNIQUE: `(source_gap_id)` (constraint: `project_important_evidence_gap_uniq`)
UNIQUE: `(source_hash)` (constraint: `project_important_evidence_source_hash_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `important_evidence_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `source_gap_id` | `text` | NOT NULL | `` |
| 4 | `source` | `text` | NOT NULL | `` |
| 5 | `source_ref` | `text` | NOT NULL | `` |
| 6 | `source_hash` | `text` | NOT NULL | `` |
| 7 | `content_sha256` | `text` | NOT NULL | `` |
| 8 | `material_kind` | `text` | NOT NULL | `` |
| 9 | `document_class` | `text` | NOT NULL | `` |
| 10 | `title` | `text` | NOT NULL | `` |
| 11 | `mime_type` | `text` | NULL | `` |
| 12 | `importance_json` | `jsonb` | NOT NULL | `` |
| 13 | `ownership_json` | `jsonb` | NOT NULL | `` |
| 14 | `effective_period_start` | `date` | NULL | `` |
| 15 | `effective_period_end` | `date` | NULL | `` |
| 16 | `balance_sheet_date` | `date` | NULL | `` |
| 17 | `audited` | `bool` | NOT NULL | `false` |
| 18 | `audit_opinion` | `text` | NOT NULL | `'unknown'::text` |
| 19 | `audit_signed_on` | `date` | NULL | `` |
| 20 | `canonical_source_ref` | `text` | NOT NULL | `` |
| 21 | `lineage_json` | `jsonb` | NOT NULL | `` |
| 22 | `version_family_key` | `text` | NOT NULL | `` |
| 23 | `version_rank` | `int4` | NOT NULL | `` |
| 24 | `version_state` | `text` | NOT NULL | `` |
| 25 | `facts_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 26 | `due_items_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 27 | `proposed_targets_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 28 | `bzm_input_candidates_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 29 | `missing_fields_json` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 30 | `text_read_required` | `bool` | NOT NULL | `false` |
| 31 | `status` | `text` | NOT NULL | `'confirmed'::text` |
| 32 | `confirmed_by` | `text` | NOT NULL | `` |
| 33 | `confirmed_at` | `timestamptz` | NOT NULL | `` |
| 34 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 35 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_ip_assets

行数 (概算): 13
PRIMARY KEY: `ip_asset_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `ip_asset_id` | `text` | NOT NULL | `` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `relation` | `text` | NOT NULL | `'own'::text` |
| 4 | `ip_kind` | `text` | NOT NULL | `'patent'::text` |
| 5 | `title` | `text` | NOT NULL | `` |
| 6 | `abstract_text` | `text` | NULL | `` |
| 7 | `jurisdiction` | `text` | NOT NULL | `'JP'::text` |
| 8 | `family_key` | `text` | NULL | `` |
| 9 | `application_number` | `text` | NULL | `` |
| 10 | `publication_number` | `text` | NULL | `` |
| 11 | `registration_number` | `text` | NULL | `` |
| 12 | `application_date` | `date` | NULL | `` |
| 13 | `publication_date` | `date` | NULL | `` |
| 14 | `registration_date` | `date` | NULL | `` |
| 15 | `expiry_date` | `date` | NULL | `` |
| 16 | `applicants` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 17 | `inventors` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 18 | `status` | `text` | NOT NULL | `'unknown'::text` |
| 19 | `tech_domain` | `text` | NULL | `` |
| 20 | `ipc_codes` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 21 | `cpc_codes` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 22 | `claim_breadth` | `int2` | NULL | `` |
| 23 | `importance` | `int2` | NOT NULL | `3` |
| 24 | `threat_level` | `text` | NULL | `` |
| 25 | `confidentiality` | `text` | NOT NULL | `'internal'::text` |
| 26 | `note_md` | `text` | NULL | `` |
| 27 | `external_url` | `text` | NULL | `` |
| 28 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 29 | `external_sync_at` | `timestamptz` | NULL | `` |
| 30 | `external_raw` | `jsonb` | NULL | `` |
| 31 | `created_by` | `text` | NULL | `` |
| 32 | `updated_by` | `text` | NULL | `` |
| 33 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 34 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 35 | `priority_date` | `date` | NULL | `` |
| 36 | `examination_requested_on` | `date` | NULL | `` |
| 37 | `annuity_status` | `text` | NOT NULL | `'unknown'::text` |
| 38 | `annuity_paid_through_on` | `date` | NULL | `` |
| 39 | `pct_status` | `text` | NOT NULL | `'unknown'::text` |
| 40 | `pct_number` | `text` | NULL | `` |
| 41 | `current_assignee` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 42 | `practice_status` | `text` | NOT NULL | `'unknown'::text` |
| 43 | `annual_cost_yen` | `numeric` | NULL | `` |
| 44 | `owner_member_id` | `text` | NULL | `` |
| 45 | `attorney_firm` | `text` | NULL | `` |
| 46 | `last_verified_on` | `date` | NULL | `` |
| 47 | `family_size` | `int4` | NULL | `` |
| 48 | `citation_count` | `int4` | NULL | `` |

## project_ip_deadlines

行数 (概算): -1
PRIMARY KEY: `ip_deadline_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `ip_deadline_id` | `text` | NOT NULL | `` |
| 2 | `ip_asset_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `deadline_kind` | `text` | NOT NULL | `` |
| 5 | `label` | `text` | NULL | `` |
| 6 | `due_on` | `date` | NOT NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'open'::text` |
| 8 | `owner_member_id` | `text` | NULL | `` |
| 9 | `note` | `text` | NULL | `` |
| 10 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 11 | `notified_at` | `timestamptz` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_ip_events

行数 (概算): -1
PRIMARY KEY: `ip_event_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `ip_event_id` | `text` | NOT NULL | `` |
| 2 | `ip_asset_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `event_date` | `date` | NOT NULL | `` |
| 5 | `event_kind` | `text` | NOT NULL | `` |
| 6 | `title` | `text` | NOT NULL | `` |
| 7 | `detail` | `text` | NULL | `` |
| 8 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 9 | `external_raw` | `jsonb` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## project_ip_rights

行数 (概算): -1
PRIMARY KEY: `ip_right_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `ip_right_id` | `text` | NOT NULL | `` |
| 2 | `ip_asset_id` | `text` | NOT NULL | `` |
| 3 | `holder_kind` | `text` | NOT NULL | `` |
| 4 | `holder_name` | `text` | NOT NULL | `` |
| 5 | `share_pct` | `numeric` | NULL | `` |
| 6 | `license_to_project` | `text` | NOT NULL | `'none'::text` |
| 7 | `license_agreement_status` | `text` | NOT NULL | `'none'::text` |
| 8 | `royalty_terms` | `text` | NULL | `` |
| 9 | `non_practice_compensation` | `text` | NULL | `` |
| 10 | `contract_id` | `uuid` | NULL | `` |
| 11 | `note` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_killer_factor_states

行数 (概算): 189
PRIMARY KEY: `state_id`
UNIQUE: `(project_id,killer_factor_id)` (constraint: `project_killer_factor_states_pair_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `state_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `killer_factor_id` | `uuid` | NOT NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'unchecked'::text` |
| 5 | `occurred_on` | `date` | NULL | `` |
| 6 | `evidence_note` | `text` | NULL | `` |
| 7 | `recorded_by_member_id` | `text` | NULL | `` |
| 8 | `recorded_at` | `timestamptz` | NULL | `` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `status_on` | `date` | NULL | `` |
| 11 | `target_on` | `date` | NULL | `` |

## project_knowledge

行数 (概算): 2,808
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

## project_management_action_items

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `decision_id` | `uuid` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `owner_label` | `text` | NOT NULL | `` |
| 6 | `due_date` | `date` | NULL | `` |
| 7 | `completion_criteria` | `text` | NOT NULL | `'完了条件未確認'::text` |
| 8 | `next_review_on` | `date` | NULL | `` |
| 9 | `status` | `text` | NOT NULL | `'open'::text` |
| 10 | `completion_note` | `text` | NULL | `` |
| 11 | `completed_at` | `date` | NULL | `` |
| 12 | `last_verified_at` | `date` | NOT NULL | `` |
| 13 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 14 | `source_ref` | `text` | NULL | `` |
| 15 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `deleted_at` | `timestamptz` | NULL | `` |
| 18 | `deleted_by` | `text` | NULL | `` |
| 19 | `version` | `int4` | NOT NULL | `1` |

## project_management_capacity

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `track` | `text` | NOT NULL | `` |
| 4 | `milestone_id` | `uuid` | NULL | `` |
| 5 | `role_label` | `text` | NOT NULL | `` |
| 6 | `required_people` | `numeric` | NOT NULL | `0` |
| 7 | `confirmed_people` | `numeric` | NOT NULL | `0` |
| 8 | `available_hours_week` | `numeric` | NULL | `` |
| 9 | `planned_hours_week` | `numeric` | NULL | `` |
| 10 | `measurement_date` | `date` | NOT NULL | `` |
| 11 | `source_label` | `text` | NOT NULL | `` |
| 12 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 13 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 14 | `source_ref` | `text` | NULL | `` |
| 15 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `deleted_at` | `timestamptz` | NULL | `` |
| 18 | `deleted_by` | `text` | NULL | `` |
| 19 | `version` | `int4` | NOT NULL | `1` |

## project_management_decisions

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `issue_id` | `uuid` | NULL | `` |
| 4 | `hypothesis_id` | `uuid` | NULL | `` |
| 5 | `title` | `text` | NOT NULL | `` |
| 6 | `context` | `text` | NOT NULL | `` |
| 7 | `decision_state` | `text` | NOT NULL | `'pending'::text` |
| 8 | `rationale` | `text` | NOT NULL | `` |
| 9 | `decision_text` | `text` | NULL | `` |
| 10 | `decided_by` | `text` | NULL | `` |
| 11 | `decided_on` | `date` | NULL | `` |
| 12 | `owner_label` | `text` | NOT NULL | `` |
| 13 | `due_date` | `date` | NULL | `` |
| 14 | `is_this_week` | `bool` | NOT NULL | `false` |
| 15 | `sort_order` | `int4` | NOT NULL | `0` |
| 16 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 17 | `last_verified_at` | `date` | NOT NULL | `` |
| 18 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 19 | `source_ref` | `text` | NULL | `` |
| 20 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 21 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `deleted_at` | `timestamptz` | NULL | `` |
| 23 | `deleted_by` | `text` | NULL | `` |
| 24 | `version` | `int4` | NOT NULL | `1` |

## project_management_evidence

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `issue_id` | `uuid` | NOT NULL | `` |
| 4 | `hypothesis_id` | `uuid` | NULL | `` |
| 5 | `evidence_kind` | `text` | NOT NULL | `` |
| 6 | `summary` | `text` | NOT NULL | `` |
| 7 | `observed_on` | `date` | NULL | `` |
| 8 | `source_label` | `text` | NOT NULL | `` |
| 9 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 10 | `last_verified_at` | `date` | NOT NULL | `` |
| 11 | `created_by` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `deleted_at` | `timestamptz` | NULL | `` |
| 14 | `deleted_by` | `text` | NULL | `` |
| 15 | `version` | `int4` | NOT NULL | `1` |

## project_management_field_audit

行数 (概算): 10,343
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `entity_type` | `text` | NOT NULL | `` |
| 4 | `entity_id` | `uuid` | NOT NULL | `` |
| 5 | `field_name` | `text` | NOT NULL | `` |
| 6 | `old_value` | `jsonb` | NULL | `` |
| 7 | `new_value` | `jsonb` | NULL | `` |
| 8 | `source` | `text` | NOT NULL | `` |
| 9 | `version` | `int4` | NOT NULL | `1` |
| 10 | `verified_by` | `text` | NOT NULL | `` |
| 11 | `next_review_on` | `date` | NULL | `` |
| 12 | `recorded_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_funding_snapshots

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,snapshot_date)` (constraint: `project_management_funding_snapsho_project_id_snapshot_date_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `snapshot_date` | `date` | NOT NULL | `` |
| 4 | `required_amount` | `numeric` | NULL | `` |
| 5 | `secured_amount` | `numeric` | NULL | `` |
| 6 | `unconfirmed_amount` | `numeric` | NULL | `` |
| 7 | `use_summary` | `text` | NOT NULL | `` |
| 8 | `burn_per_month` | `numeric` | NULL | `` |
| 9 | `runway_months` | `numeric` | NULL | `` |
| 10 | `probability` | `numeric` | NULL | `` |
| 11 | `cash_condition` | `text` | NOT NULL | `` |
| 12 | `source_label` | `text` | NOT NULL | `` |
| 13 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 14 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 15 | `source_ref` | `text` | NULL | `` |
| 16 | `deleted_at` | `timestamptz` | NULL | `` |
| 17 | `deleted_by` | `text` | NULL | `` |
| 18 | `version` | `int4` | NOT NULL | `1` |
| 19 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_hypotheses

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `issue_id` | `uuid` | NOT NULL | `` |
| 4 | `statement` | `text` | NOT NULL | `` |
| 5 | `status` | `text` | NOT NULL | `'open'::text` |
| 6 | `owner_label` | `text` | NOT NULL | `` |
| 7 | `due_date` | `date` | NULL | `` |
| 8 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 9 | `last_verified_at` | `date` | NOT NULL | `` |
| 10 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 11 | `source_ref` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `deleted_at` | `timestamptz` | NULL | `` |
| 15 | `deleted_by` | `text` | NULL | `` |
| 16 | `version` | `int4` | NOT NULL | `1` |

## project_management_issue_discussions

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `issue_id` | `uuid` | NOT NULL | `` |
| 4 | `summary` | `text` | NOT NULL | `` |
| 5 | `discussed_on` | `date` | NOT NULL | `` |
| 6 | `created_by` | `text` | NOT NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_issues

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,slug)` (constraint: `project_management_issues_project_id_slug_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `milestone_id` | `uuid` | NULL | `` |
| 4 | `outcome_id` | `uuid` | NULL | `` |
| 5 | `slug` | `text` | NOT NULL | `` |
| 6 | `track` | `text` | NOT NULL | `` |
| 7 | `title` | `text` | NOT NULL | `` |
| 8 | `knowledge_type` | `text` | NOT NULL | `` |
| 9 | `status` | `text` | NOT NULL | `'open'::text` |
| 10 | `owner_label` | `text` | NOT NULL | `` |
| 11 | `due_date` | `date` | NULL | `` |
| 12 | `last_verified_at` | `date` | NOT NULL | `` |
| 13 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 14 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 15 | `source_ref` | `text` | NULL | `` |
| 16 | `sort_order` | `int4` | NOT NULL | `0` |
| 17 | `created_by` | `text` | NULL | `` |
| 18 | `updated_by` | `text` | NULL | `` |
| 19 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 21 | `deleted_at` | `timestamptz` | NULL | `` |
| 22 | `deleted_by` | `text` | NULL | `` |
| 23 | `version` | `int4` | NOT NULL | `1` |
| 24 | `background` | `text` | NULL | `` |

## project_management_kpis

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,slug)` (constraint: `project_management_kpis_project_id_slug_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `outcome_id` | `uuid` | NOT NULL | `` |
| 4 | `track` | `text` | NOT NULL | `` |
| 5 | `slug` | `text` | NOT NULL | `` |
| 6 | `title` | `text` | NOT NULL | `` |
| 7 | `metric_kind` | `text` | NOT NULL | `` |
| 8 | `baseline` | `numeric` | NULL | `` |
| 9 | `target` | `numeric` | NULL | `` |
| 10 | `actual` | `numeric` | NULL | `` |
| 11 | `unit` | `text` | NOT NULL | `` |
| 12 | `threshold` | `numeric` | NULL | `` |
| 13 | `measurement_date` | `date` | NULL | `` |
| 14 | `frequency` | `text` | NOT NULL | `` |
| 15 | `source_label` | `text` | NOT NULL | `` |
| 16 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 17 | `last_verified_at` | `date` | NOT NULL | `` |
| 18 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 19 | `source_ref` | `text` | NULL | `` |
| 20 | `created_by` | `text` | NULL | `` |
| 21 | `updated_by` | `text` | NULL | `` |
| 22 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 23 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 24 | `deleted_at` | `timestamptz` | NULL | `` |
| 25 | `deleted_by` | `text` | NULL | `` |
| 26 | `version` | `int4` | NOT NULL | `1` |
| 27 | `threshold_rule` | `text` | NOT NULL | `'gte'::text` |
| 28 | `threshold_upper` | `numeric` | NULL | `` |

## project_management_milestone_dependencies

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,predecessor_milestone_id,successor_milestone_id,dependency_type)` (constraint: `project_management_milestone__project_id_predecessor_milest_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `predecessor_milestone_id` | `uuid` | NOT NULL | `` |
| 4 | `successor_milestone_id` | `uuid` | NOT NULL | `` |
| 5 | `dependency_type` | `text` | NOT NULL | `'finish_to_start'::text` |
| 6 | `required` | `bool` | NOT NULL | `true` |
| 7 | `lag_days` | `int4` | NOT NULL | `0` |
| 8 | `note` | `text` | NULL | `` |
| 9 | `created_by` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `deleted_at` | `timestamptz` | NULL | `` |
| 12 | `deleted_by` | `text` | NULL | `` |
| 13 | `version` | `int4` | NOT NULL | `1` |

## project_management_milestone_issue_links

行数 (概算): -1
PRIMARY KEY: `milestone_id, issue_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `milestone_id` | `uuid` | NOT NULL | `` |
| 3 | `issue_id` | `uuid` | NOT NULL | `` |
| 4 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_milestone_kpis

行数 (概算): -1
PRIMARY KEY: `milestone_id, kpi_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `milestone_id` | `uuid` | NOT NULL | `` |
| 3 | `kpi_id` | `uuid` | NOT NULL | `` |
| 4 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_milestone_partner_links

行数 (概算): -1
PRIMARY KEY: `milestone_id, partner_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `milestone_id` | `uuid` | NOT NULL | `` |
| 3 | `partner_id` | `uuid` | NOT NULL | `` |
| 4 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_milestones

行数 (概算): 43
PRIMARY KEY: `id`
UNIQUE: `(project_id,slug)` (constraint: `project_management_milestones_project_id_slug_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `objective_id` | `uuid` | NOT NULL | `` |
| 4 | `outcome_id` | `uuid` | NOT NULL | `` |
| 5 | `slug` | `text` | NOT NULL | `` |
| 6 | `track` | `text` | NOT NULL | `` |
| 7 | `title` | `text` | NOT NULL | `` |
| 8 | `gate` | `text` | NOT NULL | `` |
| 9 | `status` | `text` | NOT NULL | `'unassessed'::text` |
| 10 | `planned_start` | `date` | NULL | `` |
| 11 | `planned_end` | `date` | NULL | `` |
| 12 | `forecast_end` | `date` | NULL | `` |
| 13 | `actual_end` | `date` | NULL | `` |
| 14 | `progress_pct` | `numeric` | NOT NULL | `0` |
| 15 | `date_certainty` | `text` | NOT NULL | `'provisional'::text` |
| 16 | `owner_member_id` | `text` | NULL | `` |
| 17 | `owner_label` | `text` | NOT NULL | `` |
| 18 | `next_deliverable` | `text` | NOT NULL | `` |
| 19 | `max_issue` | `text` | NOT NULL | `` |
| 20 | `completion_criteria` | `text` | NOT NULL | `` |
| 21 | `completion_evidence` | `text` | NULL | `` |
| 22 | `criticality` | `text` | NOT NULL | `'high'::text` |
| 23 | `baseline_plan_version` | `text` | NOT NULL | `'2026-07-14-current-truth'::text` |
| 24 | `forecast_change_reason` | `text` | NULL | `` |
| 25 | `status_source` | `text` | NOT NULL | `'derived'::text` |
| 26 | `status_reason` | `text` | NULL | `` |
| 27 | `status_override_reason` | `text` | NULL | `` |
| 28 | `status_override_expires_on` | `date` | NULL | `` |
| 29 | `status_override_approved_by` | `text` | NULL | `` |
| 30 | `last_verified_at` | `date` | NOT NULL | `` |
| 31 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 32 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 33 | `source_ref` | `text` | NULL | `` |
| 34 | `sort_order` | `int4` | NOT NULL | `0` |
| 35 | `created_by` | `text` | NULL | `` |
| 36 | `updated_by` | `text` | NULL | `` |
| 37 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 38 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 39 | `deleted_at` | `timestamptz` | NULL | `` |
| 40 | `deleted_by` | `text` | NULL | `` |
| 41 | `version` | `int4` | NOT NULL | `1` |
| 42 | `timeline_kind` | `text` | NOT NULL | `'phase'::text` |
| 43 | `display_lane_keys` | `_text` | NULL | `` |

## project_management_objectives

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,slug)` (constraint: `project_management_objectives_project_id_slug_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `slug` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `definition_of_done` | `text` | NOT NULL | `` |
| 6 | `target_date` | `date` | NULL | `` |
| 7 | `date_certainty` | `text` | NOT NULL | `'provisional'::text` |
| 8 | `status` | `text` | NOT NULL | `'unassessed'::text` |
| 9 | `last_verified_at` | `date` | NOT NULL | `` |
| 10 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 11 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 12 | `source_ref` | `text` | NULL | `` |
| 13 | `created_by` | `text` | NULL | `` |
| 14 | `updated_by` | `text` | NULL | `` |
| 15 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `deleted_at` | `timestamptz` | NULL | `` |
| 18 | `deleted_by` | `text` | NULL | `` |
| 19 | `version` | `int4` | NOT NULL | `1` |

## project_management_organization_roles

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,role_slug)` (constraint: `project_management_organization_roles_project_id_role_slug_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `role_slug` | `text` | NOT NULL | `` |
| 4 | `role_name` | `text` | NOT NULL | `` |
| 5 | `required` | `bool` | NOT NULL | `true` |
| 6 | `candidate` | `text` | NULL | `` |
| 7 | `commitment` | `text` | NULL | `` |
| 8 | `authority` | `text` | NULL | `` |
| 9 | `vacancy` | `bool` | NOT NULL | `true` |
| 10 | `join_condition` | `text` | NOT NULL | `` |
| 11 | `due_date` | `date` | NULL | `` |
| 12 | `status` | `text` | NOT NULL | `'unassessed'::text` |
| 13 | `owner_label` | `text` | NOT NULL | `` |
| 14 | `last_verified_at` | `date` | NOT NULL | `` |
| 15 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 16 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 17 | `source_ref` | `text` | NULL | `` |
| 18 | `deleted_at` | `timestamptz` | NULL | `` |
| 19 | `deleted_by` | `text` | NULL | `` |
| 20 | `version` | `int4` | NOT NULL | `1` |
| 21 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_outcomes

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,slug)` (constraint: `project_management_outcomes_project_id_slug_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `objective_id` | `uuid` | NOT NULL | `` |
| 4 | `slug` | `text` | NOT NULL | `` |
| 5 | `track` | `text` | NOT NULL | `` |
| 6 | `title` | `text` | NOT NULL | `` |
| 7 | `definition_of_done` | `text` | NOT NULL | `` |
| 8 | `owner_label` | `text` | NOT NULL | `` |
| 9 | `status` | `text` | NOT NULL | `'unassessed'::text` |
| 10 | `last_verified_at` | `date` | NOT NULL | `` |
| 11 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 12 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 13 | `source_ref` | `text` | NULL | `` |
| 14 | `created_by` | `text` | NULL | `` |
| 15 | `updated_by` | `text` | NULL | `` |
| 16 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `deleted_at` | `timestamptz` | NULL | `` |
| 19 | `deleted_by` | `text` | NULL | `` |
| 20 | `version` | `int4` | NOT NULL | `1` |

## project_management_partner_commitments

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `partner_id` | `uuid` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `commitment_text` | `text` | NOT NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'open'::text` |
| 7 | `promised_on` | `date` | NULL | `` |
| 8 | `due_date` | `date` | NULL | `` |
| 9 | `completed_on` | `date` | NULL | `` |
| 10 | `owner_label` | `text` | NOT NULL | `` |
| 11 | `counterparty_owner` | `text` | NULL | `` |
| 12 | `sx_owner` | `text` | NULL | `` |
| 13 | `evidence` | `text` | NULL | `` |
| 14 | `next_review_on` | `date` | NULL | `` |
| 15 | `last_verified_at` | `date` | NOT NULL | `` |
| 16 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 17 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 18 | `source_ref` | `text` | NULL | `` |
| 19 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 20 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 21 | `deleted_at` | `timestamptz` | NULL | `` |
| 22 | `deleted_by` | `text` | NULL | `` |
| 23 | `version` | `int4` | NOT NULL | `1` |
| 24 | `commitment_kind` | `text` | NOT NULL | `'sx_followup'::text` |

## project_management_partner_interactions

行数 (概算): 53
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `partner_id` | `uuid` | NOT NULL | `` |
| 4 | `interaction_kind` | `text` | NOT NULL | `` |
| 5 | `occurred_on` | `date` | NULL | `` |
| 6 | `occurred_on_precision` | `text` | NOT NULL | `'unknown'::text` |
| 7 | `summary` | `text` | NOT NULL | `` |
| 8 | `outcome_summary` | `text` | NULL | `` |
| 9 | `ball_side_after` | `text` | NOT NULL | `'unknown'::text` |
| 10 | `ball_owner_after` | `text` | NULL | `` |
| 11 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 12 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 13 | `source_ref` | `text` | NULL | `` |
| 14 | `deleted_at` | `timestamptz` | NULL | `` |
| 15 | `deleted_by` | `text` | NULL | `` |
| 16 | `version` | `int4` | NOT NULL | `1` |
| 17 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 19 | `actor_side` | `text` | NOT NULL | `'unknown'::text` |
| 20 | `actor_label` | `text` | NULL | `` |
| 21 | `detail_md` | `text` | NULL | `` |

## project_management_partner_roles

行数 (概算): 6
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `partner_id` | `uuid` | NOT NULL | `` |
| 4 | `role_kind` | `text` | NOT NULL | `` |
| 5 | `relationship_state` | `text` | NOT NULL | `'unconfirmed'::text` |
| 6 | `role_label` | `text` | NULL | `` |
| 7 | `is_primary` | `bool` | NOT NULL | `false` |
| 8 | `sort_order` | `int4` | NOT NULL | `0` |
| 9 | `deleted_at` | `timestamptz` | NULL | `` |
| 10 | `deleted_by` | `text` | NULL | `` |
| 11 | `version` | `int4` | NOT NULL | `1` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 15 | `source_ref` | `text` | NULL | `` |

## project_management_partner_samples

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `partner_id` | `uuid` | NOT NULL | `` |
| 4 | `label` | `text` | NOT NULL | `` |
| 5 | `status` | `text` | NOT NULL | `'unknown'::text` |
| 6 | `received_on` | `date` | NULL | `` |
| 7 | `storage_location` | `text` | NULL | `` |
| 8 | `owner_label` | `text` | NULL | `` |
| 9 | `notes` | `text` | NULL | `` |
| 10 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 11 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 12 | `source_ref` | `text` | NULL | `` |
| 13 | `sort_order` | `int4` | NOT NULL | `0` |
| 14 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `deleted_at` | `timestamptz` | NULL | `` |
| 17 | `deleted_by` | `text` | NULL | `` |
| 18 | `version` | `int4` | NOT NULL | `1` |

## project_management_partner_tracks

行数 (概算): -1
PRIMARY KEY: `partner_id, track`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `partner_id` | `uuid` | NOT NULL | `` |
| 3 | `track` | `text` | NOT NULL | `` |
| 4 | `role_label` | `text` | NOT NULL | `` |
| 5 | `is_primary` | `bool` | NOT NULL | `false` |
| 6 | `deleted_at` | `timestamptz` | NULL | `` |
| 7 | `deleted_by` | `text` | NULL | `` |
| 8 | `version` | `int4` | NOT NULL | `1` |

## project_management_partner_work_items

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `partner_id` | `uuid` | NOT NULL | `` |
| 4 | `side` | `text` | NOT NULL | `'unknown'::text` |
| 5 | `item_kind` | `text` | NOT NULL | `` |
| 6 | `title` | `text` | NOT NULL | `` |
| 7 | `detail` | `text` | NULL | `` |
| 8 | `owner_label` | `text` | NULL | `` |
| 9 | `status` | `text` | NOT NULL | `'open'::text` |
| 10 | `due_date` | `date` | NULL | `` |
| 11 | `due_date_precision` | `text` | NOT NULL | `'unknown'::text` |
| 12 | `completion_criteria` | `text` | NULL | `` |
| 13 | `completed_on` | `date` | NULL | `` |
| 14 | `completion_evidence` | `text` | NULL | `` |
| 15 | `accepted_by` | `text` | NULL | `` |
| 16 | `accepted_on` | `date` | NULL | `` |
| 17 | `handoff_to` | `text` | NULL | `` |
| 18 | `related_milestone_id` | `uuid` | NULL | `` |
| 19 | `last_verified_at` | `date` | NOT NULL | `` |
| 20 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 21 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 22 | `source_ref` | `text` | NULL | `` |
| 23 | `sort_order` | `int4` | NOT NULL | `0` |
| 24 | `deleted_at` | `timestamptz` | NULL | `` |
| 25 | `deleted_by` | `text` | NULL | `` |
| 26 | `version` | `int4` | NOT NULL | `1` |
| 27 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 28 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_partners

行数 (概算): 75
PRIMARY KEY: `id`
UNIQUE: `(project_id,slug)` (constraint: `project_management_partners_project_id_slug_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `slug` | `text` | NOT NULL | `` |
| 4 | `name` | `text` | NOT NULL | `` |
| 5 | `role_label` | `text` | NOT NULL | `` |
| 6 | `primary_track` | `text` | NULL | `` |
| 7 | `relationship_stage` | `text` | NOT NULL | `` |
| 8 | `agreement_state` | `text` | NOT NULL | `'unagreed'::text` |
| 9 | `agreed_scope` | `text` | NOT NULL | `` |
| 10 | `unagreed_scope` | `text` | NOT NULL | `` |
| 11 | `last_contact_date` | `date` | NULL | `` |
| 12 | `next_commitment` | `text` | NOT NULL | `` |
| 13 | `due_date` | `date` | NULL | `` |
| 14 | `owner_label` | `text` | NOT NULL | `` |
| 15 | `last_verified_at` | `date` | NOT NULL | `` |
| 16 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 17 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 18 | `source_ref` | `text` | NULL | `` |
| 19 | `sort_order` | `int4` | NOT NULL | `0` |
| 20 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 21 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `deleted_at` | `timestamptz` | NULL | `` |
| 23 | `deleted_by` | `text` | NULL | `` |
| 24 | `version` | `int4` | NOT NULL | `1` |
| 25 | `current_ball_side` | `text` | NOT NULL | `'unknown'::text` |
| 26 | `current_ball_owner` | `text` | NULL | `` |
| 27 | `next_ball_owner` | `text` | NULL | `` |
| 28 | `target_state` | `text` | NULL | `` |
| 29 | `due_date_precision` | `text` | NOT NULL | `'unknown'::text` |
| 30 | `introducer_label` | `text` | NULL | `` |
| 31 | `connection_context` | `text` | NULL | `` |
| 32 | `activity_state` | `text` | NOT NULL | `'unknown'::text` |
| 33 | `poc_category` | `text` | NULL | `` |
| 34 | `poc_likelihood` | `text` | NULL | `` |
| 35 | `customer_value` | `text` | NULL | `` |
| 36 | `value_note` | `text` | NULL | `` |
| 37 | `poc_grade` | `text` | NULL | `` |
| 38 | `effluent_components` | `text` | NULL | `` |
| 39 | `effluent_volume_annual` | `text` | NULL | `` |
| 40 | `effluent_cost_annual` | `text` | NULL | `` |
| 41 | `next_meeting_on` | `date` | NULL | `` |
| 42 | `next_meeting_time` | `text` | NULL | `` |
| 43 | `next_meeting_mode` | `text` | NULL | `` |
| 44 | `next_meeting_place` | `text` | NULL | `` |
| 45 | `next_meeting_prep` | `text` | NULL | `` |
| 46 | `next_meeting_goal` | `text` | NULL | `` |
| 47 | `classifications` | `_text` | NOT NULL | `'{}'::text[]` |
| 48 | `effluent_test_result` | `text` | NULL | `` |
| 49 | `effluent_procured` | `bool` | NULL | `` |
| 50 | `effluent_note` | `text` | NULL | `` |

## project_management_raci

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `milestone_id` | `uuid` | NOT NULL | `` |
| 4 | `stakeholder_label` | `text` | NOT NULL | `` |
| 5 | `responsibility_role` | `text` | NOT NULL | `` |
| 6 | `owner_label` | `text` | NOT NULL | `` |
| 7 | `confirmed` | `bool` | NOT NULL | `false` |
| 8 | `last_verified_at` | `date` | NOT NULL | `` |
| 9 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 10 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 11 | `source_ref` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 14 | `deleted_at` | `timestamptz` | NULL | `` |
| 15 | `deleted_by` | `text` | NULL | `` |
| 16 | `version` | `int4` | NOT NULL | `1` |

## project_management_schedule_dependencies

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `predecessor_type` | `text` | NOT NULL | `` |
| 4 | `predecessor_task_id` | `uuid` | NULL | `` |
| 5 | `predecessor_milestone_id` | `uuid` | NULL | `` |
| 6 | `successor_task_id` | `uuid` | NULL | `` |
| 7 | `dependency_type` | `text` | NOT NULL | `'finish_to_start'::text` |
| 8 | `created_by` | `text` | NULL | `` |
| 9 | `updated_by` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `deleted_at` | `timestamptz` | NULL | `` |
| 13 | `deleted_by` | `text` | NULL | `` |
| 14 | `version` | `int4` | NOT NULL | `1` |
| 15 | `successor_type` | `text` | NOT NULL | `'task'::text` |
| 16 | `successor_milestone_id` | `uuid` | NULL | `` |

## project_management_tasks

行数 (概算): 74
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `milestone_id` | `uuid` | NOT NULL | `` |
| 4 | `parent_task_id` | `uuid` | NULL | `` |
| 5 | `track` | `text` | NULL | `` |
| 6 | `title` | `text` | NOT NULL | `` |
| 7 | `description` | `text` | NULL | `` |
| 8 | `status` | `text` | NOT NULL | `'unassessed'::text` |
| 9 | `planned_start` | `date` | NULL | `` |
| 10 | `planned_end` | `date` | NULL | `` |
| 11 | `forecast_end` | `date` | NULL | `` |
| 12 | `actual_end` | `date` | NULL | `` |
| 13 | `progress_pct` | `numeric` | NOT NULL | `0` |
| 14 | `date_certainty` | `text` | NOT NULL | `'provisional'::text` |
| 15 | `owner_member_id` | `text` | NULL | `` |
| 16 | `owner_label` | `text` | NOT NULL | `'担当未確認'::text` |
| 17 | `completion_criteria` | `text` | NULL | `` |
| 18 | `forecast_change_reason` | `text` | NULL | `` |
| 19 | `sort_order` | `int4` | NOT NULL | `0` |
| 20 | `last_verified_at` | `date` | NOT NULL | `CURRENT_DATE` |
| 21 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 22 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 23 | `source_ref` | `text` | NULL | `` |
| 24 | `created_by` | `text` | NULL | `` |
| 25 | `updated_by` | `text` | NULL | `` |
| 26 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 27 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 28 | `deleted_at` | `timestamptz` | NULL | `` |
| 29 | `deleted_by` | `text` | NULL | `` |
| 30 | `version` | `int4` | NOT NULL | `1` |
| 31 | `goal` | `text` | NULL | `` |
| 32 | `next_deliverable` | `text` | NULL | `` |
| 33 | `blocker` | `text` | NULL | `` |

## project_management_technical_tests

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,test_slug)` (constraint: `project_management_technical_tests_project_id_test_slug_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `milestone_id` | `uuid` | NULL | `` |
| 4 | `outcome_id` | `uuid` | NULL | `` |
| 5 | `test_slug` | `text` | NOT NULL | `` |
| 6 | `test_name` | `text` | NOT NULL | `` |
| 7 | `test_condition` | `text` | NOT NULL | `` |
| 8 | `target` | `text` | NULL | `` |
| 9 | `actual` | `text` | NULL | `` |
| 10 | `unit` | `text` | NOT NULL | `` |
| 11 | `repetition` | `int4` | NULL | `` |
| 12 | `sample` | `text` | NULL | `` |
| 13 | `trl_criterion` | `text` | NOT NULL | `` |
| 14 | `evidence` | `text` | NULL | `` |
| 15 | `status` | `text` | NOT NULL | `'unassessed'::text` |
| 16 | `measured_on` | `date` | NULL | `` |
| 17 | `owner_label` | `text` | NOT NULL | `` |
| 18 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 19 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 20 | `source_ref` | `text` | NULL | `` |
| 21 | `deleted_at` | `timestamptz` | NULL | `` |
| 22 | `deleted_by` | `text` | NULL | `` |
| 23 | `version` | `int4` | NOT NULL | `1` |
| 24 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 25 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_track_value_milestones

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,track_key,milestone_id)` (constraint: `project_management_track_valu_project_id_track_key_mileston_key`)
UNIQUE: `(project_id,milestone_id)` (constraint: `project_management_track_value_mile_project_id_milestone_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `track_key` | `text` | NOT NULL | `` |
| 4 | `milestone_id` | `text` | NOT NULL | `` |
| 5 | `sort_order` | `int4` | NOT NULL | `0` |
| 6 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 7 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_tracks

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,track_key)` (constraint: `project_management_tracks_project_id_track_key_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `track_key` | `text` | NOT NULL | `` |
| 4 | `label` | `text` | NOT NULL | `` |
| 5 | `short_label` | `text` | NOT NULL | `` |
| 6 | `accent` | `text` | NOT NULL | `` |
| 7 | `sort_order` | `int4` | NOT NULL | `0` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_management_update_history

行数 (概算): 267
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `entity_type` | `text` | NOT NULL | `` |
| 4 | `entity_id` | `uuid` | NULL | `` |
| 5 | `update_kind` | `text` | NOT NULL | `` |
| 6 | `summary` | `text` | NOT NULL | `` |
| 7 | `changed_by` | `text` | NOT NULL | `` |
| 8 | `changed_on` | `date` | NOT NULL | `` |
| 9 | `from_status` | `text` | NULL | `` |
| 10 | `to_status` | `text` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `deleted_at` | `timestamptz` | NULL | `` |
| 13 | `deleted_by` | `text` | NULL | `` |
| 14 | `version` | `int4` | NOT NULL | `1` |

## project_management_validation_runs

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `hypothesis_id` | `uuid` | NOT NULL | `` |
| 4 | `validation_kind` | `text` | NOT NULL | `` |
| 5 | `planned_on` | `date` | NULL | `` |
| 6 | `due_date` | `date` | NULL | `` |
| 7 | `completed_on` | `date` | NULL | `` |
| 8 | `status` | `text` | NOT NULL | `'planned'::text` |
| 9 | `owner_label` | `text` | NOT NULL | `` |
| 10 | `method` | `text` | NOT NULL | `` |
| 11 | `result_summary` | `text` | NULL | `` |
| 12 | `confidence` | `text` | NOT NULL | `'unknown'::text` |
| 13 | `source_kind` | `text` | NOT NULL | `'current_truth'::text` |
| 14 | `source_ref` | `text` | NULL | `` |
| 15 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `deleted_at` | `timestamptz` | NULL | `` |
| 18 | `deleted_by` | `text` | NULL | `` |
| 19 | `version` | `int4` | NOT NULL | `1` |

## project_media_mentions

行数 (概算): 42
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `occurred_on` | `date` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `media_name` | `text` | NOT NULL | `` |
| 6 | `kind` | `text` | NOT NULL | `'coverage'::text` |
| 7 | `source_url` | `text` | NULL | `` |
| 8 | `summary` | `text` | NULL | `` |
| 9 | `ingested_by` | `text` | NOT NULL | `'manual'::text` |
| 10 | `verified` | `bool` | NOT NULL | `true` |
| 11 | `dismissed` | `bool` | NOT NULL | `false` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_meeting_summaries

行数 (概算): 512
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
| 24 | `prep_source_meeting_id` | `text` | NULL | `` |
| 25 | `prep_status` | `text` | NULL | `` |
| 26 | `facilitator_member_id` | `text` | NULL | `` |
| 27 | `facilitator_nudge_scheduled_at` | `timestamptz` | NULL | `` |
| 28 | `facilitator_slack_scheduled_message_id` | `text` | NULL | `` |
| 29 | `prep_readiness_score` | `int4` | NULL | `` |
| 30 | `prep_readiness_reasons` | `jsonb` | NULL | `` |
| 31 | `prep_draft_md` | `text` | NULL | `` |
| 32 | `prep_drive_asset_id` | `text` | NULL | `` |
| 33 | `prep_notion_page_id` | `text` | NULL | `` |
| 34 | `prep_worker_session_id` | `text` | NULL | `` |
| 36 | `prep_worker_status` | `text` | NULL | `` |
| 37 | `prep_worker_spawned_at` | `timestamptz` | NULL | `` |
| 38 | `prep_worker_ready_at` | `timestamptz` | NULL | `` |
| 39 | `prep_concierge_nudged_at` | `timestamptz` | NULL | `` |
| 40 | `prep_calendar_event_id` | `text` | NULL | `` |

## project_members

行数 (概算): 37
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

## project_monthly_cashflow

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,ym)` (constraint: `project_monthly_cashflow_project_id_ym_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `ym` | `text` | NOT NULL | `` |
| 4 | `source_status` | `text` | NOT NULL | `` |
| 5 | `cash_inflow_yen` | `int8` | NOT NULL | `0` |
| 6 | `sbir_payment_yen` | `int8` | NOT NULL | `0` |
| 7 | `nedo_payment_yen` | `int8` | NOT NULL | `0` |
| 8 | `working_capital_payment_yen` | `int8` | NOT NULL | `0` |
| 9 | `free_cash_flow_yen` | `int8` | NOT NULL | `0` |
| 10 | `financing_cash_flow_yen` | `int8` | NOT NULL | `0` |
| 11 | `net_cash_flow_yen` | `int8` | NOT NULL | `0` |
| 12 | `opening_cash_yen` | `int8` | NULL | `` |
| 13 | `closing_cash_yen` | `int8` | NULL | `` |
| 14 | `sbir_account_balance_yen` | `int8` | NULL | `` |
| 15 | `working_capital_balance_yen` | `int8` | NULL | `` |
| 16 | `bank_borrowing_balance_yen` | `int8` | NULL | `` |
| 17 | `source_note` | `text` | NULL | `` |
| 18 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 19 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_monthly_notes

行数 (概算): 15
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

## project_org_observations

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `observed_on` | `date` | NOT NULL | `` |
| 4 | `kind` | `text` | NOT NULL | `` |
| 5 | `person_name` | `text` | NULL | `` |
| 6 | `function_no` | `int2` | NULL | `` |
| 7 | `headline` | `text` | NOT NULL | `` |
| 8 | `detail` | `text` | NULL | `` |
| 9 | `source_tag` | `text` | NOT NULL | `` |
| 10 | `source_ref` | `text` | NULL | `` |
| 11 | `effect` | `text` | NULL | `` |
| 12 | `direction` | `text` | NOT NULL | `'neutral'::text` |
| 13 | `model_version` | `text` | NOT NULL | `'bzm-3.0'::text` |
| 14 | `recorded_by` | `text` | NOT NULL | `'amie'::text` |
| 15 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_organization_parties

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(id,project_id)` (constraint: `project_organization_parties_id_project_id_key`)
UNIQUE: `(id,project_id,organization_id)` (constraint: `project_organization_parties_id_project_id_organization_id_key`)
UNIQUE: `(project_id,organization_id)` (constraint: `project_organization_parties_project_id_organization_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `organization_id` | `uuid` | NOT NULL | `` |
| 4 | `party_role` | `text` | NOT NULL | `` |
| 5 | `status` | `text` | NOT NULL | `'active'::text` |
| 6 | `expires_at` | `timestamptz` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

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

行数 (概算): 145
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

## project_principal_grants

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(project_id,principal_id,capability)` (constraint: `project_principal_grants_project_id_principal_id_capability_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `organization_id` | `uuid` | NOT NULL | `` |
| 4 | `principal_id` | `uuid` | NOT NULL | `` |
| 5 | `organization_membership_id` | `uuid` | NOT NULL | `` |
| 6 | `project_party_id` | `uuid` | NOT NULL | `` |
| 7 | `capability` | `text` | NOT NULL | `` |
| 8 | `status` | `text` | NOT NULL | `'active'::text` |
| 9 | `expires_at` | `timestamptz` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 11 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## project_publication_audiences

行数 (概算): -1
PRIMARY KEY: `publication_id, project_party_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `publication_id` | `uuid` | NOT NULL | `` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `project_party_id` | `uuid` | NOT NULL | `` |
| 4 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## project_publication_items

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(publication_id,item_kind,source_table,source_id)` (constraint: `project_publication_items_publication_id_item_kind_source_t_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `publication_id` | `uuid` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `item_kind` | `text` | NOT NULL | `` |
| 5 | `source_table` | `text` | NOT NULL | `` |
| 6 | `source_id` | `text` | NOT NULL | `` |
| 7 | `source_version` | `int4` | NOT NULL | `` |
| 8 | `payload` | `jsonb` | NOT NULL | `` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## project_publication_revisions

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(id,project_id)` (constraint: `project_publication_revisions_id_project_id_key`)
UNIQUE: `(project_id,revision)` (constraint: `project_publication_revisions_project_id_revision_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `revision` | `int4` | NOT NULL | `` |
| 4 | `as_of` | `timestamptz` | NOT NULL | `` |
| 5 | `supersedes_revision_id` | `uuid` | NULL | `` |
| 6 | `content_hash` | `text` | NOT NULL | `` |
| 7 | `published_by_principal_id` | `uuid` | NOT NULL | `` |
| 8 | `published_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `sealed_at` | `timestamptz` | NOT NULL | `now()` |

## project_registry_diffs

行数 (概算): 42
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

## project_shareholder_meetings

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `meeting_type` | `text` | NULL | `` |
| 4 | `meeting_date` | `date` | NULL | `` |
| 5 | `meeting_ym` | `text` | NULL | `` |
| 6 | `location` | `text` | NULL | `` |
| 7 | `agenda_summary` | `text` | NULL | `` |
| 8 | `resolutions_json` | `jsonb` | NULL | `` |
| 9 | `amd_response` | `text` | NULL | `` |
| 10 | `amd_response_at` | `timestamptz` | NULL | `` |
| 11 | `related_action_id` | `text` | NULL | `` |
| 12 | `attachments_json` | `jsonb` | NULL | `` |
| 13 | `source_ref` | `text` | NULL | `` |
| 14 | `notes` | `text` | NULL | `` |
| 15 | `created_at` | `timestamptz` | NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NULL | `now()` |

## project_shareholders

行数 (概算): 29
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `holder_type` | `text` | NULL | `` |
| 4 | `holder_name` | `text` | NOT NULL | `` |
| 5 | `holder_member_id` | `text` | NULL | `` |
| 6 | `share_class` | `text` | NULL | `` |
| 7 | `shares` | `int8` | NULL | `` |
| 8 | `ownership_pct` | `numeric` | NULL | `` |
| 9 | `invested_yen` | `int8` | NULL | `` |
| 10 | `as_of_ym` | `text` | NULL | `` |
| 11 | `is_current` | `bool` | NULL | `true` |
| 12 | `source_ref` | `text` | NULL | `` |
| 13 | `notes` | `text` | NULL | `` |
| 14 | `created_at` | `timestamptz` | NULL | `now()` |
| 15 | `updated_at` | `timestamptz` | NULL | `now()` |
| 16 | `round_id` | `uuid` | NULL | `` |

## project_strategy_signals

行数 (概算): 377
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
| 24 | `signal_scope` | `text` | NULL | `` |
| 25 | `applies_to_company_score` | `bool` | NULL | `` |
| 26 | `pipeline_status` | `text` | NULL | `` |
| 27 | `pipeline_probability` | `numeric` | NULL | `` |
| 28 | `expected_amount_yen` | `numeric` | NULL | `` |
| 29 | `expected_contract_ym` | `text` | NULL | `` |
| 30 | `company_score_axis` | `text` | NULL | `` |
| 31 | `scope_reason` | `text` | NULL | `` |
| 32 | `origin_kind` | `text` | NOT NULL | `'internal'::text` |
| 33 | `research_category` | `text` | NULL | `` |

## project_tech_entries

行数 (概算): 151
PRIMARY KEY: `tech_entry_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `tech_entry_id` | `text` | NOT NULL | `` |
| 2 | `tech_topic_id` | `text` | NOT NULL | `` |
| 3 | `project_id` | `text` | NOT NULL | `` |
| 4 | `row_label` | `text` | NOT NULL | `` |
| 5 | `col_label` | `text` | NULL | `` |
| 6 | `value_min` | `numeric` | NULL | `` |
| 7 | `value_max` | `numeric` | NULL | `` |
| 8 | `value_text` | `text` | NULL | `` |
| 9 | `unit` | `text` | NULL | `` |
| 10 | `rating` | `text` | NULL | `` |
| 11 | `condition_text` | `text` | NULL | `` |
| 12 | `observed_on` | `date` | NULL | `` |
| 13 | `confidence` | `text` | NOT NULL | `'medium'::text` |
| 14 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 15 | `source_ref` | `text` | NULL | `` |
| 16 | `source_url` | `text` | NULL | `` |
| 17 | `note` | `text` | NULL | `` |
| 18 | `sort_order` | `int4` | NOT NULL | `100` |
| 19 | `created_by` | `text` | NULL | `` |
| 20 | `updated_by` | `text` | NULL | `` |
| 21 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 23 | `needs_check` | `bool` | NOT NULL | `false` |
| 24 | `check_reason` | `text` | NULL | `` |

## project_tech_topics

行数 (概算): 18
PRIMARY KEY: `tech_topic_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `tech_topic_id` | `text` | NOT NULL | `` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `block_kind` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `summary` | `text` | NULL | `` |
| 6 | `body_md` | `text` | NULL | `` |
| 7 | `tech_domain` | `text` | NULL | `` |
| 8 | `sort_order` | `int4` | NOT NULL | `100` |
| 9 | `status` | `text` | NOT NULL | `'active'::text` |
| 10 | `confidentiality` | `text` | NOT NULL | `'internal'::text` |
| 11 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 12 | `source_ref` | `text` | NULL | `` |
| 13 | `source_url` | `text` | NULL | `` |
| 14 | `created_by` | `text` | NULL | `` |
| 15 | `updated_by` | `text` | NULL | `` |
| 16 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 17 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `needs_check` | `bool` | NOT NULL | `false` |
| 19 | `check_reason` | `text` | NULL | `` |

## project_valuation_rounds

行数 (概算): 29
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `round_name` | `text` | NULL | `` |
| 4 | `round_date` | `date` | NULL | `` |
| 5 | `round_ym` | `text` | NULL | `` |
| 6 | `pre_money_yen` | `int8` | NULL | `` |
| 7 | `post_money_yen` | `int8` | NULL | `` |
| 8 | `raised_yen` | `int8` | NULL | `` |
| 9 | `price_per_share_yen` | `numeric` | NULL | `` |
| 10 | `lead_investor` | `text` | NULL | `` |
| 11 | `source_ref` | `text` | NULL | `` |
| 12 | `notes` | `text` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NULL | `now()` |
| 14 | `updated_at` | `timestamptz` | NULL | `now()` |
| 15 | `security_type` | `text` | NULL | `` |
| 16 | `investors_json` | `jsonb` | NULL | `` |
| 17 | `status` | `text` | NULL | `'closed'::text` |
| 18 | `amd_contribution_status` | `text` | NOT NULL | `'unreviewed'::text` |
| 19 | `amd_contributed_yen` | `int8` | NULL | `` |
| 20 | `amd_contribution_note` | `text` | NULL | `` |

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
| 16 | `short_label` | `text` | NULL | `` |
| 17 | `amd_support_started_at` | `date` | NULL | `` |
| 18 | `amd_support_ended_at` | `date` | NULL | `` |
| 19 | `long_description` | `text` | NULL | `` |
| 20 | `lanes` | `jsonb` | NULL | `` |
| 21 | `master_md_text` | `text` | NULL | `` |
| 22 | `master_md_slug` | `text` | NULL | `` |
| 23 | `master_md_updated_at` | `timestamptz` | NULL | `` |

## project_weekly_effort_entries

行数 (概算): 133
PRIMARY KEY: `id`
UNIQUE: `(project_id,member_id,week_start,work_category)` (constraint: `project_weekly_effort_entries_project_id_member_id_week_sta_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `member_id` | `text` | NOT NULL | `` |
| 4 | `week_start` | `date` | NOT NULL | `` |
| 5 | `work_category` | `text` | NOT NULL | `` |
| 6 | `planned_hours` | `numeric` | NOT NULL | `0` |
| 7 | `actual_hours` | `numeric` | NOT NULL | `0` |
| 8 | `note` | `text` | NULL | `` |
| 9 | `source_kind` | `text` | NOT NULL | `'manual'::text` |
| 10 | `created_by` | `text` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `management_track` | `text` | NULL | `` |
| 14 | `management_milestone_id` | `uuid` | NULL | `` |
| 15 | `deliverable_label` | `text` | NULL | `` |

## project_xrl_evidence

行数 (概算): 130
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

行数 (概算): 25
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
| 27 | `news_search_query` | `text` | NULL | `` |
| 28 | `contract_terms_json` | `jsonb` | NULL | `` |
| 29 | `governance_watch_shareholder_meetings` | `bool` | NOT NULL | `false` |
| 30 | `governance_watch_board_meetings` | `bool` | NOT NULL | `false` |
| 31 | `work_content` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 32 | `monthly_report_required` | `bool` | NOT NULL | `false` |
| 33 | `report_local_alias` | `text` | NULL | `` |
| 34 | `report_extra_allow_terms` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 35 | `monthly_report_scope` | `text` | NOT NULL | `'none'::text` |
| 36 | `slack_channel_not_required` | `bool` | NOT NULL | `false` |
| 37 | `drive_source_folder_ids` | `_text` | NOT NULL | `ARRAY[]::text[]` |
| 38 | `fee_payee` | `text` | NOT NULL | `'company'::text` |

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

行数 (概算): 6
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
| 24 | `receipt_drive_folder_id` | `text` | NULL | `` |
| 25 | `receipt_drive_file_ids` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 26 | `receipt_drive_links` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 27 | `reminder_last_sent_at` | `timestamptz` | NULL | `` |
| 28 | `reminder_sent_count` | `int4` | NOT NULL | `0` |

## reward_member_liability_offsets

行数 (概算): 63
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `plan_cycle_id` | `text` | NOT NULL | `` |
| 4 | `member_id` | `text` | NOT NULL | `` |
| 5 | `pool` | `text` | NOT NULL | `'any'::text` |
| 6 | `amount_yen` | `int4` | NULL | `` |
| 7 | `applies_from_ym` | `text` | NULL | `` |
| 8 | `status` | `text` | NOT NULL | `'active'::text` |
| 9 | `reason` | `text` | NOT NULL | `` |
| 10 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 11 | `created_by` | `text` | NULL | `` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 13 | `voided_at` | `timestamptz` | NULL | `` |
| 14 | `voided_by` | `text` | NULL | `` |
| 15 | `source_ym` | `text` | NULL | `` |
| 16 | `apply_ym` | `text` | NULL | `` |
| 17 | `offset_yen` | `int4` | NULL | `` |
| 18 | `before_base_yen` | `int4` | NOT NULL | `0` |
| 19 | `after_base_yen` | `int4` | NOT NULL | `0` |
| 20 | `origin_type` | `text` | NOT NULL | `'manual'::text` |
| 21 | `revision_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 22 | `created_by_email` | `text` | NULL | `` |
| 23 | `settled_at` | `timestamptz` | NULL | `` |

## seed_bzm30_inputs

行数 (概算): 21
PRIMARY KEY: `seed_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `seed_id` | `uuid` | NOT NULL | `` |
| 2 | `process_type` | `text` | NULL | `` |
| 3 | `reg_class` | `text` | NULL | `` |
| 4 | `classification_confidence` | `text` | NULL | `` |
| 5 | `classification_reason` | `text` | NULL | `` |
| 6 | `evidence_stage` | `int4` | NULL | `` |
| 7 | `evidence_stage_reason` | `text` | NULL | `` |
| 8 | `incorporated` | `bool` | NULL | `` |
| 9 | `free_cash_yen` | `int8` | NULL | `` |
| 10 | `free_cash_as_of` | `date` | NULL | `` |
| 11 | `rights_open` | `int4` | NULL | `` |
| 12 | `under_contract` | `bool` | NULL | `` |
| 13 | `sigma` | `int4` | NULL | `` |
| 14 | `evangelist_e` | `numeric` | NULL | `` |
| 15 | `kappa_ip` | `numeric` | NULL | `` |
| 16 | `self_revenue_yen_month` | `int8` | NULL | `` |
| 17 | `self_revenue_note` | `text` | NULL | `` |
| 18 | `unit_margin_positive` | `bool` | NULL | `` |
| 19 | `use_case_left` | `numeric` | NULL | `` |
| 20 | `note` | `text` | NULL | `` |
| 21 | `evaluator` | `text` | NULL | `` |
| 22 | `assessed_at` | `timestamptz` | NOT NULL | `now()` |
| 23 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 24 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 25 | `free_cash_reason` | `text` | NULL | `` |
| 26 | `burn_rate_yen_month` | `int8` | NULL | `` |
| 27 | `burn_rate_reason` | `text` | NULL | `` |
| 28 | `rights_open_reason` | `text` | NULL | `` |
| 29 | `under_contract_reason` | `text` | NULL | `` |
| 30 | `kappa_ip_reason` | `text` | NULL | `` |
| 31 | `sigma_reason` | `text` | NULL | `` |
| 32 | `evangelist_e_reason` | `text` | NULL | `` |
| 33 | `unit_margin_reason` | `text` | NULL | `` |
| 34 | `incorporated_reason` | `text` | NULL | `` |
| 35 | `conversion_c` | `numeric` | NULL | `` |
| 36 | `conversion_c_reason` | `text` | NULL | `` |
| 37 | `quiet_months` | `numeric` | NULL | `` |
| 38 | `quiet_months_reason` | `text` | NULL | `` |
| 39 | `funcs_f2` | `numeric` | NULL | `` |
| 40 | `funcs_f2_reason` | `text` | NULL | `` |
| 41 | `funcs_f3` | `numeric` | NULL | `` |
| 42 | `funcs_f3_reason` | `text` | NULL | `` |
| 43 | `funcs_f4` | `numeric` | NULL | `` |
| 44 | `funcs_f4_reason` | `text` | NULL | `` |
| 45 | `funcs_f5` | `numeric` | NULL | `` |
| 46 | `funcs_f5_reason` | `text` | NULL | `` |
| 47 | `funcs_f6` | `numeric` | NULL | `` |
| 48 | `funcs_f6_reason` | `text` | NULL | `` |
| 49 | `funcs_f7` | `numeric` | NULL | `` |
| 50 | `funcs_f7_reason` | `text` | NULL | `` |
| 51 | `burn_post_yen_month` | `int8` | NULL | `` |
| 52 | `burn_post_reason` | `text` | NULL | `` |

## seed_bzm30_scores

行数 (概算): 172
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `model_version` | `text` | NOT NULL | `` |
| 4 | `approval_ref` | `text` | NOT NULL | `` |
| 5 | `v_lower` | `numeric` | NOT NULL | `` |
| 6 | `v_median` | `numeric` | NOT NULL | `` |
| 7 | `v_upper` | `numeric` | NOT NULL | `` |
| 8 | `score_lower_yen` | `int8` | NULL | `` |
| 9 | `score_median_yen` | `int8` | NULL | `` |
| 10 | `score_upper_yen` | `int8` | NULL | `` |
| 11 | `ceiling_total_yen` | `int8` | NULL | `` |
| 12 | `p_reach_m4` | `numeric` | NULL | `` |
| 13 | `months_to_m4` | `numeric` | NULL | `` |
| 14 | `continuation_ratio` | `numeric` | NULL | `` |
| 15 | `outcome` | `jsonb` | NULL | `` |
| 16 | `inputs` | `jsonb` | NULL | `` |
| 17 | `computed_at` | `timestamptz` | NOT NULL | `now()` |
| 18 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## seed_bzm30_sensitivity

行数 (概算): 1,060
PRIMARY KEY: `id`
UNIQUE: `(seed_id,model_version,approval_ref,param,point_index)` (constraint: `seed_bzm30_sensitivity_seed_id_model_version_approval_ref_p_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `model_version` | `text` | NOT NULL | `` |
| 4 | `approval_ref` | `text` | NOT NULL | `` |
| 5 | `param` | `text` | NOT NULL | `` |
| 6 | `point_index` | `int4` | NOT NULL | `` |
| 7 | `is_base` | `bool` | NOT NULL | `false` |
| 8 | `param_value` | `numeric` | NOT NULL | `` |
| 9 | `param_label` | `text` | NOT NULL | `` |
| 10 | `v_lower` | `numeric` | NULL | `` |
| 11 | `v_median` | `numeric` | NOT NULL | `` |
| 12 | `v_upper` | `numeric` | NULL | `` |
| 13 | `score_lower_yen` | `numeric` | NULL | `` |
| 14 | `score_median_yen` | `numeric` | NULL | `` |
| 15 | `score_upper_yen` | `numeric` | NULL | `` |
| 16 | `p_reach_m4` | `numeric` | NULL | `` |
| 17 | `months_to_m4` | `numeric` | NULL | `` |
| 18 | `computed_at` | `timestamptz` | NOT NULL | `now()` |

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

行数 (概算): 713
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

## seed_projects

行数 (概算): -1
PRIMARY KEY: `project_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `commercialization_stage` | `text` | NULL | `` |
| 4 | `commercialization_route` | `text` | NULL | `` |
| 5 | `venture_name` | `text` | NULL | `` |
| 6 | `target_market` | `text` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## seed_screening_bands

行数 (概算): 897
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `ruleset_version` | `text` | NOT NULL | `` |
| 4 | `evaluator` | `text` | NOT NULL | `` |
| 5 | `assessed_at` | `timestamptz` | NOT NULL | `` |
| 6 | `stage_lower` | `text` | NULL | `` |
| 7 | `stage_upper` | `text` | NULL | `` |
| 8 | `stage_tag` | `text` | NULL | `` |
| 9 | `axis_bands` | `jsonb` | NULL | `` |
| 10 | `q_lower_pct` | `numeric` | NULL | `` |
| 11 | `q_upper_pct` | `numeric` | NULL | `` |
| 12 | `q_main_factor` | `text` | NULL | `` |
| 13 | `q_evidence` | `jsonb` | NULL | `` |
| 14 | `p_class` | `text` | NULL | `` |
| 15 | `p_lower_yen` | `int8` | NULL | `` |
| 16 | `p_upper_yen` | `int8` | NULL | `` |
| 17 | `sps_lower_yen` | `int8` | NULL | `` |
| 18 | `sps_upper_yen` | `int8` | NULL | `` |
| 19 | `frozen` | `bool` | NOT NULL | `false` |
| 20 | `notes` | `text` | NULL | `` |
| 21 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `measure_version` | `text` | NOT NULL | `` |
| 23 | `model_version` | `text` | NULL | `` |
| 24 | `q_model_version` | `text` | NULL | `` |
| 25 | `q_ruleset_version` | `text` | NULL | `` |
| 26 | `p_model_version` | `text` | NULL | `` |
| 27 | `information_cutoff` | `timestamptz` | NULL | `` |
| 28 | `source_candidate_id` | `uuid` | NULL | `` |
| 29 | `source_initial_candidate_id` | `uuid` | NULL | `` |
| 30 | `p_rationale` | `text` | NULL | `` |
| 31 | `p_external_demand` | `text` | NULL | `` |
| 32 | `p_basis_doc` | `text` | NULL | `` |

## seed_sps_assessments

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(seed_id,evaluated_at)` (constraint: `seed_sps_assessments_seed_evaluated_at_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `evaluated_at` | `date` | NOT NULL | `` |
| 4 | `mu_a` | `int2` | NULL | `` |
| 5 | `mu_i` | `int2` | NULL | `` |
| 6 | `mu_g` | `int2` | NULL | `` |
| 7 | `potential` | `int2` | NULL | `` |
| 8 | `trl` | `int2` | NULL | `` |
| 9 | `brl` | `int2` | NULL | `` |
| 10 | `grl` | `int2` | NULL | `` |
| 11 | `srl` | `int2` | NULL | `` |
| 12 | `hrl` | `int2` | NULL | `` |
| 13 | `f_character` | `int2` | NULL | `` |
| 14 | `f_cap` | `int2` | NULL | `` |
| 15 | `frl` | `int2` | NULL | `` |
| 16 | `r_net` | `int2` | NULL | `` |
| 17 | `shallow_tech_mode` | `bool` | NOT NULL | `false` |
| 18 | `status` | `text` | NOT NULL | `'draft'::text` |
| 19 | `confidence` | `text` | NULL | `` |
| 20 | `axis_evidence` | `jsonb` | NULL | `` |
| 21 | `missing_axes` | `_text` | NULL | `` |
| 22 | `evaluator` | `text` | NULL | `` |
| 23 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 24 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## seed_status_transitions

行数 (概算): 559
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `old_status` | `text` | NULL | `` |
| 4 | `new_status` | `text` | NOT NULL | `` |
| 5 | `changed_at` | `timestamptz` | NOT NULL | `now()` |
| 6 | `changed_by` | `text` | NULL | `` |
| 7 | `note` | `text` | NULL | `` |

## seed_value_ceilings

行数 (概算): 22
PRIMARY KEY: `id`
UNIQUE: `(seed_id,use_case)` (constraint: `seed_value_ceilings_seed_id_use_case_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `use_case` | `text` | NOT NULL | `` |
| 4 | `market_sales_yen` | `int8` | NULL | `` |
| 5 | `market_year` | `int4` | NULL | `` |
| 6 | `value_added_rate` | `numeric` | NULL | `` |
| 7 | `ceiling_yen` | `int8` | NULL | `` |
| 8 | `displacement_yen` | `int8` | NOT NULL | `0` |
| 9 | `is_primary` | `bool` | NOT NULL | `false` |
| 10 | `source` | `text` | NULL | `` |
| 11 | `confidence` | `text` | NULL | `` |
| 12 | `note` | `text` | NULL | `` |
| 13 | `evaluator` | `text` | NULL | `` |
| 14 | `assessed_at` | `timestamptz` | NOT NULL | `now()` |
| 15 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 16 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## seeds

行数 (概算): 735
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
| 34 | `deep_dive_material_url` | `text` | NULL | `` |
| 35 | `primary_commercialization_type` | `text` | NULL | `` |
| 36 | `secondary_commercialization_types` | `_text` | NULL | `` |
| 37 | `envisioned_use_case` | `text` | NULL | `` |
| 38 | `first_customer_candidate` | `text` | NULL | `` |
| 39 | `market_size_range` | `text` | NULL | `` |
| 40 | `market_size_confidence` | `text` | NULL | `` |
| 41 | `biggest_bottleneck` | `text` | NULL | `` |
| 42 | `ip_status` | `text` | NULL | `` |
| 43 | `next_verification_step` | `text` | NULL | `` |
| 52 | `institution_id` | `text` | NULL | `` |

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

行数 (概算): 3,829
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

## sps_initial_assessment_candidates

行数 (概算): 861
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `status` | `text` | NOT NULL | `'pending'::text` |
| 4 | `model_version` | `text` | NOT NULL | `` |
| 5 | `measure_version` | `text` | NOT NULL | `` |
| 6 | `q_model_version` | `text` | NOT NULL | `` |
| 7 | `q_ruleset_version` | `text` | NOT NULL | `` |
| 8 | `p_model_version` | `text` | NOT NULL | `` |
| 9 | `assessment_ruleset_version` | `text` | NOT NULL | `` |
| 10 | `prompt_body` | `text` | NOT NULL | `` |
| 11 | `prompt_hash` | `text` | NOT NULL | `` |
| 12 | `model_hash` | `text` | NOT NULL | `` |
| 13 | `prepared_hash` | `text` | NOT NULL | `` |
| 14 | `source_fingerprint` | `text` | NOT NULL | `` |
| 15 | `source_facts` | `jsonb` | NOT NULL | `` |
| 16 | `semantic_fingerprint` | `text` | NOT NULL | `` |
| 17 | `information_cutoff` | `timestamptz` | NOT NULL | `` |
| 18 | `stage_lower` | `text` | NOT NULL | `` |
| 19 | `stage_upper` | `text` | NOT NULL | `` |
| 20 | `stage_tag` | `text` | NOT NULL | `` |
| 21 | `q_lower_pct` | `numeric` | NOT NULL | `` |
| 22 | `q_upper_pct` | `numeric` | NOT NULL | `` |
| 23 | `q_main_factor` | `text` | NOT NULL | `` |
| 24 | `q_evidence` | `jsonb` | NOT NULL | `` |
| 25 | `p_class` | `text` | NOT NULL | `` |
| 26 | `p_lower_yen` | `int8` | NOT NULL | `` |
| 27 | `p_upper_yen` | `int8` | NOT NULL | `` |
| 28 | `sps_lower_yen` | `int8` | NOT NULL | `` |
| 29 | `sps_upper_yen` | `int8` | NOT NULL | `` |
| 30 | `notes` | `text` | NOT NULL | `` |
| 31 | `proposal_summary` | `text` | NOT NULL | `` |
| 32 | `created_by` | `text` | NOT NULL | `'codex-sps-initial-assessment'::text` |
| 33 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 34 | `applied_assessment_id` | `uuid` | NULL | `` |
| 35 | `applied_at` | `timestamptz` | NULL | `` |
| 36 | `applied_by` | `text` | NULL | `` |
| 37 | `rejected_at` | `timestamptz` | NULL | `` |
| 38 | `rejected_by` | `text` | NULL | `` |
| 39 | `rejection_reason` | `text` | NULL | `` |
| 40 | `supersedes_assessment_id` | `uuid` | NULL | `` |

## sps_legacy_archives

行数 (概算): -1
PRIMARY KEY: `archive_id`
UNIQUE: `(project_id,archive_id)` (constraint: `sps_legacy_archives_project_archive_uniq`)
UNIQUE: `(project_id,snapshot_key)` (constraint: `sps_legacy_archives_project_snapshot_uniq`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `archive_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `project_id` | `text` | NOT NULL | `` |
| 3 | `snapshot_key` | `text` | NOT NULL | `` |
| 4 | `snapshot_at` | `timestamptz` | NOT NULL | `` |
| 5 | `source_cutoff` | `timestamptz` | NOT NULL | `` |
| 6 | `source_counts_json` | `jsonb` | NOT NULL | `` |
| 7 | `payload_json` | `jsonb` | NOT NULL | `` |
| 8 | `payload_hash` | `text` | NOT NULL | `` |
| 9 | `archive_reason` | `text` | NOT NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## sps_model_versions

行数 (概算): -1
PRIMARY KEY: `model_version`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `model_version` | `text` | NOT NULL | `` |
| 2 | `formula` | `text` | NOT NULL | `` |
| 3 | `measure_version` | `text` | NOT NULL | `` |
| 4 | `q_model_version` | `text` | NOT NULL | `` |
| 5 | `q_ruleset_version` | `text` | NOT NULL | `` |
| 6 | `p_model_version` | `text` | NOT NULL | `` |
| 7 | `assessment_ruleset_version` | `text` | NOT NULL | `` |
| 8 | `is_current` | `bool` | NOT NULL | `false` |
| 9 | `effective_from` | `timestamptz` | NOT NULL | `` |
| 10 | `retired_at` | `timestamptz` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## sps_primary_model_registry

行数 (概算): -1
PRIMARY KEY: `project_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `primary_model` | `text` | NOT NULL | `` |
| 3 | `switch_status` | `text` | NOT NULL | `` |
| 4 | `legacy_archive_id` | `uuid` | NOT NULL | `` |
| 5 | `active_bzm_2_1_revision_id` | `uuid` | NULL | `` |
| 6 | `switched_at` | `timestamptz` | NULL | `` |
| 7 | `switched_by` | `text` | NOT NULL | `` |
| 8 | `rollback_note` | `text` | NOT NULL | `` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## sps_reassessment_candidates

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `seed_id` | `uuid` | NOT NULL | `` |
| 3 | `source_event_ids` | `_uuid` | NOT NULL | `` |
| 4 | `semantic_fingerprint` | `text` | NOT NULL | `` |
| 5 | `status` | `text` | NOT NULL | `'pending'::text` |
| 6 | `confidence` | `numeric` | NOT NULL | `` |
| 7 | `model_version` | `text` | NOT NULL | `` |
| 8 | `measure_version` | `text` | NOT NULL | `` |
| 9 | `q_model_version` | `text` | NOT NULL | `` |
| 10 | `q_ruleset_version` | `text` | NOT NULL | `` |
| 11 | `p_model_version` | `text` | NOT NULL | `` |
| 12 | `assessment_ruleset_version` | `text` | NOT NULL | `` |
| 13 | `base_assessment_id` | `uuid` | NOT NULL | `` |
| 14 | `impact_classification` | `text` | NOT NULL | `` |
| 15 | `evidence_strength` | `text` | NOT NULL | `` |
| 16 | `information_cutoff` | `timestamptz` | NOT NULL | `` |
| 17 | `q_lower_pct` | `numeric` | NOT NULL | `` |
| 18 | `q_upper_pct` | `numeric` | NOT NULL | `` |
| 19 | `q_main_factor` | `text` | NULL | `` |
| 20 | `p_class` | `text` | NULL | `` |
| 21 | `p_lower_yen` | `int8` | NOT NULL | `` |
| 22 | `p_upper_yen` | `int8` | NOT NULL | `` |
| 23 | `sps_lower_yen` | `int8` | NOT NULL | `` |
| 24 | `sps_upper_yen` | `int8` | NOT NULL | `` |
| 25 | `proposal_summary` | `text` | NOT NULL | `` |
| 26 | `created_by` | `text` | NOT NULL | `'codex-sps-reassessment'::text` |
| 27 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 28 | `applied_assessment_id` | `uuid` | NULL | `` |
| 29 | `applied_at` | `timestamptz` | NULL | `` |
| 30 | `applied_by` | `text` | NULL | `` |
| 31 | `rejected_at` | `timestamptz` | NULL | `` |
| 32 | `rejected_by` | `text` | NULL | `` |
| 33 | `rejection_reason` | `text` | NULL | `` |

## sps_reassessment_source_events

行数 (概算): 281
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `source_table` | `text` | NOT NULL | `` |
| 3 | `source_row_identity` | `text` | NOT NULL | `` |
| 4 | `project_id` | `text` | NULL | `` |
| 5 | `seed_id` | `uuid` | NULL | `` |
| 6 | `operation` | `text` | NOT NULL | `` |
| 7 | `event_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `source_at` | `timestamptz` | NULL | `` |
| 9 | `payload_hash` | `text` | NOT NULL | `` |
| 10 | `status` | `text` | NOT NULL | `'pending'::text` |

## tally_project_syncs

行数 (概算): 9
PRIMARY KEY: `project_id, member_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `member_id` | `text` | NOT NULL | `` |
| 3 | `display_name` | `text` | NOT NULL | `` |
| 4 | `meeting_search_terms` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 5 | `last_synced_at` | `timestamptz` | NOT NULL | `now()` |

## tally_weekly_effort_entries

行数 (概算): 144
PRIMARY KEY: `project_id, member_id, week_start`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `project_id` | `text` | NOT NULL | `` |
| 2 | `member_id` | `text` | NOT NULL | `` |
| 3 | `week_start` | `date` | NOT NULL | `` |
| 4 | `development_hours` | `numeric` | NOT NULL | `` |
| 5 | `meeting_hours` | `numeric` | NOT NULL | `` |
| 6 | `synced_at` | `timestamptz` | NOT NULL | `now()` |

## tasks

行数 (概算): 67
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
| 11 | `assignee_member_id` | `text` | NULL | `` |
| 12 | `start_date` | `date` | NULL | `` |
| 13 | `due_date` | `date` | NULL | `` |
| 14 | `progress` | `int4` | NOT NULL | `0` |
| 15 | `parent_task_id` | `text` | NULL | `` |
| 16 | `mindmap_x` | `numeric` | NOT NULL | `0` |
| 17 | `mindmap_y` | `numeric` | NOT NULL | `0` |
| 18 | `active` | `bool` | NOT NULL | `true` |
| 19 | `task_source` | `text` | NOT NULL | `'manual'::text` |
| 20 | `created_by` | `text` | NULL | `` |
| 21 | `updated_by` | `text` | NULL | `` |
| 22 | `position_updated_at` | `timestamptz` | NULL | `` |
| 23 | `agent_kind` | `text` | NULL | `` |
| 24 | `agent_session_id` | `text` | NULL | `` |
| 25 | `agent_session_url` | `text` | NULL | `` |
| 26 | `agent_session_label` | `text` | NULL | `` |

## textbook_insight_candidates

行数 (概算): 29
PRIMARY KEY: `candidate_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `candidate_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `target_id` | `text` | NOT NULL | `'p00'::text` |
| 3 | `ym` | `text` | NULL | `` |
| 4 | `scope_key` | `text` | NOT NULL | `` |
| 5 | `topic` | `text` | NOT NULL | `` |
| 6 | `title` | `text` | NOT NULL | `` |
| 7 | `proposed_section` | `text` | NULL | `` |
| 8 | `target_bzm_slug` | `text` | NULL | `'8-1-amd-os-operations'::text` |
| 9 | `insight_type` | `text` | NOT NULL | `` |
| 10 | `priority` | `int4` | NOT NULL | `2` |
| 11 | `body_md` | `text` | NOT NULL | `` |
| 12 | `evidence_refs` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 13 | `source_tables` | `jsonb` | NOT NULL | `'[]'::jsonb` |
| 14 | `source_hash` | `text` | NOT NULL | `` |
| 15 | `status` | `text` | NOT NULL | `'candidate'::text` |
| 16 | `extraction_run_id` | `text` | NULL | `` |
| 17 | `created_by` | `text` | NOT NULL | `'codex_automation_l10'::text` |
| 18 | `reviewed_by` | `text` | NULL | `` |
| 19 | `review_comment` | `text` | NULL | `` |
| 20 | `reviewed_at` | `timestamptz` | NULL | `` |
| 21 | `applied_file` | `text` | NULL | `` |
| 22 | `applied_commit` | `text` | NULL | `` |
| 23 | `applied_by` | `text` | NULL | `` |
| 24 | `applied_at` | `timestamptz` | NULL | `` |
| 25 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 26 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 27 | `metadata_json` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 28 | `confidentiality` | `text` | NOT NULL | `'internal_only'::text` |
| 29 | `bzm_review_required` | `bool` | NOT NULL | `false` |
| 30 | `bzm_review_status` | `text` | NOT NULL | `'not_required'::text` |
| 31 | `theory_change_scope` | `text` | NOT NULL | `'none'::text` |

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

行数 (概算): 177
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
| 10 | `buffer_breakdown_json` | `jsonb` | NULL | `` |

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

## workspace_access_audit_logs

行数 (概算): 311
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `event_type` | `text` | NOT NULL | `` |
| 3 | `user_account_id` | `uuid` | NULL | `` |
| 4 | `email` | `text` | NULL | `` |
| 5 | `workspace_id` | `uuid` | NULL | `` |
| 6 | `project_id` | `text` | NULL | `` |
| 7 | `detail` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 8 | `ip_address` | `text` | NULL | `` |
| 9 | `user_agent` | `text` | NULL | `` |
| 10 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## workspace_control_audit_logs

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `event_type` | `text` | NOT NULL | `` |
| 3 | `actor_principal_id` | `uuid` | NULL | `` |
| 4 | `actor_project_party_id` | `uuid` | NULL | `` |
| 5 | `actor_source` | `text` | NOT NULL | `` |
| 6 | `project_id` | `text` | NULL | `` |
| 7 | `resource_type` | `text` | NOT NULL | `` |
| 8 | `resource_id` | `text` | NOT NULL | `` |
| 9 | `request_id` | `text` | NULL | `` |
| 10 | `request_fingerprint` | `text` | NULL | `` |
| 11 | `detail` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| 12 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## workspace_document_assets

行数 (概算): -1
PRIMARY KEY: `asset_id`
UNIQUE: `(storage_bucket,storage_path)` (constraint: `workspace_document_assets_unique_object`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `asset_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `document_id` | `uuid` | NOT NULL | `` |
| 3 | `storage_bucket` | `text` | NOT NULL | `` |
| 4 | `storage_path` | `text` | NOT NULL | `` |
| 5 | `mime_type` | `text` | NOT NULL | `` |
| 6 | `byte_size` | `int8` | NOT NULL | `` |
| 7 | `width` | `int4` | NULL | `` |
| 8 | `height` | `int4` | NULL | `` |
| 9 | `content_sha256` | `text` | NULL | `` |
| 10 | `created_by_account_id` | `uuid` | NULL | `` |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## workspace_document_decks

行数 (概算): -1
PRIMARY KEY: `document_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `document_id` | `uuid` | NOT NULL | `` |
| 2 | `schema_version` | `int4` | NOT NULL | `` |
| 3 | `model` | `jsonb` | NOT NULL | `` |
| 4 | `model_sha256` | `text` | NOT NULL | `` |
| 5 | `published_sha256` | `text` | NULL | `` |
| 6 | `published_at` | `timestamptz` | NULL | `` |
| 7 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 8 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_by_account_id` | `uuid` | NULL | `` |

## workspace_document_revisions

行数 (概算): -1
PRIMARY KEY: `revision_id`
UNIQUE: `(document_id,revision_no)` (constraint: `workspace_document_revisions_unique_no`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `revision_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `document_id` | `uuid` | NOT NULL | `` |
| 3 | `revision_no` | `int4` | NOT NULL | `` |
| 4 | `kind` | `text` | NOT NULL | `` |
| 5 | `model` | `jsonb` | NULL | `` |
| 6 | `storage_bucket` | `text` | NULL | `` |
| 7 | `storage_path` | `text` | NULL | `` |
| 8 | `content_sha256` | `text` | NOT NULL | `` |
| 9 | `byte_size` | `int8` | NOT NULL | `` |
| 10 | `note` | `text` | NULL | `` |
| 11 | `pinned` | `bool` | NOT NULL | `false` |
| 12 | `created_by_account_id` | `uuid` | NULL | `` |
| 13 | `created_at` | `timestamptz` | NOT NULL | `now()` |

## workspace_documents

行数 (概算): 103
PRIMARY KEY: `document_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `document_id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `scope_kind` | `text` | NOT NULL | `` |
| 3 | `institution_workspace_id` | `uuid` | NULL | `` |
| 4 | `project_id` | `text` | NULL | `` |
| 5 | `entry_kind` | `text` | NOT NULL | `` |
| 6 | `visibility` | `text` | NOT NULL | `'workspace_shared'::text` |
| 7 | `folder_path` | `text` | NOT NULL | `''::text` |
| 8 | `display_name` | `text` | NOT NULL | `` |
| 9 | `storage_bucket` | `text` | NULL | `` |
| 10 | `storage_path` | `text` | NULL | `` |
| 11 | `external_url` | `text` | NULL | `` |
| 12 | `mime_type` | `text` | NOT NULL | `'application/octet-stream'::text` |
| 13 | `file_size_bytes` | `int8` | NOT NULL | `0` |
| 14 | `upload_status` | `text` | NOT NULL | `'active'::text` |
| 15 | `source_kind` | `text` | NOT NULL | `'manual_upload'::text` |
| 16 | `source_ref` | `text` | NULL | `` |
| 17 | `created_by_account_id` | `uuid` | NULL | `` |
| 18 | `created_by_member_id` | `text` | NULL | `` |
| 19 | `published_at` | `timestamptz` | NULL | `` |
| 20 | `archived_at` | `timestamptz` | NULL | `` |
| 21 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 22 | `updated_at` | `timestamptz` | NOT NULL | `now()` |
| 23 | `content_sha256` | `text` | NULL | `` |
| 24 | `source_updated_at` | `timestamptz` | NULL | `` |

## workspace_email_otp_rate_limits

行数 (概算): -1
PRIMARY KEY: `user_account_id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `user_account_id` | `uuid` | NOT NULL | `` |
| 2 | `window_started_at` | `timestamptz` | NOT NULL | `now()` |
| 3 | `send_count` | `int4` | NOT NULL | `0` |
| 4 | `last_claimed_at` | `timestamptz` | NULL | `` |
| 5 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## workspace_organization_memberships

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(id,organization_id,principal_id)` (constraint: `workspace_organization_member_id_organization_id_principal__key`)
UNIQUE: `(organization_id,principal_id)` (constraint: `workspace_organization_members_organization_id_principal_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `organization_id` | `uuid` | NOT NULL | `` |
| 3 | `principal_id` | `uuid` | NOT NULL | `` |
| 4 | `role` | `text` | NOT NULL | `'member'::text` |
| 5 | `status` | `text` | NOT NULL | `'active'::text` |
| 6 | `accepted_at` | `timestamptz` | NULL | `` |
| 7 | `terms_version` | `text` | NULL | `` |
| 8 | `expires_at` | `timestamptz` | NULL | `` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## workspace_organizations

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `kind` | `text` | NOT NULL | `` |
| 3 | `slug` | `text` | NOT NULL | `` |
| 4 | `display_name` | `text` | NOT NULL | `` |
| 5 | `source_kind` | `text` | NOT NULL | `` |
| 6 | `source_id` | `text` | NULL | `` |
| 7 | `status` | `text` | NOT NULL | `'active'::text` |
| 8 | `expires_at` | `timestamptz` | NULL | `` |
| 9 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 10 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## workspace_principals

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(member_id)` (constraint: `workspace_principals_member_id_key`)
UNIQUE: `(workspace_user_account_id)` (constraint: `workspace_principals_workspace_user_account_id_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `member_id` | `text` | NULL | `` |
| 3 | `workspace_user_account_id` | `uuid` | NULL | `` |
| 4 | `status` | `text` | NOT NULL | `'active'::text` |
| 5 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 6 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## workspace_user_accounts

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(email_normalized)` (constraint: `workspace_user_accounts_email_normalized_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `email` | `text` | NOT NULL | `` |
| 3 | `email_normalized` | `text` | NULL | `` |
| 4 | `auth_user_id` | `uuid` | NULL | `` |
| 5 | `display_name` | `text` | NULL | `` |
| 6 | `status` | `text` | NOT NULL | `'invited'::text` |
| 7 | `last_login_at` | `timestamptz` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## workspace_work_case_deadlines

行数 (概算): -1
PRIMARY KEY: `id`

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `case_id` | `uuid` | NOT NULL | `` |
| 3 | `label` | `text` | NOT NULL | `` |
| 4 | `due_date` | `date` | NULL | `` |
| 5 | `due_precision` | `text` | NOT NULL | `'day'::text` |
| 6 | `status` | `text` | NOT NULL | `'unconfirmed'::text` |
| 7 | `sort_order` | `int4` | NULL | `` |
| 8 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 9 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

## workspace_work_cases

行数 (概算): -1
PRIMARY KEY: `id`
UNIQUE: `(workspace_id,case_code)` (constraint: `workspace_work_cases_workspace_id_case_code_key`)

| # | column | type | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| 2 | `workspace_id` | `uuid` | NOT NULL | `` |
| 3 | `case_code` | `text` | NOT NULL | `` |
| 4 | `title` | `text` | NOT NULL | `` |
| 5 | `domain` | `text` | NOT NULL | `` |
| 6 | `case_kind` | `text` | NULL | `` |
| 7 | `status_label` | `text` | NULL | `` |
| 8 | `frequency_deadline_note` | `text` | NULL | `` |
| 9 | `stakeholders` | `text` | NULL | `` |
| 10 | `next_action` | `text` | NULL | `` |
| 11 | `waiting_on` | `text` | NULL | `` |
| 12 | `waiting_since` | `date` | NULL | `` |
| 13 | `notes` | `text` | NULL | `` |
| 14 | `data_status` | `text` | NOT NULL | `'unconfirmed'::text` |
| 15 | `source_note` | `text` | NULL | `` |
| 16 | `last_confirmed_at` | `date` | NULL | `` |
| 17 | `priority_wave` | `int2` | NULL | `` |
| 18 | `sort_order` | `int4` | NULL | `` |
| 19 | `archived_at` | `timestamptz` | NULL | `` |
| 20 | `created_at` | `timestamptz` | NOT NULL | `now()` |
| 21 | `updated_at` | `timestamptz` | NOT NULL | `now()` |

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
