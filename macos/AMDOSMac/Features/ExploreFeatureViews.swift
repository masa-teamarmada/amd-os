import SwiftUI

@MainActor
private final class AMDOSExploreStore: ObservableObject {
    @Published var atlas = AMDOSAtlasData(stories: [], signals: [])
    @Published var seedData = AMDOSSeedData(seeds: [], funding: [], news: [])
    @Published var vcData = AMDOSVCData(vcs: [], funds: [], contacts: [], news: [])
    @Published var institutionData = AMDOSInstitutionData(institutions: [], axes: [], assessments: [])
    @Published var materials = AMDOSMaterialsResponse(ok: nil, elements: [], minerals: [], polymers: [], materials: [])
    @Published var scoreInputs: [AMDOSScoreInput] = []
    @Published var management: [AMDOSManagementScore] = []
    @Published var proactive: [AMDOSProactiveTodo] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?
    private let client = AMDOSRESTClient.shared
    func loadAtlas() async { state = .loading; do { let stories = try await client.fetchTable(AMDOSAtlasStory.self, table: "atlas_stories", select: "id,title,summary,importance,signal_count,started_at,last_updated_at,tags", order: "last_updated_at.desc", limit: 100); let signals = try await client.fetchTable(AMDOSAtlasSignal.self, table: "atlas_signals", select: "id,title,content,source_url,source_type,domain,importance,status,story_id,submitted_at", order: "submitted_at.desc", limit: 200); atlas = AMDOSAtlasData(stories: stories, signals: signals); state = stories.isEmpty && signals.isEmpty ? .empty : .loaded } catch { fail(error) } }
    func loadSeeds() async { state = .loading; do { let seeds = try await client.fetchTable(AMDOSSeed.self, table: "seeds", select: "*", order: "updated_at.desc", limit: 200); let funding = try await client.fetchTable(AMDOSSeedFunding.self, table: "seed_funding", select: "*", order: "fiscal_year.desc", limit: 200); let news = try await client.fetchTable(AMDOSSeedNews.self, table: "seed_news", select: "*", filters: ["dismissed": "eq.false"], order: "occurred_on.desc", limit: 200); seedData = AMDOSSeedData(seeds: seeds, funding: funding, news: news); state = seeds.isEmpty ? .empty : .loaded } catch { fail(error) } }
    func loadVCs() async { state = .loading; do { let vcs = try await client.fetchTable(AMDOSVC.self, table: "vcs", select: "*", order: "amd_rating.desc.nullslast", limit: 200); let funds = try await client.fetchTable(AMDOSVCFund.self, table: "vc_funds", select: "*", limit: 300); let contacts = try await client.fetchTable(AMDOSVCContact.self, table: "vc_contacts", select: "*", limit: 300); let news = try await client.fetchTable(AMDOSVCNews.self, table: "vc_news", select: "*", order: "occurred_on.desc", limit: 300); vcData = AMDOSVCData(vcs: vcs, funds: funds, contacts: contacts, news: news); state = vcs.isEmpty ? .empty : .loaded } catch { fail(error) } }
    func loadInstitutions() async { state = .loading; do { let institutions = try await client.fetchTable(AMDOSInstitution.self, table: "institutions", select: "institution_id,name,type,region,description", order: "name", limit: 200); let axes = try await client.fetchTable(AMDOSInstitutionAxis.self, table: "institution_capability_axes", select: "axis_id,axis_no,name,sort_order,corresponds_xrl", order: "sort_order"); let assessments = try await client.fetchTable(AMDOSInstitutionAssessment.self, table: "institution_assessments", select: "assessment_id,institution_id,criterion_id,level,note,updated_at", order: "updated_at.desc", limit: 500); institutionData = AMDOSInstitutionData(institutions: institutions, axes: axes, assessments: assessments); state = institutions.isEmpty ? .empty : .loaded } catch { fail(error) } }
    func loadMaterials() async { state = .loading; do { materials = try await client.fetchPWA(AMDOSMaterialsResponse.self, path: "/api/macos/materials"); state = .loaded } catch { fail(error) } }
    func loadScores() async { state = .loading; do { scoreInputs = try await client.fetchTable(AMDOSScoreInput.self, table: "amd_score_inputs", select: "id,project_id,evaluated_at,mu_a,mu_i,mu_g,trl,brl,grl,srl,hrl,frl,prs_potential,prs_r_net,xrl_notes,frl_notes", order: "evaluated_at.desc", limit: 250); state = scoreInputs.isEmpty ? .empty : .loaded } catch { fail(error) } }
    func loadManagement() async { state = .loading; do { management = try await client.fetchPWA(AMDOSHUDResponse.self, path: "/api/hud/dashboard").managementHistory; state = management.isEmpty ? .empty : .loaded } catch { fail(error) } }
    func loadProactive() async { state = .loading; do { proactive = try await client.fetchTable(AMDOSProactiveTodo.self, table: "proactive_todos", select: "id,project_id,trigger_kind,title,detail,ball_owner,status,priority,due_at,resolved_note", filters: ["status": "in.(open,blocked)"], order: "priority.asc,due_at.asc", limit: 200); state = proactive.isEmpty ? .empty : .loaded } catch { fail(error) } }
    private func fail(_ error: Error) { message = error.localizedDescription; state = .failed(message ?? "") }
}

