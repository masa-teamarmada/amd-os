import SwiftUI

struct AMDOSWorkspaceView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    @State private var route = AMDOSPWAPathRoute(screen: .today)
    @State private var history: [AMDOSPWAPathRoute] = []
    @State private var selectedProjectId: String?
    @State private var selectedSeedId: String?
    @State private var selectedVCId: String?
    @State private var selectedInstitutionId: String?
    @State private var selectedDocumentSlug: String?
    @State private var selectedReportYM: String?
    @State private var selectedVentureId: String?
    @State private var selectedPaymentConfirmationToken: String?
    @State private var selectedRouteQuery: [String: String] = [:]
    @State private var authorityCheckID = UUID()

    private var area: AMDOSArea { route.area }
    private var screen: AMDOSScreenID { route.screen }
    private var navigation: [AMDOSScreenID] {
        AMDOSParityCatalog.navigation(for: area, isAdmin: auth.isAdmin)
            .filter { isAvailableToCurrentUser($0) }
    }

    var body: some View {
        NavigationSplitView {
            List {
                Section {
                    HStack(spacing: 10) {
                        Image("AMDLogoMark")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 34, height: 34)
                            .accessibilityLabel("AMDロゴ")
                        VStack(alignment: .leading, spacing: 2) {
                            Text("AMD OS").font(.headline)
                            Text("PWAの仕事をMacで続ける").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                    .padding(.vertical, 8)
                }

                Section("領域") {
                    ForEach(AMDOSArea.allCases.filter { $0 != .admin || auth.isAdmin }) { item in
                        Button { selectArea(item) } label: {
                            Label(item.rawValue, systemImage: item.systemImage)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(area == item ? AMDOSDesign.blue : AMDOSDesign.ink)
                    }
                }

                Section(AMDOSParityCatalog.areaLabel(area)) {
                    ForEach(navigation) { id in
                        Button { navigate(to: AMDOSPWAPathRoute(screen: id)) } label: {
                            Label(AMDOSParityCatalog.userTitle(for: id), systemImage: AMDOSParityCatalog.icon(for: id))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(screen == id ? AMDOSDesign.blue : AMDOSDesign.ink)
                    }
                }
            }
            .listStyle(.sidebar)
            .safeAreaInset(edge: .bottom) {
                HStack(spacing: 8) {
                    Image(systemName: "person.crop.circle")
                    Text(auth.email ?? "アカウント").lineLimit(1).font(.caption)
                    Spacer()
                }
                .foregroundStyle(AMDOSDesign.muted)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
            }
            .navigationSplitViewColumnWidth(min: 238, ideal: 270, max: 330)
        } detail: {
            AMDOSScreenView(
                screen: screen,
                selectedProjectId: $selectedProjectId,
                selectedSeedId: $selectedSeedId,
                selectedVCId: $selectedVCId,
                selectedInstitutionId: $selectedInstitutionId,
                selectedDocumentSlug: $selectedDocumentSlug,
                selectedReportYM: $selectedReportYM,
                selectedVentureID: $selectedVentureId,
                selectedPaymentConfirmationToken: $selectedPaymentConfirmationToken,
                routeQuery: selectedRouteQuery,
                onSelectProject: { id in navigate(to: AMDOSPWAPathRoute(screen: .projectCockpit, projectID: id)) },
                onSelectSeed: { id in navigate(to: AMDOSPWAPathRoute(screen: .seedDetail, seedID: id)) },
                onSelectVC: { id in navigate(to: AMDOSPWAPathRoute(screen: .vcDetail, vcID: id)) },
                onSelectInstitution: { id in navigate(to: AMDOSPWAPathRoute(screen: .institutionDetail, institutionID: id)) },
                onOpenProjectCockpit: { id, meetingID in
                    var query: [String: String] = [:]
                    if let meetingID { query["meeting"] = meetingID }
                    navigate(to: AMDOSPWAPathRoute(screen: .projectCockpit, projectID: id, query: query))
                },
                onOpenProjectConfig: { id in
                    navigate(to: AMDOSPWAPathRoute(screen: .projectConfig, projectID: id))
                },
                onOpenProjectWorkspace: { id in
                    navigate(to: AMDOSPWAPathRoute(screen: .projectWorkspace, projectID: id))
                },
                onOpenMemberMypage: { memberID in
                    navigate(to: AMDOSPWAPathRoute(screen: .mypage, query: ["memberId": memberID]))
                },
                onOpenMonthlyAgreement: { ym, memberID in
                    navigate(to: AMDOSPWAPathRoute(
                        screen: .monthlyAgreement,
                        reportYM: ym,
                        query: ["ym": ym, "memberId": memberID]
                    ))
                },
                onOpenVenture: { id in
                    navigate(to: AMDOSPWAPathRoute(screen: .ventureSuDetail, ventureID: id))
                },
                onOpenAmdScoreDetail: { id in
                    navigate(to: AMDOSPWAPathRoute(screen: .amdScoreDetail, projectID: id))
                },
                onNavigate: { screen in navigate(to: AMDOSPWAPathRoute(screen: screen)) }
            )
        }
        .navigationTitle(AMDOSParityCatalog.userTitle(for: screen))
        .toolbar {
            ToolbarItemGroup {
                Button("戻る", systemImage: "chevron.backward", action: goBack)
                    .disabled(history.isEmpty)
                Button("サインアウト", systemImage: "rectangle.portrait.and.arrow.right") { auth.signOut() }
            }
        }
        .task { applyPendingRoute() }
        .onChange(of: workspace.pendingRoute) { _, _ in applyPendingRoute() }
        .onChange(of: auth.isAdmin) { _, isAdmin in
            guard !isAdmin, requiresAdministrator(screen) else { return }
            applyResolved(AMDOSPWAPathRoute(screen: .today))
        }
    }

    private func selectArea(_ nextArea: AMDOSArea) {
        let nextScreen = AMDOSParityCatalog.navigation(for: nextArea, isAdmin: auth.isAdmin)
            .first(where: isAvailableToCurrentUser) ?? .today
        navigate(to: AMDOSPWAPathRoute(screen: nextScreen))
    }

    private func applyPendingRoute() {
        guard let incoming = workspace.consumePendingRoute() else { return }
        navigate(to: incoming)
    }

    private func navigate(to next: AMDOSPWAPathRoute) {
        guard next != route else { return }
        history.append(route)
        apply(next)
    }

    private func goBack() {
        guard let previous = history.popLast() else { return }
        apply(previous)
    }

    private func apply(_ next: AMDOSPWAPathRoute) {
        guard requiresAdministrator(next.screen), !auth.isAdmin else {
            authorityCheckID = UUID()
            applyResolved(next)
            return
        }

        // 初回起動直後は保存済みセッションの管理者判定がまだ届いていないことがある。
        // その間に深いリンクの管理画面を一瞬でも描画せず、判定完了後だけ開く。
        let requestID = UUID()
        authorityCheckID = requestID
        Task { @MainActor in
            await auth.refreshAuthority()
            guard requestID == authorityCheckID, !Task.isCancelled else { return }
            applyResolved(auth.isAdmin ? next : AMDOSPWAPathRoute(screen: .today))
        }
    }

    private func applyResolved(_ next: AMDOSPWAPathRoute) {
        route = next
        selectedProjectId = next.projectID
        selectedSeedId = next.seedID
        selectedVCId = next.vcID
        selectedInstitutionId = next.institutionID
        selectedDocumentSlug = next.documentSlug
        selectedReportYM = next.reportYM
        selectedVentureId = next.ventureID
        selectedPaymentConfirmationToken = next.paymentConfirmationToken
        selectedRouteQuery = next.query
    }

    private func isAvailableToCurrentUser(_ candidate: AMDOSScreenID) -> Bool {
        !requiresAdministrator(candidate) || auth.isAdmin
    }

    /// PWA の route/layout と、管理者専用 API を呼ぶ編集画面の両方をここで閉じる。
    /// PWA の `/admin/**` と `/spec/**` は非管理者を dashboard に戻し、通知・先手TODO・
    /// 印刷・管理編集は非管理者にコンテンツを返さない。Mac も API の 403 を待って
    /// 編集フォームだけを見せる状態を作らない。
    private func requiresAdministrator(_ candidate: AMDOSScreenID) -> Bool {
        switch candidate {
        case .adminHome, .adminCompany, .adminContexts, .adminInvoices, .adminBilling,
             .adminFinance, .adminPayouts, .adminContracts, .adminMembers, .adminGovernance,
             .adminCoverageGaps, .adminIP, .adminCultureMap, .adminMonthlyAgreements,
             .adminPrivateWiki, .adminManagementKnowledge, .adminProjects, .adminPrompts,
             .adminProtocols, .adminSchedule, .adminMsOverview, .adminSeasonPL,
             .adminSettings, .adminTsukuyomi, .adminWeekly,
             .spec, .specDetail,
             .notifications, .hudNotifications, .proactive, .projectReportPrint,
             .contracts, .japaneseCultureMap,
             .atlasThemes, .institutionAssess,
             .amdScoreRetrofit, .hudAmdScoreRetrofit, .managementScore:
            return true
        default:
            return false
        }
    }
}
