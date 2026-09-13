-- 397: SX コスト試算に、作業の流れ・C:オフサイト（排液をSX工場まで運んで処理）の比較・金属回収の使用回数の固定を足す（2026-09-13 まさFB）
--
-- 先に 396（効く範囲 '現場共通' 'オフサイト' と、回数の決め方 'truck_trip' を制約へ足す）を適用すること。
-- さらに、この変更に対応した画面（計算エンジン）の配信が済んでから適用すること。旧い計算エンジンは '現場共通' の行を数えないので、
-- 先に入れると配信中の画面のオンサイトの総コストから巡回などが抜ける。
--   - 金属回収は酸で菌体を溶かして金属を取り出すので、菌体使用回数の前提を消す（計算エンジンも金属回収では1回で固定）
--   - 顧客工場へ菌体を運ぶ物流・巡回と、顧客工場内の区画・立入制限を、オンサイト（A・B）だけに効く '現場共通' にする
--   - C:オフサイトの前提（1台の積載量）・明細（受入設備・放流費）・作業（排液の輸送・受入検査・放流前の水質確認）を仮置きで足す
--   - 作業を流れの段（菌体をつくる → 運ぶ → 処理する → 設備を保つ → 後処理 → 閉鎖系の管理）に並べ直し、工数が分からない作業を空欄で足す
--   - オンサイトの数字は変えない（B:投入／既設 強化株 色素878.0・金属715.0、自然株 826.5・708.1 円/m³）
-- 生成: えいみ 2026-09-13（SXセッション）。DB の現行行と migration 395 適用後の fixture を同じ変換定義から書き出した。
begin;

-- 1. 金属回収は酸で菌体を溶かして金属を取り出すので、菌体使用回数の前提を持たない（1回で固定。計算エンジンも金属回収では読まない）
delete from project_cost_assumptions where cost_assumption_id = 'ca2_reuse_count_metal' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set note = '★最大の感度。1＝再利用せず毎回新品。技術的事実ではない保守的仮定。まさの記憶では色素分解なら数十回使い回せる可能性があるが未確認（2026-08-23時点でうろ覚えと明言）。二段階版では菌体原価を1kgあたりで持つので、使用回数を上げると菌体費がそのまま回数分下がる。杉浦先生へ確認中。 使い回せるのは色素分解だけ。金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定している（2026-09-13 まさ）。', updated_at = now() where cost_assumption_id = 'ca_reuse_count' and cost_model_id = 'cm_p21_260820';

