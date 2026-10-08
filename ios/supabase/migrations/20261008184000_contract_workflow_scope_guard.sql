-- The first workflow covers accepted AMD contracts. Do not block other parties' ledgers.
begin;
create or replace function public.workflow_guard_signed_status() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if new.relationship_scope='amd_contract' and new.registry_status='accepted' and new.status='signed' and old.status<>'signed' and new.signed_document_id is null and not exists(select 1 from workflow_requests where contract_id=new.contract_id and status='released') then raise exception 'seal_approval_required'; end if;
 return new;
end $$;
commit;
