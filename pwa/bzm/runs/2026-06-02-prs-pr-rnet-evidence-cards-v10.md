# P/R_net evidence cards v10 — p11 Sumitomo Riko transaction proof refresh

作成日: 2026-06-02
作成者: BZM理論検証worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、PRS候補を正式rubric化する前の evidence card である。

- P/R_net の 0-9 score は確定しない。
- 現行7軸AMD Scoreは正式モデルのまま扱う。
- PRSは `Adopt as comparison layer` の検証用に使う。
- `R_net = 粗利貢献 - 運営コスト - 本命PJへのリソース毀損` という見方は採用するが、まだrubricではない。
- 売上ゼロでも成立する創薬/外部資金/薬事/EXIT型を、R_net低値だけでNO_GOにしない。
- v2では finance/cash source pack と billing vs SU revenue join map を戻し、各PJに `Finance/Cash source classification` を追加した。
- v3では JOYCLE AMD support end current truth review と damage/reinvestment source pack を戻し、p09 JOYCLEを `damage guard` / `本命毀損候補` の `review-only` 対象として更新した。
- v4では JOYCLE damage source split を戻し、support end date、support end reason、R&D budget / engineering time damage、sales-before-proof、operating cost source、billing_cycles exclusion を明示的に分離した。
- v4では p09 JOYCLEの分類を `db_current_truth_plus_knowledge_current_with_normalized_column_gap` とした。DB/knowledgeの終了状態は一致し、gapは `project_ventures.amd_support_ended_at` 正規化カラムだけに限定する。
- v5では `p07 bridge validation source join` を戻し、LiSTieのbridge business candidateを契約・請求・入金・原価/粗利・本命LISMIC影響の5点セットで `review-only` に固定する。
- v5では `bridge_business_classification=bridge_business_candidate`、`bridge_revenue_stage=nda_mou_or_pipeline_candidate`、`bridge_invoice_status=not_currently_available`、`bridge_payment_status=not_currently_available`、`bridge_cost_constraint_status=available_constraint_source_not_value`、`bridge_gross_margin_status=gross_margin_not_joined`、`bridge_validation_value_status=validation_source_not_revenue`、`main_lismic_impact_status=requires_masa_or_bzm_review`、`survival_cash_separate_status=grant_debt_equity_excluded_from_rnet` をp07欄へ戻す。
- v5では project_knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` と `cd5e86d0-ec74-45aa-9a15-d4237e974610` をR_net押し下げ方向の `usable source` として戻す。ただし正式値・正式R_netではない。
- v6では `p20-p21 validation value source split` を戻し、p20 CryoX / p21 SolvioraXの利益度外視PoC・テスト販売・有料製作・研究契約cash・Survival cashをsource purpose別へ分解する。
- v6では `validation_value_source_standard=adopt_as_comparison_layer_classification`、`validation_value_not_rnet_gross_margin=true`、`research_contract_cash_parent_label=amd_billing_or_research_contract`、`required_release_condition_for_gross_margin=contract + invoice + payment + cost/gross_margin + core_project_impact`、`future_or_draft_not_actual=true` を共通fieldとして反映する。
- v6ではp20に `p20_validation_value_status=standard_classification_review_only`、`p20_research_contract_cash_status=review_only_separate_from_su_revenue`、`p20_amd_billing_use=exclude_from_prs_cash_timing_only`、`p20_survival_cash_status=grant_consortium_policy_review_only`、`p20_gross_margin_release_condition=TES/ADR/cooling test-sale contract + invoice + payment + COGS/CAPEX + personnel burden + validation output` を戻す。
- v6ではp21に `p21_validation_value_status=standard_classification_review_only`、`p21_ue_source_status=usable_source_not_formal_rnet_value`、`p21_price_per_liter_source=485_yen_per_liter_candidate`、`p21_pricing_model_status=usage_based_model_review_only`、`p21_research_contract_cash_status=Ehime University / PSII review_only_separate_from_su_revenue`、`p21_survival_cash_status=PSI/national_project_survival_guard_not_gross_margin`、`p21_lane_double_count_guard=U1_short_cash_separate_from_U4_U5_main_P`、`p21_gross_margin_release_condition=PoC/customer contract + invoice + payment + COGS/O&M + recurring model + U1-vs-U4/U5 lane mapping` を戻す。
- v7では `p11 membrane gate source join` をBZM採用判断として戻し、BWE膜外販を `p11_membrane_external_sale_status=bottleneck_external_sale_candidate` / `p11_membrane_prs_use=review-only` に固定する。
- v7ではp11膜外販のreview解除条件を `p11_membrane_release_condition=supply_capacity + gross_margin_basis + main_red_impact` とし、供給余力、粗利/COGS、RED本命影響の3条件が揃うまで正のR_netへ昇格しない。
- v7では追加gateとして external buyer / contract / invoice / payment / cost を必須扱いし、`p11_membrane_external_buyer_status=not_joined`、`p11_membrane_contract_status=not_joined`、`p11_membrane_invoice_status=not_joined`、`p11_membrane_payment_status=not_joined`、`p11_membrane_cogs_status=not_currently_available` を戻す。
- v7では `p11_membrane_supply_capacity_status=blocked_missing_supply_allocation`、`p11_membrane_gp30_status=candidate_not_joined_to_cogs`、`p11_membrane_main_red_impact_status=requires_masa_or_bzm_review` とし、GP30%候補を元row/source id・COGS・buyer未joinの `review-only` に留める。
- v7では `p11_membrane_double_count_guard=do_not_mix_sip_research_contract_amd_billing_policy_demo_into_su_membrane_gross_margin`、`p11_research_contract_cash_status=sip_joint_research_review_only_separate_from_su_revenue`、`p11_survival_cash_status=sip_policy_demo_survival_guard_not_gross_margin`、`p11_amd_billing_use=exclude_from_prs_cash_timing_only`、`p11_future_plan_status=review_only_not_actual`、`p11_do_not_use_as=positive_R_net, formal_R_net_value, sales_actual, gross_margin_actual` を戻す。
- v8では `p11 GP30 raw source lookup` をBZM採用判断として戻し、GP30 raw sourceを `found_exact` とする。
- v8で見つかったGP30 raw sourceは `source_cache.cache_id=p11_gmail_19c98f0f1d7cea62` / row `d083a88f-04d8-4d99-9f61-b1be87b586cd`、derived knowledgeは `904dbf36-5194-4df2-a860-d23810be0054` / `239c5076-c1b5-4455-b6d1-34434bad6fa1`。
- v8ではraw textを「10kWhシステムの総益率GP30%」として扱い、`p11_gp30_classification=RED_10kWh_system_gross_margin_candidate`、`p11_gp30_not_membrane_standalone_external_sale=true`、`p11_gp30_prs_use=review-only` とする。
- v8では `p11_membrane_gp30_status=not_supported_by_found_gp30_source` と `p11_system_gp30_status=found_exact_but_missing_cogs_and_transaction_join` を分離する。
- v8では価格、COGS、契約、請求、入金、system scopeが未joinなので、10kWh system GP30も膜外販R_net根拠も正式R_net値・0-9 score・現行7軸置換には使わない。
- v9では `p11 system GP30 source join` をBZM採用判断として戻し、Gmail thread + 添付Excel `HH20260226②SRK試算_BWE財務計画_260221_y.xlsx` までjoinできた状態へ更新する。
- v9ではExcel `前提条件` sheetに10kW/100kW systemの売価・原価・GP30%、O&M売上/原価、売電売上/原価があるため、`p11_system_gp30_status=found_exact_with_excel_basis_but_no_transaction_join` とする。
- v9ではsystem COGSはExcel projection basisに留まり、vendor invoice / paid cost / delivery acceptance / QA / logistics / warranty / inventory / yieldには未joinなので、`p11_system_cogs_basis_status=projection_only_not_cogs_proof` を採用する。
- v9ではSumitomo Rikoはbusiness plan / investment review contextのcounterpartyであり、signed buyer/order sourceではないため、`p11_system_counterparty_status=review_counterparty_not_confirmed_buyer` とする。
- v9でも膜単体外販GP30ではない。`p11_system_membrane_double_count_guard=do_not_use_system_gp30_as_membrane_external_sale_gross_margin` とし、system laneもmembrane laneも正式R_net値にはしない。
- v10では `p11 Sumitomo Riko transaction proof lookup` をBZM採用判断として戻し、Sumitomo Riko / 住友理工は finance plan / investment review / management meeting review counterparty として強いが、confirmed buyer / purchase order / signed contract / LOI / formal quote acceptance ではない、と明示する。
- v10では invoice / payment / delivery acceptance / customer acceptance、vendor-paid COGS / supplier invoice / paid cost / QA / logistics / warranty / inventory / yield proof は未発見のまま固定し、p11 `billing_cycles` はAMD/BWE billingであってBWE→Sumitomo Riko system sale paymentではない、とする。
- v10でも system lane と membrane lane は分離維持。system GP30をmembrane external-sale GPに使わない。
- `projects.status='ended'` / `projects.end_ym='202603'`、`project_ventures.narrative_text`、`project_ventures.master_md_text` は終結側のsourceとして扱う。
- JOYCLEの終結理由のうち、株主/bizdevや退任理由の口述由来部分は `support_end_reason_status=oral_history_pending_confirmation` として扱い、confirmed扱いにはしない。
- `PRSで使うなら` は `usable source` / `review-only` / `exclude from PRS` の3値に固定する。
- `billing_cycles` は原則 `exclude from PRS`。Survival/cash timing補助として扱う場合だけ `review-only`。
- p09の `billing_cycles` はAMD請求/cash timing補助に留め、PRS本体、JOYCLE本体粗利、damage/reinvestmentには使わない。
- p09の `damage_guard_use`、`sales_before_proof_status`、`rd_budget_engineering_time_damage`、`operating_cost_source_status` はすべて `review-only`。`do_not_use_as` は `positive_R_net, formal_damage_value, sales_actual, gross_margin_actual` に固定する。
- `research_contract_cash` は `amd_billing_or_research_contract` の下位ラベルとして扱う。p20 NIMS / p21 愛媛大学・PSII / p11 SIP は、SU本体売上から恒久分離する。
- p21の処理単価485円/Lと従量課金モデルは `su_revenue_candidate` としてR_net欄に置ける。ただしU1短期cashとU4/U5本命Pの二重カウント防止ラベルを必須にする。

確認した主資料:

- `pwa/bzm/runs/2026-06-01-prs-seven-axis-alignment.md`
- `pwa/bzm/runs/2026-06-01-prs-9pj-delta-review.md`
- `pwa/scripts/prxs_9pj_inputs.py`
- `pwa/scripts/prxs_retrofit_test.py`
- `pwa/design/amd_score.md`
- `/Users/masa/projects/knowledge/{tiem,KT,ctb,LST,jc,BWE,yd,cx,sx}.md`
- `pwa/bzm/runs/2026-06-02-prs-finance-cash-source-pack.md`
- `pwa/bzm/runs/2026-06-02-prs-billing-vs-su-revenue-join-map.md`
- `pwa/bzm/runs/2026-06-02-prs-damage-reinvestment-source-pack.md`
- `pwa/bzm/runs/2026-06-02-joycle-amd-support-end-current-truth-review.md`
- `pwa/bzm/runs/2026-06-02-joycle-damage-source-split.md`
- `pwa/bzm/runs/2026-06-02-p07-bridge-validation-source-join.md`
- `pwa/bzm/runs/2026-06-02-p20-p21-validation-value-source-split.md`
- `pwa/bzm/runs/2026-06-02-p11-membrane-gate-source-join.md`
- `pwa/bzm/runs/2026-06-02-p11-gp30-raw-source-lookup.md`
- `pwa/bzm/runs/2026-06-02-p11-system-gp30-source-join.md`
- `pwa/bzm/runs/2026-06-02-p11-sumitomo-riko-transaction-proof-lookup.md`
- `pwa/bzm/runs/2026-06-02-p11-membrane-source-join-deep-dive.md`
- `pwa/bzm/runs/2026-06-02-prs-classification-adoption-patch.md`
- `pwa/bzm/runs/2026-06-02-prs-bridge-validation-source-pack.md`
- `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md`

## 1. p03 ティエムファクトリ

### Pの仮説

- 仮説: high
- 確認済み根拠: 本命の透明モノリス断熱が窓へ載れば、断熱窓市場という大きな天井に届きうる。knowledgeでは、直接のエアロゲル断熱材市場は中規模だが、透明断熱窓の射程を含めるとPは大きいと整理されている。
- 未確認: 設立2012時点の市場実在性と、現在市場規模を将来到達上限として使う妥当性。Cabot代理店/商社化をした場合に、Pを本命モノリスの天井で見るのか、エアロゲル商社全体の天井で見るのか。

### R_netの仮説

- 粗利貢献: 史実では商社/受託を取らず、自走収益はほぼ立っていない。反実仮想ではCabot代理店、エアロゲル商社、開発受託が粗利源になりえた。
- 運営コスト: 本命モノリスR&Dは長く重い。シリーズA後に社員拡大し、資金枯渇とリストラに至ったため、固定費増がR_netを圧迫した可能性が高い。
- 本命PJへのリソース毀損: 商社/受託が本命を支える構造なら正のR_netだが、住友理工の自動車断熱のようにUEが合わない共同開発へ偏ると本命を毀損する危険がある。

### Finance/Cash source classification

今回のfinance分類で追加sourceは薄い。p03は実DB/L2の月次・MTG・finance行が薄く、Cabot代理店/商社化/開発受託は反実仮想を含むため、`future_or_draft_plan` または scenario source として次research対象に留める。

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/tiem.md` / `before_zero_theory.md` / 既存BZM runs | knowledge/scenario | `future_or_draft_plan` | `scenario_bridge_business_source` | `review-only` | 反実仮想の商社/受託を実績粗利にしない。本命モノリスPと商社粗利を足さない。 | 当時の契約額、粗利、在庫/営業/与信コスト、本命再投資が未確認。 |
| 追加finance source | not currently available | - | - | `exclude from PRS` | DB/L2に薄い状態を「売上なし確定」とも「高R_net」とも扱わない。 | next researchで当時資料・公開情報・まさ/BZM判断が必要。 |

### 7軸で説明できること

- 設立時に自社内製TRL=0だったこと、つまり「早すぎた」は7軸TRLゲートで十分説明できる。
- マクロ追い風は一定あったため、失敗主因はsigma_SUではなく自社内製TRL/HRL/BRLの不足として説明できる。

### PRSで追加説明できること

- 「Pは大きいが、R_netが立たず、会社として死なずに本命R&Dを続ける構造がなかった」を表現できる。
- 反省としての「商社+開発受託+ムーンショット」は、7軸よりR_net evidenceとして扱いやすい。

### 反例/危険な誤判定

- 「早すぎた」までPRSの成果として扱うのは誤り。これは7軸で説明済み。
- 商社/受託を常に正のR_netと見なすと危険。本命を支える粗利か、本命から経営注意を奪う仕事かを分ける必要がある。

### 次に必要な観測データ

- 当時のCabot代理店/商社化で想定できた粗利率、在庫/営業/与信コスト。
- 共同開発受託の契約額、粗利、サンプル作成装置などに吸われた実コスト。
- 商社/受託が本命モノリス開発へ再投資されたかを示す資金使途。

### rubric化してよいかの暫定判定

`needs_more_evidence`

ティエムはR_net概念の原型事例だが、反実仮想を含むため、そのままrubric化すると商社化万能論に過適合する。

## 2. p04 輝翠TECH

### Pの仮説

- 仮説: medium
- 確認済み根拠: 農業用AIロボAdamをMVPとして販売開始済み。2023年に多数農家でデモ、2024年3月販売開始、2024年5月シリーズA調達と量産・全国展開の文脈がある。
- 未確認: 農業ロボ市場全体の天井と、KT固有のAdamが取れる上限。まさ口述の10台程度販売は社内認識であり、公開情報上の累計台数は未確認。

### R_netの仮説

- 粗利貢献: Adam本体の販売が本命そのものの前倒し収益になりうる。
- 運営コスト: ロボ量産、サポート、保守、全国展開のコストが粗利をどの程度食うかは未確認。
- 本命PJへのリソース毀損: 本命そのものをMVP化しているため、ティエム型の別系統ライスワークより毀損は小さい仮説。ただし量産/導入対応がR&Dを圧迫する可能性は残る。

### Finance/Cash source classification

