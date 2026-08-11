import SwiftUI
import AppKit

private func adminNowISO() -> String {
    ISO8601DateFormatter().string(from: Date())
}

private struct AMDOSAdminInlineMessage: View {
    let text: String?
    var body: some View {
        if let text, !text.isEmpty {
            Text(text).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
        }
    }
}

private struct AMDOSAdminCount: Codable, Sendable {
    let projects: Int
    let members: Int
    let obligations: Int
    let openTodos: Int
}

struct AMDOSAdminHomeView: View {
    @State private var count: AMDOSAdminCount?
    @State private var state: AMDOSFeatureLoadState = .idle
    var body: some View {
        AMDOSPageScaffold(eyebrow: "ADMIN", title: "管理ホーム", subtitle: "管理領域の正本件数と、未処理の運用項目を確認") {
            AMDOSStateNotice(state: state) { load() }
            if let count {
                HStack {
                    AMDOSMetricTile(label: "PJ", value: "\(count.projects)", detail: "projects")
                    AMDOSMetricTile(label: "メンバー", value: "\(count.members)", detail: "members")
                    AMDOSMetricTile(label: "支払義務", value: "\(count.obligations)", detail: "company_payment_obligations")
                    AMDOSMetricTile(label: "先手TODO", value: "\(count.openTodos)", detail: "未解決")
                }
                AMDOSSectionCard("管理領域", systemImage: "slider.horizontal.3") {
                    Text("請求・財務・支払・契約・メンバー・会社情報・運営カレンダーは左の管理メニューから開けるよ。")
                    Text("各画面は管理者認証を通したPWA APIまたはRLS付き読み取りだけを使う。")
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
            }
        }.task { load() }
    }
    private func load() {
        Task {
            state = .loading
            do {
                async let projects = AMDOSRESTClient.shared.fetchTable(AMDOSProject.self, table: "projects", select: "project_id,project_name,client_name,status,start_ym,end_ym,project_type", limit: 1_000)
                async let members = AMDOSRESTClient.shared.fetchTable(AMDOSAdminMember.self, table: "members", select: "id,member_id,member_name,code_name,email,status,is_admin,is_officer,exclude_from_payout_notice,updated_at", limit: 1_000)
                async let obligations = AMDOSRESTClient.shared.fetchTable(AMDOSPaymentObligation.self, table: "company_payment_obligations", select: "id,title,counterparty,category,amount_yen,amount_status,due_date,expected_payment_ym,status,cashflow_treatment,source_kind,updated_at", filters: ["status": "in.(needs_review,open,scheduled)"])
                async let todos = AMDOSRESTClient.shared.fetchTable(AMDOSAdminTodo.self, table: "proactive_todos", select: "id,title,detail,status,priority,due_at", filters: ["status": "in.(open,blocked)", "attention_state": "eq.approved", "attention_type": "in.(decision,masa_action)"])
                count = AMDOSAdminCount(projects: try await projects.count, members: try await members.count, obligations: try await obligations.count, openTodos: try await todos.count)
                state = .loaded
            } catch { state = .failed(error.localizedDescription) }
        }
    }
}

private struct AMDOSAdminContext: Codable, Identifiable, Sendable {
    let id: String
    let contextId: String
    let tags: String?
    let priority: Int?
    let systemPrompt: String
    let status: String
    let createdAt: String?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id, contextId = "context_id", tags, priority, systemPrompt = "system_prompt", status, createdAt = "created_at", updatedAt = "updated_at" }
}

struct AMDOSAdminContextsView: View {
    @State private var rows: [AMDOSAdminContext] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var filterQuery = ""
    @State private var filterStatus = ""
    @State private var filterTag = ""
    @State private var expandedID: String?
    @State private var editingID: String?
    @State private var editTags = ""
    @State private var editPriority = 0
    @State private var editPrompt = ""
    @State private var editStatus = "active"
    @State private var showingNew = false
    @State private var newContextID = ""
    @State private var newTags = ""
    @State private var newPriority = 0
    @State private var newPrompt = ""
    @State private var newStatus = "active"
    @State private var archiveTarget: AMDOSAdminContext?
    @State private var saving = false
    @State private var message: String?

    private var availableTags: [String] {
        Array(Set(rows.flatMap { ($0.tags ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } })).sorted()
    }

    private var filteredRows: [AMDOSAdminContext] {
        rows.filter { row in
            if !filterStatus.isEmpty && row.status != filterStatus { return false }
            if !filterTag.isEmpty && !(row.tags ?? "").split(separator: ",").map({ $0.trimmingCharacters(in: .whitespaces) }).contains(filterTag) { return false }
            let q = filterQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !q.isEmpty else { return true }
            return [row.contextId, row.tags ?? "", row.systemPrompt].joined(separator: " ").lowercased().contains(q)
        }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ADMIN CONTEXTS", title: "LLM Context", subtitle: "tsukuyomi_context の人格・判断基準・PJ背景を優先度順で確認") {
            AMDOSStateNotice(state: state) { load() }
            HStack(alignment: .bottom, spacing: 10) {
                AMDOSTextField(title: "検索", text: $filterQuery)
                Picker("status", selection: $filterStatus) { Text("すべて").tag(""); Text("active").tag("active"); Text("archived").tag("archived") }.frame(width: 135)
                Picker("tag", selection: $filterTag) { Text("すべて").tag(""); ForEach(availableTags, id: \.self) { Text($0).tag($0) } }.frame(width: 155)
                Button("リセット") { filterQuery = ""; filterStatus = ""; filterTag = "" }.buttonStyle(.bordered)
                Spacer()
                Button(showingNew ? "追加を閉じる" : "＋ 追加") { showingNew.toggle() }.buttonStyle(.borderedProminent)
            }
            if let message { AMDOSAdminInlineMessage(text: message) }
            if showingNew { newForm }
            Text("\(filteredRows.count) 件").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if filteredRows.isEmpty && state == .loaded { Text("該当なし").foregroundStyle(AMDOSDesign.muted) }
            ForEach(filteredRows) { row in
                contextRow(row)
            }
        }
        .confirmationDialog("このContextをarchiveにする？", isPresented: Binding(get: { archiveTarget != nil }, set: { if !$0 { archiveTarget = nil } }), titleVisibility: .visible) {
            Button("archiveにする", role: .destructive) { if let target = archiveTarget { archive(target) } }
            Button("キャンセル", role: .cancel) { archiveTarget = nil }
        } message: {
            Text(archiveTarget?.contextId ?? "")
        }
        .task { load() }
    }

    @ViewBuilder
    private var newForm: some View {
        AMDOSSectionCard("LLM Context 追加", systemImage: "plus.circle") {
            AMDOSTextField(title: "context_id *", text: $newContextID)
            AMDOSTextField(title: "tags（カンマ区切り）", text: $newTags)
            Stepper("priority: \(newPriority)", value: $newPriority, in: -100...100)
            Picker("status", selection: $newStatus) { Text("active").tag("active"); Text("archived").tag("archived") }.pickerStyle(.segmented)
            VStack(alignment: .leading, spacing: 6) { Text("system_prompt *").font(.caption); TextEditor(text: $newPrompt).font(.body.monospaced()).frame(minHeight: 130).overlay(RoundedRectangle(cornerRadius: 7).stroke(AMDOSDesign.border, lineWidth: 1)) }
            HStack { Button(saving ? "作成中…" : "作成") { create() }.disabled(saving); Button("キャンセル") { resetNewForm(); showingNew = false }.buttonStyle(.bordered) }
        }
    }

    @ViewBuilder
    private func contextRow(_ row: AMDOSAdminContext) -> some View {
        let isEditing = editingID == row.id
        let isExpanded = expandedID == row.id
        AMDOSSectionCard(row.contextId, systemImage: "text.book.closed") {
            HStack {
                AMDOSStatusBadge(text: row.status)
                Text("優先度 \(row.priority ?? 0)").font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button(isExpanded ? "閉じる" : "展開") { expandedID = isExpanded ? nil : row.id }.buttonStyle(.bordered)
                if isEditing {
                    Button(saving ? "保存中…" : "保存") { saveEdit(row) }.disabled(saving).buttonStyle(.borderedProminent)
                    Button("取消") { editingID = nil }.buttonStyle(.bordered)
                } else {
                    Button("編集") { beginEdit(row) }.buttonStyle(.bordered)
                    if row.status == "active" { Button("archive") { archiveTarget = row }.buttonStyle(.bordered) }
                }
            }
            if isEditing {
                AMDOSTextField(title: "tags", text: $editTags)
                Stepper("priority: \(editPriority)", value: $editPriority, in: -100...100)
                Picker("status", selection: $editStatus) { Text("active").tag("active"); Text("archived").tag("archived") }.pickerStyle(.segmented)
                VStack(alignment: .leading, spacing: 6) { Text("system_prompt").font(.caption); TextEditor(text: $editPrompt).font(.body.monospaced()).frame(minHeight: 180).overlay(RoundedRectangle(cornerRadius: 7).stroke(AMDOSDesign.border, lineWidth: 1)) }
            } else {
                if let tags = row.tags, !tags.isEmpty { Text(tags).font(.caption).foregroundStyle(AMDOSDesign.blue) }
                Text(row.systemPrompt).lineLimit(isExpanded ? nil : 2).textSelection(.enabled)
                Text(row.updatedAt ?? row.createdAt ?? "更新日時なし").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
        }
    }

    private func beginEdit(_ row: AMDOSAdminContext) {
        editingID = row.id; expandedID = row.id; editTags = row.tags ?? ""; editPriority = row.priority ?? 0; editPrompt = row.systemPrompt; editStatus = row.status
    }

    private func create() {
        let id = newContextID.trimmingCharacters(in: .whitespacesAndNewlines)
        let prompt = newPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty && !prompt.isEmpty else { message = "context_id と system_prompt は必須"; return }
        Task { saving = true; defer { saving = false }; do { let now = adminNowISO(); _ = try await AMDOSRESTClient.shared.postTable(table: "tsukuyomi_context", body: AMDOSAdminContextCreate(contextID: id, tags: newTags, priority: newPriority, systemPrompt: prompt, status: newStatus, createdAt: now, updatedAt: now)); message = "\(id) を作成したよ"; resetNewForm(); showingNew = false; load() } catch { message = error.localizedDescription } }
    }

    private func saveEdit(_ row: AMDOSAdminContext) {
        Task { saving = true; defer { saving = false }; do { _ = try await AMDOSRESTClient.shared.patchTable(table: "tsukuyomi_context", filters: ["id": "eq.\(row.id)"], body: AMDOSAdminContextPatch(tags: editTags, priority: editPriority, systemPrompt: editPrompt, status: editStatus, updatedAt: adminNowISO())); message = "\(row.contextId) を更新したよ"; editingID = nil; load() } catch { message = error.localizedDescription } }
    }

    private func archive(_ row: AMDOSAdminContext) {
        Task { do { _ = try await AMDOSRESTClient.shared.patchTable(table: "tsukuyomi_context", filters: ["id": "eq.\(row.id)"], body: AMDOSAdminContextArchive(status: "archived", updatedAt: adminNowISO())); message = "\(row.contextId) をarchiveにしたよ"; archiveTarget = nil; load() } catch { message = error.localizedDescription } }
    }

    private func resetNewForm() { newContextID = ""; newTags = ""; newPriority = 0; newPrompt = ""; newStatus = "active" }

    private func load() { Task { state = .loading; do { rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSAdminContext.self, table: "tsukuyomi_context", select: "id,context_id,tags,priority,system_prompt,status,created_at,updated_at", order: "priority.desc,context_id", limit: 500); state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
}

private struct AMDOSAdminContextPatch: Encodable, Sendable {
    let tags: String; let priority: Int; let systemPrompt: String; let status: String; let updatedAt: String
    enum CodingKeys: String, CodingKey { case tags, priority, status; case systemPrompt = "system_prompt"; case updatedAt = "updated_at" }
}
private struct AMDOSAdminContextArchive: Encodable, Sendable { let status: String; let updatedAt: String; enum CodingKeys: String, CodingKey { case status; case updatedAt = "updated_at" } }
private struct AMDOSAdminContextCreate: Encodable, Sendable {
    let contextID: String; let tags: String; let priority: Int; let systemPrompt: String; let status: String; let createdAt: String; let updatedAt: String
    enum CodingKeys: String, CodingKey { case tags, priority, status; case contextID = "context_id"; case systemPrompt = "system_prompt"; case createdAt = "created_at"; case updatedAt = "updated_at" }
}

private struct AMDOSCompanyProfileEntry: Codable, Identifiable, Sendable {
    let id: String; let key: String?; let title: String; let visibility: String; let status: String; let sourceKind: String?; let sourceRef: String?; let notionSourceID: String?; let reviewedAt: String?; let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id = "entry_id", key = "entry_key", title, visibility, status, sourceKind = "source_kind", sourceRef = "source_ref", notionSourceID = "notion_source_id", reviewedAt = "reviewed_at", updatedAt = "updated_at" }
}
private struct AMDOSCompanyMemberProfile: Codable, Identifiable, Sendable {
    let id: String; let memberId: String?; let displayName: String; let fullName: String?; let publicTitle: String?; let internalTitle: String?; let notionStatus: String?; let joinedOn: String?; let effort: Double?; let bioShort: String?; let visibility: String; let status: String; let sourceKind: String?; let sourceRef: String?; let notionSourceID: String?; let photoAssetID: String?; let reviewedAt: String?; let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id = "member_profile_id", memberId = "member_id", displayName = "display_name", fullName = "full_name", publicTitle = "public_title", internalTitle = "internal_title", notionStatus = "notion_status", joinedOn = "joined_on", effort, bioShort = "bio_short", visibility, status, sourceKind = "source_kind", sourceRef = "source_ref", notionSourceID = "notion_source_id", photoAssetID = "photo_asset_id", reviewedAt = "reviewed_at", updatedAt = "updated_at" }
}
private struct AMDOSCompanyHistory: Codable, Identifiable, Sendable {
    let id: String; let date: String?; let title: String; let eventType: String?; let projectId: String?; let importance: String?; let visibility: String; let status: String; let sourceKind: String?; let sourceRef: String?; let notionSourceID: String?; let reviewedAt: String?; let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id = "event_id", date = "occurred_on", title, eventType = "event_type", projectId = "project_id", importance, visibility, status, sourceKind = "source_kind", sourceRef = "source_ref", notionSourceID = "notion_source_id", reviewedAt = "reviewed_at", updatedAt = "updated_at" }
}
private struct AMDOSCompanyMedia: Codable, Identifiable, Sendable {
    let id: String; let title: String; let assetKind: String?; let capturedAt: String?; let usagePermission: String?; let consentStatus: String?; let visibility: String; let status: String; let sourceKind: String?; let sourceRef: String?; let notionSourceID: String?; let storagePath: String?; let thumbnailPath: String?; let reviewedAt: String?; let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id = "asset_id", title, assetKind = "asset_kind", capturedAt = "captured_at", usagePermission = "usage_permission", consentStatus = "consent_status", visibility, status, sourceKind = "source_kind", sourceRef = "source_ref", notionSourceID = "notion_source_id", storagePath = "storage_path", thumbnailPath = "thumbnail_path", reviewedAt = "reviewed_at", updatedAt = "updated_at" }
}

struct AMDOSAdminCompanyView: View {
    @State private var profiles: [AMDOSCompanyProfileEntry] = []
    @State private var members: [AMDOSCompanyMemberProfile] = []
    @State private var history: [AMDOSCompanyHistory] = []
    @State private var media: [AMDOSCompanyMedia] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    var body: some View {
        AMDOSPageScaffold(eyebrow: "ADMIN COMPANY", title: "Company Content", subtitle: "PWA Admin Companyと同じレビュー待ちキューを、プロフィール・チーム・沿革・メディアに分けて確認") {
            AMDOSStateNotice(state: state) { load() }
            HStack { AMDOSMetricTile(label: "レビュー待ち", value: "\(needsReview)", detail: "imported / needs_review", tint: needsReview > 0 ? AMDOSDesign.warning : AMDOSDesign.success); AMDOSMetricTile(label: "チーム", value: "\(members.count)", detail: "member profiles"); AMDOSMetricTile(label: "沿革", value: "\(history.count)", detail: "history events"); AMDOSMetricTile(label: "メディア", value: "\(media.count)", detail: "media assets") }
            AMDOSSectionCard("プロフィール", systemImage: "building.2") { ForEach(profiles) { row in AMDOSLineItem(title: row.title, subtitle: [row.key, row.visibility, row.sourceKind, row.sourceRef ?? row.notionSourceID].compactMap { $0 }.joined(separator: " · "), status: row.status) } }
            AMDOSSectionCard("チーム", systemImage: "person.2") { ForEach(members) { row in HStack(alignment: .top) { if let assetID = row.photoAssetID { AMDOSAdminCompanyMediaThumbnail(assetID: assetID) }; VStack(alignment: .leading) { AMDOSLineItem(title: row.displayName, subtitle: [row.fullName, row.publicTitle ?? row.internalTitle, row.notionStatus, row.joinedOn, row.effort.map { "effort \(Int($0 * 100))%" }, row.bioShort, row.sourceKind, row.sourceRef ?? row.notionSourceID].compactMap { $0 }.joined(separator: " · "), status: row.status) } } } }
            AMDOSSectionCard("沿革", systemImage: "clock") { ForEach(history) { row in AMDOSLineItem(title: row.title, subtitle: [row.date, row.eventType, row.projectId, row.sourceKind, row.sourceRef ?? row.notionSourceID].compactMap { $0 }.joined(separator: " · "), status: row.status) } }
            AMDOSSectionCard("メディア", systemImage: "photo.on.rectangle") { ForEach(media) { row in HStack(alignment: .top) { if row.thumbnailPath != nil || row.storagePath != nil { AMDOSAdminCompanyMediaThumbnail(assetID: row.id) }; AMDOSLineItem(title: row.title, subtitle: [row.assetKind, row.capturedAt, row.usagePermission.map { "usage:\($0)" }, row.consentStatus.map { "consent:\($0)" }, row.sourceKind, row.sourceRef ?? row.notionSourceID].compactMap { $0 }.joined(separator: " · "), status: row.status) } } }
        }.task { load() }
    }
    private var needsReview: Int { (profiles.map(\.status) + members.map(\.status) + history.map(\.status) + media.map(\.status)).filter { ["imported", "needs_review"].contains($0) }.count }
    private func load() { Task { state = .loading; do { async let p = AMDOSRESTClient.shared.fetchTable(AMDOSCompanyProfileEntry.self, table: "company_profile_entries", select: "entry_id,entry_key,title,visibility,status,source_kind,source_ref,notion_source_id,reviewed_at,updated_at", order: "updated_at.desc", limit: 50); async let m = AMDOSRESTClient.shared.fetchTable(AMDOSCompanyMemberProfile.self, table: "member_profiles", select: "member_profile_id,member_id,display_name,full_name,public_title,internal_title,notion_status,joined_on,effort,bio_short,join_context,visibility,status,source_kind,source_ref,notion_source_id,photo_asset_id,reviewed_at,updated_at", order: "updated_at.desc", limit: 80); async let h = AMDOSRESTClient.shared.fetchTable(AMDOSCompanyHistory.self, table: "company_history_events", select: "event_id,occurred_on,title,event_type,project_id,importance,visibility,status,source_kind,source_ref,notion_source_id,reviewed_at,updated_at", order: "occurred_on.desc", limit: 80); async let a = AMDOSRESTClient.shared.fetchTable(AMDOSCompanyMedia.self, table: "media_assets", select: "asset_id,title,asset_kind,captured_at,usage_permission,consent_status,visibility,status,source_kind,source_ref,notion_source_id,storage_path,thumbnail_path,reviewed_at,updated_at", order: "updated_at.desc", limit: 80); profiles = try await p; members = try await m; history = try await h; media = try await a; state = .loaded } catch { state = .failed(error.localizedDescription) } } }
}
private struct AMDOSAdminCompanyMediaThumbnail: View { let assetID: String; @State private var image: NSImage?; var body: some View { Group { if let image { Image(nsImage: image).resizable().scaledToFill() } else { Image(systemName: "photo").foregroundStyle(AMDOSDesign.muted) } }.frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 7)).task(id: assetID) { guard let data = try? await AMDOSRESTClient.shared.fetchPWAData(path: "/api/company-media/file/\(assetID)"), let value = NSImage(data: data) else { return }; image = value } } }

private struct AMDOSAdminMember: Codable, Identifiable, Sendable {
    let id: String; let memberId: String?; let memberName: String?; let codeName: String?; let email: String; let role: String?; let status: String; let isAdmin: Bool; let isOfficer: Bool; let excluded: Bool
    let contractorName: String?; let memberAddress: String?; let invoiceRegistrationNumber: String?; let bankInfo: String?; let updatedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, memberId = "member_id", memberName = "member_name", codeName = "code_name", email, role, status
        case isAdmin = "is_admin", isOfficer = "is_officer", excluded = "exclude_from_payout_notice"
        case contractorName = "contractor_name", memberAddress = "member_address", invoiceRegistrationNumber = "invoice_registration_number", bankInfo = "bank_info", updatedAt = "updated_at"
    }
}
private struct AMDOSMemberPatch: Encodable, Sendable {
    let status: String; let role: String?; let email: String?; let excludeFromPayoutNotice: Bool
    let contractorName: String; let memberAddress: String?; let invoiceRegistrationNumber: String?
    enum CodingKeys: String, CodingKey {
        case status, role, email, excludeFromPayoutNotice = "exclude_from_payout_notice"
        case contractorName = "contractor_name", memberAddress = "member_address", invoiceRegistrationNumber = "invoice_registration_number"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(status, forKey: .status)
        if let role { try container.encode(role, forKey: .role) }
        if let email { try container.encode(email, forKey: .email) }
        try container.encode(excludeFromPayoutNotice, forKey: .excludeFromPayoutNotice)
        try container.encode(contractorName, forKey: .contractorName)
        try container.encode(memberAddress, forKey: .memberAddress)
        try container.encode(invoiceRegistrationNumber, forKey: .invoiceRegistrationNumber)
    }
}
private struct AMDOSMemberPatchRequest: Encodable, Sendable { let id: String; let patch: AMDOSMemberPatch }
private struct AMDOSMemberPatchResponse: Decodable, Sendable { let ok: Bool?; let error: String?; let member: AMDOSAdminMember? }

/// Superseded by `AMDOSAdminMembersView` in AdminProjectsMembersParityViews.swift.
/// Kept temporarily as isolated legacy code while the native admin ledger uses the
/// same PWA API contracts as the browser surface.
private struct AMDOSAdminMembersLegacyView: View {
    @State private var rows: [AMDOSAdminMember] = []
    @State private var selected: AMDOSAdminMember?
    @State private var status = "active"; @State private var role = ""; @State private var email = ""; @State private var excluded = false
    @State private var contractorName = ""; @State private var memberAddress = ""; @State private var invoiceRegistrationNumber = ""
    @State private var state: AMDOSFeatureLoadState = .idle; @State private var message: String?; @State private var saving = false
    var body: some View {
        AMDOSPageScaffold(eyebrow: "ADMIN MEMBERS", title: "メンバー", subtitle: "PWA AdminMembersTableの members.id + patch 契約で更新") {
            AMDOSStateNotice(state: state) { load() }
            ForEach(rows) { row in
                Button { beginEdit(row) } label: {
                    AMDOSCard { HStack { VStack(alignment: .leading) { Text(row.memberName ?? row.codeName ?? row.memberId ?? row.id).font(.headline); Text("\(row.email) · id=\(row.id)").font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); AMDOSStatusBadge(text: row.status); if row.isAdmin { AMDOSStatusBadge(text: "admin", tint: AMDOSDesign.success) } } }
                }.buttonStyle(.plain)
            }
            if let selected {
                AMDOSSectionCard("\(selected.memberName ?? selected.id) を更新", systemImage: "pencil") {
                    Picker("状態", selection: $status) { Text("active").tag("active"); Text("inactive").tag("inactive"); Text("left").tag("left") }
                    AMDOSTextField(title: "メール", text: $email)
                    AMDOSTextField(title: "役割（変更時のみ）", text: $role)
                    Toggle("支払通知から除外", isOn: $excluded)
                    Divider()
                    Text("支払通知書の受取人情報").font(.headline)
                    AMDOSTextField(title: "契約者名（PDF宛名）", text: $contractorName)
                    AMDOSTextField(title: "住所（PDF宛先）", text: $memberAddress, axis: .vertical)
                    AMDOSTextField(title: "適格請求書発行事業者番号", text: $invoiceRegistrationNumber)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("口座情報（読み取り専用）").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        Text(selected.bankInfo?.trimmedNonEmpty ?? "未登録")
                            .font(.caption)
                            .textSelection(.enabled)
                    }
                    Text("口座情報はPWAのメンバー台帳にも編集経路がないため、ここでは変更しない。")
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    Button(saving ? "保存中…" : "PATCH保存") { save(selected) }.buttonStyle(.borderedProminent).disabled(saving)
                    AMDOSAdminInlineMessage(text: message)
                }
            }
        }.task { load() }
    }
    private func beginEdit(_ row: AMDOSAdminMember) {
        selected = row; status = row.status; role = row.role ?? ""; email = row.email; excluded = row.excluded
        contractorName = row.contractorName?.trimmedNonEmpty ?? row.memberName?.trimmedNonEmpty ?? row.codeName?.trimmedNonEmpty ?? row.memberId ?? ""
        memberAddress = row.memberAddress ?? ""; invoiceRegistrationNumber = row.invoiceRegistrationNumber ?? ""; message = nil
    }
    private func load() { Task { state = .loading; do { rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSAdminMember.self, table: "members", select: "id,member_id,member_name,code_name,email,role,status,is_admin,is_officer,exclude_from_payout_notice,contractor_name,member_address,invoice_registration_number,bank_info,updated_at", order: "member_id", limit: 500); state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
    private func save(_ row: AMDOSAdminMember) {
        let fallbackContractorName = row.memberName?.trimmedNonEmpty ?? row.codeName?.trimmedNonEmpty ?? row.memberId ?? row.id
        Task {
            saving = true; defer { saving = false }
            do {
                let patch = AMDOSMemberPatch(
                    status: status,
                    role: role.trimmedNonEmpty,
                    email: email.trimmedNonEmpty,
                    excludeFromPayoutNotice: excluded,
                    contractorName: contractorName.trimmedNonEmpty ?? fallbackContractorName,
                    memberAddress: memberAddress.trimmedNonEmpty,
                    invoiceRegistrationNumber: invoiceRegistrationNumber.trimmedNonEmpty
                )
                let responseData = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/members", method: "PATCH", body: AMDOSMemberPatchRequest(id: row.id, patch: patch))
                let response = try JSONDecoder().decode(AMDOSMemberPatchResponse.self, from: responseData)
                guard response.ok == true, let saved = response.member else { throw AMDOSNetworkError.http(response.error ?? "メンバーを保存できなかった") }
                if let index = rows.firstIndex(where: { $0.id == saved.id }) { rows[index] = saved }
                beginEdit(saved); message = "メンバーを保存したよ"
            } catch { message = error.localizedDescription }
        }
    }
}

private struct AMDOSAdminPaymentObligation: Codable, Identifiable, Sendable {
    let id: String; let title: String; let counterparty: String?; let category: String; let amountYen: Double?; let amountStatus: String; let dueDate: String?; let dueDatePrecision: String?; let expectedPaymentYm: String?; let status: String; let cashflowTreatment: String
    let budgetCategory: String?; let autoDebit: Bool?; let ownerMemberID: String?; let sourceKind: String?; let sourceRef: String?; let confidence: Double?; let paidAt: String?; let paidAmountYen: Double?; let updatedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, title, counterparty, category, amountYen = "amount_yen", amountStatus = "amount_status", dueDate = "due_date", dueDatePrecision = "due_date_precision", expectedPaymentYm = "expected_payment_ym", status, cashflowTreatment = "cashflow_treatment"
        case budgetCategory = "budget_category", autoDebit = "auto_debit", ownerMemberID = "owner_member_id", sourceKind = "source_kind", sourceRef = "source_ref", confidence, paidAt = "paid_at", paidAmountYen = "paid_amount_yen", updatedAt = "updated_at"
    }
}
private struct AMDOSObligationEnvelope: Codable, Sendable { let ok: Bool?; let obligations: [AMDOSAdminPaymentObligation]?; let obligation: AMDOSAdminPaymentObligation?; let error: String? }
private struct AMDOSObligationInput: Encodable, Sendable {
    let id: String?; let title: String; let counterparty: String?; let category: String; let amountYen: Double?; let amountStatus: String; let dueDate: String?; let dueDatePrecision: String; let expectedPaymentYm: String?; let status: String?; let cashflowTreatment: String
    let budgetCategory: String?; let autoDebit: Bool?; let ownerMemberID: String?; let sourceKind: String?; let sourceRef: String?; let confidence: Double?; let paidAt: String?; let paidAmountYen: Double?
    enum CodingKeys: String, CodingKey {
        case id, title, counterparty, category, amountYen = "amount_yen", amountStatus = "amount_status", dueDate = "due_date", dueDatePrecision = "due_date_precision", expectedPaymentYm = "expected_payment_ym", status, cashflowTreatment = "cashflow_treatment"
        case budgetCategory = "budget_category", autoDebit = "auto_debit", ownerMemberID = "owner_member_id", sourceKind = "source_kind", sourceRef = "source_ref", confidence, paidAt = "paid_at", paidAmountYen = "paid_amount_yen"
    }
}

private struct AMDOSAdminRecurringItem: Codable, Identifiable, Sendable {
    let id: String; let status: String; let itemKind: String; let displayName: String; let vendorName: String?; let category: String; let amountYen: Double; let currency: String; let frequency: String; let startYm: String; let endYm: String?; let budgetForwardFill: Bool; let autoDebit: Bool?; let withdrawalAccount: String?; let paymentMethod: String?; let sourceKind: String; let sourceRef: String?; let lastReceiptAt: String?; let lastBudgetSyncedAt: String?; let notes: String?
    enum CodingKeys: String, CodingKey { case id, status, itemKind = "item_kind", displayName = "display_name", vendorName = "vendor_name", category, amountYen = "amount_yen", currency, frequency, startYm = "start_ym", endYm = "end_ym", budgetForwardFill = "budget_forward_fill", autoDebit = "auto_debit", withdrawalAccount = "withdrawal_account", paymentMethod = "payment_method", sourceKind = "source_kind", sourceRef = "source_ref", lastReceiptAt = "last_receipt_at", lastBudgetSyncedAt = "last_budget_synced_at", notes }
}
private struct AMDOSAdminRecurringInput: Encodable, Sendable { let id: String?; let status: String; let itemKind: String; let displayName: String; let vendorName: String?; let category: String; let amountYen: Double; let currency: String; let frequency: String; let startYm: String; let endYm: String?; let budgetForwardFill: Bool; let autoDebit: Bool?; let withdrawalAccount: String?; let paymentMethod: String?; let sourceKind: String; let sourceRef: String?; let notes: String?; let syncBudget: Bool?; enum CodingKeys: String, CodingKey { case id, status, itemKind = "item_kind", displayName = "display_name", vendorName = "vendor_name", category, amountYen = "amount_yen", currency, frequency, startYm = "start_ym", endYm = "end_ym", budgetForwardFill = "budget_forward_fill", autoDebit = "auto_debit", withdrawalAccount = "withdrawal_account", paymentMethod = "payment_method", sourceKind = "source_kind", sourceRef = "source_ref", notes, syncBudget } }
private struct AMDOSAdminFinanceAction: Encodable, Sendable { let action: String; let id: String }
private struct AMDOSAdminRecurringResponse: Decodable, Sendable { let ok: Bool?; let item: AMDOSAdminRecurringItem?; let inserted: Int?; let error: String?; let budgetSync: AMDOSAdminFinanceSyncCount? }
private struct AMDOSAdminFinanceSyncCount: Decodable, Sendable { let inserted: Int? }
private struct AMDOSAdminReceiptEvent: Codable, Identifiable, Sendable { let id: String; let ym: String?; let receiptDate: String?; let vendorName: String?; let amountYen: Double?; let subject: String?; let sourceKind: String; let status: String; let actualSyncedAt: String?; enum CodingKeys: String, CodingKey { case id, ym, receiptDate = "receipt_date", vendorName = "vendor_name", amountYen = "amount_yen", subject, sourceKind = "source_kind", status, actualSyncedAt = "actual_synced_at" } }
private struct AMDOSAdminReceiptSyncResponse: Decodable, Sendable { let ok: Bool?; let receiptId: String?; let actual: AMDOSAdminReceiptActual?; let error: String? }
private struct AMDOSAdminReceiptActual: Decodable, Sendable { let ym: String?; let category: String?; let accountName: String?; let amount: Double? }
private struct AMDOSAdminOfficer: Codable, Identifiable, Sendable { let id: String; let codeName: String?; let active: Bool?; enum CodingKeys: String, CodingKey { case id = "member_id", codeName = "code_name", active = "is_officer" } }
private indirect enum AMDOSAdminFinanceJSON: Decodable, Sendable { case object([String: AMDOSAdminFinanceJSON]), array([AMDOSAdminFinanceJSON]), string(String), number(Double), bool(Bool), null
    init(from decoder: Decoder) throws { let c = try decoder.singleValueContainer(); if c.decodeNil() { self = .null } else if let v = try? c.decode([String: AMDOSAdminFinanceJSON].self) { self = .object(v) } else if let v = try? c.decode([AMDOSAdminFinanceJSON].self) { self = .array(v) } else if let v = try? c.decode(String.self) { self = .string(v) } else if let v = try? c.decode(Double.self) { self = .number(v) } else { self = .bool(try c.decode(Bool.self)) } }
    var object: [String: AMDOSAdminFinanceJSON]? { if case let .object(v) = self { return v }; return nil }; var array: [AMDOSAdminFinanceJSON]? { if case let .array(v) = self { return v }; return nil }; var string: String? { if case let .string(v) = self { return v }; return nil }; var number: Double? { if case let .number(v) = self { return v }; if case let .string(v) = self { return Double(v) }; return nil }
}
private struct AMDOSAdminFinanceCycle: Decodable, Sendable { let projectId: String; let ym: String; let invoiceYm: String?; let invoiceIssuedAt: String?; let invoiceSentAt: String?; let rewardSummary: AMDOSAdminFinanceJSON?; enum CodingKeys: String, CodingKey { case projectId = "project_id", ym, invoiceYm = "invoice_ym", invoiceIssuedAt = "invoice_issued_at", invoiceSentAt = "invoice_sent_at", rewardSummary = "reward_summary_json" } }
private struct AMDOSAdminFinanceProject: Codable, Identifiable, Sendable { let id: String; let name: String; let paymentDueRule: String?; let paymentDueDay: Int?; let invoiceDeadlineRule: String?; enum CodingKeys: String, CodingKey { case id = "project_id", name = "project_name", paymentDueRule = "payment_due_rule", paymentDueDay = "payment_due_day", invoiceDeadlineRule = "invoice_send_deadline_rule" } }
private struct AMDOSAdminOfficerReserve: Identifiable { let projectID: String; let projectName: String; let ym: String; let memberID: String; let memberName: String; let amountYen: Double; var id: String { "\(projectID):\(ym):\(memberID)" } }

struct AMDOSAdminFinanceView: View {
    @State private var obligations: [AMDOSAdminPaymentObligation] = []
    @State private var recurring: [AMDOSAdminRecurringItem] = []
    @State private var receipts: [AMDOSAdminReceiptEvent] = []
    @State private var reserves: [AMDOSAdminOfficerReserve] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var editObligation: AMDOSAdminPaymentObligation?
    @State private var editRecurring: AMDOSAdminRecurringItem?
    @State private var creatingObligation = false
    @State private var busyObligationID: String?
    @State private var creatingRecurring = false
    @State private var busyRecurringID: String?
    @State private var busyReceiptID: String?

    @State private var newObligationTitle = ""
    @State private var newObligationCounterparty = ""
    @State private var newObligationAmount = ""
    @State private var newObligationDueDate = ""
    @State private var newObligationCategory = "other"
    @State private var newObligationCashflow = "additive"

    @State private var title = ""
    @State private var counterparty = ""
    @State private var obligationCategory = "other"
    @State private var obligationAmount = ""
    @State private var obligationAmountStatus = "unknown"
    @State private var dueDate = ""
    @State private var expectedYm = ""
    @State private var obligationStatus = "open"
    @State private var cashflowTreatment = "additive"

    @State private var newRecurringName = ""
    @State private var newRecurringVendor = ""
    @State private var newRecurringAmount = ""
    @State private var newRecurringStartYm = ""
    @State private var newRecurringAutoDebit = "unknown"
    @State private var newRecurringAccount = ""

    @State private var recurringName = ""
    @State private var recurringVendor = ""
    @State private var recurringAmount = ""
    @State private var recurringStartYm = ""
    @State private var recurringEndYm = ""
    @State private var recurringFrequency = "monthly"
    @State private var recurringCategory = "fixed_cost"
    @State private var recurringAutoDebit = "unknown"
    @State private var recurringAccount = ""
    @State private var recurringForwardFill = false

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ADMIN FINANCE", title: "財務", subtitle: "PWAの支払義務・継続支払い・領収書実績同期を同じ管理APIで扱う") {
            AMDOSStateNotice(state: state) { load() }
            obligationSection
            recurringMetrics
            reserveSection
            recurringSection
            receiptSection
            AMDOSAdminInlineMessage(text: message)
        }.task {
            if newRecurringStartYm.isEmpty { newRecurringStartYm = adminCurrentYM() }
            load()
        }
        .sheet(item: $editObligation) { row in obligationEditor(row) }
        .sheet(item: $editRecurring) { row in recurringEditor(row) }
    }

    private var activeObligations: [AMDOSAdminPaymentObligation] { obligations.filter { $0.status != "paid" && $0.status != "cancelled" } }
    private var activeRecurring: [AMDOSAdminRecurringItem] { recurring.filter { $0.status == "active" } }

    private var obligationSection: some View {
        AMDOSSectionCard("支払義務", systemImage: "yensign.circle") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 8)], spacing: 8) {
                AMDOSMetricTile(label: "未完了", value: "\(activeObligations.count)", detail: "支払義務")
                AMDOSMetricTile(label: "要確認", value: "\(activeObligations.filter { $0.status == "needs_review" }.count)", detail: "金額・期日を確認")
                AMDOSMetricTile(label: "追加流出", value: financeYen(activeObligations.filter { $0.cashflowTreatment == "additive" }.reduce(0) { $0 + ($1.amountYen ?? 0) }), detail: "未完了")
            }
            AMDOSSectionCard("新しい支払義務", systemImage: "plus.circle") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 10)], spacing: 10) {
                    AMDOSTextField(title: "支払内容", text: $newObligationTitle)
                    AMDOSTextField(title: "支払先", text: $newObligationCounterparty)
                    AMDOSTextField(title: "金額", text: $newObligationAmount)
                    AMDOSTextField(title: "期日 YYYY-MM-DD", text: $newObligationDueDate)
                    Picker("区分", selection: $newObligationCategory) {
                        ForEach(["tax", "social_insurance", "invoice", "reimbursement", "reward", "subscription", "loan", "other"], id: \.self) { Text(financeObligationCategoryLabel($0)).tag($0) }
                    }
                    Picker("資金繰り", selection: $newObligationCashflow) { Text("追加流出").tag("additive"); Text("予算内").tag("included_in_budget") }
                }
                HStack {
                    Spacer()
                    Button(creatingObligation ? "追加中…" : "追加") { createObligation() }
                        .buttonStyle(.borderedProminent)
                        .disabled(creatingObligation || newObligationTitle.trimmedNonEmpty == nil)
                }
            }
            if obligations.isEmpty && state == .loaded { Text("支払義務はまだない").foregroundStyle(AMDOSDesign.muted) }
            ForEach(obligations) { row in
                Button { beginObligation(row) } label: {
                    AMDOSCard {
                        HStack(alignment: .center, spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(row.title).font(.headline)
                                Text(row.counterparty ?? "支払先未確認").font(.caption).foregroundStyle(AMDOSDesign.muted)
                                Text("\(row.sourceKind ?? "manual") · \(financeObligationCategoryLabel(row.category)) · \(row.cashflowTreatment == "additive" ? "追加流出" : "予算内")")
                                    .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(row.amountYen.map(financeYen) ?? "金額未確認").font(.headline.monospacedDigit())
                                Text(row.dueDate ?? financeYMLabel(row.expectedPaymentYm) ?? "期日未確認").font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                            }
                            AMDOSStatusBadge(text: financeObligationStatusLabel(row.status), tint: financeObligationStatusTint(row.status))
                            Image(systemName: "chevron.right").foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                }.buttonStyle(.plain)
                .contextMenu {
                    Button("編集") { beginObligation(row) }
                    if row.status != "paid" && row.status != "cancelled" { Button("支払済みにする") { markPaid(row) } }
                }
            }
        }
    }

    private var recurringMetrics: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 8)], spacing: 8) {
            AMDOSMetricTile(label: "Active items", value: "\(activeRecurring.count)", detail: "継続支払い")
            AMDOSMetricTile(label: "Monthly run-rate", value: financeYen(activeRecurring.filter { $0.frequency == "monthly" }.reduce(0) { $0 + $1.amountYen }), detail: "月額")
            AMDOSMetricTile(label: "Auto debit", value: "\(activeRecurring.filter { $0.autoDebit == true }.count)", detail: "unknown \(activeRecurring.filter { $0.autoDebit == nil }.count)")
            AMDOSMetricTile(label: "Budget forward-fill", value: "\(activeRecurring.filter(\.budgetForwardFill).count)", detail: "active")
        }
    }

    private var recurringSection: some View {
        AMDOSSectionCard("継続支払い", systemImage: "arrow.triangle.2.circlepath") {
            AMDOSSectionCard("新しい継続支払い", systemImage: "plus.circle") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 10)], spacing: 10) {
                    AMDOSTextField(title: "表示名", text: $newRecurringName)
                    AMDOSTextField(title: "支払先", text: $newRecurringVendor)
                    AMDOSTextField(title: "月額", text: $newRecurringAmount)
                    AMDOSTextField(title: "開始月 YYYYMM", text: $newRecurringStartYm)
                    Picker("自動引落", selection: $newRecurringAutoDebit) { Text("未確認").tag("unknown"); Text("自動").tag("true"); Text("手動").tag("false") }
                    AMDOSTextField(title: "引落口座", text: $newRecurringAccount)
                }
                HStack {
                    Spacer()
                    Button(creatingRecurring ? "追加中…" : "追加") { createRecurring() }
                        .buttonStyle(.borderedProminent)
                        .disabled(creatingRecurring || (newRecurringName.trimmedNonEmpty == nil && newRecurringVendor.trimmedNonEmpty == nil))
                }
            }
            if recurring.isEmpty && state == .loaded { Text("継続支払いはまだない").foregroundStyle(AMDOSDesign.muted) }
            ForEach(recurring) { row in
                Button { beginRecurring(row) } label: {
                    AMDOSCard {
                        HStack(alignment: .center, spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(row.displayName).font(.headline)
                                Text(row.vendorName ?? "支払先未設定").font(.caption).foregroundStyle(AMDOSDesign.muted)
                                Text("\(row.startYm)–\(row.endYm ?? "") · \(row.frequency) · \(row.autoDebit == nil ? "自動引落未確認" : row.autoDebit == true ? "自動引落" : "手動")")
                                    .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(financeYen(row.amountYen)).font(.headline.monospacedDigit())
                                Text(row.budgetForwardFill ? "forward fill · synced \(row.lastBudgetSyncedAt?.prefix(10) ?? "-")" : "forward fill OFF")
                                    .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            }
                            AMDOSStatusBadge(text: row.status)
                            Image(systemName: "chevron.right").foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                }.buttonStyle(.plain)
                .contextMenu { Button("編集") { beginRecurring(row) }; Button("予算を同期") { syncBudget(row) } }
            }
        }
    }

    private var receiptSection: some View {
        AMDOSSectionCard("Receipt events", systemImage: "receipt") {
            Text("latest \(receipts.count) · Gmail/freee/manual由来の既存イベントを会社実績へ同期する")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            if receipts.isEmpty { Text("Gmail/freee/manualの領収書イベントはまだない").foregroundStyle(AMDOSDesign.muted) }
            ForEach(receipts) { row in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(row.vendorName ?? row.subject ?? "領収書").font(.headline)
                        Text(row.subject ?? "件名なし").font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(1)
                    }
                    Spacer()
                    Text(financeYMLabel(row.ym) ?? row.receiptDate ?? "年月未確認").font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                    Text(row.amountYen.map(financeYen) ?? "金額未確認").monospacedDigit()
                    AMDOSStatusBadge(text: row.status)
                    Text(row.sourceKind).font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                    Button(busyReceiptID == row.id ? "同期中…" : "実績同期") { syncReceipt(row) }.disabled(busyReceiptID == row.id)
                }
            }
        }
    }

    private var reserveSection: some View {
        AMDOSSectionCard("AMD運営費へ残る役員除外分", systemImage: "building.2") {
            Text("支払月 \(financeYMLabel(adminCurrentYM()) ?? adminCurrentYM()) のadmin.payoutsで、役員ONのメンバーを支払対象から外した金額")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            AMDOSMetricTile(label: "運営費へ残る額", value: financeYen(reserves.reduce(0) { $0 + $1.amountYen }), detail: "\(reserves.count) 明細")
            ForEach(reserves) { row in AMDOSLineItem(title: row.projectName, subtitle: "\(financeYMLabel(row.ym) ?? row.ym) · \(row.memberName)", status: financeYen(row.amountYen)) }
        }
    }

    @ViewBuilder private func obligationEditor(_ row: AMDOSAdminPaymentObligation) -> some View {
        AMDOSPageScaffold(eyebrow: "OBLIGATION", title: "支払義務を編集", subtitle: "金額未確認を0円にせず、PWA obligations PATCHへ保存") {
            obligationFields
            Picker("状態", selection: $obligationStatus) {
                Text("要確認").tag("needs_review"); Text("未払い").tag("open"); Text("支払予定").tag("scheduled"); Text("支払済み").tag("paid"); Text("取消").tag("cancelled")
            }
            HStack {
                Button(busyObligationID == row.id ? "保存中…" : "保存") { saveObligation(row) }.buttonStyle(.borderedProminent).disabled(busyObligationID == row.id)
                if row.status != "paid" && row.status != "cancelled" { Button("支払済みにする") { markPaid(row) }.disabled(busyObligationID == row.id) }
            }
            AMDOSAdminInlineMessage(text: message)
        }
    }

    @ViewBuilder private func recurringEditor(_ row: AMDOSAdminRecurringItem) -> some View {
        AMDOSPageScaffold(eyebrow: "RECURRING", title: "継続支払いを編集", subtitle: "PWA recurring PATCH / 予算同期") {
            HStack { AMDOSStatusBadge(text: row.status); Text("source: \(row.sourceKind)").font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted) }
            recurringFields
            HStack {
                Button(busyRecurringID == row.id ? "保存中…" : "保存") { saveRecurring(row) }.buttonStyle(.borderedProminent).disabled(busyRecurringID == row.id)
                Button("予算を同期") { syncBudget(row) }.disabled(busyRecurringID == row.id)
            }
            AMDOSAdminInlineMessage(text: message)
        }
    }

    @ViewBuilder private var obligationFields: some View {
        AMDOSTextField(title: "支払内容", text: $title)
        AMDOSTextField(title: "支払先", text: $counterparty)
        AMDOSTextField(title: "金額", text: obligationAmountBinding)
        Picker("金額状態", selection: $obligationAmountStatus) { Text("確定").tag("exact"); Text("概算").tag("estimated"); Text("未確認").tag("unknown") }
        AMDOSTextField(title: "期日 YYYY-MM-DD", text: obligationDueDateBinding)
        if dueDate.isEmpty { Text("支払月: \(financeYMLabel(expectedYm) ?? "未確認")").font(.caption).foregroundStyle(AMDOSDesign.muted) }
        Picker("区分", selection: $obligationCategory) { ForEach(["tax", "social_insurance", "payroll", "invoice", "reimbursement", "reward", "subscription", "loan", "card_payment", "other"], id: \.self) { Text(financeObligationCategoryLabel($0)).tag($0) } }
        Picker("資金繰り", selection: $cashflowTreatment) { Text("追加流出").tag("additive"); Text("予算内").tag("included_in_budget") }
    }

    @ViewBuilder private var recurringFields: some View {
        AMDOSTextField(title: "表示名", text: $recurringName)
        AMDOSTextField(title: "支払先", text: $recurringVendor)
        AMDOSTextField(title: "金額", text: $recurringAmount)
        Picker("区分", selection: $recurringCategory) { ForEach(["fixed_cost", "subscription", "tax_payment", "loan_payment", "other"], id: \.self) { Text($0).tag($0) } }
        AMDOSTextField(title: "開始月 YYYYMM", text: $recurringStartYm)
        AMDOSTextField(title: "終了月 YYYYMM", text: $recurringEndYm)
        Picker("頻度", selection: $recurringFrequency) { ForEach(["monthly", "annual", "one_time", "unknown"], id: \.self) { Text($0).tag($0) } }
        Picker("自動引落", selection: $recurringAutoDebit) { Text("未確認").tag("unknown"); Text("自動").tag("true"); Text("手動").tag("false") }
        AMDOSTextField(title: "引落口座", text: $recurringAccount)
        Toggle("予算を前方同期", isOn: $recurringForwardFill)
    }

    private var obligationAmountBinding: Binding<String> {
        Binding(get: { obligationAmount }, set: { next in
            obligationAmount = next
            if next.trimmedNonEmpty == nil { obligationAmountStatus = "unknown" }
            else if obligationAmountStatus != "estimated" { obligationAmountStatus = "exact" }
        })
    }

    private var obligationDueDateBinding: Binding<String> {
        Binding(get: { dueDate }, set: { next in
            dueDate = next
            if let ym = financeExpectedYM(from: next) { expectedYm = ym }
        })
    }

    private func adminCurrentYM() -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Tokyo") ?? TimeZone(secondsFromGMT: 9 * 60 * 60)!
        return String(format: "%04d%02d", calendar.component(.year, from: Date()), calendar.component(.month, from: Date()))
    }

    private func load() { Task { await reloadFinance() } }

    private func reloadFinance() async {
        state = .loading
        do {
            async let obligationRequest = AMDOSRESTClient.shared.fetchPWA(AMDOSObligationEnvelope.self, path: "/api/admin/finance/obligations")
            async let recurringRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSAdminRecurringItem.self,
                table: "company_finance_recurring_items",
                select: "id,status,item_kind,display_name,vendor_name,category,amount_yen,currency,frequency,start_ym,end_ym,budget_forward_fill,auto_debit,withdrawal_account,payment_method,source_kind,source_ref,last_receipt_at,last_budget_synced_at,notes",
                order: "status,display_name",
                limit: 2_000
            )
            async let receiptRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSAdminReceiptEvent.self,
                table: "company_finance_receipt_events",
                select: "id,ym,receipt_date,vendor_name,amount_yen,subject,source_kind,status,actual_synced_at",
                order: "created_at.desc",
                limit: 30
            )
            async let reserveRequest = loadOfficerReserve()
            let envelope = try await obligationRequest
            guard envelope.ok != false else { throw AMDOSNetworkError.http(envelope.error ?? "支払義務を取得できなかった") }
            obligations = financeSortedObligations(envelope.obligations ?? [])
            recurring = try await recurringRequest
            receipts = try await receiptRequest
            reserves = try await reserveRequest
            state = obligations.isEmpty && recurring.isEmpty && receipts.isEmpty && reserves.isEmpty ? .empty : .loaded
        } catch { state = .failed(error.localizedDescription) }
    }

    private func createObligation() {
        guard let newTitle = newObligationTitle.trimmedNonEmpty else { return }
        let amount = Double(newObligationAmount)
        let due = newObligationDueDate.trimmedNonEmpty
        let input = AMDOSObligationInput(
            id: nil, title: newTitle, counterparty: newObligationCounterparty.trimmedNonEmpty, category: newObligationCategory,
            amountYen: amount, amountStatus: amount == nil ? "unknown" : "exact", dueDate: due,
            dueDatePrecision: due == nil ? "unknown" : "day", expectedPaymentYm: due.flatMap(financeExpectedYM(from:)),
            status: nil, cashflowTreatment: newObligationCashflow, budgetCategory: nil, autoDebit: nil,
            ownerMemberID: nil, sourceKind: "manual", sourceRef: nil, confidence: nil, paidAt: nil, paidAmountYen: nil
        )
        creatingObligation = true; message = nil
        Task { defer { creatingObligation = false }; do {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/finance/obligations", body: input)
            let response = try JSONDecoder().decode(AMDOSObligationEnvelope.self, from: data)
            guard response.ok == true, let created = response.obligations, created.count == 1 else { throw AMDOSNetworkError.http(response.error ?? "支払義務の追加結果を確認できなかった") }
            obligations = financeSortedObligations(created + obligations.filter { $0.id != created[0].id })
            newObligationTitle = ""; newObligationCounterparty = ""; newObligationAmount = ""; newObligationDueDate = ""; newObligationCategory = "other"; newObligationCashflow = "additive"
            message = "支払義務を追加したよ"
        } catch { message = error.localizedDescription } }
    }

    private func beginObligation(_ row: AMDOSAdminPaymentObligation) {
        title = row.title; counterparty = row.counterparty ?? ""; obligationCategory = row.category
        obligationAmount = row.amountYen.map(financeNumberString) ?? ""; obligationAmountStatus = row.amountStatus
        dueDate = row.dueDate ?? ""; expectedYm = row.expectedPaymentYm ?? ""; obligationStatus = row.status; cashflowTreatment = row.cashflowTreatment
        editObligation = row
    }

    private func saveObligation(_ row: AMDOSAdminPaymentObligation) {
        let amount = Double(obligationAmount)
        let paidAt = obligationStatus == "paid" ? (row.paidAt ?? adminNowISO()) : nil
        let input = AMDOSObligationInput(
            id: row.id, title: title, counterparty: counterparty.trimmedNonEmpty, category: obligationCategory,
            amountYen: amount, amountStatus: amount == nil ? "unknown" : obligationAmountStatus,
            dueDate: dueDate.trimmedNonEmpty, dueDatePrecision: dueDate.isEmpty ? (expectedYm.isEmpty ? "unknown" : "month") : "day",
            expectedPaymentYm: expectedYm.trimmedNonEmpty, status: obligationStatus, cashflowTreatment: cashflowTreatment,
            budgetCategory: row.budgetCategory, autoDebit: row.autoDebit, ownerMemberID: row.ownerMemberID,
            sourceKind: row.sourceKind, sourceRef: row.sourceRef, confidence: row.confidence,
            paidAt: paidAt, paidAmountYen: obligationStatus == "paid" ? (row.paidAmountYen ?? amount) : nil
        )
        updateObligation(row, input: input, successMessage: "支払義務を保存したよ")
    }

    private func markPaid(_ row: AMDOSAdminPaymentObligation) {
        let input = AMDOSObligationInput(
            id: row.id, title: row.title, counterparty: row.counterparty, category: row.category,
            amountYen: row.amountYen, amountStatus: row.amountStatus, dueDate: row.dueDate,
            dueDatePrecision: row.dueDatePrecision ?? (row.dueDate == nil ? (row.expectedPaymentYm == nil ? "unknown" : "month") : "day"),
            expectedPaymentYm: row.expectedPaymentYm, status: "paid", cashflowTreatment: row.cashflowTreatment,
            budgetCategory: row.budgetCategory, autoDebit: row.autoDebit, ownerMemberID: row.ownerMemberID,
            sourceKind: row.sourceKind, sourceRef: row.sourceRef, confidence: row.confidence,
            paidAt: adminNowISO(), paidAmountYen: row.amountYen
        )
        updateObligation(row, input: input, successMessage: "支払済みにしたよ")
    }

    private func updateObligation(_ row: AMDOSAdminPaymentObligation, input: AMDOSObligationInput, successMessage: String) {
        busyObligationID = row.id; message = nil
        Task { defer { busyObligationID = nil }; do {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/finance/obligations", method: "PATCH", body: input)
            let response = try JSONDecoder().decode(AMDOSObligationEnvelope.self, from: data)
            guard response.ok == true, let saved = response.obligation, saved.id == row.id else { throw AMDOSNetworkError.http(response.error ?? "支払義務の保存結果を確認できなかった") }
            obligations = financeSortedObligations(obligations.map { $0.id == saved.id ? saved : $0 })
            editObligation = nil; message = successMessage
        } catch { message = error.localizedDescription } }
    }

    private func createRecurring() {
        guard newRecurringName.trimmedNonEmpty != nil || newRecurringVendor.trimmedNonEmpty != nil else { return }
        let input = AMDOSAdminRecurringInput(
            id: nil, status: "active", itemKind: "subscription", displayName: newRecurringName.trimmedNonEmpty ?? newRecurringVendor,
            vendorName: newRecurringVendor.trimmedNonEmpty, category: "fixed_cost", amountYen: Double(newRecurringAmount) ?? 0,
            currency: "JPY", frequency: "monthly", startYm: newRecurringStartYm, endYm: nil, budgetForwardFill: false,
            autoDebit: financeBool(newRecurringAutoDebit), withdrawalAccount: newRecurringAccount.trimmedNonEmpty,
            paymentMethod: nil, sourceKind: "manual", sourceRef: nil, notes: nil, syncBudget: nil
        )
        creatingRecurring = true; message = nil
        Task { defer { creatingRecurring = false }; do {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/finance/recurring", body: input)
            let response = try JSONDecoder().decode(AMDOSAdminRecurringResponse.self, from: data)
            guard response.ok == true, let created = response.item else { throw AMDOSNetworkError.http(response.error ?? "継続支払いの追加結果を確認できなかった") }
            recurring = [created] + recurring.filter { $0.id != created.id }
            newRecurringName = ""; newRecurringVendor = ""; newRecurringAmount = ""; newRecurringStartYm = adminCurrentYM(); newRecurringAutoDebit = "unknown"; newRecurringAccount = ""
            message = "\(created.displayName) を追加したよ"
        } catch { message = error.localizedDescription } }
    }

    private func beginRecurring(_ row: AMDOSAdminRecurringItem) {
        recurringName = row.displayName; recurringVendor = row.vendorName ?? ""; recurringAmount = financeNumberString(row.amountYen)
        recurringStartYm = row.startYm; recurringEndYm = row.endYm ?? ""; recurringFrequency = row.frequency; recurringCategory = row.category
        recurringAutoDebit = row.autoDebit == nil ? "unknown" : row.autoDebit == true ? "true" : "false"
        recurringAccount = row.withdrawalAccount ?? ""; recurringForwardFill = row.budgetForwardFill; editRecurring = row
    }

    private func saveRecurring(_ row: AMDOSAdminRecurringItem) {
        let input = AMDOSAdminRecurringInput(
            id: row.id, status: row.status, itemKind: row.itemKind, displayName: recurringName, vendorName: recurringVendor.trimmedNonEmpty,
            category: recurringCategory, amountYen: Double(recurringAmount) ?? 0, currency: row.currency,
            frequency: recurringFrequency, startYm: recurringStartYm, endYm: recurringEndYm.trimmedNonEmpty,
            budgetForwardFill: recurringForwardFill, autoDebit: financeBool(recurringAutoDebit), withdrawalAccount: recurringAccount.trimmedNonEmpty,
            paymentMethod: row.paymentMethod, sourceKind: row.sourceKind, sourceRef: row.sourceRef, notes: row.notes, syncBudget: false
        )
        busyRecurringID = row.id; message = nil
        Task { defer { busyRecurringID = nil }; do {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/finance/recurring", method: "PATCH", body: input)
            let response = try JSONDecoder().decode(AMDOSAdminRecurringResponse.self, from: data)
            guard response.ok == true, let saved = response.item, saved.id == row.id else { throw AMDOSNetworkError.http(response.error ?? "継続支払いの保存結果を確認できなかった") }
            recurring = recurring.map { $0.id == saved.id ? saved : $0 }; editRecurring = nil; message = "\(saved.displayName) を保存したよ"
        } catch { message = error.localizedDescription } }
    }

    private func syncBudget(_ row: AMDOSAdminRecurringItem) {
        busyRecurringID = row.id; message = nil
        Task { defer { busyRecurringID = nil }; do {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/finance/recurring", body: AMDOSAdminFinanceAction(action: "syncBudget", id: row.id))
            let response = try JSONDecoder().decode(AMDOSAdminRecurringResponse.self, from: data)
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "予算同期の結果を確認できなかった") }
            await reloadFinance(); message = "\(row.displayName): 予算を\(response.inserted ?? 0)か月分同期したよ"
        } catch { message = error.localizedDescription } }
    }

    private func syncReceipt(_ row: AMDOSAdminReceiptEvent) {
        busyReceiptID = row.id; message = nil
        Task { defer { busyReceiptID = nil }; do {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/finance/receipts", body: AMDOSAdminFinanceAction(action: "syncActual", id: row.id))
            let response = try JSONDecoder().decode(AMDOSAdminReceiptSyncResponse.self, from: data)
            guard response.ok == true, response.receiptId == row.id, let actual = response.actual else { throw AMDOSNetworkError.http(response.error ?? "実績同期の結果を確認できなかった") }
            await reloadFinance(); message = "\(row.vendorName ?? row.subject ?? "領収書") を \(actual.ym ?? "") 実績へ同期したよ"
        } catch { message = error.localizedDescription } }
    }
    private func addMonths(_ ym: String, _ delta: Int) -> String {
        guard ym.count == 6, let year = Int(ym.prefix(4)), let month = Int(ym.suffix(2)) else { return ym }
        let raw = year * 12 + month - 1 + delta
        return String(raw / 12) + String(format: "%02d", raw % 12 + 1)
    }
    private func effectivePaymentYM(_ cycle: AMDOSAdminFinanceCycle, _ project: AMDOSAdminFinanceProject?) -> String {
        if let explicit = cycle.invoiceYm?.trimmingCharacters(in: .whitespacesAndNewlines), explicit.range(of: #"^\d{6}$"#, options: .regularExpression) != nil { return explicit }
        let due = paymentDueDate(ym: cycle.ym, rule: project?.paymentDueRule, legacyDay: project?.paymentDueDay, referenceDate: financePaymentReferenceDate(cycle, project))
        return due.prefix(7).replacingOccurrences(of: "-", with: "")
    }
    private func loadOfficerReserve() async throws -> [AMDOSAdminOfficerReserve] {
        async let officersRequest = AMDOSRESTClient.shared.fetchTable(AMDOSAdminOfficer.self, table: "members", select: "member_id,code_name,is_officer", filters: ["is_officer": "eq.true", "status": "eq.active"], limit: 500)
        async let projectsRequest = AMDOSRESTClient.shared.fetchTable(AMDOSAdminFinanceProject.self, table: "projects", select: "project_id,project_name,payment_due_rule,payment_due_day,invoice_send_deadline_rule", limit: 1_000)
        let targetYM = adminCurrentYM()
        let candidates = [targetYM, addMonths(targetYM, -1), addMonths(targetYM, -2), addMonths(targetYM, -3)].joined(separator: ",")
        async let explicitRequest = AMDOSRESTClient.shared.fetchTable(AMDOSAdminFinanceCycle.self, table: "billing_cycles", select: "project_id,ym,invoice_ym,invoice_issued_at,invoice_sent_at,reward_summary_json", filters: ["invoice_ym": "eq.\(targetYM)"], limit: 1_000)
        async let unsetRequest = AMDOSRESTClient.shared.fetchTable(AMDOSAdminFinanceCycle.self, table: "billing_cycles", select: "project_id,ym,invoice_ym,invoice_issued_at,invoice_sent_at,reward_summary_json", filters: ["ym": "in.(\(candidates))", "invoice_ym": "is.null"], limit: 1_000)
        let officers = try await officersRequest
        let projects = try await projectsRequest
        let explicit = try await explicitRequest
        let unset = try await unsetRequest
        let officerMap = Dictionary(uniqueKeysWithValues: officers.map { ($0.id, $0.codeName ?? $0.id) })
        let projectMap = Dictionary(uniqueKeysWithValues: projects.map { ($0.id, $0) })
        var cycleMap = Dictionary(uniqueKeysWithValues: explicit.map { ("\($0.projectId):\($0.ym)", $0) })
        for cycle in unset where effectivePaymentYM(cycle, projectMap[cycle.projectId]) == targetYM { cycleMap["\(cycle.projectId):\(cycle.ym)"] = cycle }
        var result: [AMDOSAdminOfficerReserve] = []
        for cycle in cycleMap.values {
            for object in financeRewardMemberObjects(cycle.rewardSummary) {
                let memberID = object["memberId"]?.string ?? object["member_id"]?.string
                guard let memberID = memberID?.trimmedNonEmpty, let officerName = officerMap[memberID] else { continue }
                let amount = (object["totalPay"]?.number ?? object["total_pay"]?.number ?? 0).rounded()
                guard amount > 0 else { continue }
                let memberName = object["memberName"]?.string?.trimmedNonEmpty ?? object["member_name"]?.string?.trimmedNonEmpty ?? officerName
                result.append(AMDOSAdminOfficerReserve(projectID: cycle.projectId, projectName: projectMap[cycle.projectId]?.name ?? cycle.projectId, ym: cycle.ym, memberID: memberID, memberName: memberName, amountYen: amount))
            }
        }
        return result.sorted {
            if $0.projectName != $1.projectName { return $0.projectName.localizedStandardCompare($1.projectName) == .orderedAscending }
            if $0.ym != $1.ym { return $0.ym < $1.ym }
            return $0.memberName.localizedStandardCompare($1.memberName) == .orderedAscending
        }
    }
}

private func financeSortedObligations(_ rows: [AMDOSAdminPaymentObligation]) -> [AMDOSAdminPaymentObligation] {
    rows.sorted { left, right in
        if left.status != right.status { return left.status < right.status }
        let leftYM = left.expectedPaymentYm ?? "999999"; let rightYM = right.expectedPaymentYm ?? "999999"
        if leftYM != rightYM { return leftYM < rightYM }
        let leftDate = left.dueDate ?? "9999-99-99"; let rightDate = right.dueDate ?? "9999-99-99"
        if leftDate != rightDate { return leftDate < rightDate }
        return left.id < right.id
    }
}

private func financeExpectedYM(from date: String) -> String? {
    guard date.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { return nil }
    return date.prefix(7).replacingOccurrences(of: "-", with: "")
}

private func financeBool(_ value: String) -> Bool? { value == "unknown" ? nil : value == "true" }
private func financeYen(_ value: Double) -> String { "¥" + Int(value.rounded()).formatted() }
private func financeNumberString(_ value: Double) -> String { value.rounded() == value ? String(Int(value)) : String(value) }
private func financeYMLabel(_ value: String?) -> String? { guard let value, value.count == 6 else { return nil }; return "\(value.prefix(4))/\(value.suffix(2))" }

private func financeObligationCategoryLabel(_ value: String) -> String {
    switch value { case "tax": return "税金"; case "social_insurance": return "社会保険"; case "payroll": return "給与"; case "invoice": return "請求"; case "reimbursement": return "経費精算"; case "reward": return "報酬"; case "subscription": return "継続支払"; case "loan": return "借入返済"; case "card_payment": return "カード支払"; default: return "その他" }
}

private func financeObligationStatusLabel(_ value: String) -> String {
    switch value { case "needs_review": return "要確認"; case "open": return "未払い"; case "scheduled": return "支払予定"; case "paid": return "支払済み"; case "cancelled": return "取消"; default: return value }
}

private func financeObligationStatusTint(_ value: String) -> Color {
    switch value { case "paid": return AMDOSDesign.success; case "needs_review": return AMDOSDesign.warning; case "cancelled": return AMDOSDesign.muted; default: return AMDOSDesign.blue }
}

private func financePaymentReferenceDate(_ cycle: AMDOSAdminFinanceCycle, _ project: AMDOSAdminFinanceProject?) -> String? {
    for raw in [cycle.invoiceSentAt, cycle.invoiceIssuedAt] {
        if let date = raw?.prefix(10), String(date).range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil { return String(date) }
    }
    guard project?.paymentDueRule == "invoice_received_60_days",
          let rule = project?.invoiceDeadlineRule,
          let match = rule.range(of: #"\d{1,2}"#, options: .regularExpression),
          let day = Int(rule[match]) else { return nil }
    let invoiceYM = invoiceAddingMonths(cycle.ym, 1) ?? cycle.ym
    return "\(invoiceYM.prefix(4))-\(invoiceYM.suffix(2))-\(String(format: "%02d", min(max(day, 1), invoiceLastDay(invoiceYM))))"
}

private func financeRewardMemberObjects(_ raw: AMDOSAdminFinanceJSON?) -> [[String: AMDOSAdminFinanceJSON]] {
    var value = raw
    for _ in 0..<3 {
        guard let text = value?.string, let data = text.data(using: .utf8), let decoded = try? JSONDecoder().decode(AMDOSAdminFinanceJSON.self, from: data) else { break }
        value = decoded
    }
    return value?.object?["members"]?.array?.compactMap(\.object) ?? []
}

private struct AMDOSInvoiceCycle: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let ym: String
    let invoiceYM: String?
    let status: String?
    let budgetYen: Double?
    let budgetReportedAmount: Double?
    let invoiceSubject: String?
    let invoiceBaseLinesJSON: String?
    let invoiceIssuedAt: String?
    let invoiceSentAt: String?
    let paymentConfirmedAt: String?
    let freeeInvoiceNumber: String?
    let invoicePDFURL: String?
    enum CodingKeys: String, CodingKey {
        case id, projectId = "project_id", ym, invoiceYM = "invoice_ym", status, budgetYen = "budget_yen", budgetReportedAmount = "budget_reported_amount"
        case invoiceSubject = "invoice_subject", invoiceBaseLinesJSON = "invoice_base_lines_json"
        case invoiceIssuedAt = "invoice_issued_at", invoiceSentAt = "invoice_sent_at", paymentConfirmedAt = "payment_confirmed_at"
        case freeeInvoiceNumber = "freee_invoice_number", invoicePDFURL = "invoice_pdf_url"
    }
}

private struct AMDOSInvoiceProject: Decodable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let projectName: String
    let clientName: String?
    let status: String?
    let feeType: String?
    let feeAmount: Double?
    let startYM: String?
    let endYM: String?
    let freezeFromYM: String?
    let contractTerms: AMDOSAdminFinanceJSON?
    let paymentDueRule: String?
    let paymentDueDay: Int?
    let freeePartnerID: String?
    enum CodingKeys: String, CodingKey {
        case id, projectId = "project_id", projectName = "project_name", clientName = "client_name", status
        case feeType = "fee_type", feeAmount = "fee_amount", startYM = "start_ym", endYM = "end_ym"
        case freezeFromYM = "freeze_from_ym"
        case contractTerms = "contract_terms_json", paymentDueRule = "payment_due_rule", paymentDueDay = "payment_due_day"
        case freeePartnerID = "freee_partner_id"
    }
}

private struct AMDOSInvoiceReimbursement: Codable, Identifiable, Sendable {
    let id: String
    let description: String?
    let amount: Double?
    let date: String?
    let category: String?
    let transportFrom: String?
    let transportTo: String?
    enum CodingKeys: String, CodingKey { case id = "reimbursement_id", description, amount, date, category, transportFrom = "transport_from", transportTo = "transport_to" }
}

private struct AMDOSInvoiceLine: Identifiable, Hashable, Sendable {
    enum Section: String, Sendable { case base, adjustment }
    enum Kind: String, Sendable { case item, text }
    let id: UUID
    var section: Section
    var kind: Kind
    var description: String
    var quantity: String
    var unitPrice: String
    init(id: UUID = UUID(), section: Section, kind: Kind, description: String = "", quantity: String = "1", unitPrice: String = "") {
        self.id = id; self.section = section; self.kind = kind; self.description = description; self.quantity = quantity; self.unitPrice = unitPrice
    }
    var amount: Double { kind == .item ? ((Double(quantity) ?? 0) == 0 ? 1 : (Double(quantity) ?? 1)) * (Double(unitPrice) ?? 0) : 0 }
}

private struct AMDOSInvoiceEdgeRequest: Encodable, Sendable {
    let projectId: String; let ym: String; let issueDate: String; let dueDate: String; let allLinesJson: String
    let invoiceSubject: String; let invoiceRemark: String; let documentType: String
}
private struct AMDOSInvoiceCancelRequest: Encodable, Sendable { let projectId: String; let ym: String; let documentType: String }
private struct AMDOSInvoiceEdgeResponse: Decodable, Sendable { let ok: Bool; let freeeInvoiceNumber: String?; let message: String? }
private struct AMDOSInvoiceDraftRequest: Encodable, Sendable { let projectId: String; let ym: String; let invoiceSubject: String; let allLinesJson: String }
private struct AMDOSInvoiceDraftResponse: Decodable, Sendable { let ok: Bool; let updated: Int?; let error: String? }
private struct AMDOSInvoiceYMUpdateRequest: Encodable, Sendable { let projectId: String; let ym: String; let invoiceYm: String }
private struct AMDOSInvoiceYMUpdateResponse: Decodable, Sendable {
    let ok: Bool?; let error: String?; let updatedCycle: AMDOSInvoiceYMUpdatedCycle?
}
private struct AMDOSInvoiceYMUpdatedCycle: Decodable, Sendable {
    let id: String?; let projectId: String; let ym: String; let invoiceYm: String?
}
private struct AMDOSFreeePartnerOption: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let name: String
    let code: String?
    let shortcut1: String?
    let shortcut2: String?
    let kana: String?
}
private struct AMDOSFreeePartnersResponse: Decodable, Sendable {
    let ok: Bool?
    let partners: [AMDOSFreeePartnerOption]?
    let error: String?
}
private struct AMDOSInvoiceFreeePartnerUpdateRequest: Encodable, Sendable {
    let projectId: String
    let freeePartnerId: String
}
private struct AMDOSInvoiceFreeePartnerUpdateResponse: Decodable, Sendable {
    let ok: Bool?
    let error: String?
    let updatedProject: AMDOSInvoiceFreeePartnerUpdatedProject?
}
private struct AMDOSInvoiceFreeePartnerUpdatedProject: Decodable, Sendable {
    let id: String?
    let projectId: String
    let freeePartnerId: String?
}

private enum AMDOSInvoiceQueueState: String, CaseIterable, Identifiable, Equatable {
    case ready, needsCheck = "needs_check", setupMissing = "setup_missing", backlog, issued, sent, paid
    var id: String { rawValue }
    var label: String {
        switch self {
        case .ready: return "発行待ち"
        case .needsCheck: return "要確認"
        case .setupMissing: return "設定不足"
        case .backlog: return "過去滞留"
        case .issued: return "発行済み"
        case .sent: return "送付済み"
        case .paid: return "入金確認済み"
        }
    }
}

private enum AMDOSInvoiceQueueFilter: String, CaseIterable, Identifiable, Equatable {
    case open, ready, needsCheck = "needs_check", setupMissing = "setup_missing", backlog, issued, sent, paid, all
    var id: String { rawValue }
    var label: String {
        switch self {
        case .open: return "未完了"
        case .all: return "すべて"
        case .paid: return "入金済み"
        default: return AMDOSInvoiceQueueState(rawValue: rawValue)?.label ?? rawValue
        }
    }
}

private struct AMDOSInvoicePreviewState: Sendable {
    let project: AMDOSInvoiceProject
    var cycle: AMDOSInvoiceCycle
    let reimbursements: [AMDOSInvoiceReimbursement]
    let fromPreviousMonth: Bool
    let contractAmount: Double
}

private enum AMDOSInvoiceConfirmation: String, Identifiable {
    case issueMismatch, cancel
    var id: String { rawValue }
}

struct AMDOSAdminInvoicesView: View {
    @State private var cycles: [AMDOSInvoiceCycle] = []
    @State private var projects: [AMDOSInvoiceProject] = []
    @State private var preview: AMDOSInvoicePreviewState?
    @State private var baseLines: [AMDOSInvoiceLine] = []
    @State private var adjustmentLines: [AMDOSInvoiceLine] = []
    @State private var subject = ""
    @State private var remark = ""
    @State private var issueDate = ""
    @State private var dueDate = ""
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var busy = false
    @State private var confirmation: AMDOSInvoiceConfirmation?
    @State private var queueFilter: AMDOSInvoiceQueueFilter = .open
    @State private var editingInvoiceYM: AMDOSInvoiceCycle?
    @State private var invoiceYMDraft = ""
    @State private var invoiceYMSaving = false
    @State private var freeePartnerQuery = ""
    @State private var freeePartnerOptions: [AMDOSFreeePartnerOption] = []
    @State private var selectedFreeePartner: AMDOSFreeePartnerOption?
    @State private var freeePartnerSearchID = UUID()
    @State private var freeePartnerLoading = false
    @State private var freeePartnerSearchDidRun = false
    @State private var freeePartnerError: String?
    @State private var freeePartnerSaving = false

    private var baseTotal: Double { baseLines.reduce(0) { $0 + $1.amount } }
    private var adjustmentTotal: Double { adjustmentLines.reduce(0) { $0 + $1.amount } }
    private var reimbursementTotal: Double { preview?.reimbursements.reduce(0) { $0 + ($1.amount ?? 0) } ?? 0 }
    private var netTotal: Double { baseTotal + adjustmentTotal }
    private var targetInvoiceYM: String { invoiceAddingMonths(invoiceCurrentYM(), -1) ?? invoiceCurrentYM() }
    private var invoiceQueueCounts: [AMDOSInvoiceQueueFilter: Int] {
        var counts = Dictionary(uniqueKeysWithValues: AMDOSInvoiceQueueFilter.allCases.map { ($0, 0) })
        counts[.all] = cycles.count
        for cycle in cycles {
            let queueState = invoiceQueueState(cycle)
            counts[AMDOSInvoiceQueueFilter(rawValue: queueState.rawValue) ?? .all, default: 0] += 1
            if [.ready, .needsCheck, .setupMissing, .backlog].contains(queueState) { counts[.open, default: 0] += 1 }
        }
        return counts
    }
    private var visibleInvoiceCycles: [AMDOSInvoiceCycle] {
        cycles.filter { cycle in
            let queueState = invoiceQueueState(cycle)
            switch queueFilter {
            case .all: return true
            case .open: return [.ready, .needsCheck, .setupMissing, .backlog].contains(queueState)
            default: return queueState.rawValue == queueFilter.rawValue
            }
        }.sorted { left, right in
            let order: [AMDOSInvoiceQueueState: Int] = [.ready: 0, .needsCheck: 1, .setupMissing: 2, .backlog: 3, .issued: 4, .sent: 5, .paid: 6]
            let leftState = invoiceQueueState(left); let rightState = invoiceQueueState(right)
            if order[leftState, default: 99] != order[rightState, default: 99] { return order[leftState, default: 99] < order[rightState, default: 99] }
            if effectiveInvoiceYM(left) != effectiveInvoiceYM(right) { return effectiveInvoiceYM(left) < effectiveInvoiceYM(right) }
            return left.projectId < right.projectId
        }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ADMIN INVOICES", title: "請求書", subtitle: "保存済み明細・契約条件・承認済み立替を確認し、freeeの現行発行経路で扱う") {
            AMDOSStateNotice(state: state) { load() }
            invoiceQueueControls
            Text("表示 (visibleInvoiceCycles.count)件 / 全 (cycles.count)件").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if visibleInvoiceCycles.isEmpty && state == .loaded { Text("この条件の請求書はないよ。").foregroundStyle(AMDOSDesign.muted) }
            ForEach(visibleInvoiceCycles) { cycle in invoiceQueueRow(cycle) }
            if preview != nil { editor }
        }
        .task { load() }
        .sheet(item: $editingInvoiceYM) { cycle in invoiceYMEditor(cycle) }
        .confirmationDialog(confirmationTitle, isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }), titleVisibility: .visible) {
            if confirmation == .cancel {
                Button("発行情報を取り消す", role: .destructive) { cancelInvoice() }
            } else {
                Button("この内容で発行", role: .destructive) { issueInvoice() }
            }
        } message: { Text(confirmationMessage) }
    }

    private var invoiceQueueControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], spacing: 8) {
                invoiceQueueMetric(label: "未完了", filter: .open)
                invoiceQueueMetric(label: "発行待ち", filter: .ready)
                invoiceQueueMetric(label: "要確認", filter: .needsCheck)
                invoiceQueueMetric(label: "設定不足", filter: .setupMissing)
                invoiceQueueMetric(label: "過去滞留", filter: .backlog)
            }
            Picker("表示", selection: $queueFilter) {
                ForEach(AMDOSInvoiceQueueFilter.allCases) { filter in
                    Text("\(filter.label) \(invoiceQueueCounts[filter, default: 0])").tag(filter)
                }
            }.pickerStyle(.menu)
        }
    }

    private func invoiceQueueMetric(label: String, filter: AMDOSInvoiceQueueFilter) -> some View {
        Button { queueFilter = filter } label: {
            VStack(alignment: .leading, spacing: 3) {
                Text(label).font(.caption).foregroundStyle(AMDOSDesign.muted)
                Text("\(invoiceQueueCounts[filter, default: 0])").font(.title3.monospacedDigit())
            }.frame(maxWidth: .infinity, alignment: .leading)
        }.buttonStyle(.bordered)
    }

    @ViewBuilder private func invoiceQueueRow(_ cycle: AMDOSInvoiceCycle) -> some View {
        let project = projects.first(where: { $0.projectId == cycle.projectId })
        let queueState = invoiceQueueState(cycle)
        let amount = invoiceAmount(cycle, project: project)
        AMDOSCard {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(project?.clientName?.trimmedNonEmpty ?? "取引先未設定").font(.headline)
                    Text(project?.projectName ?? cycle.projectId).font(.caption).foregroundStyle(AMDOSDesign.muted)
                    Text("稼働月 \(shortInvoiceYM(cycle.ym)) · 請求月 \(shortInvoiceYM(effectiveInvoiceYM(cycle)))")
                        .font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 5) {
                    AMDOSStatusBadge(text: queueState.label)
                    Text(amount.map(yen) ?? "請求額未入力").font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.muted)
                    HStack(spacing: 4) {
                        AMDOSStatusBadge(text: "取引先 \(project?.freeePartnerID?.trimmedNonEmpty == nil ? "未設定" : "設定済み")", tint: project?.freeePartnerID?.trimmedNonEmpty == nil ? AMDOSDesign.warning : AMDOSDesign.success)
                        AMDOSStatusBadge(text: "金額 \(amount == nil ? "未入力" : "設定済み")", tint: amount == nil ? AMDOSDesign.warning : AMDOSDesign.success)
                    }
                }
                Button("請求月") { beginInvoiceYMEdit(cycle) }.buttonStyle(.bordered)
                if queueState == .ready {
                    Button("発行") { Task { await prepare(cycle) } }.buttonStyle(.borderedProminent)
                } else {
                    Button(queueState == .setupMissing ? "設定" : "詳細") { Task { await prepare(cycle) } }.buttonStyle(.bordered)
                }
            }
        }
    }

    private func invoiceYMEditor(_ cycle: AMDOSInvoiceCycle) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("請求月を編集").font(.title3.bold())
            Text("\(projects.first(where: { $0.projectId == cycle.projectId })?.clientName?.trimmedNonEmpty ?? cycle.projectId) / 稼働月 \(shortInvoiceYM(cycle.ym))")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            TextField("YYYYMM", text: $invoiceYMDraft).textFieldStyle(.roundedBorder).font(.body.monospaced())
            Text("PWAと同じく、数字以外を除いて6桁まで保存する。空欄は稼働月 \(cycle.ym) に戻す。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            HStack {
                Button("キャンセル") { editingInvoiceYM = nil }.disabled(invoiceYMSaving)
                Spacer()
                Button(invoiceYMSaving ? "保存中…" : "請求月を保存") { saveInvoiceYM(cycle) }
                    .buttonStyle(.borderedProminent).disabled(invoiceYMSaving)
            }
            AMDOSAdminInlineMessage(text: message)
        }
        .padding(24)
        .frame(minWidth: 420)
    }

    private func beginInvoiceYMEdit(_ cycle: AMDOSInvoiceCycle) {
        invoiceYMDraft = effectiveInvoiceYM(cycle); message = nil; editingInvoiceYM = cycle
    }

    private func effectiveInvoiceYM(_ cycle: AMDOSInvoiceCycle) -> String { cycle.invoiceYM?.trimmedNonEmpty ?? cycle.ym }
    private func shortInvoiceYM(_ value: String) -> String {
        guard value.count == 6 else { return value }
        return "\(value.prefix(4))年\(Int(value.suffix(2)) ?? 0)月"
    }
    private func invoiceAmount(_ cycle: AMDOSInvoiceCycle, project: AMDOSInvoiceProject?) -> Double? {
        if let lineTotal = storedInvoiceNetAmount(cycle.invoiceBaseLinesJSON), lineTotal > 0 { return lineTotal.rounded() }
        if let reported = cycle.budgetReportedAmount, reported > 0 { return reported.rounded() }
        if project?.feeType == "monthly_fixed", let fee = project?.feeAmount, fee > 0 { return fee.rounded() }
        return nil
    }
    private func invoiceQueueState(_ cycle: AMDOSInvoiceCycle) -> AMDOSInvoiceQueueState {
        if cycle.paymentConfirmedAt?.trimmedNonEmpty != nil { return .paid }
        if cycle.invoiceSentAt?.trimmedNonEmpty != nil { return .sent }
        if cycle.invoiceIssuedAt?.trimmedNonEmpty != nil { return .issued }
        if effectiveInvoiceYM(cycle) < targetInvoiceYM { return .backlog }
        let project = projects.first(where: { $0.projectId == cycle.projectId })
        if project?.freeePartnerID?.trimmedNonEmpty == nil { return .setupMissing }
        if invoiceAmount(cycle, project: project) == nil { return .needsCheck }
        return .ready
    }

    private var editor: some View {
        AMDOSSectionCard("請求内容", systemImage: "doc.text.magnifyingglass") {
            if let preview {
                HStack(alignment: .top) {
                    VStack(alignment: .leading) {
                        Text(preview.project.clientName?.trimmedNonEmpty ?? "取引先未設定").font(.headline)
                        Text("\(preview.cycle.ym) · \(preview.project.projectName)").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        Text(preview.project.freeePartnerID?.trimmedNonEmpty.map { partnerID in
                            if let selectedFreeePartner, selectedFreeePartner.id == partnerID { return selectedFreeePartner.name }
                            return "freee ID \(partnerID)"
                        } ?? "freee取引先 未設定")
                        if let number = preview.cycle.freeeInvoiceNumber { Text("発行済み \(number)").foregroundStyle(AMDOSDesign.success) }
                    }.font(.caption)
                }
                if preview.project.freeePartnerID?.trimmedNonEmpty == nil {
                    freeePartnerResolution(preview)
                }
                invoicePreflight(preview)
                if let url = verifiedPDFURL(preview.cycle.invoicePDFURL) {
                    Button("PDFを開く") { NSWorkspace.shared.open(url) }.buttonStyle(.link)
                }
                if preview.cycle.invoiceIssuedAt != nil {
                    Button("発行を取り消す", role: .destructive) { confirmation = .cancel }.disabled(busy)
                }
                AMDOSTextField(title: "件名", text: $subject, axis: .vertical)
                invoiceLines(title: "基本明細行", lines: $baseLines, section: .base)
                Text(preview.fromPreviousMonth ? "前月の保存済み明細から引き継ぎ" : "契約月額 \(yen(preview.contractAmount))").font(.caption).foregroundStyle(AMDOSDesign.muted)
                AMDOSSectionCard("立替精算", systemImage: "tram.fill") {
                    Text("承認済み立替は発行時に自動で明細へ追加される").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    if preview.reimbursements.isEmpty { Text("今月の立替なし") }
                    ForEach(preview.reimbursements) { row in AMDOSLineItem(title: reimbursementLabel(row), subtitle: row.date ?? "日付なし", status: yen(row.amount ?? 0)) }
                }
                invoiceLines(title: "調整行", lines: $adjustmentLines, section: .adjustment)
                HStack { AMDOSTextField(title: "請求日 YYYY-MM-DD", text: $issueDate); AMDOSTextField(title: "支払期日 YYYY-MM-DD", text: $dueDate) }
                AMDOSTextField(title: "備考", text: $remark, axis: .vertical)
                VStack(alignment: .leading, spacing: 4) {
                    amountRow("基本行（税抜）", baseTotal)
                    amountRow("調整行（税抜）", adjustmentTotal)
                    amountRow("立替", reimbursementTotal)
                    amountRow("消費税（概算）", (netTotal + reimbursementTotal) * 0.1)
                    Divider()
                    amountRow("概算合計", (netTotal + reimbursementTotal) * 1.1)
                }
                HStack {
                    Button("下書き保存") { saveDraft() }.disabled(busy || allLinesJSON() == nil)
                    if invoiceQueueState(preview.cycle) == .ready {
                        Button("請求書を発行") { beginIssue() }.buttonStyle(.borderedProminent).disabled(busy || netTotal <= 0 || preview.project.freeePartnerID?.trimmedNonEmpty == nil || !validISODate(issueDate) || !validISODate(dueDate))
                    }
                    if busy { ProgressView().controlSize(.small) }
                }
                AMDOSAdminInlineMessage(text: message)
            }
        }
    }

    @ViewBuilder private func invoicePreflight(_ preview: AMDOSInvoicePreviewState) -> some View {
        let amount = invoiceAmount(preview.cycle, project: preview.project)
        let queueState = invoiceQueueState(preview.cycle)
        AMDOSSectionCard("発行前チェック", systemImage: "checkmark.shield") {
            HStack {
                Label("freee取引先", systemImage: preview.project.freeePartnerID?.trimmedNonEmpty == nil ? "clock" : "checkmark.circle.fill")
                Spacer()
                Text(preview.project.freeePartnerID?.trimmedNonEmpty == nil ? "未設定" : "設定済み")
                    .foregroundStyle(preview.project.freeePartnerID?.trimmedNonEmpty == nil ? AMDOSDesign.warning : AMDOSDesign.success)
            }
            Text(preview.project.freeePartnerID?.trimmedNonEmpty == nil ? "freee取引先を選んで保存すると、同じ請求先の未発行行も再判定する。" : "この請求先のfreee取引先は保存済み。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            AMDOSDivider()
            HStack {
                Label("請求額", systemImage: amount == nil ? "clock" : "checkmark.circle.fill")
                Spacer()
                Text(amount.map(yen) ?? "未入力").foregroundStyle(amount == nil ? AMDOSDesign.warning : AMDOSDesign.success)
            }
            Text(amount == nil ? "請求明細、確定請求額、契約月額のどれも入っていない。" : "請求明細、確定請求額、契約月額のどれかから請求額を読めている。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            if queueState == .backlog {
                AMDOSDivider()
                Label("過去滞留", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red)
                Text("請求月が現在の対象月（\(shortInvoiceYM(targetInvoiceYM))）より前で、発行・送付・入金の記録が入っていない。請求月が違うなら一覧の「請求月」から直す。")
                    .font(.caption).foregroundStyle(.red)
            }
        }
    }

    @ViewBuilder private func freeePartnerResolution(_ preview: AMDOSInvoicePreviewState) -> some View {
        AMDOSSectionCard("設定不足を解消", systemImage: "exclamationmark.triangle.fill") {
            Text("取引先名でfreee取引先を選ぶと、同じ請求先の未発行行もまとめて再判定される。")
                .font(.caption).foregroundStyle(.red)
            TextField("freee取引先を検索", text: $freeePartnerQuery)
                .textFieldStyle(.roundedBorder)
                .disabled(freeePartnerSaving)
                .onTapGesture {
                    if !freeePartnerSearchDidRun { searchFreeePartners(freeePartnerQuery) }
                }
                .onChange(of: freeePartnerQuery) { _, query in
                    searchFreeePartners(query)
                }
            if let selectedFreeePartner {
                Text("選択中: \(selectedFreeePartner.name) / \(freeePartnerMeta(selectedFreeePartner))")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            if freeePartnerLoading { HStack(spacing: 6) { ProgressView().controlSize(.small); Text("読み込み中...").font(.caption).foregroundStyle(AMDOSDesign.muted) } }
            if let freeePartnerError {
                Text(freeePartnerError).font(.caption).foregroundStyle(.red)
            } else if freeePartnerSearchDidRun && !freeePartnerLoading && freeePartnerOptions.isEmpty {
                Text("候補が見つからないよ").font(.caption).foregroundStyle(AMDOSDesign.muted)
            } else if !freeePartnerOptions.isEmpty {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        ForEach(freeePartnerOptions) { partner in
                            Button {
                                selectedFreeePartner = partner
                                freeePartnerQuery = partner.name
                            } label: {
                                HStack(alignment: .top, spacing: 8) {
                                    Image(systemName: selectedFreeePartner?.id == partner.id ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(selectedFreeePartner?.id == partner.id ? AMDOSDesign.success : AMDOSDesign.muted)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(partner.name).font(.subheadline.weight(.semibold))
                                        Text(freeePartnerMeta(partner)).font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                                    }
                                    Spacer(minLength: 0)
                                }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 5)
                            }.buttonStyle(.plain).disabled(freeePartnerSaving)
                        }
                    }
                }.frame(maxHeight: 180)
            }
            HStack {
                Spacer()
                Button(freeePartnerSaving ? "保存中…" : "保存") { saveFreeePartner(preview) }
                    .buttonStyle(.borderedProminent)
                    .disabled(selectedFreeePartner == nil || freeePartnerSaving)
            }
        }
    }

    private func freeePartnerMeta(_ partner: AMDOSFreeePartnerOption) -> String {
        [partner.code, partner.shortcut1, partner.shortcut2, "ID \(partner.id)"].compactMap { $0?.trimmedNonEmpty }.joined(separator: " / ")
    }

    @ViewBuilder private func invoiceLines(title: String, lines: Binding<[AMDOSInvoiceLine]>, section: AMDOSInvoiceLine.Section) -> some View {
        AMDOSSectionCard(title, systemImage: section == .base ? "list.bullet.rectangle" : "plusminus") {
            HStack {
                Button("品目を追加") { lines.wrappedValue.append(AMDOSInvoiceLine(section: section, kind: .item)) }
                Button("テキストを追加") { lines.wrappedValue.append(AMDOSInvoiceLine(section: section, kind: .text, quantity: "", unitPrice: "")) }
            }.buttonStyle(.bordered)
            if lines.wrappedValue.isEmpty { Text("明細なし").foregroundStyle(AMDOSDesign.muted) }
            ForEach(Array(lines.wrappedValue.indices), id: \.self) { index in
                VStack(alignment: .leading) {
                    HStack {
                        Text(lines.wrappedValue[index].kind == .text ? "テキスト" : "品目").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        TextField("内容", text: lines[index].description).textFieldStyle(.roundedBorder)
                        Button(role: .destructive) { lines.wrappedValue.remove(at: index) } label: { Image(systemName: "trash") }
                    }
                    if lines.wrappedValue[index].kind == .item {
                        HStack { TextField("数量", text: lines[index].quantity).textFieldStyle(.roundedBorder); TextField("単価", text: lines[index].unitPrice).textFieldStyle(.roundedBorder); Text("= \(yen(lines.wrappedValue[index].amount))").monospacedDigit() }
                    }
                }
            }
        }
    }

    private func amountRow(_ label: String, _ value: Double) -> some View { HStack { Text(label).foregroundStyle(AMDOSDesign.muted); Spacer(); Text(yen(value)).monospacedDigit() } }

    private func load() { Task { await reloadInvoices() } }

    private func reloadInvoices() async {
        state = .loading
        do {
            let lastClosedYM = invoiceAddingMonths(invoiceCurrentYM(), -1) ?? invoiceCurrentYM()
            let invoiceYMs = (0..<13).compactMap { invoiceAddingMonths(lastClosedYM, $0 - 12) }
            async let cycleRequest = AMDOSRESTClient.shared.fetchTable(AMDOSInvoiceCycle.self, table: "billing_cycles", select: "id,project_id,ym,invoice_ym,status,budget_yen,budget_reported_amount,invoice_subject,invoice_base_lines_json,invoice_issued_at,invoice_sent_at,payment_confirmed_at,freee_invoice_number,invoice_pdf_url", filters: ["ym": "in.(\(invoiceYMs.joined(separator: ",")))"], order: "ym.desc", limit: 10_000)
            async let projectRequest = AMDOSRESTClient.shared.fetchTable(AMDOSInvoiceProject.self, table: "projects", select: "id,project_id,project_name,client_name,status,fee_type,fee_amount,start_ym,end_ym,freeze_from_ym,contract_terms_json,payment_due_rule,payment_due_day,freee_partner_id", filters: ["status": "in.(active,ended,frozen)"], order: "project_name", limit: 1_000)
            let loadedCycles = try await cycleRequest; projects = try await projectRequest
            let projectMap = Dictionary(uniqueKeysWithValues: projects.map { ($0.projectId, $0) })
            let firstYM = invoiceAddingMonths(lastClosedYM, -12) ?? lastClosedYM
            cycles = loadedCycles.filter { cycle in
                guard cycle.ym >= firstYM, cycle.ym <= lastClosedYM, let project = projectMap[cycle.projectId] else { return false }
                if let start = project.startYM, cycle.ym < start { return false }
                if let end = project.endYM, cycle.ym > end { return false }
                if let freeze = project.freezeFromYM, cycle.ym >= freeze { return false }
                return invoiceAmount(cycle, project: project) != nil
            }
            state = cycles.isEmpty ? .empty : .loaded
        } catch { state = .failed(error.localizedDescription) }
    }

    private func saveInvoiceYM(_ cycle: AMDOSInvoiceCycle) {
        let digits = invoiceYMDraft.unicodeScalars
            .filter { $0.value >= 48 && $0.value <= 57 }
            .map(String.init)
            .joined()
        let invoiceYM = String(digits.prefix(6)).trimmedNonEmpty ?? cycle.ym
        Task {
            invoiceYMSaving = true; defer { invoiceYMSaving = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/invoices/invoice-ym",
                    method: "PATCH",
                    body: AMDOSInvoiceYMUpdateRequest(projectId: cycle.projectId, ym: cycle.ym, invoiceYm: invoiceYM)
                )
                let response = try JSONDecoder().decode(AMDOSInvoiceYMUpdateResponse.self, from: data)
                guard response.ok == true,
                      let updated = response.updatedCycle,
                      updated.projectId == cycle.projectId,
                      updated.ym == cycle.ym,
                      updated.invoiceYm == invoiceYM else {
                    throw AMDOSNetworkError.http(response.error ?? "請求月の保存結果を確認できなかった")
                }
                await reloadInvoices()
                guard let verified = cycles.first(where: { $0.projectId == cycle.projectId && $0.ym == cycle.ym }), effectiveInvoiceYM(verified) == invoiceYM else {
                    throw AMDOSNetworkError.http("請求月を再取得して確認できなかった")
                }
                invoiceYMDraft = invoiceYM; editingInvoiceYM = nil; message = "請求月を保存したよ"
            } catch {
                message = error.localizedDescription
            }
        }
    }

    private func searchFreeePartners(_ query: String) {
        let searchID = UUID()
        freeePartnerSearchID = searchID
        freeePartnerSearchDidRun = true
        freeePartnerLoading = true
        freeePartnerError = nil
        freeePartnerOptions = []
        Task {
            // FreeePartnerPicker waits 180ms and ignores a superseded result.
            // Keep the native picker on that same query cadence.
            try? await Task.sleep(for: .milliseconds(180))
            guard freeePartnerSearchID == searchID else { return }
            do {
                let response = try await AMDOSRESTClient.shared.fetchPWA(
                    AMDOSFreeePartnersResponse.self,
                    path: "/api/admin/freee-partners",
                    query: ["query": query.trimmingCharacters(in: .whitespacesAndNewlines), "limit": "60"]
                )
                guard freeePartnerSearchID == searchID else { return }
                guard response.ok != false else {
                    throw AMDOSNetworkError.http(response.error ?? "freee取引先を取得できなかった")
                }
                freeePartnerOptions = response.partners ?? []
            } catch {
                guard freeePartnerSearchID == searchID else { return }
                freeePartnerOptions = []
                freeePartnerError = error.localizedDescription
            }
            if freeePartnerSearchID == searchID { freeePartnerLoading = false }
        }
    }

    private func saveFreeePartner(_ currentPreview: AMDOSInvoicePreviewState) {
        guard let partner = selectedFreeePartner else { return }
        let projectID = currentPreview.project.projectId
        freeePartnerSaving = true
        freeePartnerError = nil
        Task {
            defer { freeePartnerSaving = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/invoices/freee-partner",
                    method: "PATCH",
                    body: AMDOSInvoiceFreeePartnerUpdateRequest(projectId: projectID, freeePartnerId: partner.id)
                )
                let response = try JSONDecoder().decode(AMDOSInvoiceFreeePartnerUpdateResponse.self, from: data)
                guard response.ok == true,
                      let updated = response.updatedProject,
                      updated.projectId == projectID,
                      updated.freeePartnerId == partner.id else {
                    throw AMDOSNetworkError.http(response.error ?? "freee取引先の保存結果を確認できなかった")
                }
                await reloadInvoices()
                guard let verifiedProject = projects.first(where: { $0.projectId == projectID }),
                      verifiedProject.freeePartnerID == partner.id else {
                    throw AMDOSNetworkError.http("freee取引先を再取得して確認できなかった")
                }
                // PWA also reapplies this project setting to its rows.  Reloading
                // all cycles makes the same project’s unissued rows recalculate.
                if let current = preview, current.project.projectId == projectID {
                    preview = AMDOSInvoicePreviewState(project: verifiedProject, cycle: current.cycle, reimbursements: current.reimbursements, fromPreviousMonth: current.fromPreviousMonth, contractAmount: current.contractAmount)
                }
                message = "\(partner.name)を保存したよ。この請求先の未発行行を再判定したよ。"
            } catch {
                freeePartnerError = error.localizedDescription
            }
        }
    }

    private func prepare(_ cycle: AMDOSInvoiceCycle) async {
        busy = true; message = nil; defer { busy = false }
        do {
            guard let project = projects.first(where: { $0.projectId == cycle.projectId }) else { throw AMDOSNetworkError.notFound }
            let monthPrefix = "\(cycle.ym.prefix(4))-\(cycle.ym.suffix(2))-"
            let monthStart = monthPrefix + "01"
            let nextYM = invoiceAddingMonths(cycle.ym, 1) ?? cycle.ym
            let nextMonthStart = "\(nextYM.prefix(4))-\(nextYM.suffix(2))-01"
            let rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSInvoiceReimbursement.self, table: "reimbursements", select: "reimbursement_id,description,amount,date,category,transport_from,transport_to", filters: ["project_id": "eq.\(cycle.projectId)", "status": "eq.approved", "and": "(date.gte.\(monthStart),date.lt.\(nextMonthStart))"], order: "date", limit: 1_000)
            let reimbursements = rows.filter { $0.date?.hasPrefix(monthPrefix) == true }
            var parsed = parseLines(cycle.invoiceBaseLinesJSON)
            var carried = false
            if parsed.base.isEmpty && parsed.adjustment.isEmpty, let previous = try await previousCycle(projectId: cycle.projectId, ym: cycle.ym) {
                let previousLines = parseLines(previous.invoiceBaseLinesJSON)
                if !previousLines.base.isEmpty || !previousLines.adjustment.isEmpty { parsed = previousLines; carried = true }
            }
            let amount = contractAmount(project: project, cycle: cycle)
            if parsed.base.isEmpty && parsed.adjustment.isEmpty { parsed.base = [AMDOSInvoiceLine(section: .base, kind: .item, description: "\(cycle.ym.prefix(4))年\(Int(cycle.ym.suffix(2)) ?? 0)月分 業務委託費", unitPrice: amount > 0 ? String(Int(amount.rounded())) : "")] }
            preview = AMDOSInvoicePreviewState(project: project, cycle: cycle, reimbursements: reimbursements, fromPreviousMonth: carried, contractAmount: amount)
            baseLines = parsed.base; adjustmentLines = parsed.adjustment
            subject = sanitizedSubject(cycle.invoiceSubject, internalName: project.projectName, clientName: project.clientName ?? "", ym: cycle.ym)
            remark = ""; issueDate = todayJST(); dueDate = paymentDueDate(ym: cycle.ym, rule: project.paymentDueRule, legacyDay: project.paymentDueDay)
            selectedFreeePartner = nil
            freeePartnerOptions = []
            freeePartnerError = nil
            freeePartnerSearchDidRun = false
            freeePartnerQuery = project.clientName?.trimmedNonEmpty ?? ""
            if project.freeePartnerID?.trimmedNonEmpty == nil, !freeePartnerQuery.isEmpty {
                searchFreeePartners(freeePartnerQuery)
            }
        } catch { message = error.localizedDescription }
    }

    private func saveDraft() { guard let preview, let allLinesJson = allLinesJSON() else { return }; busy = true; message = nil; Task { do {
        let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/invoices/draft", body: AMDOSInvoiceDraftRequest(projectId: preview.project.projectId, ym: preview.cycle.ym, invoiceSubject: subject, allLinesJson: allLinesJson))
        let result = try JSONDecoder().decode(AMDOSInvoiceDraftResponse.self, from: data)
        guard result.ok, result.updated == 1 else { throw AMDOSNetworkError.http(result.error ?? "下書きを保存できなかったよ") }
        guard let verified = try await verifiedCycle(projectId: preview.project.projectId, ym: preview.cycle.ym),
              verified.invoiceSubject == subject,
              verified.invoiceBaseLinesJSON == allLinesJson else {
            throw AMDOSNetworkError.http("下書きを再取得して確認できなかったよ")
        }
        self.preview?.cycle = verified
        replaceCycle(verified)
        message = "下書きを保存したよ"
    } catch { message = error.localizedDescription }; busy = false } }

    private func beginIssue() {
        guard let preview, invoiceQueueState(preview.cycle) == .ready else { return }
        let mismatch = preview.project.feeType == "monthly_fixed"
            && (preview.project.feeAmount ?? 0) > 0
            && abs(baseTotal - (preview.project.feeAmount ?? 0)) >= 0.5
        if mismatch { confirmation = .issueMismatch } else { issueInvoice() }
    }

    private func issueInvoice() { guard let preview, let allLinesJson = allLinesJSON() else { return }; confirmation = nil; busy = true; message = nil; Task { do {
        let result: AMDOSInvoiceEdgeResponse = try await AMDOSRESTClient.shared.postEdge(function: "issue-invoice", body: AMDOSInvoiceEdgeRequest(projectId: preview.project.projectId, ym: preview.cycle.ym, issueDate: issueDate, dueDate: dueDate, allLinesJson: allLinesJson, invoiceSubject: subject, invoiceRemark: remark, documentType: "invoice"))
        guard result.ok else { throw AMDOSNetworkError.http(result.message ?? "請求書発行に失敗したよ") }
        guard let verified = try await verifiedCycle(projectId: preview.project.projectId, ym: preview.cycle.ym), verified.invoiceIssuedAt != nil, verified.freeeInvoiceNumber?.trimmedNonEmpty != nil else {
            message = "freeeは作成済みの可能性があるが、OS記録の確認に失敗したよ。重複を避けるため、ここから再発行しないで確認してね。"; busy = false; return
        }
        self.preview?.cycle = verified; replaceCycle(verified); message = "請求書を発行したよ（\(verified.freeeInvoiceNumber!)）"
    } catch { message = error.localizedDescription }; busy = false } }

    private func cancelInvoice() { guard let preview else { return }; confirmation = nil; busy = true; message = nil; Task { do {
        let result: AMDOSInvoiceEdgeResponse = try await AMDOSRESTClient.shared.postEdge(function: "cancel-invoice", body: AMDOSInvoiceCancelRequest(projectId: preview.project.projectId, ym: preview.cycle.ym, documentType: "invoice"))
        guard result.ok else { throw AMDOSNetworkError.http(result.message ?? "発行情報を取り消せなかったよ") }
        guard let verified = try await verifiedCycle(projectId: preview.project.projectId, ym: preview.cycle.ym), verified.invoiceIssuedAt == nil, verified.freeeInvoiceNumber == nil else { throw AMDOSNetworkError.http("取消後のOS記録を確認できなかったよ") }
        self.preview?.cycle = verified; replaceCycle(verified); message = "請求書の発行情報を取り消したよ"
    } catch { message = error.localizedDescription }; busy = false } }

    private var confirmationTitle: String { confirmation == .cancel ? "請求書発行を取り消す？" : "この内容で請求書を発行する？" }
    private var confirmationMessage: String { switch confirmation { case .issueMismatch: return "基本行合計が契約月額と異なるよ。この金額のままfreeeで発行する？"; case .cancel: return "freee上の請求書は削除せず、OS側の発行・送付情報を戻すよ。案件設定によってはSlackにも取消通知が届く。"; case nil: return "" } }

    private func verifiedCycle(projectId: String, ym: String) async throws -> AMDOSInvoiceCycle? { let rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSInvoiceCycle.self, table: "billing_cycles", select: "id,project_id,ym,invoice_ym,status,budget_yen,budget_reported_amount,invoice_subject,invoice_base_lines_json,invoice_issued_at,invoice_sent_at,payment_confirmed_at,freee_invoice_number,invoice_pdf_url", filters: ["project_id": "eq.\(projectId)", "ym": "eq.\(ym)"], limit: 2); return rows.count == 1 ? rows[0] : nil }
    private func replaceCycle(_ cycle: AMDOSInvoiceCycle) { if let index = cycles.firstIndex(where: { $0.id == cycle.id }) { cycles[index] = cycle } }
}

private extension AMDOSAdminInvoicesView {
    func storedInvoiceNetAmount(_ rawJSON: String?) -> Double? {
        guard let rawJSON,
              let data = rawJSON.data(using: .utf8),
              let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return nil }
        let total = rows.reduce(0.0) { sum, row in
            guard row["type"] as? String != "text" else { return sum }
            let rawQuantity = invoiceDouble(row["quantity"] ?? row["qty"] ?? 1)
            let quantity = rawQuantity == 0 ? 1 : rawQuantity
            let unitPrice = invoiceDouble(row["unit_price"] ?? row["unitPrice"] ?? row["amount"] ?? 0)
            return sum + quantity * unitPrice
        }
        return total > 0 ? total.rounded() : nil
    }

    func parseLines(_ rawJSON: String?) -> (base: [AMDOSInvoiceLine], adjustment: [AMDOSInvoiceLine]) {
        guard let rawJSON, let data = rawJSON.data(using: .utf8), let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return ([], []) }
        var base: [AMDOSInvoiceLine] = []; var adjustment: [AMDOSInvoiceLine] = []
        for row in rows {
            let description = String(describing: row["description"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !description.isEmpty, description != "[[CTB_ESTIMATE_SENT]]" else { continue }
            let section: AMDOSInvoiceLine.Section = row["section"] as? String == "adjustment" ? .adjustment : .base
            let kind: AMDOSInvoiceLine.Kind = row["type"] as? String == "text" ? .text : .item
            let quantity = kind == .text ? "" : invoiceNumberString(row["quantity"] ?? 1)
            let unit = kind == .text ? "" : invoiceNumberString(row["unit_price"] ?? row["unitPrice"] ?? 0)
            let line = AMDOSInvoiceLine(section: section, kind: kind, description: description, quantity: quantity, unitPrice: unit == "0" ? "" : unit)
            if section == .adjustment { adjustment.append(line) } else { base.append(line) }
        }
        return (base, adjustment)
    }

    func allLinesJSON() -> String? {
        let lines = baseLines + adjustmentLines
        let rows: [[String: Any]] = lines.map { line in
            if line.kind == .text { return ["section": line.section.rawValue, "type": "text", "description": line.description] }
            let rawQuantity = Double(line.quantity) ?? 0
            return ["section": line.section.rawValue, "type": "item", "description": line.description, "quantity": rawQuantity == 0 ? 1 : rawQuantity, "unit_price": Double(line.unitPrice) ?? 0]
        }
        guard JSONSerialization.isValidJSONObject(rows), let data = try? JSONSerialization.data(withJSONObject: rows) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func previousCycle(projectId: String, ym: String) async throws -> AMDOSInvoiceCycle? {
        guard let previousYM = invoiceAddingMonths(ym, -1) else { return nil }
        return try await AMDOSRESTClient.shared.fetchTable(AMDOSInvoiceCycle.self, table: "billing_cycles", select: "id,project_id,ym,status,budget_yen,budget_reported_amount,invoice_subject,invoice_base_lines_json,invoice_issued_at,invoice_sent_at,freee_invoice_number,invoice_pdf_url", filters: ["project_id": "eq.\(projectId)", "ym": "eq.\(previousYM)"], limit: 1).first
    }

    func contractAmount(project: AMDOSInvoiceProject, cycle: AMDOSInvoiceCycle) -> Double {
        let withinPeriod = (project.startYM == nil || cycle.ym >= project.startYM!) && (project.endYM == nil || cycle.ym <= project.endYM!)
        let evidence = cycle.invoiceIssuedAt != nil || cycle.freeeInvoiceNumber != nil || cycle.invoiceBaseLinesJSON != nil
        let realized = ["reported", "budget_confirmed", "allocation_confirmed", "invoice_issued", "invoice_sent", "payment_confirmed", "reward_paid"].contains((cycle.status ?? "").lowercased()) || evidence
        let reported = max(0, cycle.budgetReportedAmount ?? 0)
        if !withinPeriod { return realized ? reported : 0 }
        if reported > 0 { return reported }
        if let schedule = project.contractTerms?.object?["monthlySchedule"]?.array ?? project.contractTerms?.object?["monthly_schedule"]?.array {
            for item in schedule {
                guard let object = item.object, object["ym"]?.string == cycle.ym else { continue }
                let amount = object["amountTaxExcl"]?.number ?? object["amount_tax_excl"]?.number ?? object["clientAmountYen"]?.number ?? object["client_amount_yen"]?.number ?? object["invoiceYen"]?.number ?? object["invoice_yen"]?.number ?? 0
                return max(0, amount)
            }
        }
        return project.feeType?.lowercased() == "monthly_fixed" ? max(0, project.feeAmount ?? 0) : 0
    }

    func sanitizedSubject(_ raw: String?, internalName: String, clientName: String, ym: String) -> String {
        let label = invoiceYMLabel(ym)
        let client = clientName.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = client.isEmpty ? "\(label) 業務委託費" : "\(client) \(label) 業務委託費"
        guard let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return fallback }
        let internalProject = internalName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !internalProject.isEmpty, value.contains(internalProject) else { return value }
        let replaced = client.isEmpty
            ? value.replacingOccurrences(of: internalProject, with: "")
                .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            : value.replacingOccurrences(of: internalProject, with: client)
        return replaced.isEmpty ? fallback : replaced
    }

    func reimbursementLabel(_ row: AMDOSInvoiceReimbursement) -> String {
        let date = (row.date ?? "").replacingOccurrences(of: #"^\d{4}-"#, with: "", options: .regularExpression).replacingOccurrences(of: "-", with: "/")
        let route = [row.transportFrom, row.transportTo].compactMap { $0?.trimmedNonEmpty }.joined(separator: "→")
        return [date.trimmedNonEmpty, row.category?.trimmedNonEmpty, route.trimmedNonEmpty, row.description?.trimmedNonEmpty].compactMap { $0 }.joined(separator: " ").trimmedNonEmpty ?? "立替"
    }

    func verifiedPDFURL(_ raw: String?) -> URL? { guard let value = raw?.trimmedNonEmpty, let url = URL(string: value), ["https", "http"].contains(url.scheme?.lowercased() ?? ""), url.host?.trimmedNonEmpty != nil else { return nil }; return url }
    func validISODate(_ value: String) -> Bool { value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil }
    func yen(_ value: Double) -> String { "¥" + Int(value.rounded()).formatted() }
}

private func invoiceNumberString(_ value: Any) -> String {
    if let number = value as? NSNumber { let double = number.doubleValue; return double.rounded() == double ? String(Int(double)) : String(double) }
    return String(describing: value)
}

private func invoiceDouble(_ value: Any) -> Double {
    if let number = value as? NSNumber { return number.doubleValue }
    if let text = value as? String { return Double(text) ?? 0 }
    return 0
}

private func invoiceYMLabel(_ ym: String) -> String { guard ym.count == 6 else { return ym }; return "\(ym.prefix(4))年\(Int(ym.suffix(2)) ?? 0)月" }
private func invoiceCurrentYM() -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Tokyo") ?? TimeZone(secondsFromGMT: 9 * 60 * 60)!
    return String(format: "%04d%02d", calendar.component(.year, from: Date()), calendar.component(.month, from: Date()))
}
private func todayJST() -> String { let date = Date().addingTimeInterval(9 * 60 * 60); return String(ISO8601DateFormatter().string(from: date).prefix(10)) }

private func invoiceAddingMonths(_ ym: String, _ delta: Int) -> String? {
    guard ym.count == 6, let year = Int(ym.prefix(4)), let month = Int(ym.suffix(2)) else { return nil }
    let raw = year * 12 + month - 1 + delta
    return String(format: "%04d%02d", raw / 12, raw % 12 + 1)
}

private let invoiceJapaneseHolidays: Set<String> = [
    "2024-01-01", "2024-01-08", "2024-02-11", "2024-02-12", "2024-02-23", "2024-03-20", "2024-04-29", "2024-05-03", "2024-05-04", "2024-05-05", "2024-05-06", "2024-07-15", "2024-08-11", "2024-08-12", "2024-09-16", "2024-09-22", "2024-09-23", "2024-10-14", "2024-11-03", "2024-11-04", "2024-11-23",
    "2025-01-01", "2025-01-13", "2025-02-11", "2025-02-23", "2025-02-24", "2025-03-20", "2025-04-29", "2025-05-03", "2025-05-04", "2025-05-05", "2025-05-06", "2025-07-21", "2025-08-11", "2025-09-15", "2025-09-23", "2025-10-13", "2025-11-03", "2025-11-23", "2025-11-24",
    "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20", "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06", "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-12", "2026-11-03", "2026-11-23",
    "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21", "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05", "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11", "2027-11-03", "2027-11-23"
]

private func paymentDueDate(ym: String, rule: String?, legacyDay: Int?, referenceDate: String? = nil) -> String {
    guard let current = invoiceAddingMonths(ym, 0) else { return todayJST() }
    var paymentYM = invoiceAddingMonths(current, 1) ?? current
    var day: Int
    switch rule?.trimmingCharacters(in: .whitespacesAndNewlines) {
    case "current_month_eom": paymentYM = current; day = invoiceLastDay(paymentYM)
    case "current_month_25": paymentYM = current; day = 25
    case "next_month_eom", "issue_month_eom": day = invoiceLastDay(paymentYM)
    case "next_month_25", "next_month_15", "issue_month_25", "issue_month_25th": day = 25
    case "second_month_eom": paymentYM = invoiceAddingMonths(current, 2) ?? paymentYM; day = invoiceLastDay(paymentYM)
    case "second_month_25": paymentYM = invoiceAddingMonths(current, 2) ?? paymentYM; day = 25
    case "invoice_received_60_days":
        let base = referenceDate?.prefix(10).description ?? "\(current.prefix(4))-\(current.suffix(2))-\(String(format: "%02d", invoiceLastDay(current)))"
        return invoiceDateAddingDays(base, 60)
    default: day = (legacyDay ?? 0) > 0 ? legacyDay! : invoiceLastDay(paymentYM)
    }
    let iso = "\(paymentYM.prefix(4))-\(paymentYM.suffix(2))-\(String(format: "%02d", min(max(day, 1), invoiceLastDay(paymentYM))))"
    return invoicePreviousBusinessDay(iso)
}

private func invoiceLastDay(_ ym: String) -> Int {
    var comps = DateComponents(); comps.calendar = Calendar(identifier: .gregorian); comps.timeZone = TimeZone(secondsFromGMT: 0); comps.year = Int(ym.prefix(4)); comps.month = Int(ym.suffix(2))! + 1; comps.day = 0
    return Calendar(identifier: .gregorian).date(from: comps).map { Calendar(identifier: .gregorian).component(.day, from: $0) } ?? 28
}

private func invoiceDateAddingDays(_ iso: String, _ days: Int) -> String {
    let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(secondsFromGMT: 0); formatter.dateFormat = "yyyy-MM-dd"
    guard let date = formatter.date(from: iso), let future = formatter.calendar.date(byAdding: .day, value: days, to: date) else { return iso }
    return invoicePreviousBusinessDay(formatter.string(from: future))
}

private func invoicePreviousBusinessDay(_ iso: String) -> String {
    let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(secondsFromGMT: 0); formatter.dateFormat = "yyyy-MM-dd"
    guard var date = formatter.date(from: iso) else { return iso }
    for _ in 0..<14 {
        let weekday = formatter.calendar.component(.weekday, from: date); let value = formatter.string(from: date)
        if weekday != 1 && weekday != 7 && !invoiceJapaneseHolidays.contains(value) { return value }
        date = formatter.calendar.date(byAdding: .day, value: -1, to: date) ?? date
    }
    return iso
}

private struct AMDOSPayoutMember: Codable, Identifiable, Sendable {
    let id: String; let codeName: String?; let memberName: String?; let contractorName: String?; let memberAddress: String?; let invoiceRegistrationNumber: String?; let bankInfo: String?
    let email: String?; let status: String?; let isOfficer: Bool?; let excluded: Bool?; let updatedAt: String?
    enum CodingKeys: String, CodingKey {
        case id = "member_id", codeName = "code_name", memberName = "member_name", contractorName = "contractor_name", memberAddress = "member_address", invoiceRegistrationNumber = "invoice_registration_number", bankInfo = "bank_info"
        case email, status, isOfficer = "is_officer", excluded = "exclude_from_payout_notice", updatedAt = "updated_at"
    }
}
private struct AMDOSAdminPayoutNotice: Codable, Identifiable, Sendable {
    let id: String; let ym: String; let sentAt: String?; let noticeNo: String?; let pdfUrl: String?; let totalYen: Double?; let lastGeneratedAt: String?
    enum CodingKeys: String, CodingKey { case id = "member_id", ym, sentAt = "sent_at", noticeNo = "notice_no", pdfUrl = "pdf_url", totalYen = "total_yen", lastGeneratedAt = "last_generated_at" }
}
private struct AMDOSPayoutExpectedEntry: Codable, Sendable {
    let projectID: String
    let ym: String
    let memberID: String
    let totalYen: Double

    enum CodingKeys: String, CodingKey {
        case projectID = "project_id", ym, memberID = "member_id"
        case totalYen = "total_pay"
    }
}
private struct AMDOSMonthlyRewardPayout: Codable, Sendable {
    let projectID: String
    let ym: String
    let memberID: String
    let totalYen: Double

    enum CodingKeys: String, CodingKey {
        case projectID = "project_id", ym, memberID = "member_id"
        case totalYen = "total_pay"
    }
}
private struct AMDOSPayoutAgreementGateRow: Codable, Identifiable, Sendable {
    let key: String
    let sourceYM: String
    let memberID: String
    let memberName: String
    let projectID: String
    let projectName: String
    let totalPay: Double
    let status: String
    let reason: String
    let required: Bool
    let migrationBypass: Bool?

    var id: String { key }

    enum CodingKeys: String, CodingKey {
        case key, sourceYM = "sourceYm", memberID = "memberId", memberName, projectID = "projectId", projectName, totalPay, status, reason, required, migrationBypass
    }
}
private struct AMDOSPayoutAgreementGate: Codable, Sendable {
    let paymentYM: String
    let targetAction: String
    let totalTargets: Int
    let requiredCount: Int
    let notRequiredCount: Int
    let agreedCount: Int
    let blockedCount: Int
    let overrideCount: Int
    let allowed: Bool
    let blockers: [AMDOSPayoutAgreementGateRow]

    enum CodingKeys: String, CodingKey {
        case paymentYM = "paymentYm", targetAction, totalTargets, requiredCount, notRequiredCount, agreedCount, blockedCount, overrideCount, allowed, blockers
    }
}
private struct AMDOSPayoutEnvelope: Codable, Sendable {
    let ok: Bool?
    let ym: String?
    let previewOnly: Bool?
    let bulkResult: AMDOSPayoutBulkResult?
    let members: [AMDOSPayoutMember]?
    let notices: [AMDOSAdminPayoutNotice]?
    let expectedEntries: [AMDOSPayoutExpectedEntry]?
    let payouts: [AMDOSMonthlyRewardPayout]?
    let payoutAgreementGate: AMDOSPayoutAgreementGate?
    let savedPayoutRows: Int?
    let savedNoticeRows: Int?
    let clearedStaleNoticePdfs: Int?
    let deletedStaleNoticeRows: Int?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case ok, ym, previewOnly, bulkResult, members, notices, expectedEntries, payouts, payoutAgreementGate, savedPayoutRows, savedNoticeRows, clearedStaleNoticePdfs, deletedStaleNoticeRows, error
    }
}
private struct AMDOSPayoutSnapshotSaveRequest: Encodable, Sendable {
    let ym: String
    let agreementOverrideReason: String?
}
private struct AMDOSPayoutBulkActionRequest: Encodable, Sendable {
    let action: String
    let ym: String
    // PWAの通常一括操作は memberIds を指定せず、API側の対象選別
    // （報酬明細 + 既存未送付通知書、除外・役員・送付済みは除く）に委ねる。
    // nil はJSONから省略され、route の `Array.isArray` 判定では null と同じ意味になる。
    let memberIds: [String]?
    let force: Bool
    let agreementOverrideReason: String?
}
private struct AMDOSPayoutBulkResultItem: Codable, Identifiable, Sendable {
    let memberID: String
    let status: String
    let reason: String?
    let noticeNo: String?
    let pdfURL: String?
    let totalYen: Double?
    let lastGeneratedAt: String?
    let error: String?

    var id: String { memberID }

    enum CodingKeys: String, CodingKey {
        case memberID = "memberId", status, reason, noticeNo
        case pdfURL = "pdfUrl"
        case totalYen, lastGeneratedAt, error
    }
}
private struct AMDOSPayoutBulkResult: Codable, Sendable {
    let targetCount: Int
    let generated: Int
    let skipped: Int
    let failed: Int
    let results: [AMDOSPayoutBulkResultItem]
}
private struct AMDOSPayoutAction: Encodable, Sendable {
    let action: String
    let ym: String
    let memberId: String
    let totalYen: Double?
    let agreementOverrideReason: String?
}
/// `/api/admin/payouts` のメール送信は、PWAと同じく「正式PDFを確認 → 本文を
/// 必要なら直す → 明示的に送信」の三段階。本文だけはpreview結果とは別に送る。
private struct AMDOSPayoutMailAction: Encodable, Sendable {
    let action: String
    let ym: String
    let memberId: String
    let totalYen: Double
    let body: String
    let agreementOverrideReason: String?
}

/// `update_notice` はメール送信を取り消せないが、PWAと同じく台帳上の送付済み
/// フラグだけを未送付へ戻せる。再送はその後に正式PDFを確認して行う。
private struct AMDOSPayoutNoticeStatusAction: Encodable, Sendable {
    let action: String
    let ym: String
    let memberId: String
    let totalYen: Double
    let clearSent: Bool
    let agreementOverrideReason: String?
}

private struct AMDOSPayoutPaymentNudgeRequest: Encodable, Sendable {
    let ym: String
}

private struct AMDOSPayoutPaymentNudgeResponse: Decodable, Sendable {
    let ok: Bool?
    let error: String?
    let skipped: String?
    let sent: Int?
    let groupCount: Int?
    let targetCount: Int?
}
private struct AMDOSPayoutIssuedNotice: Codable, Sendable {
    let memberID: String?
    let noticeNo: String?
    let pdfURL: String?
    let totalYen: Double?
    let lastGeneratedAt: String?

    enum CodingKeys: String, CodingKey {
        case memberID = "memberId"
        case noticeNo
        case pdfURL = "pdfUrl"
        case totalYen
        case lastGeneratedAt
    }
}
private struct AMDOSPayoutIssueResponse: Codable, Sendable {
    let ok: Bool?
    let error: String?
    let issuedNotice: AMDOSPayoutIssuedNotice?
    let ym: String?
    let members: [AMDOSPayoutMember]?
    let notices: [AMDOSAdminPayoutNotice]?
    let expectedEntries: [AMDOSPayoutExpectedEntry]?
}
private struct AMDOSPayoutMailPreview: Codable, Identifiable, Sendable {
    let memberID: String
    let memberName: String
    let to: String
    let from: String
    let bcc: [String]
    let subject: String
    let body: String
    let dueDateText: String
    let pdfURL: String
    let pdfDriveFileID: String
    let totalYen: Double
    let alreadySentAt: String?
    let pdfPreparedBeforeSend: Bool?

    var id: String { "\(memberID):\(pdfURL)" }

    enum CodingKeys: String, CodingKey {
        case memberID = "memberId"
        case memberName, to, from, bcc, subject, body, dueDateText
        case pdfURL = "pdfUrl"
        case pdfDriveFileID = "pdfDriveFileId"
        case totalYen, alreadySentAt, pdfPreparedBeforeSend
    }
}
private struct AMDOSPayoutMailPreviewResponse: Codable, Sendable {
    let ok: Bool?
    let error: String?
    let preview: AMDOSPayoutMailPreview?
}
private struct AMDOSPayoutErrorResponse: Decodable, Sendable {
    let error: String?
}

struct AMDOSAdminPayoutsView: View {
    @State private var ym = ""
    @State private var data: AMDOSPayoutEnvelope?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var busyMemberID: String?
    @State private var mailPreview: AMDOSPayoutMailPreview?
    @State private var mailBody = ""
    @State private var mailEditing = false
    @State private var mailSending = false
    @State private var mailError: String?
    @State private var snapshotSaving = false
    @State private var refreshRewardsLoading = false
    @State private var paymentNudgeSending = false
    @State private var agreementOverrideReason = ""
    @State private var bulkPDFMode: AMDOSPayoutBulkPDFMode?
    @State private var bulkPDFResult: AMDOSPayoutBulkResult?
    @State private var bulkPDFResultPreviewOnly: Bool?
    @State private var confirmForceBulkIssue = false

    private enum AMDOSPayoutBulkPDFMode: Equatable {
        case preview
        case issue
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ADMIN PAYOUTS", title: "支払通知", subtitle: "支払通知書の発行・保存済みPDF確認・送付内容確認を、PWAと同じ権限境界で扱う") {
            HStack {
                TextField("YYYYMM", text: $ym)
                    .textFieldStyle(.roundedBorder)
                Button("再取得") { load() }
                    .disabled(busyMemberID != nil || snapshotSaving || refreshRewardsLoading || paymentNudgeSending)
                Button(refreshRewardsLoading ? "報酬キャッシュを再計算中…" : "報酬キャッシュ再計算") {
                    load(refreshRewards: true)
                }
                .disabled(busyMemberID != nil || snapshotSaving || refreshRewardsLoading || paymentNudgeSending)
                Button(paymentNudgeSending ? "入金確認nudge送信中…" : "入金確認nudge") {
                    sendPaymentNudges()
                }
                .disabled(busyMemberID != nil || snapshotSaving || refreshRewardsLoading || paymentNudgeSending || bulkPDFMode != nil)
            }
            AMDOSStateNotice(state: state) { load() }
            if let data {
                payoutSnapshotControls(data)
                ForEach(data.members ?? []) { member in
                    AMDOSSectionCard(member.memberName ?? member.codeName ?? member.id, systemImage: "banknote") {
                        Text(member.email ?? "メール未登録")
                            .font(.caption)
                        AMDOSStatusBadge(text: member.excluded == true || member.isOfficer == true ? "通知除外" : member.status ?? "状態不明")

                        let notice = data.notices?.first(where: { $0.id == member.id })
                        let totalYen = payoutTotal(for: member.id, notice: notice)
                        let isNoticeExcluded = member.excluded == true || member.isOfficer == true
                        let isSent = notice?.sentAt?.trimmedNonEmpty != nil
                        let formalPDFURL = formalPDFURL(for: notice)
                        let profileFreshness = profileFreshness(member: member, notice: notice)
                        let savedNoticeTotal = (notice?.totalYen ?? 0).rounded()
                        let totalMismatch = savedNoticeTotal > 0 && savedNoticeTotal != totalYen.rounded()
                        let requiresRegeneration = profileFreshness != .current || totalMismatch

                        HStack {
                            Button(busyMemberID == member.id ? "発行中…" : "支払通知書発行") {
                                issueNoticePDF(member: member)
                            }
                                .buttonStyle(.borderedProminent)
                                .disabled(isNoticeExcluded || totalYen <= 0 || busyMemberID != nil)
                            Button("PDF確認") { openSavedPDF(formalPDFURL) }
                                .disabled(formalPDFURL == nil || requiresRegeneration || busyMemberID != nil)
                            Button(isSent ? (busyMemberID == member.id ? "取消中…" : "送付取消") : (busyMemberID == member.id ? "確認中…" : "送付内容を確認")) {
                                if isSent {
                                    clearNoticeSent(member: member, totalYen: totalYen)
                                } else {
                                    previewNoticeEmail(member: member, totalYen: totalYen)
                                }
                            }
                            .disabled(
                                busyMemberID != nil || (
                                    !isSent && (isNoticeExcluded || totalYen <= 0 || formalPDFURL == nil || requiresRegeneration)
                                )
                            )
                        }
                        Text(totalYen > 0 ? "通知額 \(Int(totalYen))円（税抜）" : "通知額未計算")
                            .font(.caption)
                            .foregroundStyle(AMDOSDesign.muted)
                        if profileFreshness == .stale {
                            Text("メンバー台帳がPDF生成後に更新されているため、PDF確認・送付内容確認の前に再発行が必要")
                                .font(.caption).foregroundStyle(AMDOSDesign.warning)
                        } else if profileFreshness == .unknown {
                            Text("PDF生成時刻またはメンバー更新時刻を判定できないため、PDF確認・送付内容確認の前に再発行が必要")
                                .font(.caption).foregroundStyle(AMDOSDesign.warning)
                        } else if totalMismatch {
                            Text("支払額がPDF生成後に変わっているため、PDF確認・送付内容確認の前に再発行が必要")
                                .font(.caption).foregroundStyle(AMDOSDesign.warning)
                        }
                        if let noticeNo = notice?.noticeNo, !noticeNo.isEmpty {
                            Text("通知書番号: \(noticeNo)")
                                .font(.caption.monospaced())
                                .foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                }
            }
            AMDOSAdminInlineMessage(text: message)
        }
        .task {
            if ym.isEmpty { ym = currentAdminYM() }
            load()
        }
        .sheet(item: $mailPreview) { preview in
            AMDOSPayoutMailPreviewSheet(
                preview: preview,
                draftBody: $mailBody,
                isEditing: $mailEditing,
                isSending: mailSending,
                error: mailError,
                openPDF: openSavedPDF,
                onSend: { sendNoticeEmail(preview) }
            )
        }
        .confirmationDialog("全員分の支払通知書PDFを強制再生成する？", isPresented: $confirmForceBulkIssue, titleVisibility: .visible) {
            Button("強制再発行 (全員)", role: .destructive) {
                runBulkPDF(previewOnly: false, force: true)
            }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("最新DBの住所・宛名・登録番号で、差分検出を無視して再生成するよ。金額が変わっていなくても、台帳やラベルの修正を反映したい時だけ使ってね。")
        }
    }

    @ViewBuilder private func payoutSnapshotControls(_ payload: AMDOSPayoutEnvelope) -> some View {
        AMDOSSectionCard("月次の支払通知内容を保存", systemImage: "tray.and.arrow.down") {
            Text("PWAと同じ保存処理で、報酬キャッシュを再計算して monthly_reward_payout と未送付の payout_notices を月次スナップショットへ同期する。送付済み通知書は履歴保護のため更新しない。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            payoutAgreementGatePanel(payload.payoutAgreementGate)
            HStack {
                Button(snapshotSaving ? "再計算・保存中…" : "報酬を再計算して保存") { savePayoutSnapshot() }
                    .buttonStyle(.borderedProminent)
                    .disabled(snapshotSaving || payoutSaveBlockedByAgreement(payload.payoutAgreementGate))
                if let status = payoutSnapshotStatus(payload) {
                    Text(status).font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
            }
            if payoutSaveBlockedByAgreement(payload.payoutAgreementGate) {
                Text("月初合意blockerを解除するか、admin override reasonを8文字以上入れてね")
                    .font(.caption).foregroundStyle(.red)
            }
        }
        payoutBulkPDFControls(payload)
    }

    @ViewBuilder private func payoutBulkPDFControls(_ payload: AMDOSPayoutEnvelope) -> some View {
        let targetMemberIDs = payoutBulkTargetMemberIDs(payload)
        let blockedByAgreement = payoutSaveBlockedByAgreement(payload.payoutAgreementGate)
        let isWorking = bulkPDFMode != nil
        let isDisabled = snapshotSaving || busyMemberID != nil || isWorking || targetMemberIDs.isEmpty || blockedByAgreement
        AMDOSSectionCard("支払通知書PDFを一括処理", systemImage: "doc.on.doc") {
            Text("対象はPWA APIと同じ。最新の支払明細に加えて、既存の未送付通知書も含める。送付済み、通知除外、役員は除く。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            Text("対象 \(targetMemberIDs.count)人")
                .font(.caption.weight(.semibold))
                .foregroundStyle(AMDOSDesign.muted)
            HStack {
                Button(bulkPDFMode == .issue ? "本番PDF発行中…" : "全員分PDF一括発行") {
                    runBulkPDF(previewOnly: false, force: false)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isDisabled)
                Button(bulkPDFMode == .preview ? "確認用PDF生成中…" : "確認用PDF生成") {
                    runBulkPDF(previewOnly: true, force: false)
                }
                .disabled(isDisabled)
                Button(bulkPDFMode == .issue ? "強制再発行中…" : "強制再発行 (全員)") {
                    confirmForceBulkIssue = true
                }
                .buttonStyle(.bordered)
                .tint(AMDOSDesign.warning)
                .disabled(isDisabled)
            }
            if targetMemberIDs.isEmpty {
                Text("対象メンバーがいない")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            } else if blockedByAgreement {
                Text("月初合意blockerを解除するか、admin override reasonを8文字以上入れてね")
                    .font(.caption).foregroundStyle(.red)
            } else {
                Text("確認用PDFはDB保存なし・正式PDFは更新しない。本番PDFは最新スナップショットを同期してから正式PDFを更新する。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            if let result = bulkPDFResult {
                payoutBulkPDFResultPanel(result, previewOnly: bulkPDFResultPreviewOnly == true)
            }
        }
    }

    @ViewBuilder private func payoutBulkPDFResultPanel(_ result: AMDOSPayoutBulkResult, previewOnly: Bool) -> some View {
        let failures = result.results.filter { $0.status == "failed" }
        VStack(alignment: .leading, spacing: 6) {
            Text("\(previewOnly ? "確認用" : "本番")PDF結果: 対象 \(result.targetCount)人 / 生成 \(result.generated) / 既存利用 \(result.skipped) / 失敗 \(result.failed)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(result.failed > 0 ? .red : AMDOSDesign.success)
            if !failures.isEmpty {
                Text("一括PDF生成で失敗があった")
                    .font(.caption.weight(.semibold)).foregroundStyle(.red)
                ForEach(failures.prefix(8)) { item in
                    let member = data?.members?.first(where: { $0.id == item.memberID })
                    Text("\(member?.codeName ?? member?.memberName ?? item.memberID) (\(item.reason ?? "failed")) \(item.error ?? "")")
                        .font(.caption).foregroundStyle(.red)
                }
                if failures.count > 8 { Text("…他 \(failures.count - 8) 件").font(.caption).foregroundStyle(.red) }
            }
        }
        .padding(8)
        .background((result.failed > 0 ? Color.red : AMDOSDesign.success).opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }

    @ViewBuilder private func payoutAgreementGatePanel(_ gate: AMDOSPayoutAgreementGate?) -> some View {
        if let gate, gate.totalTargets > 0 {
            let blockers = gate.blockers
            let blocked = !blockers.isEmpty
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("月初合意支払ゲート").font(.subheadline.weight(.semibold))
                    Spacer()
                    AMDOSStatusBadge(text: blocked ? "支払停止" : "支払可能", tint: blocked ? AMDOSDesign.warning : AMDOSDesign.success)
                }
                Text("required \(gate.requiredCount) · agreed \(gate.agreedCount) · not required \(gate.notRequiredCount) · blocker \(gate.blockedCount)")
                    .font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                if !blockers.isEmpty {
                    ForEach(blockers.prefix(12)) { row in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(row.memberName) / \(row.projectName) / \(payoutYMLabel(row.sourceYM))")
                                .font(.caption.weight(.semibold))
                            Text("\(payoutAgreementStatusLabel(row.status)) · \(row.reason) · 税抜 \(Int(row.totalPay.rounded()))円")
                                .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(8).background(AMDOSDesign.warning.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
                    }
                    if blockers.count > 12 { Text("他 \(blockers.count - 12) 件").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    TextField("admin override reason", text: $agreementOverrideReason, axis: .vertical)
                        .textFieldStyle(.roundedBorder).lineLimit(2...3)
                    Text("override は server-side で actor / reason / member / PJ / 支払月 / 稼働月を監査ログに残す。")
                        .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                }
            }
            .padding(10)
            .background((blocked ? Color.red : AMDOSDesign.success).opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private func currentAdminYM() -> String {
        let calendar = Calendar(identifier: .gregorian)
        let date = Date()
        return String(calendar.component(.year, from: date)) + String(format: "%02d", calendar.component(.month, from: date))
    }

    private func load(refreshRewards: Bool = false) {
        Task {
            if refreshRewards { refreshRewardsLoading = true }
            defer { refreshRewardsLoading = false }
            await reload(refreshRewards: refreshRewards)
        }
    }

    private func reload(refreshRewards: Bool = false) async {
        guard ym.count == 6 else { return }
        state = .loading
        do {
            data = try await fetchPayoutData(ym: ym, refreshRewards: refreshRewards)
            state = (data?.members ?? []).isEmpty ? .empty : .loaded
            if refreshRewards {
                message = "報酬キャッシュを再計算して、最新の支払通知データを読み直したよ"
            }
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    private func fetchPayoutData(ym: String, refreshRewards: Bool = false) async throws -> AMDOSPayoutEnvelope {
        var query = ["ym": ym, "includeAgreementGate": "1"]
        if refreshRewards { query["refreshRewards"] = "1" }
        let response = try await AMDOSRESTClient.shared.fetchPWA(
            AMDOSPayoutEnvelope.self,
            path: "/api/admin/payouts",
            query: query
        )
        guard response.ok != false, response.ym == ym else {
            throw AMDOSNetworkError.http(response.error ?? "支払通知データを確認できなかった")
        }
        return response
    }

    private func payoutSaveBlockedByAgreement(_ gate: AMDOSPayoutAgreementGate?) -> Bool {
        guard let gate, !gate.blockers.isEmpty else { return false }
        return agreementOverrideReason.trimmingCharacters(in: .whitespacesAndNewlines).count < 8
    }

    private func payoutAgreementStatusLabel(_ status: String) -> String {
        switch status {
        case "not_required": return "対象外"
        case "pending": return "未合意"
        case "agreed": return "合意済"
        case "stale": return "条件更新あり"
        case "revision_requested": return "修正要望中"
        case "admin_override": return "admin override"
        default: return status
        }
    }

    private func payoutYMLabel(_ value: String) -> String {
        guard value.count == 6 else { return value }
        return "\(value.prefix(4))/\(value.suffix(2))"
    }

    private func payoutSnapshotStatus(_ payload: AMDOSPayoutEnvelope) -> String? {
        let expected = payload.expectedEntries ?? []
        guard !expected.isEmpty else { return "保存対象の報酬明細はない" }
        let payoutMap = Dictionary(uniqueKeysWithValues: (payload.payouts ?? []).map { ("\($0.projectID):\($0.ym):\($0.memberID)", $0.totalYen.rounded()) })
        let missingPayouts = expected.filter { payoutMap["\($0.projectID):\($0.ym):\($0.memberID)"] != $0.totalYen.rounded() }.count
        var noticeTotals: [String: Double] = [:]
        for entry in expected { noticeTotals[entry.memberID, default: 0] += entry.totalYen }
        let noticeMap = Dictionary(uniqueKeysWithValues: (payload.notices ?? []).map { ($0.id, $0) })
        // sent_at がある通知はPWAも履歴保護で上書きしない。未送付だけを
        // 保存後の合計一致確認に使う。
        let missingNotices = noticeTotals.filter { memberID, total in
            guard let notice = noticeMap[memberID] else { return true }
            if notice.sentAt?.trimmedNonEmpty != nil { return false }
            return notice.totalYen?.rounded() != total.rounded()
        }.count
        if missingPayouts == 0 && missingNotices == 0 { return "月次スナップショットは同期済み" }
        return "保存待ち: 報酬明細 \(missingPayouts)件 / 未送付通知額 \(missingNotices)件"
    }

    private func payoutSnapshotVerified(_ payload: AMDOSPayoutEnvelope) -> Bool {
        guard let status = payoutSnapshotStatus(payload) else { return false }
        return status == "月次スナップショットは同期済み" || status == "保存対象の報酬明細はない"
    }

    private func savePayoutSnapshot() {
        guard ym.range(of: #"^\d{6}$"#, options: .regularExpression) != nil else {
            message = "支払月はYYYYMMで入力してね"
            return
        }
        guard !payoutSaveBlockedByAgreement(data?.payoutAgreementGate) else {
            message = "月初合意blockerを解除するか、admin override reasonを8文字以上入れてね"
            return
        }
        snapshotSaving = true
        message = nil
        let targetYM = ym
        let overrideReason = agreementOverrideReason.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            defer { snapshotSaving = false }
            do {
                let responseData = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/payouts",
                    method: "POST",
                    body: AMDOSPayoutSnapshotSaveRequest(ym: targetYM, agreementOverrideReason: overrideReason.isEmpty ? nil : overrideReason)
                )
                let response = try JSONDecoder().decode(AMDOSPayoutEnvelope.self, from: responseData)
                guard response.ok == true, response.ym == targetYM else {
                    throw AMDOSNetworkError.http(response.error ?? "月次スナップショットを保存できなかった")
                }
                // HTTP成功だけでは完了にせず、PWA GETを取り直して報酬明細と
                // 未送付通知額の保存状態を照合する。送付済み履歴は保護対象。
                let verified = try await fetchPayoutData(ym: targetYM)
                guard payoutSnapshotVerified(verified) else {
                    data = verified
                    throw AMDOSNetworkError.http(payoutSnapshotStatus(verified) ?? "月次スナップショットを再取得して確認できなかった")
                }
                data = verified
                state = (verified.members ?? []).isEmpty ? .empty : .loaded
                message = "月次の支払通知内容を保存したよ（報酬 \(response.savedPayoutRows ?? 0)件 / 通知 \(response.savedNoticeRows ?? 0)件）"
            } catch {
                message = payoutErrorMessage(error)
            }
        }
    }

    // route.ts の payoutNoticeTargetMemberIds と同じ表示用の対象選別。
    // 実際の最終選別も PATCH API が行うため、Mac側の表示だけで対象を固定しない。
    private func payoutBulkTargetMemberIDs(_ payload: AMDOSPayoutEnvelope) -> [String] {
        let excludedMemberIDs = Set(
            (payload.members ?? [])
                .filter { $0.excluded == true || $0.isOfficer == true }
                .map(\.id)
        )
        var memberIDs = Set<String>()
        for entry in payload.expectedEntries ?? [] {
            guard !excludedMemberIDs.contains(entry.memberID), entry.totalYen > 0 else { continue }
            memberIDs.insert(entry.memberID)
        }
        for notice in payload.notices ?? [] {
            let hasSentAt = notice.sentAt?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            let hasPDF = notice.pdfUrl?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            guard !excludedMemberIDs.contains(notice.id), !hasSentAt, (notice.totalYen ?? 0) > 0 || hasPDF else { continue }
            memberIDs.insert(notice.id)
        }
        return memberIDs.sorted()
    }

    private func runBulkPDF(previewOnly: Bool, force: Bool) {
        guard ym.range(of: #"^\d{6}$"#, options: .regularExpression) != nil else {
            message = "支払月はYYYYMMで入力してね"
            return
        }
        guard let currentData = data, !payoutBulkTargetMemberIDs(currentData).isEmpty else {
            message = "対象メンバーがいない"
            return
        }
        guard !payoutSaveBlockedByAgreement(currentData.payoutAgreementGate) else {
            message = "月初合意blockerを解除するか、admin override reasonを8文字以上入れてね"
            return
        }

        let targetYM = ym
        let overrideReason = agreementOverrideReason.trimmingCharacters(in: .whitespacesAndNewlines)
        bulkPDFMode = previewOnly ? .preview : .issue
        bulkPDFResult = nil
        bulkPDFResultPreviewOnly = nil
        message = "全員分の\(previewOnly ? "確認用" : "本番")PDFを生成中…"

        Task {
            defer { bulkPDFMode = nil }
            do {
                let responseData = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/payouts",
                    method: "PATCH",
                    body: AMDOSPayoutBulkActionRequest(
                        action: previewOnly ? "bulk_preview_notice_pdf" : "bulk_issue_notice_pdf",
                        ym: targetYM,
                        memberIds: nil,
                        force: force,
                        agreementOverrideReason: overrideReason.isEmpty ? nil : overrideReason
                    )
                )
                let response = try JSONDecoder().decode(AMDOSPayoutEnvelope.self, from: responseData)
                guard response.ok == true, response.ym == targetYM, response.previewOnly == previewOnly, let result = response.bulkResult else {
                    throw AMDOSNetworkError.http(response.error ?? "一括PDF生成の結果を確認できなかった")
                }
                bulkPDFResult = result
                bulkPDFResultPreviewOnly = previewOnly

                // HTTP成功だけで完了にせず、PWA GETを取り直す。preview は正式PDFを
                // 更新しない一方、本番は同期済みスナップショットと正式PDFの最新状態を見る。
                let verified = try await fetchPayoutData(ym: targetYM)
                data = verified
                state = (verified.members ?? []).isEmpty ? .empty : .loaded
                message = payoutBulkResultMessage(result, previewOnly: previewOnly, force: force)
            } catch {
                let resultResponse = payoutBulkResponse(from: error)
                if let resultResponse {
                    if let result = resultResponse.bulkResult {
                        bulkPDFResult = result
                        bulkPDFResultPreviewOnly = resultResponse.previewOnly ?? previewOnly
                    }
                    if resultResponse.members != nil || resultResponse.expectedEntries != nil || resultResponse.notices != nil {
                        data = resultResponse
                        state = (resultResponse.members ?? []).isEmpty ? .empty : .loaded
                    }
                    // PWAは部分失敗でも bulkResult と最新の after data を返す。Macも
                    // 結果を捨てず、読み取りGETで画面を再検証する。
                    if let verified = try? await fetchPayoutData(ym: targetYM) {
                        data = verified
                        state = (verified.members ?? []).isEmpty ? .empty : .loaded
                    }
                    let summary = resultResponse.bulkResult.map { payoutBulkResultMessage($0, previewOnly: resultResponse.previewOnly ?? previewOnly, force: force) }
                    message = "\(summary ?? "一括PDF生成の結果を確認できなかった")。\(resultResponse.error ?? payoutErrorMessage(error))"
                } else {
                    message = payoutErrorMessage(error)
                }
            }
        }
    }

    private func payoutBulkResultMessage(_ result: AMDOSPayoutBulkResult, previewOnly: Bool, force: Bool) -> String {
        let prefix: String
        if previewOnly {
            prefix = "確認用PDF生成完了"
        } else if force {
            prefix = "強制再発行完了"
        } else {
            prefix = "本番PDF発行完了"
        }
        return "\(prefix): 対象 \(result.targetCount)人 / 生成 \(result.generated) / 既存利用 \(result.skipped) / 失敗 \(result.failed)"
    }

    private func payoutBulkResponse(from error: Error) -> AMDOSPayoutEnvelope? {
        let responseBody: String?
        if let networkError = error as? AMDOSNetworkError {
            switch networkError {
            case let .http(body), let .httpStatus(_, body):
                responseBody = body
            default:
                responseBody = nil
            }
        } else {
            responseBody = nil
        }
        guard let responseBody else { return nil }
        return try? JSONDecoder().decode(AMDOSPayoutEnvelope.self, from: Data(responseBody.utf8))
    }

    private func payoutTotal(for memberID: String, notice: AMDOSAdminPayoutNotice?) -> Double {
        if let expectedEntries = data?.expectedEntries {
            return expectedEntries
                .filter { $0.memberID == memberID }
                .reduce(0) { $0 + $1.totalYen }
                .rounded()
        }
        return (notice?.totalYen ?? 0).rounded()
    }

    private func formalPDFURL(for notice: AMDOSAdminPayoutNotice?) -> String? {
        guard
            let value = notice?.pdfUrl?.trimmingCharacters(in: .whitespacesAndNewlines),
            !value.isEmpty,
            notice?.noticeNo?.uppercased().hasPrefix("PREVIEW-") != true
        else { return nil }
        return value
    }

    private func issueNoticePDF(member: AMDOSPayoutMember) {
        Task {
            busyMemberID = member.id
            defer { busyMemberID = nil }
            do {
                let body = AMDOSPayoutAction(
                    action: "issue_notice_pdf",
                    ym: ym,
                    memberId: member.id,
                    totalYen: nil,
                    agreementOverrideReason: agreementOverrideReason.trimmingCharacters(in: .whitespacesAndNewlines).trimmedNonEmpty
                )
                let responseData = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/payouts",
                    method: "PATCH",
                    body: body
                )
                let response = try JSONDecoder().decode(AMDOSPayoutIssueResponse.self, from: responseData)
                guard response.ok == true else {
                    message = response.error ?? "支払通知書を発行できなかった"
                    return
                }
                guard let pdfURL = response.issuedNotice?.pdfURL, validURL(pdfURL) != nil else {
                    message = "支払通知書PDFのURLを確認できなかった"
                    return
                }

                message = "\(member.memberName ?? member.codeName ?? member.id) の支払通知書を発行したよ"
                openSavedPDF(pdfURL)
                await reload()
            } catch {
                message = payoutErrorMessage(error)
            }
        }
    }

    private func previewNoticeEmail(member: AMDOSPayoutMember, totalYen: Double) {
        Task {
            busyMemberID = member.id
            defer { busyMemberID = nil }
            do {
                let body = AMDOSPayoutAction(
                    action: "preview_notice_email",
                    ym: ym,
                    memberId: member.id,
                    totalYen: totalYen,
                    agreementOverrideReason: nil
                )
                let responseData = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/payouts",
                    method: "PATCH",
                    body: body
                )
                let response = try JSONDecoder().decode(AMDOSPayoutMailPreviewResponse.self, from: responseData)
                guard response.ok == true, let preview = response.preview else {
                    message = response.error ?? "送付内容を確認できなかった"
                    return
                }
                mailBody = preview.body
                mailEditing = false
                mailError = nil
                mailPreview = preview
                message = nil
            } catch {
                message = payoutErrorMessage(error)
            }
        }
    }

    private func clearNoticeSent(member: AMDOSPayoutMember, totalYen: Double) {
        Task {
            busyMemberID = member.id
            defer { busyMemberID = nil }
            do {
                let responseData = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/payouts",
                    method: "PATCH",
                    body: AMDOSPayoutNoticeStatusAction(
                        action: "update_notice",
                        ym: ym,
                        memberId: member.id,
                        totalYen: totalYen,
                        clearSent: true,
                        agreementOverrideReason: agreementOverrideReason.trimmingCharacters(in: .whitespacesAndNewlines).trimmedNonEmpty
                    )
                )
                let response = try JSONDecoder().decode(AMDOSPayoutEnvelope.self, from: responseData)
                guard response.ok == true else {
                    throw AMDOSNetworkError.http(response.error ?? "送付済みを取り消せなかった")
                }
                data = response
                state = (response.members ?? []).isEmpty ? .empty : .loaded
                message = "\(member.memberName ?? member.codeName ?? member.id) を未送付に戻したよ。送ったメール自体は取り消されないよ。"
            } catch {
                message = payoutErrorMessage(error)
            }
        }
    }

    private func sendNoticeEmail(_ preview: AMDOSPayoutMailPreview) {
        guard !mailSending else { return }
        mailSending = true
        mailError = nil
        busyMemberID = preview.memberID
        let bodyText = mailBody
        Task {
            defer {
                mailSending = false
                busyMemberID = nil
            }
            do {
                let responseData = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/payouts",
                    method: "PATCH",
                    body: AMDOSPayoutMailAction(
                        action: "send_notice_email",
                        ym: ym,
                        memberId: preview.memberID,
                        totalYen: preview.totalYen,
                        body: bodyText,
                        agreementOverrideReason: agreementOverrideReason.trimmingCharacters(in: .whitespacesAndNewlines).trimmedNonEmpty
                    )
                )
                let response = try JSONDecoder().decode(AMDOSPayoutEnvelope.self, from: responseData)
                guard response.ok == true else {
                    throw AMDOSNetworkError.http(response.error ?? "支払通知メールを送信できなかった")
                }
                data = response
                state = (response.members ?? []).isEmpty ? .empty : .loaded
                mailPreview = nil
                message = "\(preview.memberName) <\(preview.to)> に支払通知メールを送信したよ"
            } catch {
                let failure = payoutErrorMessage(error)
                mailError = failure
                message = failure
            }
        }
    }

    private func sendPaymentNudges() {
        guard ym.range(of: #"^\d{6}$"#, options: .regularExpression) != nil else {
            message = "支払月はYYYYMMで入力してね"
            return
        }
        paymentNudgeSending = true
        let targetYM = ym
        Task {
            defer { paymentNudgeSending = false }
            do {
                let responseData = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/cron/payment-confirm-nudges",
                    body: AMDOSPayoutPaymentNudgeRequest(ym: targetYM)
                )
                let response = try JSONDecoder().decode(AMDOSPayoutPaymentNudgeResponse.self, from: responseData)
                guard response.ok == true else {
                    throw AMDOSNetworkError.http(response.error ?? "入金確認nudgeを送信できなかった")
                }
                if let skipped = response.skipped?.trimmedNonEmpty {
                    message = "入金確認nudgeは未送信: \(skipped)"
                } else {
                    message = "入金確認nudge送信: \(response.sent ?? 0)件 / 対象PJ \(response.groupCount ?? 0) / admin \(response.targetCount ?? 0)"
                }
            } catch {
                message = payoutErrorMessage(error)
            }
        }
    }

    private func openSavedPDF(_ value: String?) {
        guard let value, let url = validURL(value) else {
            message = "保存済みの正式PDFが見つからないよ。先に支払通知書を発行してね。"
            return
        }
        NSWorkspace.shared.open(url)
    }

    private func validURL(_ value: String) -> URL? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            !trimmed.isEmpty,
            let url = URL(string: trimmed),
            let scheme = url.scheme?.lowercased(),
            scheme == "https" || scheme == "http"
        else { return nil }
        return url
    }

    private enum AMDOSPayoutProfileFreshness: Equatable { case current, stale, unknown }

    private func profileFreshness(member: AMDOSPayoutMember, notice: AMDOSAdminPayoutNotice?) -> AMDOSPayoutProfileFreshness {
        guard let notice else { return .unknown }
        // PWAのshouldRegenerateNoticeと同様、送付済みの正式通知書は
        // 台帳更新だけで「再発行必須」へは切り替えない。送付取消の後に
        // 明示的な再発行フローへ進む。
        if notice.sentAt?.trimmedNonEmpty != nil { return .current }
        guard let memberUpdatedAt = payoutTimestamp(member.updatedAt), let generatedAt = payoutTimestamp(notice.lastGeneratedAt) else { return .unknown }
        return memberUpdatedAt > generatedAt ? .stale : .current
    }

    private func payoutTimestamp(_ rawValue: String?) -> Date? {
        guard let rawValue = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines), !rawValue.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: rawValue) { return date }
        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        return standard.date(from: rawValue)
    }

    private func payoutErrorMessage(_ error: Error) -> String {
        let responseBody: String?
        if let networkError = error as? AMDOSNetworkError {
            switch networkError {
            case let .http(body):
                responseBody = body
            case let .httpStatus(_, body):
                responseBody = body
            default:
                responseBody = nil
            }
        } else {
            responseBody = nil
        }
        if let responseBody,
           let payload = try? JSONDecoder().decode(AMDOSPayoutErrorResponse.self, from: Data(responseBody.utf8)),
           let message = payload.error?.trimmingCharacters(in: .whitespacesAndNewlines),
           !message.isEmpty {
            return message
        }
        return error.localizedDescription
    }
}

private struct AMDOSPayoutMailPreviewSheet: View {
    let preview: AMDOSPayoutMailPreview
    @Binding var draftBody: String
    @Binding var isEditing: Bool
    let isSending: Bool
    let error: String?
    let openPDF: (String?) -> Void
    let onSend: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("支払通知の送付内容")
                        .font(.title3.weight(.semibold))
                    Text("この画面ではまだ送信されないよ。保存済み正式PDFと本文を確認してから、明示的に送信する。")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                }
                Spacer()
                Button("閉じる") { dismiss() }.disabled(isSending)
            }

            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                GridRow { Text("宛先").foregroundStyle(AMDOSDesign.muted); Text("\(preview.memberName) <\(preview.to)>").textSelection(.enabled) }
                GridRow { Text("差出人").foregroundStyle(AMDOSDesign.muted); Text(preview.from).textSelection(.enabled) }
                GridRow { Text("Bcc").foregroundStyle(AMDOSDesign.muted); Text(preview.bcc.isEmpty ? "—" : preview.bcc.joined(separator: ", ")).textSelection(.enabled) }
                GridRow { Text("件名").foregroundStyle(AMDOSDesign.muted); Text(preview.subject).textSelection(.enabled) }
                GridRow { Text("支払予定日").foregroundStyle(AMDOSDesign.muted); Text(preview.dueDateText) }
                GridRow { Text("通知額").foregroundStyle(AMDOSDesign.muted); Text("\(Int(preview.totalYen))円（税抜）") }
                GridRow { Text("添付PDF").foregroundStyle(AMDOSDesign.muted); VStack(alignment: .leading, spacing: 4) { Button("保存済み正式PDFを開く") { openPDF(preview.pdfURL) }; Text(preview.pdfURL).font(.caption).textSelection(.enabled); Text("Drive fileId: \(preview.pdfDriveFileID)").font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted) } }
                GridRow { Text("PDF状態").foregroundStyle(AMDOSDesign.muted); Text(preview.pdfPreparedBeforeSend == true ? "正式PDF確認済み" : "PDF状態を確認できなかった") }
            }

            if let sentAt = preview.alreadySentAt, !sentAt.isEmpty {
                Text("このメンバーは \(sentAt) に送付済みとして記録されているよ。")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.warning)
            }

            if let error, !error.isEmpty {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .textSelection(.enabled)
                    .padding(10)
                    .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("本文").font(.headline)
                    Spacer()
                    if draftBody != preview.body {
                        Button("テンプレに戻す") { draftBody = preview.body }
                            .buttonStyle(.borderless)
                            .disabled(isSending)
                    }
                    Button(isEditing ? "編集を確定" : "本文修正") { isEditing.toggle() }
                        .buttonStyle(.borderless)
                        .disabled(isSending)
                }
                if isEditing {
                    TextEditor(text: $draftBody)
                        .font(.body.monospaced())
                        .frame(minHeight: 220, maxHeight: 360)
                        .padding(8)
                        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AMDOSDesign.border))
                        .disabled(isSending)
                } else {
                    ScrollView {
                        Text(draftBody)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                            .padding(12)
                    }
                    .frame(minHeight: 220, maxHeight: 360)
                    .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(AMDOSDesign.border))
                }
            }

            HStack {
                Text("「はい・送信」を押すと、保存済み正式PDFを添付して \(preview.to) へ実メールを送信し、成功時に送付済みにする。")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button("キャンセル") { dismiss() }
                    .disabled(isSending)
                Button(isSending ? "送信中…" : "はい・送信") { onSend() }
                    .buttonStyle(.borderedProminent)
                    .disabled(isSending || isEditing || preview.alreadySentAt?.trimmedNonEmpty != nil)
            }
        }
        .padding(24)
        .frame(minWidth: 640, idealWidth: 760, minHeight: 520)
    }
}

private indirect enum AMDOSContractJSONValue: Codable, Sendable, Equatable {
    case object([String: AMDOSContractJSONValue])
    case array([AMDOSContractJSONValue])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([String: AMDOSContractJSONValue].self) { self = .object(value) }
        else if let value = try? container.decode([AMDOSContractJSONValue].self) { self = .array(value) }
        else { throw DecodingError.dataCorruptedError(in: container, debugDescription: "unsupported contract JSON") }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    var text: String? {
        switch self {
        case .string(let value): return value.trimmedNonEmpty
        case .number(let value): return String(value)
        default: return nil
        }
    }

    var bool: Bool? {
        switch self {
        case .bool(let value): return value
        case .string(let value):
            let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if ["true", "yes", "あり", "可", "ok"].contains(normalized) { return true }
            if ["false", "no", "なし", "不可", "ng"].contains(normalized) { return false }
            return nil
        default: return nil
        }
    }

    var number: Double? {
        switch self {
        case .number(let value): return value
        case .string(let value): return Double(value)
        default: return nil
        }
    }

    var object: [String: AMDOSContractJSONValue]? {
        guard case .object(let value) = self else { return nil }
        return value
    }

    var array: [AMDOSContractJSONValue]? {
        guard case .array(let value) = self else { return nil }
        return value
    }
}

private struct AMDOSContractAdminRecord: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String?
    let title: String?
    let canonicalTitle: String?
    let canonicalContractID: String?
    let counterparty: String?
    let status: String?
    let registryStatus: String?
    let contractType: String?
    let relationshipScope: String?
    let isCurrentForProject: Bool?
    let amdEntityName: String?
    let amdPartyRole: String?
    let partyConfirmationNote: String?
    let partyConfirmedAt: String?
    let partyConfirmedBy: String?
    let operationalTerms: [String: AMDOSContractJSONValue]?
    let expectedSigningDate: String?
    let effectiveDate: String?
    let expirationDate: String?
    let renewalNoticeDate: String?
    let renewalType: String?
    let contractValueYen: Double?
    let signedAt: String?
    let signedDocumentID: String?
    let lastActivityAt: String?
    let plannedAt: String?
    let reviewRequired: Bool?
    let reviewStatus: String?
    let signalConfidence: Double?
    let sourceSummary: String?
    let ledgerNotes: String?
    let businessOwner: String?
    let nudgeAfterDays: Int?
    let driveFolderID: String?
    let confidentialityCoverage: String?
    let confidentialitySurvivalNote: String?
    let confidentialityNote: String?

    enum CodingKeys: String, CodingKey {
        case id = "contract_id"
        case projectId = "project_id"
        case title = "contract_title"
        case canonicalTitle = "canonical_title"
        case canonicalContractID = "canonical_contract_id"
        case counterparty = "counterparty_name"
        case status
        case registryStatus = "registry_status"
        case contractType = "contract_type"
        case relationshipScope = "relationship_scope"
        case isCurrentForProject = "is_current_for_project"
        case amdEntityName = "amd_entity_name"
        case amdPartyRole = "amd_party_role"
        case partyConfirmationNote = "party_confirmation_note"
        case partyConfirmedAt = "party_confirmed_at"
        case partyConfirmedBy = "party_confirmed_by"
        case operationalTerms = "operational_terms_json"
        case expectedSigningDate = "expected_signing_date"
        case effectiveDate = "effective_date"
        case expirationDate = "expiration_date"
        case renewalNoticeDate = "renewal_notice_date"
        case renewalType = "renewal_type"
        case contractValueYen = "contract_value_yen"
        case signedAt = "signed_at"
        case signedDocumentID = "signed_document_id"
        case lastActivityAt = "last_activity_at"
        case plannedAt = "planned_at"
        case reviewRequired = "review_required"
        case reviewStatus = "review_status"
        case signalConfidence = "signal_confidence"
        case sourceSummary = "source_summary"
        case ledgerNotes = "ledger_notes"
        case businessOwner = "business_owner"
        case nudgeAfterDays = "nudge_after_days"
        case driveFolderID = "drive_folder_id"
        case confidentialityCoverage = "confidentiality_coverage"
        case confidentialitySurvivalNote = "confidentiality_survival_note"
        case confidentialityNote = "confidentiality_note"
    }
}

private struct AMDOSContractLedgerRow: Identifiable, Sendable {
    let id: String
    let canonicalContractID: String
    let title: String
    let projectId: String?
    let counterparty: String?
    let status: String
    let registryStatus: String
    let contractType: String?
    let relationshipScope: String
    let isCurrentForProject: Bool
    let amdEntityName: String
    let amdPartyRole: String?
    let partyConfirmationNote: String?
    let operationalTerms: [String: AMDOSContractJSONValue]
    let expectedSigningDate: String?
    let effectiveDate: String?
    let expirationDate: String?
    let renewalNoticeDate: String?
    let renewalType: String?
    let contractValueYen: Double?
    let signedAt: String?
    let reviewRequired: Bool
    let reviewStatus: String?
    let sourceSummary: String?
    let ledgerNotes: String?
    let businessOwner: String?
    let nudgeAfterDays: Int
    let driveFolderID: String?
    let confidentialityCoverage: String
    let confidentialitySurvivalNote: String?
    let confidentialityNote: String?
    let confidentialityConflict: Bool
    let latestActivityAt: String?
    let currentRecordID: String
    let currentSignedDocumentID: String?
    let relatedContractIDs: [String]
    let relatedRecordCount: Int
    let relatedStatuses: [String]
    let relatedTitles: [String]
}

/// PWA `contracts-ledger.ts` と同じ識別・現行版選択をする。DB上のraw行は
/// 証跡単位なので、Macの一覧にはこの集約行だけを渡す。
private enum AMDOSContractLedger {
    private static let trailingActivityPatterns = [
        #"\s*(?:DocuSign|Docusign|クラウドサイン|CloudSign).*$"#,
        #"\s*(?:送付先確認|送付依頼|送付確認|確認依頼|押印依頼|署名依頼|締結依頼|法務確認|リーガルチェック|修正案|微修正|赤入れ|レビュー依頼|ドラフト確認|最終版確認).*$"#,
        #"\s*確認[・\s].*$"#,
        #"\s*確認$"#,
    ]
    private static let genericIdentityKeys: Set<String> = ["nda", "mou", "契約", "契約書", "覚書", "業務委託", "業務委託契約", "秘密保持", "秘密保持契約"]
    private static let statusPriority: [String: Int] = [
        "signed": 700,
        "stalled": 650,
        "awaiting_signature": 600,
        "under_review": 500,
        "drafting": 400,
        "planned": 300,
        "cancelled": 100,
    ]

    static func consolidate(_ contracts: [AMDOSContractAdminRecord]) -> [AMDOSContractLedgerRow] {
        var grouped: [String: [AMDOSContractAdminRecord]] = [:]
        for contract in contracts {
            grouped[identityKey(contract), default: []].append(contract)
        }
        return grouped.values
            .compactMap(makeLedgerRow)
            .sorted { activitySort($0.latestActivityAt, $1.latestActivityAt) }
    }

    static func identityKey(_ contract: AMDOSContractAdminRecord) -> String {
        if let canonicalID = nonEmpty(contract.canonicalContractID) {
            return "canonical:\(canonicalID)"
        }
        let title = identityTitle(contract)
        guard canUseIdentityKey(title) else { return "contract:\(contract.id)" }
        let project = nonEmpty(contract.projectId) ?? "project:unset"
        let kind = normalizedKey(contract.contractType) ?? "type:unset"
        let counterparty = normalizedKey(contract.counterparty) ?? "counterparty:unset"
        return ["contract", project, kind, counterparty, normalizedKey(title) ?? "title:unset"].joined(separator: "|")
    }

    static func identityTitle(_ contract: AMDOSContractAdminRecord) -> String {
        let raw = displayTitle(contract)
        guard nonEmpty(contract.canonicalTitle) == nil else { return raw }
        return trailingActivityPatterns.reduce(raw) { title, pattern in
            let next = cleanTitle(title.replacingOccurrences(of: pattern, with: "", options: .regularExpression))
            return next.count >= 4 ? next : title
        }
    }

    private static func makeLedgerRow(_ rows: [AMDOSContractAdminRecord]) -> AMDOSContractLedgerRow? {
        guard !rows.isEmpty else { return nil }
        let ordered = rows.sorted { activitySort($0.lastActivityAt ?? $0.plannedAt, $1.lastActivityAt ?? $1.plannedAt) }
        guard let current = currentRecord(ordered) ?? ordered.first else { return nil }
        let canonicalID = ordered.compactMap { nonEmpty($0.canonicalContractID) }.first
        let primary = ordered.first(where: { $0.id == canonicalID })
            ?? ordered.first(where: { $0.status != "cancelled" })
            ?? ordered[0]
        let explicitRegistryStatuses = Set(ordered.compactMap { nonEmpty($0.registryStatus) })
        let registryStatus: String
        if explicitRegistryStatuses.contains("accepted") { registryStatus = "accepted" }
        else if explicitRegistryStatuses.contains("candidate") { registryStatus = "candidate" }
        else if explicitRegistryStatuses.contains("evidence_only") { registryStatus = "evidence_only" }
        else { registryStatus = "rejected" }
        let relatedTitles = unique(ordered.map(displayTitle))
        return AMDOSContractLedgerRow(
            id: canonicalID ?? primary.id,
            canonicalContractID: canonicalID ?? primary.id,
            title: identityTitle(primary),
            projectId: primary.projectId,
            counterparty: firstNonEmpty(ordered.map(\.counterparty)),
            status: current.status ?? "planned",
            registryStatus: registryStatus,
            contractType: primary.contractType,
            relationshipScope: ordered.contains(where: { $0.relationshipScope == "amd_contract" }) ? "amd_contract" : (primary.relationshipScope ?? "needs_review"),
            isCurrentForProject: ordered.contains(where: { $0.isCurrentForProject == true }),
            amdEntityName: firstNonEmpty(ordered.map(\.amdEntityName)) ?? "株式会社チームアルマダ",
            amdPartyRole: firstNonEmpty(ordered.map(\.amdPartyRole)),
            partyConfirmationNote: firstNonEmpty(ordered.map(\.partyConfirmationNote)),
            operationalTerms: ordered.compactMap(\.operationalTerms).first(where: { !$0.isEmpty }) ?? [:],
            expectedSigningDate: latestDate(ordered.map(\.expectedSigningDate)),
            effectiveDate: earliestDate(ordered.map(\.effectiveDate)),
            expirationDate: latestDate(ordered.map(\.expirationDate)),
            renewalNoticeDate: earliestDate(ordered.map(\.renewalNoticeDate)),
            renewalType: primary.renewalType,
            contractValueYen: primary.contractValueYen,
            signedAt: latestDate(ordered.map(\.signedAt)),
            reviewRequired: ordered.contains(where: { $0.reviewRequired == true || $0.registryStatus == "candidate" }),
            reviewStatus: firstNonEmpty(ordered.map(\.reviewStatus)),
            sourceSummary: firstNonEmpty(ordered.map(\.sourceSummary)),
            ledgerNotes: firstNonEmpty(ordered.map(\.ledgerNotes)),
            businessOwner: firstNonEmpty(ordered.map(\.businessOwner)),
            nudgeAfterDays: primary.nudgeAfterDays ?? 14,
            driveFolderID: primary.driveFolderID,
            confidentialityCoverage: confidentialityCoverage(ordered),
            confidentialitySurvivalNote: firstNonEmpty(ordered.map(\.confidentialitySurvivalNote)),
            confidentialityNote: firstNonEmpty(ordered.map(\.confidentialityNote)),
            confidentialityConflict: confidentialityValues(ordered).count > 1,
            latestActivityAt: latestDate(ordered.map { $0.lastActivityAt ?? $0.plannedAt }),
            currentRecordID: current.id,
            currentSignedDocumentID: current.signedDocumentID,
            relatedContractIDs: ordered.map(\.id),
            relatedRecordCount: ordered.count,
            relatedStatuses: unique(ordered.map { $0.status ?? "planned" }),
            relatedTitles: relatedTitles
        )
    }

    private static func currentRecord(_ rows: [AMDOSContractAdminRecord]) -> AMDOSContractAdminRecord? {
        let active = rows.filter { $0.status != "cancelled" }
        let candidates = active.isEmpty ? rows : active
        let ordered = candidates.sorted { activitySort($0.lastActivityAt ?? $0.plannedAt, $1.lastActivityAt ?? $1.plannedAt) }
        if let first = ordered.first, nonEmpty(first.lastActivityAt ?? first.plannedAt) != nil {
            return first
        }
        return candidates.sorted {
            let left = statusPriority[$0.status ?? "planned"] ?? 0
            let right = statusPriority[$1.status ?? "planned"] ?? 0
            if left != right { return left > right }
            return activitySort($0.lastActivityAt ?? $0.plannedAt, $1.lastActivityAt ?? $1.plannedAt)
        }.first
    }

    private static func displayTitle(_ contract: AMDOSContractAdminRecord) -> String {
        cleanTitle(nonEmpty(contract.canonicalTitle) ?? nonEmpty(contract.title) ?? "契約名未設定")
    }

    private static func cleanTitle(_ value: String) -> String {
        value
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"[＿_]+"#, with: "_", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"[\s・:：/／｜|-]+$"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func normalizedKey(_ value: String?) -> String? {
        guard let value = nonEmpty(value) else { return nil }
        let normalized = cleanTitle(value)
            .lowercased()
            .replacingOccurrences(of: #"[【】「」『』()[\]（）]"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"[\s・:：/／｜|_-]+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }

    private static func canUseIdentityKey(_ title: String) -> Bool {
        guard let key = normalizedKey(title) else { return false }
        return key.count >= 6 && !genericIdentityKeys.contains(key)
    }

    private static func activitySort(_ left: String?, _ right: String?) -> Bool {
        (left ?? "") > (right ?? "")
    }

    private static func latestDate(_ values: [String?]) -> String? {
        values.compactMap { nonEmpty($0) }.max()
    }

    private static func earliestDate(_ values: [String?]) -> String? {
        values.compactMap { nonEmpty($0) }.min()
    }

    private static func confidentialityValues(_ rows: [AMDOSContractAdminRecord]) -> Set<String> {
        Set(rows.compactMap { nonEmpty($0.confidentialityCoverage) }.filter { $0 != "unknown" })
    }

    private static func confidentialityCoverage(_ rows: [AMDOSContractAdminRecord]) -> String {
        confidentialityValues(rows).first ?? "unknown"
    }

    private static func firstNonEmpty(_ values: [String?]) -> String? {
        values.compactMap { nonEmpty($0) }.first
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }

    private static func unique(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.filter { seen.insert($0).inserted }
    }
}
private struct AMDOSContractAdminDocument: Codable, Identifiable, Sendable {
    let id: String
    let contractId: String?
    let projectId: String?
    let documentKind: String?
    let versionLabel: String?
    let driveFileId: String?
    let driveFolderId: String?
    let webViewLink: String?
    let fileName: String?
    let mimeType: String?
    let fileSizeBytes: Int64?
    let receivedAt: String?
    let isLatest: Bool?
    enum CodingKeys: String, CodingKey {
        case id = "document_id", contractId = "contract_id", projectId = "project_id"
        case documentKind = "document_kind", versionLabel = "version_label"
        case driveFileId = "drive_file_id", driveFolderId = "drive_folder_id", webViewLink = "web_view_link"
        case fileName = "file_name", mimeType = "mime_type", fileSizeBytes = "file_size_bytes"
        case receivedAt = "received_at", isLatest = "is_latest"
    }
}
private struct AMDOSContractAdminSignal: Codable, Identifiable, Sendable {
    let id: String
    let contractId: String?
    let projectId: String?
    let sourceKind: String?
    let sourceTable: String?
    let sourceId: String?
    let sourceURL: String?
    let title: String?
    let snippet: String?
    let confidence: Double?
    let status: String?
    enum CodingKeys: String, CodingKey {
        case id = "signal_id", contractId = "contract_id", projectId = "project_id"
        case sourceKind = "source_kind", sourceTable = "source_table", sourceId = "source_id", sourceURL = "source_url"
        case title, snippet, confidence, status
    }
}
private struct AMDOSContractAdminTerm: Codable, Identifiable, Sendable {
    let id: String
    let contractId: String?
    let projectId: String?
    let sourceKind: String?
    let sourceURL: String?
    let sourceTitle: String?
    let contractNo: String?
    let quoteNo: String?
    let contractTitle: String?
    let counterpartyName: String?
    let periodStart: String?
    let periodEnd: String?
    let periodStartYM: String?
    let periodEndYM: String?
    let amountTaxExcl: Double?
    let amountTaxIncl: Double?
    let billingDistribution: String?
    let feeTypeHint: String?
    let extractedTerms: [String: AMDOSContractJSONValue]?
    let confidence: Double?
    let reviewStatus: String?
    let status: String?
    let createdAt: String?
    enum CodingKeys: String, CodingKey {
        case id = "term_id", contractId = "contract_id", projectId = "project_id"
        case sourceKind = "source_kind", sourceURL = "source_url", sourceTitle = "source_title"
        case contractNo = "contract_no", quoteNo = "quote_no", contractTitle = "contract_title", counterpartyName = "counterparty_name"
        case periodStart = "period_start", periodEnd = "period_end", periodStartYM = "period_start_ym", periodEndYM = "period_end_ym"
        case amountTaxExcl = "amount_tax_excl", amountTaxIncl = "amount_tax_incl"
        case billingDistribution = "billing_distribution", feeTypeHint = "fee_type_hint", extractedTerms = "extracted_terms_json"
        case confidence, reviewStatus = "review_status", status, createdAt = "created_at"
    }
}
private struct AMDOSContractAdminNudge: Codable, Identifiable, Sendable {
    let id: String
    let contractId: String?
    let projectId: String?
    let status: String?
    let staleDays: Int?
    let dryRunMessage: String?
    let candidateAt: String?
    enum CodingKeys: String, CodingKey {
        case id = "nudge_id", contractId = "contract_id", projectId = "project_id", status
        case staleDays = "stale_days", dryRunMessage = "dry_run_message", candidateAt = "candidate_at"
    }
}
private struct AMDOSContractAdminProject: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let projectName: String
    let status: String?
    let slackChannelID: String?
    let startYM: String?
    let endYM: String?
    let contractTerms: [String: AMDOSContractJSONValue]?
    enum CodingKeys: String, CodingKey {
        case id, status
        case projectId = "project_id", projectName = "project_name", slackChannelID = "slack_channel_id"
        case startYM = "start_ym", endYM = "end_ym", contractTerms = "contract_terms_json"
    }
}
private struct AMDOSContractDriveDestination: Codable, Sendable {
    let path: String?
    let folderIdConfigured: Bool?
    let folderIdEnv: String?
}
private struct AMDOSContractAdminEnvelope: Codable, Sendable {
    let ok: Bool?
    let contracts: [AMDOSContractAdminRecord]?
    let documents: [AMDOSContractAdminDocument]?
    let signals: [AMDOSContractAdminSignal]?
    let terms: [AMDOSContractAdminTerm]?
    let nudges: [AMDOSContractAdminNudge]?
    let projects: [AMDOSContractAdminProject]?
    let driveDestination: AMDOSContractDriveDestination?
    let termsSetupRequired: Bool?
    let error: String?
    enum CodingKeys: String, CodingKey { case ok, contracts, documents, signals, terms, nudges, projects, driveDestination, termsSetupRequired = "termsSetupRequired", error }
}
private struct AMDOSContractAdminCreate: Encodable, Sendable {
    let projectId: String
    let contractTitle: String
    let counterpartyName: String
    let contractType: String
    let expectedSigningDate: String?
    let nudgeAfterDays: Int
    let reviewRequired: Bool
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id", contractTitle = "contract_title", counterpartyName = "counterparty_name"
        case contractType = "contract_type", expectedSigningDate = "expected_signing_date", nudgeAfterDays = "nudge_after_days"
        case reviewRequired = "review_required"
    }
}
private struct AMDOSContractStatusPatch: Encodable, Sendable { let status: String }
private struct AMDOSContractStatusPatchEnvelope: Decodable, Sendable {
    let ok: Bool?
    let error: String?
    let contract: AMDOSContractAdminRecord?
}
private struct AMDOSContractStatusChange: Identifiable {
    let row: AMDOSContractLedgerRow
    let status: String
    var id: String { "\(row.canonicalContractID)::\(status)" }
}

private struct AMDOSContractCreateDraft {
    var projectId = ""
    var title = ""
    var counterparty = ""
    var contractType = "contract"
    var expectedSigningDate = ""
    var nudgeAfterDays = "14"
}

private struct AMDOSContractEditDraft {
    var canonicalTitle = ""
    var counterpartyName = ""
    var contractType = "contract"
    var effectiveDate = ""
    var expirationDate = ""
    var renewalNoticeDate = ""
    var renewalType = ""
    var businessOwner = ""
    var ledgerNotes = ""
    var relationshipScope = "needs_review"
    var currentForProject = false
    var amdEntityName = "株式会社チームアルマダ"
    var amdPartyRole = ""
    var partyConfirmationNote = ""
    var contractValueYen = ""
    var paymentTerms = ""
    var taxTreatment = ""
    var scopeSummary = ""
    var deliverablesRequired = "unknown"
    var deliverablesNote = ""
    var acceptanceTerms = ""
    var monthlyReportSubmissionRule = ""
    var monthlyReportSubmissionNote = ""
    var confidentialityCoverage = "unknown"
    var confidentialitySurvivalNote = ""
    var confidentialityNote = ""
    var expenseReimbursementAllowed = "unknown"
    var expenseReimbursementNote = ""
    var ipOwnership = ""
    var usageRights = ""
    var publicityRights = ""
    var subcontractingTerms = ""
    var exclusivityTerms = ""
    var terminationTerms = ""
    var liabilityTerms = ""
    var governingLawJurisdiction = ""
    var specialTerms = ""
}

private struct AMDOSContractDocumentDraft {
    var webViewLink = ""
    var driveFileId = ""
    var fileName = ""
    var versionLabel = ""
    var documentKind = "revision"
}

private struct AMDOSContractCanonicalPatch: Encodable, Sendable {
    let contractIds: [String]
    let canonicalContractId: String
    enum CodingKeys: String, CodingKey { case contractIds = "contract_ids", canonicalContractId = "canonical_contract_id" }
}

private struct AMDOSContractDetailsPatch: Encodable, Sendable {
    let canonicalContractId: String
    let canonicalTitle: String
    let counterpartyName: String
    let contractType: String
    let effectiveDate: String?
    let expirationDate: String?
    let renewalNoticeDate: String?
    let renewalType: String?
    let businessOwner: String?
    let ledgerNotes: String?
    let relationshipScope: String
    let isCurrentForProject: Bool
    let amdEntityName: String
    let amdPartyRole: String?
    let partyConfirmationNote: String?
    let contractValueYen: String?
    let operationalTerms: [String: AMDOSContractJSONValue]
    let confidentialityCoverage: String
    let confidentialitySurvivalNote: String?
    let confidentialityNote: String?
    enum CodingKeys: String, CodingKey {
        case canonicalContractId = "canonical_contract_id", canonicalTitle = "canonical_title"
        case counterpartyName = "counterparty_name", contractType = "contract_type"
        case effectiveDate = "effective_date", expirationDate = "expiration_date", renewalNoticeDate = "renewal_notice_date", renewalType = "renewal_type"
        case businessOwner = "business_owner", ledgerNotes = "ledger_notes", relationshipScope = "relationship_scope"
        case isCurrentForProject = "is_current_for_project", amdEntityName = "amd_entity_name", amdPartyRole = "amd_party_role"
        case partyConfirmationNote = "party_confirmation_note", contractValueYen = "contract_value_yen"
        case operationalTerms = "operational_terms_json", confidentialityCoverage = "confidentiality_coverage"
        case confidentialitySurvivalNote = "confidentiality_survival_note", confidentialityNote = "confidentiality_note"
    }
}

private struct AMDOSContractDocumentCreate: Encodable, Sendable {
    let contractId: String
    let webViewLink: String
    let driveFileId: String
    let fileName: String
    let versionLabel: String
    let documentKind: String
    let isLatest: Bool
    enum CodingKeys: String, CodingKey {
        case contractId = "contract_id", webViewLink = "web_view_link", driveFileId = "drive_file_id", fileName = "file_name"
        case versionLabel = "version_label", documentKind = "document_kind", isLatest = "is_latest"
    }
}

private struct AMDOSContractProjectPatch: Encodable, Sendable {
    let projectsPatch: [String: AMDOSContractJSONValue]
}

private struct AMDOSContractSignalCounts: Codable, Sendable { let total: Int?; let highConfidence: Int?; let reviewRequired: Int? }
private struct AMDOSContractTermCounts: Codable, Sendable { let total: Int?; let withAmount: Int?; let withPeriod: Int?; let reviewRequired: Int? }
private struct AMDOSContractSignalCandidate: Codable, Identifiable, Sendable {
    let candidateId: String
    let projectId: String?
    let sourceKind: String?
    let title: String?
    let snippet: String?
    let confidence: Double?
    let reviewRequired: Bool?
    var id: String { candidateId }
}
private struct AMDOSContractTermCandidate: Codable, Identifiable, Sendable {
    let candidateId: String
    let sourceKind: String?
    let sourceTitle: String?
    let contractNo: String?
    let counterpartyName: String?
    let periodStart: String?
    let periodEnd: String?
    let amountTaxExcl: Double?
    let amountTaxIncl: Double?
    let confidence: Double?
    var id: String { candidateId }
}
private struct AMDOSContractExtractionResponse: Codable, Sendable {
    let ok: Bool?
    let dryRun: Bool?
    let error: String?
    let candidateCounts: AMDOSContractSignalCounts?
    let termCandidateCounts: AMDOSContractTermCounts?
    let candidates: [AMDOSContractSignalCandidate]?
    let termCandidates: [AMDOSContractTermCandidate]?
    let safety: String?
}

private struct AMDOSContractNudgeCandidate: Codable, Identifiable, Sendable {
    let contractId: String
    let projectId: String?
    let contractTitle: String?
    let staleDays: Int?
    let dryRunMessage: String?
    let blocker: String?
    var id: String { contractId }
}
private struct AMDOSContractNudgeCounts: Codable, Sendable { let total: Int?; let sendable: Int?; let blocked: Int? }
private struct AMDOSContractNudgeDryRunResponse: Codable, Sendable {
    let ok: Bool?
    let error: String?
    let candidates: [AMDOSContractNudgeCandidate]?
    let candidateCounts: AMDOSContractNudgeCounts?
    let safety: String?
}

struct AMDOSAdminContractsView: View {
    @State private var envelope: AMDOSContractAdminEnvelope?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var query = ""
    @State private var statusFilter = "ledger"
    @State private var projectActivityFilter = "active"
    @State private var sortMode = "signing_desc"
    @State private var projectFilter = ""
    @State private var showCreate = false
    @State private var createDraft = AMDOSContractCreateDraft()
    @State private var selectedLedgerRow: AMDOSContractLedgerRow?
    @State private var selectedStatus = "planned"
    @State private var detailTab = "terms"
    @State private var editDraft = AMDOSContractEditDraft()
    @State private var documentDraft = AMDOSContractDocumentDraft()
    @State private var saving = false
    @State private var statusSaving = false
    @State private var statusMessage: String?
    @State private var pendingStatusChange: AMDOSContractStatusChange?
    @State private var signalDryRun: AMDOSContractExtractionResponse?
    @State private var nudgeDryRun: AMDOSContractNudgeDryRunResponse?
    @State private var runningSignals = false
    @State private var runningNudges = false
    @State private var extractionMessage: String?

    private static let contractStatuses = ["planned", "drafting", "under_review", "awaiting_signature", "signed", "stalled", "cancelled"]
    private static let contractTypes = ["contract", "nda", "outsourcing", "joint_research", "mou", "order", "investment", "employment", "mandate"]
    private static let statusFilters = ["ledger", "current", "needs_attention", "expiring", "needs_metadata", "scope_review", "excluded", "all"] + contractStatuses
    private static let sortModes = ["signing_desc", "signing_asc", "expiration_asc", "renewal_asc", "activity_desc", "project_asc", "title_asc"]

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ADMIN CONTRACTS", title: "契約台帳", subtitle: "1契約1行で、実務条件・版履歴・抽出根拠をPWAと同じ管理境界で扱う") {
            AMDOSStateNotice(state: state) { load() }
            if let envelope {
                metricsSection
                filterSection(envelope)
                contractsSection
                operationsSection
            }
            AMDOSAdminInlineMessage(text: message)
        }
        .sheet(isPresented: $showCreate) { createSheet }
        .sheet(item: $selectedLedgerRow) { row in detailSheet(row) }
        .task { await reload() }
    }

    private var ledgerRows: [AMDOSContractLedgerRow] {
        AMDOSContractLedger.consolidate(envelope?.contracts ?? [])
    }

    private var projectByID: [String: AMDOSContractAdminProject] {
        Dictionary(uniqueKeysWithValues: (envelope?.projects ?? []).map { ($0.projectId, $0) })
    }

    private var filteredRows: [AMDOSContractLedgerRow] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return ledgerRows.filter { row in
            let project = row.projectId.flatMap { projectByID[$0] }
            if projectFilter.trimmedNonEmpty != nil && row.projectId != projectFilter { return false }
            if projectActivityFilter == "active" && !isActiveProject(project) { return false }
            if projectActivityFilter == "inactive" && isActiveProject(project) { return false }
            let docs = documents(for: row)
            switch statusFilter {
            case "scope_review": if row.relationshipScope != "needs_review" { return false }
            case "excluded": if !["third_party", "template"].contains(row.relationshipScope) { return false }
            default: if row.relationshipScope != "amd_contract" { return false }
            }
            switch statusFilter {
            case "ledger": if ["evidence_only", "rejected"].contains(row.registryStatus) || row.status == "cancelled" { return false }
            case "current": if !row.isCurrentForProject || ["evidence_only", "rejected"].contains(row.registryStatus) || row.status == "cancelled" { return false }
            case "needs_attention":
                if ["evidence_only", "rejected"].contains(row.registryStatus) || !needsAttention(row, project: project, documents: docs) || row.status == "cancelled" { return false }
            case "needs_metadata":
                if ["evidence_only", "rejected"].contains(row.registryStatus) || row.status == "cancelled" { return false }
                let terms = effectiveTerms(row, project: project)
                if row.counterparty != nil && row.effectiveDate != nil && row.expirationDate != nil && termsCoverage(terms) >= 4 { return false }
            case "expiring":
                let days = [daysUntil(row.expirationDate), daysUntil(row.renewalNoticeDate)].compactMap { $0 }
                if ["evidence_only", "rejected"].contains(row.registryStatus) || days.allSatisfy({ $0 > 90 }) || days.isEmpty || row.status == "cancelled" { return false }
            case "scope_review", "excluded", "all": break
            default: if Self.contractStatuses.contains(statusFilter), row.status != statusFilter { return false }
            }
            guard !needle.isEmpty else { return true }
            return [
                row.title, row.projectId, project?.projectName, row.counterparty, row.contractType, row.businessOwner,
                row.confidentialityNote, row.amdEntityName, jsonSearchText(.object(row.operationalTerms)),
                project?.contractTerms?["expenseReimbursementNote"]?.text,
                docs.compactMap(\.fileName).joined(separator: " "), row.relatedTitles.joined(separator: " ")
            ].compactMap { $0 }.joined(separator: " ").lowercased().contains(needle)
        }.sorted(by: sortRows)
    }

    private var metricsSection: some View {
        let rows = ledgerRows.filter { $0.relationshipScope == "amd_contract" && !["evidence_only", "rejected"].contains($0.registryStatus) && $0.status != "cancelled" }
        return LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
            metric("AMD当事者契約", rows.count, filter: "ledger")
            metric("PJ現行契約", rows.filter(\.isCurrentForProject).count, filter: "current")
            metric("要対応", rows.filter { needsAttention($0, project: $0.projectId.flatMap { projectByID[$0] }, documents: documents(for: $0)) }.count, filter: "needs_attention")
            metric("期限未確認", rows.filter { $0.expirationDate == nil }.count, filter: "needs_metadata")
            metric("条件不足", rows.filter { termsCoverage(effectiveTerms($0, project: $0.projectId.flatMap { projectByID[$0] })) < 4 }.count, filter: "needs_metadata")
            metric("当事者判定待ち", ledgerRows.filter { $0.relationshipScope == "needs_review" }.count, filter: "scope_review")
        }
    }

    private func metric(_ label: String, _ value: Int, filter: String) -> some View {
        Button { statusFilter = filter } label: {
            AMDOSCard {
                VStack(alignment: .leading, spacing: 4) {
                    Text(label).font(.caption).foregroundStyle(AMDOSDesign.muted)
                    Text(value.formatted()).font(.title2.weight(.semibold)).foregroundStyle(statusFilter == filter ? AMDOSDesign.blue : AMDOSDesign.ink)
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        }.buttonStyle(.plain)
    }

    private func filterSection(_ envelope: AMDOSContractAdminEnvelope) -> some View {
        AMDOSSectionCard("表示条件", systemImage: "line.3.horizontal.decrease.circle") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    TextField("PJ、相手先、契約名、文書名で検索", text: $query)
                        .textFieldStyle(.roundedBorder)
                    Picker("契約", selection: $statusFilter) {
                        ForEach(Self.statusFilters, id: \.self) { Text(statusFilterLabel($0)).tag($0) }
                    }.frame(width: 190)
                }
                HStack(spacing: 10) {
                    Picker("PJ状態", selection: $projectActivityFilter) {
                        Text("稼働中PJ").tag("active"); Text("非アクティブ/未確認PJ").tag("inactive"); Text("全PJ状態").tag("all")
                    }.frame(width: 190)
                    Picker("並び順", selection: $sortMode) {
                        ForEach(Self.sortModes, id: \.self) { Text(sortLabel($0)).tag($0) }
                    }.frame(width: 190)
                    Picker("PJ", selection: $projectFilter) {
                        Text("全PJ").tag("")
                        ForEach(envelope.projects ?? []) { Text("\($0.projectId) \($0.projectName)").tag($0.projectId) }
                    }.frame(width: 180)
                    Spacer()
                    Button("更新") { load() }.buttonStyle(.bordered)
                    Button("契約を追加") { createDraft = .init(); showCreate = true }.buttonStyle(.borderedProminent)
                }
            }
            Text("\(filteredRows.count)件 · \(sortLabel(sortMode))").font(.caption).foregroundStyle(AMDOSDesign.muted)
        }
    }

    private var contractsSection: some View {
        AMDOSSectionCard("契約", systemImage: "signature") {
            if filteredRows.isEmpty { Text("該当する契約なし").foregroundStyle(AMDOSDesign.muted) }
            ForEach(filteredRows) { row in
                let project = row.projectId.flatMap { projectByID[$0] }
                let terms = effectiveTerms(row, project: project)
                let docs = documents(for: row)
                let reviews = reviewItems(row, project: project, documents: docs)
                Button { openLedgerRow(row) } label: {
                    VStack(alignment: .leading, spacing: 9) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(row.title).font(.headline)
                                Text("\(row.projectId ?? "PJ未設定") \(project?.projectName ?? "") · \(row.amdEntityName) × \(row.counterparty ?? "相手先未設定")")
                                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                            }
                            Spacer()
                            if row.isCurrentForProject { AMDOSStatusBadge(text: "PJ現行", tint: AMDOSDesign.blue) }
                            if !reviews.isEmpty { AMDOSStatusBadge(text: "要確認 \(reviews.count)", tint: AMDOSDesign.warning) }
                            AMDOSStatusBadge(text: contractStatusLabel(row.status))
                        }
                        Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 4) {
                            GridRow { summaryCell("状態・期間", "\(signatureLabel(row, documents: docs)) / \(periodLabel(row))"); summaryCell("金額・支払", paymentLabel(row, terms: terms)); summaryCell("業務・成果物", joined([jsonText(terms, "scopeSummary"), jsonText(terms, "deliverablesNote")])) }
                            GridRow { summaryCell("費用・報告", expenseLabel(terms)); summaryCell("権利・制限", joined([jsonText(terms, "ipOwnership"), jsonText(terms, "confidentialitySummary"), jsonText(terms, "terminationTerms")])); summaryCell("文書", docs.first(where: { $0.isLatest == true })?.fileName ?? "文書未登録") }
                        }
                        if !reviews.isEmpty { Text("確認: \(reviews.prefix(4).joined(separator: " / "))").font(.caption.weight(.medium)).foregroundStyle(AMDOSDesign.warning) }
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }.buttonStyle(.plain)
                AMDOSDivider()
            }
        }
    }

    private func summaryCell(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(AMDOSDesign.muted)
            Text(value).font(.caption).lineLimit(2)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private var operationsSection: some View {
        AMDOSSectionCard("検知・通知候補の運用", systemImage: "sparkles") {
            Text("候補確認は読み取りだけ。Slack・メール・Driveへの送信やアップロードは行わない。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            HStack(spacing: 10) {
                Button(runningSignals ? "候補を確認中…" : "予兆・条件候補を確認") { runSignalDryRun() }.disabled(runningSignals)
                Button(runningNudges ? "通知候補を確認中…" : "押印版未保存を確認") { runNudgeDryRun() }.disabled(runningNudges)
            }.buttonStyle(.bordered)
            if let result = signalDryRun {
                Text("予兆 \(result.candidateCounts?.total ?? 0)件 / 条件 \(result.termCandidateCounts?.total ?? 0)件 / 要確認 \(result.candidateCounts?.reviewRequired ?? 0)件")
                    .font(.caption.weight(.medium))
                ForEach((result.termCandidates ?? []).prefix(8)) { candidate in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("条件候補 · \(candidate.sourceKind ?? "出典未確認") · \(confidenceLabel(candidate.confidence))").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                        Text(candidate.sourceTitle ?? "名称未確認").font(.caption.weight(.medium))
                        Text("\(candidate.contractNo ?? "契約No未検出") · \(candidate.periodStart ?? "—") - \(candidate.periodEnd ?? "—") · \(money(candidate.amountTaxExcl))")
                            .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                }
                ForEach((result.candidates ?? []).prefix(8)) { candidate in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(candidate.title ?? "予兆").font(.caption.weight(.medium))
                        Text(candidate.snippet ?? "要約なし").font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                    }
                }
            }
            if let result = nudgeDryRun {
                Text("候補 \(result.candidateCounts?.total ?? 0)件 / 通知可能 \(result.candidateCounts?.sendable ?? 0)件 / 保留 \(result.candidateCounts?.blocked ?? 0)件")
                    .font(.caption.weight(.medium))
                ForEach(result.candidates ?? []) { candidate in
                    Text("\(candidate.projectId ?? "PJ未確認") · \(candidate.contractTitle ?? "契約") · \(candidate.staleDays ?? 0)日\(candidate.blocker.map { " · \($0)" } ?? "")")
                        .font(.caption).foregroundStyle(candidate.blocker == nil ? AMDOSDesign.muted : AMDOSDesign.warning)
                }
            }
            AMDOSAdminInlineMessage(text: extractionMessage)
        }
    }

    private var createSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("契約予定枠を追加").font(.title2.weight(.semibold))
            Picker("PJ", selection: $createDraft.projectId) {
                Text("選択してね").tag("")
                ForEach(envelope?.projects ?? []) { Text("\($0.projectId) \($0.projectName)").tag($0.projectId) }
            }
            AMDOSTextField(title: "契約タイトル", text: $createDraft.title)
            AMDOSTextField(title: "相手先", text: $createDraft.counterparty)
            Picker("契約種別", selection: $createDraft.contractType) { ForEach(Self.contractTypes, id: \.self) { Text(contractTypeLabel($0)).tag($0) } }
            AMDOSTextField(title: "押印予定日（YYYY-MM-DD）", text: $createDraft.expectedSigningDate)
            AMDOSTextField(title: "停滞とみなす日数", text: $createDraft.nudgeAfterDays)
            HStack { Spacer(); Button("閉じる") { showCreate = false }; Button(saving ? "追加中…" : "追加") { create() }.buttonStyle(.borderedProminent).disabled(saving || createDraft.projectId.isEmpty || createDraft.title.trimmedNonEmpty == nil) }
            AMDOSAdminInlineMessage(text: message)
        }.padding(24).frame(minWidth: 560, idealWidth: 620)
    }

    private func detailSheet(_ row: AMDOSContractLedgerRow) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(row.title).font(.title2.weight(.semibold))
                    Text("\(row.projectId ?? "PJ未設定") · \(row.counterparty ?? "相手先未設定") · 関連記録 \(row.relatedRecordCount)件")
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                Spacer()
                Picker("状態", selection: statusBinding(for: row)) { ForEach(Self.contractStatuses, id: \.self) { Text(contractStatusLabel($0)).tag($0) } }
                    .frame(width: 190).disabled(statusSaving || saving)
                Button("閉じる") { selectedLedgerRow = nil }
            }
            Picker("契約詳細", selection: $detailTab) {
                Text("実務条件").tag("terms"); Text("文書と版").tag("documents"); Text("関連記録").tag("records")
            }.pickerStyle(.segmented)
            AMDOSAdminInlineMessage(text: statusMessage)
            ScrollView {
                Group {
                    if detailTab == "terms" { termsEditor(row) }
                    else if detailTab == "documents" { documentsEditor(row) }
                    else { recordsView(row) }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(24)
        .frame(minWidth: 900, idealWidth: 1100, minHeight: 720)
        .confirmationDialog("状態を「\(contractStatusLabel(pendingStatusChange?.status ?? ""))」へ変更する？", isPresented: Binding(get: { pendingStatusChange != nil }, set: { if !$0 { pendingStatusChange = nil } }), titleVisibility: .visible) {
            if let change = pendingStatusChange { Button("変更する", role: change.status == "cancelled" ? .destructive : nil) { pendingStatusChange = nil; updateStatus(change.status, for: change.row) } }
            Button("キャンセル", role: .cancel) { pendingStatusChange = nil }
        }
    }

    private func termsEditor(_ row: AMDOSContractLedgerRow) -> some View {
        let project = row.projectId.flatMap { projectByID[$0] }
        let reviews = reviewItems(row, project: project, documents: documents(for: row))
        return VStack(alignment: .leading, spacing: 16) {
            if !reviews.isEmpty {
                AMDOSSectionCard("確認すること", systemImage: "exclamationmark.triangle") { ForEach(reviews, id: \.self) { Text("• \($0)").font(.caption) } }
            }
            AMDOSSectionCard("台帳・当事者", systemImage: "building.2") {
                AMDOSTextField(title: "契約名", text: $editDraft.canonicalTitle)
                AMDOSTextField(title: "相手先", text: $editDraft.counterpartyName)
                Picker("契約種別", selection: $editDraft.contractType) { ForEach(Self.contractTypes, id: \.self) { Text(contractTypeLabel($0)).tag($0) } }
                Picker("当事者区分", selection: $editDraft.relationshipScope) { Text("AMD当事者契約").tag("amd_contract"); Text("当事者判定待ち").tag("needs_review"); Text("第三者間契約").tag("third_party"); Text("雛形").tag("template") }
                Toggle("PJの現行契約として表示", isOn: $editDraft.currentForProject).disabled(editDraft.relationshipScope != "amd_contract")
                AMDOSTextField(title: "AMD側当事者", text: $editDraft.amdEntityName)
                AMDOSTextField(title: "AMDの契約上の立場", text: $editDraft.amdPartyRole)
                AMDOSTextField(title: "当事者確認の根拠", text: $editDraft.partyConfirmationNote)
                AMDOSTextField(title: "業務責任者", text: $editDraft.businessOwner)
                AMDOSTextField(title: "管理メモ", text: $editDraft.ledgerNotes, axis: .vertical)
            }
            AMDOSSectionCard("期間・金額・業務", systemImage: "calendar") {
                AMDOSTextField(title: "発効日（YYYY-MM-DD）", text: $editDraft.effectiveDate)
                AMDOSTextField(title: "終了日（YYYY-MM-DD）", text: $editDraft.expirationDate)
                AMDOSTextField(title: "更新通知期限（YYYY-MM-DD）", text: $editDraft.renewalNoticeDate)
                AMDOSTextField(title: "更新方法", text: $editDraft.renewalType)
                AMDOSTextField(title: "契約金額（円）", text: $editDraft.contractValueYen)
                AMDOSTextField(title: "支払条件", text: $editDraft.paymentTerms)
                AMDOSTextField(title: "税・源泉", text: $editDraft.taxTreatment)
                AMDOSTextField(title: "業務範囲", text: $editDraft.scopeSummary, axis: .vertical)
                Picker("成果物", selection: $editDraft.deliverablesRequired) { Text("未確認").tag("unknown"); Text("あり").tag("required"); Text("なし").tag("not_required") }
                AMDOSTextField(title: "成果物の条件", text: $editDraft.deliverablesNote)
                AMDOSTextField(title: "検収条件", text: $editDraft.acceptanceTerms)
                AMDOSTextField(title: "報告義務", text: $editDraft.monthlyReportSubmissionRule)
                AMDOSTextField(title: "報告条件", text: $editDraft.monthlyReportSubmissionNote)
                Picker("立替・実費", selection: $editDraft.expenseReimbursementAllowed) { Text("未確認").tag("unknown"); Text("申請可").tag("allowed"); Text("申請不可").tag("not_allowed") }
                AMDOSTextField(title: "費用負担の条件", text: $editDraft.expenseReimbursementNote)
            }
            AMDOSSectionCard("権利・制限・リスク", systemImage: "checkmark.shield") {
                AMDOSTextField(title: "知財帰属", text: $editDraft.ipOwnership)
                AMDOSTextField(title: "利用権", text: $editDraft.usageRights)
                AMDOSTextField(title: "名称・実績公開", text: $editDraft.publicityRights)
                Picker("秘密保持", selection: $editDraft.confidentialityCoverage) { Text("未確認").tag("unknown"); Text("契約本文に含む").tag("in_contract"); Text("別NDAで保護").tag("separate_nda"); Text("含まない").tag("not_included") }
                AMDOSTextField(title: "秘密保持の存続期間", text: $editDraft.confidentialitySurvivalNote)
                AMDOSTextField(title: "秘密保持の条件", text: $editDraft.confidentialityNote)
                AMDOSTextField(title: "再委託", text: $editDraft.subcontractingTerms)
                AMDOSTextField(title: "独占・競業", text: $editDraft.exclusivityTerms)
                AMDOSTextField(title: "解除条件", text: $editDraft.terminationTerms)
                AMDOSTextField(title: "損害賠償・責任上限", text: $editDraft.liabilityTerms)
                AMDOSTextField(title: "準拠法・管轄", text: $editDraft.governingLawJurisdiction)
                AMDOSTextField(title: "特記事項", text: $editDraft.specialTerms)
            }
            HStack { Spacer(); Button(saving ? "保存中…" : "契約情報を保存") { saveContract(row) }.buttonStyle(.borderedProminent).disabled(saving || editDraft.canonicalTitle.trimmedNonEmpty == nil) }
        }
    }

    private func documentsEditor(_ row: AMDOSContractLedgerRow) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            AMDOSSectionCard("版履歴", systemImage: "doc.on.doc") {
                if documents(for: row).isEmpty { Text("文書未登録").foregroundStyle(AMDOSDesign.muted) }
                ForEach(documents(for: row)) { document in
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(document.fileName ?? document.id).font(.body.weight(.medium))
                            Text("\(documentKindLabel(document.documentKind)) · \(document.versionLabel ?? "版未設定") · \(document.receivedAt ?? "日時未確認")").font(.caption).foregroundStyle(AMDOSDesign.muted)
                            if let link = document.webViewLink, let url = URL(string: link) { Link("Driveを開く", destination: url).font(.caption) }
                        }
                        Spacer()
                        if document.isLatest == true { AMDOSStatusBadge(text: "最新版", tint: AMDOSDesign.success) }
                        if document.documentKind == "signed" { AMDOSStatusBadge(text: "押印証跡", tint: AMDOSDesign.success) }
                    }
                    AMDOSDivider()
                }
            }
            AMDOSSectionCard("Drive文書を追加", systemImage: "link") {
                Text(envelope?.driveDestination?.path ?? "共有ドライブ/ARMADA/a3_backoffice/契約").font(.caption).foregroundStyle(AMDOSDesign.muted)
                Text("すでにDriveへ保存済みのリンクだけを登録する。ここからアップロード・共有変更・外部署名サービス取得は行わない。")
                    .font(.caption).foregroundStyle(AMDOSDesign.warning)
                Picker("文書の種類", selection: $documentDraft.documentKind) { Text("ドラフト").tag("draft"); Text("修正版").tag("revision"); Text("赤入れ").tag("redline"); Text("押印版").tag("signed"); Text("その他").tag("other") }
                AMDOSTextField(title: "Driveリンク", text: $documentDraft.webViewLink)
                AMDOSTextField(title: "ファイル名", text: $documentDraft.fileName)
                AMDOSTextField(title: "版", text: $documentDraft.versionLabel)
                AMDOSTextField(title: "Drive file ID（リンクから推定可）", text: $documentDraft.driveFileId)
                Button(saving ? "登録中…" : "文書metadataを登録") { addDocument(row) }
                    .buttonStyle(.borderedProminent).disabled(saving || documentDraft.webViewLink.trimmedNonEmpty == nil)
            }
        }
    }

    private func recordsView(_ row: AMDOSContractLedgerRow) -> some View {
        let linked = terms(for: row, linked: true)
        let unlinked = terms(for: row, linked: false)
        return VStack(alignment: .leading, spacing: 16) {
            AMDOSSectionCard("この契約に紐づく記録", systemImage: "link.badge.plus") {
                ForEach(Array(row.relatedTitles.enumerated()), id: \.offset) { index, title in Text("\(title) · \(index < row.relatedStatuses.count ? contractStatusLabel(row.relatedStatuses[index]) : "記録")").font(.caption) }
                ForEach(signals(for: row)) { signal in VStack(alignment: .leading) { Text(signal.title ?? "予兆").font(.body.weight(.medium)); Text(signal.snippet ?? "要約なし").font(.caption).foregroundStyle(AMDOSDesign.muted) } }
            }
            AMDOSSectionCard("契約条件の根拠", systemImage: "list.clipboard") {
                if linked.isEmpty { Text("確定紐付けされた条件候補なし").foregroundStyle(AMDOSDesign.muted) }
                ForEach(linked) { term in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack { Text(term.sourceTitle ?? term.contractTitle ?? term.id).font(.body.weight(.medium)); Spacer(); AMDOSStatusBadge(text: term.status ?? "状態未確認") }
                        Text("\(term.counterpartyName ?? "相手先未確認") · \(termPeriodLabel(term)) · \(termAmountLabel(term)) · \(confidenceLabel(term.confidence))").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    AMDOSDivider()
                }
            }
            if !unlinked.isEmpty {
                AMDOSSectionCard("PJ内の未紐付け候補", systemImage: "exclamationmark.triangle") {
                    Text("別契約の条件かもしれないため、上の回答には混ぜない。").font(.caption).foregroundStyle(AMDOSDesign.warning)
                    ForEach(unlinked.prefix(5)) { Text("\($0.sourceTitle ?? $0.id) · \(termAmountLabel($0))").font(.caption) }
                }
            }
            AMDOSSectionCard("通知候補履歴", systemImage: "bell") {
                let rows = nudges(for: row)
                if rows.isEmpty { Text("通知候補履歴なし").foregroundStyle(AMDOSDesign.muted) }
                ForEach(rows) { Text("\($0.status ?? "状態未確認") · \($0.staleDays ?? 0)日 · \($0.candidateAt ?? "日時未確認")").font(.caption) }
            }
        }
    }

    private func openLedgerRow(_ row: AMDOSContractLedgerRow) {
        selectedLedgerRow = row
        selectedStatus = row.status
        detailTab = "terms"
        statusMessage = nil
        documentDraft = .init()
        editDraft = draft(for: row)
    }

    private func statusBinding(for row: AMDOSContractLedgerRow) -> Binding<String> {
        Binding(get: { selectedStatus }, set: { next in
            guard next != selectedStatus, !statusSaving else { return }
            if next == "signed" || next == "cancelled" { pendingStatusChange = .init(row: row, status: next) }
            else { updateStatus(next, for: row) }
        })
    }

    private func create() {
        guard !saving, !createDraft.projectId.isEmpty, let title = createDraft.title.trimmedNonEmpty else { return }
        Task {
            saving = true; message = nil; defer { saving = false }
            do {
                let parsedNudgeDays = Int(createDraft.nudgeAfterDays) ?? 14
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/contracts", body: AMDOSContractAdminCreate(
                    projectId: createDraft.projectId, contractTitle: title, counterpartyName: createDraft.counterparty,
                    contractType: createDraft.contractType, expectedSigningDate: createDraft.expectedSigningDate.trimmedNonEmpty,
                    nudgeAfterDays: parsedNudgeDays == 0 ? 14 : parsedNudgeDays, reviewRequired: true
                ))
                let response = try JSONDecoder().decode(AMDOSContractStatusPatchEnvelope.self, from: data)
                guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "契約を追加できなかったよ") }
                message = "契約予定枠を追加したよ"; showCreate = false; createDraft = .init(); await reload(preserve: response.contract?.id)
            } catch { message = error.localizedDescription }
        }
    }

    private func saveContract(_ row: AMDOSContractLedgerRow) {
        guard !saving, let title = editDraft.canonicalTitle.trimmedNonEmpty else { return }
        Task {
            saving = true; statusMessage = nil; defer { saving = false }
            do {
                let canonicalData = try await AMDOSRESTClient.shared.sendPWA(path: "/api/contracts", method: "PATCH", body: AMDOSContractCanonicalPatch(contractIds: row.relatedContractIDs, canonicalContractId: row.canonicalContractID))
                try requireOK(canonicalData, fallback: "関連記録を連結できなかったよ")
                let operational = operationalTerms(from: editDraft)
                let current = editDraft.relationshipScope == "amd_contract" && editDraft.currentForProject
                let patch = AMDOSContractDetailsPatch(
                    canonicalContractId: row.canonicalContractID, canonicalTitle: title, counterpartyName: editDraft.counterpartyName,
                    contractType: editDraft.contractType, effectiveDate: editDraft.effectiveDate.trimmedNonEmpty, expirationDate: editDraft.expirationDate.trimmedNonEmpty,
                    renewalNoticeDate: editDraft.renewalNoticeDate.trimmedNonEmpty, renewalType: editDraft.renewalType.trimmedNonEmpty,
                    businessOwner: editDraft.businessOwner.trimmedNonEmpty, ledgerNotes: editDraft.ledgerNotes.trimmedNonEmpty,
                    relationshipScope: editDraft.relationshipScope, isCurrentForProject: current, amdEntityName: editDraft.amdEntityName,
                    amdPartyRole: editDraft.amdPartyRole.trimmedNonEmpty, partyConfirmationNote: editDraft.partyConfirmationNote.trimmedNonEmpty,
                    contractValueYen: editDraft.contractValueYen.trimmedNonEmpty, operationalTerms: operational,
                    confidentialityCoverage: editDraft.confidentialityCoverage, confidentialitySurvivalNote: editDraft.confidentialitySurvivalNote.trimmedNonEmpty,
                    confidentialityNote: editDraft.confidentialityNote.trimmedNonEmpty
                )
                let contractData = try await AMDOSRESTClient.shared.sendPWA(path: "/api/contracts/\(row.canonicalContractID)", method: "PATCH", body: patch)
                try requireOK(contractData, fallback: "契約情報を保存できなかったよ")
                if let project = row.projectId.flatMap({ projectByID[$0] }) {
                    let terms = mirroredProjectTerms(base: project.contractTerms ?? [:], row: row, title: title, operational: operational, current: current)
                    let projectData = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/projects/\(project.id)", method: "PATCH", body: AMDOSContractProjectPatch(projectsPatch: ["contract_terms_json": .object(terms)]))
                    try requireOK(projectData, fallback: "PJ現行契約を同期できなかったよ")
                }
                statusMessage = "契約情報と関連記録を保存したよ"; await reload(preserve: row.canonicalContractID)
            } catch { statusMessage = error.localizedDescription }
        }
    }

    private func addDocument(_ row: AMDOSContractLedgerRow) {
        guard !saving, let link = documentDraft.webViewLink.trimmedNonEmpty else { return }
        Task {
            saving = true; statusMessage = nil; defer { saving = false }
            do {
                let documentData = try await AMDOSRESTClient.shared.sendPWA(path: "/api/contracts/documents", body: AMDOSContractDocumentCreate(
                    contractId: row.canonicalContractID, webViewLink: link, driveFileId: documentDraft.driveFileId,
                    fileName: documentDraft.fileName, versionLabel: documentDraft.versionLabel, documentKind: documentDraft.documentKind, isLatest: true
                ))
                try requireOK(documentData, fallback: "Drive文書を登録できなかったよ")
                statusMessage = documentDraft.documentKind == "signed" ? "押印版metadataを登録して、押印済み記録へ更新したよ" : "Drive文書metadataを登録したよ"
                documentDraft = .init(); await reload(preserve: row.canonicalContractID)
            } catch { statusMessage = error.localizedDescription }
        }
    }

    private func updateStatus(_ status: String, for row: AMDOSContractLedgerRow) {
        guard Self.contractStatuses.contains(status), !statusSaving else { return }
        Task {
            statusSaving = true; statusMessage = nil; defer { statusSaving = false }
            do {
                let statusData = try await AMDOSRESTClient.shared.sendPWA(path: "/api/contracts/\(row.canonicalContractID)", method: "PATCH", body: AMDOSContractStatusPatch(status: status))
                try requireOK(statusData, fallback: "契約状態を更新できなかったよ")
                selectedStatus = status; statusMessage = "状態を「\(contractStatusLabel(status))」に更新したよ"; await reload(preserve: row.canonicalContractID)
            } catch { selectedStatus = row.status; statusMessage = error.localizedDescription }
        }
    }

    private func runSignalDryRun() {
        guard !runningSignals else { return }
        Task { runningSignals = true; extractionMessage = nil; defer { runningSignals = false }; do {
            signalDryRun = try await AMDOSRESTClient.shared.fetchPWA(AMDOSContractExtractionResponse.self, path: "/api/contracts/signal-dry-run", query: projectFilter.isEmpty ? [:] : ["project_id": projectFilter])
            if signalDryRun?.ok != true { throw AMDOSNetworkError.http(signalDryRun?.error ?? "候補を取得できなかったよ") }
        } catch { extractionMessage = error.localizedDescription } }
    }

    private func runNudgeDryRun() {
        guard !runningNudges else { return }
        Task { runningNudges = true; extractionMessage = nil; defer { runningNudges = false }; do {
            nudgeDryRun = try await AMDOSRESTClient.shared.fetchPWA(AMDOSContractNudgeDryRunResponse.self, path: "/api/contracts/nudges/dry-run", query: projectFilter.isEmpty ? [:] : ["project_id": projectFilter])
            if nudgeDryRun?.ok != true { throw AMDOSNetworkError.http(nudgeDryRun?.error ?? "通知候補を取得できなかったよ") }
        } catch { extractionMessage = error.localizedDescription } }
    }

    private func load() { Task { await reload() } }

    @MainActor
    private func reload(preserve selectedID: String? = nil) async {
        let targetID = selectedID ?? selectedLedgerRow?.canonicalContractID
        state = .loading
        do {
            let loaded = try await AMDOSRESTClient.shared.fetchPWA(AMDOSContractAdminEnvelope.self, path: "/api/contracts")
            guard loaded.ok == true else { throw AMDOSNetworkError.http(loaded.error ?? "契約台帳を取得できなかったよ") }
            envelope = loaded; state = (loaded.contracts ?? []).isEmpty ? .empty : .loaded
            if let targetID, let row = AMDOSContractLedger.consolidate(loaded.contracts ?? []).first(where: { $0.canonicalContractID == targetID }) {
                selectedLedgerRow = row; selectedStatus = row.status; editDraft = draft(for: row)
            }
        } catch { state = .failed(error.localizedDescription) }
    }

    private func requireOK(_ data: Data, fallback: String) throws {
        let response = try JSONDecoder().decode(AMDOSContractStatusPatchEnvelope.self, from: data)
        guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? fallback) }
    }

    private func documents(for row: AMDOSContractLedgerRow) -> [AMDOSContractAdminDocument] {
        (envelope?.documents ?? []).filter { $0.contractId.map(row.relatedContractIDs.contains) == true }.sorted { ($0.receivedAt ?? "") > ($1.receivedAt ?? "") }
    }

    private func signals(for row: AMDOSContractLedgerRow) -> [AMDOSContractAdminSignal] {
        (envelope?.signals ?? []).filter { $0.contractId.map(row.relatedContractIDs.contains) == true }
    }

    private func terms(for row: AMDOSContractLedgerRow, linked: Bool) -> [AMDOSContractAdminTerm] {
        (envelope?.terms ?? []).filter { term in
            guard term.projectId == row.projectId else { return false }
            return linked ? term.contractId.map(row.relatedContractIDs.contains) == true : term.contractId == nil
        }.sorted { ($0.confidence ?? 0) > ($1.confidence ?? 0) }
    }

    private func nudges(for row: AMDOSContractLedgerRow) -> [AMDOSContractAdminNudge] {
        (envelope?.nudges ?? []).filter { $0.contractId.map(row.relatedContractIDs.contains) == true }.sorted { ($0.candidateAt ?? "") > ($1.candidateAt ?? "") }
    }

    private func effectiveTerms(_ row: AMDOSContractLedgerRow, project: AMDOSContractAdminProject?) -> [String: AMDOSContractJSONValue] {
        var result: [String: AMDOSContractJSONValue] = [:]
        let projectTerms = project?.contractTerms ?? [:]
        if let currentContracts = projectTerms["currentContracts"]?.array {
            if let matching = currentContracts.compactMap(\.object).first(where: { object in object["contractId"]?.text.map(row.relatedContractIDs.contains) == true }), let terms = matching["terms"]?.object { result.merge(terms) { _, new in new } }
        } else if row.isCurrentForProject { result.merge(projectTerms) { _, new in new } }
        result.merge(row.operationalTerms) { _, new in new }
        return result
    }

    private func operationalTerms(from draft: AMDOSContractEditDraft) -> [String: AMDOSContractJSONValue] {
        [
            "paymentTerms": json(draft.paymentTerms), "taxTreatment": json(draft.taxTreatment), "scopeSummary": json(draft.scopeSummary),
            "deliverablesRequired": draft.deliverablesRequired == "required" ? .bool(true) : draft.deliverablesRequired == "not_required" ? .bool(false) : .null,
            "deliverablesNote": json(draft.deliverablesNote), "acceptanceTerms": json(draft.acceptanceTerms),
            "monthlyReportSubmissionRule": json(draft.monthlyReportSubmissionRule), "monthlyReportSubmissionNote": json(draft.monthlyReportSubmissionNote),
            "expenseReimbursementAllowed": draft.expenseReimbursementAllowed == "allowed" ? .bool(true) : draft.expenseReimbursementAllowed == "not_allowed" ? .bool(false) : .null,
            "expenseReimbursementNote": json(draft.expenseReimbursementNote), "ipOwnership": json(draft.ipOwnership), "usageRights": json(draft.usageRights),
            "publicityRights": json(draft.publicityRights), "confidentialitySummary": json(draft.confidentialityNote),
            "confidentialitySurvival": json(draft.confidentialitySurvivalNote), "subcontractingTerms": json(draft.subcontractingTerms),
            "exclusivityTerms": json(draft.exclusivityTerms), "terminationTerms": json(draft.terminationTerms), "liabilityTerms": json(draft.liabilityTerms),
            "governingLawJurisdiction": json(draft.governingLawJurisdiction), "specialTerms": json(draft.specialTerms),
        ]
    }

    private func mirroredProjectTerms(base: [String: AMDOSContractJSONValue], row: AMDOSContractLedgerRow, title: String, operational: [String: AMDOSContractJSONValue], current: Bool) -> [String: AMDOSContractJSONValue] {
        var result = base
        var contracts = (base["currentContracts"]?.array ?? []).compactMap(\.object).filter { $0["contractId"]?.text != row.canonicalContractID }
        var currentTerms = operational
        currentTerms["amountTaxExclTotal"] = editDraft.contractValueYen.trimmedNonEmpty.map(AMDOSContractJSONValue.string) ?? .null
        if current {
            contracts.append([
                "contractId": .string(row.canonicalContractID), "title": .string(title), "contractType": .string(editDraft.contractType),
                "status": .string(row.status), "signatureStatus": .string(row.status == "signed" ? "押印済み記録" : contractStatusLabel(row.status)),
                "counterpartyName": .string(editDraft.counterpartyName), "effectiveDate": json(editDraft.effectiveDate), "expirationDate": json(editDraft.expirationDate),
                "renewalType": json(editDraft.renewalType), "renewalNoticeDate": json(editDraft.renewalNoticeDate), "terms": .object(currentTerms),
            ])
            result["currentContractId"] = .string(row.canonicalContractID); result["currentContractTitle"] = .string(title)
            result["currentContractType"] = .string(editDraft.contractType); result["currentContractStatus"] = .string(row.status)
            result["signatureStatus"] = .string(row.status == "signed" ? "押印済み記録" : contractStatusLabel(row.status))
            result["counterpartyName"] = editDraft.counterpartyName.trimmedNonEmpty.map(AMDOSContractJSONValue.string) ?? base["counterpartyName"] ?? .null
            if editDraft.effectiveDate.count >= 7 { result["contractStartYm"] = .string(String(editDraft.effectiveDate.prefix(7)).replacingOccurrences(of: "-", with: "")) }
            if editDraft.expirationDate.count >= 7 { result["contractEndYm"] = .string(String(editDraft.expirationDate.prefix(7)).replacingOccurrences(of: "-", with: "")) }
            result["renewalType"] = json(editDraft.renewalType); result["renewalNoticeDate"] = json(editDraft.renewalNoticeDate)
            result["sourceTitle"] = .string(title); result["sourceRef"] = .string("contracts:\(row.canonicalContractID)")
        } else if base["currentContractId"]?.text == row.canonicalContractID { result["currentContractId"] = .null }
        result["currentContracts"] = .array(contracts.map(AMDOSContractJSONValue.object))
        return result
    }

    private func draft(for row: AMDOSContractLedgerRow) -> AMDOSContractEditDraft {
        let terms = effectiveTerms(row, project: row.projectId.flatMap { projectByID[$0] })
        var draft = AMDOSContractEditDraft()
        draft.canonicalTitle = row.title; draft.counterpartyName = row.counterparty ?? ""; draft.contractType = row.contractType ?? "contract"
        draft.effectiveDate = row.effectiveDate ?? ""; draft.expirationDate = row.expirationDate ?? ""; draft.renewalNoticeDate = row.renewalNoticeDate ?? ""; draft.renewalType = row.renewalType ?? ""
        draft.businessOwner = row.businessOwner ?? ""; draft.ledgerNotes = row.ledgerNotes ?? ""; draft.relationshipScope = row.relationshipScope; draft.currentForProject = row.isCurrentForProject
        draft.amdEntityName = row.amdEntityName; draft.amdPartyRole = row.amdPartyRole ?? ""; draft.partyConfirmationNote = row.partyConfirmationNote ?? ""; draft.contractValueYen = row.contractValueYen.map { String(Int($0.rounded())) } ?? ""
        draft.paymentTerms = jsonText(terms, "paymentTerms") ?? ""; draft.taxTreatment = jsonText(terms, "taxTreatment") ?? ""; draft.scopeSummary = jsonText(terms, "scopeSummary") ?? ""
        draft.deliverablesRequired = terms["deliverablesRequired"]?.bool == true ? "required" : terms["deliverablesRequired"]?.bool == false ? "not_required" : "unknown"
        draft.deliverablesNote = jsonText(terms, "deliverablesNote") ?? ""; draft.acceptanceTerms = jsonText(terms, "acceptanceTerms") ?? ""
        draft.monthlyReportSubmissionRule = jsonText(terms, "monthlyReportSubmissionRule") ?? ""; draft.monthlyReportSubmissionNote = jsonText(terms, "monthlyReportSubmissionNote") ?? ""
        draft.expenseReimbursementAllowed = terms["expenseReimbursementAllowed"]?.bool == true ? "allowed" : terms["expenseReimbursementAllowed"]?.bool == false ? "not_allowed" : "unknown"
        draft.expenseReimbursementNote = jsonText(terms, "expenseReimbursementNote") ?? ""; draft.ipOwnership = jsonText(terms, "ipOwnership") ?? ""; draft.usageRights = jsonText(terms, "usageRights") ?? ""
        draft.publicityRights = jsonText(terms, "publicityRights") ?? ""; draft.confidentialityCoverage = row.confidentialityCoverage; draft.confidentialitySurvivalNote = row.confidentialitySurvivalNote ?? ""
        draft.confidentialityNote = row.confidentialityNote ?? jsonText(terms, "confidentialitySummary") ?? ""; draft.subcontractingTerms = jsonText(terms, "subcontractingTerms") ?? ""
        draft.exclusivityTerms = jsonText(terms, "exclusivityTerms") ?? ""; draft.terminationTerms = jsonText(terms, "terminationTerms") ?? ""; draft.liabilityTerms = jsonText(terms, "liabilityTerms") ?? ""
        draft.governingLawJurisdiction = jsonText(terms, "governingLawJurisdiction") ?? ""; draft.specialTerms = jsonText(terms, "specialTerms") ?? ""
        return draft
    }

    private func reviewItems(_ row: AMDOSContractLedgerRow, project: AMDOSContractAdminProject?, documents: [AMDOSContractAdminDocument]) -> [String] {
        let terms = effectiveTerms(row, project: project); var items: [String] = []
        if row.registryStatus == "candidate" || row.reviewRequired || row.reviewStatus == "pending" { items.append("台帳採用") }
        if row.relationshipScope != "amd_contract" { items.append("AMD当事者") }
        if row.counterparty == nil { items.append("相手先") }
        if row.expirationDate == nil { items.append("終了・更新") }
        if !hasOperationalTerms(terms) { items.append("実務条件") }
        if terms["expenseReimbursementAllowed"]?.bool == nil { items.append("立替可否") }
        if confidentialityLabel(row) == "未確認" { items.append("秘密保持") }
        let signature = signatureLabel(row, documents: documents)
        if signature == "要確認" || signature == "更新中" { items.append("押印証跡") }
        else if signature == "未完了" && row.status != "cancelled" { items.append("押印状況") }
        if documents.isEmpty { items.append("契約書ファイル") }
        return Array(Set(items)).sorted()
    }

    private func needsAttention(_ row: AMDOSContractLedgerRow, project: AMDOSContractAdminProject?, documents: [AMDOSContractAdminDocument]) -> Bool {
        !reviewItems(row, project: project, documents: documents).isEmpty
    }

    private func hasOperationalTerms(_ terms: [String: AMDOSContractJSONValue]) -> Bool { termsCoverage(terms) > 0 }
    private func termsCoverage(_ terms: [String: AMDOSContractJSONValue]) -> Int {
        [jsonText(terms, "paymentTerms") != nil || terms["monthlyFeeYen"]?.number != nil || terms["amountTaxExclTotal"]?.number != nil,
         jsonText(terms, "scopeSummary") != nil || jsonText(terms, "deliverablesNote") != nil || jsonText(terms, "acceptanceTerms") != nil,
         terms["expenseReimbursementAllowed"]?.bool != nil || jsonText(terms, "expenseReimbursementNote") != nil,
         jsonText(terms, "ipOwnership") != nil || jsonText(terms, "usageRights") != nil,
         jsonText(terms, "confidentialitySummary") != nil,
         jsonText(terms, "terminationTerms") != nil || jsonText(terms, "liabilityTerms") != nil].filter { $0 }.count
    }

    private func signatureLabel(_ row: AMDOSContractLedgerRow, documents: [AMDOSContractAdminDocument]) -> String {
        let signed = documents.filter { $0.documentKind == "signed" }
        if row.status == "signed" { return signed.contains(where: { $0.id == row.currentSignedDocumentID }) ? "押印完了" : "要確認" }
        return signed.isEmpty ? "未完了" : "更新中"
    }

    private func confidentialityLabel(_ row: AMDOSContractLedgerRow) -> String {
        if row.confidentialityConflict { return "要確認" }
        switch row.confidentialityCoverage { case "in_contract": return "本文に含む"; case "separate_nda": return "別NDA"; case "not_included": return "含まない"; default: return row.title.lowercased().contains("nda") || row.title.contains("秘密保持") ? "本文に含む" : "未確認" }
    }

    private func paymentLabel(_ row: AMDOSContractLedgerRow, terms: [String: AMDOSContractJSONValue]) -> String {
        if let amount = row.contractValueYen { return "契約額 \(money(amount)) · \(jsonText(terms, "paymentTerms") ?? "支払条件未確認")" }
        if let amount = terms["amountTaxExclTotal"]?.number { return "税抜総額 \(money(amount))" }
        if let amount = terms["monthlyFeeYen"]?.number { return "月額 \(money(amount))" }
        return "金額未確認"
    }

    private func expenseLabel(_ terms: [String: AMDOSContractJSONValue]) -> String {
        let label = terms["expenseReimbursementAllowed"]?.bool == true ? "申請可" : terms["expenseReimbursementAllowed"]?.bool == false ? "申請不可" : "未確認"
        return joined([label, jsonText(terms, "expenseReimbursementNote"), jsonText(terms, "monthlyReportSubmissionRule")])
    }

    private func sortRows(_ lhs: AMDOSContractLedgerRow, _ rhs: AMDOSContractLedgerRow) -> Bool {
        let projectL = lhs.projectId.flatMap { projectByID[$0] }; let projectR = rhs.projectId.flatMap { projectByID[$0] }
        let primary: ComparisonResult
        switch sortMode {
        case "signing_asc": primary = compareDates(lhs.signedAt ?? lhs.expectedSigningDate ?? lhs.effectiveDate ?? lhs.latestActivityAt, rhs.signedAt ?? rhs.expectedSigningDate ?? rhs.effectiveDate ?? rhs.latestActivityAt, ascending: true)
        case "expiration_asc": primary = compareDates(lhs.expirationDate, rhs.expirationDate, ascending: true)
        case "renewal_asc": primary = compareDates(lhs.renewalNoticeDate, rhs.renewalNoticeDate, ascending: true)
        case "activity_desc": primary = compareDates(lhs.latestActivityAt, rhs.latestActivityAt, ascending: false)
        case "project_asc":
            let projectIDOrder = compareText(lhs.projectId, rhs.projectId)
            primary = projectIDOrder == .orderedSame ? compareText(projectL?.projectName, projectR?.projectName) : projectIDOrder
        case "title_asc": primary = compareText(lhs.title, rhs.title)
        default: primary = compareDates(lhs.signedAt ?? lhs.expectedSigningDate ?? lhs.effectiveDate ?? lhs.latestActivityAt, rhs.signedAt ?? rhs.expectedSigningDate ?? rhs.effectiveDate ?? rhs.latestActivityAt, ascending: false)
        }
        if primary != .orderedSame { return primary == .orderedAscending }
        let projectOrder = compareText(lhs.projectId, rhs.projectId)
        if projectOrder != .orderedSame { return projectOrder == .orderedAscending }
        let titleOrder = compareText(lhs.title, rhs.title)
        if titleOrder != .orderedSame { return titleOrder == .orderedAscending }
        return compareText(lhs.canonicalContractID, rhs.canonicalContractID) == .orderedAscending
    }

    private func compareDates(_ lhs: String?, _ rhs: String?, ascending: Bool) -> ComparisonResult {
        guard let lhs else { return rhs == nil ? .orderedSame : .orderedDescending }
        guard let rhs else { return .orderedAscending }
        let order = lhs.compare(rhs)
        if ascending || order == .orderedSame { return order }
        return order == .orderedAscending ? .orderedDescending : .orderedAscending
    }

    private func compareText(_ lhs: String?, _ rhs: String?) -> ComparisonResult {
        (lhs ?? "").compare(rhs ?? "", options: [.numeric, .caseInsensitive], locale: Locale(identifier: "ja_JP"))
    }

    private func isActiveProject(_ project: AMDOSContractAdminProject?) -> Bool { project.map { ["active", "sales"].contains(($0.status ?? "").lowercased()) } ?? false }
    private func daysUntil(_ value: String?) -> Int? { guard let value, let date = ISO8601DateFormatter().date(from: value) ?? DateFormatter.contractDate.date(from: value) else { return nil }; return Calendar.current.dateComponents([.day], from: Date(), to: date).day }
    private func json(_ value: String) -> AMDOSContractJSONValue { value.trimmedNonEmpty.map(AMDOSContractJSONValue.string) ?? .null }
    private func jsonText(_ object: [String: AMDOSContractJSONValue], _ key: String) -> String? { object[key]?.text }
    private func jsonSearchText(_ value: AMDOSContractJSONValue) -> String { switch value { case .object(let object): return object.values.map(jsonSearchText).joined(separator: " "); case .array(let array): return array.map(jsonSearchText).joined(separator: " "); case .string(let text): return text; case .number(let number): return String(number); case .bool(let flag): return String(flag); case .null: return "" } }
    private func joined(_ values: [String?]) -> String { let values = values.compactMap { $0?.trimmedNonEmpty }; return values.isEmpty ? "未確認" : values.joined(separator: " / ") }
    private func money(_ value: Double?) -> String { value.map { "¥\(Int($0.rounded()).formatted(.number.grouping(.automatic)))" } ?? "金額未確認" }
    private func confidenceLabel(_ confidence: Double?) -> String { confidence.map { "確度 \(Int(($0 * 100).rounded()))%" } ?? "確度未確認" }
    private func termAmountLabel(_ term: AMDOSContractAdminTerm) -> String { term.amountTaxExcl.map { "税抜 \(money($0))" } ?? term.amountTaxIncl.map { "税込 \(money($0))" } ?? "金額未確認" }
    private func termPeriodLabel(_ term: AMDOSContractAdminTerm) -> String { let start = term.periodStart ?? term.periodStartYM; let end = term.periodEnd ?? term.periodEndYM; return start == nil && end == nil ? "期間未確認" : "\(start ?? "—") - \(end ?? "—")" }
    private func periodLabel(_ row: AMDOSContractLedgerRow) -> String { row.effectiveDate == nil && row.expirationDate == nil ? "期間未確認" : "\(row.effectiveDate ?? "—") - \(row.expirationDate ?? "—")" }
    private func documentKindLabel(_ kind: String?) -> String { ["draft": "ドラフト", "revision": "修正版", "redline": "赤入れ", "signed": "押印版", "other": "その他"][kind ?? ""] ?? "種類未確認" }
    private func contractTypeLabel(_ type: String) -> String { ["contract": "契約", "nda": "NDA", "outsourcing": "業務委託", "joint_research": "共同研究", "mou": "MOU/覚書", "order": "発注/SOW", "investment": "投資", "employment": "雇用", "mandate": "委任/顧問"][type] ?? type }
    private func contractStatusLabel(_ status: String) -> String { ["planned": "予定枠", "drafting": "作成中", "under_review": "レビュー中", "awaiting_signature": "押印待ち", "signed": "押印済み記録", "stalled": "停滞", "cancelled": "中止"][status] ?? status }
    private func statusFilterLabel(_ value: String) -> String { ["ledger": "AMD当事者契約", "current": "PJ現行契約", "needs_attention": "要対応", "expiring": "期限90日以内", "needs_metadata": "契約条件不足", "scope_review": "当事者判定待ち", "excluded": "第三者間・雛形", "all": "AMD契約の全記録"][value] ?? contractStatusLabel(value) }
    private func sortLabel(_ value: String) -> String { ["signing_desc": "締結日 新しい順", "signing_asc": "締結日 古い順", "expiration_asc": "終了日 近い順", "renewal_asc": "更新通知 近い順", "activity_desc": "最新活動順", "project_asc": "PJ順", "title_asc": "契約名順"][value] ?? value }
}

private extension DateFormatter {
    static let contractDate: DateFormatter = { let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"; return formatter }()
}

private struct AMDOSCoverageGap: Codable, Identifiable, Sendable { let id: String; let source: String?; let title: String?; let summary: String?; let salienceScore: Double?; let proposedTarget: String?; let gapClass: String?; let projectId: String?; let dueAt: String?; let reviewStatus: String?; enum CodingKeys: String, CodingKey { case id = "gap_id", source, title, summary, salienceScore = "salience_score", proposedTarget = "proposed_target_l2", gapClass = "gap_class", projectId = "project_id", dueAt = "due_at", reviewStatus = "review_status" } }
struct AMDOSAdminCoverageGapsView: View { @State private var rows: [AMDOSCoverageGap] = []; @State private var state: AMDOSFeatureLoadState = .idle; var body: some View { AMDOSPageScaffold(eyebrow: "COVERAGE GAPS", title: "Coverage Gaps", subtitle: "l2_coverage_gapsの検知対象とレビュー状態を確認") { AMDOSStateNotice(state: state) { load() }; ForEach(rows) { row in AMDOSSectionCard(row.title ?? row.id, systemImage: "antenna.radiowaves.left.and.right") { Text(row.summary ?? "要約なし"); Text("\(row.gapClass ?? "未分類") · 入れ先 \(row.proposedTarget ?? "未定") · PJ \(row.projectId ?? "会社")").font(.caption); AMDOSStatusBadge(text: row.reviewStatus ?? "未確認"); Text("重要度 \(Int(row.salienceScore ?? 0)) · \(row.dueAt ?? "期限未登録")").font(.caption).foregroundStyle(AMDOSDesign.muted) } } }.task { load() } }; private func load() { Task { state = .loading; do { rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSCoverageGap.self, table: "l2_coverage_gaps", select: "gap_id,source,title,summary,salience_score,proposed_target_l2,gap_class,project_id,due_at,review_status", order: "review_status,due_at.desc", limit: 500); state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } } }

private struct AMDOSIPResponse: Codable, Sendable { let ok: Bool; let markdown: String; let updated: String? }
struct AMDOSAdminIPView: View {
    @State private var document: AMDOSIPResponse?
    @State private var state: AMDOSFeatureLoadState = .idle

    var body: some View {
        AMDOSPageScaffold(eyebrow: "IP", title: "知財 / IP", subtitle: "AMD OS / AMDプロトコル 特許化レポート") {
            AMDOSStateNotice(state: state) { load() }
            if let document {
                HStack(spacing: 8) {
                    AMDOSStatusBadge(text: "弁理士 初回相談 Ready", tint: AMDOSDesign.blue)
                    AMDOSStatusBadge(text: "出願前")
                    AMDOSStatusBadge(text: "最終更新 \(document.updated ?? "—")")
                }
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("機密 / NDA 前提", systemImage: "lock.fill").font(.subheadline.weight(.semibold)).foregroundStyle(AMDOSDesign.warning)
                        Text("外部共有・公開・登壇・note投稿の前に、コア部分は弁理士へ確認すること。出願前の公開は新規性を失う。詳細・全公報リスト・請求項全文は docs/ip/ 配下の正本md / docx を参照。")
                            .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                }
                AMDOSSectionCard("AMD OS / AMDプロトコル 知財レポート", systemImage: "lightbulb.max.fill") {
                    Text(amdOSAdminIPMarkdown(document.markdown)).textSelection(.enabled)
                }
            }
        }.task { load() }
    }

    private func load() { Task { state = .loading; do { document = try await AMDOSRESTClient.shared.fetchPWA(AMDOSIPResponse.self, path: "/api/macos/ip"); state = .loaded } catch { state = .failed(error.localizedDescription) } } }
}

private func amdOSAdminIPMarkdown(_ markdown: String) -> AttributedString {
    (try? AttributedString(markdown: markdown, options: .init(interpretedSyntax: .full))) ?? AttributedString(markdown)
}

private struct AMDOSCultureLink: Codable, Identifiable, Sendable { let label: String; let url: String; var id: String { label + "::" + url } }
private struct AMDOSCultureItem: Codable, Identifiable, Sendable {
    let id: String; let title: String; let description: String?; let categoryPath: [String]; let prefecture: String?; let city: String?; let links: [AMDOSCultureLink]?; let imageURL: String?; let sortWeight: Double?
    enum CodingKeys: String, CodingKey { case id, title, description, categoryPath = "category_path", prefecture, city, links, imageURL = "image_url", sortWeight = "sort_weight" }
}
private struct AMDOSCultureTreeNode: Identifiable {
    let id: String; let label: String; let children: [AMDOSCultureTreeNode]; let items: [AMDOSCultureItem]; let total: Int
    static func build(_ items: [AMDOSCultureItem], path: [String] = []) -> [AMDOSCultureTreeNode] {
        let labels = Set(items.compactMap { $0.categoryPath.count > path.count ? $0.categoryPath[path.count] : nil }).sorted { $0.localizedCompare($1) == .orderedAscending }
        return labels.map { label in
            let next = path + [label]
            let scoped = items.filter { Array($0.categoryPath.prefix(next.count)) == next }
            let direct = scoped.filter { $0.categoryPath.count == next.count }.sorted { ($0.sortWeight ?? 0) > ($1.sortWeight ?? 0) }
            return AMDOSCultureTreeNode(id: next.joined(separator: "/"), label: label, children: build(scoped.filter { $0.categoryPath.count > next.count }, path: next), items: direct, total: scoped.count)
        }
    }
}
struct AMDOSAdminCultureMapView: View {
    private enum Mode: String, CaseIterable, Identifiable { case mindmap, map; var id: String { rawValue } }
    @State private var rows: [AMDOSCultureItem] = []
    @State private var mode: Mode = .mindmap
    @State private var expanded = Set<String>()
    @State private var selected: AMDOSCultureItem?
    @State private var selectedPrefecture = ""
    @State private var state: AMDOSFeatureLoadState = .idle

    private var tree: [AMDOSCultureTreeNode] { AMDOSCultureTreeNode.build(rows) }
    private var prefectures: [String] { Array(Set(rows.compactMap(\.prefecture))).sorted { $0.localizedCompare($1) == .orderedAscending } }
    private var prefectureItems: [AMDOSCultureItem] { rows.filter { $0.prefecture == selectedPrefecture } }
    private var cities: [(String, [AMDOSCultureItem])] {
        let labels = Set(prefectureItems.map { $0.city ?? "市区町村未設定" })
        return labels.map { city in (city, prefectureItems.filter { ($0.city ?? "市区町村未設定") == city }) }.sorted { $0.1.count == $1.1.count ? $0.0.localizedCompare($1.0) == .orderedAscending : $0.1.count > $1.1.count }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "CULTURE MAP", title: "🇯🇵 日本文化マップ", subtitle: "PWAと同じactive文化コンテンツを、カテゴリ階層または都道府県からたどる") {
            HStack { Text("\(rows.count) コンテンツ").font(.caption).foregroundStyle(AMDOSDesign.muted); Spacer(); Picker("表示", selection: $mode) { Text("🧠 マインドマップ").tag(Mode.mindmap); Text("🗾 日本地図").tag(Mode.map) }.pickerStyle(.segmented).frame(width: 250) }
            AMDOSStateNotice(state: state) { load() }
            if rows.isEmpty && state == .loaded { ContentUnavailableView("まだ文化コンテンツがない", systemImage: "map", description: Text("jp_culture_items テーブルにコンテンツを追加してください")) }
            if mode == .mindmap { categoryTree } else { geography }
            if let selected { detail(selected) }
        }.task { load() }
    }

    @ViewBuilder private var categoryTree: some View {
        AMDOSSectionCard("カテゴリ", systemImage: "point.3.connected.trianglepath.dotted") {
            Text("カテゴリを開くと下位カテゴリとコンテンツを表示。コンテンツを選ぶと詳細・画像・外部リンクを開く。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            ForEach(tree) { node in nodeView(node) }
        }
    }
    private func nodeView(_ node: AMDOSCultureTreeNode) -> AnyView {
        AnyView(DisclosureGroup(isExpanded: Binding(get: { expanded.contains(node.id) }, set: { isOpen in if isOpen { expanded.insert(node.id) } else { expanded.remove(node.id) } })) {
            ForEach(node.children) { nodeView($0) }
            ForEach(node.items) { item in Button { selected = item } label: { HStack { Image(systemName: "diamond.fill").font(.caption2).foregroundStyle(AMDOSDesign.blue); Text(item.title); Spacer(); Text(item.categoryPath.joined(separator: " › ")).font(.caption2).foregroundStyle(AMDOSDesign.muted) } }.buttonStyle(.plain).padding(.vertical, 3) }
        } label: { HStack { Text(node.label).font(.headline); Spacer(); AMDOSStatusBadge(text: "\(node.total)件") } }.padding(.vertical, 3))
    }
    @ViewBuilder private var geography: some View {
        AMDOSSectionCard("都道府県", systemImage: "map.fill") {
            Text("コンテンツのある都道府県を選ぶと、市区町村別の一覧を表示。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker("都道府県", selection: $selectedPrefecture) { Text("選択").tag(""); ForEach(prefectures, id: \.self) { Text($0).tag($0) } }
            if !selectedPrefecture.isEmpty { ForEach(cities, id: \.0) { city in VStack(alignment: .leading, spacing: 4) { Text("\(city.0) \(city.1.count)件").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted); ForEach(city.1) { item in Button { selected = item } label: { HStack { VStack(alignment: .leading) { Text(item.title); Text(item.categoryPath.joined(separator: " › ")).font(.caption2).foregroundStyle(AMDOSDesign.muted) }; Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(AMDOSDesign.muted) } }.buttonStyle(.plain) } }.padding(.vertical, 4) } }
        }
    }
    @ViewBuilder private func detail(_ item: AMDOSCultureItem) -> some View {
        AMDOSSectionCard(item.title, systemImage: "info.circle") {
            HStack { ForEach(item.categoryPath, id: \.self) { AMDOSStatusBadge(text: $0) }; if item.prefecture != nil || item.city != nil { AMDOSStatusBadge(text: [item.prefecture, item.city].compactMap { $0 }.joined(separator: " ")) }; Spacer(); Button("閉じる") { selected = nil }.buttonStyle(.bordered) }
            if let imageURL = item.imageURL, let url = URL(string: imageURL) { AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { ProgressView() }.frame(maxHeight: 280) }
            if let description = item.description, !description.isEmpty { Text(description).textSelection(.enabled) }
            ForEach(item.links ?? []) { link in if let url = URL(string: link.url) { Link(link.label.isEmpty ? link.url : link.label, destination: url).font(.caption) } }
        }
    }
    private func load() { Task { state = .loading; do { rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSCultureItem.self, table: "jp_culture_items", select: "id,title,description,category_path,prefecture,city,links,image_url,sort_weight", filters: ["status": "eq.active"], order: "sort_weight.desc", limit: 1_000); state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
}

private struct AMDOSAdminAgreementRow: Codable, Identifiable, Sendable { let member: AMDOSAdminAgreementMember; let status: String; let revisionRequestCount: Int; let latestRevisionRequestAt: String?; let projectCount: Int; let reviewRequiredCount: Int; let expectedRewardYen: Double; let payoutYen: Double; let stockYen: Double; let projectNames: [String]; var id: String { member.memberId } }
private struct AMDOSAdminAgreementMember: Codable, Sendable { let memberId: String; let codeName: String; let email: String?; enum CodingKeys: String, CodingKey { case memberId, codeName, email } }
private struct AMDOSAdminAgreementData: Codable, Sendable { let ym: String; let tableReady: Bool; let rows: [AMDOSAdminAgreementRow]; let totals: AMDOSAdminAgreementTotals }
private struct AMDOSAdminAgreementTotals: Codable, Sendable { let members: Int; let agreed: Int; let pending: Int; let needsReagreement: Int; let reviewRequired: Int; let revisionRequests: Int; let expectedRewardYen: Double; let payoutYen: Double; let stockYen: Double }
private struct AMDOSAdminAgreementEnvelope: Codable, Sendable { let ok: Bool; let data: AMDOSAdminAgreementData?; let error: String? }
struct AMDOSAdminMonthlyAgreementsView: View { @State private var ym = ""; @State private var data: AMDOSAdminAgreementData?; @State private var state: AMDOSFeatureLoadState = .idle; var body: some View { AMDOSPageScaffold(eyebrow: "MONTHLY AGREEMENTS", title: "月初合意管理", subtitle: "PWA admin monthly-work-agreementsのメンバー別状態・再合意・レビュー件数") { HStack { TextField("YYYYMM", text: $ym).textFieldStyle(.roundedBorder); Button("再取得") { load() } }; AMDOSStateNotice(state: state) { load() }; if let data { HStack { AMDOSMetricTile(label: "合意済み", value: "\(data.totals.agreed)", detail: "\(data.totals.members)人中"); AMDOSMetricTile(label: "再合意", value: "\(data.totals.needsReagreement)", detail: "要対応", tint: AMDOSDesign.warning); AMDOSMetricTile(label: "レビュー", value: "\(data.totals.reviewRequired)", detail: "要確認") }; ForEach(data.rows) { row in AMDOSCard { HStack { VStack(alignment: .leading) { Text(row.member.codeName).font(.headline); Text(row.member.email ?? row.member.memberId).font(.caption); Text(row.projectNames.joined(separator: " / ")).font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); AMDOSStatusBadge(text: row.status, tint: row.status == "agreed" ? AMDOSDesign.success : AMDOSDesign.warning); Text("PJ \(row.projectCount) · 再依頼 \(row.revisionRequestCount)").font(.caption) } } } } }.task { if ym.isEmpty { ym = currentAdminYM() }; load() } }; private func currentAdminYM() -> String { let d = Date(); let c = Calendar.current; return String(c.component(.year, from: d)) + String(format: "%02d", c.component(.month, from: d)) }; private func load() { Task { guard ym.count == 6 else { return }; state = .loading; do { let e = try await AMDOSRESTClient.shared.fetchPWA(AMDOSAdminAgreementEnvelope.self, path: "/api/admin/monthly-work-agreements", query: ["ym": ym]); data = e.data; state = (data?.rows ?? []).isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } } }

private struct AMDOSWikiEntry: Codable, Identifiable, Sendable { let id: String; let personName: String; let personKind: String; let affiliation: String?; let relationshipContext: String?; let memoBody: String; let status: String; let updatedAt: String?; enum CodingKeys: String, CodingKey { case id, personName = "person_name", personKind = "person_kind", affiliation, relationshipContext = "relationship_context", memoBody = "memo_body", status, updatedAt = "updated_at" } }
private struct AMDOSWikiPayload: Encodable, Sendable { let personName: String; let personKind: String; let affiliation: String?; let relationshipContext: String?; let memoBody: String; let sourceKind: String; let confidence: Double; let status: String; enum CodingKeys: String, CodingKey { case personName, personKind, affiliation, relationshipContext, memoBody, sourceKind, confidence, status } }
struct AMDOSAdminPrivateWikiView: View { @State private var rows: [AMDOSWikiEntry] = []; @State private var name = ""; @State private var kind = "external_collaborator"; @State private var affiliation = ""; @State private var relationship = ""; @State private var memo = ""; @State private var state: AMDOSFeatureLoadState = .idle; @State private var message: String?; var body: some View { AMDOSPageScaffold(eyebrow: "PRIVATE WIKI", title: "人物メモ", subtitle: "PWA admin/private-wikiのadmin_private境界で人物情報を作成・確認") { AMDOSSectionCard("新しい人物メモ", systemImage: "person.crop.circle.badge.plus") { AMDOSTextField(title: "氏名", text: $name); Picker("人物種別", selection: $kind) { Text("外部協力者").tag("external_collaborator"); Text("メンバー").tag("amd_member"); Text("顧客").tag("client"); Text("研究者").tag("researcher") }; AMDOSTextField(title: "所属", text: $affiliation); AMDOSTextField(title: "関係性", text: $relationship); AMDOSTextField(title: "本文", text: $memo, axis: .vertical); Button("保存") { save() }.buttonStyle(.borderedProminent); AMDOSAdminInlineMessage(text: message) }; AMDOSStateNotice(state: state) { load() }; ForEach(rows) { row in AMDOSSectionCard(row.personName, systemImage: "person.crop.circle") { Text([row.personKind, row.affiliation, row.relationshipContext].compactMap { $0 }.joined(separator: " · ")).font(.caption); Text(row.memoBody).textSelection(.enabled); AMDOSStatusBadge(text: row.status) } } }.task { load() } }; private func load() { Task { state = .loading; do { let e = try await AMDOSRESTClient.shared.fetchPWA(AMDOSWikiEnvelope.self, path: "/api/admin/private-wiki"); rows = e.entries; state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }; private func save() { Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/private-wiki", body: AMDOSWikiPayload(personName: name, personKind: kind, affiliation: affiliation.trimmedNonEmpty, relationshipContext: relationship.trimmedNonEmpty, memoBody: memo, sourceKind: "manual", confidence: 0.5, status: "active")); message = "人物メモを保存したよ"; await load() } catch { message = error.localizedDescription } } } }
private struct AMDOSWikiEnvelope: Codable, Sendable { let ok: Bool; let entries: [AMDOSWikiEntry] }

private struct AMDOSAdminKnowledgeEntry: Codable, Identifiable, Sendable { let id: String; let title: String; let category: String; let maturity: String; let tags: [String]; let summary: String; let bodyMd: String?; let reusableWhen: String?; let nextCheck: String?; let status: String; enum CodingKeys: String, CodingKey { case id, title, category, maturity, tags, summary, bodyMd = "body_md", reusableWhen = "reusable_when", nextCheck = "next_check", status } }
private struct AMDOSKnowledgeEnvelope: Codable, Sendable { let ok: Bool; let entries: [AMDOSAdminKnowledgeEntry] }
private struct AMDOSKnowledgePayload: Encodable, Sendable { let title: String; let category: String; let maturity: String; let tags: [String]; let summary: String; let bodyMd: String; let reusableWhen: String?; let nextCheck: String?; let sourceKind: String; let confidence: Double; let status: String; enum CodingKeys: String, CodingKey { case title, category, maturity, tags, summary, bodyMd, reusableWhen, nextCheck, sourceKind, confidence, status } }
struct AMDOSAdminManagementKnowledgeView: View { @State private var rows: [AMDOSAdminKnowledgeEntry] = []; @State private var title = ""; @State private var category = "other"; @State private var maturity = "hypothesis"; @State private var tags = ""; @State private var summary = ""; @State private var bodyText = ""; @State private var state: AMDOSFeatureLoadState = .idle; @State private var message: String?; var body: some View { AMDOSPageScaffold(eyebrow: "MANAGEMENT KNOWLEDGE", title: "経営ナレッジ", subtitle: "PWA management-knowledgeの分類・成熟度・再利用条件と本文を保存") { AMDOSSectionCard("新規ナレッジ", systemImage: "books.vertical") { AMDOSTextField(title: "タイトル", text: $title); Picker("カテゴリ", selection: $category) { Text("営業").tag("sales"); Text("財務").tag("finance"); Text("運営").tag("operations"); Text("その他").tag("other") }; Picker("成熟度", selection: $maturity) { Text("仮説").tag("hypothesis"); Text("現場検証済み").tag("field_tested"); Text("プレイブック").tag("playbook") }; AMDOSTextField(title: "タグ", text: $tags); AMDOSTextField(title: "要約", text: $summary, axis: .vertical); AMDOSTextField(title: "本文Markdown", text: $bodyText, axis: .vertical); Button("保存") { save() }.buttonStyle(.borderedProminent); AMDOSAdminInlineMessage(text: message) }; AMDOSStateNotice(state: state) { load() }; ForEach(rows) { row in AMDOSSectionCard(row.title, systemImage: "book.closed") { Text("\(row.category) · \(row.maturity) · \(row.tags.joined(separator: ", "))").font(.caption); Text(row.summary); Text(row.bodyMd ?? "").lineLimit(6); AMDOSStatusBadge(text: row.status) } } }.task { load() } }; private func load() { Task { state = .loading; do { let e = try await AMDOSRESTClient.shared.fetchPWA(AMDOSKnowledgeEnvelope.self, path: "/api/admin/management-knowledge"); rows = e.entries; state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }; private func save() { Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/management-knowledge", body: AMDOSKnowledgePayload(title: title, category: category, maturity: maturity, tags: tags.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }, summary: summary, bodyMd: bodyText, reusableWhen: nil, nextCheck: nil, sourceKind: "manual", confidence: 0.5, status: "active")); message = "ナレッジを保存したよ"; await load() } catch { message = error.localizedDescription } } } }

private struct AMDOSPrompt: Codable, Identifiable, Sendable { let id: String; let key: String; let description: String?; let body: String; let model: String?; let maxTokens: Int?; let isActive: Bool; let notes: String?; let updatedAt: String?; enum CodingKeys: String, CodingKey { case id, key = "prompt_key", description, body, model, maxTokens = "max_tokens", isActive = "is_active", notes, updatedAt = "updated_at" } }
private struct AMDOSPromptPatch: Encodable, Sendable { let body: String; let description: String?; let model: String?; let maxTokens: Int?; let isActive: Bool; let notes: String?; enum CodingKeys: String, CodingKey { case body, description, model, maxTokens, isActive, notes } }
struct AMDOSAdminPromptsView: View { @State private var rows: [AMDOSPrompt] = []; @State private var selected: AMDOSPrompt?; @State private var draft = ""; @State private var active = false; @State private var state: AMDOSFeatureLoadState = .idle; @State private var message: String?; var body: some View { AMDOSPageScaffold(eyebrow: "PROMPTS", title: "LLMプロンプト", subtitle: "llm_promptsをprompt_key単位で読み、既存のadmin PATCHへ保存") { AMDOSStateNotice(state: state) { load() }; ForEach(rows) { row in Button { selected = row; draft = row.body; active = row.isActive } label: { AMDOSSectionCard(row.key, systemImage: "text.bubble") { Text(row.description ?? "説明なし"); Text("\(row.model ?? "モデル未設定") · max \(row.maxTokens.map(String.init) ?? "—")").font(.caption).foregroundStyle(AMDOSDesign.muted); AMDOSStatusBadge(text: row.isActive ? "active" : "inactive") } }.buttonStyle(.plain) }; if let selected { AMDOSSectionCard("\(selected.key) を編集", systemImage: "pencil") { AMDOSTextField(title: "本文", text: $draft, axis: .vertical); Toggle("有効", isOn: $active); Button("PATCH保存") { save(selected.id) }.buttonStyle(.borderedProminent); AMDOSAdminInlineMessage(text: message) } } }.task { load() } }; private func load() { Task { state = .loading; do { rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSPrompt.self, table: "llm_prompts", select: "id,prompt_key,description,body,model,max_tokens,is_active,notes,updated_at", order: "prompt_key", limit: 500); state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }; private func save(_ id: String) { Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/prompts/\(id)", method: "PATCH", body: AMDOSPromptPatch(body: draft, description: selected?.description, model: selected?.model, maxTokens: selected?.maxTokens, isActive: active, notes: selected?.notes)); message = "プロンプトを保存したよ"; await load() } catch { message = error.localizedDescription } } } }

private struct AMDOSProtocol: Codable, Identifiable, Sendable {
    let id: String; let protocolId: String; let title: String; let projectId: String?; let content: String?; let branchPoint: String?; let criteria: String?; let actionTaken: String?; let tags: String?; let importance: Int?; let source: String?; let sourceType: String?; let status: String; let kind: String?; let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id, title, content, criteria, tags, importance, source, status, kind; case protocolId = "protocol_id"; case projectId = "project_id"; case branchPoint = "branch_point"; case actionTaken = "action_taken"; case sourceType = "source_type"; case updatedAt = "updated_at" }
}
private struct AMDOSProtocolExample: Codable, Identifiable, Sendable {
    let id: String; let protocolId: String; let projectId: String?; let occurredOn: String?; let summary: String?; let branchPoint: String?; let criteria: String?; let actionTaken: String?; let result: String?; let sourceMeetingId: String?
    enum CodingKeys: String, CodingKey { case id, summary, criteria, result; case protocolId = "protocol_id"; case projectId = "project_id"; case occurredOn = "occurred_on"; case branchPoint = "branch_point"; case actionTaken = "action_taken"; case sourceMeetingId = "source_meeting_id" }
}
private struct AMDOSProtocolObservation: Codable, Identifiable, Sendable {
    let id: String; let protocolId: String; let projectId: String?; let observedOn: String; let horizon: String; let valence: String; let confidence: String; let summary: String; let evidenceSourceType: String?; let evidenceSourceId: String?
    enum CodingKeys: String, CodingKey { case id, horizon, valence, confidence, summary; case protocolId = "protocol_id"; case projectId = "project_id"; case observedOn = "observed_on"; case evidenceSourceType = "evidence_source_type"; case evidenceSourceId = "evidence_source_id" }
}
private struct AMDOSProtocolStatusPatch: Encodable, Sendable { let status: String; let updatedAt: String; enum CodingKeys: String, CodingKey { case status; case updatedAt = "updated_at" } }
private struct AMDOSProtocolCreate: Encodable, Sendable {
    let protocolId: String; let title: String; let projectId: String?; let content: String; let tags: String?; let importance: Int; let source: String; let status: String; let kind: String; let isUniversal: Bool; let createdAt: String; let updatedAt: String
    enum CodingKeys: String, CodingKey { case title, content, tags, importance, source, status, kind; case protocolId = "protocol_id"; case projectId = "project_id"; case isUniversal = "is_universal"; case createdAt = "created_at"; case updatedAt = "updated_at" }
}
struct AMDOSAdminProtocolsView: View {
    @State private var protocols: [AMDOSProtocol] = []; @State private var examples: [AMDOSProtocolExample] = []; @State private var observations: [AMDOSProtocolObservation] = []; @State private var projects: [AMDOSAdminProject] = []
    @State private var statusFilter = ""; @State private var projectFilter = ""; @State private var searchText = ""; @State private var expanded: Set<String> = []; @State private var createOpen = false
    @State private var title = ""; @State private var draftProjectId = ""; @State private var tags = ""; @State private var importance = 1; @State private var draftStatus = "candidate"; @State private var branchPoint = ""; @State private var criteria = ""; @State private var actionTaken = ""; @State private var revisionDraft = ""
    @State private var state: AMDOSFeatureLoadState = .idle; @State private var message: String?; @State private var legacyArchiveConfirmation = false
    private let statuses = ["candidate", "confirmed", "archived"]
    private var filtered: [AMDOSProtocol] { protocols.filter { row in
        guard (statusFilter.isEmpty || row.status == statusFilter), (projectFilter.isEmpty || row.projectId == projectFilter) else { return false }
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines); return q.isEmpty || [row.title, row.tags, row.criteria, row.branchPoint].compactMap { $0 }.joined(separator: " ").localizedCaseInsensitiveContains(q)
    } }
    private var mainRows: [AMDOSProtocol] { filtered.filter { $0.kind != "legacy_specific" || $0.status == "archived" } }
    private var legacyRows: [AMDOSProtocol] { filtered.filter { $0.kind == "legacy_specific" && $0.status != "archived" } }
    var body: some View { AMDOSPageScaffold(eyebrow: "PROTOCOLS", title: "AMDプロトコル", subtitle: "PWAと同じ候補・確定・アーカイブ、具体事例、結果観測をここで扱う") {
        AMDOSSectionCard("絞り込み", systemImage: "line.3.horizontal.decrease.circle") { HStack { Picker("status", selection: $statusFilter) { Text("すべて").tag(""); ForEach(statuses, id: \.self) { Text($0).tag($0) } }; Picker("PJ", selection: $projectFilter) { Text("すべて").tag(""); ForEach(projects) { Text($0.name).tag($0.id) } }; Button("リセット") { statusFilter = ""; projectFilter = ""; searchText = "" }; Spacer(); Button("＋ 追加") { createOpen.toggle() }.buttonStyle(.borderedProminent) }; TextField("タイトル / tags / 基準を検索", text: $searchText).textFieldStyle(.roundedBorder) }
        AMDOSStateNotice(state: state) { load() }; AMDOSAdminInlineMessage(text: message)
        if createOpen { createForm }
        Text("新形式 (pattern) \(mainRows.count) 件" + (legacyRows.isEmpty ? "" : " ／ 旧形式 \(legacyRows.count) 件")).font(.caption).foregroundStyle(AMDOSDesign.muted)
        if mainRows.isEmpty && legacyRows.isEmpty && state == .loaded { ContentUnavailableView("該当するプロトコルはないよ", systemImage: "list.number") }
        ForEach(mainRows) { protocolCard($0, legacy: false) }
        if !legacyRows.isEmpty { AMDOSSectionCard("旧形式 (legacy_specific) \(legacyRows.count) 件", systemImage: "exclamationmark.triangle") { Text("PWAと同じく、新形式の候補とは分けて扱うよ。再抽出するか、まとめてアーカイブできる。").font(.caption); Button("全部 archive", role: .destructive) { legacyArchiveConfirmation = true }.buttonStyle(.bordered); ForEach(legacyRows) { protocolCard($0, legacy: true) } } }
        if !revisionDraft.isEmpty { AMDOSSectionCard("つくよみへの修正依頼", systemImage: "moon.stars") { AMDOSTextField(title: "依頼内容", text: $revisionDraft, axis: .vertical); Button("つくよみに送る") { askRevision() }.buttonStyle(.borderedProminent) } }
    }.task { load() }.confirmationDialog("旧形式のプロトコルをアーカイブする？", isPresented: $legacyArchiveConfirmation, titleVisibility: .visible) { Button("\(legacyRows.count) 件をアーカイブ", role: .destructive) { archiveLegacy() } } message: { Text("kind=legacy_specific の未アーカイブ分だけを対象にするよ。") } }
    private var createForm: some View { AMDOSSectionCard("Protocol 追加", systemImage: "plus.circle") { AMDOSTextField(title: "タイトル *", text: $title); Picker("PJ", selection: $draftProjectId) { Text("なし").tag(""); ForEach(projects) { Text($0.name).tag($0.id) } }; AMDOSTextField(title: "tags（カンマ区切り）", text: $tags); Picker("importance", selection: $importance) { Text("★").tag(1); Text("★★").tag(2); Text("★★★").tag(3) }; Picker("status", selection: $draftStatus) { ForEach(statuses, id: \.self) { Text($0).tag($0) } }; AMDOSTextField(title: "判断の分岐点", text: $branchPoint, axis: .vertical); AMDOSTextField(title: "判断基準", text: $criteria, axis: .vertical); AMDOSTextField(title: "アクション", text: $actionTaken, axis: .vertical); HStack { Button("作成") { create() }.buttonStyle(.borderedProminent); Button("キャンセル") { resetCreate() }.buttonStyle(.bordered) } } }
    @ViewBuilder private func protocolCard(_ row: AMDOSProtocol, legacy: Bool) -> some View { let isExpanded = expanded.contains(row.id); AMDOSSectionCard(row.title, systemImage: legacy ? "archivebox" : "list.number") { HStack { AMDOSStatusBadge(text: row.status); if let importance = row.importance { Text(String(repeating: "★", count: importance)).foregroundStyle(AMDOSDesign.warning) }; if let project = projects.first(where: { $0.id == row.projectId }) { Text(project.name).font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); if row.status != "confirmed" { Button("確定") { update(row, status: "confirmed") }.buttonStyle(.borderedProminent) }; if row.status == "candidate" { Button("修正依頼") { prepareRevision(row) }.buttonStyle(.bordered); Button("却下", role: .destructive) { update(row, status: "rejected") }.buttonStyle(.bordered) }; if row.status != "archived" { Button("archive") { update(row, status: "archived") }.buttonStyle(.bordered) } }; if let tags = row.tags, !tags.isEmpty { Text(tags).font(.caption).foregroundStyle(AMDOSDesign.muted) }; if !isExpanded { Text((row.content ?? row.criteria ?? "").replacingOccurrences(of: "**", with: "")).lineLimit(2).font(.caption).foregroundStyle(AMDOSDesign.muted) }; Button(isExpanded ? "詳細を閉じる" : "詳細を見る") { toggle(row.id) }.buttonStyle(.plain).foregroundStyle(AMDOSDesign.blue); if isExpanded { details(row) } } }
    @ViewBuilder private func details(_ row: AMDOSProtocol) -> some View { if let content = row.content, !content.isEmpty { Text(content).textSelection(.enabled) } else { if let value = row.branchPoint, !value.isEmpty { AMDOSLineItem(title: "1 分岐点", subtitle: value, status: "") }; if let value = row.criteria, !value.isEmpty { AMDOSLineItem(title: "2 判断材料", subtitle: value, status: "") }; if let value = row.actionTaken, !value.isEmpty { AMDOSLineItem(title: "3 アクション", subtitle: value, status: "") } }; let relatedExamples = examples.filter { $0.protocolId == row.protocolId }; Text("関連事例 (\(relatedExamples.count))").font(.subheadline.weight(.semibold)); ForEach(relatedExamples) { item in AMDOSLineItem(title: item.summary ?? item.id, subtitle: [item.occurredOn, item.projectId, item.branchPoint, item.criteria, item.actionTaken, item.result, item.sourceMeetingId].compactMap { $0 }.joined(separator: " · "), status: "事例") }; let relatedObservations = observations.filter { $0.protocolId == row.protocolId }; Text("結果観測 ledger (\(relatedObservations.count))").font(.subheadline.weight(.semibold)); if relatedObservations.isEmpty { Text("outcome ledger はまだ空だよ。PWAと同じく、ここでは既存観測の上書きや追加はしない。").font(.caption).foregroundStyle(AMDOSDesign.muted) }; ForEach(relatedObservations) { item in AMDOSLineItem(title: item.summary, subtitle: [item.observedOn, item.horizon, item.valence, item.confidence, item.projectId, item.evidenceSourceType, item.evidenceSourceId].compactMap { $0 }.joined(separator: " · "), status: "観測") }; Text("ID: \(row.protocolId) / source: \(row.source ?? row.sourceType ?? "—") / kind: \(row.kind ?? "—") / updated: \(row.updatedAt ?? "—")").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
    private func load() { Task { state = .loading; do { async let p = AMDOSRESTClient.shared.fetchTable(AMDOSProtocol.self, table: "protocols", select: "id,protocol_id,title,project_id,content,tags,importance,source,status,kind,updated_at", order: "updated_at.desc", limit: 500); async let e = AMDOSRESTClient.shared.fetchTable(AMDOSProtocolExample.self, table: "protocol_examples", select: "id,protocol_id,project_id,occurred_on,summary,branch_point,criteria,action_taken,result,source_meeting_id", order: "occurred_on.desc", limit: 2_000); async let o = AMDOSRESTClient.shared.fetchTable(AMDOSProtocolObservation.self, table: "protocol_result_observations", select: "id,protocol_id,project_id,observed_on,horizon,valence,confidence,summary,evidence_source_type,evidence_source_id", order: "observed_on.desc", limit: 2_000); async let j = AMDOSRESTClient.shared.fetchTable(AMDOSAdminProject.self, table: "projects", select: "project_id,project_name,client_name,status,start_ym,end_ym", order: "project_name", limit: 1_000); protocols = try await p; examples = try await e; observations = try await o; projects = try await j; state = protocols.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
    private func update(_ row: AMDOSProtocol, status: String) { Task { do { _ = try await AMDOSRESTClient.shared.patchTable(table: "protocols", filters: ["id": "eq.\(row.id)"], body: AMDOSProtocolStatusPatch(status: status, updatedAt: ISO8601DateFormatter().string(from: Date()))); message = "\(row.title) → \(status)"; await load() } catch { message = error.localizedDescription } } }
    private func archiveLegacy() { Task { do { for row in legacyRows { try await AMDOSRESTClient.shared.patchTable(table: "protocols", filters: ["id": "eq.\(row.id)"], body: AMDOSProtocolStatusPatch(status: "archived", updatedAt: ISO8601DateFormatter().string(from: Date()))) }; message = "旧形式 \(legacyRows.count) 件を archive したよ"; await load() } catch { message = error.localizedDescription } } }
    private func prepareRevision(_ row: AMDOSProtocol) { revisionDraft = "次のプロトコル候補を修正して。\n\nタイトル: \(row.title)\nPJ: \(projects.first(where: { $0.id == row.projectId })?.name ?? row.projectId ?? "—")\n本文:\n\(row.content ?? row.criteria ?? "(本文なし)")\n\n修正点 (まさの意図を入れて再生成して):\n- ここに修正したい部分を書いて" }
    private func askRevision() { Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/tsukuyomi/chat", body: AMDOSTsukuyomiInput(message: revisionDraft, pagePath: "/admin/protocols")); message = "つくよみに修正依頼を送ったよ"; revisionDraft = "" } catch { message = error.localizedDescription } } }
    private func create() { let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines); guard !trimmed.isEmpty else { message = "title は必須だよ"; return }; Task { do { let now = ISO8601DateFormatter().string(from: Date()); let content = "## 1 分岐点\n\(branchPoint)\n\n## 2 判断材料\n\(criteria)\n\n## 3 アクション\n\(actionTaken)\n\n## 4 結果\n"; _ = try await AMDOSRESTClient.shared.postTable(table: "protocols", body: AMDOSProtocolCreate(protocolId: "PROT-\(Int(Date().timeIntervalSince1970 * 1000))", title: trimmed, projectId: draftProjectId.isEmpty ? nil : draftProjectId, content: content, tags: tags.trimmedNonEmpty, importance: importance, source: "manual", status: draftStatus, kind: "pattern", isUniversal: true, createdAt: now, updatedAt: now)); message = "\(trimmed) を作成したよ"; resetCreate(); await load() } catch { message = error.localizedDescription } } }
    private func toggle(_ id: String) { if expanded.contains(id) { expanded.remove(id) } else { expanded.insert(id) } }
    private func resetCreate() { createOpen = false; title = ""; draftProjectId = ""; tags = ""; importance = 1; draftStatus = "candidate"; branchPoint = ""; criteria = ""; actionTaken = "" }
}

private struct AMDOSAdminProject: Codable, Identifiable, Sendable { let id: String; let name: String; let clientName: String?; let status: String; let startYm: String?; let endYm: String?; enum CodingKeys: String, CodingKey { case id = "project_id", name = "project_name", clientName = "client_name", status, startYm = "start_ym", endYm = "end_ym" } }
/// Superseded by `AMDOSAdminProjectsView` in AdminProjectsMembersParityViews.swift.
/// The prior card-only view did not expose the PWA's project ledger or member
/// lifecycle operations.
private struct AMDOSAdminProjectsLegacyView: View { @State private var rows: [AMDOSAdminProject] = []; @State private var state: AMDOSFeatureLoadState = .idle; var body: some View { AMDOSPageScaffold(eyebrow: "ADMIN PROJECTS", title: "プロジェクト管理", subtitle: "projects正本の状態・期間・クライアントを管理画面の同じ一覧構造で確認") { AMDOSStateNotice(state: state) { load() }; ForEach(rows) { row in AMDOSSectionCard(row.name, systemImage: "folder") { Text(row.clientName ?? "クライアント未登録"); Text([row.startYm, row.endYm].compactMap { $0 }.joined(separator: " 〜 ")).font(.caption); AMDOSStatusBadge(text: row.status) } } }.task { load() } }; private func load() { Task { state = .loading; do { rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSAdminProject.self, table: "projects", select: "project_id,project_name,client_name,status,start_ym,end_ym", order: "project_name", limit: 1_000); state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } } }

private struct AMDOSAdminScheduleLatestAction: Codable, Sendable { let action: String; let reason: String?; let evidenceRef: String?; enum CodingKeys: String, CodingKey { case action, reason, evidenceRef = "evidence_ref" } }
private struct AMDOSAdminScheduleOccurrence: Codable, Identifiable, Sendable { let id: String; let title: String; let occurrenceDate: String?; let status: String?; let owner: String?; let ownerLabel: String?; let source: String?; let reason: String?; let latestAction: AMDOSAdminScheduleLatestAction?; enum CodingKeys: String, CodingKey { case id = "occurrence_id", title, occurrenceDate = "due_on", status = "computed_status", owner = "notification_owner", ownerLabel = "owner_label", source = "source_kind", reason = "missing_reason", latestAction = "latest_action" } }
private struct AMDOSAdminScheduleEnvelope: Codable, Sendable { let ok: Bool?; let meta: AMDOSScheduleMeta?; let occurrences: [AMDOSAdminScheduleOccurrence]?; let error: String? }
private struct AMDOSScheduleMeta: Codable, Sendable { let schemaReady: Bool?; let from: String?; let to: String?; enum CodingKeys: String, CodingKey { case schemaReady = "schemaReady", from, to } }
private struct AMDOSScheduleRebuild: Encodable, Sendable { let reason: String; let from: String?; let to: String? }
private struct AMDOSScheduleAction: Encodable, Sendable { let occurrenceId: String; let action: String; let evidenceRef: String?; let reason: String? }
struct AMDOSAdminScheduleView: View {
    @State private var data: AMDOSAdminScheduleEnvelope?
    @State private var rebuildReason = ""
    @State private var selected: AMDOSAdminScheduleOccurrence?
    @State private var actionReason = ""
    @State private var evidenceRef = ""
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?

    var body: some View {
        AMDOSPageScaffold(eyebrow: "SCHEDULE", title: "運営カレンダー", subtitle: "正本から再生成し、根拠を添えた行動履歴だけをPWA APIへ記録する") {
            AMDOSStateNotice(state: state) { load() }
            AMDOSSectionCard("正本から再生成", systemImage: "arrow.clockwise") {
                AMDOSTextField(title: "再生成理由（必須）", text: $rebuildReason, axis: .vertical)
                Button("元正本から再生成") { rebuild() }.buttonStyle(.bordered).disabled(rebuildReason.trimmedNonEmpty == nil)
            }
            if let data { ForEach(data.occurrences ?? []) { row in
                Button { openAction(row) } label: { AMDOSSectionCard(row.title, systemImage: "calendar") {
                    Text([row.occurrenceDate, row.ownerLabel ?? row.owner, row.source].compactMap { $0 }.joined(separator: " · "))
                    AMDOSStatusBadge(text: row.status ?? "未処理")
                    if let reason = row.reason, !reason.isEmpty { Text(reason).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    Text(row.owner == "payment_obligation" ? "支払義務の行動履歴はこの画面では変更できない" : "行動履歴を追加").font(.caption).foregroundStyle(AMDOSDesign.muted)
                } }.buttonStyle(.plain)
            } }
            AMDOSAdminInlineMessage(text: message)
        }.task { load() }
        .sheet(item: $selected) { row in actionSheet(row) }
    }

    @ViewBuilder private func actionSheet(_ row: AMDOSAdminScheduleOccurrence) -> some View {
        AMDOSPageScaffold(eyebrow: "OCCURRENCE", title: row.title, subtitle: [row.occurrenceDate, row.ownerLabel ?? row.owner, row.source].compactMap { $0 }.joined(separator: " · ")) {
            AMDOSStatusBadge(text: row.status ?? "未処理")
            if row.owner == "payment_obligation" { Text("PWAと同じく、支払義務の行動履歴はこの画面から追加できない。").foregroundStyle(AMDOSDesign.muted) }
            else {
                AMDOSTextField(title: "理由", text: $actionReason, axis: .vertical)
                AMDOSTextField(title: "根拠リンク / 参照先", text: $evidenceRef)
                Text("完了・対象外には理由または根拠が必要。再開は既存の行動履歴がある項目だけに記録できる。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                HStack { Button("完了にする") { action(row, "completed") }.buttonStyle(.borderedProminent).disabled(!hasEvidence); Button("対象外") { action(row, "not_applicable") }.buttonStyle(.bordered).disabled(!hasEvidence) }
                if row.latestAction != nil { Button("完了を取り消す（履歴を追記）") { action(row, "reopened") }.buttonStyle(.bordered) }
            }
        }
    }

    private var hasEvidence: Bool { actionReason.trimmedNonEmpty != nil || evidenceRef.trimmedNonEmpty != nil }
    private func openAction(_ row: AMDOSAdminScheduleOccurrence) { actionReason = ""; evidenceRef = ""; selected = row }
    private func load() { Task { state = .loading; do { data = try await AMDOSRESTClient.shared.fetchPWA(AMDOSAdminScheduleEnvelope.self, path: "/api/admin/schedule", query: ["from": "2026-01-01", "to": "2026-12-31"]); state = (data?.occurrences ?? []).isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
    private func rebuild() { guard let reason = rebuildReason.trimmedNonEmpty else { return }; Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/schedule/rebuild", body: AMDOSScheduleRebuild(reason: reason, from: data?.meta?.from, to: data?.meta?.to)); message = "カレンダーを再生成したよ"; await load() } catch { message = error.localizedDescription } } }
    private func action(_ row: AMDOSAdminScheduleOccurrence, _ value: String) { guard value == "reopened" || hasEvidence else { return }; Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/schedule/actions", body: AMDOSScheduleAction(occurrenceId: row.id, action: value, evidenceRef: evidenceRef.trimmedNonEmpty, reason: actionReason.trimmedNonEmpty)); message = "行動履歴を追加したよ"; selected = nil; await load() } catch { message = error.localizedDescription } } }
}

private struct AMDOSSeasonRow: Codable, Identifiable, Sendable {
    let planCycleId: String; let projectId: String; let projectName: String; let clientName: String?; let status: String; let periodStartYm: String; let periodEndYm: String; let invoiceTotalYen: Double; let bufferTotalYen: Double; let memberBudgetYen: Double; let amdMarginYen: Double; let totalPoints: Double; let ptUnitYen: Double; let closes: Bool; let ptFullyAssigned: Bool; let unassignedPt: Double; let budgetMatchesMonthlyCaps: Bool; let budgetVsMonthlyCapsDeltaYen: Double; let ptUnitConsistent: Bool; let officerStockConverges: Bool; let hasWarning: Bool
    var id: String { planCycleId }
}
private struct AMDOSSeasonBuffer: Codable, Identifiable, Sendable { let label: String; let amount: Double; var id: String { label } }
private struct AMDOSSeasonMember: Codable, Identifiable, Sendable { let memberId: String; let memberName: String; let isOfficer: Bool; let earnedPt: Double; let extraEarnedPt: Double; let budgetShareYen: Double; let extraBudgetShareYen: Double; let paidYen: Double; let finalStockYen: Double; let convergenceDeltaYen: Double; var id: String { memberId } }
private struct AMDOSSeasonChecks: Codable, Sendable { let closes: Bool; let closeDeltaYen: Double; let ptFullyAssigned: Bool; let unassignedPt: Double; let unownedMilestones: [String]; let budgetMatchesMonthlyCaps: Bool; let budgetVsMonthlyCapsDeltaYen: Double; let ptUnitConsistent: Bool; let ptUnitExpected: Double; let officerStockConverges: Bool; let officerFinalStockYen: Double }
private struct AMDOSSeasonDetail: Codable, Sendable {
    let planCycleId: String; let projectId: String; let projectName: String; let clientName: String?; let status: String; let periodStartYm: String; let periodEndYm: String; let cycleMonths: Int; let invoiceTotalYen: Double; let invoiceConfirmedYen: Double; let bufferItems: [AMDOSSeasonBuffer]; let bufferTotalYen: Double; let bufferBreakdownSet: Bool; let memberBudgetYen: Double; let amdMarginYen: Double; let monthlyCapsSumYen: Double; let totalPoints: Double; let msPointsSum: Double; let ptUnitYen: Double; let regularPtUnitYen: Double; let extraPtUnitYen: Double; let extraPoolBudgetYen: Double; let extraPointsSum: Double; let earnedPtSum: Double; let members: [AMDOSSeasonMember]; let paidSumYen: Double; let finalStockSumYen: Double; let checks: AMDOSSeasonChecks
}
private struct AMDOSSeasonListEnvelope: Codable, Sendable { let ok: Bool; let rows: [AMDOSSeasonRow]?; let error: String? }
private struct AMDOSSeasonDetailEnvelope: Codable, Sendable { let ok: Bool; let detail: AMDOSSeasonDetail?; let error: String? }
struct AMDOSAdminSeasonPLView: View {
    let onOpenMypage: (String) -> Void
    @State private var rows: [AMDOSSeasonRow] = []
    @State private var detail: AMDOSSeasonDetail?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    init(onOpenMypage: @escaping (String) -> Void = { _ in }) { self.onOpenMypage = onOpenMypage }
    var body: some View {
        AMDOSPageScaffold(eyebrow: "SEASON PL", title: "シーズン予実表", subtitle: "請求・バッファ・メンバー原資・AMDマージン・pt比予実をPWAと同じ検算で確認") {
            AMDOSStateNotice(state: state) { load() }
            if let message { AMDOSAdminInlineMessage(text: message) }
            if let detail { detailView(detail) } else { listView }
        }.task { load() }
    }
    @ViewBuilder private var listView: some View {
        ForEach(rows) { row in Button { loadDetail(row.planCycleId) } label: {
            AMDOSSectionCard(row.projectName, systemImage: "chart.bar") {
                HStack { Text("\(amdOSSeasonYM(row.periodStartYm))–\(amdOSSeasonYM(row.periodEndYm)) · \(amdOSSeasonPt(row.totalPoints))pt · \(row.status)").font(.caption).foregroundStyle(AMDOSDesign.muted); Spacer(); if row.hasWarning { AMDOSStatusBadge(text: "要確認", tint: .red) } }
                HStack { AMDOSMetricTile(label: "請求額", value: amdOSSeasonYen(row.invoiceTotalYen), detail: "バッファ \(amdOSSeasonYen(row.bufferTotalYen))"); AMDOSMetricTile(label: "メンバー原資", value: amdOSSeasonYen(row.memberBudgetYen), detail: "pt単価 \(amdOSSeasonYen(row.ptUnitYen))"); AMDOSMetricTile(label: "AMD", value: amdOSSeasonYen(row.amdMarginYen), detail: "margin") }
                HStack { AMDOSStatusBadge(text: row.closes ? "閉じ ✓" : "閉じ ✗", tint: row.closes ? AMDOSDesign.success : .red); AMDOSStatusBadge(text: row.ptFullyAssigned ? "未割当pt ✓" : "未割当 \(amdOSSeasonPt(row.unassignedPt))pt", tint: row.ptFullyAssigned ? AMDOSDesign.success : .red); AMDOSStatusBadge(text: row.budgetMatchesMonthlyCaps ? "原資=Σcap ✓" : "原資≠Σcap \(amdOSSeasonSignedYen(row.budgetVsMonthlyCapsDeltaYen))", tint: row.budgetMatchesMonthlyCaps ? AMDOSDesign.success : .red); AMDOSStatusBadge(text: row.ptUnitConsistent ? "pt単価 ✓" : "pt単価 ✗", tint: row.ptUnitConsistent ? AMDOSDesign.success : .red); AMDOSStatusBadge(text: row.officerStockConverges ? "役員収束 ✓" : "役員収束 ✗", tint: row.officerStockConverges ? AMDOSDesign.success : .red) }
            }
        }.buttonStyle(.plain) }
    }
    @ViewBuilder private func detailView(_ d: AMDOSSeasonDetail) -> some View {
        HStack { Button("← 一覧へ戻る") { detail = nil }.buttonStyle(.bordered); Spacer(); AMDOSStatusBadge(text: d.status) }
        AMDOSSectionCard("\(d.projectName) \(d.clientName ?? "")", systemImage: "checklist") {
            Text("\(d.planCycleId) · \(amdOSSeasonYM(d.periodStartYm))–\(amdOSSeasonYM(d.periodEndYm))（\(d.cycleMonths)ヶ月）").font(.caption).foregroundStyle(AMDOSDesign.muted)
            HStack { AMDOSStatusBadge(text: d.checks.closes ? "閉じ ✓" : "閉じ差 \(amdOSSeasonSignedYen(d.checks.closeDeltaYen))", tint: d.checks.closes ? AMDOSDesign.success : .red); AMDOSStatusBadge(text: d.checks.ptFullyAssigned ? "未割当pt ✓" : "未割当 \(amdOSSeasonPt(d.checks.unassignedPt))pt", tint: d.checks.ptFullyAssigned ? AMDOSDesign.success : .red); AMDOSStatusBadge(text: d.checks.budgetMatchesMonthlyCaps ? "原資=Σcap ✓" : "原資≠Σcap", tint: d.checks.budgetMatchesMonthlyCaps ? AMDOSDesign.success : .red); AMDOSStatusBadge(text: d.checks.ptUnitConsistent ? "pt単価 ✓" : "pt単価期待 \(amdOSSeasonYen(d.checks.ptUnitExpected))", tint: d.checks.ptUnitConsistent ? AMDOSDesign.success : .red); AMDOSStatusBadge(text: d.checks.officerStockConverges ? "役員収束 ✓" : "役員残 \(amdOSSeasonYen(d.checks.officerFinalStockYen))", tint: d.checks.officerStockConverges ? AMDOSDesign.success : .red) }
            if !d.checks.unownedMilestones.isEmpty { Text("担当未設定MS: \(d.checks.unownedMilestones.joined(separator: ", "))").font(.caption).foregroundStyle(.red) }
        }
        AMDOSSectionCard("① 収入 / ② 配分", systemImage: "banknote") { seasonLine("請求額 (予算)", amdOSSeasonYen(d.invoiceTotalYen)); seasonLine("入金確認済み (実績)", amdOSSeasonYen(d.invoiceConfirmedYen)); ForEach(d.bufferItems) { seasonLine("バッファ: \($0.label)", amdOSSeasonYen($0.amount)) }; seasonLine("バッファ合計", amdOSSeasonYen(d.bufferTotalYen)); seasonLine("メンバー原資", amdOSSeasonYen(d.memberBudgetYen)); seasonLine("AMDマージン", amdOSSeasonYen(d.amdMarginYen)) }
        AMDOSSectionCard("pt 単価 / 消化", systemImage: "sum") { seasonLine("総pt", "\(amdOSSeasonPt(d.totalPoints))pt"); seasonLine("MS points", "\(amdOSSeasonPt(d.msPointsSum))pt"); seasonLine("消化pt", "\(amdOSSeasonPt(d.earnedPtSum))pt"); seasonLine("pt単価", amdOSSeasonYen(d.ptUnitYen)); seasonLine("Σ月cap", amdOSSeasonYen(d.monthlyCapsSumYen)); seasonLine("原資 − Σ月cap", amdOSSeasonSignedYen(d.checks.budgetVsMonthlyCapsDeltaYen)) }
        AMDOSSectionCard("③ メンバー別 pt比予実", systemImage: "person.2") {
            ForEach(d.members) { member in
                Button { onOpenMypage(member.memberId) } label: {
                    HStack {
                        AMDOSLineItem(
                            title: member.memberName + (member.isOfficer ? " · 役員=会社留保" : ""),
                            subtitle: "\(amdOSSeasonPt(member.earnedPt))pt\(member.extraEarnedPt > 0 ? "（別\(amdOSSeasonPt(member.extraEarnedPt))pt）" : "") · 予算 \(amdOSSeasonYen(member.budgetShareYen))\(member.extraBudgetShareYen > 0 ? "（うち別財布 \(amdOSSeasonYen(member.extraBudgetShareYen))）" : "") · 実支払 \(amdOSSeasonYen(member.paidYen)) · 未払い \(amdOSSeasonYen(member.finalStockYen))",
                            status: amdOSSeasonSignedYen(member.convergenceDeltaYen)
                        )
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }
    private func seasonLine(_ label: String, _ value: String) -> some View { HStack { Text(label).foregroundStyle(AMDOSDesign.muted); Spacer(); Text(value).font(.body.monospacedDigit()) }.padding(.vertical, 2) }
    private func load() { Task { state = .loading; do { let e = try await AMDOSRESTClient.shared.fetchPWA(AMDOSSeasonListEnvelope.self, path: "/api/admin/season-pl"); rows = e.rows ?? []; state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
    private func loadDetail(_ id: String) { Task { state = .loading; do { let e = try await AMDOSRESTClient.shared.fetchPWA(AMDOSSeasonDetailEnvelope.self, path: "/api/admin/season-pl", query: ["planCycleId": id]); detail = e.detail; state = detail == nil ? .empty : .loaded } catch { message = error.localizedDescription; state = .failed(error.localizedDescription) } } }
}
private func amdOSSeasonYen(_ value: Double) -> String { "¥" + Int(value.rounded()).formatted(.number.locale(Locale(identifier: "ja_JP"))) }
private func amdOSSeasonSignedYen(_ value: Double) -> String { value == 0 ? "¥0" : (value < 0 ? "-" : "+") + amdOSSeasonYen(abs(value)) }
private func amdOSSeasonPt(_ value: Double) -> String { value.rounded() == value ? String(Int(value)) : String(format: "%.2f", value) }
private func amdOSSeasonYM(_ value: String) -> String { value.count == 6 ? "\(value.prefix(4))/\(value.suffix(2))" : value }

private struct AMDOSWeeklyMember: Codable, Identifiable, Sendable {
    let id: String; let codeName: String
    enum CodingKeys: String, CodingKey { case id = "memberId", codeName }
}
private struct AMDOSWeeklyProject: Codable, Identifiable, Sendable {
    let id: String; let name: String
    enum CodingKeys: String, CodingKey { case id = "projectId", name = "projectName" }
}
private struct AMDOSWeeklyActivity: Codable, Identifiable, Sendable {
    let id: String; let memberID: String; let projectID: String; let source: String; let sourceKind: String; let sourceURL: String?; let title: String; let contentPreview: String; let itemDate: String?
    enum CodingKeys: String, CodingKey { case id, source, sourceKind, title, contentPreview, itemDate; case memberID = "memberId"; case projectID = "projectId"; case sourceURL = "sourceUrl" }
}
private struct AMDOSWeeklyRewardCell: Codable, Identifiable, Sendable {
    let projectID: String; let memberID: String; let totalPay: Double
    var id: String { "\(memberID)::\(projectID)" }
    enum CodingKeys: String, CodingKey { case projectID = "projectId", memberID = "memberId", totalPay }
}
private struct AMDOSWeeklyEnvelope: Codable, Sendable {
    let ok: Bool; let weekStart: String; let weekEnd: String; let members: [AMDOSWeeklyMember]; let projects: [AMDOSWeeklyProject]; let activities: [AMDOSWeeklyActivity]; let rewardYm: String?; let rewards: [AMDOSWeeklyRewardCell]?; let error: String?
}
struct AMDOSAdminWeeklyView: View {
    let onOpenMypage: (String) -> Void
    @State private var data: AMDOSWeeklyEnvelope?
    @State private var weekStart = amdOSWeeklyCurrentMonday()
    @State private var state: AMDOSFeatureLoadState = .idle

    init(onOpenMypage: @escaping (String) -> Void = { _ in }) { self.onOpenMypage = onOpenMypage }

    private var offsetFromCurrent: Int { amdOSWeeklyWeeksBetween(weekStart, amdOSWeeklyCurrentMonday()) }
    private var canGoBack: Bool { offsetFromCurrent < 26 }
    private var canGoForward: Bool { offsetFromCurrent > 0 }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "WEEKLY", title: "週次活動", subtitle: "Gmail / Calendar / 議事録から抽出された活動を、PWA同様にPJ × メンバーで集約") {
            HStack {
                Button("◀ 前週") { weekStart = amdOSWeeklyShift(weekStart, by: -1); load() }.disabled(!canGoBack).buttonStyle(.bordered)
                Button("今週") { weekStart = amdOSWeeklyCurrentMonday(); load() }.disabled(offsetFromCurrent == 0).buttonStyle(.borderedProminent)
                Button("次週 ▶") { weekStart = amdOSWeeklyShift(weekStart, by: 1); load() }.disabled(!canGoForward).buttonStyle(.bordered)
                Spacer()
                Text(offsetFromCurrent == 0 ? "今週" : "\(offsetFromCurrent)週前").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            AMDOSStateNotice(state: state) { load() }
            if let data {
                summary(data)
                if data.projects.isEmpty {
                    AMDOSCard { Text("この週は member_weekly 活動データがないよ。週次抽出cronが走ると蓄積される。").foregroundStyle(AMDOSDesign.muted) }
                } else {
                    matrix(data)
                }
            }
        }.task { load() }
    }

    @ViewBuilder
    private func summary(_ data: AMDOSWeeklyEnvelope) -> some View {
        AMDOSCard {
            HStack(spacing: 16) {
                Text("\(amdOSWeeklyDisplayDate(data.weekStart)) 〜 \(amdOSWeeklyDisplayDate(data.weekEnd))").font(.headline)
                Text("活動 \(data.activities.count) 件")
                Text("PJ \(data.projects.count)")
                Text("メンバー \(activeMemberCount(data))/\(data.members.count)")
                Spacer()
                Text("\(amdOSWeeklyYmLabel(data.rewardYm))支払合計 \(amdOSWeeklyYen(grandReward(data)))").font(.subheadline.weight(.semibold)).foregroundStyle(AMDOSDesign.warning)
            }.font(.caption)
        }
    }

    @ViewBuilder
    private func matrix(_ data: AMDOSWeeklyEnvelope) -> some View {
        ScrollView(.horizontal) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 0) {
                    weeklyHeader("メンバー", width: 144)
                    ForEach(data.projects) { project in weeklyHeader("\(project.name)\n\(project.id)", width: 235) }
                    weeklyHeader("\(amdOSWeeklyYmLabel(data.rewardYm))報酬合計", width: 130)
                }
                ForEach(data.members) { member in
                    HStack(alignment: .top, spacing: 0) {
                        Button { onOpenMypage(member.id) } label: {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(member.codeName).font(.subheadline.weight(.semibold)).foregroundStyle(AMDOSDesign.blue)
                                Text(activityCount(member.id, data: data) == 0 ? "—" : "\(activityCount(member.id, data: data)) 件").font(.caption).foregroundStyle(AMDOSDesign.muted)
                            }
                            .frame(width: 144, alignment: .leading)
                            .padding(9)
                            .background(AMDOSDesign.panel)
                            .overlay(alignment: .trailing) { Divider() }
                        }
                        .buttonStyle(.plain)
                        ForEach(data.projects) { project in weeklyCell(member: member, project: project, data: data) }
                        weeklyTotal(reward(member.id, data: data)).frame(width: 130, alignment: .trailing).padding(9).background(AMDOSDesign.warning.opacity(0.06)).overlay(alignment: .leading) { Divider() }
                    }
                    Divider()
                }
                HStack(alignment: .top, spacing: 0) {
                    Text("PJ 報酬合計（\(amdOSWeeklyYmLabel(data.rewardYm))）").font(.caption.weight(.semibold)).frame(width: 144, alignment: .leading).padding(9).background(AMDOSDesign.warning.opacity(0.06)).overlay(alignment: .trailing) { Divider() }
                    ForEach(data.projects) { project in weeklyTotal(reward(project.id, projectTotal: true, data: data)).frame(width: 235, alignment: .trailing).padding(9).background(AMDOSDesign.warning.opacity(0.06)).overlay(alignment: .leading) { Divider() } }
                    weeklyTotal(grandReward(data)).frame(width: 130, alignment: .trailing).padding(9).background(AMDOSDesign.warning.opacity(0.12)).overlay(alignment: .leading) { Divider() }
                }
            }.overlay(RoundedRectangle(cornerRadius: 10).stroke(AMDOSDesign.border, lineWidth: 1))
        }
    }

    private func weeklyHeader(_ text: String, width: CGFloat) -> some View { Text(text).font(.caption.weight(.semibold)).lineLimit(2).frame(width: width, alignment: .leading).padding(9).background(AMDOSDesign.panel).overlay(alignment: .trailing) { Divider() } }

    @ViewBuilder
    private func weeklyCell(member: AMDOSWeeklyMember, project: AMDOSWeeklyProject, data: AMDOSWeeklyEnvelope) -> some View {
        let items = activities(member.id, project.id, data: data)
        let cellPay = reward(member.id, projectID: project.id, data: data)
        VStack(alignment: .leading, spacing: 7) {
            if cellPay > 0 { Text("\(amdOSWeeklyYmLabel(data.rewardYm)) \(amdOSWeeklyYen(cellPay))").font(.caption2.weight(.semibold)).foregroundStyle(AMDOSDesign.warning) }
            if items.isEmpty {
                if cellPay == 0 { Text("·").foregroundStyle(AMDOSDesign.border) }
            } else {
                ForEach(items.prefix(3)) { item in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack { AMDOSStatusBadge(text: amdOSWeeklySourceLabel(item.sourceKind.isEmpty ? item.source : item.source)); Spacer(); Text(amdOSWeeklyDisplayDate(item.itemDate)).font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                        if let url = item.sourceURL, let destination = URL(string: url) { Link(item.title, destination: destination).font(.caption.weight(.semibold)).lineLimit(2) } else { Text(item.title).font(.caption.weight(.semibold)).lineLimit(2) }
                        if !item.contentPreview.isEmpty { Text(item.contentPreview).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(2) }
                    }.padding(7).background(AMDOSDesign.panel).clipShape(RoundedRectangle(cornerRadius: 7))
                }
                if items.count > 3 { Text("ほか \(items.count - 3) 件").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
            }
        }.frame(width: 235, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
    }

    private func weeklyTotal(_ value: Double) -> some View { Text(value > 0 ? amdOSWeeklyYen(value) : "·").font(.caption.weight(value > 0 ? .semibold : .regular)).foregroundStyle(value > 0 ? AMDOSDesign.warning : AMDOSDesign.border) }
    private func activities(_ memberID: String, _ projectID: String, data: AMDOSWeeklyEnvelope) -> [AMDOSWeeklyActivity] { data.activities.filter { $0.memberID == memberID && $0.projectID == projectID } }
    private func activityCount(_ memberID: String, data: AMDOSWeeklyEnvelope) -> Int { data.activities.filter { $0.memberID == memberID }.count }
    private func activeMemberCount(_ data: AMDOSWeeklyEnvelope) -> Int { data.members.filter { activityCount($0.id, data: data) > 0 }.count }
    private func reward(_ memberID: String, projectID: String? = nil, data: AMDOSWeeklyEnvelope) -> Double { (data.rewards ?? []).filter { $0.memberID == memberID && (projectID == nil || $0.projectID == projectID) }.reduce(0) { $0 + $1.totalPay } }
    private func reward(_ projectID: String, projectTotal: Bool, data: AMDOSWeeklyEnvelope) -> Double { (data.rewards ?? []).filter { $0.projectID == projectID }.reduce(0) { $0 + $1.totalPay } }
    private func grandReward(_ data: AMDOSWeeklyEnvelope) -> Double { (data.rewards ?? []).reduce(0) { $0 + $1.totalPay } }
    private func load() { Task { state = .loading; do { data = try await AMDOSRESTClient.shared.fetchPWA(AMDOSWeeklyEnvelope.self, path: "/api/admin/weekly", query: ["weekStart": weekStart]); state = data?.members.isEmpty == true ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
}

private func amdOSWeeklyCurrentMonday() -> String { amdOSWeeklyShift(amdOSWeeklyDateString(Date()), by: 0, startingMonday: true) }
private func amdOSWeeklyDateString(_ date: Date) -> String { var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "Asia/Tokyo")!; let c = calendar.dateComponents([.year, .month, .day], from: date); return String(format: "%04d-%02d-%02d", c.year ?? 2000, c.month ?? 1, c.day ?? 1) }
private func amdOSWeeklyShift(_ key: String, by weeks: Int, startingMonday: Bool = false) -> String { let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "Asia/Tokyo"); f.dateFormat = "yyyy-MM-dd"; guard var date = f.date(from: key) else { return key }; var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "Asia/Tokyo")!; if startingMonday { let weekday = calendar.component(.weekday, from: date); date = calendar.date(byAdding: .day, value: -((weekday + 5) % 7), to: date) ?? date }; date = calendar.date(byAdding: .day, value: weeks * 7, to: date) ?? date; return f.string(from: date) }
private func amdOSWeeklyWeeksBetween(_ candidate: String, _ current: String) -> Int { let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "Asia/Tokyo"); f.dateFormat = "yyyy-MM-dd"; guard let a = f.date(from: candidate), let b = f.date(from: current) else { return 0 }; return max(0, Int((b.timeIntervalSince(a) / (7 * 86_400)).rounded())) }
private func amdOSWeeklyDisplayDate(_ value: String?) -> String { guard let value, value.count >= 10 else { return value ?? "" }; let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "Asia/Tokyo"); f.dateFormat = "yyyy-MM-dd"; guard let d = f.date(from: String(value.prefix(10))) else { return value }; var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "Asia/Tokyo")!; let c = calendar.dateComponents([.month, .day, .weekday], from: d); return "\(c.month ?? 0)/\(c.day ?? 0) (\(["日", "月", "火", "水", "木", "金", "土"][(c.weekday ?? 1) - 1]))" }
private func amdOSWeeklyYen(_ value: Double) -> String { let amount = Int(value.rounded()).formatted(.number.locale(Locale(identifier: "ja_JP"))); return "¥\(amount)" }
private func amdOSWeeklyYmLabel(_ ym: String?) -> String { guard let ym, ym.count == 6 else { return "今月" }; return "\(ym.prefix(4))年\(Int(ym.suffix(2)) ?? 0)月" }
private func amdOSWeeklySourceLabel(_ source: String) -> String { switch source { case "gmail", "gmail_message": return "Gmail"; case "calendar", "gmeet": return "Calendar"; case "meeting_summary": return "議事録"; default: return source.isEmpty ? "source" : source } }

private struct AMDOSAdminTodo: Codable, Identifiable, Sendable { let id: String; let title: String; let summary: String?; let detail: String?; let status: String; let priority: String?; let dueAt: String?; enum CodingKeys: String, CodingKey { case id, title, summary, detail, status, priority, dueAt = "due_at" } }
struct AMDOSAdminTsukuyomiView: View { @State private var todos: [AMDOSAdminTodo] = []; @State private var question = ""; @State private var answer: String?; @State private var state: AMDOSFeatureLoadState = .idle; var body: some View { AMDOSPageScaffold(eyebrow: "TSUKUYOMI", title: "つくよみ", subtitle: "管理ページのコンテキスト・学習・質問導線を、実在するPWA APIへ接続") { AMDOSStateNotice(state: state) { load() }; AMDOSTextField(title: "質問", text: $question, axis: .vertical); Button("つくよみに質問") { ask() }.buttonStyle(.borderedProminent); if let answer { AMDOSSectionCard("回答", systemImage: "moon.stars") { Text(answer).textSelection(.enabled) } }; ForEach(todos) { todo in AMDOSCard { HStack { VStack(alignment: .leading) { Text(todo.title).font(.headline); Text(todo.detail ?? todo.summary ?? ""); Text(todo.dueAt ?? "期限なし").font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); AMDOSStatusBadge(text: todo.priority ?? todo.status) } } } }.task { load() } }; private func load() { Task { state = .loading; do { todos = try await AMDOSRESTClient.shared.fetchTable(AMDOSAdminTodo.self, table: "proactive_todos", select: "id,title,detail,status,priority,due_at", filters: ["status": "in.(open,blocked)", "attention_state": "eq.approved", "attention_type": "in.(decision,masa_action)"], order: "due_at", limit: 200); state = todos.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }; private func ask() { Task { do { let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/tsukuyomi/chat", body: AMDOSTsukuyomiInput(message: question, pagePath: "/admin/tsukuyomi")); answer = String(data: data, encoding: .utf8); question = "" } catch { answer = error.localizedDescription } } } }
private struct AMDOSTsukuyomiInput: Encodable, Sendable { let message: String; let pagePath: String; enum CodingKeys: String, CodingKey { case message, pagePath = "page_path" } }

private struct AMDOSGovernanceProject: Codable, Identifiable, Sendable { let id: String; let name: String; enum CodingKeys: String, CodingKey { case id = "project_id", name = "project_name" } }
private struct AMDOSGovernanceProfile: Codable, Sendable { let legalName: String?; let representativeName: String?; let capitalYen: Double?; let fiscalYearEndMonth: Int?; enum CodingKeys: String, CodingKey { case legalName = "legal_name", representativeName = "representative_name", capitalYen = "capital_yen", fiscalYearEndMonth = "fiscal_year_end_month" } }
private struct AMDOSGovernanceShareholder: Codable, Identifiable, Sendable { let id: String; let holderName: String; let ownershipPct: Double?; let shares: Double?; enum CodingKeys: String, CodingKey { case id, holderName = "holder_name", ownershipPct = "ownership_pct", shares } }
private struct AMDOSGovernanceAction: Codable, Identifiable, Sendable {
    let actionID: String
    let title: String
    let category: String?
    let summary: String?
    let dueAt: String?
    let status: String
    let priority: String?
    let actionURL: String?
    let daysLeft: Int?
    var id: String { actionID }
    enum CodingKeys: String, CodingKey { case actionID = "action_id", title, category, summary, dueAt = "due_at", status, priority, actionURL = "action_url", daysLeft }
}
private struct AMDOSGovernanceEnvelope: Codable, Sendable { let ok: Bool; let profile: AMDOSGovernanceProfile?; let shareholders: [AMDOSGovernanceShareholder]; let actionItems: [AMDOSGovernanceAction]; let error: String? }
private struct AMDOSGovernancePost: Encodable, Sendable { let entity: String; let row: [String: AMDOSJSONScalar] }
private enum AMDOSJSONScalar: Encodable, Sendable { case string(String); case number(Double); func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); switch self { case .string(let v): try c.encode(v); case .number(let v): try c.encode(v) } } }
struct AMDOSAdminGovernanceView: View { let initialProjectId: String?; @State private var projects: [AMDOSGovernanceProject] = []; @State private var selectedProject = ""; @State private var data: AMDOSGovernanceEnvelope?; @State private var state: AMDOSFeatureLoadState = .idle; init(initialProjectId: String? = nil) { self.initialProjectId = initialProjectId }; var body: some View { AMDOSPageScaffold(eyebrow: "GOVERNANCE", title: "株主・ガバナンス", subtitle: "PWA governanceのプロジェクト選択・会社概要・株主・要対応を同じ認可経路で確認") { Picker("PJ", selection: $selectedProject) { Text("選んでね").tag(""); ForEach(projects) { Text($0.name).tag($0.id) } }.onChange(of: selectedProject) { _, _ in loadGovernance() }; AMDOSStateNotice(state: state) { loadGovernance() }; if let data { if let profile = data.profile { AMDOSSectionCard("会社概要", systemImage: "building.columns") { Text(profile.legalName ?? "法人名未登録"); Text(profile.representativeName ?? "代表者未登録"); Text("資本金 \(profile.capitalYen.map { "\(Int($0))円" } ?? "未登録") · 決算月 \(profile.fiscalYearEndMonth.map(String.init) ?? "未登録")") } }; AMDOSSectionCard("株主", systemImage: "person.3") { ForEach(data.shareholders) { row in AMDOSLineItem(title: row.holderName, subtitle: "株式 \(row.shares.map { String(Int($0)) } ?? "—")", status: row.ownershipPct.map { "\($0)%" }) } }; AMDOSSectionCard("要対応", systemImage: "checklist") { ForEach(data.actionItems) { AMDOSLineItem(title: $0.title, subtitle: [$0.category, $0.dueAt].compactMap { $0 }.joined(separator: " · "), status: $0.status) } } } }.task { loadProjects() } }; private func loadProjects() { Task { do { projects = try await AMDOSRESTClient.shared.fetchTable(AMDOSGovernanceProject.self, table: "projects", select: "project_id,project_name", order: "project_name", limit: 500); selectedProject = projects.contains(where: { $0.id == initialProjectId }) ? initialProjectId! : (selectedProject.isEmpty ? projects.first?.id ?? "" : selectedProject); loadGovernance() } catch { state = .failed(error.localizedDescription) } } }; private func loadGovernance() { guard !selectedProject.isEmpty else { return }; Task { state = .loading; do { data = try await AMDOSRESTClient.shared.fetchPWA(AMDOSGovernanceEnvelope.self, path: "/api/governance", query: ["projectId": selectedProject]); state = .loaded } catch { state = .failed(error.localizedDescription) } } } }

private struct AMDOSGov2Shareholder: Codable, Identifiable, Sendable {
    let id: String; let holderType: String?; let holderName: String; let shareClass: String?; let shares: Double?; let ownershipPct: Double?; let investedYen: Double?
    enum CodingKeys: String, CodingKey { case id, holderType = "holder_type", holderName = "holder_name", shareClass = "share_class", shares, ownershipPct = "ownership_pct", investedYen = "invested_yen" }
}
private struct AMDOSGov2Round: Codable, Identifiable, Sendable {
    let id: String; let roundName: String?; let roundDate: String?; let securityType: String?; let status: String?; let raisedYen: Double?; let preMoneyYen: Double?; let postMoneyYen: Double?; let pricePerShareYen: Double?; let leadInvestor: String?; let investors: [AMDOSGov2Investor]?; let amdContributionStatus: String?; let amdContributedYen: Double?; let amdContributionNote: String?
    enum CodingKeys: String, CodingKey { case id, roundName = "round_name", roundDate = "round_date", securityType = "security_type", status, raisedYen = "raised_yen", preMoneyYen = "pre_money_yen", postMoneyYen = "post_money_yen", pricePerShareYen = "price_per_share_yen", leadInvestor = "lead_investor", investors = "investors_json", amdContributionStatus = "amd_contribution_status", amdContributedYen = "amd_contributed_yen", amdContributionNote = "amd_contribution_note" }
}
private struct AMDOSGov2Investor: Codable, Sendable { let name: String?; let amountYen: Double?; let tranche: String?; let lead: Bool?; enum CodingKeys: String, CodingKey { case name, amountYen = "amount_yen", tranche, lead } }
private struct AMDOSGov2Resolution: Codable, Sendable { let title: String?; let result: String? }
private struct AMDOSGov2Attachment: Codable, Sendable { let name: String?; let url: String?; let webViewLink: String?; let webViewLinkSnake: String?; enum CodingKeys: String, CodingKey { case name, url, webViewLink = "webViewLink", webViewLinkSnake = "web_view_link" }; var link: String? { url ?? webViewLink ?? webViewLinkSnake } }
private struct AMDOSGov2Meeting: Codable, Identifiable, Sendable {
    let id: String; let meetingType: String?; let meetingDate: String?; let location: String?; let agendaSummary: String?; let resolutions: [AMDOSGov2Resolution]?; let attachments: [AMDOSGov2Attachment]?; let amdResponse: String?
    enum CodingKeys: String, CodingKey { case id, meetingType = "meeting_type", meetingDate = "meeting_date", location, agendaSummary = "agenda_summary", resolutions = "resolutions_json", attachments = "attachments_json", amdResponse = "amd_response" }
}
private struct AMDOSGov2Action: Codable, Identifiable, Sendable {
    let actionID: String; let title: String; let summary: String?; let category: String?; let dueAt: String?; let status: String; let priority: String?; let actionURL: String?
    var id: String { actionID }
    enum CodingKeys: String, CodingKey { case actionID = "action_id", title, summary, category, dueAt = "due_at", status, priority, actionURL = "action_url" }
}
private struct AMDOSGov2Envelope: Codable, Sendable { let ok: Bool; let shareholders: [AMDOSGov2Shareholder]; let rounds: [AMDOSGov2Round]; let meetings: [AMDOSGov2Meeting]; let actionItems: [AMDOSGov2Action]; let error: String? }
private struct AMDOSGov2Grant: Codable, Identifiable, Sendable {
    let id: String; let grantName: String; let agency: String?; let grantType: String?; let amountYen: Double?; let status: String; let isCurrent: Bool?; let adoptedDate: String?; let periodStartYm: String?; let periodEndYm: String?; let amdContributionStatus: String?; let amdContributedYen: Double?
    enum CodingKeys: String, CodingKey { case id, grantName = "grant_name", agency, grantType = "grant_type", amountYen = "amount_yen", status, isCurrent = "is_current", adoptedDate = "adopted_date", periodStartYm = "period_start_ym", periodEndYm = "period_end_ym", amdContributionStatus = "amd_contribution_status", amdContributedYen = "amd_contributed_yen" }
}
private struct AMDOSGov2GrantsEnvelope: Codable, Sendable { let ok: Bool; let grants: [AMDOSGov2Grant]?; let error: String? }
private indirect enum AMDOSGov2JSON: Encodable, Sendable { case string(String), number(Double), bool(Bool), null, object([String: AMDOSGov2JSON]), array([AMDOSGov2JSON]); func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); switch self { case .string(let v): try c.encode(v); case .number(let v): try c.encode(v); case .bool(let v): try c.encode(v); case .null: try c.encodeNil(); case .object(let v): try c.encode(v); case .array(let v): try c.encode(v) } } }
private struct AMDOSGov2Post: Encodable, Sendable { let entity: String; let row: [String: AMDOSGov2JSON] }
private struct AMDOSGov2GrantPost: Encodable, Sendable { let row: [String: AMDOSGov2JSON] }
private struct AMDOSGov2ActionPost: Encodable, Sendable { let projectID: String; let scope: String; let title: String; let category: String; let dueAt: String?; let actionURL: String?; enum CodingKeys: String, CodingKey { case projectID = "project_id", scope, title, category, dueAt = "due_at", actionURL = "action_url" } }
private struct AMDOSGov2Delete { let entity: String; let id: String; let title: String; let isGrant: Bool }
private struct AMDOSGov2Field: Identifiable { let key: String; let placeholder: String; var id: String { key } }
private struct AMDOSDivider: View { var body: some View { Divider() } }
private struct AMDOSGov2AddForm: View {
    let title: String; let fields: [AMDOSGov2Field]; let required: String; let submit: ([String: String]) -> Void
    @State private var values: [String: String] = [:]
    var body: some View { VStack(alignment: .leading, spacing: 6) { Text(title).font(.caption).foregroundStyle(AMDOSDesign.muted); ForEach(fields) { field in TextField(field.placeholder, text: binding(field.key)).textFieldStyle(.roundedBorder) }; Button("追加") { submit(values); values = [:] }.buttonStyle(.bordered).disabled((values[required] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) } }
    private func binding(_ key: String) -> Binding<String> { Binding(get: { values[key] ?? "" }, set: { values[key] = $0 }) }
}
private struct AMDOSGov2DeleteBody: Encodable, Sendable {}

struct AMDOSAdminGovernancePWAView: View {
    let initialProjectId: String?
    @State private var projects: [AMDOSGovernanceProject] = []
    @State private var selectedProject = ""
    @State private var data: AMDOSGov2Envelope?
    @State private var grants: [AMDOSGov2Grant] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var deleting: AMDOSGov2Delete?
    init(initialProjectId: String? = nil) { self.initialProjectId = initialProjectId }
    var body: some View {
        AMDOSPageScaffold(eyebrow: "GOVERNANCE", title: "株主・ガバナンス", subtitle: "PWAと同じ追加・削除操作を認可済みAPIへ委譲") {
            Picker("PJ", selection: $selectedProject) { ForEach(projects) { Text($0.name).tag($0.id) } }.onChange(of: selectedProject) { _, _ in load() }
            AMDOSStateNotice(state: state) { load() }
            AMDOSAdminInlineMessage(text: message)
            if let data { shareholders(data.shareholders); rounds(data.rounds); meetings(data.meetings); actions(data.actionItems); grantSection(grants) }
        }.task { loadProjects() }
        .confirmationDialog("削除する？", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })) { Button("削除", role: .destructive) { if let deleting { delete(deleting) } } } message: { Text(deleting?.title ?? "") }
    }
    @ViewBuilder private func shareholders(_ rows: [AMDOSGov2Shareholder]) -> some View { AMDOSSectionCard("株主構成（キャップテーブル）", systemImage: "person.3") { ForEach(rows) { row in HStack { AMDOSLineItem(title: row.holderName, subtitle: "\(row.holderType ?? "—") · \(row.shareClass ?? "—") · 株式 \(row.shares.map { String(Int($0)) } ?? "—") · 出資 \(row.investedYen.map(amdOSWeeklyYen) ?? "—")", status: row.ownershipPct.map { "\($0)%" }); Button("削除", role: .destructive) { deleting = .init(entity: "shareholder", id: row.id, title: row.holderName, isGrant: false) }.buttonStyle(.borderless) }; AMDOSDivider() }; AMDOSGov2AddForm(title: "株主を追加", fields: fields("holder_type|種別", "holder_name|株主名*", "share_class|株式種類", "shares|株数", "ownership_pct|比率%", "invested_yen|出資額(円)", "as_of_ym|時点YYYYMM"), required: "holder_name") { addShareholder($0) } } }
    @ViewBuilder private func rounds(_ rows: [AMDOSGov2Round]) -> some View {
        AMDOSSectionCard("資金調達ラウンド / 発行証券 / バリュエーション", systemImage: "banknote") {
            ForEach(rows) { row in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        AMDOSLineItem(title: row.roundName ?? "名称未入力", subtitle: "\(row.roundDate ?? "—") · \(row.securityType ?? "—") · 調達 \(row.raisedYen.map(amdOSWeeklyYen) ?? "—") · pre \(row.preMoneyYen.map(amdOSWeeklyYen) ?? "—") · post \(row.postMoneyYen.map(amdOSWeeklyYen) ?? "—")", status: row.status ?? row.leadInvestor)
                        if let investors = row.investors, !investors.isEmpty { Text("投資家: \(investors.map { "\($0.name ?? "—")\($0.amountYen.map { " \(amdOSWeeklyYen($0))" } ?? "")\($0.tranche.map { " / \($0)" } ?? "")\($0.lead == true ? " (Lead)" : "")" }.joined(separator: " / "))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        if let contribution = row.amdContributionStatus { Text("AMD貢献: \(contribution) · \(amdOSWeeklyYen(governanceContribution(status: contribution, amount: row.raisedYen, explicit: row.amdContributedYen)) )\(row.amdContributionNote.map { " · \($0)" } ?? "")").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    }
                    Button("削除", role: .destructive) { deleting = .init(entity: "round", id: row.id, title: row.roundName ?? "名称未入力", isGrant: false) }.buttonStyle(.borderless)
                }
                AMDOSDivider()
            }
            AMDOSGov2AddForm(title: "ラウンドを追加", fields: fields("round_name|ラウンド名*", "round_date|日付YYYY-MM-DD", "pre_money_yen|pre(円)", "post_money_yen|post(円)", "raised_yen|調達額(円)", "price_per_share_yen|1株単価(円)", "lead_investor|Lead投資家", "source_ref|出典", "notes|メモ"), required: "round_name") { addRound($0) }
        }
    }
    @ViewBuilder private func meetings(_ rows: [AMDOSGov2Meeting]) -> some View {
        AMDOSSectionCard("株主総会・取締役会 / 決議", systemImage: "building.2") {
            ForEach(rows) { row in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        AMDOSLineItem(title: row.agendaSummary ?? "議案未登録", subtitle: "\(row.meetingType ?? "—") · \(row.meetingDate ?? "—") · \(row.location ?? "—")", status: row.amdResponse)
                        if let resolutions = row.resolutions, !resolutions.isEmpty { Text("決議: \(resolutions.map { "\($0.title ?? "—")\($0.result.map { "（\($0)）" } ?? "")" }.joined(separator: " / "))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        if let attachments = row.attachments, !attachments.isEmpty { HStack { Text("資料:").font(.caption).foregroundStyle(AMDOSDesign.muted); ForEach(Array(attachments.prefix(4).enumerated()), id: \.offset) { _, attachment in if let link = attachment.link, let url = URL(string: link) { Link(attachment.name ?? "資料", destination: url).font(.caption) } else { Text(attachment.name ?? "資料").font(.caption).foregroundStyle(AMDOSDesign.muted) } } } }
                    }
                    Button("削除", role: .destructive) { deleting = .init(entity: "meeting", id: row.id, title: row.agendaSummary ?? "会議", isGrant: false) }.buttonStyle(.borderless)
                }
                AMDOSDivider()
            }
            AMDOSGov2AddForm(title: "総会・取締役会を追加", fields: fields("meeting_type|種別", "meeting_date|日付YYYY-MM-DD", "location|場所/方式", "agenda_summary|議案要約*", "resolutions|決議（/ 区切り）", "amd_response|AMD対応"), required: "agenda_summary") { addMeeting($0) }
        }
    }
    @ViewBuilder private func actions(_ rows: [AMDOSGov2Action]) -> some View { AMDOSSectionCard("要対応", systemImage: "checklist") { ForEach(rows) { row in VStack(alignment: .leading) { AMDOSLineItem(title: row.title, subtitle: [row.category, row.summary, row.dueAt].compactMap { $0 }.joined(separator: " · "), status: row.priority ?? row.status); if let actionURL = row.actionURL, let url = URL(string: actionURL) { Link("開く", destination: url).font(.caption) }; AMDOSDivider() } }; AMDOSGov2AddForm(title: "要対応を追加", fields: fields("title|件名*", "category|区分（既定: governance）", "due_at|期日 YYYY-MM-DD", "action_url|リンク"), required: "title") { addAction($0) } } }
    @ViewBuilder private func grantSection(_ rows: [AMDOSGov2Grant]) -> some View {
        AMDOSSectionCard("助成金・補助金", systemImage: "gift") {
            ForEach(rows) { row in
                HStack {
                    AMDOSLineItem(title: row.grantName, subtitle: "\(row.agency ?? "—") · \(row.grantType ?? "—") · \(row.periodStartYm ?? "—")〜\(row.periodEndYm ?? "—") · AMD貢献 \(row.amdContributionStatus ?? "未判定") \(amdOSWeeklyYen(governanceContribution(row)))", status: "\(row.status) · \(row.isCurrent == false ? "—" : "受給中") · \(row.amountYen.map(amdOSWeeklyYen) ?? "—")")
                    Button("削除", role: .destructive) { deleting = .init(entity: "grant", id: row.id, title: row.grantName, isGrant: true) }.buttonStyle(.borderless)
                }
                AMDOSDivider()
            }
            AMDOSGov2AddForm(title: "助成金・補助金を追加", fields: fields("grant_name|名称*", "agency|交付元", "grant_type|種別", "amount_yen|採択額(円)", "status|状態（既定: active）", "adopted_date|採択日YYYY-MM-DD", "period_start_ym|開始YYYYMM", "period_end_ym|終了YYYYMM", "amd_contribution_status|AMD貢献", "amd_contributed_yen|AMD貢献額(円)", "amd_contribution_note|AMD貢献メモ"), required: "grant_name") { addGrant($0) }
        }
    }
    private func governanceContribution(_ row: AMDOSGov2Grant) -> Double { governanceContribution(status: row.amdContributionStatus, amount: row.amountYen, explicit: row.amdContributedYen) }
    private func governanceContribution(status: String?, amount: Double?, explicit: Double?) -> Double { switch status { case "full": return explicit ?? amount ?? 0; case "partial": return explicit ?? 0; default: return 0 } }
    private func fields(_ values: String...) -> [AMDOSGov2Field] { values.compactMap { part in let pair = part.split(separator: "|", maxSplits: 1).map(String.init); guard pair.count == 2 else { return nil }; return .init(key: pair[0], placeholder: pair[1]) } }
    private func loadProjects() { Task { do { projects = try await AMDOSRESTClient.shared.fetchTable(AMDOSGovernanceProject.self, table: "projects", select: "project_id,project_name", order: "project_name", limit: 500); selectedProject = projects.contains(where: { $0.id == initialProjectId }) ? initialProjectId! : (selectedProject.isEmpty ? projects.first?.id ?? "" : selectedProject); load() } catch { state = .failed(error.localizedDescription) } } }
    private func load() { guard !selectedProject.isEmpty else { return }; Task { state = .loading; do { let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSGov2Envelope.self, path: "/api/governance", query: ["projectId": selectedProject]); guard response.ok else { throw AMDOSNetworkError.http(response.error ?? "読み込み失敗") }; data = response; let grantResponse = try? await AMDOSRESTClient.shared.fetchPWA(AMDOSGov2GrantsEnvelope.self, path: "/api/grants", query: ["projectId": selectedProject]); grants = grantResponse?.grants ?? []; state = .loaded } catch { state = .failed(error.localizedDescription) } } }
    private func text(_ value: String) -> AMDOSGov2JSON { value.trimmedNonEmpty.map(AMDOSGov2JSON.string) ?? .null }
    private func number(_ value: String) -> AMDOSGov2JSON { Double(value.replacingOccurrences(of: ",", with: "")).map(AMDOSGov2JSON.number) ?? .null }
    private func dueAtISO(_ value: String) -> String? { guard let value = value.trimmedNonEmpty else { return nil }; return value.contains("T") ? value : "\(value)T00:00:00.000Z" }
    private func post(_ entity: String, _ row: [String: AMDOSGov2JSON]) { Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/governance", body: AMDOSGov2Post(entity: entity, row: row)); message = nil; load() } catch { message = error.localizedDescription } } }
    private func addShareholder(_ f: [String: String]) { post("shareholder", ["project_id": .string(selectedProject), "holder_type": text(f["holder_type"] ?? ""), "holder_name": text(f["holder_name"] ?? ""), "share_class": text(f["share_class"] ?? ""), "shares": number(f["shares"] ?? ""), "ownership_pct": number(f["ownership_pct"] ?? ""), "invested_yen": number(f["invested_yen"] ?? ""), "as_of_ym": text(f["as_of_ym"] ?? "")]) }
    private func addRound(_ f: [String: String]) { let date = f["round_date"] ?? ""; post("round", ["project_id": .string(selectedProject), "round_name": text(f["round_name"] ?? ""), "round_date": text(date), "round_ym": text(String(date.replacingOccurrences(of: "-", with: "").prefix(6))), "pre_money_yen": number(f["pre_money_yen"] ?? ""), "post_money_yen": number(f["post_money_yen"] ?? ""), "raised_yen": number(f["raised_yen"] ?? ""), "price_per_share_yen": number(f["price_per_share_yen"] ?? ""), "lead_investor": text(f["lead_investor"] ?? ""), "source_ref": text(f["source_ref"] ?? ""), "notes": text(f["notes"] ?? "")]) }
    private func addMeeting(_ f: [String: String]) { let date = f["meeting_date"] ?? ""; let resolutions = (f["resolutions"] ?? "").split(whereSeparator: { $0 == "/" || $0 == "／" || $0 == "、" || $0 == "\n" }).map { AMDOSGov2JSON.object(["title": .string($0.trimmingCharacters(in: .whitespacesAndNewlines)), "result": .string("unknown")]) }; post("meeting", ["project_id": .string(selectedProject), "meeting_type": text(f["meeting_type"] ?? ""), "meeting_date": text(date), "meeting_ym": text(String(date.replacingOccurrences(of: "-", with: "").prefix(6))), "location": text(f["location"] ?? ""), "agenda_summary": text(f["agenda_summary"] ?? ""), "resolutions_json": .array(resolutions), "amd_response": text(f["amd_response"] ?? "")]) }
    private func addAction(_ f: [String: String]) { Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/action-items", body: AMDOSGov2ActionPost(projectID: selectedProject, scope: "project", title: f["title"] ?? "", category: (f["category"] ?? "").trimmedNonEmpty ?? "governance", dueAt: dueAtISO(f["due_at"] ?? ""), actionURL: (f["action_url"] ?? "").trimmedNonEmpty)); message = nil; load() } catch { message = error.localizedDescription } } }
    private func addGrant(_ f: [String: String]) { let status = (f["status"] ?? "").trimmedNonEmpty ?? "active"; let row: [String: AMDOSGov2JSON] = ["project_id": .string(selectedProject), "grant_name": text(f["grant_name"] ?? ""), "agency": text(f["agency"] ?? ""), "grant_type": text(f["grant_type"] ?? ""), "amount_yen": number(f["amount_yen"] ?? ""), "status": .string(status), "adopted_date": text(f["adopted_date"] ?? ""), "period_start_ym": text(f["period_start_ym"] ?? ""), "period_end_ym": text(f["period_end_ym"] ?? ""), "is_current": .bool(!["completed", "rejected", "withdrawn"].contains(status)), "amd_contribution_status": text(f["amd_contribution_status"] ?? ""), "amd_contributed_yen": number(f["amd_contributed_yen"] ?? ""), "amd_contribution_note": text(f["amd_contribution_note"] ?? "")]; Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/grants", body: AMDOSGov2GrantPost(row: row)); message = nil; load() } catch { message = error.localizedDescription } } }
    private func delete(_ target: AMDOSGov2Delete) { deleting = nil; Task { do { let path = target.isGrant ? "/api/grants?id=\(target.id)" : "/api/governance?entity=\(target.entity)&id=\(target.id)"; _ = try await AMDOSRESTClient.shared.sendPWA(path: path, method: "DELETE", body: AMDOSGov2DeleteBody()); message = nil; load() } catch { message = error.localizedDescription } } }
}

private struct AMDOSMsOverviewResponsibility: Codable, Identifiable, Sendable {
    let memberId: String
    let codeName: String
    var share: Double
    var role: String
    var taskDescription: String?
    var id: String { memberId }
}
private struct AMDOSMsOverviewProjectMember: Codable, Identifiable, Sendable { let memberId: String; let codeName: String; var id: String { memberId } }
private struct AMDOSMsOverviewMemberPointTotal: Codable, Identifiable, Sendable {
    let memberId: String
    let codeName: String
    let regularPt: Double
    let extraPt: Double
    let totalPt: Double
    let regularDesignYen: Double
    let extraDesignYen: Double
    let totalDesignYen: Double
    var id: String { memberId }
}
private struct AMDOSMsOverviewMilestone: Codable, Identifiable, Sendable {
    var milestoneId: String
    var title: String
    var points: Double
    let designAmountYen: Double
    var tag: String
    var goalLevel: String
    var successCriteria: String
    var sortOrder: Int
    var isCapExtra: Bool
    var periodStartYm: String?
    var targetYm: String?
    var responsibilities: [AMDOSMsOverviewResponsibility]
    var id: String { milestoneId }
}
private struct AMDOSMsOverviewCycle: Codable, Identifiable, Sendable {
    let planCycleId: String
    let projectId: String
    let projectName: String
    let clientName: String?
    let status: String
    let periodStartYm: String
    let periodEndYm: String
    let budgetYen: Double
    let extraDesignBudgetYen: Double
    let regularDesignUnitYen: Double
    let extraDesignUnitYen: Double
    let totalPoints: Double
    let regularPoints: Double
    let extraPoints: Double
    let healthState: String
    let projectStatus: String
    let projectFreezeFromYm: String?
    let projectMembers: [AMDOSMsOverviewProjectMember]
    let milestones: [AMDOSMsOverviewMilestone]
    let memberPointTotals: [AMDOSMsOverviewMemberPointTotal]
    var id: String { planCycleId }
}
private struct AMDOSMsOverviewEnvelope: Codable, Sendable { let ok: Bool; let planCycles: [AMDOSMsOverviewCycle]?; let error: String? }
private struct AMDOSMsSaveResponsibility: Encodable, Sendable {
    let memberId: String; let share: Double; let role: String; let taskDescription: String?
    enum CodingKeys: String, CodingKey { case memberId = "member_id", share, role, taskDescription = "task_description" }
}
private struct AMDOSMsSaveMilestone: Encodable, Sendable {
    let milestoneId: String?; let title: String; let points: Double; let tag: String; let goalLevel: String; let successCriteria: String; let periodStartYm: String?; let targetYm: String?; let sortOrder: Int; let responsibilities: [AMDOSMsSaveResponsibility]
    enum CodingKeys: String, CodingKey { case milestoneId = "milestone_id", title, points, tag, goalLevel = "goal_level", successCriteria = "success_criteria", periodStartYm = "period_start_ym", targetYm = "target_ym", sortOrder = "sort_order", responsibilities }
}
private struct AMDOSMsSavePayload: Encodable, Sendable {
    let milestones: [AMDOSMsSaveMilestone]; let deletedMilestoneIds: [String]
    enum CodingKeys: String, CodingKey { case milestones, deletedMilestoneIds = "deleted_milestone_ids" }
}
private struct AMDOSMsRewardMemberImpact: Codable, Identifiable, Sendable {
    let memberId: String
    let memberName: String
    let totalOffsetYen: Double
    let positiveOffsetYen: Double
    let negativeOffsetYen: Double
    let regularOffsetYen: Double
    let extraOffsetYen: Double
    var id: String { memberId }
}
private struct AMDOSMsRewardBudgetImpact: Codable, Sendable {
    let clientPaymentYen: Double
    let bufferYen: Double
    let sourceBudgetYen: Double
    let sourceBudgetOverrunYen: Double
    let pjBudgetYen: Double
    let regularBudgetYen: Double
    let extraBudgetYen: Double
    let memberPayoutYen: Double
    let companyReserveYen: Double
    let memberObligationYen: Double
    let seasonEndShortageYen: Double
    let budgetShortageYen: Double
    let fixedPaidYen: Double
    let unverifiedPaidYen: Double
    let futureProjectedPayYen: Double
    let remainingBudgetYen: Double
    let isOverBudget: Bool
    let isSourceOverBudget: Bool
}
private struct AMDOSMsRewardPreview: Codable, Sendable {
    let status: String?
    let blockers: [String]?
    let warnings: [String]?
    let protectedCycleCount: Int?
    let totalOffsetYen: Double?
    let memberImpacts: [AMDOSMsRewardMemberImpact]?
    let budgetImpact: AMDOSMsRewardBudgetImpact?
}
private struct AMDOSMsMutationResponse: Codable, Sendable { let ok: Bool?; let error: String?; let rewardPreview: AMDOSMsRewardPreview?; let rewardRevision: AMDOSMsRewardPreview? }

private let amdOSMsCapExtraTags: Set<String> = ["cap_extra", "extra_contract", "contract_extra", "cap_outside", "uncapped"]
private func amdOSMsIsCapExtra(_ tag: String) -> Bool { amdOSMsCapExtraTags.contains(tag.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()) }
private func amdOSMsPeriodPoints(_ start: String?, _ end: String?) -> Double {
    guard let start, let end, start.count == 6, end.count == 6,
          let startYear = Int(start.prefix(4)), let startMonth = Int(start.suffix(2)),
          let endYear = Int(end.prefix(4)), let endMonth = Int(end.suffix(2)),
          (1...12).contains(startMonth), (1...12).contains(endMonth) else { return 0 }
    let months = (endYear * 12 + endMonth) - (startYear * 12 + startMonth) + 1
    return months > 0 ? Double(months * 10) : 0
}
private func amdOSMsEffectivePoints(_ milestone: AMDOSMsOverviewMilestone) -> Double {
    let explicit = max(0, milestone.points)
    if milestone.isCapExtra && explicit <= 0 {
        return amdOSMsPeriodPoints(milestone.periodStartYm, milestone.targetYm)
    }
    return (explicit * 100).rounded() / 100
}
private func amdOSMsEditableMilestones(_ milestones: [AMDOSMsOverviewMilestone]) -> [AMDOSMsOverviewMilestone] {
    milestones.map { milestone in
        var editable = milestone
        editable.isCapExtra = amdOSMsIsCapExtra(editable.tag)
        editable.points = amdOSMsEffectivePoints(editable)
        return editable
    }
}
private func amdOSMsDesignAmount(points: Double, basis: Double, budget: Double, unit: Double) -> Double {
    if basis > 0, budget > 0 { return max(0, points) * budget / basis }
    return max(0, points) * max(0, unit)
}
private struct AMDOSMsComputedTotals: Sendable {
    let regular: Double
    let extra: Double
    let memberTotals: [AMDOSMsOverviewMemberPointTotal]
}
private func amdOSMsRecompute(cycle: AMDOSMsOverviewCycle, milestones: [AMDOSMsOverviewMilestone]) -> AMDOSMsComputedTotals {
    let extra = (milestones.filter(\.isCapExtra).reduce(0) { $0 + amdOSMsEffectivePoints($1) } * 100).rounded() / 100
    var rows: [String: (codeName: String, regularPt: Double, extraPt: Double, regularYen: Double, extraYen: Double)] = [:]
    for milestone in milestones {
        let points = amdOSMsEffectivePoints(milestone)
        let isExtra = milestone.isCapExtra
        for responsibility in milestone.responsibilities where responsibility.share > 0 {
            let earned = points * responsibility.share
            guard earned > 0 else { continue }
            var row = rows[responsibility.memberId] ?? (responsibility.codeName, 0, 0, 0, 0)
            row.codeName = responsibility.codeName
            if isExtra {
                row.extraPt += earned
                row.extraYen += amdOSMsDesignAmount(points: earned, basis: extra, budget: cycle.extraDesignBudgetYen, unit: cycle.extraDesignUnitYen)
            } else {
                row.regularPt += earned
                row.regularYen += amdOSMsDesignAmount(points: earned, basis: cycle.regularPoints, budget: cycle.budgetYen, unit: cycle.regularDesignUnitYen)
            }
            rows[responsibility.memberId] = row
        }
    }
    var memberTotals: [AMDOSMsOverviewMemberPointTotal] = []
    for (memberId, row) in rows {
        let regularPt = (row.regularPt * 100).rounded() / 100
        let extraPt = (row.extraPt * 100).rounded() / 100
        let regularYen = row.regularYen.rounded()
        let extraYen = row.extraYen.rounded()
        let totalPt = regularPt + extraPt
        let totalYen = regularYen + extraYen
        memberTotals.append(.init(memberId: memberId, codeName: row.codeName, regularPt: regularPt, extraPt: extraPt, totalPt: totalPt, regularDesignYen: regularYen, extraDesignYen: extraYen, totalDesignYen: totalYen))
    }
    memberTotals = memberTotals.filter { $0.totalPt > 0 }.sorted { $0.totalPt == $1.totalPt ? $0.codeName < $1.codeName : $0.totalPt > $1.totalPt }
    return AMDOSMsComputedTotals(regular: cycle.regularPoints, extra: extra, memberTotals: memberTotals)
}

struct AMDOSAdminMSOverviewView: View {
    @State private var rows: [AMDOSMsOverviewCycle] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var expandedID: String?
    var body: some View {
        AMDOSPageScaffold(eyebrow: "MS OVERVIEW", title: "MS概要", subtitle: "PWAと同じ保存前reward検算を通して、MS・担当share・役割・タスクを一括編集") {
            AMDOSStateNotice(state: state) { load() }
            ForEach(rows) { row in
                AMDOSSectionCard(row.projectName, systemImage: "chart.bar") {
                    Button { expandedID = expandedID == row.id ? nil : row.id } label: {
                        HStack {
                            AMDOSStatusBadge(text: row.healthState, tint: row.healthState == "healthy" ? AMDOSDesign.success : AMDOSDesign.warning)
                            AMDOSStatusBadge(text: row.status)
                            Text("\(amdOSMsYm(row.periodStartYm))〜\(amdOSMsYm(row.periodEndYm)) · total \(amdOSMsPt(row.totalPoints))pt / 本契約 \(amdOSMsPt(row.regularPoints))pt").font(.caption).foregroundStyle(AMDOSDesign.muted)
                            if row.extraPoints > 0 { AMDOSStatusBadge(text: "別財布 \(amdOSMsPt(row.extraPoints))pt", tint: .purple) }
                            Spacer(); Image(systemName: expandedID == row.id ? "chevron.up" : "chevron.down")
                        }
                    }.buttonStyle(.plain)
                    if expandedID == row.id { AMDOSAdminMSCycleEditor(cycle: row) { load() } }
                }
            }
        }.task { load() }
    }
    private func load() { Task { state = .loading; do { let e = try await AMDOSRESTClient.shared.fetchPWA(AMDOSMsOverviewEnvelope.self, path: "/api/admin/ms-overview"); guard e.ok else { throw AMDOSNetworkError.http(e.error ?? "MS概要を読み込めなかったよ") }; rows = e.planCycles ?? []; state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
}

private struct AMDOSAdminMSCycleEditor: View {
    let cycle: AMDOSMsOverviewCycle
    let onSaved: () -> Void
    @State private var milestones: [AMDOSMsOverviewMilestone]
    @State private var deletedIDs: [String] = []
    @State private var editing = false
    @State private var previewState = "idle"
    @State private var preview: AMDOSMsRewardPreview?
    @State private var message: String?
    @State private var saving = false
    @State private var previewRevision = 0
    init(cycle: AMDOSMsOverviewCycle, onSaved: @escaping () -> Void) {
        self.cycle = cycle
        self.onSaved = onSaved
        _milestones = State(initialValue: amdOSMsEditableMilestones(cycle.milestones))
    }
    private var total: AMDOSMsComputedTotals { amdOSMsRecompute(cycle: cycle, milestones: milestones) }
    private var allocatedRegularPoints: Double { (milestones.filter { !$0.isCapExtra }.reduce(0) { $0 + amdOSMsEffectivePoints($1) } * 100).rounded() / 100 }
    private var remainingRegularPoints: Double { (cycle.regularPoints - allocatedRegularPoints) * 100 / 100 }
    private var isDirty: Bool { milestoneKey(milestones) != milestoneKey(amdOSMsEditableMilestones(cycle.milestones)) || !deletedIDs.isEmpty }
    private var blocked: Bool { previewState != "ready" || preview?.status == "blocked" }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("本契約 割当 \(amdOSMsPt(allocatedRegularPoints))pt / 基準 \(amdOSMsPt(cycle.regularPoints))pt · 残り \(amdOSMsPt(remainingRegularPoints))pt").font(.caption)
                Text("別財布 \(amdOSMsPt(total.extra))pt").font(.caption).foregroundStyle(.purple)
                Spacer()
                Button(editing ? "編集を閉じる" : "編集") { editing.toggle(); if editing { requestPreview() } else { previewRevision += 1 } }.buttonStyle(.bordered)
                if editing { Button("MS追加") { add() }.buttonStyle(.bordered) }
            }
            if editing {
                ForEach(milestones.indices, id: \.self) { index in editorRow(index) }
                memberPointTotals(rows: total.memberTotals)
                rewardRevisionGuard
                HStack {
                    Text(previewState == "loading" ? "保存前検算中…" : previewState == "error" ? "検算失敗: \(message ?? "")" : preview?.status == "blocked" ? "保存不可: \(preview?.blockers?.first ?? "支払い安全検算")" : "保存前検算OK").font(.caption).foregroundStyle(blocked ? AMDOSDesign.warning : AMDOSDesign.success)
                    if let offset = preview?.totalOffsetYen { Text("差分 \(amdOSWeeklyYen(offset))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    Spacer()
                    Button(saving ? "保存中…" : "保存") { save() }.buttonStyle(.borderedProminent).disabled(saving || !isDirty || blocked)
                    Button("DBへ戻す") { milestones = amdOSMsEditableMilestones(cycle.milestones); deletedIDs = []; requestPreview() }.buttonStyle(.bordered)
                }
            } else {
                rewardRevisionGuard
                if preview?.status == "blocked" { Text("MS編集停止中: \(preview?.blockers?.first ?? "支払い安全検算で保存不可")").font(.caption).foregroundStyle(AMDOSDesign.warning) }
                ForEach(cycle.milestones) { milestone in AMDOSLineItem(title: "\(milestone.title) · \(amdOSMsPt(milestone.points))pt", subtitle: milestone.responsibilities.map { "\($0.codeName) \(Int(($0.share * 100).rounded()))%" }.joined(separator: " / "), status: milestone.isCapExtra ? "cap_extra" : milestone.tag) }
                memberPointTotals(rows: cycle.memberPointTotals)
            }
            if let message, !message.isEmpty { Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled) }
        }
        .task { requestPreview() }
    }
    @ViewBuilder private func editorRow(_ index: Int) -> some View {
        let milestone = milestones[index]
        let effectivePoints = amdOSMsEffectivePoints(milestone)
        let designAmount = amdOSMsDesignAmount(
            points: effectivePoints,
            basis: milestone.isCapExtra ? total.extra : cycle.regularPoints,
            budget: milestone.isCapExtra ? cycle.extraDesignBudgetYen : cycle.budgetYen,
            unit: milestone.isCapExtra ? cycle.extraDesignUnitYen : cycle.regularDesignUnitYen
        )
        AMDOSCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack { TextField("MS名", text: binding(index, \.title)).textFieldStyle(.roundedBorder); Button("削除", role: .destructive) { remove(index) } }
                HStack {
                    TextField("pt", value: pointsBinding(index), format: .number).frame(width: 80).textFieldStyle(.roundedBorder)
                    Picker("分類", selection: tagBinding(index)) { Text("normal").tag("normal"); Text("routine").tag("routine"); Text("buffer").tag("buffer"); Text("cap_extra").tag("cap_extra") }.frame(width: 150)
                    TextField("開始 YYYYMM", text: optionalBinding(index, \.periodStartYm)).textFieldStyle(.roundedBorder)
                    TextField("終了 YYYYMM", text: optionalBinding(index, \.targetYm)).textFieldStyle(.roundedBorder)
                }
                Slider(value: pointsBinding(index), in: 0...max(10, milestone.isCapExtra ? max(effectivePoints, amdOSMsPeriodPoints(milestone.periodStartYm, milestone.targetYm)) : cycle.regularPoints))
                    .tint(milestone.isCapExtra ? .purple : AMDOSDesign.blue)
                Text("\(milestone.isCapExtra ? "別財布" : "本契約") \(amdOSMsPt(effectivePoints))pt · 設計額 \(amdOSWeeklyYen(designAmount))")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                AMDOSTextField(title: "完了条件", text: binding(index, \.successCriteria), axis: .vertical)
                Text("担当share（合計 \(Int((milestone.responsibilities.reduce(0) { $0 + $1.share } * 100).rounded()))%）").font(.caption).foregroundStyle(AMDOSDesign.muted)
                ForEach(cycle.projectMembers) { member in responsibilityRow(member, milestoneIndex: index) }
            }
        }
    }
    @ViewBuilder private func responsibilityRow(_ member: AMDOSMsOverviewProjectMember, milestoneIndex: Int) -> some View {
        let existing = milestones[milestoneIndex].responsibilities.first(where: { $0.memberId == member.memberId })
        let milestone = milestones[milestoneIndex]
        let memberPoints = amdOSMsEffectivePoints(milestone) * (existing?.share ?? 0)
        let memberDesign = amdOSMsDesignAmount(
            points: memberPoints,
            basis: milestone.isCapExtra ? total.extra : cycle.regularPoints,
            budget: milestone.isCapExtra ? cycle.extraDesignBudgetYen : cycle.budgetYen,
            unit: milestone.isCapExtra ? cycle.extraDesignUnitYen : cycle.regularDesignUnitYen
        )
        HStack {
            Text(member.codeName).frame(width: 86, alignment: .leading)
            TextField("%", value: responsibilityBinding(milestoneIndex, member, \.share, multiplier: 100), format: .number).frame(width: 70).textFieldStyle(.roundedBorder)
            Picker("役割", selection: responsibilityStringBinding(milestoneIndex, member, \.role)) { ForEach(["担当", "統括", "レビュー", "サポート"], id: \.self) { Text($0).tag($0) } }.frame(width: 110)
            TextField("担当タスク", text: responsibilityOptionalBinding(milestoneIndex, member)).textFieldStyle(.roundedBorder)
            if existing?.share ?? 0 > 0 { Text("\(amdOSMsPt(memberPoints))pt · \(amdOSWeeklyYen(memberDesign))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
        }
    }
    @ViewBuilder private func memberPointTotals(rows: [AMDOSMsOverviewMemberPointTotal]) -> some View {
        if !rows.isEmpty {
            AMDOSSectionCard("メンバー配分", systemImage: "person.2") {
                ForEach(rows) { member in
                    AMDOSLineItem(
                        title: "\(member.codeName) · \(amdOSMsPt(member.totalPt))pt",
                        subtitle: "本契約 \(amdOSMsPt(member.regularPt))pt / \(amdOSWeeklyYen(member.regularDesignYen)) · 別財布 \(amdOSMsPt(member.extraPt))pt / \(amdOSWeeklyYen(member.extraDesignYen))",
                        status: "設計額 \(amdOSWeeklyYen(member.totalDesignYen))"
                    )
                }
            }
        }
    }
    @ViewBuilder private var rewardRevisionGuard: some View {
        if previewState == "loading" {
            AMDOSSectionCard("保存前支払検算", systemImage: "shield.lefthalf.filled") { Text("検算中…") .font(.caption).foregroundStyle(AMDOSDesign.muted) }
        } else if let preview {
            AMDOSSectionCard("保存前支払検算", systemImage: "shield.lefthalf.filled") {
                let isBlocked = preview.status == "blocked"
                Text(isBlocked ? "保存不可" : preview.status == "warning" ? "検算OK・精算あり" : "検算OK")
                    .font(.headline).foregroundStyle(isBlocked ? AMDOSDesign.warning : AMDOSDesign.success)
                if let count = preview.protectedCycleCount { Text("protected月 \(count)件 · 過去明細は保持して次回に差額精算") .font(.caption).foregroundStyle(AMDOSDesign.muted) }
                if let impacts = preview.memberImpacts, !impacts.isEmpty {
                    Text("本人別の差額") .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    ForEach(impacts.prefix(5)) { impact in
                        AMDOSLineItem(title: impact.memberName, subtitle: "本契約 \(amdOSWeeklyYen(impact.regularOffsetYen)) / 別財布 \(amdOSWeeklyYen(impact.extraOffsetYen))", status: "\(impact.totalOffsetYen >= 0 ? "+" : "-")\(amdOSWeeklyYen(abs(impact.totalOffsetYen)))")
                    }
                    if impacts.count > 5 { Text("ほか \(impacts.count - 5)人") .font(.caption).foregroundStyle(AMDOSDesign.muted) }
                }
                if let impact = preview.budgetImpact {
                    AMDOSSectionCard("予算影響", systemImage: "yensign.circle") {
                        Text("クライアント支払 \(amdOSWeeklyYen(impact.clientPaymentYen)) / バッファ \(amdOSWeeklyYen(impact.bufferYen)) / 原資上限 \(amdOSWeeklyYen(impact.sourceBudgetYen))") .font(.caption)
                        Text("PJ予算 \(amdOSWeeklyYen(impact.pjBudgetYen))（本契約 \(amdOSWeeklyYen(impact.regularBudgetYen)) / 別財布 \(amdOSWeeklyYen(impact.extraBudgetYen))）") .font(.caption)
                        Text("メンバー支払 \(amdOSWeeklyYen(impact.memberPayoutYen)) / 会社留保 \(amdOSWeeklyYen(impact.companyReserveYen)) / 支払済み固定 \(amdOSWeeklyYen(impact.fixedPaidYen))") .font(.caption)
                        Text("実績未照合 \(amdOSWeeklyYen(impact.unverifiedPaidYen)) / これから支払予定 \(amdOSWeeklyYen(impact.futureProjectedPayYen))") .font(.caption)
                        if impact.seasonEndShortageYen > 0 { Text("期末未払 \(amdOSWeeklyYen(impact.seasonEndShortageYen))") .foregroundStyle(AMDOSDesign.warning) }
                        if impact.isOverBudget { Text("予算不足 \(amdOSWeeklyYen(impact.budgetShortageYen))") .foregroundStyle(AMDOSDesign.warning) }
                        if impact.isSourceOverBudget { Text("原資超過 \(amdOSWeeklyYen(impact.sourceBudgetOverrunYen))") .foregroundStyle(AMDOSDesign.warning) }
                        if impact.seasonEndShortageYen <= 0 && !impact.isOverBudget && !impact.isSourceOverBudget { Text("保存後残予算 \(amdOSWeeklyYen(impact.remainingBudgetYen))") .foregroundStyle(AMDOSDesign.success) }
                    }
                }
                ForEach(preview.blockers ?? [], id: \.self) { Text("保存不可: \($0)").font(.caption).foregroundStyle(AMDOSDesign.warning) }
                ForEach(preview.warnings ?? [], id: \.self) { Text($0).font(.caption).foregroundStyle(AMDOSDesign.warning) }
            }
        }
    }
    private func binding<T>(_ index: Int, _ path: WritableKeyPath<AMDOSMsOverviewMilestone, T>) -> Binding<T> { Binding(get: { milestones[index][keyPath: path] }, set: { milestones[index][keyPath: path] = $0; requestPreview() }) }
    private func pointsBinding(_ index: Int) -> Binding<Double> { Binding(get: { amdOSMsEffectivePoints(milestones[index]) }, set: { milestones[index].points = max(0, $0); requestPreview() }) }
    private func tagBinding(_ index: Int) -> Binding<String> { Binding(get: { milestones[index].tag }, set: { tag in milestones[index].tag = tag; milestones[index].isCapExtra = amdOSMsIsCapExtra(tag); requestPreview() }) }
    private func optionalBinding(_ index: Int, _ path: WritableKeyPath<AMDOSMsOverviewMilestone, String?>) -> Binding<String> { Binding(get: { milestones[index][keyPath: path] ?? "" }, set: { milestones[index][keyPath: path] = $0.trimmedNonEmpty; requestPreview() }) }
    private func responsibility(_ index: Int, _ member: AMDOSMsOverviewProjectMember) -> AMDOSMsOverviewResponsibility { milestones[index].responsibilities.first(where: { $0.memberId == member.memberId }) ?? .init(memberId: member.memberId, codeName: member.codeName, share: 0, role: "担当", taskDescription: nil) }
    private func setResponsibility(_ index: Int, _ value: AMDOSMsOverviewResponsibility) { milestones[index].responsibilities.removeAll { $0.memberId == value.memberId }; if value.share > 0 || value.role != "担当" || value.taskDescription?.trimmedNonEmpty != nil { milestones[index].responsibilities.append(value) }; requestPreview() }
    private func responsibilityBinding(_ index: Int, _ member: AMDOSMsOverviewProjectMember, _: WritableKeyPath<AMDOSMsOverviewResponsibility, Double>, multiplier: Double) -> Binding<Double> { Binding(get: { responsibility(index, member).share * multiplier }, set: { var value = responsibility(index, member); value.share = max(0, min(1, $0 / multiplier)); setResponsibility(index, value) }) }
    private func responsibilityStringBinding(_ index: Int, _ member: AMDOSMsOverviewProjectMember, _: WritableKeyPath<AMDOSMsOverviewResponsibility, String>) -> Binding<String> { Binding(get: { responsibility(index, member).role }, set: { var value = responsibility(index, member); value.role = $0; setResponsibility(index, value) }) }
    private func responsibilityOptionalBinding(_ index: Int, _ member: AMDOSMsOverviewProjectMember) -> Binding<String> { Binding(get: { responsibility(index, member).taskDescription ?? "" }, set: { var value = responsibility(index, member); value.taskDescription = $0.trimmedNonEmpty; setResponsibility(index, value) }) }
    private func add() { milestones.append(.init(milestoneId: "draft-\(UUID().uuidString)", title: "新しいMS", points: 10, designAmountYen: 0, tag: "normal", goalLevel: "season", successCriteria: "", sortOrder: (milestones.map(\.sortOrder).max() ?? 0) + 1, isCapExtra: false, periodStartYm: cycle.periodStartYm, targetYm: cycle.periodEndYm, responsibilities: [])); requestPreview() }
    private func remove(_ index: Int) { let id = milestones[index].milestoneId; milestones.remove(at: index); if !id.hasPrefix("draft-") { deletedIDs.append(id) }; requestPreview() }
    private func payload() -> AMDOSMsSavePayload { .init(milestones: milestones.enumerated().map { offset, item in .init(milestoneId: item.milestoneId.hasPrefix("draft-") ? nil : item.milestoneId, title: item.title, points: amdOSMsEffectivePoints(item), tag: item.tag, goalLevel: item.goalLevel, successCriteria: item.successCriteria, periodStartYm: item.periodStartYm, targetYm: item.targetYm, sortOrder: item.sortOrder > 0 ? item.sortOrder : offset + 1, responsibilities: item.responsibilities.filter { $0.share > 0 }.map { .init(memberId: $0.memberId, share: $0.share, role: $0.role, taskDescription: $0.taskDescription) }) }, deletedMilestoneIds: deletedIDs) }
    private func requestPreview() {
        previewRevision += 1
        let revision = previewRevision
        let request = payload()
        previewState = "loading"
        message = nil
        Task {
            try? await Task.sleep(nanoseconds: 450_000_000)
            guard revision == previewRevision else { return }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/ms-overview/\(cycle.planCycleId)", body: request)
                guard revision == previewRevision else { return }
                let response = try JSONDecoder().decode(AMDOSMsMutationResponse.self, from: data)
                guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "保存前検算に失敗") }
                preview = response.rewardPreview
                previewState = "ready"
                message = nil
            } catch AMDOSNetworkError.httpStatus(_, let body) {
                guard revision == previewRevision else { return }
                let response = try? JSONDecoder().decode(AMDOSMsMutationResponse.self, from: Data(body.utf8))
                preview = response?.rewardPreview ?? response?.rewardRevision
                previewState = "error"
                message = response?.error ?? body
            } catch {
                guard revision == previewRevision else { return }
                preview = nil
                previewState = "error"
                message = error.localizedDescription
            }
        }
    }
    private func save() { guard !blocked else { return }; saving = true; Task { do { let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/ms-overview/\(cycle.planCycleId)", method: "PUT", body: payload()); let response = try JSONDecoder().decode(AMDOSMsMutationResponse.self, from: data); guard response.ok == true else { preview = response.rewardPreview; throw AMDOSNetworkError.http(response.error ?? "MSを保存できなかったよ") }; message = "保存したよ"; editing = false; onSaved() } catch AMDOSNetworkError.httpStatus(_, let body) { let response = try? JSONDecoder().decode(AMDOSMsMutationResponse.self, from: Data(body.utf8)); preview = response?.rewardPreview ?? response?.rewardRevision; message = "保存失敗: \(response?.error ?? body)" } catch { message = "保存失敗: \(error.localizedDescription)" }; saving = false } }
    private func milestoneKey(_ values: [AMDOSMsOverviewMilestone]) -> String { values.map { "\($0.milestoneId)|\($0.title)|\(amdOSMsEffectivePoints($0))|\($0.tag)|\($0.goalLevel)|\($0.successCriteria)|\($0.periodStartYm ?? "")|\($0.targetYm ?? "")|\($0.responsibilities.map { "\($0.memberId):\($0.share):\($0.role):\($0.taskDescription ?? "")" }.sorted().joined(separator: ","))" }.joined(separator: "#") }
}
private func amdOSMsPt(_ value: Double) -> String { value.rounded() == value ? String(Int(value)) : String(format: "%.2f", value) }
private func amdOSMsYm(_ value: String) -> String { value.count == 6 ? "\(value.prefix(4))/\(value.suffix(2))" : value }

struct AMDOSAdminSettingsView: View { @State private var rows: [AMDOSSetting] = []; @State private var selectedKey = ""; @State private var draft = ""; @State private var state: AMDOSFeatureLoadState = .idle; @State private var message: String?; var body: some View { AMDOSPageScaffold(eyebrow: "ADMIN SETTINGS", title: "運用設定", subtitle: "settings RLSの読み書きと、PWA settings/cron-runの操作境界") { AMDOSStateNotice(state: state) { load() }; ForEach(rows) { row in Button { selectedKey = row.key; draft = row.value ?? "" } label: { AMDOSCard { HStack { VStack(alignment: .leading) { Text(row.key).font(.headline); Text(row.value ?? "値なし").font(.caption).foregroundStyle(AMDOSDesign.muted); Text(row.updatedAt ?? "更新日時なし").font(.caption2).foregroundStyle(AMDOSDesign.muted) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(AMDOSDesign.muted) } } }.buttonStyle(.plain) }; if !selectedKey.isEmpty { AMDOSSectionCard("設定を保存", systemImage: "pencil") { AMDOSTextField(title: selectedKey, text: $draft, axis: .vertical); Button("保存") { save() }.buttonStyle(.borderedProminent); AMDOSAdminInlineMessage(text: message) } } }.task { load() } }; private func load() { Task { state = .loading; do { rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSSetting.self, table: "settings", select: "key,value,updated_at", order: "key", limit: 500); state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }; private func save() { guard let row = rows.first(where: { $0.key == selectedKey }) else { return }; Task { do { _ = try await AMDOSRESTClient.shared.patchTable(table: "settings", filters: ["key": "eq.\(row.key)"], body: AMDOSSettingPatch(value: draft)); message = "設定を保存したよ"; await load() } catch { message = error.localizedDescription } } } }
private struct AMDOSSetting: Codable, Identifiable, Sendable { let key: String; let value: String?; let updatedAt: String?; var id: String { key }; enum CodingKeys: String, CodingKey { case key, value, updatedAt = "updated_at" } }
private struct AMDOSSettingPatch: Encodable, Sendable { let value: String }
