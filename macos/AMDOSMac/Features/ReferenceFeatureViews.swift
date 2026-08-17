import SwiftUI
import Foundation

private enum AMDOSManualChatRole: String, Sendable {
    case user
    case assistant
}

private struct AMDOSManualChatSource: Codable, Hashable, Identifiable, Sendable {
    let slug: String
    let number: String
    let title: String

    var id: String { slug }
}

private struct AMDOSManualChatMessage: Identifiable, Sendable {
    let id: UUID
    let role: AMDOSManualChatRole
    let content: String
    let sources: [AMDOSManualChatSource]

    init(role: AMDOSManualChatRole, content: String, sources: [AMDOSManualChatSource] = []) {
        self.id = UUID()
        self.role = role
        self.content = content
        self.sources = sources
    }
}

private struct AMDOSManualChatRequest: Encodable, Sendable {
    struct HistoryMessage: Encodable, Sendable {
        let role: String
        let content: String
    }

    let question: String
    let currentSlug: String?
    let history: [HistoryMessage]
}

private struct AMDOSManualChatResponse: Decodable, Sendable {
    let reply: String?
    let error: String?
    let sources: [AMDOSManualChatSource]?
}

private struct AMDOSManualLibraryChapter: Identifiable, Sendable {
    let slug: String
    let title: String
    let content: String

    var id: String { slug }
}

@MainActor
private final class AMDOSReferenceStore: ObservableObject {
    @Published var hud: AMDOSHUDResponse?
    @Published var document: AMDOSDocumentContentResponse?
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var askState: AMDOSFeatureLoadState = .idle
    @Published private(set) var manualChapters: [AMDOSManualLibraryChapter] = []
    @Published private(set) var manualMessages: [AMDOSManualChatMessage] = [
        AMDOSManualChatMessage(
            role: .assistant,
            content: "OSマニュアルの中から探して答えるよ。画面名・テーブル名・運用ルールをそのまま聞いてね。"
        )
    ]

    func loadHUD() async {
        state = .loading
        do {
            hud = try await AMDOSRESTClient.shared.fetchPWA(AMDOSHUDResponse.self, path: "/api/hud/dashboard")
            state = hud == nil ? .empty : .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func loadDocument(kind: String, slug: String? = nil) async {
        state = .loading
        do {
            var query = ["kind": kind]
            if let slug, !slug.isEmpty { query["slug"] = slug }
            document = try await AMDOSRESTClient.shared.fetchPWA(AMDOSDocumentContentResponse.self, path: "/api/macos/document", query: query)
            let hasContent = document?.content?.isEmpty == false
            let hasChapters = document?.chapters?.isEmpty == false
            state = hasContent || hasChapters ? .loaded : .empty
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    /// PWA `/manual` と同じ本文検索をNativeでも成立させるため、既存の
    /// `/api/macos/document?kind=manual` bridge から全章を読む。別データや書込みは増やさない。
    func loadManualLibrary() async {
        state = .loading
        do {
            let index = try await AMDOSRESTClient.shared.fetchPWA(
                AMDOSDocumentContentResponse.self,
                path: "/api/macos/document",
                query: ["kind": "manual"]
            )
            let slugs = amdOSManualOrderedSlugs(index.chapters ?? [])
            var loaded: [AMDOSManualLibraryChapter] = []
            for slug in slugs {
                let response = try await AMDOSRESTClient.shared.fetchPWA(
                    AMDOSDocumentContentResponse.self,
                    path: "/api/macos/document",
                    query: ["kind": "manual", "slug": slug]
                )
                guard let content = response.content, !content.isEmpty else { continue }
                loaded.append(.init(slug: slug, title: response.title?.trimmedNonEmpty ?? amdOSManualTitle(from: content, fallback: slug), content: content))
            }
            manualChapters = loaded
            state = loaded.isEmpty ? .empty : .loaded
        } catch {
            manualChapters = []
            state = .failed(error.localizedDescription)
        }
    }

    func resetManualConversation() {
        manualMessages = [
            AMDOSManualChatMessage(
                role: .assistant,
                content: "新しい質問きかせて。OSマニュアル本文を根拠にして、見に行く章リンクまで返すね。"
            )
        ]
        askState = .idle
    }

    func askManual(question: String, currentSlug: String?) async {
        askState = .loading
        let userMessage = AMDOSManualChatMessage(role: .user, content: question)
        let history = (manualMessages + [userMessage]).suffix(6).map {
            AMDOSManualChatRequest.HistoryMessage(role: $0.role.rawValue, content: $0.content)
        }
        manualMessages.append(userMessage)
        do {
            let response = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/manual/tsukuyomi/ask",
                body: AMDOSManualChatRequest(
                    question: question,
                    currentSlug: currentSlug?.trimmedNonEmpty,
                    history: history
                )
            )
            let decoded = try JSONDecoder().decode(AMDOSManualChatResponse.self, from: response)
            if let error = decoded.error?.trimmedNonEmpty { throw AMDOSNetworkError.http(error) }
            guard let reply = decoded.reply?.trimmedNonEmpty else {
                askState = .empty
                return
            }
            manualMessages.append(
                AMDOSManualChatMessage(role: .assistant, content: reply, sources: decoded.sources ?? [])
            )
            askState = .loaded
        } catch {
            let message = error.localizedDescription
            manualMessages.append(AMDOSManualChatMessage(role: .assistant, content: "通信に失敗した: \(message)"))
            askState = .failed(message)
        }
    }
}

private func amdOSPercentage(_ value: Double?) -> String {
    guard let value else { return "—" }
    return String(format: "%.0f", value)
}

private struct AMDOSHUDSparkline: View {
    let values: [Double]
    let tint: Color
    var body: some View {
        Canvas { context, size in
            guard values.count > 1 else { return }
            let maxValue = max(values.max() ?? 1, 1)
            let minValue = values.min() ?? 0
            let range = max(maxValue - minValue, 1)
            var path = Path()
            for (index, value) in values.enumerated() {
                let x = size.width * CGFloat(index) / CGFloat(values.count - 1)
                let y = size.height - ((CGFloat(value - minValue) / CGFloat(range)) * (size.height - 4)) - 2
                if index == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
            }
            context.stroke(path, with: .color(tint), lineWidth: 2)
        }
        .frame(height: 42)
    }
}

private struct AMDOSHUDScoreRing: View {
    let value: Double?
    let label: String
    let tint: Color
    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.16), lineWidth: 8)
            Circle().trim(from: 0, to: CGFloat(min(max(value ?? 0, 0), 100) / 100)).stroke(tint, style: StrokeStyle(lineWidth: 8, lineCap: .round)).rotationEffect(.degrees(-90))
            VStack(spacing: 2) { Text(amdOSPercentage(value)); Text(label).font(.caption2).foregroundStyle(AMDOSDesign.muted) }
        }.frame(width: 92, height: 92)
    }
}

struct AMDOSHUDDashboardView: View {
    @StateObject private var store = AMDOSReferenceStore()
    var body: some View {
        AMDOSPageScaffold(eyebrow: "HUD DASHBOARD", title: "HUDダッシュボード", subtitle: "PWA /hud/dashboard のプロジェクト信号・請求進捗・Management Score") {
            AMDOSStateNotice(state: store.state) { Task { await store.loadHUD() } }
            if let hud = store.hud {
                let latest = hud.managementScore
                HStack(spacing: 14) {
                    AMDOSMetricTile(label: "PJ", value: "\(hud.projects.count)", detail: hud.ym ?? "—")
                    AMDOSMetricTile(label: "評価履歴", value: "\(hud.managementHistory.count)", detail: "月次スナップショット")
                    AMDOSMetricTile(label: "現行SPS", value: "\(hud.currentSps?.filter { $0.status == "assessed" }.count ?? 0)", detail: "sps-ind-v1")
                    AMDOSMetricTile(label: "請求", value: "\(hud.billingStatus.count)", detail: "現在月の状態")
                }
                AMDOSSectionCard("Management Score", systemImage: "gauge.with.dots.needle.67percent") {
                    HStack(spacing: 24) {
                        AMDOSHUDScoreRing(value: latest?.totalScore, label: "TOTAL", tint: AMDOSDesign.blue)
                        VStack(alignment: .leading, spacing: 8) {
                            Text(latest?.summary ?? "最新スナップショット").font(.headline)
                            Text("\(latest?.ym ?? hud.ym ?? "—") · 信頼度 \(amdOSPercentage(latest?.confidence))").font(.caption).foregroundStyle(AMDOSDesign.muted)
                            HStack(spacing: 12) {
                                AMDOSMetricTile(label: "INIT", value: amdOSPercentage(latest?.initiativeScore), detail: "initiative")
                                AMDOSMetricTile(label: "FIN", value: amdOSPercentage(latest?.financeScore), detail: "finance")
                                AMDOSMetricTile(label: "DIR", value: amdOSPercentage(latest?.directionScore), detail: "direction")
                            }
                        }
                    }
                }
                AMDOSSectionCard("プロジェクト現行SPS", systemImage: "scope") {
                    ForEach(hud.projects) { project in
                        let assessment = hud.currentSps?.first { $0.projectId == project.id }
                        AMDOSCard {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack { Text(project.projectName).font(.headline); Spacer(); AMDOSStatusBadge(text: project.status ?? "—") }
                                Text([project.clientName, project.startYm.map { "開始 \($0)" }, project.endYm.map { "終了 \($0)" }].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                                HStack { AMDOSMetricTile(label: "現行SPS", value: assessment?.status == "assessed" ? bandText(assessment) : "最新版未評価", detail: assessment?.assessmentId ?? "none", tint: assessment?.status == "assessed" ? AMDOSDesign.success : AMDOSDesign.warning); AMDOSMetricTile(label: "根拠Lv", value: "Lv\(assessment?.evidenceLevel ?? 0)", detail: "産業創出価値") }
                            }
                        }
                    }
                }
            }
        }.task { await store.loadHUD() }
    }
}

