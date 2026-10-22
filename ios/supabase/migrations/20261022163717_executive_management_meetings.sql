-- 経営会議。既存の project_meeting_summaries / 動向・会議とは接続しない。
-- 将来の取締役会は meeting_kind を分け、別の規程と認可を追加してから開放する。
-- ユーザー属性とPJごとの登録は独立。両方が有効な人だけが参加できる。
alter table public.members add column is_executive boolean not null default false;
alter table public.workspace_user_accounts add column is_executive boolean not null default false;

create table public.project_executive_attribute_events (
  id uuid primary key default gen_random_uuid(),
  member_id text references public.members(member_id),
  workspace_account_id uuid references public.workspace_user_accounts(id),
  active boolean not null,
  actor_member_id text not null references public.members(member_id),
  occurred_at timestamptz not null default now(),
  check ((member_id is not null) <> (workspace_account_id is not null))
);
alter table public.project_executive_attribute_events enable row level security;
revoke all on public.project_executive_attribute_events from anon, authenticated;
grant all on public.project_executive_attribute_events to service_role;

create function public.project_meeting_set_executive_attribute(
  p_target_kind text, p_target_id text, p_active boolean, p_actor_member_id text
) returns void language plpgsql security definer set search_path = public as $$
declare v_member_id text; v_account_id uuid; v_previous boolean;
begin
  if not exists (select 1 from public.members where member_id = p_actor_member_id and status = 'active' and is_admin) then
    raise exception 'admin_required';
  end if;
  if p_target_kind = 'member' then
    select is_executive into v_previous from public.members where member_id = p_target_id and status = 'active' for update;
    if not found then raise exception 'active_member_required'; end if;
    v_member_id := p_target_id;
    if v_previous is distinct from p_active then
      update public.members set is_executive = p_active, updated_at = now() where member_id = v_member_id;
    end if;
  elsif p_target_kind = 'workspace_account' then
    v_account_id := p_target_id::uuid;
    select is_executive into v_previous from public.workspace_user_accounts where id = v_account_id and status = 'active' for update;
    if not found then raise exception 'active_account_required'; end if;
    if v_previous is distinct from p_active then
      update public.workspace_user_accounts set is_executive = p_active, updated_at = now() where id = v_account_id;
    end if;
  else
    raise exception 'invalid_principal_kind';
  end if;
  if v_previous is distinct from p_active then
    insert into public.project_executive_attribute_events(member_id,workspace_account_id,active,actor_member_id)
      values(v_member_id,v_account_id,p_active,p_actor_member_id);
  end if;
