-- Start a contract workflow before a document exists; keep approval as a separate transition.
begin;
alter table public.workflow_requests
 alter column document_id drop not null,
 alter column source_sha256 drop not null,
 alter column snapshot_file_id drop not null,
 alter column snapshot_sha256 drop not null,
 add column submitted_at timestamptz;
update public.workflow_requests set submitted_at=created_at;
alter table public.workflow_requests drop constraint workflow_requests_status_check;
alter table public.workflow_requests add constraint workflow_requests_status_check
 check(status in ('preparing','submitted','approved','returned','cancelled','superseded','released','completed'));
alter table public.workflow_requests add constraint workflow_frozen_pdf_required
 check ((document_id is not null and source_sha256 is not null and snapshot_file_id is not null and snapshot_sha256 is not null)
  or (status in ('preparing','cancelled') and document_id is null and source_sha256 is null and snapshot_file_id is null and snapshot_sha256 is null));
-- Replace only this feature's index so a preparing workflow also excludes a second active case.
drop index public.workflow_one_active_contract;
create unique index workflow_one_active_contract on public.workflow_requests(contract_id)
 where status in ('preparing','submitted','approved','released');

create function public.workflow_start(p_actor text,p_request uuid,p_contract uuid,p_project text,p_title text,p_counterparty text,p_type text,p_purpose text,p_date date)
 returns workflow_requests language plpgsql security definer set search_path=public as $$
 declare c contracts; r workflow_rules; w workflow_requests; actor_email text;
 begin
 select email into actor_email from members where member_id=p_actor and is_admin and status='active';
 if not found then raise exception 'forbidden'; end if;
 select * into r from workflow_rules where rule_key='contract_seal' and enabled;
 if not found or p_actor=r.approver_member_id then raise exception 'self_approval_forbidden'; end if;
 if p_request is null or p_purpose is null or length(trim(p_purpose)) not between 1 and 2000 then raise exception 'invalid_input'; end if;
 -- Retries of the same start request do not create duplicate contracts or events.
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into w from workflow_requests where request_id=p_request;
 if found then
  if w.requested_by<>p_actor then raise exception 'requester_required'; end if;
  return w;
 end if;
 if p_contract is null then
  if not exists(select 1 from projects where project_id=p_project) or p_title is null or length(trim(p_title)) not between 1 and 240
   or p_counterparty is null or length(trim(p_counterparty)) not between 1 and 240 or p_type is null or length(trim(p_type)) not between 1 and 80 then raise exception 'invalid_input'; end if;
  insert into contracts(project_id,contract_title,canonical_title,counterparty_name,contract_type,status,registry_status,relationship_scope,
   amd_entity_name,party_confirmation_note,party_confirmed_at,party_confirmed_by,created_by,updated_by,source_summary)
  values(p_project,trim(p_title),trim(p_title),trim(p_counterparty),trim(p_type),'planned','accepted','amd_contract',
   '株式会社チームアルマダ','業務フローの開始画面でAMD当事者契約として確認',now(),actor_email,actor_email,actor_email,trim(p_purpose)) returning * into c;
 else
  select * into c from contracts where contract_id=p_contract for update;
  if not found then raise exception 'contract_missing'; end if;
 end if;
 if c.relationship_scope<>'amd_contract' or c.registry_status<>'accepted' or c.status in ('signed','cancelled') then raise exception 'contract_not_eligible'; end if;
 insert into workflow_requests(request_id,contract_id,requested_by,approver_member_id,status,purpose,desired_date,terms_snapshot)
 values(p_request,c.contract_id,p_actor,r.approver_member_id,'preparing',trim(p_purpose),p_date,workflow_contract_snapshot(c.contract_id)) returning * into w;
 -- Preparation does not send an approval alert. The existing outbox starts at submitted.
 insert into workflow_events(request_id,actor_member_id,action) values(w.request_id,p_actor,'started');
 return w;
 end $$;

create or replace function public.workflow_submit(p_actor text,p_contract uuid,p_document uuid,p_purpose text,p_date date,p_source_hash text,p_snapshot_file text,p_snapshot_hash text,p_terms jsonb)
 returns uuid language plpgsql security definer set search_path=public as $$
 declare c contracts; d contract_documents; r workflow_rules; rid uuid; draft workflow_requests;
 begin
 select * into c from contracts where contract_id=p_contract for update;
 if not found then raise exception 'contract_missing'; end if;
 if not exists(select 1 from members where member_id=p_actor and is_admin and status='active') then raise exception 'forbidden'; end if;
 select * into r from workflow_rules where rule_key='contract_seal' and enabled;
 if not found or p_actor=r.approver_member_id then raise exception 'self_approval_forbidden'; end if;
 if c.relationship_scope<>'amd_contract' or c.registry_status<>'accepted' or c.status in ('signed','cancelled') then raise exception 'contract_not_eligible'; end if;
 select * into d from contract_documents where document_id=p_document and contract_id=p_contract and is_latest and mime_type='application/pdf' and document_kind<>'signed';
 if not found then raise exception 'final_pdf_required'; end if;
 if workflow_contract_snapshot(p_contract) is distinct from p_terms then raise exception 'contract_changed'; end if;
 select * into draft from workflow_requests where contract_id=p_contract and status='preparing' for update;
 if found then
  if draft.requested_by<>p_actor then raise exception 'requester_required'; end if;
  update workflow_requests set document_id=p_document,status='submitted',purpose=p_purpose,desired_date=p_date,
   terms_snapshot=p_terms,source_sha256=p_source_hash,snapshot_file_id=p_snapshot_file,snapshot_sha256=p_snapshot_hash,
   submitted_at=now(),updated_at=now() where request_id=draft.request_id returning request_id into rid;
 else
 insert into workflow_requests(contract_id,document_id,requested_by,approver_member_id,purpose,desired_date,terms_snapshot,source_sha256,snapshot_file_id,snapshot_sha256,submitted_at)
 values(p_contract,p_document,p_actor,r.approver_member_id,p_purpose,p_date,p_terms,p_source_hash,p_snapshot_file,p_snapshot_hash,now()) returning request_id into rid;
 end if;
 insert into workflow_events(request_id,actor_member_id,action) values(rid,p_actor,'submitted');
 return rid;
 end $$;
