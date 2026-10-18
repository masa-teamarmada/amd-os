-- Commit one authoring change, version and audit in a single transaction.
create or replace function public.dd_report_commit_change(
  p_edition_id uuid,p_expected_revision integer,p_actor text,p_kind text,
  p_before jsonb,p_after jsonb,p_chapter_id uuid default null,
  p_chapter_revision integer default null,p_body jsonb default null
) returns integer
language plpgsql security invoker set search_path=public
as $$
declare current_revision integer;
begin
  select revision into current_revision from public.dd_report_editions where id=p_edition_id for update;
  if current_revision is null or current_revision<>p_expected_revision then
    raise exception 'report_revision_conflict' using errcode='40001';
  end if;
  if p_kind='inputs' then
    update public.dd_report_editions set input_overrides=p_after where id=p_edition_id;
  elsif p_kind='chapter' then
    update public.dd_report_chapters set body=p_body,revision=revision+1,updated_at=now()
      where id=p_chapter_id and edition_id=p_edition_id and revision=p_chapter_revision;
    if not found then raise exception 'chapter_revision_conflict' using errcode='40001'; end if;
  else raise exception 'invalid_change_kind'; end if;
  update public.dd_report_editions set revision=revision+1,updated_at=now() where id=p_edition_id;
  insert into public.dd_report_changes(edition_id,chapter_id,actor_member_id,change_kind,before_value,after_value)
    values(p_edition_id,p_chapter_id,p_actor,p_kind,p_before,p_after);
  return current_revision+1;
end;
$$;
revoke all on function public.dd_report_commit_change(uuid,integer,text,text,jsonb,jsonb,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.dd_report_commit_change(uuid,integer,text,text,jsonb,jsonb,uuid,integer,jsonb) to service_role;
