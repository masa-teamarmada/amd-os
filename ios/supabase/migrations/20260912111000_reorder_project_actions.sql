-- タスクの並べ替えを1回で確定する。
-- ふだんは動かした1行の sort_order を前後の中点にするだけで済むが、中点が潰れたときは
-- 全体を振り直す必要がある。1件ずつ更新すると、52件のPJで52往復して並びが途中で
-- 見えてしまう（2026-09-12 実測）。1トランザクションでまとめる。
create or replace function public.reorder_project_actions(
  p_project_id text,
  p_ordered_ids uuid[],
  p_changed_by text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_index integer := 0;
  v_updated integer := 0;
begin
  if p_project_id is null or btrim(p_project_id) = '' then
    raise exception 'PJが指定されていないよ';
  end if;
  if p_ordered_ids is null or array_length(p_ordered_ids, 1) is null then
    return 0;
  end if;
  if array_length(p_ordered_ids, 1) > 500 then
    raise exception '1回に並べ替えられるのは500件までだよ';
  end if;

  foreach v_id in array p_ordered_ids loop
    v_index := v_index + 1;
    update public.project_actions
       set sort_order = v_index * 10,
           updated_by = coalesce(p_changed_by, updated_by),
           last_verified_at = current_date
     where id = v_id
       and project_id = p_project_id
       and deleted_at is null;
    if found then v_updated := v_updated + 1; end if;
  end loop;

  return v_updated;
end;
$$;

revoke all on function public.reorder_project_actions(text, uuid[], text) from public;
grant execute on function public.reorder_project_actions(text, uuid[], text) to service_role;
