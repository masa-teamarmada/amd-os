-- 443: SOL（p21）の「ビジネスモデル」タブ先頭の図を、mermaid の流れ図から、ビジネスモデルのピクト図（本文の pictogram ブロック）に置き換える。
--   2026-09-17 まさ「ビジネスモデルは、ちゃんとピクト図にしてほしい。カネとモノの流れを示す矢印はそれぞれ別の色にして、カネのところはお金っぽいアイコンを添えて。」
--   図は PictogramDiagram（pwa/src/components/cockpit/PictogramDiagram.tsx）が描き、定義の書き方は spec 3-20 §5.6。
-- あわせて、案C（既存の処理業者と組む）の中身を役割で書き直す。
--   同日まさ「上乗せ売上の「処理業者の工場に菌の工程を入れる」が何を指してるのかが理解できない。廃液回収事業のこと？」
--   廃液の回収・運搬・処理は許可を持つ既存の処理業者、SolvioraX は業者の工場の中和・沈殿の後に置く「菌の処理段階」へ菌体と処理装置を納め、菌が取り込んだ金属を取り出す。
--   同じ言い回しがあった「オフサイトの廃液処理の評価」「確認事項」「オフサイトの事業の形の選択肢（C の中身）」もそろえる。
-- 収益の柱の「いまの状態」はコスト試算の 2026-09-17 時点の値、成り立つための条件はゴールツリーの今の問い（UEが成立するか・オンサイトPoCの実現など）に直す。
-- 書き換える文が 429 の後に変わっていたら、何も書かずに止まる。生成: scratchpad gen443.py（コミットしない）。
begin;
do $do$ begin
  if (select md5(coalesce(summary, '')) from project_tech_topics where tech_topic_id = $t$ptt_sol_bm_overview$t$ and project_id = $t$p21$t$) is distinct from $t$e5e3ae0173b679b75214bba67190f784$t$ then raise exception 'ptt_sol_bm_overview.summary が 429 の後に書き換えられている'; end if;
  if (select md5(coalesce(body_md, '')) from project_tech_topics where tech_topic_id = $t$ptt_sol_bm_overview$t$ and project_id = $t$p21$t$) is distinct from $t$7922d84c4f8eacdcc761ff18ba9eec5c$t$ then raise exception 'ptt_sol_bm_overview.body_md が 429 の後に書き換えられている'; end if;
  if (select md5(coalesce(summary, '')) from project_tech_topics where tech_topic_id = $t$ptt_sol_bm_offsite_eval$t$ and project_id = $t$p21$t$) is distinct from $t$0484e40a9ab6686761c096fd791e08ed$t$ then raise exception 'ptt_sol_bm_offsite_eval.summary が 429 の後に書き換えられている'; end if;
  if (select md5(coalesce(body_md, '')) from project_tech_topics where tech_topic_id = $t$ptt_sol_bm_offsite_eval$t$ and project_id = $t$p21$t$) is distinct from $t$b3f6b7a0b0a27c35e337ef8927d54fca$t$ then raise exception 'ptt_sol_bm_offsite_eval.body_md が 429 の後に書き換えられている'; end if;
  if (select md5(coalesce(summary, '')) from project_tech_topics where tech_topic_id = $t$ptt_sol_bm_questions$t$ and project_id = $t$p21$t$) is distinct from $t$046e94b2ce8500ef3d092c48f24ff0ef$t$ then raise exception 'ptt_sol_bm_questions.summary が 429 の後に書き換えられている'; end if;
  if (select md5(coalesce(body_md, '')) from project_tech_topics where tech_topic_id = $t$ptt_sol_bm_questions$t$ and project_id = $t$p21$t$) is distinct from $t$d7345773b3dc089a90a7d2b83a9d88fe$t$ then raise exception 'ptt_sol_bm_questions.body_md が 429 の後に書き換えられている'; end if;
  if (select md5(coalesce(value_text, '')) from project_tech_entries where tech_entry_id = $t$pte_sol_bm_opt_013$t$) is distinct from $t$ceb6148eec29c8bcbca024da4e28b94a$t$ then raise exception 'pte_sol_bm_opt_013.value_text が 429 の後に書き換えられている'; end if;
