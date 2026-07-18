import Foundation
import SwiftUI

// MARK: - PWA admin transport values

/// JSONB values are kept structurally intact while an admin edits the PWA's
/// `projects` ledger.  This deliberately avoids turning a partial native form
/// into a lossy rewrite of `contract_terms_json`, `work_content`, or lanes.
private indirect enum AMDOSAdminParityJSON: Codable, Equatable, Sendable {
    case object([String: AMDOSAdminParityJSON])
    case array([AMDOSAdminParityJSON])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode([String: AMDOSAdminParityJSON].self) {
            self = .object(value)
        } else if let value = try? container.decode([AMDOSAdminParityJSON].self) {
            self = .array(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else {
            throw DecodingError.typeMismatch(
                AMDOSAdminParityJSON.self,
                .init(codingPath: decoder.codingPath, debugDescription: "Unsupported JSON value")
            )
        }
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

    var prettyJSONString: String {
        guard let data = try? JSONEncoder.pretty.encode(self),
              let text = String(data: data, encoding: .utf8) else { return "" }
        return text
    }

    var objectValue: [String: AMDOSAdminParityJSON]? {
        guard case .object(let value) = self else { return nil }
        return value
    }

    var arrayValue: [AMDOSAdminParityJSON]? {
        guard case .array(let value) = self else { return nil }
        return value
    }
}

private extension JSONEncoder {
    static var pretty: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return encoder
    }
}

private func amdOSAdminParityJSONString(_ value: AMDOSAdminParityJSON?, fallback: String) -> String {
    guard let rendered = value?.prettyJSONString, !rendered.isEmpty else { return fallback }
    return rendered
}

private func amdOSAdminParityNullable(_ value: String) -> AMDOSAdminParityJSON {
    value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .null : .string(value.trimmingCharacters(in: .whitespacesAndNewlines))
}

private func amdOSAdminParityYMIsValid(_ value: String) -> Bool {
    value.isEmpty || value.range(of: "^[0-9]{6}$", options: .regularExpression) != nil
}

private func amdOSAdminParityParseJSON(_ text: String, expected: String) throws -> AMDOSAdminParityJSON {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
        if expected == "object" { return .object([:]) }
        if expected == "array" { return .array([]) }
        throw AMDOSNetworkError.http("\(expected) のJSONを入力してね")
    }
    let value = try JSONDecoder().decode(AMDOSAdminParityJSON.self, from: Data(trimmed.utf8))
    switch (expected, value) {
    case ("object", .object), ("array", .array): return value
    default: throw AMDOSNetworkError.http("\(expected == "object" ? "オブジェクト { }" : "配列 [ ]") 形式で入力してね")
    }
}

private func amdOSAdminParityText(_ value: AMDOSAdminParityJSON?) -> String {
    switch value {
    case .string(let text): return text
    case .number(let number):
        return number.rounded() == number ? String(Int(number)) : String(number)
    case .bool(let value): return value ? "true" : "false"
    default: return ""
    }
}

private func amdOSAdminParityNumber(_ value: String) -> AMDOSAdminParityJSON? {
    let text = value
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .replacingOccurrences(of: ",", with: "")
        .replacingOccurrences(of: "¥", with: "")
        .replacingOccurrences(of: "円", with: "")
    guard !text.isEmpty, let number = Double(text), number.isFinite else { return nil }
    return .number(number)
}

