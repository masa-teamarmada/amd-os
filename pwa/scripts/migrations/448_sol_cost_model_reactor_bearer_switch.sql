-- 448: SOL（p21）リアクター（処理設備）を誰が持つかの切り替えを1つ置き、顧客が持つリアクターの額を別に出す
-- （まさ 2026-09-17「別で出しておいて。ただし、そこの項目すべてについて「顧客負担」をオンにしておいて。
--   リアクター全体で１つのスイッチでオンオフ切り替えができれば十分」「これを計算しておきたいのは、廃液回収事業も検討してるから」）
--
--   - 明細の持ち主 bearer と作業の担当 performer に 'reactor' を足す（リアクターの持ち主）
--   - 循環カートリッジ・直接投入の「場所による」の明細82行と、処理の運転2件を 'reactor' にする
--   - 前提 reactor_customer_borne「リアクターは顧客負担」（既定 on）を足す
--     on: 顧客が持つ（SX の原価に入れず、結果の欄に別に出す）／ off: SX が持つ（SX の原価に入る）
--     オフサイト（SX工場）のリアクターは、この前提によらず SX が持つ
--   - あわせて「工場の排液を培地に使える」の説明を、培養の拠点の話でリアクターとは関係ないと分かる文にする
--     （まさ 2026-09-17「排液排ガス排熱の３つのスイッチは、培養にしか関係しない」）
--   - 排ガスの説明に、排液に溶けた窒素酸化物・硫黄酸化物は排液の側で数えると書き足す
--   - 技術台帳のオカベ排液4件を、確かめられた事実（炭素源は CO2 のみ・栄養は排液の窒素と硫黄）に書き直し、
--     要確認の理由を 436 の前の「処理前後のCOD値を測る」に戻す
-- 生成: apply448.py（scratchpad の apply447.py を 448 へ改名）（scratchpad）。fixture 2つを同じ定義から書き出した。
begin;
select set_config('amd.cost_change_reason', '448: リアクターを誰が持つかの切り替えを足し、顧客が持つリアクターの額を別に出す（まさ 2026-09-17）', true);
do $do$ begin
  if (select count(*) from project_cost_items where cost_model_id = 'cm_p21_260820' and scenario in ('循環','投入') and bearer = 'site') <> 82 then raise exception '448: リアクターの明細が82行ではない'; end if;
  if (select count(*) from project_cost_tasks where cost_model_id = 'cm_p21_260820' and scenario in ('循環','投入') and performer = 'site') <> 2 then raise exception '448: 処理の運転が2件ではない'; end if;
  if exists (select 1 from project_cost_assumptions where cost_assumption_id = 'ca20_reactor_customer_borne') then raise exception '448: リアクターの前提がもうある'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id = 'cn20_h20') then raise exception '448: 版の履歴がもうある'; end if;
  if (select count(*) from project_cost_assumptions where cost_assumption_id in ('ca14_waste_medium','caf_waste_medium') and md5(note) = '66c8f5d16600b89aef996a8f6da5677d') <> 2 then raise exception '448: 排液の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_assumptions where cost_assumption_id = 'ca13_co2_flue_gas' and md5(note) = 'c4b8116b6b796ba655807a504d9a41e1') then raise exception '448: 前提 ca13_co2_flue_gas の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_assumptions where cost_assumption_id = 'caf_co2_flue_gas' and md5(note) = '4c7df53bd4a06c9c0cf4990fb1a70538') then raise exception '448: 前提 caf_co2_flue_gas の説明が変わっている'; end if;
  if (select count(*) from project_cost_items where cost_item_id in ('ci_260820_120', 'ci_260820_121', 'ci_260820_122', 'cif_culture_120', 'cif_culture_121', 'cif_culture_122') and position('（買値の欄はそのまま残る。使えるかは色ではなく排液の窒素の濃さで決まる。スイッチの説明を見る）' in note) > 0) <> 6 then raise exception '448: 培地の原料の行の一文が変わっている'; end if;
  if not exists (select 1 from project_tech_entries where tech_entry_id = 'pte_sx_d14' and md5(note) = '4a89f7deca1beb5e43e9b7d58c88b9c0') then raise exception '448: 台帳 pte_sx_d14 の注記が変わっている'; end if;
  if not exists (select 1 from project_tech_entries where tech_entry_id = 'pte_sx_ef01' and md5(note) = '160bbbbffaeeae52958760fd2e8b4aba') then raise exception '448: 台帳 pte_sx_ef01 の注記が変わっている'; end if;
  if not exists (select 1 from project_tech_entries where tech_entry_id = 'pte_sx_l02' and md5(note) = '1902b0fb00077eece47d238bbf143f5e') then raise exception '448: 台帳 pte_sx_l02 の注記が変わっている'; end if;
  if not exists (select 1 from project_tech_entries where tech_entry_id = 'pte_sx_ss13' and md5(note) = '8f758cd4c8ad5181dcaeb91d01fbdc4a') then raise exception '448: 台帳 pte_sx_ss13 の注記が変わっている'; end if;
