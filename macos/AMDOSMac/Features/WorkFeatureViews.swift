import SwiftUI
import UniformTypeIdentifiers
import AppKit

@MainActor
private final class AMDOSWorkStore: ObservableObject {
    @Published var projects: [AMDOSProject] = []
    @Published var detail: AMDOSCockpitData?
    @Published var notifications: [AMDOSNotification] = []
    @Published var reimbursements: [AMDOSReimbursement] = []
    @Published var cards: [AMDOSBusinessCard] = []
    @Published var agreement: AMDOSAgreementBundle?
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?
    private let client = AMDOSRESTClient.shared

    func loadProjects(all: Bool = true) async {
        state = .loading; message = nil
        do { projects = try await client.fetchProjects(activeOnly: !all); state = projects.isEmpty ? .empty : .loaded }
        catch { message = error.localizedDescription; state = .failed(message ?? "") }
    }
    func loadNotifications(email: String?) async {
        guard let email else { notifications = []; message = "通知を読むためのログイン情報を確認できなかったよ。"; state = .failed(message ?? ""); return }
        state = .loading; message = nil
        do { notifications = try await client.fetchNotifications(email: email); state = notifications.isEmpty ? .empty : .loaded }
        catch { notifications = []; message = error.localizedDescription; state = .failed(message ?? "") }
    }
    func loadCockpit(projectId: String) async {
        state = .loading; message = nil
        do {
            async let project = client.fetchProjectDetail(projectId: projectId)
            async let members = client.fetchTable(AMDOSProjectMember.self, table: "project_members", select: "id,project_id,member_id,role,role_label,is_active,is_pm,is_pl", filters: ["project_id": "eq.\(projectId)"])
            async let billing = client.fetchTable(AMDOSBillingCycle.self, table: "billing_cycles", select: "id,project_id,ym,budget_yen,status,meeting_start_at,report_fixed_at,invoice_sent_at,payment_confirmed_at,invoice_issued_at,reward_paid_at,freee_invoice_number", filters: ["project_id": "eq.\(projectId)"], order: "ym.desc")
            async let plans = client.fetchTable(AMDOSValuePlan.self, table: "value_plan_cycles", select: "id,plan_cycle_id,project_id,status,budget_yen,total_points,period_start_ym,period_end_ym", filters: ["project_id": "eq.\(projectId)"])
            async let milestones = client.fetchTable(AMDOSMilestone.self, table: "value_milestones", select: "id,milestone_id,plan_cycle_id,title,points,tag,goal_level,is_active,success_criteria,sort_order,target_ym", filters: [:])
            async let progress = client.fetchTable(AMDOSMilestoneProgress.self, table: "milestone_monthly_progress", select: "id,milestone_key,ym,progress_pct,consumed_pt,source,note,confirmed_at", filters: [:], order: "ym.desc")
            async let signals = client.fetchTable(AMDOSStrategySignal.self, table: "project_strategy_signals", select: "signal_id,project_id,signal_type,title,summary,status,created_at", filters: ["project_id": "eq.\(projectId)"], order: "created_at.desc")
            async let meetings = client.fetchTable(AMDOSMeetingSummary.self, table: "project_meeting_summaries", select: "meeting_id,project_id,meeting_date,title,summary_short,prep_status,created_at", filters: ["project_id": "eq.\(projectId)"], order: "meeting_date.desc")
            async let evidence = client.fetchTable(AMDOSVentureXRLLog.self, table: "project_xrl_log", select: "id,project_id,observed_at,trl,brl,hrl,grl,srl,bottleneck,milestone_label,source_note", filters: ["project_id": "eq.\(projectId)"], order: "observed_at.desc")
            async let scores = client.fetchTable(AMDOSScoreInput.self, table: "amd_score_inputs", select: "id,project_id,evaluated_at,mu_a,mu_i,mu_g,trl,brl,grl,srl,hrl,frl,prs_potential,prs_r_net,xrl_notes,frl_notes", filters: ["project_id": "eq.\(projectId)"], order: "evaluated_at.desc")
            async let documents = client.fetchTable(AMDOSProjectDocument.self, table: "project_documents", select: "document_id,project_id,file_name,mime_type,file_size_bytes,upload_status,created_at", filters: ["project_id": "eq.\(projectId)"], order: "created_at.desc")
            let planRows = try await plans
            let milestoneRows = try await milestones
            let planCycleIDs = Set(planRows.map(\.planCycleId))
            let relevantMilestones = milestoneRows.filter { planCycleIDs.contains($0.planCycleId) }
            let milestoneKeys = Set(relevantMilestones.map(\.milestoneId))
            let progressRows = try await progress
            let relevantProgress = progressRows.filter { milestoneKeys.contains($0.milestoneKey) }
            let result = AMDOSCockpitData(project: try await project.project, members: try await members, billing: try await billing, plans: planRows, milestones: relevantMilestones, progress: relevantProgress, strategySignals: try await signals, meetings: try await meetings, xrlEvidence: try await evidence, scores: try await scores, documents: try await documents)
            detail = result; state = .loaded
        } catch { message = error.localizedDescription; state = .failed(message ?? "") }
    }
    func loadReimbursements() async {
        state = .loading; message = nil
        do { reimbursements = try await client.fetchTable(AMDOSReimbursement.self, table: "reimbursements", select: "reimbursement_id,project_id,project_name,date,category,amount,tax_rate,description,transport_mode,transport_from,transport_to,transport_trip,status,created_by,receipt_file_names", order: "date.desc", limit: 200); state = reimbursements.isEmpty ? .empty : .loaded }
        catch { message = error.localizedDescription; state = .failed(message ?? "") }
    }
    func loadCards() async {
        state = .loading; message = nil
        do { let response = try await client.fetchPWA(AMDOSBusinessCardsEnvelope.self, path: "/api/business-cards"); cards = response.cards; state = cards.isEmpty ? .empty : .loaded }
        catch { message = error.localizedDescription; state = .failed(message ?? "") }
    }
    func loadAgreement(ym: String, memberId: String? = nil) async {
        state = .loading; message = nil
        do {
            var query = ["ym": ym]
            if let memberId = memberId?.trimmedNonEmpty { query["memberId"] = memberId }
            let result = try await client.fetchPWA(AMDOSAgreementResponse.self, path: "/api/monthly-work-agreement", query: query)
            agreement = result.bundle; state = result.bundle == nil ? .empty : .loaded
        }
        catch { message = error.localizedDescription; state = .failed(message ?? "") }
    }
}

struct AMDOSDashboardView: View {
    let onSelectProject: (String) -> Void
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    @EnvironmentObject private var auth: AMDOSAuthStore
    var body: some View {
        AMDOSPageScaffold(eyebrow: "TODAY", title: "今日のAMD OS", subtitle: "今日やる判断、動いているプロジェクト、届いているお知らせ") {
            HStack(spacing: 14) {
                AMDOSMetricTile(label: "進行中のPJ", value: "\(workspace.projects.count)", detail: "自分が確認できるプロジェクト")
                AMDOSMetricTile(label: "未読のお知らせ", value: "\(workspace.notifications.filter(\.isUnread).count)", detail: "認可済み配送結果", tint: AMDOSDesign.warning)
                AMDOSMetricTile(label: "接続", value: auth.email == nil ? "未接続" : "接続中", detail: auth.email ?? "")
            }
            AMDOSSectionCard("プロジェクト", systemImage: "folder.fill") {
                if workspace.projects.isEmpty { Text("確認できるプロジェクトはまだないよ。").foregroundStyle(AMDOSDesign.muted) }
                ForEach(workspace.projects) { project in
                    Button { onSelectProject(project.id) } label: { AMDOSLineItem(title: project.name, subtitle: [project.clientName, project.startYm.map { "開始 \($0)" }].compactMap { $0 }.joined(separator: " · "), status: project.status) }.buttonStyle(.plain)
                }
            }
            AMDOSSectionCard("要確認", systemImage: "bell.badge.fill") {
                if let error = workspace.notificationsErrorMessage { AMDOSStateNotice(state: .failed(error)) { Task { await workspace.loadHome(email: auth.email) } } }
                ForEach(workspace.notifications.prefix(5)) { item in AMDOSLineItem(title: item.displayTitle, subtitle: item.displayBody, status: item.isUnread ? "未読" : "確認済み") }
                if workspace.notifications.isEmpty && workspace.notificationsErrorMessage == nil { Text("今すぐ確認するお知らせはないよ。").foregroundStyle(AMDOSDesign.muted) }
            }
        }
    }
}

