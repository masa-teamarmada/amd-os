-- 246_killer_factor_catalog.sql
--
-- BZM 2.0 のキラー要素カタログを、全 PJ 共通の要素マスタと
-- PJ × 要素ごとの観測状態に分けて保存する。
--
-- 発生は記録・文書で確認した事象だけを対象にし、発生行では
-- 発生日・根拠メモ・記録者を必須にする。通知・再計算・LLM 呼び出しは持たない。

-- ============================================================
-- 1. 全 PJ 共通のキラー要素マスタ
-- ============================================================
CREATE TABLE IF NOT EXISTS public.killer_factor_catalog (
  killer_factor_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_type           text NOT NULL,
  event_description     text NOT NULL,
  observation_clues     text NOT NULL,
  sort_order            integer NOT NULL DEFAULT 100,
  is_active             boolean NOT NULL DEFAULT true,
  created_by_member_id  text REFERENCES public.members(member_id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT killer_factor_catalog_identity_uniq
    UNIQUE (factor_type, event_description),
  CONSTRAINT killer_factor_catalog_nonempty_check
    CHECK (
      btrim(factor_type) <> ''
      AND btrim(event_description) <> ''
      AND btrim(observation_clues) <> ''
    ),
  CONSTRAINT killer_factor_catalog_sort_order_check
    CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS killer_factor_catalog_active_order_idx
  ON public.killer_factor_catalog(is_active, sort_order, created_at);

-- ============================================================
-- 2. PJ × 要素ごとの観測状態
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_killer_factor_states (
  state_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  killer_factor_id         uuid NOT NULL REFERENCES public.killer_factor_catalog(killer_factor_id) ON DELETE CASCADE,
  status                   text NOT NULL DEFAULT 'not_occurred',
  occurred_on              date,
  evidence_note            text,
  recorded_by_member_id    text REFERENCES public.members(member_id),
  recorded_at              timestamptz,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_killer_factor_states_pair_uniq
    UNIQUE (project_id, killer_factor_id),
  CONSTRAINT project_killer_factor_states_status_check
    CHECK (status IN ('not_occurred', 'occurred')),
  CONSTRAINT project_killer_factor_states_occurrence_check
    CHECK (
      (
        status = 'not_occurred'
        AND occurred_on IS NULL
        AND evidence_note IS NULL
        AND recorded_by_member_id IS NULL
        AND recorded_at IS NULL
      )
      OR
      (
        status = 'occurred'
        AND occurred_on IS NOT NULL
        AND evidence_note IS NOT NULL
        AND btrim(evidence_note) <> ''
        AND recorded_by_member_id IS NOT NULL
        AND recorded_at IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS project_killer_factor_states_project_status_idx
  ON public.project_killer_factor_states(project_id, status, updated_at DESC);

-- ============================================================
-- 3. 初版 7 型
-- ============================================================
INSERT INTO public.killer_factor_catalog (
  factor_type,
  event_description,
  observation_clues,
  sort_order
) VALUES
  (
    '経営整合',
    '経営のベクトルが事業化を向いていない',
    '資金使途・人事が計画工程と噛み合わない。縁故採用。技術コアを握る人材の追放',
    10
  ),
  (
    'ガバナンス',
    '経営を交代・是正できる構造が無い',
    'SHA・定款に交代条項が無い。取締役会が機能していない',
    20
  ),
  (
    '管理体制',
    '管理の基本動作が崩れている',
    '経費・契約・労務の処理不備が繰り返し記録される',
    30
  ),
  (
    '金銭感覚',
    '資金の使い方に異常がある',
    '私的性格の強い支出。事業規模に不相応な役員報酬',
    40
  ),
  (
    '経営チーム',
    '中核メンバー間の関係破綻',
    'CEO と CTO の対立。退任予告。意思決定の停滞',
    50
  ),
  (
    '社会的信用',
    '信用を毀損する事象の公知化',
    '全国規模の否定的報道',
    60
  ),
  (
    '出自機関',
    '出自研究機関との関係悪化',
    '共同研究の打ち切り。ライセンス交渉の停止',
    70
  )
ON CONFLICT (factor_type, event_description) DO UPDATE
SET observation_clues = EXCLUDED.observation_clues,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();

-- 既存 PJ × 初版マスタを明示的な未発生状態で埋める。
INSERT INTO public.project_killer_factor_states (project_id, killer_factor_id)
SELECT projects.project_id, factors.killer_factor_id
FROM public.projects AS projects
CROSS JOIN public.killer_factor_catalog AS factors
WHERE factors.is_active = true
ON CONFLICT (project_id, killer_factor_id) DO NOTHING;

-- ============================================================
-- 4. 新しい要素 / 新しい PJ にも共通雛形を自動補完
-- ============================================================
CREATE OR REPLACE FUNCTION public.killer_factor_catalog_seed_project_states()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_killer_factor_states (project_id, killer_factor_id)
  SELECT projects.project_id, NEW.killer_factor_id
  FROM public.projects AS projects
  ON CONFLICT (project_id, killer_factor_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS killer_factor_catalog_after_insert ON public.killer_factor_catalog;
CREATE TRIGGER killer_factor_catalog_after_insert
  AFTER INSERT ON public.killer_factor_catalog
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.killer_factor_catalog_seed_project_states();

CREATE OR REPLACE FUNCTION public.projects_seed_killer_factor_states()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_killer_factor_states (project_id, killer_factor_id)
  SELECT NEW.project_id, factors.killer_factor_id
  FROM public.killer_factor_catalog AS factors
  WHERE factors.is_active = true
  ON CONFLICT (project_id, killer_factor_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_after_insert_killer_factor_states ON public.projects;
CREATE TRIGGER projects_after_insert_killer_factor_states
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.projects_seed_killer_factor_states();

-- ============================================================
-- 5. AMD member 権限（会社概要タブと同じ境界）
-- ============================================================
ALTER TABLE public.killer_factor_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_killer_factor_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "killer_factor_catalog_members" ON public.killer_factor_catalog;
CREATE POLICY "killer_factor_catalog_members" ON public.killer_factor_catalog
  FOR ALL TO authenticated
  USING (public.amd_os_is_member())
  WITH CHECK (public.amd_os_is_member());

DROP POLICY IF EXISTS "killer_factor_catalog_service" ON public.killer_factor_catalog;
CREATE POLICY "killer_factor_catalog_service" ON public.killer_factor_catalog
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "project_killer_factor_states_members" ON public.project_killer_factor_states;
CREATE POLICY "project_killer_factor_states_members" ON public.project_killer_factor_states
  FOR ALL TO authenticated
  USING (public.amd_os_is_member())
  WITH CHECK (public.amd_os_is_member());

DROP POLICY IF EXISTS "project_killer_factor_states_service" ON public.project_killer_factor_states;
CREATE POLICY "project_killer_factor_states_service" ON public.project_killer_factor_states
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
