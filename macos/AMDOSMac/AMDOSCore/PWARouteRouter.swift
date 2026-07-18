import Foundation

/// PWA の URL を、Mac のネイティブ画面とその表示対象へ変換する。
///
/// `amdos-macos://open?path=/...` と本番 PWA の universal link の両方を受ける。
/// OAuth callback は `AMDOSRootView` が先に処理するため、ここには入れない。
struct AMDOSPWAPathRoute: Hashable, Sendable {
    let screen: AMDOSScreenID
    var projectID: String?
    var seedID: String?
    var vcID: String?
    var institutionID: String?
    var ventureID: String?
    var documentSlug: String?
    var reportYM: String?
    /// PWA deep link の画面固有query。Native側で解釈する値だけを選んで捨てず、
    /// 同じroute到達時にそのまま画面へ渡す。
    var query: [String: String]
    /// `/payment-confirm?token=...` の署名済み token。Mac は内容を解釈せず、
    /// PWA の確認 API にそのまま渡す。
    var paymentConfirmationToken: String?

    init(
        screen: AMDOSScreenID,
        projectID: String? = nil,
        seedID: String? = nil,
        vcID: String? = nil,
        institutionID: String? = nil,
        ventureID: String? = nil,
        documentSlug: String? = nil,
        reportYM: String? = nil,
        query: [String: String] = [:],
        paymentConfirmationToken: String? = nil
    ) {
        self.screen = screen
        self.projectID = projectID
        self.seedID = seedID
        self.vcID = vcID
        self.institutionID = institutionID
        self.ventureID = ventureID
        self.documentSlug = documentSlug
        self.reportYM = reportYM
        self.query = query
        self.paymentConfirmationToken = paymentConfirmationToken
    }

    var area: AMDOSArea {
        switch screen {
        case .adminHome, .adminCompany, .adminContexts, .adminInvoices, .adminBilling, .adminFinance,
             .adminPayouts, .adminContracts, .adminMembers, .adminGovernance, .adminCoverageGaps,
             .adminIP, .adminCultureMap, .adminMonthlyAgreements, .adminPrivateWiki,
             .adminManagementKnowledge, .adminProjects, .adminPrompts, .adminProtocols,
             .adminSchedule, .adminMsOverview, .adminSeasonPL, .adminSettings, .adminTsukuyomi,
             .adminWeekly:
            return .admin
        case .hudDashboard, .hudEmbedDashboard, .hudNotifications, .hudProjectCockpit, .hudAtlas, .hudSeeds, .hudVcs,
             .hudAmdScoreRetrofit, .cyber3DLab, .cyberGlassCube, .cyberHudWall, .manual,
             .manualDetail, .spec, .specDetail, .bzm, .bzmDetail, .bzmPublic, .bzmPublicDetail,
             .account:
            return .settings
        case .today, .mypage, .projects, .myProjects, .projectWorkspace, .projectCockpit, .projectConfig, .projectReportPrint,
             .notifications, .reimbursements, .businessCards, .monthlyAgreement, .nativeBusinessCards,
             .paymentConfirm:
            return .work
        default:
            return .explore
        }
    }
}

enum AMDOSPWAPathRouter {
    /// Route inventory の path を一箇所で解釈する。画面側に URL の文字列分岐を置かない。
    static func route(for url: URL) -> AMDOSPWAPathRoute? {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let query = components?.queryItems ?? []

        // amdos-macos://open?path=/dashboard のような custom URL は path query を優先する。
        if url.scheme?.lowercased() == "amdos-macos", let requestedPath = query.value(named: "path") {
            var requested = URLComponents()
            requested.path = requestedPath
            requested.queryItems = query.filter { $0.name != "path" }
            return route(path: requested.path, queryItems: requested.queryItems ?? [])
        }

        // amdos-macos:///dashboard と universal link の path を同じ parser に送る。
        let path: String
        if url.scheme?.lowercased() == "amdos-macos", !url.host.isNilOrEmpty, url.path.isEmpty {
            path = "/\(url.host ?? "")"
        } else if url.scheme?.lowercased() == "amdos-macos", let host = url.host, host != "open" {
            path = "/\(host)\(url.path)"
        } else {
            path = url.path
        }
        return route(path: path, queryItems: query)
    }

