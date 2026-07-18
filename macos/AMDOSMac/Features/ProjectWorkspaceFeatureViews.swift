import SwiftUI
import Foundation

// MARK: - PWA `/project/[projectId]/workspace` DTO

struct AMDOSProjectWorkspaceProject: Codable, Sendable {
    let projectId: String
    let projectName: String
    let clientName: String?
    let status: String
}

struct AMDOSProjectWorkspaceEffort: Codable, Sendable {
    let plannedHours: Double
    let actualHours: Double
    let categories: [String: Double]
    let hasEntries: Bool
}

struct AMDOSProjectWorkspaceMember: Codable, Identifiable, Sendable {
    let memberId: String
    let codeName: String
    let roleLabel: String?
    let isLead: Bool
    let evidenceCount: Int
    let lastActivityAt: String?
    let plannedHours: Double
    let actualHours: Double
    let categories: [String: Double]

    var id: String { memberId }
}

struct AMDOSProjectWorkspaceMilestone: Codable, Identifiable, Sendable {
    let milestoneId: String
    let title: String
    let progressPct: Double
    let progressYm: String?
    let targetYm: String?

    var id: String { milestoneId }
}

struct AMDOSProjectWorkspaceEvidenceMonth: Codable, Identifiable, Sendable {
    let ym: String
    let count: Int

    var id: String { ym }
}

struct AMDOSProjectWorkspaceEvidenceSource: Codable, Identifiable, Sendable {
    let source: String
    let count: Int

    var id: String { source }
}

struct AMDOSProjectWorkspaceWeeklyTrend: Codable, Identifiable, Sendable {
    let weekStart: String
    let plannedHours: Double
    let actualHours: Double

    var id: String { weekStart }
}

struct AMDOSProjectWorkspaceBundle: Codable, Sendable {
    let project: AMDOSProjectWorkspaceProject
    let currentWeekStart: String
    let currentMonth: String
    let memberCount: Int
    let evidenceCount: Int
    let effort: AMDOSProjectWorkspaceEffort
    let members: [AMDOSProjectWorkspaceMember]
    let milestones: [AMDOSProjectWorkspaceMilestone]
    let evidenceByMonth: [AMDOSProjectWorkspaceEvidenceMonth]
    let evidenceBySource: [AMDOSProjectWorkspaceEvidenceSource]
    let weeklyTrend: [AMDOSProjectWorkspaceWeeklyTrend]
}

private struct AMDOSProjectWorkspaceBundleEnvelope: Decodable, Sendable {
    let ok: Bool?
    let access: AMDOSProjectWorkspaceAccess?
    let bundle: AMDOSProjectWorkspaceBundle?
    let error: String?
}

private struct AMDOSProjectWorkspaceEffortInput: Encodable, Sendable {
    let memberId: String
    let weekStart: String
    let category: String
    let plannedHours: Double
    let actualHours: Double
    let note: String?
}

private struct AMDOSProjectWorkspaceMutationEnvelope: Decodable, Sendable {
    let ok: Bool?
    let error: String?
}

extension AMDOSRESTClient {
    /// Generic PWA DTO only. PJ限定ユーザーはここから直接Supabaseテーブルを
    /// 読まず、PWAと同じmembership境界を通った集計だけを受け取る。
    func fetchProjectWorkspace(projectID: String) async throws -> (AMDOSProjectWorkspaceAccess, AMDOSProjectWorkspaceBundle) {
        let response = try await fetchPWA(
            AMDOSProjectWorkspaceBundleEnvelope.self,
            path: "/api/project-workspace/\(projectID)"
        )
        guard response.ok == true, let access = response.access, let bundle = response.bundle else {
            throw AMDOSNetworkError.http(response.error ?? "PJワークスペースを取得できなかったよ")
        }
        return (access, bundle)
    }

    fileprivate func saveProjectWorkspaceEffort(projectID: String, input: AMDOSProjectWorkspaceEffortInput) async throws {
        let data = try await sendPWA(path: "/api/project-workspace/\(projectID)/effort", body: input)
        let response = try JSONDecoder().decode(AMDOSProjectWorkspaceMutationEnvelope.self, from: data)
        guard response.ok == true else {
            throw AMDOSNetworkError.http(response.error ?? "週次エフォートを保存できなかったよ")
        }
    }
}

