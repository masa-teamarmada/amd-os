# HANDOFF — iOS 側 L2 抽出 APNs 通知 (Phase 4)

PWA / GAS 側で Phase 4 3542 の L2 自動抽出を実装した結果、**iOS Swift 版で「L2 が抽出されたら APNs ローカル通知」を受ける仕組み** が必要になった。
このドキュメントは姉妹文書 [`HANDOFF_meeting_notifications.md`](HANDOFF_meeting_notifications.md) (= 6 MTGサマリ Phase 3 専用) と並列。両方を Swift 側で受信する。

作成: 2026-05-09 (PWA/GAS 側 quirky-moore-b60501 セッション)
正本ステータス: 上流 (PWA/GAS) は完了。**iOS 側は未着手**。

---

## 全体像

```
[毎時 0/15/30 分 GAS time-trigger]
   ↓
[GAS 155 / 154 / PWA cron] 各 L2 を Gemini/Sonnet で抽出
   ↓ saved > 0 なら
[Supabase: l2_notifications]  upsert (notified_at = NULL)
   ↓
[iOS Swift]   (★ 未実装 = ここのハンドオフ)
   ↓ notified_at IS NULL を realtime sub or polling で検出
   ↓ APNs ローカル通知
   ↓ 通知タップ → l2_kind に応じた画面に遷移
   ↓ notified_at = now() に UPDATE
```

---

## 上流 (PWA/GAS) で既に実装したもの

### Supabase テーブル `l2_notifications` (migration 031)

```sql
CREATE TABLE l2_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  l2_kind         TEXT NOT NULL,        -- 'member_knowledge' | 'project_knowledge' | 'protocols' | 'ms_progress'
  target_id       TEXT NOT NULL,        -- code_name (member系) or project_id (PJ系)
  scope_key       TEXT NOT NULL,        -- ym (PJ系) or 'global' (member系)
  title           TEXT NOT NULL,        -- 通知タイトル (例: "⚖️ SX (202605) AMDプロトコル candidate (2件)")
  summary         TEXT,                 -- 通知本文 (200 字程度)
  saved_count     INT  NOT NULL DEFAULT 0,
  total_count     INT  NOT NULL DEFAULT 0,
  importance      INT  NOT NULL DEFAULT 1,   -- 1=info, 2=normal, 3=urgent
  notified_at     TIMESTAMPTZ,          -- ★ Swift が APNs 送信したら now() で UPDATE
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (l2_kind, target_id, scope_key)
);

-- 未通知の高速取得用 partial index
CREATE INDEX idx_l2_notifications_unsent
  ON l2_notifications (created_at DESC)
  WHERE notified_at IS NULL;
```

### update トリガ

`title` / `summary` / `saved_count` のどれかが変わったら **`notified_at` が NULL に戻る** = 再通知される。
(= 同じ抽出結果なら通知されないが、新規抽出で saved_count が変わったら再度通知)

### RLS

- SELECT: anon, authenticated
- UPDATE: authenticated (= iOS の Supabase Auth で notified_at を打てる)
- INSERT/UPSERT: service_role (GAS / PWA service-role 経由のみ)

### 上流側の書き込み

| 書き込み元 | 関数 | l2_kind |
|---|---|---|
| GAS `gas/155_L2KnowledgeExtractor.js` `nav_member_knowledge_extractOne_` | `_l2_insertNotification_` | `member_knowledge` |
| GAS `gas/155_L2KnowledgeExtractor.js` `nav_project_knowledge_extractOneForYm_` | 同上 | `project_knowledge` |
| GAS `gas/155_L2KnowledgeExtractor.js` `nav_protocol_extractOneForYm_` | 同上 | `protocols` |
| PWA `pwa/src/lib/progress-estimator.ts` `estimateProgress` | inline `supabase.from('l2_notifications').upsert(...)` | `ms_progress` |

---

## iOS 側で実装すべきこと

### 1. データ受信方式

