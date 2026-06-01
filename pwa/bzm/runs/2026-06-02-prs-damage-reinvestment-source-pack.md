# PRS damage guard and reinvestment source pack

作成日: 2026-06-02
作成者: BZM理論検証worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、PRS comparison layer / evidence cards v2 / bridge-validation source packを受けて、`damage guard` と `reinvestment` のsource候補を人間レビュー用に整理した read-only pack である。

- DB write、DDL、migration、extractor実装、コード実装、deployは行っていない。
- 0-9 score表、R_net値付け、正式rubric確定、現行7軸AMD Score置換、過去score再計算は行っていない。
- `negative R_net` は正式用語として採用しない。本文では `damage guard` / `本命毀損候補` を基本表現にする。
- `PRSで使うなら` は `usable source` / `review-only` / `exclude from PRS` の3値で統一する。
- AMD billing、研究機関契約、助成金、融資、投資は、SU本体粗利やdamage/reinvestmentとして扱わない。
- JOYCLEは、JB-02/JB-02Aの販売前夜や売上候補を正のR_netにしない。本命R&D毀損・AMD関与終結ログと分ける。
- p03反実仮想はscenarioとして扱い、実績欄に入れない。
- p20/p21/p07は、bridge/validation sourceとreinvestment/damageを混ぜない。つなぎが本命へ戻る証拠と、本命を食う証拠を分ける。

確認した主資料:

- `pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v2.md`
- `pwa/bzm/runs/2026-06-02-prs-bridge-validation-source-pack.md`
- `pwa/bzm/runs/2026-06-02-prs-billing-vs-su-revenue-join-map.md`
- `pwa/bzm/runs/2026-06-02-prs-finance-cash-source-pack.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/design/L2_DATA.md`
- `pwa/design/db_schema.md`
- relevant `/spec` / `/manual` docs for L2 source status, billing, PL, XRL, strategy signals
- `/Users/masa/projects/knowledge/{jc,tiem,LST,cx,sx,before_zero_theory}.md`
- Supabase read-only SELECT: `project_ventures`, `project_knowledge`, `monthly_reports`, `source_cache`, `billing_cycles`, `protocols`, `project_strategy_signals`

## 1. 全体結論

| 結論 | 内容 |
|---|---|
| JOYCLEはdamage guard主対象 | JB-02/JB-02A販売前夜、装置見学会、有償テスト、法務意見書、装置量産計画は売上候補としては強いが、正のR_netにしない。研究開発予算・人員・野田先生技術実装・AMD関与終結ログと分けて見る。 |
| p03はscenario | Cabot代理店、商社、開発受託は反実仮想。R_net概念の検討材料だが、実績粗利・実績再投資には入れない。 |
| p20/p21/p07は両面候補 | bridge/validation候補は既存packにある。今回の論点は、そのcash/評価データが本命R&Dへ戻るか、個別対応・CAPEX・補助金後払い・周辺レイヤ対応で本命を食うか。 |
| billing/research/grantは除外 | p09 billing rowsやp20 NIMS、p21愛媛大学/PSII、p07 Startup Global/融資/投資は、cash timingやSurvival補助であり、damage/reinvestmentの本体根拠ではない。 |
| sourceは多いが値付け不可 | 多くが `candidate` / `draft` / `unknown` / `scenario`。人間レビューでsource意味を確定するまでは、正式R_net値・rubricへ進めない。 |

## 2. Source候補一覧

