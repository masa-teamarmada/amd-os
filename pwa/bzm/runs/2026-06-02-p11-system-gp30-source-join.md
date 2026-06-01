# p11 system GP30 source join

Date: 2026-06-02
Worker: p11 system GP30 source join
Status: BZM commander review

## 0. Summary

`10kWh system GP30` は、raw Gmail thread と添付Excelまで read-only で source join できた。

結論:

- `source_cache.cache_id=p11_gmail_19c98f0f1d7cea62` / row `d083a88f-04d8-4d99-9f61-b1be87b586cd` は exact source。
- `source_cache.metadata_json` 自体には添付Excelの filename / attachment id / Drive file id は入っていない。
- Gmail thread 現物では添付Excelが確認できた。対象は `HH20260226②SRK試算_BWE財務計画_260221_y.xlsx`。
- 添付Excelの `前提条件` sheet は、10kW/100kW system の売価・原価・GP30%、O&M売上/原価、売電売上/原価を含む。
- ただしこれは system / financial plan / Sumitomo Riko review context であり、膜単体外販のGP30ではない。
- contract / invoice / payment には join できない。buyerも Sumitomo Riko contact / investment-review counterparty までで、signed buyer/order sourceではない。
- PRSへ戻す場合は `review-only` 維持。更新できるのは system lane の source-backed fields だけ。

No DB write / DDL / migration / extractor implementation / code implementation / deploy was performed.

## 1. Sources read

Mandatory docs:

- `/Users/masa/projects/AGENTS.common.md`
- `/Users/masa/projects/AMD/amd-os/AGENTS.md`
- `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
- `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
- `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md`
- `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`
- `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
- `pwa/design/L2_DATA.md`
- `pwa/design/db_schema.md`
- `pwa/bzm/COMMANDER_TASKS.md`

Prior BZM runs:

- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v8.md`
- `pwa/bzm/runs/2026-06-02-p11-gp30-raw-source-lookup.md`
- `pwa/bzm/runs/2026-06-02-p11-membrane-source-join-deep-dive.md`

Read-only live sources:

- Supabase REST with service-role credentials loaded locally. Secrets were not printed or written.
- Gmail connector: thread `19c98f0f1d7cea62`, messages and attachment metadata, one xlsx attachment parsed read-only.
- Google Drive connector: exact filename / title searches for the spreadsheet and related BWE finance files.
- Local knowledge: `/Users/masa/projects/knowledge/BWE.md`

## 2. Source Scope Table

| source family | object checked | result | use |
|---|---|---|---|
| `source_cache` exact row | `p11_gmail_19c98f0f1d7cea62` / `d083a88f-04d8-4d99-9f61-b1be87b586cd` | Exact GP30 thread found. Metadata has sender/recipient/message count only; no attachment filename/id. | system GP30 raw source |
| Gmail thread | thread id `19c98f0f1d7cea62`, 6 messages | Attachment metadata found. Excel and pptx present. | attachment/source join |
| Gmail attachment | `HH20260226②SRK試算_BWE財務計画_260221_y.xlsx` | Parsed successfully. Contains calculation basis for system GP30. | calculation basis source |
| Drive search | exact filename variants: `SRK試算`, `BWE財務計画`, `260221`, `エクイティ調達` | Exact 2026-02-26 xlsx not found as Drive file. Older `BWE財務計画_250904...` files found but not joined to this thread. | no exact Drive join |
| `project_knowledge` | `904dbf36-5194-4df2-a860-d23810be0054`, `239c5076-c1b5-4455-b6d1-34434bad6fa1` | Derived facts match Gmail source. No extra calculation or transaction join. | derived confirmation only |
| `monthly_reports` | p11 all visible rows | 2026-02 report references Sumitomo Riko and 5-year plan context, but no exact GP30/source join beyond Gmail/Excel. | context only |
| `project_meeting_summaries` | p11 rows | No GP30/system transaction join. | not usable |
| `project_strategy_signals` | p11 rows | No visible p11 rows. | not usable |
| `project_xrl_evidence` | p11 rows | No visible p11 rows. | not usable |
| `billing_cycles` | p11 all rows | AMD billing/cash timing rows only. No BWE system sale invoice/payment. | exclude from system GP30 transaction join |
| local BWE knowledge | `/Users/masa/projects/knowledge/BWE.md` | Confirms main RED system business, 10kW scale heaviness, membrane bottleneck/external sale candidate. | lane separation context |

## 3. Exact Source / Thread / Attachment Metadata