// MARK: - Public HUD embed

/// PWA `/hud/dashboard/embed` と同じ、未ログインでもRLSが返せる範囲だけを読むDTO。
/// 通常HUDの集約APIは管理スコアを含みBearer必須なので、公開routeから呼ばない。
private struct AMDOSHUDEmbedProject: Decodable, Identifiable, Sendable {
    let projectID: String
    let projectName: String
    let clientName: String?
    let status: String?
    let projectCategory: String?
    let startYM: String?
    let endYM: String?

    enum CodingKeys: String, CodingKey {
        case projectID = "project_id"
        case projectName = "project_name"
        case clientName = "client_name"
        case status
        case projectCategory = "project_category"
        case startYM = "start_ym"
        case endYM = "end_ym"
    }

    var id: String { projectID }
}

private struct AMDOSHUDEmbedBillingCycle: Decodable, Sendable {
    let projectID: String
    let ym: String
    let status: String?
    let budgetYen: Double?
    let meetingStartAt: String?
    let reportFixedAt: String?
    let invoiceSentAt: String?
    let paymentConfirmedAt: String?

    enum CodingKeys: String, CodingKey {
        case projectID = "project_id"
        case ym, status
        case budgetYen = "budget_yen"
        case meetingStartAt = "meeting_start_at"
        case reportFixedAt = "report_fixed_at"
        case invoiceSentAt = "invoice_sent_at"
        case paymentConfirmedAt = "payment_confirmed_at"
    }
}

private struct AMDOSHUDEmbedReport: Decodable, Sendable {
    let projectID: String
    let status: String?
    let fixedAt: String?
    let finalContent: String?

    enum CodingKeys: String, CodingKey {
        case projectID = "project_id"
        case status
        case fixedAt = "fixed_at"
        case finalContent = "final_content"
    }
}

private struct AMDOSHUDEmbedBillingStatus: Sendable {
    let ym: String
    let status: String
    let budgetYen: Double?
    let meetingDone: Bool
    let reportDone: Bool
    let invoiceDone: Bool
    let paymentDone: Bool
}

private func amdOSHUDEmbedCurrentYM() -> String {
    let components = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: Date())
    return String(format: "%04d%02d", components.year ?? 0, components.month ?? 0)
}

@MainActor
private final class AMDOSHUDEmbedStore: ObservableObject {
    @Published private(set) var projects: [AMDOSHUDEmbedProject] = []
    @Published private(set) var billingByProject: [String: AMDOSHUDEmbedBillingStatus] = [:]
    @Published private(set) var ym = amdOSHUDEmbedCurrentYM()
    @Published var state: AMDOSFeatureLoadState = .idle

    func load() async {
        state = .loading
        let targetYM = amdOSHUDEmbedCurrentYM()
        do {
            async let projectsRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSHUDEmbedProject.self,
                table: "projects",
                select: "project_id,project_name,client_name,status,project_category,start_ym,end_ym",
                order: "project_name"
            )
            async let billingRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSHUDEmbedBillingCycle.self,
                table: "billing_cycles",
                select: "project_id,ym,status,budget_yen,meeting_start_at,report_fixed_at,invoice_sent_at,payment_confirmed_at",
                filters: ["ym": "eq.\(targetYM)"]
            )
            async let reportRequest = AMDOSRESTClient.shared.fetchTable(
                AMDOSHUDEmbedReport.self,
                table: "monthly_reports",
                select: "project_id,status,fixed_at,final_content",
                filters: ["ym": "eq.\(targetYM)"]
            )

            let loadedProjects = try await projectsRequest
            let cycles = try await billingRequest
            let reports = try await reportRequest
            let fixedReports = Set(
                reports
                    .filter { report in
                        report.fixedAt?.trimmedNonEmpty != nil
                            || report.status?.lowercased() == "fixed"
                            || report.finalContent?.trimmedNonEmpty != nil
                    }
                    .map(\.projectID)
            )

            var nextBilling: [String: AMDOSHUDEmbedBillingStatus] = [:]
            for cycle in cycles {
                nextBilling[cycle.projectID] = AMDOSHUDEmbedBillingStatus(
                    ym: cycle.ym,
                    status: cycle.status ?? "",
                    budgetYen: cycle.budgetYen,
                    meetingDone: cycle.meetingStartAt?.trimmedNonEmpty != nil,
                    reportDone: cycle.reportFixedAt?.trimmedNonEmpty != nil || fixedReports.contains(cycle.projectID),
                    invoiceDone: cycle.invoiceSentAt?.trimmedNonEmpty != nil,
                    paymentDone: cycle.paymentConfirmedAt?.trimmedNonEmpty != nil
                )
            }

            ym = targetYM
            projects = loadedProjects
            billingByProject = nextBilling
            state = loadedProjects.isEmpty ? .empty : .loaded
        } catch {
            projects = []
            billingByProject = [:]
            state = .failed(error.localizedDescription)
        }
    }
}

/// 埋め込み用はPWAと同じ匿名RLS queryだけで構成する。通常HUDのBearer APIや
/// Management Scoreは混ぜないため、公開routeから内部情報を増やさない。
struct AMDOSHUDEmbedDashboardView: View {
    @StateObject private var store = AMDOSHUDEmbedStore()

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "HUD EMBED",
            title: "AMD OS HUD",
            subtitle: "公開埋め込み。PWAと同じRLSで読めるPJと今月の進捗だけを表示"
        ) {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if !store.projects.isEmpty {
                HStack(spacing: 14) {
                    AMDOSMetricTile(label: "PJ", value: "\(store.projects.count)", detail: store.ym)
                    AMDOSMetricTile(label: "会議済", value: "\(store.billingByProject.values.filter(\.meetingDone).count)", detail: "今月")
                    AMDOSMetricTile(label: "報告済", value: "\(store.billingByProject.values.filter(\.reportDone).count)", detail: "今月")
                    AMDOSMetricTile(label: "入金済", value: "\(store.billingByProject.values.filter(\.paymentDone).count)", detail: "今月")
                }
                ForEach(store.projects) { project in
                    let billing = store.billingByProject[project.projectID]
                    AMDOSSectionCard(project.projectName, systemImage: "rectangle.3.group.fill") {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text([project.clientName, project.projectCategory, project.startYM.map { "開始 \($0)" }, project.endYM.map { "終了 \($0)" }].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · "))
                                    .font(.caption)
                                    .foregroundStyle(AMDOSDesign.muted)
                                if let billing, let budget = billing.budgetYen {
                                    Text("今月予算 \(Int(budget).formatted())円")
                                        .font(.caption)
                                        .foregroundStyle(AMDOSDesign.muted)
                                }
                            }
                            Spacer()
                            AMDOSStatusBadge(text: project.status?.trimmedNonEmpty ?? "—")
                        }
                        if let billing {
                            HStack(spacing: 14) {
                                AMDOSHUDCheckRow(label: "会議", done: billing.meetingDone)
                                AMDOSHUDCheckRow(label: "報告", done: billing.reportDone)
                                AMDOSHUDCheckRow(label: "請求", done: billing.invoiceDone)
                                AMDOSHUDCheckRow(label: "入金", done: billing.paymentDone)
                            }
                        } else {
                            Text("\(store.ym)の請求サイクルはまだない").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                }
            }
        }
        .task { await store.load() }
    }
}