今回のfinance分類で追加sourceは薄い。p04はAdam販売の存在はP/R_net観測上の重要候補だが、今回のfinance/cash source pack対象外で、販売台数・単価・粗利・保守/導入負担は未確認。次research対象として扱う。

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/KT.md` / 既存BZM runs | knowledge/public-known | `su_revenue_candidate` | `mvp_revenue_candidate` | `review-only` | Adam販売を即高R_netにしない。本命MVP前倒し収益と導入/保守コストを分ける。 | 販売台数、単価、粗利、保守/導入支援コスト、R&D速度への影響が未確認。 |
| 追加finance source | not currently available | - | - | `exclude from PRS` | 実DB/L2が薄い状態を正式scoreの空欄補完に使わない。 | next researchで公開情報・内部販売情報・まさ/BZM判断が必要。 |

### 7軸で説明できること

- 月面ローバー技術から農業ロボへ転用し、TRL/BRL/HRLが段階的に上がった lifted 事例として説明できる。
- AMD関与はCOO派遣/体制構築で、HRL補完として説明しやすい。

### PRSで追加説明できること

- 本命を早期MVPとして有償展開する「系統II」の自走性を説明できる。
- ティエム/LiSTie/CryoXのような別系統つなぎ事業と区別する参照例になる。

### 反例/危険な誤判定

- KTの成長自体をPRSの証拠にしすぎると過剰。大筋は7軸成熟度で説明できる。
- MVP販売をただちに高R_netと見るのは危険。販売粗利、保守負担、量産不良、顧客対応コストを差し引く必要がある。

### 次に必要な観測データ

- Adamの販売台数、単価、粗利、保守/導入支援コスト。
- 販売開始後のR&D速度への影響。
- 量産資金とシリーズA資金の使途。

### rubric化してよいかの暫定判定

`needs_more_evidence`

本命前倒し収益型の良い参照例だが、粗利と導入コストが未確認。

## 3. p06 CrestecBio

### Pの仮説

- 仮説: high
- 確認済み根拠: 虚血性脳卒中治療薬は世界100億ドル超の大市場として整理されている。CTB211は神経保護薬で、既存薬との差別化余地がある。
- 未確認: CTB211固有の薬効、安全性、競合優位、ライセンス/EXIT確度。市場全体のPをCTB固有Pへどこまで割り引くか。

### R_netの仮説

- 粗利貢献: 治験中売上は基本ゼロ。現時点の生存はAMED等の外部資金に依存。
- 運営コスト: 創薬は非臨床/大動物/治験/薬事のコストが大きく、売上まで長い。
- 本命PJへのリソース毀損: 目先売上が本命を毀損するというより、売上ゼロ期間を外部資金・薬事プロセス・EXIT期待で耐える型。

### Finance/Cash source classification

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| strategy signal `20f2c8b9-563a-4504-9a8f-65b9f302c647` | candidate/decided | `amd_billing_or_research_contract` | `amd_order_pause_source` | `exclude from PRS` | AMD発注保留をSU本体売上・粗利の減少として直接転記しない。CTB型はR_net低値でNO_GOにしない。 | AMD発注/業務委託の停止情報であり、CTB本体PLではない。 |
| xrl evidence `ea743ad7-db44-48ae-a318-07b771746be7` | candidate | `amd_billing_or_research_contract` | `cash_stress_source` | `review-only` | cash stressをR_net粗利に混ぜない。Survival guardの補助に置く。 | 原薬異物混入とARMADA発注保留のsourceで、売上/粗利/入金実績ではない。 |
| project_knowledge `f91e59f3-b497-4a98-924d-a4d5cfd2ea09` | active | `survival_cash_or_grant` | `grant_or_policy_cash` | `usable source` | AMED研究資金を粗利に加算しない。営利業務不可制約をR_net加算禁止の根拠として扱う。 | 金額・期間・自己負担・後払い条件が未接続。 |
| project_knowledge `4a6d077e-d5d0-488f-8e64-9303de2c9017` | active | `survival_cash_or_grant` | `grant_or_policy_cash` | `usable source` | AMED外注可能契約をSU販売粗利にしない。 | 外注形態の制約sourceであり、粗利額ではない。 |
| monthly report `MR_p06_202604` | draft | `survival_cash_or_grant` | `grant_admin_burden_source` | `usable source` | AMED管理コストをR_net粗利ではなくSurvival/admin burdenに置く。 | draftであり、精算額・実入金・負担額の確認が必要。 |
| monthly report `MR_p06_202603` / project_knowledge `cf91eafa-949d-46db-89fe-2ff8c28804a8` | draft/active | `survival_cash_or_grant` | `cash_conversion_review_source` | `review-only` | freee/銀行入出金の確認運用を売上実績にしない。 | 決済済/未決済の確認方針で、実額PLではない。 |
| monthly report `MR_p06_202602` | draft | `survival_cash_or_grant` | `grant_or_policy_cash` | `usable source` | AMED収支管理体制を粗利加算しない。 | runway/admin sourceとしては有用だが金額・入金時期は未接続。 |
| xrl evidence `6253bafa-b797-4926-aaa0-2c3de1a1dbcf` / project_knowledge `04a9284c-8936-4923-8813-4af97e5cd9fe` | candidate/active | `grant_or_policy_cash` | `future_grant_path_source` | `review-only` | Go-Tech/NEDO DTSU検討を採択済み資金にしない。 | 検討・候補段階であり、採択/交付/入金未確認。 |

### 7軸で説明できること

- 創薬としては小動物試験完了後の設立/参画が普通のタイミングだった、というレーン固有readinessで説明できる。
- HRLは、資金調達失敗後のまさ退任とAMED採択後の事務対応への役割再配分という経時変化で説明すべき。

### PRSで追加説明できること

- R_netがゼロでも、創薬ではSを外部資金・薬事/ライセンス/EXIT構造で確保しうる、という重要な反例を提供する。
- P大/R_netゼロを単純に失敗としないガードを要求する。

### 反例/危険な誤判定

- `R_net=低い -> NO_GO` はCTBに対して危険。創薬の売上ゼロ期間は構造的であり、外部資金の獲得可能性を別観測する必要がある。
- AMED等の助成金をR_netに混ぜると、粗利貢献と非希薄化資金が混ざる。

### 次に必要な観測データ

- AMED資金の金額、期間、使途、自己負担/後払い条件。
- 次ラウンド/ライセンス/共同研究の確度。
- 創薬レーン専用のS観測項目: 非希薄化資金、薬事進捗、製薬提携、EXIT可能性。

### rubric化してよいかの暫定判定

`counterexample_guard_needed`

CTBはR_net rubricを作る前に必ずガード化するべき反例。

## 4. p07 LiSTie

### Pの仮説

- 仮説: high
- 確認済み根拠: 2030年売上300億円、IPO FY32、IPOまでの資金需要100億円級というロードマップがある。BESS/EV電池・リチウム資源安保の追い風も強い。
- 未確認: LiSTie固有の技術/販路が市場上限をどこまで取れるか。RecycLi/RiCube等との関係、大学シーズ起点は要確認。

### R_netの仮説

- 粗利貢献: 本命LISMICユニット装置販売前に、リチウムリサイクルで年4.2〜12億円規模の先行売上を立てる internal roadmap はある。ただし `/Users/masa/projects/knowledge/LST.md` 由来の計画であり、formal revenue、契約、請求、入金、粗利実績からは除外する。
- 運営コスト: 原料調達、精製、販売スキーム、装置・ラボ・人員コストが必要。`5d5525f5-21d4-49e2-a7ee-5e8dba396de1` の数千tミニマム/初期R&D費用回収難と、`cd5e86d0-ec74-45aa-9a15-d4237e974610` の柏市物件/初期費用5,000万円見込みは、R_net押し下げ方向の `usable source` として置ける。ただし正式値ではない。
- 本命PJへのリソース毀損: リサイクル先行が本命装置販売への橋渡しなら正のR_net候補。短期商流対応でLISMIC開発が遅れるなら毀損候補。現時点では source だけで正負を決めず、`main_lismic_impact_status=requires_masa_or_bzm_review` とする。

### Bridge validation source join

| field | v5 value | source / basis | prs_use | why_not_formal_score_yet |
|---|---|---|---|---|
| `bridge_business_classification` | `bridge_business_candidate` | xrl `0aa71b29-915c-43d8-86ee-060d87217f09`, knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | `review-only` | リサイクラーNDA/MOU方針、装置メーカー連携、ブラックマス調達・販売先候補はあるが、契約/請求/入金/原価/本命影響が未接続。 |
| `bridge_revenue_stage` | `nda_mou_or_pipeline_candidate` | xrl `0aa71b29-915c-43d8-86ee-060d87217f09` | `review-only` | NDA/MOU方針・商談候補であり、受注・契約締結・販売実績ではない。 |
| `bridge_customer_or_counterparty_status` | `candidate_or_discussion_only` | knowledge `04151001-a05c-489d-b961-a64ef6f49b1d`, `/Users/masa/projects/knowledge/LST.md` | `review-only` | 買取/販売先候補とroadmapはあるが、counterpartyの契約条件・検収・支払条件が未確認。 |
| `bridge_invoice_status` | `not_currently_available` | p07 bridge validation source join / finance source pack | `exclude from PRS` | SU本体リサイクル商流の請求書・請求予定・検収条件sourceが見つかっていない。AMD billingで代替しない。 |
| `bridge_payment_status` | `not_currently_available` | p07 bridge validation source join / finance source pack | `exclude from PRS` | リサイクル商流の入金確認、入金サイト、検収後支払条件は未確認。融資/投資/補助金を売上入金にしない。 |
| `bridge_cost_constraint_status` | `available_constraint_source_not_value` | knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1`, `cd5e86d0-ec74-45aa-9a15-d4237e974610` | `usable source` | 数千tミニマム、初期R&D費用回収難、初期費用5,000万円見込みは制約source。実原価・粗利率・支払済CAPEXではない。 |
| `bridge_gross_margin_status` | `gross_margin_not_joined` | xrl `fb0bd2de-2c62-42bb-ae0f-020b620129cf` + missing原価表 | `review-only` | 膜寿命/前処理コスト課題はあるが、COGS、歩留まり、外注費、在庫費、粗利率に未接続。 |
| `bridge_validation_value_status` | `validation_source_not_revenue` | xrl `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | `review-only` | TYK実証は評価データ/BRL/SRL補助。販売実績・粗利・入金ではない。 |
| `main_lismic_impact_status` | `requires_masa_or_bzm_review` | roadmap + cost constraints + bridge sources | `review-only` | bridgeが本命LISMICを支えるか、固定費/商流対応で本命開発を遅らせるかは未判断。 |
| `survival_cash_separate_status` | `grant_debt_equity_excluded_from_rnet` | xrl `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19`, `ba404315-ee28-4f44-9156-9a2165103982` | `exclude from PRS gross margin` | 融資・投資・Startup Global等はrunway/Survival source。R_net gross marginへ加算しない。 |
| `review_only_release_condition` | `contract + invoice + payment + cost/gross_margin + main_lismic_impact joined by source` | classification adoption patch / p07 bridge validation join | gate | 5点セットが揃うまで、bridge businessを正式usable/high R_netへ昇格しない。 |
| `double_count_guard` | `do_not_add_recycling_bridge_to_lismic_P; do_not_treat_NDA_MOU_as_order; do_not_mix_grant_debt_equity_into_gross_margin` | p07 bridge validation join | guard | リサイクル商流、本命LISMIC P、NDA/MOU、grant/debt/equityの混同を防ぐ。 |

### Finance/Cash source classification

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| xrl evidence `0aa71b29-915c-43d8-86ee-060d87217f09` | candidate / available_now as candidate existence | `bridge_business_candidate` | `bridge_business_revenue_candidate` / `nda_mou_or_pipeline_candidate` | `review-only` | NDA/MOU方針を受注・契約・請求・入金実績にしない。リサイクル商流と本命LISMIC装置Pを足さない。 | 受注、契約、単価、粗利、入金条件、本命開発への影響が未確認。 |
| project_knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | active / available_but_needs_join | `bridge_business_candidate` | `commercial_pipeline_source` / `candidate_or_discussion_only` | `review-only` | ブラックマス買取/リサイクルリチウム販売先候補を実績粗利にしない。 | 顧客/商流候補で、販売単価・契約・原価・入金が未接続。 |
| `/Users/masa/projects/knowledge/LST.md` 年4.2-12億円計画 | knowledge / internal roadmap | `future_or_draft_plan` | `internal_roadmap_review_only` | `review-only` | 年4.2-12億円計画を契約・請求・入金・formal revenueにしない。 | roadmapであり、L2 row id、契約書、請求、入金、原価表、COGSとのjoinがない。 |
| xrl evidence `fb0bd2de-2c62-42bb-ae0f-020b620129cf` | candidate / available_but_needs_join | `bridge_business_cost_source` | `cost_structure_source` / `gross_margin_not_joined` | `review-only` | 技術/前処理コスト課題を粗利率そのものとして扱わない。 | コスト課題sourceであり、粗利額・原価表ではない。 |
| project_knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` | active / available_now | `bridge_business_cost_source` | `operating_cost_source` / `available_constraint_source_not_value` | `usable source` | 初期R&D費用回収難をR_net押し下げsourceとして置き、売上候補と相殺せず別表示する。 | 数千tミニマム等の制約は強いが、実支出・粗利値は未確認。正式値ではない。 |
| project_knowledge `cd5e86d0-ec74-45aa-9a15-d4237e974610` | active / available_now | `bridge_business_cost_source` | `capex_fixed_cost_source` / `available_constraint_source_not_value` | `usable source` | 柏市物件/初期費用5,000万円見込みを運営コスト候補に留め、実支出扱いしない。 | 見込み段階であり、契約・支払・資金繰りへの反映が未確認。正式値ではない。 |
| xrl evidence `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | candidate | `debt_or_equity_cash` | `debt_or_equity_cash` | `usable source` | 融資/投資をR_net粗利へ加算しない。runway/cash sourceとして分離する。 | 融資実行・投資委員会段階の混在、条件・入金時期・希薄化影響が未接続。 |
| xrl evidence `ba404315-ee28-4f44-9156-9a2165103982` | candidate | `survival_cash_or_grant` | `grant_or_policy_cash` | `usable source` | Startup Global最大2億円を売上粗利にしない。後払い/自己負担/使途制限を別確認する。 | 契約/KPI sourceであり、交付条件・入金時期・支出先行の影響が未確認。 |
| xrl evidence `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | candidate | `validation_value_source` | `policy_demo_validation_source` | `review-only` | TYK実証を販売実績にしない。評価データ/BRL/SRL補助として扱う。 | 試運転段階で、売上/粗利/入金との接続が未確認。 |

### 7軸で説明できること

- リチウム資源安保、UMI/SBIR/QST、TRL/HRL/SRLの上昇は7軸で説明できる。
- 設立GO寄りの根拠はsigma_SU/TRL/HRL/FRLで大筋説明可能。

### PRSで追加説明できること

- GO後の生存設計として、リサイクル先行売上候補、補助金後払い、融資/投資runway、初期固定費・スケール制約を分離してR_net/Survivalで表現できる。
- 系統I「本命前の別系統つなぎ事業」の代表例になる。

### 反例/危険な誤判定

- リサイクル売上をそのまま高R_netにしない。入金タイミング、原料/外注コスト、運転資金、装置開発への集中度を差し引く必要がある。
- NDA/MOU、販売先候補、TYK実証、年4.2-12億円計画を契約・請求・入金・formal revenueにしない。
- 融資、投資、Startup Global、NEDO/SBIR等をR_net gross marginへ混ぜない。Survival cash / runwayへ分離する。
- LSTのrocket性そのものは7軸でも説明できる。PRS差分は自走性の中身に限定する。

### 次に必要な観測データ

- リサイクル商流別の契約、請求、入金サイト、在庫/原料コスト、COGS、粗利。
- 補助金の後払い条件と資金繰り影響。
- 本命LISMIC開発リソースとの競合状況。

### rubric化してよいかの暫定判定

`ready_for_observation_draft`

ただし「観測項目 draft」まで。bridge business は5点セットが揃うまで `review-only` で、値付けrubricや0-9表は、契約/請求/入金/原価/本命LISMIC影響のsource join後に限る。

## 5. p09 JOYCLE

### Pの仮説

