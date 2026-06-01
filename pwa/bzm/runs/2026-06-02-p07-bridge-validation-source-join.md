# p07 bridge validation source join

作成日: 2026-06-02
作成者: BZM司令塔配下worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、p07 LiSTie の bridge business candidate を、契約・請求・入金・原価・本命LISMIC影響の5点セットで source 単位に棚卸しする review-only 成果物である。

- 正式R_net値、0-9 score表、PRS正式採用、現行7軸置換、過去score再計算は行わない。
- DB write、DDL、migration、extractor実装、code実装、deployは行わない。
- p07 bridge business は、5点セットが揃うまで `bridge_business_candidate` / `review-only` のまま扱う。
- `available_now` は「review用sourceとして今読める」という意味であり、正式採用・値付け可能という意味ではない。
- `usable source` は「方向性・制約・guardとして evidence card へ戻せる」という意味であり、正式R_net値に使えるという意味ではない。

確認した主資料:

- `pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v4.md`
- `pwa/bzm/runs/2026-06-02-prs-classification-adoption-patch.md`
- `pwa/bzm/runs/2026-06-02-prs-bzm-judgement-brief.md`
- `pwa/bzm/runs/2026-06-02-prs-bridge-validation-source-pack.md`
- `pwa/bzm/runs/2026-06-02-prs-finance-cash-source-pack.md`
- `pwa/bzm/runs/2026-06-02-prs-billing-vs-su-revenue-join-map.md`
- `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md`
- `/Users/masa/projects/knowledge/LST.md`
- `pwa/design/db_schema.md`

## 1. 全体結論

| 判定 | 内容 |
|---|---|
| bridge candidate は複数ある | リサイクラー3社NDA/MOU方針、ブラックマス買取・販売先候補、TYK実証、年4.2-12億円規模のリサイクル先行計画、初期R&D費用回収難、柏市物件/初期費用5,000万円見込みが候補。 |
| 5点セットはまだ揃っていない | 契約はNDA/MOU方針や販売先候補止まり。請求・入金・SU本体PL・原価表・本命LISMIC影響は未接続。 |
| review-only解除は不可 | 受注/契約、請求、入金、原価、本命LISMIC影響のうち、現時点で実績として `available_now` と言えるものが不足している。 |
| cost source は強め | 初期R&D費用回収難、数千tミニマム、柏市物件/初期費用5,000万円見込みは、R_net押し下げ・固定費増の source として evidence cards v5 へ戻せる。 |
| Survival cash は分離 | Startup Global、融資、投資、NEDO/SBIR文脈は runway / Survival guard であり、リサイクル商流の売上粗利には混ぜない。 |

## 2. p07 bridge business candidate一覧