end $do$;
update project_tech_topics set body_md = $ov$**一言でいうと** — SolvioraX は、好熱性シアノバクテリアの菌体を自社の製造拠点でつくり、工場の排水処理に使ってもらう。売上の柱は、装置の販売（導入時に一度）と、処理量に応じた菌体の定期利用料・保守料（毎年）。金属を含む排水では、金属を取り込んだ菌体を引き取って金属を取り出し、その金属も売る。これに、既存の廃液処理業者と組むオフサイト（案C）と、将来のバイオ燃料を上乗せする。

### 事業全体のお金とモノの流れ

```pictogram
{
  "nodes": [
    {"id": "sol", "cell": "c", "icon": "self", "label": "SolvioraX", "note": "菌体の製造・処理装置の提供・金属の取り出し"},
    {"id": "ehime", "cell": "l", "icon": "university", "label": "愛媛大学", "note": "菌株と培養技術の研究元"},
    {"id": "maker", "cell": "t", "icon": "company", "label": "装置の製造委託先", "note": "処理装置・培養設備の製造"},
    {"id": "plant", "cell": "r", "icon": "factory", "label": "排水を出す工場", "note": "着色排水・金属を含む排水"},
    {"id": "fuel", "cell": "tr", "icon": "company", "label": "燃料の買い手", "note": "船舶燃料・SAFの事業者", "planned": true},
    {"id": "metal", "cell": "br", "icon": "company", "label": "金属の買い手", "note": "非鉄金属の精錬会社など"},
    {"id": "processor", "cell": "b", "icon": "factory", "label": "既存の廃液処理業者", "note": "許可と工場を持つ処理業者（案C）", "planned": true},
    {"id": "waste", "cell": "bl", "icon": "factory", "label": "廃液を出す工場", "note": "特管を含む廃液の処理委託", "planned": true}
  ],
  "flows": [
    {"from": "sol", "to": "plant", "kind": "goods", "label": "装置・菌体・保守"},
    {"from": "plant", "to": "sol", "kind": "money", "label": "装置代・定期利用料・保守料"},
    {"from": "plant", "to": "sol", "kind": "goods", "label": "金属入りの菌体"},
    {"from": "ehime", "to": "sol", "kind": "goods", "label": "菌株・培養技術"},
    {"from": "sol", "to": "ehime", "kind": "money", "label": "ライセンス料（条件未定）"},
    {"from": "maker", "to": "sol", "kind": "goods", "label": "処理装置・培養設備"},
    {"from": "sol", "to": "maker", "kind": "money", "label": "製造委託費"},
    {"from": "metal", "to": "sol", "kind": "money", "label": "金属の代金"},
    {"from": "sol", "to": "metal", "kind": "goods", "label": "取り出した金属"},
    {"from": "sol", "to": "processor", "kind": "goods", "label": "菌体・処理装置"},
    {"from": "processor", "to": "sol", "kind": "money", "label": "利用料（形は未定）"},
    {"from": "waste", "to": "processor", "kind": "goods", "label": "廃液"},
    {"from": "waste", "to": "processor", "kind": "money", "label": "処理費"},
    {"from": "sol", "to": "fuel", "kind": "goods", "label": "バイオ燃料（FAME）"},
    {"from": "fuel", "to": "sol", "kind": "money", "label": "燃料の代金"}
  ]
}
```

真ん中が SolvioraX。青い矢印はモノ・サービス、¥の印を付けた橙の矢印はお金が動く向き。愛媛大学と装置の製造委託先へは SolvioraX が払い、排水を出す工場・金属の買い手・既存の廃液処理業者・燃料の買い手からは SolvioraX が受け取る。破線の3者（既存の廃液処理業者・廃液を出す工場・燃料の買い手）は主力に上乗せする計画の部分で、お金の取り方はまだ決まっていない。大学への支払いの条件、取り出した金属を誰のものにするか、保守料の決め方も未定。

### オフサイト（案C）の役割分担

| 担い手 | 役割 |
|---|---|
| 廃液を出す工場 | 特別管理産業廃棄物（特管）を含む廃液の処理を、許可を持つ処理業者へ委託。処理費の支払い |
| 既存の廃液処理業者 | 廃液の回収・運搬・処理（いまの許可と工場のまま）。自社工場の中和・沈殿の後に、菌の処理段階を追加 |
| SolvioraX | 菌の処理段階で使う菌体と処理装置の納入。菌が取り込んだ金属の取り出し |

SolvioraX が受け取るお金（利用料など）と、取り出した金属の売上の分け方は未定。この形（案C）で試すことは 2026-09-14 に決まった（まさ「Cがいいと思う」）。詳しくは「オフサイトの廃液処理の評価」と「オフサイトの事業の形の選択肢」。

