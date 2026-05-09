-- 038_triple_helix_loading.sql
--
-- Triple Helix 観測モデル C 行列の loading prior を保存する。
-- 正本: before-zero/theory/bvar_prior.md §3.2
--
-- y_t = C · x_t + η_t
--   y_t = (P, B, V, R, I_R, N) ∈ ℝ^6  (観測量)
--   x_t = (μ_A, μ_I, μ_G) ∈ ℝ^3      (隠れ状態 = Triple Helix momentum)
--   C   ∈ ℝ^{6×3}                    (loading 行列、bvar_prior §3.2)
--
-- Phase 1 では UI 表示と簡易 μ 計算 (重み付き和) で利用。
-- Phase 3 で BVAR Kalman filter に置き換える際の prior としても使う。

CREATE TABLE IF NOT EXISTS triple_helix_loading (
  observation TEXT PRIMARY KEY,           -- 'P' / 'B' / 'V' / 'R' / 'I_R' / 'N' / 'C_compete'
  mu_a        REAL NOT NULL,              -- μ_A (学) への loading
  mu_i        REAL NOT NULL,              -- μ_I (産) への loading
  mu_g        REAL NOT NULL,              -- μ_G (官) への loading
  description TEXT,                       -- 観測量の意味と loading の根拠
  unit        TEXT,                       -- 観測量の単位 (件/年、億円/年、本/年 等)
  data_source TEXT,                       -- 取得元 (data_specification.md §3 のソース)
  available   BOOL NOT NULL DEFAULT FALSE, -- AMD OS 内で観測量が取得できているか
  display_order INT NOT NULL,             -- UI 表示順
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE triple_helix_loading ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON triple_helix_loading;
CREATE POLICY anon_read ON triple_helix_loading FOR SELECT USING (true);

-- bvar_prior.md §3.2 の数値で初期 seed
INSERT INTO triple_helix_loading (observation, mu_a, mu_i, mu_g, description, unit, data_source, available, display_order)
VALUES
  ('P',         0.05, 0.05, 0.95,
   '政策密度: 閣議決定・法律・戦略文書の重み付き発行率。政府駆動 → μ_G に強 loading。',
   '件/Q', 'atlas_signals (source_type=policy / domain=B.規制・政策)', TRUE, 1),
  ('B',         0.10, 0.05, 0.85,
   '公募予算: NEDO/AMED/JST 公募採択額。政府駆動 → μ_G に強 loading。',
   '億円/Q', 'atlas_signals (source_type=grant)', FALSE, 2),
  ('V',         0.10, 0.85, 0.10,
   'VC 投資: このレーン SU への VC 投資額。産業駆動 → μ_I に強 loading。',
   '億円/Q', 'Crunchbase / INITIAL (Phase 2 で実装)', FALSE, 3),
  ('R',         0.40, 0.35, 0.30,
   '言及・PR: メディア言及量。学・産・官の全層からほぼ均等 loading。',
   '件/Q', 'atlas_signals (source_type=news)', TRUE, 4),
  ('I_R',       0.70, 0.10, 0.40,
   '研究費: KAKEN/JST 採択。学主・官副 → μ_A に強、μ_G に中 loading。',
   '億円/Q', 'KAKEN API (Phase 2 で実装)', FALSE, 5),
  ('N',         0.90, 0.05, 0.05,
   '論文流出率: OpenAlex 検索ヒット件数。学駆動 → μ_A に強 loading。',
   '本/Q', 'OpenAlex (papers_log via /api/cron/papers-quarterly-ingest)', TRUE, 6),
  ('C_compete', 0.05, 0.85, 0.10,
   '競合密度: 同レーン生存中 SU 数。産業駆動 → μ_I に強 loading。',
   '社', 'project_ventures (内部 DB から計算可能)', FALSE, 7)
ON CONFLICT (observation) DO UPDATE SET
  mu_a = EXCLUDED.mu_a,
  mu_i = EXCLUDED.mu_i,
  mu_g = EXCLUDED.mu_g,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  data_source = EXCLUDED.data_source,
  available = EXCLUDED.available,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

COMMENT ON TABLE triple_helix_loading IS
  'Triple Helix 観測モデル C 行列 (6×3) の loading prior。bvar_prior.md §3.2 を正本として seed。AmdScoreView の M カードと /scholar trend ページで参照。';
