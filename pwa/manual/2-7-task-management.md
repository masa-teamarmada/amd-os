# タスク管理

`/tasks` は、全PJ・全メンバーのタスクを横断して見る画面。トップナビの **タスク** から入る。

## 画面

| view | できること |
|---|---|
| マインドマップ | タスクを2D空間に丸ノードとして置く。空白をクリックすると、その位置に新規タスクを画面へ即時追加し、DB保存は裏で走る。新規タイトルは空のまま開き、プレースホルダー文言は入れない。ノード右側に詳細ウィンドウを開く。ピンチ/trackpad pinch とズームボタンで拡大縮小できる。ノードクリックで背景をぼかさない詳細ウィンドウを開き、ウィンドウ上部をdragして移動できる。ノード自体のdragは位置移動、輪郭hoverで出る `+` ハンドルから別ノードの輪郭へdragすると、開始ノードが親、到達ノードが子になる。作成・保存・削除・接続・移動は画面へ先に反映し、失敗時だけ戻す |
| ガント | PJごとにタスクを縦に並べ、start / due の期間バー、担当、status、progressを見る。PJセクションの空白行をクリックすると、そのPJの新規タスクを作成する |

## フィルタ

- PJ filter: 全PJまたは1PJに絞る。
- 担当 filter: 全員または1メンバーに絞る。
- status filter: 未完了、全status、個別statusを切り替える。
- 検索: title / description / PJ名 / member名を横断する。

## タスク項目

| 項目 | 意味 |
|---|---|
| title / description | タスク本文 |
| project | 紐付くPJ |
| assignee | 担当メンバー。既存互換の `assignee` text と、正本の `assignee_member_id` を両方保持する |
| status | `pending` / `todo` / `doing` / `review` / `blocked` / `done` |
| priority | `low` / `medium` / `high` / `urgent` |
| start / due | ガント表示の期間 |
| progress | 0〜100% |
| parent | マインドマップの親タスク。1タスクにつき親は1つ |
| position | マインドマップ上の x/y 座標 |

## 操作ルール

- 詳細ウィンドウの削除ボタン、または詳細ウィンドウ本体にフォーカスした状態の Backspace は、物理削除ではなく `active=false` にする。入力欄フォーカス中の Backspace は文字編集を優先する。
- Ctrl+Z / Cmd+Z は、入力欄フォーカス外なら直前の作成・削除・接続・移動を取り消す。
- マインドマップは完了ノードを青、未完ノードを黄で表示する。子タスクが3つ以上ある親ノードはcyanリングと子数バッジでhub表示する。近いノード同士は atlas map と同じ hard collision 系の反発で重なりを避ける。
- マインドマップのedgeは `parent_task_id` で表す。画面では親から子へ向かう矢印として描く。循環する親子関係はAPIで拒否する。
- 接続ハンドルからのdrag後は、同じpointer操作を空白クリック作成として扱わない。
- タスクの作成・更新は `/api/tasks` が `requireAuth()` 後に `service_role` で行う。
- `/tasks` は authenticated user が全PJタスクを横断表示するための画面。細かい外部送信やカレンダー書き込みは行わない。

## 既存カンバンとの関係

PJ cockpit / HUD に残る旧カンバンは、既存 `tasks.task_id / title / project_id / status / assignee / priority` を読み続ける。`/tasks` は同じ `tasks` テーブルを拡張して使うため、既存カンバンのデータはそのまま見える。
