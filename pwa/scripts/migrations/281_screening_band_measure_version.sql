-- 281: seed_screening_bands へ measure_version 列を追加
-- SPS価値項の産業創出価値への差し替え (SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md, masa-agreed)
-- 旧measure(持分価値版)と新measure(産業創出価値版)の数値の歴史比較は禁止 (版統治=まさ確定)
BEGIN;
ALTER TABLE public.seed_screening_bands
  ADD COLUMN measure_version text NOT NULL DEFAULT 'sps-eq-v0';
COMMENT ON COLUMN public.seed_screening_bands.measure_version IS 'sps-eq-v0=旧持分価値版(OS非表示) / sps-ind-v1=産業創出価値版(現行)。異measure間の数値比較禁止';
COMMIT;