- 仮説: medium
- 確認済み根拠: 産廃・GXサーキュラーの市場は大きい一方、JOYCLE固有では設立時SaaSで自社技術なし、後から群馬大野田先生の流動層熱分解へdeep化を試みた段階。
- 未確認: JB-02A完成後の本命deeptech装置が実際に取れる市場上限。産廃全体市場と熱分解油/装置市場をどう分けるか。

### R_netの仮説

- 粗利貢献: JB-02は完成済み、JB-02Aは設計中で販売前夜。現時点で販売実績は未確認。
- 運営コスト: 装置開発、野田先生技術の実装、産廃顧客獲得にはR&D投資が必要。
- 本命PJへのリソース毀損: 目先売上や装置販売前夜が本命deeptech R&Dを支えるか、逆にR&D投資縮小の口実になるかを分けて見る。株主/bizdev方針や退任理由の口述由来部分は `oral_history_pending_confirmation` なので、confirmed扱いやformal damage reasonにはしない。
- v4 source split: 終了日、終結理由、R&D予算/engineering time damage、JB-02/JB-02A sales-before-proof、装置導入/保守/輸送cost、billing_cyclesを別sourceとして扱う。各sourceはR_net値へ足し引きせず、人間レビュー用のguardとして置く。

### AMD support end current truth

| field | value | source / guard |
|---|---|---|
| `support_end_status` | `ended_current_truth_candidate` | `projects.status='ended'`、`projects.end_ym='202603'`、`project_ventures.narrative_text`、`project_ventures.master_md_text`、`jc.md` |
| `support_end_date` | `2026-03` | `projects.end_ym='202603'` と knowledge `jc.md` の終了月が一致 |
| `support_end_db_gap` | `project_ventures.amd_support_ended_at_null` | `project_ventures.amd_support_ended_at` だけがstale候補。DB全体を古いとは扱わない |
| `current_truth_classification` | `db_current_truth_plus_knowledge_current_with_normalized_column_gap` | DB/knowledgeの終了状態は一致。正規化カラムだけNULL |
| `support_end_reason_status` | `oral_history_pending_confirmation` | 2026-05-06 / 2026-05-30の口述由来理由はconfirmed扱いにしない |
| `damage_guard_use` | `review-only` | support end日とdamage理由を分け、口述由来理由は正式damage根拠にしない |
| `sales_before_proof_status` | `review-only` | JB-02/JB-02A、JOYCLE BOX有償テスト、装置見学会、JOYCLE BOX化検討は販売実績にしない |
| `rd_budget_engineering_time_damage` | `review-only` | R&D予算削減・人員/engineering time毀損はraw sourceと口述が混在し、因果と金額は未接続 |
| `rd_source_status` | `mixed_raw_and_oral` | fixed月次・MTG raw sourceは活動存在に使えるが、damage因果は口述/knowledge mixed |
| `operating_cost_source_status` | `review-only` | 輸送、初号機開発予算、量産計画、装置仕様は実費/工数/保守負担未確認 |
| `billing_cycles_use` | `exclude_from_prs` | AMD billing / cash timing only。JOYCLE本体PL・damage・reinvestmentには使わない |
| `do_not_use_as` | `positive_R_net, formal_damage_value, sales_actual, gross_margin_actual` | 契約/請求/入金/原価/本命R&D影響が揃うまで、売上候補・damage候補・R&D毀損候補を値付けしない |

補足: `billing_cycles` は202512/202601のAMD請求・入金確認と202602請求処理の補助sourceにはなるが、JOYCLE本体の売上・粗利、PRS本体、damage/reinvestmentには使わない。

### JOYCLE damage source split

| split item | recommended classification | prs_use | v4 handling |
|---|---|---|---|
| AMD support end date | `support_end_current_truth` | `review-only` | `support_end_status=ended_current_truth_candidate` / `support_end_date=2026-03` として採用。ただしR_net値・damage理由にはしない。 |
| support end reason / まさ退任理由 | `oral_history_pending_confirmation` | `review-only` | `support_end_reason_status=oral_history_pending_confirmation` として保持。confirmed扱い・formal damage reason化はしない。 |
| R&D budget / engineering time damage | `damage_guard_candidate` / `reinvestment_unverified` | `review-only` | `rd_budget_engineering_time_damage=review-only`、`rd_source_status=mixed_raw_and_oral`。活動存在sourceとdamage因果を分ける。 |
| JB-02/JB-02A sales-before-proof | `sales_before_proof` / `bridge_business_candidate` | `review-only` | `sales_before_proof_status=review-only`。販売前夜であり、販売実績・正のR_net・粗利実績にしない。 |
| device introduction / maintenance / support burden | `operating_cost_source` | `review-only` | `operating_cost_source_status=review-only`。輸送・開発予算・量産計画は実費/工数が揃うまで値にしない。 |
| `billing_cycles` / AMD billing / cash timing | `amd_billing_cash_timing_only` | `exclude from PRS` | `billing_cycles_use=exclude_from_prs`。AMD請求/cash timing補助以外へ使わない。 |

### v4 follow-up flags

| flag | p09 status | why |
|---|---|---|
| `can_feed_evidence_cards_v4` | yes | support end date、DB gap、oral reason status、damage guard、sales-before-proof、R&D/operating cost、billing exclusionをsource splitとして戻せる。 |
| `needs_masa_confirm` | yes | 終結理由、株主/bizdev/R&D投資理解、まさ退任理由、damage guard代表例としての扱いは口述由来で、公開/準公開/内部限定のboundary判断が必要。 |
| `needs_os_db_hygiene` | yes | `project_ventures.amd_support_ended_at=NULL`、ended PJのfuture-like monthly/billing rows、narrative/master textと正規化カラムのズレはOS側source hygiene issue。 |
| `needs_more_source` | yes | JB-02/JB-02Aの契約/請求/入金/原価、導入/保守/輸送工数、R&D予算/人員推移、AMD関与終結前後の意思決定ログが未接続。 |

### Finance/Cash source classification

今回のfinance分類で追加sourceは薄い。p09はdamage guard/source pack側の対象であり、finance/cash source packのsource idを本体R_netへ採用しない。販売前夜・装置候補を実績R_netへ戻すのは危険なので、damage/reinvestment source pack、current truth review、damage source splitの分類を `review-only` / `exclude from PRS` で戻す。

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| `projects` p09 | confirmed DB row | `support_end_current_truth` | `projects_ended_202603` | `review-only` | AMD/ARMADA業務PJ終了の正規化DB current truth。damage理由やJOYCLE本体粗利へ転記しない。 | 終了月sourceであり、R_net値・damage値ではない。 |
| `project_ventures` p09 `narrative_text` / `master_md_text` | confirmed DB text | `support_end_current_truth` | `venture_text_support_end_202603` | `review-only` | narrative/master mdは終結側。`amd_support_ended_at=NULL`だけを継続根拠にしない。 | 非正規化text sourceなので、正規化カラム補正は別OS/DB判断が必要。 |
| `project_ventures.amd_support_ended_at` | stale candidate | `source_hygiene_issue` | `project_ventures.amd_support_ended_at_null` | `review-only` | NULLをAMD関与継続根拠にしない。DB全体が古いとは言わず、このカラムだけstale候補にする。 | DB補正は本成果物の対象外。 |
| `/Users/masa/projects/knowledge/jc.md` | confirmed knowledge / oral history mixed | `damage_guard_candidate` | `support_end_and_oral_reason_mixed` | `review-only` | 2026-03終結はcurrent truth候補。株主/bizdev・退任理由の口述部分は `oral_history_pending_confirmation` としてdamage理由へ直接混ぜない。 | support end日とdamage理由のsource statusが違う。 |
| p09 monthly_reports / project_knowledge / source_cache（R&D budget / engineering time） | mixed raw and oral | `damage_guard_candidate` / `reinvestment_unverified` | `rd_budget_engineering_time_damage` | `review-only` | R&D活動存在sourceと、予算削減/engineering time毀損の因果を分ける。 | 予算削減額、意思決定ログ、人的リソース推移、因果が未接続。 |
| p09 JB-02/JB-02A / JOYCLE BOX / 見学会 / 有償テスト source | mixed raw / future / oral | `sales_before_proof` / `bridge_business_candidate` | `sales_before_proof_status` | `review-only` | 販売前夜をsales_actualやpositive_R_netにしない。 | 契約、請求、入金、原価、本命R&D影響が未接続。 |
| p09 装置輸送 / 初号機開発予算 / 量産計画 / 装置仕様 source | mixed raw / future | `operating_cost_source` | `operating_cost_source_status` | `review-only` | 輸送・導入・保守・量産対応を粗利から差し引く候補に留め、実費扱いしない。 | 実支出、保守人員、顧客対応工数、故障対応、設置費が未確認。 |
| `billing_cycles` p09 rows | mixed / AMD billing | `amd_billing_cash_timing_only` | `billing_cycles_use=exclude_from_prs` | `exclude from PRS` | AMD請求/cash timing補助に限定し、PRS本体・JOYCLE本体粗利・damage/reinvestmentへ使わない。 | AMD billingであり、SU本体PLでもdamage sourceでもない。 |

### 7軸で説明できること

- 設立時SaaSで自社技術なし、TRL=0のNO_GOは7軸で説明できる。
- AMD関与後に野田先生が入り、TRL/BRLが上がったdeep pivotは7軸で追える。

### PRSで追加説明できること

- TRLが上がった後に、目先収益・株主/bizdev方針が本命R&Dを毀損してAMD関与終結へ向かった可能性を、`oral_history_pending_confirmation` のguardつきで説明できる。
- 「収益化」は正とは限らず、本命価値を壊す damage guard / 本命毀損候補になりうる、という強い差分。

### 反例/危険な誤判定

- 設立時NO_GOをPRSの成果にしない。7軸で十分。
- 装置販売前夜を正のR_netと早合点しない。販売が本命R&Dを支えるか、R&D削減の言い訳になるかを分ける。

### 次に必要な観測データ

- JB-02/JB-02Aの原価、販売予定単価、粗利、顧客候補、導入コスト。
- R&D予算の推移、AMD関与終結前後の研究開発投資方針。
- 株主/bizdevの意思決定ログと、本命技術実装の進捗停止/遅延の対応。ただし口述由来部分は `oral_history_pending_confirmation` の間、正式damage理由にはしない。

### rubric化してよいかの暫定判定

`counterexample_guard_needed`

JOYCLEは `damage guard` / `本命毀損候補` を作るための中核事例。正の売上候補と本命毀損候補を分けずにrubric化するのは危険。

## 6. p11 BWE

### Pの仮説

- 仮説: high
- 確認済み根拠: RED塩分濃度差発電は、公開資料上で原子力発電所約1,000基分相当のポテンシャルと整理されている。SIP採択、東京都実証など政策資金もある。
- 未確認: グローバルポテンシャルがBWE固有の取れる市場に変わる確度。装置面積、顧客設置条件、膜調達が市場上限をどこまで制限するか。

### R_netの仮説

- 粗利貢献: 本命RED装置販売は2029年目標で、設立初期の粗利はまだ見えにくい。膜外販がつなぎ収益候補。
- 運営コスト: 大型装置は初販売まで重く、イオン交換膜調達が最大ボトルネック。SIP/実証の管理コストも大きい。
- 本命PJへのリソース毀損: 膜外販はつなぎになりうるが、膜そのものが本命技術のボトルネックでもあるため、外販が本命装置開発を食う危険がある。

### Finance/Cash source classification

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| source_cache `p11_gmeet_minutes_198e5a68b13c43ea` | unknown | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | SIP収入・経理管理をSU本体販売粗利にしない。 | SIP/共同研究cash sourceで、BWE本体PL・粗利・入金条件との接続が未確認。 |
| source_cache `p11_gmeet_minutes_1990d8b496887caa` | unknown | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | SIP支払い/立替精算/遅延損害金をR_net粗利にしない。 | reimbursement/cash conversion sourceで、SU販売粗利ではない。 |
| `billing_cycles` `720566d5-64c3-4172-a00d-3f519e53da2b` ほか p11 future rows | not_started / invoice_sent mixed | `amd_billing_or_research_contract` | `amd_billing_row` | `exclude from PRS` | `billing_cycles` はAMD請求。SU本体売上・粗利へ転記しない。 | future/AMD billing rowであり、本体PLではない。 |
| `2026-06-01-prs-l2-source-inventory.md` / BWE GP30%メモ | candidate superseded by exact lookup | `su_revenue_candidate` | `bottleneck_external_sale_candidate` | `review-only` | v7時点の膜外販GP30%候補は、v8で見つかったraw sourceにより膜単体外販ではなく10kWh system laneへ分離する。膜外販は供給余力・本命RED影響なしに正のR_netにしない。 | v8 exact lookupでraw sourceは見つかったが、膜単体外販ではない。膜SKU、膜単価、膜COGS、供給余力、外販先、本命装置影響は未確認。 |
| source_cache `p11_gmail_19c98f0f1d7cea62` / row `d083a88f-04d8-4d99-9f61-b1be87b586cd` + Gmail attachment `HH20260226②SRK試算_BWE財務計画_260221_y.xlsx` | found exact with Excel projection basis and Sumitomo Riko transaction proof lookup completed read-only | `RED_10kWh_system_gross_margin_candidate` / `system_financial_projection` | `system_gp30_source` | `review-only` | raw textは「10kWhシステムの総益率GP30%」。添付Excelには10kW/100kW systemの売価・原価・GP30%、O&M売上/原価、売電売上/原価があるが、膜単体外販R_net根拠にしない。Sumitomo Riko / 住友理工はfinance plan / investment review / management meeting review counterpartyであり、confirmed buyer/order扱いしない。 | Excel projection basisとreview counterpartyは見つかったが、purchase order / signed contract / LOI / formal quote acceptance / invoice / payment / delivery acceptance / vendor-paid COGS / QA / logistics / warranty / inventory / yield が未join。 |
| project_knowledge `904dbf36-5194-4df2-a860-d23810be0054` / `239c5076-c1b5-4455-b6d1-34434bad6fa1` | derived knowledge | `RED_10kWh_system_gross_margin_candidate` | `derived_system_gp30_source` | `review-only` | derived knowledgeはGmail由来の解釈補助。膜単体外販への読み替え禁止。 | 10kWh system GP30の正規化には使えるが、計算根拠や取引joinを追加しない。 |
| monthly report `p11_202612` | draft | `future_or_draft_plan` | `future_plan_source` | `review-only` | 住友理工条件交渉/10kW PoC/シード準備を実績扱いしない。 | future draftであり、契約・入金・粗利の確認がない。 |
| source_cache `p11_gmail_1987e26bfa8c4a6f` | unknown | `grant_or_policy_cash` | `grant_or_policy_cash` | `usable source` | SIP C(1)共同研究契約案を粗利にしない。政策実証/共同研究evidenceとして分離。 | 契約案であり、交付/入金/管理コストは未確認。 |
| monthly report `p11_202611` / `p11_202612` | draft | `grant_or_policy_cash` | `policy_demo_source` | `review-only` | SIP最終報告・PoC・行政対応をR_net粗利に混ぜない。 | future draftであり、実証資金の入金条件・自己負担が未確認。 |
| source_cache `p11_slack_1745979366_346149` | unknown | `validation_value_source` | `policy_demo_validation_source` | `review-only` | 試運転/山大契約/SPD訪問予定を売上実績にしない。 | 実証予定sourceで、販売・粗利・入金は未確認。 |

### GP30 raw source lane split / v10 flags

