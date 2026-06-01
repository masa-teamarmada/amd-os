# p20-p21 validation value source split

作成日: 2026-06-02
作成者: BZM司令塔配下worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、p20 CryoX / p21 SolvioraX の利益度外視PoC・テスト販売・有料製作・研究契約cashを、PRS comparison layer向けに source purpose 別へ分解するための read-only 成果物である。

- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸AMD Score置換、過去score再計算は行っていない。
- p20/p21の利益度外視PoC・テスト販売・有料製作は、標準分類として `validation_value_source` に置く。
- `validation_value_source` は、BRL/SRL/顧客信頼/将来販売への補助sourceであり、R_net粗利へ加算しない。
- p20 NIMS、p21 愛媛大学・PSII、p11 SIP型の研究機関契約cashは、`amd_billing_or_research_contract` の下位ラベル `research_contract_cash` とし、SU本体売上/粗利から分離する。
- p21の処理単価485円/L・従量課金モデルは `su_revenue_candidate` / UE sourceとして置けるが、正式R_net値ではない。U1短期cashとU4/U5本命Pの二重カウント防止ラベルを必須にする。
- `prs_use` は `usable source` / `review-only` / `exclude from PRS` の3値で固定する。

確認した主資料:

- `pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v5.md`
- `pwa/bzm/runs/2026-06-02-prs-classification-adoption-patch.md`
- `pwa/bzm/runs/2026-06-02-prs-bzm-judgement-brief.md`
- `pwa/bzm/runs/2026-06-02-prs-bridge-validation-source-pack.md`
- `pwa/bzm/runs/2026-06-02-prs-finance-cash-source-pack.md`
- `pwa/bzm/runs/2026-06-02-prs-billing-vs-su-revenue-join-map.md`
- `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `/Users/masa/projects/knowledge/cx.md`
- `/Users/masa/projects/knowledge/sx.md`

## 1. 標準分類案

| classification | 入れるもの | 入れないもの | evidence cards v6での扱い |
|---|---|---|---|
| `gross_margin_candidate` | SU本体の販売/PoC/テスト販売が、契約・請求・入金・原価・導入/O&M負荷までSU本体に紐づく候補 | AMD billing、大学/NIMS/PSII契約、補助金、政策資金、利益度外視PoC | 原則 `review-only`。5点セットが揃うまで正式R_net値にしない。 |
| `validation_value_source` | 利益度外視PoC、テスト販売、有料製作、評価データ獲得、顧客サンプル、オンサイト実証 | 売上/粗利実績、研究契約cash、助成金、AMD請求 | 標準分類として採用候補。BRL/SRL/顧客信頼/将来販売補助へ置く。R_net粗利には入れない。 |
| `research_contract_cash` | NIMS、愛媛大学、PSIIなど研究機関契約/見積/納品/支払予定 | SU本体販売粗利、PoC売上、助成金そのもの | `amd_billing_or_research_contract` の下位ラベル。PRS粗利から分離し、cash timing補助なら `review-only`。 |
| `survival_cash_or_grant` | 国プロ、PSI、助成金、コンソーシアム、政策接続、融資/投資 | SU本体販売粗利、研究契約cash | R_net粗利へ加算しない。Survival guard / lane guardに置く。 |
| `amd_billing_or_research_contract` | `billing_cycles`、AMD請求、業務委託、研究機関契約cash | SU本体PL、粗利 | 原則 `exclude from PRS`。cash timing補助だけ `review-only`。 |
| `future_or_draft_plan` | future draft月次、事業計画原案、価格体系候補、予定PoC、candidate signal | confirmed実績、入金確認済み実績 | hypothesis / next sourceとして残す。実績扱い禁止。 |

## 2. p20 CryoX source inventory by purpose

### 2.1 p20 split table

| source / item | source_status | purpose classification | evidence_label | prs_use | double_count_guard | evidence cards v6 field案 | still blocked fields |
|---|---|---|---|---|---|---|---|
| CX利益度外視テスト販売/有料製作候補 | candidate/mixed | `validation_value_source` | `validation_value_source` | `review-only` | 評価データ獲得をR_net粗利にしない。TES/ADR/冷却機のテスト販売を、本命冷却機市場PやNIMS契約cashと足さない。 | `p20_validation_value_status=standard_classification_review_only`; `p20_validation_value_purpose=evaluation_data/customer_trust/future_sales`; `p20_validation_not_rnet_gross_margin=true` | 単価、原価、粗利、請求/入金、顧客、評価データ取得有無、人員負荷。 |
| meeting summary `slack-C092CF84CJV-1777271916_647919` | confirmed/candidate | `gross_margin_candidate` + `validation_value_source` | `cost_structure_source` / `capex_margin_review_source` | `review-only` | 線材/MgB2比較、コスト整理、調達額シミュレーションを正式粗利値にしない。資料存在と値採用を分ける。 | `p20_cost_structure_source_status=available_but_needs_join`; `p20_margin_basis_status=not_formal_value` | コスト整理シート本体、販売単価、COGS、NIMS内製/外部拠点CAPEX差、実支出。 |
| strategy signal `91bf2e92-2383-4563-abc3-d0e812e5916e` | candidate | `gross_margin_candidate` | `capex_margin_review_source` | `review-only` | 資金調達額・販売原価・CAPEXの金額感をR_net値へ転記しない。 | `p20_capex_margin_review_status=review_only` | 数値前提、誰の試算か、採用版か、原価/粗利/入金とのjoin。 |
| meeting summary `5hv3utbm3cn8vlkk4p3th3pios` | confirmed/candidate | `research_contract_cash` | `nims_research_contract_cash` | `review-only` | NIMS税込100万円未満契約をSU本体売上・粗利にしない。本命冷却機市場Pと研究契約cashを足さない。 | `p20_research_contract_cash_status=review_only`; `p20_research_contract_counterparty=NIMS`; `p20_research_contract_not_su_revenue=true` | 契約主体、請求主体、請求/入金、原価、人員負荷、SU法人設立前後の扱い。 |
| strategy signal `aad6dc9e-240c-42ec-9f63-27bcea20a91d` | candidate | `research_contract_cash` | `nims_estimate_request_source` | `review-only` | 見積依頼を売上実績にしない。 | `p20_nims_estimate_status=estimate_request_only` | 見積書、契約締結、検収、入金、業務範囲。 |
| strategy signal `9b080419-4df5-4cd8-8578-cd78b8099c34` | candidate | `research_contract_cash` + `validation_value_source` | `nims_contract_field_access_source` | `review-only` | NIMS現場活動を研究アクセス/validation accessとして扱い、粗利や本命市場Pへ混ぜない。 | `p20_nims_field_access_status=validation_access_review_only` | 現場活動で取得する評価データ、契約cashとの対応、成果物、利用許諾。 |
| `billing_cycles` `e1c409f6-18d8-4729-8452-de208955e448` / `b15713d4-2175-41c1-8c6f-0091a0aa57f2` / `c98648e2-8d16-425c-b65e-a237cc1b6d79` | not_started | `amd_billing_or_research_contract` | `amd_billing_row` | `exclude from PRS` | AMD請求予定をSU本体PL、PoC売上、粗利に転記しない。 | `p20_amd_billing_status=exclude_from_prs`; `p20_amd_billing_cash_timing_only=true` | 実請求/入金確認はcash timing補助に留める。 |
| meeting summary `5jj2i4e0so5f4valupne18ujha` | confirmed/candidate | `survival_cash_or_grant` | `grant_or_policy_cash` | `review-only` | VC/コンソーシアム/助成金方針をR_net粗利に加算しない。 | `p20_survival_cash_status=policy_consortium_review_only` | 採択/契約/入金/自己負担/使途制限。 |
| strategy signal `c80306a5-b71a-4089-9430-892127f5fff1` | candidate | `survival_cash_or_grant` | `consortium_policy_source` | `review-only` | 大手企業コンソーシアムモデルを売上・粗利・契約済みcashとして扱わない。 | `p20_policy_consortium_status=candidate_review_only` | コンソーシアム構成、契約、資金供給条件、知財/販売権への影響。 |
| `/Users/masa/projects/knowledge/cx.md` の初期事業戦略・burn仮置き | knowledge/current memo | `future_or_draft_plan` + `validation_value_source` | `internal_strategy_source` | `review-only` | 利益度外視テスト販売、月500-600万円burn仮置き、NIMS内製/外部拠点論点を正式R_net値にしない。 | `p20_internal_strategy_status=review_only`; `p20_burn_assumption_status=not_value_adopted` | 最新版事業計画、予算表、誰が承認したか、実支出との一致。 |

### 2.2 p20 purpose別まとめ

| purpose | source | PRS扱い | v6へ戻す要点 |
|---|---|---|---|
| 利益度外視PoC / テスト販売 / 有料製作 | TES自社生産、ADR/冷却機、アカデミア向けテスト販売候補、コスト整理資料 | `validation_value_source` / `review-only` | p20の標準分類は `validation_value_source`。粗利目的へ昇格するには契約・請求・入金・原価・人員負荷・評価データの5+1点が必要。 |
| 粗利目的候補 | コスト整理、販売原価/CAPEXすり合わせ | `gross_margin_candidate` / `review-only` | 方向性sourceとして残すが、正式R_net値にしない。 |
| 研究契約cash | NIMS税込100万円未満契約、見積依頼、現場活動 | `research_contract_cash` / `review-only` | SU本体売上から恒久分離。cash timing / validation access補助。 |
| 国プロ/助成/コンソーシアム | VC再検討、政府系助成金、コンソーシアムモデル、大手企業コンソーシアム | `survival_cash_or_grant` / `review-only` | R_net粗利から除外。Survival guardへ置く。 |
| AMD billing | p20 202607-202609 `billing_cycles` | `amd_billing_or_research_contract` / `exclude from PRS` | PRS本体から除外。使うならcash timing補助のみ。 |
| future/draft/内部計画 | プレシード調達額、月500-600万円burn、NIMS内製/外部拠点論点 | `future_or_draft_plan` / `review-only` | 実績扱いせず、blocked fieldsのsource neededへ送る。 |

## 3. p21 SolvioraX source inventory by purpose

### 3.1 p21 split table

| source / item | source_status | purpose classification | evidence_label | prs_use | double_count_guard | evidence cards v6 field案 | still blocked fields |
|---|---|---|---|---|---|---|---|
| xrl evidence `3fc6e490-9f4d-4d73-ac0b-a306ffb97edf` | candidate | `gross_margin_candidate` + `validation_value_source` | `poc_revenue_candidate` / `fine_chem_validation_source` | `review-only` | Fine-Chem面談、金属廃液サンプル、10件PoC、売上実績づくりを実績売上/粗利にしない。U1短期cashとU4/U5本命Pを足さない。 | `p21_poc_revenue_candidate_status=review_only`; `p21_validation_value_status=standard_classification_review_only`; `p21_use_case_lane=U1_short_cash` | PoC契約、単価、原価、入金、サンプル評価結果、O&M/導入負荷、U4/U5への技術転用。 |
| meeting summary `77836j7np0dovhcns78av79qdq` | confirmed/candidate | `gross_margin_candidate` | `unit_economics_margin_source` | `usable source` | 485円/Lを正式R_net値にしない。U1短期cash層のUE制約sourceに留め、U4/U5本命Pへ二重カウントしない。 | `p21_ue_source_status=usable_source_not_formal_value`; `p21_price_per_liter_source=485_yen_per_liter`; `p21_u1_u4_u5_double_count_guard=true` | 計算前提、処理量、COGS、O&M、導入費、追加収益源、継続性、顧客支払意思。 |
| meeting summary `6ujslfj6rjb6htj00hgp5q2srt` | confirmed/candidate | `gross_margin_candidate` + `future_or_draft_plan` | `pricing_model_source` | `review-only` | 従量課金モデル方針を売上実績や正式粗利にしない。 | `p21_pricing_model_status=review_only`; `p21_pricing_model_type=usage_based_candidate` | 料金表、契約条件、変動費、固定費、支払サイト、用途別価格差。 |
| Fine-Chem / オンサイトPoC / 顧客サンプル候補 | candidate/mixed | `validation_value_source` | `onsite_poc_validation_source` | `review-only` | 利益度外視PoC/評価データをR_net粗利にしない。顧客評価と売上を分ける。 | `p21_onsite_poc_validation_status=review_only`; `p21_validation_not_rnet_gross_margin=true` | 取得データ、顧客評価、次契約接続、PoC負荷、コア開発/知財への影響。 |
| monthly report `p21_202605` | draft | `research_contract_cash` + `validation_value_source` | `ehime_contract_and_poc_source` | `review-only` | 愛媛大学契約・発注確定をSU本体売上にしない。Fine-Chem PoC具体化と研究契約cashを混ぜない。 | `p21_research_contract_cash_status=review_only`; `p21_research_contract_counterparty=Ehime University`; `p21_poc_source_secondary=true` | 契約主体、請求/入金、原価、SU法人との関係、PoC契約との切り分け。 |
| meeting summary `4qqkgiatvd0p2sm4mspqr8k920_20260331T070000Z` | confirmed/candidate | `research_contract_cash` | `ehime_delivery_estimate_source` | `review-only` | 愛媛大学への納品、見積書・仕様書提出をU1売上/粗利にしない。 | `p21_ehime_delivery_status=research_contract_cash_review_only` | 納品物、検収、請求書、入金、業務範囲。 |
| meeting summary `43nvst4qu8ppdclf0heqd614u1` | confirmed/candidate | `research_contract_cash` | `psii_research_contract_cash` | `review-only` | PSII予算1500万円・支払予定をU1 PoC売上やU4/U5本命Pへ混ぜない。 | `p21_psii_cash_status=research_contract_cash_review_only`; `p21_psii_budget_source=1500万_yen_candidate` | 契約主体、予算確定、支払実績、使途制限、SX本体PLとの関係。 |
| xrl evidence `1388d1cc-8e18-4cb0-8561-b3ce9f3533d5` | confirmed | `survival_cash_or_grant` | `national_project_connection_source` | `usable source` | 国プロ接続候補をR_net粗利にしない。U4/U5本命Pの政策/Survival補助に留める。 | `p21_national_project_source_status=usable_survival_source`; `p21_not_gross_margin=true` | 採択/契約/入金、自己負担、使途、事業化権利、U1との関係。 |
| monthly report `MR_p21_202604` | draft | `survival_cash_or_grant` + `future_or_draft_plan` | `psi_policy_cash_source` | `review-only` | PSI Step2を売上/粗利に加算しない。会社設立・PoC開拓フェーズ移行を実績売上扱いしない。 | `p21_psi_status=survival_cash_review_only`; `p21_company_setup_phase_status=draft_plan` | PSI支払条件、後払い/自己負担、会社設立後のPL接続、研究費とSU収益の切り分け。 |
| monthly report `p21_202607` ほか future draft series | draft/future | `future_or_draft_plan` | `future_plan_source` | `review-only` | 市場調査、コスト試算、月次試算表、事業計画原案を実績値にしない。 | `p21_future_plan_status=review_only_not_actual` | 採用済み事業計画、最新版、実績反映有無、原価/入金/契約とのjoin。 |
| `/Users/masa/projects/knowledge/sx.md` のU1-U5用途 / 事業戦略 / 愛媛大学契約メモ | knowledge/current memo | `future_or_draft_plan` + `validation_value_source` + `research_contract_cash` | `internal_strategy_and_lane_source` | `review-only` | U1短期cash、U4/U5本命P、愛媛大学契約、PSIを混ぜない。FY35計画や10年後売上を実績扱いしない。 | `p21_lane_split_status=required`; `p21_u1_short_cash_vs_u4_u5_main_p_guard=true` | 最新承認版計画、契約/請求/入金、用途別PL、顧客別PoC結果。 |

### 3.2 p21 purpose別まとめ

| purpose | source | PRS扱い | v6へ戻す要点 |
|---|---|---|---|
| 利益度外視PoC / オンサイトPoC / 評価データ | Fine-Chem面談、金属廃液サンプル、10件PoC、オンサイトPoC候補 | `validation_value_source` / `review-only` | p21 PoCは標準分類として `validation_value_source`。PoC売上候補と評価データ目的を主分類/secondaryで分ける。 |
| 粗利目的 / UE source | 485円/L、従量課金モデル、追加収益源必要性 | `gross_margin_candidate` / 485円/Lは `usable source`、従量課金は `review-only` | UE sourceとしては使えるが正式R_net値ではない。U1短期cashとU4/U5本命Pの二重カウント防止を必須fieldにする。 |
| 研究契約cash | 愛媛大学契約/納品/見積/仕様書、PSII予算1500万円 | `research_contract_cash` / `review-only` | SU本体売上から恒久分離。cash timing補助だが、U1 PoC売上や本命Pへ混ぜない。 |
| 国プロ / PSI / 政策資金 | PSI Step2、国プロ接続候補、閉鎖鉱山/南鳥島レアアース排水テーマ | `survival_cash_or_grant` / `usable source` or `review-only` | R_net粗利へ加算しない。U4/U5本命P・Survival guard・GRL/SRL補助へ置く。 |
| future/draft/内部計画 | p21 future draft series、事業計画原案、FY35売上/純利益率目標 | `future_or_draft_plan` / `review-only` | 実績扱い禁止。用途レーン別source neededへ渡す。 |

## 4. evidence cards v6へ戻すfield案

### 4.1 共通fields

| field | value案 | 用途 |
|---|---|---|
| `validation_value_source_standard` | `adopt_as_comparison_layer_classification` | p20/p21の利益度外視PoC/テスト販売/有料製作を標準分類へ戻す。 |
| `validation_value_not_rnet_gross_margin` | `true` | 評価データ目的をR_net粗利へ入れないguard。 |
| `research_contract_cash_parent_label` | `amd_billing_or_research_contract` | NIMS/愛媛大学/PSIIをSU本体売上から分離する。 |
| `prs_use_values` | `usable source / review-only / exclude from PRS` | v6でも3値固定。 |
| `required_release_condition_for_gross_margin` | `contract + invoice + payment + cost/gross_margin + core_project_impact` | validation/PoCを粗利候補へ上げる最低条件。 |
| `future_or_draft_not_actual` | `true` | draft/future/candidateを実績扱いしない。 |

### 4.2 p20 fields

| field | value案 |
|---|---|
| `p20_validation_value_status` | `standard_classification_review_only` |
| `p20_validation_value_sources` | `CX利益度外視テスト販売/有料製作候補; slack-C092CF84CJV-1777271916_647919 as cost/validation context` |
| `p20_research_contract_cash_status` | `review_only_separate_from_su_revenue` |
| `p20_research_contract_sources` | `5hv3utbm3cn8vlkk4p3th3pios; aad6dc9e-240c-42ec-9f63-27bcea20a91d; 9b080419-4df5-4cd8-8578-cd78b8099c34` |
| `p20_amd_billing_use` | `exclude_from_prs_cash_timing_only` |
| `p20_survival_cash_status` | `grant_consortium_policy_review_only` |
| `p20_gross_margin_release_condition` | `TES/ADR/cooling test-sale contract + invoice + payment + COGS/CAPEX + personnel burden + validation output` |

### 4.3 p21 fields

| field | value案 |
|---|---|
| `p21_validation_value_status` | `standard_classification_review_only` |
| `p21_validation_value_sources` | `3fc6e490-9f4d-4d73-ac0b-a306ffb97edf; Fine-Chem/onsite PoC candidates` |
| `p21_ue_source_status` | `usable_source_not_formal_rnet_value` |
| `p21_price_per_liter_source` | `485_yen_per_liter_candidate` |
| `p21_pricing_model_status` | `usage_based_model_review_only` |
| `p21_research_contract_cash_status` | `Ehime University / PSII review_only_separate_from_su_revenue` |
| `p21_survival_cash_status` | `PSI/national_project_survival_guard_not_gross_margin` |
| `p21_lane_double_count_guard` | `U1_short_cash_separate_from_U4_U5_main_P` |
| `p21_gross_margin_release_condition` | `PoC/customer contract + invoice + payment + COGS/O&M + recurring model + U1-vs-U4/U5 lane mapping` |

## 5. still blocked fields

| project | blocked field | なぜblockedか | next source needed |
|---|---|---|---|
| p20 | TES/ADR/冷却機テスト販売の単価・原価・粗利 | コスト整理/試算sourceはあるが、正式値・契約・請求・入金に未接続。 | 見積/契約、原価表、CAPEX表、顧客候補別価格、請求/入金予定。 |
| p20 | テスト販売が評価データ目的か粗利目的か | 利益度外視・評価データ優先の方針はあるが、案件ごとの目的分解が未確認。 | 案件別PoC設計、取得する評価データ、成功条件、価格設定意図。 |
| p20 | NIMS研究契約cashの主体・PL接続 | NIMS税込100万円未満契約はsourceあり。ただしSU本体売上/AMD業務/研究契約の最終分離が必要。 | 契約書、請求書、入金、業務範囲、原価、人員工数。 |
| p20 | 政府系助成金/コンソーシアムのcash化 | 方針・候補sourceであり採択/契約/入金ではない。 | 採択通知、契約、入金条件、自己負担、使途制限。 |
| p21 | 485円/Lの計算前提 | UE sourceとして強いが、正式R_net値ではない。 | コスト試算Excel、処理量、変動費、O&M、導入費、追加収益源、顧客支払意思。 |
| p21 | 従量課金モデルの収益性 | 方針sourceであり、契約・価格表・粗利に未接続。 | 料金表、契約案、顧客別処理量、支払条件、COGS/O&M。 |
| p21 | Fine-Chem/10件PoCの目的分解 | PoC/売上実績づくり候補だが、利益目的か評価データ目的か、契約済みか未確認。 | PoCリスト、各PoCの契約/価格/原価/評価データ、次商談接続。 |
| p21 | 愛媛大学/PSII cashのPL接続 | 研究契約cashとして分離すべきだが、契約主体・支払実績・使途が未確認。 | 契約書、見積書、仕様書、納品/検収、請求/入金、PSII支払証跡。 |
| p21 | PSI/国プロのSurvival条件 | 政策・国プロ接続は強いが、助成金/政策資金の入金条件が未接続。 | PSI契約/交付条件、国プロ採択有無、自己負担、後払い条件、使途制限。 |
| p21 | U1短期cashとU4/U5本命Pの二重カウント防止 | 用途レーンは整理済みだが、evidence cards上のfield固定が必要。 | 用途別PL/PoC/政策source mapping、U1で得た評価データがU4/U5へ転用可能かの判断。 |

## 6. next source needed

1. p20: TES/ADR/冷却機テスト販売の案件別source pack
   - 契約/見積、請求/入金、原価/CAPEX、人員工数、取得評価データ、顧客信頼/次商談接続をsource単位で確認する。
2. p20: NIMS研究契約cash source join
   - 税込100万円未満契約、見積依頼、6月現場活動を、研究契約cash / validation access / AMD billing / SU revenue候補へ分離する。
3. p21: U1 PoC revenue vs validation source join
   - Fine-Chem、ガラスリソーシング、金属廃液サンプル、10件PoCを、PoC売上候補・評価データ目的・future/draftへ分ける。
4. p21: 485円/L・従量課金UE source review
   - 処理単価485円/Lの計算前提、追加収益源、O&M、導入費、顧客支払意思、継続性を確認する。
5. p21: 愛媛大学/PSII/PSI cash source split
   - 研究契約cash、policy/grant cash、SU本体売上候補、U1 PoC revenueを混ぜずにsource id単位で整理する。
6. p20/p21共通: evidence cards v6 field adoption
   - 上記fieldsを v6 に戻し、`validation_value_source` を標準分類として採用するかBZM司令塔が判断する。

## 7. 司令塔判断事項

1. p20/p21の利益度外視PoC・テスト販売・有料製作を、`validation_value_source` として標準分類へ採用してよいか。
2. `validation_value_source` はR_net粗利へ入れず、BRL/SRL/顧客信頼/将来販売補助sourceとして固定してよいか。
3. p20 NIMS、p21 愛媛大学/PSIIを `research_contract_cash` として、`amd_billing_or_research_contract` 下位ラベルに置き、SU本体売上から恒久分離してよいか。
4. p21 485円/Lは `usable source` だが正式R_net値ではない、という扱いでv6へ戻してよいか。
5. p21のU1短期cashとU4/U5本命Pの二重カウント防止を必須fieldにしてよいか。
6. p20/p21のgross margin candidate解除条件を、契約・請求・入金・原価/粗利・本命PJ影響・評価データ有無のsource joinまで維持してよいか。

## 8. 検証

- 指定されたAGENTS/CLAUDE/HANDOFF/BZM runsをread-onlyで確認した。
- `/Users/masa/projects/knowledge/cx.md` と `/Users/masa/projects/knowledge/sx.md` をread-onlyで確認した。
- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸置換、過去score再計算は行っていない。
- p20/p21 validation valueを粗利/正式R_netへ昇格していない。
- AMD billing / research contract / grant / PSI / university contract をSU本体売上/粗利にしていない。
- p21 485円/Lを正式R_net値にしていない。
