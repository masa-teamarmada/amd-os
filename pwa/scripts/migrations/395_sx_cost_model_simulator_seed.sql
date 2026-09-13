-- 395: SX コスト試算をシミュレーター型へ（2026-09-13 まさFB）
--
-- 先に 394 を適用すること。数字は変えずに、次を行う。
--   - 人件費と巡回サービス（labor_batch / patrol / patrol_module / patrol_membrane の明細と、その作業時間の前提）を作業リストへ移す
--   - 閉鎖系の追加費用のうち、作業にあたる行（密閉性能検査・除菌フィルターの交換・安全委員会と教育訓練）を作業リストへ移す。
--     工数の内訳が分かっていない行は工数を空欄（未確認）にし、これまでの年額を1回あたりの経費に置く
--   - 販売率（生産した菌体のうち売れる割合、既定100%）の前提を足す
--   - 画面の呼び名「中央培養」を「菌体の製造拠点」へ変え、前提を操作パネルの並びに組み直す。「人件費を除くと」に触れた文を直す
--   - 使わなくなった price_rule を制約から外す
-- 生成: えいみ 2026-09-13（SXセッション）。DB の現行行と migration 393 適用後の fixture を同じ変換定義から書き出した。
begin;

-- 1. 作業リスト（移す前と同じ年額になるように置く）
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_run_circulation', 'cm_p21_260820', '循環', null, null, '現場の運転', '現場の運転（A:循環、1バッチ）', 5.75, 'batch', null, null, 0, 'A', '先生回答', '中島先生', '出所：中島試算シート100m³ケース①循環。手動運用のときの時間。自動制御の無人運転で何時間まで減るかは未確認（ダイキアクシスへ確認中）。', 10, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_run_injection', 'cm_p21_260820', '投入', null, null, '現場の運転', '現場の運転（B:投入、1バッチ）', 7.5, 'batch', null, null, 0, 'A', '先生回答', '中島先生', '出所：中島試算シート100m³ケース②投入。手動運用のときの時間。自動制御の無人運転で何時間まで減るかは未確認（ダイキアクシスへ確認中）。', 20, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_delivery', 'cm_p21_260820', '共通', null, null, '巡回サービス', '菌体の搬入・使用済み菌体の搬出', 1.0, 'visit', null, null, 0, 'H', '仮置き', 'ダイキアクシス', '菌体の搬入と使用済み菌体の搬出を同じ訪問でまとめる前提。無人運転でも誰かがやるため、SX側の巡回サービスとして積む。訪問回数は、年間バッチ数 ÷ 大きい方（菌体使用回数、1回の搬入でまかなうバッチ数）。', 30, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_travel', 'cm_p21_260820', '共通', null, null, '巡回サービス', '移動（菌体の製造拠点と顧客工場の往復）', 2.0, 'visit', null, null, 5000, 'H', '仮置き', 'ダイキアクシス', '製造拠点の立地が決まるまで仮置き。1回の経費は車両費（燃料・車両償却・高速代の目安）。', 40, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_module_swap', 'cm_p21_260820', '循環', null, null, '巡回サービス', '菌体保持モジュールの交換作業', 4.0, 'module_swap', null, null, 0, 'H', '仮置き', 'ダイキアクシス', '移動は搬入の訪問に合わせる前提で、作業時間だけを積む。交換回数は、年間バッチ数 ÷ モジュール耐用バッチ数。部品代は明細の「菌体保持モジュール交換費」に別に積んでいる。', 50, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_membrane_swap', 'cm_p21_260820', '投入', null, null, '巡回サービス', '膜モジュールの交換作業', 8.0, 'membrane_swap', null, null, 0, 'H', '仮置き', 'ダイキアクシス', '移動は搬入の訪問に合わせる前提で、作業時間だけを積む。交換回数は、1 ÷ 膜交換年数。膜の部品代は明細の「UF/MF膜モジュール（交換品）」に別に積んでいる。', 60, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_c_integrity_test', 'cm_p21_260820', '中央培養', 'enhanced', null, '閉鎖系の追加（強化株のみ）', '培養設備の密閉性能検査', null, 'fixed', 1, null, 200000, 'H', '仮置き', '中島先生', '設置時と定期に、漏出防止に関わる部品を交換したときはその都度検査する。カテゴリー1相当で積んだ。GILSPと判定されれば不要になる可能性がある。検査の頻度と工数は未確認で、いまは年額20万円を1回分の経費として置いている。', 70, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_c_filter_replace', 'cm_p21_260820', '中央培養', 'enhanced', null, '閉鎖系の追加（強化株のみ）', '除菌フィルターの交換（製造拠点）', null, 'fixed', 4, null, 30000, 'H', '仮置き', '中島先生', '交換時に付着した菌を不活化する作業を含む。カテゴリー1相当で積んだ。GILSPと判定されれば不要になる可能性がある。作業時間とフィルター代の内訳は未確認で、いまは1回3万円（年4回で12万円）を経費として置いている。', 80, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_c_safety_committee', 'cm_p21_260820', '中央培養', 'enhanced', null, '閉鎖系の追加（強化株のみ）', '安全委員会の運営・教育訓練・記録保存', 60, 'fixed', 1, null, 0, 'H', '仮置き', '中島先生', '使用区分の判断の審議記録は、使用終了後20年保存する。年60時間で置いた。', 90, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_s_integrity_test', 'cm_p21_260820', '共通', 'enhanced', null, '閉鎖系の追加（強化株のみ）', '現場設備の密閉性能検査', null, 'fixed', 1, null, 150000, 'H', '仮置き', 'ダイキアクシス', 'カテゴリー1相当で積んだ。GILSPと判定されれば不要になる可能性がある。検査の頻度と工数は未確認で、いまは年額15万円を1回分の経費として置いている。', 100, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_s_filter_replace', 'cm_p21_260820', '共通', 'enhanced', null, '閉鎖系の追加（強化株のみ）', '除菌フィルターの交換（現場）', null, 'fixed', 2, null, 30000, 'H', '仮置き', 'ダイキアクシス', 'カテゴリー1相当で積んだ。GILSPと判定されれば不要になる可能性がある。作業時間とフィルター代の内訳は未確認で、いまは1回3万円（年2回で6万円）を経費として置いている。', 110, 'amd_internal');
insert into project_cost_tasks (cost_task_id, cost_model_id, scenario, strain, application, group_label, label, hours_per_occurrence, count_driver, count_per_year, hourly_rate, expense_per_occurrence, confidence, source_kind, owner, note, sort_order, visibility) values ('ct_s_training', 'cm_p21_260820', '共通', 'enhanced', null, '閉鎖系の追加（強化株のみ）', '立入制限・教育訓練（現場）', 10, 'fixed', 1, null, 0, 'H', '仮置き', 'ダイキアクシス', '教育訓練を受けた人以外の立入りを制限する。年10時間で置いた。', 120, 'amd_internal');

