-- 293: stale/rejected SPS候補を安全に置換できるようにし、完全版組backfillを完了する。
BEGIN;

ALTER TABLE public.sps_reassessment_candidates
  DROP CONSTRAINT IF EXISTS sps_reassessment_candidates_seed_semantic_unique,
  DROP CONSTRAINT IF EXISTS sps_reassessment_candidates_status_check,
  ADD CONSTRAINT sps_reassessment_candidates_status_check
    CHECK (status IN ('pending', 'applied', 'rejected', 'superseded')),
  DROP CONSTRAINT IF EXISTS sps_reassessment_candidates_review_state_check,
  ADD CONSTRAINT sps_reassessment_candidates_review_state_check CHECK (
    (status = 'pending' AND applied_assessment_id IS NULL AND applied_at IS NULL AND rejected_at IS NULL)
    OR (status = 'applied' AND applied_assessment_id IS NOT NULL AND applied_at IS NOT NULL AND applied_by IS NOT NULL AND rejected_at IS NULL)
    OR (status IN ('rejected', 'superseded') AND applied_assessment_id IS NULL AND rejected_at IS NOT NULL AND rejected_by IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS sps_reassessment_candidates_active_semantic_idx
  ON public.sps_reassessment_candidates (seed_id, semantic_fingerprint)
  WHERE status IN ('pending', 'applied');

-- 292適用時に旧行のSPS算術が不整合だったseedも、凍結行を更新せず
-- q/Pから決定的に再計算した完全版組の行をappendする。
WITH latest_current_measure AS (
  SELECT DISTINCT ON (band.seed_id) band.*
  FROM public.seed_screening_bands AS band
  WHERE band.frozen = true
    AND band.measure_version = 'sps-ind-v1'
    AND band.ruleset_version = 'rubric-v1.1+ind-v1'
  ORDER BY band.seed_id, band.assessed_at DESC, band.created_at DESC, band.id DESC
)
INSERT INTO public.seed_screening_bands (
  seed_id,
  ruleset_version,
  evaluator,
  assessed_at,
  stage_lower,
  stage_upper,
  stage_tag,
  axis_bands,
  q_lower_pct,
  q_upper_pct,
  q_main_factor,
  q_evidence,
  p_class,
  p_lower_yen,
  p_upper_yen,
  sps_lower_yen,
  sps_upper_yen,
  frozen,
  notes,
  measure_version,
  model_version,
  q_model_version,
  q_ruleset_version,
  p_model_version,
  information_cutoff,
  source_candidate_id
)
SELECT
  band.seed_id,
  'rubric-v1.1+ind-v1',
  'sps-current-tuple-backfill',
  band.assessed_at,
  band.stage_lower,
  band.stage_upper,
  band.stage_tag,
  band.axis_bands,
  band.q_lower_pct,
  band.q_upper_pct,
  band.q_main_factor,
  band.q_evidence,
  band.p_class,
  band.p_lower_yen,
  band.p_upper_yen,
  round(band.p_lower_yen::numeric * band.q_lower_pct / 100)::bigint,
  round(band.p_upper_yen::numeric * band.q_upper_pct / 100)::bigint,
  true,
  concat_ws(E'\n', nullif(band.notes, ''), 'append-only current tuple backfill from assessment ' || band.id::text),
  'sps-ind-v1',
  'sps-ind-tier0-v1',
  'q-eval-v2',
  'rubric-v1.1',
  'p-ind-v1',
  band.assessed_at,
  NULL
FROM latest_current_measure AS band
WHERE band.q_lower_pct IS NOT NULL
  AND band.q_upper_pct IS NOT NULL
  AND band.q_lower_pct BETWEEN 0 AND 100
  AND band.q_upper_pct BETWEEN 0 AND 100
  AND band.q_lower_pct <= band.q_upper_pct
  AND band.p_lower_yen IS NOT NULL
  AND band.p_upper_yen IS NOT NULL
  AND band.p_lower_yen >= 0
  AND band.p_lower_yen <= band.p_upper_yen
  AND NOT EXISTS (
    SELECT 1
    FROM public.seed_screening_bands AS exact
    WHERE exact.seed_id = band.seed_id
      AND exact.frozen = true
      AND exact.model_version = 'sps-ind-tier0-v1'
      AND exact.measure_version = 'sps-ind-v1'
      AND exact.q_model_version = 'q-eval-v2'
      AND exact.q_ruleset_version = 'rubric-v1.1'
      AND exact.p_model_version = 'p-ind-v1'
      AND exact.ruleset_version = 'rubric-v1.1+ind-v1'
  );

CREATE OR REPLACE FUNCTION public.supersede_stale_sps_reassessment_candidates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidate_ids uuid[];
BEGIN
  WITH stale AS (
    UPDATE public.sps_reassessment_candidates AS candidate
    SET status = 'superseded',
        rejected_at = now(),
        rejected_by = 'source-update',
        rejection_reason = '候補作成後に同じsource rowの新しい事象が追加された'
    WHERE candidate.status = 'pending'
      AND EXISTS (
        SELECT 1
        FROM public.sps_reassessment_source_events AS prior
        WHERE prior.id = ANY(candidate.source_event_ids)
          AND prior.source_table = NEW.source_table
          AND prior.source_row_identity = NEW.source_row_identity
          AND prior.id <> NEW.id
      )
    RETURNING candidate.id
  )
  SELECT array_agg(stale.id) INTO v_candidate_ids FROM stale;

  IF coalesce(cardinality(v_candidate_ids), 0) > 0 THEN
    UPDATE public.l2_notifications
    SET attention_state = 'suppressed',
        attention_type = 'suppressed',
        attention_owner = 'none',
        requires_masa_decision = false,
        attention_reason = '同じsource rowに新しい事象が追加されたため候補を失効',
        attention_reviewed_at = now(),
        attention_reviewed_by = 'sps-source-event-trigger'
    WHERE l2_kind = 'sps_reassessment'
      AND scope_key = ANY(v_candidate_ids::text[]);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sps_reassessment_candidate_supersede_on_new_event
  ON public.sps_reassessment_source_events;
CREATE TRIGGER sps_reassessment_candidate_supersede_on_new_event
  AFTER INSERT ON public.sps_reassessment_source_events
  FOR EACH ROW EXECUTE FUNCTION public.supersede_stale_sps_reassessment_candidates();

COMMENT ON FUNCTION public.supersede_stale_sps_reassessment_candidates() IS
  '同じsource rowの新事象で未採用SPS候補と判断通知を失効させ、fresh候補による置換を許可する。';

COMMIT;