| field | v9 value | source / basis | prs_use | why_not_formal_score_yet |
|---|---|---|---|---|
| `p11_membrane_external_sale_status` | `bottleneck_external_sale_candidate` | `2026-06-02-p11-membrane-gate-source-join.md` / BWE GP30%メモ / `/Users/masa/projects/knowledge/BWE.md` | `review-only` | 膜外販は重要なR_net候補だが、膜自体がRED本命装置のボトルネックでもある。 |
| `p11_membrane_prs_use` | `review-only` | BZM採用判断 | `review-only` | 正のR_net、formal R_net value、sales actual、gross margin actualには使わない。 |
| `p11_membrane_release_condition` | `supply_capacity + gross_margin_basis + main_red_impact` | membrane gate 3 conditions | gate | 供給余力、粗利/COGS、RED本命影響が同時にsource joinされるまで解除しない。 |
| `p11_membrane_supply_capacity_status` | `blocked_missing_supply_allocation` | BWE knowledge / L2 source inventory | `review-only` | RED PoC / 初号機需要と外販余力の月次比較が未join。 |
| `p11_gp30_raw_source_status` | `found_exact` | source_cache `p11_gmail_19c98f0f1d7cea62` / row `d083a88f-04d8-4d99-9f61-b1be87b586cd` | `review-only` | exact raw sourceはあるが、値付けや正式R_netではない。 |
| `p11_gp30_raw_source_cache_id` | `p11_gmail_19c98f0f1d7cea62` | `2026-06-02-p11-gp30-raw-source-lookup.md` | `review-only` | cache idはsource pointer。秘密値や本文全量は書かない。 |
| `p11_gp30_raw_source_row_id` | `d083a88f-04d8-4d99-9f61-b1be87b586cd` | `source_cache` read-only lookup | `review-only` | row idはtraceability用。 |
| `p11_gp30_derived_knowledge_ids` | `904dbf36-5194-4df2-a860-d23810be0054`; `239c5076-c1b5-4455-b6d1-34434bad6fa1` | derived `project_knowledge` rows | `review-only` | derived knowledgeは計算根拠や取引joinを補完しない。 |
| `p11_gp30_classification` | `RED_10kWh_system_gross_margin_candidate` | raw text says 10kWh system GP30 | `review-only` | 10kWh system laneであり、膜単体外販laneではない。 |
| `p11_gp30_not_membrane_standalone_external_sale` | `true` | GP30 raw source lookup | guard | 膜外販R_net根拠への誤転用を防ぐ。 |
| `p11_gp30_prs_use` | `review-only` | BZM採用判断 | `review-only` | comparison-layer sourceとして残すが、正式scoreにはしない。 |
| `p11_gp30_attachment_status` | `gmail_attachment_found_not_source_cache_metadata` | `2026-06-02-p11-system-gp30-source-join.md` | `review-only` | Gmail attachmentは確認済み。ただし `source_cache.metadata_json` には添付filename / attachment id / Drive file idがない。 |
| `p11_gp30_attachment_filename` | `HH20260226②SRK試算_BWE財務計画_260221_y.xlsx` | Gmail thread attachment parsed read-only | `review-only` | Excel名はtraceability用。秘密値や署名付きURLは書かない。 |
| `p11_gp30_drive_file_id_status` | `not_joined` | Drive exact search / source_cache metadata check | gate | exact Drive file idは未join。Gmail attachment basisとして扱う。 |
| `p11_gp30_missing_basis` | `contract + invoice + payment + delivery_acceptance + vendor_paid_COGS + QA/logistics/warranty/inventory/yield` | system GP30 source join | gate | Excel projection basisは見つかったが、取引・検収・支払済原価・運用品質系のjoinはない。 |
| `p11_sumitomo_riko_search_status` | `completed_read_only` | `2026-06-02-p11-sumitomo-riko-transaction-proof-lookup.md` | `review-only` | Sumitomo Riko / 住友理工周辺のtransaction proofはread-onlyで確認済み。DB write / DDL / code / deployはしていない。 |
| `p11_sumitomo_riko_context` | `finance_plan_investment_review_and_management_meeting_review` | Gmail / source_cache / monthly_reports / billing_cycles / Drive read-only lookup | `review-only` | finance plan・出資検討・経営会議review文脈として強い。transaction sale contextではない。 |
| `p11_sumitomo_riko_counterparty_status` | `review_counterparty_not_confirmed_buyer` | Sumitomo Riko transaction proof lookup | `review-only` | confirmed buyer / purchase order / signed contract / LOI / formal quote acceptance は未発見。 |
| `p11_membrane_gp30_status` | `not_supported_by_found_gp30_source` | found GP30 source points to 10kWh system | `review-only` | GP30 raw sourceは膜単体外販の粗利根拠ではない。 |
| `p11_system_gp30_status` | `found_exact_with_excel_basis_but_no_transaction_join` | source_cache `p11_gmail_19c98f0f1d7cea62` + Gmail attachment Excel | `review-only` | Gmail thread + 添付Excelまでjoin。10kW/100kW systemの売価・原価・GP30%はあるが、契約・請求・入金・検収・支払済原価は未join。 |
| `p11_system_gp30_prs_use` | `review-only` | BZM採用判断 | `review-only` | system laneも正式R_net値、sales actual、gross margin actualにはしない。 |
| `p11_system_scope_status` | `10kW_system_basis_found` | Excel `前提条件` sheet | `review-only` | 10kW/100kW system basisは見つかったが、膜単体SKUではない。 |
| `p11_system_price_basis_status` | `found_in_excel_projection` | Excel `前提条件` sheet | `review-only` | 売価basisはprojectionであり、formal quote / order / accepted priceではない。 |
| `p11_system_cogs_basis_status` | `projection_only_not_cogs_proof` | Excel `前提条件` sheet | `review-only` | 原価basisはprojection。vendor invoice / paid cost / allocated labor / yield proofではない。 |
| `p11_system_transaction_join_status` | `not_joined` | system GP30 source join | gate | signed buyer/order, contract, invoice, paymentに未join。 |
| `p11_system_management_review_status` | `pending_or_no_result_source_found` | Sumitomo Riko transaction proof lookup | `review-only` | 経営会議review予定/文脈はあるが、承認結果sourceは未発見。 |
| `p11_system_contract_status` | `not_joined` | Gmail thread / source_cache / L2 rows checked | blocked | 契約書、注文書、LOI、受入条件は未join。 |
| `p11_system_order_status` | `not_joined` | Gmail / source_cache / monthly_reports / Drive lookup | blocked | purchase order / accepted quote / signed order は未join。 |
| `p11_system_invoice_status` | `not_joined` | billing_cycles p11 rows are AMD billing only | blocked | BWE system sale invoiceではない。 |
| `p11_system_payment_status` | `not_joined` | payment confirmation not found | blocked | BWE system sale paymentには未join。 |
| `p11_system_delivery_acceptance_status` | `not_joined` | source join result | blocked | 納品、検収、inspection completionは未join。 |
| `p11_system_vendor_paid_cogs_status` | `not_joined` | Sumitomo Riko transaction proof lookup | blocked | vendor-paid COGS / supplier invoice / paid cost proofは未join。 |
| `p11_system_cogs_proof_status` | `projection_only_not_vendor_invoice_or_paid_cost` | source join result | blocked | Excel原価はprojectionであり、vendor invoice / paid COGS proofではない。 |
| `p11_system_qa_logistics_warranty_inventory_yield_status` | `not_joined` | source join result | blocked | QA、物流、保証、在庫、歩留まりのcost proofは未join。 |
| `p11_gp30_thread_context` | `business_plan_and_investment_review` | Sumitomo Riko thread context | `review-only` | business plan / financial plan / investment review context。transaction sale contextではない。 |
| `p11_system_counterparty_status` | `review_counterparty_not_confirmed_buyer` | Sumitomo Riko thread context | `review-only` | Sumitomo Rikoはreview counterpartyで、confirmed buyer/order sourceではない。 |
| `p11_system_membrane_double_count_guard` | `do_not_use_system_gp30_as_membrane_external_sale_gross_margin` | BZM採用判断 | guard | system GP30を膜外販gross marginへ転用しない。 |
| `p11_membrane_cogs_status` | `not_currently_available` | finance source pack / membrane gate join | `exclude from PRS` | 原価表や同一取引に紐づくCOGS sourceが未確認。 |
| `p11_membrane_external_buyer_status` | `not_joined` | membrane gate join | `review-only` | 外販先名、用途、RED本命laneとの関係が未join。 |
| `p11_membrane_contract_status` | `not_joined` | membrane gate join | `review-only` | 契約書、注文書、契約ドラフト、検収条件、SKU/unit/priceが未join。 |
| `p11_membrane_invoice_status` | `not_joined` | membrane gate join | `exclude from PRS` | 外販請求書が未join。AMD billingで代替しない。 |
| `p11_membrane_payment_status` | `not_joined` | membrane gate join | `exclude from PRS` | 外販入金確認が未join。SIP支払い/立替精算で代替しない。 |
| `p11_membrane_main_red_impact_status` | `requires_masa_or_bzm_review` | R_net guard memo / BWE knowledge | `review-only` | 膜外販がRED本命開発を支えるか毀損するかはsourceだけで決めない。 |
| `p11_membrane_double_count_guard` | `do_not_mix_sip_research_contract_amd_billing_policy_demo_into_su_membrane_gross_margin` | billing vs SU revenue join map / membrane gate join | guard | SIP/共同研究cash、政策実証、AMD billingを膜外販粗利へ混ぜない。 |
| `p11_research_contract_cash_status` | `sip_joint_research_review_only_separate_from_su_revenue` | SIP月次/MTG source_cache | `review-only` | SIP/共同研究cashは `research_contract_cash` lane。SU本体膜外販売上ではない。 |
| `p11_survival_cash_status` | `sip_policy_demo_survival_guard_not_gross_margin` | SIP/東京都実証/政策実証source | `usable source` / `review-only` | Survival/7軸/政策実証補助に置き、gross marginへ加算しない。 |
| `p11_amd_billing_use` | `exclude_from_prs_cash_timing_only` | `billing_cycles` p11 future rows | `exclude from PRS` | AMD請求・cash timing補助でありBWE本体PLではない。 |
| `p11_future_plan_status` | `review_only_not_actual` | monthly report `p11_202611` / `p11_202612`, BWE roadmap | `review-only` | 住友理工条件交渉、10kW PoC、2029年販売目標を実績扱いしない。 |
| `p11_do_not_use_as` | `positive_R_net, formal_R_net_value, sales_actual, gross_margin_actual` | BZM採用判断 | guard | buyer/contract/invoice/payment/cost、3条件、まさ/BZM reviewが揃うまで値付けしない。 |

v10で戻すsystem lane field:

```yaml
p11_system_gp30_status: found_exact_with_excel_basis_but_no_transaction_join
p11_system_gp30_prs_use: review-only
p11_gp30_attachment_status: gmail_attachment_found_not_source_cache_metadata
p11_gp30_attachment_filename: HH20260226②SRK試算_BWE財務計画_260221_y.xlsx
p11_gp30_drive_file_id_status: not_joined
p11_system_scope_status: 10kW_system_basis_found
p11_system_price_basis_status: found_in_excel_projection
p11_system_cogs_basis_status: projection_only_not_cogs_proof
p11_system_transaction_join_status: not_joined
p11_system_management_review_status: pending_or_no_result_source_found
p11_system_contract_status: not_joined
p11_system_order_status: not_joined
p11_system_invoice_status: not_joined
p11_system_payment_status: not_joined
p11_system_delivery_acceptance_status: not_joined
p11_system_vendor_paid_cogs_status: not_joined
p11_system_cogs_proof_status: projection_only_not_vendor_invoice_or_paid_cost
p11_system_qa_logistics_warranty_inventory_yield_status: not_joined
p11_sumitomo_riko_search_status: completed_read_only
p11_sumitomo_riko_context: finance_plan_investment_review_and_management_meeting_review
p11_sumitomo_riko_counterparty_status: review_counterparty_not_confirmed_buyer
p11_gp30_thread_context: business_plan_and_investment_review
p11_system_counterparty_status: review_counterparty_not_confirmed_buyer
p11_system_membrane_double_count_guard: do_not_use_system_gp30_as_membrane_external_sale_gross_margin
```

### 7軸で説明できること

- SIP採択、政策マクロ、SU設立要請、TRL4/BRL3/HRL3程度の設立GOは7軸で説明できる。
- CEO/COOの経営未熟はHRL/FRLで説明できる。

### PRSで追加説明できること

- GOはできるが、設立後の初期キャッシュ自走が細いことを説明できる。
- 「高P・政策資金あり」でも、本命販売まで長い大型装置PJではR_net観測が必要と示せる。

### 反例/危険な誤判定

- BWEをR_net不足だけでNO_GOにするのは早い。SIP/政策資金/実証は7軸上のGO根拠。
- 膜外販をR_net候補と見ても、未確定かつ本命ボトルネックなので、安易に正のR_netへ置かない。
- GP30% exact raw sourceと添付Excel basisは見つかったが、本文は「10kWhシステムの総益率GP30%」であり、膜単体外販ではない。したがって `p11_membrane_gp30_status=not_supported_by_found_gp30_source`、`p11_system_gp30_status=found_exact_with_excel_basis_but_no_transaction_join` と分ける。
- 10kWh/10kW system GP30はcomparison-layer sourceとして残せるが、Excel projection basisはbusiness plan / investment review contextであり、contract / invoice / payment / delivery acceptance / vendor-paid COGS / QA / logistics / warranty / inventory / yield が未joinのため `review-only`。膜外販R_net根拠、formal R_net value、sales actual、gross margin actualには使わない。
- SIP/共同研究cash、SIP/東京都実証、AMD billingを膜外販gross marginへ混ぜると二重カウントになる。

### 次に必要な観測データ

- 膜単体の量産可否、単価、粗利、外販先、供給余力。
- 10kWh/10kW system GP30の契約、請求、入金、納品検収、vendor-paid COGS、QA/物流/保証/在庫/歩留まり。Excel projection basisは見つかったが取引証憑・支払済原価証憑が未join。
- RED装置の初号機販売までのburn、実証資金の入金条件。
- 膜外販が本命RED装置開発に与えるリソース影響。
- 外販buyer、contract、invoice、payment、cost/COGSを同一取引へsource joinする。
- まさ/BZMが膜外販の本命RED影響を `supports RED` / `neutral` / `distracts RED` / `unknown` でレビューする。

### rubric化してよいかの暫定判定

`needs_more_evidence`

初期自走性の弱さは重要だが、膜外販が未確定で、found exactのGP30も10kWh system laneに留まるためrubric draftにはまだ早い。

## 7. p18 Yellow Duck

### Pの仮説

- 仮説: low
- 確認済み根拠: 波力発電は原理的にコストが合いにくく、公開情報でも発電コストが高い。各VCのDDでUE成立せず、ue_failとしてAMD関与が終結した。
- 未確認: Yellow Duck固有技術が波力レーン全体の構造的不利を覆せる余地。設立日・現状も不明。

### R_netの仮説

- 粗利貢献: 販売未到達。CEO自己資金で試作品を作っていた段階。
- 運営コスト: 海上実証、製造、設置、腐食/付着対策、維持管理コストが重い。
- 本命PJへのリソース毀損: 本命自体のUEが成立しにくく、つなぎ収益以前に本命販売が立たない。短期収益による毀損というより、低P/UE不成立。

### Finance/Cash source classification

