# P/R_net bridge business and validation value source pack

作成日: 2026-06-02
作成者: BZM理論検証worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、PRS comparison layer / evidence cards v2 を受けて、`bridge business` と `validation value` の source 候補を人間レビュー用に整理した read-only pack である。

- DB write、DDL、migration、extractor実装、コード実装、deployは行っていない。
- 0-9 score表、R_net値付け、正式rubric確定、現行7軸AMD Score置換、過去score再計算は行っていない。
- `billing_cycles`、AMD billing、大学/NIMS/PSI等の研究契約、助成金、融資、投資は bridge revenue / SU本体粗利として扱わない。
- p03 ティエムの Cabot代理店/商社化/開発受託は `scenario` と明記し、実績粗利にしない。
- p20/p21 の利益度外視PoC/テスト販売/有料製作は、粗利ではなく評価データ価値なら `validation_value_source` に置く。
- `PRSで使うなら` は `usable source` / `review-only` / `exclude from PRS` の3値で統一する。

確認した主資料:

- `pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v2.md`
- `pwa/bzm/runs/2026-06-02-prs-billing-vs-su-revenue-join-map.md`
- `pwa/bzm/runs/2026-06-02-prs-finance-cash-source-pack.md`
- `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/design/L2_DATA.md`
- `pwa/design/db_schema.md`
- relevant `/spec` / `/manual` docs for L2 source status, billing, PL, XRL, and strategy signals
- `/Users/masa/projects/knowledge/{tiem,KT,LST,jc,BWE,cx,sx}.md` references already surfaced in prior BZM runs

## 1. 全体結論

| 結論 | 内容 |
|---|---|
| bridge business は `candidate/review-only` が中心 | p07 リサイクル商流、p21 U1 PoC、p04 Adam MVP販売、p20 TES/ADR/冷却機テスト販売、p11 膜外販は候補になる。ただし契約、請求、入金、原価、本命毀損まで揃うまでは正式R_net値にしない。 |
| validation value は粗利と別管理 | p20/p21/p07/p11 の実証・PoC・テスト販売・評価データは BRL/SRL/Survival 補助として価値があるが、利益度外視なら粗利へ加算しない。 |
| finance分類v2を維持 | NIMS契約、愛媛大学/PSII、SIP、Startup Global、融資/投資、`billing_cycles` は bridge revenue ではない。`research_contract_cash` / `grant_or_policy_cash` / `debt_or_equity_cash` として分離する。 |
| p03はscenario扱い | Cabot代理店/商社化/開発受託は反実仮想 source。R_net概念の検討材料にはなるが、実績粗利にも formal score にも使わない。 |
| BWE膜外販は review gate 継続 | 膜は本命RED装置のボトルネックでもあるため、外販は `bottleneck_external_sale_candidate` のまま、`requires_masa_or_bzm_review` を維持する。 |

## 2. Source候補一覧

