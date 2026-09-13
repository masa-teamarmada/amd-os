-- 396: コスト試算に C:オフサイト（排液をSX工場まで運んで処理）を足す（2026-09-13 まさFB）
--
-- 明細・作業の「効く範囲」（scenario）に2つ足す。
--   現場共通   … 顧客工場で処理するオンサイト（A:循環・B:投入）だけに効く。顧客工場への菌体の巡回、顧客工場内の区画など
--   オフサイト … C:オフサイトだけに効く。排液の輸送・受け入れ・放流など
-- 共通 は A・B・C すべてに効く。C:オフサイトは B:投入の設備を SX工場で使うので、'投入' の行も C に効く（計算エンジンの METHOD_SCOPES）。
--
-- 作業の年間回数の決め方（count_driver）に1つ足す。
--   truck_trip … 輸送の回数 = 年間処理量 ÷ 1台の積載量（前提 role_key = truck_capacity_m3）
--
-- 制約を広げるだけで、既存の行は変えない。SX のデータの組み替えは 397。
-- 計算は pwa/src/lib/project-cost-model.ts。仕様は pwa/spec/5-13-project-cost-model-current-spec.md。

begin;

alter table project_cost_items drop constraint if exists project_cost_items_scenario_check;
alter table project_cost_items add constraint project_cost_items_scenario_check
  check (scenario in ('循環', '投入', '共通', '現場共通', 'オフサイト', '中央培養'));

alter table project_cost_tasks drop constraint if exists project_cost_tasks_scenario_check;
alter table project_cost_tasks add constraint project_cost_tasks_scenario_check
  check (scenario in ('循環', '投入', '共通', '現場共通', 'オフサイト', '中央培養'));

alter table project_cost_tasks drop constraint if exists project_cost_tasks_count_driver_check;
alter table project_cost_tasks add constraint project_cost_tasks_count_driver_check
  check (count_driver in ('fixed', 'batch', 'visit', 'module_swap', 'membrane_swap', 'truck_trip'));

comment on column project_cost_items.scenario is '効く範囲。循環 / 投入（C:オフサイトにも効く）/ 共通（A・B・C）/ 現場共通（A・Bだけ）/ オフサイト（Cだけ）/ 中央培養（菌体の製造拠点）。migration 396';
comment on column project_cost_tasks.scenario is '効く範囲。循環 / 投入（C:オフサイトにも効く）/ 共通（A・B・C）/ 現場共通（A・Bだけ）/ オフサイト（Cだけ）/ 中央培養（菌体の製造拠点）。migration 396';
comment on column project_cost_tasks.count_driver is '年間回数の決め方。fixed=固定 / batch=年間バッチ数 / visit=訪問回数 / module_swap=モジュール交換回数 / membrane_swap=膜交換回数 / truck_trip=輸送の回数（年間処理量 ÷ 1台の積載量）';

commit;
