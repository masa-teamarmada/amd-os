import SwiftUI
import UniformTypeIdentifiers
import Foundation
import AppKit
import CoreGraphics
import PDFKit

private struct AMDOSPermissionDeniedView: View {
    let message: String
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 8) {
                Label("権限が必要", systemImage: "lock.fill").font(.headline).foregroundStyle(AMDOSDesign.warning)
                Text(message).font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
        }
    }
}

private struct AMDOSParityL2Notification: Decodable, Identifiable, Sendable {
    let id: String
    let kind: String
    let targetID: String
    let scopeKey: String
    let title: String
    let summary: String?
    let importance: Int?
    let savedCount: Int?
    let totalCount: Int?
    let metadata: AMDOSParityJSON?
    let notifiedAt: String?
    let createdAt: String?
    let readAt: String?
    enum CodingKeys: String, CodingKey { case id = "notification_id", kind = "l2_kind", targetID = "target_id", scopeKey = "scope_key", title, summary, importance, savedCount = "saved_count", totalCount = "total_count", metadata = "metadata_json", notifiedAt = "notified_at", createdAt = "created_at", readAt = "read_at" }
}

private struct AMDOSParityMeetingNotification: Codable, Identifiable, Sendable {
    let id: String
    let projectID: String
    let title: String
    let sourceKinds: String
    let summary: String
    let notifiedAt: String?
    let createdAt: String?
    let readAt: String?
    enum CodingKeys: String, CodingKey { case id = "meeting_id", projectID = "project_id", title, sourceKinds = "source_kinds", summary = "summary_short", notifiedAt = "notified_at", createdAt = "created_at", readAt = "read_at" }
}

private struct AMDOSParityAppNotification: Decodable, Identifiable, Sendable {
    let id: String
    let kind: String
    let title: String
    let body: String?
    let link: String?
    let meta: AMDOSParityJSON?
    let source: String
    let readAt: String?
    let dismissedAt: String?
    let createdAt: String
    let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id, kind, title, body, link, meta, source, readAt = "read_at", dismissedAt = "dismissed_at", createdAt = "created_at", updatedAt = "updated_at" }
}

private struct AMDOSParityNotificationProject: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    enum CodingKeys: String, CodingKey { case id = "project_id", name = "project_name" }
}

private struct AMDOSParityNotificationFeedbackRow: Codable, Identifiable, Sendable {
    let id: String
    let l2Kind: String
    let targetID: String
    let scopeKey: String
    let notificationID: String?
    let meetingID: String?
    let feedbackText: String?
    let status: String?
    let createdBy: String?
    let createdAt: String?
    let appliedCount: Int?
    let lastAppliedAt: String?

    enum CodingKeys: String, CodingKey {
        case id = "feedback_id", l2Kind = "l2_kind", targetID = "target_id", scopeKey = "scope_key", notificationID = "notification_id", meetingID = "meeting_id", feedbackText = "feedback_text", status, createdBy = "created_by", createdAt = "created_at", appliedCount = "applied_count", lastAppliedAt = "last_applied_at"
    }
}

private struct AMDOSParityNotificationFeedback: Encodable, Sendable {
    let l2Kind: String
    let targetID: String
    let scopeKey: String
    let feedbackText: String
    let action: String
    let notificationID: String?
    let meetingID: String?
    enum CodingKeys: String, CodingKey { case l2Kind = "l2_kind", targetID = "target_id", scopeKey = "scope_key", feedbackText = "feedback_text", action, notificationID = "notification_id", meetingID = "meeting_id" }
}

private struct AMDOSParityActionItem: Codable, Identifiable, Sendable {
    let id: String
    let projectID: String?
    let scope: String?
    let category: String?
    let title: String
    let summary: String?
    let dueAt: String?
    let status: String
    let priority: String?
    let actionURL: String?
    let daysLeft: Int?
    enum CodingKeys: String, CodingKey { case id = "action_id", projectID = "project_id", scope, category, title, summary, dueAt = "due_at", status, priority, actionURL = "action_url", daysLeft }
}

private struct AMDOSParityActionItemsEnvelope: Codable, Sendable { let ok: Bool?; let items: [AMDOSParityActionItem]?; let error: String? }
private struct AMDOSParityActionItemPatch: Encodable, Sendable { let actionID: String; let status: String; enum CodingKeys: String, CodingKey { case actionID = "action_id", status } }

private struct AMDOSParityNotificationDetailRow: Identifiable, Sendable {
    let id: String
    let heading: String
    let body: String
    let sub: String?
}

private struct AMDOSParityNotificationDetail: Sendable {
    let loading: Bool
    let rows: [AMDOSParityNotificationDetailRow]
    let error: String?
}

private enum AMDOSParityReviewItem: Sendable {
    case l2(AMDOSParityL2Notification)
    case meeting(AMDOSParityMeetingNotification)

    var key: String { switch self { case .l2(let row): return "l2-\(row.id)"; case .meeting(let row): return "meeting-\(row.id)" } }
}

private struct AMDOSParityReadPatch: Encodable, Sendable {
    let readAt: String?
    enum CodingKeys: String, CodingKey { case readAt = "read_at" }
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        if let readAt { try container.encode(readAt, forKey: .readAt) }
        else { try container.encodeNil(forKey: .readAt) }
    }
}

private struct AMDOSParityAppNotificationPatch: Encodable, Sendable {
    let readAt: String?
    let dismissedAt: String?
    let updatedAt: String
    let includesRead: Bool
    let includesDismissed: Bool
    enum CodingKeys: String, CodingKey { case readAt = "read_at", dismissedAt = "dismissed_at", updatedAt = "updated_at" }
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(updatedAt, forKey: .updatedAt)
        if includesRead { if let readAt { try container.encode(readAt, forKey: .readAt) } else { try container.encodeNil(forKey: .readAt) } }
        if includesDismissed { if let dismissedAt { try container.encode(dismissedAt, forKey: .dismissedAt) } else { try container.encodeNil(forKey: .dismissedAt) } }
    }
}

@MainActor
private final class AMDOSNotificationsParityStore: ObservableObject {
    @Published var l2: [AMDOSParityL2Notification] = []
    @Published var meetings: [AMDOSParityMeetingNotification] = []
    @Published var app: [AMDOSParityAppNotification] = []
    @Published var projects: [AMDOSParityNotificationProject] = []
    @Published var feedbacks: [AMDOSParityNotificationFeedbackRow] = []
    @Published var actionItems: [AMDOSParityActionItem] = []
    @Published var details: [String: AMDOSParityNotificationDetail] = [:]
    @Published var submitting = Set<String>()
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?

    func load(focusNotificationID: String? = nil, focusMeetingID: String? = nil) async {
        state = .loading; message = nil
        do {
            async let l2Rows = AMDOSRESTClient.shared.fetchTable(AMDOSParityL2Notification.self, table: "l2_notifications", select: "*", order: "created_at.desc", limit: 100)
            async let meetingRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityMeetingNotification.self, table: "meeting_notifications", select: "*", order: "created_at.desc", limit: 100)
            async let appRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityAppNotification.self, table: "app_notifications", select: "id,kind,title,body,link,meta,source,read_at,dismissed_at,created_at,updated_at", filters: ["dismissed_at": "is.null"], order: "created_at.desc", limit: 200)
            async let projectRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityNotificationProject.self, table: "projects", select: "project_id,project_name", order: "project_name", limit: 500)
            async let feedbackRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityNotificationFeedbackRow.self, table: "l2_feedbacks", select: "feedback_id,l2_kind,target_id,scope_key,notification_id,meeting_id,feedback_text,status,created_by,created_at,applied_count,last_applied_at", order: "created_at.desc", limit: 200)
            var loadedL2 = try await l2Rows
            var loadedMeetings = try await meetingRows
            if let focusNotificationID = focusNotificationID?.trimmedNonEmpty, !loadedL2.contains(where: { $0.id == focusNotificationID }) {
                loadedL2 = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityL2Notification.self, table: "l2_notifications", select: "*", filters: ["notification_id": "eq.\(focusNotificationID)"], limit: 1) + loadedL2
            }
            if let focusMeetingID = focusMeetingID?.trimmedNonEmpty, !loadedMeetings.contains(where: { $0.id == focusMeetingID }) {
                loadedMeetings = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityMeetingNotification.self, table: "meeting_notifications", select: "*", filters: ["meeting_id": "eq.\(focusMeetingID)"], limit: 1) + loadedMeetings
            }
            l2 = loadedL2; meetings = loadedMeetings; app = try await appRows; projects = try await projectRows; feedbacks = try await feedbackRows
            do {
                let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSParityActionItemsEnvelope.self, path: "/api/action-items")
                actionItems = response.items ?? []
            } catch {
                // PWAも 401/403 なら要対応パネル自体を隠す。通知本文の読み込みは継続する。
                actionItems = []
            }
            state = l2.isEmpty && meetings.isEmpty && app.isEmpty && feedbacks.isEmpty ? .empty : .loaded
        } catch { message = error.localizedDescription; state = .failed(message ?? "通知を取得できなかった") }
    }

    func markL2Read(_ id: String, read: Bool, reload: Bool = true) async { await patchRead(table: "l2_notifications", key: "notification_id", id: id, read: read, reload: reload) }
    func markMeetingRead(_ id: String, read: Bool, reload: Bool = true) async { await patchRead(table: "meeting_notifications", key: "meeting_id", id: id, read: read, reload: reload) }

    func markAppRead(_ id: String) async {
        do {
            let now = ISO8601DateFormatter().string(from: .now)
            _ = try await AMDOSRESTClient.shared.patchTable(table: "app_notifications", filters: ["id": "eq.\(id)"], body: AMDOSParityAppNotificationPatch(readAt: now, dismissedAt: nil, updatedAt: now, includesRead: true, includesDismissed: false))
            await load()
        } catch { message = error.localizedDescription }
    }

    func dismissApp(_ id: String) async {
        do {
            let now = ISO8601DateFormatter().string(from: .now)
            _ = try await AMDOSRESTClient.shared.patchTable(table: "app_notifications", filters: ["id": "eq.\(id)"], body: AMDOSParityAppNotificationPatch(readAt: nil, dismissedAt: now, updatedAt: now, includesRead: false, includesDismissed: true))
            await load()
        } catch { message = error.localizedDescription }
    }

    func markAllAppRead() async {
        do {
            let now = ISO8601DateFormatter().string(from: .now)
            _ = try await AMDOSRESTClient.shared.patchTable(table: "app_notifications", filters: ["read_at": "is.null", "dismissed_at": "is.null"], body: AMDOSParityAppNotificationPatch(readAt: now, dismissedAt: nil, updatedAt: now, includesRead: true, includesDismissed: false))
            await load()
        } catch { message = error.localizedDescription }
    }

    func markActionResponded(_ item: AMDOSParityActionItem) async {
        guard let index = actionItems.firstIndex(where: { $0.id == item.id }) else { return }
        actionItems.remove(at: index)
        do {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/action-items", method: "PATCH", body: AMDOSParityActionItemPatch(actionID: item.id, status: "responded"))
            let response = try JSONDecoder().decode(AMDOSParityActionItemsEnvelope.self, from: data)
            guard response.ok != false else { throw AMDOSNetworkError.http(response.error ?? "要対応を更新できなかった") }
        } catch {
            actionItems.insert(item, at: min(index, actionItems.count))
            message = error.localizedDescription
        }
    }

    func feedback(_ item: AMDOSParityL2Notification, action: String, text: String) async {
        let key = "l2-\(item.id)"
        guard action != "comment" || text.trimmedNonEmpty != nil else { return }
        submitting.insert(key)
        defer { submitting.remove(key) }
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/notifications/feedback", body: AMDOSParityNotificationFeedback(l2Kind: item.kind, targetID: item.targetID, scopeKey: item.scopeKey, feedbackText: text.trimmingCharacters(in: .whitespacesAndNewlines), action: action, notificationID: item.id, meetingID: nil))
            await markL2Read(item.id, read: true, reload: false)
            await load()
        } catch { message = error.localizedDescription }
    }

    func feedback(_ item: AMDOSParityMeetingNotification, action: String, text: String) async {
        let key = "meeting-\(item.id)"
        guard action != "comment" || text.trimmedNonEmpty != nil else { return }
        submitting.insert(key)
        defer { submitting.remove(key) }
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/notifications/feedback", body: AMDOSParityNotificationFeedback(l2Kind: "meeting_summary", targetID: item.projectID, scopeKey: item.id, feedbackText: text.trimmingCharacters(in: .whitespacesAndNewlines), action: action, notificationID: nil, meetingID: item.id))
            await markMeetingRead(item.id, read: true, reload: false)
            await load()
        } catch { message = error.localizedDescription }
    }

    func loadDetails(_ item: AMDOSParityReviewItem) async {
        let key = item.key
        guard details[key] == nil else { return }
        details[key] = AMDOSParityNotificationDetail(loading: true, rows: [], error: nil)
        do {
            let rows: [AMDOSParityNotificationDetailRow]
            switch item {
            case .meeting(let row):
                rows = try await detailRows(table: "project_meeting_summaries", select: "meeting_date,title,summary_short,decided,progress,next_actions,risks,source_kinds", filters: ["meeting_id": "eq.\(row.id)"], order: nil, limit: 1, fallbackTitle: "会議要約")
            case .l2(let row):
                rows = try await l2DetailRows(row)
            }
            details[key] = AMDOSParityNotificationDetail(loading: false, rows: rows, error: nil)
        } catch {
            details[key] = AMDOSParityNotificationDetail(loading: false, rows: [], error: error.localizedDescription)
        }
    }

    private func patchRead(table: String, key: String, id: String, read: Bool, reload: Bool) async {
        do {
            _ = try await AMDOSRESTClient.shared.patchTable(table: table, filters: [key: "eq.\(id)"], body: AMDOSParityReadPatch(readAt: read ? ISO8601DateFormatter().string(from: .now) : nil))
            if reload { await load() }
        } catch { message = error.localizedDescription }
    }

    private func l2DetailRows(_ row: AMDOSParityL2Notification) async throws -> [AMDOSParityNotificationDetailRow] {
        let ym = String(row.scopeKey.prefix(6))
        let hasYM = ym.range(of: "^[0-9]{6}$", options: .regularExpression) != nil
        switch row.kind {
        case "member_knowledge":
            return try await detailRows(table: "member_knowledge", select: "category,summary,updated_at", filters: ["code_name": "eq.\(row.targetID)"], order: "updated_at.desc", limit: 50, fallbackTitle: "メンバー知識")
        case "project_knowledge":
            return try await detailRows(table: "project_knowledge", select: "category,entity_name,fact_text,confidence,updated_at,source", filters: ["project_id": "eq.\(row.targetID)", "source": "eq.l2_hourly_extract"], order: "updated_at.desc", limit: 50, fallbackTitle: "PJ知識")
        case "protocols":
            // PWA と同じく、通知の対象月と、scope に含まれていれば protocol_id まで絞る。
            // project_id だけで最新事例を出すと、別月・別プロトコルを確認してしまうため。
            let scope = protocolNotificationScope(row.scopeKey)
            let examples = try await AMDOSRESTClient.shared.fetchTable(
                AMDOSParityJSON.self,
                table: "protocol_examples",
                select: "protocol_id,occurred_on,summary,branch_point,criteria,action_taken,result",
                filters: ["project_id": "eq.\(row.targetID)"],
                order: "occurred_on.desc",
                limit: 50
            ).filter { example in
                let occurredOn = jsonText(example, "occurred_on")
                let sameMonth = scope.ym.isEmpty || occurredOn.hasPrefix("\(scope.ym.prefix(4))-\(scope.ym.suffix(2))")
                let sameProtocol = scope.protocolID == nil || jsonText(example, "protocol_id") == scope.protocolID
                return sameMonth && sameProtocol
            }
            let protocolIDs = Array(Set(examples.map { jsonText($0, "protocol_id") }.filter { !$0.isEmpty }))
            guard !protocolIDs.isEmpty else { return notificationFallbackRows(row) }
            let protocols = try await AMDOSRESTClient.shared.fetchTable(
                AMDOSParityJSON.self,
                table: "protocols",
                select: "protocol_id,title,content,status,importance,tags,updated_at",
                filters: ["protocol_id": "in.(\(protocolIDs.joined(separator: ",")))"],
                order: "updated_at.desc"
            )
            let examplesByProtocol = Dictionary(grouping: examples, by: { jsonText($0, "protocol_id") })
            return protocols.map { protocolRow in
                let id = jsonText(protocolRow, "protocol_id")
                let related = (examplesByProtocol[id] ?? []).map { example in
                    let parts = [
                        "・[\(jsonText(example, "occurred_on", fallback: "—"))] \(jsonText(example, "summary"))",
                        detailLine("分岐点", jsonText(example, "branch_point")),
                        detailLine("判断材料", jsonText(example, "criteria")),
                        detailLine("アクション", jsonText(example, "action_taken")),
                        detailLine("結果", jsonText(example, "result"))
                    ].compactMap { $0 }.joined(separator: "\n")
                    return parts
                }.joined(separator: "\n\n")
                let importance = max(1, min(3, Int(jsonNumber(protocolRow, "importance") ?? 1)))
                return AMDOSParityNotificationDetailRow(
                    id: "protocol-\(id)",
                    heading: "\(String(repeating: "⭐", count: importance)) \(jsonText(protocolRow, "title")) [\(jsonText(protocolRow, "status"))]",
                    body: [jsonText(protocolRow, "content"), related.isEmpty ? nil : "📂 関連事例:\n\(related)"].compactMap { $0 }.joined(separator: "\n\n"),
                    sub: jsonText(protocolRow, "tags").trimmedNonEmpty.map { "tags: \($0)" }
                )
            }
        case "founding_members":
            return try await detailRows(table: "project_founding_members", select: "person_name,affiliation,role,role_label_jp,category,responsibility,contribution,notes,status,first_observed_at,last_observed_at,updated_at", filters: ["project_id": "eq.\(row.targetID)", "updated_at": "gte.\(row.scopeKey)"], order: "updated_at.desc", limit: 50, fallbackTitle: "創業メンバー")
        case "ms_progress":
            // 通常の月次進捗と、automationが作る修正案を同じ通知で確認する。
            // revisions だけではPWAにある通常進捗が落ちる。
            async let progressRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityJSON.self,
                table: "milestone_monthly_progress",
                select: "milestone_key,progress_pct,consumed_pt,source,note",
                filters: ["ym": "eq.\(row.scopeKey)"]
            )
            async let revisionRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityJSON.self,
                table: "ms_progress_revisions",
                select: "milestone_id,current_pct,current_note,revised_pct,revised_note,status,created_at",
                filters: ["project_id": "eq.\(row.targetID)", "ym": "eq.\(row.scopeKey)"],
                order: "created_at.desc"
            )
            let progressRows = try await progressRequest
            let revisionRows = try await revisionRequest
            let milestoneIDs = Array(Set((progressRows.map { jsonText($0, "milestone_key") } + revisionRows.map { jsonText($0, "milestone_id") }).filter { !$0.isEmpty }))
            guard !milestoneIDs.isEmpty else { return notificationFallbackRows(row) }
            async let milestoneRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityJSON.self,
                table: "value_milestones",
                select: "milestone_id,title,points,plan_cycle_id",
                filters: ["milestone_id": "in.(\(milestoneIDs.joined(separator: ",")))"]
            )
            async let cycleRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityJSON.self,
                table: "value_plan_cycles",
                select: "plan_cycle_id,project_id",
                filters: ["project_id": "eq.\(row.targetID)"]
            )
            let validCycleIDs = Set((try await cycleRequest).map { jsonText($0, "plan_cycle_id") })
            let milestones = try await milestoneRequest
            var milestoneMap: [String: (title: String, points: Double)] = [:]
            for milestone in milestones where validCycleIDs.contains(jsonText(milestone, "plan_cycle_id")) {
                milestoneMap[jsonText(milestone, "milestone_id")] = (title: jsonText(milestone, "title"), points: jsonNumber(milestone, "points") ?? 0)
            }
            let revisions = revisionRows.compactMap { revision -> AMDOSParityNotificationDetailRow? in
                let id = jsonText(revision, "milestone_id")
                guard let milestone = milestoneMap[id] else { return nil }
                let status = ["pending": "確認待ち", "confirmed": "確定済", "discarded": "破棄"][jsonText(revision, "status")] ?? jsonText(revision, "status")
                return AMDOSParityNotificationDetailRow(
                    id: "ms-revision-\(row.id)-\(id)-\(jsonText(revision, "created_at"))",
                    heading: "修正案: \(milestone.title) (\(Int(milestone.points))pt)",
                    body: "現在 \(jsonText(revision, "current_pct", fallback: "?"))% → 提案 \(jsonText(revision, "revised_pct", fallback: "?"))% [\(status)]\n\(jsonText(revision, "revised_note"))",
                    sub: jsonText(revision, "current_note").trimmedNonEmpty.map { "現在メモ: \($0)" }
                )
            }
            let progress = progressRows.compactMap { progress -> AMDOSParityNotificationDetailRow? in
                let id = jsonText(progress, "milestone_key")
                guard let milestone = milestoneMap[id] else { return nil }
                return AMDOSParityNotificationDetailRow(
                    id: "ms-progress-\(row.id)-\(id)",
                    heading: "\(milestone.title) (\(Int(milestone.points))pt)",
                    body: "進捗 \(jsonText(progress, "progress_pct", fallback: "?"))% (consumed \(jsonText(progress, "consumed_pt", fallback: "?"))pt) [source=\(jsonText(progress, "source"))]",
                    sub: jsonText(progress, "note").trimmedNonEmpty.map { "📝 \($0)" }
                )
            }
            return (revisions + progress).isEmpty ? notificationFallbackRows(row) : revisions + progress
        case "raw_data_gap":
            // PWA は通知に固定された evidence_refs を最優先する。そこを捨てて
            // source_cache の新しい行を並べると、別の未取り込み候補を判断してしまう。
            if let refs = row.metadata?.value(for: "evidence_refs")?.array, !refs.isEmpty {
                return refs.enumerated().map { index, ref in
                    let source = jsonText(ref, "source", fallback: "source").uppercased()
                    let title = jsonText(ref, "title", "url", "id", "item_id", fallback: "(no title)")
                    let body = jsonText(ref, "snippet", "summary", fallback: "(snippetなし)")
                    let sub = [jsonText(ref, "date", "item_date"), jsonText(ref, "url", "source_url").trimmedNonEmpty.map { "url=\($0)" }, jsonText(ref, "id", "item_id").trimmedNonEmpty.map { "id=\($0)" }].compactMap { $0 }.joined(separator: " · ").trimmedNonEmpty
                    return AMDOSParityNotificationDetailRow(id: "raw-evidence-\(row.id)-\(index)", heading: "\(source): \(title)", body: body, sub: sub)
                }
            }
            var filters = ["project_id": "eq.\(row.targetID)"]
            if hasYM { filters["ym"] = "eq.\(ym)" }
            return try await detailRows(table: "source_cache", select: "source,item_id,title,item_date,content_text,metadata_json,collected_at", filters: filters, order: "item_date.desc", limit: 20, fallbackTitle: "未取り込み根拠")
        case "project_registry_diff":
            var filters = ["project_id": "eq.\(row.targetID)"]
            filters["ym"] = row.scopeKey == "global" ? "is.null" : "eq.\(row.scopeKey)"
            return try await detailRows(table: "project_registry_diffs", select: "diff_kind,target_table,target_key,current_snapshot_json,proposed_patch_json,evidence_refs_json,confidence,status,review_comment,created_at,applied_at", filters: filters, order: "created_at.desc", limit: 50, fallbackTitle: "PJ台帳差分")
        case "xrl_evidence":
            var filters = ["project_id": "eq.\(row.targetID)"]
            if let axis = row.metadata?.value(for: "axis")?.string?.trimmedNonEmpty { filters["axis"] = "eq.\(axis.lowercased())" }
            if let evidenceKind = row.metadata?.value(for: "evidence_kind")?.string?.trimmedNonEmpty { filters["evidence_kind"] = "eq.\(evidenceKind)" }
            if row.scopeKey == "global" { filters["ym"] = "is.null" } else if hasYM { filters["ym"] = "eq.\(ym)" }
            let found = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityJSON.self, table: "project_xrl_evidence", select: "axis,evidence_kind,summary,structured_value_json,source_refs_json,source_hash,confidence,status,created_at,confirmed_at", filters: filters, order: "created_at.desc", limit: 50)
            let metadataHash = row.metadata?.value(for: "evidence_source_hash")?.string?.trimmedNonEmpty
            let narrowed = metadataHash.map { hash in found.filter { xrlRow($0, matchesHash: hash) } } ?? found
            let selected = narrowed.isEmpty ? found : narrowed
            guard !selected.isEmpty else { return notificationFallbackRows(row) }
            return selected.enumerated().map { index, evidence in
                AMDOSParityNotificationDetailRow(
                    id: "xrl-\(row.id)-\(index)",
                    heading: "\(jsonText(evidence, "axis").uppercased()) / \(jsonText(evidence, "evidence_kind")) [\(jsonText(evidence, "status"))]",
                    body: [jsonText(evidence, "summary"), jsonText(evidence, "structured_value_json").trimmedNonEmpty.map { "構造化値: \($0)" }, evidenceRefText(evidence.value(for: "source_refs_json"))].compactMap { $0 }.joined(separator: "\n"),
                    sub: [jsonNumber(evidence, "confidence").map { String(format: "confidence=%.2f", $0) }, jsonText(evidence, "confirmed_at").trimmedNonEmpty.map { "confirmed=\($0)" }].compactMap { $0 }.joined(separator: " · ").trimmedNonEmpty
                )
            }
        case "project_strategy_signal":
            var filters = ["project_id": "eq.\(row.targetID)"]
            if let signalType = row.metadata?.value(for: "signal_type")?.string?.trimmedNonEmpty { filters["signal_type"] = "eq.\(signalType)" }
            if row.scopeKey == "global" { filters["ym"] = "is.null" } else if hasYM { filters["ym"] = "eq.\(ym)" }
            let found = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityJSON.self, table: "project_strategy_signals", select: "signal_type,title,summary,impact_level,decision_state,status,source_refs_json,source_hash,confidence,signal_date,confirmed_at", filters: filters, order: "created_at.desc", limit: 50)
            let metadataHash = row.metadata?.value(for: "signal_source_hash")?.string?.trimmedNonEmpty
            let narrowed = metadataHash.map { hash in found.filter { strategySignalRow($0, matchesHash: hash) } } ?? found
            let selected = narrowed.isEmpty ? found : narrowed
            guard !selected.isEmpty else { return notificationFallbackRows(row) }
            return selected.enumerated().map { index, signal in
                AMDOSParityNotificationDetailRow(
                    id: "strategy-\(row.id)-\(index)",
                    heading: "\(jsonText(signal, "signal_type")) / \(jsonText(signal, "impact_level")) [\(jsonText(signal, "status"))]",
                    body: ["\(jsonText(signal, "title"))\n\(jsonText(signal, "summary"))", evidenceRefText(signal.value(for: "source_refs_json"))].compactMap { $0 }.joined(separator: "\n"),
                    sub: [jsonText(signal, "signal_date").trimmedNonEmpty.map { "date=\($0)" }, jsonText(signal, "decision_state").trimmedNonEmpty.map { "state=\($0)" }, jsonNumber(signal, "confidence").map { String(format: "confidence=%.2f", $0) }, jsonText(signal, "confirmed_at").trimmedNonEmpty.map { "confirmed=\($0)" }].compactMap { $0 }.joined(separator: " · ").trimmedNonEmpty
                )
            }
        case "textbook_insight":
            var filters = ["target_id": "eq.\(row.targetID)"]
            if let candidateID = row.metadata?.value(for: "candidate_id")?.string?.trimmedNonEmpty { filters["candidate_id"] = "eq.\(candidateID)" }
            else if let sourceHash = row.metadata?.value(for: "candidate_source_hash")?.string?.trimmedNonEmpty { filters["source_hash"] = "eq.\(sourceHash)" }
            else { filters["scope_key"] = "eq.\(row.scopeKey)" }
            return try await detailRows(table: "textbook_insight_candidates", select: "candidate_id,title,topic,proposed_section,target_bzm_slug,insight_type,priority,body_md,evidence_refs,source_tables,source_hash,status,reviewed_at,applied_at,applied_file,metadata_json,confidentiality,bzm_review_required,bzm_review_status,theory_change_scope", filters: filters, order: "created_at.desc", limit: 20, fallbackTitle: "BZM追記候補")
        case "news_mention":
            var filters = ["project_id": "eq.\(row.targetID)"]
            if let sourceURL = row.metadata?.value(for: "source_url")?.string?.trimmedNonEmpty { filters["source_url"] = "eq.\(sourceURL)" }
            else if let occurredOn = row.metadata?.value(for: "occurred_on")?.string?.trimmedNonEmpty { filters["occurred_on"] = "eq.\(occurredOn)" }
            else { filters["title"] = "ilike.%\(stripNotificationPrefix(row.title))%" }
            return try await detailRows(table: "project_media_mentions", select: "occurred_on,title,media_name,kind,source_url,summary,ingested_by,verified,dismissed,created_at", filters: filters, order: "created_at.desc", limit: 10, fallbackTitle: "メディア言及")
        case "coverage_gap":
            let gaps = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityJSON.self, table: "l2_coverage_gaps", select: "gap_id,source,source_ref,title,summary,salience_score,proposed_target_l2,gap_class,due_at,scope,review_status,evidence_refs_json,detected_at", filters: ["gap_id": "eq.\(row.scopeKey)"], order: nil, limit: 1)
            guard let gap = gaps.first else { return coverageGapUnavailableRows(row) }
            let summary = jsonText(gap, "summary", fallback: row.summary ?? "")
            let memo = coverageGapCopyMemo(summary: summary, evidence: gap.value(for: "evidence_refs_json"), title: jsonText(gap, "title", fallback: row.title))
            return [AMDOSParityNotificationDetailRow(
                id: "coverage-\(row.id)",
                heading: "重要メモにコピーされる内容",
                body: [
                    "コピーされる文章:\n\(memo)",
                    "判断の目安:\n\(coverageGapDecisionGuide(copyMemo: memo, summary: summary))",
                    "コピーしても起きないこと:\n\(coverageGapCopyNonConsequence(jsonText(gap, "proposed_target_l2")))"
                ].joined(separator: "\n\n"),
                sub: ["上の文章を重要メモに残すかだけ判断", jsonText(gap, "due_at").trimmedNonEmpty.map { "期限: \($0)" }, jsonText(gap, "detected_at").trimmedNonEmpty.map { "確認日: \($0)" }].compactMap { $0 }.joined(separator: " · ")
            )]
        case "guardrail_match":
            return try await detailRows(table: "guardrail_matches", select: "match_id,card_id,target_type,target_id,target_title,target_date,matched_tags,project_tags,action_tags,match_score,severity,status,due_at,evidence_refs_json,detected_at", filters: ["match_id": "eq.\(row.scopeKey)"], order: nil, limit: 1, fallbackTitle: "ガードレール照合")
        default:
            return [AMDOSParityNotificationDetailRow(id: "fallback-\(row.id)", heading: "通知本文", body: [row.summary ?? "(summaryなし)", row.metadata?.compactText ?? ""].filter { !$0.isEmpty }.joined(separator: "\n\n"), sub: "\(row.kind) · \(row.scopeKey)")]
        }
    }

    private func detailRows(table: String, select: String, filters: [String: String], order: String?, limit: Int?, fallbackTitle: String) async throws -> [AMDOSParityNotificationDetailRow] {
        let rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityJSON.self, table: table, select: select, filters: filters, order: order, limit: limit)
        if rows.isEmpty { return [AMDOSParityNotificationDetailRow(id: "empty-\(table)-\(UUID().uuidString)", heading: fallbackTitle, body: "対応する正本行は見つからなかったよ。通知本文と確認先を見て判断してね。", sub: nil)] }
        return rows.enumerated().map { index, row in
            AMDOSParityNotificationDetailRow(id: "\(table)-\(index)-\(UUID().uuidString)", heading: fallbackTitle, body: row.compactText, sub: nil)
        }
    }

    private func protocolNotificationScope(_ scopeKey: String) -> (ym: String, protocolID: String?) {
        let pieces = scopeKey.split(separator: ":", maxSplits: 2, omittingEmptySubsequences: false)
        if pieces.count == 3, pieces[1] == "protocol", String(pieces[0]).range(of: "^20[0-9]{4}$", options: .regularExpression) != nil {
            return (String(pieces[0]), String(pieces[2]))
        }
        return (notificationYM(scopeKey), nil)
    }

    private func notificationYM(_ scopeKey: String) -> String {
        if let range = scopeKey.range(of: "20[0-9]{4}", options: .regularExpression) { return String(scopeKey[range]) }
        return String(scopeKey.prefix(6))
    }

    private func jsonText(_ value: AMDOSParityJSON, _ keys: String..., fallback: String = "") -> String {
        let selected = keys.lazy.compactMap { value.object?[$0] }.first
        let text = selected?.compactText.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return text.isEmpty ? fallback : text
    }

    private func jsonNumber(_ value: AMDOSParityJSON, _ keys: String...) -> Double? {
        let selected = keys.lazy.compactMap { value.object?[$0] }.first
        if let number = selected?.number { return number }
        return selected?.string.flatMap(Double.init)
    }

    private func detailLine(_ label: String, _ value: String) -> String? {
        value.trimmedNonEmpty.map { "  \(label): \($0)" }
    }

    private func evidenceRefText(_ raw: AMDOSParityJSON?) -> String? {
        guard let refs = raw?.array else { return nil }
        let text = refs.prefix(3).compactMap { ref -> String? in
            let source = jsonText(ref, "source", "type", fallback: "source")
            let date = jsonText(ref, "date", "item_date")
            let snippet = jsonText(ref, "title", "snippet", "summary")
            return [source, date, snippet].filter { !$0.isEmpty }.joined(separator: " / ").trimmedNonEmpty
        }.joined(separator: "\n")
        return text.trimmedNonEmpty
    }

    private func xrlRow(_ row: AMDOSParityJSON, matchesHash hash: String) -> Bool {
        if jsonText(row, "source_hash") == hash { return true }
        return row.value(for: "source_refs_json")?.array?.contains { ref in
            jsonText(ref, "hash", "source_hash") == hash
        } ?? false
    }

    private func strategySignalRow(_ row: AMDOSParityJSON, matchesHash hash: String) -> Bool {
        if jsonText(row, "source_hash") == hash { return true }
        return row.value(for: "source_refs_json")?.array?.contains { ref in
            jsonText(ref, "hash", "source_hash") == hash
        } ?? false
    }

    private func stripNotificationPrefix(_ title: String) -> String {
        title.replacingOccurrences(of: "^D-[0-9]+\\s*[^:：]*[:：]\\s*", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func coverageGapCopyMemo(summary: String, evidence: AMDOSParityJSON?, title: String) -> String {
        let evidenceObject = evidence?.object ?? [:]
        let candidates = [
            evidenceObject["copy_memo"]?.string,
            evidenceObject["proposed_memo"]?.string,
            summary,
            evidenceObject["raw_signal"]?.string,
            evidenceObject["original_signal"]?.string,
            evidenceObject["summary"]?.string,
            title
        ].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        let raw = candidates.first ?? ""
        if raw.range(of: "VC\\s*3社|VC3社", options: .regularExpression) != nil,
           raw.range(of: "PoC|NEDO", options: .regularExpression) != nil {
            return "PoCやNEDO確認のあとに、VC3社が出資を検討する可能性がある。まだ出資決定ではないので、要確認の投資家関心として重要メモに残す。"
        }
        let sentence = raw.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sentence.isEmpty else { return "会議メモで見つかった経営論点を、正式決定ではなく要確認の重要メモとして別枠で残す。" }
        if sentence.hasSuffix("可能性がある") { return "\(sentence)ため、正式決定ではなく要確認の重要メモとして別枠で残す。" }
        return "\(sentence.trimmingCharacters(in: CharacterSet(charactersIn: "。")))。正式決定ではなく要確認の重要メモとして別枠で残す。"
    }

    private func coverageGapDecisionGuide(copyMemo: String, summary: String) -> String {
        let source = "\(copyMemo)\n\(summary)"
        let labels: [(String, String)] = [
            ("CEO|代表|創業体制|就任|体制", "CEO体制"),
            ("資金調達|投資家|VC|出資|リード投資家", "資金調達・投資家"),
            ("資本政策|持株|株式|新株予約権|SO|cap table", "資本政策"),
            ("契約|合意|MOU|NDA|共同開発", "契約・合意"),
            ("PoC|実証|採択|補助金|NEDO", "PoC・実証")
        ]
        let matched = labels.compactMap { pattern, label in
            source.range(of: pattern, options: .regularExpression) == nil ? nil : label
        }
        if !matched.isEmpty { return "残す寄り。\(matched.prefix(3).joined(separator: " / "))は後から経営判断で確認したくなる論点なので、正式決定ではなく「要確認の重要メモ」として残す価値がある。" }
        return "迷ったらコピーしない寄り。後で経営判断に使う具体的な論点が見えないなら、重要メモへ増やさない。"
    }

    private func coverageGapCopyNonConsequence(_ target: String) -> String {
        switch target.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "project_strategy_signal", "strategy_signal":
            return "元の会議要約は直さない。会社の正式決定、出資合意、着金合意としても扱わない。"
        case "action_item":
            return "元の会議要約は直さない。このボタンだけで担当者つきの要対応リストは作らない。"
        case "registry_diff":
            return "元の会議要約は直さない。このボタンだけでPJ台帳や契約台帳は書き換えない。"
        case "shareholder_meeting":
            return "元の会議要約は直さない。このボタンだけで株主・ガバナンス台帳は書き換えない。"
        default:
            return "元の会議要約は直さない。会社の正式決定としても扱わない。"
        }
    }

    private func notificationFallbackRows(_ row: AMDOSParityL2Notification) -> [AMDOSParityNotificationDetailRow] {
        if row.kind == "coverage_gap" { return coverageGapUnavailableRows(row) }
        let metadataBits = [
            row.metadata?.value(for: "occurred_on")?.string.map { "date=\($0)" },
            row.metadata?.value(for: "media_name")?.string.map { "media=\($0)" },
            row.metadata?.value(for: "source_url")?.string.map { "url=\($0)" }
        ].compactMap { $0 }
        return [AMDOSParityNotificationDetailRow(
            id: "fallback-\(row.id)",
            heading: "\(row.kind) [通知本文]",
            body: [row.summary ?? "(summaryなし)", "この通知種別は、対応する正本行の詳細表示がまだ個別実装されていないか、通知作成後に候補行が移動・統合されている可能性がある。通知本文と確認先を見て判断してね。"].joined(separator: "\n"),
            sub: ([row.scopeKey.isEmpty ? nil : "scope=\(row.scopeKey)"] + metadataBits).compactMap { $0 }.joined(separator: " · ").trimmedNonEmpty
        )]
    }

    private func coverageGapUnavailableRows(_ row: AMDOSParityL2Notification) -> [AMDOSParityNotificationDetailRow] {
        [AMDOSParityNotificationDetailRow(
            id: "coverage-unavailable-\(row.id)",
            heading: "このカードだけではコピー対象を判断できない",
            body: [
                "元の確認候補が見つからないため、会議メモの具体的な内容をこの画面に表示できていない。",
                "今できる判断:\n内容を確認できないなら「コピーしない」。元情報から確認し直したい場合は、コメントに「元情報を再確認」と書いて送る。",
                "重要メモにコピーしてよい条件:\n確認一覧や会議メモで、実際に残したい内容を自分で確認できている場合だけ。"
            ].joined(separator: "\n\n"),
            sub: "候補の具体内容を確認できていない"
        )]
    }
}

struct AMDOSParityNotificationsView: View {
    let initialNotificationID: String?
    let initialMeetingID: String?
    @EnvironmentObject private var auth: AMDOSAuthStore
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    @StateObject private var store = AMDOSNotificationsParityStore()
    @State private var reviewFilter = "open"
    @State private var appFilter = "unread"
    @State private var comments: [String: String] = [:]
    @State private var expanded = Set<String>()
    @State private var confirmAllAppRead = false

    var body: some View {
        AMDOSPageScaffold(eyebrow: "NOTIFICATIONS", title: "通知", subtitle: "PWAのOS通知・要対応・L2抽出・MTGレビューを同じ認可境界で確認する") {
            if !auth.isAdmin { AMDOSPermissionDeniedView(message: "通知はPWAと同じ管理者権限が必要だよ") }
            else {
                HStack {
                    AMDOSMetricTile(label: "L2抽出", value: "\(store.l2.count)", detail: "知識・進捗・根拠")
                    AMDOSMetricTile(label: "MTG", value: "\(store.meetings.count)", detail: "会議サマリ", tint: AMDOSDesign.blue)
                    AMDOSMetricTile(label: "OS通知", value: "\(store.app.filter { $0.readAt == nil }.count)", detail: "未読", tint: AMDOSDesign.warning)
                    AMDOSMetricTile(label: "要対応", value: "\(store.actionItems.count)", detail: "期日順", tint: AMDOSDesign.warning)
                }
                AMDOSStateNotice(state: store.state) { reload() }
                if !store.actionItems.isEmpty { actionItemsSection }
                appNotificationsSection
                Picker("レビュー表示", selection: $reviewFilter) { Text("未対応").tag("open"); Text("未読").tag("unread"); Text("回答済み").tag("answered"); Text("修正依頼").tag("feedback") }.pickerStyle(.segmented)
                if initialNotificationID?.trimmedNonEmpty != nil || initialMeetingID?.trimmedNonEmpty != nil { Text("リンク先の通知を表示中").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.blue) }
                AMDOSSectionCard("L2レビューキュー", systemImage: "checkmark.message") {
                    ForEach(store.l2.filter { matches($0) || $0.id == initialNotificationID }) { item in
                        AMDOSParityL2NotificationCard(item: item, feedbacks: feedbacks(for: item), comment: commentBinding(for: "l2-\(item.id)"), detail: store.details["l2-\(item.id)"], expanded: expanded.contains("l2-\(item.id)"), submitting: store.submitting.contains("l2-\(item.id)"), onToggle: { toggle(.l2(item)) }, onAction: { action in Task { await store.feedback(item, action: action, text: comments["l2-\(item.id)"] ?? "") } }, onRead: { Task { await store.markL2Read(item.id, read: true) } }, onUnread: { Task { await store.markL2Read(item.id, read: false) } })
                    }
                }
                AMDOSSectionCard("MTGレビューキュー", systemImage: "person.3") {
                    ForEach(store.meetings.filter { matches($0) || $0.id == initialMeetingID }) { item in
                        AMDOSParityMeetingNotificationCard(item: item, projectName: store.projects.first(where: { $0.id == item.projectID })?.name, feedbacks: feedbacks(for: item), comment: commentBinding(for: "meeting-\(item.id)"), detail: store.details["meeting-\(item.id)"], expanded: expanded.contains("meeting-\(item.id)"), submitting: store.submitting.contains("meeting-\(item.id)"), onToggle: { toggle(.meeting(item)) }, onAction: { action in Task { await store.feedback(item, action: action, text: comments["meeting-\(item.id)"] ?? "") } }, onRead: { Task { await store.markMeetingRead(item.id, read: true) } }, onUnread: { Task { await store.markMeetingRead(item.id, read: false) } })
                    }
                }
                if let message = store.message { Text(message).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
            }
        }
        .task {
            guard auth.isAdmin else { return }
            await store.load(focusNotificationID: initialNotificationID, focusMeetingID: initialMeetingID)
            if let id = initialNotificationID, let item = store.l2.first(where: { $0.id == id }) { toggle(.l2(item)) }
            if let id = initialMeetingID, let item = store.meetings.first(where: { $0.id == id }) { toggle(.meeting(item)) }
        }
        .confirmationDialog("OS通知を全部既読にする？", isPresented: $confirmAllAppRead, titleVisibility: .visible) {
            Button("全部既読にする") { Task { await store.markAllAppRead() } }
            Button("キャンセル", role: .cancel) {}
        }
    }

    @ViewBuilder private var actionItemsSection: some View {
        AMDOSSectionCard("要対応（期日順）", systemImage: "pin") {
            ForEach(store.actionItems) { item in
                AMDOSCard {
                    HStack(spacing: 8) {
                        AMDOSStatusBadge(text: actionItemChip(item), tint: actionItemTint(item))
                        Text(item.projectID.flatMap { id in store.projects.first(where: { $0.id == id })?.name ?? id } ?? (item.scope == "personal" ? "個人" : "全社")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                        Text(item.category ?? "その他").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        if let actionURL = item.actionURL?.trimmedNonEmpty { Button(item.title) { openNativeRouteOrExternalURL(actionURL) }.buttonStyle(.plain).font(.subheadline.weight(.semibold)) }
                        else { Text(item.title).font(.subheadline.weight(.semibold)) }
                        Spacer()
                        if item.status != "responded" && item.status != "done" { Button("対応済にする") { Task { await store.markActionResponded(item) } }.buttonStyle(.bordered) }
                    }
                }
            }
        }
    }

    @ViewBuilder private var appNotificationsSection: some View {
        AMDOSSectionCard("OS通知", systemImage: "bell.badge") {
            HStack {
                Picker("OS通知表示", selection: $appFilter) { Text("未読").tag("unread"); Text("既読").tag("read"); Text("全部").tag("all") }.pickerStyle(.segmented)
                if appFilter == "unread", !visibleApps.isEmpty { Button("全部既読") { confirmAllAppRead = true }.buttonStyle(.bordered) }
            }
            if visibleApps.isEmpty { Text(appFilter == "unread" ? "未読の通知なし。" : "通知なし。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            if !criticalApps.isEmpty { appGroup("緊急性の高い通知", items: criticalApps, tint: .red) }
            if !normalApps.isEmpty { appGroup("通常通知", items: normalApps, tint: AMDOSDesign.muted) }
        }
    }

    @ViewBuilder private func appGroup(_ title: String, items: [AMDOSParityAppNotification], tint: Color) -> some View {
        Text("\(title) \(items.count)件").font(.caption.weight(.semibold)).foregroundStyle(tint)
        ForEach(items) { item in
            AMDOSCard {
                VStack(alignment: .leading, spacing: 7) {
                    HStack { Text(item.title).font(.headline); Spacer(); AMDOSStatusBadge(text: item.readAt == nil ? "未読" : "既読", tint: item.readAt == nil ? AMDOSDesign.warning : AMDOSDesign.success) }
                    if let body = item.body?.trimmedNonEmpty { Text(body) }
                    Text("\(appKindLabel(item.kind)) · \(appSourceLabel(item.source)) · \(item.createdAt)").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    HStack {
                        if let link = item.link?.trimmedNonEmpty { Button("リンクを開く") { openNotificationLink(link, item: item) }.buttonStyle(.bordered) }
                        if let sourceURL = appSourceURL(item) { Button("source") { openExternalURL(sourceURL) }.buttonStyle(.bordered) }
                        if let reauth = appReauthURL(item) { Button("再認証を開く") { openNotificationLink(reauth, item: item) }.buttonStyle(.bordered) }
                        if let reauthApp = appReauthAppURL(item), reauthApp != appReauthURL(item) { Button("コデックスで開く") { openExternalURL(reauthApp) }.buttonStyle(.bordered) }
                        if let connector = item.meta?.value(for: "connector")?.string?.trimmedNonEmpty {
                            Text("\(connectorLabel(connector))\(appReason(item).map { " / \($0)" } ?? "")").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                        } else if let taskID = item.meta?.value(for: "task_id")?.string?.trimmedNonEmpty {
                            Text("\(item.meta?.value(for: "project_id")?.string ?? "") / \(taskID)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                        }
                        if item.readAt == nil { Button("既読") { Task { await store.markAppRead(item.id) } }.buttonStyle(.bordered) }
                        Button("削除") { Task { await store.dismissApp(item.id) } }.buttonStyle(.bordered)
                    }
                }
            }
        }
    }

    private var visibleApps: [AMDOSParityAppNotification] {
        switch appFilter { case "read": return store.app.filter { $0.readAt != nil }; case "all": return store.app; default: return store.app.filter { $0.readAt == nil } }
    }
    private var criticalApps: [AMDOSParityAppNotification] { visibleApps.filter(appPriorityCritical) }
    private var normalApps: [AMDOSParityAppNotification] { visibleApps.filter { !appPriorityCritical($0) } }

    private func commentBinding(for key: String) -> Binding<String> { Binding(get: { comments[key] ?? "" }, set: { comments[key] = $0 }) }
    private func feedbacks(for item: AMDOSParityL2Notification) -> [AMDOSParityNotificationFeedbackRow] { store.feedbacks.filter { $0.l2Kind == item.kind && $0.targetID == item.targetID && $0.scopeKey == item.scopeKey } }
    private func feedbacks(for item: AMDOSParityMeetingNotification) -> [AMDOSParityNotificationFeedbackRow] { store.feedbacks.filter { $0.l2Kind == "meeting_summary" && ($0.meetingID == item.id || $0.scopeKey == item.id) } }
    private func matches(_ item: AMDOSParityL2Notification) -> Bool { let answered = !feedbacks(for: item).isEmpty; switch reviewFilter { case "unread": return item.readAt == nil && !answered; case "answered", "feedback": return answered; default: return !answered } }
    private func matches(_ item: AMDOSParityMeetingNotification) -> Bool { let answered = !feedbacks(for: item).isEmpty; switch reviewFilter { case "unread": return item.readAt == nil && !answered; case "answered", "feedback": return answered; default: return !answered } }
    private func reload() { Task { await store.load(focusNotificationID: initialNotificationID, focusMeetingID: initialMeetingID) } }
    private func toggle(_ item: AMDOSParityReviewItem) {
        let key = item.key
        if expanded.contains(key) { expanded.remove(key); return }
        expanded.insert(key)
        Task {
            await store.loadDetails(item)
            switch item {
            case .l2(let row) where row.readAt == nil: await store.markL2Read(row.id, read: true)
            case .meeting(let row) where row.readAt == nil: await store.markMeetingRead(row.id, read: true)
            default: break
            }
        }
    }
    private func appPriorityCritical(_ item: AMDOSParityAppNotification) -> Bool { item.kind == "connector_auth" || hasCriticalMeta(item.meta) || criticalTokens([item.kind, item.source, item.title, item.body, item.meta?.compactText]) }
    private func appReauthURL(_ item: AMDOSParityAppNotification) -> String? { item.meta?.value(for: "reauth_url", "reauth_install_url", "reauth_app_url")?.string }
    private func appReauthAppURL(_ item: AMDOSParityAppNotification) -> String? { item.meta?.value(for: "reauth_app_url")?.string }
    private func appSourceURL(_ item: AMDOSParityAppNotification) -> String? { item.meta?.value(for: "source_url")?.string }
    private func appReason(_ item: AMDOSParityAppNotification) -> String? { item.meta?.value(for: "reason")?.string?.trimmedNonEmpty.map(reasonLabel) }
    private func hasCriticalMeta(_ meta: AMDOSParityJSON?) -> Bool { guard let object = meta?.object else { return false }; if object["critical"]?.bool == true || object["is_critical"]?.bool == true { return true }; return ["priority", "severity", "urgency", "notification_priority", "notification_channel", "risk_level"].contains { ["critical", "urgent", "blocker", "事故", "緊急"].contains(object[$0]?.string?.lowercased() ?? "") } }
    private func criticalTokens(_ values: [String?]) -> Bool { values.compactMap { $0 }.contains { $0.range(of: "critical|urgent|blocker|blocked|oauth_token_invalid_grant|trigger_reauthentication|認証切れ|再認証|ブロッカー|事故|緊急|至急|期限超過", options: [.regularExpression, .caseInsensitive]) != nil } }
    private func actionItemChip(_ item: AMDOSParityActionItem) -> String { if ["responded", "done"].contains(item.status) { return "対応済" }; guard let days = item.daysLeft else { return "期日なし" }; return days < 0 ? "期限超過 \(-days)日" : "あと\(days)日" }
    private func actionItemTint(_ item: AMDOSParityActionItem) -> Color { guard let days = item.daysLeft else { return AMDOSDesign.muted }; if days <= 3 { return .red }; if days <= 7 { return AMDOSDesign.warning }; return AMDOSDesign.muted }

    private func openNotificationLink(_ raw: String, item: AMDOSParityAppNotification) {
        if item.readAt == nil { Task { await store.markAppRead(item.id) } }
        openNativeRouteOrExternalURL(raw)
    }

    private func openNativeRouteOrExternalURL(_ raw: String) {
        Task {
            let url = raw.hasPrefix("/")
                ? await AMDOSRESTClient.shared.pwaURL(path: raw)
                : URL(string: raw)
            guard let url else { return }
            if AMDOSPWAPathRouter.route(for: url) != nil {
                await workspace.acceptNavigationURL(url)
            } else {
                await MainActor.run { NSWorkspace.shared.open(url) }
            }
        }
    }

    private func openExternalURL(_ raw: String) {
        guard let url = URL(string: raw) else { return }
        NSWorkspace.shared.open(url)
    }
}

private struct AMDOSParityL2NotificationCard: View {
    let item: AMDOSParityL2Notification
    let feedbacks: [AMDOSParityNotificationFeedbackRow]
    @Binding var comment: String
    let detail: AMDOSParityNotificationDetail?
    let expanded: Bool
    let submitting: Bool
    let onToggle: () -> Void
    let onAction: (String) -> Void
    let onRead: () -> Void
    let onUnread: () -> Void
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 7) {
                Button(action: onToggle) {
                    HStack { VStack(alignment: .leading, spacing: 3) { Text(item.title).font(.headline); Text("\(item.createdAt ?? item.notifiedAt ?? "") · \(item.kind)").font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); AMDOSStatusBadge(text: l2PriorityCritical(item) ? "緊急" : "通常", tint: l2PriorityCritical(item) ? .red : AMDOSDesign.muted); if !feedbacks.isEmpty { AMDOSStatusBadge(text: "回答済み", tint: AMDOSDesign.success) }; Image(systemName: expanded ? "chevron.up" : "chevron.down") }.contentShape(Rectangle())
                }.buttonStyle(.plain)
                if expanded {
                    Text(item.summary ?? "要約なし").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    AMDOSParityNotificationDetailView(detail: detail)
                    ForEach(feedbacks.prefix(3)) { feedback in Text("\(feedback.feedbackText ?? "修正依頼") · \(feedback.createdAt ?? "")").font(.caption).foregroundStyle(AMDOSDesign.warning) }
                    if let responseLabel {
                        Text("回答済み: \(responseLabel)").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.success)
                    } else {
                        AMDOSTextField(title: "補足コメント", text: $comment, axis: .vertical)
                        HStack {
                            Button(coverageGapCopyBlocked ? "コピー対象を確認中…" : yesLabel) { onAction("yes") }.buttonStyle(.borderedProminent).disabled(submitting || coverageGapCopyBlocked)
                            Button(noLabel) { onAction("no") }.buttonStyle(.bordered).disabled(submitting)
                            Button(submitting ? "送信中…" : "コメント送信") { onAction("comment") }.buttonStyle(.bordered).disabled(submitting || comment.trimmedNonEmpty == nil)
                            if item.readAt == nil { Button("既読") { onRead() }.disabled(submitting) }
                            else { Button("未読に戻す") { onUnread() }.disabled(submitting) }
                        }
                    }
                }
            }
        }
    }
    private var yesLabel: String { if item.kind == "coverage_gap" { return "重要メモにコピー" }; if item.kind == "textbook_insight" { return "BZM追記を承認" }; return item.savedCount != nil && item.savedCount == item.totalCount ? "はい・確認済み" : "はい・反映" }
    private var noLabel: String { item.kind == "coverage_gap" ? "コピーしない" : item.kind == "textbook_insight" ? "BZMには入れない" : "いいえ・不採用" }
    private var responseLabel: String? {
        guard let latest = feedbacks.first?.feedbackText?.trimmingCharacters(in: .whitespacesAndNewlines), !latest.isEmpty else { return nil }
        if latest.hasPrefix("[はい]") { return yesLabel }
        if latest.hasPrefix("[いいえ]") { return noLabel }
        return "コメント送信済み"
    }
    private var coverageGapCopyBlocked: Bool {
        guard item.kind == "coverage_gap" else { return false }
        guard let detail else { return true }
        return detail.loading || detail.error != nil || detail.rows.isEmpty || detail.rows.contains {
            $0.heading == "このカードだけではコピー対象を判断できない"
        }
    }
    private func l2PriorityCritical(_ item: AMDOSParityL2Notification) -> Bool { guard let meta = item.metadata?.object else { return false }; if meta["critical"]?.bool == true || meta["is_critical"]?.bool == true { return true }; return ["priority", "severity", "urgency", "notification_priority", "notification_channel", "risk_level"].contains { ["critical", "urgent", "blocker", "事故", "緊急"].contains(meta[$0]?.string?.lowercased() ?? "") } }
}

private struct AMDOSParityMeetingNotificationCard: View {
    let item: AMDOSParityMeetingNotification
    let projectName: String?
    let feedbacks: [AMDOSParityNotificationFeedbackRow]
    @Binding var comment: String
    let detail: AMDOSParityNotificationDetail?
    let expanded: Bool
    let submitting: Bool
    let onToggle: () -> Void
    let onAction: (String) -> Void
    let onRead: () -> Void
    let onUnread: () -> Void
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 7) {
                Button(action: onToggle) {
                    HStack { VStack(alignment: .leading, spacing: 3) { Text(item.title).font(.headline); Text("\(projectName ?? item.projectID) · \(item.createdAt ?? item.notifiedAt ?? "")").font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); AMDOSStatusBadge(text: "通常", tint: AMDOSDesign.muted); if !feedbacks.isEmpty { AMDOSStatusBadge(text: "回答済み", tint: AMDOSDesign.success) }; Image(systemName: expanded ? "chevron.up" : "chevron.down") }.contentShape(Rectangle())
                }.buttonStyle(.plain)
                if expanded {
                    Text(item.summary).font(.caption).foregroundStyle(AMDOSDesign.muted)
                    AMDOSParityNotificationDetailView(detail: detail)
                    ForEach(feedbacks.prefix(3)) { feedback in Text("\(feedback.feedbackText ?? "修正依頼") · \(feedback.createdAt ?? "")").font(.caption).foregroundStyle(AMDOSDesign.warning) }
                    if let responseLabel {
                        Text("回答済み: \(responseLabel)").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.success)
                    } else {
                        AMDOSTextField(title: "補足コメント", text: $comment, axis: .vertical)
                        HStack {
                            Button("はい・確認") { onAction("yes") }.buttonStyle(.borderedProminent).disabled(submitting)
                            Button("いいえ") { onAction("no") }.buttonStyle(.bordered).disabled(submitting)
                            Button(submitting ? "送信中…" : "コメント送信") { onAction("comment") }.buttonStyle(.bordered).disabled(submitting || comment.trimmedNonEmpty == nil)
                            if item.readAt == nil { Button("既読") { onRead() }.disabled(submitting) }
                            else { Button("未読に戻す") { onUnread() }.disabled(submitting) }
                        }
                    }
                }
            }
        }
    }
    private var responseLabel: String? {
        guard let latest = feedbacks.first?.feedbackText?.trimmingCharacters(in: .whitespacesAndNewlines), !latest.isEmpty else { return nil }
        if latest.hasPrefix("[はい]") { return "はい・確認" }
        if latest.hasPrefix("[いいえ]") { return "いいえ" }
        return "コメント送信済み"
    }
}

private struct AMDOSParityNotificationDetailView: View {
    let detail: AMDOSParityNotificationDetail?
    var body: some View {
        Group {
            if detail?.loading == true { ProgressView("正本行を読み込み中…").font(.caption) }
            else if let error = detail?.error { Text(error).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
            else if let rows = detail?.rows {
                ForEach(rows) { row in
                    VStack(alignment: .leading, spacing: 3) { Text(row.heading).font(.caption.weight(.semibold)); Text(row.body).font(.caption).textSelection(.enabled); if let sub = row.sub { Text(sub).font(.caption2).foregroundStyle(AMDOSDesign.muted) } }
                }
            }
        }
    }
}

private func appKindLabel(_ kind: String) -> String { ["vc_new": "新VC", "vc_news": "VCニュース", "vc_fund": "ファンド更新", "task_created": "タスク追加", "connector_auth": "再認証", "h1_report": "H-1報告", "misc": "その他"][kind] ?? kind }
private func appSourceLabel(_ source: String) -> String { ["cron_vc_discover": "vc-discover", "tsukuyomi": "つくよみ", "manual": "手動", "system": "system", "task_agent": "task agent", "h1_meeting_flow": "H-1"][source] ?? source }
private func connectorLabel(_ connector: String) -> String { ["notion": "ノーション", "gmail": "メール", "drive": "ドライブ", "calendar": "カレンダー", "slack": "スラック"][connector] ?? connector }
private func reasonLabel(_ reason: String) -> String { ["oauth_token_invalid_grant": "認証の有効期限切れ", "TRIGGER_REAUTHENTICATION": "再認証が必要", "reauth_required": "再認証が必要"][reason] ?? reason }

private struct AMDOSParityReimbursementProject: Codable, Identifiable, Sendable { let id: String; let name: String; enum CodingKeys: String, CodingKey { case id = "project_id", name = "project_name" } }
private struct AMDOSParityReimbursementMember: Codable, Sendable {
    let memberId: String
    let isAdmin: Bool
    enum CodingKeys: String, CodingKey { case memberId = "member_id", isAdmin = "is_admin" }
}
private struct AMDOSParityReimbursementApprovalPatch: Encodable, Sendable {
    let status: String
    let pmApprovedBy: String?
    let pmApprovedAt: String?
    let adminApprovedBy: String?
    let adminApprovedAt: String?
    let updatedAt: String
    enum CodingKeys: String, CodingKey { case status, pmApprovedBy = "pm_approved_by", pmApprovedAt = "pm_approved_at", adminApprovedBy = "admin_approved_by", adminApprovedAt = "admin_approved_at", updatedAt = "updated_at" }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(status, forKey: .status)
        try container.encode(updatedAt, forKey: .updatedAt)
        try container.encodeOrNil(pmApprovedBy, forKey: .pmApprovedBy)
        try container.encodeOrNil(pmApprovedAt, forKey: .pmApprovedAt)
        try container.encodeOrNil(adminApprovedBy, forKey: .adminApprovedBy)
        try container.encodeOrNil(adminApprovedAt, forKey: .adminApprovedAt)
    }
}

private extension KeyedEncodingContainer {
    mutating func encodeOrNil<T: Encodable>(_ value: T?, forKey key: Key) throws {
        if let value { try encode(value, forKey: key) }
        else { try encodeNil(forKey: key) }
    }
}

private struct AMDOSParityReimbursementDeleteInput: Encodable, Sendable {
    let reimbursementId: String
    enum CodingKeys: String, CodingKey { case reimbursementId = "reimbursement_id" }
}

private struct AMDOSParityReceiptLink: Identifiable, Sendable {
    let id: String
    let name: String
    let url: URL
}

struct AMDOSParityReimbursementsView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    @State private var items: [AMDOSReimbursement] = []
    @State private var projects: [AMDOSParityReimbursementProject] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var projectID = ""
    @State private var editingID: String?
    @State private var date = String(Calendar.current.component(.year, from: .now)) + "-" + String(format: "%02d", Calendar.current.component(.month, from: .now)) + "-" + String(format: "%02d", Calendar.current.component(.day, from: .now))
    @State private var category = "transport"
    @State private var amount = ""
    @State private var taxRate = "0.1"
    @State private var description = ""
    @State private var transportMode = "train"
    @State private var from = ""
    @State private var to = ""
    @State private var trip = "oneway"
    @State private var receipts: [URL] = []
    @State private var choosingReceipts = false
    @State private var message: String?
    @State private var pmProjectIDs = Set<String>()
    @State private var isAdmin = false
    @State private var receiptLinks: [String: URL] = [:]
    @State private var isSaving = false
    @State private var busyID: String?
    @State private var pendingDeleteID: String?

    private var currentEmail: String { auth.email?.lowercased() ?? "" }
    private var myItems: [AMDOSReimbursement] { items.filter { $0.createdBy.lowercased() == currentEmail } }
    private var approvalItems: [AMDOSReimbursement] {
        items.filter { item in
            (item.status == "submitted" && pmProjectIDs.contains(item.projectId)) || (["pmApproved", "pmapproved"].contains(item.status) && isAdmin)
        }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "REIMBURSEMENTS", title: "立替精算", subtitle: "PWAと同じ submitted → PM承認 → admin承認の申請・承認フロー") {
            AMDOSSectionCard(editingID == nil ? "立替を申請" : "立替を編集", systemImage: "receipt") {
                Picker("PJ", selection: $projectID) { Text("選択").tag(""); ForEach(projects) { Text($0.name).tag($0.id) } }
                HStack { AMDOSTextField(title: "発生日 YYYY-MM-DD", text: $date); Picker("費目", selection: $category) { Text("交通費").tag("transport"); Text("宿泊").tag("lodging"); Text("消耗品").tag("supplies"); Text("会議費").tag("meal"); Text("その他").tag("other") } }
                HStack { AMDOSTextField(title: "金額（税込）", text: $amount); Picker("税率", selection: $taxRate) { Text("10%").tag("0.1"); Text("8%").tag("0.08"); Text("非課税").tag("0") } }
                AMDOSTextField(title: "摘要", text: $description, axis: .vertical)
                if category == "transport" {
                    HStack {
                        Picker("手段", selection: $transportMode) {
                            Text("電車").tag("train"); Text("バス").tag("bus"); Text("タクシー").tag("taxi"); Text("自家用車").tag("car"); Text("その他").tag("other")
                        }
                        AMDOSTextField(title: "出発", text: $from)
                        AMDOSTextField(title: "到着", text: $to)
                        Picker("往復", selection: $trip) { Text("片道").tag("oneway"); Text("往復").tag("round") }
                    }
                }
                HStack { Button("領収書を選ぶ") { choosingReceipts = true }; Text(receipts.map(\.lastPathComponent).joined(separator: ", ").trimmedNonEmpty ?? "未選択").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                if let editingID, let editingItem = items.first(where: { $0.id == editingID }), !receiptLinks(for: editingItem).isEmpty {
                    receiptLinkButtons(for: editingItem)
                }
                HStack {
                    Button(isSaving ? "保存中…" : (editingID == nil ? "申請する" : "更新する")) { save() }
                        .buttonStyle(.borderedProminent)
                        .disabled(isSaving)
                    if editingID != nil { Button("新規に戻す") { reset() }.buttonStyle(.bordered).disabled(isSaving) }
                }
            }
            AMDOSStateNotice(state: state) { load() }
            if !approvalItems.isEmpty {
                AMDOSSectionCard("承認待ち", systemImage: "checkmark.seal") {
                    ForEach(approvalItems) { item in reimbursementCard(item, includeOwnActions: false) }
                }
            }
            AMDOSSectionCard("自分の申請", systemImage: "clock.arrow.circlepath") {
                if myItems.isEmpty { Text("自分の申請はまだないよ。").foregroundStyle(AMDOSDesign.muted) }
                ForEach(myItems) { item in reimbursementCard(item, includeOwnActions: true) }
            }
            if let message { Text(message).font(.caption).foregroundStyle(message.hasPrefix("エラー") ? .red : AMDOSDesign.success).textSelection(.enabled) }
        }
        .task { await loadData() }
        .fileImporter(isPresented: $choosingReceipts, allowedContentTypes: [.pdf, .png, .jpeg, .webP], allowsMultipleSelection: true) { result in
            do { receipts = try result.get() }
            catch { message = "エラー: \(error.localizedDescription)" }
        }
        .confirmationDialog("この立替を削除する？", isPresented: Binding(
            get: { pendingDeleteID != nil },
            set: { if !$0 { pendingDeleteID = nil } }
        ), titleVisibility: .visible) {
            if let pendingDeleteID, let item = items.first(where: { $0.id == pendingDeleteID }) {
                Button("削除", role: .destructive) { delete(item) }
            }
            Button("キャンセル", role: .cancel) { pendingDeleteID = nil }
        }
    }

    @ViewBuilder private func reimbursementCard(_ item: AMDOSReimbursement, includeOwnActions: Bool) -> some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    Text("\(item.date) · \(item.projectName ?? item.projectId)").font(.headline)
                    Spacer()
                    AMDOSStatusBadge(text: reimbursementStatusLabel(item.status))
                }
                Text("\(reimbursementCategoryLabel(item.category)) · \(Int(item.amount))円 · 税率 \(Int(item.taxRate * 100))%")
                if let description = item.description?.trimmedNonEmpty { Text(description) }
                if item.category == "transport" {
                    Text("\(transportModeLabel(item.transportMode)) · \(item.transportFrom ?? "") → \(item.transportTo ?? "") · \(item.transportTrip == "round" ? "往復" : "片道")")
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                if receiptLinks(for: item).isEmpty {
                    Text("領収書なし").font(.caption).foregroundStyle(AMDOSDesign.muted)
                } else {
                    receiptLinkButtons(for: item)
                }
                HStack {
                    Text("PM \(item.pmApprovedAt == nil ? "待ち" : "済")").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    Text("admin \(item.adminApprovedAt == nil ? "待ち" : "済")").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                }
                let busy = busyID == item.id
                if includeOwnActions, item.status == "submitted", item.createdBy.lowercased() == currentEmail {
                    HStack {
                        Button("編集") { startEdit(item) }.disabled(busy)
                        Button("削除", role: .destructive) { pendingDeleteID = item.id }.disabled(busy)
                    }
                }
                if item.status == "submitted", pmProjectIDs.contains(item.projectId) {
                    HStack {
                        Button(busy ? "処理中…" : "PM承認") { decide(item, action: "pmApprove") }.buttonStyle(.borderedProminent).disabled(busy)
                        Button("差戻し") { decide(item, action: "pmReject") }.buttonStyle(.bordered).disabled(busy)
                    }
                }
                if ["pmApproved", "pmapproved"].contains(item.status), isAdmin {
                    HStack {
                        Button(busy ? "処理中…" : "admin承認") { decide(item, action: "adminApprove") }.buttonStyle(.borderedProminent).disabled(busy)
                        Button("却下") { decide(item, action: "adminReject") }.buttonStyle(.bordered).disabled(busy)
                    }
                }
            }
        }
    }

    private func load() { Task { await loadData() } }

    private func loadData() async {
        state = .loading
        do {
            guard !currentEmail.isEmpty else {
                items = []; projects = []; pmProjectIDs = []; isAdmin = false; state = .empty
                return
            }
            async let itemRows = AMDOSRESTClient.shared.fetchTable(AMDOSReimbursement.self, table: "reimbursements", select: "reimbursement_id,project_id,project_name,date,description,category,amount,tax_rate,status,created_by,pm_approved_by,pm_approved_at,admin_approved_by,admin_approved_at,transport_mode,transport_from,transport_to,transport_trip,receipt_storage_paths,receipt_file_names", order: "date.desc", limit: 400)
            async let projectRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityReimbursementProject.self, table: "projects", select: "project_id,project_name", filters: ["status": "eq.active"], order: "project_name")
            let members = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityReimbursementMember.self, table: "members", select: "member_id,is_admin", filters: ["email": "eq.\(currentEmail)"], limit: 1)
            let loadedItems = try await itemRows
            items = loadedItems
            receiptLinks = await signedReceiptLinks(for: loadedItems)
            projects = try await projectRows
            isAdmin = members.first?.isAdmin ?? false
            if let memberID = members.first?.memberId {
                let memberships = try await AMDOSRESTClient.shared.fetchTable(AMDOSProjectMember.self, table: "project_members", select: "id,project_id,member_id,role,role_label,is_active,is_pm,is_pl", filters: ["member_id": "eq.\(memberID)", "is_active": "eq.true", "is_pm": "eq.true"])
                pmProjectIDs = Set(memberships.map(\.projectId))
            } else {
                pmProjectIDs = []
            }
            state = items.isEmpty ? .empty : .loaded
        } catch {
            message = "エラー: \(error.localizedDescription)"
            state = .failed(error.localizedDescription)
        }
    }

    private func startEdit(_ item: AMDOSReimbursement) {
        editingID = item.id; projectID = item.projectId; date = String(item.date.prefix(10)); category = item.category; amount = String(Int(item.category == "transport" && item.transportTrip == "round" ? item.amount / 2 : item.amount)); taxRate = String(item.taxRate); description = item.description ?? ""; transportMode = item.transportMode ?? "train"; from = item.transportFrom ?? ""; to = item.transportTo ?? ""; trip = item.transportTrip ?? "oneway"; receipts = []
    }

    private func reset() {
        editingID = nil; projectID = ""; amount = ""; description = ""; from = ""; to = ""; receipts = []
    }

    private func save() {
        guard !projectID.isEmpty else { message = "PJを選んでね"; return }; guard date.trimmedNonEmpty != nil else { message = "発生日を入れてね"; return }; guard description.trimmedNonEmpty != nil else { message = "摘要を入れてね"; return }; guard let numeric = Double(amount.replacingOccurrences(of: ",", with: "")), numeric > 0 else { message = "金額は0より大きくしてね"; return }; if category == "transport" && (from.trimmedNonEmpty == nil || to.trimmedNonEmpty == nil) { message = "交通費は出発と到着を入れてね"; return }
        for receipt in receipts where !["pdf", "png", "jpg", "jpeg", "webp"].contains(receipt.pathExtension.lowercased()) {
            message = "(receipt.lastPathComponent) はPNG/JPEG/WebP/PDFだけ対応だよ"
            return
        }
        let mode = editingID == nil ? "create" : "update"
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                let projectName = projects.first(where: { $0.id == projectID })?.name ?? projectID
                let fields = ["mode": mode, "reimbursement_id": editingID ?? UUID().uuidString, "project_id": projectID, "project_name": projectName, "date": date, "category": category, "amount": String(numeric), "tax_rate": taxRate, "description": description.trimmingCharacters(in: .whitespacesAndNewlines), "transport_mode": transportMode, "transport_from": from.trimmingCharacters(in: .whitespacesAndNewlines), "transport_to": to.trimmingCharacters(in: .whitespacesAndNewlines), "transport_trip": trip]
                let files = try receipts.map { url -> AMDOSUploadFile in
                    let data = try readSecurityScopedFileData(url)
                    guard data.count <= 10 * 1024 * 1024 else {
                        throw AMDOSNetworkError.http("\(url.lastPathComponent) が10MBを超えてる")
                    }
                    let ext = url.pathExtension.lowercased()
                    let mime = ext == "pdf" ? "application/pdf" : ext == "jpg" || ext == "jpeg" ? "image/jpeg" : ext == "webp" ? "image/webp" : "image/png"
                    return AMDOSUploadFile(fieldName: "receipts", filename: url.lastPathComponent, mimeType: mime, data: data)
                }
                _ = try await AMDOSRESTClient.shared.uploadMultipart(path: "/api/reimbursements", fields: fields, files: files)
                message = mode == "update" ? "立替を更新した" : "立替を申請した"
                reset()
                await loadData()
            } catch { message = "エラー: \(error.localizedDescription)" }
        }
    }
    private func delete(_ item: AMDOSReimbursement) {
        Task {
            busyID = item.id
            defer { busyID = nil; pendingDeleteID = nil }
            do {
                _ = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/reimbursements",
                    method: "DELETE",
                    body: AMDOSParityReimbursementDeleteInput(reimbursementId: item.id)
                )
                message = "立替を削除したよ"
                await loadData()
            } catch { message = "エラー: \(error.localizedDescription)" }
        }
    }
    private func decide(_ item: AMDOSReimbursement, action: String) {
        Task {
            busyID = item.id
            defer { busyID = nil }
            do {
                let now = ISO8601DateFormatter().string(from: .now)
                let patch: AMDOSParityReimbursementApprovalPatch
                let expectedStatus: String
                switch action {
                case "pmApprove":
                    patch = .init(status: "pmApproved", pmApprovedBy: currentEmail, pmApprovedAt: now, adminApprovedBy: nil, adminApprovedAt: nil, updatedAt: now)
                    expectedStatus = "submitted"
                case "pmReject":
                    patch = .init(status: "rejected", pmApprovedBy: nil, pmApprovedAt: nil, adminApprovedBy: nil, adminApprovedAt: nil, updatedAt: now)
                    expectedStatus = "submitted"
                case "adminApprove":
                    patch = .init(status: "approved", pmApprovedBy: item.pmApprovedBy, pmApprovedAt: item.pmApprovedAt, adminApprovedBy: currentEmail, adminApprovedAt: now, updatedAt: now)
                    expectedStatus = item.status
                default:
                    patch = .init(status: "rejected", pmApprovedBy: nil, pmApprovedAt: nil, adminApprovedBy: nil, adminApprovedAt: nil, updatedAt: now)
                    expectedStatus = item.status
                }
                _ = try await AMDOSRESTClient.shared.patchTable(table: "reimbursements", filters: ["reimbursement_id": "eq.\(item.id)", "status": "eq.\(expectedStatus)"], body: patch)
                message = action.contains("Reject") ? "差し戻した" : "承認した"
                await loadData()
            } catch { message = "エラー: \(error.localizedDescription)" }
        }
    }

    @ViewBuilder private func receiptLinkButtons(for item: AMDOSReimbursement) -> some View {
        let links = receiptLinks(for: item)
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) {
                ForEach(links) { link in
                    Link(link.name, destination: link.url)
                        .font(.caption)
                        .buttonStyle(.bordered)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                ForEach(links) { link in
                    Link(link.name, destination: link.url)
                        .font(.caption)
                        .buttonStyle(.bordered)
                }
            }
        }
    }

    private func receiptLinks(for item: AMDOSReimbursement) -> [AMDOSParityReceiptLink] {
        (item.receiptStoragePaths ?? []).enumerated().compactMap { index, _ in
            let id = "\(item.id)-\(index)"
            guard let url = receiptLinks[id] else { return nil }
            let storedName = item.receiptFileNames.flatMap { names in
                names.indices.contains(index) ? names[index].trimmedNonEmpty : nil
            }
            let name = storedName ?? "receipt-\(index + 1)"
            return AMDOSParityReceiptLink(id: id, name: name, url: url)
        }
    }

    private func signedReceiptLinks(for rows: [AMDOSReimbursement]) async -> [String: URL] {
        await withTaskGroup(of: (String, URL?).self, returning: [String: URL].self) { group in
            for row in rows {
                for (index, path) in (row.receiptStoragePaths ?? []).enumerated() where path.trimmedNonEmpty != nil {
                    let id = "\(row.id)-\(index)"
                    group.addTask {
                        let url = try? await AMDOSRESTClient.shared.createSignedStorageURL(bucket: "reimbursement-receipts", path: path)
                        return (id, url)
                    }
                }
            }
            var links: [String: URL] = [:]
            for await (id, url) in group {
                if let url { links[id] = url }
            }
            return links
        }
    }
}

private func reimbursementStatusLabel(_ status: String) -> String { ["submitted": "申請中", "pmApproved": "PM承認済", "pmapproved": "PM承認済", "approved": "承認済", "rejected": "却下", "paid": "支払済"][status] ?? status }
private func reimbursementCategoryLabel(_ category: String) -> String { ["transport": "交通費", "lodging": "宿泊", "supplies": "消耗品", "meal": "会議費", "other": "その他"][category] ?? category }
private func transportModeLabel(_ mode: String?) -> String { ["train": "電車", "bus": "バス", "taxi": "タクシー", "car": "自家用車", "other": "その他"][mode ?? ""] ?? (mode ?? "移動") }
private func businessCardStatusLabel(_ status: String?) -> String { ["processing": "読み取り中", "needs_review": "要確認", "confirmed": "確認済み", "ocr_failed": "手入力が必要", "archived": "保管終了"][status ?? ""] ?? (status ?? "—") }

private struct AMDOSParityBusinessCardProject: Codable, Hashable, Identifiable, Sendable {
    let projectId: String
    let projectName: String
    let projectKnowledgeId: String?

    var id: String { projectId }
}

private struct AMDOSParityBusinessCardProjectOption: Codable, Hashable, Identifiable, Sendable {
    let projectId: String
    let projectName: String

    var id: String { projectId }
}

private struct AMDOSParityBusinessCard: Codable, Identifiable, Sendable {
    let id: String
    let fullName: String?
    let fullNameKana: String?
    let companyName: String?
    let department: String?
    let jobTitle: String?
    let email: String?
    let phone: String?
    let mobile: String?
    let postalCode: String?
    let address: String?
    let website: String?
    let relationshipNote: String?
    let metOn: String?
    let rawOcrText: String?
    let ocrConfidence: Double?
    let fieldConfidence: [String: Double]?
    let ocrError: String?
    let status: String?
    let imageURL: String?
    let originalFileName: String?
    let projects: [AMDOSParityBusinessCardProject]

    enum CodingKeys: String, CodingKey {
        case id, fullName, fullNameKana, companyName, department, jobTitle, email, phone, mobile
        case postalCode, address, website, relationshipNote, metOn, rawOcrText, ocrConfidence, fieldConfidence, ocrError
        case status, imageURL = "imageUrl", originalFileName, projects
    }
}

private struct AMDOSParityBusinessCardCounts: Codable, Sendable {
    let total: Int
    let needsReview: Int
    let confirmed: Int
}

private struct AMDOSParityBusinessCardsEnvelope: Codable, Sendable {
    let ok: Bool?
    let cards: [AMDOSParityBusinessCard]
    let projects: [AMDOSParityBusinessCardProjectOption]?
    let counts: AMDOSParityBusinessCardCounts?
    let error: String?
}

private struct AMDOSParityBusinessCardMutationEnvelope: Codable, Sendable {
    let ok: Bool?
    let card: AMDOSParityBusinessCard?
    let duplicateCount: Int?
    let warning: String?
    let error: String?
}

private func readSecurityScopedFileData(_ url: URL) throws -> Data {
    let didAccess = url.startAccessingSecurityScopedResource()
    defer {
        if didAccess { url.stopAccessingSecurityScopedResource() }
    }
    return try Data(contentsOf: url)
}

/// PWA の `prepareBusinessCardImage` と同じ前処理。
/// 小さい対応画像は原本のまま送り、それ以外は最大1800px・JPEG品質0.86にしてから
/// API の4MB制限へ通す。MacではOSが読める画像形式もこの変換経路で扱える。
private func prepareBusinessCardUploadFile(from url: URL) throws -> AMDOSUploadFile {
    let source = try readSecurityScopedFileData(url)
    let extensionName = url.pathExtension.lowercased()
    let originalMIME: String? = switch extensionName {
    case "jpg", "jpeg": "image/jpeg"
    case "png": "image/png"
    case "webp": "image/webp"
    default: nil
    }
    if let originalMIME, source.count <= 1_500_000 {
        return AMDOSUploadFile(fieldName: "file", filename: url.lastPathComponent, mimeType: originalMIME, data: source)
    }

    guard let image = NSImage(data: source) else {
        throw AMDOSNetworkError.http("画像を縮小できなかったよ")
    }
    let representation = image.representations.compactMap { $0 as? NSBitmapImageRep }.first
    let sourceWidth = max(1, representation?.pixelsWide ?? Int(image.size.width.rounded()))
    let sourceHeight = max(1, representation?.pixelsHigh ?? Int(image.size.height.rounded()))
    let scale = min(1, 1_800 / Double(max(sourceWidth, sourceHeight)))
    let width = max(1, Int((Double(sourceWidth) * scale).rounded()))
    let height = max(1, Int((Double(sourceHeight) * scale).rounded()))
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .calibratedRGB,
        bitmapFormat: .alphaFirst,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        throw AMDOSNetworkError.http("画像を縮小できなかったよ")
    }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    NSColor.white.setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: height)).fill()
    image.draw(in: NSRect(x: 0, y: 0, width: width, height: height), from: .zero, operation: .copy, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    guard let encoded = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.86]) else {
        throw AMDOSNetworkError.http("画像変換に失敗したよ")
    }
    guard encoded.count <= 4 * 1024 * 1024 else {
        throw AMDOSNetworkError.http("画像を4MB以内にできなかったよ。少し離れて撮り直してね")
    }
    let baseName = url.deletingPathExtension().lastPathComponent.trimmedNonEmpty ?? "business-card"
    return AMDOSUploadFile(fieldName: "file", filename: "\(baseName).jpg", mimeType: "image/jpeg", data: encoded)
}

private struct AMDOSParityBusinessCardImage: View {
    let path: String?
    @State private var image: NSImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFit()
            } else if failed {
                Label("名刺画像を表示できない", systemImage: "photo.badge.exclamationmark")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
            } else {
                ProgressView()
            }
        }
        .frame(maxWidth: 360, minHeight: 150, maxHeight: 260, alignment: .center)
        .background(AMDOSDesign.page, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .task(id: path) {
            image = nil
            failed = false
            guard let path = path?.trimmedNonEmpty else { failed = true; return }
            do {
                let data = try await AMDOSRESTClient.shared.fetchPWAData(path: path)
                guard let loaded = NSImage(data: data) else { failed = true; return }
                image = loaded
            } catch {
                failed = true
            }
        }
    }
}

private struct AMDOSParityBusinessCardUpdate: Encodable, Sendable {
    let fullName: String; let fullNameKana: String?; let companyName: String?; let department: String?; let jobTitle: String?; let email: String?; let phone: String?; let mobile: String?; let postalCode: String?; let address: String?; let website: String?; let relationshipNote: String?; let metOn: String?; let projectIds: [String]
}

struct AMDOSParityBusinessCardsView: View {
    @State private var cards: [AMDOSParityBusinessCard] = []
    @State private var projects: [AMDOSParityBusinessCardProjectOption] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var selected: AMDOSParityBusinessCard?
    @State private var file: URL?
    @State private var chooseFile = false
    @State private var dropActive = false
    @State private var fullName = ""; @State private var fullNameKana = ""; @State private var companyName = ""; @State private var department = ""; @State private var jobTitle = ""; @State private var email = ""; @State private var phone = ""; @State private var mobile = ""; @State private var postalCode = ""; @State private var address = ""; @State private var website = ""; @State private var relationshipNote = ""; @State private var metOn = ""; @State private var projectIDs = Set<String>(); @State private var message: String?
    @State private var query = ""
    @State private var projectFilter = ""
    @State private var statusFilter = "all"
    @State private var counts = AMDOSParityBusinessCardCounts(total: 0, needsReview: 0, confirmed: 0)
    @State private var isUploading = false
    @State private var isSaving = false
    @State private var duplicateCount: Int?

    private var visibleCards: [AMDOSParityBusinessCard] {
        let search = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return cards.filter { card in
            if statusFilter == "review", !["needs_review", "ocr_failed"].contains(card.status) { return false }
            if statusFilter == "confirmed", card.status != "confirmed" { return false }
            if !projectFilter.isEmpty, !card.projects.contains(where: { $0.projectId == projectFilter }) { return false }
            guard !search.isEmpty else { return true }
            return [card.fullName, card.fullNameKana, card.companyName, card.department, card.jobTitle, card.email, card.phone, card.mobile]
                .compactMap { $0 }
                .contains { $0.lowercased().contains(search) }
        }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "BUSINESS CARDS", title: "名刺", subtitle: "PWAのOCR候補→人手確認→PJ知識同期。確認APIの全フィールドとPJ 1件以上の必須条件を保持") {
            AMDOSSectionCard("OCR取込", systemImage: "camera") {
                HStack {
                    Button("画像を選ぶ") { chooseFile = true }
                    Button("ペースト") { pasteBusinessCardImage() }
                    Text(file?.lastPathComponent ?? "未選択")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                    Spacer()
                    Button(isUploading ? "読み取り中…" : "OCR候補を作成") { upload() }
                        .buttonStyle(.borderedProminent)
                        .disabled(file == nil || isUploading)
                }
                Text("JPEG / PNG / WebP、4MB以内。ここへドロップ、またはCmd+Vでも選べる")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
            }
            .onDrop(of: [.fileURL], isTargeted: $dropActive) { providers in
                importDroppedBusinessCard(providers)
            }
            .padding(8)
            .background(dropActive ? AMDOSDesign.blue.opacity(0.10) : Color.clear)
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(dropActive ? AMDOSDesign.blue : Color.secondary.opacity(0.25), style: StrokeStyle(lineWidth: 1, dash: [5])))
            AMDOSSectionCard("関係者台帳", systemImage: "person.text.rectangle") {
                HStack(spacing: 12) {
                    AMDOSMetricTile(label: "全件", value: "\(counts.total)", detail: "名刺")
                    AMDOSMetricTile(label: "要確認", value: "\(counts.needsReview)", detail: "OCR・手入力", tint: AMDOSDesign.warning)
                    AMDOSMetricTile(label: "確認済み", value: "\(counts.confirmed)", detail: "PJ知識へ同期", tint: AMDOSDesign.success)
                }
                TextField("氏名、会社、メールで検索", text: $query)
                    .textFieldStyle(.roundedBorder)
                Picker("PJ", selection: $projectFilter) {
                    Text("すべてのPJ").tag("")
                    ForEach(projects) { project in Text(project.projectName).tag(project.projectId) }
                }
                .pickerStyle(.menu)
                Picker("状態", selection: $statusFilter) {
                    Text("すべて").tag("all")
                    Text("要確認").tag("review")
                    Text("確認済み").tag("confirmed")
                }
                .pickerStyle(.segmented)
                AMDOSStateNotice(state: state) { load() }
                ForEach(visibleCards) { card in
                    Button { select(card) } label: {
                        AMDOSLineItem(
                            title: card.fullName?.trimmedNonEmpty ?? "氏名未確認",
                            subtitle: ([card.companyName, card.department, card.jobTitle, card.email].compactMap { $0?.trimmedNonEmpty }).joined(separator: " · "),
                            status: businessCardStatusLabel(card.status)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            if selected != nil {
                AMDOSSectionCard("名刺を確認して同期", systemImage: "checkmark.circle") {
                    if let selected {
                        AMDOSParityBusinessCardImage(path: selected.imageURL)
                        if let originalFileName = selected.originalFileName?.trimmedNonEmpty {
                            Text(originalFileName)
                                .font(.caption)
                                .foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                    Grid(alignment: .leading, horizontalSpacing: 14, verticalSpacing: 9) {
                        GridRow { AMDOSTextField(title: "氏名 *", text: $fullName); AMDOSTextField(title: "氏名カナ", text: $fullNameKana) }
                        GridRow { AMDOSTextField(title: "会社", text: $companyName); AMDOSTextField(title: "部署", text: $department) }
                        GridRow { AMDOSTextField(title: "役職", text: $jobTitle); AMDOSTextField(title: "メール", text: $email) }
                        GridRow { AMDOSTextField(title: "電話", text: $phone); AMDOSTextField(title: "携帯", text: $mobile) }
                        GridRow { AMDOSTextField(title: "郵便番号", text: $postalCode); AMDOSTextField(title: "住所", text: $address) }
                        GridRow { AMDOSTextField(title: "Web", text: $website); AMDOSTextField(title: "会った日 YYYY-MM-DD", text: $metOn) }
                        GridRow { AMDOSTextField(title: "関係メモ", text: $relationshipNote, axis: .vertical) }
                    }
                    Text("紐づけるPJ（1件以上）").font(.caption)
                    ForEach(projects) { project in
                        Toggle(project.projectName, isOn: Binding(
                            get: { projectIDs.contains(project.projectId) },
                            set: { selected in
                                if selected { projectIDs.insert(project.projectId) }
                                else { projectIDs.remove(project.projectId) }
                            }
                        ))
                    }
                    if let selected {
                        if let error = selected.ocrError?.trimmedNonEmpty {
                            Label(error, systemImage: "exclamationmark.triangle")
                                .font(.caption)
                                .foregroundStyle(AMDOSDesign.warning)
                        }
                        if selected.ocrConfidence != nil {
                            Text("OCR信頼度 \(Int((selected.ocrConfidence ?? 0) * 100))%")
                                .font(.caption)
                                .foregroundStyle(AMDOSDesign.muted)
                        }
                        if let fieldConfidence = selected.fieldConfidence, !fieldConfidence.isEmpty {
                            let uncertain = fieldConfidence.filter { $0.value < 0.8 }.map(\.key).sorted().joined(separator: " / ")
                            Text("要確認フィールド：\(uncertain.nilIfEmpty ?? "なし")")
                                .font(.caption)
                                .foregroundStyle(AMDOSDesign.muted)
                        }
                        if let rawOcrText = selected.rawOcrText?.trimmedNonEmpty {
                            DisclosureGroup("OCRの読み取り原文") {
                                Text(rawOcrText).font(.caption).textSelection(.enabled)
                            }
                        }
                    }
                    Button(isSaving ? "同期中…" : "確認して同期") { confirm() }
                        .buttonStyle(.borderedProminent)
                        .disabled(isSaving || fullName.trimmedNonEmpty == nil || projectIDs.isEmpty)
                }
            }
            if let duplicateCount, duplicateCount > 0 {
                Label("似た名刺が \(duplicateCount) 件あります。重複を確認してね。", systemImage: "doc.on.doc")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.warning)
            }
            if let message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(message.hasPrefix("エラー") ? .red : AMDOSDesign.muted)
                    .textSelection(.enabled)
            }
        }
        .task { load() }
        .fileImporter(isPresented: $chooseFile, allowedContentTypes: [.image]) { result in
            do { selectBusinessCardFile(try result.get(), message: nil) }
            catch { message = "エラー: \(error.localizedDescription)" }
        }
    }
    private func load() {
        Task {
            state = .loading
            do {
                let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSParityBusinessCardsEnvelope.self, path: "/api/business-cards")
                guard response.ok != false else { throw AMDOSNetworkError.http(response.error ?? "名刺を読み込めなかった") }
                cards = response.cards
                projects = response.projects ?? []
                counts = response.counts ?? AMDOSParityBusinessCardCounts(total: cards.count, needsReview: cards.filter { $0.status != "confirmed" }.count, confirmed: cards.filter { $0.status == "confirmed" }.count)
                if selected == nil, let initial = cards.first(where: { $0.status != "confirmed" }) { select(initial) }
                state = cards.isEmpty ? .empty : .loaded
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    private func select(_ card: AMDOSParityBusinessCard) {
        selected = card
        fullName = card.fullName ?? ""; fullNameKana = card.fullNameKana ?? ""; companyName = card.companyName ?? ""; department = card.department ?? ""; jobTitle = card.jobTitle ?? ""; email = card.email ?? ""; phone = card.phone ?? ""; mobile = card.mobile ?? ""; postalCode = card.postalCode ?? ""; address = card.address ?? ""; website = card.website ?? ""; relationshipNote = card.relationshipNote ?? ""; metOn = card.metOn ?? jstDateString()
        projectIDs = Set(card.projects.map(\.projectId))
    }

    private func upload() {
        guard let file else { message = "エラー: 名刺画像を選んでね"; return }
        Task {
            isUploading = true
            defer { isUploading = false }
            do {
                let prepared = try prepareBusinessCardUploadFile(from: file)
                let data = try await AMDOSRESTClient.shared.uploadMultipart(
                    path: "/api/business-cards",
                    fields: [:],
                    files: [prepared]
                )
                let response = try JSONDecoder().decode(AMDOSParityBusinessCardMutationEnvelope.self, from: data)
                guard response.ok != false, let card = response.card else { throw AMDOSNetworkError.http(response.error ?? "名刺を登録できなかった") }
                cards = [card] + cards.filter { $0.id != card.id }
                counts = AMDOSParityBusinessCardCounts(total: counts.total + 1, needsReview: counts.needsReview + 1, confirmed: counts.confirmed)
                duplicateCount = response.duplicateCount
                select(card)
                message = response.warning?.trimmedNonEmpty == nil ? "読み取ったよ。内容とPJを確認してね" : "OCRできなかったので、見ながら入力してね"
                removeTemporaryPastedFile(file)
                self.file = nil
            } catch {
                message = "エラー: \(error.localizedDescription)"
            }
        }
    }

    private func confirm() {
        guard let card = selected, let name = fullName.trimmedNonEmpty, !projectIDs.isEmpty else { message = "エラー: 氏名と紐づけるPJを1件以上確認してね"; return }
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/business-cards/\(card.id)",
                    method: "PATCH",
                    body: AMDOSParityBusinessCardUpdate(fullName: name, fullNameKana: fullNameKana.trimmedNonEmpty, companyName: companyName.trimmedNonEmpty, department: department.trimmedNonEmpty, jobTitle: jobTitle.trimmedNonEmpty, email: email.trimmedNonEmpty, phone: phone.trimmedNonEmpty, mobile: mobile.trimmedNonEmpty, postalCode: postalCode.trimmedNonEmpty, address: address.trimmedNonEmpty, website: website.trimmedNonEmpty, relationshipNote: relationshipNote.trimmedNonEmpty, metOn: metOn.trimmedNonEmpty, projectIds: Array(projectIDs))
                )
                let response = try JSONDecoder().decode(AMDOSParityBusinessCardMutationEnvelope.self, from: data)
                guard response.ok != false, let updated = response.card else { throw AMDOSNetworkError.http(response.error ?? "名刺を確定できなかった") }
                let wasConfirmed = card.status == "confirmed"
                cards = cards.map { $0.id == updated.id ? updated : $0 }
                counts = AMDOSParityBusinessCardCounts(total: counts.total, needsReview: max(0, counts.needsReview - (wasConfirmed ? 0 : 1)), confirmed: counts.confirmed + (wasConfirmed ? 0 : 1))
                select(updated)
                message = "\(projectIDs.count) PJ のknowledgeに反映したよ"
            } catch {
                message = "エラー: \(error.localizedDescription)"
            }
        }
    }

    private func jstDateString() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.timeZone = TimeZone(identifier: "Asia/Tokyo")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: .now)
    }

    private func importDroppedBusinessCard(_ providers: [NSItemProvider]) -> Bool {
        guard let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) }) else { return false }
        provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
            let url = (item as? URL) ?? (item as? Data).flatMap { URL(dataRepresentation: $0, relativeTo: nil) }
            guard let url, UTType(filenameExtension: url.pathExtension)?.conforms(to: .image) == true else { return }
            DispatchQueue.main.async {
                selectBusinessCardFile(url, message: "ドロップした画像を選んだよ")
            }
        }
        return true
    }

    private func pasteBusinessCardImage() {
        guard let image = (NSPasteboard.general.readObjects(forClasses: [NSImage.self], options: nil) as? [NSImage])?.first,
              let tiff = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let data = bitmap.representation(using: .png, properties: [:]) else {
            message = "クリップボードに画像がないよ"
            return
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("amdos-business-card-paste-\(UUID().uuidString).png")
        do {
            try data.write(to: url, options: .atomic)
            selectBusinessCardFile(url, message: "クリップボードの画像を選んだよ")
        } catch {
            message = "エラー: クリップボード画像を準備できなかった（\(error.localizedDescription)）"
        }
    }

    private func removeTemporaryPastedFile(_ url: URL) {
        guard url.lastPathComponent.hasPrefix("amdos-business-card-paste-") else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private func selectBusinessCardFile(_ url: URL, message: String?) {
        if let current = file, current != url { removeTemporaryPastedFile(current) }
        file = url
        if let message { self.message = message }
    }
}

private indirect enum AMDOSParityJSON: Decodable, Sendable {
    case object([String: AMDOSParityJSON])
    case array([AMDOSParityJSON])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null; return }
        if let value = try? container.decode(Bool.self) { self = .bool(value); return }
        if let value = try? container.decode(Double.self) { self = .number(value); return }
        if let value = try? container.decode(String.self) { self = .string(value); return }
        if let value = try? container.decode([AMDOSParityJSON].self) { self = .array(value); return }
        if let value = try? container.decode([String: AMDOSParityJSON].self) { self = .object(value); return }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
    }
}

private extension AMDOSParityJSON {
    var object: [String: AMDOSParityJSON]? { if case let .object(value) = self { return value }; return nil }
    var array: [AMDOSParityJSON]? { if case let .array(value) = self { return value }; return nil }
    var string: String? { if case let .string(value) = self { return value }; return nil }
    var number: Double? { if case let .number(value) = self { return value }; return nil }
    var bool: Bool? { if case let .bool(value) = self { return value }; return nil }

    func value(for keys: String...) -> AMDOSParityJSON? {
        guard let object else { return nil }
        for key in keys {
            if let value = object[key] { return value }
        }
        return nil
    }

    var compactText: String {
        switch self {
        case .null:
            return "null"
        case .bool(let value):
            return value ? "true" : "false"
        case .number(let value):
            return value.rounded() == value ? String(Int(value)) : String(value)
        case .string(let value):
            return value
        case .array(let values):
            return values.map(\.compactText).joined(separator: "\n")
        case .object(let values):
            return values.keys.sorted().map { key in "\(key): \(values[key]?.compactText ?? "")" }.joined(separator: "\n")
        }
    }
}

private struct AMDOSParityMyMember: Codable, Sendable {
    let memberId: String
    let codeName: String
    let email: String?
    let isAdmin: Bool
    let isOfficer: Bool
    let excludeFromPayoutNotice: Bool

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case codeName = "code_name"
        case email
        case isAdmin = "is_admin"
        case isOfficer = "is_officer"
        case excludeFromPayoutNotice = "exclude_from_payout_notice"
    }

    var rewardAmountHidden: Bool {
        guard !isOfficer else { return false }
        return excludeFromPayoutNotice || ["ID006", "ID029"].contains(memberId) || ["りり", "あき"].contains(codeName.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    var payoutNotice: String? { isOfficer && excludeFromPayoutNotice ? "（役員のため支払対象外）" : nil }
}

private struct AMDOSParityMyProjectMember: Codable, Sendable {
    let projectId: String
    enum CodingKeys: String, CodingKey { case projectId = "project_id" }
}

private struct AMDOSParityMyProjectRow: Codable, Sendable {
    let projectId: String
    let projectName: String
    let status: String?
    let startYm: String?
    let endYm: String?
    let freezeFromYm: String?
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id", projectName = "project_name", status, startYm = "start_ym", endYm = "end_ym", freezeFromYm = "freeze_from_ym"
    }
}

private struct AMDOSParityMyBillingCycle: Decodable, Sendable {
    let projectId: String
    let ym: String
    let status: String?
    let memberAllocations: AMDOSParityJSON?
    let rewardSummary: AMDOSParityJSON?
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id", ym, status, memberAllocations = "member_allocations_json", rewardSummary = "reward_summary_json"
    }
}

private struct AMDOSParityMyPlan: Codable, Sendable {
    let planCycleId: String
    let projectId: String
    let status: String?
    let periodStartYm: String?
    let periodEndYm: String?
    enum CodingKeys: String, CodingKey { case planCycleId = "plan_cycle_id", projectId = "project_id", status, periodStartYm = "period_start_ym", periodEndYm = "period_end_ym" }
}

private struct AMDOSParityMyMilestoneRow: Codable, Sendable {
    let planCycleId: String
    let milestoneId: String
    let title: String?
    let points: Double?
    let tag: String?
    enum CodingKeys: String, CodingKey { case planCycleId = "plan_cycle_id", milestoneId = "milestone_id", title, points, tag }
}

private struct AMDOSParityMyProgressRow: Codable, Sendable {
    let milestoneKey: String
    let ym: String
    let progressPct: Double?
    let source: String?
    let note: String?
    enum CodingKeys: String, CodingKey { case milestoneKey = "milestone_key", ym, progressPct = "progress_pct", source, note }
}

private struct AMDOSParityMyMemberMSActivity: Codable, Sendable {
    let milestoneId: String
    let ym: String
    let narrative: String?
    let learnedAddendum: String?
    enum CodingKeys: String, CodingKey { case milestoneId = "milestone_id", ym, narrative, learnedAddendum = "learned_addendum" }
}

private struct AMDOSParityMyMonthlyReport: Codable, Sendable {
    let projectId: String
    let ym: String
    let sectionMembers: String?
    enum CodingKeys: String, CodingKey { case projectId = "project_id", ym, sectionMembers = "section_members" }
}

private struct AMDOSParityMyWeeklyActivity: Decodable, Identifiable, Sendable {
    let id: String
    let projectId: String?
    let source: String
    let title: String?
    let contentPreview: String?
    let itemDate: String?
    let rawMetadata: AMDOSParityJSON?
    enum CodingKeys: String, CodingKey { case id, projectId = "project_id", source, title, contentPreview = "content_preview", itemDate = "item_date", rawMetadata = "raw_metadata" }
}

private struct AMDOSParityMyMilestone: Identifiable, Sendable {
    let id: String
    let title: String
    let points: Double
    let progressPct: Double
    let monthlyProgressPct: Double
    let source: String?
    let note: String?
    let narrative: String?
    let tag: String
}

private struct AMDOSParityMyProject: Identifiable, Sendable {
    let id: String
    let name: String
    let billingStatus: String
    let allocationStatus: String
    let allocation: Double?
    let reward: Double?
    let earnedPoints: Double?
    let rewardEligible: Bool
    let exclusionReasons: [String]
    let sectionActivity: String?
    let milestones: [AMDOSParityMyMilestone]
}

private struct AMDOSParityMyMonth: Identifiable, Sendable {
    let id: String
    let isCurrent: Bool
    let projects: [AMDOSParityMyProject]
}

private struct AMDOSParityEmptyBody: Encodable, Sendable {}

@MainActor
private final class AMDOSParityMypageStore: ObservableObject {
    @Published var member: AMDOSParityMyMember?
    @Published var months: [AMDOSParityMyMonth] = []
    @Published var weeklyActivities: [(id: String, projectName: String, source: String, title: String, preview: String, date: String?)] = []
    @Published var agreement: AMDOSAgreementResponse?
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?

    func load(email: String?, requestedMemberId: String? = nil, isAdmin: Bool = false) async {
        guard let email = email?.trimmedNonEmpty else {
            state = .failed("マイページを読むためのログイン情報がないよ")
            return
        }
        state = .loading
        message = nil
        do {
            var members = try await AMDOSRESTClient.shared.fetchTable(
                AMDOSParityMyMember.self,
                table: "members",
                select: "member_id,code_name,email,is_admin,is_officer,exclude_from_payout_notice",
                filters: ["email": "eq.\(email.lowercased())"],
                limit: 1
            )
            if members.isEmpty {
                members = try await AMDOSRESTClient.shared.fetchTable(
                    AMDOSParityMyMember.self,
                    table: "members",
                    select: "member_id,code_name,email,is_admin,is_officer,exclude_from_payout_notice",
                    filters: ["email": "ilike.\(email)"],
                    limit: 1
                )
            }
            guard var member = members.first else { throw AMDOSNetworkError.notFound }
            if let requestedMemberId = requestedMemberId?.trimmedNonEmpty, requestedMemberId != member.memberId {
                guard isAdmin else { throw AMDOSNetworkError.http("他メンバーのマイページ表示はadminだけに限定されています") }
                let requested = try await AMDOSRESTClient.shared.fetchTable(
                    AMDOSParityMyMember.self,
                    table: "members",
                    select: "member_id,code_name,email,is_admin,is_officer,exclude_from_payout_notice",
                    filters: ["member_id": "eq.\(requestedMemberId)"],
                    limit: 1
                )
                guard let resolved = requested.first else { throw AMDOSNetworkError.notFound }
                member = resolved
            }
            self.member = member
            agreement = try? await AMDOSRESTClient.shared.fetchPWA(AMDOSAgreementResponse.self, path: "/api/monthly-work-agreement", query: ["memberId": member.memberId])
            let memberId = member.memberId

            let yms = amdOSParityTargetYMs()
            let previousYMs = yms.map(amdOSParityPreviousYM)
            let week = amdOSParityCurrentWeek()
            async let projectMemberRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityMyProjectMember.self,
                table: "project_members",
                select: "project_id",
                filters: ["member_id": "eq.\(memberId)", "is_active": "eq.true"]
            )
            async let weeklyRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityMyWeeklyActivity.self,
                table: "member_activities",
                select: "id,project_id,source,title,content_preview,item_date,raw_metadata",
                filters: ["member_id": "eq.\(memberId)", "source": "eq.member_weekly", "item_date": "gte.\(week.startISO)"],
                order: "item_date.desc",
                limit: 60
            )
            let memberProjectRows = try await projectMemberRows
            let rawWeeklyRows = (try await weeklyRows).filter { row in
                guard let itemDate = row.itemDate else { return false }
                return itemDate < week.endISO
            }
            let memberProjectIDs = memberProjectRows.map(\.projectId)
            let weeklyProjectIDs = rawWeeklyRows.compactMap(\.projectId)
            let projectIDs = Array(Set(memberProjectIDs + weeklyProjectIDs))
            let projectNameMap = try await loadData(
                member: member,
                projectIDs: projectIDs,
                memberProjectIDs: Set(memberProjectIDs),
                yms: yms,
                previousYMs: previousYMs
            )
            weeklyActivities = rawWeeklyRows.compactMap { row in
                guard let projectID = row.projectId, amdOSParityDisplayableWeeklyActivity(row) else { return nil }
                let display = amdOSParityWeeklyDisplay(row)
                return (row.id, projectNameMap[projectID] ?? projectID, display.source, display.title, display.preview, row.itemDate)
            }
            state = .loaded
        } catch {
            message = error.localizedDescription
            state = .failed(message ?? "マイページの読み込みに失敗したよ")
        }
    }

    private func loadData(
        member: AMDOSParityMyMember,
        projectIDs: [String],
        memberProjectIDs: Set<String>,
        yms: [String],
        previousYMs: [String]
    ) async throws -> [String: String] {
        guard !projectIDs.isEmpty else {
            months = yms.map { AMDOSParityMyMonth(id: $0, isCurrent: $0 == yms.first, projects: []) }
            return [:]
        }
        let projectFilter = "in.(\(projectIDs.joined(separator: ",")))"
        let ymFilter = "in.(\(yms.joined(separator: ",")))"
        async let projectsRequest = AMDOSRESTClient.shared.fetchTable(
            AMDOSParityMyProjectRow.self,
            table: "projects",
            select: "project_id,project_name,status,start_ym,end_ym,freeze_from_ym,project_type,project_category",
            filters: ["project_id": projectFilter]
        )
        async let cyclesRequest = AMDOSRESTClient.shared.fetchTable(
            AMDOSParityMyBillingCycle.self,
            table: "billing_cycles",
            select: "*",
            filters: ["project_id": projectFilter, "ym": ymFilter]
        )
        async let plansRequest = AMDOSRESTClient.shared.fetchTable(
            AMDOSParityMyPlan.self,
            table: "value_plan_cycles",
            select: "plan_cycle_id,project_id,status,total_points,period_start_ym,period_end_ym",
            filters: ["project_id": projectFilter, "status": "in.(active,confirmed,fixed,draft)"]
        )
        async let reportsRequest = AMDOSRESTClient.shared.fetchTable(
            AMDOSParityMyMonthlyReport.self,
            table: "monthly_reports",
            select: "project_id,ym,section_members",
            filters: ["project_id": projectFilter, "ym": ymFilter]
        )
        let projects = try await projectsRequest
        let cycles = try await cyclesRequest
        let plans = try await plansRequest
        let reports = try await reportsRequest
        let planIDs = plans.map(\.planCycleId)
        let milestoneFilter = "in.(\(planIDs.joined(separator: ",")))"
        let milestones = planIDs.isEmpty ? [] : try await AMDOSRESTClient.shared.fetchTable(
            AMDOSParityMyMilestoneRow.self,
            table: "value_milestones",
            select: "plan_cycle_id,milestone_id,title,points,tag,is_active",
            filters: ["plan_cycle_id": milestoneFilter, "is_active": "eq.true"]
        )
        let milestoneIDs = milestones.map(\.milestoneId)
        let progressYMs = Array(Set(yms + previousYMs))
        let progressFilter = "in.(\(milestoneIDs.joined(separator: ",")))"
        let progress = milestoneIDs.isEmpty ? [] : try await AMDOSRESTClient.shared.fetchTable(
            AMDOSParityMyProgressRow.self,
            table: "milestone_monthly_progress",
            select: "milestone_key,ym,progress_pct,source,note",
            filters: ["milestone_key": progressFilter, "ym": "in.(\(progressYMs.joined(separator: ",")))"]
        )
        let memberActivities = milestoneIDs.isEmpty ? [] : try await AMDOSRESTClient.shared.fetchTable(
            AMDOSParityMyMemberMSActivity.self,
            table: "member_ms_activities",
            select: "milestone_id,ym,narrative,learned_addendum",
            filters: ["member_id": "eq.\(member.memberId)", "milestone_id": progressFilter, "ym": ymFilter]
        )

        let projectNameMap = projects.reduce(into: [String: String]()) { result, project in result[project.projectId] = project.projectName }
        let cyclesByKey = Dictionary(uniqueKeysWithValues: cycles.map { ("\($0.projectId)_\($0.ym)", $0) })
        let reportsByKey = Dictionary(uniqueKeysWithValues: reports.map { ("\($0.projectId)_\($0.ym)", $0) })
        let plansByProject = Dictionary(grouping: plans, by: \.projectId)
        let milestonesByPlan = Dictionary(grouping: milestones, by: \.planCycleId)
        let progressByMilestone = Dictionary(grouping: progress, by: \.milestoneKey)
        let activityByKey = Dictionary(uniqueKeysWithValues: memberActivities.map { ("\($0.milestoneId)_\($0.ym)", $0) })
        let activeProjects = projects.filter { project in
            memberProjectIDs.contains(project.projectId) && (project.status ?? "").lowercased() != "lost"
        }

        func latestProgress(_ milestoneID: String, through ym: String) -> AMDOSParityMyProgressRow? {
            progressByMilestone[milestoneID]?.filter { $0.ym <= ym }.sorted { $0.ym > $1.ym }.first
        }
        func isIncluded(_ project: AMDOSParityMyProjectRow, ym: String) -> Bool {
            if (project.status ?? "").lowercased() == "frozen" { return false }
            if let freeze = project.freezeFromYm, ym >= freeze { return false }
            if let start = project.startYm, ym < start { return false }
            if let end = project.endYm, ym > end { return false }
            return true
        }
        func jsonNumber(_ value: AMDOSParityJSON?) -> Double? { value?.number ?? value?.string.flatMap(Double.init) }
        func jsonString(_ value: AMDOSParityJSON?) -> String? { value?.string }
        func rewardMember(from cycle: AMDOSParityMyBillingCycle?) -> [String: AMDOSParityJSON]? {
            guard let members = cycle?.rewardSummary?.value(for: "members")?.array else { return nil }
            return members.compactMap(\.object).first { object in
                let id = jsonString(object["memberId"]) ?? jsonString(object["member_id"])
                return id == member.memberId
            }
        }

        months = yms.map { ym in
            let monthlyProjects = activeProjects.filter { isIncluded($0, ym: ym) }.map { project -> AMDOSParityMyProject in
                let cycle = cyclesByKey["\(project.projectId)_\(ym)"]
                let allocationObject = cycle?.memberAllocations?.object
                let allocation = jsonNumber(allocationObject?[member.memberId])
                let reward = rewardMember(from: cycle)
                let payout = jsonNumber(reward?["totalPay"]) ?? jsonNumber(reward?["total_pay"])
                let companyReserve = jsonNumber(reward?["companyReserveYen"]) ?? jsonNumber(reward?["company_reserve_yen"]) ?? jsonNumber(reward?["officerReserveYen"]) ?? jsonNumber(reward?["officer_reserve_yen"])
                let basePay = jsonNumber(reward?["basePay"]) ?? jsonNumber(reward?["base_pay"])
                let grossDue = jsonNumber(reward?["grossDueYen"]) ?? jsonNumber(reward?["gross_due_yen"])
                let displayReward = member.isOfficer ? (companyReserve ?? basePay ?? grossDue ?? payout) : payout
                let plansForProject = plansByProject[project.projectId] ?? []
                let plan = plansForProject.first { plan in
                    guard let start = plan.periodStartYm, let end = plan.periodEndYm else { return false }
                    return ym >= start && ym <= end
                } ?? plansForProject.first
                let previous = amdOSParityPreviousYM(ym)
                let projectMilestones = (plan.map { milestonesByPlan[$0.planCycleId] ?? [] } ?? []).compactMap { milestone -> AMDOSParityMyMilestone? in
                    let current = latestProgress(milestone.milestoneId, through: ym)
                    let before = latestProgress(milestone.milestoneId, through: previous)
                    let currentPct = current?.progressPct ?? 0
                    let previousPct = before?.progressPct ?? 0
                    let monthlyPct = max(0, currentPct - previousPct)
                    let activity = activityByKey["\(milestone.milestoneId)_\(ym)"]
                    let narrative = activity?.narrative?.trimmedNonEmpty ?? activity?.learnedAddendum?.trimmedNonEmpty
                    guard monthlyPct > 0.01 || narrative != nil else { return nil }
                    return AMDOSParityMyMilestone(id: milestone.milestoneId, title: milestone.title ?? milestone.milestoneId, points: milestone.points ?? 0, progressPct: currentPct, monthlyProgressPct: monthlyPct, source: current?.source, note: current?.note, narrative: narrative, tag: milestone.tag ?? "normal")
                }.sorted { $0.id < $1.id }
                let reportActivity = reportsByKey["\(project.projectId)_\(ym)"]?.sectionMembers.flatMap { amdOSParityMemberSection($0, codeName: member.codeName) }
                let rewardReasons: [String] = []
                return AMDOSParityMyProject(id: project.projectId, name: project.projectName, billingStatus: cycle?.status ?? "not_started", allocationStatus: amdOSParityAllocationStatus(cycle?.status), allocation: allocation, reward: displayReward ?? allocation, earnedPoints: jsonNumber(reward?["earnedPt"]) ?? jsonNumber(reward?["earned_pt"]), rewardEligible: rewardReasons.isEmpty, exclusionReasons: rewardReasons, sectionActivity: reportActivity, milestones: projectMilestones)
            }.sorted { ($0.reward ?? 0) > ($1.reward ?? 0) }
            return AMDOSParityMyMonth(id: ym, isCurrent: ym == yms.first, projects: monthlyProjects)
        }
        return projectNameMap
    }
}

private func amdOSParityTargetYMs() -> [String] {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Tokyo") ?? .current
    let now = Date()
    var components = calendar.dateComponents([.year, .month], from: now)
    var result: [String] = []
    for _ in 0...6 {
        result.append(String(format: "%04d%02d", components.year ?? 0, components.month ?? 0))
        components.month = (components.month ?? 1) - 1
        if (components.month ?? 1) < 1 { components.month = 12; components.year = (components.year ?? 0) - 1 }
    }
    return result
}

private func amdOSParityPreviousYM(_ ym: String) -> String {
    guard ym.count == 6, let year = Int(ym.prefix(4)), let month = Int(ym.suffix(2)) else { return ym }
    return month == 1 ? "\(year - 1)12" : String(format: "%04d%02d", year, month - 1)
}

private func amdOSParityCurrentWeek() -> (startISO: String, endISO: String, startKey: String, endKey: String) {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Tokyo") ?? .current
    let today = calendar.startOfDay(for: Date())
    let weekday = calendar.component(.weekday, from: today)
    let mondayOffset = (weekday + 5) % 7
    let start = calendar.date(byAdding: .day, value: -mondayOffset, to: today) ?? today
    let end = calendar.date(byAdding: .day, value: 7, to: start) ?? today
    let formatter = ISO8601DateFormatter()
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.formatOptions = [.withInternetDateTime]
    let keyFormatter = DateFormatter()
    keyFormatter.calendar = calendar
    keyFormatter.timeZone = calendar.timeZone
    keyFormatter.dateFormat = "yyyy-MM-dd"
    let lastDay = calendar.date(byAdding: .day, value: -1, to: end) ?? end
    return (formatter.string(from: start), formatter.string(from: end), keyFormatter.string(from: start), keyFormatter.string(from: lastDay))
}

private func amdOSParityAllocationStatus(_ status: String?) -> String {
    switch status {
    case "allocation_confirmed", "budget_confirmed": return "確定"
    case "reported": return "承認待ち"
    default: return "未設定"
    }
}

private func amdOSParityMemberSection(_ text: String, codeName: String) -> String? {
    guard !codeName.isEmpty else { return nil }
    var inside = false
    var result: [String] = []
    for line in text.components(separatedBy: "\n") {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("##") {
            if inside { break }
            inside = trimmed.localizedCaseInsensitiveContains(codeName)
        } else if inside { result.append(line) }
    }
    return result.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines).trimmedNonEmpty
}

private func amdOSParityDisplayableWeeklyActivity(_ row: AMDOSParityMyWeeklyActivity) -> Bool {
    let sourceKind = row.rawMetadata?.value(for: "source_kind")?.string ?? row.source
    let subkind = row.rawMetadata?.value(for: "source_subkind")?.string
    return sourceKind != "gmail" || subkind == "sent" || subkind == "draft"
}

private func amdOSParityWeeklyDisplay(_ row: AMDOSParityMyWeeklyActivity) -> (source: String, title: String, preview: String) {
    let metadata = row.rawMetadata
    let rawSource = metadata?.value(for: "source_kind")?.string ?? row.source
    let subkind = metadata?.value(for: "source_subkind")?.string ?? ""
    let source = rawSource == "source_cache" ? (subkind.isEmpty ? rawSource : subkind) : rawSource
    let rawTitle = row.title?.trimmedNonEmpty ?? "今週の活動"
    let cleanTitle = rawTitle.replacingOccurrences(of: "^(メール|予定|gmail|calendar):\\s*", with: "", options: .regularExpression).replacingOccurrences(of: "^Re:\\s*", with: "", options: .regularExpression)
    let title: String
    if rawSource == "gmail" { title = "\(subkind == "draft" ? "返信ドラフトを作成" : "メールを送信"): \(cleanTitle)" }
    else if rawSource == "calendar" { title = "\(subkind == "organizer" ? "予定を主催" : "予定に参加"): \(cleanTitle)" }
    else { title = cleanTitle }
    let preview = (row.contentPreview ?? "").replacingOccurrences(of: "<[^>]*>", with: " ", options: .regularExpression).replacingOccurrences(of: "https?://\\S+", with: "", options: .regularExpression).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    return (source, title, String(preview.prefix(140)))
}

struct AMDOSParityMypageView: View {
    let onSelectProject: (String) -> Void
    let onOpenAgreement: () -> Void
    let initialMemberId: String?
    @EnvironmentObject private var auth: AMDOSAuthStore
    @StateObject private var store = AMDOSParityMypageStore()
    @State private var expandedMonths: Set<String> = []
    @State private var refreshing = false
    @State private var refreshMessage: String?

    private var currentMonth: AMDOSParityMyMonth? { store.months.first(where: \.isCurrent) ?? store.months.first }
    private var currentTotal: Double { currentMonth?.projects.filter(\.rewardEligible).compactMap(\.reward).reduce(0, +) ?? 0 }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "MY PAGE", title: store.member?.codeName ?? "マイページ", subtitle: "PWAと同じメンバー認可で、当月報酬・6か月の担当PJ・MS進捗・今週の活動を確認") {
            AMDOSStateNotice(state: store.state) { Task { await store.load(email: auth.email, requestedMemberId: initialMemberId, isAdmin: auth.isAdmin) } }
            if let member = store.member {
                AMDOSSectionCard("アカウント", systemImage: "person.crop.circle") {
                    LabeledContent("表示名", value: member.codeName)
                    LabeledContent("ログイン", value: member.email ?? auth.email ?? "—")
                    if let notice = member.payoutNotice { Text(notice).font(.caption).foregroundStyle(AMDOSDesign.warning) }
                }
                AMDOSSectionCard("当月報酬", systemImage: "yensign.circle.fill") {
                    HStack { AMDOSMetricTile(label: "合計", value: amdOSParityRewardText(currentTotal, hidden: member.rewardAmountHidden), detail: currentMonth.map { "\($0.id.prefix(4))年\(Int($0.id.suffix(2)) ?? 0)月" } ?? "当月"); AMDOSMetricTile(label: "担当PJ", value: "\(currentMonth?.projects.count ?? 0)", detail: "PWAの当月表示") }
                    ForEach(currentMonth?.projects ?? []) { project in
                        HStack { Text(project.name); Spacer(); Text(amdOSParityRewardText(project.reward, hidden: member.rewardAmountHidden)).fontWeight(.semibold); AMDOSStatusBadge(text: project.billingStatus) }
                    }
                }
                if let agreement = store.agreement?.bundle {
                    AMDOSSectionCard("今月の遂行内容・予定報酬", systemImage: "checkmark.seal") {
                        HStack { Text(amdOSParityAgreementStatus(agreement.status)).font(.headline); Spacer(); Text("\(agreement.snapshot.totals.projectCount) PJ · \(amdOSParityRewardText(agreement.snapshot.totals.expectedRewardYen, hidden: member.rewardAmountHidden))") }
                        if agreement.status == "needs_reagreement" { Text("前回合意後に条件が変わっているよ。詳細を確認してね。").font(.caption).foregroundStyle(AMDOSDesign.warning) }
                        Button("月初合意の詳細を開く") { onOpenAgreement() }.buttonStyle(.bordered)
                    }
                }
                AMDOSSectionCard("今週やったこと", systemImage: "bolt.fill") {
                    HStack { VStack(alignment: .leading) { Text("This Week").font(.caption.weight(.semibold)); Text("\(store.weeklyActivities.count) 件 · PWAの週次抽出結果").font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); Button(refreshing ? "抽出中…" : "いますぐ抽出") { refreshWeek() }.disabled(refreshing) }
                    if let refreshMessage { Text(refreshMessage).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    if store.weeklyActivities.isEmpty { Text("今週分のGmail / Calendar由来の活動はまだないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    ForEach(store.weeklyActivities.prefix(8), id: \.id) { item in
                        VStack(alignment: .leading, spacing: 4) { HStack { AMDOSStatusBadge(text: item.source); Text(item.projectName).font(.caption).foregroundStyle(AMDOSDesign.muted); Spacer(); Text(item.date ?? "").font(.caption2).foregroundStyle(AMDOSDesign.muted) }; Text(item.title).font(.subheadline.weight(.medium)); if !item.preview.isEmpty { Text(item.preview).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(3) } }.padding(.vertical, 4)
                    }
                    if store.weeklyActivities.count > 8 { Text("ほか \(store.weeklyActivities.count - 8) 件").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                }
                ForEach(store.months) { month in
                    let isExpanded = month.isCurrent || expandedMonths.contains(month.id)
                    AMDOSSectionCard("\(month.id.prefix(4))年\(Int(month.id.suffix(2)) ?? 0)月\(month.isCurrent ? " · 当月" : "")", systemImage: "calendar") {
                        HStack { Text("報酬合計").font(.headline); Spacer(); Text(amdOSParityRewardText(month.projects.filter(\.rewardEligible).compactMap(\.reward).reduce(0, +), hidden: member.rewardAmountHidden)).font(.headline) }
                        Button(isExpanded ? "折りたたむ" : "PJとMSを表示") { if isExpanded { expandedMonths.remove(month.id) } else { expandedMonths.insert(month.id) } }.buttonStyle(.bordered)
                        if isExpanded {
                            if month.projects.isEmpty { Text("参加PJなし").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                            ForEach(month.projects) { project in amdOSParityProjectCard(project, rewardHidden: member.rewardAmountHidden) }
                        }
                    }
                }
            }
        }.task { await store.load(email: auth.email, requestedMemberId: initialMemberId, isAdmin: auth.isAdmin); if let current = store.months.first(where: \.isCurrent) { expandedMonths.insert(current.id) } }
    }

    @ViewBuilder private func amdOSParityProjectCard(_ project: AMDOSParityMyProject, rewardHidden: Bool) -> some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 9) {
                HStack { VStack(alignment: .leading) { Button(project.name) { onSelectProject(project.id) }.buttonStyle(.link); AMDOSStatusBadge(text: project.allocationStatus) }; Spacer(); Text(amdOSParityRewardText(project.reward, hidden: rewardHidden)).font(.title3.bold()) }
                HStack { Text(project.rewardEligible ? "今月想定" : "確認保留中"); Spacer(); Text(project.earnedPoints.map { "\($0, specifier: "%.1f")pt" } ?? "進捗点未確定").font(.caption).foregroundStyle(AMDOSDesign.muted); Text(project.billingStatus).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                if !project.exclusionReasons.isEmpty { Text(project.exclusionReasons.joined(separator: "、")).font(.caption).foregroundStyle(AMDOSDesign.warning) }
                if !project.milestones.isEmpty {
                    ForEach(project.milestones) { milestone in
                        VStack(alignment: .leading, spacing: 4) { HStack { Text(milestone.title).font(.caption.weight(.medium)); Spacer(); Text("\(Int(milestone.progressPct.rounded()))% · \(Int(milestone.points))pt").font(.caption2).foregroundStyle(AMDOSDesign.muted) }; ProgressView(value: min(100, max(0, milestone.progressPct)) / 100); if let note = milestone.note?.trimmedNonEmpty ?? milestone.narrative?.trimmedNonEmpty { Text(note).font(.caption2).foregroundStyle(AMDOSDesign.muted) } }
                    }
                }
                if let sectionActivity = project.sectionActivity { Text("今月の活動\n\(sectionActivity)").font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled) }
            }
        }
    }

    private func refreshWeek() {
        guard !refreshing else { return }
        refreshing = true; refreshMessage = nil
        Task {
            do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/mypage/weekly-activities/refresh", body: AMDOSParityEmptyBody()); refreshMessage = "週次活動を再抽出したよ"; await store.load(email: auth.email, requestedMemberId: initialMemberId, isAdmin: auth.isAdmin) }
            catch { refreshMessage = error.localizedDescription }
            refreshing = false
        }
    }
}

private func amdOSParityRewardText(_ value: Double?, hidden: Bool) -> String {
    if hidden { return "ー" }
    guard let value else { return "未確定" }
    let formatter = NumberFormatter(); formatter.numberStyle = .decimal; formatter.maximumFractionDigits = 0
    return "¥\(formatter.string(from: NSNumber(value: value.rounded())) ?? String(Int(value.rounded())))"
}

private func amdOSParityAgreementStatus(_ status: String) -> String {
    switch status { case "agreed": return "合意済み"; case "needs_reagreement": return "条件更新あり"; case "not_required": return "対象外"; default: return "未合意" }
}

private struct AMDOSParityReportPrintEnvelope: Decodable, Sendable {
    let ok: Bool?
    let generatedAt: String?
    let project: AMDOSParityReportProject
    let ym: String
    let nextYm: String?
    let report: AMDOSParityReportBody?
    let monthlyNote: String?
    let contract: AMDOSParityReportContract?
    let milestones: [AMDOSParityReportMilestone]
    let responsibilities: [AMDOSParityReportResponsibility]
    let overallPct: Double?
    let expectedPct: Double?
    let rag: AMDOSParityReportRAG?
    let planCycle: AMDOSParityReportPlan?
    let meetings: [AMDOSParityReportMeeting]
    let upcomingMeetings: [AMDOSParityReportMeeting]
    let signals: [AMDOSParityReportSignal]
    let achievementSignals: [AMDOSParityReportSignal]
    let riskSignals: [AMDOSParityReportSignal]
    let pivotSignals: [AMDOSParityReportSignal]
    let grants: [AMDOSParityReportGrant]
    let media: [AMDOSParityReportMedia]
    let xrlLog: [AMDOSParityReportXRL]
    let currentXrl: AMDOSParityReportXRL?
    let previousXrl: AMDOSParityReportXRL?
    let members: [AMDOSParityReportMember]
    let founding: [AMDOSParityReportFounding]
    let actionItems: [AMDOSParityReportAction]
    let nextMonthActions: [AMDOSParityReportAction]
    let reimbursements: [AMDOSParityReportReimbursement]
    let reimburseTotal: Double?
    let billing: AMDOSParityReportBilling?
    let attachments: AMDOSParityReportAttachments?
    let sourceCheck: AMDOSParityJSON?

    enum CodingKeys: String, CodingKey { case ok, generatedAt, project, ym, nextYm, report, monthlyNote, contract, milestones, responsibilities, overallPct, expectedPct, rag, planCycle, meetings, upcomingMeetings, signals, achievementSignals, riskSignals, pivotSignals, grants, media, xrlLog, currentXrl, previousXrl, members, founding, actionItems, nextMonthActions, reimbursements, reimburseTotal, billing, attachments, sourceCheck }
}

private struct AMDOSParityReportProject: Decodable, Sendable { let projectId: String; let projectName: String; let clientName: String?; let status: String?; let startYm: String?; let endYm: String?; let feeType: String?; let feeAmount: Double? }
private struct AMDOSParityReportBody: Decodable, Sendable { let status: String?; let draftContent: String?; let finalContent: String?; let generatedAt: String?; let fixedAt: String?; let confirmedBy: String?; let plReviewRequestedAt: String?; let plReviewRequestedBy: String? }
private struct AMDOSParityReportContract: Decodable, Sendable { let contractId: String?; let title: String?; let counterparty: String?; let contractType: String?; let contractNo: String?; let quoteNo: String?; let bidNo: String?; let amdContractNo: String?; let periodStart: String?; let periodEnd: String?; let contractValueYen: Double? }
private struct AMDOSParityReportMilestone: Decodable, Sendable { let milestoneId: String?; let title: String?; let points: Double?; let tag: String?; let periodStartYm: String?; let targetYm: String?; let successCriteria: String?; let progressPct: Double?; let prevProgressPct: Double?; let deltaPct: Double?; let note: String?; let source: String? }
private struct AMDOSParityReportResponsibility: Decodable, Sendable { let milestoneId: String?; let memberId: String?; let codeName: String?; let role: String?; let share: Double?; let taskDescription: String? }
private struct AMDOSParityReportRAG: Decodable, Sendable { let schedule: String?; let cost: String?; let risk: String? }
private struct AMDOSParityReportPlan: Decodable, Sendable { let planCycleId: String?; let status: String?; let periodStartYm: String?; let periodEndYm: String?; let totalPoints: Double?; let budgetYen: Double? }
private struct AMDOSParityReportMeeting: Decodable, Sendable { let meetingId: String?; let meetingDate: String?; let title: String?; let summaryShort: String?; let narrativeMd: String?; let decided: [AMDOSParityJSON]?; let nextActions: [AMDOSParityJSON]?; let risks: [AMDOSParityJSON]?; let notionUrl: String?; let sourceKinds: String? }
private struct AMDOSParityReportSignal: Decodable, Sendable { let signalId: String?; let signalType: String?; let title: String?; let summary: String?; let impactLevel: String?; let decisionState: String?; let signalDate: String?; let polarity: String?; let scoreImpactSummary: String? }
private struct AMDOSParityReportGrant: Decodable, Sendable { let id: String?; let grantName: String?; let agency: String?; let grantType: String?; let amountYen: Double?; let disbursedYen: Double?; let periodStartYm: String?; let periodEndYm: String?; let adoptedDate: String?; let status: String? }
private struct AMDOSParityReportMedia: Decodable, Sendable { let id: String?; let occurredOn: String?; let title: String?; let mediaName: String?; let kind: String?; let sourceUrl: String? }
private struct AMDOSParityReportXRL: Decodable, Sendable { let id: String?; let observedAt: String?; let trl: Double?; let brl: Double?; let grl: Double?; let srl: Double?; let hrl: Double?; let bottleneck: String?; let milestoneLabel: String?; let sourceNote: String? }
private struct AMDOSParityReportMember: Decodable, Sendable { let memberId: String?; let codeName: String?; let role: String?; let roleLabel: String?; let isPm: Bool?; let isPl: Bool?; let isCloser: Bool?; let joinYm: String?; let leaveYm: String? }
private struct AMDOSParityReportFounding: Decodable, Sendable { let personName: String?; let affiliation: String?; let role: String?; let roleLabelJp: String?; let category: String? }
private struct AMDOSParityReportAction: Decodable, Sendable { let actionId: String?; let scope: String?; let category: String?; let title: String?; let assignee: String?; let dueAt: String?; let status: String?; let priority: String? }
private struct AMDOSParityReportReimbursement: Decodable, Sendable { let reimbursementId: String?; let date: String?; let category: String?; let amount: Double?; let taxRate: Double?; let description: String?; let member: String?; let status: String? }
private struct AMDOSParityReportBilling: Decodable, Sendable { let status: String?; let budgetYen: Double?; let budgetReportedAmount: Double?; let extraRevenueJson: AMDOSParityJSON?; let extraBudgetYen: Double?; let invoiceSentAt: String?; let paymentConfirmedAt: String? }
private struct AMDOSParityReportAttachments: Decodable, Sendable { let meetingAssets: [AMDOSParityReportAttachment]; let projectDocs: [AMDOSParityReportAttachment]; let contractDocs: [AMDOSParityReportAttachment] }
private struct AMDOSParityReportAttachment: Decodable, Sendable { let meetingId: String?; let documentId: String?; let id: String?; let fileName: String?; let webViewLink: String?; let mimeType: String?; let uploadedAt: String?; let createdAt: String?; let receivedAt: String?; let documentKind: String? }

struct AMDOSParityProjectReportView: View {
    let projectId: String?
    let initialYM: String?
    @EnvironmentObject private var auth: AMDOSAuthStore
    @State private var data: AMDOSParityReportPrintEnvelope?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var ym: String
    @State private var feedback = ""
    @State private var message: String?
    @State private var busyAction: String?

    init(projectId: String?, initialYM: String? = nil) {
        self.projectId = projectId
        self.initialYM = initialYM
        _ym = State(initialValue: initialYM?.count == 6 ? initialYM! : amdOSParityReportCurrentYM())
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "MONTHLY REPORT / PRINT", title: data?.project.projectName ?? "提出用月次報告", subtitle: "PWAのA-J集約APIから、本文・進捗・会議・体制・財務・添付を同じ月次単位で確認") {
            if !auth.isAdmin { AMDOSPermissionDeniedView(message: "月次報告の生成・確定・提出用印刷はPWAと同じadmin権限が必要だよ") }
            else {
                HStack { AMDOSTextField(title: "対象月 YYYYMM", text: $ym); Button("読み込み") { load() }; Button("印刷 / PDF") { printReport() }.disabled(data == nil) }
                if let message { Text(message).font(.caption).foregroundStyle(message.hasPrefix("保存") || message.hasPrefix("生成") ? AMDOSDesign.success : AMDOSDesign.warning).textSelection(.enabled) }
                AMDOSStateNotice(state: state) { load() }
                if let report = data?.report {
                    reportControls(report: report)
                    AMDOSSectionCard("本文", systemImage: "doc.richtext") { Text(report.finalContent?.trimmedNonEmpty ?? report.draftContent?.trimmedNonEmpty ?? "報告書本文はまだないよ。").font(.body).textSelection(.enabled) }
                }
                if let data {
                    summary(data)
                    progress(data)
                    decisions(data)
                    membersAndFinance(data)
                    attachments(data)
                }
            }
        }.task { if auth.isAdmin { load() } }
    }

    @ViewBuilder private func reportControls(report: AMDOSParityReportBody) -> some View {
        AMDOSSectionCard("生成・確定", systemImage: "wand.and.stars") {
            HStack { AMDOSStatusBadge(text: report.status ?? "pending", tint: report.status == "fixed" ? AMDOSDesign.success : AMDOSDesign.warning); Spacer(); Button(busyAction == "generate" ? "生成中…" : (report.draftContent?.trimmedNonEmpty == nil ? "報告書を生成" : "再生成")) { generate() }.disabled(busyAction != nil); if report.draftContent?.trimmedNonEmpty != nil { Button(busyAction == "fix" ? "確定中…" : "FIX（確定）") { fix() }.disabled(busyAction != nil || report.status == "fixed") } }
            AMDOSTextField(title: "修正指示（任意）", text: $feedback, axis: .vertical)
            Button("修正指示を適用して再生成") { generate() }.disabled(feedback.trimmedNonEmpty == nil || busyAction != nil)
            if let fixedAt = report.fixedAt { Text("確定日時: \(fixedAt)").font(.caption).foregroundStyle(AMDOSDesign.muted) }
        }
    }

    @ViewBuilder private func summary(_ data: AMDOSParityReportPrintEnvelope) -> some View {
        HStack { AMDOSMetricTile(label: "当月進捗", value: data.overallPct.map { "\(Int($0.rounded()))%" } ?? "—", detail: "MS加重平均", tint: AMDOSDesign.blue); AMDOSMetricTile(label: "期待進捗", value: data.expectedPct.map { "\(Int($0.rounded()))%" } ?? "—", detail: data.ym); AMDOSMetricTile(label: "会議", value: "\(data.meetings.count)", detail: "当月記録") }
        AMDOSSectionCard("表紙・エグゼクティブサマリー", systemImage: "rectangle.portrait") {
            LabeledContent("クライアント", value: data.project.clientName ?? "—")
            LabeledContent("契約", value: data.contract?.title ?? "—")
            LabeledContent("契約期間", value: [data.contract?.periodStart, data.contract?.periodEnd].compactMap { $0 }.joined(separator: " 〜 ").nilIfEmpty ?? "—")
            if let rag = data.rag { HStack { AMDOSStatusBadge(text: "予定 \(rag.schedule ?? "n/a")"); AMDOSStatusBadge(text: "コスト \(rag.cost ?? "n/a")"); AMDOSStatusBadge(text: "リスク \(rag.risk ?? "n/a")") } }
            if let note = data.monthlyNote?.trimmedNonEmpty { Text(note).font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled) }
        }
    }

    @ViewBuilder private func progress(_ data: AMDOSParityReportPrintEnvelope) -> some View {
        AMDOSSectionCard("進捗・成果", systemImage: "chart.line.uptrend.xyaxis") {
            if let plan = data.planCycle { Text("計画 \(plan.periodStartYm ?? "—") 〜 \(plan.periodEndYm ?? "—") · \(Int(plan.totalPoints ?? 0))pt").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            ForEach(Array(data.milestones.enumerated()), id: \.offset) { _, milestone in
                VStack(alignment: .leading, spacing: 4) { HStack { Text(milestone.title ?? milestone.milestoneId ?? "MS").font(.subheadline.weight(.medium)); Spacer(); Text("\(Int((milestone.progressPct ?? 0).rounded()))% · \(Int(milestone.points ?? 0))pt").font(.caption).foregroundStyle(AMDOSDesign.muted) }; ProgressView(value: min(100, max(0, milestone.progressPct ?? 0)) / 100); if let note = milestone.note?.trimmedNonEmpty { Text(note).font(.caption).foregroundStyle(AMDOSDesign.muted) } }
            }
            ForEach(data.achievementSignals.prefix(8), id: \.signalId) { signal in AMDOSLineItem(title: "\(signal.polarity ?? "✨") \(signal.title ?? signal.signalType ?? "成果")", subtitle: signal.summary ?? "", status: signal.impactLevel ?? "confirmed") }
            ForEach(data.grants.prefix(6), id: \.id) { grant in AMDOSLineItem(title: grant.grantName ?? "採択・助成", subtitle: [grant.agency, grant.status].compactMap { $0 }.joined(separator: " · "), status: amdOSParityYen(grant.disbursedYen)) }
            ForEach(data.media.prefix(6), id: \.id) { item in AMDOSLineItem(title: item.title ?? "メディア掲載", subtitle: [item.mediaName, item.occurredOn].compactMap { $0 }.joined(separator: " · "), status: item.kind ?? "media") }
        }
    }

    @ViewBuilder private func decisions(_ data: AMDOSParityReportPrintEnvelope) -> some View {
        AMDOSSectionCard("会議・課題・次月計画", systemImage: "person.3.fill") {
            ForEach(Array(data.meetings.enumerated()), id: \.offset) { _, meeting in VStack(alignment: .leading, spacing: 4) { Text("\(meeting.meetingDate ?? "") · \(meeting.title ?? "会議")").font(.subheadline.weight(.medium)); Text(meeting.summaryShort ?? meeting.narrativeMd ?? "要約なし").font(.caption).foregroundStyle(AMDOSDesign.muted); if let risks = meeting.risks, !risks.isEmpty { Text("リスク: \(amdOSParityJSONList(risks))").font(.caption).foregroundStyle(AMDOSDesign.warning) } } }
            ForEach(data.riskSignals.prefix(8), id: \.signalId) { signal in AMDOSLineItem(title: "⚠️ \(signal.title ?? signal.signalType ?? "課題")", subtitle: signal.summary ?? "", status: signal.impactLevel ?? "risk") }
            ForEach(data.nextMonthActions.prefix(10), id: \.actionId) { action in AMDOSLineItem(title: action.title ?? "次月アクション", subtitle: [action.assignee, action.dueAt].compactMap { $0 }.joined(separator: " · "), status: action.status ?? "open") }
            ForEach(data.upcomingMeetings.prefix(6), id: \.meetingId) { meeting in AMDOSLineItem(title: meeting.title ?? "次月会議", subtitle: meeting.meetingDate ?? "", status: meeting.sourceKinds ?? "予定") }
        }
    }

    @ViewBuilder private func membersAndFinance(_ data: AMDOSParityReportPrintEnvelope) -> some View {
        AMDOSSectionCard("実施体制", systemImage: "person.2") { ForEach(Array(data.members.enumerated()), id: \.offset) { _, member in AMDOSLineItem(title: member.codeName ?? member.memberId ?? "メンバー", subtitle: [member.roleLabel, member.role].compactMap { $0 }.joined(separator: " · "), status: member.isPm == true ? "PM" : member.isPl == true ? "PL" : "担当") }; ForEach(data.founding, id: \.personName) { person in AMDOSLineItem(title: person.personName ?? "関係者", subtitle: [person.affiliation, person.roleLabelJp ?? person.role].compactMap { $0 }.joined(separator: " · "), status: person.category ?? "founding") } }
        AMDOSSectionCard("財務", systemImage: "yensign.circle") { if let billing = data.billing { LabeledContent("請求状態", value: billing.status ?? "—"); LabeledContent("予算", value: amdOSParityYen(billing.budgetYen)); LabeledContent("報告額", value: amdOSParityYen(billing.budgetReportedAmount)); LabeledContent("入金確認", value: billing.paymentConfirmedAt ?? "未確認") }; LabeledContent("立替合計", value: amdOSParityYen(data.reimburseTotal)); ForEach(data.reimbursements, id: \.reimbursementId) { item in AMDOSLineItem(title: "\(item.date ?? "") · \(item.description ?? item.category ?? "立替")", subtitle: item.member ?? "", status: amdOSParityYen(item.amount)) } }
    }

    @ViewBuilder private func attachments(_ data: AMDOSParityReportPrintEnvelope) -> some View {
        AMDOSSectionCard("添付資料", systemImage: "paperclip") { let attachments = (data.attachments?.meetingAssets ?? []) + (data.attachments?.projectDocs ?? []) + (data.attachments?.contractDocs ?? []); if attachments.isEmpty { Text("当月の添付資料はないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }; ForEach(Array(attachments.enumerated()), id: \.offset) { _, item in AMDOSLineItem(title: item.fileName ?? "資料", subtitle: [item.mimeType, item.createdAt ?? item.receivedAt].compactMap { $0 }.joined(separator: " · "), status: item.documentKind ?? "添付") } }
    }

    private func load() {
        guard let projectId, auth.isAdmin else { state = .failed("プロジェクトとadmin権限を確認してね"); return }
        Task { state = .loading; do { data = try await AMDOSRESTClient.shared.fetchPWA(AMDOSParityReportPrintEnvelope.self, path: "/api/project/monthly-report-print", query: ["projectId": projectId, "ym": ym]); state = .loaded } catch { message = error.localizedDescription; state = .failed(message ?? "月次報告を取得できなかったよ") } }
    }
    private func generate() {
        guard let projectId else { return }
        Task { busyAction = "generate"; do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/report/generate", body: AMDOSReportGenerateInput(projectId: projectId, ym: ym, feedback: feedback.trimmedNonEmpty)); message = "生成結果を保存したよ"; feedback = ""; load() } catch { message = error.localizedDescription }; busyAction = nil }
    }
    private func fix() {
        guard let projectId else { return }
        Task { busyAction = "fix"; do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/report/fix", body: AMDOSReportFixInput(projectId: projectId, ym: ym)); message = "保存したよ（FIX確定）"; load() } catch { message = error.localizedDescription }; busyAction = nil }
    }
    private func printReport() {
        guard let data else { return }
        let printInfo = NSPrintInfo.shared.copy() as! NSPrintInfo
        // PWA print page と同じ A4 縦。Mac の標準印刷パネルでPDF保存もできる。
        printInfo.paperSize = NSSize(width: 595.28, height: 841.89)
        printInfo.leftMargin = 39.69
        printInfo.rightMargin = 39.69
        printInfo.topMargin = 39.69
        printInfo.bottomMargin = 39.69
        let printableWidth = printInfo.paperSize.width - printInfo.leftMargin - printInfo.rightMargin
        let view = NSTextView(frame: NSRect(x: 0, y: 0, width: printableWidth, height: 980))
        view.string = amdOSParityReportPrintableText(data)
        view.font = NSFont.systemFont(ofSize: 10.5)
        view.textContainerInset = NSSize(width: 12, height: 14)
        view.isEditable = false
        view.isVerticallyResizable = true
        view.textContainer?.containerSize = NSSize(width: printableWidth - 24, height: .greatestFiniteMagnitude)
        view.layoutManager?.ensureLayout(for: view.textContainer!)
        let contentHeight = (view.layoutManager?.usedRect(for: view.textContainer!).height ?? 0) + 36
        view.frame.size.height = max(printInfo.paperSize.height - printInfo.topMargin - printInfo.bottomMargin, ceil(contentHeight))
        let operation = NSPrintOperation(view: view, printInfo: printInfo)
        operation.showsPrintPanel = true
        operation.showsProgressPanel = true
        operation.run()
    }
}

private func amdOSParityReportCurrentYM() -> String { let c = Calendar(identifier: .gregorian); let comps = c.dateComponents([.year, .month], from: Date()); return String(format: "%04d%02d", comps.year ?? 0, comps.month ?? 0) }
private func amdOSParityYen(_ value: Double?) -> String { guard let value else { return "—" }; return "¥\(Int(value.rounded()))" }
private func amdOSParityJSONList(_ values: [AMDOSParityJSON]) -> String { values.map(\.compactText).filter { !$0.isEmpty }.joined(separator: " / ") }

/// PWA `/report/[ym]/print` の章立てと同じ提出内容を、macOS の標準印刷経路へ渡す。
/// 画面用の短縮サマリーではなく、APIが返す全セクションを印刷対象にする。
private func amdOSParityReportPrintableText(_ data: AMDOSParityReportPrintEnvelope) -> String {
    func value(_ text: String?) -> String { text?.trimmedNonEmpty ?? "—" }
    func heading(_ number: String, _ title: String, _ body: [String]) -> String {
        "§\(number) \(title)\n" + body.filter { !$0.isEmpty }.joined(separator: "\n")
    }
    func list(_ rows: [String], empty: String = "該当なし") -> String {
        rows.isEmpty ? "・\(empty)" : rows.map { "・\($0)" }.joined(separator: "\n")
    }
    func datePeriod(_ start: String?, _ end: String?) -> String {
        [start?.trimmedNonEmpty, end?.trimmedNonEmpty].compactMap { $0 }.joined(separator: " 〜 ").trimmedNonEmpty ?? "—"
    }
    let report = data.report
    let contract = data.contract
    let coverIDs = [
        contract?.amdContractNo?.trimmedNonEmpty.map { "AMD契約番号: \($0)" },
        contract?.contractNo?.trimmedNonEmpty.map { "契約番号: \($0)" },
        contract?.bidNo?.trimmedNonEmpty.map { "入札番号: \($0)" },
    ].compactMap { $0 }
    var sections: [String] = []
    sections.append([
        "TEAM ARMADA / MONTHLY REPORT",
        "提出対象: \(data.project.clientName?.trimmedNonEmpty ?? data.project.projectName)",
        "対象月: \(data.ym.prefix(4))年\(Int(data.ym.suffix(2)) ?? 0)月",
        "案件: \(contract?.title?.trimmedNonEmpty ?? data.project.projectName)",
        "契約期間: \(datePeriod(contract?.periodStart, contract?.periodEnd))",
        coverIDs.joined(separator: " / "),
        "ステータス: \(report?.status?.uppercased() ?? "PENDING")",
        report?.fixedAt?.trimmedNonEmpty.map { "確定日: \($0)" },
        report?.confirmedBy?.trimmedNonEmpty.map { "確定者: \($0)" },
    ].compactMap { $0 }.joined(separator: "\n"))

    let lead = "本書は、\(data.project.clientName?.trimmedNonEmpty ?? data.project.projectName)と株式会社チームアルマダの間で締結された\(contract?.title?.trimmedNonEmpty.map { "「\($0)」" } ?? "本業務")に基づき、\(data.ym.prefix(4))年\(Int(data.ym.suffix(2)) ?? 0)月稼働分の業務遂行状況を報告するものである。"
    let xrlLines = [
        ("TRL", data.currentXrl?.trl), ("BRL", data.currentXrl?.brl), ("GRL", data.currentXrl?.grl),
        ("SRL", data.currentXrl?.srl), ("HRL", data.currentXrl?.hrl),
    ].compactMap { axis, number in number.map { "\(axis) \(Int($0.rounded()))" } }
    sections.append(heading("01", "エグゼクティブサマリー", [
        lead,
        "スケジュール: \(value(data.rag?.schedule)) / リスク: \(value(data.rag?.risk))",
        "当月進捗: \(data.overallPct.map { "\(Int($0.rounded()))%" } ?? "—") / 期待進捗: \(data.expectedPct.map { "\(Int($0.rounded()))%" } ?? "—")",
        xrlLines.isEmpty ? "XRL: —" : "XRL: \(xrlLines.joined(separator: " / "))",
        report?.finalContent?.trimmedNonEmpty ?? report?.draftContent?.trimmedNonEmpty ?? data.monthlyNote?.trimmedNonEmpty ?? "本文未作成",
    ]))

    let milestoneLines = data.milestones.map { milestone in
        let delta = milestone.deltaPct.map { $0 == 0 ? "" : String(format: " / 前月比 %+.0fpt", $0) } ?? ""
        return "\(value(milestone.title)) [\(value(milestone.tag))] \(Int((milestone.progressPct ?? 0).rounded()))% / \(Int((milestone.points ?? 0).rounded()))pt\(delta)\n  期間: \(datePeriod(milestone.periodStartYm, milestone.targetYm))\n  成功条件: \(value(milestone.successCriteria))\n  注記: \(value(milestone.note))"
    }
    let achievementLines = data.achievementSignals.map { signal in
        "\(signal.signalDate?.trimmedNonEmpty ?? "—") / \(value(signal.title)) [\(value(signal.impactLevel))]\n  \(value(signal.summary))"
    }
    let grantLines = data.grants.map { grant in
        "\(value(grant.grantName)) / \(value(grant.agency)) / \(value(grant.status)) / \(amdOSParityYen(grant.amountYen))"
    }
    let mediaLines = data.media.map { item in
        "\(item.occurredOn?.trimmedNonEmpty ?? "—") / \(value(item.mediaName)) / \(value(item.title))"
    }
    sections.append(heading("02", "当月の進捗・成果", [
        "[A] MS進捗\n\(list(milestoneLines, empty: "マイルストーン未設定"))",
        "[B] 主要成果\n\(list(achievementLines, empty: "主要成果なし"))",
        "[D] 採択・助成\n\(list(grantLines, empty: "該当なし"))",
        "[E] メディア\n\(list(mediaLines, empty: "該当なし"))",
    ]))

    let ganttLines = data.milestones.map { milestone in
        "\(value(milestone.title)): \(datePeriod(milestone.periodStartYm, milestone.targetYm)) / \(Int((milestone.progressPct ?? 0).rounded()))%"
    }
    sections.append(heading("02b", "マイルストーン工程", [list(ganttLines, empty: "マイルストーン未設定")]))

    let memberMap = Dictionary(uniqueKeysWithValues: data.members.compactMap { member -> (String, String)? in
        guard let memberID = member.memberId else { return nil }
        return (memberID, member.codeName?.trimmedNonEmpty ?? memberID)
    })
    let responsibilityLines = data.responsibilities.map { item in
        let person = item.codeName?.trimmedNonEmpty ?? item.memberId.flatMap { memberMap[$0] } ?? item.memberId ?? "担当未設定"
        return "\(person) / \(value(item.role)) / \(Int(((item.share ?? 0) * 100).rounded()))% / \(value(item.taskDescription))"
    }
    let foundingLines = data.founding.map { person in
        "\(value(person.personName)) / \(value(person.roleLabelJp ?? person.role)) / \(value(person.affiliation))"
    }
    sections.append(heading("03", "実施体制", [
        "担当メンバー\n\(list(responsibilityLines, empty: "担当設定なし"))",
        "関連キーパーソン\n\(list(foundingLines, empty: "該当なし"))",
    ]))

    let actionLines = data.nextMonthActions.map { action in
        "\(value(action.title)) / 担当: \(value(action.assignee)) / 期限: \(value(action.dueAt)) / \(value(action.status))"
    }
    let upcomingLines = data.upcomingMeetings.map { meeting in
        "\(value(meeting.meetingDate)) / \(value(meeting.title))"
    }
    sections.append(heading("04", "次月計画", [
        "重点アクション\n\(list(actionLines, empty: "次月アクションなし"))",
        "主要MTG予定\n\(list(upcomingLines, empty: "予定なし"))",
    ]))

    let meetingLines = data.meetings.map { meeting in
        let decided = meeting.decided.map(amdOSParityJSONList) ?? ""
        let actions = meeting.nextActions.map(amdOSParityJSONList) ?? ""
        let risks = meeting.risks.map(amdOSParityJSONList) ?? ""
        return [
            "\(value(meeting.meetingDate)) / \(value(meeting.title))",
            value(meeting.summaryShort ?? meeting.narrativeMd),
            decided.isEmpty ? nil : "決定: \(decided)",
            actions.isEmpty ? nil : "次の一手: \(actions)",
            risks.isEmpty ? nil : "リスク: \(risks)",
        ].compactMap { $0 }.joined(separator: "\n  ")
    }
    let financeLines = [
        data.billing.map { "請求状態: \(value($0.status)) / 予算: \(amdOSParityYen($0.budgetYen)) / 報告額: \(amdOSParityYen($0.budgetReportedAmount)) / 入金: \(value($0.paymentConfirmedAt))" },
        "立替合計: \(amdOSParityYen(data.reimburseTotal))",
    ].compactMap { $0 }
    let attachmentLines = ((data.attachments?.meetingAssets ?? []) + (data.attachments?.projectDocs ?? []) + (data.attachments?.contractDocs ?? [])).map { attachment in
        [attachment.fileName?.trimmedNonEmpty ?? "資料", attachment.documentKind?.trimmedNonEmpty, attachment.webViewLink?.trimmedNonEmpty].compactMap { $0 }.joined(separator: " / ")
    }
    sections.append(heading("05", "添付資料・改訂履歴", [
        "会議記録\n\(list(meetingLines, empty: "当月会議なし"))",
        "財務\n\(financeLines.joined(separator: "\n"))",
        "添付資料\n\(list(attachmentLines, empty: "添付なし"))",
        "改訂履歴: 生成 \(value(report?.generatedAt)) / FIX \(value(report?.fixedAt)) / 生成日時 \(value(data.generatedAt))",
    ]))
    return sections.joined(separator: "\n\n\n")
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

// MARK: - Project cockpit parity

// These models deliberately mirror the columns assembled by
// fetchCockpitFromSupabase() and the route-owned APIs used by CockpitView.
// The cockpit is not a generic table inspector: each model exists because the
// PWA renders and mutates that particular part of the project workflow.
private struct AMDOSParityCockpitProject: Codable, Sendable {
    let projectId: String
    let projectName: String
    let clientName: String?
    let status: String?
    let projectCategory: String?
    let projectType: String?
    let feeType: String?
    let feeAmount: Double?
    let startYm: String?
    let endYm: String?
    let paymentDueRule: String?
    let paymentDueDay: Int?
    let contractTerms: AMDOSParityCockpitJSON?
    let freezeFromYm: String?
    let restartExpectedYm: String?
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id", projectName = "project_name", clientName = "client_name", status
        case projectCategory = "project_category", projectType = "project_type", feeType = "fee_type", feeAmount = "fee_amount"
        case startYm = "start_ym", endYm = "end_ym", paymentDueRule = "payment_due_rule", paymentDueDay = "payment_due_day"
        case contractTerms = "contract_terms_json", freezeFromYm = "freeze_from_ym", restartExpectedYm = "restart_expected_ym"
    }
}

private struct AMDOSParityCockpitBilling: Codable, Identifiable, Sendable {
    let projectId: String?
    let ym: String
    let status: String?
    let budgetYen: Double?
    let meetingStartAt: String?
    let meetingEventId: String?
    let reportFixedAt: String?
    let budgetConfirmedAt: String?
    let invoiceIssuedAt: String?
    let invoiceSentAt: String?
    let payoutNoticeUploadedAt: String?
    let paymentConfirmedAt: String?
    let rewardPaidAt: String?
    let invoiceYm: String?
    let invoiceSubject: String?
    let budgetReportedAmount: Double?
    let budgetBufferAmount: Double?
    let extraBudgetYen: Double?
    let extraRevenueJSON: AMDOSParityCockpitJSON?
    let msProgressSummaryJSON: AMDOSParityCockpitJSON?
    let rewardSummaryJSON: AMDOSParityCockpitJSON?
    var id: String { ym }
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id", ym, status, budgetYen = "budget_yen", meetingStartAt = "meeting_start_at"
        case meetingEventId = "meeting_event_id", reportFixedAt = "report_fixed_at", budgetConfirmedAt = "budget_confirmed_at"
        case invoiceIssuedAt = "invoice_issued_at", invoiceSentAt = "invoice_sent_at", payoutNoticeUploadedAt = "payout_notice_uploaded_at"
        case paymentConfirmedAt = "payment_confirmed_at", rewardPaidAt = "reward_paid_at", invoiceYm = "invoice_ym"
        case invoiceSubject = "invoice_subject", budgetReportedAmount = "budget_reported_amount"
        case budgetBufferAmount = "budget_buffer_amount", extraBudgetYen = "extra_budget_yen", extraRevenueJSON = "extra_revenue_json"
        case msProgressSummaryJSON = "ms_progress_summary_json", rewardSummaryJSON = "reward_summary_json"
    }
}

private struct AMDOSParityCockpitPlanCycle: Codable, Identifiable, Sendable {
    let planCycleId: String
    let projectId: String?
    let status: String?
    let budgetYen: Double?
    let totalPoints: Double?
    let bufferBreakdownJSON: AMDOSParityCockpitJSON?
    let periodStartYm: String
    let periodEndYm: String
    var id: String { planCycleId }
    enum CodingKeys: String, CodingKey {
        case planCycleId = "plan_cycle_id", projectId = "project_id", status, budgetYen = "budget_yen", totalPoints = "total_points", bufferBreakdownJSON = "buffer_breakdown_json"
        case periodStartYm = "period_start_ym", periodEndYm = "period_end_ym"
    }
}

private struct AMDOSParityCockpitMilestone: Codable, Identifiable, Sendable {
    let milestoneId: String
    let planCycleId: String
    let title: String
    let points: Double?
    let tag: String?
    let goalLevel: String?
    let successCriteria: String?
    let sortOrder: Int?
    let periodStartYm: String?
    let targetYm: String?
    let isActive: Bool?
    var id: String { milestoneId }
    enum CodingKeys: String, CodingKey {
        case milestoneId = "milestone_id", planCycleId = "plan_cycle_id", title, points, tag, goalLevel = "goal_level"
        case successCriteria = "success_criteria", sortOrder = "sort_order", periodStartYm = "period_start_ym", targetYm = "target_ym", isActive = "is_active"
    }
}

private struct AMDOSParityCockpitProgress: Codable, Identifiable, Sendable {
    let milestoneKey: String
    let ym: String
    let progressPct: Double?
    let consumedPt: Double?
    let source: String?
    let note: String?
    let confirmedAt: String?
    var id: String { "\(milestoneKey)-\(ym)" }
    enum CodingKeys: String, CodingKey {
        case milestoneKey = "milestone_key", ym, progressPct = "progress_pct", consumedPt = "consumed_pt", source, note, confirmedAt = "confirmed_at"
    }
}

private struct AMDOSParityCockpitSubItem: Codable, Identifiable, Sendable {
    let subItemId: String
    let milestoneId: String
    let title: String
    let weight: Double?
    var status: String
    let assignee: String?
    var id: String { subItemId }
    enum CodingKeys: String, CodingKey {
        case subItemId = "sub_item_id", milestoneId = "milestone_id", title, weight, status, assignee
    }
}

private struct AMDOSParityCockpitResponsibility: Codable, Identifiable, Sendable {
    let milestoneId: String
    let memberId: String
    let share: Double?
    let role: String?
    let taskDescription: String?
    var id: String { "\(milestoneId)-\(memberId)" }
    enum CodingKeys: String, CodingKey {
        case milestoneId = "milestone_id", memberId = "member_id", share, role, taskDescription = "task_description"
    }
}

private struct AMDOSParityCockpitSignal: Codable, Identifiable, Sendable {
    let signalId: String
    let projectId: String
    let ym: String?
    let signalDate: String?
    let signalType: String?
    let polarity: String?
    let title: String?
    let summary: String?
    let scoreImpactSummary: String?
    let impactLevel: String?
    let decisionState: String?
    let status: String?
    let sourceRefsJSON: AMDOSParityCockpitJSON?
    let sourceHash: String?
    let confidence: Double?
    let createdAt: String?
    let confirmedAt: String?
    var id: String { signalId }
    enum CodingKeys: String, CodingKey {
        case signalId = "signal_id", projectId = "project_id", ym, signalDate = "signal_date", signalType = "signal_type", polarity, title, summary
        case scoreImpactSummary = "score_impact_summary", impactLevel = "impact_level", decisionState = "decision_state", status
        case sourceRefsJSON = "source_refs_json", sourceHash = "source_hash", confidence, createdAt = "created_at", confirmedAt = "confirmed_at"
    }
}

/// PWA `CockpitStrategySignals` の対話型つくよみ修正依頼で使う signal の提案値。
/// API は snake_case を契約にしているため、ここでも明示的に対応付ける。
private struct AMDOSParityCockpitSignalProposal: Codable, Sendable {
    let title: String
    let summary: String
    let impactLevel: String
    let signalType: String
    let polarity: String?
    let scoreImpactSummary: String?
    let signalScope: String?
    let appliesToCompanyScore: Bool?
    let pipelineStatus: String?
    let pipelineProbability: Double?
    let expectedAmountYen: Double?
    let expectedContractYM: String?
    let companyScoreAxis: String?
    let scopeReason: String?

    enum CodingKeys: String, CodingKey {
        case title, summary
        case impactLevel = "impact_level"
        case signalType = "signal_type"
        case polarity
        case scoreImpactSummary = "score_impact_summary"
        case signalScope = "signal_scope"
        case appliesToCompanyScore = "applies_to_company_score"
        case pipelineStatus = "pipeline_status"
        case pipelineProbability = "pipeline_probability"
        case expectedAmountYen = "expected_amount_yen"
        case expectedContractYM = "expected_contract_ym"
        case companyScoreAxis = "company_score_axis"
        case scopeReason = "scope_reason"
    }
}

/// server は state を持たず、PWA と同じく会話全体を refine / confirm に渡す。
private struct AMDOSParityCockpitSignalDialogMessage: Codable, Sendable, Identifiable {
    let role: String
    let content: String?
    let proposed: AMDOSParityCockpitSignalProposal?
    let reasoning: String?
    let appliedFeedbackSummary: String?

    var id: String {
        [role, content, proposed?.title, proposed?.summary, reasoning]
            .compactMap { $0 }
            .joined(separator: "|")
    }

    enum CodingKeys: String, CodingKey {
        case role, content, proposed, reasoning
        case appliedFeedbackSummary = "applied_feedback_summary"
    }
}

private struct AMDOSParityCockpitSignalDialogStartRequest: Encodable, Sendable {
    let l2Kind = "project_strategy_signal"
    let targetID: String
    let scopeKey: String
    let initialFeedback: String

    enum CodingKeys: String, CodingKey {
        case l2Kind = "l2_kind", targetID = "target_id", scopeKey = "scope_key", initialFeedback = "initial_feedback"
    }
}

private struct AMDOSParityCockpitSignalDialogRefineRequest: Encodable, Sendable {
    let l2Kind = "project_strategy_signal"
    let targetID: String
    let scopeKey: String
    let conversation: [AMDOSParityCockpitSignalDialogMessage]
    let additionalHint: String
    let additionalFeedback: String

    enum CodingKeys: String, CodingKey {
        case l2Kind = "l2_kind", targetID = "target_id", scopeKey = "scope_key", conversation
        case additionalHint = "additional_hint", additionalFeedback = "additional_feedback"
    }
}

private struct AMDOSParityCockpitSignalDialogConfirmRequest: Encodable, Sendable {
    let l2Kind = "project_strategy_signal"
    let targetID: String
    let scopeKey: String
    let conversation: [AMDOSParityCockpitSignalDialogMessage]
    let proposed: AMDOSParityCockpitSignalProposal
    let appliedFeedbackSummary: String

    enum CodingKeys: String, CodingKey {
        case l2Kind = "l2_kind", targetID = "target_id", scopeKey = "scope_key", conversation, proposed
        case appliedFeedbackSummary = "applied_feedback_summary"
    }
}

private struct AMDOSParityCockpitSignalDialogResponse: Decodable, Sendable {
    let ok: Bool?
    let error: String?
    let proposed: AMDOSParityCockpitSignalProposal?
    let current: AMDOSParityCockpitSignalProposal?
    let reasoning: String?
    let appliedFeedbackSummary: String?
    let conversation: [AMDOSParityCockpitSignalDialogMessage]?

    enum CodingKeys: String, CodingKey {
        case ok, error, proposed, current, reasoning, conversation
        case appliedFeedbackSummary = "applied_feedback_summary"
    }
}

private struct AMDOSParityCockpitSignalDialogConfirmResponse: Decodable, Sendable {
    let ok: Bool?
    let error: String?
}

private struct AMDOSParityCockpitFeedbackResponse: Decodable, Sendable {
    let ok: Bool?
    let error: String?
    let feedbacks: [AMDOSParityNotificationFeedbackRow]?
}

private struct AMDOSParityCockpitMeeting: Codable, Identifiable, Sendable {
    let meetingId: String
    let projectId: String?
    let ym: String?
    let meetingDate: String?
    let meetingStartAt: String?
    let title: String?
    let summaryShort: String?
    let narrativeMd: String?
    let decided: [String]?
    let progress: [String]?
    let nextActions: [String]?
    let risks: [String]?
    let notionUrl: String?
    let calendarEventId: String?
    let sourceUrl: String?
    let sourceKinds: String?
    let prepStatus: String?
    let prepDraftMd: String?
    let prepReadinessScore: Double?
    let prepReadinessReasons: AMDOSParityCockpitJSON?
    let prepWorkerStatus: String?
    let prepWorkerSessionId: String?
    let prepCalendarEventId: String?
    let generatedByModel: String?
    let generatedAt: String?
    var id: String { meetingId }
    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id", projectId = "project_id", ym, meetingDate = "meeting_date", meetingStartAt = "meeting_start_at", title
        case summaryShort = "summary_short", narrativeMd = "narrative_md", decided, progress, nextActions = "next_actions", risks
        case notionUrl = "notion_url", calendarEventId = "calendar_event_id", sourceUrl = "source_url"
        case sourceKinds = "source_kinds", prepStatus = "prep_status", prepDraftMd = "prep_draft_md", prepReadinessScore = "prep_readiness_score", prepReadinessReasons = "prep_readiness_reasons", prepWorkerStatus = "prep_worker_status", prepWorkerSessionId = "prep_worker_session_id", prepCalendarEventId = "prep_calendar_event_id", generatedByModel = "generated_by_model", generatedAt = "generated_at"
    }
}

private struct AMDOSParityCockpitTask: Codable, Identifiable, Sendable {
    let taskId: String
    let title: String
    var status: String
    let assignee: String?
    let priority: String?
    let description: String?
    var id: String { taskId }
    enum CodingKeys: String, CodingKey { case taskId = "task_id", title, status, assignee, priority, description }
}

private struct AMDOSParityCockpitReport: Codable, Identifiable, Sendable {
    let reportId: String
    let projectId: String?
    let ym: String
    let draftContent: String?
    let finalContent: String?
    let status: String?
    let generatedAt: String?
    let fixedAt: String?
    var id: String { reportId }
    enum CodingKeys: String, CodingKey {
        case reportId = "report_id", projectId = "project_id", ym, draftContent = "draft_content", finalContent = "final_content", status, generatedAt = "generated_at", fixedAt = "fixed_at"
    }
}

private struct AMDOSParityCockpitChangeEvent: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String?
    let planCycleId: String?
    let revisionId: String?
    let changedAt: String?
    let changedByEmail: String?
    let rewardPreviewStatus: String?
    let changedMilestoneCount: Int?
    let addedMilestoneCount: Int?
    let removedMilestoneCount: Int?
    let updatedMilestoneCount: Int?
    let protectedCycleCount: Int?
    let offsetCount: Int?
    let positiveOffsetYen: Double?
    let negativeOffsetYen: Double?
    let changeItemsJSON: AMDOSParityCockpitJSON?
    var summary: String {
        let count = changedMilestoneCount ?? 0
        return "MS \(count)件 · 追加 \(addedMilestoneCount ?? 0) · 削除 \(removedMilestoneCount ?? 0) · 更新 \(updatedMilestoneCount ?? 0)"
    }
    enum CodingKeys: String, CodingKey {
        case id, projectId = "project_id", planCycleId = "plan_cycle_id", revisionId = "revision_id"
        case changedAt = "changed_at", changedByEmail = "changed_by_email", rewardPreviewStatus = "reward_preview_status"
        case changedMilestoneCount = "changed_milestone_count", addedMilestoneCount = "added_milestone_count", removedMilestoneCount = "removed_milestone_count", updatedMilestoneCount = "updated_milestone_count"
        case protectedCycleCount = "protected_cycle_count", offsetCount = "offset_count", positiveOffsetYen = "positive_offset_yen", negativeOffsetYen = "negative_offset_yen", changeItemsJSON = "change_items_json"
    }
}

private struct AMDOSParityCockpitCycleBundle: Identifiable, Sendable {
    let cycle: AMDOSParityCockpitPlanCycle
    let milestones: [AMDOSParityCockpitMilestone]
    let progress: [AMDOSParityCockpitProgress]
    let subItems: [AMDOSParityCockpitSubItem]
    let responsibilities: [AMDOSParityCockpitResponsibility]
    var id: String { cycle.planCycleId }
}

private struct AMDOSParityCockpitDocument: Codable, Identifiable, Sendable {
    let documentId: String
    let projectId: String
    let driveFileId: String?
    let webViewLink: String?
    let fileName: String
    let mimeType: String
    let fileSizeBytes: Int?
    let uploadStatus: String?
    let createdAt: String?
    var id: String { documentId }
    enum CodingKeys: String, CodingKey {
        case documentId, projectId, driveFileId, webViewLink, fileName, mimeType, fileSizeBytes, uploadStatus, createdAt
    }
}

private extension AMDOSParityCockpitDocument {
    var isMarkdown: Bool {
        let name = fileName.lowercased()
        let mime = mimeType.lowercased()
        return name.hasSuffix(".md") || name.hasSuffix(".markdown") || mime == "text/markdown"
    }
}

private struct AMDOSParityCockpitDocumentsResponse: Codable, Sendable {
    let ok: Bool?
    let documents: [AMDOSParityCockpitDocument]?
    let warning: String?
    let error: String?
}

private struct AMDOSParityCockpitGrant: Codable, Identifiable, Sendable {
    let id: String
    let grantName: String
    let agency: String?
    let grantType: String?
    let amountYen: Double?
    let disbursedYen: Double?
    let status: String
    let isCurrent: Bool?
    let adoptedDate: String?
    let periodStartYm: String?
    let periodEndYm: String?
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case id, grantName = "grant_name", agency, grantType = "grant_type", amountYen = "amount_yen", disbursedYen = "disbursed_yen", status
        case isCurrent = "is_current", adoptedDate = "adopted_date", periodStartYm = "period_start_ym", periodEndYm = "period_end_ym", notes
    }
}

private struct AMDOSParityCockpitGrantsResponse: Codable, Sendable {
    let ok: Bool?
    let grants: [AMDOSParityCockpitGrant]?
    let error: String?
}

private struct AMDOSParityCockpitDocumentContent: Codable, Sendable {
    let ok: Bool?
    let markdown: String?
    let error: String?
}

private struct AMDOSParityCockpitDocumentContentPatch: Encodable, Sendable {
    let markdown: String
}

private struct AMDOSParityCockpitJSON: Codable, Sendable, Equatable {
    let string: String?
    let number: Double?
    let bool: Bool?
    let array: [AMDOSParityCockpitJSON]?
    let object: [String: AMDOSParityCockpitJSON]?

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { string = nil; number = nil; bool = nil; array = nil; object = nil; return }
        if let value = try? container.decode(String.self) { string = value; number = nil; bool = nil; array = nil; object = nil; return }
        if let value = try? container.decode(Double.self) { string = nil; number = value; bool = nil; array = nil; object = nil; return }
        if let value = try? container.decode(Bool.self) { string = nil; number = nil; bool = value; array = nil; object = nil; return }
        if let value = try? container.decode([AMDOSParityCockpitJSON].self) { string = nil; number = nil; bool = nil; array = value; object = nil; return }
        if let value = try? container.decode([String: AMDOSParityCockpitJSON].self) { string = nil; number = nil; bool = nil; array = nil; object = value; return }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
    }

    init(string: String) { self.string = string; number = nil; bool = nil; array = nil; object = nil }

    var compactText: String {
        if let string { return string }
        if let number { return number.rounded() == number ? String(Int(number)) : String(number) }
        if let bool { return bool ? "true" : "false" }
        if let array { return array.map(\.compactText).joined(separator: "\n") }
        if let object {
            return object.keys.sorted().map { key in "\(key): \(object[key]?.compactText ?? "")" }.joined(separator: "\n")
        }
        return "null"
    }
}

/// PWA `CockpitStrategySignals.sourceSummary` と同じく、根拠配列の先頭3件を
/// `source / date / title` に整形する。PWAが配列以外を空として扱うため、
/// object / string を勝手に根拠として表示しない。
private func amdOSCockpitSignalSourceSummaries(_ value: AMDOSParityCockpitJSON) -> [String] {
    guard let refs = value.array else { return [] }
    return refs.prefix(3).compactMap { item in
        let ref = item.object ?? [:]
        let source = amdOSCockpitJSONString(ref["source"])
            ?? amdOSCockpitJSONString(ref["type"])
            ?? "source"
        let date = amdOSCockpitJSONString(ref["date"])
            ?? amdOSCockpitJSONString(ref["item_date"])
        let title = amdOSCockpitJSONString(ref["title"])
            ?? amdOSCockpitJSONString(ref["snippet"])
            ?? amdOSCockpitJSONString(ref["summary"])
        let summary = [source, date, title]
            .compactMap { $0?.trimmedNonEmpty }
            .joined(separator: " / ")
        return summary.trimmedNonEmpty
    }
}

private func amdOSCockpitJSONString(_ value: AMDOSParityCockpitJSON?) -> String? {
    guard let value else { return nil }
    if let string = value.string { return string }
    if let number = value.number { return number.rounded() == number ? String(Int(number)) : String(number) }
    if let bool = value.bool { return bool ? "true" : "false" }
    return nil
}

/// `project_events.meta` はPWAと同じjsonb。読み取り用JSONをそのまま
/// Encodableにするとラッパー構造を保存してしまうため、書込みだけは
/// JSONの実値を1値としてencodeする型を分ける。
private indirect enum AMDOSParityCockpitJSONValue: Encodable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case array([AMDOSParityCockpitJSONValue])
    case object([String: AMDOSParityCockpitJSONValue])
    case null

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    static func from(_ value: AMDOSParityCockpitJSON) -> AMDOSParityCockpitJSONValue {
        if let string = value.string { return .string(string) }
        if let number = value.number { return .number(number) }
        if let bool = value.bool { return .bool(bool) }
        if let array = value.array { return .array(array.map { from($0) }) }
        if let object = value.object { return .object(object.mapValues { from($0) }) }
        return .null
    }
}

private func amdOSCockpitMetaRawText(_ meta: AMDOSParityCockpitJSON?) -> String {
    amdOSCockpitJSONString(meta?.object?["raw_text"])
        ?? amdOSCockpitJSONString(meta?.object?["_raw"])
        ?? meta?.compactText
        ?? ""
}

private struct AMDOSParityCockpitVenture: Codable, Sendable {
    let projectId: String
    let shortLabel: String?
    let lane: String?
    let foundedAt: String?
    let outcomePattern: String?
    let originOrg: String?
    let originPI: String?
    let amdRole: String?
    let shortDescription: String?
    let longDescription: String?
    let amdSupportStartedAt: String?
    let amdSupportEndedAt: String?
    let narrativeText: String?
    let narrativeGeneratedAt: String?
    let narrativeInvalidatedAt: String?
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id", shortLabel = "short_label", lane, foundedAt = "founded_at", outcomePattern = "outcome_pattern"
        case originOrg = "origin_org", originPI = "origin_pi", amdRole = "amd_role", shortDescription = "short_description", longDescription = "long_description"
        case amdSupportStartedAt = "amd_support_started_at", amdSupportEndedAt = "amd_support_ended_at"
        case narrativeText = "narrative_text", narrativeGeneratedAt = "narrative_generated_at", narrativeInvalidatedAt = "narrative_invalidated_at"
    }
}

private struct AMDOSParityCockpitVentureEvent: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let occurredOn: String
    let kind: String
    let label: String
    let meta: AMDOSParityCockpitJSON?
    let source: String?
    let createdBy: String?
    let createdAt: String?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, projectId = "project_id", occurredOn = "occurred_on", kind, label, meta, source
        case createdBy = "created_by", createdAt = "created_at", updatedAt = "updated_at"
    }
}

private struct AMDOSParityCockpitVentureEventEditorTarget: Identifiable {
    let id: String
    let event: AMDOSParityCockpitVentureEvent?
    let initialDate: String

    init(event: AMDOSParityCockpitVentureEvent?, initialDate: String) {
        self.id = event?.id ?? UUID().uuidString
        self.event = event
        self.initialDate = initialDate
    }
}

private struct AMDOSParityCockpitXRLObservation: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let observedAt: String
    let trl: Double?
    let brl: Double?
    let grl: Double?
    let srl: Double?
    let hrl: Double?
    let bottleneck: String?
    let milestoneLabel: String?
    let sourceNote: String?
    let source: String?
    enum CodingKeys: String, CodingKey {
        case id, projectId = "project_id", observedAt = "observed_at", trl, brl, grl, srl, hrl, bottleneck
        case milestoneLabel = "milestone_label", sourceNote = "source_note", source
    }
}

private struct AMDOSParityCockpitVentureEventInsert: Encodable, Sendable {
    let projectId: String
    let occurredOn: String
    let kind: String
    let label: String
    let meta: AMDOSParityCockpitJSONValue
    let source: String
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id", occurredOn = "occurred_on", kind, label, meta, source
    }
}

private struct AMDOSParityCockpitVentureEventPatch: Encodable, Sendable {
    let occurredOn: String
    let kind: String
    let label: String
    let meta: AMDOSParityCockpitJSONValue
    let updatedAt: String
    enum CodingKeys: String, CodingKey {
        case occurredOn = "occurred_on", kind, label, meta, updatedAt = "updated_at"
    }
}

private struct AMDOSParityCockpitVentureEventParseRequest: Encodable, Sendable {
    let kind: String
    let label: String
    let rawText: String
    enum CodingKeys: String, CodingKey { case kind, label, rawText = "raw_text" }
}

private struct AMDOSParityCockpitVentureEventParseResponse: Decodable, Sendable {
    let meta: AMDOSParityCockpitJSON?
    let error: String?
}

private func amdOSCockpitVentureEventMeta(rawText: String, parsed: AMDOSParityCockpitJSON?) -> AMDOSParityCockpitJSONValue {
    var result: [String: AMDOSParityCockpitJSONValue] = [:]
    if let raw = rawText.trimmedNonEmpty { result["raw_text"] = .string(raw) }
    for (key, value) in parsed?.object ?? [:] {
        result[key] = .from(value)
    }
    return .object(result)
}

private struct AMDOSParityCockpitMsSchedule: Codable, Identifiable, Sendable {
    let milestoneId: String
    let periodStartYm: String
    let targetYm: String
    let msMonths: Int
    let expectedCumPct: Double
    let monthlyPt: Double
    var id: String { milestoneId }
    enum CodingKeys: String, CodingKey {
        case milestoneId, periodStartYm, targetYm, msMonths, expectedCumPct, monthlyPt
    }
}

private struct AMDOSParityCockpitMsScheduleResponse: Decodable, Sendable {
    let ok: Bool?
    let schedules: [AMDOSParityCockpitMsSchedule]?
    let error: String?
}

private struct AMDOSParityCockpitMemberMsActivity: Codable, Identifiable, Sendable {
    let memberId: String
    let milestoneId: String
    let ym: String
    let narrative: String?
    let learnedAddendum: String?
    let generatedAt: String?
    var id: String { "\(memberId)-\(milestoneId)-\(ym)" }
    enum CodingKeys: String, CodingKey {
        case memberId = "member_id", milestoneId = "milestone_id", ym, narrative
        case learnedAddendum = "learned_addendum", generatedAt = "generated_at"
    }
}

private struct AMDOSParityCockpitMemberActivity: Codable, Identifiable, Sendable {
    let id: String
    let memberId: String
    let projectId: String
    let ym: String
    let source: String?
    let sourceItemId: String?
    let milestoneId: String?
    let title: String?
    let contentPreview: String?
    let itemDate: String?
    let extractedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, memberId = "member_id", projectId = "project_id", ym, source, sourceItemId = "source_item_id"
        case milestoneId = "milestone_id", title, contentPreview = "content_preview", itemDate = "item_date", extractedAt = "extracted_at"
    }
}

private struct AMDOSParityCockpitFreezeBackfill: Codable, Identifiable, Sendable {
    let projectId: String
    let freezeFromYm: String
    let restartYm: String
    let summary: String?
    let sourceMeta: AMDOSParityCockpitJSON?
    let updatedAt: String?
    var id: String { "\(projectId)-\(freezeFromYm)-\(restartYm)" }
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id", freezeFromYm = "freeze_from_ym", restartYm = "restart_ym", summary
        case sourceMeta = "source_meta", updatedAt = "updated_at"
    }
}

private struct AMDOSParityCockpitManagementScoreSnapshot: Codable, Identifiable, Sendable {
    let id: String
    let ym: String
    let totalScore: Double?
    let initiativeScore: Double?
    let financeScore: Double?
    let retentionScore: Double?
    let pipelineScore: Double?
    let directionScore: Double?
    enum CodingKeys: String, CodingKey {
        case id, ym, totalScore = "total_score", initiativeScore = "initiative_score", financeScore = "finance_score"
        case retentionScore = "retention_score", pipelineScore = "pipeline_score", directionScore = "direction_score"
    }
}

private struct AMDOSParityCockpitPlanProgressInput: Encodable, Sendable {
    let projectId: String
    let ym: String
    let milestones: [AMDOSParityCockpitProgressPatch]
}

private struct AMDOSParityCockpitProgressPatch: Encodable, Sendable {
    let milestoneKey: String
    let progressPct: Double
}

private struct AMDOSParityCockpitMonthlyNoteInput: Encodable, Sendable {
    let projectId: String
    let ym: String
    let body: String
}

private struct AMDOSParityCockpitMonthlyNote: Codable, Sendable {
    let body: String?
    let updatedAt: String?
    let updatedBy: String?
    enum CodingKeys: String, CodingKey { case body, updatedAt = "updated_at", updatedBy = "updated_by" }
}

private struct AMDOSParityCockpitMonthlyNoteResponse: Codable, Sendable {
    let ok: Bool?
    let note: AMDOSParityCockpitMonthlyNote?
    let error: String?
}

private struct AMDOSParityCockpitUnconfirmed: Codable, Identifiable, Sendable {
    let milestoneKey: String
    let progressPct: Double?
    let prevPct: Double?
    let reason: String?
    var id: String { milestoneKey }
    enum CodingKeys: String, CodingKey { case milestoneKey, progressPct, prevPct, reason }
}

private struct AMDOSParityCockpitRevisionMessage: Codable, Identifiable, Sendable {
    let id: String
    let revisionId: String
    let senderKind: String
    let body: String
    let createdAt: String?
    enum CodingKeys: String, CodingKey { case id, revisionId = "revisionId", senderKind = "senderKind", body, createdAt = "createdAt" }
}

private struct AMDOSParityCockpitRevision: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let milestoneId: String
    let ym: String
    let currentPct: Double?
    let currentNote: String?
    let revisedPct: Double?
    let revisedNote: String?
    let status: String
    let messages: [AMDOSParityCockpitRevisionMessage]
    enum CodingKeys: String, CodingKey {
        case id, projectId = "projectId", milestoneId = "milestoneId", ym, currentPct = "currentPct", currentNote = "currentNote"
        case revisedPct = "revisedPct", revisedNote = "revisedNote", status, messages
    }
}

private struct AMDOSParityCockpitRevisionsEnvelope: Codable, Sendable {
    let ok: Bool?
    let revisions: [AMDOSParityCockpitRevision]?
    let error: String?
}

private struct AMDOSParityCockpitProgressEventResponsibility: Codable, Sendable {
    let memberId: String
    let memberName: String?
    let responsibility: Double?
    enum CodingKeys: String, CodingKey { case memberId = "memberId", memberName = "memberName", responsibility }
}

private struct AMDOSParityCockpitProgressEvent: Codable, Identifiable, Sendable {
    let eventId: String
    let milestoneId: String?
    let title: String?
    let contentPreview: String?
    let itemDate: String?
    let eventTitle: String
    let eventDescription: String?
    let status: String
    let initiativeOrigin: String?
    let impact: Double?
    let depth: Double?
    let rejectReason: String?
    let originLostReason: String?
    let responsibilities: [AMDOSParityCockpitProgressEventResponsibility]?
    var id: String { eventId }
    enum CodingKeys: String, CodingKey {
        case eventId = "eventId", milestoneId = "milestoneId", title, contentPreview = "contentPreview", itemDate = "itemDate"
        case eventTitle = "eventTitle", eventDescription = "eventDescription", status, initiativeOrigin = "initiativeOrigin", impact, depth
        case rejectReason = "rejectReason", originLostReason = "originLostReason", responsibilities
    }
}

private struct AMDOSParityCockpitEventsEnvelope: Codable, Sendable {
    let ok: Bool?
    let events: [AMDOSParityCockpitProgressEvent]?
    let error: String?
}

private struct AMDOSParityCockpitReimbursement: Codable, Identifiable, Sendable {
    let id: String?
    let description: String
    let amount: Double
    let memberName: String?
    let date: String?
    var stableID: String { id ?? "\(date ?? "")-\(description)-\(amount)" }
}

private struct AMDOSParityCockpitReimbursementsEnvelope: Codable, Sendable {
    let ok: Bool?
    let items: [AMDOSParityCockpitReimbursement]?
    let error: String?
}

private struct AMDOSParityCockpitRevisionRequest: Encodable, Sendable {
    let projectId: String
    let milestoneId: String
    let ym: String
    let requestText: String
    let currentPct: Double
    let currentNote: String
    let milestoneTitle: String
    let revisionId: String?
}

private struct AMDOSParityCockpitRevisionAction: Encodable, Sendable {
    let revisionId: String
    let action: String
}

private struct AMDOSParityCockpitEventPatch: Encodable, Sendable {
    let eventId: String
    let projectId: String
    let ym: String
    let title: String
    let contentPreview: String
    let milestoneId: String?
    let initiativeOrigin: String
    let impact: Double
    let depth: Double
}

private struct AMDOSParityCockpitRewardSyncRequest: Encodable, Sendable {
    let projectId: String
    let ym: String
}

private struct AMDOSParityCockpitRewardSyncResponse: Codable, Sendable {
    let ok: Bool?
    let syncOk: Bool?
    let error: String?
    enum CodingKeys: String, CodingKey { case ok, syncOk, error }
}

private struct AMDOSParityCockpitReportInput: Encodable, Sendable {
    let projectId: String
    let ym: String
    let feedback: String?
}

private struct AMDOSParityCockpitFixInput: Encodable, Sendable {
    let projectId: String
    let ym: String
}

private struct AMDOSParityCockpitStatusPatch: Encodable, Sendable {
    let status: String
    let updatedAt: String?
    enum CodingKeys: String, CodingKey { case status, updatedAt = "updated_at" }
}

@MainActor
private final class AMDOSParityCockpitStore: ObservableObject {
    @Published var project: AMDOSParityCockpitProject?
    @Published var billingCycles: [AMDOSParityCockpitBilling] = []
    @Published var planCycles: [AMDOSParityCockpitPlanCycle] = []
    @Published var currentBundle: AMDOSParityCockpitCycleBundle?
    @Published var pastBundles: [AMDOSParityCockpitCycleBundle] = []
    @Published var progress: [AMDOSParityCockpitProgress] = []
    @Published var msSchedules: [AMDOSParityCockpitMsSchedule] = []
    @Published var memberMsActivities: [AMDOSParityCockpitMemberMsActivity] = []
    @Published var memberActivities: [AMDOSParityCockpitMemberActivity] = []
    @Published var signals: [AMDOSParityCockpitSignal] = []
    @Published var meetings: [AMDOSParityCockpitMeeting] = []
    @Published var tasks: [AMDOSParityCockpitTask] = []
    @Published var reports: [AMDOSParityCockpitReport] = []
    @Published var unconfirmed: [AMDOSParityCockpitUnconfirmed] = []
    @Published var revisions: [AMDOSParityCockpitRevision] = []
    @Published var progressEvents: [AMDOSParityCockpitProgressEvent] = []
    @Published var reimbursements: [AMDOSParityCockpitReimbursement] = []
    @Published var monthlyNote = ""
    @Published var monthlyNoteUpdatedAt: String?
    @Published var monthlyNoteUpdatedBy: String?
    @Published var documents: [AMDOSParityCockpitDocument] = []
    @Published var grants: [AMDOSParityCockpitGrant] = []
    @Published var changeEvents: [AMDOSParityCockpitChangeEvent] = []
    @Published var venture: AMDOSParityCockpitVenture?
    @Published var ventureEvents: [AMDOSParityCockpitVentureEvent] = []
    @Published var ventureXRL: [AMDOSParityCockpitXRLObservation] = []
    @Published var freezeBackfills: [AMDOSParityCockpitFreezeBackfill] = []
    @Published var managementScoreSnapshots: [AMDOSParityCockpitManagementScoreSnapshot] = []
    @Published var memberNames: [String: String] = [:]
    @Published var documentWarning: String?
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?
    private var loadedProjectId: String?

    private var currentYm: String {
        let components = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: .now)
        return String(format: "%04d%02d", components.year ?? 0, components.month ?? 0)
    }

    func load(projectId: String?) async {
        guard let projectId, !projectId.isEmpty else {
            state = .empty
            message = "プロジェクトを選んでね"
            return
        }
        loadedProjectId = projectId
        state = .loading
        message = nil
        do {
            async let projectRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitProject.self,
                table: "projects",
                select: "project_id,project_name,client_name,status,project_category,project_type,fee_type,fee_amount,start_ym,end_ym,payment_due_rule,payment_due_day,contract_terms_json,freeze_from_ym,restart_expected_ym",
                filters: ["project_id": "eq.\(projectId)"]
            )
            async let billingRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitBilling.self,
                table: "billing_cycles",
                select: "project_id,ym,status,budget_yen,meeting_start_at,meeting_event_id,report_fixed_at,budget_confirmed_at,invoice_issued_at,invoice_sent_at,payout_notice_uploaded_at,payment_confirmed_at,reward_paid_at,invoice_ym,invoice_subject,budget_reported_amount,budget_buffer_amount,extra_budget_yen,extra_revenue_json,ms_progress_summary_json,reward_summary_json",
                filters: ["project_id": "eq.\(projectId)"],
                order: "ym.desc"
            )
            async let planRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitPlanCycle.self,
                table: "value_plan_cycles",
                select: "plan_cycle_id,project_id,status,budget_yen,total_points,buffer_breakdown_json,period_start_ym,period_end_ym",
                filters: ["project_id": "eq.\(projectId)", "status": "in.(active,confirmed,fixed,draft)"],
                order: "period_start_ym.desc"
            )
            async let memberRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSProjectMember.self,
                table: "project_members",
                select: "id,project_id,member_id,role,role_label,is_active,is_pm,is_pl",
                filters: ["project_id": "eq.\(projectId)", "is_active": "eq.true"]
            )
            async let signalRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitSignal.self,
                table: "project_strategy_signals",
                select: "signal_id,project_id,ym,signal_date,signal_type,polarity,title,summary,score_impact_summary,impact_level,decision_state,status,source_refs_json,source_hash,confidence,created_at,confirmed_at",
                filters: ["project_id": "eq.\(projectId)", "status": "in.(candidate,confirmed)"],
                order: "signal_date.desc,created_at.desc",
                // PWA CockpitView は candidate / confirmed を全件表示する。
                // PostgREST の通常上限まで読み、古いシグナルを静かに落とさない。
                limit: 1_000
            )
            async let eventRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitChangeEvent.self,
                table: "milestone_change_events",
                select: "id,project_id,plan_cycle_id,revision_id,changed_at,changed_by_email,reward_preview_status,changed_milestone_count,added_milestone_count,removed_milestone_count,updated_milestone_count,protected_cycle_count,offset_count,positive_offset_yen,negative_offset_yen,change_items_json",
                filters: ["project_id": "eq.\(projectId)"],
                order: "changed_at.desc",
                limit: 1_000
            )
            async let ventureRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitVenture.self,
                table: "project_ventures",
                select: "project_id,short_label,lane,founded_at,outcome_pattern,origin_org,origin_pi,amd_role,short_description,long_description,amd_support_started_at,amd_support_ended_at,narrative_text,narrative_generated_at,narrative_invalidated_at",
                filters: ["project_id": "eq.\(projectId)"],
                limit: 1
            )
            async let ventureEventRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitVentureEvent.self,
                table: "project_events",
                select: "id,project_id,occurred_on,kind,label,meta,source,created_by,created_at,updated_at",
                filters: ["project_id": "eq.\(projectId)"],
                order: "occurred_on.asc",
                limit: 1_000
            )
            async let xrlRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitXRLObservation.self,
                table: "project_xrl_log",
                select: "id,project_id,observed_at,trl,brl,grl,srl,hrl,bottleneck,milestone_label,source_note,source",
                filters: ["project_id": "eq.\(projectId)"],
                order: "observed_at.asc",
                limit: 1_000
            )
            async let freezeBackfillRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitFreezeBackfill.self,
                table: "freeze_period_backfills",
                select: "project_id,freeze_from_ym,restart_ym,summary,source_meta,updated_at",
                filters: ["project_id": "eq.\(projectId)"],
                order: "updated_at.desc",
                limit: 100
            )
            async let managementScoreRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitManagementScoreSnapshot.self,
                table: "amd_management_score_snapshots",
                select: "id,ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score",
                filters: ["ym": "lte.\(currentYm)"],
                order: "ym.asc",
                limit: 1_000
            )
            async let milestoneRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitMilestone.self,
                table: "value_milestones",
                select: "milestone_id,plan_cycle_id,title,points,tag,goal_level,success_criteria,sort_order,period_start_ym,target_ym,is_active",
                filters: [:],
                order: "sort_order"
            )
            async let progressRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitProgress.self,
                table: "milestone_monthly_progress",
                select: "milestone_key,ym,progress_pct,consumed_pt,source,note,confirmed_at",
                filters: [:],
                order: "ym.desc"
            )
            async let meetingRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitMeeting.self,
                table: "project_meeting_summaries",
                select: "meeting_id,project_id,ym,meeting_date,meeting_start_at,title,summary_short,narrative_md,decided,progress,next_actions,risks,notion_url,calendar_event_id,source_url,source_kinds,prep_status,prep_draft_md,prep_readiness_score,prep_readiness_reasons,prep_worker_status,prep_worker_session_id,prep_calendar_event_id,generated_by_model,generated_at",
                filters: ["project_id": "eq.\(projectId)"],
                order: "meeting_date.desc",
                // PWA は「それより前を表示」で全期間を辿れる。deep link を含めて
                // 途中で会議履歴を落とさないよう、REST 側の標準上限と同じ1,000件まで読む。
                limit: 1_000
            )
            async let taskRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitTask.self,
                table: "tasks",
                select: "task_id,title,status,assignee,priority,description",
                filters: ["project_id": "eq.\(projectId)"],
                order: "created_at.desc"
            )
            async let reportRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityCockpitReport.self,
                table: "monthly_reports",
                select: "report_id,project_id,ym,draft_content,final_content,status,generated_at,fixed_at",
                filters: ["project_id": "eq.\(projectId)"],
                order: "ym.desc"
            )
            async let documentsResponse = AMDOSRESTClient.shared.fetchPWA(
                AMDOSParityCockpitDocumentsResponse.self,
                path: "/api/project-documents",
                query: ["project_id": projectId]
            )
            async let grantsResponse = AMDOSRESTClient.shared.fetchPWA(
                AMDOSParityCockpitGrantsResponse.self,
                path: "/api/grants",
                query: ["projectId": projectId]
            )
            async let codeNames = AMDOSRESTClient.shared.fetchTable(
                AMDOSCockpitMemberName.self,
                table: "members",
                select: "member_id,code_name",
                filters: [:],
                limit: 500
            )

            let projects = try await projectRows
            guard let project = projects.first else {
                self.project = nil
                state = .empty
                message = "このプロジェクトは見つからないか、表示権限がないよ"
                return
            }
            let billing = try await billingRows
            let plans = try await planRows
            let allMilestones = try await milestoneRows
            let allProgress = try await progressRows
            let members = try await memberRows
            let names = try await codeNames
            let memberMap = Dictionary(uniqueKeysWithValues: names.map { ($0.memberId, $0.codeName ?? $0.memberId) })
            let memberIDs = Set(members.filter(\.isActive).map(\.memberId))
            self.memberNames = memberMap.filter { memberIDs.contains($0.key) }

            let relevantMilestones = allMilestones.filter { milestone in plans.contains { $0.planCycleId == milestone.planCycleId } }
            let milestoneIDs = Set(relevantMilestones.map(\.milestoneId))
            let relevantProgress = allProgress.filter { milestoneIDs.contains($0.milestoneKey) }

            var subItems: [AMDOSParityCockpitSubItem] = []
            var responsibilities: [AMDOSParityCockpitResponsibility] = []
            var loadedMemberMsActivities: [AMDOSParityCockpitMemberMsActivity] = []
            var loadedMemberActivities: [AMDOSParityCockpitMemberActivity] = []
            if !milestoneIDs.isEmpty {
                let idsFilter = "in.(\(milestoneIDs.sorted().joined(separator: ",")))"
                async let subRows = AMDOSRESTClient.shared.fetchTable(
                    AMDOSParityCockpitSubItem.self,
                    table: "milestone_sub_items",
                    select: "sub_item_id,milestone_id,title,weight,status,assignee",
                    filters: ["milestone_id": idsFilter]
                )
                async let responsibilityRows = AMDOSRESTClient.shared.fetchTable(
                    AMDOSParityCockpitResponsibility.self,
                    table: "milestone_responsibility",
                    select: "milestone_id,member_id,share,role,task_description",
                    filters: ["milestone_id": idsFilter]
                )
                async let memberMsActivityRows = AMDOSRESTClient.shared.fetchTable(
                    AMDOSParityCockpitMemberMsActivity.self,
                    table: "member_ms_activities",
                    select: "member_id,milestone_id,ym,narrative,learned_addendum,generated_at",
                    filters: ["milestone_id": idsFilter],
                    order: "ym.desc",
                    limit: 5_000
                )
                async let memberActivityRows = AMDOSRESTClient.shared.fetchTable(
                    AMDOSParityCockpitMemberActivity.self,
                    table: "member_activities",
                    select: "id,member_id,project_id,ym,source,source_item_id,milestone_id,title,content_preview,item_date,extracted_at",
                    filters: ["project_id": "eq.\(projectId)", "milestone_id": idsFilter],
                    order: "ym.desc,item_date.desc",
                    limit: 5_000
                )
                subItems = try await subRows
                responsibilities = try await responsibilityRows
                loadedMemberMsActivities = try await memberMsActivityRows
                loadedMemberActivities = try await memberActivityRows
            }

            func bundle(_ cycle: AMDOSParityCockpitPlanCycle) -> AMDOSParityCockpitCycleBundle {
                let cycleMilestones = relevantMilestones.filter { $0.planCycleId == cycle.planCycleId }.sorted { ($0.sortOrder ?? 0) < ($1.sortOrder ?? 0) }
                let cycleIDs = Set(cycleMilestones.map(\.milestoneId))
                return AMDOSParityCockpitCycleBundle(
                    cycle: cycle,
                    milestones: cycleMilestones,
                    progress: relevantProgress.filter { cycleIDs.contains($0.milestoneKey) },
                    subItems: subItems.filter { cycleIDs.contains($0.milestoneId) },
                    responsibilities: responsibilities.filter { cycleIDs.contains($0.milestoneId) }
                )
            }

            let selected = plans.first { currentYm >= $0.periodStartYm && currentYm <= $0.periodEndYm }
                ?? plans.filter { currentYm < $0.periodStartYm }.sorted { $0.periodStartYm < $1.periodStartYm }.first
            self.project = project
            self.billingCycles = billing
            self.planCycles = plans
            self.currentBundle = selected.map(bundle)
            self.pastBundles = plans.filter { $0.planCycleId != selected?.planCycleId }.map(bundle)
            self.progress = relevantProgress
            self.memberMsActivities = loadedMemberMsActivities
            self.memberActivities = loadedMemberActivities
            self.signals = try await signalRows
            self.meetings = try await meetingRows
            self.tasks = try await taskRows
            self.reports = try await reportRows
            let docs = try await documentsResponse
            self.documents = docs.documents ?? []
            self.documentWarning = docs.warning
            let grants = try await grantsResponse
            self.grants = grants.grants ?? []
            self.changeEvents = try await eventRows
            self.venture = try await ventureRows.first
            self.ventureEvents = try await ventureEventRows
            self.ventureXRL = try await xrlRows
            self.freezeBackfills = try await freezeBackfillRows
            if project.projectId == "p00" {
                self.managementScoreSnapshots = try await managementScoreRows
            } else {
                self.managementScoreSnapshots = []
            }
            state = .loaded
        } catch {
            message = error.localizedDescription
            state = .failed(message ?? "コックピットを取得できなかったよ")
        }
    }

    func toggleSubItem(_ item: AMDOSParityCockpitSubItem) async {
        do {
            let next = item.status == "done" ? "open" : "done"
            _ = try await AMDOSRESTClient.shared.patchTable(
                table: "milestone_sub_items",
                filters: ["sub_item_id": "eq.\(item.subItemId)"],
                body: AMDOSParityCockpitStatusPatch(status: next, updatedAt: nil)
            )
            if let projectId = loadedProjectId { await load(projectId: projectId) }
        } catch { message = error.localizedDescription }
    }

    func updateTask(_ task: AMDOSParityCockpitTask) async {
        do {
            let next = task.status == "done" ? "todo" : "done"
            _ = try await AMDOSRESTClient.shared.patchTable(
                table: "tasks",
                filters: ["task_id": "eq.\(task.taskId)"],
                body: AMDOSParityCockpitStatusPatch(status: next, updatedAt: ISO8601DateFormatter().string(from: .now))
            )
            if let projectId = loadedProjectId { await load(projectId: projectId) }
        } catch { message = error.localizedDescription }
    }

    func saveProgress(projectId: String, ym: String, values: [String: Double]) async {
        do {
            let patches = values.map { AMDOSParityCockpitProgressPatch(milestoneKey: $0.key, progressPct: max(0, min(100, $0.value))) }.sorted { $0.milestoneKey < $1.milestoneKey }
            _ = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/progress/batch-save",
                body: AMDOSParityCockpitPlanProgressInput(projectId: projectId, ym: ym, milestones: patches)
            )
            message = "\(ym) の進捗を保存したよ"
            await load(projectId: projectId)
        } catch { message = error.localizedDescription }
    }

    func saveNote(projectId: String, ym: String, body: String) async {
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/project/monthly-note", body: AMDOSParityCockpitMonthlyNoteInput(projectId: projectId, ym: ym, body: body))
            message = "月次ノートを保存したよ"
        } catch { message = error.localizedDescription }
    }

    func loadMonthExtras(projectId: String, ym: String) async {
        do {
            let planStartYm = planCycles.first(where: { ym >= $0.periodStartYm && ym <= $0.periodEndYm })?.periodStartYm
                ?? planCycles.first?.periodStartYm
                ?? ym
            async let note = AMDOSRESTClient.shared.fetchPWA(
                AMDOSParityCockpitMonthlyNoteResponse.self,
                path: "/api/project/monthly-note",
                query: ["projectId": projectId, "ym": ym]
            )
            async let estimates = AMDOSRESTClient.shared.fetchPWA(
                AMDOSParityCockpitUnconfirmedEnvelope.self,
                path: "/api/progress/unconfirmed",
                query: ["projectId": projectId, "ym": ym]
            )
            async let revisionResponse = AMDOSRESTClient.shared.fetchPWA(
                AMDOSParityCockpitRevisionsEnvelope.self,
                path: "/api/progress/revisions",
                query: ["projectId": projectId, "ym": ym]
            )
            async let eventResponse = AMDOSRESTClient.shared.fetchPWA(
                AMDOSParityCockpitEventsEnvelope.self,
                path: "/api/progress/events",
                query: ["projectId": projectId, "ym": ym]
            )
            async let reimbursementResponse = AMDOSRESTClient.shared.fetchPWA(
                AMDOSParityCockpitReimbursementsEnvelope.self,
                path: "/api/progress/reimbursement",
                query: ["projectId": projectId, "ym": ym]
            )
            async let scheduleResponse = try? AMDOSRESTClient.shared.fetchPWA(
                AMDOSParityCockpitMsScheduleResponse.self,
                path: "/api/progress/ms-schedule",
                query: ["projectId": projectId, "startYm": planStartYm, "ym": ym]
            )
            let noteResponse = try await note
            let estimateResponse = try await estimates
            let revisionsResponse = try await revisionResponse
            let eventsResponse = try await eventResponse
            let reimbursementsResponse = try await reimbursementResponse
            let schedule = await scheduleResponse
            monthlyNote = noteResponse.note?.body ?? ""
            monthlyNoteUpdatedAt = noteResponse.note?.updatedAt
            monthlyNoteUpdatedBy = noteResponse.note?.updatedBy
            unconfirmed = estimateResponse.unconfirmed ?? []
            revisions = revisionsResponse.revisions ?? []
            progressEvents = eventsResponse.events ?? []
            reimbursements = reimbursementsResponse.items ?? []
            msSchedules = schedule?.schedules ?? []
        } catch {
            // The PWA treats a missing note as empty, but an auth/API failure
            // must remain visible instead of becoming a false empty month.
            message = error.localizedDescription
        }
    }

    func estimateProgress(projectId: String, ym: String) async {
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/progress/estimate", body: AMDOSParityCockpitEstimateInput(projectId: projectId, ym: ym))
            message = "つくよみの進捗推定を更新したよ。採否を確認してね"
            await load(projectId: projectId)
            await loadMonthExtras(projectId: projectId, ym: ym)
        } catch { message = error.localizedDescription }
    }

    func confirmProgress(projectId: String, ym: String, milestoneKey: String, action: String, reason: String? = nil, newPct: Double? = nil) async {
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/progress/confirm",
                body: AMDOSProgressActionInput(projectId: projectId, ym: ym, milestoneKey: milestoneKey, action: action, reason: reason, newPct: newPct)
            )
            message = action == "adopt" ? "推定を採用したよ" : action == "reject" ? "推定を不採用にしたよ" : "推定を修正したよ"
            await load(projectId: projectId)
            await loadMonthExtras(projectId: projectId, ym: ym)
        } catch { message = error.localizedDescription }
    }

    func submitRevision(projectId: String, ym: String, milestone: AMDOSParityCockpitMilestone, current: AMDOSParityCockpitProgress?, requestText: String, revisionId: String? = nil) async {
        let request = requestText.trimmedNonEmpty
        guard let request else {
            message = "修正依頼の本文を入力してね"
            return
        }
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/progress/revisions",
                body: AMDOSParityCockpitRevisionRequest(
                    projectId: projectId,
                    milestoneId: milestone.milestoneId,
                    ym: ym,
                    requestText: request,
                    currentPct: current?.progressPct ?? 0,
                    currentNote: current?.note ?? "",
                    milestoneTitle: milestone.title,
                    revisionId: revisionId
                )
            )
            message = "つくよみにMS修正依頼を送ったよ"
            await loadMonthExtras(projectId: projectId, ym: ym)
        } catch { message = error.localizedDescription }
    }

    func updateRevision(projectId: String, ym: String, revisionId: String, action: String) async {
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/progress/revisions",
                method: "PATCH",
                body: AMDOSParityCockpitRevisionAction(revisionId: revisionId, action: action)
            )
            message = action == "confirm" ? "修正案を確定して進捗へ反映したよ" : "修正案を破棄したよ"
            if let projectId = loadedProjectId { await load(projectId: projectId) }
            await loadMonthExtras(projectId: projectId, ym: ym)
        } catch { message = error.localizedDescription }
    }

    func saveProgressEvent(projectId: String, ym: String, eventId: String, title: String, contentPreview: String, milestoneId: String?, initiativeOrigin: String, impact: Double, depth: Double) async {
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/progress/events",
                method: "PATCH",
                body: AMDOSParityCockpitEventPatch(
                    eventId: eventId,
                    projectId: projectId,
                    ym: ym,
                    title: title,
                    contentPreview: contentPreview,
                    milestoneId: milestoneId?.trimmedNonEmpty,
                    initiativeOrigin: initiativeOrigin,
                    impact: max(0, min(5, impact)),
                    depth: max(0, min(1, depth))
                )
            )
            message = "進捗イベントを保存したよ"
            await loadMonthExtras(projectId: projectId, ym: ym)
        } catch { message = error.localizedDescription }
    }

    /// PWA `CockpitVentureStatusEditModal` と同じ既存API。ここでは構造化は
    /// プレビューの時だけ行い、保存時に利用者が確認したmetaだけをjsonbへ入れる。
    func parseVentureEvent(kind: String, label: String, rawText: String) async -> AMDOSParityCockpitJSON? {
        guard let raw = rawText.trimmedNonEmpty else { return nil }
        do {
            let data = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/project-events/parse",
                body: AMDOSParityCockpitVentureEventParseRequest(kind: kind, label: label, rawText: raw)
            )
            let response = try JSONDecoder().decode(AMDOSParityCockpitVentureEventParseResponse.self, from: data)
            if let error = response.error?.trimmedNonEmpty { throw AMDOSNetworkError.http(error) }
            return response.meta
        } catch {
            message = error.localizedDescription
            return nil
        }
    }

    @discardableResult
    func saveVentureEvent(
        projectId: String,
        existingID: String?,
        occurredOn: String,
        kind: String,
        label: String,
        rawText: String,
        parsed: AMDOSParityCockpitJSON?
    ) async -> Bool {
        guard occurredOn.trimmedNonEmpty != nil, label.trimmedNonEmpty != nil else {
            message = "日付とラベルを入力してね"
            return false
        }
        let meta = amdOSCockpitVentureEventMeta(rawText: rawText, parsed: parsed)
        do {
            if let existingID {
                _ = try await AMDOSRESTClient.shared.patchTable(
                    table: "project_events",
                    filters: ["id": "eq.\(existingID)"],
                    body: AMDOSParityCockpitVentureEventPatch(
                        occurredOn: occurredOn,
                        kind: kind,
                        label: label,
                        meta: meta,
                        updatedAt: ISO8601DateFormatter().string(from: .now)
                    )
                )
            } else {
                _ = try await AMDOSRESTClient.shared.postTable(
                    table: "project_events",
                    body: AMDOSParityCockpitVentureEventInsert(
                        projectId: projectId,
                        occurredOn: occurredOn,
                        kind: kind,
                        label: label,
                        meta: meta,
                        source: "manual"
                    )
                )
            }
            message = existingID == nil ? "PJイベントを追加したよ" : "PJイベントを更新したよ"
            await load(projectId: projectId)
            return true
        } catch {
            message = error.localizedDescription
            return false
        }
    }

    @discardableResult
    func deleteVentureEvent(projectId: String, eventId: String) async -> Bool {
        do {
            try await AMDOSRESTClient.shared.deleteTable(table: "project_events", filters: ["id": "eq.\(eventId)"])
            message = "PJイベントを削除したよ"
            await load(projectId: projectId)
            return true
        } catch {
            message = error.localizedDescription
            return false
        }
    }

    func syncReward(projectId: String, ym: String) async {
        do {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/rewards/sync", body: AMDOSParityCockpitRewardSyncRequest(projectId: projectId, ym: ym))
            let response = try JSONDecoder().decode(AMDOSParityCockpitRewardSyncResponse.self, from: data)
            guard response.ok != false else { throw AMDOSNetworkError.http(response.error ?? "報酬サマリーを同期できなかったよ") }
            message = response.syncOk == false ? "報酬サマリーを再計算したけど、要確認の結果があるよ" : "報酬サマリーを同期したよ"
            if let projectId = loadedProjectId { await load(projectId: projectId) }
        } catch { message = error.localizedDescription }
    }

    func generateReport(projectId: String, ym: String, feedback: String?) async {
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/report/generate", body: AMDOSParityCockpitReportInput(projectId: projectId, ym: ym, feedback: feedback?.trimmedNonEmpty))
            message = "月次報告書の生成を依頼したよ"
            await load(projectId: projectId)
        } catch { message = error.localizedDescription }
    }

    func fixReport(projectId: String, ym: String) async {
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/report/fix", body: AMDOSParityCockpitFixInput(projectId: projectId, ym: ym))
            message = "月次報告書をFIXしたよ"
            await load(projectId: projectId)
        } catch { message = error.localizedDescription }
    }

    func uploadDocuments(projectId: String, urls: [URL]) async {
        do {
            let files = try urls.map { url -> AMDOSUploadFile in
                guard url.startAccessingSecurityScopedResource() else { throw AMDOSNetworkError.http("ファイルを読み取れなかったよ") }
                defer { url.stopAccessingSecurityScopedResource() }
                let data = try Data(contentsOf: url)
                return AMDOSUploadFile(fieldName: "files", filename: url.lastPathComponent, mimeType: UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream", data: data)
            }
            _ = try await AMDOSRESTClient.shared.uploadMultipart(path: "/api/project-documents", fields: ["project_id": projectId], files: files)
            message = "資料を保存したよ"
            await load(projectId: projectId)
        } catch { message = error.localizedDescription }
    }

    func replaceMeeting(_ meeting: AMDOSParityCockpitMeeting) {
        guard let index = meetings.firstIndex(where: { $0.meetingId == meeting.meetingId }) else { return }
        meetings[index] = meeting
    }

    func prepArchive(for meeting: AMDOSParityCockpitMeeting) -> AMDOSParityCockpitMeeting? {
        let sourceKinds = amdOSMeetingSourceKindTokens(meeting.sourceKinds)
        guard !(sourceKinds.contains("upcoming") && !sourceKinds.contains("upcoming_tentative")) else { return nil }
        let eventId = meeting.calendarEventId?.trimmedNonEmpty ?? meeting.meetingId
        return meetings.first { candidate in
            let candidateKinds = amdOSMeetingSourceKindTokens(candidate.sourceKinds)
            let meaningful = candidate.prepDraftMd?.trimmedNonEmpty != nil || candidate.prepReadinessScore != nil || candidate.prepWorkerStatus == "ready" || candidate.prepWorkerSessionId?.trimmedNonEmpty != nil || ((candidate.generatedByModel?.trimmedNonEmpty ?? "") != "calendar-future-sync" && candidate.generatedByModel?.trimmedNonEmpty != nil)
            return (candidateKinds.contains("upcoming") || candidateKinds.contains("upcoming_tentative") || (candidate.meetingId.hasPrefix("upcoming:") && candidateKinds.isEmpty)) && meaningful && (candidate.calendarEventId == eventId || candidate.meetingId == "upcoming:\(eventId)")
        }
    }

    func fetchMarkdown(documentId: String) async throws -> String {
        let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSParityCockpitDocumentContent.self, path: "/api/project-documents/\(documentId)/content")
        if response.ok == false { throw AMDOSNetworkError.http(response.error ?? "資料本文を取得できなかったよ") }
        return response.markdown ?? ""
    }

    func saveMarkdown(documentId: String, markdown: String) async throws -> String {
        let data = try await AMDOSRESTClient.shared.sendPWA(
            path: "/api/project-documents/\(documentId)/content",
            method: "PATCH",
            body: AMDOSParityCockpitDocumentContentPatch(markdown: markdown)
        )
        let response = try JSONDecoder().decode(AMDOSParityCockpitDocumentContent.self, from: data)
        if response.ok == false { throw AMDOSNetworkError.http(response.error ?? "資料本文を保存できなかったよ") }
        return response.markdown ?? markdown
    }
}

private struct AMDOSParityCockpitEstimateInput: Encodable, Sendable {
    let projectId: String
    let ym: String
}

private struct AMDOSParityCockpitUnconfirmedEnvelope: Codable, Sendable {
    let ok: Bool?
    let unconfirmed: [AMDOSParityCockpitUnconfirmed]?
    let error: String?
}

private struct AMDOSCockpitMemberName: Codable, Sendable {
    let memberId: String
    let codeName: String?
    enum CodingKeys: String, CodingKey { case memberId = "member_id", codeName = "code_name" }
}

private func amdOSCockpitYmLabel(_ ym: String) -> String {
    guard ym.count >= 6 else { return ym }
    return "\(ym.prefix(4))/\(ym.suffix(2))"
}

private func amdOSCockpitYen(_ value: Double?) -> String {
    guard let value else { return "—" }
    return "¥\(Int(value.rounded()).formatted())"
}

private func amdOSCockpitLatestProgress(
    _ rows: [AMDOSParityCockpitProgress],
    milestoneId: String,
    ym: String
) -> AMDOSParityCockpitProgress? {
    rows
        .filter { $0.milestoneKey == milestoneId && $0.ym <= ym }
        .sorted { $0.ym < $1.ym }
        .last
}

private func amdOSCockpitCurrentYm() -> String {
    let components = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: .now)
    return String(format: "%04d%02d", components.year ?? 0, components.month ?? 0)
}

struct AMDOSParityProjectCockpitView: View {
    let projectId: String?
    let initialYM: String?
    let initialTab: String?
    let initialMeetingID: String?
    let initialDocumentID: String?
    let onOpenConfig: (String) -> Void
    let onOpenGovernance: () -> Void
    /// Institution cockpit reuses the same PWA-backed project content instead
    /// of creating a second, reduced project reader.
    let embedded: Bool
    @EnvironmentObject private var auth: AMDOSAuthStore
    @StateObject private var store = AMDOSParityCockpitStore()
    @State private var activeTab: String
    @State private var selectedYm: String
    @State private var progressDraft: [String: String] = [:]
    @State private var monthlyNote = ""
    @State private var reportFeedback = ""
    @State private var showPastCycles = false
    @State private var showAllMeetings = false
    @State private var showImporter = false
    @State private var selectedDocument: AMDOSParityCockpitDocument?
    @State private var documentMarkdown = ""
    @State private var documentState: AMDOSFeatureLoadState = .idle
    @State private var documentEditing = false
    @State private var documentDraft = ""
    @State private var documentSaving = false
    @State private var actionBusy = false
    @State private var revisionTarget: String?
    @State private var revisionText = ""
    @State private var editingEventID: String?
    @State private var eventTitle = ""
    @State private var eventContent = ""
    @State private var eventMilestoneID = ""
    @State private var eventOrigin = "unknown"
    @State private var eventImpact = "0"
    @State private var eventDepth = "0"
    @State private var selectedMeeting: AMDOSParityCockpitMeeting?
    @State private var selectedStrategySignal: AMDOSParityCockpitSignal?
    @State private var ventureEventEditor: AMDOSParityCockpitVentureEventEditorTarget?
    @State private var manualProgressTarget: String?
    @State private var manualProgressPct = ""
    @State private var manualProgressReason = ""

    init(projectId: String?, initialYM: String? = nil, initialTab: String? = nil, initialMeetingID: String? = nil, initialDocumentID: String? = nil, onOpenConfig: @escaping (String) -> Void, onOpenGovernance: @escaping () -> Void = {}, embedded: Bool = false) {
        self.projectId = projectId
        self.initialYM = initialYM
        self.initialTab = initialTab
        self.initialMeetingID = initialMeetingID
        self.initialDocumentID = initialDocumentID
        self.onOpenConfig = onOpenConfig
        self.onOpenGovernance = onOpenGovernance
        self.embedded = embedded
        _selectedYm = State(initialValue: initialYM?.count == 6 ? initialYM! : amdOSCockpitCurrentYm())
        _activeTab = State(initialValue: ["progress", "score-detail", "company"].contains(initialTab ?? "") ? initialTab! : "progress")
    }
    var body: some View {
        Group {
            if embedded {
                cockpitContent
            } else {
                AMDOSPageScaffold(
                    eyebrow: "PROJECT COCKPIT",
                    title: store.project?.projectName ?? "プロジェクトコックピット",
                    subtitle: "PWA CockpitViewの進捗・スコア・会社概要・月次判断を、プロジェクト単位の実データで操作"
                ) {
                    cockpitContent
                }
            }
        }
        .task(id: projectId) { reload() }
        .sheet(item: $selectedMeeting) { meeting in
            AMDOSParityCockpitMeetingDetail(meeting: meeting, prepMeeting: store.prepArchive(for: meeting)) { updated in
                selectedMeeting = updated
                store.replaceMeeting(updated)
            }
        }
        .sheet(item: $selectedStrategySignal) { signal in
            AMDOSParityCockpitStrategySignalFeedbackView(
                signal: signal,
                projectID: projectId ?? signal.projectId,
                onConfirmed: { reload() }
            )
        }
        .sheet(item: $ventureEventEditor) { target in
            AMDOSParityCockpitVentureEventEditor(
                store: store,
                projectId: projectId ?? target.event?.projectId ?? "",
                event: target.event,
                initialDate: target.initialDate,
                onClose: { ventureEventEditor = nil }
            )
        }
        .onChange(of: selectedYm) { _, value in
            syncProgressDraft()
            monthlyNote = ""
            guard let projectId else { return }
            Task {
                await store.loadMonthExtras(projectId: projectId, ym: value)
                monthlyNote = store.monthlyNote
            }
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.data, .content, .pdf, .plainText, .image], allowsMultipleSelection: true) { result in
            guard let projectId, case .success(let urls) = result else { return }
            Task { await store.uploadDocuments(projectId: projectId, urls: urls) }
        }
    }

    @ViewBuilder
    private var cockpitContent: some View {
        AMDOSStateNotice(state: store.state) { reload() }
        if let project = store.project {
            projectHeader(project)
            cockpitTabs(project: project)
            if activeTab == "progress" {
                progressTab(project: project)
            } else if activeTab == "score-detail" {
                AMDOSParityAMDScoreDetailView(projectId: project.projectId)
            } else {
                AMDOSParityCockpitCompanyView(projectId: project.projectId, projectName: project.projectName)
            }
            if let message = store.message?.trimmedNonEmpty {
                Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
            }
        }
    }

    @ViewBuilder
    private func projectHeader(_ project: AMDOSParityCockpitProject) -> some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(project.projectName).font(.title2.weight(.bold))
                        Text([project.clientName, project.projectId].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · "))
                            .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer()
                    AMDOSStatusBadge(text: project.status ?? "状態未確認", tint: project.status == "active" ? AMDOSDesign.success : AMDOSDesign.warning)
                    Button("設定を開く") { onOpenConfig(project.projectId) }.buttonStyle(.bordered)
                }
                HStack(spacing: 8) {
                    AMDOSStatusBadge(text: project.projectCategory ?? "dtsu", tint: AMDOSDesign.blue)
                    if let fee = project.feeAmount { AMDOSStatusBadge(text: "\(project.feeType ?? "報酬") \(amdOSCockpitYen(fee))", tint: AMDOSDesign.blue) }
                    if project.startYm != nil || project.endYm != nil {
                        AMDOSStatusBadge(text: "期間 \([project.startYm, project.endYm].compactMap { $0 }.map(amdOSCockpitYmLabel).joined(separator: " 〜 "))", tint: AMDOSDesign.muted)
                    }
                    Text("担当: \(store.memberNames.values.sorted().joined(separator: " / ").nilIfEmpty ?? "未設定")")
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                HStack(spacing: 8) {
                    if let freeze = project.freezeFromYm {
                        AMDOSStatusBadge(text: freeze <= amdOSCockpitCurrentYm() ? "❄︎ \(amdOSCockpitYmLabel(freeze)) から凍結中" : "⚠︎ \(amdOSCockpitYmLabel(freeze)) から凍結予定", tint: AMDOSDesign.warning)
                    }
                    if let restart = project.restartExpectedYm, restart > amdOSCockpitCurrentYm() {
                        AMDOSStatusBadge(text: "再開予定 \(amdOSCockpitYmLabel(restart))", tint: AMDOSDesign.blue)
                    }
                    if let paymentRule = project.paymentDueRule {
                        Text("支払条件: \(paymentRule)\(project.paymentDueDay.map { " / \($0)日" } ?? "")").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func cockpitTabs(project: AMDOSParityCockpitProject) -> some View {
        Picker("コックピット", selection: $activeTab) {
            Text("進捗管理").tag("progress")
            if project.projectId != "p00" && project.projectCategory != "ecosystem" {
                Text("スコア詳細").tag("score-detail")
            }
            Text("会社概要").tag("company")
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private func progressTab(project: AMDOSParityCockpitProject) -> some View {
        let currentPct = projectProgress(for: selectedYm)
        VStack(alignment: .leading, spacing: 14) {
            if project.projectId == "p00" {
                AMDOSParityCockpitManagementScoreHero(snapshots: store.managementScoreSnapshots)
            }
            if project.projectId == "p25" {
                AMDOSParityCockpitKuteAnnualRoadmap(currentYm: amdOSCockpitCurrentYm())
            }
            if let freezeFromYm = project.freezeFromYm,
               let restartExpectedYm = project.restartExpectedYm,
               amdOSCockpitCurrentYm() >= restartExpectedYm {
                AMDOSParityCockpitFreezeBackfillCard(
                    freezeFromYm: freezeFromYm,
                    restartExpectedYm: restartExpectedYm,
                    backfill: store.freezeBackfills.first {
                        $0.freezeFromYm == freezeFromYm && $0.restartYm == restartExpectedYm
                    }
                )
            }
            if store.venture != nil {
                ventureStatusSection(project: project)
            }
            HStack(spacing: 14) {
                AMDOSMetricTile(label: "今月のMS進捗", value: "\(Int(currentPct.rounded()))%", detail: amdOSCockpitYmLabel(selectedYm), tint: currentPct >= 80 ? AMDOSDesign.success : AMDOSDesign.blue)
                AMDOSMetricTile(label: "月次予算", value: amdOSCockpitYen(store.billingCycles.first(where: { $0.ym == selectedYm })?.budgetYen), detail: "billing_cycles", tint: AMDOSDesign.blue)
                AMDOSMetricTile(label: "未確定推定", value: "\(store.unconfirmed.count)件", detail: "採用 / 不採用を確認", tint: store.unconfirmed.isEmpty ? AMDOSDesign.muted : AMDOSDesign.warning)
                AMDOSMetricTile(label: "確認待ちタスク", value: "\(store.tasks.filter { $0.status != "done" }.count)", detail: "tasks", tint: AMDOSDesign.warning)
            }
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 14) {
                    currentMilestones(project: project)
                    monthlyList
                    monthDetail(project: project)
                    revisionsSection(project: project)
                    eventsAndReimbursementsSection(project: project)
                    taskSection
                    if !store.changeEvents.isEmpty { changeHistory }
                    if !store.pastBundles.isEmpty { pastCycles }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 14) {
                    documentsSection(project: project)
                    signalsSection
                    grantsSection
                    meetingsSection
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    /// PWA `CockpitVentureStatus` と同じ `project_ventures` / `project_events` /
    /// `project_xrl_log` をここで表示する。イベントの保存・削除は別routeに逃がさず、
    /// PWAと同じRLS対象テーブルと既存parse APIを使う。
    @ViewBuilder
    private func ventureStatusSection(project: AMDOSParityCockpitProject) -> some View {
        if let venture = store.venture {
            AMDOSSectionCard("ベンチャーの現在地", systemImage: "chart.xyaxis.line") {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(venture.shortLabel?.trimmedNonEmpty ?? project.projectName)
                            .font(.headline)
                        Text([venture.lane, venture.outcomePattern, venture.foundedAt]
                            .compactMap { $0?.trimmedNonEmpty }
                            .joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer()
                    Button("スコア詳細") { activeTab = "score-detail" }
                        .buttonStyle(.bordered)
                }

                if let description = (venture.longDescription ?? venture.shortDescription)?.trimmedNonEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                        .textSelection(.enabled)
                }

                let ventureMeta = [
                    ("起点", venture.originOrg),
                    ("PI", venture.originPI),
                    ("AMDの役割", venture.amdRole),
                    ("支援開始", venture.amdSupportStartedAt),
                ].compactMap { label, value in
                    value?.trimmedNonEmpty.map { "\(label): \($0)" }
                }
                if !ventureMeta.isEmpty {
                    Text(ventureMeta.joined(separator: " / "))
                        .font(.caption2)
                        .foregroundStyle(AMDOSDesign.muted)
                }

                if let latestXrl = store.ventureXRL.sorted(by: { $0.observedAt > $1.observedAt }).first {
                    HStack(spacing: 8) {
                        Text("最新XRL \(latestXrl.observedAt)").font(.caption.weight(.semibold))
                        ForEach(["TRL", "BRL", "GRL", "SRL", "HRL"], id: \.self) { axis in
                            let value: Double? = switch axis {
                            case "TRL": latestXrl.trl
                            case "BRL": latestXrl.brl
                            case "GRL": latestXrl.grl
                            case "SRL": latestXrl.srl
                            default: latestXrl.hrl
                            }
                            AMDOSStatusBadge(text: "\(axis) \(value.map { String(Int($0.rounded())) } ?? "—")", tint: AMDOSDesign.blue)
                        }
                        Spacer()
                    }
                    if let bottleneck = latestXrl.bottleneck?.trimmedNonEmpty {
                        Text("ボトルネック: \(bottleneck)")
                            .font(.caption2)
                            .foregroundStyle(AMDOSDesign.warning)
                            .textSelection(.enabled)
                    }
                }

                HStack {
                    Text("イベント履歴").font(.subheadline.weight(.semibold))
                    Spacer()
                    Button("イベントを追加") {
                        ventureEventEditor = AMDOSParityCockpitVentureEventEditorTarget(
                            event: nil,
                            initialDate: ISO8601DateFormatter().string(from: .now)
                        )
                    }
                    .buttonStyle(.borderedProminent)
                }
                if store.ventureEvents.isEmpty {
                    Text("PJイベントはまだないよ。PWAと同じイベントを追加すると、スコア・XRLの根拠に使える。")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                }
                ForEach(store.ventureEvents.sorted(by: {
                    if $0.occurredOn == $1.occurredOn { return $0.createdAt ?? "" > $1.createdAt ?? "" }
                    return $0.occurredOn > $1.occurredOn
                })) { event in
                    Button {
                        ventureEventEditor = AMDOSParityCockpitVentureEventEditorTarget(event: event, initialDate: event.occurredOn)
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(event.label).font(.subheadline.weight(.medium))
                                Spacer()
                                AMDOSStatusBadge(text: event.kind, tint: AMDOSDesign.blue)
                                Text(String(event.occurredOn.prefix(10))).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            }
                            if let raw = amdOSCockpitMetaRawText(event.meta).trimmedNonEmpty {
                                Text(raw).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                    Divider()
                }
            }
        }
    }

    @ViewBuilder
    private func currentMilestones(project: AMDOSParityCockpitProject) -> some View {
        AMDOSSectionCard("今期のマイルストーン", systemImage: "chart.line.uptrend.xyaxis") {
            if let bundle = store.currentBundle {
                HStack {
                    Text("\(amdOSCockpitYmLabel(bundle.cycle.periodStartYm)) 〜 \(amdOSCockpitYmLabel(bundle.cycle.periodEndYm))")
                    Spacer()
                    AMDOSStatusBadge(text: bundle.cycle.status ?? "状態未確認", tint: bundle.cycle.status == "draft" ? AMDOSDesign.warning : AMDOSDesign.blue)
                    Text("\(Int(bundle.cycle.totalPoints ?? 0))pt / \(amdOSCockpitYen(bundle.cycle.budgetYen))").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                if bundle.milestones.isEmpty {
                    Text("このPlanCycleには有効なMSがないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                ForEach(bundle.milestones) { milestone in
                    milestoneRow(milestone, bundle: bundle, project: project)
                }
            } else {
                Text("現在月を含むPlanCycleがないよ。adminのMS一覧で設定してね。").font(.caption).foregroundStyle(AMDOSDesign.warning)
            }
        }
    }

    @ViewBuilder
    private func milestoneRow(
        _ milestone: AMDOSParityCockpitMilestone,
        bundle: AMDOSParityCockpitCycleBundle,
        project: AMDOSParityCockpitProject
    ) -> some View {
        let current = amdOSCockpitLatestProgress(bundle.progress, milestoneId: milestone.milestoneId, ym: selectedYm)
        let pct = max(0, min(100, current?.progressPct ?? 0))
        let subs = bundle.subItems.filter { $0.milestoneId == milestone.milestoneId }
        let responsibilities = bundle.responsibilities.filter { $0.milestoneId == milestone.milestoneId }
        let schedule = store.msSchedules.first { $0.milestoneId == milestone.milestoneId }
        let activityNarratives = store.memberMsActivities
            .filter { $0.milestoneId == milestone.milestoneId && $0.ym == selectedYm }
            .compactMap { $0.narrative?.trimmedNonEmpty }
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .firstTextBaseline) {
                Text(milestone.title).font(.subheadline.weight(.semibold))
                if let tag = milestone.tag { AMDOSStatusBadge(text: tag, tint: AMDOSDesign.blue) }
                Spacer()
                Text("\(Int(pct.rounded()))% · \(Int((milestone.points ?? 0).rounded()))pt").font(.caption.weight(.semibold)).foregroundStyle(pct >= 80 ? AMDOSDesign.success : pct > 0 ? AMDOSDesign.blue : AMDOSDesign.muted)
            }
            ProgressView(value: pct / 100)
            if let schedule {
                Text("予定 \(Int(schedule.expectedCumPct.rounded()))% · \(schedule.periodStartYm) 〜 \(schedule.targetYm) · 月次 \(String(format: "%.1f", schedule.monthlyPt))pt")
                    .font(.caption2)
                    .foregroundStyle(AMDOSDesign.muted)
            }
            if let criteria = milestone.successCriteria?.trimmedNonEmpty {
                Text(criteria).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(3)
            }
            if !responsibilities.isEmpty {
                Text("担当: " + responsibilities.map { "\(store.memberNames[$0.memberId] ?? $0.memberId) \(Int((($0.share ?? 0) * 100).rounded()))%" }.joined(separator: " / "))
                    .font(.caption2).foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(subs) { item in
                Button {
                    Task { await store.toggleSubItem(item) }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: item.status == "done" ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(item.status == "done" ? AMDOSDesign.success : AMDOSDesign.muted)
                        Text(item.title).strikethrough(item.status == "done")
                        Spacer()
                        Text(item.assignee ?? "").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                }
                .buttonStyle(.plain)
            }
            if let note = current?.note?.trimmedNonEmpty {
                Text(note).font(.caption2).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
            }
            if !activityNarratives.isEmpty {
                Text("担当活動: \(activityNarratives.joined(separator: " / "))")
                    .font(.caption2)
                    .foregroundStyle(AMDOSDesign.muted)
                    .lineLimit(3)
                    .textSelection(.enabled)
            }
        }
        .padding(.vertical, 4)
        .overlay(alignment: .bottom) { Divider() }
    }

    @ViewBuilder
    private var monthlyList: some View {
        AMDOSSectionCard("月次一覧", systemImage: "calendar") {
            let months = monthRows
            if months.isEmpty {
                Text("billing_cycles / monthly_reports に表示できる月がないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(months, id: \.self) { ym in
                    Button {
                        selectedYm = ym
                        syncProgressDraft()
                    } label: {
                        HStack(spacing: 8) {
                            Text(amdOSCockpitYmLabel(ym)).font(.subheadline.weight(.medium))
                            if ym == amdOSCockpitCurrentYm() { AMDOSStatusBadge(text: "今月", tint: AMDOSDesign.blue) }
                            if let billing = store.billingCycles.first(where: { $0.ym == ym }) {
                                AMDOSStatusBadge(text: billing.meetingStartAt == nil ? "会議未確認" : "会議済", tint: billing.meetingStartAt == nil ? AMDOSDesign.muted : AMDOSDesign.success)
                                AMDOSStatusBadge(text: billing.reportFixedAt == nil ? "報告未FIX" : "報告FIX", tint: billing.reportFixedAt == nil ? AMDOSDesign.warning : AMDOSDesign.success)
                                Text(amdOSCockpitYen(billing.budgetReportedAmount ?? billing.budgetYen)).font(.caption).foregroundStyle(AMDOSDesign.muted)
                            } else if let report = store.reports.first(where: { $0.ym == ym }) {
                                AMDOSStatusBadge(text: report.finalContent?.trimmedNonEmpty != nil ? "月次FIX" : "月次下書き", tint: report.finalContent?.trimmedNonEmpty != nil ? AMDOSDesign.success : AMDOSDesign.warning)
                            }
                            Spacer()
                            Text(ym == selectedYm ? "選択中" : "詳細").font(.caption2).foregroundStyle(ym == selectedYm ? AMDOSDesign.blue : AMDOSDesign.muted)
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.vertical, 3)
                }
            }
        }
    }

    private var monthRows: [String] {
        let current = amdOSCockpitCurrentYm()
        let next = nextYm(current)
        return Array(Set(store.billingCycles.map(\.ym) + store.reports.map(\.ym) + [current, next]))
            .filter { $0 >= "202512" && $0 <= next }
            .sorted(by: >)
    }

    private func nextYm(_ ym: String) -> String {
        guard ym.count >= 6, let year = Int(ym.prefix(4)), let month = Int(ym.suffix(2)) else { return ym }
        return month == 12 ? String(format: "%04d01", year + 1) : String(format: "%04d%02d", year, month + 1)
    }

    private func projectProgress(for ym: String) -> Double {
        guard let bundle = store.planCycles.first(where: { ym >= $0.periodStartYm && ym <= $0.periodEndYm }) else { return 0 }
        let milestones = store.currentBundle?.cycle.planCycleId == bundle.planCycleId ? store.currentBundle?.milestones ?? [] : store.pastBundles.first(where: { $0.cycle.planCycleId == bundle.planCycleId })?.milestones ?? []
        let progress = store.currentBundle?.cycle.planCycleId == bundle.planCycleId ? store.currentBundle?.progress ?? [] : store.pastBundles.first(where: { $0.cycle.planCycleId == bundle.planCycleId })?.progress ?? []
        let counted = milestones.filter { ($0.tag ?? "").lowercased() != "buffer" }
        let points = counted.reduce(0) { $0 + ($1.points ?? 0) }
        guard points > 0 else { return 0 }
        return counted.reduce(0) { partial, milestone in
            partial + (amdOSCockpitLatestProgress(progress, milestoneId: milestone.milestoneId, ym: ym)?.progressPct ?? 0) * (milestone.points ?? 0)
        } / points
    }

    @ViewBuilder
    private func monthDetail(project: AMDOSParityCockpitProject) -> some View {
        AMDOSSectionCard("\(amdOSCockpitYmLabel(selectedYm)) 月次判断", systemImage: "slider.horizontal.3") {
            if let billing = store.billingCycles.first(where: { $0.ym == selectedYm }) {
                HStack {
                    AMDOSStatusBadge(text: billing.status ?? "状態未確認")
                    LabeledContent("予算", value: amdOSCockpitYen(billing.budgetYen))
                    LabeledContent("報告額", value: amdOSCockpitYen(billing.budgetReportedAmount))
                    LabeledContent("入金", value: billing.paymentConfirmedAt == nil ? "未確認" : "確認済み")
                }
            } else {
                Text("この月には請求サイクルがないよ。月次報告だけを保存できる状態だよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            if auth.isAdmin {
                Button("報酬サマリーを同期") {
                    Task { await store.syncReward(projectId: project.projectId, ym: selectedYm) }
                }
                .buttonStyle(.bordered)
            }
            if !store.unconfirmed.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("つくよみ推定の採否").font(.subheadline.weight(.semibold))
                    ForEach(store.unconfirmed) { row in
                        HStack {
                            Text(row.milestoneKey).font(.caption.weight(.medium))
                            Text("\(Int((row.prevPct ?? 0).rounded()))% → \(Int((row.progressPct ?? 0).rounded()))%").font(.caption)
                            Text(row.reason ?? "").font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(1)
                            Spacer()
                            if auth.isAdmin {
                                Button("採用") { Task { await store.confirmProgress(projectId: project.projectId, ym: selectedYm, milestoneKey: row.milestoneKey, action: "adopt") } }.buttonStyle(.borderedProminent)
                                Button("不採用") { Task { await store.confirmProgress(projectId: project.projectId, ym: selectedYm, milestoneKey: row.milestoneKey, action: "reject", reason: "Macで不採用") } }.buttonStyle(.bordered)
                            }
                        }
                    }
                }
            }
            if let bundle = store.currentBundle {
                ForEach(bundle.milestones) { milestone in
                    let value = amdOSCockpitLatestProgress(bundle.progress, milestoneId: milestone.milestoneId, ym: selectedYm)?.progressPct ?? 0
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(milestone.title).font(.caption.weight(.semibold))
                            Spacer()
                            if auth.isAdmin {
                                Button(manualProgressTarget == milestone.milestoneId ? "手動編集を閉じる" : "このMSを手動編集") {
                                    if manualProgressTarget == milestone.milestoneId {
                                        manualProgressTarget = nil
                                    } else {
                                        manualProgressTarget = milestone.milestoneId
                                        manualProgressPct = String(Int(value.rounded()))
                                        manualProgressReason = ""
                                    }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                        AMDOSTextField(title: "\(milestone.title) の進捗 %", text: Binding(
                            get: { progressDraft[milestone.milestoneId] ?? String(Int(value.rounded())) },
                            set: { progressDraft[milestone.milestoneId] = $0 }
                        ))
                        if manualProgressTarget == milestone.milestoneId {
                            AMDOSTextField(title: "手動進捗 %", text: $manualProgressPct)
                            AMDOSTextField(title: "根拠 / メモ", text: $manualProgressReason, axis: .vertical)
                            HStack {
                                Button("このMSを保存") {
                                    guard let pct = Double(manualProgressPct), (0...100).contains(pct) else {
                                        store.message = "進捗は0〜100で入力してね"
                                        return
                                    }
                                    Task {
                                        await store.confirmProgress(
                                            projectId: project.projectId,
                                            ym: selectedYm,
                                            milestoneKey: milestone.milestoneId,
                                            action: "manual",
                                            reason: manualProgressReason.trimmedNonEmpty,
                                            newPct: pct
                                        )
                                        manualProgressTarget = nil
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                Button("キャンセル") { manualProgressTarget = nil }.buttonStyle(.bordered)
                            }
                            Text("PWA MonthlyModalと同じ /api/progress/confirm の manual 操作。保存はこのMSだけに反映する。")
                                .font(.caption2)
                                .foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                }
                HStack {
                    if auth.isAdmin {
                        Button(actionBusy ? "保存中…" : "進捗を一括保存") {
                            actionBusy = true
                            let values = progressDraft.reduce(into: [String: Double]()) { result, entry in
                                if let value = Double(entry.value) { result[entry.key] = value }
                            }
                            Task {
                                await store.saveProgress(projectId: project.projectId, ym: selectedYm, values: values)
                                actionBusy = false
                            }
                        }.buttonStyle(.borderedProminent).disabled(actionBusy)
                        Button("つくよみで再推定") { Task { await store.estimateProgress(projectId: project.projectId, ym: selectedYm) } }.buttonStyle(.bordered)
                    } else {
                        Text("進捗の保存・推定・採否はPWAと同じadmin権限が必要だよ").font(.caption).foregroundStyle(AMDOSDesign.warning)
                    }
                }
            }
            AMDOSTextField(title: "月次ノート", text: $monthlyNote, axis: .vertical)
            HStack {
                Button("ノートを保存") { Task { await store.saveNote(projectId: project.projectId, ym: selectedYm, body: monthlyNote) } }.buttonStyle(.bordered)
                if let updated = store.monthlyNoteUpdatedAt { Text("更新 \(updated)").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
            }
            if let report = store.reports.first(where: { $0.ym == selectedYm }) {
                AMDOSSectionCard("月次報告書", systemImage: "doc.richtext") {
                    Text(report.finalContent ?? report.draftContent ?? "本文はまだないよ。").font(.caption).textSelection(.enabled)
                    if auth.isAdmin {
                        AMDOSTextField(title: "修正指示", text: $reportFeedback, axis: .vertical)
                        HStack {
                            Button("生成 / 再生成") { Task { await store.generateReport(projectId: project.projectId, ym: selectedYm, feedback: reportFeedback) } }.buttonStyle(.bordered)
                            Button("FIX（確定）") { Task { await store.fixReport(projectId: project.projectId, ym: selectedYm) } }.buttonStyle(.borderedProminent).disabled(report.draftContent?.trimmedNonEmpty == nil || report.status == "fixed")
                        }
                    }
                }
            } else if auth.isAdmin {
                AMDOSSectionCard("月次報告書", systemImage: "doc.richtext") {
                    Text("この月の報告書はまだ作られていないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    AMDOSTextField(title: "生成時の修正指示", text: $reportFeedback, axis: .vertical)
                    Button("報告書を生成") { Task { await store.generateReport(projectId: project.projectId, ym: selectedYm, feedback: reportFeedback) } }.buttonStyle(.bordered)
                }
            }
        }
    }

    @ViewBuilder
    private func revisionsSection(project: AMDOSParityCockpitProject) -> some View {
        AMDOSSectionCard("MS修正依頼", systemImage: "arrow.triangle.2.circlepath") {
            if let bundle = store.currentBundle, !bundle.milestones.isEmpty {
            Text("つくよみに根拠つきで再提案を依頼し、返った案を確定または破棄できる。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            ForEach(bundle.milestones) { milestone in
                let rows = store.revisions.filter { $0.milestoneId == milestone.milestoneId }
                let current = amdOSCockpitLatestProgress(bundle.progress, milestoneId: milestone.milestoneId, ym: selectedYm)
                VStack(alignment: .leading, spacing: 7) {
                    HStack {
                        Text(milestone.title).font(.subheadline.weight(.semibold))
                        Spacer()
                        Text("現在 \(Int((current?.progressPct ?? 0).rounded()))%").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        if auth.isAdmin {
                            Button(revisionTarget == milestone.milestoneId ? "閉じる" : "修正を依頼") {
                                revisionTarget = revisionTarget == milestone.milestoneId ? nil : milestone.milestoneId
                                revisionText = ""
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    if revisionTarget == milestone.milestoneId {
                        AMDOSTextField(title: "修正依頼", text: $revisionText, axis: .vertical)
                        HStack {
                            Button("つくよみに送信") {
                                Task {
                                    await store.submitRevision(projectId: project.projectId, ym: selectedYm, milestone: milestone, current: current, requestText: revisionText)
                                    revisionText = ""
                                    revisionTarget = nil
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            Button("キャンセル") { revisionTarget = nil }.buttonStyle(.bordered)
                        }
                    }
                    if rows.isEmpty {
                        Text("この月の修正案はまだないよ。").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    ForEach(rows) { revision in
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                AMDOSStatusBadge(text: revision.status, tint: revision.status == "confirmed" ? AMDOSDesign.success : revision.status == "discarded" ? AMDOSDesign.muted : AMDOSDesign.warning)
                                Text("提案 \(Int((revision.revisedPct ?? 0).rounded()))%").font(.caption.weight(.semibold))
                            }
                            if let note = revision.revisedNote?.trimmedNonEmpty { Text(note).font(.caption).textSelection(.enabled) }
                            ForEach(revision.messages) { message in
                                Text("\(message.senderKind == "pm" ? "依頼" : "つくよみ"): \(message.body)")
                                    .font(.caption2).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
                            }
                            if auth.isAdmin && revision.status == "pending" {
                                HStack {
                                    Button("確定") { Task { await store.updateRevision(projectId: project.projectId, ym: selectedYm, revisionId: revision.id, action: "confirm") } }
                                        .buttonStyle(.borderedProminent)
                                    Button("破棄") { Task { await store.updateRevision(projectId: project.projectId, ym: selectedYm, revisionId: revision.id, action: "discard") } }
                                        .buttonStyle(.bordered)
                                }
                            }
                        }
                        .padding(8)
                        .background(AMDOSDesign.page.opacity(0.55))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
                .padding(.vertical, 5)
                Divider()
            }
            } else {
                Text("この月に修正依頼できるMSがないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
        }
    }

    @ViewBuilder
    private func eventsAndReimbursementsSection(project: AMDOSParityCockpitProject) -> some View {
        AMDOSSectionCard("進捗イベント", systemImage: "bolt.fill") {
            let active = store.progressEvents.filter { $0.status != "rejected" }
            let judgeable = active.filter { $0.initiativeOrigin != "external" }
            let proactive = judgeable.isEmpty ? nil : Double(judgeable.filter { $0.initiativeOrigin == "amd_proposed" || $0.initiativeOrigin == "co_decided" }.count) / Double(judgeable.count) * 100
            HStack {
                AMDOSStatusBadge(text: proactive.map { "先手力 \(Int($0.rounded()))%" } ?? "先手力 —", tint: proactive == nil ? AMDOSDesign.muted : AMDOSDesign.blue)
                Text("起点を編集して進捗データへ保存できる。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            if active.isEmpty { Text("イベントデータなし").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            ForEach(store.progressEvents) { event in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("\(event.status == "confirmed" ? "✅" : event.status == "rejected" ? "❌" : "📝") \(event.eventTitle)").font(.subheadline.weight(.semibold))
                        Spacer()
                        AMDOSStatusBadge(text: event.initiativeOrigin ?? "unknown", tint: event.impact ?? 0 >= 4 ? AMDOSDesign.warning : AMDOSDesign.muted)
                        if let impact = event.impact { Text("impact \(Int(impact.rounded()))").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                        if auth.isAdmin {
                            Button(editingEventID == event.eventId ? "閉じる" : "編集") { beginEditing(event) }.buttonStyle(.bordered)
                        }
                    }
                    if let description = event.eventDescription?.trimmedNonEmpty { Text(description).font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled) }
                    if let lost = event.originLostReason?.trimmedNonEmpty { Text("先手を逃した理由: \(lost)").font(.caption2).foregroundStyle(.red).textSelection(.enabled) }
                    if let responsibilities = event.responsibilities, !responsibilities.isEmpty {
                        Text("担当: \(responsibilities.map { "\($0.memberName ?? $0.memberId) (\(Int((($0.responsibility ?? 0) * 100).rounded()))%)" }.joined(separator: ", "))")
                            .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    if editingEventID == event.eventId {
                        AMDOSTextField(title: "タイトル", text: $eventTitle)
                        AMDOSTextField(title: "内容", text: $eventContent, axis: .vertical)
                        Picker("MS", selection: $eventMilestoneID) {
                            Text("MS未紐付け").tag("")
                            ForEach(store.currentBundle?.milestones ?? []) { Text($0.title).tag($0.milestoneId) }
                        }
                        Picker("起点", selection: $eventOrigin) {
                            Text("AMD提案").tag("amd_proposed")
                            Text("協議決定").tag("co_decided")
                            Text("先方提案").tag("partner_proposed")
                            Text("外部発生").tag("external")
                            Text("不明").tag("unknown")
                        }
                        HStack {
                            AMDOSTextField(title: "impact 0–5", text: $eventImpact)
                            AMDOSTextField(title: "depth 0–1", text: $eventDepth)
                        }
                        HStack {
                            Button("保存") {
                                Task {
                                    await store.saveProgressEvent(projectId: project.projectId, ym: selectedYm, eventId: event.eventId, title: eventTitle, contentPreview: eventContent, milestoneId: eventMilestoneID, initiativeOrigin: eventOrigin, impact: Double(eventImpact) ?? 0, depth: Double(eventDepth) ?? 0)
                                    editingEventID = nil
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            Button("キャンセル") { editingEventID = nil }.buttonStyle(.bordered)
                        }
                    }
                }
                .padding(.vertical, 5)
                Divider()
            }
        }
        AMDOSSectionCard("立替精算", systemImage: "receipt") {
            if store.reimbursements.isEmpty { Text("精算データなし").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            ForEach(store.reimbursements) { item in
                AMDOSLineItem(title: item.description, subtitle: [item.date, item.memberName].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · "), status: amdOSCockpitYen(item.amount))
            }
            if !store.reimbursements.isEmpty {
                LabeledContent("合計", value: amdOSCockpitYen(store.reimbursements.reduce(0) { $0 + $1.amount }))
                    .font(.subheadline.weight(.semibold))
            }
        }
    }

    private func beginEditing(_ event: AMDOSParityCockpitProgressEvent) {
        if editingEventID == event.eventId {
            editingEventID = nil
            return
        }
        editingEventID = event.eventId
        eventTitle = event.title ?? event.eventTitle
        eventContent = event.contentPreview ?? event.eventDescription ?? ""
        eventMilestoneID = event.milestoneId ?? ""
        eventOrigin = event.initiativeOrigin ?? "unknown"
        eventImpact = String(Int((event.impact ?? 0).rounded()))
        eventDepth = String(event.depth ?? 0)
    }

    @ViewBuilder
    private var taskSection: some View {
        if !store.tasks.isEmpty {
            AMDOSSectionCard("PJタスク", systemImage: "checklist") {
                ForEach(store.tasks) { task in
                    Button {
                        Task { await store.updateTask(task) }
                    } label: {
                        HStack {
                            Image(systemName: task.status == "done" ? "checkmark.square.fill" : "square")
                                .foregroundStyle(task.status == "done" ? AMDOSDesign.success : AMDOSDesign.muted)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(task.title).strikethrough(task.status == "done")
                                Text([task.assignee, task.priority, task.description].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · ")).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                            }
                            Spacer()
                            AMDOSStatusBadge(text: task.status)
                        }
                    }.buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private var changeHistory: some View {
        AMDOSSectionCard("MS変更履歴", systemImage: "clock.arrow.circlepath") {
            ForEach(store.changeEvents) { event in
                AMDOSLineItem(title: event.changedAt ?? "変更日時未確認", subtitle: [event.summary, event.changedByEmail].compactMap { $0 }.joined(separator: " · "), status: event.rewardPreviewStatus ?? "未確認")
            }
        }
    }

    @ViewBuilder
    private var pastCycles: some View {
        AMDOSSectionCard("過去の期間", systemImage: "archivebox") {
            Button(showPastCycles ? "過去の期間を閉じる" : "過去の期間を表示（\(store.pastBundles.count)件）") { showPastCycles.toggle() }.buttonStyle(.plain)
            if showPastCycles {
                ForEach(store.pastBundles) { bundle in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack { Text("\(amdOSCockpitYmLabel(bundle.cycle.periodStartYm)) 〜 \(amdOSCockpitYmLabel(bundle.cycle.periodEndYm))").font(.subheadline.weight(.semibold)); Spacer(); AMDOSStatusBadge(text: bundle.cycle.status ?? "未確認") }
                        ForEach(bundle.milestones) { milestone in
                            let pct = amdOSCockpitLatestProgress(bundle.progress, milestoneId: milestone.milestoneId, ym: selectedYm)?.progressPct ?? 0
                            Text("\(milestone.title) · \(Int(pct.rounded()))%").font(.caption)
                        }
                    }.padding(.vertical, 5)
                }
            }
        }
    }

    @ViewBuilder
    private func documentsSection(project: AMDOSParityCockpitProject) -> some View {
        AMDOSSectionCard("PJ資料", systemImage: "doc.text") {
            HStack {
                Text("PWA project-documents API").font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("資料を追加") { showImporter = true }.buttonStyle(.bordered)
            }
            if let warning = store.documentWarning?.trimmedNonEmpty {
                Text(warning).font(.caption).foregroundStyle(AMDOSDesign.warning)
            }
            if store.documents.isEmpty {
                Text("登録資料はまだないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(store.documents) { document in
                HStack(spacing: 8) {
                    Button {
                        if document.isMarkdown {
                            selectedDocument = document
                            loadDocument(document)
                        } else {
                            openDocumentInDrive(document)
                        }
                    } label: {
                        AMDOSLineItem(title: document.fileName, subtitle: "\(document.mimeType) · \(document.fileSizeBytes ?? 0) bytes", status: document.uploadStatus ?? "active")
                    }
                    .buttonStyle(.plain)
                    Spacer(minLength: 0)
                    if document.isMarkdown {
                        Button("OS内で開く") {
                            selectedDocument = document
                            loadDocument(document)
                        }
                        .buttonStyle(.bordered)
                    }
                    if document.webViewLink?.trimmedNonEmpty != nil {
                        Button("Drive") { openDocumentInDrive(document) }
                            .buttonStyle(.bordered)
                    }
                }
            }
            if let document = selectedDocument {
                AMDOSSectionCard(document.fileName, systemImage: "eye") {
                    AMDOSStateNotice(state: documentState) { loadDocument(document) }
                    if documentState == .loaded, document.isMarkdown {
                        HStack {
                            if document.webViewLink?.trimmedNonEmpty != nil {
                                Button("Driveで開く") { openDocumentInDrive(document) }.buttonStyle(.bordered)
                            }
                            Spacer()
                            Button(documentEditing ? "編集を閉じる" : "編集") {
                                if documentEditing {
                                    documentDraft = documentMarkdown
                                }
                                documentEditing.toggle()
                            }
                            .buttonStyle(.bordered)
                            .disabled(documentSaving)
                        }
                        if documentEditing {
                            TextEditor(text: $documentDraft)
                                .font(.body.monospaced())
                                .frame(minHeight: 280)
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(AMDOSDesign.border))
                            HStack {
                                Spacer()
                                Button("キャンセル") {
                                    documentDraft = documentMarkdown
                                    documentEditing = false
                                }
                                .buttonStyle(.bordered)
                                Button(documentSaving ? "保存中…" : "保存") { saveDocument(document) }
                                    .buttonStyle(.borderedProminent)
                                    .disabled(documentSaving || documentDraft == documentMarkdown)
                            }
                        } else {
                            Text(documentMarkdown).font(.caption).textSelection(.enabled)
                        }
                    }
                    Button("閉じる") { selectedDocument = nil }.buttonStyle(.bordered)
                }
            }
        }
    }

    private func loadDocument(_ document: AMDOSParityCockpitDocument) {
        guard document.isMarkdown else {
            openDocumentInDrive(document)
            return
        }
        documentState = .loading
        documentEditing = false
        Task {
            do {
                documentMarkdown = try await store.fetchMarkdown(documentId: document.documentId)
                documentDraft = documentMarkdown
                documentState = .loaded
            } catch {
                documentMarkdown = error.localizedDescription
                documentState = .failed(documentMarkdown)
            }
        }
    }

    private func saveDocument(_ document: AMDOSParityCockpitDocument) {
        guard document.isMarkdown else { return }
        documentSaving = true
        Task {
            defer { documentSaving = false }
            do {
                let saved = try await store.saveMarkdown(documentId: document.documentId, markdown: documentDraft)
                documentMarkdown = saved
                documentDraft = saved
                documentEditing = false
                store.message = "資料本文を保存したよ"
            } catch {
                store.message = error.localizedDescription
            }
        }
    }

    private func openDocumentInDrive(_ document: AMDOSParityCockpitDocument) {
        guard let raw = document.webViewLink?.trimmedNonEmpty, let url = URL(string: raw) else {
            store.message = "この資料のDrive URLを確認できないよ"
            return
        }
        NSWorkspace.shared.open(url)
    }

    @ViewBuilder
    private var signalsSection: some View {
        AMDOSSectionCard("経営ハイライト", systemImage: "lightbulb") {
            if store.signals.isEmpty { Text("確認済み / 候補の戦略シグナルはないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            ForEach(store.signals) { signal in
                VStack(alignment: .leading, spacing: 6) {
                    AMDOSLineItem(
                        title: "\(signal.polarity ?? "•") \(signal.title ?? signal.signalType ?? "戦略シグナル")",
                        subtitle: [signal.signalDate, signal.summary, signal.scoreImpactSummary].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · "),
                        status: signal.impactLevel ?? signal.status ?? "未確認"
                    )
                    if let rawJSON = signal.sourceRefsJSON, let rawRefs = rawJSON.array, !rawRefs.isEmpty {
                        let refs = amdOSCockpitSignalSourceSummaries(rawJSON)
                        DisclosureGroup("根拠 \(rawRefs.count)件") {
                            ForEach(Array(refs.enumerated()), id: \.offset) { _, ref in
                                Text(ref)
                                    .font(.caption)
                                    .foregroundStyle(AMDOSDesign.muted)
                                    .textSelection(.enabled)
                            }
                        }
                        .font(.caption)
                    }
                    HStack {
                        Button("つくよみに修正依頼") { selectedStrategySignal = signal }
                            .buttonStyle(.bordered)
                        Spacer()
                        if signal.status == "candidate" {
                            AMDOSStatusBadge(text: "未確認", tint: AMDOSDesign.warning)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var grantsSection: some View {
        AMDOSSectionCard("助成金・補助金", systemImage: "banknote") {
            let secured = store.grants.filter { ["adopted", "active", "completed"].contains($0.status) }.reduce(0) { $0 + ($1.amountYen ?? 0) }
            HStack {
                Text("PWAと同じ助成金台帳で編集する。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("管理で編集") { onOpenGovernance() }.buttonStyle(.bordered)
            }
            if secured > 0 { Text("獲得累計 \(amdOSCockpitYen(secured))").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.success) }
            if store.grants.isEmpty { Text("助成金・補助金の記録はないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            ForEach(store.grants) { grant in
                AMDOSLineItem(title: grant.grantName, subtitle: [grant.agency, grant.grantType, grant.periodStartYm.map(amdOSCockpitYmLabel), grant.periodEndYm.map(amdOSCockpitYmLabel)].compactMap { $0 }.joined(separator: " · "), status: "\(grant.status) \(amdOSCockpitYen(grant.amountYen))")
            }
        }
    }

    @ViewBuilder
    private var meetingsSection: some View {
        AMDOSSectionCard("MTGサマリ", systemImage: "person.3") {
            HStack {
                Text("PWAと同じ会議履歴・予定MTGを確認できる。")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("メモ再読込") { reload() }.buttonStyle(.bordered)
            }
            if store.meetings.isEmpty { Text("会議サマリ・予定MTGデータはないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            let visibleMeetings = showAllMeetings ? store.meetings : Array(store.meetings.prefix(12))
            ForEach(visibleMeetings) { meeting in
                Button { selectedMeeting = meeting } label: { VStack(alignment: .leading, spacing: 4) {
                    HStack { Text("\(meeting.meetingDate ?? meeting.ym ?? "") · \(meeting.title ?? "会議")").font(.subheadline.weight(.medium)); Spacer(); AMDOSStatusBadge(text: meeting.prepStatus ?? meeting.sourceKinds ?? "記録") }
                    Text(meeting.summaryShort ?? meeting.narrativeMd ?? "要約なし").font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(4)
                    if let actions = meeting.nextActions, !actions.isEmpty { Text("次の一手: \(actions.joined(separator: " / "))").font(.caption2).foregroundStyle(AMDOSDesign.blue).lineLimit(2) }
                }.frame(maxWidth: .infinity, alignment: .leading) }.buttonStyle(.plain)
                Divider()
            }
            if store.meetings.count > 12 {
                Button(showAllMeetings ? "▲ それより前を隠す" : "▼ それより前を表示（残り\(store.meetings.count - 12)件）") {
                    showAllMeetings.toggle()
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private func reload() {
        guard let projectId else { return }
        Task {
            await store.load(projectId: projectId)
            openInitialMeetingIfAvailable()
            openInitialDocumentIfAvailable()
            selectedYm = selectedYm.isEmpty ? amdOSCockpitCurrentYm() : selectedYm
            syncProgressDraft()
            await store.loadMonthExtras(projectId: projectId, ym: selectedYm)
            monthlyNote = store.monthlyNote
        }
    }

    private func openInitialMeetingIfAvailable() {
        guard selectedMeeting == nil, let initialMeetingID else { return }
        selectedMeeting = store.meetings.first { $0.meetingId == initialMeetingID }
    }

    private func openInitialDocumentIfAvailable() {
        guard selectedDocument == nil,
              let initialDocumentID,
              let document = store.documents.first(where: { $0.documentId == initialDocumentID }),
              document.isMarkdown else { return }
        selectedDocument = document
        loadDocument(document)
    }

    private func syncProgressDraft() {
        guard let bundle = store.currentBundle else { return }
        var next: [String: String] = [:]
        for milestone in bundle.milestones {
            let current = amdOSCockpitLatestProgress(bundle.progress, milestoneId: milestone.milestoneId, ym: selectedYm)?.progressPct ?? 0
            next[milestone.milestoneId] = progressDraft[milestone.milestoneId] ?? String(Int(current.rounded()))
        }
        progressDraft = next
    }
}

/// PWA `CockpitVentureStatusEditModal` のネイティブ実装。
/// 構造化は明示的なプレビュー時だけに留め、保存・更新・削除はPWAと同じ
/// `project_events` RLS境界を通す。
private struct AMDOSParityCockpitVentureEventEditor: View {
    @ObservedObject var store: AMDOSParityCockpitStore
    let projectId: String
    let event: AMDOSParityCockpitVentureEvent?
    let onClose: () -> Void

    @State private var occurredOn: String
    @State private var kind: String
    @State private var label: String
    @State private var rawText: String
    @State private var parsed: AMDOSParityCockpitJSON?
    @State private var isParsing = false
    @State private var isSaving = false
    @State private var confirmDelete = false

    private static let kindOptions: [(value: String, label: String, placeholder: String)] = [
        ("hire", "人事", "例: 山田太郎が CTO として入社、報酬は月80万円 + ストックオプション"),
        ("funding", "資金調達", "例: シードラウンドで合計3500万円を調達"),
        ("deal", "事業契約", "例: 大学発ベンチャーA社とPoC契約、期間6ヶ月・金額200万円"),
        ("tech_progress", "技術進捗", "例: 試作3号機が稼働、収率85%で安定。TRL4→5相当"),
        ("governance", "ガバナンス", "例: 取締役会で資金調達方針を決議"),
        ("xrl_obs", "XRL観測", "例: ラボでの試作機が稼働、TRL4相当。ボトルネックは収率の安定化"),
        ("amd_score_override", "AMDスコア手動補正", "例: 大型契約で勢いつき、+10加点したい"),
        ("note", "メモ", "PJにまつわる出来事を自由に記録")
    ]

    init(
        store: AMDOSParityCockpitStore,
        projectId: String,
        event: AMDOSParityCockpitVentureEvent?,
        initialDate: String,
        onClose: @escaping () -> Void
    ) {
        self.store = store
        self.projectId = projectId
        self.event = event
        self.onClose = onClose
        _occurredOn = State(initialValue: String((event?.occurredOn ?? initialDate).prefix(10)))
        _kind = State(initialValue: event?.kind ?? "note")
        _label = State(initialValue: event?.label ?? "")
        _rawText = State(initialValue: amdOSCockpitMetaRawText(event?.meta))
    }

    private var placeholder: String {
        Self.kindOptions.first(where: { $0.value == kind })?.placeholder ?? "出来事を入力"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(event == nil ? "イベント追加" : "イベント編集").font(.headline)
                    Text("PWAと同じ project_events を更新する")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                }
                Spacer()
                Button("閉じる") { onClose() }.buttonStyle(.bordered)
            }
            .padding()
            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    AMDOSTextField(title: "日付（YYYY-MM-DD）", text: $occurredOn)
                    Picker("種別", selection: $kind) {
                        ForEach(Self.kindOptions, id: \.value) { option in
                            Text(option.label).tag(option.value)
                        }
                    }
                    AMDOSTextField(title: "ラベル（1行サマリ）", text: $label)
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("詳細（自由文）").font(.caption.weight(.semibold))
                            Spacer()
                            Button(isParsing ? "解析中…" : "構造化プレビュー") { parsePreview() }
                                .buttonStyle(.bordered)
                                .disabled(isParsing || rawText.trimmedNonEmpty == nil)
                        }
                        TextEditor(text: $rawText)
                            .font(.body)
                            .frame(minHeight: 130)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(AMDOSDesign.border))
                            .onChange(of: rawText) { _, _ in parsed = nil }
                        Text(placeholder).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                        Text("構造化はプレビューで確認してから保存する。保存される本文とmetaはPWAと同じイベント行に入る。")
                            .font(.caption2)
                            .foregroundStyle(AMDOSDesign.muted)
                    }

                    if let parsed {
                        AMDOSSectionCard("構造化プレビュー", systemImage: "sparkles") {
                            Text(parsed.compactText)
                                .font(.caption.monospaced())
                                .textSelection(.enabled)
                        }
                    }
                    if let message = store.message?.trimmedNonEmpty {
                        Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                    }
                }
                .padding()
            }

            Divider()
            HStack {
                if event != nil {
                    Button("削除", role: .destructive) { confirmDelete = true }
                        .buttonStyle(.bordered)
                        .disabled(isSaving)
                }
                Spacer()
                Button("キャンセル") { onClose() }.buttonStyle(.bordered).disabled(isSaving)
                Button(isSaving ? "保存中…" : "保存") { save() }
                    .buttonStyle(.borderedProminent)
                    .disabled(isSaving || projectId.trimmedNonEmpty == nil)
            }
            .padding()
        }
        .frame(minWidth: 560, minHeight: 580)
        .confirmationDialog("このイベントを削除する？", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("削除", role: .destructive) { delete() }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("削除後はPWAと同じイベント履歴・グラフから消える。")
        }
    }

    private func parsePreview() {
        isParsing = true
        Task {
            parsed = await store.parseVentureEvent(kind: kind, label: label, rawText: rawText)
            isParsing = false
        }
    }

    private func save() {
        isSaving = true
        Task {
            let didSave = await store.saveVentureEvent(
                projectId: projectId,
                existingID: event?.id,
                occurredOn: occurredOn,
                kind: kind,
                label: label,
                rawText: rawText,
                parsed: parsed
            )
            isSaving = false
            if didSave { onClose() }
        }
    }

    private func delete() {
        guard let event else { return }
        isSaving = true
        Task {
            let didDelete = await store.deleteVentureEvent(projectId: projectId, eventId: event.id)
            isSaving = false
            if didDelete { onClose() }
        }
    }
}

/// PWA `CockpitManagementScoreHero` と同じsnapshotの時系列。表示のための
/// scoreを再計算せず、`amd_management_score_snapshots`にある値だけを描く。
private struct AMDOSParityCockpitManagementScoreHero: View {
    let snapshots: [AMDOSParityCockpitManagementScoreSnapshot]

    private struct Axis {
        let label: String
        let color: Color
        let value: (AMDOSParityCockpitManagementScoreSnapshot) -> Double?
    }

    private let axes: [Axis] = [
        Axis(label: "先手力", color: .blue, value: { $0.initiativeScore }),
        Axis(label: "財務", color: .green, value: { $0.financeScore }),
        Axis(label: "既存継続", color: .orange, value: { $0.retentionScore }),
        Axis(label: "新規獲得", color: .purple, value: { $0.pipelineScore }),
        Axis(label: "戦略接近", color: .red, value: { $0.directionScore }),
    ]

    private var series: [AMDOSParityCockpitManagementScoreSnapshot] {
        snapshots.sorted { $0.ym < $1.ym }
    }

    private var latest: AMDOSParityCockpitManagementScoreSnapshot? { series.last }

    var body: some View {
        AMDOSSectionCard("AMD Management Score", systemImage: "chart.line.uptrend.xyaxis") {
            Text("会社全体の経営状況スコア（先手力 / 財務耐久 / 既存PJ継続 / 新規獲得 / 戦略接近）")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
            if series.isEmpty {
                Text("AMD Management Scoreのsnapshotはまだないよ。")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: 16) {
                        chart.frame(maxWidth: .infinity, minHeight: 230)
                        latestPanel.frame(width: 230)
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        chart.frame(minHeight: 230)
                        latestPanel
                    }
                }
            }
        }
    }

    private var chart: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Text("スコア推移").font(.caption.weight(.semibold))
                Text("0–100 / linear scale").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Text("━ Total").font(.caption2).foregroundStyle(.primary)
                ForEach(axes, id: \.label) { axis in
                    Text("— \(axis.label)").font(.caption2).foregroundStyle(axis.color)
                }
            }
            Canvas { context, size in
                guard !series.isEmpty else { return }
                let left: CGFloat = 28
                let right: CGFloat = 8
                let top: CGFloat = 12
                let bottom: CGFloat = 24
                let width = max(1, size.width - left - right)
                let height = max(1, size.height - top - bottom)
                let x: (Int) -> CGFloat = { index in
                    guard series.count > 1 else { return left + width / 2 }
                    return left + width * CGFloat(index) / CGFloat(series.count - 1)
                }
                let y: (Double) -> CGFloat = { score in
                    top + (1 - CGFloat(max(0, min(100, score)) / 100)) * height
                }
                for guide in stride(from: 0, through: 100, by: 25) {
                    let guideY = y(Double(guide))
                    var line = Path()
                    line.move(to: CGPoint(x: left, y: guideY))
                    line.addLine(to: CGPoint(x: left + width, y: guideY))
                    context.stroke(line, with: .color(AMDOSDesign.border.opacity(guide == 50 ? 1 : 0.55)), lineWidth: 1)
                    context.draw(Text("\(guide)").font(.caption2).foregroundColor(AMDOSDesign.muted), at: CGPoint(x: 11, y: guideY))
                }
                for axis in axes {
                    var path = Path()
                    var started = false
                    for (index, snapshot) in series.enumerated() {
                        guard let value = axis.value(snapshot) else { continue }
                        let point = CGPoint(x: x(index), y: y(value))
                        if started { path.addLine(to: point) } else { path.move(to: point); started = true }
                    }
                    if started { context.stroke(path, with: .color(axis.color.opacity(0.85)), lineWidth: 1.5) }
                }
                var total = Path()
                var totalStarted = false
                for (index, snapshot) in series.enumerated() {
                    guard let value = snapshot.totalScore else { continue }
                    let point = CGPoint(x: x(index), y: y(value))
                    if totalStarted { total.addLine(to: point) } else { total.move(to: point); totalStarted = true }
                    context.fill(Path(ellipseIn: CGRect(x: point.x - 3, y: point.y - 3, width: 6, height: 6)), with: .color(.primary))
                }
                if totalStarted { context.stroke(total, with: .color(.primary), lineWidth: 2.5) }
                for (index, snapshot) in series.enumerated() {
                    context.draw(Text(amdOSCockpitYmLabel(snapshot.ym)).font(.caption2).foregroundColor(AMDOSDesign.muted), at: CGPoint(x: x(index), y: top + height + 13))
                }
            }
        }
    }

    private var latestPanel: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("最新 \(latest.map { amdOSCockpitYmLabel($0.ym) } ?? "—")")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(latest?.totalScore.map { String(Int($0.rounded())) } ?? "—")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                Text("/ 100 Total").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(axes, id: \.label) { axis in
                HStack {
                    Circle().fill(axis.color).frame(width: 7, height: 7)
                    Text(axis.label).font(.caption)
                    Spacer()
                    Text(axis.value(latest ?? AMDOSParityCockpitManagementScoreSnapshot.empty).map { String(Int($0.rounded())) } ?? "—")
                        .font(.caption.weight(.semibold))
                }
            }
        }
        .padding(10)
        .background(AMDOSDesign.page.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private extension AMDOSParityCockpitManagementScoreSnapshot {
    static let empty = AMDOSParityCockpitManagementScoreSnapshot(
        id: "empty", ym: "", totalScore: nil, initiativeScore: nil, financeScore: nil,
        retentionScore: nil, pipelineScore: nil, directionScore: nil
    )
}

private struct AMDOSParityCockpitKuteRoadmapItem: Identifiable {
    let id: String
    let lane: String
    let period: String
    let startYm: String
    let endYm: String
    let title: String
    let purpose: String
    let outputs: [String]
}

/// PWA `CockpitKuteAnnualRoadmap` の固定ロードマップを同じ内容で表示する。
/// ここはPJデータの代替ではなく、PWAに同梱されたp25専用の合意済み年度計画。
private struct AMDOSParityCockpitKuteAnnualRoadmap: View {
    let currentYm: String

    private let items: [AMDOSParityCockpitKuteRoadmapItem] = [
        .init(id: "regulation-202606", lane: "regulation", period: "2026-06", startYm: "202606", endYm: "202606", title: "認定規程の着地", purpose: "6/22教授総会で通せる状態にする", outputs: ["認定規程修正案", "委員会規程", "支援細則", "想定問答"]),
        .init(id: "regulation-202607", lane: "regulation", period: "2026-07", startYm: "202607", endYm: "202607", title: "7規程の全体設計", purpose: "認定制度と残り6規程の接続を整理する", outputs: ["規程マップ", "既存規程突合表", "他大学比較", "優先順位"]),
        .init(id: "regulation-202608", lane: "regulation", period: "2026-08", startYm: "202608", endYm: "202608", title: "残り6規程の素案化", purpose: "既存改訂・新規作成の条文たたきを作る", outputs: ["兼業", "新株予約権", "共有機器", "知財", "共同研究", "利益相反"]),
        .init(id: "regulation-202609-202611", lane: "regulation", period: "2026-09〜11", startYm: "202609", endYm: "202611", title: "学内議論・修正", purpose: "教授総会・関係部署・法務論点を反映する", outputs: ["修正版", "論点管理表", "学内説明資料", "施行準備メモ"]),
        .init(id: "regulation-202612-202701", lane: "regulation", period: "2026-12〜2027-01", startYm: "202612", endYm: "202701", title: "規程整備完了", purpose: "条文だけでなく、運用に必要な付属物まで揃える", outputs: ["施行版", "様式", "運用フロー", "FAQ"]),
        .init(id: "seed-202606-202703", lane: "seed", period: "2026-06〜2027-03", startYm: "202606", endYm: "202703", title: "シーズ発掘・after GTIE", purpose: "規程整備と並行して支援実務の型を作る", outputs: ["桑折先生パイロット", "ヒアリング設計", "連携先マップ", "資金循環モデル"]),
    ]

    private var normalizedYm: String { currentYm.count == 6 ? currentYm : "202606" }
    private var fiscalProgress: Double {
        func index(_ ym: String) -> Int {
            Int(ym.prefix(4))! * 12 + Int(ym.suffix(2))!
        }
        let start = index("202606")
        let end = index("202703")
        return max(0, min(1, Double(index(normalizedYm) - start + 1) / Double(end - start + 1)))
    }

    var body: some View {
        AMDOSSectionCard("年度内ロードマップ", systemImage: "map") {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("KUTE annual roadmap").font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                    Text("2027年3月までに、規程整備、桑折先生パイロット、外部連携、資金循環モデルまでを同じ横軸で追う。")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                }
                Spacer()
                AMDOSStatusBadge(text: "現在地 \(amdOSCockpitYmLabel(normalizedYm))", tint: AMDOSDesign.blue)
                AMDOSStatusBadge(text: "2027/03 型化", tint: AMDOSDesign.success)
            }
            ProgressView(value: fiscalProgress)
            HStack { Text("2026.06"); Spacer(); Text("2027.03") }
                .font(.caption2.monospaced())
                .foregroundStyle(AMDOSDesign.muted)

            Text("制度整備レーン").font(.caption.weight(.semibold))
            ForEach(items.filter { $0.lane == "regulation" }) { item in
                AMDOSParityCockpitKuteRoadmapRow(item: item, currentYm: normalizedYm)
            }
            Text("シーズ発掘 / after GTIE レーン").font(.caption.weight(.semibold))
            ForEach(items.filter { $0.lane == "seed" }) { item in
                AMDOSParityCockpitKuteRoadmapRow(item: item, currentYm: normalizedYm)
            }
            Text("after GTIEの具体論点は先に固定しすぎず、規程整備とシーズ発掘の進捗を見て具体化する。")
                .font(.caption2)
                .foregroundStyle(AMDOSDesign.muted)
            Text("根拠: 6/11キックオフ資料 · 合意業務: 規程策定 / シーズ掘り起こし / 自治体等とのファンド形成")
                .font(.caption2)
                .foregroundStyle(AMDOSDesign.muted)
        }
    }
}

private struct AMDOSParityCockpitKuteRoadmapRow: View {
    let item: AMDOSParityCockpitKuteRoadmapItem
    let currentYm: String

    private var state: String {
        if currentYm > item.endYm { return "完了" }
        if currentYm < item.startYm { return "次" }
        return "進行中"
    }
    private var tint: Color {
        switch state {
        case "完了": return AMDOSDesign.success
        case "進行中": return AMDOSDesign.blue
        default: return AMDOSDesign.muted
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.period).font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                Text(item.title).font(.subheadline.weight(.semibold))
                Spacer()
                AMDOSStatusBadge(text: state, tint: tint)
            }
            Text(item.purpose).font(.caption).foregroundStyle(AMDOSDesign.muted)
            HStack(spacing: 5) {
                ForEach(item.outputs, id: \.self) { output in
                    AMDOSStatusBadge(text: output, tint: AMDOSDesign.muted)
                }
            }
        }
        .padding(9)
        .background(tint.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 9))
    }
}

private struct AMDOSParityCockpitFreezeBackfillCard: View {
    let freezeFromYm: String
    let restartExpectedYm: String
    let backfill: AMDOSParityCockpitFreezeBackfill?

    private var previousYm: String {
        guard let year = Int(restartExpectedYm.prefix(4)), let month = Int(restartExpectedYm.suffix(2)) else { return restartExpectedYm }
        return month == 1 ? String(format: "%04d12", year - 1) : String(format: "%04d%02d", year, month - 1)
    }

    var body: some View {
        AMDOSSectionCard("休止期間（\(amdOSCockpitYmLabel(freezeFromYm)) 〜 \(amdOSCockpitYmLabel(previousYm))）の進捗まとめ", systemImage: "archivebox") {
            if let meta = backfill?.sourceMeta?.object {
                let reports = amdOSCockpitJSONString(meta["reports_count"]) ?? "0"
                let meetings = amdOSCockpitJSONString(meta["meetings_count"]) ?? "0"
                Text("reports \(reports) / mtg \(meetings)")
                    .font(.caption2)
                    .foregroundStyle(AMDOSDesign.blue)
            }
            if let summary = backfill?.summary?.trimmedNonEmpty {
                Text(summary).font(.caption).textSelection(.enabled)
            } else {
                Text("休止期間サマリは次回cron起動時に生成される（/api/cron/freeze-period-backfill）。")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
            }
        }
    }
}

private enum AMDOSParityCockpitSignalFeedbackStep: Equatable {
    case input
    case loading
    case preview
    case additionalComment
}

/// PWA `CockpitStrategySignals` の `dialog/start → refine → confirm` をそのまま使う。
/// 改訂案の生成中は何も保存せず、明示的な「適用」で初めて PWA 側が signal と履歴を更新する。
private struct AMDOSParityCockpitStrategySignalFeedbackView: View {
    let signal: AMDOSParityCockpitSignal
    let projectID: String
    let onConfirmed: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var history: [AMDOSParityNotificationFeedbackRow] = []
    @State private var historyState: AMDOSFeatureLoadState = .idle
    @State private var feedbackText = ""
    @State private var additionalText = ""
    @State private var step: AMDOSParityCockpitSignalFeedbackStep = .input
    @State private var current: AMDOSParityCockpitSignalProposal?
    @State private var proposed: AMDOSParityCockpitSignalProposal?
    @State private var conversation: [AMDOSParityCockpitSignalDialogMessage] = []
    @State private var reasoning = ""
    @State private var appliedSummary = ""
    @State private var errorNote: String?

    private var scopeKey: String {
        guard let ym = signal.ym?.trimmedNonEmpty else { return "global" }
        let hash = signal.sourceHash?.trimmedNonEmpty.map { String($0.prefix(12)) }
            ?? String(signal.signalId.prefix(12))
        return "\(ym):strategy:\(hash)"
    }

    private var signalHistory: [AMDOSParityNotificationFeedbackRow] {
        history.filter { $0.scopeKey == scopeKey || $0.scopeKey.hasPrefix(scopeKey) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("つくよみに修正依頼").font(.headline)
                    Text(signal.title ?? signal.signalType ?? "戦略シグナル")
                        .font(.subheadline)
                        .foregroundStyle(AMDOSDesign.muted)
                        .lineLimit(2)
                }
                Spacer()
                Button("閉じる") { dismiss() }.buttonStyle(.bordered)
            }
            .padding()

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("PWAと同じ対話型修正依頼。提案の生成・やり直しでは保存せず、「適用」で初めて正本を更新するよ。")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)

                    historySection
                    dialogSection
                }
                .padding()
            }
        }
        .frame(minWidth: 650, minHeight: 570)
        .task { await loadHistory() }
    }

    @ViewBuilder
    private var historySection: some View {
        AMDOSSectionCard("過去の修正依頼", systemImage: "clock.arrow.circlepath") {
            AMDOSStateNotice(state: historyState) { Task { await loadHistory() } }
            if historyState == .loaded || historyState == .empty {
                if signalHistory.isEmpty {
                    Text("このシグナルへの修正依頼はまだないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                ForEach(signalHistory) { feedback in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(feedback.createdAt ?? "日時未記録").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            if let by = feedback.createdBy?.trimmedNonEmpty { Text("by \(by)").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                            Spacer()
                            if (feedback.appliedCount ?? 0) > 0 {
                                AMDOSStatusBadge(text: "反映 \(feedback.appliedCount ?? 0)回", tint: AMDOSDesign.success)
                            }
                        }
                        Text(feedback.feedbackText ?? "修正依頼本文なし").font(.caption).textSelection(.enabled)
                    }
                    .padding(.vertical, 3)
                    Divider()
                }
            }
        }
    }

    @ViewBuilder
    private var dialogSection: some View {
        AMDOSSectionCard("修正内容", systemImage: "sparkles") {
            switch step {
            case .input:
                Text("修正したい事実・分類・重要度を書いて送ると、つくよみが改訂案を返すよ。")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
                TextEditor(text: $feedbackText)
                    .font(.body)
                    .frame(minHeight: 120)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(AMDOSDesign.border))
                HStack {
                    Button("提案を依頼") { startDialog() }
                        .buttonStyle(.borderedProminent)
                        .disabled(feedbackText.trimmedNonEmpty == nil)
                    Button("キャンセル") { dismiss() }.buttonStyle(.bordered)
                    Spacer()
                    if let errorNote { Text(errorNote).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
                }

            case .loading:
                HStack(spacing: 10) {
                    ProgressView()
                    Text("つくよみが改訂案を考えてる…").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                .frame(maxWidth: .infinity, minHeight: 110, alignment: .center)

            case .preview:
                if let proposed, let current {
                    Text(reasoning.trimmedNonEmpty ?? "改訂案を作ったよ。これでいい？")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                    if let applied = appliedSummary.trimmedNonEmpty {
                        Text("反映内容: \(applied)").font(.caption).foregroundStyle(AMDOSDesign.warning)
                    }
                    proposalDiff(current: current, proposed: proposed)
                    HStack {
                        Button("適用") { confirmDialog() }.buttonStyle(.borderedProminent)
                        Button("別案を出す") { refineDialog(hint: "別案を見せて", feedback: "") }.buttonStyle(.bordered)
                        Button("追加コメント") { step = .additionalComment }.buttonStyle(.bordered)
                        Spacer()
                        Button("キャンセル") { dismiss() }.buttonStyle(.bordered)
                    }
                    conversationSection
                    if let errorNote { Text(errorNote).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
                } else {
                    Text("改訂案を読み取れなかったよ。もう一度提案を依頼してね。").font(.caption).foregroundStyle(.red)
                    Button("最初からやり直す") { resetDialog() }.buttonStyle(.bordered)
                }

            case .additionalComment:
                Text("追加コメントを書いて、同じ会話の続きとして再提案を依頼するよ。")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
                TextEditor(text: $additionalText)
                    .font(.body)
                    .frame(minHeight: 120)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(AMDOSDesign.border))
                HStack {
                    Button("追加コメントで再提案") { refineDialog(hint: "", feedback: additionalText) }
                        .buttonStyle(.borderedProminent)
                        .disabled(additionalText.trimmedNonEmpty == nil)
                    Button("戻る") { additionalText = ""; step = .preview }.buttonStyle(.bordered)
                    Spacer()
                    if let errorNote { Text(errorNote).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
                }
            }
        }
    }

    @ViewBuilder
    private func proposalDiff(current: AMDOSParityCockpitSignalProposal, proposed: AMDOSParityCockpitSignalProposal) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("現在 → 提案").font(.caption.weight(.semibold))
            diffRow("タイトル", current.title, proposed.title)
            diffRow("要約", current.summary, proposed.summary)
            diffRow("分類", current.signalType, proposed.signalType)
            diffRow("影響度", current.impactLevel, proposed.impactLevel)
            diffRow("極性", current.polarity, proposed.polarity)
            diffRow("スコア影響", current.scoreImpactSummary, proposed.scoreImpactSummary)
        }
        .padding(10)
        .background(AMDOSDesign.page.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
    }

    @ViewBuilder
    private func diffRow(_ label: String, _ before: String?, _ after: String?) -> some View {
        let currentValue = before?.trimmedNonEmpty ?? "(未設定)"
        let proposedValue = after?.trimmedNonEmpty ?? "(未設定)"
        VStack(alignment: .leading, spacing: 3) {
            Text(label).font(.caption2.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
            if currentValue == proposedValue {
                Text(proposedValue).font(.caption).textSelection(.enabled)
            } else {
                Text(currentValue).font(.caption).foregroundStyle(.red).strikethrough().textSelection(.enabled)
                Text(proposedValue).font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.success).textSelection(.enabled)
            }
        }
    }

    @ViewBuilder
    private var conversationSection: some View {
        if !conversation.isEmpty {
            DisclosureGroup("対話履歴（\(conversation.count)件）") {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(conversation.enumerated()), id: \.offset) { _, message in
                        if message.role == "user" {
                            Text("[まさ] \(message.content ?? "")").font(.caption).textSelection(.enabled)
                        } else {
                            Text("[つくよみ] \(message.reasoning ?? "改訂案")").font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
                        }
                    }
                }
                .padding(.top, 5)
            }
            .font(.caption)
        }
    }

    private func loadHistory() async {
        historyState = .loading
        do {
            let response = try await AMDOSRESTClient.shared.fetchPWA(
                AMDOSParityCockpitFeedbackResponse.self,
                path: "/api/notifications/feedback",
                query: ["l2_kind": "project_strategy_signal", "target_id": projectID, "limit": "300"]
            )
            guard response.ok != false else { throw AMDOSNetworkError.http(response.error ?? "修正依頼履歴を取得できなかったよ") }
            history = response.feedbacks ?? []
            historyState = history.isEmpty ? .empty : .loaded
        } catch {
            historyState = .failed(error.localizedDescription)
        }
    }

    private func startDialog() {
        guard let text = feedbackText.trimmedNonEmpty else { return }
        step = .loading
        errorNote = nil
        Task {
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/notifications/feedback/dialog/start",
                    body: AMDOSParityCockpitSignalDialogStartRequest(targetID: projectID, scopeKey: scopeKey, initialFeedback: text)
                )
                let response = try JSONDecoder().decode(AMDOSParityCockpitSignalDialogResponse.self, from: data)
                guard response.ok == true, let nextProposal = response.proposed, let current = response.current else {
                    throw AMDOSNetworkError.http(response.error ?? "改訂案を生成できなかったよ")
                }
                proposed = nextProposal
                self.current = current
                reasoning = response.reasoning ?? ""
                appliedSummary = response.appliedFeedbackSummary ?? ""
                conversation = response.conversation ?? []
                step = .preview
            } catch {
                errorNote = error.localizedDescription
                step = .input
            }
        }
    }

    private func refineDialog(hint: String, feedback: String) {
        guard !conversation.isEmpty else {
            errorNote = "先に最初の提案を依頼してね"
            step = .input
            return
        }
        step = .loading
        errorNote = nil
        Task {
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/notifications/feedback/dialog/refine",
                    body: AMDOSParityCockpitSignalDialogRefineRequest(
                        targetID: projectID,
                        scopeKey: scopeKey,
                        conversation: conversation,
                        additionalHint: hint,
                        additionalFeedback: feedback.trimmingCharacters(in: .whitespacesAndNewlines)
                    )
                )
                let response = try JSONDecoder().decode(AMDOSParityCockpitSignalDialogResponse.self, from: data)
                guard response.ok == true, let nextProposal = response.proposed else {
                    throw AMDOSNetworkError.http(response.error ?? "別案を生成できなかったよ")
                }
                proposed = nextProposal
                reasoning = response.reasoning ?? ""
                appliedSummary = response.appliedFeedbackSummary ?? ""
                conversation = response.conversation ?? conversation
                additionalText = ""
                step = .preview
            } catch {
                errorNote = error.localizedDescription
                step = .preview
            }
        }
    }

    private func confirmDialog() {
        guard let proposed else { return }
        step = .loading
        errorNote = nil
        Task {
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/notifications/feedback/dialog/confirm",
                    body: AMDOSParityCockpitSignalDialogConfirmRequest(
                        targetID: projectID,
                        scopeKey: scopeKey,
                        conversation: conversation,
                        proposed: proposed,
                        appliedFeedbackSummary: appliedSummary
                    )
                )
                let response = try JSONDecoder().decode(AMDOSParityCockpitSignalDialogConfirmResponse.self, from: data)
                guard response.ok == true else {
                    throw AMDOSNetworkError.http(response.error ?? "改訂案を適用できなかったよ")
                }
                onConfirmed()
                dismiss()
            } catch {
                errorNote = error.localizedDescription
                step = .preview
            }
        }
    }

    private func resetDialog() {
        feedbackText = ""
        additionalText = ""
        current = nil
        proposed = nil
        conversation = []
        reasoning = ""
        appliedSummary = ""
        errorNote = nil
        step = .input
    }
}

private struct AMDOSMeetingMutationResponse: Decodable, Sendable {
    let ok: Bool?
    let error: String?
    let meeting: AMDOSParityCockpitMeeting?
}

private struct AMDOSMeetingAssetsResponse: Decodable, Sendable {
    let ok: Bool?
    let error: String?
    let assets: [AMDOSMeetingAsset]?
}

private struct AMDOSMeetingAssetMutationResponse: Decodable, Sendable {
    let ok: Bool?
    let error: String?
    let asset: AMDOSMeetingAsset?
}

private struct AMDOSMeetingAsset: Codable, Identifiable, Sendable {
    let assetId: String
    let meetingId: String
    let projectId: String
    let fileName: String
    let mediaType: String
    let fileSizeBytes: Int
    let assetKind: String
    var caption: String
    let extractedText: String
    let sourceUrl: String?
    var sortOrder: Int
    let signedUrl: String
    let fileUrl: String
    let driveFolderUrl: String?
    let folderDisplayPath: String?
    let webViewLink: String?
    var id: String { assetId }

    enum CodingKeys: String, CodingKey {
        case assetId, meetingId, projectId, fileName, mediaType, fileSizeBytes, assetKind, caption, extractedText, sourceUrl, sortOrder, signedUrl, fileUrl
        case driveFolderUrl, folderDisplayPath, webViewLink
    }
}

private struct AMDOSMeetingPrepInput: Encodable, Sendable {
    let meetingId: String
    let projectId: String
    let meetingDate: String
    let meetingStartAt: String?
    let title: String
    let calendarEventId: String?
    let sourceUrl: String?
    let summaryShort: String
    let decided: [String]
    let progress: [String]
    let nextActions: [String]
    let risks: [String]
    let narrativeMd: String
    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id", projectId = "project_id", meetingDate = "meeting_date", meetingStartAt = "meeting_start_at", title
        case calendarEventId = "calendar_event_id", sourceUrl = "source_url", summaryShort = "summary_short", decided, progress, nextActions = "next_actions", risks, narrativeMd = "narrative_md"
    }
}

private struct AMDOSMeetingSummaryUpdateInput: Encodable, Sendable {
    let meetingId: String
    let title: String
    let summaryShort: String
    let decided: [String]
    let progress: [String]
    let nextActions: [String]
    let risks: [String]
    let narrativeMd: String
    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id", title, summaryShort = "summary_short", decided, progress, nextActions = "next_actions", risks, narrativeMd = "narrative_md"
    }
}

private struct AMDOSMeetingAssetPatch: Encodable, Sendable {
    let assetId: String
    let caption: String?
    let sortOrder: Int?
    enum CodingKeys: String, CodingKey { case assetId = "asset_id", caption, sortOrder = "sort_order" }
}

private struct AMDOSMeetingAssetInsertInput: Encodable, Sendable {
    let meetingId: String
    enum CodingKeys: String, CodingKey { case meetingId = "meeting_id" }
}

private struct AMDOSEmptyRequest: Encodable, Sendable {}

private struct AMDOSParityCockpitMeetingDetail: View {
    let meeting: AMDOSParityCockpitMeeting
    let prepMeeting: AMDOSParityCockpitMeeting?
    let onMeetingUpdated: (AMDOSParityCockpitMeeting) -> Void
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var auth: AMDOSAuthStore
    @State private var currentMeeting: AMDOSParityCockpitMeeting
    @State private var editing = false
    @State private var saving = false
    @State private var title: String
    @State private var summaryShort: String
    @State private var narrativeMd: String
    @State private var decided: String
    @State private var progress: String
    @State private var nextActions: String
    @State private var risks: String
    @State private var message: String?
    @State private var shareNote: String?

    init(meeting: AMDOSParityCockpitMeeting, prepMeeting: AMDOSParityCockpitMeeting? = nil, onMeetingUpdated: @escaping (AMDOSParityCockpitMeeting) -> Void) {
        self.meeting = meeting
        self.prepMeeting = prepMeeting
        self.onMeetingUpdated = onMeetingUpdated
        _currentMeeting = State(initialValue: meeting)
        _title = State(initialValue: meeting.title ?? "")
        _summaryShort = State(initialValue: meeting.summaryShort ?? "")
        _narrativeMd = State(initialValue: meeting.narrativeMd ?? "")
        _decided = State(initialValue: amdOSMeetingBlocks(meeting.decided ?? []))
        _progress = State(initialValue: amdOSMeetingBlocks(meeting.progress ?? []))
        _nextActions = State(initialValue: amdOSMeetingBlocks(meeting.nextActions ?? []))
        _risks = State(initialValue: amdOSMeetingBlocks(meeting.risks ?? []))
    }

    private var isUpcoming: Bool {
        let sourceKinds = amdOSMeetingSourceKindTokens(currentMeeting.sourceKinds)
        return sourceKinds.contains("upcoming") || sourceKinds.contains("upcoming_tentative") || currentMeeting.meetingId.hasPrefix("upcoming:")
    }

    private var isDialogue: Bool {
        currentMeeting.meetingId.hasPrefix("dialogue:") || currentMeeting.sourceKinds == "dialogue"
    }

    private var isScheduledUpcoming: Bool {
        let sourceKinds = amdOSMeetingSourceKindTokens(currentMeeting.sourceKinds)
        return sourceKinds.contains("upcoming") && !sourceKinds.contains("upcoming_tentative")
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if editing { editor } else { record }
                    AMDOSMeetingAssetsPanel(meeting: currentMeeting, onMeetingUpdated: applyUpdate)
                    if let message = message?.trimmedNonEmpty {
                        Text(message).font(.caption).foregroundStyle(message.hasPrefix("保存") ? AMDOSDesign.success : AMDOSDesign.warning).textSelection(.enabled)
                    }
                }
                .padding(24)
            }
            Divider()
            HStack {
                Spacer()
                Button("閉じる") { dismiss() }
            }
            .padding(14)
        }
        .frame(minWidth: 760, minHeight: 700)
    }

    @ViewBuilder
    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(currentMeeting.title ?? "会議").font(.title3.weight(.bold))
                Text([currentMeeting.meetingDate, currentMeeting.meetingStartAt, currentMeeting.ym].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            Spacer()
            AMDOSStatusBadge(text: currentMeeting.prepStatus ?? currentMeeting.sourceKinds ?? "記録")
            if auth.isAdmin {
                Button(editing ? "編集を閉じる" : "編集") { editing.toggle() }.buttonStyle(.bordered)
            }
        }
        HStack(spacing: 7) {
            if !isDialogue, let notionURL = currentMeeting.notionUrl?.trimmedNonEmpty {
                Button("Notion文字起こしを開く") { openExternal(notionURL) }.buttonStyle(.bordered)
            } else if isScheduledUpcoming, let sourceURL = currentMeeting.sourceUrl?.trimmedNonEmpty {
                Button("CalendarからNotionを開始") { openExternal(sourceURL) }.buttonStyle(.bordered)
            } else if !isDialogue {
                Text("Notion未連携").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            if let sourceURL = currentMeeting.sourceUrl?.trimmedNonEmpty, sourceURL != currentMeeting.notionUrl {
                Button("元ソースを開く") { openExternal(sourceURL) }.buttonStyle(.bordered)
            }
            Button("PDF保存") { savePDF() }.buttonStyle(.bordered)
            if !isUpcoming { Button("議事録コピー") { copyEmail(prep: false) }.buttonStyle(.bordered) }
            if isUpcoming || currentMeeting.narrativeMd?.contains("会議前準備メモ") == true || prepMeeting != nil { Button("準備メモコピー") { copyEmail(prep: true) }.buttonStyle(.bordered) }
            Button("共有URLコピー") { copyShareURL() }.buttonStyle(.bordered)
            if let shareNote { Text(shareNote).font(.caption).foregroundStyle(AMDOSDesign.muted) }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 14)
        .padding(20)
    }

    @ViewBuilder
    private var record: some View {
        if isUpcoming {
            AMDOSMeetingPrepWorkerSection(meeting: currentMeeting)
            AMDOSSectionCard(currentMeeting.meetingStartAt == nil ? "日程調整中のブリーフ" : "MTG準備ブリーフ", systemImage: "calendar.badge.clock") {
                if let narrative = currentMeeting.narrativeMd?.trimmedNonEmpty { AMDOSMeetingMarkdown(markdown: narrative) }
                else if let summary = currentMeeting.summaryShort?.trimmedNonEmpty { AMDOSMeetingMarkdown(markdown: summary) }
                AMDOSMeetingTopic(title: "会議後に残したい状態", helper: "何を決めたと言えれば、このMTGを終えてよいか。", items: currentMeeting.decided ?? [], tint: AMDOSDesign.success)
                AMDOSMeetingTopic(title: "いまの状況", helper: "初めて読む人が、なぜこのMTGが必要なのかを掴むための前提。", items: currentMeeting.progress ?? [], tint: AMDOSDesign.blue)
                AMDOSMeetingTopic(title: "当日までに揃えるもの", helper: "資料、質問、こちらのスタンス。", items: currentMeeting.nextActions ?? [], tint: AMDOSDesign.warning)
                AMDOSMeetingTopic(title: "必ず確認すること", helper: "会議前に確認しておく前提と質問。", items: currentMeeting.risks ?? [], tint: AMDOSDesign.warning)
            }
            Button("Codex相談メモをコピー") { copyCodexPrompt() }.buttonStyle(.bordered)
        } else if isDialogue {
            AMDOSSectionCard("提案前の論点整理", systemImage: "text.bubble") {
                if let narrative = currentMeeting.narrativeMd?.trimmedNonEmpty { AMDOSMeetingMarkdown(markdown: narrative) }
                else {
                    AMDOSMeetingTopic(title: "背景・議題", helper: "", items: currentMeeting.summaryShort.map { [$0] } ?? [], tint: AMDOSDesign.muted)
                    AMDOSMeetingTopic(title: "議論の中で進んだこと", helper: "", items: currentMeeting.progress ?? [], tint: AMDOSDesign.blue)
                    AMDOSMeetingTopic(title: "チームへの提案案", helper: "", items: currentMeeting.decided ?? [], tint: AMDOSDesign.success)
                    AMDOSMeetingTopic(title: "次の一手", helper: "", items: currentMeeting.nextActions ?? [], tint: AMDOSDesign.warning)
                    AMDOSMeetingTopic(title: "気になっていること / 残課題", helper: "", items: currentMeeting.risks ?? [], tint: AMDOSDesign.warning)
                }
            }
        } else {
            if let narrative = currentMeeting.narrativeMd?.trimmedNonEmpty {
                AMDOSSectionCard("議事録", systemImage: "doc.text") { AMDOSMeetingMarkdown(markdown: narrative) }
            } else if let summary = currentMeeting.summaryShort?.trimmedNonEmpty {
                AMDOSSectionCard("サマリ", systemImage: "doc.plaintext") { AMDOSMeetingMarkdown(markdown: summary) }
            }
            if let prepMeeting { AMDOSMeetingPreparationArchive(meeting: prepMeeting) }
            if currentMeeting.narrativeMd?.trimmedNonEmpty == nil {
                AMDOSMeetingTopic(title: "決まったこと", helper: "", items: currentMeeting.decided ?? [], tint: AMDOSDesign.success)
                AMDOSMeetingTopic(title: "進んだこと", helper: "", items: currentMeeting.progress ?? [], tint: AMDOSDesign.blue)
                AMDOSMeetingTopic(title: "次やること", helper: "", items: currentMeeting.nextActions ?? [], tint: AMDOSDesign.warning)
                AMDOSMeetingTopic(title: "リスク", helper: "", items: currentMeeting.risks ?? [], tint: AMDOSDesign.warning)
            }
        }
    }

    private var editor: some View {
        AMDOSSectionCard(isUpcoming ? "MTG準備を編集" : "会議記録を編集", systemImage: "pencil") {
            if !auth.isAdmin { AMDOSPermissionDeniedView(message: "PWAと同じく、会議記録の更新はadminだけが実行できるよ。") }
            AMDOSTextField(title: "タイトル *", text: $title)
            AMDOSTextField(title: "一覧カードサマリ", text: $summaryShort, axis: .vertical)
            AMDOSTextField(title: isUpcoming ? "初見ブリーフ" : isDialogue ? "提案整理本文" : "議事録", text: $narrativeMd, axis: .vertical)
            AMDOSTextField(title: isDialogue ? "チームへの提案案（空行で区切る）" : isUpcoming ? "会議後に残したい状態（空行で区切る）" : "決まったこと（空行で区切る）", text: $decided, axis: .vertical)
            AMDOSTextField(title: isDialogue ? "議論の中で進んだこと（空行で区切る）" : "進んだこと（空行で区切る）", text: $progress, axis: .vertical)
            AMDOSTextField(title: isUpcoming ? "当日までに揃えるもの（空行で区切る）" : "次やること（空行で区切る）", text: $nextActions, axis: .vertical)
            AMDOSTextField(title: isDialogue ? "気になっていること / 残課題（空行で区切る）" : isUpcoming ? "必ず確認すること（空行で区切る）" : "リスク（空行で区切る）", text: $risks, axis: .vertical)
            HStack {
                Button(saving ? "保存中…" : "保存") { save() }.buttonStyle(.borderedProminent).disabled(saving || title.trimmedNonEmpty == nil || !auth.isAdmin)
                if !auth.isAdmin { Text("admin権限が必要").font(.caption).foregroundStyle(AMDOSDesign.warning) }
            }
        }
    }

    private func save() {
        guard auth.isAdmin else { message = "保存失敗: admin権限が必要"; return }
        guard let cleanTitle = title.trimmedNonEmpty else { message = "保存失敗: タイトルを入れてね"; return }
        saving = true
        message = nil
        Task {
            do {
                let data: Data
                if isUpcoming {
                    guard let projectId = currentMeeting.projectId?.trimmedNonEmpty, let meetingDate = currentMeeting.meetingDate?.trimmedNonEmpty else {
                        throw AMDOSNetworkError.http("予定MTGにはproject_idとmeeting_dateが必要だよ")
                    }
                    data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/meeting-prep", body: AMDOSMeetingPrepInput(meetingId: currentMeeting.meetingId, projectId: projectId, meetingDate: meetingDate, meetingStartAt: currentMeeting.meetingStartAt, title: cleanTitle, calendarEventId: currentMeeting.calendarEventId, sourceUrl: currentMeeting.sourceUrl, summaryShort: summaryShort, decided: amdOSMeetingBlockArray(decided), progress: amdOSMeetingBlockArray(progress), nextActions: amdOSMeetingBlockArray(nextActions), risks: amdOSMeetingBlockArray(risks), narrativeMd: narrativeMd))
                } else {
                    data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/meeting-summary/manual-update", body: AMDOSMeetingSummaryUpdateInput(meetingId: currentMeeting.meetingId, title: cleanTitle, summaryShort: summaryShort, decided: amdOSMeetingBlockArray(decided), progress: amdOSMeetingBlockArray(progress), nextActions: amdOSMeetingBlockArray(nextActions), risks: amdOSMeetingBlockArray(risks), narrativeMd: narrativeMd))
                }
                let response = try JSONDecoder().decode(AMDOSMeetingMutationResponse.self, from: data)
                guard response.ok != false, let updated = response.meeting else { throw AMDOSNetworkError.http(response.error ?? "会議記録を保存できなかったよ") }
                applyUpdate(updated)
                editing = false
                message = "保存したよ"
            } catch { message = "保存失敗: \(error.localizedDescription)" }
            saving = false
        }
    }

    private func applyUpdate(_ updated: AMDOSParityCockpitMeeting) {
        currentMeeting = updated
        title = updated.title ?? ""
        summaryShort = updated.summaryShort ?? ""
        narrativeMd = updated.narrativeMd ?? ""
        decided = amdOSMeetingBlocks(updated.decided ?? [])
        progress = amdOSMeetingBlocks(updated.progress ?? [])
        nextActions = amdOSMeetingBlocks(updated.nextActions ?? [])
        risks = amdOSMeetingBlocks(updated.risks ?? [])
        onMeetingUpdated(updated)
    }

    private func openExternal(_ string: String) {
        guard let url = URL(string: string) else { return }
        NSWorkspace.shared.open(url)
    }

    private func copyEmail(prep: Bool) {
        let body = amdOSMeetingEmailBody(currentMeeting, prep: prep, prepArchive: prepMeeting)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(body, forType: .string)
        shareNote = prep ? "準備メモをコピーしたよ" : "議事録本文をコピーしたよ"
    }

    private func copyCodexPrompt() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(amdOSMeetingPrepCodexPrompt(currentMeeting), forType: .string)
        shareNote = "Codex相談メモをコピーしたよ"
    }

    private func copyShareURL() {
        guard let projectId = currentMeeting.projectId else { shareNote = "共有URLを作れなかった"; return }
        Task {
            guard let url = await AMDOSRESTClient.shared.pwaURL(path: "/project/\(projectId)/cockpit", query: ["meeting": currentMeeting.meetingId]) else { shareNote = "共有URLを作れなかった"; return }
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(url.absoluteString, forType: .string)
            shareNote = "共有URLをコピーしたよ"
        }
    }

    private func savePDF() {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "\(currentMeeting.title ?? "meeting")-\(currentMeeting.meetingDate ?? "record").pdf"
        panel.allowedContentTypes = [.pdf]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let view = NSTextView(frame: NSRect(x: 0, y: 0, width: 560, height: 780))
        view.string = amdOSMeetingEmailBody(currentMeeting, prep: isUpcoming, prepArchive: prepMeeting)
        view.font = NSFont.systemFont(ofSize: 12)
        view.isEditable = false
        let base = view.dataWithPDF(inside: view.bounds)
        Task {
            do {
                guard let document = PDFDocument(data: base) else { throw AMDOSNetworkError.http("PDF本文を作れなかった") }
                let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSMeetingAssetsResponse.self, path: "/api/meeting-assets", query: ["meeting_id": currentMeeting.meetingId])
                guard response.ok != false else { throw AMDOSNetworkError.http(response.error ?? "添付を読み込めなかったよ") }
                for asset in (response.assets ?? []).filter({ ["application/pdf", "image/png", "image/jpeg"].contains($0.mediaType) }) {
                    let data = try await amdOSMeetingAssetData(asset)
                    if asset.mediaType == "application/pdf", let attachment = PDFDocument(data: data) {
                        for pageIndex in 0..<attachment.pageCount { if let page = attachment.page(at: pageIndex) { document.insert(page, at: document.pageCount) } }
                    } else if let image = NSImage(data: data), let page = PDFPage(image: image) {
                        document.insert(page, at: document.pageCount)
                    }
                }
                guard document.write(to: url) else { throw AMDOSNetworkError.http("PDFを書き出せなかった") }
                shareNote = "PDFを保存したよ"
            } catch { shareNote = "PDF保存に失敗した: \(error.localizedDescription)" }
        }
    }
}

private struct AMDOSMeetingAssetsPanel: View {
    let meeting: AMDOSParityCockpitMeeting
    let onMeetingUpdated: (AMDOSParityCockpitMeeting) -> Void
    @EnvironmentObject private var auth: AMDOSAuthStore
    @State private var assets: [AMDOSMeetingAsset] = []
    @State private var loading = false
    @State private var uploading = false
    @State private var showImporter = false
    @State private var dragActive = false
    @State private var message: String?
    @State private var deleteTarget: AMDOSMeetingAsset?
    @State private var markdownAsset: AMDOSMeetingAsset?

    private var counts: (images: Int, pdfs: Int) {
        (assets.filter { $0.mediaType.hasPrefix("image/") }.count, assets.filter { $0.mediaType == "application/pdf" }.count)
    }

    var body: some View {
        AMDOSSectionCard("添付資料", systemImage: "paperclip") {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(assets.isEmpty ? "添付なし" : "\(assets.count)件 / 画像 \(counts.images) / PDF \(counts.pdfs) / 他 \(assets.count - counts.images - counts.pdfs)").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    if let folder = assets.first(where: { $0.folderDisplayPath?.trimmedNonEmpty != nil }) {
                        HStack(spacing: 4) {
                            Text("保存先:").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            Button(folder.folderDisplayPath ?? "PJフォルダ") { openAbsoluteURL(folder.driveFolderUrl) }.buttonStyle(.link).font(.caption2)
                        }
                    }
                }
                Spacer()
                Button("選択") { showImporter = true }.disabled(uploading || !auth.isAdmin)
                Button("ペースト") { pasteImages() }.disabled(uploading || !auth.isAdmin)
                Button("画面") { captureScreen() }.disabled(uploading || !auth.isAdmin)
                Button("本文へ") { insertIntoNarrative() }.buttonStyle(.borderedProminent).disabled(assets.isEmpty || uploading || !auth.isAdmin)
                Button { loadAssets() } label: { Image(systemName: "arrow.clockwise") }.disabled(loading)
            }
            .onDrop(of: [.fileURL], isTargeted: $dragActive) { providers in
                importDroppedFiles(providers)
            }
            .padding(10)
            .background(dragActive ? AMDOSDesign.blue.opacity(0.10) : Color.clear)
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(dragActive ? AMDOSDesign.blue : Color.secondary.opacity(0.25), style: StrokeStyle(lineWidth: 1, dash: [5])))
            Text(uploading ? "追加中…" : "ここへドロップ / Cmd+V / 選択").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if !auth.isAdmin { Text("添付の作成・変更・削除はPWAと同じくadmin権限が必要").font(.caption).foregroundStyle(AMDOSDesign.warning) }
            if let message = message?.trimmedNonEmpty { Text(message).font(.caption).foregroundStyle(message.hasPrefix("失敗") ? AMDOSDesign.warning : AMDOSDesign.muted).textSelection(.enabled) }
            if loading { ProgressView().controlSize(.small) }
            if !loading && assets.isEmpty { Text("MTGに紐づく添付はまだないよ").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            ForEach(Array(assets.enumerated()), id: \.element.id) { index, asset in
                AMDOSMeetingAssetRow(asset: asset, index: index, count: assets.count, onMove: { delta in reorder(index: index, delta: delta) }, onCaption: { patchCaption(asset: asset, caption: $0) }, onOpen: { openAsset(asset) }, onOpenMarkdown: { markdownAsset = asset }, onDelete: { deleteTarget = asset })
            }
        }
        .task(id: meeting.meetingId) { loadAssets() }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.data, .content, .pdf, .plainText, .image], allowsMultipleSelection: true) { result in
            switch result {
            case .success(let urls): upload(urls: urls, assetKind: "upload")
            case .failure(let error): message = "アップロード失敗: \(error.localizedDescription)"
            }
        }
        .confirmationDialog("この添付を削除する？", isPresented: Binding(get: { deleteTarget != nil }, set: { if !$0 { deleteTarget = nil } }), presenting: deleteTarget) { asset in
            Button("削除", role: .destructive) { delete(asset) }
        } message: { asset in Text(asset.fileName) }
        .sheet(item: $markdownAsset) { asset in AMDOSMeetingMarkdownPreview(asset: asset) }
    }

    private func loadAssets() {
        loading = true
        Task {
            do {
                let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSMeetingAssetsResponse.self, path: "/api/meeting-assets", query: ["meeting_id": meeting.meetingId])
                guard response.ok != false else { throw AMDOSNetworkError.http(response.error ?? "添付を読み込めなかったよ") }
                assets = response.assets ?? []
                message = nil
            } catch { message = "添付の読み込み失敗: \(error.localizedDescription)" }
            loading = false
        }
    }

    private func upload(urls: [URL], assetKind: String) {
        guard auth.isAdmin else { message = "アップロード失敗: admin権限が必要"; return }
        guard !urls.isEmpty else { return }
        uploading = true
        message = nil
        Task {
            do {
                let files = try urls.map { url -> AMDOSUploadFile in
                    let scoped = url.startAccessingSecurityScopedResource()
                    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                    let data = try Data(contentsOf: url)
                    return AMDOSUploadFile(fieldName: "files", filename: url.lastPathComponent, mimeType: UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream", data: data)
                }
                let data = try await AMDOSRESTClient.shared.uploadMultipart(path: "/api/meeting-assets", fields: ["meeting_id": meeting.meetingId, "asset_kind": assetKind], files: files)
                let response = try JSONDecoder().decode(AMDOSMeetingAssetsResponse.self, from: data)
                guard response.ok != false else { throw AMDOSNetworkError.http(response.error ?? "添付を追加できなかったよ") }
                assets = response.assets ?? []
                message = "\(files.count)件追加したよ"
            } catch { message = "アップロード失敗: \(error.localizedDescription)" }
            uploading = false
        }
    }

    private func pasteImages() {
        let images = (NSPasteboard.general.readObjects(forClasses: [NSImage.self], options: nil) as? [NSImage]) ?? []
        let urls = images.enumerated().compactMap { index, image -> URL? in
            guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let data = bitmap.representation(using: .png, properties: [:]) else { return nil }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("clipboard-\(amdOSMeetingTimestamp())-\(index + 1).png")
            try? data.write(to: url, options: .atomic)
            return url
        }
        if urls.isEmpty { message = "クリップボードに画像がないよ" } else { upload(urls: urls, assetKind: "paste") }
    }

    private func captureScreen() {
        guard CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess() else { message = "画面収録の許可が必要だよ"; return }
        guard let image = CGDisplayCreateImage(CGMainDisplayID()), let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else { message = "画面キャプチャに失敗したよ"; return }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("screen-capture-\(amdOSMeetingTimestamp()).png")
        do { try data.write(to: url, options: .atomic); upload(urls: [url], assetKind: "screen_capture") }
        catch { message = "画面キャプチャ失敗: \(error.localizedDescription)" }
    }

    private func importDroppedFiles(_ providers: [NSItemProvider]) -> Bool {
        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                let url = (item as? URL) ?? (item as? Data).flatMap { URL(dataRepresentation: $0, relativeTo: nil) }
                guard let url else { return }
                DispatchQueue.main.async { upload(urls: [url], assetKind: "upload") }
            }
        }
        return !providers.isEmpty
    }

    private func patchCaption(asset: AMDOSMeetingAsset, caption: String) {
        guard auth.isAdmin else { return }
        Task {
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/meeting-assets", method: "PATCH", body: AMDOSMeetingAssetPatch(assetId: asset.assetId, caption: caption, sortOrder: nil))
                let response = try JSONDecoder().decode(AMDOSMeetingAssetMutationResponse.self, from: data)
                guard response.ok != false, let updated = response.asset else { throw AMDOSNetworkError.http(response.error ?? "キャプションを保存できなかったよ") }
                if let index = assets.firstIndex(where: { $0.assetId == updated.assetId }) { assets[index] = updated }
            } catch { message = "保存失敗: \(error.localizedDescription)" }
        }
    }

    private func reorder(index: Int, delta: Int) {
        let destination = index + delta
        guard auth.isAdmin, assets.indices.contains(destination) else { return }
        var reordered = assets
        let moved = reordered.remove(at: index)
        reordered.insert(moved, at: destination)
        reordered = reordered.enumerated().map { offset, asset in var value = asset; value.sortOrder = (offset + 1) * 10; return value }
        assets = reordered
        Task {
            do {
                for asset in reordered {
                    let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/meeting-assets", method: "PATCH", body: AMDOSMeetingAssetPatch(assetId: asset.assetId, caption: nil, sortOrder: asset.sortOrder))
                    let response = try JSONDecoder().decode(AMDOSMeetingAssetMutationResponse.self, from: data)
                    guard response.ok != false else { throw AMDOSNetworkError.http(response.error ?? "並び順を保存できなかったよ") }
                }
            } catch { message = "保存失敗: \(error.localizedDescription)"; loadAssets() }
        }
    }

    private func delete(_ asset: AMDOSMeetingAsset) {
        guard auth.isAdmin else { return }
        deleteTarget = nil
        Task {
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/meeting-assets?asset_id=\(asset.assetId)", method: "DELETE", body: AMDOSEmptyRequest())
                let response = try JSONDecoder().decode(AMDOSMeetingAssetMutationResponse.self, from: data)
                guard response.ok != false else { throw AMDOSNetworkError.http(response.error ?? "添付を削除できなかったよ") }
                assets.removeAll { $0.assetId == asset.assetId }
                message = "削除したよ"
            } catch { message = "削除失敗: \(error.localizedDescription)" }
        }
    }

    private func insertIntoNarrative() {
        guard auth.isAdmin else { return }
        Task {
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/meeting-assets/insert-markdown", body: AMDOSMeetingAssetInsertInput(meetingId: meeting.meetingId))
                let response = try JSONDecoder().decode(AMDOSMeetingMutationResponse.self, from: data)
                guard response.ok != false, let updated = response.meeting else { throw AMDOSNetworkError.http(response.error ?? "本文へ反映できなかったよ") }
                onMeetingUpdated(updated)
                message = "本文に入れたよ"
            } catch { message = "本文挿入失敗: \(error.localizedDescription)" }
        }
    }

    private func openAsset(_ asset: AMDOSMeetingAsset) {
        Task {
            do {
                let data = try await amdOSMeetingAssetData(asset)
                let destination = FileManager.default.temporaryDirectory.appendingPathComponent(asset.fileName)
                try data.write(to: destination, options: .atomic)
                NSWorkspace.shared.open(destination)
            } catch { message = "資料を開けなかった: \(error.localizedDescription)" }
        }
    }

    private func openAbsoluteURL(_ string: String?) {
        guard let string, let url = URL(string: string) else { return }
        NSWorkspace.shared.open(url)
    }
}

private struct AMDOSMeetingAssetRow: View {
    let asset: AMDOSMeetingAsset
    let index: Int
    let count: Int
    let onMove: (Int) -> Void
    let onCaption: (String) -> Void
    let onOpen: () -> Void
    let onOpenMarkdown: () -> Void
    let onDelete: () -> Void
    @State private var caption: String
    @FocusState private var captionFocused: Bool

    init(asset: AMDOSMeetingAsset, index: Int, count: Int, onMove: @escaping (Int) -> Void, onCaption: @escaping (String) -> Void, onOpen: @escaping () -> Void, onOpenMarkdown: @escaping () -> Void, onDelete: @escaping () -> Void) {
        self.asset = asset; self.index = index; self.count = count; self.onMove = onMove; self.onCaption = onCaption; self.onOpen = onOpen; self.onOpenMarkdown = onOpenMarkdown; self.onDelete = onDelete
        _caption = State(initialValue: asset.caption)
    }

    private var isMarkdown: Bool { asset.mediaType == "text/markdown" || asset.mediaType == "text/x-markdown" || asset.fileName.lowercased().hasSuffix(".md") || asset.fileName.lowercased().hasSuffix(".markdown") }
    private var isImage: Bool { asset.mediaType.hasPrefix("image/") }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if isImage { AMDOSMeetingAssetImage(asset: asset).frame(width: 112, height: 84) }
            else { Button(action: isMarkdown ? onOpenMarkdown : onOpen) { Image(systemName: isMarkdown ? "doc.text" : asset.mediaType == "application/pdf" ? "doc.richtext" : "doc").font(.title2).frame(width: 112, height: 84).background(Color.secondary.opacity(0.10), in: RoundedRectangle(cornerRadius: 8)) }.buttonStyle(.plain) }
            VStack(alignment: .leading, spacing: 6) {
                HStack { Text(asset.fileName).font(.subheadline.weight(.medium)).lineLimit(1); Spacer(); Text("\(amdOSMeetingAssetKind(asset.assetKind)) · \(amdOSMeetingAssetSize(asset.fileSizeBytes))").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                HStack(spacing: 5) {
                    Button { onMove(-1) } label: { Image(systemName: "arrow.up") }.disabled(index == 0)
                    Button { onMove(1) } label: { Image(systemName: "arrow.down") }.disabled(index == count - 1)
                    Button(isMarkdown ? "本文を読む" : "開く") { isMarkdown ? onOpenMarkdown() : onOpen() }
                    Button("削除", role: .destructive) { onDelete() }
                }.buttonStyle(.bordered)
                TextField("キャプション", text: $caption).textFieldStyle(.roundedBorder).focused($captionFocused).onSubmit { onCaption(caption) }.onChange(of: captionFocused) { _, focused in if !focused { onCaption(caption) } }.onChange(of: asset.caption) { _, value in caption = value }
            }
        }
        .padding(10)
        .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct AMDOSMeetingAssetImage: View {
    let asset: AMDOSMeetingAsset
    @State private var image: NSImage?
    var body: some View {
        Group {
            if let image { Image(nsImage: image).resizable().scaledToFit() }
            else { ProgressView().controlSize(.small) }
        }
        .background(Color.secondary.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
        .task(id: asset.assetId) { image = try? NSImage(data: await amdOSMeetingAssetData(asset)) }
    }
}

private struct AMDOSMeetingMarkdownPreview: View {
    let asset: AMDOSMeetingAsset
    @Environment(\.dismiss) private var dismiss
    @State private var markdownBody = ""
    @State private var error: String?
    var body: some View {
        VStack(spacing: 0) {
            HStack { Text(asset.fileName).font(.headline); Spacer(); Button("閉じる") { dismiss() } }.padding()
            Divider()
            ScrollView { Group { if let error { Text(error).foregroundStyle(AMDOSDesign.warning) } else if markdownBody.isEmpty { ProgressView() } else { AMDOSMeetingMarkdown(markdown: markdownBody) } }.frame(maxWidth: .infinity, alignment: .leading).padding() }
        }
        .frame(minWidth: 700, minHeight: 540)
        .task { do { markdownBody = try String(decoding: await amdOSMeetingAssetData(asset), as: UTF8.self) } catch { self.error = "Markdownを開けなかった: \(error.localizedDescription)" } }
    }
}

private struct AMDOSMeetingMarkdown: View {
    let markdown: String
    var body: some View { Text((try? AttributedString(markdown: markdown, options: .init(interpretedSyntax: .full))) ?? AttributedString(markdown)).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading) }
}

private struct AMDOSMeetingTopic: View {
    let title: String
    let helper: String
    let items: [String]
    let tint: Color
    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 5) { Text(title).font(.subheadline.weight(.semibold)); if let helper = helper.trimmedNonEmpty { Text(helper).font(.caption).foregroundStyle(AMDOSDesign.muted) }; ForEach(items, id: \.self) { Text("• \($0)").textSelection(.enabled) } }
                .padding(.leading, 9).overlay(alignment: .leading) { Rectangle().fill(tint).frame(width: 3) }
        }
    }
}

private struct AMDOSMeetingPreparationArchive: View {
    let meeting: AMDOSParityCockpitMeeting
    @State private var expanded = false
    var body: some View {
        DisclosureGroup("MTG準備情報", isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: 12) {
                if let narrative = meeting.narrativeMd?.trimmedNonEmpty { AMDOSMeetingMarkdown(markdown: narrative) }
                else if let summary = meeting.summaryShort?.trimmedNonEmpty { AMDOSMeetingMarkdown(markdown: summary) }
                AMDOSMeetingTopic(title: "会議後に残したい状態", helper: "", items: meeting.decided ?? [], tint: AMDOSDesign.success)
                AMDOSMeetingTopic(title: "いまの状況", helper: "", items: meeting.progress ?? [], tint: AMDOSDesign.blue)
                AMDOSMeetingTopic(title: "当日までに揃えるもの", helper: "", items: meeting.nextActions ?? [], tint: AMDOSDesign.warning)
                AMDOSMeetingTopic(title: "必ず確認すること", helper: "", items: meeting.risks ?? [], tint: AMDOSDesign.warning)
            }
            .padding(.top, 10)
        }
        .padding(12)
        .background(AMDOSDesign.warning.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct AMDOSMeetingPrepWorkerSection: View {
    let meeting: AMDOSParityCockpitMeeting
    @State private var showReasons = false
    private var statusLabel: String { ["preparing": "準備中", "ready": "準備OK", "failed": "起動失敗"][meeting.prepWorkerStatus ?? ""] ?? (meeting.prepWorkerStatus ?? "") }
    private var readinessTint: Color {
        guard let score = meeting.prepReadinessScore else { return AMDOSDesign.muted }
        return score >= 80 ? AMDOSDesign.success : score >= 50 ? AMDOSDesign.warning : .red
    }
    var body: some View {
        if meeting.prepWorkerStatus != nil || meeting.prepReadinessScore != nil || meeting.prepWorkerSessionId?.trimmedNonEmpty != nil || meeting.prepDraftMd?.trimmedNonEmpty != nil {
            AMDOSSectionCard("MTG Prep セッション", systemImage: "sparkles") {
                HStack {
                    AMDOSStatusBadge(text: "readiness \(meeting.prepReadinessScore.map { String(Int($0.rounded())) } ?? "—")", tint: readinessTint)
                    if !statusLabel.isEmpty { AMDOSStatusBadge(text: statusLabel, tint: readinessTint) }
                    Spacer()
                }
                if let status = meeting.prepWorkerStatus {
                    Text(status == "ready" ? "codex desktopで開いてね、待機してるよ" : status == "preparing" ? "session立ち上げ済み、draft生成中…" : status == "failed" ? "session起動失敗、手動準備して" : status).font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                if let session = meeting.prepWorkerSessionId?.trimmedNonEmpty { Text("SESSION_ID: \(session)").font(.caption2.monospaced()).textSelection(.enabled) }
                if let event = meeting.prepCalendarEventId?.trimmedNonEmpty { Text("＋ prep枠（まさカレンダー）連動済み: \(event)").font(.caption2).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled) }
                if let reasons = meeting.prepReadinessReasons {
                    DisclosureGroup("readiness 内訳", isExpanded: $showReasons) { Text(amdOSMeetingJSONText(reasons)).font(.caption2.monospaced()).textSelection(.enabled).padding(.top, 4) }
                }
                if let draft = meeting.prepDraftMd?.trimmedNonEmpty { AMDOSMeetingMarkdown(markdown: draft) }
                else if meeting.prepWorkerStatus != "ready" { Text("まだdraft生成中だよ。sessionが立ち上がったらcodexで開いて対話で詰められるよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            }
        }
    }
}

private func amdOSMeetingBlocks(_ items: [String]) -> String { items.joined(separator: "\n\n") }
private func amdOSMeetingBlockArray(_ value: String) -> [String] {
    var blocks: [String] = []
    var current: [String] = []
    for line in value.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n") {
        if line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let block = current.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            if !block.isEmpty { blocks.append(block) }
            current = []
        } else { current.append(line) }
    }
    let block = current.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    if !block.isEmpty { blocks.append(block) }
    return blocks
}
private func amdOSMeetingSourceKindTokens(_ value: String?) -> Set<String> { Set((value ?? "").split(separator: "+").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }) }
private func amdOSMeetingTimestamp() -> String { let formatter = DateFormatter(); formatter.dateFormat = "yyyyMMdd-HHmmss"; return formatter.string(from: .now) }
private func amdOSMeetingAssetKind(_ value: String) -> String { ["paste": "Paste", "screen_capture": "Capture", "notion_image": "Notion" ][value] ?? "Upload" }
private func amdOSMeetingAssetSize(_ value: Int) -> String { value < 1_048_576 ? "\(max(1, value / 1024))KB" : String(format: "%.1fMB", Double(value) / 1_048_576) }
private func amdOSMeetingJSONText(_ value: AMDOSParityCockpitJSON) -> String {
    if let string = value.string { return string }
    if let number = value.number { return String(number) }
    if let bool = value.bool { return bool ? "true" : "false" }
    if let array = value.array { return "[\n" + array.map { "  " + amdOSMeetingJSONText($0) }.joined(separator: ",\n") + "\n]" }
    if let object = value.object { return "{\n" + object.keys.sorted().map { "  \($0): \(amdOSMeetingJSONText(object[$0]!))" }.joined(separator: "\n") + "\n}" }
    return ""
}
private func amdOSMeetingPrepCodexPrompt(_ meeting: AMDOSParityCockpitMeeting) -> String {
    ["# MTG準備: \(meeting.title ?? "会議")", "", "project_id: \(meeting.projectId ?? "")", "meeting_id: \(meeting.meetingId)", "date: \(meeting.meetingDate ?? "")", meeting.meetingStartAt.map { "start: \($0)" } ?? "", "", "## このMTGの狙い", meeting.summaryShort?.trimmedNonEmpty ?? "(未記入)", "", "## このMTGで決めること", amdOSMeetingBlocks(meeting.decided ?? []).nilIfEmpty ?? "(未記入)", "", "## 前提・持ち込みたい現状", amdOSMeetingBlocks(meeting.progress ?? []).nilIfEmpty ?? "(未記入)", "", "## それまでに用意するもの", amdOSMeetingBlocks(meeting.nextActions ?? []).nilIfEmpty ?? "(未記入)", "", "## 必ず確認すること", amdOSMeetingBlocks(meeting.risks ?? []).nilIfEmpty ?? "(未記入)", "", "## えいみ準備メモ", meeting.narrativeMd?.trimmedNonEmpty ?? "(未記入)"].filter { !$0.isEmpty }.joined(separator: "\n")
}
private func amdOSMeetingEmailBody(_ meeting: AMDOSParityCockpitMeeting, prep: Bool, prepArchive: AMDOSParityCockpitMeeting? = nil) -> String {
    let source = prep ? (prepArchive ?? meeting) : meeting
    let subjectKind = prep ? "MTG準備メモ" : (source.meetingId.hasPrefix("dialogue:") ? "提案整理メモ" : "議事録")
    let title = source.title ?? "会議"
    let date = [source.meetingDate, source.meetingStartAt].compactMap { $0?.trimmedNonEmpty }.joined(separator: " ")
    let subjectDate = source.meetingDate ?? "日付未定"
    let narrativeParts = amdOSMeetingNarrativeParts(source.narrativeMd)
    let sourceIsPrep = amdOSMeetingSourceKindTokens(source.sourceKinds).contains("upcoming") || amdOSMeetingSourceKindTokens(source.sourceKinds).contains("upcoming_tentative") || source.meetingId.hasPrefix("upcoming:")
    let markdown: String
    if let narrative = (prep ? (narrativeParts.prep ?? (sourceIsPrep ? narrativeParts.minutes : nil)) : narrativeParts.minutes)?.trimmedNonEmpty { markdown = narrative }
    else if prep {
        markdown = [
            source.summaryShort.map { "## まず読む\n\n\($0)" } ?? "",
            amdOSMeetingSection("会議後に残したい状態", source.decided),
            amdOSMeetingSection("いまの状況", source.progress),
            amdOSMeetingSection("当日までに揃えるもの", source.nextActions),
            amdOSMeetingSection("必ず確認すること", source.risks)
        ].filter { !$0.isEmpty }.joined(separator: "\n\n")
    } else {
        markdown = [amdOSMeetingSection("決まったこと", source.decided), amdOSMeetingSection("進んだこと", source.progress), amdOSMeetingSection("次やること", source.nextActions), amdOSMeetingSection("リスク・残課題", source.risks)].filter { !$0.isEmpty }.joined(separator: "\n\n")
    }
    let plain = markdown.replacingOccurrences(of: "## ", with: "■ ").replacingOccurrences(of: "- ", with: "・")
    return ["件名: 【\(subjectKind)共有】\(title)（\(subjectDate)）", "", "各位", "", "以下、\(subjectKind)を共有します。", "", "【MTG】\(title)", "【日時】\(date)", source.summaryShort.map { "【概要】\($0)" } ?? "", "", plain.isEmpty ? "本文はまだ整理されていません。" : plain].filter { !$0.isEmpty }.joined(separator: "\n") + "\n"
}
private func amdOSMeetingSection(_ title: String, _ values: [String]?) -> String { guard let values, !values.isEmpty else { return "" }; return "## \(title)\n\n" + values.map { "- \($0)" }.joined(separator: "\n") }
private func amdOSMeetingNarrativeParts(_ value: String?) -> (minutes: String?, prep: String?) {
    guard let source = value?.trimmingCharacters(in: .whitespacesAndNewlines), !source.isEmpty else { return (nil, nil) }
    let pattern = #"\n\s*(?:-{3,}\s*\n\s*)?##\s*(?:参考[:：]\s*)?会議前準備メモ[^\n]*\n"#
    guard let regex = try? NSRegularExpression(pattern: pattern), let match = regex.firstMatch(in: source, range: NSRange(source.startIndex..., in: source)), let range = Range(match.range, in: source) else { return (source, nil) }
    let minutes = String(source[..<range.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
    let prep = String(source[range.lowerBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
    return (minutes.isEmpty ? nil : minutes, prep.isEmpty ? nil : prep)
}
private func amdOSMeetingAssetData(_ asset: AMDOSMeetingAsset) async throws -> Data {
    let source = asset.signedUrl.trimmedNonEmpty ?? asset.fileUrl
    if source.hasPrefix("/") { return try await AMDOSRESTClient.shared.fetchPWAData(path: source) }
    guard let url = URL(string: source) else { throw AMDOSNetworkError.invalidURL }
    let (data, response) = try await URLSession.shared.data(from: url)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw AMDOSNetworkError.http("添付の取得に失敗したよ") }
    return data
}

// The company tab uses the PWA governance contract directly.  It is kept
// separate from the admin screen because CockpitCompanyOverview is available
// to every authenticated AMD member, while the admin route has a different
// navigation and write boundary.
private struct AMDOSParityCockpitCompanyProfile: Codable, Sendable {
    let projectId: String?
    let legalStatus: String?
    let legalName: String?
    let legalNameEn: String?
    let corporateNumber: String?
    let entityType: String?
    let incorporatedOn: String?
    let headOffice: String?
    let businessPurpose: String?
    let representativeName: String?
    let capitalYen: Double?
    let authorizedShares: Double?
    let registeredIssuedShares: Double?
    let boardStructure: String?
    let hasBoard: Bool?
    let hasAuditor: Bool?
    let fiscalYearEndMonth: Int?
    let publicNoticeMethod: String?
    let invoiceRegistrationNumber: String?
    let sourceRef: String?
    let sourceVerifiedOn: String?
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id", legalStatus = "legal_status", legalName = "legal_name", legalNameEn = "legal_name_en", corporateNumber = "corporate_number"
        case entityType = "entity_type", incorporatedOn = "incorporated_on", headOffice = "head_office", businessPurpose = "business_purpose", representativeName = "representative_name"
        case capitalYen = "capital_yen", authorizedShares = "authorized_shares", registeredIssuedShares = "registered_issued_shares", boardStructure = "board_structure", hasBoard = "has_board", hasAuditor = "has_auditor"
        case fiscalYearEndMonth = "fiscal_year_end_month", publicNoticeMethod = "public_notice_method", invoiceRegistrationNumber = "invoice_registration_number", sourceRef = "source_ref", sourceVerifiedOn = "source_verified_on", notes
    }
}

private struct AMDOSParityCockpitShareholder: Codable, Identifiable, Sendable {
    let id: String
    let holderType: String?
    let holderName: String
    let shareClass: String?
    let shares: Double?
    let ownershipPct: Double?
    let investedYen: Double?
    let asOfYm: String?
    let isCurrent: Bool?
    enum CodingKeys: String, CodingKey {
        case id, holderType = "holder_type", holderName = "holder_name", shareClass = "share_class", shares, ownershipPct = "ownership_pct", investedYen = "invested_yen", asOfYm = "as_of_ym", isCurrent = "is_current"
    }
}

private struct AMDOSParityCockpitEquityEntry: Codable, Identifiable, Sendable {
    let id: String
    let holderName: String?
    let holderType: String?
    let securityClass: String?
    let outstandingDelta: Double?
    let dilutedDelta: Double?
    let paidInYenDelta: Double?
    enum CodingKeys: String, CodingKey { case id, holderName = "holder_name", holderType = "holder_type", securityClass = "security_class", outstandingDelta = "outstanding_delta", dilutedDelta = "diluted_delta", paidInYenDelta = "paid_in_yen_delta" }
}

private struct AMDOSParityCockpitEquityTransaction: Codable, Identifiable, Sendable {
    let id: String
    let effectiveOn: String
    let transactionType: String
    let description: String?
    let status: String
    let roundId: String?
    let sourceRef: String?
    let notes: String?
    let entries: [AMDOSParityCockpitEquityEntry]?
    enum CodingKeys: String, CodingKey { case id, effectiveOn = "effective_on", transactionType = "transaction_type", description, status, roundId = "round_id", sourceRef = "source_ref", notes, entries = "project_equity_entries" }
}

private struct AMDOSParityCockpitConvertible: Codable, Identifiable, Sendable {
    let id: String
    let holderName: String
    let instrumentType: String
    let issuedOn: String?
    let principalYen: Double?
    let valuationCapYen: Double?
    let discountRate: Double?
    let conversionTrigger: String?
    let maturityOn: String?
    let estimatedConversionPrice: Double?
    let estimatedConversionShares: Double?
    let status: String
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case id, holderName = "holder_name", instrumentType = "instrument_type", issuedOn = "issued_on", principalYen = "principal_yen", valuationCapYen = "valuation_cap_yen", discountRate = "discount_rate", conversionTrigger = "conversion_trigger", maturityOn = "maturity_on", estimatedConversionPrice = "estimated_conversion_price", estimatedConversionShares = "estimated_conversion_shares", status, notes
    }
}

private struct AMDOSParityCockpitMeetingResolution: Codable, Sendable {
    let title: String?
    let type: String?
    let result: String?
}

private struct AMDOSParityCockpitMeetingAttachment: Codable, Sendable {
    let name: String?
    let url: String?
    let webViewLink: String?
    let webViewLinkSnake: String?

    enum CodingKeys: String, CodingKey {
        case name, url, webViewLink
        case webViewLinkSnake = "web_view_link"
    }

    var destination: String? {
        url?.trimmedNonEmpty ?? webViewLink?.trimmedNonEmpty ?? webViewLinkSnake?.trimmedNonEmpty
    }
}

private struct AMDOSParityCockpitFinancialPeriod: Codable, Identifiable, Sendable {
    let id: String
    let fiscalYear: Int
    let periodStartOn: String?
    let periodEndOn: String?
    let statementStatus: String
    let revenueYen: Double?
    let operatingIncomeYen: Double?
    let ordinaryIncomeYen: Double?
    let netIncomeYen: Double?
    let totalAssetsYen: Double?
    let totalLiabilitiesYen: Double?
    let netAssetsYen: Double?
    let cashYen: Double?
    let debtYen: Double?
    let filedOn: String?
    let sourceRef: String?
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case id, fiscalYear = "fiscal_year", periodStartOn = "period_start_on", periodEndOn = "period_end_on", statementStatus = "statement_status"
        case revenueYen = "revenue_yen", operatingIncomeYen = "operating_income_yen", ordinaryIncomeYen = "ordinary_income_yen", netIncomeYen = "net_income_yen"
        case totalAssetsYen = "total_assets_yen", totalLiabilitiesYen = "total_liabilities_yen", netAssetsYen = "net_assets_yen", cashYen = "cash_yen", debtYen = "debt_yen"
        case filedOn = "filed_on", sourceRef = "source_ref", notes
    }
}

private struct AMDOSParityCockpitValuationRound: Codable, Identifiable, Sendable {
    let id: String
    let roundName: String?
    let roundDate: String?
    let roundYm: String?
    let preMoneyYen: Double?
    let postMoneyYen: Double?
    let raisedYen: Double?
    let pricePerShareYen: Double?
    let leadInvestor: String?
    let sourceRef: String?
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case id, roundName = "round_name", roundDate = "round_date", roundYm = "round_ym", preMoneyYen = "pre_money_yen", postMoneyYen = "post_money_yen", raisedYen = "raised_yen", pricePerShareYen = "price_per_share_yen", leadInvestor = "lead_investor", sourceRef = "source_ref", notes
    }
}

private struct AMDOSParityCockpitCompanyMeeting: Codable, Identifiable, Sendable {
    let id: String
    let meetingType: String?
    let meetingDate: String?
    let meetingYm: String?
    let location: String?
    let agendaSummary: String?
    let resolutionsJSON: [AMDOSParityCockpitMeetingResolution]?
    let amdResponse: String?
    let attachmentsJSON: [AMDOSParityCockpitMeetingAttachment]?
    let sourceRef: String?
    let notes: String?
    enum CodingKeys: String, CodingKey { case id, meetingType = "meeting_type", meetingDate = "meeting_date", meetingYm = "meeting_ym", location, agendaSummary = "agenda_summary", resolutionsJSON = "resolutions_json", amdResponse, attachmentsJSON = "attachments_json", sourceRef = "source_ref", notes }
}

private struct AMDOSParityCockpitGovernanceAction: Codable, Identifiable, Sendable {
    let actionId: String
    let title: String
    let summary: String?
    let dueAt: String?
    let status: String
    let priority: String?
    let actionURL: String?
    var id: String { actionId }
    enum CodingKeys: String, CodingKey { case actionId = "action_id", title, summary, dueAt = "due_at", status, priority, actionURL = "action_url" }
}

private struct AMDOSParityCockpitCompanyEnvelope: Codable, Sendable {
    let ok: Bool?
    let profile: AMDOSParityCockpitCompanyProfile?
    let shareholders: [AMDOSParityCockpitShareholder]
    let transactions: [AMDOSParityCockpitEquityTransaction]
    let convertibles: [AMDOSParityCockpitConvertible]
    let financialPeriods: [AMDOSParityCockpitFinancialPeriod]
    let rounds: [AMDOSParityCockpitValuationRound]
    let meetings: [AMDOSParityCockpitCompanyMeeting]
    let actionItems: [AMDOSParityCockpitGovernanceAction]
    let error: String?
}

// MARK: - Company overview derived read model
//
// These calculations are a direct Swift translation of pwa/src/lib/company-overview.ts.
// They only transform the PWA GET response; no native database path is introduced here.

private struct AMDOSParityCapTableRow: Identifiable, Sendable {
    let key: String
    let holderType: String
    let holderName: String
    let securityClass: String
    let outstandingShares: Double
    let dilutedShares: Double
    let paidInYen: Double
    let ownershipPct: Double
    let dilutedPct: Double

    var id: String { key }
}

private struct AMDOSParityCapTableSnapshot: Identifiable, Sendable {
    let id: String
    let label: String
    let effectiveOn: String
    let transactionType: String
    let roundId: String?
    let outstandingDelta: Double
    let dilutedDelta: Double
    let paidInYenDelta: Double
    let rows: [AMDOSParityCapTableRow]
    let outstandingShares: Double
    let dilutedShares: Double
    let paidInYen: Double
}

private struct AMDOSParityCapTableTieOut: Sendable {
    enum State: Sendable, Equatable { case unknown, matched, mismatch }
    let state: State
    let ledgerShares: Double
    let registeredShares: Double
    let difference: Double
}

private struct AMDOSParityConvertibleScenario: Sendable {
    let instruments: [AMDOSParityCockpitConvertible]
    let estimatedShares: Double
    let proFormaDilutedShares: Double
}

// Kept as data (rather than a SwiftUI color) so this remains the same pure
// read model as pwa/src/lib/company-overview.ts. The native view can choose
// how to render these values without changing the cap-table calculation.
private struct AMDOSParityCapTableHolderGroup: Identifiable, Sendable {
    let holderType: String
    let label: String
    let shares: Double
    let pct: Double
    let colorHex: String

    var id: String { holderType }
}

private enum AMDOSParityCompanyOverviewMath {
    private struct Balance: Sendable {
        let key: String
        var holderType: String
        let holderName: String
        let securityClass: String
        var outstandingShares: Double
        var dilutedShares: Double
        var paidInYen: Double
    }

    private static let holderLabels: [String: String] = [
        "founder": "創業者", "amd": "AMD", "masa": "まさ", "employee": "役職員・SO",
        "vc": "VC", "angel": "エンジェル", "corporate": "事業会社", "other": "その他",
    ]

    private static let holderColors: [String: String] = [
        "founder": "#1d4ed8", "amd": "#0f766e", "masa": "#0d9488", "employee": "#7c3aed",
        "vc": "#0284c7", "angel": "#d97706", "corporate": "#475569", "other": "#94a3b8",
    ]

    private static let transactionLabels: [String: String] = [
        "opening_balance": "開始残高", "incorporation": "設立", "new_issue": "新株発行",
        "transfer": "株式譲渡", "stock_option_grant": "SO付与", "stock_option_exercise": "SO行使",
        "split": "株式分割", "consolidation": "株式併合", "cancellation": "消却・失効",
        "correction": "訂正", "in_kind_contribution": "現物出資",
    ]

    static func holderLabel(_ holderType: String) -> String {
        holderLabels[holderType] ?? holderType
    }

    static func transactionLabel(_ transaction: AMDOSParityCockpitEquityTransaction) -> String {
        transaction.description?.trimmedNonEmpty ?? transactionLabels[transaction.transactionType] ?? transaction.transactionType
    }

    static func transactionLabelForType(_ transactionType: String) -> String {
        transactionLabels[transactionType] ?? transactionType
    }

    static func profileCompleteness(_ profile: AMDOSParityCockpitCompanyProfile?) -> Int {
        let textCount = [profile?.legalName, profile?.headOffice, profile?.businessPurpose, profile?.boardStructure]
            .filter { value in value != nil && value != "" }
            .count
        return textCount
            + (profile?.capitalYen != nil ? 1 : 0)
            + (profile?.fiscalYearEndMonth != nil ? 1 : 0)
    }

    // This deliberately preserves PWA's JavaScript truthiness branch:
    // price_per_share_yen=0 falls back to post_money_yen, and a zero
    // post-money is displayed as no value rather than ¥0.
    static func selectedEquityValue(
        snapshot: AMDOSParityCapTableSnapshot?,
        latestRound: AMDOSParityCockpitValuationRound?
    ) -> Double? {
        if let snapshot, let pricePerShare = latestRound?.pricePerShareYen, pricePerShare != 0 {
            return snapshot.outstandingShares * pricePerShare
        }
        guard let postMoney = latestRound?.postMoneyYen, postMoney != 0 else { return nil }
        return postMoney
    }

    static func buildCapTableSnapshots(_ data: AMDOSParityCockpitCompanyEnvelope) -> [AMDOSParityCapTableSnapshot] {
        let transactions = data.transactions
            .filter { $0.status == "confirmed" }
            .sorted {
                if $0.effectiveOn != $1.effectiveOn { return $0.effectiveOn < $1.effectiveOn }
                return $0.id < $1.id
            }

        if transactions.isEmpty {
            let current = data.shareholders.filter { $0.isCurrent != false }
            var balances: [String: Balance] = [:]
            var balanceOrder: [String] = []
            for row in current {
                let securityClass = pwaStringOr(row.shareClass, fallback: "普通株式")
                let key = "\(row.holderName)\u{0000}\(securityClass)"
                let shares = finiteNumber(row.shares)
                if balances[key] == nil { balanceOrder.append(key) }
                balances[key] = Balance(
                    key: key,
                    holderType: pwaStringOr(row.holderType, fallback: "other"),
                    holderName: row.holderName,
                    securityClass: securityClass,
                    outstandingShares: shares,
                    dilutedShares: shares,
                    paidInYen: finiteNumber(row.investedYen)
                )
            }
            let rows = rowsFromBalances(balances, order: balanceOrder)
            guard !rows.isEmpty else { return [] }
            return [AMDOSParityCapTableSnapshot(
                id: "legacy-current",
                label: "現在",
                effectiveOn: current.compactMap(\.asOfYm).max() ?? "",
                transactionType: "opening_balance",
                roundId: nil,
                outstandingDelta: 0,
                dilutedDelta: 0,
                paidInYenDelta: 0,
                rows: rows,
                outstandingShares: rows.reduce(0) { $0 + $1.outstandingShares },
                dilutedShares: rows.reduce(0) { $0 + $1.dilutedShares },
                paidInYen: rows.reduce(0) { $0 + $1.paidInYen }
            )]
        }

        var balances: [String: Balance] = [:]
        var balanceOrder: [String] = []
        var snapshots: [AMDOSParityCapTableSnapshot] = []
        for transaction in transactions {
            let entries = transaction.entries ?? []
            let outstandingDelta = entries.reduce(0) { $0 + finiteNumber($1.outstandingDelta) }
            let dilutedDelta = entries.reduce(0) { $0 + finiteNumber($1.dilutedDelta) }
            let paidInYenDelta = entries.reduce(0) { $0 + finiteNumber($1.paidInYenDelta) }
            for entry in entries {
                let holderName = entry.holderName ?? ""
                let securityClass = pwaStringOr(entry.securityClass, fallback: "普通株式")
                let key = "\(holderName)\u{0000}\(securityClass)"
                if balances[key] == nil { balanceOrder.append(key) }
                let current = balances[key] ?? Balance(
                    key: key,
                    holderType: pwaStringOr(entry.holderType, fallback: "other"),
                    holderName: holderName,
                    securityClass: securityClass,
                    outstandingShares: 0,
                    dilutedShares: 0,
                    paidInYen: 0
                )
                balances[key] = Balance(
                    key: current.key,
                    holderType: pwaStringOr(entry.holderType, fallback: current.holderType),
                    holderName: current.holderName,
                    securityClass: current.securityClass,
                    outstandingShares: current.outstandingShares + finiteNumber(entry.outstandingDelta),
                    dilutedShares: current.dilutedShares + finiteNumber(entry.dilutedDelta),
                    paidInYen: current.paidInYen + finiteNumber(entry.paidInYenDelta)
                )
            }
            let rows = rowsFromBalances(balances, order: balanceOrder)
            snapshots.append(AMDOSParityCapTableSnapshot(
                id: transaction.id,
                label: transactionLabel(transaction),
                effectiveOn: transaction.effectiveOn,
                transactionType: transaction.transactionType,
                roundId: transaction.roundId,
                outstandingDelta: outstandingDelta,
                dilutedDelta: dilutedDelta,
                paidInYenDelta: paidInYenDelta,
                rows: rows,
                outstandingShares: rows.reduce(0) { $0 + $1.outstandingShares },
                dilutedShares: rows.reduce(0) { $0 + $1.dilutedShares },
                paidInYen: rows.reduce(0) { $0 + $1.paidInYen }
            ))
        }
        return snapshots
    }

    static func latestCapTable(_ data: AMDOSParityCockpitCompanyEnvelope) -> AMDOSParityCapTableSnapshot? {
        buildCapTableSnapshots(data).last
    }

    static func groupSnapshotByHolderType(
        _ snapshot: AMDOSParityCapTableSnapshot,
        diluted: Bool = false
    ) -> [AMDOSParityCapTableHolderGroup] {
        let total = diluted ? snapshot.dilutedShares : snapshot.outstandingShares
        var sharesByHolderType: [String: Double] = [:]
        var holderTypeOrder: [String] = []
        for row in snapshot.rows {
            if sharesByHolderType[row.holderType] == nil { holderTypeOrder.append(row.holderType) }
            let shares = diluted ? row.dilutedShares : row.outstandingShares
            sharesByHolderType[row.holderType, default: 0] += shares
        }
        // ECMAScript's Array#sort is stable. Preserve the first row's order
        // for equal share totals instead of adding a security-class tiebreak.
        var orderedGroups: [(index: Int, group: AMDOSParityCapTableHolderGroup)] = []
        for (index, holderType) in holderTypeOrder.enumerated() {
            guard let shares = sharesByHolderType[holderType] else { continue }
            orderedGroups.append((index, AMDOSParityCapTableHolderGroup(
                holderType: holderType,
                label: holderLabel(holderType),
                shares: shares,
                pct: total > 0 ? (shares / total) * 100 : 0,
                colorHex: holderColors[holderType] ?? holderColors["other"]!
            )))
        }
        return orderedGroups
        .filter { $0.group.shares > 0 }
        .sorted {
            if $0.group.shares != $1.group.shares { return $0.group.shares > $1.group.shares }
            return $0.index < $1.index
        }
        .map(\.group)
    }

    static func convertibleScenario(_ data: AMDOSParityCockpitCompanyEnvelope) -> AMDOSParityConvertibleScenario {
        let instruments = data.convertibles.filter { $0.status == "outstanding" && finiteNumber($0.estimatedConversionShares) > 0 }
        let estimatedShares = instruments.reduce(0) { $0 + finiteNumber($1.estimatedConversionShares) }
        return AMDOSParityConvertibleScenario(
            instruments: instruments,
            estimatedShares: estimatedShares,
            proFormaDilutedShares: (latestCapTable(data)?.dilutedShares ?? 0) + estimatedShares
        )
    }

    static func capTableTieOut(_ data: AMDOSParityCockpitCompanyEnvelope) -> AMDOSParityCapTableTieOut {
        let ledgerShares = latestCapTable(data)?.outstandingShares ?? 0
        let registeredShares = finiteNumber(data.profile?.registeredIssuedShares)
        guard registeredShares != 0 else {
            return AMDOSParityCapTableTieOut(state: .unknown, ledgerShares: ledgerShares, registeredShares: registeredShares, difference: 0)
        }
        let difference = roundShare(ledgerShares - registeredShares)
        return AMDOSParityCapTableTieOut(
            state: abs(difference) < 0.000001 ? .matched : .mismatch,
            ledgerShares: ledgerShares,
            registeredShares: registeredShares,
            difference: difference
        )
    }

    static func originWarning(_ data: AMDOSParityCockpitCompanyEnvelope, snapshots: [AMDOSParityCapTableSnapshot]) -> Bool {
        guard !snapshots.isEmpty else { return false }
        let firstConfirmed = data.transactions
            .filter { $0.status == "confirmed" }
            .sorted {
                if $0.effectiveOn != $1.effectiveOn { return $0.effectiveOn < $1.effectiveOn }
                return $0.id < $1.id
            }
            .first
        return firstConfirmed?.transactionType != "incorporation"
    }

    private static func rowsFromBalances(_ balances: [String: Balance], order: [String]) -> [AMDOSParityCapTableRow] {
        let visible = order.compactMap { balances[$0] }.filter {
            abs($0.outstandingShares) > 0.000001 || abs($0.dilutedShares) > 0.000001
        }
        let outstandingTotal = visible.reduce(0) { $0 + $1.outstandingShares }
        let dilutedTotal = visible.reduce(0) { $0 + $1.dilutedShares }
        return visible.enumerated()
            .map { index, row in
                (index, AMDOSParityCapTableRow(
                    key: row.key,
                    holderType: row.holderType,
                    holderName: row.holderName,
                    securityClass: row.securityClass,
                    outstandingShares: roundShare(row.outstandingShares),
                    dilutedShares: roundShare(row.dilutedShares),
                    paidInYen: row.paidInYen,
                    ownershipPct: outstandingTotal > 0 ? (row.outstandingShares / outstandingTotal) * 100 : 0,
                    dilutedPct: dilutedTotal > 0 ? (row.dilutedShares / dilutedTotal) * 100 : 0
                ))
            }
            .sorted {
                if $0.1.dilutedShares != $1.1.dilutedShares { return $0.1.dilutedShares > $1.1.dilutedShares }
                let holderOrder = $0.1.holderName.compare($1.1.holderName, locale: Locale(identifier: "ja"))
                if holderOrder != .orderedSame { return holderOrder == .orderedAscending }
                // Preserve JavaScript's stable-sort behavior for otherwise
                // identical keys. This is not a security-class fallback.
                return $0.0 < $1.0
            }
            .map { $0.1 }
    }

    private static func pwaStringOr(_ value: String?, fallback: String) -> String {
        guard let value, !value.isEmpty else { return fallback }
        return value
    }

    private static func finiteNumber(_ value: Double?) -> Double {
        guard let value, value.isFinite else { return 0 }
        return value
    }

    private static func roundShare(_ value: Double) -> Double {
        floor(((value + Double.ulpOfOne) * 1_000_000) + 0.5) / 1_000_000
    }
}

private enum AMDOSParityGovernanceValue: Encodable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case null
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

private struct AMDOSParityGovernancePost: Encodable, Sendable {
    let entity: String
    let row: [String: AMDOSParityGovernanceValue]
}

private struct AMDOSParityEquityEntryInput: Encodable, Equatable, Sendable {
    let holderType: String
    let holderName: String
    let securityClass: String
    let outstandingDelta: Double
    let dilutedDelta: Double
    let paidInYenDelta: Double

    enum CodingKeys: String, CodingKey {
        case holderType = "holder_type"
        case holderName = "holder_name"
        case securityClass = "security_class"
        case outstandingDelta = "outstanding_delta"
        case dilutedDelta = "diluted_delta"
        case paidInYenDelta = "paid_in_yen_delta"
    }
}

private struct AMDOSParityEquityTransactionRow: Encodable, Equatable, Sendable {
    let projectId: String
    let roundId: String?
    let effectiveOn: String
    let transactionType: String
    let description: String?
    let status: String
    let sourceRef: String?
    let notes: String?
    let entries: [AMDOSParityEquityEntryInput]

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case roundId = "round_id"
        case effectiveOn = "effective_on"
        case transactionType = "transaction_type"
        case description
        case status
        case sourceRef = "source_ref"
        case notes
        case entries
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(projectId, forKey: .projectId)
        try container.encode(roundId, forKey: .roundId)
        try container.encode(effectiveOn, forKey: .effectiveOn)
        try container.encode(transactionType, forKey: .transactionType)
        try container.encode(description, forKey: .description)
        try container.encode(status, forKey: .status)
        try container.encode(sourceRef, forKey: .sourceRef)
        try container.encode(notes, forKey: .notes)
        try container.encode(entries, forKey: .entries)
    }
}

private struct AMDOSParityEquityTransactionPost: Encodable, Equatable, Sendable {
    let entity = "equity_transaction"
    let row: AMDOSParityEquityTransactionRow
}

private struct AMDOSParityEquityEditor: Equatable {
    var transactionType = "new_issue"
    var status = "confirmed"
    var effectiveOn = AMDOSParityEquityEditor.today()
    var holderType = "founder"
    var roundId = "none"
    var fromHolder = ""
    var toHolder = ""
    var securityClass = "普通株式"
    var shares = ""
    var paidInYen = ""
    var description = ""
    var sourceRef = ""
    var notes = ""

    func request(projectId: String) throws -> AMDOSParityEquityTransactionPost {
        guard !effectiveOn.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AMDOSParityEquityValidationError.message("効力日を入力してね")
        }
        guard let shareCount = number(shares), shareCount > 0 else {
            throw AMDOSParityEquityValidationError.message("株式数は0より大きい数で入力してね")
        }
        let destination = toHolder.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = fromHolder.trimmingCharacters(in: .whitespacesAndNewlines)
        if transactionType == "transfer", source.isEmpty || destination.isEmpty {
            throw AMDOSParityEquityValidationError.message("譲渡元と譲渡先を入力してね")
        }
        if transactionType != "transfer", destination.isEmpty {
            throw AMDOSParityEquityValidationError.message("株主・付与先を入力してね")
        }

        let paidIn = number(paidInYen) ?? 0
        let klass = securityClass.trimmingCharacters(in: .whitespacesAndNewlines)
        func entry(_ holder: String, _ outstanding: Double, _ diluted: Double, _ paid: Double = 0, _ security: String? = nil) -> AMDOSParityEquityEntryInput {
            AMDOSParityEquityEntryInput(
                holderType: holderType,
                holderName: holder,
                securityClass: security ?? klass,
                outstandingDelta: outstanding,
                dilutedDelta: diluted,
                paidInYenDelta: paid
            )
        }

        let entries: [AMDOSParityEquityEntryInput]
        switch transactionType {
        case "transfer":
            entries = [entry(source, -shareCount, -shareCount), entry(destination, shareCount, shareCount)]
        case "stock_option_grant":
            entries = [entry(destination, 0, shareCount, 0, klass.isEmpty ? "新株予約権" : klass)]
        case "stock_option_exercise":
            entries = [
                entry(destination, 0, -shareCount, 0, klass.isEmpty ? "新株予約権" : klass),
                entry(destination, shareCount, shareCount, paidIn, "普通株式"),
            ]
        case "cancellation":
            entries = [entry(destination, -shareCount, -shareCount)]
        default:
            entries = [entry(destination, shareCount, shareCount, paidIn)]
        }

        let row = AMDOSParityEquityTransactionRow(
            projectId: projectId,
            roundId: roundId == "none" ? nil : roundId,
            effectiveOn: effectiveOn.trimmingCharacters(in: .whitespacesAndNewlines),
            transactionType: transactionType,
            description: description.trimmedNonEmpty,
            status: status,
            sourceRef: sourceRef.trimmedNonEmpty,
            notes: notes.trimmedNonEmpty,
            entries: entries
        )
        return AMDOSParityEquityTransactionPost(row: row)
    }

    private func number(_ value: String) -> Double? {
        let clean = value.replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, let parsed = Double(clean), parsed.isFinite else { return nil }
        return parsed
    }

    private static func today() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: .now)
    }
}

private enum AMDOSParityEquityValidationError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let message): message }
    }
}

private struct AMDOSParityEquityOption: Identifiable {
    let id: String
    let label: String
}

private struct AMDOSParityEquityEditorSheet: View {
    let projectId: String
    let rounds: [AMDOSParityCockpitValuationRound]
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var editor = AMDOSParityEquityEditor()
    @State private var saving = false
    @State private var errorMessage: String?

    private let transactionTypes = [
        AMDOSParityEquityOption(id: "incorporation", label: "設立"),
        AMDOSParityEquityOption(id: "opening_balance", label: "開始残高"),
        AMDOSParityEquityOption(id: "new_issue", label: "新株発行"),
        AMDOSParityEquityOption(id: "transfer", label: "株式譲渡"),
        AMDOSParityEquityOption(id: "stock_option_grant", label: "SO付与"),
        AMDOSParityEquityOption(id: "stock_option_exercise", label: "SO行使"),
        AMDOSParityEquityOption(id: "in_kind_contribution", label: "現物出資"),
        AMDOSParityEquityOption(id: "cancellation", label: "消却・失効"),
        AMDOSParityEquityOption(id: "correction", label: "訂正"),
    ]
    private let holderTypes = [
        AMDOSParityEquityOption(id: "founder", label: "創業者"),
        AMDOSParityEquityOption(id: "amd", label: "AMD"),
        AMDOSParityEquityOption(id: "masa", label: "まさ"),
        AMDOSParityEquityOption(id: "employee", label: "役職員・SO"),
        AMDOSParityEquityOption(id: "vc", label: "VC"),
        AMDOSParityEquityOption(id: "angel", label: "エンジェル"),
        AMDOSParityEquityOption(id: "corporate", label: "事業会社"),
        AMDOSParityEquityOption(id: "other", label: "その他"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text("株式イベントを追加").font(.title2.bold())
                Text("確定イベントだけが現在のcap tableに反映されるよ。譲渡は譲渡元と譲渡先を同時に記録する。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        picker("イベント", selection: $editor.transactionType, options: transactionTypes)
                        picker("状態", selection: $editor.status, options: [
                            AMDOSParityEquityOption(id: "planned", label: "計画"),
                            AMDOSParityEquityOption(id: "confirmed", label: "確定"),
                        ])
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "効力日（YYYY-MM-DD）", text: $editor.effectiveOn)
                        picker("株主区分", selection: $editor.holderType, options: holderTypes)
                    }
                    picker("関連ラウンド（任意）", selection: $editor.roundId, options: [AMDOSParityEquityOption(id: "none", label: "なし")] + rounds.map {
                        AMDOSParityEquityOption(id: $0.id, label: $0.roundName ?? $0.roundDate ?? $0.roundYm ?? "名称未入力")
                    })
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "譲渡元（譲渡のとき）", text: $editor.fromHolder)
                        AMDOSTextField(title: "株主・譲渡先・付与先", text: $editor.toHolder)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "証券種別", text: $editor.securityClass)
                        AMDOSTextField(title: "株式数 / 個数", text: $editor.shares)
                    }
                    AMDOSTextField(title: "払込総額（円）— 譲渡なら会社への払込ではないので0", text: $editor.paidInYen)
                    AMDOSTextField(title: "説明", text: $editor.description)
                    AMDOSTextField(title: "確認元", text: $editor.sourceRef)
                    AMDOSTextField(title: "メモ", text: $editor.notes, axis: .vertical)
                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                    }
                }
            }
            HStack {
                Spacer()
                Button("閉じる") { dismiss() }.disabled(saving)
                Button {
                    save()
                } label: {
                    if saving { ProgressView().controlSize(.small) }
                    Text(saving ? "追加中…" : "追加")
                }
                .buttonStyle(.borderedProminent)
                .disabled(saving)
            }
        }
        .padding(24)
        .frame(minWidth: 660, minHeight: 720)
    }

    private func picker(_ title: String, selection: Binding<String>, options: [AMDOSParityEquityOption]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker(title, selection: selection) {
                ForEach(options) { option in Text(option.label).tag(option.id) }
            }
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func save() {
        let request: AMDOSParityEquityTransactionPost
        do {
            request = try editor.request(projectId: projectId)
        } catch {
            errorMessage = error.localizedDescription
            return
        }
        saving = true
        errorMessage = nil
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance", body: request)
                onSaved()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                saving = false
            }
        }
    }
}

private struct AMDOSParityCompanyEditor: Equatable {
    var legalStatus = "pre_incorporation"
    var legalName = ""
    var legalNameEn = ""
    var corporateNumber = ""
    var entityType = "株式会社"
    var incorporatedOn = ""
    var headOffice = ""
    var businessPurpose = ""
    var representativeName = ""
    var capitalYen = ""
    var authorizedShares = ""
    var registeredIssuedShares = ""
    var boardStructure = ""
    var hasBoard = false
    var hasAuditor = false
    var fiscalYearEndMonth = ""
    var publicNoticeMethod = ""
    var invoiceRegistrationNumber = ""
    var sourceRef = ""
    var sourceVerifiedOn = ""
    var notes = ""

    init() {}

    init(profile: AMDOSParityCockpitCompanyProfile?) {
        legalStatus = profile?.legalStatus ?? "pre_incorporation"
        legalName = profile?.legalName ?? ""
        legalNameEn = profile?.legalNameEn ?? ""
        corporateNumber = profile?.corporateNumber ?? ""
        entityType = profile?.entityType ?? "株式会社"
        incorporatedOn = profile?.incorporatedOn ?? ""
        headOffice = profile?.headOffice ?? ""
        businessPurpose = profile?.businessPurpose ?? ""
        representativeName = profile?.representativeName ?? ""
        capitalYen = profile?.capitalYen.map(AMDOSParityCompanyEditor.numberText) ?? ""
        authorizedShares = profile?.authorizedShares.map(AMDOSParityCompanyEditor.numberText) ?? ""
        registeredIssuedShares = profile?.registeredIssuedShares.map(AMDOSParityCompanyEditor.numberText) ?? ""
        boardStructure = profile?.boardStructure ?? ""
        hasBoard = profile?.hasBoard ?? false
        hasAuditor = profile?.hasAuditor ?? false
        fiscalYearEndMonth = profile?.fiscalYearEndMonth.map(String.init) ?? ""
        publicNoticeMethod = profile?.publicNoticeMethod ?? ""
        invoiceRegistrationNumber = profile?.invoiceRegistrationNumber ?? ""
        sourceRef = profile?.sourceRef ?? ""
        sourceVerifiedOn = profile?.sourceVerifiedOn ?? ""
        notes = profile?.notes ?? ""
    }

    func request(projectId: String) -> AMDOSParityGovernancePost {
        let row: [String: AMDOSParityGovernanceValue] = [
            "project_id": .string(projectId),
            "legal_status": .string(legalStatus),
            "legal_name": textValue(legalName),
            "legal_name_en": textValue(legalNameEn),
            "corporate_number": textValue(corporateNumber),
            "entity_type": textValue(entityType),
            "incorporated_on": textValue(incorporatedOn),
            "head_office": textValue(headOffice),
            "business_purpose": textValue(businessPurpose),
            "representative_name": textValue(representativeName),
            "capital_yen": numberValue(capitalYen),
            "authorized_shares": numberValue(authorizedShares),
            "registered_issued_shares": numberValue(registeredIssuedShares),
            "board_structure": textValue(boardStructure),
            "has_board": .bool(hasBoard),
            "has_auditor": .bool(hasAuditor),
            "fiscal_year_end_month": numberValue(fiscalYearEndMonth),
            "public_notice_method": textValue(publicNoticeMethod),
            "invoice_registration_number": textValue(invoiceRegistrationNumber),
            "source_ref": textValue(sourceRef),
            "source_verified_on": textValue(sourceVerifiedOn),
            "notes": textValue(notes),
        ]
        return AMDOSParityGovernancePost(entity: "company_profile", row: row)
    }

    private func textValue(_ value: String) -> AMDOSParityGovernanceValue {
        value.trimmedNonEmpty.map(AMDOSParityGovernanceValue.string) ?? .null
    }

    private func numberValue(_ value: String) -> AMDOSParityGovernanceValue {
        let clean = value.replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, let parsed = Double(clean), parsed.isFinite else { return .null }
        return .number(parsed)
    }

    private static func numberText(_ value: Double) -> String {
        value.rounded(.towardZero) == value ? String(format: "%.0f", value) : String(value)
    }
}

private struct AMDOSParityCompanyEditorSheet: View {
    let projectId: String
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var editor: AMDOSParityCompanyEditor
    @State private var saving = false
    @State private var errorMessage: String?

    init(projectId: String, profile: AMDOSParityCockpitCompanyProfile?, onSaved: @escaping () -> Void) {
        self.projectId = projectId
        self.onSaved = onSaved
        _editor = State(initialValue: AMDOSParityCompanyEditor(profile: profile))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text("会社基本情報を編集").font(.title2.bold())
                Text("登記・定款など、確認した資料を確認元に残してね。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        profilePicker("法人状態", selection: $editor.legalStatus, options: [
                            AMDOSParityEquityOption(id: "pre_incorporation", label: "設立前"),
                            AMDOSParityEquityOption(id: "incorporated", label: "設立済み"),
                            AMDOSParityEquityOption(id: "liquidating", label: "清算中"),
                            AMDOSParityEquityOption(id: "closed", label: "清算済み"),
                        ])
                        AMDOSTextField(title: "法人形態", text: $editor.entityType)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "商号", text: $editor.legalName)
                        AMDOSTextField(title: "英文商号", text: $editor.legalNameEn)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "法人番号", text: $editor.corporateNumber)
                        AMDOSTextField(title: "設立日（YYYY-MM-DD）", text: $editor.incorporatedOn)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "代表者", text: $editor.representativeName)
                        AMDOSTextField(title: "決算月", text: $editor.fiscalYearEndMonth)
                    }
                    AMDOSTextField(title: "本店所在地", text: $editor.headOffice)
                    AMDOSTextField(title: "事業内容・定款目的", text: $editor.businessPurpose, axis: .vertical)
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "資本金（円）", text: $editor.capitalYen)
                        AMDOSTextField(title: "発行可能株式総数", text: $editor.authorizedShares)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "登記上の発行済株式数", text: $editor.registeredIssuedShares)
                        AMDOSTextField(title: "機関設計", text: $editor.boardStructure)
                    }
                    HStack(spacing: 24) {
                        Toggle("取締役会設置", isOn: $editor.hasBoard)
                        Toggle("監査役設置", isOn: $editor.hasAuditor)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "公告方法", text: $editor.publicNoticeMethod)
                        AMDOSTextField(title: "適格請求書発行事業者番号", text: $editor.invoiceRegistrationNumber)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "確認元", text: $editor.sourceRef)
                        AMDOSTextField(title: "確認日（YYYY-MM-DD）", text: $editor.sourceVerifiedOn)
                    }
                    AMDOSTextField(title: "メモ", text: $editor.notes, axis: .vertical)
                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                    }
                }
            }
            HStack {
                Spacer()
                Button("閉じる") { dismiss() }.disabled(saving)
                Button {
                    save()
                } label: {
                    if saving { ProgressView().controlSize(.small) }
                    Text(saving ? "保存中…" : "保存")
                }
                .buttonStyle(.borderedProminent)
                .disabled(saving)
            }
        }
        .padding(24)
        .frame(minWidth: 720, minHeight: 780)
    }

    private func profilePicker(_ title: String, selection: Binding<String>, options: [AMDOSParityEquityOption]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker(title, selection: selection) {
                ForEach(options) { option in Text(option.label).tag(option.id) }
            }
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func save() {
        saving = true
        errorMessage = nil
        let request = editor.request(projectId: projectId)
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance", body: request)
                onSaved()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                saving = false
            }
        }
    }
}

private struct AMDOSParityRoundEditor: Equatable {
    var roundName = ""
    var roundDate = ""
    var preMoneyYen = ""
    var postMoneyYen = ""
    var raisedYen = ""
    var pricePerShareYen = ""
    var leadInvestor = ""
    var sourceRef = ""
    var notes = ""

    func request(projectId: String) throws -> AMDOSParityGovernancePost {
        guard roundName.trimmedNonEmpty != nil else {
            throw AMDOSParityRoundValidationError.message("ラウンド名を入力してね")
        }
        let row: [String: AMDOSParityGovernanceValue] = [
            "project_id": .string(projectId),
            "round_name": textValue(roundName),
            "round_date": textValue(roundDate),
            "pre_money_yen": numberValue(preMoneyYen),
            "post_money_yen": numberValue(postMoneyYen),
            "raised_yen": numberValue(raisedYen),
            "price_per_share_yen": numberValue(pricePerShareYen),
            "lead_investor": textValue(leadInvestor),
            "source_ref": textValue(sourceRef),
            "notes": textValue(notes),
        ]
        return AMDOSParityGovernancePost(entity: "round", row: row)
    }

    private func textValue(_ value: String) -> AMDOSParityGovernanceValue {
        value.trimmedNonEmpty.map(AMDOSParityGovernanceValue.string) ?? .null
    }

    private func numberValue(_ value: String) -> AMDOSParityGovernanceValue {
        let clean = value.replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, let parsed = Double(clean), parsed.isFinite else { return .null }
        return .number(parsed)
    }
}

private enum AMDOSParityRoundValidationError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let message): message }
    }
}

private struct AMDOSParityRoundEditorSheet: View {
    let projectId: String
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var editor = AMDOSParityRoundEditor()
    @State private var saving = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text("調達ラウンドを追加").font(.title2.bold())
                Text("株式イベントとラウンド情報を分けることで、持株計算とバリュエーションを混同しない。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top) {
                    AMDOSTextField(title: "ラウンド名", text: $editor.roundName)
                    AMDOSTextField(title: "実施日", text: $editor.roundDate)
                }
                HStack(alignment: .top) {
                    AMDOSTextField(title: "pre-money（円）", text: $editor.preMoneyYen)
                    AMDOSTextField(title: "post-money（円）", text: $editor.postMoneyYen)
                }
                HStack(alignment: .top) {
                    AMDOSTextField(title: "調達額（円）", text: $editor.raisedYen)
                    AMDOSTextField(title: "1株単価（円）", text: $editor.pricePerShareYen)
                }
                HStack(alignment: .top) {
                    AMDOSTextField(title: "リード投資家", text: $editor.leadInvestor)
                    AMDOSTextField(title: "確認元", text: $editor.sourceRef)
                }
                AMDOSTextField(title: "メモ", text: $editor.notes, axis: .vertical)
                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                }
            }
            Spacer(minLength: 0)
            HStack {
                Spacer()
                Button("閉じる") { dismiss() }.disabled(saving)
                Button {
                    save()
                } label: {
                    if saving { ProgressView().controlSize(.small) }
                    Text(saving ? "追加中…" : "追加")
                }
                .buttonStyle(.borderedProminent)
                .disabled(saving)
            }
        }
        .padding(24)
        .frame(minWidth: 660, minHeight: 520)
    }

    private func save() {
        let request: AMDOSParityGovernancePost
        do {
            request = try editor.request(projectId: projectId)
        } catch {
            errorMessage = error.localizedDescription
            return
        }
        saving = true
        errorMessage = nil
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance", body: request)
                onSaved()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                saving = false
            }
        }
    }
}

private struct AMDOSParityConvertibleEditor: Equatable {
    var holderName = ""
    var instrumentType = "J-KISS"
    var issuedOn = ""
    var status = "outstanding"
    var principalYen = ""
    var valuationCapYen = ""
    var discountRatePct = ""
    var maturityOn = ""
    var estimatedConversionPrice = ""
    var estimatedConversionShares = ""
    var conversionTrigger = ""
    var sourceRef = ""
    var notes = ""

    func request(projectId: String) throws -> AMDOSParityGovernancePost {
        guard holderName.trimmedNonEmpty != nil else {
            throw AMDOSParityConvertibleValidationError.message("保有者を入力してね")
        }
        let discount = number(discountRatePct)
        let row: [String: AMDOSParityGovernanceValue] = [
            "project_id": .string(projectId),
            "holder_name": textValue(holderName),
            "instrument_type": .string(instrumentType),
            "issued_on": textValue(issuedOn),
            "principal_yen": numberValue(principalYen),
            "valuation_cap_yen": numberValue(valuationCapYen),
            "discount_rate": discount.map { .number($0 / 100) } ?? .null,
            "conversion_trigger": textValue(conversionTrigger),
            "maturity_on": textValue(maturityOn),
            "estimated_conversion_price": numberValue(estimatedConversionPrice),
            "estimated_conversion_shares": numberValue(estimatedConversionShares),
            "status": .string(status),
            "source_ref": textValue(sourceRef),
            "notes": textValue(notes),
        ]
        return AMDOSParityGovernancePost(entity: "convertible", row: row)
    }

    private func textValue(_ value: String) -> AMDOSParityGovernanceValue {
        value.trimmedNonEmpty.map(AMDOSParityGovernanceValue.string) ?? .null
    }

    private func numberValue(_ value: String) -> AMDOSParityGovernanceValue {
        number(value).map(AMDOSParityGovernanceValue.number) ?? .null
    }

    private func number(_ value: String) -> Double? {
        let clean = value.replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, let parsed = Double(clean), parsed.isFinite else { return nil }
        return parsed
    }
}

private enum AMDOSParityConvertibleValidationError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let message): message }
    }
}

private struct AMDOSParityConvertibleEditorSheet: View {
    let projectId: String
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var editor = AMDOSParityConvertibleEditor()
    @State private var saving = false
    @State private var errorMessage: String?

    private let instrumentTypes = [
        AMDOSParityEquityOption(id: "J-KISS", label: "J-KISS"),
        AMDOSParityEquityOption(id: "SAFE", label: "SAFE"),
        AMDOSParityEquityOption(id: "CB", label: "転換社債"),
        AMDOSParityEquityOption(id: "other", label: "その他"),
    ]
    private let statuses = [
        AMDOSParityEquityOption(id: "outstanding", label: "転換前"),
        AMDOSParityEquityOption(id: "converted", label: "転換済み"),
        AMDOSParityEquityOption(id: "repaid", label: "償還済み"),
        AMDOSParityEquityOption(id: "cancelled", label: "取消"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text("転換前証券を追加").font(.title2.bold())
                Text("現在の持株比率には入れず、転換見込シナリオとして別表示するよ。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "保有者", text: $editor.holderName)
                        convertiblePicker("証券", selection: $editor.instrumentType, options: instrumentTypes)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "発行日", text: $editor.issuedOn)
                        convertiblePicker("状態", selection: $editor.status, options: statuses)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "元本（円）", text: $editor.principalYen)
                        AMDOSTextField(title: "評価上限（円）", text: $editor.valuationCapYen)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "割引率（%）", text: $editor.discountRatePct)
                        AMDOSTextField(title: "満期日", text: $editor.maturityOn)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "転換見込単価（円）", text: $editor.estimatedConversionPrice)
                        AMDOSTextField(title: "転換見込株式数", text: $editor.estimatedConversionShares)
                    }
                    AMDOSTextField(title: "転換条件", text: $editor.conversionTrigger, axis: .vertical)
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "確認元", text: $editor.sourceRef)
                        AMDOSTextField(title: "メモ", text: $editor.notes)
                    }
                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                    }
                }
            }
            HStack {
                Spacer()
                Button("閉じる") { dismiss() }.disabled(saving)
                Button {
                    save()
                } label: {
                    if saving { ProgressView().controlSize(.small) }
                    Text(saving ? "追加中…" : "追加")
                }
                .buttonStyle(.borderedProminent)
                .disabled(saving)
            }
        }
        .padding(24)
        .frame(minWidth: 660, minHeight: 650)
    }

    private func convertiblePicker(_ title: String, selection: Binding<String>, options: [AMDOSParityEquityOption]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker(title, selection: selection) {
                ForEach(options) { option in Text(option.label).tag(option.id) }
            }
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func save() {
        let request: AMDOSParityGovernancePost
        do {
            request = try editor.request(projectId: projectId)
        } catch {
            errorMessage = error.localizedDescription
            return
        }
        saving = true
        errorMessage = nil
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance", body: request)
                onSaved()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                saving = false
            }
        }
    }
}

private struct AMDOSParityFinancialEditor: Equatable {
    var fiscalYear = String(Calendar(identifier: .gregorian).component(.year, from: .now))
    var statementStatus = "draft"
    var filedOn = ""
    var periodStartOn = ""
    var periodEndOn = ""
    var sourceRef = ""
    var revenueYen = ""
    var operatingIncomeYen = ""
    var ordinaryIncomeYen = ""
    var netIncomeYen = ""
    var totalAssetsYen = ""
    var totalLiabilitiesYen = ""
    var netAssetsYen = ""
    var cashYen = ""
    var debtYen = ""
    var notes = ""

    func request(projectId: String) throws -> (year: Int, post: AMDOSParityGovernancePost) {
        guard let yearNumber = number(fiscalYear), let year = Int(exactly: yearNumber) else {
            throw AMDOSParityFinancialValidationError.message("年度を入力してね")
        }
        let row: [String: AMDOSParityGovernanceValue] = [
            "project_id": .string(projectId),
            "fiscal_year": .number(yearNumber),
            "period_start_on": textValue(periodStartOn),
            "period_end_on": textValue(periodEndOn),
            "statement_status": .string(statementStatus),
            "revenue_yen": numberValue(revenueYen),
            "operating_income_yen": numberValue(operatingIncomeYen),
            "ordinary_income_yen": numberValue(ordinaryIncomeYen),
            "net_income_yen": numberValue(netIncomeYen),
            "total_assets_yen": numberValue(totalAssetsYen),
            "total_liabilities_yen": numberValue(totalLiabilitiesYen),
            "net_assets_yen": numberValue(netAssetsYen),
            "cash_yen": numberValue(cashYen),
            "debt_yen": numberValue(debtYen),
            "filed_on": textValue(filedOn),
            "source_ref": textValue(sourceRef),
            "notes": textValue(notes),
        ]
        return (year, AMDOSParityGovernancePost(entity: "financial_period", row: row))
    }

    private func textValue(_ value: String) -> AMDOSParityGovernanceValue {
        value.trimmedNonEmpty.map(AMDOSParityGovernanceValue.string) ?? .null
    }

    private func numberValue(_ value: String) -> AMDOSParityGovernanceValue {
        number(value).map(AMDOSParityGovernanceValue.number) ?? .null
    }

    private func number(_ value: String) -> Double? {
        let clean = value.replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, let parsed = Double(clean), parsed.isFinite else { return nil }
        return parsed
    }
}

private enum AMDOSParityFinancialValidationError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let message): message }
    }
}

private struct AMDOSParityFinancialEditorSheet: View {
    let projectId: String
    let onSaved: (AMDOSParityCockpitCompanyEnvelope) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var editor = AMDOSParityFinancialEditor()
    @State private var saving = false
    @State private var errorMessage: String?

    private let statuses = [
        AMDOSParityEquityOption(id: "draft", label: "下書き"),
        AMDOSParityEquityOption(id: "final", label: "確定"),
        AMDOSParityEquityOption(id: "filed", label: "申告済み"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text("年度決算を追加・更新").font(.title2.bold())
                Text("同じ年度を保存すると、その年度の数値を更新するよ。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "年度", text: $editor.fiscalYear)
                        financialPicker("状態", selection: $editor.statementStatus, options: statuses)
                        AMDOSTextField(title: "申告日", text: $editor.filedOn)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "期間開始", text: $editor.periodStartOn)
                        AMDOSTextField(title: "期間終了", text: $editor.periodEndOn)
                        AMDOSTextField(title: "確認元", text: $editor.sourceRef)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "売上高（円）", text: $editor.revenueYen)
                        AMDOSTextField(title: "営業利益（円）", text: $editor.operatingIncomeYen)
                        AMDOSTextField(title: "経常利益（円）", text: $editor.ordinaryIncomeYen)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "当期純利益（円）", text: $editor.netIncomeYen)
                        AMDOSTextField(title: "総資産（円）", text: $editor.totalAssetsYen)
                        AMDOSTextField(title: "負債（円）", text: $editor.totalLiabilitiesYen)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "純資産（円）", text: $editor.netAssetsYen)
                        AMDOSTextField(title: "現預金（円）", text: $editor.cashYen)
                        AMDOSTextField(title: "有利子負債（円）", text: $editor.debtYen)
                    }
                    AMDOSTextField(title: "メモ", text: $editor.notes, axis: .vertical)
                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                    }
                }
            }
            HStack {
                Spacer()
                Button("閉じる") { dismiss() }.disabled(saving)
                Button {
                    save()
                } label: {
                    if saving { ProgressView().controlSize(.small) }
                    Text(saving ? "保存中…" : "保存")
                }
                .buttonStyle(.borderedProminent)
                .disabled(saving)
            }
        }
        .padding(24)
        .frame(minWidth: 820, minHeight: 650)
    }

    private func financialPicker(_ title: String, selection: Binding<String>, options: [AMDOSParityEquityOption]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker(title, selection: selection) {
                ForEach(options) { option in Text(option.label).tag(option.id) }
            }
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func save() {
        let request: (year: Int, post: AMDOSParityGovernancePost)
        do {
            request = try editor.request(projectId: projectId)
        } catch {
            errorMessage = error.localizedDescription
            return
        }
        saving = true
        errorMessage = nil
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance", body: request.post)
                let reloaded = try await AMDOSRESTClient.shared.fetchPWA(
                    AMDOSParityCockpitCompanyEnvelope.self,
                    path: "/api/governance",
                    query: ["projectId": projectId]
                )
                guard reloaded.financialPeriods.contains(where: { $0.fiscalYear == request.year }) else {
                    throw AMDOSParityFinancialValidationError.message("保存後のFY\(request.year)を再取得できなかったよ。シートを閉じずに確認してね")
                }
                onSaved(reloaded)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                saving = false
            }
        }
    }
}

private struct AMDOSParityMeetingResolutionInput: Encodable, Equatable, Sendable {
    let title: String
    let result = "unknown"
}

private struct AMDOSParityMeetingAttachmentInput: Encodable, Equatable, Sendable {
    let name: String
    let url: String
}

private struct AMDOSParityMeetingRow: Encodable, Equatable, Sendable {
    let projectId: String
    let meetingType: String
    let meetingDate: String?
    let location: String?
    let agendaSummary: String?
    let resolutionsJSON: [AMDOSParityMeetingResolutionInput]
    let amdResponse: String
    let attachmentsJSON: [AMDOSParityMeetingAttachmentInput]
    let sourceRef: String?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case meetingType = "meeting_type"
        case meetingDate = "meeting_date"
        case location
        case agendaSummary = "agenda_summary"
        case resolutionsJSON = "resolutions_json"
        case amdResponse = "amd_response"
        case attachmentsJSON = "attachments_json"
        case sourceRef = "source_ref"
        case notes
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(projectId, forKey: .projectId)
        try container.encode(meetingType, forKey: .meetingType)
        try container.encode(meetingDate, forKey: .meetingDate)
        try container.encode(location, forKey: .location)
        try container.encode(agendaSummary, forKey: .agendaSummary)
        try container.encode(resolutionsJSON, forKey: .resolutionsJSON)
        try container.encode(amdResponse, forKey: .amdResponse)
        try container.encode(attachmentsJSON, forKey: .attachmentsJSON)
        try container.encode(sourceRef, forKey: .sourceRef)
        try container.encode(notes, forKey: .notes)
    }
}

private struct AMDOSParityMeetingPost: Encodable, Equatable, Sendable {
    let entity = "meeting"
    let row: AMDOSParityMeetingRow
}

private struct AMDOSParityMeetingMutationEnvelope: Decodable, Sendable {
    let ok: Bool?
    let row: AMDOSParityCockpitCompanyMeeting?
    let error: String?
}

private struct AMDOSParityMeetingEditor: Equatable {
    var meetingType = "board"
    var meetingDate = ""
    var location = ""
    var amdResponse = "none"
    var agendaSummary = ""
    var resolutions = ""
    var attachmentName = ""
    var attachmentURL = ""
    var sourceRef = ""
    var notes = ""

    func request(projectId: String) throws -> AMDOSParityMeetingPost {
        guard meetingDate.trimmedNonEmpty != nil else {
            throw AMDOSParityMeetingValidationError.message("開催日を入力してね")
        }
        let resolutionRows = resolutions
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map { AMDOSParityMeetingResolutionInput(title: $0) }
        let attachmentRows: [AMDOSParityMeetingAttachmentInput]
        if let url = attachmentURL.trimmedNonEmpty {
            attachmentRows = [AMDOSParityMeetingAttachmentInput(name: attachmentName.trimmedNonEmpty ?? "関連資料", url: url)]
        } else {
            attachmentRows = []
        }
        let row = AMDOSParityMeetingRow(
            projectId: projectId,
            meetingType: meetingType,
            meetingDate: meetingDate.trimmedNonEmpty,
            location: location.trimmedNonEmpty,
            agendaSummary: agendaSummary.trimmedNonEmpty,
            resolutionsJSON: resolutionRows,
            amdResponse: amdResponse,
            attachmentsJSON: attachmentRows,
            sourceRef: sourceRef.trimmedNonEmpty,
            notes: notes.trimmedNonEmpty
        )
        return AMDOSParityMeetingPost(row: row)
    }
}

private enum AMDOSParityMeetingValidationError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let message): message }
    }
}

private struct AMDOSParityMeetingEditorSheet: View {
    let projectId: String
    let onSaved: (AMDOSParityCockpitCompanyEnvelope) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var editor = AMDOSParityMeetingEditor()
    @State private var saving = false
    @State private var errorMessage: String?

    private let meetingTypes = [
        AMDOSParityEquityOption(id: "agm", label: "定時株主総会"),
        AMDOSParityEquityOption(id: "egm", label: "臨時株主総会"),
        AMDOSParityEquityOption(id: "board", label: "取締役会"),
        AMDOSParityEquityOption(id: "board_written", label: "取締役会（書面決議）"),
        AMDOSParityEquityOption(id: "shareholder_written", label: "株主総会（書面決議）"),
    ]
    private let amdResponses = [
        AMDOSParityEquityOption(id: "none", label: "未対応"),
        AMDOSParityEquityOption(id: "attended", label: "出席"),
        AMDOSParityEquityOption(id: "proxy", label: "委任状提出"),
        AMDOSParityEquityOption(id: "consented", label: "事前承諾"),
        AMDOSParityEquityOption(id: "abstained", label: "棄権"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text("総会・取締役会を追加").font(.title2.bold())
                Text("招集・決議・AMDの対応・資料を、同じ開催記録へまとめるよ。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        meetingPicker("種別", selection: $editor.meetingType, options: meetingTypes)
                        AMDOSTextField(title: "開催日", text: $editor.meetingDate)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "場所・方法", text: $editor.location)
                        meetingPicker("AMD対応", selection: $editor.amdResponse, options: amdResponses)
                    }
                    AMDOSTextField(title: "議題概要", text: $editor.agendaSummary, axis: .vertical)
                    AMDOSTextField(title: "決議（1行1件）", text: $editor.resolutions, axis: .vertical)
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "資料名", text: $editor.attachmentName)
                        AMDOSTextField(title: "資料URL", text: $editor.attachmentURL)
                    }
                    HStack(alignment: .top) {
                        AMDOSTextField(title: "確認元", text: $editor.sourceRef)
                        AMDOSTextField(title: "メモ", text: $editor.notes)
                    }
                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                    }
                }
            }
            HStack {
                Spacer()
                Button("閉じる") { dismiss() }.disabled(saving)
                Button {
                    save()
                } label: {
                    if saving { ProgressView().controlSize(.small) }
                    Text(saving ? "追加中…" : "追加")
                }
                .buttonStyle(.borderedProminent)
                .disabled(saving)
            }
        }
        .padding(24)
        .frame(minWidth: 680, minHeight: 680)
    }

    private func meetingPicker(_ title: String, selection: Binding<String>, options: [AMDOSParityEquityOption]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker(title, selection: selection) {
                ForEach(options) { option in Text(option.label).tag(option.id) }
            }
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func save() {
        let request: AMDOSParityMeetingPost
        do {
            request = try editor.request(projectId: projectId)
        } catch {
            errorMessage = error.localizedDescription
            return
        }
        saving = true
        errorMessage = nil
        Task {
            do {
                let responseData = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance", body: request)
                let response = try JSONDecoder().decode(AMDOSParityMeetingMutationEnvelope.self, from: responseData)
                guard response.ok == true, let savedID = response.row?.id else {
                    throw AMDOSParityMeetingValidationError.message(response.error ?? "保存結果の会議IDを確認できなかったよ")
                }
                let reloaded = try await AMDOSRESTClient.shared.fetchPWA(
                    AMDOSParityCockpitCompanyEnvelope.self,
                    path: "/api/governance",
                    query: ["projectId": projectId]
                )
                guard reloaded.meetings.contains(where: { $0.id == savedID }) else {
                    throw AMDOSParityMeetingValidationError.message("保存後の会議を再取得できなかったよ。シートを閉じずに確認してね")
                }
                onSaved(reloaded)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                saving = false
            }
        }
    }
}

struct AMDOSParityCockpitCompanyView: View {
    let projectId: String
    let projectName: String
    @State private var data: AMDOSParityCockpitCompanyEnvelope?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var messageIsError = false
    @State private var selectedSection = "profile"
    @State private var selectedSnapshotID = ""
    @State private var showingProfileEditor = false
    @State private var showingEquityEditor = false
    @State private var showingRoundEditor = false
    @State private var showingConvertibleEditor = false
    @State private var showingFinancialEditor = false
    @State private var showingMeetingEditor = false
    @State private var exportingCompanyExcel = false
    @State private var exportingCompanyPDF = false
    @EnvironmentObject private var auth: AMDOSAuthStore

    var body: some View {
        AMDOSPageScaffold(eyebrow: "COMPANY OVERVIEW", title: "\(projectName) の会社概要", subtitle: "会社情報・資本政策・機関決定・決算を、全メンバーで更新するPJ正本") {
            AMDOSStateNotice(state: state) { load() }
            if let data {
                let snapshots = AMDOSParityCompanyOverviewMath.buildCapTableSnapshots(data)
                let selectedSnapshot = snapshots.first(where: { $0.id == selectedSnapshotID }) ?? snapshots.last
                let latestSnapshot = snapshots.last
                let tieOut = AMDOSParityCompanyOverviewMath.capTableTieOut(data)
                let conversion = AMDOSParityCompanyOverviewMath.convertibleScenario(data)
                let latestRound = data.rounds.first(where: { $0.pricePerShareYen != nil || $0.postMoneyYen != nil }) ?? data.rounds.first
                let selectedEquityValue = AMDOSParityCompanyOverviewMath.selectedEquityValue(snapshot: selectedSnapshot, latestRound: latestRound)
                HStack(spacing: 8) {
                    Spacer(minLength: 0)
                    Button {
                        exportCompanyOverviewExcel()
                    } label: {
                        if exportingCompanyExcel { ProgressView().controlSize(.small) }
                        Label(exportingCompanyExcel ? "Excelを準備中…" : "会社概要Excel", systemImage: "tablecells")
                    }
                    .buttonStyle(.bordered)
                    .disabled(exportingCompanyExcel)
                    Button {
                        exportCompanyOverviewPDF(data: data, snapshots: snapshots, selectedSnapshot: selectedSnapshot)
                    } label: {
                        if exportingCompanyPDF { ProgressView().controlSize(.small) }
                        Label(exportingCompanyPDF ? "PDFを準備中…" : "PDF", systemImage: "arrow.down.doc")
                    }
                    .buttonStyle(.bordered)
                    .disabled(exportingCompanyPDF)
                    Button("更新", systemImage: "arrow.clockwise") { load() }
                        .buttonStyle(.bordered)
                        .disabled(state == .loading)
                }
                overviewSummary(data: data, latestSnapshot: latestSnapshot, tieOut: tieOut, conversion: conversion, selectedEquityValue: selectedEquityValue, latestRound: latestRound)
                Picker("会社概要", selection: $selectedSection) {
                    Text("法人").tag("profile")
                    Text("株主・資本政策").tag("equity")
                    Text("財務").tag("financial")
                    Text("会議").tag("meetings")
                    Text("要対応").tag("actions")
                }.pickerStyle(.segmented)
                if selectedSection == "profile" { profileSection(data) }
                if selectedSection == "equity" {
                    capTableSection(data, snapshots: snapshots, selectedSnapshot: selectedSnapshot, tieOut: tieOut, conversion: conversion)
                    equitySection(data)
                }
                if selectedSection == "financial" { financialSection(data) }
                if selectedSection == "meetings" { meetingsSection(data) }
                if selectedSection == "actions" { actionsSection(data) }
                if let message {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(messageIsError ? AMDOSDesign.warning : AMDOSDesign.success)
                        .textSelection(.enabled)
                }
            }
        }
        .task { load() }
        .sheet(isPresented: $showingProfileEditor) {
            AMDOSParityCompanyEditorSheet(projectId: projectId, profile: data?.profile) {
                message = "会社基本情報を保存したよ"
                messageIsError = false
                load()
            }
        }
        .sheet(isPresented: $showingEquityEditor) {
            AMDOSParityEquityEditorSheet(projectId: projectId, rounds: data?.rounds ?? []) {
                message = "株式イベントを保存したよ"
                messageIsError = false
                load()
            }
        }
        .sheet(isPresented: $showingRoundEditor) {
            AMDOSParityRoundEditorSheet(projectId: projectId) {
                message = "調達ラウンドを保存したよ"
                messageIsError = false
                load()
            }
        }
        .sheet(isPresented: $showingConvertibleEditor) {
            AMDOSParityConvertibleEditorSheet(projectId: projectId) {
                message = "転換前証券を保存したよ"
                messageIsError = false
                load()
            }
        }
        .sheet(isPresented: $showingFinancialEditor) {
            AMDOSParityFinancialEditorSheet(projectId: projectId) { reloaded in
                data = reloaded
                state = .loaded
                message = "年度決算を保存したよ"
                messageIsError = false
            }
        }
        .sheet(isPresented: $showingMeetingEditor) {
            AMDOSParityMeetingEditorSheet(projectId: projectId) { reloaded in
                data = reloaded
                state = .loaded
                message = "総会・役会情報を保存したよ"
                messageIsError = false
            }
        }
    }

    @ViewBuilder
    private func overviewSummary(
        data: AMDOSParityCockpitCompanyEnvelope,
        latestSnapshot: AMDOSParityCapTableSnapshot?,
        tieOut: AMDOSParityCapTableTieOut,
        conversion: AMDOSParityConvertibleScenario,
        selectedEquityValue: Double?,
        latestRound: AMDOSParityCockpitValuationRound?
    ) -> some View {
        let profileCompleteness = AMDOSParityCompanyOverviewMath.profileCompleteness(data.profile)
        let tieOutPresentation = amdOSCompanyOverviewTieOutPresentation(tieOut)
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 205), spacing: 12)], spacing: 12) {
            AMDOSMetricTile(label: "基本情報", value: "\(profileCompleteness) / 6項目", detail: "登記・定款の現在値")
            AMDOSMetricTile(label: "発行済株式", value: "\(amdOSCompanyOverviewNumber(latestSnapshot?.outstandingShares, digits: 2))株", detail: tieOutPresentation.text, tint: tieOutPresentation.tint)
            AMDOSMetricTile(label: "完全希薄化後", value: "\(amdOSCompanyOverviewNumber(latestSnapshot?.dilutedShares, digits: 2))株", detail: "転換見込を含む参考値 \(amdOSCompanyOverviewNumber(conversion.proFormaDilutedShares, digits: 2))株")
            AMDOSMetricTile(label: "直近企業価値", value: amdOSCompanyOverviewYen(selectedEquityValue), detail: latestRound?.roundName?.trimmedNonEmpty ?? "ラウンド未入力")
        }
    }

    @ViewBuilder
    private func capTableSection(
        _ data: AMDOSParityCockpitCompanyEnvelope,
        snapshots: [AMDOSParityCapTableSnapshot],
        selectedSnapshot: AMDOSParityCapTableSnapshot?,
        tieOut: AMDOSParityCapTableTieOut,
        conversion: AMDOSParityConvertibleScenario
    ) -> some View {
        AMDOSSectionCard("Cap table", systemImage: "tablecells") {
            Text("確定済みの株式イベントだけを時系列で積み上げた現在値。計画・取消は法的現在値へ入れない。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
            if snapshots.isEmpty {
                Text("確定済みの株式イベント、または現在の株主レコードがまだないよ。")
                    .foregroundStyle(AMDOSDesign.muted)
            } else {
                Picker("時点", selection: snapshotSelection(snapshots)) {
                    ForEach(snapshots) { snapshot in
                        Text("\(amdOSCompanyOverviewDate(snapshot.effectiveOn)) · \(snapshot.label)").tag(snapshot.id)
                    }
                }
                .pickerStyle(.menu)
                if let selectedSnapshot {
                    HStack(alignment: .top, spacing: 18) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(amdOSCompanyOverviewDate(selectedSnapshot.effectiveOn)) · \(selectedSnapshot.label)").font(.headline)
                            Text("イベント: \(AMDOSParityCompanyOverviewMath.transactionLabelForType(selectedSnapshot.transactionType)) / 発行済差分 \(amdOSCompanyOverviewSignedNumber(selectedSnapshot.outstandingDelta))株 / FD差分 \(amdOSCompanyOverviewSignedNumber(selectedSnapshot.dilutedDelta))株")
                                .font(.caption)
                                .foregroundStyle(AMDOSDesign.muted)
                        }
                        Spacer(minLength: 0)
                        VStack(alignment: .trailing, spacing: 3) {
                            Text("発行済 \(amdOSCompanyOverviewNumber(selectedSnapshot.outstandingShares, digits: 2))株").font(.subheadline.weight(.semibold))
                            Text("FD \(amdOSCompanyOverviewNumber(selectedSnapshot.dilutedShares, digits: 2))株 / 払込 \(amdOSCompanyOverviewYen(selectedSnapshot.paidInYen))")
                                .font(.caption)
                                .foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                    if AMDOSParityCompanyOverviewMath.originWarning(data, snapshots: snapshots) {
                        Label("この履歴は設立イベントから始まっていない。現在値としては読めるが、設立時点からの正式な履歴ではないよ。", systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundStyle(AMDOSDesign.warning)
                    }
                    ScrollView(.horizontal) {
                        VStack(spacing: 0) {
                            companyCapTableHeader
                            ForEach(selectedSnapshot.rows) { row in
                                companyCapTableRow(row)
                                Divider()
                            }
                        }
                        .frame(minWidth: 880, alignment: .leading)
                    }
                }
            }
            let tieOutPresentation = amdOSCompanyOverviewTieOutPresentation(tieOut)
            HStack(alignment: .firstTextBaseline) {
                Label(tieOutPresentation.text, systemImage: tieOutPresentation.systemImage)
                    .font(.caption)
                    .foregroundStyle(tieOutPresentation.tint)
                Spacer()
                Text("転換見込 \(amdOSCompanyOverviewNumber(conversion.estimatedShares, digits: 2))株 / 参考FD \(amdOSCompanyOverviewNumber(conversion.proFormaDilutedShares, digits: 2))株")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
            }
        }
    }

    @ViewBuilder
    private func profileSection(_ data: AMDOSParityCockpitCompanyEnvelope) -> some View {
        AMDOSSectionCard("基本情報", systemImage: "building.2") {
            Text("登記・定款・最新の確認資料に基づく会社の現在値").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if let profile = data.profile {
                LazyVGrid(columns: [GridItem(.flexible(minimum: 270), spacing: 12), GridItem(.flexible(minimum: 270), spacing: 12)], spacing: 12) {
                    companyInfoCell("法人状態 / 法人形態", "\(amdOSCompanyOverviewLegalStatus(profile.legalStatus)) / \(profile.entityType?.trimmedNonEmpty ?? "未入力")")
                    companyInfoCell("法人番号", amdOSCompanyOverviewCorporateNumber(profile.corporateNumber))
                    companyInfoCell("商号", profile.legalName?.trimmedNonEmpty ?? "未入力")
                    companyInfoCell("英文商号", profile.legalNameEn?.trimmedNonEmpty ?? "未入力")
                    companyInfoCell("設立日 / 代表者", [profile.incorporatedOn.map(amdOSCompanyOverviewDate), profile.representativeName?.trimmedNonEmpty].compactMap { $0 }.joined(separator: " / ").nilIfEmpty ?? "未入力")
                    companyInfoCell("資本金 / 決算月", "\(amdOSCompanyOverviewYen(profile.capitalYen)) / \(profile.fiscalYearEndMonth.map { "\($0)月" } ?? "未入力")")
                    companyInfoCell("本店所在地", profile.headOffice?.trimmedNonEmpty ?? "未入力")
                    companyInfoCell("事業内容・定款目的", profile.businessPurpose?.trimmedNonEmpty ?? "未入力")
                    companyInfoCell("機関設計", [
                        profile.boardStructure?.trimmedNonEmpty,
                        profile.hasBoard.map { $0 ? "取締役会設置" : "取締役会非設置" },
                        profile.hasAuditor.map { $0 ? "監査役設置" : "監査役非設置" },
                    ].compactMap { $0 }.joined(separator: " / ").nilIfEmpty ?? "未入力")
                    companyInfoCell("公告方法", profile.publicNoticeMethod?.trimmedNonEmpty ?? "未入力")
                    companyInfoCell("適格請求書発行事業者番号", profile.invoiceRegistrationNumber?.trimmedNonEmpty ?? "未入力")
                    companyInfoCell("確認元 / 確認日", [profile.sourceRef?.trimmedNonEmpty, profile.sourceVerifiedOn.map(amdOSCompanyOverviewDate)].compactMap { $0 }.joined(separator: " / ").nilIfEmpty ?? "未入力")
                }
                if let notes = profile.notes?.trimmedNonEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("備考").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        Text(notes).font(.caption).textSelection(.enabled)
                    }
                }
            } else {
                Text("会社プロフィールはまだ登録されていないよ。").foregroundStyle(AMDOSDesign.muted)
            }
            if auth.email != nil {
                Button {
                    showingProfileEditor = true
                } label: {
                    Label("会社基本情報を編集", systemImage: "pencil")
                }
                .buttonStyle(.borderedProminent)
            }
        }
        let companyName = data.profile?.legalName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        AMDOSParityCapitalPlanWorkspace(projectId: projectId, projectName: companyName.isEmpty ? projectName : companyName, companyOverviewData: data)
    }

    @ViewBuilder
    private func equitySection(_ data: AMDOSParityCockpitCompanyEnvelope) -> some View {
        AMDOSSectionCard("株主", systemImage: "person.3") {
            if data.shareholders.isEmpty { Text("株主レコードはないよ。").foregroundStyle(AMDOSDesign.muted) }
            ForEach(data.shareholders) { row in
                AMDOSLineItem(title: row.holderName, subtitle: [row.holderType, row.shareClass, row.asOfYm].compactMap { $0 }.joined(separator: " · "), status: "\(row.shares.map { Int($0).formatted() } ?? "—")株 / \(row.ownershipPct.map { String(format: "%.2f%%", $0) } ?? "—")")
            }
        }
        AMDOSSectionCard("株式イベント", systemImage: "arrow.left.arrow.right") {
            if auth.email != nil {
                Button {
                    showingEquityEditor = true
                } label: {
                    Label("株式イベントを追加", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
            }
            if data.transactions.isEmpty { Text("株式イベントはまだないよ。").foregroundStyle(AMDOSDesign.muted) }
            ForEach(data.transactions) { tx in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("\(amdOSCompanyOverviewDate(tx.effectiveOn)) · \(AMDOSParityCompanyOverviewMath.transactionLabel(tx))").font(.subheadline.weight(.medium))
                        Spacer(minLength: 8)
                        AMDOSStatusBadge(text: amdOSCompanyOverviewStatus(tx.status), tint: amdOSCompanyOverviewTransactionTint(tx.status))
                    }
                    if let description = tx.description?.trimmedNonEmpty { Text(description).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    ForEach(tx.entries ?? []) { entry in
                        HStack(spacing: 8) {
                            Text("\(entry.holderName ?? "保有者未確認") · \(entry.securityClass ?? "普通株式")").font(.caption)
                            Spacer(minLength: 8)
                            Text("発行済 \(amdOSCompanyOverviewSignedNumber(entry.outstandingDelta))株 / FD \(amdOSCompanyOverviewSignedNumber(entry.dilutedDelta))株 / 払込 \(amdOSCompanyOverviewYen(entry.paidInYenDelta))")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                    if let source = tx.sourceRef?.trimmedNonEmpty { Text("確認元: \(source)").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                }
                Divider()
            }
        }
        AMDOSSectionCard("確定済みの調達・潜在株式", systemImage: "chart.pie") {
            Text("登記・契約等の証跡に基づく確定済みの調達ラウンド・転換前証券。現在持株比率のベースラインとして扱う。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
            if auth.email != nil {
                HStack {
                    Button {
                        showingRoundEditor = true
                    } label: {
                        Label("ラウンド", systemImage: "plus")
                    }
                    .buttonStyle(.borderedProminent)
                    Button {
                        showingConvertibleEditor = true
                    } label: {
                        Label("転換前証券", systemImage: "plus")
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            if data.rounds.isEmpty && data.convertibles.isEmpty {
                Text("調達ラウンドや転換前証券を追加すると、企業価値と希薄化の検討材料をまとめられるよ。")
                    .foregroundStyle(AMDOSDesign.muted)
            } else {
                LazyVGrid(columns: [GridItem(.flexible(minimum: 310), spacing: 14), GridItem(.flexible(minimum: 310), spacing: 14)], spacing: 14) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("株式ラウンド").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                        if data.rounds.isEmpty { Text("ラウンド未入力").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        ForEach(data.rounds) { round in companyRoundCard(round) }
                    }
                    let conversion = AMDOSParityCompanyOverviewMath.convertibleScenario(data)
                    VStack(alignment: .leading, spacing: 10) {
                        HStack { Text("転換前証券").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted); Spacer(); Text("転換見込 \(amdOSCompanyOverviewNumber(conversion.estimatedShares, digits: 2))株").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        if data.convertibles.isEmpty { Text("転換前証券未入力").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        ForEach(data.convertibles) { instrument in companyConvertibleCard(instrument) }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func financialSection(_ data: AMDOSParityCockpitCompanyEnvelope) -> some View {
        AMDOSSectionCard("年度決算", systemImage: "chart.bar.xaxis") {
            Text("月次の経営PLとは分け、確定・申告した年度数値を保存").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if auth.email != nil {
                Button {
                    showingFinancialEditor = true
                } label: {
                    Label("年度決算を追加・更新", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
            }
            if data.financialPeriods.isEmpty {
                Text("年度決算はまだ入力されていないよ。").foregroundStyle(AMDOSDesign.muted)
            } else {
                ScrollView(.horizontal) {
                    VStack(spacing: 0) {
                        companyFinancialHeader
                        ForEach(data.financialPeriods) { row in
                            companyFinancialRow(row)
                            Divider()
                        }
                    }
                    .frame(minWidth: 720, alignment: .leading)
                }
                ForEach(data.financialPeriods) { row in
                    DisclosureGroup("FY\(row.fiscalYear) の詳細") {
                        LazyVGrid(columns: [GridItem(.flexible(minimum: 235), spacing: 12), GridItem(.flexible(minimum: 235), spacing: 12)], spacing: 10) {
                            companyInfoCell("期間", [row.periodStartOn.map(amdOSCompanyOverviewDate), row.periodEndOn.map(amdOSCompanyOverviewDate)].compactMap { $0 }.joined(separator: " 〜 ").nilIfEmpty ?? "未入力")
                            companyInfoCell("申告日", row.filedOn.map(amdOSCompanyOverviewDate) ?? "未入力")
                            companyInfoCell("経常利益", amdOSCompanyOverviewYen(row.ordinaryIncomeYen))
                            companyInfoCell("総資産", amdOSCompanyOverviewYen(row.totalAssetsYen))
                            companyInfoCell("負債", amdOSCompanyOverviewYen(row.totalLiabilitiesYen))
                            companyInfoCell("現預金", amdOSCompanyOverviewYen(row.cashYen))
                            companyInfoCell("有利子負債", amdOSCompanyOverviewYen(row.debtYen))
                            companyInfoCell("確認元", row.sourceRef?.trimmedNonEmpty ?? "未入力")
                        }
                        if let notes = row.notes?.trimmedNonEmpty { Text("備考: \(notes)").font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled) }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func meetingsSection(_ data: AMDOSParityCockpitCompanyEnvelope) -> some View {
        AMDOSSectionCard("総会・取締役会", systemImage: "person.3.sequence") {
            Text("決議、AMD対応、関連資料を開催履歴と一緒に保存").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if auth.email != nil {
                Button {
                    showingMeetingEditor = true
                } label: {
                    Label("総会・取締役会を追加", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
            }
            if data.meetings.isEmpty { Text("総会・取締役会の開催情報はまだないよ。").foregroundStyle(AMDOSDesign.muted) }
            ForEach(data.meetings) { row in
                VStack(alignment: .leading, spacing: 7) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(amdOSCompanyOverviewDate(row.meetingDate ?? row.meetingYm)).font(.subheadline.weight(.semibold))
                        AMDOSStatusBadge(text: amdOSCompanyOverviewMeetingLabel(row.meetingType), tint: AMDOSDesign.muted)
                        if let response = row.amdResponse?.trimmedNonEmpty { AMDOSStatusBadge(text: "AMD: \(response)", tint: AMDOSDesign.success) }
                        Spacer(minLength: 0)
                    }
                    if let agenda = row.agendaSummary?.trimmedNonEmpty { Text(agenda).font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled) }
                    if let resolutions = row.resolutionsJSON?.filter({ $0.title?.trimmedNonEmpty != nil }), !resolutions.isEmpty {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("決議").font(.caption2.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                            ForEach(Array(resolutions.enumerated()), id: \.offset) { _, resolution in
                                Text("• \(resolution.title?.trimmedNonEmpty ?? "決議内容未入力")").font(.caption)
                            }
                        }
                    }
                    if let attachments = row.attachmentsJSON, !attachments.isEmpty {
                        HStack(spacing: 8) {
                            ForEach(Array(attachments.enumerated()), id: \.offset) { index, attachment in
                                if let destination = attachment.destination, let url = URL(string: destination) {
                                    Link("資料: \(attachment.name?.trimmedNonEmpty ?? String(index + 1))", destination: url)
                                        .font(.caption)
                                }
                            }
                        }
                    }
                    if let details = [row.location?.trimmedNonEmpty, row.sourceRef?.trimmedNonEmpty, row.notes?.trimmedNonEmpty].compactMap({ $0 }).joined(separator: " / ").trimmedNonEmpty {
                        Text(details).font(.caption2).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
                    }
                }
                Divider()
            }
        }
    }

    @ViewBuilder
    private func actionsSection(_ data: AMDOSParityCockpitCompanyEnvelope) -> some View {
        AMDOSSectionCard("会社運営の要対応", systemImage: "checklist") {
            Text("総会・登記・株主対応など、期限が残っているもの").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if data.actionItems.isEmpty { Text("確認済みの要対応はないよ。").foregroundStyle(AMDOSDesign.muted) }
            ForEach(data.actionItems) { item in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "scale.3d").foregroundStyle(AMDOSDesign.muted)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title).font(.subheadline.weight(.medium))
                        if let summary = item.summary?.trimmedNonEmpty { Text(summary).font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled) }
                        Text("状態: \(item.status)\(item.priority.map { " / 優先度: \($0)" } ?? "")").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer(minLength: 8)
                    AMDOSStatusBadge(text: item.dueAt.map(amdOSCompanyOverviewDate) ?? "期日なし", tint: amdOSCompanyOverviewIsOverdue(item.dueAt) ? AMDOSDesign.warning : AMDOSDesign.muted)
                }
                Divider()
            }
        }
    }

    @ViewBuilder
    private func companyInfoCell(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
            Text(value).font(.subheadline).textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, minHeight: 46, alignment: .topLeading)
        .padding(10)
        .background(AMDOSDesign.panel.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
    }

    private var companyCapTableHeader: some View {
        HStack(spacing: 0) {
            companyTableHeader("保有者 / 種別", width: 220, alignment: .leading)
            companyTableHeader("発行済", width: 112, alignment: .trailing)
            companyTableHeader("発行済%", width: 94, alignment: .trailing)
            companyTableHeader("FD", width: 112, alignment: .trailing)
            companyTableHeader("FD%", width: 94, alignment: .trailing)
            companyTableHeader("払込額", width: 150, alignment: .trailing)
        }
        .background(AMDOSDesign.panel)
    }

    private func companyCapTableRow(_ row: AMDOSParityCapTableRow) -> some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.holderName.isEmpty ? "保有者未入力" : row.holderName).font(.caption.weight(.medium))
                Text("\(AMDOSParityCompanyOverviewMath.holderLabel(row.holderType)) / \(row.securityClass)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
            }
            .frame(width: 220, alignment: .leading)
            companyTableValue("\(amdOSCompanyOverviewNumber(row.outstandingShares, digits: 2))株", width: 112)
            companyTableValue(amdOSCompanyOverviewPercent(row.ownershipPct), width: 94)
            companyTableValue("\(amdOSCompanyOverviewNumber(row.dilutedShares, digits: 2))株", width: 112)
            companyTableValue(amdOSCompanyOverviewPercent(row.dilutedPct), width: 94)
            companyTableValue(amdOSCompanyOverviewYen(row.paidInYen), width: 150)
        }
        .padding(.vertical, 7)
    }

    private func companyTableHeader(_ title: String, width: CGFloat, alignment: Alignment) -> some View {
        Text(title)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(AMDOSDesign.muted)
            .frame(width: width, alignment: alignment)
            .padding(.vertical, 7)
    }

    private func companyTableValue(_ value: String, width: CGFloat) -> some View {
        Text(value)
            .font(.caption.monospacedDigit())
            .frame(width: width, alignment: .trailing)
            .textSelection(.enabled)
    }

    private func companyRoundCard(_ round: AMDOSParityCockpitValuationRound) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(round.roundName?.trimmedNonEmpty ?? "名称未入力").font(.subheadline.weight(.semibold))
                    Text(amdOSCompanyOverviewDate(round.roundDate ?? round.roundYm)).font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(amdOSCompanyOverviewYen(round.raisedYen)).font(.caption.weight(.semibold))
                    Text("調達額").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                }
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                companyMiniValue("pre", amdOSCompanyOverviewYen(round.preMoneyYen))
                companyMiniValue("post", amdOSCompanyOverviewYen(round.postMoneyYen))
                companyMiniValue("1株", amdOSCompanyOverviewYen(round.pricePerShareYen))
            }
            if let detail = [round.leadInvestor?.trimmedNonEmpty, round.sourceRef?.trimmedNonEmpty, round.notes?.trimmedNonEmpty].compactMap({ $0 }).joined(separator: " / ").trimmedNonEmpty {
                Text(detail).font(.caption2).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
            }
        }
        .padding(10)
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(AMDOSDesign.border))
    }

    private func companyConvertibleCard(_ instrument: AMDOSParityCockpitConvertible) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(instrument.holderName).font(.subheadline.weight(.semibold))
                    Text("\(instrument.instrumentType) / \(amdOSCompanyOverviewStatus(instrument.status))").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                Spacer(minLength: 8)
                Text(amdOSCompanyOverviewYen(instrument.principalYen)).font(.caption.weight(.semibold))
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                companyMiniValue("評価上限", amdOSCompanyOverviewYen(instrument.valuationCapYen))
                companyMiniValue("転換見込", "\(amdOSCompanyOverviewNumber(instrument.estimatedConversionShares, digits: 2))株")
                companyMiniValue("割引", instrument.discountRate.map { amdOSCompanyOverviewPercent($0 * 100) } ?? "—")
                companyMiniValue("転換単価", amdOSCompanyOverviewYen(instrument.estimatedConversionPrice))
            }
            if let detail = [instrument.issuedOn.map(amdOSCompanyOverviewDate), instrument.maturityOn.map(amdOSCompanyOverviewDate), instrument.conversionTrigger?.trimmedNonEmpty, instrument.notes?.trimmedNonEmpty].compactMap({ $0 }).joined(separator: " / ").trimmedNonEmpty {
                Text(detail).font(.caption2).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
            }
        }
        .padding(10)
        .background(AMDOSDesign.warning.opacity(0.06), in: RoundedRectangle(cornerRadius: 9))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(AMDOSDesign.warning.opacity(0.35)))
    }

    private func companyMiniValue(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(AMDOSDesign.muted)
            Text(value).font(.caption.weight(.medium)).monospacedDigit()
        }
    }

    private var companyFinancialHeader: some View {
        HStack(spacing: 0) {
            companyTableHeader("年度", width: 80, alignment: .leading)
            companyTableHeader("状態", width: 100, alignment: .leading)
            companyTableHeader("売上高", width: 130, alignment: .trailing)
            companyTableHeader("営業利益", width: 130, alignment: .trailing)
            companyTableHeader("純利益", width: 130, alignment: .trailing)
            companyTableHeader("純資産", width: 130, alignment: .trailing)
        }
        .background(AMDOSDesign.panel)
    }

    private func companyFinancialRow(_ row: AMDOSParityCockpitFinancialPeriod) -> some View {
        HStack(spacing: 0) {
            Text("FY\(row.fiscalYear)").font(.caption.weight(.semibold).monospacedDigit()).frame(width: 80, alignment: .leading)
            Text(amdOSCompanyOverviewStatus(row.statementStatus)).font(.caption).frame(width: 100, alignment: .leading)
            companyTableValue(amdOSCompanyOverviewYen(row.revenueYen), width: 130)
            companyTableValue(amdOSCompanyOverviewYen(row.operatingIncomeYen), width: 130).foregroundStyle((row.operatingIncomeYen ?? 0) < 0 ? AMDOSDesign.warning : AMDOSDesign.ink)
            companyTableValue(amdOSCompanyOverviewYen(row.netIncomeYen), width: 130).foregroundStyle((row.netIncomeYen ?? 0) < 0 ? AMDOSDesign.warning : AMDOSDesign.ink)
            companyTableValue(amdOSCompanyOverviewYen(row.netAssetsYen), width: 130)
        }
        .padding(.vertical, 7)
    }

    private func snapshotSelection(_ snapshots: [AMDOSParityCapTableSnapshot]) -> Binding<String> {
        Binding(
            get: {
                snapshots.contains(where: { $0.id == selectedSnapshotID })
                    ? selectedSnapshotID
                    : snapshots.last?.id ?? ""
            },
            set: { selectedSnapshotID = $0 }
        )
    }

    private func load() {
        Task {
            state = .loading
            do {
                data = try await AMDOSRESTClient.shared.fetchPWA(AMDOSParityCockpitCompanyEnvelope.self, path: "/api/governance", query: ["projectId": projectId])
                state = .loaded
                messageIsError = false
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    private func exportCompanyOverviewExcel() {
        guard !exportingCompanyExcel else { return }
        exportingCompanyExcel = true
        message = nil
        Task {
            defer { exportingCompanyExcel = false }
            do {
                let bytes = try await AMDOSRESTClient.shared.fetchPWAData(
                    path: "/api/governance/company-overview-export",
                    query: ["projectId": projectId, "projectName": projectName]
                )
                guard !bytes.isEmpty else {
                    throw AMDOSNetworkError.http("会社概要Excelのデータが空だったよ")
                }
                guard let xlsxType = UTType(filenameExtension: "xlsx") else {
                    throw AMDOSNetworkError.http("Excel保存形式を準備できなかったよ")
                }
                let panel = NSSavePanel()
                panel.nameFieldStringValue = "\(companyOverviewExportName(projectName))_会社概要_cap-table.xlsx"
                panel.allowedContentTypes = [xlsxType]
                guard panel.runModal() == .OK, let destination = panel.url else { return }
                try bytes.write(to: destination, options: .atomic)
                message = "会社概要Excelを保存したよ"
                messageIsError = false
            } catch {
                message = error.localizedDescription
                messageIsError = true
            }
        }
    }

    private func exportCompanyOverviewPDF(
        data: AMDOSParityCockpitCompanyEnvelope,
        snapshots: [AMDOSParityCapTableSnapshot],
        selectedSnapshot: AMDOSParityCapTableSnapshot?
    ) {
        guard !exportingCompanyPDF else { return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "\(companyOverviewExportName(projectName))_会社概要_cap-table.pdf"
        panel.allowedContentTypes = [.pdf]
        guard panel.runModal() == .OK, let destination = panel.url else { return }
        exportingCompanyPDF = true
        message = nil
        Task {
            defer { exportingCompanyPDF = false }
            do {
                let capital = try await AMDOSRESTClient.shared.fetchPWA(
                    AMDOSCapitalEnvelope.self,
                    path: "/api/governance/capital-plans",
                    query: ["projectId": projectId]
                )
                guard capital.ok else {
                    throw AMDOSNetworkError.http(capital.error ?? "資本政策を読み込めなかったよ")
                }
                let bytes = try AMDOSParityCompanyOverviewPDFRenderer.render(
                    // PWA's exportRef title uses the profile legal name when
                    // present, while its save name always uses projectName.
                    projectName: data.profile?.legalName?.trimmedNonEmpty ?? projectName,
                    data: data,
                    snapshots: snapshots,
                    selectedSnapshot: selectedSnapshot,
                    capitalPlans: capital.plans ?? [],
                    capitalVersions: capital.versions ?? []
                )
                guard !bytes.isEmpty else { throw AMDOSNetworkError.http("会社概要PDFのデータが空だったよ") }
                try bytes.write(to: destination, options: .atomic)
                message = "会社概要PDFを保存したよ"
                messageIsError = false
            } catch {
                message = error.localizedDescription
                messageIsError = true
            }
        }
    }

    private func companyOverviewExportName(_ value: String) -> String {
        let invalidFilenameCharacters = CharacterSet(charactersIn: "\\/:*?\"<>|")
        return value.unicodeScalars.map { invalidFilenameCharacters.contains($0) ? "_" : String($0) }.joined()
    }

}

private func amdOSCompanyOverviewNumber(_ value: Double?, digits: Int = 0) -> String {
    guard let value, value.isFinite else { return "—" }
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "ja_JP")
    formatter.numberStyle = .decimal
    formatter.maximumFractionDigits = digits
    return formatter.string(from: NSNumber(value: value)) ?? String(value)
}

private func amdOSCompanyOverviewYen(_ value: Double?) -> String {
    guard let value, value.isFinite else { return "—" }
    if abs(value) >= 100_000_000 { return "\(amdOSCompanyOverviewNumber(value / 100_000_000, digits: 2))億円" }
    if abs(value) >= 10_000 { return "\(amdOSCompanyOverviewNumber(value / 10_000, digits: 1))万円" }
    return "\(amdOSCompanyOverviewNumber(value))円"
}

private func amdOSCompanyOverviewSignedNumber(_ value: Double?) -> String {
    guard let value, value.isFinite else { return "—" }
    let prefix = value > 0 ? "+" : ""
    return "\(prefix)\(amdOSCompanyOverviewNumber(value, digits: 2))"
}

private func amdOSCompanyOverviewPercent(_ value: Double) -> String {
    "\(amdOSCompanyOverviewNumber(value, digits: 2))%"
}

private func amdOSCompanyOverviewDate(_ value: String?) -> String {
    guard let value = value?.trimmedNonEmpty else { return "日付未入力" }
    return value.replacingOccurrences(of: "-", with: "/")
}

private func amdOSCompanyOverviewCorporateNumber(_ value: String?) -> String {
    guard let value = value?.trimmedNonEmpty else { return "未入力" }
    let scalars = value.unicodeScalars
    guard scalars.count == 13, scalars.allSatisfy({ CharacterSet.decimalDigits.contains($0) }) else { return value }
    let characters = Array(value)
    return "\(characters[0])-\(String(characters[1...4]))-\(String(characters[5...8]))-\(String(characters[9...12]))"
}

private func amdOSCompanyOverviewLegalStatus(_ value: String?) -> String {
    ["pre_incorporation": "設立前", "incorporated": "設立済み", "liquidating": "清算中", "closed": "清算済み"][value ?? ""] ?? "設立前"
}

private func amdOSCompanyOverviewMeetingLabel(_ value: String?) -> String {
    [
        "agm": "定時株主総会", "egm": "臨時株主総会", "board": "取締役会",
        "board_written": "取締役会（書面決議）", "shareholder_written": "株主総会（書面決議）",
    ][value ?? ""] ?? value?.trimmedNonEmpty ?? "種別未入力"
}

private func amdOSCompanyOverviewStatus(_ value: String?) -> String {
    ["draft": "下書き", "final": "確定", "filed": "申告済み", "planned": "計画", "confirmed": "確定", "void": "取消"][value ?? ""] ?? value?.trimmedNonEmpty ?? "未入力"
}

private func amdOSCompanyOverviewTransactionTint(_ status: String) -> Color {
    switch status {
    case "confirmed": AMDOSDesign.success
    case "planned": AMDOSDesign.warning
    default: AMDOSDesign.muted
    }
}

private func amdOSCompanyOverviewIsOverdue(_ value: String?) -> Bool {
    guard let value = value?.trimmedNonEmpty else { return false }
    let day = value.prefix(10)
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    guard let date = formatter.date(from: String(day)) else { return false }
    return date < Calendar.current.startOfDay(for: .now)
}

private func amdOSCompanyOverviewTieOutPresentation(
    _ tieOut: AMDOSParityCapTableTieOut
) -> (text: String, tint: Color, systemImage: String) {
    switch tieOut.state {
    case .matched:
        return ("登記株式数と一致", AMDOSDesign.success, "checkmark.circle")
    case .mismatch:
        return ("登記との差 \(amdOSCompanyOverviewNumber(tieOut.difference, digits: 2))株", AMDOSDesign.warning, "exclamationmark.triangle")
    case .unknown:
        return ("登記株式数は未入力", AMDOSDesign.muted, "questionmark.circle")
    }
}

// PWA's exportRef includes the full Company Overview body. The native exporter
// uses the same loaded data plus the same capital-plan read route, then writes
// a paginated PDF only after the user has selected an explicit save location.
private enum AMDOSParityCompanyOverviewPDFRenderer {
    static func render(
        projectName: String,
        data: AMDOSParityCockpitCompanyEnvelope,
        snapshots: [AMDOSParityCapTableSnapshot],
        selectedSnapshot: AMDOSParityCapTableSnapshot?,
        capitalPlans: [AMDOSCapitalPlanRow],
        capitalVersions: [AMDOSCapitalVersionRow]
    ) throws -> Data {
        let body = NSMutableAttributedString()
        append("\(projectName) 会社概要・cap table", to: body, font: .systemFont(ofSize: 19, weight: .bold), color: .labelColor)
        append("会社情報・資本政策・機関決定・決算を、全メンバーで更新するPJ正本", to: body, font: .systemFont(ofSize: 10), color: .secondaryLabelColor)

        let latestSnapshot = snapshots.last
        let tieOut = AMDOSParityCompanyOverviewMath.capTableTieOut(data)
        let conversion = AMDOSParityCompanyOverviewMath.convertibleScenario(data)
        let latestRound = data.rounds.first(where: { $0.pricePerShareYen != nil || $0.postMoneyYen != nil }) ?? data.rounds.first
        let selectedEquityValue = AMDOSParityCompanyOverviewMath.selectedEquityValue(snapshot: selectedSnapshot, latestRound: latestRound)
        let profileCompleteness = AMDOSParityCompanyOverviewMath.profileCompleteness(data.profile)
        appendSection("サマリー", to: body)
        appendLine("基本情報: \(profileCompleteness) / 6項目", to: body)
        appendLine("発行済株式: \(amdOSCompanyOverviewNumber(latestSnapshot?.outstandingShares, digits: 2))株", to: body)
        let tieOutText: String
        switch tieOut.state {
        case .matched: tieOutText = "登記株式数と一致"
        case .mismatch: tieOutText = "登記との差 \(amdOSCompanyOverviewNumber(tieOut.difference, digits: 2))株"
        case .unknown: tieOutText = "登記株式数は未入力"
        }
        appendLine("登記照合: \(tieOutText)", to: body)
        appendLine("完全希薄化後: \(amdOSCompanyOverviewNumber(latestSnapshot?.dilutedShares, digits: 2))株 / 転換見込を含む参考値: \(amdOSCompanyOverviewNumber(conversion.proFormaDilutedShares, digits: 2))株", to: body)
        appendLine("直近企業価値: \(amdOSCompanyOverviewYen(selectedEquityValue)) / \(latestRound?.roundName?.trimmedNonEmpty ?? "ラウンド未入力")", to: body)

        appendSection("基本情報", to: body)
        if let profile = data.profile {
            appendLabeled("法人状態 / 法人形態", "\(amdOSCompanyOverviewLegalStatus(profile.legalStatus)) / \(profile.entityType?.trimmedNonEmpty ?? "未入力")", to: body)
            appendLabeled("法人番号", amdOSCompanyOverviewCorporateNumber(profile.corporateNumber), to: body)
            appendLabeled("商号", profile.legalName?.trimmedNonEmpty ?? "未入力", to: body)
            appendLabeled("英文商号", profile.legalNameEn?.trimmedNonEmpty ?? "未入力", to: body)
            appendLabeled("設立日 / 代表者", [profile.incorporatedOn.map(amdOSCompanyOverviewDate), profile.representativeName?.trimmedNonEmpty].compactMap { $0 }.joined(separator: " / ").nilIfEmpty ?? "未入力", to: body)
            appendLabeled("資本金 / 決算月", "\(amdOSCompanyOverviewYen(profile.capitalYen)) / \(profile.fiscalYearEndMonth.map { "\($0)月" } ?? "未入力")", to: body)
            appendLabeled("本店所在地", profile.headOffice?.trimmedNonEmpty ?? "未入力", to: body)
            appendLabeled("事業内容・定款目的", profile.businessPurpose?.trimmedNonEmpty ?? "未入力", to: body)
            appendLabeled("機関設計", [profile.boardStructure?.trimmedNonEmpty, profile.hasBoard.map { $0 ? "取締役会設置" : "取締役会非設置" }, profile.hasAuditor.map { $0 ? "監査役設置" : "監査役非設置" }].compactMap { $0 }.joined(separator: " / ").nilIfEmpty ?? "未入力", to: body)
            appendLabeled("公告方法", profile.publicNoticeMethod?.trimmedNonEmpty ?? "未入力", to: body)
            appendLabeled("適格請求書発行事業者番号", profile.invoiceRegistrationNumber?.trimmedNonEmpty ?? "未入力", to: body)
            appendLabeled("確認元 / 確認日", [profile.sourceRef?.trimmedNonEmpty, profile.sourceVerifiedOn.map(amdOSCompanyOverviewDate)].compactMap { $0 }.joined(separator: " / ").nilIfEmpty ?? "未入力", to: body)
            if let notes = profile.notes?.trimmedNonEmpty { appendLabeled("備考", notes, to: body) }
        } else {
            appendLine("会社プロフィールはまだ登録されていない。", to: body)
        }

        appendSection("資本政策プラン", to: body)
        if capitalPlans.isEmpty {
            appendLine("資本政策プランは未登録。", to: body)
        } else {
            for plan in capitalPlans {
                appendLine("\(plan.name) / \(plan.status) / revision \(plan.revision)", to: body, font: .systemFont(ofSize: 11, weight: .semibold))
                let derived: AMDOSCapitalDocument
                switch AMDOSCapitalPlanMath.safeDerive(document: plan.document) {
                case .success(let value):
                    derived = value
                case .failure(let error):
                    appendLine("  自動算出エラー: \(error.localizedDescription)", to: body, font: .systemFont(ofSize: 9), color: .systemRed)
                    derived = plan.document
                }
                let holders = Dictionary(uniqueKeysWithValues: derived.holders.map { ($0.id, $0.name) })
                if derived.holders.isEmpty {
                    appendLine("  株主台帳は未登録。", to: body)
                } else {
                    appendLine("  株主台帳: \(derived.holders.map { "\($0.name)（\($0.kind)）" }.joined(separator: " / "))", to: body)
                }
                let snapshotsByEvent = Dictionary(uniqueKeysWithValues: AMDOSCapitalPlanMath.snapshots(document: derived).map { ($0.eventID, $0) })
                for event in derived.events.sorted(by: { $0.order < $1.order }) {
                    let eventFacts = [
                        event.date?.trimmedNonEmpty,
                        event.status?.trimmedNonEmpty,
                        event.calculationBasis?.trimmedNonEmpty,
                        event.preMoneyValuation.map { "pre \(amdOSCompanyOverviewYen($0.value))" },
                        event.primaryRaise.map { "調達 \(amdOSCompanyOverviewYen($0.value))" },
                        event.postMoneyValuation.map { "post \(amdOSCompanyOverviewYen($0.value))" },
                        event.pricePerShare.map { "1株 \(amdOSCompanyOverviewYen($0.value))" },
                        event.newShares.map { "新規 \(amdOSCompanyOverviewNumber($0.value, digits: 2))株" },
                        event.poolSize.map { "プール \(amdOSCompanyOverviewNumber($0.value, digits: 2))株" },
                        event.splitRatio.map { "分割 \(amdOSCompanyOverviewNumber($0.value, digits: 4))倍" },
                        event.conversionCap.map { "転換上限 \(amdOSCompanyOverviewYen($0.value))" },
                        event.conversionDiscount.map { "転換割引 \(amdOSCompanyOverviewPercent($0.value * 100))" },
                    ].compactMap { $0 }.joined(separator: " / ")
                    appendLine("  • \(event.label) [\(event.type)]\(eventFacts.isEmpty ? "" : " / \(eventFacts)")", to: body)
                    for allocation in event.allocations {
                        let holder = holders[allocation.holderId] ?? allocation.holderId
                        let detail = [
                            "\(holder) / \(allocation.shareClass) / \(amdOSCompanyOverviewNumber(allocation.shares.value, digits: 2))株",
                            allocation.amount.map { amdOSCompanyOverviewYen($0.value) },
                            allocation.pricePerShare.map { "1株 \(amdOSCompanyOverviewYen($0.value))" },
                            allocation.targetOwnershipPercentage.map { "FD \(amdOSCompanyOverviewPercent($0.value * 100))" },
                        ].compactMap { $0 }.joined(separator: " / ")
                        appendLine("      \(detail)", to: body, font: .systemFont(ofSize: 9))
                    }
                    if let snapshot = snapshotsByEvent[event.id] {
                        appendLine("      イベント後: 発行済 \(amdOSCompanyOverviewNumber(snapshot.totalIssued, digits: 2))株 / FD \(amdOSCompanyOverviewNumber(snapshot.totalFullyDiluted, digits: 2))株", to: body, font: .systemFont(ofSize: 9, weight: .semibold))
                        for standing in snapshot.holders.sorted(by: { $0.fullyDiluted > $1.fullyDiluted }) {
                            let holder = holders[standing.id] ?? standing.id
                            appendLine("        \(holder) / 発行済 \(amdOSCompanyOverviewNumber(standing.issued, digits: 2))株 (\(amdOSCompanyOverviewPercent(standing.issuedRatio * 100))) / FD \(amdOSCompanyOverviewNumber(standing.fullyDiluted, digits: 2))株 (\(amdOSCompanyOverviewPercent(standing.fullyDilutedRatio * 100)))", to: body, font: .systemFont(ofSize: 8))
                        }
                    }
                    if let note = event.note?.trimmedNonEmpty { appendLine("      備考: \(note)", to: body, font: .systemFont(ofSize: 9)) }
                }
                let validation = AMDOSCapitalPlanMath.validationIssues(document: derived)
                if !validation.isEmpty {
                    appendLine("  検証結果: エラー \(validation.filter { $0.severity == "error" }.count)件 / 警告 \(validation.filter { $0.severity == "warning" }.count)件", to: body, font: .systemFont(ofSize: 9, weight: .semibold))
                    for issue in validation {
                        appendLine("    \(issue.severity == "error" ? "エラー" : "警告"): \(issue.message)", to: body, font: .systemFont(ofSize: 8), color: issue.severity == "error" ? .systemRed : .systemOrange)
                    }
                }
                let versions = capitalVersions.filter { $0.planId == plan.id }.sorted { $0.version > $1.version }
                if versions.isEmpty {
                    appendLine("  提出版履歴: まだ確定された提出版はない。", to: body)
                } else {
                    for version in versions {
                        var validationParts: [String] = []
                        if let blockingCount = version.validationSummary?.blockingIssues?.count {
                            validationParts.append("エラー \(blockingCount)件")
                        }
                        if let warningCount = version.validationSummary?.warnings?.count {
                            validationParts.append("警告 \(warningCount)件")
                        }
                        let validationSummary = validationParts.joined(separator: " / ")
                        appendLine("  提出版 v\(version.version) / \(version.publishedAt.map(amdOSCompanyOverviewDate) ?? "日時未確認") / \(version.publishedByEmail ?? "公開者未確認")\(validationSummary.isEmpty ? "" : " / \(validationSummary)")", to: body)
                    }
                }
            }
        }

        appendSection("Cap table", to: body)
        if let selectedSnapshot {
            appendLine("\(amdOSCompanyOverviewDate(selectedSnapshot.effectiveOn)) / \(selectedSnapshot.label) / 発行済 \(amdOSCompanyOverviewNumber(selectedSnapshot.outstandingShares, digits: 2))株 / FD \(amdOSCompanyOverviewNumber(selectedSnapshot.dilutedShares, digits: 2))株", to: body)
            for row in selectedSnapshot.rows {
                appendLine("  \(row.holderName.isEmpty ? "保有者未入力" : row.holderName) / \(AMDOSParityCompanyOverviewMath.holderLabel(row.holderType)) / \(row.securityClass) / 発行済 \(amdOSCompanyOverviewNumber(row.outstandingShares, digits: 2))株 (\(amdOSCompanyOverviewPercent(row.ownershipPct))) / FD \(amdOSCompanyOverviewNumber(row.dilutedShares, digits: 2))株 (\(amdOSCompanyOverviewPercent(row.dilutedPct))) / 払込 \(amdOSCompanyOverviewYen(row.paidInYen))", to: body)
            }
        } else {
            appendLine("Cap tableに表示できる確定済み株式データはない。", to: body)
        }

        appendSection("株式イベント", to: body)
        if data.transactions.isEmpty {
            appendLine("株式イベントは未登録。", to: body)
        } else {
            for transaction in data.transactions {
                appendLine("\(amdOSCompanyOverviewDate(transaction.effectiveOn)) / \(AMDOSParityCompanyOverviewMath.transactionLabel(transaction)) / \(amdOSCompanyOverviewStatus(transaction.status))", to: body, font: .systemFont(ofSize: 11, weight: .semibold))
                if let description = transaction.description?.trimmedNonEmpty { appendLine("  \(description)", to: body) }
                for entry in transaction.entries ?? [] {
                    appendLine("  \(entry.holderName ?? "保有者未確認") / \(entry.securityClass ?? "普通株式") / 発行済 \(amdOSCompanyOverviewSignedNumber(entry.outstandingDelta))株 / FD \(amdOSCompanyOverviewSignedNumber(entry.dilutedDelta))株 / 払込 \(amdOSCompanyOverviewYen(entry.paidInYenDelta))", to: body)
                }
            }
        }

        appendSection("確定済みの調達・潜在株式", to: body)
        if data.rounds.isEmpty && data.convertibles.isEmpty {
            appendLine("調達ラウンド・転換前証券は未登録。", to: body)
        }
        for round in data.rounds {
            appendLine("ラウンド: \(round.roundName?.trimmedNonEmpty ?? "名称未入力") / \(amdOSCompanyOverviewDate(round.roundDate ?? round.roundYm)) / 調達 \(amdOSCompanyOverviewYen(round.raisedYen)) / pre \(amdOSCompanyOverviewYen(round.preMoneyYen)) / post \(amdOSCompanyOverviewYen(round.postMoneyYen)) / 1株 \(amdOSCompanyOverviewYen(round.pricePerShareYen))", to: body)
        }
        for instrument in data.convertibles {
            appendLine("転換前証券: \(instrument.holderName) / \(instrument.instrumentType) / \(amdOSCompanyOverviewStatus(instrument.status)) / 元本 \(amdOSCompanyOverviewYen(instrument.principalYen)) / 評価上限 \(amdOSCompanyOverviewYen(instrument.valuationCapYen)) / 転換見込 \(amdOSCompanyOverviewNumber(instrument.estimatedConversionShares, digits: 2))株", to: body)
        }

        appendSection("総会・取締役会", to: body)
        if data.meetings.isEmpty { appendLine("総会・取締役会の開催情報は未登録。", to: body) }
        for meeting in data.meetings {
            appendLine("\(amdOSCompanyOverviewDate(meeting.meetingDate ?? meeting.meetingYm)) / \(amdOSCompanyOverviewMeetingLabel(meeting.meetingType))\(meeting.amdResponse?.trimmedNonEmpty.map { " / AMD: \($0)" } ?? "")", to: body, font: .systemFont(ofSize: 11, weight: .semibold))
            if let agenda = meeting.agendaSummary?.trimmedNonEmpty { appendLine("  議題: \(agenda)", to: body) }
            for resolution in meeting.resolutionsJSON ?? [] where resolution.title?.trimmedNonEmpty != nil { appendLine("  決議: \(resolution.title?.trimmedNonEmpty ?? "")", to: body) }
            for attachment in meeting.attachmentsJSON ?? [] where attachment.destination != nil { appendLine("  資料: \(attachment.name?.trimmedNonEmpty ?? "関連資料") / \(attachment.destination ?? "")", to: body) }
        }

        appendSection("年度決算", to: body)
        if data.financialPeriods.isEmpty { appendLine("年度決算は未登録。", to: body) }
        for period in data.financialPeriods {
            appendLine("FY\(period.fiscalYear) / \(amdOSCompanyOverviewStatus(period.statementStatus)) / 売上 \(amdOSCompanyOverviewYen(period.revenueYen)) / 営業利益 \(amdOSCompanyOverviewYen(period.operatingIncomeYen)) / 経常利益 \(amdOSCompanyOverviewYen(period.ordinaryIncomeYen)) / 純利益 \(amdOSCompanyOverviewYen(period.netIncomeYen)) / 総資産 \(amdOSCompanyOverviewYen(period.totalAssetsYen)) / 負債 \(amdOSCompanyOverviewYen(period.totalLiabilitiesYen)) / 純資産 \(amdOSCompanyOverviewYen(period.netAssetsYen)) / 現預金 \(amdOSCompanyOverviewYen(period.cashYen)) / 有利子負債 \(amdOSCompanyOverviewYen(period.debtYen))", to: body)
        }

        appendSection("会社運営の要対応", to: body)
        if data.actionItems.isEmpty { appendLine("確認済みの要対応はない。", to: body) }
        for item in data.actionItems {
            appendLine("\(item.title) / \(item.dueAt.map(amdOSCompanyOverviewDate) ?? "期日なし") / \(item.status)\(item.priority.map { " / 優先度 \($0)" } ?? "")", to: body, font: .systemFont(ofSize: 11, weight: .semibold))
            if let summary = item.summary?.trimmedNonEmpty { appendLine("  \(summary)", to: body) }
        }
        return try paginatedPDF(body)
    }

    private static func appendSection(_ title: String, to text: NSMutableAttributedString) {
        append("\n\(title)\n", to: text, font: .systemFont(ofSize: 14, weight: .bold), color: .labelColor)
    }

    private static func appendLabeled(_ label: String, _ value: String, to text: NSMutableAttributedString) {
        appendLine("\(label): \(value)", to: text)
    }

    private static func appendLine(_ value: String, to text: NSMutableAttributedString, font: NSFont = .systemFont(ofSize: 10), color: NSColor = .labelColor) {
        append("\(value)\n", to: text, font: font, color: color)
    }

    private static func append(_ value: String, to text: NSMutableAttributedString, font: NSFont, color: NSColor) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 2
        paragraph.paragraphSpacing = 3
        text.append(NSAttributedString(string: value, attributes: [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: paragraph,
        ]))
    }

    private static func paginatedPDF(_ text: NSAttributedString) throws -> Data {
        let pageSize = CGSize(width: 595.28, height: 841.89)
        let margin: CGFloat = 42
        let contentSize = CGSize(width: pageSize.width - margin * 2, height: pageSize.height - margin * 2)
        let data = NSMutableData()
        guard let consumer = CGDataConsumer(data: data as CFMutableData) else {
            throw AMDOSNetworkError.http("PDF保存先を準備できなかったよ")
        }
        var mediaBox = CGRect(origin: .zero, size: pageSize)
        guard let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
            throw AMDOSNetworkError.http("PDF本文を作れなかったよ")
        }

        let storage = NSTextStorage(attributedString: text)
        let layout = NSLayoutManager()
        storage.addLayoutManager(layout)
        guard text.length > 0 else { return Data() }
        var nextGlyph = 0
        var pageCount = 0
        while true {
            let container = NSTextContainer(size: contentSize)
            container.lineFragmentPadding = 0
            layout.addTextContainer(container)
            layout.ensureLayout(for: container)
            let glyphRange = layout.glyphRange(for: container)
            guard glyphRange.length > 0 else {
                throw AMDOSNetworkError.http("PDF本文をページへ配置できなかったよ")
            }
            context.beginPDFPage(nil)
            context.saveGState()
            context.translateBy(x: margin, y: pageSize.height - margin)
            context.scaleBy(x: 1, y: -1)
            let graphicsContext = NSGraphicsContext(cgContext: context, flipped: true)
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = graphicsContext
            layout.drawBackground(forGlyphRange: glyphRange, at: .zero)
            layout.drawGlyphs(forGlyphRange: glyphRange, at: .zero)
            NSGraphicsContext.restoreGraphicsState()
            context.restoreGState()
            context.endPDFPage()
            nextGlyph = NSMaxRange(glyphRange)
            pageCount += 1
            if pageCount > 300 { throw AMDOSNetworkError.http("会社概要PDFのページ数が多すぎるよ") }
            if nextGlyph >= layout.numberOfGlyphs { break }
        }
        context.closePDF()
        return data as Data
    }
}

// MARK: - Capital plan workspace (PWA /api/governance/capital-plans parity)

private struct AMDOSCapitalEditableValue: Codable, Sendable { var value: Double; var source: String; var calculatedValue: Double?; var note: String? }
private struct AMDOSCapitalHolder: Codable, Identifiable, Sendable { var id: String; var name: String; var kind: String; var note: String? }
private struct AMDOSCapitalAllocation: Codable, Identifiable, Sendable { var id: String; var holderId: String; var shareClass: String; var shares: AMDOSCapitalEditableValue; var amount: AMDOSCapitalEditableValue?; var pricePerShare: AMDOSCapitalEditableValue?; var targetOwnershipPercentage: AMDOSCapitalEditableValue?; var note: String? }
private struct AMDOSCapitalEvent: Codable, Identifiable, Sendable { var id: String; var type: String; var label: String; var order: Double; var date: String?; var status: String?; var preMoneyValuation: AMDOSCapitalEditableValue?; var postMoneyValuation: AMDOSCapitalEditableValue?; var pricePerShare: AMDOSCapitalEditableValue?; var splitRatio: AMDOSCapitalEditableValue?; var poolSize: AMDOSCapitalEditableValue?; var conversionCap: AMDOSCapitalEditableValue?; var conversionDiscount: AMDOSCapitalEditableValue?; var calculationBasis: String?; var primaryRaise: AMDOSCapitalEditableValue?; var newShares: AMDOSCapitalEditableValue?; var allocations: [AMDOSCapitalAllocation]; var note: String? }
private struct AMDOSCapitalDocument: Codable, Sendable {
    var holders: [AMDOSCapitalHolder]
    var events: [AMDOSCapitalEvent]
    init(holders: [AMDOSCapitalHolder], events: [AMDOSCapitalEvent]) { self.holders = holders; self.events = events }
    enum CodingKeys: String, CodingKey { case holders, events }
    init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); holders = try c.decodeIfPresent([AMDOSCapitalHolder].self, forKey: .holders) ?? []; events = try c.decodeIfPresent([AMDOSCapitalEvent].self, forKey: .events) ?? [] }
}
private struct AMDOSCapitalPlanRow: Codable, Identifiable, Sendable {
    let id: String; let projectId: String; let name: String; let status: String; let revision: Int; let document: AMDOSCapitalDocument; let latestFrozenVersion: Int?
    enum CodingKeys: String, CodingKey { case id, projectId = "project_id", name, status, revision, document = "document_json", latestFrozenVersion = "latest_frozen_version" }
}
private struct AMDOSCapitalVersionValidationIssue: Codable, Sendable { let severity: String?; let code: String?; let message: String? }
private struct AMDOSCapitalVersionValidationSummary: Codable, Sendable {
    let blockingIssues: [AMDOSCapitalVersionValidationIssue]?
    let warnings: [AMDOSCapitalVersionValidationIssue]?
    enum CodingKeys: String, CodingKey { case blockingIssues, warnings }
}
private struct AMDOSCapitalVersionRow: Codable, Identifiable, Sendable {
    let id: String
    let planId: String
    let projectId: String?
    let version: Int
    let document: AMDOSCapitalDocument
    let sourceRevision: Int?
    let validationSummary: AMDOSCapitalVersionValidationSummary?
    let publishedByEmail: String?
    let publishedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, planId = "plan_id", projectId = "project_id", version, document = "document_json"
        case sourceRevision = "source_revision", validationSummary = "validation_summary"
        case publishedByEmail = "published_by_email", publishedAt = "published_at"
    }
}
private struct AMDOSCapitalEnvelope: Codable, Sendable { let ok: Bool; let plans: [AMDOSCapitalPlanRow]?; let versions: [AMDOSCapitalVersionRow]?; let error: String? }
private struct AMDOSCapitalMutationEnvelope: Codable, Sendable { let ok: Bool?; let plan: AMDOSCapitalPlanRow?; let version: AMDOSCapitalVersionRow?; let error: String? }
private struct AMDOSCapitalPost: Encodable, Sendable { let action: String; let projectId: String?; let name: String?; let planId: String?; let sourcePlanId: String?; let expectedRevision: Int?; let version: Int?; let document: AMDOSCapitalDocument?; enum CodingKeys: String, CodingKey { case action, projectId, name, planId, sourcePlanId, expectedRevision, version, document = "document_json" } }
private struct AMDOSCapitalPatch: Encodable, Sendable { let action: String; let planId: String; let expectedRevision: Int; let document: AMDOSCapitalDocument?; let name: String?; enum CodingKeys: String, CodingKey { case action, planId, expectedRevision, document = "document_json", name } }

private enum AMDOSCapitalPlanDocumentFactory {
    private static let currentSnapshotLabel = "現在値取込（履歴未復元）"
    private static let currentSnapshotNote = "確定済みの資本取引履歴が無いため、現時点の株主構成のみを取り込んだスナップショットです。設立時点からの正確な履歴は復元できません。"

    static func standard(incorporationDate: String? = nil) -> AMDOSCapitalDocument {
        let baseDate = incorporationDate ?? todayDateOnly()
        let founder = AMDOSCapitalHolder(id: "founder", name: "創業者", kind: "founder", note: nil)
        let publicMarket = AMDOSCapitalHolder(id: "public-market", name: "公開市場", kind: "other", note: nil)
        let rounds = [
            ("Seed", "investor-seed", "Seed投資家", 300000000.0, 50000000.0, 180),
            ("Series A", "investor-series-a", "Series A投資家", 1500000000.0, 300000000.0, 365),
            ("Series B", "investor-series-b", "Series B投資家", 5000000000.0, 1000000000.0, 545),
            ("Series C", "investor-series-c", "Series C投資家", 15000000000.0, 3000000000.0, 730),
        ]
        var holders = [founder]
        var events = [
            AMDOSCapitalEvent(
                id: "event-incorporation",
                type: "incorporation",
                label: "設立",
                order: 1,
                date: addDaysDateOnly(baseDate, days: 0),
                status: "planned",
                preMoneyValuation: nil,
                postMoneyValuation: nil,
                pricePerShare: nil,
                splitRatio: nil,
                poolSize: nil,
                conversionCap: nil,
                conversionDiscount: nil,
                calculationBasis: "manual",
                primaryRaise: nil,
                newShares: nil,
                allocations: [
                    .init(
                        id: "alloc-incorporation-founder",
                        holderId: founder.id,
                        shareClass: "common",
                        shares: editable(10000, source: "input"),
                        amount: nil,
                        pricePerShare: nil,
                        targetOwnershipPercentage: nil,
                        note: nil
                    ),
                ],
                note: nil
            ),
        ]

        for (offset, round) in rounds.enumerated() {
            let holder = AMDOSCapitalHolder(id: round.1, name: round.2, kind: "investor", note: nil)
            holders.append(holder)
            events.append(
                .init(
                    id: "event-\(round.1)",
                    type: "equity_issue",
                    label: round.0,
                    order: Double(offset + 2),
                    date: addDaysDateOnly(baseDate, days: round.5),
                    status: "planned",
                    preMoneyValuation: editable(round.3, source: "input"),
                    postMoneyValuation: nil,
                    pricePerShare: nil,
                    splitRatio: nil,
                    poolSize: nil,
                    conversionCap: nil,
                    conversionDiscount: nil,
                    calculationBasis: "valuation_and_investment",
                    primaryRaise: nil,
                    newShares: nil,
                    allocations: [
                        .init(
                            id: "alloc-\(round.1)",
                            holderId: holder.id,
                            shareClass: "preferred",
                            shares: editable(0, source: "calculated"),
                            amount: editable(round.4, source: "input"),
                            pricePerShare: editable(0, source: "calculated"),
                            targetOwnershipPercentage: nil,
                            note: nil
                        ),
                    ],
                    note: nil
                )
            )
        }

        holders.append(publicMarket)
        events.append(
            .init(
                id: "event-ipo",
                type: "ipo",
                label: "IPO",
                order: 6,
                date: addDaysDateOnly(baseDate, days: 1095),
                status: "planned",
                preMoneyValuation: editable(30000000000, source: "input"),
                postMoneyValuation: nil,
                pricePerShare: nil,
                splitRatio: nil,
                poolSize: nil,
                conversionCap: nil,
                conversionDiscount: nil,
                calculationBasis: "valuation_and_investment",
                primaryRaise: nil,
                newShares: nil,
                allocations: [
                    .init(
                        id: "alloc-ipo-public-market",
                        holderId: publicMarket.id,
                        shareClass: "common",
                        shares: editable(0, source: "calculated"),
                        amount: editable(5000000000, source: "input"),
                        pricePerShare: editable(0, source: "calculated"),
                        targetOwnershipPercentage: nil,
                        note: nil
                    ),
                ],
                note: nil
            )
        )

        return .init(holders: holders, events: events)
    }

    static func fromCompanyOverview(_ data: AMDOSParityCockpitCompanyEnvelope) -> AMDOSCapitalDocument {
        var holders: [AMDOSCapitalHolder] = []
        var holderIDByName: [String: String] = [:]
        var holderIndex = 0

        func ensureHolderWithKind(_ name: String, kind: String) -> AMDOSCapitalHolder {
            if let existingID = holderIDByName[name], let existing = holders.first(where: { $0.id == existingID }) {
                return existing
            }
            holderIndex += 1
            var id = slugify(name, fallbackIndex: holderIndex)
            while holders.contains(where: { $0.id == id }) {
                id = "\(id)-\(holderIndex)"
            }
            let holder = AMDOSCapitalHolder(id: id, name: name, kind: kind, note: nil)
            holders.append(holder)
            holderIDByName[name] = id
            return holder
        }

        func ensureHolder(_ name: String, holderType: String?) -> AMDOSCapitalHolder {
            ensureHolderWithKind(name, kind: mapHolderKind(holderType))
        }

        var events: [AMDOSCapitalEvent] = []
        let confirmedTransactions = data.transactions
            .filter { $0.status == "confirmed" }
            .sorted { lhs, rhs in
                lhs.effectiveOn == rhs.effectiveOn ? lhs.id < rhs.id : lhs.effectiveOn < rhs.effectiveOn
            }

        var order = 0
        var usedLabelsLowercase = Set<String>()
        var lastHistoryDate: String?

        if !confirmedTransactions.isEmpty {
            for transaction in confirmedTransactions {
                order += 1
                let round = transaction.roundId.flatMap { roundID in data.rounds.first(where: { $0.id == roundID }) }
                let entries = transaction.entries ?? []
                let allocations: [AMDOSCapitalAllocation] = entries.enumerated().map { index, entry in
                    let shareClass = mapShareClass(entry.securityClass)
                    let holder = ensureHolder(entry.holderName ?? "保有者未確認", holderType: entry.holderType)
                    let shares = entrySharesValue(entry, shareClass: shareClass)
                    let amount = entry.paidInYenDelta ?? 0
                    return .init(
                        id: "\(transaction.id)-alloc-\(index)",
                        holderId: holder.id,
                        shareClass: shareClass,
                        shares: editable(shares, source: "imported"),
                        amount: amount != 0 ? editable(amount, source: "imported") : nil,
                        pricePerShare: nil,
                        targetOwnershipPercentage: nil,
                        note: nil
                    )
                }
                let totalShares = entries.reduce(0.0) { $0 + ($1.outstandingDelta ?? 0) }
                let totalAmount = entries.reduce(0.0) { $0 + ($1.paidInYenDelta ?? 0) }
                let label = transactionEventLabel(transaction, round: round)
                usedLabelsLowercase.insert(label.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())

                var noteParts: [String] = []
                if let notes = transaction.notes?.trimmingCharacters(in: .whitespacesAndNewlines), !notes.isEmpty {
                    noteParts.append(notes)
                }
                if let sourceRef = transaction.sourceRef, !sourceRef.isEmpty {
                    noteParts.append("出典: \(sourceRef)")
                }

                var event = AMDOSCapitalEvent(
                    id: transaction.id,
                    type: mapTransactionEventType(transaction.transactionType),
                    label: label,
                    order: Double(order),
                    date: transaction.effectiveOn,
                    status: "confirmed",
                    preMoneyValuation: nil,
                    postMoneyValuation: nil,
                    pricePerShare: nil,
                    splitRatio: nil,
                    poolSize: nil,
                    conversionCap: nil,
                    conversionDiscount: nil,
                    calculationBasis: "manual",
                    primaryRaise: editable(totalAmount, source: "confirmed"),
                    newShares: editable(totalShares, source: "confirmed"),
                    allocations: allocations,
                    note: noteParts.isEmpty ? nil : noteParts.joined(separator: " / ")
                )
                if let preMoneyYen = round?.preMoneyYen {
                    event.preMoneyValuation = editable(preMoneyYen, source: "confirmed")
                }
                if let postMoneyYen = round?.postMoneyYen {
                    event.postMoneyValuation = editable(postMoneyYen, source: "confirmed")
                }
                if let raisedYen = round?.raisedYen {
                    event.primaryRaise = editable(raisedYen, source: "confirmed")
                }
                if let pricePerShareYen = round?.pricePerShareYen {
                    event.pricePerShare = editable(pricePerShareYen, source: "confirmed")
                }
                events.append(event)
            }
            lastHistoryDate = confirmedTransactions.last?.effectiveOn
        } else {
            order += 1
            let currentShareholders = data.shareholders.filter { $0.isCurrent ?? true }
            let allocations: [AMDOSCapitalAllocation] = currentShareholders.enumerated().map { index, row in
                let shareClass = mapShareClass(row.shareClass)
                let holder = ensureHolder(row.holderName, holderType: row.holderType)
                let shares = row.shares ?? 0
                let amount = row.investedYen ?? 0
                return .init(
                    id: "current-shareholder-alloc-\(index)",
                    holderId: holder.id,
                    shareClass: shareClass,
                    shares: editable(shares, source: "imported"),
                    amount: amount != 0 ? editable(amount, source: "imported") : nil,
                    pricePerShare: nil,
                    targetOwnershipPercentage: nil,
                    note: nil
                )
            }
            let totalShares = currentShareholders.reduce(0.0) { $0 + ($1.shares ?? 0) }
            let totalAmount = currentShareholders.reduce(0.0) { $0 + ($1.investedYen ?? 0) }
            let snapshotDate = currentShareholders.compactMap { $0.asOfYm }.max().map { "\($0)-01" } ?? todayDateOnly()
            lastHistoryDate = snapshotDate
            usedLabelsLowercase.insert(currentSnapshotLabel.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
            events.append(
                .init(
                    id: "current-snapshot-incorporation",
                    type: "incorporation",
                    label: currentSnapshotLabel,
                    order: Double(order),
                    date: snapshotDate,
                    status: "confirmed",
                    preMoneyValuation: nil,
                    postMoneyValuation: nil,
                    pricePerShare: nil,
                    splitRatio: nil,
                    poolSize: nil,
                    conversionCap: nil,
                    conversionDiscount: nil,
                    calculationBasis: "manual",
                    primaryRaise: editable(totalAmount, source: "confirmed"),
                    newShares: editable(totalShares, source: "confirmed"),
                    allocations: allocations,
                    note: currentSnapshotNote
                )
            )
        }

        let standard = standard(incorporationDate: lastHistoryDate.map { addDaysDateOnly($0, days: 1) })
        let standardHolderByID = Dictionary(uniqueKeysWithValues: standard.holders.map { ($0.id, $0) })
        var appendOrder = order

        for standardEvent in standard.events {
            if standardEvent.label == "設立" { continue }
            if usedLabelsLowercase.contains(standardEvent.label.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()) {
                continue
            }
            appendOrder += 1
            let remappedAllocations = standardEvent.allocations.map { allocation -> AMDOSCapitalAllocation in
                var remapped = allocation
                if let standardHolder = standardHolderByID[allocation.holderId] {
                    remapped.holderId = ensureHolderWithKind(standardHolder.name, kind: standardHolder.kind).id
                }
                return remapped
            }
            var appendedEvent = standardEvent
            appendedEvent.order = Double(appendOrder)
            appendedEvent.allocations = remappedAllocations
            events.append(appendedEvent)
        }

        return .init(holders: holders, events: events)
    }

    private static func editable(_ value: Double, source: String = "input") -> AMDOSCapitalEditableValue {
        .init(value: value, source: source, calculatedValue: nil, note: nil)
    }

    private static func todayDateOnly() -> String {
        dateString(Date())
    }

    private static func dateString(_ date: Date) -> String {
        let calendar = utcCalendar()
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }

    private static func addDaysDateOnly(_ dateOnly: String, days: Int) -> String {
        let parts = dateOnly.split(separator: "-")
        guard parts.count == 3, let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]) else {
            return dateOnly
        }
        let calendar = utcCalendar()
        guard let baseDate = calendar.date(from: DateComponents(year: year, month: month, day: day)) else {
            return dateOnly
        }
        return dateString(calendar.date(byAdding: .day, value: days, to: baseDate) ?? baseDate)
    }

    private static func utcCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    private static func mapHolderKind(_ holderType: String?) -> String {
        switch holderType ?? "" {
        case "founder", "amd", "masa":
            return "founder"
        case "employee":
            return "employee"
        case "vc", "angel", "corporate":
            return "investor"
        default:
            return "other"
        }
    }

    private static func mapShareClass(_ shareClass: String?) -> String {
        let original = shareClass ?? ""
        let lowercased = original.lowercased()
        if original.contains("優先") || lowercased.contains("preferred") { return "preferred" }
        if original.contains("予約権") || lowercased.contains("option") || lowercased.range(of: "\\bso\\b", options: .regularExpression) != nil { return "option" }
        if original.contains("転換社債") || lowercased.contains("cb") || lowercased.contains("j-kiss") || lowercased.contains("kiss") || lowercased.contains("safe") || lowercased.contains("convertible") { return "convertible" }
        if original.contains("ワラント") || lowercased.contains("warrant") { return "warrant" }
        return "common"
    }

    private static func mapTransactionEventType(_ transactionType: String) -> String {
        switch transactionType {
        case "incorporation":
            return "incorporation"
        case "transfer":
            return "secondary"
        case "stock_option_grant":
            return "option_pool"
        default:
            return "equity_issue"
        }
    }

    private static func slugify(_ name: String, fallbackIndex: Int) -> String {
        var cleaned = ""
        var previousWasSeparator = false
        for scalar in name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().unicodeScalars {
            let value = scalar.value
            let isAllowed = (48...57).contains(value) || (97...122).contains(value) || (0x3040...0x30ff).contains(value) || (0x3400...0x9fff).contains(value)
            if isAllowed {
                cleaned += String(scalar)
                previousWasSeparator = false
            } else if !previousWasSeparator {
                cleaned += "-"
                previousWasSeparator = true
            }
        }
        cleaned = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return cleaned.isEmpty ? "holder-\(fallbackIndex)" : cleaned
    }

    private static func transactionEventLabel(_ transaction: AMDOSParityCockpitEquityTransaction, round: AMDOSParityCockpitValuationRound?) -> String {
        if let roundName = round?.roundName?.trimmingCharacters(in: .whitespacesAndNewlines), !roundName.isEmpty {
            return roundName
        }
        if let description = transaction.description?.trimmingCharacters(in: .whitespacesAndNewlines), !description.isEmpty {
            return description
        }
        return transactionLabels[transaction.transactionType] ?? transaction.transactionType
    }

    private static func entrySharesValue(_ entry: AMDOSParityCockpitEquityEntry, shareClass: String) -> Double {
        switch shareClass {
        case "option", "convertible", "warrant":
            return entry.dilutedDelta ?? 0
        default:
            return entry.outstandingDelta ?? 0
        }
    }

    private static let transactionLabels: [String: String] = [
        "opening_balance": "開始残高",
        "incorporation": "設立",
        "new_issue": "新株発行",
        "transfer": "株式譲渡",
        "stock_option_grant": "SO付与",
        "stock_option_exercise": "SO行使",
        "split": "株式分割",
        "consolidation": "株式併合",
        "cancellation": "消却・失効",
        "correction": "訂正",
        "in_kind_contribution": "現物出資",
    ]
}

private struct AMDOSParityCapitalPlanWorkspace: View {
    let projectId: String
    let projectName: String
    let companyOverviewData: AMDOSParityCockpitCompanyEnvelope?
    @State private var plans: [AMDOSCapitalPlanRow] = []
    @State private var versions: [AMDOSCapitalVersionRow] = []
    @State private var selectedPlanID = ""
    @State private var document = AMDOSCapitalDocument(holders: [], events: [])
    @State private var revision = 1
    @State private var planName = ""
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var saveState = "idle"
    @State private var dirty = false
    @State private var message: String?
    @State private var conflictPlan: AMDOSCapitalPlanRow?
    @State private var dirtyGeneration = 0
    @State private var persistedGeneration = 0
    @State private var saveInFlight = false
    @State private var busyAction: String?
    @State private var deriveError: String?
    var body: some View {
        AMDOSSectionCard("資本政策", systemImage: "chart.pie") {
            HStack {
                Picker("プラン", selection: Binding(get: { selectedPlanID }, set: { requestSelect($0) })) { Text("選んでね").tag(""); ForEach(plans) { Text("\($0.name) · r\($0.revision) · \($0.status)").tag($0.id) } }
                Button("+ IPOまでの標準プラン") { createStandard() }.buttonStyle(.borderedProminent).disabled(busyAction == "create_standard")
                Button("+ 確定履歴から作成") { createFromConfirmedHistory() }.buttonStyle(.bordered).disabled(busyAction == "create_from_overview")
                Button("+ 空のプラン") { createEmpty() }.buttonStyle(.bordered).disabled(busyAction == "create_blank")
                Button("複製") { duplicate() }.buttonStyle(.bordered).disabled(selectedPlanID.isEmpty)
                if let selectedPlan {
                    Button(selectedPlan.status == "active" ? "アーカイブ" : "復元") { archiveOrRestore(selectedPlan.status == "active" ? "archived" : "active") }.buttonStyle(.bordered).disabled(busyAction != nil)
                    Button("提出版を確定") { freeze() }.buttonStyle(.borderedProminent).disabled(deriveError != nil || !freezeEligible || dirty || saveInFlight || saveState == "conflict" || saveState == "error" || busyAction != nil)
                }
                Spacer(); Text(saveStateLabel).font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            AMDOSStateNotice(state: state) { load() }
            if !selectedPlanID.isEmpty {
                TextField("プラン名", text: $planName).textFieldStyle(.roundedBorder).onSubmit { rename() }
                Text("保有者 \(document.holders.count)人 · イベント \(document.events.count)件 · revision \(revision)").font(.caption).foregroundStyle(AMDOSDesign.muted)
                if let deriveError { Text(deriveError).font(.caption).foregroundStyle(AMDOSDesign.warning) }
                Text("資本政策マトリクス・検算・凍結版はこのプランを正本として編集する。保存は800ms後にPWA APIへ直列送信する。") .font(.caption).foregroundStyle(AMDOSDesign.muted)
                AMDOSCapitalMatrixEditor(document: $document) { markDirty($0) }
                if let conflictPlan { AMDOSSectionCard("保存競合", systemImage: "exclamationmark.triangle") { Text("サーバー revision \(conflictPlan.revision) と競合したよ"); HStack { Button("ローカルを破棄") { acceptServer(conflictPlan) }; Button("最新revisionへ上書き") { forceSave(conflictPlan) }.buttonStyle(.borderedProminent) } } }
                AMDOSSectionCard("確定済み提出版", systemImage: "lock") {
                    if versions.isEmpty { Text("まだ確定された提出版はないよ").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    ForEach(versions.filter { $0.planId == selectedPlanID }) { version in
                        HStack {
                            Text("v\(version.version)").fontWeight(.semibold)
                            Text(publishedVersionLabel(version)).font(.caption).foregroundStyle(AMDOSDesign.muted)
                            Spacer()
                            Button("VC提出用Excel") { export(version: version) }.buttonStyle(.bordered).disabled(busyAction != nil)
                            Button("この版を復元") { restore(version: version.version) }.buttonStyle(.bordered).disabled(busyAction != nil)
                        }
                    }
                }
            } else {
                VStack(spacing: 8) {
                    Text("\(projectName) にはまだ資本政策プランがありません。「+ IPOまでの標準プラン」「+ 確定履歴から作成」「+ 空のプラン」のいずれかから作成してください。")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(AMDOSDesign.muted.opacity(0.45), style: StrokeStyle(lineWidth: 1, dash: [5])))
            }
            if let message { Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled) }
        }.task { load() }
    }
    private var selectedPlan: AMDOSCapitalPlanRow? { plans.first(where: { $0.id == selectedPlanID }) }
    private var freezeEligible: Bool {
        AMDOSCapitalPlanMath.publishEligibility(document: document).eligible
    }
    private var saveStateLabel: String { if deriveError != nil { return dirty ? "算出エラー（入力を保存）" : "算出エラー" }; return dirty ? (saveState == "saving" ? "保存中…" : "未保存") : (saveState == "saved" ? "保存済み" : "") }
    private func publishedVersionLabel(_ version: AMDOSCapitalVersionRow) -> String {
        let publisher = version.publishedByEmail ?? "公開者未確認"
        guard let publishedAt = version.publishedAt else { return "公開日時未確認 / \(publisher)" }
        let parser = ISO8601DateFormatter()
        guard let date = parser.date(from: publishedAt) else { return "\(publishedAt) / \(publisher)" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.dateStyle = .medium
        formatter.timeStyle = .medium
        return "\(formatter.string(from: date)) / \(publisher)"
    }
    private func load() { Task { state = .loading; do { let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSCapitalEnvelope.self, path: "/api/governance/capital-plans", query: ["projectId": projectId]); guard response.ok else { throw AMDOSNetworkError.http(response.error ?? "資本政策を読み込めなかったよ") }; plans = response.plans ?? []; versions = response.versions ?? []; if selectedPlanID.isEmpty { selectPlan(plans.first?.id ?? "") }; state = plans.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
    private func selectPlan(_ id: String) { guard let row = plans.first(where: { $0.id == id }) else { return }; selectedPlanID = id; applyDerivedDocument(row.document); revision = row.revision; planName = row.name; dirty = false; saveState = "idle"; conflictPlan = nil }
    private func requestSelect(_ id: String) { guard id != selectedPlanID else { return }; Task { guard await flushPendingSave() else { return }; selectPlan(id) } }
    private func createEmpty() {
        create(name: "新規資本政策プラン", document: .init(holders: [], events: []), busyActionKey: "create_blank")
    }

    private func createStandard() {
        create(name: "IPOまでの標準プラン", document: AMDOSCapitalPlanDocumentFactory.standard(), busyActionKey: "create_standard")
    }

    private func createFromConfirmedHistory() {
        let document = companyOverviewData.map { AMDOSCapitalPlanDocumentFactory.fromCompanyOverview($0) } ?? AMDOSCapitalPlanDocumentFactory.standard()
        create(name: "確定履歴から作成したプラン", document: document, busyActionKey: "create_from_overview")
    }

    private func create(name: String, document: AMDOSCapitalDocument, busyActionKey: String) {
        Task {
            guard await flushPendingSave() else { return }
            busyAction = busyActionKey
            defer { busyAction = nil }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/governance/capital-plans",
                    body: AMDOSCapitalPost(
                        action: "create",
                        projectId: projectId,
                        name: name,
                        planId: nil,
                        sourcePlanId: nil,
                        expectedRevision: nil,
                        version: nil,
                        document: document
                    )
                )
                let response = try JSONDecoder().decode(AMDOSCapitalMutationEnvelope.self, from: data)
                guard let plan = response.plan, response.ok == true else {
                    throw AMDOSNetworkError.http(response.error ?? "新規作成失敗")
                }
                plans.insert(plan, at: 0)
                selectPlan(plan.id)
            } catch {
                message = error.localizedDescription
            }
        }
    }
    private func duplicate() { guard let source = plans.first(where: { $0.id == selectedPlanID }) else { return }; Task { guard await flushPendingSave() else { return }; do { let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance/capital-plans", body: AMDOSCapitalPost(action: "duplicate", projectId: nil, name: "\(source.name) コピー", planId: nil, sourcePlanId: source.id, expectedRevision: nil, version: nil, document: nil)); let response = try JSONDecoder().decode(AMDOSCapitalMutationEnvelope.self, from: data); guard let plan = response.plan, response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "複製失敗") }; plans.insert(plan, at: 0); selectPlan(plan.id) } catch { message = error.localizedDescription } } }
    private func rename() { guard !selectedPlanID.isEmpty else { return }; Task { guard await flushPendingSave() else { return }; do { let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance/capital-plans", method: "PATCH", body: AMDOSCapitalPatch(action: "rename", planId: selectedPlanID, expectedRevision: revision, document: nil, name: planName)); try apply(data) } catch { handle(error) } } }
    private func markDirty(_ next: AMDOSCapitalDocument) {
        applyDerivedDocument(next)
        dirty = true
        dirtyGeneration += 1
        queueSave()
    }
    private func queueSave() { guard dirty, !saveInFlight, !selectedPlanID.isEmpty else { return }; let generation = dirtyGeneration; let id = selectedPlanID; let rev = revision; let snapshot = document; Task { try? await Task.sleep(nanoseconds: 800_000_000); guard !saveInFlight, dirty, generation == dirtyGeneration, id == selectedPlanID, rev == revision else { return }; saveInFlight = true; saveState = "saving"; do { let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance/capital-plans", method: "PATCH", body: AMDOSCapitalPatch(action: "save", planId: id, expectedRevision: rev, document: snapshot, name: nil)); try apply(data, generation: generation) } catch { handle(error) }; saveInFlight = false; if dirty, saveState != "conflict", saveState != "error" { queueSave() } } }
    private func flushPendingSave() async -> Bool { while dirty || saveInFlight { if !saveInFlight { queueSave() }; try? await Task.sleep(nanoseconds: 100_000_000); if saveState == "conflict" || saveState == "error" { return false } }; return true }
    private func apply(_ data: Data, generation: Int? = nil) throws {
        let response = try JSONDecoder().decode(AMDOSCapitalMutationEnvelope.self, from: data)
        guard let plan = response.plan, response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "保存失敗") }
        plans = plans.map { $0.id == plan.id ? plan : $0 }
        if plan.id == selectedPlanID {
            revision = plan.revision
            planName = plan.name
            if generation == nil || generation == dirtyGeneration {
                applyDerivedDocument(plan.document)
                dirty = false
                persistedGeneration = generation ?? dirtyGeneration
                saveState = "saved"
            }
        }
    }
    private func applyDerivedDocument(_ authored: AMDOSCapitalDocument) {
        switch AMDOSCapitalPlanMath.safeDerive(document: authored) {
        case .success(let derived): document = derived; deriveError = nil
        case .failure(let error): document = authored; deriveError = error.localizedDescription
        }
    }
    private func handle(_ error: Error) { if case AMDOSNetworkError.httpStatus(let status, let body) = error, status == 409, let response = try? JSONDecoder().decode(AMDOSCapitalMutationEnvelope.self, from: Data(body.utf8)), let plan = response.plan { conflictPlan = plan; saveState = "conflict"; message = response.error } else { saveState = "error"; message = error.localizedDescription } }
    private func acceptServer(_ plan: AMDOSCapitalPlanRow) { plans = plans.map { $0.id == plan.id ? plan : $0 }; selectPlan(plan.id) }
    private func forceSave(_ plan: AMDOSCapitalPlanRow) { conflictPlan = nil; revision = plan.revision; dirty = true; queueSave() }
    private func archiveOrRestore(_ status: String) {
        guard !selectedPlanID.isEmpty else { return }
        Task {
            guard await flushPendingSave() else { return }
            busyAction = status
            defer { busyAction = nil }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance/capital-plans", method: "PATCH", body: AMDOSCapitalPatch(action: status == "archived" ? "archive" : "restore", planId: selectedPlanID, expectedRevision: revision, document: nil, name: nil))
                try apply(data)
                await reloadSelectedPlan()
            } catch { handle(error) }
        }
    }
    private func freeze() {
        guard !selectedPlanID.isEmpty, freezeEligible else { return }
        Task {
            guard await flushPendingSave() else { return }
            busyAction = "freeze"
            defer { busyAction = nil }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance/capital-plans", body: AMDOSCapitalPost(action: "freeze", projectId: nil, name: nil, planId: selectedPlanID, sourcePlanId: nil, expectedRevision: revision, version: nil, document: nil))
                try apply(data)
                await reloadSelectedPlan()
            } catch { handle(error) }
        }
    }
    private func export(version: AMDOSCapitalVersionRow) {
        guard version.planId == selectedPlanID, busyAction == nil else { return }
        let busyKey = "export_\(version.version)"
        let filename = "\(sanitizedExportPlanName(selectedPlan?.name ?? planName))_v\(version.version).xlsx"
        busyAction = busyKey
        Task {
            defer { busyAction = nil }
            guard await flushPendingSave() else { return }
            do {
                let data = try await AMDOSRESTClient.shared.fetchPWAData(
                    path: "/api/governance/capital-plans/export",
                    query: ["planId": version.planId, "version": String(version.version)]
                )
                guard let xlsxType = UTType(filenameExtension: "xlsx") else {
                    throw AMDOSNetworkError.http("Excel保存形式を準備できなかったよ")
                }
                let panel = NSSavePanel()
                panel.nameFieldStringValue = filename
                panel.allowedContentTypes = [xlsxType]
                guard panel.runModal() == .OK, let url = panel.url else { return }
                try data.write(to: url, options: .atomic)
                message = "VC提出用Excelを保存したよ"
            } catch {
                message = error.localizedDescription
            }
        }
    }
    private func sanitizedExportPlanName(_ name: String) -> String {
        let invalidFilenameCharacters = CharacterSet(charactersIn: "\\/:*?\"<>|")
        return name.unicodeScalars.map { invalidFilenameCharacters.contains($0) ? "_" : String($0) }.joined()
    }
    private func restore(version: Int) {
        guard !selectedPlanID.isEmpty else { return }
        Task {
            guard await flushPendingSave() else { return }
            busyAction = "restore_version_\(version)"
            defer { busyAction = nil }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance/capital-plans", body: AMDOSCapitalPost(action: "restore_version", projectId: nil, name: nil, planId: selectedPlanID, sourcePlanId: nil, expectedRevision: revision, version: version, document: nil))
                try apply(data)
                await reloadSelectedPlan()
            } catch { handle(error) }
        }
    }
    private func reloadSelectedPlan() async {
        guard !selectedPlanID.isEmpty else { return }
        do {
            let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSCapitalEnvelope.self, path: "/api/governance/capital-plans", query: ["projectId": projectId, "planId": selectedPlanID])
            guard response.ok, let plan = response.plans?.first else { throw AMDOSNetworkError.http(response.error ?? "資本政策を再読み込みできなかったよ") }
            plans = plans.map { $0.id == plan.id ? plan : $0 }
            versions = response.versions ?? []
            selectPlan(plan.id)
        } catch { handle(error) }
    }
}

private enum AMDOSCapitalDeletion: Identifiable { case event(String), holder(String), allocation(String); var id: String { switch self { case .event(let id): return "event-\(id)"; case .holder(let id): return "holder-\(id)"; case .allocation(let id): return "allocation-\(id)" } } }
private struct AMDOSCapitalMatrixEditor: View {
    @Binding var document: AMDOSCapitalDocument
    let changed: (AMDOSCapitalDocument) -> Void
    @State private var selectedEventID: String?
    @State private var pendingDeletion: AMDOSCapitalDeletion?
    @State private var directEditError: String?
    private let eventTypes = ["incorporation", "equity_issue", "option_pool", "convertible_issue", "convertible_conversion", "secondary", "share_split", "ipo"]
    private let bases = ["valuation_and_investment", "price_and_shares", "ownership_target", "manual"]
    private var calculation: Result<AMDOSCapitalDocument, AMDOSCapitalDeriveError> {
        AMDOSCapitalPlanMath.safeDerive(document: document)
    }
    private var derivedDocument: AMDOSCapitalDocument {
        if case .success(let derived) = calculation { return derived }
        return document
    }
    var body: some View {
        AMDOSSectionCard("資本イベント・株主台帳・割当", systemImage: "tablecells") {
            HStack { Button("保有者追加") { addHolder() }; Button("イベント追加") { addEvent() } }
            Picker("選択イベント", selection: Binding(get: { selectedEventID ?? document.events.sorted(by: { $0.order < $1.order }).first?.id ?? "" }, set: { selectedEventID = $0 })) { Text("イベントを選んで").tag(""); ForEach(document.events.sorted(by: { $0.order < $1.order })) { Text("\($0.label) · \($0.status ?? "planned")").tag($0.id) } }.disabled(document.events.isEmpty)
            if case .failure(let error) = calculation {
                Text(error.localizedDescription).font(.caption).foregroundStyle(AMDOSDesign.warning)
                Text("入力内容はそのまま保存される。計算表示だけを止めているよ。") .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(AMDOSCapitalPlanMath.validate(document: document), id: \.self) { Text($0).font(.caption).foregroundStyle(AMDOSDesign.warning) }
            if let directEditError { Text(directEditError).font(.caption).foregroundStyle(AMDOSDesign.warning) }
            capitalMatrix
            if let eventIndex = selectedIndex {
                eventEditor(eventIndex)
            }
            Divider()
            Text("株主台帳（全イベント共通）").font(.headline)
            ForEach(document.holders.indices, id: \.self) { index in
                HStack { TextField("氏名/名称", text: holderName(index)).textFieldStyle(.roundedBorder); Picker("種別", selection: holderKind(index)) { ForEach(["founder", "employee", "investor", "esop_pool", "advisor", "other"], id: \.self) { Text($0).tag($0) } }.frame(width: 110); TextField("備考", text: holderNote(index)).textFieldStyle(.roundedBorder); Button("削除", role: .destructive) { pendingDeletion = .holder(document.holders[index].id) } }
            }
        }
        .confirmationDialog("削除の確認", isPresented: Binding(get: { pendingDeletion != nil }, set: { if !$0 { pendingDeletion = nil } })) { Button("削除", role: .destructive) { performDeletion() }; Button("キャンセル", role: .cancel) {} } message: { Text(deletionMessage) }
    }
    @ViewBuilder private var capitalMatrix: some View {
        let events = document.events.sorted(by: { $0.order < $1.order })
        let snapshots = AMDOSCapitalPlanMath.snapshots(document: derivedDocument)
        AMDOSSectionCard("全ラウンド・キャップテーブル", systemImage: "tablecells") {
            if events.isEmpty { Text("資本イベントを追加すると、ここでラウンド横断の検算ができるよ").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            HStack(spacing: 8) { ForEach(Array(document.holders.enumerated()), id: \.element.id) { index, holder in HStack(spacing: 4) { Circle().fill(holderColor(index)).frame(width: 8, height: 8); Text(holder.name).font(.caption) } } }
            HStack(alignment: .top, spacing: 0) {
                VStack(alignment: .leading, spacing: 0) {
                        matrixLabel("資本イベント"); matrixLabel("FD構成"); matrixLabel("算定方式"); matrixLabel("プレマネー"); matrixLabel("調達額"); matrixLabel("ポストマネー"); matrixLabel("1株価格"); matrixLabel("新規発行株式"); matrixLabel("オプションプール"); matrixLabel("株式分割"); matrixLabel("転換上限額"); matrixLabel("転換割引")
                        ForEach(document.holders) { holder in matrixLabel("\(holder.name)｜金額"); matrixLabel("\(holder.name)｜イベント株数"); matrixLabel("\(holder.name)｜発行済"); matrixLabel("\(holder.name)｜FD株数"); matrixLabel("\(holder.name)｜FD%") }
                        matrixLabel("発行済合計"); matrixLabel("FD合計")
                }.frame(width: 156, alignment: .leading).background(Color(nsColor: .windowBackgroundColor))
                ScrollView([.horizontal, .vertical]) { HStack(alignment: .top, spacing: 0) { ForEach(events) { event in matrixColumn(event, snapshot: snapshots.first(where: { $0.eventID == event.id })) } }.overlay(Rectangle().fill(.gray.opacity(0.2)).frame(height: 1), alignment: .top) }.frame(maxHeight: 620)
            }
        }
    }
    @ViewBuilder private func matrixColumn(_ event: AMDOSCapitalEvent, snapshot: AMDOSCapitalRoundSnapshot?) -> some View {
        let index = document.events.firstIndex(where: { $0.id == event.id }) ?? 0
        VStack(alignment: .leading, spacing: 0) {
            Button { selectedEventID = event.id } label: { VStack(alignment: .leading, spacing: 2) { Text(event.label).font(.caption).fontWeight(.semibold); Text(event.date ?? "—").font(.caption2); Text(event.status == "confirmed" ? "確定" : "計画").font(.caption2) } }.buttonStyle(.plain).frame(height: 54, alignment: .leading).padding(8).background(selectedEventID == event.id ? Color.blue.opacity(0.12) : .clear)
            fdBar(snapshot).frame(height: 34).padding(.horizontal, 8)
            if ["equity_issue", "ipo"].contains(event.type) { Picker("", selection: eventBasis(index)) { ForEach(bases, id: \.self) { Text($0).tag($0) } }.labelsHidden().frame(height: 32) } else { matrixText("—") }
            if ["equity_issue", "ipo"].contains(event.type) { if event.calculationBasis == "price_and_shares" { matrixOutput(event.preMoneyValuation, binding: eventValue(index, \.preMoneyValuation), write: { updateEventValue(index, path: \.preMoneyValuation, value: $0) }, clear: { clearEventValue(index, path: \.preMoneyValuation) }) } else { matrixEditable(event.preMoneyValuation, binding: eventValue(index, \.preMoneyValuation), editable: true) } } else { matrixText("—") }
            if ["equity_issue", "ipo"].contains(event.type) { matrixOutput(event.primaryRaise, binding: eventValue(index, \.primaryRaise), write: { outputEventValue(index, path: \.primaryRaise, value: $0) }, clear: { clearEventValue(index, path: \.primaryRaise) }) } else { matrixText("—") }
            if ["equity_issue", "ipo"].contains(event.type) { matrixOutput(event.postMoneyValuation, binding: eventValue(index, \.postMoneyValuation), write: { outputEventValue(index, path: \.postMoneyValuation, value: $0) }, clear: { clearEventValue(index, path: \.postMoneyValuation) }) } else { matrixText("—") }
            if ["equity_issue", "convertible_conversion", "ipo", "secondary"].contains(event.type) { if event.calculationBasis == "manual" || event.calculationBasis == "price_and_shares" { matrixEditable(event.pricePerShare, binding: eventValue(index, \.pricePerShare), editable: true) } else { matrixOutput(event.pricePerShare, binding: eventValue(index, \.pricePerShare), write: { updateEventValue(index, path: \.pricePerShare, value: $0) }, clear: { clearEventValue(index, path: \.pricePerShare) }) } } else { matrixText("—") }
            if ["incorporation", "equity_issue", "convertible_conversion", "ipo"].contains(event.type) { matrixOutput(event.newShares, binding: eventValue(index, \.newShares), write: { outputEventValue(index, path: \.newShares, value: $0) }, clear: { clearEventValue(index, path: \.newShares) }) } else { matrixText("—") }
            if event.type == "option_pool" { matrixEditable(event.poolSize, binding: eventValue(index, \.poolSize), editable: true) } else { matrixText("—") }
            if event.type == "share_split" { matrixEditable(event.splitRatio, binding: eventValue(index, \.splitRatio), editable: true) } else { matrixText("—") }
            if event.type == "convertible_issue" { matrixEditable(event.conversionCap, binding: eventValue(index, \.conversionCap), editable: true) } else { matrixText("—") }
            if event.type == "convertible_issue" { matrixEditable(event.conversionDiscount, binding: eventValue(index, \.conversionDiscount), editable: true) } else { matrixText("—") }
            ForEach(document.holders) { holder in matrixHolderRows(eventIndex: index, event: event, holder: holder, snapshot: snapshot) }
            matrixText(snapshot.map { String(Int($0.totalIssued)) } ?? "—")
            matrixText(snapshot.map { String(Int($0.totalFullyDiluted)) } ?? "—")
        }.frame(width: 144, alignment: .leading).overlay(Rectangle().fill(.gray.opacity(0.18)).frame(width: 1), alignment: .leading)
    }
    @ViewBuilder private func matrixHolderRows(eventIndex: Int, event: AMDOSCapitalEvent, holder: AMDOSCapitalHolder, snapshot: AMDOSCapitalRoundSnapshot?) -> some View {
        let allocations = event.allocations.filter { $0.holderId == holder.id }
        let amount = allocations.reduce(0) { $0 + ($1.amount?.value ?? 0) }
        let shares = allocations.reduce(0) { $0 + $1.shares.value }
        let targetAllocation = allocations.first(where: { $0.targetOwnershipPercentage != nil })
        let standing = snapshot?.holders.first(where: { $0.id == holder.id })
        let basis = event.calculationBasis ?? "manual"
        let amountEditable = ["equity_issue", "ipo", "secondary", "convertible_issue"].contains(event.type) && (basis == "manual" || basis == "valuation_and_investment" || !["equity_issue", "ipo"].contains(event.type))
        let sharesEditable = event.type != "share_split" && (basis == "manual" || basis == "price_and_shares" || !["equity_issue", "ipo", "convertible_conversion"].contains(event.type))
        matrixAggregateEdit(matrixAmountBinding(eventIndex, holder.id), value: allocations.isEmpty ? nil : amount, editable: amountEditable)
        matrixAggregateEdit(matrixSharesBinding(eventIndex, holder.id), value: allocations.isEmpty ? nil : shares, editable: sharesEditable)
        matrixText(standing.map { String(Int($0.issued)) } ?? "—")
        matrixText(standing.map { String(Int($0.fullyDiluted)) } ?? "—")
        if basis == "ownership_target" { HStack(spacing: 2) { matrixAggregateEdit(matrixTargetBinding(eventIndex, holder.id), value: targetAllocation?.targetOwnershipPercentage.map { $0.value * 100 }, editable: true, suffix: "%"); if targetAllocation != nil { Button("✕") { clearMatrixTarget(eventIndex, holder.id) }.font(.caption2) } } } else { matrixText(standing.map { String(format: "%.2f%%", $0.fullyDilutedRatio * 100) } ?? "—") }
    }
    @ViewBuilder private func matrixLabel(_ text: String) -> some View { Text(text).font(.caption2).foregroundStyle(AMDOSDesign.muted).frame(height: 32, alignment: .leading).padding(.horizontal, 8).overlay(Rectangle().fill(.gray.opacity(0.12)).frame(height: 1), alignment: .bottom) }
    @ViewBuilder private func matrixText(_ value: AMDOSCapitalEditableValue?) -> some View { matrixText("\(matrixNumber(value)) \(sourceBadge(value))") }
    @ViewBuilder private func matrixText(_ text: String) -> some View { Text(text).font(.caption2).lineLimit(1).frame(height: 32, alignment: .leading).padding(.horizontal, 8).overlay(Rectangle().fill(.gray.opacity(0.12)).frame(height: 1), alignment: .bottom) }
    @ViewBuilder private func matrixEditable(_ value: AMDOSCapitalEditableValue?, binding: Binding<Double>, editable: Bool) -> some View { if editable { TextField("", value: binding, format: .number).textFieldStyle(.plain).font(.caption2).frame(height: 32).padding(.horizontal, 8).overlay(Rectangle().fill(.gray.opacity(0.12)).frame(height: 1), alignment: .bottom) } else { matrixText(value) } }
    @ViewBuilder private func matrixOutput(_ value: AMDOSCapitalEditableValue?, binding: Binding<Double>, write: @escaping (Double) -> Void, clear: @escaping () -> Void) -> some View { HStack(spacing: 2) { TextField("", value: Binding(get: { binding.wrappedValue }, set: { write($0) }), format: .number).textFieldStyle(.plain).font(.caption2); VStack(alignment: .leading, spacing: 0) { Text(sourceBadge(value)).font(.caption2).foregroundStyle(AMDOSDesign.muted); if value?.source == "override", let base = value?.calculatedValue { Text("基準 \(base.formatted())").font(.caption2).foregroundStyle(AMDOSDesign.muted) } }; if value?.source == "override" { Button("✕") { clear() }.font(.caption2) } }.frame(height: 32).padding(.horizontal, 8).overlay(Rectangle().fill(.gray.opacity(0.12)).frame(height: 1), alignment: .bottom) }
    @ViewBuilder private func matrixAggregateEdit(_ binding: Binding<Double>, value: Double?, editable: Bool, suffix: String = "") -> some View { if editable { HStack(spacing: 1) { TextField("", value: binding, format: .number).textFieldStyle(.plain).font(.caption2); Text(suffix).font(.caption2) }.frame(height: 32).padding(.horizontal, 8).overlay(Rectangle().fill(.gray.opacity(0.12)).frame(height: 1), alignment: .bottom) } else { matrixText(value.map { String($0) } ?? "—") } }
    @ViewBuilder private func fdBar(_ snapshot: AMDOSCapitalRoundSnapshot?) -> some View { GeometryReader { proxy in HStack(spacing: 1) { ForEach(snapshot?.holders ?? []) { standing in Rectangle().fill(holderColor(document.holders.firstIndex(where: { $0.id == standing.id }) ?? 0)).frame(width: max(1, proxy.size.width * standing.fullyDilutedRatio)) } } } }
    private func matrixNumber(_ value: AMDOSCapitalEditableValue?) -> String { value.map { $0.value.formatted() } ?? "—" }
    private func holderColor(_ index: Int) -> Color { [Color.blue, .red, .green, .orange, .purple, .cyan, .pink, .mint][index % 8] }
    @ViewBuilder private func eventEditor(_ index: Int) -> some View {
        let event = document.events[index]
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text("イベント詳細").font(.headline); Spacer(); Button("このイベントを削除", role: .destructive) { pendingDeletion = .event(event.id) } }
            HStack { TextField("イベント名", text: eventLabel(index)).textFieldStyle(.roundedBorder); TextField("日付 YYYY-MM-DD", text: eventDate(index)).textFieldStyle(.roundedBorder); TextField("順序", value: eventOrder(index), format: .number).textFieldStyle(.roundedBorder).frame(width: 90) }
            HStack { Picker("種類", selection: eventType(index)) { ForEach(eventTypes, id: \.self) { Text($0).tag($0) } }; Picker("状態", selection: eventStatus(index)) { Text("計画").tag("planned"); Text("確定").tag("confirmed") }; if event.type == "convertible_conversion" { Text("計算基準: manual（転換は固定）").font(.caption) } else { Picker("計算基準", selection: eventBasis(index)) { ForEach(bases, id: \.self) { Text($0).tag($0) } } } }
            TextField("備考", text: eventNote(index)).textFieldStyle(.roundedBorder)
            HStack { editableField("プレマネー", eventValue(index, \.preMoneyValuation), source: event.preMoneyValuation, onChange: { updateEventValue(index, path: \.preMoneyValuation, value: $0) }, onClearOverride: { clearEventValue(index, path: \.preMoneyValuation) }); editableField("株価", eventValue(index, \.pricePerShare), source: event.pricePerShare, onChange: { updateEventValue(index, path: \.pricePerShare, value: $0) }, onClearOverride: { clearEventValue(index, path: \.pricePerShare) }); editableField("ポストマネー", eventValue(index, \.postMoneyValuation), source: event.postMoneyValuation, onClearOverride: { clearEventValue(index, path: \.postMoneyValuation) }); editableField("調達額", eventValue(index, \.primaryRaise), source: event.primaryRaise, onClearOverride: { clearEventValue(index, path: \.primaryRaise) }); editableField("新規株数", eventValue(index, \.newShares), source: event.newShares, onClearOverride: { clearEventValue(index, path: \.newShares) }) }
            HStack { if event.type == "option_pool" { editableField("プール株数", eventValue(index, \.poolSize), onChange: { setEventValue(index, path: \.poolSize, value: $0) }) }; if event.type == "share_split" { editableField("分割比率", eventValue(index, \.splitRatio), onChange: { setEventValue(index, path: \.splitRatio, value: $0) }) }; if event.type == "convertible_issue" { editableField("転換上限額", eventValue(index, \.conversionCap), onChange: { setEventValue(index, path: \.conversionCap, value: $0) }); editableField("転換割引", eventValue(index, \.conversionDiscount), onChange: { setEventValue(index, path: \.conversionDiscount, value: $0) }) } }
            Divider(); HStack { Text("このイベントの割当").font(.headline); Spacer(); Button("割当追加") { addAllocation(index) }.disabled(document.holders.isEmpty) }
            ForEach(document.events[index].allocations.indices, id: \.self) { allocationIndex in allocationEditor(eventIndex: index, allocationIndex: allocationIndex) }
        }
    }
    @ViewBuilder private func allocationEditor(eventIndex: Int, allocationIndex: Int) -> some View {
        let event = document.events[eventIndex], allocation = event.allocations[allocationIndex]
        VStack(alignment: .leading, spacing: 5) {
            HStack { Picker("株主", selection: allocationHolder(eventIndex, allocationIndex)) { ForEach(document.holders) { Text($0.name).tag($0.id) } }; Picker("種類", selection: allocationClass(eventIndex, allocationIndex)) { ForEach(["common", "preferred", "option", "convertible", "warrant"], id: \.self) { Text($0).tag($0) } }; Button("削除", role: .destructive) { pendingDeletion = .allocation(allocation.id) } }
            HStack { editableField("株数", allocationValue(eventIndex, allocationIndex, \.shares), source: allocation.shares); editableOptionalField("金額", allocationOptionalValue(eventIndex, allocationIndex, \.amount), source: allocation.amount, onClear: { clearAllocationValue(eventIndex, allocationIndex, \.amount) }, onClearOverride: { clearAllocationValue(eventIndex, allocationIndex, \.amount) }); editableOptionalField("1株価格", allocationOptionalValue(eventIndex, allocationIndex, \.pricePerShare), source: allocation.pricePerShare, onClear: { clearAllocationValue(eventIndex, allocationIndex, \.pricePerShare) }, onClearOverride: { clearAllocationValue(eventIndex, allocationIndex, \.pricePerShare) }); editableOptionalField("目標持分%", allocationOptionalValue(eventIndex, allocationIndex, \.targetOwnershipPercentage), source: allocation.targetOwnershipPercentage, multiplier: 100, onClear: { clearAllocationValue(eventIndex, allocationIndex, \.targetOwnershipPercentage) }, onClearOverride: { clearAllocationValue(eventIndex, allocationIndex, \.targetOwnershipPercentage) }) }
            TextField("備考", text: allocationNote(eventIndex, allocationIndex)).textFieldStyle(.roundedBorder)
        }.padding(8).overlay(RoundedRectangle(cornerRadius: 6).stroke(.gray.opacity(0.25)))
    }
    @ViewBuilder private func editableField(_ label: String, _ binding: Binding<Double>, source: AMDOSCapitalEditableValue? = nil, onChange: ((Double) -> Void)? = nil, onClearOverride: (() -> Void)? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2)
            TextField(label, value: Binding(get: { binding.wrappedValue }, set: { let value = $0; if let onChange { onChange(value) } else { binding.wrappedValue = value } }), format: .number).textFieldStyle(.roundedBorder)
            HStack(spacing: 4) { Text(sourceBadge(source)).font(.caption2).foregroundStyle(AMDOSDesign.muted); if let baseline = source?.calculatedValue, source?.source == "override" { Text("基準 \(baseline.formatted())").font(.caption2).foregroundStyle(AMDOSDesign.muted) }; if source?.source == "override", let onClearOverride { Button("✕") { onClearOverride() }.font(.caption2).accessibilityLabel("上書きを解除") } }
        }
    }
    @ViewBuilder private func editableOptionalField(_ label: String, _ binding: Binding<Double>, source: AMDOSCapitalEditableValue? = nil, multiplier: Double = 1, onClear: (() -> Void)? = nil, onClearOverride: (() -> Void)? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2)
            TextField(label, text: Binding(get: { source.map { String($0.value * multiplier) } ?? "" }, set: { raw in if raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { onClear?() } else if let value = Double(raw) { binding.wrappedValue = value / multiplier } })).textFieldStyle(.roundedBorder)
            HStack(spacing: 4) { Text(sourceBadge(source)).font(.caption2).foregroundStyle(AMDOSDesign.muted); if let baseline = source?.calculatedValue, source?.source == "override" { Text("基準 \(baseline.formatted())").font(.caption2).foregroundStyle(AMDOSDesign.muted) }; if source?.source == "override", let onClearOverride { Button("✕") { onClearOverride() }.font(.caption2).accessibilityLabel("上書きを解除") } }
        }
    }
    private var selectedIndex: Int? { if let selectedEventID, let index = document.events.firstIndex(where: { $0.id == selectedEventID }) { return index }; return document.events.indices.sorted(by: { document.events[$0].order < document.events[$1].order }).first }
    private var deletionMessage: String { switch pendingDeletion { case .event: return "このイベントを削除するよ"; case .holder: return "この保有者と全イベントの割当を削除するよ"; case .allocation: return "この割当を削除するよ"; case nil: return "" } }
    private func addHolder() { var next = document; next.holders.append(.init(id: UUID().uuidString, name: "新規株主", kind: "other", note: nil)); changed(next) }
    private func addEvent() { var next = document; let order = (next.events.map(\.order).max() ?? -1) + 1; let id = UUID().uuidString; next.events.append(.init(id: id, type: "equity_issue", label: "新規イベント", order: order, date: nil, status: "planned", preMoneyValuation: nil, postMoneyValuation: nil, pricePerShare: nil, splitRatio: nil, poolSize: nil, conversionCap: nil, conversionDiscount: nil, calculationBasis: nil, primaryRaise: nil, newShares: nil, allocations: [], note: nil)); selectedEventID = id; changed(next) }
    private func addAllocation(_ eventIndex: Int) { guard let holder = document.holders.first else { return }; var next = document; let event = next.events[eventIndex]; let shareClass = defaultShareClass(event.type); let allocation: AMDOSCapitalAllocation; switch event.calculationBasis ?? "manual" { case "valuation_and_investment": allocation = .init(id: UUID().uuidString, holderId: holder.id, shareClass: shareClass, shares: editable(0, "calculated"), amount: editable(0, "input"), pricePerShare: nil, targetOwnershipPercentage: nil, note: nil); case "price_and_shares": allocation = .init(id: UUID().uuidString, holderId: holder.id, shareClass: shareClass, shares: editable(0, "input"), amount: editable(0, "calculated"), pricePerShare: nil, targetOwnershipPercentage: nil, note: nil); case "ownership_target": allocation = .init(id: UUID().uuidString, holderId: holder.id, shareClass: shareClass, shares: editable(0, "calculated"), amount: editable(0, "calculated"), pricePerShare: editable(0, "calculated"), targetOwnershipPercentage: editable(0, "input"), note: nil); default: allocation = .init(id: UUID().uuidString, holderId: holder.id, shareClass: shareClass, shares: editable(0, "input"), amount: nil, pricePerShare: nil, targetOwnershipPercentage: nil, note: nil) }; next.events[eventIndex].allocations.append(allocation); changed(next) }
    private func holderName(_ index: Int) -> Binding<String> { Binding(get: { document.holders[index].name }, set: { var next = document; next.holders[index].name = $0; changed(next) }) }
    private func holderKind(_ index: Int) -> Binding<String> { Binding(get: { document.holders[index].kind }, set: { var next = document; next.holders[index].kind = $0; changed(next) }) }
    private func holderNote(_ index: Int) -> Binding<String> { Binding(get: { document.holders[index].note ?? "" }, set: { var next = document; next.holders[index].note = $0.isEmpty ? nil : $0; changed(next) }) }
    private func eventLabel(_ index: Int) -> Binding<String> { Binding(get: { document.events[index].label }, set: { var next = document; next.events[index].label = $0; changed(next) }) }
    private func eventDate(_ index: Int) -> Binding<String> { Binding(get: { document.events[index].date ?? "" }, set: { var next = document; next.events[index].date = $0.isEmpty ? nil : $0; changed(next) }) }
    private func eventOrder(_ index: Int) -> Binding<Double> { Binding(get: { document.events[index].order }, set: { var next = document; next.events[index].order = $0; changed(next) }) }
    private func eventStatus(_ index: Int) -> Binding<String> { Binding(get: { document.events[index].status ?? "planned" }, set: { var next = document; next.events[index].status = $0; changed(next) }) }
    private func eventNote(_ index: Int) -> Binding<String> { Binding(get: { document.events[index].note ?? "" }, set: { var next = document; next.events[index].note = $0.isEmpty ? nil : $0; changed(next) }) }
    private func eventType(_ index: Int) -> Binding<String> { Binding(get: { document.events[index].type }, set: { updateEventType(index, $0) }) }
    private func eventBasis(_ index: Int) -> Binding<String> { Binding(get: { document.events[index].calculationBasis ?? "manual" }, set: { changeBasis(index, $0) }) }
    private func eventValue(_ eventIndex: Int, _ path: WritableKeyPath<AMDOSCapitalEvent, AMDOSCapitalEditableValue?>) -> Binding<Double> { Binding(get: { document.events[eventIndex][keyPath: path]?.value ?? 0 }, set: { setEventValue(eventIndex, path: path, value: $0) }) }
    private func setEventValue(_ index: Int, path: WritableKeyPath<AMDOSCapitalEvent, AMDOSCapitalEditableValue?>, value: Double) { var next = document; next.events[index][keyPath: path] = directEdited(next.events[index][keyPath: path], value); changed(next) }
    private func outputEventValue(_ index: Int, path: WritableKeyPath<AMDOSCapitalEvent, AMDOSCapitalEditableValue?>, value: Double) { var next = document; let old = next.events[index][keyPath: path]; if var old, old.source == "override" { old.value = value; next.events[index][keyPath: path] = old } else { next.events[index][keyPath: path] = .init(value: value, source: "override", calculatedValue: old?.calculatedValue ?? old?.value ?? value, note: old?.note) }; changed(next) }
    private func clearEventValue(_ index: Int, path: WritableKeyPath<AMDOSCapitalEvent, AMDOSCapitalEditableValue?>) { var next = document; next.events[index][keyPath: path] = nil; changed(next) }
    private func updateEventValue(_ index: Int, path: WritableKeyPath<AMDOSCapitalEvent, AMDOSCapitalEditableValue?>, value: Double) { let event = document.events[index]; if path == \AMDOSCapitalEvent.pricePerShare, ["valuation_and_investment", "ownership_target"].contains(event.calculationBasis ?? "") { switchToPriceAndShares(index, value) } else if path == \AMDOSCapitalEvent.preMoneyValuation, event.calculationBasis == "price_and_shares" { switchToValuation(index, value) } else { setEventValue(index, path: path, value: value) } }
    private func allocationHolder(_ eventIndex: Int, _ allocationIndex: Int) -> Binding<String> { Binding(get: { document.events[eventIndex].allocations[allocationIndex].holderId }, set: { var next = document; next.events[eventIndex].allocations[allocationIndex].holderId = $0; changed(next) }) }
    private func allocationClass(_ eventIndex: Int, _ allocationIndex: Int) -> Binding<String> { Binding(get: { document.events[eventIndex].allocations[allocationIndex].shareClass }, set: { var next = document; next.events[eventIndex].allocations[allocationIndex].shareClass = $0; changed(next) }) }
    private func allocationValue(_ eventIndex: Int, _ allocationIndex: Int, _ path: WritableKeyPath<AMDOSCapitalAllocation, AMDOSCapitalEditableValue>) -> Binding<Double> { Binding(get: { document.events[eventIndex].allocations[allocationIndex][keyPath: path].value }, set: { var next = document; next.events[eventIndex].allocations[allocationIndex][keyPath: path] = directEdited(next.events[eventIndex].allocations[allocationIndex][keyPath: path], $0); changed(next) }) }
    private func allocationOptionalValue(_ eventIndex: Int, _ allocationIndex: Int, _ path: WritableKeyPath<AMDOSCapitalAllocation, AMDOSCapitalEditableValue?>) -> Binding<Double> { Binding(get: { document.events[eventIndex].allocations[allocationIndex][keyPath: path]?.value ?? 0 }, set: { var next = document; next.events[eventIndex].allocations[allocationIndex][keyPath: path] = directEdited(next.events[eventIndex].allocations[allocationIndex][keyPath: path], $0); changed(next) }) }
    private func clearAllocationValue(_ eventIndex: Int, _ allocationIndex: Int, _ path: WritableKeyPath<AMDOSCapitalAllocation, AMDOSCapitalEditableValue?>) { var next = document; next.events[eventIndex].allocations[allocationIndex][keyPath: path] = nil; changed(next) }
    private func allocationNote(_ eventIndex: Int, _ allocationIndex: Int) -> Binding<String> { Binding(get: { document.events[eventIndex].allocations[allocationIndex].note ?? "" }, set: { var next = document; next.events[eventIndex].allocations[allocationIndex].note = $0.isEmpty ? nil : $0; changed(next) }) }
    private func matrixAmountBinding(_ eventIndex: Int, _ holderID: String) -> Binding<Double> { Binding(get: { document.events[eventIndex].allocations.filter { $0.holderId == holderID }.reduce(0) { $0 + ($1.amount?.value ?? 0) } }, set: { editMatrixAllocation(eventIndex, holderID, amount: $0, shares: nil, target: nil) }) }
    private func matrixSharesBinding(_ eventIndex: Int, _ holderID: String) -> Binding<Double> { Binding(get: { document.events[eventIndex].allocations.filter { $0.holderId == holderID }.reduce(0) { $0 + $1.shares.value } }, set: { editMatrixAllocation(eventIndex, holderID, amount: nil, shares: $0, target: nil) }) }
    private func matrixTargetBinding(_ eventIndex: Int, _ holderID: String) -> Binding<Double> { Binding(get: { (document.events[eventIndex].allocations.first { $0.holderId == holderID && $0.targetOwnershipPercentage != nil }?.targetOwnershipPercentage?.value ?? 0) * 100 }, set: { editMatrixAllocation(eventIndex, holderID, amount: nil, shares: nil, target: $0 / 100) }) }
    private func editMatrixAllocation(_ eventIndex: Int, _ holderID: String, amount: Double?, shares: Double?, target: Double?) { var next = document; var event = next.events[eventIndex]; directEditError = nil; if let amount, amount < 0 { directEditError = "金額は0以上で入力して"; return }; if let target, !(target >= 0 && target < 1) { directEditError = "FD比率は0%以上100%未満で入力して"; return }; if let target, !["equity_issue", "convertible_conversion", "ipo"].contains(event.type) { let events = next.events.sorted { $0.order < $1.order }; let snapshots = AMDOSCapitalPlanMath.snapshots(document: next); guard let current = snapshots.first(where: { $0.eventID == event.id }) else { directEditError = "イベント後FD株数を計算できない"; return }; let other = current.holders.filter { $0.id != holderID }.reduce(0) { $0 + $1.fullyDiluted }; let targetShares = (target * other / (1 - target)).rounded(); let position = events.firstIndex(where: { $0.id == event.id }) ?? 0; let prior = position > 0 ? snapshots.first(where: { $0.eventID == events[position - 1].id })?.holders.first(where: { $0.id == holderID })?.fullyDiluted ?? 0 : 0; let delta = targetShares - prior; if delta < 0 { directEditError = "イベント後FD株数が直前ラウンドを下回る。減少はsecondaryで表現して"; return }; let matches = event.allocations.indices.filter { event.allocations[$0].holderId == holderID }; let index = matches.first ?? { event.allocations.append(.init(id: UUID().uuidString, holderId: holderID, shareClass: defaultShareClass(event.type), shares: editable(0, "input"), amount: nil, pricePerShare: nil, targetOwnershipPercentage: nil, note: nil)); return event.allocations.count - 1 }(); let others = matches.filter { $0 != index }.reduce(0) { $0 + event.allocations[$1].shares.value }; if delta - others < 0 { directEditError = "他の割当株数合計が目標を超えている"; return }; event.allocations[index].shares = directEdited(event.allocations[index].shares, delta - others); next.events[eventIndex] = event; changed(next); return }; if let shares { let rounded = shares.rounded(); let negativeAllowed = event.type == "secondary" || (event.type == "convertible_conversion" && event.allocations.contains { $0.holderId == holderID && $0.shareClass == "convertible" }); if rounded < 0 && !negativeAllowed { directEditError = "このイベントでは負の株数を入力できない"; return } }; let matches = event.allocations.indices.filter { event.allocations[$0].holderId == holderID }; let targetIndex: Int; if let existingTarget = matches.first(where: { event.allocations[$0].targetOwnershipPercentage != nil }), target != nil { targetIndex = existingTarget } else if let first = matches.first { targetIndex = first } else { event.allocations.append(.init(id: UUID().uuidString, holderId: holderID, shareClass: defaultShareClass(event.type), shares: editable(0, "input"), amount: nil, pricePerShare: nil, targetOwnershipPercentage: nil, note: nil)); targetIndex = event.allocations.count - 1 }; if let amount { let others = matches.filter { $0 != targetIndex }.reduce(0) { $0 + (event.allocations[$1].amount?.value ?? 0) }; if others > amount { directEditError = "他の割当金額合計が入力値を超えている"; return }; event.allocations[targetIndex].amount = directEdited(event.allocations[targetIndex].amount, amount - others) }; if let shares { let others = matches.filter { $0 != targetIndex }.reduce(0) { $0 + event.allocations[$1].shares.value }; if others > shares.rounded() { directEditError = "他の割当株数合計が入力値を超えている"; return }; event.allocations[targetIndex].shares = directEdited(event.allocations[targetIndex].shares, shares.rounded() - others) }; if let target { event.calculationBasis = "ownership_target"; event.allocations[targetIndex].targetOwnershipPercentage = editable(target, "input"); event.allocations[targetIndex].shares = editable(event.allocations[targetIndex].shares.value, "calculated"); event.allocations[targetIndex].amount = nil; event.allocations[targetIndex].pricePerShare = nil }; next.events[eventIndex] = event; changed(next) }
    private func clearMatrixTarget(_ eventIndex: Int, _ holderID: String) { var next = document; guard let index = next.events[eventIndex].allocations.firstIndex(where: { $0.holderId == holderID && $0.targetOwnershipPercentage != nil }) else { return }; let allocation = next.events[eventIndex].allocations[index]; if allocation.shares.source == "calculated", allocation.amount == nil, allocation.pricePerShare == nil, allocation.note == nil { next.events[eventIndex].allocations.remove(at: index) } else { next.events[eventIndex].allocations[index].targetOwnershipPercentage = nil }; changed(next) }
    private func editable(_ value: Double, _ source: String) -> AMDOSCapitalEditableValue { .init(value: value, source: source, calculatedValue: nil, note: nil) }
    private func sourceBadge(_ value: AMDOSCapitalEditableValue?) -> String { guard let value else { return "未入力" }; return ["input": "入力", "calculated": "計算", "imported": "取込", "confirmed": "確定", "override": "上書き"][value.source] ?? value.source }
    private func directEdited(_ current: AMDOSCapitalEditableValue?, _ value: Double) -> AMDOSCapitalEditableValue { guard var current else { return editable(value, "input") }; if ["calculated", "imported", "confirmed"].contains(current.source) { current = .init(value: value, source: "override", calculatedValue: current.value, note: current.note) } else { current.value = value }; return current }
    private func defaultShareClass(_ type: String) -> String { ["equity_issue": "preferred", "ipo": "common", "convertible_issue": "convertible", "option_pool": "option", "convertible_conversion": "preferred", "secondary": "common", "incorporation": "common"][type] ?? "common" }
    private func normalize(_ value: AMDOSCapitalEditableValue?, _ source: String) -> AMDOSCapitalEditableValue? { guard let value else { return nil }; return editable(value.value, source) }
    private func normalized(_ original: AMDOSCapitalEvent, basis: String) -> AMDOSCapitalEvent { var event = original; event.calculationBasis = basis; event.postMoneyValuation = normalize(event.postMoneyValuation, "calculated"); event.primaryRaise = normalize(event.primaryRaise, "calculated"); event.newShares = normalize(event.newShares, "calculated"); if basis == "manual" { event.preMoneyValuation = normalize(event.preMoneyValuation, "input"); event.pricePerShare = normalize(event.pricePerShare, "input"); event.allocations = event.allocations.map { var a = $0; a.shares = editable(a.shares.value, "input"); a.amount = normalize(a.amount, "input"); a.pricePerShare = normalize(a.pricePerShare, "input"); return a }; return event }; if basis == "price_and_shares" { event.pricePerShare = normalize(event.pricePerShare, "input"); event.preMoneyValuation = normalize(event.preMoneyValuation, "calculated"); event.allocations = event.allocations.map { var a = $0; a.shares = editable(a.shares.value, "input"); a.amount = normalize(a.amount, "calculated"); a.pricePerShare = nil; return a }; return event }; event.preMoneyValuation = normalize(event.preMoneyValuation, "input"); event.pricePerShare = normalize(event.pricePerShare, "calculated"); event.allocations = event.allocations.map { var a = $0; a.shares = editable(a.shares.value, "calculated"); a.amount = normalize(a.amount, basis == "valuation_and_investment" ? "input" : "calculated"); a.pricePerShare = normalize(a.pricePerShare, "calculated"); if basis == "ownership_target" { a.targetOwnershipPercentage = normalize(a.targetOwnershipPercentage, "input") }; return a }; return event }
    private func changeBasis(_ index: Int, _ basis: String) { var next = document; next.events[index] = normalized(next.events[index], basis: basis); changed(next) }
    private func switchToPriceAndShares(_ index: Int, _ price: Double) { var next = document; next.events[index] = normalized(next.events[index], basis: "price_and_shares"); next.events[index].pricePerShare = editable(price, "input"); changed(next) }
    private func switchToValuation(_ index: Int, _ preMoney: Double) { var next = document; next.events[index] = normalized(next.events[index], basis: "valuation_and_investment"); next.events[index].preMoneyValuation = editable(preMoney, "input"); changed(next) }
    private func updateEventType(_ index: Int, _ type: String) { var next = document; var event = next.events[index]; event.type = type; if type == "convertible_conversion" { event = normalized(event, basis: "manual") }; next.events[index] = event; changed(next) }
    private func performDeletion() { guard let pendingDeletion else { return }; var next = document; switch pendingDeletion { case .event(let id): next.events.removeAll { $0.id == id }; if selectedEventID == id { selectedEventID = next.events.first?.id }; case .holder(let id): next.holders.removeAll { $0.id == id }; for index in next.events.indices { next.events[index].allocations.removeAll { $0.holderId == id } }; case .allocation(let id): for index in next.events.indices { next.events[index].allocations.removeAll { $0.id == id } } }; self.pendingDeletion = nil; changed(next) }
}

private struct AMDOSCapitalStanding: Identifiable { let id: String; let issued: Double; let fullyDiluted: Double; let issuedRatio: Double; let fullyDilutedRatio: Double }
private struct AMDOSCapitalRoundSnapshot: Identifiable { let eventID: String; let eventLabel: String; let order: Double; let totalIssued: Double; let totalFullyDiluted: Double; let holders: [AMDOSCapitalStanding]; var id: String { eventID } }
private struct AMDOSCapitalValidationIssue: Identifiable {
    let severity: String
    let code: String
    let message: String
    var id: String { "\(severity)-\(code)-\(message)" }
}
private struct AMDOSCapitalPublishEligibility {
    let blockingIssues: [AMDOSCapitalValidationIssue]
    let warnings: [AMDOSCapitalValidationIssue]
    var eligible: Bool { blockingIssues.isEmpty }
}
private enum AMDOSCapitalDeriveError: Error, LocalizedError {
    case invalid(String)
    var errorDescription: String? {
        switch self { case .invalid(let message): message }
    }
}
private enum AMDOSCapitalPlanMath {
    static func safeDerive(document: AMDOSCapitalDocument) -> Result<AMDOSCapitalDocument, AMDOSCapitalDeriveError> {
        do { return .success(try derive(document: document)) }
        catch { return .failure(.invalid("資本プランの自動算出でエラーが発生しました: \(error.localizedDescription)")) }
    }
    static func derive(document: AMDOSCapitalDocument) throws -> AMDOSCapitalDocument {
        var next = document
        var issued: [String: Double] = [:]
        var diluted: [String: Double] = [:]
        for index in next.events.indices.sorted(by: { next.events[$0].order < next.events[$1].order }) {
            if next.events[index].type == "share_split" {
                let ratio = next.events[index].splitRatio?.value ?? 0
                let effectiveRatio = ratio == 0 ? 1 : ratio
                issued = issued.mapValues { $0 * effectiveRatio }
                diluted = diluted.mapValues { $0 * effectiveRatio }
            }
            let preFD = diluted.values.reduce(0, +)
            let basis = next.events[index].calculationBasis ?? "manual"
            if next.events[index].type == "convertible_conversion", basis != "manual" { throw AMDOSCapitalDeriveError.invalid("\(next.events[index].label): convertible_conversion はmanual基準のみ") }
            if basis == "valuation_and_investment" { try deriveValuationAndInvestment(&next.events[index], preRoundFD: preFD) }
            else if basis == "price_and_shares" { try derivePriceAndShares(&next.events[index], preRoundFD: preFD) }
            else if basis == "ownership_target" { try deriveOwnershipTarget(&next.events[index], preRoundFD: preFD, preHoldings: diluted) }
            else { deriveManual(&next.events[index]) }
            for allocation in next.events[index].allocations {
                let shares = allocation.shares.value
                if !isDilutive(allocation.shareClass) { issued[allocation.holderId, default: 0] += shares }
                diluted[allocation.holderId, default: 0] += shares
            }
        }
        return next
    }
    static func replayFD(events: [AMDOSCapitalEvent]) -> [String: Double] { var fd: [String: Double] = [:]; for event in events.sorted(by: { $0.order < $1.order }) { if event.type == "share_split" { let ratio = (event.splitRatio?.value ?? 0) == 0 ? 1 : (event.splitRatio?.value ?? 1); fd = fd.mapValues { $0 * ratio } }; for allocation in event.allocations { fd[allocation.holderId, default: 0] += allocation.shares.value } }; return fd }
    private static func isDilutive(_ shareClass: String) -> Bool { ["option", "convertible", "warrant"].contains(shareClass) }
    static func deriveValuationAndInvestment(_ event: inout AMDOSCapitalEvent, preRoundFD: Double) throws {
        guard preRoundFD > 0, let pre = event.preMoneyValuation?.value, pre.isFinite, pre > 0 else { throw AMDOSCapitalDeriveError.invalid("\(event.label): 評価額×投資額には正のプレマネー評価額と既存FD株数が必要") }
        let calculatedPrice = pre / preRoundFD
        guard calculatedPrice.isFinite, calculatedPrice > 0 else { throw AMDOSCapitalDeriveError.invalid("\(event.label): 算出株価が0以下") }
        event.pricePerShare = derived(event.pricePerShare, calculatedPrice)
        let price = calculatedPrice
        for index in event.allocations.indices {
            let amount = event.allocations[index].amount?.value ?? 0
            guard amount.isFinite else { throw AMDOSCapitalDeriveError.invalid("\(event.label): 投資額が不正") }
            let shares = jsRound(amount / price)
            event.allocations[index].shares = derived(event.allocations[index].shares, shares)
            event.allocations[index].pricePerShare = derived(event.allocations[index].pricePerShare, price)
        }
        let raise = event.allocations.reduce(0) { $0 + ($1.amount?.value ?? 0) }
        let shares = event.allocations.reduce(0) { $0 + $1.shares.value }
        event.primaryRaise = derived(event.primaryRaise, raise)
        event.newShares = derived(event.newShares, shares)
        event.postMoneyValuation = derived(event.postMoneyValuation, pre + raise)
    }
    static func derivePriceAndShares(_ event: inout AMDOSCapitalEvent, preRoundFD: Double) throws {
        let eventPrice = event.pricePerShare?.value
        var firstAllocationPrice: Double?
        for index in event.allocations.indices {
            let price = event.allocations[index].pricePerShare?.value ?? eventPrice
            guard let price, price.isFinite, price > 0 else { throw AMDOSCapitalDeriveError.invalid("\(event.label): 割当の株価が指定されていない") }
            firstAllocationPrice = firstAllocationPrice ?? price
            let shares = event.allocations[index].shares.value
            event.allocations[index].amount = derived(event.allocations[index].amount, shares * price)
        }
        guard let priceForPreMoney = eventPrice ?? firstAllocationPrice else { throw AMDOSCapitalDeriveError.invalid("\(event.label): 単価×株数には正の株価が必要") }
        let raise = event.allocations.reduce(0) { $0 + ($1.amount?.value ?? 0) }
        let shares = event.allocations.reduce(0) { $0 + $1.shares.value }
        let pre = priceForPreMoney * preRoundFD
        event.newShares = derived(event.newShares, shares)
        event.primaryRaise = derived(event.primaryRaise, raise)
        event.preMoneyValuation = derived(event.preMoneyValuation, pre)
        event.postMoneyValuation = derived(event.postMoneyValuation, pre + raise)
    }
    static func deriveManual(_ event: inout AMDOSCapitalEvent) {
        let nonDilutive = event.allocations.filter { !isDilutive($0.shareClass) }.reduce(0) { $0 + max(0, $1.shares.value) }
        if event.type == "incorporation" { event.newShares = derived(event.newShares, nonDilutive); return }
        if event.type == "convertible_conversion" { event.newShares = derived(event.newShares, nonDilutive); event.primaryRaise = derived(event.primaryRaise, 0); return }
        guard event.type == "equity_issue" || event.type == "ipo" else { return }
        let raise = event.allocations.reduce(0) { $0 + ($1.amount?.value ?? 0) }
        event.newShares = derived(event.newShares, nonDilutive)
        event.primaryRaise = derived(event.primaryRaise, raise)
        if let pre = event.preMoneyValuation?.value { event.postMoneyValuation = derived(event.postMoneyValuation, pre + raise) }
    }
    static func deriveOwnershipTarget(_ event: inout AMDOSCapitalEvent, preRoundFD: Double, preHoldings: [String: Double]) throws {
        let price = (event.preMoneyValuation?.value ?? 0) / preRoundFD
        guard price.isFinite, price > 0 else { throw AMDOSCapitalDeriveError.invalid("\(event.label): 目標比率には正のプレマネー評価額と既存FD株数が必要") }
        let targets = event.allocations.enumerated().filter { $0.element.targetOwnershipPercentage != nil }
        guard Set(targets.map { $0.element.holderId }).count == targets.count else { throw AMDOSCapitalDeriveError.invalid("\(event.label): 同じ保有者の目標持分は1行にまとめて") }
        let targetSum = targets.reduce(0) { $0 + ($1.element.targetOwnershipPercentage?.value ?? 0) }
        guard targetSum.isFinite, targetSum >= 0, targetSum < 1, !targets.contains(where: { !($0.element.targetOwnershipPercentage?.value ?? 0).isFinite || ($0.element.targetOwnershipPercentage?.value ?? 0) < 0 }) else { throw AMDOSCapitalDeriveError.invalid("\(event.label): 目標持分は0以上、合計100%未満で入力して") }
        let fixedRows = event.allocations.filter { $0.targetOwnershipPercentage == nil }
        let fixedShares = fixedRows.reduce(0) { $0 + $1.shares.value }
        let ownFixed = Dictionary(grouping: fixedRows, by: \.holderId).mapValues { $0.reduce(0) { $0 + $1.shares.value } }
        let sumPre = targets.reduce(0) { $0 + (preHoldings[$1.element.holderId] ?? 0) }
        let sumOwnFixed = targets.reduce(0) { $0 + (ownFixed[$1.element.holderId] ?? 0) }
        let postFD = (preRoundFD + fixedShares - sumPre - sumOwnFixed) / (1 - targetSum)
        guard postFD.isFinite, postFD >= 0 else { throw AMDOSCapitalDeriveError.invalid("\(event.label): 目標持分からラウンド後FD株数を算出できない") }
        for (index, allocation) in targets {
            let target = allocation.targetOwnershipPercentage?.value ?? 0
            let rawShares = target * postFD - (preHoldings[allocation.holderId] ?? 0) - (ownFixed[allocation.holderId] ?? 0)
            guard rawShares.isFinite, rawShares >= 0 else { throw AMDOSCapitalDeriveError.invalid("\(event.label): \(allocation.holderId)の目標持分は既存保有を含めると達成できない") }
            let shares = jsRound(rawShares)
            event.allocations[index].shares = derived(event.allocations[index].shares, shares)
            event.allocations[index].amount = derived(event.allocations[index].amount, shares * price)
            event.allocations[index].pricePerShare = derived(event.allocations[index].pricePerShare, price)
        }
        let raise = event.allocations.reduce(0) { $0 + ($1.amount?.value ?? 0) }; let shares = event.allocations.reduce(0) { $0 + $1.shares.value }
        event.newShares = derived(event.newShares, shares); event.primaryRaise = derived(event.primaryRaise, raise); event.pricePerShare = derived(event.pricePerShare, price); event.postMoneyValuation = derived(event.postMoneyValuation, (event.preMoneyValuation?.value ?? 0) + raise)
    }
    private static func derived(_ existing: AMDOSCapitalEditableValue?, _ calculated: Double) -> AMDOSCapitalEditableValue { if var existing, existing.source == "override" { existing.calculatedValue = calculated; return existing }; return .init(value: calculated, source: "calculated", calculatedValue: nil, note: existing?.note) }
    private static func jsRound(_ value: Double) -> Double { floor(value + 0.5) }
    static func snapshots(document: AMDOSCapitalDocument) -> [AMDOSCapitalRoundSnapshot] {
        var issued: [String: Double] = [:], diluted: [String: Double] = [:], output: [AMDOSCapitalRoundSnapshot] = []
        for event in document.events.sorted(by: { $0.order < $1.order }) {
            if event.type == "share_split" { let ratio = (event.splitRatio?.value ?? 0) == 0 ? 1 : (event.splitRatio?.value ?? 1); issued = issued.mapValues { $0 * ratio }; diluted = diluted.mapValues { $0 * ratio } }
            for allocation in event.allocations { let shares = allocation.shares.value; if !["option", "convertible", "warrant"].contains(allocation.shareClass) { issued[allocation.holderId, default: 0] += shares }; diluted[allocation.holderId, default: 0] += shares }
            let issuedTotal = issued.values.reduce(0, +), dilutedTotal = diluted.values.reduce(0, +)
            let standings = Set(issued.keys).union(diluted.keys).map { id in AMDOSCapitalStanding(id: id, issued: issued[id, default: 0], fullyDiluted: diluted[id, default: 0], issuedRatio: issuedTotal == 0 ? 0 : issued[id, default: 0] / issuedTotal, fullyDilutedRatio: dilutedTotal == 0 ? 0 : diluted[id, default: 0] / dilutedTotal) }
            output.append(.init(eventID: event.id, eventLabel: event.label, order: event.order, totalIssued: issuedTotal, totalFullyDiluted: dilutedTotal, holders: standings))
        }
        return output
    }
    static func recalculate(document: AMDOSCapitalDocument) -> [AMDOSCapitalStanding] { snapshots(document: document).last?.holders ?? [] }
    static func validate(document: AMDOSCapitalDocument) -> [String] { validationIssues(document: document).map(\.message) }
    static func validationIssues(document: AMDOSCapitalDocument) -> [AMDOSCapitalValidationIssue] {
        var issues: [AMDOSCapitalValidationIssue] = []
        let holderIDs = Set(document.holders.map(\.id))
        let events = document.events.sorted(by: { $0.order < $1.order })
        var orders: [Double: String] = [:]
        var convertible: [String: Double] = [:]
        func add(_ severity: String, _ code: String, _ message: String) { issues.append(.init(severity: severity, code: code, message: message)) }
        for event in events {
            if let prior = orders[event.order] { add("error", "duplicate_order", "イベント順序 \(event.order) が\(prior)と\(event.label)で重複") } else { orders[event.order] = event.label }
            var secondaryNet = 0.0
            for allocation in event.allocations {
                let shares = allocation.shares.value
                if !holderIDs.contains(allocation.holderId) { add("error", "unknown_holder", "\(event.label): 未登録の保有者ID \(allocation.holderId)") }
                if shares == 0 { add("warning", "zero_shares", "\(event.label): \(allocation.holderId) の割当株数が0") }
                if !shares.isFinite || shares.rounded() != shares { add("error", "fractional_shares", "\(event.label): \(allocation.holderId) の株数は整数で入力して") }
                let negativeAllowed = event.type == "secondary" || (event.type == "convertible_conversion" && allocation.shareClass == "convertible")
                if shares < 0 && !negativeAllowed { add("error", "negative_shares_not_allowed", "\(event.label): この割当では負の株数は使えない") }
                if let amount = allocation.amount?.value, (!amount.isFinite || (event.type != "secondary" && amount < 0)) { add("error", "negative_allocation_amount", "\(event.label): \(allocation.holderId) の金額が不正") }
                if allocation.shareClass == "convertible" {
                    let balance = convertible[allocation.holderId, default: 0]
                    if shares < 0 && abs(shares) > balance { add("error", "convertible_consumption_exceeds_balance", "\(event.label): \(allocation.holderId) のコンバーティブル消込が残高を超えている") }
                    convertible[allocation.holderId] = balance + shares
                }
                if event.type == "secondary" { secondaryNet += shares }
            }
            if event.type == "secondary", secondaryNet != 0 { add("error", "secondary_net_not_zero", "\(event.label): 譲渡株数の合計は0にして") }
            let isFinancing = ["equity_issue", "ipo", "convertible_conversion"].contains(event.type)
            if isFinancing && event.allocations.isEmpty { add("error", "empty_equity_issue", "\(event.label): 割当がない") }
            let pre = event.preMoneyValuation?.value
            let post = event.postMoneyValuation?.value
            if let pre, let post, post < pre { add("warning", "post_below_pre", "\(event.label): ポストマネーがプレマネーを下回っている") }
            if event.type != "convertible_conversion", let pre, let post {
                let expected = pre + event.allocations.reduce(0) { $0 + ($1.amount?.value ?? 0) }
                if abs(post - expected) > 1 { add("error", "post_money_mismatch", "\(event.label): ポストマネーがプレマネー＋調達額と一致しない") }
            }
            if event.type == "share_split", (event.splitRatio?.value ?? 0) <= 0 { add("error", "invalid_split_ratio", "\(event.label): 分割比率は正の数にして") }
            if event.type == "convertible_conversion" {
                if event.calculationBasis != nil && event.calculationBasis != "manual" { add("error", "convertible_conversion_non_manual_basis", "\(event.label): 転換はmanual基準のみ") }
                if event.primaryRaise.map({ abs($0.value) > 1 }) == true { add("error", "convertible_conversion_primary_raise_nonzero", "\(event.label): 転換のprimaryRaiseは0にして") }
                if !event.allocations.contains(where: { $0.shareClass == "convertible" && $0.shares.value < 0 }) { add("error", "convertible_conversion_missing_consumption", "\(event.label): コンバーティブル消込がない") }
                if !event.allocations.contains(where: { !isDilutive($0.shareClass) && $0.shares.value > 0 }) { add("error", "convertible_conversion_missing_issuance", "\(event.label): 転換後の正の株式割当がない") }
            } else if let primaryRaise = event.primaryRaise?.value {
                let cash = event.allocations.reduce(0) { $0 + ($1.amount?.value ?? 0) }
                if abs(primaryRaise - cash) > 1 { add("error", "primary_raise_mismatch", "\(event.label): primaryRaiseと割当金額合計が一致しない") }
            }
            if let newShares = event.newShares?.value {
                let expected = event.type == "secondary" ? 0 : event.allocations.filter { !isDilutive($0.shareClass) }.reduce(0) { $0 + max(0, $1.shares.value) }
                if abs(newShares - expected) > 0 { add("error", "new_shares_mismatch", "\(event.label): newSharesと新規発行株数合計が一致しない") }
            }
            for allocation in event.allocations {
                let price = allocation.pricePerShare?.value ?? event.pricePerShare?.value
                if let amount = allocation.amount?.value, let price, price > 0, abs(amount - allocation.shares.value * price) > max(1, price) { add("error", "allocation_amount_price_mismatch", "\(event.label): \(allocation.holderId) の金額と株数×価格が一致しない") }
                if ["valuation_and_investment", "ownership_target"].contains(event.calculationBasis ?? ""), let value = allocation.pricePerShare, value.source == "override", let calculated = value.calculatedValue, abs(value.value - calculated) > 1 { add("error", "derived_allocation_price_override_mismatch", "\(event.label): \(allocation.holderId) の株価上書きが算出値と一致しない") }
            }
            if ["valuation_and_investment", "ownership_target"].contains(event.calculationBasis ?? ""), let value = event.pricePerShare, value.source == "override", let calculated = value.calculatedValue, abs(value.value - calculated) > 1 { add("error", "derived_event_price_override_mismatch", "\(event.label): イベント株価上書きが算出値と一致しない") }
            if event.calculationBasis == "price_and_shares", let eventPrice = event.pricePerShare?.value, event.allocations.contains(where: { if let price = $0.pricePerShare?.value { return abs(price - eventPrice) > 1 }; return false }) { add("error", "price_basis_allocation_price_mismatch", "\(event.label): 単価×株数の割当単価はイベント単価と一致させて") }
            if event.type == "option_pool", let pool = event.poolSize?.value { let optionSum = event.allocations.filter { $0.shareClass == "option" }.reduce(0) { $0 + $1.shares.value }; if abs(pool - optionSum) > 0 { add("error", "option_pool_size_mismatch", "\(event.label): プールサイズとオプション合計が一致しない") } }
            if event.type == "convertible_issue" { for allocation in event.allocations { if allocation.shareClass != "convertible" || allocation.shares.value <= 0 { add("error", "convertible_issue_invalid", "\(event.label): コンバーティブル発行は正のconvertible割当にして") } } }
            if event.type == "secondary" { let seller = event.allocations.filter { $0.shares.value < 0 }.reduce(0) { $0 + abs($1.amount?.value ?? 0) }; let buyer = event.allocations.filter { $0.shares.value > 0 }.reduce(0) { $0 + abs($1.amount?.value ?? 0) }; if abs(seller - buyer) > 1 { add("error", "secondary_amount_mismatch", "\(event.label): 譲渡人受取額と譲受人支払額が一致しない") } }
        }
        for snapshot in snapshots(document: document) {
            let issuedSum = snapshot.holders.reduce(0) { $0 + $1.issued }
            let dilutedSum = snapshot.holders.reduce(0) { $0 + $1.fullyDiluted }
            let issuedRatioSum = snapshot.holders.reduce(0) { $0 + $1.issuedRatio }
            let dilutedRatioSum = snapshot.holders.reduce(0) { $0 + $1.fullyDilutedRatio }
            if issuedSum != snapshot.totalIssued { add("error", "issued_shares_sum_mismatch", "\(snapshot.eventLabel)後の発行済株式数合計が一致しない") }
            if snapshot.totalIssued > 0, abs(issuedRatioSum - 1) > 0.0001 { add("error", "issued_percentage_sum_mismatch", "\(snapshot.eventLabel)後の発行済比率合計が100%ではない") }
            if snapshot.totalFullyDiluted > 0, abs(dilutedRatioSum - 1) > 0.0001 { add("error", "diluted_percentage_sum_mismatch", "\(snapshot.eventLabel)後のFD比率合計が100%ではない") }
            if dilutedSum != snapshot.totalFullyDiluted { add("error", "diluted_shares_sum_mismatch", "\(snapshot.eventLabel)後のFD株式数合計が一致しない") }
            for standing in snapshot.holders { if standing.issued < 0 { add("error", "negative_issued_shares", "\(snapshot.eventLabel)後の発行済株式数が負") }; if standing.fullyDiluted < 0 { add("error", "negative_diluted_shares", "\(snapshot.eventLabel)後のFD株式数が負") }; if standing.issued.rounded() != standing.issued || standing.fullyDiluted.rounded() != standing.fullyDiluted { add("error", "non_integer_cap_table", "\(snapshot.eventLabel)後のキャップテーブルに端株がある") } }
        }
        return issues
    }
    static func publishEligibility(document: AMDOSCapitalDocument) -> AMDOSCapitalPublishEligibility {
        let derived: AMDOSCapitalDocument
        switch safeDerive(document: document) { case .success(let value): derived = value; case .failure(let error): return .init(blockingIssues: [.init(severity: "error", code: "derive_failed", message: error.localizedDescription)], warnings: []) }
        var all = validationIssues(document: derived)
        let events = derived.events.sorted(by: { $0.order < $1.order })
        func add(_ code: String, _ message: String) { all.append(.init(severity: "error", code: code, message: message)) }
        if derived.holders.isEmpty { add("no_holders", "プランに株主が登録されていない") }
        if events.isEmpty { add("no_events", "プランに資本イベントが登録されていない") }
        if let first = events.first { if first.type != "incorporation" { add("submission_first_event_not_incorporation", "最初のイベントは設立にして") } else if !first.allocations.contains(where: { !isDilutive($0.shareClass) && $0.shares.value > 0 }) { add("submission_incorporation_missing_founder_allocation", "設立イベントに創業株主への正の割当がない") } }
        if let last = events.last, last.type != "ipo" { add("submission_last_event_not_ipo", "最後のイベントはIPOにして") }
        var previousDate: String?
        for event in events {
            if event.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { add("submission_event_missing_label", "順序\(event.order)のイベント名が未入力") }
            guard let date = event.date, validISODate(date) else { add("submission_event_invalid_date", "\(event.label)の日付を有効なYYYY-MM-DDで入力して"); continue }
            if let previousDate, date < previousDate { add("submission_event_date_out_of_order", "\(event.label)の日付がイベント順序より前") }; previousDate = date
            if ["equity_issue", "ipo"].contains(event.type) { if event.allocations.isEmpty { add("submission_financing_missing_allocations", "\(event.label)に割当がない") }; let values = [event.preMoneyValuation?.value, event.postMoneyValuation?.value, event.pricePerShare?.value, event.primaryRaise?.value, event.newShares?.value]; if values.contains(where: { ($0 ?? 0) <= 0 }) { add("submission_financing_incomplete", "\(event.label)の評価額・単価・調達額・新規株数が未確定") } }
        }
        return .init(blockingIssues: all.filter { $0.severity == "error" }, warnings: all.filter { $0.severity == "warning" })
    }
    private static func validISODate(_ date: String) -> Bool { let parts = date.split(separator: "-"); guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2, let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]) else { return false }; var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(secondsFromGMT: 0)!; guard let made = calendar.date(from: DateComponents(year: year, month: month, day: day)) else { return false }; let check = calendar.dateComponents([.year, .month, .day], from: made); return check.year == year && check.month == month && check.day == day }
}

// MARK: - PWA dashboard parity

private struct AMDOSParityDashboardActionEnvelope: Decodable, Sendable {
    let ok: Bool
    let items: [AMDOSParityDashboardAction]
}

private struct AMDOSParityDashboardAction: Codable, Identifiable, Sendable {
    let id: String
    let projectID: String?
    let category: String?
    let title: String
    let summary: String?
    let dueAt: String?
    let status: String
    let priority: String?
    let daysLeft: Int?

    enum CodingKeys: String, CodingKey {
        case id = "action_id", projectID = "project_id", category, title, summary
        case dueAt = "due_at", status, priority, daysLeft
    }
}

private struct AMDOSParityDashboardActionPatch: Encodable, Sendable {
    let actionID: String
    let status: String
    enum CodingKeys: String, CodingKey { case actionID = "action_id", status }
}

private struct AMDOSParityDashboardProactiveCounts: Sendable {
    let open: Int
    let overdue: Int
    let red: Int
}

private struct AMDOSParityDashboardFundingEnvelope: Decodable, Sendable {
    let ok: Bool
    let funding: AMDOSParityDashboardFunding
    let grants: AMDOSParityDashboardFunding
}

private struct AMDOSParityDashboardFunding: Decodable, Sendable {
    let totalRaisedYen: Double?
    let totalRegisteredYen: Double?
    let roundCount: Int?
    let contributedRoundCount: Int?
    let fundedPjCount: Int?
    let companyCount: Int?
    let breakdown: [AMDOSParityDashboardFundingBreakdown]
    let totalSecuredYen: Double?
    let securedCount: Int?
    let contributedGrantCount: Int?

    enum CodingKeys: String, CodingKey {
        case totalRaisedYen, totalRegisteredYen, roundCount, contributedRoundCount, fundedPjCount, companyCount
        case breakdown, totalSecuredYen, securedCount, contributedGrantCount
    }
}

private struct AMDOSParityDashboardFundingBreakdown: Decodable, Identifiable, Sendable {
    let projectID: String
    let name: String
    let amountYen: Double
    let registeredYen: Double
    let itemCount: Int
    let contributedItemCount: Int
    var id: String { projectID }
    enum CodingKeys: String, CodingKey {
        case projectID = "projectId", name, amountYen, registeredYen, itemCount, contributedItemCount
    }
}

private struct AMDOSParityDashboardExtractionEnvelope: Decodable, Sendable {
    let ok: Bool
    let checkedAt: String
    let sources: [String: AMDOSParityDashboardExtractionSource]
    let setupIssues: [AMDOSParityDashboardSetupIssue]
}

private struct AMDOSParityDashboardExtractionSource: Decodable, Sendable {
    let count: Int
    let lastCollectedAt: String?
    let lastMeetingEvidenceAt: String?
    let resolution: AMDOSParityDashboardResolution?
}

private struct AMDOSParityDashboardResolution: Decodable, Sendable {
    let reason: String
    let actionLabel: String
    let actionHref: String
}

private struct AMDOSParityDashboardSetupIssue: Decodable, Identifiable, Sendable {
    let projectID: String
    let projectName: String
    let missing: [String]
    var id: String { projectID }
    enum CodingKeys: String, CodingKey { case projectID = "projectId", projectName, missing }
}

private struct AMDOSParityDashboardMember: Decodable, Identifiable, Sendable {
    let id: String
    let codeName: String?
    let memberName: String?
    let role: String?
    let status: String?
    let isOfficer: Bool?
    let joinYm: String?
    let lastLoginAt: String?
    enum CodingKeys: String, CodingKey {
        case id = "member_id", codeName = "code_name", memberName = "member_name", role, status
        case isOfficer = "is_officer", joinYm = "join_ym", lastLoginAt = "last_login_at"
    }
}

private struct AMDOSParityDashboardMemberProfile: Decodable, Identifiable, Sendable {
    let id: String
    let memberID: String?
    let displayName: String?
    let fullName: String?
    let publicTitle: String?
    let internalTitle: String?
    let notionStatus: String?
    let joinedOn: String?
    let effort: Double?
    let bioShort: String?
    let joinContext: String?
    let originLabel: String?
    let residenceLabel: String?
    let offTimeNote: String?
    let favoriteFood: String?
    let bucketList: String?
    let mbtiTags: [String]?
    let visibility: String?
    let status: String?
    let photoAssetID: String?
    enum CodingKeys: String, CodingKey {
        case id = "member_profile_id", memberID = "member_id", displayName = "display_name", fullName = "full_name"
        case publicTitle = "public_title", internalTitle = "internal_title", notionStatus = "notion_status"
        case joinedOn = "joined_on", effort, bioShort = "bio_short", joinContext = "join_context"
        case originLabel = "origin_label", residenceLabel = "residence_label", offTimeNote = "off_time_note"
        case favoriteFood = "favorite_food", bucketList = "bucket_list", mbtiTags = "mbti_tags", visibility, status
        case photoAssetID = "photo_asset_id"
    }
}

private struct AMDOSParityDashboardProjectMember: Decodable, Sendable {
    let projectID: String
    let memberID: String
    enum CodingKeys: String, CodingKey { case projectID = "project_id", memberID = "member_id" }
}

private struct AMDOSParityDashboardCompanyHistory: Decodable, Identifiable, Sendable {
    let id: String
    let projectID: String?
    let occurredOn: String?
    let title: String
    let eventType: String?
    enum CodingKeys: String, CodingKey {
        case id = "event_id", projectID = "project_id", occurredOn = "occurred_on", title, eventType = "event_type"
    }
}

private struct AMDOSParityDashboardProjectEvent: Decodable, Identifiable, Sendable {
    let id: String
    let projectID: String?
    let occurredOn: String?
    let kind: String?
    let label: String?
    enum CodingKeys: String, CodingKey { case id, projectID = "project_id", occurredOn = "occurred_on", kind, label }
}

private struct AMDOSParityDashboardVenture: Decodable, Identifiable, Sendable {
    let id: String
    let foundedAt: String?
    let amdSupportStartedAt: String?
    enum CodingKeys: String, CodingKey { case id = "project_id", foundedAt = "founded_at", amdSupportStartedAt = "amd_support_started_at" }
}

private struct AMDOSParityDashboardMediaAsset: Decodable, Identifiable, Sendable {
    let id: String
    let title: String?
    let assetKind: String?
    let capturedAt: String?
    let usagePermission: String?
    let consentStatus: String?
    let visibility: String?
    let status: String?
    let storagePath: String?
    let thumbnailPath: String?
    enum CodingKeys: String, CodingKey {
        case id = "asset_id", title, assetKind = "asset_kind", capturedAt = "captured_at"
        case usagePermission = "usage_permission", consentStatus = "consent_status", visibility, status
        case storagePath = "storage_path", thumbnailPath = "thumbnail_path"
    }
}

private struct AMDOSParityDashboardMention: Decodable, Identifiable, Sendable {
    let id: String
    let projectID: String
    let occurredOn: String
    let title: String
    let mediaName: String
    let kind: String
    let sourceURL: String?
    enum CodingKeys: String, CodingKey {
        case id, projectID = "project_id", occurredOn = "occurred_on", title, mediaName = "media_name", kind
        case sourceURL = "source_url"
    }
}

private struct AMDOSParityDashboardInstitution: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let shortName: String?
    let type: String
    let description: String?
    let region: String?
    let sortOrder: Int?
    enum CodingKeys: String, CodingKey {
        case id = "institution_id", name, shortName = "short_name", type, description, region, sortOrder = "sort_order"
    }
}

private struct AMDOSParityDashboardAxis: Decodable, Identifiable, Sendable {
    let id: String
    let axisNo: Int
    let name: String
    let weight: Double
    let sortOrder: Int
    enum CodingKeys: String, CodingKey { case id = "axis_id", axisNo = "axis_no", name, weight, sortOrder = "sort_order" }
}

private struct AMDOSParityDashboardCriterion: Decodable, Identifiable, Sendable {
    let id: String
    let axisID: String
    let sortOrder: Int
    enum CodingKeys: String, CodingKey { case id = "criterion_id", axisID = "axis_id", sortOrder = "sort_order" }
}

private struct AMDOSParityDashboardAssessment: Decodable, Sendable {
    let institutionID: String
    let criterionID: String
    let level: Int?
    let na: Bool
    let evaluatedAt: String
    enum CodingKeys: String, CodingKey {
        case institutionID = "institution_id", criterionID = "criterion_id", level, na, evaluatedAt = "evaluated_at"
    }
}

private struct AMDOSParityDashboardECRResult: Sendable {
    let score: Double?
    let axisScores: [Double?]
    let assessedCriteria: Int
    let totalCriteria: Int
}

@MainActor
private final class AMDOSParityDashboardStore: ObservableObject {
    @Published var hud: AMDOSHUDResponse?
    @Published var actions: [AMDOSParityDashboardAction] = []
    @Published var funding: AMDOSParityDashboardFundingEnvelope?
    @Published var extraction: AMDOSParityDashboardExtractionEnvelope?
    @Published var proactive: AMDOSParityDashboardProactiveCounts?
    @Published var members: [AMDOSParityDashboardMember] = []
    @Published var memberProfiles: [AMDOSParityDashboardMemberProfile] = []
    @Published var projectMembers: [AMDOSParityDashboardProjectMember] = []
    @Published var myProjectIDs: Set<String> = []
    @Published var history: [AMDOSParityDashboardCompanyHistory] = []
    @Published var mediaAssets: [AMDOSParityDashboardMediaAsset] = []
    @Published var mentions: [AMDOSParityDashboardMention] = []
    @Published var institutions: [AMDOSParityDashboardInstitution] = []
    @Published var axes: [AMDOSParityDashboardAxis] = []
    @Published var criteria: [AMDOSParityDashboardCriterion] = []
    @Published var assessments: [AMDOSParityDashboardAssessment] = []
    @Published var sourceErrors: [String: String] = [:]
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var actionMessage: String?

    func load(email: String?, isAdmin: Bool) async {
        state = .loading
        sourceErrors = [:]
        actionMessage = nil

        do {
            hud = try await AMDOSRESTClient.shared.fetchPWA(AMDOSHUDResponse.self, path: "/api/hud/dashboard")
        } catch {
            sourceErrors["ダッシュボード集計"] = error.localizedDescription
            state = .failed(error.localizedDescription)
            return
        }

        await loadOptional("要対応") {
            let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSParityDashboardActionEnvelope.self, path: "/api/action-items")
            actions = response.items
        }
        await loadOptional("資金調達・助成金") {
            funding = try await AMDOSRESTClient.shared.fetchPWA(AMDOSParityDashboardFundingEnvelope.self, path: "/api/funding-stats")
        }
        await loadOptional("抽出状況") {
            extraction = try await AMDOSRESTClient.shared.fetchPWA(AMDOSParityDashboardExtractionEnvelope.self, path: "/api/dashboard/extraction-status")
        }
        // PWA dashboard は管理者にだけ、先手TODOの件数バッジを出す。
        // 内容と完了操作は /proactive に集約し、通常メンバーへは枠ごと出さない。
        if isAdmin {
            await loadOptional("Proactive TODO") {
                async let open = AMDOSRESTClient.shared.countTable(table: "proactive_todos", filters: ["status": "eq.open"])
                async let overdue = AMDOSRESTClient.shared.countTable(table: "proactive_todos", filters: ["status": "eq.open", "due_at": "lt.\(ISO8601DateFormatter().string(from: Date()))"])
                async let red = AMDOSRESTClient.shared.countTable(table: "proactive_todos", filters: ["status": "eq.open", "priority": "eq.red"])
                proactive = AMDOSParityDashboardProactiveCounts(
                    open: try await open,
                    overdue: try await overdue,
                    red: try await red
                )
            }
        }
        await loadOptional("メンバー") {
            members = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardMember.self, table: "members", select: "member_id,code_name,member_name,role,status,is_officer,join_ym,last_login_at", filters: ["status": "eq.active"], order: "is_officer.desc,join_ym.asc.nullslast,code_name.asc", limit: 80)
            memberProfiles = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardMemberProfile.self, table: "member_profiles", select: "member_profile_id,member_id,display_name,full_name,public_title,internal_title,notion_status,joined_on,effort,bio_short,join_context,origin_label,residence_label,off_time_note,favorite_food,bucket_list,mbti_tags,visibility,status,photo_asset_id", filters: ["visibility": "in.(internal,public_candidate)", "status": "in.(approved_internal,approved_public)"], order: "display_name.asc", limit: 80)
        }
        await loadOptional("PJ参画") {
            projectMembers = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardProjectMember.self, table: "project_members", select: "project_id,member_id", filters: ["is_active": "eq.true"], limit: 2000)
        }
        await loadOptional("会社の履歴") {
            let company = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardCompanyHistory.self, table: "company_history_events", select: "event_id,project_id,occurred_on,title,event_type", filters: ["visibility": "in.(internal,public_candidate)", "status": "in.(approved_internal,approved_public)"], order: "occurred_on.desc.nullslast", limit: 500)
            if !company.isEmpty {
                history = company
            } else {
                let events = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardProjectEvent.self, table: "project_events", select: "id,project_id,occurred_on,kind,label", order: "occurred_on.desc", limit: 10)
                history = events.map { AMDOSParityDashboardCompanyHistory(id: $0.id, projectID: $0.projectID, occurredOn: $0.occurredOn, title: $0.label ?? $0.kind ?? "履歴", eventType: $0.kind) }
            }
        }
        await loadOptional("会社コンテンツ") {
            mediaAssets = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardMediaAsset.self, table: "media_assets", select: "asset_id,title,asset_kind,captured_at,usage_permission,consent_status,visibility,status,storage_path,thumbnail_path", filters: ["visibility": "in.(internal,public_candidate)", "status": "in.(approved_internal,approved_public)", "usage_permission": "in.(internal_ok,public_ok)", "consent_status": "in.(granted,not_needed)"], order: "captured_at.desc.nullslast", limit: 80)
            mentions = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardMention.self, table: "project_media_mentions", select: "id,project_id,occurred_on,title,media_name,kind,source_url", filters: ["dismissed": "eq.false"], order: "occurred_on.desc", limit: 200)
        }
        await loadOptional("研究機関ECR") {
            institutions = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardInstitution.self, table: "institutions", select: "institution_id,name,short_name,type,description,region,sort_order", order: "sort_order.asc", limit: 300)
            axes = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardAxis.self, table: "institution_capability_axes", select: "axis_id,axis_no,name,weight,sort_order", order: "sort_order.asc", limit: 100)
            criteria = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardCriterion.self, table: "institution_capability_criteria", select: "criterion_id,axis_id,sort_order", order: "sort_order.asc", limit: 1000)
            assessments = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardAssessment.self, table: "institution_assessments", select: "institution_id,criterion_id,level,na,evaluated_at", order: "evaluated_at.desc", limit: 3000)
        }

        // `members` -> `project_members` はPWAの参画PJ並び順と同じ認可済み経路。
        if let email, !email.isEmpty {
            await loadOptional("自分の参画PJ") {
                let memberRows = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardMember.self, table: "members", select: "member_id", filters: ["email": "eq.\(email.lowercased())"], limit: 1)
                guard let memberID = memberRows.first?.id else { return }
                let projectRows = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityDashboardProjectMember.self, table: "project_members", select: "project_id,member_id", filters: ["member_id": "eq.\(memberID)", "is_active": "eq.true"], limit: 2000)
                myProjectIDs = Set(projectRows.map(\.projectID))
            }
        }
        state = .loaded
    }

    func markActionDone(_ item: AMDOSParityDashboardAction) async {
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/action-items", body: AMDOSParityDashboardActionPatch(actionID: item.id, status: "responded"))
            actions.removeAll { $0.id == item.id }
            actionMessage = "要対応を対応済みにしたよ"
        } catch {
            actionMessage = error.localizedDescription
        }
    }

    func ecr(for institutionID: String) -> AMDOSParityDashboardECRResult {
        let latest = latestAssessments(for: institutionID)
        let axisScores = axes.sorted { $0.sortOrder < $1.sortOrder }.map { axis -> Double? in
            let axisCriteria = criteria.filter { $0.axisID == axis.id }
            let scored = axisCriteria.compactMap { criterion -> Double? in
                guard let assessment = latest[criterion.id], !assessment.na, let level = assessment.level else { return nil }
                return min(1, max(0, Double(level - 1) / 4))
            }
            return scored.isEmpty ? nil : scored.reduce(0, +) / Double(scored.count)
        }
        let counted = axes.sorted { $0.sortOrder < $1.sortOrder }.enumerated().map { index, axis in
            let axisCriteria = criteria.filter { $0.axisID == axis.id }
            let total = axisCriteria.filter { latest[$0.id]?.na != true }.count
            let assessed = axisCriteria.filter { latest[$0.id]?.na != true && latest[$0.id]?.level != nil }.count
            return (index, assessed, total)
        }
        let assessed = counted.reduce(0) { $0 + $1.1 }
        let total = counted.reduce(0) { $0 + $1.2 }
        let orderedAxes = axes.sorted { $0.sortOrder < $1.sortOrder }
        let scored = zip(orderedAxes, axisScores).compactMap { axis, score in score.map { (axis.weight, $0) } }
        let weight = scored.reduce(0) { $0 + $1.0 }
        let score = weight > 0 ? scored.reduce(0) { $0 + $1.0 * $1.1 } / weight * 100 : nil
        return AMDOSParityDashboardECRResult(score: score, axisScores: axisScores, assessedCriteria: assessed, totalCriteria: total)
    }

    func isMyProject(_ id: String) -> Bool {
        myProjectIDs.contains(id)
    }

    private func latestAssessments(for institutionID: String) -> [String: AMDOSParityDashboardAssessment] {
        var output: [String: AMDOSParityDashboardAssessment] = [:]
        for row in assessments where row.institutionID == institutionID {
            if output[row.criterionID] == nil { output[row.criterionID] = row }
        }
        return output
    }

    private func loadOptional(_ label: String, operation: () async throws -> Void) async {
        do {
            try await operation()
        } catch {
            sourceErrors[label] = error.localizedDescription
        }
    }
}

struct AMDOSParityDashboardView: View {
    let onSelectProject: (String) -> Void
    let onOpenMypage: () -> Void
    let onOpenProactive: () -> Void
    @EnvironmentObject private var auth: AMDOSAuthStore
    @StateObject private var store = AMDOSParityDashboardStore()
    @StateObject private var myPageStore = AMDOSParityMypageStore()
    @State private var fundingMode = 0

    private var projects: [AMDOSHUDProject] {
        (store.hud?.projects ?? [])
            .filter { $0.projectId != "p00" && $0.projectCategory != "institution" }
            .sorted { lhs, rhs in
                let lm = store.isMyProject(lhs.projectId) ? 0 : 1
                let rm = store.isMyProject(rhs.projectId) ? 0 : 1
                if lm != rm { return lm < rm }
                let ls = store.hud?.scoreHistory[lhs.projectId]?.last ?? -Double.greatestFiniteMagnitude
                let rs = store.hud?.scoreHistory[rhs.projectId]?.last ?? -Double.greatestFiniteMagnitude
                if ls != rs { return ls > rs }
                return lhs.projectName < rhs.projectName
            }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "DASHBOARD", title: "今日のAMD OS", subtitle: "PWA /dashboard の判断、PJ比較、請求、経営スコア、研究機関ECR、会社コンテンツ") {
            AMDOSStateNotice(state: store.state) { Task { await store.load(email: auth.email, isAdmin: auth.isAdmin) } }
            ForEach(store.sourceErrors.keys.sorted(), id: \.self) { key in
                if let error = store.sourceErrors[key] { AMDOSParityDashboardSourceError(label: key, message: error) }
            }
            if let hud = store.hud {
                dashboardSummary(hud)
                fundingSection
                managementSection(hud)
                actionSection
                proactiveSection
                projectSection(hud)
                institutionSection
                companySection(hud)
                myPageSection
            }
            if let actionMessage = store.actionMessage { Text(actionMessage).font(.caption).foregroundStyle(AMDOSDesign.muted) }
        }
        .task {
            await store.load(email: auth.email, isAdmin: auth.isAdmin)
            await myPageStore.load(email: auth.email)
        }
    }

    private func dashboardSummary(_ hud: AMDOSHUDResponse) -> some View {
        HStack(spacing: 12) {
            AMDOSMetricTile(label: "PJ", value: "\(projects.count)", detail: "PWAと同じ全PJ集計")
            AMDOSMetricTile(label: "未処理の要対応", value: "\(store.actions.count)", detail: "管理者APIのconfirmed/open")
            AMDOSMetricTile(label: "Management Score", value: amdOSDashboardNumber(hud.managementScore?.totalScore), detail: hud.managementScore?.ym ?? hud.ym ?? "—", tint: AMDOSDesign.warning)
            AMDOSMetricTile(label: "ECR機関", value: "\(store.institutions.count)", detail: "研究機関の充足率")
        }
    }

    @ViewBuilder
    private var fundingSection: some View {
        if let funding = store.funding {
            AMDOSSectionCard("AMD全体 累計実績", systemImage: "banknote.fill") {
                Picker("表示", selection: $fundingMode) {
                    Text("累計").tag(0); Text("会社別").tag(1); Text("行別").tag(2)
                }.pickerStyle(.segmented)
                HStack(spacing: 12) {
                    AMDOSMetricTile(label: "AMD貢献 累計資金調達額", value: amdOSDashboardYen(funding.funding.totalRaisedYen ?? 0), detail: "\(funding.funding.contributedRoundCount ?? 0) / \(funding.funding.roundCount ?? 0) ラウンド", tint: AMDOSDesign.success)
                    AMDOSMetricTile(label: "AMD貢献 累計助成金・補助金", value: amdOSDashboardYen(funding.grants.totalSecuredYen ?? 0), detail: "\(funding.grants.contributedGrantCount ?? 0) / \(funding.grants.securedCount ?? 0) 件", tint: AMDOSDesign.blue)
                }
                if fundingMode > 0 {
                    let rows = funding.funding.breakdown + funding.grants.breakdown
                    if rows.isEmpty { Text("登録された資金調達・助成金はないよ。").foregroundStyle(AMDOSDesign.muted) }
                    ForEach(rows) { row in
                        AMDOSLineItem(title: row.name, subtitle: "\(row.projectID) · \(row.itemCount)件 · AMD貢献 \(amdOSDashboardYen(row.amountYen)) · 登録 \(amdOSDashboardYen(row.registeredYen))", status: "\(row.contributedItemCount)件")
                    }
                }
                Text("累計値はAMD貢献額のみ。未判定・非貢献の行は台帳に残し、累計から外す。").font(.caption2).foregroundStyle(AMDOSDesign.muted)
            }
        }
    }

    @ViewBuilder
    private func managementSection(_ hud: AMDOSHUDResponse) -> some View {
        AMDOSSectionCard("バイタルサイン / Management Score", systemImage: "gauge.with.dots.needle.67percent") {
            if let score = hud.managementScore {
                HStack(spacing: 18) {
                    AMDOSMetricTile(label: "TOTAL", value: amdOSDashboardNumber(score.totalScore), detail: "\(score.ym) · confidence \(amdOSDashboardNumber(score.confidence))", tint: AMDOSDashboardScoreColor.color(score.totalScore))
                    AMDOSMetricTile(label: "主体", value: amdOSDashboardNumber(score.initiativeScore), detail: "initiative")
                    AMDOSMetricTile(label: "財務", value: amdOSDashboardNumber(score.financeScore), detail: "finance")
                    AMDOSMetricTile(label: "継続", value: amdOSDashboardNumber(score.retentionScore), detail: "retention")
                    AMDOSMetricTile(label: "案件", value: amdOSDashboardNumber(score.pipelineScore), detail: "pipeline")
                    AMDOSMetricTile(label: "方向", value: amdOSDashboardNumber(score.directionScore), detail: "direction")
                }
                if !hud.managementHistory.isEmpty {
                    Text("月次履歴").font(.caption.weight(.semibold))
                    ForEach(hud.managementHistory) { row in
                        AMDOSLineItem(title: row.ym, subtitle: "主体 \(amdOSDashboardNumber(row.initiativeScore)) · 財務 \(amdOSDashboardNumber(row.financeScore)) · 継続 \(amdOSDashboardNumber(row.retentionScore)) · 案件 \(amdOSDashboardNumber(row.pipelineScore)) · 方向 \(amdOSDashboardNumber(row.directionScore))", status: amdOSDashboardNumber(row.totalScore))
                    }
                }
            } else {
                Text("経営スコアのスナップショットはないよ。").foregroundStyle(AMDOSDesign.muted)
            }
        }
    }

    @ViewBuilder
    private var actionSection: some View {
        if !store.actions.isEmpty {
            AMDOSSectionCard("📌 要対応（期日順）", systemImage: "checklist") {
                ForEach(store.actions) { item in
                    HStack(alignment: .top, spacing: 10) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title).font(.body.weight(.medium))
                            Text([item.summary, item.projectID, item.dueAt].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                        Spacer()
                        AMDOSStatusBadge(text: amdOSDashboardDueLabel(item), tint: item.daysLeft.map { $0 < 0 ? .red : $0 <= 3 ? AMDOSDesign.warning : AMDOSDesign.blue } ?? AMDOSDesign.muted)
                        Button("対応済") { Task { await store.markActionDone(item) } }.buttonStyle(.bordered)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var proactiveSection: some View {
        if let counts = store.proactive {
            let urgent = counts.overdue > 0 || counts.red > 0
            Button(action: onOpenProactive) {
                HStack(spacing: 12) {
                    Image(systemName: urgent ? "exclamationmark.triangle.fill" : "checklist")
                        .font(.title3)
                        .foregroundStyle(urgent ? .red : counts.open > 0 ? AMDOSDesign.warning : AMDOSDesign.muted)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("先手 TODO").font(.headline)
                        if counts.open == 0 {
                            Text("未対応なし。次のMTG後・予定MTG前に自動で再起する。")
                        } else {
                            Text("\(counts.open)件 未対応\(counts.overdue > 0 ? " · 期限超過 \(counts.overdue)件" : "")\(counts.red > 0 && counts.red != counts.overdue ? " · 🔴 \(counts.red)件" : "")")
                        }
                    }
                    .foregroundStyle(AMDOSDesign.ink)
                    .font(.caption)
                    Spacer()
                    Image(systemName: "arrow.right").foregroundStyle(AMDOSDesign.muted)
                }
                .padding(14)
                .background(urgent ? Color.red.opacity(0.06) : counts.open > 0 ? AMDOSDesign.warning.opacity(0.07) : AMDOSDesign.panel)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(urgent ? Color.red.opacity(0.35) : AMDOSDesign.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func projectSection(_ hud: AMDOSHUDResponse) -> some View {
        let groups = [("Active", projects.filter { $0.status == "active" }), ("Sales / Draft", projects.filter { $0.status == "sales" || $0.status == "draft" }), ("Ended / Frozen", projects.filter { !["active", "sales", "draft"].contains($0.status ?? "") })]
        ForEach(groups, id: \.0) { label, rows in
            if !rows.isEmpty {
                AMDOSSectionCard("\(label) (\(rows.count))", systemImage: label == "Active" ? "bolt.fill" : "folder") {
                    ForEach(rows) { project in
                        AMDOSParityDashboardProjectStripe(project: project, hud: hud, isMine: store.isMyProject(project.projectId), onSelect: onSelectProject)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var institutionSection: some View {
        if !store.institutions.isEmpty {
            AMDOSSectionCard("研究機関 — ECR / エコシステム構築率", systemImage: "building.columns.fill") {
                Text("苗床レイヤー。AMD Scoreとは別に、機関がベンチャーを生み育てる装置として整備されている度合いを充足率0–100%で表示。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                ForEach(store.institutions) { institution in
                    let result = store.ecr(for: institution.id)
                    VStack(alignment: .leading, spacing: 7) {
                        HStack { Text(institution.shortName ?? institution.name).font(.headline); Spacer(); AMDOSStatusBadge(text: result.score.map { "\(Int($0.rounded()))%" } ?? "未評価", tint: AMDOSDashboardScoreColor.color(result.score)) }
                        Text([institution.name, institution.region, institution.description].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                        HStack(spacing: 3) {
                            ForEach(Array(result.axisScores.enumerated()), id: \.offset) { index, score in
                                VStack(spacing: 2) { Text("\(index + 1)").font(.caption2); RoundedRectangle(cornerRadius: 2).fill(AMDOSDashboardScoreColor.color(score.map { $0 * 100 })).frame(height: 13) }
                            }
                        }
                        Text("評価済 \(result.assessedCriteria)/\(result.totalCriteria) · 契約状態 \(institution.type)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }.padding(.vertical, 5)
                }
            }
        }
    }

    @ViewBuilder
    private func companySection(_ hud: AMDOSHUDResponse) -> some View {
        AMDOSSectionCard("会社コンテンツ", systemImage: "person.3.fill") {
            if store.members.isEmpty && store.history.isEmpty && store.mediaAssets.isEmpty && store.mentions.isEmpty {
                Text("会社コンテンツの承認済みデータはないよ。").foregroundStyle(AMDOSDesign.muted)
            } else {
                if !store.members.isEmpty {
                    Text("メンバー").font(.caption.weight(.semibold))
                    ForEach(store.members) { member in
                        let profile = store.memberProfiles.first { $0.memberID == member.id }
                        AMDOSLineItem(title: profile?.displayName ?? member.codeName ?? member.memberName ?? member.id, subtitle: [profile?.publicTitle ?? profile?.internalTitle ?? member.role, profile?.bioShort, member.lastLoginAt.map { "最終ログイン \($0)" }].compactMap { $0 }.joined(separator: " · "), status: member.isOfficer == true ? "役員" : member.status)
                    }
                }
                if !store.history.isEmpty {
                    Text("会社の歩み").font(.caption.weight(.semibold))
                    ForEach(store.history.prefix(12)) { item in AMDOSLineItem(title: item.title, subtitle: [item.occurredOn, item.projectID].compactMap { $0 }.joined(separator: " · "), status: item.eventType) }
                }
                if !store.mediaAssets.isEmpty {
                    Text("承認済みメディア").font(.caption.weight(.semibold))
                    ForEach(store.mediaAssets) { asset in AMDOSLineItem(title: asset.title ?? asset.id, subtitle: [asset.assetKind, asset.capturedAt, asset.storagePath].compactMap { $0 }.joined(separator: " · "), status: asset.usagePermission ?? asset.status) }
                }
                if !store.mentions.isEmpty {
                    Text("メディア掲載").font(.caption.weight(.semibold))
                    ForEach(store.mentions.prefix(12)) { item in AMDOSLineItem(title: item.title, subtitle: "\(item.mediaName) · \(item.occurredOn) · \(item.projectID)", status: item.kind) }
                }
            }
        }
    }

    @ViewBuilder
    private var myPageSection: some View {
        AMDOSSectionCard("マイページ / 自分の活動", systemImage: "person.fill") {
            AMDOSStateNotice(state: myPageStore.state) { Task { await myPageStore.load(email: auth.email) } }
            if let member = myPageStore.member {
                let current = myPageStore.months.first(where: \.isCurrent) ?? myPageStore.months.first
                HStack(spacing: 10) {
                    AMDOSMetricTile(label: "表示名", value: member.codeName, detail: member.email ?? auth.email ?? "—")
                    AMDOSMetricTile(label: "当月報酬", value: amdOSParityRewardText(current?.projects.filter(\.rewardEligible).compactMap(\.reward).reduce(0, +), hidden: member.rewardAmountHidden), detail: "PWA /mypage")
                    AMDOSMetricTile(label: "担当PJ", value: "\(current?.projects.count ?? 0)", detail: "直近月")
                    AMDOSMetricTile(label: "今週", value: "\(myPageStore.weeklyActivities.count)", detail: "抽出済み活動")
                }
                ForEach((current?.projects ?? []).prefix(8)) { project in
                    HStack {
                        Button(project.name) { onSelectProject(project.id) }.buttonStyle(.link)
                        Spacer()
                        Text(project.billingStatus).font(.caption).foregroundStyle(AMDOSDesign.muted)
                        AMDOSStatusBadge(text: project.rewardEligible ? "予定" : "確認保留", tint: project.rewardEligible ? AMDOSDesign.success : AMDOSDesign.warning)
                    }
                }
                if !myPageStore.weeklyActivities.isEmpty {
                    Text("今週やったこと").font(.caption.weight(.semibold))
                    ForEach(myPageStore.weeklyActivities.prefix(6), id: \.id) { item in
                        AMDOSLineItem(title: item.title, subtitle: "\(item.projectName) · \(item.source) · \(item.date ?? "")", status: "抽出")
                    }
                }
                HStack { Spacer(); Button("マイページを開く", action: onOpenMypage).buttonStyle(.bordered) }
            }
        }
    }
}

private struct AMDOSParityDashboardProjectStripe: View {
    let project: AMDOSHUDProject
    let hud: AMDOSHUDResponse
    let isMine: Bool
    let onSelect: (String) -> Void

    var body: some View {
        Button { onSelect(project.projectId) } label: {
            AMDOSCard {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(project.projectId).font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                        Text(project.displayName ?? project.projectName).font(.headline)
                        if isMine { AMDOSStatusBadge(text: "参画", tint: AMDOSDesign.success) }
                        Spacer()
                        AMDOSStatusBadge(text: project.status ?? "—", tint: project.status == "active" ? AMDOSDesign.success : AMDOSDesign.blue)
                    }
                    Text([project.clientName, project.roleLine, project.startYm.map { "開始 \($0)" }, project.endYm.map { "終了 \($0)" }].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                    HStack(spacing: 12) {
                        let primary = hud.primarySnapshots?[project.projectId]
                        AMDOSMetricTile(label: "SPS Primary", value: primary?.score.map { amdOSDashboardNumber($0) } ?? "—", detail: primary?.status == "ready" ? "ready" : (primary?.missingAxes.isEmpty == false ? "入力待ち: \(primary?.missingAxes.joined(separator: ",") ?? "")" : "review待ち"), tint: AMDOSDesign.blue)
                        let metrics = hud.signalMetrics[project.projectId]
                        AMDOSMetricTile(label: "M / X / F", value: [metrics?.m, metrics?.x, metrics?.f].map { amdOSDashboardNumber($0) }.joined(separator: " / "), detail: "AMD Score signal")
                        AMDOSMetricTile(label: "請求・報告", value: amdOSDashboardBillingState(hud.billingStatus[project.projectId]), detail: hud.billingStatus[project.projectId]?.ym ?? hud.ym ?? "—")
                        if let values = hud.scoreHistory[project.projectId], values.count > 1 { AMDOSDashboardSparkline(values: values).frame(width: 150, height: 42) }
                    }
                }
            }
        }.buttonStyle(.plain)
    }
}

private struct AMDOSDashboardSparkline: View {
    let values: [Double]
    var body: some View {
        Canvas { context, size in
            guard values.count > 1 else { return }
            let minValue = values.min() ?? 0
            let range = max((values.max() ?? 1) - minValue, 1)
            var path = Path()
            for (index, value) in values.enumerated() {
                let x = size.width * CGFloat(index) / CGFloat(values.count - 1)
                let y = size.height - CGFloat((value - minValue) / range) * (size.height - 4) - 2
                if index == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
            }
            context.stroke(path, with: .color(AMDOSDesign.blue), lineWidth: 2)
        }
    }
}

private struct AMDOSParityDashboardSourceError: View {
    let label: String
    let message: String
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 4) {
                Label("\(label)を取得できなかった", systemImage: "exclamationmark.triangle.fill").foregroundStyle(AMDOSDesign.warning)
                Text(message).font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
            }
        }
    }
}

private enum AMDOSDashboardScoreColor {
    static func color(_ value: Double?) -> Color {
        guard let value else { return AMDOSDesign.muted }
        if value >= 75 { return AMDOSDesign.success }
        if value >= 55 { return AMDOSDesign.warning }
        return .red
    }
}

private func amdOSDashboardNumber(_ value: Double?) -> String {
    guard let value else { return "—" }
    return value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
}

private func amdOSDashboardYen(_ value: Double) -> String {
    if value >= 100_000_000 { return String(format: "%.2f億円", value / 100_000_000) }
    if value >= 10_000 { return "\(Int((value / 10_000).rounded()).formatted())万円" }
    return "\(Int(value.rounded()).formatted())円"
}

private func amdOSDashboardBillingState(_ billing: AMDOSHUDBillingStatus?) -> String {
    guard let billing else { return "—" }
    let steps = [billing.budgetDone, billing.reportDone, billing.invoiceDone, billing.paymentDone]
    return steps.map { $0 == true ? "●" : "○" }.joined(separator: " ")
}

private func amdOSDashboardDueLabel(_ item: AMDOSParityDashboardAction) -> String {
    guard let days = item.daysLeft else { return "期日なし" }
    if days < 0 { return "期限超過 \(-days)日" }
    if days == 0 { return "今日" }
    return "あと\(days)日"
}