private func amdOSAdminParityLanePercent(_ value: AMDOSAdminParityJSON?) -> String {
    let raw = amdOSAdminParityText(value)
    guard let weight = Double(raw), weight.isFinite else { return raw }
    // lanes の正本は 0〜1。画面では人が入力・確認しやすい百分率にだけ変換する。
    let percent = abs(weight) <= 1 ? weight * 100 : weight
    if percent.rounded() == percent { return String(Int(percent)) }
    return String(format: "%.3f", percent)
        .replacingOccurrences(of: #"0+$"#, with: "", options: .regularExpression)
        .replacingOccurrences(of: #"\.$"#, with: "", options: .regularExpression)
}

private struct AMDOSAdminParityContractTerms: Equatable {
    var monthlyFeeYen = ""
    var contractStartYm = ""
    var contractEndYm = ""
    var actualWorkStartYm = ""
    var billingStartYm = ""
    var rewardPoolYen = ""
    var monthlyRewardCapYen = ""
    var deliverablesRequired = ""
    var deliverablesNote = ""
    var monthlyReportSubmissionRule = ""
    var monthlyReportSubmissionTiming = ""
    var monthlyReportSubmissionDeadline = ""
    var monthlyReportSubmissionFormat = ""
    var monthlyReportSubmissionRequiredItems = ""
    var monthlyReportSubmissionNote = ""
    var expenseReimbursementValue = ""
    var sourceTitle = ""
    var sourceRef = ""
    var notes = ""

    init(_ value: AMDOSAdminParityJSON?) {
        let object = value?.objectValue ?? [:]
        monthlyFeeYen = amdOSAdminParityText(object["monthlyFeeYen"])
        contractStartYm = amdOSAdminParityText(object["contractStartYm"])
        contractEndYm = amdOSAdminParityText(object["contractEndYm"])
        actualWorkStartYm = amdOSAdminParityText(object["actualWorkStartYm"])
        billingStartYm = amdOSAdminParityText(object["billingStartYm"])
        rewardPoolYen = amdOSAdminParityText(object["rewardPoolYen"])
        monthlyRewardCapYen = amdOSAdminParityText(object["monthlyRewardCapYen"])
        switch amdOSAdminParityText(object["deliverablesRequired"]).lowercased() {
        case "true", "あり", "可", "yes": deliverablesRequired = "true"
        case "false", "なし", "不可", "no": deliverablesRequired = "false"
        default: deliverablesRequired = ""
        }
        deliverablesNote = amdOSAdminParityText(object["deliverablesNote"])
        monthlyReportSubmissionRule = amdOSAdminParityText(object["monthlyReportSubmissionRule"])
        monthlyReportSubmissionTiming = amdOSAdminParityText(object["monthlyReportSubmissionTiming"])
        monthlyReportSubmissionDeadline = amdOSAdminParityText(object["monthlyReportSubmissionDeadline"])
        monthlyReportSubmissionFormat = amdOSAdminParityText(object["monthlyReportSubmissionFormat"])
        monthlyReportSubmissionRequiredItems = amdOSAdminParityText(object["monthlyReportSubmissionRequiredItems"])
        monthlyReportSubmissionNote = amdOSAdminParityText(object["monthlyReportSubmissionNote"])
        sourceTitle = amdOSAdminParityText(object["sourceTitle"])
        sourceRef = amdOSAdminParityText(object["sourceRef"])
        notes = amdOSAdminParityText(object["notes"])

        let reimbursementAllowed = amdOSAdminParityText(object["expenseReimbursementAllowed"])
        let reimbursementNote = amdOSAdminParityText(object["expenseReimbursementNote"])
        expenseReimbursementValue = reimbursementAllowed == "false" ? "不可" : reimbursementNote
    }

    func merged(into base: AMDOSAdminParityJSON?) -> AMDOSAdminParityJSON {
        var object = base?.objectValue ?? [:]

        func putText(_ key: String, _ value: String) {
            let text = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty { object.removeValue(forKey: key) }
            else { object[key] = .string(text) }
        }
        func putNumber(_ key: String, _ value: String) {
            if let number = amdOSAdminParityNumber(value) { object[key] = number }
            else { object.removeValue(forKey: key) }
        }

        putNumber("monthlyFeeYen", monthlyFeeYen)
        putText("contractStartYm", contractStartYm)
        putText("contractEndYm", contractEndYm)
        putText("actualWorkStartYm", actualWorkStartYm)
        putText("billingStartYm", billingStartYm)
        putNumber("rewardPoolYen", rewardPoolYen)
        putNumber("monthlyRewardCapYen", monthlyRewardCapYen)

        switch deliverablesRequired {
        case "true": object["deliverablesRequired"] = .bool(true)
        case "false": object["deliverablesRequired"] = .bool(false)
        default: object.removeValue(forKey: "deliverablesRequired")
        }
        putText("deliverablesNote", deliverablesNote)
        putText("monthlyReportSubmissionRule", monthlyReportSubmissionRule)
        putText("monthlyReportSubmissionTiming", monthlyReportSubmissionTiming)
        putText("monthlyReportSubmissionDeadline", monthlyReportSubmissionDeadline)
        putText("monthlyReportSubmissionFormat", monthlyReportSubmissionFormat)
        putText("monthlyReportSubmissionRequiredItems", monthlyReportSubmissionRequiredItems)
        putText("monthlyReportSubmissionNote", monthlyReportSubmissionNote)

        let reimbursement = expenseReimbursementValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if reimbursement.isEmpty {
            object.removeValue(forKey: "expenseReimbursementAllowed")
            object.removeValue(forKey: "expenseReimbursementNote")
        } else if ["不可", "なし", "無し", "対象外"].contains(reimbursement) || reimbursement.hasPrefix("不可") {
            object["expenseReimbursementAllowed"] = .bool(false)
            object["expenseReimbursementNote"] = .string(reimbursement)
        } else {
            object["expenseReimbursementAllowed"] = .bool(true)
            object["expenseReimbursementNote"] = .string(reimbursement)
        }

        putText("sourceTitle", sourceTitle)
        putText("sourceRef", sourceRef)
        putText("notes", notes)
        return .object(object)
    }
}

private struct AMDOSAdminParityLaneDraft: Identifiable, Equatable {
    let id: String
    let label: String
    var isSelected: Bool
    var weight: String

    static let domains: [(id: String, label: String)] = [
        ("advanced_ict", "通信・ICT"),
        ("advanced_materials_manufacturing", "先端材料・製造"),
        ("ai_technologies", "AI"),
        ("biotechnology", "バイオ・医療"),
        ("defence_space_robotics_transport", "防衛・宇宙・ロボ"),
        ("energy_environment", "エネルギー・環境"),
        ("quantum", "量子"),
        ("sensing_timing_navigation", "センシング")
    ]

    init(id: String, label: String, isSelected: Bool = false, weight: String = "") {
        self.id = id
        self.label = label
        self.isSelected = isSelected
        self.weight = weight
    }

    static func makeRows(from value: AMDOSAdminParityJSON?) -> [AMDOSAdminParityLaneDraft] {
        let saved = (value?.arrayValue ?? []).reduce(into: [String: String]()) { result, row in
            guard let object = row.objectValue else { return }
            let domain = amdOSAdminParityText(object["domain"])
            guard !domain.isEmpty else { return }
            result[domain] = amdOSAdminParityLanePercent(object["weight"])
        }
        return domains.map { domain in
            AMDOSAdminParityLaneDraft(
                id: domain.id,
                label: domain.label,
                isSelected: saved[domain.id] != nil,
                weight: saved[domain.id] ?? ""
            )
        }
    }
}

// MARK: - PWA /admin/projects read models

private struct AMDOSAdminParityProject: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let projectName: String
    let clientName: String?
    let status: String
    let projectCategory: String?
    let slackChannelID: String?
    let slackChannelNotRequired: Bool?
    let driveFolderID: String?
    let freeePartnerID: String?
    let reportEmails: String?
    let governanceWatchShareholderMeetings: Bool?
    let governanceWatchBoardMeetings: Bool?
    let monthlyReportScope: String?
    let reportLocalAlias: String?
    let reportExtraAllowTerms: [String]?
    let workContent: [AMDOSAdminParityJSON]?
    let startYm: String?
    let endYm: String?
    let feeType: String?
    let feeAmount: Double?
    let invoiceSendManual: Bool?
    let invoiceToEmails: String?
    let invoiceCcEmails: String?
    let invoiceBccEmails: String?
    let paymentDueRule: String?
    let paymentDueDay: Int?
    let contractTermsJSON: AMDOSAdminParityJSON?
    let freezeFromYm: String?
    let restartExpectedYm: String?
    let newsSearchQuery: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case projectName = "project_name"
        case clientName = "client_name"
        case status
        case projectCategory = "project_category"
        case slackChannelID = "slack_channel_id"
        case slackChannelNotRequired = "slack_channel_not_required"
        case driveFolderID = "drive_folder_id"
        case freeePartnerID = "freee_partner_id"
        case reportEmails = "report_emails"
        case governanceWatchShareholderMeetings = "governance_watch_shareholder_meetings"
        case governanceWatchBoardMeetings = "governance_watch_board_meetings"
        case monthlyReportScope = "monthly_report_scope"
        case reportLocalAlias = "report_local_alias"
        case reportExtraAllowTerms = "report_extra_allow_terms"
        case workContent = "work_content"
        case startYm = "start_ym"
        case endYm = "end_ym"
        case feeType = "fee_type"
        case feeAmount = "fee_amount"
        case invoiceSendManual = "invoice_send_manual"
        case invoiceToEmails = "invoice_to_emails"
        case invoiceCcEmails = "invoice_cc_emails"
        case invoiceBccEmails = "invoice_bcc_emails"
        case paymentDueRule = "payment_due_rule"
        case paymentDueDay = "payment_due_day"
        case contractTermsJSON = "contract_terms_json"
        case freezeFromYm = "freeze_from_ym"
        case restartExpectedYm = "restart_expected_ym"
        case newsSearchQuery = "news_search_query"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

private struct AMDOSAdminParityVenture: Codable, Sendable {
    let projectId: String
    let lanes: AMDOSAdminParityJSON?
    enum CodingKeys: String, CodingKey { case projectId = "project_id", lanes }
}

private struct AMDOSAdminParityLaneSuggestion: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let suggestedLanes: AMDOSAdminParityJSON?
    let reasoning: String?
    let confidence: Double?
    let createdAt: String?
    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case suggestedLanes = "suggested_lanes"
        case reasoning, confidence
        case createdAt = "created_at"
    }
}

