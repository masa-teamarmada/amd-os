-- 434: SOL（p21）の両方のコスト試算の培地の原料の行に「工場の排液を培地に使える」のスイッチを置く
-- （まさ 2026-09-15「その結果次第では、燃料事業は、顧客の工場のCO2と排熱、排ガスをフル活用してやる方向も見えてくる」）
--
--   - 単価の連動のしかたに medium_supply を足す（前提 waste_medium が on なら unit_price × (1 − waste_medium_reduction%)）
--   - 前提 waste_medium「工場の排液を培地に使える」（value_text off）と waste_medium_reduction「排液で減る培地の原料の割合」（80%）を両方の試算に足す
--     画面は前提の一覧にスイッチを出さず、培地の原料の3行（窒素源・リン源・カリウムなど）に出す。割合は前提の一覧で変える
--   - 培地の原料の3行 × 2つの試算 = 6行を medium_supply にし、説明に切り替えの一文を足す
--   - 版の履歴の注記を1件ずつ足す（OFF / ON の数字と、使える排液の条件）
--   - 80% の出どころは、ちこさんの試算シート 2026-07-30版の前提「培地原料低減率 80%（排液利用で大幅低減）」
-- 生成: apply434.py（scratchpad）。fixture 2つを同じ定義から書き出した。
begin;
select set_config('amd.cost_change_reason', '434: 培地の原料の行に「工場の排液を培地に使える」のスイッチを置く（まさ 2026-09-15）', true);
do $do$ begin
  if (select pg_get_constraintdef(oid) from pg_constraint where conname = 'project_cost_items_price_rule_check') <> 'CHECK (((price_rule IS NULL) OR (price_rule = ANY (ARRAY[''biomass''::text, ''broth''::text, ''module_swap''::text, ''power_circulation''::text, ''power_injection''::text, ''spent_disposal''::text, ''co2_supply''::text, ''culture_loss''::text]))))' then raise exception '434: 単価の連動のしかたの制約が変わっている'; end if;
  if exists (select 1 from project_cost_assumptions where cost_model_id = 'cm_p21_260820' and role_key = 'waste_medium') then raise exception '434: cm_p21_260820 に排液の前提がもうある'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id = 'cn16_h16') then raise exception '434: 注記 cn16_h16 がもうある'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_120' and cost_model_id = 'cm_p21_260820' and price_rule is null and md5(note) = 'a71137e89b498bcd77b3cea0bcefc216') then raise exception '434: 明細 ci_260820_120 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_121' and cost_model_id = 'cm_p21_260820' and price_rule is null and md5(note) = '8fc95974e0785e89184d6d7e3ef9fa79') then raise exception '434: 明細 ci_260820_121 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_122' and cost_model_id = 'cm_p21_260820' and price_rule is null and md5(note) = '4462bb4da62379642bc62de523bc1150') then raise exception '434: 明細 ci_260820_122 が変わっている'; end if;
  if exists (select 1 from project_cost_assumptions where cost_model_id = 'cm_p21_fuel_260914' and role_key = 'waste_medium') then raise exception '434: cm_p21_fuel_260914 に排液の前提がもうある'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id = 'cnf_history_waste_medium') then raise exception '434: 注記 cnf_history_waste_medium がもうある'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_120' and cost_model_id = 'cm_p21_fuel_260914' and price_rule is null and md5(note) = 'ab598c618a44a8751af487a86d9ad3c6') then raise exception '434: 明細 cif_culture_120 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_121' and cost_model_id = 'cm_p21_fuel_260914' and price_rule is null and md5(note) = '410d376ccf653b12ae25d76199c26150') then raise exception '434: 明細 cif_culture_121 が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_122' and cost_model_id = 'cm_p21_fuel_260914' and price_rule is null and md5(note) = 'b126d47c21b04908e47391138022c306') then raise exception '434: 明細 cif_culture_122 が変わっている'; end if;
end $do$;

