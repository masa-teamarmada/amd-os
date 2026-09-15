-- 436: SOL（p21）「工場の排液を培地に使える」の条件から「色が付いていない」を外し、薄める倍率で置き直す
-- （まさ 2026-09-15「色がついてなきゃいけない理由がわからん」）
--
--   - 排液のスイッチの説明: 「色が付いていない」→ 窒素の濃さで薄める倍率が決まり、色も同じだけ薄まる、へ
--     しきい値は培養液の窒素 約400mg/L。これに届かない排液は薄める余地が無く色が残る（味噌 全窒素150mg/L）
--     実例として佐賀市下水浄化センターの3倍希釈（国交省 B-DASH、上水・試薬と同等）を入れた
--   - 排ガスのスイッチの説明に、窒素酸化物（NOx）の話を足す
--     （まさ「NOxが栄養源になった、という話は過去に出てきてた」。取り込むのは事実だが、
--      CO2/NOx の比が250〜2,000に対し菌体の C/N が約7.3なので、窒素の必要量の0.4〜3%にしかならない）
--   - 培地の原料6行の「着色排水は光が通らないので使えない」の一文を直す
--   - 技術台帳のオカベ排液4件の「エサ」という読み方を取り消す
--     （まさ「糖は元々餌にはならないって杉浦先生は断言してたよ」。
--      先生の資料 SX_事業概要 v1.0 は炭素源を「CO2のみ」と明記している）
-- 生成: apply436.py（scratchpad）。fixture 2つを同じ定義から書き出した。
begin;
select set_config('amd.cost_change_reason', '436: 排液の条件を「色」から「薄める倍率」へ直し、排ガスに窒素酸化物の話を足す（まさ 2026-09-15）', true);
do $do$ begin
  if not exists (select 1 from project_cost_assumptions where cost_assumption_id = 'ca14_waste_medium' and md5(note) = '33487524422e5eae8e491693275ba008') then raise exception '436: 前提 ca14_waste_medium の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_assumptions where cost_assumption_id = 'caf_waste_medium' and md5(note) = '33487524422e5eae8e491693275ba008') then raise exception '436: 前提 caf_waste_medium の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_assumptions where cost_assumption_id = 'ca13_co2_flue_gas' and md5(note) = '378d80bd58585962a86406ef183c0d9a') then raise exception '436: 前提 ca13_co2_flue_gas の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_assumptions where cost_assumption_id = 'caf_co2_flue_gas' and md5(note) = '46bfb080ed949e321004116e85fab9b5') then raise exception '436: 前提 caf_co2_flue_gas の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_120' and md5(note) = '75ad1523ddc81da4bb66ed6a71503ae5') then raise exception '436: 明細 ci_260820_120 の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_121' and md5(note) = 'af9be2805a947d5869310855bfa536d9') then raise exception '436: 明細 ci_260820_121 の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'ci_260820_122' and md5(note) = 'b35ad8cb359cbed75d2ce5b9c6323ca9') then raise exception '436: 明細 ci_260820_122 の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_120' and md5(note) = 'd05b238ff0916d7c42ebd8405238e06d') then raise exception '436: 明細 cif_culture_120 の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_121' and md5(note) = 'c61e1d6dbdd21078f553dbee36372288') then raise exception '436: 明細 cif_culture_121 の説明が変わっている'; end if;
  if not exists (select 1 from project_cost_items where cost_item_id = 'cif_culture_122' and md5(note) = '21fbfb0397c0e73af77bf721a510d08d') then raise exception '436: 明細 cif_culture_122 の説明が変わっている'; end if;
  if not exists (select 1 from project_tech_entries where tech_entry_id = 'pte_sx_d14' and md5(note) = 'e5ab439091504f56924464b25482d2c0') then raise exception '436: 台帳 pte_sx_d14 の注記が変わっている'; end if;
  if not exists (select 1 from project_tech_entries where tech_entry_id = 'pte_sx_ef01' and md5(note) = 'bc08936c290970e0ac13ec2bf5aeb8b2') then raise exception '436: 台帳 pte_sx_ef01 の注記が変わっている'; end if;
  if not exists (select 1 from project_tech_entries where tech_entry_id = 'pte_sx_l02' and md5(note) = '8f189ca3f558564ba57417254fe9a461') then raise exception '436: 台帳 pte_sx_l02 の注記が変わっている'; end if;
  if not exists (select 1 from project_tech_entries where tech_entry_id = 'pte_sx_ss13' and md5(note) = 'ead5507925576575f3c8481d12b42583') then raise exception '436: 台帳 pte_sx_ss13 の注記が変わっている'; end if;
