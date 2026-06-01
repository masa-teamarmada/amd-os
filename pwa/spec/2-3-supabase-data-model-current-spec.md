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
| value plan / reward | `value_plan_cycles`, `value_milestones`, `milestone_sub_items`, `milestone_responsibility`, `milestone_monthly_progress`, `milestone_monthly_contribution_allocations`, `monthly_reward_payout`, `payout_notices` |
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

## Project End Current Truth

PJ終了判定では、単一のNULL正規化カラムだけを継続根拠にしない。特に `project_ventures.amd_support_ended_at` がNULLでも、以下が揃う場合は source hygiene issue として扱い、DB補正レビューへ回す。

- `projects.status='ended'`
- `projects.end_ym` が終了月を持つ
- `project_ventures.narrative_text` または `master_md_text` が同じ終了月・AMD関与終結を示す

終了日補正は、read-only確認で `projects` / `project_ventures` / 関連L2 / billing補助情報を照合し、司令塔判断後に単一カラムの idempotent update として実行する。終結理由が口述由来の場合は、終結日補正の根拠と混ぜず、別の evidence / oral history review として扱う。

## Rebuild Rules

1. migration を書く。
2. `apply_ddl.py` で Supabase Management API 経由で適用する。
3. `dump_schema.py` で `db_schema.md` を再生成する。
4. spec / manual / bzm の該当章と附則を更新する。
5. API / component / automation の select / insert / upsert を `db_schema.md` の column 名で確認する。

## Failure Mode

| failure | 典型原因 | 対応 |
|---|---|---|
| PostgREST 42703 | 想像した column 名 | `db_schema.md` を grep して修正 |
| RLS / auth error | client/admin client の使い分けミス | API route は admin gate 後 service_role が必要か確認 |
| duplicate key | `UNIQUE` / `onConflict` 不一致 | schema の constraint を確認 |
| stale schema docs | migration 後 dump 漏れ | `dump_schema.py` を実行し同じ commit に含める |

## 再構築可能性チェック

この章で domain ごとの table map と schema 更新手順は再構築できる。column-level の完全再構築は `pwa/design/db_schema.md` 依存。次にやるべきは、Admin / Finance / Reward / Atlas の領域別 spec で重要 column と status transition を抽出すること。