-- 2. C:オフサイト（排液をSX工場まで運んで処理）の前提
insert into project_cost_assumptions (cost_assumption_id, cost_model_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('ca4_truck_capacity_m3', 'cm_p21_260820', 'C:オフサイト（SX工場まで運んで処理）', '1台の積載量（タンクローリー）', 10, null, 'm³/台', 'H', '仮置き', '運送会社・産廃収集運搬業者（見積）', true, 'truck_capacity_m3', '大型のタンクローリー（10kL級）で置いた。作業リストの「輸送の回数」は、年間処理量 ÷ この値で決まる。積載量が2倍になれば、運ぶ回数と運ぶ費用は半分になる。', 'amd_internal', 75, null, null);

-- 3. 明細の効く範囲。顧客工場へ菌体を運ぶ物流と、顧客工場内の区画は、オンサイト（A・B）だけに効く
update project_cost_items set scenario = '現場共通', updated_at = now() where cost_item_id = 'ci_260820_131' and cost_model_id = 'cm_p21_260820';
update project_cost_items set scenario = '現場共通', updated_at = now() where cost_item_id = 'ci_260820_132' and cost_model_id = 'cm_p21_260820';
update project_cost_items set scenario = '現場共通', updated_at = now() where cost_item_id = 'ci_260820_133' and cost_model_id = 'cm_p21_260820';
update project_cost_items set scenario = '現場共通', updated_at = now() where cost_item_id = 'ci_260820_141' and cost_model_id = 'cm_p21_260820';
update project_cost_items set scenario = '現場共通', updated_at = now() where cost_item_id = 'ci2_s_work_area' and cost_model_id = 'cm_p21_260820';
update project_cost_items set mid_label = '排気の除菌フィルター（処理槽）', leaf_label = '処理槽の排気口', note = 'カテゴリー1相当で積んだ。GILSPと判定されれば不要になる可能性がある。オンサイトは顧客工場の処理槽、オフサイトはSX工場の処理槽に付ける。', updated_at = now() where cost_item_id = 'ci2_s_exhaust_filter' and cost_model_id = 'cm_p21_260820';
update project_cost_items set note = '放流前に処理水を不活化する。GILSPなら「含まれる菌の数を最小限にとどめる措置」で足りる可能性がある。色素排水は色が光を吸うため紫外線が使えない。実排水は有機物で塩素の必要量が数倍になる。 オフサイトでは、SX工場から流す前に同じ処理をする。', updated_at = now() where cost_item_id = 'ci2_s_treated_water' and cost_model_id = 'cm_p21_260820';

-- 4. C:オフサイトの明細（仮置き）。設備は B:投入と同じものを SX工場に置くので、ここには B に無いものだけを足す
insert into project_cost_items (cost_item_id, cost_model_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application) values ('ci4_off_receiving', 'cm_p21_260820', 'オフサイト', 'CAPEX', '排液の受け入れ（SX工場）', '受入設備（受入口・ストレーナ・流量計）', '排液の受け入れ', '初期投資配賦', 1, '式', 3000000, '円/式', null, 1, 10, false, 'H', '仮置き', 'ダイキアクシス', 'タンクローリーから排液を受け入れる受入口・ストレーナ・流量計。規模と仕様が決まるまでの仮置き。', 'amd_internal', 2000, null, null);
insert into project_cost_items (cost_item_id, cost_model_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application) values ('ci4_off_discharge', 'cm_p21_260820', 'オフサイト', 'OPEX', '処理水の放流（SX工場）', '処理水の放流費（下水道使用料など）', '放流', '毎m³比例', 1, 'm³', 250, '円/m³', null, 1, null, false, 'H', '仮置き', 'SX工場の所在自治体（下水道）', 'オフサイトでは処理水をSX工場から流す。下水道へ流す場合の使用料の目安で置いた（自治体と水量で変わる）。オンサイトは顧客工場の既存の放流経路を使うので、この費用は発生しない。', 'amd_internal', 2010, null, null);

-- 5. 作業を流れの段（group_label）に並べ直す。段の順は sort_order
update project_cost_tasks set group_label = '菌体を運ぶ', sort_order = 20, scenario = '現場共通', updated_at = now() where cost_task_id = 'ct_delivery' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '菌体を運ぶ', sort_order = 21, scenario = '現場共通', updated_at = now() where cost_task_id = 'ct_travel' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '排液を処理する', sort_order = 40, label = '処理の運転（A:循環、1バッチ）', updated_at = now() where cost_task_id = 'ct_run_circulation' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '排液を処理する', sort_order = 41, label = '処理の運転（B:投入、1バッチ）', note = '出所：中島試算シート100m³ケース②投入。手動運用のときの時間。自動制御の無人運転で何時間まで減るかは未確認（ダイキアクシスへ確認中）。 C:オフサイトでも、同じ運転をSX工場で行う前提で同じ時間を使う。', updated_at = now() where cost_task_id = 'ct_run_injection' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '設備を保つ', sort_order = 50, updated_at = now() where cost_task_id = 'ct_module_swap' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '設備を保つ', sort_order = 51, note = '交換回数は、1 ÷ 膜交換年数。オンサイトは移動を搬入の訪問に合わせる前提で、作業時間だけを積む。膜の部品代は明細の「UF/MF膜モジュール（交換品）」に別に積んでいる。', updated_at = now() where cost_task_id = 'ct_membrane_swap' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '閉鎖系を管理する（強化株のみ）', sort_order = 70, updated_at = now() where cost_task_id = 'ct_c_safety_committee' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '閉鎖系を管理する（強化株のみ）', sort_order = 71, updated_at = now() where cost_task_id = 'ct_c_integrity_test' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '閉鎖系を管理する（強化株のみ）', sort_order = 72, updated_at = now() where cost_task_id = 'ct_c_filter_replace' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '閉鎖系を管理する（強化株のみ）', sort_order = 73, label = '処理設備の密閉性能検査', note = 'カテゴリー1相当で積んだ。GILSPと判定されれば不要になる可能性がある。オンサイトは顧客工場、オフサイトはSX工場の処理設備を検査する。検査の頻度と工数は未確認で、いまは年額15万円を1回分の経費として置いている。', updated_at = now() where cost_task_id = 'ct_s_integrity_test' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '閉鎖系を管理する（強化株のみ）', sort_order = 74, label = '除菌フィルターの交換（処理設備）', note = 'カテゴリー1相当で積んだ。GILSPと判定されれば不要になる可能性がある。作業時間とフィルター代の内訳は未確認で、いまは1回3万円（年2回で6万円）を経費として置いている。', updated_at = now() where cost_task_id = 'ct_s_filter_replace' and cost_model_id = 'cm_p21_260820';
update project_cost_tasks set group_label = '閉鎖系を管理する（強化株のみ）', sort_order = 75, label = '立入制限・教育訓練（顧客工場）', scenario = '現場共通', note = '顧客工場で、教育訓練を受けた人以外の立入りを制限する。年10時間で置いた。オフサイトは組換え体を扱うのがSX工場の中だけなので発生しない。', updated_at = now() where cost_task_id = 'ct_s_training' and cost_model_id = 'cm_p21_260820';

-- 6. 作業の流れに要る作業のうち、まだ作業リストに無かったもの。工数が分からない作業は空欄（未確認）にし、0時間として数える
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct4_culture_operation', 'cm_p21_260820', '中央培養', null, null, '菌体をつくる', '培養・濃縮の運転（1日分）', null, 'fixed', 300, null, 0, 'H', '仮置き', '杉浦先生・中島先生', '毎日の培養の管理と、菌体を濃縮して出荷できる状態にする作業。1日あたりの工数が分かっていないので空欄（未確認）にしている。年間回数は稼働日と同じ300日で置いた。工数が分かれば、菌体1kgの原価に入る。', 10, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct4_off_haul', 'cm_p21_260820', 'オフサイト', null, null, '排液を運ぶ', '排液の積み込み・輸送・荷降ろし（1台）', 2.5, 'truck_trip', null, null, 10000, 'H', '仮置き', '運送会社・産廃収集運搬業者（見積）', '顧客工場で積み込み、SX工場まで片道30km程度を運び、荷降ろしするまでの1台分。1回の経費は車両費（燃料・高速代・タンクローリーの償却の目安）。運送会社に頼む場合は、工数を0にして運賃を1回の経費に入れる。輸送の回数 ＝ 年間処理量 ÷ 1台の積載量。', 30, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct4_off_receive', 'cm_p21_260820', 'オフサイト', null, null, '排液を処理する', '排液の受け入れ・受入検査（1バッチ）', 0.5, 'batch', null, null, 0, 'H', '仮置き', 'ダイキアクシス', 'SX工場で受け入れた排液の量と性状（pH・色・金属濃度の簡易測定）を確認して記録する。', 39, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct4_off_discharge_check', 'cm_p21_260820', 'オフサイト', null, null, '排液を処理する', '処理水の水質確認・放流の記録（1バッチ）', 0.5, 'batch', null, null, 0, 'H', '仮置き', 'ダイキアクシス', 'オフサイトでは処理水をSX工場から流すので、放流前の水質確認と記録をSX側で行う。オンサイトは顧客工場の既存の放流管理に乗る前提で積んでいない。', 42, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct4_post_metal', 'cm_p21_260820', '共通', null, 'metal', '使用済み菌体を後処理する', '酸処理と金属の回収（1バッチ分）', null, 'batch', null, null, 0, 'H', '仮置き', '中島先生', '使用済み菌体を酸で溶かし、中和して金属を回収する作業。1バッチ分の工数が分かっていないので空欄（未確認）。酸・中和剤などの費用は明細の「シアノ回収後処理」に積んでいる。', 60, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct4_post_dye', 'cm_p21_260820', '共通', null, 'dye', '使用済み菌体を後処理する', '脱水と処分の手配（1バッチ分）', null, 'batch', null, null, 0, 'H', '仮置き', 'ダイキアクシス', '使用済み菌体を脱水し、汚泥として処分業者へ引き渡すまでの作業。工数は未確認で空欄。処分費は明細の「使用済み菌体の処分」に積んでいる。', 61, 'amd_internal');

