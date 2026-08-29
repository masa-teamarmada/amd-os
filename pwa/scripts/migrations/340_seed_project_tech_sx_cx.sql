-- 340_seed_project_tech_sx_cx.sql
-- 技術タブ (migration 339) の初期データ。まず SX (p21) と CX (p20) から (まさ 2026-08-29)。
--
-- 値の出所は project_knowledge と project_meeting_summaries に既にある事実だけ。
-- そこに無いものは推測で埋めず「未確認」「未測定」として残し、確度を unverified にする。
-- 空欄は「調べていない」の可視化であり、次に誰へ何を聞くかを note に書く。

begin;

delete from project_tech_entries where project_id in ('p20', 'p21');
delete from project_tech_topics where project_id in ('p20', 'p21');

-- =====================================================================
-- CX (p20) — 磁気冷凍
-- =====================================================================

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

弱点が二つある。ヘリウム3は産出量が限られ、価格と供給が読めない。もう一つは振動で、装置全体を予冷するパルス管冷凍機が機械的に動くため、その振動が測定対象に伝わる。

## 断熱消磁冷凍機 (ADR) — 磁場をかけて、抜く

磁性体に磁場をかけると、内部の磁気モーメントの向きがそろう。そろう過程で出た熱は外へ捨てる。そのあと熱の出入りを断ったまま磁場を弱めると、向きが再び乱れる。乱れるために必要なエネルギーを磁性体自身の熱から取るので、温度が下がる。この操作を断熱消磁といい、装置を ADR (Adiabatic Demagnetization Refrigerator) と呼ぶ。ヘリウム3を使わない。

ADR は1回の消磁で吸える熱の量が決まっている。冷やし終えたら磁場をかけ直す必要があり、その間は冷却が止まる。段を複数持って交互に動かし、冷却を途切れさせない方式を連続断熱消磁 (c-ADR) という。

## CryoX が狙う位置

ヘリウム3に依存せず、振動が小さく、連続で運転できること。この三つを同時に満たす装置はまだ市販されていない。中核となる材料は低交流損失の REBCO 細線 (磁場性能 10テスラ) で、磁場をつくる超伝導コイルに使う。検出器である TES (遷移端センサー) と組で提供する構想があり、KEK と JAXA 宇宙科学研究所から有料の製作依頼が来ている。

比較の軸になるのは、到達温度、ヘリウム3への依存、連続運転の可否、振動、販売実績、大型化の見通しの六つ。下の星取り表がその六つを並べたもの。
$md$,
  '磁気冷凍', 10, 'internal', 'meeting',
  'project_knowledge (p20 tech/competitor) と 2026-06-08 CX内部MTG',
  'amie', 'amie'
), (
  'ptt_cx_materials', 'p20', 'condition',
  '超伝導線材と磁性材料の使える範囲',
  '磁場をつくる線材と、熱をやり取りする磁性材料が、それぞれどこまでの性能を持つか。',
  null, '磁気冷凍', 20, 'internal', 'meeting',
  'project_knowledge (p20 tech)',
  'amie', 'amie'
), (
  'ptt_cx_compare', 'p20', 'matrix',
  '極低温をつくる方式の星取り表',
  'CryoX / kiutra / LEMON / 希釈冷凍機 (Bluefors) を6つの軸で比べる。空欄は調べていないところ。',
  null, '磁気冷凍', 30, 'internal', 'meeting',
  'project_knowledge (p20 competitor)',
  'amie', 'amie'
), (
  'ptt_cx_record', 'p20', 'record',
  '到達実績',
  '技術として、いつ何ができるようになったか。',
  null, '磁気冷凍', 40, 'internal', 'meeting',
  'project_knowledge (p20 tech)',
  'amie', 'amie'
);

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, sort_order, created_by, updated_by)
values
-- 成立条件: 材料
('pte_cx_m01', 'ptt_cx_materials', 'p20', 'REBCO細線 磁場性能', null, 10, null, null, 'T',
 null, '超伝導コイルに使う', null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 'MgB2 (2T) と比較して高性能という位置づけ', 10, 'amie', 'amie'),
('pte_cx_m02', 'ptt_cx_materials', 'p20', 'REBCO細線 臨界温度', null, 90, null, 'おおよその値', 'K',
 null, null, null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 null, 20, 'amie', 'amie'),
