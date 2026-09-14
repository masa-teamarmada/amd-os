-- 430: SOL（p21）の2つのコスト試算の CO2 の行に「排ガス利用可能」のスイッチを置く（2026-09-14 まさ「「排ガス利用可能」のスイッチをCO2コストのところに設置してほしい。それがONのときはCO2コストがゼロになるようにして」）
--
--   - 明細の単価の連動のしかたに co2_supply（CO2。前提 co2_flue_gas が on なら0円）と culture_loss（培養ロス補充。上の原料の行の合計）を足す（check 制約）
--   - 前提 co2_flue_gas「排ガス利用可能」（value_text off）を両方の試算に足す。画面は前提の一覧に出さず、CO2 の明細の行にスイッチを出す
--   - CO2 の行（ci_260820_123・cif_culture_123）を co2_supply、培養ロス補充（ci_260820_134・cif_culture_134）を culture_loss にし、説明を書き換える
--   - 版の履歴の注記を1件ずつ足す（OFF / ON の数字）
--   - OFF のままの数字は、培養ロス補充の単価を丸めない合計（261.55円）にした分だけ0.1円ほど動く（燃料 基準・委託 6,033.5 → 6,033.4円/L）
--   - ON のとき 自然株 金属回収 オンサイト・直接投入 528.3 → 369.3円/m³、燃料 基準・委託 6,033.4 → 3,863.9円/L
-- 生成: gen430.py（scratchpad）。fixture 2つを同じ定義から書き出した。
-- 書き換える行の値・文章がこの migration を作った時点（2026-09-14 21時台）から変わっていたら、何もせずに止める。
begin;
do $do$ begin
  if (select pg_get_constraintdef(oid) from pg_constraint where conname = 'project_cost_items_price_rule_check') <> 'CHECK (((price_rule IS NULL) OR (price_rule = ANY (ARRAY[''biomass''::text, ''broth''::text, ''module_swap''::text, ''power_circulation''::text, ''power_injection''::text, ''spent_disposal''::text]))))' then raise exception '430: 単価の連動のしかたの制約が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_123' and cost_model_id = 'cm_p21_260820' and price_rule is null and quantity = 2.29 and unit_price = 50 and md5(note) = '1dec77fac04d52e6e7ab90b95be99893') then raise exception '430: 明細 ci_260820_123 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_134' and cost_model_id = 'cm_p21_260820' and price_rule is null and quantity = 0.05 and unit_price = 261.6 and md5(note) = '04376b1bbf228ec73331485cf18b7296') then raise exception '430: 明細 ci_260820_134 が変わっている'; end if;
  if exists (select 1 from project_cost_assumptions where cost_model_id = 'cm_p21_260820' and role_key = 'co2_flue_gas') then raise exception '430: cm_p21_260820 に排ガス利用可能の前提がもうある'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id = 'cn14_h14') then raise exception '430: 注記 cn14_h14 がもうある'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_123' and cost_model_id = 'cm_p21_fuel_260914' and price_rule is null and quantity = 2.29 and unit_price = 50 and md5(note) = '156191062e7a5e3a008e9aa5e53178d3') then raise exception '430: 明細 cif_culture_123 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_134' and cost_model_id = 'cm_p21_fuel_260914' and price_rule is null and quantity = 0.05 and unit_price = 261.6 and md5(note) = 'b03b524bd23c5a864582687c86b464ad') then raise exception '430: 明細 cif_culture_134 が変わっている'; end if;
  if exists (select 1 from project_cost_assumptions where cost_model_id = 'cm_p21_fuel_260914' and role_key = 'co2_flue_gas') then raise exception '430: cm_p21_fuel_260914 に排ガス利用可能の前提がもうある'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id = 'cnf_history_flue_gas') then raise exception '430: 注記 cnf_history_flue_gas がもうある'; end if;
end $do$;

alter table project_cost_items drop constraint if exists project_cost_items_price_rule_check;
alter table project_cost_items add constraint project_cost_items_price_rule_check
  check (price_rule is null or price_rule in (
    'biomass', 'broth', 'module_swap', 'power_circulation', 'power_injection', 'spent_disposal',
    'co2_supply', 'culture_loss'
  ));
