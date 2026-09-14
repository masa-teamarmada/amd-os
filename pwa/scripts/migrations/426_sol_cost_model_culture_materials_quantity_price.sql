-- 426: SOL（p21）の2つのコスト試算の培養の原料（同じ10行ずつ）を「使う量 × 買値」に組み直す（2026-09-14 まさ「Aで」）
--
-- まさ「それぞれの項目が妥当なのかの確認をどうやってすればいいかが、これだと分からない。そもそも「数量」「単価」って何？」のあと、
-- えいみの案「A: 培養の原料を使う量 × 買値に組み直す。量は菌体の成分と菌体の濃さから、買値は公開の相場から。廃液のタブの同じ行もそろえる」に、まさ「Aで」。
--   - 明細 ci_260820_120〜128・134（排水処理）と cif_culture_120〜128・134（燃料）: 小項目・量・量の単位・買値・買値の単位・確度・出どころ・確認先・説明
--     量は 2026-09-07 の工程とマテバラ推定の設計仮定（炭素50%・窒素8%・リン1%・CO2の固定80%）とスピルリナの成分、杉浦先生の回答の菌体の濃さ5g/L から。
--     買値は財務省貿易統計の輸入単価・通販の25kg袋・東京都の上水道料金・液化炭酸ガスの卸の相場（運賃を足した仮置き）から。膜・フィルタと凝集剤は額を変えず形だけ。
--   - 数字が変わる文章（排水処理の説明・確認事項2件・注記3件、燃料の注記1件）と、確認事項の影響の幅3件を直す。版の履歴の注記を1件ずつ足す
--   - 菌体1kgの原料 60.3円 → 274.6円。自然株 色素分解 オンサイト・直接投入 30.4 → 54.2円/m³、自然株 金属回収 244.8 → 528.3円/m³（売価500円を超える）、燃料 基準・委託 2,165.8 → 6,033.5円/L
-- 生成: gen425.py（rows425.py の定義・_numbers425.mts の計算。scratchpad）。fixture 2つを同じ定義から書き出した。
-- 書き換える行の値・文章がこの migration を作った時点（2026-09-14 19時台）から変わっていたら、何もせずに止める。
begin;
do $do$ begin
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_120' and cost_model_id = 'cm_p21_260820' and quantity = 1 and unit_price = 9.0 and leaf_label = '培地主原料') then raise exception '426: 明細 ci_260820_120 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_121' and cost_model_id = 'cm_p21_260820' and quantity = 1 and unit_price = 10.8 and leaf_label = '栄養塩') then raise exception '426: 明細 ci_260820_121 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_122' and cost_model_id = 'cm_p21_260820' and quantity = 1 and unit_price = 7.2 and leaf_label = '微量元素・添加剤') then raise exception '426: 明細 ci_260820_122 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_123' and cost_model_id = 'cm_p21_260820' and quantity = 1 and unit_price = 4.5 and leaf_label = 'CO2') then raise exception '426: 明細 ci_260820_123 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_124' and cost_model_id = 'cm_p21_260820' and quantity = 1 and unit_price = 1.8 and leaf_label = '補給水') then raise exception '426: 明細 ci_260820_124 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_125' and cost_model_id = 'cm_p21_260820' and quantity = 1 and unit_price = 2.7 and leaf_label = '洗浄水') then raise exception '426: 明細 ci_260820_125 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_126' and cost_model_id = 'cm_p21_260820' and quantity = 1 and unit_price = 4.5 and leaf_label = '洗浄薬剤') then raise exception '426: 明細 ci_260820_126 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_127' and cost_model_id = 'cm_p21_260820' and quantity = 1 and unit_price = 9.0 and leaf_label = '濃縮用フィルタ') then raise exception '426: 明細 ci_260820_127 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_128' and cost_model_id = 'cm_p21_260820' and quantity = 1 and unit_price = 5.4 and leaf_label = '濃縮補助材') then raise exception '426: 明細 ci_260820_128 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_134' and cost_model_id = 'cm_p21_260820' and quantity = 1 and unit_price = 5.4 and leaf_label = '培養ロス補充') then raise exception '426: 明細 ci_260820_134 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_120' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 9.0 and leaf_label = '培地主原料') then raise exception '426: 明細 cif_culture_120 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_121' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 10.8 and leaf_label = '栄養塩') then raise exception '426: 明細 cif_culture_121 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_122' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 7.2 and leaf_label = '微量元素・添加剤') then raise exception '426: 明細 cif_culture_122 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_123' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 4.5 and leaf_label = 'CO2') then raise exception '426: 明細 cif_culture_123 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_124' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 1.8 and leaf_label = '補給水') then raise exception '426: 明細 cif_culture_124 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_125' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 2.7 and leaf_label = '洗浄水') then raise exception '426: 明細 cif_culture_125 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_126' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 4.5 and leaf_label = '洗浄薬剤') then raise exception '426: 明細 cif_culture_126 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_127' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 9.0 and leaf_label = '濃縮用フィルタ') then raise exception '426: 明細 cif_culture_127 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_128' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 5.4 and leaf_label = '濃縮補助材') then raise exception '426: 明細 cif_culture_128 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_134' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 5.4 and leaf_label = '培養ロス補充') then raise exception '426: 明細 cif_culture_134 が変わっている'; end if;
  if not exists (select 1 from project_cost_models where cost_model_id = 'cm_p21_260820' and md5(coalesce(summary_md, '')) = '5db0ca4d60126c4b089ac6ff00344806') then raise exception '426: project_cost_models cm_p21_260820 の summary_md が変わっている'; end if;
  if not exists (select 1 from project_cost_questions where cost_question_id = 'cq_260820_01' and md5(coalesce(why_it_matters, '')) = '71fa299006fb0ee372f7521d6ab84994') then raise exception '426: project_cost_questions cq_260820_01 の why_it_matters が変わっている'; end if;
  if not exists (select 1 from project_cost_questions where cost_question_id = 'cq_260820_02' and md5(coalesce(why_it_matters, '')) = 'cfcb2999ca4a89f4c7ff2e0c9a6771cb') then raise exception '426: project_cost_questions cq_260820_02 の why_it_matters が変わっている'; end if;
  if not exists (select 1 from project_cost_notes where cost_note_id = 'cn_260820_r3' and md5(coalesce(body_md, '')) = 'd904d2f7020f339881d55dc37281f5f9') then raise exception '426: project_cost_notes cn_260820_r3 の body_md が変わっている'; end if;
  if not exists (select 1 from project_cost_notes where cost_note_id = 'cn2_c9' and md5(coalesce(body_md, '')) = 'dfc59badf2276ea8c73d729e4f8ffc69') then raise exception '426: project_cost_notes cn2_c9 の body_md が変わっている'; end if;
  if not exists (select 1 from project_cost_notes where cost_note_id = 'cn_260820_h2' and md5(coalesce(body_md, '')) = '79e31e54d657ed62fdd93c0a33f1c88d') then raise exception '426: project_cost_notes cn_260820_h2 の body_md が変わっている'; end if;
  if not exists (select 1 from project_cost_notes where cost_note_id = 'cnf_caveat_biomass' and md5(coalesce(body_md, '')) = 'c14148a783b88b0454e8a97a98340d9a') then raise exception '426: project_cost_notes cnf_caveat_biomass の body_md が変わっている'; end if;
  if not exists (select 1 from project_cost_questions where cost_question_id = 'cqf_fame_potential' and impact_low = 524 and impact_high = 1049) then raise exception '426: 確認事項 cqf_fame_potential の影響の幅が変わっている'; end if;
  if not exists (select 1 from project_cost_questions where cost_question_id = 'cqf_extraction' and impact_low = 110 and impact_high = 262) then raise exception '426: 確認事項 cqf_extraction の影響の幅が変わっている'; end if;
  if not exists (select 1 from project_cost_questions where cost_question_id = 'cq_260820_01' and impact_low = 22 and impact_high = 156) then raise exception '426: 確認事項 cq_260820_01 の影響の幅が変わっている'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id = 'cn12_h12') then raise exception '426: 注記 cn12_h12 がもうある'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id = 'cnf_history_culture') then raise exception '426: 注記 cnf_history_culture がもうある'; end if;