### 2.1 p09 JOYCLE

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/jc.md` | confirmed knowledge / oral history | `damage_guard_candidate` | 設立時は他社熱分解装置をIoT化するSaaSで自社技術なし。AMDが参画後、群馬大野田先生の流動層熱分解でdeep化を試みたが、2026-03にAMD関与終結。研究開発投資の意味が理解されず、目先売上へ寄ったことが退任理由として整理されている。 | `review-only` | 設立時TRL=0は7軸で説明し、PRSの成果にしない。AMD関与終結の口述を、正式なdamage値にしない。 | 設立時SaaS/TRL=0、AMD参画後のdeep pivot、TRL/BRL上昇は7軸で説明可能。 | TRLが上がった後に、目先収益化・株主/bizdev方針が本命R&Dを支えず毀損した可能性を説明できる。 |
| `/Users/masa/projects/knowledge/jc.md` JB-02/JB-02A section | candidate / oral history | `damage_guard_candidate` / `reinvestment_unverified` | JB-02は1台製作済み。JB-02Aは設計中で、年内完成から販売可能な状態に近い。ただし販売はこれからで、販売実績ゼロ・装置販売前夜。 | `review-only` | JB-02/JB-02A販売前夜を正のR_netにしない。売上候補、粗利、本命R&D再投資、本命毀損を分ける。 | 装置MVPのTRL/BRL進展は7軸で説明可能。 | 売上候補が本命流動層R&Dへ戻るのか、R&D削減の口実になるのかを分けられる。 |
| `project_ventures` p09 (`master_md_slug=jc`) | confirmed DB row | `damage_guard_candidate` | `outcome_pattern=deep_pivot`、short descriptionは「IRSプリミティブ熱分解で立上 -> 群大野田先生の流動層熱分解で後付けdeep化」。AMD support startは2025-11-01、endedはNULLのままなので、knowledge側の2026-03終結との突合が必要。 | `review-only` | DB rowのAMD ended NULLをもって関与継続と断定しない。knowledgeとの差分はreview対象。 | deep_pivotパターンと研究機関/技術接続は7軸で説明可能。 | AMD関与終結ログのDB反映差分そのものがdamage guard source整備対象。 |
| monthly report `MR_p09_202511` | draft | `reinvestment_candidate` / `resource_distraction_source` | 研究開発体制再構築、野田先生特許を活用した装置小型化、CO削減触媒実験、車両購入に伴う約400万円の投資判断、人員確保計画、2週間単位の進捗管理が記載されている。 | `review-only` | draft月次を実績R_net値にしない。車両購入・R&D投資・人員確保を、売上候補と相殺せず別表示する。 | R&D体制、TRL/HRL補強、進捗管理は7軸で説明可能。 | 本命R&Dへの投資・採用が維持されたか、目先装置販売に吸われたかの観測候補になる。 |
| monthly report `p09_202512` | draft | `reinvestment_candidate` / `resource_distraction_source` | 竹富島実証、ミニモデル仕様再検討と発注準備、特許関連業務引き継ぎ、人材不足、資金調達面で「ディープテックとして認められる状態」をつくる優先事項が記載されている。 | `review-only` | 実証・資金調達方針を販売粗利にしない。人材不足はHRL/運営コスト側へ分ける。 | 実証・特許・人材不足・資金調達準備は7軸で説明可能。 | deeptech認定のための投資が本命へ戻る証拠か、個別実証消化でリソースを食う証拠かを分けられる。 |
| monthly report `MR_p09_202601` | draft | `reinvestment_candidate` | 研究開発体制強化、ミニモデル仕様確定に向けた定例、実証機材発送、フィールド検証準備、定例MTG継続参加が記載されている。 | `review-only` | 研究開発MTGや機材発送を売上実績扱いしない。 | R&D体制・フィールド検証・TRL進展は7軸で説明可能。 | R&D継続のsource候補。後続で予算/人員削減ログと突合する。 |
| monthly report `MR_p09_202602` | fixed | `reinvestment_candidate` / `resource_distraction_source` | 研究開発MTGが月内4回、技術課題検討と進捗確認が継続。OKRからマスタースケジュール運用への転換、請求書発行プロセス調整も記載。 | `usable source` | fixed月次でも、請求書調整はAMD billing/cash timingでありSU本体粗利ではない。 | 技術課題検討・プロジェクト管理体制は7軸で説明可能。 | 管理運用の変化がR&D継続を支えたか、事務/請求対応でリソースを食ったかを見る候補。 |
| source_cache `p09_gmeet_minutes_19c4625475e468b1` | confirmed/candidate raw source | `reinvestment_candidate` | 2026-02-10研究開発MTG。8つの研究開発テーマ、3月末ホワイトペーパー、触媒関連、流動サンドボックスとIR式比較、連続稼働実験、JB-02A仕様決定、品質保証専門家の関与が議論されている。 | `review-only` | 研究開発テーマを販売実績にしない。JB-02A仕様決定と粗利・販売・本命毀損を分ける。 | 技術課題・TRL/BRL進展は7軸で説明可能。 | JB-02Aが本命R&Dの実装継続か、目先販売への転換かを判断するsource候補。 |
| source_cache `p09_gmeet_minutes_19d19a9f41cfc6df` | confirmed/candidate raw source | `reinvestment_candidate` | 2026-03-23 JOYCLE<>野田先生MTG。大学の流動層装置利用、既存装置改造、共同研究、学生協力、補助金活用、高吸水性ポリマー処理などが議論されている。 | `review-only` | 大学装置利用・補助金検討をR_net粗利にしない。研究契約/助成金はSurvival補助へ分ける。 | 大学研究連携、TRL/GRL/BRL補助は7軸で説明可能。 | 野田先生技術の本命実装へ戻る証拠候補。AMD関与終結前後の継続/断絶確認に使う。 |
| source_cache `p09_gmail_19cbd831f3f4465b` | unknown raw source | `damage_guard_candidate` / `bridge_business_candidate` | JOYCLE BOXの有償テストに関する適法スキームと意見書作成相談。顧客の廃棄物処理を有償テストする段階の法務source候補。 | `review-only` | 有償テスト相談を売上実績・正のR_netにしない。法務/適法性確認、契約、請求、入金、原価、本命R&D影響を分ける。 | 法務/BRL/SRL進展は7軸で説明可能。 | 目先有償テストが本命R&Dへ戻るか、本命を食う現場対応かを検証する候補。 |
| source_cache `p09_gmail_19cfe120cc2a71b2` | unknown raw source | `bridge_business_candidate` / `damage_guard_candidate` | 東邦ガスとのやり取りで、投資先のクロスイー/永吉と装置のJOYCLE BOX化を検討している旨が出ている。 | `review-only` | JOYCLE BOX化検討を受注・入金・粗利にしない。 | 顧客候補/BRLは7軸で説明可能。 | 顧客案件が本命R&Dの評価データになるか、個別対応で本命を毀損するかを分ける候補。 |
| source_cache `p09_slack_1705354340_982309` | unknown raw source | `reinvestment_candidate` / `operating_cost_source` | 開発会議前のハード開発段取り、サカエ工業、開発予算2500万円程度で初号機を作れるかという議論。 | `review-only` | 開発予算見込みを実支出・粗利値にしない。 | 初号機開発・TRL/FRLは7軸で説明可能。 | 本命装置開発に必要なburn/投資規模をPRS補助として見られる。 |
| source_cache `p09_slack_1705355033_851759` | unknown raw source | `reinvestment_candidate` / `grant_or_policy_cash_exclude` | NEDO STS/SES申請シナリオ案。九大椿先生・北大黄先生への再委託、マイクロ波技術による装置開発など。 | `review-only` | NEDO申請・再委託案を粗利やreinvestment実績にしない。助成金/政策資金はSurvival補助へ分離。 | GRL/FRL/研究連携は7軸で説明可能。 | 本命技術R&Dを外部資金で支える設計候補として、採択/入金/使途制限の確認対象。 |
| source_cache `p09_slack_1706057433_112589` / `p09_slack_1710284416_901549` | unknown raw source | `reinvestment_candidate` | JOYCLE自社装置のたたき台、装置仕様のたたき台に関するやり取り。 | `review-only` | 仕様検討を販売前夜・売上実績として扱わない。 | 自社装置TRL/BRL形成は7軸で説明可能。 | 自社装置R&Dが継続していたsource候補。後続の投資削減/終結ログと突合する。 |
| project_knowledge `e081aad2-44df-4e91-b90f-ae674868b0da` | active | `bridge_business_candidate` / `damage_guard_candidate` | 愛知県で取引先限定の装置見学会を実施予定。メディアは呼ばず、装置を見てもらう形式。 | `review-only` | 見学会を商談・販売・入金実績にしない。 | 顧客接点/BRLは7軸で説明可能。 | 装置販売前夜のsourceだが、正のR_netではなく本命R&D再投資/毀損確認の入口。 |
| project_knowledge `8be06f88-e5e0-4388-9151-1114cc6a0d5a` | active | `reinvestment_unverified` | 装置量産計画。JOYCLEが来年以降に予定している装置量産化、資金調達と生産パートナー選定を並行して進める方針。 | `review-only` | 量産計画を販売実績・粗利・本命再投資と同一視しない。 | 量産BRL/FRL計画は7軸で説明可能。 | 量産資金が本命流動層R&Dへ戻るのか、量産/営業対応でR&Dを削るのかを分ける候補。 |
| project_knowledge `535e34ee-9fd0-40fd-a016-7c10c0282cfd` | active | `bridge_business_candidate` / `damage_guard_candidate` | JOYCLE BOXが法律事務所による意見書作成の対象となっている。 | `review-only` | 法務意見書を販売実績にしない。有償テスト/販売前のSRL/BRL補助に留める。 | SRL/BRLの進展は7軸で説明可能。 | 有償テスト・販売導線が本命R&Dに戻るか、現場対応で食うかの確認候補。 |
| project_knowledge `68f08938-eb14-4e18-b29c-5feb1f995078` | active | `bridge_business_candidate` / `operating_cost_source` | JOYCLEが保有する熱分解装置。4tエアサス車両での輸送が必要で、1機を輸送予定。 | `review-only` | 装置保有/輸送を売上実績にしない。輸送・導入コストを粗利から差し引く候補として別表示する。 | 装置実体/導入準備は7軸で説明可能。 | 導入/輸送コストがR_netを押し下げるsource候補。 |
| project_knowledge `994f6740-c1bc-4b65-bbf4-91072133eef3` | active | `future_or_draft_plan` / `reinvestment_unverified` | 来年以降に装置量産に向けた資金調達と装置生産パートナー選定を計画。 | `review-only` | future計画を実績にしない。 | BRL/FRL計画は7軸で説明可能。 | 資金調達が本命R&Dへ戻るか、量産偏重でR&Dを食うかの確認対象。 |
| project_knowledge `f12a6503-33c3-4227-bcef-bcbccd69f773` | active | `resource_distraction_source` / `reinvestment_unverified` | 野田先生は群馬大学関係者で、現時点で学生を出せない状況。 | `review-only` | 学生不在を本命毀損確定にしない。研究リソース制約として扱う。 | 大学連携・HRL/TRL補助は7軸で説明可能。 | 本命流動層R&Dの人的リソース不足候補。 |
| `billing_cycles` p09 rows (`c504...` through `f670...`) | mixed / AMD billing | `exclude_as_damage_or_reinvestment` | p09 202512-202702のAMD billing rows。202512/202601はpayment_confirmed_atあり、以降はnot_started中心。 | `exclude from PRS` | AMD請求・入金確認をSU本体粗利、damage、reinvestmentにしない。 | AMD業務請求/cash timingであり、7軸/PRS本体根拠ではない。 | 使うならAMD関与期間やcash timingの補助のみ。 |

### 2.2 p03 ティエムファクトリ

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/tiem.md` | scenario / retrospective | `scenario_damage_guard` / `reinvestment_unverified` | 「商社+開発受託+ムーンショット」が本来の答えだったという2026時点の総括。Cabot代理店、エアロゲル商社、開発受託で食いつなぎながらモノリス長期R&Dを継続する仮説。 | `review-only` | 反実仮想を実績粗利・実績再投資にしない。本命透明モノリスPと商社粗利を足さない。 | 設立時TRL=0/自社内製TRL不足、早すぎた判断は7軸で説明可能。 | 本命R&Dを支えるreinvestment設計が欠けていた、という反省をPRS比較層で扱える。 |
| `/Users/masa/projects/knowledge/before_zero_theory.md` 自走性モデル章 | scenario / theory note | `scenario_damage_guard` | R_netは粗利から運営コストと本命から奪うリソース毀損を引く、と整理。SR自動車断熱のように本命を共食いする悪いライスワークはR_netが負にもなる、と記載。 | `review-only` | 旧理論メモを正式rubricとして採用しない。JOYCLE/p03/p20/p21のsource pack後にBZM司令塔が判断する。 | 7軸とは別のcomparison layerであることを明示できる。 | 商社/受託が本命を支えるか、逆に逸らすかのdamage/reinvestment分類を支える理論候補。 |
| p03 DB/L2 source | not currently available in current pack | `scenario_damage_guard` | 既存L2 inventoryではp03の実DB L2は薄く、knowledge md / before_zero_theory中心。 | `exclude from PRS` | DB/L2が薄いことを、売上ゼロ確定やscenario正当化に使わない。 | 7軸retrofitは既存BZM章で説明済み。 | 次researchで当時資料、契約額、粗利、在庫/営業/与信コスト、資金使途の確認が必要。 |

