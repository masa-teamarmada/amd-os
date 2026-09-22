-- 449: SOL（p21）両方のコスト試算の培養に、LED の照明（電力と器具）を推定で入れる
-- （まさ 2026-09-22「光はLEDで当ててるよ。どのくらいの光量を当てたらいいのかは先生も知らない。なので推定して入れてほしい」）
--
--   - 照明の電力（LED） 108.9 kWh/kg-DCW × 17.45 円/kWh（菌体1kgを作るのに要る光子の数から: 収率 1.0 g/mol・吸われる割合 0.85・LED 3.0 μmol/J）
--   - LED照明器具 15.1 W/(kg-DCW/年) × 315 円/W ÷ 7年。作る量に比例する設備（CAPEX・毎kg菌体比例）で持ち、系列の大きさでは薄まらない
--   - 燃料の脂質分泌株は、脂肪酸をつくる光を別の行に持つ（163.4 kWh・22.6 W、菌体の1.5倍）
--   - 版の履歴を1件ずつ足す
-- 生成: apply449.py（scratchpad）。fixture 2つを同じ定義から書き出した。
begin;
select set_config('amd.cost_change_reason', '449: 培養に LED の照明（電力と器具）を推定で入れる（まさ 2026-09-22）', true);
do $do$ begin
  if exists (select 1 from project_cost_items where cost_item_id in ('ci2_c_led_power', 'ci2_c_led_capex', 'cif_culture_led_power', 'cif_culture_led_capex', 'cif_sec_led_power', 'cif_sec_led_capex')) then raise exception '449: LED の行がもうある'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id in ('cn21_h21', 'cnf_history_led')) then raise exception '449: 版の履歴がもうある'; end if;
  if exists (select 1 from project_cost_items where cost_model_id in ('cm_p21_260820','cm_p21_fuel_260914') and (leaf_label like '%照明%' or leaf_label like '%LED%')) then raise exception '449: 照明の行がほかにある'; end if;
end $do$;

