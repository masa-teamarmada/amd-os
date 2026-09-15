-- KUTE 第2領域：公式研究シーズ集から追加する候補 15 件（No.23〜37）
--
-- review-first の候補登録。研究者への打診、共同研究、知財許諾、PJ化、SPS/BZM 評価は行わない。
-- summary / envisioned_use_case は公開一次資料で確認できる技術事実だけを保持する。
-- 仮説・比較試験・見送り条件・知財の未確認事項は、それぞれ専用列へ分離する。
-- 市場規模は根拠がないため NULL。公式URLは seed_news に構造化登録する。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('kute_seed_candidates_23_37_20260915'));

CREATE TEMP TABLE kute_seed_candidates (
  seed_no integer PRIMARY KEY,
  title text NOT NULL,
  summary text NOT NULL,
  researcher_name text NOT NULL,
  researcher_title text NOT NULL,
  domain_lane text NOT NULL,
  industry_target text[] NOT NULL,
  keywords text[] NOT NULL,
  envisioned_use_case text NOT NULL,
  additional_research_hypothesis text NOT NULL,
  next_verification_step text NOT NULL,
  biggest_bottleneck text NOT NULL,
  ip_status text NOT NULL,
  source_url text NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO kute_seed_candidates (
  seed_no, title, summary, researcher_name, researcher_title, domain_lane,
  industry_target, keywords, envisioned_use_case,
  additional_research_hypothesis, next_verification_step,
  biggest_bottleneck, ip_status, source_url
) VALUES
  (23,
   '飛沫・気泡・粉末の運動計測',
   '【事実】マイクロ〜ミリメートルの液滴・気泡・粒子を、高速度撮影、光干渉、赤外線等で計測し、液体中・気体中の対象の挙動を予測・制御する。',
   '山本 憲', '准教授', 'materials',
   ARRAY['半導体製造','電池製造','流体計測']::text[],
   ARRAY['液滴','気泡','粒子','高速度撮影','光干渉','赤外線']::text[],
   '【事実】液体・気体中の微小な液滴、気泡、粒子の運動計測・予測・制御。',
   '【仮説】半導体・電池製造の微小気泡・異物による歩留まり低下を、工程内で診断する受託計測へ寄せる。\n【提案】対象工程を一つに絞り、気泡・異物の発生条件と不良率の因果モデルを作る。',
   '【提案】既存カメラ計測と、検出限界・誤検出率・解析時間・工程停止の有無を比較する。',
   '【提案】対象粒径・速度で既存手法を上回れない、または現場設置できない。',
   '【未確認】測定アルゴリズム・装置の出願、共同研究先の権利、実施許諾条件は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007589-att/e6h3ce0000005kjt.pdf'),
  (24,
   '超微量元素を選択検出する多重反射レーザー分析',
   '【事実】波長可変レーザー、レーザー共鳴イオン化、FIB-TOF-SIMS、多重反射機構を組み合わせ、元素選択性と感度を高める。視野幅1μm、面分解能40nmの成分イメージング例が掲載されている。',
   '坂本 哲夫', '教授', 'materials',
   ARRAY['次世代電池','半導体','故障解析']::text[],
   ARRAY['微量元素','波長可変レーザー','共鳴イオン化','FIB-TOF-SIMS','多重反射','元素イメージング']::text[],
   '【事実】材料中の超微量元素の選択検出と局所成分イメージング。',
   '【仮説】次世代電池・半導体の局所異常だけを高感度に見る故障解析受託サービスへ寄せる。\n【提案】電池材料または先端半導体の一材料に絞り、標準試料ライブラリを作る。',
   '【提案】SIMSと同一試料を比較し、検出下限・局所分解能・分析時間・試料損傷を測る。',
   '【提案】既存SIMSに対する感度・分解能・費用の優位性が出ない。',
   '【未確認】公開資料に特許出願の記載はあるが、請求項・権利範囲・帰属・実施許諾条件は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007589-att/no3tij0000002f3t.pdf'),
  (25,
   '自転車サドルの左右別荷重・股関節負担計測',
   '【事実】市販サドルの下に3軸荷重センサーを複数配置し、荷重の大きさ・方向・中心位置を左右別に計測する。特許第6782486号の記載がある。',
   '桐山 善守', '教授', 'life',
   ARRAY['リハビリテーション','在宅医療','スポーツ計測']::text[],
   ARRAY['サドル','3軸荷重センサー','左右差','股関節','荷重計測']::text[],
   '【事実】自転車走行時の左右別荷重、荷重方向、荷重中心位置の計測。',
   '【仮説】競技用の出力計測ではなく、訪問・在宅リハビリで股関節の左右差を経時記録する評価機器へ寄せる。\n【提案】競技性能より、退院後の継続リハビリ向けに装着簡便性と再現性を研究する。',
   '【提案】理学療法士評価、床反力計、既存パワーメーターとの一致度を比較する。',
   '【提案】市販自転車への取付が難しい、または左右差が臨床判断に結び付かない。',
   '【未確認】特許第6782486号の実施許諾、医療用途の権利、計測データの利用条件は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007589-att/no3tij0000002f3q.pdf'),
  (26,
   '耳小骨病変の機械学習診断',
   '【事実】連続周波数ティンパノメトリとニューラルネットワークで、耳小骨の固着・離断の診断精度向上を目指す。資料では従来法の正診率を約50％と説明している。',
   '向井 正和', '准教授', 'life',
   ARRAY['耳鼻咽喉科','医療機器','遠隔医療']::text[],
   ARRAY['耳小骨','ティンパノメトリ','ニューラルネットワーク','機械学習','診断支援']::text[],
   '【事実】連続周波数ティンパノメトリによる耳小骨の固着・離断の診断支援。',
   '【仮説】診断確定ではなく、耳鼻科医不足地域向けの専門医紹介優先順位付けソフトへ寄せる。\n【提案】施設差・機器差に強い学習、説明可能性、偽陰性抑制を研究する。',
   '【提案】複数施設の匿名データで、専門医判断・既存検査と感度・特異度を比較する。',
   '【提案】施設外データで精度が急落、または倫理・医療機器対応が見込めない。',
   '【未確認】学習データの利用権、医療機器該当性、共同研究・知財の帰属は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007589-att/fbb28u00000079kd.pdf'),
  (27,
   '携帯型PM2.5・黄砂粒子捕集装置',
   '【事実】Siウエハ上にPM2.5・黄砂等を均一捕集し、電子顕微鏡で個々の粒子を観察する。粒径・形状の画像処理が可能である。',
   '坂本 哲夫', '教授', 'gx_circular',
   ARRAY['環境計測','工場','建設現場','学校']::text[],
   ARRAY['PM2.5','黄砂','Siウエハ','電子顕微鏡','粒径','粒子形状']::text[],
   '【事実】PM2.5・黄砂等の粒子を捕集し、粒径・形状を観察・画像処理する環境計測。',
   '【仮説】工場・建設現場・学校周辺で、粒子数だけでなく粒子の種類・由来を判別する短期調査サービスへ寄せる。\n【提案】地域ごとの粒子指紋データベースと、採取から分析までの標準手順を整備する。',
   '【提案】既存PM2.5測定器と並行測定し、捕集再現性・分析時間・粒子識別精度を比較する。',
   '【提案】採取後の分析費・時間が高すぎる、または由来判別に結び付かない。',
   '【未確認】捕集構造、ウエハ処理、画像処理ソフトの権利と共同研究先の利用条件は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007589-att/fbb28u00000079lg.pdf'),
  (28,
   'バイオマス廃棄物を直接使う1kW級燃料電池',
   '【事実】メタン濃縮なしでバイオガスを直接供給できる1kW級燃料電池を開発し、遠隔監視を含む運転試験を行っている。資料ではエンジン発電機の2〜3倍の発電効率を訴求している。',
   '白鳥 祐介', '教授', 'gx_energy',
   ARRAY['食品工場','畜産施設','バイオガス','非常用電源']::text[],
   ARRAY['バイオマス廃棄物','バイオガス','燃料電池','1kW','遠隔監視','発電効率']::text[],
   '【事実】メタン濃縮なしのバイオガスを用いる1kW級燃料電池と遠隔監視運転。',
   '【仮説】小規模食品工場・畜産施設向けに、廃棄物処理費削減と非常用電源を一体化する用途へ寄せる。\n【提案】原料変動、硫黄被毒、保守周期、発電量の実運用データを蓄積する。',
   '【提案】既存ガスエンジンと、発電効率・保守費・停止時間・処理費を同じ原料条件で比較する。',
   '【提案】原料変動で安定運転できない、または保守費が発電価値を上回る。',
   '【未確認】セル構造、既存共同研究、地域・海外での権利、導入許諾条件は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007cdh-att/no3tij0000006r0e.pdf'),
  (29,
   '不確実環境下の知能移動体の行動決定',
   '【事実】不完全な観測データから、探索・計測・推定・制御を統合し、安全かつ効率的に行動を決めるアルゴリズムである。災害対応ロボットを応用例とする。',
   '禹 ハンウル', '准教授', 'robo',
   ARRAY['工場設備点検','災害対応','ロボット']::text[],
   ARRAY['自律移動','探索','計測','推定','制御','不確実環境']::text[],
   '【事実】不完全観測下の移動体が探索・計測・推定・制御を統合して行動決定するロボット技術。',
   '【仮説】工場停止を避けるため、未知箇所を自律巡回する設備点検ロボットへ寄せる。\n【提案】粉じん・暗所・通信断・段差など工場条件に特化した安全制約を研究する。',
   '【提案】既存SLAM・遠隔操作と探索時間、未観測箇所、衝突率、通信断時の復帰率を比較する。',
   '【提案】安全保証ができない、または既存自律走行との差が小さい。',
   '【未確認】アルゴリズム、学習データ、実機・共同研究先の権利と利用条件は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007htz-att/e6h3ce0000009yuo.pdf'),
  (30,
   'エレクトロスプレーによる電極上限定塗布',
   '【事実】エレクトロスプレー・デポジション法による電極上の選択的塗布を研究し、液晶向け低コスト遮光技術への応用論文を掲載している。',
   '工藤 幸寛', '准教授', 'materials',
   ARRAY['電池','センサー','液晶','印刷製造']::text[],
   ARRAY['エレクトロスプレー','選択塗布','電極','遮光','膜厚']::text[],
   '【事実】エレクトロスプレー・デポジション法による電極上の選択的塗布。',
   '【仮説】電池・センサーで、必要箇所だけを塗る少量多品種製造へ寄せる。\n【提案】塗布位置精度、膜厚均一性、材料歩留まり、基板サイズ拡張を研究する。',
   '【提案】スプレー塗布・印刷・フォトリソグラフィと材料使用量、線幅、処理時間を比較する。',
   '【提案】位置精度や量産性が既存印刷法に及ばない。',
   '【未確認】塗布装置・方法の権利、液晶応用論文の権利関係、共同研究先の利用条件は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007htz-att/r8c3sp00000087xz.pdf'),
  (31,
   '2軸回転ワイヤ放電加工・細穴放電加工',
   '【事実】2軸回転軸付きワイヤ放電加工による複雑形状加工、パイプ電極と加工液圧制御による細穴の高速加工を研究し、導電性難削材に適用できる。',
   '武沢 英樹', '教授', 'materials',
   ARRAY['航空部品','医療部品','試作加工','修理']::text[],
   ARRAY['ワイヤ放電加工','細穴放電加工','2軸回転','パイプ電極','難削材']::text[],
   '【事実】導電性難削材の複雑形状・細穴を加工する放電加工技術。',
   '【仮説】航空・医療部品の試作・修理専用の複雑流路加工サービスへ寄せ、量産ではなく短納期に絞る。\n【提案】材料別の加工条件データベースと加工後の寸法保証を整備する。',
   '【提案】従来ワイヤ放電加工・レーザー加工と、加工時間、形状誤差、工具消耗、後処理を比較する。',
   '【提案】複雑形状での精度・時間優位が出ない。',
   '【未確認】機械改造・制御方法の権利、第三者設備との実施関係、共同研究先は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007htz-att/no3tij0000006vuk.pdf'),
  (32,
   '口腔内5次元モニタリング',
   '【事実】虫歯・歯周病予防、口腔内健康レベル評価、歯科治療支援を用途とし、歯の位置分析・領域抽出に関する特許記載がある。',
   '須賀 一博', '准教授', 'life',
   ARRAY['歯科','訪問歯科','介護施設','口腔ケア']::text[],
   ARRAY['口腔内計測','虫歯','歯周病','歯の位置','領域抽出','5次元']::text[],
   '【事実】口腔内の状態を計測し、虫歯・歯周病予防、健康評価、歯科治療を支援する技術。',
   '【仮説】訪問歯科・介護施設で、治療判断ではなく口腔状態の経時変化を記録するモニタリングへ寄せる。\n【提案】撮影条件のばらつき、経時変化指標、介護職でも扱える操作性を研究する。',
   '【提案】歯科医評価と再現性、記録時間、見逃し率を比較する。',
   '【提案】画像の撮影条件依存が強い、または医療機器化の負担が大きい。',
   '【未確認】特許出願の登録・存続・請求項、装置の権利、データ管理条件は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007htz-att/t5eu690000014qj3.pdf'),
  (33,
   '文書生成AIを使う情報検索・推薦基盤',
   '【事実】検索観点の多様化、欠損情報の可視化、読解問題生成、商品選択基準の抽出を行う文書生成AIの情報検索・推薦基盤である。',
   '北山 大輔', '准教授', 'ict',
   ARRAY['産学連携','研究機関','情報検索','推薦']::text[],
   ARRAY['文書生成AI','情報検索','推薦','欠損情報','読解問題','嗜好抽出']::text[],
   '【事実】文書生成AIを用い、検索観点の多様化、欠損情報の可視化、質問生成、選択基準抽出を行う情報検索・推薦。',
   '【仮説】大学の規程・研究シーズ・共同研究候補を対象に、根拠と不足情報を分けて提示する産学連携探索支援へ寄せる。\n【提案】事実・仮説・未確認の分離、出典保持、推薦理由の説明、機密情報境界を研究する。',
   '【提案】通常検索・汎用生成AIと、候補発見数、誤引用率、確認時間、見落とし率を比較する。',
   '【提案】出典誤りが許容水準を超える、または汎用AIとの差が出ない。',
   '【未確認】モデル・データ・プロンプト・評価方法、大学内データの利用範囲は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007jam-att/t1dlg80000000pm2.pdf'),
  (34,
   '脳外科手術向け患部提示AR',
   '【事実】タブレット上で患部の3Dモデルを現実空間に重ね、マーカーとドイツ水平線を基準に位置ずれを抑える脳外科手術向けARアプリである。',
   '張 珏', '准教授', 'life',
   ARRAY['脳外科','医療教育','手術シミュレーション','AR']::text[],
   ARRAY['AR','3Dモデル','脳外科','マーカー','位置合わせ','タブレット']::text[],
   '【事実】患部3Dモデルを現実空間に重ねて提示する脳外科手術向けARアプリ。',
   '【仮説】まず手術ではなく、医学生・研修医向け術野シミュレーション教育へ展開する。\n【提案】教育用症例の標準化、位置合わせ誤差、操作ログ、学習効果を研究する。',
   '【提案】紙教材・通常3D教材と、患部位置理解、操作時間、誤認率を比較する。',
   '【提案】位置合わせが不安定、教育効果が出ない、または医療現場導入要件が過大。',
   '【未確認】アプリ・位置合わせ手法・症例データの権利、病院との契約、医療用途の規制対応は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007jam-att/t1dlg80000000plt.pdf'),
  (35,
   'オオスズメバチ由来の創薬候補化合物',
   '【事実】オオスズメバチ由来の生物活性物質を探索し、Chit1阻害成分と小胞体ストレスによる細胞死を守る物質の2種を単離・機能解析している。',
   '大野 修', '教授', 'life',
   ARRAY['創薬研究','細胞研究','試薬']::text[],
   ARRAY['オオスズメバチ','生物活性物質','Chit1','小胞体ストレス','細胞保護']::text[],
   '【事実】オオスズメバチ由来の2種の生物活性物質を単離し、Chit1阻害と細胞保護の機能を解析する研究。',
   '【仮説】医薬品そのものより、炎症・細胞ストレス研究用の標準化試薬・評価系から始める。\n【提案】作用機序、合成・供給方法、選択性、毒性、類縁体展開を研究する。',
   '【提案】既存Chit1阻害剤・細胞保護剤と活性、選択性、毒性、合成費を比較する。',
   '【提案】再現合成が難しい、活性が弱い、既存化合物との差がない。',
   '【未確認】資料記載の出願状況、化合物構造の公開範囲、権利帰属、供給・第三者利用条件は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007iag-att/hpl4jh0000001lpt.pdf'),
  (36,
   '静電気による電子機器故障・感電の防止設計',
   '【事実】帯電人体等が電子機器筐体付近を移動した際の静電誘導電圧を評価し、誤動作・故障・感電災害を防ぐ設計に役立てる。具体例として−10kV・−30kVを扱う。',
   '市川 紀充', '准教授', 'materials',
   ARRAY['データセンター','医療施設','電子機器','安全設計']::text[],
   ARRAY['静電気','静電誘導電圧','ESD','電子機器故障','感電','低湿度']::text[],
   '【事実】帯電体による電子機器筐体近傍の静電誘導電圧を評価し、故障・誤動作・感電を防ぐ設計。',
   '【仮説】低湿度のデータセンター・医療施設向けに、機器導入前の静電気リスク設計診断へ寄せる。\n【提案】設備・床材・衣服・湿度別の再現試験と故障確率モデルを整備する。',
   '【提案】既存ESD試験と、現場環境再現時の故障予測精度、試験時間、対策費を比較する。',
   '【提案】実環境の故障と相関しない、または既存規格試験と重複する。',
   '【未確認】計測・評価方法の特許、適用規格、事故データの利用権と診断責任範囲は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007itv-att/hpl4jh0000001lr9.pdf'),
  (37,
   'デマンドレスポンス向け電力価格予測',
   '【事実】卸電力市場の極値発生タイミングを重視した価格予測手法であり、単純な予測誤差よりデマンドレスポンス収益性との相関が高い指標を使う。',
   '蔡 思楠', '助教', 'gx_energy',
   ARRAY['電力小売','中小工場','デマンドレスポンス','蓄電池']::text[],
   ARRAY['電力価格予測','デマンドレスポンス','極値','需要制御','蓄電池']::text[],
   '【事実】卸電力価格の極値タイミングを重視し、デマンドレスポンス収益性との相関を評価する予測手法。',
   '【仮説】中小工場向けに、電力価格予測だけでなく、生産を止めずに移動できる負荷まで提案する省エネ運用支援へ寄せる。\n【提案】工場制約を含む最適化、予測外れ時の損失制御、蓄電池・太陽光との統合を研究する。',
   '【提案】既存予測モデルと年間収益、ピーク回避量、制御回数、逸失利益を比較する。',
   '【提案】価格変動が小さい期間に収益優位が出ない、または制御対象が少ない。',
   '【未確認】予測アルゴリズム・学習データ・電力事業者や工場との契約・利用権は未確認。',
   'https://www.kogakuin.ac.jp/research/seeds/fbb28u0000007itv-att/pt3p030000001ijy.pdf');

DO $preflight$
DECLARE
  kute_count integer;
  numbered_count integer;
  distinct_number_count integer;
  source_count integer;
BEGIN
  IF (SELECT count(*) FROM kute_seed_candidates) <> 15 THEN
    RAISE EXCEPTION 'Expected exactly 15 candidate rows (No.23-37)';
  END IF;
  IF (SELECT min(seed_no) FROM kute_seed_candidates) <> 23
     OR (SELECT max(seed_no) FROM kute_seed_candidates) <> 37 THEN
    RAISE EXCEPTION 'Candidate seed_no range is not 23-37';
  END IF;
  IF (SELECT count(DISTINCT regexp_replace(title, '[[:space:]　]+', '', 'g')) FROM kute_seed_candidates) <> 15 THEN
    RAISE EXCEPTION 'Candidate titles collide after whitespace normalization';
  END IF;
  IF (SELECT count(DISTINCT source_url) FROM kute_seed_candidates) <> 15 THEN
    RAISE EXCEPTION 'Candidate official source URLs are not unique';
  END IF;
  IF (SELECT count(*) FROM public.institutions WHERE institution_id = 'inst_kute') <> 1 THEN
    RAISE EXCEPTION 'inst_kute is missing';
  END IF;

  SELECT count(*) INTO kute_count
  FROM public.seeds
  WHERE institution_id = 'inst_kute';
  SELECT count(*) INTO numbered_count
  FROM public.seeds
  WHERE institution_id = 'inst_kute' AND seed_no BETWEEN 1 AND 22;
  SELECT count(DISTINCT seed_no) INTO distinct_number_count
  FROM public.seeds
  WHERE institution_id = 'inst_kute';
  IF kute_count <> 22 OR numbered_count <> 22 OR distinct_number_count <> 22 THEN
    RAISE EXCEPTION 'Expected exactly 22 existing KUTE seeds numbered 1-22 (count=%, numbered=%, distinct_no=%)',
      kute_count, numbered_count, distinct_number_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.seeds
    WHERE institution_id = 'inst_kute' AND (seed_no IS NULL OR seed_no < 1 OR seed_no > 22)
  ) THEN
    RAISE EXCEPTION 'Existing KUTE seed_no has a gap, duplicate scope, or out-of-range value';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.seeds s
    JOIN kute_seed_candidates c
      ON regexp_replace(s.title, '[[:space:]　]+', '', 'g')
       = regexp_replace(c.title, '[[:space:]　]+', '', 'g')
    WHERE s.institution_id = 'inst_kute'
  ) THEN
    RAISE EXCEPTION 'A KUTE title already exists after whitespace normalization';
  END IF;
  SELECT count(*) INTO source_count
  FROM public.seeds s
  JOIN kute_seed_candidates c ON s.seed_no = c.seed_no
  WHERE s.institution_id = 'inst_kute';
  IF source_count <> 0 THEN
    RAISE EXCEPTION 'KUTE seed_no 23-37 is already occupied';
  END IF;
