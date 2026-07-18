import Foundation

struct AMDOSSession: Codable, Equatable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date?
    let email: String?
}

/// PWAのログイン選択肢と同じ二つの入口。PJ限定ログインはCalendar/Gmailを
/// 要求せず、PWA共有のworkspace DTO以外には進ませない。
enum AMDOSLoginScope: String, Codable, Sendable {
    case portfolio
    case project
}

enum AMDOSOSAccessScope: String, Codable, Sendable {
    case portfolio
    case project
}

struct AMDOSProjectWorkspaceNavItem: Codable, Hashable, Sendable, Identifiable {
    let projectId: String
    let projectName: String

    var id: String { projectId }
}

struct AMDOSProjectWorkspaceAccess: Codable, Sendable {
    let memberId: String
    let codeName: String
    let email: String
    let isAdmin: Bool
    let scope: AMDOSOSAccessScope
    let calendarStatus: String
    let projects: [AMDOSProjectWorkspaceNavItem]
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
    case today, mypage, projects, myProjects, projectWorkspace, projectCockpit, projectConfig, projectReportPrint, notifications, reimbursements, businessCards, monthlyAgreement
    case nativeBusinessCards, company, contracts, japaneseCultureMap, knowledgeMap
    case atlasHome, atlasThemes, atlasDecisions, atlasDivergence, atlasInbox, atlasInboxSubmit, atlasMacrotrends, atlasMap
    case materials, seeds, seedDetail, seedInbox, poc, vcs, vcDetail, vcEdit, vcInbox, scholar
    case institutions, institutionDetail, institutionCockpit, institutionAssess
    case ventureMap, amdScore, amdScoreDetail, amdScoreRetrofit, ventureCyberspace, ventureOscillator, ventureStateSpace, ventureSuDetail, ventureTimeline3D, managementScore, proactive
    case adminHome, adminCompany, adminContexts, adminInvoices, adminBilling, adminFinance, adminPayouts, adminContracts, adminMembers, adminGovernance
    case adminCoverageGaps, adminIP, adminCultureMap, adminMonthlyAgreements, adminPrivateWiki, adminManagementKnowledge, adminProjects, adminPrompts, adminProtocols
    case adminSchedule, adminMsOverview, adminSeasonPL, adminSettings, adminTsukuyomi, adminWeekly
    case hudDashboard, hudEmbedDashboard, hudNotifications, hudProjectCockpit, hudAtlas, hudSeeds, hudVcs, hudAmdScoreRetrofit, cyber3DLab, cyberGlassCube, cyberHudWall
    case manual, manualDetail, spec, specDetail, bzm, bzmDetail, bzmPublic, bzmPublicDetail, account, paymentConfirm

    var id: String { rawValue }
}

extension String {
    var trimmedNonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
