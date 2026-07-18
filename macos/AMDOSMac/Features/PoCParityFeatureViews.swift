import Foundation
import SwiftUI

// MARK: - PWA /poc parity
//
// This screen intentionally uses the same RLS tables and client-side pairing
// rules as pwa/src/app/(app)/poc/page.tsx.  There is no Mac-only writer or
// generated server-side data path here.

private struct AMDOSPocHubCompany: Codable, Identifiable, Sendable {
    let id: String
    let companyName: String
    let companySize: String?
    let industryTags: [String]?
    let region: String?
    let pocProfile: String?
    let pocHistoryNote: String?
    let incentiveNote: String?
    let sourceKind: String?
    let sourceRef: String?
    let ownerMemberID: String?
    let status: String
    let nextAction: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case companyName = "company_name"
        case companySize = "company_size"
        case industryTags = "industry_tags"
        case region
        case pocProfile = "poc_profile"
        case pocHistoryNote = "poc_history_note"
        case incentiveNote = "incentive_note"
        case sourceKind = "source_kind"
        case sourceRef = "source_ref"
        case ownerMemberID = "owner_member_id"
        case status
        case nextAction = "next_action"
        case updatedAt = "updated_at"
    }
}

private struct AMDOSPocHubMatch: Codable, Identifiable, Sendable {
    let id: String
    let seedID: String?
    let companyID: String?
    let projectID: String?
    let matchTitle: String
    let fitHypothesis: String?
    let hearingQuestions: [String]?
    let pocGoal: String?
    let rewardPlan: String?
    let contractPlan: String?
    let fundingPlan: String?
    let revenueShareNote: String?
    let status: String
    let priority: String
    let ownerMemberID: String?
    let nextAction: String?
    let sourceNote: String?

    enum CodingKeys: String, CodingKey {
        case id
        case seedID = "seed_id"
        case companyID = "company_id"
        case projectID = "project_id"
        case matchTitle = "match_title"
        case fitHypothesis = "fit_hypothesis"
        case hearingQuestions = "hearing_questions"
        case pocGoal = "poc_goal"
        case rewardPlan = "reward_plan"
        case contractPlan = "contract_plan"
        case fundingPlan = "funding_plan"
        case revenueShareNote = "revenue_share_note"
        case status, priority
        case ownerMemberID = "owner_member_id"
        case nextAction = "next_action"
        case sourceNote = "source_note"
    }
}

private struct AMDOSPocHubSeed: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let summary: String?
    let orgName: String
    let orgRegion: String?
    let researcherName: String?
    let domainLane: String?
    let industryTarget: [String]?
    let keywords: [String]?
    let status: String
    let amdRating: Int?
    let nextAction: String?

    enum CodingKeys: String, CodingKey {
        case id, title, summary
        case orgName = "org_name"
        case orgRegion = "org_region"
        case researcherName = "researcher_name"
        case domainLane = "domain_lane"
        case industryTarget = "industry_target"
        case keywords, status
        case amdRating = "amd_rating"
        case nextAction = "next_action"
    }
}

private struct AMDOSPocHubProject: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let status: String
    let category: String?

    enum CodingKeys: String, CodingKey {
        case id = "project_id"
        case name = "project_name"
        case status
        case category = "project_category"
    }
}

private struct AMDOSPocHubMember: Codable, Identifiable, Sendable {
    let id: String
    let codeName: String

    enum CodingKeys: String, CodingKey {
        case id = "member_id"
        case codeName = "code_name"
    }
}

private struct AMDOSPocHubCompanyInput: Encodable, Sendable {
    let companyName: String
    let companySize: String?
    let industryTags: [String]
    let region: String?
    let pocProfile: String?
    let pocHistoryNote: String?
    let incentiveNote: String?
    let ownerMemberID: String?
    let status: String
    let nextAction: String?
    let sourceKind: String
    let sourceRef: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case companyName = "company_name"
        case companySize = "company_size"
        case industryTags = "industry_tags"
        case region
        case pocProfile = "poc_profile"
        case pocHistoryNote = "poc_history_note"
        case incentiveNote = "incentive_note"
        case ownerMemberID = "owner_member_id"
        case status
        case nextAction = "next_action"
        case sourceKind = "source_kind"
        case sourceRef = "source_ref"
        case updatedAt = "updated_at"
    }
}

private struct AMDOSPocHubSeedInput: Encodable, Sendable {
    let title: String
    let orgName: String
    let orgRegion: String?
    let researcherName: String?
    let domainLane: String?
    let industryTarget: [String]
    let keywords: [String]
    let summary: String?
    let status: String
    let ownerMemberID: String?
    let nextAction: String?
    let source: String
    let sourceDetail: String
    let discoveryStatus: String
    let isPublic: Bool
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case title
        case orgName = "org_name"
        case orgRegion = "org_region"
        case researcherName = "researcher_name"
        case domainLane = "domain_lane"
        case industryTarget = "industry_target"
        case keywords, summary, status
        case ownerMemberID = "amd_owner_member_id"
        case nextAction = "next_action"
        case source
        case sourceDetail = "source_detail"
        case discoveryStatus = "discovery_status"
        case isPublic = "is_public"
        case updatedAt = "updated_at"
    }
}