今回のfinance分類で追加sourceは薄い。p18は実DB/L2が薄く、finance/cash source pack対象外。Yellow Duck型はfinance分類よりもUE/LCOE/市場構造researchを優先する。

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/yd.md` / `before_zero_theory.md` | knowledge | `future_or_draft_plan` | `ue_margin_research_target` | `review-only` | 低P/UE不成立をP側とR_net側で二重加点/二重減点しない。技術PoCを商用UE成立にしない。 | LCOE、製造/設置/保守、VC DD論点、類似SU failureが未接続。 |
| 追加finance source | not currently available | - | - | `exclude from PRS` | finance source不足をもってR_net値を確定しない。 | next research対象。 |

### 7軸で説明できること

- BRL/HRLの弱さ、資金調達サポートに留まった限定関与は7軸でも一部説明できる。
- ただしTRL=4の試作進捗だけではNO_GOを出しにくい。

### PRSで追加説明できること

- 技術PoCが進んでも、事業の天井やユニットエコノミクスが弱いと成立しないことをP/R_netで説明できる。
- 「TRLゲートを通るが事業として筋が悪い」対照群になる。

### 反例/危険な誤判定

- YDを単なるBRL不足に潰すと、UE不成立という本質が消える。
- 波力レーン全体のP評価とYellow Duck固有Pを混同しない。

### 次に必要な観測データ

- Yellow Duck固有のLCOE、製造/設置/保守コスト、想定売電/販売単価。
- VC DDでNO_GOになった具体論点。
- 海外類似SUの失敗理由を、P/R_net観測項目へどう反映するか。

### rubric化してよいかの暫定判定

`ready_for_rubric_draft`

ただし低P/UE不成立の観測項目に限定。一般的なR_net値付けにはまだ使わない。

## 8. p20 CryoX

### Pの仮説

- 仮説: high
- 確認済み根拠: 量子コンピュータ冷却、極低温分析装置、データセンター冷却など複数の大きな射程がある。NIMS神谷氏の長期研究、Kiutra競合実績、量子/極低温のマクロ追い風もある。
- 未確認: CryoXのプランBがどの市場から実際に収益化するか。データセンター冷却とアカデミア向け冷却機ではPの天井が異なる。

### R_netの仮説

- 粗利貢献: 初期はTES自社生産×冷却機パッケージで、アカデミア市場向けテスト販売を想定。利益度外視で事例・評価データ獲得を優先するため、短期粗利は限定的かもしれない。
- 運営コスト: TES自社生産、テスト販売CAPEX、CEO体制、NIMS実施許諾、自社IP、月500-600万円程度のburn仮置きがある。
- 本命PJへのリソース毀損: アカデミア向け販売が評価データと資金を生むなら正。ただし受託/個別対応で人手を奪う場合は本命CryoX開発を毀損しうる。

### Finance/Cash source classification

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| meeting summary `5hv3utbm3cn8vlkk4p3th3pios` | confirmed/candidate | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | NIMS税込100万円未満契約をSU本体売上・粗利にしない。本命冷却機市場PとNIMS契約cashを分ける。 | `p20_research_contract_cash_status=review_only_separate_from_su_revenue`。契約/請求/入金/原価と、AMD/NIMS業務委託かSU本体売上かの最終ラベル確認が必要。 |
| strategy signal `aad6dc9e-240c-42ec-9f63-27bcea20a91d` | candidate | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | 見積依頼を売上実績にしない。 | 見積依頼段階で、契約・入金・原価未確認。 |
| strategy signal `9b080419-4df5-4cd8-8578-cd78b8099c34` | candidate | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | 6月現場活動予定をR_net粗利にしない。 | 契約/請求/入金/原価の突合が必要。 |
| `billing_cycles` `e1c409f6-18d8-4729-8452-de208955e448` / `b15713d4-2175-41c1-8c6f-0091a0aa57f2` / `c98648e2-8d16-425c-b65e-a237cc1b6d79` | not_started | `amd_billing_or_research_contract` | `amd_billing_row` | `exclude from PRS` | 202607-202609 `budget_yen=188500` AMD billing rowsをSU本体PLに転記しない。 | `p20_amd_billing_use=exclude_from_prs_cash_timing_only`。AMD請求予定で、SU本体売上・粗利ではない。 |
| meeting summary `slack-C092CF84CJV-1777271916_647919` | confirmed/candidate | `gross_margin_candidate` + `validation_value_source` | `cost_structure_source` / `capex_margin_review_source` | `review-only` | コスト整理/調達額シミュレーションの存在を正式粗利値にしない。資料存在と値採用を分ける。 | シート/資料の実数、販売単価、原価、CAPEX、評価データ目的とのjoinが未接続。 |
| strategy signal `91bf2e92-2383-4563-abc3-d0e812e5916e` | candidate | `gross_margin_candidate` | `capex_margin_review_source` | `review-only` | 販売原価/CAPEXすり合わせをR_net値にしない。 | 金額感のsource候補で、正式値ではない。 |
| meeting summary `5jj2i4e0so5f4valupne18ujha` | confirmed/candidate | `survival_cash_or_grant` | `grant_or_policy_cash` | `review-only` | VC/コンソーシアム/助成金方針を粗利にしない。 | `p20_survival_cash_status=grant_consortium_policy_review_only`。方針であり、採択・契約・入金ではない。 |
| strategy signal `c80306a5-b71a-4089-9430-892127f5fff1` | candidate | `grant_or_policy_cash` | `consortium_policy_source` | `review-only` | コンソーシアムモデルをSU販売粗利にしない。 | 資金調達/政策連携候補で、入金実績ではない。 |
| CX利益度外視テスト販売/有料製作候補 | candidate/mixed | `validation_value_source` | `validation_value_source` | `review-only` | 評価データ獲得を粗利として二重カウントしない。BRL/SRL/Survival補助へ分ける。 | `p20_validation_value_status=standard_classification_review_only`。粗利目的か評価データ目的か、単価/原価/人員負担が未確認。 |

### Validation value source split fields

| field | v6 value | guard |
|---|---|---|
| `validation_value_source_standard` | `adopt_as_comparison_layer_classification` | 利益度外視PoC・テスト販売・有料製作はBRL/SRL/顧客信頼/将来販売の補助sourceであり、R_net粗利へ加算しない。 |
| `validation_value_not_rnet_gross_margin` | `true` | 評価データ獲得と粗利貢献を分ける。 |
| `research_contract_cash_parent_label` | `amd_billing_or_research_contract` | NIMS契約cashをSU本体売上から恒久分離する。 |
| `required_release_condition_for_gross_margin` | `contract + invoice + payment + cost/gross_margin + core_project_impact` | p20での具体解除条件は `TES/ADR/cooling test-sale contract + invoice + payment + COGS/CAPEX + personnel burden + validation output`。 |
| `future_or_draft_not_actual` | `true` | 内部計画・資金調達額シミュレーション・candidate signalを実績扱いしない。 |
| `p20_validation_value_status` | `standard_classification_review_only` | テスト販売/有料製作を標準分類には戻すが、正式R_net値にはしない。 |
| `p20_research_contract_cash_status` | `review_only_separate_from_su_revenue` | NIMS税込100万円未満契約、見積依頼、現場活動をcash timing / validation access補助として分離する。 |
| `p20_amd_billing_use` | `exclude_from_prs_cash_timing_only` | AMD billing rowをSU本体PLの欠損補完に使わない。 |
| `p20_survival_cash_status` | `grant_consortium_policy_review_only` | 助成金/コンソーシアム方針はSurvival guardであり粗利ではない。 |
| `p20_gross_margin_release_condition` | `TES/ADR/cooling test-sale contract + invoice + payment + COGS/CAPEX + personnel burden + validation output` | 5+1点が揃うまで `gross_margin_candidate` / `review-only` に固定する。 |

### 7軸で説明できること

- NIMS神谷氏の研究、プランB転換、特許出願準備、顧客候補、CEO/VC準備は7軸で説明できる。
- 設立GO/準備判断の主根拠は、sigma_SU/TRL/BRL/HRL/FRLでよい。

### PRSで追加説明できること

- 設立前後に「小さく自走しながら本命へ行く」設計をR_netで監視できる。
- 利益度外視テスト販売を、売上ではなく事例/評価データ獲得込みでどう扱うかという観測論点を出せる。

### 反例/危険な誤判定

- テスト販売があるから高R_netと見ない。利益度外視なら粗利貢献は小さく、評価データ獲得は別価値として扱う必要がある。
- NIMS研究契約cashやAMD billingを、TES/ADR/冷却機テスト販売の粗利に足さない。p20では `research_contract_cash` / `amd_billing_row` / `validation_value_source` / `gross_margin_candidate` を分ける。
- CXの設立準備判断をPRSだけで説明しない。主軸は7軸。

### 次に必要な観測データ

- TES/ADR/冷却機テスト販売の契約、請求、入金、単価、原価、粗利、COGS/CAPEX、開発人員負担。
- NIMS内製造と外部拠点のCAPEX/粗利差。
- アカデミア販売が本命市場への評価データとして機能する証拠、評価データの内容、顧客信頼/次商談接続。

### rubric化してよいかの暫定判定

`needs_more_evidence`

R_net候補はあるが、利益度外視テスト販売はv6では `validation_value_source` として標準分類に戻し、粗利へ上げるには `p20_gross_margin_release_condition` の5+1点が必要。

## 9. p21 SolvioraX

### Pの仮説

- 仮説: high
- 確認済み根拠: 排水処理TAM、FY35売上200億円、事業価値1,000億円という目標があり、U1〜U5まで複数ユースケースを整理済み。U4/U5には兆円級/長期のアップサイドがある。
- 未確認: U1キャッシュ層からU4/U5へ拡張できる確度。シアノバクテリア技術が各用途でどこまで勝てるか。

### R_netの仮説

- 粗利貢献: 装置販売とシアノバクテリアサブスク/重量課金の2本立て。U1メッキ・化学排水は設立後即のキャッシュ層候補。
- 運営コスト: 初期投資、O&M、固定化担体、CO2濃縮、排水前処理、GMO閉鎖系、アライアンス管理など実装レイヤが多い。
- 本命PJへのリソース毀損: U1〜U3キャッシュ層が本命への橋渡しなら正。個別PoC/受託消化、ダイキ等パートナー調整、周辺レイヤ対応でコア開発が遅れるなら毀損。

### Finance/Cash source classification

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| monthly report `p21_202605` | draft | `amd_billing_or_research_contract` / `research_contract_cash` + `validation_value_source` | `research_contract_cash` / `ehime_contract_and_poc_source` | `review-only` | 愛媛大学契約・発注確定をSU本体売上にしない。Fine-Chem PoC具体化と研究契約cashを混ぜない。 | `p21_research_contract_cash_status=Ehime University / PSII review_only_separate_from_su_revenue`。draftで、契約主体・請求・入金・原価が未確認。 |
| meeting summary `4qqkgiatvd0p2sm4mspqr8k920_20260331T070000Z` | confirmed/candidate | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | 愛媛大学納品/見積/仕様書提出をSU販売粗利にしない。 | cash timing候補だが、SU本体収益ではなくAMD/大学契約の可能性が高い。 |
| meeting summary `43nvst4qu8ppdclf0heqd614u1` | confirmed/candidate | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | PSII予算1500万円・支払予定をU1売上/粗利に混ぜない。 | `p21_research_contract_cash_status=Ehime University / PSII review_only_separate_from_su_revenue`。大学/研究予算の契約・入金候補で、SU本体売上とは分離が必要。 |
| xrl evidence `3fc6e490-9f4d-4d73-ac0b-a306ffb97edf` | candidate | `gross_margin_candidate` + `validation_value_source` | `poc_revenue_candidate` / `fine_chem_validation_source` | `review-only` | 10件PoC・売上実績づくりを実績扱いしない。U1短期cashとU4/U5本命Pを分ける。 | `p21_validation_value_status=standard_classification_review_only`。PoC候補で、契約・単価・原価・入金条件・評価データ取得有無は未確認。 |
| meeting summary `77836j7np0dovhcns78av79qdq` | confirmed/candidate | `gross_margin_candidate` | `unit_economics_margin_source` | `usable source` | 処理単価485円/LをU1短期cash層のUE sourceとして置き、U4/U5本命Pへ二重カウントしない。 | `p21_ue_source_status=usable_source_not_formal_rnet_value`; `p21_price_per_liter_source=485_yen_per_liter_candidate`。出典・計算前提・処理量・O&M/導入コストの確認が必要で、正式R_net値ではない。 |
| meeting summary `6ujslfj6rjb6htj00hgp5q2srt` | confirmed/candidate | `gross_margin_candidate` / `future_or_draft_plan` | `pricing_model_source` | `review-only` | 従量課金モデルを価格体系候補として置き、粗利実績扱いしない。 | `p21_pricing_model_status=usage_based_model_review_only`。コスト・粗利・入金条件とのjoinが必要。 |
| monthly report `p21_202607` ほか future draft series | draft/future | `future_or_draft_plan` | `future_plan_source` | `review-only` | 事業計画/コスト試算/future draftを実績値にしない。 | future draftで、正式契約・実績・原価未確認。 |
| xrl evidence `1388d1cc-8e18-4cb0-8561-b3ce9f3533d5` | confirmed | `survival_cash_or_grant` | `national_project_connection_source` | `usable source` | 国プロ接続候補を粗利にしない。Survival/policy evidenceへ分離。 | `p21_survival_cash_status=PSI/national_project_survival_guard_not_gross_margin`。採択・交付・入金ではなく接続候補。 |
| monthly report `MR_p21_202604` | draft | `survival_cash_or_grant` + `future_or_draft_plan` | `psi_policy_cash_source` | `review-only` | PSI Step2をrunway/policy guardに置き、SU粗利加算しない。 | `p21_survival_cash_status=PSI/national_project_survival_guard_not_gross_margin`。draftで、資金条件・会社設立後のPL接続が未確認。 |
| Fine-Chem/オンサイトPoC/評価データ系候補 | candidate/mixed | `validation_value_source` | `onsite_poc_validation_source` | `review-only` | 利益度外視PoC/評価データをR_net粗利にしない。BRL/SRL/Survival補助へ分ける。 | `p21_validation_value_status=standard_classification_review_only`。PoC目的、価格、原価、コア開発への負荷が未確認。 |

### Validation value source split fields

| field | v6 value | guard |
|---|---|---|
| `validation_value_source_standard` | `adopt_as_comparison_layer_classification` | Fine-Chem/オンサイトPoC/顧客サンプル/10件PoCはBRL/SRL/顧客信頼/将来販売の補助sourceであり、R_net粗利へ加算しない。 |
| `validation_value_not_rnet_gross_margin` | `true` | 評価データ価値、U1短期cash、U4/U5本命Pを分ける。 |
| `research_contract_cash_parent_label` | `amd_billing_or_research_contract` | 愛媛大学/PSII契約cashをSU本体売上から恒久分離する。 |
| `required_release_condition_for_gross_margin` | `contract + invoice + payment + cost/gross_margin + core_project_impact` | p21での具体解除条件は `PoC/customer contract + invoice + payment + COGS/O&M + recurring model + U1-vs-U4/U5 lane mapping`。 |
| `future_or_draft_not_actual` | `true` | future draft series、事業計画原案、FY35計画、candidate signalを実績扱いしない。 |
| `p21_validation_value_status` | `standard_classification_review_only` | PoC/評価データsourceは標準分類には戻すが、正式R_net値にはしない。 |
| `p21_ue_source_status` | `usable_source_not_formal_rnet_value` | 485円/LはUE制約sourceとして使えるが、正式R_net値ではない。 |
| `p21_price_per_liter_source` | `485_yen_per_liter_candidate` | 計算前提・処理量・O&M・導入費・追加収益源・顧客支払意思が未接続。 |
| `p21_pricing_model_status` | `usage_based_model_review_only` | 従量課金モデルは価格体系候補であり、売上実績・粗利実績ではない。 |
| `p21_research_contract_cash_status` | `Ehime University / PSII review_only_separate_from_su_revenue` | 愛媛大学契約、納品/見積/仕様書、PSII予算1500万円をU1 PoC売上やU4/U5本命Pへ混ぜない。 |
| `p21_survival_cash_status` | `PSI/national_project_survival_guard_not_gross_margin` | PSI/国プロ接続はSurvival guardであり、R_net粗利ではない。 |
| `p21_lane_double_count_guard` | `U1_short_cash_separate_from_U4_U5_main_P` | U1の短期cash/PoCとU4/U5の本命Pを足さない。 |
| `p21_gross_margin_release_condition` | `PoC/customer contract + invoice + payment + COGS/O&M + recurring model + U1-vs-U4/U5 lane mapping` | U1 PoCをgross margin candidateから上げる最低条件。 |

### 7軸で説明できること

- PSI Step2、オンサイトPoC、TRL5到達条件、設立準備チーム、VC/DD準備は7軸で説明できる。
- 設立準備中のready状態はTRL/BRL/HRL/FRLで追える。

### PRSで追加説明できること

- U1キャッシュ層、PoC/前売上、サブスク計画をR_net候補として監視できる。
- GMO規制や顧客実装負荷による本命毀損を、S側の追加リスクとして扱える。

### 反例/危険な誤判定

- SXはまだ設立準備中で、R_net実績値を置いたふりをしない。
- U1の短期売上可能性と、U4/U5の大きなPを混ぜると、PもR_netも過大評価になりやすい。
- 愛媛大学/PSII契約cash、PSI/国プロ、Fine-Chem/オンサイトPoC、485円/L UE sourceを同じ「売上/粗利」欄へ混ぜない。p21ではU1短期cash、U4/U5本命P、研究契約cash、Survival guardを別レーンに置く。

### 次に必要な観測データ

- U1 PoCごとの契約、請求、入金、単価、粗利、COGS/O&M、導入コスト、評価データ、U4/U5への転用可否。
- サブスク/重量課金の価格受容性、処理量、継続率。
- PoC消化がコア技術/知財/規制対応へ与えるリソース影響。

### rubric化してよいかの暫定判定

`needs_more_evidence`

監視項目としては有用だが、実績前の計画値をrubric根拠にしすぎない。485円/Lは `usable source` でも正式R_net値ではなく、PoC粗利へ上げるには `p21_gross_margin_release_condition` と `p21_lane_double_count_guard` が必要。

## 10. 横断メモ

### 10.1 Finance/Cash横断分類

#### R_netに入れてよい候補

ここでの「入れてよい」は正式値ではなく、R_net欄の `source candidate` として置けるという意味。契約・請求・入金・原価が揃うまでは `review-only` を基本にする。

| PJ | source_id_or_path | classification | evidence_label | prs_use | double_count_guard |
|---|---|---|---|---|---|
| p07 LiSTie | xrl `0aa71b29-915c-43d8-86ee-060d87217f09` / knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | `bridge_business_candidate` | `bridge_business_revenue_candidate` / `nda_mou_or_pipeline_candidate` / `candidate_or_discussion_only` | `review-only` | MOU/販売先候補を受注・契約・請求・入金実績にしない。本命LISMIC装置Pとリサイクル商流を足さない。 |
| p07 LiSTie | `/Users/masa/projects/knowledge/LST.md` 年4.2-12億円計画 | `future_or_draft_plan` | `internal_roadmap_review_only` | `review-only` | internal roadmapをformal revenueにしない。契約・請求・入金・原価sourceが出るまで除外する。 |
| p07 LiSTie | knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` / `cd5e86d0-ec74-45aa-9a15-d4237e974610` | `bridge_business_cost_source` | `operating_cost_source` / `capex_fixed_cost_source` / `available_constraint_source_not_value` | `usable source` | R_net押し下げ方向のsourceとして使い、売上候補と別表示する。正式値・粗利値・支払済CAPEXにはしない。 |
| p20 CryoX | meeting `slack-C092CF84CJV-1777271916_647919` / signal `91bf2e92-2383-4563-abc3-d0e812e5916e` | `gross_margin_candidate` | `cost_structure_source` / `capex_margin_review_source` | `review-only` | 原価/CAPEX整理を正式粗利値にしない。`p20_gross_margin_release_condition` まで維持。 |
| p20 CryoX | CX利益度外視テスト販売/有料製作候補 | `validation_value_source` | `validation_value_source` | `review-only` | 評価データ獲得を粗利扱いしない。BRL/SRL/Survival補助との二重カウントを避ける。 |
| p21 SolvioraX | xrl `3fc6e490-9f4d-4d73-ac0b-a306ffb97edf` | `gross_margin_candidate` + `validation_value_source` | `poc_revenue_candidate` / `fine_chem_validation_source` | `review-only` | 10件PoC/売上実績づくりを実績扱いしない。U1短期cashとU4/U5本命Pを分ける。 |
| p21 SolvioraX | meeting `77836j7np0dovhcns78av79qdq` | `gross_margin_candidate` | `unit_economics_margin_source` | `usable source` | 処理単価485円/LはU1短期cash層のUE source。`p21_ue_source_status=usable_source_not_formal_rnet_value` とし、U4/U5本命Pへ二重カウントしない。 |
| p21 SolvioraX | meeting `6ujslfj6rjb6htj00hgp5q2srt` | `gross_margin_candidate` / `future_or_draft_plan` | `pricing_model_source` | `review-only` | 従量課金モデルを価格体系候補に留め、粗利実績にしない。 |
| p04 輝翠TECH | `KT.md` / 既存BZM runs | `su_revenue_candidate` | `mvp_revenue_candidate` | `review-only` | Adam販売を高R_netに直結せず、保守/導入負担を差し引く。 |
| p11 BWE | BWE膜外販candidate / `2026-06-02-p11-membrane-gate-source-join.md` | `su_revenue_candidate` | `bottleneck_external_sale_candidate` | `review-only` | 膜外販は重要なR_net候補だが、`supply_capacity + gross_margin_basis + main_red_impact`、さらに buyer/contract/invoice/payment/cost が揃うまで正のR_netへ昇格しない。 |
| p11 BWE | source_cache `p11_gmail_19c98f0f1d7cea62` / row `d083a88f-04d8-4d99-9f61-b1be87b586cd` + Gmail attachment `HH20260226②SRK試算_BWE財務計画_260221_y.xlsx` + `2026-06-02-p11-sumitomo-riko-transaction-proof-lookup.md` | `RED_10kWh_system_gross_margin_candidate` / `system_financial_projection` | `system_gp30_source` | `review-only` | GP30 exact + Excel projection basisは見つかったが、system / financial plan / Sumitomo Riko investment review / management meeting review context。Sumitomo Riko / 住友理工はconfirmed buyer/orderではない。膜単体外販R_net根拠として使わない。purchase order / signed contract / LOI / formal quote acceptance / invoice / payment / vendor-paid COGS / delivery acceptance 未join。 |

