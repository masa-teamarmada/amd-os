# 通知 + つくよみ修正依頼 — 設計の正本

最終更新: 2026-06-27 (MTG critical 誤爆停止)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

---

## このドキュメントが扱う範囲

Phase 4 で蓄積される 2 つの通知テーブル (`l2_notifications` + `meeting_notifications`) を
PWA 画面 + iOS で確認し、誤抽出に対して **「つくよみ (LLM 抽出 cron) に修正依頼」** を出す仕組み。

修正依頼は `l2_feedbacks` テーブル (migration 032) に蓄積され、上流 cron が次回抽出時に
LLM プロンプトに含めて再抽出する → 「過去の指摘が反映された L2 データ」が育つ。

補助的な運用通知として、入金確認nudgeもPWA側に置く。これはL2通知ではなく admin オペレーション通知で、`/api/cron/payment-confirm-nudges` が入金日当日の active admin のSlack DMへ送る。LLM非使用の入金確認cronなので、Vercelでは `freee-payment-sync` (09:10 JST) と `payment-confirm-nudges` (09:30 JST) だけ稼働させ、LLM系cron停止とは別枠で扱う。手動再送は `/admin/payouts` の「入金確認nudge」ボタンから行う。

connector 再認証は `app_notifications(kind='connector_auth')` に置く。H-1 は Notion connector の `oauth_token_invalid_grant` / `TRIGGER_REAUTHENTICATION` を検知したら、抽出を止めずに `pwa/scripts/notify_connector_auth.mjs` で未読の再認証アクションを作る。同じ connector の未読通知が24時間内にあれば新規作成せず、既存通知を最新の再認証アクション付きpayloadへ更新する。通知には `meta.connector` / `meta.connector_id` / `meta.link_id` / `meta.reason` / `meta.reauth_url` / `meta.reauth_app_url` / `meta.reauth_install_url` / `meta.fallback_continues=true` を入れる。

PWA は admin session 中に `CriticalRealtimeNotify` が `app_notifications` / `l2_notifications` / `meeting_notifications` を Realtime 購読し、Realtime が落ちた場合も10秒pollで補完する。`notification-priority.ts` が `critical` と判定する未読通知は画面右下に即カード表示し、Browser Notification 権限があれば OS 通知も出す。`connector_auth` はカードから `reauth_url` を開いた時点で `read_at` を打つ。ただし再認証ページを開いたことは復旧成功の証拠ではないため、既読後も `/notifications` の「既読」タブに残し、そこから再試行できる状態にする。L2 critical はカードから `/notifications?notification_id=...` へ遷移し、通知ページ側で対象rowを追加取得・自動展開する。既読化・採否は既存の通知ページ UI に委ねる。MTG 通知は本文中に再認証・blocker 等の語が混じっても右下ポップアップには出さず、必要なら `connector_auth` / `guardrail_match` / `contract_signals` 等の専用通知として別発火させる。

Swift は `app_notifications.native_notified_at IS NULL` の `connector_auth` を起動時/foreground復帰時に拾い、ローカル通知を即表示する。通知を表示したら `native_notified_at` を打つが、これは「Swiftへ配信済み」だけを表し、PWA/Swift共通の人間既読は引き続き `read_at`。Swift通知をタップすると通知ボックスを挟まず `reauth_url` を開き、`read_at` を打つ。ただし再認証リンクが閉じたり失敗した場合に再試行できるよう、Swift通知ボックスの「既読」タブにも `connector_auth` を残し、「再認証を開く」ボタンを出す。再認証は復旧レーンで、L2抽出の terminal blocker ではない。

通知は表示上 `normal` と `critical` に分ける。`normal` は「OSに新データが入った / 候補が増えた / 通常レビュー」で、既存の L2 候補・MTGサマリ・VCニュース・通常の gap が入る。`critical` は「まさが見落とすと事故るもの」で、Notion等の connector 再認証、明示 critical の重大 guardrail 発火、重要 automation blocker が入る。MTG本文に NDA / 契約 / 法務 / SHA / COI / 再認証 / blocker などの語が出ただけでは critical にしない。`action_item` も「要対応」というラベルだけでは critical にしない。契約予兆や総会/役会も kind だけでは鳴らさず、明示 critical / 期限超過 / blocker / high以上の経営ガードレール発火になった時点で鳴らす。2026-06-27時点では DB 列を増やさず、`pwa/src/lib/notification-priority.ts` が既存の `kind/l2_kind/importance/meta/title/summary` から分類する。将来のDB案は `notification_priority text check in ('normal','critical') default 'normal'` を3通知テーブルに追加し、writer 明示値を優先、空なら同じ導出関数で補完する。

分類ルール:

