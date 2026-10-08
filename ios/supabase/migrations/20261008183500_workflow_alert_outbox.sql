begin;
alter table workflow_monitor_state add column buffered_message_ids text[] not null default '{}', add column target_history_id text;
create function public.workflow_enqueue_event() returns trigger language plpgsql security definer set search_path=public as $$
declare k text; rid text; begin
 if TG_TABLE_NAME='workflow_mail_events' then k:='mail:'||new.event_id;
 else
  if new.action not in ('submitted','approve','return','superseded','release','complete','cancel') then return new; end if;
  k:='event:'||new.event_id;
 end if;
 insert into workflow_alert_deliveries(event_key,recipient_member_id)
 select k,unnest(alert_member_ids) from workflow_rules where rule_key='contract_seal' and enabled
 on conflict do nothing;
 return new;
end $$;
create trigger workflow_mail_alert after insert on workflow_mail_events for each row execute function workflow_enqueue_event();
create trigger workflow_request_alert after insert on workflow_events for each row execute function workflow_enqueue_event();
revoke all on function workflow_contract_snapshot(uuid) from public,anon,authenticated;
grant execute on function workflow_contract_snapshot(uuid) to service_role;
commit;
