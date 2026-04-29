import SwiftUI

// MARK: - BillingMatrixView

struct BillingMatrixView: View {
    @EnvironmentObject private var authService: AuthService
    @State private var rows: [BillingMatrixRow] = []
    @State private var projectNames: [String: String] = [:]
    @State private var projectMeta: [String: SupabaseProject] = [:]
    @State private var ctbEstimateStatuses: [String: MatrixCellStatus] = [:]
    @State private var reimbursementStatuses: [String: MatrixCellStatus] = [:]
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedCycle: BillingMatrixRow?

    var groupedByYm: [(ym: String, rows: [BillingMatrixRow])] {
        let grouped = Dictionary(grouping: rows) { $0.ym }
        return grouped.keys.sorted(by: >).map { ym in
            (ym: ym, rows: grouped[ym]!.sorted { $0.projectId < $1.projectId })
        }
    }

    var body: some View {
        Group {
            if isLoading && rows.isEmpty {
                ProgressView("読み込み中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle").font(.largeTitle).foregroundColor(.orange)
                    Text(error).multilineTextAlignment(.center)
                    Button("再試行") { Task { await loadData() } }.buttonStyle(.bordered)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if rows.isEmpty {
                ContentUnavailableView("データなし", systemImage: "tablecells")
            } else {
                List {
                    ForEach(groupedByYm, id: \.ym) { group in
                        Section(header: Text(ymDisplayAdmin(group.ym)).font(.subheadline).fontWeight(.semibold)) {
                            ForEach(group.rows) { cycle in
                                MatrixRowView(
                                    cycle: cycle,
                                    projectName: projectNames[cycle.projectId] ?? cycle.projectId,
                                    projectType: projectMeta[cycle.projectId]?.projectType,
                                    estimateStatus: ctbEstimateStatuses[cycle.id],
                                    reimbursementStatus: reimbursementStatuses[cycle.id]
                                )
                                .contentShape(Rectangle())
                                .onTapGesture { selectedCycle = cycle }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Billing Matrix")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadData() }
        .refreshable { await loadData() }
        .sheet(item: $selectedCycle) { cycle in
            BillingCycleDetailSheet(
                cycle: cycle,
                projectName: projectNames[cycle.projectId] ?? cycle.projectId,
                projectType: projectMeta[cycle.projectId]?.projectType,
                initialEstimateStatus: ctbEstimateStatuses[cycle.id],
                onUpdate: { Task { await loadData() } }
            )
            .environmentObject(authService)
        }
    }

    private func loadData() async {
        isLoading = true
        errorMessage = nil
        do {
            async let matrixTask = SupabaseService.shared.fetchBillingMatrix()
            async let projectsTask = SupabaseService.shared.fetchAllVisibleProjects()
            let (matrix, projects) = try await (matrixTask, projectsTask)
            projectMeta = Dictionary(uniqueKeysWithValues: projects.map { ($0.projectId, $0) })
            rows = matrix.filter { row in
                guard let project = projectMeta[row.projectId] else { return false }
                let status = project.status.lowercased()
                if status == "active" || status == "frozen" {
                    return true
                }
                if status == "ended", let endYm = project.endYm, !endYm.isEmpty {
                    return row.ym <= endYm
                }
                return false
            }
            projectNames = Dictionary(uniqueKeysWithValues: projects.map { ($0.projectId, $0.projectName) })
            ctbEstimateStatuses = makeCTBEstimateStatusMap(rows: rows, projectMeta: projectMeta)
            reimbursementStatuses = await makeReimbursementStatusMap(rows: rows)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Matrix Row (dot view)

private struct MatrixRowView: View {
    let cycle: BillingMatrixRow
    let projectName: String
    let projectType: String?
    let estimateStatus: MatrixCellStatus?
    let reimbursementStatus: MatrixCellStatus?

    var body: some View {
        HStack(spacing: 10) {
            Text(projectName)
                .font(.footnote)
                .lineLimit(1)
                .frame(minWidth: 50, maxWidth: 90, alignment: .leading)

            Spacer()

            HStack(spacing: 5) {
                ForEach(matrixStepDefs(for: projectType), id: \.key) { step in
                    let status = status(for: step.key)
                    ZStack {
                        Circle()
                            .fill(dotFill(status))
                            .frame(width: 11, height: 11)
                        if status == .skip {
                            Image(systemName: "minus")
                                .font(.system(size: 6, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 3)
    }

    private func status(for stepKey: String) -> MatrixCellStatus {
        if stepKey == "estimateSend" {
            return estimateStatus ?? .undone
        }
        if stepKey == "reimburseConfirm" {
            return reimbursementStatus ?? .undone
        }
        return cycle.stepStatus(for: stepKey)
    }

    private func dotFill(_ status: MatrixCellStatus) -> Color {
        switch status {
        case .done:  return .green
        case .undone: return Color(.systemGray4)
        case .skip:   return .orange
        }
    }
}

// MARK: - Cycle Detail Sheet

struct BillingCycleDetailSheet: View {
    let cycle: BillingMatrixRow
    let projectName: String
    let projectType: String?
    let initialEstimateStatus: MatrixCellStatus?
    var onUpdate: (() -> Void)?

    @EnvironmentObject private var authService: AuthService
    @Environment(\.dismiss) private var dismiss
    @State private var isUpdating: String?
    @State private var errorMessage: String?
    @State private var nudgeMessage: String?
    @State private var statusOverrides: [String: MatrixCellStatus] = [:]
    @State private var showInvoiceYmPicker = false
    @State private var reimbursementConfirmed = true

    var body: some View {
        NavigationStack {
            List {
                Section("請求設定") {
                    HStack {
                        Text("稼働月")
                        Spacer()
                        Text(ymDisplayAdmin(cycle.ym))
                            .foregroundStyle(.secondary)
                    }
                    Button {
                        showInvoiceYmPicker = true
                    } label: {
                        HStack {
                            Text("請求月")
                            Spacer()
                            Text(ymDisplayAdmin(cycle.effectiveInvoiceYm))
                                .foregroundStyle(.secondary)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .buttonStyle(.plain)
                }

                Section {
                    ForEach(stepDefs, id: \.key) { step in
                        let status = localStatus(for: step.key)
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(dotColor(status))
                                    .frame(width: 14, height: 14)
                                if status == .skip {
                                    Image(systemName: "minus")
                                        .font(.system(size: 7, weight: .bold))
                                        .foregroundColor(.white)
                                }
                            }
                            Text(step.label)
                                .font(.body)
                            Spacer()
                            if step.key == "reimburseConfirm" {
                                Text("立替タブから自動判定")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            } else if isUpdating == step.key {
                                ProgressView().scaleEffect(0.75)
                            } else {
                                stepActionButton(step: step, status: status)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                } header: {
                    Text("ステップ管理")
                } footer: {
                    Text("タップして完了/未完了を切り替えます。変更後もこの画面に残ります。")
                        .font(.caption)
                }

                if !blockingMissingSteps.isEmpty {
                    Section {
                        Text("未完了: \(blockingMissingSteps.map(\.label).joined(separator: " / "))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Button {
                            Task { await sendDelayNudge() }
                        } label: {
                            if isUpdating == "paymentDelayNudge" {
                                HStack {
                                    ProgressView().scaleEffect(0.8)
                                    Text("nudge送信中...")
                                }
                            } else {
                                Label("未完了メンバーへnudge送信", systemImage: "bell.badge")
                            }
                        }
                    } header: {
                        Text("支払い延期ルール")
                    } footer: {
                        Text("入金確認までに未完了タスクが残っていると、その月の支払いは翌月へ延期されます。")
                            .font(.caption)
                    }
                }

                if let error = errorMessage {
                    Section {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }

                if let nudgeMessage {
                    Section {
                        Text(nudgeMessage)
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                }
            }
            .navigationTitle("\(projectName) \(ymDisplayAdmin(cycle.ym))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
            .sheet(isPresented: $showInvoiceYmPicker, onDismiss: onUpdate) {
                AdminInvoiceYmPickerSheet(
                    projectId: cycle.projectId,
                    bizYm: cycle.ym,
                    currentInvoiceYm: cycle.effectiveInvoiceYm
                )
            }
            .task {
                let map = (try? await SupabaseService.shared.fetchReimbursementCompletionMap(
                    projectId: cycle.projectId,
                    yms: [cycle.ym]
                )) ?? [:]
                reimbursementConfirmed = map[cycle.ym] ?? true
            }
        }
    }

    private var stepDefs: [MatrixStepDef] {
        matrixStepDefs(for: projectType)
    }

    @ViewBuilder
    private func stepActionButton(step: MatrixStepDef, status: MatrixCellStatus) -> some View {
        if step.canSkip {
            Menu {
                if status != .done {
                    Button("完了にする") { Task { await updateStep(step, newStatus: "done") } }
                }
                if status != .skip {
                    Button("スキップ") { Task { await updateStep(step, newStatus: "skip") } }
                }
                if status != .undone {
                    Button("未完了に戻す", role: .destructive) { Task { await updateStep(step, newStatus: "undone") } }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundColor(.accentColor)
            }
        } else {
            let isDone = status == .done
            Button(isDone ? "未完了に戻す" : "完了にする") {
                Task { await updateStep(step, newStatus: isDone ? "undone" : "done") }
            }
            .font(.caption)
            .foregroundColor(isDone ? .orange : .accentColor)
        }
    }

    private func dotColor(_ status: MatrixCellStatus) -> Color {
        switch status {
        case .done:   return .green
        case .undone: return Color(.systemGray4)
        case .skip:   return .orange
        }
    }

    private func localStatus(for stepKey: String) -> MatrixCellStatus {
        if let override = statusOverrides[stepKey] {
            return override
        }
        if stepKey == "estimateSend" {
            return initialEstimateStatus ?? .undone
        }
        if stepKey == "reimburseConfirm" {
            return reimbursementConfirmed ? .done : .undone
        }
        return cycle.stepStatus(for: stepKey)
    }

    private func mapStatus(_ status: String) -> MatrixCellStatus {
        switch status {
        case "done":
            return .done
        case "skip":
            return .skip
        default:
            return .undone
        }
    }

    private func updateStep(_ step: MatrixStepDef, newStatus: String) async {
        let email = authService.userEmail ?? ""
        let isTryingToAdvancePayment = newStatus == "done" && (step.key == "payment" || step.key == "rewardPaid")
        if isTryingToAdvancePayment && !blockingMissingSteps.isEmpty {
            await sendDelayNudge()
            errorMessage = "未完了タスクが残っているため、この月の支払いは翌月へ延期だよ。先に \(blockingMissingSteps.map(\.label).joined(separator: " / ")) を完了してね。"
            return
        }
        isUpdating = step.key
        errorMessage = nil
        nudgeMessage = nil
        do {
            try await SupabaseService.shared.updateBillingMatrixCell(
                projectId: cycle.projectId,
                ym: cycle.ym,
                taskKey: step.key,
                newStatus: newStatus,
                byEmail: email
            )
            statusOverrides[step.key] = mapStatus(newStatus)
            isUpdating = nil
            onUpdate?()
        } catch {
            errorMessage = error.localizedDescription
            isUpdating = nil
        }
    }

    private var blockingMissingSteps: [MatrixStepDef] {
        stepDefs
            .prefix { $0.key != "payment" }
            .filter { !isSatisfied(localStatus(for: $0.key), for: $0) }
    }

    private func isSatisfied(_ status: MatrixCellStatus, for step: MatrixStepDef) -> Bool {
        switch status {
        case .done:
            return true
        case .skip:
            return step.canSkip
        case .undone:
            return false
        }
    }

    private func sendDelayNudge() async {
        isUpdating = "paymentDelayNudge"
        errorMessage = nil
        do {
            let result = try await SupabaseService.shared.sendPaymentDelayNudge(
                projectId: cycle.projectId,
                ym: cycle.ym,
                missingStepLabels: blockingMissingSteps.map(\.label)
            )
            if result.ok {
                let sentCount = result.sentCount ?? 0
                nudgeMessage = result.message ?? "\(sentCount)人にnudgeを送ったよ"
            } else {
                errorMessage = result.message ?? "nudge送信に失敗しました"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isUpdating = nil
    }
}

private func makeCTBEstimateStatusMap(
    rows: [BillingMatrixRow],
    projectMeta: [String: SupabaseProject]
) -> [String: MatrixCellStatus] {
    var statuses: [String: MatrixCellStatus] = [:]
    for row in rows {
        guard ((projectMeta[row.projectId]?.projectType ?? "").lowercased() == "ctb") else { continue }
        if row.ym <= "202512" {
            statuses[row.id] = .done
            continue
        }
        statuses[row.id] = row.hasCTBEstimateMarker ? .done : .undone
    }
    return statuses
}

private func makeReimbursementStatusMap(rows: [BillingMatrixRow]) async -> [String: MatrixCellStatus] {
    let grouped = Dictionary(grouping: rows, by: \.projectId)
    var statuses: [String: MatrixCellStatus] = [:]
    for (projectId, projectRows) in grouped {
        let map = (try? await SupabaseService.shared.fetchReimbursementCompletionMap(
            projectId: projectId,
            yms: projectRows.map(\.ym)
        )) ?? [:]
        for row in projectRows {
            statuses[row.id] = (map[row.ym] ?? true) ? .done : .undone
        }
    }
    return statuses
}

private struct AdminInvoiceYmPickerSheet: View {
    let projectId: String
    let bizYm: String
    let currentInvoiceYm: String

    @Environment(\.dismiss) private var dismiss
    @State private var selectedYm: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(projectId: String, bizYm: String, currentInvoiceYm: String) {
        self.projectId = projectId
        self.bizYm = bizYm
        self.currentInvoiceYm = currentInvoiceYm
        _selectedYm = State(initialValue: currentInvoiceYm)
    }

    private var options: [(ym: String, label: String)] {
        guard bizYm.count == 6,
              let y = Int(bizYm.prefix(4)),
              let m = Int(bizYm.suffix(2)) else { return [] }
        return (0...6).map { delta in
            var ny = y
            var nm = m + delta
            while nm > 12 {
                nm -= 12
                ny += 1
            }
            let ym = String(format: "%04d%02d", ny, nm)
            let label = delta == 0 ? "\(ny)年\(nm)月（通常）" : "\(ny)年\(nm)月にまとめて請求"
            return (ym, label)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("請求月を選択") {
                    ForEach(options, id: \.ym) { opt in
                        Button {
                            selectedYm = opt.ym
                        } label: {
                            HStack {
                                Text(opt.label)
                                    .foregroundStyle(.primary)
                                Spacer()
                                if selectedYm == opt.ym {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(AMD.blue)
                                        .fontWeight(.semibold)
                                }
                            }
                        }
                    }
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("\(ymDisplayAdmin(bizYm)) 請求月変更")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { Task { await save() } }
                        .disabled(isSaving)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        do {
            try await SupabaseService.shared.updateInvoiceYm(
                projectId: projectId,
                ym: bizYm,
                invoiceYm: selectedYm
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            isSaving = false
        }
    }
}
