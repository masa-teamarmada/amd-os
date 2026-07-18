import SwiftUI

// MARK: - Admin / Management Knowledge

private struct AMDOSP2KnowledgeOption: Identifiable {
    let value: String
    let label: String
    var id: String { value }
}

private struct AMDOSP2KnowledgeProject: Codable, Identifiable, Sendable {
    let projectId: String
    let projectName: String
    let status: String?

    var id: String { projectId }

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case projectName = "project_name"
        case status
    }
}

private struct AMDOSP2KnowledgeEntry: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String?
    let title: String
    let category: String
    let routeType: String?
    let maturity: String
    let tags: [String]
    let summary: String
    let bodyMd: String
    let reusableWhen: String?
    let nextCheck: String?
    let sourceKind: String
    let sourceRef: String?
    let sourceExcerpt: String?
    let confidence: Double
    let status: String
    let createdBy: String?
    let updatedBy: String?
    let archivedAt: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case title, category
        case routeType = "route_type"
        case maturity, tags, summary
        case bodyMd = "body_md"
        case reusableWhen = "reusable_when"
        case nextCheck = "next_check"
        case sourceKind = "source_kind"
        case sourceRef = "source_ref"
        case sourceExcerpt = "source_excerpt"
        case confidence, status
        case createdBy = "created_by"
        case updatedBy = "updated_by"
        case archivedAt = "archived_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        projectId = try container.decodeIfPresent(String.self, forKey: .projectId)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
        category = try container.decodeIfPresent(String.self, forKey: .category) ?? "other"
        routeType = try container.decodeIfPresent(String.self, forKey: .routeType)
        maturity = try container.decodeIfPresent(String.self, forKey: .maturity) ?? "hypothesis"
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        summary = try container.decodeIfPresent(String.self, forKey: .summary) ?? ""
        bodyMd = try container.decodeIfPresent(String.self, forKey: .bodyMd) ?? ""
        reusableWhen = try container.decodeIfPresent(String.self, forKey: .reusableWhen)
        nextCheck = try container.decodeIfPresent(String.self, forKey: .nextCheck)
        sourceKind = try container.decodeIfPresent(String.self, forKey: .sourceKind) ?? "manual"
        sourceRef = try container.decodeIfPresent(String.self, forKey: .sourceRef)
        sourceExcerpt = try container.decodeIfPresent(String.self, forKey: .sourceExcerpt)
        confidence = try container.decodeIfPresent(Double.self, forKey: .confidence) ?? 0.5
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "active"
        createdBy = try container.decodeIfPresent(String.self, forKey: .createdBy)
        updatedBy = try container.decodeIfPresent(String.self, forKey: .updatedBy)
        archivedAt = try container.decodeIfPresent(String.self, forKey: .archivedAt)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    }
}

private struct AMDOSP2KnowledgeEnvelope: Codable, Sendable {
    let ok: Bool
    let entries: [AMDOSP2KnowledgeEntry]?
    let error: String?
}

private struct AMDOSP2KnowledgeMutationEnvelope: Codable, Sendable {
    let ok: Bool
    let entry: AMDOSP2KnowledgeEntry?
    let error: String?
}

private struct AMDOSP2KnowledgePayload: Encodable, Sendable {
    let id: String?
    let projectId: String?
    let title: String
    let category: String
    let routeType: String?
    let maturity: String
    let tags: [String]
    let summary: String
    let bodyMd: String
    let reusableWhen: String?
    let nextCheck: String?
    let sourceKind: String
    let sourceRef: String?
    let sourceExcerpt: String?
    let confidence: Double
    let status: String
}

private struct AMDOSP2KnowledgeDraft: Identifiable {
    var id: String?
    var projectId = ""
    var title = ""
    var category = "commercialization_route"
    var routeType = ""
    var maturity = "hypothesis"
    var tagsText = ""
    var summary = ""
    var bodyMd = ""
    var reusableWhen = ""
    var nextCheck = ""
    var sourceKind = "manual"
    var sourceRef = ""
    var sourceExcerpt = ""
    var confidence = 0.5
    var status = "active"

    var stableID: String { id ?? "new" }

    init() {}

    init(entry: AMDOSP2KnowledgeEntry) {
        id = entry.id
        projectId = entry.projectId ?? ""
        title = entry.title
        category = entry.category
        routeType = entry.routeType ?? ""
        maturity = entry.maturity
        tagsText = entry.tags.joined(separator: ", ")
        summary = entry.summary
        bodyMd = entry.bodyMd
        reusableWhen = entry.reusableWhen ?? ""
        nextCheck = entry.nextCheck ?? ""
        sourceKind = entry.sourceKind
        sourceRef = entry.sourceRef ?? ""
        sourceExcerpt = entry.sourceExcerpt ?? ""
        confidence = entry.confidence
        status = entry.status
    }
}

private struct AMDOSP2KnowledgeGroup: Identifiable {
    let category: String
    let entries: [AMDOSP2KnowledgeEntry]
    var id: String { category }
}

