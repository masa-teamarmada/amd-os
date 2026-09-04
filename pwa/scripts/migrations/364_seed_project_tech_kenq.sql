-- 364_seed_project_tech_kenq.sql
-- KENQ (p29) の技術タブを開ける。
--
-- なぜ (まさ 2026-09-04):
--   宇宙戦略基金の様式4・5をKENQへ提出した。ここまでに集めた技術・計画・座組の事実が
--   会話とメールにしか無く、PJコックピットの技術タブが空白のままだった。
--
-- 出典の性質 (spec 3-20 の 3.5 に対する断り):
--   p29 は source_cache に gmeet_minutes / drive が1件も無い。数値の一次情報は
--   KENQからの共有資料とメール、定例の議事にしか存在しないため、そこから取っている。
--   - 2026-08-19 KENQ久保田氏 → JOYCLE「開発計画の概要」(開示可能範囲に整理されたもの)
--   - 2026-08-03 KENQ久保田氏 → JOYCLE「宇宙戦略基金の連携についてのお願い」
--   - 2026-08-25 KENQ-teamARMADA 定例 (Circleback ノート)
--   - 2026-06-30 / 2026-07-14 定例 (Notion 議事録)
--   - JAXA 宇宙戦略基金 提案書様式 teianyoshiki_3_7.docx / 公募要領
--   連携機関である宇宙輸送システムメーカーの非公開仕様は共有されていない。
--   材料の実測スペック (耐用サイクル、面密度、熱伝導率) はそのため全て未入手で、
--   空欄にせず「未確定」+ unverified + needs_check で置く (spec 3-20 の 3.4)。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('seed_project_tech_kenq'));

-- ── トピック ────────────────────────────────────────────────
INSERT INTO public.project_tech_topics (
  tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain,
  sort_order, status, confidentiality, source_kind, source_ref, source_url,
  created_by, updated_by, needs_check, check_reason, updated_at
) VALUES

('ptt_kenq_tps_overview', 'p29', 'article',
 'スタンドオフ型熱防護システムとは',
 '再突入時に機体を守る仕組みと、KENQが狙うパネル方式が従来のタイル方式と何が違うか。',
 $body$
宇宙輸送機が大気圏へ再突入するとき、機体表面は空気との摩擦と圧縮で強く加熱される。KENQの計画では、この空力加熱環境を1000℃を超える領域として置いている。機体を守る仕組みが熱防護システム (TPS = Thermal Protection System) で、ここが持たなければ再使用はできない。

従来の再使用型宇宙機は、低密度のタイルを機体外側に一枚ずつ貼る方式が主流だった。断熱性能は出せるが、飛行のたびに割れや剥離を点検し、傷んだタイルを貼り替える必要があり、整備の手間と費用が再使用の利点を削ってしまう。

スタンドオフ型は、耐熱パネルを機体構造から離して支持する方式である。外側のパネル (アウターパネル) が熱を受け止め、パネルと機体構造の間にできる空間が断熱層として働く。パネル単位で取り外せるため、点検、交換、補修を部品単位で行える。**再使用性と整備性を同時に成立させることが、この方式を選ぶ理由**にあたる。

KENQが本事業で開発対象に置いているのは、このアウターパネルとなる耐熱材料とコーティング、およびその製造プロセスである。パネル方式は一枚あたりの面積が大きくなるため、材料そのものの性能に加えて「大きな部品を割らずに作れるか」が技術課題になる。開発計画で1m級の大型部品試作を中心に据えているのはこのためで、大型化の達成が3年目末のステージゲート評価の対象になる。
 $body$,
 '熱防護システム', 10, 'active', 'internal', 'literature',
 '2026-08-19 KENQ久保田氏→JOYCLE 開発計画の概要 / JAXA公募テーマ 宇宙輸送機の大気圏再突入における熱防護技術',
 'https://fund.jaxa.jp/techlist/theme3_7/',
 'amie', 'amie', false, null, now()),

