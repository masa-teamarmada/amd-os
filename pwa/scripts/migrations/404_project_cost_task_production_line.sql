-- 404: コスト試算の作業の年間回数の決め方に「培養設備の系列ごと」(production_line) を足す（2026-09-14 まさFB）
--
-- まさ「年間の生産能力は入力値じゃなくて計算結果にしてほしい。入力は、年間何立米の廃水を処理するか、にして」。
-- 年に作る菌体の量を年間処理量から計算し、菌体の製造拠点の明細を培養設備の1系列として、必要な数だけ並べる。
-- 製造拠点の作業は、拠点に1つの作業 (fixed、安全委員会の運営など) と、培養設備の系列ごとの作業
-- (production_line、培養の運転・密閉性能検査・除菌フィルター交換など。年間回数 = 1系列あたりの回数 × 系列数) に分ける。
--   - production_line は菌体の製造拠点 (scenario = '中央培養') の作業だけに使う
--   - 製造拠点の作業は fixed か production_line (これまでは fixed だけ)
--   - production_line も fixed と同じく、1系列あたりの年間回数 (count_per_year) を必ず持つ
--
-- 制約を足すだけで、既存の行は変えない (総コストは変わらない)。SX のデータの組み替えは 405。
-- 計算は pwa/src/lib/project-cost-model.ts。仕様は pwa/spec/5-13-project-cost-model-current-spec.md。

begin;

alter table project_cost_tasks drop constraint if exists project_cost_tasks_count_driver_check;
alter table project_cost_tasks add constraint project_cost_tasks_count_driver_check
  check (count_driver in ('fixed', 'batch', 'visit', 'module_swap', 'membrane_swap', 'truck_trip', 'production_line'));

alter table project_cost_tasks drop constraint if exists project_cost_tasks_central_fixed_check;
alter table project_cost_tasks add constraint project_cost_tasks_central_fixed_check
  check (scenario <> '中央培養' or count_driver in ('fixed', 'production_line'));

alter table project_cost_tasks drop constraint if exists project_cost_tasks_production_line_check;
alter table project_cost_tasks add constraint project_cost_tasks_production_line_check
  check (count_driver <> 'production_line' or scenario = '中央培養');

alter table project_cost_tasks drop constraint if exists project_cost_tasks_fixed_count_check;
alter table project_cost_tasks add constraint project_cost_tasks_fixed_count_check
  check (count_driver not in ('fixed', 'production_line') or count_per_year is not null);

comment on column project_cost_tasks.count_driver is '年間回数の決め方。fixed=固定 / batch=年間バッチ数 / visit=訪問回数 / module_swap=モジュール交換回数 / membrane_swap=膜交換回数 / truck_trip=輸送の回数（年間処理量 ÷ 1台の積載量）/ production_line=培養設備の系列ごと（1系列あたりの回数 × 系列数。菌体の製造拠点の作業だけ）。migration 404';

commit;
