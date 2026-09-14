-- 407: SX コスト試算の作業単価を共通の1つにし、前提を「事業と処理の条件 / CAPEX / OPEX」の区分に並べ直す（2026-09-14 まさFB）
--
-- まさ「工数単価は共通で１つのパラメータで入力するようにして。現状だと工程ごとに単価を決める仕様になっているけど、それぞれで変えることは想定してないので」
-- 「前提となるパラメータについて、ページのあちこちに散らばってて、どこにあるか分からん。CAPEXとOPEXに分けて、さらにそれぞれのサブグループに分けるなどして整理してほしい」
-- 「デフォルトが強化株になってるから、自然株に変えて」「年間処理量みたいな桁の大きい数字は必ず３桁ごとにカンマ入れて」
-- 先に 406（作業ごとの作業単価 hourly_rate を空欄に固定）を適用すること。この変更に対応した画面の配信が済んでから適用すること。
--   - 前提の group_label と sort_order を、画面の区分（pwa/src/lib/project-cost-model.ts の COST_PARAM_GROUPS）の名前と順にそろえる
--   - 電力の区分に並ぶ反応時間2行を、装置の名前で呼び分ける。作業単価（共通）の単位と注記を、共通の1つだという書き方にする
--   - 説明文・注記・確認事項の桁の大きい量を3桁カンマで書き、開いたときの株（自然株）の数字を先に書く。版の履歴を1件足す
--   - 値（value）・明細・作業の数字は変えない（総コストは変わらない）
-- 生成: えいみ 2026-09-14（SXセッション）。DB の現行行と migration 405 適用後の fixture を同じ変換定義から書き出した。
begin;

-- 1. 前提: 画面と同じ区分（事業と処理の条件 100番台 / CAPEX 200番台 / OPEX 300番台）の名前と順に並べ直す
update project_cost_assumptions set group_label = '事業の規模と売価', sort_order = 100, updated_at = now() where cost_assumption_id = 'ca6_business_annual_volume' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '事業の規模と売価', sort_order = 101, updated_at = now() where cost_assumption_id = 'ca_sale_price' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '顧客1社の処理', sort_order = 110, updated_at = now() where cost_assumption_id = 'ca_batch_volume' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '顧客1社の処理', sort_order = 111, updated_at = now() where cost_assumption_id = 'ca_operating_days' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '顧客1社の処理', sort_order = 112, updated_at = now() where cost_assumption_id = 'ca_utilization' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 120, updated_at = now() where cost_assumption_id = 'ca2_target_concentration_dye' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 121, updated_at = now() where cost_assumption_id = 'ca_target_concentration' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 122, updated_at = now() where cost_assumption_id = 'ca2_uptake_alpha_dye' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 123, updated_at = now() where cost_assumption_id = 'ca_uptake_alpha' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 124, updated_at = now() where cost_assumption_id = 'ca2_uptake_alpha_metal_enhanced' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 125, updated_at = now() where cost_assumption_id = 'ca_reuse_count' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 126, updated_at = now() where cost_assumption_id = 'ca_recovery_eta' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '対象物質と菌体の量', sort_order = 127, updated_at = now() where cost_assumption_id = 'ca_k_ppm' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '菌体の製造量と原価', sort_order = 130, updated_at = now() where cost_assumption_id = 'ca3_sales_rate' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '菌体の製造量と原価', sort_order = 131, updated_at = now() where cost_assumption_id = 'ca2_biomass_override' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '菌体の製造拠点（培養設備）', sort_order = 200, updated_at = now() where cost_assumption_id = 'ca2_culture_capacity' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '槽', sort_order = 230, updated_at = now() where cost_assumption_id = 'ca5_onsite_tank_bearer' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '槽', sort_order = 231, updated_at = now() where cost_assumption_id = 'ca_new_tank_capex' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '槽', sort_order = 232, updated_at = now() where cost_assumption_id = 'ca_tank_life_years' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '人件費（作業）', sort_order = 300, updated_at = now() where cost_assumption_id = 'ca_labor_rate' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '運ぶ', sort_order = 310, updated_at = now() where cost_assumption_id = 'ca2_patrol_batches_per_delivery' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '運ぶ', sort_order = 311, updated_at = now() where cost_assumption_id = 'ca4_truck_capacity_m3' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '交換部品', sort_order = 330, updated_at = now() where cost_assumption_id = 'ca_module_unit_price' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '交換部品', sort_order = 331, updated_at = now() where cost_assumption_id = 'ca_module_durability_batches' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '交換部品', sort_order = 332, updated_at = now() where cost_assumption_id = 'ca_membrane_life_years' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '電力', sort_order = 340, updated_at = now() where cost_assumption_id = 'ca_power_unit_price' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '電力', sort_order = 341, updated_at = now() where cost_assumption_id = 'ca_power_kw_circulation' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '電力', sort_order = 342, updated_at = now() where cost_assumption_id = 'ca_hrt_circulation' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '電力', sort_order = 343, updated_at = now() where cost_assumption_id = 'ca_power_kw_injection' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '電力', sort_order = 344, updated_at = now() where cost_assumption_id = 'ca_hrt_injection' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '使用済み菌体の後処理', sort_order = 360, updated_at = now() where cost_assumption_id = 'ca2_spent_wet_factor' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set group_label = '使用済み菌体の後処理', sort_order = 361, updated_at = now() where cost_assumption_id = 'ca2_sludge_disposal_price' and cost_model_id = 'cm_p21_260820';

