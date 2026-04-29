import Foundation
import SwiftUI

@MainActor
class AuthService: ObservableObject {
    @Published var isSignedIn: Bool = false
    @Published var userEmail: String?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    init() {
        restoreSignIn()
    }

    private func restoreSignIn() {
        Task {
            do {
                try await SupabaseService.shared.refreshSession()
                if let email = await SupabaseService.shared.currentUserEmail() {
                    self.userEmail = email
                    self.isSignedIn = true
                }
            } catch {
                // セッションなし — ログイン画面を表示
            }
        }
    }

    func signIn() async {
        isLoading = true
        errorMessage = nil
        do {
            let result = try await GoogleSignInHandler.shared.signIn()
            try await SupabaseService.shared.signInWithGoogle(
                idToken: result.idToken,
                nonce: result.rawNonce
            )
            userEmail = result.email
            isSignedIn = true
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func signOut() {
        userEmail = nil
        isSignedIn = false
        Task { try? await SupabaseService.shared.signOut() }
    }
}