private struct AMDOSPocHubMatchInput: Encodable, Sendable {
    let seedID: String
    let companyID: String
    let matchTitle: String
    let fitHypothesis: String
    let hearingQuestions: [String]
    let pocGoal: String
    let rewardPlan: String
    let contractPlan: String
    let fundingPlan: String
    let revenueShareNote: String
    let status: String
    let priority: String
    let nextAction: String
    let sourceNote: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case seedID = "seed_id"
        case companyID = "company_id"
        case matchTitle = "match_title"
        case fitHypothesis = "fit_hypothesis"
        case hearingQuestions = "hearing_questions"
        case pocGoal = "poc_goal"
        case rewardPlan = "reward_plan"
        case contractPlan = "contract_plan"
        case fundingPlan = "funding_plan"
        case revenueShareNote = "revenue_share_note"
        case status, priority
        case nextAction = "next_action"
        case sourceNote = "source_note"
        case updatedAt = "updated_at"
    }
}

private struct AMDOSPocHubStatusPatch: Encodable, Sendable {
    let status: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case status
        case updatedAt = "updated_at"
    }
}

private struct AMDOSPocHubInsertedID: Decodable, Sendable {
    let id: String
}

@MainActor
private final class AMDOSPocHubStore: ObservableObject {
    @Published var companies: [AMDOSPocHubCompany] = []
    @Published var matches: [AMDOSPocHubMatch] = []
    @Published var seeds: [AMDOSPocHubSeed] = []
    @Published var projects: [AMDOSPocHubProject] = []
    @Published var members: [AMDOSPocHubMember] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?

    func load() async {
        state = .loading
        message = nil
        do {
            async let nextCompanies = AMDOSRESTClient.shared.fetchTable(AMDOSPocHubCompany.self, table: "poc_companies", select: "*", order: "updated_at.desc", limit: 2_000)
            async let nextMatches = AMDOSRESTClient.shared.fetchTable(AMDOSPocHubMatch.self, table: "poc_matches", select: "*", order: "updated_at.desc", limit: 2_000)
            async let nextSeeds = AMDOSRESTClient.shared.fetchTable(AMDOSPocHubSeed.self, table: "seeds", select: "id,title,summary,org_name,org_region,researcher_name,domain_lane,industry_target,keywords,status,amd_rating,next_action", order: "updated_at.desc", limit: 400)
            async let nextProjects = AMDOSRESTClient.shared.fetchTable(AMDOSPocHubProject.self, table: "projects", select: "project_id,project_name,status,project_category", order: "project_id", limit: 1_000)
            async let nextMembers = AMDOSRESTClient.shared.fetchTable(AMDOSPocHubMember.self, table: "members", select: "member_id,code_name", order: "code_name", limit: 1_000)
            companies = try await nextCompanies
            matches = try await nextMatches
            seeds = try await nextSeeds
            projects = try await nextProjects
            members = try await nextMembers
            state = companies.isEmpty && matches.isEmpty && seeds.isEmpty ? .empty : .loaded
        } catch {
            message = error.localizedDescription
            state = .failed(message ?? "PoCデータを取得できなかった")
        }
    }

    func createCompany(_ input: AMDOSPocHubCompanyInput) async -> Bool {
        await create(table: "poc_companies", body: input, label: "PoC先")
    }

    func createSeed(_ input: AMDOSPocHubSeedInput) async -> Bool {
        await create(table: "seeds", body: input, label: "シーズ")
    }

    func createMatch(_ input: AMDOSPocHubMatchInput) async -> Bool {
        await create(table: "poc_matches", body: input, label: "案件候補")
    }

    func updateCompanyStatus(id: String, status: String) async -> Bool {
        await updateStatus(table: "poc_companies", id: id, status: status, label: "PoC先")
    }

    func updateMatchStatus(id: String, status: String) async -> Bool {
        await updateStatus(table: "poc_matches", id: id, status: status, label: "案件候補")
    }

    private func create<Body: Encodable & Sendable>(table: String, body: Body, label: String) async -> Bool {
        message = nil
        do {
            let response = try await AMDOSRESTClient.shared.postTable(table: table, body: body)
            guard let inserted = try? JSONDecoder().decode([AMDOSPocHubInsertedID].self, from: response), inserted.first?.id.trimmedNonEmpty != nil else {
                message = "\(label)の保存結果を確認できなかった"
                return false
            }
            await load()
            message = "\(label)を保存したよ"
            return true
        } catch {
            message = error.localizedDescription
            return false
        }
    }

    private func updateStatus(table: String, id: String, status: String, label: String) async -> Bool {
        message = nil
        do {
            let response = try await AMDOSRESTClient.shared.patchTable(
                table: table,
                filters: ["id": "eq.\(id)"],
                body: AMDOSPocHubStatusPatch(status: status, updatedAt: ISO8601DateFormatter().string(from: .now))
            )
            guard !response.isEmpty else {
                message = "\(label)の更新結果を確認できなかった"
                return false
            }
            await load()
            message = "\(label)の状態を更新したよ"
            return true
        } catch {
            message = error.localizedDescription
            return false
        }
    }
}

private struct AMDOSPocHubCompanyItem: Identifiable {
    let company: AMDOSPocHubCompany
    let ownerName: String?
    let matchCount: Int
    let activeMatchCount: Int

    var id: String { company.id }
}

private struct AMDOSPocHubMatchItem: Identifiable {
    let match: AMDOSPocHubMatch
    let seed: AMDOSPocHubSeed?
    let company: AMDOSPocHubCompany?
    let project: AMDOSPocHubProject?
    let ownerName: String?

    var id: String { match.id }
}