| candidate | source id / path | source status | classification | evidence summary | current PRS use |
|---|---|---|---|---|---|
| リサイクラーNDA/MOU・装置メーカー連携・ブラックマス調達協議 | xrl evidence `0aa71b29-915c-43d8-86ee-060d87217f09` | candidate | `bridge_business_candidate` / `su_revenue_candidate` | 5/27取締役会で、リサイクラー3社とのNDA、MOU獲得方針、装置メーカー連携、ブラックマス調達先協議が共有された。 | `review-only` |
| ブラックマス買取・リサイクルリチウム販売先候補 | project_knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | active | `bridge_business_candidate` / `commercial_pipeline_source` | マンガン系・LFP系ブラックマス買取とリサイクルリチウム販売先候補。 | `review-only` |
| TYK向けベンチ実証 | xrl evidence `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | candidate | `validation_value_source` | TYK向けベンチ実証機の設置・試運転段階。販売実績ではなく評価データ/BRL/SRL補助。 | `review-only` |
| 年4.2-12億円規模のリサイクル先行計画 | `/Users/masa/projects/knowledge/LST.md` | knowledge / internal roadmap | `bridge_business_candidate` / `future_or_draft_plan` | 年2,000t BMから水酸化リチウム210tで約4.2億円、TYK原料で年600t水酸化リチウムで12億円規模の試算。 | `review-only` |
| 初期R&D費用回収難・数千tミニマム | project_knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` | active | `bridge_business_cost_source` / `operating_cost_source` | 数千tレベルがミニマムで、初期にはR&D費用回収が難しい可能性。 | `usable source` |
| 柏市物件・初期費用5,000万円見込み | project_knowledge `cd5e86d0-ec74-45aa-9a15-d4237e974610` | active | `bridge_business_cost_source` / `capex_fixed_cost_source` | 柏市柏田中の2,727平米物件、建物1,000平米、初期費用5,000万円程度見込み。 | `usable source` |
| 前処理コスト・膜寿命・加速試験 | xrl evidence `fb0bd2de-2c62-42bb-ae0f-020b620129cf` | candidate | `bridge_business_cost_source` | 膜寿命、間欠的電圧印加、QC協力の加速試験、前処理コスト課題への代替技術検討。 | `review-only` |
| 融資・投資 runway | xrl evidence `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | candidate | `debt_or_equity_cash` | 日本政策金融公庫8,000万円融資、DG Daiwa Ventures 1億円投資委員会。 | `exclude from PRS gross margin`; runwayなら `usable source` |
| Startup Global / 政策資金 | xrl evidence `ba404315-ee28-4f44-9156-9a2165103982` | candidate | `survival_cash_or_grant` | Startup Global最大2億円の契約締結とKPI確定。 | `exclude from PRS gross margin`; Survivalなら `usable source` |

## 3. 5点セット別 source join表

### 3.1 contract

| source | source status分類 | join結果 | prs_use | blocked field |
|---|---|---|---|---|
| xrl evidence `0aa71b29-915c-43d8-86ee-060d87217f09` | `available_now` as candidate source | NDA/MOU方針・装置メーカー連携・ブラックマス調達先協議は確認できる。ただし契約締結・受注・数量・単価・検収条件は未確認。 | `review-only` | `contract_signed_at`, `contract_counterparty`, `contract_type`, `contract_value_yen`, `contract_volume_ton`, `price_basis`, `delivery_terms` |
| project_knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | `available_but_needs_join` | 買取/販売先候補は確認できるが、候補先と契約条件の join がない。 | `review-only` | `counterparty_status`, `signed_or_candidate`, `offtake_terms`, `procurement_terms` |
| `/Users/masa/projects/knowledge/LST.md` | `requires_masa_or_bzm_review` | 日夜科学/三菱金属、TYK 3社間スキーム等の販路計画があるが、L2 row id・契約書・受注管理への接続は未確認。 | `review-only` | `source_row_id`, `contract_evidence_ref`, `roadmap_vs_contract` |

contract joinの現在地: `NDA/MOU/候補/計画` はあるが、受注または契約締結済み source は未確認。review-only解除不可。

### 3.2 invoice

| source | source status分類 | join結果 | prs_use | blocked field |
|---|---|---|---|---|
| `billing_cycles` | `unsafe_to_infer` | p07のAMD業務委託請求が存在しても、SU本体のリサイクル商流請求ではない。bridge revenueへ転記禁止。 | `exclude from PRS` | `su_invoice_id`, `su_invoice_sent_at`, `su_invoice_amount_yen` |
| bridge candidate sources above | `not_currently_available` | リサイクル商流の請求書・請求予定・検収条件 source は既存pack上まだ見つかっていない。 | `exclude from PRS` until source exists | `invoice_counterparty`, `invoice_basis`, `invoice_due_date`, `invoice_status` |

invoice joinの現在地: SU本体請求は未確認。AMD billingや補助金契約を代替にしてはいけない。

### 3.3 payment

| source | source status分類 | join結果 | prs_use | blocked field |
|---|---|---|---|---|
| xrl evidence `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | `available_now` as runway source | 融資/投資のcash runway source。リサイクル商流の入金ではない。 | runwayなら `usable source`; R_net gross marginは `exclude from PRS` | `bridge_payment_confirmed_at`, `bridge_payment_amount_yen` |
| xrl evidence `ba404315-ee28-4f44-9156-9a2165103982` | `available_now` as Survival source | Startup Global契約/KPI source。補助金・政策資金であり売上入金ではない。後払い/自己負担/使途制限のjoinが必要。 | Survivalなら `usable source`; R_net gross marginは `exclude from PRS` | `grant_disbursement_schedule`, `reimbursement_lag_days`, `self_funding_required_yen` |
| bridge candidate sources above | `not_currently_available` | リサイクル商流の入金確認、入金サイト、検収後支払条件は未確認。 | `exclude from PRS` until source exists | `payment_confirmed_at`, `payment_terms`, `cash_conversion_lag_days`, `working_capital_gap_yen` |

payment joinの現在地: runway/助成金 source はあるが、bridge business の入金 source はない。補助金後払いを売上にしない。

### 3.4 cost / gross margin proxy