('pte_cx_m03', 'ptt_cx_materials', 'p20', 'REBCO細線 動作温度', null, 77, null, '液体窒素温度', 'K',
 null, null, null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 '液体窒素で運転できるため、冷やすための装置が簡単になる', 30, 'amie', 'amie'),
('pte_cx_m04', 'ptt_cx_materials', 'p20', 'MgB2 磁場性能 (比較対象)', null, 2, null, null, 'T',
 null, '菊池氏が扱う材料', null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 'CryoX の REBCO と比べるための参照値', 40, 'amie', 'amie'),
('pte_cx_m05', 'ptt_cx_materials', 'p20', 'メタ磁性材 保持磁場 (一般)', null, 5, null, null, 'T',
 null, '一般的な値', null, 'medium', 'meeting', 'project_knowledge (p20 tech)',
 'NIMS の別研究テーマ', 50, 'amie', 'amie'),
('pte_cx_m06', 'ptt_cx_materials', 'p20', 'メタ磁性材 保持磁場 (低減見込み)', null, 1, null, null, 'T',
 null, '神谷氏の見込み', null, 'low', 'meeting', 'project_knowledge (p20 tech)',
 '実証されていない見込み値', 60, 'amie', 'amie'),

-- 星取り表: 到達温度
('pte_cx_c11', 'ptt_cx_compare', 'p20', '到達温度', 'CryoX (自社)', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null,
 '目標値が台帳に入っていない。神谷氏へ確認する', 11, 'amie', 'amie'),
('pte_cx_c12', 'ptt_cx_compare', 'p20', '到達温度', 'kiutra', null, null, 'ミリケルビン帯', null,
 'good', null, null, 'high', 'vendor_spec', 'project_knowledge (p20 competitor)',
 '量子コンピュータ向けの冷却として展開', 12, 'amie', 'amie'),
('pte_cx_c13', 'ptt_cx_compare', 'p20', '到達温度', 'LEMON (EU)', null, 20, '目標値', 'mK',
 'good', '2027年8月までの計画', null, 'high', 'literature', 'project_knowledge (p20 tech)',
 '冷却能力 20マイクロワット以上を同時に目標としている', 13, 'amie', 'amie'),
('pte_cx_c14', 'ptt_cx_compare', 'p20', '到達温度', '希釈冷凍機 (Bluefors)', null, null, '10mK前後', null,
 'good', '市販の乾式希釈冷凍機として一般的な値', null, 'medium', 'literature', null,
 '方式として広く知られている値。個別機種の実測ではない', 14, 'amie', 'amie'),

-- 星取り表: ヘリウム3
('pte_cx_c21', 'ptt_cx_compare', 'p20', 'ヘリウム3への依存', 'CryoX (自社)', null, null, '依存しない', null,
 'excellent', null, null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 '磁気熱量効果を使うため原理的にヘリウム3が要らない', 21, 'amie', 'amie'),
('pte_cx_c22', 'ptt_cx_compare', 'p20', 'ヘリウム3への依存', 'kiutra', null, null, '依存しない', null,
 'excellent', null, null, 'high', 'vendor_spec', 'project_knowledge (p20 competitor)',
 null, 22, 'amie', 'amie'),
('pte_cx_c23', 'ptt_cx_compare', 'p20', 'ヘリウム3への依存', 'LEMON (EU)', null, null, '完全フリーを目標', null,
 'excellent', null, null, 'high', 'literature', 'project_knowledge (p20 tech)',
 null, 23, 'amie', 'amie'),
('pte_cx_c24', 'ptt_cx_compare', 'p20', 'ヘリウム3への依存', '希釈冷凍機 (Bluefors)', null, null, '必要', null,
 'poor', null, null, 'high', 'literature', null,
 'ヘリウム3をヘリウム4へ溶かす原理そのものが方式の中心', 24, 'amie', 'amie'),

-- 星取り表: 連続運転
('pte_cx_c31', 'ptt_cx_compare', 'p20', '連続運転', 'CryoX (自社)', null, null, 'c-ADR を開発中', null,
 'fair', null, null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 '連続断熱消磁が中核要素として開発中', 31, 'amie', 'amie'),
('pte_cx_c32', 'ptt_cx_compare', 'p20', '連続運転', 'kiutra', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null,
 '既製品 L-Type Rapid の運転方式を確認する', 32, 'amie', 'amie'),
('pte_cx_c33', 'ptt_cx_compare', 'p20', '連続運転', 'LEMON (EU)', null, null, '連続運転を目標', null,
 'good', null, null, 'high', 'literature', 'project_knowledge (p20 tech)',
 null, 33, 'amie', 'amie'),
