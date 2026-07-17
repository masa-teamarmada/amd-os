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

    enum CodingKeys: String, CodingKey {
        case id
        case kind
        case title
        case body
        case createdAt = "created_at"
        case readAt = "read_at"
    }

    var displayTitle: String { title?.trimmedNonEmpty ?? "通知" }
    var displayBody: String { body?.trimmedNonEmpty ?? "内容を確認してね。" }
    var isUnread: Bool { readAt == nil }
}

struct AMDOSProjectDetail: Hashable, Sendable {
    let project: AMDOSProject
    let summary: String
    let source: String
}

enum AMDOSSafeWrite: String, CaseIterable, Sendable {
    case notificationFeedback = "通知への判断コメント"
    case businessCardReview = "名刺の人確認"
    case reimbursement = "立替申請"
    case milestoneProgress = "MS進捗の安全な更新"
    case adminLedger = "管理台帳の明示操作"
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
    case today
    case projects
    case projectDetail
    case notifications
    case reimbursements
    case businessCards
    case monthlyAgreement
    case atlas
    case materials
    case seeds
    case poc
    case vcs
    case scholar
    case institutions
    case amdScore
    case adminHome
    case adminInvoices
    case adminFinance
    case adminPayouts
    case adminContracts
    case adminMembers
    case adminGovernance
    case adminPrivateWiki
    case adminManagementKnowledge
    case adminSchedule
    case adminMsOverview
    case adminSeasonPl
    case adminWeekly
    case hud
    case manual
    case spec
    case bzm
    case account

    var id: String { rawValue }
}

struct AMDOSScreenDescriptor: Identifiable, Hashable, Sendable {
    let id: AMDOSScreenID
    let title: String
    let eyebrow: String
    let purpose: String
    let source: String
    let authority: String
    let readStatus: AMDOSParityStatus
    let writeTargets: [AMDOSSafeWrite]
    let note: String?
}

enum AMDOSParityStatus: String, Hashable, Sendable {
    case implemented = "実装済み"
    case shell = "ネイティブ骨格"
    case pending = "未移植"

    var colorName: String {
        switch self {
        case .implemented: return "green"
        case .shell: return "orange"
        case .pending: return "gray"
        }
    }
}

extension String {
    var trimmedNonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