private struct AMDOSAdminParityProjectMember: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let memberId: String
    let isPM: Bool?
    let isCloser: Bool?
    let isPL: Bool?
    let roleLabel: String?
    let joinYm: String?
    let leaveYm: String?
    let isActive: Bool?
    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case memberId = "member_id"
        case isPM = "is_pm"
        case isCloser = "is_closer"
        case isPL = "is_pl"
        case roleLabel = "role_label"
        case joinYm = "join_ym"
        case leaveYm = "leave_ym"
        case isActive = "is_active"
    }
}

private struct AMDOSAdminParityMemberMaster: Codable, Identifiable, Sendable {
    let memberId: String
    let memberName: String?
    let codeName: String?
    let status: String?
    var id: String { memberId }
    var displayName: String {
        let label = codeName?.trimmedNonEmpty ?? memberName?.trimmedNonEmpty ?? memberId
        let name = memberName?.trimmedNonEmpty
        return name == nil || name == label ? label : "\(label)（\(name!)）"
    }
    var isActive: Bool { status != "inactive" && status != "left" }
    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case memberName = "member_name"
        case codeName = "code_name"
        case status
    }
}

@MainActor
private final class AMDOSAdminProjectsParityStore: ObservableObject {
    @Published var projects: [AMDOSAdminParityProject] = []
    @Published var ventures: [AMDOSAdminParityVenture] = []
    @Published var suggestions: [AMDOSAdminParityLaneSuggestion] = []
    @Published var memberships: [AMDOSAdminParityProjectMember] = []
    @Published var memberMaster: [AMDOSAdminParityMemberMaster] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?

    func load() async {
        state = .loading
        message = nil
        do {
            async let projectsRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSAdminParityProject.self,
                table: "projects",
                select: "id,project_id,project_name,client_name,status,project_category,slack_channel_id,slack_channel_not_required,drive_folder_id,freee_partner_id,report_emails,governance_watch_shareholder_meetings,governance_watch_board_meetings,monthly_report_scope,report_local_alias,report_extra_allow_terms,work_content,start_ym,end_ym,fee_type,fee_amount,invoice_send_manual,invoice_to_emails,invoice_cc_emails,invoice_bcc_emails,payment_due_rule,payment_due_day,contract_terms_json,freeze_from_ym,restart_expected_ym,news_search_query,created_at,updated_at",
                order: "status,project_name",
                limit: 1_000
            )
            async let ventureRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSAdminParityVenture.self,
                table: "project_ventures",
                select: "project_id,lanes",
                limit: 1_000
            )
            async let suggestionRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSAdminParityLaneSuggestion.self,
                table: "lane_suggestions",
                select: "id,project_id,suggested_lanes,reasoning,confidence,created_at",
                filters: ["status": "eq.pending"],
                order: "created_at.desc",
                limit: 1_000
            )
            async let memberRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSAdminParityProjectMember.self,
                table: "project_members",
                select: "id,project_id,member_id,is_pm,is_closer,is_pl,role_label,join_ym,leave_ym,is_active",
                order: "project_id,is_active.desc,created_at",
                limit: 2_000
            )
            async let masterRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSAdminParityMemberMaster.self,
                table: "members",
                select: "member_id,member_name,code_name,status",
                order: "code_name",
                limit: 2_000
            )
            projects = try await projectsRequest
            ventures = try await ventureRequest
            suggestions = try await suggestionRequest
            memberships = try await memberRequest
            memberMaster = try await masterRequest
            state = projects.isEmpty ? .empty : .loaded
        } catch {
            message = error.localizedDescription
            state = .failed(message ?? "PJ台帳を読み込めなかった")
        }
    }

    func applySuggestion(_ suggestion: AMDOSAdminParityLaneSuggestion, action: String) async {
        do {
            let data = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/admin/lane-suggestions/\(suggestion.id)",
                method: "PATCH",
                body: AMDOSAdminParityLaneSuggestionAction(action: action)
            )
            let response = try JSONDecoder().decode(AMDOSAdminParityOKResponse.self, from: data)
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "lane提案を更新できなかった") }
            await load()
            message = "lane提案を\(action == "approve" ? "採用" : "却下")したよ"
        } catch {
            message = error.localizedDescription
        }
    }
}

// MARK: - /admin/projects

struct AMDOSAdminProjectsView: View {
    @StateObject private var store = AMDOSAdminProjectsParityStore()
    @State private var searchText = ""
    @State private var statusFilter = ""
    @State private var selectedProject: AMDOSAdminParityProject?

    private var filteredProjects: [AMDOSAdminParityProject] {
        store.projects.filter { project in
            let matchesStatus = statusFilter.isEmpty || project.status == statusFilter
            let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            let matchesSearch = query.isEmpty || [project.projectId, project.projectName, project.clientName ?? ""]
                .contains { $0.localizedCaseInsensitiveContains(query) }
            return matchesStatus && matchesSearch
        }
    }

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "ADMIN PROJECTS",
            title: "PJ台帳",
            subtitle: "PJの設定、体制、契約・請求条件を管理"
        ) {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            filters
            if let message = store.message?.trimmedNonEmpty {
                Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
            }
            AMDOSSectionCard("プロジェクト", systemImage: "folder.badge.gearshape") {
                if filteredProjects.isEmpty, case .loaded = store.state {
                    Text("条件に一致するPJがないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                ForEach(filteredProjects) { project in
                    projectRow(project)
                }
            }
        }
        .task { await store.load() }
        .sheet(item: $selectedProject) { project in
            AMDOSAdminProjectParityEditor(
                project: project,
                venture: store.ventures.first(where: { $0.projectId == project.projectId }),
                suggestion: store.suggestions.first(where: { $0.projectId == project.projectId }),
                onSuggestionAction: { suggestion, action in
                    Task { await store.applySuggestion(suggestion, action: action) }
                },
                onSaved: { Task { await store.load() } }
            )
        }
    }

    private var filters: some View {
        HStack(spacing: 12) {
            Picker("状態", selection: $statusFilter) {
                Text("すべて").tag("")
                ForEach(["draft", "active", "sales", "ended", "frozen", "lost"], id: \.self) { Text($0).tag($0) }
            }
            .frame(maxWidth: 160)
            TextField("PJ名 / ID / クライアントを検索", text: $searchText)
                .textFieldStyle(.roundedBorder)
            Text("\(filteredProjects.count)件").font(.caption).foregroundStyle(AMDOSDesign.muted)
            Button("再読み込み") { Task { await store.load() } }.buttonStyle(.bordered)
        }
    }

    @ViewBuilder
    private func projectRow(_ project: AMDOSAdminParityProject) -> some View {
        let activeMembers = store.memberships.filter { $0.projectId == project.projectId && $0.isActive != false }
        let names = Dictionary(uniqueKeysWithValues: store.memberMaster.map { ($0.memberId, $0.displayName) })
        let roleNames: (String) -> String = { flag in
            activeMembers.filter {
                switch flag {
                case "PL": return $0.isPL == true
                case "PM": return $0.isPM == true
                default: return $0.isCloser == true
                }
            }.map { names[$0.memberId] ?? $0.memberId }.joined(separator: " / ")
        }
        AMDOSCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(project.projectName).font(.headline)
                        Text(project.projectId).font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                        if let client = project.clientName?.trimmedNonEmpty { Text(client).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    }
                    Spacer()
                    AMDOSStatusBadge(text: project.status, tint: project.status == "active" ? AMDOSDesign.success : AMDOSDesign.muted)
                    AMDOSStatusBadge(text: project.projectCategory ?? "dtsu", tint: AMDOSDesign.blue)
                    Button("設定を編集") { selectedProject = project }.buttonStyle(.borderedProminent)
                }
                HStack(spacing: 8) {
                    if !roleNames("PL").isEmpty { AMDOSStatusBadge(text: "PL: \(roleNames("PL"))", tint: AMDOSDesign.blue) }
                    if !roleNames("PM").isEmpty { AMDOSStatusBadge(text: "PM: \(roleNames("PM"))", tint: AMDOSDesign.success) }
                    if !roleNames("closer").isEmpty { AMDOSStatusBadge(text: "クローザー: \(roleNames("closer"))", tint: AMDOSDesign.warning) }
                    if activeMembers.isEmpty { Text("参加メンバー未設定").font(.caption).foregroundStyle(AMDOSDesign.warning) }
                }
                Text([
                    [project.startYm, project.endYm].compactMap { $0 }.joined(separator: " 〜 "),
                    project.feeAmount.map { "委託料 \(Int($0).formatted())円" },
                    project.slackChannelNotRequired == true ? "Slack不要" : project.slackChannelID?.trimmedNonEmpty.map { "Slack \($0)" }
                ].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
                if let suggestion = store.suggestions.first(where: { $0.projectId == project.projectId }) {
                    HStack(spacing: 8) {
                        Image(systemName: "sparkles").foregroundStyle(AMDOSDesign.warning)
                        Text("lane提案\(suggestion.confidence.map { " \(Int(($0 * 100).rounded()))%" } ?? "")")
                            .font(.caption.weight(.semibold))
                        Text(suggestion.reasoning?.trimmedNonEmpty ?? "提案内容を確認してね。")
                            .font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                        Spacer()
                        Button("採用") { Task { await store.applySuggestion(suggestion, action: "approve") } }.buttonStyle(.bordered)
                        Button("却下") { Task { await store.applySuggestion(suggestion, action: "reject") } }.buttonStyle(.bordered)
                    }
                }
            }
        }
    }
}

