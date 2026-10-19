-- DD release identifiers are independent of the application build and import source.
alter table public.dd_report_editions add column document_version text;
alter table public.dd_report_editions add constraint dd_document_version_semver
  check(document_version is null or document_version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$');

create table public.dd_report_releases (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.dd_report_editions(id),
  document_version text not null,
  revision integer not null,
  summary text not null,
  created_at timestamptz not null default now(),
  unique(edition_id,document_version)
);
create index dd_report_releases_edition_idx on public.dd_report_releases(edition_id,created_at desc);
alter table public.dd_report_releases enable row level security;
revoke all on public.dd_report_releases from public,anon,authenticated;
grant select,insert on public.dd_report_releases to service_role;

create function public.amie_dd_document_version_before_update() returns trigger
language plpgsql security invoker set search_path=public as $$
declare old_parts integer[]; new_parts integer[];
begin
  if old.document_version is not null then
    old_parts=string_to_array(old.document_version,'.')::integer[];
    if new.document_version is null then raise exception 'dd_document_version_required'; end if;
    if new.revision<old.revision then raise exception 'report_revision_conflict' using errcode='40001'; end if;
    if new.revision>old.revision and new.document_version=old.document_version then
      new.document_version=old_parts[1]||'.'||old_parts[2]||'.'||(old_parts[3]+1);
    end if;
    new_parts=string_to_array(new.document_version,'.')::integer[];
    if new_parts<old_parts then raise exception 'dd_document_version_must_increase'; end if;
  end if;
  return new;
end; $$;

create function public.amie_dd_document_release_after_update() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if new.document_version is not null and new.document_version is distinct from old.document_version then
    insert into public.dd_report_releases(edition_id,document_version,revision,summary)
      values(new.id,new.document_version,new.revision,
        coalesce(nullif(current_setting('app.dd_document_change_summary',true),''),'DD資料の本文・図表・計算条件を更新'));
  end if;
  return new;
end; $$;
revoke all on function public.amie_dd_document_version_before_update() from public,anon,authenticated;
revoke all on function public.amie_dd_document_release_after_update() from public,anon,authenticated;
grant execute on function public.amie_dd_document_version_before_update(),public.amie_dd_document_release_after_update() to service_role;
create trigger amie_dd_document_version before update on public.dd_report_editions
  for each row execute function public.amie_dd_document_version_before_update();
create trigger amie_dd_document_release after update on public.dd_report_editions
  for each row execute function public.amie_dd_document_release_after_update();

-- Existing updates keep their locking and audit contract; the release log joins that transaction.
create or replace function public.dd_report_commit_change(
  p_edition_id uuid,p_expected_revision integer,p_actor text,p_kind text,
  p_before jsonb,p_after jsonb,p_chapter_id uuid default null,
  p_chapter_revision integer default null,p_body jsonb default null
) returns integer
language plpgsql security invoker set search_path=public as $$
declare current_revision integer;
begin
  select revision into current_revision from public.dd_report_editions where id=p_edition_id for update;
  if current_revision is null or current_revision<>p_expected_revision then
    raise exception 'report_revision_conflict' using errcode='40001';
  end if;
  if p_kind='inputs' then
    update public.dd_report_editions set input_overrides=p_after where id=p_edition_id;
  elsif p_kind='glossary' then
    if jsonb_typeof(p_after)<>'object' then raise exception 'invalid_glossary'; end if;
    update public.dd_report_editions set glossary=p_after where id=p_edition_id;
  elsif p_kind='chapter' then
    update public.dd_report_chapters set body=p_body,revision=revision+1,updated_at=now()
      where id=p_chapter_id and edition_id=p_edition_id and revision=p_chapter_revision;
    if not found then raise exception 'chapter_revision_conflict' using errcode='40001'; end if;
  else raise exception 'invalid_change_kind'; end if;
  perform set_config('app.dd_document_change_summary',case p_kind
    when 'inputs' then '数値計画の入力条件を更新'
    when 'glossary' then '専門用語の説明を更新'
    else '資料本文を更新' end,true);
  update public.dd_report_editions set revision=revision+1,updated_at=now() where id=p_edition_id;
  insert into public.dd_report_changes(edition_id,chapter_id,actor_member_id,change_kind,before_value,after_value)
    values(p_edition_id,p_chapter_id,p_actor,p_kind,p_before,p_after);
  return current_revision+1;
end; $$;
revoke all on function public.dd_report_commit_change(uuid,integer,text,text,jsonb,jsonb,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.dd_report_commit_change(uuid,integer,text,text,jsonb,jsonb,uuid,integer,jsonb) to service_role;

select set_config('app.dd_document_change_summary','DD資料を全面改訂。事業・技術開発計画、本文・図解、数値計画・一覧表を再構成し、PDFとExcelを同じ版で提供。',true);
update public.dd_report_editions e set document_version='2.0.0'
from public.dd_packages p where p.id=e.package_id and p.slug='sol' and e.status='published' and e.document_version is null;
