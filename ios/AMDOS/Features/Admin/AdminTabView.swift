import SwiftUI
#if canImport(UIKit)
import UIKit
import PDFKit
import QuickLook
#endif

enum AdminDestination: Hashable {
    case projectConfig
    case knowledgeSession
    case billingMatrix
    case budgetApproval
    case payoutNotice
    case proposalInbox
    case tsukuyomiLearnings
    case memberList
}

struct AdminTabView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var pendingSummary: AdminPendingSummary?
    @State private var isLoadingSummary = false
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List {
                Section {
                    AdminMonthlyTasksCard(
                        summary: pendingSummary,
                        isLoading: isLoadingSummary,
                        onTap: { dest in path.append(dest) }
                    )
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }

                Section("管理") {
                    Button { path.append(AdminDestination.projectConfig) } label: {
                        adminMenuLabel("PJ Config", icon: "slider.horizontal.3")
                    }
                    Button { path.append(AdminDestination.memberList) } label: {
                        adminMenuLabel("メンバー", icon: "person.2")
                    }
                    Button { path.append(AdminDestination.knowledgeSession) } label: {
                        adminMenuLabel("ナレッジ会", icon: "person.3.sequence")
                    }
                    Button { path.append(AdminDestination.billingMatrix) } label: {
                        adminMenuLabel("Billing Matrix", icon: "tablecells")
                    }
                    Button { path.append(AdminDestination.budgetApproval) } label: {
                        adminMenuLabel("予算承認", icon: "checkmark.seal")
                    }
                    Button { path.append(AdminDestination.payoutNotice) } label: {
                        adminMenuLabel("支払通知書作成", icon: "doc.text")
                    }
                    Button { path.append(AdminDestination.proposalInbox) } label: {
                        adminMenuLabel("提案箱", icon: "tray.full")
                    }
                    Button { path.append(AdminDestination.tsukuyomiLearnings) } label: {
                        adminMenuLabel("つくよみの学び", icon: "brain")
                    }
                }
            }
            .navigationTitle("Admin")
            .navigationDestination(for: AdminDestination.self) { dest in
                switch dest {
                case .projectConfig: ProjectConfigListView()
                case .knowledgeSession: KnowledgeSessionListView()
                case .billingMatrix: BillingMatrixView()
                case .budgetApproval: BudgetApprovalView()
                case .payoutNotice: PayoutNoticeAdminListView()
                case .proposalInbox: ProposalInboxView()
                case .tsukuyomiLearnings: TsukuyomiLearningsView()
                case .memberList: MemberListView()
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
            .task { await loadSummary() }
            .refreshable { await loadSummary() }
        }
    }

    private func adminMenuLabel(_ title: String, icon: String) -> some View {
        HStack {
            Label(title, systemImage: icon)
                .foregroundStyle(.primary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }

    private func loadSummary() async {
        isLoadingSummary = pendingSummary == nil
        let result = (try? await SupabaseService.shared.fetchAdminPendingSummary())
        await MainActor.run {
            pendingSummary = result
            isLoadingSummary = false
        }
    }
}

// MARK: - 今月やることカード

private struct AdminMonthlyTasksCard: View {
    let summary: AdminPendingSummary?
    let isLoading: Bool
    let onTap: (AdminDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "bell.badge.fill")
                    .foregroundStyle(.orange)
                Text("今月やること")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
                if let summary, summary.totalCount > 0 {
                    Text("\(summary.totalCount)件")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.orange.opacity(0.18))
                        .foregroundStyle(.orange)
                        .clipShape(Capsule())
                }
            }

            if isLoading && summary == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else if let summary, summary.totalCount == 0 {
                Text("今すぐ対応が必要なタスクはありません")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else if let summary {
                VStack(spacing: 8) {
                    if summary.budgetApprovalCount > 0 {
                        Button { onTap(.budgetApproval) } label: {
                            taskRow(icon: "checkmark.seal.fill", color: .blue, label: "予算承認待ち", count: summary.budgetApprovalCount)
                        }
                        .buttonStyle(.plain)
                    }
                    if summary.payoutNoticeCount > 0 {
                        Button { onTap(.payoutNotice) } label: {
                            taskRow(icon: "doc.text.fill", color: .orange, label: "支払通知書未送付", count: summary.payoutNoticeCount)
                        }
                        .buttonStyle(.plain)
                    }
                    if summary.paymentUnconfirmedCount > 0 {
                        Button { onTap(.billingMatrix) } label: {
                            taskRow(icon: "yensign.circle.fill", color: .purple, label: "入金未確認", count: summary.paymentUnconfirmedCount)
                        }
                        .buttonStyle(.plain)
                    }
                    if summary.rewardUnpaidCount > 0 {
                        Button { onTap(.billingMatrix) } label: {
                            taskRow(icon: "person.crop.circle.badge.checkmark", color: .green, label: "報酬未支払い", count: summary.rewardUnpaidCount)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private func taskRow(icon: String, color: Color, label: String, count: Int) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(color.opacity(0.14))
                    .frame(width: 32, height: 32)
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(color)
            }
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.primary)
            Spacer(minLength: 8)
            Text("\(count)件")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(color)
            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 4)
        .contentShape(Rectangle())
    }
}

