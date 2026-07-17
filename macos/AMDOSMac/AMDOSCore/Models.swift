import Foundation

struct AMDOSSession: Codable, Equatable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date?
    let email: String?
}

struct AMDOSProject: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let name: String
    let clientName: String?
    let status: String
    let startYm: String?
    let endYm: String?
    let projectType: String?

    enum CodingKeys: String, CodingKey {
        case id = "project_id"
        case name = "project_name"
        case clientName = "client_name"
        case status
        case startYm = "start_ym"
        case endYm = "end_ym"
        case projectType = "project_type"
    }
}

struct AMDOSNotification: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let kind: String?
    let title: String?
    let body: String?
    let createdAt: String?
    let readAt: String?

    var displayTitle: String { title?.trimmedNonEmpty ?? "お知らせ" }
    var displayBody: String { body?.trimmedNonEmpty ?? "内容を確認してね。" }
    var isUnread: Bool { readAt == nil }
}

struct AMDOSProjectDetail: Hashable, Sendable {
    let project: AMDOSProject
    let summary: String
    let source: String
}

enum AMDOSArea: String, CaseIterable, Identifiable, Sendable {
    case work = "仕事"
    case explore = "探索"
    case admin = "管理"
    case settings = "設定"

    var id: String { rawValue }
    var systemImage: String {
        switch self {
        case .work: return "briefcase.fill"
        case .explore: return "safari.fill"
        case .admin: return "slider.horizontal.3"
        case .settings: return "gearshape.fill"
        }
    }
}

enum AMDOSScreenID: String, CaseIterable, Identifiable, Hashable, Sendable {
    case today, projects, projectDetail, notifications, reimbursements, businessCards, monthlyAgreement
    case atlas, materials, seeds, poc, vcs, scholar, institutions, amdScore
    case adminHome, adminInvoices, adminFinance, adminPayouts, adminContracts, adminMembers, adminGovernance
    case adminPrivateWiki, adminManagementKnowledge, adminSchedule, adminMsOverview, adminSeasonPl, adminWeekly
    case hud, manual, spec, bzm, account

    var id: String { rawValue }
}

extension String {
    var trimmedNonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
