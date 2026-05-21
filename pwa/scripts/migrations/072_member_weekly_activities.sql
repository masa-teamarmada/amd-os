-- 072_member_weekly_activities.sql
-- Gmail / Calendar / source_cache からメンバー別の週次活動を抽出して
-- member_activities(source='member_weekly') に保存できるようにする。

ALTER TABLE public.member_activities
  DROP CONSTRAINT IF EXISTS member_activities_source_check;

ALTER TABLE public.member_activities
  ADD CONSTRAINT member_activities_source_check
  CHECK (source = ANY (ARRAY[
    'slack'::text,
    'notion'::text,
    'gmail'::text,
    'gmeet'::text,
    'drive'::text,
    'calendar'::text,
    'inferred'::text,
    'manual'::text,
    'cron_l2_extract'::text,
    'member_weekly'::text
  ]));

CREATE INDEX IF NOT EXISTS idx_member_activities_member_weekly
  ON public.member_activities (member_id, item_date DESC)
  WHERE source = 'member_weekly';

COMMENT ON CONSTRAINT member_activities_source_check ON public.member_activities IS
  'Allowed sources for member activity events. member_weekly is derived from Gmail/Calendar/source_cache for MyPage weekly activity and downstream L2 inputs.';
