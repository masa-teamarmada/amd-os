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
| `project` | `project_id`, name, status, category, fee/freeze info, payment terms, `contract_terms_json` summary |
| `currentYm` | current display month |
| `billingCycles` | monthly / finance state |
| `planCycle` / `milestones` / `subItems` / `responsibilities` | value plan and MS。`planCycle.budgetYen` と、同期間の `billing_cycles.extra_budget_yen` 合計で作る `planCycle.extraDesignBudgetYen` を使い、MSリストに本契約/別財布それぞれの設計額と、メンバー別の担当設計額を表示する |
| `progress` | `milestone_monthly_progress` |
| `reports` | `monthly_reports` excerpts and status |
| `members` / `memberMap` | PJ member display |
| `seasonFinance` | current plan cycle のシーズン収支。月次とシーズン合計で、クライアント支払、バッファ、PJ予算、メンバー現金支払、未払残、現金収支を返す。役員向け報酬相当額と予算残は検算用データとして保持するが、PJ cockpit では表示しない |
| `strategySignals` | L2D-6 `project_strategy_signals` |
| `tasks` | legacy kanban / H-1互換 task。通常PJ cockpit の主要表示には使わない |

`proactive_outbox` / `proactive_loops` / `proactive_loop_events` は 2026-06-27 に廃止済みの旧先手力ループであり、通常PJ / institution cockpit には表示しない。先手TODOの棚卸しは `proactive_todos` を使う `/proactive` と dashboard 上段バッジで扱う。旧 `ProactiveQueuePanel` を cockpit に戻さない。

`project_documents` も `CockpitData` bundle には混ぜず、`CockpitProjectDocuments` が `/api/project-documents?project_id=...` を fetch する。API は authenticated user の `members.email` を `project_members` に解決し、当該PJの active member または admin なら資料一覧を返す。ファイル本体は DB / Supabase Storage に置かず、Google Drive の `projects.drive_folder_id` 配下に作成する資料専用 folder (`AMD OS 資料`) へ保存し、DB には Drive file ID / folder ID / `webViewLink` / name / MIME / size / uploaded_by / timestamps だけを残す。

`tsukuyomi_nudge_queue` は通常PJ / institution cockpit の `CockpitView` へ渡さず、`CockpitNudge` カードも表示しない。既存の `fetchCockpitFromSupabase` が互換用に `nudges` を返す場合でも、この画面では読まない。HUD / dashboard 実験面で同じ queue を使う場合は、それぞれの専用コンポーネントの契約として扱う。

## Permission / Mutation Boundary

月次 routine 専用の `canEditRoutine` 判定は廃止。`/project/[projectId]/cockpit` / `/hud/project/[projectId]/cockpit` / `/institutions/[institutionId]/cockpit` の page route は PM/admin 判定を持たず、`CockpitView` / `HudCockpitView` に `canEditRoutine` を渡さない。

月次・報酬・資料・MTG の write 権限は、それぞれの API / RLS / admin route が判定する。cockpit 本体は authenticated read と各モーダル/APIへの導線を担当する。

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
| `?meeting=<meeting_id>` | MTG詳細 modal を優先。月次 modal と二重起動しない |
| `?step=<stepId>&ym=YYYYMM` | legacy query。現行 cockpit は step modal を持たず、`step` は解釈しない |

## Major Sections

