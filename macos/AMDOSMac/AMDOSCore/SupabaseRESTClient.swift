import Foundation
import AppKit
import CryptoKit
import OSLog
import AuthenticationServices

enum AMDOSAuthLog {
    static let logger = Logger(subsystem: "jp.team-armada.amdos.macos", category: "google-auth")
}

actor AMDOSRESTClient {
    static let shared = AMDOSRESTClient()

    private let baseURL: URL
    private let anonKey: String
    private var session: AMDOSSession?
    private var oauthBrowser: OAuthBrowser?

    init(configuration: AMDOSConfiguration = .fromBundle()) {
        self.baseURL = configuration.supabaseURL
        self.anonKey = configuration.anonKey
    }

    func setSession(_ session: AMDOSSession?) {
        self.session = session
    }

    /// 外部ブラウザがcustom URL schemeをSwiftUIアプリへ直接配送したときの復帰口。
    func acceptOAuthCallback(_ callback: URL) async {
        guard callback.scheme?.lowercased() == "amdos-macos-auth" else { return }
        AMDOSAuthLog.logger.notice("google_auth_callback_received_by_app")
        await oauthBrowser?.receive(callback)
    }

    func authenticateWithGoogle() async throws -> AMDOSSession {
        let verifier = PKCE.generateVerifier(byteCount: 32)
        let challenge = PKCE.challenge(for: verifier)
        let redirect = "amdos-macos-auth://oauth/callback"
        var components = URLComponents(url: baseURL.appendingPathComponent("auth/v1/authorize"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: redirect),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]
        guard let authorizeURL = components.url else { throw AMDOSNetworkError.invalidURL }
        AMDOSAuthLog.logger.notice("google_auth_authorize_url_ready")
        let oauthBrowser = await OAuthBrowser()
        self.oauthBrowser = oauthBrowser
        defer { self.oauthBrowser = nil }
        let callback = try await oauthBrowser.open(url: authorizeURL)
        AMDOSAuthLog.logger.notice("google_auth_callback_received")
        let callbackComponents = URLComponents(url: callback, resolvingAgainstBaseURL: false)
        let queryItems = callbackComponents?.queryItems ?? []
        var fragmentComponents = URLComponents()
        fragmentComponents.percentEncodedQuery = callbackComponents?.fragment
        let callbackItems = queryItems + (fragmentComponents.queryItems ?? [])

        if callbackItems.contains(where: { $0.name == "error" }) {
            AMDOSAuthLog.logger.error("google_auth_provider_reported_error")
            throw AMDOSNetworkError.oauthProviderError
        }

        guard let code = callbackItems.first(where: { $0.name == "code" })?.value else {
            AMDOSAuthLog.logger.error("google_auth_callback_has_no_code")
            throw AMDOSNetworkError.oauthCallbackMissing
        }

        AMDOSAuthLog.logger.notice("google_auth_pkce_exchange_started")
        var tokenComponents = URLComponents(url: baseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        tokenComponents.queryItems = [URLQueryItem(name: "grant_type", value: "pkce")]
        var request = URLRequest(url: tokenComponents.url!)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "auth_code": code,
            "code_verifier": verifier
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        let token = try JSONDecoder().decode(AMDOSTokenResponse.self, from: data)
        let expiresAt = token.expiresIn.map { Date().addingTimeInterval(TimeInterval($0)) }
        let next = AMDOSSession(accessToken: token.accessToken, refreshToken: token.refreshToken, expiresAt: expiresAt, email: emailFromJWT(token.accessToken))
        session = next
        AMDOSAuthLog.logger.notice("google_auth_pkce_exchange_succeeded")
        return next
    }

    func fetchProjects(activeOnly: Bool = true) async throws -> [AMDOSProject] {
        var query = "select=project_id,project_name,client_name,status,start_ym,end_ym,project_type&order=project_id"
        if activeOnly { query += "&status=eq.active" }
        let data = try await request(path: "rest/v1/projects?\(query)")
        return try JSONDecoder().decode([AMDOSProject].self, from: data)
    }

    func fetchProjectDetail(projectId: String) async throws -> AMDOSProjectDetail {
        let safeId = projectId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? projectId
        let data = try await request(path: "rest/v1/projects?select=project_id,project_name,client_name,status,start_ym,end_ym,project_type&project_id=eq.\(safeId)")
        guard let project = try JSONDecoder().decode([AMDOSProject].self, from: data).first else {
            throw AMDOSNetworkError.notFound
        }
        return AMDOSProjectDetail(project: project, summary: "進捗・月次・打ち合わせの情報を、このプロジェクトの詳細から確認できるよ。", source: "")
    }

    func fetchNotifications(email: String) async throws -> [AMDOSNotification] {
        let endpoint = baseURL.appendingPathComponent("functions/v1/pull-app-notifications")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 8
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(NotificationRequest(email: email))
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        let envelope = try JSONDecoder().decode(PendingNotificationResponse.self, from: data)
        guard envelope.ok else { throw AMDOSNetworkError.notificationUnavailable }
        return (envelope.notifications ?? []).map { item in
            AMDOSNotification(
                id: item.id,
                kind: item.notificationType,
                title: item.title,
                body: item.body,
                createdAt: item.createdAt,
                readAt: nil
            )
        }
    }

    func fetchIsAdmin(email: String) async throws -> Bool {
        let escaped = email.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? email
        let data = try await request(path: "rest/v1/members?select=is_admin&email=eq.\(escaped)&limit=1")
        struct Row: Decodable { let is_admin: Bool? }
        return try JSONDecoder().decode([Row].self, from: data).first?.is_admin == true
    }

    private func request(path: String) async throws -> Data {
        guard let url = URL(string: baseURL.absoluteString + "/" + path) else { throw AMDOSNetworkError.invalidURL }
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = session?.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return data
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? "unknown error"
            throw AMDOSNetworkError.http(body)
        }
    }

    private func emailFromJWT(_ token: String) -> String? {
        let parts = token.split(separator: ".")
        guard parts.count > 1 else { return nil }
        var value = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        value += String(repeating: "=", count: (4 - value.count % 4) % 4)
        guard let data = Data(base64Encoded: value) else { return nil }
        struct Claims: Decodable { let email: String? }
        return try? JSONDecoder().decode(Claims.self, from: data).email
    }

    private struct NotificationRequest: Encodable {
        let email: String
    }

    private struct PendingNotificationResponse: Decodable {
        let ok: Bool
        let notifications: [PendingNotification]?
    }

    private struct PendingNotification: Decodable {
        let id: String
        let notificationType: String?
        let title: String
        let body: String
        let projectId: String?
        let ym: String?
        let createdAt: String?

        enum CodingKeys: String, CodingKey {
            case id
            case notificationType = "notification_type"
            case title
            case body
            case projectId = "project_id"
            case ym
            case createdAt = "created_at"
        }
    }
}