end $do$;

update project_cost_items set leaf_label = '窒素源（硝酸ナトリウム）', quantity = 0.4854, quantity_unit = 'kg/kg-DCW', unit_price = 187.0, unit_price_unit = '円/kg', confidence = 'B', source_kind = '推定', owner = '杉浦先生（培地の組成）', note = '量: 菌体の乾燥重量の8%が窒素（2026-09-07 の工程とマテバラ推定の設計仮定。Synechocystis の測定では11.3%）→ 窒素0.08kg ÷ 硝酸ナトリウムの窒素の割合16.5% ＝ 0.4854kg。培地に入れた窒素はすべて菌体が吸う（培養液を使い回す前提。マテバラ推定と同じ。閉鎖型の培養で吸う割合を20%と置く試算もあり（米国PNNL 2018）、その場合は5倍）。買値: 硝酸ナトリウムの財務省貿易統計の輸入単価（chematels.com の集計、2026年） 187円/kg。届け先までの運賃は含まない。確かめ方: 杉浦先生の培地の窒素源と濃さ（培養液1Lに何g）を聞き、菌体1kgあたりの量と比べる。尿素（窒素46.6%、輸入単価の2026年平均 約107円/kg）が使えるなら菌体1kgあたり約18円に下がる。リン源のりん酸二アンモニウムからも窒素が約9g入るが、ここから差し引いていない。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_120' and cost_model_id = 'cm_p21_260820';
update project_cost_items set leaf_label = 'リン源（りん酸二アンモニウム）', quantity = 0.0426, quantity_unit = 'kg/kg-DCW', unit_price = 161.0, unit_price_unit = '円/kg', confidence = 'B', source_kind = '推定', owner = '杉浦先生（培地の組成）', note = '量: 菌体の乾燥重量の1%がリン（2026-09-07 の工程とマテバラ推定の設計仮定。微細藻類で0.3〜1.2%）→ リン0.01kg ÷ りん酸二アンモニウムのリンの割合23.5% ＝ 0.0426kg。入れたリンはすべて菌体が吸う（使い回す前提）。買値: りん酸二アンモニウムの財務省貿易統計の輸入単価（chematels.com の集計、2026年） 161円/kg。確かめ方: 杉浦先生の培地のリン源と濃さを聞いて比べる。BG-11（シアノバクテリアの標準の培地）のリン酸カリウムのままでは、菌体の濃さ5g/Lに足りない（約0.7g/L分）。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_121' and cost_model_id = 'cm_p21_260820';
update project_cost_items set leaf_label = 'カリウム・マグネシウム・鉄・微量金属', quantity = 0.074, quantity_unit = 'kg/kg-DCW', unit_price = 324.0, unit_price_unit = '円/kg', confidence = 'C', source_kind = '推定', owner = '杉浦先生（培地の組成）', note = '量: 菌体の乾燥重量のカリウム1.6%・マグネシウム0.3%・鉄0.1%（スピルリナの成分の総説）から、塩化カリウム0.0305kg・硫酸マグネシウム7水塩0.0304kg・キレート鉄13% 0.0077kg、微量金属の塩（ホウ酸・塩化マンガン・硫酸亜鉛など）をBG-11の鉄との割合で0.0054kg、合わせて0.074kg。買値は重さで割り戻した平均 324円/kg: 塩化カリウム 77円/kg（財務省貿易統計の輸入単価（chematels.com の集計、2026年））、硫酸マグネシウム 162円/kg（肥料・工業用25kg、通販 2026-09）、キレート鉄 1,468円/kg（25kg、通販 2026-09）、微量金属の塩 1,000円/kg（買値を調べていない仮置き）。菌体1kgあたりの額の半分近くがキレート鉄。確かめ方: 杉浦先生の培地の組成を聞き、成分ごとの量と比べる。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_122' and cost_model_id = 'cm_p21_260820';
update project_cost_items set leaf_label = 'CO2（液化炭酸ガス）', quantity = 2.29, quantity_unit = 'kg/kg-DCW', unit_price = 50.0, unit_price_unit = '円/kg', confidence = 'C', source_kind = '推定', owner = '杉浦先生（CO2の入れ方）', note = '量: 菌体の乾燥重量の半分が炭素（2026-09-07 の工程とマテバラ推定の設計仮定。Synechocystis 51.4%）→ 菌体1kgに固定するCO2 1.83kg。供給したCO2のうち菌体に固定する割合を80%（同じ設計仮定）として2.29kg。固定する割合は培養のしかたで大きく変わり、閉鎖型の袋の培養で10%と置く試算（米国PNNL 2018）では8倍、開放池で75%（米国エネルギー省 2023）。買値: 50円/kg の仮置き。液化炭酸ガスの卸の相場 FOB東京 約225ドル/t（2026年4〜6月、ChemAnalyst）は1ドル150円で約34円/kgで、届け先までの運賃と貯槽の費用を足した。施設園芸のボンベ買いでは約120円/kg。メーカー各社は2023〜2025年に15〜30%ずつ値上げしている。確かめ方: CO2をどう入れるか（ボンベ・液化炭酸ガスの貯槽・工場の排ガス）と、吸わせきれる割合を杉浦先生に聞き、液化炭酸ガスはメーカー（日本液炭・エア・ウォーター炭酸など）に量と場所で見積を取る。工場の排ガスから回収するなら、国の2030年目標で回収だけ 2,000円台/t（1kgあたり約2〜3円）。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_123' and cost_model_id = 'cm_p21_260820';
update project_cost_items set leaf_label = '補給水（上水）', quantity = 0.014, quantity_unit = 'm³/kg-DCW', unit_price = 404.0, unit_price_unit = '円/m³', confidence = 'B', source_kind = '推定', owner = '杉浦先生（培養液の使い回し）', note = '量: 蒸発で失う水 10L（2026-09-07 の工程とマテバラ推定の設計仮定）＋ 固形分20%に濃縮した菌体に付いて出ていく水 4L ＝ 0.014m³。菌体を分けたあとの培養液は使い回す前提（捨てるなら菌体1kgに培養液200Lの水が要る）。買値: 上水道 404円/m³（東京都23区、月1,001m³を超える分、税抜）。工業用水が引ければ30円/m³前後（東京都の第一種 29円/m³、2023年3月で廃止）。確かめ方: 培養液を使い回すか、蒸発する量（屋外か屋内か）を杉浦先生に聞き、培養設備を置く場所の水道・工業用水の料金と比べる。使い回す培養液から出す分の下水道の料金（東京都 345円/m³）は入れていない。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_124' and cost_model_id = 'cm_p21_260820';
update project_cost_items set leaf_label = '洗浄水', quantity = 0.01, quantity_unit = 'm³/kg-DCW', unit_price = 404.0, unit_price_unit = '円/m³', confidence = 'C', source_kind = '仮置き', owner = '中島先生（洗浄のしかた）', note = '量: 仮置き。収穫した培養液（菌体1kgで200L）の5%の水で培養槽を洗う → 0.01m³。買値: 上水道 404円/m³（東京都23区、月1,001m³を超える分、税抜）。確かめ方: 洗う回数と1回の水の量（培養槽の容量の何倍か）を中島先生に聞き、1年の水の量 ÷ 1系列が1年に作る菌体の量で比べる。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_125' and cost_model_id = 'cm_p21_260820';
update project_cost_items set leaf_label = '洗浄薬剤（次亜塩素酸ナトリウム）', quantity = 0.01, quantity_unit = 'kg/kg-DCW', unit_price = 135.0, unit_price_unit = '円/kg', confidence = 'C', source_kind = '仮置き', owner = '中島先生（洗浄のしかた）', note = '量: 仮置き。洗浄水1m³に次亜塩素酸ナトリウム12%液を1kg（有効成分 約120mg/L）→ 洗浄水0.01m³で0.01kg。買値: 次亜塩素酸ナトリウム12% 20kgで2,500〜2,905円（通販、2026-09）の中ほど135円/kg。確かめ方: 洗浄に使う薬剤と濃さ、洗う回数を中島先生に聞いて比べる。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_126' and cost_model_id = 'cm_p21_260820';
update project_cost_items set leaf_label = '濃縮用フィルタ', quantity = 0.2, quantity_unit = 'm³/kg-DCW', unit_price = 45.0, unit_price_unit = '円/m³', confidence = 'B', source_kind = '仮置き', owner = '中島先生（濃縮のしかた）', note = '仮置き（膜やフィルタの買値を調べられていない）。2026-08-20版の試算シートでAMDが置いた額（処理水1m³あたり10円）を、培養液1m³あたり45円に直して、菌体1kgの培養液0.2m³（菌体の濃さ5g/L、杉浦先生の回答）を掛けている。確かめ方: 濃縮を遠心分離にするか膜にするかを中島先生と決め、膜なら膜の面積・交換の年数・1m²の値段を見積もって、1年の額 ÷ 1系列が1年に作る菌体の量で比べる（遠心分離ならフィルタはほぼ要らず、電力が要る）。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_127' and cost_model_id = 'cm_p21_260820';
update project_cost_items set leaf_label = '濃縮補助材（凝集剤）', quantity = 0.002, quantity_unit = 'kg/kg-DCW', unit_price = 2700.0, unit_price_unit = '円/kg', confidence = 'C', source_kind = '仮置き', owner = '中島先生（濃縮のしかた）', note = '量: 凝集剤を培養液1Lに10mg（クロレラをキトサン10mg/Lで98%集めた報告。ポリアクリルアミドは5〜10mg/L）× 培養液200L ＝ 0.002kg。買値: 仮置き 2,700円/kg（買値を調べられていない。2026-08-20版の試算シートの額から逆算した値）。確かめ方: 凝集剤を使うか（遠心分離だけなら要らない）と種類を中島先生に聞き、水処理薬剤のメーカーに値段を聞いて比べる。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_128' and cost_model_id = 'cm_p21_260820';
update project_cost_items set leaf_label = '培養ロス補充', quantity = 0.05, quantity_unit = 'kg-DCW/kg-DCW', unit_price = 261.6, unit_price_unit = '円/kg-DCW', confidence = 'C', source_kind = '仮置き', owner = '杉浦先生（培養の失敗の割合）', note = '仮置き。培養がうまくいかずに作り直す割合を5%とし、上の原料9行の菌体1kgあたりの合計（261.6円）を掛ける。上の行を書き換えても、この行の単価は自動では変わらない。確かめ方: 1年に失敗する培養の割合を杉浦先生に聞いて比べる。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_134' and cost_model_id = 'cm_p21_260820';
update project_cost_items set leaf_label = '窒素源（硝酸ナトリウム）', quantity = 0.4854, quantity_unit = 'kg/kg-DCW', unit_price = 187.0, unit_price_unit = '円/kg', confidence = 'B', source_kind = '推定', owner = '杉浦先生（培地の組成）', note = '量: 菌体の乾燥重量の8%が窒素（2026-09-07 の工程とマテバラ推定の設計仮定。Synechocystis の測定では11.3%）→ 窒素0.08kg ÷ 硝酸ナトリウムの窒素の割合16.5% ＝ 0.4854kg。培地に入れた窒素はすべて菌体が吸う（培養液を使い回す前提。マテバラ推定と同じ。閉鎖型の培養で吸う割合を20%と置く試算もあり（米国PNNL 2018）、その場合は5倍）。買値: 硝酸ナトリウムの財務省貿易統計の輸入単価（chematels.com の集計、2026年） 187円/kg。届け先までの運賃は含まない。確かめ方: 杉浦先生の培地の窒素源と濃さ（培養液1Lに何g）を聞き、菌体1kgあたりの量と比べる。尿素（窒素46.6%、輸入単価の2026年平均 約107円/kg）が使えるなら菌体1kgあたり約18円に下がる。リン源のりん酸二アンモニウムからも窒素が約9g入るが、ここから差し引いていない。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_120' and cost_model_id = 'cm_p21_fuel_260914';
update project_cost_items set leaf_label = 'リン源（りん酸二アンモニウム）', quantity = 0.0426, quantity_unit = 'kg/kg-DCW', unit_price = 161.0, unit_price_unit = '円/kg', confidence = 'B', source_kind = '推定', owner = '杉浦先生（培地の組成）', note = '量: 菌体の乾燥重量の1%がリン（2026-09-07 の工程とマテバラ推定の設計仮定。微細藻類で0.3〜1.2%）→ リン0.01kg ÷ りん酸二アンモニウムのリンの割合23.5% ＝ 0.0426kg。入れたリンはすべて菌体が吸う（使い回す前提）。買値: りん酸二アンモニウムの財務省貿易統計の輸入単価（chematels.com の集計、2026年） 161円/kg。確かめ方: 杉浦先生の培地のリン源と濃さを聞いて比べる。BG-11（シアノバクテリアの標準の培地）のリン酸カリウムのままでは、菌体の濃さ5g/Lに足りない（約0.7g/L分）。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_121' and cost_model_id = 'cm_p21_fuel_260914';
update project_cost_items set leaf_label = 'カリウム・マグネシウム・鉄・微量金属', quantity = 0.074, quantity_unit = 'kg/kg-DCW', unit_price = 324.0, unit_price_unit = '円/kg', confidence = 'C', source_kind = '推定', owner = '杉浦先生（培地の組成）', note = '量: 菌体の乾燥重量のカリウム1.6%・マグネシウム0.3%・鉄0.1%（スピルリナの成分の総説）から、塩化カリウム0.0305kg・硫酸マグネシウム7水塩0.0304kg・キレート鉄13% 0.0077kg、微量金属の塩（ホウ酸・塩化マンガン・硫酸亜鉛など）をBG-11の鉄との割合で0.0054kg、合わせて0.074kg。買値は重さで割り戻した平均 324円/kg: 塩化カリウム 77円/kg（財務省貿易統計の輸入単価（chematels.com の集計、2026年））、硫酸マグネシウム 162円/kg（肥料・工業用25kg、通販 2026-09）、キレート鉄 1,468円/kg（25kg、通販 2026-09）、微量金属の塩 1,000円/kg（買値を調べていない仮置き）。菌体1kgあたりの額の半分近くがキレート鉄。確かめ方: 杉浦先生の培地の組成を聞き、成分ごとの量と比べる。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_122' and cost_model_id = 'cm_p21_fuel_260914';
update project_cost_items set leaf_label = 'CO2（液化炭酸ガス）', quantity = 2.29, quantity_unit = 'kg/kg-DCW', unit_price = 50.0, unit_price_unit = '円/kg', confidence = 'C', source_kind = '推定', owner = '杉浦先生（CO2の入れ方）', note = '量: 菌体の乾燥重量の半分が炭素（2026-09-07 の工程とマテバラ推定の設計仮定。Synechocystis 51.4%）→ 菌体1kgに固定するCO2 1.83kg。供給したCO2のうち菌体に固定する割合を80%（同じ設計仮定）として2.29kg。固定する割合は培養のしかたで大きく変わり、閉鎖型の袋の培養で10%と置く試算（米国PNNL 2018）では8倍、開放池で75%（米国エネルギー省 2023）。買値: 50円/kg の仮置き。液化炭酸ガスの卸の相場 FOB東京 約225ドル/t（2026年4〜6月、ChemAnalyst）は1ドル150円で約34円/kgで、届け先までの運賃と貯槽の費用を足した。施設園芸のボンベ買いでは約120円/kg。メーカー各社は2023〜2025年に15〜30%ずつ値上げしている。確かめ方: CO2をどう入れるか（ボンベ・液化炭酸ガスの貯槽・工場の排ガス）と、吸わせきれる割合を杉浦先生に聞き、液化炭酸ガスはメーカー（日本液炭・エア・ウォーター炭酸など）に量と場所で見積を取る。工場の排ガスから回収するなら、国の2030年目標で回収だけ 2,000円台/t（1kgあたり約2〜3円）。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_123' and cost_model_id = 'cm_p21_fuel_260914';
update project_cost_items set leaf_label = '補給水（上水）', quantity = 0.014, quantity_unit = 'm³/kg-DCW', unit_price = 404.0, unit_price_unit = '円/m³', confidence = 'B', source_kind = '推定', owner = '杉浦先生（培養液の使い回し）', note = '量: 蒸発で失う水 10L（2026-09-07 の工程とマテバラ推定の設計仮定）＋ 固形分20%に濃縮した菌体に付いて出ていく水 4L ＝ 0.014m³。菌体を分けたあとの培養液は使い回す前提（捨てるなら菌体1kgに培養液200Lの水が要る）。買値: 上水道 404円/m³（東京都23区、月1,001m³を超える分、税抜）。工業用水が引ければ30円/m³前後（東京都の第一種 29円/m³、2023年3月で廃止）。確かめ方: 培養液を使い回すか、蒸発する量（屋外か屋内か）を杉浦先生に聞き、培養設備を置く場所の水道・工業用水の料金と比べる。使い回す培養液から出す分の下水道の料金（東京都 345円/m³）は入れていない。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_124' and cost_model_id = 'cm_p21_fuel_260914';
update project_cost_items set leaf_label = '洗浄水', quantity = 0.01, quantity_unit = 'm³/kg-DCW', unit_price = 404.0, unit_price_unit = '円/m³', confidence = 'C', source_kind = '仮置き', owner = '中島先生（洗浄のしかた）', note = '量: 仮置き。収穫した培養液（菌体1kgで200L）の5%の水で培養槽を洗う → 0.01m³。買値: 上水道 404円/m³（東京都23区、月1,001m³を超える分、税抜）。確かめ方: 洗う回数と1回の水の量（培養槽の容量の何倍か）を中島先生に聞き、1年の水の量 ÷ 1系列が1年に作る菌体の量で比べる。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_125' and cost_model_id = 'cm_p21_fuel_260914';
update project_cost_items set leaf_label = '洗浄薬剤（次亜塩素酸ナトリウム）', quantity = 0.01, quantity_unit = 'kg/kg-DCW', unit_price = 135.0, unit_price_unit = '円/kg', confidence = 'C', source_kind = '仮置き', owner = '中島先生（洗浄のしかた）', note = '量: 仮置き。洗浄水1m³に次亜塩素酸ナトリウム12%液を1kg（有効成分 約120mg/L）→ 洗浄水0.01m³で0.01kg。買値: 次亜塩素酸ナトリウム12% 20kgで2,500〜2,905円（通販、2026-09）の中ほど135円/kg。確かめ方: 洗浄に使う薬剤と濃さ、洗う回数を中島先生に聞いて比べる。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_126' and cost_model_id = 'cm_p21_fuel_260914';
update project_cost_items set leaf_label = '濃縮用フィルタ', quantity = 0.2, quantity_unit = 'm³/kg-DCW', unit_price = 45.0, unit_price_unit = '円/m³', confidence = 'B', source_kind = '仮置き', owner = '中島先生（濃縮のしかた）', note = '仮置き（膜やフィルタの買値を調べられていない）。2026-08-20版の試算シートでAMDが置いた額（処理水1m³あたり10円）を、培養液1m³あたり45円に直して、菌体1kgの培養液0.2m³（菌体の濃さ5g/L、杉浦先生の回答）を掛けている。確かめ方: 濃縮を遠心分離にするか膜にするかを中島先生と決め、膜なら膜の面積・交換の年数・1m²の値段を見積もって、1年の額 ÷ 1系列が1年に作る菌体の量で比べる（遠心分離ならフィルタはほぼ要らず、電力が要る）。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_127' and cost_model_id = 'cm_p21_fuel_260914';
update project_cost_items set leaf_label = '濃縮補助材（凝集剤）', quantity = 0.002, quantity_unit = 'kg/kg-DCW', unit_price = 2700.0, unit_price_unit = '円/kg', confidence = 'C', source_kind = '仮置き', owner = '中島先生（濃縮のしかた）', note = '量: 凝集剤を培養液1Lに10mg（クロレラをキトサン10mg/Lで98%集めた報告。ポリアクリルアミドは5〜10mg/L）× 培養液200L ＝ 0.002kg。買値: 仮置き 2,700円/kg（買値を調べられていない。2026-08-20版の試算シートの額から逆算した値）。確かめ方: 凝集剤を使うか（遠心分離だけなら要らない）と種類を中島先生に聞き、水処理薬剤のメーカーに値段を聞いて比べる。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_128' and cost_model_id = 'cm_p21_fuel_260914';
update project_cost_items set leaf_label = '培養ロス補充', quantity = 0.05, quantity_unit = 'kg-DCW/kg-DCW', unit_price = 261.6, unit_price_unit = '円/kg-DCW', confidence = 'C', source_kind = '仮置き', owner = '杉浦先生（培養の失敗の割合）', note = '仮置き。培養がうまくいかずに作り直す割合を5%とし、上の原料9行の菌体1kgあたりの合計（261.6円）を掛ける。上の行を書き換えても、この行の単価は自動では変わらない。確かめ方: 1年に失敗する培養の割合を杉浦先生に聞いて比べる。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_134' and cost_model_id = 'cm_p21_fuel_260914';