('pte_cx_c34', 'ptt_cx_compare', 'p20', '連続運転', '希釈冷凍機 (Bluefors)', null, null, '連続運転', null,
 'excellent', null, null, 'high', 'literature', null,
 '方式として連続運転が標準', 34, 'amie', 'amie'),

-- 星取り表: 振動
('pte_cx_c41', 'ptt_cx_compare', 'p20', '振動', 'CryoX (自社)', null, null, '低振動', null,
 'good', null, null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 '低振動・高効率・ヘリウムフリーを掲げている', 41, 'amie', 'amie'),
('pte_cx_c42', 'ptt_cx_compare', 'p20', '振動', 'kiutra', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 42, 'amie', 'amie'),
('pte_cx_c43', 'ptt_cx_compare', 'p20', '振動', 'LEMON (EU)', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 43, 'amie', 'amie'),
('pte_cx_c44', 'ptt_cx_compare', 'p20', '振動', '希釈冷凍機 (Bluefors)', null, null, 'パルス管の振動が出る', null,
 'fair', '予冷にパルス管冷凍機を使う場合', null, 'medium', 'literature', null,
 '方式に由来する一般的な弱点', 44, 'amie', 'amie'),

-- 星取り表: 販売実績
('pte_cx_c51', 'ptt_cx_compare', 'p20', '販売実績', 'CryoX (自社)', null, null, '有料製作の依頼2件', null,
 'fair', 'KEK と JAXA 宇宙科学研究所から', null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 'TES と ADR を組にしたシステムへの依頼', 51, 'amie', 'amie'),
('pte_cx_c52', 'ptt_cx_compare', 'p20', '販売実績', 'kiutra', 40, null, '40台以上 / 顧客40機関以上', null,
 'excellent', null, null, 'high', 'vendor_spec', 'project_knowledge (p20 competitor)',
 '欧州中心。産総研を含む。米国の主要機関とは未取引', 52, 'amie', 'amie'),
('pte_cx_c53', 'ptt_cx_compare', 'p20', '販売実績', 'LEMON (EU)', null, null, '研究プロジェクト', null,
 'na', null, null, 'high', 'literature', 'project_knowledge (p20 competitor)',
 '販売ではなく EU の大規模研究プロジェクト', 53, 'amie', 'amie'),
('pte_cx_c54', 'ptt_cx_compare', 'p20', '販売実績', '希釈冷凍機 (Bluefors)', null, null, '市場を独占', null,
 'excellent', null, null, 'high', 'meeting', 'project_knowledge (p20 competitor)',
 'フィンランドの企業。乾式希釈冷凍機で現状の市場を占めている', 54, 'amie', 'amie'),

-- 星取り表: 大型化
('pte_cx_c61', 'ptt_cx_compare', 'p20', '大型化の見通し', 'CryoX (自社)', null, null, '算段はあるが未実証', null,
 'fair', null, null, 'high', 'meeting', 'project_knowledge (p20 tech)',
 '量子コンピュータ向けには大型化が要る。開発に時間がかかる状態', 61, 'amie', 'amie'),
('pte_cx_c62', 'ptt_cx_compare', 'p20', '大型化の見通し', 'kiutra', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 62, 'amie', 'amie'),
('pte_cx_c63', 'ptt_cx_compare', 'p20', '大型化の見通し', 'LEMON (EU)', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 63, 'amie', 'amie'),
('pte_cx_c64', 'ptt_cx_compare', 'p20', '大型化の見通し', '希釈冷凍機 (Bluefors)', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 64, 'amie', 'amie'),

-- 到達実績
('pte_cx_r01', 'ptt_cx_record', 'p20', 'TES のエッチング', null, null, null, '内製化の目途が立った', null,
 null, null, '2025-12-01', 'high', 'meeting', 'project_knowledge (p20 tech)',
 '月内の時点。日付は月初で置いている', 10, 'amie', 'amie'),
('pte_cx_r02', 'ptt_cx_record', 'p20', '技術成熟度 (TRL) の開始点', null, 3, null, '4 から 3 へ引き下げ', null,
 null, '実証段階のため', '2026-03-01', 'high', 'meeting', 'project_knowledge (p20 tech)',
 '月内の時点。日付は月初で置いている', 20, 'amie', 'amie'),
