-- 018_pl_role_and_payment_due_day.sql
--
-- 1. project_members に is_pl 列を追加 (PL = Project Leader、is_pm/is_closer と並立)
--    - 13: 予算・月次報告書・請求書の承認プロセスで「PL に確認依頼」する送り先
--    - 15: スコアリングボードでも表示する役割
--
-- 2. projects に payment_due_day 列を追加 (請求書送付モーダルでデフォルト計算)
--    - 16: PJ ごとの「翌月 X 日に支払期日」ルール。土日祝なら前営業日 (UI 側計算)
--    - payment_due_rule (text) は既存だが文字列で計算ロジックに使えないため
--      数値で持つ payment_due_day を別途追加
--
-- 適用: python -X utf8 scripts/apply_ddl.py scripts/migrations/018_pl_role_and_payment_due_day.sql

alter table project_members
  add column if not exists is_pl boolean not null default false;

create index if not exists idx_pm_is_pl on project_members(project_id) where is_pl = true;

alter table projects
  add column if not exists payment_due_day integer;

comment on column project_members.is_pl is 'Project Leader フラグ。承認・nudge 送付先。is_pm/is_closer と並立 (1 メンバーが複数役割可)';
comment on column projects.payment_due_day is '請求書支払期日のデフォルト日数 (翌月 N 日)。土日祝なら前営業日に補正 (UI 側)';
