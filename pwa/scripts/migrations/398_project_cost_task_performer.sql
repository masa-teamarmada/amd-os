-- 398: コスト試算の作業に「誰がやるか」を持たせる（2026-09-14 まさFB）
--
-- 顧客工場での処理の運転は顧客がやる作業で、SX の原価には入れない（まさ「全顧客の工場にSXの社員が張り付くってありえない」）。
-- 作業ごとに誰がやるかを持ち、計算エンジンは SX がやる作業だけを SX の原価に入れる。顧客がやる作業は工数だけを出す。
--   sx       … SX がやる（既定）
--   customer … 顧客がやる
--   site     … 処理する場所の人がやる。オンサイトは顧客、オフサイトは SX（処理の運転など）
-- 菌体の製造拠点（scenario = '中央培養'）の作業は SX がやるものだけを許す。
--
-- 列を足すだけで、既存の行は既定の sx になる。SX のデータの組み替えは 399。
-- 計算は pwa/src/lib/project-cost-model.ts。仕様は pwa/spec/5-13-project-cost-model-current-spec.md。

begin;

alter table project_cost_tasks add column if not exists performer text not null default 'sx';

alter table project_cost_tasks drop constraint if exists project_cost_tasks_performer_check;
alter table project_cost_tasks add constraint project_cost_tasks_performer_check
  check (performer in ('sx', 'customer', 'site'));

alter table project_cost_tasks drop constraint if exists project_cost_tasks_central_performer_check;
alter table project_cost_tasks add constraint project_cost_tasks_central_performer_check
  check (scenario <> '中央培養' or performer = 'sx');

comment on column project_cost_tasks.performer is '誰がやるか。sx=SX / customer=顧客（SXの原価に入れない）/ site=処理する場所の人（オンサイトは顧客、オフサイトはSX）。migration 398';

commit;