| item | value | finding |
|---|---|---|
| source_cache row | `id=d083a88f-04d8-4d99-9f61-b1be87b586cd` | Exact row. |
| cache id | `p11_gmail_19c98f0f1d7cea62` | Exact raw source. |
| source / item_id | `gmail` / `19c98f0f1d7cea62` | Gmail thread id. |
| title | `Re: BWE売上` | System revenue / financial plan context. |
| item_date | `2026-02-26T07:53:00+00:00` | First captured message time. |
| source_cache metadata | `from=万莉吉﨑`, `to=濱田真彰`, `messageCount=6`, `lastMessageJst=2026年3月6日 16:22` | No attachment metadata in DB row. |
| Gmail message `19c98f0f1d7cea62` | from BWE to Sumitomo Riko | Has attachment `エクイティ調達.pptx`, size 1,083,259 bytes. |
| Gmail message `19c9919d61fb72b5` | from BWE to Sumitomo Riko | Has attachment `H20260226②SRK試算_BWE財務計画_260221_y.xlsx`, size 1,304,123 bytes. |
| Gmail message `19c993fd7a24f152` | from Sumitomo Riko Hamada to BWE | Has attachment `HH20260226②SRK試算_BWE財務計画_260221_y.xlsx`, size 1,305,294 bytes. This is the parsed source for GP30 calculation. |
| Gmail messages after GP30 | BWE acknowledgement, later investment-status follow-up, Sumitomo Riko management-review reply | Context moves toward investment / management meeting review, not order/invoice/payment. |
| Drive file id | not joined | Gmail attachment is readable, but no Drive file id was found in source_cache metadata or Drive exact search. |

## 4. GP30 Calculation Basis Table

Parsed attachment: `HH20260226②SRK試算_BWE財務計画_260221_y.xlsx`.

Key workbook tabs:

- `年間計画`
- `月間計画`
- `前提条件`
- `予想_DCF`

Most relevant sheet: `前提条件`.

| field | found? | source detail | interpretation |
|---|---:|---|---|
| system scope | Yes | `10kWシステム`; formulas also derive `100kWシステム` as 10x with 20% cost reduction. | System/device lane, not membrane standalone. |
| 10kW system price | Yes | `売価` = 39,807,085.71428572 yen / unit, formula `2028年度バージョン原価 / 0.7`, note `GP30%`. | GP30 is encoded as gross margin target on 2028 10kW system cost. |
| 10kW system cost | Partial | 2026 cost 47,582,400 yen/unit; 2027 cost 40,549,920 yen/unit; 2028 cost 27,864,960 yen/unit. | Cost basis exists, but at summary/input level only. |
| gross margin | Yes | 2028 gross margin = 0.30000000000000004; formula `(売価 - 原価) / 売価`. 2026 and 2027 gross margins are negative with the same 2028 price. | GP30 applies when 2028 cost assumptions are used. |
| material | Partial | notes include `イオン交換膜10k/m²`, `8k/m²`, `4k/m²`, film unit assumptions, `46カセット`. | Material assumptions exist, but no vendor quote/contract/payment join. |
| membrane | Partial | membrane unit cost assumptions appear in `前提条件`. | This is system COGS input, not membrane external sale GP. |
| equipment / production | Partial | 10kW/100kW system cost lines and monthly plan formulas exist; `膜製造装置` appears as investment-related row. | Equipment/CAPEX context exists, not transaction-level COGS proof. |
| outsourcing | Partial | annual plan SG&A has `業務委託費用`; monthly plan has consulting/outsourcing lines. | Operating cost present, but not product COGS allocation proof. |
| QA / testing | Not found | no explicit QA/test cost line joined to GP30. | blocked |
| logistics | Not found | no explicit logistics/delivery cost line joined to GP30. | blocked |
| warranty | Not found | no warranty/defect/replacement reserve line joined to GP30. | blocked |
| labor | Partial | annual plan has personnel cost; not directly allocated to per-system COGS. | operating plan only |
| inventory | Not found | no inventory carrying cost / WIP / finished goods assumption joined. | blocked |
| yield / scrap | Not found | no production yield or scrap assumption joined. | blocked |
| installation | Partial | `Sheet1` has rough construction/travel/labor/plant transport/sensor cost notes, but not tied to 10kW system GP30 formula. | context only |
| O&M | Yes | `O&M売上`: 10kW 150,000 yen/month, 100kW 200,000 yen/month; `O&M原価`: 10kW 100,000 yen/month, 100kW 150,000 yen/month; gross margin 33.3% / 25%. | O&M lane is present and should be separated from system hardware sale. |
| revenue model | Yes | `月間計画` has `発電システム販売`, `O&M`, `売電`; annual plan rolls up sales / gross profit / CF. | business plan / financial projection. |
| DCF / investment value | Yes | `予想_DCF` tab exists. | fundraising/investment review context. |

