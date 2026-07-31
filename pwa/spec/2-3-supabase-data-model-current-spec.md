# Supabase Data Model 仕様

> **この章は何か**: AMD OS が共有する Supabase schema の再構築入口。column の正本は自動生成 `pwa/design/db_schema.md`、migration は `pwa/scripts/migrations/` と `ios/supabase/` を見る。

## Source of Truth

| 項目 | 正本 |
|---|---|
| DB runtime | Supabase project `nbnhrhybjslbawdukvvk` |
| schema dump | `pwa/design/db_schema.md` |
| PWA migrations | `pwa/scripts/migrations/*.sql` |
| shared/native migrations | `ios/supabase/` |
| DDL apply | `python3 -X utf8 pwa/scripts/apply_ddl.py <migration.sql>` |
| schema refresh | `python3 -X utf8 pwa/scripts/dump_schema.py` |

列名は必ず `db_schema.md` からコピーする。推測禁止。

## Core Tables

| domain | tables |
|---|---|
| members / projects | `members`, `projects`, `project_members`, `project_config`, `project_partners` |
| billing / monthly ops | `billing_cycles`, `billing_log`, `monthly_reports`, `project_monthly_notes`, `reimbursements` |
| task management | `tasks` (`assignee_member_id`, start/due, progress, parent edge, mindmap position, active flag) |
| value plan / reward | `value_plan_cycles`, `value_milestones`, `milestone_sub_items`, `milestone_responsibility`, `milestone_monthly_progress`, `monthly_reward_payout`, `payout_notices` |
| L2 / knowledge | `source_cache`, `protocols`, `project_knowledge`, `member_knowledge`, `project_meeting_summaries`, `project_registry_diffs`, `project_xrl_evidence`, `project_strategy_signals`, `l2_notifications`, `l2_feedbacks` |
| management guardrails | `guardrail_tag_definitions`, `guardrail_cards`, `guardrail_matches`, `guardrail_feedbacks` |
| decision | `amd_score_inputs`, `amd_score_alpha`, `amd_score_revisions`, `project_xrl_log`, `project_founding_members`, `project_graduation_signals` |
| research institutions | `institutions`, `institution_projects`, `institution_capability_axes`, `institution_capability_criteria`, `institution_assessments` |
| BZM theory | `bzm_theory_nodes`, `bzm_theory_edges` |
| Atlas | `atlas_signals`, `atlas_stories`, `atlas_story_merges`, `atlas_themes`, `atlas_story_themes`, `atlas_divergences` |
| Seeds / VC / Scholar | `seeds`, `seed_projects`, `seed_sps_assessments`, `seed_funding`, `seed_news`, `seed_contact_log`, `vcs`, `vc_funds`, `vc_investments`, `vc_contacts`, `vc_news`, `papers_log` |
| Management Score / finance | `amd_management_score_*`, `company_*`, `freee_oauth_tokens` |

## Status Conventions

| status family | meaning |
|---|---|
| `candidate` | automation が候補として作った。人間承認前 |
| `confirmed` / `active` / `applied` | 人間承認済み、または正本として利用可 |
| `rejected` / `invalid` | 人間が不採用にした。再抽出時の学習対象 |
| `archived` | 表示や active 判定から外す履歴 |

`l2_feedbacks` と `tsukuyomi_learnings` は、候補採否や修正依頼を次回抽出へ戻す feedback loop の正本。

## 研究機関・シーズ・AMD PJ

- `institutions` と `seeds` は、AMDとの契約有無に依存せず増やす別々のカタログ。
- 契約後の共通運用情報は `projects`、研究機関固有情報は `institution_projects`、個別シーズ事業化固有情報は `seed_projects` に置く。
- 同じ `project_id` を両子テーブルへ入れることは `guard_project_domain_exclusivity()` が拒否する。
- ECRは `institution_assessments`、SPSは `seed_sps_assessments` の別系列で、合算・相互上書き・PJ化に伴う再計算を行わない。
- migration `207_institution_seed_project_domains.sql` が46研究機関、大学・国研シーズ141件のFK、p25/p28/p30の研究機関PJ、p21のシーズPJを移行する。p30は愛媛大学全体のエコシステム構築PJ。p20/p26は未確認なので分類しない。
- `seeds.spun_off_project_id` は旧互換。現行のAMD PJ関係は `seed_projects` を読む。

