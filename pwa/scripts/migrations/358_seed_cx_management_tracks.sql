-- 358_seed_cx_management_tracks.sql
--
-- CX / CryoX (p20) の論点・仮説台帳で使う管理柱を正本へ登録する。
--
-- 背景:
-- `getSxManagementBundle()` は柱が未登録の既存PJにも、旧4本柱を表示互換のため
-- フォールバック表示する。一方、保存APIとDBの複合FKは
-- `project_management_tracks` に実在する柱だけを受け付ける。そのためp20では
-- 論点追加フォームが柱を表示しないまま `trackが不正だよ` で保存できなかった。
--
-- p20の画面が従来から表示していた4本柱をそのまま正本として登録する。
-- 既に人が設定した柱は上書きしない。

BEGIN;

INSERT INTO public.project_management_tracks
  (project_id, track_key, label, short_label, accent, sort_order)
VALUES
  ('p20', 'business_development',    '事業開発', '事業', '#315f7d', 1),
  ('p20', 'technology_development',  '技術開発', '技術', '#38745d', 2),
  ('p20', 'funding',                 '資金調達', '資金', '#bf7b2c', 3),
  ('p20', 'organizational_building', '体制構築', '体制', '#76637b', 4)
ON CONFLICT (project_id, track_key) DO NOTHING;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.project_management_tracks
    WHERE project_id = 'p20'
      AND track_key IN (
        'business_development',
        'technology_development',
        'funding',
        'organizational_building'
      )
  ) <> 4 THEN
    RAISE EXCEPTION 'p20の論点・仮説用の管理柱4本を確認できない';
  END IF;
END $$;

COMMIT;
