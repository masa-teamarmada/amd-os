-- Explicit gantt placement is independent of canonical goal/action relationships.
BEGIN;
ALTER TABLE public.project_actions
  ADD COLUMN IF NOT EXISTS gantt_phase_id text,
  ADD COLUMN IF NOT EXISTS gantt_phase_override boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.project_actions.gantt_phase_id IS 'Explicit roadmap phase in the same project. Null with override=true means detached.';
COMMENT ON COLUMN public.project_actions.gantt_phase_override IS 'False: infer from goal tree. True: use explicit phase, including explicit detachment.';
CREATE OR REPLACE FUNCTION public.validate_project_action_gantt_phase()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.gantt_phase_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.project_gantt_roadmaps r,
        jsonb_array_elements(r.definition->'phases') phase
      WHERE r.project_id = NEW.project_id AND phase->>'id' = NEW.gantt_phase_id
    ) THEN
      RAISE EXCEPTION 'このプロジェクトに工程が見つからないよ' USING ERRCODE = '23514';
    END IF;
    NEW.gantt_phase_override := true;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_action_gantt_phase_check
BEFORE INSERT OR UPDATE OF gantt_phase_id, gantt_phase_override, project_id
ON public.project_actions FOR EACH ROW EXECUTE FUNCTION public.validate_project_action_gantt_phase();
COMMIT;
