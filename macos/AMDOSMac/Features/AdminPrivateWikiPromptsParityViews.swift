import Foundation
import SwiftUI

struct AMDOSP1AdminMessage: View {
    let text: String?

    var body: some View {
        if let text, !text.isEmpty {
            Text(text)
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 9))
                .textSelection(.enabled)
        }
    }
}

func amdosp1CompactDate(_ value: String?) -> String {
    guard let value, !value.isEmpty else { return "—" }
    let formatter = ISO8601DateFormatter()
    guard let date = formatter.date(from: value) else { return value }
    let display = DateFormatter()
    display.locale = Locale(identifier: "ja_JP")
    display.timeZone = TimeZone(identifier: "Asia/Tokyo")
    display.dateFormat = "M/d HH:mm"
    return display.string(from: date)
}

private let amdosp1PersonKinds: [(String, String)] = [
    ("amd_member", "AMDメンバー"),
    ("client", "クライアント"),
    ("partner", "取引先"),
    ("vendor", "ベンダー"),
    ("investor", "投資家"),
    ("researcher", "研究者"),
    ("external_collaborator", "外部協力者"),
    ("other", "その他"),
]

private let amdosp1SourceKinds: [(String, String)] = [
    ("manual", "手入力"),
    ("codex", "Codex"),
    ("slack", "Slack"),
    ("gmail", "Gmail"),
    ("notion", "Notion"),
    ("drive", "Drive"),
    ("calendar", "Calendar"),
    ("meeting", "MTG"),
    ("other", "その他"),
]

private func amdosp1Label(_ key: String, from options: [(String, String)]) -> String {
    options.first(where: { $0.0 == key })?.1 ?? key
}

private struct AMDOSP1WikiProject: Codable, Identifiable, Sendable {
    let projectID: String
    let projectName: String
    let status: String?

    var id: String { projectID }

    enum CodingKeys: String, CodingKey {
        case projectID = "project_id"
        case projectName = "project_name"
        case status
    }
}

private struct AMDOSP1WikiEntry: Codable, Identifiable, Sendable {
    let id: String
    let projectID: String?
    let personName: String
    let personKind: String
    let affiliation: String?
    let relationshipContext: String?
    let birthdayLabel: String?
    let originLabel: String?
    let residenceLabel: String?
    let contactContext: String?
    let familyNote: String?
    let tabooNote: String?
    let memoBody: String
    let sourceKind: String
    let sourceRef: String?
    let sourceExcerpt: String?
    let confidence: Double?
    let visibility: String?
    let status: String
    let updatedBy: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case projectID = "project_id"
        case personName = "person_name"
        case personKind = "person_kind"
        case affiliation
        case relationshipContext = "relationship_context"
        case birthdayLabel = "birthday_label"
        case originLabel = "origin_label"
        case residenceLabel = "residence_label"
        case contactContext = "contact_context"
        case familyNote = "family_note"
        case tabooNote = "taboo_note"
        case memoBody = "memo_body"
        case sourceKind = "source_kind"
        case sourceRef = "source_ref"
        case sourceExcerpt = "source_excerpt"
        case confidence, visibility, status
        case updatedBy = "updated_by"
        case updatedAt = "updated_at"
    }
}

private struct AMDOSP1WikiEnvelope: Codable, Sendable {
    let ok: Bool?
    let entries: [AMDOSP1WikiEntry]?
    let error: String?
}

private struct AMDOSP1WikiMutation: Codable, Sendable {
    let ok: Bool?
    let entry: AMDOSP1WikiEntry?
    let error: String?
}

private struct AMDOSP1WikiDraft: Encodable, Identifiable, Sendable {
    var token = UUID()
    var entryID: String?
    var projectID = ""
    var personName = ""
    var personKind = "external_collaborator"
    var affiliation = ""
    var relationshipContext = ""
    var birthdayLabel = ""
    var originLabel = ""
    var residenceLabel = ""
    var contactContext = ""
    var familyNote = ""
    var tabooNote = ""
    var memoBody = ""
    var sourceKind = "manual"
    var sourceRef = ""
    var sourceExcerpt = ""
    var confidence = 0.5
    var status = "active"

