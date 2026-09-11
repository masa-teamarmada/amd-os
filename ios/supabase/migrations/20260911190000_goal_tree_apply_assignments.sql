-- ゴールツリー: 割り振りをまとめて書き込む
-- 正本: pwa/spec/3-22-goal-tree-plan.md §4（会議後 = えいみと対話で割り振り、その場で確定する）
--
-- 担当・期限・見積ptは、まさかPMがセッションでえいみと決め、えいみがOSへ書き込む。
-- 1件ずつのPATCHを何十回も投げると、途中で落ちたときに half-applied が残る。
-- 1トランザクションで全部入るか、何も入らないかにする。
--
-- 渡し方（p_items は配列）
--   [{ "action_id": "...", "planned_start": "2026-10-01", "planned_end": "2026-10-31",
--      "estimated_pt": 1.5, "member_ids": ["ID003"] }]
--   キーが無い項目は触らない。null を明示すると消す。member_ids を渡すと担当を入れ替える。

create or replace function public.apply_goal_tree_assignments(
  p_project_id text,
  p_items jsonb,
  p_changed_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_action_id uuid;
  v_member_id text;
  v_updated integer := 0;
  v_owner_rows integer := 0;
  v_touched integer := 0;
begin
  if p_project_id is null or btrim(p_project_id) = '' then
    raise exception 'PJが指定されていないよ';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception '割り当ては配列で渡してね';
  end if;
  if jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('updated', 0, 'owner_rows', 0);
  end if;
  -- 1回の割り振りセッションで扱う量の上限。これを超えるならPJを分ける。
  if jsonb_array_length(p_items) > 200 then
    raise exception '1回に渡せるのは200件までだよ（いまは%件）', jsonb_array_length(p_items);
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_action_id := nullif(v_item->>'action_id', '')::uuid;
    if v_action_id is null then
      raise exception 'action_id が空の項目があるよ';
    end if;

    -- 別PJのTODOや消したTODOを、まとめ書き込みで触らせない。
    if not exists (
      select 1 from public.project_actions
       where id = v_action_id and project_id = p_project_id and deleted_at is null
    ) then
      raise exception 'このPJに無いTODOが混ざってるよ: %', v_action_id;
    end if;

    update public.project_actions
       set planned_start = case when v_item ? 'planned_start'
                                then nullif(v_item->>'planned_start', '')::date
                                else planned_start end,
           planned_end   = case when v_item ? 'planned_end'
                                then nullif(v_item->>'planned_end', '')::date
                                else planned_end end,
           estimated_pt  = case when v_item ? 'estimated_pt'
                                then nullif(v_item->>'estimated_pt', '')::numeric
                                else estimated_pt end,
           last_verified_at = current_date,
           updated_by = coalesce(p_changed_by, updated_by),
           version = version + 1
     where id = v_action_id;
    v_updated := v_updated + 1;

    -- 担当は「渡されたら入れ替え」。キーが無ければ触らない。
    if v_item ? 'member_ids' then
      if jsonb_typeof(v_item->'member_ids') <> 'array' then
        raise exception 'member_ids は配列で渡してね（%）', v_action_id;
      end if;
      delete from public.project_action_owners o where o.action_id = v_action_id;
      for v_member_id in select jsonb_array_elements_text(v_item->'member_ids') loop
        if not exists (select 1 from public.members m where m.member_id = v_member_id) then
          raise exception '名簿に無い人が混ざってるよ: %', v_member_id;
        end if;
        insert into public.project_action_owners (project_id, action_id, member_id, created_by)
        values (p_project_id, v_action_id, v_member_id, p_changed_by)
        on conflict (action_id, member_id) do nothing;
        v_owner_rows := v_owner_rows + 1;
      end loop;
    end if;

    v_touched := v_touched + 1;
  end loop;

  return jsonb_build_object('updated', v_updated, 'owner_rows', v_owner_rows, 'items', v_touched);
end;
$$;

revoke all on function public.apply_goal_tree_assignments(text, jsonb, text) from public;
grant execute on function public.apply_goal_tree_assignments(text, jsonb, text) to service_role;