('pte_cx_r03', 'ptt_cx_record', 'p20', 'TES と ADR を組にしたシステムの引き合い', null, 2, null, 'KEK / JAXA 宇宙科学研究所', '件',
 null, '有料の製作依頼', '2026-03-01', 'high', 'meeting', 'project_knowledge (p20 tech)',
 'アカデミアでの需要が実際の依頼として出た', 30, 'amie', 'amie'),
('pte_cx_r04', 'ptt_cx_record', 'p20', '委託研究 (NIMS 共同研究 W2025014019)', null, null, null, '終了', null,
 null, '2025年11月から', '2026-03-31', 'high', 'meeting', 'project_knowledge (p20 term)',
 null, 40, 'amie', 'amie');

-- =====================================================================
-- SX (p21) — 培養 / 排水処理
-- =====================================================================

insert into project_tech_topics
  (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order,
   confidentiality, source_kind, source_ref, created_by, updated_by)
values (
  'ptt_sx_principle', 'p21', 'article',
  '高熱性シアノバクテリアで排水を処理するとはどういうことか',
  '何を使って、水の中の何を取り除いているか。成立を決める項目は何か。',
$md$
シアノバクテリアは光合成をする細菌。高熱性の株は、常温で増える株より高い温度で増える。

排水処理に高い温度で働く株を使う利点は三つある。雑菌が増えにくいので培養が安定する。反応が速い。工場から出た排水が熱いまま処理でき、冷ます工程が要らない。

SX が狙うのは、重金属を含む排水と、色のついた排水。細胞が金属を取り込むか、細胞の表面に吸着させることで、水から金属を取り除く。同時に光合成で二酸化炭素を消費するので、処理そのものが二酸化炭素の排出を増やさない。既存の排水処理は薬品を入れて沈殿させ、金属は汚泥として産業廃棄物になる。ここが置き換えの狙いどころで、金属を回収して売れるなら処理費の一部を取り返せる。

この技術が成立するかどうかは、次の項目で決まる。

- 株がどの水温・気温で増えるか
- どの pH で増えるか
- どれだけの光量と二酸化炭素濃度が要るか
- 酸素量と塩濃度の許容範囲
- どの金属をどれだけ取り込めるか
- 水がリアクターの中にどれだけ留まる必要があるか (滞留時間)

この項目そのものは 2026-04-06 の定例で、特許の中心に据えるものとして確定している。ただし各項目の実測値は、この台帳にまだ一つも入っていない。下の成立条件の表がその状態を示している。

なお、株・培養条件・担持方法・リアクター内部条件・光・二酸化炭素・pH・温度・滞留時間は、初回の面談では相手に出さない方針 (2026-06-26 三浦工業 MTG)。この表を社外へ見せることはできない。
$md$,
  '培養', 10, 'confidential', 'meeting',
  '2026-04-06 SX定例MTG / 2026-06-26 SX MTG 三浦工業',
  'amie', 'amie'
), (
  'ptt_sx_culture', 'p21', 'condition',
  'シアノバクテリアの培養条件',
  '項目は確定している。実測値はまだ一つも入っていない。次の定例で埋める対象。',
  null, '培養', 20, 'confidential', 'meeting',
  '2026-04-06 SX定例MTG (特許分析のコア要素として項目を確定)',
  'amie', 'amie'
), (
  'ptt_sx_compare', 'p21', 'matrix',
  '排水処理方式の星取り表',
  'SX の方式と、既存の物理化学処理・生物処理を5つの軸で比べる。空欄は調べていないところ。',
  null, '排水処理', 30, 'internal', 'meeting',
  '2026-03-30 SX MTG / 2026-07-07 ビザスク面談',
  'amie', 'amie'
), (
  'ptt_sx_record', 'p21', 'record',
  '到達実績',
  '装置と実験が、いつどこまで進んだか。',
  null, '培養', 40, 'internal', 'meeting',
  'project_knowledge (p21 tech) / SX定例MTG',
  'amie', 'amie'
);

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, sort_order, created_by, updated_by)
values
-- 成立条件: 培養 (項目は確定、値は未測定)
('pte_sx_k01', 'ptt_sx_culture', 'p21', '水温', null, null, null, '未測定', '℃',
 null, '培養槽内', null, 'unverified', 'meeting', '2026-04-06 SX定例MTG',
 '次の定例で杉浦先生へ実測範囲を確認する', 10, 'amie', 'amie'),
