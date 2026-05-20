# HANDOFF — iOS 側 MTG 議事録 APNs 通知 (Phase 3)

PWA / GAS 側で MTG サマリ Phase 3 を実装した結果、**iOS Swift 版で「議事録が拾えたら APNs 通知」を受ける仕組み** が必要になった。
このドキュメントは Swift 側 (ios/) のえいみ向けに、上流が用意したインターフェイスと iOS 側の実装方針をまとめる。

作成: 2026-05-09 (PWA/GAS 側 brave-cohen-15d352 セッション)
正本ステータス: 上流 (PWA/GAS) は完了。**iOS 側は未着手**。

---

## 全体像

```
[Calendar event: 終了]
   ↓ +60 分
[GAS time-trigger] (153_MeetingHourlyTrigger.js)
   ↓ 1 event 抽出 (Notion + Gmail 結合 → Gemini)
[Supabase: project_meeting_summaries]  upsert
   ↓ sourceKinds != 'none' なら
[Supabase: meeting_notifications]      upsert (notified_at = NULL)
   ↓
[iOS Swift]   (★ 未実装 = ここのハンドオフ)
   ↓ notified_at IS NULL を realtime sub or polling で検出
   ↓ APNs ローカル通知 or remote push
   ↓ 通知タップ → CockpitView (該当 PJ) に遷移
   ↓ notified_at = now() に UPDATE
```

---

## 上流 (PWA/GAS) で既に実装したもの

### Supabase テーブル `meeting_notifications`

```sql
-- migration 028
CREATE TABLE meeting_notifications (
  meeting_id      TEXT PRIMARY KEY REFERENCES project_meeting_summaries(meeting_id) ON DELETE CASCADE,
  project_id      TEXT NOT NULL,
  title           TEXT NOT NULL,
  source_kinds    TEXT NOT NULL,          -- 'notion' | 'gmail' | 'notion+gmail'
  summary_short   TEXT NOT NULL DEFAULT '',
  notified_at     TIMESTAMPTZ,            -- ★ iOS が APNs 送信したら now() に更新する
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 未通知の高速取得用 partial index
CREATE INDEX idx_meeting_notifications_unsent
  ON meeting_notifications(created_at DESC)
  WHERE notified_at IS NULL;
```

### RLS

- SELECT: anon, authenticated
- UPDATE: authenticated (= iOS の Supabase Auth で notified_at を打てる)
- INSERT/UPSERT: service_role (GAS 側のみ)

### update トリガ

`source_kinds` / `summary_short` / `title` のどれかが変わったら **`notified_at` が NULL に戻る** = 再通知される。
(= 議事録が後から更新されたら、もう一度通知が飛ぶ)

### GAS 側の書き込み

`gas/153_MeetingHourlyTrigger.js` の `_meeting_insertNotification_(payload)` が
`supa_upsert("meeting_notifications", row, "meeting_id")` で書く。

---

## iOS 側で実装すべきこと

### 1. データ受信方式の選択

**選択肢 A: Realtime subscription (推奨)**
```swift
// Supabase Swift SDK の realtime channel
supabase.realtimeV2.channel("meeting_notifications:changes")
    .on(.postgresChanges, filter: ChannelFilter(
        event: "INSERT",
        schema: "public",
        table: "meeting_notifications"
    )) { payload in
        // 受信 → APNs ローカル通知
    }
    .subscribe()
```

メリット: バッテリー持ちが良い、リアルタイム性高い
デメリット: アプリがフォアグラウンドの間しか動かない (バックグラウンドで切れる)

**選択肢 B: 30 分ごとの background fetch + polling**
- `BGAppRefreshTask` で `notified_at IS NULL` を SELECT して未通知ぶんだけ拾う
- iOS 側で local notification を投げる
- notified_at = now() で UPDATE

メリット: バックグラウンドでも動く
デメリット: iOS が background fetch を許可するかは OS 任せ

**選択肢 C: APNs Remote Push (本格派、別途バックエンド要)**
- Supabase Edge Function で APNs 直叩き
- iOS 側で device token を Supabase に登録するテーブル必要
- これが一番安定するが実装コスト大

→ **まず A を実装、足りなければ B 追加**を推奨。

### 2. 未通知行のフェッチ

```swift
struct MeetingNotification: Codable {
    let meetingId: String
    let projectId: String
    let title: String
    let sourceKinds: String
    let summaryShort: String
    let createdAt: Date
}

func fetchUnnotified() async throws -> [MeetingNotification] {
    let response: [MeetingNotification] = try await supabase
        .from("meeting_notifications")
        .select()
        .is("notified_at", value: nil)
        .order("created_at", ascending: false)
        .execute()
        .value
    return response
}
```

### 3. ローカル通知の表示

