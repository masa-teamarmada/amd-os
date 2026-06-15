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
| `progress` | legacy互換列。0〜100 constraint は残すが、`/tasks` UI / agent helper では操作対象にしない |
| `parent_task_id` | mindmap edge。接続ハンドルをdragし始めたノードが親、到達先ノードが子。self-cycle / ancestor-cycle は API で拒否 |
| `mindmap_x` / `mindmap_y` | mindmap position |
| `active` | 論理表示フラグ。DELETEしない |
| `task_source` | `manual` などの生成元 |
| `agent_kind` | `codex` / `claude_code` など、会話中にタスクを登録・進行しているエージェント種別 |
| `agent_session_id` | Codex / Claude Code の thread/session id |
| `agent_session_url` | 該当セッションを開くためのURLまたは許可済みprotocol link |
| `agent_session_label` | `/tasks` 詳細ウィンドウに出すセッション表示名 |
| `created_by` / `updated_by` | 操作者 email |
| `position_updated_at` | mindmap座標保存時刻 |

Migration: `pwa/scripts/migrations/136_tasks_management_fields.sql`, `pwa/scripts/migrations/141_tasks_agent_session_fields.sql`

## API Contract

### `GET /api/tasks`

- login済み user、または `Authorization: Bearer ${CRON_SECRET}` の agent access を許可する。
- `tasks(active=true)`、`projects`、`members`、`member_profiles`、active `project_members` を返す。
- 全PJ/全員を横断する要件のため、API route 内では `createAdminClient()` で read する。
- agent access 用に `status` / `projectId` / `assigneeMemberId` / `taskSource` / `agentKind` / `agentSessionId` / `limit` query を受ける。`status=open` は `done` と `archived` を除外する。未指定なら従来どおり全active taskを返す。

### `POST /api/tasks`

- `projectId` 必須。
- `task_id` は `task_YYYYMMDDhhmmss_<suffix>` 形式でAPIが生成する。
- `title` が空なら `新規タスク`。
- `assigneeMemberId` があれば `members.code_name` を `assignee` に同期し、旧カンバン互換を保つ。
- `task_source='manual'`, `active=true`。
- `taskSource` / `agentKind` / `agentSessionId` / `agentSessionUrl` / `agentSessionLabel` を受け取り、Codex / Claude Code のえいみが会話中に発生したタスクを登録できる。agent accessで `taskSource` 未指定なら `agent`。
- agent access、または `taskSource` が `manual` 以外の作成では、`app_notifications(kind='task_created', source='task_agent')` をbest-effort insertし、トップナビ通知ベルと `/notifications` からタスク追加に気づけるようにする。通知insert失敗でタスク作成自体は失敗させない。

### `PATCH /api/tasks`

- `taskId` 必須。
- title / description / project / assignee / status / priority / start/due / parent / mindmap position / active / source / agent session fields を部分更新する。`progress` は後方互換でAPI入力を受けるが、UI/agent helperからは露出しない。
- `parentTaskId` 更新時は、全active taskの `parent_task_id` chain を見て循環を拒否する。
- `mindmapX` / `mindmapY` 更新時は `position_updated_at` も更新する。
- `agent_session_*` は `npm run agent:tasks -- attach-session` から既存タスクに紐づける想定。既存タスクを進める別セッションを可視化するため、新規taskを重複作成しない。

## UI Contract

### Filters

PJ filter、担当 filter、status filter、text search を同一ツールバーに置く。status の既定は `all` (= `done` を含む全status。ただし `archived` は隠す)。`all_with_archived` は `archived` まで含める。`open` は `done` / `archived` 以外。

### Mindmap

