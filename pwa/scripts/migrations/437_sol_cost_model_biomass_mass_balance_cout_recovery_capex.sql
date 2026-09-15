-- 437: SX（p21）のコスト試算（廃液）に、ちこさんの4点を入れる（ちこさん 2026-09-15。中島先生 2026-08-28 のレビュー）
--
--   ① 回収率は次のバッチへ回す量に使う: 必要な菌体を回収率で割るのをやめ、毎バッチ新しく入れる菌体 ＝ 1バッチに要る菌体 ×（1 − η）÷（1 − η^使用回数）
--      （計算は画面の変更で入る）。重なる明細「菌体ロス補充分」「菌体性能低下による交換・再生分」（循環・投入の4行）を0円にし、前の額を説明に残す
--   ② 金属の取り込み効率（0.042 / 0.053）は24時間の単回試験の値で、反応時間4時間とそろっていないことを、前提の説明・注記・確認事項に書く（数字は変えない）
--   ③ 金属回収の中央回収設備（酸処理・中和・固液分離）の CAPEX: 単価の連動のしかた recovery_capex を足し、前提3つと明細1行を置く（見積のない仮置き）
--   ④ 目標放流水濃度 Cout: 前提 effluent_target_concentration（金属10ppm・色素5mg/L）を置き、1バッチに要る菌体を (Cin − Cout) から出す
--   あわせて、数字が変わる注記8件・確認事項6件を書き直し、注記2件（取り込み効率の時間、版の履歴）と確認事項4件を足す
-- 画面と計算の変更（effluent_target_concentration / recovery_capex / マスバランスを読む）の配信が済んでから適用すること。
-- 生成: gen437.py（えいみ 2026-09-15、SOLセッションの scratchpad）。DB の現行行とコミット済みの fixture を同じ変換定義から書き出した。
begin;
select set_config('amd.cost_change_reason', '437: ちこさん 2026-09-15 の指摘（中島先生 2026-08-28 のレビュー）で、必要な菌体を回収率で割るのをやめて回収率を次のバッチへ回す割合にしたマスバランスにし、重なる菌体ロス補充分・性能低下分の4行を0円にし（前の額 9.0 / 4.5円/kg-DCW は260820版の10 / 5円/m³を1.111kgで割った額）、目標放流水濃度（金属10ppm＝一律排水基準の溶解性鉄、色素5mg/L＝脱色率90%の目標）と、金属回収の中央回収設備の初期投資（TetraPhos ハンブルクの31,500,000ユーロ・年20,000t から 5,670,000,000円・10年）を足し、金属の取り込み効率が24時間の値で反応時間4時間とそろっていないことを説明に書いた', true);
do $do$ begin
  if (select pg_get_constraintdef(oid) from pg_constraint where conname = 'project_cost_items_price_rule_check') <> 'CHECK (((price_rule IS NULL) OR (price_rule = ANY (ARRAY[''biomass''::text, ''broth''::text, ''module_swap''::text, ''power_circulation''::text, ''power_injection''::text, ''spent_disposal''::text, ''co2_supply''::text, ''culture_loss''::text, ''medium_supply''::text, ''heat_supply''::text]))))' then raise exception '437: 単価の連動のしかたの制約が変わっている'; end if;
  if exists (select 1 from project_cost_assumptions where cost_assumption_id = 'ca18_effluent_target_concentration_dye') then raise exception '437: 前提 ca18_effluent_target_concentration_dye がもうある'; end if;
  if exists (select 1 from project_cost_assumptions where cost_assumption_id = 'ca18_effluent_target_concentration_metal') then raise exception '437: 前提 ca18_effluent_target_concentration_metal がもうある'; end if;
  if exists (select 1 from project_cost_assumptions where cost_assumption_id = 'ca18_recovery_facility_capex') then raise exception '437: 前提 ca18_recovery_facility_capex がもうある'; end if;
  if exists (select 1 from project_cost_assumptions where cost_assumption_id = 'ca18_recovery_facility_life_years') then raise exception '437: 前提 ca18_recovery_facility_life_years がもうある'; end if;
  if exists (select 1 from project_cost_assumptions where cost_assumption_id = 'ca18_recovery_line_capacity_kg_year') then raise exception '437: 前提 ca18_recovery_line_capacity_kg_year がもうある'; end if;
  if exists (select 1 from project_cost_assumptions where cost_model_id = 'cm_p21_260820' and role_key in ('effluent_target_concentration', 'recovery_facility_capex', 'recovery_facility_life_years', 'recovery_line_capacity_kg_year')) then raise exception '437: cm_p21_260820 に目標放流水濃度か中央回収設備の前提がもうある'; end if;
  if exists (select 1 from project_cost_items where cost_item_id = 'ci18_recovery_capex') then raise exception '437: 明細 ci18_recovery_capex がもうある'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id = 'cn18_c12') then raise exception '437: 注記 cn18_c12 がもうある'; end if;
  if exists (select 1 from project_cost_notes where cost_note_id = 'cn18_h18') then raise exception '437: 注記 cn18_h18 がもうある'; end if;
  if exists (select 1 from project_cost_questions where cost_question_id = 'cq18_01') then raise exception '437: 確認事項 cq18_01 がもうある'; end if;
  if exists (select 1 from project_cost_questions where cost_question_id = 'cq18_02') then raise exception '437: 確認事項 cq18_02 がもうある'; end if;
  if exists (select 1 from project_cost_questions where cost_question_id = 'cq18_03') then raise exception '437: 確認事項 cq18_03 がもうある'; end if;
  if exists (select 1 from project_cost_questions where cost_question_id = 'cq18_04') then raise exception '437: 確認事項 cq18_04 がもうある'; end if;
  if (select md5(coalesce(note, '')) from project_cost_items where cost_item_id = 'ci_260820_142') is distinct from 'bfb022ae7bcd1398d796a217ef4e5686' then raise exception '437: ci_260820_142 の説明が確認した時点から変わっている'; end if;
  if (select unit_price from project_cost_items where cost_item_id = 'ci_260820_142') is distinct from 9.0 then raise exception '437: ci_260820_142 の単価が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '')) from project_cost_items where cost_item_id = 'ci_260820_160') is distinct from 'bfb022ae7bcd1398d796a217ef4e5686' then raise exception '437: ci_260820_160 の説明が確認した時点から変わっている'; end if;
  if (select unit_price from project_cost_items where cost_item_id = 'ci_260820_160') is distinct from 9.0 then raise exception '437: ci_260820_160 の単価が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '')) from project_cost_items where cost_item_id = 'ci_260820_143') is distinct from '5d063f3dc0d87de0c9adb74c940f2b7f' then raise exception '437: ci_260820_143 の説明が確認した時点から変わっている'; end if;
  if (select unit_price from project_cost_items where cost_item_id = 'ci_260820_143') is distinct from 4.5 then raise exception '437: ci_260820_143 の単価が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '')) from project_cost_items where cost_item_id = 'ci_260820_161') is distinct from '5d063f3dc0d87de0c9adb74c940f2b7f' then raise exception '437: ci_260820_161 の説明が確認した時点から変わっている'; end if;
  if (select unit_price from project_cost_items where cost_item_id = 'ci_260820_161') is distinct from 4.5 then raise exception '437: ci_260820_161 の単価が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '')) from project_cost_items where cost_item_id = 'ci_260820_134') is distinct from 'd99d42753febcd638f1d311cde8b31e3' then raise exception '437: ci_260820_134 の説明が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '')) from project_cost_items where cost_item_id = 'ci_260820_154') is distinct from 'ed27fb51967a0a210a070d2205ef4e94' then raise exception '437: ci_260820_154 の説明が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '') || '|' || coalesce(label, '')) from project_cost_assumptions where cost_assumption_id = 'ca_recovery_eta') is distinct from '9ede4029290a7070573244a35119e104' then raise exception '437: ca_recovery_eta の説明が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '') || '|' || coalesce(label, '')) from project_cost_assumptions where cost_assumption_id = 'ca_reuse_count') is distinct from 'a7b1f060858d14ba7211fa731e0dbae9' then raise exception '437: ca_reuse_count の説明が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '') || '|' || coalesce(label, '')) from project_cost_assumptions where cost_assumption_id = 'ca_uptake_alpha') is distinct from '792bab0a00b29ddbcfefa340168e2e85' then raise exception '437: ca_uptake_alpha の説明が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '') || '|' || coalesce(label, '')) from project_cost_assumptions where cost_assumption_id = 'ca2_uptake_alpha_metal_enhanced') is distinct from '5e0fc712f6734ea9c3649f15e0881ddd' then raise exception '437: ca2_uptake_alpha_metal_enhanced の説明が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '') || '|' || coalesce(label, '')) from project_cost_assumptions where cost_assumption_id = 'ca_hrt_circulation') is distinct from '398792fde83ccd617706287718021d96' then raise exception '437: ca_hrt_circulation の説明が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '') || '|' || coalesce(label, '')) from project_cost_assumptions where cost_assumption_id = 'ca_hrt_injection') is distinct from '7ca1525d0ba157a05959e91de48676aa' then raise exception '437: ca_hrt_injection の説明が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '') || '|' || coalesce(label, '')) from project_cost_assumptions where cost_assumption_id = 'ca12_offsite_target_concentration_dye') is distinct from 'aece0f625a63f5615ead77a38a7fb97f' then raise exception '437: ca12_offsite_target_concentration_dye の説明が確認した時点から変わっている'; end if;
  if (select md5(coalesce(note, '') || '|' || coalesce(label, '')) from project_cost_assumptions where cost_assumption_id = 'ca12_offsite_target_concentration_metal') is distinct from 'b93c8aca581cc93ac00fc6ef0bade5b9' then raise exception '437: ca12_offsite_target_concentration_metal の説明が確認した時点から変わっている'; end if;
  if (select md5(coalesce(summary_md, '')) from project_cost_models where cost_model_id = 'cm_p21_260820') is distinct from '7d183744166a346e9fba03b64c734055' then raise exception '437: 試算の summary_md が確認した時点から変わっている'; end if;
  if (select md5(coalesce(system_scope_md, '')) from project_cost_models where cost_model_id = 'cm_p21_260820') is distinct from 'f146473c42294a900d4f3e301bfda404' then raise exception '437: 試算の system_scope_md が確認した時点から変わっている'; end if;
  if (select md5(coalesce(body_md, '')) from project_cost_notes where cost_note_id = 'cn2_c9') is distinct from 'e8a6f5a87b8d3540a51ca842058ff344' then raise exception '437: 注記 cn2_c9 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(body_md, '')) from project_cost_notes where cost_note_id = 'cn_260820_r3') is distinct from 'ebd03dd031174ede93f437822c34ebf2' then raise exception '437: 注記 cn_260820_r3 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(body_md, '')) from project_cost_notes where cost_note_id = 'cn_260820_c4') is distinct from '52022ca3b1c2ffdbc75093519d2dbec3' then raise exception '437: 注記 cn_260820_c4 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(body_md, '')) from project_cost_notes where cost_note_id = 'cn4_c11') is distinct from 'ddab966323c1ceb0ff4c1a219a7f2dbf' then raise exception '437: 注記 cn4_c11 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(body_md, '')) from project_cost_notes where cost_note_id = 'cn2_c7') is distinct from '53779ab95e251fadac05ecb62a82b17a' then raise exception '437: 注記 cn2_c7 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(body_md, '')) from project_cost_notes where cost_note_id = 'cn_260820_h2') is distinct from '2b9e659d9623d26185075b4b01667e63' then raise exception '437: 注記 cn_260820_h2 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(body_md, '')) from project_cost_notes where cost_note_id = 'cn_260820_c1') is distinct from '0c8243891930043f65f7df8c255cef60' then raise exception '437: 注記 cn_260820_c1 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(body_md, '')) from project_cost_notes where cost_note_id = 'cn2_c10') is distinct from '339788c5bc7ed1571e0319dd6e6c807c' then raise exception '437: 注記 cn2_c10 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(body_md, '')) from project_cost_notes where cost_note_id = 'cn_260820_r1') is distinct from 'c0c694d51ffea50693e11e89751b90f4' then raise exception '437: 注記 cn_260820_r1 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(body_md, '')) from project_cost_notes where cost_note_id = 'cn17_h17') is distinct from 'd212c40e47d54ba457418bfbd74498c6' then raise exception '437: 注記 cn17_h17 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(question, '') || '|' || coalesce(why_it_matters, '')) from project_cost_questions where cost_question_id = 'cq_260820_01') is distinct from 'dd70a3c6250cb3cc94530ac73ac945c8' then raise exception '437: 確認事項 cq_260820_01 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(question, '') || '|' || coalesce(why_it_matters, '')) from project_cost_questions where cost_question_id = 'cq2_02') is distinct from '59b082d85677267071c94c309774fc66' then raise exception '437: 確認事項 cq2_02 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(question, '') || '|' || coalesce(why_it_matters, '')) from project_cost_questions where cost_question_id = 'cq4_01') is distinct from '49a179095a22ee09874531e2a0b81473' then raise exception '437: 確認事項 cq4_01 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(question, '') || '|' || coalesce(why_it_matters, '')) from project_cost_questions where cost_question_id = 'cq4_04') is distinct from '6bb5b28d1ffa63a3d8d0265ef08e2008' then raise exception '437: 確認事項 cq4_04 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(question, '') || '|' || coalesce(why_it_matters, '')) from project_cost_questions where cost_question_id = 'cq_260820_16') is distinct from '966794094438415f64f04eb1bc8847cd' then raise exception '437: 確認事項 cq_260820_16 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(question, '') || '|' || coalesce(why_it_matters, '')) from project_cost_questions where cost_question_id = 'cq11_02') is distinct from '28003e585e78c650724c72b3dda11123' then raise exception '437: 確認事項 cq11_02 が確認した時点から変わっている'; end if;
  if (select md5(coalesce(question, '') || '|' || coalesce(why_it_matters, '')) from project_cost_questions where cost_question_id = 'cq_260820_02') is distinct from 'd32954a3cd1d2a8ec48eed3f3bd5b45c' then raise exception '437: 確認事項 cq_260820_02 が確認した時点から変わっている'; end if;