### 収益の柱

| 柱 | 顧客 | 渡すもの | お金の取り方 | いまの状態（2026-09-17） |
|---|---|---|---|---|
| 着色排水（色素分解） | 染色・繊維・食品の工場 | 装置、菌体の定期納入、保守 | 装置代（一度）＋定期利用料（処理量あたり）＋保守料 | 着色排水の脱色をラボで確認（TRL4）。試算の総コストは処理1m³あたり 135.0円（自然株）・139.3円（強化株）、置き値の売価は 500円。排熱・排ガス・排液を使える工場では 32.9円・35.2円 |
| 金属を含む排水（金属回収） | めっき・半導体・磁石・金属加工の工場 | 上と同じ＋金属を取り込んだ菌体の引き取り | 上と同じ＋取り出した金属の販売 | Cu・Ni・Fe の取り込みをラボで確認、Pb・Dy・Nd は速報。試算の総コストは 913.2円（自然株）・749.2円（強化株）で、売価 500円を超過。排熱・排ガス・排液を使える工場では 209.5円・180.5円 |
| オフサイト（案C） | 既存の廃液処理業者 | 菌の処理段階（業者の工場の中和・沈殿の後）で使う菌体と処理装置、取り込んだ金属の取り出し | 未定（利用料、金属の売上の分け方） | 2026-09-14 に案Cで試すことを決定。相手・液・菌の性能は未確認。詳しくは「オフサイトの廃液処理の評価」 |
| バイオ燃料 | 船舶燃料・SAF のサプライチェーン | FAME（SAF は外部で精製） | 燃料の販売（計画 200円/L） | シード資金の対象外、事業概要では FY2033 に開発開始の計画。試算の総原価は 7,785.8円/L（基準・委託）、排熱・排ガス・排液を使える場合でも 1,163.0円/L で、計画の売価を超過 |

- 試算の数字は、コスト試算（廃液）のオンサイト・直接投入と、コスト試算（燃料）の値（2026-09-17 時点）。前提を変えると動くので、最新はそれぞれのタブで見る
- 「排熱・排ガス・排液を使える」は、コスト試算の「排熱利用可能」「排ガス利用可能」「工場の排液を培地に使える」の3つをすべて入れた場合
- コスト試算（廃液）の売上に入っているのは、処理量あたりの定期利用料（置き値 500円/m³）だけ。装置代・保守料・金属の代金はまだ入っていない
- 月次試算表 v3.2 の計画では、FY2034 の売上 約143億円のうち排水処理（定期利用料）が 約72億円、装置販売が 約71億円でほぼ半分ずつ。装置は製造を外部に委託する前提（原価は装置販売額の85%）で、粗利は排水処理 約28億円・装置販売 約11億円と、排水処理の側で多く出る

### 成り立つための条件

ゴールツリーの「NewCo設立」の下で、次の問いがまだ開いている（2026-09-17 時点）。

- UEが成立するか（UE: 処理1単位あたりの採算）。色素分解・金属回収とも、1m³あたりに要る菌体の量（取り込み効率と使い回せる回数）で大きく変わる
- オンサイトPoCの実現
- 営利100億いくか？（期限 2026-12-18）。色素分解と金属回収でUEが成立しても、市場の大きさの面でそれだけではVCから調達できず、別に営利100億の筋書きが要る（まさ 2026-09-12）。下に「バイオディーゼル事業は成立するか」と「他のマネタイズポイントの洗い出し」（オフサイトの廃液処理を含む）がある
- 強化株を閉鎖系で使えるか。強化株の数字は、閉鎖系で使えることが前提

段階ごとの到達点は事業計画タブにある: 設立準備（〜2027年3月）→ Seed（2027年4月〜、有償PoC 2件以上）→ Series A（継続顧客3社以上・売上7億円規模）→ Series B（売上60億円規模への受注残）→ Series C〜IPO（売上200億円規模へ）。

### 出典