Important caution:

- The Excel materially improves the previous blocker from `missing_cogs_basis` to `system_plan_basis_found_but_not_transaction_proof`.
- It does not make GP30 a sales actual, invoice, payment, or contract-backed gross margin.
- It does not support membrane standalone external sale GP30.

## 5. Sumitomo Riko Thread Context

| category | judgement | source basis |
|---|---|---|
| contract | Not supported | Thread contains discussion, materials, revised Excel, and later management meeting status. No signed contract, draft contract terms, order, or LOI found in this thread. |
| estimate / quotation | Partial but not formal | Excel is named `SRK試算` and contains financial plan assumptions. It is not a formal quote document with acceptance/validity/payment terms. |
| business plan | Strong | Workbook tabs are financial plan / annual plan / monthly plan / DCF; Gmail mentions data revision and cash-positive plan. |
| funding / investment review | Strong | Later messages ask about investment consideration; BWE reports lead-investor candidate passing investment committee and up to 100M yen investment frame; Sumitomo Riko says management meeting review is pending. |
| simple technical review | Partial | Later Sumitomo Riko message asks about large equipment, Tokyo POC, electric power company collaboration, and technical evaluation meeting feedback. |
| transaction / sale | Not supported | No buyer order, invoice, payment, or delivery acceptance found. |

Safe classification:

```yaml
p11_system_gp30_thread_context: business_plan_and_investment_review
p11_system_gp30_not_contract_or_payment: true
p11_system_gp30_counterparty_context: Sumitomo_Riko_review_counterparty_not_confirmed_buyer
```

## 6. Transaction Join Table

| join target | result | evidence | PRS handling |
|---|---|---|---|
| buyer | Partial | Sumitomo Riko / Hamada is a named counterparty in the thread; later management review/investment context exists. | `review-only_counterparty_not_buyer` |
| signed contract | Not found | No signed/draft system sale contract in Gmail thread, source_cache, billing_cycles, or p11 L2 rows. | blocked |
| estimate / quotation | Partial | `SRK試算` Excel exists; no formal quote terms. | `review-only` |
| invoice | Not found | `billing_cycles` p11 rows are AMD billing/cash timing and do not contain BWE system sale invoice. | blocked |
| payment | Not found | No BWE system sale payment confirmation. Existing p11 billing rows are AMD-side, not BWE SU revenue. | blocked |
| delivery / acceptance | Not found | No purchase order, delivery, acceptance, or inspection completion source. | blocked |
| cost paid / vendor invoices | Not found | Excel has assumptions; no vendor invoice / paid COGS proof. | blocked |
| Drive file id | Not found | exact attachment not found by Drive search; DB metadata does not hold Drive id. | blocked for Drive join |

## 7. System Lane vs Membrane Lane Separation

| lane | supported facts | unsupported / blocked | safe use |
|---|---|---|---|
| `10kWh/10kW system GP30` | Gmail exact source, Sumitomo Riko revised Excel, system price/cost/GP30 assumptions, O&M assumptions. | contract, invoice, payment, delivery acceptance, vendor-paid COGS, QA/logistics/warranty/inventory/yield, exact Drive file id. | PRS comparison-layer `review-only`; can inform system plan basis. |
| `membrane standalone external sale` | `/Users/masa/projects/knowledge/BWE.md` supports membrane external sale as possible ricework and membrane as RED bottleneck. | GP30 source does not apply; no membrane SKU, buyer, contract, invoice, payment, membrane sale COGS, supply allocation, RED main impact. | keep `review-only`; do not use GP30 as membrane gross margin. |
| `SIP / research / policy / AMD billing cash` | BWE knowledge and source_cache support research/policy/AMD cash contexts. | Not SU system sale or membrane sale gross margin. | separate Survival/cash timing context only. |

Recommended lane guard:

```yaml
p11_system_gp30_status: found_exact_with_excel_basis_but_no_transaction_join
p11_system_gp30_prs_use: review-only
p11_membrane_gp30_status: not_supported_by_found_gp30_source
p11_membrane_prs_use: review-only
p11_system_membrane_double_count_guard: do_not_use_system_gp30_as_membrane_external_sale_gross_margin
```