update project_cost_models set summary_md = 'SXの排液処理を、**菌体の製造原価**と**用途別の処理原価**の二段階で試算する。

**事業の規模は売上10,000,000,000円** — IPOできる大量生産の状態を前提に、年間処理量を20,000,000m³/年で置く（売価500円/m³で売上10,000,000,000円。2026-09-14 まさ）。顧客1社あたり年30,000m³なら約667社分。**オフサイトは、将来サイドビジネスとして足す形で、売価と年間処理量をオンサイトと別に置く**（仮置き 50,000円/m³＝1Lあたり50円・30,000m³/年。2026-09-14 まさ「ペインがあれば割高でも成立するから」）。菌体の製造拠点で年に作る量は、色素分解が株によらず約2,226t、金属回収が自然株で約26,495t・強化株で約20,996t（強化株は金属の取り込み効率が高い）。

**第1段 菌体の製造原価** — 株（強化株／自然株）ごとに、菌体の製造拠点で乾燥菌体1kgをつくる原価を出す。菌体の製造拠点は、顧客工場では培養せず、SX側でまとめて菌体を育て、濃縮して各工場へ運ぶところ。**年に作る量は計算で出す**（オンサイトとオフサイトの年間処理量の合計 × 使い切る菌体量 ÷ 販売率）。今の明細を培養設備の1系列として必要な数だけ並べるので、設備・固定費・系列ごとの作業は1kgあたり変わらず、拠点に1つの作業だけが量で薄まる。同じ株なら、1kgあたりの原価は用途でほとんど変わらない（自然株で312.8円、強化株で色素分解 334.4円・金属回収 334.3円）。菌体の量に比例する培養の原料（窒素源・リン源・CO2・水など）は、菌体の成分と公開の買値から「使う量 × 買値」で置いている（2026-09-14、菌体1kgあたり274.6円のうちCO2 114.5円・窒素源 90.8円）。強化株は閉鎖系の追加費用が乗る。生産した菌体のうち売れる割合（販売率）で割るので、売れ残りが出ると1kgあたりの原価は上がる。

