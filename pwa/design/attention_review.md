# 注意・判断ゲート

更新日: 2026-08-12

## 目的

自動抽出された候補と、まさが今判断・対応する項目を分離する。
collector が見つけたこと、OSへ保存できたこと、会議記録が増えたことは、それだけでは通知理由にならない。

## 注意面へ出してよいもの

次のどちらかだけを `approved` にする。

1. `decision`: まさの採用・不採用で、反映先や次の行動が実際に変わる。
2. `masa_action`: まさ本人にしかできない具体行動があり、完了条件を一文で言える。

次は注意面へ出さない。

- 保存完了、同期完了、抽出件数などの事後報告
- MTG prep。準備はCodex task内で行い、AMD OSの先手TODOへ複製しない
- チームメンバーが実行する作業
- connector、権限、設定、素材不足などの復旧作業。ただし `app_notifications.meta.action_contract` に、まさの具体行動・直接開ける場所・完了条件が揃う場合はOS通知として出してよい
- 待ち状態、相手ボール、期限のない「念のため確認」
- 根拠不足で採否や行動を決められないもの

## データ契約

`proactive_todos`、`l2_notifications`、`app_notifications` は、生成時の `attention_state='pending'` を既定にする。
表示・未読数・OS通知は、次だけを対象にする。

| source | 注意面の条件 |
|---|---|
| `proactive_todos` | `attention_state='approved'` かつ `attention_type IN ('decision','masa_action')` |
| `l2_notifications` | `attention_state='approved'` かつ `requires_masa_decision=true` |
| `app_notifications` | 直接の再認証URLがある `connector_auth`、または `attention_state='approved'` の `decision` / `masa_action` かつまさ本人の完全な `meta.action_contract` |
| `meeting_notifications` | 注意面へ出さない。会議記録としてcockpitに残す |

意味を持つ素材列が変わったらDB triggerが審査結果を `pending` へ戻す。
既読、通知済み、優先度、解決状態だけの変更では再審査しない。

## 期限

`proactive_todos.due_basis` は次の3値。

- `explicit`: メールやnext action本文に明示された期限。期限超過・red判定に使ってよい
- `synthetic`: meeting date + 7日のようなcollectorの仮期限。赤表示しない
- `unknown`: 未判定。赤表示しない

## Codex automation と非LLM applier

1. `attention_review_tool.mjs prepare` がpending候補を読み、URL・メール・認証情報を除いた審査素材を作る。DBは変更しない
2. Codexが全候補を意味分類する。従量課金のOpenAI・Anthropic・Gemini APIは呼ばない
3. `validate` が全件回答、source hash、列挙値、decision/action不変条件を検証する
4. `apply` が素材を再読し、hash一致行の許可列だけを更新する。古くなった行はskipする

候補0件は成功。空のreview payloadを作る必要はない。
automationの実行結果は件数だけを報告し、本文、個人情報、URL、環境値を通知へ出さない。

## 判定JSON

```json
{
  "version": 1,
  "reviewer": "codex-automation",
  "decisions": [
    {
      "source_kind": "proactive_todo",
      "source_id": "uuid",
      "source_hash": "sha256",
      "attention_type": "decision",
      "owner": "masa",
      "requires_masa_decision": true,
      "reason": "採否で次の手続きが変わる",
      "action": "提案を採用するか決める",
      "effect": "採用なら正本へ反映し、不採用なら候補を閉じる",
      "confidence": 0.95
    }
  ]
}
```

`l2_notification` の保存完了行、回答済み行、raw/config gapを `decision` にすることはvalidatorが拒否する。`app_notification` はまさ本人の完全なaction contractが無ければapprovedにできず、`meeting_action` は通知面ではなくaction ledgerへ残す。
