-- 345_seed_project_tech_sx_limits.sql
-- SX の「使えなくなる条件」を文字起こしから起こす (まさ 2026-08-29)。
--
-- 「油があるとダメ、塩水もダメって言ってたのがどこかに残ってるはず」
-- 「養分にできる炭素源はCO2のみって言ってた。他の有機成分はダメだって」
--
-- 出所は source_cache の gmeet_minutes 全文。特に:
--   2026-02-17 SX定例MTG   … 海水ベースの排液で細胞が死んだ実験
--   2026-01-20 SX定例MTG   … 二酸化炭素が足りないと増殖が止まる
--   2026-01-18 SX) 事業計画相談 … 光合成阻害型の農薬は構造的に処理できない
--   2026-03-05 int) SX社内打合せ … 重金属回収と油生成は並行できない
--   2025-11-05 コバシロボティクス … 温度・pHの制御目標

begin;

-- 培養条件へ「炭素源」と温度の可動域を足す
insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_k13', 'ptt_sx_culture', 'p21', '炭素源', null, null, null, '二酸化炭素', null,
 null, '光合成で炭素を取り込む', '2026-01-20', 'high', 'meeting', '2026-01-20 SX定例MTG (文字起こし)',
 '杉浦先生「二酸化炭素を使って生きているので」。二酸化炭素が足りないと増殖が途中で止まる。濃度を上げるほど増殖が速くなる',
 true, '有機物を栄養にできない (独立栄養) という断定発言は文字起こしに無く、二酸化炭素依存の実験結果からの示唆。杉浦先生へ「有機炭素源は一切使えないのか」を確認する', 35, 'amie', 'amie'),
('pte_sx_k14', 'ptt_sx_culture', 'p21', '生きられる温度の上限', null, 70, 90, '活動できる範囲', '℃',
 null, '運転で使うのは45〜70℃', '2025-11-05', 'medium', 'meeting', '2025-11-05 コバシロボティクス<>杉浦先生',
 '生き物としてはもっと広い範囲で活動する。運転域はその内側に取っている', false, null, 15, 'amie', 'amie'),
('pte_sx_k15', 'ptt_sx_culture', 'p21', '低温側の挙動', null, null, null, '死なないが増えない', null,
 null, '河川の水温程度', '2026-01-20', 'high', 'meeting', '2026-01-20 SX定例MTG (文字起こし)',
 '外へ流出しても増殖しないという意味で、環境影響の説明にも使える', false, null, 16, 'amie', 'amie'),
('pte_sx_k16', 'ptt_sx_culture', 'p21', 'pHが動く向き', null, null, null, '放っておくと上がる', null,
 null, '二酸化炭素の供給と細胞の増殖に伴って', '2025-11-05', 'high', 'meeting', '2025-11-05 コバシロボティクス<>杉浦先生',
 '制御しないと増殖が鈍る。7.5へ戻す制御が要る', false, null, 25, 'amie', 'amie');

-- 使えなくなる条件
insert into project_tech_topics
  (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order,
   confidentiality, source_kind, source_ref, needs_check, check_reason, created_by, updated_by)
values (
  'ptt_sx_limits', 'p21', 'condition',
  '使えなくなる条件',
  'この技術が成立しない排水・運転条件。営業に行く前と、サンプルを受け取る前に見る。',
  null, '排水処理', 45, 'confidential', 'meeting',
  '2026-02-17 / 2026-01-20 / 2026-01-18 / 2026-03-05 の各MTG文字起こし',
  false, null, 'amie', 'amie'
);

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_l01', 'ptt_sx_limits', 'p21', '海水・高い塩分', null, null, null, '使えない (細胞が死ぬ)', null,
 null, '海水がベースの排液', '2026-02-17', 'high', 'meeting', '2026-02-17 SX定例MTG (文字起こし)',
 '実際に受け取った排液で確認済み。短時間なら取り込むが、その後すべて吐き出して死滅した。塩分の上限値はまだ測っていない',
 true, '「どこまでの塩分濃度なら耐えるか」の上限値が無い。海に近い工場を営業対象から外す判断に直結するので、杉浦先生へ確認する', 10, 'amie', 'amie'),