| source | critical 判定 |
|---|---|
| `app_notifications` | `kind='connector_auth'` は常に critical。`meta.priority/severity/urgency/notification_priority/notification_channel/risk_level` が `critical` / `urgent` / `blocker` 等、または title/body/meta reason に再認証・blocker・事故・緊急・期限超過等があれば critical。 |
| `l2_notifications` | 明示 `notification_priority='critical'`、または `metadata_json` の priority/severity/reason/blocker_kind 等に期限超過 / blocker / 再認証 / 緊急等の運用緊急語があれば critical。通常の候補追加・レビューは normal。`l2_kind` / `importance >= 8` / title / summary だけでは critical にせず、契約予兆・総会/役会・D-11メディア掲載も通常レビューに残す。 |
| `meeting_notifications` | 常に normal。MTG本文は一次記録なので、再認証 / blocker / 緊急等の語が含まれても右下ポップアップにはしない。緊急扱いが必要なものは `app_notifications(kind='connector_auth')` または `l2_notifications(l2_kind='guardrail_match'/'contract_signals' 等)` として別に出す。 |

---

## えいみ名義 Slack 送信

AMD配下でまさがSlack投稿を依頼したときの既定運用入口は、リポジトリ内の固定スクリプトに集約する。明示的に別名義を指定されていない限り、この入口で `えいみ` として投稿する。

```sh
printf '%s\n' '本文' | /Users/masa/projects/AMD/amd-os/scripts/send-eimi-slack.mjs --channel C04QB6F7YPN --stdin
```

長文はファイルから渡す。

```sh
/Users/masa/projects/AMD/amd-os/scripts/send-eimi-slack.mjs --channel C0B3KB8L7B5 --file /tmp/message.txt
```

このスクリプトは `/Users/masa/projects/AMD/amd-os/pwa/.env.local` を読み、AMD OS GAS の `pwaApi runFunc` 経由で `えいみ (U0ACK22BBDF)` として投稿する。投稿成功時は `{ "persona": "eimi", "channel": "...", "ts": "..." }` を返す。

チャンネル指定:

- まさ宛DM: `U04PJK178JV`
- まさだけが見るテストチャンネル: `C04QB6F7YPN`
- KUTE: `C0B3KB8L7B5`

運用時は、このスクリプトの結果とSlack上の投稿者表示を確認する。

Slackの履歴確認やチャンネル確認はSlack connectorを使ってよい。最終投稿はこの固定スクリプトで行う。

- 対象: 入金月単位で `billing_cycles.payment_confirmed_at` が空で、計算された入金期日が今日 (JST) と一致するPJ。入金日前は確認できないため送らない。
- 入金月: `billing_cycles.invoice_ym` があれば優先、空なら `/admin/projects` の支払条件 (`projects.payment_due_rule`) から計算。
- Slackボタン:
  - `予定通り入金済み`: signed token 付き `/api/admin/payment-confirm?mode=expected` で即時反映。
  - `金額を入力`: signed token 付き `/payment-confirm` で実際の入金額を入力。
- 反映先: `billing_cycles.payment_confirmed_at` / `payment_confirmed_by` / `status='payment_confirmed'`。実額・source・freee照合結果は `billing_log.detail` に残す。
- freee会計同期 (`/api/cron/freee-payment-sync`) が先に同じ入金を見つけた場合は、adminがSlackに回答しなくても入金確認済みになる。照合対象はfreee会計の収入取引 (`deals`) と、取引登録前の銀行口座明細 (`wallet_txns`) の両方。銀行明細の摘要で照合する必要があるPJは `project_knowledge(category='payment_alias')` に `エヒメダイガク` のような振込摘要キーワードを持たせる。
- freee同期が `Freee token refresh failed: invalid_client` などで落ちた場合は、入金情報は取れていない。active adminへSlack DMで失敗理由を出し、`FREEE_CLIENT_ID` / `FREEE_CLIENT_SECRET` / `FREEE_REFRESH_TOKEN` または `freee_oauth_tokens` の再認証が必要な状態を見える化する。
- 旧 PL確認依頼 route は PM 月次ルーティン廃止に合わせて削除済み。請求額は契約 apply 済みなら `contract-billing-auto-confirm`、例外復旧は `/admin/invoices` / `/admin/payouts` と budget approval 境界で扱う。

`project_config_gap` は、OSが処理を続けるために本当に設定不足で止まる場合だけ使う通知。2026-05-22以降、DTSU PJ / エコシステム構築PJで対象月を覆うMS計画または有効なMS項目がない場合は通知しない。`progress-estimator` が `monthly_reports` + `project_meeting_summaries` を `project_monthly_notes` に保存し、月次モーダルにその月の動きを残す。advisorなど非MS管理PJもMS進捗は抽出せず、同じ月次ノート側に寄せる。

---

## なぜ作ったか (まさの問題提起 2026-05-09)

