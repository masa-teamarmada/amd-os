-- 465_cost_format_standard_rows_cx.sql
-- コスト試算タブの標準フォーマット（spec 3-23 §7）。まさ確定 2026-10-03「原価計算は、フォーマットは共通させることを前提にcxのもちゃんと入れて」。
--
-- 1. 明細と作業に、標準の原価の内訳の行（format_row: 原料・部材／運ぶ／作業／後処理・外注／消耗品・電力・施設／設備の償却／その他）を持たせる
--    汎用の計算（src/lib/project-cost-items-engine.ts）が読む。SX の廃液・燃料の試算は使わない（空のまま）
-- 2. CX の原価計算（cm_p20_260930、migration 463 で下書き登録）を、標準フォーマットで出せる形にして active にする
--    売価・年間の量（比べる量 2・12・70台）・作業単価・組立の作業（1台500時間）・組立工場の賃料と光熱費（月25万円）を足し、
--    部材費と生産設備に内訳の行を付ける。12台/年で1台あたり 28,981,105円（成果物3の2031年の売上原価 ÷ 12台と同じ）
BEGIN;

ALTER TABLE project_cost_items ADD COLUMN IF NOT EXISTS format_row text;
ALTER TABLE project_cost_tasks ADD COLUMN IF NOT EXISTS format_row text;
ALTER TABLE project_cost_items DROP CONSTRAINT IF EXISTS project_cost_items_format_row_check;
ALTER TABLE project_cost_items ADD CONSTRAINT project_cost_items_format_row_check CHECK (format_row IS NULL OR format_row IN ('materials','logistics','labor','post','supplies','equipment','other'));
ALTER TABLE project_cost_tasks DROP CONSTRAINT IF EXISTS project_cost_tasks_format_row_check;
ALTER TABLE project_cost_tasks ADD CONSTRAINT project_cost_tasks_format_row_check CHECK (format_row IS NULL OR format_row IN ('materials','logistics','labor','post','supplies','equipment','other'));
COMMENT ON COLUMN project_cost_items.format_row IS 'コスト試算の標準フォーマットの原価の内訳の行（src/lib/project-formats.ts の COST_BREAKDOWN_ROWS）。汎用の計算が読む。空なら CAPEX は設備の償却、そのほかはその他。SX の廃液・燃料の試算は使わない（migration 465）';
COMMENT ON COLUMN project_cost_tasks.format_row IS 'コスト試算の標準フォーマットの原価の内訳の行。空なら作業（migration 465）';
-- 明細の出所にも「資料記載」を使えるようにする（前提と作業には既にある。取締役会資料などから写した数）
ALTER TABLE project_cost_items DROP CONSTRAINT IF EXISTS project_cost_items_source_kind_check;
ALTER TABLE project_cost_items ADD CONSTRAINT project_cost_items_source_kind_check CHECK (source_kind IS NULL OR source_kind IN ('先生回答','予測','推測','仮置き','推定','要検証','実測','出所不明','資料記載'));

select set_config('amd.cost_change_reason', $m$465: CX の原価計算を標準フォーマット（全PJ共通の形）で出すため、明細に内訳の行を持たせ、売価・年間の量・作業単価・組立の作業・工場の賃料を足した（2026-10-03 まさ「原価計算は、フォーマットは共通させることを前提にcxのもちゃんと入れて」）。数は成果物3 事業計画書（2026-09-30 NIMS提出版）$m$, true);

UPDATE project_cost_models SET
  title = $m$CX 原価計算（製品①：TES用連続断熱消磁冷凍機・4段構成）$m$,
  case_label = $m$製品①1台あたりの原価（自社の組立工場で製造する2028年以降の形）$m$,
  version_label = $m$260930版$m$,
  status = 'active',
  source_note = $m$成果物3 事業計画書（数値計画・資本政策表）（2026-09-30 NIMS提出版）の第3章の前提と第5章の原価$m$,
  summary_md = $m$成果物3 事業計画書（2026-09-30 NIMS提出版）の原価を、製品①の1台あたりで見る試算。部材費（あきの原価試算・4段構成）に、自社の組立工場での組立・試験の作業、工場の賃料と光熱費、生産設備の償却を足す。

年間の量（2台・12台・70台）を切り替えると、量で薄まる費用（作業・賃料・償却）がどう変わるかを比べられる。12台/年の1台あたりの原価は、成果物3の2031年の売上原価を12台で割った額と同じ。$m$,
  system_scope_md = $m$- 製品①：TES用連続断熱消磁冷凍機（4段構成）。販売単価は1台5,500万円
