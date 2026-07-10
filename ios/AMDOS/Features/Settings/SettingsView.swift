import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authService: AuthService
    @State private var showHUDCockpit = false
    private var appVersionLabel: String {
        let info = Bundle.main.infoDictionary
        return info?["CFBundleShortVersionString"] as? String ?? "-"
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        showHUDCockpit = true
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "scope")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(AMD.blue)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("HUD版コックピット")
                                    .font(.headline)
                                    .foregroundStyle(AMD.text)
                                Text("タクティカル表示に切り替え（デモ）")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                } header: {
                    Text("ディスプレイ")
                }

                Section("資料") {
                    NavigationLink {
                        TextbookReaderView()
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "book.pages")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(AMD.blue)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("教科書")
                                    .font(.headline)
                                    .foregroundStyle(AMD.text)
                                Text("Before Zero / BZM を読む")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section("アカウント") {
                    if let email = authService.userEmail {
                        LabeledContent("メール", value: email)
                    }
                    Button(role: .destructive) {
                        authService.signOut()
                    } label: {
                        Text("サインアウト")
                    }
                }

                Section("アプリ情報") {
                    LabeledContent("バージョン", value: appVersionLabel)
                }

                if let email = authService.userEmail {
                    NavigationLink("支払情報（住所・振込先）") {
                        PayoutInfoEditView(email: email)
                    }
                }
            }
            .navigationTitle("設定")
        }
        .fullScreenCover(isPresented: $showHUDCockpit) {
            CockpitHUDView()
        }
    }
}

// MARK: - TextbookReaderView

struct TextbookReaderView: View {
    private let chapters = TextbookChapter.loadBundledChapters()
    @State private var selectedSlug = "preface"

    var body: some View {
        Group {
            if chapters.isEmpty {
                ContentUnavailableView(
                    "教科書を開けなかった",
                    systemImage: "doc.text.magnifyingglass",
                    description: Text("同梱された教科書本文が見つからなかった")
                )
            } else if let chapter = selectedChapter {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        Text(chapter.title)
                            .font(.title2.weight(.semibold))
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Divider()
                        Text(chapter.renderedMarkdown)
                            .font(.body)
                            .lineSpacing(5)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 20)
                }
            }
        }
        .navigationTitle("教科書")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !chapters.isEmpty {
                Menu {
                    ForEach(chapters) { chapter in
                        Button {
                            selectedSlug = chapter.slug
                        } label: {
                            if selectedSlug == chapter.slug {
                                Label(chapter.menuTitle, systemImage: "checkmark")
                            } else {
                                Text(chapter.menuTitle)
                            }
                        }
                    }
                } label: {
                    Label("章を選ぶ", systemImage: "list.bullet")
                }
            }
        }
        .onAppear {
            if !chapters.contains(where: { $0.slug == selectedSlug }) {
                selectedSlug = chapters.first?.slug ?? "preface"
            }
        }
    }

    private var selectedChapter: TextbookChapter? {
        chapters.first { $0.slug == selectedSlug } ?? chapters.first
    }
}

private struct TextbookChapter: Identifiable {
    let slug: String
    let title: String
    let markdownText: String
    let renderedMarkdown: AttributedString

    var id: String { slug }
    var menuTitle: String { title.isEmpty ? slug : title }

    static func loadBundledChapters() -> [TextbookChapter] {
        let nestedURLs = Bundle.main.urls(forResourcesWithExtension: "md", subdirectory: "BZM") ?? []
        let rootURLs = Bundle.main.urls(forResourcesWithExtension: "md", subdirectory: nil) ?? []
        let urls = nestedURLs.isEmpty ? rootURLs : nestedURLs
        let chapters = urls.compactMap(loadChapter)
        return chapters.sorted { lhs, rhs in
            let lhsRank = orderRank(for: lhs.slug)
            let rhsRank = orderRank(for: rhs.slug)
            if lhsRank != rhsRank { return lhsRank < rhsRank }
            return lhs.slug.localizedStandardCompare(rhs.slug) == .orderedAscending
        }
    }