#### Survivalに置く候補

| PJ | source_id_or_path | classification | evidence_label | prs_use | double_count_guard |
|---|---|---|---|---|---|
| p06 CrestecBio | AMED関連 project_knowledge / monthly_reports | `survival_cash_or_grant` | `grant_or_policy_cash` / `grant_admin_burden_source` | `usable source` / `review-only` | AMED等をR_net粗利へ加算しない。売上ゼロ成立型のSurvival guardとして扱う。 |
| p07 LiSTie | xrl `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | `debt_or_equity_cash` | `debt_or_equity_cash` | `usable source` | 融資/投資を粗利にしない。`survival_cash_separate_status=grant_debt_equity_excluded_from_rnet` としてrunway sourceへ分離する。 |
| p07 LiSTie | xrl `ba404315-ee28-4f44-9156-9a2165103982` / `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | `survival_cash_or_grant` / `validation_value_source` | `grant_or_policy_cash` / `policy_demo_validation_source` | `usable source` / `review-only` | Startup Global/TYK実証を販売粗利にしない。TYKは `validation_source_not_revenue`。 |
| p20 CryoX | meeting `5jj2i4e0so5f4valupne18ujha` / signal `c80306a5-b71a-4089-9430-892127f5fff1` | `survival_cash_or_grant` / `grant_or_policy_cash` | `grant_or_policy_cash` / `consortium_policy_source` | `review-only` | コンソーシアム/助成金方針を粗利にしない。 |
| p21 SolvioraX | xrl `1388d1cc-8e18-4cb0-8561-b3ce9f3533d5` / monthly `MR_p21_202604` | `survival_cash_or_grant` / `future_or_draft_plan` | `national_project_connection_source` / `psi_policy_cash_source` | `usable source` / `review-only` | `p21_survival_cash_status=PSI/national_project_survival_guard_not_gross_margin`。国プロ/PSIを粗利加算しない。 |
| p11 BWE | source_cache `p11_gmail_1987e26bfa8c4a6f` / p11 SIP・実証draft | `grant_or_policy_cash` | `grant_or_policy_cash` / `policy_demo_source` | `usable source` / `review-only` | SIP/共同研究/政策実証をR_net粗利にしない。 |

#### PRSから除外する候補

| PJ | source_id_or_path | classification | evidence_label | prs_use | double_count_guard |
|---|---|---|---|---|---|
| p20 CryoX | `billing_cycles` `e1c409f6-18d8-4729-8452-de208955e448` / `b15713d4-2175-41c1-8c6f-0091a0aa57f2` / `c98648e2-8d16-425c-b65e-a237cc1b6d79` | `amd_billing_or_research_contract` | `amd_billing_row` | `exclude from PRS` | AMD請求予定をSU本体PLへ転記しない。 |
| p11 BWE | `billing_cycles` `720566d5-64c3-4172-a00d-3f519e53da2b` ほか p11 future rows | `amd_billing_or_research_contract` | `amd_billing_row` | `exclude from PRS` | invoice/future rowがあってもAMD請求でありSU売上ではない。 |
| p06 CrestecBio | strategy signal `20f2c8b9-563a-4504-9a8f-65b9f302c647` | `amd_billing_or_research_contract` | `amd_order_pause_source` | `exclude from PRS` | AMD発注保留をSU本体売上・粗利として扱わない。 |
| p09 JOYCLE | `billing_cycles` p09 rows | `amd_billing_or_research_contract` | `amd_billing_cash_timing_only` | `exclude from PRS` | AMD請求/cash timing補助に限定し、JOYCLE本体粗利・damage/reinvestment・PRS本体へ使わない。 |
| p03/p18 | 追加finance sourceなし | - | - | `exclude from PRS` | finance source不足を正式R_net値に変換しない。 |

#### 研究契約cashとしてreview-onlyに置く候補

| PJ | source_id_or_path | classification | evidence_label | prs_use | double_count_guard |
|---|---|---|---|---|---|
| p20 CryoX | meeting `5hv3utbm3cn8vlkk4p3th3pios` / signal `aad6dc9e-240c-42ec-9f63-27bcea20a91d` / `9b080419-4df5-4cd8-8578-cd78b8099c34` | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | NIMS契約/見積/現場活動をSU本体売上から恒久分離する。 |
| p21 SolvioraX | monthly `p21_202605` / meeting `4qqkgiatvd0p2sm4mspqr8k920_20260331T070000Z` / `43nvst4qu8ppdclf0heqd614u1` | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | 愛媛大学・PSII契約cashをU1 PoC売上やU4/U5本命Pへ混ぜない。 |
| p11 BWE | source_cache `p11_gmeet_minutes_198e5a68b13c43ea` / `p11_gmeet_minutes_1990d8b496887caa` | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | SIP収入/立替精算をSU販売粗利として扱わない。 |

#### JOYCLE current truth gap / source hygiene

| PJ | source_id_or_path | classification | evidence_label | prs_use | double_count_guard |
|---|---|---|---|---|---|
| p09 JOYCLE | `projects.status='ended'` / `projects.end_ym='202603'` | `support_end_current_truth` | `projects_ended_202603` | `review-only` | support end日確認に使い、damage理由・R_net値・JOYCLE本体粗利に転記しない。 |
| p09 JOYCLE | `project_ventures.narrative_text` / `project_ventures.master_md_text` / `jc.md` | `support_end_current_truth` | `venture_text_support_end_202603` | `review-only` | 終結側sourceとして使う。ただし口述由来の終結理由は `oral_history_pending_confirmation` のままdamage guard理由へ直接混ぜない。 |
| p09 JOYCLE | `project_ventures.amd_support_ended_at=NULL` | `source_hygiene_issue` | `project_ventures.amd_support_ended_at_null` | `review-only` | NULLを継続根拠にしない。DB/knowledgeの終了状態は一致し、正規化カラムだけgapとして扱う。 |

#### JOYCLE damage source split / v4 flags

| PJ | field_or_flag | value | prs_use | guard |
|---|---|---|---|---|
| p09 JOYCLE | `current_truth_classification` | `db_current_truth_plus_knowledge_current_with_normalized_column_gap` | `review-only` | DB/knowledge end state agree。`project_ventures.amd_support_ended_at` だけがgap。 |
| p09 JOYCLE | `support_end_reason_status` | `oral_history_pending_confirmation` | `review-only` | 2026-05-06 / 2026-05-30口述由来理由をconfirmed扱いにしない。 |
| p09 JOYCLE | `damage_guard_use` | `review-only` | `review-only` | damage guardはformal valueではなく人間レビュー用。 |
| p09 JOYCLE | `sales_before_proof_status` | `review-only` | `review-only` | JB-02/JB-02A、JOYCLE BOX、有償テスト、見学会をsales_actualにしない。 |
| p09 JOYCLE | `rd_budget_engineering_time_damage` | `review-only` | `review-only` | R&D予算/engineering time毀損はraw sourceと口述が混在し、因果/金額未確認。 |
| p09 JOYCLE | `rd_source_status` | `mixed_raw_and_oral` | `review-only` | fixed月次・MTG raw sourceは活動存在、damage因果はoral/knowledge mixedとして分ける。 |
| p09 JOYCLE | `operating_cost_source_status` | `review-only` | `review-only` | 輸送・初号機開発予算・量産計画は実費/工数にしない。 |
| p09 JOYCLE | `billing_cycles_use` | `exclude_from_prs` | `exclude from PRS` | AMD billing/cash timingのみ。JOYCLE本体PL、damage、reinvestment、PRS本体から除外。 |
| p09 JOYCLE | `do_not_use_as` | `positive_R_net, formal_damage_value, sales_actual, gross_margin_actual` | - | 契約/請求/入金/原価/本命R&D影響が揃うまで値付けしない。 |
| p09 JOYCLE | `can_feed_evidence_cards_v4` | yes | - | source splitとしてv4に戻し済み。 |
| p09 JOYCLE | `needs_masa_confirm` | yes | - | 終結理由、公開/準公開/内部限定、damage guard代表例としての扱いはまさ/BZM判断待ち。 |
| p09 JOYCLE | `needs_os_db_hygiene` | yes | - | `project_ventures.amd_support_ended_at=NULL`、future-like rows、text/column差分のOS側整理が必要。 |
| p09 JOYCLE | `needs_more_source` | yes | - | 契約/請求/入金/原価、導入/保守工数、R&D予算/人員推移、終結前後意思決定ログが未接続。 |

#### p07 bridge validation source join / v5 flags

| PJ | field | value | prs_use | guard |
|---|---|---|---|---|
| p07 LiSTie | `bridge_business_classification` | `bridge_business_candidate` | `review-only` | bridge候補を正式usable/high R_netへ昇格しない。 |
| p07 LiSTie | `bridge_revenue_stage` | `nda_mou_or_pipeline_candidate` | `review-only` | NDA/MOU・候補・協議を受注/契約/請求/入金にしない。 |
| p07 LiSTie | `bridge_customer_or_counterparty_status` | `candidate_or_discussion_only` | `review-only` | 販売先候補・roadmapをcounterparty確定にしない。 |
| p07 LiSTie | `bridge_invoice_status` | `not_currently_available` | `exclude from PRS` | AMD billingや補助金契約でSU本体請求を代替しない。 |
| p07 LiSTie | `bridge_payment_status` | `not_currently_available` | `exclude from PRS` | 融資/投資/補助金をリサイクル商流の入金にしない。 |
| p07 LiSTie | `bridge_cost_constraint_status` | `available_constraint_source_not_value` | `usable source` | `5d5525f5...` / `cd5e86d0...` はR_net押し下げ方向のsource。正式値ではない。 |
| p07 LiSTie | `bridge_gross_margin_status` | `gross_margin_not_joined` | `review-only` | コスト課題を粗利率・gross margin実績にしない。 |
| p07 LiSTie | `bridge_validation_value_status` | `validation_source_not_revenue` | `review-only` | TYK実証を販売実績にしない。 |
| p07 LiSTie | `main_lismic_impact_status` | `requires_masa_or_bzm_review` | `review-only` | bridgeが本命LISMICを支える/毀損する判断をsourceだけで確定しない。 |
| p07 LiSTie | `survival_cash_separate_status` | `grant_debt_equity_excluded_from_rnet` | `exclude from PRS gross margin` | grant/debt/equityをgross marginへ混ぜない。 |
| p07 LiSTie | `review_only_release_condition` | `contract + invoice + payment + cost/gross_margin + main_lismic_impact joined by source` | gate | 5点セットが揃うまでreview-only。 |
| p07 LiSTie | `double_count_guard` | `do_not_add_recycling_bridge_to_lismic_P; do_not_treat_NDA_MOU_as_order; do_not_mix_grant_debt_equity_into_gross_margin` | guard | リサイクル商流、本命P、NDA/MOU、grant/debt/equityを混ぜない。 |

#### p20-p21 validation value source split / v6 flags