struct AMDOSMypageView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    @StateObject private var store = AMDOSWorkStore()
    var body: some View {
        AMDOSPageScaffold(eyebrow: "MY PAGE", title: "マイページ", subtitle: "担当PJ、月次の予定、週次活動を自分の視点で確認") {
            AMDOSSectionCard("担当プロジェクト", systemImage: "person.crop.square.filled.and.at.rectangle") {
                ForEach(store.projects) { p in AMDOSLineItem(title: p.name, subtitle: p.clientName ?? "担当内容を確認", status: p.status) }
                AMDOSStateNotice(state: store.state) { Task { await store.loadProjects() } }
            }
            AMDOSSectionCard("アカウント", systemImage: "person.crop.circle") { LabeledContent("ログイン", value: auth.email ?? "—"); Text("報酬額や個人情報はPWAと同じ認可境界で表示するよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
        }.task { await store.loadProjects() }
    }
}

struct AMDOSProjectsView: View {
    let onSelectProject: (String) -> Void
    @StateObject private var store = AMDOSWorkStore()
    var body: some View {
        AMDOSPageScaffold(eyebrow: "PROJECTS", title: "プロジェクト", subtitle: "一覧から選んで、コックピット・設定・月次報告へ進む") {
            AMDOSStateNotice(state: store.state) { Task { await store.loadProjects() } }
            ForEach(store.projects) { project in
                Button { onSelectProject(project.id) } label: { AMDOSCard { HStack { VStack(alignment: .leading, spacing: 6) { Text(project.name).font(.headline); Text(project.clientName ?? "クライアント情報なし").font(.caption).foregroundStyle(AMDOSDesign.muted); Text([project.startYm, project.endYm].compactMap { $0 }.joined(separator: " 〜 ")).font(.caption2).foregroundStyle(AMDOSDesign.muted) }; Spacer(); AMDOSStatusBadge(text: project.status) } } }.buttonStyle(.plain)
            }
        }.task { await store.loadProjects(all: true) }
    }
}

struct AMDOSProjectCockpitView: View {
    let projectId: String?
    let onOpenConfig: (String) -> Void
    @StateObject private var store = AMDOSWorkStore()
    var body: some View {
        AMDOSPageScaffold(eyebrow: "PROJECT COCKPIT", title: store.detail?.project.name ?? "プロジェクトコックピット", subtitle: "進捗、月次、会議、戦略シグナル、根拠資料をプロジェクト単位で確認") {
            if let data = store.detail {
                HStack(spacing: 14) { AMDOSMetricTile(label: "メンバー", value: "\(data.members.count)", detail: "担当メンバー"); AMDOSMetricTile(label: "MS", value: "\(data.milestones.count)", detail: "価値マイルストーン"); AMDOSMetricTile(label: "通知", value: "\(data.strategySignals.count)", detail: "戦略シグナル") }
                HStack { AMDOSStatusBadge(text: data.project.status); Spacer(); Button("設定を開く") { if let id = projectId { onOpenConfig(id) } } }
                AMDOSSectionCard("今月の進捗", systemImage: "chart.line.uptrend.xyaxis") { ForEach(data.progress.prefix(12)) { p in AMDOSLineItem(title: p.milestoneKey, subtitle: p.note ?? "進捗記録", status: p.progressPct.map { "\(Int($0))%" } ?? p.source) } }
                AMDOSSectionCard("会議と判断", systemImage: "person.3.fill") { ForEach(data.meetings.prefix(6)) { m in AMDOSLineItem(title: m.title ?? "会議", subtitle: m.summary ?? "準備状況を確認", status: m.status) }; ForEach(data.strategySignals.prefix(6)) { s in AMDOSLineItem(title: s.title ?? "戦略シグナル", subtitle: s.body ?? "", status: s.status) } }
                AMDOSSectionCard("根拠資料", systemImage: "doc.text.fill") { ForEach(data.documents.prefix(8)) { d in AMDOSLineItem(title: d.fileName, subtitle: "\(d.mimeType) · \(d.fileSizeBytes) bytes", status: d.uploadStatus) } }
            } else { AMDOSStateNotice(state: store.state) { load() } }
        }.task { load() }
    }
    private func load() { guard let projectId else { return }; Task { await store.loadCockpit(projectId: projectId) } }
}

struct AMDOSProjectConfigView: View {
    let projectId: String?
    @State private var project: AMDOSProjectConfigProject?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var status = "active"
    @State private var reportEmails = ""
    @State private var startYm = ""
    @State private var endYm = ""
    @State private var feeType = ""
    @State private var feeAmount = ""
    @State private var invoiceDeadline = ""
    @State private var paymentRule = ""
    @State private var invoiceManual = false
    @State private var invoiceTo = ""
    @State private var invoiceCc = ""
    @State private var invoiceBcc = ""
    @State private var memberRows: [AMDOSProjectConfigMemberRow] = []
    @State private var memberMaster: [AMDOSProjectConfigMemberMaster] = []
    @State private var membersDirty = false
    @State private var membersSaving = false
    @State private var hardDeleteCandidate: AMDOSProjectConfigMemberRow?
    @State private var forceDeleteCandidate: AMDOSProjectConfigMemberRow?
    @State private var deleteReferences: [AMDOSProjectMemberReference] = []
    @State private var message: String?
    @State private var isSaving = false
    var body: some View {
        AMDOSPageScaffold(eyebrow: "PROJECT CONFIG", title: "プロジェクト設定", subtitle: "PWAと同じadmin認可の保存経路で、請求・報告・支払条件を更新") {
            AMDOSStateNotice(state: state) { load() }
            AMDOSSectionCard("基本", systemImage: "slider.horizontal.3") {
                Picker("状態", selection: $status) { ForEach(["active", "sales", "ended", "frozen", "lost"], id: \.self) { Text($0).tag($0) } }
                AMDOSTextField(title: "関係先メールアドレス", text: $reportEmails)
                AMDOSTextField(title: "PJ 開始月 (YYYYMM)", text: $startYm)
                AMDOSTextField(title: "PJ 終了月 (YYYYMM)", text: $endYm)
                Picker("業務委託料タイプ", selection: $feeType) { Text("—").tag(""); Text("毎月固定").tag("monthly_fixed"); Text("マイルストーン").tag("milestone"); Text("変動").tag("variable") }
                AMDOSTextField(title: "業務委託料額 (円)", text: $feeAmount)
            }
            AMDOSSectionCard("請求・支払", systemImage: "yensign.circle") { AMDOSTextField(title: "請求提出ルール", text: $invoiceDeadline); AMDOSTextField(title: "支払期限ルール", text: $paymentRule); Toggle("手動請求送信", isOn: $invoiceManual); AMDOSTextField(title: "請求先", text: $invoiceTo); AMDOSTextField(title: "CC", text: $invoiceCc); AMDOSTextField(title: "BCC", text: $invoiceBcc) }
            membersEditor
            Button(isSaving ? "保存中..." : "設定を保存") { save() }.buttonStyle(.borderedProminent).disabled(projectId == nil || isSaving)
            if let message { Text(message).foregroundStyle(AMDOSDesign.warning) }
        }.task { load() }
        .confirmationDialog("メンバーを完全削除する？", isPresented: Binding(get: { hardDeleteCandidate != nil }, set: { if !$0 { hardDeleteCandidate = nil } }), titleVisibility: .visible) {
            Button("完全削除を続ける", role: .destructive) { if let row = hardDeleteCandidate { hardDeleteCandidate = nil; hardDelete(row, force: false) } }
        } message: { Text("除外と違い、このPJのメンバー行がDBから消える。業務記録があれば次に件数を表示して、強制削除の確認を取るよ。") }
        .confirmationDialog("業務記録を残したまま強制削除する？", isPresented: Binding(get: { forceDeleteCandidate != nil }, set: { if !$0 { forceDeleteCandidate = nil } }), titleVisibility: .visible) {
            Button("業務記録を残して完全削除", role: .destructive) { if let row = forceDeleteCandidate { forceDeleteCandidate = nil; deleteReferences = []; hardDelete(row, force: true) } }
        } message: { Text(deleteReferences.map { "・\($0.label): \($0.count)件" }.joined(separator: "\n") + "\n\n過去の業務記録でメンバー情報が引けなくなる可能性がある。") }
    }
    @ViewBuilder private var membersEditor: some View {
        AMDOSSectionCard("メンバー", systemImage: "person.3") {
            Text("除外は論理削除で復活できる。完全削除は業務記録の参照件数を確認してから行う。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            ForEach($memberRows) { $row in
                AMDOSCard {
                    Picker("メンバー", selection: $row.memberId) { Text("選択...").tag(""); ForEach(memberOptions(for: row), id: \.memberId) { member in Text(member.codeNameText.isEmpty ? member.memberNameText : "\(member.codeNameText) (\(member.memberNameText))").tag(member.memberId) } }
                        .onChange(of: row.memberId) { _, value in membersDirty = true; updateMemberName(row.rowKey, memberId: value) }
                    AMDOSTextField(title: "役割ラベル", text: $row.roleLabel).onChange(of: row.roleLabel) { _, _ in membersDirty = true }
                    HStack { Toggle("PL", isOn: $row.isPL).onChange(of: row.isPL) { _, _ in membersDirty = true }; Toggle("PM", isOn: $row.isPM).onChange(of: row.isPM) { _, _ in membersDirty = true }; Toggle("クローザー", isOn: $row.isCloser).onChange(of: row.isCloser) { _, _ in membersDirty = true }; Toggle("Active", isOn: $row.isActive).onChange(of: row.isActive) { _, _ in membersDirty = true } }
                    HStack { AMDOSTextField(title: "参画月 YYYYMM", text: $row.joinYm).onChange(of: row.joinYm) { _, _ in membersDirty = true }; AMDOSTextField(title: "離脱月 YYYYMM", text: $row.leaveYm).onChange(of: row.leaveYm) { _, _ in membersDirty = true } }
                    HStack { if row.actualID.isEmpty { Button("未保存行を取り消す", role: .destructive) { removeNewMember(row.rowKey) } } else if row.isActive { Button("除外") { setMemberActive(row.rowKey, false) } } else { Button("復活") { setMemberActive(row.rowKey, true) } }; if !row.actualID.isEmpty { Button("完全削除", role: .destructive) { hardDeleteCandidate = row }.disabled(membersSaving) } }
                }
            }
            HStack { Button("＋ メンバー追加") { addMember() }; Spacer(); if membersDirty { Text("未保存の変更あり").font(.caption).foregroundStyle(AMDOSDesign.warning) }; Button(membersSaving ? "保存中..." : "メンバーを一括保存") { saveMembers() }.buttonStyle(.borderedProminent).disabled(membersSaving || !membersDirty) }
        }
    }
    private func load() { guard let projectId else { state = .empty; return }; Task<Void, Never> { state = .loading; do { async let projectRows = AMDOSRESTClient.shared.fetchTable(AMDOSProjectConfigProject.self, table: "projects", select: "id,project_id,project_name,client_name,status,report_emails,start_ym,end_ym,fee_type,fee_amount,invoice_send_deadline_rule,payment_due_rule,invoice_send_manual,invoice_to_emails,invoice_cc_emails,invoice_bcc_emails", filters: ["project_id": "eq.\(projectId)"]); async let loadedMembers = AMDOSRESTClient.shared.fetchTable(AMDOSProjectConfigMember.self, table: "project_members", select: "id,member_id,is_pm,is_closer,is_pl,role_label,join_ym,leave_ym,is_active", filters: ["project_id": "eq.\(projectId)"], order: "is_active.desc,created_at"); async let master = AMDOSRESTClient.shared.fetchTable(AMDOSProjectConfigMemberMaster.self, table: "members", select: "member_id,member_name,code_name,status", order: "code_name", limit: 1_000); let rows = try await projectRows; let members = try await loadedMembers; memberMaster = try await master; project = rows.first; if let p = project { status = p.status ?? "active"; reportEmails = p.reportEmails ?? ""; startYm = p.startYm ?? ""; endYm = p.endYm ?? ""; feeType = p.feeType ?? ""; feeAmount = p.feeAmount.map { String($0) } ?? ""; invoiceDeadline = p.invoiceSendDeadlineRule ?? "10"; paymentRule = p.paymentDueRule ?? ""; invoiceManual = p.invoiceSendManual; invoiceTo = p.invoiceToEmails ?? ""; invoiceCc = p.invoiceCcEmails ?? ""; invoiceBcc = p.invoiceBccEmails ?? ""; memberRows = members.map { AMDOSProjectConfigMemberRow($0, master: memberMaster) }; membersDirty = false }; state = project == nil ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
    private func memberOptions(for row: AMDOSProjectConfigMemberRow) -> [AMDOSProjectConfigMemberMaster] { var options = memberMaster.filter { $0.isActiveRecord || $0.memberId == row.memberId }; if !row.memberId.isEmpty && !options.contains(where: { $0.memberId == row.memberId }) { options.append(AMDOSProjectConfigMemberMaster(memberId: row.memberId, memberName: row.memberName, codeName: row.codeName, status: "inactive")) }; return options }
    private func updateMemberName(_ rowKey: UUID, memberId: String) { guard let member = memberMaster.first(where: { $0.memberId == memberId }), let index = memberRows.firstIndex(where: { $0.rowKey == rowKey }) else { return }; memberRows[index].memberName = member.memberNameText; memberRows[index].codeName = member.codeNameText }
    private func addMember() { memberRows.append(AMDOSProjectConfigMemberRow()); membersDirty = true }
    private func removeNewMember(_ rowKey: UUID) { memberRows.removeAll { $0.rowKey == rowKey && $0.actualID.isEmpty }; membersDirty = true }
    private func setMemberActive(_ rowKey: UUID, _ active: Bool) { guard let index = memberRows.firstIndex(where: { $0.rowKey == rowKey }) else { return }; memberRows[index].isActive = active; membersDirty = true }
    private func saveMembers() {
        guard let projectId else { return }
        let ymValid: (String) -> Bool = { $0.isEmpty || $0.range(of: "^[0-9]{6}$", options: .regularExpression) != nil }
        if memberRows.contains(where: { $0.memberId.trimmedNonEmpty == nil }) { message = "メンバーを選択していない行がある"; return }
        guard let invalid = memberRows.first(where: { !ymValid($0.joinYm) || !ymValid($0.leaveYm) }) else {
            let ids = memberRows.map { $0.memberId.trimmingCharacters(in: .whitespacesAndNewlines) }
            guard Set(ids).count == ids.count else { message = "同じメンバーが複数行に登録されている"; return }
            Task { membersSaving = true; defer { membersSaving = false }; do { let request = AMDOSProjectMembersBulkRequest(projectId: projectId, members: memberRows.map { AMDOSProjectMembersBulkRequest.Member(memberId: $0.memberId.trimmingCharacters(in: .whitespacesAndNewlines), isPM: $0.isPM, isCloser: $0.isCloser, isPL: $0.isPL, roleLabel: $0.roleLabel, joinYm: $0.joinYm, leaveYm: $0.leaveYm, isActive: $0.isActive) }); let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/project-members/bulk", body: request); let result = try JSONDecoder().decode(AMDOSProjectMembersBulkResponse.self, from: data); guard result.ok else { throw AMDOSNetworkError.http(result.message ?? "メンバー保存に失敗した") }; message = "メンバーを保存したよ（更新 \(result.updated ?? 0) / 追加 \(result.inserted ?? 0) / 除外 \(result.deactivated ?? 0)）"; load() } catch { message = error.localizedDescription } }
            return
        }
        _ = invalid
        message = "参画月 / 離脱月は YYYYMM 形式で入力してね"
    }
    private func hardDelete(_ row: AMDOSProjectConfigMemberRow, force: Bool) { Task { membersSaving = true; defer { membersSaving = false }; do { let path = "/api/admin/project-members/\(row.actualID)" + (force ? "?force=1" : ""); _ = try await AMDOSRESTClient.shared.sendPWA(path: path, method: "DELETE", body: AMDOSProjectMemberDeleteRequest()); message = "\(row.codeName.isEmpty ? row.memberId : row.codeName) を完全削除したよ"; load() } catch AMDOSNetworkError.httpStatus(let status, let body) where status == 409 && !force { let result = try? JSONDecoder().decode(AMDOSProjectMemberDeleteResponse.self, from: Data(body.utf8)); if result?.error == "references_exist" { deleteReferences = result?.references ?? []; forceDeleteCandidate = row } else { message = result?.message ?? body } } catch { message = error.localizedDescription } } }
    private func save() {
        guard let id = project?.id else { return }
        let trimmedFeeAmount = feeAmount.trimmingCharacters(in: .whitespacesAndNewlines)
        let parsedFeeAmount = trimmedFeeAmount.isEmpty ? nil : Double(trimmedFeeAmount)
        guard trimmedFeeAmount.isEmpty || parsedFeeAmount != nil else { message = "業務委託料額が数値ではない"; return }
        guard [startYm, endYm].allSatisfy({ $0.isEmpty || $0.range(of: "^[0-9]{6}$", options: .regularExpression) != nil }) else { message = "開始/終了 ym は yyyymm 形式で入力"; return }

        let patch = AMDOSProjectConfigPatch(
            projectsPatch: .init(
                status: status,
                reportEmails: reportEmails.trimmedNonEmpty,
                startYm: startYm.trimmedNonEmpty,
                endYm: endYm.trimmedNonEmpty,
                feeType: feeType.trimmedNonEmpty,
                feeAmount: parsedFeeAmount,
                invoiceSendDeadlineRule: invoiceDeadline.trimmedNonEmpty,
                paymentDueRule: paymentRule.trimmedNonEmpty,
                invoiceSendManual: invoiceManual,
                invoiceToEmails: invoiceTo.trimmedNonEmpty,
                invoiceCcEmails: invoiceCc.trimmedNonEmpty,
                invoiceBccEmails: invoiceBcc.trimmedNonEmpty
            )
        )
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/projects/\(id)", method: "PATCH", body: patch)
                let response = try JSONDecoder().decode(AMDOSProjectConfigSaveResponse.self, from: data)
                guard response.ok else { throw AMDOSNetworkError.http(response.error ?? "PJ 保存に失敗したよ。") }
                message = "保存完了"
                load()
            } catch { message = error.localizedDescription }
        }
    }
}

private struct AMDOSProjectConfigProject: Codable, Sendable { let id: String; let projectId: String; let projectName: String; let clientName: String?; let status: String?; let reportEmails: String?; let startYm: String?; let endYm: String?; let feeType: String?; let feeAmount: Double?; let invoiceSendDeadlineRule: String?; let paymentDueRule: String?; let invoiceSendManual: Bool; let invoiceToEmails: String?; let invoiceCcEmails: String?; let invoiceBccEmails: String?; enum CodingKeys: String, CodingKey { case id, projectId = "project_id", projectName = "project_name", clientName = "client_name", status, reportEmails = "report_emails", startYm = "start_ym", endYm = "end_ym", feeType = "fee_type", feeAmount = "fee_amount", invoiceSendDeadlineRule = "invoice_send_deadline_rule", paymentDueRule = "payment_due_rule", invoiceSendManual = "invoice_send_manual", invoiceToEmails = "invoice_to_emails", invoiceCcEmails = "invoice_cc_emails", invoiceBccEmails = "invoice_bcc_emails" } }
private struct AMDOSProjectConfigPatch: Encodable, Sendable {
    let projectsPatch: ProjectsPatch
    struct ProjectsPatch: Encodable, Sendable {
        let status: String
        let reportEmails: String?
        let startYm: String?
        let endYm: String?
        let feeType: String?
        let feeAmount: Double?
        let invoiceSendDeadlineRule: String?
        let paymentDueRule: String?
        let invoiceSendManual: Bool
        let invoiceToEmails: String?
        let invoiceCcEmails: String?
        let invoiceBccEmails: String?
        enum CodingKeys: String, CodingKey { case status, reportEmails = "report_emails", startYm = "start_ym", endYm = "end_ym", feeType = "fee_type", feeAmount = "fee_amount", invoiceSendDeadlineRule = "invoice_send_deadline_rule", paymentDueRule = "payment_due_rule", invoiceSendManual = "invoice_send_manual", invoiceToEmails = "invoice_to_emails", invoiceCcEmails = "invoice_cc_emails", invoiceBccEmails = "invoice_bcc_emails" }
    }
}
private struct AMDOSProjectConfigSaveResponse: Decodable { let ok: Bool; let error: String? }
private struct AMDOSProjectConfigMember: Codable, Sendable { let id: String; let memberId: String; let isPM: Bool?; let isCloser: Bool?; let isPL: Bool?; let roleLabel: String?; let joinYm: String?; let leaveYm: String?; let isActive: Bool?; enum CodingKeys: String, CodingKey { case id, memberId = "member_id", isPM = "is_pm", isCloser = "is_closer", isPL = "is_pl", roleLabel = "role_label", joinYm = "join_ym", leaveYm = "leave_ym", isActive = "is_active" } }
private struct AMDOSProjectConfigMemberMaster: Codable, Identifiable, Sendable { let memberId: String; let memberName: String?; let codeName: String?; let status: String?; var id: String { memberId }; var memberNameText: String { memberName?.trimmedNonEmpty ?? memberId }; var codeNameText: String { codeName?.trimmedNonEmpty ?? "" }; var isActiveRecord: Bool { (status ?? "active") == "active" }; enum CodingKeys: String, CodingKey { case memberId = "member_id", memberName = "member_name", codeName = "code_name", status } }
private struct AMDOSProjectConfigMemberRow: Identifiable { let rowKey: UUID; let actualID: String; var memberId: String; var memberName: String; var codeName: String; var isPM: Bool; var isCloser: Bool; var isPL: Bool; var roleLabel: String; var joinYm: String; var leaveYm: String; var isActive: Bool; var id: UUID { rowKey }
    init() { rowKey = UUID(); actualID = ""; memberId = ""; memberName = ""; codeName = ""; isPM = false; isCloser = false; isPL = false; roleLabel = ""; joinYm = ""; leaveYm = ""; isActive = true }
    init(_ row: AMDOSProjectConfigMember, master: [AMDOSProjectConfigMemberMaster]) { let member = master.first { $0.memberId == row.memberId }; rowKey = UUID(); actualID = row.id; memberId = row.memberId; memberName = member?.memberNameText ?? row.memberId; codeName = member?.codeNameText ?? ""; isPM = row.isPM == true; isCloser = row.isCloser == true; isPL = row.isPL == true; roleLabel = row.roleLabel ?? ""; joinYm = row.joinYm ?? ""; leaveYm = row.leaveYm ?? ""; isActive = row.isActive != false }
}
private struct AMDOSProjectMembersBulkRequest: Encodable, Sendable { struct Member: Encodable, Sendable { let memberId: String; let isPM: Bool; let isCloser: Bool; let isPL: Bool; let roleLabel: String; let joinYm: String; let leaveYm: String; let isActive: Bool }; let projectId: String; let members: [Member] }
private struct AMDOSProjectMembersBulkResponse: Decodable, Sendable { let ok: Bool; let updated: Int?; let inserted: Int?; let deactivated: Int?; let message: String? }
private struct AMDOSProjectMemberDeleteRequest: Encodable, Sendable {}
private struct AMDOSProjectMemberReference: Decodable, Identifiable { let table: String; let label: String; let count: Int; var id: String { table } }
private struct AMDOSProjectMemberDeleteResponse: Decodable { let ok: Bool?; let error: String?; let message: String?; let references: [AMDOSProjectMemberReference]? }

struct AMDOSProjectReportView: View {
    let projectId: String?
    @State private var reports: [AMDOSMonthlyReport] = []
    @State private var ym = String(Calendar.current.component(.year, from: .now)) + String(format: "%02d", Calendar.current.component(.month, from: .now))
    @State private var feedback = ""
    var body: some View {
        AMDOSPageScaffold(eyebrow: "MONTHLY REPORT", title: "月次報告書", subtitle: "PJの月次報告を読み、必要なら既存の生成・修正APIへ依頼") {
            HStack { TextField("YYYYMM", text: $ym).textFieldStyle(.roundedBorder); Button("再取得") { load() }; Button("報告書を生成") { generate() }.buttonStyle(.borderedProminent) }
            AMDOSTextField(title: "生成時のフィードバック（任意）", text: $feedback, axis: .vertical)
            ForEach(reports) { report in AMDOSSectionCard("\(report.ym) · \(report.status ?? "状態不明")", systemImage: "doc.richtext") { Text(report.finalContent ?? report.draftContent ?? "本文はまだないよ。").textSelection(.enabled) } }
            if reports.isEmpty { Text("このPJの月次報告はまだないよ。").foregroundStyle(AMDOSDesign.muted) }
        }.task { load() }
    }
    private func load() { guard let projectId else { return }; Task { reports = (try? await AMDOSRESTClient.shared.fetchTable(AMDOSMonthlyReport.self, table: "monthly_reports", select: "id,report_id,project_id,ym,draft_content,final_content,status,generated_at,fixed_at", filters: ["project_id": "eq.\(projectId)"], order: "ym.desc")) ?? [] } }
    private func generate() { guard let projectId else { return }; Task { _ = try? await AMDOSRESTClient.shared.sendPWA(path: "/api/report/generate", body: AMDOSReportGenerateInput(projectId: projectId, ym: ym, feedback: feedback)); load() } }
}

struct AMDOSNotificationsView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    @StateObject private var store = AMDOSWorkStore()
    var body: some View { AMDOSPageScaffold(eyebrow: "NOTIFICATIONS", title: "通知", subtitle: "admin-onlyのPWA通知配送。認可拒否・配送失敗と0件を分けて表示") { AMDOSStateNotice(state: store.state) { Task { await store.loadNotifications(email: auth.email) } }; ForEach(store.notifications) { n in AMDOSCard { VStack(alignment: .leading, spacing: 8) { HStack { Text(n.displayTitle).font(.headline); Spacer(); AMDOSStatusBadge(text: n.isUnread ? "未読" : "確認済み", tint: n.isUnread ? AMDOSDesign.warning : AMDOSDesign.success) }; Text(n.displayBody); Text(n.createdAt ?? "").font(.caption).foregroundStyle(AMDOSDesign.muted); Button("確認した") { feedback(n) }.buttonStyle(.bordered) } } }; if case .empty = store.state { Text("今すぐ確認する通知はないよ。").foregroundStyle(AMDOSDesign.muted) } }.task { await store.loadNotifications(email: auth.email) } }
    private func feedback(_ n: AMDOSNotification) { Task { _ = try? await AMDOSRESTClient.shared.sendPWA(path: "/api/notifications/feedback", body: AMDOSAtlasFeedbackInput(l2Kind: n.kind ?? "app", targetId: n.id, scopeKey: "macos", feedbackText: "確認", action: "confirm", notificationId: n.id, meetingId: nil)); await store.loadNotifications(email: auth.email) } }
}

struct AMDOSReimbursementsView: View {
    @StateObject private var store = AMDOSWorkStore()
    @State private var projectId = ""; @State private var date = ""; @State private var category = "other"; @State private var amount = ""; @State private var description = ""; @State private var transportMode = "train"; @State private var transportFrom = ""; @State private var transportTo = ""; @State private var transportTrip = "oneway"; @State private var receipt: URL?; @State private var showImporter = false; @State private var message: String?
    var body: some View {
        AMDOSPageScaffold(eyebrow: "REIMBURSEMENTS", title: "立替申請", subtitle: "PJ・発生日・摘要・領収書をそろえて、PWAの申請APIへ送信") {
            AMDOSSectionCard("新しい申請", systemImage: "plus.circle") { AMDOSTextField(title: "PJ ID", text: $projectId); AMDOSTextField(title: "発生日 (YYYY-MM-DD)", text: $date); Picker("区分", selection: $category) { Text("交通").tag("transport"); Text("宿泊").tag("lodging"); Text("備品").tag("supplies"); Text("会食").tag("meal"); Text("その他").tag("other") }; AMDOSTextField(title: "金額", text: $amount); AMDOSTextField(title: "摘要", text: $description, axis: .vertical); if category == "transport" { Picker("交通手段", selection: $transportMode) { Text("電車").tag("train"); Text("バス").tag("bus"); Text("タクシー").tag("taxi"); Text("車").tag("car"); Text("その他").tag("other") }; AMDOSTextField(title: "出発", text: $transportFrom); AMDOSTextField(title: "到着", text: $transportTo); Picker("往復", selection: $transportTrip) { Text("片道").tag("oneway"); Text("往復").tag("round") } }; HStack { Button("領収書を選ぶ") { showImporter = true }; Text(receipt?.lastPathComponent ?? "未選択").font(.caption).foregroundStyle(AMDOSDesign.muted) }; Button("申請する") { submit() }.buttonStyle(.borderedProminent); if let message { Text(message).foregroundStyle(AMDOSDesign.warning) } }
            AMDOSSectionCard("申請履歴", systemImage: "clock.arrow.circlepath") { AMDOSStateNotice(state: store.state) { Task { await store.loadReimbursements() } }; ForEach(store.reimbursements) { r in AMDOSLineItem(title: "\(r.date) · \(r.category) · \(Int(r.amount))円", subtitle: "\(r.projectName ?? r.projectId) · \(r.description ?? "")", status: r.status) } }
        }.task { await store.loadReimbursements() }.fileImporter(isPresented: $showImporter, allowedContentTypes: [.pdf, .jpeg, .png, .webP]) { result in receipt = try? result.get() }
    }
    private func submit() { guard let file = receipt, let data = try? Data(contentsOf: file) else { message = "領収書を選んでね"; return }; if category == "transport" && (transportFrom.trimmedNonEmpty == nil || transportTo.trimmedNonEmpty == nil) { message = "交通費は出発と到着を入れてね"; return }; Task { do { _ = try await AMDOSRESTClient.shared.uploadMultipart(path: "/api/reimbursements", fields: ["project_id": projectId, "date": date, "category": category, "amount": amount, "tax_rate": "0.1", "description": description, "transport_mode": transportMode, "transport_from": transportFrom, "transport_to": transportTo, "transport_trip": transportTrip], files: [AMDOSUploadFile(fieldName: "receipts", filename: file.lastPathComponent, mimeType: file.pathExtension.lowercased() == "pdf" ? "application/pdf" : "image/\(file.pathExtension.lowercased())", data: data)]); message = "申請を送信したよ"; await store.loadReimbursements() } catch { message = error.localizedDescription } } }
}

struct AMDOSBusinessCardsEnvelope: Codable, Sendable { let ok: Bool?; let cards: [AMDOSBusinessCard]; let projects: [AMDOSProject]? }
struct AMDOSBusinessCardsView: View {
    @StateObject private var store = AMDOSWorkStore(); @State private var showImporter = false; @State private var image: URL?; @State private var selected: AMDOSBusinessCard?; @State private var name = ""; @State private var company = ""; @State private var projectIds = ""; @State private var message: String?
    var body: some View { AMDOSPageScaffold(eyebrow: "BUSINESS CARDS", title: "名刺", subtitle: "画像をOCR候補にし、人が確認してからPJ知識へ同期") { AMDOSSectionCard("取り込み", systemImage: "camera") { HStack { Button("画像を選ぶ") { showImporter = true }; Text(image?.lastPathComponent ?? "未選択").font(.caption).foregroundStyle(AMDOSDesign.muted) }; Button("OCR候補を作成") { upload() }.buttonStyle(.borderedProminent); Text("候補は自動確定しないよ。氏名と紐づけPJを確認してから確定する。").font(.caption).foregroundStyle(AMDOSDesign.muted) }; AMDOSSectionCard("確認待ち", systemImage: "person.text.rectangle") { AMDOSStateNotice(state: store.state) { Task { await store.loadCards() } }; ForEach(store.cards) { card in Button { selected = card; name = card.name ?? ""; company = card.company ?? "" } label: { AMDOSLineItem(title: card.name ?? "氏名未確認", subtitle: "\(card.company ?? "会社未確認") · \(card.email ?? "連絡先未確認")", status: card.status ?? card.ocrStatus) }.buttonStyle(.plain) } }; if selected != nil { AMDOSSectionCard("OCR候補の確認", systemImage: "checkmark.circle") { AMDOSTextField(title: "氏名", text: $name); AMDOSTextField(title: "会社", text: $company); AMDOSTextField(title: "PJ ID（カンマ区切り）", text: $projectIds); Button("確認して同期") { confirm() }.buttonStyle(.borderedProminent); if let message { Text(message).foregroundStyle(AMDOSDesign.warning) } } } }.task { await store.loadCards() }.fileImporter(isPresented: $showImporter, allowedContentTypes: [.jpeg, .png, .webP]) { result in image = try? result.get() } }
    private func upload() { guard let file = image, let data = try? Data(contentsOf: file) else { message = "名刺画像を選んでね"; return }; Task { do { _ = try await AMDOSRESTClient.shared.uploadMultipart(path: "/api/business-cards", fields: [:], files: [AMDOSUploadFile(fieldName: "file", filename: file.lastPathComponent, mimeType: "image/\(file.pathExtension.lowercased())", data: data)]); await store.loadCards() } catch { message = error.localizedDescription } } }
    private func confirm() { guard let card = selected else { return }; Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/business-cards/\(card.id)", method: "PATCH", body: AMDOSBusinessCardConfirmation(fullName: name, companyName: company, projectIds: projectIds.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) })); message = "確認済みとして同期したよ"; await store.loadCards() } catch { message = error.localizedDescription } } }
}

private struct AMDOSBusinessCardConfirmation: Encodable, Sendable {
    let fullName: String
    let companyName: String
    let projectIds: [String]
}

struct AMDOSMonthlyAgreementView: View {
    let initialYM: String?
    let initialMemberId: String?
    @StateObject private var store = AMDOSWorkStore()
    @State private var ym: String
    @State private var message: String?
    @State private var revisionOpen = false
    @State private var requestProjectId = ""
    @State private var requestType = "scope_or_goal"
    @State private var requestBody = ""
    @State private var isSaving = false
    @State private var isRequestSaving = false

    init(initialYM: String? = nil, initialMemberId: String? = nil) {
        self.initialYM = initialYM
        self.initialMemberId = initialMemberId
        let current = String(Calendar.current.component(.year, from: .now)) + String(format: "%02d", Calendar.current.component(.month, from: .now))
        _ym = State(initialValue: initialYM?.count == 6 ? initialYM! : current)
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "MONTHLY AGREEMENT", title: "月初の確認", subtitle: "PWAと同じ月次snapshotの担当内容と予定額を確認して合意する") {
            HStack {
                TextField("YYYYMM", text: $ym).textFieldStyle(.roundedBorder)
                Button("確認") { load() }
            }
            if let bundle = store.agreement {
                AMDOSSectionCard("合意状態：\(agreementStatusLabel(bundle.status))", systemImage: bundle.status == "agreed" ? "checkmark.seal.fill" : "doc.text.fill") {
                    Text(agreementStatusMessage(bundle)).foregroundStyle(bundle.status == "agreed" ? AMDOSDesign.success : AMDOSDesign.muted)
                    if let agreedAt = bundle.latestAgreement?.agreedAt {
                        Text("前回の合意：\(agreedAt)").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    if !bundle.tableReady { Text("保存に必要な準備がまだ終わっていません。準備が終わると合意できます。").font(.caption).foregroundStyle(.red) }
                }
                HStack(spacing: 14) {
                    AMDOSMetricTile(label: "PJ", value: "\(bundle.snapshot.totals.projectCount)", detail: "確認対象")
                    AMDOSMetricTile(label: "予定額", value: "\(Int(bundle.snapshot.totals.expectedRewardYen))円", detail: "予定報酬")
                    AMDOSMetricTile(label: "状態", value: agreementStatusLabel(bundle.status), detail: bundle.canAgree ? "合意できる状態" : (bundle.exclusionReason ?? "確認が必要"), tint: bundle.canAgree ? AMDOSDesign.success : AMDOSDesign.warning)
                }
                scopeSection(bundle)
                rewardSection(bundle)
                referenceSection(bundle)
                AMDOSSectionCard("確認と合意", systemImage: "checkmark.circle") {
                    if bundle.status != "agreed" && bundle.status != "not_required" { Text("上の担当内容と予定額を確認したうえで合意してね。条件が更新された場合は、改めて合意が必要だよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    HStack {
                        Button(isSaving ? "保存中..." : agreementButtonLabel(bundle.status)) { agree(bundle) }
                            .buttonStyle(.borderedProminent)
                            .disabled(isSaving || bundle.status == "agreed" || bundle.status == "not_required" || !bundle.tableReady || !bundle.canAgree)
                        Button("内容が違う場合は修正要望") { message = nil; revisionOpen.toggle() }
                            .disabled(isRequestSaving || !bundle.canAgree)
                    }
                    if revisionOpen { revisionRequestPanel(bundle) }
                }
            } else {
                AMDOSStateNotice(state: store.state) { load() }
            }
            if let message { Text(message).foregroundStyle(AMDOSDesign.warning) }
        }.task { load() }
    }

    @ViewBuilder private func scopeSection(_ bundle: AMDOSAgreementBundle) -> some View {
        AMDOSSectionCard("担当する仕事", systemImage: "checklist") {
            Text("この月に担当するPJとマイルストーンを、PWAと同じsnapshotから表示してるよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            ForEach(bundle.snapshot.projects) { project in
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(project.projectName).font(.headline)
                                Text([project.roleLabel, project.projectStatus].compactMap { $0 }.joined(separator: " · ").trimmedNonEmpty ?? "役割未設定").font(.caption).foregroundStyle(AMDOSDesign.muted)
                            }
                            Spacer()
                            AMDOSStatusBadge(text: project.conditionState, tint: project.conditionState == "ready" ? AMDOSDesign.success : AMDOSDesign.warning)
                        }
                        if !project.milestones.isEmpty {
                            ForEach(project.milestones) { milestone in
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(milestone.taskDescription?.trimmedNonEmpty ?? milestone.title).font(.subheadline.weight(.semibold))
                                    Text([milestone.role, milestone.progressPct.map { "進捗 \(Int($0))%" }, milestone.monthlyProgressPct.map { "今月 \(Int($0))%" }].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                                    if !milestone.conditions.isEmpty { Text(milestone.conditions.joined(separator: " / ")).font(.caption2).foregroundStyle(AMDOSDesign.warning) }
                                }
                                if milestone.id != project.milestones.last?.id { Divider() }
                            }
                        } else {
                            Text("この月に紐づくマイルストーンはありません。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                        if !project.conditions.isEmpty { Text("条件：\(project.conditions.joined(separator: " / "))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        ForEach(project.reviewReasons, id: \.self) { Text("・\($0)").font(.caption).foregroundStyle(AMDOSDesign.warning) }
                    }
                }
            }
        }
    }

    @ViewBuilder private func rewardSection(_ bundle: AMDOSAgreementBundle) -> some View {
        AMDOSSectionCard("その対価としての予定額", systemImage: "yensign.circle") {
            Text("合計予定額：\(Int(bundle.snapshot.totals.expectedRewardYen))円").font(.headline)
            ForEach(bundle.snapshot.projects) { project in
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack { Text(project.projectName).font(.subheadline.weight(.semibold)); Spacer(); Text("\(Int(project.expectedRewardYen ?? 0))円").font(.headline) }
                        Text([project.paymentYm.map { "支払予定 \($0)" }, project.currentCyclePayoutYen.map { "当月 \(Int($0))円" }, project.stockYen.map { "株式 \(Int($0))円" }].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                        ForEach(project.milestones) { milestone in
                            HStack {
                                Text(milestone.taskDescription?.trimmedNonEmpty ?? milestone.title).font(.caption)
                                Spacer()
                                Text("\(Int(milestone.expectedRewardYen ?? 0))円").font(.caption.weight(.semibold))
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder private func referenceSection(_ bundle: AMDOSAgreementBundle) -> some View {
        AMDOSSectionCard("参照情報", systemImage: "doc.text.magnifyingglass") {
            HStack(spacing: 14) {
                AMDOSMetricTile(label: "実支払", value: "\(Int(bundle.snapshot.totals.paidActualYen ?? 0))円", detail: "確定分")
                AMDOSMetricTile(label: "未確認", value: "\(Int(bundle.snapshot.totals.unverifiedPaidYen ?? 0))円", detail: "確認待ち", tint: AMDOSDesign.warning)
                AMDOSMetricTile(label: "将来支払", value: "\(Int(bundle.snapshot.totals.futurePayoutYen ?? 0))円", detail: "予定")
                AMDOSMetricTile(label: "株式", value: "\(Int(bundle.snapshot.totals.stockYen))円", detail: "予定")
            }
            ForEach(bundle.snapshot.projects) { project in
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(project.projectName).font(.headline)
                        Text([project.billingStatus.map { "請求 \($0)" }, project.allocationStatus.map { "配分 \($0)" }, project.paymentYm.map { "支払 \($0)" }].compactMap { $0 }.joined(separator: " · ").trimmedNonEmpty ?? "支払情報なし").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        if !project.payoutSchedule.isEmpty {
                            ForEach(project.payoutSchedule) { row in
                                Text("\(row.sourceYm) → \(row.paymentYm) · \(Int(row.totalPayTaxIncludedYen))円 · \(row.status ?? row.amountSource)").font(.caption)
                            }
                        }
                        if !project.routineExpectations.isEmpty { Text("定常：\(project.routineExpectations.joined(separator: " / "))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    }
                }
            }
        }
    }

    @ViewBuilder private func revisionRequestPanel(_ bundle: AMDOSAgreementBundle) -> some View {
        Divider()
        Text("修正要望").font(.headline)
        Text("担当内容、予定額に違いがあるときだけ送ってね。送った時点の記録IDも一緒に残るよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
        Picker("種類", selection: $requestType) {
            Text("担当内容").tag("scope_or_goal")
            Text("予定額").tag("reward")
            Text("その他").tag("other")
        }
        Picker("対象PJ", selection: $requestProjectId) {
            Text("全体").tag("")
            ForEach(bundle.snapshot.projects) { project in Text(project.projectName).tag(project.projectId) }
        }
        AMDOSTextField(title: "要望内容", text: $requestBody, axis: .vertical)
        HStack {
            Button("閉じる") { revisionOpen = false }
            Button(isRequestSaving ? "送信中..." : "送る") { requestRevision(bundle) }
                .buttonStyle(.bordered)
                .disabled(isRequestSaving || !bundle.canAgree || requestBody.trimmingCharacters(in: .whitespacesAndNewlines).count < 4)
        }
        if !bundle.revisionRequests.isEmpty {
            Divider()
            Text("これまでの修正要望").font(.subheadline)
            ForEach(bundle.revisionRequests.prefix(3)) { request in
                AMDOSLineItem(title: request.status == "open" ? "対応中" : request.status, subtitle: "\(request.projectId ?? "全体") · \(request.body)", status: request.requestType)
            }
        }
    }
    private func load() { Task { await store.loadAgreement(ym: ym, memberId: initialMemberId) } }
    private func agree(_ bundle: AMDOSAgreementBundle) {
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/monthly-work-agreement/agree", body: AMDOSAgreementRequest(ym: bundle.ym, memberId: bundle.snapshot.member.memberId))
                let response = try JSONDecoder().decode(AMDOSAgreementResponse.self, from: data)
                guard response.ok, let refreshed = response.bundle else { throw AMDOSNetworkError.http(response.error ?? "保存に失敗したよ。") }
                store.agreement = refreshed
                store.state = .loaded
                message = "合意を保存したよ"
            } catch { message = error.localizedDescription }
        }
    }
    private func requestRevision(_ bundle: AMDOSAgreementBundle) {
        let body = requestBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard body.count >= 4 else { message = "修正要望を4文字以上で入力してね"; return }
        Task {
            isRequestSaving = true
            defer { isRequestSaving = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/monthly-work-agreement/request-revision", body: AMDOSAgreementRevisionRequest(ym: bundle.ym, memberId: bundle.snapshot.member.memberId, projectId: requestProjectId.trimmedNonEmpty, requestType: requestType, body: body))
                let response = try JSONDecoder().decode(AMDOSAgreementResponse.self, from: data)
                guard response.ok, let refreshed = response.bundle else { throw AMDOSNetworkError.http(response.error ?? "保存に失敗したよ。") }
                store.agreement = refreshed
                store.state = .loaded
                requestBody = ""
                requestProjectId = ""
                requestType = "scope_or_goal"
                revisionOpen = true
                message = "送信しました。管理側で確認します。"
            } catch { message = error.localizedDescription }
        }
    }
    private func agreementStatusLabel(_ status: String) -> String { switch status { case "agreed": return "合意済み"; case "needs_reagreement": return "条件更新あり"; case "not_required": return "対象外"; default: return "未合意" } }
    private func agreementStatusMessage(_ bundle: AMDOSAgreementBundle) -> String { switch bundle.status { case "agreed": return "この内容で合意済みです。"; case "needs_reagreement": return "前回合意後に担当内容または予定額が更新されたので、最新内容を再確認してね。"; case "not_required": return bundle.exclusionReason ?? "この月は対象外です。"; default: return "担当内容と予定額の確認・合意がまだ完了していません。" } }
    private func agreementButtonLabel(_ status: String) -> String { switch status { case "agreed": return "合意済み"; case "not_required": return "対象外"; default: return "確認して合意" } }
}

private struct AMDOSContractsEnvelope: Codable, Sendable { let ok: Bool?; let error: String?; let contracts: [AMDOSContractRecord]?; let documents: [AMDOSContractEvidence]?; let signals: [AMDOSContractEvidence]?; let terms: [AMDOSContractEvidence]?; let nudges: [AMDOSContractEvidence]?; let projects: [AMDOSContractProject]? }
private struct AMDOSContractRecord: Codable, Identifiable, Sendable { let id: String; let projectId: String?; let title: String?; let counterpartyName: String?; let contractType: String?; let status: String?; let expectedSigningDate: String?; let lastActivityAt: String?; let reviewStatus: String?; enum CodingKeys: String, CodingKey { case id = "contract_id", projectId = "project_id", title = "contract_title", counterpartyName = "counterparty_name", contractType = "contract_type", status, expectedSigningDate = "expected_signing_date", lastActivityAt = "last_activity_at", reviewStatus = "review_status" } }
private struct AMDOSContractEvidence: Codable, Identifiable, Sendable { let id: String; let title: String?; let summary: String?; let status: String?; let projectId: String?; let sourceRef: String?; let detectedAt: String?; enum CodingKeys: String, CodingKey { case id = "id", title, summary, status, projectId = "project_id", sourceRef = "source_ref", detectedAt = "detected_at" } }
private struct AMDOSContractProject: Codable, Identifiable, Sendable { let id: String; let projectId: String; let projectName: String; let status: String?; enum CodingKeys: String, CodingKey { case id, projectId = "project_id", projectName = "project_name", status } }
private struct AMDOSContractCreateInput: Encodable, Sendable { let projectId: String; let contractTitle: String; let counterpartyName: String?; let contractType: String; let status: String; let expectedSigningDate: String?; enum CodingKeys: String, CodingKey { case projectId = "project_id", contractTitle = "contract_title", counterpartyName = "counterparty_name", contractType = "contract_type", status, expectedSigningDate = "expected_signing_date" } }
struct AMDOSContractsView: View {
    @State private var response: AMDOSContractsEnvelope?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var projectId = ""; @State private var title = ""; @State private var counterparty = ""; @State private var message: String?
    var body: some View {
        AMDOSPageScaffold(eyebrow: "CONTRACTS", title: "契約", subtitle: "PWA ContractsClientと同じadmin API。契約・証跡・シグナルを分けて確認") {
            stateNotice
            createContractSection
            contractSection
            evidenceSection
        }
        .task { load() }
    }

    @ViewBuilder private var stateNotice: some View { AMDOSStateNotice(state: state) { load() } }
    @ViewBuilder private var createContractSection: some View {
        AMDOSSectionCard("新規契約", systemImage: "plus.circle") { AMDOSTextField(title: "PJ ID", text: $projectId); AMDOSTextField(title: "契約タイトル", text: $title); AMDOSTextField(title: "相手方", text: $counterparty); Button("契約を作成") { create() }.buttonStyle(.borderedProminent); if let message { Text(message).foregroundStyle(AMDOSDesign.warning) } }
    }
    @ViewBuilder private var contractSection: some View {
        if let response { AMDOSSectionCard("契約", systemImage: "signature") { if (response.contracts ?? []).isEmpty { Text("契約レコードはまだないよ。").foregroundStyle(AMDOSDesign.muted) }; ForEach(response.contracts ?? []) { row in AMDOSContractRecordRow(row: row) } } }
    }
    @ViewBuilder private var evidenceSection: some View {
        if let response { AMDOSSectionCard("証跡・シグナル・条件", systemImage: "doc.text.magnifyingglass") { ForEach(evidence(from: response)) { row in AMDOSContractEvidenceRow(row: row) } } }
    }
    private func evidence(from response: AMDOSContractsEnvelope) -> [AMDOSContractEvidence] {
        (response.documents ?? []) + (response.signals ?? []) + (response.terms ?? []) + (response.nudges ?? [])
    }
    private func load() { Task { state = .loading; do { response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSContractsEnvelope.self, path: "/api/contracts"); state = response?.contracts?.isEmpty == true ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
    private func create() { Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/contracts", body: AMDOSContractCreateInput(projectId: projectId, contractTitle: title, counterpartyName: counterparty.trimmedNonEmpty, contractType: "contract", status: "planned", expectedSigningDate: nil)); message = "契約を作成したよ"; load() } catch { message = error.localizedDescription } } }
}

private struct AMDOSContractRecordRow: View { let row: AMDOSContractRecord; var body: some View { AMDOSCard { VStack(alignment: .leading, spacing: 6) { HStack { Text(row.title ?? row.id).font(.headline); Spacer(); AMDOSStatusBadge(text: row.status ?? "未確認") }; Text("相手方: \(row.counterpartyName ?? "未登録") · 種別: \(row.contractType ?? "contract")"); Text("締結予定: \(row.expectedSigningDate ?? "未登録") · 最終活動: \(row.lastActivityAt ?? "未登録")").font(.caption).foregroundStyle(AMDOSDesign.muted); Text("review: \(row.reviewStatus ?? "未確認")").font(.caption) } } } }
private struct AMDOSContractEvidenceRow: View { let row: AMDOSContractEvidence; var body: some View { AMDOSLineItem(title: row.title ?? row.id, subtitle: [row.summary, row.sourceRef, row.detectedAt].compactMap { $0 }.joined(separator: " · "), status: row.status) } }

private struct AMDOSJpCultureItem: Codable, Identifiable, Sendable { let id: String; let title: String; let description: String?; let categoryPath: [String]; let prefecture: String?; let city: String?; let links: [AMDOSCultureLink]?; let sortWeight: Double?; enum CodingKeys: String, CodingKey { case id, title, description, categoryPath = "category_path", prefecture, city, links, sortWeight = "sort_weight" } }
private struct AMDOSCultureLink: Codable, Sendable { let label: String; let url: String }
private struct AMDOSCompanyProfile: Codable, Identifiable, Sendable { let id: String; let title: String; let body: String?; let visibility: String; let status: String; let reviewedAt: String?; enum CodingKeys: String, CodingKey { case id = "entry_id", title, body = "body_md", visibility, status, reviewedAt = "reviewed_at" } }
private struct AMDOSCompanyMember: Codable, Identifiable, Sendable { let id: String; let displayName: String; let fullName: String?; let publicTitle: String?; let internalTitle: String?; let joinedOn: String?; let effort: Double?; let bio: String?; let bioLong: String?; let expertiseTags: [String]?; let mbtiTags: [String]?; let originLabel: String?; let residenceLabel: String?; let joinContext: String?; let offTimeNote: String?; let favoriteFood: String?; let bucketList: String?; let photoAssetId: String?; let visibility: String; let status: String; enum CodingKeys: String, CodingKey { case id = "member_profile_id", displayName = "display_name", fullName = "full_name", publicTitle = "public_title", internalTitle = "internal_title", joinedOn = "joined_on", effort, bio = "bio_short", bioLong = "bio_long", expertiseTags = "expertise_tags", mbtiTags = "mbti_tags", originLabel = "origin_label", residenceLabel = "residence_label", joinContext = "join_context", offTimeNote = "off_time_note", favoriteFood = "favorite_food", bucketList = "bucket_list", photoAssetId = "photo_asset_id", visibility, status } }
private struct AMDOSCompanyHistoryEvent: Codable, Identifiable, Sendable { let id: String; let date: String?; let title: String; let summary: String?; let eventType: String?; let projectId: String?; let status: String; enum CodingKeys: String, CodingKey { case id = "event_id", date = "occurred_on", title, summary, eventType = "event_type", projectId = "project_id", status } }
private struct AMDOSCompanyMediaAsset: Codable, Identifiable, Sendable { let id: String; let title: String?; let kind: String; let capturedAt: String?; let usagePermission: String?; let consentStatus: String?; let projectIds: [String]?; let memberIds: [String]?; let visibility: String; let status: String; let storagePath: String?; let thumbnailPath: String?; enum CodingKeys: String, CodingKey { case id = "asset_id", title, kind = "asset_kind", capturedAt = "captured_at", usagePermission = "usage_permission", consentStatus = "consent_status", projectIds = "project_ids", memberIds = "member_ids", visibility, status, storagePath = "storage_path", thumbnailPath = "thumbnail_path" } }
struct AMDOSCompanyView: View {
    @State private var profiles: [AMDOSCompanyProfile] = []
    @State private var members: [AMDOSCompanyMember] = []
    @State private var history: [AMDOSCompanyHistoryEvent] = []
    @State private var media: [AMDOSCompanyMediaAsset] = []
    @State private var mediaReview: [AMDOSCompanyMediaAsset] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    var body: some View {
        AMDOSPageScaffold(eyebrow: "COMPANY", title: "会社", subtitle: "approved internalの会社プロフィール・チーム・沿革を、PWA Companyと同じRLSで読む") {
            AMDOSStateNotice(state: state) { load() }
            HStack { AMDOSMetricTile(label: "team profiles", value: "\(members.count)", detail: "approved"); AMDOSMetricTile(label: "history events", value: "\(history.count)", detail: "approved"); AMDOSMetricTile(label: "photo review", value: "\(mediaReview.count)", detail: "needs review"); AMDOSMetricTile(label: "visibility gate", value: "on", detail: "internal") }
            AMDOSSectionCard("プロフィール", systemImage: "building.2") {
                ForEach(profiles) { row in
                    AMDOSSectionCard(row.title, systemImage: "doc.text") { Text(row.body ?? "本文なし").textSelection(.enabled); AMDOSStatusBadge(text: row.status) }
                }
            }
            AMDOSSectionCard("チーム", systemImage: "person.2") {
                ForEach(members) { row in
                    AMDOSSectionCard(row.displayName, systemImage: "person.crop.circle") { HStack(alignment: .top) { if let id = row.photoAssetId { AMDOSCompanyMediaThumbnail(assetID: id) }; VStack(alignment: .leading) { Text([row.fullName, row.publicTitle ?? row.internalTitle].compactMap { $0 }.joined(separator: " / ")).font(.caption); Text([row.joinedOn.map { "joined \($0)" }, row.effort.map { "effort \(Int($0 * 100))%" }].compactMap { $0 }.joined(separator: " / ")).font(.caption2).foregroundStyle(AMDOSDesign.muted); if let bio = row.bio { Text(bio) }; ForEach([("参画", row.joinContext), ("拠点", [row.originLabel, row.residenceLabel].compactMap { $0 }.joined(separator: " / ").trimmedNonEmpty), ("オフ", row.offTimeNote), ("好きな食べ物", row.favoriteFood), ("バケットリスト", row.bucketList)], id: \.0) { label, value in if let value { Text("\(label): \(value)").font(.caption).foregroundStyle(AMDOSDesign.muted) } }; let tags = (row.expertiseTags ?? []) + (row.mbtiTags ?? []); if !tags.isEmpty { Text(tags.prefix(6).joined(separator: " / ")).font(.caption2).foregroundStyle(AMDOSDesign.muted) } }; Spacer(); AMDOSStatusBadge(text: row.status) } }
                }
            }
            AMDOSSectionCard("Media", systemImage: "photo.on.rectangle") { if media.isEmpty && mediaReview.isEmpty { Text("reviewed media はまだないよ").foregroundStyle(AMDOSDesign.muted) }; ForEach(media) { item in AMDOSCompanyMediaRow(asset: item, review: false) }; ForEach(mediaReview) { item in AMDOSCompanyMediaRow(asset: item, review: true) } }
            AMDOSSectionCard("沿革", systemImage: "clock") {
                ForEach(history) { row in
                    AMDOSLineItem(title: row.title, subtitle: [row.date, row.summary, row.eventType, row.projectId].compactMap { $0 }.joined(separator: " · "), status: row.status)
                }
            }
        }.task { load() }
    }
    private func load() {
        Task { state = .loading; do {
            async let p = AMDOSRESTClient.shared.fetchTable(AMDOSCompanyProfile.self, table: "company_profile_entries", select: "entry_id,title,body_md,visibility,status,reviewed_at", filters: ["visibility": "in.(internal,public_candidate)", "status": "in.(approved_internal,approved_public)"], order: "updated_at.desc", limit: 48)
            async let m = AMDOSRESTClient.shared.fetchTable(AMDOSCompanyMember.self, table: "member_profiles", select: "member_profile_id,member_id,display_name,full_name,public_title,internal_title,joined_on,effort,bio_short,bio_long,expertise_tags,mbti_tags,origin_label,residence_label,join_context,off_time_note,favorite_food,bucket_list,photo_asset_id,visibility,status", filters: ["visibility": "in.(internal,public_candidate)", "status": "in.(approved_internal,approved_public)"], order: "display_name", limit: 48)
            async let h = AMDOSRESTClient.shared.fetchTable(AMDOSCompanyHistoryEvent.self, table: "company_history_events", select: "event_id,occurred_on,title,summary,event_type,project_id,visibility,status", filters: ["visibility": "in.(internal,public_candidate)", "status": "in.(approved_internal,approved_public)"], order: "occurred_on.desc", limit: 200)
            async let a = AMDOSRESTClient.shared.fetchTable(AMDOSCompanyMediaAsset.self, table: "media_assets", select: "asset_id,title,asset_kind,captured_at,usage_permission,consent_status,project_ids,member_ids,visibility,status,storage_path,thumbnail_path", filters: ["visibility": "in.(internal,public_candidate)", "status": "in.(approved_internal,approved_public)", "usage_permission": "in.(internal_ok,public_ok)", "consent_status": "in.(granted,not_needed)"], order: "captured_at.desc", limit: 24)
            async let r = AMDOSRESTClient.shared.fetchTable(AMDOSCompanyMediaAsset.self, table: "media_assets", select: "asset_id,title,asset_kind,captured_at,usage_permission,consent_status,member_ids,visibility,status,storage_path,thumbnail_path", filters: ["asset_kind": "in.(photo,video)", "source_ref": "eq.notion:team-armada-photo-db", "visibility": "eq.admin_only", "status": "eq.needs_review"], order: "captured_at.desc", limit: 500)
            profiles = try await p; members = try await m; history = try await h; media = try await a; mediaReview = try await r
            state = profiles.isEmpty && members.isEmpty && history.isEmpty && media.isEmpty && mediaReview.isEmpty ? .empty : .loaded
        } catch { state = .failed(error.localizedDescription) } }
    }
}
private struct AMDOSCompanyMediaThumbnail: View { let assetID: String; @State private var image: NSImage?; var body: some View { Group { if let image { Image(nsImage: image).resizable().scaledToFill() } else { Image(systemName: "photo").foregroundStyle(AMDOSDesign.muted) } }.frame(width: 56, height: 56).clipShape(RoundedRectangle(cornerRadius: 8)).task(id: assetID) { guard let data = try? await AMDOSRESTClient.shared.fetchPWAData(path: "/api/company-media/file/\(assetID)"), let value = NSImage(data: data) else { return }; image = value } } }
private struct AMDOSCompanyMediaRow: View { let asset: AMDOSCompanyMediaAsset; let review: Bool; var body: some View { HStack(alignment: .top) { AMDOSCompanyMediaThumbnail(assetID: asset.id); VStack(alignment: .leading) { Text(asset.title ?? asset.id).font(.headline); Text([asset.kind, asset.capturedAt, asset.usagePermission.map { "usage:\($0)" }, asset.consentStatus.map { "consent:\($0)" }].compactMap { $0 }.joined(separator: " / ")).font(.caption).foregroundStyle(AMDOSDesign.muted); if let projects = asset.projectIds, !projects.isEmpty { Text(projects.joined(separator: " / ")).font(.caption2).foregroundStyle(AMDOSDesign.muted) } }; Spacer(); AMDOSStatusBadge(text: review ? "review" : asset.status, tint: review ? AMDOSDesign.warning : AMDOSDesign.success) } } }
struct AMDOSJapaneseCultureMapView: View { @State private var items: [AMDOSJpCultureItem] = []; @State private var query = ""; @State private var state: AMDOSFeatureLoadState = .idle; var body: some View { AMDOSPageScaffold(eyebrow: "JAPANESE CULTURE MAP", title: "日本文化マップ", subtitle: "jp_culture_itemsのactive項目をカテゴリ・地域で絞り込む") { TextField("タイトル・地域・カテゴリ", text: $query).textFieldStyle(.roundedBorder); AMDOSStateNotice(state: state) { load() }; ForEach(items.filter { query.isEmpty || [$0.title, $0.prefecture, $0.city, $0.categoryPath.joined(separator: "/")].compactMap { $0 }.joined().localizedCaseInsensitiveContains(query) }) { item in AMDOSSectionCard(item.title, systemImage: "map") { Text(item.description ?? "説明なし"); Text([item.categoryPath.joined(separator: " / "), item.prefecture, item.city].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted); ForEach(item.links ?? [], id: \.url) { link in Text(link.label + " · " + link.url).font(.caption).textSelection(.enabled) } } } }.task { load() } }; private func load() { Task { state = .loading; do { items = try await AMDOSRESTClient.shared.fetchTable(AMDOSJpCultureItem.self, table: "jp_culture_items", select: "id,title,description,category_path,prefecture,city,links,image_url,sort_weight", filters: ["status": "eq.active"], order: "sort_weight.desc", limit: 500); state = items.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } } }
