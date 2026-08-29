-- 342_seed_project_tech_cx_real_values.sql
-- CX (p20) の技術台帳を、生データ (source_cache) の実値で入れ直す。
--
-- 340 では project_knowledge の断片しか見ておらず、到達温度を「未確認」として置いてしまった。
-- 実際には面着打合せメモ・文字起こし・Slackに数値が残っていた。SX (341) と同じ直し。
--
-- 値の出所:
--   drive 2025-11-05「まささんとの面着打合せ(2回目)」/ 2025-11-07「251107_IM@NIMS桜」
--   drive 2025-12-02「CryoXプロジェクト AMD業務開始 神谷さんとのキックオフ会議」
--   drive 2026-02-09「アーキタイプベンチャーズ北原様とのオンライン面談」
--   gmeet_minutes 2026-02-09/02-11「CryoX経営企画部内打合せ ビジネスモデル案検討」
--   slack #p20_cx 2026-03-02 (LEMON) / 2026-04-11 (G-QuAT面会報告)
--   drive 2026-04-01「量子冷却技術に関するMTGアップデート(末永)」= kiutra

begin;

delete from project_tech_entries where project_id = 'p20';
delete from project_tech_topics where project_id = 'p20';

insert into project_tech_topics
  (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order,
   confidentiality, source_kind, source_ref, created_by, updated_by)
