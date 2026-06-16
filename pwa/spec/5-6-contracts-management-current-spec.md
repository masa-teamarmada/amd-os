# 契約管理仕様

> 確定範囲: `/admin/contracts`、契約予定枠、契約書version metadata、押印版metadata、5生データ予兆dry-run、Slack nudge dry-run。実Slack送信、scheduler登録、Drive共有範囲変更はこのMVPでは行わない。

## Route / Authority

| surface | contract |
|---|---|
| page | `/admin/contracts` |
| authority | admin / backoffice / management 限定。PWA page と API は `members.is_admin=true` を要求する |
| admin sidebar | admin左メニューに `契約` を表示 |
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

判定語は `契約書`、`NDA`、`業務委託`、`共同研究契約`、`MOU`、`押印`、`電子署名`、`DocuSign`、`クラウドサイン`、`修正案`、`法務確認`、`redline` など。単に `契約` / `締結` が議事録本文に出るだけでは自動予定枠にしない。

## 自動予定枠化の品質境界

`D-13 Contract Signals` は、単に議事録やMTGタイトルの周辺文脈に「契約」「締結」が出るだけでは `contracts` に予定枠を作らない。`contract_signals` の review queue に止める。

自動で `contracts.status='planned'` を作れるのは、次のいずれかに限る。

1. Gmail / Drive などの `source_cache` 由来で、契約書・NDA・業務委託・MOU・発注書・DocuSign / クラウドサインなどの具体的な契約文書語と、押印・署名・送付・受領・修正案・法務確認・更新/延長などのアクション語が同時にある。
2. `project_meeting_summaries` 由来でも、MTG名そのものに `業務委託契約更新` / `NDA` / `MOU` / `契約書` などの具体的な契約種別・文書名が入っている。

`MTG` / `定例` / `キックオフ` / `取締役会` のような汎用meeting titleで、本文側にだけ契約語が出るものは false positive として候補化しない。meeting summary 由来は title 自体に具体的な契約種別・文書名があるものだけ候補化する。

## Drive

保存先正本:

```text
共有ドライブ/ARMADA/a3_backoffice/契約
```

MVPでは `CONTRACTS_DRIVE_FOLDER_ID` が設定されているかを画面に出す。PWAから新規共有や外部共有拡大はしない。契約書ファイルはDriveに置き、OSは `drive_file_id` / `web_view_link` / `mime_type` / `version_label` / `document_kind` だけを保持する。

## Nudge

`contracts.signed_at IS NULL` かつ `status NOT IN ('signed','cancelled')` の契約で、`last_activity_at` または `planned_at` から `nudge_after_days` 以上経過したものを候補にする。`projects.slack_channel_id` が無い場合は blocker として返す。

初期実装は `/api/contracts/nudges/dry-run` のみ。実送信に進む場合は、送信先PJ channel、文面、対象件数、送信タイミング、誤送信時の削除/rollback可否を確認した bundle が必要。

## 契約抽出 → projects / billing_cycles 反映 (Contract Apply)

> 2026-06-16 追記。契約は「抽出して `/admin/contracts` のレビュー queue に積む」だけでなく、**確定した契約条件を `projects` と `billing_cycles` に流し込んで初めて月次収支シミュレータ・予実表に効く**。この反映経路 (Contract Apply) を正本として定義する。手入力前提にしない (= つくよみが生データから自動構築する原則)。

### 反映先 3 層

契約書 (Drive PDF / Gmail / Slack 等) → `D-13 Contract Signals` 抽出 → `contract_terms` (`status='applied'`) になったら、次の 3 層へ反映する。**`contract_terms` が applied でも、この 3 層に書き戻らない限り OS の数字 (売上・予実・原価) は古いまま**。

| 層 | 反映先 | 列 | 用途 |
|---|---|---|---|
| ① 契約メタ正本 | `projects.contract_terms_json` (jsonb) | `monthlyFeeYen` / `contractStartYm` / `contractEndYm` / `actualWorkStartYm` / `billingStartYm` / `rewardPoolYen` / `monthlyRewardCapYen` / `sourceTitle` / `sourceRef` / `notes` | `/admin/projects` の契約カラム群が表示・編集する正本。`contract_terms` 抽出結果はまずここへ畳む |
| ② 売上計上パラメータ | `projects` | `fee_type` (`monthly_fixed` / `variable`) / `fee_amount` / `start_ym` / `end_ym` | 月次収支シミュレータ (`buildLiveMonthlyPlInputs`) が固定収益を立てる入力。**`end_ym` が null だと契約終了後も無期限で売上が立ち続ける** (CX 事故。契約は 2026-06〜09 なのに `end_ym=null` のまま 202702 以降も ¥290,000 を計上していた) |
| ③ 月別売上 (変動) | `billing_cycles` | `ym` ごとの `budget_yen` / `budget_reported_amount` | `billing_distribution='schedule_based'` 等で月により金額が違う契約は、②の `monthly_fixed` 一律ではなく月別 cycle に展開する。シミュレータは変動収益をここから取る |

### `/admin/projects` の契約カラム

`AdminProjectsTable` は `projects.contract_terms_json` を展開した編集列を持つ (`contract_monthly_fee_yen` / `contract_start_ym` / `contract_end_ym` / `contract_actual_work_start_ym` / `contract_billing_start_ym` / `contract_reward_pool_yen` / `contract_monthly_reward_cap_yen` / `contract_source_title` / `contract_source_ref` / `contract_notes`)。`contract_terms` フィールド群を保存すると `contract_terms_json` (①) に upsert される。`fee` / `start_ym` / `end_ym` (②) は別カラムとして個別に保存する。

⚠️ **現状の欠落 (2026-06-16 時点)**: `contract_terms` テーブル (D-13 抽出結果) から ①②③ へ自動反映する経路は未実装。`/admin/contracts` で term を `applied` にしてもステータスが変わるだけで、`projects.contract_terms_json` や `fee_type/start_ym/end_ym`、`billing_cycles.budget_yen` には書き戻らない。そのため `/admin/projects` の契約カラムや月次シミュレータは手編集に依存している。Contract Apply (抽出 applied → 3 層反映) の自動化が次の実装対象。`billing_distribution_json` / `fee_type_hint` / `extracted_terms_json` (contract_terms の列) を消費して、`schedule_based` なら ③ の月別 cycle に、`monthly_fixed` なら ② に、共通して ① に畳む writer を `/api/contracts` 配下に置く。

### apply 時の必須ガード

- `end_ym` を必ず設定する (契約終了月)。null のまま `monthly_fixed` を残さない (CX 無期限計上事故の再発防止)。
- 期間が複数 term に分かれる契約 (CX: 2025-11〜2026-03 コンサル + 2026-06〜2026-09 設立準備) は、term ごとに ②③ を分けて反映する。1 本の `monthly_fixed` に潰さない。
- `schedule_based` (月により金額が違う) は ② の一律額にせず ③ の月別 `budget_yen` に展開する。
- 本番データ (projects / billing_cycles) の書き換えを伴うため、自動 apply でもまさ確認を挟むか、`/admin/contracts` のレビューで人が承認した term だけを反映する。

## Verification

- `npx tsc --noEmit --pretty false`
- `npm run build`
- `/admin/contracts` local browser確認
- `git diff --check`
- migrationは非破壊DDLのみ。`DELETE` / `TRUNCATE` / `DROP` は使わない
