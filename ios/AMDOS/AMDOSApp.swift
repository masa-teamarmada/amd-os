import SwiftUI
import UserNotifications
import Supabase

// ============================================================
// AMD OS iOS エントリポイント
// ============================================================

@main
struct AMDOSApp: App {
    @StateObject private var authService = AuthService()
    @StateObject private var notificationService = NotificationService.shared
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authService)
                .environmentObject(notificationService)
                .task {
                    // 起動時に 1 度 poll
                    await notificationService.pollAllAndShowNotifications()
                }
                .onChange(of: scenePhase) { _, newPhase in
                    if newPhase == .active {
                        Task { await notificationService.pollAllAndShowNotifications() }
                    }
                }
        }
    }
}

// ============================================================
// AppDelegate (UNUserNotificationCenterDelegate)
// ============================================================

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        registerNotificationActions(center: center)
        return true
    }

    private func registerNotificationActions(center: UNUserNotificationCenter) {
        let yes = UNNotificationAction(
            identifier: "AMD_NOTIFICATION_YES",
            title: "はい",
            options: [.authenticationRequired]
        )
        let no = UNNotificationAction(
            identifier: "AMD_NOTIFICATION_NO",
            title: "いいえ",
            options: [.authenticationRequired]
        )
        let comment = UNTextInputNotificationAction(
            identifier: "AMD_NOTIFICATION_COMMENT",
            title: "コメント",
            options: [.authenticationRequired],
            textInputButtonTitle: "送信",
            textInputPlaceholder: "コメント"
        )

        let l2 = UNNotificationCategory(
            identifier: "AMD_L2_NOTIFICATION",
            actions: [yes, no, comment],
            intentIdentifiers: [],
            options: []
        )
        let meeting = UNNotificationCategory(
            identifier: "AMD_MEETING_NOTIFICATION",
            actions: [yes, no, comment],
            intentIdentifiers: [],
            options: []
        )
        let connectorAuth = UNNotificationCategory(
            identifier: "AMD_CONNECTOR_AUTH_NOTIFICATION",
            actions: [],
            intentIdentifiers: [],
            options: []
        )
        center.setNotificationCategories([l2, meeting, connectorAuth])
    }

    /// foreground 中でもバナー + サウンドを出す
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge, .list])
    }

    /// 通知タップ / アクション: ネイティブ通知詳細 or 直接レスに流す
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let info = response.notification.request.content.userInfo

        switch response.actionIdentifier {
        case "AMD_NOTIFICATION_YES":
            Task {
                await NotificationService.shared.respondFromNotification(
                    userInfo: info,
                    action: .yes,
                    comment: "",
                    requestIdentifier: response.notification.request.identifier
                )
                completionHandler()
            }
        case "AMD_NOTIFICATION_NO":
            Task {
                await NotificationService.shared.respondFromNotification(
                    userInfo: info,
                    action: .no,
                    comment: "",
                    requestIdentifier: response.notification.request.identifier
                )
                completionHandler()
            }
        case "AMD_NOTIFICATION_COMMENT":
            let text = (response as? UNTextInputNotificationResponse)?.userText ?? ""
            Task {
                await NotificationService.shared.respondFromNotification(
                    userInfo: info,
                    action: .comment,
                    comment: text,
                    requestIdentifier: response.notification.request.identifier
                )
                completionHandler()
            }
        default:
            Task { @MainActor in
                NotificationService.shared.handleNotificationTap(userInfo: info)
                completionHandler()
            }
        }
    }
}

// ============================================================
// Notification Models
// (Phase 4 上流テーブル l2_notifications + meeting_notifications 用)
//
// 仕様正本: ios/HANDOFF_l2_notifications.md / ios/HANDOFF_meeting_notifications.md
// ※ 本来 Core/Models/ に分離したいが、project.pbxproj への手動登録回避のため
//    AMDOSApp.swift 内に同梱。後続セッションで xcodegen 導入後に切り出し可能。
// ============================================================