end $do$;

-- 排液のスイッチの説明: 「使える排液の条件」の一節を丸ごと置き換える
update project_cost_assumptions set note = replace(note, '**使える排液の条件**: 光合成をさせるので、①色が付いていない（着色排水は光が通らず培養が止まる）、②菌体に毒になる金属や薬剤が入っていない（金属を含む排水を燃料用の菌体に使うと、菌体に金属が入り、それは金属回収の事業の方の話になる）、③窒素・リン・カリウムが実際に入っている（食品工場・醸造・畜産・下水の処理水など）、④年間を通して量と質が安定している、⑤培養の拠点をその工場の隣に置ける。排ガス（CO2）と同じ工場でまかなうなら、①〜⑤と排ガスの条件を同時に満たす工場を探すことになる。', '**使える排液の条件**（2026-09-15 に「色」の置き方を直した。まさ 2026-09-15「色がついてなきゃいけない理由がわからん」）: 排液は培養液そのものではなく、培地の栄養として入れる。要る窒素の量は決まっているので、排液が濃いほど少しで足り、その分だけ薄めて使う。**色も薄めた倍率のぶんだけ薄まる**（吸光度は濃さに比例する＝ランベルト・ベールの法則。3倍に薄めれば色も3分の1）。だから条件は「色が付いていない」ではなく、次の順で見る。①**窒素が濃いか**。菌体1kgに窒素80g、培養液は約200Lなので、培養液の窒素は約400mg/L要る。排液の窒素が X mg/L なら、薄める倍率は X÷400 倍。**窒素が400mg/Lに届かない排液は薄める余地が無く、色がそのまま残る**（味噌の排液は全窒素150mg/L・全リン60mg/L で該当。香川県「小規模事業場等排水処理対策検討ガイドブック〜食料品製造業〜」2023年5月）。1系列（年33,333kg-DCW＝1日111kg）に要る排液は、窒素1,200mg/Lなら1日7.4m³、400mg/Lなら1日22.2m³。②**薄めたあとに残る色で光が通るか**。培養液は菌体自身でもう濁っているので、見るのはその上乗せ分。実例: 佐賀市下水浄化センターの実証（国交省 B-DASH、東芝・ユーグレナ社・佐賀市、2016年4月〜）は、下水汚泥の脱水分離液を**3倍に薄めて**窒素・リン源にし、上水・試薬と同等の生産性を確認した（0.54 g/L/7日）。メタン発酵の消化液でも2〜7倍の希釈でクロレラを培養した実験がある（大林組技術研究所報 78号、2014）。SX でも「排液を培地代わりにし、CO2 6.5%の排ガスを吹き込む」で倍加時間 約6時間（従来の4.8倍）を出している（2026-01-20 定例、杉浦先生が予備的な実験と明言）。③菌体に毒になる金属や薬剤が入っていない（光合成阻害型の農薬は構造的に処理できない）。金属を含む排水を燃料用の菌体に使うと、菌体に金属が入り、それは金属回収の事業の方の話になる。④塩分・油分（醤油の排液は塩が濃い。数値は未確認）。⑤年間を通して量と質が安定している。⑥培養の拠点をその工場の隣に置ける。排ガス（CO2）と同じ工場でまかなうなら、①〜⑥と排ガスの条件を同時に満たす工場を探すことになるが、**排液・排ガス・排熱の3つを出す工場自体はどこにでもある**（ボイラーを持って製造していれば出る）。**まだ入っていない**: 薄める水の量と費用、業種ごとの色度の実測値。')
 where cost_assumption_id in ('ca14_waste_medium', 'caf_waste_medium');