### 2.1 p07 LiSTie

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| xrl evidence `0aa71b29-915c-43d8-86ee-060d87217f09` | candidate | `bridge_business_candidate` | リサイクラー3社NDA、MOU獲得方針、装置メーカー連携、ブラックマス調達先協議。リサイクル商流の入口候補。 | `review-only` | NDA/MOU方針を受注・入金実績にしない。リサイクル商流と本命LISMIC装置Pを足さない。 | 資源安保、事業化接点、BRL/SRL上昇は7軸で説明可能。 | 本命LISMIC前にリサイクル商流でburnを支える bridge 設計を観測できる。 |
| project_knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | active | `bridge_business_candidate` | ブラックマス買取、マンガン系・LFP系リサイクルリチウム販売先候補。 | `review-only` | 顧客/販売先候補を売上実績にしない。単価、原価、契約、入金条件が必要。 | 顧客候補・商流形成はBRL/GRL/SRLで説明可能。 | 本命装置販売前の別系統商流が独立収益になり得るかを見られる。 |
| xrl evidence `fb0bd2de-2c62-42bb-ae0f-020b620129cf` | candidate | `bridge_business_cost_source` | 膜寿命、間欠的電圧印加、QC協力の加速試験、前処理コスト課題。 | `review-only` | コスト課題を粗利率そのものとして扱わない。 | 技術課題/TRL/SRLの根拠として使える。 | bridge商流の粗利を押し下げる運営コスト・前処理負担のsourceになる。 |
| project_knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` | active | `bridge_business_cost_source` | 数千tレベルがミニマムで、初期R&D費用回収が難しい可能性。 | `usable source` | 売上候補と相殺せず、R_net押し下げsourceとして別表示する。 | 量産/スケール readiness の不足は7軸でも説明可能。 | 売上候補があっても運営コストでR_netが薄くなる可能性を示せる。 |
| project_knowledge `cd5e86d0-ec74-45aa-9a15-d4237e974610` | active | `bridge_business_cost_source` | 柏市物件、2,727平米、初期費用5,000万円程度見込み。 | `usable source` | 見込みCAPEXを実支出・確定粗利扱いしない。 | FRL/BRLの資金・拠点準備として説明可能。 | bridge business がcashを生む前に固定費を増やすリスクを見られる。 |
| xrl evidence `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | candidate | `validation_value_source` | TYK向けベンチ実証機の設置・試運転段階。 | `review-only` | TYK実証を販売実績や粗利にしない。評価データ/BRL/SRL補助へ置く。 | 実証・顧客検証はTRL/BRL/SRLで説明可能。 | 実証データが本命LISMIC販売へつながるかを validation value として追える。 |
| xrl evidence `ba404315-ee28-4f44-9156-9a2165103982` | candidate | `exclude_as_bridge_revenue` | Startup Global最大2億円契約/KPI。 | `exclude from PRS` | 助成・海外展開支援を売上粗利にしない。Survival guardへ分離。 | 政策・外部支援・FRL補助として説明可能。 | bridge revenueではなく、後払い/自己負担/使途制限込みのSurvival論点。 |
| xrl evidence `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | candidate | `exclude_as_bridge_revenue` | 日本政策金融公庫8,000万円融資、DG Daiwa Ventures 1億円投資委員会。 | `exclude from PRS` | 融資/投資を粗利に加算しない。 | FRL/runway根拠として説明可能。 | R_netではなくcash runway補助。 |

### 2.2 p20 CryoX

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| CX利益度外視テスト販売/有料製作候補 | candidate/mixed | `validation_value_source` | TES自社生産、ADR/冷却機、アカデミア向けテスト販売・有料製作の候補。評価データ獲得優先の可能性。 | `review-only` | 評価データ獲得を粗利として二重カウントしない。単価/原価/人員負担が揃うまでR_net値にしない。 | NIMS研究、顧客候補、TRL/BRL/SRLの上昇は7軸で説明可能。 | 利益度外視でも、将来販売・提携・顧客信頼につながる validation value を観測できる。 |
| meeting summary `slack-C092CF84CJV-1777271916_647919` | confirmed/candidate | `validation_value_source` / `bridge_business_cost_source` | CryoX線材とMgB2比較、露光関係スライド、コスト整理シート、調達額シミュレーション、MRI応用資料。 | `review-only` | コスト整理の存在を正式粗利値にしない。販売単価・原価・CAPEXの突合が必要。 | 技術・用途・顧客評価の補助として7軸で説明可能。 | テスト販売や有料製作が本命冷却機市場への評価データになるかを見られる。 |
| strategy signal `91bf2e92-2383-4563-abc3-d0e812e5916e` | candidate | `bridge_business_cost_source` | 資金調達額シミュレーション、販売原価・CAPEXの金額感すり合わせ。 | `review-only` | 金額感をR_net値にしない。 | FRL/BRLの準備論点として説明可能。 | bridge/テスト販売が固定費やCAPEXを食う可能性を観測できる。 |
| meeting summary `5hv3utbm3cn8vlkk4p3th3pios` | confirmed/candidate | `exclude_as_bridge_revenue` / `research_contract_cash` | NIMS新規契約を税込100万円未満で締結し、6月から現場活動開始。 | `review-only` | NIMS研究契約cashをSU本体売上・粗利にしない。本命冷却機市場Pとも足さない。 | NIMS連携、実施許諾、研究体制は7軸で説明可能。 | bridge revenueではなく、研究契約cash / validation access の補助としてのみ見る。 |
| strategy signal `aad6dc9e-240c-42ec-9f63-27bcea20a91d` | candidate | `exclude_as_bridge_revenue` / `research_contract_cash` | NIMS仕様書準備、税込100万円未満の見積依頼。 | `review-only` | 見積依頼を売上実績にしない。 | 研究機関接続・BRL/SRLの補助。 | research contract cashの進行度として補助確認できる。 |
| strategy signal `9b080419-4df5-4cd8-8578-cd78b8099c34` | candidate | `exclude_as_bridge_revenue` / `research_contract_cash` | NIMS契約・6月現場活動予定。 | `review-only` | 研究契約と本命冷却機販売を混ぜない。 | 現場活動・顧客/研究機関接続として7軸で説明可能。 | evaluation/validation accessの補助sourceになるが粗利にはしない。 |
| `billing_cycles` `e1c409f6-18d8-4729-8452-de208955e448` / `b15713d4-2175-41c1-8c6f-0091a0aa57f2` / `c98648e2-8d16-425c-b65e-a237cc1b6d79` | not_started | `exclude_as_bridge_revenue` / `amd_billing_row` | p20 202607-202609 の `budget_yen=188500` AMD billing rows。 | `exclude from PRS` | AMD請求予定をSU本体PLへ転記しない。 | AMD業務請求の運用情報。7軸/PRSの本体根拠ではない。 | 使うならcash timing補助のみ。 |
| meeting summary `5jj2i4e0so5f4valupne18ujha` / signal `c80306a5-b71a-4089-9430-892127f5fff1` | confirmed/candidate | `exclude_as_bridge_revenue` / `grant_or_policy_cash` | VC/コンソーシアム/助成金活用、大手企業コンソーシアムモデル検討。 | `exclude from PRS` | 助成金・コンソーシアム方針を粗利にしない。 | FRL/GRL/SRL/政策接続として説明可能。 | bridge revenueではなくSurvival/lane guard候補。 |

### 2.3 p21 SolvioraX

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| xrl evidence `3fc6e490-9f4d-4d73-ac0b-a306ffb97edf` | candidate | `bridge_business_candidate` / `validation_value_source` | Fine-Chem面談、ガラスリソーシング経由の回収ルート、金属廃液サンプル、10件PoC、来年3月までの売上実績づくり。 | `review-only` | 10件PoCを実績売上・粗利にしない。U1短期cashとU4/U5本命Pを分ける。 | PoC先候補、顧客検証、PSI後の事業化準備は7軸で説明可能。 | U1の短期cash/PoCが本命U4/U5へ橋渡しするか、評価データ価値を持つかを追える。 |
| meeting summary `77836j7np0dovhcns78av79qdq` | confirmed/candidate | `bridge_business_candidate` / `unit_economics_margin_source` | SXのコスト分析・ビジネスモデル検討。処理単価485円/Lでは利益率が低く追加収益源が必要。 | `usable source` | 485円/Lを正式R_net値にしない。U1短期cash層のUE sourceに留め、U4/U5本命Pへ二重カウントしない。 | 価格受容/BRLの補助として説明可能。 | U1 PoCの粗利限界、追加収益源必要性というPRS固有のUE論点を示せる。 |
| meeting summary `6ujslfj6rjb6htj00hgp5q2srt` | confirmed/candidate | `bridge_business_candidate` / `pricing_model_source` | 従量課金モデル中心に展開する方針。重金属回収・色素分解を優先技術とする。 | `review-only` | 価格体系候補を粗利実績にしない。 | 用途/顧客/BRLの進展として7軸で説明可能。 | U1短期cash層の価格モデルと本命用途レーン分離を観測できる。 |
| Fine-Chem/オンサイトPoC/評価データ系候補 | candidate/mixed | `validation_value_source` | オンサイトPoC、顧客サンプル、評価データ獲得の候補。 | `review-only` | 利益度外視PoC/評価データをR_net粗利にしない。 | TRL/BRL/SRLの顧客検証として説明可能。 | PoC消化が本命技術・規制・知財へ効くか、またはリソースを食うかを分けられる。 |
| monthly report `p21_202607` ほか future draft series | draft/future | `future_or_draft_plan` | 市場調査、コスト試算、月次試算表、事業計画原案。 | `review-only` | future draftを実績値にしない。 | 設立準備・事業計画として7軸で説明可能。 | bridge/PoCの予定sourceとして使えるが、値付けには使わない。 |
| monthly report `p21_202605` | draft | `exclude_as_bridge_revenue` / `research_contract_cash` | 愛媛大学契約・発注確定、Fine-Chem PoC具体化など。 | `review-only` | 愛媛大学契約をSU本体売上にしない。 | 設立準備・研究機関連携として7軸で説明可能。 | research contract cash と U1 PoC候補を分けるための補助source。 |
| meeting summary `4qqkgiatvd0p2sm4mspqr8k920_20260331T070000Z` | confirmed/candidate | `exclude_as_bridge_revenue` / `research_contract_cash` | 愛媛大学への納品、2026年度契約の見積書・仕様書提出。 | `review-only` | 大学契約cashをU1売上/粗利へ混ぜない。 | 研究機関連携/納品プロセスとして7軸で説明可能。 | cash timing補助だがbridge revenueではない。 |
| meeting summary `43nvst4qu8ppdclf0heqd614u1` | confirmed/candidate | `exclude_as_bridge_revenue` / `research_contract_cash` | PSII予算1500万円、見積調整、支払予定。 | `review-only` | PSII/大学予算をSU販売粗利にしない。 | 政策/研究資金・FRL補助として説明可能。 | Survival/cash timing補助に留める。 |
| xrl evidence `1388d1cc-8e18-4cb0-8561-b3ce9f3533d5` / monthly report `MR_p21_202604` | confirmed/draft | `exclude_as_bridge_revenue` / `grant_or_policy_cash` | 国プロ接続候補、PSI Step2 Year1完了、会社設立・PoC開拓フェーズ移行。 | `exclude from PRS` | 国プロ/PSIを粗利加算しない。 | GRL/SRL/FRL/Survival補助として説明可能。 | bridge revenueではなく lane-specific Survival source。 |

### 2.4 p04 輝翠TECH

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/KT.md` / 既存BZM runs | knowledge/public-known | `mvp_revenue_candidate` | 農業用AIロボAdamをMVPとして販売開始済み。2023年に多数農家でデモ、2024年3月販売開始、2024年5月シリーズA調達。 | `review-only` | Adam販売を即高R_netにしない。本命MVP前倒し収益と導入/保守/量産コストを分ける。 | 月面ローバー技術から農業ロボへの転用、TRL/BRL/HRL上昇、COO派遣/体制構築は7軸で説明可能。 | 本命そのものをMVP化して早期収益化する型として、p07/p20の別系統bridgeと比較できる。 |
| 追加finance/L2 source | not currently available in current pack | `mvp_revenue_candidate` | 販売台数、単価、粗利、導入/保守負担は未確認。 | `exclude from PRS` | DB/L2が薄い状態を売上ゼロ確定にも高R_netにも使わない。 | 現状は7軸の成熟・成長説明が主。 | 次researchで販売/保守/粗利が取れれば本命MVP前倒し収益型の強い比較材料になる。 |

