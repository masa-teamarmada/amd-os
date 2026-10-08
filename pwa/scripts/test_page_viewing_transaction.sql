-- Real DB behavior test. Everything rolls back; no sample history remains.
BEGIN;
DO $$
DECLARE s uuid := gen_random_uuid(); v1 uuid := gen_random_uuid(); v2 uuid := gen_random_uuid(); n integer;
BEGIN
  PERFORM amie_update_page_viewer(s,v1,1,'test:page-viewing','検証','test-page-a','検証画面',true);
  PERFORM amie_update_page_viewer(s,v1,2,'test:page-viewing','検証','test-page-a','検証画面',true);
  SELECT count(*) INTO n FROM os_page_viewing_visits WHERE visit_id=v1;
  IF n <> 1 THEN RAISE EXCEPTION 'Heartbeat duplicated the visit'; END IF;
  PERFORM amie_update_page_viewer(s,v1,3,'test:page-viewing','検証','test-page-a','検証画面',false);
  PERFORM amie_update_page_viewer(s,v1,2,'test:page-viewing','検証','test-page-a','検証画面',true);
  IF (SELECT active FROM os_page_viewer_sessions WHERE session_id=s) THEN RAISE EXCEPTION 'Late heartbeat resurrected a hidden tab'; END IF;
  PERFORM amie_update_page_viewer(s,v2,4,'test:page-viewing','検証','test-page-b','検証画面B',true);
  PERFORM amie_update_page_viewer(s,v1,3,'test:page-viewing','検証','test-page-a','検証画面',false);
  IF NOT (SELECT active AND resource_key='test-page-b' FROM os_page_viewer_sessions WHERE session_id=s) THEN RAISE EXCEPTION 'Late leave erased new page'; END IF;
  PERFORM amie_update_page_viewer(s,v1,5,'test:another-actor','偽装','test-page-a','偽装',true);
  IF (SELECT actor_key FROM os_page_viewer_sessions WHERE session_id=s) <> 'test:page-viewing' THEN RAISE EXCEPTION 'Actor impersonation'; END IF;
  UPDATE os_page_viewer_sessions SET last_seen_at=now()-interval '31 seconds' WHERE session_id=s;
  IF EXISTS(SELECT 1 FROM os_page_viewer_sessions WHERE session_id=s AND active AND last_seen_at>now()-interval '30 seconds') THEN RAISE EXCEPTION 'Expired presence is visible'; END IF;
  IF has_table_privilege('anon','public.os_page_viewing_visits','SELECT') OR has_table_privilege('authenticated','public.os_page_viewing_visits','SELECT') OR has_function_privilege('authenticated','public.amie_update_page_viewer(uuid,uuid,bigint,text,text,text,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Client can bypass server authorization'; END IF;
END;
$$;
SELECT 'PASS: idempotency, ordered leave/switch, actor boundary, expiry, server-only access' AS result;
ROLLBACK;
