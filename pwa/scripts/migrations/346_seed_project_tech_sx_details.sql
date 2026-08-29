-- 346_seed_project_tech_sx_details.sql
-- SX の技術台帳を、文字起こしの精読結果でさらに埋める (まさ 2026-08-29)。
-- 「SXは、どの元素の取り込み実績があるかも書いておいて」「これまでの書き起こしデータをもっと詳しくみてほしい」
--
-- 出所は source_cache の gmeet_minutes / drive。日付は各行の source_ref に書く。

begin;

-- ============ 対象物質を段階別に入れ直す ============
delete from project_tech_entries where tech_topic_id = 'ptt_sx_elements';

update project_tech_topics
set summary = 'どの物質をどこまで確かめてあるか。◎=実験で確認済み ○=試験中 △=これから評価 —=話題に出ただけ。',
    updated_at = now()
where tech_topic_id = 'ptt_sx_elements';

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_e01', 'ptt_sx_elements', 'p21', '銅', null, 30, 30, '◎ 実験で確認済み', 'mg/g-DCW',
 null, '取り込み効率。除去速度75 mg/L・h、単体なら30分で処理', '2026-05-19', 'high', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 '実測値は15 mg/g-DCW を上回る。除去速度の実測も50 mg/L・h超。数値の裏が取れている唯一の元素',
 false, null, 10, 'amie', 'amie'),
('pte_sx_e02', 'ptt_sx_elements', 'p21', 'ニッケル', null, null, null, '◎ 実験室で取り込みを確認', null,
 null, '実験室レベル', '2026-02-17', 'high', 'meeting', '2026-02-17 SX定例MTG (杉浦先生)',
 '杉浦先生「実験室のレベルではニッケルは取り込みます」。実廃液のほうが実験室より取り込みが良好な傾向',
 true, '廃液中でイオンの状態になっていると効くかどうかが不明、と社内で指摘されている。実廃液での確認が要る', 20, 'amie', 'amie'),
('pte_sx_e03', 'ptt_sx_elements', 'p21', '鉄', null, null, null, '◎ 完全に除去', null,
 null, '煮豆排液での試験', '2026-07-01', 'high', 'literature', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf (杉浦先生コメント)',
 '同じ試験で色素成分は除去できず、むしろ色が濃くなった。カルコンからケルセチンへの変換の可能性が指摘されている',
 true, '除去率の数値が無い。「完全除去」の定義と測定方法を確認する', 30, 'amie', 'amie'),
('pte_sx_e04', 'ptt_sx_elements', 'p21', '反応性窒素', null, 580, 580, '◎ 利用して増殖', 'kg/年',
 null, '2,000L培養での削減量の試算', '2026-01-16', 'medium', 'meeting', '杉浦先生ヒアリング (2026-01-16)',
 '同じ試算で二酸化炭素2.4トン/年の削減、バイオ燃料48〜130kg/年の生産。実測ではなく計算による見積り',
 false, null, 40, 'amie', 'amie'),
('pte_sx_e05', 'ptt_sx_elements', 'p21', 'モリブデン', null, null, null, '○ 試験したが失敗', null,
 null, '排液のベースが海水だったため', '2026-02-18', 'high', 'meeting', 'int) SX 社内打ち合わせ (2026-02-18)',
 '菌体が死滅した。物質そのものの可否ではなく、塩分が原因',
 true, '塩分のない排液で再試験しないと、モリブデンを取り込めるかが分からない', 50, 'amie', 'amie'),
('pte_sx_e06', 'ptt_sx_elements', 'p21', 'コバルト', null, null, null, '○ 廃液を入手して試験予定', null,
 null, '太陽石油から受領', '2026-01-20', 'medium', 'meeting', '2026-01-20 SX定例MTG (文字起こし)',
 null,
 true, '2026-01-20に試験予定と言われたきり、結果の記録が無い。実施状況を確認する', 60, 'amie', 'amie'),
('pte_sx_e07', 'ptt_sx_elements', 'p21', 'レアアース', null, null, null, '○ 廃液を調達中', null,
 null, 'せとのわ経由でメイト社', '2026-08-18', 'high', 'literature', 'SX 定例報告会 (2026-08-18) / 月次業務報告書 202608',
 '評価対象として色素脱色より優先する方針。上流の廃液提供を依頼中',
 false, null, 70, 'amie', 'amie'),
