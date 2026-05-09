-- 031_amd_score_frl_grit_resilience.sql
--
-- FRL を 6 因子 (ALQ 4 + Grit + Resilience) に拡張。
-- 正本: theory/amd_score.md §3.F.5 (Before Zero Theory v3.2.1)
--
-- まさフィードバック (2026-05-09):
-- ALQ 4 次元はオーセンティシティ特化で、起業重要因子の Grit / Resilience が含まれない。
--   - Grit:        脇目も振らず長期目標に邁進する集中力 (Duckworth 2007)
--   - Resilience:  VC 拒絶等の失敗からの回復力、タフさ (Markman 2005)
-- これらは ALQ には含まれない別軸として確立されてるので、独立 sub-component として追加。
--
-- FRL の計算式 (重み付き平均):
--   FRL = 0.6 · ALQ_4 平均 + 0.2 · Grit + 0.2 · Resilience
--
-- 各値 0-9。frl は最終値で UI から override 可。

ALTER TABLE amd_score_inputs
  ADD COLUMN IF NOT EXISTS frl_grit REAL,           -- Duckworth 2007 ベース
  ADD COLUMN IF NOT EXISTS frl_resilience REAL;     -- Markman 2005 ベース

COMMENT ON COLUMN amd_score_inputs.frl_grit IS
  'Founder Grit 0-9 — 脇目も振らず長期目標に邁進する集中力. Duckworth, Peterson, Matthews & Kelly (2007) Journal of Personality and Social Psychology';
COMMENT ON COLUMN amd_score_inputs.frl_resilience IS
  'Founder Resilience 0-9 — 失敗・VC 拒絶からの回復力, タフさ. Markman, Baron & Balkin (2005) Journal of Organizational Behavior';
