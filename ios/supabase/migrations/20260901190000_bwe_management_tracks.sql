-- BWE (p11) の論点・仮説入力で使う管理分類を正本へ登録する。
--
-- 共有ワークスペースは分類が未登録のPJに従来の4分類を表示する互換表示を持つ。
-- 一方で保存時は (project_id, track) の複合FKに従い、実在する
-- project_management_tracks だけを受け付ける。その差によりp11では
-- 論点追加が "trackが不正だよ" で失敗していた。
--
-- BWEの既存管理レコードは0件で、分類の個別定義も未登録だったことを
-- readbackで確認済み。既存画面が表示していた標準4分類だけを追加する。
-- ON CONFLICT DO NOTHING は、以後の個別分類や手動編集を上書きしない。

BEGIN;

INSERT INTO public.project_management_tracks
  (project_id, track_key, label, short_label, accent, sort_order)
VALUES
  ('p11', 'business_development', '事業開発', '事業', '#315f7d', 1),
  ('p11', 'technology_development', '技術開発', '技術', '#38745d', 2),
  ('p11', 'funding', '資金調達', '資金', '#bf7b2c', 3),
  ('p11', 'organizational_building', '体制構築', '体制', '#76637b', 4)
ON CONFLICT (project_id, track_key) DO NOTHING;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.project_management_tracks
    WHERE project_id = 'p11'
      AND track_key IN (
        'business_development',
        'technology_development',
        'funding',
        'organizational_building'
      )
  ) <> 4 THEN
    RAISE EXCEPTION 'BWE management track bootstrap is incomplete';
  END IF;
END $$;

COMMIT;