-- 7. 試算の説明
update project_cost_models set version_label = '260913 作業の流れ・オフサイト版', summary_md = 'SXの排液処理を、**菌体の製造原価**と**用途別の処理原価**の二段階で試算する。

**第1段 菌体の製造原価** — 株（強化株／自然株）ごとに、菌体の製造拠点で乾燥菌体1kgをつくる原価を出す。菌体の製造拠点は、顧客工場では培養せず、SX側の1拠点でまとめて菌体を育て、濃縮して各工場へ運ぶところ。同じ株なら用途では変わらない。強化株は閉鎖系の追加費用が乗る。生産した菌体のうち売れる割合（販売率）で割るので、売れ残りが出ると1kgあたりの原価は上がる。

**第2段 用途別の処理原価** — 第1段の原価を一定として、色素分解と金属回収のそれぞれで排水1m³あたりの総コストを出す。用途で変わるのは、必要な菌体の量（対象物質の濃度 ÷ 取り込み効率 ÷ 菌体使用回数）と、使用済み菌体の後処理。菌体を使い回せるのは色素分解だけで、金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定する。

**方式は3つを並べる** — 顧客工場で処理するオンサイトの A:循環・B:投入と、排液をSX工場まで運んで処理するオフサイトの C。

操作パネルで株・用途・方式・槽を切り替え、前提・作業リスト・明細の数字を書き換えると、結果がその場で再計算される。結果の欄には総コストの内訳を棒グラフで出し、操作パネルの一番上には作業の流れと段ごとの年間工数を出す。書き換えた数字は保存されない。正本へ書くのは、管理者が「この値を保存」を押したときだけ。

