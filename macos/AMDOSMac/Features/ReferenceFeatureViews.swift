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
    .init(key: "discovery", label: "外部探索", description: "Atlas・Seeds・VC・Scholar・Venture Map。", chapterSlugs: ["2-5-research-assets-quick-start", "4-2-atlas-macrotrend-signal-spec", "5-1-research-assets-vc-seeds-scholar-spec", "5-2-venture-map-spec", "4-9-institution-ers-spec"]),
    .init(key: "knowledge", label: "知識・通知", description: "5生データ・L2・通知・つくよみ学習。", chapterSlugs: ["3-2-data-and-extraction", "3-3-notifications-and-tsukuyomi", "8-1-knowledge-admin-tsukuyomi-spec", "8-2-notification-review-and-strategy-signals-spec", "8-3-l2-extraction-routines-spec"]),
    .init(key: "admin", label: "Admin設定", description: "台帳・設定・請求・支払の運用。", chapterSlugs: ["2-6-admin-ops", "2-2-member-workflows-quick-start"]),
    .init(key: "system", label: "OSの構造", description: "画面・データ・通知・判断・月次の関係。", chapterSlugs: ["1-1-intro", "3-3-notifications-and-tsukuyomi", "4-1-atlas-protocol-score-macrotrend", "2-6-admin-ops", "6-2-admin-projects-members-ledger-spec"]),
    .init(key: "developer", label: "設計・開発", description: "全体設計・抽出routine・過去判断・開発手順。", chapterSlugs: ["3-1-system-architecture", "3-2-data-and-extraction", "4-2-atlas-macrotrend-signal-spec", "5-1-research-assets-vc-seeds-scholar-spec", "4-5-management-score-and-finance-simulation-spec", "4-6-graduation-detection-spec", "4-4-frl-related-members-score-spec", "4-8-ms-progress-monthly-report-revision-spec", "4-7-venture-status-narrative-pl-xrl-spec", "8-3-l2-extraction-routines-spec", "9-1-decisions-and-history", "9-2-developer"]),
    .init(key: "system-dev", label: "内部構造", description: "画面・DB・cron・書き込み経路。", chapterSlugs: ["3-1-system-architecture", "3-2-data-and-extraction", "6-1-operations-settings-spec", "4-2-atlas-macrotrend-signal-spec", "5-1-research-assets-vc-seeds-scholar-spec", "5-2-venture-map-spec", "9-1-decisions-and-history", "9-2-developer"]),
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
    .init(key: "assets", label: "外部探索・事業アセット", description: "Seeds、VC、Scholar、Venture Map など外部探索と事業化アセットの章。", slugs: ["5-1-research-assets-vc-seeds-scholar-spec", "5-2-venture-map-spec"]),
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