end $$;
revoke all on function public.project_meeting_set_executive_attribute(text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.project_meeting_set_executive_attribute(text,text,boolean,text) to service_role;

create function public.project_meeting_has_executive_attribute(p_kind text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'member' then
    perform 1 from public.members where member_id = p_id and status = 'active' and is_executive for share;
  elsif p_kind = 'workspace_account' then
    perform 1 from public.workspace_user_accounts where id = p_id::uuid and status = 'active' and is_executive for share;
  else
    return false;
  end if;
  return found;
end
$$;
revoke all on function public.project_meeting_has_executive_attribute(text,text) from public, anon, authenticated;
grant execute on function public.project_meeting_has_executive_attribute(text,text) to service_role;

create table public.project_executive_members (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(project_id),
  member_id text references public.members(member_id),
  workspace_account_id uuid references public.workspace_user_accounts(id),
  active boolean not null default true,
  added_at timestamptz not null default now(),
  added_by_member_id text references public.members(member_id),
  removed_at timestamptz,
  removed_by_member_id text references public.members(member_id),
  check ((member_id is not null) <> (workspace_account_id is not null)),
  check ((active and removed_at is null) or (not active and removed_at is not null))
);
create unique index project_executive_members_internal_unique on public.project_executive_members(project_id, member_id) where member_id is not null;
create unique index project_executive_members_external_unique on public.project_executive_members(project_id, workspace_account_id) where workspace_account_id is not null;

create table public.project_executive_member_events (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(project_id),
  member_id text references public.members(member_id),
  workspace_account_id uuid references public.workspace_user_accounts(id),
  action text not null check (action in ('add', 'remove')),
  actor_member_id text not null references public.members(member_id),
  occurred_at timestamptz not null default now(),
  check ((member_id is not null) <> (workspace_account_id is not null))
);

create table public.project_meeting_rule_versions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(project_id),
  meeting_kind text not null check (meeting_kind in ('management', 'board')),
  version integer not null check (version > 0),
  source_title text not null check (length(btrim(source_title)) between 1 and 200),
  source_text text not null check (length(btrim(source_text)) between 20 and 100000),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  quorum_numerator integer not null check (quorum_numerator > 0),
  quorum_denominator integer not null check (quorum_denominator >= quorum_numerator),
  quorum_strict boolean not null default false,
  approval_basis text not null check (approval_basis in ('eligible', 'cast', 'non_abstain')),
  approval_numerator integer not null check (approval_numerator > 0),
  approval_denominator integer not null check (approval_denominator >= approval_numerator),
  approval_strict boolean not null default false,
  close_mode text not null check (close_mode in ('manual', 'all_cast', 'deadline')),
  manual_close_role text check (manual_close_role in ('any_executive', 'initiator', 'admin')),
  deadline_minutes integer check (deadline_minutes between 1 and 525600),
  clause_reference text not null check (length(btrim(clause_reference)) between 1 and 1000),
  published_at timestamptz not null default now(),
  published_by_member_id text not null references public.members(member_id),
  unique (project_id, meeting_kind, version),
  check ((close_mode = 'manual' and manual_close_role is not null and deadline_minutes is null)
    or (close_mode = 'deadline' and deadline_minutes is not null and manual_close_role is null)
    or (close_mode = 'all_cast' and manual_close_role is null and deadline_minutes is null))
);

create table public.project_meeting_agendas (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(project_id),
  meeting_kind text not null default 'management' check (meeting_kind in ('management', 'board')),
  title text not null check (length(btrim(title)) between 1 and 200),
  motion text not null check (length(btrim(motion)) between 1 and 20000),
  materials text not null default '' check (length(materials) <= 100000),
  proposed_by_kind text not null check (proposed_by_kind in ('member', 'workspace_account')),
  proposed_by_id text not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'cancelled')),
  rule_version_id uuid references public.project_meeting_rule_versions(id),
  opened_at timestamptz,
  opened_by_kind text check (opened_by_kind in ('member', 'workspace_account')),
  opened_by_id text,
  deadline_at timestamptz,
  closed_at timestamptz,
  outcome text check (outcome in ('approved', 'rejected', 'no_quorum')),
  cancel_reason text check (length(btrim(cancel_reason)) between 1 and 1000),
  cancelled_by_kind text check (cancelled_by_kind in ('member', 'workspace_account')),
  cancelled_by_id text,
  supersedes_agenda_id uuid references public.project_meeting_agendas(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'draft' and rule_version_id is null and opened_at is null and opened_by_kind is null and opened_by_id is null and closed_at is null and outcome is null and cancel_reason is null)
    or (status = 'open' and rule_version_id is not null and opened_at is not null and opened_by_kind is not null and opened_by_id is not null and closed_at is null and outcome is null and cancel_reason is null)
    or (status = 'closed' and rule_version_id is not null and opened_at is not null and opened_by_kind is not null and opened_by_id is not null and closed_at is not null and outcome is not null and cancel_reason is null)
    or (status = 'cancelled' and rule_version_id is not null and opened_at is not null and closed_at is not null and outcome is null and cancel_reason is not null and cancelled_by_kind is not null and cancelled_by_id is not null))
);
create index project_meeting_agendas_project_created on public.project_meeting_agendas(project_id, meeting_kind, created_at desc);

create table public.project_meeting_electorate (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.project_meeting_agendas(id),
  member_id text references public.members(member_id),
  workspace_account_id uuid references public.workspace_user_accounts(id),
  check ((member_id is not null) <> (workspace_account_id is not null))
);
create unique index project_meeting_electorate_internal_unique on public.project_meeting_electorate(agenda_id, member_id) where member_id is not null;
create unique index project_meeting_electorate_external_unique on public.project_meeting_electorate(agenda_id, workspace_account_id) where workspace_account_id is not null;

create table public.project_meeting_ballots (
  id uuid primary key default gen_random_uuid(),
  electorate_id uuid not null unique references public.project_meeting_electorate(id),
  choice text not null check (choice in ('yes', 'no', 'abstain')),
  cast_at timestamptz not null default now()
);

