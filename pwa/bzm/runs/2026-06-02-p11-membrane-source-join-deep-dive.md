# p11 membrane source join deep dive

Date: 2026-06-02
Worker: p11 membrane source join deep dive
Scope: PRS evidence cards v7で `review-only` 固定した p11 Blue Water Energy 膜外販について、解除条件に必要なsourceをread-onlyで深掘りする。

## 0. Summary

p11 BWEの膜外販は、今回のdeep dive後も `bottleneck_external_sale_candidate` / `review-only` 維持が安全。

埋まったのは、膜外販が「本命RED装置販売前のライスワーク候補」であり、同時に「本命RED装置の最大ボトルネックでもある」という source basis。`/Users/masa/projects/knowledge/BWE.md` は、2026-05時点でイオン交換膜の調達目処がまだ立っていないこと、膜単体外販が候補であること、本命RED装置の初販売が重いことを明示している。

一方で、review解除に必要な `supply_capacity + gross_margin_basis + main_red_impact` はまだ揃っていない。特にGP30%メモは既存run上で存在候補として繰り返し参照されているが、今回確認できた範囲では元row/source id、対象SKU、計算範囲、COGS、外販buyerへjoinできなかった。

## 1. Sources read

- `/Users/masa/projects/AGENTS.common.md`
- `/Users/masa/projects/AMD/amd-os/AGENTS.md`
- `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
- `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
- `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md`
- `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`
- `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
- `/Users/masa/projects/AMD/amd-os/pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v7.md`
- `pwa/bzm/runs/2026-06-02-p11-membrane-gate-source-join.md`
- `pwa/bzm/runs/2026-06-02-prs-finance-cash-source-pack.md`
- `pwa/bzm/runs/2026-06-02-prs-billing-vs-su-revenue-join-map.md`
- `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/bzm/runs/2026-06-02-prs-classification-adoption-patch.md`
- `pwa/bzm/runs/2026-06-02-prs-bridge-validation-source-pack.md`
- `/Users/masa/projects/knowledge/BWE.md`
- `pwa/design/db_schema.md` source_cache schema
- Repo/knowledge横断 `rg` search for `p11`, `BWE`, `GP30`, `30%`, `膜`, `外販`, `COGS`, `粗利`, `source_cache`

DB live check:

- `.env.local` / service_role env は現worktreeとcanonical checkoutで見つからなかった。
- public anon RESTで `source_cache?project_id=eq.p11` をread-only spot checkしたが、RLS上は `[]` だった。
- そのため、source_cache raw row本文の追加確認は未実施。既存runが持つsource idと要約を二次sourceとして扱った。
- 秘密値・認証情報は成果物に記載しない。

## 2. GP30% memo source id deep dive

| item | result | status |
|---|---|---|
| 元row/source id | 未特定。既存runは `BWE GP30%メモ` として参照するが、row id / table / cache_id までは記載していない。 | `blocked_missing_raw_source_id` |
| source family候補 | `2026-06-01-prs-l2-source-inventory.md` と finance/cash source pack上の二次参照。 | `secondary_source_only` |
| GP30%の対象 | 膜単体外販か、RED装置部材か、研究契約内費目かは未判定。 | `blocked_missing_scope` |
| 計算範囲 | 材料費、製造/外注、QA、物流、保証、在庫、工数の包含有無は未確認。 | `blocked_missing_cogs_basis` |
| formal use | 正式粗利、sales actual、positive R_netには使えない。 | `review-only` |

Current interpretation:

- GP30%は `gross_margin_candidate` ではあるが、`gross_margin_basis` ではない。
- `p11_membrane_gp30_status=candidate_not_joined_to_cogs` は維持。
- v7の `p11_do_not_use_as=positive_R_net, formal_R_net_value, sales_actual, gross_margin_actual` は維持。

What would unblock:

1. GP30%メモのtable/row/cache/source id。
2. メモ本文または添付資料での対象定義: membrane SKU / module component / research contract item。
3. GP30%計算式と分母分子。
4. COGS範囲: membrane material, production/outsourcing, test/QA, logistics, warranty, scrap/yield, inventory, labor。
5. 同じ取引への buyer / contract / invoice / payment join。

## 3. Membrane SKU / price / COGS / supply capacity

| field | found | status | note |
|---|---|---|---|
| SKU / unit definition | 未発見 | `not_currently_available` | 膜1枚、膜面積、スタック単位、装置部材単位のどれかが不明。 |
| unit price | 未発見 | `not_currently_available` | GP30%があっても販売単価がない。 |
| COGS | 未発見 | `not_currently_available` | 材料費・製造外注費・QA・物流・保証・在庫・工数が未join。 |
| production / outsourcing | 未発見 | `not_currently_available` | 誰が製膜/量産するか、外注か内製か不明。 |
| QA / testing | 未発見 | `not_currently_available` | 外販品質保証の検査条件なし。 |
| logistics / warranty | 未発見 | `not_currently_available` | 納品・保証・交換・不良対応コストなし。 |
| labor | 未発見 | `not_currently_available` | 研究者/技術者工数の扱いなし。 |
| yield / scrap | 未発見 | `not_currently_available` | 歩留まり・不良率・ロット安定性なし。 |
| RED main demand monthly | 未発見 | `blocked_missing_main_demand_by_month` | 10kW PoC / 初号機 / 実証の膜需要を月次化するsourceなし。 |
| external sale capacity monthly | 未発見 | `blocked_missing_external_allocation_by_month` | 本命需要と外販余力を同粒度で比較できない。 |

Positive source that was strengthened:

- `/Users/masa/projects/knowledge/BWE.md` says ion-exchange membrane procurement is not yet secured as of 2026-05 and membrane is the largest technical issue.
- The same file says membrane standalone sale to electrodialysis/academia could be a bridge/ricework candidate.

This strengthens the blocker, not the release:

- `p11_membrane_supply_capacity_status=blocked_missing_supply_allocation` remains correct.
- If v7 field wording is refined, candidate value is `blocked_missing_supply_allocation_and_procurement_not_secured`.
- Do not use this as negative R_net value. It is a promotion blocker / risk source.

## 4. Buyer / contract / invoice / payment

| stage | found source | status | PRS use |
|---|---|---|---|
| candidate buyer | BWE knowledge says electrodialysis use and academia are possible destinations. | `candidate_segment_only` | `review-only` |
| named buyer | none joined | `not_joined` | `exclude from formal R_net` |
| negotiation | none joined for membrane external sale | `not_joined` | `exclude from formal R_net` |
| contract | none joined | `not_joined` | `exclude from formal R_net` |
| invoice | none joined | `not_joined` | `exclude from formal R_net` |
| payment | none joined | `not_joined` | `exclude from formal R_net` |

Explicit non-substitutes:

- SIP payment / joint research cash: `research_contract_cash`, not membrane sales gross margin.
- SIP / Tokyo policy demo: `survival_cash_or_grant`, not R_net gross margin.
- AMD billing rows: `exclude from PRS`, cash timing only.
- Reimbursement / advance expense settlement: cash conversion context only, not sales / gross margin.

Known source refs from existing runs:

| source ref | current classification | why not substitute |
|---|---|---|
| source_cache `p11_gmeet_minutes_198e5a68b13c43ea` | `research_contract_cash` | SIP income / accounting management, not external membrane buyer. |
| source_cache `p11_gmeet_minutes_1990d8b496887caa` | `research_contract_cash` / reimbursement | SIP payment, expense settlement, damages, BWE billing adjustment; not membrane sale payment. |
| source_cache `p11_gmail_1987e26bfa8c4a6f` | `survival_cash_or_grant` | SIP C(1) joint research contract draft; policy/joint research evidence. |
| source_cache `p11_slack_1745979366_346149` | `policy_demo_validation_source` | Demonstration operations; not sale / gross margin. |
| source_cache `p11_gmeet_minutes_199033acd75f8965` | `operating_cost_or_delay_source` | Contract delay / membrane work / expert visit; constraint source, not COGS value. |

## 5. Main RED impact

Current classification: `requires_masa_or_bzm_review`.

The source layer can support three facts:

1. BWE main business is RED power generation device sale, with first sales targeted around 2029 in existing knowledge.
2. Initial RED device sale is heavy because even 10kW class requires large physical installation.
3. Membrane external sale could be a bridge revenue candidate, but membrane itself is also the key bottleneck.

The source layer cannot decide:

- Whether external membrane sale supports RED by funding, manufacturing learning, customer trust, or partner development.
- Whether it distracts RED by consuming scarce membrane, researcher time, QA capacity, business development, or delivery attention.
- Whether target buyers are RED-aligned partners or unrelated bridge customers.

Therefore:

| option | source-only status |
|---|---|
| supports RED | not proven |
| neutral | not proven |
| distracts RED | risk exists, not proven as outcome |
| unknown | current safe classification |

Recommended v7 state:

```yaml
p11_membrane_main_red_impact_status: requires_masa_or_bzm_review
p11_membrane_main_red_impact_options: supports_red | neutral | distracts_red | unknown
p11_membrane_main_red_impact_current: unknown
```

## 6. PRS v7 field return candidates

### 6.1 Update possible now

These are not score/rubric updates. They are source-basis clarifications that can be returned to v7 or a future v8 card.

| field | proposed handling | reason |
|---|---|---|
| `p11_membrane_external_sale_status` | keep `bottleneck_external_sale_candidate`; add source basis `/Users/masa/projects/knowledge/BWE.md` | BWE knowledge directly supports membrane standalone sale candidate and bottleneck duality. |
| `p11_membrane_supply_capacity_status` | keep `blocked_missing_supply_allocation`; optional wording `blocked_missing_supply_allocation_and_procurement_not_secured` | BWE knowledge says membrane procurement outlook not secured as of 2026-05. |
| `p11_membrane_main_red_impact_status` | keep `requires_masa_or_bzm_review`; add current value `unknown` | Source can show risk/candidate, not decide support vs distraction. |
| `p11_research_contract_cash_status` | keep `sip_joint_research_review_only_separate_from_su_revenue` | source_cache refs are SIP/research cash, not membrane sale. |
| `p11_survival_cash_status` | keep `sip_policy_demo_survival_guard_not_gross_margin` | policy/demo source is strong but not gross margin. |
| `p11_amd_billing_use` | keep `exclude_from_prs_cash_timing_only` | AMD billing cannot substitute for SU membrane sale. |

### 6.2 Still blocked

| field | blocked reason |
|---|---|
| `p11_membrane_gp30_status` | GP30 raw row/source id and COGS basis not joined. |
| `p11_membrane_cogs_status` | COGS sheet / equivalent source unavailable. |
| `p11_membrane_external_buyer_status` | only buyer segment candidates; no named buyer / negotiation / contract. |
| `p11_membrane_contract_status` | no signed/draft external membrane sale contract joined. |
| `p11_membrane_invoice_status` | no external membrane invoice joined. |
| `p11_membrane_payment_status` | no external membrane payment confirmation joined. |
| `p11_membrane_release_condition` | all three release conditions remain unmet. |

### 6.3 No rollback needed

| field | keep | why |
|---|---|---|
| `p11_membrane_prs_use` | `review-only` | Correct until supply, gross margin, RED impact, and transaction gates are source-joined. |
| `p11_membrane_double_count_guard` | `do_not_mix_sip_research_contract_amd_billing_policy_demo_into_su_membrane_gross_margin` | Deep dive found no evidence that would weaken this guard. |
| `p11_future_plan_status` | `review_only_not_actual` | Future draft / roadmap remains non-actual. |
| `p11_do_not_use_as` | `positive_R_net, formal_R_net_value, sales_actual, gross_margin_actual` | Still required. |

## 7. What is now filled vs blocked

| area | filled | still blocked |
|---|---|---|
| GP30 memo | Existence as secondary candidate in existing BZM runs. | Raw source id, scope, calculation basis, COGS, buyer join. |
| Membrane external sale | BWE knowledge supports candidate and bottleneck duality. | SKU/unit, price, named buyer, contract, invoice, payment. |
| Supply capacity | BWE knowledge supports procurement/supply as blocker. | Monthly supply plan, RED demand, external allocation. |
| COGS / margin | None beyond GP30 candidate. | Material, production/outsourcing, QA, logistics, warranty, inventory, labor, yield. |
| Buyer pipeline | Candidate segments: electrodialysis / academia. | Candidate names, negotiation status, signed scope. |
| Research/policy cash | Existing source_cache refs classify SIP/research/policy/demo. | Payment terms and management cost can be Survival context only; not membrane sale. |
| Main RED impact | Source shows dual-use risk. | Human/BZM review needed for supports/neutral/distracts/unknown. |

## 8. Commander judgement items

1. Keep p11 membrane external sale `review-only` after this deep dive.
2. Decide whether to refine supply field wording to `blocked_missing_supply_allocation_and_procurement_not_secured`.
3. Keep GP30% as `candidate_not_joined_to_cogs`; do not promote to `usable source`.
4. Keep main RED impact as `requires_masa_or_bzm_review`, with current classification `unknown`.
5. If deeper raw source inspection is required, cut an OS/source worker with service_role read-only access to source_cache / project_knowledge / attachments, specifically to find the GP30 raw row.

## 9. Next actions

Priority:

1. Read-only DB/source worker: locate the GP30 raw row by searching `source_cache`, `project_knowledge`, `monthly_reports`, `project_meeting_summaries`, and any source refs for `GP30`, `30%`, `粗利`, `膜`, `外販`, `イオン交換膜`.
2. If GP30 row is found, classify whether it is membrane standalone sale, RED device component, or research-contract item.
3. Create membrane SKU/COGS source request: unit definition, price, COGS components, QA, logistics, warranty, inventory, labor, yield.
4. Create supply allocation memo: monthly membrane supply, RED 10kW PoC / first-unit demand, external sale allocation, shortage risk owner.
5. BZM/Masa review: classify main RED impact as `supports_red`, `neutral`, `distracts_red`, or `unknown`.

## 10. Verification

- Read-only docs and repo search only.
- No DB write / DDL / migration / extractor implementation / code implementation / deploy.
- Public anon REST spot check was read-only and returned no p11 source_cache rows because of RLS-visible scope.
- No 0-9 score table, R_net valuation, PRS formal adoption, current 7-axis replacement, or historical score recalculation.
- No secrets or auth values are written in this artifact.
