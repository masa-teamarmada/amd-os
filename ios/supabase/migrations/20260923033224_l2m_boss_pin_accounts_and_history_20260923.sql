-- Email addresses are never used as player-facing identities. A four digit PIN
-- is transformed with an Edge-only secret before it reaches Supabase Auth.
create table public.l2m_boss_pin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  check (char_length(username) between 2 and 20)
);
alter table public.l2m_boss_pin_accounts enable row level security;
revoke all on public.l2m_boss_pin_accounts from anon, authenticated;

create table public.l2m_boss_auth_attempts (
  attempt_key text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.l2m_boss_auth_attempts enable row level security;
revoke all on public.l2m_boss_auth_attempts from anon, authenticated;

create or replace function public.reserve_l2m_boss_auth_attempt(target_key text, max_attempts integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare next_attempts integer;
begin
  if target_key is null or char_length(target_key) > 150 or max_attempts not between 1 and 100 then
    raise exception 'invalid limit request' using errcode = '22023';
  end if;
  insert into public.l2m_boss_auth_attempts(attempt_key, window_start, attempts)
  values (target_key, now(), 1)
  on conflict (attempt_key) do update
    set attempts = case when public.l2m_boss_auth_attempts.window_start < now() - interval '15 minutes'
      then 1 else public.l2m_boss_auth_attempts.attempts + 1 end,
        window_start = case when public.l2m_boss_auth_attempts.window_start < now() - interval '15 minutes'
      then now() else public.l2m_boss_auth_attempts.window_start end
  returning attempts into next_attempts;
  return next_attempts <= max_attempts;
end;
$$;
revoke all on function public.reserve_l2m_boss_auth_attempt(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_l2m_boss_auth_attempt(text, integer) to service_role;

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
  select br.id, sb.display_name::text, br.killed_at,
    coalesce(account.username, '管理者')::text
  from public.boss_reports br
  join public.server_bosses sb on sb.id = br.server_boss_id
  left join public.l2m_boss_pin_accounts account on account.user_id = br.submitted_by
  where br.game_server_id = target_server and br.status = 'accepted' and br.input_source = 'app'
  order by br.killed_at desc, br.id desc
  limit 100;
end;
$$;
revoke all on function public.list_l2m_boss_kill_history(uuid) from public, anon;
grant execute on function public.list_l2m_boss_kill_history(uuid) to authenticated;
