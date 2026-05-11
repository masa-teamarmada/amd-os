-- 043_triple_helix_state_log.sql
--
-- Phase 3: BVAR Kalman filter による隠れ状態推定の保存先。
-- triple-helix-recompute cron (weekly) が ASPI 8 domain × 16 quarter で
-- Kalman smoother を走らせ、(μ_A, μ_I, μ_G) と σ_SU を結果として書き込む。
-- UI 側 (TripleHelixMatrix) は最新行を読んで簡易加重平均 (Phase 1) より優先表示。
--
-- 正本:
--   - before-zero/theory/state_space_model.md §10 (state-space モデル)
--   - before-zero/theory/bvar_prior.md (BVAR prior)
--   - pwa/HANDOFF_pwa_rebuild.md ★4 (Phase 3 仕様)
--   - pwa/design/aspi_lanes.md (lane = ASPI 8 domain)

CREATE TABLE IF NOT EXISTS triple_helix_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane TEXT NOT NULL,                   -- ASPI 8 domain id
  observed_at DATE NOT NULL,            -- quarter 開始日 (YYYY-MM-01)
  mu_a NUMERIC NOT NULL,                -- 隠れ状態 μ_A (学) Kalman smoother 推定
  mu_i NUMERIC NOT NULL,                -- 隠れ状態 μ_I (産)
  mu_g NUMERIC NOT NULL,                -- 隠れ状態 μ_G (官)
  sigma_su NUMERIC NOT NULL,            -- σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1
  model TEXT,                           -- 推定モデル ID (e.g. 'kalman-bvar-v1')
  raw_meta JSONB,                       -- coverage / 観測量別の中間値など
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lane, observed_at)
);

ALTER TABLE triple_helix_state_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON triple_helix_state_log;
CREATE POLICY anon_read ON triple_helix_state_log FOR SELECT USING (true);
DROP POLICY IF EXISTS service_role_bypass ON triple_helix_state_log;
CREATE POLICY service_role_bypass ON triple_helix_state_log FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS triple_helix_state_log_lane_observed_idx
  ON triple_helix_state_log(lane, observed_at);

COMMENT ON TABLE triple_helix_state_log IS
  'BVAR Kalman smoother で推定した Triple Helix 隠れ状態 (μ_A, μ_I, μ_G) の time series。lane = ASPI 8 domain。triple-helix-recompute cron (weekly) が書き込み、UI が最新行を優先表示。';
