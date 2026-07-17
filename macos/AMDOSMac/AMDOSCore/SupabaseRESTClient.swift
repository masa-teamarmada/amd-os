import Foundation
import AppKit
import AuthenticationServices
import CryptoKit
import OSLog

enum AMDOSAuthLog {
    static let logger = Logger(subsystem: "jp.team-armada.amdos.macos", category: "google-auth")
}

enum AMDOSGoogleOAuth {
    static let clientID = "1063456084878-1pui006kicgahn5r6eo6j18p4hiq5pnc.apps.googleusercontent.com"
    static let callbackScheme = "com.googleusercontent.apps.1063456084878-1pui006kicgahn5r6eo6j18p4hiq5pnc"
    static let redirectURI = "\(callbackScheme):/oauth2redirect"
}

actor AMDOSRESTClient {
    static let shared = AMDOSRESTClient()

    private let baseURL: URL
    private let anonKey: String
    private var session: AMDOSSession?
    private var googleSignInSession: GoogleSignInSession?

    init(configuration: AMDOSConfiguration = .fromBundle()) {
        self.baseURL = configuration.supabaseURL
        self.anonKey = configuration.anonKey
    }

    func setSession(_ session: AMDOSSession?) {
        self.session = session
    }

    /// ASWebAuthenticationSession が捕捉できなかった場合の復帰口。
    /// Googleの正規callback schemeをアプリ側でも受け、先に届いた一方だけを採用する。
    func acceptOAuthCallback(_ callback: URL) async {
        guard callback.scheme?.lowercased() == AMDOSGoogleOAuth.callbackScheme else { return }
        AMDOSAuthLog.logger.notice("google_auth_callback_received_by_app")
        await googleSignInSession?.receive(callback)
    }

    func authenticateWithGoogle() async throws -> AMDOSSession {
        let googleSignInSession = await GoogleSignInSession()
        self.googleSignInSession = googleSignInSession
        defer { self.googleSignInSession = nil }

        let googleIdentity = try await googleSignInSession.authenticate()
        AMDOSAuthLog.logger.notice("google_auth_id_token_received")

        var tokenComponents = URLComponents(url: baseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        tokenComponents.queryItems = [URLQueryItem(name: "grant_type", value: "id_token")]
        var request = URLRequest(url: tokenComponents.url!)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "provider": "google",
            "id_token": googleIdentity.idToken,
            "nonce": googleIdentity.rawNonce
        ])

        AMDOSAuthLog.logger.notice("google_auth_supabase_exchange_started")
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        let token = try JSONDecoder().decode(AMDOSTokenResponse.self, from: data)
        let expiresAt = token.expiresIn.map { Date().addingTimeInterval(TimeInterval($0)) }
        let next = AMDOSSession(accessToken: token.accessToken, refreshToken: token.refreshToken, expiresAt: expiresAt, email: emailFromJWT(token.accessToken))
        session = next
        AMDOSAuthLog.logger.notice("google_auth_supabase_exchange_succeeded")
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
        return AMDOSProjectDetail(project: project, summary: "詳細の進捗・月次・MTGは、このPJのネイティブ詳細画面へ順次移植するよ。", source: "projects / PWA /project/[projectId]/cockpit")
    }

    func fetchNotifications(limit: Int = 30) async throws -> [AMDOSNotification] {
        let data = try await request(path: "rest/v1/app_notifications?select=id,kind,title,body,created_at,read_at&order=created_at.desc&limit=\(limit)")
        return try JSONDecoder().decode([AMDOSNotification].self, from: data)
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
    case googleTokenExchangeFailed
    case notFound
    case http(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "接続先の設定が正しくないよ。"
        case .oauthStartFailed: return "Googleログイン画面を開始できなかったよ。もう一度試してね。"
        case .oauthCallbackMissing: return "Googleログインの戻り値を確認できなかったよ。"
        case .googleTokenExchangeFailed: return "Googleの本人確認はできたけど、AMD OSのセッション作成に失敗したよ。もう一度試してね。"
        case .oauthTimedOut: return "Googleログインの戻りを90秒待ったけど確認できなかったよ。認証画面を閉じて、もう一度試してね。"
        case .notFound: return "対象のデータが見つからなかったよ。"
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

    static func sha256Hex(for value: String) -> String {
        SHA256.hash(data: Data(value.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}

@MainActor
private final class GoogleSignInSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var webSession: ASWebAuthenticationSession?
    private var continuation: CheckedContinuation<URL, Error>?
    private var timeoutTask: Task<Void, Never>?

    struct Identity: Sendable {
        let idToken: String
        let rawNonce: String
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApplication.shared.keyWindow ?? NSApplication.shared.windows.first ?? NSWindow()
    }

    func authenticate() async throws -> Identity {
        let codeVerifier = PKCE.generateVerifier(byteCount: 64)
        let rawNonce = PKCE.generateVerifier(byteCount: 32)
        let challenge = PKCE.challenge(for: codeVerifier)

        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: AMDOSGoogleOAuth.clientID),
            URLQueryItem(name: "redirect_uri", value: AMDOSGoogleOAuth.redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "nonce", value: PKCE.sha256Hex(for: rawNonce)),
            URLQueryItem(name: "hd", value: "team-armada.jp")
        ]
        guard let authorizeURL = components.url else { throw AMDOSNetworkError.invalidURL }
        AMDOSAuthLog.logger.notice("google_auth_authorize_url_ready")

        let callback = try await start(url: authorizeURL)
        let callbackItems = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        if callbackItems.contains(where: { $0.name == "error" }) {
            throw AMDOSNetworkError.oauthCallbackMissing
        }
        guard let code = callbackItems.first(where: { $0.name == "code" })?.value else {
            throw AMDOSNetworkError.oauthCallbackMissing
        }
        let idToken = try await exchangeGoogleCode(code, verifier: codeVerifier)
        return Identity(idToken: idToken, rawNonce: rawNonce)
    }

    func start(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            self.continuation = continuation
            self.timeoutTask = Task { [weak self] in
                try? await Task.sleep(for: .seconds(90))
                guard !Task.isCancelled else { return }
                AMDOSAuthLog.logger.error("google_auth_timed_out")
                self?.finish(.failure(AMDOSNetworkError.oauthTimedOut))
            }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: AMDOSGoogleOAuth.callbackScheme) { callback, error in
                if let callback {
                    AMDOSAuthLog.logger.notice("google_auth_callback_received_by_web_session")
                    self.finish(.success(callback))
                } else {
                    AMDOSAuthLog.logger.error("google_auth_web_session_failed")
                    self.finish(.failure(error ?? AMDOSNetworkError.oauthCallbackMissing))
                }
            }
            self.webSession = session
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            guard session.start() else {
                AMDOSAuthLog.logger.error("google_auth_web_session_could_not_start")
                self.finish(.failure(AMDOSNetworkError.oauthStartFailed))
                return
            }
            AMDOSAuthLog.logger.notice("google_auth_web_session_started")
        }
    }

    func receive(_ callback: URL) {
        finish(.success(callback), cancellingWebSession: true)
    }

    private func exchangeGoogleCode(_ code: String, verifier: String) async throws -> String {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let values = [
            "code": code,
            "client_id": AMDOSGoogleOAuth.clientID,
            "redirect_uri": AMDOSGoogleOAuth.redirectURI,
            "grant_type": "authorization_code",
            "code_verifier": verifier
        ]
        request.httpBody = values
            .map { key, value in "\(key)=\(value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value)" }
            .sorted()
            .joined(separator: "&")
            .data(using: .utf8)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let payload = try? JSONDecoder().decode(GoogleTokenResponse.self, from: data) else {
            AMDOSAuthLog.logger.error("google_auth_google_token_exchange_failed")
            throw AMDOSNetworkError.googleTokenExchangeFailed
        }
        return payload.idToken
    }

    private func finish(_ result: Result<URL, Error>, cancellingWebSession: Bool = false) {
        guard let continuation else { return }
        self.continuation = nil
        timeoutTask?.cancel()
        timeoutTask = nil
        let session = webSession
        webSession = nil
        if cancellingWebSession { session?.cancel() }
        switch result {
        case .success(let callback): continuation.resume(returning: callback)
        case .failure(let error): continuation.resume(throwing: error)
        }
    }
}

private struct GoogleTokenResponse: Decodable {
    let idToken: String

    enum CodingKeys: String, CodingKey {
        case idToken = "id_token"
    }
}

private extension Data {
    var base64URLEncoded: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