    var id: UUID { token }

    init() {}

    init(entry: AMDOSP1WikiEntry) {
        entryID = entry.id
        projectID = entry.projectID ?? ""
        personName = entry.personName
        personKind = entry.personKind
        affiliation = entry.affiliation ?? ""
        relationshipContext = entry.relationshipContext ?? ""
        birthdayLabel = entry.birthdayLabel ?? ""
        originLabel = entry.originLabel ?? ""
        residenceLabel = entry.residenceLabel ?? ""
        contactContext = entry.contactContext ?? ""
        familyNote = entry.familyNote ?? ""
        tabooNote = entry.tabooNote ?? ""
        memoBody = entry.memoBody
        sourceKind = entry.sourceKind
        sourceRef = entry.sourceRef ?? ""
        sourceExcerpt = entry.sourceExcerpt ?? ""
        confidence = entry.confidence ?? 0.5
        status = entry.status
    }

    enum CodingKeys: String, CodingKey {
        case entryID = "id"
        case projectID = "projectId"
        case personName, personKind, affiliation, relationshipContext
        case birthdayLabel, originLabel, residenceLabel, contactContext, familyNote, tabooNote
        case memoBody, sourceKind, sourceRef, sourceExcerpt, confidence, status
    }
}

private struct AMDOSP1WikiGroup: Identifiable {
    let projectID: String?
    let entries: [AMDOSP1WikiEntry]

    var id: String { projectID ?? "__global__" }
}

