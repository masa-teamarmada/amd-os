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
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 6) {
                    Label("AMD OS", systemImage: "circle.hexagongrid.fill")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(AMDOSDesign.blue)
                    Text(auth.email ?? "認証済み")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)

                Picker("領域", selection: $area) {
                    ForEach(visibleAreas) { item in
                        Label(item.rawValue, systemImage: item.systemImage).tag(item)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 12)
                .onChange(of: area) { _, next in
                    screen = AMDOSParityCatalog.navigation(for: next, isAdmin: auth.isAdmin).first ?? .today
                }

                Divider().padding(.top, 14)

                List(selection: $screen) {
                    Section(area.rawValue) {
                        ForEach(AMDOSParityCatalog.navigation(for: area, isAdmin: auth.isAdmin)) { id in
                            let descriptor = AMDOSParityCatalog.descriptor(for: id)
                            Label(descriptor.title, systemImage: icon(for: id))
                                .tag(id)
                        }
                    }
                }
                .listStyle(.sidebar)
            }
            .navigationSplitViewColumnWidth(min: 220, ideal: 250, max: 310)
        } detail: {
            AMDOSScreenView(screen: screen, selectedProjectId: $selectedProjectId, onSelectProject: { id in
                selectedProjectId = id
                screen = .projectDetail
            })
        }
    }

    private func icon(for id: AMDOSScreenID) -> String {
        switch id {
        case .today: return "sun.max.fill"
        case .projects, .projectDetail: return "rectangle.3.group.fill"
        case .notifications: return "bell.badge.fill"
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
        case .adminSeasonPl: return "tablecells"
        case .adminWeekly: return "calendar.badge.clock"
        case .hud: return "display"
        case .manual: return "book.closed.fill"
        case .spec: return "doc.badge.gearshape"
        case .bzm: return "text.book.closed.fill"
        case .account: return "person.crop.circle"
        }
    }
}