struct AMDOSAtlasHomeView: View { @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "ATLAS", title: "Atlas", subtitle: "外部シグナルを、判断できるストーリーと次の問いに変える") { HStack(spacing: 14) { AMDOSMetricTile(label: "ストーリー", value: "\(store.atlas.stories.count)", detail: "変化のまとまり"); AMDOSMetricTile(label: "シグナル", value: "\(store.atlas.signals.count)", detail: "受信した変化") }; AMDOSStateNotice(state: store.state) { Task { await store.loadAtlas() } }; ForEach(store.atlas.stories.prefix(12)) { s in AMDOSSectionCard(s.title, systemImage: "globe") { Text(s.summary ?? "要約はまだないよ。"); AMDOSStatusBadge(text: s.importance ?? "未評価") } } }.task { await store.loadAtlas() } } }
struct AMDOSAtlasThemesView: View { @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "ATLAS THEMES", title: "Atlasテーマ", subtitle: "シグナルをテーマ候補として束ね、適用前に確認") { AMDOSStateNotice(state: store.state) { Task { await store.loadAtlas() } }; ForEach(Array(Dictionary(grouping: store.atlas.signals, by: { $0.domain ?? "未分類" }).sorted { $0.key < $1.key }), id: \.key) { key, signals in AMDOSSectionCard(key, systemImage: "square.stack.3d.up") { Text("\(signals.count)件のシグナル"); ForEach(signals.prefix(4)) { AMDOSLineItem(title: $0.title, subtitle: $0.content, status: $0.importance) } } } }.task { await store.loadAtlas() } } }
struct AMDOSAtlasDecisionsView: View {
    @StateObject private var store = AMDOSExploreStore()
    @State private var note = ""
    @State private var selectedAction = "保留"
    private let actions = ["起業", "スタジオ", "支援", "スルー", "保留"]
    var body: some View {
        AMDOSPageScaffold(eyebrow: "ATLAS DECISIONS", title: "Atlas判断", subtitle: "atlas_decisionsへ判断主体・理由を保存する") {
            AMDOSTextField(title: "判断理由", text: $note, axis: .vertical)
            Picker("判断", selection: $selectedAction) { ForEach(actions, id: \.self) { Text($0).tag($0) } }
            AMDOSStateNotice(state: store.state) { Task { await store.loadAtlas() } }
            ForEach(store.atlas.signals.filter { $0.status == "inbox" || $0.status == "accepted" || $0.status == "held" }.prefix(30)) { signal in
                AMDOSAtlasDecisionCard(signal: signal, action: selectedAction) { saveDecision(for: signal) }
            }
        }.task { await store.loadAtlas() }
    }
    private func saveDecision(for signal: AMDOSAtlasSignal) {
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.postTable(table: "atlas_decisions", body: AMDOSAtlasDecisionInsert(topicId: signal.id, action: selectedAction, rationale: note.trimmedNonEmpty, decidedAt: ISO8601DateFormatter().string(from: .now)))
                _ = try await AMDOSRESTClient.shared.patchTable(table: "atlas_signals", filters: ["id": "eq.\(signal.id)"], body: AMDOSAtlasSignalReviewPatch(status: selectedAction == "保留" ? "held" : selectedAction == "スルー" ? "rejected" : "accepted", reviewedAt: ISO8601DateFormatter().string(from: .now)))
                await store.loadAtlas()
            } catch { }
        }
    }
}

private struct AMDOSAtlasDecisionCard: View {
    let signal: AMDOSAtlasSignal
    let action: String
    let onSave: () -> Void
    var body: some View {
        AMDOSCard { VStack(alignment: .leading, spacing: 8) { Text(signal.title).font(.headline); Text(signal.content); Text("\(signal.domain ?? "領域未設定") · \(signal.sourceType ?? "source不明")").font(.caption).foregroundStyle(AMDOSDesign.muted); HStack { AMDOSStatusBadge(text: signal.status); Spacer(); Button("\(action)として保存", action: onSave).buttonStyle(.borderedProminent) } } }
    }
}
struct AMDOSAtlasDivergenceView: View { @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "ATLAS DIVERGENCE", title: "Atlas乖離", subtitle: "社内の見立てと外部シグナルのズレを確認") { AMDOSStateNotice(state: store.state) { Task { await store.loadAtlas() } }; ForEach(store.atlas.signals.filter { ($0.importance ?? "") == "high" || ($0.importance ?? "") == "critical" }) { s in AMDOSSectionCard(s.title, systemImage: "arrow.triangle.branch") { Text(s.content); AMDOSStatusBadge(text: "重要度 \(s.importance ?? "未評価")", tint: AMDOSDesign.warning) } } }.task { await store.loadAtlas() } } }
struct AMDOSAtlasInboxView: View {
    @StateObject private var store = AMDOSExploreStore()
    @State private var message: String?
    var body: some View {
        AMDOSPageScaffold(eyebrow: "ATLAS INBOX", title: "Atlas受信箱", subtitle: "inboxを確認し、accepted / held / rejectedへ一括または個別に移す") {
            AMDOSStateNotice(state: store.state) { Task { await store.loadAtlas() } }
            HStack { Text("未整理 (inbox.count)件"); Spacer(); Button("全件をaccepted") { reviewAll() }.buttonStyle(.borderedProminent) }
            ForEach(inbox) { signal in AMDOSAtlasInboxRow(signal: signal) { status in review(signal, status: status) } }
            if let message { Text(message).foregroundStyle(AMDOSDesign.warning) }
        }.task { await store.loadAtlas() }
    }
    private var inbox: [AMDOSAtlasSignal] { store.atlas.signals.filter { $0.status == "inbox" } }
    private func review(_ signal: AMDOSAtlasSignal, status: String) { Task { do { _ = try await AMDOSRESTClient.shared.patchTable(table: "atlas_signals", filters: ["id": "eq.\(signal.id)"], body: AMDOSAtlasSignalReviewPatch(status: status, reviewedAt: ISO8601DateFormatter().string(from: .now))); await store.loadAtlas() } catch { message = error.localizedDescription } } }
    private func reviewAll() { Task { do { _ = try await AMDOSRESTClient.shared.patchTable(table: "atlas_signals", filters: ["status": "eq.inbox"], body: AMDOSAtlasSignalReviewPatch(status: "accepted", reviewedAt: ISO8601DateFormatter().string(from: .now))); await store.loadAtlas() } catch { message = error.localizedDescription } } }
}