private enum AMDOSWorkspaceEffortCategory: String, CaseIterable, Identifiable {
    case basic
    case applied
    case development
    case su
    case coordination

    var id: String { rawValue }

    var label: String {
        switch self {
        case .basic: return "基礎研究"
        case .applied: return "応用研究"
        case .development: return "開発"
        case .su: return "SU活動"
        case .coordination: return "調整・運営"
        }
    }

    var shortLabel: String {
        switch self {
        case .basic: return "基礎"
        case .applied: return "応用"
        case .development: return "開発"
        case .su: return "SU"
        case .coordination: return "調整"
        }
    }

    var color: Color {
        switch self {
        case .basic: return Color(red: 0.19, green: 0.37, blue: 0.49)
        case .applied: return Color(red: 0.37, green: 0.53, blue: 0.62)
        case .development: return Color(red: 0.22, green: 0.45, blue: 0.36)
        case .su: return Color(red: 0.75, green: 0.48, blue: 0.17)
        case .coordination: return Color(red: 0.46, green: 0.39, blue: 0.48)
        }
    }
}

@MainActor
private final class AMDOSProjectWorkspaceStore: ObservableObject {
    @Published var access: AMDOSProjectWorkspaceAccess?
    @Published var bundle: AMDOSProjectWorkspaceBundle?
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?

    private let client: AMDOSRESTClient

    init(client: AMDOSRESTClient = .shared) {
        self.client = client
    }

    func load(projectID: String?) async {
        guard let projectID = projectID?.trimmedNonEmpty else {
            bundle = nil
            state = .empty
            message = "プロジェクトを選んでね"
            return
        }
        state = .loading
        message = nil
        do {
            let payload = try await client.fetchProjectWorkspace(projectID: projectID)
            access = payload.0
            bundle = payload.1
            state = .loaded
        } catch {
            bundle = nil
            state = .failed(error.localizedDescription)
        }
    }

    func save(projectID: String, input: AMDOSProjectWorkspaceEffortInput) async {
        do {
            try await client.saveProjectWorkspaceEffort(projectID: projectID, input: input)
            message = "保存したよ。配分表に反映した。"
            await load(projectID: projectID)
        } catch {
            message = error.localizedDescription
        }
    }
}