// MARK: - Project administration and existing config bridge

private struct AMDOSAdminProjectParityEditor: View {
    let project: AMDOSAdminParityProject
    let venture: AMDOSAdminParityVenture?
    let suggestion: AMDOSAdminParityLaneSuggestion?
    let onSuggestionAction: (AMDOSAdminParityLaneSuggestion, String) -> Void
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var projectName: String
    @State private var clientName: String
    @State private var category: String
    @State private var slackChannelID: String
    @State private var slackNotRequired: Bool
    @State private var driveFolderID: String
    @State private var freeePartnerID: String
    @State private var shareholderWatch: Bool
    @State private var boardWatch: Bool
    @State private var freezeFromYm: String
    @State private var restartExpectedYm: String
    @State private var newsSearchQuery: String
    @State private var reportScope: String
    @State private var reportAlias: String
    @State private var reportAllowTerms: String
    @State private var contractTerms: AMDOSAdminParityContractTerms
    @State private var workContentText: String
    @State private var laneRows: [AMDOSAdminParityLaneDraft]
    @State private var showingProjectConfig = false
    @State private var savingProject = false
    @State private var message: String?

    init(
        project: AMDOSAdminParityProject,
        venture: AMDOSAdminParityVenture?,
        suggestion: AMDOSAdminParityLaneSuggestion?,
        onSuggestionAction: @escaping (AMDOSAdminParityLaneSuggestion, String) -> Void,
        onSaved: @escaping () -> Void
    ) {
        self.project = project
        self.venture = venture
        self.suggestion = suggestion
        self.onSuggestionAction = onSuggestionAction
        self.onSaved = onSaved
        _projectName = State(initialValue: project.projectName)
        _clientName = State(initialValue: project.clientName ?? "")
        _category = State(initialValue: project.projectCategory ?? "dtsu")
        _slackChannelID = State(initialValue: project.slackChannelID ?? "")
        _slackNotRequired = State(initialValue: project.slackChannelNotRequired == true)
        _driveFolderID = State(initialValue: project.driveFolderID ?? "")
        _freeePartnerID = State(initialValue: project.freeePartnerID ?? "")
        _shareholderWatch = State(initialValue: project.governanceWatchShareholderMeetings == true)
        _boardWatch = State(initialValue: project.governanceWatchBoardMeetings == true)
        _freezeFromYm = State(initialValue: project.freezeFromYm ?? "")
        _restartExpectedYm = State(initialValue: project.restartExpectedYm ?? "")
        _newsSearchQuery = State(initialValue: project.newsSearchQuery ?? "")
        _reportScope = State(initialValue: project.monthlyReportScope ?? "none")
        _reportAlias = State(initialValue: project.reportLocalAlias ?? "")
        _reportAllowTerms = State(initialValue: (project.reportExtraAllowTerms ?? []).joined(separator: ", "))
        _contractTerms = State(initialValue: AMDOSAdminParityContractTerms(project.contractTermsJSON))
        _workContentText = State(initialValue: AMDOSAdminParityJSON.array(project.workContent ?? []).prettyJSONString)
        _laneRows = State(initialValue: AMDOSAdminParityLaneDraft.makeRows(from: venture?.lanes ?? suggestion?.suggestedLanes))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(project.projectName).font(.title2.weight(.bold))
                        Text(project.projectId)
                            .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer()
                    AMDOSStatusBadge(text: project.status, tint: project.status == "active" ? AMDOSDesign.success : AMDOSDesign.muted)
                }
                configBridgeSection
                managementSection
                integrationAndReportSection
                governanceAndLifecycleSection
                jsonTermsAndLaneSection
                HStack {
                    Button("閉じる") { dismiss() }.buttonStyle(.bordered)
                    Spacer()
                    Button(savingProject ? "保存中…" : "管理項目を保存") { saveProject() }
                        .buttonStyle(.borderedProminent)
                        .disabled(savingProject)
                }
                if let message = message?.trimmedNonEmpty {
                    Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                }
            }
            .padding(28)
        }
        .frame(minWidth: 860, minHeight: 720)
        .sheet(isPresented: $showingProjectConfig, onDismiss: onSaved) {
            AMDOSProjectConfigView(projectId: project.projectId)
                .frame(minWidth: 900, minHeight: 720)
        }
    }

    private var configBridgeSection: some View {
        AMDOSSectionCard("PJ設定・参加メンバー", systemImage: "person.3.fill") {
            Text("既存のPJ設定画面で、状態・契約/請求・支払条件とPJメンバー（PL / PM / クローザー・参画期間・論理削除・完全削除）をまとめて管理するよ。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            Button("PJ設定・参加メンバーを開く") { showingProjectConfig = true }
                .buttonStyle(.borderedProminent)
        }
    }

    private var managementSection: some View {
        AMDOSSectionCard("PJ台帳", systemImage: "folder.badge.gearshape") {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                AMDOSTextField(title: "PJ名 *", text: $projectName)
                AMDOSTextField(title: "請求先 / クライアント", text: $clientName)
                Picker("分類", selection: $category) {
                    Text("DTSU").tag("dtsu")
                    Text("新規事業創出").tag("new_business")
                    Text("Ecosystem").tag("ecosystem")
                    Text("Advisor").tag("advisor")
                }
            }
        }
    }

    private var integrationAndReportSection: some View {
        AMDOSSectionCard("連携・月報", systemImage: "link") {
            Toggle("Slackチャンネルを使わない", isOn: $slackNotRequired)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                AMDOSTextField(title: "Slack channel ID", text: $slackChannelID)
                    .disabled(slackNotRequired)
                AMDOSTextField(title: "Drive folder ID", text: $driveFolderID)
                AMDOSTextField(title: "freee取引先 ID", text: $freeePartnerID)
                Picker("月報 scope", selection: $reportScope) {
                    Text("対象外").tag("none")
                    Text("内部のみ").tag("internal_only")
                    Text("内部 + 対外").tag("internal_and_external")
                }
                AMDOSTextField(title: "対外版ローカル別名", text: $reportAlias)
            }
            AMDOSTextField(title: "対外版の禁止語 allow（カンマ区切り）", text: $reportAllowTerms)
        }
    }

    private var governanceAndLifecycleSection: some View {
        AMDOSSectionCard("ガバナンス・稼働状態", systemImage: "building.columns") {
            HStack(spacing: 18) {
                Toggle("株主総会を監視", isOn: $shareholderWatch)
                Toggle("取締役会を監視", isOn: $boardWatch)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                AMDOSTextField(title: "凍結開始 ym (YYYYMM)", text: $freezeFromYm)
                AMDOSTextField(title: "再開予定 ym (YYYYMM)", text: $restartExpectedYm)
            }
            AMDOSTextField(title: "ニュースサーチクエリ", text: $newsSearchQuery, axis: .vertical)
        }
    }

    private var jsonTermsAndLaneSection: some View {
        AMDOSSectionCard("詳細契約・業務内容・技術領域", systemImage: "doc.text.magnifyingglass") {
            Text("契約条件は台帳の既存項目を保ったまま更新するよ。基本の請求・支払条件は上のPJ設定から変更できる。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            contractTermsEditor
            workContentEditor
            laneEditor
        }
    }

    private var contractTermsEditor: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("契約の詳細").font(.subheadline.weight(.semibold))
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                AMDOSTextField(title: "月額（税抜・円）", text: $contractTerms.monthlyFeeYen)
                AMDOSTextField(title: "月次報酬上限（円）", text: $contractTerms.monthlyRewardCapYen)
                AMDOSTextField(title: "契約開始 ym", text: $contractTerms.contractStartYm)
                AMDOSTextField(title: "契約終了 ym", text: $contractTerms.contractEndYm)
                AMDOSTextField(title: "実働開始 ym", text: $contractTerms.actualWorkStartYm)
                AMDOSTextField(title: "請求開始 ym", text: $contractTerms.billingStartYm)
                AMDOSTextField(title: "報酬原資総額（円）", text: $contractTerms.rewardPoolYen)
                Picker("提出物", selection: $contractTerms.deliverablesRequired) {
                    Text("未確認").tag("")
                    Text("あり").tag("true")
                    Text("なし").tag("false")
                }
            }
            AMDOSTextField(title: "提出物の補足", text: $contractTerms.deliverablesNote, axis: .vertical)
            Picker("月次報告", selection: $contractTerms.monthlyReportSubmissionRule) {
                Text("未確認").tag("")
                Text("要提出").tag("要提出")
                Text("不要").tag("不要")
                Text("指定なし").tag("指定なし")
                Text("要確認").tag("要確認")
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                AMDOSTextField(title: "月次報告の時期", text: $contractTerms.monthlyReportSubmissionTiming)
                AMDOSTextField(title: "提出期限", text: $contractTerms.monthlyReportSubmissionDeadline)
                AMDOSTextField(title: "フォーマット", text: $contractTerms.monthlyReportSubmissionFormat)
                AMDOSTextField(title: "立替精算", text: $contractTerms.expenseReimbursementValue)
            }
            AMDOSTextField(title: "月次報告の記載事項", text: $contractTerms.monthlyReportSubmissionRequiredItems, axis: .vertical)
            AMDOSTextField(title: "月次報告の補足", text: $contractTerms.monthlyReportSubmissionNote, axis: .vertical)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                AMDOSTextField(title: "根拠資料名", text: $contractTerms.sourceTitle)
                AMDOSTextField(title: "根拠リンク・参照", text: $contractTerms.sourceRef)
            }
            AMDOSTextField(title: "契約メモ", text: $contractTerms.notes, axis: .vertical)
        }
    }

    private var workContentEditor: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("業務内容").font(.subheadline.weight(.semibold))
            Text("「名称」と必要なら「説明」を一覧として入力するよ。例: [{\"name\":\"規程策定\",\"description\":\"…\"}]")
                .font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
            TextEditor(text: $workContentText)
                .font(.system(.body, design: .monospaced))
                .frame(minHeight: 130)
                .padding(6)
                .overlay(RoundedRectangle(cornerRadius: 7).stroke(AMDOSDesign.border, lineWidth: 1))
        }
    }

    private var laneEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("技術領域").font(.subheadline.weight(.semibold))
            if venture != nil {
                Text("1〜3領域を選び、比重の合計を100%にして保存するよ。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                ForEach($laneRows) { $row in
                    HStack(spacing: 12) {
                        Toggle(row.label, isOn: $row.isSelected)
                        Spacer()
                        if row.isSelected {
                            TextField("比重", text: $row.weight)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 92)
                            Text("%")
                                .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                }
                HStack {
                    Button("等分にする") { distributeLaneWeights() }.buttonStyle(.bordered)
                    Spacer()
                    Text("合計 \(Int((laneWeightTotal * 100).rounded()))%")
                        .font(.caption.monospaced())
                        .foregroundStyle(laneWeightsAreValid ? AMDOSDesign.success : AMDOSDesign.warning)
                }
            } else {
                Text("このPJは技術領域の登録対象外だよ。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            if let suggestion {
                VStack(alignment: .leading, spacing: 8) {
                    Label("AIからの技術領域提案", systemImage: "sparkles")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AMDOSDesign.warning)
                    Text(suggestion.reasoning?.trimmedNonEmpty ?? "提案理由は未記載")
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    HStack {
                        Text("確信度 \(suggestion.confidence.map { "\(Int(($0 * 100).rounded()))%" } ?? "—")")
                            .font(.caption.monospaced())
                            .foregroundStyle(AMDOSDesign.muted)
                        Spacer()
                        Button("提案を却下") { onSuggestionAction(suggestion, "reject"); dismiss() }
                            .buttonStyle(.bordered)
                        Button("提案を採用") { onSuggestionAction(suggestion, "approve"); dismiss() }
                            .buttonStyle(.borderedProminent)
                            .disabled(venture == nil)
                    }
                }
                .padding(.top, 4)
            }
        }
    }

    private var selectedLaneRows: [AMDOSAdminParityLaneDraft] {
        laneRows.filter(\.isSelected)
    }

    private var laneWeightTotal: Double {
        selectedLaneRows.reduce(0) { $0 + (Double($1.weight.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0) / 100 }
    }

    private var laneWeightsAreValid: Bool {
        (1...3).contains(selectedLaneRows.count)
            && selectedLaneRows.allSatisfy {
                guard let percent = Double($0.weight.trimmingCharacters(in: .whitespacesAndNewlines)) else { return false }
                return (0...100).contains(percent)
            }
            && abs(laneWeightTotal - 1) < 0.001
    }

    private func distributeLaneWeights() {
        let selectedIndices = laneRows.indices.filter { laneRows[$0].isSelected }
        guard !selectedIndices.isEmpty else { return }
        let unit = 100.0 / Double(selectedIndices.count)
        let rounded = (unit * 10).rounded() / 10
        for index in selectedIndices { laneRows[index].weight = String(format: "%.1f", rounded) }
        let currentTotal = selectedIndices.reduce(0) { $0 + (Double(laneRows[$1].weight) ?? 0) }
        if let first = selectedIndices.first {
            laneRows[first].weight = String(format: "%.1f", (Double(laneRows[first].weight) ?? 0) + 100 - currentTotal)
        }
    }

    private func lanesValue() throws -> AMDOSAdminParityJSON? {
        guard venture != nil else { return nil }
        guard laneWeightsAreValid else {
            throw AMDOSNetworkError.http("技術領域は1〜3件を選び、比重の合計を100%にしてね")
        }
        let rows = try selectedLaneRows.map { row -> AMDOSAdminParityJSON in
            guard let percent = Double(row.weight.trimmingCharacters(in: .whitespacesAndNewlines)), percent >= 0, percent <= 100 else {
                throw AMDOSNetworkError.http("技術領域の比重は0〜100で入力してね")
            }
            return .object(["domain": .string(row.id), "weight": .number(percent / 100)])
        }
        return .array(rows)
    }

    private func saveProject() {
        let yms = [freezeFromYm, restartExpectedYm]
        guard projectName.trimmedNonEmpty != nil else { message = "PJ名は必須だよ"; return }
        guard yms.allSatisfy(amdOSAdminParityYMIsValid) else { message = "年月は YYYYMM 形式で入力してね"; return }

        do {
            let workContent = try amdOSAdminParityParseJSON(workContentText, expected: "array")
            let lanes = try lanesValue()
            let mergedTerms = contractTerms.merged(into: project.contractTermsJSON)
            let termsValue: AMDOSAdminParityJSON = mergedTerms.objectValue?.isEmpty == true ? .null : mergedTerms
            let patch: [String: AMDOSAdminParityJSON] = [
                "project_name": .string(projectName.trimmingCharacters(in: .whitespacesAndNewlines)),
                "client_name": amdOSAdminParityNullable(clientName),
                "project_category": .string(category),
                "slack_channel_not_required": .bool(slackNotRequired),
                "slack_channel_id": slackNotRequired ? .null : amdOSAdminParityNullable(slackChannelID),
                "drive_folder_id": amdOSAdminParityNullable(driveFolderID),
                "freee_partner_id": amdOSAdminParityNullable(freeePartnerID),
                "governance_watch_shareholder_meetings": .bool(shareholderWatch),
                "governance_watch_board_meetings": .bool(boardWatch),
                "freeze_from_ym": amdOSAdminParityNullable(freezeFromYm),
                "restart_expected_ym": amdOSAdminParityNullable(restartExpectedYm),
                "news_search_query": amdOSAdminParityNullable(newsSearchQuery),
                "monthly_report_scope": .string(["internal_only", "internal_and_external"].contains(reportScope) ? reportScope : "none"),
                "report_local_alias": amdOSAdminParityNullable(reportAlias),
                "report_extra_allow_terms": .array(reportAllowTerms.split(whereSeparator: { $0 == "," || $0 == "、" }).map { .string($0.trimmingCharacters(in: .whitespacesAndNewlines)) }.filter {
                    if case .string(let value) = $0 { return !value.isEmpty }
                    return false
                }),
                "contract_terms_json": termsValue,
                "work_content": workContent
            ]
            let request = AMDOSAdminParityProjectPatchRequest(projectsPatch: patch, venturesPatch: lanes.map { ["lanes": $0] })
            Task {
                savingProject = true
                defer { savingProject = false }
                do {
                    let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/projects/\(project.id)", method: "PATCH", body: request)
                    let response = try JSONDecoder().decode(AMDOSAdminParityOKResponse.self, from: data)
                    guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "PJ設定を保存できなかった") }
                    onSaved()
                    dismiss()
                } catch {
                    message = error.localizedDescription
                }
            }
        } catch {
            message = error.localizedDescription
        }
    }
}