-- 2. 前提: 電力の区分に2つ並ぶ反応時間を、装置の名前で見分けられるようにする。作業単価は共通の1つだと書く
update project_cost_assumptions set label = '循環カートリッジ：反応時間（基準ケース）', unit = '時間', updated_at = now() where cost_assumption_id = 'ca_hrt_circulation' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set label = '直接投入：反応時間（基準ケース）', unit = '時間', updated_at = now() where cost_assumption_id = 'ca_hrt_injection' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set unit = '円/時', note = 'すべての作業に共通の作業単価。作業ごとには持たない（2026-09-14 まさ「工数単価は共通で１つのパラメータで入力するようにして」）。作業の年額 ＝ 年間回数 ×（1回の工数 × この単価 ＋ 1回の経費）。菌体の製造拠点の作業、菌体を運ぶ作業、SX工場での処理の運転、設備の交換、閉鎖系の作業のすべてに使う。', updated_at = now() where cost_assumption_id = 'ca_labor_rate' and cost_model_id = 'cm_p21_260820';
update project_cost_assumptions set note = 'IPOできる大量生産の状態を前提に、売上100億円に届く量で置いた（2026-09-14 まさ「この計算はIPOできるレベルの大量生産状態を前提にしたいので、売上100億到達レベルを前提にしたパラメータにして」）。売上 ＝ 年間処理量 × 想定売上単価（いまは500円/m³）＝ 100億円/年。顧客1社あたり年30,000m³（100m³/日 × 300日）なら約667社分。菌体の製造拠点で年に作る量は、この量 × 使い切る菌体量 ÷ 販売率 で計算する（入力ではない）。用途ごとに、その用途だけでこの量を処理したときとして出す。売価を変えると売上も変わるので、売上100億円に合わせるときはこの量も変える。', updated_at = now() where cost_assumption_id = 'ca6_business_annual_volume' and cost_model_id = 'cm_p21_260820';

-- 3. 試算の説明: 桁の大きい量は3桁カンマで書く。開いたときの株（自然株）の数字を先に書く。作業単価は共通の1つ。区分の並び
update project_cost_models set summary_md = 'SXの排液処理を、**菌体の製造原価**と**用途別の処理原価**の二段階で試算する。

**事業の規模は売上100億円** — IPOできる大量生産の状態を前提に、年間処理量を20,000,000m³/年で置く（売価500円/m³で売上100億円。2026-09-14 まさ）。顧客1社あたり年30,000m³なら約667社分。菌体の製造拠点で年に作る量は、色素分解が株によらず約2,222t、金属回収が自然株で約26,455t・強化株で約20,964t（強化株は金属の取り込み効率が高い）。