struct AMDOSProjectWorkspaceProjectListView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    let onSelectProject: (String) -> Void

    var body: some View {
        let access = auth.workspaceAccess
        AMDOSPageScaffold(
            eyebrow: "PROJECT WORKSPACE",
            title: "参加しているプロジェクト",
            subtitle: "ここには参加設定されたPJだけが表示される。ほかのPJやAMD社内の管理情報は表示しない。"
        ) {
            if let access, !access.projects.isEmpty {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 14)], spacing: 14) {
                    ForEach(access.projects) { project in
                        Button { onSelectProject(project.projectId) } label: {
                            AMDOSCard {
                                VStack(alignment: .leading, spacing: 12) {
                                    HStack {
                                        Image(systemName: "flask.fill").foregroundStyle(AMDOSDesign.success)
                                        Spacer()
                                        Image(systemName: "arrow.right").foregroundStyle(AMDOSDesign.muted)
                                    }
                                    Text(project.projectName).font(.headline)
                                    Text(project.projectId).font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                AMDOSSectionCard("参加PJ", systemImage: "tray") {
                    Text("参加PJがまだ設定されてないよ。PJ管理者にメンバー設定を確認してもらってね。")
                        .foregroundStyle(AMDOSDesign.muted)
                }
            }
        }
    }
}

struct AMDOSProjectWorkspaceView: View {
    let projectID: String?

    @EnvironmentObject private var auth: AMDOSAuthStore
    @StateObject private var store = AMDOSProjectWorkspaceStore()
    @State private var selectedMemberID = ""
    @State private var weekStart = Date()
    @State private var selectedCategory = AMDOSWorkspaceEffortCategory.basic
    @State private var plannedHours = ""
    @State private var actualHours = ""
    @State private var note = ""
    @State private var saving = false

    private var effectiveAccess: AMDOSProjectWorkspaceAccess? { store.access ?? auth.workspaceAccess }

    private var selectableMembers: [AMDOSProjectWorkspaceMember] {
        guard let bundle = store.bundle else { return [] }
        guard let access = effectiveAccess, access.scope == .project else { return bundle.members }
        return bundle.members.filter { $0.memberId == access.memberId }
    }

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "PROJECT WORKSPACE",
            title: store.bundle.map { "\($0.project.projectName) ダッシュボード" } ?? "PJ ダッシュボード",
            subtitle: "誰が基礎・応用・開発・SUのどこに時間を使っているかを、週単位で揃えて見る場所。"
        ) {
            AMDOSStateNotice(state: store.state) { Task { await reload() } }
            if let bundle = store.bundle {
                workspaceHeader(bundle)
                weeklyAllocation(bundle)
                memberAllocation(bundle)
                effortEntry(bundle)
                HStack(alignment: .top, spacing: 14) {
                    milestones(bundle).frame(maxWidth: .infinity, alignment: .top)
                    evidenceCoverage(bundle).frame(maxWidth: .infinity, alignment: .top)
                }
                weeklyTrend(bundle)
                if let message = store.message?.trimmedNonEmpty {
                    Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                }
            }
        }
        .task(id: projectID) { await reload() }
    }

    @ViewBuilder
    private func workspaceHeader(_ bundle: AMDOSProjectWorkspaceBundle) -> some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            AMDOSStatusBadge(text: "研究開発マネジメント", tint: AMDOSDesign.success)
                            AMDOSStatusBadge(text: effectiveAccess?.scope == .project ? "参加PJ限定" : "PJ共有ビュー", tint: AMDOSDesign.muted)
                        }
                        Text(bundle.project.projectId).font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                        Text("\(bundle.project.projectName) ダッシュボード").font(.title2.weight(.bold))
                        if let clientName = bundle.project.clientName?.trimmedNonEmpty {
                            Text(clientName).font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                    Spacer()
                    HStack(spacing: 0) {
                        AMDOSMetricTile(label: "今週", value: amdOSWorkspaceWeekLabel(bundle.currentWeekStart), detail: "月曜日開始")
                        AMDOSMetricTile(label: "メンバー", value: "\(bundle.memberCount)人", detail: "参加設定済み")
                        AMDOSMetricTile(label: "抽出済み", value: "\(bundle.evidenceCount)件", detail: "活動集計")
                    }
                    .frame(maxWidth: 510)
                }
            }
        }
    }

    @ViewBuilder
    private func weeklyAllocation(_ bundle: AMDOSProjectWorkspaceBundle) -> some View {
        AMDOSSectionCard("研究からSUまでの時間配分", systemImage: "chart.bar.fill") {
            HStack(alignment: .firstTextBaseline) {
                Text("THIS WEEK").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.success)
                Spacer()
                Text("予定 \(amdOSWorkspaceHours(bundle.effort.plannedHours))h").font(.subheadline)
                Text("実績 \(amdOSWorkspaceHours(bundle.effort.actualHours))h").font(.headline)
            }
            AMDOSWorkspaceCategoryBand(categories: bundle.effort.categories, muted: !bundle.effort.hasEntries)
            if !bundle.effort.hasEntries {
                Label("今週の時間はまだ未確定。下の入力欄で予定と実績を入れると、この帯にそのまま反映されるよ。", systemImage: "calendar.badge.exclamationmark")
                    .font(.caption).foregroundStyle(AMDOSDesign.warning)
            }
        }
    }

    @ViewBuilder
    private func memberAllocation(_ bundle: AMDOSProjectWorkspaceBundle) -> some View {
        AMDOSSectionCard("メンバー別の現在地", systemImage: "person.3.fill") {
            ForEach(bundle.members) { member in
                VStack(alignment: .leading, spacing: 9) {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(member.codeName).font(.headline)
                                if member.isLead { AMDOSStatusBadge(text: "LEAD", tint: AMDOSDesign.success) }
                            }
                            Text([member.memberId, member.roleLabel].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · "))
                                .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 3) {
                            Text("予定 \(amdOSWorkspaceHours(member.plannedHours))h / 実績 \(amdOSWorkspaceHours(member.actualHours))h")
                                .font(.subheadline.weight(.medium))
                            Text("抽出活動 \(member.evidenceCount)件 · 最終活動 \(amdOSWorkspaceActivityDate(member.lastActivityAt))")
                                .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                    AMDOSWorkspaceCategoryBand(categories: member.categories, compact: true, muted: amdOSWorkspaceCategoryTotal(member.categories) == 0)
                }
                .padding(.vertical, 5)
                if member.id != bundle.members.last?.id { Divider() }
            }
        }
    }

    @ViewBuilder
    private func effortEntry(_ bundle: AMDOSProjectWorkspaceBundle) -> some View {
        AMDOSSectionCard("週次エフォートを確定", systemImage: "checkmark.seal.fill") {
            Text(effectiveAccess?.scope == .project ? "自分の予定・実績だけ更新できるよ。同じ週・メンバー・区分を保存すると上書きされる。" : "AMDメンバーはPJ全員分を更新できるよ。同じ週・メンバー・区分を保存すると上書きされる。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            HStack(alignment: .bottom, spacing: 10) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("メンバー").font(.caption)
                    Picker("メンバー", selection: $selectedMemberID) {
                        ForEach(selectableMembers) { member in Text(member.codeName).tag(member.memberId) }
                    }
                    .labelsHidden()
                    .frame(minWidth: 130)
                }
                VStack(alignment: .leading, spacing: 5) {
                    Text("週の開始").font(.caption)
                    DatePicker("週の開始", selection: $weekStart, displayedComponents: .date).labelsHidden()
                }
                VStack(alignment: .leading, spacing: 5) {
                    Text("区分").font(.caption)
                    Picker("区分", selection: $selectedCategory) {
                        ForEach(AMDOSWorkspaceEffortCategory.allCases) { category in Text(category.label).tag(category) }
                    }
                    .labelsHidden()
                    .frame(minWidth: 110)
                }
                AMDOSWorkspaceEntryField(title: "予定h", text: $plannedHours, width: 82)
                AMDOSWorkspaceEntryField(title: "実績h", text: $actualHours, width: 82)
                AMDOSWorkspaceEntryField(title: "メモ", text: $note, width: 200)
                Button(saving ? "保存中" : "保存", systemImage: "square.and.arrow.down") { Task { await save(bundle) } }
                    .buttonStyle(.borderedProminent)
                    .disabled(saving || selectedMemberID.isEmpty)
            }
        }
    }

    @ViewBuilder
    private func milestones(_ bundle: AMDOSProjectWorkspaceBundle) -> some View {
        AMDOSSectionCard("いま追っている成果", systemImage: "flag.checkered") {
            if bundle.milestones.isEmpty {
                Text("有効なマイルストーンはまだないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(bundle.milestones) { milestone in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(milestone.title).font(.subheadline.weight(.medium)).lineLimit(2)
                            Spacer()
                            Text("\(Int(milestone.progressPct.rounded()))%").font(.caption.monospacedDigit())
                        }
                        ProgressView(value: min(100, max(0, milestone.progressPct)) / 100).tint(AMDOSDesign.success)
                        Text("進捗 \(amdOSWorkspaceYmLabel(milestone.progressYm)) / 目標 \(amdOSWorkspaceYmLabel(milestone.targetYm))")
                            .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func evidenceCoverage(_ bundle: AMDOSProjectWorkspaceBundle) -> some View {
        let maximum = max(1, bundle.evidenceByMonth.map(\.count).max() ?? 1)
        AMDOSSectionCard("OSがすでに把握している活動", systemImage: "database") {
            HStack(alignment: .bottom, spacing: 10) {
                ForEach(bundle.evidenceByMonth) { item in
                    VStack(spacing: 5) {
                        Text("\(item.count)").font(.caption.monospacedDigit())
                        RoundedRectangle(cornerRadius: 3)
                            .fill(AMDOSDesign.blue)
                            .frame(height: max(4, 76 * CGFloat(item.count) / CGFloat(maximum)))
                        Text(amdOSWorkspaceYmLabel(item.ym)).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .bottom)
                }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(bundle.evidenceBySource) { source in
                        AMDOSStatusBadge(text: "\(amdOSWorkspaceSourceLabel(source.source)) \(source.count)", tint: AMDOSDesign.muted)
                    }
                }
            }
            Label("外部メンバーには件数と更新日の集計だけを共有。メール本文・生データ・AMD内部の報酬や戦略情報は返してないよ。", systemImage: "checkmark.seal")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
        }
    }

    @ViewBuilder
    private func weeklyTrend(_ bundle: AMDOSProjectWorkspaceBundle) -> some View {
        let trend = Array(bundle.weeklyTrend.suffix(6))
        let maximum = max(1, trend.flatMap { [$0.plannedHours, $0.actualHours] }.max() ?? 1)
        AMDOSSectionCard("予定と実績の推移", systemImage: "chart.xyaxis.line") {
            Text("SIX WEEK RHYTHM").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.warning)
            HStack(alignment: .bottom, spacing: 16) {
                ForEach(trend) { week in
                    VStack(spacing: 7) {
                        HStack(alignment: .bottom, spacing: 4) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(AMDOSDesign.blue.opacity(0.35))
                                .frame(width: 18, height: max(4, 96 * CGFloat(week.plannedHours) / CGFloat(maximum)))
                            RoundedRectangle(cornerRadius: 3)
                                .fill(AMDOSDesign.success)
                                .frame(width: 18, height: max(4, 96 * CGFloat(week.actualHours) / CGFloat(maximum)))
                        }
                        Text(amdOSWorkspaceWeekLabel(week.weekStart)).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .bottom)
                }
            }
            HStack(spacing: 14) {
                Label("予定", systemImage: "square.fill").font(.caption).foregroundStyle(AMDOSDesign.blue.opacity(0.55))
                Label("実績", systemImage: "square.fill").font(.caption).foregroundStyle(AMDOSDesign.success)
            }
        }
    }

    private func reload() async {
        await store.load(projectID: projectID)
        syncEntryDefaults()
    }

    private func syncEntryDefaults() {
        guard let bundle = store.bundle else { return }
        if let parsed = amdOSWorkspaceDate(bundle.currentWeekStart) { weekStart = parsed }
        if !selectableMembers.contains(where: { $0.memberId == selectedMemberID }) {
            selectedMemberID = selectableMembers.first?.memberId ?? effectiveAccess?.memberId ?? ""
        }
    }

    private func save(_ bundle: AMDOSProjectWorkspaceBundle) async {
        guard let planned = amdOSWorkspaceHoursInput(plannedHours), let actual = amdOSWorkspaceHoursInput(actualHours) else {
            store.message = "予定・実績は0〜168時間の数値で入力してね"
            return
        }
        saving = true
        defer { saving = false }
        await store.save(
            projectID: bundle.project.projectId,
            input: AMDOSProjectWorkspaceEffortInput(
                memberId: selectedMemberID,
                weekStart: amdOSWorkspaceDateString(weekStart),
                category: selectedCategory.rawValue,
                plannedHours: planned,
                actualHours: actual,
                note: note.trimmedNonEmpty
            )
        )
        if store.state == .loaded {
            plannedHours = ""
            actualHours = ""
            note = ""
            syncEntryDefaults()
        }
    }
}

