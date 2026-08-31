-- テーマの経緯サマリー。記録本文や業務台帳を複製せず、観点別の要約と元記録IDを持つ。
-- 既存 profile のPJ境界・編集権限・楽観排他・削除保護をそのまま使う。RLS変更なし。
BEGIN;
ALTER TABLE public.project_theme_profiles
  ADD COLUMN history_rows jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.project_theme_profiles
  ADD CONSTRAINT project_theme_history_rows_array CHECK (
    jsonb_typeof(history_rows) = 'array'
    AND jsonb_array_length(history_rows) <= 40
    AND octet_length(history_rows::text) <= 200000
  );
COMMENT ON COLUMN public.project_theme_profiles.history_rows IS
  '観点別の経緯要約。id/topic/initial/developments/current/next/asOf/sourceNote/sources(kind,id)の配列。元のMTG/資料本文は複製せず参照し、記録時点と未確認を明示する。';
COMMIT;
