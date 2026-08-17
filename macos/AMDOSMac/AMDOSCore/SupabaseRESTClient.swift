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

    /// 旧SPS/旧AMD Scoreは監査履歴としてDBに残すだけで、現行クライアントからは
    /// 読み書きとも許可しない。画面の取りこぼしがあってもtransport境界で止める。
    private static let retiredScoreTables: Set<String> = [
        "amd_score_inputs",
        "amd_score_alpha",
        "seed_sps_assessments",
    ]

    private let pwaBaseURL: URL
    private let baseURL: URL
    private let anonKey: String
    private var session: AMDOSSession?
    private var oauthBrowser: OAuthBrowser?

    init(configuration: AMDOSConfiguration = .fromBundle()) {
        self.pwaBaseURL = configuration.pwaBaseURL
        self.baseURL = configuration.supabaseURL
        self.anonKey = configuration.anonKey
    }

    func setSession(_ session: AMDOSSession?) {
        self.session = session
    }

    /// PJ限定ログインを終えるときは、PWA `/auth/callback` と同じ狭い署名付き
    /// workspace cookie だけを残す。Supabaseの通常JWTをMacに残さない。
    func clearProjectWorkspaceSession() {
        let cookieName = "amd_os_project_session"
        for cookie in HTTPCookieStorage.shared.cookies(for: pwaBaseURL) ?? [] where cookie.name == cookieName {
            HTTPCookieStorage.shared.deleteCookie(cookie)
        }
    }

    /// 外部ブラウザがcustom URL schemeをSwiftUIアプリへ直接配送したときの復帰口。
    func acceptOAuthCallback(_ callback: URL) async {
        guard callback.scheme?.lowercased() == "amdos-macos-auth" else { return }
        AMDOSAuthLog.logger.notice("google_auth_callback_received_by_app")
        await oauthBrowser?.receive(callback)
    }

    func authenticateWithGoogle(loginScope: AMDOSLoginScope) async throws -> AMDOSSession {
        let verifier = PKCE.generateVerifier(byteCount: 32)
        let challenge = PKCE.challenge(for: verifier)
        let redirect = "amdos-macos-auth://oauth/callback"
        var components = URLComponents(url: baseURL.appendingPathComponent("auth/v1/authorize"), resolvingAgainstBaseURL: false)!
        let googleScopes = loginScope == .portfolio
            ? [
                "openid",
                "email",
                "profile",
                "https://www.googleapis.com/auth/calendar.readonly",
                "https://www.googleapis.com/auth/gmail.readonly",
            ]
            : ["openid", "email", "profile"]
        var queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: redirect),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "scopes", value: googleScopes.joined(separator: " ")),
        ]
        if loginScope == .portfolio {
            // PWAのAMDメンバー入口と同じGoogle Workspace / Calendar / Gmail consent。
            queryItems += [
                URLQueryItem(name: "hd", value: "team-armada.jp"),
                URLQueryItem(name: "access_type", value: "offline"),
                URLQueryItem(name: "prompt", value: "consent"),
                URLQueryItem(name: "include_granted_scopes", value: "true"),
            ]
        } else {
            // PWAの「参加PJだけを見る」と同じアカウント選択。追加Google権限は要求しない。
            queryItems.append(URLQueryItem(name: "prompt", value: "select_account"))
        }
        components.queryItems = queryItems
        guard let authorizeURL = components.url else { throw AMDOSNetworkError.invalidURL }
        AMDOSAuthLog.logger.notice("google_auth_authorize_url_ready")
        let oauthBrowser = await OAuthBrowser()
        self.oauthBrowser = oauthBrowser
        defer { self.oauthBrowser = nil }
        let callback = try await oauthBrowser.open(url: authorizeURL)
        AMDOSAuthLog.logger.notice("google_auth_callback_received")
        let callbackComponents = URLComponents(url: callback, resolvingAgainstBaseURL: false)
        let callbackQueryItems = callbackComponents?.queryItems ?? []
        var fragmentComponents = URLComponents()
        fragmentComponents.percentEncodedQuery = callbackComponents?.fragment
        let callbackItems = callbackQueryItems + (fragmentComponents.queryItems ?? [])

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
        // PWA callbackと同じ入口ゲートを通す。PJ限定ユーザーなら参加PJだけを
        // 確認し、portfolioユーザーならCalendar/Gmailを検証する。
        // 一時的にactorのsessionを載せることで、PWA routeへ同一Bearerを送る。
        session = next
        do {
            let data = try await sendPWA(
                path: "/api/macos/auth/google-complete",
                body: AMDOSGoogleCalendarCompletion(
                    providerToken: token.providerToken?.trimmedNonEmpty,
                    providerRefreshToken: token.providerRefreshToken,
                    expiresIn: token.expiresIn
                )
            )
            let completion = try JSONDecoder().decode(AMDOSGoogleAuthCompletion.self, from: data)
            guard completion.ok == true else {
                throw AMDOSNetworkError.http(completion.error ?? "Googleログインを確認できなかったよ")
            }
        } catch {
            session = nil
            throw error
        }
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
        try await refreshSessionIfNeeded()
        let endpoint = baseURL.appendingPathComponent("functions/v1/pull-app-notifications")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 8
        request.setValue("Bearer \(session?.accessToken ?? anonKey)", forHTTPHeaderField: "Authorization")
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

    func fetchMemberAccess(email: String) async throws -> AMDOSMemberAccess? {
        let escaped = email.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? email
        let data = try await request(path: "rest/v1/members?select=is_admin,google_calendar_status&email=eq.\(escaped)&limit=1")
        return try JSONDecoder().decode([AMDOSMemberAccess].self, from: data).first
    }

    /// PWA/browserとNativeの両方が使う、PJ限定ログインの唯一の閲覧入口。
    /// ここで返るscope以外のSupabaseテーブルをPJ限定画面から直接読ませない。
    func fetchProjectWorkspaceAccess() async throws -> AMDOSProjectWorkspaceAccess {
        let response = try await fetchPWA(AMDOSProjectWorkspaceAccessEnvelope.self, path: "/api/project-workspace/access")
        guard response.ok == true, let access = response.access else {
            throw AMDOSNetworkError.http(response.error ?? "PJワークスペースの権限を確認できなかったよ")
        }
        return access
    }

    // These are transport primitives only. Feature stores below select the
    // exact columns and decode them into route-specific models.
    func fetchTable<T: Decodable & Sendable>(
        _ type: T.Type,
        table: String,
        select: String,
        filters: [String: String] = [:],
        order: String? = nil,
        limit: Int? = nil
    ) async throws -> [T] {
        try rejectRetiredScoreTable(table)
        var query = [URLQueryItem(name: "select", value: select)]
        query.append(contentsOf: filters.keys.sorted().map { URLQueryItem(name: $0, value: filters[$0]) })
        if let order { query.append(URLQueryItem(name: "order", value: order)) }
        if let limit { query.append(URLQueryItem(name: "limit", value: String(limit))) }
        let data = try await request(path: "rest/v1/\(table)", queryItems: query)
        return try JSONDecoder().decode([T].self, from: data)
    }

    /// PWA の `select(..., { count: "exact", head: true })` と同じ件数取得。
    /// 管理者限定バッジなどで全レコードを端末に読み出さないために使う。
    func countTable(table: String, filters: [String: String] = [:]) async throws -> Int {
        try rejectRetiredScoreTable(table)
        try await refreshSessionIfNeeded()
        var components = URLComponents(url: baseURL.appendingPathComponent("rest/v1/\(table)"), resolvingAgainstBaseURL: false)
        var query = [URLQueryItem(name: "select", value: "id")]
        query.append(contentsOf: filters.keys.sorted().map { URLQueryItem(name: $0, value: filters[$0]) })
        components?.queryItems = query
        guard let url = components?.url else { throw AMDOSNetworkError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("count=exact", forHTTPHeaderField: "Prefer")
        request.setValue("0-0", forHTTPHeaderField: "Range")
        if let token = session?.accessToken { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        guard let http = response as? HTTPURLResponse,
              let contentRange = http.value(forHTTPHeaderField: "Content-Range"),
              let total = Int(contentRange.split(separator: "/").last ?? "") else {
            throw AMDOSNetworkError.http("PWA件数ヘッダーを確認できなかった")
        }
        return total
    }

    func fetchPWA<T: Decodable & Sendable>(
        _ type: T.Type,
        path: String,
        query: [String: String] = [:]
    ) async throws -> T {
        let data = try await pwaRequest(path: path, method: "GET", queryItems: query.keys.sorted().map { URLQueryItem(name: $0, value: query[$0]) })
        return try JSONDecoder().decode(T.self, from: data)
    }

    /// PWA API がJSON以外（private画像など）を返すときにも、同じBearer sessionで取得する。
    func fetchPWAData(path: String, query: [String: String] = [:]) async throws -> Data {
        try await pwaRequest(
            path: path,
            method: "GET",
            queryItems: query.keys.sorted().map { URLQueryItem(name: $0, value: query[$0]) }
        )
    }

    func pwaURL(path: String, query: [String: String] = [:]) -> URL? {
        let pathParts = path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
        let cleanPath = String(pathParts[0]).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard var components = URLComponents(url: pwaBaseURL.appendingPathComponent(cleanPath), resolvingAgainstBaseURL: false) else { return nil }
        var items = query.keys.sorted().map { URLQueryItem(name: $0, value: query[$0]) }
        if pathParts.count == 2 {
            var pathQuery = URLComponents()
            pathQuery.percentEncodedQuery = String(pathParts[1])
            items.append(contentsOf: pathQuery.queryItems ?? [])
        }
        components.queryItems = items.isEmpty ? nil : items
        return components.url
    }

    func sendPWA<Body: Encodable & Sendable>(path: String, method: String = "POST", body: Body) async throws -> Data {
        let data = try JSONEncoder().encode(body)
        return try await pwaRequest(path: path, method: method, body: data, contentType: "application/json")
    }

    /// Supabase Edge Functionへ、現在のMacセッション本人のJWTでJSONを送る。
    /// 管理操作でanon keyへフォールバックすると認証境界が曖昧になるため、
    /// ログイン済みsessionが無い場合はリクエスト自体を開始しない。
    func postEdge<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        function name: String,
        body: Body,
        response: Response.Type = Response.self
    ) async throws -> Response {
        try await refreshSessionIfNeeded()
        guard let accessToken = session?.accessToken.trimmedNonEmpty else {
            throw AMDOSNetworkError.httpStatus(status: 401, body: "authenticated session required")
        }
        let cleanName = name.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !cleanName.isEmpty else { throw AMDOSNetworkError.invalidURL }
        let endpoint = baseURL.appendingPathComponent("functions/v1/\(cleanName)")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, urlResponse) = try await URLSession.shared.data(for: request)
        try validate(response: urlResponse, data: data)
        return try JSONDecoder().decode(Response.self, from: data)
    }

    func patchTable<Body: Encodable & Sendable>(
        table: String,
        filters: [String: String],
        body: Body
    ) async throws -> Data {
        try rejectRetiredScoreTable(table)
        let data = try JSONEncoder().encode(body)
        let query = filters.keys.sorted().map { URLQueryItem(name: $0, value: filters[$0]) }
        return try await request(path: "rest/v1/\(table)", method: "PATCH", queryItems: query, body: data, contentType: "application/json")
    }

    func postTable<Body: Encodable & Sendable>(table: String, body: Body) async throws -> Data {
        try rejectRetiredScoreTable(table)
        let data = try JSONEncoder().encode(body)
        return try await request(path: "rest/v1/\(table)", method: "POST", body: data, contentType: "application/json")
    }

    /// PWA Supabase client の `upsert(..., { onConflict })` と同じ PostgREST 境界。
    /// 呼び出し側は既存のRLSと unique conflict key をそのまま使い、端末固有のwriterを作らない。
    func upsertTable<Body: Encodable & Sendable>(
        table: String,
        onConflict: String,
        body: Body
    ) async throws -> Data {
        try rejectRetiredScoreTable(table)
        let data = try JSONEncoder().encode(body)
        return try await request(
            path: "rest/v1/\(table)",
            method: "POST",
            queryItems: [URLQueryItem(name: "on_conflict", value: onConflict)],
            body: data,
            contentType: "application/json",
            prefer: "resolution=merge-duplicates,return=representation"
        )
    }

    func deleteTable(table: String, filters: [String: String]) async throws {
        try rejectRetiredScoreTable(table)
        let query = filters.keys.sorted().map { URLQueryItem(name: $0, value: filters[$0]) }
        _ = try await request(path: "rest/v1/\(table)", method: "DELETE", queryItems: query)
    }

    private func rejectRetiredScoreTable(_ table: String) throws {
        if Self.retiredScoreTables.contains(table) {
            throw AMDOSNetworkError.http("旧スコアテーブル \(table) は退役済み。現行SPS APIを使ってね")
        }
    }

    /// private Storage の添付を、PWA と同じ1時間限定URLとして開くための読み取り境界。
    /// 署名済みURL自体の取得にはログイン中の本人JWTを使い、ファイル内容はここでは読まない。
    func createSignedStorageURL(bucket: String, path: String, expiresIn: Int = 60 * 60) async throws -> URL {
        let safeBucket = bucket.trimmingCharacters(in: .whitespacesAndNewlines)
        let safePath = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !safeBucket.isEmpty, !safePath.isEmpty, expiresIn > 0 else {
            throw AMDOSNetworkError.invalidURL
        }

        let body = try JSONEncoder().encode(AMDOSStorageSignedURLRequest(expiresIn: expiresIn))
        let data = try await request(
            path: "storage/v1/object/sign/\(safeBucket)/\(safePath)",
            method: "POST",
            body: body,
            contentType: "application/json"
        )
        let response = try JSONDecoder().decode(AMDOSStorageSignedURLResponse.self, from: data)
        let signedPath = response.signedURL
        if let absolute = URL(string: signedPath), absolute.scheme != nil {
            return absolute
        }

        let prefix = baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let suffix = signedPath.hasPrefix("/") ? signedPath : "/\(signedPath)"
        guard let url = URL(string: "\(prefix)/storage/v1\(suffix)") else {
            throw AMDOSNetworkError.invalidURL
        }
        return url
    }

    func uploadMultipart(path: String, fields: [String: String], files: [AMDOSUploadFile]) async throws -> Data {
        let boundary = "AMDOS-\(UUID().uuidString)"
        var body = Data()
        let crlf = "\r\n"
        for (name, value) in fields {
            body.append(Data("--\(boundary)\(crlf)Content-Disposition: form-data; name=\"\(name)\"\(crlf)\(crlf)\(value)\(crlf)".utf8))
        }
        for file in files {
            body.append(Data("--\(boundary)\(crlf)Content-Disposition: form-data; name=\"\(file.fieldName)\"; filename=\"\(file.filename)\"\(crlf)Content-Type: \(file.mimeType)\(crlf)\(crlf)".utf8))
            body.append(file.data)
            body.append(Data(crlf.utf8))
        }
        body.append(Data("--\(boundary)--\(crlf)".utf8))
        return try await pwaRequest(path: path, method: "POST", body: body, contentType: "multipart/form-data; boundary=\(boundary)")
    }

    private func request(
        path: String,
        method: String = "GET",
        queryItems: [URLQueryItem] = [],
        body: Data? = nil,
        contentType: String? = nil,
        prefer: String? = nil
    ) async throws -> Data {
        try await makeRequest(base: baseURL, path: path, method: method, queryItems: queryItems, body: body, contentType: contentType, prefer: prefer)
    }

    private func pwaRequest(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        body: Data? = nil,
        contentType: String? = nil
    ) async throws -> Data {
        try await makeRequest(base: pwaBaseURL, path: path, method: method, queryItems: queryItems, body: body, contentType: contentType)
    }

    private func makeRequest(
        base: URL,
        path: String,
        method: String,
        queryItems: [URLQueryItem],
        body: Data?,
        contentType: String?,
        prefer: String? = nil
    ) async throws -> Data {
        try await refreshSessionIfNeeded()
        let pathParts = path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
        let cleanPath = String(pathParts[0]).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard var components = URLComponents(url: base.appendingPathComponent(cleanPath), resolvingAgainstBaseURL: false) else { throw AMDOSNetworkError.invalidURL }
        var mergedQuery = queryItems
        if pathParts.count == 2 {
            var pathQuery = URLComponents()
            pathQuery.percentEncodedQuery = String(pathParts[1])
            mergedQuery.append(contentsOf: pathQuery.queryItems ?? [])
        }
        components.queryItems = mergedQuery.isEmpty ? nil : mergedQuery
        guard let url = components.url else { throw AMDOSNetworkError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = session?.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let contentType { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        if let prefer {
            request.setValue(prefer, forHTTPHeaderField: "Prefer")
        } else if method != "GET" {
            request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        }
        request.httpBody = body
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return data
    }

    /// Native sessions are persisted between launches. Refresh shortly before
    /// expiry so every RLS/API request continues to use the user's Supabase
    /// identity instead of falling back to an anonymous request.
    private func refreshSessionIfNeeded() async throws {
        guard let current = session,
              let expiresAt = current.expiresAt,
              expiresAt.timeIntervalSinceNow < 60 else { return }

        var components = URLComponents(url: baseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        guard let url = components.url else { throw AMDOSNetworkError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": current.refreshToken])
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        let token = try JSONDecoder().decode(AMDOSTokenResponse.self, from: data)
        let next = AMDOSSession(
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiresAt: token.expiresIn.map { Date().addingTimeInterval(TimeInterval($0)) },
            email: emailFromJWT(token.accessToken) ?? current.email
        )
        session = next
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? "unknown error"
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw AMDOSNetworkError.httpStatus(status: status, body: body)
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

    private struct AMDOSStorageSignedURLRequest: Encodable {
        let expiresIn: Int
    }

    private struct AMDOSStorageSignedURLResponse: Decodable {
        let signedURL: String
    }
}

struct AMDOSConfiguration: Sendable {
    let supabaseURL: URL
    let anonKey: String
    let pwaBaseURL: URL

    static func fromBundle() -> AMDOSConfiguration {
        let urlString = Bundle.main.object(forInfoDictionaryKey: "AMDOS_SUPABASE_URL") as? String ?? "https://nbnhrhybjslbawdukvvk.supabase.co"
        let key = Bundle.main.object(forInfoDictionaryKey: "AMDOS_SUPABASE_ANON_KEY") as? String
            ?? ""
        let pwaString = Bundle.main.object(forInfoDictionaryKey: "AMDOS_PWA_BASE_URL") as? String ?? "https://amd-os-pwa.vercel.app"
        return AMDOSConfiguration(supabaseURL: URL(string: urlString)!, anonKey: key, pwaBaseURL: URL(string: pwaString)!)
    }
}

struct AMDOSUploadFile: Sendable {
    let fieldName: String
    let filename: String
    let mimeType: String
    let data: Data
}

struct AMDOSMemberAccess: Decodable, Sendable {
    let isAdmin: Bool?
    let googleCalendarStatus: String?

    enum CodingKeys: String, CodingKey {
        case isAdmin = "is_admin"
        case googleCalendarStatus = "google_calendar_status"
    }
}

private struct AMDOSProjectWorkspaceAccessEnvelope: Decodable, Sendable {
    let ok: Bool?
    let access: AMDOSProjectWorkspaceAccess?
    let error: String?
}

enum AMDOSNetworkError: LocalizedError {
    case invalidURL
    case oauthStartFailed
    case oauthCallbackMissing
    case oauthTimedOut
    case oauthProviderError
    case calendarPermissionRequired
    case notFound
    case notificationUnavailable
    case http(String)
    case httpStatus(status: Int, body: String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "接続先の設定が正しくないよ。"
        case .oauthStartFailed: return "Googleログイン画面を開始できなかったよ。もう一度試してね。"
        case .oauthCallbackMissing: return "Googleログインの戻り値を確認できなかったよ。"
        case .oauthProviderError: return "Googleログインが中断されたか、許可されなかったよ。Google画面で許可してもう一度試してね。"
        case .calendarPermissionRequired: return "Google CalendarとGmailの共有が必要だよ。Google画面で両方を許可して、もう一度ログインしてね。"
        case .oauthTimedOut: return "Googleログインの戻りを90秒待ったけど確認できなかったよ。認証画面を閉じて、もう一度試してね。"
        case .notFound: return "対象のデータが見つからなかったよ。"
        case .notificationUnavailable: return ""
        case .http(let body): return "OSとの通信に失敗したよ。\n\(body)"
        case .httpStatus(let status, let body):
            switch status {
            case 401: return "ログイン情報を確認できないよ。いったんサインアウトして、もう一度Googleでログインしてね。"
            case 403: return "この情報は管理者だけが確認できるよ。"
            case 404: return "対象のPWA機能またはデータが見つからなかったよ。"
            default: return "OSとの通信に失敗したよ。\n\(body)"
            }
        }
    }
}

private struct AMDOSTokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int?
    let providerToken: String?
    let providerRefreshToken: String?
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case providerToken = "provider_token"
        case providerRefreshToken = "provider_refresh_token"
    }
}

private struct AMDOSGoogleCalendarCompletion: Encodable, Sendable {
    let providerToken: String?
    let providerRefreshToken: String?
    let expiresIn: Int?

    enum CodingKeys: String, CodingKey {
        case providerToken = "provider_token"
        case providerRefreshToken = "provider_refresh_token"
        case expiresIn = "expires_in"
    }
}

private struct AMDOSGoogleAuthCompletion: Decodable, Sendable {
    let ok: Bool?
    let scope: String?
    let error: String?
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
