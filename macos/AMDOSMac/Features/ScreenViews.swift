import SwiftUI

struct AMDOSScreenView: View {
    let screen: AMDOSScreenID
    @Binding var selectedProjectId: String?
    @Binding var selectedSeedId: String?
    @Binding var selectedVCId: String?
    @Binding var selectedInstitutionId: String?
    @Binding var selectedDocumentSlug: String?
    @Binding var selectedReportYM: String?
    @Binding var selectedVentureID: String?
    @Binding var selectedPaymentConfirmationToken: String?
    let routeQuery: [String: String]
    let onSelectProject: (String) -> Void
    let onSelectSeed: (String) -> Void
    let onSelectVC: (String) -> Void
    let onSelectInstitution: (String) -> Void
    let onOpenProjectCockpit: (String, String?) -> Void
    let onOpenProjectConfig: (String) -> Void
    let onOpenProjectWorkspace: (String) -> Void
    let onOpenMemberMypage: (String) -> Void
    let onOpenMonthlyAgreement: (String, String) -> Void
    let onOpenVenture: (String) -> Void
    let onOpenAmdScoreDetail: (String) -> Void
    let onNavigate: (AMDOSScreenID) -> Void

    init(
        screen: AMDOSScreenID,
        selectedProjectId: Binding<String?>,
        selectedSeedId: Binding<String?>,
        selectedVCId: Binding<String?>,
        selectedInstitutionId: Binding<String?>,
        selectedDocumentSlug: Binding<String?>,
        selectedReportYM: Binding<String?>,
        selectedVentureID: Binding<String?>,
        selectedPaymentConfirmationToken: Binding<String?>,
        routeQuery: [String: String] = [:],
        onSelectProject: @escaping (String) -> Void,
        onSelectSeed: @escaping (String) -> Void,
        onSelectVC: @escaping (String) -> Void,
        onSelectInstitution: @escaping (String) -> Void,
        onOpenProjectCockpit: @escaping (String, String?) -> Void = { _, _ in },
        onOpenProjectConfig: @escaping (String) -> Void = { _ in },
        onOpenProjectWorkspace: @escaping (String) -> Void = { _ in },
        onOpenMemberMypage: @escaping (String) -> Void = { _ in },
        onOpenMonthlyAgreement: @escaping (String, String) -> Void = { _, _ in },
        onOpenVenture: @escaping (String) -> Void = { _ in },
        onOpenAmdScoreDetail: @escaping (String) -> Void = { _ in },
        onNavigate: @escaping (AMDOSScreenID) -> Void = { _ in }
    ) {
        self.screen = screen
        self._selectedProjectId = selectedProjectId
        self._selectedSeedId = selectedSeedId
        self._selectedVCId = selectedVCId
        self._selectedInstitutionId = selectedInstitutionId
        self._selectedDocumentSlug = selectedDocumentSlug
        self._selectedReportYM = selectedReportYM
        self._selectedVentureID = selectedVentureID
        self._selectedPaymentConfirmationToken = selectedPaymentConfirmationToken
        self.routeQuery = routeQuery
        self.onSelectProject = onSelectProject
        self.onSelectSeed = onSelectSeed
        self.onSelectVC = onSelectVC
        self.onSelectInstitution = onSelectInstitution
        self.onOpenProjectCockpit = onOpenProjectCockpit
        self.onOpenProjectConfig = onOpenProjectConfig
        self.onOpenProjectWorkspace = onOpenProjectWorkspace
        self.onOpenMemberMypage = onOpenMemberMypage
        self.onOpenMonthlyAgreement = onOpenMonthlyAgreement
        self.onOpenVenture = onOpenVenture
        self.onOpenAmdScoreDetail = onOpenAmdScoreDetail
        self.onNavigate = onNavigate
    }

