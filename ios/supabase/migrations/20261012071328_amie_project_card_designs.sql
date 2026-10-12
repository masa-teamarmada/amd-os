-- Self-authored PJ cards, separate from received-card OCR. Mutations go through an authorized API.
create table public.project_card_designs (
 design_id uuid primary key default gen_random_uuid(),
 owner_project_id text not null references public.projects(project_id),
 holder_label text not null check(length(holder_label) between 1 and 120),
 holder_key text not null,
 variant_key text not null,
 brand_label text not null,
 latest_draft_version_id uuid,
 latest_approved_version_id uuid,
 version integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_project_id,holder_key,variant_key)
);
create table public.project_card_design_versions (
 version_id uuid primary key default gen_random_uuid(),
 design_id uuid not null references public.project_card_designs(design_id),
 version_no integer not null,
 revision_label text not null,
 status text not null check(status in ('draft','review','approved','superseded')),
 request_key uuid not null unique,
 note text not null default '',
 print_spec jsonb not null default '{}'::jsonb,
 order_record jsonb not null default '{}'::jsonb,
 approved_at timestamptz,
 approved_by text,
 created_by text,
 created_at timestamptz not null default now(),
 unique(design_id,version_no), unique(design_id,version_id)
);
alter table public.project_card_designs add constraint project_card_draft_same_design
 foreign key(design_id,latest_draft_version_id) references public.project_card_design_versions(design_id,version_id) deferrable initially deferred;
alter table public.project_card_designs add constraint project_card_approved_same_design
 foreign key(design_id,latest_approved_version_id) references public.project_card_design_versions(design_id,version_id) deferrable initially deferred;
