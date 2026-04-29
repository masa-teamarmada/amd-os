import SwiftUI

// MARK: - 修正依頼スレッド表示

struct RevisionThreadView: View {
    let revision: MsProgressRevision
    let onConfirm: () -> Void
    let onDiscard: () -> Void
    let onReply: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                statusBadge
                Spacer()
                if let date = revision.createdAt {
                    Text(formatDate(date))
                        .font(.system(size: 9))
                        .foregroundStyle(.tertiary)
                }
            }

            if let pct = revision.revisedPct {
                HStack(spacing: 4) {
                    Image(systemName: "speedometer")
                        .font(.system(size: 10))
                        .foregroundStyle(AMD.blue)
                    Text("つくよみ提案: \(Int(pct))%")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(AMD.blue)
                    if let cur = revision.currentPct {
                        Text("(現在 \(Int(cur))%)")
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                ForEach(revision.messages) { msg in
                    bubble(for: msg)
                }
            }

            if revision.status == .pending {
                HStack(spacing: 8) {
                    Spacer()
                    Button { onReply() } label: {
                        Label("再依頼", systemImage: "arrow.uturn.left")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color.gray)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    Button { onDiscard() } label: {
                        Label("破棄", systemImage: "xmark")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color.red.opacity(0.85))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    Button { onConfirm() } label: {
                        Label("OK 確定", systemImage: "checkmark")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            .background(Color.green)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(10)
        .background(Color(.tertiarySystemBackground))
        .cornerRadius(10)
    }

    @ViewBuilder
    private var statusBadge: some View {
        switch revision.status {
        case .pending:
            Label("確認待ち", systemImage: "hourglass")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.orange)
        case .confirmed:
            Label("確定済", systemImage: "checkmark.seal.fill")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.green)
        case .discarded:
            Label("破棄", systemImage: "trash")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.gray)
        }
    }

    @ViewBuilder
    private func bubble(for msg: MsRevisionMessage) -> some View {
        let isMine = msg.senderKind == .pm
        HStack(alignment: .bottom, spacing: 6) {
            if !isMine {
                avatar
            }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 2) {
                if !isMine {
                    Text("つくよみ")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                Text(msg.body)
                    .font(.system(size: 12))
                    .foregroundStyle(isMine ? .white : .primary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(isMine ? Color.blue : Color(.systemGray5))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .frame(maxWidth: 260, alignment: isMine ? .trailing : .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: isMine ? .trailing : .leading)
    }

    private var avatar: some View {
        Image(systemName: "moon.stars.fill")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 22, height: 22)
            .background(Color.indigo.opacity(0.85))
            .clipShape(Circle())
    }

    private func formatDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ja_JP")
        f.dateFormat = "M/d HH:mm"
        return f.string(from: d)
    }
}

// MARK: - 修正依頼入力 Sheet

struct MsRevisionRequestSheet: View {
    let projectId: String
    let milestoneId: String
    let milestoneTitle: String
    let ym: String
    let currentPct: Double
    let currentNote: String?
    let existingRevisionId: String?
    let onSubmitted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var authService: AuthService

    @State private var requestText: String = ""
    @State private var isSubmitting: Bool = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledRowMs(label: "MS", value: milestoneTitle)
                    LabeledRowMs(label: "対象月", value: displayYm(ym))
                    LabeledRowMs(label: "現在の進捗", value: "\(Int(currentPct))%")
                    if let note = currentNote, !note.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("現在のnote")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(note)
                                .font(.caption)
                                .foregroundStyle(.primary)
                        }
                    }
                }
                Section("つくよみへの修正依頼") {
                    TextEditor(text: $requestText)
                        .frame(minHeight: 160)
                    Text("例: 「実は来週VC面談決まったから50%は進んでるはず」「論文書き始めたよ」「Notion更新したからもう一回見て」")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let err = errorMessage {
                    Section { Text(err).foregroundStyle(.red).font(.caption) }
                }
            }
            .navigationTitle(existingRevisionId == nil ? "つくよみに修正依頼" : "再依頼")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSubmitting ? "送信中..." : "送信") {
                        Task { await submit() }
                    }
                    .disabled(!canSubmit || isSubmitting)
                }
            }
        }
    }

    private var canSubmit: Bool {
        !requestText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func submit() async {
        let trimmed = requestText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isSubmitting = true
        errorMessage = nil
        do {
            _ = try await SupabaseService.shared.requestMsRevision(
                projectId: projectId,
                milestoneId: milestoneId,
                ym: ym,
                requestText: trimmed,
                requestedBy: authService.userEmail ?? "pm",
                existingRevisionId: existingRevisionId
            )
            isSubmitting = false
            onSubmitted()
            dismiss()
        } catch {
            isSubmitting = false
            errorMessage = error.localizedDescription
        }
    }

    private func displayYm(_ ym: String) -> String {
        guard ym.count == 6, let m = Int(ym.suffix(2)) else { return ym }
        return "\(ym.prefix(4))年\(m)月"
    }
}

private struct LabeledRowMs: View {
    let label: String
    let value: String
    var body: some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.system(.body, design: .monospaced))
        }
        .font(.subheadline)
    }
}