ちこ作成の260820版の明細を土台に、2026-09-13に二段階へ組み替えた。人件費・巡回サービス・閉鎖系の追加費用・色素用の後処理・色素の濃さを追加し、いずれも確度つきで置いている。同日、人件費を作業リスト（作業ごとの工数 × 作業単価）で持つ形に変え、販売率を足した。さらに同日、作業を流れの段に並べ直し、オフサイトの比較を足した。', system_scope_md = '**対象** — 工場排液を、生きたシアノバクテリア（藍藻）で処理する。用途は色素分解と金属回収の2つを並べる。

**規模** — 顧客工場1拠点あたり 100 m³/日 × 300 日/年 ＝ 30,000 m³/年。1バッチ100 m³、反応時間（HRT）4時間のバッチ運転。

**第1段：菌体は菌体の製造拠点で作る** — 顧客工場では培養せず、SX側の1拠点でまとめて菌体を育て、濃縮して各工場へ運ぶ。乾燥菌体1kgあたりの原価は、「(培養設備の償却年額 ＋ 年ごとの固定費 ＋ 製造拠点の作業) ÷ 年間生産能力 ＋ 菌体量に比例する費用」を販売率で割って出す。年間生産能力いっぱいに作り、そのうち販売率（既定100%）の分が売れる前提。売れ残りも作った分の費用はかかる。

**第2段：方式は3つを並べて比較する**
- **A：循環カートリッジ方式** — 菌体をカートリッジ内の保持モジュールに留め、排液を循環させて接触させる。モジュールは耐用バッチ数ごとに交換する。
- **B：直接投入方式** — 菌体を槽へ直接投入して撹拌し、反応後に UF/MF 膜で菌体を分離回収する。膜は約3年で交換する。
- **C：オフサイト** — 排液をタンクローリーでSX工場まで運び、B と同じ設備（撹拌・UF/MF膜）と、SX工場に新設する槽で処理する。処理水はSX工場から流す。顧客工場への巡回と、顧客工場内の区画・立入制限は発生しない。代わりに、排液の輸送・受け入れ・放流の費用が乗る。

**槽は既設／新設の2通り** — 顧客の既存調整タンクを流用できれば0円。新設ならコンクリート地下タンク100 m³で1,800万円（10年償却）。A・Bは方式×槽の4通り、Cは SX工場に槽を新設する1通りで、用途ごとに5シナリオになる。

**オンサイトの設備は独立プラント新設ではなく増分アドオン** — 顧客の既存調整タンク・排水ライン・ユーティリティ・主処理設備を使い、密閉接触・循環、菌体捕捉、回収サービスを足す（2026-07-23 確定）。

**収益モデル** — 処理費のみ。売価500円/m³。回収物（金属など）の売却収入はまだモデルに入れていない。

