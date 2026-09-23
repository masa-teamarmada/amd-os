-- Team members can request Lind 3 access, and an active owner/admin decides.
-- Authentication alone never grants access to the boss schedule.
create or replace function public.request_l2m_boss_membership()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_server uuid;
  current_status public.l2m_boss_membership_status;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select id into target_server from public.game_servers where slug = 'lind-3' and is_active;
  if target_server is null then
    raise exception 'team unavailable' using errcode = '55000';
  end if;
  insert into public.server_memberships (game_server_id, user_id, role, status)
  values (target_server, auth.uid(), 'member', 'pending')
  on conflict (game_server_id, user_id) do nothing;
  select status into current_status from public.server_memberships
  where game_server_id = target_server and user_id = auth.uid();
  return current_status::text;
end;
$$;

revoke all on function public.request_l2m_boss_membership() from public;
grant execute on function public.request_l2m_boss_membership() to authenticated;

create or replace function public.list_pending_l2m_boss_memberships()
returns table (id uuid, email text, requested_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare target_server uuid;
begin
  select gs.id into target_server from public.game_servers gs where gs.slug = 'lind-3';
  if target_server is null or not public.is_l2m_boss_admin(target_server) then
    raise exception 'team admin required' using errcode = '42501';
  end if;
  return query
  select m.id, u.email::text, m.created_at
  from public.server_memberships m
  join auth.users u on u.id = m.user_id
  where m.game_server_id = target_server and m.status = 'pending'
  order by m.created_at;
end;
$$;

revoke all on function public.list_pending_l2m_boss_memberships() from public;
grant execute on function public.list_pending_l2m_boss_memberships() to authenticated;

create or replace function public.decide_l2m_boss_membership(target_membership uuid, approve boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare target public.server_memberships;
begin
  if target_membership is null or approve is null then
    raise exception 'membership and decision required' using errcode = '22004';
  end if;
  select * into target from public.server_memberships where id = target_membership for update;
  if target.id is null or not public.is_l2m_boss_admin(target.game_server_id) then
    raise exception 'team admin required' using errcode = '42501';
  end if;
  if target.status <> 'pending' then
    raise exception 'request is no longer pending' using errcode = '40001';
  end if;
  update public.server_memberships
  set status = case when approve then 'active'::public.l2m_boss_membership_status
                         else 'revoked'::public.l2m_boss_membership_status end,
      approved_at = case when approve then now() else null end,
      revoked_at = case when approve then null else now() end,
      role = 'member'
  where id = target_membership;
  return case when approve then 'active' else 'revoked' end;
end;
$$;

revoke all on function public.decide_l2m_boss_membership(uuid, boolean) from public;
grant execute on function public.decide_l2m_boss_membership(uuid, boolean) to authenticated;