create table public.project_card_design_projects (
 design_id uuid not null references public.project_card_designs(design_id),
 project_id text not null references public.projects(project_id),
 primary key(design_id,project_id)
);
create table public.project_card_design_assets (
 asset_id uuid primary key default gen_random_uuid(),
 version_id uuid not null references public.project_card_design_versions(version_id),
 project_id text not null references public.projects(project_id),
 role text not null check(role in ('preview','front_print','back_print','editable','source_zip','spec','order_evidence')),
 drive_file_id text not null check(drive_file_id ~ '^[A-Za-z0-9_-]+$'),
 drive_folder_id text not null,
 file_name text not null,
 mime_type text not null,
 byte_size bigint not null default 0,
 sha256 text check(sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
 storage_bucket text,
 storage_path text,
 checked_at timestamptz not null default now(),
 unique(version_id,role,project_id),
 check((storage_bucket is null)=(storage_path is null))
);
create index project_card_project_lookup on public.project_card_design_projects(project_id,design_id);
create index project_card_asset_lookup on public.project_card_design_assets(version_id);

-- This helper only resolves the caller's internal membership, never a user-supplied principal.
create function public.amie_card_project_read(p_project_id text) returns boolean
 language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists (
  select 1 from public.members m where m.member_id=public.current_member_id()
   and (m.is_admin or coalesce(m.os_access_scope,'portfolio')='portfolio'
    or exists(select 1 from public.project_surface_member_permissions g where g.member_id=m.member_id and g.project_id=p_project_id and g.surface='cockpit'))
 );
$$;
revoke all on function public.amie_card_project_read(text) from public,anon;
grant execute on function public.amie_card_project_read(text) to authenticated,service_role;

alter table public.project_card_designs enable row level security;
alter table public.project_card_design_versions enable row level security;
alter table public.project_card_design_projects enable row level security;
alter table public.project_card_design_assets enable row level security;
revoke all on public.project_card_designs,public.project_card_design_versions,public.project_card_design_projects,public.project_card_design_assets from anon,authenticated;
grant select on public.project_card_designs,public.project_card_design_versions,public.project_card_design_projects,public.project_card_design_assets to authenticated;
grant all on public.project_card_designs,public.project_card_design_versions,public.project_card_design_projects,public.project_card_design_assets to service_role;
create policy card_design_read on public.project_card_designs for select to authenticated using(public.amie_card_project_read(owner_project_id));
create policy card_version_read on public.project_card_design_versions for select to authenticated using(exists(select 1 from public.project_card_designs d where d.design_id=project_card_design_versions.design_id));
create policy card_link_read on public.project_card_design_projects for select to authenticated using(public.amie_card_project_read(project_id) and exists(select 1 from public.project_card_designs d where d.design_id=project_card_design_projects.design_id));
create policy card_asset_read on public.project_card_design_assets for select to authenticated using(public.amie_card_project_read(project_id) and exists(select 1 from public.project_card_design_versions v where v.version_id=project_card_design_assets.version_id));

create function public.amie_save_card_version(p jsonb) returns jsonb
 language plpgsql security invoker set search_path=public as $$
declare d public.project_card_designs; v public.project_card_design_versions; a jsonb; pid text; k uuid := (p->>'request_key')::uuid;
begin
 select vv.* into v from public.project_card_design_versions vv join public.project_card_designs dd using(design_id)
 where vv.request_key=k and dd.owner_project_id=p->>'owner_project_id' and dd.holder_key=p->>'holder_key' and dd.variant_key=p->>'variant_key';
 if found then return jsonb_build_object('design_id',v.design_id,'version_id',v.version_id,'replayed',true); end if;
 insert into public.project_card_designs(owner_project_id,holder_label,holder_key,variant_key,brand_label)
 values(p->>'owner_project_id',p->>'holder_label',p->>'holder_key',p->>'variant_key',p->>'brand_label') on conflict do nothing;
 select * into strict d from public.project_card_designs where owner_project_id=p->>'owner_project_id' and holder_key=p->>'holder_key' and variant_key=p->>'variant_key' for update;
 if d.version <> (p->>'expected_version')::int then raise exception 'card version conflict' using errcode='40001'; end if;
 if p->>'status' not in ('draft','review','approved') then raise exception 'invalid status'; end if;
 if jsonb_array_length(p->'assets')=0 then raise exception 'assets required'; end if;
 if p->>'status'='approved' and not (p->'assets' @> '[{"role":"preview"}]'::jsonb and p->'assets' @> '[{"role":"front_print"}]'::jsonb and p->'assets' @> '[{"role":"back_print"}]'::jsonb) then raise exception 'print assets required'; end if;
 insert into public.project_card_design_versions(design_id,version_no,revision_label,status,request_key,note,print_spec,order_record,created_by,approved_at,approved_by,created_at)
 values(d.design_id,d.version+1,p->>'revision_label',p->>'status',k,coalesce(p->>'note',''),coalesce(p->'print_spec','{}'),coalesce(p->'order_record','{}'),p->>'actor',case when p->>'status'='approved' then coalesce((p->>'approved_at')::timestamptz,now()) end,case when p->>'status'='approved' then p->>'actor' end,coalesce((p->>'created_at')::timestamptz,now())) returning * into v;
 for a in select value from jsonb_array_elements(p->'assets') loop
  insert into public.project_card_design_assets(version_id,project_id,role,drive_file_id,drive_folder_id,file_name,mime_type,byte_size,sha256,storage_bucket,storage_path)
  values(v.version_id,a->>'project_id',a->>'role',a->>'drive_file_id',a->>'drive_folder_id',a->>'file_name',a->>'mime_type',coalesce((a->>'byte_size')::bigint,0),a->>'sha256',a->>'storage_bucket',a->>'storage_path');
 end loop;
 insert into public.project_card_design_projects values(d.design_id,d.owner_project_id) on conflict do nothing;
 for pid in select jsonb_array_elements_text(coalesce(p->'related_project_ids','[]')) loop
  insert into public.project_card_design_projects values(d.design_id,pid) on conflict do nothing;
 end loop;
 update public.project_card_designs set latest_draft_version_id=v.version_id,latest_approved_version_id=case when v.status='approved' then v.version_id else latest_approved_version_id end,version=v.version_no,updated_at=now() where design_id=d.design_id;
 return jsonb_build_object('design_id',d.design_id,'version_id',v.version_id,'replayed',false);
end;
$$;
revoke all on function public.amie_save_card_version(jsonb) from public,anon,authenticated;
grant execute on function public.amie_save_card_version(jsonb) to service_role;

create function public.amie_approve_card_version(p_design_id uuid,p_version_id uuid,p_expected integer,p_actor text) returns void
 language plpgsql security invoker set search_path=public as $$
declare d public.project_card_designs; v public.project_card_design_versions;
begin
 select * into strict d from public.project_card_designs where design_id=p_design_id for update;
 if d.version<>p_expected then raise exception 'card version conflict' using errcode='40001'; end if;
 select * into strict v from public.project_card_design_versions where version_id=p_version_id and design_id=p_design_id;
 if v.status='approved' and d.latest_approved_version_id=p_version_id then return; end if;
 if v.status not in ('draft','review') then raise exception 'version cannot be approved'; end if;
 if not exists(select 1 from public.project_card_design_assets where version_id=p_version_id and role='preview') or not exists(select 1 from public.project_card_design_assets where version_id=p_version_id and role='front_print') or not exists(select 1 from public.project_card_design_assets where version_id=p_version_id and role='back_print') then raise exception 'print assets required'; end if;
 update public.project_card_design_versions set status='approved',approved_at=now(),approved_by=p_actor where version_id=p_version_id;
 update public.project_card_designs set latest_approved_version_id=p_version_id,version=version+1,updated_at=now() where design_id=p_design_id;
end;
$$;
revoke all on function public.amie_approve_card_version(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.amie_approve_card_version(uuid,uuid,integer,text) to service_role;
