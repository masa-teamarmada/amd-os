-- 343_project_tech_needs_check.sql
-- 技術台帳に「要確認」の印を持たせる (まさ 2026-08-29)。
--
-- 「そういう食い違いも、両方の情報とも記しておいたうえで、要確認って書いておいてほしい」
--
-- 資料によって値が違う、実測が無い、根拠が弱い —— こうした行を、
-- 本文を読まなくても一覧で拾えるようにする。note へ「⚠」と書くだけでは検索も集計もできない。

alter table project_tech_entries
  add column if not exists needs_check boolean not null default false,
  add column if not exists check_reason text;

alter table project_tech_topics
  add column if not exists needs_check boolean not null default false,
  add column if not exists check_reason text;

create index if not exists idx_project_tech_entries_needs_check
  on project_tech_entries(project_id, needs_check) where needs_check;

comment on column project_tech_entries.needs_check is
  '要確認。資料間で値が食い違う、実測が無い、根拠が弱い行に立てる。画面で強調し、トピック見出しに件数を出す。';
comment on column project_tech_entries.check_reason is
  '何を確認すべきか。「どちらの値を採るか」「誰に聞くか」まで書く。';
