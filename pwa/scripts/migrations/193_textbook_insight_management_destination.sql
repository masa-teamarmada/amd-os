-- 193_textbook_insight_management_destination.sql
--
-- D-7 candidate can target either BZM or Management Knowledge.
-- A management-knowledge candidate has no BZM chapter by definition, so the
-- legacy BZM-only target column must be nullable. destination_kind in
-- metadata_json remains the authoritative route selector.

ALTER TABLE public.textbook_insight_candidates
  ALTER COLUMN target_bzm_slug DROP NOT NULL;

COMMENT ON COLUMN public.textbook_insight_candidates.target_bzm_slug IS
  'BZM destination slug. NULL when metadata_json.destination_kind is management_knowledge; the candidate must not be sent to the local BZM applier.';