private struct AMDOSAtlasInboxRow: View {
    let signal: AMDOSAtlasSignal
    let onReview: (String) -> Void
    var body: some View { AMDOSCard { VStack(alignment: .leading, spacing: 8) { Text(signal.title).font(.headline); Text(signal.content); Text("\(signal.domain ?? "領域未設定") · \(signal.sourceUrl ?? "URLなし")").font(.caption).foregroundStyle(AMDOSDesign.muted); HStack { Button("accepted") { onReview("accepted") }; Button("held") { onReview("held") }; Button("rejected") { onReview("rejected") } } } } }
}

struct AMDOSAtlasSubmitView: View {
    @State private var title = ""; @State private var content = ""; @State private var url = ""; @State private var domain = ""; @State private var message: String?
    var body: some View { AMDOSPageScaffold(eyebrow: "ATLAS SUBMIT", title: "Atlasシグナル送信", subtitle: "requireAuthのauto-tagでタグを得て、atlas_signals RLS insertへ送る") { AMDOSTextField(title: "タイトル", text: $title); AMDOSTextField(title: "要約", text: $content, axis: .vertical); AMDOSTextField(title: "根拠URL", text: $url); AMDOSTextField(title: "領域", text: $domain); Button("受信箱へ送信") { submit() }.buttonStyle(.borderedProminent); if let message { Text(message).foregroundStyle(AMDOSDesign.warning) } } }
    private func submit() { Task { do { let tagData = try await AMDOSRESTClient.shared.sendPWA(path: "/api/atlas/auto-tag", body: AMDOSAtlasAutoTagInput(title: title, content: content, domain: domain.trimmedNonEmpty)); let tag = try JSONDecoder().decode(AMDOSAtlasAutoTagResponse.self, from: tagData); _ = try await AMDOSRESTClient.shared.postTable(table: "atlas_signals", body: AMDOSAtlasSignalInsert(title: title, content: content, sourceUrl: url.trimmedNonEmpty, sourceType: "manual", domain: domain.trimmedNonEmpty, suggestedTags: tag.tags ?? [], importance: tag.importance ?? "medium", status: "inbox")); message = "タグ付けして受信箱へ送ったよ" } catch { message = error.localizedDescription } } }
}
struct AMDOSAtlasMacrotrendsView: View { @StateObject private var store = AMDOSExploreStore(); @State private var domain = "すべて"; var body: some View { AMDOSPageScaffold(eyebrow: "ATLAS MACROTRENDS", title: "Atlasマクロ", subtitle: "atlas_signalsを領域・重要度・時系列で束ね、判断対象を選ぶ") { AMDOSStateNotice(state: store.state) { Task { await store.loadAtlas() } }; let domains = ["すべて"] + Array(Set(store.atlas.signals.compactMap(\.domain))).sorted(); Picker("領域", selection: $domain) { ForEach(domains, id: \.self) { Text($0).tag($0) } }; ForEach(Array(Dictionary(grouping: store.atlas.signals.filter { domain == "すべて" || $0.domain == domain }, by: { $0.domain ?? "未分類" }).sorted { $0.key < $1.key }), id: \.key) { key, signals in AMDOSSectionCard(key, systemImage: "chart.xyaxis.line") { Text("\(signals.count)件 · 高重要度 \(signals.filter { $0.importance == "high" || $0.importance == "critical" }.count)件"); ForEach(signals.prefix(8)) { signal in AMDOSLineItem(title: signal.title, subtitle: "\(signal.submittedAt ?? "日時未登録") · \(signal.content)", status: signal.importance) } } } }.task { await store.loadAtlas() } } }
struct AMDOSAtlasMapView: View { @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "ATLAS MAP", title: "Atlasマップ", subtitle: "領域・重要度・ストーリーの関係を一覧で確認") { AMDOSStateNotice(state: store.state) { Task { await store.loadAtlas() } }; ForEach(Array(Dictionary(grouping: store.atlas.signals, by: { $0.domain ?? "未分類" }).sorted { $0.key < $1.key }), id: \.key) { domain, signals in AMDOSCard { HStack { Text(domain).font(.headline); Spacer(); Text("\(signals.count) シグナル").foregroundStyle(AMDOSDesign.muted) } } } }.task { await store.loadAtlas() } } }

struct AMDOSMaterialsView: View { @StateObject private var store = AMDOSExploreStore(); @State private var query = ""; @State private var selected: AMDOSMaterialItem?; var body: some View { AMDOSPageScaffold(eyebrow: "MATERIALS", title: "材料知識地図", subtitle: "元素・鉱物・樹脂・材料を、用途とAMD適合メモで比較") { TextField("名前・記号・用途で検索", text: $query).textFieldStyle(.roundedBorder); AMDOSStateNotice(state: store.state) { Task { await store.loadMaterials() } }; let items = (store.materials.elements.compactMap(\.detail) + store.materials.minerals + store.materials.polymers + store.materials.materials).filter { query.isEmpty || [$0.name, $0.symbol, $0.code, $0.summary].compactMap { $0 }.joined().localizedCaseInsensitiveContains(query) }; ForEach(items.prefix(100), id: \.stableID) { item in Button { selected = item } label: { AMDOSLineItem(title: item.name ?? item.code ?? "材料", subtitle: [item.symbol, item.family, item.summary].compactMap { $0 }.joined(separator: " · "), status: item.category) }.buttonStyle(.plain) }; if let selected { AMDOSSectionCard("\(selected.name ?? "材料")の詳細", systemImage: "circle.hexagongrid.fill") { Text(selected.summary ?? "要約なし"); Text(selected.amdFitNote ?? "AMD適合メモなし"); Text((selected.uses ?? []).joined(separator: "、")).foregroundStyle(AMDOSDesign.muted) } } }.task { await store.loadMaterials() } } }