-- 全データはサーバの再認可済み API だけが扱う。既存の会議共有経路へは接続しない。
alter table public.project_executive_members enable row level security;
alter table public.project_executive_member_events enable row level security;
alter table public.project_meeting_rule_versions enable row level security;
alter table public.project_meeting_agendas enable row level security;
alter table public.project_meeting_electorate enable row level security;
alter table public.project_meeting_ballots enable row level security;
revoke all on public.project_executive_members, public.project_executive_member_events, public.project_meeting_rule_versions,
  public.project_meeting_agendas, public.project_meeting_electorate,
  public.project_meeting_ballots from anon, authenticated;
grant all on public.project_executive_members, public.project_executive_member_events, public.project_meeting_rule_versions,
  public.project_meeting_agendas, public.project_meeting_electorate,
  public.project_meeting_ballots to service_role;

create function public.project_meeting_guard_agenda() returns trigger language plpgsql set search_path = public as $$
begin
  if old.status in ('closed', 'cancelled') then raise exception 'closed_agenda_immutable'; end if;
  if old.status = 'open' and new.status not in ('closed', 'cancelled') then raise exception 'opened_agenda_immutable'; end if;
  if old.status <> 'draft' then
    if new.project_id is distinct from old.project_id or new.meeting_kind is distinct from old.meeting_kind
      or new.title is distinct from old.title or new.motion is distinct from old.motion
      or new.materials is distinct from old.materials or new.rule_version_id is distinct from old.rule_version_id
      or new.proposed_by_kind is distinct from old.proposed_by_kind or new.proposed_by_id is distinct from old.proposed_by_id
      or new.opened_at is distinct from old.opened_at or new.opened_by_kind is distinct from old.opened_by_kind
      or new.opened_by_id is distinct from old.opened_by_id or new.deadline_at is distinct from old.deadline_at
      or new.supersedes_agenda_id is distinct from old.supersedes_agenda_id then
      raise exception 'opened_agenda_immutable';
    end if;
  end if;
  return new;
end $$;

create trigger project_meeting_agenda_guard before update on public.project_meeting_agendas
  for each row execute function public.project_meeting_guard_agenda();

create function public.project_meeting_immutable() returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'meeting_record_immutable';
end $$;
create trigger project_meeting_agenda_delete_guard before delete on public.project_meeting_agendas
  for each row execute function public.project_meeting_immutable();
create trigger project_meeting_rule_immutable before update or delete on public.project_meeting_rule_versions
  for each row execute function public.project_meeting_immutable();
create trigger project_meeting_electorate_immutable before update or delete on public.project_meeting_electorate
  for each row execute function public.project_meeting_immutable();
create trigger project_meeting_ballot_immutable before update or delete on public.project_meeting_ballots
  for each row execute function public.project_meeting_immutable();
create trigger project_executive_member_event_immutable before update or delete on public.project_executive_member_events
  for each row execute function public.project_meeting_immutable();
create trigger project_executive_attribute_event_immutable before update or delete on public.project_executive_attribute_events
  for each row execute function public.project_meeting_immutable();

create function public.project_meeting_set_executive(
  p_project_id text, p_actor_member_id text, p_target_kind text, p_target_id text, p_active boolean
) returns void language plpgsql security definer set search_path = public as $$
declare v_member public.project_executive_members%rowtype; v_member_id text; v_account_id uuid;
begin
  if not exists (select 1 from public.members where member_id = p_actor_member_id and status = 'active' and is_admin) then
    raise exception 'admin_required';
  end if;
  if p_target_kind = 'member' then v_member_id := p_target_id;
  elsif p_target_kind = 'workspace_account' then v_account_id := p_target_id::uuid;
  else raise exception 'invalid_principal_kind'; end if;
  if p_active and not public.project_meeting_has_executive_attribute(p_target_kind, p_target_id) then
    raise exception 'executive_attribute_required';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_project_id || ':' || p_target_kind || ':' || p_target_id));
  select * into v_member from public.project_executive_members
    where project_id = p_project_id and ((member_id is not null and member_id = v_member_id)
      or (workspace_account_id is not null and workspace_account_id = v_account_id)) for update;
  if found and v_member.active = p_active then return; end if;
  if not found and not p_active then raise exception 'executive_not_found'; end if;
  if found then
    update public.project_executive_members set active = p_active,
      added_at = case when p_active then now() else added_at end,
      added_by_member_id = case when p_active then p_actor_member_id else added_by_member_id end,
      removed_at = case when p_active then null else now() end,
      removed_by_member_id = case when p_active then null else p_actor_member_id end
      where id = v_member.id;
  else
    insert into public.project_executive_members(project_id,member_id,workspace_account_id,added_by_member_id)
      values (p_project_id,v_member_id,v_account_id,p_actor_member_id);
  end if;
  insert into public.project_executive_member_events(project_id,member_id,workspace_account_id,action,actor_member_id)
    values (p_project_id,v_member_id,v_account_id,case when p_active then 'add' else 'remove' end,p_actor_member_id);
