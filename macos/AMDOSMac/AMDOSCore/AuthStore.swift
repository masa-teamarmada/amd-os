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

    let client: AMDOSRESTClient
    private let defaultsKey = "amdos.macos.session"

    init(client: AMDOSRESTClient = .shared) {
        self.client = client
        restoreSession()
    }

    var isSignedIn: Bool { session != nil }
    var email: String? { session?.email }

    func signInWithGoogle() async {
        isLoading = true
        errorMessage = nil
        signInStatus = "Google認証を開始中…"
        AMDOSAuthLog.logger.notice("google_auth_requested")
        defer {
            isLoading = false
            signInStatus = "Googleでログイン"
        }
        do {
            let next = try await client.authenticateWithGoogle()
            session = next
            persist(next)
            AMDOSAuthLog.logger.notice("google_auth_session_established")
            if let email = next.email {
                isAdmin = try await client.fetchIsAdmin(email: email)
            }
        } catch {
            AMDOSAuthLog.logger.error("google_auth_failed")
            errorMessage = error.localizedDescription
        }
    }

    /// `ASWebAuthenticationSession` が捕捉できなかったURLも、SwiftUIのアプリ入口から
    /// 同じ認証待機へ戻す。macOSでは外部ブラウザがcustom URL schemeをアプリに渡す場合がある。
    func acceptOAuthCallback(_ url: URL) async {
        await client.acceptOAuthCallback(url)
    }

    func refreshAuthority() async {
        guard let email else { return }
        do { isAdmin = try await client.fetchIsAdmin(email: email) }
        catch { errorMessage = error.localizedDescription }
    }

    func signOut() {
        session = nil
        isAdmin = false
        UserDefaults.standard.removeObject(forKey: defaultsKey)
        Task { await client.setSession(nil) }
    }

    private func restoreSession() {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey),
              let stored = try? JSONDecoder().decode(AMDOSSession.self, from: data) else { return }
        session = stored
        Task {
            await client.setSession(stored)
            await refreshAuthority()
        }
    }

    private func persist(_ session: AMDOSSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        UserDefaults.standard.set(data, forKey: defaultsKey)
        Task { await client.setSession(session) }
    }
}