**作業（人件費）** — 総コストに入れる（2026-09-13 まさ指示）。作業リストに、作業ごとの1回の工数・年間回数・作業単価・1回の経費を置き、年額 ＝ 年間回数 ×（工数 × 作業単価 ＋ 経費）で積む。現場の運転は中島先生の試算にある手動運用の作業時間で置いている。菌体の搬入・搬出、移動、モジュール・膜の交換、閉鎖系の検査や安全委員会も同じリストに並べる。作業は流れの段（菌体をつくる → 菌体を運ぶ／排液を運ぶ → 排液を処理する → 設備を保つ → 使用済み菌体を後処理する → 閉鎖系を管理する）の順に並べ、段ごとの年間工数を出す。', source_note = '原典: Google Sheets SX_コスト試算_260820 (ちこ)。中島先生の設備・運用想定を反映した版。 2026-09-13 に二段階版へ組み替え（migration 393）。 同日、作業リストと販売率を足した（migration 394/395）。 同日、作業の流れの段、C:オフサイトの比較、金属回収の使用回数の固定を足した（migration 396/397）。', updated_at = now() where cost_model_id = 'cm_p21_260820';

-- 8. 注記
update project_cost_notes set title = '処理の運転は、手動運用の作業時間で入れている', body_md = '作業リストの「処理の運転」は、中島先生の試算にある1バッチあたりの作業時間（A:循環5.75時間、B:投入7.5時間）で置いている。

自動制御で無人運転する設計方針は変えていない。無人運転で何時間まで減るかが分かっていないため、いまは根拠のある手動運用の値を使っている。無人運転に近づけたときの総コストは、作業リストの工数を下げて見る。

C:オフサイトでも、SX工場で同じ運転をする前提で同じ時間を使っている。', updated_at = now() where cost_note_id = 'cn2_c8' and cost_model_id = 'cm_p21_260820';
update project_cost_notes set body_md = '中島先生の回答④。寿命は「ハウジング」「菌体保持膜」「菌体そのものの吸収可能回数」の3層を別々に扱う必要がある。このうち**菌体そのものの寿命は未確定なので、この試算では数値を置いていない**（循環・直接投入の両方式に共通）。

技術的に何回いけるかが分かっても、それだけでは決まらない。**再生コスト（色素を外す洗浄の工程。未計上）と新規培養コスト（菌体の製造拠点の設備）が揃ってはじめて「何回使うのが得か」が決まる**。両方が入ってから、菌体ロス補充・性能低下分の式を組み直す。

