import Foundation
import Combine
import OSLog

@MainActor
final class AMDOSAuthStore: ObservableObject {
    @Published private(set) var session: AMDOSSession?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var isAdmin = false
    @Published private(set) var signInStatus = "Googleでログイン"
    @Published private(set) var isRestoring = true
    @Published private(set) var workspaceAccess: AMDOSProjectWorkspaceAccess?

    let client: AMDOSRESTClient
    private let defaultsKey = "amdos.macos.session"

    init(client: AMDOSRESTClient = .shared) {
        self.client = client
        restoreSession()
    }

    /// PJ限定ログインはPWAと同じ署名付きworkspace cookieだけを保持するため、
    /// 通常のSupabase sessionが無くてもログイン済みとして扱う。
    var isSignedIn: Bool { session != nil || workspaceAccess != nil }
    var email: String? { session?.email }
    var isProjectScoped: Bool { workspaceAccess?.scope == .project }

    func signInWithGoogle(loginScope: AMDOSLoginScope) async {
        isLoading = true
        errorMessage = nil
        workspaceAccess = nil
        signInStatus = "ChromeでGoogleログインを続けて…"
        AMDOSAuthLog.logger.notice("google_auth_requested")
        defer {
            isLoading = false
            signInStatus = "Googleでログイン"
        }
        do {
            let next = try await client.authenticateWithGoogle(loginScope: loginScope)
            session = next
            persist(next)
            AMDOSAuthLog.logger.notice("google_auth_session_established")
            await refreshAuthority()
        } catch {
            AMDOSAuthLog.logger.error("google_auth_failed")
            errorMessage = error.localizedDescription
            session = nil
            workspaceAccess = nil
            isAdmin = false
            UserDefaults.standard.removeObject(forKey: defaultsKey)
            await client.setSession(nil)
            await client.clearProjectWorkspaceSession()
        }
    }

    /// `ASWebAuthenticationSession` が捕捉できなかったURLも、SwiftUIのアプリ入口から
    /// 同じ認証待機へ戻す。macOSでは外部ブラウザがcustom URL schemeをアプリに渡す場合がある。
    func acceptOAuthCallback(_ url: URL) async {
        await client.acceptOAuthCallback(url)
    }

    func refreshAuthority() async {
        do {
            let access = try await client.fetchProjectWorkspaceAccess()
            workspaceAccess = access
            isAdmin = access.isAdmin
            // PWAの(app)/layoutと同じ入口ゲート。portfolioだけがCalendar/Gmailを
            // 必須とし、PJ限定アカウントは共有DTO以外へ入らない。
            if access.scope == .portfolio, access.calendarStatus != "connected" {
                session = nil
                isAdmin = false
                workspaceAccess = nil
                UserDefaults.standard.removeObject(forKey: defaultsKey)
                await client.setSession(nil)
                errorMessage = "Google CalendarとGmailの共有が必要だよ。Google画面で両方を許可して、もう一度ログインしてね。"
            } else if access.scope == .project {
                // `/api/macos/auth/google-complete` がセットしたPWAと同じ
                // HttpOnly workspace cookieへ切り替える。以後の読取・更新は
                // Bearer JWTではなく、そのPJ限定cookieでだけ行う。
                session = nil
                UserDefaults.standard.removeObject(forKey: defaultsKey)
                await client.setSession(nil)
            }
        } catch {
            errorMessage = error.localizedDescription
            session = nil
            isAdmin = false
            workspaceAccess = nil
            UserDefaults.standard.removeObject(forKey: defaultsKey)
            await client.setSession(nil)
            await client.clearProjectWorkspaceSession()
        }
    }

    func signOut() {
        session = nil
        isAdmin = false
        workspaceAccess = nil
        UserDefaults.standard.removeObject(forKey: defaultsKey)
        Task {
            await client.setSession(nil)
            await client.clearProjectWorkspaceSession()
        }
    }

    private func restoreSession() {
        if let data = UserDefaults.standard.data(forKey: defaultsKey),
           let stored = try? JSONDecoder().decode(AMDOSSession.self, from: data) {
            session = stored
            workspaceAccess = nil
            Task {
                await client.setSession(stored)
                await refreshAuthority()
                isRestoring = false
            }
            return
        }

        // PJ限定セッションはUserDefaultsにtokenを残さない。PWAの署名済みcookie
        // が有効な間だけ、共有access DTOから復元する。
        Task {
            defer { isRestoring = false }
            do {
                let access = try await client.fetchProjectWorkspaceAccess()
                guard access.scope == .project else { return }
                workspaceAccess = access
                isAdmin = access.isAdmin
            } catch {
                // cookieが無い/期限切れなら通常どおりログイン画面へ戻る。
            }
        }
    }

    private func persist(_ session: AMDOSSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        UserDefaults.standard.set(data, forKey: defaultsKey)
        Task { await client.setSession(session) }
    }
}
