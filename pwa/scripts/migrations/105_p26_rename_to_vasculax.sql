-- 105_p26_rename_to_vasculax.sql
--
-- 2026-05-27 まさ判断:
--   GreenPulse は FloraPulse (米国競合) と名称被りするため、
--   一旦 VasculaX (略称 vsx) に戻す。
--
-- 変更:
--   projects.project_name:        GP → VasculaX
--   project_ventures.display_name: GP (仮称) → VasculaX (仮称)
--   project_ventures.short_label:  GP → VSX

UPDATE projects
SET project_name = 'VasculaX',
    updated_at   = NOW()
WHERE project_id = 'p26';

UPDATE project_ventures
SET display_name = 'VasculaX (仮称)',
    short_label  = 'VSX',
    updated_at   = NOW()
WHERE project_id = 'p26';