comment on column project_cost_items.price_rule is '単価の連動のしかた（null は unit_price をそのまま使う）。biomass / broth = 旧版の菌体量・培養液量の倍率、module_swap = モジュール一式 ÷ 耐用 ÷ 1バッチの量、power_circulation / power_injection = 動力 × 反応時間 × 電力単価 ÷ 1バッチの量、spent_disposal = 湿重量倍率 × 汚泥の処分単価、co2_supply = CO2（前提 co2_flue_gas が on なら0円、off なら unit_price）、culture_loss = 培養ロス補充（同じ群の菌体1kgあたりの原料の行の額の合計。unit_price は使わない）。migration 430';

insert into project_cost_assumptions (cost_assumption_id, cost_model_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('ca13_co2_flue_gas', 'cm_p21_260820', '菌体の製造拠点（原料・品質確認）', '排ガス利用可能', null, 'off', null, 'C', '仮置き', 'AMD（内部）', true, 'co2_flue_gas', '培養の CO2 を、工場の排ガスでまかなえるか。スイッチは OPEX「菌体の製造拠点（原料・品質確認）」の CO2 の行にある（2026-09-14 まさ「「排ガス利用可能」のスイッチをCO2コストのところに設置してほしい。それがONのときはCO2コストがゼロになるようにして」）。ON にすると CO2 の単価を0円として計算する（量と液化炭酸ガスの買値は行に残る）。培養ロス補充は原料の合計に作り直す割合を掛けるので、一緒に下がる。既定は OFF（液化炭酸ガスを買う）。0円は、排ガスをタダでそのまま吹き込めるときの効果で、次は入っていない: 排ガスを送る送風機と配管、燃やすものによってはすすや硫黄分を取り除く設備、培養の拠点を排ガスの出る工場の隣に置くしばり、排ガスの CO2 は濃さが数%〜2割ほどなので吹き込む量と電気代が増え、吸わせきれる割合（いまは80%）も下がりやすいこと。出どころ: ちこさんの試算シートの 2026-07-16版は、CO2 を「CO2/ガス・補助剤　処理水1m³あたり10円」とし、根拠に「排ガス利用等も想定した最小構成。詳細仕様未確定。」と書いていた（排ガスを使う前提の額）。', 'amd_internal', 320, null, null);
update project_cost_items set price_rule = 'co2_supply', note = '量: 菌体の乾燥重量の半分が炭素（2026-09-07 の工程とマテバラ推定の設計仮定。Synechocystis 51.4%）→ 菌体1kgに固定するCO2 1.83kg。供給したCO2のうち菌体に固定する割合を80%（同じ設計仮定）として2.29kg。固定する割合は培養のしかたで大きく変わり、閉鎖型の袋の培養で10%と置く試算（米国PNNL 2018）では8倍、開放池で75%（米国エネルギー省 2023）。買値: 50円/kg の仮置き。液化炭酸ガスの卸の相場 FOB東京 約225ドル/t（2026年4〜6月、ChemAnalyst）は1ドル150円で約34円/kgで、届け先までの運賃と貯槽の費用を足した。施設園芸のボンベ買いでは約120円/kg。メーカー各社は2023〜2025年に15〜30%ずつ値上げしている。確かめ方: CO2をどう入れるか（ボンベ・液化炭酸ガスの貯槽・工場の排ガス）と、吸わせきれる割合を杉浦先生に聞き、液化炭酸ガスはメーカー（日本液炭・エア・ウォーター炭酸など）に量と場所で見積を取る。工場の排ガスから回収するなら、国の2030年目標で回収だけ 2,000円台/t（1kgあたり約2〜3円）。工場の排ガスを使えるなら、この行の「排ガス利用可能」を ON にすると、単価を0円として計算する（買値の欄はそのまま残る。2026-09-14 まさ「それがONのときはCO2コストがゼロになるようにして」）。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_123';
update project_cost_items set price_rule = 'culture_loss', note = '仮置き。培養がうまくいかずに作り直す割合を5%とし（数量）、上の原料9行の菌体1kgあたりの額の合計を単価として掛ける。単価は上の9行から計算するので、原料の行を書き換えたり、CO2 の「排ガス利用可能」を ON にしたりすると一緒に動く（2026-09-14 から。それまでは合計261.6円を直に置いていて、上の行を書き換えても変わらなかった）。確かめ方: 1年に失敗する培養の割合を杉浦先生に聞いて比べる。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'ci_260820_134';
insert into project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, source_url, source_label, visibility, sort_order) values ('cn14_h14', 'cm_p21_260820', 'history', '260914 CO2 の行に「排ガス利用可能」のスイッチを置いた', '2026-09-14、まさの依頼で、培養の CO2 を工場の排ガスでまかなえるかを切り替えられるようにした。

**なぜ変えたか**
- まさ「「排ガス利用可能」のスイッチをCO2コストのところに設置してほしい。それがONのときはCO2コストがゼロになるようにして」
- 培養の原料を「使う量 × 買値」に組み直したら、CO2 が菌体1kgあたり4.5円 → 114.5円になり、原料の中で一番大きくなった。前の額の元は、ちこさんの試算シートの 2026-07-16版で「排ガス利用等も想定した最小構成」として置かれた「CO2/ガス・補助剤　処理水1m³あたり10円」だった

**何を変えたか**
- 前提「排ガス利用可能」（既定 OFF）を足し、スイッチを OPEX「菌体の製造拠点（原料・品質確認）」の CO2 の行に置いた。ON のとき CO2 の単価を0円にする
- 培養ロス補充の単価を、上の原料9行の合計から計算するようにした（前は261.6円を直に置いていた）。CO2 を0円にすると、作り直す分の CO2 も消える。合計を丸めずに使うので、OFF のままでも一部の数字が0.1円ほど動いた（例: 金属回収・オフサイト・直接投入 51,110.3 → 51,109.9円/m³）

**ON にしたときの数字**（2026-09-14 の値、自然株）

| | OFF | ON |
|---|---:|---:|
| 菌体1kgの原価 | 312.8円 | 192.6円 |
| 金属回収・オンサイト・直接投入 | 528.3円/m³ | 369.3円/m³ |
| 色素分解・オンサイト・直接投入 | 54.2円/m³ | 40.9円/m³ |
| 金属回収・オフサイト・直接投入 | 51,109.9円/m³ | 35,207.2円/m³ |

0円は排ガスをタダでそのまま吹き込めるときの上限の効果。排ガスを送る設備、きれいにする設備、拠点を工場の隣に置くしばり、吹き込む量が増える分の電気代は入っていない。', null, null, 'amd_internal', 140);
insert into project_cost_assumptions (cost_assumption_id, cost_model_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('caf_co2_flue_gas', 'cm_p21_fuel_260914', '培養の原料・品質確認', '排ガス利用可能', null, 'off', null, 'C', '仮置き', 'AMD（内部）', true, 'co2_flue_gas', '培養の CO2 を、工場の排ガスでまかなえるか。スイッチは OPEX「培養の原料・品質確認」の CO2 の行にある（2026-09-14 まさ「「排ガス利用可能」のスイッチをCO2コストのところに設置してほしい。それがONのときはCO2コストがゼロになるようにして」）。ON にすると CO2 の単価を0円として計算する（量と液化炭酸ガスの買値は行に残る）。培養ロス補充は原料の合計に作り直す割合を掛けるので、一緒に下がる。既定は OFF（液化炭酸ガスを買う）。0円は、排ガスをタダでそのまま吹き込めるときの効果で、次は入っていない: 排ガスを送る送風機と配管、燃やすものによってはすすや硫黄分を取り除く設備、培養の拠点を排ガスの出る工場の隣に置くしばり、排ガスの CO2 は濃さが数%〜2割ほどなので吹き込む量と電気代が増え、吸わせきれる割合（いまは80%）も下がりやすいこと。出どころ: ちこさんの試算シートの 2026-07-16版は、CO2 を「CO2/ガス・補助剤　処理水1m³あたり10円」とし、根拠に「排ガス利用等も想定した最小構成。詳細仕様未確定。」と書いていた（排ガスを使う前提の額）。', 'amd_internal', 310, null, null);
update project_cost_items set price_rule = 'co2_supply', note = '量: 菌体の乾燥重量の半分が炭素（2026-09-07 の工程とマテバラ推定の設計仮定。Synechocystis 51.4%）→ 菌体1kgに固定するCO2 1.83kg。供給したCO2のうち菌体に固定する割合を80%（同じ設計仮定）として2.29kg。固定する割合は培養のしかたで大きく変わり、閉鎖型の袋の培養で10%と置く試算（米国PNNL 2018）では8倍、開放池で75%（米国エネルギー省 2023）。買値: 50円/kg の仮置き。液化炭酸ガスの卸の相場 FOB東京 約225ドル/t（2026年4〜6月、ChemAnalyst）は1ドル150円で約34円/kgで、届け先までの運賃と貯槽の費用を足した。施設園芸のボンベ買いでは約120円/kg。メーカー各社は2023〜2025年に15〜30%ずつ値上げしている。確かめ方: CO2をどう入れるか（ボンベ・液化炭酸ガスの貯槽・工場の排ガス）と、吸わせきれる割合を杉浦先生に聞き、液化炭酸ガスはメーカー（日本液炭・エア・ウォーター炭酸など）に量と場所で見積を取る。工場の排ガスから回収するなら、国の2030年目標で回収だけ 2,000円台/t（1kgあたり約2〜3円）。工場の排ガスを使えるなら、この行の「排ガス利用可能」を ON にすると、単価を0円として計算する（買値の欄はそのまま残る。2026-09-14 まさ「それがONのときはCO2コストがゼロになるようにして」）。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_123';
update project_cost_items set price_rule = 'culture_loss', note = '仮置き。培養がうまくいかずに作り直す割合を5%とし（数量）、上の原料9行の菌体1kgあたりの額の合計を単価として掛ける。単価は上の9行から計算するので、原料の行を書き換えたり、CO2 の「排ガス利用可能」を ON にしたりすると一緒に動く（2026-09-14 から。それまでは合計261.6円を直に置いていて、上の行を書き換えても変わらなかった）。確かめ方: 1年に失敗する培養の割合を杉浦先生に聞いて比べる。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。', updated_at = now() where cost_item_id = 'cif_culture_134';
insert into project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, source_url, source_label, visibility, sort_order) values ('cnf_history_flue_gas', 'cm_p21_fuel_260914', 'history', '260914版：CO2 の行に「排ガス利用可能」のスイッチを置いた', '2026-09-14 まさ「「排ガス利用可能」のスイッチをCO2コストのところに設置してほしい。それがONのときはCO2コストがゼロになるようにして」で、培養設備の CO2 の行にスイッチを置いた。排水処理のコスト試算の同じ行にも同じスイッチを置いた（あちらの版の履歴「260914 CO2 の行に「排ガス利用可能」のスイッチを置いた」）。

- 前提「排ガス利用可能」（既定 OFF）。ON のとき CO2 の単価を0円にする。スイッチは OPEX「培養の原料・品質確認」の CO2 の行にある
- 培養ロス補充の単価を、上の原料9行の合計から計算するようにした（前は261.6円を直に置いていた）。合計を丸めずに使うので、OFF のままでも0.1円ほど動いた（基準・委託 6,033.5 → 6,033.4円/L）
- 菌体1kgの原価 306.4円 → ON で 186.2円

燃料1Lあたりの総コスト（円/L、OFF → ON）

| FAME転換 | 低位 | 基準 | 改善 |
|---|---:|---:|---:|
| 外部に委託 | 11,260.0 → 7,189.6 | 6,033.4 → 3,863.9 | 4,053.3 → 2,604.0 |
| 自社で行う | 11,258.5 → 7,188.1 | 6,007.5 → 3,838.0 | 4,018.1 → 2,568.8 |

ON でも6通りすべてで売価200円/Lを大きく上回る。0円は排ガスをタダでそのまま吹き込めるときの上限の効果で、排ガスを送る設備・きれいにする設備・拠点の場所のしばり・吹き込む量が増える分の電気代は入っていない。', null, null, 'amd_internal', 18);
commit;