struct AMDOSProjectWorkspaceRootView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    @State private var selectedProjectID: String?

    private var access: AMDOSProjectWorkspaceAccess? { auth.workspaceAccess }

    var body: some View {
        NavigationSplitView {
            List(selection: $selectedProjectID) {
                Section("参加PJ") {
                    ForEach(access?.projects ?? []) { project in
                        Label(project.projectName, systemImage: "flask.fill")
                            .tag(Optional(project.projectId))
                    }
                }
            }
            .navigationTitle("AMD OS")
        } detail: {
            if let projectID = selectedProjectID {
                AMDOSProjectWorkspaceView(projectID: projectID)
            } else {
                AMDOSProjectWorkspaceProjectListView { selectedProjectID = $0 }
            }
        }
        .toolbar {
            ToolbarItemGroup {
                Button("サインアウト", systemImage: "rectangle.portrait.and.arrow.right") { auth.signOut() }
            }
        }
        .task { applyAccessDefaults() }
        .onChange(of: auth.workspaceAccess?.projects) { _, _ in applyAccessDefaults() }
        .onChange(of: workspace.pendingRoute) { _, _ in applyPendingRoute() }
    }

    private func applyAccessDefaults() {
        guard selectedProjectID == nil, let projects = access?.projects else { return }
        if projects.count == 1 { selectedProjectID = projects.first?.projectId }
        applyPendingRoute()
    }

    private func applyPendingRoute() {
        guard let route = workspace.consumePendingRoute() else { return }
        switch route.screen {
        case .projectWorkspace:
            if let projectID = route.projectID, access?.projects.contains(where: { $0.projectId == projectID }) == true {
                selectedProjectID = projectID
            }
        case .myProjects:
            selectedProjectID = nil
        default:
            break
        }
    }
}

