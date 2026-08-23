-- 319: project_meeting_summaries writes must not fail when the SPS reassessment
-- source-event trigger hashes row payloads with pgcrypto.digest().
BEGIN;

ALTER FUNCTION public.capture_sps_reassessment_source_event()
  SET search_path = public, extensions, pg_temp;

COMMIT;
