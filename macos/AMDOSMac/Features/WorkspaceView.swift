import SwiftUI

struct AMDOSWorkspaceView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    @State private var area: AMDOSArea = .work
    @State private var screen: AMDOSScreenID = .today
    @State private var selectedProjectId: String?

    private var visibleAreas: [AMDOSArea] {
        AMDOSArea.allCases.filter { $0 != .admin || auth.isAdmin }
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
                            Text("チームの現在地").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                    .padding(.vertical, 8)
                }

                Section("領域") {
                    ForEach(visibleAreas) { item in
                        Button {
                            area = item
                            screen = AMDOSParityCatalog.navigation(for: item, isAdmin: auth.isAdmin).first ?? .today
                        } label: {
                            Label(item.rawValue, systemImage: item.systemImage)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(area == item ? AMDOSDesign.blue : AMDOSDesign.ink)
                    }
                }

                Section(AMDOSParityCatalog.areaLabel(area)) {
                    ForEach(AMDOSParityCatalog.navigation(for: area, isAdmin: auth.isAdmin)) { id in
                        Button {
                            screen = id
                            if id != .projectDetail { selectedProjectId = nil }
                        } label: {
                            Label(AMDOSParityCatalog.userTitle(for: id), systemImage: icon(for: id))
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
                    Text(auth.email ?? "アカウント")
                        .lineLimit(1)
                        .font(.caption)
                    Spacer()
                }
                .foregroundStyle(AMDOSDesign.muted)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
            }
            .navigationSplitViewColumnWidth(min: 220, ideal: 250, max: 300)
        } detail: {
            AMDOSScreenView(
                screen: screen,
                selectedProjectId: $selectedProjectId,
                onSelectProject: { id in
                    selectedProjectId = id
                    screen = .projectDetail
                }
            )
        }
        .navigationTitle(AMDOSParityCatalog.userTitle(for: screen))
        .toolbar {
            ToolbarItem {
                Button("サインアウト", systemImage: "rectangle.portrait.and.arrow.right") {
                    auth.signOut()
                }
                .help("AMD OSからサインアウト")
            }
        }
    }

    private func icon(for id: AMDOSScreenID) -> String {
        switch id {
        case .today: return "sun.max.fill"
        case .projects, .projectDetail: return "rectangle.3.group.fill"
        case .notifications: return "bell.fill"
        case .reimbursements: return "receipt"
        case .businessCards: return "person.text.rectangle"
        case .monthlyAgreement: return "checkmark.seal"
        case .atlas: return "globe.americas.fill"
        case .materials: return "circle.hexagongrid"
        case .seeds: return "leaf.fill"
        case .poc: return "arrow.triangle.2.circlepath"
        case .vcs: return "chart.line.uptrend.xyaxis"
        case .scholar: return "graduationcap.fill"
        case .institutions: return "building.columns.fill"
        case .amdScore: return "gauge.with.dots.needle.67percent"
        case .adminHome: return "house.fill"
        case .adminInvoices: return "doc.text.fill"
        case .adminFinance: return "yensign.circle.fill"
        case .adminPayouts: return "banknote.fill"
        case .adminContracts: return "signature"
        case .adminMembers: return "person.2.fill"
        case .adminGovernance: return "building.columns"
        case .adminPrivateWiki: return "lock.document"
        case .adminManagementKnowledge: return "lightbulb.fill"
        case .adminSchedule: return "calendar"
        case .adminMsOverview: return "chart.bar.doc.horizontal"
        case .adminSeasonPl: return "chart.bar.fill"
        case .adminWeekly: return "calendar.badge.clock"
        case .hud: return "display"
        case .manual: return "book.closed.fill"
        case .spec: return "doc.badge.gearshape"
        case .bzm: return "text.book.closed.fill"
        case .account: return "person.crop.circle"
        }
    }
}
