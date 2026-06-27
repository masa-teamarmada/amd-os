-- 158_proactive_todos_fix_unique.sql
--
-- 目的: proactive_todos の UNIQUE INDEX に COALESCE を使ったため、
--       supabase-js .upsert({...}, { onConflict: 'project_id,trigger_kind,source_meeting_id,source_event_id,title' })
--       がインデックスに紐付けられず、silent insert になって 0 件問題が出た。
--
-- 修正方針: source_meeting_id / source_event_id を NOT NULL DEFAULT '' に変更し、
--       UNIQUE INDEX から COALESCE を外して plain な複合 UNIQUE にする。これで
--       supabase-js の onConflict 文字列がそのままインデックスと一致する。
--
-- 既存 row はゼロ (cron がまだ 0 件挿入) なので破壊的変更だが影響なし。

ALTER TABLE public.proactive_todos
  ALTER COLUMN source_meeting_id SET DEFAULT '',
  ALTER COLUMN source_event_id SET DEFAULT '';

UPDATE public.proactive_todos
  SET source_meeting_id = '' WHERE source_meeting_id IS NULL;
UPDATE public.proactive_todos
  SET source_event_id = '' WHERE source_event_id IS NULL;

ALTER TABLE public.proactive_todos
  ALTER COLUMN source_meeting_id SET NOT NULL,
  ALTER COLUMN source_event_id SET NOT NULL;

DROP INDEX IF EXISTS proactive_todos_uniq_meeting;

CREATE UNIQUE INDEX IF NOT EXISTS proactive_todos_uniq_meeting
  ON public.proactive_todos (project_id, trigger_kind, source_meeting_id, source_event_id, title);
