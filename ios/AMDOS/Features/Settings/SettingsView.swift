import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        NavigationStack {
            List {
                Section("アカウント") {
                    if let email = authService.userEmail {
                        LabeledContent("メール", value: email)
                    }
                    Button(role: .destructive) {
                        authService.signOut()
                    } label: {
                        Text("サインアウト")
                    }
                }

                Section("アプリ情報") {
                    LabeledContent("バージョン", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "-")
                }

                if let email = authService.userEmail {
                    NavigationLink("支払情報（住所・振込先）") {
                        PayoutInfoEditView(email: email)
                    }
                }
            }
            .navigationTitle("設定")
        }
    }
}

// MARK: - PayoutInfoEditView

struct PayoutInfoEditView: View {
    let email: String

    @State private var memberId: String = ""
    @State private var memberAddress: String = ""
    @State private var bankInfo: String = ""
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var savedOK = false

    var body: some View {
        Form {
            if isLoading {
                Section {
                    ProgressView("読み込み中…")
                }
            } else {
                Section {
                    Text("支払通知書に印字されます。正確に入力してください。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } header: {
                    Text("注意")
                }

                Section("住所") {
                    TextField(
                        "例: 〒305-0031 茨城県つくば市吾妻1-2-3",
                        text: $memberAddress,
                        axis: .vertical
                    )
                    .lineLimit(3...5)
                    .autocorrectionDisabled()
                }

                Section("振込先") {
                    TextField(
                        "例:\nPayPay銀行\nつばめ支店\n普通口座\n1234567",
                        text: $bankInfo,
                        axis: .vertical
                    )
                    .lineLimit(4...8)
                    .autocorrectionDisabled()
                }

                Section {
                    Button {
                        save()
                    } label: {
                        if isSaving {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("保存する")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isSaving || memberId.isEmpty)
                }

                if let err = saveError {
                    Section {
                        Text(err)
                            .foregroundStyle(.red)
                            .font(.footnote)
                    }
                }
            }
        }
        .navigationTitle("支払情報")
        .navigationBarTitleDisplayMode(.inline)
        .alert("保存しました", isPresented: $savedOK) {
            Button("OK") {}
        }
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            if let profile = try await SupabaseService.shared.fetchMyProfile(email: email) {
                memberId      = profile.memberId
                memberAddress = profile.memberAddress ?? ""
                bankInfo      = profile.bankInfo ?? ""
            }
        } catch {
            saveError = "読み込みエラー: \(error.localizedDescription)"
        }
    }

    private func save() {
        guard !memberId.isEmpty else { return }
        isSaving = true
        saveError = nil
        Task {
            defer { isSaving = false }
            do {
                try await SupabaseService.shared.updateMyPayoutInfo(
                    memberId: memberId,
                    memberAddress: memberAddress,
                    bankInfo: bankInfo
                )
                savedOK = true
            } catch {
                saveError = "保存エラー: \(error.localizedDescription)"
            }
        }
    }
}