private struct AMDOSWorkspaceEntryField: View {
    let title: String
    @Binding var text: String
    let width: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption)
            TextField(title, text: $text)
                .textFieldStyle(.roundedBorder)
                .frame(width: width)
        }
    }
}

private struct AMDOSWorkspaceCategoryBand: View {
    let categories: [String: Double]
    var compact = false
    var muted = false

    var body: some View {
        let total = amdOSWorkspaceCategoryTotal(categories)
        GeometryReader { geometry in
            HStack(spacing: 0) {
                ForEach(AMDOSWorkspaceEffortCategory.allCases) { category in
                    let value = categories[category.rawValue] ?? 0
                    let fraction = total > 0 ? max(0.09, value / total) : 0.2
                    VStack(alignment: .leading, spacing: compact ? 1 : 3) {
                        Text(category.shortLabel).font(compact ? .caption2 : .caption.weight(.semibold))
                        if !compact { Text(total > 0 ? "\(amdOSWorkspaceHours(value))h" : "—").font(.caption) }
                    }
                    .foregroundStyle(muted ? AMDOSDesign.muted : .white)
                    .padding(.horizontal, compact ? 6 : 10)
                    .frame(width: geometry.size.width * fraction, height: compact ? 28 : 62, alignment: .leading)
                    .background(muted ? category.color.opacity(0.14) : category.color)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .frame(height: compact ? 28 : 62)
    }
}

private func amdOSWorkspaceCategoryTotal(_ categories: [String: Double]) -> Double {
    AMDOSWorkspaceEffortCategory.allCases.reduce(0) { $0 + (categories[$1.rawValue] ?? 0) }
}

private func amdOSWorkspaceHours(_ value: Double) -> String {
    value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
}

private func amdOSWorkspaceHoursInput(_ raw: String) -> Double? {
    let value = raw.trimmedNonEmpty.flatMap(Double.init) ?? 0
    guard value.isFinite, value >= 0, value <= 168 else { return nil }
    return (value * 100).rounded() / 100
}

private func amdOSWorkspaceDate(_ raw: String) -> Date? {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: raw)
}

private func amdOSWorkspaceDateString(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}

private func amdOSWorkspaceWeekLabel(_ raw: String) -> String {
    guard let date = amdOSWorkspaceDate(raw) else { return raw }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "ja_JP")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "M/d"
    return "\(formatter.string(from: date))〜"
}

private func amdOSWorkspaceActivityDate(_ raw: String?) -> String {
    guard let raw, raw.count >= 10 else { return "未取得" }
    let datePart = String(raw.prefix(10))
    guard let date = amdOSWorkspaceDate(datePart) else { return "未取得" }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "ja_JP")
    formatter.timeZone = TimeZone(identifier: "Asia/Tokyo")
    formatter.dateFormat = "M/d"
    return formatter.string(from: date)
}

private func amdOSWorkspaceYmLabel(_ ym: String?) -> String {
    guard let ym, ym.count >= 6 else { return "—" }
    return "\(Int(ym.suffix(2)) ?? 0)月"
}

private func amdOSWorkspaceSourceLabel(_ source: String) -> String {
    switch source {
    case "member_weekly": return "週次抽出"
    case "gmail": return "メール"
    case "calendar": return "カレンダー"
    case "gmeet": return "Meet"
    case "slack": return "Slack"
    case "notion": return "Notion"
    case "drive": return "Drive"
    case "inferred": return "既存情報から推定"
    case "manual": return "手入力"
    default: return source
    }
}
