-- 411: コスト試算（燃料）を project_cost_* に載せるため、制約へ燃料の試算の値を足す（2026-09-14 まさ依頼）
--
-- まさ「OSの技術ページに、新たに『コスト試算（燃料）』を追加してほしい。
-- そんで廃液処理のコスト試算と同様にバイオディーゼル事業のコスト試算シートを作ってほしい。」
-- 排水処理のコスト試算と同じテーブルに、case_kind = 'biodiesel' の試算として持つ。
--   - case_kind に biodiesel（バイオディーゼル）を足す。排水処理のタブは biodiesel の試算を読まない（API の既定）
--   - 明細・作業の scenario に 外部委託（FAME転換を外部に委託するときだけ）/ 自社精製（自社で行うときだけ）を足す
--   - 作業の年間回数の決め方に plant_line（燃料化設備の系列ごと。1系列あたりの回数 × 系列数）を足す。plant_line も年間回数を必ず持つ
--
-- 制約を足すだけで、既存の行は変えない（排水処理の試算の総コストは変わらない）。SX の燃料の試算のデータは 412。
-- 計算は pwa/src/lib/project-fuel-cost-model.ts。仕様は pwa/spec/5-16-project-fuel-cost-model-current-spec.md。

begin;

alter table project_cost_models drop constraint if exists project_cost_models_case_kind_check;
alter table project_cost_models add constraint project_cost_models_case_kind_check
  check (case_kind in ('dye_degradation', 'metal_recovery', 'multi', 'other', 'biodiesel'));

alter table project_cost_items drop constraint if exists project_cost_items_scenario_check;
alter table project_cost_items add constraint project_cost_items_scenario_check
  check (scenario in ('循環', '投入', '共通', '現場共通', 'オフサイト', '中央培養', '外部委託', '自社精製'));

alter table project_cost_tasks drop constraint if exists project_cost_tasks_scenario_check;
alter table project_cost_tasks add constraint project_cost_tasks_scenario_check
  check (scenario in ('循環', '投入', '共通', '現場共通', 'オフサイト', '中央培養', '外部委託', '自社精製'));

alter table project_cost_tasks drop constraint if exists project_cost_tasks_count_driver_check;
alter table project_cost_tasks add constraint project_cost_tasks_count_driver_check
  check (count_driver in ('fixed', 'batch', 'visit', 'module_swap', 'membrane_swap', 'truck_trip', 'production_line', 'plant_line'));

alter table project_cost_tasks drop constraint if exists project_cost_tasks_fixed_count_check;
alter table project_cost_tasks add constraint project_cost_tasks_fixed_count_check
  check (count_driver not in ('fixed', 'production_line', 'plant_line') or count_per_year is not null);

comment on column project_cost_models.case_kind is 'ケース。dye_degradation / metal_recovery / multi / other は排水処理などのコスト試算タブ、biodiesel は技術タブのコスト試算（燃料）が読む。migration 411';
comment on column project_cost_tasks.count_driver is '年間回数の決め方。fixed=固定 / batch=年間バッチ数（燃料の試算は品質確認のロット数）/ visit=訪問回数 / module_swap=モジュール交換回数 / membrane_swap=膜交換回数 / truck_trip=輸送の回数（燃料の試算は出荷の台数）/ production_line=培養設備の系列ごと（1系列あたりの回数 × 系列数。菌体の製造拠点の作業だけ）/ plant_line=燃料化設備の系列ごと（1系列あたりの回数 × 系列数）。migration 404・411';

commit;