struct AMDOSP2ManagementKnowledgeView: View {
    private static let categories = [
        AMDOSP2KnowledgeOption(value: "commercialization_route", label: "事業化ルート"),
        AMDOSP2KnowledgeOption(value: "coalition_design", label: "組成 / 座組"),
        AMDOSP2KnowledgeOption(value: "pricing", label: "価格 / 対価"),
        AMDOSP2KnowledgeOption(value: "sales", label: "営業 / 顧客"),
        AMDOSP2KnowledgeOption(value: "finance", label: "財務 / 資金"),
        AMDOSP2KnowledgeOption(value: "governance", label: "ガバナンス"),
        AMDOSP2KnowledgeOption(value: "organization", label: "組織 / 人"),
        AMDOSP2KnowledgeOption(value: "fundraising", label: "資本政策"),
        AMDOSP2KnowledgeOption(value: "legal", label: "法務論点"),
        AMDOSP2KnowledgeOption(value: "operations", label: "運用"),
        AMDOSP2KnowledgeOption(value: "other", label: "その他"),
    ]
    private static let maturities = [
        AMDOSP2KnowledgeOption(value: "raw_note", label: "raw_note"),
        AMDOSP2KnowledgeOption(value: "hypothesis", label: "hypothesis"),
        AMDOSP2KnowledgeOption(value: "field_tested", label: "field_tested"),
        AMDOSP2KnowledgeOption(value: "playbook", label: "playbook"),
    ]
    private static let sourceKinds = [
        AMDOSP2KnowledgeOption(value: "manual", label: "手入力"),
        AMDOSP2KnowledgeOption(value: "codex", label: "Codex"),
        AMDOSP2KnowledgeOption(value: "slack", label: "Slack"),
        AMDOSP2KnowledgeOption(value: "gmail", label: "Gmail"),
        AMDOSP2KnowledgeOption(value: "notion", label: "Notion"),
        AMDOSP2KnowledgeOption(value: "drive", label: "Drive"),
        AMDOSP2KnowledgeOption(value: "calendar", label: "Calendar"),
        AMDOSP2KnowledgeOption(value: "meeting", label: "MTG"),
        AMDOSP2KnowledgeOption(value: "file", label: "File"),
        AMDOSP2KnowledgeOption(value: "other", label: "その他"),
    ]
    private static let statuses = [
        AMDOSP2KnowledgeOption(value: "active", label: "active"),
        AMDOSP2KnowledgeOption(value: "needs_review", label: "needs_review"),
        AMDOSP2KnowledgeOption(value: "archived", label: "archived"),
    ]