| PJ | field | value | prs_use | guard |
|---|---|---|---|---|
| common | `validation_value_source_standard` | `adopt_as_comparison_layer_classification` | `review-only` | 利益度外視PoC/テスト販売/有料製作を標準分類へ戻すが、正式R_net値にはしない。 |
| common | `validation_value_not_rnet_gross_margin` | `true` | guard | 評価データ価値を粗利へ加算しない。 |
| common | `research_contract_cash_parent_label` | `amd_billing_or_research_contract` | guard | NIMS/愛媛大学/PSIIをSU本体売上から分離する。 |
| common | `required_release_condition_for_gross_margin` | `contract + invoice + payment + cost/gross_margin + core_project_impact` | gate | 契約・請求・入金・原価/粗利・本命PJ影響が揃うまで、gross margin candidateはreview-only。 |
| common | `future_or_draft_not_actual` | `true` | guard | future draft / candidate / internal roadmapを実績扱いしない。 |
| p20 CryoX | `p20_validation_value_status` | `standard_classification_review_only` | `review-only` | TES/ADR/coolingテスト販売・有料製作を評価データ/顧客信頼sourceに置く。 |
| p20 CryoX | `p20_research_contract_cash_status` | `review_only_separate_from_su_revenue` | `review-only` | NIMS契約/見積/現場活動をSU本体売上・粗利にしない。 |
| p20 CryoX | `p20_amd_billing_use` | `exclude_from_prs_cash_timing_only` | `exclude from PRS` | AMD billing rowをcash timing補助以外に使わない。 |
| p20 CryoX | `p20_survival_cash_status` | `grant_consortium_policy_review_only` | `review-only` | 助成金/コンソーシアム方針はSurvival guardであり、gross marginではない。 |
| p20 CryoX | `p20_gross_margin_release_condition` | `TES/ADR/cooling test-sale contract + invoice + payment + COGS/CAPEX + personnel burden + validation output` | gate | 5+1点が揃うまで正式R_net値へ上げない。 |
| p21 SolvioraX | `p21_validation_value_status` | `standard_classification_review_only` | `review-only` | Fine-Chem/オンサイトPoC/顧客サンプル/10件PoCを評価データsourceに置く。 |
| p21 SolvioraX | `p21_ue_source_status` | `usable_source_not_formal_rnet_value` | `usable source` | 485円/LはUE sourceであって正式R_net値ではない。 |
| p21 SolvioraX | `p21_price_per_liter_source` | `485_yen_per_liter_candidate` | `usable source` | 計算前提・処理量・COGS/O&M・導入費・継続性が未接続。 |
| p21 SolvioraX | `p21_pricing_model_status` | `usage_based_model_review_only` | `review-only` | 従量課金モデルは価格体系候補で、売上/粗利実績ではない。 |
| p21 SolvioraX | `p21_research_contract_cash_status` | `Ehime University / PSII review_only_separate_from_su_revenue` | `review-only` | 愛媛大学/PSII契約cashをU1 PoC売上やU4/U5本命Pへ混ぜない。 |
| p21 SolvioraX | `p21_survival_cash_status` | `PSI/national_project_survival_guard_not_gross_margin` | `review-only` / `usable source` | PSI/国プロ接続をSurvival guardへ置き、gross marginへ加算しない。 |
| p21 SolvioraX | `p21_lane_double_count_guard` | `U1_short_cash_separate_from_U4_U5_main_P` | guard | U1短期cashとU4/U5本命Pを足さない。 |
| p21 SolvioraX | `p21_gross_margin_release_condition` | `PoC/customer contract + invoice + payment + COGS/O&M + recurring model + U1-vs-U4/U5 lane mapping` | gate | U1 PoCをgross margin candidateから上げる最低条件。 |

#### p11 GP30 lane split / v10 flags

| PJ | field | value | prs_use | guard |
|---|---|---|---|---|
| p11 BWE | `p11_membrane_external_sale_status` | `bottleneck_external_sale_candidate` | `review-only` | 膜外販は候補として残すが、正式R_net値・売上実績・粗利実績にはしない。 |
| p11 BWE | `p11_membrane_prs_use` | `review-only` | `review-only` | review解除条件が揃うまでPRS comparison layer内の観測対象に留める。 |
| p11 BWE | `p11_membrane_release_condition` | `supply_capacity + gross_margin_basis + main_red_impact` | gate | 供給余力、粗利/COGS、本命RED影響の3条件を必須にする。 |
| p11 BWE | `p11_membrane_supply_capacity_status` | `blocked_missing_supply_allocation` | `review-only` | RED本命需要と外販余力の割当sourceが未join。 |
| p11 BWE | `p11_gp30_raw_source_status` | `found_exact` | `review-only` | source_cache exact rowは見つかったが、正式値ではない。 |
| p11 BWE | `p11_gp30_raw_source_cache_id` | `p11_gmail_19c98f0f1d7cea62` | `review-only` | traceability用source id。 |
| p11 BWE | `p11_gp30_raw_source_row_id` | `d083a88f-04d8-4d99-9f61-b1be87b586cd` | `review-only` | traceability用row id。 |
| p11 BWE | `p11_gp30_derived_knowledge_ids` | `904dbf36-5194-4df2-a860-d23810be0054`; `239c5076-c1b5-4455-b6d1-34434bad6fa1` | `review-only` | derived knowledgeは10kWh system解釈補助で、計算根拠や取引joinではない。 |
| p11 BWE | `p11_gp30_classification` | `RED_10kWh_system_gross_margin_candidate` | `review-only` | raw textは10kWh systemのGP30で、膜単体外販ではない。 |
| p11 BWE | `p11_gp30_not_membrane_standalone_external_sale` | `true` | guard | 膜外販R_net根拠への誤転用を防ぐ。 |
| p11 BWE | `p11_gp30_prs_use` | `review-only` | `review-only` | comparison-layer sourceには置くが正式scoreへは使わない。 |
| p11 BWE | `p11_gp30_attachment_status` | `gmail_attachment_found_not_source_cache_metadata` | `review-only` | 添付ExcelはGmail threadで確認済みだが、source_cache metadataには添付情報がない。 |
| p11 BWE | `p11_gp30_attachment_filename` | `HH20260226②SRK試算_BWE財務計画_260221_y.xlsx` | `review-only` | Excel projection basisのtraceability filename。 |
| p11 BWE | `p11_gp30_drive_file_id_status` | `not_joined` | gate | exact Drive file idは未join。 |
| p11 BWE | `p11_gp30_missing_basis` | `contract + invoice + payment + delivery_acceptance + vendor_paid_COGS + QA/logistics/warranty/inventory/yield` | gate | Excel projection basisは見つかったが、取引証憑・検収・支払済原価・運用品質系は未join。 |
| p11 BWE | `p11_sumitomo_riko_search_status` | `completed_read_only` | `review-only` | Sumitomo Riko / 住友理工 transaction proof lookupはread-only完了。confirmed buyer / order / contract / LOI / quote acceptance / invoice / payment / delivery acceptance は未発見。 |
| p11 BWE | `p11_sumitomo_riko_context` | `finance_plan_investment_review_and_management_meeting_review` | `review-only` | finance plan・出資検討・経営会議review文脈として強いが、system sale transaction proofではない。 |
| p11 BWE | `p11_sumitomo_riko_counterparty_status` | `review_counterparty_not_confirmed_buyer` | `review-only` | review counterpartyであってconfirmed buyer/order sourceではない。 |
| p11 BWE | `p11_membrane_gp30_status` | `not_supported_by_found_gp30_source` | `review-only` | 見つかったGP30 sourceは膜単体外販ではない。 |
| p11 BWE | `p11_system_gp30_status` | `found_exact_with_excel_basis_but_no_transaction_join` | `review-only` | 10kWh/10kW system GP30はGmail thread + 添付Excelまでjoin。契約・請求・入金・検収・支払済原価は未join。 |
| p11 BWE | `p11_system_gp30_prs_use` | `review-only` | `review-only` | system laneも正式R_net値にはしない。 |
| p11 BWE | `p11_system_scope_status` | `10kW_system_basis_found` | `review-only` | Excelに10kW/100kW system basisあり。 |
| p11 BWE | `p11_system_price_basis_status` | `found_in_excel_projection` | `review-only` | 売価basisはprojection。formal quote/orderではない。 |
| p11 BWE | `p11_system_cogs_basis_status` | `projection_only_not_cogs_proof` | `review-only` | 原価basisはprojection。vendor invoice/paid cost proofではない。 |
| p11 BWE | `p11_system_transaction_join_status` | `not_joined` | gate | signed buyer/order, contract, invoice, paymentは未join。 |
| p11 BWE | `p11_system_management_review_status` | `pending_or_no_result_source_found` | `review-only` | 経営会議review予定/文脈はあるが、承認結果sourceは未発見。 |
| p11 BWE | `p11_system_contract_status` | `not_joined` | blocked | 契約・注文・LOIに未join。 |
| p11 BWE | `p11_system_order_status` | `not_joined` | blocked | purchase order / accepted quote / signed orderは未join。 |
| p11 BWE | `p11_system_invoice_status` | `not_joined` | blocked | BWE system sale invoiceに未join。 |
| p11 BWE | `p11_system_payment_status` | `not_joined` | blocked | BWE system sale paymentに未join。 |
| p11 BWE | `p11_system_delivery_acceptance_status` | `not_joined` | blocked | 納品検収に未join。 |
| p11 BWE | `p11_system_vendor_paid_cogs_status` | `not_joined` | blocked | vendor-paid COGS / supplier invoice / paid cost proofは未join。 |
| p11 BWE | `p11_system_cogs_proof_status` | `projection_only_not_vendor_invoice_or_paid_cost` | blocked | 支払済原価証憑ではない。 |
| p11 BWE | `p11_system_qa_logistics_warranty_inventory_yield_status` | `not_joined` | blocked | QA/物流/保証/在庫/歩留まりに未join。 |
| p11 BWE | `p11_gp30_thread_context` | `business_plan_and_investment_review` | `review-only` | business plan / investment review context。 |
| p11 BWE | `p11_system_counterparty_status` | `review_counterparty_not_confirmed_buyer` | `review-only` | Sumitomo Rikoはreview counterpartyで、confirmed buyerではない。 |
| p11 BWE | `p11_system_membrane_double_count_guard` | `do_not_use_system_gp30_as_membrane_external_sale_gross_margin` | guard | system GP30を膜外販gross marginに転用しない。 |
| p11 BWE | `p11_membrane_cogs_status` | `not_currently_available` | `exclude from PRS` | 原価表、製造/外注、QA、物流、保証、人件費、歩留まりが未join。 |
| p11 BWE | `p11_membrane_external_buyer_status` | `not_joined` | `review-only` | 外販先候補をbuyer確定にしない。 |
| p11 BWE | `p11_membrane_contract_status` | `not_joined` | `review-only` | 契約/注文/検収条件が未join。 |
| p11 BWE | `p11_membrane_invoice_status` | `not_joined` | `exclude from PRS` | 外販請求書が未join。AMD billingで代替しない。 |
| p11 BWE | `p11_membrane_payment_status` | `not_joined` | `exclude from PRS` | 外販入金確認が未join。SIP支払い/立替精算で代替しない。 |
| p11 BWE | `p11_membrane_main_red_impact_status` | `requires_masa_or_bzm_review` | `review-only` | 膜外販がRED本命を支えるか毀損するかは、まさ/BZM review required。 |
| p11 BWE | `p11_membrane_double_count_guard` | `do_not_mix_sip_research_contract_amd_billing_policy_demo_into_su_membrane_gross_margin` | guard | SIP/共同研究cash、政策実証、AMD billingを膜外販gross marginへ混ぜない。 |
| p11 BWE | `p11_research_contract_cash_status` | `sip_joint_research_review_only_separate_from_su_revenue` | `review-only` | SIP/共同研究cashをSU本体膜外販収益から恒久分離する。 |
| p11 BWE | `p11_survival_cash_status` | `sip_policy_demo_survival_guard_not_gross_margin` | `usable source` / `review-only` | SIP/東京都実証/政策実証をSurvival guardへ置き、gross marginへ加算しない。 |
| p11 BWE | `p11_amd_billing_use` | `exclude_from_prs_cash_timing_only` | `exclude from PRS` | AMD billingはcash timing補助のみ。 |
| p11 BWE | `p11_future_plan_status` | `review_only_not_actual` | `review-only` | future/draft/roadmapを契約・請求・入金・粗利実績にしない。 |
| p11 BWE | `p11_do_not_use_as` | `positive_R_net, formal_R_net_value, sales_actual, gross_margin_actual` | guard | buyer/contract/invoice/payment/costと3条件が揃うまで値付け禁止。 |

### 10.2 事例型メモ

| 型 | 該当PJ | PRSで見る意味 | ガード |
|---|---|---|---|
| 高P・低/未確定R_net | ティエム、BWE | 本命の天井は大きいが生存設計が弱い。BWE膜外販は `bottleneck_external_sale_candidate` だが `review-only`。p11 GP30 exact + Excel projection basisは見つかったが10kWh/10kW system laneで、膜外販laneとは別。住友理工はfinance plan / investment review / management meeting review counterparty止まりで、confirmed buyer/orderではない。 | 7軸のGO/NO_GOを上書きしない。BWEは `supply_capacity + gross_margin_basis + main_red_impact` と buyer/contract/invoice/payment/cost が揃うまでR_net昇格禁止。10kWh/10kW system GP30もcontract/order/invoice/payment/vendor-paid COGS/delivery acceptance/QA/logistics/warranty/inventory/yieldが揃うまで正式R_netへ使わない。 |
| 本命前つなぎ自走 | LiSTie、CryoX、ティエム反実仮想 | 本命前の粗利でburnを支える | つなぎが本命を遅らせないかを見る |
| 本命前倒し収益 | 輝翠TECH、SolvioraX計画 | 本命MVP/PoC/サブスクを早期収益化する | 導入/保守/個別対応コストを差し引く |
| damage guard / 本命毀損候補 | JOYCLE | 目先収益が本命R&Dを毀損する可能性をreview-onlyで見る | 正の売上候補と正のR_netを混同しない。口述由来理由は `oral_history_pending_confirmation` のまま正式damage理由にしない |
| 低P/UE不成立 | Yellow Duck | 技術PoCがあっても事業の筋が悪い | BRL不足だけに潰さない |
| R_netゼロでも成立 | CrestecBio | 創薬は売上ゼロ期間を外部資金/薬事/EXITで耐える | R_net低値でNO_GOにしない |

## 11. 司令塔判断事項

