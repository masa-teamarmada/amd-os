# タスク管理

`/tasks` は、全PJ・全メンバーのタスクを横断して見る画面。トップナビの **タスク** から入る。

## 画面

| view | できること |
|---|---|
| 今日の業務デスク | 画面上部で、期限が今日/今週のタスク、期限超過、確認待ち、停止、えいみ/agent由来の巻き取り候補を自動集約して表示する。既存 `tasks` の read-only 整理レイヤーで、ここから新しいDB書き込みや外部送信はしない。行やフォーカスカードを開くと通常のタスク詳細ウィンドウに入る |
| マインドマップ | タスクを2D空間に丸ノードとして置く。空白をクリックすると、その位置に新規タスクを画面へ即時追加し、DB保存は裏で走る。新規タイトルは空のまま開き、プレースホルダー文言は入れない。ノード右側かつ上寄せに詳細ウィンドウを開き、生成位置が下寄りならウィンドウ実寸に合わせて画面内へ引き上げ、タイトル入力へfocusする。タイトル入力で Enter を押すと即時保存して閉じる。ピンチ/trackpad pinch とズームボタンで拡大縮小でき、ズーム変化は緩めに補正する。ノードクリックで背景をぼかさない詳細ウィンドウを開き、ウィンドウ上部をdragして移動できる。詳細は横詰めgrid + 小さな入力枠の高密度表示で、削除はheaderからも押せる。ノードhoverは位置をずらさず、その場で少し拡大する。ノード自体のdragは位置移動で、親タスクを動かすと子孫タスクも同じdeltaで追従する。輪郭hoverで出る `+` ハンドルのclickはそのノードを親にした子タスクを右側へ即時追加し、`+` ハンドルから別ノードの輪郭へdragすると開始ノードが親、到達ノードが子になる。作成・保存・削除・接続・移動は画面へ先に反映し、失敗時だけ戻す |
| ガント | PJごとにタスクを縦に並べ、親→子のtree順、子タスクのindent/枝線、親の子数badgeで親子関係を見る。start / due の期間バー、担当、statusを見る。PJセクションの空白行をクリックすると、そのPJの新規タスクを作成する |

## フィルタ

- PJ filter: 全PJまたは1PJに絞る。
- 担当 filter: 全員または1メンバーに絞る。
- status filter: 既定は全status表示。ただし `archived` は隠す。未完了、個別status、`archived` まで含めた全表示にも切り替えられる。
- 検索: title / description / PJ名 / member名を横断する。

## タスク項目

| 項目 | 意味 |
|---|---|
| title / description | タスク本文 |
| project | 紐付くPJ |
| assignee | 担当メンバー。既存互換の `assignee` text と、正本の `assignee_member_id` を両方保持する |
| status | `pending` / `todo` / `doing` / `review` / `blocked` / `done` / `archived` |
| priority | `low` / `medium` / `high` / `urgent` |
| start / due | ガント表示の期間 |
| parent | マインドマップの親タスク。1タスクにつき親は1つ |
| position | マインドマップ上の x/y 座標 |
| source / session | `manual` / `codex` / `claude_code` などの登録元と、進行中のAIセッションID・リンク |

## 操作ルール

- 詳細ウィンドウの削除ボタン、または詳細ウィンドウ本体にフォーカスした状態の Backspace は、物理削除ではなく `active=false` にする。入力欄フォーカス中の Backspace は文字編集を優先する。
- タイトル入力で Enter を押すと保存ボタンと同じ処理を走らせる。IME変換中の Enter は変換確定を優先する。
- Ctrl+Z / Cmd+Z は、入力欄フォーカス外なら直前の作成・削除・接続・移動を取り消す。親タスク移動で子孫が追従した場合も、まとめて1操作として戻る。
- マインドマップのノード色はstatusごとに分ける。TODOは黄、Doingはteal、Doneは青、Reviewはindigo、Blockedはrose、Pending/Archivedはzinc系。`archived` は既定表示から外れる。子タスクが3つ以上ある親ノードはcyanリングと子数バッジでhub表示する。近いノード同士は atlas map と同じ hard collision 系の反発で重なりを避ける。
- ノード下のstatus表示にマウスオーバーすると、status選択ポップアップが出る。ここで選ぶとモーダルを開かずに画面へ即時反映し、裏で保存する。失敗時は元に戻り、Ctrl+Z / Cmd+Zでも直前のstatus変更を戻せる。
- 詳細ウィンドウには常に `Session` 行が出る。URLがある場合はリンクから該当セッションを開ける。URLが無い場合は session id / label、何も無ければ `session未設定` を表示する。
- マインドマップのedgeは `parent_task_id` で表す。画面では子タスクから親タスクへ向かう直線矢印として描く。循環する親子関係はAPIで拒否する。
- 接続ハンドルのclickは、そのタスクを親にした新規子タスクを親ノードの右側へ即時作成する。親がまだtemporary idの場合も画面上は先に親子関係を見せ、server id 確定後に保存する。
- 接続ハンドルからのdrag後は、同じpointer操作を空白クリック作成として扱わない。
- タスクの作成・更新は `/api/tasks` が login user または `CRON_SECRET` 付きagent accessを確認した後、server-side `service_role` で行う。
- 画面から新規タスクを作成した場合は、ノード / row / 詳細ウィンドウの即時表示をフィードバックとし、追加toastは出さない。Codex / Claude Code などagent accessから新規タスクを作成した場合は、作成したえいみが同じセッション内で `タスク追加: <title> (<task_id>)` を短く伝える。agent作成は `app_notifications(kind='task_created')` にも積み、トップナビの通知ベルと `/notifications` から後追い確認できる。
- `/tasks` は authenticated user が全PJタスクを横断表示するための画面。細かい外部送信やカレンダー書き込みは行わない。

## えいみからの登録

Codex / Claude Code のえいみは、会話中に新しい作業が発生したらチャット内TODOだけで終えず、OSタスクへ登録する。

```bash
cd /Users/masa/projects/AMD/amd-os/pwa
npm run agent:tasks -- list --status open --limit 20
npm run agent:tasks -- create --project p00 --title "タスク名" --agent codex --session-id "<thread-or-session-id>" --session-url "<session-url>"
npm run agent:tasks -- attach-session --task "<task_id>" --agent claude_code --session-id "<session-id>" --session-url "<session-url>"
```

- 既存タスクを進めるだけなら `attach-session` を使い、重複タスクを作らない。
- `--agent codex` / `--agent claude_code` が `task_source` と `agent_kind` に残る。
- `--session-id` / `--session-url` / `--session-label` は詳細ウィンドウの `Session` 行に出る。
- `create` で新規登録したら、OS通知任せにせず、その場の会話で `タスク追加: <title> (<task_id>)` をまさに伝える。
- `--status archived` は通常の全status表示からは隠れる。archived込みで確認したい時は `/tasks` の `全status + archived` を使う。

## 既存カンバンとの関係

PJ cockpit / HUD に残る旧カンバンは、既存 `tasks.task_id / title / project_id / status / assignee / priority` を読み続ける。`/tasks` は同じ `tasks` テーブルを拡張して使うため、既存カンバンのデータはそのまま見える。
