-- 433: SOL（p21）の脂質分泌株の回収を、溶媒の蒸留から「アルカリで抜いて酸で油に戻し、浮かせて分ける」へ置き直す
-- （まさ 2026-09-14「蒸留回収とかしなくてよくならない？油だから浮くか沈むかするよね。かなりコストかけずに分離できるのでは」）
--
--   - 蒸留で分ける形は成り立たない: 脂肪酸は溶媒の約0.17%しかなく、蒸発させる熱が約147 MJ/kg ＝ 燃料自身の発熱量の4倍
--   - 培養液（pH 9〜10）では脂肪酸は石鹸の側にいて浮かない（集まった脂肪酸の見かけの pKa は 8.3〜10.2）。pH 4以下で油に戻る
--   - 明細6行を置き直し（蒸留塔5億 → 酸析槽・デカンター2億、熱 20 → 5 MJ/kg、電力 0.5 → 1.0 kWh/kg ほか）、薬品2行を足す
--   - 溶媒まわりの説明に、回す量の出どころ・削ったときの効き目・カルシウムで固まる危険を書く
--   - 版の履歴と確認事項を足し、注意の注記を直す
-- 生成: apply433.py（scratchpad）。fixture を同じ定義から書き出した。
begin;
select set_config('amd.cost_change_reason', '433: 脂質分泌株の回収を蒸留から酸析・重力分離へ直す（まさ 2026-09-14）', true);
do $do$ begin
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_sec_plant_strip' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 500000000 and md5(note) = 'fec95b964dc8c34aad67c15fbb7b3d43') then raise exception '433: 明細 cif_sec_plant_strip が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_sec_plant_solvent' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 300000000 and md5(note) = '205d3ab446763b863c72c36886a35168') then raise exception '433: 明細 cif_sec_plant_solvent が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_sec_plant_utility' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 600000000 and md5(note) = 'e47a04ae200681c975622dfca77fe4ff') then raise exception '433: 明細 cif_sec_plant_utility が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_sec_op_heat' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 20 and unit_price = 2.3 and md5(note) = 'eaf4f4f84fd3d59189d1f9f4e9cd445a') then raise exception '433: 明細 cif_sec_op_heat が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_sec_op_power' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 0.5 and unit_price = 17.45 and md5(note) = '9b97d608b5ac322d2d1a6b56b9f0d218') then raise exception '433: 明細 cif_sec_op_power が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_sec_op_maintenance' and cost_model_id = 'cm_p21_fuel_260914' and quantity = 1 and unit_price = 46500000 and md5(note) = '2f474556cece018c2af3130fa289a8c1') then raise exception '433: 明細 cif_sec_op_maintenance が変わっている'; end if;
  if exists (select 1 from project_cost_items where cost_item_id = 'cif_sec_naoh') then raise exception '433: 明細 cif_sec_naoh がもうある'; end if;
  if exists (select 1 from project_cost_items where cost_item_id = 'cif_sec_h2so4') then raise exception '433: 明細 cif_sec_h2so4 がもうある'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_sec_solvent_fill' and cost_model_id = 'cm_p21_fuel_260914' and md5(note) = '7d28b58b90d354a0c489bb0f23be7b52') then raise exception '433: 明細 cif_sec_solvent_fill の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_sec_solvent_makeup' and cost_model_id = 'cm_p21_fuel_260914' and md5(note) = '27244403cff557c8a75dc3c8dd93f28e') then raise exception '433: 明細 cif_sec_solvent_makeup の説明が変わっている'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id = 'cnf_history_recovery') then raise exception '433: 注記 cnf_history_recovery がもうある'; end if;
  if not exists (select 1 from project_cost_notes where cost_note_id = 'cnf_caveat_secreting' and md5(body_md) = '94e60161214f3da7aa704cd0f2ae2ad6') then raise exception '433: 注意 cnf_caveat_secreting が変わっている'; end if;
  if exists (select 1 from project_cost_questions where cost_question_id = 'cqf_secretion_solvent') then raise exception '433: 確認事項がもうある'; end if;
