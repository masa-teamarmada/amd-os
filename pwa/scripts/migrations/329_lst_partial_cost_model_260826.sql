-- LiSTie (p07) 取締役会資料の、膜＋電力に限定した部分試算をコスト試算タブへ登録する。
-- 総コスト目標 3 USD/kg と円/kgの部分試算は、為替換算・工程範囲が異なるため比較しない。

BEGIN;

-- 取締役会資料の記載値を、実測値や研究者回答と混同しない。
alter table project_cost_assumptions drop constraint if exists project_cost_assumptions_source_kind_check;
alter table project_cost_assumptions add constraint project_cost_assumptions_source_kind_check
  check (source_kind is null or source_kind in ('先生回答','予測','推測','仮置き','推定','要検証','実測','出所不明','資料記載'));

insert into project_cost_models (
  cost_model_id, project_id, title, case_kind, case_label, version_label, status,
  source_note, summary_md, unit_basis_label, visibility, created_by, updated_by
) values (
  'cm_p07_260826_partial_cost', 'p07', 'LiSTie コスト試算（膜＋電力）', 'other', 'LiSTie 膜＋電力 部分試算', '260826取締役会資料', 'active',
  '根拠: 2026年8月 LiSTie取締役会資料。AMD内部限定。',
  'この画面は、取締役会資料に記載された膜＋電力の部分試算だけを記録する。全工程のCAPEX、前処理、薬品、人件費、原料、物流などは含めないため、全体原価や事業採算の確定値として扱わない。',
  'kg', 'amd_internal', 'amie', 'amie'
)
on conflict (cost_model_id) do update set
  title = excluded.title, version_label = excluded.version_label, source_note = excluded.source_note,
  summary_md = excluded.summary_md, updated_by = excluded.updated_by, updated_at = now();

insert into project_cost_assumptions (
  cost_assumption_id, cost_model_id, group_label, label, value, value_text, unit,
  confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order
) values
  ('ca_p07_target_3usd', 'cm_p07_260826_partial_cost', '事業目標', '総コスト目標', null, '3 USD/kg 以下', null, 'C', '仮置き', 'LiSTie', true, 'target_total_cost_usd_per_kg', '全工程の総コスト目標。円/kgの部分試算とは為替換算・工程範囲が異なるため直接比較しない。', 'amd_internal', 10),
  ('ca_p07_membrane_old', 'cm_p07_260826_partial_cost', '膜単価', '従来前提の膜単価', 300, null, '千円/m²', 'B', '資料記載', 'LiSTie', true, 'membrane_price_old', '取締役会資料の比較前提。', 'amd_internal', 20),
  ('ca_p07_membrane_2028', 'cm_p07_260826_partial_cost', '膜単価', '2028年目安の膜単価', 2000, null, '千円/m²', 'C', '資料記載', 'LiSTie', true, 'membrane_price_2028', '取締役会資料中の提示値。見積確定値ではない。', 'amd_internal', 30),
  ('ca_p07_5a_total', 'cm_p07_260826_partial_cost', '5Aケース', '膜＋電力', 317.8, null, '円/kg', 'B', '資料記載', 'LiSTie', true, 'partial_cost_5a_total', '膜265.3円/kgと電力52.5円/kgの合計。全工程の総原価ではない。', 'amd_internal', 40),
  ('ca_p07_5a_membrane', 'cm_p07_260826_partial_cost', '5Aケース', 'うち膜', 265.3, null, '円/kg', 'B', '資料記載', 'LiSTie', false, 'partial_cost_5a_membrane', '膜＋電力の部分試算の膜分。', 'amd_internal', 50),
  ('ca_p07_5a_power', 'cm_p07_260826_partial_cost', '5Aケース', 'うち電力', 52.5, null, '円/kg', 'B', '資料記載', 'LiSTie', false, 'partial_cost_5a_power', '膜＋電力の部分試算の電力分。', 'amd_internal', 60),
  ('ca_p07_2y_total', 'cm_p07_260826_partial_cost', '膜寿命感度', '膜寿命2年の場合', 185.2, null, '円/kg', 'C', '資料記載', 'LiSTie', true, 'partial_cost_membrane_life_2y', '膜＋電力の部分試算。膜寿命の条件を2年とした感度。', 'amd_internal', 70),
  ('ca_p07_2y_reduction', 'cm_p07_260826_partial_cost', '膜寿命感度', '5Aケースからの低下', 41.7, null, '%', 'C', '資料記載', 'LiSTie', false, 'partial_cost_membrane_life_2y_reduction', '317.8円/kgに対する低下率。', 'amd_internal', 80)
on conflict (cost_assumption_id) do update set
  value = excluded.value, value_text = excluded.value_text, confidence = excluded.confidence,
  source_kind = excluded.source_kind, owner = excluded.owner, note = excluded.note,
  visibility = excluded.visibility, updated_at = now();

COMMIT;
