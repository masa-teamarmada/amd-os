# PJ Cockpit 仕様

> **この章は何か**: `/project/[projectId]/cockpit` の current contract。PJ の状態、月次運用、MS、経営ハイライト、AMD Score、MTGサマリを集約する中心画面。

## Route / Files

| route | file |
|---|---|
| `/project/[projectId]/cockpit` | `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx` |
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

## Permission

月次 routine の編集権限は:

- `members.is_admin=true`
- または `project_members.is_pm=true` and `is_active=true`

それ以外は表示のみ。

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
| tabs | `CockpitView` | `進捗管理` / `スコア詳細` display state |
| score detail tab | `CockpitAmdScoreDetailTab`, `AmdScoreView embedded` | `/api/project/[projectId]/amd-score-detail` |
| goals compact | `CockpitGoalsCompact` | value plan / MS |
| strategy signals | `CockpitStrategySignals` | `project_strategy_signals` |
| routine | `CockpitRoutineGas` + routine modals | `billing_cycles` / GAS bridge / APIs |
| monthly list/modal | `CockpitMonthlyList`, `CockpitMonthlyModal` | reports / reward / progress |
| meeting summaries | `CockpitMeetingSummary` | `project_meeting_summaries` |
| kanban | `CockpitKanbanGas` | `tasks` |
| freeze / next period | `CockpitFreezeBackfill`, `CockpitNextPeriodSetup` | freeze and plan setup |

## Failure Mode

| failure | behavior |
|---|---|
| `fetchCockpitFromSupabase` pending | spinner |
| fetch error | error message + reload button |
| score detail API returns 404 | tab shows a compact error; progress tab remains usable |
| PM check fails | routine edit disabled by default |
| unknown stepId | no modal or fallback modal based on resolver |

## Validation

- `npx tsc --noEmit`
- `npm run build`
- route smoke after deploy: `/project/<projectId>/cockpit` auth redirect when logged out; logged-in admin sees cockpit.
- step link smoke: `/project/<projectId>/cockpit?ym=YYYYMM`, `?step=...&ym=...`, `?meeting=...`

## 再構築可能性チェック

この章で cockpit の data bundle、権限、初期 modal、主要 component 配置は再構築できる。まだ不足しているのは、routine `stepId` ごとの完全な modal/action table、reward/monthly report modal の詳細、GAS bridge の function-level contract。
