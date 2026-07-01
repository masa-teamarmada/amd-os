-- 160_monthly_report_scope.sql
--
-- L2M-1 月次報告書 routine の対象範囲を 3値 enum で表現する。
--
-- 背景 (まさ 2026-07-01 確定):
--   monthly_report_required bool では「内部保存版だけ生成」「内部+対外の両方生成」「一切生成しない」
--   の 3 状態を表現できない。特に AMD (p00) は内部保存版だけほしいが、対外提出版は不要。
--   NIMS (p20) と CTB (p06) は一切生成しない。scope 列で明示的に持つ。
--
-- 移行方針:
--   monthly_report_required (bool) 列は backward compat のため残す (削除は別 migration)。
--   ロジックは scope を正本に切り替える。routine の対象判定は
--   `monthly_report_scope IN ('internal_only','internal_and_external')`。
--   external 生成は `monthly_report_scope = 'internal_and_external'` の PJ のみ。
--
-- backfill (このファイルには含めない、apply 時に execute_sql で別途反映済):
--   p25 (KUTE), p21 (SX), p20 (CX NIMS): internal_and_external
--   p00 (AMD), p07 (LST), p10 (SE), p19 (ZMP), p24 (CLG), p26 (VasculaX): internal_only
--   p06 (CTB): none
--   (2026-07-01 20 時 まさ追加確定で p20 CX を none → internal_and_external に変更)
--
-- 適用方法:
--   python -X utf8 scripts/apply_ddl.py scripts/migrations/160_monthly_report_scope.sql

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS monthly_report_scope text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_monthly_report_scope_check'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_monthly_report_scope_check
      CHECK (monthly_report_scope IN ('none','internal_only','internal_and_external'));
  END IF;
END $$;

COMMENT ON COLUMN public.projects.monthly_report_scope IS
  'L2M-1 月次報告書 routine の対象範囲。none = 対象外 / internal_only = 内部保存版のみ (monthly_reports.final_content) / internal_and_external = 内部 + 対外提出版 (monthly_reports_external + PDF)。amd-os-l2m1-monthly-report routine が読む正本。projects.monthly_report_required (bool) は backward compat のため残すが、判定は scope を優先する。';
