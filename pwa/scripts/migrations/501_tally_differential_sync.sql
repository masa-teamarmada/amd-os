-- Prepared only: apply via the repository DDL workflow before tally-sync deploy.
-- A submitted project owns only [p_window_start, p_window_end] for ID001.
-- Empty weeklyEffort clears that window; omitted projects authorize no deletion.
CREATE OR REPLACE FUNCTION public.amie_sync_tally_effort(
  p_member_id text,
  p_window_start date,
  p_window_end date,
  p_projects jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_project jsonb;
  v_week jsonb;
  v_project_id text;
  v_week_start date;
  v_week_count integer := 0;
  v_now timestamptz;
BEGIN
  -- Defence in depth: callers other than the Edge Function must not accidentally
  -- turn a missing scope or malformed array into an authoritative empty window.
  IF p_member_id IS DISTINCT FROM 'ID001'
     OR p_window_start IS NULL OR p_window_end IS NULL
     OR p_window_start > p_window_end
     OR p_window_start < DATE '0001-01-01' OR p_window_end > DATE '9999-12-31'
     OR p_projects IS NULL OR jsonb_typeof(p_projects) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid Tally owner or scope' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_projects) > 100
     OR NOT EXISTS (SELECT 1 FROM public.members WHERE member_id = p_member_id) THEN
    RAISE EXCEPTION 'Invalid Tally member or project count' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_projects) AS p
    GROUP BY p ->> 'projectID' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Tally project' USING ERRCODE = '22023';
  END IF;

  FOR v_project IN SELECT value FROM jsonb_array_elements(p_projects) LOOP
    v_project_id := v_project ->> 'projectID';
    IF jsonb_typeof(v_project) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_project -> 'projectID') IS DISTINCT FROM 'string'
       OR char_length(btrim(v_project_id)) NOT BETWEEN 1 AND 80
       OR v_project_id IS DISTINCT FROM btrim(v_project_id)
       OR jsonb_typeof(v_project -> 'displayName') IS DISTINCT FROM 'string'
       OR char_length(btrim(v_project ->> 'displayName')) NOT BETWEEN 1 AND 160
       OR jsonb_typeof(v_project -> 'meetingSearchTerms') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_project -> 'weeklyEffort') IS DISTINCT FROM 'array'
       OR NOT EXISTS (SELECT 1 FROM public.projects WHERE project_id = v_project_id) THEN
      RAISE EXCEPTION 'Invalid Tally project' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(v_project -> 'meetingSearchTerms') > 20
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(v_project -> 'meetingSearchTerms') AS term
         WHERE jsonb_typeof(term) IS DISTINCT FROM 'string'
            OR char_length(btrim(term #>> '{}')) NOT BETWEEN 1 AND 100
       ) THEN
      RAISE EXCEPTION 'Invalid Tally meeting search terms' USING ERRCODE = '22023';
    END IF;
    v_week_count := v_week_count + jsonb_array_length(v_project -> 'weeklyEffort');
    IF v_week_count > 5000 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_project -> 'weeklyEffort') AS w
      GROUP BY w ->> 'weekStart' HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'Invalid Tally week count or duplicate week' USING ERRCODE = '22023';
    END IF;
    FOR v_week IN SELECT value FROM jsonb_array_elements(v_project -> 'weeklyEffort') LOOP
      IF jsonb_typeof(v_week) IS DISTINCT FROM 'object'
         OR jsonb_typeof(v_week -> 'weekStart') IS DISTINCT FROM 'string'
         OR (v_week ->> 'weekStart') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         OR jsonb_typeof(v_week -> 'developmentHours') IS DISTINCT FROM 'number'
         OR jsonb_typeof(v_week -> 'meetingHours') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'Invalid Tally week' USING ERRCODE = '22023';
      END IF;
      v_week_start := (v_week ->> 'weekStart')::date;
      IF v_week_start NOT BETWEEN p_window_start AND p_window_end
         OR (v_week ->> 'developmentHours')::numeric NOT BETWEEN 0 AND 168
         OR (v_week ->> 'meetingHours')::numeric NOT BETWEEN 0 AND 168 THEN
        RAISE EXCEPTION 'Tally week outside scope or hours outside bounds' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;

  -- Serialize complete snapshots, including empty windows and newly seen PJ.
  -- The current client has no source revision: last serialized request wins.
  -- Do not infer client snapshot order from server timestamps.
  PERFORM pg_advisory_xact_lock(hashtextextended('amie:tally:' || p_member_id, 0));
  v_now := clock_timestamp();

  FOR v_project IN SELECT value FROM jsonb_array_elements(p_projects) LOOP
    v_project_id := v_project ->> 'projectID';
    -- Connection freshness stays in the settings row. This one metadata write
    -- per submitted PJ remains for compatibility; existing audit stays active.
    INSERT INTO public.tally_project_syncs AS existing (
      project_id, member_id, display_name, meeting_search_terms, last_synced_at
    ) VALUES (
      v_project_id, p_member_id, btrim(v_project ->> 'displayName'),
      v_project -> 'meetingSearchTerms', v_now
    ) ON CONFLICT (project_id, member_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      meeting_search_terms = EXCLUDED.meeting_search_terms,
      last_synced_at = EXCLUDED.last_synced_at;

    INSERT INTO public.tally_weekly_effort_entries AS existing (
      project_id, member_id, week_start, development_hours, meeting_hours, synced_at
    )
    SELECT v_project_id, p_member_id, (w ->> 'weekStart')::date,
      round((w ->> 'developmentHours')::numeric, 2),
      round((w ->> 'meetingHours')::numeric, 2), v_now
    FROM jsonb_array_elements(v_project -> 'weeklyEffort') AS w
    -- Filter identical rows before ON CONFLICT as well, to avoid conflict tuple
    -- locks/WAL on an unchanged resync. The conflict guard protects other writers.
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tally_weekly_effort_entries AS old
      WHERE old.project_id = v_project_id AND old.member_id = p_member_id
        AND old.week_start = (w ->> 'weekStart')::date
        AND old.development_hours = round((w ->> 'developmentHours')::numeric, 2)
        AND old.meeting_hours = round((w ->> 'meetingHours')::numeric, 2)
    )
    ON CONFLICT (project_id, member_id, week_start) DO UPDATE SET
      development_hours = EXCLUDED.development_hours,
      meeting_hours = EXCLUDED.meeting_hours,
      synced_at = EXCLUDED.synced_at
    WHERE (existing.development_hours, existing.meeting_hours)
      IS DISTINCT FROM (EXCLUDED.development_hours, EXCLUDED.meeting_hours);

    DELETE FROM public.tally_weekly_effort_entries AS old
    WHERE old.project_id = v_project_id AND old.member_id = p_member_id
      AND old.week_start BETWEEN p_window_start AND p_window_end
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_project -> 'weeklyEffort') AS w
        WHERE (w ->> 'weekStart')::date = old.week_start
      );
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'projectCount', jsonb_array_length(p_projects), 'weekCount', v_week_count);
END;
$function$;

-- Match the existing key-authorized Edge service path. No public/user RPC access
-- or table grants are added; SECURITY INVOKER retains the caller's RLS boundary.
REVOKE ALL ON FUNCTION public.amie_sync_tally_effort(text, date, date, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amie_sync_tally_effort(text, date, date, jsonb) TO service_role;
COMMENT ON FUNCTION public.amie_sync_tally_effort(text, date, date, jsonb) IS
  'Atomic Tally ID001 window sync: insert new weeks, update changed hours, delete only explicitly submitted missing weeks; existing audits remain enabled.';
