import SwiftUI

// MARK: - Local edit model

private struct EditableLine: Identifiable {
    var id = UUID()
    var lineType: FreeeLineType
    var description: String
    var quantity: String   // TextField用String
    var unitPrice: String  // TextField用String

    enum FreeeLineType: String { case item, text }

    init(type: FreeeLineType = .item, desc: String = "", qty: Double = 1, price: Double = 0) {
        lineType = type
        description = desc
        quantity = qty == 1 ? "1" : "\(Int(qty))"
        unitPrice = price > 0 ? "\(Int(price))" : ""
    }

    var quantityDouble: Double { Double(quantity) ?? 1 }
    var unitPriceDouble: Double { Double(unitPrice) ?? 0 }
    var subtotal: Double { lineType == .item ? quantityDouble * unitPriceDouble : 0 }
}

// MARK: - Step 4「請求書発行」ネイティブSheet

/// 請求明細の編集（品目行・テキスト行）＋日付設定＋freee発行
struct InvoiceStepView: View {
    let step: RoutineStep
    let projectId: String
    let bizYm: String
    let documentType: BillingDocumentType

    @Environment(\.dismiss) private var dismiss

    @State private var isActuallyDone: Bool

    init(step: RoutineStep, projectId: String, bizYm: String, documentType: BillingDocumentType = .invoice) {
        self.step = step
        self.projectId = projectId
        self.bizYm = bizYm
        self.documentType = documentType
        self._isActuallyDone = State(initialValue: step.isDone)
    }

    @State private var isLoading = true
    @State private var errorMessage: String? = nil
    @State private var invoiceSubject: String = ""
    @State private var editableLines: [EditableLine] = []
    @State private var reimbItems: [InvoiceReimbItem] = []
    @State private var reimbYen: Double = 0
    @State private var issueDate: Date = Date()
    @State private var dueDate: Date = Date()
    @State private var fromPrevMonth: Bool = false
    @State private var isIssuing = false
    @State private var isSavingDraft = false
    @State private var isCanceling = false
    @State private var showCancelConfirm = false
    @State private var issuedFreeeNumber: String = ""
    @State private var issuedAtDisplay: String = ""
    @State private var toastMessage: String? = nil
    @State private var toastIsError = false

    private var ymLabel: String {
        guard bizYm.count == 6 else { return bizYm }
        return "\(bizYm.prefix(4))年\(Int(bizYm.suffix(2)) ?? 0)月"
    }