end $$;

create function public.project_meeting_publish_rule(
  p_project_id text, p_source_title text, p_source_text text, p_source_sha256 text,
  p_quorum_numerator integer, p_quorum_denominator integer, p_quorum_strict boolean,
  p_approval_basis text, p_approval_numerator integer, p_approval_denominator integer, p_approval_strict boolean,
  p_close_mode text, p_manual_close_role text, p_deadline_minutes integer,
  p_clause_reference text, p_actor_member_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_version integer;
begin
  if not exists (select 1 from public.members where member_id = p_actor_member_id and status = 'active' and is_admin) then
    raise exception 'admin_required';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_project_id || ':management-rule'));
  select coalesce(max(version), 0) + 1 into v_version from public.project_meeting_rule_versions
    where project_id = p_project_id and meeting_kind = 'management';
  insert into public.project_meeting_rule_versions (
    project_id, meeting_kind, version, source_title, source_text, source_sha256,
    quorum_numerator, quorum_denominator, quorum_strict, approval_basis, approval_numerator, approval_denominator, approval_strict,
    close_mode, manual_close_role, deadline_minutes, clause_reference, published_by_member_id
  ) values (
    p_project_id, 'management', v_version, p_source_title, p_source_text, p_source_sha256,
    p_quorum_numerator, p_quorum_denominator, p_quorum_strict, p_approval_basis, p_approval_numerator, p_approval_denominator, p_approval_strict,
    p_close_mode, p_manual_close_role, p_deadline_minutes, p_clause_reference, p_actor_member_id
  ) returning id into v_id;
  return v_id;
end $$;