enum L2Kind: String, Codable, Sendable {
    case memberKnowledge = "member_knowledge"
    case projectKnowledge = "project_knowledge"
    case protocols = "protocols"
    case msProgress = "ms_progress"
}

struct L2Notification: Codable, Identifiable, Sendable {
    let notificationId: UUID
    let l2Kind: String
    let targetId: String
    let scopeKey: String
    let title: String
    let summary: String?
    let savedCount: Int
    let totalCount: Int
    let importance: Int
    let attentionState: String
    let requiresMasaDecision: Bool
    let attentionType: String?
    let notifiedAt: Date?
    let createdAt: Date

    var id: UUID { notificationId }

    enum CodingKeys: String, CodingKey {
        case notificationId = "notification_id"
        case l2Kind = "l2_kind"
        case targetId = "target_id"
        case scopeKey = "scope_key"
        case title
        case summary
        case savedCount = "saved_count"
        case totalCount = "total_count"
        case importance
        case attentionState = "attention_state"
        case requiresMasaDecision = "requires_masa_decision"
        case attentionType = "attention_type"
        case notifiedAt = "notified_at"
        case createdAt = "created_at"
    }
}

struct MeetingNotification: Codable, Identifiable, Sendable {
    let meetingId: String
    let projectId: String
    let title: String
    let sourceKinds: String
    let summaryShort: String
    let notifiedAt: Date?
    let createdAt: Date

    var id: String { meetingId }

    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id"
        case projectId = "project_id"
        case title
        case sourceKinds = "source_kinds"
        case summaryShort = "summary_short"
        case notifiedAt = "notified_at"
        case createdAt = "created_at"
    }
}