**第2段 用途別の処理原価** — 第1段の原価を一定として、色素分解と金属回収のそれぞれで排水1m³あたりの総コストを出す。用途で変わるのは、必要な菌体の量（対象物質の濃度 ÷ 取り込み効率 ÷ 菌体使用回数）と、使用済み菌体の後処理。菌体を使い回せるのは色素分解だけで、金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定する。色素分解は10回使い回す前提で置いている（2026-07の設備アドオン試算と同じ。杉浦先生に確認中）。

**方式と装置を分けて並べる** — 方式は、顧客工場で処理するオンサイトと、排液をSX工場まで運んで処理するオフサイトの2つ。装置は、菌体を筒に閉じ込めて排液を通す循環カートリッジと、菌体を槽に入れて混ぜ膜でこし取る直接投入の2つで、どちらの方式でも選べる。

**SXの原価に入れるのはSXがやる作業だけ** — 顧客工場での処理の運転は顧客がやる作業として、SXの原価にも作業時間にも入れない。オフサイトではSX工場でSXが運転するので、SXの原価に入る。

**顧客工場の設備・装置の費用と汚泥の処分は顧客が持つ** — 顧客工場に置くリアクター（処理設備）と槽は顧客が買い、装置を動かす消耗品・電力・点検・交換部品（循環カートリッジの菌体保持モジュールを含む）、処理水の分析と薬剤、顧客工場で出る使用済み菌体の汚泥の処分も顧客が持つ（2026-09-14 まさ）。いずれもSXの原価に入れない。オンサイトでSXの原価に残る現場の費用は、菌体の補充分、菌体を運ぶ巡回と容器、モジュールや膜の交換の作業、立入制限と教育訓練（強化株）。明細ごとに誰が持つか（SX / 顧客 / 処理する場所の持ち主）を持ち、画面で変えられる。SX工場で処理するオフサイトでは、設備・槽・装置の費用・汚泥の処分はSXが持つ。

