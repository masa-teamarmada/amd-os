# P/R_net billing vs SU revenue join map

作成日: 2026-06-02
作成者: BZM理論検証worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、PRS comparison layer の finance / cash source pack を受けて、`billing_cycles` の AMD billing と、SU本体の売上・粗利・PoC収益候補を混同しないための join map / ラベル運用案である。

- DB write、DDL、migration、extractor実装、deploy、0-9 score表作成、R_net値付け、正式rubric確定は行っていない。
- 現行7軸AMD Scoreの置換や過去score再計算は行っていない。
- `billing_cycles` は `amd_billing_or_research_contract` に分類し、SU本体売上・粗利として扱わない。
- 助成金、融資、投資、政策実証、共同研究資金は `survival_cash_or_grant` に分類し、R_net粗利へ加算しない。
- `candidate` / `draft` / `upcoming` / `unknown` は実績扱いしない。

確認したもの:

- `pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-02-prs-finance-cash-source-pack.md`
- `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-evidence-cards.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/design/db_schema.md`
- `pwa/design/L2_DATA.md`
- `pwa/spec/3-2-monthly-reports-current-spec.md`
- `pwa/spec/3-3-meeting-flow-current-spec.md`
- `pwa/manual/3-2-data-and-extraction.md`

## 1. 分類定義

| 分類 | 入れるもの | 入れないもの | PRS上の扱い |
|---|---|---|---|
| `su_revenue_candidate` | SU本体の売上、受注、販売、PoC収益、商流候補、粗利/UE検証候補 | AMDへの業務委託請求、大学/NIMS/PSI等の研究契約、助成金、融資、投資、実証採択 | `usable source` は契約/請求/入金/原価がSU本体に紐づく時だけ。多くは `review-only` |
| `amd_billing_or_research_contract` | `billing_cycles`、AMD発注/請求/入金、大学・NIMS・PSI等の研究機関契約、業務委託契約、SIP支払い/立替精算 | SU本体の販売粗利、補助金・投資そのもの | PRS粗利には `exclude from PRS`。cash timing / survival補助なら `review-only` |
| `survival_cash_or_grant` | 助成金、融資、投資、政策実証、共同研究資金、AMED/NEDO/SIP/Startup Global/PSI、runway確保 | 売上粗利、AMD請求額 | R_net粗利には `exclude from PRS`。Survival guard / lane guard には `usable source` または `review-only` |

## 2. Join map

| source family | join key | 何へjoinしてよいか | 禁止join | evidence card v2 label |
|---|---|---|---|---|
| `billing_cycles` | `project_id`, `ym`, `id` | AMD側の請求予定、invoice送付、入金確認、cash timing補助 | `su_revenue_candidate.gross_margin_yen` / `r_gross_margin` / SU本体PL | `amd_billing_row` |
| `project_pl_monthly` | `project_id`, `ym` | SU本体の売上・COGS・opexが実データとして存在する場合のPL候補 | `billing_cycles.budget_yen` で欠損補完 | `su_pl_row` |
| `monthly_reports` | `project_id`, `ym`, `report_id`, `status` | 売上/PoC/助成金/契約/コストの narrative source | draft/future月を実績、または `billing_cycles` の金額裏付けとして扱う | `monthly_report_source` |
| `project_meeting_summaries` | `project_id`, `ym`, `meeting_id`, `source_kinds` | 決定、見積依頼、契約進行、支払予定、コスト論点の source | `source_kinds='upcoming'` を開催済み実績扱い | `meeting_source` |
| `project_strategy_signals` / `project_xrl_evidence` | `project_id`, `signal_id` / evidence id | commercial / funding / policy / validation の候補source | candidate signalを確定売上・確定粗利扱い | `signal_or_xrl_source` |
| `source_cache` | `project_id`, `ym`, `source`, `item_id` | raw source ref / snippet / hash の traceability補助 | `source_cache` だけで no-data / 実績確定 / 金額確定 | `raw_source_ref` |