    @State private var entries: [AMDOSP2KnowledgeEntry] = []
    @State private var projects: [AMDOSP2KnowledgeProject] = []
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var query = ""
    @State private var projectFilter = ""
    @State private var categoryFilter = ""
    @State private var maturityFilter = ""
    @State private var tagFilter = ""
    @State private var statusFilter = "active"
    @State private var draft: AMDOSP2KnowledgeDraft?
    @State private var isCreating = false
    @State private var saving = false
    @State private var message: String?
    @State private var archiveCandidate: AMDOSP2KnowledgeEntry?

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "MANAGEMENT KNOWLEDGE",
            title: "経営ノウハウ",
            subtitle: "PWAと同じ判断カードを、分類・成熟度・出典・再利用条件ごとに編集する"
        ) {
            HStack {
                Text("PJをまたいで再利用する判断カード。保存・archive は PWA の admin API だけを使うよ。")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("追加", systemImage: "plus") { beginCreate() }
                    .buttonStyle(.borderedProminent)
            }
            metrics
            filters
            AMDOSStateNotice(state: state) { load() }
            AMDOSP1AdminMessage(text: message)
            if let draft { editor(draft) }
            Text("\(filteredEntries.count) 件表示").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if groups.isEmpty && state == .loaded {
                ContentUnavailableView("条件に合うカードはまだないよ", systemImage: "books.vertical", description: Text("絞り込み条件を戻すか、新しい判断カードを追加してね。"))
            }
            ForEach(groups) { group in
                AMDOSSectionCard(categoryLabel(group.category), systemImage: "square.stack.3d.up") {
                    Text("\(group.entries.count) cards").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    ForEach(group.entries) { entry in entryView(entry) }
                }
            }
        }
        .task { load() }
        .confirmationDialog(
            "このカードをarchiveにする？",
            isPresented: Binding(get: { archiveCandidate != nil }, set: { if !$0 { archiveCandidate = nil } })
        ) {
            Button("archive", role: .destructive) {
                if let entry = archiveCandidate { archive(entry) }
            }
        } message: {
            Text(archiveCandidate?.title ?? "")
        }
    }

    @ViewBuilder private var metrics: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                AMDOSMetricTile(label: "total", value: "\(entries.count)", detail: "全カード")
                AMDOSMetricTile(label: "active", value: "\(entries.filter { $0.status == "active" }.count)", detail: "利用中", tint: AMDOSDesign.success)
                AMDOSMetricTile(label: "hypothesis", value: "\(entries.filter { $0.maturity == "hypothesis" }.count)", detail: "検証前")
                AMDOSMetricTile(label: "playbook", value: "\(entries.filter { $0.maturity == "playbook" }.count)", detail: "再利用可能", tint: AMDOSDesign.blue)
            }
        }
    }

    @ViewBuilder private var filters: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 9) {
                TextField("型 / 条件 / source / tag", text: $query)
                    .textFieldStyle(.roundedBorder)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .bottom, spacing: 10) {
                        Picker("PJ", selection: $projectFilter) {
                            Text("全て").tag("")
                            ForEach(projects) { project in
                                Text("\(project.projectId) \(project.projectName)").tag(project.projectId)
                            }
                        }
                        Picker("分類", selection: $categoryFilter) {
                            Text("全て").tag("")
                            ForEach(Self.categories) { option in Text(option.label).tag(option.value) }
                        }
                        Picker("maturity", selection: $maturityFilter) {
                            Text("全て").tag("")
                            ForEach(Self.maturities) { option in Text(option.label).tag(option.value) }
                        }
                        Picker("tag", selection: $tagFilter) {
                            Text("全て").tag("")
                            ForEach(allTags, id: \.self) { Text($0).tag($0) }
                        }
                        Picker("status", selection: $statusFilter) {
                            Text("全て").tag("")
                            ForEach(Self.statuses) { option in Text(option.label).tag(option.value) }
                        }
                        Button("リセット") { resetFilters() }.buttonStyle(.bordered)
                    }
                }
            }
        }
    }

    @ViewBuilder private func editor(_ current: AMDOSP2KnowledgeDraft) -> some View {
        AMDOSSectionCard(isCreating ? "経営ノウハウ 追加" : "経営ノウハウ 編集", systemImage: "square.and.pencil") {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Picker("PJ", selection: stringBinding(\.projectId)) {
                        Text("AMD全体 / 未紐付け").tag("")
                        ForEach(projects) { project in
                            Text("\(project.projectId) \(project.projectName)").tag(project.projectId)
                        }
                    }
                    Picker("分類", selection: stringBinding(\.category)) {
                        ForEach(Self.categories) { option in Text(option.label).tag(option.value) }
                    }
                }
                HStack {
                    Picker("maturity", selection: stringBinding(\.maturity)) {
                        ForEach(Self.maturities) { option in Text(option.label).tag(option.value) }
                    }
                    Picker("status", selection: stringBinding(\.status)) {
                        ForEach(Self.statuses) { option in Text(option.label).tag(option.value) }
                    }
                }
                AMDOSTextField(title: "タイトル *", text: stringBinding(\.title))
                HStack {
                    AMDOSTextField(title: "route_type", text: stringBinding(\.routeType))
                    AMDOSTextField(title: "tags", text: stringBinding(\.tagsText))
                }
            }
            AMDOSTextField(title: "要約 *", text: stringBinding(\.summary), axis: .vertical)
            AMDOSTextField(title: "本文 Markdown", text: stringBinding(\.bodyMd), axis: .vertical)
            HStack(alignment: .top) {
                AMDOSTextField(title: "再利用条件", text: stringBinding(\.reusableWhen), axis: .vertical)
                AMDOSTextField(title: "次に確認する論点", text: stringBinding(\.nextCheck), axis: .vertical)
            }
            HStack(alignment: .top) {
                Picker("source", selection: stringBinding(\.sourceKind)) {
                    ForEach(Self.sourceKinds) { option in Text(option.label).tag(option.value) }
                }
                TextField("confidence 0〜1", value: numberBinding(\.confidence), format: .number)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 140)
            }
            AMDOSTextField(title: "source_ref", text: stringBinding(\.sourceRef))
            AMDOSTextField(title: "source_excerpt", text: stringBinding(\.sourceExcerpt), axis: .vertical)
            HStack {
                Spacer()
                Button("キャンセル") { closeEditor() }.buttonStyle(.bordered)
                Button(saving ? "保存中…" : "保存") { save() }
                    .buttonStyle(.borderedProminent)
                    .disabled(saving || !isDraftValid)
            }
        }
    }

    @ViewBuilder private func entryView(_ entry: AMDOSP2KnowledgeEntry) -> some View {
        AMDOSCard {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 7) {
                    HStack(spacing: 6) {
                        Text(entry.title).font(.headline)
                        AMDOSStatusBadge(text: entry.maturity)
                        if let routeType = entry.routeType, !routeType.isEmpty { AMDOSStatusBadge(text: routeType, tint: AMDOSDesign.blue) }
                    }
                    Text(entry.summary).font(.subheadline)
                    if entry.reusableWhen != nil || entry.nextCheck != nil {
                        HStack(alignment: .top, spacing: 12) {
                            if let reusableWhen = entry.reusableWhen, !reusableWhen.isEmpty {
                                labeledDetail("再利用条件", reusableWhen)
                            }
                            if let nextCheck = entry.nextCheck, !nextCheck.isEmpty {
                                labeledDetail("次に確認", nextCheck)
                            }
                        }
                    }
                    if !entry.bodyMd.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(entry.bodyMd).font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
                    }
                    if !entry.tags.isEmpty {
                        HStack(spacing: 5) {
                            ForEach(entry.tags, id: \.self) { tag in
                                Button("#\(tag)") { tagFilter = tag }.buttonStyle(.bordered)
                            }
                        }
                    }
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 6) {
                    Text(sourceLabel(entry.sourceKind)).font(.caption.weight(.semibold))
                    Text("conf \(Int((entry.confidence * 100).rounded()))%").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    Text(projectLabel(entry.projectId)).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(1)
                    if let sourceRef = entry.sourceRef, !sourceRef.isEmpty { Text(sourceRef).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(2) }
                    if let sourceExcerpt = entry.sourceExcerpt, !sourceExcerpt.isEmpty { Text(sourceExcerpt).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(3) }
                    Text("更新 \(amdosp1CompactDate(entry.updatedAt))").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    HStack {
                        Button("編集") { beginEdit(entry) }.buttonStyle(.bordered)
                        if entry.status != "archived" {
                            Button("archive", role: .destructive) { archiveCandidate = entry }.buttonStyle(.bordered)
                        }
                    }
                }
                .frame(maxWidth: 250, alignment: .trailing)
            }
        }
    }

    private func labeledDetail(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
            Text(value).font(.caption).textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(7)
        .background(AMDOSDesign.panel)
        .clipShape(RoundedRectangle(cornerRadius: 7))
    }

    private var allTags: [String] {
        Array(Set(entries.flatMap(\.tags))).sorted { $0.localizedCompare($1) == .orderedAscending }
    }

    private var filteredEntries: [AMDOSP2KnowledgeEntry] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return entries.filter { entry in
            guard (projectFilter.isEmpty || entry.projectId == projectFilter),
                  (categoryFilter.isEmpty || entry.category == categoryFilter),
                  (maturityFilter.isEmpty || entry.maturity == maturityFilter),
                  (statusFilter.isEmpty || entry.status == statusFilter),
                  (tagFilter.isEmpty || entry.tags.contains(tagFilter)) else { return false }
            guard !needle.isEmpty else { return true }
            let haystack = [
                entry.title, entry.summary, entry.bodyMd, entry.reusableWhen ?? "", entry.nextCheck ?? "",
                entry.routeType ?? "", entry.sourceRef ?? "", entry.sourceExcerpt ?? "", entry.tags.joined(separator: " "),
                projects.first(where: { $0.projectId == entry.projectId })?.projectName ?? "",
            ].joined(separator: " ")
            return haystack.localizedCaseInsensitiveContains(needle)
        }
    }

    private var groups: [AMDOSP2KnowledgeGroup] {
        let values = Dictionary(grouping: filteredEntries, by: \.category)
        let order = Dictionary(uniqueKeysWithValues: Self.categories.enumerated().map { ($0.element.value, $0.offset) })
        return values.keys.sorted { (order[$0] ?? 99) < (order[$1] ?? 99) }.map { category in
            AMDOSP2KnowledgeGroup(category: category, entries: values[category] ?? [])
        }
    }

    private var isDraftValid: Bool {
        guard let draft else { return false }
        return !draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !draft.summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func stringBinding(_ keyPath: WritableKeyPath<AMDOSP2KnowledgeDraft, String>) -> Binding<String> {
        Binding(
            get: { draft?[keyPath: keyPath] ?? "" },
            set: { value in
                guard var next = draft else { return }
                next[keyPath: keyPath] = value
                draft = next
            }
        )
    }

    private func numberBinding(_ keyPath: WritableKeyPath<AMDOSP2KnowledgeDraft, Double>) -> Binding<Double> {
        Binding(
            get: { draft?[keyPath: keyPath] ?? 0.5 },
            set: { value in
                guard var next = draft else { return }
                next[keyPath: keyPath] = min(1, max(0, value))
                draft = next
            }
        )
    }

    private func beginCreate() {
        draft = AMDOSP2KnowledgeDraft()
        draft?.projectId = projectFilter
        draft?.category = categoryFilter.isEmpty ? "commercialization_route" : categoryFilter
        isCreating = true
        message = nil
    }

    private func beginEdit(_ entry: AMDOSP2KnowledgeEntry) {
        draft = AMDOSP2KnowledgeDraft(entry: entry)
        isCreating = false
        message = nil
    }

    private func closeEditor() {
        draft = nil
        isCreating = false
    }

    private func resetFilters() {
        query = ""
        projectFilter = ""
        categoryFilter = ""
        maturityFilter = ""
        tagFilter = ""
        statusFilter = "active"
    }

    private func payload(for draft: AMDOSP2KnowledgeDraft, status: String? = nil) -> AMDOSP2KnowledgePayload {
        AMDOSP2KnowledgePayload(
            id: draft.id,
            projectId: draft.projectId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : draft.projectId,
            title: draft.title,
            category: draft.category,
            routeType: draft.routeType.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : draft.routeType,
            maturity: draft.maturity,
            tags: amdosp2NormalizedTags(draft.tagsText),
            summary: draft.summary,
            bodyMd: draft.bodyMd,
            reusableWhen: draft.reusableWhen.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : draft.reusableWhen,
            nextCheck: draft.nextCheck.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : draft.nextCheck,
            sourceKind: draft.sourceKind,
            sourceRef: draft.sourceRef.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : draft.sourceRef,
            sourceExcerpt: draft.sourceExcerpt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : draft.sourceExcerpt,
            confidence: min(1, max(0, draft.confidence)),
            status: status ?? draft.status
        )
    }

    private func archivePayload(for entry: AMDOSP2KnowledgeEntry) -> AMDOSP2KnowledgePayload {
        payload(for: AMDOSP2KnowledgeDraft(entry: entry), status: "archived")
    }

    private func apply(_ entry: AMDOSP2KnowledgeEntry, inserting: Bool) {
        if inserting { entries.insert(entry, at: 0) }
        else if let index = entries.firstIndex(where: { $0.id == entry.id }) { entries[index] = entry }
    }

    private func load() {
        Task {
            state = .loading
            do {
                let envelope = try await AMDOSRESTClient.shared.fetchPWA(AMDOSP2KnowledgeEnvelope.self, path: "/api/admin/management-knowledge")
                guard envelope.ok else { throw AMDOSNetworkError.http(envelope.error ?? "経営ノウハウを読み込めなかったよ") }
                entries = envelope.entries ?? []
                projects = try await AMDOSRESTClient.shared.fetchTable(
                    AMDOSP2KnowledgeProject.self,
                    table: "projects",
                    select: "project_id,project_name,status",
                    order: "status,project_name",
                    limit: 500
                )
                state = entries.isEmpty ? .empty : .loaded
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    private func save() {
        guard let draft, isDraftValid else { return }
        saving = true
        Task {
            do {
                let data: Data
                if isCreating {
                    data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/management-knowledge", body: payload(for: draft))
                } else {
                    data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/management-knowledge", method: "PATCH", body: payload(for: draft))
                }
                let response = try JSONDecoder().decode(AMDOSP2KnowledgeMutationEnvelope.self, from: data)
                guard response.ok, let entry = response.entry else { throw AMDOSNetworkError.http(response.error ?? "ナレッジを保存できなかったよ") }
                apply(entry, inserting: isCreating)
                message = "\(entry.title) を保存したよ"
                closeEditor()
            } catch {
                message = "保存エラー: \(error.localizedDescription)"
            }
            saving = false
        }
    }

    private func archive(_ entry: AMDOSP2KnowledgeEntry) {
        archiveCandidate = nil
        saving = true
        Task {
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/management-knowledge",
                    method: "PATCH",
                    body: archivePayload(for: entry)
                )
                let response = try JSONDecoder().decode(AMDOSP2KnowledgeMutationEnvelope.self, from: data)
                guard response.ok, let archived = response.entry else { throw AMDOSNetworkError.http(response.error ?? "archiveできなかったよ") }
                apply(archived, inserting: false)
                message = "\(entry.title) をarchiveにしたよ"
            } catch {
                message = "archiveエラー: \(error.localizedDescription)"
            }
            saving = false
        }
    }

    private func categoryLabel(_ value: String) -> String {
        Self.categories.first(where: { $0.value == value })?.label ?? value
    }

    private func sourceLabel(_ value: String) -> String {
        Self.sourceKinds.first(where: { $0.value == value })?.label ?? value
    }

    private func projectLabel(_ projectID: String?) -> String {
        guard let projectID else { return "AMD全体" }
        guard let project = projects.first(where: { $0.projectId == projectID }) else { return projectID }
        return "\(project.projectId) \(project.projectName)"
    }
}

// MARK: - Admin / Monthly work agreements

private struct AMDOSP2AgreementMember: Codable, Sendable {
    let memberId: String
    let codeName: String
    let email: String?
}

private struct AMDOSP2AgreementRow: Codable, Identifiable, Sendable {
    let member: AMDOSP2AgreementMember
    let status: String
    let currentHash: String
    let revisionRequestCount: Int
    let latestRevisionRequestAt: String?
    let projectCount: Int
    let reviewRequiredCount: Int
    let expectedRewardYen: Double?
    let payoutYen: Double?
    let stockYen: Double?
    let grossDueYen: Double?
    let carryInYen: Double?
    let projectNames: [String]

    var id: String { member.memberId }
}

private struct AMDOSP2AgreementTotals: Codable, Sendable {
    let members: Int
    let agreed: Int
    let pending: Int
    let needsReagreement: Int
    let reviewRequired: Int
    let revisionRequests: Int
    let expectedRewardYen: Double?
    let payoutYen: Double?
    let stockYen: Double?
}

private struct AMDOSP2AgreementData: Codable, Sendable {
    let ym: String
    let tableReady: Bool
    let rows: [AMDOSP2AgreementRow]
    let totals: AMDOSP2AgreementTotals
}

private struct AMDOSP2AgreementEnvelope: Codable, Sendable {
    let ok: Bool
    let data: AMDOSP2AgreementData?
    let error: String?
}

struct AMDOSP2MonthlyAgreementsView: View {
    let onOpenAgreement: (String, String) -> Void
    let onOpenMypage: (String) -> Void

    @State private var ym = ""
    @State private var query = ""
    @State private var data: AMDOSP2AgreementData?
    @State private var state: AMDOSFeatureLoadState = .idle

    init(
        onOpenAgreement: @escaping (String, String) -> Void = { _, _ in },
        onOpenMypage: @escaping (String) -> Void = { _ in }
    ) {
        self.onOpenAgreement = onOpenAgreement
        self.onOpenMypage = onOpenMypage
    }

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "MONTHLY AGREEMENTS",
            title: "月初タスク・報酬合意",
            subtitle: "PWAと同じ月のメンバー別合意状態、修正要望、支払・未払い残を確認する"
        ) {
            HStack {
                TextField("YYYYMM", text: $ym).textFieldStyle(.roundedBorder).frame(width: 110)
                Button("更新", systemImage: "arrow.clockwise") { load() }.buttonStyle(.bordered)
                Spacer()
                Text(agreementYMLabel(ym)).font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            AMDOSStateNotice(state: state) { load() }
            if let data {
                if !data.tableReady {
                    AMDOSCard {
                        Label("合意保存テーブルが未適用。migration適用後に既存合意との照合が有効になるよ。", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption).foregroundStyle(AMDOSDesign.warning)
                    }
                }
                metrics(data.totals)
                AMDOSCard {
                    TextField("member / PJ / status で検索", text: $query)
                        .textFieldStyle(.roundedBorder)
                }
                agreementTable
            }
        }
        .task {
            if ym.isEmpty { ym = amdosp2CurrentYM() }
            load()
        }
    }

    @ViewBuilder private func metrics(_ totals: AMDOSP2AgreementTotals) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 10) {
                AMDOSMetricTile(label: "対象メンバー", value: "\(totals.members)", detail: "今月")
                AMDOSMetricTile(label: "合意済み", value: "\(totals.agreed)", detail: "確認完了", tint: AMDOSDesign.success)
                AMDOSMetricTile(label: "未合意", value: "\(totals.pending)", detail: "要確認", tint: totals.pending > 0 ? AMDOSDesign.warning : AMDOSDesign.muted)
                AMDOSMetricTile(label: "条件更新あり", value: "\(totals.needsReagreement)", detail: "再合意", tint: totals.needsReagreement > 0 ? AMDOSDesign.warning : AMDOSDesign.muted)
                AMDOSMetricTile(label: "修正要望", value: "\(totals.revisionRequests)", detail: "open", tint: totals.revisionRequests > 0 ? AMDOSDesign.warning : AMDOSDesign.muted)
                AMDOSMetricTile(label: "今月支払", value: agreementYen(totals.payoutYen), detail: "payout", tint: (totals.payoutYen ?? 0) > 0 ? AMDOSDesign.success : AMDOSDesign.muted)
                AMDOSMetricTile(label: "未払いストック残", value: agreementYen(totals.stockYen), detail: "月末", tint: (totals.stockYen ?? 0) > 0 ? AMDOSDesign.warning : AMDOSDesign.muted)
            }
        }
    }

    @ViewBuilder private var agreementTable: some View {
        let rows = filteredRows
        if rows.isEmpty {
            ContentUnavailableView("対象メンバーなし", systemImage: "person.2.slash", description: Text("検索条件を変えてみてね。"))
        } else {
            ScrollView(.horizontal) {
                VStack(alignment: .leading, spacing: 0) {
                    agreementHeader
                    ForEach(rows) { row in agreementRow(row) }
                }
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(AMDOSDesign.border, lineWidth: 1))
            }
        }
    }

    private var agreementHeader: some View {
        HStack(spacing: 0) {
            agreementHeaderCell("Member", width: 160)
            agreementHeaderCell("Status", width: 130)
            agreementHeaderCell("PJ", width: 54, alignment: .trailing)
            agreementHeaderCell("今月支払", width: 130, alignment: .trailing)
            agreementHeaderCell("未払い残", width: 130, alignment: .trailing)
            agreementHeaderCell("PJ / 確認事項 / 修正要望", width: 330)
            agreementHeaderCell("Detail", width: 160, alignment: .trailing)
        }
        .background(AMDOSDesign.panel)
    }

    private func agreementHeaderCell(_ title: String, width: CGFloat, alignment: Alignment = .leading) -> some View {
        Text(title).font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
            .frame(width: width, alignment: alignment).padding(9).overlay(alignment: .trailing) { Divider() }
    }

    private func agreementRow(_ row: AMDOSP2AgreementRow) -> some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.member.codeName).font(.subheadline.weight(.semibold))
                Text(row.member.memberId).font(.caption2).foregroundStyle(AMDOSDesign.muted)
            }.frame(width: 160, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
            AMDOSStatusBadge(text: agreementStatusLabel(row.status), tint: agreementStatusTint(row.status))
                .frame(width: 130, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
            Text("\(row.projectCount)").font(.body.monospacedDigit()).frame(width: 54, alignment: .trailing).padding(9).overlay(alignment: .trailing) { Divider() }
            VStack(alignment: .trailing, spacing: 2) {
                Text(agreementYen(row.payoutYen)).font(.subheadline.weight(.semibold)).foregroundStyle((row.payoutYen ?? 0) > 0 ? AMDOSDesign.success : AMDOSDesign.ink)
                Text("予定 \(agreementYen(row.expectedRewardYen))").font(.caption2).foregroundStyle(AMDOSDesign.muted)
            }.frame(width: 130, alignment: .trailing).padding(9).overlay(alignment: .trailing) { Divider() }
            VStack(alignment: .trailing, spacing: 2) {
                Text((row.stockYen ?? 0) > 0 ? agreementYen(row.stockYen) : "-").font(.subheadline.weight(.semibold)).foregroundStyle((row.stockYen ?? 0) > 0 ? AMDOSDesign.warning : AMDOSDesign.muted)
                if (row.stockYen ?? 0) > 0 { Text("今月末").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
            }.frame(width: 130, alignment: .trailing).padding(9).overlay(alignment: .trailing) { Divider() }
            VStack(alignment: .leading, spacing: 3) {
                Text(row.projectNames.isEmpty ? "参加PJなし" : row.projectNames.joined(separator: " / ")).font(.caption)
                Text("確認事項 \(row.reviewRequiredCount) / 修正要望 \(row.revisionRequestCount) / hash \(String(row.currentHash.prefix(10)))")
                    .font(.caption2).foregroundStyle(row.reviewRequiredCount > 0 || row.revisionRequestCount > 0 ? AMDOSDesign.warning : AMDOSDesign.muted)
                if let latest = row.latestRevisionRequestAt { Text("最新要望 \(amdosp1CompactDate(latest))").font(.caption2).foregroundStyle(AMDOSDesign.warning) }
            }.frame(width: 330, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
            HStack(spacing: 6) {
                Button("表示") { onOpenAgreement(ym, row.member.memberId) }.buttonStyle(.bordered)
                Button("mypage") { onOpenMypage(row.member.memberId) }.buttonStyle(.bordered)
            }.frame(width: 160, alignment: .trailing).padding(9)
        }
        .background(AMDOSDesign.page)
        .overlay(alignment: .bottom) { Divider() }
    }

    private var filteredRows: [AMDOSP2AgreementRow] {
        guard let data else { return [] }
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return data.rows }
        return data.rows.filter { row in
            [row.member.memberId, row.member.codeName, row.member.email ?? "", row.status, row.projectNames.joined(separator: " ")]
                .joined(separator: " ")
                .localizedCaseInsensitiveContains(needle)
        }
    }

    private func load() {
        Task {
            guard ym.range(of: "^\\d{6}$", options: .regularExpression) != nil else {
                state = .failed("年月は YYYYMM で入力してね")
                return
            }
            state = .loading
            do {
                let envelope = try await AMDOSRESTClient.shared.fetchPWA(
                    AMDOSP2AgreementEnvelope.self,
                    path: "/api/admin/monthly-work-agreements",
                    query: ["ym": ym]
                )
                guard envelope.ok, let payload = envelope.data else { throw AMDOSNetworkError.http(envelope.error ?? "月初合意を読み込めなかったよ") }
                data = payload
                state = payload.rows.isEmpty ? .empty : .loaded
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }
}

// MARK: - Admin / Coverage gaps

private struct AMDOSP2CoverageGap: Codable, Identifiable, Sendable {
    let id: String
    let source: String?
    let sourceRef: String?
    let title: String?
    let summary: String?
    let salienceScore: Double?
    let proposedTarget: String?
    let gapClass: String?
    let projectId: String?
    let scope: String?
    let dueAt: String?
    let reviewStatus: String?
    let routedTo: String?
    let detectedAt: String?

    enum CodingKeys: String, CodingKey {
        case id = "gap_id"
        case source
        case sourceRef = "source_ref"
        case title, summary
        case salienceScore = "salience_score"
        case proposedTarget = "proposed_target_l2"
        case gapClass = "gap_class"
        case projectId = "project_id"
        case scope
        case dueAt = "due_at"
        case reviewStatus = "review_status"
        case routedTo = "routed_to"
        case detectedAt = "detected_at"
    }
}

struct AMDOSP2CoverageGapsView: View {
    let onOpenNotifications: () -> Void

    @State private var rows: [AMDOSP2CoverageGap] = []
    @State private var state: AMDOSFeatureLoadState = .idle

    init(onOpenNotifications: @escaping () -> Void = {}) {
        self.onOpenNotifications = onOpenNotifications
    }

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "COVERAGE GAPS",
            title: "Coverage Scanner",
            subtitle: "重要なのに既存L2へ構造化されていない候補を確認する。採否は通知画面で行う。"
        ) {
            HStack {
                Text("PWAと同じく、ここは読み取りと再現性指標だけ。採否の操作は通知で続けるよ。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("通知で採否を見る", systemImage: "bell") { onOpenNotifications() }
                    .buttonStyle(.bordered)
            }
            metrics
            AMDOSStateNotice(state: state) { load() }
            if !rows.isEmpty { gapTable }
        }
        .task { load() }
    }

    @ViewBuilder private var metrics: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                AMDOSMetricTile(label: "未レビュー候補", value: "\(candidates.count)", detail: "通知で はい/いいえ", tint: candidates.isEmpty ? AMDOSDesign.muted : AMDOSDesign.warning)
                AMDOSMetricTile(label: "Scanner precision", value: percentage(precision), detail: "confirmed / reviewed")
                AMDOSMetricTile(label: "Extractor-miss率", value: percentage(extractorMissRate), detail: "低いほど抽出器が育つ")
                AMDOSMetricTile(label: "構造的GAP", value: "\(structural.count)", detail: "受け皿の検討", tint: structural.isEmpty ? AMDOSDesign.muted : AMDOSDesign.warning)
                AMDOSMetricTile(label: "期日7日以内", value: "\(dueSoon.count)", detail: "埋もれさせない", tint: dueSoon.isEmpty ? AMDOSDesign.muted : AMDOSDesign.warning)
            }
        }
    }

    @ViewBuilder private var gapTable: some View {
        ScrollView(.horizontal) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 0) {
                    coverageHeader("状態", width: 120)
                    coverageHeader("判定", width: 170)
                    coverageHeader("件名", width: 310)
                    coverageHeader("入れ先候補", width: 150)
                    coverageHeader("PJ", width: 110)
                    coverageHeader("source", width: 100)
                    coverageHeader("期日", width: 120)
                    coverageHeader("salience", width: 90, alignment: .trailing)
                    coverageHeader("検知", width: 120)
                }.background(AMDOSDesign.panel)
                ForEach(rows) { row in coverageRow(row) }
            }
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(AMDOSDesign.border, lineWidth: 1))
        }
    }

    private func coverageHeader(_ title: String, width: CGFloat, alignment: Alignment = .leading) -> some View {
        Text(title).font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
            .frame(width: width, alignment: alignment).padding(9).overlay(alignment: .trailing) { Divider() }
    }

    private func coverageRow(_ row: AMDOSP2CoverageGap) -> some View {
        HStack(alignment: .top, spacing: 0) {
            AMDOSStatusBadge(text: row.reviewStatus ?? "candidate", tint: coverageStatusTint(row.reviewStatus))
                .frame(width: 120, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
            Text(coverageClassLabel(row.gapClass)).font(.caption).frame(width: 170, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
            VStack(alignment: .leading, spacing: 3) {
                Text(row.title ?? "(no title)").font(.caption.weight(.semibold)).lineLimit(2)
                if let summary = row.summary, !summary.isEmpty { Text(summary).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(2) }
            }.frame(width: 310, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
            Text(row.proposedTarget ?? "未確定").font(.caption).frame(width: 150, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
            Text(row.projectId ?? row.scope ?? "").font(.caption).frame(width: 110, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
            Text(row.source ?? "").font(.caption).frame(width: 100, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
            Text(amdosp1CompactDate(row.dueAt)).font(.caption).frame(width: 120, alignment: .leading).padding(9).overlay(alignment: .trailing) { Divider() }
            Text(row.salienceScore.map { String(format: "%.2f", $0) } ?? "").font(.caption.monospacedDigit()).frame(width: 90, alignment: .trailing).padding(9).overlay(alignment: .trailing) { Divider() }
            Text(amdosp1CompactDate(row.detectedAt)).font(.caption2).foregroundStyle(AMDOSDesign.muted).frame(width: 120, alignment: .leading).padding(9)
        }
        .background(AMDOSDesign.page)
        .overlay(alignment: .bottom) { Divider() }
    }

    private var candidates: [AMDOSP2CoverageGap] { rows.filter { $0.reviewStatus == "candidate" } }
    private var confirmed: [AMDOSP2CoverageGap] { rows.filter { $0.reviewStatus == "confirmed" } }
    private var rejected: [AMDOSP2CoverageGap] { rows.filter { $0.reviewStatus == "rejected" } }
    private var precision: Double? {
        let reviewed = confirmed.count + rejected.count
        guard reviewed > 0 else { return nil }
        return Double(confirmed.count) / Double(reviewed)
    }
    private var structural: [AMDOSP2CoverageGap] { rows.filter { $0.gapClass == "structural_gap" && $0.reviewStatus != "rejected" } }
    private var extractorMissRate: Double? {
        guard !confirmed.isEmpty else { return nil }
        return Double(confirmed.filter { $0.gapClass == "extractor_miss" }.count) / Double(confirmed.count)
    }
    private var dueSoon: [AMDOSP2CoverageGap] {
        let deadline = Date().addingTimeInterval(7 * 86_400)
        return candidates.filter { gap in
            guard let date = amdosp2Date(gap.dueAt) else { return false }
            return date < deadline
        }
    }

    private func load() {
        Task {
            state = .loading
            do {
                rows = try await AMDOSRESTClient.shared.fetchTable(
                    AMDOSP2CoverageGap.self,
                    table: "l2_coverage_gaps",
                    select: "gap_id,source,source_ref,title,summary,salience_score,proposed_target_l2,gap_class,project_id,scope,due_at,review_status,routed_to,detected_at",
                    order: "review_status.asc,due_at.asc.nullslast,detected_at.desc",
                    limit: 500
                )
                state = rows.isEmpty ? .empty : .loaded
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    private func percentage(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int((value * 100).rounded()))%"
    }

    private func coverageClassLabel(_ value: String?) -> String {
        switch value {
        case "extractor_miss": return "抽出器の取りこぼし"
        case "structural_gap": return "構造的GAP (受け皿なし)"
        case "uncertain": return "分類先未確定"
        default: return value ?? ""
        }
    }

    private func coverageStatusTint(_ status: String?) -> Color {
        switch status {
        case "confirmed": return AMDOSDesign.success
        case "rejected": return AMDOSDesign.muted
        default: return AMDOSDesign.warning
        }
    }
}

private func amdosp2CurrentYM() -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Tokyo")!
    let components = calendar.dateComponents([.year, .month], from: Date())
    return String(format: "%04d%02d", components.year ?? 2000, components.month ?? 1)
}

private func agreementYMLabel(_ ym: String) -> String {
    guard ym.count == 6 else { return ym }
    return "\(ym.prefix(4))年\(Int(ym.suffix(2)) ?? 0)月"
}

private func agreementYen(_ value: Double?) -> String {
    guard let value else { return "算定待ち" }
    return "¥\(Int(value.rounded()).formatted(.number.locale(Locale(identifier: "ja_JP"))))"
}

private func agreementStatusLabel(_ status: String) -> String {
    switch status {
    case "agreed": return "合意済み"
    case "needs_reagreement": return "条件更新あり"
    case "not_required": return "対象外"
    default: return "未合意"
    }
}

private func agreementStatusTint(_ status: String) -> Color {
    switch status {
    case "agreed": return AMDOSDesign.success
    case "needs_reagreement": return AMDOSDesign.warning
    case "not_required": return AMDOSDesign.muted
    default: return AMDOSDesign.blue
    }
}

private func amdosp2Date(_ value: String?) -> Date? {
    guard let value, !value.isEmpty else { return nil }
    if let date = ISO8601DateFormatter().date(from: value) { return date }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(identifier: "Asia/Tokyo")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: value)
}

private func amdosp2NormalizedTags(_ value: String) -> [String] {
    var tags: [String] = []
    for raw in value.split(separator: ",") {
        let tag = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if !tag.isEmpty, !tags.contains(tag) { tags.append(tag) }
        if tags.count == 32 { break }
    }
    return tags
}
