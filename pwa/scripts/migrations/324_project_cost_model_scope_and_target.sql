-- 324_project_cost_model_scope_and_target.sql
-- 「タブを見ただけで、どういう前提でどういう計算をしていて、
--   CAPEX/OPEXがどのくらいで、いくら以下ならUEが成立するのかが分かる」ようにする (2026-08-23 まさ指摘)。
--
-- 足りなかったのは3つ:
--   1. 想定している系そのものの説明 (対象・規模・方式・収益モデル)  → system_scope_md
--   2. 成立ライン (いくら以下にならないと成立しないか)              → target_total_cost_per_m3 / target_margin_rate
--   3. 単位あたり指標の分母と通貨単位                                → unit_basis_label / currency_unit
-- CAPEX/OPEXの分離と確度別の内訳は、既存データから計算で出せるのでカラムは足さない。

BEGIN;

alter table project_cost_models
  add column if not exists system_scope_md text,
  add column if not exists target_total_cost_per_m3 numeric,
  add column if not exists target_margin_rate numeric,
  add column if not exists target_note text,
  -- 単位あたり指標の分母。SXは m³ だが、PJによって kg / 台 / 件 などになる。
  add column if not exists unit_basis_label text not null default 'm³';

comment on column project_cost_models.system_scope_md is
  'どういう系を想定した試算か。対象・規模・方式・収益モデル・費用の扱いを最初に読ませる。';
comment on column project_cost_models.target_total_cost_per_m3 is
  '成立ラインとして置いている総コスト目標 (円/単位)。null ならタブは損益分岐だけを出す。';

COMMIT;