values (
  'ptt_cx_principle', 'p20', 'article',
  '磁気冷凍と、いま主流の冷やし方の違い',
  '希釈冷凍機と断熱消磁冷凍機 (ADR) が、それぞれ何を使って温度を下げているか。CryoX が狙う位置。',
$md$
極低温をつくる装置には、大きく分けて二つの原理がある。

## 希釈冷凍機 — ヘリウムの同位体を溶かす

いま市販されている装置の主流はこちら。ヘリウムの同位体であるヘリウム3を、ヘリウム4の中へ溶かすときに熱を吸う現象を使う。1ケルビン (摂氏マイナス272.15度) より下の温度を連続して保てるため、量子コンピュータや低温の測定装置はほぼこの方式で動いている。

弱点が二つある。ヘリウム3は産出量が限られ、価格と供給が読めない。実務上さらに効くのは、ヘリウム3が漏れるたびに補給が要り、その間は装置を止めることになる点。稼働率が下がるので、水素ステーションのような連続運転の用途ではメンテナンス不要であることが要件になる (2026-04-11 G-QuAT面会報告)。

もう一つは振動で、装置全体を予冷するパルス管冷凍機が機械的に動くため、その振動が測定対象に伝わる。ただし後述のとおり、この点を課題と受け止めるかは相手によって違う。

## 断熱消磁冷凍機 (ADR) — 磁場をかけて、抜く

磁性体に磁場をかけると、内部の磁気モーメントの向きがそろう。そろう過程で出た熱は外へ捨てる。そのあと熱の出入りを断ったまま磁場を弱めると、向きが再び乱れる。乱れるために必要なエネルギーを磁性体自身の熱から取るので、温度が下がる。この操作を断熱消磁といい、装置を ADR (Adiabatic Demagnetization Refrigerator) と呼ぶ。ヘリウム3を使わない。

ADR は1回の消磁で吸える熱の量が決まっている。冷やし終えたら磁場をかけ直す必要があり、その間は冷却が止まる。段を複数持って交互に動かし、冷却を途切れさせない方式を連続断熱消磁 (c-ADR) という。

到達温度を下げるほど設計上は対数で効いてくるため、この方式の限界はおおよそ 10mK と神谷氏は見ている (2025-11-07)。

## CryoX が狙う位置

原理的に振動が出ないこと、ヘリウムを完全に使わないこと、メンテナンスが要らないこと。加えて検出器である TES (遷移端センサー) を組み込める唯一の土台であること。これが社内で整理した競合優位性 (2026-02-09/02-11)。弱みとして挙がっているのは、長期の実績がないことによる信頼性の不安と、実験室規模から量産へ移すときの壁。

用途によって必要な温度が違う。NMR と MRI は 100mK で足り、そこへ注力する。量子コンピュータ向けの 20mK はその次。

## 気をつける反証

産総研 G-QuAT への面会では、希釈冷凍機の熱の染み出しや振動は現時点で大きな課題として認識されていないという回答だった (2026-04-11)。また大規模化の主流は、冷凍機の台数を増やすのではなく、1台の希釈冷凍機に量子ビットを集約する方向 (Qolab の1台12万物理量子ビットなど)。無振動を前面に出す訴求は、相手によっては刺さらない。
$md$,
  '磁気冷凍', 10, 'internal', 'meeting',
  '2026-02-09/02-11 CryoX経営企画部内打合せ / 2026-04-11 G-QuAT面会報告',
  'amie', 'amie'
), (
  'ptt_cx_temp', 'p20', 'condition',
  '到達温度の目標と限界',
  'どの用途に何ケルビンが要るか。いつまでに何を出すか。',
  null, '磁気冷凍', 20, 'internal', 'meeting',
  '2025-11-05 面着打合せ(2回目) / 2025-11-07 IM@NIMS桜 / 2025-12-02 キックオフ会議',
  'amie', 'amie'
), (
  'ptt_cx_materials', 'p20', 'condition',
  '超伝導線材と磁性材料の使える範囲',
  '磁場をつくる線材と、熱をやり取りする磁性材料が、それぞれどこまでの性能を持つか。',
  null, '磁気冷凍', 30, 'internal', 'meeting',
  'project_knowledge (p20 tech)',
  'amie', 'amie'
), (
  'ptt_cx_compare', 'p20', 'matrix',
  '極低温をつくる方式の星取り表',
  'CryoX / kiutra / LEMON / 希釈冷凍機 (Bluefors) を7つの軸で比べる。空欄は調べていないところ。',
  null, '磁気冷凍', 40, 'internal', 'literature',
  '2026-03-02 Slack (LEMON) / 2026-04-01 kiutra MTGアップデート / 2026-02-09 北原様面談',
  'amie', 'amie'
), (
  'ptt_cx_record', 'p20', 'record',
  '到達実績',
  '技術として、いつ何ができるようになったか。',
  null, '磁気冷凍', 50, 'internal', 'meeting',
  'project_knowledge (p20 tech) / 面着打合せメモ',
  'amie', 'amie'
);

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, sort_order, created_by, updated_by)
values
-- 到達温度の目標と限界
('pte_cx_t01', 'ptt_cx_temp', 'p20', 'NMR / MRI に必要な温度', null, 100, 100, null, 'mK',
 null, 'TES型のNMRとして', '2025-11-05', 'high', 'meeting', '2025-11-05 まささんとの面着打合せ(2回目)',
 'TES素子が要求する温度も100mK。ここが最初の主戦場', 10, 'amie', 'amie'),
('pte_cx_t02', 'ptt_cx_temp', 'p20', '100mK 冷凍機の完成時期', null, null, null, 'FY2025 年度末までに達成', null,
 null, null, '2025-12-02', 'high', 'meeting', '2025-12-02 神谷さんとのキックオフ会議',
 '2025-11-07時点でも「100mKの冷凍機は年度末には完成する」と説明されている', 20, 'amie', 'amie'),
('pte_cx_t03', 'ptt_cx_temp', 'p20', '量子コンピュータ / 水素液化に要る温度', null, 20, 20, null, 'mK',
 null, '超伝導方式の量子コンピュータ', '2025-11-05', 'high', 'meeting', '2025-11-05 まささんとの面着打合せ(2回目)',
 '当初2026年度中の達成を目指していたが、NMR/MRIを優先して後ろへずらした (2025-12-02)', 30, 'amie', 'amie'),
