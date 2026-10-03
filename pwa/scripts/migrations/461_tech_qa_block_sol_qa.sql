-- 技術台帳の5つ目の形「QA集」と、SOL（p21）の QA集・DDパッケージへの掲載（2026-10-03）
--
-- まさの依頼（2026-10-03）:
--   「DDパッケージのところにQA集を新たに作ってほしい。今回もQAいっぱい発生してると思うので、そこから得た情報をベースに作って」
--   「質問された回数の多いものから順にソーティングされるようにして。回数が同じ場合には、より頻繁に質問されそうかどうかを
--    えいみが判断して、重要度で★、★★、★★★の3段階でソーティングしてほしい」
--   「（投資家に）見せていいよ。むしろ見てもらうために作った」
-- 1. project_tech_topics.block_kind に 'qa' を足す（並びは画面で毎回計算: 回数 → ★。spec 3-20 §3）
-- 2. SOL の QA集（19問）: 2026-10-01〜02 の愛媛での面談6件の書き起こしから、相手が質問・懸念として出したものを数えた。
--    回数 = その質問が出た面談の数。こちらから先に説明しただけのものは数えない。相手の社名は伏せて業種で書く（面談で社名を出さないと約束しているため）。
-- 3. DDパッケージ sol の「事業概要」の先頭に載せ、公開にする（パッケージ自体は未公開のまま。閲覧権限も作らない）
-- 生成: scratchpad の m461.py（コミットしない）

BEGIN;

SELECT set_config('app.workspace_migration', '461', true);

ALTER TABLE public.project_tech_topics DROP CONSTRAINT IF EXISTS project_tech_topics_block_kind_check;
ALTER TABLE public.project_tech_topics ADD CONSTRAINT project_tech_topics_block_kind_check
  CHECK (block_kind = ANY (ARRAY['condition'::text, 'article'::text, 'matrix'::text, 'record'::text, 'qa'::text]));

INSERT INTO public.project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality,
  source_kind, source_ref, needs_check, check_reason, created_by, updated_by)
VALUES ('ptt_sol_qa', 'p21', 'qa', $m$よく聞かれる質問と答え（QA集）$m$,
  $m$投資家・事業会社・排液を出す企業から実際に聞かれた質問と答え。聞かれた回数の多い順、同じ回数なら重要度（★★★ ほどよく聞かれそうなもの）の高い順に並ぶ。$m$,
  $m$2026年10月1〜2日の愛媛での面談6件（金融機関1件、排液を出す企業など5件）の書き起こしから作った。回数は、その質問が出た面談の数。新しい面談で同じ質問が出たら回数を足すと、並びが自動で変わる。$m$,
  'QA集', 7, 'active', 'public', 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, false, NULL, 'amie', 'amie')