struct AMDOSSeedsView: View { let onSelectSeed: (String) -> Void; @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "SEEDS", title: "研究シーズ", subtitle: "研究の芽を、技術・研究者・次の育て方で確認") { AMDOSStateNotice(state: store.state) { Task { await store.loadSeeds() } }; ForEach(store.seedData.seeds) { seed in Button { onSelectSeed(seed.id) } label: { AMDOSCard { HStack { VStack(alignment: .leading, spacing: 6) { Text(seed.title).font(.headline); Text("\(seed.orgName) · \(seed.researcherName ?? "研究者未登録")").font(.caption).foregroundStyle(AMDOSDesign.muted); Text(seed.summary ?? "概要なし").lineLimit(2) }; Spacer(); VStack(alignment: .trailing) { AMDOSStatusBadge(text: seed.status); Text(seed.trl.map { "TRL \($0)" } ?? "TRL —").font(.caption) } } } }.buttonStyle(.plain) } }.task { await store.loadSeeds() } } }
struct AMDOSSeedDetailView: View { let seedId: String?; @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "SEED DETAIL", title: "シーズ詳細", subtitle: "研究シーズの根拠、資金、ニュース、案件化候補") { if let seed = store.seedData.seeds.first(where: { $0.id == seedId }) { AMDOSSectionCard(seed.title, systemImage: "leaf.fill") { Text(seed.summary ?? "概要なし"); LabeledContent("所属", value: seed.orgName); LabeledContent("研究者", value: seed.researcherName ?? "—"); LabeledContent("評価", value: seed.amdRating.map(String.init) ?? "—") }; ForEach(store.seedData.funding.filter { $0.seedId == seed.id }) { f in AMDOSLineItem(title: f.program, subtitle: f.amountJpy.map { "\(Int($0))円" } ?? "金額なし", status: f.status) }; ForEach(store.seedData.news.filter { $0.seedId == seed.id }) { AMDOSLineItem(title: $0.title, subtitle: $0.occurredOn ?? "", status: $0.kind) } } else { AMDOSStateNotice(state: store.state) { Task { await store.loadSeeds() } } } }.task { await store.loadSeeds() } } }
struct AMDOSSeedInboxView: View { let onSelectSeed: (String) -> Void; @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "SEED INBOX", title: "シーズ受信箱", subtitle: "discovered候補をRLS updateで確認・見送りする") { AMDOSStateNotice(state: store.state) { Task { await store.loadSeeds() } }; ForEach(store.seedData.seeds.filter { $0.discoveryStatus == "discovered" }) { seed in AMDOSCard { HStack { VStack(alignment: .leading) { Text(seed.title).font(.headline); Text(seed.orgName).font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); Button("詳細") { onSelectSeed(seed.id) }; Button("確認") { update(seed.id, "reviewed") }; Button("見送り") { update(seed.id, "dismissed") } } } } }.task { await store.loadSeeds() } }; private func update(_ id: String, _ discoveryStatus: String) { Task { do { _ = try await AMDOSRESTClient.shared.patchTable(table: "seeds", filters: ["id": "eq.\(id)"], body: AMDOSSeedReviewPatch(discoveryStatus: discoveryStatus, updatedAt: ISO8601DateFormatter().string(from: Date()))); await store.loadSeeds() } catch { } } } }

struct AMDOSPoCView: View { @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "POC", title: "PoC候補", subtitle: "研究シーズを現場の検証へつなぐ候補を確認") { AMDOSStateNotice(state: store.state) { Task { await store.loadSeeds() } }; ForEach(store.seedData.seeds.filter { $0.status == "active" || $0.status == "poc" || $0.status == "candidate" }) { seed in AMDOSSectionCard(seed.title, systemImage: "arrow.triangle.2.circlepath") { Text(seed.orgName); Text(seed.summary ?? "PoC仮説をまだ記録していないよ。"); Button("PoC候補として更新") { promote(seed.id) }.buttonStyle(.bordered) } } }.task { await store.loadSeeds() } }; private func promote(_ id: String) { Task { _ = try? await AMDOSRESTClient.shared.sendPWA(path: "/api/seeds/\(id)/deep-dive", body: ["intent": "poc"]); await store.loadSeeds() } } }

