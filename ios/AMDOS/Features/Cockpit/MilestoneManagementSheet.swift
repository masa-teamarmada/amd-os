import SwiftUI

struct MilestoneManagementSheet: View {
    let planCycleId: String
    let milestones: [CockpitMilestone]
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var drafts: [CockpitMilestoneDraft] = []
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                summarySection

                ForEach($drafts) { $draft in
                    Section {
                        milestoneFields($draft)
                        criteriaBlock($draft)
                        subItemsBlock($draft)
                    } header: {
                        Text("\(draft.orderNo). \(draft.title.isEmpty ? "無題MS" : draft.title)")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("MS管理")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("閉じる") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("保存") { Task { await save() } }
                            .fontWeight(.semibold)
                    }
                }
            }
            .alert("保存エラー", isPresented: .constant(errorMessage != nil), actions: {
                Button("OK") { errorMessage = nil }
            }, message: {
                Text(errorMessage ?? "")
            })
        }
        .onAppear {
            if drafts.isEmpty {
                drafts = milestones.enumerated().map { index, ms in
                    CockpitMilestoneDraft(
                        id: ms.id,
                        milestoneId: ms.milestoneId,
                        orderNo: index + 1,
                        tag: ms.tag,
                        title: ms.title,
                        points: ms.points,
                        targetYm: ms.targetYm,
                        successCriteria: ms.successCriteria,
                        subItems: ms.subItems.sorted(by: { $0.orderNo < $1.orderNo }).map {
                            CockpitSubItemDraft(
                                id: $0.id,
                                subItemId: $0.subItemId,
                                title: $0.title,
                                startYm: $0.startYm,
                                targetYm: $0.targetYm,
                                isDone: $0.isDone
                            )
                        }
                    )
                }
            }
        }
    }

    private var summarySection: some View {
        Section {
            HStack {
                statChip(label: "MS数", value: "\(drafts.count)")
                Spacer()
                statChip(label: "合計pt", value: "\(totalPoints)")
            }
        } footer: {
            Text("PWAのMS管理に合わせて、タイトル・pt・達成条件・サブ項目をここで更新できます。保存時に sub item と progress も反映します。")
        }
    }

    private func milestoneFields(_ draft: Binding<CockpitMilestoneDraft>) -> some View {
        Group {
            TextField("MSタイトル", text: draft.title)
            HStack {
                Text("ポイント")
                Spacer()
                TextField("0", value: draft.points, format: .number)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
                Text("pt")
                    .foregroundStyle(AMD.textSub)
            }
            HStack {
                Text("期限")
                Spacer()
                TextField("YYYYMM", text: Binding(
                    get: { draft.wrappedValue.targetYm ?? "" },
                    set: { draft.wrappedValue.targetYm = $0 }
                ))
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 100)
            }
        }
    }

    private func criteriaBlock(_ draft: Binding<CockpitMilestoneDraft>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("達成条件")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
                Button("行を追加") {
                    var criteria = draft.wrappedValue.successCriteria
                    if !criteria.isEmpty { criteria += "\n" }
                    criteria += "[ ] "
                    draft.wrappedValue.successCriteria = criteria
                }
                .font(.caption)
            }

            let lines = criteriaLines(from: draft.wrappedValue.successCriteria)
            if lines.isEmpty {
                Text("達成条件なし")
                    .font(.caption)
                    .foregroundStyle(AMD.textSub)
            } else {
                ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                    HStack(alignment: .top, spacing: 10) {
                        Button {
                            toggleCriteria(at: index, draft: draft)
                        } label: {
                            Image(systemName: line.isDone ? "checkmark.square.fill" : "square")
                                .foregroundStyle(line.isDone ? AMD.blue : AMD.textSub)
                        }
                        .buttonStyle(.plain)

                        TextField("条件", text: Binding(
                            get: { line.text },
                            set: { updateCriteriaText(at: index, text: $0, draft: draft) }
                        ), axis: .vertical)
                        .lineLimit(1...3)

                        Button(role: .destructive) {
                            removeCriteria(at: index, draft: draft)
                        } label: {
                            Image(systemName: "trash")
                                .foregroundStyle(.orange)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func subItemsBlock(_ draft: Binding<CockpitMilestoneDraft>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("サブ項目")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
                Button("追加") {
                    draft.wrappedValue.subItems.append(
                        CockpitSubItemDraft(
                            id: UUID().uuidString,
                            subItemId: nil,
                            title: "",
                            startYm: currentYm(),
                            targetYm: draft.wrappedValue.targetYm,
                            isDone: false
                        )
                    )
                }
                .font(.caption)
            }

            if draft.wrappedValue.subItems.isEmpty {
                Text("サブ項目なし")
                    .font(.caption)
                    .foregroundStyle(AMD.textSub)
            } else {
                ForEach(Array(draft.wrappedValue.subItems.enumerated()), id: \.element.id) { index, item in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 10) {
                            Button {
                                draft.wrappedValue.subItems[index].isDone.toggle()
                            } label: {
                                Image(systemName: item.isDone ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(item.isDone ? AMD.blue : AMD.textSub)
                            }
                            .buttonStyle(.plain)

                            TextField("サブ項目", text: Binding(
                                get: { draft.wrappedValue.subItems[index].title },
                                set: { draft.wrappedValue.subItems[index].title = $0 }
                            ))

                            Button(role: .destructive) {
                                draft.wrappedValue.subItems.remove(at: index)
                            } label: {
                                Image(systemName: "minus.circle")
                                    .foregroundStyle(.orange)
                            }
                            .buttonStyle(.plain)
                        }

                        HStack {
                            TextField("開始YYYYMM", text: Binding(
                                get: { draft.wrappedValue.subItems[index].startYm ?? "" },
                                set: { draft.wrappedValue.subItems[index].startYm = $0 }
                            ))
                            .keyboardType(.numberPad)
                            TextField("期限YYYYMM", text: Binding(
                                get: { draft.wrappedValue.subItems[index].targetYm ?? "" },
                                set: { draft.wrappedValue.subItems[index].targetYm = $0 }
                            ))
                            .keyboardType(.numberPad)
                        }
                        .font(.caption)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func statChip(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(AMD.textTertiary)
            Text(value)
                .font(.headline)
                .foregroundStyle(AMD.text)
                .monospacedDigit()
        }
        .frame(minWidth: 72)
    }

    private var totalPoints: Int {
        drafts.reduce(0) { $0 + max(0, $1.points) }
    }

    private func criteriaLines(from raw: String) -> [CriteriaLine] {
        raw.components(separatedBy: .newlines)
            .map { line in
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                if trimmed.lowercased().hasPrefix("[x") {
                    return CriteriaLine(isDone: true, text: trimmed.replacingOccurrences(of: #"^\[x(?::\d{6})?\]\s*"#, with: "", options: .regularExpression))
                }
                return CriteriaLine(isDone: false, text: trimmed.replacingOccurrences(of: #"^\[\s*\]\s*"#, with: "", options: .regularExpression))
            }
            .filter { !$0.text.isEmpty || $0.isDone }
    }

    private func serializeCriteria(_ lines: [CriteriaLine]) -> String {
        lines.map { line in
            "\(line.isDone ? "[x:\(currentYm())]" : "[ ]") \(line.text.trimmingCharacters(in: .whitespaces))"
        }
        .joined(separator: "\n")
    }

    private func toggleCriteria(at index: Int, draft: Binding<CockpitMilestoneDraft>) {
        var lines = criteriaLines(from: draft.wrappedValue.successCriteria)
        guard lines.indices.contains(index) else { return }
        lines[index].isDone.toggle()
        draft.wrappedValue.successCriteria = serializeCriteria(lines)
    }

    private func updateCriteriaText(at index: Int, text: String, draft: Binding<CockpitMilestoneDraft>) {
        var lines = criteriaLines(from: draft.wrappedValue.successCriteria)
        guard lines.indices.contains(index) else { return }
        lines[index].text = text
        draft.wrappedValue.successCriteria = serializeCriteria(lines)
    }

    private func removeCriteria(at index: Int, draft: Binding<CockpitMilestoneDraft>) {
        var lines = criteriaLines(from: draft.wrappedValue.successCriteria)
        guard lines.indices.contains(index) else { return }
        lines.remove(at: index)
        draft.wrappedValue.successCriteria = serializeCriteria(lines)
    }

    private func save() async {
        isSaving = true
        errorMessage = nil
        do {
            try await SupabaseService.shared.updateCockpitMilestones(
                planCycleId: planCycleId,
                milestones: drafts,
                newTotalPoints: totalPoints
            )
            for draft in drafts {
                try await SupabaseService.shared.replaceMilestoneSubItems(
                    milestoneId: draft.milestoneId,
                    items: draft.subItems
                )
                try await SupabaseService.shared.applyCriteriaProgress(
                    milestoneId: draft.milestoneId,
                    ym: currentYm(),
                    successCriteria: draft.successCriteria
                )
            }
            onSaved()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}

private struct CriteriaLine {
    var isDone: Bool
    var text: String
}
