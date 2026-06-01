# p11 Sumitomo Riko transaction proof lookup

Date: 2026-06-02
Worker: p11 Sumitomo Riko transaction proof lookup
Status: BZM commander review

## 0. Summary

`p11 10kW/10kWh system GP30` について、Sumitomo Riko / 住友理工周辺の contract / LOI / order / invoice / payment / delivery acceptance / vendor-paid COGS を read-only で確認した。

結論:

- Sumitomo Riko / 住友理工は、BWE 5か年財務計画・SRK試算・出資検討・経営会議報告の review counterparty としては強い。
- 住友理工側が売上・原価・DCF・10kW/100kW system 計画を編集/レビューし、`10kwhシステムの総益率GP30%` へ調整した Gmail / 添付 Excel は確認済み。
- ただし、confirmed buyer / signed order / signed contract / LOI / quote acceptance / purchase order は見つからなかった。
- invoice / payment / delivery acceptance / customer acceptance / inspection completion も見つからなかった。
- vendor-paid COGS / supplier invoice / paid cost / QA / logistics / warranty / inventory / yield proof も見つからなかった。
- `billing_cycles` の p11 請求/入金行は AMD/BWE 間の billing/cash timing であり、BWE 10kW/10kWh system sale や Sumitomo Riko payment ではない。
- system lane と membrane lane は引き続き分離。system GP30 を membrane standalone external sale GP として使わない。

No DB write / DDL / migration / extractor implementation / code implementation / deploy was performed.

## 1. Search scope table

| source family | scope checked | result | handling |
|---|---|---|---|
| `source_cache` | p11 255 rows, Sumitomo Riko / 住友理工 / 濱田 / SRK / GP30 / 10kW / 10kWh / contract/payment/COGS keyword scan | Exact GP30 thread `p11_gmail_19c98f0f1d7cea62` found. Related `BWE_月次進捗_2026-02` and `住友理工MTG` context found. No transaction join. | use as review/source context only |
| `project_knowledge` | p11 245 rows | Derived rows for 濱田真彰, 住友理工, 10kWh system GP30. Contract hits were SIP/NIMS/Yamaguchi or BWE stock transfer, not Sumitomo Riko system sale. | derived confirmation only |
| `monthly_reports` | p11 15 rows | Future/draft monthly reports mention 住友理工/SR negotiation and 10kW module PoC. No signed buyer/order/payment/delivery proof. | context only |
| `project_meeting_summaries` | p11 1 row | No Sumitomo Riko / transaction / COGS hit. | not usable |
| `project_strategy_signals` | p11 visible rows | 0 rows visible for p11. | not usable |
| `project_xrl_evidence` | p11 visible rows | 0 rows visible for p11. | not usable |
| `billing_cycles` | p11 15 rows | 202512/202601 have AMD-side payment confirmations; later rows are not_started or invoice_sent. No Sumitomo Riko / BWE system sale invoice/payment. | exclude from system transaction proof |
| Gmail connector | Sumitomo Riko / SRK / 濱田 / BWE / 10kW / 10kWh / GP30 / contract/payment queries | `BWE社5か年(2026-2030)気になる点` and `BWE売上` threads found. They show financial plan review, Excel revision, investment-status follow-up, and pending management meeting review. No PO/contract/invoice/payment. | primary live evidence |
| Google Drive connector | `SRK試算 BWE 財務計画`, `住友理工 BWE 契約`, `BWE 住友理工 請求`, `BWE SRK LOI` | No exact transaction doc found. Exact SRK Excel was not found as Drive-native file in this worker. One noisy unrelated/sensitive workspace sheet hit was ignored and not used. | no Drive transaction join |
| local knowledge | `/Users/masa/projects/knowledge/BWE.md` | Confirms RED system main business, 10kW scale heaviness, SIP/research/policy lane, and membrane external-sale candidate context. | lane separation context |

## 2. Counterparty status table