struct AMDOSHUDNotificationsView: View {
    @StateObject private var store = AMDOSReferenceStore()
    @State private var onlyIncomplete = true
    var body: some View {
        AMDOSPageScaffold(eyebrow: "HUD NOTIFICATIONS", title: "HUD通知", subtitle: "PWA HUDの請求・報告・支払状態をプロジェクト別に確認") {
            Toggle("未完了だけ", isOn: $onlyIncomplete)
            AMDOSStateNotice(state: store.state) { Task { await store.loadHUD() } }
            if let hud = store.hud {
                ForEach(hud.projects) { project in
                    let billing = hud.billingStatus[project.id]
                    let incomplete = billing.map { !($0.meetingDone == true && $0.reportDone == true && $0.invoiceDone == true && $0.paymentDone == true) } ?? true
                    if !onlyIncomplete || incomplete {
                        AMDOSSectionCard(project.projectName, systemImage: "bell.badge") {
                            HStack { AMDOSStatusBadge(text: project.status ?? "—"); Spacer(); Text(billing?.ym ?? hud.ym ?? "—").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                            AMDOSHUDCheckRow(label: "会議", done: billing?.meetingDone == true)
                            AMDOSHUDCheckRow(label: "予算", done: billing?.budgetDone == true)
                            AMDOSHUDCheckRow(label: "報告", done: billing?.reportDone == true)
                            AMDOSHUDCheckRow(label: "請求", done: billing?.invoiceDone == true)
                            AMDOSHUDCheckRow(label: "支払", done: billing?.paymentDone == true)
                        }
                    }
                }
            }
        }.task { await store.loadHUD() }
    }
}

private struct AMDOSHUDCheckRow: View {
    let label: String
    let done: Bool
    var body: some View { Label(label, systemImage: done ? "checkmark.circle.fill" : "exclamationmark.circle").foregroundStyle(done ? AMDOSDesign.success : AMDOSDesign.warning) }
}

struct AMDOSHUDProjectCockpitView: View {
    let projectId: String?
    @StateObject private var store = AMDOSReferenceStore()
    @State private var selectedId = ""
    var body: some View {
        AMDOSPageScaffold(eyebrow: "HUD COCKPIT", title: "HUDコックピット", subtitle: "選択したPJだけのスコア履歴・M/X/F・月次状態を深掘り") {
            AMDOSStateNotice(state: store.state) { Task { await store.loadHUD() } }
            if let hud = store.hud {
                Picker("PJ", selection: $selectedId) { ForEach(hud.projects) { Text($0.projectName).tag($0.id) } }
                    .onChange(of: selectedId) { _, _ in }
                if let project = hud.projects.first(where: { $0.id == selectedId }) ?? hud.projects.first {
                    let signal = hud.signalMetrics[project.id]
                    let billing = hud.billingStatus[project.id]
                    AMDOSSectionCard(project.projectName, systemImage: "rectangle.split.3x1") {
                        HStack { Text(project.clientName ?? "クライアント未登録"); Spacer(); AMDOSStatusBadge(text: project.status ?? "—") }
                        HStack { AMDOSHUDScoreRing(value: signal?.m, label: "M", tint: AMDOSDesign.blue); AMDOSHUDScoreRing(value: signal?.x, label: "X", tint: AMDOSDesign.blueDark); AMDOSHUDScoreRing(value: signal?.f, label: "F", tint: AMDOSDesign.success) }
                        Text("請求 \(billing?.invoiceYm ?? billing?.ym ?? hud.ym ?? "—") · \(billing?.status ?? "状態未取得")").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    AMDOSSectionCard("スコア推移", systemImage: "chart.xyaxis.line") { AMDOSHUDSparkline(values: hud.scoreHistory[project.id] ?? [], tint: AMDOSDesign.blue); Text("\(hud.scoreHistory[project.id]?.count ?? 0)件の正本履歴").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                }
            }
        }.task { await store.loadHUD(); if let projectId { selectedId = projectId } }
    }
}

struct AMDOSHUDAtlasView: View {
    @StateObject private var store = AMDOSReferenceStore()
    @State private var selectedMetric = "M"
    var body: some View {
        AMDOSPageScaffold(eyebrow: "HUD ATLAS", title: "HUD Atlas", subtitle: "PWA HUDから外部シグナルへ渡すM/X/Fレンズをプロジェクト横断で見る") {
            Picker("レンズ", selection: $selectedMetric) { Text("Market / M").tag("M"); Text("Execution / X").tag("X"); Text("Fit / F").tag("F") }.pickerStyle(.segmented)
            AMDOSStateNotice(state: store.state) { Task { await store.loadHUD() } }
            if let hud = store.hud {
                let keyPath: (AMDOSHUDSignalMetrics) -> Double = selectedMetric == "M" ? { $0.m } : selectedMetric == "X" ? { $0.x } : { $0.f }
                ForEach(hud.projects.sorted { keyPath(hud.signalMetrics[$0.id] ?? AMDOSHUDSignalMetrics(m: 0, x: 0, f: 0)) > keyPath(hud.signalMetrics[$1.id] ?? AMDOSHUDSignalMetrics(m: 0, x: 0, f: 0)) }) { project in
                    let value = keyPath(hud.signalMetrics[project.id] ?? AMDOSHUDSignalMetrics(m: 0, x: 0, f: 0))
                    AMDOSSectionCard(project.projectName, systemImage: "globe.americas") {
                        HStack { AMDOSHUDScoreRing(value: value, label: selectedMetric, tint: AMDOSDesign.blue); VStack(alignment: .leading) { Text(project.clientName ?? "クライアント未登録"); Text("正本の信号値をAtlasの観測レンズとして表示").font(.caption).foregroundStyle(AMDOSDesign.muted) } }
                    }
                }
            }
        }.task { await store.loadHUD() }
    }
}

struct AMDOSHUDSeedsView: View {
    @State private var rows: [AMDOSSeed] = []
    @State private var query = ""
    @State private var state: AMDOSFeatureLoadState = .idle
    var body: some View {
        AMDOSPageScaffold(eyebrow: "HUD SEEDS", title: "HUDシーズ", subtitle: "PWA seeds正本の探索状態・研究機関・評価をHUDから確認") {
            TextField("シーズ名・機関・状態", text: $query).textFieldStyle(.roundedBorder)
            AMDOSStateNotice(state: state) { load() }
            ForEach(rows.filter { query.isEmpty || [$0.title, $0.orgName, $0.discoveryStatus, $0.status].compactMap { $0 }.joined().localizedCaseInsensitiveContains(query) }) { seed in
                AMDOSSectionCard(seed.title, systemImage: "leaf") { Text([seed.orgName, seed.domainLane, seed.discoveryStatus].compactMap { $0 }.joined(separator: " · ")); AMDOSStatusBadge(text: seed.status); Text(seed.summary ?? "要約なし").font(.caption) }
            }
        }.task { load() }
    }
    private func load() { Task { state = .loading; do { rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSSeed.self, table: "seeds", select: "id,title,org_name,researcher_name,lab_name,summary,domain_lane,status,discovery_status,amd_rating,trl,amd_owner_member_id,updated_at", order: "updated_at.desc", limit: 500); state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
}

struct AMDOSHUDVCsView: View {
    @State private var rows: [AMDOSVC] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    var body: some View {
        AMDOSPageScaffold(eyebrow: "HUD VCS", title: "HUD VC", subtitle: "PWA vcs正本の投資段階・ファンド・連絡先をHUDレンズで確認") {
            AMDOSStateNotice(state: state) { load() }
            ForEach(rows) { vc in AMDOSSectionCard(vc.name, systemImage: "chart.line.uptrend.xyaxis") { Text([vc.type, vc.stageFocus?.joined(separator: ", ")].compactMap { $0 }.joined(separator: " · ")); Text(vc.thesis ?? "投資仮説なし"); Text("チケット \(vc.ticketMinJpy.map { String(Int($0)) } ?? "—") 〜 \(vc.ticketMaxJpy.map { String(Int($0)) } ?? "—")円").font(.caption).foregroundStyle(AMDOSDesign.muted); AMDOSStatusBadge(text: "rating \(vc.amdRating.map(String.init) ?? "—")") } }
        }.task { load() }
    }
    private func load() { Task { state = .loading; do { rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSVC.self, table: "vcs", select: "*", order: "updated_at.desc", limit: 500); state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
}

struct AMDOSHUDScoreRetrofitView: View {
    @State private var rows: [AMDOSScoreInput] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    var body: some View {
        AMDOSPageScaffold(eyebrow: "HUD SCORE RETROFIT", title: "HUD Score再計算", subtitle: "最新のAMD Score入力を確認してから、既存の認可済みrefresh処理を実行") {
            AMDOSStateNotice(state: state) { load() }
            Button("Score refreshを実行") { refresh() }.buttonStyle(.borderedProminent)
            if let message { Text(message).foregroundStyle(AMDOSDesign.warning) }
            ForEach(rows.prefix(50)) { row in AMDOSSectionCard(row.projectId, systemImage: "scope") { Text(row.evaluatedAt); Text("A \(amdOSPercentage(row.muA)) · I \(amdOSPercentage(row.muI)) · G \(amdOSPercentage(row.muG)) · TRL \(amdOSPercentage(row.trl))").font(.caption); Text(row.xrlNotes ?? row.frlNotes ?? "注記なし").font(.caption).foregroundStyle(AMDOSDesign.muted) } }
        }.task { load() }
    }
    private func load() { Task { state = .loading; do { rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSScoreInput.self, table: "amd_score_inputs", select: "id,project_id,evaluated_at,mu_a,mu_i,mu_g,trl,brl,grl,srl,hrl,frl,prs_potential,prs_r_net,xrl_notes,frl_notes", order: "evaluated_at.desc", limit: 200); state = rows.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
    private func refresh() { Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/cron/amd-score-l2-refresh", body: ["source": "macos-hud"]); message = "refreshを実行したよ"; load() } catch { message = error.localizedDescription } } }
}

@MainActor
private final class AMDOSCyberHUDStore: ObservableObject {
    @Published var hud: AMDOSHUDResponse?
    @Published var state: AMDOSFeatureLoadState = .idle
    func load() async { state = .loading; do { hud = try await AMDOSRESTClient.shared.fetchPWA(AMDOSHUDResponse.self, path: "/api/hud/dashboard"); state = hud?.projects.isEmpty == true ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } }
}

private struct AMDOSCyberCoordinateCanvas: View {
    let projects: [AMDOSHUDProject]
    let metrics: [String: AMDOSHUDSignalMetrics]
    let selectedId: String?
    let tint: Color
    let onSelect: (String) -> Void
    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                for index in 0...10 { let x = size.width * CGFloat(index) / 10; var line = Path(); line.move(to: CGPoint(x: x, y: 0)); line.addLine(to: CGPoint(x: x, y: size.height)); context.stroke(line, with: .color(tint.opacity(0.12)), lineWidth: 1) }
                for index in 0...7 { let y = size.height * CGFloat(index) / 7; var line = Path(); line.move(to: CGPoint(x: 0, y: y)); line.addLine(to: CGPoint(x: size.width, y: y)); context.stroke(line, with: .color(tint.opacity(0.12)), lineWidth: 1) }
                for (index, project) in projects.enumerated() {
                    let signal = metrics[project.id]
                    let x = size.width * CGFloat(signal?.x ?? Double(index + 1) * 12) / 100
                    let y = size.height * (1 - CGFloat(signal?.f ?? Double(index + 1) * 12) / 100)
                    let radius: CGFloat = selectedId == project.id ? 14 : 9
                    context.fill(Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)), with: .color(selectedId == project.id ? AMDOSDesign.warning : tint))
                    context.draw(Text(project.projectName).font(.caption2).foregroundStyle(.white), at: CGPoint(x: x, y: y - radius - 10))
                }
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onEnded { value in
                guard !projects.isEmpty else { return }
                let nearest = projects.min { lhs, rhs in
                    let l = metrics[lhs.id]; let r = metrics[rhs.id]
                    let lp = CGPoint(x: proxy.size.width * CGFloat(l?.x ?? 0) / 100, y: proxy.size.height * (1 - CGFloat(l?.f ?? 0) / 100))
                    let rp = CGPoint(x: proxy.size.width * CGFloat(r?.x ?? 0) / 100, y: proxy.size.height * (1 - CGFloat(r?.f ?? 0) / 100))
                    return hypot(lp.x - value.location.x, lp.y - value.location.y) < hypot(rp.x - value.location.x, rp.y - value.location.y)
                }
                if let nearest { onSelect(nearest.id) }
            })
        }
        .frame(minHeight: 300)
        .background(AMDOSDesign.ink.opacity(0.94), in: RoundedRectangle(cornerRadius: 14))
    }
}

struct AMDOSCyber3DLabView: View {
    @StateObject private var store = AMDOSCyberHUDStore()
    @State private var selectedId: String?
    var body: some View {
        AMDOSPageScaffold(eyebrow: "CYBER 3D LAB", title: "3D Lab", subtitle: "PWA Cyber3DLabのX/F/M空間を、Native Canvasの可操作プロットとして表示") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if let hud = store.hud {
                AMDOSCyberCoordinateCanvas(projects: hud.projects, metrics: hud.signalMetrics, selectedId: selectedId, tint: AMDOSDesign.blue) { selectedId = $0 }
                if let id = selectedId, let project = hud.projects.first(where: { $0.id == id }) {
                    AMDOSSectionCard(project.projectName, systemImage: "scope") { Text(project.clientName ?? "クライアント未登録"); Text("M \(amdOSPercentage(hud.signalMetrics[id]?.m)) / X \(amdOSPercentage(hud.signalMetrics[id]?.x)) / F \(amdOSPercentage(hud.signalMetrics[id]?.f))"); AMDOSHUDSparkline(values: hud.scoreHistory[id] ?? [], tint: AMDOSDesign.blue) }
                }
            }
        }.task { await store.load() }
    }
}

struct AMDOSCyberGlassCubeView: View {
    @StateObject private var store = AMDOSCyberHUDStore()
    @State private var selectedId = ""
    var body: some View {
        AMDOSPageScaffold(eyebrow: "CYBER GLASS CUBE", title: "Glass Cube", subtitle: "PWA Glass Cubeのプロジェクトキューブ選択とKPIを、実データでNative表示") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if let hud = store.hud {
                Picker("選択PJ", selection: $selectedId) { ForEach(hud.projects) { Text($0.projectName).tag($0.id) } }
                AMDOSGlassCubeCanvas(projects: hud.projects, selectedId: selectedId) { selectedId = $0 }
                if let project = hud.projects.first(where: { $0.id == selectedId }) {
                    let signal = hud.signalMetrics[project.id]
                    AMDOSSectionCard("選択中のCube", systemImage: "cube.transparent") { Text(project.projectName).font(.title3); Text(project.clientName ?? "クライアント未登録"); Text("M \(amdOSPercentage(signal?.m)) · X \(amdOSPercentage(signal?.x)) · F \(amdOSPercentage(signal?.f))"); AMDOSHUDSparkline(values: hud.scoreHistory[project.id] ?? [], tint: AMDOSDesign.success) }
                }
            }
        }.task { await store.load(); if let first = store.hud?.projects.first { selectedId = first.id } }
    }
}

private struct AMDOSGlassCubeCanvas: View {
    let projects: [AMDOSHUDProject]
    let selectedId: String
    let onSelect: (String) -> Void
    var body: some View {
        GeometryReader { proxy in
            HStack(alignment: .bottom, spacing: 16) {
                ForEach(Array(projects.enumerated()), id: \.element.id) { index, project in
                    let selected = selectedId == project.id
                    VStack(spacing: 6) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8).fill(AMDOSDesign.blue.opacity(selected ? 0.35 : 0.18)).overlay(RoundedRectangle(cornerRadius: 8).stroke(selected ? AMDOSDesign.success : AMDOSDesign.blue, lineWidth: selected ? 3 : 1))
                            VStack { Text(project.projectName.prefix(2)).font(.headline); Text(project.status ?? "—").font(.caption2) }
                        }.frame(width: max(64, (proxy.size.width - 80) / CGFloat(max(projects.count, 1))), height: CGFloat(78 + ((index * 17) % 85))).rotation3DEffect(.degrees(selected ? -6 : 6), axis: (x: 0, y: 1, z: 0)).onTapGesture { onSelect(project.id) }
                        Text(project.projectName).font(.caption2).lineLimit(1)
                    }
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom).padding()
        }.frame(minHeight: 300).background(LinearGradient(colors: [AMDOSDesign.ink, AMDOSDesign.blue.opacity(0.35)], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 14))
    }
}

struct AMDOSCyberHUDWallView: View {
    @StateObject private var store = AMDOSCyberHUDStore()
    @State private var selectedId = ""
    @State private var focus: String = "status"
    var body: some View {
        AMDOSPageScaffold(eyebrow: "CYBER HUD WALL", title: "HUD Wall", subtitle: "PWA HUD Wallのoverview / project切替とfocus dockを、横長Nativeペインに移植") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if let hud = store.hud {
                Picker("PJ", selection: $selectedId) { ForEach(hud.projects) { Text($0.projectName).tag($0.id) } }
                Picker("Focus", selection: $focus) { Text("STATUS").tag("status"); Text("MS").tag("ms"); Text("MONTHLY").tag("monthly"); Text("SIGNAL").tag("signal") }.pickerStyle(.segmented)
                if focus == "status" { AMDOSHUDWallStatus(hud: hud, selectedId: selectedId) }
                if focus == "ms" { AMDOSHUDWallMilestones(selectedId: selectedId) }
                if focus == "monthly" { AMDOSHUDWallMonthly(hud: hud, selectedId: selectedId) }
                if focus == "signal" { AMDOSHUDWallSignals(hud: hud, selectedId: selectedId) }
            }
        }.task { await store.load(); if let first = store.hud?.projects.first { selectedId = first.id } }
    }
}

