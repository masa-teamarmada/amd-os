import Foundation
import AuthenticationServices
import CryptoKit
import UIKit

@MainActor
final class GoogleSignInHandler: NSObject {
    static let shared = GoogleSignInHandler()

    private let clientID = "1063456084878-1pui006kicgahn5r6eo6j18p4hiq5pnc.apps.googleusercontent.com"
    private let redirectURI = "com.googleusercontent.apps.1063456084878-1pui006kicgahn5r6eo6j18p4hiq5pnc:/oauth2redirect"
    private let callbackScheme = "com.googleusercontent.apps.1063456084878-1pui006kicgahn5r6eo6j18p4hiq5pnc"

    private var authSession: ASWebAuthenticationSession?

    struct SignInResult {
        let idToken: String
        let rawNonce: String
        let email: String
    }

    // MARK: - Sign In

    func signIn() async throws -> SignInResult {
        let codeVerifier = randomBase64URL(bytes: 64)
        let codeChallenge = sha256Base64URL(codeVerifier)
        let rawNonce = randomBase64URL(bytes: 32)
        let hashedNonce = sha256Hex(rawNonce)

        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "nonce", value: hashedNonce),
            URLQueryItem(name: "hd", value: "team-armada.jp"),
        ]
        let authURL = components.url!

        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: callbackScheme
            ) { [weak self] url, error in
                self?.authSession = nil
                if let error = error {
                    continuation.resume(throwing: error)
                } else if let url = url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: GoogleSignInError.cancelled)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            authSession = session
            session.start()
        }

        guard let callbackComponents = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              let code = callbackComponents.queryItems?.first(where: { $0.name == "code" })?.value
        else {
            throw GoogleSignInError.missingCode
        }

        let idToken = try await exchangeCode(code, codeVerifier: codeVerifier)
        let email = try extractEmail(from: idToken)

        guard email.hasSuffix("@team-armada.jp") else {
            throw GoogleSignInError.domainNotAllowed
        }

        return SignInResult(idToken: idToken, rawNonce: rawNonce, email: email)
    }

    // MARK: - Token Exchange

    private func exchangeCode(_ code: String, codeVerifier: String) async throws -> String {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let params: [String: String] = [
            "code": code,
            "client_id": clientID,
            "redirect_uri": redirectURI,
            "grant_type": "authorization_code",
            "code_verifier": codeVerifier,
        ]
        request.httpBody = params
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
            let body = String(data: data, encoding: .utf8) ?? "unknown"
            throw GoogleSignInError.tokenExchangeFailed(body)
        }

        struct TokenResponse: Decodable { let id_token: String }
        let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
        return tokenResponse.id_token
    }

    // MARK: - JWT Payload

    private func extractEmail(from idToken: String) throws -> String {
        let parts = idToken.split(separator: ".")
        guard parts.count >= 2 else { throw GoogleSignInError.invalidToken }

        var b64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64 += "=" }

        guard let data = Data(base64Encoded: b64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let email = json["email"] as? String
        else { throw GoogleSignInError.invalidToken }

        return email
    }

    // MARK: - Crypto Helpers

    private func randomBase64URL(bytes: Int) -> String {
        var buf = [UInt8](repeating: 0, count: bytes)
        SecRandomCopyBytes(kSecRandomDefault, bytes, &buf)
        return Data(buf).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func sha256Base64URL(_ input: String) -> String {
        let hash = SHA256.hash(data: Data(input.utf8))
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func sha256Hex(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .compactMap { String(format: "%02x", $0) }
            .joined()
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding

extension GoogleSignInHandler: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first(where: { $0.activationState == .foregroundActive })?
                .windows.first(where: { $0.isKeyWindow }) ?? UIWindow()
        }
    }
}

// MARK: - Errors

enum GoogleSignInError: LocalizedError {
    case cancelled
    case missingCode
    case domainNotAllowed
    case invalidToken
    case tokenExchangeFailed(String)

    var errorDescription: String? {
        switch self {
        case .cancelled: return "サインインがキャンセルされました"
        case .missingCode: return "認証コードの取得に失敗しました"
        case .domainNotAllowed: return "team-armada.jpドメインのアカウントでサインインしてください"
        case .invalidToken: return "IDトークンの解析に失敗しました"
        case .tokenExchangeFailed(let msg): return "トークン取得に失敗しました: \(msg)"
        }
    }
}
