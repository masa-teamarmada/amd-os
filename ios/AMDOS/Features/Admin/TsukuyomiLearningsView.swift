import SwiftUI

struct TsukuyomiLearningsView: View {
    @EnvironmentObject private var authService: AuthService
    @State private var rows: [TsukuyomiLearningRow] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showRemoved = false
    @State private var unlearnTarget: TsukuyomiLearningRow?
    @State private var unlearnReason = ""
    @State private var isUnlearning = false
    @State private var toastMessage: String?

    private var filteredRows: [TsukuyomiLearningRow] {
        showRemoved ? rows : rows.filter(\.isActive)
    }

    var body: some View {
        Group {
            if isLoading && rows.isEmpty {
                ProgressView("読み込み中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let err = errorMessage {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                        .font(.system(size: 30))
                    Text(err)
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                    Button("再読み込み") { Task { await loadData() } }
                        .buttonStyle(.bordered)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredRows.isEmpty {
                ContentUnavailableView(
                    showRemoved ? "学習データなし" : "有効な学習データなし",
                    systemImage: "brain",
                    description: Text(showRemoved ? "つくよみはまだ何も学習していません" : "すべての学習は削除済みです")
                )
            } else {
                List {
                    ForEach(filteredRows) { row in
                        LearningCardRow(row: row) {
                            unlearnTarget = row
                            unlearnReason = ""
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("つくよみの学び")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Toggle(isOn: $showRemoved) {
                    Text("削除済み表示")
                        .font(.caption)
                }
                .toggleStyle(.button)
                .tint(.secondary)
                .font(.caption)
            }
        }
        .task { await loadData() }
        .refreshable { await loadData() }
        .sheet(item: $unlearnTarget) { target in
            UnlearnSheet(
                row: target,
                reason: $unlearnReason,
                isUnlearning: $isUnlearning,
                onConfirm: {
                    Task { await doUnlearn(target) }
                }
            )
        }
        .overlay(alignment: .bottom) {
            if let msg = toastMessage {
                Text(msg)
                    .font(.subheadline)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.bottom, 24)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.3), value: toastMessage)
    }

    private func loadData() async {
        isLoading = true
        do {
            rows = try await SupabaseService.shared.fetchTsukuyomiLearnings()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func doUnlearn(_ target: TsukuyomiLearningRow) async {
        isUnlearning = true
        let email = authService.userEmail ?? "unknown"
        do {
            try await SupabaseService.shared.unlearnTsukuyomi(
                learningId: target.id,
                reason: unlearnReason,
                removedBy: email
            )
            unlearnTarget = nil
            await loadData()
            showToast("覚えないようにしたよ🌙")
        } catch {
            unlearnTarget = nil
            showToast("エラー: \(error.localizedDescription)")
        }
        isUnlearning = false
    }

    private func showToast(_ msg: String) {
        toastMessage = msg
        Task {
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            toastMessage = nil
        }
    }
}

// MARK: - Card Row

private struct LearningCardRow: View {
    let row: TsukuyomiLearningRow
    let onUnlearn: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                ScopeBadge(label: row.scopeDisplayLabel)
                SourceBadge(label: row.sourceLabel, isActive: row.isActive)
                Spacer()
                if let date = row.createdAt {
                    Text(shortDate(date))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            Text(row.content)
                .font(.subheadline)
                .foregroundStyle(row.isActive ? .primary : .secondary)
                .fixedSize(horizontal: false, vertical: true)

            if let key = row.scopeKey, !key.isEmpty {
                Text("PJ: \(key)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            if !row.isActive {
                if let reason = row.removedReason, !reason.isEmpty {
                    Text("削除理由: \(reason)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .italic()
                }
            } else {
                HStack {
                    Spacer()
                    Button(role: .destructive) {
                        onUnlearn()
                    } label: {
                        Label("覚えないでほしい", systemImage: "brain.slash")
                            .font(.caption)
                            .fontWeight(.semibold)
                    }
                    .buttonStyle(.bordered)
                    .tint(.red)
                }
            }
        }
        .padding(.vertical, 4)
        .opacity(row.isActive ? 1.0 : 0.6)
    }

    private func shortDate(_ iso: String) -> String {
        let prefix = iso.prefix(10)
        return String(prefix)
    }
}

private struct ScopeBadge: View {
    let label: String
    var body: some View {
        Text(label)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color.purple.opacity(0.12))
            .foregroundStyle(.purple)
            .clipShape(Capsule())
    }
}

private struct SourceBadge: View {
    let label: String
    let isActive: Bool
    var body: some View {
        Text(label)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(isActive ? Color.blue.opacity(0.10) : Color.gray.opacity(0.10))
            .foregroundStyle(isActive ? Color.blue : Color.secondary)
            .clipShape(Capsule())
    }
}

// MARK: - Unlearn Sheet

private struct UnlearnSheet: View {
    let row: TsukuyomiLearningRow
    @Binding var reason: String
    @Binding var isUnlearning: Bool
    let onConfirm: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("削除する学習") {
                    Text(row.content)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Section {
                    TextField("理由（任意）", text: $reason, axis: .vertical)
                        .lineLimit(3...6)
                } header: {
                    Text("なぜ覚えないでほしいか")
                } footer: {
                    Text("この理由もつくよみの学習として保存されます。空欄でも構いません。")
                }

                Section {
                    Button(role: .destructive) {
                        onConfirm()
                    } label: {
                        HStack {
                            Spacer()
                            if isUnlearning {
                                ProgressView()
                            } else {
                                Label("覚えないようにする", systemImage: "brain.slash")
                                    .fontWeight(.semibold)
                            }
                            Spacer()
                        }
                    }
                    .disabled(isUnlearning)
                }
            }
            .navigationTitle("覚えないでほしい")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                        .disabled(isUnlearning)
                }
            }
        }
    }
}
