-- 250_killer_factor_graduated_assessment.sql
--
-- キラー要素をゼロ/イチの発生判定ではなく、方式ごとの段階評価へ拡張する。
-- 常時監視は悪化度、予防統制は統制成熟度を記録し、予防統制の逸脱は別の重大状態にする。

ALTER TABLE public.project_killer_factor_states
  DROP CONSTRAINT IF EXISTS project_killer_factor_states_status_check;

ALTER TABLE public.project_killer_factor_states
  ADD CONSTRAINT project_killer_factor_states_status_check
    CHECK (
      status IN (
        'unchecked',
        'clear',
        'watch',
        'warning',
        'occurred',
        'not_started',
        'in_progress',
        'implemented',
        'controlled',
        'breached'
      )
    );

-- migration 249 の方式別guardへ新しい中間段階を追加する。
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
     AND NEW.status NOT IN ('unchecked', 'clear', 'watch', 'warning', 'occurred') THEN
    RAISE EXCEPTION 'status % is invalid for monitoring factor', NEW.status;
  END IF;

  IF factor_mode = 'prevention'
     AND NEW.status NOT IN ('unchecked', 'not_started', 'in_progress', 'implemented', 'controlled', 'breached') THEN
    RAISE EXCEPTION 'status % is invalid for prevention factor', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.project_killer_factor_states.status IS
  'unchecked=未確認。monitoringはclear/watch/warning/occurredの悪化度、preventionはnot_started/in_progress/implemented/controlledの成熟度とbreached=統制逸脱';
