-- 446: SOL（p21）の「PJの基本事実」の法人設立日を 2027-04-01 にそろえる（2026-09-17 まさ「設立は20270401」）。
--   project_knowledge の基本事実は project_ventures から sync-pj-facts が作るが、その自動実行は止まっている（design/AUTOMATIONS.md）。
--   migration 445 で founded_at を 2027-04-01 にしたので、同じ値へこの1行だけ直す（ほかの PJ・ほかの事実は触らない）。
-- 書き換える値が変わっていたら、何も書かずに止まる。
begin;
do $do$ begin
  if (select count(*) from project_knowledge where project_id = $t$p21$t$ and source = $t$pj_basic_facts_sync$t$ and entity_name = $t$法人設立日$t$ and status = $t$active$t$) <> 1 then raise exception 'p21 の法人設立日の基本事実が1件でない'; end if;
  if (select fact_text from project_knowledge where project_id = $t$p21$t$ and source = $t$pj_basic_facts_sync$t$ and entity_name = $t$法人設立日$t$ and status = $t$active$t$) is distinct from $t$2027-02-01$t$ then raise exception 'p21 の法人設立日の基本事実が 2027-02-01 でない'; end if;
  if (select founded_at from project_ventures where project_id = $t$p21$t$) is distinct from date $t$2027-04-01$t$ then raise exception '先に 445 を当てる（founded_at が 2027-04-01 でない）'; end if;
end $do$;
update project_knowledge set fact_text = $t$2027-04-01$t$, updated_at = now()
where project_id = $t$p21$t$ and source = $t$pj_basic_facts_sync$t$ and entity_name = $t$法人設立日$t$ and status = $t$active$t$;
do $do$ begin
  if (select fact_text from project_knowledge where project_id = $t$p21$t$ and source = $t$pj_basic_facts_sync$t$ and entity_name = $t$法人設立日$t$ and status = $t$active$t$) is distinct from $t$2027-04-01$t$ then raise exception '法人設立日が 2027-04-01 になっていない'; end if;
end $do$;
commit;
