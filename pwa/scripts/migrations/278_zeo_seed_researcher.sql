-- 278_zeo_seed_researcher.sql
--
-- ゼオライトシーズ (p31 / ZEO) の研究者を中島先生へ訂正する。
-- まさ確定 2026-08-14:「研究者名は中島先生にしておいて。野村先生の成果でもあるけど、
-- 実際にステップ２に申請するのは中島先生なので。」
--
-- migration 204 の時点で researcher_name='野村信福' / researcher_title='教授' が入っていた。
-- シーズの代表研究者は「ステップ2申請の主体」で置く。野村先生の寄与は internal_notes に残し、
-- 成果の出どころを消さない。
--
-- 中島先生の職位は未確認なので researcher_title は NULL にする (野村先生の '教授' を
-- そのまま流用すると別人の職位を貼ることになる)。確認できたら別migrationで入れる。

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM seeds
  WHERE id = '3c6c774d-4f8e-4d99-aa00-f149a75f98d5'
    AND title = 'ゼオライトを共通基盤とするナトリウムイオン二次電池材料';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '対象ゼオライトシーズが % 件 (想定=1)', v_count;
  END IF;
END $$;

UPDATE seeds
SET
  researcher_name = '中島 純一',
  researcher_title = NULL,
  internal_notes = TRIM(BOTH E'\n' FROM
    COALESCE(internal_notes || E'\n\n', '') ||
    '2026-08-14 まさ確定: 代表研究者をステップ2申請の主体である中島先生へ訂正。' ||
    '野村信福教授の成果でもあるが、申請者は中島先生。中島先生の職位は未確認のため researcher_title は未設定。' ||
    'SX (p21) のリアクター・装置開発を担う中島純一先生と同一人物と見られるが、本人確認は未実施。'
  ),
  updated_at = now()
WHERE id = '3c6c774d-4f8e-4d99-aa00-f149a75f98d5'
  AND researcher_name IS DISTINCT FROM '中島 純一';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM seeds
    WHERE id = '3c6c774d-4f8e-4d99-aa00-f149a75f98d5'
      AND researcher_name = '中島 純一'
      AND internal_notes LIKE '%野村信福教授の成果でもある%'
  ) THEN
    RAISE EXCEPTION 'ゼオライトシーズの研究者訂正が反映されていない';
  END IF;
END $$;