**第1段 菌体の製造原価** — 株（強化株／自然株）ごとに、菌体の製造拠点で乾燥菌体1kgをつくる原価を出す。菌体の製造拠点は、顧客工場では培養せず、SX側でまとめて菌体を育て、濃縮して各工場へ運ぶところ。**年に作る量は計算で出す**（年間処理量 × 使い切る菌体量 ÷ 販売率）。今の明細を培養設備の1系列として必要な数だけ並べるので、設備・固定費・系列ごとの作業は1kgあたり変わらず、拠点に1つの作業だけが量で薄まる。同じ株なら、1kgあたりの原価は用途でほとんど変わらない（自然株で98.5円、強化株で色素分解 120.1円・金属回収 120.0円）。強化株は閉鎖系の追加費用が乗る。生産した菌体のうち売れる割合（販売率）で割るので、売れ残りが出ると1kgあたりの原価は上がる。

**第2段 用途別の処理原価** — 第1段の原価を一定として、色素分解と金属回収のそれぞれで排水1m³あたりの総コストを出す。用途で変わるのは、必要な菌体の量（対象物質の濃度 ÷ 取り込み効率 ÷ 菌体使用回数）と、使用済み菌体の後処理。菌体を使い回せるのは色素分解だけで、金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定する。色素分解は10回使い回す前提で置いている（2026-07の設備アドオン試算と同じ。杉浦先生に確認中）。

**方式と装置を分けて並べる** — 方式は、顧客工場で処理するオンサイトと、排液をSX工場まで運んで処理するオフサイトの2つ。装置は、菌体を筒に閉じ込めて排液を通す循環カートリッジと、菌体を槽に入れて混ぜ膜でこし取る直接投入の2つで、どちらの方式でも選べる。

**SXの原価に入れるのはSXがやる作業だけ** — 顧客工場での処理の運転は顧客がやる作業として、SXの原価にも作業時間にも入れない。オフサイトではSX工場でSXが運転するので、SXの原価に入る。

**顧客工場の設備と汚泥の処分は顧客が持つ** — 顧客工場に置くリアクター（処理設備）と槽は顧客が買い、顧客工場で出る使用済み菌体の汚泥の処分も顧客がやる（2026-09-14 まさ）。どちらもSXの原価に入れない。明細ごとに誰が持つか（SX / 顧客 / 処理する場所の持ち主）を持ち、画面で変えられる。SX工場で処理するオフサイトでは、設備・槽・汚泥の処分はSXが持つ。

操作パネルで株・用途・方式・装置・槽を切り替え（開いたときは自然株）、前提・作業リスト・明細の数字を書き換えると、結果がその場で再計算される。前提・作業リスト・明細は「事業と処理の条件」「CAPEX（初期投資）」「OPEX（毎年の費用）」の3つに分け、その中を小分けにして並べる。作業単価はすべての作業に共通の1つ。結果の欄には総コストの内訳を棒グラフで出し、操作パネルの一番上には作業の流れと段ごとの年間工数を出す。書き換えた数字は保存されない。正本へ書くのは、管理者が「この値を保存」を押したときだけ。

ちこ作成の260820版の明細を土台に、2026-09-13に二段階へ組み替えた。人件費・巡回サービス・閉鎖系の追加費用・色素用の後処理・色素の濃さを追加し、いずれも確度つきで置いている。同日、人件費を作業リスト（作業ごとの工数 × 作業単価）で持つ形に変え、販売率を足した。さらに同日、作業を流れの段に並べ直し、オフサイトの比較を足した。2026-09-14 に、方式（オンサイト / オフサイト）と装置（循環カートリッジ / 直接投入）を分け、作業ごとに誰がやるかを持たせた。同日、色素分解の菌体使用回数を10回にし、顧客工場のリアクター・槽と汚泥の処分を顧客が持つ形にした。同日、年間生産能力を入力から外し、年間処理量（売上100億円に届く20,000,000m³/年）から年に作る量を計算する形にした。同日、作業単価をすべての作業に共通の1つにし、前提・作業リスト・明細を「事業と処理の条件 / CAPEX / OPEX」の区分に並べ直した。', system_scope_md = '**対象** — 工場排液を、生きたシアノバクテリア（藍藻）で処理する。用途は色素分解と金属回収の2つを並べる。