`HANDOFF_meeting_notifications.md` と **同じパターン**。Realtime sub (推奨) or BGAppRefreshTask polling の二択。
両ハンドオフで共通の `NotificationRepository` を作るのが筋。

### 2. 通知の体裁案 (l2_kind ごとに分岐)

```swift
struct L2Notification: Codable {
    let notificationId: UUID
    let l2Kind: String       // 'member_knowledge' | 'project_knowledge' | 'protocols' | 'ms_progress'
    let targetId: String
    let scopeKey: String
    let title: String
    let summary: String?
    let savedCount: Int
    let totalCount: Int
    let importance: Int
    let createdAt: Date
}

func showLocalNotification(_ n: L2Notification) async {
    let content = UNMutableNotificationContent()
    content.title = n.title  // 上流側で絵文字付きに整形済 (👤 / 🗂️ / ⚖️ / 📈)
    content.body = n.summary ?? ""
    content.sound = n.importance >= 3 ? .defaultCritical : .default
    content.badge = NSNumber(value: n.savedCount)
    content.userInfo = [
        "l2Kind": n.l2Kind,
        "targetId": n.targetId,
        "scopeKey": n.scopeKey,
        "notificationId": n.notificationId.uuidString
    ]
    let req = UNNotificationRequest(
        identifier: "l2-\(n.notificationId.uuidString)",
        content: content,
        trigger: nil
    )
    try? await UNUserNotificationCenter.current().add(req)
}
```

### 3. 通知タップ → 画面遷移 (l2_kind ごと)

```swift
func handleTap(userInfo: [AnyHashable: Any]) {
    guard let l2Kind = userInfo["l2Kind"] as? String,
          let targetId = userInfo["targetId"] as? String else { return }
    let scopeKey = userInfo["scopeKey"] as? String ?? ""

    switch l2Kind {
    case "member_knowledge":
        // メンバー詳細ページ (admin/members/<code_name> 相当)
        navigation.navigateToMember(codeName: targetId)
    case "project_knowledge":
        // PJ コックピット (該当 ym のナレッジ枠を開く)
        navigation.navigateToProjectCockpit(projectId: targetId, focus: .knowledge, ym: scopeKey)
    case "protocols":
        // PJ プロトコル一覧 (candidate を表示、まさが confirmed 昇格できる)
        navigation.navigateToProjectProtocols(projectId: targetId, status: "candidate")
    case "ms_progress":
        // PJ コックピット月次モーダル (該当 ym の進捗バー)
        navigation.navigateToProjectCockpit(projectId: targetId, focus: .msProgress, ym: scopeKey)
    default:
        navigation.navigateToHome()
    }
}
```

### 4. notified_at マーク

```swift
func markNotified(notificationId: UUID) async throws {
    try await supabase
        .from("l2_notifications")
        .update(["notified_at": Date().ISO8601Format()])
        .eq("notification_id", value: notificationId.uuidString)
        .execute()
}
```

### 5. 集約方針 (まさへの要確認)

- 1 抽出 cron が回ると最大 4 種 × 7 PJ = 30 通知 / 時間 のピーク → 通知洪水を避けたい
- 案 A: importance=1 (info) は 1 日 1 通だけに集約 (= UI で「未読」一覧表示) / importance>=2 はリアルタイム
- 案 B: l2_kind ごとに 1 通 (= "PJナレッジ更新 5 PJ で計 14 件" 的な日次まとめ)
- 上流の `l2_notifications` には全部入るので、Swift 側で集約条件を組める
- 当面は importance=1 もリアルタイム表示でいいか? まさに要確認

---

## 実装順序の提案 (iOS セッション向け)

1. `L2Notification` model + `L2NotificationRepository.swift` (fetch/markNotified)
2. アプリ起動時 + foreground 復帰時に未通知をフェッチ → ローカル通知 → notified_at マーク
3. l2_kind ごとの遷移先実装 (上記 3.)
4. 集約方針 (まさと相談、上記 5.)
5. Realtime subscription (オプション)
6. Background fetch (オプション)
7. 通知許可フロー (= meeting_notifications と共通 UI)