操作パネルで株・用途・方式・装置を切り替え（開いたときは自然株）、前提・作業リスト・明細の数字を書き換えると、結果がその場で再計算される。前提・作業リスト・明細は「事業と処理の条件」「CAPEX（初期投資）」「OPEX（毎年の費用）」の3つに分け、その中を小分けにして並べる。作業単価はすべての作業に共通の1つ。選んだ組み合わせで使わない前提・作業・明細は薄く出る。結果の欄には総コストの内訳を棒グラフで出し、操作パネルの一番上には作業の流れと段ごとの年間工数を出す。書き換えた数字は保存されない。正本へ書くのは、管理者が「この値を保存」を押したときだけ。

ちこ作成の260820版の明細を土台に、2026-09-13に二段階へ組み替えた。人件費・巡回サービス・閉鎖系の追加費用・色素用の後処理・色素の濃さを追加し、いずれも確度つきで置いている。同日、人件費を作業リスト（作業ごとの工数 × 作業単価）で持つ形に変え、販売率を足した。さらに同日、作業を流れの段に並べ直し、オフサイトの比較を足した。2026-09-14 に、方式（オンサイト / オフサイト）と装置（循環カートリッジ / 直接投入）を分け、作業ごとに誰がやるかを持たせた。同日、色素分解の菌体使用回数を10回にし、顧客工場のリアクター・槽と汚泥の処分を顧客が持つ形にした。同日、年間生産能力を入力から外し、年間処理量（売上10,000,000,000円に届く20,000,000m³/年）から年に作る量を計算する形にした。同日、作業単価をすべての作業に共通の1つにし、前提・作業リスト・明細を「事業と処理の条件 / CAPEX / OPEX」の区分に並べ直した。同日、上端の槽の表示を外し、選んだ組み合わせで使わない前提を薄く出すようにした。同日、顧客工場の装置の消耗品・電力・点検・交換部品を顧客の持ち分にし、オフサイトの循環カートリッジの処理の運転をSXの作業にした。同日、金額をカンマ区切りの円にそろえた（10,000,000,000円の形。億・万で丸めない）。同日、オフサイトの売価と年間処理量をオンサイトと別の前提に分けた。', updated_at = now() where cost_model_id = 'cm_p21_260820';
update project_cost_questions set why_it_matters = '菌体使用回数は総コスト最大の感度。1回のままだと菌体の製造原価がそのまま効き、10回を超えると菌体費は1割以下になる。20回と50回の差はほとんど無いので「10回を超えるか」だけ言い切れれば足りる。まさの記憶では数十回いける可能性があるが2026-08-23時点で未確認。 2026-09-14 から10回で置いている（2026-07の設備アドオン試算と同じ前提）。1回しか使えなければ、強化株・オンサイト・直接投入の総コストは57.9円/m³から428.1円/m³へ上がる。', updated_at = now() where cost_question_id = 'cq_260820_01';
update project_cost_questions set why_it_matters = '菌体の製造原価は自然株で312.8円/kg-DCW（強化株は色素分解 334.4円・金属回収 334.3円）。うち培養の原料は、菌体の成分（炭素・窒素・リン）と公開の買値から置いた菌体1kgあたり274.6円で、培地の組成とCO2の入れ方が分かれば置き換えられる（2026-09-14）。閉鎖系スピルリナの商用実績$2.57〜5.10/kg（約390〜770円/kg）と比べて1.2〜2.5倍楽観の可能性がある。円で聞いても答えは出ないので、量と条件だけをもらってAMD側で円へ変換する。', updated_at = now() where cost_question_id = 'cq_260820_02';
update project_cost_notes set body_md = '色素分解の菌体使用回数だけを動かしたときの総コスト（円/m³）。他の前提は据え置き（オンサイト・直接投入。処理の運転・汚泥の処分・装置の消耗品や電力は顧客、リアクターと槽は顧客が買う）。