private struct AMDOSAdminParityProjectPatchRequest: Encodable, Sendable {
    let projectsPatch: [String: AMDOSAdminParityJSON]
    let venturesPatch: [String: AMDOSAdminParityJSON]?
    enum CodingKeys: String, CodingKey { case projectsPatch, venturesPatch }
}

private struct AMDOSAdminParityLaneSuggestionAction: Encodable, Sendable { let action: String }
private struct AMDOSAdminParityOKResponse: Decodable, Sendable { let ok: Bool?; let error: String? }

// MARK: - PWA /admin/members

private struct AMDOSAdminParityMemberLedger: Codable, Identifiable, Sendable {
    let id: String
    let memberId: String
    let codeName: String
    let memberName: String?
    let email: String
    let role: String?
    let status: String
    let osAccessScope: String?
    let isAdmin: Bool?
    let isOfficer: Bool?
    let excludeFromPayoutNotice: Bool?
    let slackID: String?
    let joinYm: String?
    let leaveYm: String?
    let bankInfo: String?
    let memberAddress: String?
    let contractorName: String?
    let invoiceRegistrationNumber: String?
    let googleCalendarStatus: String?
    let googleCalendarCheckedAt: String?
    let googleCalendarConnectedAt: String?
    let googleCalendarError: String?
    let lastLoginAt: String?
    let createdAt: String?
    let updatedAt: String?

