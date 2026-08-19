-- 295: candidate作成も同じseed lockへ直列化し、source更新とのstale候補競合を防ぐ。
BEGIN;

CREATE OR REPLACE FUNCTION public.lock_sps_reassessment_candidate_seed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.seed_id::text, 292));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sps_reassessment_candidate_00_seed_lock
  ON public.sps_reassessment_candidates;
CREATE TRIGGER sps_reassessment_candidate_00_seed_lock
  BEFORE INSERT ON public.sps_reassessment_candidates
  FOR EACH ROW EXECUTE FUNCTION public.lock_sps_reassessment_candidate_seed();

COMMENT ON FUNCTION public.lock_sps_reassessment_candidate_seed() IS
  'candidate INSERTの検証前にseed単位lockを取り、source event作成と直列化する。';

COMMIT;