end $do$;

alter table project_cost_items drop constraint if exists project_cost_items_price_rule_check;
alter table project_cost_items add constraint project_cost_items_price_rule_check
  check (price_rule is null or price_rule in (
    'biomass', 'broth', 'module_swap', 'power_circulation', 'power_injection', 'spent_disposal',
    'co2_supply', 'culture_loss', 'medium_supply', 'heat_supply', 'recovery_capex'
  ));
comment on column project_cost_items.price_rule is '単価の連動のしかた（null は unit_price をそのまま使う）。biomass / broth = 旧版の菌体量・培養液量の倍率、module_swap = モジュール一式 ÷ 耐用 ÷ 1バッチの量、power_circulation / power_injection = 動力 × 反応時間 × 電力単価 ÷ 1バッチの量、spent_disposal = 湿重量倍率 × 汚泥の処分単価、co2_supply = CO2（前提 co2_flue_gas が on なら0円）、culture_loss = 培養ロス補充（同じ群の菌体1kgあたりの原料の行の額の合計）、medium_supply = 培地の原料（前提 waste_medium が on なら unit_price × (1 − waste_medium_reduction%)）、heat_supply = 培養の加温（前提 waste_heat が on なら0円）、recovery_capex = 金属回収の中央回収設備の償却（前提 recovery_facility_capex ÷ recovery_facility_life_years ÷ recovery_line_capacity_kg_year、円/kg-DCW）。migration 437';

