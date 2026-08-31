-- 20260901090000_project_theme_hub_meeting_prep.sql
--
-- Phase 2 small follow-up (per phase2.md §"Meetings must preserve rich narrative/
-- source_hash..."): theme_hub_create_meeting_and_link (20260831120000, 7 args) only inserted
-- meeting_id/project_id/ym/meeting_date/title/summary_short. acceptance.md's MTG create
-- flow requires 準備 (preparation) as an editable field alongside 概要 (outcome); the
-- canonical column for that is project_meeting_summaries.prep_draft_md (migration 150),
-- not summary_short. Editing an EXISTING meeting's title/date/prep/outcome does not need
-- this RPC at all — that is a plain single-table UPDATE against an allowlisted column set
-- (title, meeting_date, prep_draft_md, summary_short), which never touches narrative_md/
-- source_hash/decided/progress/next_actions/risks and is therefore already safe without
-- schema changes.
--
-- This adds an 8-arg OVERLOAD (p_prep_draft_md as a genuinely REQUIRED trailing parameter, no
-- DEFAULT) rather than extending the existing 7-arg signature. Root's rollback test caught the
-- first draft of this migration: giving the 8th parameter `DEFAULT NULL` made a plain 7-argument
-- call ambiguous between "the original 7-arg function" and "the new 8-arg function using its
-- default" (Postgres 42725 - function is not unique). The already-applied 7-arg
-- 20260831120000 function is left completely untouched here; this migration only ADDS the
-- distinct 8-arg overload. Every worker call site (project-theme-hub.ts createMeetingAndLink)
-- always passes all 8 arguments explicitly, so it only ever resolves to this overload — no
-- ambiguity for any real caller either way.
--
-- Also hardens the client_token idempotency check: the original body did a plain
-- SELECT-then-INSERT, which is safe against a *sequential* retry but not against two truly
-- concurrent calls carrying the same client_token (both could pass the SELECT under READ
-- COMMITTED before either commits). Catching unique_violation on the project_theme_meetings
-- INSERT and re-reading the now-existing link closes that narrow race.
--
-- Fixes ym format: the original body used to_char(p_meeting_date, 'YYYY-MM') ("2026-08"), which
-- does not match the real ingestion convention (gas/074_MeetingSummaryRepo.js ymKey =
-- meetingDate.slice(0,4)+meetingDate.slice(5,7), i.e. "202608", no separator) that
-- idx_pms_project_ym and monthly-report grouping actually rely on.
--
-- NOT applied by this worker. Root reviews and applies.

BEGIN;

CREATE OR REPLACE FUNCTION public.theme_hub_create_meeting_and_link(
  p_project_id text,
  p_track_key text,
  p_title text,
  p_meeting_date date,
  p_summary_short text,
  p_client_token uuid,
  p_created_by_member_id text,
  p_prep_draft_md text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_existing_meeting_id text;
  v_meeting_id text;
BEGIN
  IF p_client_token IS NULL THEN
    RAISE EXCEPTION 'p_client_token is required' USING ERRCODE = '22004';
  END IF;

  SELECT meeting_id INTO v_existing_meeting_id
  FROM public.project_theme_meetings
  WHERE project_id = p_project_id AND track_key = p_track_key AND client_token = p_client_token;
  IF v_existing_meeting_id IS NOT NULL THEN
    RETURN v_existing_meeting_id;
  END IF;

  v_meeting_id := gen_random_uuid()::text;

  -- Both INSERTs must live in the SAME inner BEGIN/EXCEPTION block. A caught exception only rolls
  -- back statements executed since that block's own implicit savepoint — it does NOT undo
  -- anything the OUTER block already ran. An earlier draft put the project_meeting_summaries
  -- INSERT ahead of (outside) this block, so a unique_violation caught here would roll back only
  -- the project_theme_meetings INSERT, leaving the meeting_summaries row committed as an orphan
  -- with no link. (A prior version of this comment claimed the whole function's single-
  -- transaction-ness covered that — it does not; a caught exception is exactly the case where it
  -- does not, that being the entire point of catching it here instead of letting it propagate.)
  BEGIN
    INSERT INTO public.project_meeting_summaries (
      meeting_id, project_id, ym, meeting_date, title, summary_short, prep_draft_md, generated_by_model
    ) VALUES (
      v_meeting_id, p_project_id, to_char(p_meeting_date, 'YYYYMM'), p_meeting_date, p_title,
      COALESCE(p_summary_short, ''), p_prep_draft_md, 'theme_hub_manual'
    );

    INSERT INTO public.project_theme_meetings (
      project_id, track_key, meeting_id, client_token, created_by_member_id
    ) VALUES (
      p_project_id, p_track_key, v_meeting_id, p_client_token, p_created_by_member_id
    );
  EXCEPTION WHEN unique_violation THEN
    -- A genuinely concurrent call with the same client_token won the race between our own SELECT
    -- check above and this block's INSERTs. Both INSERTs above are rolled back by this subtrans-
    -- action (the meeting_summaries row never becomes visible outside this function — no orphan).
    -- Read back the winner's meeting_id AFTER that rollback, instead of surfacing a raw
    -- constraint-violation error to the caller.
    SELECT meeting_id INTO v_existing_meeting_id
    FROM public.project_theme_meetings
    WHERE project_id = p_project_id AND track_key = p_track_key AND client_token = p_client_token;
    IF v_existing_meeting_id IS NULL THEN
      RAISE;
    END IF;
    RETURN v_existing_meeting_id;
  END;

  RETURN v_meeting_id;
END;
$$;

REVOKE ALL ON FUNCTION public.theme_hub_create_meeting_and_link(text, text, text, date, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.theme_hub_create_meeting_and_link(text, text, text, date, text, uuid, text, text) TO service_role;

-- Self-check: both overloads must coexist with distinct arg counts (7 and 8), so a bare 7-arg
-- call can never become ambiguous. If this ever returns something other than 2, a future edit
-- broke the "add an overload, don't extend the old signature" contract this migration relies on.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'theme_hub_create_meeting_and_link' AND pronamespace = 'public'::regnamespace;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'expected exactly 2 theme_hub_create_meeting_and_link overloads (7-arg + 8-arg), found %', v_count;
  END IF;
END $$;

-- Regression guard for the orphan-row bug this migration fixes: both INSERTs must sit inside the
-- SAME inner BEGIN/EXCEPTION block (source order: meeting_summaries INSERT, then theme_meetings
-- INSERT, then EXCEPTION WHEN unique_violation, with no intervening END; that would close the
-- block early and let the meeting_summaries INSERT survive a caught exception as an orphan).
-- Runs against the function's actual live source (pg_get_functiondef), not a copy of this file.
DO $$
DECLARE
  v_src text;
  v_pms_pos int;
  v_ptm_pos int;
  v_exc_pos int;
BEGIN
  v_src := pg_get_functiondef('public.theme_hub_create_meeting_and_link(text,text,text,date,text,uuid,text,text)'::regprocedure);
  v_pms_pos := position('INSERT INTO public.project_meeting_summaries' in v_src);
  v_ptm_pos := position('INSERT INTO public.project_theme_meetings' in v_src);
  v_exc_pos := position('EXCEPTION WHEN unique_violation' in v_src);
  IF v_pms_pos = 0 OR v_ptm_pos = 0 OR v_exc_pos = 0 THEN
    RAISE EXCEPTION 'theme_hub_create_meeting_and_link (8-arg): missing an expected statement';
  END IF;
  IF NOT (v_pms_pos < v_ptm_pos AND v_ptm_pos < v_exc_pos) THEN
    RAISE EXCEPTION 'theme_hub_create_meeting_and_link (8-arg): both INSERTs must precede EXCEPTION WHEN unique_violation in source order';
  END IF;
  IF position('END;' in substring(v_src from v_pms_pos for (v_exc_pos - v_pms_pos))) > 0 THEN
    RAISE EXCEPTION 'theme_hub_create_meeting_and_link (8-arg): an END; between the two INSERTs and EXCEPTION means they are not in the same subtransaction block (orphan-row bug would be reintroduced)';
  END IF;
END $$;

COMMIT;
