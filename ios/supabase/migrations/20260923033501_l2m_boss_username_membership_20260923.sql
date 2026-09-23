-- Only the owner of a PIN identity can read their own username directly.
grant select on public.l2m_boss_pin_accounts to authenticated;
create policy l2m_boss_pin_account_self_read on public.l2m_boss_pin_accounts
for select to authenticated using (user_id = auth.uid());

-- Team approval shows usernames only; synthetic or legacy auth emails stay private.
drop function public.list_pending_l2m_boss_memberships();
create function public.list_pending_l2m_boss_memberships()
returns table (id uuid, username text, requested_at timestamptz)
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
  select m.id, account.username, m.created_at
  from public.server_memberships m
  join public.l2m_boss_pin_accounts account on account.user_id = m.user_id
  where m.game_server_id = target_server and m.status = 'pending'
  order by m.created_at;
end;
$$;
revoke all on function public.list_pending_l2m_boss_memberships() from public, anon;
grant execute on function public.list_pending_l2m_boss_memberships() to authenticated;