- canvas は scrollable 2D plane。ノードはカードではなく円形node + 外側labelで表示する。
- canvas は CSS scale で `0.35x` から `2.25x` まで拡大縮小できる。trackpad pinch は `ctrl/meta wheel` として処理し、touch pinch は2 pointer distanceで処理する。入力distance/ wheel delta をそのままzoomへ入れず、指数/係数で減衰させ、atlas map 相当の緩いズーム変化にする。
- 空白クリックでクリック位置を初期座標にした optimistic node を即時追加し、作成済みノードの右側に詳細ウィンドウを開く。新規タスクのタイトル入力は空のまま表示し、`新規タスク` などのプレースホルダー文言は入れない。詳細ウィンドウは実寸を測って viewport 内へ再clampし、生成ノードが下寄りでも下にはみ出さない位置に移動してタイトル入力へfocusする。`POST /api/tasks` は裏で実行し、成功時に temporary id を server id へ差し替え、失敗時は optimistic node を戻す。ユーザー自身の作成にはtoastを出さず、node/formの即時表示をフィードバックにする。
- 詳細ウィンドウの保存は、画面上のnode/formを即時反映してmodalを閉じ、`PATCH /api/tasks` は裏で実行する。タイトル入力で Enter を押した場合も保存ボタンと同じ処理を実行する。IME変換中の Enter は変換確定を優先する。server id 未確定の optimistic node では、初回 `POST` 完了後に同じ保存内容を `PATCH` する。
- ノード本体は pointer drag で移動する。移動dragは edge 作成に使わない。親タスクをdragした場合は、表示中かどうかにかかわらず子孫タスクの座標も同じdeltaで追従させ、Ctrl+Z / Cmd+Z では親子まとめて1操作として戻す。位置は画面へ先に反映し、保存は裏で実行する。
- ノードhoverは、rootの `translate(x,y)` を変えずに内部visualだけをその場で少しscaleする。hoverで右へずれる挙動は不可。
- ノードクリックで詳細/編集ウィンドウをノード右側かつ上寄せに開く。詳細ウィンドウは backdrop / blur を出さず、header drag で移動できる。削除はheader側にも出し、スクロールしなくても押せるようにする。フォームは幅480px基準、PC幅では `label / control / label / control` の横詰めgrid、control height 28px、description min height 56px 程度の小さめfont / 控えめなgapで高密度に表示する。
- 詳細ウィンドウは常にcompactな Session 行を表示する。`agent_session_url` が安全なURL/protocolなら別タブlink、URLが無ければ session id/label のtext表示、セッション未設定なら `session未設定` を表示する。
- 詳細ウィンドウの削除ボタン、または詳細ウィンドウ本体にフォーカスした状態の Backspace は、画面から即時除去して裏で `PATCH /api/tasks active=false` を実行する。DB `DELETE` は使わない。入力欄フォーカス中の Backspace は文字編集として扱う。
- Ctrl+Z / Cmd+Z は、入力欄フォーカス外なら直前の create / delete / edge patch / position patch を local undo stack から復元し、必要な逆向き `PATCH` を裏で実行する。
- ノード色は status ごとに分ける。`todo` は黄、`doing` はteal、`done` は青、`review` はindigo、`blocked` はrose、`pending` と `archived` はzinc系。`archived` は既定表示から除外し、`all_with_archived` または個別 `archived` filter で表示する。現在表示中の子タスクが3つ以上ある親ノードはhub扱いとして、cyan系の強調ringと子数badgeを追加する。
- ノード下のstatus表示にhoverすると status popover を表示する。popover内のstatusをclickすると、modalを開かずに画面上のnodeを即時更新し、裏で `PATCH /api/tasks { status }` を実行する。失敗時は元のstatusへ戻し、Ctrl+Z / Cmd+Z でも直前のstatus変更を戻せる。
- ノード配置は atlas map と同じ hard collision 型の反発を display layout に適用し、近いノード同士の重なりを避ける。
- ノード輪郭hoverで表示される `+` 接続ハンドルをclickすると、source node を親にした新規子タスクを source の右側へ optimistic 作成する。source が temporary id の場合は子タスクを画面上へ即時追加し、source の server id 解決後に `parentTaskId` を保存する。
- 同じ `+` 接続ハンドルから別ノードの輪郭へdragすると、画面上は即時接続し、裏で `target.parent_task_id=source.task_id` を保存する。
- 接続drag直後のclick eventは空白クリック作成として扱わない。edge接続と新規作成が同じpointer操作で混線しないこと。
- edge は `parent_task_id` から SVG 直線pathで描く。curveは使わない。arrow marker は子タスクから親タスクへ向かう表示にする。

### Gantt

- PJごとに section を分ける。
- section 上部の空白行クリックで、そのPJの作成dialogを開く。
- task row は親→子のtree順に並べ、子タスクはindentと枝線で親子関係を明示する。子を持つ親には子数badgeを表示する。
- task row は title / assignee / status と、start/due に基づく status色bar を表示する。progress数値や進捗barは出さない。
- row click で編集dialogを開く。

## Authority / Safety

- `/tasks` は `(app)` 配下なので login 必須。
- API mutation は authenticated user、または `CRON_SECRET` を持つ Codex / Claude Code agent のみ。DB write は `service_role` で行い、browser anon key から直接 `tasks` を書かせない。
- RLS は `authenticated SELECT`, `is_admin() ALL`, `service_role ALL` を定義する。既存 cockpit kanban 互換のため read は authenticated 全体に開く。
- DELETE / TRUNCATE / DROP は使わない。非表示は `active=false`。
- Agent helper: `cd pwa && npm run agent:tasks -- list|create|update|attach-session ...`。script は production `/api/tasks` を `Authorization: Bearer ${CRON_SECRET}` で叩き、`task_source` と `agent_session_*` を保存する。`archived` status を扱えるが、`progress` はhelperの操作対象にしない。agentが `create` した場合、作成したえいみは同じセッション内で `タスク追加: <title> (<task_id>)` を短く伝える。

## Validation

- TypeScript: `npx tsc --noEmit`
- Build: `npm run build`
- Script smoke: `npm run agent:tasks -- help`
- Browser: `/tasks` を開き、top nav、default all status表示(done含む/archived除外)、archived込みfilter、mindmap空白クリック即時作成(ユーザー作成toastなし)、下寄り作成時の詳細ウィンドウviewport内clamp + title focus、Session未設定の常時表示、progress非表示、status別ノード色、status hover popupからの即時変更、タイトル Enter 保存、`+` click子タスク即時作成、子→親の直線arrow、hover時の位置固定scale、緩いpinch/zoom、node click詳細、詳細の上寄せ/高密度/blurなし/header削除/drag、Backspace削除、Ctrl+Z復元、親node位置drag時の子孫追従、`+` handle drag edge、gantt親子indent/子数badge/status色bar、gantt空白行作成を確認する。