struct AMDOSVCsView: View { let onSelectVC: (String) -> Void; @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "VC", title: "VC一覧", subtitle: "投資方針、投資ステージ、チケット、AMD評価を確認") { AMDOSStateNotice(state: store.state) { Task { await store.loadVCs() } }; ForEach(store.vcData.vcs) { vc in Button { onSelectVC(vc.id) } label: { AMDOSCard { HStack { VStack(alignment: .leading) { Text(vc.name).font(.headline); Text(vc.thesis ?? "投資仮説なし").lineLimit(2); Text(vc.stageFocus?.joined(separator: " / ") ?? "ステージ未登録").font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); AMDOSStatusBadge(text: vc.amdRating.map { "AMD \($0)" } ?? "未評価") } } }.buttonStyle(.plain) } }.task { await store.loadVCs() } } }
struct AMDOSVCDetailView: View {
    let vcId: String?
    @StateObject private var store = AMDOSExploreStore()
    var body: some View {
        AMDOSPageScaffold(eyebrow: "VC DETAIL", title: "VC詳細", subtitle: "ファンド、担当者、最近のニュースを確認") {
            if let vc = store.vcData.vcs.first(where: { $0.id == vcId }) {
                AMDOSSectionCard(vc.name, systemImage: "chart.line.uptrend.xyaxis") {
                    Text(vc.thesis ?? "投資仮説なし")
                    LabeledContent("種別", value: vc.type ?? "—")
                    LabeledContent("チケット", value: "\(vc.ticketMinJpy.map { Int($0) } ?? 0) 〜 \(vc.ticketMaxJpy.map { Int($0) } ?? 0)円")
                }
                ForEach(store.vcData.funds.filter { $0.vcId == vc.id }) { fund in
                    AMDOSLineItem(title: fund.name ?? "Fund \(fund.fundNo)", subtitle: fund.sizeJpy.map { "\(Int($0))円" } ?? "規模未登録", status: fund.status)
                }
                ForEach(store.vcData.contacts.filter { $0.vcId == vc.id }) { contact in
                    AMDOSLineItem(title: contact.name, subtitle: [contact.role, contact.email].compactMap { $0 }.joined(separator: " · "), status: nil)
                }
                ForEach(store.vcData.news.filter { $0.vcId == vc.id }) { news in
                    AMDOSLineItem(title: news.title, subtitle: news.occurredOn ?? "", status: news.kind)
                }
            } else {
                AMDOSStateNotice(state: store.state) { Task { await store.loadVCs() } }
            }
        }
        .task { await store.loadVCs() }
    }
}
struct AMDOSVCEditView: View {
    let vcId: String?
    @StateObject private var store = AMDOSExploreStore()
    @State private var name = ""
    @State private var thesis = ""
    @State private var rating = ""
    @State private var message: String?
    var body: some View {
        AMDOSPageScaffold(eyebrow: "VC EDIT", title: "VC編集", subtitle: "確認した内容を既存のVC台帳書込み経路へ保存") {
            AMDOSTextField(title: "名称", text: $name)
            AMDOSTextField(title: "投資仮説", text: $thesis, axis: .vertical)
            AMDOSTextField(title: "AMD評価", text: $rating)
            Button("保存") { save() }.buttonStyle(.borderedProminent)
            if let message { Text(message).foregroundStyle(AMDOSDesign.warning) }
        }
        .task {
            await store.loadVCs()
            if let vc = store.vcData.vcs.first(where: { $0.id == vcId }) {
                name = vc.name; thesis = vc.thesis ?? ""; rating = vc.amdRating.map(String.init) ?? ""
            }
        }
    }
    private func save() {
        Task {
            do {
                guard let vcId else { throw AMDOSNetworkError.notFound }
                _ = try await AMDOSRESTClient.shared.patchTable(table: "vcs", filters: ["id": "eq.\(vcId)"], body: AMDOSVCDirectPatch(name: name, thesis: thesis.trimmedNonEmpty, amdRating: Int(rating)))
                message = "VCを保存したよ"
            } catch { message = error.localizedDescription }
        }
    }
}
private struct AMDOSVCDirectPatch: Encodable, Sendable { let name: String; let thesis: String?; let amdRating: Int?; enum CodingKeys: String, CodingKey { case name, thesis, amdRating = "amd_rating" } }
struct AMDOSVCInboxView: View { let onSelectVC: (String) -> Void; @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "VC INBOX", title: "VC受信箱", subtitle: "未確認vc_newsをRLS updateで確認・見送りする") { AMDOSStateNotice(state: store.state) { Task { await store.loadVCs() } }; ForEach(store.vcData.news.filter { $0.verified != true && $0.dismissed != true }) { n in AMDOSCard { HStack { VStack(alignment: .leading) { Text(n.title).font(.headline); Text(n.occurredOn ?? "").font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); Button("確認") { review(n.id, verified: true, dismissed: false) }; Button("見送り") { review(n.id, verified: false, dismissed: true) } } } }; ForEach(store.vcData.vcs.filter { $0.amdRating == nil }) { vc in Button(vc.name) { onSelectVC(vc.id) }.buttonStyle(.link) } }.task { await store.loadVCs() } }; private func review(_ id: String, verified: Bool, dismissed: Bool) { Task { do { _ = try await AMDOSRESTClient.shared.patchTable(table: "vc_news", filters: ["id": "eq.\(id)"], body: AMDOSVCNewsReviewPatch(verified: verified, dismissed: dismissed, updatedAt: ISO8601DateFormatter().string(from: Date()))); await store.loadVCs() } catch { } } } }
struct AMDOSScholarView: View { @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "SCHOLAR", title: "研究動向", subtitle: "研究シーズと新しい動きを、事業の問いに接続") { AMDOSStateNotice(state: store.state) { Task { await store.loadSeeds() } }; ForEach(store.seedData.news.prefix(50)) { n in AMDOSLineItem(title: n.title, subtitle: n.occurredOn ?? "", status: n.kind) } }.task { await store.loadSeeds() } } }