insert into project_cost_assumptions (cost_model_id, cost_assumption_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('cm_p21_260820', 'ca18_effluent_target_concentration_dye', '対象物質と菌体の量', '目標放流水濃度（色素）', 5.0, null, 'mg/L', 'H', '仮置き', 'AMD（内部）', true, 'effluent_target_concentration', '見積や測定のない仮置き。2026-09-15 に新しく置いた（中島先生 2026-08-28 のレビュー「(Cin−Cout)×水量に変更」、ちこさん 2026-09-15 の指摘）。処理のあとに流す水に残してよい色素の濃さ。国の一律排水基準には色の項目が無く、色の基準は都道府県や市町村の条例と、下水道に流すときの基準で決まる。そこで、SXの技術検証の目標（色素分解「メチレンブルーの脱色率90%以上・30分以内」、2026-02-28 の戦略案）を、オンサイトの濃さ 50mg/L に当てて 5mg/L と置いた。オフサイト（引き取る液 1,000mg/L）も同じ 5mg/L まで取り除く計算にしている（脱色率にすると99.5%で、目標の90%より厳しい）。確かめ方: 顧客候補の工場と、SX工場を置く自治体の、色（色度）の基準を調べて置き換える。', 'amd_internal', 129, null, 'dye');
insert into project_cost_assumptions (cost_model_id, cost_assumption_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('cm_p21_260820', 'ca18_effluent_target_concentration_metal', '対象物質と菌体の量', '目標放流水濃度（金属）', 10.0, null, 'ppm', 'H', '仮置き', 'AMD（内部）', true, 'effluent_target_concentration', '見積や測定のない仮置き。2026-09-15 に新しく置いた（中島先生 2026-08-28 のレビュー「金属除去量の計算 | 50 ppm全量を除去 | 放流水濃度を考慮していない | (Cin−Cout)×水量に変更」、ちこさん 2026-09-15 の指摘）。処理のあとに流す水に残してよい金属の濃さ。1バッチに要る菌体は、流入の濃さ（前提「対象物質の濃度（金属）」）からこの濃さを引いた分を取り込ませる量で出す（それまでは流入の濃さを全量取り除く量で出していた）。値は、水質汚濁防止法の一律排水基準の「溶解性鉄含有量 10mg/L」（排水基準を定める省令 別表第二）を ppm に読み替えた（水では 1mg/L ≒ 1ppm）。SXの取り込みの試験（2026-09-02 定例の単回試験）が鉄の模擬排液なので、鉄で置いた。対象の金属が銅なら 3mg/L、亜鉛なら 2mg/L と、一律排水基準の方が厳しい。都道府県の上乗せ基準や、下水道に流すときの基準は場所で違う。オフサイト（SX工場から流す水）も同じ値で計算する。いまの前提で、オンサイトは 50ppm のうち 40ppm、オフサイトは 5,000ppm のうち 4,990ppm を取り除く。確かめ方: 狙う金属と、顧客候補の工場の排水の基準（許可の条件）を決めて置き換える。', 'amd_internal', 129, null, 'metal');
insert into project_cost_assumptions (cost_model_id, cost_assumption_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('cm_p21_260820', 'ca18_recovery_facility_capex', '金属の回収設備（酸処理・中和・固液分離）', '中央回収設備：1系列の初期投資', 5670000000.0, null, '円/系列', 'H', '仮置き', '中島先生（設備の構成）', true, 'recovery_facility_capex', '見積のない仮置き。2026-09-15 に新しく置いた（中島先生 2026-08-28 のレビュー「金属回収設備CAPEXがない | 酸処理OPEXのみ | 酸処理・中和・分離には設備が必要 | 中央回収設備として別CAPEX化」、ちこさん 2026-09-15 の指摘）。金属回収で、顧客工場とSX工場から集めた使用済み菌体を1か所で酸で溶かし、中和と固液分離をして金属を取り出す中央回収設備の、1系列の初期投資。国内の見積も、機械ごとの値段（フィルタープレス・中和処理装置・耐酸の撹拌槽・酸の霧のスクラバー）も公開されていない（メーカーは個別見積。2026-09-15 に調べた）ので、固形物を酸で溶かして有価物を取り出す実在のプラントの額で置いた: ドイツ・ハンブルクの TetraPhos（REMONDIS と HAMBURG WASSER。下水汚泥の焼却灰を酸で溶かし、石こう・鉄とアルミの塩・リン酸に分ける）は、灰を年 20,000t 処理する規模で、試運転までに約23,500,000ユーロ、大きな規模で安定して動かすための手直しに約8,000,000ユーロをかけた（ZfK「Wer schon 2029 liefern kann」、Umweltinnovationsprogramm の事業紹介）。計31,500,000ユーロを1ユーロ180円（2026年9月の相場 約178.6円）で直して 5,670,000,000円。灰1tと乾燥菌体1tを同じ処理量とみた（前提「中央回収設備：1系列が1年に処理する使用済み菌体」）。単価は 1系列の初期投資 ÷ 耐用年数 ÷ 1系列が1年に処理する使用済み菌体 ＝ 28.35円/kg-DCW で、自然株・オンサイトなら処理水1m³あたり27.0円。TetraPhos はリン酸を精製する工程まで含むので、SXに要る工程より多い可能性がある。岐阜市のリン回収施設（下水汚泥の焼却灰、建設費 約700,000,000円）は処理量が公開されておらず、1tあたりに直せなかった。確かめ方: ①酸の種類と量・溶かす時間・金属の取り出し方を中島先生に聞き（確認事項）、②その構成でプラントメーカーに概算をもらう。', 'amd_internal', 210, null, 'metal');
insert into project_cost_assumptions (cost_model_id, cost_assumption_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('cm_p21_260820', 'ca18_recovery_facility_life_years', '金属の回収設備（酸処理・中和・固液分離）', '中央回収設備：耐用年数', 10.0, null, '年', 'H', '仮置き', 'AMD（内部）', false, 'recovery_facility_life_years', '仮置き（2026-09-15）。この試算の処理設備と槽の耐用年数（10年）とそろえた。酸を扱う設備は腐食で短くなることがある。長く使えるなら、1kgあたりの償却は年数に反比例して下がる（15年なら 18.9円/kg-DCW）。', 'amd_internal', 211, null, 'metal');
insert into project_cost_assumptions (cost_model_id, cost_assumption_id, group_label, label, value, value_text, unit, confidence, source_kind, owner, is_key, role_key, note, visibility, sort_order, strain, application) values ('cm_p21_260820', 'ca18_recovery_line_capacity_kg_year', '金属の回収設備（酸処理・中和・固液分離）', '中央回収設備：1系列が1年に処理する使用済み菌体', 20000000.0, null, 'kg-DCW/年', 'H', '仮置き', 'AMD（内部）', true, 'recovery_line_capacity_kg_year', '仮置き（2026-09-15）。1系列の初期投資の元にした TetraPhos（ハンブルク）の処理量、焼却灰 年20,000t を、乾燥菌体の量に読み替えた。菌体は灰より軽くかさばり、酸で溶かすときの液の量も違うので、同じ設備で処理できる量はこれより少ない可能性がある。系列は、その用途で1年に処理する使用済み菌体（オンサイトとオフサイトで使い切る菌体の合計）に合わせて並べる（端数も比例で数える）。いまの前提で、金属回収の使用済み菌体は自然株で年 約22,612t（約1.1系列・初期投資 約6,410,500,000円）、強化株で年 約17,919t（約0.9系列・約5,080,000,000円）。', 'amd_internal', 212, null, 'metal');
insert into project_cost_items (cost_model_id, cost_item_id, scenario, cost_type, group_label, mid_label, leaf_label, basis, quantity, quantity_unit, unit_price, unit_price_unit, price_rule, annual_factor, useful_life_years, is_breakdown, confidence, source_kind, owner, note, visibility, sort_order, strain, application, bearer) values ('cm_p21_260820', 'ci18_recovery_capex', '共通', 'CAPEX', '金属回収設備', '中央回収設備（酸処理・中和・固液分離）', '設備一式の償却', '毎kg菌体比例', 1.0, 'kg-DCW', 0.0, '円/kg-DCW', 'recovery_capex', 1.0, null, false, 'H', '仮置き', '中島先生（設備の構成）', '見積のない仮置き。この行は 2026-09-15 に新しく入れた（それまで金属回収の後処理は、酸・洗浄水・中和剤・残渣処分・廃液処理の OPEX だけで、酸で溶かし中和・固液分離をする設備そのものの初期投資が入っていなかった。中島先生 2026-08-28 のレビュー「金属回収設備CAPEXがない | 酸処理OPEXのみ | 酸処理・中和・分離には設備が必要 | 中央回収設備として別CAPEX化」、ちこさん 2026-09-15 の指摘）。顧客工場とSX工場から集めた使用済み菌体を1か所で処理する中央の設備で、SXが持つ（オンサイトでもオフサイトでも）。単価は前提から計算する: 1系列の初期投資 ÷ 耐用年数 ÷ 1系列が1年に処理する使用済み菌体 ＝ 28.35円/kg-DCW。系列は処理する量に合わせて並べる（培養設備と同じ）ので、1kgあたりは量で変わらない。額の置き方と確かめ方は、前提「中央回収設備：1系列の初期投資」の説明にある。中島先生の設備・ランニングコスト試算（2026-08-12）にも、この設備の金額は無い。', 'amd_internal', 925, null, 'metal', 'sx');
update project_cost_items set unit_price = 0.0, note = '2026-09-15 に0円にした（菌体のバッチ間のマスバランスにまとめた。中島先生 2026-08-28 のレビュー「菌体ロスが二重計上の可能性 | 回収率90%＋ロス補充＋培養ロス | 同じ損失を複数箇所で計上する恐れ | 菌体マスバランスを一本化」、ちこさん 2026-09-15 の指摘）。回収できずに失う菌体の補充は、「毎バッチ新しく入れる菌体」（前提「菌体回収率η」「菌体使用回数」から出す）に入り、菌体費として数える。この行に額を残すと、同じ損失を2か所で数える。前の額（2026-09-15 にマスバランスへまとめる前）: 菌体1kgあたり9.0円。ちこさんの試算シート 260820版の「菌体ロス補充分」処理水1m³あたり10円（出所「仮置き」、単価は菌体の量の倍率に連動。migration 322 で取り込み）を、二段階版（2026-09-13）で処理水1m³に使う乾燥菌体 1.111kg で割った額。260820版のメモは「物理的なロス分の補充。名称を「補充菌体」から明確化。現行は毎m³一定額の暫定計算で、菌体寿命の概念を持たない。菌体再利用可能バッチ数（上部注記参照）が確定したら式を組み直す。」', updated_at = now() where cost_item_id = 'ci_260820_142';
update project_cost_items set unit_price = 0.0, note = '2026-09-15 に0円にした（菌体のバッチ間のマスバランスにまとめた。中島先生 2026-08-28 のレビュー「菌体ロスが二重計上の可能性 | 回収率90%＋ロス補充＋培養ロス | 同じ損失を複数箇所で計上する恐れ | 菌体マスバランスを一本化」、ちこさん 2026-09-15 の指摘）。回収できずに失う菌体の補充は、「毎バッチ新しく入れる菌体」（前提「菌体回収率η」「菌体使用回数」から出す）に入り、菌体費として数える。この行に額を残すと、同じ損失を2か所で数える。前の額（2026-09-15 にマスバランスへまとめる前）: 菌体1kgあたり9.0円。ちこさんの試算シート 260820版の「菌体ロス補充分」処理水1m³あたり10円（出所「仮置き」、単価は菌体の量の倍率に連動。migration 322 で取り込み）を、二段階版（2026-09-13）で処理水1m³に使う乾燥菌体 1.111kg で割った額。260820版のメモは「物理的なロス分の補充。名称を「補充菌体」から明確化。現行は毎m³一定額の暫定計算で、菌体寿命の概念を持たない。菌体再利用可能バッチ数（上部注記参照）が確定したら式を組み直す。」', updated_at = now() where cost_item_id = 'ci_260820_160';
update project_cost_items set unit_price = 0.0, note = '2026-09-15 に0円にした（菌体のバッチ間のマスバランスにまとめた。中島先生 2026-08-28 のレビュー「菌体ロスが二重計上の可能性 | 回収率90%＋ロス補充＋培養ロス | 同じ損失を複数箇所で計上する恐れ | 菌体マスバランスを一本化」、ちこさん 2026-09-15 の指摘）。菌体の性能が落ちて入れ替える分は、同じ菌体を何バッチ使ったら入れ替えるか（前提「菌体使用回数」）として、「毎バッチ新しく入れる菌体」（前提「菌体回収率η」「菌体使用回数」から出す）に入り、菌体費として数える。この行に額を残すと、同じ損失を2か所で数える。前の額（2026-09-15 にマスバランスへまとめる前）: 菌体1kgあたり4.5円。ちこさんの試算シート 260820版の「菌体性能低下による交換・再生分」処理水1m³あたり5円（出所「仮置き」、単価は菌体の量の倍率に連動。migration 322 で取り込み）を、二段階版（2026-09-13）で処理水1m³に使う乾燥菌体 1.111kg で割った額。260820版のメモは「菌体の金属吸収能力が落ちた分の交換・再生費用。名称を「性能低下見合い追加投入」から明確化。現行式は性能低下率を単純に追加投入する暫定計算。菌体の再生可否・再利用回数・再生コストが未確定のため、この式は暫定扱い。確定後に組み直す。」', updated_at = now() where cost_item_id = 'ci_260820_143';
update project_cost_items set unit_price = 0.0, note = '2026-09-15 に0円にした（菌体のバッチ間のマスバランスにまとめた。中島先生 2026-08-28 のレビュー「菌体ロスが二重計上の可能性 | 回収率90%＋ロス補充＋培養ロス | 同じ損失を複数箇所で計上する恐れ | 菌体マスバランスを一本化」、ちこさん 2026-09-15 の指摘）。菌体の性能が落ちて入れ替える分は、同じ菌体を何バッチ使ったら入れ替えるか（前提「菌体使用回数」）として、「毎バッチ新しく入れる菌体」（前提「菌体回収率η」「菌体使用回数」から出す）に入り、菌体費として数える。この行に額を残すと、同じ損失を2か所で数える。前の額（2026-09-15 にマスバランスへまとめる前）: 菌体1kgあたり4.5円。ちこさんの試算シート 260820版の「菌体性能低下による交換・再生分」処理水1m³あたり5円（出所「仮置き」、単価は菌体の量の倍率に連動。migration 322 で取り込み）を、二段階版（2026-09-13）で処理水1m³に使う乾燥菌体 1.111kg で割った額。260820版のメモは「菌体の金属吸収能力が落ちた分の交換・再生費用。名称を「性能低下見合い追加投入」から明確化。現行式は性能低下率を単純に追加投入する暫定計算。菌体の再生可否・再利用回数・再生コストが未確定のため、この式は暫定扱い。確定後に組み直す。」', updated_at = now() where cost_item_id = 'ci_260820_161';
update project_cost_items set note = '仮置き。培養がうまくいかずに作り直す割合を5%とし（数量）、上の原料9行の菌体1kgあたりの額の合計を単価として掛ける。単価は上の9行から計算するので、原料の行を書き換えたり、CO2 の「排ガス利用可能」を ON にしたりすると一緒に動く（2026-09-14 から。それまでは合計261.6円を直に置いていて、上の行を書き換えても変わらなかった）。確かめ方: 1年に失敗する培養の割合を杉浦先生に聞いて比べる。コスト試算（燃料）の培養設備の同じ行と同じ値（2026-09-14 にそろえた）。片方を直しても、もう片方は変わらない。前の額（2026-09-14 に「使う量 × 買値」へ組み直す前）: 菌体1kgあたり5.4円で、量と買値の内訳は無かった。ちこさんの試算シート（2026-07-30版〜2026-08-20版）の「培養ロス補充　処理水1m³あたり6円」（出所「仮置き」）を、処理水1m³に使う乾燥菌体1.111kgで割った額。7/30版のメモは「菌体量連動」。決め方はシートに書かれていない。版ごとの流れは版の履歴「培養の原料の前の額は、どこから来たか」。 2026-09-15 確認: 中島先生 2026-08-28 のレビューで同じ損失を複数箇所で数えている恐れとして挙がった4つ（回収率90%・菌体ロス補充分・性能低下補充分・この培養ロス）のうち、この行は残した。菌体の製造拠点で培養がうまくいかずに作り直す分で、良い菌体1kgを作るための費用に入る。処理のあとで菌体を失う分（回収率と使用回数から出す「毎バッチ新しく入れる菌体」）とは起きる場所が違い、重ならない。', updated_at = now() where cost_item_id = 'ci_260820_134';
update project_cost_items set note = '菌体そのものはモジュール部材ではないため内訳から除外（金額0円）。シアノは菌体の製造拠点から供給され、菌体のロスと性能低下による入れ替えは、2026-09-15 から前提「菌体回収率η」「菌体使用回数」から出す「毎バッチ新しく入れる菌体」で数えている（それまでは260820版の141・142行（循環）／159・160行（投入）で別に計上していた）。モジュール（膜・バッグ・フィルター・支持材）と菌体は寿命が別物であるため分離して管理する。', updated_at = now() where cost_item_id = 'ci_260820_154';
update project_cost_assumptions set label = '菌体回収率η（次のバッチへ回せる割合）', note = 'V-501。00_変数辞書 Mid/プロセス分解P2。2026-09-15 から、処理のあと回収して次のバッチへ回せる菌体の割合として使う（中島先生 2026-08-28 のレビュー「回収率と初回必要投入量が混同されている」「回収率は「次バッチへ再利用できる量」に使用」、ちこさん 2026-09-15 の指摘）。毎バッチ、前のバッチから回した菌体に新しい菌体を足して、1バッチに要る菌体（（流入の濃さ − 目標放流水濃度）÷ 取り込み効率）にそろえる。回した菌体は1回ごとに η 倍になり、使用回数を使い切ったら入れ替えるので、新しく入れる菌体 ＝ 1バッチに要る菌体 ×（1 − η）÷（1 − η^使用回数）。色素分解（使用回数10回）では、90%で要る量の15.4%、95%で12.5%、98%で10.9%、100%で10.0%（使用回数で割るだけ）。使用回数1回の金属回収には効かない（毎バッチ要る量をそのまま新しく入れる）。回収できずに失う菌体と、使用回数を使い切って入れ替える菌体は、この新しく入れる量に入るので、明細の「菌体ロス補充分」「菌体性能低下による交換・再生分」は0円にした。確かめ方: 装置（循環カートリッジ・直接投入）ごとに、処理のあと次のバッチへ回せる菌体の割合を中島先生に聞く（確認事項）。2026-07 の設備アドオン試算は、色素分解の運転ロスを2%（回収率98%にあたる）で置いていた。前の使い方（2026-09-15 まで）: 必要な菌体を η で割っていた（260820版の③シートと同じ式。金属50ppm ÷ 取り込み効率0.05 ÷ 0.9 ＝ 1,111 g/m³）。', updated_at = now() where cost_assumption_id = 'ca_recovery_eta';
update project_cost_assumptions set note = '★最大の感度。色素分解で菌体を何回使い回すか。10回で置いている（2026-09-14 まさ「もともと10回使える前提でしょ？」。2026-07の設備アドオン試算の前提＝培養液を10回使い回し、運転ロス2%）。技術的な確認はまだで、杉浦先生へ確認中。2026-09-15 から、使用回数は「同じ菌体を何バッチ使ったら入れ替えるか」として、回収率（次のバッチへ回せる割合）と組み合わせる（前提「菌体回収率η」の式。中島先生 2026-08-28 のレビュー）。回収率90%では使い回すたびに1割を失うので、1回（使い捨て）にすると菌体費は約6.5倍、20回にしても約26%しか減らない（新しく入れる菌体が、1バッチに要る量の15.4% → 使い捨て100%・20回11.4%）。前の書き方（2026-09-15 まで、回収率で1回だけ割っていた式のとき）: 「1回（使い捨て）にすると菌体費が10倍になる。二段階版では菌体原価を1kgあたりで持つので、使用回数を上げると菌体費がそのまま回数分下がる」。 使い回せるのは色素分解だけ。金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定している（2026-09-13 まさ）。', updated_at = now() where cost_assumption_id = 'ca_reuse_count';
update project_cost_assumptions set note = '★V-402。9/2定例の単回試験で、同じ菌体濃度（OD5）の野生型は50ppm中40ppmを取り込み、強化株1は50ppmを全量取り込んで鉄量が乾燥菌体重量比5.3%だった。菌体量が同じと仮定し 5.3% × 40/50 ≒ 4.2% と置いた。260820版の0.05は出所が確認できないため置き換えた。 2026-09-15 確認（ちこさん「HRT4hとの整合だけ確認」）: この値は24時間の単回試験の値で、試算の反応時間（循環カートリッジ・直接投入とも4時間）とはそろっていない。4時間の時点の取り込み量は測っていない（技術検証では、強化株1の鉄の取り込みをくり返して取り込みの速さ（半減期）を求めることが次の検証に挙がっている）。4時間で24時間の半分しか取り込めなければ、使い切る菌体は2倍になり、オンサイト・直接投入の総コストは 913.2 → 1,788.0円/m³（工場の排熱・排ガス・排液を使うときは 241.4 → 444.5円/m³）。1日1バッチなので、反応を24時間にする手もある（そのときは装置の電力が6倍。オンサイトの電力は顧客が持つので、SXの原価に効くのはオフサイトだけ）。杉浦先生への確認事項に足した。', updated_at = now() where cost_assumption_id = 'ca_uptake_alpha';
update project_cost_assumptions set note = '9/2定例の単回試験で、強化株1（OD5）が鉄模擬排液50ppmを24時間で全量取り込み、鉄量が乾燥菌体重量比5.3%。上限に届いていないので、実際の取り込み効率はこれ以上。反復試験と上限探索が技術検証に登録済み。 2026-09-15 確認（ちこさん「HRT4hとの整合だけ確認」）: この値は24時間の単回試験の値で、試算の反応時間（4時間）とはそろっていない。4時間の時点の取り込み量は測っていない。4時間で半分しか取り込めなければ、オンサイト・直接投入の総コストは 749.2 → 1,458.6円/m³。杉浦先生への確認事項に足した。', updated_at = now() where cost_assumption_id = 'ca2_uptake_alpha_metal_enhanced';
update project_cost_assumptions set note = 'AI比較資料をもとに暫定4h。1/4/8hで感度をみる。 金属の取り込み効率（自然株 0.042・強化株 0.053 g/g菌体）は24時間の単回試験の値で、この4時間とはそろっていない（2026-09-15 確認。前提「取り込み効率α（金属）」の説明）。', updated_at = now() where cost_assumption_id = 'ca_hrt_circulation';
update project_cost_assumptions set note = '循環カートリッジと同じくAI比較資料をもとに暫定4h 金属の取り込み効率（自然株 0.042・強化株 0.053 g/g菌体）は24時間の単回試験の値で、この4時間とはそろっていない（2026-09-15 確認。前提「取り込み効率α（金属）」の説明）。', updated_at = now() where cost_assumption_id = 'ca_hrt_injection';
update project_cost_assumptions set note = 'オフサイト（顧客の排液をSX工場まで運んで処理）で引き取る液の色素の濃さ。顧客工場の排水（オンサイト、50mg/L）とは別に置き、オフサイトで使い切る菌体量はこの濃さで出す（2026-09-14 まさ「置いて」）。引き取りの値段（1Lあたり50円）が付くのは自社で処理しにくい濃い液で、染色で使い終わった液（残液）などを想定する。反応染料は繊維に固着する割合が60〜90%とされ、残りは液に残る。排水より1桁以上濃いとみて、排水の仮置き50mg/Lの20倍の1,000mg/Lで置いた根拠の弱い仮置き。顧客候補がいま産業廃棄物として出している液の分析値で置き換える。この濃さで、色素分解（使用回数10回・回収率90%・目標放流水濃度5mg/L）の使い切る菌体は1m³あたり約3.1kg（2026-09-15 に回収率をマスバランスにする前は約2.2kg）。', updated_at = now() where cost_assumption_id = 'ca12_offsite_target_concentration_dye';
update project_cost_assumptions set note = 'オフサイトで引き取る液の金属の濃さ。顧客工場の排水（オンサイト、50ppm）とは別に置き、オフサイトで使い切る菌体量はこの濃さで出す（2026-09-14 まさ「置いて」）。めっき排水の現場の目安（鉄500ppm程度、2026-09-02 SX定例）と、めっき液そのもの（ワット浴で硫酸ニッケル220〜380g/L・塩化ニッケル30〜60g/L、ニッケルに換算して約5〜10%＝50,000〜100,000ppm。めっき薬品メーカーの技術レポート）の間の、10倍ずつの真ん中として5,000ppmで置いた仮置き。顧客候補がいま産業廃棄物として出している液の分析値で置き換える。この濃さでは、使い切る乾燥菌体が1m³あたり約94kg（強化株）〜約119kg（自然株）で、液の重さの約1割になる（2026-09-15 に回収率で割るのをやめ、目標放流水濃度10ppmを引く前は約105〜132kg）。菌体に取り込ませる処理がこの量で成り立つかは確かめていない（杉浦先生への確認事項「濃い液を菌体で処理できますか」）。', updated_at = now() where cost_assumption_id = 'ca12_offsite_target_concentration_metal';
update project_cost_models set system_scope_md = '**対象** — 工場排液を、生きたシアノバクテリア（藍藻）で処理する。用途は色素分解と金属回収の2つを並べる。

**規模** — オンサイトで年間 20,000,000 m³（売価500円/m³で売上10,000,000,000円。IPOできる大量生産の状態、2026-09-14 まさ）。オフサイトは将来のサイドビジネスとして、年間 30,000 m³・売価50,000円/m³（1Lあたり50円）で別に置く（仮置き、2026-09-14 まさ）。引き取る液の濃さも別に置く（仮置き 色素1,000mg/L・金属5,000ppm。オンサイトは色素50mg/L・金属50ppm。2026-09-14 まさ）。顧客工場1拠点あたり 100 m³/日 × 300 日/年 ＝ 30,000 m³/年で、約667社分。1バッチ100 m³、反応時間（HRT）4時間のバッチ運転。

**第1段：菌体は菌体の製造拠点で作る** — 顧客工場では培養せず、SX側でまとめて菌体を育て、濃縮して各工場へ運ぶ。年に作る量 ＝（年間処理量（オンサイト）× オンサイトで使い切る菌体量 ＋ 年間処理量（オフサイト）× オフサイトで使い切る菌体量）÷ 販売率（入力ではなく計算。2026-09-14 まさ）。今の明細を培養設備の1系列（年33,333kg、仮置き）として、年に作る量 ÷ 1系列 の数だけ並べ、1拠点に置く。乾燥菌体1kgあたりの原価は、「(設備の償却年額 ＋ 年ごとの固定費 ＋ 製造拠点の作業) ÷ 年に作る量 ＋ 菌体量に比例する費用」を販売率で割って出す。設備・固定費・系列ごとの作業（培養の運転・密閉性能検査・除菌フィルター交換）は系列の数だけ増え、拠点に1つの作業（安全委員会の運営など）は増えない。量産で設備や原料をまとめて買ったときの値下がりは入れていない。

**第2段：方式と装置を分けて比較する**

方式（どこで処理するか）
- **オンサイト** — 顧客工場の槽の横に、顧客が買ったリアクター（装置）を置いて処理する。処理の運転と、使用済み菌体の汚泥の処分は顧客がやる。装置を動かす消耗品・電力・点検・交換部品と、処理水の分析・薬剤も顧客が持つ（2026-09-14 まさ）。SXは菌体の搬入・搬出や交換で巡回する。槽は、既存調整タンクの流用でも新設でも顧客の設備
- **オフサイト** — 排液をタンクローリーでSX工場まで運び、SX工場に新設する槽で処理する。処理の運転はSXがやり、処理水はSX工場から流す。顧客工場への巡回と、顧客工場内の区画・立入制限は発生しない。代わりに、排液の輸送・受け入れ・放流の費用が乗る。設備・槽・装置の費用・汚泥の処分はSXが持つ。処理の運転は、循環カートリッジも直接投入もSXがやる

装置（菌体と排液をどう触れさせるか。どちらの方式でも選べる）
- **循環カートリッジ** — 菌体をカートリッジ内の保持モジュールに留め、排液を循環させて接触させる。モジュールは耐用バッチ数ごとに交換する
- **直接投入** — 菌体を槽へ直接投入して撹拌し、反応後に UF/MF 膜で菌体を分離回収する。膜は約3年で交換する

**槽** — オンサイトの槽は顧客の設備（既存調整タンクの流用でも新設でも）で、SXの原価に入らない（2026-09-14 まさ）。オフサイトは SX工場にコンクリート地下タンク100 m³（18,000,000円・10年償却）を新設する。用途ごとに、オンサイト2通り（装置2）とオフサイト2通り（装置2）の4シナリオになる。オンサイトの槽をSXが持つ形に変えると、既設（0円）／新設の2通りに戻る。

**使用済み菌体の後処理** — 金属回収は、SXが使用済み菌体を引き取って酸で溶かし、金属を回収する（SXの原価）。酸で溶かし中和・固液分離をする中央回収設備の初期投資も、使用済み菌体1kgあたりの償却として入れている（2026-09-15 から。見積は無い）。色素分解は使用済み菌体を脱水汚泥として処分し、オンサイトでは顧客がやる（SXの原価に入れない）。

**菌体の量** — 1バッチに要る菌体 ＝（流入の濃さ − 目標放流水濃度）÷ 取り込み効率。回収率は、処理のあと回収して次のバッチへ回せる菌体の割合として使い、使用回数（色素分解10回・金属回収1回）と組み合わせて、毎バッチ新しく入れる菌体を出す（菌体のバッチ間のマスバランス。中島先生 2026-08-28 のレビュー、2026-09-15 から）。回収できずに失う分と、使用回数を使い切って入れ替える分はこの量に入る。菌体の製造拠点で培養に失敗して作り直す分（培養ロス補充）は、別に菌体1kgの原価に入れている。金属の取り込み効率は24時間の単回試験の値で、反応時間4時間とはそろっていない。

**オンサイトの設備は独立プラント新設ではなく増分アドオン** — 顧客の既存調整タンク・排水ライン・ユーティリティ・主処理設備を使い、密閉接触・循環、菌体捕捉、回収サービスを足す（2026-07-23 確定）。このリアクターは顧客が買う（2026-09-14 まさ）。

**収益モデル** — 処理費のみ。売価はオンサイト500円/m³、オフサイト50,000円/m³（自社で処理しにくい液を引き取る値段）。回収物（金属など）の売却収入はまだモデルに入れていない。

**作業（人件費）** — 総コストに入れる（2026-09-13 まさ指示）。作業リストに、作業ごとの1回の工数・年間回数・1回の経費を置き、年額 ＝ 年間回数 ×（工数 × 作業単価 ＋ 経費）で積む。作業単価はすべての作業に共通の1つ（前提の「作業単価（共通）」、2026-09-14 まさ）。作業ごとに誰がやるか（SX / 顧客 / 処理する場所の人）を持ち、**SXの原価に入れるのはSXがやる作業だけ**。処理の運転は中島先生の試算にある手動運用の作業時間で置き、オンサイトでは顧客の作業（SXの原価にも作業時間にも入れない）、オフサイトではSXの作業とする（2026-09-14 まさ）。菌体の搬入・搬出、移動、モジュール・膜の交換、閉鎖系の検査や安全委員会も同じリストに並べる。作業は流れの段（菌体をつくる → 菌体を運ぶ／排液を運ぶ → 排液を処理する → 設備を保つ → 使用済み菌体を後処理する → 閉鎖系を管理する）の順に並べ、段ごとの年間工数を出す。', summary_md = 'SXの排液処理を、**菌体の製造原価**と**用途別の処理原価**の二段階で試算する。

**事業の規模は売上10,000,000,000円** — IPOできる大量生産の状態を前提に、年間処理量を20,000,000m³/年で置く（売価500円/m³で売上10,000,000,000円。2026-09-14 まさ）。顧客1社あたり年30,000m³なら約667社分。**オフサイトは、将来サイドビジネスとして足す形で、売価と年間処理量をオンサイトと別に置く**（仮置き 50,000円/m³＝1Lあたり50円・30,000m³/年。2026-09-14 まさ「ペインがあれば割高でも成立するから」）。引き取る液は顧客工場の排水より濃いので、対象物質の濃度もオフサイトだけ別に置く（仮置き 色素1,000mg/L・金属5,000ppm。2026-09-14 まさ「置いて」）。菌体の製造拠点で年に作る量は、色素分解が株によらず約2,855t、金属回収が自然株で約22,612t・強化株で約17,919t（強化株は金属の取り込み効率が高い）。

**第1段 菌体の製造原価** — 株（強化株／自然株）ごとに、菌体の製造拠点で乾燥菌体1kgをつくる原価を出す。菌体の製造拠点は、顧客工場では培養せず、SX側でまとめて菌体を育て、濃縮して各工場へ運ぶところ。**年に作る量は計算で出す**（（オンサイトの年間処理量 × オンサイトで使い切る菌体量 ＋ オフサイトの年間処理量 × オフサイトで使い切る菌体量）÷ 販売率）。今の明細を培養設備の1系列として必要な数だけ並べるので、設備・固定費・系列ごとの作業は1kgあたり変わらず、拠点に1つの作業だけが量で薄まる。同じ株なら、1kgあたりの原価は用途でほとんど変わらない（自然株で846.1円、強化株で色素分解 867.7円・金属回収 867.6円。2026-09-15 に培養の加温・電力・排水を足した）。菌体の量に比例する培養の原料（窒素源・リン源・CO2・水など）は、菌体の成分と公開の買値から「使う量 × 買値」で置いている（2026-09-14、菌体1kgあたり274.6円のうちCO2 114.5円・窒素源 90.8円）。強化株は閉鎖系の追加費用が乗る。生産した菌体のうち売れる割合（販売率）で割るので、売れ残りが出ると1kgあたりの原価は上がる。

**第2段 用途別の処理原価** — 第1段の原価を一定として、色素分解と金属回収のそれぞれで排水1m³あたりの総コストを出す。用途で変わるのは、必要な菌体の量（1バッチに要る菌体 ＝（流入の濃さ − 目標放流水濃度）÷ 取り込み効率 を、回収率と菌体使用回数から毎バッチ新しく入れる量にしたもの。2026-09-15 から）と、使用済み菌体の後処理（金属回収は中央回収設備の償却を含む）。対象物質の濃度はオフサイトだけ別に置くので、同じ用途でもオフサイトは使い切る菌体の量が多い（金属回収で約125倍、色素分解で約22倍）。菌体を使い回せるのは色素分解だけで、金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定する。色素分解は10回使い回す前提で置いている（2026-07の設備アドオン試算と同じ。杉浦先生に確認中）。

**方式と装置を分けて並べる** — 方式は、顧客工場で処理するオンサイトと、排液をSX工場まで運んで処理するオフサイトの2つ。装置は、菌体を筒に閉じ込めて排液を通す循環カートリッジと、菌体を槽に入れて混ぜ膜でこし取る直接投入の2つで、どちらの方式でも選べる。

**SXの原価に入れるのはSXがやる作業だけ** — 顧客工場での処理の運転は顧客がやる作業として、SXの原価にも作業時間にも入れない。オフサイトではSX工場でSXが運転するので、SXの原価に入る。

**顧客工場の設備・装置の費用と汚泥の処分は顧客が持つ** — 顧客工場に置くリアクター（処理設備）と槽は顧客が買い、装置を動かす消耗品・電力・点検・交換部品（循環カートリッジの菌体保持モジュールを含む）、処理水の分析と薬剤、顧客工場で出る使用済み菌体の汚泥の処分も顧客が持つ（2026-09-14 まさ）。いずれもSXの原価に入れない。オンサイトでSXの原価に残る現場の費用は、菌体を運ぶ巡回と容器（回収できずに失う菌体の補充は、2026-09-15 から菌体費に入る）、モジュールや膜の交換の作業、立入制限と教育訓練（強化株）。明細ごとに誰が持つか（SX / 顧客 / 処理する場所の持ち主）を持ち、画面で変えられる。SX工場で処理するオフサイトでは、設備・槽・装置の費用・汚泥の処分はSXが持つ。

操作パネルで株・用途・方式・装置を切り替え（開いたときは自然株）、前提・作業リスト・明細の数字を書き換えると、結果がその場で再計算される。前提・作業リスト・明細は「事業と処理の条件」「CAPEX（初期投資）」「OPEX（毎年の費用）」の3つに分け、その中を小分けにして並べる。作業単価はすべての作業に共通の1つ。選んだ組み合わせで使わない前提・作業・明細は薄く出る。結果の欄には総コストの内訳を棒グラフで出し、操作パネルの一番上には作業の流れと段ごとの年間工数を出す。書き換えた数字は保存されない。正本へ書くのは、管理者が「この値を保存」を押したときだけ。

ちこ作成の260820版の明細を土台に、2026-09-13に二段階へ組み替えた。人件費・巡回サービス・閉鎖系の追加費用・色素用の後処理・色素の濃さを追加し、いずれも確度つきで置いている。同日、人件費を作業リスト（作業ごとの工数 × 作業単価）で持つ形に変え、販売率を足した。さらに同日、作業を流れの段に並べ直し、オフサイトの比較を足した。2026-09-14 に、方式（オンサイト / オフサイト）と装置（循環カートリッジ / 直接投入）を分け、作業ごとに誰がやるかを持たせた。同日、色素分解の菌体使用回数を10回にし、顧客工場のリアクター・槽と汚泥の処分を顧客が持つ形にした。同日、年間生産能力を入力から外し、年間処理量（売上10,000,000,000円に届く20,000,000m³/年）から年に作る量を計算する形にした。同日、作業単価をすべての作業に共通の1つにし、前提・作業リスト・明細を「事業と処理の条件 / CAPEX / OPEX」の区分に並べ直した。同日、上端の槽の表示を外し、選んだ組み合わせで使わない前提を薄く出すようにした。同日、顧客工場の装置の消耗品・電力・点検・交換部品を顧客の持ち分にし、オフサイトの循環カートリッジの処理の運転をSXの作業にした。同日、金額をカンマ区切りの円にそろえた（10,000,000,000円の形。億・万で丸めない）。同日、オフサイトの売価と年間処理量をオンサイトと別の前提に分けた。', updated_at = now() where cost_model_id = 'cm_p21_260820';
update project_cost_notes set body_md = '色素分解ケースの対象物質の濃度（50mg/L）、取り込み効率（0.05g/g）、菌体使用回数（10回）、脱水後の湿重量倍率（5倍）は、いずれも実測ではない。

特に**菌体使用回数**と**菌体回収率**（次のバッチへ回せる菌体の割合）は総コストへの効き方が大きい。いまの10回・回収率90%で139.3円/m³の総コストが、1回（使い捨て）なら821.4円/m³、回収率98%なら104.6円/m³になる（強化株・オンサイト・直接投入、2026-09-15 の前提）。目標放流水濃度（5mg/L）も仮置き。10回は、2026-07の設備アドオン試算（色素分解は培養液を10回使い回し、運転ロス2%）と同じ前提。', updated_at = now() where cost_note_id = 'cn2_c9';
update project_cost_notes set body_md = '色素分解の菌体使用回数と菌体回収率だけを動かしたときの総コスト（円/m³、2026-09-15 の前提）。他の前提は据え置き（オンサイト・直接投入。処理の運転・汚泥の処分・装置の消耗品や電力は顧客、リアクターと槽は顧客が買う）。

| 株 | 菌体使用回数 | 色素分解 オンサイト・直接投入（回収率90%） |
|---|---|---|
| 強化株 | 1回 | 821.4 |
| 強化株 | 10回（いまの前提） | 139.3 |
| 強化株 | 30回 | 89.4 |
| 自然株 | 1回 | 800.7 |
| 自然株 | 10回（いまの前提） | 135.0 |
| 自然株 | 30回 | 86.1 |

| 株（使用回数10回） | 回収率80% | 90%（いまの前提） | 95% | 98% | 100% |
|---|---|---|---|---|---|
| 強化株 | 194.7 | 139.3 | 116.6 | 104.6 | 97.3 |
| 自然株 | 189.1 | 135.0 | 112.9 | 101.1 | 94.0 |

2026-09-15 から、回収率は処理のあと次のバッチへ回せる菌体の割合として使う（中島先生 2026-08-28 のレビュー）。毎バッチ新しく入れる菌体 ＝ 1バッチに要る菌体 ×（1 − 回収率）÷（1 − 回収率^使用回数）なので、**菌体費が使用回数に反比例するのは回収率が100%のときだけ**。回収率90%では使い回すたびに1割を失うので、使用回数を10回から30回にしても新しく入れる菌体は約32%しか減らず、回収率を98%に上げる方が効く。旧版では菌体の製造拠点の設備償却が使用回数に連動しない固定額だったため、10回を超えると頭打ちになっていた（二段階版で直した）。

いまの10回は、2026-07の設備アドオン試算（色素分解は培養液を10回使い回し、運転ロス2%）と同じ前提（2026-09-14 まさ）。杉浦先生へは引き続き「10回を超えるか」を、中島先生へは「次のバッチへ回せる菌体の割合」を確認する。金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定している（回収率は効かない）。', updated_at = now() where cost_note_id = 'cn_260820_r3';
update project_cost_notes set body_md = '乾燥菌体1kgの原価は、菌体の製造拠点の費用を、年に作る菌体の量で割って出す。

**年に作る量は計算で出す**（2026-09-14 まさ「年間の生産能力は入力値じゃなくて計算結果にしてほしい」）。年に作る量 ＝（年間処理量（オンサイト）× 排水1m³あたりに使い切る菌体量 ＋ 年間処理量（オフサイト）× 引き取る液1m³あたりに使い切る菌体量）÷ 販売率。オンサイトは、IPOできる規模として売上10,000,000,000円に届く20,000,000m³/年で置いている（売価500円/m³）。オフサイトはサイドビジネスとして30,000m³/年（仮置き）を足し、引き取る液の濃さ（仮置き 色素1,000mg/L・金属5,000ppm）で使い切る菌体量を出す。用途ごとに、その用途だけでこの量を処理したときとして計算する（2026-09-15 の前提で、色素分解は株によらず約2,855t/年、金属回収は自然株で約22,612t/年・強化株で約17,919t/年）。

**設備は系列を並べて増やす**。今の明細（培養設備一式・濃縮・保管、強化株は閉鎖系の追加）を1系列とし、1系列で年33,333kgを作れる前提（仮置き）で、年に作る量をこの量で割った数だけ系列を並べる（自然株で色素分解 約86系列・初期投資 約747,800,000円、金属回収 約678系列・約5,922,100,000円。強化株は閉鎖系の追加で1系列が高く、色素分解 約86系列・約944,800,000円、金属回収 約538系列・約5,929,400,000円）。設備の初期投資・年ごとの固定費・系列ごとの作業（培養の運転、密閉性能検査、除菌フィルター交換）は系列の数だけ増えるので、1kgあたりは変わらない。拠点に1つの作業（安全委員会の運営など）だけが、作る量が増えるほど1kgあたり薄まる。量産で設備や原料をまとめて買ったときの値下がりは入れていない。

**販売率**（既定100%）は、作った菌体のうち売れる割合。下げると、売る量を確保するために作る量が増え、系列ごとの費用と菌体量に比例する費用が増える。

1系列の年間生産能力（33,333kg/年）は、旧版が暗黙に置いていた「必要な菌体量＝生産量」を引き継いだ仮置き。培養液1Lあたりの1日の増殖量と1系列の培養容積が分かるまで確定しない。', updated_at = now() where cost_note_id = 'cn_260820_c4';
update project_cost_notes set body_md = '**オフサイト**は、顧客工場の排液をタンクローリーでSX工場まで運び、SX工場で処理する形。

- 装置はオンサイトと同じ2つ（循環カートリッジ / 直接投入）から選ぶ。槽はSX工場に新設する（新設槽と同じ18,000,000円・10年償却）
- 処理の運転はSX工場でSXがやるので、SXの原価に入る。オンサイトでは同じ運転を顧客がやり、SXの原価に入らない
- 顧客工場へ菌体を運ぶ巡回と、顧客工場内の区画・立入制限は発生しない。菌体は同じSX工場で作って使う。強化株を使っても、組換え体を扱うのはSX工場の中だけになる
- 代わりに、排液の輸送（輸送の回数 ＝ 年間処理量 ÷ 1台の積載量）、受け入れ設備と受入検査、処理水の放流費と放流前の水質確認が乗る
- 輸送・受け入れ・放流の数字は、見積のない仮置き（確度H）
- 1社分の排液だけを処理する前提。複数の顧客の排液をまとめて処理したときに、設備と槽の償却が薄まる効果は入れていない
- 売価と年間処理量はオンサイトと別に置く（2026-09-14 まさ「オフサイトは売価も処理量も別に分けて試算したい」）。将来のサイドビジネスとして、自社で処理しにくい液を引き取る形を想定し、仮置きで売価50,000円/m³（1Lあたり50円）・年間処理量30,000m³/年（SX工場1か所分）。総コスト目標はオンサイトにだけ当てる
- 引き取る液の濃さは、顧客工場の排水と別に置く（仮置き 色素1,000mg/L・金属5,000ppm。2026-09-14 まさ「置いて」）。菌体の量は取り除く濃さ（引き取る液の濃さ − 目標放流水濃度）に比例するので、金属5,000ppmでは使い切る乾燥菌体が1m³あたり約94kg（強化株）〜約119kg（自然株）と液の重さの約1割になり、菌体費が総コストの大半になる（2026-09-15 の前提で、強化株・直接投入の総コスト約90,844円/m³、うち菌体費 約81,686円/m³・後処理 約3,648円/m³・中央回収設備の償却 約2,669円/m³。自然株は約111,322円/m³。どちらも売価の50,000円/m³を超える。工場の排熱・排ガス・排液を使えば、強化株 約24,433円/m³・自然株 約27,517円/m³で売価の内）。この濃さを菌体で処理できるかは確認が要る
- 顧客の排液を運んで処理するときに要る許可（産業廃棄物の収集運搬業・処分業）の費用と期間は入れていない。要否は確認が要る。特別管理産業廃棄物（pH2.0以下の廃酸、pH12.5以上の廃アルカリ、有害な金属などを基準より多く含む液）を受けるなら、特管の許可が普通の産廃とは別に要る。菌体での処理が特管の処分の方法として認められるか、処理したあとの菌体（汚泥）が基準を超えて特管のままになるかも、確認が要る
- 2026-09-14 に調べた範囲（Drive `p21_sol/260914_オフサイト廃液処理の検証`）: 特管の廃酸・廃アルカリの処分は環境大臣が定める方法（環境省の概要では中和・焼却・イオン交換設備等での再生）で行うので、菌が働けるのは中和の後になる。1日100m³を処理するなら、中和施設（1日50m³超）が施設の設置許可（廃棄物処理法施行令第7条第6号）の対象になる。愛媛県で出る特管の廃酸・廃アルカリは環境省の推計で年約4,900t、四国4県で約13,000t', updated_at = now() where cost_note_id = 'cn4_c11';
update project_cost_notes set body_md = '強化株の閉鎖系費用は、判定が確定していないため**カテゴリー1相当**で積んでいる。

**GILSP**と判定されれば、排気の除菌フィルター（設備と交換）、培養設備と現場設備の密閉性能検査、処理水の不活化は、法令上は求められない可能性がある。作業区域の区画・表示、区別保管、廃液の扱い、教育訓練は、GILSPでも必要。

この切り分けで外れる可能性がある額は、強化株・オンサイト・直接投入で色素分解 約1.6円/m³、金属回収 約8.9円/m³（菌体の製造拠点の分だけ。2026-09-15 の前提）。顧客工場の処理設備の除菌フィルター・密閉性能検査・処理水の不活化は顧客が持つので、この額に入らない。SX工場で処理するオフサイトでは、色素分解 約43.9円/m³、金属回収 約1,113.6円/m³（製造拠点の分が、引き取る液の濃さで使い切る菌体量に比例して増える）。', updated_at = now() where cost_note_id = 'cn2_c7';
update project_cost_notes set body_md = '- **回収物の売却収入がモデルに1円も入っていない。** 収入は処理費500円/m³のみ。レアアース回収などのアップサイドが数字として表現できていない
- **菌体の製造拠点を何箇所に分けるかは決めていない。** 年間処理量（売上10,000,000,000円に届く20,000,000m³/年）から、顧客数（約667社）、年に作る菌体の量と培養設備の系列数は出している。系列はすべて1拠点に並べる前提で、拠点を分けたときに増える費用と、顧客工場までの移動が短くなる効果は入っていない
- **量産で安くなる効果は、拠点に1つの費用が薄まる分だけ。** 設備や原料をまとめて買ったときの値下がりは入れていない。菌体1kgの原価（強化株 約868円。2026-09-15 に培養の加温・電力・排水を足した）は、2026-07の設備アドオン試算の量産目標（1,500円/kg）の約6割。培養の原料は菌体の成分と公開の買値から置いたが（2026-09-14）、設備の単価と1系列の量は仮置き。1,500円/kgを上書き値に入れると、強化株・オンサイト・直接投入で色素分解 約227円/m³、金属回収 約1,226円/m³（2026-09-15 の前提）
- **オフサイトの前提は仮置き。** 排液を運ぶ費用・受け入れ設備・放流費には見積がない。顧客の排液を運んで処理するときの許可（産業廃棄物の収集運搬・処分）にかかる費用と期間は入っていない
- **閉鎖系の追加費用と巡回サービスは仮置き。** 金額の根拠となる見積がまだない（二段階版で追加）
- **色素側の数字は実測がない。** 色素の濃さ・取り込み効率・菌体使用回数・使用済み菌体の含水率は文献相場か仮置き', updated_at = now() where cost_note_id = 'cn_260820_h2';
update project_cost_notes set body_md = '中島先生の回答④。寿命は「ハウジング」「菌体保持膜」「菌体そのものの吸収可能回数」の3層を別々に扱う必要がある。

**菌体そのものの寿命は、2026-09-15 から前提「菌体使用回数」（同じ菌体を何バッチ使ったら入れ替えるか）として扱い、処理のあと回収できずに失う分を前提「菌体回収率η」として、菌体のバッチ間のマスバランスにまとめた**（中島先生 2026-08-28 のレビュー「Mnext＝Mrecovered×活性残存率」「菌体マスバランス表を1つ作ると一気に整理できます」）。毎バッチ新しく入れる菌体 ＝ 1バッチに要る菌体 ×（1 − η）÷（1 − η^使用回数）。活性残存率は、使用回数に達するまで100%、達したら0%（入れ替える）と置いている。それまで別に置いていた明細「菌体ロス補充分」「菌体性能低下による交換・再生分」は、この量と重なるので0円にした。

技術的に何回いけるかが分かっても、それだけでは決まらない。**再生コスト（色素を外す洗浄の工程。未計上）と新規培養コスト（菌体の製造拠点の設備）が揃ってはじめて「何回使うのが得か」が決まる**。

使い回しを考えるのは色素分解だけ。金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定している（2026-09-13 まさ）。', updated_at = now() where cost_note_id = 'cn_260820_c1';
update project_cost_notes set body_md = '金属回収の後処理（酸・洗浄水・中和剤・残渣処分・廃液処理で乾燥菌体1kgあたり約39円）は、260820版の値を換算したもので、酸や廃液の量の根拠は確認できていない。

色素分解の後処理（使用済み菌体を汚泥として処分。乾燥菌体1kgあたり約175円）は、脱水後の湿重量と汚泥の処分相場から積んだ。オンサイトでは顧客工場で出る汚泥として顧客が処分するので、SXの原価に入れない（2026-09-14 まさ）。SX工場で処理するオフサイトだけに乗る。

**同じ精度で比べられていない。** 金属側は、酸で菌体を溶かした後の廃液量によっては上がる可能性が高い。

**金属回収の中央回収設備（酸で溶かし中和・固液分離をする設備）の初期投資**は、2026-09-15 に使用済み菌体1kgあたり28.35円の償却として足した（中島先生 2026-08-28 のレビュー「中央回収設備として別CAPEX化」）。見積は無く、ドイツ・ハンブルクの焼却灰を酸で処理するプラント（TetraPhos）の額と処理量で置いた仮置き。', updated_at = now() where cost_note_id = 'cn2_c10';
update project_cost_notes set body_md = '- **第1段 菌体の製造原価** — 株ごとに、乾燥菌体1kgをつくる原価。年に作る量は年間処理量から計算し、培養設備を系列の数だけ並べる。培養設備の償却・年ごとの固定費・製造拠点の作業・菌体量に比例する費用に分け、販売率で割って見る
- **菌体費** — 第1段の原価 × 排水1m³あたりに使い切る菌体量
- **運ぶ（巡回・輸送）** — オンサイトは顧客工場への菌体の搬入・搬出と移動、オフサイトは排液の輸送。作業リストの工数・経費と、共通の作業単価で動かす
- **運転・保守・管理** — SXがやる、運ぶ以外の作業（オフサイトの処理の運転、モジュールや膜の交換、閉鎖系の管理など）
- **顧客がやる作業** — オンサイトの処理の運転など。SXの原価にも作業時間にも入れない
- **顧客が持つ明細** — オンサイトのリアクター（処理設備）と槽、装置を動かす消耗品・電力・点検・交換部品、処理水の分析と薬剤、汚泥の処分。SXの原価に入れない（明細の「誰が持つか」で変えられる）
- **使用済み菌体の後処理** — SXが持つ後処理。金属回収は酸処理。色素分解の汚泥の処分は、オンサイトでは顧客が持つので入らない（オフサイトだけ）
- **消耗品・電力・放流など** — オンサイトは菌体を運ぶ容器だけ（回収できずに失う菌体の補充は、2026-09-15 から菌体費に入る）。オフサイトは、SX工場の装置の消耗品・電力・点検・交換部品、処理水の分析と薬剤、放流費
- **設備と槽の償却** — SXが持つ処理設備と槽、金属回収の中央回収設備（2026-09-15 から）の初期投資 ÷ 耐用年数。オンサイトのリアクターと槽は顧客が買うので入らない（オフサイトはSX工場の設備と槽）
- **うち閉鎖系の追加** — 強化株のときだけ乗る費用。上の区分に含まれている分を、第1段の分と合わせて出す
- **総コスト** — 売価（オンサイト500円/m³、オフサイト50,000円/m³）に対して成立するか。総コスト目標はオンサイトにだけ当てる
- **オンサイトの年間 / オフサイトの年間** — 選んだ方式の年間処理量と売価での売上・総コスト・利益。顧客1社の年間を、顧客の数だけ足したもの', updated_at = now() where cost_note_id = 'cn_260820_r1';
update project_cost_notes set body_md = 'まさ 2026-09-15「顧客の工場のCO2と排熱、排ガスをフル活用してやる方向も見えてくる」（まさ「うん、進めて」）

**培養の加温・電力・排水は、これまで1円も入っていなかった**（426 で培養の原料を組み直したときからの積み残し）。入れないと「工場の排熱を使う価値」を数字にできないので、3行を足した。あわせて加温・保温の設備（CAPEX）も足した。

| 円/m³（自然株・オンサイト・直接投入） | 入れる前 | 入れた後 | 排熱 ON | 排熱＋排ガス＋排液 |
|---|---|---|---|---|
| 金属回収（売価500円/m³） | 528.3 | 1,233.8 | 594.9 | 300.7 |
| 色素分解（目標300円/m³） | 54.2 | 113.5 | 59.8 | 35.1 |

**受光面積**: 年20,000,000m³の排水を処理する菌体には約 667 系列が要るので、受光面積は約 3.0 km²（296 ha）。

**なぜ加温が重い**: SX の株は好熱性で、運転温度は45〜70℃（技術台帳「培養温度」。試作の47L装置にもヒーターが付いている）。光を通す面は断熱材で覆えないので、熱が逃げる。1系列の受光面積 約4,444 m²、二重の覆いで 3 W/m²K、培養45℃ − 外の年平均15℃ ＝ 30K として熱損失は約400kW（年10,400GJ ＝ 菌体1kgあたり約311MJ）。そのうち日射（年平均 約190 W/m² × 受光面積 ＝ 約840kW）でまかなえる分を70%とし、残りの93 MJ/kg-DCW を買う熱とした。

**ここがいちばん確度が低い**: 季節と昼夜の収支を計算していない。夏は余って冷やす側、冬と夜は足りない。大きな水の塊なので一晩では冷めにくいが、夜の熱損失だけで培養液が30K近く下がる計算になるため、覆いの断熱・夜間の保温・季節ごとの運転の止め方をどう置くかで、この行は数倍動く。

**排熱の相性**: 工場の排熱（蒸気のドレン・冷却水・排ガスの熱）は、ちょうど45〜70℃の温度帯。「排熱利用可能」を ON にすると加温の熱が0円になる。熱を受ける熱交換器は CAPEX の行に残る（排熱でも設備は要る）。', updated_at = now() where cost_note_id = 'cn17_h17';
insert into project_cost_notes (cost_model_id, cost_note_id, section, title, body_md, source_url, source_label, visibility, sort_order) values ('cm_p21_260820', 'cn18_c12', 'caveat', '金属の取り込み効率は24時間の値で、反応時間4時間とそろっていない', '金属回収の取り込み効率（自然株 0.042・強化株 0.053 g/g菌体）は、2026-09-02 定例で報告された単回試験で、**24時間後**に取り込んだ量から置いている。一方、試算の反応時間（循環カートリッジ・直接投入の電力に使う）は**4時間**で、4時間の時点の取り込み量は測っていない（2026-09-15 確認。ちこさん「HRT4hとの整合だけ確認」）。

- 4時間で24時間の半分しか取り込めなければ、使い切る菌体は2倍になる。自然株・オンサイト・直接投入の総コストは 913.2 → 1,788.0円/m³（工場の排熱・排ガス・排液を使うときは 241.4 → 444.5円/m³）
- 1日1バッチの前提なので、反応を24時間にする手もある。そのときは装置の電力が6倍になる（オンサイトの電力は顧客が持つので、SXの原価に効くのはオフサイトだけ）
- 技術検証では、強化株1の鉄の取り込みを同じ条件で2〜3回くり返し、ばらつきと半減期を求めることが次の検証に挙がっている。杉浦先生へ、そのときに4時間の時点も測れるかを確認事項に足した', null, null, 'amd_internal', 120);
insert into project_cost_notes (cost_model_id, cost_note_id, section, title, body_md, source_url, source_label, visibility, sort_order) values ('cm_p21_260820', 'cn18_h18', 'history', '回収率を次のバッチへ回す割合にし、目標放流水濃度と金属回収の中央回収設備を足した（2026-09-15）', 'ちこさん 2026-09-15「旧試算の未解決ロジックをそのまま引き継いでいる箇所がいくつかありそう」。中島先生 2026-08-28 のレビュー（Drive `p21_sol/コスト試算/中島先生資料_260828_コスト試算表の改善点.docx`）の指摘のうち、この試算に入っていなかった3つを入れ、1つを確かめた。

1. **回収率は次のバッチへ回す量に使う**（レビュー「回収率と初回必要投入量が混同されている」）。1バッチに要る菌体を回収率で割るのをやめ、毎バッチ新しく入れる菌体 ＝ 1バッチに要る菌体 ×（1 − 回収率）÷（1 − 回収率^使用回数）とした。レビューの「菌体ロスが二重計上の可能性」に合わせ、この量と重なる明細「菌体ロス補充分」「菌体性能低下による交換・再生分」（循環カートリッジと直接投入で計4行）を0円にした（前の額は各行の説明）。培養ロス補充は菌体の製造拠点で作り直す分なので残した
2. **金属の取り込み効率は24時間の値**（ちこさん「HRT4hとの整合だけ確認」）。4時間の値は無く、そろっていない。数字は変えず、根拠に書き、杉浦先生への確認事項に足した（注記「金属の取り込み効率は24時間の値で、反応時間4時間とそろっていない」）
3. **金属回収の中央回収設備の CAPEX**（レビュー「金属回収設備CAPEXがない」「中央回収設備として別CAPEX化」）。1系列の初期投資 5,670,000,000円・10年・年20,000t の仮置きで、使用済み菌体1kgあたり28.35円の償却（ドイツ・ハンブルクの TetraPhos の額と処理量）
4. **目標放流水濃度 Cout**（レビュー「(Cin−Cout)×水量に変更」）。金属 10ppm（一律排水基準の溶解性鉄）、色素 5mg/L（脱色率90%の目標）の仮置き

| 円/m³（オンサイト・直接投入） | 前 | 回収率を次のバッチへ | ＋目標放流水濃度 | ＋ロスの明細を0円 | ＋中央回収設備（後） | 工場の排熱・排ガス・排液を使う（前 → 後） |
|---|---|---|---|---|---|---|
| 自然株 金属回収 | 1,233.8 | 1,114.2 | 899.1 | 886.2 | **913.2** | 300.7 → **241.4** |
| 強化株 金属回収 | 1,009.5 | 912.5 | 738.0 | 727.8 | **749.2** | 270.1 → **216.8** |
| 自然株 色素分解 | 113.5 | 150.2 | 136.9 | 135.0 | **135.0** | 35.1 → **37.6** |
| 強化株 色素分解 | 117.2 | 154.8 | 141.2 | 139.3 | **139.3** | 38.8 → **41.9** |

- **金属回収は下がり、色素分解は上がった**。使い捨ての金属回収は、回収率で割らなくなった分（1割）と、取り除く濃さが 50 → 40ppm になった分（2割）だけ菌体が減った。10回使い回す色素分解は、使い回すたびに1割を失う分を足したので、新しく入れる菌体が、前の式の1バッチに要る量の11.1%（÷ 0.9 ÷ 10）から15.4%に増えた（取り除く濃さが 50 → 45mg/L になった分は下がる）
- 年に作る菌体は、色素分解 約2,289t → 約2,855t、金属回収 自然株 約30,423t → 約22,612t・強化株 約24,109t → 約17,919t
- オフサイト・直接投入（自然株）: 金属回収 121,654.7 → 111,322.5円/m³（うち中央回収設備の償却 約3,368円/m³。引き取る液の濃さで使い切る菌体 約119kg/m³ に比例する）、色素分解 5,126.9 → 5,947.6円/m³
- 確認事項を足した: 杉浦先生（4時間の時点の取り込み量）、中島先生（次のバッチへ回せる菌体の割合、中央回収設備の構成）、ダイキアクシス（中央回収設備の概算）', null, null, 'amd_internal', 180);
update project_cost_questions set why_it_matters = '菌体使用回数は総コスト最大の感度。1回のままだと菌体の製造原価がそのまま効く。2026-09-15 から回収率（次のバッチへ回せる菌体の割合、いまは90%）と組み合わせて数えるので、新しく入れる菌体は1バッチに要る量の、10回で15.4%、20回で11.4%、50回で10.1%になり、20回を超えるとほとんど変わらない（回収率の方が効く）。「10回を超えるか」だけ言い切れれば足りる。まさの記憶では数十回いける可能性があるが2026-08-23時点で未確認。 2026-09-14 から10回で置いている（2026-07の設備アドオン試算と同じ前提）。1回しか使えなければ、強化株・オンサイト・直接投入の総コストは139.3円/m³から821.4円/m³へ上がる（2026-09-15 の前提）。', impact_low = 50, impact_high = 682, updated_at = now() where cost_question_id = 'cq_260820_01';
update project_cost_questions set why_it_matters = '色素分解の後処理は「脱水後の湿重量 × 処分単価」で積んでいる。2026-09-14 から、オンサイトでは顧客工場で出る汚泥として顧客が処分する前提にしたので、SXの原価に効くのはSX工場で処理するオフサイトだけ（2026-09-15 の前提で約534.7円/m³。引き取る液の色素の濃さ1,000mg/L・回収率90%・使用回数10回のとき）。', impact_high = 535, updated_at = now() where cost_question_id = 'cq2_02';
update project_cost_questions set why_it_matters = 'オフサイトの色素分解の総コストでいちばん大きいのが排液を運ぶ費用（いまの仮置きで約2,000円/m³）。金属回収は、引き取る液の濃さで使い切る菌体の費用（2026-09-15 の前提で強化株 約81,686円/m³）の方が大きい。積載量が2倍になれば半分になる。', updated_at = now() where cost_question_id = 'cq4_01';
update project_cost_questions set why_it_matters = '培養・濃縮の運転の工数は空欄（0時間）で数えている。1日2時間なら1系列あたり年600時間で、菌体1kgの原価が約72円上がる（1系列33,333kg、作業単価4,000円。培養設備の系列ごとの作業なので、系列の数だけ時間も増える）。総コストは、オンサイトの色素分解（使用回数10回）で約9.9円/m³、金属回収（強化株）で約54.3円/m³上がる（2026-09-15 の前提。オフサイトは引き取る液の濃さに比例して大きい）。', impact_high = 54, updated_at = now() where cost_question_id = 'cq4_04';
update project_cost_questions set question = '年間処理量がオンサイト20,000,000m³（売上10,000,000,000円）とオフサイト30,000m³のとき、菌体の製造拠点を何箇所に分けるかを決める。いまは培養設備の系列（2026-09-15 の前提で、色素分解で約86、金属回収で自然株 約678・強化株 約538）をすべて1拠点に並べる前提で計算している。', updated_at = now() where cost_question_id = 'cq_260820_16';
update project_cost_questions set why_it_matters = '産業廃棄物として引き取る液は、顧客工場の排水の濃さ（50mg/L・50ppm）より濃いものが多い見込み（推測）。菌体の量は濃さに比例するので、金属回収・自然株で5,000ppmなら乾燥菌体が1m³あたり約119kg要る計算になる（2026-09-15 の前提。目標放流水濃度10ppmを引き、回収率では割らない）。処理できる濃さが、オフサイトで引き取れる液と売価を決める。オフサイトで引き取る液の濃さは、仮置きで色素1,000mg/L・金属5,000ppmを置いている（前提「対象物質の濃度（色素・オフサイト）」「対象物質の濃度（金属・オフサイト）」）。', updated_at = now() where cost_question_id = 'cq11_02';
update project_cost_questions set why_it_matters = '菌体の製造原価は自然株で846.1円/kg-DCW（強化株は色素分解 867.7円・金属回収 867.6円。2026-09-15 に培養の加温・電力・排水を足した後）。うち培養の原料は、菌体の成分（炭素・窒素・リン）と公開の買値から置いた菌体1kgあたり274.6円で、培地の組成とCO2の入れ方が分かれば置き換えられる（2026-09-14）。閉鎖系スピルリナの商用実績$2.57〜5.10/kg（約390〜770円/kg）より高い（好熱性の株を45〜70℃に保つ加温の熱が、菌体1kgあたり460円と重い）。円で聞いても答えは出ないので、量と条件だけをもらってAMD側で円へ変換する。', updated_at = now() where cost_question_id = 'cq_260820_02';
insert into project_cost_questions (cost_model_id, cost_question_id, addressee, question, why_it_matters, impact_low, impact_high, status, linked_assumption_id, visibility, sort_order) values ('cm_p21_260820', 'cq18_01', '杉浦先生', '鉄を取り込む速さを教えてください。9/2の単回試験は24時間後の値でした。反応を始めてから4時間の時点で、50ppmのうちどれくらい取り込んでいそうですか。①ほぼ全部 ②半分くらい ③1割くらい ④まだ分からない。次のくり返しの試験で、4時間の時点の量も測れますか。', '金属回収の取り込み効率（自然株 0.042・強化株 0.053 g/g菌体）は24時間の値で、試算の反応時間（循環カートリッジ・直接投入とも4時間）とそろっていない（2026-09-15 ちこさん指摘）。4時間で半分しか取り込めなければ使い切る菌体が2倍になり、自然株・オンサイト・直接投入の総コストは 913.2 → 1,788.0円/m³。1日1バッチなので反応を24時間にする手もあり、そのときは装置の電力が6倍になる（SXの原価に効くのはオフサイトだけ）。', 0, 875, 'open', 'ca_uptake_alpha', 'amd_internal', 205);
insert into project_cost_questions (cost_model_id, cost_question_id, addressee, question, why_it_matters, impact_low, impact_high, status, linked_assumption_id, visibility, sort_order) values ('cm_p21_260820', 'cq18_02', '中島先生', '処理のあと、菌体をどれくらい回収して次のバッチへ回せますか。循環カートリッジと直接投入のそれぞれで、感触としてどれに近いですか。①99%以上 ②95%くらい ③90%くらい ④80%以下 ⑤まだ分からない。', '2026-09-15 から、回収率は次のバッチへ回せる菌体の割合として使っている（先生の 2026-08-28 のレビュー「回収率は「次バッチへ再利用できる量」に使用」）。10回使い回す色素分解では、新しく入れる菌体が1バッチに要る量の、90%で15.4%、95%で12.5%、99%で10.5%になり、強化株・オンサイト・直接投入の総コストは 90%で139.3円/m³、95%で116.6円/m³、80%で194.7円/m³。2026-07 の設備アドオン試算は運転ロス2%（98%）で置いていた。使用回数1回の金属回収には効かない。', 42, 55, 'open', 'ca_recovery_eta', 'amd_internal', 15);
insert into project_cost_questions (cost_model_id, cost_question_id, addressee, question, why_it_matters, impact_low, impact_high, status, linked_assumption_id, visibility, sort_order) values ('cm_p21_260820', 'cq18_03', '中島先生', '金属回収で、集めた使用済み菌体を1か所で酸で溶かして金属を取り出す設備（中央回収設備）に、どんな機械が要りますか。①酸で溶かす槽（1回に乾燥菌体何kgを、何時間で溶かせるか）②中和と固液分離の機械（フィルタープレスなど）③溶かした液から金属を取り出す方法（沈殿・電解・溶媒抽出など）④酸の霧や廃液の処理。まだ決まっていなければ、まだ分からないと答えてください。', '先生の 2026-08-28 のレビュー「中央回収設備として別CAPEX化」を受けて、2026-09-15 に中央回収設備の初期投資を足した。見積が無いので、ドイツ・ハンブルクの焼却灰を酸で処理するプラント（TetraPhos、年20,000t・約31,500,000ユーロ）の額で置いた仮置き（1系列 5,670,000,000円・10年、使用済み菌体1kgあたり28.35円）。自然株・オンサイト・直接投入で27.0円/m³、オフサイトは引き取る液が濃いので約3,368円/m³。構成が分かれば、プラントメーカーに概算を頼める。', 0, 27, 'open', 'ca18_recovery_facility_capex', 'amd_internal', 215);
insert into project_cost_questions (cost_model_id, cost_question_id, addressee, question, why_it_matters, impact_low, impact_high, status, linked_assumption_id, visibility, sort_order) values ('cm_p21_260820', 'cq18_04', 'ダイキアクシス', '使用済み菌体（乾燥重量）を年20,000t、酸で溶かし、中和と固液分離をして金属を取り出す設備を1か所に作るとすると、初期投資はどれくらいになりそうですか。①1,000,000,000円より少ない ②1,000,000,000〜5,000,000,000円 ③5,000,000,000円より多い ④構成が決まらないと分からない。', '中央回収設備の初期投資は、見積が無いので、ドイツの焼却灰の酸処理プラントの額（1系列 5,670,000,000円、年20,000t）で置いている。この額が半分なら、自然株・オンサイト・直接投入の総コストは13.5円/m³、オフサイトは約1,684円/m³下がる。', 0, 27, 'open', 'ca18_recovery_facility_capex', 'amd_internal', 216);

commit;