**規模** — 事業全体で年間 20,000,000 m³（売価500円/m³で売上100億円。IPOできる大量生産の状態、2026-09-14 まさ）。顧客工場1拠点あたり 100 m³/日 × 300 日/年 ＝ 30,000 m³/年で、約667社分。1バッチ100 m³、反応時間（HRT）4時間のバッチ運転。

**第1段：菌体は菌体の製造拠点で作る** — 顧客工場では培養せず、SX側でまとめて菌体を育て、濃縮して各工場へ運ぶ。年に作る量 ＝ 年間処理量 × 使い切る菌体量 ÷ 販売率（入力ではなく計算。2026-09-14 まさ）。今の明細を培養設備の1系列（年33,333kg、仮置き）として、年に作る量 ÷ 1系列 の数だけ並べ、1拠点に置く。乾燥菌体1kgあたりの原価は、「(設備の償却年額 ＋ 年ごとの固定費 ＋ 製造拠点の作業) ÷ 年に作る量 ＋ 菌体量に比例する費用」を販売率で割って出す。設備・固定費・系列ごとの作業（培養の運転・密閉性能検査・除菌フィルター交換）は系列の数だけ増え、拠点に1つの作業（安全委員会の運営など）は増えない。量産で設備や原料をまとめて買ったときの値下がりは入れていない。

**第2段：方式と装置を分けて比較する**

方式（どこで処理するか）
- **オンサイト** — 顧客工場の槽の横に、顧客が買ったリアクター（装置）を置いて処理する。処理の運転と、使用済み菌体の汚泥の処分は顧客がやる。SXは菌体の搬入・搬出や交換で巡回する。槽は、既存調整タンクの流用でも新設でも顧客の設備
- **オフサイト** — 排液をタンクローリーでSX工場まで運び、SX工場に新設する槽で処理する。処理の運転はSXがやり、処理水はSX工場から流す。顧客工場への巡回と、顧客工場内の区画・立入制限は発生しない。代わりに、排液の輸送・受け入れ・放流の費用が乗る。設備・槽・汚泥の処分はSXが持つ

装置（菌体と排液をどう触れさせるか。どちらの方式でも選べる）
- **循環カートリッジ** — 菌体をカートリッジ内の保持モジュールに留め、排液を循環させて接触させる。モジュールは耐用バッチ数ごとに交換する
- **直接投入** — 菌体を槽へ直接投入して撹拌し、反応後に UF/MF 膜で菌体を分離回収する。膜は約3年で交換する

**槽** — オンサイトの槽は顧客の設備（既存調整タンクの流用でも新設でも）で、SXの原価に入らない（2026-09-14 まさ）。オフサイトは SX工場にコンクリート地下タンク100 m³（1,800万円・10年償却）を新設する。用途ごとに、オンサイト2通り（装置2）とオフサイト2通り（装置2）の4シナリオになる。オンサイトの槽をSXが持つ形に変えると、既設（0円）／新設の2通りに戻る。

**使用済み菌体の後処理** — 金属回収は、SXが使用済み菌体を引き取って酸で溶かし、金属を回収する（SXの原価）。色素分解は使用済み菌体を脱水汚泥として処分し、オンサイトでは顧客がやる（SXの原価に入れない）。

**オンサイトの設備は独立プラント新設ではなく増分アドオン** — 顧客の既存調整タンク・排水ライン・ユーティリティ・主処理設備を使い、密閉接触・循環、菌体捕捉、回収サービスを足す（2026-07-23 確定）。このリアクターは顧客が買う（2026-09-14 まさ）。

**収益モデル** — 処理費のみ。売価500円/m³。回収物（金属など）の売却収入はまだモデルに入れていない。