### 2.3 p20 CryoX

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/cx.md` | confirmed knowledge | `reinvestment_candidate` / `resource_distraction_source` | 初期戦略はTES自社生産 x 冷却機パッケージでアカデミア市場向けテスト販売から開始し、利益度外視で事例・評価データ獲得を優先。NIMS内製造はCAPEX軽・利益薄、外部拠点はCAPEX重・スケール可。月500-600万円程度のburn仮置き。 | `review-only` | テスト販売/評価データを粗利にしない。NIMS内製/外部拠点のCAPEXと本命市場Pを足し算しない。 | NIMS研究、技術、CEO候補、特許、実施許諾、BRL/HRL/FRLは7軸で説明可能。 | テスト販売が本命冷却機市場への評価データ/再投資になるか、個別対応でR&D人員を食うかを分けられる。 |
| meeting summary `slack-C092CF84CJV-1777271916_647919` | confirmed/candidate | `reinvestment_candidate` / `resource_distraction_source` | CryoX線材とMgB2比較、露光関係スライド、コスト整理シート、調達額シミュレーション、MRI応用資料。 | `review-only` | コスト整理の存在を正式粗利値にしない。販売単価・原価・CAPEX・人員負担が必要。 | 技術比較・用途整理・顧客評価補助は7軸で説明可能。 | テスト販売/有料製作が本命市場への評価データか、個別資料対応で本命を食うかのsource候補。 |
| strategy signal `91bf2e92-2383-4563-abc3-d0e812e5916e` | candidate | `resource_distraction_source` | 資金調達額シミュレーション、販売原価・CAPEXの金額感すり合わせ。 | `review-only` | 金額感を正式R_net値にしない。 | FRL/BRL準備として7軸で説明可能。 | bridge/テスト販売が固定費やCAPEXを食う可能性を観測できる。 |
| CX利益度外視テスト販売/有料製作候補 | candidate/mixed | `reinvestment_unverified` / `resource_distraction_source` | TES/ADR/冷却機のアカデミア向けテスト販売・有料製作候補。評価データ優先。 | `review-only` | 評価データ獲得を粗利として二重カウントしない。 | TRL/BRL/SRL上昇は7軸で説明可能。 | 本命冷却機R&Dに戻る評価データか、受託/個別対応で人手を奪うdamageかを分ける。 |
| meeting summary `5hv3utbm3cn8vlkk4p3th3pios` / signals `aad6...`, `9b080...` | confirmed/candidate | `exclude_as_damage_or_reinvestment` / `research_contract_cash` | NIMS税込100万円未満契約、仕様書/見積、6月現場活動開始。 | `review-only` | NIMS研究契約cashをSU本体売上・本命再投資・damageにしない。本命冷却機市場Pと分ける。 | NIMS連携・研究体制は7軸で説明可能。 | 使うならvalidation access / cash timing補助。damage/reinvestment本体にはしない。 |

### 2.4 p21 SolvioraX

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/sx.md` U1-U5 / ダイキ整理 | confirmed knowledge | `reinvestment_candidate` / `resource_distraction_source` | U1メッキ・化学排水はキャッシュ層。U4深海レアアース、U5金属鉱山プロセス置換は長期アップサイド。ダイキはU1-U3のキャッシュ層と一部周辺レイヤに限定したパートナー候補で、U4/U5上位レイヤには関与必然性なし。 | `review-only` | U1短期cashとU4/U5本命Pを混ぜない。ダイキ調整を本命reinvestmentと自動判定しない。 | ユースケース整理、PSI Step2、オンサイトPoC、TRL/BRL/HRLは7軸で説明可能。 | U1 PoCがU4/U5本命へ橋渡しするか、周辺レイヤ/個別PoCで本命を食うかを分けられる。 |
| xrl evidence `3fc6e490-9f4d-4d73-ac0b-a306ffb97edf` | candidate | `reinvestment_unverified` / `resource_distraction_source` | Fine-Chem面談、回収ルート、金属廃液サンプル、10件PoC、来年3月までの売上実績づくり。 | `review-only` | 10件PoCを実績売上・粗利にしない。U1短期cashとU4/U5本命Pを分ける。 | 顧客検証・PoC先候補は7軸で説明可能。 | PoCが本命技術・知財・規制対応へ効くか、個別PoC消化で本命を毀損するかを判断する候補。 |
| meeting summary `77836j7np0dovhcns78av79qdq` | confirmed/candidate | `reinvestment_unverified` / `unit_economics_margin_source` | 処理単価485円/Lでは利益率が低く、追加収益源が必要。 | `usable source` | 485円/Lを正式R_net値にしない。U1短期cash層のUE sourceに留め、U4/U5本命Pへ二重カウントしない。 | 価格受容/BRL補助は7軸で説明可能。 | U1 cash層が本命へ再投資できるほど強いか、追加収益源なしでは薄いかを示す候補。 |
| meeting summary `6ujslfj6rjb6htj00hgp5q2srt` | confirmed/candidate | `reinvestment_unverified` | 従量課金モデル中心に展開する方針。重金属回収・色素分解を優先技術とする。 | `review-only` | 価格体系候補を粗利実績にしない。 | 用途/顧客/BRLは7軸で説明可能。 | U1短期cash層の価格モデルが本命へ戻るかを検証する候補。 |
| Fine-Chem/オンサイトPoC/評価データ系候補 | candidate/mixed | `resource_distraction_source` / `validation_value_source` | オンサイトPoC、顧客サンプル、評価データ獲得の候補。 | `review-only` | 利益度外視PoC/評価データをR_net粗利にしない。 | TRL/BRL/SRLは7軸で説明可能。 | 評価データが本命へ戻るか、個別対応で本命開発を食うかを分ける。 |
| monthly report `p21_202605` / meeting summaries `4qq...`, `43nv...` | draft/confirmed-candidate | `exclude_as_damage_or_reinvestment` / `research_contract_cash` | 愛媛大学契約・発注確定、見積/仕様書、PSII予算1500万円・支払予定。 | `review-only` | 愛媛大学/PSII契約cashをU1 PoC売上やU4/U5本命Pへ混ぜない。 | 研究機関連携・設立準備・FRL補助は7軸で説明可能。 | cash timing補助にはなるが、damage/reinvestment本体にはしない。 |

