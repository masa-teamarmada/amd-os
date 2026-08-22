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

// MARK: - NotificationInboxView

private enum InboxSegment: String, CaseIterable, Hashable {
    case judgment
    case unread
    case history

    var title: String {
        switch self {
        case .judgment: return "判断"
        case .unread: return "未読"
        case .history: return "履歴"
        }
    }
}

struct NotificationInboxView: View {
    let initialFocus: NotificationDeepLink?

    @EnvironmentObject private var authService: AuthService
    @State private var inbox = NotificationInboxData(items: [], feedbacks: [], projectMap: [:])
    @State private var segment: InboxSegment = .judgment
    @State private var judgmentIndex: Int = 0
    @State private var expandedIds: Set<String> = []
    @State private var detailsById: [String: [NotificationDetailLine]] = [:]
    @State private var feedbackTexts: [String: String] = [:]
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var toastMessage: String?
    @State private var submittingIds: Set<String> = []
    @State private var sessionDeferredIds: [String] = []
    @State private var correctionTarget: NotificationInboxItem?
    @State private var correctionText: String = ""
    @State private var correctionError: String?
    @State private var isSubmittingCorrection = false

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
                        VStack(spacing: 16) {
                            pipelineRail
                            segmentPicker

                            if let toastMessage {
                                Text(toastMessage)
                                    .font(.footnote)
                                    .foregroundStyle(.green)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(10)
                                    .background(Color.green.opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            switch segment {
                            case .judgment:
                                judgmentSection
                            case .unread:
                                compactList(unreadItems, emptyText: "未読の通知はないよ")
                            case .history:
                                compactList(historyItems, emptyText: "履歴はまだないよ")
                            }
                        }
                        .padding()
                    }
                    .background(Color(.systemGroupedBackground))
                    .onChange(of: inbox.items) { _, _ in
                        guard let focusId = initialFocus?.id,
                              let item = inbox.items.first(where: { $0.id == focusId }),
                              hasFeedback(item) else { return }
                        expandedIds.insert(focusId)
                        Task {
                            await loadDetailsIfNeeded(for: item)
                            await MainActor.run {
                                withAnimation(.easeOut(duration: 0.25)) {
                                    proxy.scrollTo(focusId, anchor: .center)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("判断キュー")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await load() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(isLoading)
                .accessibilityLabel("再読み込み")
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $correctionTarget) { item in
            correctionSheet(for: item)
        }
    }

    private var pipelineRail: some View {
        PipelineRailView()
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var segmentPicker: some View {
        Picker("表示", selection: $segment) {
            ForEach(InboxSegment.allCases, id: \.self) { seg in
                Text(seg.title).tag(seg)
            }
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private func compactList(_ items: [NotificationInboxItem], emptyText: String) -> some View {
        if items.isEmpty {
            ContentUnavailableView(
                "通知なし",
                systemImage: "bell.slash",
                description: Text(emptyText)
            )
            .padding(.top, 48)
        } else {
            VStack(spacing: 8) {
                ForEach(items) { item in
                    NotificationInboxCard(
                        item: item,
                        projectMap: inbox.projectMap,
                        feedbacks: feedbacks(for: item),
                        details: detailsById[item.id],
                        isExpanded: expandedIds.contains(item.id),
                        onToggle: { toggle(item) },
                        onOpenReauth: {
                            Task { await openReauth(item) }
                        },
                        onFocusJudgment: {
                            focusOnJudgment(item)
                        }
                    )
                    .id(item.id)
                }
            }
        }
    }

    @ViewBuilder
    private var judgmentSection: some View {
        let unanswered = unansweredItems
        if unanswered.isEmpty {
            ContentUnavailableView(
                "判断待ちなし",
                systemImage: "checkmark.seal",
                description: Text("いまはOSからの判断待ちはないよ")
            )
            .padding(.top, 48)
        } else if activeJudgmentCount == 0 {
            deferredAllView(count: unanswered.count)
        } else {
            let queue = judgmentQueue
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("判断待ち \(activeJudgmentCount)件")
                        .font(.subheadline.bold())
                        .foregroundStyle(AMD.text)
                    Spacer()
                    Text("1 - \(queue.count) / \(queue.count)")
                        .font(.footnote.monospacedDigit())
                        .foregroundStyle(.secondary)
                }

                Text("下へスクロールすると、次の通知も続けて確認できるよ")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                LazyVStack(spacing: 16) {
                    ForEach(Array(queue.enumerated()), id: \.element.id) { index, item in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("\(index + 1) / \(queue.count)")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                            NotificationJudgmentCard(
                                item: item,
                                projectMap: inbox.projectMap,
                                details: detailsById[item.id],
                                isSubmitting: submittingIds.contains(item.id),
                                onSubmit: { action in
                                    Task { await submit(item: item, action: action) }
                                },
                                onOpenReauth: {
                                    Task { await openReauth(item) }
                                },
                                onSkip: {
                                    withAnimation(.easeOut(duration: 0.2)) {
                                        if !sessionDeferredIds.contains(item.id) {
                                            sessionDeferredIds.append(item.id)
                                        }
                                        clampJudgmentIndex()
                                    }
                                },
                                onRequestCorrection: {
                                    correctionText = feedbackTexts[item.id] ?? ""
                                    correctionError = nil
                                    correctionTarget = item
                                }
                            )
                        }
                        .task(id: item.id) {
                            await loadDetailsIfNeeded(for: item)
                        }
                    }
                }
            }
        }
    }

    private func deferredAllView(count: Int) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "tray.full")
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(.secondary)
            Text("\(count)件をこの画面では後回し中")
                .font(.subheadline.bold())
                .foregroundStyle(AMD.text)
            Text("あとでにしたカードは、もう一度見るまで判断カードに出てこないよ")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                withAnimation(.easeOut(duration: 0.2)) {
                    sessionDeferredIds.removeAll()
                    judgmentIndex = 0
                }
            } label: {
                Text("もう一度見る")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(AMD.blue)
            .frame(minHeight: 44)
        }
        .padding(.top, 48)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func correctionSheet(for item: NotificationInboxItem) -> some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text(item.title)
                    .font(.headline)
                    .foregroundStyle(AMD.text)
                    .fixedSize(horizontal: false, vertical: true)

                correctionChipRow

                TextEditor(text: $correctionText)
                    .frame(minHeight: 120)
                    .padding(6)
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(AMD.divider, lineWidth: 1)
                    )
                    .accessibilityLabel("修正内容の入力")