    var body: some View {
        Group {
            switch screen {
            case .today: AMDOSParityDashboardView(onSelectProject: onSelectProject, onOpenMypage: { onNavigate(.mypage) }, onOpenProactive: { onNavigate(.proactive) })
            case .mypage: AMDOSParityMypageView(onSelectProject: onSelectProject, onOpenAgreement: { onNavigate(.monthlyAgreement) }, initialMemberId: routeQuery["memberId"])
            case .projects: AMDOSProjectsView(onSelectProject: onSelectProject)
            case .myProjects: AMDOSProjectWorkspaceProjectListView(onSelectProject: onOpenProjectWorkspace)
            case .projectWorkspace: AMDOSProjectWorkspaceView(projectID: selectedProjectId)
            case .projectCockpit: AMDOSParityProjectCockpitView(projectId: selectedProjectId, initialYM: routeQuery["ym"], initialTab: routeQuery["tab"], initialMeetingID: routeQuery["meeting"], initialDocumentID: routeQuery["document"], onOpenConfig: onOpenProjectConfig, onOpenGovernance: { onNavigate(.adminGovernance) })
            case .projectConfig: AMDOSProjectConfigView(projectId: selectedProjectId)
            case .projectReportPrint: AMDOSParityProjectReportView(projectId: selectedProjectId, initialYM: selectedReportYM)
            case .notifications: AMDOSParityNotificationsView(initialNotificationID: routeQuery["notification_id"], initialMeetingID: routeQuery["meeting_id"])
            case .reimbursements: AMDOSParityReimbursementsView()
            case .businessCards: AMDOSParityBusinessCardsView()
            case .nativeBusinessCards: AMDOSParityBusinessCardsView()
            case .monthlyAgreement: AMDOSMonthlyAgreementView(initialYM: selectedReportYM, initialMemberId: routeQuery["memberId"])
            case .company: AMDOSCompanyView()
            case .contracts: AMDOSContractsView()
            // 旧 `/japanese-culture-map` はPWAと同様にadminの文化マップへ収束させる。
            // 旧一覧画面を別実装として残すと、tree / geography / detailの導線が欠ける。
            case .japaneseCultureMap: AMDOSAdminCultureMapView()
            case .knowledgeMap: AMDOSParityKnowledgeMapView()
            case .atlasHome: AMDOSParityAtlasHomeView(onNavigate: onNavigate)
            case .atlasThemes: AMDOSParityAtlasThemesView(onOpenAtlas: { onNavigate(.atlasHome) })
            case .atlasDecisions: AMDOSParityAtlasDecisionsView(onOpenAtlas: { onNavigate(.atlasHome) })
            case .atlasDivergence: AMDOSParityAtlasDivergenceView(onOpenAtlas: { onNavigate(.atlasHome) })
            case .atlasInbox:
                AMDOSParityAtlasInboxView(
                    onOpenAtlas: { onNavigate(.atlasHome) },
                    onOpenSubmit: { onNavigate(.atlasInboxSubmit) }
                )
            case .atlasInboxSubmit:
                AMDOSParityAtlasSubmitView(onOpenInbox: { onNavigate(.atlasInbox) })
            case .atlasMacrotrends: AMDOSParityMacrotrendsView()
            case .atlasMap: AMDOSParityAtlasMapView(onOpenAtlas: { onNavigate(.atlasHome) })
            case .materials: AMDOSMaterialsView()
            case .seeds:
                AMDOSParitySeedsView(
                    onSelectSeed: onSelectSeed,
                    onOpenInbox: { onNavigate(.seedInbox) },
                    onOpenMacrotrends: { onNavigate(.atlasDivergence) }
                )
            case .seedDetail: AMDOSParitySeedDetailView(seedID: selectedSeedId, onClose: { onNavigate(.seeds) })
            case .seedInbox: AMDOSParitySeedInboxView(onSelectSeed: onSelectSeed)
            case .poc: AMDOSPocHubView(onOpenSeeds: { onNavigate(.seeds) })
            case .vcs: AMDOSParityVCListView(onSelectVC: onSelectVC)
            case .vcDetail: AMDOSParityVCDetailView(vcId: selectedVCId)
            case .vcEdit: AMDOSParityVCDetailView(vcId: selectedVCId)
            case .vcInbox: AMDOSParityVCInboxView(onSelectVC: onSelectVC)
            case .scholar: AMDOSParityScholarView()
            case .institutions: AMDOSParityInstitutionsView(onSelectInstitution: onSelectInstitution)
            case .institutionDetail: AMDOSParityInstitutionDetailView(institutionID: selectedInstitutionId)
            case .institutionCockpit:
                AMDOSParityInstitutionCockpitView(
                    institutionID: selectedInstitutionId,
                    onOpenProjectCockpit: onOpenProjectCockpit,
                    onOpenProjectConfig: onOpenProjectConfig,
                    onOpenInstitutionDetail: onSelectInstitution
                )
            case .institutionAssess: AMDOSParityInstitutionAssessView()
            case .ventureMap: AMDOSParityVentureMapView(onSelectProject: onSelectProject, onOpenVenture: onOpenVenture)
            case .amdScore: AMDOSParityAMDScoreView(onSelectProject: onSelectProject)
            case .amdScoreDetail: AMDOSParityAMDScoreDetailView(projectId: selectedProjectId)
            case .amdScoreRetrofit: AMDOSParityAMDScoreRetrofitView()
            case .ventureCyberspace: AMDOSVentureCyberspaceNativeView(onOpenAmdScoreDetail: onOpenAmdScoreDetail)
            case .ventureOscillator: AMDOSVentureOscillatorNativeView()
            case .ventureStateSpace: AMDOSVentureStateSpaceNativeView()
            case .ventureSuDetail: AMDOSVentureSUNativeView(ventureID: selectedVentureID, onBack: { onNavigate(.ventureMap) })
            case .ventureTimeline3D: AMDOSVentureTimelineNativeView(onOpenVenture: onOpenVenture)
            case .managementScore: AMDOSParityManagementScoreView()
            case .proactive: AMDOSParityProactiveView(onSelectProject: onSelectProject)
            case .adminHome: AMDOSAdminHomeView()
            case .adminCompany: AMDOSAdminCompanyView()
            case .adminContexts: AMDOSAdminContextsView()
            case .adminInvoices: AMDOSAdminInvoicesView()
            case .adminBilling: AMDOSAdminInvoicesView()
            case .adminFinance: AMDOSAdminFinanceView()
            case .adminPayouts: AMDOSAdminPayoutsView()
            case .adminContracts: AMDOSAdminContractsView()
            case .adminMembers: AMDOSAdminMembersView()
            case .adminGovernance: AMDOSAdminGovernancePWAView(initialProjectId: selectedProjectId)
            case .adminCoverageGaps: AMDOSP2CoverageGapsView(onOpenNotifications: { onNavigate(.notifications) })
            case .adminIP: AMDOSAdminIPView()
            case .adminCultureMap: AMDOSAdminCultureMapView()
            case .adminMonthlyAgreements: AMDOSP2MonthlyAgreementsView(onOpenAgreement: onOpenMonthlyAgreement, onOpenMypage: onOpenMemberMypage)
            case .adminPrivateWiki: AMDOSP1PrivateWikiView()
            case .adminManagementKnowledge: AMDOSP2ManagementKnowledgeView()
            case .adminProjects: AMDOSAdminProjectsView()
            case .adminPrompts: AMDOSP1PromptsView()
            case .adminProtocols: AMDOSAdminProtocolsView()
            case .adminSchedule: AMDOSP1ScheduleView()
            case .adminMsOverview: AMDOSAdminMSOverviewView()
            case .adminSeasonPL: AMDOSAdminSeasonPLView(onOpenMypage: onOpenMemberMypage)
            case .adminSettings: AMDOSP1SettingsView()
            case .adminTsukuyomi: AMDOSP1TsukuyomiView()
            case .adminWeekly: AMDOSAdminWeeklyView(onOpenMypage: onOpenMemberMypage)
            case .hudDashboard: AMDOSHUDDashboardView()
            case .hudEmbedDashboard: AMDOSHUDEmbedDashboardView()
            // HUD mirror routes re-export the PWA's full feature pages. Keep
            // the native route aliases on the same SwiftUI implementation so
            // their CRUD and workflow actions do not degrade into read-only HUD cards.
            case .hudNotifications: AMDOSParityNotificationsView(initialNotificationID: nil, initialMeetingID: nil)
            case .hudProjectCockpit: AMDOSParityProjectCockpitView(projectId: selectedProjectId, initialYM: routeQuery["ym"], initialTab: routeQuery["tab"], initialMeetingID: routeQuery["meeting"], initialDocumentID: routeQuery["document"], onOpenConfig: onOpenProjectConfig, onOpenGovernance: { onNavigate(.adminGovernance) })
            case .hudAtlas: AMDOSParityAtlasHomeView(onNavigate: onNavigate)
            case .hudSeeds:
                AMDOSParitySeedsView(
                    onSelectSeed: onSelectSeed,
                    onOpenInbox: { onNavigate(.seedInbox) },
                    onOpenMacrotrends: { onNavigate(.atlasMacrotrends) }
                )
            case .hudVcs: AMDOSParityVCListView(onSelectVC: onSelectVC)
            case .hudAmdScoreRetrofit: AMDOSParityAMDScoreRetrofitView()
            case .cyber3DLab: AMDOSCyber3DLabView()
            case .cyberGlassCube: AMDOSCyberGlassCubeView()
            case .cyberHudWall: AMDOSCyberHUDWallView()
            case .manual: AMDOSManualView(initialTopic: routeQuery["topic"])
            case .manualDetail: AMDOSManualDetailView(initialSlug: selectedDocumentSlug)
            case .spec: AMDOSSpecView(initialSlug: selectedDocumentSlug)
            case .specDetail: AMDOSSpecDetailView(initialSlug: selectedDocumentSlug)
            case .bzm: AMDOSBZMView(initialSlug: selectedDocumentSlug)
            case .bzmDetail: AMDOSBZMDetailView(initialSlug: selectedDocumentSlug)
            case .bzmPublic: AMDOSBZMPublicView(initialSlug: selectedDocumentSlug)
            case .bzmPublicDetail: AMDOSBZMPublicDetailView(initialSlug: selectedDocumentSlug)
            case .account: AMDOSAccountView()
            case .paymentConfirm: AMDOSPaymentConfirmView(token: selectedPaymentConfirmationToken)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(AMDOSDesign.page)
    }
}

struct AMDOSPageScaffold<Content: View>: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    @ViewBuilder let content: () -> Content

    init(eyebrow: String, title: String, subtitle: String, @ViewBuilder content: @escaping () -> Content) {
        self.eyebrow = eyebrow; self.title = title; self.subtitle = subtitle; self.content = content
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(eyebrow).font(.caption.weight(.semibold)).tracking(1.5).foregroundStyle(AMDOSDesign.blue)
                    Text(title).font(.system(size: 29, weight: .bold, design: .rounded))
                    Text(subtitle).font(.subheadline).foregroundStyle(AMDOSDesign.muted)
                }
                content()
            }
            .frame(maxWidth: 1220, alignment: .leading)
            .padding(30)
        }
    }
}