| candidate counterparty | evidence found | buyer/order status | safe classification |
|---|---|---|---|
| Sumitomo Riko / 住友理工 | Gmail threads with 濱田氏 / 小野氏; SRK試算 Excel; finance-plan questions; management meeting / investment review follow-up | Not confirmed buyer. No purchase order, signed contract, LOI, quote acceptance, or payment source found. | `review_counterparty_not_confirmed_buyer` |
| 濱田真彰 | Gmail sender/reviewer; project_knowledge row `904dbf36-5194-4df2-a860-d23810be0054`; GP30 system margin edit | Reviewer/adviser in Sumitomo Riko context, not buyer signatory proof. | `review_person_counterparty` |
| 小野皓平 | Gmail reviewer in 2026-02-18/19 finance-plan thread; attached `②SRK試算_BWE財務計画_260219 .xlsx` | Reviewer of annual/monthly plan, sales/cost assumptions, DCF. No order source. | `finance_plan_review_counterparty` |
| BWE / Blue Water Energy | Provides revised Excel, equity materials, investment update | Seller/startup side, but no system sale transaction source. | `source_owner / startup_side` |
| NIMS / 山口大学 / SIP | Separate research contract and policy/demo evidence exists | Not Sumitomo Riko system buyer; not SU system gross margin. | `research_contract_cash_or_policy_lane` |
| AMD / Team ARMADA | `billing_cycles` and AMD/BWE業務委託契約 source exist | AMD billing, not BWE SU revenue or Sumitomo Riko system purchase. | `exclude_from_system_gp30_transaction_join` |

## 3. Contract / LOI / order / invoice / payment / delivery acceptance table

| proof target | status | evidence checked | judgement |
|---|---|---|---|
| LOI / term sheet | Not found | Gmail Sumitomo Riko/SRK queries; Drive `BWE SRK LOI`; DB keyword scan | No LOI / term sheet source joined. |
| purchase order / order / quote acceptance | Not found | Gmail / `source_cache` / monthly reports / billing rows | Excel is a financial plan / estimate context, not accepted quote or PO. |
| signed contract | Not found for Sumitomo Riko system sale | Contract keyword hits are SIP三者共同研究契約, BWE株式譲渡, AMD/BWE業務委託, or internal/report docs | Do not treat any contract hit as Sumitomo Riko buyer contract. |
| formal quote / estimate | Partial, non-formal | Excel files named `SRK試算_BWE財務計画...`; Sumitomo Riko edited sales/cost/DCF assumptions | `SRK試算` is calculation/review material, not formal quote with acceptance/payment terms. |
| invoice | Not found | `billing_cycles`, Gmail, Drive search | Existing invoice rows are AMD/BWE billing. No BWE->Sumitomo Riko system invoice. |
| payment | Not found | `billing_cycles.payment_confirmed_at`, Gmail, Drive search | p11 202512/202601 payment confirmations are AMD-side. No Sumitomo Riko payment. |
| delivery | Not found | Gmail / source_cache terms `納品`, `delivery` | Hits are report/SIP/AMD contexts, not system delivery. |
| acceptance / inspection completion | Not found | Gmail / source_cache terms `検収`, `受領`, `acceptance` | No customer acceptance / inspection completion proof. |
| management approval | Pending / not found | 2026-03-06 Gmail says management meeting review had not yet happened and 2026-03-13 was a candidate date | No approval result source found in this worker. |

## 4. COGS proof table

| COGS proof target | status | evidence found | why blocked |
|---|---|---|---|
| system price/cost assumptions | Found as projection basis | Excel `HH20260226②SRK試算_BWE財務計画_260221_y.xlsx`; prior v9 parse shows `前提条件` sheet with 10kW/100kW price/cost/GP30 | Projection/input basis only. |
| vendor invoice / supplier invoice | Not found | Gmail / source_cache / Drive keywords | No vendor/supplier bill tied to system unit. |
| paid cost / paid COGS | Not found | billing and Gmail payment checks | No paid supplier cost or product COGS payment proof. |
| material cost proof | Partial projection only | Excel assumptions include membrane/material cost assumptions per prior v9 parse | No quote/contract/payment/yield join. |
| production / outsourcing cost proof | Partial projection only | Excel/plan and SG&A/outsourcing lines exist | Not tied to actual unit COGS or paid vendor proof. |
| QA / test | Not found | DB/Gmail keyword checks | No QA/test cost or inspection proof joined. |
| logistics / delivery | Not found | DB/Gmail keyword checks | No logistics/shipping/delivery cost proof joined. |
| warranty / defect reserve | Not found | DB/Gmail keyword checks | No warranty/defect/replacement reserve proof joined. |
| inventory / WIP / finished goods | Not found | DB/Gmail keyword checks | No inventory carrying or stock proof joined. |
| yield / scrap | Not found | DB/Gmail keyword checks | No yield/scrap source joined. |

Safe classification:

```yaml
p11_system_cogs_basis_status: projection_only_not_cogs_proof
p11_system_cogs_proof_status: not_joined_to_vendor_invoice_paid_cost_or_acceptance
p11_system_transaction_join_status: not_joined
```

## 5. System lane vs membrane lane guard