-- コスト試算（廃液）
insert into project_cost_items (cost_item_id, cost_model_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application, bearer) values ('ci2_c_led_power', 'cm_p21_260820', '中央培養', 'OPEX', '培養', 'ユーティリティ', '照明の電力（LED）', '毎kg菌体比例', 108.9, 'kWh/kg-DCW', 17.45, '円/kWh', null, 1.0, null, false, 'H', '推定', 'AMD（内部）', '推定値。**2026-09-22 に新しく入れた**（まさ 2026-09-22「光はLEDで当ててるよ。どのくらいの光量を当てたらいいのかは先生も知らない。なので推定して入れてほしい」）。LED の電気代は、光の強さの選び方より、**菌体1kgを作るのに光合成に使える光の粒（光子）が何モル要るか**で決まる。出し方: 1,000 g ÷ 光に対する菌体の収率 1.0 g/mol ÷ 培養液に吸われる割合 0.85 ÷ LED の光合成光量子効率 3.0 μmol/J ＝ 392,156,863 J ＝ 108.9 kWh/kg-DCW。**収率 1.0 g/mol**: シアノバクテリア Synechocystis の実測 1.0〜1.72 g/mol（赤色の光・中程度の強さ。PLOS ONE の藍藻と緑藻の比較研究）、連続培養のエネルギー収支で 1.24 g/mol（Touloupakis ら）、緑藻 Chlorella・Dunaliella の平板型の培養槽で 0.6〜0.8 g/mol（Zijffers ら 2010）。窒素源が硝酸のときの理論上の上限は 1.5 g/mol（同じ Zijffers ら 2010。光子8個で CO2 1分子という単純な値 約3 g/mol は、窒素を還元する分の光を数えていない）。SX の株（好熱性）の実測は無いので、上限の3分の2で置いた。**吸われる割合 0.85**: 文献値は見つからず、培養槽の設計で光を吸い切る前提の見当（0.7〜0.95）。**光合成光量子効率 3.0 μmol/J**: 園芸用 LED の業界基準（DLC 園芸照明 V4.0、2025年）の下限が 2.5、いまの上位の製品が 3.0〜3.3。**確かめ方**: 人工光で藻を育てる技術経済評価（Blanken ら 2013、Algal Research「Cultivation of microalgae on artificial light comes at a cost」）は、電気が菌体の化学エネルギーになる割合を4〜6%としていて、逆算すると菌体1kgあたり 92〜168 kWh。この行はその範囲に入る。同じ論文は、人工光は高く売れる製品でなければ割に合わないとしている。**幅**: 収率 0.6〜1.5 g/mol・効率 2.5〜3.5 μmol/J で、菌体1kgあたり 60〜230 kWh くらい動く。**加温との関係**: LED に入れた電気はほぼすべて熱になる（菌体1kgあたり約392 MJ）。加温の熱の見積（200 MJ/kg-DCW、屋外で日射を受ける前提）を上回るので、LED の熱を培養液に回せる室内の設計なら、加温の熱の行はほぼ0円になり、逆に冷やす費用が要ることもある。いまは両方を数えている（その分だけ多めに出ている）。**光の強さの目安**: 1系列（1日111kg）が要る光は毎秒約1.5 mol（排液で増える速さの倍率が1のとき）。光の強さを 300 μmol/m²/s にすると、照らす面は約5,000 m²。シアノバクテリアの培養では、実験室で 50〜200、好熱性の株の実証に近い平板型で 500〜2,000 μmol/m²/s が使われている。培養の電力（撹拌・送液・散気）の行とは別。買値は高圧受電の 17.45 円/kWh（燃料化設備の電力と同じ）。', 'amd_internal', 824, null, null, 'sx');
insert into project_cost_items (cost_item_id, cost_model_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application, bearer) values ('ci2_c_led_capex', 'cm_p21_260820', '中央培養', 'CAPEX', '培養設備', '照明設備', 'LED照明器具（作る量に比例）', '毎kg菌体比例', 15.1, 'W/(kg-DCW/年)', 315, '円/W', null, 1.0, 7, false, 'H', '推定', 'AMD（内部）', '推定値。**2026-09-22 に新しく入れた**（まさ 2026-09-22「光はLEDで当ててるよ。どのくらいの光量を当てたらいいのかは先生も知らない。なので推定して入れてほしい」）。作る菌体が増えるとその分だけ器具が要るので、系列ではなく**菌体1kgあたりの量**で持つ（系列の大きさや、排液で増える速さの倍率では薄まらない。速く増やすにはその分の光が要る）。数量は、年に1kg作るのに置く LED の電力 ＝ 108.9 kWh ÷ 1年に点ける時間 7,200時間（300日 × 24時間、ずっと点ける前提）＝ 15.1 W。単価は、業務用の園芸用 LED の価格 1 μmol/s あたり 0.4〜1.0 ドル（Fluence の SPYDR など、2025年）の真ん中 0.7 ドル、1ドル150円、3.0 μmol/J で 315円/W。耐用年数は、寿命 50,000時間（L90。業務用で 50,000〜90,000時間）÷ 7,200時間 ＝ 約7年。初期投資は 15.1 W × 315円 ＝ 菌体を年に1kg作るごとに約4,756円。1日のうち点ける時間を短くすると、同じ光を短い時間で当てるので器具は増える（16時間なら1.5倍、電気代は同じ）。大量に買ったときの値引きは入れていない。確かめ方: 同じ規模の植物工場・藻の培養施設の照明の見積（器具1台の値段と、1台が出す光 μmol/s）を取り、1 μmol/s あたりの値段で比べる。', 'amd_internal', 736, null, null, 'sx');