- 事業の形と収益の取り方: SolvioraX 事業概要 v1.7（2026-09-06、Drive `p21_sol/260903_VC初回アプローチ資料`）
- 売上と粗利の計画: SX_月次試算表 v3.2（2026-09-06、Drive `p21_sol/260906_SX月次試算表改訂`）
- 処理1m³あたり・燃料1Lあたりの原価: コスト試算（廃液）・コスト試算（燃料）（2026-09-17 時点）
- 性能の現在地: 技術タブ「シアノバクテリアの性能一覧」／段階ごとの到達点: 事業計画タブ／成り立つための条件: ゴールツリー$ov$, source_ref = $t$SolvioraX 事業概要 v1.7（2026-09-06）／SX_月次試算表 v3.2（2026-09-06）／コスト試算（廃液・燃料）2026-09-17 時点／ゴールツリー$t$, updated_by = $t$amie$t$, updated_at = now() where tech_topic_id = $t$ptt_sol_bm_overview$t$ and project_id = $t$p21$t$;
update project_tech_topics set body_md = $ev$**一言でいうと** — 特別管理産業廃棄物（以下、特管）を含む廃液を、SOLが許可を持つタンクローリーで集めてSOL工場で処理する事業は、会社設立（ゴールツリーの期限は2027年4月1日）から最初の実証を終えるまでの時期に並行して始める事業としては勧めない。オフサイトの処理を残すなら、特管に当たるかどうかではなく**菌で処理する意味がある液か**で対象を選び、許可と設備を持つ既存の処理業者と組む形から試す。

### 理由

1. **地域の量が小さい。** 環境省の推計（令和4年度）で、愛媛県で出る特管の廃酸・廃アルカリは年約4,900t、四国4県でも約13,000t。コスト試算（廃液）のオフサイトの置き値（年30,000m³）は四国全体の2倍を超える。全量を1kgあたり100円で引き取っても四国全体で年約13億円で、その液はいま既存の処理業者が受けている
2. **高く引き取れる液ほど、菌では処理しにくい。** 必要な菌体の量は金属の濃さに比例する。いまの取り込みの値（乾燥菌体1gあたり鉄0.053g、単回の試験値）では、金属5,000mg/Lの液1m³に乾燥菌体が約105kg要り、菌体の重さが液の1割を超える。特管の廃酸・廃アルカリは国が定めた方法（環境省の概要では中和、焼却、イオン交換設備等での再生）で処分するので、菌が働ける場面は中和の後になる
3. **許可と設備が重い。** 1日100m³を処理するなら、中和施設（1日50m³超）が施設の設置許可の対象になり、生活環境影響調査、書類の縦覧、住民の意見書、専門家と市町村長の意見聴取が加わる。タンクローリー、受け入れ検査、中和・脱水の設備、汚泥の処分、技術管理者も自社で持つことになる
4. **同じ土俵に大手がいる。** 工場廃液の処理を本業とするダイセキは、2027年2月期の予想で売上742億円、営業利益168億円（利益率 約23%）で、広島県東広島市に処理拠点を持つ

### 試算で見たオフサイト（2026-09-14 時点）

コスト試算（廃液）のオフサイトは、売価を液の引き取りの値段（1m³あたり50,000円＝1Lあたり50円）に置き、引き取る液の濃さもオンサイトと別に置いている（仮置き 色素1,000mg/L・金属5,000ppm）。濃さを顧客工場の排水と同じ50mg/Lにしていたときは、利益率が94%前後になっていた。数字の正本はコスト試算（廃液）で、前提を変えると動く。この数字は SOL工場で処理する形（案A）のもので、案Cの形では試算していない。

| 用途 | 1m³あたりの総コスト（直接投入） 自然株 / 強化株 | 利益率 自然株 / 強化株 |
|---|---:|---:|
| 色素分解 | 3,941.7円 / 4,007.6円 | 92.1% / 92.0% |
| 金属回収 | 51,110.3円 / 43,357.6円 | -2.2% / 13.3% |

金属回収は、使い切る菌体の費用（強化株で1m³あたり約35,040円）と使用済み菌体の後処理（約4,061円）が総コストの大半を占め、自然株では売価を超える。

### 反社会的勢力について

許可を持って行う廃液の中間処理は、設備投資が大きく、大手・上場企業が中心である。警察庁の最新の報告書（令和6年における組織犯罪の情勢）が、暴力団が進出・関与している事業として挙げるのは金融業・建設業・労働者派遣業・風俗営業等で、「産業廃棄物」という語は本文に出てこない。

