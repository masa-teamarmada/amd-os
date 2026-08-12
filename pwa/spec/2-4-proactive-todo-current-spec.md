# 先手 TODO — current spec

> **status**: current truth（2026-08-12）

## 目的と通知との境界

`/proactive` は、まさが実行する業務TODOの一覧。
`/notifications` は、候補をOS正本へ採用するか不採用にするかの最終判断UI。
両者を同じ生成物にしない。

MTG prep は Codex の W-Prep / prep task 内で完結させ、AMD OS の先手TODOへ複製しない。
保存完了、情報共有、チーム作業、相手待ち、一般的提案、会議next actionを自動的にまさのTODOへ昇格させない。

## current writer

新規 `proactive_todos` の汎用自動生成は停止中。
`/api/cron/proactive-todo-extract` は既存行のライフサイクル維持だけを行う。

- 明示期限を過ぎたopen行のred昇格
- 3日経過したblocked行のopen復帰
- 新規TODO、L2通知、アプリ通知は作らない

旧 `meeting_next_action`、`next_meeting_prep`、`email_action_request` の未完了行は削除せずdismissedで履歴を残す。
候補の精度基準と正本反映先が定義されるまで、元証跡から汎用TODOを再生成しない。

## automation境界

既存 automation id `amd-os-proactive-heartbeat` は、名前の履歴を保ったままL2採否判断レビューへ役割を訂正した。
先手TODOのwriterではない。

| 項目 | current truth |
|---|---|
| automation id | `amd-os-proactive-heartbeat` |
| 現在の役割 | `l2_notifications` の最終判断カード生成 |
| 先手TODOへの書込み | しない |
| app通知への書込み | しない |
| provider課金LLM | 禁止 |
| 実行手順 | `pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md` |

## データモデル

`proactive_todos` は既存列を維持する。migration 265で追加した列は履歴互換のため残すが、停止した汎用生成経路では使わない。

- `attention_state='approved'`
- `attention_type IN ('decision','masa_action')`
- `generation_key`
- `evidence_refs`
- `completion_condition`
- nullable `due_at`
- `due_basis='none'`

## UI

- `/proactive` はadmin限定
- open / blocked は `attention_state='approved'` かつ `attention_type IN ('decision','masa_action')` だけ表示
- `due_basis='explicit'` だけを期限超過・redとして扱う
- MTG prepは表示しない
- 完了 / ブロック中 / 関係ないの解決操作は維持する
- dashboardバッジも同じapproved条件だけを数える

## 禁止

- `source_cache` や会議next actionから、保存先のない汎用TODOを大量生成する
- 正本採否候補を先手TODOへ変換する
- 先手TODOを理由に通常の `app_notifications` を作る
- provider API/API keyで定期LLM判定する

## 検証

```sh
cd /Users/masa/projects/AMD/amd-os/pwa
npm run test:proactive-heartbeat
npm run build
```