| lane | can use | must not use | release condition |
|---|---|---|---|
| `10kW/10kWh system GP30` | Gmail + Excel as financial plan / investment-review projection basis | Formal R_net value, 0-9 score, sales actual, invoice/payment actual, confirmed buyer/order | contract/PO or signed acceptance + invoice + payment + delivery/acceptance + paid COGS/vendor invoice + QA/logistics/warranty/inventory/yield proof |
| `membrane standalone external sale` | BWE knowledge as possible bottleneck/ricework candidate | System GP30 as membrane external-sale gross margin | separate membrane SKU + buyer + contract/order + invoice + payment + membrane COGS + supply allocation + RED main impact |
| `SIP / research / policy / AMD billing` | Survival/cash-timing/research-contract context | SU system sale gross margin or Sumitomo Riko buyer proof | separate source-purpose label; never add to R_net gross margin |

Recommended guard:

```yaml
p11_system_gp30_status: found_exact_with_excel_basis_but_no_transaction_join
p11_system_counterparty_status: review_counterparty_not_confirmed_buyer
p11_system_cogs_basis_status: projection_only_not_cogs_proof
p11_system_contract_status: not_joined
p11_system_invoice_status: not_joined
p11_system_payment_status: not_joined
p11_system_delivery_acceptance_status: not_joined
p11_system_vendor_paid_cogs_status: not_joined
p11_system_gp30_prs_use: review-only
p11_membrane_gp30_status: not_supported_by_found_gp30_source
p11_system_membrane_double_count_guard: do_not_use_system_gp30_as_membrane_external_sale_gross_margin
```

## 6. v10 return proposal

### Update possible

These are source-backed and safe to carry into v10:

```yaml
p11_sumitomo_riko_search_status: completed_read_only
p11_sumitomo_riko_context: finance_plan_investment_review_and_management_meeting_review
p11_sumitomo_riko_counterparty_status: review_counterparty_not_confirmed_buyer
p11_system_gp30_status: found_exact_with_excel_basis_but_no_transaction_join
p11_system_cogs_basis_status: projection_only_not_cogs_proof
p11_system_transaction_join_status: not_joined
p11_system_management_review_status: pending_or_no_result_source_found
p11_system_contract_status: not_joined
p11_system_invoice_status: not_joined
p11_system_payment_status: not_joined
p11_system_delivery_acceptance_status: not_joined
p11_system_vendor_paid_cogs_status: not_joined
p11_system_qa_logistics_warranty_inventory_yield_status: not_joined
```

### Blocked維持

Keep blocked/review-only:

- `p11_system_contract_status`
- `p11_system_order_status`
- `p11_system_invoice_status`
- `p11_system_payment_status`
- `p11_system_delivery_acceptance_status`
- `p11_system_vendor_paid_cogs_status`
- `p11_system_qa_logistics_warranty_inventory_yield_status`
- `p11_membrane_external_buyer_status`
- `p11_membrane_contract_status`
- `p11_membrane_invoice_status`
- `p11_membrane_payment_status`
- `p11_membrane_cogs_status`
- `p11_membrane_supply_capacity_status`
- `p11_membrane_main_red_impact_status`

### No rollback

No rollback needed from v9:

- Keep `p11_system_gp30_status=found_exact_with_excel_basis_but_no_transaction_join`.
- Keep `p11_system_cogs_basis_status=projection_only_not_cogs_proof`.
- Keep `p11_system_counterparty_status=review_counterparty_not_confirmed_buyer`.
- Keep both system lane and membrane lane out of formal R_net / 0-9 score / current 7-axis replacement.

## 7. Commander judgement items

1. Adopt v10 wording `p11_sumitomo_riko_context=finance_plan_investment_review_and_management_meeting_review`.
2. Confirm `review_counterparty_not_confirmed_buyer` should remain the counterparty status.
3. Decide whether to cut a follow-up only for `2026-03-13 management meeting result` if BZM wants to know whether Sumitomo Riko internally advanced the investment review.
4. Keep system GP30 as projection/review-only until transaction proof and vendor-paid COGS proof are joined.
5. Keep membrane external-sale lane blocked unless separate membrane-specific buyer/contract/invoice/payment/COGS/supply/RED-impact evidence appears.

## 8. Verification

- Read-only Supabase REST checks completed using local credentials; secrets were not printed or written into this artifact.
- Gmail connector read-only searches and batch reads completed for Sumitomo Riko / SRK / BWE threads.
- Google Drive connector read-only searches completed; no exact transaction proof found.
- No DB write / DDL / migration / extractor implementation / code implementation / deploy.
- No formal R_net value, 0-9 score table, PRS formal adoption, current 7-axis replacement, or historical score recalculation performed.