## 3. PJ別 candidate分類

### p20 CryoX

| 分類 | source id / path | source status | なぜその分類か | PRSで使うなら |
|---|---|---|---|---|
| `amd_billing_or_research_contract` | meeting summary `5hv3utbm3cn8vlkk4p3th3pios` | confirmed/candidate | NIMS新規契約を税込100万円未満で締結、現場活動開始という研究機関契約候補。SU本体の量産販売や粗利ではない。 | `review-only` |
| `amd_billing_or_research_contract` | strategy signal `aad6dc9e-240c-42ec-9f63-27bcea20a91d` | candidate | NIMS仕様書・見積依頼。見積依頼段階なのでSU売上実績ではない。 | `review-only` |
| `amd_billing_or_research_contract` | strategy signal `9b080419-4df5-4cd8-8578-cd78b8099c34` | candidate | NIMS契約・6月現場活動予定。契約/請求/入金/原価を確認するまでSU本体粗利にできない。 | `review-only` |
| `amd_billing_or_research_contract` | `billing_cycles` `e1c409f6-18d8-4729-8452-de208955e448` / `b15713d4-2175-41c1-8c6f-0091a0aa57f2` / `c98648e2-8d16-425c-b65e-a237cc1b6d79` | not_started | p20 202607-202609 の `budget_yen=188500` AMD billing rows。AMD請求予定でありSU本体売上ではない。 | `exclude from PRS` |
| `su_revenue_candidate` | meeting summary `slack-C092CF84CJV-1777271916_647919` | confirmed/candidate | 線材/MgB2比較、コスト整理、調達額シミュレーションの存在。SU本体の原価/UE検証候補だが数値は未確定。 | `review-only` |
| `su_revenue_candidate` | strategy signal `91bf2e92-2383-4563-abc3-d0e812e5916e` | candidate | 販売原価・CAPEXの金額感すり合わせ。粗利の入口だが正式値ではない。 | `review-only` |
| `survival_cash_or_grant` | meeting summary `5jj2i4e0so5f4valupne18ujha` | confirmed/candidate | VC/コンソーシアム/助成金活用方針。runwayやpolicy demoには効くが粗利ではない。 | `review-only` |
| `survival_cash_or_grant` | strategy signal `c80306a5-b71a-4089-9430-892127f5fff1` | candidate | 大手企業コンソーシアムモデルへの転換候補。資金調達/政策連携でありSU販売粗利ではない。 | `review-only` |

### p21 SolvioraX

| 分類 | source id / path | source status | なぜその分類か | PRSで使うなら |
|---|---|---|---|---|
| `amd_billing_or_research_contract` | monthly report `p21_202605` | draft | 愛媛大学契約・発注確定が出ているが、設立準備中で、AMD業務/大学契約とSU本体売上の分離が必要。 | `review-only` |
| `amd_billing_or_research_contract` | meeting summary `4qqkgiatvd0p2sm4mspqr8k920_20260331T070000Z` | confirmed/candidate | 愛媛大学への納品、2026年度契約の見積書・仕様書提出。大学契約cash timing候補でありSU粗利ではない。 | `review-only` |
| `amd_billing_or_research_contract` | meeting summary `43nvst4qu8ppdclf0heqd614u1` | confirmed/candidate | PSII予算1500万円、見積調整、支払予定。大学/研究予算の契約・入金候補でありSU本体売上とは分ける。 | `review-only` |
| `su_revenue_candidate` | xrl evidence `3fc6e490-9f4d-4d73-ac0b-a306ffb97edf` | candidate | Fine-Chem面談、10件PoC、来年3月までの売上実績づくり。PoC収益候補だが実績ではない。 | `review-only` |
| `su_revenue_candidate` | meeting summary `77836j7np0dovhcns78av79qdq` | confirmed/candidate | 処理単価485円/Lでは利益率が低い、というUE/粗利検証候補。R_netに戻せる可能性はあるが出典・計算確認が必要。 | `usable source` |
| `su_revenue_candidate` | meeting summary `6ujslfj6rjb6htj00hgp5q2srt` | confirmed/candidate | 従量課金モデル方針。価格体系候補で、コスト・粗利・入金条件とのjoinが必要。 | `review-only` |
| `survival_cash_or_grant` | xrl evidence `1388d1cc-8e18-4cb0-8561-b3ce9f3533d5` | confirmed | 国プロ接続候補。政策/共同研究のSurvival evidenceであり粗利ではない。 | `usable source` |
| `survival_cash_or_grant` | monthly report `MR_p21_202604` | draft | PSI Step2 Year1完了、資金調達・会社設立・PoC開拓。PSIはrunway / policy guardで、粗利加算禁止。 | `review-only` |

