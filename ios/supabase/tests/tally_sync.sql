\set ON_ERROR_STOP on
BEGIN;
\ir tally_sync_fixture.sql
CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.sync(weeks jsonb, project_id text DEFAULT 'test-a') RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.amie_sync_tally_effort('ID001', '2026-10-05', '2026-10-26', jsonb_build_array(
    jsonb_build_object('projectID', project_id, 'displayName', 'Test', 'meetingSearchTerms', '[]'::jsonb, 'weeklyEffort', weeks)
  ));
$$;
CREATE TEMP TABLE untouched AS SELECT to_jsonb(t) AS row, ctid AS physical_row
FROM public.tally_weekly_effort_entries AS t
WHERE project_id = 'test-b' OR member_id = 'ID002' OR week_start NOT BETWEEN '2026-10-05' AND '2026-10-26';
CREATE TEMP TABLE original AS SELECT to_jsonb(t) AS row, ctid AS physical_row FROM public.tally_weekly_effort_entries AS t;

SELECT pg_temp.assert_true(NOT has_function_privilege('anon', 'public.amie_sync_tally_effort(text,date,date,jsonb)', 'execute'), 'anon cannot invoke sync');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated', 'public.amie_sync_tally_effort(text,date,date,jsonb)', 'execute'), 'authenticated cannot invoke sync');
SELECT pg_temp.assert_true(has_function_privilege('service_role', 'public.amie_sync_tally_effort(text,date,date,jsonb)', 'execute'), 'service can invoke sync');
SELECT pg_temp.assert_true(NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.amie_sync_tally_effort(text,date,date,jsonb)'::regprocedure), 'sync remains invoker');

-- Seed is identical to the incoming snapshot. No business-row mutation at all.
SET LOCAL ROLE service_role;
SELECT public.amie_sync_tally_effort('ID001', '2026-10-05', '2026-10-26', '[{"projectID":"test-a","displayName":"Test","meetingSearchTerms":[],"weeklyEffort":[{"weekStart":"2026-10-05","developmentHours":10,"meetingHours":2},{"weekStart":"2026-10-12","developmentHours":20,"meetingHours":3},{"weekStart":"2026-10-19","developmentHours":30,"meetingHours":4},{"weekStart":"2026-10-26","developmentHours":40,"meetingHours":5}]}]');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.tally_test_mutations WHERE table_name = 'tally_weekly_effort_entries'), 'unchanged snapshot makes zero weekly mutations');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT row, physical_row FROM original EXCEPT SELECT to_jsonb(t), ctid FROM public.tally_weekly_effort_entries AS t), 'unchanged timestamps and physical rows are retained');
CREATE TEMP TABLE previous_freshness AS SELECT last_synced_at FROM public.tally_project_syncs;
TRUNCATE public.tally_test_mutations;
SELECT pg_temp.sync('[{"weekStart":"2026-10-26","developmentHours":40,"meetingHours":5},{"weekStart":"2026-10-19","developmentHours":30,"meetingHours":4},{"weekStart":"2026-10-12","developmentHours":20,"meetingHours":3},{"weekStart":"2026-10-05","developmentHours":10,"meetingHours":2}]');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.tally_test_mutations WHERE table_name = 'tally_weekly_effort_entries'), 'reordered identical resync makes zero weekly mutations');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.tally_test_mutations WHERE table_name = 'tally_project_syncs' AND operation = 'UPDATE'), 'one settings freshness update remains compatible');
SELECT pg_temp.assert_true((SELECT s.last_synced_at > p.last_synced_at FROM public.tally_project_syncs s CROSS JOIN previous_freshness p), 'successful resync advances connection freshness');

