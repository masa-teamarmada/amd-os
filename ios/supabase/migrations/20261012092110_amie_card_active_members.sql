-- Keep direct RLS reads aligned with the existing active-member API gate.
create or replace function public.amie_card_project_read(p_project_id text) returns boolean
 language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists (
  select 1 from public.members m where m.member_id=public.current_member_id()
   and m.status='active'
   and (m.is_admin or coalesce(m.os_access_scope,'portfolio')='portfolio'
    or exists(select 1 from public.project_surface_member_permissions g where g.member_id=m.member_id and g.project_id=p_project_id and g.surface='cockpit'))
 );
$$;
revoke all on function public.amie_card_project_read(text) from public,anon;
grant execute on function public.amie_card_project_read(text) to authenticated,service_role;