    var scope: String { osAccessScope == "project" ? "project" : "portfolio" }
    var calendarLabel: String {
        if scope == "project" { return "対象外（PJ限定）" }
        switch googleCalendarStatus ?? "missing" {
        case "connected": return "接続済み"
        case "error": return "接続エラー"
        default: return "接続必須"
        }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case memberId = "member_id"
        case codeName = "code_name"
        case memberName = "member_name"
        case email, role, status
        case osAccessScope = "os_access_scope"
        case isAdmin = "is_admin"
        case isOfficer = "is_officer"
        case excludeFromPayoutNotice = "exclude_from_payout_notice"
        case slackID = "slack_id"
        case joinYm = "join_ym"
        case leaveYm = "leave_ym"
        case bankInfo = "bank_info"
        case memberAddress = "member_address"
        case contractorName = "contractor_name"
        case invoiceRegistrationNumber = "invoice_registration_number"
        case googleCalendarStatus = "google_calendar_status"
        case googleCalendarCheckedAt = "google_calendar_checked_at"
        case googleCalendarConnectedAt = "google_calendar_connected_at"
        case googleCalendarError = "google_calendar_error"
        case lastLoginAt = "last_login_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

@MainActor
private final class AMDOSAdminMembersParityStore: ObservableObject {
    @Published var members: [AMDOSAdminParityMemberLedger] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?

    func load() async {
        state = .loading
        message = nil
        do {
            members = try await AMDOSRESTClient.shared.fetchTable(
                AMDOSAdminParityMemberLedger.self,
                table: "members",
                select: "id,member_id,code_name,member_name,email,role,status,os_access_scope,is_admin,is_officer,exclude_from_payout_notice,slack_id,join_ym,leave_ym,bank_info,member_address,contractor_name,invoice_registration_number,google_calendar_status,google_calendar_checked_at,google_calendar_connected_at,google_calendar_error,last_login_at,created_at,updated_at",
                order: "member_id",
                limit: 2_000
            )
            state = members.isEmpty ? .empty : .loaded
        } catch {
            message = error.localizedDescription
            state = .failed(message ?? "メンバー台帳を読み込めなかった")
        }
    }
}

struct AMDOSAdminMembersView: View {
    @StateObject private var store = AMDOSAdminMembersParityStore()
    @State private var searchText = ""
    @State private var statusFilter = ""
    @State private var selectedMember: AMDOSAdminParityMemberLedger?
    @State private var showingProjectAccountCreate = false

    private var filteredMembers: [AMDOSAdminParityMemberLedger] {
        store.members.filter { member in
            let statusMatch = statusFilter.isEmpty || member.status == statusFilter
            let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            let searchMatch = query.isEmpty || [member.codeName, member.memberId, member.memberName ?? "", member.email, member.contractorName ?? "", member.memberAddress ?? "", member.invoiceRegistrationNumber ?? ""]
                .contains { $0.localizedCaseInsensitiveContains(query) }
            return statusMatch && searchMatch
        }
        .sorted {
            let left = $0.lastLoginAt ?? ""
            let right = $1.lastLoginAt ?? ""
            return left == right ? $0.codeName.localizedCompare($1.codeName) == .orderedAscending : left > right
        }
    }

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "ADMIN MEMBERS",
            title: "メンバー台帳",
            subtitle: "アカウントの表示範囲、権限、在籍、通知先を管理"
        ) {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            AMDOSSectionCard("PJ限定アカウントを追加", systemImage: "person.badge.plus") {
                Text("登録後に、PJ台帳から参加PJを追加してね。参加PJだけを使うアカウントとして作成するよ。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                Button("PJ限定アカウントを登録") { showingProjectAccountCreate = true }.buttonStyle(.borderedProminent)
            }
            HStack(spacing: 12) {
                Picker("状態", selection: $statusFilter) {
                    Text("すべて").tag("")
                    ForEach(["active", "inactive", "left"], id: \.self) { Text($0).tag($0) }
                }.frame(maxWidth: 160)
                TextField("codeName / email / ID を検索", text: $searchText).textFieldStyle(.roundedBorder)
                Text("\(filteredMembers.count)件").font(.caption).foregroundStyle(AMDOSDesign.muted)
                Button("再読み込み") { Task { await store.load() } }.buttonStyle(.bordered)
            }
            if let message = store.message?.trimmedNonEmpty {
                Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
            }
            AMDOSSectionCard("メンバー", systemImage: "person.2.fill") {
                if filteredMembers.isEmpty, case .loaded = store.state {
                    Text("条件に一致するメンバーがいないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                ForEach(filteredMembers) { member in
                    Button { selectedMember = member } label: { memberRow(member) }.buttonStyle(.plain)
                }
            }
        }
        .task { await store.load() }
        .sheet(item: $selectedMember) { member in
            AMDOSAdminMemberParityEditor(member: member, onSaved: { Task { await store.load() } })
        }
        .sheet(isPresented: $showingProjectAccountCreate) {
            AMDOSAdminProjectScopedAccountCreate { Task { await store.load() } }
        }
    }

    @ViewBuilder
    private func memberRow(_ member: AMDOSAdminParityMemberLedger) -> some View {
        AMDOSCard {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(member.codeName).font(.headline)
                    Text("\(member.memberId) · \(member.memberName ?? "表示名未設定")").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    Text(member.email).font(.caption).foregroundStyle(AMDOSDesign.muted)
                    Text([member.role, member.joinYm.map { "入社 \($0)" }, member.leaveYm.map { "離脱 \($0)" }].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · "))
                        .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 5) {
                    AMDOSStatusBadge(text: member.status, tint: member.status == "active" ? AMDOSDesign.success : AMDOSDesign.muted)
                    AMDOSStatusBadge(text: member.scope == "project" ? "参加PJ限定" : "全PJ", tint: member.scope == "project" ? AMDOSDesign.blue : AMDOSDesign.muted)
                    if member.isAdmin == true { AMDOSStatusBadge(text: "admin", tint: AMDOSDesign.success) }
                    if member.isOfficer == true { AMDOSStatusBadge(text: "役員", tint: AMDOSDesign.warning) }
                    Text(member.calendarLabel).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                }
            }
        }
    }
}

private struct AMDOSAdminMemberParityEditor: View {
    let member: AMDOSAdminParityMemberLedger
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var codeName: String
    @State private var memberName: String
    @State private var email: String
    @State private var role: String
    @State private var status: String
    @State private var scope: String
    @State private var joinYm: String
    @State private var leaveYm: String
    @State private var isAdmin: Bool
    @State private var isOfficer: Bool
    @State private var excludeFromPayoutNotice: Bool
    @State private var slackID: String
    @State private var contractorName: String
    @State private var memberAddress: String
    @State private var invoiceRegistrationNumber: String
    @State private var saving = false
    @State private var message: String?