-- コスト試算（燃料）
insert into project_cost_items (cost_item_id, cost_model_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application, bearer) values ('cif_culture_led_power', 'cm_p21_fuel_260914', '中央培養', 'OPEX', '培養', 'ユーティリティ', '照明の電力（LED）', '毎kg菌体比例', 108.9, 'kWh/kg-DCW', 17.45, '円/kWh', null, 1.0, null, false, 'H', '推定', 'AMD（内部）', '推定値。**2026-09-22 に新しく入れた**（まさ 2026-09-22「光はLEDで当ててるよ。どのくらいの光量を当てたらいいのかは先生も知らない。なので推定して入れてほしい」）。LED の電気代は、光の強さの選び方より、**菌体1kgを作るのに光合成に使える光の粒（光子）が何モル要るか**で決まる。出し方: 1,000 g ÷ 光に対する菌体の収率 1.0 g/mol ÷ 培養液に吸われる割合 0.85 ÷ LED の光合成光量子効率 3.0 μmol/J ＝ 392,156,863 J ＝ 108.9 kWh/kg-DCW。**収率 1.0 g/mol**: シアノバクテリア Synechocystis の実測 1.0〜1.72 g/mol（赤色の光・中程度の強さ。PLOS ONE の藍藻と緑藻の比較研究）、連続培養のエネルギー収支で 1.24 g/mol（Touloupakis ら）、緑藻 Chlorella・Dunaliella の平板型の培養槽で 0.6〜0.8 g/mol（Zijffers ら 2010）。窒素源が硝酸のときの理論上の上限は 1.5 g/mol（同じ Zijffers ら 2010。光子8個で CO2 1分子という単純な値 約3 g/mol は、窒素を還元する分の光を数えていない）。SX の株（好熱性）の実測は無いので、上限の3分の2で置いた。**吸われる割合 0.85**: 文献値は見つからず、培養槽の設計で光を吸い切る前提の見当（0.7〜0.95）。**光合成光量子効率 3.0 μmol/J**: 園芸用 LED の業界基準（DLC 園芸照明 V4.0、2025年）の下限が 2.5、いまの上位の製品が 3.0〜3.3。**確かめ方**: 人工光で藻を育てる技術経済評価（Blanken ら 2013、Algal Research「Cultivation of microalgae on artificial light comes at a cost」）は、電気が菌体の化学エネルギーになる割合を4〜6%としていて、逆算すると菌体1kgあたり 92〜168 kWh。この行はその範囲に入る。同じ論文は、人工光は高く売れる製品でなければ割に合わないとしている。**幅**: 収率 0.6〜1.5 g/mol・効率 2.5〜3.5 μmol/J で、菌体1kgあたり 60〜230 kWh くらい動く。**加温との関係**: LED に入れた電気はほぼすべて熱になる（菌体1kgあたり約392 MJ）。加温の熱の見積（200 MJ/kg-DCW、屋外で日射を受ける前提）を上回るので、LED の熱を培養液に回せる室内の設計なら、加温の熱の行はほぼ0円になり、逆に冷やす費用が要ることもある。いまは両方を数えている（その分だけ多めに出ている）。**光の強さの目安**: 1系列（1日111kg）が要る光は毎秒約1.5 mol（排液で増える速さの倍率が1のとき）。光の強さを 300 μmol/m²/s にすると、照らす面は約5,000 m²。シアノバクテリアの培養では、実験室で 50〜200、好熱性の株の実証に近い平板型で 500〜2,000 μmol/m²/s が使われている。培養の電力（撹拌・送液・散気）の行とは別。買値は高圧受電の 17.45 円/kWh（燃料化設備の電力と同じ）。', 'amd_internal', 1041, null, null, 'sx');
insert into project_cost_items (cost_item_id, cost_model_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application, bearer) values ('cif_culture_led_capex', 'cm_p21_fuel_260914', '中央培養', 'CAPEX', '培養設備', '照明設備', 'LED照明器具（作る量に比例）', '毎kg菌体比例', 15.1, 'W/(kg-DCW/年)', 315, '円/W', null, 1.0, 7, false, 'H', '推定', 'AMD（内部）', '推定値。**2026-09-22 に新しく入れた**（まさ 2026-09-22「光はLEDで当ててるよ。どのくらいの光量を当てたらいいのかは先生も知らない。なので推定して入れてほしい」）。作る菌体が増えるとその分だけ器具が要るので、系列ではなく**菌体1kgあたりの量**で持つ（系列の大きさや、排液で増える速さの倍率では薄まらない。速く増やすにはその分の光が要る）。数量は、年に1kg作るのに置く LED の電力 ＝ 108.9 kWh ÷ 1年に点ける時間 7,200時間（300日 × 24時間、ずっと点ける前提）＝ 15.1 W。単価は、業務用の園芸用 LED の価格 1 μmol/s あたり 0.4〜1.0 ドル（Fluence の SPYDR など、2025年）の真ん中 0.7 ドル、1ドル150円、3.0 μmol/J で 315円/W。耐用年数は、寿命 50,000時間（L90。業務用で 50,000〜90,000時間）÷ 7,200時間 ＝ 約7年。初期投資は 15.1 W × 315円 ＝ 菌体を年に1kg作るごとに約4,756円。1日のうち点ける時間を短くすると、同じ光を短い時間で当てるので器具は増える（16時間なら1.5倍、電気代は同じ）。大量に買ったときの値引きは入れていない。確かめ方: 同じ規模の植物工場・藻の培養施設の照明の見積（器具1台の値段と、1台が出す光 μmol/s）を取り、1 μmol/s あたりの値段で比べる。', 'amd_internal', 1042, null, null, 'sx');
insert into project_cost_items (cost_item_id, cost_model_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application, bearer) values ('cif_sec_led_power', 'cm_p21_fuel_260914', '中央培養', 'OPEX', '脂肪酸の分泌', 'ユーティリティ', '照明の電力（脂肪酸をつくる光・LED）', '毎kg菌体比例', 163.4, 'kWh/kg-脂肪酸', 17.45, '円/kWh', null, 1.0, null, false, 'H', '推定', 'AMD（内部）', '推定値。**2026-09-22 に新しく入れた**。脂質分泌株のときだけ効く。脂肪酸は菌体より還元された（エネルギーの多い）物質なので、1kgあたりに要る光は菌体の約1.5倍（電子の数で比べた値。硝酸を窒素源にした菌体 約236 mol/kg に対し、パルミチン酸 約359 mol/kg）。菌体1kgあたりの 108.9 kWh × 1.5 ＝ 163.4 kWh/kg-脂肪酸。入れ替える菌体を作る光は、菌体の行（照明の電力（LED））に「脂肪酸1kgあたりに入れ替える菌体」を掛けて別に数える。出し方と文献は菌体の行と同じ。確かめ方: 脂質分泌株の培養で、脂肪酸の出る量と、吸われた光の量（培養液の前後で測る）の比を取る。', 'amd_internal', 1043, 'secreting', null, 'sx');
insert into project_cost_items (cost_item_id, cost_model_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application, bearer) values ('cif_sec_led_capex', 'cm_p21_fuel_260914', '中央培養', 'CAPEX', '培養設備', '照明設備', 'LED照明器具（脂肪酸をつくる光・作る量に比例）', '毎kg菌体比例', 22.6, 'W/(kg-脂肪酸/年)', 315, '円/W', null, 1.0, 7, false, 'H', '推定', 'AMD（内部）', '推定値。**2026-09-22 に新しく入れた**。脂質分泌株のときだけ効く。脂肪酸1kgに要る光は菌体の約1.5倍なので、器具も 15.1 W × 1.5 ＝ 22.6 W/(kg-脂肪酸/年)。単価 315円/W・耐用 7年は菌体の行（LED照明器具）と同じ。確かめ方: 菌体の行と同じく、照明の見積を 1 μmol/s あたりの値段で比べる。脂肪酸をつくる光の量は、電力の行の確かめ方で出す。', 'amd_internal', 1044, 'secreting', null, 'sx');