-- 排ガスのスイッチの説明: 窒素酸化物の話を末尾に足す
update project_cost_assumptions set note = note || ' **排ガスの窒素酸化物（NOx）について**（2026-09-15 に足した。まさ 2026-09-15「NOxが栄養源になった、という話は過去に出てきてたように記憶してる。糖は元々餌にはならないって杉浦先生は断言してたよ」）: 排ガスの NOx は培養液で亜硝酸・硝酸になり、菌体が窒素源として取り込む。SX 側の記録でも「反応性窒素 ◎ 利用して増殖」（2026-01-16 杉浦先生ヒアリング）、「硝酸・亜硝酸を短時間で取り込む」（2026-09-02 定例）、日本食研の面談で「重金属、色素、窒素酸化物、硫黄酸化物などを吸収・分解する」と説明している。先生の資料（SX_事業概要 v1.0、2026-03-31）も「N源（≈2 ppm; **亜硝酸でも良い**）」と書いている。文献でも、一酸化窒素は水に溶けにくいのに細胞へ直接拡散して取り込まれ、硝酸塩より優先して使われるという報告がある（Nagase ら 1998・2001、緑藻 Dunaliella tertiolecta。除去率 最大96%）。**ただし量が構造的に足りない。** 排ガスの CO2 と NOx はどちらも同じ燃焼から出るので比が決まっていて、CO2 は NOx の約250〜2,000倍（木質バイオマス発電の実測 CO2 15〜18% / NOx 180〜350ppm で約600倍。フジタ技術研究報告 60号 2024）。いっぽう菌体が要る炭素と窒素の比は約7.3。だから炭素をちょうどまかなう量の排ガスを吹き込んでも、一緒に入る窒素は**必要量の0.4〜3%**（実測に近い例で約1.2%）にしかならない。窒素源の買値はほぼ丸ごと残るので、この試算では NOx による窒素の値引きを入れていない。毒にもならない: 25ppm では正常に増え、300ppm でも死なない（ユーグレナの実証、フジタ 2024。同報告は「NOx の影響を明確に確認できなかった」と結論）。硫黄酸化物は50ppm超で pH を下げて増殖を止めるが、アルカリ側に保てば緩む。好熱性シアノバクテリアで排ガスの NOx を窒素源にした報告は見つかっていない。'
 where cost_assumption_id in ('ca13_co2_flue_gas', 'caf_co2_flue_gas');

-- 培地の原料6行: 行の中の一文を直す
update project_cost_items set note = replace(note, '（買値の欄はそのまま残る。着色排水は光が通らないので使えない）', '（買値の欄はそのまま残る。使えるかは色ではなく排液の窒素の濃さで決まる。スイッチの説明を見る）')
 where cost_item_id in ('ci_260820_120', 'ci_260820_121', 'ci_260820_122', 'cif_culture_120', 'cif_culture_121', 'cif_culture_122');

-- 技術台帳: オカベ排液の「エサ」という読み方を取り消し、訂正の一文を足す
update project_tech_entries set note = replace(note, '高濃度の糖でシアノバクテリアが死ぬと見ていたが、エサとして増えた。', '高濃度の糖でシアノバクテリアが死ぬと見ていたが、対照より速く増えた。') || ' **2026-09-15 訂正**: 「エサ（炭素源）として食べた」という読み方は取り消した（まさ 2026-09-15「NOxが栄養源になった、という話は過去に出てきてたように記憶してる。糖は元々餌にはならないって杉浦先生は断言してたよ」）。先生の資料 SX_事業概要 v1.0（2026-03-31）は炭素源を「**CO2のみ**」と明記し、ユーグレナなど（糖など + CO2）との違いとして挙げている。速く増えた説明として確からしいのは、排液の窒素（醤油・みりんはアミノ酸の窒素が濃い）・リン・微量金属が効いたこと。同じ 2026-09-02 の定例で研究側は「硝酸・亜硝酸を短時間で取り込む」とも説明している。決着させるには、排液を無菌にしたものとそのままを比べ、暗所（または光合成を止める薬剤）の対照を置き、濁度ではなく乾燥重量で菌体を測る（濁った排液では濁度が見かけ上増える）。',
       needs_check = true, check_reason = '「エサ（炭素源）」の読み方を 2026-09-15 に取り消した。利用経路は未確定（無菌対照の実験が要る）',
       updated_at = now()
 where tech_entry_id = 'pte_sx_d14';
update project_tech_entries set note = replace(note, '培養試験では「エサ」として増えた。43時間後にpHが8程度まで上がったのは成分を使ったためと見ている。', '培養試験では対照より速く増えた。43時間後にpHが8程度まで上がったのは成分を使ったためと見ている（ただし pH は光合成でも、アミノ酸が分解してアンモニアが出ても、有機酸が消費されても上がるので、これだけでは区別できない）。') || ' **2026-09-15 訂正**: 「エサ（炭素源）として食べた」という読み方は取り消した（まさ 2026-09-15「NOxが栄養源になった、という話は過去に出てきてたように記憶してる。糖は元々餌にはならないって杉浦先生は断言してたよ」）。先生の資料 SX_事業概要 v1.0（2026-03-31）は炭素源を「**CO2のみ**」と明記し、ユーグレナなど（糖など + CO2）との違いとして挙げている。速く増えた説明として確からしいのは、排液の窒素（醤油・みりんはアミノ酸の窒素が濃い）・リン・微量金属が効いたこと。同じ 2026-09-02 の定例で研究側は「硝酸・亜硝酸を短時間で取り込む」とも説明している。決着させるには、排液を無菌にしたものとそのままを比べ、暗所（または光合成を止める薬剤）の対照を置き、濁度ではなく乾燥重量で菌体を測る（濁った排液では濁度が見かけ上増える）。',
       needs_check = true, check_reason = '「エサ（炭素源）」の読み方を 2026-09-15 に取り消した。利用経路は未確定（無菌対照の実験が要る）',
       updated_at = now()
 where tech_entry_id = 'pte_sx_ef01';