('ptt_kenq_cmc_overview', 'p29', 'article',
 'SiC/SiC系セラミックス基複合材料 (CMC) とは',
 'アウターパネルの材料。CFRPのセラミックス版という位置づけと、KENQのコスト主張の根拠。',
 $body$
セラミックス基複合材料 (CMC = Ceramic Matrix Composites) は、セラミックスの繊維をセラミックスの母材で固めた複合材料である。炭素繊維強化プラスチック (CFRP) のセラミックス版にあたる、と説明されることが多い。

セラミックスは単体では硬いが脆く、ひびが入ると一気に割れる。繊維で補強すると、ひびが繊維に沿って逸れて進むため、割れ方が穏やかになる。この性質のおかげで、金属では溶けたり強度が落ちたりする温度域でも構造部品として使える。軽さ、強さ、耐熱性を同時に satisfies する材料はほかに少ない。

KENQが扱うのは、炭化ケイ素の繊維を炭化ケイ素の母材で固めた SiC/SiC 系である。技術チームはIHIグループの出身と説明されている。

**KENQのコストに関する中核の主張は、原料、繊維、CMC製造を分断せず一体で持つことで材料コストを下げられる、という点にある。** CMCは一般に、繊維が高価で、母材を隙間なく詰める工程 (緻密化) に時間がかかるため高コストになりやすい。工程を跨いで最適化できれば、そこを崩せるという立て方である。

宇宙輸送用途で求められるのは、性能だけでなく低コスト性、再使用性、再整備性の3つを同時に満たすことになる。
 $body$,
 '耐熱材料', 20, 'active', 'internal', 'meeting',
 '2026-06-30 / 2026-07-14 KENQ-teamARMADA 定例 (Notion議事録) / 2026-08-19 開発計画の概要',
 null,
 'amie', 'amie', true,
 'IHIグループ出身という記述は2026-06-17の初回打合せ由来で、誰がどの部署の出身かまでは確認していない。様式4の体制表を埋める際にKENQへ確認する',
 now()),

('ptt_kenq_tps_requirements', 'p29', 'condition',
 '熱防護システムに求められる条件',
 '分かっている要求条件と、まだKENQから共有されていない条件を同じ表に並べる。空欄にせず未確定と書く。',
 $body$
連携機関である宇宙輸送システムメーカーの仕様は非公開で、AMDには共有されていない。そのため材料の実測スペックにあたる行はほぼ全て未確定のまま置いている。**何を知らないかが表に出ていること自体が目的**なので、埋まるまで消さない。
 $body$,
 '熱防護システム', 30, 'active', 'confidential', 'literature',
 '2026-08-19 KENQ久保田氏→JOYCLE 開発計画の概要',
 null,
 'amie', 'amie', true,
 '耐用サイクル数、面密度、熱伝導率、許容熱流束といった要求値が未入手。2026-09-08定例でKENQへ開示可否を確認する',
 now()),

('ptt_kenq_dev_plan', 'p29', 'record',
 '開発計画の規模と時間軸',
 '5か年30億円の内訳と、ステージゲート、提出期限、各様式の進み方。',
 $body$
2026-08-19にKENQからJOYCLEへ開示可能な範囲で共有された開発計画と、2026-08-25定例での進捗をまとめている。金額はコスト試算タブが未整備のため、当面ここが唯一の置き場所になる。
 $body$,
 '開発計画', 40, 'active', 'confidential', 'literature',
 '2026-08-19 開発計画の概要 / 2026-08-25 KENQ-teamARMADA 定例',
 null,
 'amie', 'amie', false, null, now()),