> 「BWE 総会の議事録きたけど、BWE じゃなくて CX の神谷さんが登場する内容になってたりしてカオス」

Phase 4 cron は LLM ベース抽出なので、入力データの混入や PJ 紐付け誤りで誤抽出が起きる。
通知は届くが、**誤りを訂正する経路がなかった**。修正依頼を蓄積して LLM に学習させる仕組みが必要。

---

## データフロー

```
[毎時 cron が L2 抽出] (GAS 155 / PWA progress-estimator)
   │ 1) l2_feedbacks WHERE l2_kind=? AND target_id=? AND status='active' を取得 (最大 10 件)
   │ 2) LLM プロンプト末尾に「過去のユーザーフィードバック (重要・必ず反映すること)」セクション追加
   │ 3) 抽出 → upsert → l2_notifications upsert
   │ 4) saved>0 なら参照した feedback の applied_count++ / last_applied_at = now()
   ↓
[Swift APNs ローカル通知 → l2_notifications.notified_at = now()]
[PWAで人間が開く → l2_notifications.read_at = now()]
   ↓ まさが内容確認 → 誤抽出に気づく
[PWA `/notifications` を開く] (or iOS 通知タップ → 該当画面)
   ├─ 一覧表示 (l2_notifications + meeting_notifications を created_at 降順マージ)
   ├─ 各通知を展開 → summary / 元データへの deep link / 既存 feedback 表示
   └─ 「⚠️ つくよみに修正依頼」textarea + 送信ボタン
        ↓ POST /api/notifications/feedback
        ↓ l2_feedbacks INSERT (status='active', created_by=code_name)
   ↓
[次回 cron 抽出時] LLM プロンプトに含まれて再抽出 → 改善された L2 データ
```

---

## Supabase スキーマ

### `l2_feedbacks` (新規, migration 032)

```sql
CREATE TABLE l2_feedbacks (
  feedback_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  l2_kind         TEXT NOT NULL,             -- 'member_knowledge'|'project_knowledge'|'protocols'|'ms_progress'|'meeting_summary'|'project_registry_diff'|'xrl_evidence'
  target_id       TEXT NOT NULL,             -- code_name (member系) / project_id (PJ系) / meeting_id (meeting系)
  scope_key       TEXT NOT NULL DEFAULT 'global',  -- ym (PJ系) / 'global' (member/meeting系)
  notification_id UUID,                      -- 関連 l2_notifications (オプション)
  meeting_id      TEXT,                      -- 関連 meeting_notifications (オプション)
  feedback_text   TEXT NOT NULL,             -- まさの修正依頼文
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'archived'
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_count   INT NOT NULL DEFAULT 0,    -- LLM プロンプトに含められた回数
  last_applied_at TIMESTAMPTZ
);

CREATE INDEX idx_l2f_kind_target_active
  ON l2_feedbacks (l2_kind, target_id, scope_key)
  WHERE status = 'active';
```

RLS:
- SELECT / INSERT / UPDATE: admin authenticated のみ。`members.is_admin = true` を `amd_os_current_user_is_admin()` で判定する。
- service_role: cron / automation / GAS / server-side repair が使う。一般メンバーや anon は通知・feedback とも見えない。

---

## PWA 画面: `/notifications`

### Server page
[pwa/src/app/(app)/notifications/page.tsx](../src/app/\(app\)/notifications/page.tsx)
- server-sideで `members.is_admin` を確認し、admin以外は `notFound()`。
- l2_notifications (100 件) + meeting_notifications (100 件) + l2_feedbacks (200 件) + projects を fetch
- NotificationsClient に props 渡し

### Client component
[pwa/src/components/notifications/NotificationsClient.tsx](../src/components/notifications/NotificationsClient.tsx)
- フィルタタブ: 未対応 / 未読 (`read_at IS NULL` かつ未回答) / 回答済み / 修正依頼あり
- 通知カード (時系列降順):
  - title (l2 通知は絵文字付き、meeting 通知は "📋 議事録: ..." を表示)
  - 補助メタ: 日時 / l2_kind / target / 未読 badge / 修正依頼 N 件 badge
- カードクリックで展開:
  - summary (本文)
  - `coverage_gap` は summary の前に人間向けの確認文を出す。元候補の詳細が取れている場合だけ、タイトルを `重要メモにコピーする？: ...` の質問形にし、展開部は「会議メモで見つかった内容」「通知した理由」「ボタンを押すと起きること」の3項目にする。元候補が取れない / 通知本文が薄すぎる場合は `コピー前に元情報を確認: ...` に変え、「このカードだけではコピー対象を判断できない」と出して肯定ボタンを disabled にする。UI 表示では `D-6` / `coverage_gap` / `raw transcript` / `元情報` / `取りこぼし` / `条件付き投資家関心` / `薄い` / `candidate` / `salience` / `目立たない話` を使わない。
  - 元データへの deep link (l2_kind ごと: protocols → /admin/protocols, ms_progress → /project/<id>/cockpit?ym=<ym>, etc.)
  - 既存 feedback 一覧 (この通知に紐づく / 同 (l2_kind, target_id, scope_key) の)
  - 「はい・反映」「いいえ・不採用」「コメントだけ送信」textarea + 送信ボタン