end $do$;

-- 明細の持ち主・作業の担当に「リアクター」を足す
alter table project_cost_items drop constraint if exists project_cost_items_bearer_check;
alter table project_cost_items add constraint project_cost_items_bearer_check check (bearer in ('sx', 'customer', 'site', 'reactor'));
alter table project_cost_tasks drop constraint if exists project_cost_tasks_performer_check;
alter table project_cost_tasks add constraint project_cost_tasks_performer_check check (performer in ('sx', 'customer', 'site', 'reactor'));

-- 循環カートリッジ・直接投入の「場所による」の明細と、処理の運転をリアクターにする
update project_cost_items set bearer = 'reactor' where cost_model_id = 'cm_p21_260820' and scenario in ('循環','投入') and bearer = 'site';
update project_cost_tasks set performer = 'reactor' where cost_model_id = 'cm_p21_260820' and scenario in ('循環','投入') and performer = 'site';

-- 前提「リアクターは顧客負担」（既定 on）
insert into project_cost_assumptions (cost_assumption_id, cost_model_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('ca20_reactor_customer_borne', 'cm_p21_260820', 'リアクター（処理設備）', 'リアクターは顧客負担', null, 'on', null, 'S', null, 'AMD（内部）', false, 'reactor_customer_borne', '顧客工場（オンサイト）のリアクターを、顧客が持つか SX が持つか。on（既定）は顧客が持ち、SX の原価に入れず、結果の欄に「顧客が持つリアクター」として別に出す。off は SX が持ち、SX の原価に入る（まさ 2026-09-17「別で出しておいて。ただし、そこの項目すべてについて「顧客負担」をオンにしておいて。リアクター全体で１つのスイッチでオンオフ切り替えができれば十分」「これを計算しておきたいのは、廃液回収事業も検討してるから」）。効くのは持ち主の区分が「リアクター」の明細と作業: 循環カートリッジ・直接投入の処理設備（CAPEX）、その消耗品・洗浄・監視・点検・交換部品・電力（OPEX）、処理の運転（作業。SX と同じ作業単価で数える）。顧客工場のリアクターは顧客が買う前提（2026-09-14 まさ「リアクターは顧客が買う前提だよ」）なので既定は on。SX工場（オフサイト）のリアクターは、この前提によらず SX が持つので、切り替えても数字は動かない。汚泥の処分・処理水の分析・閉鎖系の区画など、リアクター以外で顧客が持つ行は、この切り替えに入らない。顧客が持つリアクターの額に入れる運転の手間は、SX の作業単価で数えた見積で、顧客の実際の人件費とは違う。', 'amd_internal', 225, null, null);

-- 排液のスイッチ: 「使える排液の条件」の一節を、培養の拠点の話だと分かる文にする
update project_cost_assumptions set note =
  substring(note from 1 for position('**使える排液の条件**' in note) - 1) || '**これは培養の拠点の話で、リアクター（処理）とは関係ない**（まさ 2026-09-17「排液排ガス排熱の３つのスイッチは、培養にしか関係しない。この３つを使って培養すれば培養コストが大幅に下がる」）。処理の側は、排液を分解するためにリアクターへ入れるだけで、培地は使わず、光も要らない（菌体は直前まで光の下にいるので、リアクターの中でしばらく暗くてもエネルギーは足りる。先生の資料 SX_事業概要 v1.0 も「2段階目の廃液処理の際は水のみ必要」）。**使える排液の条件**: ①窒素・リン・硫黄などの栄養が入っている（食品工場・醸造・畜産・下水の処理水、窒素酸化物・硫黄酸化物を含む排液など。杉浦先生 2026-09-15 の BNV 定例「排液の窒素酸化物・硫黄酸化物を栄養にしている」）、②光合成を止める農薬・薬剤や、菌体に毒になる濃さの金属が入っていない（金属を含む排液を燃料用の菌体に使うと、菌体に金属が入り、それは金属回収の事業の方の話になる）、③年間を通して量と質が安定している、④培養の拠点をその工場の隣に置ける。量の見当: 菌体1kgに窒素80gが要るので、排液の窒素が1,200mg/Lなら菌体1kgあたり約67L、400mg/Lなら約200Lの排液にあたる。排ガス（CO2）・排熱と同じ工場でまかなうなら、その条件も同時に満たす工場を探す。排液・排ガス・排熱の3つを出す工場自体は多い（ボイラーを持って製造していれば出る）。**まだ入っていない**: 排液を運ぶ・ためる設備と、業種ごとの栄養の濃さの実測値。' || substring(note from position('出どころ: ちこさんの試算シート' in note))
 where cost_assumption_id in ('ca14_waste_medium','caf_waste_medium') and md5(note) = '66c8f5d16600b89aef996a8f6da5677d';

-- 排ガスのスイッチ: 出どころの書き方を短くし、排液に溶けた窒素酸化物・硫黄酸化物の扱いを書き足す
update project_cost_assumptions set note = replace(note, '（2026-09-15 に足した。まさ 2026-09-15「NOxが栄養源になった、という話は過去に出てきてたように記憶してる。糖は元々餌にはならないって杉浦先生は断言してたよ」）', '（2026-09-15）') || ' 排液に溶けた窒素酸化物・硫黄酸化物は、排液の栄養としてスイッチ「工場の排液を培地に使える」の側で数える（杉浦先生 2026-09-15 の BNV 定例「排液の窒素酸化物・硫黄酸化物を栄養にしている」）。ここは気体の話。'
 where cost_assumption_id in ('ca13_co2_flue_gas', 'caf_co2_flue_gas');

-- 培地の原料6行: 行の中の一文
update project_cost_items set note = replace(note, '（買値の欄はそのまま残る。使えるかは色ではなく排液の窒素の濃さで決まる。スイッチの説明を見る）', '（買値の欄はそのまま残る。培養の拠点の話で、リアクターとは関係ない）')
 where cost_item_id in ('ci_260820_120', 'ci_260820_121', 'ci_260820_122', 'cif_culture_120', 'cif_culture_121', 'cif_culture_122');

-- 技術台帳: オカベ排液4件を、確かめられた事実に書き直す
update project_tech_entries set
  note = substring(note from 1 for position(' **2026-09-15 訂正**' in note) - 1) || ' 炭素源は CO2 のみ（先生の資料 SX_事業概要 v1.0（2026-03-31）の「栄養要求性（C源）: 本技術 CO2のみ」。ユーグレナなど「糖など + CO2」との違いとして挙げている）。増えた分の栄養は排液の窒素・リン・硫黄などで、研究側は 2026-09-02 の定例で「硝酸・亜硝酸を短時間で取り込む」、2026-09-15 の BNV 定例で「排液の窒素酸化物・硫黄酸化物を栄養にしている」と説明している。処理（リアクター）では、この増え方を当てにしない（まさ 2026-09-17「排液が培地代わりになってさらにシアノが増えることはあるけど、それを期待した装置を組むわけではない」）。',
  needs_check = true, check_reason = '処理前後のCOD値を測り、どの成分が減ったかを確認する', updated_by = 'amie', updated_at = now()
 where tech_entry_id = 'pte_sx_d14';
update project_tech_entries set
  note = substring(note from 1 for position(' **2026-09-15 訂正**' in note) - 1) || ' 炭素源は CO2 のみ（先生の資料 SX_事業概要 v1.0（2026-03-31）の「栄養要求性（C源）: 本技術 CO2のみ」。ユーグレナなど「糖など + CO2」との違いとして挙げている）。増えた分の栄養は排液の窒素・リン・硫黄などで、研究側は 2026-09-02 の定例で「硝酸・亜硝酸を短時間で取り込む」、2026-09-15 の BNV 定例で「排液の窒素酸化物・硫黄酸化物を栄養にしている」と説明している。処理（リアクター）では、この増え方を当てにしない（まさ 2026-09-17「排液が培地代わりになってさらにシアノが増えることはあるけど、それを期待した装置を組むわけではない」）。',
  needs_check = true, check_reason = '成分はオカベ社の申告値。処理前後のCOD値をSX側で実測し、成分が減っているかを確認する', updated_by = 'amie', updated_at = now()
 where tech_entry_id = 'pte_sx_ef01';
update project_tech_entries set
  note = substring(note from 1 for position(' **2026-09-15 訂正**' in note) - 1) || ' 炭素源は CO2 のみ（先生の資料 SX_事業概要 v1.0（2026-03-31）の「栄養要求性（C源）: 本技術 CO2のみ」。ユーグレナなど「糖など + CO2」との違いとして挙げている）。増えた分の栄養は排液の窒素・リン・硫黄などで、研究側は 2026-09-02 の定例で「硝酸・亜硝酸を短時間で取り込む」、2026-09-15 の BNV 定例で「排液の窒素酸化物・硫黄酸化物を栄養にしている」と説明している。処理（リアクター）では、この増え方を当てにしない（まさ 2026-09-17「排液が培地代わりになってさらにシアノが増えることはあるけど、それを期待した装置を組むわけではない」）。',
  needs_check = true, check_reason = '処理前後のCOD値を測り、どの成分が減ったかを確認する', updated_by = 'amie', updated_at = now()
 where tech_entry_id = 'pte_sx_l02';
update project_tech_entries set
  note = substring(note from 1 for position(' **2026-09-15 訂正**' in note) - 1) || ' 炭素源は CO2 のみ（先生の資料 SX_事業概要 v1.0（2026-03-31）の「栄養要求性（C源）: 本技術 CO2のみ」。ユーグレナなど「糖など + CO2」との違いとして挙げている）。増えた分の栄養は排液の窒素・リン・硫黄などで、研究側は 2026-09-02 の定例で「硝酸・亜硝酸を短時間で取り込む」、2026-09-15 の BNV 定例で「排液の窒素酸化物・硫黄酸化物を栄養にしている」と説明している。処理（リアクター）では、この増え方を当てにしない（まさ 2026-09-17「排液が培地代わりになってさらにシアノが増えることはあるけど、それを期待した装置を組むわけではない」）。',
  needs_check = true, check_reason = '処理前後のCOD値を測り、どの成分が減ったかを確認する', updated_by = 'amie', updated_at = now()
 where tech_entry_id = 'pte_sx_ss13';

-- 版の履歴
insert into project_cost_notes (cost_note_id, cost_model_id, section, title, body_md, visibility, sort_order) values
  ('cn20_h20', 'cm_p21_260820', 'history', 'リアクターを誰が持つかの切り替えを足し、顧客が持つリアクターの額を別に出した（2026-09-17）', 'まさ 2026-09-17「別で出しておいて。ただし、そこの項目すべてについて「顧客負担」をオンにしておいて。リアクター全体で１つのスイッチでオンオフ切り替えができれば十分」「これを計算しておきたいのは、廃液回収事業も検討してるから」。

顧客工場（オンサイト）のリアクターは顧客が買う前提（2026-09-14）で SX の原価から外していたが、額そのものをどこにも出していなかった。リアクターの明細82行（循環カートリッジ34行・直接投入48行）と処理の運転2件の持ち主を「場所による」から「リアクター」にまとめ、前提「リアクターは顧客負担」1つで顧客か SX に切り替えるようにした。切り替えは枠の上端の「装置」の右にある。

- **既定（顧客負担）**: SX の原価はこれまでと同じ。結果の欄に「顧客が持つリアクター」と「顧客の支払い（売価＋リアクター）」を出す
- **SX負担に切り替えると**: リアクターの額が SX の原価に入る。廃液回収事業のように SX がリアクターを持つ形を見るための切り替え
- オフサイト（SX工場）のリアクターは、切り替えによらず SX が持つ（数字は動かない）

| 円/m³（自然株・オンサイト・槽は既設） | SXの原価 | 顧客が持つリアクター | 顧客の支払い（売価500円＋リアクター） | SX負担に切り替えたときのSXの原価 |
|---|---|---|---|---|
| 色素分解・直接投入 | 135.0 | **463.3** | 963.3 | 598.3 |
| 色素分解・循環カートリッジ | 137.9 | **626.0** | 1,126.0 | 763.8 |
| 金属回収・直接投入 | 913.2 | **463.3** | 963.3 | 1,376.5 |
| 金属回収・循環カートリッジ | 916.0 | **626.0** | 1,126.0 | 1,542.0 |

- 顧客が持つリアクターの中身は、設備の償却（初期投資 直接投入 25,650,000円・循環カートリッジ 21,700,000円、顧客1社分）、洗浄・監視・点検・交換部品・電力と、**処理の運転**（直接投入 300.0円/m³、循環カートリッジ 230.0円/m³）。運転の手間は SX と同じ作業単価 4,000円/時で数えた見積で、顧客の実際の人件費とは違う
- **色素分解では、顧客が持つリアクターの額（463〜626円/m³）が SX の原価（135〜138円/m³）より大きい**。顧客から見た総額は売価500円ではなく 963〜1,126円/m³ になる
- 汚泥の処分・処理水の分析・閉鎖系の区画など、リアクター以外で顧客が持つ行はこの額に入れていない
- 同じ変更で、「工場の排液を培地に使える」の説明を、培養の拠点の話でリアクター（処理）とは関係ないと分かる文にした（まさ 2026-09-17「排液排ガス排熱の３つのスイッチは、培養にしか関係しない。この３つを使って培養すれば培養コストが大幅に下がる」）。処理の側は排液を分解するために入れるだけで、培地も光も要らない', 'amd_internal', 200);

do $do$ begin
  if (select count(*) from project_cost_items where cost_model_id = 'cm_p21_260820' and bearer = 'reactor') <> 82 then raise exception '448: リアクターの明細が入っていない'; end if;
  if (select count(*) from project_cost_tasks where cost_model_id = 'cm_p21_260820' and performer = 'reactor') <> 2 then raise exception '448: 処理の運転がリアクターになっていない'; end if;
  if exists (select 1 from project_cost_items where cost_model_id = 'cm_p21_260820' and scenario in ('循環','投入') and bearer = 'site') then raise exception '448: 場所によるの明細が残っている'; end if;
  if (select value_text from project_cost_assumptions where cost_assumption_id = 'ca20_reactor_customer_borne') <> 'on' then raise exception '448: リアクターの前提が on ではない'; end if;
  if exists (select 1 from project_cost_assumptions where cost_assumption_id in ('ca14_waste_medium','caf_waste_medium') and note not like '%培養にしか関係しない%') then raise exception '448: 排液の説明が直っていない'; end if;
  if exists (select 1 from project_cost_assumptions where note like '%糖は元々餌にはならない%') then raise exception '448: 排ガスの説明に古い書き方が残っている'; end if;
  if exists (select 1 from project_cost_items where cost_item_id in ('ci_260820_120', 'ci_260820_121', 'ci_260820_122', 'cif_culture_120', 'cif_culture_121', 'cif_culture_122') and position('（買値の欄はそのまま残る。使えるかは色ではなく排液の窒素の濃さで決まる。スイッチの説明を見る）' in note) > 0) then raise exception '448: 培地の原料の行が直っていない'; end if;
  if (select count(*) from project_tech_entries where tech_entry_id in ('pte_sx_d14', 'pte_sx_ef01', 'pte_sx_l02', 'pte_sx_ss13') and note like '%炭素源は CO2 のみ%') <> 4 then raise exception '448: 台帳が直っていない'; end if;
  if exists (select 1 from project_tech_entries where note like '%2026-09-15 訂正%') then raise exception '448: 台帳に訂正の書き方が残っている'; end if;
end $do$;
commit;
