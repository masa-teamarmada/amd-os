-- 303: migration 301適用済み環境で、pgcrypto関数をextensions schemaから確実に解決する。
BEGIN;

ALTER FUNCTION public.sps_initial_assessment_source_snapshot(uuid, timestamptz)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.validate_sps_initial_assessment_candidate_insert()
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.apply_sps_initial_assessment_candidate(uuid, text)
  SET search_path = public, extensions, pg_temp;

COMMIT;
