import SwiftUI

struct BudgetApprovalView: View {
    @EnvironmentObject private var authService: AuthService
    @State private var pendingItems: [BudgetPendingItem] = []
    @State private var projectNames: [String: String] = [:]
    @State private var memberNames: [String: String] = [:]    // memberId → codeName
    @State private var isLoading = false
    @State private var approvingId: String?
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading && pendingItems.isEmpty {
                ProgressView("読み込み中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if pendingItems.isEmpty {
                ContentUnavailableView(
                    "承認待ちなし",
                    systemImage: "checkmark.circle",
                    description: Text("承認待ちの予算申告はありません")
                )
            } else {
                List {
                    ForEach(pendingItems) { item in
                        BudgetPendingRow(
                            item: item,
                            projectName: projectNames[item.projectId] ?? item.projectId,
                            memberNames: memberNames,
                            isApproving: approvingId == item.id,
                            onApprove: { Task { await approve(item: item) } }
                        )
                    }
                }
            }
        }
        .navigationTitle("予算承認")
        .task { await loadData() }
        .refreshable { await loadData() }
        .alert("エラー", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func loadData() async {
        isLoading = true
        do {
            async let pendingTask = SupabaseService.shared.fetchBudgetPending()
            async let projectsTask = SupabaseService.shared.fetchAllVisibleProjects()
            let (pending, projects) = try await (pendingTask, projectsTask)
            pendingItems = pending
            projectNames = Dictionary(uniqueKeysWithValues: projects.map { ($0.projectId, $0.projectName) })
            // 配賦先メンバーの表示名を収集
            let hasMemberAllocs = pending.contains { $0.memberAllocationsJson?.isEmpty == false }
            if hasMemberAllocs {
                // 全プロジェクトのメンバーをまとめて取得（重複なし）
                var names: [String: String] = [:]
                for item in pending {
                    if let allocs = item.memberAllocationsJson, !allocs.isEmpty {
                        let members = try? await SupabaseService.shared.fetchProjectMembers(projectId: item.projectId)
                        for m in (members ?? []) { names[m.memberId] = m.displayName }
                    }
                }
                memberNames = names
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func approve(item: BudgetPendingItem) async {
        guard let email = authService.userEmail else { return }
        approvingId = item.id
        do {
            try await SupabaseService.shared.approveBudget(
                projectId: item.projectId,
                ym: item.ym,
                invoiceAmount: item.budgetReportedAmount ?? 0,
                bufferAmount: item.budgetBufferAmount ?? 0,
                byEmail: email
            )
            withAnimation { pendingItems.removeAll { $0.id == item.id } }
        } catch {
            errorMessage = error.localizedDescription
        }
        approvingId = nil
    }
}

// MARK: - Budget Pending Row

private struct BudgetPendingRow: View {
    let item: BudgetPendingItem
    let projectName: String
    let memberNames: [String: String]   // memberId → codeName
    let isApproving: Bool
    let onApprove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(projectName)
                    .font(.headline)
                Spacer()
                Text(ymDisplayAdmin(item.ym))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Divider()

            // 請求額
            LabeledAmountRow(label: "請求額", amount: item.budgetReportedAmount ?? 0)

            // バッファ（PMが申告した場合のみ表示）
            if let buffer = item.budgetBufferAmount, buffer > 0 {
                LabeledAmountRow(label: "バッファ", amount: Double(buffer), color: .orange)
            }

            // PJ予算 = 請求額×65% - バッファ
            LabeledAmountRow(
                label: "PJ予算",
                amount: Double(item.pjBudget(buffer: item.budgetBufferAmount ?? 0)),
                color: .accentColor,
                bold: true
            )

            // 配賦額（PMが申告した場合）
            if let allocs = item.memberAllocationsJson, !allocs.isEmpty {
                Divider()
                Text("配賦額").font(.caption).foregroundStyle(.secondary)
                ForEach(allocs.sorted(by: { $0.key < $1.key }), id: \.key) { memberId, amount in
                    LabeledAmountRow(
                        label: memberNames[memberId] ?? memberId,
                        amount: Double(amount)
                    )
                }
                LabeledAmountRow(
                    label: "配賦合計",
                    amount: Double(item.allocationTotal),
                    color: item.allocationTotal <= item.pjBudget(buffer: item.budgetBufferAmount ?? 0) ? .green : .red,
                    bold: true
                )
            }

            if let by = item.budgetReportedBy, !by.isEmpty {
                Text("申告者: \(by)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if isApproving {
                HStack {
                    ProgressView()
                    Text("承認中...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else {
                Button(action: onApprove) {
                    Label("承認する", systemImage: "checkmark.seal.fill")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct LabeledAmountRow: View {
    let label: String
    let amount: Double
    var color: Color = .primary
    var bold: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)
            Spacer()
            Text(formatYenAdmin(amount))
                .font(.subheadline)
                .fontWeight(bold ? .bold : .regular)
                .foregroundColor(color)
        }
    }
}