```swift
import UserNotifications

func showLocalNotification(_ n: MeetingNotification) async {
    let content = UNMutableNotificationContent()
    content.title = "📋 議事録: \(n.title)"
    content.body = n.summaryShort.isEmpty ? "[\(n.sourceKinds)]" : n.summaryShort
    content.sound = .default
    content.userInfo = [
        "meetingId": n.meetingId,
        "projectId": n.projectId
    ]

    let req = UNNotificationRequest(
        identifier: "meeting-\(n.meetingId)",
        content: content,
        trigger: nil // 即時表示
    )
    try? await UNUserNotificationCenter.current().add(req)
}
```

### 4. notified_at マーク

```swift
func markNotified(meetingId: String) async throws {
    try await supabase
        .from("meeting_notifications")
        .update(["notified_at": Date().ISO8601Format()])
        .eq("meeting_id", value: meetingId)
        .execute()
}
```

### 5. 通知タップ → 画面遷移

```swift
// AppDelegate or SceneDelegate
func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
) {
    let info = response.notification.request.content.userInfo
    if let projectId = info["projectId"] as? String,
       let meetingId = info["meetingId"] as? String {
        // CockpitView (PJ) に遷移して MTG サマリ枠を該当 row までスクロール
        navigation.navigateToProject(projectId)
        // optionally: navigation.scrollMeetingSummaryTo(meetingId)
    }
    completionHandler()
}
```

### 6. 通知許可リクエスト

アプリ初回起動時 (or 設定画面から) に `UNUserNotificationCenter.requestAuthorization` 要請。
```swift
let center = UNUserNotificationCenter.current()
let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
```

---

## 実装順序の提案 (iOS セッション向け)

1. `MeetingNotification` model + Supabase fetch helper (`MeetingNotificationRepo.swift`)
2. アプリ起動時 + foreground 復帰時に未通知をフェッチ → ローカル通知 → notified_at マーク
3. Realtime subscription を追加 (オプション、フォアグラウンドのみ)
4. 通知タップ → 該当 PJ の CockpitView に遷移
5. 通知許可フローを設定画面に追加
6. Background fetch (オプション)

---

## 確認事項 (iOS セッションでまさに聞く)

- 通知の体裁: タイトルに sourceKinds (`[gmail]` 等) を出すか?
- 通知の集約: 同 PJ で 5 分以内に複数通知が来たらまとめるか? それとも全部別々で OK?
- 開発確認方法: GAS の `nav_meeting_listPendingTriggers` で pending を見て、テスト用に手動で `meeting_notifications` に upsert する curl も用意できる
- まさが普段「ホーム画面にどう置いてる」か (= 通知タップ後の遷移先設計に影響)

---

## 関連ドキュメント

- 上流仕様: [`pwa/design/meeting_summaries.md`](../pwa/design/meeting_summaries.md) (Phase 3 セクション)
- L2 データ正本: [`pwa/design/L2_DATA.md`](../pwa/design/L2_DATA.md)
- GAS 実装: [`gas/074_MeetingSummaryRepo.js`](../gas/074_MeetingSummaryRepo.js) `nav_meeting_processOneEvent_`
- GAS 実装: [`gas/153_MeetingHourlyTrigger.js`](../gas/153_MeetingHourlyTrigger.js) scheduling + callback
- migration: [`pwa/scripts/migrations/028_meeting_notifications.sql`](../pwa/scripts/migrations/028_meeting_notifications.sql)

---

## 反映状況 (append-only)

| 日付 | 範囲 | commit / 状態 |
|---|---|---|
| 2026-05-09 | 上流 (PWA/GAS) Phase 3 完了 + 本ハンドオフ作成 | brave-cohen-15d352 セッション |
| 2026-05-09 | **iOS Swift 受信実装 完了 (l2_notifications と統合実装)**: AMDOSApp.swift 内 `NotificationService.pollMeetingNotifications()` で fetch + ローカル通知 + notified_at マーク。詳細は姉妹文書 [HANDOFF_l2_notifications.md](HANDOFF_l2_notifications.md) 反映状況セクション参照 | quirky-moore-b60501 セッション継続 |
| 2026-05-20 | **iOS Swift 議事録通知の詳細・回答導線を追加**: 通知タップで `NotificationInboxView` を開き、該当議事録通知を展開。マイページ最上部の「通知ボックス」からも一覧確認可能。`meeting_summary` として `l2_feedbacks` に `はい` / `いいえ` / コメントを保存し、`project_meeting_summaries` の要約本文・source URL / Notion URL を関連データとして表示。masaiPhone へ Debug build install + launch 済み。 | 2026-05-20 セッション |
| 2026-05-20 | **回答済み分類を修正**: 議事録通知も回答後は `すべて` / `未読` から外し、`回答済み` フィルタに移動する。通知アクション経由の回答でも `meeting_notifications.notified_at` を更新し、delivered notification を削除する。 | 2026-05-20 セッション |