    private static func loadChapter(url: URL) -> TextbookChapter? {
        guard let rawMarkdown = try? String(contentsOf: url, encoding: .utf8) else {
            return nil
        }
        let markdown = removingHTMLComments(from: rawMarkdown)
        let slug = url.deletingPathExtension().lastPathComponent
        return TextbookChapter(
            slug: slug,
            title: title(from: markdown, fallback: slug),
            markdownText: markdown,
            renderedMarkdown: renderedMarkdown(from: markdown)
        )
    }

    private static func removingHTMLComments(from markdown: String) -> String {
        var result = ""
        var searchStart = markdown.startIndex

        while let openRange = markdown.range(of: "<!--", range: searchStart..<markdown.endIndex) {
            result += markdown[searchStart..<openRange.lowerBound]
            guard let closeRange = markdown.range(of: "-->", range: openRange.upperBound..<markdown.endIndex) else {
                return result
            }
            searchStart = closeRange.upperBound
        }

        result += markdown[searchStart..<markdown.endIndex]
        return result
    }

    private static func renderedMarkdown(from markdown: String) -> AttributedString {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .full)
        return (try? AttributedString(markdown: markdown, options: options)) ?? AttributedString(markdown)
    }

    private static func title(from markdown: String, fallback: String) -> String {
        for line in markdown.split(separator: "\n", omittingEmptySubsequences: false) {
            let trimmed = String(line).trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("#") {
                return trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "# ")).trimmingCharacters(in: .whitespaces)
            }
        }
        return fallback.replacingOccurrences(of: "-", with: " ")
    }

    private static func orderRank(for slug: String) -> Int {
        if slug == "preface" { return 0 }
        if slug.hasPrefix("book-a-ch-") { return 100 + chapterNumber(from: slug) }
        if slug.hasPrefix("new-book") { return 1_000 }
        return 10_000
    }

    private static func chapterNumber(from slug: String) -> Int {
        Int(slug.split(separator: "-").last.map(String.init) ?? "") ?? 999
    }
}

// MARK: - NotificationInboxView

struct NotificationInboxView: View {
    let initialFocus: NotificationDeepLink?

    @EnvironmentObject private var authService: AuthService
    @State private var inbox = NotificationInboxData(items: [], feedbacks: [], projectMap: [:])
    @State private var filter: InboxFilter = .all
    @State private var expandedIds: Set<String> = []
    @State private var detailsById: [String: [NotificationDetailLine]] = [:]
    @State private var feedbackTexts: [String: String] = [:]
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var toastMessage: String?
    @State private var submittingIds: Set<String> = []

