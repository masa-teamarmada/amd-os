import SwiftUI

struct ProposalComposeSheet: View {
    let memberId: String
    let projectId: String
    let projectName: String
    let milestoneId: String
    let milestoneTitle: String
    let ym: String
    let currentProgressPct: Double
    let onSubmitted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var includeProgressPct: Bool = false
    @State private var pctText: String = ""
    @State private var bodyText: String = ""
    @State private var isSubmitting: Bool = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledRow(label: "PJ", value: projectName)
                    LabeledRow(label: "MS", value: milestoneTitle)
                    LabeledRow(label: "対象月", value: displayYm(ym))
                    LabeledRow(label: "現在の進捗", value: "\(Int(currentProgressPct))%")
                }
                Section("提案内容") {
                    Toggle("進捗率の修正を提案する", isOn: $includeProgressPct)
                    if includeProgressPct {
                        HStack {
                            Text("提案進捗率")
                            Spacer()
                            TextField("60", text: $pctText)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 80)
                            Text("%")
                        }
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("つくよみへのメッセージ")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextEditor(text: $bodyText)
                            .frame(minHeight: 140)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(Color(.separator), lineWidth: 0.5)
                            )
                    }
                    Text("例: こんなことも終わらせたよ / 進捗は50%じゃなくて60%まで進んでるはず")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let err = errorMessage {
                    Section { Text(err).foregroundStyle(.red).font(.caption) }
                }
            }
            .navigationTitle("つくよみに提案")
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
        !bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func submit() async {
        let trimmed = bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isSubmitting = true
        errorMessage = nil
        let pct: Double? = {
            guard includeProgressPct,
                  let v = Double(pctText.trimmingCharacters(in: .whitespaces)) else { return nil }
            return min(max(v, 0), 100)
        }()
        do {
            _ = try await SupabaseService.shared.createProposal(
                memberId: memberId,
                projectId: projectId,
                milestoneId: milestoneId,
                ym: ym,
                suggestedPct: pct,
                suggestedText: trimmed
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

private struct LabeledRow: View {
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
