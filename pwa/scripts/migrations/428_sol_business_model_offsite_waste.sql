-- 428: SOL（p21）の事業計画グループに足した「ビジネスモデル」タブに、2026-09-14 のオフサイト廃液処理の検証を置く。
-- まさ 2026-09-14「そもそも本来はOSに置くべき資料だと思う。…事業計画グループの中に「ビジネスモデル」っていうタブを新たに追加して、その中に入れておくのはどう？」
-- 技術台帳（project_tech_topics / project_tech_entries）に区分「ビジネスモデル」のトピック10件・行49件を足す。すべて社内限定。
-- 評価 → オンサイトとオフサイトの比較 → 事業の形の選択肢 → 対象になる廃液と量 → 引き取りの値段 → 菌で処理できる濃さ → 許可 → 競合 → 反社会的勢力 → 確認事項。
-- 原本は Drive `p21_sol/260914_オフサイト廃液処理の検証`。試算の数字は 427 を当てた後のコスト試算（廃液）の値で、正本はコスト試算（spec 3-20 §3.5）。生成: scratchpad gen_bm.py（コミットしない）。
begin;
do $do$ begin
  if not exists (select 1 from projects where project_id = $t$p21$t$) then raise exception 'PJ p21 が無い'; end if;
  if exists (select 1 from project_tech_topics where project_id = $t$p21$t$ and tech_domain = $t$ビジネスモデル$t$) then raise exception '区分「ビジネスモデル」のトピックがすでにある'; end if;
  if exists (select 1 from project_tech_topics where tech_topic_id in ($t$ptt_sol_bm_offsite_eval$t$, $t$ptt_sol_bm_compare$t$, $t$ptt_sol_bm_options$t$, $t$ptt_sol_bm_market$t$, $t$ptt_sol_bm_price$t$, $t$ptt_sol_bm_fit$t$, $t$ptt_sol_bm_permit$t$, $t$ptt_sol_bm_competitors$t$, $t$ptt_sol_bm_antisocial$t$, $t$ptt_sol_bm_questions$t$)) then raise exception '足すトピックの id がすでにある'; end if;
  if exists (select 1 from project_tech_entries where tech_entry_id like $t$pte_sol_bm_%$t$) then raise exception '足す行の id がすでにある'; end if;
