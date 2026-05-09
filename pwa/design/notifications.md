# 通知 + つくよみ修正依頼 — 設計の正本

最終更新: 2026-05-09 (PWA 側初版)
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
  l2_kind         TEXT NOT NULL,             -- 'member_knowledge'|'project_knowledge'|'protocols'|'ms_progress'|'meeting_summary'
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
- SELECT: anon, authenticated (= 全員見える、admin/メンバーが状況把握できる)
- INSERT/UPDATE: authenticated (= ログイン後のまさ等が書ける)

---

## PWA 画面: `/notifications`

### Server page
[pwa/src/app/(app)/notifications/page.tsx](../src/app/\(app\)/notifications/page.tsx)
- l2_notifications (100 件) + meeting_notifications (100 件) + l2_feedbacks (200 件) + projects を fetch
- NotificationsClient に props 渡し

### Client component
[pwa/src/components/notifications/NotificationsClient.tsx](../src/components/notifications/NotificationsClient.tsx)
- フィルタタブ: すべて / 未読 (notified_at IS NULL) / 修正依頼あり
- 通知カード (時系列降順):
  - title (l2 通知は絵文字付き、meeting 通知は "📋 議事録: ..." を表示)
  - 補助メタ: 日時 / l2_kind / target / 未読 badge / 修正依頼 N 件 badge
- カードクリックで展開:
  - summary (本文)
  - 元データへの deep link (l2_kind ごと: protocols → /admin/protocols, ms_progress → /project/<id>/cockpit, etc.)
  - 既存 feedback 一覧 (この通知に紐づく / 同 (l2_kind, target_id, scope_key) の)
  - 「⚠️ つくよみに修正依頼」textarea + 送信ボタン

### POST API
[pwa/src/app/api/notifications/feedback/route.ts](../src/app/api/notifications/feedback/route.ts)
- Body: `{ l2_kind, target_id, scope_key?, notification_id?, meeting_id?, feedback_text }`
- 認証: Supabase Auth セッション必須 (RLS authenticated INSERT)
- created_by: members.email = auth user.email から code_name を resolve

---

## 上流 (GAS / PWA cron) 側の feedback 取り込み

### GAS 155 (`gas/155_L2KnowledgeExtractor.js`)

3 つの extractor (member/project/protocol) で:
1. `_l2_loadFeedbackBlock_(l2Kind, targetId, scopeKey)` で過去 feedback を取得 (active かつ scope_key 完全一致 or 'global'、最大 10 件)
2. LLM プロンプト末尾に追加: `=== 過去のユーザーフィードバック (重要・必ず反映すること) ===\n  1. [日付 by] テキスト\n  2. ...`
3. saved > 0 なら `_l2_recordFeedbackApplied_(feedbackIds)` で applied_count++ + last_applied_at = now()

### MTGサマリ (gas/074) / PWA progress-estimator (③ MS進捗)

**TODO**: 同じパターンで feedback ブロック追加 (= 別セッションで実装、本セッションは GAS 155 のみ)
- gas/074 `nav_meeting_processOneEvent_`: `_l2_loadFeedbackBlock_("meeting_summary", projectId, eventId)` を組み込む
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

- **RLS**: 当面 anon でも SELECT 可能 (= 仕様確認・デバッグしやすい)。プロダクション前に絞る検討
- **status='archived'**: 古い feedback が常時 LLM プロンプトに混じるとノイズになる → まさが UI から手動 archive できる仕組みが将来必要 (現状は SQL 直叩きで archive)
- **applied_count**: 現状は記録だけ。閾値超え (= 何度も適用されたが直らない) のフィードバックを通知する仕組みは将来
- **重複防止なし**: 同じ修正依頼を 2 回送ると 2 行 INSERT される (= LLM プロンプトに 2 件並ぶ)。気になれば UI で送信前 dedup チェック追加
- **マルチスコープ**: 同じ PJ で 202604 と 202605 に同じ修正を出したい場合は scope_key='global' を許可済 (= 全 ym に適用)。UI 上は scope 選択肢を作っていないので明示的には書けない (= 必要なら API 直叩き or UI 拡張)

---

## 過去の差分・履歴

| 日付 | 変更 |
|---|---|
| 2026-05-09 | 初版。`l2_feedbacks` テーブル + `/notifications` ページ + POST API + GAS 155 の 3 extractor で feedback 取り込み |

---

## 関連 md

- [`L2_DATA.md`](L2_DATA.md) — L2 全体
- [`ms_progress.md`](ms_progress.md) / [`member_knowledge.md`](member_knowledge.md) / [`project_knowledge.md`](project_knowledge.md) / [`amd_protocol.md`](amd_protocol.md) — 各 L2
- [`meeting_summaries.md`](meeting_summaries.md) — ⑥ MTGサマリ
- [`../../ios/HANDOFF_l2_notifications.md`](../../ios/HANDOFF_l2_notifications.md) — iOS 受信仕様
