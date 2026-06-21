# タスク管理（廃止済み）

`/tasks` 画面は 2026-06-21 に廃止した。トップナビの **タスク** 導線、マインドマップ / ガント UI、Codex / Claude Code 用の `npm run agent:tasks` helper は使わない。

## 現在の扱い

| 項目 | 状態 |
|---|---|
| `/tasks` page route | 廃止。直アクセスしてもアプリ画面は存在しない |
| GlobalNav | `タスク` 導線は表示しない |
| `TasksClient` | 削除済み。マインドマップ / ガント / 今日の業務デスクは温存しない |
| `npm run agent:tasks` | 廃止。新しい会話中タスクをここへ登録しない |
| `tasks` table | 既存互換のため残す |
| `/api/tasks` | 既存データと H-1 連携のため残す |
| `/api/task-calendar/register-tasks` | H-1 が次アクションを登録し、担当者へ nudge する入口として残す |
| `/api/task-calendar/schedule-plan` | Calendar 作業枠 dry-run planner として残す |

## 残す理由

`tasks` はもともと PJ cockpit / HUD の旧 TODO / kanban 系データとして存在していた。さらに H-1 Meeting Flow は、MTG から生まれた次アクションを `POST /api/task-calendar/register-tasks` 経由で `tasks` に登録する。

そのため今回は、画面としての `/tasks` と agent helper は廃止するが、DB table と API は削除しない。`tasks` の物理削除、DROP、既存 row の一括削除はしない。

## ユーザー導線

日常の TODO / nudge は、PJ cockpit の TODO 面や H-1 の MTGカード文脈で確認する。H-1 が自動登録した task 通知や Slack nudge は、廃止済み `/tasks` ではなく対象 PJ の `/project/{projectId}/cockpit` へ戻す。

## 既存データの注意

- `tasks.task_id / project_id / title / status / assignee / priority` は cockpit 互換列として意味を変えない。
- `active=false` は非表示扱いとして残す。物理削除はしない。
- `agent_session_*` など `/tasks` 時代に追加した列は、既存 row の履歴として残す。新規運用の主導線にはしない。
- `action_items` は別レーンの inbound 義務管理であり、`tasks` の置換対象ではない。
