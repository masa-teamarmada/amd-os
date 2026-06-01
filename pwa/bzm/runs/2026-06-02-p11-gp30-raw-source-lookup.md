# p11 GP30 raw source lookup

Date: 2026-06-02
Worker: p11 GP30 raw source lookup
Scope: p11 Blue Water Energy膜外販の `GP30%` 候補について、raw source row/source id をread-onlyで探し、BZM判断可能な形に整理する。

## 0. Summary

`GP30%` のraw source rowは見つかった。

ただし、見つかった本文は膜単体外販ではなく、住友理工側の濱田氏が「10kwhシステムの総益率GP30%に下げました」と書いた `Re: BWE売上` Gmail threadである。したがって、このsourceは `membrane standalone external sale gross margin` ではなく、少なくともraw text上は `10kWh system / RED device system revenue plan candidate` に分類するのが安全。

結論:

- GP30 decision: `found exact`
- Raw source: `source_cache.cache_id=p11_gmail_19c98f0f1d7cea62`, row id `d083a88f-04d8-4d99-9f61-b1be87b586cd`
- Derived knowledge rows: `project_knowledge.id=904dbf36-5194-4df2-a860-d23810be0054`, `project_knowledge.id=239c5076-c1b5-4455-b6d1-34434bad6fa1`
- Classification: `RED/10kWh system gross margin candidate`, not confirmed membrane standalone external sale
- PRS use: `review-only`
- Formal score/R_net: do not use
- v8 return proposal: update possible for GP30 classification; keep membrane external sale blocked/review-only; no rollback

No DB write / DDL / migration / extractor implementation / code implementation / deploy was performed.

## 1. Sources read

- `/Users/masa/projects/AGENTS.common.md`
- `/Users/masa/projects/AMD/amd-os/AGENTS.md`
- `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
- `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
- `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md`
- `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`
- `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
- `/Users/masa/projects/AMD/amd-os/pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-02-p11-membrane-source-join-deep-dive.md`
- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v7.md`
- `pwa/bzm/runs/2026-06-02-p11-membrane-gate-source-join.md`
- `/Users/masa/projects/knowledge/BWE.md`
- `pwa/design/db_schema.md`

Read-only DB/REST scope:

- `source_cache`
- `project_knowledge`
- `monthly_reports`
- `project_meeting_summaries`
- `project_strategy_signals`
- `project_xrl_evidence`
- `billing_cycles`

Secrets and auth values are not included in this artifact.

## 2. Search scope table

The search used `project_id='p11'` and read-only Supabase REST. Result counts below are row counts after local keyword matching.

| table | rows checked | GP30/GP 30 | 30% | gross margin JP | membrane external | membrane technical | COGS basis | transaction | notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `source_cache` | 255 | 1 | 6 | 1 | 0 | 23 | 18 | 53 | Raw cache available. Exact GP30 row found. |
| `project_knowledge` | 245 | 1 | 2 | 2 | 0 | 2 | 0 | 9 | Two derived GP30 knowledge rows found. |
| `monthly_reports` | 15 | 0 | 0 | 0 | 0 | 1 | 1 | 6 | No GP30 / gross margin row. One RED/electrodialysis reference. |
| `project_meeting_summaries` | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | No GP30 / membrane sale / COGS hit. |
| `project_strategy_signals` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | No p11 rows visible in this table. |
| `project_xrl_evidence` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | No p11 rows visible in this table. |
| `billing_cycles` | 15 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | AMD billing only; not used for membrane gross margin. |

Keyword groups:

- `GP30 / GP 30`: `GP30`, `GP 30`
- `gross margin JP`: `粗利`, `総益率`, `粗利率`
- `membrane external`: `膜外販`, `外販`, `膜単体`
- `membrane technical`: `膜`, `イオン交換膜`, `電気透析`
- `COGS basis`: `COGS`, `原価`, `単価`, `工数`, `QA`, `物流`, `保証`, `在庫`, `歩留まり`
- `transaction`: `buyer`, `contract`, `invoice`, `payment`, `契約`, `請求`, `入金`

## 3. Candidate source table

