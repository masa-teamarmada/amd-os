-- 013_amd_score.sql
--
-- AMD Score (Before Zero Theory v3.2 — 7 軸 Cobb-Douglas 統合) の永続化。
--
-- AMD Score = K · Π (X_i + 1)^α_i  (X = {σ_SU, TRL, BRL, GRL, SRL, HRL, FRL})
--   σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1   (Triple Helix CD)
--   K   = 100,000 / 10^Σα                     (全軸 9 で IPO 級 100,000)
-- Shallow Tech モード (TRL=null) は TRL 軸を計算から除外。
--
-- 1. amd_score_inputs: 各 PJ × 評価時点の 7 軸 (μ_A/μ_I/μ_G + 5 XRL + FRL) 値
-- 2. amd_score_alpha: 弾力性 α_i のバージョン管理 (effective_from / effective_to)
-- 3. base case alpha を seed
-- 4. 8 PJ retrofit データを seed (まさ判断 2026-05-06)

-- ============================================================
-- 1. amd_score_inputs
-- ============================================================
CREATE TABLE IF NOT EXISTS amd_score_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  evaluated_at TIMESTAMPTZ NOT NULL,                  -- 評価時点 (経時追跡用)
  -- Triple Helix 観測 (0-9, σ_SU は派生)
  mu_A REAL,                                          -- 学術 (μ_A)
  mu_I REAL,                                          -- 産業 (μ_I)
  mu_G REAL,                                          -- 政府 (μ_G)
  -- 内閣府 SIP 5 XRL + FRL (0-9)
  trl REAL,                                           -- nullable: Shallow Tech モード
  brl REAL,
  grl REAL,
  srl REAL,
  hrl REAL,
  frl REAL,
  shallow_tech_mode BOOLEAN NOT NULL DEFAULT FALSE,
  evaluator TEXT,                                     -- 'masa+amy' / 'amy' / 'cron' 等
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, evaluated_at)
);
CREATE INDEX IF NOT EXISTS idx_amd_score_inputs_pj ON amd_score_inputs(project_id, evaluated_at DESC);

ALTER TABLE amd_score_inputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON amd_score_inputs;
CREATE POLICY anon_read ON amd_score_inputs FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON amd_score_inputs;
CREATE POLICY admin_all ON amd_score_inputs FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON amd_score_inputs;
CREATE POLICY service_role_bypass ON amd_score_inputs FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 2. amd_score_alpha
-- ============================================================
CREATE TABLE IF NOT EXISTS amd_score_alpha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alpha JSONB NOT NULL,                               -- {sigma_SU, TRL, BRL, GRL, SRL, HRL, FRL}
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,                           -- null = 現役、新版保存時に前版を更新
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_amd_score_alpha_active
  ON amd_score_alpha(effective_from DESC) WHERE effective_to IS NULL;

ALTER TABLE amd_score_alpha ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON amd_score_alpha;
CREATE POLICY anon_read ON amd_score_alpha FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON amd_score_alpha;
CREATE POLICY admin_all ON amd_score_alpha FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON amd_score_alpha;
CREATE POLICY service_role_bypass ON amd_score_alpha FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 3. base case alpha (まさ判断 + Bernstein 2017 + 内閣府 SIP, sum = 6.0)
-- ============================================================
INSERT INTO amd_score_alpha (alpha, effective_from, notes)
SELECT
  '{"sigma_SU":1.3,"TRL":1.0,"BRL":0.6,"GRL":0.3,"SRL":0.2,"HRL":1.1,"FRL":1.5}'::jsonb,
  NOW(),
  'base case (Bernstein 2017 + 内閣府 SIP + まさ判断 2026-05-06). Σα=6.0 → K=0.1 で IPO 級 100,000 校正'
WHERE NOT EXISTS (SELECT 1 FROM amd_score_alpha);

-- ============================================================
-- 4. 8 PJ retrofit seed (まさヒアリング 2026-05-06)
--
--   ID mapping (migration 008 と整合):
--     tiem→p03, jc→p09, bwe→p11, ctb→p06, cx→p20, sx→p21, yd→p18
--   clg は project_ventures に未登録のため対象外。
--   実 PJ が無い行は WHERE 句で skip。
-- ============================================================

-- tiem (p03) — 中西 PMSQ 発明直後 (2007) と設立 (2012-11)
INSERT INTO amd_score_inputs (project_id, evaluated_at, mu_A, mu_I, mu_G, trl, brl, grl, srl, hrl, frl, shallow_tech_mode, evaluator, notes)
SELECT 'p03', '2007-03-01'::timestamptz, 8, 2, 2, 1, 0, 3, 3, 0, 0, FALSE, 'masa+amy', '中西 PMSQ Adv Mater 発表直後'
WHERE EXISTS (SELECT 1 FROM project_ventures WHERE project_id = 'p03')
ON CONFLICT (project_id, evaluated_at) DO NOTHING;