| section | component | source |
|---|---|---|
| header | `CockpitHeader` | project metadata + PJリスト由来のサマリー。PJメンバー、契約条件、業務委託料、支払い条件、提出物の有無、月次報告書の状態・時期・提出期限・フォーマット・記載事項・根拠、立替精算可否を `projects` / `project_members` / `projects.contract_terms_json` から表示する |
| KUTE annual roadmap | `CockpitKuteAnnualRoadmap` | KUTE (`p25`) only。`CockpitHeader` 直下で、2026-06〜2027-03 の年度内ロードマップを表示する。規程整備レーンは 2027-01 整備完了目途、シーズ発掘 / after GTIE レーンは 2027-03 型化目途。現時点の source は 6/11 キックオフ資料 / `PROJECT_BRIEF` 由来の静的 contract |
| venture status | `CockpitVentureStatus` | `project_ventures`, `project_xrl_log`, related data |
| AMD / Management score hero | `CockpitManagementScoreHero` | AMD Score / Management Score derived data |
| tabs | `CockpitView` | `進捗管理` / `スコア詳細` display state。SU 系 PJ では横幅いっぱいを2等分し、各タブのクリック領域も 1/2 にする |
| score detail tab | `CockpitAmdScoreDetailTab`, `AmdScoreView embedded` | `/api/project/[projectId]/amd-score-detail`。PRS Primary / PRS history を主表示し、legacy AMD / M-X-F は comparison と evidence 用に残す。cockpit mount 時に hidden panel として先読みし、client memory cache 5 分TTL + private HTTP cache で再表示待ちを減らす。TTL 超過後にタブが active になったら、表示済み内容を保ったまま背景再取得する |
| goals compact | `CockpitGoalsCompact` | value plan / MS。`MilestoneGanttChart` の各MS行に pt / tag / 担当 / 進捗とあわせて `設計額` を表示し、バー上の担当者 chip には担当設計額も併記する。通常MSは plan cycle 予算、`cap_extra` は同期間の別財布予算から按分し、支払確定額としては扱わない |
| season finance | `CockpitSeasonFinance` | `fetchCockpitFromSupabase` が `billing_cycles`, `projects`, `reward_summary_json` から組み立てた `seasonFinance`。MS リスト直下、月次カードより上に表示し、シーズン全体と月次別に `クライアント支払` / `バッファ` / `原資上限` / `PJ予算` / `メンバー支払` / `期末未払` / `収支` を出す |
| project documents | `CockpitProjectDocuments` | 右カラム先頭の資料スペース。drag & drop / file picker で `/api/project-documents` へ multipart upload し、Drive の PJ folder 配下 `AMD OS 資料` folder に新規ファイルとして保存する。同名ファイルは上書きしない。リンク一覧は `project_documents` から取得し、Drive link を新規タブで開く |
| strategy signals | `CockpitStrategySignals` | `project_strategy_signals` |
| governance | `CockpitGovernance` | ガバナンス要対応 |
| grants | `CockpitGrants` | 助成金 / funding 関連 |
| monthly list/modal | `CockpitMonthlyList`, `CockpitMonthlyModal` | `billing_cycles`, reports / reward / progress |
| meeting summaries | `CockpitMeetingSummary` | `project_meeting_summaries` |
| legacy kanban | `CockpitKanbanGas` / `HudCockpitKanbanGas` | `tasks`。PJ cockpit / HUD cockpit の主要導線からは外す |
| freeze / MS status | `CockpitFreezeBackfill` | freeze backfill and read-only MS period status。MS 設計編集は `/admin/ms-overview` に集約する |

`CockpitMeetingSummary` の通常PJ cockpit表示は、一覧本体に `max-height` と `overflow-y-auto` を置かない。議事録カードや予定MTGカードが増えた場合もカード一覧を縦に伸ばし、コックピット全体のページスクロールで読む。HUD cockpit や detail modal の内部スクロールはこの制約の対象外。

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

## Removed PM Routine Step Contract

PM向けの cockpit 右カラム routine step UI は廃止済み。`CockpitRoutine.tsx` / `CockpitRoutineGas.tsx` / `HudCockpitRoutineGas.tsx` / `CockpitRoutine*Modal.tsx` は current implementation から削除し、`?step=` 起動も使わない。

現行の月次導線は `CockpitMonthlyList` / `HudCockpitMonthlyList` から月を選び、`CockpitMonthlyModal` / `HudCockpitMonthlyModal` を開く形に一本化する。月次報告書の軽い確認 nudge は Slack 側に寄せ、OS 上の月次 routine step は発生させない。契約 apply 済みPJでは、請求額は `contract-billing-auto-confirm` と admin billing / payouts 側で扱う。

`CockpitMonthlyModal` の月次報告書導線は、全PJ共通の `社内保存用を編集` と、提出が必要なPJだけに出す `提出用` リンクを分ける。社内保存用は `monthly_reports` 本文の生成・修正・FIXを扱い、提出用リンクは `/project/[projectId]/report/[ym]/print?template=...` を新規タブで開く。CX (`p20`) は `template=nims-cx`、SX (`p21`) は `template=ehime-sx`、KUTE (`p25`) は `template=kogakuin-kute` を使い、それ以外のPJは AMD 標準の `PDF` リンクだけを表示する。

## Monthly Modal / API Contract

| modal | trigger | read | write / call | success state |
|---|---|---|---|---|
| `CockpitMonthlyModal` report tab | monthly card / report-only month | `monthly_reports`, `billing_cycles`, MS bundle | `/api/report/generate`, `/api/report/fix`, report edit APIs | `monthly_reports.status='fixed'` or `fixed_at` set |
| `CockpitMonthlyModal` reward/progress tab | monthly card with billing cycle | `milestone_monthly_progress`, `ms_progress_revisions`, `member_activities`, `project_monthly_notes`, `billing_cycles.reward_summary_json` | `/api/rewards/sync`, `/api/progress/estimate`, `/api/progress/confirm`, `/api/progress/revisions`, `/api/progress/batch-save`, `/api/project/monthly-note` | local progress patches + reward summary sync |

## Monthly / Reward Modal Contract

`CockpitMonthlyModal` has two tabs:

| tab | visible when | main responsibility |
|---|---|---|
| `reward` / 進捗確認 | billing cycle exists | MS progress confirmation, reward preview/sync, monthly note for non-MS PJ |
| `report` | report exists or report-only month | monthly report generation/fix/edit |

Important rules:

- `CockpitSeasonFinance` は、PJ cockpit 上で今シーズンの収支を先に見せる安全網。クライアント支払は `contractBackedClientAmount` に `billing_cycles.extra_revenue_json` の別財布売上を按分加算する。schedule_based 契約では `contract_terms_json.monthlySchedule.amountTaxExcl` も予定売上として読む。バッファは `value_plan_cycles.buffer_breakdown_json` のシーズンバッファを優先し、未設定の PJ だけ `billing_cycles.budget_buffer_amount` を読む。原資上限は `(クライアント支払 - バッファ) × 65%`。PJ予算は `budget_yen + extra_budget_yen`、メンバー支払/未払残は `billing_cycles.reward_summary_json` を読む。表示する `収支` は現金主義で `クライアント支払 - バッファ - メンバー支払` とし、役員向け報酬相当額や未払残はその月の現金流出ではないため含めない。役員向け報酬相当額は検算には含めるが、PJ cockpit では表示しない。期末未払残または PJ予算の原資上限超過が 1 円でもある場合は不足表示にし、報酬計算側で最終月に自動上乗せしてゼロに見せない。
- If a month has a `monthly_reports` row but no `billing_cycles` row, only report tab is shown.
- Reward budget derives from `billing_cycles.budget_yen`; if absent and project is `monthly_fixed`, `projects.fee_amount * 0.65` is used.
- `billing_cycles.reward_summary_json` is cached and refreshed through `/api/rewards/sync` or daily `cron/payout-reward-cache-refresh`.
- MS progress rows with human confirmation are not overwritten by routine estimation.
- `project_monthly_notes` is the current store for advisor / non-MS / MS-missing month progress notes.

## GAS / Edge Bridge Contract

PWA cockpit no longer owns dedicated routine modals. Supabase Edge Functions remain shared infrastructure for admin billing / legacy flows and are called through `pwa/src/lib/supabase/edge-functions.ts` when a current caller exists.

| function | caller | purpose |
|---|---|---|
| `issue-invoice` | admin billing / legacy invoice API | creates freee invoice or quotation and updates billing row |
| `cancel-invoice` | admin billing / legacy invoice API | cancels issued invoice/quotation state |
| `meeting-slots` / `schedule-meeting` / `send-budget-approval-nudge` | legacy infrastructure | no active cockpit routine modal caller after routine UI deletion |

GAS remains relevant for legacy freee/Slack/background automation. New cockpit modal actions should not reintroduce the deleted PM routine step layer without a separate current spec update.

## Failure Mode

| failure | behavior |
|---|---|
| `fetchCockpitFromSupabase` pending | spinner |
| fetch error | error message + reload button |
| score detail API returns 404 | tab shows a compact error; progress tab remains usable |
| report-only month | monthly modal opens report tab only |
| old proactive_outbox row exists | 通常PJ / institution cockpit には表示しない。旧手動seedや `drafted` 行が残っても、PJ 状況面のノイズにしない |
| project_documents table missing | documents panel shows API error; cockpit remains usable |
| projects.drive_folder_id missing | documents panel shows folder-setting warning and upload is blocked |
| Google Drive write permission missing | upload returns permission error; no DB row is inserted |

## Validation

- `npx tsc --noEmit`
- `npm run build`
- dry API contract: `GET /api/project-documents?project_id=<id>` requires authenticated PJ active member or admin auth and returns documents / driveConfigured metadata.
- route smoke after deploy: `/project/<projectId>/cockpit` auth redirect when logged out; logged-in admin sees cockpit.
- query smoke: `/project/<projectId>/cockpit?ym=YYYYMM`, `?meeting=...`; `?step=...&ym=...` must not open a routine step modal.

## この章だけで再構築できること

PJ Cockpit の route、data bundle、初期 query modal、major component map、monthly/reward modal の責務、資料・MTG・D-6 表示、Edge Function bridge の現行境界を再構築できる。

## まだ再構築できないこと

Kanban の詳細 state machine、Meeting detail modal の attachment mutation、Cockpit score tabs の別worker差分、AMD Score hero の全表示 contract は未完。Admin / Finance / Reward spec 化フェーズで reward PDF / payout との境界も追加する。

## 確認したcurrent truth

- `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx`
- `pwa/src/components/cockpit/CockpitView.tsx`
- `pwa/src/components/cockpit/CockpitMonthlyList.tsx`
- `pwa/src/components/cockpit/CockpitMonthlyModal.tsx`
- `pwa/src/lib/supabase/edge-functions.ts`

## 未確認 / inferred

- Edge Function 内部の freee / Calendar / Slack side effect は未深掘り。ここでは current PWA caller contract を current truth として固定している。
- cockpit score tabs は別worker作業中のため、この章では未確定扱い。

## 次に見る実装ファイル

- `pwa/src/components/cockpit/CockpitKanbanGas.tsx`
- `pwa/src/components/cockpit/CockpitMeetingDetailModal.tsx`
- `pwa/src/components/cockpit/CockpitManagementScoreHero.tsx`
- `ios/supabase/functions/*`