('ptt_kenq_nonspace', 'p29', 'record',
 '非宇宙用途の連携先と現在地',
 'JOYCLE・ニプロ・タケエイほか。宇宙以外の応用をどう基金の申請に組み込んでいるか。',
 $body$
宇宙分野は認証取得に時間がかかる。その期間を非宇宙用途で埋め、製造技術の成熟と収益確保を先に進めるのが基本の立て方になっている。基金の申請上も、非宇宙の顧客候補から評価を受けることが審査の観点に入っている。

公募要領は、熱防護素材を開発する機関について、適用先候補である複数のロケット事業者や非宇宙輸送事業者からの評価を得られていることが望ましい、と定めている。評価の数ではなく内容を重視するとも書かれている。
 $body$,
 '非宇宙展開', 50, 'active', 'confidential', 'literature',
 '2026-08-03 / 2026-08-19 KENQ久保田氏→JOYCLE / JAXA公募要領 p.8, p.15',
 null,
 'amie', 'amie', false, null, now()),

('ptt_kenq_fund_setup', 'p29', 'article',
 '宇宙戦略基金の座組と、様式の分担',
 '誰が代表機関で誰が協力機関か。AMDがどの様式を書き、どういう形で入るのか。',
 $body$
### 実施体制の区分

公募要領は機関を3つに分けている。**代表機関**と**連携機関**は基金の資金配分を受け、実施体制に含まれる。**協力機関**は資金配分を受けずに開発の一部を担う機関で、実施体制には含まれず、JAXAへのシステム登録などの事務手続きも発生しない。

- 代表機関: 株式会社KENQ
- 連携機関: 宇宙輸送システムメーカー (非公開仕様と機密情報を多く含むため、AMDには社名を含め共有されていない)
- 協力機関: JOYCLE (非宇宙分野での試作品提供、炉内暴露、評価)

### 様式の分担

| 様式 | 内容 | 担当 |
| --- | --- | --- |
| 様式1〜3 | 技術開発課題の提案 | KENQ。2026-08-25時点でほぼ完成 |
| 様式4 | 代表機関としての技術開発マネジメントの計画 (5ページ以内) | AMD。文案を作成しKENQへ提出済み |
| 様式5 | 知的財産マネジメント (体制、業務フロー、帰属、オープン＆クローズ) | AMD |
| 様式5 の先行技術調査 | 特許調査・先行文献調査の結果と根拠資料 | KENQ。まさが2026-08-25定例で担当外と整理し合意済み |
| 様式13 | 社会実装に向けた事業計画 | KENQ。9月から顧客候補との議論を経て深める |

### AMDの入り方

**様式4にチームアルマダの社名は出さない (まさ確定 2026-09-01)。** 事務局には「公的資金による大型技術開発の管理実務を経験した人材を外部から受け入れて配置する」と書き、社名を伏せた。

これは2026-07-20に笹山さんから示された整理と揃う。実担当者はKENQへ派遣という形で入って基金のプロジェクト管理を担い、KENQの人件費として基金に請求できる形にする。AMDへの業務委託はプロセスデータ等も含む幅のある契約になる想定なので、基金の直接費には含めない方向で契約する。

この整理がKENQ側で今も生きているかは2026-08-25の議事からは確認できていない。様式の文面はどちらに転んでも変わらないため、提出作業を止める論点ではない。

### 期限

- 提案書全体: 2026年9月24日 正午
- ステークホルダー評価シート (JAXAへ): 2026年10月1日 正午
 $body$,
 '公的資金', 60, 'active', 'confidential', 'literature',
 'JAXA公募要領 p.8 / 提案書様式 teianyoshiki_3_7.docx / 2026-08-25 定例 / 2026-07-20 笹山氏 Slack',
 'https://fund.jaxa.jp/techlist/theme3_7/',
 'amie', 'amie', true,
 '実担当者のKENQ派遣と、AMD業務委託を基金の直接費に含めない整理が今も有効かを2026-09-08定例で突き合わせる',
 now()),