end $do$;
insert into project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality, source_kind, source_ref, source_url, needs_check, check_reason, created_by, updated_by) values ($t$ptt_sol_bm_offsite_eval$t$, $t$p21$t$, $t$article$t$, $t$オフサイトの廃液処理の評価 — 2026-09-14 の検証の結論$t$, $t$特管を含む廃液をSOLのタンクローリーで集め、SOL工場で処理する事業を、量・技術・許可・競合・反社会的勢力の面から検証した結論。いまの時期に並行して始める事業としては勧めない。$t$, $t$**一言でいうと** — 特別管理産業廃棄物（以下、特管）を含む廃液を、SOLが許可を持つタンクローリーで集めてSOL工場で処理する事業は、会社設立（2027年3月予定）から最初の実証を終えるまでの時期に並行して始める事業としては勧めない。オフサイトの処理を残すなら、特管に当たるかどうかではなく**菌で処理する意味がある液か**で対象を選び、許可と設備を持つ既存の処理業者と組む形から試す。

### 理由

1. **地域の量が小さい。** 環境省の推計（令和4年度）で、愛媛県で出る特管の廃酸・廃アルカリは年約4,900t、四国4県でも約13,000t。コスト試算（廃液）のオフサイトの置き値（年30,000m³）は四国全体の2倍を超える。全量を1kgあたり100円で引き取っても四国全体で年約13億円で、その液はいま既存の処理業者が受けている
2. **高く引き取れる液ほど、菌では処理しにくい。** 必要な菌体の量は金属の濃さに比例する。いまの取り込みの値（乾燥菌体1gあたり鉄0.053g、単回の試験値）では、金属5,000mg/Lの液1m³に乾燥菌体が約105kg要り、菌体の重さが液の1割を超える。特管の廃酸・廃アルカリは国が定めた方法（環境省の概要では中和、焼却、イオン交換設備等での再生）で処分するので、菌が働ける場面は中和の後になる
3. **許可と設備が重い。** 1日100m³を処理するなら、中和施設（1日50m³超）が施設の設置許可の対象になり、生活環境影響調査、書類の縦覧、住民の意見書、専門家と市町村長の意見聴取が加わる。タンクローリー、受け入れ検査、中和・脱水の設備、汚泥の処分、技術管理者も自社で持つことになる
4. **同じ土俵に大手がいる。** 工場廃液の処理を本業とするダイセキは、2027年2月期の予想で売上742億円、営業利益168億円（利益率 約23%）で、広島県東広島市に処理拠点を持つ

### 試算で見たオフサイト（2026-09-14 時点）

コスト試算（廃液）のオフサイトは、売価を液の引き取りの値段（1m³あたり50,000円＝1Lあたり50円）に置き、引き取る液の濃さもオンサイトと別に置いている（仮置き 色素1,000mg/L・金属5,000ppm）。濃さを顧客工場の排水と同じ50mg/Lにしていたときは、利益率が94%前後になっていた。数字の正本はコスト試算（廃液）で、前提を変えると動く。

| 用途 | 1m³あたりの総コスト（直接投入） 自然株 / 強化株 | 利益率 自然株 / 強化株 |
|---|---:|---:|
| 色素分解 | 3,941.7円 / 4,007.6円 | 92.1% / 92.0% |
| 金属回収 | 51,110.3円 / 43,357.6円 | -2.2% / 13.3% |

金属回収は、使い切る菌体の費用（強化株で1m³あたり約35,040円）と使用済み菌体の後処理（約4,061円）が総コストの大半を占め、自然株では売価を超える。

### 反社会的勢力について

許可を持って行う廃液の中間処理は、設備投資が大きく、大手・上場企業が中心である。警察庁の最新の報告書（令和6年における組織犯罪の情勢）が、暴力団が進出・関与している事業として挙げるのは金融業・建設業・労働者派遣業・風俗営業等で、「産業廃棄物」という語は本文に出てこない。

一方で、2008年度の環境省の調査では、許可業者の14.9%が反社会的勢力から不当要求を受けたことがあると答え、処分費を下げるための無許可業者への持ち込みや、最終処分場の権利の売買に反社会的勢力が関わるという証言もあった。いまの実態を示す公的な調査は見つからなかった。既存の商流を荒らすと危ないという懸念を裏づける資料も、危なくないと言い切れる資料もない。事業として割に合わない以上、このリスクを取りにいく理由は薄い。詳しくは「反社会的勢力と既存業者のリスク」。

### このあと決めること

- どの事業の形を取るか（「オフサイトの事業の形の選択肢」の5つの案）【要判断】
- 誰に何を聞けば決まるかは「確認事項」

### 出典

検証の資料は Drive `p21_sol/260914_オフサイト廃液処理の検証`（md・html）。一次資料は各トピックの出典に載せている。$t$, $t$ビジネスモデル$t$, 10, $t$active$t$, $t$internal$t$, $t$literature$t$, $t$Drive p21_sol/260914_オフサイト廃液処理の検証（SOL_オフサイト廃液処理の検証_20260914）$t$, $t$https://www.env.go.jp/content/000303191.pdf$t$, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality, source_kind, source_ref, source_url, needs_check, check_reason, created_by, updated_by) values ($t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$matrix$t$, $t$オンサイトとオフサイトの比較 — 売価・液・許可・責任$t$, $t$顧客工場で処理するオンサイトと、特管の廃液をSOL工場で処理するオフサイトを12の観点で比べる。記号は付けず、それぞれの中身を並べる。$t$, $t$オンサイト＝顧客工場の槽の横に顧客が買ったリアクターを置き、SOLは菌体の供給と交換を行う形。オフサイト＝特管を含む廃液をSOLのタンクローリーで運び、SOL工場で処理する形。2026-09-14 の検証で比べた。

**オフサイトの利点**
- 1Lあたりの売価が高い
- 強化株の閉じ込めをSOL工場1か所に集約でき、顧客工場を規制の対象の施設にしなくて済む
- 顧客に設備投資と設置場所が要らず、小さな工場も顧客になる
- 処理の運転データを自社で取れる
- 金属を自社に集めて回収・販売できる

**オフサイトの欠点**
- 高く引き取れる液ほど、菌では処理しにくい
- 特管の処分業の許可と、規模により施設の設置許可が要る
- 地域の量が小さく、既存の処理業者が受けている
- 同じ土俵に規模の大きい上場企業がいる
- 受け入れた液の責任と、反社会的勢力・地元との接点がSOLに集まる
- 装置と菌体を売る会社から、処理サービスの会社へ形が変わる$t$, $t$ビジネスモデル$t$, 20, $t$active$t$, $t$internal$t$, $t$manual$t$, $t$Drive p21_sol/260914_オフサイト廃液処理の検証（SOL_オフサイト廃液処理の検証_20260914）$t$, null, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality, source_kind, source_ref, source_url, needs_check, check_reason, created_by, updated_by) values ($t$ptt_sol_bm_options$t$, $t$p21$t$, $t$matrix$t$, $t$オフサイトの事業の形の選択肢 — 5つの案の比較$t$, $t$オフサイトの処理を事業にするときの形を5つ並べ、要る許可・菌が効くか・反社会的勢力との摩擦・評価を比べる。どの案を取るかは経営が決める。$t$, $t$オフサイトの処理を事業にするときの形を5つ並べた。評価の行だけ記号を付けた（○ 試す形として勧める／△ 条件がそろえば検討／× 勧めない）。どの案を取るかは経営が決める【要判断】。

- A は「オフサイトの廃液処理の評価」で検証した、SOLが自分で許可を取る形
- D の前例: 環境省の補助事業（2013〜2014年度）で、無電解ニッケルめっき廃液からニッケルとリンを回収する設備を実証した。設備は安定して動いたが、ニッケルの売値が計画の577円/kgに対し実績70.3円/kgで、設備だけでは黒字にならなかった（[報告書](https://www.env.go.jp/policy/kenkyu/suishin/kadai/syuryo_report/h26/pdf/3J132002.pdf)）
- E の注意: 許可や最終処分場の権利の売買には反社会的勢力が関わりやすいという業界の証言がある（[環境省 平成20年度の調査](https://www.env.go.jp/recycle/report/h21-01.pdf)）。買収先の株主・役員・取引先の確認が特に要る$t$, $t$ビジネスモデル$t$, 30, $t$active$t$, $t$internal$t$, $t$manual$t$, $t$Drive p21_sol/260914_オフサイト廃液処理の検証（SOL_オフサイト廃液処理の検証_20260914）$t$, null, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality, source_kind, source_ref, source_url, needs_check, check_reason, created_by, updated_by) values ($t$ptt_sol_bm_market$t$, $t$p21$t$, $t$article$t$, $t$対象になる廃液と量 — 特管の範囲と、全国・中国四国の排出量$t$, $t$どんな液が特管になるかと、SOLの技術との重なり。特管の廃酸・廃アルカリの量は全国で年約119万t、四国で約13,000t（環境省推計、令和4年度）。$t$, $t$**一言でいうと** — 特管の液の大半は「強い酸・強いアルカリ」だから特管になっており、SOLの菌が得意とする薄い金属・色との重なりは小さい（推定）。量は四国全体で年約13,000tで、いま既存の処理業者が受けている。

### 特管の廃液の範囲

| 区分 | 条件 | 根拠 |
|---|---|---|
| 廃酸（特管） | pH2.0以下 | [廃棄物処理法施行令](https://laws.e-gov.go.jp/api/1/lawdata/346CO0000000300) 第2条の4第2号、[施行規則](https://laws.e-gov.go.jp/api/1/lawdata/346M50000100035) 第1条の2第2項 |
| 廃アルカリ（特管） | pH12.5以上 | 同 第2条の4第3号、施行規則 第1条の2第3項 |
| 特定有害の汚泥・廃酸・廃アルカリ | 水銀、カドミウム、鉛、有機りん、六価クロム、砒素、シアン、PCB、有機塩素系の溶剤、農薬3種、ベンゼン、セレン、1,4-ジオキサン、ダイオキシン類（計25項目）を判定基準を超えて含むもの。国内のものは決められた工場・事業場から出たものに限る | 同 第2条の4第5号ル |

- ニッケル、銅、亜鉛、鉄、三価クロムは特定有害の項目にない。pHが2.0を超え12.5未満のニッケルめっき廃液などは、特管ではない産業廃棄物になる
- 染色施設・電気めっき施設・酸やアルカリによる表面処理施設は、環境省の[排出源の一覧](https://www.env.go.jp/content/900537157.pdf)に入っている

### SOLの技術との重なり

- 金属回収: 鉛は特定有害の項目に入る。鉄・ニッケル・ネオジム・ジスプロシウムは項目にない
- 色素分解: 染色の廃液は、pHか有害物質で基準に当たる場合だけ特管になる
- 全国の特管の液 約119万t/年のうち、pHだけで特管になっている廃酸・廃アルカリが約99万t/年を占める

### 全国の量（[環境省推計、令和4年度実績](https://www.env.go.jp/content/000303191.pdf)）

| 種類 | 排出量 |
|---|---:|
| 廃酸（特管） | 573千t/年 |
| 廃アルカリ（特管） | 416千t/年 |
| 特定有害の廃酸 | 72千t/年 |
| 特定有害の廃アルカリ | 129千t/年 |
| 特管の液の計 | 1,190千t/年 |
| 特管全体（感染性の廃棄物、廃油なども含む） | 2,720千t/年 |

特管を含む産業廃棄物全体では、廃酸2,889千t/年、廃アルカリ2,595千t/年。再生利用率は廃酸33.0%、廃アルカリ22.4%（[環境省、令和5年度実績](https://www.env.go.jp/content/000301060.pdf)）。

### 中国・四国の量（環境省推計、令和4年度実績）

| 県 | 特管の液（廃酸・廃アルカリ・特定有害の廃酸と廃アルカリ） |
|---|---:|
| 愛媛 | 4,939t/年 |
| 徳島 | 3,756t/年 |
| 香川 | 3,147t/年 |
| 高知 | 1,250t/年 |
| **四国計** | **13,092t/年** |
| 岡山 | 26,886t/年 |
| 山口 | 97,943t/年 |
| 島根 | 2,356t/年 |
| （参考）コスト試算（廃液）のオフサイトの置き値 | 30,000m³/年 |

- 広島県は感染性の廃棄物以外がほとんど計上されておらず、比べられない
- 特管全体（全種類）では、四国55千t/年（全国の2.0%）、中国340千t/年（同12.5%）

### 推計の幅と、処理業者に回る量

- [岡山県の独自調査](https://www.pref.okayama.jp/uploaded/life/1025562_9909324_misc.pdf)（令和6年度実績、令和8年2月公表）では、特管の排出量は145.3千t/年で、うち腐食性の廃酸82.4千t、腐食性の廃アルカリ16.0千t。環境省推計（令和4年度）の岡山県の特管の液26.9千tの数倍で、年度と推計の方法が違う。愛媛県の実数は県の実態調査で確かめる
- 同じ岡山県の調査で、処理業者に委託された特管は72.7千t（排出量の約半分）。腐食性の廃酸は委託が17.6千tで、残りの約8割は出した会社が自分で処理・再生している

### 処理費の総額の目安（推定）

全量を処理業者に委託し、業者の目安の単価で払ったと仮定した上限。実際に処理業者へ回る量はこの一部で、すでに既存の業者が受けている。

| 範囲 | 量 | 30円/kg | 100円/kg |
|---|---:|---:|---:|
| 愛媛 | 約4,900t/年 | 約1.5億円/年 | 約4.9億円/年 |
| 四国 | 約13,000t/年 | 約3.9億円/年 | 約13.1億円/年 |
| 全国 | 約119万t/年 | 約357億円/年 | 約1,190億円/年 |

### 需要が増える材料

- めっき業は、亜鉛の排水基準で暫定基準（一般の2mg/Lに対し4mg/L）が残る唯一の業種で、適用は2029年12月10日まで延長された（[環境省](https://www.env.go.jp/content/000265734.pdf)）。自社の排水処理で一般基準を満たしにくい状態が続いている
- 産業廃棄物の処理費は2024〜2025年に上がっていると業界メディアが伝えている。公的な統計は見つからなかった（推定）$t$, $t$ビジネスモデル$t$, 40, $t$active$t$, $t$internal$t$, $t$literature$t$, $t$環境省「特別管理産業廃棄物排出・処理状況調査報告書 令和4年度実績」（令和7年3月）$t$, $t$https://www.env.go.jp/content/000303191.pdf$t$, true, $t$愛媛県の特管の液の実数と、処理業者への委託量は県の実態調査で確かめる（環境省推計と岡山県の独自調査で数倍の差がある）。愛媛県 循環型社会推進課に聞く$t$, $t$amie$t$, $t$amie$t$);
insert into project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality, source_kind, source_ref, source_url, needs_check, check_reason, created_by, updated_by) values ($t$ptt_sol_bm_price$t$, $t$p21$t$, $t$article$t$, $t$引き取りの値段 — 業者の目安とまとまった量の実例$t$, $t$廃酸・廃アルカリの処分費の目安は1kgあたり30〜100円（ドラムや容器で持ち込む小口）。まとまった量を定期的に出す工場の例では1Lあたり約16円。公的な料金の統計は見つからなかった。$t$, $t$**一言でいうと** — 業者の目安（1kgあたり30〜100円）はドラムや容器で持ち込む小口の値段で、100円はその上端。定期的にまとまった量を出す工場の値段は、これより大幅に低い例がある。コスト試算（廃液）のオフサイトの売価（1Lあたり50円）は、この目安の中ほどに置いた仮置き。

| 液 | 値段 | 条件 | 出典 |
|---|---|---|---|
| 廃酸・廃アルカリ | 1kgあたり30〜100円 | プラスチックのドラムや容器で持ち込む場合の目安。特管かどうかの区別は書かれていない | [山一商事の解説記事](https://yamaichishoji.co.jp/knowledge/disposal-acids-alkali-wastes/)（2025年5月更新） |
| 廃液・廃油（種類を問わない） | 1kgあたり300円から（税込330円から） | 種類で単価を決める。PCBの分析が要る場合あり | [GATE 料金表](https://www.gate-g.jp/price/)（埼玉県） |
| 無電解ニッケルめっき廃液 | 1Lあたり約16円 | 長野県の電子部品工場が年123tを専門業者に委託（2014年度） | [環境省 環境研究総合推進費の報告書](https://www.env.go.jp/policy/kenkyu/suishin/kadai/syuryo_report/h26/pdf/3J132002.pdf) |

- 運ぶ費用は処分費と別に取る業者が多い
- 公的な入札結果や料金の統計は見つからなかった。確かめるには見積が要る$t$, $t$ビジネスモデル$t$, 50, $t$active$t$, $t$internal$t$, $t$literature$t$, $t$山一商事の解説記事（2025年5月更新）ほか$t$, $t$https://yamaichishoji.co.jp/knowledge/disposal-acids-alkali-wastes/$t$, true, $t$公的な料金の統計が無い。顧客候補（メイトなど）がいま払っている処分費・運搬費と、四国・中国の廃液処理業者の見積で確かめる$t$, $t$amie$t$, $t$amie$t$);
insert into project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality, source_kind, source_ref, source_url, needs_check, check_reason, created_by, updated_by) values ($t$ptt_sol_bm_fit$t$, $t$p21$t$, $t$article$t$, $t$菌で処理できる濃さ — 必要な菌体の量と処分の方法$t$, $t$必要な乾燥菌体は金属の濃さに比例し、5,000mg/Lの液1m³で約105kg（液の重さの約1割）。高く引き取れる液ほど、原価より先に物の量で成り立たなくなる。菌が働けるのは中和・沈殿の後。$t$, $t$**一言でいうと** — 1Lあたり高く引き取れる液ほど金属が濃く、必要な菌体の量が液の量に対して現実的でなくなる。5,000mg/Lを超えるあたりから、菌に取り込ませて処理する方法は、原価より先に物の量で成り立たなくなる（推定）。

### 必要な菌体の量

```text
必要な乾燥菌体 (kg/m³) = 金属の濃さ (mg/L) ÷ 取り込み効率 (g/g) ÷ 菌体回収率 ÷ 1,000
菌体費 (円/L)         = 必要な乾燥菌体 (kg/m³) × 菌体1kgの原価 (円/kg) ÷ 1,000
```

前提: 取り込み効率0.053g/g（強化株1の鉄、2026-09-02 の単回の試験。上限は未確認）、菌体回収率90%、菌体1kgの原価 334円（コスト試算（廃液）の強化株・金属回収、2026-09-14 時点）と770円（閉鎖型の商用相場の上端）。

| 金属の濃さ | 液の例 | 乾燥菌体 | 菌体の重さ÷液の重さ | 菌体費（334円/kg） | 菌体費（770円/kg） |
|---:|---|---:|---:|---:|---:|
| 50mg/L | コスト試算のオンサイト | 1.0kg/m³ | 0.1% | 0.35円/L | 0.81円/L |
| 500mg/L | めっき排水の現場の目安 | 10.5kg/m³ | 1.0% | 3.5円/L | 8.1円/L |
| 5,000mg/L | 薄めた廃液（コスト試算のオフサイトの仮置き） | 105kg/m³ | 10.5% | 35.0円/L | 80.7円/L |
| 20,000mg/L | 濃い廃液 | 419kg/m³ | 42% | 140円/L | 323円/L |
| 50,000〜100,000mg/L | めっき液そのもの（ワット浴のニッケル 約5〜10%） | 1,048〜2,096kg/m³ | 105〜210% | 350〜701円/L | 807〜1,614円/L |

- 取り込み効率が4倍（0.2g/g）でも、5,000mg/Lで28kg/m³、50,000mg/Lで278kg/m³になる
- ワット浴の組成は、硫酸ニッケル220〜380g/L・塩化ニッケル30〜60g/L（[カニゼン技術レポート](https://www.kanigen.co.jp/file/report2.pdf)）。ニッケル分は組成からの換算

### 処分の方法

- 特管の廃酸・廃アルカリの処分は、[施行令](https://laws.e-gov.go.jp/api/1/lawdata/346CO0000000300)第6条の5第1項第2号ロで「環境大臣が定める方法」（平成4年厚生省告示第194号）によると決まっている。[環境省の概要](https://www.env.go.jp/recycle/waste/sp_contr/03.html)では、中和、焼却、イオン交換設備等での再生が挙がる。菌による処理がこれに当たるかは未確認
- 5%の硫酸1m³を中和するには、水酸化ナトリウムが約41kg要る（計算）。2026-09-02 の試験で見えた中和剤を減らせる可能性は、pH2.6前後の薄い酸性排水の範囲の話として扱う（推定）
- 菌が働ける場面は、中和・沈殿の後に残る薄い金属や色の仕上げ、沈みにくい錯体の金属、価値のある金属（ジスプロシウムなど）の回収。この段で既存の方法より安いか・よく取れるかは、まだ測っていない

### 参考になる前例

- 環境省の補助事業（2013〜2014年度）で、長野県の企業が無電解ニッケルめっき廃液からニッケルとリンを回収する設備を実証した。設備は安定して動いたが、ニッケルの売値が計画の577円/kgに対し実績70.3円/kg、リンも計画の1/10以下で、設備だけでは黒字にならなかった。報告書は、この廃液は分離回収とCODの分解が難しいと書いている（[報告書](https://www.env.go.jp/policy/kenkyu/suishin/kadai/syuryo_report/h26/pdf/3J132002.pdf)）
- 微生物や藻類で重金属を吸着する方法は、1990〜2000年代に欧米で事業化の例があったが、いま大きな規模で稼働しているものは確認できなかった（学術レビューの記述による）$t$, $t$ビジネスモデル$t$, 60, $t$active$t$, $t$internal$t$, $t$estimate$t$, $t$SOL定例 2026-09-02（強化株1の鉄の取り込み）／コスト試算（廃液）の前提（2026-09-14）$t$, null, true, $t$取り込み効率の上限（反復試験）、耐えられるpHと金属の濃さ、錯体になったニッケルを取り込めるかは未測定（杉浦先生）。菌による処理が特管の処分の方法に当たるかは未確認（愛媛県・環境省に聞く）$t$, $t$amie$t$, $t$amie$t$);
insert into project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality, source_kind, source_ref, source_url, needs_check, check_reason, created_by, updated_by) values ($t$ptt_sol_bm_permit$t$, $t$p21$t$, $t$article$t$, $t$許可の取り方 — 収集運搬業・処分業・施設の設置許可$t$, $t$運ぶだけなら特管の収集運搬業、自社工場で処理するなら処分業の許可が別に要る。1日100m³の中和は施設の設置許可の対象で、生活環境影響調査と住民の意見書の手続きが加わる。$t$, $t$**一言でいうと** — 収集運搬業の許可だけでは運ぶことしかできない。自社工場で処理するには処分業の許可が別に要り、コスト試算の置き値（1日100m³）では中和施設の設置許可（施行令第7条第6号）の対象になる。

### 3つのケース

| ケース | 主な手続き | 期間の目安 | 難所 |
|---|---|---|---|
| (a) 特管の収集運搬業だけ | 講習（特管の収集運搬課程）→ 車両・容器 → 申請（愛媛県。松山市内だけで行う場合や積替え保管をする場合は松山市も） | 準備を含め4.5〜7か月（行政書士の目安） | 経理的基礎、劇物の運搬基準（硫酸・塩化水素10%超、水酸化ナトリウム5%超の液） |
| (b) 特管の処分業（設置許可が要らない規模） | 講習（処分課程）→ 施設の建設 → 申請（施設が松山市内なら松山市、それ以外は愛媛県） | 未確認 | 中和1日50m³以下・脱水1日10m³以下に収めること、経理的基礎、菌による処理の説明 |
| (c) 特管の処分業＋施設の設置許可 | 事前協議 → 生活環境影響調査 → 書類の告示・縦覧 → 利害関係者の意見書 → 市町村長と専門家の意見 → 設置許可 → 建設 → 使用前検査 → 処分業許可 | 審査だけで2か月とする県の例あり。稼働まで2年半程度という業界の解説（一次資料では未確認） | 住民対応、技術管理者、経理的基礎、菌による処理の説明 |

### 施設の設置許可が要る規模（[廃棄物処理法施行令](https://laws.e-gov.go.jp/api/1/lawdata/346CO0000000300) 第7条）

- 汚泥の脱水施設: 1日10m³超（第1号）
- 廃酸・廃アルカリの中和施設: 1日50m³超（第6号）
- 有害物質を含む汚泥のコンクリート固型化施設: 規模を問わない（第9号）
- 汚泥・廃酸・廃アルカリに含まれるシアン化合物の分解施設: 規模を問わない（第11号）

### 経理的基礎

環境省の[通知](https://www.env.go.jp/content/900479532.pdf)（令和2年3月30日、環循規発第2003301号）の判断の目安:

- 利益が出ていること、または自己資本比率が10%を超えていることと、申請する事業に適切な収益が見込めることが望ましい
- 利益は原則として過去3年程度の損益の平均で見る。赤字でも、直前期が黒字に転じて改善の見込みがあれば、容認の余地がある
- 自己資本比率が10%以下でも、債務超過でなく持続的な経営の見込みがあれば、容認の余地がある
- 多額の設備投資を要する場合は、投資の当初に利益が出にくいことを勘案する。設備投資の資金が、資金調達の額と当期純利益の合計を超えないかを確かめる事業収支計画書を求める方法が示されている

出資で資金を集め、自己資本比率が10%を超えるSOLであれば、事業収支計画で満たせる見込みがある（推定）。

### 近道

- 許可を持つ会社の株式を取得すれば、許可は会社に残る。役員の変更の届出と、新しい役員の欠格要件の確認が要る（専門家の解説で一致。個別の事前相談が要る）（推定）
- 金属回収を理由に有価物として扱う道は、総合判断説（[環境省通知、平成25年3月29日](https://www.env.go.jp/hourei/add/k040.pdf)）で判断される。有害性のある特管の液では認められにくいと考えられる（推定）
- 再生利用の認定・指定の制度が特管に使えるかは未確認$t$, $t$ビジネスモデル$t$, 70, $t$active$t$, $t$internal$t$, $t$literature$t$, $t$廃棄物処理法施行令 第7条／環境省 環循規発第2003301号（令和2年3月30日）$t$, $t$https://laws.e-gov.go.jp/api/1/lawdata/346CO0000000300$t$, true, $t$(b) の期間、施設の設置の事前協議と住民説明の扱い、菌による処理が特管の処分の方法に当たるかは、愛媛県 循環型社会推進課への照会が要る。再生利用の認定・指定の制度が特管に使えるかは環境省に聞く$t$, $t$amie$t$, $t$amie$t$);
insert into project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality, source_kind, source_ref, source_url, needs_check, check_reason, created_by, updated_by) values ($t$ptt_sol_bm_competitors$t$, $t$p21$t$, $t$article$t$, $t$廃液処理の競合 — 既存の処理業者と貴金属回収$t$, $t$工場廃液の処理を本業とするダイセキ（2027年2月期予想 売上742億円・営業利益168億円）など、許可と設備を持つ上場企業が同じ土俵にいる。スタートアップが特管の処分業の許可を新しく取った例は見つからなかった。$t$, $t$| 会社 | 廃液との関係 | 規模 | 中国・四国の拠点 |
|---|---|---|---|
| ダイセキ（東証プライム） | 工場廃液を中心とする産業廃棄物の収集運搬・中間処理・リサイクル | 2027年2月期予想 売上742億円、営業利益168億円（[決算短信](https://finance-frontend-pc-dist.west.edge.storage-yahoo.jp/disclosure/20260702/20260629582962.pdf)） | 処理拠点は全国7か所。中国地方は広島県東広島市。四国は無し（[事業所ネットワーク](https://www.daiseki.co.jp/profile/divisions/index.html)） |
| 大栄環境（東証プライム） | 産業廃棄物の中間処理・資源循環 | 2022年上場。許可を持つ会社の買収で子会社を増やしている（報道） | 未確認 |
| 松田産業、アサヒプリテック | めっき液・エッチング液などからの貴金属回収 | 未確認 | 未確認 |

- 愛媛県は[許可業者の名簿](https://www.pref.ehime.jp/page/9773.html)を公表している。廃酸・廃アルカリを中和処理できる県内の業者と処理能力は、名簿で確かめる
- スタートアップが特管の処分業の許可を新しく取った例は、見つからなかった
- 排水や廃液から金属・色を取る新しい技術の会社との比較は、競合比較タブにある$t$, $t$ビジネスモデル$t$, 80, $t$active$t$, $t$internal$t$, $t$literature$t$, $t$ダイセキ「2027年2月期 第1四半期決算短信」（2026年7月2日）$t$, $t$https://finance-frontend-pc-dist.west.edge.storage-yahoo.jp/disclosure/20260702/20260629582962.pdf$t$, true, $t$大栄環境の中国・四国の拠点、松田産業・アサヒプリテックの規模、愛媛県内で廃酸・廃アルカリを中和処理できる許可業者と処理能力は未確認（各社の公開資料と愛媛県の許可業者名簿で確かめる）$t$, $t$amie$t$, $t$amie$t$);
insert into project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality, source_kind, source_ref, source_url, needs_check, check_reason, created_by, updated_by) values ($t$ptt_sol_bm_antisocial$t$, $t$p21$t$, $t$article$t$, $t$反社会的勢力と既存業者のリスク — 公的資料と防ぎ方$t$, $t$許可制と警察への照会で、暴力団が自分の名義で処理業の許可を持ち続けることは難しくなっている。残るのは無許可業者を経由した持ち込み、実質的な支配、権利の売買、施設への地元の反対。いまの実態を示す公的な調査は見つからなかった。$t$, $t$**一言でいうと** — 既存の商流を荒らすと危ないという懸念を裏づける資料も、危なくないと言い切れる資料もない。SOLにとっての影響は、事業の損失より、公的研究資金の暴力団排除の条項、金融機関の取引、上場審査への波及が大きい。

### 公的な資料で分かること

| 項目 | 内容 | 出典 |
|---|---|---|
| 廃棄物事犯の検挙件数 | 令和3年 5,772件 → 令和7年 4,578件。行政指導を無視した悪質な不適正処理が依然として発生していると書かれている | [警察庁「令和7年における生活経済事犯の検挙状況等について」](https://www.npa.go.jp/publications/statistics/safetylife/2026_nenpou_teisei.pdf) |
| 暴力団の関与の割合 | 廃棄物事犯のうち暴力団構成員等が関わった件数は、公表資料で数字として出ていない | 同上 |
| 暴力団が進出・関与する事業 | 金融業・建設業・労働者派遣業・風俗営業等。「産業廃棄物」は本文に出てこない | [警察庁「令和6年における組織犯罪の情勢」](https://www.npa.go.jp/publications/statistics/kikakubunseki/R6jyousei.pdf) |
| 過去の記述 | 暴力団幹部が許可なく産業廃棄物の埋め立てを請け負った事件を、企業活動を利用した資金獲得犯罪の例に挙げていた | [平成10年版 警察白書](https://www.npa.go.jp/hakusyo/h10/h100500.html) |
| 許可の欠格要件 | 暴力団員等と、暴力団員等が事業活動を支配する者は許可を受けられず、該当すれば許可は取り消される | 廃棄物処理法（2003年・2010年の改正で強化） |
| 行政処分 | 令和5年度の許可取消し等は、産業廃棄物処理業316件、特管の処理業15件。理由の内訳は未確認 | [環境省（2026年3月公表）](https://www.env.go.jp/press/press_03483.html) |
| 許可業者への調査（2008年度、有効回答1,850） | 反社会的勢力から不当要求を受けたことがある 14.9%（相手はえせ同和行為者・えせ右翼が多い）。自由記述に、処分費を下げるための無許可業者への搬入の裏での関与、最終処分場の権利の売買への関与の証言がある | [環境省「平成20年度 暴力団の不当要求等介入事例実態調査事業報告書」](https://www.env.go.jp/recycle/report/h21-01.pdf)、[中央環境審議会の資料](https://www.env.go.jp/council/former2013/03haiki/y0320-11/mat03-02.pdf) |
| 排除の事例 | 暴力団組長が、妻を代表とする産業廃棄物収集運搬業者の事業を支配していたため、許可が取り消された | 警察庁「平成19年の暴力団情勢」（中央環境審議会の資料に引用） |

### 評価（推定）

- 許可制と許可時の警察への照会で、暴力団が自分の名義で処理業の許可を持ち続けることは難しくなっている
- 設備投資の大きい廃液の中間処理は、大手・上場企業が中心である
- リスクが残るのは、許可のない業者を経由した持ち込み、家族などを代表に立てた実質的な支配、最終処分場や許可の権利の売買、施設をつくるときの地元の反対。業界の実態を聞いた公的な調査は2008年度のものが最新
- 愛媛県・四国で、反対運動や新規参入への妨害に反社会的勢力が関わったと確定した事例は見つからなかった

### 経路ごとの防ぎ方

| 経路 | 起こりうること | 防ぎ方 |
|---|---|---|
| 顧客 | 排出事業者の実質的な支配者が反社会的勢力 | 契約前の確認（暴力追放運動推進センター、信用調査）、契約の暴力団排除条項 |
| 持ち込み | ブローカーや無許可業者を経由した液、表示と中身が違う液 | 排出事業者との直接契約、電子マニフェスト、受け入れ時の分析 |
| 同業 | 価格競争、顧客の囲い込み | 既存業者と競合しない液を選ぶ、既存業者と組む |
| 地域 | 施設の建設への反対 | 行政・自治会との早い協議、説明の記録 |
| 資金・上場 | 取引先への混入が発覚した場合の交付取消、上場審査での指摘 | 反社会的勢力の排除の社内規程、株主と取引先の確認 |$t$, $t$ビジネスモデル$t$, 90, $t$active$t$, $t$internal$t$, $t$literature$t$, $t$警察庁「令和6年における組織犯罪の情勢」／環境省「平成20年度 暴力団の不当要求等介入事例実態調査事業報告書」$t$, $t$https://www.env.go.jp/recycle/report/h21-01.pdf$t$, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality, source_kind, source_ref, source_url, needs_check, check_reason, created_by, updated_by) values ($t$ptt_sol_bm_questions$t$, $t$p21$t$, $t$article$t$, $t$確認事項 — 誰に何を聞けば決まるか$t$, $t$オフサイトの廃液処理を事業にするか決めるために、愛媛県・環境省・杉浦先生・顧客候補・処理業者に確かめること。$t$, $t$| 確認先 | 聞くこと |
|---|---|
| 愛媛県 循環型社会推進課 | 県内の特管の廃酸・廃アルカリの排出量と委託量（実態調査）／処理施設の設置の事前協議と住民説明の扱い／菌による処理が特管の処分の方法に当たるか／使用済みの菌体を顧客工場からSOLが引き取る場合、排出事業者は誰になり、許可が要るか |
| 環境省 環境再生・資源循環局 | 特管の廃酸・廃アルカリの処分の方法（平成4年厚生省告示第194号）に生物による処理が入る余地／再生利用の認定・指定の制度が特管に使えるか |
| 杉浦先生 | 取り込みの上限（反復試験）／耐えられるpHと金属の濃さ／錯体になったニッケルを取り込めるか／色の濃い染色廃液での性能 |
| 顧客候補（メイトなど） | いま産廃として出している液の種類・量・濃さ・処分費・運搬費・出す頻度 |
| 四国・中国の廃液処理業者 | 受け入れている液の種類と値段、処理に困っている液、菌の工程を組み込む余地 |
| 愛媛県の許可業者名簿 | 廃酸・廃アルカリの中和処理の許可を持つ県内の業者と処理能力 |

顧客候補の液の分析値が分かったら、コスト試算（廃液）のオフサイトの濃さ（仮置き 色素1,000mg/L・金属5,000ppm）と売価（1Lあたり50円）を置き換える。$t$, $t$ビジネスモデル$t$, 100, $t$active$t$, $t$internal$t$, $t$manual$t$, $t$Drive p21_sol/260914_オフサイト廃液処理の検証（SOL_オフサイト廃液処理の検証_20260914）$t$, null, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_011$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$1Lあたりの売価$t$, $t$オンサイト（顧客工場で処理）$t$, $t$0.5円（500円/m³。コスト試算（廃液）の置き値）$t$, null, $t$low$t$, $t$estimate$t$, $t$コスト試算（廃液）の前提「想定売上単価（オンサイト）」$t$, null, null, 11, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_012$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$1Lあたりの売価$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$業者の目安で1kgあたり30〜100円（ドラムや容器で持ち込む小口の値段）。まとまった量の例は1Lあたり約16円$t$, null, $t$medium$t$, $t$literature$t$, $t$山一商事の解説記事（2025年5月更新）／環境省 環境研究総合推進費の報告書（平成26年度）$t$, $t$https://yamaichishoji.co.jp/knowledge/disposal-acids-alkali-wastes/$t$, null, 12, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_021$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$処理する液$t$, $t$オンサイト（顧客工場で処理）$t$, $t$薄い排水（金属 数十〜数百mg/L）$t$, null, $t$medium$t$, $t$manual$t$, $t$SOL定例 2026-09-02（めっき排水の現場の目安）$t$, null, null, 21, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_022$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$処理する液$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$濃い廃液（数千mg/L〜数%）、強い酸・アルカリ$t$, null, $t$medium$t$, $t$literature$t$, $t$廃棄物処理法施行規則 第1条の2／カニゼン技術レポート（めっき液の組成）$t$, $t$https://laws.e-gov.go.jp/api/1/lawdata/346M50000100035$t$, null, 22, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_031$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$菌の役割$t$, $t$オンサイト（顧客工場で処理）$t$, $t$処理の主役$t$, null, $t$medium$t$, $t$manual$t$, $t$コスト試算（廃液）の想定している系$t$, null, null, 31, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_032$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$菌の役割$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$中和・沈殿の後の仕上げと回収$t$, null, $t$medium$t$, $t$literature$t$, $t$環境省「特別管理産業廃棄物の処理基準の概要」（処分は中和・焼却・イオン交換設備等での再生）$t$, $t$https://www.env.go.jp/recycle/waste/sp_contr/03.html$t$, null, 32, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_041$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$廃棄物処理法$t$, $t$オンサイト（顧客工場で処理）$t$, $t$顧客の自社処理。使用済みの菌体をSOLが引き取る場合の扱いは未確認$t$, null, $t$unverified$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 41, true, $t$使用済みの菌体を顧客工場からSOLが引き取るとき、排出事業者は誰になり、許可が要るか。愛媛県 循環型社会推進課に聞く$t$, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_042$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$廃棄物処理法$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$特管の収集運搬業・処分業の許可。1日50m³超の中和は施設の設置許可も要る$t$, null, $t$high$t$, $t$literature$t$, $t$廃棄物処理法施行令 第7条第6号$t$, $t$https://laws.e-gov.go.jp/api/1/lawdata/346CO0000000300$t$, null, 42, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_051$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$カルタヘナ法（強化株）$t$, $t$オンサイト（顧客工場で処理）$t$, $t$顧客工場が規制の対象の施設になるかは未確認$t$, null, $t$unverified$t$, $t$manual$t$, $t$SolvioraX 閉鎖系の要件と論点整理（2026-09-11）$t$, null, null, 51, true, $t$強化株を顧客工場で使うとき、顧客工場が規制の対象の施設になるか。閉鎖系の判定と合わせて確かめる$t$, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_052$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$カルタヘナ法（強化株）$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$SOL工場1か所に閉じ込めを集約できる$t$, null, $t$medium$t$, $t$manual$t$, $t$SolvioraX 閉鎖系の要件と論点整理（2026-09-11）$t$, null, null, 52, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_061$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$市場の量$t$, $t$オンサイト（顧客工場で処理）$t$, $t$コスト試算の置き値は年20,000,000m³（売上10,000,000,000円の規模）$t$, null, $t$low$t$, $t$estimate$t$, $t$コスト試算（廃液）の前提「年間処理量（オンサイト）」$t$, null, null, 61, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_062$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$市場の量$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$四国の特管の液は年約13,000t（環境省推計、令和4年度）$t$, null, $t$high$t$, $t$literature$t$, $t$環境省「特別管理産業廃棄物排出・処理状況調査報告書 令和4年度実績」$t$, $t$https://www.env.go.jp/content/000303191.pdf$t$, null, 62, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_071$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$顧客の負担$t$, $t$オンサイト（顧客工場で処理）$t$, $t$リアクターの購入と設置場所$t$, null, $t$medium$t$, $t$manual$t$, $t$コスト試算（廃液）の想定している系$t$, null, null, 71, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_072$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$顧客の負担$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$処理費だけ$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 72, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_081$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$SOLの設備と人$t$, $t$オンサイト（顧客工場で処理）$t$, $t$菌体の製造と交換$t$, null, $t$medium$t$, $t$manual$t$, $t$コスト試算（廃液）の想定している系$t$, null, null, 81, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_082$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$SOLの設備と人$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$タンクローリー、受け入れ検査、中和・脱水の設備、汚泥の処分、技術管理者、事故対応$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 82, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_091$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$責任$t$, $t$オンサイト（顧客工場で処理）$t$, $t$処理の結果の責任は主に顧客$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 91, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_092$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$責任$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$受け入れた液・汚泥・漏洩・不適正処理の責任がSOLに集まり、許可の取消しは事業全体に及ぶ$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 92, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_101$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$競合$t$, $t$オンサイト（顧客工場で処理）$t$, $t$既存の水処理装置・薬剤$t$, null, $t$medium$t$, $t$manual$t$, $t$競合比較タブ「既存の方式との星取り表」$t$, null, null, 101, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_102$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$競合$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$既存の廃液処理業者（ダイセキなど）$t$, null, $t$high$t$, $t$literature$t$, $t$ダイセキ「2027年2月期 第1四半期決算短信」$t$, $t$https://finance-frontend-pc-dist.west.edge.storage-yahoo.jp/disclosure/20260702/20260629582962.pdf$t$, null, 102, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_111$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$反社会的勢力・地元$t$, $t$オンサイト（顧客工場で処理）$t$, $t$接点は小さい$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 111, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_112$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$反社会的勢力・地元$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$持ち込みの経路と施設の立地で接点が生まれる$t$, null, $t$medium$t$, $t$literature$t$, $t$環境省「平成20年度 暴力団の不当要求等介入事例実態調査事業報告書」$t$, $t$https://www.env.go.jp/recycle/report/h21-01.pdf$t$, null, 112, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_121$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$収益の形$t$, $t$オンサイト（顧客工場で処理）$t$, $t$装置の販売と菌体の継続課金$t$, null, $t$medium$t$, $t$manual$t$, $t$コスト試算（廃液）の想定している系$t$, null, null, 121, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_cmp_122$t$, $t$ptt_sol_bm_compare$t$, $t$p21$t$, $t$収益の形$t$, $t$オフサイト（特管の廃液をSOL工場で処理）$t$, $t$処理サービス業（ダイセキの営業利益率 約23%）$t$, null, $t$high$t$, $t$literature$t$, $t$ダイセキ「2027年2月期 第1四半期決算短信」（通期予想）$t$, $t$https://finance-frontend-pc-dist.west.edge.storage-yahoo.jp/disclosure/20260702/20260629582962.pdf$t$, null, 122, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_011$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$中身$t$, $t$A 提案の形$t$, $t$SOLが特管の収集運搬業と処分業の許可を取り、自社工場で処理する$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 11, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_012$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$中身$t$, $t$B 液を選んで処分だけ$t$, $t$特管ではなく菌が効く液（沈みにくいニッケル、染色の色、ジスプロシウムを含む工程液）に絞り、運搬は許可業者に任せる$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 12, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_013$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$中身$t$, $t$C 既存の処理業者と組む$t$, $t$処理業者の工場の一工程として、菌の工程と金属回収を提供する$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 13, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_014$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$中身$t$, $t$D 金属の回収に絞る$t$, $t$処理費ではなく、回収した金属の売上で成り立たせる$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 14, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_015$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$中身$t$, $t$E 許可を持つ会社を買う$t$, $t$許可を持つ会社の株式を取得する$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 15, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_021$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$要る許可$t$, $t$A 提案の形$t$, $t$特管の収集運搬業・処分業、施設の設置許可$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 21, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_022$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$要る許可$t$, $t$B 液を選んで処分だけ$t$, $t$産業廃棄物の処分業。施設の設置許可が要らない規模に収める$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 22, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_023$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$要る許可$t$, $t$C 既存の処理業者と組む$t$, $t$許可は相手が持つ。SOLに要る許可は契約の形で変わる（未確認）$t$, null, $t$unverified$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 23, true, $t$既存の処理業者の工場で菌の工程を提供するとき、SOLに処分業の許可が要るか（委託・請負など契約の形による）。愛媛県に聞く$t$, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_024$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$要る許可$t$, $t$D 金属の回収に絞る$t$, $t$有価物として扱えるかは液ごとに判断される$t$, null, $t$medium$t$, $t$literature$t$, $t$環境省「行政処分の指針について」（平成25年3月29日、総合判断説）$t$, $t$https://www.env.go.jp/hourei/add/k040.pdf$t$, null, 24, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_025$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$要る許可$t$, $t$E 許可を持つ会社を買う$t$, $t$許可は会社に残る。役員の変更の届出と、新しい役員の欠格要件の確認が要る$t$, null, $t$medium$t$, $t$literature$t$, $t$専門家の解説（許可を持つ会社の株式取得）。個別の事前相談が要る$t$, null, null, 25, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_031$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$菌が効くか$t$, $t$A 提案の形$t$, $t$中和の後の仕上げだけ$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 31, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_032$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$菌が効くか$t$, $t$B 液を選んで処分だけ$t$, $t$効く可能性がある（未確認）$t$, null, $t$unverified$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 32, true, $t$沈みにくいニッケル・染色の色・ジスプロシウムを含む工程液で、菌の性能を測っていない。顧客候補の液で杉浦先生と測る$t$, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_033$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$菌が効くか$t$, $t$C 既存の処理業者と組む$t$, $t$相手の中和・沈殿の後$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 33, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_034$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$菌が効くか$t$, $t$D 金属の回収に絞る$t$, $t$価値のある金属なら$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 34, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_035$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$菌が効くか$t$, $t$E 許可を持つ会社を買う$t$, $t$相手の設備による$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 35, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_041$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$反社会的勢力・摩擦$t$, $t$A 提案の形$t$, $t$持ち込みの経路と施設の立地で接点が生まれる$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 41, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_042$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$反社会的勢力・摩擦$t$, $t$B 液を選んで処分だけ$t$, $t$小さい$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 42, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_043$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$反社会的勢力・摩擦$t$, $t$C 既存の処理業者と組む$t$, $t$相手の管理に乗る$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 43, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_044$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$反社会的勢力・摩擦$t$, $t$D 金属の回収に絞る$t$, $t$小さい$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 44, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_045$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$反社会的勢力・摩擦$t$, $t$E 許可を持つ会社を買う$t$, $t$権利の売買に関わりやすいという証言がある。買収先の確認が特に要る$t$, null, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 45, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_051$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$評価$t$, $t$A 提案の形$t$, $t$勧めない。量・技術・許可がそろわない$t$, $t$poor$t$, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 51, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_052$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$評価$t$, $t$B 液を選んで処分だけ$t$, $t$液ごとに菌の性能を測ってから検討する$t$, $t$fair$t$, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 52, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_053$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$評価$t$, $t$C 既存の処理業者と組む$t$, $t$オフサイトを試す形として最も軽い$t$, $t$good$t$, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 53, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_054$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$評価$t$, $t$D 金属の回収に絞る$t$, $t$買い手と値段を先に確かめる$t$, $t$fair$t$, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 54, false, null, $t$amie$t$, $t$amie$t$);
insert into project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_text, rating, confidence, source_kind, source_ref, source_url, note, sort_order, needs_check, check_reason, created_by, updated_by) values ($t$pte_sol_bm_opt_055$t$, $t$ptt_sol_bm_options$t$, $t$p21$t$, $t$評価$t$, $t$E 許可を持つ会社を買う$t$, $t$資金調達の後の選択肢$t$, $t$fair$t$, $t$medium$t$, $t$manual$t$, $t$2026-09-14 の検証$t$, null, null, 55, false, null, $t$amie$t$, $t$amie$t$);
do $do$ declare nt int; ne int; begin
  select count(*) into nt from project_tech_topics where project_id = $t$p21$t$ and tech_domain = $t$ビジネスモデル$t$;
  select count(*) into ne from project_tech_entries e join project_tech_topics t using (tech_topic_id) where t.project_id = $t$p21$t$ and t.tech_domain = $t$ビジネスモデル$t$;
  if nt <> 10 or ne <> 49 then raise exception '足した数が想定と違う: トピック % 行 %', nt, ne; end if;
end $do$;
commit;
