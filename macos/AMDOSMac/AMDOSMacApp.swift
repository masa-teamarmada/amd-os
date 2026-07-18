import SwiftUI

@main
struct AMDOSMacApp: App {
    @StateObject private var auth = AMDOSAuthStore()
    @StateObject private var workspace = AMDOSWorkspaceModel()

    var body: some Scene {
        Window("AMD OS", id: "main") {
            AMDOSRootView()
                .environmentObject(auth)
                .environmentObject(workspace)
                .frame(minWidth: 1120, minHeight: 720)
        }
        .windowStyle(.titleBar)
        .commands {
            SidebarCommands()
        }
    }
}

struct AMDOSRootView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel

    var body: some View {
        Group {
            if auth.isRestoring {
                ProgressView("セッションを確認中…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AMDOSDesign.page)
            } else if auth.isSignedIn, let access = auth.workspaceAccess {
                if access.scope == .project {
                    AMDOSProjectWorkspaceRootView()
                } else {
                    AMDOSWorkspaceView()
                        .task(id: auth.email) { await workspace.loadHome(email: auth.email) }
                }
            } else if auth.isSignedIn {
                ProgressView("権限を確認中…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AMDOSDesign.page)
            } else if let paymentConfirmationRoute = pendingPaymentConfirmationRoute {
                // PWAの`/payment-confirm`は(app)配下ではなく、署名済みtokenを
                // 認可境界にする公開フォーム。Googleログインを強制しない。
                AMDOSPaymentConfirmView(token: paymentConfirmationRoute.paymentConfirmationToken)
            } else if let publicBzmRoute = pendingPublicBzmRoute {
                // PWAの`/bzm/public/**`も公開ルート。本文はログインなしで読めるため、
                // Macでもログイン画面に戻さず同じ公開Markdown bridgeを開く。
                AMDOSBZMPublicDetailView(initialSlug: publicBzmRoute.documentSlug)
            } else if pendingHUDEmbedRoute != nil {
                // PWAの`/hud/dashboard/embed`は未ログインでもRLSで許可された
                // HUD read modelだけを表示する。通常HUD/APIへ認可を広げない。
                AMDOSHUDEmbedDashboardView()
            } else {
                AMDOSLoginView()
            }
        }
        .onOpenURL { url in
            if url.scheme?.lowercased() == "amdos-macos-auth", url.host?.lowercased() == "oauth" {
                Task { await auth.acceptOAuthCallback(url) }
            } else {
                workspace.acceptNavigationURL(url)
            }
        }
        .preferredColorScheme(nil)
    }

    private var pendingPaymentConfirmationRoute: AMDOSPWAPathRoute? {
        guard workspace.pendingRoute?.screen == .paymentConfirm else { return nil }
        return workspace.pendingRoute
    }

    private var pendingPublicBzmRoute: AMDOSPWAPathRoute? {
        guard let route = workspace.pendingRoute,
              route.screen == .bzmPublic || route.screen == .bzmPublicDetail else { return nil }
        return route
    }

    private var pendingHUDEmbedRoute: AMDOSPWAPathRoute? {
        guard workspace.pendingRoute?.screen == .hudEmbedDashboard else { return nil }
        return workspace.pendingRoute
    }

}

struct AMDOSLoginView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore

    var body: some View {
        VStack(spacing: 24) {
            Image("AMDLogoMark")
                .interpolation(.high)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 128, height: 128)
                .accessibilityLabel("AMDロゴ")
            VStack(spacing: 8) {
                Text("AMD OS")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                Text("仕事・探索・管理を、Macの操作でひとつに")
                    .foregroundStyle(AMDOSDesign.muted)
            }
            VStack(spacing: 10) {
                Button {
                    Task { await auth.signInWithGoogle(loginScope: .portfolio) }
                } label: {
                    Label(auth.signInStatus, systemImage: "person.crop.circle.badge.checkmark")
                        .frame(width: 240)
                }
                .buttonStyle(.borderedProminent)
                .tint(AMDOSDesign.blue)
                .disabled(auth.isLoading)

                Text("PJメンバーはこちら")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
                Button {
                    Task { await auth.signInWithGoogle(loginScope: .project) }
                } label: {
                    Label("参加PJだけを見る", systemImage: "lock.rectangle")
                        .frame(width: 240)
                }
                .buttonStyle(.bordered)
                .disabled(auth.isLoading)
            }
            if let errorMessage = auth.errorMessage {
                Text(errorMessage)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 440)
            }
            Text("既存のSupabase認証・権限境界を使うよ。PJ限定ログインは招待されたPJだけを表示する。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
        }
        .padding(64)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AMDOSDesign.page)
    }
}