-- 2. 作業リストへ移した明細と前提
delete from project_cost_items where cost_model_id = 'cm_p21_260820' and cost_item_id in ('ci_260820_159', 'ci_260820_179', 'ci2_patrol_delivery', 'ci2_patrol_module', 'ci2_patrol_membrane', 'ci2_c_integrity_test', 'ci2_c_filter_replace', 'ci2_c_safety_committee', 'ci2_s_integrity_test', 'ci2_s_filter_replace', 'ci2_s_training');
delete from project_cost_assumptions where cost_model_id = 'cm_p21_260820' and cost_assumption_id in ('ca_batch_hours_circulation', 'ca_batch_hours_injection', 'ca2_patrol_work_hours', 'ca2_patrol_travel_hours', 'ca2_patrol_vehicle_cost', 'ca2_patrol_module_work_hours', 'ca2_patrol_membrane_work_hours');

-- 3. 販売率
insert into project_cost_assumptions (cost_assumption_id, cost_model_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('ca3_sales_rate', 'cm_p21_260820', '菌体の製造（第1段）', '販売率（生産した菌体のうち売れる割合）', 100, null, '%', 'C', '仮置き', 'AMD（内部）', true, 'sales_rate', 'コスト試算は全量が売れる前提（100%）で置く（2026-09-13 まさ）。下げると、売れ残りも作った分の費用はかかるので、第1段の全費用（培養設備の償却・年ごとの固定費・製造拠点の作業・菌体量に比例する費用）を売れた量で割る。50%なら菌体1kgの原価は2倍になる。', 'amd_internal', 12, null, null);

-- 4. 前提の並びと呼び名
update project_cost_assumptions set group_label = '菌体の製造（第1段）', sort_order = 10, label = '菌体の製造拠点の年間生産能力', note = '旧版は「必要な菌体量＝生産量」と暗黙に置いていた（1拠点・使い捨て・50ppm・α0.05で33,333kg/年）。その値を引き継いだ仮置き。培養液1Lあたりの1日の増殖量と培養容積の実測が入るまで確定しない。生産能力いっぱいに作る前提で、売れ残りの影響は販売率で見る。', updated_at = now() where cost_assumption_id = 'ca2_culture_capacity';
update project_cost_assumptions set group_label = '菌体の製造（第1段）', sort_order = 14, note = '空欄なら第1段の明細と作業から計算する。販売率で割る前の、生産1kgあたりの原価として入れる。値を入れるとその原価で第2段を計算する。閉鎖型の商用相場（約390〜770円/kg）を入れると、菌体原価が相場並みのときの成否が見られる。', updated_at = now() where cost_assumption_id = 'ca2_biomass_override';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 20, updated_at = now() where cost_assumption_id = 'ca2_target_concentration_dye';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 21, updated_at = now() where cost_assumption_id = 'ca_target_concentration';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 22, updated_at = now() where cost_assumption_id = 'ca2_uptake_alpha_dye';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 23, updated_at = now() where cost_assumption_id = 'ca_uptake_alpha';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 24, updated_at = now() where cost_assumption_id = 'ca2_uptake_alpha_metal_enhanced';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 25, updated_at = now() where cost_assumption_id = 'ca_reuse_count';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 26, updated_at = now() where cost_assumption_id = 'ca2_reuse_count_metal';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 27, updated_at = now() where cost_assumption_id = 'ca_recovery_eta';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 28, updated_at = now() where cost_assumption_id = 'ca_k_ppm';
update project_cost_assumptions set group_label = '規模と売価', sort_order = 40, updated_at = now() where cost_assumption_id = 'ca_sale_price';
update project_cost_assumptions set group_label = '規模と売価', sort_order = 41, updated_at = now() where cost_assumption_id = 'ca_batch_volume';
update project_cost_assumptions set group_label = '規模と売価', sort_order = 42, updated_at = now() where cost_assumption_id = 'ca_operating_days';
update project_cost_assumptions set group_label = '規模と売価', sort_order = 43, updated_at = now() where cost_assumption_id = 'ca_utilization';
update project_cost_assumptions set group_label = '作業の共通条件', sort_order = 50, label = '作業単価（共通）', note = '作業リストで作業単価を空欄にした行が、この単価を使う。現場の運転、巡回サービス、閉鎖系の作業に共通。', updated_at = now() where cost_assumption_id = 'ca_labor_rate';
update project_cost_assumptions set group_label = '作業の共通条件', sort_order = 51, note = '菌体を現場で何日保管できるかが分かるまで、週1回（5バッチ分）で置く。菌体使用回数がこれより多いときは、使用回数ごとに1回訪問する。作業リストの「訪問回数」はこの値で決まる。', updated_at = now() where cost_assumption_id = 'ca2_patrol_batches_per_delivery';
update project_cost_assumptions set group_label = 'A:循環方式', sort_order = 60, updated_at = now() where cost_assumption_id = 'ca_module_unit_price';
update project_cost_assumptions set group_label = 'A:循環方式', sort_order = 61, updated_at = now() where cost_assumption_id = 'ca_module_durability_batches';
update project_cost_assumptions set group_label = 'A:循環方式', sort_order = 62, updated_at = now() where cost_assumption_id = 'ca_hrt_circulation';
update project_cost_assumptions set group_label = 'A:循環方式', sort_order = 63, updated_at = now() where cost_assumption_id = 'ca_power_kw_circulation';
update project_cost_assumptions set group_label = 'B:投入方式', sort_order = 70, updated_at = now() where cost_assumption_id = 'ca_membrane_life_years';
update project_cost_assumptions set group_label = 'B:投入方式', sort_order = 71, updated_at = now() where cost_assumption_id = 'ca_hrt_injection';
update project_cost_assumptions set group_label = 'B:投入方式', sort_order = 72, updated_at = now() where cost_assumption_id = 'ca_power_kw_injection';
update project_cost_assumptions set group_label = '電力と槽', sort_order = 80, updated_at = now() where cost_assumption_id = 'ca_power_unit_price';
update project_cost_assumptions set group_label = '電力と槽', sort_order = 81, updated_at = now() where cost_assumption_id = 'ca_new_tank_capex';
update project_cost_assumptions set group_label = '電力と槽', sort_order = 82, updated_at = now() where cost_assumption_id = 'ca_tank_life_years';
update project_cost_assumptions set group_label = '使用済み菌体の処分', sort_order = 90, updated_at = now() where cost_assumption_id = 'ca2_spent_wet_factor';
update project_cost_assumptions set group_label = '使用済み菌体の処分', sort_order = 91, updated_at = now() where cost_assumption_id = 'ca2_sludge_disposal_price';
update project_cost_assumptions set group_label = '計算に使っていない前提', sort_order = 900, note = '260812打合せ：m³/日基準。計算はバッチ容量 × 稼働日 × 稼働率で年間処理量を出すので、この値は使っていない。', updated_at = now() where cost_assumption_id = 'ca_daily_volume';
update project_cost_assumptions set group_label = '計算に使っていない前提', sort_order = 901, note = 'プロセス分解P1。5g/L。いまの総コストの計算には使っていない（培養廃液の量の目安として参照）。', updated_at = now() where cost_assumption_id = 'ca_cell_density';
update project_cost_assumptions set group_label = '計算に使っていない前提', sort_order = 902, updated_at = now() where cost_assumption_id = 'ca_tank_mode';
update project_cost_assumptions set group_label = '計算に使っていない前提', sort_order = 903, label = '（旧版）供給先数（菌体の製造拠点の按分先）', updated_at = now() where cost_assumption_id = 'ca_supply_sites';

-- 5. 明細の注記（呼び名）
update project_cost_items set note = '菌体の製造拠点の構成は「円盤型培養設備／培養液供給設備／菌体濃縮設備／菌体保管・輸送設備」。
以下14項目は円盤型培養設備（培養槽本体・架台）
培養液供給設備（配管・継手バルブ・CO2供給・培養ポンプ・pH計・温度計・OD濁度計・制御盤・センサー配線）
付帯工事（洗浄用付帯設備・据付工事・輸送試運転）に相当する。', updated_at = now() where cost_item_id = 'ci_260820_043';
update project_cost_items set note = '菌体の製造拠点で培養液から菌体を分離・濃縮する設備。現行の培養槽まわり14項目には含まれていなかったため新規計上。金額は予測値（連続式遠心分離機または膜濃縮ユニット小型機を想定）。実機選定・見積で要更新。', updated_at = now() where cost_item_id = 'ci_260820_057';
update project_cost_items set note = '濃縮した菌体を製造拠点で保管し、各現場へ輸送するための設備。現行14項目には含まれていなかったため新規計上。金額は予測値（保冷保管タンク＋輸送用容器を想定）。OPEX側の「保管容器」「搬送容器・梱包」「搬送費」は現場側の物流費として別計上済み。実機選定・見積で要更新。', updated_at = now() where cost_item_id = 'ci_260820_061';
update project_cost_items set note = '菌体の製造拠点で発生する菌体製造費。現場設備OPEXとは分離し「菌体の製造拠点」の区分へ。菌体製造原価として事業全体で別途配賦する。 二段階版で 円/m³ → 円/kg-DCW へ換算した（旧版の基準菌体量 1.111 kg-DCW/m³ で割った値）。', updated_at = now() where cost_item_id = 'ci_260820_120';
update project_cost_items set note = '菌体の製造拠点から現場への菌体輸送・保管にかかる費用のため、現場側コストとして残す（培養そのものの費用ではなく、拠点ごとに発生する物流費）。金額は仮置きで、製造拠点⇔現場の距離・頻度が決まり次第見直す。 二段階版で 円/m³ → 円/kg-DCW へ換算した（旧版の基準菌体量 1.111 kg-DCW/m³ で割った値）。', updated_at = now() where cost_item_id = 'ci_260820_131';
update project_cost_items set note = '菌体そのものはモジュール部材ではないため内訳から除外（金額0円）。シアノは菌体の製造拠点から供給され、菌体のロス・性能低下は141・142行（循環）／159・160行（投入）で別途計上している。モジュール（膜・バッグ・フィルター・支持材）と菌体は寿命が別物であるため分離して管理する。', updated_at = now() where cost_item_id = 'ci_260820_154';

-- 6. 試算の説明
update project_cost_models set version_label = '260913 作業リスト版', summary_md = 'SXの排液処理を、**菌体の製造原価**と**用途別の処理原価**の二段階で試算する。

**第1段 菌体の製造原価** — 株（強化株／自然株）ごとに、菌体の製造拠点で乾燥菌体1kgをつくる原価を出す。菌体の製造拠点は、顧客工場では培養せず、SX側の1拠点でまとめて菌体を育て、濃縮して各工場へ運ぶところ。同じ株なら用途では変わらない。強化株は閉鎖系の追加費用が乗る。生産した菌体のうち売れる割合（販売率）で割るので、売れ残りが出ると1kgあたりの原価は上がる。

**第2段 用途別の処理原価** — 第1段の原価を一定として、色素分解と金属回収のそれぞれで排水1m³あたりの総コストを出す。用途で変わるのは、必要な菌体の量（対象物質の濃度 ÷ 取り込み効率 ÷ 菌体使用回数）と、使用済み菌体の後処理。

操作パネルで株・用途・方式・槽を切り替え、前提・作業リスト・明細の数字を書き換えると、結果がその場で再計算される。書き換えた数字は保存されない。正本へ書くのは、管理者が「この値を保存」を押したときだけ。

ちこ作成の260820版の明細を土台に、2026-09-13に二段階へ組み替えた。人件費・巡回サービス・閉鎖系の追加費用・色素用の後処理・色素の濃さを追加し、いずれも確度つきで置いている。同日、人件費を作業リスト（作業ごとの工数 × 作業単価）で持つ形に変え、販売率を足した。', system_scope_md = '**対象** — 工場排液を、生きたシアノバクテリア（藍藻）で処理する。用途は色素分解と金属回収の2つを並べる。

**規模** — 顧客工場1拠点あたり 100 m³/日 × 300 日/年 ＝ 30,000 m³/年。1バッチ100 m³、反応時間（HRT）4時間のバッチ運転。

**第1段：菌体は菌体の製造拠点で作る** — 顧客工場では培養せず、SX側の1拠点でまとめて菌体を育て、濃縮して各工場へ運ぶ。乾燥菌体1kgあたりの原価は、「(培養設備の償却年額 ＋ 年ごとの固定費 ＋ 製造拠点の作業) ÷ 年間生産能力 ＋ 菌体量に比例する費用」を販売率で割って出す。年間生産能力いっぱいに作り、そのうち販売率（既定100%）の分が売れる前提。売れ残りも作った分の費用はかかる。

**第2段：方式は2つを並べて比較する**
- **A：循環カートリッジ方式** — 菌体をカートリッジ内の保持モジュールに留め、排液を循環させて接触させる。モジュールは耐用バッチ数ごとに交換する。
- **B：直接投入方式** — 菌体を槽へ直接投入して撹拌し、反応後に UF/MF 膜で菌体を分離回収する。膜は約3年で交換する。

**槽は既設／新設の2通り** — 顧客の既存調整タンクを流用できれば0円。新設ならコンクリート地下タンク100 m³で1,800万円（10年償却）。方式×槽で、用途ごとに4シナリオになる。

**設備は独立プラント新設ではなく増分アドオン** — 顧客の既存調整タンク・排水ライン・ユーティリティ・主処理設備を使い、密閉接触・循環、菌体捕捉、回収サービスを足す（2026-07-23 確定）。

**収益モデル** — 処理費のみ。売価500円/m³。回収物（金属など）の売却収入はまだモデルに入れていない。

**作業（人件費）** — 総コストに入れる（2026-09-13 まさ指示）。作業リストに、作業ごとの1回の工数・年間回数・作業単価・1回の経費を置き、年額 ＝ 年間回数 ×（工数 × 作業単価 ＋ 経費）で積む。現場の運転は中島先生の試算にある手動運用の作業時間で置いている。菌体の搬入・搬出、移動、モジュール・膜の交換、閉鎖系の検査や安全委員会も同じリストに並べる。', source_note = '原典: Google Sheets SX_コスト試算_260820 (ちこ)。中島先生の設備・運用想定を反映した版。 2026-09-13 に二段階版へ組み替え（migration 393）。 同日、作業リストと販売率を足した（migration 394/395）。', updated_at = now() where cost_model_id = 'cm_p21_260820';

-- 7. 注記
update project_cost_notes set title = '菌体製造原価の外部相場（微細藻類・シアノバクテリア）', body_md = 'この試算の菌体の製造原価（第1段、菌体1kgあたり）を、公表されている培養原価と突き合わせるための参照値。1ドル150円換算。

| 方式 | 原価 | 円換算 |
|---|---|---|
| オープンレースウェイ（TEA最良値） | $0.67/kg | 約100円/kg |
| オープンレースウェイ（一般） | $2〜15/kg | 約300〜2,250円/kg |
| **スピルリナ・閉鎖型PBR（商用・最新）** | **$2.57〜5.10/kg** | **約390〜770円/kg** |
| PBR（一般） | $32/kg | 約4,800円/kg |

**SXは強化株＋カルタヘナ法で閉鎖系が前提なので、オープンレースウェイの値は使えない。** 比べるべきは閉鎖型PBRの390〜770円/kg。

ただし公平に見ると、上の閉鎖系の値は食品・飼料グレードの精製前提なので、排水処理用の菌体はもっと安くできる余地がある。一方でスピルリナは年間数千トン規模の工場での数字であり、SXは年間33トン規模。規模が2桁小さいぶん単価は上がる方向に働く。', updated_at = now() where cost_note_id = 'cn_260820_b1';
update project_cost_notes set title = '人件費を総コストから外した判断の裏付け', body_md = '中島先生の当初設計は人員が張り付く前提だった。それではコスト的に成立せず、そもそも静脈側（排水処理）に人を張り付ける装置は売れないという判断で、ほぼ人件費のかからない想定へ切り替えた（まさ判断）。

同じツムラヒアリングに、この判断を支える一次情報がある。

- 排水処理・ユーティリティ管理は**有資格者が必要**で、50〜60代のベテランが数年以内に退職する懸念
- 担当者が2名で空き人材がいない場合、**1名の退職だけで工場運転不能になるリスク**
- 育成・採用が追いつかず、**運転管理のアウトソース化を含む対策を模索中**。外部委託サービスへの問い合わせが増加

つまり「人を減らせる」はこの市場ではむしろ売り文句になる。ただし**顧客側の人が0人になるなら、菌体の搬入・使用済み菌体の搬出・モジュール／膜の交換は誰かがやることになり、SX側の巡回サービス原価として立て直す必要がある（二段階版で作業リストへ入れた）**。

**2026-09-13 追記**: 人件費は総コストへ入れ、作業リスト（作業ごとの工数 × 作業単価）で動かす形にした（まさ指示）。無人運転を狙う判断は変えていないが、作業時間が確認できるまでは手動運用の値で積む。無人運転に近づけたときの数字は、作業リストの工数を下げて見る。', updated_at = now() where cost_note_id = 'cn_260820_b3';
update project_cost_notes set title = '菌体の寿命は3層に分けて扱う', body_md = '中島先生の回答④。寿命は「ハウジング」「菌体保持膜」「菌体そのものの吸収可能回数」の3層を別々に扱う必要がある。このうち**菌体そのものの寿命は未確定なので、この試算では数値を置いていない**（循環・直接投入の両方式に共通）。

技術的に何回いけるかが分かっても、それだけでは決まらない。**再生コスト（酸処理設備・未計上）と新規培養コスト（菌体の製造拠点の設備）が揃ってはじめて「何回使うのが得か」が決まる**。両方が入ってから、菌体ロス補充・性能低下分の式を組み直す。', updated_at = now() where cost_note_id = 'cn_260820_c1';
update project_cost_notes set title = '処理槽のオンライン菌体濃度計は入れていない', body_md = '中島先生の回答B②。処理槽内の菌体濃度に必ずしもオンライン計器は要らない。直接投入方式なら「投入した菌体濃度 × 投入液量 ÷ 排水量」で初期濃度を計算でき、運転中の確認は実証段階なら採水してOD・乾燥重量で測れば足りる。よって基本設備には入れていない（0円）。

商用設備で連続監視が必要になれば、濁度計・光学式バイオマスセンサー等の追加を検討する。**菌体の製造拠点の設備に入っているOD/濁度計15万円は製造拠点側の計器であり、これとは別**。', updated_at = now() where cost_note_id = 'cn_260820_c3';
update project_cost_notes set title = '菌体の製造原価は、生産能力いっぱいに作り、売れた量で割っている', body_md = '乾燥菌体1kgの原価は、「(培養設備の償却年額 ＋ 年ごとの固定費 ＋ 製造拠点の作業) ÷ 年間生産能力 ＋ 菌体量に比例する費用」を**販売率**で割って出す。

**年間生産能力いっぱいに作る前提**。販売率（既定100%）は、作った菌体のうち売れる割合。売れ残りが出ても作った分の費用はかかるので、全費用を売れた量で割る。販売率を下げると、1kgあたりの原価はその分だけ上がる（50%なら2倍）。旧版の「供給先数で割る」はこの考え方に置き換えたため使っていない。

年間生産能力（33,333kg/年）は、旧版が暗黙に置いていた「必要な菌体量＝生産量」を引き継いだ仮置き。培養液1Lあたりの1日の増殖量と培養容積が分かるまで確定しない。', updated_at = now() where cost_note_id = 'cn_260820_c4';
update project_cost_notes set title = '現場の運転は、手動運用の作業時間で入れている', body_md = '作業リストの「現場の運転」は、中島先生の試算にある1バッチあたりの作業時間（A:循環5.75時間、B:投入7.5時間）で置いている。

自動制御で無人運転する設計方針は変えていない。無人運転で何時間まで減るかが分かっていないため、いまは根拠のある手動運用の値を使っている。無人運転に近づけたときの総コストは、作業リストの工数を下げて見る。', updated_at = now() where cost_note_id = 'cn2_c8';
update project_cost_notes set title = 'この画面の使い方', body_md = '1. **切り替える** — 操作パネルの上で、株・用途・方式・槽を選ぶ。結果の表のマスを押しても選べる。切り替えは保存されない
2. **数字を動かす** — 前提、作業リスト、明細の数字を書き換えると、結果がその場で再計算される。書き換えた数字には印が付き、結果には保存値からの差が出る
3. **戻す・保存する** — 「すべて戻す」で保存値に戻る。管理者は「この値を保存」で正本へ書ける
4. **第1段と第2段** — 第1段は菌体1kgの原価で、同じ株なら用途では変わらない。第2段は用途ごとの処理原価で、違うのは排水1m³に使い切る菌体の量と後処理', updated_at = now() where cost_note_id = 'cn2_r5';
update project_cost_notes set title = '各行が何を見るためのものか', body_md = '- **第1段 菌体の製造原価** — 株ごとに、乾燥菌体1kgをつくる原価。培養設備の償却・年ごとの固定費・製造拠点の作業・菌体量に比例する費用に分け、販売率で割って見る
- **第2段 菌体費** — 第1段の原価 × 排水1m³あたりに使い切る菌体量
- **現場設備 OPEX／CAPEX** — 方式ごとのコア工程（循環＝カートリッジ、投入＝UF/MF）と、槽
- **現場と巡回の作業** — 作業リストの年額。現場の運転、菌体の搬入・搬出、移動、モジュールと膜の交換作業。工数と作業単価で動かす
- **閉鎖系の追加** — 強化株のときだけ乗る費用。第1段の分と現場の分の合計
- **後処理** — 使用済み菌体の後始末。金属回収は酸処理、色素分解は汚泥としての処分
- **事業全体 総コスト** — 売価500円/m³に対して成立するか', updated_at = now() where cost_note_id = 'cn_260820_r1';
update project_cost_notes set title = '投資回収年数を保留にしている理由', body_md = '菌体の製造拠点を共用資産として切り出した結果、**見るべき経済性が3つに分かれた**。単一の「投資回収○年」では表せないため保留にしている。

1. **1m³処理して儲かるか** — 本表が答えているのはここだけ
2. **現場設備への投資は回収できるか** — 誰がCAPEXを持つかが決まってから。顧客購入なら顧客ROI、SX保有ならSXの案件単位回収期間
3. **菌体の製造拠点は何顧客で成立するか** — 何拠点／どれだけの供給量で固定CAPEXを吸収できるか。「○年」より**損益分岐となる供給拠点数・年間供給量**の方が事業上重要

顧客側の判断基準は「設備投資＋ランニングで5年回収」（ツムラヒアリング）なので、2番は先方提案の前に必ず要る。', updated_at = now() where cost_note_id = 'cn_260820_r2';
update project_cost_notes set title = '色素分解は、菌体使用回数で総コストが大きく動く', body_md = '色素分解の菌体使用回数だけを動かしたときの総コスト（円/m³）。他の前提は据え置き。

| 株 | 菌体使用回数 | 色素分解 B:投入／既設 |
|---|---|---|
| 強化株 | 1回 | 878.0 |
| 強化株 | 10回 | 540.0 |
| 強化株 | 30回 | 504.9 |
| 自然株 | 1回 | 826.5 |
| 自然株 | 10回 | 517.2 |
| 自然株 | 30回 | 484.2 |

旧版では菌体の製造拠点の設備償却が使用回数に連動しない固定額だったため、10回を超えると頭打ちになっていた。二段階版では菌体原価を1kgあたりで持つので、**菌体費と使用済み菌体の処分費がどちらも使用回数に反比例する**。

杉浦先生へは引き続き「10回を超えるか」を確認する。', updated_at = now() where cost_note_id = 'cn_260820_r3';
insert into project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, visibility, sort_order) values ('cn3_h4', 'cm_p21_260820', 'history', '260913 作業リスト版（シミュレーターへの作り直し）', '2026-09-13、まさのフィードバックで、画面を「操作と結果を並べて見るシミュレーター」に作り直した。

**なぜ変えたか**: 数値があちこちに分かれ、動かす入力が結果と離れた場所にあって、比較検討ができなかった。「中央培養」という呼び名も伝わっていなかった。

**何を変えたか**
- 操作パネル（株・用途・方式・槽の切り替え、未確定の前提、作業リスト、明細）と、結果（用途×方式×槽の総コスト、内訳、成立ラインとの差、菌体1kgの原価）を同じ画面に並べた
- 前提・作業・明細の数字を画面で書き換えると、その場で再計算するようにした。保存はしない。管理者が「この値を保存」を押したときだけ正本へ書く
- 人件費は「人件費を除くと」の併記をやめ、作業リスト（作業ごとの1回の工数・年間回数・作業単価・1回の経費）で動かす形にした。現場の運転、菌体の搬入・搬出、移動、モジュール・膜の交換、閉鎖系の検査・フィルター交換・安全委員会・教育訓練を同じリストに並べた
- 販売率（生産した菌体のうち売れる割合、既定100%）を足した。売れ残りも作った分の費用はかかるので、第1段の全費用を売れた量で割る
- 「中央培養」を「菌体の製造拠点」と呼ぶことにした

**数字は変わっていない**: 作業リストへ移した行は、移す前と同じ年額になるように置いた。B:投入／既設は、強化株で色素分解 878.0円/m³・金属回収 715.0円/m³、自然株で色素分解 826.5円/m³・金属回収 708.1円/m³のまま。検査やフィルター交換のように作業時間の内訳が分かっていない行は、工数を空欄（未確認）にし、これまでの年額を1回あたりの経費に置いている。', 'amd_internal', 40);

-- 8. 確認事項
update project_cost_questions set why_it_matters = '菌体使用回数は総コスト最大の感度。1回のままだと菌体の製造原価がそのまま効き、10回を超えると菌体費は1割以下になる。20回と50回の差はほとんど無いので「10回を超えるか」だけ言い切れれば足りる。まさの記憶では数十回いける可能性があるが2026-08-23時点で未確認。', updated_at = now() where cost_question_id = 'cq_260820_01';
update project_cost_questions set why_it_matters = '菌体の製造原価は自然株で98.5円/kg-DCW（強化株127.1円）。閉鎖系スピルリナの商用実績$2.57〜5.10/kg（約390〜770円/kg）と比べて4〜8倍楽観の可能性がある。円で聞いても答えは出ないので、量と条件だけをもらってAMD側で円へ変換する。', updated_at = now() where cost_question_id = 'cq_260820_02';
update project_cost_questions set why_it_matters = '260820版は人件費を総コストへ入れておらず（参考値でA:230円/m³、B:300円/m³）、菌体の搬入・搬出や交換の作業も入っていなかった。二段階版からは、作業リストに手動運用の作業時間と巡回の作業を入れている。無人運転で実際に残る作業と時間が分かれば、作業リストの工数と回数を置き換える。', updated_at = now() where cost_question_id = 'cq_260820_06';
update project_cost_questions set answer = '二段階版で菌体の原価を1kgあたりに換算したので、菌体使用回数を上げると培養設備の償却分も含めて回数分下がるようになった。代わりに「菌体の製造拠点の年間生産能力」を仮置きしており、実測待ち。現場側物流の搬送費は巡回サービスへ統合した。', updated_at = now() where cost_question_id = 'cq_260820_11';
update project_cost_questions set question = '投資回収を2つに分けて設計し直す。(1) 現場設備の回収性 — 誰がCAPEXを持つかを決めてから、顧客購入なら顧客ROI、SX保有ならSXの案件単位回収期間。(2) 菌体の製造拠点の回収性 — 損益分岐となる供給拠点数・年間供給量。', updated_at = now() where cost_question_id = 'cq_260820_14';
update project_cost_questions set why_it_matters = '菌体の製造拠点を共用資産として切り出したため、単一の「投資回収○年」では表せず現在は算出保留。一方でツムラヒアリングによれば顧客側の判断基準は「設備投資＋ランニングで5年で回収できるか」なので、先方へ提案する前に(1)は必ず要る。', updated_at = now() where cost_question_id = 'cq_260820_14';
update project_cost_questions set question = '1拠点あたり年商1,500万円（30,000 m³ × 500円）という規模を、FY35 売上200億円の目標へ接続する。何拠点必要か、菌体の製造拠点は何箇所要るかを出す。', updated_at = now() where cost_question_id = 'cq_260820_16';
update project_cost_questions set why_it_matters = '現行モデルは1拠点の単体採算しか答えていない。利益率が何%であっても、必要拠点数が現実的でなければ事業計画として成立しない。菌体の製造拠点の損益分岐供給量とセットで見る必要がある。', updated_at = now() where cost_question_id = 'cq_260820_16';

-- 9. 人件費と巡回は作業リスト（project_cost_tasks）で持つので、price_rule の labor_batch / patrol / patrol_module / patrol_membrane は外す
alter table project_cost_items drop constraint if exists project_cost_items_price_rule_check;
alter table project_cost_items add constraint project_cost_items_price_rule_check
  check (price_rule is null or price_rule in ('biomass', 'broth', 'module_swap', 'power_circulation', 'power_injection', 'spent_disposal'));

commit;