- 2028年1月に自社の組立工場を開き、生産設備（1,914万円）を買う。組立だけのため、電気と水道が通れば足りる
- 製造の人員1人で年4台程度を組み立てる（1台あたり500時間）
- 初号機（2027年）はNIMSの設備で製作する実証機で、利益を見込まない。この試算には入れていない$m$,
  target_note = NULL,
  updated_by = 'migration-465',
  updated_at = NOW()
WHERE cost_model_id = 'cm_p20_260930';

UPDATE project_cost_items SET format_row = 'materials', note = $m$部材費。あきの原価試算（4段構成、共有スプレッドシート「CryoXプロジェクト」）の区分ごとの合計。5区分の合計 25,614,415円が、成果物3の部材費（製品①1台 2,561万円）。量産で買う値下がりは入れていない$m$, updated_at = NOW() WHERE cost_model_id = 'cm_p20_260930' AND cost_item_id IN ('ci_p20_260930_m1','ci_p20_260930_m2','ci_p20_260930_m3','ci_p20_260930_m4','ci_p20_260930_m5');
UPDATE project_cost_items SET format_row = 'equipment', note = $m$生産設備（2028年1月に自社の組立工場で購入、合計 19,144,000円）。成果物3 第5章。耐用年数は4年と7年$m$, updated_at = NOW() WHERE cost_model_id = 'cm_p20_260930' AND cost_item_id IN ('ci_p20_260930_e1','ci_p20_260930_e2','ci_p20_260930_e3','ci_p20_260930_e4','ci_p20_260930_e5');

INSERT INTO project_cost_items (cost_item_id, cost_model_id, scenario, cost_type, basis, group_label, leaf_label, quantity, quantity_unit, unit_price, unit_price_unit,
  annual_factor, useful_life_years, confidence, source_kind, owner, sort_order, visibility, bearer, format_row, note)
VALUES ('ci_p20_260930_f1', 'cm_p20_260930', '共通', 'OPEX', '年額固定', $m$組立工場の賃料・光熱費$m$, $m$月25万円（仮置き）$m$, 12, $m$か月$m$, 250000, $m$円/月$m$,
  1, NULL, 'C', '仮置き', 'まさ', 60, 'amd_internal', 'sx', 'supplies',
  $m$2026-09-30 まさ確定の仮置き（組立だけのため電気と水道が通れば足りる）。計画では2032年から月50万円（年600万円）に上げるが、この試算は月25万円で置いている（70台/年で1台あたり約4万円の差）$m$)
ON CONFLICT (cost_item_id) DO NOTHING;

INSERT INTO project_cost_assumptions (cost_assumption_id, cost_model_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, role_key, sort_order, note, is_key, visibility) VALUES
('ca_p20_260930_price', 'cm_p20_260930', $m$量と売価$m$, $m$販売単価（製品①）$m$, 55000000, NULL, $m$円/台$m$, 'A', $m$資料記載$m$, $m$まさ$m$, 'sale_price', 10, $m$製品①の販売単価（2026-08-31 まさ確定）。業界の価格帯（6,500万〜1億円）より低く置いている（成果物3）$m$, true, 'amd_internal'),
('ca_p20_260930_volume', 'cm_p20_260930', $m$量と売価$m$, $m$年間の生産台数$m$, 12, NULL, $m$台/年$m$, 'C', $m$予測$m$, $m$あき$m$, 'business_annual_volume', 20, $m$2031年の計画（自社の組立工場で年12台。営業利益が黒字になる年）。比べる量は2028年の2台と2035年の70台$m$, true, 'amd_internal'),
('ca_p20_260930_compare', 'cm_p20_260930', $m$量と売価$m$, $m$比べる年間の量$m$, NULL, $m$2:2028年の計画,12:2031年の計画,70:2035年の計画$m$, NULL, 'C', $m$予測$m$, $m$あき$m$, 'compare_volumes', 30, $m$成果物3の販売台数（2027年1台・2028年2台・2031年12台・2035年70台）から、自社の組立工場で製造する年を選んだ$m$, true, 'amd_internal'),
('ca_p20_260930_labor', 'cm_p20_260930', $m$作業（人件費）$m$, $m$作業単価$m$, 5750, NULL, $m$円/時$m$, 'C', $m$推定$m$, $m$あき$m$, 'labor_rate', 40, $m$製造の人件費 年1,000万円と法定福利費15%（成果物3の前提）を、年2,000時間で割った額$m$, true, 'amd_internal')
ON CONFLICT (cost_assumption_id) DO NOTHING;