('ptt_kenq_ip_policy', 'p29', 'article',
 '知財のオープン＆クローズ方針 (様式5)',
 '何を特許にし、何を秘匿し、何を標準化に回すか。共有知財が事業化を妨げる論点も含む。',
 $body$
様式5でKENQへ提出した方針の要約。KENQの確認前なので、確定した社内方針ではない。

### 創出が見込まれる知的財産

1. SiC繊維、前駆体、マトリックス、コーティングの組成・合成方法・表面処理
2. CMCの成形、含浸、緻密化、接合、短時間・低コスト製造方法
3. 製造装置、治具、工程制御、品質管理、スケールアップ
4. 熱防護パネルの層構成、取付け、シール、断熱、交換・補修構造
5. 試験方法、検査方法、劣化判定、寿命予測、再使用可否の評価方法
6. 製造条件・試験条件・物性・劣化・コストを関連付けたデータと解析手法
7. 非宇宙の高温用途へ適用するための部材設計、製造方法、運用方法

### 守り方の使い分け

| 区分 | 対象 | 方針 |
| --- | --- | --- |
| 特許化 | 製品や公開情報から推定されやすい材料組成、部材構造、製造方法、装置、接合、検査、補修 | 事業展開国と競合を踏まえて出願し、排他性を確保する |
| 秘匿化 | 工程温度、圧力、時間、原料仕様、設備設定、歩留まり、品質管理値、コスト、不具合対策 | 営業秘密として区分し、アクセスを絞る |
| 公開 | 安全性の説明、競争力を損なわない研究成果、人材育成に資する一般知見 | 出願と秘密確認の後に公開し、共同研究と顧客開拓を促す |
| 標準化 | 材料・部材の共通試験方法、性能表示、検査、補修性、システムとの接続条件 | 市場形成に有効で、特許・営業秘密と矛盾しない範囲だけ |

特許明細書だけでは再現できない工程条件や品質管理の知見を営業秘密として併せ持つことで、権利期間中の排他性と、権利満了後も残る製造上の優位性を両立させる立て方にしている。

### 共有知財が事業化を妨げる論点

中核となる材料組成、製造方法、部材構造はKENQ単独帰属を基本に置いた。共有になると、量産投資の判断、資金調達、第三者へのライセンス、非宇宙への横展開のそれぞれで共有者全員の同意が必要になり、事業化の速度が制約されるためである。

システム側の要求と一体で成立する取付け構造、シール、運用方法は連携機関との共同発明になる可能性が高い。この範囲については、自己実施を無償かつ制限なく認めること、競合しない範囲での第三者許諾の枠を事前に決めること、非宇宙分野はKENQが単独で判断できるよう分野を限定した実施権にすること、を共同出願契約で定める形にしている。
 $body$,
 '知財', 70, 'active', 'internal', 'manual',
 '宇宙戦略基金 様式5 AMD文案 (Drive: ARMADA/p29_kenq/260828_宇宙戦略基金/提案書様式_様式4_5_AMD追記.docx)',
 null,
 'amie', 'amie', true,
 'KENQの知財責任者、外部弁理士、既存の知財規程が未確認。先行技術調査の結果もKENQ側にあり未入手',
 now())

ON CONFLICT (tech_topic_id) DO UPDATE SET
  block_kind = EXCLUDED.block_kind,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md,
  tech_domain = EXCLUDED.tech_domain,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  confidentiality = EXCLUDED.confidentiality,
  source_kind = EXCLUDED.source_kind,
  source_ref = EXCLUDED.source_ref,
  source_url = EXCLUDED.source_url,
  updated_by = EXCLUDED.updated_by,
  needs_check = EXCLUDED.needs_check,
  check_reason = EXCLUDED.check_reason,
  updated_at = now();

-- ── 熱防護システムに求められる条件 ──────────────────────────
INSERT INTO public.project_tech_entries (
  tech_entry_id, tech_topic_id, project_id, row_label, col_label,
  value_min, value_max, value_text, unit, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order,
  created_by, updated_by, needs_check, check_reason, updated_at
) VALUES
('pte_kenq_req01','ptt_kenq_tps_requirements','p29','空力加熱環境の温度',null,
 1000,null,'1000℃を超える','℃',null,'大気圏再突入時の機体表面',null,
 'high','literature','2026-08-19 開発計画の概要','上限値は示されていない。どこまでを設計点に置くかは未確定',10,
 'amie','amie',false,null,now()),