alter table project_cost_items drop constraint if exists project_cost_items_price_rule_check;
alter table project_cost_items add constraint project_cost_items_price_rule_check
  check (price_rule is null or price_rule in (
    'biomass', 'broth', 'module_swap', 'power_circulation', 'power_injection', 'spent_disposal',
    'co2_supply', 'culture_loss', 'medium_supply'
  ));
comment on column project_cost_items.price_rule is '単価の連動のしかた（null は unit_price をそのまま使う）。biomass / broth = 旧版の菌体量・培養液量の倍率、module_swap = モジュール一式 ÷ 耐用 ÷ 1バッチの量、power_circulation / power_injection = 動力 × 反応時間 × 電力単価 ÷ 1バッチの量、spent_disposal = 湿重量倍率 × 汚泥の処分単価、co2_supply = CO2（前提 co2_flue_gas が on なら0円、off なら unit_price）、culture_loss = 培養ロス補充（同じ群の菌体1kgあたりの原料の行の額の合計。unit_price は使わない）、medium_supply = 培地の原料（前提 waste_medium が on なら unit_price × (1 − waste_medium_reduction%)）。migration 434';

insert into project_cost_assumptions (cost_model_id, cost_assumption_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('cm_p21_260820', 'ca14_waste_medium', '菌体の製造拠点（原料・品質確認）', '工場の排液を培地に使える', null, 'off', null, 'H', '資料記載', 'AMD（内部）', true, 'waste_medium', '培養の培地を、工場の排液でまかなえるか。スイッチは培地の原料（窒素源・リン源・カリウムなど）の3行にある（まさ 2026-09-15「その結果次第では、燃料事業は、顧客の工場のCO2と排熱、排ガスをフル活用してやる方向も見えてくる」）。ON にすると、その3行の買値を「減る割合」だけ引いた額で計算する（量と試薬の買値は行に残る）。培養ロス補充は原料の合計から出すので一緒に下がる。既定は OFF（試薬を買う）。**使える排液の条件**: 光合成をさせるので、①色が付いていない（着色排水は光が通らず培養が止まる）、②菌体に毒になる金属や薬剤が入っていない（金属を含む排水を燃料用の菌体に使うと、菌体に金属が入り、それは金属回収の事業の方の話になる）、③窒素・リン・カリウムが実際に入っている（食品工場・醸造・畜産・下水の処理水など）、④年間を通して量と質が安定している、⑤培養の拠点をその工場の隣に置ける。排ガス（CO2）と同じ工場でまかなうなら、①〜⑤と排ガスの条件を同時に満たす工場を探すことになる。出どころ: ちこさんの試算シートの 2026-07-30版は、前提の欄に「培地原料低減率 80%（排液利用で大幅低減）」と書き、培地主原料の行のメモに「排液利用で大幅低減｜培養液量連動」と書いていた（培養を顧客工場で行う形）。その版の額はすべて出所「仮置き」で、80%の根拠は書かれていない。', 'amd_internal', 321, null, null);
insert into project_cost_assumptions (cost_model_id, cost_assumption_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('cm_p21_260820', 'ca14_waste_medium_reduction', '菌体の製造拠点（原料・品質確認）', '排液で減る培地の原料の割合', 80, null, '%', 'H', '資料記載', 'AMD（内部）', true, 'waste_medium_reduction', '工場の排液を培地に使えるときに、培地の原料（窒素源・リン源・カリウムなど）の買値が減る割合。確かめ方: 排液の窒素・リン・カリウムの濃さ（1Lに何mg）と、菌体1kgを作るのに要る量を比べる。菌体1kgには窒素80g・リン10g が要るので、窒素100mg/L の排液なら菌体1kgあたり800Lの排液が要る（培養液の量とつり合うか）。80%は、ちこさんの試算シート 2026-07-30版の前提「培地原料低減率 80%（排液利用で大幅低減）」の値で、根拠は書かれていない。排液で足りない分（微量金属・鉄など）は買う前提で、100%にはしていない。', 'amd_internal', 322, null, null);
update project_cost_items set price_rule = 'medium_supply', note = '量: 菌体の乾燥重量の8%が窒素（2026-09-07 の工程とマテバラ推定の設計仮定。Synechocystis の測定では11.3%）→ 窒素0.08kg ÷ 硝酸ナトリウムの窒素の割合16.5% ＝ 0.4854kg。培地に入れた窒素はすべて菌体が吸う（培養液を使い回す前提。マテバラ推定と同じ。閉鎖型の培養で吸う割合を20%と置く試算もあり（米国PNNL 2018）、その場合は5倍）。買値: 硝酸ナトリウムの財務省貿易統計の輸入単価（chematels.com の集計、2026年） 187円/kg。届け先までの運賃は含まない。確かめ方: 杉浦先生の培地の窒素源と濃さ（培養液1Lに何g）を聞き、菌体1kgあたりの量と比べる。尿素（窒素46.6%、輸入単価の2026年平均 約107円/kg）が使えるなら菌体1kgあたり約18円に下がる。リン源のりん酸二アンモニウムからも窒素が約9g入るが、ここから差し引いていない。工場の排液を培地に使えるなら、この行の「工場の排液を培地に使える」を ON にすると、買値がその割合だけ引かれる（買値の欄はそのまま残る。着色排水は光が通らないので使えない）。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。前の額（2026-09-14 に「使う量 × 買値」へ組み直す前）: 菌体1kgあたり9円で、量と買値の内訳は無かった。ちこさんの試算シート（2026-07-30版〜2026-08-20版）の「培地主原料　処理水1m³あたり10円」（出所「仮置き」）を、処理水1m³に使う乾燥菌体1.111kgで割った額。7/30版のメモは「排液利用で大幅低減｜培養液量連動」で、前提の欄に「培地原料低減率 80%（排液利用で大幅低減）」があった（培養を顧客工場で行い、工場の排液を培地に使う形）。7/16版では「培養原料・添加成分　処理水1m³あたり70円」（目標総原価300円から配分した仮置き）の中にあった。版ごとの流れは版の履歴「培養の原料の前の額は、どこから来たか」。', updated_at = now() where cost_item_id = 'ci_260820_120';
update project_cost_items set price_rule = 'medium_supply', note = '量: 菌体の乾燥重量の1%がリン（2026-09-07 の工程とマテバラ推定の設計仮定。微細藻類で0.3〜1.2%）→ リン0.01kg ÷ りん酸二アンモニウムのリンの割合23.5% ＝ 0.0426kg。入れたリンはすべて菌体が吸う（使い回す前提）。買値: りん酸二アンモニウムの財務省貿易統計の輸入単価（chematels.com の集計、2026年） 161円/kg。確かめ方: 杉浦先生の培地のリン源と濃さを聞いて比べる。BG-11（シアノバクテリアの標準の培地）のリン酸カリウムのままでは、菌体の濃さ5g/Lに足りない（約0.7g/L分）。工場の排液を培地に使えるなら、この行の「工場の排液を培地に使える」を ON にすると、買値がその割合だけ引かれる（買値の欄はそのまま残る。着色排水は光が通らないので使えない）。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。前の額（2026-09-14 に「使う量 × 買値」へ組み直す前）: 菌体1kgあたり10.8円で、量と買値の内訳は無かった。ちこさんの試算シート（2026-07-30版〜2026-08-20版）の「栄養塩　処理水1m³あたり12円」（出所「仮置き」）を、処理水1m³に使う乾燥菌体1.111kgで割った額。7/16版では「培養原料・添加成分　処理水1m³あたり70円」（目標総原価300円から配分した仮置き）の中にあった。7/30版で分けた額の決め方はシートに書かれていない。版ごとの流れは版の履歴「培養の原料の前の額は、どこから来たか」。', updated_at = now() where cost_item_id = 'ci_260820_121';
update project_cost_items set price_rule = 'medium_supply', note = '量: 菌体の乾燥重量のカリウム1.6%・マグネシウム0.3%・鉄0.1%（スピルリナの成分の総説）から、塩化カリウム0.0305kg・硫酸マグネシウム7水塩0.0304kg・キレート鉄13% 0.0077kg、微量金属の塩（ホウ酸・塩化マンガン・硫酸亜鉛など）をBG-11の鉄との割合で0.0054kg、合わせて0.074kg。買値は重さで割り戻した平均 324円/kg: 塩化カリウム 77円/kg（財務省貿易統計の輸入単価（chematels.com の集計、2026年））、硫酸マグネシウム 162円/kg（肥料・工業用25kg、通販 2026-09）、キレート鉄 1,468円/kg（25kg、通販 2026-09）、微量金属の塩 1,000円/kg（買値を調べていない仮置き）。菌体1kgあたりの額の半分近くがキレート鉄。確かめ方: 杉浦先生の培地の組成を聞き、成分ごとの量と比べる。工場の排液を培地に使えるなら、この行の「工場の排液を培地に使える」を ON にすると、買値がその割合だけ引かれる（買値の欄はそのまま残る。着色排水は光が通らないので使えない）。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。前の額（2026-09-14 に「使う量 × 買値」へ組み直す前）: 菌体1kgあたり7.2円で、量と買値の内訳は無かった。ちこさんの試算シート（2026-07-30版〜2026-08-20版）の「微量元素・添加剤　処理水1m³あたり8円」（出所「仮置き」）を、処理水1m³に使う乾燥菌体1.111kgで割った額。7/16版では「培養原料・添加成分　処理水1m³あたり70円」（目標総原価300円から配分した仮置き）の中にあった。7/30版で分けた額の決め方はシートに書かれていない。版ごとの流れは版の履歴「培養の原料の前の額は、どこから来たか」。', updated_at = now() where cost_item_id = 'ci_260820_122';
insert into project_cost_notes (cost_model_id, cost_note_id, section, title, body_md, source_url, source_label, visibility, sort_order) values ('cm_p21_260820', 'cn16_h16', 'history', '工場の排液を培地に使えるかの切り替え（2026-09-15）', 'まさ 2026-09-15「その結果次第では、燃料事業は、顧客の工場のCO2と排熱、排ガスをフル活用してやる方向も見えてくる」

培地の原料（窒素源・リン源・カリウムなど）の3行に「工場の排液を培地に使える」のスイッチを置いた。ON にすると買値が「減る割合」（既定80%）だけ引かれる。培養ロス補充も一緒に下がる。

| 組み合わせ（円/m³） | どちらも使わない | 排液を培地に使う | 排液＋排ガス |
|---|---|---|---|
| 自然株・金属回収・オンサイト・直接投入 | 528.3 | 393.2 | 234.2 |
| 自然株・色素分解・オンサイト・直接投入 | 54.2 | 42.9 | 29.5 |

排水処理では、処理する排液そのものを培地に使えるなら拠点を分けずに済む。ただし着色排水は光が通らないので培地には使えず、金属を含む排液は菌体に金属が入る（それは金属回収の事業そのものなので、燃料用の菌体とは分ける）。

**80%の出どころ**: ちこさんの試算シート 2026-07-30版の前提「培地原料低減率 80%（排液利用で大幅低減）」。その版の額はすべて出所「仮置き」で、80%の根拠は書かれていない。2026-09-14 に培養の原料を「使う量 × 買値」（試薬を買う前提）へ組み直したときに消えた前提を、切り替えとして戻したもの。

**使える排液の条件**: ①色が付いていない（着色排水は光が通らない）②菌体に毒になる金属や薬剤が入っていない ③窒素・リン・カリウムが実際に入っている（食品工場・醸造・畜産・下水の処理水など）④年間を通して量と質が安定している ⑤培養の拠点をその工場の隣に置ける。排ガスも同じ工場でまかなうなら、両方の条件を同時に満たす工場を探すことになる。

**確かめ方**: 排液の窒素・リン・カリウムの濃さ（1Lに何mg）を実測する。菌体1kgには窒素80g・リン10g が要るので、窒素100mg/L の排液なら菌体1kgあたり800Lが要る。これが培養液の量とつり合うか（足りなければ足りない分を買う）。', null, null, 'amd_internal', 160);
insert into project_cost_assumptions (cost_model_id, cost_assumption_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('cm_p21_fuel_260914', 'caf_waste_medium', '培養の原料・品質確認', '工場の排液を培地に使える', null, 'off', null, 'H', '資料記載', 'AMD（内部）', true, 'waste_medium', '培養の培地を、工場の排液でまかなえるか。スイッチは培地の原料（窒素源・リン源・カリウムなど）の3行にある（まさ 2026-09-15「その結果次第では、燃料事業は、顧客の工場のCO2と排熱、排ガスをフル活用してやる方向も見えてくる」）。ON にすると、その3行の買値を「減る割合」だけ引いた額で計算する（量と試薬の買値は行に残る）。培養ロス補充は原料の合計から出すので一緒に下がる。既定は OFF（試薬を買う）。**使える排液の条件**: 光合成をさせるので、①色が付いていない（着色排水は光が通らず培養が止まる）、②菌体に毒になる金属や薬剤が入っていない（金属を含む排水を燃料用の菌体に使うと、菌体に金属が入り、それは金属回収の事業の方の話になる）、③窒素・リン・カリウムが実際に入っている（食品工場・醸造・畜産・下水の処理水など）、④年間を通して量と質が安定している、⑤培養の拠点をその工場の隣に置ける。排ガス（CO2）と同じ工場でまかなうなら、①〜⑤と排ガスの条件を同時に満たす工場を探すことになる。出どころ: ちこさんの試算シートの 2026-07-30版は、前提の欄に「培地原料低減率 80%（排液利用で大幅低減）」と書き、培地主原料の行のメモに「排液利用で大幅低減｜培養液量連動」と書いていた（培養を顧客工場で行う形）。その版の額はすべて出所「仮置き」で、80%の根拠は書かれていない。', 'amd_internal', 312, null, null);
insert into project_cost_assumptions (cost_model_id, cost_assumption_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('cm_p21_fuel_260914', 'caf_waste_medium_reduction', '培養の原料・品質確認', '排液で減る培地の原料の割合', 80, null, '%', 'H', '資料記載', 'AMD（内部）', true, 'waste_medium_reduction', '工場の排液を培地に使えるときに、培地の原料（窒素源・リン源・カリウムなど）の買値が減る割合。確かめ方: 排液の窒素・リン・カリウムの濃さ（1Lに何mg）と、菌体1kgを作るのに要る量を比べる。菌体1kgには窒素80g・リン10g が要るので、窒素100mg/L の排液なら菌体1kgあたり800Lの排液が要る（培養液の量とつり合うか）。80%は、ちこさんの試算シート 2026-07-30版の前提「培地原料低減率 80%（排液利用で大幅低減）」の値で、根拠は書かれていない。排液で足りない分（微量金属・鉄など）は買う前提で、100%にはしていない。', 'amd_internal', 313, null, null);
update project_cost_items set price_rule = 'medium_supply', note = '量: 菌体の乾燥重量の8%が窒素（2026-09-07 の工程とマテバラ推定の設計仮定。Synechocystis の測定では11.3%）→ 窒素0.08kg ÷ 硝酸ナトリウムの窒素の割合16.5% ＝ 0.4854kg。培地に入れた窒素はすべて菌体が吸う（培養液を使い回す前提。マテバラ推定と同じ。閉鎖型の培養で吸う割合を20%と置く試算もあり（米国PNNL 2018）、その場合は5倍）。買値: 硝酸ナトリウムの財務省貿易統計の輸入単価（chematels.com の集計、2026年） 187円/kg。届け先までの運賃は含まない。確かめ方: 杉浦先生の培地の窒素源と濃さ（培養液1Lに何g）を聞き、菌体1kgあたりの量と比べる。尿素（窒素46.6%、輸入単価の2026年平均 約107円/kg）が使えるなら菌体1kgあたり約18円に下がる。リン源のりん酸二アンモニウムからも窒素が約9g入るが、ここから差し引いていない。工場の排液を培地に使えるなら、この行の「工場の排液を培地に使える」を ON にすると、買値がその割合だけ引かれる（買値の欄はそのまま残る。着色排水は光が通らないので使えない）。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。前の額（2026-09-14 に「使う量 × 買値」へ組み直す前）: 菌体1kgあたり9円で、量と買値の内訳は無かった。ちこさんの試算シート（2026-07-30版〜2026-08-20版）の「培地主原料　処理水1m³あたり10円」（出所「仮置き」）を、処理水1m³に使う乾燥菌体1.111kgで割った額。7/30版のメモは「排液利用で大幅低減｜培養液量連動」で、前提の欄に「培地原料低減率 80%（排液利用で大幅低減）」があった（培養を顧客工場で行い、工場の排液を培地に使う形）。7/16版では「培養原料・添加成分　処理水1m³あたり70円」（目標総原価300円から配分した仮置き）の中にあった。版ごとの流れは版の履歴「培養の原料の前の額は、どこから来たか」。', updated_at = now() where cost_item_id = 'cif_culture_120';
update project_cost_items set price_rule = 'medium_supply', note = '量: 菌体の乾燥重量の1%がリン（2026-09-07 の工程とマテバラ推定の設計仮定。微細藻類で0.3〜1.2%）→ リン0.01kg ÷ りん酸二アンモニウムのリンの割合23.5% ＝ 0.0426kg。入れたリンはすべて菌体が吸う（使い回す前提）。買値: りん酸二アンモニウムの財務省貿易統計の輸入単価（chematels.com の集計、2026年） 161円/kg。確かめ方: 杉浦先生の培地のリン源と濃さを聞いて比べる。BG-11（シアノバクテリアの標準の培地）のリン酸カリウムのままでは、菌体の濃さ5g/Lに足りない（約0.7g/L分）。工場の排液を培地に使えるなら、この行の「工場の排液を培地に使える」を ON にすると、買値がその割合だけ引かれる（買値の欄はそのまま残る。着色排水は光が通らないので使えない）。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。前の額（2026-09-14 に「使う量 × 買値」へ組み直す前）: 菌体1kgあたり10.8円で、量と買値の内訳は無かった。ちこさんの試算シート（2026-07-30版〜2026-08-20版）の「栄養塩　処理水1m³あたり12円」（出所「仮置き」）を、処理水1m³に使う乾燥菌体1.111kgで割った額。7/16版では「培養原料・添加成分　処理水1m³あたり70円」（目標総原価300円から配分した仮置き）の中にあった。7/30版で分けた額の決め方はシートに書かれていない。版ごとの流れは版の履歴「培養の原料の前の額は、どこから来たか」。', updated_at = now() where cost_item_id = 'cif_culture_121';
update project_cost_items set price_rule = 'medium_supply', note = '量: 菌体の乾燥重量のカリウム1.6%・マグネシウム0.3%・鉄0.1%（スピルリナの成分の総説）から、塩化カリウム0.0305kg・硫酸マグネシウム7水塩0.0304kg・キレート鉄13% 0.0077kg、微量金属の塩（ホウ酸・塩化マンガン・硫酸亜鉛など）をBG-11の鉄との割合で0.0054kg、合わせて0.074kg。買値は重さで割り戻した平均 324円/kg: 塩化カリウム 77円/kg（財務省貿易統計の輸入単価（chematels.com の集計、2026年））、硫酸マグネシウム 162円/kg（肥料・工業用25kg、通販 2026-09）、キレート鉄 1,468円/kg（25kg、通販 2026-09）、微量金属の塩 1,000円/kg（買値を調べていない仮置き）。菌体1kgあたりの額の半分近くがキレート鉄。確かめ方: 杉浦先生の培地の組成を聞き、成分ごとの量と比べる。工場の排液を培地に使えるなら、この行の「工場の排液を培地に使える」を ON にすると、買値がその割合だけ引かれる（買値の欄はそのまま残る。着色排水は光が通らないので使えない）。排水処理のコスト試算の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。前の額（2026-09-14 に「使う量 × 買値」へ組み直す前）: 菌体1kgあたり7.2円で、量と買値の内訳は無かった。ちこさんの試算シート（2026-07-30版〜2026-08-20版）の「微量元素・添加剤　処理水1m³あたり8円」（出所「仮置き」）を、処理水1m³に使う乾燥菌体1.111kgで割った額。7/16版では「培養原料・添加成分　処理水1m³あたり70円」（目標総原価300円から配分した仮置き）の中にあった。7/30版で分けた額の決め方はシートに書かれていない。版ごとの流れは版の履歴「培養の原料の前の額は、どこから来たか」。', updated_at = now() where cost_item_id = 'cif_culture_122';
insert into project_cost_notes (cost_model_id, cost_note_id, section, title, body_md, source_url, source_label, visibility, sort_order) values ('cm_p21_fuel_260914', 'cnf_history_waste_medium', 'history', '工場の排液を培地に使えるかの切り替え（2026-09-15）', 'まさ 2026-09-15「その結果次第では、燃料事業は、顧客の工場のCO2と排熱、排ガスをフル活用してやる方向も見えてくる」

培地の原料（窒素源・リン源・カリウムなど）の3行に「工場の排液を培地に使える」のスイッチを置いた。ON にすると買値が「減る割合」（既定80%）だけ引かれる。培養ロス補充も一緒に下がる。

| 組み合わせ | どちらも使わない | 排液を培地に使う | 排液＋排ガス |
|---|---|---|---|
| 分泌株を使わない・基準・委託 | 6,033.4 | 4,190.1 | 2,020.6 |
| 脂質分泌株・基準・委託 | 1,289.7 | 1,247.6 | 1,019.2 |

**まさの「顧客の工場のCO2と排熱、排ガスをフル活用」**: 排液と排ガスを両方使えると、分泌株を使わない形で 6,033.4 → 2,020.6 円/L、脂質分泌株と組み合わせると 1,289.7 → 1,019.2 円/L。それでも売価200円/Lには届かない（残るのは培養設備そのもの）。

**排熱はまだ数字にできない**: この試算には培養の加温の費用がそもそも入っていない（培養の電力・加温・排水は未計上）。排熱の価値を出すには、先に加温の費用を入れる必要がある。

**80%の出どころ**: ちこさんの試算シート 2026-07-30版の前提「培地原料低減率 80%（排液利用で大幅低減）」。その版の額はすべて出所「仮置き」で、80%の根拠は書かれていない。2026-09-14 に培養の原料を「使う量 × 買値」（試薬を買う前提）へ組み直したときに消えた前提を、切り替えとして戻したもの。

**使える排液の条件**: ①色が付いていない（着色排水は光が通らない）②菌体に毒になる金属や薬剤が入っていない ③窒素・リン・カリウムが実際に入っている（食品工場・醸造・畜産・下水の処理水など）④年間を通して量と質が安定している ⑤培養の拠点をその工場の隣に置ける。排ガスも同じ工場でまかなうなら、両方の条件を同時に満たす工場を探すことになる。

**確かめ方**: 排液の窒素・リン・カリウムの濃さ（1Lに何mg）を実測する。菌体1kgには窒素80g・リン10g が要るので、窒素100mg/L の排液なら菌体1kgあたり800Lが要る。これが培養液の量とつり合うか（足りなければ足りない分を買う）。', null, null, 'amd_internal', 23);
commit;
