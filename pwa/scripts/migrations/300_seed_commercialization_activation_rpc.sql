-- Explicit seed -> provisional project activation.
-- The seed row lock prevents two browser clicks from creating two provisional PJs.
create or replace function public.activate_seed_commercialization(
  p_seed_id uuid,
  p_member_id text,
  p_project_name text,
  p_commercialization_route text default null,
  p_target_market text default null
)
returns table(
  project_id text,
  project_name text,
  project_status text,
  already_linked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  seed_row public.seeds%rowtype;
  existing_row record;
  new_project_id text;
  normalized_name text;
begin
  select * into seed_row from public.seeds where id = p_seed_id for update;
  if not found then
    raise exception 'seed not found';
  end if;

  select sp.project_id, p.project_name, p.status
    into existing_row
    from public.seed_projects sp
    join public.projects p on p.project_id = sp.project_id
   where sp.seed_id = p_seed_id
   order by sp.created_at desc
   limit 1;
  if found then
    return query select existing_row.project_id, existing_row.project_name, existing_row.status, true;
    return;
  end if;

  if not exists (
    select 1 from public.members m
     where m.member_id = p_member_id and m.status = 'active'
  ) then
    raise exception 'member not found or inactive';
  end if;

  normalized_name := left(nullif(trim(p_project_name), ''), 160);
  if normalized_name is null then
    normalized_name := left('事業化検討｜' || seed_row.title, 160);
  end if;

  new_project_id := 'seed-' || left(replace(p_seed_id::text, '-', ''), 8) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  insert into public.projects (
    project_id, project_name, client_name, status, project_type, project_category, start_ym
  ) values (
    new_project_id, normalized_name, seed_row.org_name, 'draft', 'standard', 'dtsu', to_char(timezone('Asia/Tokyo', now()), 'YYYYMM')
  );

  insert into public.seed_projects (
    project_id, seed_id, commercialization_stage, commercialization_route, target_market
  ) values (
    new_project_id, p_seed_id, '事業化検討', nullif(left(trim(coalesce(p_commercialization_route, '')), 80), ''), nullif(left(trim(coalesce(p_target_market, '')), 240), '')
  );

  insert into public.project_members (
    project_id, member_id, role_label, is_pm, is_active
  ) values (
    new_project_id, p_member_id, 'シーズ事業化検討担当', true, true
  );

  return query select new_project_id, normalized_name, 'draft'::text, false;
end;
$$;

revoke all on function public.activate_seed_commercialization(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.activate_seed_commercialization(uuid, text, text, text, text) to service_role;
