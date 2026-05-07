-- 020: member_activities テーブルに milestone_id 列を追加。
--
-- 背景: cron `/api/cron/member-activities` (毎日 04:00 JST) が
-- 「Could not find the 'milestone_id' column of 'member_activities'」エラーで失敗していた (2026-05-07)。
-- コード側 (src/app/api/cron/member-activities/route.ts:165) は
-- milestone_id を upsert key にしてるが、DB 列が欠落していた。
--
-- これにより:
--   - p19, p21 など plan_cycle がアクティブな PJ でも cron が 0 件しか書き込めなかった
--   - member_activities テーブル全件 0 件状態になっていた
--   - その結果、CockpitMonthlyModal の「進捗イベント」セクションが空 (#4 の真因の一つ)

alter table member_activities
  add column if not exists milestone_id text;

create index if not exists idx_ma_milestone_ym on member_activities(milestone_id, ym) where milestone_id is not null;

comment on column member_activities.milestone_id is 'cron が推論した活動が紐付く MS の ID (value_milestones.milestone_id)。null も可';