struct AMDOSInstitutionsView: View { let onSelectInstitution: (String) -> Void; @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "INSTITUTIONS", title: "研究機関", subtitle: "研究機関との接点と評価の現在地") { AMDOSStateNotice(state: store.state) { Task { await store.loadInstitutions() } }; ForEach(store.institutionData.institutions) { i in Button { onSelectInstitution(i.id) } label: { AMDOSCard { HStack { VStack(alignment: .leading) { Text(i.name).font(.headline); Text("\(i.type) · \(i.region ?? "地域未登録")").font(.caption).foregroundStyle(AMDOSDesign.muted); Text(i.description ?? "説明なし").lineLimit(2) }; Spacer(); Text("\(store.institutionData.assessments.filter { $0.institutionId == i.id }.count) 評価").font(.caption) } } }.buttonStyle(.plain) } }.task { await store.loadInstitutions() } } }
struct AMDOSInstitutionDetailView: View {
    let institutionId: String?
    @StateObject private var store = AMDOSExploreStore()
    var body: some View {
        AMDOSPageScaffold(eyebrow: "INSTITUTION DETAIL", title: "研究機関詳細", subtitle: "機関情報と既存評価を確認") {
            if let institution = store.institutionData.institutions.first(where: { $0.id == institutionId }) {
                AMDOSSectionCard(institution.name, systemImage: "building.columns.fill") {
                    Text(institution.description ?? "説明なし")
                    LabeledContent("種別", value: institution.type)
                    LabeledContent("地域", value: institution.region ?? "—")
                }
                ForEach(store.institutionData.assessments.filter { $0.institutionId == institution.id }) { assessment in
                    AMDOSLineItem(title: assessment.criterionId ?? "評価", subtitle: assessment.note ?? "メモなし", status: assessment.level.map(String.init) ?? "未評価")
                }
            } else {
                AMDOSStateNotice(state: store.state) { Task { await store.loadInstitutions() } }
            }
        }
        .task { await store.loadInstitutions() }
    }
}
struct AMDOSInstitutionCockpitView: View { let institutionId: String?; var body: some View { AMDOSInstitutionDetailView(institutionId: institutionId) } }
struct AMDOSInstitutionAssessView: View { @StateObject private var store = AMDOSExploreStore(); @State private var criterion = ""; @State private var level = ""; @State private var note = ""; @State private var institution = ""; var body: some View { AMDOSPageScaffold(eyebrow: "INSTITUTION ASSESS", title: "研究機関評価", subtitle: "ECR評価マトリクスの1セルを確認して保存") { Picker("研究機関", selection: $institution) { Text("選んでね").tag(""); ForEach(store.institutionData.institutions) { Text($0.name).tag($0.id) } }; AMDOSTextField(title: "評価項目ID", text: $criterion); AMDOSTextField(title: "レベル", text: $level); AMDOSTextField(title: "根拠メモ", text: $note, axis: .vertical); Button("評価を保存") { save() }.buttonStyle(.borderedProminent); AMDOSStateNotice(state: store.state) { Task { await store.loadInstitutions() } } }.task { await store.loadInstitutions() } }; private func save() { Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/institutions/assess", body: AMDOSInstitutionAssessmentInput(institutionId: institution, criterionId: criterion, level: Int(level), na: false, note: note)); await store.loadInstitutions() } catch { } } } }

struct AMDOSVentureMapView: View { @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "VENTURE MAP", title: "Venture Map", subtitle: "プロジェクトの現在地を技術・事業・資金・組織の関係で俯瞰") { AMDOSStateNotice(state: store.state) { Task { await store.loadScores() } }; ForEach(Array(Dictionary(grouping: store.scoreInputs, by: { $0.projectId })), id: \.key) { projectId, scores in AMDOSCard { HStack { Text(projectId).font(.headline); Spacer(); Text(scores.first?.evaluatedAt ?? "未評価").font(.caption).foregroundStyle(AMDOSDesign.muted) } } } }.task { await store.loadScores() } } }
struct AMDOSAMDScoreView: View { let onSelectProject: (String) -> Void; @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "AMD SCORE", title: "AMD Score", subtitle: "技術・事業・組織の根拠を確認し、次に確かめることを決める") { AMDOSStateNotice(state: store.state) { Task { await store.loadScores() } }; ForEach(store.scoreInputs) { score in Button { onSelectProject(score.projectId) } label: { AMDOSCard { HStack { VStack(alignment: .leading) { Text(score.projectId).font(.headline); Text(score.xrlNotes ?? "根拠メモなし").lineLimit(2); Text(score.evaluatedAt).font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); AMDOSStatusBadge(text: score.prsPotential.map { "PRS \(Int($0))" } ?? "PRS —") } } }.buttonStyle(.plain) } }.task { await store.loadScores() } } }
struct AMDOSAMDScoreDetailView: View { let projectId: String?; @StateObject private var store = AMDOSExploreStore(); var body: some View { AMDOSPageScaffold(eyebrow: "AMD SCORE DETAIL", title: "AMD Score詳細", subtitle: "評価値とXRL/FRLの根拠を確認") { ForEach(store.scoreInputs.filter { $0.projectId == projectId }) { s in AMDOSSectionCard(s.evaluatedAt, systemImage: "scope") { HStack { AMDOSMetricTile(label: "TRL", value: s.trl.map { String(Int($0)) } ?? "—", detail: "技術準備"); AMDOSMetricTile(label: "BRL", value: s.brl.map { String(Int($0)) } ?? "—", detail: "事業準備"); AMDOSMetricTile(label: "PRS", value: s.prsPotential.map { String(Int($0)) } ?? "—", detail: "実現可能性") }; Text(s.xrlNotes ?? "XRL根拠なし"); Text(s.frlNotes ?? "FRL根拠なし") } }; AMDOSStateNotice(state: store.state) { Task { await store.loadScores() } } }.task { await store.loadScores() } } }
struct AMDOSAMDScoreRetrofitView: View { @State private var message: String?; var body: some View { AMDOSPageScaffold(eyebrow: "AMD SCORE RETROFIT", title: "AMD Score再計算", subtitle: "既存の評価データを壊さず、再計算APIを確認付きで実行") { Button("再計算を依頼") { Task { do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/cron/amd-score-l2-refresh", body: ["source": "macos"]); message = "再計算を依頼したよ" } catch { message = error.localizedDescription } } }.buttonStyle(.borderedProminent); if let message { Text(message).foregroundStyle(AMDOSDesign.warning) } } } }
private struct AMDOSVentureProject: Codable, Identifiable, Sendable { let id: String; let name: String; let clientName: String?; let status: String; enum CodingKeys: String, CodingKey { case id = "project_id", name = "project_name", clientName = "client_name", status } }
@MainActor private final class AMDOSVentureStore: ObservableObject {
    @Published var projects: [AMDOSVentureProject] = []
    @Published var ventures: [AMDOSVentureRecord] = []
    @Published var scores: [AMDOSScoreInput] = []
    @Published var xrl: [AMDOSVentureXRLLog] = []
    @Published var macro: [AMDOSMacroIndexLog] = []
    @Published var selectedProjectId: String?
    @Published var state: AMDOSFeatureLoadState = .idle
    func load() async {
        state = .loading
        do {
            async let p = AMDOSRESTClient.shared.fetchTable(AMDOSVentureProject.self, table: "projects", select: "project_id,project_name,client_name,status", order: "project_name", limit: 500)
            async let v = AMDOSRESTClient.shared.fetchTable(AMDOSVentureRecord.self, table: "project_ventures", select: "project_id,short_label,lane,founded_at,outcome_pattern,origin_org,origin_pi,amd_role,short_description,is_public", filters: ["is_public": "eq.true"], order: "founded_at", limit: 500)
            async let s = AMDOSRESTClient.shared.fetchTable(AMDOSScoreInput.self, table: "amd_score_inputs", select: "id,project_id,evaluated_at,mu_a,mu_i,mu_g,trl,brl,grl,srl,hrl,frl,prs_potential,prs_r_net,xrl_notes,frl_notes", order: "evaluated_at.desc", limit: 1_000)
            async let x = AMDOSRESTClient.shared.fetchTable(AMDOSVentureXRLLog.self, table: "project_xrl_log", select: "id,project_id,observed_at,trl,brl,hrl,grl,srl,bottleneck,milestone_label,source_note", order: "observed_at", limit: 2_000)
            async let m = AMDOSRESTClient.shared.fetchTable(AMDOSMacroIndexLog.self, table: "macro_index_log", select: "lane,observed_at,index_value,policy_density,raw_signal_count", order: "observed_at", limit: 2_000)
            projects = try await p; ventures = try await v; scores = try await s; xrl = try await x; macro = try await m
            selectedProjectId = selectedProjectId ?? ventures.first?.id ?? projects.first?.id
            state = ventures.isEmpty && projects.isEmpty ? .empty : .loaded
        } catch { state = .failed(error.localizedDescription) }
    }
}
private struct AMDOSProjectSelector: View { @ObservedObject var store: AMDOSVentureStore; var body: some View { Picker("PJ", selection: Binding(get: { store.selectedProjectId ?? "" }, set: { store.selectedProjectId = $0 })) { Text("選んでね").tag(""); ForEach(store.projects) { Text($0.name).tag($0.id) } } } }
struct AMDOSVentureCyberspaceView: View {
    @StateObject private var store = AMDOSVentureStore()

