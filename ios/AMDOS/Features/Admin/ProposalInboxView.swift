import SwiftUI

struct ProposalInboxView: View {
    @EnvironmentObject private var authService: AuthService
    @State private var proposals: [MsProgressProposal] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var rejectingProposal: MsProgressProposal?
    @State private var rejectReasonText: String = ""
    @State private var actingProposalId: String?

    var body: some View {
        Group {
            if isLoading && proposals.isEmpty {
                ProgressView("読み込み中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let err = errorMessage {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(.orange)
                    Text(err).multilineTextAlignment(.center)
                    Button("再試行") { Task { await load() } }.buttonStyle(.bordered)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if proposals.isEmpty {
                ContentUnavailableView("確認待ちの提案はないよ", systemImage: "tray")
            } else {
                List {
                    ForEach(proposals) { p in
                        proposalCard(p)
                    }
                }
            }
        }
        .navigationTitle("提案箱")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $rejectingProposal) { p in
            rejectSheet(for: p)
        }
    }

    @ViewBuilder
    private func proposalCard(_ p: MsProgressProposal) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(p.memberName ?? p.memberId)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text("→")
                    .foregroundStyle(.secondary)
                Text(p.projectName ?? p.projectId)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
                if let date = p.createdAt {
                    Text(formatDate(date))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Text("MS: \(p.milestoneTitle ?? p.milestoneId) (対象月 \(displayYm(p.ym)))")
                .font(.caption)
                .foregroundStyle(.secondary)

            if let pct = p.suggestedPct {
                HStack(spacing: 4) {
                    Image(systemName: "speedometer")
                        .font(.system(size: 11))
                    Text("提案進捗率: \(Int(pct))%")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.blue)
                }
            }

            if let body = p.suggestedText, !body.isEmpty {
                Text(body)
                    .font(.system(size: 13))
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.tertiarySystemBackground))
                    .cornerRadius(6)
            }

            if !p.messages.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("やりとり")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    ForEach(p.messages.prefix(3)) { msg in
                        HStack(alignment: .top, spacing: 4) {
                            Text(senderTag(msg.senderKind))
                                .font(.system(size: 9, weight: .bold))
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(senderColor(msg.senderKind).opacity(0.15))
                                .foregroundStyle(senderColor(msg.senderKind))
                                .clipShape(Capsule())
                            Text(msg.body)
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            HStack(spacing: 10) {
                Spacer()
                Button {
                    Task { await approve(p) }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark")
                        Text("承認")
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.green)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(actingProposalId == p.id)

                Button {
                    rejectingProposal = p
                    rejectReasonText = ""
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.uturn.left")
                        Text("差し戻す")
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.red)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(actingProposalId == p.id)
            }
        }
        .padding(12)
    }

    private func rejectSheet(for p: MsProgressProposal) -> some View {
        NavigationStack {
            Form {
                Section("提案者") {
                    Text(p.memberName ?? p.memberId)
                    Text("MS: \(p.milestoneTitle ?? p.milestoneId)")
                        .font(.caption)
                }
                Section("差し戻し理由（生のまま入れてOK、つくよみが優しく言い換える）") {
                    TextEditor(text: $rejectReasonText)
                        .frame(minHeight: 140)
                }
                Section {
                    Button {
                        Task { await reject(p) }
                    } label: {
                        if actingProposalId == p.id {
                            ProgressView()
                        } else {
                            Label("つくよみ経由で差し戻す", systemImage: "moon.stars.fill")
                        }
                    }
                    .disabled(rejectReasonText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .navigationTitle("差し戻し")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { rejectingProposal = nil }
                }
            }
        }
    }

    // MARK: - Actions

    private func load() async {
        isLoading = true
        do {
            proposals = try await SupabaseService.shared.fetchPendingProposals()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func approve(_ p: MsProgressProposal) async {
        actingProposalId = p.id
        defer { actingProposalId = nil }
        do {
            let adminId = authService.userEmail ?? "admin"
            try await SupabaseService.shared.approveProposal(proposalId: p.id, adminId: adminId)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func reject(_ p: MsProgressProposal) async {
        let reason = rejectReasonText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !reason.isEmpty else { return }
        actingProposalId = p.id
        defer { actingProposalId = nil }
        do {
            let adminId = authService.userEmail ?? "admin"
            try await SupabaseService.shared.rejectProposal(proposalId: p.id, adminId: adminId, rawReason: reason)
            rejectingProposal = nil
            rejectReasonText = ""
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func displayYm(_ ym: String) -> String {
        guard ym.count == 6, let m = Int(ym.suffix(2)) else { return ym }
        return "\(ym.prefix(4))年\(m)月"
    }

    private func formatDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ja_JP")
        f.dateFormat = "M/d HH:mm"
        return f.string(from: d)
    }

    private func senderTag(_ k: MsProposalSenderKind) -> String {
        switch k {
        case .member:    return "メンバー"
        case .admin:     return "Admin"
        case .tsukuyomi: return "つくよみ"
        }
    }

    private func senderColor(_ k: MsProposalSenderKind) -> Color {
        switch k {
        case .member:    return .blue
        case .admin:     return .gray
        case .tsukuyomi: return .indigo
        }
    }
}