| 株 | 菌体使用回数 | 色素分解 オンサイト・直接投入 |
|---|---|---|
| 強化株 | 1回 | 428.1 |
| 強化株 | 10回（いまの前提） | 57.9 |
| 強化株 | 30回 | 20.4 |
| 自然株 | 1回 | 402.9 |
| 自然株 | 10回（いまの前提） | 54.2 |
| 自然株 | 30回 | 18.3 |

旧版では菌体の製造拠点の設備償却が使用回数に連動しない固定額だったため、10回を超えると頭打ちになっていた。二段階版では菌体原価を1kgあたりで持つので、**菌体費が使用回数に反比例する**（SX工場で処理するオフサイトでは、使用済み菌体の処分費も反比例する）。

いまの10回は、2026-07の設備アドオン試算（色素分解は培養液を10回使い回し、運転ロス2%）と同じ前提（2026-09-14 まさ）。杉浦先生へは引き続き「10回を超えるか」を確認する。金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定している。', updated_at = now() where cost_note_id = 'cn_260820_r3';
update project_cost_notes set body_md = '色素分解ケースの対象物質の濃度（50mg/L）、取り込み効率（0.05g/g）、菌体使用回数（10回）、脱水後の湿重量倍率（5倍）は、いずれも実測ではない。

特に**菌体使用回数**は総コストへの効き方が大きい。菌体費が使用回数に反比例するため、いまの10回で57.9円/m³の総コストが、1回（使い捨て）なら428.1円/m³になる（強化株・オンサイト・直接投入）。10回は、2026-07の設備アドオン試算（色素分解は培養液を10回使い回し、運転ロス2%）と同じ前提。', updated_at = now() where cost_note_id = 'cn2_c9';
update project_cost_notes set body_md = '- **回収物の売却収入がモデルに1円も入っていない。** 収入は処理費500円/m³のみ。レアアース回収などのアップサイドが数字として表現できていない
- **菌体の製造拠点を何箇所に分けるかは決めていない。** 年間処理量（売上10,000,000,000円に届く20,000,000m³/年）から、顧客数（約667社）、年に作る菌体の量と培養設備の系列数は出している。系列はすべて1拠点に並べる前提で、拠点を分けたときに増える費用と、顧客工場までの移動が短くなる効果は入っていない
- **量産で安くなる効果は、拠点に1つの費用が薄まる分だけ。** 設備や原料をまとめて買ったときの値下がりは入れていない。菌体1kgの原価（強化株 約334円）は、2026-07の設備アドオン試算の量産目標（1,500円/kg）の4分の1以下。培養の原料は菌体の成分と公開の買値から置いたが（2026-09-14）、設備の単価と1系列の量は仮置き。1,500円/kgを上書き値に入れると、強化株・オンサイト・直接投入で色素分解 約188円/m³、金属回収 約1,672円/m³
- **オフサイトの前提は仮置き。** 排液を運ぶ費用・受け入れ設備・放流費には見積がない。顧客の排液を運んで処理するときの許可（産業廃棄物の収集運搬・処分）にかかる費用と期間は入っていない
- **閉鎖系の追加費用と巡回サービスは仮置き。** 金額の根拠となる見積がまだない（二段階版で追加）
- **色素側の数字は実測がない。** 色素の濃さ・取り込み効率・菌体使用回数・使用済み菌体の含水率は文献相場か仮置き', updated_at = now() where cost_note_id = 'cn_260820_h2';
update project_cost_notes set body_md = '燃料1Lには、基準の収率で乾燥菌体が約18.0kg要る（改善で約12.1kg、低位で約33.9kg）。菌体1kgの原価がそのまま約18.0倍（改善で約12.1倍）になって燃料1Lに乗る。