private struct AMDOSPocHubPairCandidate: Identifiable {
    let company: AMDOSPocHubCompanyItem
    let overlap: [String]
    let score: Int

    var id: String { company.id }
}

private struct AMDOSPocHubPairRow: Identifiable {
    let seed: AMDOSPocHubSeed
    let matches: [AMDOSPocHubMatchItem]
    let candidates: [AMDOSPocHubPairCandidate]

    var id: String { seed.id }
}

private let amdOSPocCompanyStatuses = ["candidate", "listed", "contacted", "hearing", "poc_ready", "archived"]
private let amdOSPocMatchStatuses = ["candidate", "hearing_design", "introduced", "hearing_done", "poc_design", "poc_running", "deal", "archived"]
private let amdOSPocSeedStatuses = ["candidate", "investigating", "contacted", "discussing", "spun_off", "declined"]
private let amdOSPocDomains = ["gx_energy", "gx_circular", "life", "materials", "robo", "ict", "other"]

private func amdOSPocCompanyStatusLabel(_ value: String) -> String {
    ["candidate": "候補", "listed": "リスト化", "contacted": "接触済", "hearing": "ヒアリング中", "poc_ready": "PoC設計可", "archived": "アーカイブ"][value] ?? value
}

private func amdOSPocMatchStatusLabel(_ value: String) -> String {
    ["candidate": "候補", "hearing_design": "質問設計", "introduced": "紹介済", "hearing_done": "ヒアリング済", "poc_design": "PoC設計中", "poc_running": "PoC実施中", "deal": "案件化", "archived": "アーカイブ"][value] ?? value
}

private func amdOSPocPriorityLabel(_ value: String) -> String {
    ["high": "高", "medium": "中", "low": "低"][value] ?? value
}

private func amdOSPocSeedStatusLabel(_ value: String) -> String {
    ["candidate": "候補", "investigating": "調査中", "contacted": "接触済", "discussing": "協議中", "spun_off": "PJ化", "declined": "見送り"][value] ?? value
}

private func amdOSPocDomainLabel(_ value: String?) -> String {
    guard let value else { return "未設定" }
    return ["gx_energy": "GX/エネルギー", "gx_circular": "GX/サーキュラー", "life": "ライフ/医療", "materials": "素材/ナノ", "robo": "ロボ/農・モビ", "ict": "ICT", "other": "その他"][value] ?? value
}

private func amdOSPocStatusTint(_ value: String) -> Color {
    switch value {
    case "poc_ready", "poc_running", "deal": return AMDOSDesign.success
    case "hearing", "hearing_done", "introduced": return AMDOSDesign.blue
    case "contacted", "poc_design", "medium": return AMDOSDesign.warning
    case "high": return .red
    default: return AMDOSDesign.muted
    }
}

struct AMDOSPocHubView: View {
    let onOpenSeeds: () -> Void
    @StateObject private var store = AMDOSPocHubStore()
    @State private var search = ""
    @State private var matchStatus = "active"
    @State private var companyStatus = "active"
    @State private var selectedTags: Set<String> = []
    @State private var showingSeedForm = false
    @State private var showingCompanyForm = false
    @State private var saving = false

    @State private var seedTitle = ""
    @State private var seedOrgName = ""
    @State private var seedRegion = ""
    @State private var seedResearcher = ""
    @State private var seedDomain = ""
    @State private var seedTargets = ""
    @State private var seedKeywords = ""
    @State private var seedSummary = ""
    @State private var seedOwner = ""
    @State private var seedStatus = "candidate"
    @State private var seedNextAction = ""

    @State private var companyName = ""
    @State private var companySize = ""
    @State private var companyTags = ""
    @State private var companyRegion = ""
    @State private var companyProfile = ""
    @State private var companyHistory = ""
    @State private var companyIncentive = ""
    @State private var companyOwner = ""
    @State private var companyCreateStatus = "candidate"
    @State private var companyNextAction = ""

    private var memberNameByID: [String: String] {
        Dictionary(uniqueKeysWithValues: store.members.map { ($0.id, $0.codeName) })
    }

    private var companyItems: [AMDOSPocHubCompanyItem] {
        store.companies.map { company in
            let related = store.matches.filter { $0.companyID == company.id }
            return AMDOSPocHubCompanyItem(
                company: company,
                ownerName: company.ownerMemberID.flatMap { memberNameByID[$0] },
                matchCount: related.count,
                activeMatchCount: related.filter { $0.status != "deal" && $0.status != "archived" }.count
            )
        }
    }

    private var matchItems: [AMDOSPocHubMatchItem] {
        let seedByID = Dictionary(uniqueKeysWithValues: store.seeds.map { ($0.id, $0) })
        let companyByID = Dictionary(uniqueKeysWithValues: store.companies.map { ($0.id, $0) })
        let projectByID = Dictionary(uniqueKeysWithValues: store.projects.map { ($0.id, $0) })
        return store.matches.map { match in
            AMDOSPocHubMatchItem(
                match: match,
                seed: match.seedID.flatMap { seedByID[$0] },
                company: match.companyID.flatMap { companyByID[$0] },
                project: match.projectID.flatMap { projectByID[$0] },
                ownerName: match.ownerMemberID.flatMap { memberNameByID[$0] }
            )
        }
    }