- 回答後は `l2_feedbacks.feedback_text` 先頭 (`[はい]` / `[いいえ]` / コメント) で回答済み扱いにし、未対応/未読から外して `回答済み` タブへ移動する。

### AMDプロトコル candidate 通知

`gas/155_L2KnowledgeExtractor.js` の `nav_protocol_extractOneForYm_` は、以前は `project_id + ym` で複数 candidate を1通知へ集約していた。2026-05-20 以降は、修正・採否を1件ずつ扱えるように `protocol_id` 単位で通知する。

- `target_id = project_id`
- `scope_key = YYYYMM:protocol:<protocol_id>`
- `saved_count = 1`
- `total_count = 1`
- 通知詳細は `scope_key` から `ym` と `protocol_id` を分解し、`protocol_examples.project_id + occurred_on month + protocol_id` で関連事例を絞り込む。
- フィードバック取り込み時は、月次抽出 (`scope_key=YYYYMM`) でも `YYYYMM:protocol:*` の個別 feedback を拾って LLM プロンプトに渡す。

### MS進捗 差分候補通知

Codex automation `amd-os-ms` は、5 生データ + MS期間を見て `ms_progress_revisions.status='pending'`
の修正候補を作成/更新したとき、同じ `project_id + ym` で `l2_notifications` に
`l2_kind='ms_progress'` を upsert する。

- `target_id = project_id`
- `scope_key = ym`
- `saved_count = pending revision 作成/更新件数`
- 通知詳細では `ms_progress_revisions` の pending/confirmed/discarded と、
  `milestone_monthly_progress` の現在値をあわせて表示する
- deep link は `/project/<project_id>/cockpit?ym=<ym>` で、対象月の月次モーダルを直接開く

### OS台帳差分 / XRL根拠 通知

D-5 OS台帳差分と M-2 XRL根拠は、全文保存ではなく「OSへ入れるべき構造化差分」だけを通知する。

- OS台帳差分: `l2_kind='project_registry_diff'`
- XRL根拠: `l2_kind='xrl_evidence'`
- `target_id = project_id`
- `scope_key = ym` または `global`
- summary には差分要約と短い根拠 snippet だけを載せる。メール全文・議事録全文・Slack全文は載せない
- 「はい」なら DB 反映 / confirmed 昇格、「いいえ」なら rejected、コメントは `l2_feedbacks` / つくよみ学習リストへ入れる

### 通知候補の正本反映ゲート

通知に出るL2候補は、通知画面で「はい」を押すまで正本反映しない。通知は事後報告ではなく、反映前の承認UI。

| l2_kind | 保存時 status | はい | いいえ |
|---|---|---|---|
| `member_knowledge` | 現 schema に `status` 列なし。候補採否は migration 検討中 | TBD | TBD |
| `project_knowledge` | `candidate` | `active` | `rejected` |
| `protocols` | `candidate` | `confirmed` | `rejected` |
| `founding_members` | `tentative` | `active` | `invalid` |
| `project_registry_diff` | `pending` | allowlist済みDB反映 + `applied` | `rejected` |
| `xrl_evidence` | `candidate` | `confirmed` | `rejected` |
| `meeting_summary` | 抽出時に確定保存 (status概念なし) | 確認マークのみ (feedback記録 + 既読化、再抽出しない) | feedback記録 |
| `raw_data_gap` | 通知のみ | feedback記録 + 再抽出/抽出経路確認。現物のDB取り込みは保証しない | feedback記録 |
| `coverage_gap` | `l2_coverage_gaps.review_status='candidate'` | `confirmed`。`proposed_target_l2='strategy_signal'` は `project_strategy_signals.status='confirmed'` へ自動upsertし、`routed_to` に行き先を残す | `rejected` |

コメントだけ送る場合は正本反映せず、`l2_feedbacks` / つくよみ学習リストへ残す。

`raw_data_gap` は例外。これは「はいを押せばOSに現物が入る候補」ではなく、raw source は見つかったが L2 化先・backfill 経路・helper/UI 対応が未確定であることを示す運用通知。反映可能な候補を作れる場合は `raw_data_gap` を主成果にせず、`project_registry_diff` / `xrl_evidence` / `ms_progress` revision / `meeting_summary` など、押した後のDB反映先が明確な kind に寄せる。