('pte_cx_t04', 'ptt_cx_temp', 'p20', '磁気冷凍方式の原理的な限界', null, 10, 10, 'おおよそ', 'mK',
 null, '到達温度を下げるほど対数で効く設計のため', '2025-11-07', 'medium', 'meeting', '2025-11-07 IM@NIMS桜',
 'ここより下は別の原理が要る。20mKは限界に近く、達成は簡単ではないと神谷氏', 40, 'amie', 'amie'),
('pte_cx_t05', 'ptt_cx_temp', 'p20', '20mK での要求冷凍能力', null, null, null, '未確定 (何μW@20mK を目指すか検討中)', null,
 null, null, '2026-03-16', 'unverified', 'meeting', '2026-03-16 ディープコア社 末永さん顔合わせ 事前質問',
 '産総研G-QuATインタビューでも、20mK/100mKでの要求冷凍能力が確認事項の筆頭に挙がっている', 50, 'amie', 'amie'),
('pte_cx_t06', 'ptt_cx_temp', 'p20', '量子コンピュータ側が言う適用温度', null, null, null, '数K程度ではないかという指摘あり', null,
 null, '超伝導でない方式の場合', '2026-02-09', 'medium', 'meeting', '2026-02-09 アーキタイプベンチャーズ北原様 面談',
 'その場合は冷却装置の大型化が必須になる、と神谷氏。大型化には算段があるが未実証', 60, 'amie', 'amie'),
('pte_cx_t07', 'ptt_cx_temp', 'p20', '液体水素の製造効率 (既存)', null, 25, 25, 'おおよそ', '%',
 null, '既存方式のエネルギー効率', '2026-03-29', 'medium', 'literature', '成果物①：事業戦略提案書.pdf',
 'エネルギーロスの大きさが、この市場での置き換えの動機になる', 70, 'amie', 'amie'),

-- 超伝導線材と磁性材料
('pte_cx_m01', 'ptt_cx_materials', 'p20', 'REBCO細線 磁場性能', null, 10, 10, null, 'T',
 null, '超伝導コイルに使う', null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 'MgB2 (2T) と比較して高性能という位置づけ', 10, 'amie', 'amie'),
('pte_cx_m02', 'ptt_cx_materials', 'p20', 'REBCO細線 臨界温度', null, 90, 90, 'おおよその値', 'K',
 null, null, null, 'high', 'meeting', 'project_knowledge (p20 tech)', null, 20, 'amie', 'amie'),
('pte_cx_m03', 'ptt_cx_materials', 'p20', 'REBCO細線 動作温度', null, 77, 77, '液体窒素温度', 'K',
 null, null, null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 '液体窒素で運転できるため、冷やすための装置が簡単になる', 30, 'amie', 'amie'),
('pte_cx_m04', 'ptt_cx_materials', 'p20', 'MgB2 磁場性能 (比較対象)', null, 2, 2, null, 'T',
 null, '菊池氏が扱う材料', null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 'CryoX の REBCO と比べるための参照値', 40, 'amie', 'amie'),
('pte_cx_m05', 'ptt_cx_materials', 'p20', 'メタ磁性材 保持磁場 (一般)', null, 5, 5, null, 'T',
 null, '一般的な値', null, 'medium', 'meeting', 'project_knowledge (p20 tech)',
 'NIMS の別研究テーマ', 50, 'amie', 'amie'),
('pte_cx_m06', 'ptt_cx_materials', 'p20', 'メタ磁性材 保持磁場 (低減見込み)', null, 1, 1, null, 'T',
 null, '神谷氏の見込み', null, 'low', 'meeting', 'project_knowledge (p20 tech)',
 '実証されていない見込み値', 60, 'amie', 'amie'),

-- 星取り表
('pte_cx_c11', 'ptt_cx_compare', 'p20', '到達温度', 'CryoX (自社)', 100, 100, 'FY2025内に達成見込み', 'mK',
 'good', 'NMR / MRI 向け', '2025-12-02', 'high', 'meeting', '2025-12-02 キックオフ会議',
 '20mKは次段階。原理的な限界はおおよそ10mK', 11, 'amie', 'amie'),