ON CONFLICT (tech_topic_id) DO UPDATE SET block_kind = EXCLUDED.block_kind, title = EXCLUDED.title, summary = EXCLUDED.summary, body_md = EXCLUDED.body_md,
  tech_domain = EXCLUDED.tech_domain, confidentiality = EXCLUDED.confidentiality, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_01$m$, 'ptt_sol_qa', 'p21', $m$菌はどうやって用意し、どう増やすのか。毎回どこかから採ってくるのか。$m$, $m$研究室で保有している高熱性シアノバクテリアの株を培養して使う。自然界から毎回採ってくるのではない。光とCO2があれば増え（空気中のCO2でも増え、工場の排ガスのCO2を使うと速くなる）、30℃以上でよく増える。事業では自社の培養拠点で増やし、カートリッジに詰めて顧客の工場のリアクターへ届ける。処理（取り込み）の段階では、菌を増やす必要はない。$m$, 3, $m$excellent$m$, $m$銀行系VC・非鉄の製錬会社・改質リグニンの製造会社$m$, DATE '2026-10-02', $m$high$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 10,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_02$m$, 'ptt_sol_qa', 'p21', $m$今の排水処理（薬品・活性汚泥・膜）と比べて、何が違い、何が優れるのか。$m$, $m$薬品を足さずに、CO2を使って増える微生物が汚れを細胞に取り込む。①中和・凝集沈殿の薬品とスラッジを減らせる。②約90℃まで働くので、熱い排水を冷まさずに処理できる。③高温で育つので雑菌が入りにくい。④金属は細胞の中に濃縮されるので、汚泥に混ざらず回収・再利用できる。既存の処理を置き換えるのではなく、既存のラインに後付けする。$m$, 2, $m$excellent$m$, $m$非鉄の製錬会社・改質リグニンの製造会社$m$, DATE '2026-10-02', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, $m$既存の処理と同じ物差し（処理量・速度・容量・費用）での比較は、工場規模の実証で示す。方式ごとの比較は「既存の処理方式との比較」の項目。$m$, 20,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_03$m$, 'ptt_sol_qa', 'p21', $m$工場の規模（毎分数m³、1日100t超）で使えるのか。$m$, $m$現在は10Lのリアクターで、10Lの鉄の排液を約1時間で処理できた（予定は1日）。カートリッジに少しずつ通す方式の方が、まとめて入れる方式より速い傾向がある。菌の量を増やすほど速くなり、今の実験の約100倍までは増やせる見込み（研究者の見解）。次は大型化と縦型化に進む。$m$, 2, $m$excellent$m$, $m$非鉄の製錬会社・改質リグニンの製造会社$m$, DATE '2026-10-02', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 30,
  true, $m$工場規模での処理速度と容量は、まだ実証していない$m$, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_04$m$, 'ptt_sol_qa', 'p21', $m$取り込んだ金属はどこに溜まり、どう取り出すのか。$m$, $m$金属は細胞の中に取り込まれる。処理の後、細胞をフィルターで集めると、1トンの液でも細胞は握りこぶしほどの量になる。そこに酸をかけて金属を溶かし出して回収する。2〜3種類の金属が混ざっている場合は、その後にさらに分ける工程が要る。$m$, 2, $m$excellent$m$, $m$銀行系VC・非鉄の製錬会社$m$, DATE '2026-10-02', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, $m$細胞から金属を取り出す工程の回収率は、試験の段階。$m$, 40,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_05$m$, 'ptt_sol_qa', 'p21', $m$COD・窒素・リン・油は、どれだけ下がるのか。$m$, $m$食品工場の排液で、CODが2,000超から500程度まで下がった例がある（条件による）。窒素・リンは、食品工場の実排液で確かめている最中。油そのものは得意ではなく、油が多いと細胞が死ぬおそれがあるので、油を分解した後の液に使う。SS・ノルマルヘキサンはまだ測っていない。$m$, 2, $m$good$m$, $m$食品工場・改質リグニンの製造会社$m$, DATE '2026-10-02', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 50,
  true, $m$窒素・リンの低減は実排液で確認中$m$, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_06$m$, 'ptt_sol_qa', 'p21', $m$金属が混ざっていても取れるのか。どの金属が取れるのか。$m$, $m$鉛・クロム・亜鉛・カドミウム・銅・アルミ・鉄・ストロンチウムで検証済み。ネオジム・ジスプロシウムなどのレアアースも取り込み、磁性材料メーカーの実排液ではネオジムを30分でほぼ取り込んだ。ニッケルも取り込む。1種類だけなら約30分、複数が混ざっていても約24時間でほぼ取り切る。取り込む順番があり、銅・アルミ・鉄を先に取り込んで、ニッケルは最後になる。$m$, 2, $m$good$m$, $m$銀行系VC・非鉄の製錬会社$m$, DATE '2026-10-02', $m$high$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 60,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_07$m$, 'ptt_sol_qa', 'p21', $m$実際の工場の排液は集まるのか。何社分あるのか。$m$, $m$当初の目標の10社を超え、20社以上・20種類以上の実排液で試験している。企業は排液を外に出したがらないが、金融機関・自治体・大学の紹介で集まった。社名は出さず「会社A」などで扱い、必要に応じて秘密保持契約を結ぶ。事業になったら装置を顧客の工場に置いて処理するので、排液を持ち出す必要はない。$m$, 2, $m$good$m$, $m$銀行系VC・非鉄の製錬会社$m$, DATE '2026-10-02', $m$high$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 70,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_08$m$, 'ptt_sol_qa', 'p21', $m$処理の値段と原価は成り立つのか。$m$, $m$色素分解は、工場の排液・排ガス・排熱を培養に使える条件で、原価が約400円/m³（2026年9月時点の試算）。市場の処理価格は500〜700円/m³で、規模の効果を入れる前の数字。金属回収は、いまの試算では原価が売価を上回っており、回収した金属の価値と運転条件の詰めがこれからの課題。条件を変えて試算できる仕組みを作ってある。$m$, 1, $m$excellent$m$, $m$銀行系VC$m$, DATE '2026-10-01', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, $m$試算の中身は「採算（コスト試算）」の項目。$m$, 80,
  true, $m$金属回収の採算は未解決（試算の原価が売価を上回る）$m$, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_09$m$, 'ptt_sol_qa', 'p21', $m$会社がまだ無いのに、出資・DD・秘密保持契約はどう進めるのか。$m$, $m$DDは会社の設立前から始められる。出資は、設立する会社（2027年4月1日設立予定）へ直接入れてもらう。秘密保持契約は、PSI GAPファンドのステップ2で事業化の業務を受託しているチームアルマダが当事者になって結ぶ。企業との基本合意書は、設立までは愛媛大学の名義で結び、設立後に会社へ移す。$m$, 1, $m$excellent$m$, $m$銀行系VC$m$, DATE '2026-10-01', $m$high$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 90,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_10$m$, 'ptt_sol_qa', 'p21', $m$資本政策はどう考えているのか（創業時の持分、シードの規模、放出の割合）。$m$, $m$創業時は代表が約8割、研究者側に約2割を想定。シードは評価額の上限5億円で1億円規模（〜1.5億円）を集め、放出は2割程度に抑えたい。地元の企業・投資家を優先する。売上が立った後に、株式の一部を会社が買い戻せる条項を株主間契約に入れることも検討している。$m$, 1, $m$excellent$m$, $m$銀行系VC$m$, DATE '2026-10-01', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, $m$計画の段階で、条件は未確定。表は「資本政策」の項目。$m$, 100,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_11$m$, 'ptt_sol_qa', 'p21', $m$出口（IPO）と、シリーズAに進む条件は。$m$, $m$シリーズAは約1年3か月後に、プレの評価額12億円超を目標にしている。条件は、有償のPoCを3件取り、売上として数えられる状態にすること。最終的にはIPOを視野に入れており、海外の市場を取るときの信用のためにも上場が有効と考えている。シードの後は補助金（NEDOのSTSなど）と融資も組み合わせて、株の放出を抑える。$m$, 1, $m$excellent$m$, $m$銀行系VC$m$, DATE '2026-10-01', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 110,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_12$m$, 'ptt_sol_qa', 'p21', $m$今ある処理設備のどこに入れるのか。$m$, $m$既存の排水ラインに後付けするカートリッジ型のリアクターにする。入れる位置は液ごとに決める。金属を含む液は中和剤を入れる前（ナトリウムが増える前）、食品工場の液は油を分解した後。膜分離（MBR）の槽に菌を入れる形も考えられる。$m$, 1, $m$excellent$m$, $m$改質リグニンの製造会社$m$, DATE '2026-10-02', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 120,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_13$m$, 'ptt_sol_qa', 'p21', $m$使えない液はあるのか（塩分・低温・油・有機溶媒）。$m$, $m$海水並み（約3.4%）の塩分では働かない。中和剤を入れた後の液はナトリウムが多いので、中和の前の液で使う。光合成を止める農薬・薬剤や、界面活性剤が多い液も使えない。10〜20℃では働きが落ちる。油が多い液は、油を分解した後に使う。$m$, 1, $m$good$m$, $m$非鉄の製錬会社$m$, DATE '2026-10-02', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 130,
  true, $m$低温での取り込みはまだ測っていない$m$, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_14$m$, 'ptt_sol_qa', 'p21', $m$設立の時期と、研究費が終わってから設立までの空白は。$m$, $m$2027年4月1日の設立を予定している。研究費（PSI GAPファンドのステップ2）は2027年3月まで。3月末の設立も検討しており、装置の改良費を残して開発を止めないようにする。$m$, 1, $m$good$m$, $m$銀行系VC$m$, DATE '2026-10-01', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, $m$3月末の設立は大学と調整中。$m$, 140,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_15$m$, 'ptt_sol_qa', 'p21', $m$光はどれくらい要るのか。$m$, $m$処理（取り込み）の段階では、室内灯くらいの光で足りる。強い光が要るのは菌を増やす培養の段階で、市販のLEDで足りる（紫外線だけの光源は不可）。培養の照明の電気代はコスト試算に入れている。$m$, 1, $m$good$m$, $m$改質リグニンの製造会社$m$, DATE '2026-10-02', $m$high$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 150,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_16$m$, 'ptt_sol_qa', 'p21', $m$実験の数字はどんな条件で出したのか（バッチか連続か、菌の量は）。$m$, $m$これまで示してきた浄化の数字は、菌の量をそろえて、まとめて入れるバッチ式で比べたもの。新しく作ったカートリッジに少しずつ通す方式では、さらに速い傾向が出ている。菌の量を増やせば速くなるので、工場ごとに菌の量を合わせる。$m$, 1, $m$good$m$, $m$非鉄の製錬会社$m$, DATE '2026-10-02', $m$medium$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 160,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_17$m$, 'ptt_sol_qa', 'p21', $m$1,4-ジオキサン・リグニン・フッ素など、分解しにくい物は処理できるのか。$m$, $m$1,4-ジオキサンとフッ素は、まだ試していない。高分子のリグニンを細胞に直接取り込むのは難しいが、分解されてできた糖など、CODの元になる物は処理の対象になりうる（研究者の見解）。どれも実サンプルで確かめる段階。$m$, 1, $m$fair$m$, $m$改質リグニンの製造会社$m$, DATE '2026-10-02', $m$low$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 170,
  true, $m$未試験$m$, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_18$m$, 'ptt_sol_qa', 'p21', $m$ラウンドテーブルと出資は、どういう関係なのか。$m$, $m$瀬戸内産業排水ラウンドテーブル（SIER）は、排液を出す企業・設備メーカー・金融機関・地元メディアが同じ場で状況を共有する円卓。まず基本合意書（MOU）を結び、役割が見えたら個別の契約に進む。月1回の事業報告で進み具合を共有する。出資は円卓ではなく、設立する会社へ直接入れてもらう。$m$, 1, $m$fair$m$, $m$銀行系VC$m$, DATE '2026-10-01', $m$high$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 180,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