### p11 BWE

| 分類 | source id / path | source status | なぜその分類か | PRSで使うなら |
|---|---|---|---|---|
| `amd_billing_or_research_contract` | source_cache `p11_gmeet_minutes_198e5a68b13c43ea` | unknown | SIP収入と経理管理の運用。共同研究/政策資金のcash sourceでありSU粗利ではない。 | `review-only` |
| `amd_billing_or_research_contract` | source_cache `p11_gmeet_minutes_1990d8b496887caa` | unknown | SIP支払い状況、立替経費精算、遅延損害金、BWE請求金額調整。cash conversion / reimbursement source。 | `review-only` |
| `amd_billing_or_research_contract` | `billing_cycles` `720566d5-64c3-4172-a00d-3f519e53da2b` ほか p11 future rows | not_started / invoice_sent mixed | p11 future AMD billing rows。一部invoice送付があってもAMD請求でありSU本体売上・粗利ではない。 | `exclude from PRS` |
| `su_revenue_candidate` | `2026-06-01-prs-l2-source-inventory.md` / BWE GP30%メモ | candidate | 膜外販のGP30%候補。元row、単価、原価、供給余力、本命RED影響が揃うまで未確定R_net。 | `review-only` |
| `su_revenue_candidate` | monthly report `p11_202612` | draft | 住友理工条件交渉、10kW PoC、シード準備。future draftで実績扱い禁止。 | `review-only` |
| `survival_cash_or_grant` | source_cache `p11_gmail_1987e26bfa8c4a6f` | unknown | SIP C(1) 三者共同研究契約書案。政策実証/共同研究evidence。 | `usable source` |
| `survival_cash_or_grant` | monthly report `p11_202611` / `p11_202612` | draft | SIP最終報告、行政対応、PoC、政策実証。Survival/7軸補助であり粗利ではない。 | `review-only` |
| `survival_cash_or_grant` | source_cache `p11_slack_1745979366_346149` | unknown | KKMTGメモ、試運転、山大契約、SPD訪問など実証運営予定。売上実績ではない。 | `review-only` |

### p06 CrestecBio