('pte_cx_c12', 'ptt_cx_compare', 'p20', '到達温度', 'kiutra', null, null, 'ミリケルビン帯', null,
 'good', null, '2026-04-01', 'high', 'vendor_spec', '2026-04-01 Kiutra MTGアップデート (末永氏)',
 '具体的な到達値は未取得。製品仕様の確認が要る', 12, 'amie', 'amie'),
('pte_cx_c13', 'ptt_cx_compare', 'p20', '到達温度', 'LEMON (EU)', null, null, '20mK未満 (目標)', null,
 'good', '2027年8月までの計画', '2026-03-02', 'high', 'literature', '2026-03-02 Slack #p20_cx (LEMON調査)',
 '冷却能力20μW以上を同時に目標。技術デモ2026-2027、商業製品2027-2029の予定', 13, 'amie', 'amie'),
('pte_cx_c14', 'ptt_cx_compare', 'p20', '到達温度', '希釈冷凍機 (Bluefors)', null, null, '10mK前後', null,
 'good', '市販の乾式希釈冷凍機として一般的な値', null, 'medium', 'literature', null,
 '方式として広く知られている値。個別機種の実測ではない', 14, 'amie', 'amie'),

('pte_cx_c21', 'ptt_cx_compare', 'p20', 'ヘリウム3への依存', 'CryoX (自社)', null, null, '完全に不要', null,
 'excellent', null, '2026-02-09', 'high', 'meeting', '2026-02-09 CryoX経営企画部内打合せ',
 '磁気熱量効果を使うため原理的にヘリウム3が要らない。社内整理では競合優位性の筆頭', 21, 'amie', 'amie'),
('pte_cx_c22', 'ptt_cx_compare', 'p20', 'ヘリウム3への依存', 'kiutra', null, null, '非依存', null,
 'excellent', null, '2026-04-01', 'high', 'vendor_spec', '2026-04-01 Kiutra MTGアップデート',
 null, 22, 'amie', 'amie'),
('pte_cx_c23', 'ptt_cx_compare', 'p20', 'ヘリウム3への依存', 'LEMON (EU)', null, null, '完全フリーを目標', null,
 'excellent', null, '2026-03-02', 'high', 'literature', '2026-03-02 Slack #p20_cx',
 null, 23, 'amie', 'amie'),
('pte_cx_c24', 'ptt_cx_compare', 'p20', 'ヘリウム3への依存', '希釈冷凍機 (Bluefors)', null, null, '必要', null,
 'poor', null, null, 'high', 'literature', null,
 'ヘリウム3をヘリウム4へ溶かす原理そのものが方式の中心', 24, 'amie', 'amie'),

('pte_cx_c31', 'ptt_cx_compare', 'p20', '連続運転', 'CryoX (自社)', null, null, 'c-ADR を開発中', null,
 'fair', null, null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 '連続断熱消磁が中核要素として開発中', 31, 'amie', 'amie'),
('pte_cx_c32', 'ptt_cx_compare', 'p20', '連続運転', 'kiutra', null, null, 'ADR と cADR の両方を製品化', null,
 'good', null, '2026-04-01', 'high', 'vendor_spec', '2026-04-01 Kiutra MTGアップデート',
 null, 32, 'amie', 'amie'),
('pte_cx_c33', 'ptt_cx_compare', 'p20', '連続運転', 'LEMON (EU)', null, null, '連続運転を目標', null,
 'good', null, '2026-03-02', 'high', 'literature', '2026-03-02 Slack #p20_cx', null, 33, 'amie', 'amie'),
('pte_cx_c34', 'ptt_cx_compare', 'p20', '連続運転', '希釈冷凍機 (Bluefors)', null, null, '連続運転', null,
 'excellent', null, null, 'high', 'literature', null, '方式として連続運転が標準', 34, 'amie', 'amie'),

