# p11 membrane gate source join

Date: 2026-06-02
Worker: p11 membrane gate source join
Scope: PRS comparison layer source split for p11 Blue Water Energy.

## 0. Summary

p11 BWEの膜外販は、現時点では `bottleneck_external_sale_candidate` / `review-only` に留める。

理由は、膜外販のGP30%候補はsourceとして存在するが、まだ次の3条件がsource単位でjoinできていないため。

1. supply capacity / membrane availability
2. gross margin / COGS / GP30% basis
3. main RED impact / resource distraction

追加で、external buyer / contract / invoice / payment / cost が揃うまで、膜外販を正のR_net、formal gross margin、formal revenue、PRS正式scoreへ昇格しない。

SIP、共同研究cash、立替精算、AMD billing、政策実証は、BWE本体の膜外販売粗利とは分離する。これらは `amd_billing_or_research_contract` または `survival_cash_or_grant` として扱い、R_net gross marginへ加算しない。

## 1. Sources read

- `/Users/masa/projects/AGENTS.common.md`
- `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`
- `pwa/AGENTS.md`, `pwa/CLAUDE.md`, `pwa/HANDOFF_pwa_rebuild.md`
- `pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v6.md`
- `pwa/bzm/runs/2026-06-02-prs-classification-adoption-patch.md`
- `pwa/bzm/runs/2026-06-02-prs-bzm-judgement-brief.md`
- `pwa/bzm/runs/2026-06-02-prs-bridge-validation-source-pack.md`
- `pwa/bzm/runs/2026-06-02-prs-finance-cash-source-pack.md`
- `pwa/bzm/runs/2026-06-02-prs-billing-vs-su-revenue-join-map.md`
- `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `/Users/masa/projects/knowledge/BWE.md` read-only
- `git status -sb`

## 2. p11 source inventory by purpose

| purpose | source_id_or_path | source_status | evidence summary | prs_use | split / guard |
|---|---|---|---|---|---|
| `bottleneck_external_sale_candidate` | `2026-06-01-prs-l2-source-inventory.md` / BWE GP30%メモ | candidate | BWEに膜外販GP30%メモがあると整理済み。膜単体外販が初期自走性候補になりうる。 | `review-only` | 元row、膜単価、COGS、供給余力、外販先、本命RED影響が未join。正のR_netへ昇格しない。 |
| `bottleneck_external_sale_candidate` | `/Users/masa/projects/knowledge/BWE.md` 「ライスワーク候補」 | internal knowledge / oral-current | イオン交換膜を量産して、電気透析用途やアカデミア向けに膜単体外販できる可能性がある。ただし膜は技術上の最大ボトルネック。 | `review-only` | 膜外販はつなぎ収益候補であると同時に本命RED装置の律速資源を食う可能性がある。 |
| `gross_margin_candidate` | BWE GP30%メモ | candidate | GP30%という粗利候補の存在。 | `review-only` | GP30%の計算根拠、膜原価、製造歩留まり、販売単価、外注費、在庫/検査/保証費が未確認。 |
| `research_contract_cash` | source_cache `p11_gmeet_minutes_198e5a68b13c43ea` | unknown | BWE月次報告会で、SIPからの収入と経理管理を運用開始する次アクション。 | `review-only` | SIP収入 / 共同研究cash。BWE本体の膜外販粗利ではない。 |
| `research_contract_cash` | source_cache `p11_gmeet_minutes_1990d8b496887caa` | unknown | SIP支払い状況、BW立替経費精算、遅延損害金、BWE請求金額調整を議論。 | `review-only` | reimbursement / cash conversion source。販売粗利や膜外販の入金ではない。 |
| `survival_cash_or_grant` | source_cache `p11_gmail_1987e26bfa8c4a6f` | unknown | SIP C(1) 三者共同研究契約書案。NIMS・山口大学・BWEの共同研究契約。 | `usable source` | 政策実証 / 共同研究evidenceとして使えるが、R_net gross marginには入れない。 |
| `survival_cash_or_grant` | monthly report `p11_202611` / `p11_202612` | draft | SIP最終報告、行政対応、10kWモジュールPoC、住友理工条件交渉、シードラウンド準備。 | `review-only` | future draft。政策実証 / Survival guardであり、販売実績ではない。 |
| `survival_cash_or_grant` | `/Users/masa/projects/knowledge/BWE.md` 資金調達・政府支援 | knowledge / public + internal | SIP 7.5億円規模、東京都実証、NEDO NEPが整理されている。 | `usable source` for survival context | 政策・非希薄化資金・実証採択は7軸/Survival補助。粗利にはしない。 |
| `amd_billing_or_research_contract` | `billing_cycles` `720566d5-64c3-4172-a00d-3f519e53da2b` ほか p11 future rows | not_started / invoice_sent mixed | p11 future AMD billing rows。一部invoice送付があってもAMD請求。 | `exclude from PRS` | AMD billing / cash timing補助。SU本体売上・粗利へ転記しない。 |
| `future_or_draft_plan` | monthly report `p11_202612` | draft | 住友理工条件交渉、SIP最終報告書、10kWモジュールPoC、シード準備。 | `review-only` | future draftを契約・請求・入金・実績粗利として扱わない。 |
| `future_or_draft_plan` | `/Users/masa/projects/knowledge/BWE.md` 収益化目標 | knowledge | 本命RED発電装置の販売開始目標は2029年。 | `review-only` | 本命販売までの長さをR_net観測対象にするが、売上実績ではない。 |
| `policy_demo_validation_source` | source_cache `p11_slack_1745979366_346149` | unknown | 下水制御盤、試運転、単板設計、山大契約、SPD訪問など実証運営予定。 | `review-only` | 実証・validation source。販売、粗利、入金にはしない。 |
| `operating_cost_or_delay_source` | source_cache `p11_gmeet_minutes_199033acd75f8965` | unknown | 協和機電-BWE weekly。山口大学契約遅れ、設計図面未着、膜作業、NIMS専門家の現地対応。 | `usable source` as constraint, not value | 実証・開発運営コスト/遅延source。数値化や粗利控除額には未接続。 |

## 3. Membrane gate 3 conditions

### 3.1 Supply capacity / membrane availability

Current status: blocked / review-only.

Available source:
- `/Users/masa/projects/knowledge/BWE.md` は、2026-05時点でイオン交換膜の調達目処がまだ立っていないと整理している。
- 同ファイルは、膜外販候補を「ライスワーク候補」としつつ、膜が本命RED装置の技術上の最大ボトルネックでもあると明記している。
- `2026-06-01-prs-l2-source-inventory.md` は、p11に `r_bottleneck_external_sale_unverified` があり、膜外販の供給余力・粗利・本命RED装置影響が未joinと整理している。

Gate question:
- RED本命装置に必要な膜量と、外販に回せる余剰膜量を同一時点で比較できるか。
- 外販で本命10kW PoC / 初号機開発 / 実証納期に影響が出ないと言えるsourceがあるか。
- 膜の調達・量産・品質保証・検査・歩留まりが、本命と外販の両方を支えられる状態か。

Release condition:
- membrane supply plan by month
- RED PoC / first-unit demand by month
- external sale allocation by month
- shortage / delay risk owner
- BZM or Masa review that external allocation does not damage RED main lane

### 3.2 Gross margin / COGS / GP30% basis

Current status: blocked / review-only.

Available source:
- GP30%メモは候補として存在する。
- `2026-06-02-prs-finance-cash-source-pack.md` は、BWE GP30%メモを `available_but_needs_join` とし、元row特定・膜外販単価/原価/供給余力の突合が必要と整理している。
- 対象5PJの `project_pl_monthly` は0件で、SU別PLの直接sourceとしては使えない。

Gate question:
- GP30%は何の粗利か。膜単体か、装置部材か、研究契約内の費目か。
- 販売単価、膜原価、製造/外注費、検査/保証/物流費、在庫負担、研究者/技術者工数を含んでいるか。
- 請求・入金・原価のsource idが同じ取引へjoinできるか。

Release condition:
- external sale SKU / unit definition
- buyer / contract / price
- COGS basis, including membrane material, production, test, QA, logistics, warranty, labor
- invoice and payment source
- gross margin calculation source

### 3.3 Main RED impact / resource distraction

Current status: blocked / review-only.

Available source:
- `2026-06-01-prs-rnet-guard-memo.md` は、膜外販を「正のR_net候補であると同時に本命毀損候補」としている。
- `2026-06-02-prs-pr-rnet-evidence-cards-v6.md` は、本命RED装置販売は2029年目標で、初期粗利は見えにくく、膜外販がつなぎ収益候補だが本命技術のボトルネックでもあると整理している。
- `/Users/masa/projects/knowledge/BWE.md` は、本命がRED発電装置販売で、10kW規模でも大型装置になり初販売までが重いと整理している。

Gate question:
- 膜外販はRED本命の開発資金・顧客信頼・量産学習へ効くか。
- 逆に、膜製造・品質対応・販売/契約/サポートがRED本命の技術開発、PoC、初号機販売を遅らせるか。
- 外販先がRED本命の顧客/パートナー候補につながるか、完全に別レーンで消耗するか。

Release condition:
- RED roadmap impact memo
- resource allocation comparison: membrane production, researcher time, business development, QA/support
- main-lane impact classification: supports RED / neutral / distracts RED / unknown
- BZM or Masa review before moving out of `review-only`

## 4. Additional conditions if source appears

| condition | current status | required source |
|---|---|---|
| external buyer | not joined | buyer name, use case, relationship to RED main lane, source id |
| contract | not joined | signed contract or draft with status, scope, SKU/unit, price, delivery, acceptance |
| invoice | not joined | invoice id/date/amount linked to external buyer, not AMD billing |
| payment | not joined | payment confirmation / bank / freee source, not forecast |
| cost | not joined | COGS sheet or equivalent source linked to the same SKU/contract |
| margin | GP30% candidate only | calculation basis and whether it includes labor, QA, logistics, warranty, scrap, inventory |
| RED main impact | not joined | roadmap/resource memo or meeting source that classifies impact on RED PoC / first unit |

## 5. PRS use decision

| source family | prs_use | decision |
|---|---|---|
| membrane external sale / GP30% candidate | `review-only` | Keep as `bottleneck_external_sale_candidate`. Do not promote to positive R_net until supply capacity, gross margin, and RED main impact are joined. |
| SIP / joint research contract | `review-only` or `usable source` for Survival only | Use for `research_contract_cash` / `survival_cash_or_grant`; do not use as SU membrane sales gross margin. |
| reimbursement / advance expense settlement | `review-only` | Cash conversion context only. Not revenue / gross margin. |
| AMD billing rows | `exclude from PRS` | AMD請求・cash timing補助。BWE本体PLではない。 |
| future monthly report / roadmap | `review-only` | Forecast / hypothesis. Not actual revenue. |
| policy demo / validation source | `review-only` | 7軸 / BRL / SRL / Survival補助。Not gross margin. |
| operating cost / delay source | `usable source` as constraint, `review-only` as value | Cost / delay risk can block promotion, but does not provide numeric COGS yet. |

## 6. Evidence cards v7 field proposal

```yaml
p11_membrane_external_sale_status: bottleneck_external_sale_candidate
p11_membrane_prs_use: review-only
p11_membrane_release_condition: supply_capacity + gross_margin_basis + main_red_impact
p11_membrane_supply_capacity_status: blocked_missing_supply_allocation
p11_membrane_gp30_status: candidate_not_joined_to_cogs
p11_membrane_cogs_status: not_currently_available
p11_membrane_external_buyer_status: not_joined
p11_membrane_contract_status: not_joined
p11_membrane_invoice_status: not_joined
p11_membrane_payment_status: not_joined
p11_membrane_main_red_impact_status: requires_masa_or_bzm_review
p11_membrane_double_count_guard: do_not_mix_sip_research_contract_amd_billing_policy_demo_into_su_membrane_gross_margin
p11_research_contract_cash_status: sip_joint_research_review_only_separate_from_su_revenue
p11_survival_cash_status: sip_policy_demo_survival_guard_not_gross_margin
p11_amd_billing_use: exclude_from_prs_cash_timing_only
p11_future_plan_status: review_only_not_actual
p11_do_not_use_as: positive_R_net, formal_R_net_value, sales_actual, gross_margin_actual
```

Suggested v7 table row:

| PJ | field | value | prs_use | guard |
|---|---|---|---|---|
| p11 BWE | `p11_membrane_external_sale_status` | `bottleneck_external_sale_candidate` | `review-only` | 膜外販は供給余力・粗利/COGS・本命RED影響が揃うまで未確定R_net。 |
| p11 BWE | `p11_membrane_supply_capacity_status` | `blocked_missing_supply_allocation` | `review-only` | 膜が本命RED装置のボトルネックであるため、余剰供給sourceなしに外販を肯定しない。 |
| p11 BWE | `p11_membrane_gp30_status` | `candidate_not_joined_to_cogs` | `review-only` | GP30%は候補。COGS/単価/工数/保証/物流/歩留まりが未join。 |
| p11 BWE | `p11_membrane_main_red_impact_status` | `requires_masa_or_bzm_review` | `review-only` | 外販が本命RED開発を支えるか毀損するかはsourceだけでは未判断。 |
| p11 BWE | `p11_research_contract_cash_status` | `sip_joint_research_review_only_separate_from_su_revenue` | `review-only` | SIP/共同研究cashを膜外販粗利にしない。 |
| p11 BWE | `p11_survival_cash_status` | `sip_policy_demo_survival_guard_not_gross_margin` | `usable source` / `review-only` | SIP/東京都実証/政策支援はSurvival/7軸補助であり粗利ではない。 |
| p11 BWE | `p11_amd_billing_use` | `exclude_from_prs_cash_timing_only` | `exclude from PRS` | `billing_cycles` はAMD請求でありBWE本体売上ではない。 |

## 7. Still blocked fields

| field | blocker |
|---|---|
| `membrane_external_buyer` | 外販先がsource id付きで未join。電気透析用途/アカデミア向けは候補止まり。 |
| `membrane_contract_status` | 契約書、契約ドラフト、注文書、受注、検収条件が未join。 |
| `membrane_invoice_status` | 外販請求書が未join。AMD billingで代替禁止。 |
| `membrane_payment_status` | 外販入金確認が未join。SIP支払い/立替精算で代替禁止。 |
| `membrane_unit_price` | 膜単位・販売単価が未join。 |
| `membrane_cogs` | 原価表、製造/外注、検査/保証/物流、人件費、歩留まりが未join。 |
| `membrane_gp30_basis` | GP30%の元row・計算範囲・対象SKUが未特定。 |
| `membrane_supply_capacity` | 本命RED需要と外販余力の時系列比較が未join。 |
| `main_red_impact` | 外販が本命RED装置開発に与える効果/毀損の判断sourceが未join。 |
| `policy_cash_payment_terms` | SIP/東京都実証の入金条件、自己負担、後払い、管理コストが未join。 |

## 8. Next source needed

Priority order:

1. GP30%メモの元row/source idを特定する。
2. 膜外販の想定SKU、単価、COGS、外注/製造/QA/物流/保証/人件費をsource化する。
3. 膜の供給計画を、RED 10kW PoC / 初号機 / 実証ロードマップと同じ月次粒度で並べる。
4. 外販先候補を、候補 / 交渉 / 契約 / 請求 / 入金に分ける。
5. SIP/共同研究cash、立替精算、AMD billing、政策実証を、BWE本体膜外販PLと別laneで表示する。
6. まさまたはBZM司令塔が、膜外販の本命RED影響を `supports RED` / `neutral` / `distracts RED` / `unknown` でレビューする。
7. 必要ならOS workerへ、source_cache raw refsから該当MTG/メール/Slackのsource refsを引ける形に整える調査を切る。ただしDB writeやextractor実装はこのworkerでは行わない。

## 9. Commander judgement items

1. v7へ `p11_membrane_external_sale_status=bottleneck_external_sale_candidate` / `p11_membrane_prs_use=review-only` を戻すか。
2. p11膜外販のreview解除条件を `supply capacity + gross margin/COGS + main RED impact` の3条件に固定するか。
3. 追加条件として external buyer / contract / invoice / payment / cost を必須にするか、3条件を満たした後の二次gateにするか。
4. SIP/共同研究cashを `research_contract_cash`、SIP/東京都実証を `survival_cash_or_grant`、AMD billingを `exclude from PRS` として恒久分離するか。
5. GP30%候補を `usable source` へ上げず、`review-only` のままv7に戻すか。
6. 本命RED影響の分類はsourceだけでは決めず、まさ/BZM review requiredにするか。

## 10. Worker conclusion

p11膜外販はPRS comparison layer上の重要候補だが、現時点では正のR_netではなく、`bottleneck_external_sale_candidate` / `review-only` が安全。

SIP、共同研究cash、立替精算、AMD billing、政策実証はBWEの生存/政策/契約cashを説明するsourceとして有用。ただし膜外販粗利とは別laneで扱う。

次に進めるなら、GP30%メモの元row特定、膜供給余力、外販COGS、外販契約/請求/入金、本命RED影響レビューをsource単位で埋める。そこまで揃うまで、p11膜外販を正式usable/high R_netへ昇格しない。