-- 版の履歴
insert into project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, visibility, sort_order) values
  ('cn21_h21', 'cm_p21_260820', 'history', '培養に LED の照明（電力と器具）を推定で入れた（2026-09-22）', 'まさ 2026-09-22「光はLEDで当ててるよ。どのくらいの光量を当てたらいいのかは先生も知らない。なので推定して入れてほしい」。

培養の照明はこれまで1円も入っていなかった。菌体の製造拠点に2行を足した。

- **照明の電力（LED）108.9 kWh/kg-DCW × 17.45円/kWh ＝ 1,900円/kg-DCW**。光の強さの選び方より、菌体1kgを作るのに要る光子の数で決まる: 1,000 g ÷ 光に対する菌体の収率 1.0 g/mol ÷ 培養液に吸われる割合 0.85 ÷ LED の光合成光量子効率 3.0 μmol/J。人工光の技術経済評価（Blanken ら 2013）からの逆算 92〜168 kWh/kg の範囲に入る
- **LED照明器具 15.1 W/(kg-DCW/年) × 315円/W ÷ 7年 ＝ 680円/kg-DCW**。作る量に比例する設備として持つ（系列の大きさや、排液で増える速さの倍率では薄まらない）。初期投資にも入る
- 培養ロス補充も原料の合計から出すので、LED の電力の分だけ一緒に上がる（作り直す培養にも光が要る）

| 円/m³（自然株・オンサイト・槽は既設） | 切り替えすべて OFF（前 → 後） | 工場から3つを使う（前 → 後） |
|---|---|---|
| 菌体1kgの原価 | 846.1 → **3,521.0** | 107.3 → **2,782.1** |
| 色素分解・直接投入 | 135.0 → **504.6** | 32.9 → **402.5** |
| 色素分解・循環カートリッジ | 137.9 → **507.5** | 35.8 → **405.4** |
| 金属回収・直接投入 | 913.2 → **3,460.6** | 209.5 → **2,757.0** |
| 金属回収・循環カートリッジ | 916.0 → **3,463.5** | 212.4 → **2,759.8** |

- **照明が菌体の原価のいちばん大きい項目になった**。色素分解は、工場から3つを使えば売価500円/m³の内（402.5円）に収まる。金属回収は工場から3つを使っても売価の5倍以上
- 菌体の製造拠点の初期投資（色素分解、年に約2,855t）は 747,803,129円 → 14,328,902,842円。金属回収（年に約22,612t）は 5,922,117,078円 → 113,475,642,078円。ほとんどが LED の器具
- **加温との重なり**: LED に入れた電気はほぼすべて熱になる（菌体1kgあたり約392 MJ）。加温の熱の見積（200 MJ/kg-DCW、屋外で日射を受ける前提）を上回るので、LED の熱を培養液に回せる室内の設計なら、加温の熱の行はほぼ0円になり、逆に冷やす費用が要ることもある。いまは両方を数えている（切り替えすべて OFF のときは、その分だけ多めに出ている。排熱を使うときは加温が0円なので重ならない）
- 収率・吸われる割合・効率・器具の価格はどれも推定。SX の株（好熱性）の光に対する収率の実測は無い', 'amd_internal', 210),
  ('cnf_history_led', 'cm_p21_fuel_260914', 'history', '培養に LED の照明（電力と器具）を推定で入れた（2026-09-22）', 'まさ 2026-09-22「光はLEDで当ててるよ。どのくらいの光量を当てたらいいのかは先生も知らない。なので推定して入れてほしい」。

培養の照明はこれまで1円も入っていなかった。排水処理のコスト試算と同じ2行（照明の電力 108.9 kWh/kg-DCW × 17.45円、LED照明器具 15.1 W/(kg-DCW/年) × 315円/W ÷ 7年）を足し、脂質分泌株のときは脂肪酸をつくる光の2行（163.4 kWh/kg-脂肪酸、22.6 W/(kg-脂肪酸/年)。脂肪酸は菌体より還元された物質なので、1kgあたりに要る光は約1.5倍）を足した。

| 円/L（基準・委託） | 切り替えすべて OFF（前 → 後） | 工場から3つを使う（前 → 後） |
|---|---|---|
| 菌体から油を取る | 7,785.8 → **31,920.0** | 1,163.0 → **25,297.2** |
| 脂質分泌株 | 1,598.3 → **6,677.7** | 1,129.1 → **6,208.5** |

- **燃料1Lをつくるのに使う電気は、菌体から取る形で 982.6 kWh、脂質分泌株で 212.9 kWh**。燃料1Lが持つエネルギー（約9.2 kWh）の **107倍・23倍**。年5,000万Lでは 49.1 TWh・10.6 TWh になる
- 初期投資は、菌体から取る形で 131,687,583,352円 → 2,277,516,072,100円、脂質分泌株で 283,057,894,749円 → 747,034,330,684円。ほとんどが LED の器具
- LED の照明だけで売価200円/Lを大きく上回るので、人工光で燃料を作る形は、コストの前にエネルギーの面で成り立たない。燃料を続けるなら太陽光で育てる形（受光面積 約120 km²）を別に置いて比べる
- 加温との重なりは排水処理の試算と同じ（LED の熱が菌体1kgあたり約392 MJ で、加温の見積 200 MJ を上回る）', 'amd_internal', 27);

do $do$ begin
  if (select count(*) from project_cost_items where cost_item_id in ('ci2_c_led_power', 'ci2_c_led_capex', 'cif_culture_led_power', 'cif_culture_led_capex', 'cif_sec_led_power', 'cif_sec_led_capex')) <> 6 then raise exception '449: LED の行が入っていない'; end if;
  if (select count(*) from project_cost_notes where cost_note_id in ('cn21_h21', 'cnf_history_led')) <> 2 then raise exception '449: 版の履歴が入っていない'; end if;
end $do$;
commit;