`coverage_gap` は「あとで人間が本来の入れ先へ手当てする」通知にしない。安全に反映先が分かる場合は、「はい」と同時に下流テーブルへ自動ルートする。2026-06-27 時点の実装は `proposed_target_l2='strategy_signal'` を D-6 経営ハイライトへ昇格する。H-1 reviewer 由来の gap は `status='confirmed'` / `decision_state='observed'` の `project_strategy_signals` を作り、会社として正式決定済みとは扱わない。通知の採否APIは raw source の再取得を担当しない。raw再確認が必要な場合は H-1 reviewer / source fallback 側で再実行する。

2026-07-16 以降、`coverage_gap` は候補行の保存済み (`l2_coverage_gaps.review_status='candidate'`) とまさの採否を分ける。通知 writer は `saved_count=0,total_count=1` で作り、既存の `saved_count=1,total_count=1` 通知も UI では保存済み扱いにしない。ボタン文言は「重要メモにコピー / コピーしない」。これは内部的には D-6 への追加だが、画面では「保存済みの会議要約は書き換えず、プロジェクトの重要メモにコピーする。出資決定や正式合意としては扱わない」と説明する。H-1要約本文を戻す操作ではない。元の `l2_coverage_gaps` 行が見つからない通知は、具体候補なしでコピー判断を迫らず、「コピー前に元情報を確認」として肯定ボタンを disabled にする。

### POST API
[pwa/src/app/api/notifications/feedback/route.ts](../src/app/api/notifications/feedback/route.ts)
- Body: `{ l2_kind, target_id, scope_key?, notification_id?, meeting_id?, feedback_text }`
- 認証: Supabase Auth セッション + `members.is_admin=true` 必須
- created_by: members.email = auth user.email から code_name を resolve
- **`meeting_summary` の「はい・反映」は再抽出しない。確認マーク (feedback 記録 + 既読化) のみ**。
  - MTGサマリは通知に出る時点で既に Notion 議事録から抽出され `project_meeting_summaries` / `meeting_notifications` に確定保存済み (= 通知が立つ = 抽出完了)。よって「はい」で作り直す対象は存在しない。`applyResult` は常に `applied:true`、502 は返さない。
  - かつて (2026-05-21) は固有名詞の修正コメント付き「はい」で `nav_meeting_processOneEvent_` を同期再抽出する "修正依頼ルート" があった。だが誤抽出修正は cockpit の「議事録を手動修正」(`POST /api/meeting-summary/manual-update`) に一本化された (2026-05-29) ため、通知側の同期再抽出は不要になり**廃止した**。
  - 過去事故 (2026-06-02): 手動作成サマリ `manual:p00:20260601-lg-cho-visit` を通知から承認しようとして `送信失敗: notion_page_not_found` で弾かれた。`manual:`(手動) / `dialogue:`(まさえいMTG) / `upcoming:`(予定枠) 由来は Notion ページを持たないため、再抽出すると構造的に必ず失敗する。2026-05-29 に修正依頼ルートが廃止されたのに通知の「はい=再抽出」だけが取り残されていたのが原因。

---

## 上流 (GAS / PWA cron) 側の feedback 取り込み

### GAS 155 (`gas/155_L2KnowledgeExtractor.js`) / MMOマシン automation 後継

2026-05-29 current truth:
- GAS 155 は `L2_KNOWLEDGE_CRON_DISABLED_20260522` で停止中。毎時 trigger は復活させない。
- D-1D-3D-4の現行 writer は MMOマシン Codex Desktop automation (`amd-os-l2-protocol-extract`, `amd-os-l4-project-knowledge-extract`, `amd-os-l5-member-knowledge-extract`)。
- 詳細は [8-3 章 L2 Extraction Routines](../manual/8-3-l2-extraction-routines-spec.md)。

3 つの extractor (member/project/protocol) で:
1. `_l2_loadFeedbackBlock_(l2Kind, targetId, scopeKey)` で過去 feedback を取得 (active かつ scope_key 完全一致 or 'global'、最大 10 件。protocols は `YYYYMM:protocol:*` も月次抽出に含める)
2. LLM プロンプト末尾に追加: `=== 過去のユーザーフィードバック (重要・必ず反映すること) ===\n  1. [日付 by] テキスト\n  2. ...`
3. saved > 0 なら `_l2_recordFeedbackApplied_(feedbackIds)` で applied_count++ + last_applied_at = now()

### MTGサマリ (gas/074) / PWA progress-estimator (D-2 MS進捗)

- gas/074 `nav_meeting_processOneEvent_`: `_l2_loadFeedbackBlock_("meeting_summary", projectId, eventId)` を組み込み済み。feedback 追加で `source_hash` が変わり、再抽出が走る。
- `nav_meeting_processOneEvent_` は単体実行時も `meeting_notifications` を upsert し、通知カード側の短いサマリも最新化する。
- pwa/src/lib/progress-estimator.ts: `l2_kind="ms_progress"` で feedback を取得 → systemPrompt に追加