('pte_sx_k02', 'ptt_sx_culture', 'p21', '気温', null, null, null, '未測定', '℃',
 null, '装置の設置環境', null, 'unverified', 'meeting', '2026-04-06 SX定例MTG',
 '次の定例で杉浦先生へ実測範囲を確認する', 20, 'amie', 'amie'),
('pte_sx_k03', 'ptt_sx_culture', 'p21', 'pH', null, null, null, '未測定', null,
 null, '培養槽内', null, 'unverified', 'meeting', '2026-04-06 SX定例MTG',
 '排水は中和後・希釈前で採取する前提 (2026-08-25 ユナイテッドシルク MTG)。酸性の原液はそのままでは対象にできない', 30, 'amie', 'amie'),
('pte_sx_k04', 'ptt_sx_culture', 'p21', '光量', null, null, null, '未測定', null,
 null, null, null, 'unverified', 'meeting', '2026-04-06 SX定例MTG',
 '単位を決めるところから。次の定例で確認する', 40, 'amie', 'amie'),
('pte_sx_k05', 'ptt_sx_culture', 'p21', '二酸化炭素濃度', null, null, null, '未測定', null,
 null, null, null, 'unverified', 'meeting', '2026-04-06 SX定例MTG',
 'バイオ装置に二酸化炭素ガスの導入口がある', 50, 'amie', 'amie'),
('pte_sx_k06', 'ptt_sx_culture', 'p21', '酸素量', null, null, null, '未測定', null,
 null, null, null, 'unverified', 'meeting', '2026-04-06 SX定例MTG', null, 60, 'amie', 'amie'),
('pte_sx_k07', 'ptt_sx_culture', 'p21', '塩濃度', null, null, null, '未測定', null,
 null, null, null, 'unverified', 'meeting', '2026-04-06 SX定例MTG', null, 70, 'amie', 'amie'),
('pte_sx_k08', 'ptt_sx_culture', 'p21', '滞留時間', null, null, null, '未測定', null,
 null, 'リアクター内', null, 'unverified', 'meeting', '2026-06-26 SX MTG 三浦工業',
 '処理量と設備の大きさを決める項目。単価の根拠にも効く', 80, 'amie', 'amie'),
('pte_sx_k09', 'ptt_sx_culture', 'p21', '取り込める元素', null, null, null, '未確定', null,
 null, null, null, 'unverified', 'manual', null,
 '銅は JAFCO が関心を示した対象 (2026-05-13)。実際にどの元素をどれだけ取り込めるかは測定結果が要る', 90, 'amie', 'amie'),

-- 星取り表: 排水処理方式
('pte_sx_c11', 'ptt_sx_compare', 'p21', '処理単価', 'SX (自社)', 2500, 3000, null, '円/m3',
 'fair', '事業計画上の想定単価', '2026-03-30', 'high', 'meeting', '2026-03-30 SX MTG',
 '当初5,000円から調整して確定。三菱電機は現状以上の単価でも導入を検討する意向 (2026-03-31)', 11, 'amie', 'amie'),
('pte_sx_c12', 'ptt_sx_compare', 'p21', '処理単価', '既存の物理化学処理', null, 1200, '前後', '円/m3',
 'good', '顧客側の運転費として', '2026-07-07', 'medium', 'meeting', '2026-07-07 ビザスク面談 (山田様)',
 '石油化学・ファインケミカルの現場感として出た水準。検証対象の数字', 12, 'amie', 'amie'),
('pte_sx_c13', 'ptt_sx_compare', 'p21', '処理単価', '既存の生物処理', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null,
 'エキスパート面談で取る対象', 13, 'amie', 'amie'),

('pte_sx_c21', 'ptt_sx_compare', 'p21', '重金属の回収', 'SX (自社)', null, null, '回収を狙う', null,
 'good', null, null, 'medium', 'meeting', '2026-05-13 JAFCO面談',
 '金属採掘・精錬分野への応用として議論。銅回収に強い関心。取り込み量は未測定', 21, 'amie', 'amie'),
('pte_sx_c22', 'ptt_sx_compare', 'p21', '重金属の回収', '既存の物理化学処理', null, null, '汚泥として除去', null,
 'fair', null, null, 'medium', 'literature', null,
 '薬品で沈殿させるため金属は汚泥に混ざる。取り出して売るのは難しい', 22, 'amie', 'amie'),
('pte_sx_c23', 'ptt_sx_compare', 'p21', '重金属の回収', '既存の生物処理', null, null, '対象外', null,
 'na', null, null, 'medium', 'literature', null,
 '有機物の分解が目的の方式', 23, 'amie', 'amie'),