('pte_cx_c41', 'ptt_cx_compare', 'p20', '振動', 'CryoX (自社)', null, null, '原理的に無振動', null,
 'excellent', null, '2026-02-09', 'high', 'meeting', '2026-02-09 CryoX経営企画部内打合せ',
 '低振動GM冷凍機の特許も別途出願している', 41, 'amie', 'amie'),
('pte_cx_c42', 'ptt_cx_compare', 'p20', '振動', 'kiutra', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 42, 'amie', 'amie'),
('pte_cx_c43', 'ptt_cx_compare', 'p20', '振動', 'LEMON (EU)', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 43, 'amie', 'amie'),
('pte_cx_c44', 'ptt_cx_compare', 'p20', '振動', '希釈冷凍機 (Bluefors)', null, null, 'パルス管の振動が出る', null,
 'fair', '予冷にパルス管冷凍機を使う場合', '2026-04-11', 'medium', 'meeting', '2026-04-11 G-QuAT面会報告',
 '⚠ ただし産総研G-QuATでは、熱の染み出しや振動は現時点で大きな課題として認識されていない。KEKは制振で抑え込んでいる', 44, 'amie', 'amie'),

('pte_cx_c51', 'ptt_cx_compare', 'p20', 'メンテナンスと稼働率', 'CryoX (自社)', null, null, 'メンテナンスフリーを訴求', null,
 'excellent', null, '2026-02-09', 'high', 'meeting', '2026-02-09 CryoX経営企画部内打合せ',
 '水素ステーション用途ではメンテナンス不要が極めて重要な要件 (2026-04-11)', 51, 'amie', 'amie'),
('pte_cx_c52', 'ptt_cx_compare', 'p20', 'メンテナンスと稼働率', 'kiutra', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 52, 'amie', 'amie'),
('pte_cx_c53', 'ptt_cx_compare', 'p20', 'メンテナンスと稼働率', 'LEMON (EU)', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 53, 'amie', 'amie'),
('pte_cx_c54', 'ptt_cx_compare', 'p20', 'メンテナンスと稼働率', '希釈冷凍機 (Bluefors)', null, null, 'ヘリウム3の補給で停止時間が出る', null,
 'poor', 'リークに伴う補給', '2026-04-11', 'high', 'meeting', '2026-04-11 Slack #p20_cx',
 '稼働率の低下が顧客側の痛み。OEMにとっては保守が収益源でもあるため、メンテナンスフリーは抵抗も生む', 54, 'amie', 'amie'),

('pte_cx_c61', 'ptt_cx_compare', 'p20', '販売実績', 'CryoX (自社)', 2, 2, '有料製作の依頼2件', '件',
 'fair', 'KEK と JAXA 宇宙科学研究所から', '2026-03-01', 'high', 'meeting', 'project_knowledge (p20 tech)',
 'TES と ADR を組にしたシステムへの依頼', 61, 'amie', 'amie'),
('pte_cx_c62', 'ptt_cx_compare', 'p20', '販売実績', 'kiutra', 40, null, '40台以上 / 顧客40機関以上', null,
 'excellent', null, '2026-04-01', 'high', 'vendor_spec', '2026-04-01 Kiutra MTGアップデート (末永氏)',
 '顧客は産総研・imec・CEA・CNRS・ミュンヘン工科大など。産総研Qubedにも導入実績があるが、多数ある評価装置の1つで特別な関係ではない', 62, 'amie', 'amie'),
('pte_cx_c63', 'ptt_cx_compare', 'p20', '販売実績', 'LEMON (EU)', null, null, '研究プロジェクト', null,
 'na', null, '2026-03-02', 'high', 'literature', '2026-03-02 Slack #p20_cx',
 '販売ではなくEUの大規模研究プロジェクト。VCからの投資は受けている', 63, 'amie', 'amie'),
('pte_cx_c64', 'ptt_cx_compare', 'p20', '販売実績', '希釈冷凍機 (Bluefors)', null, null, '市場を独占', null,
 'excellent', null, '2026-02-09', 'high', 'meeting', '2026-02-09 北原様面談',
 'フィンランドの企業。乾式希釈冷凍機で現状の市場を占めている', 64, 'amie', 'amie'),