---

## iOS Swift 側 (TODO)

通知タップ時に PWA `/notifications` の該当行 (= deep link or 同等の iOS 内画面) に遷移して、
そこで PWA と同じ修正依頼フォームを使う。実装は **次セッション** で:

- `userInfo` から `kind` / `l2Kind` / `targetId` / `scopeKey` / `notificationId` を取り出す
- 当面は `WKWebView` で `https://amd-os-pwa.vercel.app/notifications#<notificationId>` を開くだけでも OK
- 中長期: ネイティブ画面を作る (= NotificationDetailView.swift + NotificationFeedbackForm.swift)

---

## 既知の制約・運用上の注意

- **RLS**: 2026-05-20以降、通知系はadmin-only。`l2_notifications` / `meeting_notifications` / `app_notifications` / `l2_feedbacks` は anon 不可、一般 authenticated も不可。
- **raw_data_gapの意味**: `raw_data_gap` は「OS未取り込み」報告ではない。通知タイトルで `〜がOS未取り込み` と書くと、はいを押せば現物がOSへ取り込まれるように見えるため禁止。`〜をBRL根拠候補にする？` / `〜のL2化先を確認` / `〜の取り込み経路を確認` のように、承認後に起きることを明示する。
- **raw_data_gapの詳細表示**: 通知が持つ `metadata_json.evidence_refs` を正本として表示する。`project_id + ym` の `source_cache` 全件を通知詳細として見せると、後続backfillのSlack/Gmail等が混ざって「生データ取り込み通知」に見えるため禁止。fallbackで `source_cache` を見る場合も、短いsnippet / source_url / hash / item_id だけを出し、本文全文やmetadata全量は表示しない。
- **raw_data_gapのstale判定**: `meeting-not-ingested` 系は通知作成時のsnapshotが古い場合がある。PWA詳細表示は展開時に `project_meeting_summaries` をlive確認し、該当行があれば「OS取り込み済み」と表示する。生成側も通知前にlive DBを再確認し、認識できている外部ソースは通知だけでなくbackfillへ進める。
- **xrl_evidenceのscope**: 通知は `YYYYMM:<slug>` の個別scopeを持ってよいが、正本 `project_xrl_evidence.ym` は `YYYYMM`。PWA詳細とfeedback APIは `scope_key` の `YYYYMM` 部分 + `metadata_json.axis/evidence_kind/evidence_source_hash` で候補行を特定する。
- **既読の蓄積**: iOS/APNs 配信済みは `notified_at`、PWAの人間既読は `read_at`。どちらが入っても行は削除されない。UIは最新100件 + 既読折りたたみで見せるだけなので、現状はDBには蓄積し続ける。必要なら retention / archive job を別途設計する。
- **status='archived'**: 古い feedback が常時 LLM プロンプトに混じるとノイズになる → まさが UI から手動 archive できる仕組みが将来必要 (現状は SQL 直叩きで archive)
- **applied_count**: 現状は記録だけ。閾値超え (= 何度も適用されたが直らない) のフィードバックを通知する仕組みは将来
- **重複防止なし**: 同じ修正依頼を 2 回送ると 2 行 INSERT される (= LLM プロンプトに 2 件並ぶ)。気になれば UI で送信前 dedup チェック追加
- **マルチスコープ**: 同じ PJ で 202604 と 202605 に同じ修正を出したい場合は scope_key='global' を許可済 (= 全 ym に適用)。UI 上は scope 選択肢を作っていないので明示的には書けない (= 必要なら API 直叩き or UI 拡張)

---

## 過去の差分・履歴