| source id | table | matched text summary | classification | can_use_for_prs | why_not_formal_score_yet |
|---|---|---|---|---|---|
| `p11_gmail_19c98f0f1d7cea62` / row `d083a88f-04d8-4d99-9f61-b1be87b586cd` | `source_cache` | Gmail thread `Re: BWE売上`; from BWE 吉﨑 to 住友理工 濱田氏, with 濱田氏 reply: "10kwhシステムの総益率GP30%に下げました" and cash-positive plan note. | `RED_10kWh_system_gross_margin_candidate`; not membrane standalone external sale. | `review-only` | Raw text has GP30 but does not define SKU/unit, sales price, COGS components, buyer contract, invoice, payment, labor, QA, logistics, warranty, inventory, or yield. It points to an Excel revision, but the spreadsheet content is not joined in `source_cache`. |
| `904dbf36-5194-4df2-a860-d23810be0054` | `project_knowledge` | `濱田真彰`: 住友理工所属; "10kWhシステムの粗利率をGP30%に下げる判断を行った". | Derived knowledge from Gmail; person/fact extraction. | `review-only` | It is derived from the Gmail source and does not add the missing calculation basis or transaction join. |
| `239c5076-c1b5-4455-b6d1-34434bad6fa1` | `project_knowledge` | `10kWhシステム`: "粗利率（GP）を30%に設定。この条件でも現預金プラスが確保可能". | Derived knowledge from Gmail; system-level gross margin candidate. | `review-only` | It confirms the normalized interpretation as `10kWhシステム`, not membrane standalone sale. Still lacks COGS/price/contract/invoice/payment. |
| `/Users/masa/projects/knowledge/BWE.md` | local knowledge file | BWE ricework candidate: ion-exchange membrane could be mass-produced and sold standalone for electrodialysis or academia; membrane is also the main technical bottleneck. | `membrane_external_sale_candidate` and `bottleneck_source`; not GP30 source. | `review-only` | Supports membrane sale possibility and bottleneck duality, but has no GP30 row/source id, no COGS, no transaction join. |
| `p11_notion_30797749c6088069b41aff5ff74d074e` | `source_cache` | ATV/BWE meeting includes ion-exchange membrane cost-reduction and world electricity demand context. | Technical / fundraising context. | `review-only` | Not a GP30 source. Does not contain membrane sale gross margin, buyer, contract, invoice, payment, or COGS. |
| `p11_gmeet_minutes_199efd298a305fd2` | `source_cache` | MTG with 清水; discussion that membrane original cost may be cheap but existing suppliers sell at high price; cost lowering via volume. | Membrane cost negotiation / supplier economics context. | `review-only` | Not GP30. This is about upstream membrane procurement/supplier margin, not BWE external membrane sale gross margin. |
| `billing_cycles` p11 rows | `billing_cycles` | 15 p11 AMD billing rows, statuses mixed; no GP30/gross margin hit. | `amd_billing_or_research_contract`; cash timing only. | `exclude from PRS` | Billing rows are AMD billing, not BWE SU membrane sale revenue/gross margin. |

## 4. GP30 decision

Decision: `found exact`

The exact GP30 raw source exists in `source_cache`.

Important classification:

- The raw text says `10kwhシステムの総益率GP30%`.
- It does not say membrane standalone external sale.
- It does not identify membrane SKU, membrane unit price, membrane COGS, external membrane buyer, external membrane contract, membrane invoice, or membrane payment.
- It appears tied to a `BWE売上` thread and a revised Excel file shared with / edited by a Sumitomo Riko counterparty.

Therefore:

```yaml
p11_gp30_raw_source_status: found_exact
p11_gp30_raw_source_cache_id: p11_gmail_19c98f0f1d7cea62
p11_gp30_classification: RED_10kWh_system_gross_margin_candidate
p11_gp30_not_membrane_standalone_external_sale: true
p11_gp30_prs_use: review-only
p11_membrane_gp30_status: not_supported_by_found_gp30_source
```

## 5. Scope classification

| question | finding | status |
|---|---|---|
| Is the raw GP30 source found? | Yes. `source_cache.cache_id=p11_gmail_19c98f0f1d7cea62`. | `found_exact` |
| Is it membrane standalone external sale? | Not supported. Raw text says `10kwhシステム`. | `not_membrane_standalone` |
| Is it RED device / system component? | Stronger fit. The object is a `10kWh system`; likely closer to RED system revenue plan than membrane standalone. | `system_revenue_candidate` |
| Is it research contract cash? | No. It is not SIP / joint research / AMD billing in the raw GP30 text. | `not_research_contract_cash` |
| Is it unrelated / another PJ? | No, p11 BWE and Sumitomo Riko context. | `p11_related` |

## 6. COGS / unit / transaction join check