| 分類 | source id / path | source status | なぜその分類か | PRSで使うなら |
|---|---|---|---|---|
| `amd_billing_or_research_contract` | strategy signal `20f2c8b9-563a-4504-9a8f-65b9f302c647` | candidate/decided | 5月以降のAMD発注保留。AMDへの発注/業務委託の停止でありSU本体売上ではない。 | `exclude from PRS` |
| `amd_billing_or_research_contract` | xrl evidence `ea743ad7-db44-48ae-a318-07b771746be7` | candidate | 原薬異物混入とcash impactによりARMADA発注保留。cash stress sourceであり粗利ではない。 | `review-only` |
| `survival_cash_or_grant` | project_knowledge `f91e59f3-b497-4a98-924d-a4d5cfd2ea09` | active | AMED研究資金の出資元。外注はバイアウト契約かつ営利業務を含まない制約。粗利加算禁止の根拠。 | `usable source` |
| `survival_cash_or_grant` | project_knowledge `4a6d077e-d5d0-488f-8e64-9303de2c9017` | active | AMED外注可能契約形態。研究開発に注力し、営利業務を含まない。 | `usable source` |
| `survival_cash_or_grant` | monthly report `MR_p06_202604` | draft | AMED収支簿・証憑・人件費精査。admin burden / runway管理source。 | `usable source` |
| `survival_cash_or_grant` | monthly report `MR_p06_202603` | draft | freeeから銀行入出金履歴export運用。cash evidence候補だが売上粗利ではない。 | `review-only` |
| `survival_cash_or_grant` | project_knowledge `cf91eafa-949d-46db-89fe-2ff8c28804a8` | active | freee収支整合性、決済済/未決済の確認方針。入金確認source候補。 | `review-only` |
| `survival_cash_or_grant` | monthly report `MR_p06_202602` | draft | AMED助成事業の収支管理体制。runway/admin source。 | `usable source` |
| `survival_cash_or_grant` | xrl evidence `6253bafa-b797-4926-aaa0-2c3de1a1dbcf` | candidate | Go-Tech / NEDO DTSU grant path検討。採択ではない。 | `review-only` |
| `survival_cash_or_grant` | project_knowledge `04a9284c-8936-4923-8813-4af97e5cd9fe` | active | 大型補助金候補。資金調達戦略として並行中。 | `review-only` |

### p07 LiSTie