| 日付 | 変更 |
|---|---|
| 2026-07-16 | **coverage_gap 通知の空カード防止**: 元候補が見つからない / 通知本文が薄すぎるカードは `重要メモにコピーする？` と聞かず、`コピー前に元情報を確認` に変えて「このカードだけではコピー対象を判断できない」と表示。肯定ボタンを disabled にし、`通知本文と確認先を見て判断してね` や scope ID を出さない。 |
| 2026-07-16 | **coverage_gap 通知の質問化 v3**: 画面から `目立たない話` とカード内の追加疑問文を削除。タイトルは `重要メモにコピーする？`、詳細欄は「会議メモで見つかった内容」「通知した理由」「ボタンを押すと起きること」へ統一し、元の会議要約を書き換えないことを明示。 |
| 2026-07-16 | **coverage_gap 通知の質問化 v2**: 画面から `D-6` / `coverage_gap` / `raw transcript` / `元情報` / `取りこぼし` / `条件付き投資家関心` / `薄い` / `candidate` / `salience` を削除。タイトルは `重要メモに残す？`、詳細欄は「会議メモにあった話」「いまの要約で目立たない話」「残すとどうなる？」へ統一。 |
| 2026-05-09 | 初版。`l2_feedbacks` テーブル + `/notifications` ページ + POST API + GAS 155 の 3 extractor で feedback 取り込み |
| 2026-05-09 | **MTGサマリ feedback 連携完成** (gas/074): `_l2_loadFeedbackBlock_("meeting_summary", projectId, meetingId)` で過去依頼を取得 → userPrompt に追加。saved>0 で `_l2_recordFeedbackApplied_` で applied_count++ + last_applied_at = now()。source_hash 入力に active feedback hash を混ぜる → 修正依頼追加で自動再抽出 (`_meeting_feedbackHashInput_`)。prompt rev "v4_alias_feedback" にバンプ |
| 2026-05-09 | **POST `/api/notifications/feedback` 末尾で 即 force 再抽出 fire-and-forget**: l2_kind ごとに対応 GAS 関数を runFunc で叩く (meeting_summary → `nav_meeting_processOneEvent_`、member_knowledge → `nav_member_knowledge_extractOne_` (member_id を server side で resolve)、project_knowledge → `nav_project_knowledge_extractOneForYm_`、protocols → `nav_protocol_extractOneForYm_`)。修正依頼を投げた瞬間に数十秒後に再抽出 → applied_count++ で UI 即反映 |
| 2026-05-09 | **通知 UI 改善**: `/notifications` の既読は折りたたみトグル (default closed)、開いた瞬間 `notified_at = now()` PATCH (= 即既読化)。ただし **グループ分けは server 値で固定** (= 開いた未読カードはセッション内は未読セクションに残って中身読める、リロードで初めて既読セクションへ移動)。GlobalNav 通知ベル (15 秒 polling) + Dashboard バナー追加。展開時に lazy fetch で実データ表示 (member_knowledge / project_knowledge / protocols / milestone_monthly_progress / project_meeting_summaries) |
| 2026-05-20 | **admin-only repair**: RLSが `anon SELECT` / `authenticated UPDATE` で、一般メンバーや直URLから通知が見える状態だったため、`amd_os_current_user_is_admin()` + migration 066 で4テーブルをadmin-only化。Dashboard banner / `/notifications` server page / feedback API もadmin gate追加。既読状態は `l2_notifications=87`, `meeting_notifications=10`, `app_notifications=35` を未読へ戻した。 |
| 2026-05-20 | **read_at split**: Swift/iOSの配信済み marker として `notified_at` が再セットされるため、PWA既読 marker を `read_at` に分離。migration 067で `l2_notifications.read_at` / `meeting_notifications.read_at` を追加し、PWA未読カウント・未読フィルタ・未読に戻す操作は `read_at` だけを見る。 |
| 2026-06-26 | **connector_auth 再認証アクション追加**: H-1 が Notion connector 再認証要求を検知したら `app_notifications(kind='connector_auth')` を作り、connector/app ID と再認証リンクを入れる。`notify_connector_auth.mjs` は24時間内の既存未読通知を更新し、抽出は fallback で継続する。PWA は Realtime + 10秒pollで即カード/Browser Notificationを出し、Swift は `native_notified_at` でローカル通知配信済みを管理して通知タップから `reauth_url` を直接開く。リンクを開いたら既読化するが、PWA/Swiftの既読欄に再認証アクションを残し、失敗時に再試行できるようにする。 |
| 2026-06-26 | **normal / critical レーン追加**: `/notifications` の OS通知と L2/MTGレビューキューを「緊急性の高い通知」と「通常通知」に分ける。DB列は増やさず `notification-priority.ts` で既存列から導出し、将来は `notification_priority` 列で writer 明示へ移行できる設計案を残した。 |
| 2026-06-26 | **critical 右下ポップアップ一般化**: PWA の即時カードを `connector_auth` 専用の `ConnectorAuthRealtimeNotify` から `CriticalRealtimeNotify` に置き換え、`app_notifications` / `l2_notifications` / `meeting_notifications` の critical 未読通知をすべて右下ポップアップに出す。通知ページの normal / critical レーン表示と採否 UI は変更しない。 |
| 2026-06-26 | **critical 誤検知の絞り込み**: MTG summary に NDA / 契約 / 法務 / SHA 等の単語が含まれるだけで `meeting_notifications` が critical になる問題を修正。緊急ポップアップは「話題語」ではなく、明示 critical / 専用 L2 kind / 認証切れ・blocker・事故などの運用緊急語で判定する。 |
| 2026-06-26 | **action_item critical 誤検知の絞り込み**: `l2_kind='action_item'` と title の「要対応」だけで右下ポップアップに出る問題を修正。要対応は通常通知に残し、critical は明示 critical / 期限超過 / blocker 等に限定する。 |
| 2026-06-27 | **critical popup deep link**: L2/MTG critical ポップアップのリンクを `/notifications` 直行から `notification_id` / `meeting_id` 付きに変更。通知ページは対象rowが最新100件から漏れていても追加取得し、自動展開・スクロールする。`action_item` は `importance >= 8` だけでは critical にしない。 |
| 2026-06-27 | **MTG critical 誤爆停止**: `meeting_notifications` は本文中に `blocked by reauthentication` 等の復旧語が含まれても normal 固定にした。MTGサマリは通常レビューとして通知ページに残し、緊急ポップアップは `connector_auth` / `guardrail_match` / `contract_signals` 等の専用通知だけに寄せる。 |
| 2026-06-27 | **importance critical 誤爆停止**: `l2_notifications.importance >= 8` だけでは critical にしない。D-11 メディア掲載など重要度の高い通常レビューは通知ページに残し、右下ポップアップは専用 kind / 明示 critical / 復旧語に限定する。 |
| 2026-06-27 | **L2 kind critical 誤爆停止**: `contract_signals` / `shareholder_meeting` は kind だけでは critical にしない。契約・総会/役会は通常レビューに残し、緊急ポップアップは writer が `notification_priority='critical'` を明示したもの、または期限超過 / blocker / 再認証等の復旧語を含むものに限定する。 |
| 2026-06-27 | **L2本文 critical 誤爆停止**: `l2_notifications.title/summary` は抽出本文なので critical 判定に使わない。過去事故の説明や「blocked by ...」の引用で誤爆するため、緊急判定は `metadata_json` の明示 priority/reason/blocker 情報に限定する。 |
| 2026-06-27 | **coverage_gap の自動ルート追加**: `coverage_gap` の「はい」が gap confirmed で止まり、D-6化を手作業にしていた問題を修正。`proposed_target_l2='strategy_signal'` は `project_strategy_signals.status='confirmed'` へ自動upsertし、`l2_coverage_gaps.routed_to` に `project_strategy_signals:<signal_id>` を保存する。 |
| 2026-05-20 | **回答済みUI**: 「はい/いいえ/コメント」送信後は回答ボタンを消し、`回答済み` 表示へ切り替える。送信成功時に `read_at` を更新し、未対応/未読から `回答済み` タブへ即移動する。 |
| 2026-05-20 | **AMDプロトコル通知の個別化**: protocol candidate は `project_id + ym` でまとめず、`scope_key=YYYYMM:protocol:<protocol_id>` の1候補1通知に変更。PWA詳細表示と feedback 再抽出はこの個別 scope を解釈する。 |
| 2026-05-21 | **MTGサマリ反映の同期化**: `NEXT_PUBLIC_GAS_API_KEY` 未設定で再抽出がサイレント skip され、LST の固有名詞修正 feedback が `l2_feedbacks` に残ったまま `project_meeting_summaries` へ反映されない事故を修正。PWA は `CRON_SECRET` fallback でGAS runFuncを同期実行し、失敗時は 502。GAS pwaApi は `PWA_API_KEY` 未設定時 `CRON_SECRET` を認証キーに使う。 |
| 2026-05-21 | **raw_data_gap詳細表示の修正**: `CTB: 5月進捗スライドがOS未取り込み` の通知詳細で、通知metadataのDrive/Notion/Calendar根拠ではなく、後続backfillのSlack `source_cache` が表示されていた。raw_data_gapは `metadata_json.evidence_refs` を優先し、fallbackも短いsnippet/source refのみ表示するよう修正。 |
| 2026-05-22 | **通知反映ゲート**: `project_knowledge` / `founding_members` は候補状態で保存し、通知の「はい」だけで active 化する設計にした。当時は `member_knowledge` / `protocols` も同じ語彙で書いていたが、2026-05-25 #68 で current truth を訂正。`protocols` yes は `confirmed`、`member_knowledge` は現 schema に `status` 列なし。 |
| 2026-05-22 | **XRL個別scope修正 / raw_data_gap stale表示**: `xrl_evidence` は `YYYYMM:<slug>` 通知scopeから `YYYYMM` を抽出して `project_xrl_evidence` を探す。`meeting-not-ingested` のraw_data_gapは展開時にlive DBを確認し、すでに取り込み済みなら詳細先頭に表示する。 |

---

## 関連 md

- [`L2_DATA.md`](L2_DATA.md) — L2 全体
- [`ms_progress.md`](ms_progress.md) / [`member_knowledge.md`](member_knowledge.md) / [`project_knowledge.md`](project_knowledge.md) / [`amd_protocol.md`](amd_protocol.md) — 各 L2
- [`meeting_summaries.md`](meeting_summaries.md) — H-1 MTGサマリ
- [`../../ios/HANDOFF_l2_notifications.md`](../../ios/HANDOFF_l2_notifications.md) — iOS 受信仕様