struct AMDOSSectionCard<Content: View>: View {
    let title: String
    let systemImage: String
    @ViewBuilder let content: () -> Content

    init(_ title: String, systemImage: String = "square.stack.3d.up", @ViewBuilder content: @escaping () -> Content) {
        self.title = title; self.systemImage = systemImage; self.content = content
    }

    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 14) {
                Label(title, systemImage: systemImage).font(.headline).foregroundStyle(AMDOSDesign.blue)
                content()
            }
        }
    }
}

struct AMDOSMetricTile: View {
    let label: String
    let value: String
    let detail: String
    var tint: Color = AMDOSDesign.blue
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 7) {
                Text(label).font(.caption).foregroundStyle(AMDOSDesign.muted)
                Text(value).font(.system(size: 24, weight: .bold, design: .rounded)).foregroundStyle(tint)
                Text(detail).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct AMDOSStateNotice: View {
    let state: AMDOSFeatureLoadState
    let retry: () -> Void
    var body: some View {
        Group {
            switch state {
            case .idle: EmptyView()
            case .loading: ProgressView("PWAのデータを読み込み中…").frame(maxWidth: .infinity, alignment: .leading)
            case .loaded: EmptyView()
            case .empty: Label("表示できるデータがありません", systemImage: "tray").foregroundStyle(AMDOSDesign.muted)
            case .failed(let message):
                VStack(alignment: .leading, spacing: 8) {
                    Label("データを取得できませんでした", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                    Text(message).font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
                    Button("再読み込み", action: retry).buttonStyle(.bordered)
                }
            }
        }
    }
}

struct AMDOSStatusBadge: View {
    let text: String
    var tint: Color = AMDOSDesign.blue
    var body: some View {
        Text(text.isEmpty ? "—" : text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(tint.opacity(0.10), in: Capsule())
    }
}

struct AMDOSTextField: View {
    let title: String
    @Binding var text: String
    var axis: Axis = .horizontal
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption).foregroundStyle(AMDOSDesign.muted)
            TextField(title, text: $text, axis: axis).textFieldStyle(.roundedBorder)
        }
    }
}

struct AMDOSLineItem: View {
    let title: String
    let subtitle: String
    var status: String?
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.body.weight(.medium))
                Text(subtitle).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(3)
            }
            Spacer(minLength: 10)
            if let status { AMDOSStatusBadge(text: status) }
        }
        .padding(.vertical, 5)
    }
}

struct AMDOSAccountView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    var body: some View {
        AMDOSPageScaffold(eyebrow: "ACCOUNT", title: "アカウント", subtitle: "PWAと同じSupabaseセッション・認可境界で接続") {
            AMDOSSectionCard("接続中のアカウント", systemImage: "person.crop.circle") {
                LabeledContent("メールアドレス", value: auth.email ?? "—")
                LabeledContent("管理者権限", value: auth.isAdmin ? "あり" : "なし")
                Divider()
                Button("サインアウト", role: .destructive) { auth.signOut() }
            }
        }
    }
}