**作業（人件費）** — 総コストに入れる（2026-09-13 まさ指示）。作業リストに、作業ごとの1回の工数・年間回数・1回の経費を置き、年額 ＝ 年間回数 ×（工数 × 作業単価 ＋ 経費）で積む。作業単価はすべての作業に共通の1つ（前提の「作業単価（共通）」、2026-09-14 まさ）。作業ごとに誰がやるか（SX / 顧客 / 処理する場所の人）を持ち、**SXの原価に入れるのはSXがやる作業だけ**。処理の運転は中島先生の試算にある手動運用の作業時間で置き、オンサイトでは顧客の作業（SXの原価にも作業時間にも入れない）、オフサイトではSXの作業とする（2026-09-14 まさ）。菌体の搬入・搬出、移動、モジュール・膜の交換、閉鎖系の検査や安全委員会も同じリストに並べる。作業は流れの段（菌体をつくる → 菌体を運ぶ／排液を運ぶ → 排液を処理する → 設備を保つ → 使用済み菌体を後処理する → 閉鎖系を管理する）の順に並べ、段ごとの年間工数を出す。', source_note = '原典: Google Sheets SX_コスト試算_260820 (ちこ)。中島先生の設備・運用想定を反映した版。 2026-09-13 に二段階版へ組み替え（migration 393）。 同日、作業リストと販売率を足した（migration 394/395）。 同日、作業の流れの段、オフサイトの比較、金属回収の使用回数の固定を足した（migration 396/397）。 2026-09-14、方式と装置を分け、作業に誰がやるかを持たせた（migration 398/399）。 同日、顧客がやる作業の時間を画面と注記から外した（migration 400）。 同日、色素分解の菌体使用回数を10回にし、明細に誰が持つかを持たせ、顧客工場のリアクター・槽と汚泥の処分を顧客の持ち分にした（migration 402/403）。 同日、年間生産能力を入力から外し、年間処理量（売上100億円）から年に作る量を計算する形にした（migration 404/405）。 同日、作業単価を共通の1つにし、前提・作業リスト・明細を「事業と処理の条件 / CAPEX / OPEX」の区分に並べ直した（migration 406/407）。', updated_at = now() where cost_model_id = 'cm_p21_260820';

