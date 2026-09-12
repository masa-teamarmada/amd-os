-- タスクの手動並べ替えが1行の更新で済むように、並び順を一意にする。
-- いまは28件が 0 で同値のため「前後の中点」が取れず、動かすたびに全件を
-- 振り直す経路に落ちて、並びが総入れ替えになっていた（2026-09-12 実測）。
-- 現在の並び（sort_order, id の順）はそのまま保ち、10刻みへ振り直すだけ。
with ordered as (
  select id,
         (row_number() over (partition by project_id order by sort_order, id)) * 10 as new_order
  from public.project_actions
  where deleted_at is null
)
update public.project_actions t
   set sort_order = o.new_order
  from ordered o
 where t.id = o.id
   and t.sort_order is distinct from o.new_order;
