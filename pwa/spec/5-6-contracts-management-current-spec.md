# 契約管理仕様

> 確定範囲: `/contracts`、契約予定枠、契約書version metadata、押印版metadata、5生データ予兆dry-run、Slack nudge dry-run。実Slack送信、scheduler登録、Drive共有範囲変更はこのMVPでは行わない。

## Route / Authority

| surface | contract |
|---|---|
| page | `/contracts` |
| authority | admin / backoffice / management 限定。PWA page と API は `members.is_admin=true` を要求する |
| top nav | admin にだけ `契約` を表示 |
| external write | 初期実装では Drive 共有変更なし、Slack実送信なし、scheduler変更なし |

契約書はPJ資料より機密度が高いため、PJ member readへ開かない。PJ cockpit資料機能と実装パターンは参照するが、保存先と権限は混同しない。

## DB Tables

| table | purpose |
|---|---|
| `contracts` | 契約予定枠、status、相手先、関連PJ、予兆confidence、nudge閾値、押印版有無 |
| `contract_documents` | Drive file metadata による version history。本文/ファイル本体はDB保存しない |
| `contract_signals` | 5生データから検知した契約予兆候補。raw本文ではなく短いsnippetとsource refだけ保存 |
| `contract_nudges` | 押印版未保存のnudge候補/履歴。初期はdry-run/review queue前提 |

status:

| value | meaning |
|---|---|
| `planned` | 予兆または手動で予定枠化 |
| `drafting` | 初稿/ドラフト作成中 |
| `under_review` | 修正案、赤入れ、法務確認中 |
| `awaiting_signature` | 押印/電子署名待ち |
| `signed` | 押印版metadataが保存済み |
| `stalled` | 押印版未保存のまま停滞 |
| `cancelled` | 中止/失注 |

## API

| route | method | write? | contract |
|---|---:|---:|---|
| `/api/contracts` | GET | no | 契約、documents、signals、nudges、projects、Drive保存先設定を返す |
| `/api/contracts` | POST | yes | admin手動で契約予定枠を作る |
| `/api/contracts/[contractId]` | PATCH | yes | status、相手先、予定日、nudge閾値などを更新 |
| `/api/contracts/documents` | POST | yes | 既存Drive link/file idをmetadata登録。`document_kind='signed'` なら契約を `signed` にする |
| `/api/contracts/signal-dry-run` | GET | no | 5生データから契約予兆候補を生成。DB writeなし |
| `/api/contracts/nudges/dry-run` | GET | no | 押印版未保存かつ閾値超過のSlack nudge候補を生成。Slack送信なし |

## 5生データの分類

| source | current input | signal例 |
|---|---|---|
| Gmail | `source_cache.source in ('gmail','gmail_message',...)` | 契約書送付、押印依頼、修正案、クラウドサイン通知 |
| Slack | `source_cache.source like 'slack%'` | PJ channelでの契約締結予定、修正依頼、押印確認 |
| Notion | `source_cache` + `project_meeting_summaries.notion_url` | 議事録上の契約合意、法務TODO、MOU/NDA論点 |
| Drive | `source_cache.source like 'drive%'` + MTGカードのDrive metadata | 契約書ドラフト、赤入れ、PDF/Docx |
| Calendar | `project_meeting_summaries` / Calendar由来MTGカード | 契約締結MTG、法務確認MTG、押印期限 |

判定語は `契約書`、`NDA`、`業務委託`、`共同研究契約`、`MOU`、`押印`、`電子署名`、`DocuSign`、`クラウドサイン`、`修正案`、`法務確認`、`redline` など。高確度は「契約語」と「締結/署名/修正/法務アクション語」の同時出現。曖昧な候補は `review_required` として扱う。

## Drive

保存先正本:

```text
共有ドライブ/ARMADA/a3_backoffice/契約
```

MVPでは `CONTRACTS_DRIVE_FOLDER_ID` が設定されているかを画面に出す。PWAから新規共有や外部共有拡大はしない。契約書ファイルはDriveに置き、OSは `drive_file_id` / `web_view_link` / `mime_type` / `version_label` / `document_kind` だけを保持する。

## Nudge

`contracts.signed_at IS NULL` かつ `status NOT IN ('signed','cancelled')` の契約で、`last_activity_at` または `planned_at` から `nudge_after_days` 以上経過したものを候補にする。`projects.slack_channel_id` が無い場合は blocker として返す。

初期実装は `/api/contracts/nudges/dry-run` のみ。実送信に進む場合は、送信先PJ channel、文面、対象件数、送信タイミング、誤送信時の削除/rollback可否を確認した bundle が必要。

## Verification

- `npx tsc --noEmit --pretty false`
- `npm run build`
- `/contracts` local browser確認
- `git diff --check`
- migrationは非破壊DDLのみ。`DELETE` / `TRUNCATE` / `DROP` は使わない
