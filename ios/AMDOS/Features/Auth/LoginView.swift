import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        VStack(spacing: 40) {
            Spacer()

            VStack(spacing: 12) {
                Text("AMD OS")
                    .font(.system(size: 36, weight: .bold))
                Text("Team ARMADA 業務OS")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if let error = authService.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Button {
                Task { await authService.signIn() }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 20))
                    Text("Googleでサインイン")
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(Color(.systemBackground))
                .foregroundStyle(.primary)
                .overlay {
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.secondary.opacity(0.4), lineWidth: 1)
                }
            }
            .padding(.horizontal, 40)
            .disabled(authService.isLoading)

            Text("@team-armada.jpアカウントでサインインしてください")
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()
        }
        .overlay {
            if authService.isLoading {
                ProgressView()
                    .scaleEffect(1.5)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.ultraThinMaterial)
            }
        }
    }
}