    init(initialFocus: NotificationDeepLink? = nil) {
        self.initialFocus = initialFocus
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView("通知を読み込み中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage {
                VStack(spacing: 14) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 36, weight: .semibold))
                        .foregroundStyle(.orange)
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("再読み込み") {
                        Task { await load() }
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 12) {
                            filterPicker

                            if let toastMessage {
                                Text(toastMessage)
                                    .font(.footnote)
                                    .foregroundStyle(.green)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(10)
                                    .background(Color.green.opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            if filteredItems.isEmpty {
                                ContentUnavailableView(
                                    "通知なし",
                                    systemImage: "bell.slash",
                                    description: Text("この条件に合う通知はないよ")
                                )
                                .padding(.top, 48)
                            } else {
                                ForEach(filteredItems) { item in
                                    NotificationInboxCard(
                                        item: item,
                                        projectMap: inbox.projectMap,
                                        feedbacks: feedbacks(for: item),
                                        details: detailsById[item.id],
                                        isExpanded: expandedIds.contains(item.id),
                                        feedbackText: Binding(
                                            get: { feedbackTexts[item.id] ?? "" },
                                            set: { feedbackTexts[item.id] = $0 }
                                        ),
                                        isSubmitting: submittingIds.contains(item.id),
                                        onToggle: { toggle(item) },
                                        onSubmit: { action in
                                            Task { await submit(item: item, action: action) }
                                        },
                                        onOpenReauth: {
                                            Task { await openReauth(item) }
                                        }
                                    )
                                    .id(item.id)
                                }
                            }
                        }
                        .padding()
                    }
                    .onChange(of: inbox.items) { _, _ in
                        guard let focusId = initialFocus?.id,
                              inbox.items.contains(where: { $0.id == focusId }) else { return }
                        expandedIds.insert(focusId)
                        Task {
                            if let item = inbox.items.first(where: { $0.id == focusId }) {
                                await loadDetailsIfNeeded(for: item)
                            }
                            await MainActor.run {
                                withAnimation { proxy.scrollTo(focusId, anchor: .center) }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("通知")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await load() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(isLoading)
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var filterPicker: some View {
        Picker("表示", selection: $filter) {
            Text("すべて").tag(InboxFilter.all)
            Text("未読").tag(InboxFilter.unread)
            Text("既読").tag(InboxFilter.feedback)
        }
        .pickerStyle(.segmented)
    }

    private var filteredItems: [NotificationInboxItem] {
        switch filter {
        case .all:
            return inbox.items
        case .unread:
            return inbox.items.filter(\.isUnread)
        case .feedback:
            return inbox.items.filter { !$0.isUnread || hasFeedback($0) }
        }
    }

    private var unansweredItems: [NotificationInboxItem] {
        inbox.items.filter { !hasFeedback($0) }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            inbox = try await SupabaseService.shared.fetchNotificationInbox()
            if let focusId = initialFocus?.id,
               let item = inbox.items.first(where: { $0.id == focusId }) {
                if hasFeedback(item) {
                    filter = .feedback
                }
                expandedIds.insert(item.id)
                await loadDetailsIfNeeded(for: item)
            }
        } catch {
            errorMessage = "通知を読めなかった: \(error.localizedDescription)"
        }
        isLoading = false
    }

    private func toggle(_ item: NotificationInboxItem) {
        if expandedIds.contains(item.id) {
            expandedIds.remove(item.id)
            return
        }
        expandedIds.insert(item.id)
        Task {
            await loadDetailsIfNeeded(for: item)
            if item.isUnread {
                try? await SupabaseService.shared.markNotificationRead(item)
            }
        }
    }

    private func openReauth(_ item: NotificationInboxItem) async {
        guard item.kind == "connector_auth" else { return }
        if item.isUnread {
            try? await SupabaseService.shared.markNotificationRead(item)
            inbox = (try? await SupabaseService.shared.fetchNotificationInbox()) ?? inbox
        }
        guard let rawURL = item.reauthUrl, let url = URL(string: rawURL) else {
            toastMessage = "再認証リンクを開けなかった"
            return
        }
        await MainActor.run {
            UIApplication.shared.open(url)
        }
    }

    private func loadDetailsIfNeeded(for item: NotificationInboxItem) async {
        guard detailsById[item.id] == nil else { return }
        do {
            let details = try await SupabaseService.shared.fetchNotificationDetails(for: item)
            detailsById[item.id] = details
        } catch {
            detailsById[item.id] = [
                NotificationDetailLine(
                    title: "詳細取得エラー",
                    body: error.localizedDescription,
                    footnote: nil
                )
            ]
        }
    }

    private func submit(item: NotificationInboxItem, action: NotificationInboxAction) async {
        guard let email = authService.userEmail else {
            toastMessage = "ログイン状態を確認してね"
            return
        }
        submittingIds.insert(item.id)
        defer { submittingIds.remove(item.id) }
        do {
            let result = try await SupabaseService.shared.submitNotificationResponse(
                item: item,
                action: action,
                comment: feedbackTexts[item.id] ?? "",
                email: email
            )
            feedbackTexts[item.id] = ""
            toastMessage = result.message
            inbox = try await SupabaseService.shared.fetchNotificationInbox()
            detailsById[item.id] = nil
            await loadDetailsIfNeeded(for: item)
        } catch {
            toastMessage = "送信失敗: \(error.localizedDescription)"
        }
    }

    private func feedbacks(for item: NotificationInboxItem) -> [NotificationFeedback] {
        let target = item.responseTarget
        if target.feedbackKind == "meeting_summary" {
            return inbox.feedbacks.filter { $0.l2Kind == "meeting_summary" && $0.meetingId == target.meetingId }
        }
        return inbox.feedbacks.filter {
            $0.l2Kind == target.feedbackKind &&
            $0.targetId == target.feedbackTargetId &&
            $0.scopeKey == target.feedbackScopeKey
        }
    }

    private func hasFeedback(_ item: NotificationInboxItem) -> Bool {
        !feedbacks(for: item).isEmpty
    }
}

private enum InboxFilter {
    case all
    case unread
    case feedback
}

private struct NotificationInboxCard: View {
    let item: NotificationInboxItem
    let projectMap: [String: String]
    let feedbacks: [NotificationFeedback]
    let details: [NotificationDetailLine]?
    let isExpanded: Bool
    @Binding var feedbackText: String
    let isSubmitting: Bool
    let onToggle: () -> Void
    let onSubmit: (NotificationInboxAction) -> Void
    let onOpenReauth: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onToggle) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: iconName)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(iconColor)
                        .frame(width: 28, height: 28)

                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 6) {
                            if item.isUnread {
                                Text("未読")
                                    .font(.caption2.bold())
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(AMD.blue)
                                    .clipShape(Capsule())
                            }
                            Text(kindLabel)
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                            if feedbacks.isEmpty == false {
                                Text("回答 \(feedbacks.count)")
                                    .font(.caption2.bold())
                                    .foregroundStyle(.orange)
                            }
                        }