### 2.5 p07 LiSTie

| source id or path | source status | classification | evidence summary | PRSで使うなら | double_count_guard | 7軸で説明できる部分 | PRSで追加説明できる部分 |
|---|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/LST.md` | confirmed knowledge | `reinvestment_candidate` / `resource_distraction_source` | 現状はリチウムリサイクル先行から2030年以降に本命LISMICユニット装置販売へ展開する事業計画。2026-03-18にJV案を一旦取り下げ、リチウムリサイクル先行 + 本命装置販売へ再設計。年4.2-12億円規模の先行売上試算。 | `review-only` | リサイクル試算を実績売上・粗利にしない。本命LISMIC装置Pとリサイクル商流を足さない。 | 資源安保、TRL/BRL/FRL/GRL/SRLの上昇は7軸で説明可能。 | リサイクル先行が本命LISMICへ再投資されるか、商流対応で本命開発を食うかを分けられる。 |
| xrl evidence `0aa71b29-915c-43d8-86ee-060d87217f09` | candidate | `reinvestment_unverified` | リサイクラー3社NDA、MOU獲得方針、装置メーカー連携、ブラックマス調達先協議。 | `review-only` | NDA/MOU方針を受注・入金実績にしない。 | 事業化接点・BRL/SRLは7軸で説明可能。 | 商流入口が本命LISMIC販売に戻るか、短期商流に経営注意を奪うかを検証する候補。 |
| project_knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | active | `reinvestment_unverified` | ブラックマス買取、マンガン系・LFP系リサイクルリチウム販売先候補。 | `review-only` | 顧客/販売先候補を売上実績にしない。単価、原価、契約、入金条件が必要。 | 顧客候補・商流形成は7軸で説明可能。 | 別系統商流が本命装置販売前の再投資原資になるかを見る候補。 |
| project_knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` | active | `resource_distraction_source` | 数千tレベルがミニマムで、初期R&D費用回収が難しい可能性。 | `usable source` | 売上候補と相殺せず、R_net押し下げsourceとして別表示する。 | スケールreadiness不足は7軸でも説明可能。 | リサイクル先行の運営コストが本命再投資を薄める可能性を示せる。 |
| project_knowledge `cd5e86d0-ec74-45aa-9a15-d4237e974610` | active | `resource_distraction_source` | 柏市物件、2,727平米、初期費用5,000万円程度見込み。 | `usable source` | 見込みCAPEXを実支出・粗利値にしない。 | FRL/BRL/拠点準備として7軸で説明可能。 | bridge businessがcashを生む前に固定費を増やすリスクを見られる。 |
| xrl evidence `fb0bd2de-2c62-42bb-ae0f-020b620129cf` | candidate | `resource_distraction_source` | 膜寿命、間欠電圧印加、QC協力の加速試験、前処理コスト課題。 | `review-only` | 技術/前処理コスト課題を粗利率そのものとして扱わない。 | 技術課題/TRL/SRLは7軸で説明可能。 | リサイクル商流の粗利を押し下げ、本命再投資を薄めるコストsource候補。 |
| xrl evidence `ba404315-ee28-4f44-9156-9a2165103982` / `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | candidate | `exclude_as_damage_or_reinvestment` | Startup Global最大2億円、融資/投資。 | `exclude from PRS` | 助成・融資・投資を売上粗利・reinvestmentにしない。 | FRL/runway補助は7軸で説明可能。 | Survival/cash runway補助であり、damage/reinvestment本体にはしない。 |

## 3. 二重カウント防止ルール

1. JB-02/JB-02A、JOYCLE BOX、有償テスト、装置見学会は、販売実績でも正のR_netでもない。契約、請求、入金、原価、導入/保守、本命R&D影響が揃うまで `review-only`。
2. `billing_cycles` はAMD billing。SU本体売上、damage、reinvestmentへ転記しない。
3. NIMS、愛媛大学、PSII、SIPなどの研究機関契約cashは `research_contract_cash` として分離する。
4. 助成金、補助金、政策資金、融資、投資は R_net粗利や本命再投資に加算しない。Survival/cash runway補助へ置く。
5. p03の商社/受託はscenario。実績欄に入れない。
6. p20/p21/p07のbridge/validation sourceは、同じsourceを `reinvestment_candidate` と `resource_distraction_source` の両方で見てもよいが、主分類と補助分類を分け、正式値にしない。
7. 7軸で説明できるTRL/BRL/HRL/FRL/SRLの進展を、PRS独自の成果として二重計上しない。PRS差分は「cash/評価データが本命へ戻るか、食うか」に限定する。

## 4. 司令塔判断事項

1. JOYCLE型は、正式用語として `negative R_net` を採らず、当面 `damage guard` / `本命毀損候補` と呼ぶ運用でよいか。
2. p09のAMD関与終結は、knowledge `jc.md` では2026-03終結、DB `project_ventures.amd_support_ended_at` はNULL。どちらをcurrent truthとしてDB/docsへ戻すか。
3. JOYCLEのJB-02/JB-02A sourceは、契約/請求/入金/原価/本命R&D影響が揃うまで `review-only` で固定してよいか。
4. p03の商社/受託scenarioは、BZM本文では反省・仮説として使い、evidence card実績欄からは除外する運用でよいか。
5. p20/p21の利益度外視PoC/テスト販売は、粗利ではなく `validation_value_source` を主分類にし、damage/reinvestmentは補助分類に留めてよいか。
6. p07リサイクル先行は、契約/請求/入金/原価/本命LISMIC影響の5点が揃うまで `reinvestment_unverified` として扱ってよいか。

## 5. 次アクション

1. BZM司令塔が本packをレビューし、p09 source候補のうち、evidence cards v3へ戻すものを選ぶ。
2. p09については、`jc.md` と `project_ventures` のAMD関与終結差分を別workerまたはOS側reviewへ渡す。
3. JOYCLEの追加source調査を切るなら、JB-02/JB-02Aの契約/請求/入金/原価/導入/保守と、野田先生技術・R&D予算・研究人員・AMD関与終結前後ログを分けて調べる。
4. p20/p21/p07は、bridge/validation packのsourceを、reinvestment側とresource distraction側に分けて evidence cards v3 に戻す。
5. 0-9値、DB列、正式rubric、過去score再計算は引き続き行わない。

## 6. 検証

- 指定された `AGENTS` / `CLAUDE` / `HANDOFF` / BZM runs / L2 design / schema / relevant spec/manual を read-only で確認した。
- Supabaseは read-only SELECT のみ実行した。
- p09について `project_ventures`, `project_knowledge`, `monthly_reports`, `source_cache`, `billing_cycles`, `protocols`, `project_strategy_signals` をread-onlyで確認した。
- DB write、DDL、migration、deploy、extractor実装、コード実装は行っていない。
- 0-9 score表、R_net値付け、正式rubric確定、現行7軸AMD Score置換、過去score再計算は行っていない。
- `billing_cycles` / research contract / grants / debt / equity をSU本体粗利やdamage/reinvestmentとして扱っていない。
- `negative R_net` は正式用語として採用していない。
- `git add .` は使っていない。

## 7. 未解決

- p09のAMD関与終結について、knowledgeとDB rowの差分が残る。
- p09はsource候補が多いが、販売実績・粗利・原価・入金・本命R&D影響が未接続。
- p03はscenario中心で、当時の契約額・粗利・在庫/営業/与信コスト・資金使途sourceが未確認。
- p20/p21/p07は、bridge/validation sourceとreinvestment/damageの境界をBZM司令塔が採用判断する必要がある。