## 8. v9 Return Proposal

### Update possible

These updates are source-backed and do not require formal PRS adoption:

```yaml
p11_gp30_raw_source_status: found_exact
p11_gp30_raw_source_cache_id: p11_gmail_19c98f0f1d7cea62
p11_gp30_raw_source_row_id: d083a88f-04d8-4d99-9f61-b1be87b586cd
p11_gp30_attachment_status: gmail_attachment_found_not_source_cache_metadata
p11_gp30_attachment_filename: HH20260226②SRK試算_BWE財務計画_260221_y.xlsx
p11_gp30_drive_file_id_status: not_joined
p11_gp30_classification: RED_10kWh_system_gross_margin_candidate
p11_system_gp30_status: found_exact_with_excel_basis_but_no_transaction_join
p11_system_scope_status: 10kW_system_basis_found
p11_system_price_basis_status: found_in_excel_projection
p11_system_cogs_basis_status: partial_excel_projection_basis
p11_system_transaction_join_status: not_joined
p11_gp30_thread_context: business_plan_and_investment_review
p11_gp30_prs_use: review-only
p11_membrane_gp30_status: not_supported_by_found_gp30_source
```

### Blocked維持

Keep these blocked / review-only:

```yaml
p11_system_contract_status: not_joined
p11_system_invoice_status: not_joined
p11_system_payment_status: not_joined
p11_system_delivery_acceptance_status: not_joined
p11_system_cogs_proof_status: projection_only_not_vendor_invoice_or_paid_cost
p11_system_qa_logistics_warranty_inventory_yield_status: not_joined
p11_membrane_external_buyer_status: not_joined
p11_membrane_contract_status: not_joined
p11_membrane_invoice_status: not_joined
p11_membrane_payment_status: not_joined
p11_membrane_cogs_status: not_currently_available
p11_membrane_supply_capacity_status: blocked_missing_supply_allocation
p11_membrane_main_red_impact_status: requires_masa_or_bzm_review
```

### No rollback

No rollback is needed for v8:

- Keep `p11_gp30_classification=RED_10kWh_system_gross_margin_candidate`.
- Keep `p11_gp30_not_membrane_standalone_external_sale=true`.
- Keep `p11_membrane_gp30_status=not_supported_by_found_gp30_source`.
- Keep `p11_system_gp30_status` separated from membrane lane.
- Keep `p11_do_not_use_as=positive_R_net, formal_R_net_value, sales_actual, gross_margin_actual`.

Refinement from v8:

- `missing_cogs_and_transaction_join` can become `excel_projection_basis_found_but_missing_transaction_and_cost-proof_join`.
- This is narrower and more accurate because price/system COGS assumptions are now visible in the Excel, while transaction proof remains absent.

## 9. Commander Judgement Items

1. Decide whether v9 should update `p11_system_gp30_status` to `found_exact_with_excel_basis_but_no_transaction_join`.
2. Decide whether `p11_system_cogs_basis_status=partial_excel_projection_basis` is acceptable, or whether BZM wants stricter wording like `projection_only_not_cogs_proof`.
3. Decide whether Sumitomo Riko should be labeled `review_counterparty_not_confirmed_buyer` rather than buyer.
4. Keep membrane external sale separated unless a separate membrane source appears with SKU, buyer, contract, invoice, payment, COGS, supply allocation, and RED main impact.
5. If BZM needs transaction proof, cut a follow-up worker for Sumitomo Riko contract/LOI/order/invoice/payment source lookup; do not infer it from this thread.
6. If BZM needs Drive canonicalization, cut a Drive/Gmail attachment archival worker to preserve filename + Gmail message id + attachment metadata into a non-secret source ref design, but do not write DB in this worker.

## 10. Verification

- Read-only Supabase REST tables checked: `source_cache`, `project_knowledge`, `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals`, `project_xrl_evidence`, `billing_cycles`.
- Gmail thread `19c98f0f1d7cea62` read-only checked. Six messages, attachment metadata, and the `HH...xlsx` attachment were parsed read-only.
- Google Drive exact searches did not find the exact `260221` / `SRK試算` spreadsheet as a Drive file.
- No DB write / DDL / migration / extractor implementation / code implementation / deploy.
- No 0-9 score table, R_net valuation, PRS formal adoption, current 7-axis replacement, or historical score recalculation.
- Secrets, auth values, and signed temporary attachment URLs are intentionally omitted.
