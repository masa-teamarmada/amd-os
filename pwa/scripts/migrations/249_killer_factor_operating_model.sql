-- 249_killer_factor_operating_model.sql
--
-- キラー要素を「起きたら記録」だけの単一台帳から、
-- AMD が先回りして塞ぐ予防統制と、兆候を継続確認する常時監視へ分ける。
-- PJ 状態は未確認を安全扱いせず、全体判定を導出できる状態集合へ移行する。

-- ============================================================
-- 1. 共通マスタ: 常時監視 / 予防統制
-- ============================================================
ALTER TABLE public.killer_factor_catalog
  ADD COLUMN IF NOT EXISTS operating_mode text NOT NULL DEFAULT 'monitoring',
  ADD COLUMN IF NOT EXISTS preventive_action text,
  ADD COLUMN IF NOT EXISTS timing_guidance text;

ALTER TABLE public.killer_factor_catalog
  DROP CONSTRAINT IF EXISTS killer_factor_catalog_operating_mode_check,
  DROP CONSTRAINT IF EXISTS killer_factor_catalog_prevention_fields_check;

ALTER TABLE public.killer_factor_catalog
  ADD CONSTRAINT killer_factor_catalog_operating_mode_check
    CHECK (operating_mode IN ('monitoring', 'prevention')),
  ADD CONSTRAINT killer_factor_catalog_prevention_fields_check
    CHECK (
      (
        operating_mode = 'monitoring'
        AND preventive_action IS NULL
        AND timing_guidance IS NULL
      )
      OR
      (
        operating_mode = 'prevention'
        AND preventive_action IS NOT NULL
        AND btrim(preventive_action) <> ''
        AND timing_guidance IS NOT NULL
        AND btrim(timing_guidance) <> ''
      )
    );

-- 「経営を交代・是正できる構造」は発生待ちにせず、設立前に塞ぐ予防統制へ変更する。
UPDATE public.killer_factor_catalog
SET operating_mode = 'prevention',
    preventive_action = 'SHA・定款へ経営交代・是正条項を実装し、機能する取締役会運用を開始する',
    timing_guidance = '会社設立・外部資金受入の前',
    observation_clues = '締結済みSHA・定款・取締役会議事録で、交代・是正権限と実際の運用を確認する',
    updated_at = now()
WHERE factor_type = 'ガバナンス'
  AND event_description = '経営を交代・是正できる構造が無い';

-- ============================================================
-- 2. PJ別状態: 未確認 / 平常 / 兆候 / 発生 と予防統制の進捗
-- ============================================================
ALTER TABLE public.project_killer_factor_states
  ADD COLUMN IF NOT EXISTS status_on date,
  ADD COLUMN IF NOT EXISTS target_on date;

ALTER TABLE public.project_killer_factor_states
  DROP CONSTRAINT IF EXISTS project_killer_factor_states_status_check,
  DROP CONSTRAINT IF EXISTS project_killer_factor_states_occurrence_check,
  DROP CONSTRAINT IF EXISTS project_killer_factor_states_evidence_check;

UPDATE public.project_killer_factor_states
SET status_on = occurred_on
WHERE status = 'occurred'
  AND status_on IS NULL;

UPDATE public.project_killer_factor_states
SET status = 'unchecked',
    updated_at = now()
WHERE status = 'not_occurred';

ALTER TABLE public.project_killer_factor_states
  ALTER COLUMN status SET DEFAULT 'unchecked';

-- 旧buildの mark_occurred もdeploy切替中に壊さない。
-- 予防統制へ旧status=occurredが来た場合は breached へ正規化する。
CREATE OR REPLACE FUNCTION public.project_killer_factor_state_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  factor_mode text;
BEGIN
  SELECT operating_mode
  INTO factor_mode
  FROM public.killer_factor_catalog
  WHERE killer_factor_id = NEW.killer_factor_id;

  IF factor_mode IS NULL THEN
    RAISE EXCEPTION 'killer factor not found: %', NEW.killer_factor_id;
  END IF;

  IF factor_mode = 'prevention' AND NEW.status = 'occurred' THEN
    NEW.status := 'breached';
  END IF;

  IF NEW.status IN ('occurred', 'breached') THEN
    NEW.status_on := COALESCE(NEW.status_on, NEW.occurred_on);
    NEW.occurred_on := COALESCE(NEW.occurred_on, NEW.status_on);
  ELSE
    NEW.occurred_on := NULL;
  END IF;

  IF factor_mode = 'monitoring'
     AND NEW.status NOT IN ('unchecked', 'clear', 'warning', 'occurred') THEN
    RAISE EXCEPTION 'status % is invalid for monitoring factor', NEW.status;
  END IF;

  IF factor_mode = 'prevention'
     AND NEW.status NOT IN ('unchecked', 'not_started', 'in_progress', 'controlled', 'breached') THEN
    RAISE EXCEPTION 'status % is invalid for prevention factor', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_killer_factor_state_guard_trigger
  ON public.project_killer_factor_states;
CREATE TRIGGER project_killer_factor_state_guard_trigger
  BEFORE INSERT OR UPDATE ON public.project_killer_factor_states
  FOR EACH ROW
  EXECUTE FUNCTION public.project_killer_factor_state_guard();

ALTER TABLE public.project_killer_factor_states
  ADD CONSTRAINT project_killer_factor_states_status_check
    CHECK (
      status IN (
        'unchecked',
        'clear',
        'warning',
        'occurred',
        'not_started',
        'in_progress',
        'controlled',
        'breached'
      )
    ),
  ADD CONSTRAINT project_killer_factor_states_evidence_check
    CHECK (
      (
        status = 'unchecked'
        AND status_on IS NULL
        AND target_on IS NULL
        AND occurred_on IS NULL
        AND evidence_note IS NULL
        AND recorded_by_member_id IS NULL
        AND recorded_at IS NULL
      )
      OR
      (
        status <> 'unchecked'
        AND status_on IS NOT NULL
        AND evidence_note IS NOT NULL
        AND btrim(evidence_note) <> ''
        AND recorded_by_member_id IS NOT NULL
        AND recorded_at IS NOT NULL
        AND (
          (status IN ('occurred', 'breached') AND occurred_on = status_on)
          OR
          (status NOT IN ('occurred', 'breached') AND occurred_on IS NULL)
        )
      )
    );

COMMENT ON COLUMN public.killer_factor_catalog.operating_mode IS
  'monitoring=常時監視、prevention=AMDが発生前に塞ぐ予防統制';
COMMENT ON COLUMN public.killer_factor_catalog.preventive_action IS
  '予防統制としてAMDが先に完了させる具体的な打ち手';
COMMENT ON COLUMN public.killer_factor_catalog.timing_guidance IS
  '予防統制を完了すべき工程・時機の共通目安';
COMMENT ON COLUMN public.project_killer_factor_states.status_on IS
  '状態を記録・確認した日。発生だけでなく平常・兆候・統制進捗にも使う';
COMMENT ON COLUMN public.project_killer_factor_states.target_on IS
  '予防統制のPJ別目標日。日付が確定している場合だけ保存する';