    init(member: AMDOSAdminParityMemberLedger, onSaved: @escaping () -> Void) {
        self.member = member
        self.onSaved = onSaved
        _codeName = State(initialValue: member.codeName)
        _memberName = State(initialValue: member.memberName ?? "")
        _email = State(initialValue: member.email)
        _role = State(initialValue: member.role ?? "")
        _status = State(initialValue: member.status)
        _scope = State(initialValue: member.scope)
        _joinYm = State(initialValue: member.joinYm ?? "")
        _leaveYm = State(initialValue: member.leaveYm ?? "")
        _isAdmin = State(initialValue: member.isAdmin == true)
        _isOfficer = State(initialValue: member.isOfficer == true)
        _excludeFromPayoutNotice = State(initialValue: member.excludeFromPayoutNotice == true)
        _slackID = State(initialValue: member.slackID ?? "")
        _contractorName = State(initialValue: member.contractorName?.trimmedNonEmpty ?? member.memberName?.trimmedNonEmpty ?? member.codeName)
        _memberAddress = State(initialValue: member.memberAddress ?? "")
        _invoiceRegistrationNumber = State(initialValue: member.invoiceRegistrationNumber ?? "")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(member.codeName).font(.title2.weight(.bold))
                        Text("member_id: \(member.memberId)").font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer()
                    AMDOSStatusBadge(text: member.calendarLabel, tint: scope == "project" ? AMDOSDesign.muted : (member.googleCalendarStatus == "connected" ? AMDOSDesign.success : AMDOSDesign.warning))
                }
                AMDOSSectionCard("本人・在籍", systemImage: "person.text.rectangle") {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        AMDOSTextField(title: "codeName *", text: $codeName)
                        AMDOSTextField(title: "表示名", text: $memberName)
                        AMDOSTextField(title: "メール *", text: $email)
                        AMDOSTextField(title: "role", text: $role)
                        Picker("状態", selection: $status) {
                            ForEach(["active", "inactive", "left"], id: \.self) { Text($0).tag($0) }
                        }
                        Picker("OS表示範囲", selection: $scope) {
                            Text("全PJ").tag("portfolio")
                            Text("参加PJ限定").tag("project")
                        }
                        AMDOSTextField(title: "join ym (YYYYMM)", text: $joinYm)
                        AMDOSTextField(title: "leave ym (YYYYMM)", text: $leaveYm)
                    }
                    if scope == "project" {
                        Text("PJ限定にすると、参加設定されたPJだけを使うアカウントになるよ。PJ台帳で参加メンバーに追加してね。")
                            .font(.caption).foregroundStyle(AMDOSDesign.warning)
                    }
                }
                AMDOSSectionCard("権限・連携", systemImage: "lock.shield") {
                    Toggle("管理者", isOn: $isAdmin)
                    Toggle("役員", isOn: $isOfficer)
                    Toggle("支払通知から除外", isOn: $excludeFromPayoutNotice)
                    AMDOSTextField(title: "Slack ID", text: $slackID)
                    Text("Google Calendar: \(member.calendarLabel)\(member.googleCalendarError?.trimmedNonEmpty.map { " · \($0)" } ?? "")")
                        .font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
                    Text("最終ログイン: \(member.lastLoginAt ?? "—")").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                AMDOSSectionCard("支払通知書", systemImage: "doc.plaintext") {
                    AMDOSTextField(title: "契約者名", text: $contractorName)
                    AMDOSTextField(title: "住所", text: $memberAddress, axis: .vertical)
                    AMDOSTextField(title: "インボイス登録番号", text: $invoiceRegistrationNumber)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("口座情報（読み取り専用）").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        Text(member.bankInfo?.trimmedNonEmpty ?? "未登録").font(.caption).textSelection(.enabled)
                    }
                }
                HStack {
                    Button("閉じる") { dismiss() }.buttonStyle(.bordered)
                    Spacer()
                    Button(saving ? "保存中…" : "メンバーを保存") { save() }.buttonStyle(.borderedProminent).disabled(saving)
                }
                if let message = message?.trimmedNonEmpty {
                    Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                }
            }
            .padding(28)
        }
        .frame(minWidth: 760, minHeight: 680)
    }

    private func save() {
        guard codeName.trimmedNonEmpty != nil, email.trimmedNonEmpty != nil else { message = "codeName とメールは必須だよ"; return }
        guard amdOSAdminParityYMIsValid(joinYm), amdOSAdminParityYMIsValid(leaveYm) else { message = "join / leave は YYYYMM 形式で入力してね"; return }
        let patch: [String: AMDOSAdminParityJSON] = [
            "code_name": .string(codeName.trimmingCharacters(in: .whitespacesAndNewlines)),
            "member_name": amdOSAdminParityNullable(memberName),
            "email": .string(email.trimmingCharacters(in: .whitespacesAndNewlines)),
            "role": amdOSAdminParityNullable(role),
            "status": .string(status),
            "os_access_scope": .string(scope == "project" ? "project" : "portfolio"),
            "join_ym": amdOSAdminParityNullable(joinYm),
            "leave_ym": amdOSAdminParityNullable(leaveYm),
            "is_admin": .bool(isAdmin),
            "is_officer": .bool(isOfficer),
            "exclude_from_payout_notice": .bool(excludeFromPayoutNotice),
            "slack_id": amdOSAdminParityNullable(slackID),
            "contractor_name": .string(contractorName.trimmedNonEmpty ?? codeName.trimmingCharacters(in: .whitespacesAndNewlines)),
            "member_address": amdOSAdminParityNullable(memberAddress),
            "invoice_registration_number": amdOSAdminParityNullable(invoiceRegistrationNumber)
        ]
        Task {
            saving = true
            defer { saving = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/members",
                    method: "PATCH",
                    body: AMDOSAdminParityMemberPatchRequest(id: member.id, patch: patch)
                )
                let response = try JSONDecoder().decode(AMDOSAdminParityMemberPatchResponse.self, from: data)
                guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "メンバーを保存できなかった") }
                onSaved()
                dismiss()
            } catch {
                message = error.localizedDescription
            }
        }
    }
}