('pte_kenq_req02','ptt_kenq_tps_requirements','p29','構造方式',null,
 null,null,'スタンドオフ型 (アウターパネルを機体構造から離して支持)',null,null,null,null,
 'high','literature','2026-08-19 開発計画の概要',null,20,
 'amie','amie',false,null,now()),
('pte_kenq_req03','ptt_kenq_tps_requirements','p29','アウターパネルの材料',null,
 null,null,'SiC/SiC系セラミックス基複合材料 + コーティング',null,null,null,null,
 'high','literature','2026-08-19 開発計画の概要',null,30,
 'amie','amie',false,null,now()),
('pte_kenq_req04','ptt_kenq_tps_requirements','p29','再使用性',null,
 null,null,'再使用を前提とする',null,null,null,null,
 'high','literature','2026-08-19 開発計画の概要','何回の再使用を要求するかは未確定',40,
 'amie','amie',false,null,now()),
('pte_kenq_req05','ptt_kenq_tps_requirements','p29','整備性',null,
 null,null,'パネル単位で点検・交換・補修ができること',null,null,null,null,
 'high','literature','2026-08-19 開発計画の概要',null,50,
 'amie','amie',false,null,now()),
('pte_kenq_req06','ptt_kenq_tps_requirements','p29','部品サイズ (開発目標)',null,
 1,null,'1m級大型部品','m',null,'試作で成立させる寸法','2029-03-31',
 'high','literature','2026-08-19 開発計画の概要','大型化開発は3年目末 (2029年度) までに完了させる見込み',60,
 'amie','amie',false,null,now()),
('pte_kenq_req07','ptt_kenq_tps_requirements','p29','耐用サイクル数',null,
 null,null,'未確定',null,null,null,null,
 'unverified','estimate','AMD未入手',null,70,
 'amie','amie',true,'再使用を何回想定するかで材料要求が変わる。連携機関の仕様に紐づくため、2026-09-08定例でKENQへ開示可否を確認する',now()),
('pte_kenq_req08','ptt_kenq_tps_requirements','p29','面密度',null,
 null,null,'未確定',null,null,null,null,
 'unverified','estimate','AMD未入手',null,80,
 'amie','amie',true,'機体重量への効き方を示す基本値。既存タイル方式との比較にも必要',now()),
('pte_kenq_req09','ptt_kenq_tps_requirements','p29','熱伝導率・許容熱流束',null,
 null,null,'未確定',null,null,null,null,
 'unverified','estimate','AMD未入手',null,90,
 'amie','amie',true,'断熱層の設計条件。パネルと機体構造の間隔の根拠になる',now()),
('pte_kenq_req10','ptt_kenq_tps_requirements','p29','耐酸化・耐熱衝撃の要求',null,
 null,null,'未確定',null,null,null,null,
 'unverified','estimate','AMD未入手',null,100,
 'amie','amie',true,'コーティングの必要性能を決める条件。様式2の技術内容側にある可能性が高い',now()),

-- ── 開発計画の規模と時間軸 ──────────────────────────────────
('pte_kenq_plan01','ptt_kenq_dev_plan','p29','事業期間',null,
 null,null,'2027年度から2031年度までの5か年',null,null,null,'2026-08-19',
 'high','literature','2026-08-19 開発計画の概要',null,10,
 'amie','amie',false,null,now()),
('pte_kenq_plan02','ptt_kenq_dev_plan','p29','ステージゲート評価',null,
 null,null,'3年目末 (2029年度末)',null,null,null,'2026-08-19',
 'high','literature','2026-08-19 開発計画の概要','耐熱材の大型化をこの時点までに完了させる見込み',20,
 'amie','amie',false,null,now()),
('pte_kenq_plan03','ptt_kenq_dev_plan','p29','事業規模',null,
 3000000000,null,'全体で約30億円程度','円',null,null,'2026-08-19',
 'high','literature','2026-08-19 開発計画の概要','コスト試算タブが未整備のため、当面この行が金額の置き場所になる',30,
 'amie','amie',true,'内訳 (人件費・設備費・外注費) が未入手。様式9別紙2の予算計画をKENQから受け取れば確定する',now()),
