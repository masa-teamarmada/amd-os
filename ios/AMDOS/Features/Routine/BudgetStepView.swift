import SwiftUI

/// Step 1「予算確定」ネイティブSheet
/// 3パターン表示:
///   - allocation_confirmed / budget_confirmed: ✅ 承認済み
///   - reported: ⏳ 申告済み（修正フォーム展開可）
///   - draft: 入力フォーム（請求額 + バッファ + メンバー配賦額）
struct BudgetStepView: View {
    let projectId: String
    let bizYm: String

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var authService: AuthService
    @State private var isLoading = true
    @State private var budgetData: BillingBudgetData? = nil
    @State private var members: [ProjectMember] = []
    @State private var errorMessage: String? = nil
    @State private var invoiceText = ""
    @State private var bufferText = ""
    @State private var allocationTexts: [String: String] = [:]  // memberId → 金額テキスト
    @State private var previousInvoiceAmount: Double? = nil  // 変動PJの前月請求額（プレースホルダー用）
    @State private var isSubmitting = false
    @State private var toastMessage: String? = nil
    @State private var toastIsError = false
    @State private var showEditArea = false
    @State private var showWithdrawConfirm = false
    @State private var isWithdrawing = false

    private var ymLabel: String {
        guard bizYm.count == 6 else { return bizYm }
        let y = String(bizYm.prefix(4))
        let m = Int(bizYm.suffix(2)) ?? 0
        return "\(y)年\(m)月"
    }

    /// 請求額 × 65% - バッファ = PJ予算（ライブ計算）
    private func calcPjBudget(invoice: Double, buffer: Int) -> Int {
        max(0, Int((invoice * 0.65).rounded()) - buffer)
    }

    private var invoiceAmount: Double { Double(invoiceText) ?? 0 }
    private var bufferAmount: Int { Int(bufferText) ?? 0 }
    private var pjBudget: Int { calcPjBudget(invoice: invoiceAmount, buffer: bufferAmount) }

    /// 配賦額の合計
    private var allocationTotal: Int {
        allocationTexts.values.compactMap { Int($0) }.reduce(0, +)
    }

    /// 配賦額と PJ予算の差額
    private var allocationDiff: Int { allocationTotal - pjBudget }