('pte_sx_c31', 'ptt_sx_compare', 'p21', '二酸化炭素', 'SX (自社)', null, null, '光合成で消費', null,
 'excellent', null, null, 'high', 'meeting', 'project_knowledge (p21 market)',
 '既存の排水処理課題とカーボンニュートラルを同時に扱う点が訴求軸', 31, 'amie', 'amie'),
('pte_sx_c32', 'ptt_sx_compare', 'p21', '二酸化炭素', '既存の物理化学処理', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null,
 '薬品製造分を含めた排出量は調べていない', 32, 'amie', 'amie'),
('pte_sx_c33', 'ptt_sx_compare', 'p21', '二酸化炭素', '既存の生物処理', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 33, 'amie', 'amie'),

('pte_sx_c41', 'ptt_sx_compare', 'p21', '汚泥の発生', 'SX (自社)', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null,
 '菌体そのものの処分をどうするかを含めて未整理', 41, 'amie', 'amie'),
('pte_sx_c42', 'ptt_sx_compare', 'p21', '汚泥の発生', '既存の物理化学処理', null, null, '産業廃棄物として発生', null,
 'poor', null, null, 'medium', 'meeting', '2026-07-07 ビザスク面談 (山田様)',
 '産廃の委託先が逼迫しているという現場感が出ている', 42, 'amie', 'amie'),
('pte_sx_c43', 'ptt_sx_compare', 'p21', '汚泥の発生', '既存の生物処理', null, null, '余剰汚泥が出る', null,
 'fair', null, null, 'medium', 'literature', null, null, 43, 'amie', 'amie'),

('pte_sx_c51', 'ptt_sx_compare', 'p21', '運転に要る人手', 'SX (自社)', null, 1, '年間3,000立方メートルあたり1人', '人',
 'unknown', '事業計画上の設計', null, 'medium', 'meeting', 'project_knowledge (p21 tech)',
 '人件費は給与の1.4倍として計上している', 51, 'amie', 'amie'),
('pte_sx_c52', 'ptt_sx_compare', 'p21', '運転に要る人手', '既存の物理化学処理', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 52, 'amie', 'amie'),
('pte_sx_c53', 'ptt_sx_compare', 'p21', '運転に要る人手', '既存の生物処理', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 53, 'amie', 'amie'),

-- 到達実績
('pte_sx_r01', 'ptt_sx_record', 'p21', 'バイオ装置 (マニホールド型)', null, 180, null, '実験室へ納品・設置', 'kg',
 null, '村上氏の考案。透明な水槽4本で細胞を循環', '2026-03-31', 'high', 'meeting', 'project_knowledge (p21 tech)',
 '当初の想定50kgを大きく超えた重量。観察用の窓と二酸化炭素の導入口を持つ', 10, 'amie', 'amie'),
('pte_sx_r02', 'ptt_sx_record', 'p21', '技術成熟度 (TRL)', null, 5, 6, '5 から 6 へ移行の見込み', null,
 null, '培養実験の開始による', '2026-04-01', 'high', 'meeting', 'project_knowledge (p21 tech)',
 '月内の時点。日付は月初で置いている', 20, 'amie', 'amie'),
('pte_sx_r03', 'ptt_sx_record', 'p21', '47リットル 縦型培養装置', null, 47, null, '試運転できる状態', 'L',
 null, null, '2026-05-01', 'high', 'meeting', 'project_knowledge (p21 tech)',
 '外部へ公開するときはヒーター部分を外し、計器類をぼかす方針', 30, 'amie', 'amie'),
('pte_sx_r04', 'ptt_sx_record', 'p21', '評価用の排水サンプル', null, 5, null, '繊維染色3種 / 磁性材料2種', '種',
 null, 'レアアース分析・pH調整・吸着試験の対象', '2026-06-24', 'high', 'meeting', '2026-06-24 SX定例MTG',
 null, 40, 'amie', 'amie'),
('pte_sx_r05', 'ptt_sx_record', 'p21', 'リアクターの特許出願', null, null, null, '弁理士と内容を打合せ', null,
 null, '出願完了まで約1か月の見込み', '2026-04-02', 'high', 'meeting', 'project_knowledge (p21 tech)',
 '出願完了後に佐竹氏と共同でリアクター製作へ入る予定', 50, 'amie', 'amie');

commit;