private struct AMDOSHUDWallStatus: View {
    let hud: AMDOSHUDResponse
    let selectedId: String
    var body: some View { if let p = hud.projects.first(where: { $0.id == selectedId }) { AMDOSSectionCard("STATUS / \(p.projectName)", systemImage: "display") { HStack { AMDOSStatusBadge(text: p.status ?? "—"); Text(p.clientName ?? "クライアント未登録"); Spacer(); Text("PJ ID \(p.id)").font(.caption).foregroundStyle(AMDOSDesign.muted) }; AMDOSHUDSparkline(values: hud.scoreHistory[p.id] ?? [], tint: AMDOSDesign.blue) } } }
}

private struct AMDOSHUDWallMilestones: View {
    let selectedId: String
    @State private var milestones: [AMDOSMilestone] = []
    @State private var progress: [AMDOSMilestoneProgress] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    var body: some View { AMDOSSectionCard("MS / \(selectedId)", systemImage: "checklist") { AMDOSStateNotice(state: state) { load() }; ForEach(milestones) { milestone in let current = progress.filter { $0.milestoneKey == milestone.milestoneId }.max { $0.ym < $1.ym }; AMDOSLineItem(title: milestone.title, subtitle: milestone.successCriteria ?? "成功条件なし", status: current?.progressPct.map { "\(Int($0))%" } ?? "未記録") } }.task(id: selectedId) { load() } }
    private func load() { Task { state = .loading; do { milestones = try await AMDOSRESTClient.shared.fetchTable(AMDOSMilestone.self, table: "value_milestones", select: "id,milestone_id,plan_cycle_id,title,points,tag,goal_level,is_active,success_criteria,sort_order,target_ym", filters: ["is_active": "eq.true"], order: "sort_order"); progress = try await AMDOSRESTClient.shared.fetchTable(AMDOSMilestoneProgress.self, table: "milestone_monthly_progress", select: "id,milestone_key,ym,progress_pct,consumed_pt,source,note,confirmed_at", order: "ym.desc", limit: 500); state = milestones.isEmpty ? .empty : .loaded } catch { state = .failed(error.localizedDescription) } } }
}

private struct AMDOSHUDWallMonthly: View {
    let hud: AMDOSHUDResponse
    let selectedId: String
    var body: some View { let billing = hud.billingStatus[selectedId]; return AMDOSSectionCard("MONTHLY / \(selectedId)", systemImage: "calendar") { AMDOSHUDCheckRow(label: "会議", done: billing?.meetingDone == true); AMDOSHUDCheckRow(label: "予算", done: billing?.budgetDone == true); AMDOSHUDCheckRow(label: "報告", done: billing?.reportDone == true); AMDOSHUDCheckRow(label: "請求", done: billing?.invoiceDone == true); AMDOSHUDCheckRow(label: "支払", done: billing?.paymentDone == true); Text("\(billing?.ym ?? hud.ym ?? "—") · \(billing?.status ?? "状態未登録")").font(.caption).foregroundStyle(AMDOSDesign.muted) } }
}