一方で、2008年度の環境省の調査では、許可業者の14.9%が反社会的勢力から不当要求を受けたことがあると答え、処分費を下げるための無許可業者への持ち込みや、最終処分場の権利の売買に反社会的勢力が関わるという証言もあった。いまの実態を示す公的な調査は見つからなかった。既存の商流を荒らすと危ないという懸念を裏づける資料も、危なくないと言い切れる資料もない。事業として割に合わない以上、このリスクを取りにいく理由は薄い。詳しくは「反社会的勢力と既存業者のリスク」。

### 決まったこと

- 事業の形は**案C（既存の処理業者と組む）で試す**（2026-09-14 まさ「Cがいいと思う」）。SOLが自分で特管の許可と工場を持つ形（案A）はとらない
- オフサイトで引き取る液の濃さは仮置き（色素1,000mg/L・金属5,000ppm）のまま。実測の値は無い（2026-09-14 まさ「生の数字は一切ないのでそのままで」）

### 次にやること

- 案Cの相手になる四国・中国の廃液処理業者に、受け入れている液、処理に困っている液、工場の中和・沈殿の後に菌の処理段階を置く余地を聞く
- 誰に何を聞けば決まるかは「確認事項」

### 出典

検証の資料は Drive `p21_sol/260914_オフサイト廃液処理の検証`（md・html）。一次資料は各トピックの出典に載せている。$ev$, updated_by = $t$amie$t$, updated_at = now() where tech_topic_id = $t$ptt_sol_bm_offsite_eval$t$ and project_id = $t$p21$t$;
update project_tech_topics set body_md = $qs$| 確認先 | 聞くこと |
|---|---|
| 愛媛県 循環型社会推進課 | 県内の特管の廃酸・廃アルカリの排出量と委託量（実態調査）／処理施設の設置の事前協議と住民説明の扱い／菌による処理が特管の処分の方法に当たるか／使用済みの菌体を顧客工場からSOLが引き取る場合、排出事業者は誰になり、許可が要るか |
| 環境省 環境再生・資源循環局 | 特管の廃酸・廃アルカリの処分の方法（平成4年厚生省告示第194号）に生物による処理が入る余地／再生利用の認定・指定の制度が特管に使えるか |
| 杉浦先生 | 取り込みの上限（反復試験）／耐えられるpHと金属の濃さ／錯体になったニッケルを取り込めるか／色の濃い染色廃液での性能 |
| 顧客候補（メイトなど） | いま産廃として出している液の種類・量・濃さ・処分費・運搬費・出す頻度 |
| 四国・中国の廃液処理業者 | 受け入れている液の種類と値段、処理に困っている液、工場の中和・沈殿の後に菌の処理段階を置く余地 |
| 愛媛県の許可業者名簿 | 廃酸・廃アルカリの中和処理の許可を持つ県内の業者と処理能力 |

案Cで試すので、まず四国・中国の廃液処理業者に聞く（2026-09-14 まさ「Cがいいと思う」）。

コスト試算（廃液）のオフサイトの濃さ（仮置き 色素1,000mg/L・金属5,000ppm）は、実測の値が無いので仮置きのまま（2026-09-14 まさ「生の数字は一切ないのでそのままで」）。顧客候補や処理業者から液の分析値が手に入ったら置き換える。$qs$, updated_by = $t$amie$t$, updated_at = now() where tech_topic_id = $t$ptt_sol_bm_questions$t$ and project_id = $t$p21$t$;
update project_tech_entries set value_text = $c1$廃液の回収・処理は、許可を持つ既存の処理業者が担当。SOLは、業者の工場の中和・沈殿の後に置く菌の処理段階へ、菌体と処理装置を納入。菌が取り込んだ金属の取り出しもSOLが担当$c1$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sol_bm_opt_013$t$;
do $do$ declare nt int; begin
  select count(*) into nt from project_tech_topics where project_id = $t$p21$t$ and tech_domain = $t$ビジネスモデル$t$;
  if nt <> 11 then raise exception 'ビジネスモデルのトピック数が想定と違う: %', nt; end if;
  if not exists (select 1 from project_tech_topics where tech_topic_id = $t$ptt_sol_bm_overview$t$ and body_md like '%```pictogram%' and body_md not like '%```mermaid%') then raise exception 'ピクト図への置き換えが入っていない'; end if;
  if exists (select 1 from project_tech_topics where project_id = $t$p21$t$ and tech_domain = $t$ビジネスモデル$t$ and coalesce(body_md, '') like '%菌の工程%') then raise exception '「菌の工程」の言い回しが残っている'; end if;
end $do$;
commit;