struct AppConnectorAuthNotification: Decodable, Identifiable {
    let id: String
    let kind: String
    let title: String
    let body: String?
    let link: String?
    let meta: [String: AnyCodable]?
    let nativeNotifiedAt: String?
    let readAt: String?
    let dismissedAt: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case kind
        case title
        case body
        case link
        case meta
        case nativeNotifiedAt = "native_notified_at"
        case readAt = "read_at"
        case dismissedAt = "dismissed_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var reauthURL: String? {
        stringMeta("reauth_url")
            ?? stringMeta("reauth_install_url")
            ?? stringMeta("reauth_app_url")
            ?? link
    }

    var connector: String {
        stringMeta("connector") ?? "connector"
    }

    var reason: String {
        stringMeta("reason") ?? "reauth_required"
    }

    private func stringMeta(_ key: String) -> String? {
        guard let value = meta?[key]?.value as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

enum NotificationInboxAction: String, Sendable {
    case yes
    case no
    case comment

    var label: String {
        switch self {
        case .yes: return "はい"
        case .no: return "いいえ"
        case .comment: return "コメント"
        }
    }
}

struct NotificationResponseTarget: Hashable, Sendable {
    let kind: String
    let l2Kind: String?
    let targetId: String
    let scopeKey: String
    let notificationId: String?
    let meetingId: String?
    let projectId: String?

    var feedbackKind: String {
        if kind == "connector_auth" { return "connector_auth" }
        return kind == "meeting" ? "meeting_summary" : (l2Kind ?? "")
    }

    var feedbackTargetId: String {
        if kind == "connector_auth" { return targetId }
        return kind == "meeting" ? (projectId ?? targetId) : targetId
    }

    var feedbackScopeKey: String {
        if kind == "connector_auth" { return scopeKey }
        return kind == "meeting" ? (meetingId ?? scopeKey) : scopeKey
    }

    var itemId: String {
        if kind == "connector_auth" {
            return "connector-auth-\(notificationId ?? targetId)"
        }
        if kind == "meeting", let meetingId {
            return "meeting-\(meetingId)"
        }
        if let notificationId {
            return "l2-\(notificationId)"
        }
        return "\(kind)-\(feedbackKind)-\(feedbackTargetId)-\(feedbackScopeKey)"
    }

    init?(
        kind: String?,
        l2Kind: String?,
        targetId: String?,
        scopeKey: String?,
        notificationId: String?,
        meetingId: String?,
        projectId: String?
    ) {
        guard let kind, !kind.isEmpty else { return nil }
        if kind == "connector_auth" {
            guard let targetId, !targetId.isEmpty else { return nil }
            self.kind = kind
            self.l2Kind = "connector_auth"
            self.targetId = targetId
            self.scopeKey = scopeKey?.isEmpty == false ? (scopeKey ?? "global") : "global"
            self.notificationId = notificationId ?? targetId
            self.meetingId = nil
            self.projectId = nil
            return
        }
        if kind == "meeting" {
            guard let meetingId, !meetingId.isEmpty,
                  let projectId, !projectId.isEmpty else { return nil }
            self.kind = kind
            self.l2Kind = nil
            self.targetId = projectId
            self.scopeKey = meetingId
            self.notificationId = nil
            self.meetingId = meetingId
            self.projectId = projectId
            return
        }

        guard let l2Kind, !l2Kind.isEmpty,
              let targetId, !targetId.isEmpty,
              let scopeKey, !scopeKey.isEmpty else { return nil }
        self.kind = kind
        self.l2Kind = l2Kind
        self.targetId = targetId
        self.scopeKey = scopeKey
        self.notificationId = notificationId
        self.meetingId = meetingId
        self.projectId = projectId
    }

    init?(userInfo: [AnyHashable: Any]) {
        self.init(
            kind: userInfo["kind"] as? String,
            l2Kind: userInfo["l2Kind"] as? String,
            targetId: userInfo["targetId"] as? String,
            scopeKey: userInfo["scopeKey"] as? String,
            notificationId: userInfo["notificationId"] as? String,
            meetingId: userInfo["meetingId"] as? String,
            projectId: userInfo["projectId"] as? String
        )
    }
}

struct NotificationDeepLink: Identifiable, Equatable, Sendable {
    let target: NotificationResponseTarget
    var id: String { target.itemId }

    init?(userInfo: [AnyHashable: Any]) {
        guard let target = NotificationResponseTarget(userInfo: userInfo) else { return nil }
        self.target = target
    }
}

// ============================================================
// NotificationService
//
// Phase 4 で上流が用意した 2 テーブルを foreground 復帰時に polling し、
// 未通知の行 (notified_at IS NULL) について UNUserNotificationCenter で
// ローカル通知を出して、表示後に notified_at = now() で UPDATE する。
//
// Polling 戦略: アプリ起動時 + scenePhase==.active 復帰時に 1 度
// (集約は当面なし。洪水になったら importance ベース集約を導入)
// ============================================================

@MainActor
final class NotificationService: ObservableObject {
    static let shared = NotificationService()

    private let client: SupabaseClient

    @Published var lastError: String?
    @Published var lastFetchedAt: Date?
    @Published var lastShownCount: Int = 0
    @Published var lastResponseMessage: String?
    @Published var activeInboxLink: NotificationDeepLink?

    private init() {
        self.client = SupabaseClient(
            supabaseURL: URL(string: "https://nbnhrhybjslbawdukvvk.supabase.co")!,
            supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ibmhyaHlianNsYmF3ZHVrdnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDEzNjUsImV4cCI6MjA5MTAxNzM2NX0.X16kjZlqeUCHKinkiAodSXrI1iQi47Z4dPZxt_Ja4Bg"
        )
    }

    // MARK: - 通知許可

    @discardableResult
    func requestAuthorizationIfNeeded() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined:
            do {
                return try await center.requestAuthorization(options: [.alert, .sound, .badge])
            } catch {
                lastError = "authorization request failed: \(error.localizedDescription)"
                return false
            }
        case .denied:
            return false
        case .authorized, .provisional, .ephemeral:
            return true
        @unknown default:
            return false
        }
    }

    // MARK: - エントリ

    func pollAllAndShowNotifications() async {
        let granted = await requestAuthorizationIfNeeded()
        if !granted { return }

        async let l2Count = pollL2Notifications()
        async let connectorAuthCount = pollConnectorAuthNotifications()

        let l2 = (try? await l2Count) ?? 0
        let connectorAuth = (try? await connectorAuthCount) ?? 0
        lastFetchedAt = Date()
        lastShownCount = l2 + connectorAuth
    }

    func handleNotificationTap(userInfo: [AnyHashable: Any]) {
        if (userInfo["kind"] as? String) == "connector_auth" {
            openConnectorAuthReauth(userInfo: userInfo)
            return
        }
        guard let link = NotificationDeepLink(userInfo: userInfo) else {
            lastError = "通知の遷移情報を読めなかった"
            return
        }
        activeInboxLink = link
    }

    func respondFromNotification(
        userInfo: [AnyHashable: Any],
        action: NotificationInboxAction,
        comment: String,
        requestIdentifier: String? = nil
    ) async {
        guard let target = NotificationResponseTarget(userInfo: userInfo) else {
            lastError = "通知の回答対象を読めなかった"
            return
        }

        do {
            let email = await SupabaseService.shared.currentUserEmail()
            let result = try await SupabaseService.shared.submitNotificationResponse(
                target: target,
                action: action,
                comment: comment,
                email: email
            )
            lastResponseMessage = result.message
            if let requestIdentifier {
                UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [requestIdentifier])
                UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [requestIdentifier])
            }
        } catch {
            lastError = "通知回答に失敗: \(error.localizedDescription)"
        }
    }

    // MARK: - L2 Notifications (Phase 4 全 4 L2)

    @discardableResult
    func pollL2Notifications() async throws -> Int {
        do {
            let rows: [L2Notification] = try await client
                .from("l2_notifications")
                .select()
                .eq("attention_state", value: "approved")
                .eq("requires_masa_decision", value: true)
                .is("notified_at", value: nil)
                .order("created_at", ascending: false)
                .limit(50)
                .execute()
                .value

            for row in rows {
                await showL2LocalNotification(row)
                try? await markL2Notified(notificationId: row.notificationId)
            }
            return rows.count
        } catch {
            lastError = "l2_notifications fetch failed: \(error.localizedDescription)"
            throw error
        }
    }

    private func showL2LocalNotification(_ n: L2Notification) async {
        let content = UNMutableNotificationContent()
        content.title = n.title // 上流側で絵文字付与済 (👤/🗂️/⚖️/📈)
        content.body = (n.summary ?? "").isEmpty ? "saved=\(n.savedCount) / total=\(n.totalCount)" : (n.summary ?? "")
        content.sound = n.importance >= 3 ? .defaultCritical : .default
        content.threadIdentifier = "l2-\(n.l2Kind)"
        content.categoryIdentifier = "AMD_L2_NOTIFICATION"
        content.userInfo = [
            "kind": "l2",
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

    private func markL2Notified(notificationId: UUID) async throws {
        let iso = ISO8601DateFormatter().string(from: Date())
        try await client
            .from("l2_notifications")
            .update(["notified_at": iso])
            .eq("notification_id", value: notificationId.uuidString)
            .execute()
    }

    // MARK: - Meeting Notifications (6 MTGサマリ Phase 3)

    @discardableResult
    func pollMeetingNotifications() async throws -> Int {
        do {
            let rows: [MeetingNotification] = try await client
                .from("meeting_notifications")
                .select()
                .is("notified_at", value: nil)
                .order("created_at", ascending: false)
                .limit(50)
                .execute()
                .value

            for row in rows {
                await showMeetingLocalNotification(row)
                try? await markMeetingNotified(meetingId: row.meetingId)
            }
            return rows.count
        } catch {
            lastError = "meeting_notifications fetch failed: \(error.localizedDescription)"
            throw error
        }
    }

    private func showMeetingLocalNotification(_ n: MeetingNotification) async {
        let content = UNMutableNotificationContent()
        content.title = "📋 議事録: \(n.title)"
        content.body = n.summaryShort.isEmpty ? "[\(n.sourceKinds)]" : n.summaryShort
        content.sound = .default
        content.threadIdentifier = "meeting"
        content.categoryIdentifier = "AMD_MEETING_NOTIFICATION"
        content.userInfo = [
            "kind": "meeting",
            "meetingId": n.meetingId,
            "projectId": n.projectId
        ]
        let req = UNNotificationRequest(
            identifier: "meeting-\(n.meetingId)",
            content: content,
            trigger: nil
        )
        try? await UNUserNotificationCenter.current().add(req)
    }

    private func markMeetingNotified(meetingId: String) async throws {
        let iso = ISO8601DateFormatter().string(from: Date())
        try await client
            .from("meeting_notifications")
            .update(["notified_at": iso])
            .eq("meeting_id", value: meetingId)
            .execute()
    }

    // MARK: - Connector Auth Notifications (app_notifications)

    @discardableResult
    func pollConnectorAuthNotifications() async throws -> Int {
        do {
            let rows: [AppConnectorAuthNotification] = try await client
                .from("app_notifications")
                .select("id,kind,title,body,link,meta,native_notified_at,read_at,dismissed_at,created_at,updated_at")
                .eq("kind", value: "connector_auth")
                .is("native_notified_at", value: nil)
                .is("read_at", value: nil)
                .is("dismissed_at", value: nil)
                .order("updated_at", ascending: false)
                .limit(20)
                .execute()
                .value

            let actionableRows = rows.filter { $0.reauthURL != nil }
            for row in actionableRows {
                await showConnectorAuthLocalNotification(row)
                try? await markConnectorAuthNativeNotified(id: row.id)
            }
            return actionableRows.count
        } catch {
            lastError = "connector_auth fetch failed: \(error.localizedDescription)"
            throw error
        }
    }

    private func showConnectorAuthLocalNotification(_ n: AppConnectorAuthNotification) async {
        let content = UNMutableNotificationContent()
        content.title = n.title
        content.body = (n.body ?? "").isEmpty
            ? "\(n.connector) / \(n.reason)。タップして再認証を開く。"
            : (n.body ?? "")
        content.sound = .default
        content.threadIdentifier = "connector-auth"
        content.categoryIdentifier = "AMD_CONNECTOR_AUTH_NOTIFICATION"
        content.userInfo = [
            "kind": "connector_auth",
            "notificationId": n.id,
            "connector": n.connector,
            "reason": n.reason,
            "reauthUrl": n.reauthURL ?? "",
        ]
        let req = UNNotificationRequest(
            identifier: "connector-auth-\(n.id)",
            content: content,
            trigger: nil
        )
        try? await UNUserNotificationCenter.current().add(req)
    }

    private func markConnectorAuthNativeNotified(id: String) async throws {
        let iso = ISO8601DateFormatter().string(from: Date())
        try await client
            .from("app_notifications")
            .update(["native_notified_at": iso])
            .eq("id", value: id)
            .execute()
    }

    private func markConnectorAuthRead(id: String) async throws {
        let iso = ISO8601DateFormatter().string(from: Date())
        try await client
            .from("app_notifications")
            .update(["read_at": iso, "updated_at": iso])
            .eq("id", value: id)
            .execute()
    }

    private func openConnectorAuthReauth(userInfo: [AnyHashable: Any]) {
        let notificationId = userInfo["notificationId"] as? String
        if let notificationId {
            Task { try? await markConnectorAuthRead(id: notificationId) }
        }
        guard let rawURL = userInfo["reauthUrl"] as? String,
              let url = URL(string: rawURL) else {
            lastError = "再認証リンクを開けなかった"
            return
        }
        UIApplication.shared.open(url) { success in
            if !success {
                Task { @MainActor in
                    self.lastError = "再認証リンクを開けなかった"
                }
            }
        }
    }
}