struct AMDOSConfiguration: Sendable {
    let supabaseURL: URL
    let anonKey: String

    static func fromBundle() -> AMDOSConfiguration {
        let urlString = Bundle.main.object(forInfoDictionaryKey: "AMDOS_SUPABASE_URL") as? String ?? "https://nbnhrhybjslbawdukvvk.supabase.co"
        let key = Bundle.main.object(forInfoDictionaryKey: "AMDOS_SUPABASE_ANON_KEY") as? String
            ?? ""
        return AMDOSConfiguration(supabaseURL: URL(string: urlString)!, anonKey: key)
    }
}

enum AMDOSNetworkError: LocalizedError {
    case invalidURL
    case oauthStartFailed
    case oauthCallbackMissing
    case oauthTimedOut
    case oauthProviderError
    case notFound
    case notificationUnavailable
    case http(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "接続先の設定が正しくないよ。"
        case .oauthStartFailed: return "Googleログイン画面を開始できなかったよ。もう一度試してね。"
        case .oauthCallbackMissing: return "Googleログインの戻り値を確認できなかったよ。"
        case .oauthProviderError: return "Googleログインが中断されたか、許可されなかったよ。Google画面で許可してもう一度試してね。"
        case .oauthTimedOut: return "Googleログインの戻りを90秒待ったけど確認できなかったよ。認証画面を閉じて、もう一度試してね。"
        case .notFound: return "対象のデータが見つからなかったよ。"
        case .notificationUnavailable: return ""
        case .http(let body): return "OSとの通信に失敗したよ。\n\(body)"
        }
    }
}

private struct AMDOSTokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int?
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
    }
}

private enum PKCE {
    static func generateVerifier(byteCount: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        return Data(bytes).base64URLEncoded
    }

    static func challenge(for verifier: String) -> String {
        Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncoded
    }

}

@MainActor
private final class OAuthBrowser: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var continuation: CheckedContinuation<URL, Error>?
    private var timeoutTask: Task<Void, Never>?
    private var webSession: ASWebAuthenticationSession?

    func open(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            self.continuation = continuation
            self.timeoutTask = Task { [weak self] in
                try? await Task.sleep(for: .seconds(90))
                guard !Task.isCancelled else { return }
                AMDOSAuthLog.logger.error("google_auth_timed_out")
                self?.finish(.failure(AMDOSNetworkError.oauthTimedOut))
            }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "amdos-macos-auth") { [weak self] callback, error in
                Task { @MainActor in
                    if let callback {
                        self?.finish(.success(callback))
                    } else if let error {
                        AMDOSAuthLog.logger.error("google_auth_browser_failed: \(error.localizedDescription, privacy: .public)")
                        self?.finish(.failure(AMDOSNetworkError.oauthProviderError))
                    } else {
                        self?.finish(.failure(AMDOSNetworkError.oauthCallbackMissing))
                    }
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            webSession = session
            guard session.start() else {
                AMDOSAuthLog.logger.error("google_auth_browser_could_not_start")
                self.finish(.failure(AMDOSNetworkError.oauthStartFailed))
                return
            }
            AMDOSAuthLog.logger.notice("google_auth_browser_started")
        }
    }

    func receive(_ callback: URL) {
        finish(.success(callback))
    }

    private func finish(_ result: Result<URL, Error>) {
        guard let continuation else { return }
        self.continuation = nil
        timeoutTask?.cancel()
        timeoutTask = nil
        webSession = nil
        switch result {
        case .success(let callback): continuation.resume(returning: callback)
        case .failure(let error): continuation.resume(throwing: error)
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApp.keyWindow ?? NSApp.windows.first ?? NSWindow()
    }
}

private extension Data {
    var base64URLEncoded: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
