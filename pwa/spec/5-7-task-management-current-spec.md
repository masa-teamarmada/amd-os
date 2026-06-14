# OS Task Management 仕様

> **この章は何か**: `/tasks` の全PJタスク管理、mindmap / gantt UI、`tasks` テーブル拡張、API mutation、権限境界の確定仕様。

## Surface

| surface | contract |
|---|---|
| top nav | `GlobalNav` に `タスク` を追加し、`/tasks` へ遷移する |
| page route | `pwa/src/app/(app)/tasks/page.tsx` |
| client UI | `pwa/src/components/tasks/TasksClient.tsx` |
| API | `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks` |
| table | `tasks` |

## Data Model

既存 `tasks` は cockpit legacy kanban の正本として存在していたため、新テーブルを作らず `tasks` を非破壊で拡張する。

| column | purpose |
|---|---|
| `assignee_member_id` | `members.member_id` への正規担当。既存 `assignee` text は互換表示用に維持 |
| `start_date` / `due_date` | ガント期間 |
| `progress` | 0〜100。`tasks_progress_range` constraint |
| `parent_task_id` | mindmap edge。接続ハンドルをdragし始めたノードが親、到達先ノードが子。self-cycle / ancestor-cycle は API で拒否 |
| `mindmap_x` / `mindmap_y` | mindmap position |
| `active` | 論理表示フラグ。DELETEしない |
| `task_source` | `manual` などの生成元 |
| `created_by` / `updated_by` | 操作者 email |
| `position_updated_at` | mindmap座標保存時刻 |

Migration: `pwa/scripts/migrations/136_tasks_management_fields.sql`

## API Contract

### `GET /api/tasks`

- `requireAuth()` 必須。
- `tasks(active=true)`、`projects`、`members`、`member_profiles`、active `project_members` を返す。
- 全PJ/全員を横断する要件のため、API route 内では `createAdminClient()` で read する。

### `POST /api/tasks`

- `projectId` 必須。
- `task_id` は `task_YYYYMMDDhhmmss_<suffix>` 形式でAPIが生成する。
- `title` が空なら `新規タスク`。
- `assigneeMemberId` があれば `members.code_name` を `assignee` に同期し、旧カンバン互換を保つ。
- `task_source='manual'`, `active=true`。

### `PATCH /api/tasks`

- `taskId` 必須。
- title / description / project / assignee / status / priority / start/due / progress / parent / mindmap position / active を部分更新する。
- `parentTaskId` 更新時は、全active taskの `parent_task_id` chain を見て循環を拒否する。
- `mindmapX` / `mindmapY` 更新時は `position_updated_at` も更新する。

## UI Contract

### Filters

PJ filter、担当 filter、status filter、text search を同一ツールバーに置く。status の既定は `open` (= `done` 以外)。

### Mindmap

- canvas は scrollable 2D plane。ノードはカードではなく円形node + 外側labelで表示する。
- canvas は CSS scale で `0.35x` から `2.25x` まで拡大縮小できる。trackpad pinch は `ctrl/meta wheel` として処理し、touch pinch は2 pointer distanceで処理する。
- 空白クリックでクリック位置を初期座標にした optimistic node を即時追加し、作成済みノードの右側に詳細ウィンドウを開く。`POST /api/tasks` は裏で実行し、成功時に temporary id を server id へ差し替え、失敗時は optimistic node を戻す。
- ノード本体は pointer drag で移動する。移動dragは edge 作成に使わない。位置は画面へ先に反映し、保存は裏で実行する。
- ノードクリックで詳細/編集ウィンドウをノード右側に開く。詳細ウィンドウは backdrop / blur を出さず、header drag で移動できる。
- 詳細ウィンドウの削除ボタン、または詳細ウィンドウ本体にフォーカスした状態の Backspace は、画面から即時除去して裏で `PATCH /api/tasks active=false` を実行する。DB `DELETE` は使わない。入力欄フォーカス中の Backspace は文字編集として扱う。
- Ctrl+Z / Cmd+Z は、入力欄フォーカス外なら直前の create / delete / edge patch / position patch を local undo stack から復元し、必要な逆向き `PATCH` を裏で実行する。
- ノード色は `done` を青、`done` 以外を黄にする。
- ノード配置は atlas map と同じ hard collision 型の反発を display layout に適用し、近いノード同士の重なりを避ける。
- ノード輪郭hoverで表示される `+` 接続ハンドルから別ノードの輪郭へdragすると、画面上は即時接続し、裏で `target.parent_task_id=source.task_id` を保存する。
- 接続drag直後のclick eventは空白クリック作成として扱わない。edge接続と新規作成が同じpointer操作で混線しないこと。
- edge は `parent_task_id` から SVG path で描き、親から子へ向かう arrow marker を付ける。

### Gantt

- PJごとに section を分ける。
- section 上部の空白行クリックで、そのPJの作成dialogを開く。
- task row は title / assignee / status / progress と、start/due に基づく bar を表示する。
- row click で編集dialogを開く。

## Authority / Safety

- `/tasks` は `(app)` 配下なので login 必須。
- API mutation は authenticated user のみ。DB write は `service_role` で行い、browser anon key から直接 `tasks` を書かせない。
- RLS は `authenticated SELECT`, `is_admin() ALL`, `service_role ALL` を定義する。既存 cockpit kanban 互換のため read は authenticated 全体に開く。
- DELETE / TRUNCATE / DROP は使わない。非表示は `active=false`。

## Validation

- TypeScript: `npx tsc --noEmit`
- Build: `npm run build`
- Browser: `/tasks` を開き、top nav、mindmap空白クリック即時作成、pinch/zoom、node click詳細、詳細drag、Backspace削除、Ctrl+Z復元、node位置drag、`+` handle drag edge、gantt空白行作成を確認する。