update project_tech_entries set note = note || ' **2026-09-15 訂正**: 「エサ（炭素源）として食べた」という読み方は取り消した（まさ 2026-09-15「NOxが栄養源になった、という話は過去に出てきてたように記憶してる。糖は元々餌にはならないって杉浦先生は断言してたよ」）。先生の資料 SX_事業概要 v1.0（2026-03-31）は炭素源を「**CO2のみ**」と明記し、ユーグレナなど（糖など + CO2）との違いとして挙げている。速く増えた説明として確からしいのは、排液の窒素（醤油・みりんはアミノ酸の窒素が濃い）・リン・微量金属が効いたこと。同じ 2026-09-02 の定例で研究側は「硝酸・亜硝酸を短時間で取り込む」とも説明している。決着させるには、排液を無菌にしたものとそのままを比べ、暗所（または光合成を止める薬剤）の対照を置き、濁度ではなく乾燥重量で菌体を測る（濁った排液では濁度が見かけ上増える）。',
       needs_check = true, check_reason = '「エサ（炭素源）」の読み方を 2026-09-15 に取り消した。利用経路は未確定（無菌対照の実験が要る）',
       updated_at = now()
 where tech_entry_id = 'pte_sx_l02';
update project_tech_entries set note = replace(note, '高濃度の糖で死ぬと見ていたが、逆に「エサ」として増えた。', '高濃度の糖で死ぬと見ていたが、逆に対照より速く増えた。') || ' **2026-09-15 訂正**: 「エサ（炭素源）として食べた」という読み方は取り消した（まさ 2026-09-15「NOxが栄養源になった、という話は過去に出てきてたように記憶してる。糖は元々餌にはならないって杉浦先生は断言してたよ」）。先生の資料 SX_事業概要 v1.0（2026-03-31）は炭素源を「**CO2のみ**」と明記し、ユーグレナなど（糖など + CO2）との違いとして挙げている。速く増えた説明として確からしいのは、排液の窒素（醤油・みりんはアミノ酸の窒素が濃い）・リン・微量金属が効いたこと。同じ 2026-09-02 の定例で研究側は「硝酸・亜硝酸を短時間で取り込む」とも説明している。決着させるには、排液を無菌にしたものとそのままを比べ、暗所（または光合成を止める薬剤）の対照を置き、濁度ではなく乾燥重量で菌体を測る（濁った排液では濁度が見かけ上増える）。',
       needs_check = true, check_reason = '「エサ（炭素源）」の読み方を 2026-09-15 に取り消した。利用経路は未確定（無菌対照の実験が要る）',
       updated_at = now()
 where tech_entry_id = 'pte_sx_ss13';

do $do$ begin
  if exists (select 1 from project_cost_assumptions where cost_assumption_id in ('ca14_waste_medium', 'caf_waste_medium') and note like '%着色排水は光が通らず培養が止まる%') then raise exception '436: 排液の説明に古い文が残っている'; end if;
  if (select count(*) from project_cost_assumptions where cost_assumption_id in ('ca13_co2_flue_gas', 'caf_co2_flue_gas') and note like '%窒素酸化物（NOx）について%') <> 2 then raise exception '436: 排ガスの説明に窒素酸化物の一節が入っていない'; end if;
  if exists (select 1 from project_cost_items where cost_item_id in ('ci_260820_120', 'ci_260820_121', 'ci_260820_122', 'cif_culture_120', 'cif_culture_121', 'cif_culture_122') and note like '%着色排水は光が通らないので使えない%') then raise exception '436: 明細に古い文が残っている'; end if;
  if (select count(*) from project_tech_entries where tech_entry_id in ('pte_sx_d14', 'pte_sx_ef01', 'pte_sx_l02', 'pte_sx_ss13') and note like '%2026-09-15 訂正%') <> 4 then raise exception '436: 台帳の訂正が入っていない'; end if;
  if exists (select 1 from project_tech_entries where tech_entry_id in ('pte_sx_d14', 'pte_sx_ef01', 'pte_sx_l02', 'pte_sx_ss13') and note like '%「エサ」として増えた%') then raise exception '436: 台帳に「エサ」が残っている'; end if;
end $do$;
commit;