-- 4. 注記
update project_cost_notes set body_md = '1. **切り替える** — 操作パネルの上で、株・用途・方式・装置・槽を選ぶ。方式は、顧客工場で処理するオンサイトと、排液をSX工場まで運んで処理するオフサイトの2つ。装置は、菌体を筒に閉じ込めて排液を通す循環カートリッジと、菌体を槽に入れて混ぜ膜でこし取る直接投入の2つ。結果の棒を押しても選べる。開いたときは自然株。切り替えは保存されない
2. **数字を動かす** — 前提、作業リスト、明細の数字を書き換えると、結果がその場で再計算される。操作パネルでは、これらを「事業と処理の条件」「CAPEX（初期投資）」「OPEX（毎年の費用）」の3つに分け、その中を小分けにして並べている（例: 年間処理量は「事業と処理の条件」の「事業の規模と売価」、作業単価と作業リストは OPEX の「人件費（作業）」、電力単価と装置の動力は OPEX の「電力」）。上の目次と小分けの札を押すと、その場所へ移動する。「すべての行を出す」で、選んだ組み合わせで発生しない明細も出る。作業単価はすべての作業に共通の1つ。作業ごとに「誰がやるか」も変えられる。書き換えた数字には印が付き、結果には保存値からの差が出る
3. **結果を見る** — 右の欄に、方式と装置ごとの総コストを内訳の色で積んだ棒と、選んだ組み合わせの内訳（区分ごとの円/m³と割合）、SXの作業工数が出る。操作パネルの一番上には、作業の流れと段ごとの年間工数が出る
4. **戻す・保存する** — 「すべて戻す」で保存値に戻る。管理者は「この値を保存」で正本へ書ける
5. **第1段と第2段** — 第1段は菌体1kgの原価で、同じ株なら用途では変わらない。第2段は用途ごとの処理原価で、違うのは排水1m³に使い切る菌体の量と後処理', updated_at = now() where cost_note_id = 'cn2_r5' and cost_model_id = 'cm_p21_260820';
update project_cost_notes set body_md = '- **第1段 菌体の製造原価** — 株ごとに、乾燥菌体1kgをつくる原価。年に作る量は年間処理量から計算し、培養設備を系列の数だけ並べる。培養設備の償却・年ごとの固定費・製造拠点の作業・菌体量に比例する費用に分け、販売率で割って見る
- **菌体費** — 第1段の原価 × 排水1m³あたりに使い切る菌体量
- **運ぶ（巡回・輸送）** — オンサイトは顧客工場への菌体の搬入・搬出と移動、オフサイトは排液の輸送。作業リストの工数・経費と、共通の作業単価で動かす
- **運転・保守・管理** — SXがやる、運ぶ以外の作業（オフサイトの処理の運転、モジュールや膜の交換、閉鎖系の管理など）
- **顧客がやる作業** — オンサイトの処理の運転など。SXの原価にも作業時間にも入れない
- **顧客が持つ明細** — オンサイトのリアクター（処理設備）と槽、汚泥の処分など。SXの原価に入れない（明細の「誰が持つか」で変えられる）
- **使用済み菌体の後処理** — SXが持つ後処理。金属回収は酸処理。色素分解の汚泥の処分は、オンサイトでは顧客が持つので入らない（オフサイトだけ）
- **消耗品・電力・放流など** — 処理に使う消耗品・電力・分析と、オフサイトの放流費
- **設備と槽の償却** — SXが持つ処理設備と槽の初期投資 ÷ 耐用年数。オンサイトのリアクターと槽は顧客が買うので入らない（オフサイトはSX工場の設備と槽）
- **うち閉鎖系の追加** — 強化株のときだけ乗る費用。上の区分に含まれている分を、第1段の分と合わせて出す
- **総コスト** — 売価500円/m³に対して成立するか
- **事業全体の年間** — 年間処理量（事業全体）での売上・総コスト・利益。顧客1社の年間を、顧客の数だけ足したもの', updated_at = now() where cost_note_id = 'cn_260820_r1' and cost_model_id = 'cm_p21_260820';
update project_cost_notes set body_md = '乾燥菌体1kgの原価は、菌体の製造拠点の費用を、年に作る菌体の量で割って出す。

**年に作る量は計算で出す**（2026-09-14 まさ「年間の生産能力は入力値じゃなくて計算結果にしてほしい」）。年に作る量 ＝ 年間処理量（事業全体）× 排水1m³あたりに使い切る菌体量 ÷ 販売率。年間処理量は、IPOできる規模として売上100億円に届く20,000,000m³/年で置いている（売価500円/m³）。用途ごとに、その用途だけでこの量を処理したときとして計算する（色素分解は株によらず約2,222t/年、金属回収は自然株で約26,455t/年・強化株で約20,964t/年）。

**設備は系列を並べて増やす**。今の明細（培養設備一式・濃縮・保管、強化株は閉鎖系の追加）を1系列とし、1系列で年33,333kgを作れる前提（仮置き）で、年に作る量をこの量で割った数だけ系列を並べる（自然株で色素分解 約67系列・初期投資 約4.8億円、金属回収 約794系列・約57.4億円。強化株は閉鎖系の追加で1系列が高く、色素分解 約67系列・約6.4億円、金属回収 約629系列・約59.9億円）。設備の初期投資・年ごとの固定費・系列ごとの作業（培養の運転、密閉性能検査、除菌フィルター交換）は系列の数だけ増えるので、1kgあたりは変わらない。拠点に1つの作業（安全委員会の運営など）だけが、作る量が増えるほど1kgあたり薄まる。量産で設備や原料をまとめて買ったときの値下がりは入れていない。

**販売率**（既定100%）は、作った菌体のうち売れる割合。下げると、売る量を確保するために作る量が増え、系列ごとの費用と菌体量に比例する費用が増える。

