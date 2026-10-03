-- 466_lst_partial_cost_standard_format.sql
-- LiSTie の部分試算（膜＋電力、2026年8月の取締役会資料）を、コスト試算の標準フォーマット（spec 3-23 §7）で描けるようにする。
-- まさ確定 2026-10-03「原価計算は、フォーマットは共通させることを前提にcxのもちゃんと入れて」。
-- これまでは前提（role_key = partial_cost_*）に結果の数だけを置き、画面が LiSTie 専用の表示で読んでいた。
-- 同じ数を明細（1kgあたりの膜・電力）として持たせ、どのPJとも同じ区画・同じ内訳の行・同じグラフで描く。数は変えない。
-- もとの前提の行は、出どころの記録として残す（画面では「計算に使っていない前提」に出る）。
BEGIN;

UPDATE project_cost_models SET
  system_scope_md = $m$- 取締役会資料（2026年8月）にある、5Aケースの膜と電力だけの部分試算
- 全工程の CAPEX・前処理・薬品・人件費・原料・物流は含めない。全体の原価や事業の採算の確定値として扱わない$m$,
  target_note = $m$3 USD/kg 以下（全工程の総コスト目標。この試算は膜＋電力だけで、為替換算や全体の原価との比較はまだしていない）$m$,
  updated_by = 'migration-466',
  updated_at = NOW()
WHERE cost_model_id = 'cm_p07_260826_partial_cost';

INSERT INTO project_cost_items (cost_item_id, cost_model_id, scenario, cost_type, basis, group_label, leaf_label, quantity, quantity_unit, unit_price, unit_price_unit,
  annual_factor, useful_life_years, confidence, source_kind, owner, sort_order, visibility, bearer, format_row, note)
VALUES
  ('ci_p07_260826_membrane', 'cm_p07_260826_partial_cost', '共通', 'OPEX', '毎m³比例', $m$5Aケースの膜＋電力$m$, $m$膜$m$, 1, NULL, 265.3, $m$円/kg$m$,
   1, NULL, 'B', '資料記載', NULL, 10, 'amd_internal', 'sx', 'supplies',
   $m$取締役会資料（2026年8月）の5Aケースの膜分 265.3円/kg。膜寿命の条件を2年にすると、膜＋電力は185.2円/kg（41.7%低下）になる感度が同じ資料にある。膜単価の前提は従来300千円/m²、2028年目安2,000千円/m²（資料中の提示値。見積確定値ではない）$m$),
  ('ci_p07_260826_power', 'cm_p07_260826_partial_cost', '共通', 'OPEX', '毎m³比例', $m$5Aケースの膜＋電力$m$, $m$電力$m$, 1, NULL, 52.5, $m$円/kg$m$,
   1, NULL, 'B', '資料記載', NULL, 20, 'amd_internal', 'sx', 'supplies',
   $m$取締役会資料（2026年8月）の5Aケースの電力分 52.5円/kg$m$)
ON CONFLICT (cost_item_id) DO NOTHING;

INSERT INTO project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, sort_order, visibility) VALUES
  ('cn_p07_260826_scope', 'cm_p07_260826_partial_cost', 'caveat', $m$膜＋電力だけの部分試算$m$, $m$全工程の総原価ではない。目標（3 USD/kg 以下）は全工程の総コストで、為替換算も工程の範囲もこの試算と違うため、直接は比べない。$m$, 10, 'amd_internal'),
  ('cn_p07_260826_life', 'cm_p07_260826_partial_cost', 'caveat', $m$膜寿命の感度$m$, $m$膜寿命を2年とすると、膜＋電力は185.2円/kg（5Aケースの317.8円/kgから41.7%低下）。膜寿命の改善が優先の論点。画面で膜の単価を半分（132.65円/kg）にすると、この感度と同じになる。$m$, 20, 'amd_internal'),
  ('cn_p07_260826_hist', 'cm_p07_260826_partial_cost', 'history', $m$2026-10-03 標準フォーマットへ$m$, $m$前提に置いていた結果の数（膜265.3・電力52.5円/kg）を、同じ数の明細にした（migration 466）。LiSTie 専用の表示はやめ、全PJ共通の形で描く。$m$, 10, 'amd_internal')
ON CONFLICT (cost_note_id) DO NOTHING;

DO $v$ BEGIN
  IF (SELECT sum(quantity * unit_price) FROM project_cost_items WHERE cost_model_id = 'cm_p07_260826_partial_cost') <> 317.8 THEN RAISE EXCEPTION 'listie total mismatch'; END IF;
END $v$;

COMMIT;