                        Text(item.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AMD.text)
                            .multilineTextAlignment(.leading)

                        Text("\(formatJST(item.createdAt)) / \(item.displayTarget(projectMap: projectMap))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer(minLength: 6)

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                        .padding(.top, 6)
                }
                .padding(12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 12) {
                    if item.body.isEmpty == false {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("通知内容")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            Text(item.body)
                                .font(.footnote)
                                .foregroundStyle(AMD.text)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    detailSection
                    feedbackSection
                    if item.kind == "connector_auth" {
                        connectorAuthSection
                    } else {
                        responseSection
                    }
                }
                .padding(12)
                .background(Color(.secondarySystemGroupedBackground))
            }
        }
        .background(item.isUnread ? AMD.blueTint.opacity(0.55) : AMD.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(item.isUnread ? AMD.blue.opacity(0.35) : AMD.divider, lineWidth: 1)
        )
    }

    private var detailSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("関連データ")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            if let details {
                if details.isEmpty {
                    Text("この通知種別は、上の通知内容が確認用の本文だよ。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(details) { line in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(line.title)
                                .font(.footnote.bold())
                            Text(line.body)
                                .font(.footnote)
                                .fixedSize(horizontal: false, vertical: true)
                            if let footnote = line.footnote, !footnote.isEmpty {
                                Text(footnote)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(AMD.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var feedbackSection: some View {
        Group {
            if feedbacks.isEmpty == false {
                VStack(alignment: .leading, spacing: 6) {
                    Text("過去の回答・コメント")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ForEach(feedbacks) { feedback in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(feedback.feedbackText)
                                .font(.footnote)
                            Text([
                                formatJST(feedback.createdAt),
                                feedback.createdBy,
                                feedback.appliedCount > 0 ? "反映 \(feedback.appliedCount)回" : "未反映",
                            ].compactMap { $0 }.joined(separator: " / "))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        }
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.10))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
        }
    }

    private var responseSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("回答・コメント")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            TextEditor(text: $feedbackText)
                .frame(minHeight: 74)
                .padding(6)
                .background(AMD.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AMD.divider, lineWidth: 1)
                )
            HStack(spacing: 8) {
                Button {
                    onSubmit(.yes)
                } label: {
                    Label("はい", systemImage: "checkmark.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)

                Button(role: .destructive) {
                    onSubmit(.no)
                } label: {
                    Label("いいえ", systemImage: "xmark.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            Button {
                onSubmit(.comment)
            } label: {
                Label("コメントだけ送る", systemImage: "text.bubble")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(feedbackText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmitting)

            if isSubmitting {
                ProgressView("送信中...")
                    .font(.caption)
            }
        }
        .disabled(isSubmitting)
    }

    private var connectorAuthSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("再認証")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            Button {
                onOpenReauth()
            } label: {
                Label("再認証を開く", systemImage: "arrow.up.right.square")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            if let connector = item.connector {
                Text([connectorLabelJa(connector), item.reason.map(reasonLabelJa)].compactMap { $0 }.joined(separator: " / "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var iconName: String {
        if item.kind == "connector_auth" { return "key" }
        switch item.responseTarget.feedbackKind {
        case "meeting_summary": return "doc.text"
        case "ms_progress": return "chart.line.uptrend.xyaxis"
        case "project_registry_diff": return "tray.and.arrow.down"
        case "xrl_evidence": return "checklist.checked"
        case "protocols": return "scale.3d"
        default: return "bell"
        }
    }

    private var iconColor: Color {
        if item.kind == "connector_auth" { return .red }
        return item.importance >= 3 ? .orange : AMD.blue
    }

    private var kindLabel: String {
        if item.kind == "connector_auth" { return "再認証" }
        switch item.responseTarget.feedbackKind {
        case "meeting_summary": return "議事録"
        case "ms_progress": return "MS進捗"
        case "project_registry_diff": return "OS台帳差分"
        case "xrl_evidence": return "XRL根拠"
        case "member_knowledge": return "メンバー知"
        case "project_knowledge": return "PJ知"
        case "protocols": return "プロトコル"
        default: return item.responseTarget.feedbackKind
        }
    }

    private func formatJST(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return iso }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "ja_JP")
        fmt.timeZone = TimeZone(identifier: "Asia/Tokyo")
        fmt.dateFormat = "M/d HH:mm"
        return fmt.string(from: date)
    }

    private func connectorLabelJa(_ connector: String) -> String {
        switch connector {
        case "notion": return "ノーション"
        case "gmail": return "メール"
        case "drive": return "ドライブ"
        case "calendar": return "カレンダー"
        case "slack": return "スラック"
        default: return connector
        }
    }

    private func reasonLabelJa(_ reason: String) -> String {
        switch reason {
        case "oauth_token_invalid_grant": return "認証の有効期限切れ"
        case "TRIGGER_REAUTHENTICATION", "reauth_required": return "再認証が必要"
        default: return reason
        }
    }
}

// MARK: - PayoutInfoEditView

struct PayoutInfoEditView: View {
    let email: String

    @State private var memberId: String = ""
    @State private var memberAddress: String = ""
    @State private var bankInfo: String = ""
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var savedOK = false

    var body: some View {
        Form {
            if isLoading {
                Section {
                    ProgressView("読み込み中…")
                }
            } else {
                Section {
                    Text("支払通知書に印字されます。正確に入力してください。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } header: {
                    Text("注意")
                }

                Section("住所") {
                    TextField(
                        "例: 〒305-0031 茨城県つくば市吾妻1-2-3",
                        text: $memberAddress,
                        axis: .vertical
                    )
                    .lineLimit(3...5)
                    .autocorrectionDisabled()
                }

                Section("振込先") {
                    TextField(
                        "例:\nPayPay銀行\nつばめ支店\n普通口座\n1234567",
                        text: $bankInfo,
                        axis: .vertical
                    )
                    .lineLimit(4...8)
                    .autocorrectionDisabled()
                }

                Section {
                    Button {
                        save()
                    } label: {
                        if isSaving {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("保存する")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isSaving || memberId.isEmpty)
                }

                if let err = saveError {
                    Section {
                        Text(err)
                            .foregroundStyle(.red)
                            .font(.footnote)
                    }
                }
            }
        }
        .navigationTitle("支払情報")
        .navigationBarTitleDisplayMode(.inline)
        .alert("保存しました", isPresented: $savedOK) {
            Button("OK") {}
        }
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            if let profile = try await SupabaseService.shared.fetchMyProfile(email: email) {
                memberId      = profile.memberId
                memberAddress = profile.memberAddress ?? ""
                bankInfo      = profile.bankInfo ?? ""
            }
        } catch {
            saveError = "読み込みエラー: \(error.localizedDescription)"
        }
    }

    private func save() {
        guard !memberId.isEmpty else { return }
        isSaving = true
        saveError = nil
        Task {
            defer { isSaving = false }
            do {
                try await SupabaseService.shared.updateMyPayoutInfo(
                    memberId: memberId,
                    memberAddress: memberAddress,
                    bankInfo: bankInfo
                )
                savedOK = true
            } catch {
                saveError = "保存エラー: \(error.localizedDescription)"
            }
        }
    }
}