使い回しを考えるのは色素分解だけ。金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定している（2026-09-13 まさ）。', updated_at = now() where cost_note_id = 'cn_260820_c1' and cost_model_id = 'cm_p21_260820';
update project_cost_notes set body_md = '- **回収物の売却収入がモデルに1円も入っていない。** 収入は処理費500円/m³のみ。レアアース回収などのアップサイドが数字として表現できていない
- **事業規模との接続がない。** 1拠点あたり年商1,500万円（30,000m³ × 500円）。FY35 売上200億円という目標に対して、何拠点必要かが出ていない
- **オフサイトの前提は仮置き。** 排液を運ぶ費用・受け入れ設備・放流費には見積がない。顧客の排液を運んで処理するときの許可（産業廃棄物の収集運搬・処分）にかかる費用と期間は入っていない
- **閉鎖系の追加費用と巡回サービスは仮置き。** 金額の根拠となる見積がまだない（二段階版で追加）
- **色素側の数字は実測がない。** 色素の濃さ・取り込み効率・菌体使用回数・使用済み菌体の含水率は文献相場か仮置き', updated_at = now() where cost_note_id = 'cn_260820_h2' and cost_model_id = 'cm_p21_260820';
update project_cost_notes set body_md = '1. **切り替える** — 操作パネルの上で、株・用途・方式・槽を選ぶ。方式は、顧客工場で処理する A:循環・B:投入と、排液をSX工場まで運んで処理する C:オフサイトの3つ。結果の棒を押しても選べる。切り替えは保存されない
2. **数字を動かす** — 前提、作業リスト、明細の数字を書き換えると、結果がその場で再計算される。書き換えた数字には印が付き、結果には保存値からの差が出る
3. **結果を見る** — 右の欄に、方式ごとの総コストを内訳の色で積んだ棒と、選んだ方式の内訳（区分ごとの円/m³と割合）、作業工数の合計が出る。操作パネルの一番上には、作業の流れと段ごとの年間工数が出る
4. **戻す・保存する** — 「すべて戻す」で保存値に戻る。管理者は「この値を保存」で正本へ書ける
5. **第1段と第2段** — 第1段は菌体1kgの原価で、同じ株なら用途では変わらない。第2段は用途ごとの処理原価で、違うのは排水1m³に使い切る菌体の量と後処理', updated_at = now() where cost_note_id = 'cn2_r5' and cost_model_id = 'cm_p21_260820';
update project_cost_notes set body_md = '- **第1段 菌体の製造原価** — 株ごとに、乾燥菌体1kgをつくる原価。培養設備の償却・年ごとの固定費・製造拠点の作業・菌体量に比例する費用に分け、販売率で割って見る
- **菌体費** — 第1段の原価 × 排水1m³あたりに使い切る菌体量
- **運ぶ（巡回・輸送）** — オンサイトは顧客工場への菌体の搬入・搬出と移動、オフサイトは排液の輸送。作業リストの工数・作業単価・経費で動かす
- **運転・保守・管理の作業** — 処理の運転、モジュールや膜の交換、閉鎖系の管理など、運ぶ以外の作業
- **使用済み菌体の後処理** — 金属回収は酸処理、色素分解は汚泥としての処分
- **消耗品・電力・放流など** — 処理に使う消耗品・電力・分析と、オフサイトの放流費
- **設備と槽の償却** — 処理設備と槽の初期投資 ÷ 耐用年数
- **うち閉鎖系の追加** — 強化株のときだけ乗る費用。上の区分に含まれている分を、第1段の分と合わせて出す
- **総コスト** — 売価500円/m³に対して成立するか', updated_at = now() where cost_note_id = 'cn_260820_r1' and cost_model_id = 'cm_p21_260820';
insert into project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, visibility, sort_order) values ('cn4_c11', 'cm_p21_260820', 'caveat', 'C:オフサイトは、仮置きの前提で組んでいる', '**C:オフサイト**は、顧客工場の排液をタンクローリーでSX工場まで運び、SX工場で処理する形。

- 設備と処理の運転は、B:投入と同じもの（撹拌・UF/MF膜）をSX工場に置く前提。槽はSX工場に新設する（新設槽と同じ1,800万円・10年償却）
- 顧客工場へ菌体を運ぶ巡回と、顧客工場内の区画・立入制限は発生しない。菌体は同じSX工場で作って使う。強化株を使っても、組換え体を扱うのはSX工場の中だけになる
- 代わりに、排液の輸送（輸送の回数 ＝ 年間処理量 ÷ 1台の積載量）、受け入れ設備と受入検査、処理水の放流費と放流前の水質確認が乗る
- 輸送・受け入れ・放流の数字は、見積のない仮置き（確度H）
- 1社分の排液だけを処理する前提。複数の顧客の排液をまとめて処理したときに、設備と槽の償却が薄まる効果は入れていない
- 顧客の排液を運んで処理するときに要る許可（産業廃棄物の収集運搬業・処分業）の費用と期間は入れていない。要否は確認が要る', 'amd_internal', 110);
insert into project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, visibility, sort_order) values ('cn4_r6', 'cm_p21_260820', 'reading_guide', '作業の流れと工数の見方', '操作パネルの一番上の「作業の流れと工数」は、選んだ株・用途・方式で発生する作業を、流れの順に並べたもの。

1. **菌体をつくる** — 菌体の製造拠点での培養・濃縮
2. **菌体を運ぶ**（A・B） — 顧客工場への菌体の搬入と使用済み菌体の搬出、移動
3. **排液を運ぶ**（C） — 排液の積み込み・輸送・荷降ろし
4. **排液を処理する** — 1バッチごとの処理の運転（Cは受け入れた排液の検査と、放流前の水質確認も）
5. **設備を保つ** — 菌体保持モジュール（A）や膜（B・C）の交換
6. **使用済み菌体を後処理する** — 金属回収は酸処理と金属の回収、色素分解は脱水と処分の手配
7. **閉鎖系を管理する**（強化株のみ） — 安全委員会、密閉性能の検査、フィルター交換、立入制限と教育訓練

各段の時間は1年分の工数（人時）。顧客1社分の工数と、菌体の製造拠点の工数（拠点全体）は分けて出す。工数が「未確認」の作業は0時間として数えている。', 'amd_internal', 15);

-- 9. 確認事項
update project_cost_questions set status = 'dropped', answer = '金属回収は酸で菌体を溶かして金属を取り出すので、菌体を使い回さない前提にした（使用回数は1回で固定、2026-09-13 まさ）。色素分解で使い回すときの洗浄は、明細の「再利用前の洗浄（色素を外す工程）」で扱う。', answered_on = '2026-09-13', updated_at = now() where cost_question_id = 'cq_260820_13' and cost_model_id = 'cm_p21_260820';
insert into project_cost_questions (cost_question_id, cost_model_id, addressee, question, why_it_matters, impact_low, impact_high, status, linked_assumption_id, visibility, sort_order) values ('cq4_01', 'cm_p21_260820', '運送会社・産廃収集運搬業者（見積）', '工場の排液をタンクローリーで運ぶ場合の条件を教えてください。①1台に積める量（m³）②片道30km程度の往復と、積み込み・荷降ろしにかかる時間 ③運転手込みで1台頼んだときの運賃。', 'C:オフサイトの総コストでいちばん大きいのが排液を運ぶ費用（いまの仮置きで約2,000円/m³）。積載量が2倍になれば半分になる。', 0, 2000, 'open', 'ca4_truck_capacity_m3', 'amd_internal', 300);
insert into project_cost_questions (cost_question_id, cost_model_id, addressee, question, why_it_matters, impact_low, impact_high, status, linked_assumption_id, visibility, sort_order) values ('cq4_02', 'cm_p21_260820', 'AMD（内部）', 'オフサイトで顧客の排液を受け入れて処理する場合に、産業廃棄物の収集運搬業・処分業の許可が要るか、要るなら取得にかかる期間と費用を確認する。', 'C:オフサイトが成り立つかは、運ぶ費用だけでなく許可でも決まる。費用と期間はモデルに入れていない。', null, null, 'open', null, 'amd_internal', 310);
insert into project_cost_questions (cost_question_id, cost_model_id, addressee, question, why_it_matters, impact_low, impact_high, status, linked_assumption_id, visibility, sort_order) values ('cq4_03', 'cm_p21_260820', 'AMD（内部）', 'SX工場を置く候補地の自治体で、処理水を下水道へ流す場合の使用料（年3万m³規模、m³あたり）を調べる。河川へ流す場合に要る届出と水質の管理も確認する。', '放流費はいま250円/m³の仮置き。オンサイトでは発生しない費用なので、オンサイトとオフサイトの差に直接効く。', 0, 250, 'open', null, 'amd_internal', 320);
insert into project_cost_questions (cost_question_id, cost_model_id, addressee, question, why_it_matters, impact_low, impact_high, status, linked_assumption_id, visibility, sort_order) values ('cq4_04', 'cm_p21_260820', '杉浦先生', '菌体の製造拠点での毎日の作業について教えてください。①培養の管理（温度・pH・CO2の確認など）に1日何時間かかりますか ②菌体を濃縮して出荷できる状態にするのに、1回何時間かかり、週に何回やりますか。まだ分からない場合は、試験で何を記録すれば分かるようになるかを教えてください。', '培養・濃縮の運転の工数は空欄（0時間）で数えている。1日2時間なら年600時間で、菌体1kgの原価が約72円上がる（生産33,333kg、作業単価4,000円）。色素分解（使用回数1回）では総コストが約80円/m³上がる。', 0, 80, 'open', null, 'amd_internal', 330);
insert into project_cost_questions (cost_question_id, cost_model_id, addressee, question, why_it_matters, impact_low, impact_high, status, linked_assumption_id, visibility, sort_order) values ('cq4_05', 'cm_p21_260820', '中島先生', '使用済み菌体の後処理にかかる作業時間を教えてください。①金属回収で、1バッチ分の使用済み菌体を酸で溶かし、中和して金属を回収するまで ②色素分解で、1バッチ分の使用済み菌体を脱水して処分業者へ渡すまで。それぞれ ①30分以内 ②1〜2時間 ③半日 ④まだ分からない、のどれに近いですか。', '後処理の作業は工数を空欄（0時間）で数えている。1バッチ2時間なら年600時間で、総コストが約80円/m³上がる（作業単価4,000円、年300バッチ、年3万m³）。', 0, 80, 'open', null, 'amd_internal', 340);

commit;