---

## 確認事項 (iOS セッションでまさに聞く)

- 集約方針: 上記 5.
- 通知の重要度マッピング: importance=3 (urgent) はあるか? = 上流の AMDプロトコル抽出は importance を LLM が決める (1-3)、重大判定 = critical sound にするか
- アイコン: l2_kind ごとの絵文字 (👤 🗂️ ⚖️ 📈) は適切か、調整したいか
- 「全部既読にする」ボタンが必要か (= UI 上で UPDATE 一括実行)

---

## 関連ドキュメント

- 姉妹: [`HANDOFF_meeting_notifications.md`](HANDOFF_meeting_notifications.md) (6 MTGサマリ Phase 3 専用通知)
- 上流仕様: [`pwa/design/L2_DATA.md`](../pwa/design/L2_DATA.md) (H-1 Meeting Flow 種 + Phase 4 全完了)
- 上流仕様: [`pwa/design/ms_progress.md`](../pwa/design/ms_progress.md) (3 MS進捗)
- 上流仕様: [`pwa/design/member_knowledge.md`](../pwa/design/member_knowledge.md) (5)
- 上流仕様: [`pwa/design/project_knowledge.md`](../pwa/design/project_knowledge.md) (4)
- 上流仕様: [`pwa/design/amd_protocol.md`](../pwa/design/amd_protocol.md) (2)
- GAS 実装: [`gas/155_L2KnowledgeExtractor.js`](../gas/155_L2KnowledgeExtractor.js) `_l2_insertNotification_`
- PWA 実装: [`pwa/src/lib/progress-estimator.ts`](../pwa/src/lib/progress-estimator.ts) (末尾)
- migration: [`pwa/scripts/migrations/031_l2_notifications.sql`](../pwa/scripts/migrations/031_l2_notifications.sql)

---

## 反映状況 (append-only)

| 日付 | 範囲 | commit / 状態 |
|---|---|---|
| 2026-05-09 | 上流 (PWA/GAS) Phase 4 全 4 L2 通知 完了 + 本ハンドオフ作成 | quirky-moore-b60501 セッション |
| 2026-05-09 | **iOS Swift 受信実装 完了 (両テーブル同時対応)**: AMDOSApp.swift に `NotificationService` (`@MainActor` `ObservableObject`) + Models (`L2Notification` / `MeetingNotification`) を集約実装。起動時 + scenePhase==.active 復帰時に `pollAllAndShowNotifications()` で両テーブル fetch → UNUserNotificationCenter ローカル通知 → notified_at = now() で UPDATE。許可リクエストは `requestAuthorizationIfNeeded()`。masaiPhone (iPhone 16 Pro) に install + launch 成功確認。**画面遷移は print のみ (= 後続セッションで深化)** | quirky-moore-b60501 セッション継続 |
| 2026-05-20 | **iOS Swift 通知受信箱・回答実装 完了**: `NotificationInboxView` を追加し、マイページ最上部の「通知ボックス」から `l2_notifications` / `meeting_notifications` を統合確認できるようにした。通知タップは該当カードを展開、通知アクションは `はい` / `いいえ` / `コメント` を直接送信。`l2_feedbacks` に保存し、`ms_progress` は confirm/discard、`project_registry_diff` は accepted/rejected、`xrl_evidence` は confirmed/rejected まで Swift 側で反映。project registry の実DB適用は既存ルール通り helper/PWA 経由。masaiPhone へ Debug build install + launch 済み。 | 2026-05-20 セッション |
| 2026-05-20 | **回答済み分類を修正**: 回答済み通知は `すべて` / `未読` から除外し、`回答済み` フィルタにだけ出す。通知アクションから `はい` / `いいえ` / コメントした場合も `notified_at` を更新し、delivered notification を削除する。 | 2026-05-20 セッション |