    /// 差額のラベル。fmtYen が「0以下なら "—"」を返してしまうので、abs で渡してから符号を付ける。
    /// 正: "+¥X"、負: "−¥X"、0: "ぴったり ✓"
    private var allocationDiffLabel: String {
        if allocationDiff == 0 { return "ぴったり ✓" }
        let absText = fmtYen(Double(abs(allocationDiff)))
        return (allocationDiff > 0 ? "+" : "−") + absText
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("読み込み中...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = errorMessage {
                    errorView(error)
                } else if let d = budgetData {
                    contentView(d)
                }
            }
            .navigationTitle("予算確定")
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
        }
        .task { await loadData() }
    }

    // MARK: - Content

    private func errorView(_ error: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle).foregroundColor(.orange)
            Text(error).multilineTextAlignment(.center)
            Button("再試行") { Task { await loadData() } }.buttonStyle(.bordered)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func contentView(_ d: BillingBudgetData) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                metaCard(d)
                statusContent(d)
                if let msg = toastMessage {
                    Text(msg)
                        .font(.caption)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(toastIsError ? Color.red.opacity(0.1) : Color.green.opacity(0.1))
                        .foregroundColor(toastIsError ? .red : .green)
                        .cornerRadius(8)
                }
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func metaCard(_ d: BillingBudgetData) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(d.projectName ?? "").fontWeight(.semibold)
                Spacer()
                Text(ymLabel).foregroundStyle(.secondary)
            }
            .font(.subheadline)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }

    @ViewBuilder
    private func statusContent(_ d: BillingBudgetData) -> some View {
        let status = d.status ?? "not_started"
        switch status {
        case "allocation_confirmed", "budget_confirmed":
            confirmedView(d)
        case "reported":
            reportedView(d)
        default:
            inputForm(d)
        }
    }

    // MARK: - 承認済み

    private func confirmedView(_ d: BillingBudgetData) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("承認済み", systemImage: "checkmark.circle.fill")
                .font(.subheadline).fontWeight(.semibold).foregroundColor(.green)
            Divider()
            infoRow("請求額", fmtYen(d.budgetReportedAmount ?? 0))
            if let buf = d.budgetBufferAmount, buf > 0 {
                infoRow("バッファ", fmtYen(Double(buf)))
            }
            infoRow("PJ予算（承認額）", fmtYen(d.budgetYen ?? 0))
            infoRow("承認日時", fmtDate(d.budgetConfirmedAt))
            // 配賦額表示
            if let allocs = d.memberAllocationsJson, !allocs.isEmpty {
                Divider()
                Text("メンバー配賦額").font(.caption).foregroundStyle(.secondary)
                ForEach(allocs.sorted(by: { $0.key < $1.key }), id: \.key) { memberId, amount in
                    infoRow(memberDisplayName(memberId), fmtYen(Double(amount)))
                }
            }
            Divider()
            withdrawButton
        }
        .padding(14)
        .background(Color.green.opacity(0.08))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.green.opacity(0.3)))
        .cornerRadius(10)
    }

    /// 申告・承認後の「取り下げる」ボタン。draft に戻して全フィールドをクリアする。
    private var withdrawButton: some View {
        Button(role: .destructive) {
            showWithdrawConfirm = true
        } label: {
            HStack {
                if isWithdrawing { ProgressView().controlSize(.small) }
                Text(isWithdrawing ? "取り下げ中..." : "取り下げる")
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, 6)
        }
        .buttonStyle(.bordered)
        .disabled(isWithdrawing)
        .confirmationDialog(
            "予算を取り下げますか？",
            isPresented: $showWithdrawConfirm,
            titleVisibility: .visible
        ) {
            Button("取り下げる", role: .destructive) {
                Task { await withdraw() }
            }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("申告・承認・配賦額がすべてクリアされ、未申告状態に戻ります。")
        }
    }

    // MARK: - 申告済み

    @ViewBuilder
    private func reportedView(_ d: BillingBudgetData) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("申告済み（admin承認待ち）", systemImage: "clock.fill")
                .font(.subheadline).fontWeight(.semibold).foregroundColor(.orange)
            Divider()
            infoRow("請求額", fmtYen(d.budgetReportedAmount ?? 0))
            if let buf = d.budgetBufferAmount, buf > 0 {
                infoRow("バッファ", fmtYen(Double(buf)))
            }
            let pj = calcPjBudget(invoice: d.budgetReportedAmount ?? 0, buffer: d.budgetBufferAmount ?? 0)
            infoRow("PJ予算（65%−バッファ）", fmtYen(Double(pj)))
            infoRow("申告日時", fmtDate(d.budgetReportedAt))
            infoRow("申告者", d.budgetReportedBy ?? "—")
            // 配賦額表示
            if let allocs = d.memberAllocationsJson, !allocs.isEmpty {
                Divider()
                Text("メンバー配賦額").font(.caption).foregroundStyle(.secondary)
                ForEach(allocs.sorted(by: { $0.key < $1.key }), id: \.key) { memberId, amount in
                    infoRow(memberDisplayName(memberId), fmtYen(Double(amount)))
                }
            }
        }
        .padding(14)
        .background(Color.orange.opacity(0.08))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.orange.opacity(0.3)))
        .cornerRadius(10)

        if showEditArea {
            inputForm(d)
        }

        HStack {
            Button(showEditArea ? "修正をやめる" : "修正する") {
                showEditArea.toggle()
                if showEditArea { invoiceText = ""; bufferText = ""; resetAllocations() }
            }
            .font(.caption)
            .foregroundColor(.secondary)
            Spacer()
            Button("取り下げる", role: .destructive) {
                showWithdrawConfirm = true
            }
            .font(.caption)
            .disabled(isWithdrawing)
        }
        .confirmationDialog(
            "予算を取り下げますか？",
            isPresented: $showWithdrawConfirm,
            titleVisibility: .visible
        ) {
            Button("取り下げる", role: .destructive) {
                Task { await withdraw() }
            }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("申告・配賦額がクリアされ、未申告状態に戻ります。")
        }
    }

    // MARK: - 入力フォーム

    @ViewBuilder
    private func inputForm(_ d: BillingBudgetData) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // 請求額入力
            invoiceSection(d)

            // 配賦額入力（メンバーがいる場合のみ）
            if !members.isEmpty {
                allocationSection()
            }

            // 申告ボタン
            HStack {
                Spacer()
                Button {
                    guard invoiceAmount > 0 else {
                        toastMessage = "請求額を入力してください"
                        toastIsError = true
                        return
                    }
                    Task { await submit() }
                } label: {
                    Text("申告する").padding(.horizontal, 8)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSubmitting || invoiceText.isEmpty)
            }
        }
    }

    @ViewBuilder
    private func invoiceSection(_ d: BillingBudgetData) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("今月の請求額と配賦額を申告").font(.subheadline).fontWeight(.semibold)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("請求額（税抜）").font(.caption).foregroundStyle(.secondary)
                    if isMonthlyFixed(d), let fixed = d.feeAmount, fixed > 0 {
                        Text("月額固定: \(fmtYen(fixed))")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    } else if let prev = previousInvoiceAmount, prev > 0 {
                        Text("前月: \(fmtYen(prev))")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
                HStack {
                    TextField(invoicePlaceholder(d), text: $invoiceText)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                    Text("円").foregroundStyle(.secondary)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("バッファ（任意）").font(.caption).foregroundStyle(.secondary)
                HStack {
                    TextField("0", text: $bufferText)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                    Text("円").foregroundStyle(.secondary)
                }
                Text("バッファ分だけPJ予算が減ります").font(.caption2).foregroundStyle(.tertiary)
            }

            if invoiceAmount > 0 {
                pjBudgetPreview()
            }
        }
    }

    @ViewBuilder
    private func pjBudgetPreview() -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("PJ予算").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Text("= \(fmtYen(invoiceAmount)) × 65%\(bufferAmount > 0 ? " − \(fmtYen(Double(bufferAmount)))" : "")")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            Text(fmtYen(Double(pjBudget)))
                .font(.title3).fontWeight(.bold).foregroundColor(.accentColor)
        }
        .padding(10)
        .background(Color.accentColor.opacity(0.06))
        .cornerRadius(8)
    }

    @ViewBuilder
    private func allocationSection() -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("メンバー配賦額").font(.subheadline).fontWeight(.semibold)
                Spacer()
                Text("メンバー間で合意した金額を入力").font(.caption2).foregroundStyle(.tertiary)
            }

            ForEach(members) { member in
                HStack(spacing: 8) {
                    Text(member.displayName)
                        .font(.subheadline)
                        .frame(width: 60, alignment: .leading)
                    TextField("0", text: Binding(
                        get: { allocationTexts[member.memberId] ?? "" },
                        set: { allocationTexts[member.memberId] = $0 }
                    ))
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                    Text("円").foregroundStyle(.secondary)
                }
            }

            // 配賦合計 vs PJ予算の差額チェック（入力がある場合のみ）
            if allocationTotal > 0 && invoiceAmount > 0 {
                allocationSummary()
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }

    @ViewBuilder
    private func allocationSummary() -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("配賦合計").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Text(fmtYen(Double(allocationTotal))).font(.caption).fontWeight(.medium)
            }
            HStack {
                Text("PJ予算との差").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Text(allocationDiffLabel)
                    .font(.caption).fontWeight(.medium)
                    .foregroundColor(allocationDiff == 0 ? .green : .orange)
            }
        }
        .padding(8)
        .background(allocationDiff == 0 ? Color.green.opacity(0.06) : Color.orange.opacity(0.06))
        .cornerRadius(6)
    }

    // MARK: - Helpers

    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.caption).fontWeight(.medium)
        }
    }

    private func memberDisplayName(_ memberId: String) -> String {
        members.first(where: { $0.memberId == memberId })?.displayName ?? memberId
    }

    private func resetAllocations() {
        allocationTexts = Dictionary(uniqueKeysWithValues: members.map { ($0.memberId, "") })
    }

    private func isMonthlyFixed(_ d: BillingBudgetData) -> Bool {
        (d.feeType ?? "").lowercased() == "monthly_fixed"
    }

    /// プレースホルダーロジック:
    /// - 月額固定PJ: PJ Config の fee_amount をそのまま出す
    /// - 変動PJ: 前月の budget_reported_amount があればそれを出す
    /// - どちらも無ければ汎用ヒント
    /// 値はプレースホルダーのみで、入力欄には自動入力しない（PMが意識して入力する想定）。
    private func invoicePlaceholder(_ d: BillingBudgetData) -> String {
        if isMonthlyFixed(d), let fixed = d.feeAmount, fixed > 0 {
            return "\(Int(fixed))"
        }
        if let prev = previousInvoiceAmount, prev > 0 {
            return "\(Int(prev))"
        }
        return "例: 500000"
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil
        )
    }

    // MARK: - Data loading（Supabase直読み）

    private func loadData() async {
        isLoading = true
        errorMessage = nil
        do {
            async let budgetTask = SupabaseService.shared.fetchBillingBudget(projectId: projectId, ym: bizYm)
            async let membersTask = SupabaseService.shared.fetchProjectMembers(projectId: projectId)
            let (budget, loadedMembers) = try await (budgetTask, membersTask)
            budgetData = budget
            members = loadedMembers
            // 配賦額の初期値をセット（既存データがあれば反映）
            if let existingAllocs = budget.memberAllocationsJson {
                allocationTexts = existingAllocs.mapValues { "\($0)" }
            } else {
                resetAllocations()
            }
            // 変動PJの前月額（参考表示 + 初期値の両方に使う）
            if !isMonthlyFixed(budget) {
                previousInvoiceAmount = try? await SupabaseService.shared.fetchPreviousInvoiceAmount(
                    projectId: projectId, currentYm: bizYm
                )
            } else {
                previousInvoiceAmount = nil
            }
            // 請求額の初期値（デフォルト値）をフィールドに入れる:
            // - 既に入力済みなら触らない（PMが書き直した値を上書きしないため）
            // - draft 状態のときだけ
            //   - 月額固定 → fee_amount を入れる
            //   - 変動 → 前月の budget_reported_amount を入れる
            // - 値は編集可能。ユーザーは required な確認/修正をしてから「申告する」
            let status = budget.status ?? "not_started"
            let isDraft = !["allocation_confirmed", "budget_confirmed", "reported"].contains(status)
            if isDraft, invoiceText.isEmpty {
                if isMonthlyFixed(budget), let fixed = budget.feeAmount, fixed > 0 {
                    invoiceText = String(Int(fixed))
                } else if let prev = previousInvoiceAmount, prev > 0 {
                    invoiceText = String(Int(prev))
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func submit() async {
        isSubmitting = true
        toastMessage = nil
        let email = authService.userEmail ?? ""
        // 配賦額を Int 辞書に変換（空欄は0として扱う）
        let allocations = allocationTexts.compactMapValues { Int($0) }.filter { $0.value > 0 }

        do {
            try await SupabaseService.shared.submitBudgetReport(
                projectId: projectId,
                ym: bizYm,
                invoiceAmount: invoiceAmount,
                bufferAmount: bufferAmount,
                byEmail: email,
                allocations: allocations
            )
            toastMessage = "申告しました"
            toastIsError = false
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            dismiss()
        } catch {
            toastMessage = error.localizedDescription
            toastIsError = true
        }
        isSubmitting = false
    }

    private func withdraw() async {
        isWithdrawing = true
        toastMessage = nil
        do {
            try await SupabaseService.shared.withdrawBudget(projectId: projectId, ym: bizYm)
            toastMessage = "取り下げました"
            toastIsError = false
            try? await Task.sleep(nanoseconds: 800_000_000)
            dismiss()
        } catch {
            toastMessage = error.localizedDescription
            toastIsError = true
        }
        isWithdrawing = false
    }

    // MARK: - Formatters

    private func fmtYen(_ amount: Double) -> String {
        guard amount > 0 else { return "—" }
        let f = NumberFormatter()
        f.numberStyle = .decimal
        let str = f.string(from: NSNumber(value: Int(amount))) ?? "\(Int(amount))"
        return "¥\(str)"
    }

    private func fmtDate(_ val: String?) -> String {
        guard let s = val, !s.isEmpty else { return "—" }
        if s.count >= 10, s.contains("T") {
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = f.date(from: s) {
                var cal = Calendar(identifier: .gregorian)
                cal.timeZone = TimeZone(identifier: "Asia/Tokyo")!
                let c = cal.dateComponents([.year, .month, .day, .hour, .minute], from: date)
                return "\(c.year!)年\(c.month!)月\(c.day!)日 \(String(format: "%02d", c.hour!)):\(String(format: "%02d", c.minute!))"
            }
        }
        return s
    }
}