INSERT INTO public.project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, value_min, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sol_qa_19$m$, 'ptt_sol_qa', 'p21', $m$なぜ銀行から話が来るのか。$m$, $m$地元の金融機関が、取引先の中から排水を出す企業を紹介し、サンプル提供の相談を仲介してくれている。金融機関は取引先の環境対応とサプライチェーンづくりを後押しする立場で、ラウンドテーブルにも参画する。$m$, 1, $m$fair$m$, $m$非鉄の製錬会社$m$, DATE '2026-10-02', $m$high$m$, 'meeting', $m$2026-10-01〜02 愛媛での面談6件の書き起こし（相手の社名は伏せた）$m$, NULL, 190,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, rating = EXCLUDED.rating,
  condition_text = EXCLUDED.condition_text, observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, note = EXCLUDED.note,
  needs_check = EXCLUDED.needs_check, check_reason = EXCLUDED.check_reason, updated_by = 'amie', updated_at = NOW();

DO $$
DECLARE
  v_pkg UUID;
BEGIN
  SELECT id INTO v_pkg FROM public.dd_packages WHERE slug = 'sol' AND project_id = 'p21';
  IF v_pkg IS NULL THEN RAISE EXCEPTION 'SOL DD package is missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dd_package_items WHERE package_id = v_pkg AND source_key = 'project_tech_topic:ptt_sol_qa' AND status = 'active') THEN
    INSERT INTO public.dd_package_items (package_id, project_id, section_key, item_kind, source_key, source_options, title, summary, sort_order,
      created_by_member_id, updated_by_member_id, is_published, published_at, published_by_member_id)
    VALUES (v_pkg, 'p21', 'business', 'tech_topic', 'project_tech_topic:ptt_sol_qa', '{}'::jsonb,
      'よく聞かれる質問と答え（QA集）', '実際に聞かれた質問と答え。聞かれた回数の多い順、同じ回数なら重要度（★）の高い順。', 5,
      'ID001', 'ID001', TRUE, NOW(), 'ID001');
  END IF;
END $$;

DO $chk$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.project_tech_entries WHERE tech_topic_id = 'ptt_sol_qa';
  IF n <> 19 THEN RAISE EXCEPTION 'qa entries: expected 19, got %', n; END IF;
  SELECT count(*) INTO n FROM public.dd_package_items WHERE source_key = 'project_tech_topic:ptt_sol_qa' AND status = 'active' AND is_published;
  IF n <> 1 THEN RAISE EXCEPTION 'qa dd item: expected 1 published, got %', n; END IF;
END $chk$;

COMMIT;
