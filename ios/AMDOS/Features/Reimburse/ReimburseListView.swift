import SwiftUI

struct ReimburseListView: View {
    @EnvironmentObject var authService: AuthService
    @State private var items: [ReimburseItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showForm = false
    @State private var editingItem: ReimburseItem? = nil
    @State private var deleteTarget: ReimburseItem? = nil
    @State private var showDeleteConfirm = false
    @State private var deleteError: String? = nil

    private var email: String { authService.userEmail ?? "" }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && items.isEmpty {
                    ProgressView("読み込み中...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle).foregroundColor(.orange)
                        Text(error).multilineTextAlignment(.center)
                        Button("再試行") { Task { await load() } }.buttonStyle(.bordered)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if items.isEmpty {
                    ContentUnavailableView(
                        "立替なし",
                        systemImage: "yensign.circle",
                        description: Text("右上の＋から追加できるよ")
                    )
                } else {
                    List {
                        ForEach(items) { item in
                            ReimburseRowView(item: item)
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    if item.canDelete {
                                        Button(role: .destructive) {
                                            deleteTarget = item
                                            showDeleteConfirm = true
                                        } label: {
                                            Label("削除", systemImage: "trash")
                                        }
                                    }
                                    if item.canEdit {
                                        Button {
                                            editingItem = item
                                            showForm = true
                                        } label: {
                                            Label("編集", systemImage: "pencil")
                                        }
                                        .tint(.blue)
                                    }
                                }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("立替")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        editingItem = nil
                        showForm = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .task { await load() }
            .refreshable { await load() }
            .sheet(isPresented: $showForm, onDismiss: { Task { await load() } }) {
                ReimburseFormView(editingItem: editingItem, email: email)
            }
            .confirmationDialog("この立替を削除する？", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
                Button("削除する", role: .destructive) {
                    if let t = deleteTarget { Task { await deleteItem(t) } }
                }
                Button("キャンセル", role: .cancel) {}
            }
            .alert("削除エラー", isPresented: .constant(deleteError != nil)) {
                Button("OK") { deleteError = nil }
            } message: {
                Text(deleteError ?? "")
            }
        }
    }

    private func load() async {
        guard !email.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        do {
            items = try await SupabaseService.shared.fetchReimbursements(email: email)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func deleteItem(_ item: ReimburseItem) async {
        do {
            try await SupabaseService.shared.deleteReimbursement(item.reimbursementId, email: email)
            await load()
        } catch {
            deleteError = error.localizedDescription
        }
    }
}

// MARK: - Row

private struct ReimburseRowView: View {
    let item: ReimburseItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(item.date.prefix(10))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(item.projectName.isEmpty ? item.projectId : item.projectName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                statusPill
            }
            HStack(alignment: .firstTextBaseline) {
                Text(item.categoryLabel)
                    .font(.caption2)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color(.systemGray5))
                    .clipShape(Capsule())
                Text(item.desc)
                    .font(.body)
                    .lineLimit(1)
            }
            HStack {
                Text("¥\(item.amountForDisplay.formatted())")
                    .font(.headline)
                    .fontWeight(.semibold)
                Text("(税率\(taxRateLabel(item.taxRate)))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if let mode = item.transportMode, !mode.isEmpty {
                    Spacer()
                    Text("\(item.transportFrom ?? "") → \(item.transportTo ?? "")")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            approvalRow
        }
        .padding(.vertical, 2)
    }

    private var statusPill: some View {
        Text(item.statusLabel)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(statusBg)
            .foregroundColor(statusFg)
            .clipShape(Capsule())
    }

    private var statusBg: Color {
        switch item.statusColor {
        case .orange: return Color.orange.opacity(0.15)
        case .blue:   return Color.blue.opacity(0.15)
        case .green:  return Color.green.opacity(0.15)
        case .red:    return Color.red.opacity(0.15)
        case .purple: return Color.purple.opacity(0.15)
        case .gray:   return Color(.systemGray5)
        }
    }
    private var statusFg: Color {
        switch item.statusColor {
        case .orange: return .orange
        case .blue:   return .blue
        case .green:  return .green
        case .red:    return .red
        case .purple: return .purple
        case .gray:   return .secondary
        }
    }

    private var approvalRow: some View {
        HStack(spacing: 8) {
            approvalBadge(
                label: "PM",
                approved: item.pmApproved,
                by: item.pmApprovedByLabel,
                at: item.pmApprovedAt
            )
            approvalBadge(
                label: "admin",
                approved: item.adminApproved,
                by: item.adminApprovedByLabel,
                at: item.adminApprovedAt
            )
        }
    }

    private func approvalBadge(label: String, approved: Bool, by: String?, at: String?) -> some View {
        HStack(spacing: 3) {
            Image(systemName: approved ? "checkmark.circle.fill" : "circle")
                .font(.caption2)
                .foregroundColor(approved ? .green : Color(.systemGray3))
            Text(label)
                .font(.caption2)
                .foregroundStyle(approved ? Color.primary : Color.secondary)
            if approved, let at = at, !at.isEmpty {
                Text(at.prefix(10))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func taxRateLabel(_ r: Double) -> String {
        if r == 0.08 { return "8%" }
        if r == 0    { return "非課税" }
        return "10%"
    }
}
