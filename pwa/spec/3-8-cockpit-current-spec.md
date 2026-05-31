# PJ Cockpit 仕様

> **この章は何か**: `/project/[projectId]/cockpit` の current contract。PJ の状態、月次運用、MS、経営ハイライト、AMD Score、MTGサマリを集約する中心画面。

## Route / Files

| route | file |
|---|---|
| `/project/[projectId]/cockpit` | `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx` |
| `/institutions/[institutionId]/cockpit` | `pwa/src/app/(app)/institutions/[institutionId]/cockpit/page.tsx` wraps an existing project cockpit in institution context |
| main component | `pwa/src/components/cockpit/CockpitView.tsx` |
| data fetch | `pwa/src/lib/supabase-data.ts` (`fetchCockpitFromSupabase`) |

## Data Bundle

`CockpitView` receives:

| field | meaning |
|---|---|
| `project` | `project_id`, name, status, category, fee/freeze info |
| `currentYm` | current display month |
| `billingCycles` | monthly routine and finance state |
| `planCycle` / `milestones` / `subItems` / `responsibilities` | value plan and MS |
| `progress` | `milestone_monthly_progress` |
| `reports` | `monthly_reports` excerpts and status |
| `members` / `memberMap` | PJ member display |
| `strategySignals` | L2⑨ `project_strategy_signals` |
| `tasks` | kanban tasks |
| `nudges` | cockpit nudges |

`proactive_outbox` は `CockpitData` bundle には混ぜず、`ProactiveQueuePanel` が authenticated browser Supabase client で read-only fetch する。RLS は admin authenticated read 前提で、権限がない場合は UI 内で非表示相当のメッセージにする。

## Permission

月次 routine の編集権限は:

- `members.is_admin=true`
- または `project_members.is_pm=true` and `is_active=true`

それ以外は表示のみ。

## Institution Card Entry

NIMS is represented as an existing ERS institution card, not as a new project row.

| institution | related project | behavior |
|---|---|---|
| `inst_nims` | `p20` (CX / CryoX) | `/dashboard` NIMS card opens `/institutions/inst_nims/cockpit`; the page shows ERS summary + MTG tree, then mounts the existing `CockpitView` for `p20` |

This route is read-only during load. It does not create a NIMS project or write production DB rows. If MS plan data is missing, the embedded normal cockpit shows the existing MS setup banner / monthly note fallback.

## Initial Modal Rules

| query | behavior |
|---|---|
| `?ym=YYYYMM` | monthly modal を開く |
| `?step=<stepId>&ym=YYYYMM` | stepId 対応 modal を開く |
| `?meeting=<meeting_id>` | MTG詳細 modal を優先。月次 modal と二重起動しない |

## Major Sections

| section | component | source |
|---|---|---|
| header | `CockpitHeader` | project metadata |
| venture status | `CockpitVentureStatus` | `project_ventures`, `project_xrl_log`, related data |
| AMD / Management score hero | `CockpitManagementScoreHero` | AMD Score / Management Score derived data |
| tabs | `CockpitView` | `進捗管理` / `スコア詳細` display state。SU 系 PJ では横幅いっぱいを2等分し、各タブのクリック領域も 1/2 にする |
| score detail tab | `CockpitAmdScoreDetailTab`, `AmdScoreView embedded` | `/api/project/[projectId]/amd-score-detail`。cockpit mount 時に hidden panel として先読みし、client memory cache 5 分TTL + private HTTP cache で再表示待ちを減らす。TTL 超過後にタブが active になったら、表示済み内容を保ったまま背景再取得する |
| goals compact | `CockpitGoalsCompact` | value plan / MS |
| TODO | `ProactiveQueuePanel` | `proactive_outbox` read-only。Dashboard は `queued`, `sent_to_commander`, `blocked` を最大3件、PJ cockpit は `queued`, `sent_to_commander`, `drafted`, `blocked` をPJ単位で表示。行クリックは発生経緯・資料リンク・次アクションのモーダル |
| strategy signals | `CockpitStrategySignals` | `project_strategy_signals` |
| routine | `CockpitRoutineGas` + routine modals | `billing_cycles` / GAS bridge / APIs |
| monthly list/modal | `CockpitMonthlyList`, `CockpitMonthlyModal` | reports / reward / progress |
| meeting summaries | `CockpitMeetingSummary` | `project_meeting_summaries` |
| legacy kanban | `CockpitKanbanGas` | `tasks`。2026-05-31 時点で PJ cockpit の主要導線からは外し、TODO は proactive queue へ寄せる |
| freeze / next period | `CockpitFreezeBackfill`, `CockpitNextPeriodSetup` | freeze and plan setup |

## Routine Step Contract

`CockpitRoutineGas` builds routine steps from `billing_cycles` and `projects.project_type / project_category`.