### 2.5 p03 ティエムファクトリ

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/tiem.md` / `before_zero_theory.md` / 既存BZM runs | scenario | `scenario_bridge_business_source` | Cabot代理店、エアロゲル商社、開発受託が本命モノリスR&Dを支える反実仮想。 | `review-only` | 反実仮想を実績粗利にしない。本命透明モノリスPと商社粗利を足さない。商社化万能論にしない。 | 設立時TRL=0、早すぎた判断、マクロ追い風と自社内製TRL不足は7軸で説明可能。 | Pは大きいがR_netが立たず、生存しながら本命R&Dを続ける構造がなかった、という反省を表現できる。 |
| 追加DB/L2/finance source | not currently available | `scenario_bridge_business_source` | 当時の契約額、粗利、在庫/営業/与信コスト、本命再投資 source は未確認。 | `exclude from PRS` | DB/L2が薄い状態を正式R_net値に変換しない。 | 7軸retrofitの主張は既存BZM章で説明済み。 | 次researchで当時資料・公開情報・まさ/BZM判断が必要。 |

### 2.6 p11 BWE

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| `2026-06-01-prs-l2-source-inventory.md` / BWE GP30%メモ | candidate | `bottleneck_external_sale_candidate` | 膜外販のGP30%候補。元row、単価、原価、供給余力、本命RED影響が未確認。 | `review-only` | 膜外販を正のR_netにしない。膜は本命RED装置のボトルネックでもあるため `requires_masa_or_bzm_review` を維持する。 | SIP採択、政策マクロ、実証、TRL/BRL/HRLは7軸で説明可能。 | 高P・政策資金ありでも初期自走性が弱い大型装置PJとして、bridge候補の危うさを見られる。 |
| source_cache `p11_slack_1745979366_346149` | unknown | `validation_value_source` | KKMTGメモ。試運転、山大契約、SPD訪問、実証運営予定。 | `review-only` | 実証予定を売上実績にしない。 | 政策実証・共同研究・SRL/GRLの根拠として説明可能。 | 実証データや顧客/研究機関評価を validation value として扱えるが、粗利にはしない。 |
| monthly report `p11_202612` | draft | `future_or_draft_plan` / `bottleneck_external_sale_candidate` | 住友理工条件交渉、10kW PoC、シード準備。 | `review-only` | future draftを契約・入金・粗利扱いしない。 | BRL/FRL/実証計画として説明可能。 | 膜外販/PoCが本命REDへ資源を戻すか、膜供給を食うかの観測予定。 |
| source_cache `p11_gmeet_minutes_198e5a68b13c43ea` / `p11_gmeet_minutes_1990d8b496887caa` | unknown | `exclude_as_bridge_revenue` / `research_contract_cash` | SIP収入、経理管理、立替経費精算、遅延損害金、請求金額調整。 | `review-only` | SIP/共同研究/立替精算をSU販売粗利にしない。 | 政策資金・共同研究・運営管理は7軸/Survivalで説明可能。 | cash conversion補助であり、bridge revenueではない。 |
| source_cache `p11_gmail_1987e26bfa8c4a6f` | unknown | `exclude_as_bridge_revenue` / `grant_or_policy_cash` | SIP C(1) 三者共同研究契約書案。 | `exclude from PRS` | 政策実証/共同研究をR_net粗利にしない。 | GRL/SRL/Survival補助として説明可能。 | bridge sourceからは除外し、lane-specific Survival packへ渡す。 |

### 2.7 p09 JOYCLE minimum note

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| p09 monthly_reports / project_knowledge / source_cache from source inventory | mixed | `damage_guard_research_target` | JB-02/JB-02A販売前夜、R&D投資、AMD関与終結ログの候補。 | `review-only` | 販売前夜を正のbridge businessにしない。売上候補と本命R&D毀損を分ける。 | 設立時SaaSで自社技術なし、TRL=0 NO_GOは7軸で説明可能。 | 目先収益化が本命R&Dを毀損する負のR_net / damage guardを検証する対象。 |

## 3. PRS利用方針

| use | 入れるsource | 今回の該当 |
|---|---|---|
| `usable source` | 値ではなく、方向性・制約・コストとして比較層に置ける根拠。正式R_net値にはしない。 | p07 初期R&D費用回収難、p07 初期費用5,000万円見込み、p21 485円/LのUE source |
| `review-only` | candidate / draft / scenario / unknown / confirmed-candidate混在。人間レビューで意味を確定する候補。 | p07 MOU/販売先/TYK、p20 テスト販売/コスト整理/NIMS research contract、p21 Fine-Chem/PoC/従量課金、p04 Adam、p03 scenario、p11膜外販 |
| `exclude from PRS` | bridge revenueやvalidation valueではなく、AMD billing / research contract / grant / investment / future欠損。 | p20 billing_cycles、p07融資/投資/Startup Global、p21 PSI/国プロ、p11 SIP grant、p03/p04追加sourceなし |

## 4. 二重カウント防止ルール

1. `billing_cycles` は AMD billing。SU本体売上・粗利・bridge revenueへ転記しない。
2. NIMS、愛媛大学、PSII、SIPなどの研究機関契約cashは `research_contract_cash` として分離し、bridge businessにはしない。
3. 助成金、政策資金、融資、投資、Startup Global、PSI、SIPは R_net粗利に加算しない。
4. p07 リサイクル商流と本命LISMIC装置P、p20 NIMS契約と本命冷却機市場、p21 U1短期cashとU4/U5本命Pを足し算しない。
5. p20/p21 の利益度外視PoC/テスト販売は、粗利目的か評価データ目的かを分ける。評価データ目的なら `validation_value_source`。
6. p03の商社/受託は `scenario_bridge_business_source`。実績粗利やformal scoreにしない。
7. p11膜外販は、供給余力、粗利、外販先、本命RED装置への影響が揃うまで `bottleneck_external_sale_candidate` + `review-only`。

## 5. 司令塔判断事項

1. p20/p21 の利益度外視PoC/テスト販売を、R_net粗利ではなく `validation_value_source` として固定してよいか。
2. p07 のリサイクル商流を `bridge_business_candidate` として次の観測対象に上げる条件は、契約/請求/入金/原価/本命LISMIC影響の5点でよいか。
3. p21 の 485円/L source は `usable source` のまま、正式R_net値ではなく U1短期cash層のUE制約として扱ってよいか。
4. p04 Adam販売は `mvp_revenue_candidate` として有望だが、販売台数・単価・粗利・保守負担が揃うまで `review-only` 維持でよいか。
5. p03 商社/受託は scenario のまま、BZM本文では反省・仮説として扱い、evidence cardでは実績欄に入れない運用でよいか。
6. p11膜外販の `requires_masa_or_bzm_review` を解除する条件を、供給余力・粗利・本命RED影響の3条件にしてよいか。

## 6. 次アクション

1. BZM司令塔が本packをレビューし、`bridge_business_candidate` / `mvp_revenue_candidate` / `validation_value_source` / `scenario_bridge_business_source` / `bottleneck_external_sale_candidate` の分類を採用・差し戻し判定する。
2. 採用なら evidence cards v3 または judgement brief へ、今回の `source_status` / `PRSで使うなら` / `double_count_guard` を戻す。
3. 次workerを切るなら、p07/p20/p21の契約・請求・入金・原価・本命毀損 join、p04 Adam販売の販売/保守 research、p03 scenario validation research、p11膜外販条件確認に分ける。
4. damage/reinvestment packでは p09 JOYCLE を主対象にし、bridge候補と本命毀損を分ける。

## 7. 検証

- 指定された `AGENTS` / `CLAUDE` / `HANDOFF` / BZM runs / L2 design / schema / relevant spec/manual を read-only で確認した。
- `git status -sb` を確認した。
- `git fetch --all --prune`、`git branch -a`、`git log --branches --not --remotes --oneline` を確認した。
- DB write、DDL、migration、deploy、extractor実装、コード実装は行っていない。
- 0-9 score表、R_net値付け、正式rubric確定、現行7軸AMD Score置換、過去score再計算は行っていない。
- `git add .` は使っていない。