INSERT INTO project_cost_tasks (cost_task_id, cost_model_id, scenario, group_label, label, hours_per_occurrence, count_driver, count_per_year, expense_per_occurrence, performer,
  confidence, source_kind, owner, sort_order, visibility, format_row, note)
VALUES ('ct_p20_260930_assembly', 'cm_p20_260930', '共通', $m$組み立てる$m$, $m$組立・調整・試験（1台）$m$, 500, 'batch', NULL, 0, 'sx',
  'C', '推定', 'あき', 10, 'amd_internal', 'labor',
  $m$製造の人員1人で年4台程度を組み立てる（成果物3の前提）。1人あたり年2,000時間として1台500時間。計画は最低1人を置くので、少ない台数では1台あたりの人件費がこれより高い（2028年は1人で2台、1台あたり575万円）$m$)
ON CONFLICT (cost_task_id) DO NOTHING;

INSERT INTO project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, sort_order, visibility) VALUES
('cn_p20_260930_first', 'cm_p20_260930', 'caveat', $m$初号機（2027年）はこの試算に入れていない$m$, $m$初号機はNIMSの設備で製作する実証機で、製作に携わる製品開発の人件費を製造原価に含めて利益を0とする計画（2026-09-30 まさ確定）。この試算は、自社の組立工場で製造する2028年以降の1台あたりの原価。$m$, 10, 'amd_internal'),
('cn_p20_260930_small', 'cm_p20_260930', 'caveat', $m$少ない台数のときの人件費$m$, $m$計画は製造の人員を最低1人置く。2028年（2台）の1台あたりの人件費は575万円だが、この試算は1台500時間で比例させているので287.5万円と低めに出る。$m$, 20, 'amd_internal'),
('cn_p20_260930_rent', 'cm_p20_260930', 'caveat', $m$工場の賃料は2032年から月50万円$m$, $m$計画は2032年から月50万円（年600万円）。この試算はどの量でも月25万円で計算している。$m$, 30, 'amd_internal'),
('cn_p20_260930_product2', 'cm_p20_260930', 'caveat', $m$製品②は入れていない$m$, $m$製品②（2段構成、1台5,000万円）は、どちらを先に販売するかが未決定のため、基本計画とこの試算に含めない（成果物3）。$m$, 40, 'amd_internal'),
('cn_p20_260930_bench', 'cm_p20_260930', 'benchmark', $m$業界の価格帯$m$, $m$TES用の極低温冷凍機の価格帯は6,500万〜1億円（成果物3）。販売単価5,500万円は、これより低く置いている。$m$, 10, 'amd_internal'),
('cn_p20_260930_hist', 'cm_p20_260930', 'history', $m$2026-10-03 登録$m$, $m$成果物3（2026-09-30 NIMS提出版）の前提で登録した（migration 463・465）。全PJ共通の標準フォーマットで出す最初の試算。$m$, 10, 'amd_internal')
ON CONFLICT (cost_note_id) DO NOTHING;

DO $v$ BEGIN
  IF (SELECT status FROM project_cost_models WHERE cost_model_id = 'cm_p20_260930') <> 'active' THEN RAISE EXCEPTION 'cx cost model not active'; END IF;
  IF (SELECT count(*) FROM project_cost_items WHERE cost_model_id = 'cm_p20_260930' AND format_row IS NOT NULL) <> 11 THEN RAISE EXCEPTION 'cx items format_row mismatch'; END IF;
  IF (SELECT count(*) FROM project_cost_assumptions WHERE cost_model_id = 'cm_p20_260930' AND role_key IN ('sale_price','business_annual_volume','compare_volumes','labor_rate')) <> 4 THEN RAISE EXCEPTION 'cx assumptions mismatch'; END IF;
  IF (SELECT count(*) FROM project_cost_tasks WHERE cost_model_id = 'cm_p20_260930') <> 1 THEN RAISE EXCEPTION 'cx tasks mismatch'; END IF;
  -- 12台/年の1台あたり: 部材費 + 500時間 × 5,750円 + 3,000,000 ÷ 12 + (1,544,000 ÷ 4 + 17,600,000 ÷ 7) ÷ 12
  IF abs((SELECT sum(quantity * unit_price) FROM project_cost_items WHERE cost_model_id = 'cm_p20_260930' AND cost_type = 'OPEX' AND basis = '毎m³比例')
         + 500 * 5750 + 3000000.0 / 12 + (1544000.0 / 4 + 17600000.0 / 7) / 12 - 28981105.2) > 1 THEN RAISE EXCEPTION 'cx unit cost mismatch'; END IF;
END $v$;

COMMIT;
