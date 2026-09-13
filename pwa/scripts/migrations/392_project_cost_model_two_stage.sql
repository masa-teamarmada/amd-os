-- 392: コスト試算を二段階にする（2026-09-13 まさ確定）
--
-- 第1段: 株（強化株 / 自然株）ごとに、菌体1kgをつくる原価（円/kg-DCW）を出す。用途では変わらない。
-- 第2段: 第1段の原価を一定として、用途（色素分解 / 金属回収）ごとに処理原価（円/単位）を出す。
--
-- 前提と明細に「どの株・どの用途に効くか」の列を足す。null は共通。
-- 同じ role_key を株・用途ごとに持てるよう、一意制約を広げる。
-- 計算は pwa/src/lib/project-cost-model.ts。仕様は pwa/spec/5-13-project-cost-model-current-spec.md。

alter table project_cost_assumptions add column if not exists strain text;
alter table project_cost_assumptions add column if not exists application text;
alter table project_cost_items add column if not exists strain text;
alter table project_cost_items add column if not exists application text;

alter table project_cost_assumptions drop constraint if exists project_cost_assumptions_strain_check;
alter table project_cost_assumptions add constraint project_cost_assumptions_strain_check
  check (strain is null or strain in ('enhanced', 'wild'));
alter table project_cost_assumptions drop constraint if exists project_cost_assumptions_application_check;
alter table project_cost_assumptions add constraint project_cost_assumptions_application_check
  check (application is null or application in ('dye', 'metal'));

alter table project_cost_items drop constraint if exists project_cost_items_strain_check;
alter table project_cost_items add constraint project_cost_items_strain_check
  check (strain is null or strain in ('enhanced', 'wild'));
alter table project_cost_items drop constraint if exists project_cost_items_application_check;
alter table project_cost_items add constraint project_cost_items_application_check
  check (application is null or application in ('dye', 'metal'));

drop index if exists project_cost_assumptions_role_key_uidx;
create unique index if not exists project_cost_assumptions_role_key_uidx
  on project_cost_assumptions (cost_model_id, role_key, coalesce(strain, ''), coalesce(application, ''))
  where role_key is not null;

-- 毎kg菌体比例 = 円/kg-DCW × 使った菌体量。年額固定 = 円/年をそのまま。
alter table project_cost_items drop constraint if exists project_cost_items_basis_check;
alter table project_cost_items add constraint project_cost_items_basis_check
  check (basis in ('初期投資配賦', '毎m³比例', 'バッチ連動', '内訳', '毎kg菌体比例', '年額固定'));

-- labor_batch = 1バッチの作業時間 × 人件費単価 × 年間バッチ数
-- patrol = 訪問回数 × (移動＋作業時間 × 人件費単価 ＋ 車両費)。訪問回数 = 年間バッチ数 ÷ max(菌体使用回数, 1回の搬入でまかなうバッチ数)
-- patrol_module / patrol_membrane = 交換回数 × 作業時間 × 人件費単価
-- spent_disposal = 脱水後の湿重量倍率 × 汚泥の処分単価 (円/kg-DCW)
alter table project_cost_items drop constraint if exists project_cost_items_price_rule_check;
alter table project_cost_items add constraint project_cost_items_price_rule_check
  check (price_rule is null or price_rule in (
    'biomass', 'broth', 'module_swap', 'power_circulation', 'power_injection',
    'labor_batch', 'patrol', 'patrol_module', 'patrol_membrane', 'spent_disposal'
  ));

alter table project_cost_models drop constraint if exists project_cost_models_case_kind_check;
alter table project_cost_models add constraint project_cost_models_case_kind_check
  check (case_kind in ('dye_degradation', 'metal_recovery', 'multi', 'other'));

comment on column project_cost_assumptions.strain is 'この前提が効く株。enhanced=強化株 / wild=自然株 / null=共通';
comment on column project_cost_assumptions.application is 'この前提が効く用途。dye=色素分解 / metal=金属回収 / null=共通';
comment on column project_cost_items.strain is 'この明細が発生する株。enhanced=強化株 / wild=自然株 / null=共通';
comment on column project_cost_items.application is 'この明細が発生する用途。dye=色素分解 / metal=金属回収 / null=共通';