1. `research_contract_cash` は `amd_billing_or_research_contract` の下位ラベルとして採用済み前提でv7へ継続反映した。今後のreviewでは、p20 NIMS / p21 愛媛大学・PSII / p11 SIPをSU本体売上から分離する運用を継続するか確認する。
2. `billing_cycles` は原則 `exclude from PRS` とした。cash timing補助にだけ `review-only` を許す運用でよいか、BZM司令塔レビューで再確認する。
3. p21の処理単価485円/Lは `usable source` としてR_net欄へ置いたが、正式R_net値ではない。U1短期cash層とU4/U5本命Pの二重カウント防止ラベルを必須にする。
4. p07 bridge businessは、v5では `bridge_business_candidate` / `review-only` 維持でよいか。解除条件は `contract + invoice + payment + cost/gross_margin + main_lismic_impact joined by source` とした。
5. p09 JOYCLEはv4で `support_end_status=ended_current_truth_candidate` / `support_end_date=2026-03` / `support_end_db_gap=project_ventures.amd_support_ended_at_null` / `current_truth_classification=db_current_truth_plus_knowledge_current_with_normalized_column_gap` / `damage_guard_use=review-only` として反映した。あわせて `project_ventures.amd_support_ended_at` 補正をOS/DB workerへ切り出すか。
6. p09の終結理由のうち、口述由来部分を `support_end_reason_status=oral_history_pending_confirmation` として追加source待ちにする運用でよいか。
7. p09の `sales_before_proof_status=review-only`、`rd_budget_engineering_time_damage=review-only`、`rd_source_status=mixed_raw_and_oral`、`operating_cost_source_status=review-only`、`billing_cycles_use=exclude_from_prs` をv4 current truthとして採用するか。
8. p09の `needs_masa_confirm` / `needs_os_db_hygiene` / `needs_more_source` を、BZM司令塔からOS司令塔または次workerへ切るか。
9. p03/p04/p18は今回のfinance分類で追加sourceが薄い。次に進めるなら public/knowledge research、UE/LCOE research に分ける。
10. p07の `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` と `cd5e86d0-ec74-45aa-9a15-d4237e974610` をR_net押し下げ方向の `usable source` として置く運用でよいか。ただし正式値ではない。
11. `/Users/masa/projects/knowledge/LST.md` の年4.2-12億円計画は internal roadmap / review-only として置き、formal revenueから除外する運用でよいか。
12. p20/p21の `validation_value_source_standard=adopt_as_comparison_layer_classification` を標準分類として採用し、`validation_value_not_rnet_gross_margin=true` を固定する運用でよいか。
13. p20/p21の gross margin candidate 解除条件を、共通 `contract + invoice + payment + cost/gross_margin + core_project_impact` とし、p20は `TES/ADR/cooling test-sale contract + invoice + payment + COGS/CAPEX + personnel burden + validation output`、p21は `PoC/customer contract + invoice + payment + COGS/O&M + recurring model + U1-vs-U4/U5 lane mapping` でよいか。
14. p21の処理単価485円/Lは `p21_ue_source_status=usable_source_not_formal_rnet_value` / `p21_price_per_liter_source=485_yen_per_liter_candidate` として置くが、正式R_net値にはしない運用でよいか。
15. p21の `p21_lane_double_count_guard=U1_short_cash_separate_from_U4_U5_main_P` を必須fieldとして固定するか。
16. p11 membrane gate source joinはBZM採用。p11膜外販を `p11_membrane_external_sale_status=bottleneck_external_sale_candidate` / `p11_membrane_prs_use=review-only` としてv8 current truthへ継承した。このままreview-only固定でよいか。
17. p11膜外販のreview解除条件を `supply_capacity + gross_margin_basis + main_red_impact` の3条件に固定し、additional gateとして external buyer / contract / invoice / payment / cost を必須扱いにするか。
18. p11 SIP/共同研究cashは `research_contract_cash`、SIP/東京都実証は `survival_cash_or_grant`、AMD billingは `exclude from PRS` として恒久分離する運用でよいか。
19. p11 GP30 raw source lookupはBZM採用。`p11_gp30_raw_source_status=found_exact` として戻し、source_cache `p11_gmail_19c98f0f1d7cea62` / row `d083a88f-04d8-4d99-9f61-b1be87b586cd` をtraceability sourceにする運用でよいか。
20. 見つかったGP30 raw sourceは10kWh system laneなので、`p11_gp30_classification=RED_10kWh_system_gross_margin_candidate`、`p11_gp30_not_membrane_standalone_external_sale=true` として膜外販laneから分離する運用でよいか。
21. p11 GP30を `p11_membrane_gp30_status=not_supported_by_found_gp30_source` と `p11_system_gp30_status=found_exact_with_excel_basis_but_no_transaction_join` に分け、system側はExcel projection basisを採用しつつ、contract / invoice / payment / vendor-paid COGS / delivery acceptance 未joinの `review-only` に留める運用でよいか。
22. p11膜外販の本命RED影響は、sourceだけで決めず `p11_membrane_main_red_impact_status=requires_masa_or_bzm_review` として、まさ/BZM review requiredにする運用でよいか。
23. Sumitomo Rikoは `review_counterparty_not_confirmed_buyer` とし、business plan / investment review contextのreview counterpartyであって、confirmed buyer / order sourceではない扱いでよいか。
24. `p11_system_cogs_basis_status=projection_only_not_cogs_proof` を採用し、Excel原価projectionをvendor invoice / paid cost proofへ昇格しない運用でよいか。
25. `p11 Sumitomo Riko transaction proof lookup` は採用し、`p11_sumitomo_riko_context=finance_plan_investment_review_and_management_meeting_review`、`p11_sumitomo_riko_counterparty_status=review_counterparty_not_confirmed_buyer`、transaction / contract / order / invoice / payment / delivery acceptance / vendor-paid COGS / QA・物流・保証・在庫・歩留まり未joinをv10 current truthとして扱うか。
26. R_net rubric draftへ進む場合も、0-9値表、DB列、正式score、過去score再計算は引き続き行わない。

## 12. 次アクション

1. BZM司令塔が本v10カードをレビューし、finance/cash分類、JOYCLE damage source split、p07 bridge validation source join、p20-p21 validation value source split、p11 membrane gate source join、p11 system GP30 projection refresh、p11 Sumitomo Riko transaction proof lookup の `classification` / `evidence_label` / `prs_use` / `double_count_guard` / v10 flags を採用・差し戻し判定する。
2. OS司令塔へ渡すなら、p09の `project_ventures.amd_support_ended_at=NULL` を source hygiene issue としてDB補正worker化する。
3. p09はsupport end日と終結理由を分け、口述由来理由は `oral_history_pending_confirmation` として追加source確認またはまさ/BZM判断待ちにする。
4. p09のJB-02/JB-02A sales-before-proof、R&D budget / engineering time damage、operating cost sourceを追加調査する場合は、契約/請求/入金/原価/本命R&D影響、R&D予算/人員推移、導入/保守/輸送工数を分けてsource化する。
5. p21は処理単価485円/L・従量課金モデルの出典/計算前提、U1とU4/U5分離、PoC/customer contract + invoice + payment + COGS/O&M + recurring model を追加確認する。
6. p20はNIMS研究契約cash、AMD billing、利益度外視テスト販売/評価データ価値、TES/ADR/cooling test-sale contract + invoice + payment + COGS/CAPEX + personnel burden + validation output を分ける。
7. p07はリサイクル商流の契約/請求/入金/原価・粗利/本命LISMIC影響をjoinする。DB/freee/契約docsを読む場合もread-onlyで、NDA/MOU・販売先候補・TYK実証・年4.2-12億円計画をformal revenueへ昇格しない。
8. p11膜外販は膜SKU、単価、COGS、外販buyer、contract、invoice、payment、RED本命影響レビューをsource単位でjoinする。揃うまで `p11_do_not_use_as=positive_R_net, formal_R_net_value, sales_actual, gross_margin_actual` を維持する。
9. p11 10kWh/10kW system GP30は、添付Excel projection basisをsystem laneに保持しつつ、contract、order、invoice、payment、delivery acceptance、vendor-paid COGS、QA/logistics/warranty/inventory/yieldを別laneでjoinする。膜外販laneの欠損補完には使わない。
10. 住友理工の経営会議review結果を追う場合は、2026-03-13前後のmanagement meeting resultだけを別workerでread-only確認する。結果sourceが出るまではbuyer/orderへ昇格しない。
11. p06/p11はSurvival guard中心で、AMED/SIP/政策実証をR_net粗利に混ぜない運用を維持する。

## 13. 自己レビュー

- P/R_netの正式rubricは作っていない。
- 0-9 score表は作っていない。
- 各PJでP仮説、R_netの3項分解、7軸で説明できること、PRSで追加説明できること、反例/危険な誤判定、次に必要な観測データ、rubric化暫定判定を入れた。
- 各PJに `Finance/Cash source classification` を追加した。
- 各sourceに、できる範囲で `source_id_or_path` / `source_status` / `classification` / `evidence_label` / `prs_use` / `double_count_guard` / `why_not_formal_score_yet` を付けた。
- `prs_use` は `usable source` / `review-only` / `exclude from PRS` の3値で統一した。
- `research_contract_cash` を `amd_billing_or_research_contract` の下位ラベルとして反映し、p20 NIMS / p21 愛媛大学・PSII / p11 SIPをSU本体売上から分離した。
- `billing_cycles` は原則 `exclude from PRS` とし、R_net粗利に混ぜていない。
- p09 JOYCLEの `billing_cycles` はAMD請求/cash timing補助に限定し、PRS本体・JOYCLE本体粗利・damage/reinvestmentには使わないと明記した。
- p20/p21の利益度外視PoC・テスト販売・有料製作は `validation_value_source_standard=adopt_as_comparison_layer_classification` / `validation_value_not_rnet_gross_margin=true` として戻した。
- p20は `p20_validation_value_status=standard_classification_review_only`、`p20_research_contract_cash_status=review_only_separate_from_su_revenue`、`p20_amd_billing_use=exclude_from_prs_cash_timing_only`、`p20_survival_cash_status=grant_consortium_policy_review_only`、`p20_gross_margin_release_condition=TES/ADR/cooling test-sale contract + invoice + payment + COGS/CAPEX + personnel burden + validation output` を戻した。
- p21の処理単価485円/Lと従量課金モデルは `p21_ue_source_status=usable_source_not_formal_rnet_value`、`p21_price_per_liter_source=485_yen_per_liter_candidate`、`p21_pricing_model_status=usage_based_model_review_only` として置き、U1短期cashとU4/U5本命Pの二重カウント防止を明記した。
- p21は `p21_validation_value_status=standard_classification_review_only`、`p21_research_contract_cash_status=Ehime University / PSII review_only_separate_from_su_revenue`、`p21_survival_cash_status=PSI/national_project_survival_guard_not_gross_margin`、`p21_lane_double_count_guard=U1_short_cash_separate_from_U4_U5_main_P`、`p21_gross_margin_release_condition=PoC/customer contract + invoice + payment + COGS/O&M + recurring model + U1-vs-U4/U5 lane mapping` を戻した。
- p11 membrane gate source joinをBZM採用判断として継承し、`p11_membrane_external_sale_status=bottleneck_external_sale_candidate`、`p11_membrane_prs_use=review-only`、`p11_membrane_release_condition=supply_capacity + gross_margin_basis + main_red_impact` を明記した。
- p11 GP30 raw source lookupをBZM採用判断として戻し、`p11_gp30_raw_source_status=found_exact`、`p11_gp30_raw_source_cache_id=p11_gmail_19c98f0f1d7cea62`、`p11_gp30_raw_source_row_id=d083a88f-04d8-4d99-9f61-b1be87b586cd`、`p11_gp30_derived_knowledge_ids=904dbf36-5194-4df2-a860-d23810be0054 / 239c5076-c1b5-4455-b6d1-34434bad6fa1` を明記した。
- p11 GP30は `p11_gp30_classification=RED_10kWh_system_gross_margin_candidate`、`p11_gp30_not_membrane_standalone_external_sale=true`、`p11_gp30_prs_use=review-only`、`p11_gp30_missing_basis=price + COGS + contract + invoice + payment + system_scope` として、膜外販laneから分離した。
- p11は `p11_membrane_supply_capacity_status=blocked_missing_supply_allocation`、`p11_membrane_gp30_status=not_supported_by_found_gp30_source`、`p11_system_gp30_status=found_exact_with_excel_basis_but_no_transaction_join`、`p11_system_gp30_prs_use=review-only`、`p11_gp30_attachment_status=gmail_attachment_found_not_source_cache_metadata`、`p11_gp30_attachment_filename=HH20260226②SRK試算_BWE財務計画_260221_y.xlsx`、`p11_gp30_drive_file_id_status=not_joined`、`p11_system_scope_status=10kW_system_basis_found`、`p11_system_price_basis_status=found_in_excel_projection`、`p11_system_cogs_basis_status=projection_only_not_cogs_proof` を戻した。
- p11 Sumitomo Riko transaction proof lookupをBZM採用判断として戻し、`p11_sumitomo_riko_search_status=completed_read_only`、`p11_sumitomo_riko_context=finance_plan_investment_review_and_management_meeting_review`、`p11_sumitomo_riko_counterparty_status=review_counterparty_not_confirmed_buyer` を明記した。
- p11は `p11_system_transaction_join_status=not_joined`、`p11_system_management_review_status=pending_or_no_result_source_found`、`p11_system_contract_status=not_joined`、`p11_system_order_status=not_joined`、`p11_system_invoice_status=not_joined`、`p11_system_payment_status=not_joined`、`p11_system_delivery_acceptance_status=not_joined`、`p11_system_vendor_paid_cogs_status=not_joined`、`p11_system_cogs_proof_status=projection_only_not_vendor_invoice_or_paid_cost`、`p11_system_qa_logistics_warranty_inventory_yield_status=not_joined`、`p11_gp30_thread_context=business_plan_and_investment_review`、`p11_system_counterparty_status=review_counterparty_not_confirmed_buyer`、`p11_system_membrane_double_count_guard=do_not_use_system_gp30_as_membrane_external_sale_gross_margin` を戻した。
- p11 billing_cyclesはAMD/BWE billingであり、BWE→Sumitomo Riko system sale invoice/paymentではないと明記した。
- p11は `p11_membrane_cogs_status=not_currently_available`、`p11_membrane_external_buyer_status=not_joined`、`p11_membrane_contract_status=not_joined`、`p11_membrane_invoice_status=not_joined`、`p11_membrane_payment_status=not_joined`、`p11_membrane_main_red_impact_status=requires_masa_or_bzm_review` を維持した。
- p11は `p11_membrane_double_count_guard=do_not_mix_sip_research_contract_amd_billing_policy_demo_into_su_membrane_gross_margin`、`p11_research_contract_cash_status=sip_joint_research_review_only_separate_from_su_revenue`、`p11_survival_cash_status=sip_policy_demo_survival_guard_not_gross_margin`、`p11_amd_billing_use=exclude_from_prs_cash_timing_only`、`p11_future_plan_status=review_only_not_actual`、`p11_do_not_use_as=positive_R_net, formal_R_net_value, sales_actual, gross_margin_actual` を戻した。
- 9PJ横断で、R_netに入れてよい候補、Survivalに置く候補、PRSから除外する候補、研究契約cashとしてreview-onlyに置く候補、JOYCLE current truth gap / source hygiene issue、JOYCLE damage source split / v4 flags、p07 bridge validation source join / v5 flags、p20-p21 validation value source split / v6 flagsを一覧化した。
- 9PJ横断summaryへ、p11 system GP30はExcel projection basisが見つかったが、contract/invoice/payment/vendor-paid COGS/delivery acceptanceが未joinなので `review-only`、かつ膜単体外販R_net根拠として使わない、と追記した。
- 9PJ横断summaryへ、住友理工はfinance plan / investment review / management meeting review counterparty止まりで、confirmed buyer/orderではない、と追記した。
- 9PJ横断summaryへ、p11膜外販は候補だがreview-only、3条件と buyer/contract/invoice/payment/cost が揃うまでR_net昇格禁止、と追記した。
- CTBをR_net低値でNO_GOにしていない。
- JOYCLEの本命毀損を `damage guard` / 本命毀損候補として明示し、正式用語はその表現に統一した。
- JOYCLEは `support_end_status=ended_current_truth_candidate`、`support_end_date=2026-03`、`support_end_db_gap=project_ventures.amd_support_ended_at_null`、`current_truth_classification=db_current_truth_plus_knowledge_current_with_normalized_column_gap`、`support_end_reason_status=oral_history_pending_confirmation`、`damage_guard_use=review-only` として戻した。
- JOYCLEは `sales_before_proof_status=review-only`、`rd_budget_engineering_time_damage=review-only`、`rd_source_status=mixed_raw_and_oral`、`operating_cost_source_status=review-only`、`billing_cycles_use=exclude_from_prs`、`do_not_use_as=positive_R_net, formal_damage_value, sales_actual, gross_margin_actual` として戻した。
- JOYCLEの分類は `db_current_truth_plus_knowledge_current_with_normalized_column_gap`。DB/knowledgeの終了状態は一致し、`project_ventures.amd_support_ended_at` 正規化カラムだけがgapであると明記した。
- `projects.status='ended'` / `projects.end_ym='202603'`、`project_ventures.narrative_text`、`project_ventures.master_md_text` は終結側sourceとして扱った。
- 終結理由の口述由来部分は `oral_history_pending_confirmation` として扱い、confirmed扱いやformal damage reasonにはしていない。
- `can_feed_evidence_cards_v4` / `needs_masa_confirm` / `needs_os_db_hygiene` / `needs_more_source` をp09欄と横断summaryに反映した。
- p07は `bridge_business_classification=bridge_business_candidate`、`bridge_revenue_stage=nda_mou_or_pipeline_candidate`、`bridge_customer_or_counterparty_status=candidate_or_discussion_only`、`bridge_invoice_status=not_currently_available`、`bridge_payment_status=not_currently_available`、`bridge_cost_constraint_status=available_constraint_source_not_value`、`bridge_gross_margin_status=gross_margin_not_joined`、`bridge_validation_value_status=validation_source_not_revenue`、`main_lismic_impact_status=requires_masa_or_bzm_review`、`survival_cash_separate_status=grant_debt_equity_excluded_from_rnet` として戻した。
- p07の `review_only_release_condition=contract + invoice + payment + cost/gross_margin + main_lismic_impact joined by source` と、`double_count_guard=do_not_add_recycling_bridge_to_lismic_P; do_not_treat_NDA_MOU_as_order; do_not_mix_grant_debt_equity_into_gross_margin` を明記した。
- p07の `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` と `cd5e86d0-ec74-45aa-9a15-d4237e974610` はR_net押し下げ方向の `usable source` として戻した。ただし正式値・粗利値・支払済CAPEX扱いにはしていない。
- `/Users/masa/projects/knowledge/LST.md` の年4.2-12億円計画は internal roadmap / review-only とし、formal revenueから除外した。
- 確認済み根拠、仮説、未確認、反例を見出し単位で分け、同じ文で混ぜないようにした。
- DB write、DDL、migration、extractor実装、コード実装、deploy、0-9 score表作成、R_net値付け、正式rubric確定、現行7軸AMD Score置換、過去score再計算は行っていない。
