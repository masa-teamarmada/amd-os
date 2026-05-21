# 通知 + つくよみ修正依頼 — 設計の正本

最終更新: 2026-05-22 (notification apply gate)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

---

## このドキュメントが扱う範囲

Phase 4 で蓄積される 2 つの通知テーブル (`l2_notifications` + `meeting_notifications`) を
PWA 画面 + iOS で確認し、誤抽出に対して **「つくよみ (LLM 抽出 cron) に修正依頼」** を出す仕組み。

修正依頼は `l2_feedbacks` テーブル (migration 032) に蓄積され、上流 cron が次回抽出時に
LLM プロンプトに含めて再抽出する → 「過去の指摘が反映された L2 データ」が育つ。

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

L2 ⑦ OS台帳差分と L2 ⑧ XRL根拠は、全文保存ではなく「OSへ入れるべき構造化差分」だけを通知する。

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
| `member_knowledge` | `candidate` | `active` | `rejected` |
| `project_knowledge` | `candidate` | `active` | `rejected` |
| `protocols` | `candidate` | `active` | `rejected` |
| `founding_members` | `tentative` | `active` | `invalid` |
| `project_registry_diff` | `pending` | allowlist済みDB反映 + `applied` | `rejected` |
| `xrl_evidence` | `candidate` | `confirmed` | `rejected` |

コメントだけ送る場合は正本反映せず、`l2_feedbacks` / つくよみ学習リストへ残す。

### POST API
[pwa/src/app/api/notifications/feedback/route.ts](../src/app/api/notifications/feedback/route.ts)
- Body: `{ l2_kind, target_id, scope_key?, notification_id?, meeting_id?, feedback_text }`
- 認証: Supabase Auth セッション + `members.is_admin=true` 必須
- created_by: members.email = auth user.email から code_name を resolve
- `meeting_summary` の「はい・反映」は、feedback 保存だけで成功扱いにしない。`nav_meeting_processOneEvent_` を同期実行し、`project_meeting_summaries` と `meeting_notifications.summary_short` の更新成功を確認してから回答済みにする。GAS再抽出が失敗した場合は 502 を返し、通知カードを回答済みに移動しない。

---

## 上流 (GAS / PWA cron) 側の feedback 取り込み

### GAS 155 (`gas/155_L2KnowledgeExtractor.js`)

3 つの extractor (member/project/protocol) で:
1. `_l2_loadFeedbackBlock_(l2Kind, targetId, scopeKey)` で過去 feedback を取得 (active かつ scope_key 完全一致 or 'global'、最大 10 件。protocols は `YYYYMM:protocol:*` も月次抽出に含める)
2. LLM プロンプト末尾に追加: `=== 過去のユーザーフィードバック (重要・必ず反映すること) ===\n  1. [日付 by] テキスト\n  2. ...`
3. saved > 0 なら `_l2_recordFeedbackApplied_(feedbackIds)` で applied_count++ + last_applied_at = now()

### MTGサマリ (gas/074) / PWA progress-estimator (③ MS進捗)

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
- **raw_data_gapの詳細表示**: 通知が持つ `metadata_json.evidence_refs` を正本として表示する。`project_id + ym` の `source_cache` 全件を通知詳細として見せると、後続backfillのSlack/Gmail等が混ざって「生データ取り込み通知」に見えるため禁止。fallbackで `source_cache` を見る場合も、短いsnippet / source_url / hash / item_id だけを出し、本文全文やmetadata全量は表示しない。
- **既読の蓄積**: iOS/APNs 配信済みは `notified_at`、PWAの人間既読は `read_at`。どちらが入っても行は削除されない。UIは最新100件 + 既読折りたたみで見せるだけなので、現状はDBには蓄積し続ける。必要なら retention / archive job を別途設計する。
- **status='archived'**: 古い feedback が常時 LLM プロンプトに混じるとノイズになる → まさが UI から手動 archive できる仕組みが将来必要 (現状は SQL 直叩きで archive)
- **applied_count**: 現状は記録だけ。閾値超え (= 何度も適用されたが直らない) のフィードバックを通知する仕組みは将来
- **重複防止なし**: 同じ修正依頼を 2 回送ると 2 行 INSERT される (= LLM プロンプトに 2 件並ぶ)。気になれば UI で送信前 dedup チェック追加
- **マルチスコープ**: 同じ PJ で 202604 と 202605 に同じ修正を出したい場合は scope_key='global' を許可済 (= 全 ym に適用)。UI 上は scope 選択肢を作っていないので明示的には書けない (= 必要なら API 直叩き or UI 拡張)

---

## 過去の差分・履歴