struct AMDOSP1PrivateWikiView: View {
    @State private var entries: [AMDOSP1WikiEntry] = []
    @State private var projects: [AMDOSP1WikiProject] = []
    @State private var query = ""
    @State private var projectFilter = ""
    @State private var kindFilter = ""
    @State private var statusFilter = "active"
    @State private var editing: AMDOSP1WikiDraft?
    @State private var archiveCandidate: AMDOSP1WikiEntry?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var saving = false

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "ADMIN / PRIVATE WIKI",
            title: "裏wiki",
            subtitle: "PJ別の人物コンテキストを、管理者だけの台帳として扱う"
        ) {
            header
            metrics
            filters
            AMDOSStateNotice(state: state) { load() }
            AMDOSP1AdminMessage(text: message)
            if let editing { editor(editing) }
            entriesList
        }
        .task { load() }
        .alert("人物メモをアーカイブ", isPresented: Binding(
            get: { archiveCandidate != nil },
            set: { if !$0 { archiveCandidate = nil } }
        )) {
            Button("キャンセル", role: .cancel) { archiveCandidate = nil }
            Button("アーカイブ", role: .destructive) {
                if let entry = archiveCandidate { archive(entry) }
                archiveCandidate = nil
            }
        } message: {
            Text("この人物メモは削除せず、アーカイブ状態へ変更するよ。")
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "lock.shield")
                .font(.title3)
                .foregroundStyle(AMDOSDesign.warning)
                .frame(width: 34, height: 34)
                .background(AMDOSDesign.warning.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 4) {
                Text("admin-only")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMDOSDesign.warning)
                Text("誕生日・出身地・居住地・接点・家族・タブーを扱う内部台帳。通常のコックピットや公開画面には出さない。")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            Button {
                editing = AMDOSP1WikiDraft()
                message = nil
            } label: {
                Label("追加", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(14)
        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 12))
    }

    private var metrics: some View {
        HStack(spacing: 12) {
            AMDOSMetricTile(label: "total", value: "\(entries.count)", detail: "全エントリ")
            AMDOSMetricTile(label: "active", value: "\(entries.filter { $0.status == "active" }.count)", detail: "確認中", tint: AMDOSDesign.success)
            AMDOSMetricTile(label: "needs_review", value: "\(entries.filter { $0.status == "needs_review" }.count)", detail: "見直し待ち", tint: AMDOSDesign.warning)
            AMDOSMetricTile(label: "archived", value: "\(entries.filter { $0.status == "archived" }.count)", detail: "履歴", tint: AMDOSDesign.muted)
        }
    }

    private var filters: some View {
        AMDOSSectionCard("絞り込み", systemImage: "line.3.horizontal.decrease.circle") {
            HStack(alignment: .bottom, spacing: 10) {
                AMDOSTextField(title: "検索", text: $query)
                    .frame(maxWidth: .infinity)
                Picker("PJ", selection: $projectFilter) {
                    Text("すべて").tag("")
                    Text("AMD全体 / 未紐付け").tag("__global__")
                    ForEach(projects) { project in
                        Text("\(project.projectID) \(project.projectName)").tag(project.projectID)
                    }
                }
                .frame(width: 190)
                Picker("人物種別", selection: $kindFilter) {
                    Text("すべて").tag("")
                    ForEach(amdosp1PersonKinds, id: \.0) { option in
                        Text(option.1).tag(option.0)
                    }
                }
                .frame(width: 150)
                Picker("状態", selection: $statusFilter) {
                    Text("すべて").tag("")
                    Text("active").tag("active")
                    Text("needs_review").tag("needs_review")
                    Text("archived").tag("archived")
                }
                .frame(width: 140)
                Button("リセット") {
                    query = ""
                    projectFilter = ""
                    kindFilter = ""
                    statusFilter = "active"
                }
                .buttonStyle(.bordered)
            }
        }
    }

    @ViewBuilder private func editor(_ draft: AMDOSP1WikiDraft) -> some View {
        AMDOSSectionCard(draft.entryID == nil ? "人物メモを追加" : "人物メモを編集", systemImage: "person.crop.circle.badge.plus") {
            Grid(alignment: .leading, horizontalSpacing: 14, verticalSpacing: 12) {
                GridRow {
                    Picker("PJ", selection: stringBinding(\.projectID)) {
                        Text("AMD全体 / 未紐付け").tag("")
                        ForEach(projects) { project in
                            Text("\(project.projectID) \(project.projectName)").tag(project.projectID)
                        }
                    }
                    AMDOSTextField(title: "人物名 *", text: stringBinding(\.personName))
                    Picker("人物種別", selection: stringBinding(\.personKind)) {
                        ForEach(amdosp1PersonKinds, id: \.0) { option in Text(option.1).tag(option.0) }
                    }
                    AMDOSTextField(title: "所属", text: stringBinding(\.affiliation))
                }
                GridRow {
                    AMDOSTextField(title: "関係先 / 関係性", text: stringBinding(\.relationshipContext))
                    AMDOSTextField(title: "誕生日", text: stringBinding(\.birthdayLabel))
                    Picker("状態", selection: stringBinding(\.status)) {
                        Text("active").tag("active")
                        Text("needs_review").tag("needs_review")
                        Text("archived").tag("archived")
                    }
                    EmptyView()
                }
                GridRow {
                    AMDOSTextField(title: "出身地", text: stringBinding(\.originLabel))
                    AMDOSTextField(title: "居住地", text: stringBinding(\.residenceLabel))
                    AMDOSTextField(title: "接点", text: stringBinding(\.contactContext))
                    EmptyView()
                }
            }
            AMDOSTextField(title: "家族", text: stringBinding(\.familyNote), axis: .vertical)
            AMDOSTextField(title: "タブー", text: stringBinding(\.tabooNote), axis: .vertical)
            AMDOSTextField(title: "本文メモ *", text: stringBinding(\.memoBody), axis: .vertical)
            HStack(alignment: .bottom, spacing: 12) {
                Picker("source", selection: stringBinding(\.sourceKind)) {
                    ForEach(amdosp1SourceKinds, id: \.0) { option in Text(option.1).tag(option.0) }
                }
                .frame(width: 150)
                VStack(alignment: .leading, spacing: 5) {
                    Text("confidence").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    HStack(spacing: 8) {
                        Slider(value: doubleBinding(\.confidence), in: 0...1, step: 0.05)
                        Text("\(Int((editing?.confidence ?? 0.5) * 100))%")
                            .font(.caption.monospacedDigit())
                            .frame(width: 40, alignment: .trailing)
                    }
                }
                AMDOSTextField(title: "source_ref", text: stringBinding(\.sourceRef))
                    .frame(maxWidth: .infinity)
            }
            AMDOSTextField(title: "source_excerpt", text: stringBinding(\.sourceExcerpt), axis: .vertical)
            HStack {
                Spacer()
                Button("キャンセル") { editing = nil }.buttonStyle(.bordered)
                Button(saving ? "保存中…" : "保存") { save(draft) }
                    .buttonStyle(.borderedProminent)
                    .disabled(saving || draft.personName.trimmedNonEmpty == nil || draft.memoBody.trimmedNonEmpty == nil)
            }
        }
    }

    @ViewBuilder private var entriesList: some View {
        let groups = groupedEntries
        if groups.isEmpty, state == .loaded || state == .empty {
            AMDOSSectionCard("人物メモ", systemImage: "person.2") {
                Text("条件に合うエントリはまだないよ。").foregroundStyle(AMDOSDesign.muted)
            }
        } else {
            ForEach(groups) { group in
                AMDOSSectionCard(projectTitle(group.projectID), systemImage: "person.2") {
                    Text("\(group.entries.count) entries").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    ForEach(group.entries) { entry in
                        entryRow(entry)
                        if entry.id != group.entries.last?.id { Divider() }
                    }
                }
            }
        }
    }

    @ViewBuilder private func entryRow(_ entry: AMDOSP1WikiEntry) -> some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(entry.personName).font(.headline)
                HStack(spacing: 6) {
                    AMDOSStatusBadge(text: amdosp1Label(entry.personKind, from: amdosp1PersonKinds))
                    AMDOSStatusBadge(text: entry.status, tint: entry.status == "needs_review" ? AMDOSDesign.warning : AMDOSDesign.blue)
                }
                if let affiliation = entry.affiliation { Text(affiliation).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                if let relationship = entry.relationshipContext { Text(relationship).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                detailLine("誕生日", entry.birthdayLabel)
                detailLine("出身地", entry.originLabel)
                detailLine("居住地", entry.residenceLabel)
            }
            .frame(width: 205, alignment: .leading)
            VStack(alignment: .leading, spacing: 7) {
                Text(entry.memoBody).font(.subheadline).fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
                detailLine("接点", entry.contactContext)
                detailLine("家族", entry.familyNote)
                if let taboo = entry.tabooNote, !taboo.isEmpty {
                    detailLine("タブー", taboo, tint: .red)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 6) {
                Text(amdosp1Label(entry.sourceKind, from: amdosp1SourceKinds)).font(.caption.weight(.semibold))
                Text("conf \(Int((entry.confidence ?? 0.5) * 100))%").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                if let source = entry.sourceRef { Text(source).font(.caption2).lineLimit(2).textSelection(.enabled) }
                if let excerpt = entry.sourceExcerpt { Text(excerpt).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(4).textSelection(.enabled) }
                Text("更新 \(amdosp1CompactDate(entry.updatedAt))").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                if let updater = entry.updatedBy { Text(updater).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(1) }
            }
            .frame(width: 220, alignment: .leading)
            VStack(spacing: 7) {
                Button { editing = AMDOSP1WikiDraft(entry: entry); message = nil } label: { Image(systemName: "pencil") }
                    .buttonStyle(.bordered)
                    .help("編集")
                if entry.status != "archived" {
                    Button(role: .destructive) { archiveCandidate = entry } label: { Image(systemName: "archivebox") }
                        .buttonStyle(.bordered)
                        .help("アーカイブ")
                }
            }
        }
        .padding(.vertical, 5)
    }

    @ViewBuilder private func detailLine(_ label: String, _ value: String?, tint: Color = AMDOSDesign.muted) -> some View {
        if let value, !value.isEmpty {
            Text("\(label)  \(value)").font(.caption2).foregroundStyle(tint).fixedSize(horizontal: false, vertical: true)
        }
    }

    private var filteredEntries: [AMDOSP1WikiEntry] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let projectNames = Dictionary(uniqueKeysWithValues: projects.map { ($0.projectID, $0.projectName) })
        return entries.filter { entry in
            if projectFilter == "__global__", entry.projectID != nil { return false }
            if !projectFilter.isEmpty, projectFilter != "__global__", entry.projectID != projectFilter { return false }
            if !kindFilter.isEmpty, entry.personKind != kindFilter { return false }
            if !statusFilter.isEmpty, entry.status != statusFilter { return false }
            guard !needle.isEmpty else { return true }
            let haystack = [
                entry.personName, entry.affiliation, entry.relationshipContext, entry.birthdayLabel,
                entry.originLabel, entry.residenceLabel, entry.contactContext, entry.familyNote,
                entry.tabooNote, entry.memoBody, entry.sourceRef, entry.sourceExcerpt,
                projectNames[entry.projectID ?? ""],
            ].compactMap { $0 }.joined(separator: " ").lowercased()
            return haystack.contains(needle)
        }
    }

    private var groupedEntries: [AMDOSP1WikiGroup] {
        Dictionary(grouping: filteredEntries, by: { $0.projectID })
            .map { AMDOSP1WikiGroup(projectID: $0.key, entries: $0.value) }
            .sorted { ($0.projectID ?? "") < ($1.projectID ?? "") }
    }

    private func projectTitle(_ id: String?) -> String {
        guard let id else { return "AMD全体 / 未紐付け" }
        guard let project = projects.first(where: { $0.projectID == id }) else { return id }
        return "\(project.projectID) \(project.projectName)"
    }

    private func stringBinding(_ keyPath: WritableKeyPath<AMDOSP1WikiDraft, String>) -> Binding<String> {
        Binding(get: { editing?[keyPath: keyPath] ?? "" }, set: { editing?[keyPath: keyPath] = $0 })
    }

    private func doubleBinding(_ keyPath: WritableKeyPath<AMDOSP1WikiDraft, Double>) -> Binding<Double> {
        Binding(get: { editing?[keyPath: keyPath] ?? 0.5 }, set: { editing?[keyPath: keyPath] = $0 })
    }

    private func load() {
        Task {
            state = .loading
            do {
                async let wiki = AMDOSRESTClient.shared.fetchPWA(AMDOSP1WikiEnvelope.self, path: "/api/admin/private-wiki")
                async let projectRows = AMDOSRESTClient.shared.fetchTable(
                    AMDOSP1WikiProject.self,
                    table: "projects",
                    select: "project_id,project_name,status",
                    order: "project_name",
                    limit: 500
                )
                let (envelope, loadedProjects) = try await (wiki, projectRows)
                guard envelope.ok != false else { throw AMDOSNetworkError.http(envelope.error ?? "裏wikiを取得できなかった") }
                entries = envelope.entries ?? []
                projects = loadedProjects
                state = entries.isEmpty ? .empty : .loaded
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    private func save(_ draft: AMDOSP1WikiDraft) {
        guard draft.personName.trimmedNonEmpty != nil, draft.memoBody.trimmedNonEmpty != nil else {
            message = "人物名と本文メモは必須だよ"
            return
        }
        saving = true
        Task {
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/private-wiki",
                    method: draft.entryID == nil ? "POST" : "PATCH",
                    body: draft
                )
                let result = try JSONDecoder().decode(AMDOSP1WikiMutation.self, from: data)
                guard result.ok != false, let entry = result.entry else {
                    throw AMDOSNetworkError.http(result.error ?? "人物メモを保存できなかった")
                }
                if draft.entryID == nil {
                    entries.insert(entry, at: 0)
                } else {
                    entries = entries.map { $0.id == entry.id ? entry : $0 }
                }
                editing = nil
                message = "\(entry.personName) を保存したよ"
            } catch {
                message = error.localizedDescription
            }
            saving = false
        }
    }

    private func archive(_ entry: AMDOSP1WikiEntry) {
        saving = true
        Task {
            do {
                var draft = AMDOSP1WikiDraft(entry: entry)
                draft.status = "archived"
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/private-wiki", method: "PATCH", body: draft)
                let result = try JSONDecoder().decode(AMDOSP1WikiMutation.self, from: data)
                guard result.ok != false, let saved = result.entry else {
                    throw AMDOSNetworkError.http(result.error ?? "アーカイブできなかった")
                }
                entries = entries.map { $0.id == saved.id ? saved : $0 }
                message = "\(entry.personName) をアーカイブしたよ"
            } catch {
                message = error.localizedDescription
            }
            saving = false
        }
    }
}