private struct AMDOSHUDWallSignals: View {
    let hud: AMDOSHUDResponse
    let selectedId: String
    var body: some View { let m = hud.signalMetrics[selectedId]; return AMDOSSectionCard("SIGNAL / \(selectedId)", systemImage: "waveform.path.ecg") { HStack { AMDOSMetricTile(label: "M", value: amdOSPercentage(m?.m), detail: "market"); AMDOSMetricTile(label: "X", value: amdOSPercentage(m?.x), detail: "execution"); AMDOSMetricTile(label: "F", value: amdOSPercentage(m?.f), detail: "fit") }; AMDOSHUDSparkline(values: hud.scoreHistory[selectedId] ?? [], tint: AMDOSDesign.warning) } }
}

private struct AMDOSDocumentView: View {
    @ObservedObject var store: AMDOSReferenceStore
    let eyebrow: String
    let title: String
    let kind: String
    let initialSlug: String?
    let initialTopic: String?
    @State private var selectedSlug = ""
    @State private var selectedTopic = ""
    @State private var question = ""

    private var chapters: [AMDOSDocumentChapter] {
        if let chapterMeta = store.document?.chapterMeta, !chapterMeta.isEmpty { return chapterMeta }
        return (store.document?.chapters ?? []).map {
            AMDOSDocumentChapter(
                slug: $0,
                title: $0,
                summary: nil,
                number: nil,
                groupKey: nil,
                groupLabel: nil,
                groupDescription: nil,
                status: nil,
                level: nil,
                available: true
            )
        }
    }

    private var chapterGroups: [AMDOSDocumentChapterGroup] {
        var order: [String] = []
        var grouped: [String: [AMDOSDocumentChapter]] = [:]
        var labels: [String: String?] = [:]
        var descriptions: [String: String?] = [:]
        for chapter in chapters {
            let key = chapter.groupKey ?? "__all__"
            if grouped[key] == nil { order.append(key) }
            grouped[key, default: []].append(chapter)
            labels[key] = chapter.groupLabel
            descriptions[key] = chapter.groupDescription
        }
        return order.compactMap { key in
            grouped[key].map {
                AMDOSDocumentChapterGroup(
                    id: key,
                    label: labels[key] ?? nil,
                    description: descriptions[key] ?? nil,
                    chapters: $0
                )
            }
        }
    }

    private var selectedChapterIndex: Int? { chapters.firstIndex(where: { $0.slug == selectedSlug }) }