    private var filteredCompanies: [AMDOSPocHubCompanyItem] {
        let query = search.trimmedNonEmpty?.lowercased() ?? ""
        return companyItems.filter { item in
            let company = item.company
            let statusOK = companyStatus == "all" || (companyStatus == "active" ? company.status != "archived" : company.status == companyStatus)
            guard statusOK else { return false }
            guard query.isEmpty else {
                return [company.companyName, company.region, company.pocProfile, company.nextAction, (company.industryTags ?? []).joined(separator: " ")]
                    .compactMap { $0 }
                    .joined(separator: " ")
                    .lowercased()
                    .contains(query)
            }
            return true
        }
    }

    private var tagFilteredCompanies: [AMDOSPocHubCompanyItem] {
        filteredCompanies.filter { item in
            selectedTags.isEmpty || selectedTags.allSatisfy { tag in
                amdOSPocCompanySelectionTags(item.company).contains { amdOSPocNormalize($0) == amdOSPocNormalize(tag) }
            }
        }
    }

    private var filteredMatches: [AMDOSPocHubMatchItem] {
        let query = search.trimmedNonEmpty?.lowercased() ?? ""
        return matchItems.filter { item in
            guard matchStatusVisible(item.match.status) else { return false }
            guard !query.isEmpty else { return true }
            return [
                item.match.matchTitle, item.match.fitHypothesis, item.match.pocGoal, item.match.nextAction,
                item.seed?.title, item.company?.companyName, item.project?.name,
                (item.match.hearingQuestions ?? []).joined(separator: " ")
            ]
            .compactMap { $0 }
            .joined(separator: " ")
            .lowercased()
            .contains(query)
        }
    }

    private var tagCounts: [(tag: String, count: Int)] {
        var counts: [String: Int] = [:]
        for company in filteredCompanies.map(\.company) {
            for tag in amdOSPocCompanySelectionTags(company) { counts[tag, default: 0] += 1 }
        }
        return counts.map { (tag: $0.key, count: $0.value) }
            .sorted { $0.count == $1.count ? $0.tag.localizedStandardCompare($1.tag) == .orderedAscending : $0.count > $1.count }
    }

    private var pairingRows: [AMDOSPocHubPairRow] {
        let query = amdOSPocNormalize(search)
        let activeSeeds = store.seeds.filter { $0.status != "declined" }
        let activeCompanies = tagFilteredCompanies
        var matchesBySeed: [String: [AMDOSPocHubMatchItem]] = [:]
        var paired: Set<String> = []
        for item in matchItems {
            guard let seedID = item.match.seedID else { continue }
            matchesBySeed[seedID, default: []].append(item)
            if let companyID = item.match.companyID { paired.insert("\(seedID):\(companyID)") }
        }
        return activeSeeds.compactMap { seed in
            let existing = (matchesBySeed[seed.id] ?? []).filter { matchStatusVisible($0.match.status) && amdOSPocMatchMatchesQuery($0, query: query) }
            let candidates = activeCompanies
                .filter { !paired.contains("\(seed.id):\($0.id)") }
                .map { amdOSPocCandidate(seed: seed, company: $0, query: query, selectedTags: selectedTags) }
                .filter { $0.score > 0 }
                .sorted {
                    if $0.score != $1.score { return $0.score > $1.score }
                    if $0.company.activeMatchCount != $1.company.activeMatchCount { return $0.company.activeMatchCount > $1.company.activeMatchCount }
                    return $0.company.company.companyName.localizedStandardCompare($1.company.company.companyName) == .orderedAscending
                }
                .prefix(5)
            let seedMatchesQuery = query.isEmpty || amdOSPocNormalize(amdOSPocSeedTerms(seed).joined(separator: " ")).contains(query)
            guard seedMatchesQuery || !existing.isEmpty || !candidates.isEmpty else { return nil }
            return AMDOSPocHubPairRow(seed: seed, matches: existing, candidates: Array(candidates))
        }
        .sorted {
            if $0.matches.count != $1.matches.count { return $0.matches.count > $1.matches.count }
            if $0.candidates.count != $1.candidates.count { return $0.candidates.count > $1.candidates.count }
            if ($0.seed.amdRating ?? 0) != ($1.seed.amdRating ?? 0) { return ($0.seed.amdRating ?? 0) > ($1.seed.amdRating ?? 0) }
            return $0.seed.title.localizedStandardCompare($1.seed.title) == .orderedAscending
        }
    }

