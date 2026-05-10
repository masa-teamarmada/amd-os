-- 041_project_lanes_aspi.sql
--
-- ASPI Critical Technology Tracker 8 domains への lane 移行。
-- 正本: pwa/design/aspi_lanes.md (2026-05-11、まさ承認)
--
-- - project_ventures.lanes JSONB 追加 (weight 付き多重所属)
-- - 既存 10 PJ の lanes を seed (旧 lane TEXT から 1:1 mapping + p07/p20 は mix)
-- - 旧 lane TEXT 列は触らない (cron / lib 側を移行し終わるまで併存、別セッションで DROP)
-- - check constraint で domain enum と weight 合計 = 1.0 を強制

-- 1. lanes JSONB 列追加 (NULL 許容で先に追加 → seed → NOT NULL に)

ALTER TABLE project_ventures
  ADD COLUMN IF NOT EXISTS lanes JSONB;

COMMENT ON COLUMN project_ventures.lanes IS
  'ASPI Critical Technology Tracker 8 domains の weighted multi-lane。形式: [{"domain": "<id>", "weight": 0.0-1.0}]。weight 合計 = 1.0 (±0.001)、配列長 1-3。詳細: pwa/design/aspi_lanes.md';

-- 2. 10 PJ 確定 mapping を seed (まさ承認 2026-05-11)
--    p07 LiSTie / p20 CryoX は materials × energy/env の 0.5/0.5 mix、他は 1.0 単一

UPDATE project_ventures SET lanes = '[{"domain": "advanced_materials_manufacturing", "weight": 1.0}]'::jsonb WHERE project_id = 'p03';
UPDATE project_ventures SET lanes = '[{"domain": "defence_space_robotics_transport", "weight": 1.0}]'::jsonb WHERE project_id = 'p04';
UPDATE project_ventures SET lanes = '[{"domain": "biotechnology", "weight": 1.0}]'::jsonb WHERE project_id = 'p06';
UPDATE project_ventures SET lanes = '[{"domain": "advanced_materials_manufacturing", "weight": 0.5}, {"domain": "energy_environment", "weight": 0.5}]'::jsonb WHERE project_id = 'p07';
UPDATE project_ventures SET lanes = '[{"domain": "energy_environment", "weight": 1.0}]'::jsonb WHERE project_id = 'p09';
UPDATE project_ventures SET lanes = '[{"domain": "energy_environment", "weight": 1.0}]'::jsonb WHERE project_id = 'p11';
UPDATE project_ventures SET lanes = '[{"domain": "energy_environment", "weight": 1.0}]'::jsonb WHERE project_id = 'p18';
UPDATE project_ventures SET lanes = '[{"domain": "advanced_materials_manufacturing", "weight": 0.5}, {"domain": "energy_environment", "weight": 0.5}]'::jsonb WHERE project_id = 'p20';
UPDATE project_ventures SET lanes = '[{"domain": "energy_environment", "weight": 1.0}]'::jsonb WHERE project_id = 'p21';
UPDATE project_ventures SET lanes = '[{"domain": "energy_environment", "weight": 1.0}]'::jsonb WHERE project_id = 'p24';

-- 3. check constraint
--    - 配列であること
--    - 配列長 1-3
--    - 各要素は domain (8 enum のいずれか) と weight (0-1) を持つ
--    - weight 合計 = 1.0 (±0.001)

CREATE OR REPLACE FUNCTION project_ventures_lanes_valid(lanes JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  total NUMERIC := 0;
  el JSONB;
  d TEXT;
  w NUMERIC;
  valid_domains TEXT[] := ARRAY[
    'advanced_ict',
    'advanced_materials_manufacturing',
    'ai_technologies',
    'biotechnology',
    'defence_space_robotics_transport',
    'energy_environment',
    'quantum',
    'sensing_timing_navigation'
  ];
BEGIN
  IF lanes IS NULL THEN
    RETURN TRUE;  -- NULL は許容 (seed 完了後に NOT NULL 化検討)
  END IF;
  IF jsonb_typeof(lanes) <> 'array' THEN
    RETURN FALSE;
  END IF;
  IF jsonb_array_length(lanes) < 1 OR jsonb_array_length(lanes) > 3 THEN
    RETURN FALSE;
  END IF;
  FOR el IN SELECT jsonb_array_elements(lanes) LOOP
    d := el ->> 'domain';
    w := (el ->> 'weight')::NUMERIC;
    IF d IS NULL OR w IS NULL THEN RETURN FALSE; END IF;
    IF NOT (d = ANY(valid_domains)) THEN RETURN FALSE; END IF;
    IF w < 0 OR w > 1 THEN RETURN FALSE; END IF;
    total := total + w;
  END LOOP;
  IF ABS(total - 1.0) > 0.001 THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

ALTER TABLE project_ventures
  DROP CONSTRAINT IF EXISTS project_ventures_lanes_valid_chk;
ALTER TABLE project_ventures
  ADD CONSTRAINT project_ventures_lanes_valid_chk
  CHECK (project_ventures_lanes_valid(lanes));

-- 4. 動作確認: 10 PJ 全員 lanes が入ってて check 通るか
--    (apply 時に NOTICE で出すだけ、エラーにはしない)

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM project_ventures WHERE lanes IS NULL;
  IF cnt > 0 THEN
    RAISE NOTICE '[041] WARNING: % project_ventures rows still have NULL lanes', cnt;
  ELSE
    RAISE NOTICE '[041] OK: all project_ventures rows have lanes seeded';
  END IF;
END $$;