- 培養設備1系列の明細（初期投資 5,730,000円・7年、年ごとの品質確認 240,000円、培地・CO2・濃縮など菌体1kgあたり274.6円。2026-09-14 に「使う量 × 買値」に組み直した）と、培養の運転の作業（工数未確認）は、排水処理のコスト試算（260914版）の自然株の培養設備と同じ値をコピーした。各工場へ運ぶための保管・輸送設備（1,500,000円）は、燃料では使わないので除いた。片方を直しても、もう片方は変わらない
- 1系列が年33,333kgと小さいので、燃料の量では系列が2万を超え、系列ごとの品質確認がそのまま積み上がる。量産の培養設備の単位は未確定
- 培養の原料で一番大きいのはCO2で、菌体1kgあたり114.5円（マテバラ推定の2.29kg × 液化炭酸ガスの仮置き50円/kg）。次が窒素源の硝酸ナトリウムで90.8円。工場の排ガスのCO2（5円/kgと置く）と尿素が使えれば、基準・委託の総コストは6,033.5円/Lから2,708.7円/Lまで下がる', updated_at = now() where cost_note_id = 'cnf_caveat_biomass';
update project_cost_questions set impact_low = 1491, impact_high = 2983, updated_at = now() where cost_question_id = 'cqf_fame_potential';
update project_cost_questions set impact_low = 314, impact_high = 746, updated_at = now() where cost_question_id = 'cqf_extraction';
update project_cost_questions set impact_low = 37, impact_high = 370, updated_at = now() where cost_question_id = 'cq_260820_01';
insert into project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, visibility, sort_order) values ('cn12_h12', 'cm_p21_260820', 'history', '260914 培養の原料を、使う量 × 買値 に組み直した', '2026-09-14、まさの返事で、菌体の製造拠点の培養の原料を「使う量 × 買値」に組み直した。

**なぜ変えたか**
- まさ「それぞれの項目が妥当なのかの確認をどうやってすればいいかが、これだと分からない。そもそも「数量」「単価」って何？」。培養の原料の10行は、2026-08-20版の試算シートの「処理水1m³あたりX円」を処理水1m³に使う菌体1.111kgで割った仮置きで、使う量と買値の内訳が無く、確かめようがなかった
- 組み直す案に、まさ「Aで」

**何を変えたか**
- 量は、2026-09-07 の工程とマテバラ推定の設計仮定（菌体の炭素50%・窒素8%・リン1%、供給したCO2の80%を固定、窒素とリンは全量を吸う）、スピルリナの成分（カリウム1.6%・マグネシウム0.3%・鉄0.1%）、杉浦先生の回答の菌体の濃さ5g/L から置いた
- 買値は、財務省貿易統計の輸入単価（硝酸ナトリウム・りん酸二アンモニウム・塩化カリウム）、通販の25kg袋（硫酸マグネシウム・キレート鉄）、上水道の料金（東京都23区）、液化炭酸ガスの卸の相場に運賃を足した仮置きから置いた。行ごとの置き方と確かめ方は、各行の説明（画面の「根拠」）にある
- 膜・フィルタと凝集剤は買値を調べられなかったので、額は変えずに培養液の量あたりの形にした。培養ロス補充は、上の原料の合計の5%
- コスト試算（燃料）の培養設備の同じ10行も、同じ値にそろえた

| 行 | 菌体1kgに使う量 | 買値 | 菌体1kgあたり（前） |
|---|---:|---:|---:|
| 窒素源（硝酸ナトリウム） | 0.4854 kg | 187円/kg | 90.8円（9円） |
| リン源（りん酸二アンモニウム） | 0.0426 kg | 161円/kg | 6.9円（10.8円） |
| カリウム・マグネシウム・鉄・微量金属 | 0.074 kg | 324円/kg | 24.0円（7.2円） |
| CO2（液化炭酸ガス） | 2.29 kg | 50円/kg | 114.5円（4.5円） |
| 補給水（上水） | 0.014 m³ | 404円/m³ | 5.7円（1.8円） |
| 洗浄水 | 0.01 m³ | 404円/m³ | 4.0円（2.7円） |
| 洗浄薬剤（次亜塩素酸ナトリウム） | 0.01 kg | 135円/kg | 1.4円（4.5円） |
| 濃縮用フィルタ | 0.2 m³ | 45円/m³ | 9.0円（9円） |
| 濃縮補助材（凝集剤） | 0.002 kg | 2,700円/kg | 5.4円（5.4円） |
| 培養ロス補充 | 0.05 kg-DCW | 261.6円/kg-DCW | 13.1円（5.4円） |
| 合計 | | | 274.6円（60.3円） |

**数字**（オンサイト・直接投入。菌体1kgの原価は円/kg、総コストは円/m³）

| 株 | 用途 | 菌体1kgの原価 | 総コスト |
|---|---|---:|---:|
| 自然株 | 色素分解 | 98.5 → **312.8** | 30.4 → **54.2** |
| 自然株 | 金属回収 | 98.5 → **312.8** | 244.8 → **528.3** |
| 強化株 | 色素分解 | 120.1 → **334.4** | 34.1 → **57.9** |
| 強化株 | 金属回収 | 120.0 → **334.3** | 225.8 → **450.5** |

- 自然株の金属回収は、売価500円/m³を超えた（赤字）。強化株の金属回収は売価の内だが、総コスト目標300円/m³を超える。色素分解は株によらず目標の内
- オフサイトは、色素分解で約24円/m³、金属回収で約284円/m³上がった（自然株・直接投入）
- 一番大きいのはCO2（114.5円）と窒素源（90.8円）。自然株の金属回収の総コストは、尿素が使えれば 427.7円/m³、工場の排ガスのCO2（5円/kgと置く）なら 385.2円/m³、両方なら 284.6円/m³
- 閉鎖型の袋の培養でCO2の固定を10%と置く試算（米国PNNL 2018）の形なら、CO2の量は8倍になる
- 確認事項「色素を吸った菌体は、次のバッチにそのまま使えますか」の影響の幅: 22〜156 → 37〜370円/m³', 'amd_internal', 120);
insert into project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, visibility, sort_order) values ('cnf_history_culture', 'cm_p21_fuel_260914', 'history', '260914版：培養の原料を、使う量 × 買値 に組み直した', '2026-09-14 まさ「Aで」（培養の原料を「使う量 × 買値」に組み直す案）で、培養設備の原料の10行を組み直した。排水処理のコスト試算の同じ行と同じ値にそろえた（あちらの版の履歴「260914 培養の原料を、使う量 × 買値 に組み直した」）。

- 量と買値の置き方と確かめ方は、各行の説明（画面の「根拠」）にある
- 菌体1kgの原料 60.3円 → 274.6円（CO2 114.5円・窒素源 90.8円・カリウム・マグネシウム・鉄・微量金属 24.0円 など）。菌体1kgの原価 92.1円 → 306.4円

| FAME転換 | 低位 | 基準 | 改善 |
|---|---:|---:|---:|
| 外部に委託 | 4,003.6 → 11,260.1 | 2,165.8 → 6,033.5 | 1,469.5 → 4,053.3 |
| 自社で行う | 4,002.1 → 11,258.6 | 2,139.9 → 6,007.6 | 1,434.4 → 4,018.2 |

- 燃料1Lあたりの総コスト（円/L）。売価で成立する菌体の原価は燃料化の工程だけで決まるので変わらず、6通りすべてマイナスのまま
- 事業全体の年間（委託・基準）の総コスト: 108,290,302,687円 → 301,674,630,796円
- 確認事項の影響の幅（円/L）: FAMEポテンシャル 524〜1,049 → 1,491〜2,983、脂質抽出回収率 110〜262 → 314〜746
- 基準・委託の総コストは、尿素が使えれば 4,661.2円/L、工場の排ガスのCO2（5円/kgと置く）なら 4,080.9円/L、両方なら 2,708.7円/L', 'amd_internal', 17);

commit;