('pte_cx_c71', 'ptt_cx_compare', 'p20', '大型化の見通し', 'CryoX (自社)', null, null, '算段はあるが未実証', null,
 'fair', null, '2026-02-09', 'high', 'meeting', '2026-02-09 北原様面談',
 '⚠ 業界の主流は冷凍機を大きくする方向ではなく、1台の希釈冷凍機へ量子ビットを集約する方向 (Qolabの1台12万物理量子ビットなど)', 71, 'amie', 'amie'),
('pte_cx_c72', 'ptt_cx_compare', 'p20', '大型化の見通し', 'kiutra', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 72, 'amie', 'amie'),
('pte_cx_c73', 'ptt_cx_compare', 'p20', '大型化の見通し', 'LEMON (EU)', null, null, '大規模産業利用を目標に掲げる', null,
 'good', null, '2026-03-02', 'high', 'literature', '2026-03-02 Slack #p20_cx',
 '従来の研究用途を超えた大規模産業利用を初めて可能にするシステムを目標としている', 73, 'amie', 'amie'),
('pte_cx_c74', 'ptt_cx_compare', 'p20', '大型化の見通し', '希釈冷凍機 (Bluefors)', null, null, '1台への集約で対応', null,
 'good', null, '2026-04-11', 'medium', 'meeting', '2026-04-11 G-QuAT面会報告', null, 74, 'amie', 'amie'),

-- 到達実績
('pte_cx_r01', 'ptt_cx_record', 'p20', 'TES のエッチング', null, null, null, '内製化の目途が立った', null,
 null, null, '2025-12-01', 'high', 'meeting', 'project_knowledge (p20 tech)',
 '月内の時点。日付は月初で置いている。半導体のスパッタ装置で製作できる', 10, 'amie', 'amie'),
('pte_cx_r02', 'ptt_cx_record', 'p20', '100mK 冷凍機', null, 100, 100, 'FY2025年度末に完成見込み', 'mK',
 null, 'NMR / MRI 向け', '2026-03-31', 'medium', 'meeting', '2025-12-02 キックオフ会議',
 '達成の確認が取れ次第、実績として日付を更新する', 20, 'amie', 'amie'),
('pte_cx_r03', 'ptt_cx_record', 'p20', '特許出願 (磁気冷凍)', null, null, null, 'NIMS 7 : KEK 3 の持分で出願予定', null,
 null, 'レクシード経由・KEKとの共願', '2025-09-30', 'high', 'meeting', '2025-11-05 面着打合せ(2回目)',
 'さきがけ落選で緊急性がなくなり、9月末出願の予定に落ち着いた。低振動GM冷凍機の特許も別途執筆', 30, 'amie', 'amie'),
('pte_cx_r04', 'ptt_cx_record', 'p20', '技術成熟度 (TRL) の開始点', null, null, null, '4 から 3 へ引き下げ', null,
 null, '実証段階のため', '2026-03-01', 'high', 'meeting', 'project_knowledge (p20 tech)',
 '月内の時点。日付は月初で置いている', 40, 'amie', 'amie'),
('pte_cx_r05', 'ptt_cx_record', 'p20', 'TES と ADR を組にしたシステムの引き合い', null, 2, 2, 'KEK / JAXA 宇宙科学研究所', '件',
 null, '有料の製作依頼', '2026-03-01', 'high', 'meeting', 'project_knowledge (p20 tech)',
 'アカデミアでの需要が実際の依頼として出た', 50, 'amie', 'amie'),
('pte_cx_r06', 'ptt_cx_record', 'p20', '委託研究 (NIMS 共同研究 W2025014019)', null, null, null, '終了', null,
 null, '2025年11月から', '2026-03-31', 'high', 'meeting', 'project_knowledge (p20 term)',
 null, 60, 'amie', 'amie');

commit;