    private var selectedScore: AMDOSScoreInput? {
        store.scores.first { $0.projectId == store.selectedProjectId }
    }

    private var selectedScores: [AMDOSScoreInput] {
        store.scores.filter { $0.projectId == store.selectedProjectId }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "CYBERSPACE", title: "Venture Cyberspace", subtitle: "AMD ScoreのM/X/F 3軸をネイティブ空間として選択・比較") {
            loadNotice
            projectPicker
            metricsRow
            coordinatesSection
        }
        .task { await store.load() }
    }

    @ViewBuilder
    private var loadNotice: some View {
        AMDOSStateNotice(state: store.state) { Task { await store.load() } }
    }

    @ViewBuilder
    private var projectPicker: some View {
        AMDOSProjectSelector(store: store)
    }

    @ViewBuilder
    private var metricsRow: some View {
        HStack {
            AMDOSMetricTile(label: "M", value: "\(Int(selectedScore?.muA ?? 0))", detail: "市場/経営")
            AMDOSMetricTile(label: "X", value: "\(Int(xrlValue(selectedScore)))", detail: "XRL合成")
            AMDOSMetricTile(label: "F", value: "\(Int(selectedScore?.frl ?? 0))", detail: "FRL")
        }
    }

    @ViewBuilder
    private var coordinatesSection: some View {
        AMDOSSectionCard("空間上の座標", systemImage: "point.3.connected.trianglepath.dotted") {
            if selectedScores.isEmpty {
                Text("このPJのScore入力はまだないよ。").foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(selectedScores.prefix(10)) { score in
                    AMDOSVentureCoordinateRow(score: score, text: scoreCoordinateText(score))
                }
            }
        }
    }

    private func xrlValue(_ score: AMDOSScoreInput?) -> Double {
        (score?.trl ?? 0) + (score?.brl ?? 0) + (score?.grl ?? 0)
    }

