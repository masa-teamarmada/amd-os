import SwiftUI

struct MemberListView: View {
    @State private var rows: [AdminMemberRow] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showInactive = false

    var body: some View {
        Group {
            if isLoading && rows.isEmpty {
                ProgressView("読み込み中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 30)).foregroundStyle(.orange)
                    Text(errorMessage).multilineTextAlignment(.center)
                    Button("再試行") { Task { await load() } }.buttonStyle(.bordered)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        Toggle("離脱済みも表示", isOn: $showInactive)
                            .font(.caption)
                    }

                    Section("active (\(activeRows.count))") {
                        ForEach(activeRows) { row in
                            NavigationLink {
                                MemberDetailView(member: row, onSaved: { Task { await load() } })
                            } label: {
                                memberRow(row)
                            }
                        }
                    }

                    if showInactive && !inactiveRows.isEmpty {
                        Section("離脱済み (\(inactiveRows.count))") {
                            ForEach(inactiveRows) { row in
                                NavigationLink {
                                    MemberDetailView(member: row, onSaved: { Task { await load() } })
                                } label: {
                                    memberRow(row)
                                }
                            }
                        }
                    }
                }
                .refreshable { await load() }
            }
        }
        .navigationTitle("メンバー")
        .task { await load() }
    }

    private var activeRows: [AdminMemberRow] { rows.filter(\.isActive) }
    private var inactiveRows: [AdminMemberRow] { rows.filter { !$0.isActive } }

    @ViewBuilder
    private func memberRow(_ row: AdminMemberRow) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(row.displayName)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)
                if (row.isAdmin ?? false) {
                    badge("admin", color: .blue)
                }
                if (row.excludeFromPayoutNotice ?? false) {
                    badge("通知書対象外", color: .gray)
                }
                Spacer()
            }
            if let name = row.memberName, !name.isEmpty {
                Text(name).font(.caption).foregroundStyle(.secondary)
            }
            if let email = row.email, !email.isEmpty {
                Text(email).font(.caption2).foregroundStyle(.tertiary)
            }
        }
    }

    private func badge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2).fontWeight(.semibold)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private func load() async {
        isLoading = rows.isEmpty
        errorMessage = nil
        do {
            let result = try await SupabaseService.shared.fetchAllMembersAdmin()
            await MainActor.run {
                rows = result
                isLoading = false
            }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }
}

// MARK: - Detail / Edit

struct MemberDetailView: View {
    let originalMember: AdminMemberRow
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var codeName: String
    @State private var memberName: String
    @State private var email: String
    @State private var slackId: String
    @State private var memberAddress: String
    @State private var bankInfo: String
    @State private var isAdmin: Bool
    @State private var status: String
    @State private var excludeFromPayoutNotice: Bool
    @State private var joinedAt: String
    @State private var leftAt: String
    @State private var slackPlan: String
    @State private var googlePlan: String

    @State private var isSaving = false
    @State private var toast: String?
    @State private var toastIsError = false

    init(member: AdminMemberRow, onSaved: @escaping () -> Void) {
        self.originalMember = member
        self.onSaved = onSaved
        _codeName = State(initialValue: member.codeName ?? "")
        _memberName = State(initialValue: member.memberName ?? "")
        _email = State(initialValue: member.email ?? "")
        _slackId = State(initialValue: member.slackId ?? "")
        _memberAddress = State(initialValue: member.memberAddress ?? "")
        _bankInfo = State(initialValue: member.bankInfo ?? "")
        _isAdmin = State(initialValue: member.isAdmin ?? false)
        _status = State(initialValue: member.status ?? "active")
        _excludeFromPayoutNotice = State(initialValue: member.excludeFromPayoutNotice ?? false)
        _joinedAt = State(initialValue: member.joinedAt ?? "")
        _leftAt = State(initialValue: member.leftAt ?? "")
        _slackPlan = State(initialValue: member.slackPlan ?? "")
        _googlePlan = State(initialValue: member.googlePlan ?? "")
    }

    var body: some View {
        Form {
            Section("基本") {
                LabeledContent("Member ID") {
                    Text(originalMember.memberId).font(.caption2).foregroundStyle(.secondary)
                }
                TextField("コードネーム", text: $codeName)
                TextField("本名", text: $memberName)
                TextField("メール", text: $email).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                TextField("Slack ID", text: $slackId).textInputAutocapitalization(.never)
            }

            Section("権限・ステータス") {
                Toggle("admin", isOn: $isAdmin)
                Picker("ステータス", selection: $status) {
                    Text("active").tag("active")
                    Text("inactive").tag("inactive")
                }
                Toggle("支払通知書送付対象から除外", isOn: $excludeFromPayoutNotice)
            }

            Section("参加・離脱") {
                TextField("参加日 (YYYY-MM-DD)", text: $joinedAt).textInputAutocapitalization(.never).keyboardType(.numbersAndPunctuation)
                TextField("離脱日 (YYYY-MM-DD)", text: $leftAt).textInputAutocapitalization(.never).keyboardType(.numbersAndPunctuation)
            }

            Section("プラン課金状況") {
                Picker("Slack", selection: $slackPlan) {
                    Text("未設定").tag("")
                    Text("有償 (paid)").tag("paid")
                    Text("無償 (free)").tag("free")
                }
                Picker("Google", selection: $googlePlan) {
                    Text("未設定").tag("")
                    Text("有償 (paid)").tag("paid")
                    Text("無償 (free)").tag("free")
                }
            }

            Section("支払通知書") {
                TextField("住所（通知書PDFに記載）", text: $memberAddress, axis: .vertical).lineLimit(1...3)
                TextField("振込先", text: $bankInfo, axis: .vertical).lineLimit(1...3)
            }

            if let toast {
                Section {
                    Text(toast)
                        .font(.caption)
                        .foregroundStyle(toastIsError ? .red : .green)
                }
            }
        }
        .scrollDismissesKeyboard(.immediately)
        .navigationTitle(codeName.isEmpty ? "メンバー" : codeName)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(isSaving ? "保存中..." : "保存") { Task { await save() } }
                    .disabled(isSaving)
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("完了") { amdHideKeyboard() }
            }
        }
    }

    private func save() async {
        isSaving = true
        toast = nil

        func textOrNull(_ s: String) -> Any {
            let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? NSNull() : trimmed
        }

        let body: [String: Any] = [
            "code_name": textOrNull(codeName),
            "member_name": textOrNull(memberName),
            "email": textOrNull(email),
            "slack_id": textOrNull(slackId),
            "member_address": textOrNull(memberAddress),
            "bank_info": textOrNull(bankInfo),
            "is_admin": isAdmin,
            "status": status,
            "exclude_from_payout_notice": excludeFromPayoutNotice,
            "joined_at": textOrNull(joinedAt),
            "left_at": textOrNull(leftAt),
            "slack_plan": textOrNull(slackPlan),
            "google_plan": textOrNull(googlePlan)
        ]

        do {
            try await SupabaseService.shared.updateMemberAdmin(memberId: originalMember.memberId, body: body)
            toast = "保存しました"
            toastIsError = false
            onSaved()
            try? await Task.sleep(nanoseconds: 700_000_000)
            dismiss()
        } catch {
            toast = error.localizedDescription
            toastIsError = true
        }
        isSaving = false
    }
}