('pte_kenq_plan04','ptt_kenq_dev_plan','p29','予算の配分',null,
 null,null,'過半を耐熱材料・コーティングの製造プロセス高度化と1m級大型部品の試作へ',null,null,null,'2026-08-19',
 'high','literature','2026-08-19 開発計画の概要',null,40,
 'amie','amie',false,null,now()),
('pte_kenq_plan05','ptt_kenq_dev_plan','p29','公募テーマの枠',null,
 null,null,'支援総額95億円 / 1件あたり最大35億円 / 採択約4件 / 補助率1-1',null,null,null,'2026-07-16',
 'medium','literature','2026-07-16 AMD OS PRSレビュー時のメモ',null,50,
 'amie','amie',true,'2026-07-10の公募開始時に控えた数字で、公募要領の原本と突き合わせていない。Driveの公募要領.pdfで確認する',now()),
('pte_kenq_plan06','ptt_kenq_dev_plan','p29','提案書の提出期限',null,
 null,null,'2026年9月24日 正午',null,null,null,'2026-08-25',
 'high','literature','JAXA公募要領 / 提案書様式',null,60,
 'amie','amie',false,null,now()),
('pte_kenq_plan07','ptt_kenq_dev_plan','p29','ステークホルダー評価シートの提出期限',null,
 null,null,'2026年10月1日 正午 (JAXAへ顧客候補が直接提出)',null,null,null,'2026-08-03',
 'high','literature','2026-08-03 KENQ久保田氏→JOYCLE',null,70,
 'amie','amie',false,null,now()),
('pte_kenq_plan08','ptt_kenq_dev_plan','p29','様式1〜3 (技術開発提案) の状況',null,
 null,null,'ほぼ完成。協力会社への依頼分も進行中',null,null,null,'2026-08-25',
 'high','meeting','2026-08-25 KENQ-teamARMADA 定例',null,80,
 'amie','amie',false,null,now()),
('pte_kenq_plan09','ptt_kenq_dev_plan','p29','様式4・5 (マネジメント・知財) の状況',null,
 null,null,'AMDが文案を作成し、変更履歴とコメント付きでKENQへ提出済み',null,null,null,'2026-09-04',
 'high','manual','Drive: ARMADA/p29_kenq/260828_宇宙戦略基金/提案書様式_様式4_5_AMD追記.docx','KENQが埋める箇所は本文ではなくWordのコメントに分けてある。21件',90,
 'amie','amie',false,null,now()),
('pte_kenq_plan10','ptt_kenq_dev_plan','p29','事業計画部分 (様式13) の状況',null,
 null,null,'9月頭から顧客候補との議論を経て深める。最終的に評価シートを書いてもらう想定',null,null,null,'2026-08-25',
 'medium','meeting','2026-08-25 KENQ-teamARMADA 定例',null,100,
 'amie','amie',false,null,now()),
('pte_kenq_plan11','ptt_kenq_dev_plan','p29','他社との作り込みの差',null,
 null,null,'公募が出てから検討を始めたメーカーが多く、KENQは数年来の準備があるため差があると笹山氏は見ている',null,null,null,'2026-08-25',
 'low','meeting','2026-08-25 KENQ-teamARMADA 定例','KENQ側の見立てであり、裏付けとなる他社情報は無い',110,
 'amie','amie',true,'競合となる提案の数と質は外から見えない。採否の見通しをこの発言だけで立てない',now()),

-- ── 非宇宙用途の連携先と現在地 ──────────────────────────────
('pte_kenq_ns01','ptt_kenq_nonspace','p29','JOYCLE (協力機関として)',null,
 null,null,'協力機関としての参画を依頼し、前向きな回答を得ている。小型廃棄物処理装置 JOYCLE box への試作品適用PoC。基金の資金配分枠外のため、JAXAへの登録等の事務手続きは発生しない',null,null,null,'2026-08-03',
 'high','literature','2026-08-03 KENQ久保田氏→JOYCLE / 公募要領 p.8',null,10,
 'amie','amie',false,null,now()),