END $preflight$;

CREATE TEMP TABLE kute_seed_link_baseline ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.seed_projects) AS seed_projects_count,
  (SELECT count(*) FROM public.seeds WHERE spun_off_project_id IS NOT NULL) AS spun_off_count,
  (SELECT count(*) FROM public.seed_sps_assessments) AS sps_count,
  (SELECT count(*) FROM public.seed_bzm30_inputs) AS bzm_inputs_count,
  (SELECT count(*) FROM public.seed_bzm30_scores) AS bzm_scores_count,
  (SELECT count(*) FROM public.seed_bzm30_sensitivity) AS bzm_sensitivity_count,
  (SELECT count(*) FROM public.seed_news) AS seed_news_count;

CREATE TEMP TABLE kute_inserted_seeds (
  seed_no integer PRIMARY KEY,
  seed_id uuid NOT NULL,
  title text NOT NULL,
  source_url text NOT NULL
) ON COMMIT DROP;

WITH inserted AS (
  INSERT INTO public.seeds (
    title, summary, org_name, org_type, org_region, researcher_name, researcher_title,
    domain_lane, industry_target, keywords, status, next_action, internal_notes,
    public_summary, is_public, source, source_detail, discovery_status,
    envisioned_use_case, first_customer_candidate, market_size_range,
    market_size_confidence, biggest_bottleneck, ip_status, next_verification_step,
    institution_id, seed_no, additional_research_hypothesis
  )
  SELECT
    c.title, c.summary, '工学院大学', 'university', '東京都', c.researcher_name, c.researcher_title,
    c.domain_lane, c.industry_target, c.keywords, 'candidate',
    '研究継続状況・事業化意思・知財窓口を確認する',
    '【事実】summaryは工学院大学公式研究シーズ集の技術記載のみ。\n【運用】仮説・提案・未確認は専用列へ分離し、初回登録ではSPS/BZM/PJを作成しない。',
    c.summary, FALSE, 'web_search', '工学院大学公式研究シーズ集（KUTE 第2領域追加調査 2026-09-15）', 'discovered',
    c.envisioned_use_case, NULL, NULL, NULL, c.biggest_bottleneck, c.ip_status, c.next_verification_step,
    'inst_kute', c.seed_no, c.additional_research_hypothesis
  FROM kute_seed_candidates c
  ORDER BY c.seed_no
  RETURNING id, title
)
INSERT INTO kute_inserted_seeds (seed_no, seed_id, title, source_url)
SELECT c.seed_no, i.id, i.title, c.source_url
FROM inserted i
JOIN kute_seed_candidates c ON c.title = i.title;