// MARK: - Project Config

private struct ProjectConfigListView: View {
    @State private var rows: [ProjectConfigRow] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading && rows.isEmpty {
                ProgressView("読み込み中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(.orange)
                    Text(errorMessage)
                        .multilineTextAlignment(.center)
                    Button("再試行") { Task { await loadData() } }
                        .buttonStyle(.bordered)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(rows) { row in
                    NavigationLink {
                        ProjectConfigDetailView(initialRow: row)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(row.projectName)
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.primary)
                                Spacer()
                                Text(projectTypeLabel(row.projectType))
                                    .font(.caption2)
                                    .fontWeight(.semibold)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(projectTypeColor(row.projectType).opacity(0.14))
                                    .foregroundStyle(projectTypeColor(row.projectType))
                                    .clipShape(Capsule())
                            }
                            Text("\(row.projectId) / \(row.status)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if let endYm = row.endYm, !endYm.isEmpty {
                                Text("終了月: \(endYm)")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("PJ Config")
        .task { await loadData() }
        .refreshable { await loadData() }
    }

    private func loadData() async {
        isLoading = true
        do {
            rows = try await SupabaseService.shared.fetchProjectConfigs()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

private struct ProjectConfigDetailView: View {
    let initialRow: ProjectConfigRow

    @Environment(\.dismiss) private var dismiss
    @State private var status: String
    @State private var projectType: String
    @State private var startYm: String
    @State private var endYm: String
    @State private var reportEmails: String
    @State private var feeType: String
    @State private var feeAmount: String
    @State private var invoiceSendDeadlineRule: String
    @State private var paymentDueRule: String
    @State private var invoiceSendManual: Bool
    @State private var invoiceToEmails: String
    @State private var invoiceCcEmails: String
    @State private var invoiceBccEmails: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(initialRow: ProjectConfigRow) {
        self.initialRow = initialRow
        _status = State(initialValue: initialRow.status)
        _projectType = State(initialValue: initialRow.projectType ?? "standard")
        _startYm = State(initialValue: initialRow.startYm ?? "")
        _endYm = State(initialValue: initialRow.endYm ?? "")
        _reportEmails = State(initialValue: initialRow.reportEmails ?? "")
        _feeType = State(initialValue: initialRow.feeType ?? "monthly_fixed")
        _feeAmount = State(initialValue: initialRow.feeAmount.map { String(Int($0)) } ?? "")
        _invoiceSendDeadlineRule = State(initialValue: initialRow.invoiceSendDeadlineRule ?? "10")
        _paymentDueRule = State(initialValue: initialRow.paymentDueRule ?? "next_month_eom")
        _invoiceSendManual = State(initialValue: initialRow.invoiceSendManual ?? false)
        _invoiceToEmails = State(initialValue: initialRow.invoiceToEmails ?? "")
        _invoiceCcEmails = State(initialValue: initialRow.invoiceCcEmails ?? "")
        _invoiceBccEmails = State(initialValue: initialRow.invoiceBccEmails ?? "")
    }

    var body: some View {
        Form {
            Section("基本情報") {
                LabeledContent("PJ") { Text(initialRow.projectName) }
                LabeledContent("PJ ID") { Text(initialRow.projectId) }
                Picker("ステータス", selection: $status) {
                    Text("active").tag("active")
                    Text("frozen").tag("frozen")
                    Text("ended").tag("ended")
                }
                TextField("開始月 (yyyymm)", text: $startYm)
                    .keyboardType(.numberPad)
                TextField("終了月 (yyyymm)", text: $endYm)
                    .keyboardType(.numberPad)
                TextField("主要メール送付先", text: $reportEmails, axis: .vertical)
                    .lineLimit(2...4)
            }

            Section("PJタイプ") {
                Picker("タイプ", selection: $projectType) {
                    Text("標準").tag("standard")
                    Text("CTB").tag("ctb")
                }
                .pickerStyle(.segmented)

                if projectType == "ctb" {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("CTBタイプ")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        Text("毎月28日に、当月稼働分の請求書を送付し、同時に翌月の見積書も送付する運用です。")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }

            Section("契約・料金") {
                Picker("業務委託料タイプ", selection: $feeType) {
                    Text("monthly_fixed").tag("monthly_fixed")
                    Text("milestone").tag("milestone")
                    Text("variable").tag("variable")
                }
                TextField("業務委託料額 (円)", text: $feeAmount)
                    .keyboardType(.numberPad)
                TextField("請求書送付日 (毎月何日)", text: $invoiceSendDeadlineRule)
                    .keyboardType(.numberPad)
                Text("この数値は毎月の請求書送付日です。表示中の「10」は毎月10日送付ルールを意味します。CTB は通常 28 を入れます。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Picker("支払期日", selection: $paymentDueRule) {
                    Text("発行月末").tag("issue_month_eom")
                    Text("翌月末").tag("next_month_eom")
                    Text("翌月25日").tag("next_month_25")
                }
            }

            Section("請求書送付") {
                Toggle("手動送付にする", isOn: $invoiceSendManual)
                if !invoiceSendManual {
                    TextField("To", text: $invoiceToEmails, axis: .vertical)
                        .lineLimit(2...3)
                    TextField("CC", text: $invoiceCcEmails, axis: .vertical)
                        .lineLimit(2...3)
                    TextField("BCC", text: $invoiceBccEmails, axis: .vertical)
                        .lineLimit(2...3)
                } else {
                    Text("手動送付時はアプリからの送付先指定を使いません。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section {
                Button {
                    Task { await save() }
                } label: {
                    if isSaving { ProgressView() }
                    else { Label("保存", systemImage: "square.and.arrow.down") }
                }
                .disabled(isSaving)
            }
        }
        .navigationTitle("PJ Config")
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.immediately)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("完了") { amdHideKeyboard() }
            }
        }
        .dismissKeyboardOnTapOutside()
        .alert("エラー", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .onChange(of: projectType) { _, newValue in
            let currentRule = invoiceSendDeadlineRule.trimmingCharacters(in: .whitespacesAndNewlines)
            if newValue == "ctb" && (currentRule.isEmpty || currentRule == "10") {
                invoiceSendDeadlineRule = "28"
            }
        }
    }

    private func save() async {
        isSaving = true
        var body: [String: Any] = [
            "status": status,
            "project_type": projectType,
            "start_ym": startYm.nilIfBlank ?? NSNull(),
            "end_ym": endYm.nilIfBlank ?? NSNull(),
            "report_emails": reportEmails.nilIfBlank ?? NSNull(),
            "fee_type": feeType,
            "invoice_send_deadline_rule": invoiceSendDeadlineRule.nilIfBlank ?? NSNull(),
            "payment_due_rule": paymentDueRule,
            "invoice_send_manual": invoiceSendManual,
            "invoice_to_emails": invoiceToEmails.nilIfBlank ?? NSNull(),
            "invoice_cc_emails": invoiceCcEmails.nilIfBlank ?? NSNull(),
            "invoice_bcc_emails": invoiceBccEmails.nilIfBlank ?? NSNull(),
        ]
        if let amount = Double(feeAmount.trimmingCharacters(in: .whitespacesAndNewlines)), amount > 0 {
            body["fee_amount"] = amount
        } else {
            body["fee_amount"] = NSNull()
        }
        do {
            try await SupabaseService.shared.updateProjectConfig(projectId: initialRow.projectId, body: body)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}

// MARK: - Knowledge Session List

private struct KnowledgeSessionListView: View {
    @State private var rows: [KnowledgeSessionRecord] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedMonth: KnowledgeSessionRecord?
    @State private var showDecisionDialog = false
    @State private var editingTarget: KnowledgeEditTarget?

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
            } else {
                List {
                    Section("稼働月ごとの開催設定") {
                        ForEach(rows) { row in
                            Button {
                                selectedMonth = row
                                showDecisionDialog = true
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(row.timelineTitle)
                                            .font(.subheadline)
                                            .fontWeight(.semibold)
                                            .foregroundStyle(.primary)
                                        if row.offlineEnabled {
                                            Text(sessionSummary(row))
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                                .lineLimit(2)
                                        } else {
                                            Text("オンライン開催（PM日程調整あり）")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                    statusBadge(row.offlineEnabled)
                                    Image(systemName: "chevron.right")
                                        .font(.caption2)
                                        .foregroundStyle(.tertiary)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .navigationTitle("ナレッジ会")
        .task { await loadData() }
        .refreshable { await loadData() }
        .confirmationDialog(
            "この月をオフライン開催にする？",
            isPresented: $showDecisionDialog,
            presenting: selectedMonth
        ) { month in
            Button("する") {
                editingTarget = KnowledgeEditTarget(id: month.baseYm)
            }
            Button("しない", role: .destructive) {
                Task { await markOnline(month.baseYm) }
            }
            Button("キャンセル", role: .cancel) {}
        } message: { month in
            Text(month.timelineTitle)
        }
        .sheet(item: $editingTarget) { target in
            KnowledgeSessionEditSheet(baseYm: target.id) {
                Task { await loadData() }
            }
        }
        .alert("エラー", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func loadData() async {
        isLoading = true
        do {
            rows = try await SupabaseService.shared.fetchKnowledgeSessionsTimeline(monthsBack: 11)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func markOnline(_ baseYm: String) async {
        do {
            try await SupabaseService.shared.upsertKnowledgeSession(
                baseYm: baseYm,
                offlineEnabled: false,
                eventDate: nil,
                venueName: nil,
                venueAddress: nil,
                venueLink: nil,
                participantMemberIds: [],
                messageToPm: nil
            )
            await loadData()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func sessionSummary(_ row: KnowledgeSessionRecord) -> String {
        let date = (row.eventDate?.isEmpty == false) ? (row.eventDate ?? "") : "日程未設定"
        let place = (row.venueName?.isEmpty == false) ? (row.venueName ?? "") : "場所未設定"
        return "\(date) / \(place)"
    }

    @ViewBuilder
    private func statusBadge(_ isOffline: Bool) -> some View {
        Text(isOffline ? "オフライン" : "オンライン")
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(isOffline ? Color.orange.opacity(0.15) : Color.gray.opacity(0.15))
            .foregroundStyle(isOffline ? Color.orange : Color.secondary)
            .clipShape(Capsule())
    }
}

private struct KnowledgeEditTarget: Identifiable {
    let id: String
}

// MARK: - Edit Sheet

private struct KnowledgeSessionEditSheet: View {
    let baseYm: String
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var authService: AuthService

    @State private var members: [KnowledgeMember] = []
    @State private var venueHistory: [KnowledgeVenueHistory] = []
    @State private var selectedMemberIds: Set<String> = []
    @State private var eventDate = Date()
    @State private var hasEventDate = false
    @State private var useExistingVenue = true
    @State private var selectedVenueIndex = 0
    @State private var venueName = ""
    @State private var venueAddress = ""
    @State private var venueLink = ""
    @State private var messageToPm = ""
    @State private var draftText = ""
    @State private var revisionPrompt = ""
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var isDrafting = false
    @State private var isPosting = false
    @State private var errorMessage: String?
    @State private var showAnnounceSheet = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("読み込み中...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    Form {
                        Section("対象") {
                            Text(knowledgeSessionTimelineTitle(baseYm))
                                .font(.subheadline)
                                .fontWeight(.semibold)
                        }

                        Section("開催設定") {
                            DatePicker(
                                "開催日次",
                                selection: $eventDate,
                                displayedComponents: .date
                            )
                            .onChange(of: eventDate) { _, _ in hasEventDate = true }

                            Picker("開催場所", selection: $useExistingVenue) {
                                Text("過去から選ぶ").tag(true)
                                Text("新規入力").tag(false)
                            }
                            .pickerStyle(.segmented)

                            if useExistingVenue {
                                if venueHistory.isEmpty {
                                    Text("過去の開催場所はまだありません。新規入力を使ってください。")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                } else {
                                    Picker("候補", selection: $selectedVenueIndex) {
                                        ForEach(Array(venueHistory.enumerated()), id: \.offset) { idx, venue in
                                            Text(venue.venueName ?? "名称なし").tag(idx)
                                        }
                                    }
                                    .onChange(of: selectedVenueIndex) { _, idx in
                                        applyVenueFromHistory(index: idx)
                                    }
                                }
                            }

                            TextField("開催場所（名前）", text: $venueName)
                            TextField("住所", text: $venueAddress)
                            TextField("関連リンク", text: $venueLink)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                        }

                        Section("参加者") {
                            if members.isEmpty {
                                Text("activeメンバーを取得できませんでした")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            } else {
                                ForEach(members) { member in
                                    Button {
                                        toggleMember(member.memberId)
                                    } label: {
                                        HStack {
                                            Image(systemName: selectedMemberIds.contains(member.memberId) ? "checkmark.square.fill" : "square")
                                                .foregroundStyle(selectedMemberIds.contains(member.memberId) ? Color.accentColor : Color.secondary)
                                            Text(member.displayName)
                                            Spacer()
                                        }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        Section("伝えたいこと") {
                            TextEditor(text: $messageToPm)
                                .frame(minHeight: 100)
                        }

                        Section {
                            Button {
                                Task { await saveSession() }
                            } label: {
                                if isSaving {
                                    ProgressView()
                                } else {
                                    Label("保存", systemImage: "tray.and.arrow.down")
                                }
                            }
                            .disabled(isSaving)

                            Button {
                                Task { await generateDraft(initial: true) }
                            } label: {
                                if isDrafting {
                                    ProgressView()
                                } else {
                                    Label("PMにSlackで連絡", systemImage: "paperplane.fill")
                                }
                            }
                            .disabled(!canNotify || isDrafting || isSaving)
                        } footer: {
                            Text("送信前に、つくよみ草案を確認してからテスト投稿 / 本番投稿できます。")
                        }
                    }
                }
            }
            .navigationTitle("ナレッジ会設定")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
        }
        .task { await load() }
        .sheet(isPresented: $showAnnounceSheet) {
            KnowledgeAnnouncementSheet(
                draftText: $draftText,
                revisionPrompt: $revisionPrompt,
                isDrafting: $isDrafting,
                isPosting: $isPosting,
                onRevise: {
                    Task { await generateDraft(initial: false) }
                },
                onPostTest: {
                    Task { await postAnnouncement(isTest: true) }
                },
                onPostProd: {
                    Task { await postAnnouncement(isTest: false) }
                }
            )
        }
        .alert("エラー", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var canNotify: Bool {
        hasEventDate &&
        !venueName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !selectedMemberIds.isEmpty
    }

    private func load() async {
        isLoading = true
        do {
            async let membersTask = SupabaseService.shared.fetchActiveMembersForKnowledge()
            async let venueTask = SupabaseService.shared.fetchKnowledgeVenueHistory()
            async let currentTask = SupabaseService.shared.fetchKnowledgeSession(baseYm: baseYm)
            let (loadedMembers, loadedVenues, current) = try await (membersTask, venueTask, currentTask)

            members = loadedMembers
            venueHistory = loadedVenues
            if !venueHistory.isEmpty {
                applyVenueFromHistory(index: 0)
            }

            if let current {
                hasEventDate = current.eventDate?.isEmpty == false
                if let eventDateStr = current.eventDate, let parsed = parseDate(eventDateStr) {
                    eventDate = parsed
                }
                venueName = current.venueName ?? venueName
                venueAddress = current.venueAddress ?? ""
                venueLink = current.venueLink ?? ""
                messageToPm = current.messageToPm ?? ""
                draftText = current.announcementDraft ?? ""
                selectedMemberIds = Set(current.participantMemberIds ?? [])
                useExistingVenue = venueHistory.contains(where: { $0.venueName == current.venueName && !(current.venueName ?? "").isEmpty })
            } else {
                let prev = try? await SupabaseService.shared.fetchKnowledgeSession(baseYm: prevYmAdmin(baseYm))
                selectedMemberIds = Set(prev?.participantMemberIds ?? [])
                if selectedMemberIds.isEmpty {
                    selectedMemberIds = Set(members.map(\.memberId))
                }
                hasEventDate = true
            }

            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func saveSession() async {
        isSaving = true
        do {
            try await SupabaseService.shared.upsertKnowledgeSession(
                baseYm: baseYm,
                offlineEnabled: true,
                eventDate: hasEventDate ? formatDate(eventDate) : nil,
                venueName: venueName,
                venueAddress: venueAddress,
                venueLink: venueLink,
                participantMemberIds: Array(selectedMemberIds).sorted(),
                messageToPm: messageToPm
            )
            onSaved()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }

    private func generateDraft(initial: Bool) async {
        if initial {
            await saveSession()
            if errorMessage != nil { return }
        }
        isDrafting = true
        do {
            let names = members
                .filter { selectedMemberIds.contains($0.memberId) }
                .map(\.displayName)
            let result = try await SupabaseService.shared.draftKnowledgeAnnouncement(
                baseYm: baseYm,
                eventDate: hasEventDate ? formatDate(eventDate) : nil,
                venueName: venueName,
                venueAddress: venueAddress,
                venueLink: venueLink,
                participantNames: names,
                messageToPm: messageToPm,
                revisionPrompt: initial ? nil : revisionPrompt,
                previousDraft: initial ? nil : draftText
            )
            if result.ok, let draft = result.draft, !draft.isEmpty {
                draftText = draft
                showAnnounceSheet = true
                errorMessage = nil
            } else {
                errorMessage = result.message ?? "草案生成に失敗しました"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isDrafting = false
    }

    private func postAnnouncement(isTest: Bool) async {
        guard !draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "投稿文が空です"
            return
        }
        let channel = isTest ? "C04QB6F7YPN" : "C08S3292L8G"
        isPosting = true
        do {
            let result = try await SupabaseService.shared.postKnowledgeAnnouncement(
                baseYm: baseYm,
                text: draftText,
                channelId: channel,
                postedByEmail: authService.userEmail ?? "unknown",
                isTest: isTest
            )
            if result.ok {
                await saveSession()
                if !isTest {
                    dismiss()
                }
                errorMessage = nil
            } else {
                errorMessage = result.message ?? "投稿に失敗しました"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isPosting = false
    }

    private func toggleMember(_ memberId: String) {
        if selectedMemberIds.contains(memberId) {
            selectedMemberIds.remove(memberId)
        } else {
            selectedMemberIds.insert(memberId)
        }
    }

    private func applyVenueFromHistory(index: Int) {
        guard venueHistory.indices.contains(index) else { return }
        selectedVenueIndex = index
        let venue = venueHistory[index]
        venueName = venue.venueName ?? ""
        venueAddress = venue.venueAddress ?? ""
        venueLink = venue.venueLink ?? ""
    }

    private func parseDate(_ value: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "ja_JP")
        f.timeZone = TimeZone(identifier: "Asia/Tokyo")
        return f.date(from: value)
    }

    private func formatDate(_ value: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "ja_JP")
        f.timeZone = TimeZone(identifier: "Asia/Tokyo")
        return f.string(from: value)
    }
}

// MARK: - Announcement Sheet

private struct KnowledgeAnnouncementSheet: View {
    @Binding var draftText: String
    @Binding var revisionPrompt: String
    @Binding var isDrafting: Bool
    @Binding var isPosting: Bool
    let onRevise: () -> Void
    let onPostTest: () -> Void
    let onPostProd: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("つくよみ草案") {
                    TextEditor(text: $draftText)
                        .frame(minHeight: 220)
                }

                Section("修正指示（任意）") {
                    TextField("どう直してほしいかを入力", text: $revisionPrompt, axis: .vertical)
                        .lineLimit(2...5)
                    Button {
                        onRevise()
                    } label: {
                        if isDrafting { ProgressView() }
                        else { Label("この指示で再生成", systemImage: "wand.and.stars") }
                    }
                    .disabled(isDrafting || isPosting)
                }

                Section("投稿") {
                    Button {
                        onPostTest()
                    } label: {
                        if isPosting { ProgressView() }
                        else { Label("テスト投稿（C04QB6F7YPN）", systemImage: "paperplane") }
                    }
                    .disabled(isPosting || isDrafting)

                    Button {
                        onPostProd()
                    } label: {
                        if isPosting { ProgressView() }
                        else { Label("本番投稿（all-pm）", systemImage: "paperplane.fill") }
                    }
                    .disabled(isPosting || isDrafting)
                }
            }
            .navigationTitle("Slack投稿確認")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
        }
    }
}

/// 支払通知書作成 — メンバー単位の一覧。ymを切り替え、メンバーごとの集約をリスト表示する。
/// 各行 → タップで PayoutNoticePerMemberView へ。
private struct PayoutNoticeAdminListView: View {
    @State private var selectedYm: String = defaultPayoutYm()
    @State private var availableYms: [String] = []
    @State private var rows: [PayoutNoticeMemberRow] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    @State private var isCombiningPdf = false
    @State private var combinedPreviewURL: URL?
    @State private var combineProgress: String?

    var body: some View {
        Group {
            if isLoading && rows.isEmpty {
                ProgressView("読み込み中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(.orange)
                    Text(errorMessage)
                        .multilineTextAlignment(.center)
                    Button("再試行") { Task { await loadData() } }
                        .buttonStyle(.bordered)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        Picker("対象月", selection: $selectedYm) {
                            ForEach(availableYms, id: \.self) { ym in
                                Text(ymDisplayAdmin(ym)).tag(ym)
                            }
                        }
                        .pickerStyle(.menu)
                        summaryHeader
                    }

                    if rows.isEmpty {
                        Section {
                            ContentUnavailableView(
                                "対象メンバーがいません",
                                systemImage: "person.crop.circle.badge.questionmark",
                                description: Text("active メンバーで参加PJ（project_members.is_active=true）を持つ人を表示します")
                            )
                        }
                    } else {
                        Section {
                            Button {
                                Task { await runCombinedPreview() }
                            } label: {
                                HStack {
                                    if isCombiningPdf {
                                        ProgressView()
                                        Text(combineProgress ?? "PDF生成中…")
                                    } else {
                                        Label("全員分まとめてPDFプレビュー", systemImage: "doc.on.doc")
                                            .fontWeight(.semibold)
                                    }
                                    Spacer()
                                }
                            }
                            .disabled(isCombiningPdf)
                        }

                        Section("メンバー") {
                            ForEach(rows) { row in
                                NavigationLink {
                                    PayoutNoticePerMemberView(
                                        memberId: row.memberId,
                                        codeName: row.codeName,
                                        ym: selectedYm,
                                        onChange: { Task { await loadData() } }
                                    )
                                } label: {
                                    memberRowLabel(row)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("支払通知書作成")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadData() }
        .refreshable { await loadData() }
        .onChange(of: selectedYm) { _, _ in
            Task { await loadData() }
        }
        #if canImport(UIKit)
        .quickLookPreview($combinedPreviewURL)
        #endif
    }

    /// 全 active メンバー × 全参加PJ の支払通知書を1つのPDFにまとめる。
    /// 各メンバーの preview を並列で取得 → PDFKit で merge → QuickLook で開く。
    private func runCombinedPreview() async {
        let target = rows.filter { $0.totalYen > 0 }
        guard !target.isEmpty else {
            errorMessage = "配賦額が入っているメンバーがいません"
            return
        }
        isCombiningPdf = true
        combineProgress = "0 / \(target.count)"
        defer {
            isCombiningPdf = false
            combineProgress = nil
        }

        // 並列取得 (順序保持のため index 付き)
        let ym = selectedYm
        let pageDataList: [(Int, Data)] = await withTaskGroup(of: (Int, Data?).self) { group in
            for (idx, row) in target.enumerated() {
                let memberId = row.memberId
                group.addTask {
                    do {
                        let result = try await SupabaseService.shared.payoutNoticeGenerate(
                            memberId: memberId, ym: ym, mode: "preview"
                        )
                        if let b64 = result.pdfBase64,
                           let data = Data(base64Encoded: b64) {
                            return (idx, data)
                        }
                    } catch {}
                    return (idx, nil)
                }
            }
            var collected: [(Int, Data)] = []
            for await (idx, data) in group {
                if let data { collected.append((idx, data)) }
                await MainActor.run {
                    self.combineProgress = "\(collected.count) / \(target.count)"
                }
            }
            return collected.sorted { $0.0 < $1.0 }
        }

        guard !pageDataList.isEmpty else {
            errorMessage = "PDF を 1件も取得できませんでした"
            return
        }

        #if canImport(UIKit)
        await mergeAndOpen(pageDataList.map(\.1), ym: ym)
        #endif
    }

    #if canImport(UIKit)
    private func mergeAndOpen(_ dataList: [Data], ym: String) async {
        let merged = PDFDocument()
        for data in dataList {
            guard let doc = PDFDocument(data: data) else { continue }
            for i in 0..<doc.pageCount {
                if let page = doc.page(at: i) {
                    merged.insert(page, at: merged.pageCount)
                }
            }
        }
        guard merged.pageCount > 0, let outData = merged.dataRepresentation() else {
            errorMessage = "PDFのマージに失敗しました"
            return
        }
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent("payout_combined_\(ym)_\(UUID().uuidString.prefix(6)).pdf")
        do {
            try outData.write(to: tmp)
            combinedPreviewURL = tmp
        } catch {
            errorMessage = "PDFの保存に失敗: \(error.localizedDescription)"
        }
    }
    #endif

    private var summaryHeader: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("対象メンバー")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(rows.count) 名")
                    .font(.title3)
                    .fontWeight(.semibold)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("送付済み")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(rows.filter(\.isSent).count) / \(rows.count)")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .fontDesign(.monospaced)
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func memberRowLabel(_ row: PayoutNoticeMemberRow) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(row.codeName)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
                Text(formatYenAdmin(Double(row.totalYen)))
                    .font(.subheadline)
                    .fontDesign(.monospaced)
                    .fontWeight(.semibold)
            }
            HStack(spacing: 6) {
                if row.isSent {
                    Label("送付済み", systemImage: "checkmark.seal.fill")
                        .font(.caption2)
                        .foregroundStyle(.green)
                } else {
                    Label("未送付", systemImage: "circle.dashed")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
                if row.hasUnsetPJ {
                    Label("未設定PJあり", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
                Text(row.breakdown.map(\.projectName).joined(separator: " / "))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 2)
    }

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }
        do {
            if availableYms.isEmpty {
                availableYms = recentYms(monthsBack: 6)
                if !availableYms.contains(selectedYm), let first = availableYms.first {
                    selectedYm = first
                }
            }
            rows = try await SupabaseService.shared.fetchPayoutNoticeMembers(ym: selectedYm)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static func defaultPayoutYm() -> String {
        let cal = Calendar(identifier: .gregorian)
        let tz = TimeZone(identifier: "Asia/Tokyo") ?? .current
        var c = cal.dateComponents(in: tz, from: Date())
        let m = (c.month ?? 1) - 1
        if m < 1 {
            c.year = (c.year ?? 0) - 1
            c.month = 12
        } else {
            c.month = m
        }
        return String(format: "%04d%02d", c.year ?? 0, c.month ?? 1)
    }

    private func recentYms(monthsBack: Int) -> [String] {
        let cal = Calendar(identifier: .gregorian)
        let tz = TimeZone(identifier: "Asia/Tokyo") ?? .current
        let now = cal.dateComponents(in: tz, from: Date())
        guard let curY = now.year, let curM = now.month else { return [] }
        var list: [String] = []
        for delta in 0...monthsBack {
            let total = curY * 12 + (curM - 1) - delta
            let y = total / 12
            let m = total % 12 + 1
            list.append(String(format: "%04d%02d", y, m))
        }
        return list
    }
}

private func projectTypeLabel(_ value: String?) -> String {
    switch (value ?? "standard").lowercased() {
    case "ctb": return "CTB"
    default: return "標準"
    }
}

private func projectTypeColor(_ value: String?) -> Color {
    switch (value ?? "standard").lowercased() {
    case "ctb": return .orange
    default: return .blue
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
