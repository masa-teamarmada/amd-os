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
| decision | `amd_score_inputs`, `amd_score_alpha`, `amd_score_revisions`, `project_xrl_log`, `project_founding_members`, `project_graduation_signals` |
| ERS | `institutions`, `institution_capability_axes`, `institution_capability_criteria`, `institution_assessments` |
| Atlas | `atlas_signals`, `atlas_stories`, `atlas_story_merges`, `atlas_themes`, `atlas_story_themes`, `atlas_divergences` |
| Seeds / VC / Scholar | `seeds`, `seed_funding`, `seed_news`, `seed_contact_log`, `vcs`, `vc_funds`, `vc_investments`, `vc_contacts`, `vc_news`, `papers_log` |
| Management Score / finance | `amd_management_score_*`, `company_*`, `freee_oauth_tokens` |

## Status Conventions

| status family | meaning |
|---|---|
| `candidate` | automation が候補として作った。人間承認前 |
| `confirmed` / `active` / `applied` | 人間承認済み、または正本として利用可 |
| `rejected` / `invalid` | 人間が不採用にした。再抽出時の学習対象 |
| `archived` | 表示や active 判定から外す履歴 |

`l2_feedbacks` と `tsukuyomi_learnings` は、候補採否や修正依頼を次回抽出へ戻す feedback loop の正本。

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