    var body: some View {
        AMDOSPageScaffold(eyebrow: eyebrow, title: title, subtitle: "PWAの正本markdownを章一覧から選び、同じslugで読む") {
            AMDOSStateNotice(state: store.state) { Task { await store.loadDocument(kind: kind, slug: selectedSlug.trimmedNonEmpty) } }
            if !chapters.isEmpty {
                HStack(alignment: .top, spacing: 16) {
                    documentSidebar.frame(width: 286, alignment: .topLeading)
                    Divider()
                    documentArticle.frame(maxWidth: .infinity, alignment: .topLeading)
                }
            } else {
                documentArticle
            }
            if kind == "manual" {
                AMDOSSectionCard("つくよみに聞く", systemImage: "moon.stars.fill") {
                    HStack {
                        Text("OSマニュアル限定")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AMDOSDesign.muted)
                        Spacer()
                        Button("会話を初期化") {
                            store.resetManualConversation()
                            question = ""
                        }
                        .buttonStyle(.bordered)
                    }
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 10) {
                            ForEach(store.manualMessages) { message in
                                VStack(alignment: message.role == .assistant ? .leading : .trailing, spacing: 6) {
                                    Text(message.role == .assistant ? "つくよみ" : "まさ")
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(message.role == .assistant ? AMDOSDesign.blue : AMDOSDesign.muted)
                                    AMDOSMarkdownContent(markdown: message.content)
                                        .padding(10)
                                        .frame(maxWidth: .infinity, alignment: message.role == .assistant ? .leading : .trailing)
                                        .background(message.role == .assistant ? AMDOSDesign.blue.opacity(0.07) : AMDOSDesign.ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    if !message.sources.isEmpty {
                                        HStack(spacing: 6) {
                                            ForEach(message.sources) { source in
                                                Button("\(source.number) \(source.title)") {
                                                    selectedSlug = source.slug
                                                    Task { await store.loadDocument(kind: kind, slug: source.slug) }
                                                }
                                                .buttonStyle(.bordered)
                                                .controlSize(.small)
                                            }
                                        }
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: message.role == .assistant ? .leading : .trailing)
                            }
                        }
                    }
                    .frame(minHeight: 180, maxHeight: 360)
                    HStack(alignment: .bottom, spacing: 8) {
                        AMDOSTextField(title: "質問", text: $question, axis: .vertical)
                        Button("送信") {
                            let value = question.trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !value.isEmpty else { return }
                            question = ""
                            Task { await store.askManual(question: value, currentSlug: selectedSlug.trimmedNonEmpty ?? initialSlug) }
                        }
                            .buttonStyle(.borderedProminent)
                            .disabled(question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    AMDOSStateNotice(state: store.askState) {
                        let value = question.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !value.isEmpty else { return }
                        Task { await store.askManual(question: value, currentSlug: selectedSlug.trimmedNonEmpty ?? initialSlug) }
                    }
                }
            }
        }.task { await bootstrap() }
    }
    private func bootstrap() async {
        await store.loadDocument(kind: kind, slug: initialSlug)
        if kind == "manual", let initialTopic, amdOSManualTopics.contains(where: { $0.key == initialTopic }) { selectedTopic = initialTopic }
        if let initialSlug, !initialSlug.isEmpty { selectedSlug = initialSlug }
        else if let chapter = chapters.first { selectedSlug = chapter.slug; await store.loadDocument(kind: kind, slug: chapter.slug) }
    }

    @ViewBuilder
    private var documentSidebar: some View {
        AMDOSSectionCard("章一覧", systemImage: "list.bullet.indent") {
            Text("PWAと同じ章の構成・順序・状態を表示。未着手のBZM章もここから開ける。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 9) {
                    ForEach(chapterGroups) { group in
                        if let label = group.label?.trimmedNonEmpty {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(label).font(.caption.weight(.semibold))
                                if let description = group.description?.trimmedNonEmpty {
                                    Text(description).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(3)
                                }
                            }
                            .padding(.top, group.id == chapterGroups.first?.id ? 0 : 7)
                        }
                        ForEach(group.chapters) { chapter in
                            Button { open(chapter.slug) } label: {
                                HStack(alignment: .top, spacing: 6) {
                                    if let number = chapter.number?.trimmedNonEmpty {
                                        Text(number).font(.caption2.monospacedDigit()).foregroundStyle(AMDOSDesign.muted).frame(width: 24, alignment: .leading)
                                    }
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(chapter.title).font(.caption.weight(chapter.level == 1 ? .semibold : .regular)).multilineTextAlignment(.leading)
                                        if !chapter.available || chapter.status?.trimmedNonEmpty != nil {
                                            Text(chapterStatusLabel(chapter)).font(.caption2).foregroundStyle(chapter.available ? AMDOSDesign.muted : AMDOSDesign.warning)
                                        }
                                    }
                                    Spacer(minLength: 0)
                                }
                                .padding(.leading, CGFloat(max((chapter.level ?? 1) - 1, 0)) * 11)
                                .padding(.vertical, 3)
                                .padding(.horizontal, 4)
                                .background(selectedSlug == chapter.slug ? AMDOSDesign.blue.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 5))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .frame(maxHeight: 620)
        }
    }

    @ViewBuilder
    private var documentArticle: some View {
        if let content = store.document?.content, !content.isEmpty {
            if store.document?.isStub == true {
                AMDOSCard {
                    Label("執筆待機中", systemImage: "pencil.line")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AMDOSDesign.warning)
                    Text("PWAと同じ未着手章。本文が追加されるまで、章の概要と完成済み章を確認できる。")
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
            }
            AMDOSSectionCard(store.document?.title ?? selectedSlug, systemImage: "book.closed") {
                AMDOSMarkdownContent(markdown: content)
            }
            documentPreviousNext
        } else if store.state == .loaded {
            ContentUnavailableView("章を選択", systemImage: "book.closed", description: Text("左の章一覧から本文を開いてね。"))
        }
    }

    @ViewBuilder
    private var documentPreviousNext: some View {
        if let index = selectedChapterIndex {
            HStack {
                if index > 0 {
                    Button("← \(chapters[index - 1].title)") { open(chapters[index - 1].slug) }
                        .buttonStyle(.link)
                }
                Spacer()
                if index < chapters.count - 1 {
                    Button("\(chapters[index + 1].title) →") { open(chapters[index + 1].slug) }
                        .buttonStyle(.link)
                }
            }
            .font(.caption)
        }
    }

    private func open(_ slug: String) {
        selectedSlug = slug
        Task { await store.loadDocument(kind: kind, slug: slug) }
    }

    private func chapterStatusLabel(_ chapter: AMDOSDocumentChapter) -> String {
        if !chapter.available { return "執筆待機中" }
        switch chapter.status {
        case "completed": return "完成"
        case "in-progress": return "執筆中"
        case "legacy": return "旧版"
        case "not-started": return "執筆待機中"
        default: return "本文あり"
        }
    }
}

private struct AMDOSDocumentChapterGroup: Identifiable {
    let id: String
    let label: String?
    let description: String?
    let chapters: [AMDOSDocumentChapter]
}

private struct AMDOSManualTopic { let key: String; let label: String; let description: String; let chapterSlugs: [String] }
private let amdOSManualTopics: [AMDOSManualTopic] = [
    .init(key: "start", label: "まず触る", description: "最初にOSの目的と日常画面を掴む。", chapterSlugs: ["1-1-intro", "2-1-member-quick-start", "2-2-member-workflows-quick-start", "2-3-pj-cockpit", "2-4-amd-cockpit", "2-8-business-cards"]),
    .init(key: "cockpit", label: "PJを見る", description: "PJ状況・MS・XRL・卒業準備度を判断する。", chapterSlugs: ["2-3-pj-cockpit", "4-3-amd-score-spec", "4-8-ms-progress-monthly-report-revision-spec", "4-7-venture-status-narrative-pl-xrl-spec", "8-2-notification-review-and-strategy-signals-spec", "4-6-graduation-detection-spec"]),
    .init(key: "monthly", label: "月次オペ", description: "請求・入金・支払通知書・報酬の流れ。", chapterSlugs: ["2-6-admin-ops", "2-2-member-workflows-quick-start", "6-3-invoice-and-billing-routine-spec", "6-4-finance-payment-confirm-spec", "6-5-admin-payouts-reward-notice-spec", "6-6-member-billing-prompts-spec", "6-7-contracts-management-spec", "7-1-reward-calc-spec"]),
    .init(key: "decision", label: "経営判断", description: "Atlas・AMD Score・XRL・Management Scoreをつなげる。", chapterSlugs: ["4-1-atlas-protocol-score-macrotrend", "4-2-atlas-macrotrend-signal-spec", "4-3-amd-score-spec", "4-4-frl-related-members-score-spec", "4-5-management-score-and-finance-simulation-spec", "4-6-graduation-detection-spec", "4-7-venture-status-narrative-pl-xrl-spec", "4-9-institution-ers-spec", "8-2-notification-review-and-strategy-signals-spec"]),
    .init(key: "discovery", label: "外部探索", description: "Atlas・Seeds・VC・Scholar・Venture Map。", chapterSlugs: ["2-5-research-assets-quick-start", "4-2-atlas-macrotrend-signal-spec", "5-1-research-assets-vc-seeds-scholar-spec", "5-2-hud-and-venture-map-spec", "4-9-institution-ers-spec"]),
    .init(key: "knowledge", label: "知識・通知", description: "5生データ・L2・通知・つくよみ学習。", chapterSlugs: ["3-2-data-and-extraction", "3-3-notifications-and-tsukuyomi", "8-1-knowledge-admin-tsukuyomi-spec", "8-2-notification-review-and-strategy-signals-spec", "8-3-l2-extraction-routines-spec"]),
    .init(key: "admin", label: "Admin設定", description: "台帳・設定・請求・支払の運用。", chapterSlugs: ["2-6-admin-ops", "2-2-member-workflows-quick-start"]),
    .init(key: "system", label: "OSの構造", description: "画面・データ・通知・判断・月次の関係。", chapterSlugs: ["1-1-intro", "3-3-notifications-and-tsukuyomi", "4-1-atlas-protocol-score-macrotrend", "2-6-admin-ops", "6-2-admin-projects-members-ledger-spec"]),
    .init(key: "developer", label: "設計・開発", description: "全体設計・抽出routine・過去判断・開発手順。", chapterSlugs: ["3-1-system-architecture", "3-2-data-and-extraction", "4-2-atlas-macrotrend-signal-spec", "5-1-research-assets-vc-seeds-scholar-spec", "4-5-management-score-and-finance-simulation-spec", "4-6-graduation-detection-spec", "4-4-frl-related-members-score-spec", "4-8-ms-progress-monthly-report-revision-spec", "4-7-venture-status-narrative-pl-xrl-spec", "8-3-l2-extraction-routines-spec", "9-1-decisions-and-history", "9-2-developer"]),
    .init(key: "system-dev", label: "内部構造", description: "画面・DB・cron・書き込み経路。", chapterSlugs: ["3-1-system-architecture", "3-2-data-and-extraction", "6-1-operations-settings-spec", "4-2-atlas-macrotrend-signal-spec", "5-1-research-assets-vc-seeds-scholar-spec", "5-2-hud-and-venture-map-spec", "9-1-decisions-and-history", "9-2-developer"]),
    .init(key: "knowledge-dev", label: "抽出・復旧", description: "L2抽出・automation・outbox/applier・復旧手順。", chapterSlugs: ["3-2-data-and-extraction", "8-3-l2-extraction-routines-spec", "3-3-notifications-and-tsukuyomi", "8-1-knowledge-admin-tsukuyomi-spec", "8-2-notification-review-and-strategy-signals-spec", "4-8-ms-progress-monthly-report-revision-spec"]),
    .init(key: "admin-dev", label: "運用内部", description: "Settings・Run Now・運用事故。", chapterSlugs: ["6-1-operations-settings-spec", "6-2-admin-projects-members-ledger-spec", "6-3-invoice-and-billing-routine-spec", "6-4-finance-payment-confirm-spec", "6-5-admin-payouts-reward-notice-spec", "6-6-member-billing-prompts-spec", "7-1-reward-calc-spec", "8-1-knowledge-admin-tsukuyomi-spec", "4-5-management-score-and-finance-simulation-spec", "9-1-decisions-and-history"])
]

private struct AMDOSManualSection: Identifiable {
    let key: String
    let label: String
    let description: String
    let slugs: [String]
    var id: String { key }
}

/// `pwa/src/app/(app)/manual/manual-chapters.ts` の MANUAL_SECTIONS と同じ並び。
/// 章本文はPWAのgit管理MarkdownをAPI bridge越しに読み、ここには目次の構造だけを置く。
private let amdOSManualSections: [AMDOSManualSection] = [
    .init(key: "entry", label: "入口", description: "AMD OS の目的、想定ユーザー、読み方。", slugs: ["1-1-intro"]),
    .init(key: "usage", label: "まず使う人向け", description: "画面の見方、日常業務、admin運用をざっくり掴む章。", slugs: ["2-1-member-quick-start", "2-2-member-workflows-quick-start", "2-3-pj-cockpit", "2-4-amd-cockpit", "2-5-research-assets-quick-start", "2-6-admin-ops", "2-8-business-cards"]),
    .init(key: "architecture", label: "OS の基本構造", description: "画面、データ、L2、通知、正本反映ゲートの地図。", slugs: ["3-1-system-architecture", "3-2-data-and-extraction", "3-3-notifications-and-tsukuyomi"]),
    .init(key: "decision", label: "経営判断エンジン", description: "Atlas、AMD Protocol、AMD Score、XRL、Management Score、卒業検出など判断ロジックの章。", slugs: ["4-1-atlas-protocol-score-macrotrend", "4-2-atlas-macrotrend-signal-spec", "4-3-amd-score-spec", "4-4-frl-related-members-score-spec", "4-5-management-score-and-finance-simulation-spec", "4-6-graduation-detection-spec", "4-7-venture-status-narrative-pl-xrl-spec", "4-8-ms-progress-monthly-report-revision-spec", "4-9-institution-ers-spec"]),
    .init(key: "assets", label: "外部探索・事業アセット", description: "Seeds、VC、Scholar、Venture Map、HUD など外部探索と事業化アセットの章。", slugs: ["5-1-research-assets-vc-seeds-scholar-spec", "5-2-hud-and-venture-map-spec"]),
    .init(key: "admin-finance", label: "Admin / Finance / 月次オペ", description: "設定、台帳、請求、入金確認、支払通知書、メンバー向け運用の仕様。", slugs: ["6-1-operations-settings-spec", "6-2-admin-projects-members-ledger-spec", "6-3-invoice-and-billing-routine-spec", "6-4-finance-payment-confirm-spec", "6-5-admin-payouts-reward-notice-spec", "6-6-member-billing-prompts-spec", "6-7-contracts-management-spec", "6-8-admin-ms-overview-spec"]),
    .init(key: "reward-contract", label: "報酬・契約", description: "メンバー報酬がどう決まるか (= 計算ロジック正本)。", slugs: ["7-1-reward-calc-spec"]),
    .init(key: "knowledge-automation", label: "Knowledge / Automation", description: "Knowledge Admin、つくよみ、通知レビュー、経営ハイライト、L2 抽出 routine の仕様。", slugs: ["8-1-knowledge-admin-tsukuyomi-spec", "8-2-notification-review-and-strategy-signals-spec", "8-3-l2-extraction-routines-spec"]),
    .init(key: "developer-history", label: "開発者・履歴", description: "開発手順、過去判断、事故ログ、設計 md の読み方。", slugs: ["9-1-decisions-and-history", "9-2-developer", "9-3-appendix-changelog"]),
]

private struct AMDOSManualSearchResult: Identifiable {
    let chapter: AMDOSManualLibraryChapter
    let score: Int
    let snippet: String
    var id: String { chapter.id }
}

private struct AMDOSManualSectionGroup: Identifiable {
    let section: AMDOSManualSection
    let chapters: [AMDOSManualLibraryChapter]
    var id: String { section.id }
}

private func amdOSManualOrderedSlugs(_ slugs: [String]) -> [String] {
    let order = Dictionary(uniqueKeysWithValues: amdOSManualSections.enumerated().flatMap { sectionIndex, section in
        section.slugs.enumerated().map { chapterIndex, slug in (slug, sectionIndex * 100 + chapterIndex) }
    })
    return slugs.sorted { left, right in
        let leftOrder = order[left]
        let rightOrder = order[right]
        switch (leftOrder, rightOrder) {
        case let (.some(a), .some(b)): return a < b
        case (.some, .none): return true
        case (.none, .some): return false
        case (.none, .none): return left.localizedStandardCompare(right) == .orderedAscending
        }
    }
}

private func amdOSManualNumber(_ slug: String) -> String {
    for (sectionIndex, section) in amdOSManualSections.enumerated() {
        if let chapterIndex = section.slugs.firstIndex(of: slug) {
            return "\(sectionIndex + 1)-\(chapterIndex + 1)"
        }
    }
    return "--"
}

private func amdOSManualTitle(from markdown: String, fallback: String) -> String {
    let heading = markdown.split(separator: "\n").first(where: { $0.hasPrefix("# ") })
        .map { String($0.dropFirst(2)).trimmingCharacters(in: .whitespacesAndNewlines) }
    return heading?.trimmedNonEmpty ?? fallback
}

private func amdOSManualMarkdown(_ source: String, chapter: AMDOSManualLibraryChapter) -> String {
    let number = amdOSManualNumber(chapter.slug)
    var h2Index = 0
    return source.split(separator: "\n", omittingEmptySubsequences: false).map { rawLine in
        let line = String(rawLine)
        if line.hasPrefix("# ") { return "# \(number). \(chapter.title)" }
        if line.hasPrefix("## ") {
            h2Index += 1
            let heading = line.dropFirst(3).replacingOccurrences(of: "^\\d+(?:[.-]\\d+)+(?:[.)])?\\s+", with: "", options: .regularExpression)
            return "## \(number)-\(h2Index) \(heading)"
        }
        return line
    }
    .joined(separator: "\n")
}

private func amdOSManualSearch(_ chapters: [AMDOSManualLibraryChapter], query: String) -> [AMDOSManualSearchResult] {
    guard let cleanQuery = query.trimmedNonEmpty else { return [] }
    let normalizedQuery = cleanQuery.folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: .current)
    return chapters.compactMap { chapter in
        let title = chapter.title.folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: .current)
        let body = chapter.content.folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: .current)
        var score = 0
        if title.contains(normalizedQuery) { score += 80 }
        if body.contains(normalizedQuery) { score += 10 }
        guard score > 0 else { return nil }
        let compact = chapter.content.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        let snippet: String
        if let range = compact.range(of: cleanQuery, options: .caseInsensitive) {
            let prefix = compact[..<range.lowerBound].suffix(42)
            let suffix = compact[range.lowerBound...].prefix(118)
            snippet = "\(prefix.isEmpty ? "" : "...")\(prefix)\(suffix)\(suffix.count < compact.count ? "..." : "")"
        } else {
            snippet = String(compact.prefix(150))
        }
        return AMDOSManualSearchResult(chapter: chapter, score: score, snippet: snippet)
    }
    .sorted { left, right in
        left.score == right.score ? amdOSManualOrderedSlugs([left.chapter.slug, right.chapter.slug]).first == left.chapter.slug : left.score > right.score
    }
    .prefix(10)
    .map { $0 }
}

