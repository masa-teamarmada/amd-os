# Task Data / API 互換仕様

> **この章は何か**: 廃止済み `/tasks` 画面と、互換維持のため残す `tasks` table / API の境界を固定する。

## Deprecated Surface

| surface | status |
|---|---|
| top nav `タスク` | 廃止 |
| page route `/tasks` | 廃止 |
| client UI `TasksClient` | 削除 |
| mindmap / gantt / business desk UI | 廃止。機能温存しない |
| `npm run agent:tasks` helper | 廃止 |

## Kept Surface

| surface | status |
|---|---|
| table `tasks` | 既存 cockpit / H-1 互換のため残す |
| `GET /api/tasks` | 既存 task read / agent access 互換として残す |
| `POST /api/tasks` / `PATCH /api/tasks` | 既存 caller 互換として残す。通知 link は PJ cockpit へ向ける |
| `POST /api/task-calendar/register-tasks` | H-1 next action 登録の現役 API として残す |
| `POST /api/task-calendar/schedule-plan` | Calendar 作業枠 dry-run planner として残す |

## Data Boundary

既存 `tasks` は cockpit legacy kanban の正本として存在していたため、画面廃止と同時に table / row を削除しない。

| column | purpose |
|---|---|
| `task_id`, `project_id`, `title`, `status`, `assignee`, `priority` | cockpit / HUD 互換列。意味を変えない |
| `assignee_member_id` | `members.member_id` への正規担当。既存 `assignee` text は互換表示用 |
| `start_date` / `due_date` | H-1 や planner が使う作業期間 |
| `parent_task_id`, `mindmap_x`, `mindmap_y` | `/tasks` 画面時代の列。既存データ保持のみ |
| `active` | 論理表示フラグ。DELETE ではなく `active=false` |
| `task_source`, `agent_kind`, `agent_session_*` | 生成元・旧 agent session 履歴。新規 agent helper の主導線にはしない |

Migration history: `pwa/scripts/migrations/136_tasks_management_fields.sql`, `pwa/scripts/migrations/141_tasks_agent_session_fields.sql`

## API Contract

### `/api/tasks`

- authenticated user、または `Authorization: Bearer ${CRON_SECRET}` の agent access を許可する。
- DB write は `service_role` 経由。browser client から直接 `tasks` を書かせない。
- `DELETE` / physical removal は使わない。非表示は `active=false`。
- agent / non-manual source 由来の `app_notifications(kind='task_created')` は残すが、`link` は `/tasks` ではなく `/project/{projectId}/cockpit` にする。

### `/api/task-calendar/register-tasks`

- H-1 Meeting Flow が MTG から生まれた next action を `tasks` に登録する入口。
- 重複は `task_id` で止め、既存 task には既定で再通知しない。
- Slack nudge は担当者本人だけへ送る。本文リンクは対象 PJ cockpit へ向ける。
- admin review queue は作らない。

### `/api/task-calendar/schedule-plan`

- 作業枠候補を返す dry-run planner。
- PWA は Calendar event を直接作成しない。

## Validation

- TypeScript: `npx tsc --noEmit`
- Build: `npm run build`
- H-1 register smoke: `npm run test:task-calendar-register`
- Critical UI: `npm run test:critical-ui`

## Removal Rule

今後 `tasks` table / `/api/tasks` を削除する場合は、先に cockpit / HUD / H-1 / task-calendar planner の current caller を再確認し、別の永続先へ移してから実施する。今回の廃止対象は `/tasks` の画面・ナビ・agent helper であり、DB/API の破壊的削除ではない。
