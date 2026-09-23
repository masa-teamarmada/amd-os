-- Boss display names live in the shared catalog, not server_bosses.
create or replace function public.list_l2m_boss_kill_history(target_server uuid)
returns table (report_id uuid, boss_name text, killed_at timestamptz, recorder_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_l2m_boss_member(target_server) then
    raise exception 'active membership required' using errcode = '42501';
  end if;
  return query
  select br.id, bc.display_name::text, br.killed_at,
    coalesce(account.username, '管理者')::text
  from public.boss_reports br
  join public.server_bosses sb on sb.id = br.server_boss_id
  join public.boss_catalog bc on bc.id = sb.boss_id
  left join public.l2m_boss_pin_accounts account on account.user_id = br.submitted_by
  where br.game_server_id = target_server and br.status = 'accepted' and br.input_source = 'app'
  order by br.killed_at desc, br.id desc
  limit 100;
end;
$$;
