-- 402: コスト試算の明細に「誰が持つか」を持たせる（2026-09-14 まさFB）
--
-- 顧客工場に置くリアクター（処理設備）は顧客が買う（まさ「リアクターは顧客が買う前提だよ」）。
-- 顧客工場で出る汚泥の処分も顧客がやる（まさ「これは顧客側がやることじゃないの？なんでSX側がやることになってるの？」）。
-- 明細ごとに誰が持つかを持ち、計算エンジンは SX が持つ明細だけを SX の原価に入れる。値と意味は作業の performer（migration 398）と同じ。
--   sx       … SX が持つ（既定）
--   customer … 顧客が持つ
--   site     … 処理する場所の持ち主。オンサイトは顧客、オフサイトは SX（SX工場の設備・処分）
-- 菌体の製造拠点（scenario = '中央培養'）の明細は SX が持つものだけを許す。
--
-- 列を足すだけで、既存の行は既定の sx になる（総コストは変わらない）。SX のデータの組み替えは 403。
-- 計算は pwa/src/lib/project-cost-model.ts。仕様は pwa/spec/5-13-project-cost-model-current-spec.md。

begin;

alter table project_cost_items add column if not exists bearer text not null default 'sx';

alter table project_cost_items drop constraint if exists project_cost_items_bearer_check;
alter table project_cost_items add constraint project_cost_items_bearer_check
  check (bearer in ('sx', 'customer', 'site'));

alter table project_cost_items drop constraint if exists project_cost_items_central_bearer_check;
alter table project_cost_items add constraint project_cost_items_central_bearer_check
  check (scenario <> '中央培養' or bearer = 'sx');

comment on column project_cost_items.bearer is '誰が持つか。sx=SX / customer=顧客（SXの原価に入れない）/ site=処理する場所の持ち主（オンサイトは顧客、オフサイトはSX）。migration 402';

commit;