create function public.project_meeting_start_vote(p_agenda_id uuid, p_actor_kind text, p_actor_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_agenda public.project_meeting_agendas%rowtype; v_rule public.project_meeting_rule_versions%rowtype; v_count integer;
begin
  select * into v_agenda from public.project_meeting_agendas where id = p_agenda_id for update;
  if not found or v_agenda.status <> 'draft' or v_agenda.meeting_kind <> 'management' then raise exception 'agenda_not_draft'; end if;
  perform id from public.project_executive_members where project_id = v_agenda.project_id and active for share;
  if not exists (select 1 from public.project_executive_members e where e.project_id = v_agenda.project_id and e.active
    and ((p_actor_kind = 'member' and e.member_id = p_actor_id)
      or (p_actor_kind = 'workspace_account' and e.workspace_account_id::text = p_actor_id)))
    or not public.project_meeting_has_executive_attribute(p_actor_kind, p_actor_id) then
    raise exception 'executive_required';
  end if;
  select * into v_rule from public.project_meeting_rule_versions
    where project_id = v_agenda.project_id and meeting_kind = 'management' order by version desc limit 1;
  if not found then raise exception 'rule_required'; end if;
  insert into public.project_meeting_electorate(agenda_id, member_id, workspace_account_id)
    select p_agenda_id, e.member_id, e.workspace_account_id from public.project_executive_members e
    left join public.members m on m.member_id = e.member_id
    left join public.workspace_user_accounts a on a.id = e.workspace_account_id
    where e.project_id = v_agenda.project_id and e.active
      and ((e.member_id is not null and m.status = 'active' and m.is_executive and (
        m.is_admin or m.os_access_scope <> 'project'
        or exists (select 1 from public.project_members pm where pm.member_id = e.member_id and pm.project_id = e.project_id and pm.is_active)
        or exists (select 1 from public.project_surface_member_permissions sp where sp.member_id = e.member_id
          and sp.project_id = e.project_id and sp.surface in ('cockpit', 'workspace')))
        or (e.workspace_account_id is not null and a.status = 'active' and a.is_executive and exists (
          select 1 from public.project_access_memberships pam where pam.project_id = e.project_id
            and pam.user_account_id = e.workspace_account_id and pam.status = 'active'))));
  select count(*) into v_count from public.project_meeting_electorate where agenda_id = p_agenda_id;
  if v_count = 0 then raise exception 'no_eligible_voters'; end if;
  update public.project_meeting_agendas set status = 'open', rule_version_id = v_rule.id,
    opened_at = now(), opened_by_kind = p_actor_kind, opened_by_id = p_actor_id,
    deadline_at = case when v_rule.close_mode = 'deadline' then now() + make_interval(mins => v_rule.deadline_minutes) else null end,
    updated_at = now() where id = p_agenda_id;
  return p_agenda_id;
end $$;

create function public.project_meeting_finish_vote(p_agenda_id uuid, p_actor_kind text default null, p_actor_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_agenda public.project_meeting_agendas%rowtype; v_rule public.project_meeting_rule_versions%rowtype; v_roster_id uuid;
  v_eligible integer; v_cast integer; v_yes integer; v_no integer; v_basis integer; v_outcome text;
begin
  select * into v_agenda from public.project_meeting_agendas where id = p_agenda_id for update;
  if not found then raise exception 'agenda_not_found'; end if;
  if v_agenda.status = 'closed' then return v_agenda.outcome; end if;
  if v_agenda.status <> 'open' then raise exception 'vote_not_open'; end if;
  select * into v_rule from public.project_meeting_rule_versions where id = v_agenda.rule_version_id;
  select count(*), count(b.id), count(b.id) filter (where b.choice = 'yes'), count(b.id) filter (where b.choice = 'no')
    into v_eligible, v_cast, v_yes, v_no from public.project_meeting_electorate e
    left join public.project_meeting_ballots b on b.electorate_id = e.id where e.agenda_id = p_agenda_id;
  if v_rule.close_mode = 'all_cast' and v_cast < v_eligible then raise exception 'not_all_cast'; end if;
  if v_rule.close_mode = 'deadline' and now() < v_agenda.deadline_at then raise exception 'deadline_not_reached'; end if;
  if v_rule.close_mode = 'manual' then
    if not public.project_meeting_has_executive_attribute(p_actor_kind, p_actor_id) then raise exception 'executive_attribute_required'; end if;
    select id into v_roster_id from public.project_executive_members e where e.project_id = v_agenda.project_id and e.active
      and ((p_actor_kind = 'member' and e.member_id = p_actor_id)
        or (p_actor_kind = 'workspace_account' and e.workspace_account_id::text = p_actor_id)) for share;
    if not found then raise exception 'executive_required'; end if;
    if v_rule.manual_close_role = 'initiator' and (v_agenda.opened_by_kind <> p_actor_kind or v_agenda.opened_by_id <> p_actor_id) then
      raise exception 'initiator_required';
    end if;
    if v_rule.manual_close_role = 'admin' and not exists (
      select 1 from public.members where member_id = p_actor_id and p_actor_kind = 'member' and status = 'active' and is_admin
    ) then raise exception 'admin_required'; end if;
  end if;
  if (v_rule.quorum_strict and v_cast * v_rule.quorum_denominator <= v_eligible * v_rule.quorum_numerator)
    or (not v_rule.quorum_strict and v_cast * v_rule.quorum_denominator < v_eligible * v_rule.quorum_numerator) then
    v_outcome := 'no_quorum';
  else
    v_basis := case v_rule.approval_basis when 'eligible' then v_eligible when 'cast' then v_cast else v_yes + v_no end;
    v_outcome := case when v_yes > 0 and (
      (v_rule.approval_strict and v_yes * v_rule.approval_denominator > v_basis * v_rule.approval_numerator)
      or (not v_rule.approval_strict and v_yes * v_rule.approval_denominator >= v_basis * v_rule.approval_numerator))
      then 'approved' else 'rejected' end;
  end if;
  update public.project_meeting_agendas set status = 'closed', outcome = v_outcome, closed_at = now(), updated_at = now()
    where id = p_agenda_id;
  return v_outcome;
end $$;

create function public.project_meeting_cast_vote(p_agenda_id uuid, p_actor_kind text, p_actor_id text, p_choice text)
returns text language plpgsql security definer set search_path = public as $$
declare v_agenda public.project_meeting_agendas%rowtype; v_rule public.project_meeting_rule_versions%rowtype; v_electorate_id uuid; v_roster_id uuid;
  v_eligible integer; v_cast integer;
begin
  if p_choice not in ('yes', 'no', 'abstain') then raise exception 'invalid_choice'; end if;
  select * into v_agenda from public.project_meeting_agendas where id = p_agenda_id for update;
  if not found or v_agenda.status <> 'open' then raise exception 'vote_not_open'; end if;
  select * into v_rule from public.project_meeting_rule_versions where id = v_agenda.rule_version_id;
  if v_rule.close_mode = 'deadline' and now() >= v_agenda.deadline_at then
    raise exception 'deadline_reached';
  end if;
  if not public.project_meeting_has_executive_attribute(p_actor_kind, p_actor_id) then raise exception 'executive_attribute_required'; end if;
  select id into v_roster_id from public.project_executive_members e where e.project_id = v_agenda.project_id and e.active
    and ((p_actor_kind = 'member' and e.member_id = p_actor_id)
      or (p_actor_kind = 'workspace_account' and e.workspace_account_id::text = p_actor_id)) for share;
  if not found then raise exception 'executive_required'; end if;
  select id into v_electorate_id from public.project_meeting_electorate where agenda_id = p_agenda_id
    and ((p_actor_kind = 'member' and member_id = p_actor_id)
      or (p_actor_kind = 'workspace_account' and workspace_account_id::text = p_actor_id));
  if not found then raise exception 'not_in_electorate'; end if;
  insert into public.project_meeting_ballots(electorate_id, choice) values (v_electorate_id, p_choice);
  if v_rule.close_mode = 'all_cast' then
    select count(*), count(b.id) into v_eligible, v_cast from public.project_meeting_electorate e
      left join public.project_meeting_ballots b on b.electorate_id = e.id where e.agenda_id = p_agenda_id;
    if v_cast = v_eligible then return public.project_meeting_finish_vote(p_agenda_id); end if;
  end if;
  return 'recorded';
end $$;

create function public.project_meeting_cancel_vote(p_agenda_id uuid, p_actor_member_id text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_agenda public.project_meeting_agendas%rowtype; v_roster_id uuid;
begin
  if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'reason_required'; end if;
  select * into v_agenda from public.project_meeting_agendas where id = p_agenda_id for update;
  if not found or v_agenda.status <> 'open' or v_agenda.meeting_kind <> 'management' then raise exception 'vote_not_open'; end if;
  if not exists (select 1 from public.members where member_id = p_actor_member_id and status = 'active' and is_admin) then
    raise exception 'admin_required';
  end if;
  if not public.project_meeting_has_executive_attribute('member', p_actor_member_id) then raise exception 'executive_attribute_required'; end if;
  select id into v_roster_id from public.project_executive_members where project_id = v_agenda.project_id
    and member_id = p_actor_member_id and active for share;
  if not found then raise exception 'executive_required'; end if;
  update public.project_meeting_agendas set status = 'cancelled', closed_at = now(),
    cancel_reason = btrim(p_reason), cancelled_by_kind = 'member', cancelled_by_id = p_actor_member_id,
    updated_at = now() where id = p_agenda_id;
end $$;

revoke all on function public.project_meeting_set_executive(text,text,text,text,boolean) from public, anon, authenticated;
revoke all on function public.project_meeting_publish_rule(text,text,text,text,integer,integer,boolean,text,integer,integer,boolean,text,text,integer,text,text) from public, anon, authenticated;
revoke all on function public.project_meeting_start_vote(uuid,text,text) from public, anon, authenticated;
revoke all on function public.project_meeting_finish_vote(uuid,text,text) from public, anon, authenticated;
revoke all on function public.project_meeting_cast_vote(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.project_meeting_cancel_vote(uuid,text,text) from public, anon, authenticated;
grant execute on function public.project_meeting_set_executive(text,text,text,text,boolean) to service_role;
grant execute on function public.project_meeting_publish_rule(text,text,text,text,integer,integer,boolean,text,integer,integer,boolean,text,text,integer,text,text) to service_role;
grant execute on function public.project_meeting_start_vote(uuid,text,text) to service_role;
grant execute on function public.project_meeting_finish_vote(uuid,text,text) to service_role;
grant execute on function public.project_meeting_cast_vote(uuid,text,text,text) to service_role;
grant execute on function public.project_meeting_cancel_vote(uuid,text,text) to service_role;
