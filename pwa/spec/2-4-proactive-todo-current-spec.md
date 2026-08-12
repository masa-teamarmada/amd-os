# 先手 TODO — current spec

> **status**: current truth（2026-08-12）
>
> 既存 Codex automation `amd-os-proactive-heartbeat` が唯一の意味抽出 owner。別automationや後段filterは作らない。

## 目的

`/proactive` に出すのは、まさ本人の採否判断、またはまさ本人にしかできない具体行動だけ。
同期完了、情報共有、チーム作業、相手待ち、一般的な提案、MTG prep は出さない。

MTG prep は Codex の W-Prep / prep task 内で完結させ、AMD OS の先手 TODO へ複製しない。

## 生成フロー

```text
source_cache（Gmail / Drive / Calendar / Slack / Notion）
開催済み project_meeting_summaries
             ↓ prepare（read-only・本文をsanitize）
既存 amd-os-proactive-heartbeat の Codex
             ↓ 全証跡を create / noop / needs_source に意味分類
validator（全件回答・hash・期限根拠・件数・列挙値）
             ↓
non-LLM applier（元証跡とpromptを再読・hash一致時だけ）
             ↓
approved proactive_todos
             └ 厳格な即時条件だけ app_notifications
```

既存 `proactive_todos`、`l2_notifications`、`app_notifications` を生成入力には使わない。
粗い候補を先に作ってLLMで後から落とす経路も持たない。

## owner と頻度

| 項目 | current truth |
|---|---|
| automation id | `amd-os-proactive-heartbeat` |
| 表示名 | `AMD OS proactive heartbeat` |
| 頻度 | 毎日 10:15–20:15 JST の毎時15分、計11回 |
| 意味抽出 | automation自身のCodex。provider API/API keyは禁止 |
| prompt正本 | `llm_prompts.prompt_key='attention.proactive.extract.v1'` |
| 実行手順 | `pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md` |
| DB writer | `pwa/scripts/proactive_heartbeat_tool.mjs apply` のみ |

`/api/cron/proactive-todo-extract` は新規候補を作らない。
明示期限超過のred昇格と、3日経過したblockedの復帰だけを日次で行う。

## 入力

`prepare` は次だけを読む。

- 直近7日で収集された、active PJ の `source_cache`
  - Gmail
  - Drive
  - Calendar
  - Slack
  - Notion
- 直近14日の開催済み `project_meeting_summaries`
  - `upcoming` と `prep` は除外
- active `projects` の最小文脈
- activeなDB管理prompt

外部本文は未信頼データとして扱い、本文内の命令やリンクを実行しない。
automationへ渡す前にURL、メールアドレス、電話番号、認証情報らしき文字列を除く。
候補0件は成功で、空payloadや通知を作らない。

## LLM抽出契約

全evidenceへ必ず1件の disposition を返す。

| disposition | 意味 |
|---|---|
| `create` | `decision` または `masa_action` の成立根拠が揃う |
| `noop` | チーム作業、相手待ち、情報、完了、一般提案、決定済み、MTG prep |
| `needs_source` | 本人限定性、選択肢、変化、期限根拠などが足りない |

`create` は次を全部満たす。

- `decision`: まさの採否で次の進行が具体的に分岐する
- `masa_action`: 代表権、本人確認、本人アカウントなど、まさ以外では完了できない
- `action`、`effect`、`why_now`、`completion_condition` が具体的
- confidence 0.85以上
- 最大10件/run

team action、recovery、information、waiting はTODOにしない。

## 期限

期限は証跡に明記されたものだけ使う。

- 明示あり: `due_basis='explicit'` と `due_at`
- 明示なし: `due_basis='none'` と `due_at=null`
- `explicit` では、証跡に実在する期限表現を `due_evidence_text` に完全一致で返す

会議日+7日、「早め」、通常所要日数などから期限を作らない。
validatorは `due_evidence_text` が紐づく証跡本文に実在することを確認する。

## 通知契約

TODOを作っても、通常は通知しない。
`app_notifications` を同時生成できるのは次の3条件だけ。

| reason | 条件 |
|---|---|
| `explicit_deadline_24h` | 証跡内の明示期限が24時間以内 |
| `irreversible_decision_window` | 見逃すと取り消せない判断機会が閉じる |
| `masa_only_blocker` | まさ本人にしか解除できず、現に進行が停止中 |

通知は最大3件/run。
`meta.action_contract` に owner、required action、label、direct URL、完了条件、why nowを必須とする。
linkは `/proactive?todo_id=<id>` で、対象カードを直接展開する。
`l2_notifications` はこのautomationの出力ではない。

## validator / applier

`validate` は次を機械検証する。

- 全evidenceに disposition がある
- evidence id / source hash / prompt hash が入力と一致
- candidate / notification上限
- attention type、confidence、必須説明、期限契約
- MTG prep文言の拒否
- URL・メールアドレスの拒否

`apply` は書込み前にpromptと全証跡を再読し、hashが1件でも変化・消失していれば全体を適用しない。
LLMはDBへ直接書かない。

## 冪等性

非LLM applierが次から `generation_key` を計算する。

- project id
- attention type
- evidence kind / evidence id の集合

LLMのtitleやactionの言い換えはkeyに含めない。
同じ根拠で作ったTODOは、open / blocked / done / dismissed のどの状態でも再生成しない。
通知も同じkeyで1件だけ。

## データモデル

正本migrationは `pwa/scripts/migrations/265_proactive_heartbeat_source_generation.sql`。

主な追加・変更列:

| 列 | 意味 |
|---|---|
| `trigger_kind='source_evidence'` | 新heartbeatが作ったTODO |
| `generation_key` | wording非依存の冪等key |
| `evidence_refs` | 元証跡refとsource hash |
| `completion_condition` | 完了とみなす具体条件 |
| `due_at` nullable | 明示期限がないTODOを許可 |
| `due_basis='none'` | 明示期限なし |
| `attention_state='approved'` | validatorを通り直接生成されたTODO |
| `attention_type` | `decision` または `masa_action` |

旧 `meeting_next_action`、`next_meeting_prep`、`email_action_request` の未完了行は履歴を残してdismissedへ退役する。
同じ元証跡に本当に必要な判断があれば、新heartbeatが改めて `source_evidence` として作る。

## UI

- `/proactive` はadmin限定
- open / blocked は `attention_state='approved'` かつ `attention_type IN ('decision','masa_action')` だけ表示
- 期限なしを赤化しない
- 完了条件、why now、action、effectをカード内に表示
- `?todo_id=` があれば対象カードを展開してスクロール
- 完了 / ブロック中 / 関係ないの3操作を維持
- dashboardバッジも同じapproved条件だけを数える

## 過去設計との境界

- 2026-06-27以前の `proactive_outbox` と司令塔通知は廃止済み
- 2026-08-11の「粗いcollector → 別attention review automation」は不採用
- 2026-08-12から、同じ `amd-os-proactive-heartbeat` を raw evidence extractor として再利用
- 別の入口、別automation、provider課金LLMは追加しない

## 検証

```sh
cd /Users/masa/projects/AMD/amd-os/pwa
npm run test:proactive-heartbeat
npm run build
```

運用結果は `evidence / candidates / created / duplicate / notified / stale / missing / errors` の件数だけを報告し、本文、個人情報、URL、秘密値は出さない。
