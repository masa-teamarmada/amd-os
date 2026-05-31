-- 114_institution_policy_assessments_admin_read.sql
-- Tighten ERS policy evidence RLS.
--
-- institution_policy_items remains a public master table, but
-- institution_policy_assessments can hold internal_doc/hearing evidence,
-- source_path, and evaluator notes. Keep reads to admin users and
-- service_role only.

alter table public.institution_policy_assessments enable row level security;

drop policy if exists institution_policy_assessments_anon_read on public.institution_policy_assessments;
drop policy if exists institution_policy_assessments_admin_all on public.institution_policy_assessments;
drop policy if exists institution_policy_assessments_service_role on public.institution_policy_assessments;

revoke all on public.institution_policy_assessments from anon;
grant select, insert, update, delete on public.institution_policy_assessments to authenticated;
grant select, insert, update, delete on public.institution_policy_assessments to service_role;

create policy institution_policy_assessments_admin_all
  on public.institution_policy_assessments
  for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy institution_policy_assessments_service_role
  on public.institution_policy_assessments
  for all
  to service_role
  using (true)
  with check (true);