create or replace function public.workflow_transition(p_actor text,p_request uuid,p_action text,p_note text default null)
 returns workflow_requests language plpgsql security definer set search_path=public as $$
 declare w workflow_requests; c contracts; next_status text;
 begin
 -- Use the same lock order as invalidation: contract, then request.
 select * into w from workflow_requests where request_id=p_request;
 if not found then raise exception 'request_missing'; end if;
 select * into c from contracts where contract_id=w.contract_id for update;
 select * into w from workflow_requests where request_id=p_request for update;
 if not exists(select 1 from members where member_id=p_actor and is_admin and status='active') then raise exception 'forbidden'; end if;
 if p_action in ('approve','return','complete') then
  if p_actor<>w.approver_member_id or p_actor=w.requested_by then raise exception 'approver_required'; end if;
 elsif p_action in ('cancel','release') then
  if p_actor<>w.requested_by then raise exception 'requester_required'; end if;
 else raise exception 'invalid_action'; end if;
 if p_action in ('approve','release') and (workflow_contract_snapshot(w.contract_id) is distinct from w.terms_snapshot or not exists(select 1 from contract_documents where document_id=w.document_id and is_latest and document_kind<>'signed')) then raise exception 'request_superseded'; end if;
 if p_action='approve' and w.status='submitted' then next_status:='approved';
 elsif p_action='return' and w.status in ('submitted','approved','released') and length(trim(coalesce(p_note,'')))>0 then next_status:='returned';
 elsif p_action='cancel' and w.status in ('preparing','submitted','approved') then next_status:='cancelled';
 elsif p_action='release' and w.status='approved' then next_status:='released';
 elsif p_action='complete' and w.status='released' and c.status='signed' and c.signed_document_id is not null then next_status:='completed';
 else raise exception 'invalid_transition'; end if;
 update workflow_requests set status=next_status,decision_note=case when p_action in ('approve','return') then p_note else decision_note end,
 decided_at=case when p_action in ('approve','return') then now() else decided_at end,
 released_at=case when p_action='release' then now() else released_at end,updated_at=now() where request_id=p_request returning * into w;
 insert into workflow_events(request_id,actor_member_id,action,note) values(p_request,p_actor,p_action,p_note);
 return w;
 end $$;

create function public.workflow_register_pdf(p_actor text,p_request uuid,p_file text,p_name text,p_size bigint,p_signed boolean)
 returns uuid language plpgsql security definer set search_path=public as $$
 declare w workflow_requests; c contracts; did uuid;
 begin
 select * into w from workflow_requests where request_id=p_request;
 if not found then raise exception 'request_missing'; end if;
 select * into c from contracts where contract_id=w.contract_id for update;
 select * into w from workflow_requests where request_id=p_request for update;
 if not exists(select 1 from members where member_id=p_actor and is_admin and status='active') or w.requested_by<>p_actor then raise exception 'requester_required'; end if;
 if (not p_signed and w.status<>'preparing') or (p_signed and w.status<>'released') or p_signed is null then raise exception 'invalid_transition'; end if;
 if c.relationship_scope<>'amd_contract' or c.registry_status<>'accepted' or c.status='cancelled' then raise exception 'contract_not_eligible'; end if;
 if p_file is null or p_file !~ '^[a-zA-Z0-9_-]{10,200}$' or p_size is null or p_size not between 1 and 25000000 or nullif(trim(p_name),'') is null then raise exception 'invalid_pdf'; end if;
 if p_signed and c.signed_document_id is not null then raise exception 'signed_artifact_exists'; end if;
 if not p_signed and exists(select 1 from contract_documents where contract_id=c.contract_id and is_latest and drive_file_id=p_file and document_kind<>'signed') then
  select document_id into did from contract_documents where contract_id=c.contract_id and is_latest and drive_file_id=p_file and document_kind<>'signed' limit 1;
  return did;
 end if;
 update contract_documents set is_latest=false,updated_at=now() where contract_id=c.contract_id and is_latest;
 insert into contract_documents(contract_id,project_id,document_kind,version_label,drive_file_id,web_view_link,file_name,mime_type,file_size_bytes,is_latest,uploaded_by)
 values(c.contract_id,c.project_id,case when p_signed then 'signed' else 'revision' end,case when p_signed then '締結版' else '最終版' end,
  p_file,'https://drive.google.com/file/d/'||p_file||'/view',p_name,'application/pdf',p_size,true,p_actor) returning document_id into did;
 update contracts set status=case when p_signed then 'signed' else 'under_review' end,
  signed_document_id=case when p_signed then did else null end,signed_at=case when p_signed then now() else null end,
  updated_at=now(),last_activity_at=now() where contract_id=c.contract_id;
 insert into workflow_events(request_id,actor_member_id,action) values(w.request_id,p_actor,case when p_signed then 'signed_pdf_registered' else 'final_pdf_registered' end);
 return did;
 end $$;
revoke all on function public.workflow_start(text,uuid,uuid,text,text,text,text,text,date),public.workflow_register_pdf(text,uuid,text,text,bigint,boolean) from public,anon,authenticated;
grant execute on function public.workflow_start(text,uuid,uuid,text,text,text,text,text,date),public.workflow_register_pdf(text,uuid,text,text,bigint,boolean) to service_role;
commit;
