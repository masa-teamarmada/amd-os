# PJ Cockpit 仕様

> **この章は何か**: `/project/[projectId]/cockpit` の current contract。PJ の状態、月次運用、MS、経営ハイライト、AMD Score、MTGサマリを集約する中心画面。

## Route / Files

| route | file |
|---|---|
| `/project/[projectId]/cockpit` | `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx` |
| `/institutions/[institutionId]/cockpit` | `pwa/src/app/(app)/institutions/[institutionId]/cockpit/page.tsx` wraps an existing project cockpit in institution context |
| main component | `pwa/src/components/cockpit/CockpitView.tsx` |
| data fetch | `pwa/src/lib/supabase-data.ts` (`fetchCockpitFromSupabase`) |
| project documents | `pwa/src/components/cockpit/CockpitProjectDocuments.tsx`, `pwa/src/app/api/project-documents/route.ts` |

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
| `strategySignals` | L2D-6 `project_strategy_signals` |
| `tasks` | kanban tasks |
| `nudges` | cockpit nudges |

`proactive_outbox` は `CockpitData` bundle には混ぜず、`ProactiveQueuePanel` が authenticated browser Supabase client で read-only fetch する。RLS は admin authenticated read 前提で、権限がない場合は UI 内で非表示相当のメッセージにする。

`project_documents` も `CockpitData` bundle には混ぜず、`CockpitProjectDocuments` が `/api/project-documents?project_id=...` を fetch する。API は authenticated user の `members.email` を `project_members` に解決し、当該PJの active member または admin なら資料一覧を返す。ファイル本体は DB / Supabase Storage に置かず、Google Drive の `projects.drive_folder_id` 配下に作成する資料専用 folder (`AMD OS 資料`) へ保存し、DB には Drive file ID / folder ID / `webViewLink` / name / MIME / size / uploaded_by / timestamps だけを残す。

## Permission

月次 routine の編集権限は:

- `members.is_admin=true`
- または `project_members.is_pm=true` and `is_active=true`

それ以外は表示のみ。

## Institution Card Entry

Research-institution ecosystem work is represented as an ERS institution card first, not as a normal dashboard PJ list item. Dashboard exclusion uses `project_category='ecosystem'` plus the known KUTE row (`p25` / KUTE label) so production data drift does not make KUTE reappear in the normal PJ list. The related project row remains as the operational cockpit data source, so existing MS, monthly, MTG, and cockpit content is preserved.

| institution | related project | behavior |
|---|---|---|
| `inst_kute` | `p25` (KUTE) | `/dashboard` shows KUTE in the research institution ERS list, not in the normal PJ list. The institution card opens `/institutions/inst_kute/cockpit`; `進捗管理` mounts the existing `CockpitView` for `p25` so the current KUTE PJ cockpit content remains reachable |
| `inst_nims` | `p20` (CX / CryoX) | `/dashboard` NIMS card opens `/institutions/inst_nims/cockpit`; the page shows institution summary / readiness snapshot first, then `進捗管理` / `スコア詳細` tabs. `進捗管理` mounts the existing `CockpitView` for `p20` and keeps the MTG tree below it. `スコア詳細` shows ERS axis/criterion detail, not SU AMD Score |

