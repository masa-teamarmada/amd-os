BEGIN;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$
DECLARE pkg public.dd_packages%ROWTYPE; req UUID; retry UUID; acct UUID; result JSONB; denied BOOLEAN:=false;
BEGIN
  SELECT * INTO pkg FROM public.dd_packages WHERE status='open' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'open DD fixture required'; END IF;
  INSERT INTO public.workspace_access_requests(email_normalized,requested_path,target_kind)
    VALUES('amie-scope-combined-test@example.invalid','/','unspecified') RETURNING id INTO req;
  result := public.workspace_decide_access_request_scoped(req,'project_dd',pkg.id::TEXT,'ID001','slack');
  acct := (result->>'accountId')::UUID;
  IF NOT EXISTS(SELECT 1 FROM public.project_access_memberships WHERE user_account_id=acct AND project_id=pkg.project_id AND role='readonly' AND status='invited') THEN RAISE EXCEPTION 'project viewer missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.dd_package_grants WHERE user_account_id=acct AND package_id=pkg.id AND capabilities=ARRAY['dd.view']::TEXT[] AND status='invited') THEN RAISE EXCEPTION 'DD viewer missing or broader permission'; END IF;
  IF EXISTS(SELECT 1 FROM public.institution_workspace_memberships WHERE user_account_id=acct) THEN RAISE EXCEPTION 'unrequested institution access'; END IF;
  result := public.workspace_decide_access_request_scoped(req,'project_dd',pkg.id::TEXT,'ID001','slack');
  IF result->>'alreadyDecided'<>'true' THEN RAISE EXCEPTION 'not idempotent'; END IF;

  INSERT INTO public.workspace_access_requests(email_normalized,requested_path,target_kind)
    VALUES('amie-scope-dd-only-test@example.invalid','/','unspecified') RETURNING id INTO req;
  result := public.workspace_decide_access_request_scoped(req,'dd',pkg.id::TEXT,'ID001','admin_page');
  acct := (result->>'accountId')::UUID;
  IF EXISTS(SELECT 1 FROM public.project_access_memberships WHERE user_account_id=acct) OR EXISTS(SELECT 1 FROM public.institution_workspace_memberships WHERE user_account_id=acct) THEN RAISE EXCEPTION 'DD-only granted workspace'; END IF;
  UPDATE public.dd_package_grants SET status='revoked' WHERE user_account_id=acct AND package_id=pkg.id;
  INSERT INTO public.workspace_access_requests(email_normalized,requested_path,target_kind)
    VALUES('amie-scope-dd-only-test@example.invalid','/?retry=1','unspecified') RETURNING id INTO retry;
  BEGIN
    PERFORM public.workspace_decide_access_request_scoped(retry,'project_dd',pkg.id::TEXT,'ID001','slack');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%stopped or expired%' THEN RAISE; END IF; denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'stopped DD revived'; END IF;
  IF EXISTS(SELECT 1 FROM public.project_access_memberships WHERE user_account_id=acct) THEN RAISE EXCEPTION 'partial project grant left after DD failure'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.workspace_access_requests WHERE id=retry AND target_kind='unspecified' AND status='pending') THEN RAISE EXCEPTION 'failed transaction altered request'; END IF;
  denied:=false;
  BEGIN PERFORM public.workspace_decide_access_request_scoped(retry,'dd',pkg.id::TEXT,'not-admin','slack');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%admin required%' THEN RAISE; END IF; denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'unauthorized actor accepted'; END IF;
  denied:=false;
  BEGIN PERFORM public.workspace_decide_access_request_scoped(retry,'other',pkg.id::TEXT,'ID001','slack');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%invalid access request scope%' THEN RAISE; END IF; denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'invalid scope accepted'; END IF;
  IF has_function_privilege('anon','public.workspace_decide_access_request_scoped(uuid,text,text,text,text)','execute') OR has_function_privilege('authenticated','public.workspace_decide_access_request_scoped(uuid,text,text,text,text)','execute') THEN RAISE EXCEPTION 'public execute enabled'; END IF;
END $$;
SELECT 'combined readonly, DD-only isolation, idempotence, stopped DD, atomic failure, admin-only and scope validation: passed; rolled back' AS verification;
ROLLBACK;
