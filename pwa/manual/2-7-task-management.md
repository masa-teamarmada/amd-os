# タスク管理

`/tasks` は、全PJ・全メンバーのタスクを横断して見る画面。トップナビの **タスク** から入る。

## 画面

| view | できること |
|---|---|
| マインドマップ | タスクを2D空間に置く。空白をクリックすると、その位置に新規タスクを作成する。タスクカードを別タスクへdropすると、drop先が親、dragしたタスクが子になる |
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

- タスクは削除しない。非表示にする場合は `active=false` を使う。
- マインドマップのedgeは `parent_task_id` で表す。循環する親子関係はAPIで拒否する。
- タスクの作成・更新は `/api/tasks` が `requireAuth()` 後に `service_role` で行う。
- `/tasks` は authenticated user が全PJタスクを横断表示するための画面。細かい外部送信やカレンダー書き込みは行わない。

## 既存カンバンとの関係

PJ cockpit / HUD に残る旧カンバンは、既存 `tasks.task_id / title / project_id / status / assignee / priority` を読み続ける。`/tasks` は同じ `tasks` テーブルを拡張して使うため、既存カンバンのデータはそのまま見える。