| source | source status分類 | join結果 | prs_use | blocked field |
|---|---|---|---|---|
| project_knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` | `available_now` | 数千tミニマム・初期R&D費用回収難は、R_net押し下げ方向の制約sourceとして使える。実原価・粗利率ではない。 | `usable source` as cost constraint | `minimum_scale_ton`, `fixed_cost_absorption`, `gross_margin_yen`, `gross_margin_pct` |
| project_knowledge `cd5e86d0-ec74-45aa-9a15-d4237e974610` | `available_now` | 柏市物件・初期費用5,000万円見込みは、CAPEX/fixed cost候補として使える。支払済み・契約済みではない。 | `usable source` as capex/fixed cost constraint | `capex_committed_yen`, `capex_paid_yen`, `lease_signed_at`, `monthly_fixed_cost_yen` |
| xrl evidence `fb0bd2de-2c62-42bb-ae0f-020b620129cf` | `available_but_needs_join` | 膜寿命・前処理コスト・加速試験は、原価を押し下げる/押し上げる技術課題source。粗利率そのものではない。 | `review-only` | `pretreatment_cost_yen_per_ton`, `membrane_life_hours`, `yield_rate`, `maintenance_cost_yen` |
| `/Users/masa/projects/knowledge/LST.md` | `requires_masa_or_bzm_review` | 年4.2-12億円規模の売上試算はあるが、COGS/外注/在庫/歩留まり/導入費とのjoinがない。 | `review-only` | `revenue_model_assumption`, `cogs_model_assumption`, `inventory_cost`, `external_processing_cost` |

cost / gross margin proxy joinの現在地: cost制約sourceは evidence cards v5 に戻せる。ただし gross margin proxy 止まりで、粗利値・R_net値にはできない。

### 3.5 main LISMIC impact

| source | source status分類 | join結果 | prs_use | blocked field |
|---|---|---|---|---|
| `/Users/masa/projects/knowledge/LST.md` | `available_but_needs_join` | リチウムリサイクル先行から2030年以降のLISMICユニット装置販売へ展開する計画は確認できる。bridgeが本命に接続する仮説source。 | `review-only` | `main_lismic_milestone_supported`, `reinvestment_path`, `roadmap_dependency` |
| project_knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` | `requires_masa_or_bzm_review` | 初期R&D費用回収難・数千tミニマムは、bridgeが本命を支える前に固定費/規模負担を増やす可能性を示す。 | `usable source` as risk direction, not value | `main_dev_delay_risk`, `resource_distraction_status`, `required_operating_team` |
| xrl evidence `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | `available_but_needs_join` | TYK実証は評価データ/BRL/SRLに効く可能性があるが、売上・粗利・本命装置販売への接続は未確認。 | `review-only` | `validation_data_obtained`, `conversion_to_lismic_sale`, `customer_validation_outcome` |
| xrl evidence `0aa71b29-915c-43d8-86ee-060d87217f09` | `requires_masa_or_bzm_review` | NDA/MOU/調達協議が本命LISMICの販路・原料・装置連携に効くか、短期商流対応で開発を遅らせるかは未判断。 | `review-only` | `resource_allocation_effect`, `lismic_dev_velocity_after_bridge`, `team_capacity_conflict` |

main LISMIC impact joinの現在地: bridgeが本命LISMICを支える可能性と毀損する可能性の両方がある。BZM/まさレビューなしに正のR_netへ上げない。

## 4. source status分類

| source / field | source status | 理由 |
|---|---|---|
| xrl `0aa71b29-915c-43d8-86ee-060d87217f09` | `available_now` for candidate existence / `available_but_needs_join` for contract | NDA/MOU方針・調達協議はsourceとしてあるが、契約締結・請求・入金・原価・本命影響へ未接続。 |
| project_knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | `available_but_needs_join` | 買取/販売先候補はあるが、契約条件・単価・入金・原価がない。 |
| project_knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` | `available_now` | 初期R&D費用回収難・数千tミニマムはcost/risk方向の制約sourceとして使える。 |
| project_knowledge `cd5e86d0-ec74-45aa-9a15-d4237e974610` | `available_now` | 初期費用5,000万円見込みはfixed cost/capex候補として使える。 |
| xrl `fb0bd2de-2c62-42bb-ae0f-020b620129cf` | `available_but_needs_join` | 技術/前処理コスト課題はあるが、原価表・粗利率には未接続。 |
| xrl `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | `available_but_needs_join` | TYK実証はvalidation sourceだが、売上/粗利/入金/本命販売接続がない。 |
| xrl `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | `unsafe_to_infer` for R_net / `available_now` for runway | 融資/投資はrunway source。粗利に混ぜると危険。 |
| xrl `ba404315-ee28-4f44-9156-9a2165103982` | `unsafe_to_infer` for R_net / `available_now` for Survival | Startup Globalは政策資金。後払い条件・使途制限が未接続で、売上粗利ではない。 |
| SU本体の請求・入金・PL | `not_currently_available` | 既存pack上、p07 bridge businessに紐づく請求書、入金確認、`project_pl_monthly` 等の直接PL sourceは見つかっていない。 |
| 本命LISMICへの再投資/毀損 | `requires_masa_or_bzm_review` | sourceだけでは本命支援かリソース毀損か決まらない。 |