| item | found in exact GP30 source? | notes |
|---|---:|---|
| SKU / unit | No | `10kwhシステム` appears, but unit definition and deliverable boundary are not in cache. |
| Sales price | No | Email says an Excel was sent/revised; values are not in extracted text. |
| Gross margin percent | Yes | `GP30%` / `30%`. |
| COGS calculation | No | No material / manufacturing / outsourcing / QA / logistics / warranty / inventory / labor / yield basis. |
| COGS components | No | Not present in raw cache text. |
| Buyer / counterparty | Partial | Sumitomo Riko email counterparty is present, but this is not a signed buyer/order source. |
| Contract | No | No signed/draft sales contract joined. |
| Invoice | No | No external BWE invoice joined. |
| Payment | No | No payment confirmation joined. |
| Spreadsheet attachment | Mentioned, not joined | Email says Excel was sent and revised, but the source_cache row has no spreadsheet body or file id for the calculation. |

## 7. What was not found

No row was found that joins all of the following:

1. Membrane standalone sale as the target.
2. GP30% as membrane sale gross margin.
3. Membrane SKU/unit and sale price.
4. COGS basis including material, production/outsourcing, QA, logistics, warranty, inventory, labor, and yield.
5. Named external membrane buyer with contract/invoice/payment.

No exact GP30 hit appeared in:

- `monthly_reports`
- `project_meeting_summaries`
- `project_strategy_signals`
- `project_xrl_evidence`
- `billing_cycles`

## 8. v8 return proposal

### Update possible

Update v8 / next evidence card to distinguish the found GP30 source from membrane standalone sale:

```yaml
p11_gp30_raw_source_status: found_exact
p11_gp30_raw_source_cache_id: p11_gmail_19c98f0f1d7cea62
p11_gp30_classification: RED_10kWh_system_gross_margin_candidate
p11_gp30_prs_use: review-only
p11_gp30_missing_basis: price + COGS + contract + invoice + payment + system_scope
p11_membrane_gp30_status: not_supported_by_found_gp30_source
p11_membrane_external_sale_status: bottleneck_external_sale_candidate
p11_membrane_prs_use: review-only
```

### Blocked維持

Keep membrane external sale blocked/review-only:

- `p11_membrane_supply_capacity_status=blocked_missing_supply_allocation`
- `p11_membrane_cogs_status=not_currently_available`
- `p11_membrane_external_buyer_status=not_joined`
- `p11_membrane_contract_status=not_joined`
- `p11_membrane_invoice_status=not_joined`
- `p11_membrane_payment_status=not_joined`
- `p11_membrane_main_red_impact_status=requires_masa_or_bzm_review`

### No rollback

No rollback is needed for v7's core safety decision:

- `p11_membrane_prs_use=review-only`
- `p11_do_not_use_as=positive_R_net, formal_R_net_value, sales_actual, gross_margin_actual`
- SIP / joint research cash / policy demo / AMD billing separation remains correct.

But the wording `p11_membrane_gp30_status=candidate_not_joined_to_cogs` should be tightened, because the raw source now found points to a `10kWh system`, not membrane standalone sale.

Recommended replacement:

```yaml
p11_membrane_gp30_status: not_supported_by_found_gp30_source
p11_system_gp30_status: found_exact_but_missing_cogs_and_transaction_join
```

## 9. Commander judgement items

1. Decide whether v8 should split `p11_membrane_gp30_status` and `p11_system_gp30_status` as separate fields.
2. Decide whether `10kWh system GP30` should remain a p11 PRS comparison-layer source, but outside membrane external sale.
3. Decide whether to cut a follow-up source worker to locate the Excel/spreadsheet attachment referenced by `p11_gmail_19c98f0f1d7cea62`.
4. Keep membrane external sale `review-only` unless a separate membrane sale source appears with SKU, COGS, buyer, contract, invoice, payment, and RED main impact.
5. Keep billing/SIP/policy/AMD cash lanes separate from BWE SU gross margin.

## 10. Verification

- Read-only Supabase REST search completed with service-role credentials available in local env; secrets were not printed or written.
- Tables checked: `source_cache`, `project_knowledge`, `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals`, `project_xrl_evidence`, `billing_cycles`.
- Exact raw source found and classified.
- No DB write / DDL / migration / extractor implementation / code implementation / deploy.
- No formal R_net value, 0-9 score, formal rubric, 7-axis replacement, or historical score recalculation was performed.