This route is read-only during load. It does not create a duplicate project or write production DB rows. If MS plan data is missing, the embedded normal cockpit shows the existing MS setup banner / monthly note fallback. MTG tree must not be the first visible block after the institution header; research institution cockpit uses the same high-level information architecture as PJ cockpit: summary first, progress tab for operational state, score detail tab for score evidence.

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
| score detail tab | `CockpitAmdScoreDetailTab`, `AmdScoreView embedded` | `/api/project/[projectId]/amd-score-detail`。PRS Primary / PRS history を主表示し、legacy AMD / M-X-F は comparison と evidence 用に残す。cockpit mount 時に hidden panel として先読みし、client memory cache 5 分TTL + private HTTP cache で再表示待ちを減らす。TTL 超過後にタブが active になったら、表示済み内容を保ったまま背景再取得する |
| goals compact | `CockpitGoalsCompact` | value plan / MS |
| TODO | `ProactiveQueuePanel` | `proactive_outbox` read-only。Dashboard は `queued`, `sent_to_commander`, `blocked` を最大3件、PJ cockpit は `queued`, `sent_to_commander`, `drafted`, `blocked` をPJ単位で表示。DBから多めに読み、期限超過 / blocked / queued / sent_to_commander / priority / due_at でUI側sort後、`outbox_id` 重複を排除する。行クリックは発生経緯・`proactive_loop_events` 履歴・資料リンク・外部送付可否・次アクションのモーダル |
| project documents | `CockpitProjectDocuments` | TODO と経営ハイライトの間に置く資料スペース。drag & drop / file picker で `/api/project-documents` へ multipart upload し、Drive の PJ folder 配下 `AMD OS 資料` folder に新規ファイルとして保存する。同名ファイルは上書きしない。リンク一覧は `project_documents` から取得し、Drive link を新規タブで開く |
| strategy signals | `CockpitStrategySignals` | `project_strategy_signals` |
| routine | `CockpitRoutineGas` + routine modals | `billing_cycles` / GAS bridge / APIs |
| monthly list/modal | `CockpitMonthlyList`, `CockpitMonthlyModal` | reports / reward / progress |
| meeting summaries | `CockpitMeetingSummary` | `project_meeting_summaries` |
| legacy kanban | `CockpitKanbanGas` / `HudCockpitKanbanGas` | `tasks`。PJ cockpit / HUD cockpit の主要導線からは外し、TODO は proactive queue へ寄せる |
| freeze / next period | `CockpitFreezeBackfill`, `CockpitNextPeriodSetup` | freeze and plan setup |

## Meeting Summary Notion CTA

`CockpitMeetingSummary` shows `project_meeting_summaries` rows as past MTG summaries plus upcoming/tentative prep cards. Each row and detail modal exposes a Notion transcription path without starting recording from AMD OS:

| data state | UI |
|---|---|
| `notion_url` exists | `Notion文字起こし` opens the Notion page in a new tab |
| `source_kinds='upcoming'` and `notion_url` empty but `source_url` exists | `Calendarから開始` opens the Calendar event so the user can start Notion transcription from Notion/Calendar context |
| no `notion_url` and no usable `source_url` | `Notion未連携` disabled state |

The card header includes `メモ再読込`, which refetches `project_meeting_summaries` for the current project and updates the open detail modal if the selected row was refreshed. This is for cases where L6 later backfills `notion_url` / eventId. The PWA does not call a Notion recording API, does not create Notion pages, and does not perform DB DDL for this CTA.

## Meeting Summary Inline Editing

`CockpitMeetingDetailModal` uses one visible section model for display and edit mode. The `表示内容を編集` action turns the currently displayed sections into textarea controls in place:

| display state | editable source |
|---|---|
| held/dialogue row has `narrative_md` | `title`, `summary_short`, and the visible `narrative_md` body |
| held/dialogue row has no `narrative_md` | `title`, visible `summary_short`, `decided`, `progress`, `next_actions`, `risks` |
| upcoming/tentative row | `title`, `summary_short`, `narrative_md`, `decided`, `progress`, `next_actions`, `risks` through `POST /api/meeting-prep` |

For upcoming/tentative rows, `risks` is labeled as `必ず確認すること`. Legacy values that were written under the older `気をつけたい読み違い` label are not deleted; they are displayed and edited as confirmation items.

## Project Documents Contract

PJ cockpit の「資料」は、PJ全体で使う資料リンク置き場。MTG単位の添付資料 (`meeting_assets`) とは別で、会議に紐づかない提案書・試算表・契約案・参考PDFなどを置く。MTG単位の新規添付は `project_meeting_summaries.meeting_date` と `title` から `YYMMDD_会議名` folder を作り、同じ PJ folder 配下へ保存する。

| item | contract |
|---|---|
| source project folder | `projects.drive_folder_id` |
| dedicated folder | `AMD OS 資料` under the source project folder. Missing if upload時に作成 |
| upload API | `POST /api/project-documents` with `project_id` and `files[]` multipart form |
| list API | `GET /api/project-documents?project_id=<id>` |
| DB table | `project_documents` (`pwa/scripts/migrations/131_project_documents_drive_uploads.sql`) |
| DB payload | Drive file ID / project folder ID / dedicated folder ID / `webViewLink` / file name / MIME / size / uploaded_by / timestamps |
| file body | Google Drive only. DB and Supabase Storage do not store the body |
| duplicate handling | no delete / overwrite. Drive same-name files are allowed, so every upload creates a new file |
| auth | PWA API requires authenticated user. Read/upload/markdown preview/edit are allowed for active `project_members` of the target PJ or admin. Google credential must have Drive write scope and access to the PJ folder |

