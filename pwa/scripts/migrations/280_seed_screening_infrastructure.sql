-- 280: シーズ一次選別の前提インフラ
-- 設計正本: pwa/bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md §4（帯の凍結より前に閉じる）
--   1. seeds.status の語彙確定と CHECK 制約
--   2. 状態遷移履歴テーブル（旧状態・新状態・時刻・変更者）+ 自動記録トリガ
--   3. 帯の保存先テーブル（seed_sps_assessments とは別。外部ワークスペースDTOへ出さない）
-- 適用日: 2026-08-15。適用時点の status 実分布: investigating 132 / candidate 24 / spun_off 15 / discussing 5
-- （全値が設計語彙の内側であることを適用前に照会済み。contacted / declined は0件だが語彙として先に確保する）

BEGIN;

-- 1. status 語彙の CHECK 制約 -----------------------------------------------------------
ALTER TABLE public.seeds
  ADD CONSTRAINT seeds_status_check
  CHECK (status IN ('candidate', 'investigating', 'contacted', 'discussing', 'spun_off', 'declined'));

-- 2. 状態遷移履歴 -----------------------------------------------------------------------
-- 3章の遷移率検証は遷移時刻の観測が前提。updated_at だけでは遷移を観測できない。
-- 観測開始は本 migration 適用時点から（過去の遷移は復元しない = 偽の遷移時刻を作らない）。
CREATE TABLE public.seed_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id uuid NOT NULL REFERENCES public.seeds(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text,
  note text
);

CREATE INDEX seed_status_transitions_seed_time_idx
  ON public.seed_status_transitions (seed_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_seed_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.seed_status_transitions (seed_id, old_status, new_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, NEW.created_by, 'insert');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.seed_status_transitions (seed_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_status_transition_log
  AFTER INSERT OR UPDATE OF status ON public.seeds
  FOR EACH ROW EXECUTE FUNCTION public.log_seed_status_transition();

-- 3. 帯の保存先 -------------------------------------------------------------------------
-- 一次選別のスクリーニング帯（q帯・P帯・SPS帯・段階仮説）。seed_sps_assessments（本測定系）とは別テーブル。
-- append-only 運用: 再評価は新しい行の追加で表し、frozen=true の行は更新しない。
CREATE TABLE public.seed_screening_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id uuid NOT NULL REFERENCES public.seeds(id) ON DELETE CASCADE,
  ruleset_version text NOT NULL,          -- 例: 'rubric-v1+template-v0.3'
  evaluator text NOT NULL,                -- 例: 'えいみ session 9548d325'
  assessed_at timestamptz NOT NULL,
  stage_lower text,                       -- 段階仮説の下限 (S0〜S5)
  stage_upper text,                       -- 段階仮説の上限
  stage_tag text,                         -- stage_funding / stage_document / stage_inferred / stage_unknown
  axis_bands jsonb,                       -- 9軸帯+出所タグ（状態記述子。スコア集約には使わない）
  q_lower_pct numeric,                    -- 資本自立への到達見込み帯 (%)
  q_upper_pct numeric,
  q_main_factor text,                     -- 主要因タグ（一語）
  q_evidence jsonb,                       -- ルーブリック11要因の根拠引用
  p_class text,                           -- P類型の割当（包絡の内訳を含む表記）
  p_lower_yen bigint,                     -- 経路価値帯（円）
  p_upper_yen bigint,
  sps_lower_yen bigint,                   -- SPS帯 = q帯×P帯（円）
  sps_upper_yen bigint,
  frozen boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX seed_screening_bands_seed_idx
  ON public.seed_screening_bands (seed_id, assessed_at DESC);

-- 4. 露出制御 ---------------------------------------------------------------------------
-- 両テーブルとも内部評価データ。RLS を有効化し、ポリシーを一切作らない
-- = anon / authenticated からは読めず、service_role（RLS バイパス）経由の
-- サーバー側コードだけが読み書きできる。外部ワークスペースDTO
-- (institution-workspace-data.ts / public-workspace-data.ts) への追加は
-- check_seed_screening_bands_contract.mjs が静的に禁止する。
ALTER TABLE public.seed_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seed_screening_bands ENABLE ROW LEVEL SECURITY;

COMMIT;
