-- 477: migration 475 で橋渡しに残した accept_sx_task_pt を消す。
--
-- 本番の画面（v3.158.0、2026-10-04）は全PJ共通の accept_project_task_pt を呼ぶ。
-- SOL だけの名前の関数を残さない（2026-10-04 まさ「特定のPJだけの特例を入れたらシステムにならない」）。

BEGIN;

DROP FUNCTION IF EXISTS public.accept_sx_task_pt(text, uuid, numeric, text);

COMMIT;