| 分類 | source id / path | source status | なぜその分類か | PRSで使うなら |
|---|---|---|---|---|
| `su_revenue_candidate` | xrl evidence `0aa71b29-915c-43d8-86ee-060d87217f09` | candidate | リサイクラー3社NDA、MOU獲得方針、装置メーカー連携、ブラックマス調達先協議。販売/商流候補だが受注・入金実績ではない。 | `review-only` |
| `su_revenue_candidate` | project_knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | active | ブラックマス買取とリサイクルリチウム販売先候補。顧客/商流候補。 | `review-only` |
| `su_revenue_candidate` | xrl evidence `fb0bd2de-2c62-42bb-ae0f-020b620129cf` | candidate | 膜寿命、前処理コスト、代替技術検討。粗利率ではなくコスト課題source。 | `review-only` |
| `su_revenue_candidate` | project_knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` | active | 初期R&D費用回収が難しい可能性。R_netを押し下げる運営コストsource。 | `usable source` |
| `su_revenue_candidate` | project_knowledge `cd5e86d0-ec74-45aa-9a15-d4237e974610` | active | 柏市物件、初期費用5,000万円見込み。CAPEX/fixed cost候補。 | `usable source` |
| `survival_cash_or_grant` | xrl evidence `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | candidate | 日本政策金融公庫8,000万円融資、DG Daiwa Ventures 1億円投資委員会。融資/投資であり粗利ではない。 | `usable source` |
| `survival_cash_or_grant` | xrl evidence `ba404315-ee28-4f44-9156-9a2165103982` | candidate | Startup Global最大2億円の契約締結/KPI。外部資金であり売上粗利ではない。 | `usable source` |
| `survival_cash_or_grant` | xrl evidence `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | candidate | TYK向けベンチ実証機設置・試運転。政策/実証進捗で、売上粗利に直結させない。 | `review-only` |

## 4. Evidence card v2 ラベル案

| label | 意味 | evidence card v2での使い方 |
|---|---|---|
| `su_revenue_candidate` | SU本体の販売/受注/PoC収益/商流/粗利/UE候補 | R_net欄に置けるが、`revenue_stage` と `margin_basis` を必ず添える |
| `su_revenue_confirmed` | SU本体の契約・請求・入金・原価が揃ったもの | 今回は該当なし。将来、`project_pl_monthly` 等で確認できた時だけ使う |
| `amd_billing_row` | AMDへの業務委託請求・invoice・payment確認 | R_net粗利には入れず、cash timing補助欄に置く |
| `research_contract_cash` | 大学/NIMS/PSI等の研究機関契約・共同研究・業務委託 | SU売上と分け、AMD/研究契約cashとしてレビューする |
| `grant_or_policy_cash` | AMED/NEDO/SIP/Startup Global/PSI/政策実証等 | Survival guard / lane guard欄に置く |
| `debt_or_equity_cash` | 融資・投資 | runway欄に置き、粗利には入れない |
| `validation_value_source` | 利益度外視PoC/テスト販売/評価データ獲得 | BRL/SRL/Survival補助に置き、粗利化はBZM判断待ち |
| `future_or_draft_plan` | future draft / candidate / upcoming | 実績扱い禁止。観測予定またはhypothesisとして置く |

## 5. 二重カウント防止ルール

1. 同一 `source id` は、主分類を1つだけ持つ。補助分類へ置く場合は `secondary_label` として明示する。
2. `billing_cycles.budget_yen` / `budget_reported_amount` / `invoice_sent_at` / `payment_confirmed_at` は、AMD請求・入金確認であり、SU本体PLの `revenue_yen` へ転記しない。
3. `project_pl_monthly` の `revenue_yen - cogs_yen` が存在する場合でも、同じ月の `billing_cycles` を足さない。足す必要があるなら、AMD業務委託とSU本体売上を別行で表示する。
4. 助成金、政策資金、共同研究費、実証採択、融資、投資は `R_net gross margin` へ足さない。Survival guardのcash/runway欄へ置く。
5. `candidate` / `draft` / `upcoming` は `forecast` または `hypothesis`。`confirmed` / `active` / 入金確認済みsourceと同じ強さで扱わない。
6. PoCやテスト販売は、粗利目的か評価データ目的かを分ける。利益度外視なら `validation_value_source` とし、R_net粗利には置かない。
7. p21のU1短期キャッシュ層とU4/U5本命市場、p20のNIMS契約と本命冷却機市場、p07のリサイクル商流とLISMIC本命装置は、P/R_net上で別レーンとして表示する。

## 6. 司令塔判断事項

1. `research_contract_cash` を `amd_billing_or_research_contract` の下位ラベルとして採用し、p20 NIMS / p21 愛媛大学・PSII / p11 SIPをSU本体売上から恒久的に分離してよいか。
2. evidence card v2 では `PRSで使うなら` を `usable source` / `review-only` / `exclude from PRS` の3値で固定し、`billing_cycles` は原則 `exclude from PRS`、Survival補助だけ `review-only` にしてよいか。
3. p21の処理単価485円/Lと従量課金モデルは `su_revenue_candidate` としてR_net欄に置きつつ、U1短期cashとU4/U5本命Pの二重カウント防止ラベルを必須にしてよいか。

## 7. 次アクション

1. BZM司令塔がこの join map とラベル案をレビューする。
2. 差し戻しがなければ、evidence card v2 workerへ `classification` / `evidence_label` / `prs_use` / `source_status` / `double_count_guard` を渡す。
3. `pwa/bzm/runs/2026-06-01-prs-pr-rnet-evidence-cards.md` のv2では、各PJカードに `Finance/Cash source classification` 小節を追加し、SU売上候補、AMD/研究契約cash、Survival cashを分けて戻す。
4. DB列追加、extractor実装、0-9 score、正式rubric、過去score再計算は引き続き行わない。

## 8. 検証

- 指定docs / schema / source pack / evidence cards / guard memo をread-onlyで確認した。
- `pwa/design/db_schema.md` で `billing_cycles`, `monthly_reports`, `project_meeting_summaries`, `project_pl_monthly`, `source_cache` の実列を確認した。
- DB write、DDL、migration、deploy、extractor実装は行っていない。
- 0-9 score表、R_net値付け、正式rubric確定は行っていない。
- `billing_cycles` をSU本体売上・粗利として扱わない判断を明示した。