    private var activeSeedCount: Int { store.seeds.filter { $0.status != "declined" }.count }
    private var activeCompanyCount: Int { store.companies.filter { $0.status != "archived" }.count }
    private var activeMatchCount: Int { store.matches.filter { $0.status != "deal" && $0.status != "archived" }.count }
    private var hearingCount: Int { store.matches.filter { ["hearing_design", "introduced", "hearing_done"].contains($0.status) }.count }
    private var pocPipelineCount: Int { store.matches.filter { ["poc_design", "poc_running", "deal"].contains($0.status) }.count }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "SEED × POC", title: "PoC案件化", subtitle: "PWAと同じシーズ・PoC先・案件候補を並べ、ヒアリング、謝礼、契約、資金、収益分配まで追う") {
            HStack {
                Button("Seeds", action: onOpenSeeds).buttonStyle(.bordered)
                Button("更新") { Task { await store.load() } }.buttonStyle(.bordered)
                Spacer()
            }
            HStack(spacing: 12) {
                AMDOSMetricTile(label: "シーズ", value: "\(activeSeedCount)", detail: "見送りを除く", tint: AMDOSDesign.success)
                AMDOSMetricTile(label: "PoC先", value: "\(activeCompanyCount)", detail: "アーカイブを除く", tint: AMDOSDesign.blue)
                AMDOSMetricTile(label: "案件候補", value: "\(activeMatchCount)", detail: "候補 \(pairingRows.reduce(0) { $0 + $1.candidates.count })件", tint: .purple)
                AMDOSMetricTile(label: "PoC設計以降", value: "\(pocPipelineCount)", detail: "ヒアリング段階 \(hearingCount)件", tint: AMDOSDesign.warning)
            }
            AMDOSSectionCard("検索・絞り込み", systemImage: "line.3.horizontal.decrease.circle") {
                HStack(alignment: .center, spacing: 10) {
                    TextField("シーズ / PoC先 / 論点 / 次アクションで検索", text: $search).textFieldStyle(.roundedBorder)
                    Picker("案件", selection: $matchStatus) {
                        Text("進行中案件").tag("active"); Text("全案件").tag("all")
                        ForEach(amdOSPocMatchStatuses, id: \.self) { Text(amdOSPocMatchStatusLabel($0)).tag($0) }
                    }.frame(width: 140)
                    Picker("PoC先", selection: $companyStatus) {
                        Text("有効PoC先").tag("active"); Text("全PoC先").tag("all")
                        ForEach(amdOSPocCompanyStatuses, id: \.self) { Text(amdOSPocCompanyStatusLabel($0)).tag($0) }
                    }.frame(width: 140)
                }
                if let message = store.message { Text(message).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
            }
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            HStack(alignment: .top, spacing: 16) {
                AMDOSSectionCard("シーズを追加", systemImage: "leaf.fill") { seedForm }
                AMDOSSectionCard("PoC先を追加", systemImage: "building.2") { companyForm }
            }
            pocDestinationList
            pairingQueue
            matchList
        }
        .task { await store.load() }
    }

    @ViewBuilder private var seedForm: some View {
        if showingSeedForm {
            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
                GridRow { AMDOSTextField(title: "シーズ名 *", text: $seedTitle); AMDOSTextField(title: "機関 *", text: $seedOrgName) }
                GridRow { AMDOSTextField(title: "地域", text: $seedRegion); AMDOSTextField(title: "PI / 研究者", text: $seedResearcher) }
                GridRow {
                    Picker("領域", selection: $seedDomain) { Text("未設定").tag(""); ForEach(amdOSPocDomains, id: \.self) { Text(amdOSPocDomainLabel($0)).tag($0) } }
                    Picker("状態", selection: $seedStatus) { ForEach(amdOSPocSeedStatuses, id: \.self) { Text(amdOSPocSeedStatusLabel($0)).tag($0) } }
                }
                GridRow { AMDOSTextField(title: "用途・業界タグ（改行/カンマ区切り）", text: $seedTargets); AMDOSTextField(title: "キーワード（改行/カンマ区切り）", text: $seedKeywords) }
                GridRow { AMDOSTextField(title: "概要", text: $seedSummary, axis: .vertical); Picker("担当", selection: $seedOwner) { Text("未設定").tag(""); ForEach(store.members) { Text($0.codeName).tag($0.id) } } }
                GridRow { AMDOSTextField(title: "次アクション", text: $seedNextAction); EmptyView() }
            }
            HStack { Button("キャンセル") { resetSeedForm(); showingSeedForm = false }.buttonStyle(.bordered); Spacer(); Button(saving ? "保存中…" : "シーズ保存") { saveSeed() }.buttonStyle(.borderedProminent).disabled(saving || seedTitle.trimmedNonEmpty == nil || seedOrgName.trimmedNonEmpty == nil) }
        } else {
            Button("シーズを追加") { showingSeedForm = true }.buttonStyle(.bordered)
        }
    }

    @ViewBuilder private var companyForm: some View {
        if showingCompanyForm {
            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
                GridRow { AMDOSTextField(title: "PoC先名 *", text: $companyName); AMDOSTextField(title: "規模感", text: $companySize) }
                GridRow { AMDOSTextField(title: "地域", text: $companyRegion); AMDOSTextField(title: "業界タグ（改行/カンマ区切り）", text: $companyTags) }
                GridRow { AMDOSTextField(title: "PoC相性メモ", text: $companyProfile, axis: .vertical); AMDOSTextField(title: "過去PoC・紹介経路", text: $companyHistory, axis: .vertical) }
                GridRow { AMDOSTextField(title: "謝礼・インセンティブ", text: $companyIncentive, axis: .vertical); Picker("担当", selection: $companyOwner) { Text("未設定").tag(""); ForEach(store.members) { Text($0.codeName).tag($0.id) } } }
                GridRow { Picker("状態", selection: $companyCreateStatus) { ForEach(amdOSPocCompanyStatuses, id: \.self) { Text(amdOSPocCompanyStatusLabel($0)).tag($0) } }; AMDOSTextField(title: "次アクション", text: $companyNextAction) }
            }
            HStack { Button("キャンセル") { resetCompanyForm(); showingCompanyForm = false }.buttonStyle(.bordered); Spacer(); Button(saving ? "保存中…" : "PoC先を追加") { saveCompany() }.buttonStyle(.borderedProminent).disabled(saving || companyName.trimmedNonEmpty == nil) }
        } else {
            Button("PoC先を追加") { showingCompanyForm = true }.buttonStyle(.bordered)
        }
    }

    @ViewBuilder private var pocDestinationList: some View {
        AMDOSSectionCard("PoC先候補リスト", systemImage: "building.2") {
            HStack(spacing: 6) {
                ForEach(tagCounts.prefix(22), id: \.tag) { tag in
                    Button("\(tag.tag) \(tag.count)") {
                        if selectedTags.contains(tag.tag) { selectedTags.remove(tag.tag) } else { selectedTags.insert(tag.tag) }
                    }
                    .buttonStyle(.bordered)
                    .tint(selectedTags.contains(tag.tag) ? AMDOSDesign.blue : AMDOSDesign.muted)
                }
                if !selectedTags.isEmpty { Button("タグ解除") { selectedTags.removeAll() }.buttonStyle(.bordered) }
                Spacer()
                Text("\(tagFilteredCompanies.count) / \(filteredCompanies.count)件").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            if tagFilteredCompanies.isEmpty && store.state == .loaded {
                Text("タグ条件に合うPoC先がないよ。").foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(tagFilteredCompanies) { item in
                let company = item.company
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(company.companyName).font(.headline)
                                Text([company.companySize, company.region, item.ownerName].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                                if let source = company.sourceRef { Text(source).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(1) }
                            }
                            Spacer()
                            Picker("状態", selection: Binding(get: { company.status }, set: { value in Task { _ = await store.updateCompanyStatus(id: company.id, status: value) } })) {
                                ForEach(amdOSPocCompanyStatuses, id: \.self) { Text(amdOSPocCompanyStatusLabel($0)).tag($0) }
                            }.frame(width: 150)
                        }
                        if !(company.industryTags ?? []).isEmpty {
                            HStack(spacing: 5) {
                                ForEach(company.industryTags ?? [], id: \.self) { tag in
                                    Button(tag) {
                                        if selectedTags.contains(tag) { selectedTags.remove(tag) } else { selectedTags.insert(tag) }
                                    }
                                    .buttonStyle(.bordered)
                                    .tint(selectedTags.contains(tag) ? AMDOSDesign.blue : AMDOSDesign.muted)
                                }
                            }
                        }
                        if let profile = company.pocProfile { Text(profile).font(.caption) }
                        HStack(alignment: .top, spacing: 16) {
                            amdOSPocNote("履歴", company.pocHistoryNote)
                            amdOSPocNote("謝礼", company.incentiveNote)
                            Spacer()
                            Text("案件 \(item.activeMatchCount)/\(item.matchCount)").font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.muted)
                        }
                        if let next = company.nextAction { Label(next, systemImage: "arrow.right").font(.caption).foregroundStyle(AMDOSDesign.success) }
                    }
                }
            }
        }
    }

    @ViewBuilder private var pairingQueue: some View {
        AMDOSSectionCard("案件化キュー", systemImage: "arrow.triangle.2.circlepath") {
            Text("\(pairingRows.count)シーズ / 候補\(pairingRows.reduce(0) { $0 + $1.candidates.count })件").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if activeSeedCount == 0 || activeCompanyCount == 0 {
                Text("シーズかPoC先を追加すると、案件化候補が出るよ。").foregroundStyle(AMDOSDesign.muted)
            } else if pairingRows.isEmpty && store.state == .loaded {
                Text("タグや検索条件に合う候補がないよ。").foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(pairingRows) { row in
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack { AMDOSStatusBadge(text: amdOSPocDomainLabel(row.seed.domainLane), tint: AMDOSDesign.success); Text(amdOSPocSeedStatusLabel(row.seed.status)).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                                Text(row.seed.title).font(.headline)
                                Text([row.seed.orgName, row.seed.researcherName, row.seed.orgRegion].compactMap { $0 }.joined(separator: " / ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                                if let summary = row.seed.summary { Text(summary).lineLimit(2).font(.caption) }
                                let seedTags = Array((row.seed.industryTarget ?? []) + (row.seed.keywords ?? [])).prefix(6)
                                if !seedTags.isEmpty { Text(seedTags.joined(separator: " · ")).font(.caption2).foregroundStyle(AMDOSDesign.blue) }
                            }
                            Spacer()
                        }
                        if !row.matches.isEmpty {
                            Text("既存案件").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                            ForEach(row.matches) { item in
                                HStack { AMDOSStatusBadge(text: amdOSPocMatchStatusLabel(item.match.status), tint: amdOSPocStatusTint(item.match.status)); Text(item.company?.companyName ?? "PoC先未設定").font(.caption); Text(item.match.matchTitle).font(.caption).lineLimit(1); Spacer(); if let next = item.match.nextAction { Text(next).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(1) } }
                            }
                        }
                        if !row.candidates.isEmpty {
                            Text("PoC先候補").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                            ForEach(row.candidates) { candidate in
                                let company = candidate.company.company
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(company.companyName).font(.subheadline.weight(.medium))
                                        Text([company.companySize, company.region, amdOSPocCompanyStatusLabel(company.status)].compactMap { $0 }.joined(separator: " / ")).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                                        Text((candidate.overlap.isEmpty ? (company.industryTags ?? []) : candidate.overlap).prefix(4).joined(separator: " · ")).font(.caption2).foregroundStyle(AMDOSDesign.blue)
                                        if let profile = company.pocProfile { Text(profile).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(2) }
                                    }
                                    Spacer()
                                    Button("案件化") { createMatch(seed: row.seed, company: candidate.company) }.buttonStyle(.borderedProminent).disabled(saving)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder private var matchList: some View {
        AMDOSSectionCard("案件候補", systemImage: "network") {
            Text("\(filteredMatches.count)件").font(.caption).foregroundStyle(AMDOSDesign.muted)
            if filteredMatches.isEmpty && store.state == .loaded { Text("案件候補なし。案件化キューから作れるよ。").foregroundStyle(AMDOSDesign.muted) }
            ForEach(filteredMatches) { item in
                let match = item.match
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 3) {
                                HStack { AMDOSStatusBadge(text: amdOSPocPriorityLabel(match.priority), tint: amdOSPocStatusTint(match.priority)); Text(match.matchTitle).font(.headline) }
                                Text([item.seed?.title, item.company?.companyName, item.project?.name].compactMap { $0 }.joined(separator: " × ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                            }
                            Spacer()
                            Picker("状態", selection: Binding(get: { match.status }, set: { value in Task { _ = await store.updateMatchStatus(id: match.id, status: value) } })) {
                                ForEach(amdOSPocMatchStatuses, id: \.self) { Text(amdOSPocMatchStatusLabel($0)).tag($0) }
                            }.frame(width: 150)
                        }
                        if let fit = match.fitHypothesis { Text(fit).font(.caption) }
                        if !(match.hearingQuestions ?? []).isEmpty { Text("質問: \((match.hearingQuestions ?? []).joined(separator: " / "))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        HStack(alignment: .top, spacing: 14) {
                            amdOSPocNote("PoC", match.pocGoal)
                            amdOSPocNote("謝礼", match.rewardPlan)
                            amdOSPocNote("契約", match.contractPlan)
                            amdOSPocNote("資金", match.fundingPlan)
                            amdOSPocNote("収益分配", match.revenueShareNote)
                        }
                        Text("担当: \(item.ownerName ?? "未設定")").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                        if let next = match.nextAction { Label(next, systemImage: "arrow.right").font(.caption).foregroundStyle(AMDOSDesign.success) }
                    }
                }
            }
        }
    }

    private func matchStatusVisible(_ value: String) -> Bool {
        matchStatus == "all" || (matchStatus == "active" ? value != "archived" && value != "deal" : value == matchStatus)
    }

    private func saveSeed() {
        guard let title = seedTitle.trimmedNonEmpty, let orgName = seedOrgName.trimmedNonEmpty else { return }
        saving = true
        Task {
            let succeeded = await store.createSeed(AMDOSPocHubSeedInput(
                title: title, orgName: orgName, orgRegion: seedRegion.trimmedNonEmpty, researcherName: seedResearcher.trimmedNonEmpty,
                domainLane: seedDomain.trimmedNonEmpty, industryTarget: amdOSPocSplit(seedTargets), keywords: amdOSPocSplit(seedKeywords),
                summary: seedSummary.trimmedNonEmpty, status: seedStatus, ownerMemberID: seedOwner.trimmedNonEmpty,
                nextAction: seedNextAction.trimmedNonEmpty, source: "other", sourceDetail: "PoC案件化入力", discoveryStatus: "reviewed", isPublic: false,
                updatedAt: ISO8601DateFormatter().string(from: .now)
            ))
            saving = false
            if succeeded { resetSeedForm(); showingSeedForm = false }
        }
    }

    private func saveCompany() {
        guard let name = companyName.trimmedNonEmpty else { return }
        saving = true
        Task {
            let succeeded = await store.createCompany(AMDOSPocHubCompanyInput(
                companyName: name, companySize: companySize.trimmedNonEmpty, industryTags: amdOSPocSplit(companyTags), region: companyRegion.trimmedNonEmpty,
                pocProfile: companyProfile.trimmedNonEmpty, pocHistoryNote: companyHistory.trimmedNonEmpty, incentiveNote: companyIncentive.trimmedNonEmpty,
                ownerMemberID: companyOwner.trimmedNonEmpty, status: companyCreateStatus, nextAction: companyNextAction.trimmedNonEmpty,
                sourceKind: "meeting", sourceRef: "2026-07-09 PoCサービスMTG", updatedAt: ISO8601DateFormatter().string(from: .now)
            ))
            saving = false
            if succeeded { resetCompanyForm(); showingCompanyForm = false }
        }
    }

    private func createMatch(seed: AMDOSPocHubSeed, company: AMDOSPocHubCompanyItem) {
        saving = true
        let companyValue = company.company
        let seedTargets = seed.industryTarget ?? []
        let companyTags = companyValue.industryTags ?? []
        let overlap = seedTargets.filter { target in companyTags.contains { tag in amdOSPocNormalize(tag).contains(amdOSPocNormalize(target)) || amdOSPocNormalize(target).contains(amdOSPocNormalize(tag)) } }
        let targetText = seedTargets.prefix(3).joined(separator: " / ").trimmedNonEmpty ?? seed.domainLane ?? "用途"
        let companyText = companyTags.prefix(3).joined(separator: " / ").trimmedNonEmpty ?? companyValue.pocProfile ?? "現場課題"
        let fit = overlap.isEmpty
            ? "\(seed.title) の用途仮説（\(targetText)）と、\(companyValue.companyName)側のPoC文脈（\(companyText)）をヒアリングで照合する。"
            : "\(overlap.joined(separator: " / ")) が重なるため、\(seed.title) を \(companyValue.companyName) のPoC課題へ当てられるか確認する。"
        Task {
            let succeeded = await store.createMatch(AMDOSPocHubMatchInput(
                seedID: seed.id, companyID: companyValue.id, matchTitle: "\(seed.title) × \(companyValue.companyName)", fitHypothesis: fit,
                hearingQuestions: ["現場で一番重い未解決課題と、既存の代替手段は何か", "小さなPoCで測るべき効果・測定値・合格ラインは何か", "謝礼、有償PoC、契約、データ利用に進む条件は何か"],
                pocGoal: "実環境または実データに近い条件で、効果・コスト・導入条件を確認する。",
                rewardPlan: "ヒアリング謝礼または有償PoC費用を前提に、相手先の工数を無償扱いにしない。",
                contractPlan: "PoC検証の範囲、成果物、秘密保持、データ利用、責任範囲を事前に明記する。",
                fundingPlan: "相手先の実証予算、自治体・補助金、AMD/SU側の開発費負担を確認する。",
                revenueShareNote: "紹介・案件設計・DB利用・PoC伴走のどこで収益分配するかは個別設計にする。",
                status: "candidate", priority: "medium", nextAction: "仮説を見て、初回ヒアリングで聞く順番を決める。", sourceNote: "シーズ×PoC先案件化キュー",
                updatedAt: ISO8601DateFormatter().string(from: .now)
            ))
            saving = false
            if !succeeded { return }
        }
    }

    private func resetSeedForm() {
        seedTitle = ""; seedOrgName = ""; seedRegion = ""; seedResearcher = ""; seedDomain = ""; seedTargets = ""; seedKeywords = ""; seedSummary = ""; seedOwner = ""; seedStatus = "candidate"; seedNextAction = ""
    }

    private func resetCompanyForm() {
        companyName = ""; companySize = ""; companyTags = ""; companyRegion = ""; companyProfile = ""; companyHistory = ""; companyIncentive = ""; companyOwner = ""; companyCreateStatus = "candidate"; companyNextAction = ""
    }
}

@ViewBuilder
private func amdOSPocNote(_ label: String, _ value: String?) -> some View {
    if let value = value?.trimmedNonEmpty {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
            Text(value).font(.caption).lineLimit(3)
        }
    }
}

private func amdOSPocSplit(_ value: String) -> [String] {
    value.split(whereSeparator: { $0 == "," || $0 == "\n" || $0 == "\r" })
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
}

private func amdOSPocNormalize(_ value: String) -> String {
    value.lowercased().replacingOccurrences(of: #"\s+"#, with: "", options: .regularExpression)
}

private func amdOSPocSeedTerms(_ seed: AMDOSPocHubSeed) -> [String] {
    [seed.title, seed.summary, seed.orgName, seed.orgRegion, seed.researcherName, seed.domainLane]
        .compactMap { $0 }
        + (seed.industryTarget ?? [])
        + (seed.keywords ?? [])
}

private func amdOSPocCompanyTerms(_ company: AMDOSPocHubCompany) -> [String] {
    [company.companyName, company.companySize, company.region, company.pocProfile, company.pocHistoryNote, company.incentiveNote, company.nextAction]
        .compactMap { $0 }
        + (company.industryTags ?? [])
}

private func amdOSPocCompanySelectionTags(_ company: AMDOSPocHubCompany) -> [String] {
    var seen: Set<String> = []
    return ((company.industryTags ?? []) + [company.region, company.companySize, amdOSPocCompanyStatusLabel(company.status)].compactMap { $0 })
        .filter { seen.insert($0).inserted }
}

private func amdOSPocCandidate(seed: AMDOSPocHubSeed, company: AMDOSPocHubCompanyItem, query: String, selectedTags: Set<String>) -> AMDOSPocHubPairCandidate {
    let seedTerms = amdOSPocSeedTerms(seed)
    let companyTerms = amdOSPocCompanyTerms(company.company)
    let companyText = amdOSPocNormalize(companyTerms.joined(separator: " "))
    let seedText = amdOSPocNormalize(seedTerms.joined(separator: " "))
    let overlap = seedTerms.filter { term in
        let normalized = amdOSPocNormalize(term)
        return normalized.count > 1 && companyText.contains(normalized)
    }.prefix(6)
    let reverse = (company.company.industryTags ?? []).filter { tag in
        let normalized = amdOSPocNormalize(tag)
        return normalized.count > 1 && seedText.contains(normalized)
    }.prefix(6)
    var seen: Set<String> = []
    let uniqueOverlap = (Array(overlap) + Array(reverse)).filter { seen.insert($0).inserted }
    let queryHit = !query.isEmpty && (companyText.contains(query) || seedText.contains(query)) ? 6 : 0
    let tagBoost = selectedTags.isEmpty ? 0 : selectedTags.count * 3
    let statusBoost: Int
    switch company.company.status {
    case "poc_ready": statusBoost = 3
    case "hearing", "contacted": statusBoost = 2
    case "listed": statusBoost = 1
    default: statusBoost = 0
    }
    let score = uniqueOverlap.count * 4 + queryHit + tagBoost + statusBoost + min(2, company.activeMatchCount)
    return AMDOSPocHubPairCandidate(company: company, overlap: uniqueOverlap, score: score)
}

private func amdOSPocMatchMatchesQuery(_ item: AMDOSPocHubMatchItem, query: String) -> Bool {
    guard !query.isEmpty else { return true }
    return amdOSPocNormalize([
        item.match.matchTitle, item.match.fitHypothesis, item.match.nextAction, item.company?.companyName,
        (item.company?.industryTags ?? []).joined(separator: " ")
    ].compactMap { $0 }.joined(separator: " ")).contains(query)
}