('pte_sx_e08', 'ptt_sx_elements', 'p21', 'アルミニウム', null, null, null, '○ 記録が食い違う', null,
 null, null, '2026-02-18', 'low', 'meeting', 'int) SX 社内打ち合わせ (2026-02-18) / int) sx (2026-02-04)',
 '「アルミとカドミウムはもうできる」と取れる発言がある一方、別の回で「苦手だとは言ってた」という発言もある。文字起こしが不明瞭で対象元素を特定できない',
 true, 'アルミニウムを取り込めるのかを杉浦先生へ直接確認する。営業の対象選定に効く', 80, 'amie', 'amie'),
('pte_sx_e09', 'ptt_sx_elements', 'p21', 'カドミウム', null, null, null, '△ これから評価', null,
 null, '申請書に記載した6元素の1つ', '2026-02-18', 'medium', 'meeting', 'int) SX 社内打ち合わせ (2026-02-18)',
 null, false, null, 90, 'amie', 'amie'),
('pte_sx_e10', 'ptt_sx_elements', 'p21', '鉛', null, null, null, '△ これから評価', null,
 null, 'ペロブスカイト太陽電池の排水で初期検討', '2026-06-19', 'medium', 'meeting', 'ファインケム株式会社 打合せ (2026-06-19)',
 '申請書では鉛・クロム・ヒ素の適用評価を明確にすることが要件になっている',
 false, null, 100, 'amie', 'amie'),
('pte_sx_e11', 'ptt_sx_elements', 'p21', 'クロム', null, null, null, '△ これから評価 (可否が不明)', null,
 null, null, '2026-02-18', 'low', 'meeting', 'int) SX 社内打ち合わせ (2026-02-18)',
 '社内では「クロムは分からない」とされている',
 true, '申請書の要件に入っているのに可否が未確認。優先して試験する', 110, 'amie', 'amie'),
('pte_sx_e12', 'ptt_sx_elements', 'p21', 'ヒ素', null, null, null, '△ これから評価', null,
 null, null, '2025-12-23', 'medium', 'meeting', 'int-PS2 todo整理 (2025-12-23)',
 '佃煮工場 (昆布を炊いた汁) の排水に数ppm含まれるという顧客側の情報あり。排水総量300t/日',
 false, null, 120, 'amie', 'amie'),
('pte_sx_e13', 'ptt_sx_elements', 'p21', '色素・染料', null, 90, null, '△ 目標値のみ (実試験は未達)', '%',
 null, 'メチレンブルーの脱色率、30分以内', '2026-02-28', 'medium', 'literature', 'sx_strategy_draft_260228.pdf',
 '技術目標として設定。煮豆排液の実試験では色素成分を除去できず、色がむしろ濃くなった (2026-07-01)',
 true, '目標値と実試験の結果が噛み合っていない。どの色素なら分解できるのかを切り分ける', 130, 'amie', 'amie'),
('pte_sx_e14', 'ptt_sx_elements', 'p21', '亜鉛', null, null, null, '— 話題に出ただけ', null,
 null, null, '2026-02-17', 'low', 'meeting', '2026-02-17 SX定例MTG / SolvioraX_CAPEX_OPEX_v2',
 'めっき排水では亜鉛が主成分になる。コスト試算では売却単価350円/kgで置いているが、取り込みの実験記録は無い',
 true, 'めっき排水を狙うなら亜鉛の取り込み試験が要る。売却単価だけが独り歩きしている', 140, 'amie', 'amie'),
('pte_sx_e15', 'ptt_sx_elements', 'p21', 'リン・窒素', null, null, null, '— 訴求文言のみ', null,
 null, null, '2026-08-28', 'low', 'literature', 'SX_月次業務報告書 202608',
 'リンは世界的に枯渇が危惧される資源で、シアノバクテリアが栄養として吸収するという説明を営業資料に使っている',
 true, '回収量・回収率の実験値が無い。資料の主張に実験の裏付けを付ける', 150, 'amie', 'amie'),
('pte_sx_e16', 'ptt_sx_elements', 'p21', '申請書に載せた元素の数', null, 6, 6, '当初10種から絞り込み', '種',
 null, 'アルミニウム・カドミウム・銅・ニッケル・クロムほか', '2026-02-18', 'high', 'meeting', 'int) SX 社内打ち合わせ (2026-02-18)',
 '当初は10種を挙げていたが、実際に扱えるのは7〜8種程度と整理し、記載は6種になった',
 false, null, 160, 'amie', 'amie');