('pte_kenq_ns02','ptt_kenq_nonspace','p29','JOYCLE (顧客候補として)',null,
 null,null,'ステークホルダー評価シートの記入を依頼。開発計画の概要を8月19日に共有し、9月初旬にオンラインで説明。JAXAへの提出期限は10月1日正午',null,null,null,'2026-08-19',
 'high','literature','2026-08-19 KENQ久保田氏→JOYCLE',null,20,
 'amie','amie',true,'9月初旬のオンラインMTGが実施されたか、評価シートの記入が進んでいるかを2026-09-08定例で確認する',now()),
('pte_kenq_ns03','ptt_kenq_nonspace','p29','ニプロ',null,
 null,null,'2026年8月21日の群馬・前橋での見学会に同行。装置のスポンサーとしての連携を検討',null,null,null,'2026-08-21',
 'medium','literature','2026-08-19 KENQ久保田氏→JOYCLE',null,30,
 'amie','amie',false,null,now()),
('pte_kenq_ns04','ptt_kenq_nonspace','p29','タケエイ',null,
 null,null,'同見学会に同行。廃棄物処理側の連携候補',null,null,null,'2026-08-21',
 'medium','literature','2026-08-19 KENQ久保田氏→JOYCLE',null,40,
 'amie','amie',false,null,now()),
('pte_kenq_ns05','ptt_kenq_nonspace','p29','医療機器メーカー (前橋)',null,
 null,null,'面談済みで連携の可能性あり',null,null,null,'2026-08-25',
 'low','meeting','2026-08-25 KENQ-teamARMADA 定例',null,50,
 'amie','amie',true,'社名も連携の具体像も未確認。顧客候補の評価シートを依頼する相手になるかを含めてKENQへ確認する',now()),
('pte_kenq_ns06','ptt_kenq_nonspace','p29','想定する非宇宙の領域',null,
 null,null,'廃棄物発電、原子力・核融合、航空・防衛、太陽熱、地熱、量子関連部品',null,null,null,'2026-06-30',
 'medium','meeting','2026-06-30 KENQ-teamARMADA 定例 (Notion議事録)','領域の列挙であり、個別の引き合いがあるわけではない',60,
 'amie','amie',false,null,now()),
('pte_kenq_ns07','ptt_kenq_nonspace','p29','非宇宙を置く理由',null,
 null,null,'宇宙分野は認証取得に時間がかかるため、その間に非宇宙用途で製造技術の成熟と収益確保を進める',null,null,null,'2026-06-30',
 'high','meeting','2026-06-30 定例 / 2026-08-19 開発計画の概要',null,70,
 'amie','amie',false,null,now()),
('pte_kenq_ns08','ptt_kenq_nonspace','p29','ストーリーライン',null,
 null,null,'医療廃棄物 × JOYCLE box × 宇宙用耐熱材料の応用、その後に高効率廃棄物発電へ展開',null,null,null,'2026-08-19',
 'high','literature','2026-08-19 KENQ久保田氏→JOYCLE',null,80,
 'amie','amie',false,null,now())

ON CONFLICT (tech_entry_id) DO UPDATE SET
  tech_topic_id = EXCLUDED.tech_topic_id,
  row_label = EXCLUDED.row_label,
  col_label = EXCLUDED.col_label,
  value_min = EXCLUDED.value_min,
  value_max = EXCLUDED.value_max,
  value_text = EXCLUDED.value_text,
  unit = EXCLUDED.unit,
  rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on,
  confidence = EXCLUDED.confidence,
  source_kind = EXCLUDED.source_kind,
  source_ref = EXCLUDED.source_ref,
  note = EXCLUDED.note,
  sort_order = EXCLUDED.sort_order,
  updated_by = EXCLUDED.updated_by,
  needs_check = EXCLUDED.needs_check,
  check_reason = EXCLUDED.check_reason,
  updated_at = now();

COMMIT;