1系列の年間生産能力（33,333kg/年）は、旧版が暗黙に置いていた「必要な菌体量＝生産量」を引き継いだ仮置き。培養液1Lあたりの1日の増殖量と1系列の培養容積が分かるまで確定しない。', updated_at = now() where cost_note_id = 'cn_260820_c4' and cost_model_id = 'cm_p21_260820';
update project_cost_notes set body_md = '- **回収物の売却収入がモデルに1円も入っていない。** 収入は処理費500円/m³のみ。レアアース回収などのアップサイドが数字として表現できていない
- **菌体の製造拠点を何箇所に分けるかは決めていない。** 年間処理量（売上100億円に届く20,000,000m³/年）から、顧客数（約667社）、年に作る菌体の量と培養設備の系列数は出している。系列はすべて1拠点に並べる前提で、拠点を分けたときに増える費用と、顧客工場までの移動が短くなる効果は入っていない
- **量産で安くなる効果は、拠点に1つの費用が薄まる分だけ。** 設備や原料をまとめて買ったときの値下がりは入れていない。菌体1kgの原価（強化株 約120円）は、2026-07の設備アドオン試算の量産目標（1,500円/kg）の1/10以下で、明細の単価も1系列の量も仮置き。1,500円/kgを上書き値に入れると、強化株・オンサイト・直接投入で色素分解 約255円/m³、金属回収 約1,736円/m³
- **オフサイトの前提は仮置き。** 排液を運ぶ費用・受け入れ設備・放流費には見積がない。顧客の排液を運んで処理するときの許可（産業廃棄物の収集運搬・処分）にかかる費用と期間は入っていない
- **閉鎖系の追加費用と巡回サービスは仮置き。** 金額の根拠となる見積がまだない（二段階版で追加）
- **色素側の数字は実測がない。** 色素の濃さ・取り込み効率・菌体使用回数・使用済み菌体の含水率は文献相場か仮置き', updated_at = now() where cost_note_id = 'cn_260820_h2' and cost_model_id = 'cm_p21_260820';
update project_cost_notes set body_md = '2026-09-14、まさのフィードバックで次を直した。

**なぜ変えたか**
- まさ「年間の生産能力は入力値じゃなくて計算結果にしてほしい。入力は、年間何立米の廃水を処理するか、にして」「この計算はIPOできるレベルの大量生産状態を前提にしたいので、売上100億到達レベルを前提にしたパラメータにして」。これまでは菌体の製造拠点の年間生産能力（33,333kg/年）を入力として置き、顧客1社の採算だけを見ていた

**何を変えたか**
- 前提に「年間処理量（事業全体）」を足し、売上100億円に届く20,000,000m³/年（売価500円/m³）で置いた。顧客1社あたり年30,000m³で約667社分
- 年に作る菌体の量を、年間処理量 × 使い切る菌体量 ÷ 販売率 で計算する形にした。用途ごとに、その用途だけでこの量を処理したときとして出す
- これまでの年間生産能力（33,333kg/年）は「培養設備1系列の年間生産能力」に読み替え、年に作る量 ÷ 1系列 の数だけ系列を並べる。設備の初期投資・年ごとの固定費と、系列ごとの作業（培養の運転・密閉性能検査・除菌フィルター交換）は系列の数だけ増やし、拠点に1つの作業（安全委員会の運営など）は増やさない
- 結果の欄に、年に作る量・培養設備の系列数・製造拠点の初期投資と、事業全体の年間の売上・総コスト・利益を出した