private struct AMDOSManualLibraryView: View {
    let initialSlug: String?
    let initialTopic: String?
    let showDirectory: Bool

    @StateObject private var store = AMDOSReferenceStore()
    @State private var selectedSlug = ""
    @State private var selectedTopic = ""
    @State private var query = ""
    @State private var question = ""
    @State private var expandedSectionKeys = Set(amdOSManualSections.map(\.key))

    private var chapterBySlug: [String: AMDOSManualLibraryChapter] {
        Dictionary(uniqueKeysWithValues: store.manualChapters.map { ($0.slug, $0) })
    }

    private var selectedChapter: AMDOSManualLibraryChapter? {
        chapterBySlug[selectedSlug]
    }

    private var searchResults: [AMDOSManualSearchResult] {
        amdOSManualSearch(store.manualChapters, query: query)
    }

    private var configuredSections: [AMDOSManualSectionGroup] {
        amdOSManualSections.map { section in
            AMDOSManualSectionGroup(section: section, chapters: section.slugs.compactMap { chapterBySlug[$0] })
        }
        .filter { !$0.chapters.isEmpty }
    }

    private var uncategorizedChapters: [AMDOSManualLibraryChapter] {
        let known = Set(amdOSManualSections.flatMap(\.slugs))
        return store.manualChapters.filter { !known.contains($0.slug) }
    }

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "MANUAL",
            title: "AMD OS マニュアル",
            subtitle: "PWAと同じgit管理Markdownを、テーマ・目次・本文検索から横断して読む"
        ) {
            Text("AMD OS の使い方・データの裏側・過去判断・開発手順の正本。テーマから入り、気になる章へ横移動しながら全体像を掴む。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            AMDOSStateNotice(state: store.state) { Task { await store.loadManualLibrary() } }
            if !store.manualChapters.isEmpty {
                HStack(alignment: .top, spacing: 16) {
                    sidebar.frame(width: 272, alignment: .topLeading)
                    Divider()
                    mainColumn.frame(maxWidth: .infinity, alignment: .topLeading)
                }
            }
            Text("正本: pwa/manual/*.md (= git管理)。新規セッション開始時 / 「なぜそうなってるか」を知りたい時に開く。")
                .font(.caption2).foregroundStyle(AMDOSDesign.muted)
        }
        .task { await bootstrap() }
    }

    @ViewBuilder
    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("章・本文・画面・テーブルを検索", text: $query).textFieldStyle(.roundedBorder)
            AMDOSSectionCard("目次", systemImage: "list.bullet.indent") {
                ForEach(configuredSections) { group in
                    DisclosureGroup(isExpanded: sectionExpansionBinding(group.section.key)) {
                        ForEach(group.chapters) { chapter in
                            Button { openChapter(chapter.slug) } label: {
                                HStack(alignment: .top, spacing: 6) {
                                    Text(amdOSManualNumber(chapter.slug)).font(.caption2.monospacedDigit()).foregroundStyle(AMDOSDesign.muted).frame(width: 32, alignment: .leading)
                                    Text(chapter.title).font(.caption).multilineTextAlignment(.leading)
                                    Spacer(minLength: 0)
                                }
                                .padding(.vertical, 3)
                                .padding(.horizontal, 4)
                                .background(selectedSlug == chapter.slug ? AMDOSDesign.blue.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 5))
                            }
                            .buttonStyle(.plain)
                        }
                    } label: {
                        Text(group.section.label).font(.caption.weight(.semibold))
                    }
                }
            }
            AMDOSSectionCard("カテゴリメニュー", systemImage: "square.grid.2x2") {
                ForEach(amdOSManualTopics, id: \.key) { topic in
                    Button { selectedTopic = topic.key } label: {
                        HStack {
                            Text(topic.label).font(.caption.weight(selectedTopic == topic.key ? .bold : .regular))
                            Spacer()
                            Text("\(topic.chapterSlugs.filter { chapterBySlug[$0] != nil }.count)").font(.caption2.monospacedDigit()).foregroundStyle(AMDOSDesign.muted)
                        }
                        .padding(.vertical, 3)
                        .padding(.horizontal, 4)
                        .background(selectedTopic == topic.key ? AMDOSDesign.blue.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 5))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private var mainColumn: some View {
        VStack(alignment: .leading, spacing: 16) {
            TextField("ここに入力: 請求額確定 / MS 期間設定 / project_strategy_signals", text: $query).textFieldStyle(.roundedBorder)
            if query.trimmedNonEmpty != nil { manualSearchResults }
            if let topic = amdOSManualTopics.first(where: { $0.key == selectedTopic }) { topicOverview(topic) }
            if let chapter = selectedChapter { chapterArticle(chapter) }
            if showDirectory { manualDirectory }
            manualTsukuyomi
        }
    }

    @ViewBuilder
    private var manualSearchResults: some View {
        AMDOSSectionCard("検索結果", systemImage: "magnifyingglass") {
            Text("「\(query.trimmingCharacters(in: .whitespacesAndNewlines))」で \(searchResults.count)件").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if searchResults.isEmpty {
                Text("該当する章が見つからなかったよ。別の言い方や画面名でもう一回探してみて。").font(.caption)
            } else {
                ForEach(searchResults) { result in
                    Button { openChapter(result.chapter.slug) } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack { Text(amdOSManualNumber(result.chapter.slug)).font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.blue); Text(result.chapter.title).font(.subheadline.weight(.semibold)); Spacer(); Image(systemName: "arrow.right") }
                            Text(result.snippet).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 5)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private func topicOverview(_ topic: AMDOSManualTopic) -> some View {
        AMDOSSectionCard(topic.label, systemImage: "square.grid.2x2") {
            HStack {
                Text(topic.description).font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("解除") { selectedTopic = "" }.buttonStyle(.bordered)
            }
            ForEach(topic.chapterSlugs.compactMap { chapterBySlug[$0] }) { chapter in
                Button("\(amdOSManualNumber(chapter.slug)). \(chapter.title)") { openChapter(chapter.slug) }.buttonStyle(.link)
            }
        }
    }

    @ViewBuilder
    private func chapterArticle(_ chapter: AMDOSManualLibraryChapter) -> some View {
        AMDOSSectionCard("\(amdOSManualNumber(chapter.slug)). \(chapter.title)", systemImage: "book.closed") {
            HStack {
                Text("PWA Markdown正本").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("目次へ戻る") { selectedSlug = "" }.buttonStyle(.bordered)
            }
            AMDOSMarkdownContent(markdown: amdOSManualMarkdown(chapter.content, chapter: chapter), onManualLink: openChapter)
        }
        let ordered = store.manualChapters.map(\.slug)
        if let index = ordered.firstIndex(of: chapter.slug) {
            HStack {
                if index > 0, let previous = chapterBySlug[ordered[index - 1]] {
                    Button("← \(previous.title)") { openChapter(previous.slug) }.buttonStyle(.link)
                }
                Spacer()
                if index < ordered.count - 1, let next = chapterBySlug[ordered[index + 1]] {
                    Button("\(next.title) →") { openChapter(next.slug) }.buttonStyle(.link)
                }
            }
            .font(.caption)
        }
    }

    @ViewBuilder
    private var manualDirectory: some View {
        AMDOSSectionCard("セクション別目次", systemImage: "books.vertical") {
            ForEach(configuredSections) { group in
                VStack(alignment: .leading, spacing: 7) {
                    Text(group.section.label).font(.headline)
                    Text(group.section.description).font(.caption).foregroundStyle(AMDOSDesign.muted)
                    ForEach(group.chapters) { chapter in
                        Button { openChapter(chapter.slug) } label: {
                            HStack(alignment: .top, spacing: 8) {
                                Text(amdOSManualNumber(chapter.slug)).font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.muted).frame(width: 34, alignment: .leading)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(chapter.title).font(.subheadline.weight(.semibold))
                                    Text(amdOSManualSummary(chapter.content)).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(1)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 3)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 6)
                if group.section.key != configuredSections.last?.section.key { Divider() }
            }
            if !uncategorizedChapters.isEmpty {
                Divider()
                Text("未分類").font(.headline)
                ForEach(uncategorizedChapters) { chapter in
                    Button("\(chapter.slug) · \(chapter.title)") { openChapter(chapter.slug) }.buttonStyle(.link)
                }
            }
            Divider()
            Text("全章一覧").font(.headline)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 132), spacing: 6)], alignment: .leading, spacing: 6) {
                ForEach(store.manualChapters) { chapter in
                    Button("\(amdOSManualNumber(chapter.slug)). \(chapter.title)") { openChapter(chapter.slug) }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
            }
        }
    }

    @ViewBuilder
    private var manualTsukuyomi: some View {
        AMDOSSectionCard("つくよみに聞く", systemImage: "moon.stars.fill") {
            HStack {
                Text("OSマニュアル限定").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("会話を初期化") { store.resetManualConversation(); question = "" }.buttonStyle(.bordered)
            }
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    ForEach(store.manualMessages) { message in
                        VStack(alignment: message.role == .assistant ? .leading : .trailing, spacing: 6) {
                            Text(message.role == .assistant ? "つくよみ" : "まさ")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(message.role == .assistant ? AMDOSDesign.blue : AMDOSDesign.muted)
                            AMDOSMarkdownContent(markdown: message.content, onManualLink: openChapter)
                                .padding(10)
                                .frame(maxWidth: .infinity, alignment: message.role == .assistant ? .leading : .trailing)
                                .background(message.role == .assistant ? AMDOSDesign.blue.opacity(0.07) : AMDOSDesign.ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
                            if !message.sources.isEmpty {
                                HStack(spacing: 6) {
                                    ForEach(message.sources) { source in
                                        Button("\(source.number) \(source.title)") { openChapter(source.slug) }
                                            .buttonStyle(.bordered)
                                            .controlSize(.small)
                                    }
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: message.role == .assistant ? .leading : .trailing)
                    }
                }
            }
            .frame(minHeight: 180, maxHeight: 360)
            HStack(alignment: .bottom, spacing: 8) {
                AMDOSTextField(title: "質問", text: $question, axis: .vertical)
                Button("送信") {
                    let value = question.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !value.isEmpty else { return }
                    question = ""
                    Task { await store.askManual(question: value, currentSlug: selectedSlug.trimmedNonEmpty) }
                }
                .buttonStyle(.borderedProminent)
                .disabled(question.trimmedNonEmpty == nil)
            }
            AMDOSStateNotice(state: store.askState) { }
        }
    }

    private func sectionExpansionBinding(_ key: String) -> Binding<Bool> {
        Binding(
            get: { expandedSectionKeys.contains(key) },
            set: { isExpanded in
                if isExpanded { expandedSectionKeys.insert(key) }
                else { expandedSectionKeys.remove(key) }
            }
        )
    }

    private func openChapter(_ slug: String) {
        guard chapterBySlug[slug] != nil else { return }
        selectedSlug = slug
    }

    private func bootstrap() async {
        if let initialTopic, amdOSManualTopics.contains(where: { $0.key == initialTopic }) { selectedTopic = initialTopic }
        await store.loadManualLibrary()
        if let initialSlug, chapterBySlug[initialSlug] != nil { selectedSlug = initialSlug }
    }
}

private func amdOSManualSummary(_ content: String) -> String {
    let lines = content.split(separator: "\n").map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
    guard let h1 = lines.firstIndex(where: { $0.hasPrefix("# ") }) else { return String(content.prefix(120)) }
    for line in lines.dropFirst(h1 + 1) where !line.isEmpty && !line.hasPrefix("#") && !line.hasPrefix(">") {
        return line.replacingOccurrences(of: "[*_`]", with: "", options: .regularExpression).prefix(140).description
    }
    return ""
}

private func amdOSManualSlug(from url: URL) -> String? {
    let value = url.absoluteString
    let withoutHash = value.split(separator: "#", maxSplits: 1).first.map(String.init) ?? value
    let clean = withoutHash
        .replacingOccurrences(of: "./", with: "")
        .replacingOccurrences(of: "../", with: "")
    if clean.hasPrefix("/manual/") {
        return String(clean.dropFirst("/manual/".count)).replacingOccurrences(of: ".md", with: "")
    }
    if clean.hasPrefix("manual/") {
        return String(clean.dropFirst("manual/".count)).replacingOccurrences(of: ".md", with: "")
    }
    if !clean.contains("/") && clean.hasSuffix(".md") {
        return clean.replacingOccurrences(of: ".md", with: "")
    }
    return nil
}

private struct AMDOSMarkdownContent: View {
    let markdown: String
    var onManualLink: ((String) -> Void)? = nil

    var body: some View {
        Text(attributed)
            .font(.body)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
            .environment(\.openURL, OpenURLAction { url in
                if let onManualLink, let slug = amdOSManualSlug(from: url) {
                    onManualLink(slug)
                    return .handled
                }
                return .systemAction
            })
    }

    private var attributed: AttributedString {
        (try? AttributedString(markdown: markdown, options: .init(interpretedSyntax: .full)))
            ?? AttributedString(markdown)
    }
}

struct AMDOSManualView: View {
    let initialTopic: String?
    var body: some View { AMDOSManualLibraryView(initialSlug: nil, initialTopic: initialTopic, showDirectory: true) }
}

struct AMDOSManualDetailView: View {
    let initialSlug: String?
    var body: some View { AMDOSManualLibraryView(initialSlug: initialSlug, initialTopic: nil, showDirectory: false) }
}
struct AMDOSSpecView: View { let initialSlug: String?; @StateObject private var store = AMDOSReferenceStore(); var body: some View { AMDOSDocumentView(store: store, eyebrow: "SPEC", title: "仕様書", kind: "spec", initialSlug: initialSlug, initialTopic: nil) } }
struct AMDOSSpecDetailView: View { let initialSlug: String?; @StateObject private var store = AMDOSReferenceStore(); var body: some View { AMDOSDocumentView(store: store, eyebrow: "SPEC DETAIL", title: "仕様書本文", kind: "spec", initialSlug: initialSlug, initialTopic: nil) } }
struct AMDOSBZMView: View { let initialSlug: String?; @StateObject private var store = AMDOSReferenceStore(); var body: some View { AMDOSDocumentView(store: store, eyebrow: "BZM", title: "Before Zero", kind: "bzm", initialSlug: initialSlug ?? "preface", initialTopic: nil) } }
struct AMDOSBZMDetailView: View { let initialSlug: String?; @StateObject private var store = AMDOSReferenceStore(); var body: some View { AMDOSDocumentView(store: store, eyebrow: "BZM DETAIL", title: "Before Zero本文", kind: "bzm", initialSlug: initialSlug ?? "preface", initialTopic: nil) } }
struct AMDOSBZMPublicView: View { let initialSlug: String?; @StateObject private var store = AMDOSReferenceStore(); var body: some View { AMDOSDocumentView(store: store, eyebrow: "BZM PUBLIC", title: "Before Zero公開版", kind: "bzm-public", initialSlug: initialSlug ?? "00-prologue", initialTopic: nil) } }
struct AMDOSBZMPublicDetailView: View { let initialSlug: String?; @StateObject private var store = AMDOSReferenceStore(); var body: some View { AMDOSDocumentView(store: store, eyebrow: "BZM PUBLIC DETAIL", title: "Before Zero公開本文", kind: "bzm-public", initialSlug: initialSlug ?? "00-prologue", initialTopic: nil) } }