INSERT INTO public.seed_news (
  seed_id, kind, title, body, source_url, ingested_by, verified, dismissed
)
SELECT
  i.seed_id,
  'publication',
  '工学院大学公式研究シーズ集：' || i.title,
  '【事実】工学院大学公式研究シーズ集に掲載された技術事実の参照元。',
  i.source_url,
  'manual', TRUE, FALSE
FROM kute_inserted_seeds i
ORDER BY i.seed_no;

DO $verify$
DECLARE
  total_kute integer;
  inserted_count integer;
  news_count integer;
  expected_news_count bigint;
BEGIN
  SELECT count(*) INTO total_kute FROM public.seeds WHERE institution_id = 'inst_kute';
  SELECT count(*) INTO inserted_count FROM kute_inserted_seeds;
  SELECT count(*) INTO news_count FROM public.seed_news n JOIN kute_inserted_seeds i ON i.seed_id = n.seed_id;
  SELECT seed_news_count + 15 INTO expected_news_count FROM kute_seed_link_baseline;

  IF total_kute <> 37 OR inserted_count <> 15 OR news_count <> 15 THEN
    RAISE EXCEPTION 'KUTE post-insert counts failed (total=%, inserted=%, news=%)', total_kute, inserted_count, news_count;
  END IF;
  IF (SELECT count(*) FROM public.seed_news) <> expected_news_count THEN
    RAISE EXCEPTION 'seed_news count changed by other than the 15 official source rows';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.seeds s
    JOIN kute_inserted_seeds i ON i.seed_id = s.id
    WHERE s.institution_id IS DISTINCT FROM 'inst_kute'
       OR s.seed_no IS NULL OR s.seed_no NOT BETWEEN 23 AND 37
       OR s.status IS DISTINCT FROM 'candidate'
       OR s.discovery_status IS DISTINCT FROM 'discovered'
       OR s.is_public IS DISTINCT FROM FALSE
       OR s.title IS NULL OR s.summary IS NULL OR s.org_name IS NULL
       OR s.researcher_name IS NULL OR s.researcher_title IS NULL
       OR s.additional_research_hypothesis IS NULL
       OR s.next_verification_step IS NULL OR s.biggest_bottleneck IS NULL
       OR s.ip_status IS NULL
       OR s.summary !~ '^【事実】'
       OR s.summary ~ '【仮説】|【提案】|【未確認】|【見送り】'
       OR s.envisioned_use_case !~ '^【事実】'
       OR s.market_size_range IS NOT NULL
       OR s.market_size_confidence IS NOT NULL
       OR s.trl IS NOT NULL OR s.brl IS NOT NULL OR s.hrl IS NOT NULL
       OR s.amd_rating IS NOT NULL OR s.amd_rating_note IS NOT NULL
       OR s.spun_off_project_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'One or more inserted KUTE seeds violate state, required-field, separation, or NULL-market assertions';
  END IF;
  IF (SELECT count(DISTINCT seed_no) FROM public.seeds WHERE institution_id = 'inst_kute') <> 37
     OR EXISTS (
       SELECT 1 FROM generate_series(1,37) n
       WHERE NOT EXISTS (SELECT 1 FROM public.seeds s WHERE s.institution_id = 'inst_kute' AND s.seed_no = n)
     ) THEN
    RAISE EXCEPTION 'KUTE seed numbers 1-37 are not complete and unique';
  END IF;
  IF EXISTS (SELECT 1 FROM public.seed_projects p JOIN kute_inserted_seeds i ON i.seed_id = p.seed_id)
     OR EXISTS (SELECT 1 FROM public.seed_sps_assessments a JOIN kute_inserted_seeds i ON i.seed_id = a.seed_id)
     OR EXISTS (SELECT 1 FROM public.seed_bzm30_inputs b JOIN kute_inserted_seeds i ON i.seed_id = b.seed_id)
     OR EXISTS (SELECT 1 FROM public.seed_bzm30_scores b JOIN kute_inserted_seeds i ON i.seed_id = b.seed_id)
     OR EXISTS (SELECT 1 FROM public.seed_bzm30_sensitivity b JOIN kute_inserted_seeds i ON i.seed_id = b.seed_id) THEN
    RAISE EXCEPTION 'New KUTE seeds unexpectedly received SPS/BZM/PJ links';
  END IF;
  IF (SELECT count(*) FROM public.seed_projects) <> (SELECT seed_projects_count FROM kute_seed_link_baseline)
     OR (SELECT count(*) FROM public.seeds WHERE spun_off_project_id IS NOT NULL) <> (SELECT spun_off_count FROM kute_seed_link_baseline)
     OR (SELECT count(*) FROM public.seed_sps_assessments) <> (SELECT sps_count FROM kute_seed_link_baseline)
     OR (SELECT count(*) FROM public.seed_bzm30_inputs) <> (SELECT bzm_inputs_count FROM kute_seed_link_baseline)
     OR (SELECT count(*) FROM public.seed_bzm30_scores) <> (SELECT bzm_scores_count FROM kute_seed_link_baseline)
     OR (SELECT count(*) FROM public.seed_bzm30_sensitivity) <> (SELECT bzm_sensitivity_count FROM kute_seed_link_baseline) THEN
    RAISE EXCEPTION 'SPS/BZM/PJ baseline counts changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM kute_inserted_seeds i
    WHERE NOT EXISTS (
      SELECT 1 FROM public.seed_news n
      WHERE n.seed_id = i.seed_id AND n.source_url = i.source_url
        AND n.kind = 'publication' AND n.verified IS TRUE AND n.dismissed IS FALSE
    )
  ) THEN
    RAISE EXCEPTION 'Every new KUTE seed must have one verified official seed_news source';
  END IF;
END $verify$;

COMMIT;