private struct AMDOSAdminProjectScopedAccountCreate: View {
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var codeName = ""
    @State private var memberName = ""
    @State private var email = ""
    @State private var saving = false
    @State private var message: String?

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "PROJECT-ONLY ACCOUNT",
            title: "PJ限定アカウントを追加",
            subtitle: "作成後、PJ台帳で参加メンバーに追加するまで使えるPJはないよ。"
        ) {
            AMDOSSectionCard("新規アカウント", systemImage: "person.badge.plus") {
                AMDOSTextField(title: "codeName *", text: $codeName)
                AMDOSTextField(title: "表示名", text: $memberName)
                AMDOSTextField(title: "Googleアカウント *", text: $email)
                HStack {
                    Button("キャンセル") { dismiss() }.buttonStyle(.bordered)
                    Button(saving ? "登録中…" : "登録") { create() }.buttonStyle(.borderedProminent).disabled(saving)
                }
                if let message = message?.trimmedNonEmpty {
                    Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                }
            }
        }
        .frame(minWidth: 620, minHeight: 360)
    }

    private func create() {
        guard codeName.trimmedNonEmpty != nil, email.trimmedNonEmpty != nil else { message = "codeName とGoogleアカウントは必須だよ"; return }
        Task {
            saving = true
            defer { saving = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/members",
                    body: AMDOSAdminParityProjectScopedAccountRequest(codeName: codeName, memberName: memberName, email: email)
                )
                let response = try JSONDecoder().decode(AMDOSAdminParityMemberPatchResponse.self, from: data)
                guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "PJ限定アカウントを登録できなかった") }
                onSaved()
                dismiss()
            } catch {
                message = error.localizedDescription
            }
        }
    }
}

private struct AMDOSAdminParityMemberPatchRequest: Encodable, Sendable {
    let id: String
    let patch: [String: AMDOSAdminParityJSON]
}

private struct AMDOSAdminParityProjectScopedAccountRequest: Encodable, Sendable {
    let codeName: String
    let memberName: String
    let email: String
}

private struct AMDOSAdminParityMemberPatchResponse: Decodable, Sendable {
    let ok: Bool?
    let error: String?
    let member: AMDOSAdminParityMemberLedger?
}