private struct AMDOSP1Prompt: Codable, Identifiable, Sendable {
    let id: String
    let promptKey: String
    let description: String?
    let body: String?
    let model: String?
    let maxTokens: Int?
    let isActive: Bool?
    let notes: String?
    let updatedBy: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case promptKey = "prompt_key"
        case description, body, model
        case maxTokens = "max_tokens"
        case isActive = "is_active"
        case notes
        case updatedBy = "updated_by"
        case updatedAt = "updated_at"
    }
}

private struct AMDOSP1PromptContext: Codable, Identifiable, Sendable {
    let contextID: String
    let tags: String?
    let priority: Int?
    let systemPrompt: String?
    let updatedAt: String?

    var id: String { contextID }

    enum CodingKeys: String, CodingKey {
        case contextID = "context_id"
        case tags, priority
        case systemPrompt = "system_prompt"
        case updatedAt = "updated_at"
    }
}

private struct AMDOSP1PromptDraft: Encodable, Sendable {
    var body: String
    var description: String
    var model: String
    var maxTokens: Int?
    var isActive: Bool
    var notes: String
}

struct AMDOSP1PromptsView: View {
    @State private var prompts: [AMDOSP1Prompt] = []
    @State private var contexts: [AMDOSP1PromptContext] = []
    @State private var editingID: String?
    @State private var draft = AMDOSP1PromptDraft(body: "", description: "", model: "", maxTokens: nil, isActive: false, notes: "")
    @State private var expandedContextID: String?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var saving = false

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "ADMIN / PROMPTS",
            title: "LLMプロンプト",
            subtitle: "プロンプト本文をコードへ戻さず、PWAと同じ管理APIで編集する"
        ) {
            AMDOSStateNotice(state: state) { load() }
            AMDOSP1AdminMessage(text: message)
            if prompts.isEmpty, state == .loaded || state == .empty {
                AMDOSSectionCard("プロンプト", systemImage: "text.bubble") {
                    Text("llm_prompts にレコードがないよ。").foregroundStyle(AMDOSDesign.muted)
                }
            } else {
                ForEach(prompts) { prompt in promptCard(prompt) }
            }
            contextsSection
        }
        .task { load() }
    }

    @ViewBuilder private func promptCard(_ prompt: AMDOSP1Prompt) -> some View {
        let isEditing = editingID == prompt.id
        AMDOSSectionCard(prompt.promptKey, systemImage: "text.bubble") {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    if let description = prompt.description, !description.isEmpty {
                        Text(description).font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    Text("\(prompt.model?.trimmedNonEmpty ?? "モデル未設定") · max \(prompt.maxTokens.map(String.init) ?? "—")")
                        .font(.caption2)
                        .foregroundStyle(AMDOSDesign.muted)
                }
                Spacer()
                AMDOSStatusBadge(text: (prompt.isActive ?? false) ? "ACTIVE" : "INACTIVE", tint: (prompt.isActive ?? false) ? AMDOSDesign.success : AMDOSDesign.muted)
            }
            if isEditing {
                promptEditor(prompt)
            } else {
                Text(prompt.body?.trimmedNonEmpty ?? "（空。activeにする前に本文を入れて）")
                    .font(.system(.caption, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 8))
                    .textSelection(.enabled)
                if let notes = prompt.notes, !notes.isEmpty {
                    Text("メモ  \(notes)").font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                }
                HStack {
                    Text("最終編集 \(amdosp1CompactDate(prompt.updatedAt))\(prompt.updatedBy.map { " / \($0)" } ?? "")")
                        .font(.caption2)
                        .foregroundStyle(AMDOSDesign.muted)
                    Spacer()
                    Button("編集") { beginEdit(prompt) }.buttonStyle(.bordered)
                }
            }
        }
    }

    @ViewBuilder private func promptEditor(_ prompt: AMDOSP1Prompt) -> some View {
        AMDOSTextField(title: "本文", text: $draft.body, axis: .vertical)
        HStack(alignment: .bottom, spacing: 12) {
            AMDOSTextField(title: "説明", text: $draft.description)
            AMDOSTextField(title: "モデル", text: $draft.model)
            VStack(alignment: .leading, spacing: 5) {
                Text("max_tokens").font(.caption).foregroundStyle(AMDOSDesign.muted)
                TextField("max_tokens", value: $draft.maxTokens, format: .number)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 110)
            }
            Toggle("is_active", isOn: $draft.isActive).toggleStyle(.switch)
        }
        AMDOSTextField(title: "運用メモ", text: $draft.notes, axis: .vertical)
        HStack {
            Spacer()
            Button("キャンセル") { editingID = nil }.buttonStyle(.bordered)
            Button(saving ? "保存中…" : "保存") { save(prompt) }
                .buttonStyle(.borderedProminent)
                .disabled(saving)
        }
    }

    private var contextsSection: some View {
        AMDOSSectionCard("スプシ由来つくよみ Context", systemImage: "rectangle.3.group") {
            Text("PWAと同じく、この一覧は参照専用。正本はスプシ側で管理する。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
            if contexts.isEmpty {
                Text("表示できるContextはないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(contexts) { context in
                DisclosureGroup(isExpanded: Binding(
                    get: { expandedContextID == context.id },
                    set: { expandedContextID = $0 ? context.id : nil }
                )) {
                    Text(context.systemPrompt ?? "")
                        .font(.system(.caption, design: .monospaced))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 7)
                        .textSelection(.enabled)
                } label: {
                    HStack {
                        Text(context.contextID).font(.caption.weight(.semibold))
                        Text(context.tags ?? "(no tag)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                        Spacer()
                        if let priority = context.priority { Text("priority \(priority)").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                        Text(amdosp1CompactDate(context.updatedAt)).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                }
                .padding(.vertical, 4)
                if context.id != contexts.last?.id { Divider() }
            }
        }
    }

    private func beginEdit(_ prompt: AMDOSP1Prompt) {
        editingID = prompt.id
        draft = AMDOSP1PromptDraft(
            body: prompt.body ?? "",
            description: prompt.description ?? "",
            model: prompt.model ?? "",
            maxTokens: prompt.maxTokens,
            isActive: prompt.isActive ?? false,
            notes: prompt.notes ?? ""
        )
        message = nil
    }

    private func load() {
        Task {
            state = .loading
            do {
                async let promptRows = AMDOSRESTClient.shared.fetchTable(
                    AMDOSP1Prompt.self,
                    table: "llm_prompts",
                    select: "id,prompt_key,description,body,model,max_tokens,is_active,notes,updated_by,updated_at",
                    order: "prompt_key",
                    limit: 500
                )
                async let contextRows = AMDOSRESTClient.shared.fetchTable(
                    AMDOSP1PromptContext.self,
                    table: "tsukuyomi_context",
                    select: "context_id,tags,priority,system_prompt,updated_at",
                    filters: ["status": "eq.active"],
                    order: "priority.asc",
                    limit: 500
                )
                let (loadedPrompts, loadedContexts) = try await (promptRows, contextRows)
                prompts = loadedPrompts
                contexts = loadedContexts
                state = prompts.isEmpty ? .empty : .loaded
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    private func save(_ prompt: AMDOSP1Prompt) {
        saving = true
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/prompts/\(prompt.id)", method: "PATCH", body: draft)
                prompts = prompts.map { row in
                    guard row.id == prompt.id else { return row }
                    return AMDOSP1Prompt(
                        id: row.id,
                        promptKey: row.promptKey,
                        description: draft.description,
                        body: draft.body,
                        model: draft.model,
                        maxTokens: draft.maxTokens,
                        isActive: draft.isActive,
                        notes: draft.notes,
                        updatedBy: row.updatedBy,
                        updatedAt: row.updatedAt
                    )
                }
                editingID = nil
                message = "\(prompt.promptKey) を保存したよ"
            } catch {
                message = error.localizedDescription
            }
            saving = false
        }
    }
}