TRUNCATE public.tally_test_mutations;
SELECT pg_temp.sync('[{"weekStart":"2026-10-05","developmentHours":10,"meetingHours":2},{"weekStart":"2026-10-12","developmentHours":21,"meetingHours":3},{"weekStart":"2026-10-20","developmentHours":6,"meetingHours":1},{"weekStart":"2026-10-26","developmentHours":40,"meetingHours":5}]');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.tally_test_mutations WHERE table_name = 'tally_weekly_effort_entries' AND operation = 'UPDATE'), 'one changed week updates once');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.tally_test_mutations WHERE table_name = 'tally_weekly_effort_entries' AND operation = 'INSERT'), 'one new week inserts once');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.tally_test_mutations WHERE table_name = 'tally_weekly_effort_entries' AND operation = 'DELETE'), 'one missing week deletes once');
SELECT pg_temp.assert_true((SELECT development_hours = 21 AND meeting_hours = 3 AND synced_at > '2026-10-01T00:00:00Z' FROM public.tally_weekly_effort_entries WHERE project_id = 'test-a' AND member_id = 'ID001' AND week_start = '2026-10-12'), 'changed business values and timestamp persist');
SELECT pg_temp.assert_true((SELECT synced_at = '2026-10-01T00:00:00Z' FROM public.tally_weekly_effort_entries WHERE project_id = 'test-a' AND member_id = 'ID001' AND week_start = '2026-10-05'), 'unchanged week timestamp stays stable');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT row, physical_row FROM untouched EXCEPT SELECT to_jsonb(t), ctid FROM public.tally_weekly_effort_entries AS t), 'unrelated owner, project, and windows remain physically untouched');

-- Empty list explicitly clears both inclusive boundary weeks. No omitted PJ is
-- authorized by that empty list, and no zero-hour replacement row is inserted.
TRUNCATE public.tally_test_mutations;
SELECT pg_temp.sync('[]');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.tally_weekly_effort_entries WHERE project_id = 'test-a' AND member_id = 'ID001' AND week_start BETWEEN '2026-10-05' AND '2026-10-26'), 'explicit empty list clears authoritative window');
SELECT pg_temp.assert_true((SELECT count(*) = 4 FROM public.tally_test_mutations WHERE table_name = 'tally_weekly_effort_entries' AND operation = 'DELETE'), 'empty scope deletes only the four owned weeks');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT row, physical_row FROM untouched EXCEPT SELECT to_jsonb(t), ctid FROM public.tally_weekly_effort_entries AS t), 'empty sync preserves unrelated scope');
TRUNCATE public.tally_test_mutations;
SELECT public.amie_sync_tally_effort('ID001', '2026-10-05', '2026-10-26', '[]');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.tally_test_mutations), 'empty project list has no settings or week writes');

-- Malformed direct RPC calls must never acquire deletion authority.
DO $$
DECLARE bad jsonb;
BEGIN
  FOREACH bad IN ARRAY ARRAY[
    'null'::jsonb, '{}'::jsonb,
    '[{"projectID":"test-a","displayName":"Test","meetingSearchTerms":[]}]'::jsonb,
    '[{"projectID":"test-a","displayName":"Test","meetingSearchTerms":[],"weeklyEffort":null}]'::jsonb,
    '[{"projectID":"missing","displayName":"Test","meetingSearchTerms":[],"weeklyEffort":[]}]'::jsonb,
    '[{"projectID":"test-a","displayName":"Test","meetingSearchTerms":[null],"weeklyEffort":[]}]'::jsonb,
    '[{"projectID":"test-a","displayName":"Test","meetingSearchTerms":[],"weeklyEffort":[{"weekStart":"2026-10-05","developmentHours":169,"meetingHours":0}]}]'::jsonb,
    '[{"projectID":"test-a","displayName":"Test","meetingSearchTerms":[],"weeklyEffort":[{"weekStart":"2026-10-04","developmentHours":1,"meetingHours":0}]}]'::jsonb,
    '[{"projectID":"test-a","displayName":"Test","meetingSearchTerms":[],"weeklyEffort":[{"weekStart":"2026-10-05","developmentHours":1,"meetingHours":0},{"weekStart":"2026-10-05","developmentHours":2,"meetingHours":0}]}]'::jsonb,
    '[{"projectID":"test-a","displayName":"Test","meetingSearchTerms":[],"weeklyEffort":[]},{"projectID":"test-a","displayName":"Test","meetingSearchTerms":[],"weeklyEffort":[]}]'::jsonb
  ] LOOP
    BEGIN
      PERFORM public.amie_sync_tally_effort('ID001', '2026-10-05', '2026-10-26', bad);
      RAISE EXCEPTION 'Malformed payload accepted: %', bad;
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.amie_sync_tally_effort('ID002', '2026-10-05', '2026-10-26', '[]');
    RAISE EXCEPTION 'Wrong owner accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.amie_sync_tally_effort('ID001', NULL, '2026-10-26', '[]');
    RAISE EXCEPTION 'Missing window accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.amie_sync_tally_effort('ID001', '2026-10-26', '2026-10-05', '[]');
    RAISE EXCEPTION 'Reversed window accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM pg_temp.sync('[{"weekStart":"2026-02-30","developmentHours":1,"meetingHours":0}]');
    RAISE EXCEPTION 'Impossible date accepted';
  EXCEPTION WHEN datetime_field_overflow THEN NULL; END;
