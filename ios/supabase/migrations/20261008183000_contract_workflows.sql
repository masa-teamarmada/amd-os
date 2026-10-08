-- Contract seal is the first workflow. Authenticated clients cannot write approval records.
begin;
create table public.workflow_rules (
 rule_key text primary key, request_type text not null,
 approver_member_id text not null references public.members(member_id),
 mailbox_member_id text not null references public.members(member_id),
 alert_member_ids text[] not null,
 enabled boolean not null default false, activated_at timestamptz not null default now()
);
insert into workflow_rules values ('contract_seal','contract_seal','ID002','ID001',array['ID001','ID002'],true,now());
create table public.workflow_requests (
 request_id uuid primary key default gen_random_uuid(), request_type text not null default 'contract_seal' check(request_type='contract_seal'),
 contract_id uuid not null references contracts(contract_id), document_id uuid not null references contract_documents(document_id),
 requested_by text not null references members(member_id), approver_member_id text not null references members(member_id),
 status text not null default 'submitted' check(status in ('submitted','approved','returned','cancelled','superseded','released','completed')),
 purpose text not null check(length(purpose) between 1 and 2000), desired_date date,
 terms_snapshot jsonb not null, source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 snapshot_file_id text not null, snapshot_sha256 text not null check(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 decision_note text, decided_at timestamptz, released_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index workflow_one_active_contract on workflow_requests(contract_id) where status in ('submitted','approved','released');
create table public.workflow_events (
 event_id uuid primary key default gen_random_uuid(), request_id uuid not null references workflow_requests(request_id),
 actor_member_id text references members(member_id), action text not null, note text, created_at timestamptz not null default now()
);
create table public.workflow_mail_events (
 event_id uuid primary key default gen_random_uuid(), mailbox_member_id text not null references members(member_id),
 message_id text not null, thread_id text not null, direction text not null check(direction in ('sent','received')),
 event_kind text not null check(event_kind in ('exchange','signature_request','completion')),
 subject text not null, source_url text not null, occurred_at timestamptz not null,
 contract_id uuid references contracts(contract_id), created_at timestamptz not null default now(),
 unique(mailbox_member_id,message_id)
);
create table public.workflow_alert_deliveries (
 event_key text not null, recipient_member_id text not null references members(member_id),
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','uncertain')),
 channel_id text, slack_ts text, attempted_at timestamptz, sent_at timestamptz, error_code text,
 primary key(event_key,recipient_member_id)
);
create table public.workflow_monitor_state (
 rule_key text primary key references workflow_rules(rule_key), history_id text, last_checked_at timestamptz,
 last_success_at timestamptz, last_error text, lease_until timestamptz, lease_token uuid,
 scan_after timestamptz, next_page_token text, scanned_count integer not null default 0
);
insert into workflow_monitor_state(rule_key) values ('contract_seal');
-- RLS contains no member write policies. Service write routes verify the actor independently.
do $$ declare t text; begin
 foreach t in array array['workflow_rules','workflow_requests','workflow_events','workflow_mail_events','workflow_alert_deliveries','workflow_monitor_state'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy workflow_admin_read on public.%I for select to authenticated using (exists(select 1 from public.members where lower(email)=lower(auth.jwt()->>''email'') and is_admin and status=''active''))',t);
 end loop;
end $$;
create function public.workflow_contract_snapshot(p_contract uuid) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('contract_id',contract_id,'canonical_contract_id',canonical_contract_id,'contract_title',contract_title,
 'counterparty_name',counterparty_name,'amd_entity_name',amd_entity_name,'relationship_scope',relationship_scope,
 'contract_type',contract_type,'effective_date',effective_date,'expiration_date',expiration_date,
 'contract_value_yen',contract_value_yen,'operational_terms_json',operational_terms_json)
 from contracts where contract_id=p_contract
$$;
create function public.workflow_submit(p_actor text,p_contract uuid,p_document uuid,p_purpose text,p_date date,p_source_hash text,p_snapshot_file text,p_snapshot_hash text,p_terms jsonb)
 returns uuid language plpgsql security definer set search_path=public as $$
 declare c contracts; d contract_documents; r workflow_rules; rid uuid;
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
 insert into workflow_requests(contract_id,document_id,requested_by,approver_member_id,purpose,desired_date,terms_snapshot,source_sha256,snapshot_file_id,snapshot_sha256)
 values(p_contract,p_document,p_actor,r.approver_member_id,p_purpose,p_date,p_terms,p_source_hash,p_snapshot_file,p_snapshot_hash) returning request_id into rid;
 insert into workflow_events(request_id,actor_member_id,action) values(rid,p_actor,'submitted');
 return rid;
 end $$;
create function public.workflow_transition(p_actor text,p_request uuid,p_action text,p_note text default null)
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
 elsif p_action='cancel' and w.status in ('submitted','approved') then next_status:='cancelled';
 elsif p_action='release' and w.status='approved' then next_status:='released';
 elsif p_action='complete' and w.status='released' and c.status='signed' and c.signed_document_id is not null then next_status:='completed';
 else raise exception 'invalid_transition'; end if;
 update workflow_requests set status=next_status,decision_note=case when p_action in ('approve','return') then p_note else decision_note end,
 decided_at=case when p_action in ('approve','return') then now() else decided_at end,
 released_at=case when p_action='release' then now() else released_at end,updated_at=now() where request_id=p_request returning * into w;
 insert into workflow_events(request_id,actor_member_id,action,note) values(p_request,p_actor,p_action,p_note);
 return w;
 end $$;
create function public.workflow_invalidate() returns trigger language plpgsql security definer set search_path=public as $$
 declare cid uuid; begin
 if TG_TABLE_NAME='contracts' then
  cid:=new.contract_id;
  if workflow_contract_snapshot(cid) is not distinct from jsonb_build_object('contract_id',old.contract_id,'canonical_contract_id',old.canonical_contract_id,'contract_title',old.contract_title,'counterparty_name',old.counterparty_name,'amd_entity_name',old.amd_entity_name,'relationship_scope',old.relationship_scope,'contract_type',old.contract_type,'effective_date',old.effective_date,'expiration_date',old.expiration_date,'contract_value_yen',old.contract_value_yen,'operational_terms_json',old.operational_terms_json) and new.status<>'cancelled' then return new; end if;
 else
  cid:=new.contract_id;
  -- A signed artifact is recorded separately; release remains until Kiyo verifies it.
  if new.document_kind='signed' or not new.is_latest then return new; end if;
 end if;
 with changed as (update workflow_requests set status='superseded',updated_at=now() where contract_id=cid and status in ('submitted','approved','released') returning request_id)
 insert into workflow_events(request_id,action,note) select request_id,'superseded','承認対象の文書または契約条件が変更されたため再申請が必要' from changed;
 return new;
 end $$;
create trigger workflow_terms_changed after update on contracts for each row execute function workflow_invalidate();
create trigger workflow_pdf_changed after insert or update of is_latest,drive_file_id on contract_documents for each row execute function workflow_invalidate();
create function public.workflow_claim_monitor(p_token uuid) returns boolean language plpgsql security definer set search_path=public as $$ begin
 update workflow_monitor_state set lease_until=now()+interval '4 minutes',lease_token=p_token,last_checked_at=now() where rule_key='contract_seal' and (lease_until is null or lease_until<now());
 return found;
end $$;
-- Signing state may only be intentionally changed with a released approval.
-- Signed document registration remains an evidence write, even for a breach.
create function public.workflow_guard_signed_status() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if new.status='signed' and old.status<>'signed' and new.signed_document_id is null and not exists(select 1 from workflow_requests where contract_id=new.contract_id and status='released') then raise exception 'seal_approval_required'; end if;
 return new;
end $$;
create trigger workflow_signed_status_guard before update of status on contracts for each row execute function workflow_guard_signed_status();
revoke all on function workflow_submit(text,uuid,uuid,text,date,text,text,text,jsonb), workflow_transition(text,uuid,text,text),workflow_claim_monitor(uuid) from public,anon,authenticated;
grant execute on function workflow_submit(text,uuid,uuid,text,date,text,text,text,jsonb), workflow_transition(text,uuid,text,text),workflow_claim_monitor(uuid) to service_role;
commit;