end $do$;

update project_cost_items set mid_label = '酸で油に戻して分ける設備', leaf_label = '酸析槽・デカンター・中和槽', quantity = 1, unit_price = 200000000, note = '見積のない推測値。脂肪酸は培養液（pH 9〜10）では石鹸（脂肪酸イオン）として水に溶けていて、そのままでは浮かない。アルカリを混ぜて溶媒から水へ移し、その濃い石鹸水に酸を入れると遊離の脂肪酸（油）に戻って浮くので、静置と遠心で分ける。溶媒を蒸留して分ける形は採らない: 実験（Kato ら 2017）で脂肪酸は溶媒の約0.17%しかないので、脂肪酸1kgあたり溶媒を約590kg蒸発させることになり、熱が約147 MJ/kg ＝ できる燃料自身の発熱量（約39 MJ/kg）の4倍になる。確かめ方: 食用油の精製で、石鹸分（ソープストック）に硫酸を入れて脂肪酸に戻す「酸分解」と同じ操作で、装置は混合槽と分離機。蒸留塔（5億円で置いていた）より軽い設備として2億円で置いた。出どころ: 2026-09-14 に置き直し（それまでは「溶媒から脂肪酸を分ける設備（蒸留塔・凝縮器・受槽）5億円」）。', updated_at = now() where cost_item_id = 'cif_sec_plant_strip';
update project_cost_items set mid_label = '濃い石鹸水の受槽・送液設備', leaf_label = 'タンク・ポンプ', quantity = 1, unit_price = 100000000, note = '見積のない推測値。培養の拠点でアルカリに抜いた脂肪酸（石鹸水）を受けて、酸析へ送る設備。溶媒そのものは培養の拠点で回して使い、工場へは運ばない（運ぶと脂肪酸1kgあたり溶媒が1t以上動く）。確かめ方: 石鹸水を脂肪酸50 g/L まで濃くして送るなら、脂肪酸1kgあたり20Lで済む。出どころ: 2026-09-14 に置き直し（それまでは「溶媒の貯槽・循環設備 3億円」）。', updated_at = now() where cost_item_id = 'cif_sec_plant_solvent';
update project_cost_items set mid_label = '付帯設備・据付工事', leaf_label = '配管・計装・電気・土木・排水処理', quantity = 1, unit_price = 350000000, note = '見積のない推測値。分泌株のときの燃料化の工場の付帯。確かめ方: 機器の合計（酸析2億＋受槽1億＋製品の貯槽1.5億 ＝ 4.5億円）の約8割。酸とアルカリを使うので排水の中和と塩（硫酸ナトリウム）の処理が要る。出どころ: 2026-09-14 に置き直し（それまでは6億円）。', updated_at = now() where cost_item_id = 'cif_sec_plant_utility';
update project_cost_items set mid_label = '熱', leaf_label = '酸析のための加温（60〜95℃）', quantity = 5, unit_price = 2.3, note = '推定値。酸を入れて油に戻すとき、油と水がきれいに分かれるように温める分。確かめ方: 石鹸水を脂肪酸50 g/L まで濃くすると脂肪酸1kgあたり水20L。それを50℃上げるのに 20kg × 4.18 kJ/kg・K × 50K ＝ 4.2MJ。損失を見て5MJ。食用油の酸分解は65〜95℃で行う（連続式で回収率98〜100%）。蒸留で分ける形をやめたので、20 MJ/kg-脂肪酸（46円）から5 MJ（11.5円）に下げた。出どころ: 2026-09-14 に置き直し（まさ 2026-09-14「蒸留回収とかしなくてよくならない？油だから浮くか沈むかするよね。かなりコストかけずに分離できるのでは」）。', updated_at = now() where cost_item_id = 'cif_sec_op_heat';
update project_cost_items set mid_label = '電力', leaf_label = '溶媒の循環・アルカリとの混合・分離', quantity = 1.0, unit_price = 17.45, note = '見積のない推測値。溶媒を培養液と接触させて回す動力と、アルカリと混ぜて脂肪酸を抜く動力、酸析のあとの分離。確かめ方: 溶媒に移る濃さは培養液の約12倍（Kato ら 2017 で 培養液0.034 g/L・溶媒0.40 g/L）なので、培養液を0.036 g/L に保つと溶媒は0.42 g/L 止まり。脂肪酸1kgあたり溶媒を約2.4m³（2t）回すことになる。送るだけなら0.2 kWh/m³ で0.5 kWh、遠心分離機を通すと0.9 kWh/m³ で2.2 kWh。大きい流れは重力で分け、酸析のあとの少量だけ遠心にかける置き方で 1.0 kWh/kg-脂肪酸。石鹸は乳化剤でもあるので、きれいに分かれずに遠心が要る量が増えると、ここは数倍になる。蒸留をやめた代わりに混合と分離が増えるので、0.5 → 1.0 kWh/kg-脂肪酸 に上げた。', updated_at = now() where cost_item_id = 'cif_sec_op_power';
update project_cost_items set mid_label = '設備の保守', leaf_label = '燃料化設備（酸析・受槽・付帯・出荷）の初期投資の3%/年', quantity = 1, unit_price = 24000000, note = '見積のない推測値。確かめ方: 1系列の初期投資（2億＋1億＋3.5億＋製品の貯槽1.5億 ＝ 8億円）の3%。出どころ: 2026-09-14 に置き直し（それまでは15.5億円の3% ＝ 4,650万円）。', updated_at = now() where cost_item_id = 'cif_sec_op_maintenance';
insert into project_cost_items (cost_model_id, cost_item_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application, bearer) values ('cm_p21_fuel_260914', 'cif_sec_naoh', '共通', 'OPEX', '脂肪酸を回収する', '苛性ソーダ（溶媒から脂肪酸を抜く）', '純分換算', '毎kg菌体比例', 0.178, 'kg/kg-脂肪酸', 60, '円/kg', null, 1.0, null, false, 'C', '推定', 'AMD（内部）', '推定値。溶媒の中の脂肪酸を、アルカリと反応させて石鹸にし、水の側へ移すために使う。確かめ方: 脂肪酸の平均分子量を270 g/mol とすると、脂肪酸1kgは3.7モル。同じモル数の水酸化ナトリウム（40 g/mol）で148g、余分を1.2倍見て178g。培養液そのものをアルカリにするのではなく、溶媒と少量の水を混ぜるだけなので、培養液の量には比例しない。', 'amd_internal', 2113, 'secreting', null, 'sx');
insert into project_cost_items (cost_model_id, cost_item_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application, bearer) values ('cm_p21_fuel_260914', 'cif_sec_h2so4', '共通', 'OPEX', '脂肪酸を回収する', '硫酸（酸で油に戻す）', '純分換算', '毎kg菌体比例', 0.27, 'kg/kg-脂肪酸', 30, '円/kg', null, 1.0, null, false, 'C', '推定', 'AMD（内部）', '推定値。濃い石鹸水に入れて、脂肪酸を油に戻して浮かせるための酸。確かめ方: 脂肪酸1kg ＝ 3.7モルに対し、硫酸は2価なので1.85モル ＝ 181g。pH を3まで下げる余分を1.5倍見て270g。**培養液そのものを酸性にする形は採らない**: 培養液は脂肪酸1kgあたり約28m³あり、培地の緩衝分まで中和すると硫酸が10kg以上要るうえ、菌体が死に、戻すアルカリと塩（硫酸ナトリウム）も増える。先に溶媒とアルカリで濃くしてから酸を入れるので、薬品は脂肪酸の分だけで済む。', 'amd_internal', 2114, 'secreting', null, 'sx');
update project_cost_items set note = '見積のない推測値。培養液に重ねて、出てきた脂肪酸を受け続ける溶媒。**分泌株でいちばん大きい設備の費用**。確かめ方: 1系列の培養液 222 m³ の5%（11.1 m³）を溶媒の量とし、買値は1kg 500円 × 0.9 t/m³ ＝ 45万円/m³ で置いた。Kato ら 2017 の実験は培養液50 mL に溶媒20 mL（40%）だった。5%で足りるかは確かめていない（40%なら8倍になる）。買値はミリスチン酸イソプロピルの市販の相場（1kg 1.8〜4.7ドル、2025〜26年）の真ん中あたり。**この行だけで燃料1Lあたり305.8円**（分泌株の総コストの23.7%）で、培養液の1%にできれば61.2円まで下がる。危険: 培養液のカルシウム・マグネシウムと脂肪酸が結びつくと、水に溶けない固まり（金属石鹸）になって沈み、溶媒に移らずに失われる（海水を使う培地では特に起きやすい）。培養液の量が変わったら、この行の量を置き直す。', updated_at = now() where cost_item_id = 'cif_sec_solvent_fill';
update project_cost_items set note = '見積のない推測値。溶媒を回して使うときに、培養液に溶けたり分離で失ったりする分の補給。確かめ方: 溶媒に移る濃さは培養液の約12倍止まり（Kato ら 2017 で 培養液0.034 g/L・溶媒0.40 g/L）なので、培養液を0.036 g/L に保つと溶媒は0.42 g/L。**脂肪酸1kgあたり溶媒を約2.4m³（2t）回す**ことになる。そのうち0.005%を失うとして0.11 kg。溶媒そのものが水に溶ける量はごくわずか（1Lあたり0.05 mg）なので、失うのは飛ぶ分と、分離しきれずに水と一緒に出ていく分。実測は無い。ここが10倍になると脂肪酸1kgあたり550円増える。', updated_at = now() where cost_item_id = 'cif_sec_solvent_makeup';
insert into project_cost_notes (cost_model_id, cost_note_id, section, title, body_md, source_url, source_label, visibility, sort_order) values ('cm_p21_fuel_260914', 'cnf_history_recovery', 'history', '脂質分泌株の回収を、蒸留から酸析へ置き直した（2026-09-14）', 'まさ 2026-09-14「蒸留回収とかしなくてよくならない？油だから浮くか沈むかするよね。かなりコストかけずに分離できるのでは」

**まさの指摘は当たっていた。蒸留で分ける置き方は、そもそも成り立たない。**

Kato ら 2017 の実験では、脂肪酸は溶媒の約0.17%しかない。溶媒を蒸留して脂肪酸を残す形だと、脂肪酸1kgあたり溶媒を約590kg蒸発させることになり、熱が約147 MJ/kg ＝ **できる燃料自身の発熱量（約39 MJ/kg）の4倍**になる。432 で置いた 20 MJ/kg は甘すぎた。

**ただし「油だから浮く」には条件がある。** 長い脂肪酸は、分子が集まると酸としての強さが変わり、見かけの pKa が 8.3〜10.2 になる（Kanicky・Shah 2000, 2002）。培養液（pH 9〜10）では石鹸の側にいて、水に混ざったまま浮かない。pH を4以下に下げて初めて油に戻って浮く。

**置き直した形**: 溶媒にアルカリを混ぜて脂肪酸を水の側へ移す（溶媒は培養へ戻す）→ 濃い石鹸水に硫酸を入れて油に戻す → 温めて静置・遠心で分ける。食用油の精製で石鹸分を脂肪酸に戻す「酸分解」と同じ操作（pH 2.5〜3、65〜95℃、連続式で回収率98〜100%）。薬品は脂肪酸の分だけで済む（脂肪酸1kg ＝ 3.7モルに対し 苛性ソーダ178g・硫酸270g ＝ 合わせて18.8円）。

**培養液そのものを酸性にする形は採らない**: 培養液は脂肪酸1kgあたり約28m³ある。培地の緩衝分を中和する硫酸は、薄い培地なら1m³あたり0.01〜0.02kg だが、重曹を入れる高濃度の培養だと 4.9〜9.8 kg/m³ で、脂肪酸そのものを中和する量の70〜135倍になる。菌体も死ぬので先に膜で分ける必要があり、戻すアルカリと塩（硫酸ナトリウム）も増える。

**数字の動き（外部に委託・基準、排ガス OFF）**

| | 432（蒸留） | 433（酸析） |
|---|---|---|
| 燃料1Lあたりの総コスト | 1,311.8 円 | 1,289.7 円 |
| うち培養液からの回収 | 83.6 円 | 71.8 円 |
| うち燃料化設備の償却 | 21.3 円 | 11.0 円 |

効いたのは 22.1 円/L（1.7%）。回収の段は分泌株の総コストの1割に満たないので、直しても全体は大きく動かない。

**残る大きい項目**: 培養液に重ねる溶媒の初期充填が、燃料1Lあたり 305.8 円（総コストの23.7%）、事業全体の初期投資では 1,070億円（42.7%）。培養液の5%という置き方（研究室の実験は40%）が効いていて、1%にできれば燃料1Lあたり5分の1になる。溶媒を使わずに泡で集める形（石鹸は界面活性剤なので泡に集まる。藻の回収では界面活性剤を足して泡で集める方法が実際に使われている）が成り立てば、この項目と溶媒の補給が消える。脂肪酸での実測は見つかっていない。

**池から直接すくう形は成り立たない**: 培養液0.3 g/L の脂肪酸を全部浮かせても、油の膜は約0.1mm。市販のすくう機械は7〜25mmの厚みを前提にしていて、桁が2つ足りない。', null, null, 'amd_internal', 22);
update project_cost_notes set body_md = '脂質分泌株の列は、まだ作られていない株を前提にした試算。分泌速度・培養液からの回収率・菌体を使い続けられる日数は研究室の小さい容器の値で、屋外や大きい槽での実測は無い。溶媒相の量と買値、溶媒から脂肪酸を分ける設備と熱は、見積のない推測値。

いちばん効くのは分泌速度。0.036 g/L/日 を半分にすると培養設備の系列数と初期投資が2倍になり、「脂肪酸1kgあたりに入れ替える菌体 0.4 kg」を2倍にすると原料が2倍になる。両方とも画面で動かして確かめられる。

回収の方法は 2026-09-14 に置き直した（溶媒を蒸留する形から、アルカリで抜いて酸で油に戻し浮かせて分ける形へ）。蒸留する形は、脂肪酸が溶媒の0.2%ほどしかないので熱が燃料自身の発熱量を超えて成り立たない。置き直しで効いたのは燃料1Lあたり 22.1 円で、いちばん大きい項目は培養液に重ねる溶媒（305.8 円/L、初期投資 1,070億円）のまま。', updated_at = now() where cost_note_id = 'cnf_caveat_secreting';
insert into project_cost_questions (cost_model_id, cost_question_id, addressee, question, why_it_matters, impact_low, impact_high, status, answer, answered_on, linked_assumption_id, visibility, sort_order) values ('cm_p21_fuel_260914', 'cqf_secretion_solvent', '杉浦先生', '培養液に生体に優しい溶媒（ミリスチン酸イソプロピルなど）を重ねて脂肪酸を受ける形は、培養液に対してどれくらいの量の溶媒が要りそうですか。研究室の実験は培養液の40%ですが、大きい槽で薄く重ねる、または別の槽で接触させる形にすると何%まで減らせますか。', '溶媒の初期充填が分泌株の設備費でいちばん大きい（培養液の5%と置いて事業全体で1,070億円）。1%にできれば燃料1Lあたり5分の1になる。溶媒を使わず泡で集められるかも合わせて聞きたい。', null, null, 'open', null, null, null, 'amd_internal', 17);
commit;