END $$;
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.tally_test_mutations), 'invalid inputs cause zero row writes');

-- Fail on the second project after the first project's settings and week writes.
-- PostgreSQL's exception subtransaction must restore values AND audit history.
CREATE TEMP TABLE before_failure_weeks AS SELECT to_jsonb(t) AS row FROM public.tally_weekly_effort_entries t;
CREATE TEMP TABLE before_failure_settings AS SELECT to_jsonb(t) AS row FROM public.tally_project_syncs t;
CREATE FUNCTION public.tally_test_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'fixture write failure' USING ERRCODE = 'P0002'; END $$;
CREATE TRIGGER tally_test_failure BEFORE INSERT ON public.tally_weekly_effort_entries
  FOR EACH ROW WHEN (NEW.project_id = 'test-b') EXECUTE FUNCTION public.tally_test_fail_insert();
DO $$ BEGIN
  BEGIN
    PERFORM public.amie_sync_tally_effort('ID001', '2026-10-05', '2026-10-26', '[{"projectID":"test-a","displayName":"Changed","meetingSearchTerms":["new"],"weeklyEffort":[{"weekStart":"2026-10-05","developmentHours":11,"meetingHours":1}]},{"projectID":"test-b","displayName":"Test B","meetingSearchTerms":[],"weeklyEffort":[{"weekStart":"2026-10-12","developmentHours":6,"meetingHours":1}]}]');
    RAISE EXCEPTION 'Injected failure not raised';
  EXCEPTION WHEN no_data_found THEN NULL; END;
END $$;
SELECT pg_temp.assert_true(NOT EXISTS ((SELECT row FROM before_failure_weeks EXCEPT SELECT to_jsonb(t) FROM public.tally_weekly_effort_entries t) UNION ALL (SELECT to_jsonb(t) FROM public.tally_weekly_effort_entries t EXCEPT SELECT row FROM before_failure_weeks)), 'failure rolls back all projects weekly rows');
SELECT pg_temp.assert_true(NOT EXISTS ((SELECT row FROM before_failure_settings EXCEPT SELECT to_jsonb(t) FROM public.tally_project_syncs t) UNION ALL (SELECT to_jsonb(t) FROM public.tally_project_syncs t EXCEPT SELECT row FROM before_failure_settings)), 'failure rolls back settings and freshness');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.tally_test_mutations), 'failure rolls back all audit history');
DROP TRIGGER tally_test_failure ON public.tally_weekly_effort_entries;

-- Last serialized request wins. Legacy callers supply no source revision; an
-- older source snapshot arriving later cannot safely be identified or rejected.
SELECT pg_temp.sync('[{"weekStart":"2026-10-05","developmentHours":12,"meetingHours":0}]');
SELECT pg_temp.sync('[{"weekStart":"2026-10-05","developmentHours":10,"meetingHours":0}]');
SELECT pg_temp.assert_true((SELECT development_hours = 10 FROM public.tally_weekly_effort_entries WHERE project_id = 'test-a' AND member_id = 'ID001' AND week_start = '2026-10-05'), 'legacy out-of-order snapshot follows last-request semantics');
\echo PASS: Tally SQL regression assertions
ROLLBACK;