## BZM 理論グラフ

- `bzm_theory_nodes`: 理論要素の title / kind / layer / status / summary / body / source reference と作成・更新者を保存する。
- `bzm_theory_edges`: 有向エッジを `(from_node_id, relation_type, to_node_id)` 一意で保存する。9 relation を許可し、`raises` の到達先はAPIとDB triggerの両方でactiveな `question` に限定する。
- authenticated member は active ノードと active ノード間エッジを読む。書き込みは `public.is_admin()` とAPIの `requireAdmin()` の両方で制限する。
- migration `203_bzm_theory_editor.sql` はschema/RLSと旧21ノード / 34関係seedの履歴。migration `208_bzm_theory_map_user_authored_reset.sql` がedge→nodeの順で全seed行を削除し、0件から本人が育てる現在値にする。日常運用の正本はDBだけで、Markdownは自動読込しない検証・復元用履歴資産。
- UIからノードを直接削除しない。エッジ解除はID指定、ノード作成と初回エッジの片側失敗は補償削除する。

## RLS 標準形 (全テーブル必須)

`public` の全テーブルは **RLS 有効** が前提。標準 policy は 3 種:

- `anon SELECT (true)` — PWA 表示用の公開読み取り。
- `service_role ALL` — cron / API の書き込み経路 (`auth.role() = 'service_role'`)。
- `is_admin() ALL` — 管理 UI からの書き込み用。報酬配分など機密テーブルは特に admin 限定が筋。

anon / authenticated には書き込みを付与しない (= PWA 公開 anon key からの改竄・削除を塞ぐ)。新テーブル作成 DDL は必ず `ENABLE ROW LEVEL SECURITY` をセットで書く。取りこぼし監査は `get_advisors(type=security)` の `rls_disabled_in_public` を定期的に見る (2026-06-14 に 3 テーブルの RLS 無効を migration 135 で塞いだ実績、`BUGS.md` 参照)。

## Rebuild Rules

1. migration を書く。
2. `apply_ddl.py` で Supabase Management API 経由で適用する。
3. `dump_schema.py` で `db_schema.md` を再生成する。
4. spec / manual / bzm の該当章と附則を更新する。
5. API / component / automation の select / insert / upsert を `db_schema.md` の column 名で確認する。

## RLS 標準形 (全テーブル必須)

`public` の全テーブルは **RLS 有効** が前提。標準 policy は 3 種:

- `anon SELECT (true)` — PWA 表示用の公開読み取り。
- `service_role ALL` — cron / API の書き込み経路 (`auth.role() = 'service_role'`)。
- `is_admin() ALL` — 管理 UI からの書き込み用。報酬配分など機密テーブルは特に admin 限定が筋。

anon / authenticated には書き込みを付与しない (= PWA 公開 anon key からの改竄・削除を塞ぐ)。新テーブル作成 DDL は必ず `ENABLE ROW LEVEL SECURITY` をセットで書く。取りこぼし監査は `get_advisors(type=security)` の `rls_disabled_in_public` を定期的に見る (2026-06-14 に 3 テーブルの RLS 無効を migration 135 で塞いだ実績、`BUGS.md` 参照)。

## Failure Mode

| failure | 典型原因 | 対応 |
|---|---|---|
| PostgREST 42703 | 想像した column 名 | `db_schema.md` を grep して修正 |
| RLS / auth error | client/admin client の使い分けミス | API route は admin gate 後 service_role が必要か確認 |
| duplicate key | `UNIQUE` / `onConflict` 不一致 | schema の constraint を確認 |
| stale schema docs | migration 後 dump 漏れ | `dump_schema.py` を実行し同じ commit に含める |

## 再構築可能性チェック

この章で domain ごとの table map と schema 更新手順は再構築できる。column-level の完全再構築は `pwa/design/db_schema.md` 依存。次にやるべきは、Admin / Finance / Reward / Atlas の領域別 spec で重要 column と status transition を抽出すること。
