begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('workflow-document-uploads','workflow-document-uploads',false,25000000,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do nothing;
create table public.workflow_document_uploads(
 upload_id uuid primary key,request_id uuid not null references workflow_requests(request_id),actor_member_id text not null references members(member_id),
 storage_path text not null unique,file_name text not null,mime_type text not null,file_size_bytes bigint not null check(file_size_bytes between 1 and 25000000),
 document_kind text not null check(document_kind in ('draft','revision','signed')),drive_file_id text not null,drive_folder_id text not null,
 document_id uuid references contract_documents(document_id),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '2 hours'
);
create index workflow_document_uploads_actor_created on public.workflow_document_uploads(actor_member_id,created_at);
alter table public.workflow_document_uploads enable row level security;
revoke all on public.workflow_document_uploads from anon,authenticated;
grant all on public.workflow_document_uploads to service_role;

create function public.workflow_register_document(p_actor text,p_request uuid,p_file text,p_name text,p_size bigint,p_mime text,p_kind text,p_source text default 'manual_drive_link')
returns uuid language plpgsql security definer set search_path=public as $$
 declare w workflow_requests; c contracts; did uuid;
 begin
 select * into w from workflow_requests where request_id=p_request;
 if not found then raise exception 'request_missing';end if;
 select * into c from contracts where contract_id=w.contract_id for update;
 select * into w from workflow_requests where request_id=p_request for update;
 if not exists(select 1 from members where member_id=p_actor and is_admin and status='active') or w.requested_by<>p_actor then raise exception 'requester_required';end if;
 if p_kind is null or p_kind not in ('draft','revision','signed') then raise exception 'invalid_kind';end if;
 if p_mime is null or p_mime not in ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document') or (p_kind<>'draft' and p_mime<>'application/pdf') then raise exception 'final_pdf_required';end if;
 if (p_kind<>'signed' and w.status<>'preparing') or (p_kind='signed' and w.status<>'released') then raise exception 'invalid_transition';end if;
 if c.relationship_scope<>'amd_contract' or c.registry_status<>'accepted' or c.status='cancelled' then raise exception 'contract_not_eligible';end if;
 if p_file is null or p_file !~ '^[a-zA-Z0-9_-]{10,200}$' or p_size is null or p_size not between 1 and 25000000 or nullif(trim(p_name),'') is null or p_source not in ('manual_drive_link','workflow_file_upload') then raise exception 'invalid_document';end if;
 select document_id into did from contract_documents where contract_id=c.contract_id and drive_file_id=p_file and mime_type=p_mime and document_kind=p_kind limit 1;
 if did is not null then return did;end if;
 if p_kind='signed' and c.signed_document_id is not null then raise exception 'signed_artifact_exists';end if;
 update contract_documents set is_latest=false,updated_at=now() where contract_id=c.contract_id and is_latest;
 insert into contract_documents(contract_id,project_id,document_kind,version_label,drive_file_id,web_view_link,file_name,mime_type,file_size_bytes,is_latest,uploaded_by,source_kind)
 values(c.contract_id,c.project_id,p_kind,case p_kind when 'signed' then '締結版' when 'draft' then '下書き' else '最終版' end,p_file,'https://drive.google.com/file/d/'||p_file||'/view',p_name,p_mime,p_size,true,p_actor,p_source) returning document_id into did;
 update contracts set status=case p_kind when 'signed' then 'signed' when 'draft' then 'drafting' else 'under_review' end,
 signed_document_id=case when p_kind='signed' then did else null end,signed_at=case when p_kind='signed' then now() else null end,updated_at=now(),last_activity_at=now() where contract_id=c.contract_id;
 insert into workflow_events(request_id,actor_member_id,action) values(w.request_id,p_actor,case p_kind when 'signed' then 'signed_pdf_registered' when 'draft' then 'draft_registered' else 'final_pdf_registered' end);
 return did;
 end $$;
revoke all on function public.workflow_register_document(text,uuid,text,text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.workflow_register_document(text,uuid,text,text,bigint,text,text,text) to service_role;
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
 select * into d from contract_documents where document_id=p_document and contract_id=p_contract and is_latest and mime_type='application/pdf' and document_kind not in ('signed','draft');
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

commit;
