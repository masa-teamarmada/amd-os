# 注意・判断の生成境界

更新日: 2026-08-12

## current truth

先手TODOは、粗い候補を先に作ってLLMで後段審査する方式ではない。
既存 automation `amd-os-proactive-heartbeat` が、元の業務証跡から `decision` / `masa_action` だけを直接生成する。
詳細契約は [先手 TODO current spec](../spec/2-4-proactive-todo-current-spec.md) を正本とする。

## 注意面へ出してよいもの

1. `decision`: まさの採否で次の行動が具体的に分岐する
2. `masa_action`: まさ本人にしかできず、完了条件を具体的に言える

次は出さない。

- 保存、同期、抽出件数などの事後報告
- MTG prep
- チームメンバーが行う作業
- 相手待ち、情報共有、一般的な提案
- 根拠不足
- 推測期限しかないものを「期限切迫」とする通知

## 表示契約

| source | 注意面の条件 |
|---|---|
| `proactive_todos` | `approved` かつ `decision` / `masa_action` |
| `app_notifications` | `approved` かつ `decision` / `masa_action`、完全な `action_contract`。`connector_auth` の直接復旧だけ既存例外 |
| `l2_notifications` | 先手TODOの生成・通知経路には使わない |
| `meeting_notifications` | 会議記録。注意面・未読数へ混ぜない |

## なぜ後段filterをやめるか

候補生成が文字列ヒューリスティックなら、後段LLMは「大量の悪い候補を捨てる」仕事になる。
入力にない判断候補は発見できず、候補テーブル自体もノイズで膨らむ。

そのため意味判断を入口へ移した。

- 入力: `source_cache` 5系統と開催済み会議要約
- LLM: Codex automation自身。従量課金APIは禁止
- 出力: validatorを通ったapproved TODO
- 通知: 24h以内の明示期限、不可逆な判断窓、本人限定blockerだけ
- 書込み: source hashを再検証する非LLM applierだけ

候補ゼロは正常であり、空payloadや「何もなかった」通知を作らない。