    private func scoreCoordinateText(_ score: AMDOSScoreInput) -> String {
        "M \(Int(score.muA ?? 0)) · X \(Int(xrlValue(score))) · F \(Int(score.frl ?? 0))"
    }
}

private struct AMDOSVentureCoordinateRow: View {
    let score: AMDOSScoreInput
    let text: String
    var body: some View { AMDOSLineItem(title: score.evaluatedAt, subtitle: text, status: score.prsPotential.map { "Score \(Int($0))" }) }
}
struct AMDOSVentureOscillatorView: View { @State private var time = 0.0; @State private var impulse = false; @State private var playing = false; private let timer = Timer.publish(every: 0.08, on: .main, in: .common).autoconnect(); var body: some View { AMDOSPageScaffold(eyebrow: "OSCILLATOR", title: "Venture Oscillator", subtitle: "PWAの6要素連成振動を、時間・外力・ジャンプ操作で再現") { HStack { AMDOSMetricTile(label: "時刻", value: String(format: "%.1f", time), detail: "月インデックス"); AMDOSMetricTile(label: "外力", value: impulse ? "JUMP" : "なし", detail: "イベント") }; HStack { Button(playing ? "停止" : "再生") { playing.toggle() }; Button("外力を投入") { impulse.toggle(); time += 0.25 }; Button("リセット") { time = 0; impulse = false; playing = false } }; ForEach(Array(["P","B","I_R","N","V","R"].enumerated()), id: \.offset) { index, label in let phase = Double(index) * 0.8; let value = sin(time * (0.7 + Double(index) * 0.04) + phase) * (impulse ? 1.4 : 1.0) * exp(-time * 0.002); AMDOSSectionCard(label, systemImage: "waveform.path.ecg") { HStack { Text(String(format: "%+.3f", value)).font(.title3.monospaced()); ProgressView(value: min(1, abs(value)), total: 1) } } } }.onReceive(timer) { _ in if playing { time += 0.08 } } } }
struct AMDOSVentureStateSpaceView: View { @State private var a11 = 0.82; @State private var a12 = 0.12; @State private var a21 = -0.08; @State private var a22 = 0.74; @State private var shock = 0.0; var body: some View { let radius = max(abs(a11), abs(a12), abs(a21), abs(a22)); let stable = radius < 1; AMDOSPageScaffold(eyebrow: "STATE SPACE", title: "Venture State Space", subtitle: "PWA Triple HelixのA行列を操作し、状態軌道と安定性を確認") { HStack { AMDOSMetricTile(label: "安定性", value: stable ? "STABLE" : "UNSTABLE", detail: "|A|近似", tint: stable ? AMDOSDesign.success : AMDOSDesign.warning); AMDOSMetricTile(label: "shock", value: String(format: "%+.2f", shock), detail: "入力") }; AMDOSSectionCard("遷移行列 A", systemImage: "square.grid.3x3") { AMDOSTextField(title: "A11", text: Binding(get: { String(a11) }, set: { a11 = Double($0) ?? a11 })); AMDOSTextField(title: "A12", text: Binding(get: { String(a12) }, set: { a12 = Double($0) ?? a12 })); AMDOSTextField(title: "A21", text: Binding(get: { String(a21) }, set: { a21 = Double($0) ?? a21 })); AMDOSTextField(title: "A22", text: Binding(get: { String(a22) }, set: { a22 = Double($0) ?? a22 })); HStack { Button("shock +") { shock += 1 }; Button("shock −") { shock -= 1 }; Button("初期化") { a11 = 0.82; a12 = 0.12; a21 = -0.08; a22 = 0.74; shock = 0 } } }; AMDOSSectionCard("現在の状態", systemImage: "chart.xyaxis.line") { let x1 = a11 * shock + a12 * shock; let x2 = a21 * shock + a22 * shock; AMDOSLineItem(title: "x₁", subtitle: String(format: "%.3f", x1), status: "A11·u + A12·u"); AMDOSLineItem(title: "x₂", subtitle: String(format: "%.3f", x2), status: "A21·u + A22·u") } } } }
struct AMDOSVentureSUView: View { @StateObject private var store = AMDOSVentureStore(); var body: some View { AMDOSPageScaffold(eyebrow: "SU DETAIL", title: "SU詳細", subtitle: "Venture Mapの対象PJを選び、企業・Score・根拠を同じ詳細面で確認") { AMDOSStateNotice(state: store.state) { Task { await store.load() } }; AMDOSProjectSelector(store: store); if let project = store.projects.first(where: { $0.id == store.selectedProjectId }) { AMDOSSectionCard(project.name, systemImage: "building.2") { LabeledContent("クライアント", value: project.clientName ?? "—"); AMDOSStatusBadge(text: project.status); ForEach(store.scores.filter { $0.projectId == project.id }.prefix(8)) { score in AMDOSLineItem(title: score.evaluatedAt, subtitle: score.xrlNotes ?? score.frlNotes ?? "根拠メモなし", status: score.prsPotential.map { "Score \(Int($0))" }) } } } }.task { await store.load() } } }
struct AMDOSVentureTimelineView: View { @StateObject private var store = AMDOSVentureStore(); @State private var selectedDate = ""; var body: some View { AMDOSPageScaffold(eyebrow: "TIMELINE 3D", title: "Timeline 3D", subtitle: "PWAのSU/XRL時系列をプロジェクト選択と期間フィルターで読む") { AMDOSStateNotice(state: store.state) { Task { await store.load() } }; AMDOSProjectSelector(store: store); TextField("日付 YYYY-MM", text: $selectedDate).textFieldStyle(.roundedBorder); ForEach(store.scores.filter { $0.projectId == store.selectedProjectId && (selectedDate.isEmpty || $0.evaluatedAt.hasPrefix(selectedDate)) }) { score in AMDOSSectionCard(score.evaluatedAt, systemImage: "chart.xyaxis.line") { HStack { AMDOSMetricTile(label: "TRL", value: "\(Int(score.trl ?? 0))", detail: "技術"); AMDOSMetricTile(label: "BRL", value: "\(Int(score.brl ?? 0))", detail: "事業"); AMDOSMetricTile(label: "FRL", value: "\(Int(score.frl ?? 0))", detail: "財務") }; Text(score.xrlNotes ?? "XRL根拠なし") } } }.task { await store.load() } } }
struct AMDOSManagementScoreView: View {
    @StateObject private var store = AMDOSExploreStore()
    var body: some View {
        AMDOSPageScaffold(eyebrow: "MANAGEMENT SCORE", title: "Management Score", subtitle: "経営の現在地を月次の履歴と根拠で確認") {
            AMDOSStateNotice(state: store.state) { Task { await store.loadManagement() } }
            ForEach(store.management) { score in
                AMDOSSectionCard(score.ym, systemImage: "gauge.with.dots.needle.67percent") {
                    HStack {
                        AMDOSMetricTile(label: "総合", value: score.totalScore.map { String(Int($0)) } ?? "—", detail: "confidence \(score.confidence.map { Int($0) } ?? 0)")
                        AMDOSMetricTile(label: "資金", value: score.financeScore.map { String(Int($0)) } ?? "—", detail: "finance")
                        AMDOSMetricTile(label: "方向", value: score.directionScore.map { String(Int($0)) } ?? "—", detail: "direction")
                    }
                    Text(score.summary ?? "要約なし")
                }
            }
        }
        .task { await store.loadManagement() }
    }
}
struct AMDOSProactiveView: View {
    @StateObject private var store = AMDOSExploreStore()
    var body: some View {
        AMDOSPageScaffold(eyebrow: "PROACTIVE", title: "先手TODO", subtitle: "期限と次アクションを確認して、対応済みへ進める") {
            AMDOSStateNotice(state: store.state) { Task { await store.loadProactive() } }
            ForEach(store.proactive) { todo in
                AMDOSCard {
                    HStack {
                        VStack(alignment: .leading) { Text(todo.title).font(.headline); Text(todo.detail ?? ""); Text(todo.dueAt).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        Spacer()
                        Button("対応済み") { resolve(todo) }.buttonStyle(.bordered)
                    }
                }
            }
        }
        .task { await store.loadProactive() }
    }
    private func resolve(_ todo: AMDOSProactiveTodo) {
        Task {
            _ = try? await AMDOSRESTClient.shared.sendPWA(path: "/api/proactive-todos/\(todo.id)/resolve", body: AMDOSProactiveResolveInput(action: "done", note: "macOSで対応済みにした"))
            await store.loadProactive()
        }
    }
}