### MTG単位添付 (`meeting_assets`)

| item | contract |
|---|---|
| UI | `MeetingAssetsPanel` in MTG detail modal |
| upload types | general files, including md / docx / xlsx / pptx / txt / csv / zip / images / PDF |
| new file body | Google Drive only: `projects.drive_folder_id` / `YYMMDD_会議名` / uploaded file |
| folder naming | `YYMMDD` from `project_meeting_summaries.meeting_date`; meeting title sanitized for Drive-safe name |
| duplicate folder | find existing folder with same name under the PJ folder, then reuse |
| DB payload | `meeting_assets` keeps Drive file ID / project folder ID / meeting folder ID / folder name / `webViewLink` / file name / MIME / size / uploaded_by / timestamps |
| legacy compatibility | existing Storage-backed rows remain readable through `/api/meeting-assets/file/{asset_id}` |
| UI save path | show `保存先: PJフォルダ / YYMMDD_会議名`; raw credential/secret values are not shown |
| preview | images/PDF keep existing preview/link behavior; Markdown (`.md` / `.markdown`) opens in an OS modal; other non-preview files use file link + metadata |

If `projects.drive_folder_id` is empty, the panel shows a folder-setting warning. If Google credential is missing or has read-only / no shared-folder permission, upload returns a permission error and the panel keeps a retry action. The rest of the cockpit remains usable.

## Routine Step Contract

`CockpitRoutineGas` builds the PM monthly check from `billing_cycles` and `projects.project_category`.

| project category / type | behavior |
|---|---|
| `project_category='advisor'` | monthly check panel shows 対象外. Step buttons are not rendered |
| standard project | step order = `reportFix` only |
| `project_type='ctb'` | same as standard. CTB estimate step is disabled while CTB is frozen |
| frozen / waiting restart / non-active | `CockpitView` hides live operations through `showLiveOperations` |
| non admin / non PM | monthly check panel is visible but wrapped with `pointer-events-none opacity-60` |

### Step ID Table

| stepId | label | done source | deadline | click behavior |
|---|---|---|---|---|
| `reportFix` | 月次報告書確認 | `report_fixed_at` set | next ym day 3, adjusted | opens `CockpitMonthlyModal` with report tab |
| `budget` | 請求額確定 | `budget_confirmed_at` set or `status in ('budget_confirmed','allocation_confirmed')` | n/a for PM monthly check | exception-only direct step, opens `CockpitRoutineBudgetModal` |

`budget` は cockpit の例外復旧用 step として残すが、PM monthly check には表示しない。契約 apply 済みPJでは `/mypage` の PM/PL 月次nudgeと報酬除外判定にも使わない。契約書由来の金額と対象月の報酬額が見えていることを前提に、請求額は `contract-billing-auto-confirm` が自動確定する。

`reportFix` は「これでいい？」nudgeであり、未対応でも `/mypage` の月次報酬から除外しない。PM monthly check は報酬計算や支払可否の gate ではない。

If `billing_cycles.invoice_ym` is set and differs from `ym`, PM monthly check is unchanged because only `reportFix` is rendered. Invoice deferral is handled in admin billing / payouts.

## Step Modal / API Contract

| modal | trigger | read | write / call | success state |
|---|---|---|---|---|
| `CockpitRoutineBudgetModal` | `budget` | `billing_cycles.status`, `budget_reported_amount`, `budget_buffer_amount`, `budget_reported_at`, `budget_reported_by`, `budget_confirmed_at`, `budget_yen`; `projects.fee_type`, `fee_amount` | update `billing_cycles` with `status='reported'`, `budget_reported_amount`, `budget_buffer_amount`, `budget_reported_at`, `budget_reported_by`; calls Edge Function `send-budget-approval-nudge`; approve/reject uses `/api/admin/budget-approval` | `budget_confirmed_at` set or status confirmed |
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
| project_documents table missing | documents panel shows API error; cockpit remains usable |
| projects.drive_folder_id missing | documents panel shows folder-setting warning and upload is blocked |
| Google Drive write permission missing | upload returns permission error; no DB row is inserted |

## Validation

- `npx tsc --noEmit`
- `npm run build`
- dry API contract: `GET /api/project-documents?project_id=<id>` requires authenticated PJ active member or admin auth and returns documents / driveConfigured metadata.
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