-- ============ 培養条件へ追加 ============
insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_k17', 'ptt_sx_culture', 'p21', '処理にかかる時間 (温度による差)', null, null, null, '45℃で約30分 / 室温で2〜3時間', null,
 null, '光はルームライト程度で足りる', '2026-01-20', 'high', 'meeting', '2026-01-20 SX定例MTG (文字起こし)',
 '高い温度で運転する利点が処理速度に出ている。強い光は要らない',
 false, null, 105, 'amie', 'amie'),
('pte_sx_k18', 'ptt_sx_culture', 'p21', '工場の排ガスで培養したとき', null, 4.8, 4.8, '従来比の増殖速度。倍加時間は約6時間', '倍',
 null, '排液を培地代わりに、二酸化炭素6.5%の排ガスを吹き込む', '2026-01-20', 'medium', 'meeting', '2026-01-20 SX定例MTG (文字起こし)',
 '杉浦先生「本当に分裂時間が6時間というのを初めて見ました」。本人が予備的な実験と明言',
 true, '予備実験の1回だけ。再現を取る。倍加時間15時間 (45℃・二酸化炭素3%) との差が大きい', 106, 'amie', 'amie'),
('pte_sx_k19', 'ptt_sx_culture', 'p21', 'ODから乾燥重量への換算係数', null, 0.19, 0.19, null, 'g-DCW/(OD・L)',
 null, null, '2026-05-19', 'high', 'literature', '★SolvioraX_m³換算版 (先生実測値・確定と明記)',
 '菌体量を光の吸収から求めるための係数', false, null, 107, 'amie', 'amie'),
('pte_sx_k20', 'ptt_sx_culture', 'p21', 'ODの上限 (超高密度培養)', null, 80000, 80000, null, 'OD',
 null, 'リアクターを小さくできる根拠として', '2026-03-16', 'low', 'literature', 'SolvioraX_CAPEX_OPEX_v2 (2026-03-16)',
 '財務モデルの前提として書かれている値。実測かどうかは資料から判別できない',
 true, '実測値か目標値かを確認する。リアクターの大きさを左右する', 108, 'amie', 'amie'),
('pte_sx_k21', 'ptt_sx_culture', 'p21', '最適温度 (別資料の記載)', null, 40, 45, null, '℃',
 null, '工場の廃熱を使ってヒーター費用をゼロにできる根拠', '2026-03-16', 'low', 'literature', 'SolvioraX_CAPEX_OPEX_v2 (2026-03-16)',
 null,
 true, '杉浦先生の45〜70℃と範囲が食い違う。どちらが最適域かで、廃熱利用の前提が変わる', 109, 'amie', 'amie'),
('pte_sx_k22', 'ptt_sx_culture', 'p21', '二酸化炭素とpH (別資料の記載)', null, 6.5, 10, '二酸化炭素6.5〜10%が最適 (pH 6.5〜10)', '%',
 null, null, '2026-03-16', 'low', 'literature', 'SolvioraX_CAPEX_OPEX_v2 (2026-03-16)',
 null,
 true, '杉浦先生の「二酸化炭素は空気中〜10%、pHは7.5程度」と範囲が食い違う。同じ値の改訂なのか別の前提なのかを確認する', 110, 'amie', 'amie'),
('pte_sx_k23', 'ptt_sx_culture', 'p21', '株の性質 (環境への出方)', null, null, null, 'バイオフィルムを作らない / 低温では増えにくい', null,
 null, '野生株', '2026-01-20', 'high', 'meeting', '2026-01-20 SX定例MTG (文字起こし)',
 '外へ出ても大量に繁殖するリスクは低いという説明に使える', false, null, 111, 'amie', 'amie'),
('pte_sx_k24', 'ptt_sx_culture', 'p21', '株の改変の難しさ', null, null, null, 'ゲノムのコピー数が多く、世界的に難しい', null,
 null, '高温性シアノバクテリア', '2026-03-19', 'high', 'meeting', '2026-03-19 SX定例MTG (文字起こし)',
 'このバイオのノウハウ自体が技術的な優位性になっている。改変にはゲノム配列が分かっている必要がある',
 false, null, 112, 'amie', 'amie');

-- ============ リアクターの運転条件へ追加 ============
insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_r13', 'ptt_sx_reactor', 'p21', '電力の原単位', null, 10, 10, null, 'kWh/m³',
 null, null, '2026-03-16', 'low', 'literature', 'SolvioraX_CAPEX_OPEX_v2',
 '試算の前提値。実測ではない', true, '実機での消費電力を測って置き換える', 130, 'amie', 'amie'),