## 5. PRS利用方針

| prs_use | 該当source | 使い方 |
|---|---|---|
| `usable source` | `5d5525f5-21d4-49e2-a7ee-5e8dba396de1`, `cd5e86d0-ec74-45aa-9a15-d4237e974610` | cost constraint / fixed cost / R_net押し下げ方向のsourceとして evidence cards v5 に戻せる。正式粗利値にはしない。 |
| `usable source` for Survival only | `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19`, `ba404315-ee28-4f44-9156-9a2165103982` | runway / grant / Survival guard に置く。R_net gross marginからは除外。 |
| `review-only` | `0aa71b29-915c-43d8-86ee-060d87217f09`, `04151001-a05c-489d-b961-a64ef6f49b1d`, `fb0bd2de-2c62-42bb-ae0f-020b620129cf`, `1a79aa9b-f67a-4bef-b057-d78cca940cb1`, `/Users/masa/projects/knowledge/LST.md` のroadmap | bridge candidate / validation value / commercial pipeline として残す。5点セットが揃うまでreview-only。 |
| `exclude from PRS` | `billing_cycles`, AMD billing, grant/debt/equity as gross margin, future/draft plan as actual | SU本体売上・粗利・入金・R_net値へ混ぜない。 |

## 6. double_count_guard

1. リサイクル商流の売上候補と本命LISMIC装置Pを足さない。P側ではLISMIC装置販売の上限、R_net側ではbridge商流の粗利/コスト/本命影響を別レーンで表示する。
2. NDA/MOU、販売先候補、装置メーカー連携、調達協議を受注・契約・請求・入金にしない。
3. Startup Global、NEDO/SBIR、融資、投資、政策実証、grant/debt/equityをR_net gross marginへ混ぜない。
4. 補助金後払いを売上にしない。後払い/自己負担/使途制限は Survival / cash conversion の負荷として見る。
5. TYK実証を販売実績にしない。評価データ/BRL/SRL補助として扱い、売上/粗利へは別sourceがある時だけjoinする。
6. 初期費用5,000万円見込みを支払済みCAPEXにしない。契約・支払・資金繰り反映が確認されるまで見込みsource。
7. 初期R&D費用回収難を「R_net低い確定値」にしない。制約sourceとして残し、粗利/原価/入金と別に表示する。
8. `billing_cycles` のAMD請求・入金確認をSU本体PLに転記しない。

## 7. evidence cards v5へ戻せるfield案

| field | value案 | source | source_status | prs_use |
|---|---|---|---|---|
| `bridge_business_classification` | `bridge_business_candidate` | xrl `0aa71b29-915c-43d8-86ee-060d87217f09`, knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | `available_but_needs_join` | `review-only` |
| `bridge_revenue_stage` | `nda_mou_or_pipeline_candidate` | xrl `0aa71b29-915c-43d8-86ee-060d87217f09` | `available_now` as candidate | `review-only` |
| `bridge_customer_or_counterparty_status` | `candidate_or_discussion_only` | knowledge `04151001-a05c-489d-b961-a64ef6f49b1d`, `/Users/masa/projects/knowledge/LST.md` | `available_but_needs_join` | `review-only` |
| `bridge_invoice_status` | `not_currently_available` | existing source packs | `not_currently_available` | `exclude from PRS` |
| `bridge_payment_status` | `not_currently_available` | existing source packs | `not_currently_available` | `exclude from PRS` |
| `bridge_cost_constraint_status` | `available_constraint_source_not_value` | knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1`, `cd5e86d0-ec74-45aa-9a15-d4237e974610` | `available_now` | `usable source` |
| `bridge_gross_margin_status` | `gross_margin_not_joined` | xrl `fb0bd2de-2c62-42bb-ae0f-020b620129cf` + missing原価表 | `available_but_needs_join` | `review-only` |
| `bridge_validation_value_status` | `validation_source_not_revenue` | xrl `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | `available_but_needs_join` | `review-only` |
| `main_lismic_impact_status` | `requires_masa_or_bzm_review` | roadmap + cost constraints | `requires_masa_or_bzm_review` | `review-only` |
| `survival_cash_separate_status` | `grant_debt_equity_excluded_from_rnet` | xrl `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19`, `ba404315-ee28-4f44-9156-9a2165103982` | `available_now` for runway/Survival | `exclude from PRS gross margin` |
| `double_count_guard` | `do_not_add_recycling_bridge_to_lismic_P; do_not_treat_NDA_MOU_as_order; do_not_mix_grant_debt_equity_into_gross_margin` | this join | - | guard |
| `review_only_release_condition` | `contract + invoice + payment + cost/gross_margin + main_lismic_impact joined by source` | classification adoption patch | - | gate |

