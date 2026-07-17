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
            if auth.isSignedIn {
                AMDOSWorkspaceView()
                    .task { await workspace.loadHome() }
            } else {
                AMDOSLoginView()
            }
        }
        .onOpenURL { url in
            guard url.scheme?.lowercased() == "amdos-mac" else { return }
            Task { await auth.acceptOAuthCallback(url) }
        }
        .preferredColorScheme(nil)
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
            Button {
                Task { await auth.signInWithGoogle() }
            } label: {
                Label(auth.signInStatus, systemImage: "person.crop.circle.badge.checkmark")
                    .frame(width: 240)
            }
            .buttonStyle(.borderedProminent)
            .tint(AMDOSDesign.blue)
            .disabled(auth.isLoading)
            if let errorMessage = auth.errorMessage {
                Text(errorMessage)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 440)
            }
            Text("既存のSupabase認証・権限境界を使うよ。Mac側で新しい権限は追加しない。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
        }
        .padding(64)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AMDOSDesign.page)
    }
}