    static func route(path rawPath: String, queryItems: [URLQueryItem] = []) -> AMDOSPWAPathRoute? {
        let path = normalizedPath(rawPath)
        let parts = path.split(separator: "/").map(String.init)
        let query = queryItems
        var queryValues: [String: String] = [:]
        for item in query where queryValues[item.name] == nil {
            if let value = item.value { queryValues[item.name] = value }
        }

        switch parts {
        case []: return AMDOSPWAPathRoute(screen: .today)
        // PWA のログイン/コールバックURLをMacに渡された場合も、外部ブラウザへ
        // 逃がさずネイティブPKCEログイン画面へ収束させる。
        case ["auth", "login"], ["auth", "callback"]:
            return AMDOSPWAPathRoute(screen: .account)
        case ["payment-confirm"]:
            return AMDOSPWAPathRoute(screen: .paymentConfirm, paymentConfirmationToken: query.value(named: "token"))
        case ["dashboard"]: return AMDOSPWAPathRoute(screen: .today)
        case ["mypage"]: return AMDOSPWAPathRoute(screen: .mypage, query: queryValues)
        case ["my-projects"]: return AMDOSPWAPathRoute(screen: .myProjects)
        case ["reimburse"]: return AMDOSPWAPathRoute(screen: .reimbursements)
        case ["business-cards"]: return AMDOSPWAPathRoute(screen: .businessCards)
        case ["native", "business-cards"]: return AMDOSPWAPathRoute(screen: .nativeBusinessCards)
        case ["notifications"]: return AMDOSPWAPathRoute(screen: .notifications, query: queryValues)
        case ["monthly-agreement"]: return AMDOSPWAPathRoute(screen: .monthlyAgreement, reportYM: query.value(named: "ym"), query: queryValues)
        case ["company"]: return AMDOSPWAPathRoute(screen: .company)
        // PWA `/contracts` は `/admin/contracts` へのredirect。Macも同じ管理画面へ収束させる。
        case ["contracts"]: return AMDOSPWAPathRoute(screen: .adminContracts)
        case ["knowledge-map"]: return AMDOSPWAPathRoute(screen: .knowledgeMap)
        case ["poc"]: return AMDOSPWAPathRoute(screen: .poc)
        case ["scholar"]: return AMDOSPWAPathRoute(screen: .scholar)
        case ["management-score"]: return AMDOSPWAPathRoute(screen: .managementScore)
        case ["proactive"]: return AMDOSPWAPathRoute(screen: .proactive)
        case ["japanese-culture-map"]: return AMDOSPWAPathRoute(screen: .adminCultureMap)
        case ["dashboard-cyber-3d-lab"], ["mock", "dashboard-cyber-3d-lab"]: return AMDOSPWAPathRoute(screen: .cyber3DLab)
        case ["dashboard-cyber-glass-cube"], ["mock", "dashboard-cyber-glass-cube"]: return AMDOSPWAPathRoute(screen: .cyberGlassCube)
        case ["dashboard-cyber-hud-wall"], ["mock", "dashboard-cyber-hud-wall"]: return AMDOSPWAPathRoute(screen: .cyberHudWall)

        // PWAの score-detail は独立画面ではなくCockpit内のtab。Macも同じCockpitへ
        // `tab` を渡し、進捗/会社概要と同じ文脈を保ったままスコア詳細を開く。
        case let values where values.count == 3 && values[0] == "project" && values[2] == "workspace":
            return AMDOSPWAPathRoute(screen: .projectWorkspace, projectID: values[1])
        case let values where values.count == 3 && values[0] == "project" && values[2] == "cockpit":
            return AMDOSPWAPathRoute(screen: .projectCockpit, projectID: values[1], reportYM: query.value(named: "ym"), query: queryValues)
        case let values where values.count == 3 && values[0] == "project" && values[2] == "config":
            return AMDOSPWAPathRoute(screen: .projectConfig, projectID: values[1])
        case let values where values.count == 5 && values[0] == "project" && values[2] == "report" && values[4] == "print":
            return AMDOSPWAPathRoute(screen: .projectReportPrint, projectID: values[1], reportYM: values[3])

        case ["atlas"]: return AMDOSPWAPathRoute(screen: .atlasHome)
        case ["atlas", "admin", "themes"]: return AMDOSPWAPathRoute(screen: .atlasThemes)
        case ["atlas", "decisions"]: return AMDOSPWAPathRoute(screen: .atlasDecisions)
        case ["atlas", "divergence"]: return AMDOSPWAPathRoute(screen: .atlasDivergence)
        case ["atlas", "inbox"]: return AMDOSPWAPathRoute(screen: .atlasInbox)
        case ["atlas", "inbox", "submit"]: return AMDOSPWAPathRoute(screen: .atlasInboxSubmit)
        // 標準Atlasの旧macrotrends URLはPWAでdivergenceへredirectされる。
        case ["atlas", "macrotrends"]: return AMDOSPWAPathRoute(screen: .atlasDivergence)
        case ["atlas", "map"]: return AMDOSPWAPathRoute(screen: .atlasMap)

        case ["seeds"]: return AMDOSPWAPathRoute(screen: .seeds)
        case ["seeds", "inbox"]: return AMDOSPWAPathRoute(screen: .seedInbox)
        case let values where values.count == 2 && values[0] == "seeds": return AMDOSPWAPathRoute(screen: .seedDetail, seedID: values[1])
        case ["vcs"]: return AMDOSPWAPathRoute(screen: .vcs)
        case ["vcs", "inbox"]: return AMDOSPWAPathRoute(screen: .vcInbox)
        case let values where values.count == 2 && values[0] == "vcs": return AMDOSPWAPathRoute(screen: .vcDetail, vcID: values[1])
        case let values where values.count == 3 && values[0] == "vcs" && values[2] == "edit": return AMDOSPWAPathRoute(screen: .vcEdit, vcID: values[1])

        case ["institutions"]: return AMDOSPWAPathRoute(screen: .institutions)
        case ["institutions", "assess"]: return AMDOSPWAPathRoute(screen: .institutionAssess)
        case let values where values.count == 2 && values[0] == "institutions": return AMDOSPWAPathRoute(screen: .institutionDetail, institutionID: values[1])
        case let values where values.count == 3 && values[0] == "institutions" && values[2] == "cockpit": return AMDOSPWAPathRoute(screen: .institutionCockpit, institutionID: values[1])

        case ["venture-map"]: return AMDOSPWAPathRoute(screen: .ventureMap)
        case ["venture-map", "amd-score"]: return AMDOSPWAPathRoute(screen: .amdScore)
        case ["venture-map", "amd-score", "retrofit"]: return AMDOSPWAPathRoute(screen: .amdScoreRetrofit)
        case let values where values.count == 3 && values[0] == "venture-map" && values[1] == "amd-score": return AMDOSPWAPathRoute(screen: .amdScoreDetail, projectID: values[2])
        case ["venture-map", "cyberspace"]: return AMDOSPWAPathRoute(screen: .ventureCyberspace)
        case ["venture-map", "oscillator"]: return AMDOSPWAPathRoute(screen: .ventureOscillator)
        case ["venture-map", "state-space"]: return AMDOSPWAPathRoute(screen: .ventureStateSpace)
        case let values where values.count == 3 && values[0] == "venture-map" && values[1] == "su": return AMDOSPWAPathRoute(screen: .ventureSuDetail, ventureID: values[2])
        case ["venture-map", "timeline-3d"]: return AMDOSPWAPathRoute(screen: .ventureTimeline3D)

        // `/manual?topic=` は章slugではなくテーマMapの選択キー。本文slugとして扱うと
        // PWAと違う章を開いてしまうため、queryのままManual画面へ渡す。
        case ["manual"]: return AMDOSPWAPathRoute(screen: .manual, query: queryValues)
        case let values where values.count == 2 && values[0] == "manual": return AMDOSPWAPathRoute(screen: .manualDetail, documentSlug: values[1])
        case ["spec"]: return AMDOSPWAPathRoute(screen: .spec)
        case let values where values.count == 2 && values[0] == "spec": return AMDOSPWAPathRoute(screen: .specDetail, documentSlug: values[1])
        case ["bzm"]: return AMDOSPWAPathRoute(screen: .bzm)
        case ["bzm", "public"]: return AMDOSPWAPathRoute(screen: .bzmPublic)
        case let values where values.count == 3 && values[0] == "bzm" && values[1] == "public": return AMDOSPWAPathRoute(screen: .bzmPublicDetail, documentSlug: values[2])
        case let values where values.count == 2 && values[0] == "bzm": return AMDOSPWAPathRoute(screen: .bzmDetail, documentSlug: values[1])

        case ["hud"], ["hud", "dashboard"]:
            return AMDOSPWAPathRoute(screen: .hudDashboard)
        // PWAの`/hud/dashboard/embed`だけは未ログインで開ける。通常HUDとは
        // 権限境界が異なるため、同じscreen IDに潰さずRootで公開read modelを開く。
        case ["hud", "dashboard", "embed"]:
            return AMDOSPWAPathRoute(screen: .hudEmbedDashboard)
        case ["hud", "notifications"]: return AMDOSPWAPathRoute(screen: .hudNotifications)
        case let values where values.count == 4 && values[0] == "hud" && values[1] == "project" && values[3] == "cockpit":
            return AMDOSPWAPathRoute(screen: .hudProjectCockpit, projectID: values[2], reportYM: query.value(named: "ym"), query: queryValues)
        case ["hud", "atlas"]: return AMDOSPWAPathRoute(screen: .hudAtlas)
        case ["hud", "atlas", "admin", "themes"]: return AMDOSPWAPathRoute(screen: .atlasThemes)
        case ["hud", "atlas", "decisions"]: return AMDOSPWAPathRoute(screen: .atlasDecisions)
        case ["hud", "atlas", "divergence"]: return AMDOSPWAPathRoute(screen: .atlasDivergence)
        case ["hud", "atlas", "inbox"]: return AMDOSPWAPathRoute(screen: .atlasInbox)
        case ["hud", "atlas", "inbox", "submit"]: return AMDOSPWAPathRoute(screen: .atlasInboxSubmit)
        case ["hud", "atlas", "macrotrends"]: return AMDOSPWAPathRoute(screen: .atlasMacrotrends)
        case ["hud", "atlas", "map"]: return AMDOSPWAPathRoute(screen: .atlasMap)
        case ["hud", "seeds"]: return AMDOSPWAPathRoute(screen: .hudSeeds)
        case ["hud", "seeds", "inbox"]: return AMDOSPWAPathRoute(screen: .seedInbox)
        case let values where values.count == 3 && values[0] == "hud" && values[1] == "seeds": return AMDOSPWAPathRoute(screen: .seedDetail, seedID: values[2])
        case ["hud", "vcs"]: return AMDOSPWAPathRoute(screen: .hudVcs)
        case ["hud", "vcs", "inbox"]: return AMDOSPWAPathRoute(screen: .vcInbox)
        case let values where values.count == 3 && values[0] == "hud" && values[1] == "vcs": return AMDOSPWAPathRoute(screen: .vcDetail, vcID: values[2])
        case let values where values.count == 4 && values[0] == "hud" && values[1] == "vcs" && values[3] == "edit": return AMDOSPWAPathRoute(screen: .vcEdit, vcID: values[2])
        case ["hud", "venture-map", "amd-score", "retrofit"]: return AMDOSPWAPathRoute(screen: .hudAmdScoreRetrofit)

        case ["admin"]: return AMDOSPWAPathRoute(screen: .adminHome)
        case let values where values.count == 2 && values[0] == "admin":
            return adminRoute(for: values[1], query: queryValues)
        default:
            return nil
        }
    }

