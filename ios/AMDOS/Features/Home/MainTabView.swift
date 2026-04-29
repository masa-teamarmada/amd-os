import SwiftUI

enum AppTab {
    case mypage, routine, reimburse, cockpit, admin, settings
}

struct RoutineNavigationTarget: Identifiable, Hashable {
    let id = UUID()
    let projectId: String
    let projectName: String
    let bizYm: String?
    let stepId: String?
}

@MainActor
final class AppNavigationState: ObservableObject {
    @Published var selectedTab: AppTab = .mypage
    @Published var routineTarget: RoutineNavigationTarget?

    func openRoutineTarget(
        projectId: String,
        projectName: String,
        bizYm: String?,
        stepId: String?
    ) {
        routineTarget = RoutineNavigationTarget(
            projectId: projectId,
            projectName: projectName,
            bizYm: bizYm,
            stepId: stepId
        )
        selectedTab = .routine
    }
}

struct MainTabView: View {
    @StateObject private var navigation = AppNavigationState()
    @State private var isAdmin = false
    @State private var showAdmin = false
    @EnvironmentObject private var authService: AuthService

    var body: some View {
        TabView(selection: Binding(
            get: { navigation.selectedTab },
            set: {
                navigation.selectedTab = $0
            }
        )) {
            MyPageView()
                .tabItem { Label("マイページ", systemImage: "person.circle") }
                .tag(AppTab.mypage)

            ProjectListView()
                .tabItem { Label("月次ルーティン", systemImage: "arrow.trianglehead.clockwise") }
                .tag(AppTab.routine)

            ReimburseListView()
                .tabItem { Label("立替", systemImage: "yensign.circle") }
                .tag(AppTab.reimburse)

            CockpitView()
                .tabItem { Label("PJ進捗", systemImage: "chart.bar.xaxis.ascending") }
                .tag(AppTab.cockpit)

            SettingsView()
                .tabItem { Label("設定", systemImage: "gear") }
                .tag(AppTab.settings)
        }
        .overlay(alignment: .bottomTrailing) {
            if isAdmin {
                AdminFloatingButton {
                    showAdmin = true
                }
                .padding(.trailing, 16)
                .padding(.bottom, 70) // タブバーの上に出す（タブバー高さ ≒ 50 + 余白）
                .accessibilityLabel("Admin")
            }
        }
        .fullScreenCover(isPresented: $showAdmin) {
            AdminTabView()
        }
        .environmentObject(navigation)
        .task {
            guard let email = authService.userEmail else { return }
            isAdmin = (try? await SupabaseService.shared.fetchIsAdmin(email: email)) ?? false
        }
    }
}

private struct AdminFloatingButton: View {
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: "shield.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(AMD.blue)
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.18), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }
}
