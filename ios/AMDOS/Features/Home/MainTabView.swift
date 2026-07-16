import SwiftUI

enum AppTab {
    case mypage, cockpit, notifications, registration, settings
}

/// 「登録」タブ内 (`RegistrationHubView`) の NavigationStack が扱う型安全な遷移先。
enum RegistrationRoute: Hashable {
    case reimburse
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
    /// 「登録」タブへ切替と同時に立替申請一覧まで直接開くための push path。
    @Published var registrationPath: [RegistrationRoute] = []
    /// Admin fullScreenCover を直接開いてほしいというルーティンからの要求。
    /// admin 判定は MainTabView 側の isAdmin で行い、既存の権限仕様は変えない。
    @Published var requestAdminPresentation = false
}

struct MainTabView: View {
    @StateObject private var navigation = AppNavigationState()
    @State private var isAdmin = false
    @State private var showAdmin = false
    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var notificationService: NotificationService

    var body: some View {
        TabView(selection: Binding(
            get: { navigation.selectedTab },
            set: {
                navigation.selectedTab = $0
            }
        )) {
            MyPageView()
                .tabItem { Label("今日", systemImage: "house.fill") }
                .tag(AppTab.mypage)

            CockpitView()
                .tabItem { Label("PJ", systemImage: "chart.bar.xaxis.ascending") }
                .tag(AppTab.cockpit)

            NavigationStack {
                NotificationInboxView()
            }
            .tabItem { Label("通知", systemImage: "bell.fill") }
            .tag(AppTab.notifications)

            RegistrationHubView(path: $navigation.registrationPath)
                .tabItem { Label("登録", systemImage: "doc.badge.plus") }
                .tag(AppTab.registration)

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
        .sheet(item: $notificationService.activeInboxLink) { link in
            NavigationStack {
                NotificationInboxView(initialFocus: link)
            }
        }
        .environmentObject(navigation)
        .task {
            guard let email = authService.userEmail else { return }
            isAdmin = (try? await SupabaseService.shared.fetchIsAdmin(email: email)) ?? false
        }
        .onChange(of: navigation.requestAdminPresentation) { _, requested in
            guard requested else { return }
            navigation.requestAdminPresentation = false
            if isAdmin {
                showAdmin = true
            }
        }
    }
}

struct RegistrationHubView: View {
    @Binding var path: [RegistrationRoute]

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 16) {
                    NavigationLink(value: RegistrationRoute.reimburse) {
                        RegistrationHubCardLabel(
                            icon: "yensign.circle.fill",
                            title: "立替申請",
                            subtitle: "経費の立替を申請・確認する"
                        )
                    }
                    .buttonStyle(.plain)

                    RegistrationHubCard(
                        icon: "person.crop.rectangle.stack.fill",
                        title: "名刺登録",
                        subtitle: "名刺をスキャンして登録・管理する"
                    ) {
                        BusinessCardsView()
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 24)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("登録")
            .navigationDestination(for: RegistrationRoute.self) { route in
                switch route {
                case .reimburse:
                    ReimburseListView()
                }
            }
        }
    }
}

private struct RegistrationHubCard<Destination: View>: View {
    let icon: String
    let title: String
    let subtitle: String
    @ViewBuilder let destination: () -> Destination

    var body: some View {
        NavigationLink {
            destination()
        } label: {
            RegistrationHubCardLabel(icon: icon, title: title, subtitle: subtitle)
        }
        .buttonStyle(.plain)
    }
}

private struct RegistrationHubCardLabel: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(AMD.blueTint)
                    .frame(width: 48, height: 48)
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(AMD.blue)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(AMD.text)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(AMD.textSub)
                    .multilineTextAlignment(.leading)
            }

            Spacer(minLength: 8)

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AMD.textQuat)
        }
        .padding(16)
        .frame(minHeight: 44)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AMD.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
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