INSERT INTO amd_score_inputs (project_id, evaluated_at, mu_A, mu_I, mu_G, trl, brl, grl, srl, hrl, frl, shallow_tech_mode, evaluator, notes)
SELECT 'p03', '2012-11-02'::timestamptz, 8, 4, 7, 0, 1, 5, 5, 1, 4, FALSE, 'masa+amy', '設立時、自社内製不可で TRL=0'
WHERE EXISTS (SELECT 1 FROM project_ventures WHERE project_id = 'p03')
ON CONFLICT (project_id, evaluated_at) DO NOTHING;

-- bwe (p11)
INSERT INTO amd_score_inputs (project_id, evaluated_at, mu_A, mu_I, mu_G, trl, brl, grl, srl, hrl, frl, shallow_tech_mode, evaluator, notes)
SELECT 'p11', '2025-04-28'::timestamptz, 5, 5, 8, 4, 3, 7, 6, 3, 5, FALSE, 'masa+amy', 'SIP 採択ありきで設立、まさ CEO'
WHERE EXISTS (SELECT 1 FROM project_ventures WHERE project_id = 'p11')
ON CONFLICT (project_id, evaluated_at) DO NOTHING;

-- cx (p20) — 設立予定
INSERT INTO amd_score_inputs (project_id, evaluated_at, mu_A, mu_I, mu_G, trl, brl, grl, srl, hrl, frl, shallow_tech_mode, evaluator, notes)
SELECT 'p20', '2026-08-01'::timestamptz, 5, 5, 6, 4, 4, 5, 5, 3, 5, FALSE, 'masa+amy', '設立予定、Kiutra 競合あり'
WHERE EXISTS (SELECT 1 FROM project_ventures WHERE project_id = 'p20')
ON CONFLICT (project_id, evaluated_at) DO NOTHING;

-- sx (p21) — 設立予定
INSERT INTO amd_score_inputs (project_id, evaluated_at, mu_A, mu_I, mu_G, trl, brl, grl, srl, hrl, frl, shallow_tech_mode, evaluator, notes)
SELECT 'p21', '2027-04-01'::timestamptz, 6, 5, 7, 5, 4, 7, 7, 4, 5, FALSE, 'masa+amy', '設立予定、PSI Step2'
WHERE EXISTS (SELECT 1 FROM project_ventures WHERE project_id = 'p21')
ON CONFLICT (project_id, evaluated_at) DO NOTHING;

-- ctb (p06) — 設立時 (推定)
INSERT INTO amd_score_inputs (project_id, evaluated_at, mu_A, mu_I, mu_G, trl, brl, grl, srl, hrl, frl, shallow_tech_mode, evaluator, notes)
SELECT 'p06', '2020-01-01'::timestamptz, 6, 4, 7, 5, 2, 7, 7, 2, 5, FALSE, 'masa+amy', '設立時 (推定)、小動物試験完了'
WHERE EXISTS (SELECT 1 FROM project_ventures WHERE project_id = 'p06')
ON CONFLICT (project_id, evaluated_at) DO NOTHING;

-- yd (p18) — AMD 関与開始時
INSERT INTO amd_score_inputs (project_id, evaluated_at, mu_A, mu_I, mu_G, trl, brl, grl, srl, hrl, frl, shallow_tech_mode, evaluator, notes)
SELECT 'p18', '2025-06-01'::timestamptz, 4, 2, 4, 4, 1, 4, 4, 2, 3, FALSE, 'masa+amy', 'AMD 関与開始時、UE 弱'
WHERE EXISTS (SELECT 1 FROM project_ventures WHERE project_id = 'p18')
ON CONFLICT (project_id, evaluated_at) DO NOTHING;

-- jc (p09) — Shallow Tech 設立 (TRL=null)
INSERT INTO amd_score_inputs (project_id, evaluated_at, mu_A, mu_I, mu_G, trl, brl, grl, srl, hrl, frl, shallow_tech_mode, evaluator, notes)
SELECT 'p09', '2023-03-01'::timestamptz, 4, 4, 6, NULL, 2, 5, 6, 2, 3, TRUE, 'masa+amy', 'Shallow Tech 設立 (IRS 熱分解 IoT)'
WHERE EXISTS (SELECT 1 FROM project_ventures WHERE project_id = 'p09')
ON CONFLICT (project_id, evaluated_at) DO NOTHING;
