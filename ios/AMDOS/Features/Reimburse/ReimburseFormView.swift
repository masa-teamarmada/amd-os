import SwiftUI

struct ReimburseFormView: View {
    let editingItem: ReimburseItem?
    let email: String

    @Environment(\.dismiss) private var dismiss
    @State private var input = ReimburseFormInput()
    @State private var projects: [GASProject] = []
    @State private var isLoadingProjects = false
    @State private var isSaving = false
    @State private var errorMessage: String? = nil

    private var isEditing: Bool { editingItem != nil }
    private var title: String { isEditing ? "立替を編集" : "立替を追加" }

    var body: some View {
        NavigationStack {
            Form {
                // PJ選択
                Section("プロジェクト") {
                    if isLoadingProjects {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Picker("PJ", selection: $input.projectId) {
                            Text("（選択）").tag("")
                            ForEach(projects) { pj in
                                Text(pj.projectName).tag(pj.projectId)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                }

                // 基本情報
                Section("基本情報") {
                    DatePicker("発生日", selection: $input.date, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "ja_JP"))

                    Picker("費目", selection: $input.category) {
                        ForEach(ReimburseCategory.allCases, id: \.self) { cat in
                            Text(cat.label).tag(cat)
                        }
                    }

                    HStack {
                        Text("金額（税込）")
                        Spacer()
                        TextField("例: 1540", text: $input.amount)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                        Text("円")
                            .foregroundStyle(.secondary)
                    }

                    Picker("税率", selection: $input.taxRate) {
                        ForEach(TaxRate.allCases, id: \.self) { r in
                            Text(r.label).tag(r)
                        }
                    }
                }

                // 摘要
                Section("摘要") {
                    TextField("例: ○○社 打合せ移動", text: $input.desc, axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                }

                // 交通費詳細
                if input.category == .transport {
                    Section("交通費の詳細") {
                        Picker("交通手段", selection: $input.transportMode) {
                            ForEach(TransportMode.allCases, id: \.self) { m in
                                Text(m.label).tag(m)
                            }
                        }

                        HStack {
                            Text("出発")
                            TextField("例: つくば", text: $input.transportFrom)
                                .multilineTextAlignment(.trailing)
                        }

                        HStack {
                            Text("到着")
                            TextField("例: 秋葉原", text: $input.transportTo)
                                .multilineTextAlignment(.trailing)
                        }

                        Picker("片道 / 往復", selection: $input.transportTrip) {
                            ForEach(TransportTrip.allCases, id: \.self) { t in
                                Text(t.label).tag(t)
                            }
                        }

                        if input.transportTrip == .round, let amt = input.amountDouble, amt > 0 {
                            HStack {
                                Text("合計金額（往復）")
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text("¥\(Int(amt * 2).formatted())")
                                    .foregroundStyle(.secondary)
                            }
                            .font(.caption)
                        }
                    }
                }

                // エラー
                if let err = errorMessage {
                    Section {
                        Text(err)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("登録") { Task { await save() } }
                            .fontWeight(.semibold)
                    }
                }
                ToolbarItem(placement: .keyboard) {
                    Button("完了") { hideKeyboard() }
                }
            }
            .task { await loadProjects() }
            .onAppear { prefill() }
        }
    }

    // MARK: - Private

    private func prefill() {
        guard let item = editingItem else { return }
        input.projectId = item.projectId
        input.projectName = item.projectName
        if let d = parseDate(item.date) { input.date = d }
        input.category = ReimburseCategory(rawValue: item.category) ?? .other
        input.amount = String(Int(item.amountForEdit))
        input.taxRate = TaxRate.from(item.taxRate)
        input.desc = item.desc
        if let m = item.transportMode, !m.isEmpty {
            input.transportMode = TransportMode(rawValue: m) ?? .train
        }
        input.transportFrom = item.transportFrom ?? ""
        input.transportTo   = item.transportTo   ?? ""
        input.transportTrip = TransportTrip(rawValue: item.transportTrip ?? "oneway") ?? .oneway
    }

    private func loadProjects() async {
        isLoadingProjects = true
        do {
            let rows = try await SupabaseService.shared.fetchActiveProjects()
            projects = rows.map { $0.asGASProject }
        } catch {}
        isLoadingProjects = false
    }

    private func save() async {
        if let err = input.validationError {
            errorMessage = err
            return
        }
        errorMessage = nil
        isSaving = true

        let pjName = projects.first { $0.projectId == input.projectId }?.projectName ?? input.projectName

        do {
            if let item = editingItem {
                try await SupabaseService.shared.updateReimbursement(
                    item.reimbursementId, email: email, input: input, projectName: pjName
                )
                dismiss()
            } else {
                _ = try await SupabaseService.shared.saveReimbursement(
                    email: email, input: input, projectName: pjName
                )
                dismiss()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }

    private func parseDate(_ s: String) -> Date? {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.date(from: String(s.prefix(10)))
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}
