-- 350_seed_project_tech_sx_valuables.sql
-- 煮豆排液から取れる有価物を独立したトピックにする (まさ 2026-08-29)。
--
-- 「煮豆排液から何か有価物が取り出せたって報告あったよね。あれも書いておいてほしい」
--
-- 資料を当たった結果、正確には「取り出せる候補を挙げ、鉄の完全除去には成功したが
-- 色素の除去には失敗した（むしろ色が濃くなった）。その色の変化がカルコンから
-- ケルセチンへの変換かもしれない」という段階。取り出せたという完了形の報告は無い。
-- 出所: SX_NIMAME_INTERNAL_SHARE_20260702.pdf (2026-07-01) セクション8「有価物候補」

begin;

insert into project_tech_topics
  (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order,
   confidentiality, source_kind, source_ref, needs_check, check_reason, created_by, updated_by)
values (
  'ptt_sx_valuables', 'p21', 'condition',
  '排液から取れる有価物',
  '金属回収・色素分解に続く3つ目の用途になりうる。煮豆排液の試験で候補が挙がったが、同定も収率も未確認のまま止まっている。',
$md$
排水処理は「汚れを取る対価をもらう」事業だが、取り出したものが売れるなら収入が二重になる。
煮豆排液（食品工場）の試験で、その候補が挙がった。

**実験で確かめられたのは鉄を完全に除去できたことだけ**。
色素は除去できず、むしろ色が濃くなった。杉浦先生はこの色の変化を、
カルコンからケルセチンへ変換された可能性として説明している。ケルセチンなら有価物になる。

ただし、その物質が本当にケルセチンなのか（同定）、どれだけ取れるのか（収率）、
取り出すのにいくらかかるのか（精製費用）、売り物にできる品質なのか（品質保証）——
**4つとも未確認のまま 2026-07-09 の社内打合せで持ち越され、その後の続報が無い**。

8月の月次報告書では、アップサイドの筋を「バイオ燃料・レアアース回収・カーボンクレジット」の3つと
定義していて、煮豆由来の有価物はそこに入っていない。事業計画の中で宙に浮いた状態。
$md$,
  '排水処理', 55, 'confidential', 'literature',
  'SX_NIMAME_INTERNAL_SHARE_20260702.pdf (2026-07-01)',
  true, '2026-07-09 の打合せで「回収物価値の確認」として持ち越されたまま、その後の記録が無い。日本食研とユナイテッドシルクの訪問 (8/25) の結果もまだ台帳に入っていない。担当と期限を決める',
  'amie', 'amie'
);

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_v01', 'ptt_sx_valuables', 'p21', '鉄', null, null, null, '完全に除去できた (実験で確認)', null,
 null, '煮豆排液', '2026-07-01', 'high', 'literature', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf (杉浦先生コメント)',
 'この試験で唯一、結果が出ているもの。ただし除去率の数値は資料に無い',
 true, '「完全除去」の定義と測定方法、除去率の数値を確認する', 10, 'amie', 'amie'),
('pte_sx_v02', 'ptt_sx_valuables', 'p21', 'ケルセチン', null, null, null, 'カルコンから変換された可能性', null,
 null, '色素が除去されず色が濃くなった現象の説明として', '2026-07-01', 'low', 'literature', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf (杉浦先生コメント)',
 'まさの記憶にある「有価物が取り出せた」に当たるのはこれ。ただし可能性の指摘であって、同定されていない',
 true, '本当にケルセチンなのかを分析で同定する。ここが確定しないと有価物の話が前に進まない', 20, 'amie', 'amie'),
('pte_sx_v03', 'ptt_sx_valuables', 'p21', 'フィコシアニン (青色成分)', null, null, null, '候補 (シアノバクテリア由来)', null,
 null, null, '2026-07-01', 'low', 'literature', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf',
 '菌体そのものから取れる色素。排液由来ではなく自社の菌が持っている成分',
 true, '実験で取り出した記録が無い。候補として挙がっただけ', 30, 'amie', 'amie'),
('pte_sx_v04', 'ptt_sx_valuables', 'p21', 'イソフラボン', null, null, null, '候補 (煮豆液由来)', null,
 null, null, '2026-07-01', 'low', 'literature', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf',
 '大豆の煮汁に元から含まれる成分', true, '含有量と、処理後に残っているかを測る', 40, 'amie', 'amie'),
('pte_sx_v05', 'ptt_sx_valuables', 'p21', 'ポリフェノール', null, null, null, '候補 (煮豆液由来)', null,
 null, null, '2026-07-01', 'low', 'literature', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf',
 '同じ資料でアントシアニンは期待薄と評価されている', true, '含有量と、処理後に残っているかを測る', 50, 'amie', 'amie'),
('pte_sx_v06', 'ptt_sx_valuables', 'p21', 'アントシアニン', null, null, null, '期待薄', null,
 null, null, '2026-07-01', 'medium', 'literature', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf',
 '候補から外れている', false, null, 60, 'amie', 'amie'),
('pte_sx_v07', 'ptt_sx_valuables', 'p21', '事業上の扱い (主ケース)', null, 0, 0, '有価物の収入を見込まない', '円/m³',
 null, '現行の事業計画', '2026-07-01', 'medium', 'literature', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf',
 '未確認のものを収入に入れない、という保守的な置き方', false, null, 70, 'amie', 'amie'),
('pte_sx_v08', 'ptt_sx_valuables', 'p21', '事業上の扱い (副収入ケース)', null, 500, 500, null, '円/m³',
 null, '仮置き', '2026-07-01', 'low', 'estimate', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf',
 '処理単価500円/m³と同額。実現すれば売上が2倍になる計算',
 true, '根拠のない仮置き。どの物質がいくらで売れるかの積上げが要る', 80, 'amie', 'amie'),
('pte_sx_v09', 'ptt_sx_valuables', 'p21', '事業上の扱い (アップサイド)', null, 1500, null, '以上', '円/m³',
 null, '仮置き', '2026-07-01', 'low', 'estimate', 'SX_NIMAME_INTERNAL_SHARE_20260702.pdf',
 null, true, '同上。積上げの根拠が要る', 90, 'amie', 'amie'),
('pte_sx_v10', 'ptt_sx_valuables', 'p21', '未確認のまま残っている4点', null, 4, 4, '同定 / 収率 / 精製コスト / 品質保証', '項目',
 null, null, '2026-07-09', 'high', 'literature', '260709_int_SX社内打ち合わせ_準備メモ',
 '2026-07-02時点の持ち越し事項として「回収物価値の確認」が残ったまま、8月の報告にも続報が無い',
 true, '4点それぞれの担当と期限を決める。ここが埋まらない限り、有価物は事業計画に載せられない', 100, 'amie', 'amie'),
('pte_sx_v11', 'ptt_sx_valuables', 'p21', '事業計画での位置づけ', null, null, null, 'アップサイドの筋に入っていない', null,
 null, '8月時点', '2026-08-28', 'medium', 'literature', 'SX_月次業務報告書 202608',
 'アップサイドは「バイオ燃料・レアアース回収・カーボンクレジット」の3つと定義されており、煮豆由来の有価物は含まれていない',
 true, '4つ目の筋として立てるのか、落とすのかを決める', 110, 'amie', 'amie');

commit;