    private var gross: Double {
        editableLines.filter { $0.lineType == .item }.reduce(0) { $0 + $1.subtotal }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Form {
                    headerSection
                    if isActuallyDone { issuedInfoSection }
                    subjectSection
                    linesEditSection
                    if !reimbItems.isEmpty { reimbSection }
                    totalSection
                    datesSection
                    if let msg = toastMessage {
                        Section {
                            Text(msg)
                                .foregroundColor(toastIsError ? .red : .green)
                                .font(.caption)
                        }
                    }
                    Section {
                        Button {
                            Task { await saveDraft() }
                        } label: {
                            HStack {
                                Spacer()
                                Label(
                                    isSavingDraft ? "保存中..." : "下書き保存",
                                    systemImage: "square.and.arrow.down"
                                )
                                .font(.subheadline)
                                Spacer()
                            }
                        }
                        .disabled(isSavingDraft || isIssuing)
                        .foregroundStyle(.secondary)
                    }
                    if !isActuallyDone {
                        Section {
                            Button {
                                Task { await issueInvoice() }
                            } label: {
                                HStack {
                                    Spacer()
                                    Label(
                                        isIssuing ? "発行中..." : documentType.issueButtonLabel,
                                        systemImage: "doc.text.fill"
                                    )
                                    .fontWeight(.semibold)
                                    Spacer()
                                }
                            }
                            .disabled(isIssuing || gross <= 0)
                        }
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                if isLoading {
                    Color(.systemBackground).opacity(0.85).ignoresSafeArea()
                    ProgressView("読み込み中...")
                }
                if let err = errorMessage {
                    Color(.systemBackground).opacity(0.95).ignoresSafeArea()
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle").font(.largeTitle).foregroundColor(.orange)
                        Text(err).multilineTextAlignment(.center).padding(.horizontal)
                        Button("再試行") { Task { await loadPreview() } }.buttonStyle(.bordered)
                    }
                }
            }
            .navigationTitle(documentType.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("完了") { hideKeyboard() }
                }
            }
            .confirmationDialog(
                "\(documentType.title)を取り消しますか？",
                isPresented: $showCancelConfirm,
                titleVisibility: .visible
            ) {
                Button("取り消す", role: .destructive) {
                    Task { await cancelInvoice() }
                }
                Button("キャンセル", role: .cancel) {}
            } message: {
                Text("admins（まさ・きよ）にSlackで通知が送られます。取り消し後、再発行可能になります。")
            }
        }
        .task { await loadPreview() }
    }

    // MARK: - Sections

    private var headerSection: some View {
        Section {
            HStack {
                Text(ymLabel).fontWeight(.semibold)
                Spacer()
                if isActuallyDone {
                    Label("発行済み", systemImage: "checkmark.circle.fill")
                        .font(.caption).foregroundColor(.green)
                }
            }
        }
    }

    private var issuedInfoSection: some View {
        Section {
            if !issuedFreeeNumber.isEmpty {
                HStack {
                    Text(documentType.numberLabel).foregroundStyle(.secondary)
                    Spacer()
                    Text(issuedFreeeNumber).fontDesign(.monospaced)
                }
            }
            if !issuedAtDisplay.isEmpty {
                HStack {
                    Text("発行日").foregroundStyle(.secondary)
                    Spacer()
                    Text(issuedAtDisplay).font(.subheadline)
                }
            }
            Button(role: .destructive) {
                showCancelConfirm = true
            } label: {
                HStack {
                    Spacer()
                    Label(
                        isCanceling ? "取り消し中..." : "発行を取り消す",
                        systemImage: "xmark.circle"
                    )
                    Spacer()
                }
            }
            .disabled(isCanceling)
        } header: {
            Text("発行済み情報")
        }
    }

    private var subjectSection: some View {
        Section {
            TextField("〇〇社 2026年4月分 業務委託費", text: $invoiceSubject, axis: .vertical)
                .lineLimit(1...3)
                .font(.system(size: 14))
        } header: {
            Text(documentType == .quotation ? "件名（freee見積書の件名）" : "件名（freee請求書の件名）")
        }
    }

    private var linesEditSection: some View {
        Section {
            ForEach($editableLines) { $line in
                Group {
                    if line.lineType == .item {
                        ItemLineRow(line: $line)
                    } else {
                        TextLineRow(line: $line)
                    }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) {
                        editableLines.removeAll { $0.id == line.id }
                    } label: {
                        Label("削除", systemImage: "trash")
                    }
                }
                .contextMenu {
                    Button(role: .destructive) {
                        editableLines.removeAll { $0.id == line.id }
                    } label: {
                        Label("削除", systemImage: "trash")
                    }
                }
            }
            .onMove { editableLines.move(fromOffsets: $0, toOffset: $1) }

            Button {
                editableLines.append(EditableLine(type: .item))
            } label: {
                Label("品目行を追加", systemImage: "plus.circle")
                    .font(.subheadline)
            }

            Button {
                editableLines.append(EditableLine(type: .text))
            } label: {
                Label("テキスト行を追加", systemImage: "text.badge.plus")
                    .font(.subheadline)
            }
        } header: {
            HStack {
                Text(documentType == .quotation ? "見積明細" : "請求明細")
                if fromPrevMonth {
                    Spacer()
                    Label("前月から引き継ぎ", systemImage: "arrow.counterclockwise")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        } footer: {
            Text("ドラッグで並び替え。左スワイプまたは長押しで削除。テキスト行は金額なしのメモ行です。")
                .font(.caption2)
        }
        .environment(\.editMode, .constant(.active))
    }

    private var reimbSection: some View {
        Section {
            ForEach(Array(reimbItems.enumerated()), id: \.offset) { _, item in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        if let cat = item.category, !cat.isEmpty {
                            Text(cat).font(.caption2).foregroundStyle(.secondary)
                        }
                        Text(item.description ?? "").font(.system(size: 13))
                    }
                    Spacer()
                    Text("¥\(formatYen(item.amount ?? 0))")
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            Text("立替費（\(reimbItems.count)件・自動集計）")
        }
    }

    private var totalSection: some View {
        Section {
            HStack {
                Text("基本額（税抜）").foregroundStyle(.secondary)
                Spacer()
                Text("¥\(formatYen(gross))").fontDesign(.monospaced)
            }
            if reimbYen > 0 {
                HStack {
                    Text("立替費").foregroundStyle(.secondary)
                    Spacer()
                    Text("¥\(formatYen(reimbYen))").fontDesign(.monospaced)
                }
            }
            HStack {
                Text("消費税（10%）").foregroundStyle(.secondary)
                Spacer()
                Text("¥\(formatYen((gross + reimbYen) * 0.1))").fontDesign(.monospaced)
            }
            HStack {
                Text("合計（税込）").fontWeight(.semibold)
                Spacer()
                Text("¥\(formatYen((gross + reimbYen) * 1.1))")
                    .fontWeight(.semibold)
                    .foregroundColor(Color.accentColor)
            }
        } header: {
            Text("合計")
        }
    }

    private var datesSection: some View {
        Section {
            DatePicker(documentType == .quotation ? "見積日" : "請求日", selection: $issueDate, displayedComponents: .date)
                .environment(\.locale, Locale(identifier: "ja_JP"))
            DatePicker(documentType == .quotation ? "有効期限" : "支払期日", selection: $dueDate, displayedComponents: .date)
                .environment(\.locale, Locale(identifier: "ja_JP"))
        } header: {
            Text("日付")
        } footer: {
            Text(documentType == .quotation ? "有効期限は翌月末（休日の場合は前営業日）が自動セットされます" : "支払期日は翌月末（休日の場合は前営業日）が自動セットされます")
                .font(.caption2)
        }
    }

    // MARK: - API

    private func loadPreview() async {
        isLoading = true
        errorMessage = nil
        do {
            let body = try await SupabaseService.shared.fetchInvoicePreview(
                projectId: projectId, ym: bizYm, documentType: documentType
            )
            editableLines = (body.baseLines ?? []).compactMap { line in
                guard !line.description.isEmpty else { return nil }
                let lineType: EditableLine.FreeeLineType = line.type == "text" ? .text : .item
                return EditableLine(type: lineType, desc: line.description, qty: line.quantity, price: line.unit_price)
            }
            if editableLines.isEmpty {
                editableLines = [EditableLine(type: .item)]
            }
            invoiceSubject = body.invoiceSubject ?? ""
            fromPrevMonth = body.fromPrevMonth ?? false
            reimbItems = body.reimbItems ?? []
            reimbYen = body.reimbYen ?? 0
            issueDate = Date()
            dueDate = computeDefaultDueDate()
            issuedFreeeNumber = body.freeeInvoiceNumber ?? ""
            issuedAtDisplay = formatIssuedAt(body.issuedAt ?? "")
            isActuallyDone = !(body.issuedAt ?? "").isEmpty
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func saveDraft() async {
        isSavingDraft = true
        toastMessage = nil

        guard let allLinesJson = buildAllLinesJson() else {
            toastMessage = "明細データの変換に失敗しました"
            toastIsError = true
            isSavingDraft = false
            return
        }

        do {
            try await SupabaseService.shared.saveInvoiceDraft(
                projectId: projectId,
                ym: bizYm,
                invoiceSubject: invoiceSubject.isEmpty ? nil : invoiceSubject,
                allLinesJson: allLinesJson,
                documentType: documentType
            )
            toastMessage = "下書きを保存したよ"
            toastIsError = false
        } catch {
            toastMessage = error.localizedDescription
            toastIsError = true
        }
        isSavingDraft = false
    }

    private func issueInvoice() async {
        isIssuing = true
        toastMessage = nil

        guard let allLinesJson = buildAllLinesJson() else {
            toastMessage = "明細データの変換に失敗しました"
            toastIsError = true
            isIssuing = false
            return
        }

        do {
            var body: [String: Any] = [
                "projectId": projectId,
                "ym": bizYm,
                "issueDate": formatDateForGAS(issueDate),
                "dueDate": formatDateForGAS(dueDate),
                "allLinesJson": allLinesJson,
                "documentType": documentType.rawValue
            ]
            if !invoiceSubject.isEmpty { body["invoiceSubject"] = invoiceSubject }

            let result: IssueInvoiceResult = try await SupabaseService.shared.callEdgeFunction(
                "issue-invoice", body: body
            )
            if result.ok {
                let num = result.freeeInvoiceNumber ?? ""
                toastMessage = num.isEmpty ? "\(documentType == .quotation ? "見積書" : "請求書")を発行したよ！" : "発行完了！（\(num)）"
                toastIsError = false
                isActuallyDone = true
                try? await Task.sleep(nanoseconds: 1_600_000_000)
                dismiss()
            } else {
                toastMessage = result.message ?? "発行に失敗しました"
                toastIsError = true
            }
        } catch {
            toastMessage = error.localizedDescription
            toastIsError = true
        }
        isIssuing = false
    }

    private func cancelInvoice() async {
        isCanceling = true
        toastMessage = nil
        do {
            let result: CancelInvoiceResult = try await SupabaseService.shared.callEdgeFunction(
                "cancel-invoice",
                body: ["projectId": projectId, "ym": bizYm, "documentType": documentType.rawValue]
            )
            if result.ok {
                toastMessage = result.message ?? "\(documentType == .quotation ? "見積書" : "請求書")の発行を取り消したよ"
                toastIsError = false
                isActuallyDone = false
                issuedFreeeNumber = ""
                issuedAtDisplay = ""
                try? await Task.sleep(nanoseconds: 1_600_000_000)
                dismiss()
            } else {
                toastMessage = result.message ?? "取り消しに失敗しました"
                toastIsError = true
            }
        } catch {
            toastMessage = error.localizedDescription
            toastIsError = true
        }
        isCanceling = false
    }

    // MARK: - Helpers

    private func buildAllLinesJson() -> String? {
        var allLines: [[String: String]] = editableLines.map { line in
            if line.lineType == .text {
                return ["type": "text", "description": line.description]
            } else {
                return [
                    "type": "item",
                    "description": line.description,
                    "quantity": line.quantity.isEmpty ? "1" : line.quantity,
                    "unit_price": line.unitPrice.isEmpty ? "0" : line.unitPrice
                ]
            }
        }
        if documentType == .quotation {
            allLines.removeAll { $0["description"] == ctbEstimateDoneMarkerDescription }
            allLines.append([
                "type": "text",
                "description": ctbEstimateDoneMarkerDescription
            ])
        }
        guard let jsonData = try? JSONSerialization.data(withJSONObject: allLines, options: []),
              let json = String(data: jsonData, encoding: .utf8) else { return nil }
        return json
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil
        )
    }

    /// bizYm の翌月末（土日なら前営業日）を計算
    private func computeDefaultDueDate() -> Date {
        guard bizYm.count == 6,
              let y = Int(bizYm.prefix(4)),
              let m = Int(bizYm.suffix(2)) else { return Date() }
        let nextM = m >= 12 ? 1 : m + 1
        let nextY = m >= 12 ? y + 1 : y
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        guard let firstOfMonthAfter = cal.date(from: DateComponents(year: nextY, month: nextM + 1, day: 1)),
              let lastDay = cal.date(byAdding: .day, value: -1, to: firstOfMonthAfter) else { return Date() }
        return adjustForWeekend(lastDay, cal: cal)
    }

    /// 土日なら前営業日（金曜）に戻す
    private func adjustForWeekend(_ date: Date, cal: Calendar) -> Date {
        var d = date
        while cal.isDateInWeekend(d) {
            d = cal.date(byAdding: .day, value: -1, to: d) ?? d
        }
        return d
    }

    private func formatDateForGAS(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.timeZone = TimeZone(identifier: "Asia/Tokyo")
        return fmt.string(from: date)
    }

    /// ISO日付文字列を日本語表示に変換（"2026-04-10T..." → "2026年4月10日"）
    private func formatIssuedAt(_ s: String) -> String {
        guard s.count >= 10 else { return s }
        let parts = s.prefix(10).split(separator: "-")
        guard parts.count == 3,
              let m = Int(parts[1]), let d = Int(parts[2]) else { return s }
        return "\(parts[0])年\(m)月\(d)日"
    }

    private func formatYen(_ v: Double) -> String {
        let n = Int(v.rounded())
        let fmt = NumberFormatter()
        fmt.numberStyle = .decimal
        return fmt.string(from: NSNumber(value: n)) ?? "\(n)"
    }
}

// MARK: - Item Line Row

private struct ItemLineRow: View {
    @Binding var line: EditableLine

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            TextField("品目名・説明", text: $line.description, axis: .vertical)
                .lineLimit(1...4)
                .font(.system(size: 14))
            HStack(spacing: 4) {
                Text("数量")
                    .font(.caption2).foregroundStyle(.secondary)
                TextField("1", text: $line.quantity)
                    .keyboardType(.decimalPad)
                    .font(.system(size: 13, design: .monospaced))
                    .frame(width: 44)
                    .multilineTextAlignment(.trailing)
                    .padding(.horizontal, 4)
                    .background(Color(.tertiarySystemFill))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                Text("×")
                    .font(.caption2).foregroundStyle(.secondary)
                Text("¥")
                    .font(.caption2).foregroundStyle(.secondary)
                TextField("0", text: $line.unitPrice)
                    .keyboardType(.numberPad)
                    .font(.system(size: 13, design: .monospaced))
                    .multilineTextAlignment(.trailing)
                    .padding(.horizontal, 4)
                    .background(Color(.tertiarySystemFill))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                Spacer()
                if let p = Double(line.unitPrice), let q = Double(line.quantity), p > 0 {
                    Text("= ¥\(Int((p * q).rounded()))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .fontDesign(.monospaced)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Text Line Row

private struct TextLineRow: View {
    @Binding var line: EditableLine

    var body: some View {
        HStack(spacing: 8) {
            Text("T")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.white)
                .frame(width: 18, height: 18)
                .background(Color.secondary.opacity(0.7))
                .clipShape(RoundedRectangle(cornerRadius: 3))
            TextField("テキスト（メモ・区切り線など）", text: $line.description, axis: .vertical)
                .lineLimit(1...3)
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
        }
    }
}