**数字**（強化株、オンサイト・直接投入・顧客の槽）: 菌体1kgの原価 127.1円 → 色素分解 120.1円・金属回収 120.0円（拠点に1つの作業が量で薄まった分）。総コストは色素分解 102.6 → 101.8、金属回収 297.0 → 289.5 円/m³。自然株は拠点に1つの作業が無いので変わらない（色素分解 81.1・金属回収 291.5）。年に作る量は色素分解で約2,222t（培養設備 約67系列・初期投資 約6.4億円）、金属回収で約20,964t（約629系列・約59.9億円）。事業全体の年間は、色素分解で売上100億円・総コスト約20.4億円、金属回収で売上100億円・総コスト約57.9億円。', updated_at = now() where cost_note_id = 'cn7_h7' and cost_model_id = 'cm_p21_260820';
insert into project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, visibility, sort_order) values ('cn8_h8', 'cm_p21_260820', 'history', '260914 作業単価を共通の1つにし、前提をCAPEXとOPEXの区分に並べ直した', '2026-09-14、まさのフィードバックで次を直した。

**なぜ変えたか**
- まさ「工数単価は共通で１つのパラメータで入力するようにして。現状だと工程ごとに単価を決める仕様になっているけど、それぞれで変えることは想定してないので」
- まさ「前提となるパラメータについて、ページのあちこちに散らばってて、どこにあるか分からん。CAPEXとOPEXに分けて、さらにそれぞれのサブグループに分けるなどして整理してほしい」
- まさ「デフォルトが強化株になってるから、自然株に変えて」「年間処理量みたいな桁の大きい数字は必ず３桁ごとにカンマ入れて」

**何を変えたか**
- 作業リストから作業ごとの作業単価の欄を外し、作業単価を前提の「作業単価（共通）」1つにした。すべての作業の年額が、この単価で動く
- 操作パネルの前提・作業リスト・明細を「事業と処理の条件」「CAPEX（初期投資）」「OPEX（毎年の費用）」の3つに分け、その中を小分けにして並べた。事業と処理の条件は、事業の規模と売価・顧客1社の処理・対象物質と菌体の量・菌体の製造量と原価。CAPEX は、菌体の製造拠点（培養設備）・処理設備（循環カートリッジ / 直接投入）・槽・排液の受け入れ設備・閉鎖系の追加。OPEX は、人件費（作業）・運ぶ・菌体の製造拠点（原料・品質確認）・交換部品・電力・消耗品と点検と分析・使用済み菌体の後処理・処理水の放流・閉鎖系の追加。読み物の「すべての前提」と「費用明細」も同じ並びにした
- 電力の区分に2つ並ぶ反応時間を「循環カートリッジ：反応時間」「直接投入：反応時間」と呼び分けた
- 開いたときの株を自然株にした
- 入力欄の数字に3桁ごとのカンマを入れた（打っている最中も入る）。年間処理量や年に作る量は「20,000,000」の形で出す

**数字**: 作業ごとの作業単価はどの作業にも入っていなかったので、総コストは変わらない。開いたとき（自然株、オンサイト・直接投入・顧客の槽）は、色素分解 81.1円/m³、金属回収 291.5円/m³。', 'amd_internal', 80);

-- 5. 確認事項: 桁の大きい量は3桁カンマで書く
update project_cost_questions set question = '年間処理量20,000,000m³（売上100億円）のとき、菌体の製造拠点を何箇所に分けるかを決める。いまは培養設備の系列（色素分解で約67、金属回収で自然株 約794・強化株 約629）をすべて1拠点に並べる前提で計算している。', updated_at = now() where cost_question_id = 'cq_260820_16' and cost_model_id = 'cm_p21_260820';
update project_cost_questions set question = 'SX工場を置く候補地の自治体で、処理水を下水道へ流す場合の使用料（年30,000m³規模、m³あたり）を調べる。河川へ流す場合に要る届出と水質の管理も確認する。', updated_at = now() where cost_question_id = 'cq4_03' and cost_model_id = 'cm_p21_260820';
update project_cost_questions set why_it_matters = '後処理の作業は工数を空欄（0時間）で数えている。金属回収（SXがやる）なら、1バッチ2時間で年600時間、総コストが約80.0円/m³上がる（作業単価4,000円、年300バッチ、年30,000m³）。色素分解の脱水と処分の手配は、オンサイトでは顧客がやる前提なので、SXの原価に効くのはオフサイトだけ（同じ条件で約80.0円/m³）。', updated_at = now() where cost_question_id = 'cq4_05' and cost_model_id = 'cm_p21_260820';

commit;