('pte_sx_r14', 'ptt_sx_reactor', 'p21', '膜の交換年数', null, 3, 4, null, '年',
 null, 'UF膜またはMF膜', '2026-08-11', 'low', 'literature', 'SX_コスト試算_260730 (4年) / 月次業務報告書 202608 (3年)',
 '膜交換費は処理単価の26%を占める。ここが伸びれば原価が下がる',
 true, '資料によって3年と4年で違う。実機の運転条件で決める', 140, 'amie', 'amie'),
('pte_sx_r15', 'ptt_sx_reactor', 'p21', '金属の回収率', null, 85, 95, null, '%',
 null, '菌体から金属を取り出す側の回収率', '2026-05-19', 'low', 'literature', '★SolvioraX_m³換算版 (85%) / SolvioraX_CAPEX_OPEX_v2 (95%)',
 '菌体回収率90%とは別の指標。菌をどれだけ回収できるかではなく、菌から金属をどれだけ取り出せるか',
 true, '資料間で85%と95%に割れている。菌体回収率90%と混同しないよう指標名を分けたうえで、実測で確定させる', 150, 'amie', 'amie'),
('pte_sx_r16', 'ptt_sx_reactor', 'p21', '培地の低減率', null, 80, 80, '現状の想定', '%',
 null, null, '2026-08-11', 'low', 'literature', 'SX_コスト試算_260730',
 '改善レバーとして挙がっている', true, '根拠となる実験値が資料に無い', 160, 'amie', 'amie'),
('pte_sx_r17', 'ptt_sx_reactor', 'p21', '色素分解での菌体の使い回し', null, 10, 10, '10Lを10回再利用・ロス2%', '回',
 null, '色素分解の用途', '2026-07-13', 'medium', 'literature', '260714 SolvioraX EWIR action deck',
 '金属回収は1回使い捨て。この差が原価の18倍差を生んでいる',
 true, '10回という前提の実験的な裏付けを確認する', 170, 'amie', 'amie'),
('pte_sx_r18', 'ptt_sx_reactor', 'p21', '金属回収での菌体の投入量', null, 2.185, 2.185, null, 'kg-DCW/m³',
 null, '1回使用して酸処理へ', '2026-07-13', 'medium', 'literature', '260714 SolvioraX EWIR action deck',
 '色素分解では0.0012 kg-DCW/m³。1800倍の差', false, null, 180, 'amie', 'amie');

-- ============ 星取り表へ既存処理の内訳を足す ============
insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_c14', 'ptt_sx_compare', 'p21', '汚泥の発生量', 'SX (自社)', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, '菌体そのものの処分をどうするかを含めて未整理',
 true, '使用済み菌体の量と処分費を試算する', 14, 'amie', 'amie'),
('pte_sx_c15', 'ptt_sx_compare', 'p21', '汚泥の発生量', '既存の物理化学処理', 0.5, 2.5, null, 'kg/m³',
 'poor', '処分単価20〜60円/kg', '2026-07-29', 'medium', 'literature', 'SX_コスト試算_260716 (市場ヒアリング)',
 '産廃の委託先が逼迫しているという現場感もある', false, null, 15, 'amie', 'amie'),
('pte_sx_c16', 'ptt_sx_compare', 'p21', '既存処理の費用の内訳', '既存の物理化学処理', 310, 550, '薬品15〜30% / 電力10〜20% / 人件費10〜20% / 減価償却30〜50%', '円/m³',
 'fair', '市場ヒアリングの整理', '2026-07-29', 'medium', 'literature', 'SX_コスト試算_260716',
 '500円/m³という競争目安の裏付け。減価償却が最大の費目なので、設備を流用できる提案が効く',
 false, null, 16, 'amie', 'amie');

-- ============ 単価の推移へ追加 ============
insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_p08', 'ptt_sx_price', 'p21', '売上単価の再試算ケース', null, 600, 1000, '600円と1,000円の2ケース', '円/m³',
 null, 'ランニングコストは300〜500円/m³以内を目安', '2026-07-31', 'medium', 'literature', 'SX_月次業務報告書 202607',
 '同じ月の別資料。重金属回収は約1万円/m³、色素・有機物分解は1,000円/m³未満の可能性と整理されている',
 true, '8月のコスト試算は売上単価500円で置いている。600円/1,000円のケースとどちらを採るかで採算が変わる', 55, 'amie', 'amie');

commit;