                if let correctionError {
                    Text(correctionError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await submitCorrection(item: item) }
                } label: {
                    if isSubmittingCorrection {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("コメントを送る")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(AMD.blue)
                .frame(minHeight: 44)
                .disabled(correctionText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmittingCorrection)

                Spacer(minLength: 0)
            }
            .padding()
            .navigationTitle("修正・コメント")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") {
                        correctionTarget = nil
                    }
                    .disabled(isSubmittingCorrection)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var correctionChipRow: some View {
        let chips = ["PJが違う", "人物が違う", "数値が違う", "重要度が違う"]
        return LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 8)], spacing: 8) {
            ForEach(chips, id: \.self) { chip in
                Button {
                    toggleChip(chip)
                } label: {
                    Text(chip)
                        .font(.footnote)
                        .frame(maxWidth: .infinity, minHeight: 36)
                }
                .buttonStyle(.bordered)
                .tint(correctionText.contains(chip) ? AMD.blue : .secondary)
            }
        }
    }

    private func toggleChip(_ label: String) {
        if correctionText.contains(label) {
            correctionText = correctionText.replacingOccurrences(of: label, with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        } else if correctionText.isEmpty {
            correctionText = label
        } else {
            correctionText += " / \(label)"
        }
    }

    private func judgmentPeek(for item: NotificationInboxItem) -> some View {
        HStack(spacing: 8) {
            Image(systemName: notificationIconName(item))
                .foregroundStyle(.secondary)
            Text(item.title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .opacity(0.6)
        .accessibilityHidden(true)
    }

    private var unreadItems: [NotificationInboxItem] {
        visibleInboxItems.filter(\.isUnread)
    }

    private var historyItems: [NotificationInboxItem] {
        visibleInboxItems.filter { !$0.isUnread || hasFeedback($0) }
    }

    private var visibleInboxItems: [NotificationInboxItem] {
        inbox.items.filter { !$0.isSuppressedContractAction && !$0.isSuppressedGovernanceCandidate }
    }

    private var unansweredItems: [NotificationInboxItem] {
        visibleInboxItems.filter { item in
            if item.kind == "connector_auth" { return item.isUnread }
            return !hasFeedback(item)
        }
    }

    private var judgmentQueue: [NotificationInboxItem] {
        let deferredSet = Set(sessionDeferredIds)
        return unansweredItems.filter { !deferredSet.contains($0.id) }
    }

    private var activeJudgmentCount: Int {
        judgmentQueue.count
    }

    private func pruneSessionDeferredIds() {
        let activeIds = Set(unansweredItems.map(\.id))
        sessionDeferredIds.removeAll { !activeIds.contains($0) }
    }

    private func clampJudgmentIndex() {
        judgmentIndex = min(judgmentIndex, max(judgmentQueue.count - 1, 0))
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            inbox = try await SupabaseService.shared.fetchNotificationInbox()
            pruneSessionDeferredIds()
            if let focusId = initialFocus?.id,
               let item = inbox.items.first(where: { $0.id == focusId }) {
                if hasFeedback(item) {
                    segment = .history
                    expandedIds.insert(item.id)
                } else {
                    focusOnJudgment(item)
                }
                await loadDetailsIfNeeded(for: item)
            }
            clampJudgmentIndex()
        } catch {
            errorMessage = "通知を読めなかった: \(error.localizedDescription)"
        }
        isLoading = false
    }

    private func focusOnJudgment(_ item: NotificationInboxItem) {
        sessionDeferredIds.removeAll { $0 == item.id }
        segment = .judgment
        if let idx = judgmentQueue.firstIndex(where: { $0.id == item.id }) {
            judgmentIndex = idx
        }
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

    @discardableResult
    private func submit(item: NotificationInboxItem, action: NotificationInboxAction) async -> Bool {
        guard let email = authService.userEmail else {
            toastMessage = "ログイン状態を確認してね"
            return false
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
            let refreshed = try await SupabaseService.shared.fetchNotificationInbox()
            withAnimation(.easeOut(duration: 0.3)) {
                inbox = refreshed
            }
            pruneSessionDeferredIds()
            clampJudgmentIndex()
            detailsById[item.id] = nil
            await loadDetailsIfNeeded(for: item)
            return true
        } catch {
            toastMessage = "送信失敗: \(error.localizedDescription)"
            return false
        }
    }

    private func submitCorrection(item: NotificationInboxItem) async {
        isSubmittingCorrection = true
        correctionError = nil
        feedbackTexts[item.id] = correctionText
        let ok = await submit(item: item, action: .comment)
        isSubmittingCorrection = false
        if ok {
            correctionText = ""
            correctionTarget = nil
        } else {
            correctionError = toastMessage
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

private func notificationIconName(_ item: NotificationInboxItem) -> String {
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

private func notificationIconColor(_ item: NotificationInboxItem) -> Color {
    if item.kind == "connector_auth" { return .red }
    return item.importance >= 3 ? .orange : AMD.blue
}

private func notificationKindLabel(_ item: NotificationInboxItem) -> String {
    if item.kind == "connector_auth" { return "再認証" }
    if item.isManagementKnowledgeCandidate { return "経営ノウハウ追加候補" }
    if item.isTextbookInsight { return "BZM追記候補" }
    switch item.responseTarget.feedbackKind {
    case "meeting_summary": return "議事録"
    case "ms_progress": return "MS進捗"
    case "project_registry_diff": return "OS台帳差分"
    case "xrl_evidence": return "XRL根拠"
    case "member_knowledge": return "メンバー知"
    case "project_knowledge": return "PJ知"
    case "protocols": return "プロトコル"
    case "coverage_gap": return item.isGovernanceHistoryCandidate ? "開催履歴の追加" : "確認候補"
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

// MARK: - PipelineRailView

private struct PipelineStage {
    let label: String
    let systemImage: String
    let active: Bool
}

private struct PipelineRailView: View {
    var compact: Bool = false

    private let stages: [PipelineStage] = [
        PipelineStage(label: "観測", systemImage: "eye", active: false),
        PipelineStage(label: "候補", systemImage: "tray.full", active: false),
        PipelineStage(label: "判断", systemImage: "checkmark.circle.fill", active: true),
        PipelineStage(label: "正本", systemImage: "checkmark.seal", active: false),
    ]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: compact ? 3 : 4) {
                horizontalContent
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                ForEach(Array(stages.enumerated()), id: \.offset) { index, stage in
                    stageChip(number: index + 1, stage: stage)
                }
            }
        }
    }

    @ViewBuilder
    private var horizontalContent: some View {
        ForEach(Array(stages.enumerated()), id: \.offset) { index, stage in
            step(stage.label, systemImage: stage.systemImage, active: stage.active)
            if index < stages.count - 1 {
                arrow
            }
        }
    }

    private func stageChip(number: Int, stage: PipelineStage) -> some View {
        HStack(spacing: 4) {
            Text("\(number)")
                .font(.caption2.bold())
                .foregroundStyle(stage.active ? .white : .secondary)
                .frame(width: 16, height: 16)
                .background(stage.active ? AMD.blue : Color(.tertiarySystemFill))
                .clipShape(Circle())
            Image(systemName: stage.systemImage)
                .font(.caption2)
            Text(stage.label)
                .font(.caption2)
        }
        .foregroundStyle(stage.active ? AMD.blue : .secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func step(_ label: String, systemImage: String, active: Bool) -> some View {
        HStack(spacing: 3) {
            Image(systemName: systemImage)
            Text(label)
        }
        .font(compact ? (active ? .caption2.bold() : .caption2) : (active ? .caption.bold() : .caption))
        .foregroundStyle(active ? AMD.blue : .secondary)
        .fixedSize(horizontal: false, vertical: true)
    }

    private var arrow: some View {
        Image(systemName: "chevron.right")
            .font(.caption2)
            .foregroundStyle(.secondary)
    }
}

// MARK: - Action button helpers

private enum ActionButtonStyle {
    case prominent
    case destructiveBordered
    case bordered
}

private struct ActionButtonSpec {
    let title: String
    let systemImage: String
    let style: ActionButtonStyle
    var tint: Color? = nil
    let action: () -> Void
}

@ViewBuilder
private func renderActionButton(_ spec: ActionButtonSpec) -> some View {
    Group {
        switch spec.style {
        case .prominent:
            Button(action: spec.action) {
                Label(spec.title, systemImage: spec.systemImage)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
        case .destructiveBordered:
            Button(role: .destructive, action: spec.action) {
                Label(spec.title, systemImage: spec.systemImage)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        case .bordered:
            Button(action: spec.action) {
                Label(spec.title, systemImage: spec.systemImage)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
    }
    .tint(spec.tint)
    .frame(minHeight: 44)
}

/// 長い日本語ラベルや Dynamic Type で横並びが潰れる場合、縦並びへフォールバックする2ボタン行。
private struct TwoButtonRow: View {
    let primary: ActionButtonSpec
    let secondary: ActionButtonSpec

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                renderActionButton(primary)
                renderActionButton(secondary)
            }
            VStack(spacing: 8) {
                renderActionButton(primary)
                renderActionButton(secondary)
            }
        }
    }
}

// MARK: - NotificationJudgmentCard

private struct NotificationJudgmentCard: View {
    let item: NotificationInboxItem
    let projectMap: [String: String]
    let details: [NotificationDetailLine]?
    let isSubmitting: Bool
    let onSubmit: (NotificationInboxAction) -> Void
    let onOpenReauth: () -> Void
    let onSkip: () -> Void
    let onRequestCorrection: () -> Void

    @State private var isEvidenceExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            PipelineRailView(compact: true)
            header

            VStack(alignment: .leading, spacing: 8) {
                sectionLabel("OSの見立て")
                Text(item.title)
                    .font(.headline)
                    .foregroundStyle(AMD.text)
                    .fixedSize(horizontal: false, vertical: true)
                if item.body.isEmpty == false {
                    Text(item.body)
                        .font(.subheadline)
                        .foregroundStyle(AMD.textSub)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text("\(formatJST(item.createdAt)) / \(item.displayTarget(projectMap: projectMap))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 8) {
                sectionLabel("追加先")
                Text(actionDestination)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(AMD.text)
                sectionLabel("追加・更新する情報")
                    ForEach(actionChanges, id: \.self) { change in
                        Text("・\(change)")
                            .font(.footnote)
                            .foregroundStyle(AMD.textSub)
                            .fixedSize(horizontal: false, vertical: true)
                    }
            }

            VStack(alignment: .leading, spacing: 8) {
                sectionLabel("押すと起きること")
                Text(effectText)
                    .font(.footnote)
                    .foregroundStyle(AMD.textSub)
                    .fixedSize(horizontal: false, vertical: true)
            }

            evidenceSection

            if item.kind == "connector_auth" {
                connectorActions
            } else {
                judgmentActions
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(AMD.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(item.isUnread ? AMD.blue.opacity(0.35) : AMD.divider, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.06), radius: 10, x: 0, y: 4)
        .disabled(isSubmitting)
        .frame(maxWidth: .infinity)
    }

    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: notificationIconName(item))
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(notificationIconColor(item))
                .frame(width: 28, height: 28)

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
                Text(notificationKindLabel(item))
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.bold())
            .foregroundStyle(.secondary)
    }

    private var evidenceSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.easeOut(duration: 0.2)) {
                    isEvidenceExpanded.toggle()
                }
            } label: {
                HStack {
                    sectionLabel("根拠")
                    Spacer()
                    Image(systemName: isEvidenceExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption2.bold())
                        .foregroundStyle(.secondary)
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("根拠")
            .accessibilityValue(isEvidenceExpanded ? "展開済み" : "折りたたみ")

            if isEvidenceExpanded {
                if let details {
                    if details.isEmpty {
                        Text("この通知種別は、上のOSの見立てが確認用の本文だよ。")
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
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(.secondarySystemGroupedBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private var actionLabels: (yes: String, no: String) {
        if item.isManagementKnowledgeCandidate {
            return ("経営ノウハウに追加", "追加しない")
        }
        if item.isTextbookInsight {
            return ("BZM追記を承認", "BZMには入れない")
        }
        if item.isContractAction {
            return item.hasResolvedContractAction
                ? ("契約状態を更新", "契約状態を更新しない")
                : ("契約を特定してから判断", "契約台帳は変更しない")
        }
        if item.isGovernanceHistoryCandidate {
            let contract = item.governanceActionContract
            return (contract.approvalLabel, contract.rejectionLabel)
        }
        switch item.responseTarget.feedbackKind {
        case "ms_progress": return ("MS進捗を確定", "提案を破棄")
        case "project_registry_diff": return ("採用候補にする", "見送る")
        case "xrl_evidence": return ("根拠として確定", "不採用")
        case "meeting_summary": return ("確認した", "修正する")
        default: return ("確認を記録", "見送る")
        }
    }

    private var effectText: String {
        if item.isManagementKnowledgeCandidate {
            return "「経営ノウハウに追加」で、管理 → 経営ノウハウに「\(item.title)」を1件作成する。本文と、分類・成熟度・タグ・再利用する場面を保存する。元の会議メモ・プロトコル・BZM本文は変更しない。「追加しない」では経営ノウハウを増やさない。"
        }
        if item.isTextbookInsight {
            return "「BZM追記を承認」で、この候補をBZM追記の承認済みにする。BZM本文はこの画面では編集せず、後続のローカル反映処理が承認済み候補だけを追記する。「BZMには入れない」ではBZM本文を変更しない。"
        }
        if item.isContractAction {
            return item.contractActionEffect
        }
        if item.isGovernanceHistoryCandidate {
            return item.governanceActionContract.approvalEffect + "「追加しない」は開催履歴を増やさず候補を見送る。"
        }
        if item.kind == "connector_auth" {
            return "「再認証を開く」は連携アプリの認証画面を開くだけ。「あとで」はこのカードを後回しにして次に進むよ。"
        }
        switch item.responseTarget.feedbackKind {
        case "project_registry_diff":
            return "「\(actionLabels.yes)」は採用候補として記録するところまで。実際の台帳反映はブラウザ版の安全な反映処理が行うよ。"
        case "meeting_summary":
            return "「\(actionLabels.yes)」は確認した記録を残すだけ。要約の再抽出はしないよ。"
        case "ms_progress":
            return "「\(actionLabels.yes)」は確認待ちの修正候補をまとめて確定するよ。「\(actionLabels.no)」はその修正候補をまとめて不採用にするよ。"
        case "xrl_evidence":
            return "「\(actionLabels.yes)」は候補の根拠を確定済みへ更新するよ。「\(actionLabels.no)」は不採用へ更新するよ。"
        default:
            return "「\(actionLabels.yes)」は確認結果を記録するだけ。追加先が未定義なので、正本のデータは変更しないよ。"
        }
    }

    private var actionDestination: String {
        if item.isManagementKnowledgeCandidate { return "管理 → 経営ノウハウ" }
        if item.isTextbookInsight { return "BZM / Before Zero 実践テキスト" }
        if item.isContractAction { return "管理 → 契約" }
        if item.isGovernanceHistoryCandidate { return item.governanceActionContract.destination }
        if item.kind == "connector_auth" { return "設定 → 連携の再認証" }
        switch item.responseTarget.feedbackKind {
        case "meeting_summary": return "PJ → MTGサマリ"
        case "ms_progress": return "PJ → MS進捗"
        case "project_registry_diff": return "設定 → OS台帳差分"
        case "xrl_evidence": return "PJ → XRL根拠"
        case "coverage_gap": return "候補の追加先を確認中"
        default: return "追加先が未定義（採用で正本を変更しない）"
        }
    }

    private var actionChanges: [String] {
        if item.isManagementKnowledgeCandidate { return item.managementKnowledgeChanges }
        if item.isTextbookInsight {
            let slug = (item.metadata?["target_bzm_slug"]?.value as? String) ?? "未分類"
            let kind = (item.metadata?["practice_kind"]?.value as? String) ?? "未設定"
            return ["追記先: BZM / \(slug)", "候補の型: \(kind)"]
        }
        if item.isContractAction { return item.contractActionChanges }
        if item.isGovernanceHistoryCandidate { return item.governanceActionContract.changes }
        if item.kind == "connector_auth" { return ["連携アプリの認証状態"] }
        return [item.body.isEmpty ? "通知本文に記載の候補" : item.body]
    }

    private var judgmentActions: some View {
        VStack(spacing: 8) {
            if item.isContractAction && !item.hasResolvedContractAction {
                Text("対象の契約が未特定なので、この画面から承認・不承認はできないよ。")
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .frame(maxWidth: .infinity, alignment: .leading)
                renderActionButton(ActionButtonSpec(title: "修正・コメント", systemImage: "pencil", style: .bordered, tint: .secondary, action: onRequestCorrection))
            } else if item.responseTarget.feedbackKind == "meeting_summary" {
                TwoButtonRow(
                    primary: ActionButtonSpec(title: actionLabels.yes, systemImage: "checkmark.circle", style: .prominent, tint: AMD.blue, action: { onSubmit(.yes) }),
                    secondary: ActionButtonSpec(title: actionLabels.no, systemImage: "pencil", style: .bordered, action: onRequestCorrection)
                )
            } else {
                TwoButtonRow(
                    primary: ActionButtonSpec(title: actionLabels.yes, systemImage: "checkmark.circle", style: .prominent, tint: AMD.blue, action: { onSubmit(.yes) }),
                    secondary: ActionButtonSpec(title: actionLabels.no, systemImage: "xmark.circle", style: .destructiveBordered, action: { onSubmit(.no) })
                )
            }

            if item.responseTarget.feedbackKind != "meeting_summary" {
                renderActionButton(ActionButtonSpec(title: "修正・コメント", systemImage: "pencil", style: .bordered, tint: .secondary, action: onRequestCorrection))
            }

            renderActionButton(ActionButtonSpec(title: "あとで", systemImage: "arrow.uturn.forward", style: .bordered, tint: .secondary, action: onSkip))

            if isSubmitting {
                ProgressView("送信中...")
                    .font(.caption)
            }
        }
    }

    private var connectorActions: some View {
        VStack(spacing: 8) {
            Button {
                onOpenReauth()
            } label: {
                Label("再認証を開く", systemImage: "arrow.up.right.square")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(AMD.blue)
            .frame(minHeight: 44)

            Button {
                onSkip()
            } label: {
                Label("あとで", systemImage: "arrow.uturn.forward")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(.secondary)
            .frame(minHeight: 44)

            if let connector = item.connector {
                Text([connectorLabelJa(connector), item.reason.map(reasonLabelJa)].compactMap { $0 }.joined(separator: " / "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

}

// MARK: - NotificationInboxCard

private struct NotificationInboxCard: View {
    let item: NotificationInboxItem
    let projectMap: [String: String]
    let feedbacks: [NotificationFeedback]
    let details: [NotificationDetailLine]?
    let isExpanded: Bool
    let onToggle: () -> Void
    let onOpenReauth: () -> Void
    let onFocusJudgment: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onToggle) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: notificationIconName(item))
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(notificationIconColor(item))
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
                            Text(notificationKindLabel(item))
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
                    } else if feedbacks.isEmpty {
                        Button(action: onFocusJudgment) {
                            Label("判断カードで処理", systemImage: "checkmark.circle")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(AMD.blue)
                        .frame(minHeight: 44)
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