| project category / type | behavior |
|---|---|
| `project_category='advisor'` | routine panel shows 対象外. Step buttons are not rendered |
| standard project | step order = `budget`, `meeting`, `reportFix`, `reimburseConfirm`, `invoiceIssue`, `invoiceSend` |
| `project_type='ctb'` | step order = `estimateSend`, `budget`, `meeting`, `invoiceIssue`, `invoiceSend`, `reportFix`, `reimburseConfirm` |
| frozen / waiting restart / non-active | `CockpitView` hides live operations through `showLiveOperations` |
| non admin / non PM | routine panel is visible but wrapped with `pointer-events-none opacity-60` |

### Step ID Table

| stepId | label | done source | deadline | click behavior |
|---|---|---|---|---|
| `estimateSend` | 見積書送付 | `billing_cycles.invoice_base_lines_json` contains `[[CTB_ESTIMATE_SENT]]` | previous ym day 28, previous business day if weekend | opens `CockpitRoutineInvoiceModal` with `documentType='quotation'` |
| `budget` | 請求額確定 | `budget_confirmed_at` set or `status in ('budget_confirmed','allocation_confirmed')` | standard previous ym day 25 / CTB previous ym day 28, adjusted to previous business day | opens `CockpitRoutineBudgetModal` |
| `meeting` | 報告会日程調整 | `meeting_event_id` or `meeting_start_at` set | ym day 20, adjusted | opens `CockpitRoutineMeetingModal` |
| `reportFix` | 月次報告書FIX | `report_fixed_at` set | next ym day 3, adjusted | opens `CockpitMonthlyModal` with report tab |
| `reimburseConfirm` | 立替精算確認 | deadline has passed and `reimburse_confirm_done !== false` | next ym day 4, adjusted | routes to `/reimburse` |
| `invoiceIssue` | 請求書発行 | `invoice_issued_at` set | standard next ym day 8 / CTB ym day 28, adjusted | opens `CockpitRoutineInvoiceModal` with `documentType='invoice'` |
| `invoiceSend` | 請求書送付 | `invoice_sent_at` set | standard next ym day 9 / CTB ym day 28, adjusted | opens `CockpitRoutineInvoiceSendConfirm` |

If `billing_cycles.invoice_ym` is set and differs from `ym`, all steps except `reportFix` are rendered as deferred. The label becomes `<invoice month>月にまとめて請求`, `done=false`, and the active month handles the invoice work.

## Step Modal / API Contract

| modal | trigger | read | write / call | success state |
|---|---|---|---|---|
| `CockpitRoutineBudgetModal` | `budget` | `billing_cycles.status`, `budget_reported_amount`, `budget_buffer_amount`, `budget_reported_at`, `budget_reported_by`, `budget_confirmed_at`, `budget_yen`; `projects.fee_type`, `fee_amount` | update `billing_cycles` with `status='reported'`, `budget_reported_amount`, `budget_buffer_amount`, `budget_reported_at`, `budget_reported_by`; calls Edge Function `send-budget-approval-nudge`; approve/reject uses `/api/admin/budget-approval` | `budget_confirmed_at` set or status confirmed |
| `CockpitRoutineMeetingModal` | `meeting` | Edge Function `meeting-slots?projectId&ym` | Edge Function `schedule-meeting?projectId&ym&startISO&endISO` | local confirmed ISO + router refresh; later `billing_cycles.meeting_start_at` / `meeting_event_id` |
| `CockpitRoutineInvoiceModal` | `estimateSend` / `invoiceIssue` | `billing_cycles.invoice_base_lines_json`, `invoice_subject`, `freee_invoice_number`, `invoice_pdf_url`, `invoice_issued_at`, `budget_yen`, `budget_reported_amount`; previous invoice row; `projects.payment_due_rule`, `payment_due_day` | draft save updates `billing_cycles.invoice_subject` and `invoice_base_lines_json`; issue calls Edge Function `issue-invoice`; cancel calls Edge Function `cancel-invoice`; PL review notification via `notifyPlReview` | quotation marker in base lines or `invoice_issued_at` / freee fields set |
| `CockpitRoutineInvoiceSendConfirm` | `invoiceSend` | current billing row | update `billing_cycles.invoice_sent_at=now()` | `invoice_sent_at` set |
| `CockpitMonthlyModal` report tab | `reportFix` or monthly card | `monthly_reports`, `billing_cycles`, MS bundle | `/api/report/generate`, `/api/report/fix`, report edit APIs | `monthly_reports.status='fixed'` or `fixed_at` set |
| `CockpitMonthlyModal` reward/progress tab | monthly card | `milestone_monthly_progress`, `ms_progress_revisions`, `member_activities`, `project_monthly_notes`, `billing_cycles.reward_summary_json` | `/api/rewards/sync`, `/api/progress/estimate`, `/api/progress/confirm`, `/api/progress/revisions`, `/api/progress/batch-save`, `/api/project/monthly-note` | local progress patches + reward summary sync |