## 8. still blocked fields / next source needed

| blocked field | needed source | owner / next path | why needed |
|---|---|---|---|
| `contract_signed_at` / `contract_value_yen` / `contract_volume_ton` | 契約書、受注管理、MOU本文、取引条件メモ | p07 source join follow-up / まさ or BZM review | NDA/MOU方針を契約に昇格できるか確認するため。 |
| `invoice_sent_at` / `invoice_amount_yen` | SU本体の請求書、請求予定表、検収条件 | finance/source worker | 売上候補を請求済み/請求予定に分けるため。AMD billingは代替不可。 |
| `payment_confirmed_at` / `payment_terms` | 銀行入金、freee、入金予定、契約支払サイト | finance/source worker | 入金確認ベースとforecastを分け、運転資金負荷を見るため。 |
| `cogs_yen` / `gross_margin_pct` / `pretreatment_cost_yen_per_ton` | 原価表、見積、外注費、在庫/原料費、膜寿命/歩留まりデータ | p07 finance/cost worker | リサイクル売上が会社生存に残る粗利か確認するため。 |
| `capex_committed_yen` / `fixed_cost_monthly_yen` | 柏市物件契約、支払予定、ラボ/人員費 | finance/source worker | 初期費用5,000万円見込みを実支出・固定費へ昇格するか判断するため。 |
| `grant_disbursement_schedule` / `self_funding_required_yen` | Startup Global/NEDO/SBIR等の交付条件、後払い条件 | Survival guard worker | 補助金を粗利にせず、cash conversion負荷として見るため。 |
| `reinvestment_path` | 資金使途、R&D予算、採用計画、経営会議ログ | まさ/BZM review | bridge収益が本命LISMICへ戻るかを確認するため。 |
| `resource_distraction_status` | 本命LISMIC開発ロードマップ、担当者稼働、商流対応工数 | まさ/BZM review | bridge対応が本命開発を遅らせるかを確認するため。 |
| `validation_to_sales_conversion` | TYK実証結果、顧客評価、次商談/契約接続 | p07 validation source worker | TYK実証を評価データに留めるか、販売pipelineへ昇格するか判断するため。 |

## 9. 司令塔判断事項

1. p07 bridge business は、今回のjoin結果では `review-only` 維持でよいか。
2. evidence cards v5 へ `bridge_revenue_stage=nda_mou_or_pipeline_candidate`、`bridge_invoice_status=not_currently_available`、`bridge_payment_status=not_currently_available` を明示的に戻してよいか。
3. `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` と `cd5e86d0-ec74-45aa-9a15-d4237e974610` は、R_net押し下げ方向の `usable source` として採用してよいか。ただし正式値ではない。
4. `/Users/masa/projects/knowledge/LST.md` の年4.2-12億円計画は、internal roadmap / review-only として置き、契約・請求・入金・原価 source が出るまで formal revenue から除外してよいか。
5. 次workerを切るなら、p07の契約/請求/入金/原価を live DB/freee/契約docs read-only で確認する finance/source worker と、本命LISMIC影響をまさ/BZM判断用に絞る review worker に分けるか。

## 10. 検証

- 指定されたAGENTS/CLAUDE/HANDOFF/BZM runsをread-onlyで確認した。
- L2 source inventory、observation items draft、`/Users/masa/projects/knowledge/LST.md`、`pwa/design/db_schema.md` をread-onlyで確認した。
- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸置換、過去score再計算は行っていない。
- p07 bridge businessを正式usable/high R_netへ昇格していない。
- `billing_cycles` / AMD billing / grant / debt / equityをSU本体売上/粗利として扱っていない。
- `git add .` は使っていない。