    private static func adminRoute(for key: String, query: [String: String] = [:]) -> AMDOSPWAPathRoute? {
        let screens: [String: AMDOSScreenID] = [
            "billing": .adminInvoices, "company": .adminCompany, "contexts": .adminContexts,
            "contracts": .adminContracts, "coverage-gaps": .adminCoverageGaps, "finance": .adminFinance,
            "governance": .adminGovernance, "invoices": .adminInvoices, "ip": .adminIP,
            "japanese-culture-map": .adminCultureMap, "management-knowledge": .adminManagementKnowledge,
            "members": .adminMembers, "monthly-work-agreements": .adminMonthlyAgreements,
            "ms-overview": .adminMsOverview, "payouts": .adminPayouts, "private-wiki": .adminPrivateWiki,
            "projects": .adminProjects, "prompts": .adminPrompts, "protocols": .adminProtocols,
            "schedule": .adminSchedule, "season-pl": .adminSeasonPL, "settings": .adminSettings,
            "tsukuyomi": .adminTsukuyomi, "weekly": .adminWeekly
        ]
        if key.isEmpty { return AMDOSPWAPathRoute(screen: .adminHome) }
        return screens[key].map { AMDOSPWAPathRoute(screen: $0, projectID: query["projectId"], query: query) }
    }

    private static func normalizedPath(_ rawPath: String) -> String {
        let decoded = rawPath.removingPercentEncoding ?? rawPath
        let path = decoded.hasPrefix("/") ? decoded : "/\(decoded)"
        return path == "/" ? path : path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            .isEmpty ? "/" : "/\(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))"
    }
}

private extension Array where Element == URLQueryItem {
    func value(named name: String) -> String? {
        first(where: { $0.name == name })?.value?.trimmedNonEmpty
    }
}

private extension Optional where Wrapped == String {
    var isNilOrEmpty: Bool { self?.isEmpty ?? true }
}