## Monthly / Reward Modal Contract

`CockpitMonthlyModal` has two tabs:

| tab | visible when | main responsibility |
|---|---|---|
| `reward` / 進捗確認 | billing cycle exists | MS progress confirmation, reward preview/sync, monthly note for non-MS PJ |
| `report` | report exists or `reportFix` open | monthly report generation/fix/edit |

Important rules:

- If a month has a `monthly_reports` row but no `billing_cycles` row, only report tab is shown.
- Reward budget derives from `billing_cycles.budget_yen`; if absent and project is `monthly_fixed`, `projects.fee_amount * 0.65` is used.
- `billing_cycles.reward_summary_json` is cached and refreshed through `/api/rewards/sync` or daily `cron/payout-reward-cache-refresh`.
- MS progress rows with human confirmation are not overwritten by routine estimation.
- `project_monthly_notes` is the current store for advisor / non-MS / MS-missing month progress notes.

## GAS / Edge Bridge Contract

PWA no longer calls GAS directly for the cockpit routine modals. It calls Supabase Edge Functions through `pwa/src/lib/supabase/edge-functions.ts`, which mirrors iOS `SupabaseService.callEdgeFunction`.

| function | caller | purpose |
|---|---|---|
| `meeting-slots` | `CockpitRoutineMeetingModal` | returns candidate report meeting slots |
| `schedule-meeting` | `CockpitRoutineMeetingModal` | creates/records the selected meeting slot |
| `send-budget-approval-nudge` | `CockpitRoutineBudgetModal` | notifies PL/admin for budget approval |
| `issue-invoice` | `CockpitRoutineInvoiceModal` | creates freee invoice or quotation and updates billing row |
| `cancel-invoice` | `CockpitRoutineInvoiceModal` | cancels issued invoice/quotation state |

GAS remains relevant for legacy freee/Slack/background automation, but cockpit modal actions should be rebuilt through the Edge Function bridge above unless a current file explicitly says otherwise.

## Failure Mode

| failure | behavior |
|---|---|
| `fetchCockpitFromSupabase` pending | spinner |
| fetch error | error message + reload button |
| score detail API returns 404 | tab shows a compact error; progress tab remains usable |
| PM check fails | routine edit disabled by default |
| unknown stepId | no modal or fallback modal based on resolver |
| project is advisor | routine shows 対象外 |
| invoice_ym deferred | non-report steps are deferred to invoice month |
| Edge Function fails | modal keeps open, shows error/toast, does not mark step done |
| report-only month | monthly modal opens report tab only |
| proactive_outbox RLS denies read | proactive queue shows admin-only fallback text and does not block the rest of cockpit |

## Validation

- `npx tsc --noEmit`
- `npm run build`
- route smoke after deploy: `/project/<projectId>/cockpit` auth redirect when logged out; logged-in admin sees cockpit.
- step link smoke: `/project/<projectId>/cockpit?ym=YYYYMM`, `?step=...&ym=...`, `?meeting=...`

## この章だけで再構築できること

PJ Cockpit の route、data bundle、編集権限、初期 query modal、major component map、routine stepId 全表、step modal の主要 API/DB write、monthly/reward modal の責務、Edge Function bridge を再構築できる。

## まだ再構築できないこと

Kanban の詳細 state machine、Meeting detail modal の attachment mutation、Cockpit score tabs の別worker差分、AMD Score hero の全表示 contract は未完。Admin / Finance / Reward spec 化フェーズで reward PDF / payout との境界も追加する。

## 確認したcurrent truth

- `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx`
- `pwa/src/components/cockpit/CockpitView.tsx`
- `pwa/src/components/cockpit/CockpitRoutineGas.tsx`
- `pwa/src/components/cockpit/CockpitRoutineBudgetModal.tsx`
- `pwa/src/components/cockpit/CockpitRoutineMeetingModal.tsx`
- `pwa/src/components/cockpit/CockpitRoutineInvoiceModal.tsx`
- `pwa/src/components/cockpit/CockpitRoutineInvoiceSendConfirm.tsx`
- `pwa/src/components/cockpit/CockpitMonthlyModal.tsx`
- `pwa/src/lib/supabase/edge-functions.ts`

## 未確認 / inferred

- Edge Function 内部の freee / Calendar / Slack side effect は未深掘り。ここでは PWA caller contract を current truth として固定している。
- cockpit score tabs は別worker作業中のため、この章では未確定扱い。

## 次に見る実装ファイル

- `pwa/src/components/cockpit/CockpitKanbanGas.tsx`
- `pwa/src/components/cockpit/CockpitMeetingDetailModal.tsx`
- `pwa/src/components/cockpit/CockpitManagementScoreHero.tsx`
- `ios/supabase/functions/*`