('pte_sx_l02', 'ptt_sx_limits', 'p21', '有機物を栄養にすること', null, null, null, 'できない見込み (炭素源は二酸化炭素)', null,
 null, null, '2026-01-20', 'medium', 'meeting', '2026-01-20 SX定例MTG (文字起こし)',
 '二酸化炭素が足りないと増殖が止まるという実験結果から。有機物で代替できるという記録は無い',
 true, '断定発言が文字起こしに無い。有機炭素源が一切使えないのか、共存するだけなら問題ないのかを杉浦先生へ確認する', 20, 'amie', 'amie'),
('pte_sx_l03', 'ptt_sx_limits', 'p21', '光合成を阻害する農薬・薬剤', null, null, null, '構造的に処理できない', null,
 null, '光合成する生き物を使う以上', '2026-01-18', 'high', 'meeting', '2026-01-18 SX) 事業計画相談のタッチポイント',
 '事業計画上の弱みとして明言されている。対象排水の選別で最初に外す条件',
 false, null, 30, 'amie', 'amie'),
('pte_sx_l04', 'ptt_sx_limits', 'p21', '高い濃度の有機物', null, null, null, '処理しきれない可能性', null,
 null, '濃度が高すぎる場合', '2026-01-18', 'low', 'meeting', '2026-01-18 SX) 事業計画相談のタッチポイント',
 '「パワーが足りなくてできない、濃度が高すぎて」という定性的な懸念',
 true, '閾値が無い。何mg/L以上で処理しきれないのかを実験で決める', 40, 'amie', 'amie'),
('pte_sx_l05', 'ptt_sx_limits', 'p21', '重金属の回収とバイオ燃料の生産', null, null, null, '同時にはできない', null,
 null, '重金属を回収すると菌が死ぬため', '2026-03-05', 'high', 'meeting', '2026-03-05 int) SX 社内打ち合わせ',
 '油をつくるには菌が光合成を続ける必要がある。二つの用途は工程を分ける前提で考える',
 false, null, 50, 'amie', 'amie'),
('pte_sx_l06', 'ptt_sx_limits', 'p21', '排水中の油分', null, null, null, '油水分離後の液を評価対象にする', null,
 null, '食品工場の場合', '2026-08-28', 'medium', 'literature', 'SX_月次業務報告書 202608',
 '運用として分離後の液を受け取る方針。油そのものが菌に何をするかは記録が無い',
 true, '「油があるとダメ」という記憶がまさにあるが、文字起こしから該当発言を特定できていない。菌への影響と、前処理でどこまで落とせばよいかを杉浦先生へ確認する', 60, 'amie', 'amie'),
('pte_sx_l07', 'ptt_sx_limits', 'p21', '遺伝子組み換えの扱い', null, null, null, '選抜用の遺伝子を外す操作が要る', null,
 null, '改良株を使う場合', '2026-01-20', 'high', 'meeting', '2026-01-20 SX定例MTG (文字起こし)',
 '別のバクテリア由来の遺伝子を選抜のために入れているため、そのままだと遺伝子組み換え体になる。カルタヘナ法と閉鎖系プロセス設計が論点',
 false, null, 70, 'amie', 'amie'),
('pte_sx_l08', 'ptt_sx_limits', 'p21', 'コンタミとシアノトキシン', null, null, null, '想定リスク (発生事例なし)', null,
 null, null, '2026-02-28', 'low', 'literature', 'sx_strategy_draft_260228.pdf',
 '影響度は高と評価。対策として非毒性株の選抜と遺伝子ノックアウトを挙げている',
 true, '実際に毒素を出す株かどうかの確認結果が無い。使用株の毒性を杉浦先生へ確認する', 80, 'amie', 'amie'),
('pte_sx_l09', 'ptt_sx_limits', 'p21', '処理業者経由の混合排液', null, null, null, 'かなり厳しい可能性', null,
 null, '各社で処理できなかった排液を集めたもの', '2026-01-09', 'low', 'meeting', '2026-01-09 キックオフMTG (文字起こし)',
 '高濃度で混ざり物が多い。最初のPoC先としては条件が厳しい',
 true, '実際に試験していない。サンプルを取って確かめるか、対象から外すかを決める', 90, 'amie', 'amie'),
('pte_sx_l10', 'ptt_sx_limits', 'p21', '苦手な金属', null, null, null, '存在するが特定できていない', null,
 null, null, '2026-02-04', 'low', 'meeting', '2026-02-04 int) sx (文字起こし)',
 '「苦手だとは言ってたけど」という発言があるが、金属名が文字起こしで判読できない',
 true, 'どの金属が苦手なのかを杉浦先生へ直接確認する。営業の対象選定に効く', 100, 'amie', 'amie');

commit;