| 日付 | 変更 |
|---|---|
| 2026-05-09 | 初版。`l2_feedbacks` テーブル + `/notifications` ページ + POST API + GAS 155 の 3 extractor で feedback 取り込み |
| 2026-05-09 | **MTGサマリ feedback 連携完成** (gas/074): `_l2_loadFeedbackBlock_("meeting_summary", projectId, meetingId)` で過去依頼を取得 → userPrompt に追加。saved>0 で `_l2_recordFeedbackApplied_` で applied_count++ + last_applied_at = now()。source_hash 入力に active feedback hash を混ぜる → 修正依頼追加で自動再抽出 (`_meeting_feedbackHashInput_`)。prompt rev "v4_alias_feedback" にバンプ |
| 2026-05-09 | **POST `/api/notifications/feedback` 末尾で 即 force 再抽出 fire-and-forget**: l2_kind ごとに対応 GAS 関数を runFunc で叩く (meeting_summary → `nav_meeting_processOneEvent_`、member_knowledge → `nav_member_knowledge_extractOne_` (member_id を server side で resolve)、project_knowledge → `nav_project_knowledge_extractOneForYm_`、protocols → `nav_protocol_extractOneForYm_`)。修正依頼を投げた瞬間に数十秒後に再抽出 → applied_count++ で UI 即反映 |
| 2026-05-09 | **通知 UI 改善**: `/notifications` の既読は折りたたみトグル (default closed)、開いた瞬間 `notified_at = now()` PATCH (= 即既読化)。ただし **グループ分けは server 値で固定** (= 開いた未読カードはセッション内は未読セクションに残って中身読める、リロードで初めて既読セクションへ移動)。GlobalNav 通知ベル (15 秒 polling) + Dashboard バナー追加。展開時に lazy fetch で実データ表示 (member_knowledge / project_knowledge / protocols / milestone_monthly_progress / project_meeting_summaries) |
| 2026-05-20 | **admin-only repair**: RLSが `anon SELECT` / `authenticated UPDATE` で、一般メンバーや直URLから通知が見える状態だったため、`amd_os_current_user_is_admin()` + migration 066 で4テーブルをadmin-only化。Dashboard banner / `/notifications` server page / feedback API もadmin gate追加。既読状態は `l2_notifications=87`, `meeting_notifications=10`, `app_notifications=35` を未読へ戻した。 |
| 2026-05-20 | **read_at split**: Swift/iOSの配信済み marker として `notified_at` が再セットされるため、PWA既読 marker を `read_at` に分離。migration 067で `l2_notifications.read_at` / `meeting_notifications.read_at` を追加し、PWA未読カウント・未読フィルタ・未読に戻す操作は `read_at` だけを見る。 |
| 2026-05-20 | **回答済みUI**: 「はい/いいえ/コメント」送信後は回答ボタンを消し、`回答済み` 表示へ切り替える。送信成功時に `read_at` を更新し、未対応/未読から `回答済み` タブへ即移動する。 |
| 2026-05-20 | **AMDプロトコル通知の個別化**: protocol candidate は `project_id + ym` でまとめず、`scope_key=YYYYMM:protocol:<protocol_id>` の1候補1通知に変更。PWA詳細表示と feedback 再抽出はこの個別 scope を解釈する。 |
| 2026-05-21 | **MTGサマリ反映の同期化**: `NEXT_PUBLIC_GAS_API_KEY` 未設定で再抽出がサイレント skip され、LST の固有名詞修正 feedback が `l2_feedbacks` に残ったまま `project_meeting_summaries` へ反映されない事故を修正。PWA は `CRON_SECRET` fallback でGAS runFuncを同期実行し、失敗時は 502。GAS pwaApi は `PWA_API_KEY` 未設定時 `CRON_SECRET` を認証キーに使う。 |
| 2026-05-21 | **raw_data_gap詳細表示の修正**: `CTB: 5月進捗スライドがOS未取り込み` の通知詳細で、通知metadataのDrive/Notion/Calendar根拠ではなく、後続backfillのSlack `source_cache` が表示されていた。raw_data_gapは `metadata_json.evidence_refs` を優先し、fallbackも短いsnippet/source refのみ表示するよう修正。 |
| 2026-05-22 | **通知反映ゲート**: `member_knowledge` / `project_knowledge` / `protocols` / `founding_members` は候補状態で保存し、通知の「はい」だけでactive化する。GAS 155 は `clasp push` 済み。 |

---

## 関連 md

- [`L2_DATA.md`](L2_DATA.md) — L2 全体
- [`ms_progress.md`](ms_progress.md) / [`member_knowledge.md`](member_knowledge.md) / [`project_knowledge.md`](project_knowledge.md) / [`amd_protocol.md`](amd_protocol.md) — 各 L2
- [`meeting_summaries.md`](meeting_summaries.md) — ⑥ MTGサマリ
- [`../../ios/HANDOFF_l2_notifications.md`](../../ios/HANDOFF_l2_notifications.md) — iOS 受信仕様
