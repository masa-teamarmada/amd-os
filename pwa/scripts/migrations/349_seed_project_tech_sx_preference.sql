-- 349_seed_project_tech_sx_preference.sql
-- 「どの元素を優先して取り込むか」を独立したトピックにする (まさ 2026-08-29)。
--
-- 「どの元素が大好きとかの preference もあったと思うので、その情報も入れてほしい。
--   AとBが混じってるとAばかり取り込んでしまう、とか」
--
-- 文字起こし・資料を選択性/選好/競合/優先/取り合い/共存/序列 ほか30語超で当たった結果、
-- **元素間の優先順位を直接書いた記録は無かった**。ただし強い手がかりが3つあるので、
-- 「分かっていること」と「分かっていないこと」を同じ表に並べ、確認事項として残す。

begin;

insert into project_tech_topics
  (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order,
   confidentiality, source_kind, source_ref, needs_check, check_reason, created_by, updated_by)
values (
  'ptt_sx_preference', 'p21', 'condition',
  '取り込みの選好と、混ざったときの挙動',
  'どの元素を優先して取り込むか。複数の金属が混ざった排水で何が起きるか。実際の工場排水は混合が普通なので、ここが処理量と適用先を決める。',
$md$
実際の工場排水に金属が1種類だけ入っていることはまずない。だから「混ざったときに何が起きるか」は、
処理にかかる時間、必要な菌体の量、狙える顧客の範囲を全部決める。

現時点で分かっているのは次の3つだけで、**元素間の優先順位を書いた記録は無い**。
資料と文字起こしを選択性・選好・競合・優先・取り合い・共存・序列など30語以上で当たった結果。
$md$,
  '排水処理', 42, 'confidential', 'meeting',
  'SX 定例報告会 (2026-08-18) / ★SolvioraX_m³換算版 (2026-05-19)',
  true, '元素の優先順位そのものが未記録。次のSX定例で杉浦先生へ「単体と混合で処理時間が48倍違う理由」と「元素間に優先順位があるか」を確認する',
  'amie', 'amie'
);

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_f01', 'ptt_sx_preference', 'p21', '鉄と亜鉛の取り込み傾向', null, null, null, 'どちらも速度が速く、濃度も高い傾向', null,
 null, 'メタロチオネイン強化株 (TmtA1) での基礎実験', '2026-08-18', 'medium', 'literature', 'SX 定例報告会 (2026-08-18)',
 '鉄を単独で調べた結果が、既に分かっている亜鉛の傾向と同じだったという比較。鉄と亜鉛を混ぜて競わせた実験ではない',
 true, '単発の基礎実験で、報告書自身が「条件を変えて複数回の実験が必要」としている。再現を取る', 10, 'amie', 'amie'),
('pte_sx_f02', 'ptt_sx_preference', 'p21', '混ざると処理時間が延びる', null, 0.5, 24, '単体30分 → 混在24時間 (48倍)', 'h',
 null, '金属が1種類のとき / 複数が混在するとき', '2026-05-19', 'medium', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 '数値は設計前提として明記されている。ただし**なぜ48倍になるのかの説明が、どの資料にも無い**。取り合いが起きているのか、別の理由なのかは未確認',
 true, '48倍の理由を杉浦先生へ確認する。取り合いが原因なら、前処理で金属を分ける工程が要るかどうかの判断に直結する', 20, 'amie', 'amie'),
('pte_sx_f03', 'ptt_sx_preference', 'p21', '元素間の優先順位', null, null, null, '記録が無い', null,
 null, null, null, 'unverified', 'manual', null,
 'まさの記憶では「AとBが混じっているとAばかり取り込んでしまう」という話があった。文字起こしと資料を30語以上で当たったが、該当する記述は見つからなかった',
 true, 'どの元素を優先して取り込むのかを杉浦先生へ直接確認する。混合排水を狙えるかどうかが決まる、この技術で最も重要な未記録事項', 30, 'amie', 'amie'),
('pte_sx_f04', 'ptt_sx_preference', 'p21', '実際の排水に入っている金属の構成 (参考)', null, 770, 770, '鉄がいちばん多く、次に亜鉛、その次にニッケル。合計でこの程度', 'ppm',
 null, 'ある顧客の排水の分析値', '2026-02-04', 'medium', 'meeting', 'int) sx (2026-02-04 文字起こし)',
 'シアノバクテリア側の選好ではなく、排水そのものの組成。狙う元素を決めるときの参考値',
 false, null, 40, 'amie', 'amie'),
('pte_sx_f05', 'ptt_sx_preference', 'p21', '「重金属が好き」という説明', null, null, null, '対外説明用の言い回し (科学的な選好データではない)', null,
 null, 'ピッチでの説明', '2026-03-19', 'high', 'meeting', '2026-03-19 SX定例MTG (山地)',
 'ピッチでは意図的に噛み砕いて「シアノは重金属が好きなので取り込んでくれる」と言っている。台帳の数値としては扱わない',
 false, null, 50, 'amie', 'amie');

commit;
