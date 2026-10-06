BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
DECLARE doc public.workspace_documents%ROWTYPE; req UUID; req2 UUID; result JSONB; account UUID; stopped BOOLEAN := false; wrong_actor BOOLEAN := false;
BEGIN
 SELECT * INTO doc FROM public.workspace_documents WHERE scope_kind='project' AND visibility='workspace_shared' AND upload_status='active' LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'shared project test fixture missing'; END IF;
 INSERT INTO public.workspace_access_requests(email_normalized,requested_path,target_kind)
 VALUES('amie-access-rollback-test@example.invalid','/api/workspace-documents/'||doc.document_id||'/render','unspecified') RETURNING id INTO req;
 result := public.workspace_decide_access_request(req,'approved','ID001','slack');
 account := (result->>'accountId')::UUID;
 IF result->>'status' <> 'approved' OR result->>'projectId' <> doc.project_id THEN RAISE EXCEPTION 'target resolution failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.project_access_memberships WHERE user_account_id=account AND project_id=doc.project_id AND role='readonly' AND status='invited') THEN RAISE EXCEPTION 'readonly grant missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.institution_workspace_memberships WHERE user_account_id=account) THEN RAISE EXCEPTION 'unrequested institution grant'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.workspace_access_audit_logs WHERE user_account_id=account AND event_type='access_request_approved' AND project_id=doc.project_id) THEN RAISE EXCEPTION 'audit missing'; END IF;
 result := public.workspace_decide_access_request(req,'approved','ID001','slack');
 IF result->>'alreadyDecided' <> 'true' THEN RAISE EXCEPTION 'duplicate decision not idempotent'; END IF;
 UPDATE public.project_access_memberships SET status='suspended' WHERE user_account_id=account AND project_id=doc.project_id;
 INSERT INTO public.workspace_access_requests(email_normalized,requested_path,target_kind)
 VALUES('amie-access-rollback-test@example.invalid','/api/workspace-documents/'||doc.document_id||'/render?retry=2','unspecified') RETURNING id INTO req2;
 BEGIN
   PERFORM public.workspace_decide_access_request(req2,'approved','ID001','slack');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%stopped%' THEN RAISE; END IF;
   stopped := true;
 END;
 IF NOT stopped THEN RAISE EXCEPTION 'stopped grant reactivated'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.workspace_access_requests WHERE id=req2 AND status='pending' AND target_kind='unspecified') THEN RAISE EXCEPTION 'failure changed request'; END IF;
 BEGIN
   PERFORM public.workspace_decide_access_request(req2,'approved','not-an-admin','slack');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%admin required%' THEN RAISE; END IF;
   wrong_actor := true;
 END;
 IF NOT wrong_actor THEN RAISE EXCEPTION 'unauthorized actor allowed'; END IF;
 IF has_function_privilege('anon','public.workspace_decide_access_request(uuid,text,text,text)','execute') OR has_function_privilege('authenticated','public.workspace_decide_access_request(uuid,text,text,text)','execute') THEN RAISE EXCEPTION 'public execute permission'; END IF;
END $$;
SELECT 'one click project grant, document resolution, audit, duplicate, stopped grant, unauthorized actor and ACL: passed; all test changes rolled back' AS verification;
ROLLBACK;
