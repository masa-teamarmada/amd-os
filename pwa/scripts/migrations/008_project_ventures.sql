-- 008_project_ventures.sql
--
-- 目的:
--   1. `ventures.id` (TEXT, 'tiem' / 'bwe' 等) を廃止し、`projects.project_id` に統合する
--   2. 旧 `ventures` → `project_ventures` (project_id PK FK to projects)
--   3. 旧 `ventures_xrl_log` → `project_xrl_log` (venture_id → project_id)
--   4. `seeds.linked_venture_id` → `seeds.linked_project_id`
--   5. PJ コックピット用の `project_events` テーブルを新規作成
--
-- 単位ルール: SU は「PJ」と数える。「社」「ventures」表記は禁止。
--   詳細は AGENTS.common.md「単位ルール: SU は『PJ』と数える」
--
-- マッピング (legacy ventures.id → projects.project_id):
--   tiem→p03, bwe→p11, jc→p09, ctb→p06, lst→p07,
--   kt→p04, cx→p20, sx→p21, yd→p18
--
-- 冪等性: CREATE/INSERT は IF NOT EXISTS / ON CONFLICT で再実行可。
--        DROP TABLE は IF EXISTS で再実行可。

-- =====================================================================
-- 1. project_ventures
-- =====================================================================

CREATE TABLE IF NOT EXISTS project_ventures (
  project_id TEXT PRIMARY KEY REFERENCES projects(project_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,          -- 対外表示名 ('ティエムファクトリ' 等)。`projects.project_name` (短縮形) とは別
  short_label TEXT,                    -- 短縮表示用 ('ティエム' 等)
  lane TEXT NOT NULL,                  -- 'gx_energy' | 'gx_circular' | 'materials' | 'life' | 'robo'
  founded_at DATE,                     -- pre_founding の場合 NULL 可
  outcome_pattern TEXT NOT NULL,       -- 'rocket' | 'lifted' | 'deep_pivot' | 'burnout' | 'ue_fail'
  origin_org TEXT,
  origin_pi TEXT,
  amd_role TEXT,                       -- 'studio' | 'support' | 'founder_studio'
  short_description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 既存テーブルへの追加 (再適用時用、display_name/short_label を後付け)
ALTER TABLE project_ventures ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE project_ventures ADD COLUMN IF NOT EXISTS short_label TEXT;

CREATE INDEX IF NOT EXISTS idx_project_ventures_lane ON project_ventures(lane);

ALTER TABLE project_ventures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_ventures;
CREATE POLICY anon_read ON project_ventures FOR SELECT USING (true);

-- 旧 ventures からデータ移行 (id mapping)
-- 旧 ventures が存在するときだけ実行 (再適用時には DROP 済みなのでスキップ)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ventures') THEN
    INSERT INTO project_ventures (project_id, display_name, short_label, lane, founded_at, outcome_pattern, origin_org, origin_pi, amd_role, short_description, is_public, created_at)
    SELECT m.project, v.display_name, v.short_label, v.lane, v.founded_at, v.outcome_pattern, v.origin_org, v.origin_pi, v.amd_role, v.short_description, v.is_public, v.created_at
    FROM ventures v
    JOIN (
      VALUES ('tiem','p03'),('bwe','p11'),('jc','p09'),('ctb','p06'),('lst','p07'),('kt','p04'),('cx','p20'),('sx','p21'),('yd','p18')
    ) AS m(legacy, project) ON m.legacy = v.id
    ON CONFLICT (project_id) DO UPDATE SET
      display_name      = EXCLUDED.display_name,
      short_label       = EXCLUDED.short_label,
      lane              = EXCLUDED.lane,
      founded_at        = EXCLUDED.founded_at,
      outcome_pattern   = EXCLUDED.outcome_pattern,
      origin_org        = EXCLUDED.origin_org,
      origin_pi         = EXCLUDED.origin_pi,
      amd_role          = EXCLUDED.amd_role,
      short_description = EXCLUDED.short_description,
      is_public         = EXCLUDED.is_public,
      updated_at        = NOW();
  END IF;
END $$;

-- 再適用時: project_ventures が空 / display_name 抜けの行があるなら、固定表データから埋める
INSERT INTO project_ventures (project_id, display_name, short_label, lane, founded_at, outcome_pattern, origin_org, origin_pi, amd_role, short_description, is_public)
VALUES
  ('p03', 'ティエムファクトリ', 'ティエム', 'materials',   '2012-11-01', 'burnout',    '京都大学',         '山地正洋',  'founder_studio', '透明断熱素材。TRL3で立ててシリーズBでオフサイトPoC、オンサイト未達。資金切れで2022退任', true),
  ('p11', 'Blue Water Energy', 'BWE',     'gx_energy',   '2019-04-01', 'lifted',     'BWE',              '山地正洋',  'studio',         'スタジオモデル第1号 / 濃度差発電 / 長崎西部下水で大型PoC実施', true),
  ('p09', 'JOYCLE',            'JC',      'gx_circular', '2023-07-01', 'deep_pivot', '群馬大学',         '小柳裕太郎','support',        'IRSプリミティブ熱分解で立上 → 群大野田先生の流動層熱分解で後付けdeep化', true),
  ('p06', 'CrestecBio',        'CTB',     'life',        '2023-04-01', 'rocket',     '筑波大学',         '丸島',      'studio',         '虚血性脳卒中薬 CTB211 / 大動物試験OK / AMED採択', true),
  ('p07', 'LiSTie',            'LST',     'gx_circular', '2023-04-01', 'rocket',     'QST',              NULL,        'studio',         'リチウム回収 / TRL4で立上 / オンサイトPoC開始中', true),
  ('p04', '輝翠TECH',          'KT',      'robo',        '2022-04-01', 'lifted',     '東北大学',         NULL,        'studio',         '農業ロボ / オンサイトPoC完了', true),
  ('p20', 'CryoX (仮称)',      'CX',      'gx_energy',   '2026-04-01', 'rocket',     'NIMS',             '神谷宏治',  'founder_studio', 'NIMS発磁気冷凍 → CO2フリーDC冷却 + 量子QC冷却 / Build VC 7月出資想定', true),
  ('p21', 'SolvioraX',         'SX',      'gx_circular', '2025-07-01', 'rocket',     '愛媛大学',         '杉浦美羽',  'founder_studio', 'シアノバクテリア排水処理 / PSI Step2 / 2027-04設立目標', true),
  ('p18', 'Yellow Duck',       'YD',      'gx_energy',   '2019-01-01', 'ue_fail',    NULL,               NULL,        'studio',         '波力発電 / オンサイトPoC到達もUE不成立で資金調達失敗', true)
ON CONFLICT (project_id) DO UPDATE SET
  display_name = COALESCE(project_ventures.display_name, EXCLUDED.display_name),
  short_label  = COALESCE(project_ventures.short_label,  EXCLUDED.short_label);

-- display_name が NULL のままにならないよう NOT NULL 化 (両側埋まったタイミングで)
ALTER TABLE project_ventures ALTER COLUMN display_name SET NOT NULL;

-- =====================================================================
-- 2. project_xrl_log
-- =====================================================================

CREATE TABLE IF NOT EXISTS project_xrl_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  observed_at DATE NOT NULL,
  trl INT,
  brl INT,
  hrl INT,
  grl INT,
  srl INT,
  bottleneck TEXT,                     -- 'TRL' | 'BRL' | 'HRL' | 'GRL' | 'SRL'
  milestone_label TEXT,
  source_note TEXT,
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'llm_proposal' | 'pm_confirmed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_xrl_log_pj_date ON project_xrl_log(project_id, observed_at);

ALTER TABLE project_xrl_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_xrl_log;
CREATE POLICY anon_read ON project_xrl_log FOR SELECT USING (true);

-- 旧 ventures_xrl_log からデータ移行 (id 保持 + venture_id → project_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ventures_xrl_log') THEN
    INSERT INTO project_xrl_log (id, project_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label, source_note, source, created_at)
    SELECT v.id, m.project, v.observed_at, v.trl, v.brl, v.hrl, v.grl, v.srl, v.bottleneck, v.milestone_label, v.source_note, 'manual', v.created_at
    FROM ventures_xrl_log v
    JOIN (
      VALUES ('tiem','p03'),('bwe','p11'),('jc','p09'),('ctb','p06'),('lst','p07'),('kt','p04'),('cx','p20'),('sx','p21'),('yd','p18')
    ) AS m(legacy, project) ON m.legacy = v.venture_id
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- =====================================================================
-- 3. seeds.linked_venture_id → linked_project_id
-- =====================================================================
-- 実データに NULL 以外の値はないため、単純に column を入れ替える。

ALTER TABLE seeds ADD COLUMN IF NOT EXISTS linked_project_id TEXT REFERENCES projects(project_id);
ALTER TABLE seeds DROP COLUMN IF EXISTS linked_venture_id;

-- =====================================================================
-- 4. project_events (PJ コックピット Status 用の汎用イベントログ)
-- =====================================================================

CREATE TABLE IF NOT EXISTS project_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL,
  kind TEXT NOT NULL,
  -- kind ∈ 'hire' | 'funding' | 'deal' | 'governance' | 'note' | 'xrl_obs' | 'amd_score_override'
  label TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'llm_proposal' | 'pm_confirmed' | 'auto'
  created_by TEXT,                       -- members.member_id (nullable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_events_pj_date ON project_events(project_id, occurred_on);
CREATE INDEX IF NOT EXISTS idx_project_events_kind ON project_events(kind);

ALTER TABLE project_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_events;
CREATE POLICY anon_read ON project_events FOR SELECT USING (true);

-- =====================================================================
-- 5. project_ventures に narrative cache (沿革) 列を追加
-- =====================================================================

ALTER TABLE project_ventures ADD COLUMN IF NOT EXISTS narrative_text TEXT;
ALTER TABLE project_ventures ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMPTZ;
ALTER TABLE project_ventures ADD COLUMN IF NOT EXISTS narrative_invalidated_at TIMESTAMPTZ;

-- =====================================================================
-- 6. 旧テーブル DROP
-- =====================================================================

DROP TABLE IF EXISTS ventures_xrl_log;
DROP TABLE IF EXISTS ventures;
