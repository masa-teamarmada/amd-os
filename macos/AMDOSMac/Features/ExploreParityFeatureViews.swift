import SwiftUI
import Foundation

// These views intentionally mirror the page-level contracts in pwa/src/app/(app).
// They are not a generic table renderer: every route owns its filters, fields,
// state transitions, and write path.

private struct AMDOSParitySeed: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let summary: String?
    let orgName: String
    let orgType: String?
    let orgRegion: String?
    let orgURL: String?
    let researcherName: String?
    let researcherTitle: String?
    let labName: String?
    let researcherURL: String?
    let domainLane: String?
    let industryTarget: [String]?
    let keywords: [String]?
    let trl: Int?
    let brl: Int?
    let hrl: Int?
    let status: String
    let amdRating: Int?
    let amdRatingNote: String?
    let amdOwnerMemberID: String?
    let nextAction: String?
    let internalNotes: String?
    let publicSummary: String?
    let isPublic: Bool
    let spunOffProjectID: String?
    let source: String?
    let sourceDetail: String?
    let deepDiveMaterialURL: String?
    let discoveryStatus: String
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, summary
        case orgName = "org_name", orgType = "org_type", orgRegion = "org_region", orgURL = "org_url"
        case researcherName = "researcher_name", researcherTitle = "researcher_title", labName = "lab_name", researcherURL = "researcher_url"
        case domainLane = "domain_lane", industryTarget = "industry_target", keywords, trl, brl, hrl
        case status, amdRating = "amd_rating", amdRatingNote = "amd_rating_note", amdOwnerMemberID = "amd_owner_member_id"
        case nextAction = "next_action", internalNotes = "internal_notes", publicSummary = "public_summary", isPublic = "is_public"
        case spunOffProjectID = "spun_off_project_id", source, sourceDetail = "source_detail", deepDiveMaterialURL = "deep_dive_material_url"
        case discoveryStatus = "discovery_status", createdAt = "created_at", updatedAt = "updated_at"
    }
}

private struct AMDOSParitySeedFunding: Codable, Identifiable, Sendable {
    let id: String
    let seedID: String
    let program: String
    let programShort: String?
    let amountJPY: Double?
    let fiscalYear: Int?
    let status: String?
    let sourceURL: String?
    let notes: String?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, seedID = "seed_id", program, programShort = "program_short", amountJPY = "amount_jpy", fiscalYear = "fiscal_year", status
        case sourceURL = "source_url", notes, updatedAt = "updated_at"
    }
}

private struct AMDOSParitySeedNews: Codable, Identifiable, Sendable {
    let id: String
    let seedID: String
    let kind: String
    let title: String
    let body: String?
    let occurredOn: String?
    let sourceURL: String?
    let verified: Bool
    let dismissed: Bool
    let updatedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, seedID = "seed_id", kind, title, body, occurredOn = "occurred_on", sourceURL = "source_url", verified, dismissed, updatedAt = "updated_at"
    }
}

private struct AMDOSParitySeedContact: Codable, Identifiable, Sendable {
    let id: String
    let seedID: String
    let contactedOn: String
    let method: String?
    let memberID: String?
    let note: String
    let nextAction: String?
    enum CodingKeys: String, CodingKey { case id, seedID = "seed_id", contactedOn = "contacted_on", method, memberID = "amd_member_id", note, nextAction = "next_action" }
}

private struct AMDOSParityMember: Codable, Identifiable, Sendable {
    let id: String
    let codeName: String
    enum CodingKeys: String, CodingKey { case id = "member_id", codeName = "code_name" }
}

private struct AMDOSParityProjectRef: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let status: String?
    enum CodingKeys: String, CodingKey { case id = "project_id", name = "project_name", status }
}

private struct AMDOSParityProjectVentureRef: Codable, Identifiable, Sendable {
    let id: String
    let shortLabel: String?
    enum CodingKeys: String, CodingKey { case id = "project_id", shortLabel = "short_label" }
}

private struct AMDOSParitySeedProject: Codable, Identifiable, Sendable {
    let projectID: String
    let seedID: String
    let commercializationStage: String?
    let commercializationRoute: String?
    let ventureName: String?
    let targetMarket: String?

    var id: String { projectID }

    enum CodingKeys: String, CodingKey {
        case projectID = "project_id", seedID = "seed_id"
        case commercializationStage = "commercialization_stage", commercializationRoute = "commercialization_route"
        case ventureName = "venture_name", targetMarket = "target_market"
    }
}

private struct AMDOSParitySeedPayload: Encodable, Sendable {
    let title: String
    let summary: String?
    let orgName: String
    let orgType: String?
    let orgRegion: String?
    let orgURL: String?
    let researcherName: String?
    let researcherTitle: String?
    let labName: String?
    let researcherURL: String?
    let domainLane: String?
    let industryTarget: [String]?
    let keywords: [String]?
    let trl: Int?
    let brl: Int?
    let hrl: Int?
    let status: String
    let amdRating: Int?
    let amdRatingNote: String?
    let amdOwnerMemberID: String?
    let nextAction: String?
    let internalNotes: String?
    let publicSummary: String?
    let isPublic: Bool
    let spunOffProjectID: String?
    let source: String?
    let sourceDetail: String?
    let deepDiveMaterialURL: String?
    let discoveryStatus: String
    let updatedAt: String
    enum CodingKeys: String, CodingKey {
        case title, summary, orgName = "org_name", orgType = "org_type", orgRegion = "org_region", orgURL = "org_url"
        case researcherName = "researcher_name", researcherTitle = "researcher_title", labName = "lab_name", researcherURL = "researcher_url"
        case domainLane = "domain_lane", industryTarget = "industry_target", keywords, trl, brl, hrl, status
        case amdRating = "amd_rating", amdRatingNote = "amd_rating_note", amdOwnerMemberID = "amd_owner_member_id"
        case nextAction = "next_action", internalNotes = "internal_notes", publicSummary = "public_summary", isPublic = "is_public"
        case spunOffProjectID = "spun_off_project_id", source, sourceDetail = "source_detail", deepDiveMaterialURL = "deep_dive_material_url"
        case discoveryStatus = "discovery_status", updatedAt = "updated_at"
    }
}

private struct AMDOSParityDeepDive: Codable, Sendable {
    struct Document: Codable, Sendable {
        let fileName: String
        let mimeType: String
        let fileSizeBytes: Int
        let webViewLink: String
    }

    let ok: Bool?
    let document: Document?
    let markdown: String?
    let error: String?
}

@MainActor
private final class AMDOSSeedParityStore: ObservableObject {
    @Published var seeds: [AMDOSParitySeed] = []
    @Published var funding: [AMDOSParitySeedFunding] = []
    @Published var news: [AMDOSParitySeedNews] = []
    @Published var contacts: [AMDOSParitySeedContact] = []
    @Published var members: [AMDOSParityMember] = []
    @Published var projects: [AMDOSParityProjectRef] = []
    @Published var projectVentures: [AMDOSParityProjectVentureRef] = []
    @Published var seedProjects: [AMDOSParitySeedProject] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?
    @Published var deepDive: AMDOSParityDeepDive?

    func load() async {
        state = .loading
        message = nil
        do {
            async let nextSeeds = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeed.self, table: "seeds", select: "*", order: "updated_at.desc", limit: 500)
            async let nextFunding = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeedFunding.self, table: "seed_funding", select: "*", order: "fiscal_year.desc", limit: 1000)
            async let nextNews = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeedNews.self, table: "seed_news", select: "*", order: "occurred_on.desc", limit: 1000)
            async let nextContacts = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeedContact.self, table: "seed_contact_log", select: "*", order: "contacted_on.desc", limit: 1000)
            async let nextMembers = AMDOSRESTClient.shared.fetchTable(AMDOSParityMember.self, table: "members", select: "member_id,code_name", order: "code_name", limit: 500)
            async let nextProjects = AMDOSRESTClient.shared.fetchTable(AMDOSParityProjectRef.self, table: "projects", select: "project_id,project_name,status", order: "project_name", limit: 500)
            async let nextProjectVentures = AMDOSRESTClient.shared.fetchTable(AMDOSParityProjectVentureRef.self, table: "project_ventures", select: "project_id,short_label", limit: 500)
            async let nextSeedProjects = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeedProject.self, table: "seed_projects", select: "project_id,seed_id,commercialization_stage,commercialization_route,venture_name,target_market", limit: 500)
            seeds = try await nextSeeds
            funding = try await nextFunding
            news = try await nextNews
            contacts = try await nextContacts
            members = try await nextMembers
            projects = try await nextProjects
            projectVentures = try await nextProjectVentures
            seedProjects = try await nextSeedProjects
            state = seeds.isEmpty ? .empty : .loaded
        } catch {
            message = error.localizedDescription
            state = .failed(message ?? "シーズを取得できなかった")
        }
    }

    func load(seedID: String) async {
        state = .loading
        message = nil
        do {
            async let nextSeeds = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeed.self, table: "seeds", select: "*", filters: ["id": "eq.\(seedID)"], limit: 1)
            async let nextFunding = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeedFunding.self, table: "seed_funding", select: "*", filters: ["seed_id": "eq.\(seedID)"], order: "fiscal_year.desc")
            async let nextNews = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeedNews.self, table: "seed_news", select: "*", filters: ["seed_id": "eq.\(seedID)"], order: "occurred_on.desc", limit: 100)
            async let nextContacts = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeedContact.self, table: "seed_contact_log", select: "*", filters: ["seed_id": "eq.\(seedID)"], order: "contacted_on.desc")
            async let nextMembers = AMDOSRESTClient.shared.fetchTable(AMDOSParityMember.self, table: "members", select: "member_id,code_name", order: "code_name", limit: 500)
            async let nextProjects = AMDOSRESTClient.shared.fetchTable(AMDOSParityProjectRef.self, table: "projects", select: "project_id,project_name,status", order: "project_name", limit: 500)
            async let nextProjectVentures = AMDOSRESTClient.shared.fetchTable(AMDOSParityProjectVentureRef.self, table: "project_ventures", select: "project_id,short_label", limit: 500)
            async let nextSeedProjects = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeedProject.self, table: "seed_projects", select: "project_id,seed_id,commercialization_stage,commercialization_route,venture_name,target_market", filters: ["seed_id": "eq.\(seedID)"], limit: 100)
            seeds = try await nextSeeds
            funding = try await nextFunding
            news = try await nextNews
            contacts = try await nextContacts
            members = try await nextMembers
            projects = try await nextProjects
            projectVentures = try await nextProjectVentures
            seedProjects = try await nextSeedProjects
            state = seeds.isEmpty ? .empty : .loaded
        } catch {
            message = error.localizedDescription
            state = .failed(message ?? "シーズ詳細を取得できなかった")
        }
    }

    func loadInbox() async {
        state = .loading
        message = nil
        do {
            async let nextSeeds = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeed.self, table: "seeds", select: "*", filters: ["discovery_status": "eq.discovered"], order: "created_at.desc", limit: 200)
            async let nextFunding = AMDOSRESTClient.shared.fetchTable(AMDOSParitySeedFunding.self, table: "seed_funding", select: "*", order: "fiscal_year.desc")
            seeds = try await nextSeeds
            funding = try await nextFunding
            state = seeds.isEmpty ? .empty : .loaded
        } catch {
            message = error.localizedDescription
            state = .failed(message ?? "Seeds受信箱を取得できなかった")
        }
    }

    func loadLookups() async {
        message = nil
        do {
            async let nextMembers = AMDOSRESTClient.shared.fetchTable(AMDOSParityMember.self, table: "members", select: "member_id,code_name", order: "code_name", limit: 500)
            async let nextProjects = AMDOSRESTClient.shared.fetchTable(AMDOSParityProjectRef.self, table: "projects", select: "project_id,project_name,status", order: "project_name", limit: 500)
            async let nextProjectVentures = AMDOSRESTClient.shared.fetchTable(AMDOSParityProjectVentureRef.self, table: "project_ventures", select: "project_id,short_label", limit: 500)
            members = try await nextMembers
            projects = try await nextProjects
            projectVentures = try await nextProjectVentures
        } catch {
            message = error.localizedDescription
        }
    }

    func updateDiscoveryStatus(_ id: String, _ status: String) async {
        do {
            _ = try await AMDOSRESTClient.shared.patchTable(table: "seeds", filters: ["id": "eq.\(id)"], body: AMDOSSeedReviewPatch(discoveryStatus: status, updatedAt: ISO8601DateFormatter().string(from: .now)))
            await loadInbox()
        } catch {
            message = error.localizedDescription
        }
    }

    func loadDeepDive(seedID: String) async {
        deepDive = nil
        message = nil
        do {
            deepDive = try await AMDOSRESTClient.shared.fetchPWA(AMDOSParityDeepDive.self, path: "/api/seeds/\(seedID)/deep-dive")
        } catch {
            message = error.localizedDescription
        }
    }
}

private enum AMDOSParitySeedSortKey: String, CaseIterable, Identifiable {
    case title, orgName, researcherName, domainLane, status, amdRating, trl, owner, lastContactedOn, fundingTotal, deepDiveMaterial, updatedAt

    var id: String { rawValue }
    var label: String {
        switch self {
        case .title: return "シーズ"
        case .orgName: return "機関"
        case .researcherName: return "PI"
        case .domainLane: return "領域"
        case .status: return "状態"
        case .amdRating: return "★"
        case .trl: return "成熟度"
        case .owner: return "担当"
        case .lastContactedOn: return "最終接触"
        case .fundingTotal: return "資金獲得実績"
        case .deepDiveMaterial: return "深掘り資料"
        case .updatedAt: return "更新日"
        }
    }

    var isText: Bool {
        switch self {
        case .title, .orgName, .researcherName, .domainLane, .status, .owner: return true
        default: return false
        }
    }
}

struct AMDOSParitySeedsView: View {
    let onSelectSeed: (String) -> Void
    let onOpenInbox: () -> Void
    let onOpenMacrotrends: () -> Void
    @StateObject private var store = AMDOSSeedParityStore()
    @State private var search = ""
    @State private var status = "all"
    @State private var domain = "all"
    @State private var owner = "all"
    @State private var sortKey: AMDOSParitySeedSortKey = .updatedAt
    @State private var sortAscending = false
    @State private var showingEditor = false
    @State private var editorSeed: AMDOSParitySeed?
    @State private var previewSeed: AMDOSParitySeed?

    private var owners: [(id: String, name: String)] {
        let ownerIDs = Set(store.seeds.compactMap(\.amdOwnerMemberID))
        return store.members
            .filter { ownerIDs.contains($0.id) }
            .map { (id: $0.id, name: $0.codeName) }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    private var inboxCount: Int {
        store.seeds.filter { $0.discoveryStatus == "discovered" }.count
    }

    private var filtered: [AMDOSParitySeed] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let list = store.seeds.filter { seed in
            let statusOK = status == "all" || seed.status == status
            let domainOK = domain == "all" || seed.domainLane == domain
            let ownerOK = owner == "all" || seed.amdOwnerMemberID == owner
            let text = [seed.title, seed.summary, seed.orgName, seed.researcherName, seed.labName, (seed.keywords ?? []).joined(separator: " ")].compactMap { $0 }.joined(separator: " ").lowercased()
            return statusOK && domainOK && ownerOK && (query.isEmpty || text.contains(query))
        }
        // AMDとのPJ契約を最優先にし、その中を選択列で並べる。シーズ自体のstatusとは混ぜない。
        return list.enumerated().sorted { lhs, rhs in
            let projectOrder = projectPriority(lhs.element) - projectPriority(rhs.element)
            if projectOrder != 0 { return projectOrder < 0 }
            let comparison = compare(lhs.element, rhs.element)
            if comparison == .orderedSame { return lhs.offset < rhs.offset }
            return sortAscending ? comparison == .orderedAscending : comparison == .orderedDescending
        }.map(\.element)
    }

    private func projectLinks(for seed: AMDOSParitySeed) -> [(row: AMDOSParitySeedProject, project: AMDOSParityProjectRef?)] {
        store.seedProjects
            .filter { $0.seedID == seed.id }
            .map { row in (row: row, project: store.projects.first(where: { $0.id == row.projectID })) }
    }

    private func projectLifecycle(_ status: String?) -> Int {
        let normalized = (status ?? "").lowercased()
        if ["active", "ended", "frozen"].contains(normalized) { return 0 }
        if ["sales", "draft"].contains(normalized) { return 1 }
        return 2
    }

    private func projectPriority(_ seed: AMDOSParitySeed) -> Int {
        let links = projectLinks(for: seed)
        if links.contains(where: { projectLifecycle($0.project?.status) == 0 }) { return 0 }
        if links.contains(where: { projectLifecycle($0.project?.status) == 1 }) { return 1 }
        if ["contacted", "discussing"].contains(seed.status) { return 1 }
        return 2
    }

    private func ownerName(for seed: AMDOSParitySeed) -> String? {
        guard let id = seed.amdOwnerMemberID else { return nil }
        return store.members.first(where: { $0.id == id })?.codeName
    }

    private func fundingRows(for seed: AMDOSParitySeed) -> [AMDOSParitySeedFunding] {
        store.funding
            .filter { $0.seedID == seed.id }
            .sorted {
                let lhsYear = $0.fiscalYear ?? -1
                let rhsYear = $1.fiscalYear ?? -1
                if lhsYear != rhsYear { return lhsYear > rhsYear }
                return ($0.programShort ?? "").localizedStandardCompare($1.programShort ?? "") == .orderedAscending
            }
    }

    private func fundingPrograms(for seed: AMDOSParitySeed) -> [(program: String, year: Int?)] {
        var seen: Set<String> = []
        return fundingRows(for: seed).compactMap { row in
            guard let program = row.programShort?.trimmedNonEmpty, seen.insert(program).inserted else { return nil }
            return (program: program, year: row.fiscalYear)
        }
    }

    private func fundingTotal(for seed: AMDOSParitySeed) -> Double {
        fundingRows(for: seed).reduce(0) { $0 + ($1.amountJPY ?? 0) }
    }

    private func lastContact(for seed: AMDOSParitySeed) -> String? {
        store.contacts.filter { $0.seedID == seed.id }.map(\.contactedOn).max()
    }

    private func fundingSummary(for seed: AMDOSParitySeed) -> String {
        let programs = fundingPrograms(for: seed)
        let visible = programs.prefix(3).map { item -> String in
            guard let year = item.year else { return item.program }
            return "\(item.program) '\(String(year).suffix(2))"
        }.joined(separator: " · ")
        let overflow = programs.count > 3 ? " +\(programs.count - 3)" : ""
        let total = fundingTotal(for: seed)
        let amount = total > 0 ? "  \(amdOSParitySeedJPY(total))" : ""
        return "資金: \(visible)\(overflow)\(amount)"
    }

    private func compare(_ lhs: AMDOSParitySeed, _ rhs: AMDOSParitySeed) -> ComparisonResult {
        switch sortKey {
        case .title: return lhs.title.localizedStandardCompare(rhs.title)
        case .orgName: return lhs.orgName.localizedStandardCompare(rhs.orgName)
        case .researcherName: return (lhs.researcherName ?? "").localizedStandardCompare(rhs.researcherName ?? "")
        case .domainLane: return (lhs.domainLane ?? "").localizedStandardCompare(rhs.domainLane ?? "")
        case .status:
            let order = ["candidate", "investigating", "contacted", "discussing", "spun_off", "declined"]
            return amdOSParitySeedCompare(order.firstIndex(of: lhs.status) ?? -1, order.firstIndex(of: rhs.status) ?? -1)
        case .amdRating: return amdOSParitySeedCompare(lhs.amdRating ?? -1, rhs.amdRating ?? -1)
        case .trl: return amdOSParitySeedCompare(lhs.trl ?? -1, rhs.trl ?? -1)
        case .owner: return (ownerName(for: lhs) ?? "").localizedStandardCompare(ownerName(for: rhs) ?? "")
        case .lastContactedOn: return (lastContact(for: lhs) ?? "").localizedStandardCompare(lastContact(for: rhs) ?? "")
        case .fundingTotal: return amdOSParitySeedCompare(fundingTotal(for: lhs), fundingTotal(for: rhs))
        case .deepDiveMaterial:
            return amdOSParitySeedCompare(lhs.deepDiveMaterialURL?.trimmedNonEmpty == nil ? 0 : 1, rhs.deepDiveMaterialURL?.trimmedNonEmpty == nil ? 0 : 1)
        case .updatedAt: return (lhs.updatedAt ?? "").localizedStandardCompare(rhs.updatedAt ?? "")
        }
    }

    private func selectSort(_ next: AMDOSParitySeedSortKey) {
        if next == sortKey { sortAscending.toggle() }
        else { sortKey = next; sortAscending = next.isText }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "SEEDS", title: "研究シーズ", subtitle: "AMDとの契約有無に関係なく全件を蓄積し、契約したシーズには同じ行へPJ運用情報を重ねる") {
            HStack(alignment: .top) {
                TextField("シーズ / 機関 / PI / キーワード", text: $search).textFieldStyle(.roundedBorder)
                Picker("シーズ状態", selection: $status) { Text("全シーズ").tag("all"); ForEach(["candidate", "investigating", "contacted", "discussing", "spun_off", "declined"], id: \.self) { Text(amdOSParitySeedStatusLabel($0)).tag($0) } }
                Picker("領域", selection: $domain) { Text("全領域").tag("all"); ForEach(["gx_energy", "gx_circular", "life", "materials", "robo", "ict", "other"], id: \.self) { Text(amdOSParitySeedDomainLabel($0)).tag($0) } }
                Picker("担当", selection: $owner) { Text("全担当").tag("all"); ForEach(owners, id: \.id) { Text($0.name).tag($0.id) } }
            }
            HStack(spacing: 8) {
                Button("Macrotrend別 →", action: onOpenMacrotrends).buttonStyle(.bordered)
                Button("受信箱 →\(inboxCount > 0 ? " \(inboxCount > 99 ? "99+" : String(inboxCount))" : "")", action: onOpenInbox).buttonStyle(.bordered)
                Button("＋ 新規シーズ") { editorSeed = nil; showingEditor = true }.buttonStyle(.borderedProminent)
                Spacer()
                Picker("並び", selection: Binding(
                    get: { sortKey },
                    set: { selectSort($0) }
                )) {
                    ForEach(AMDOSParitySeedSortKey.allCases) { Text($0.label).tag($0) }
                }
                .frame(width: 160)
                Button(sortAscending ? "昇順" : "降順") { selectSort(sortKey) }.buttonStyle(.bordered)
            }
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            Text("\(filtered.count) / \(store.seeds.count) 件").font(.caption).foregroundStyle(AMDOSDesign.muted)
            ForEach(filtered) { seed in
                let projectLinks = projectLinks(for: seed)
                let lifecycle = projectPriority(seed)
                let primaryProject = projectLinks.first(where: { projectLifecycle($0.project?.status) == 0 })
                    ?? projectLinks.first(where: { projectLifecycle($0.project?.status) == 1 })
                    ?? projectLinks.first
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 9) {
                        if lifecycle < 2 {
                            HStack(spacing: 6) {
                                Image(systemName: lifecycle == 0 ? "briefcase.fill" : "clock.arrow.circlepath")
                                Text("\(lifecycle == 0 ? "PJ化済み" : "PJ化検討中")\(primaryProject.map { " · \($0.project?.name ?? $0.row.projectID)" } ?? "")")
                            }
                            .font(.caption.weight(.bold))
                            .foregroundStyle(lifecycle == 0 ? Color.white : AMDOSDesign.warning)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(lifecycle == 0 ? AMDOSDesign.blue : AMDOSDesign.warning.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                        }
                        HStack(alignment: .top) {
                            Button { onSelectSeed(seed.id) } label: {
                                HStack(spacing: 6) {
                                    if seed.discoveryStatus == "discovered" { AMDOSStatusBadge(text: "🆕", tint: AMDOSDesign.blue) }
                                    Text(seed.title).font(.headline)
                                }
                            }
                            .buttonStyle(.plain)
                            Spacer()
                            AMDOSStatusBadge(text: "シーズ: \(amdOSParitySeedStatusLabel(seed.status))", tint: amdOSParitySeedStatusTint(seed.status))
                        }
                        Text("\(seed.orgName)\(seed.orgType.map { " · \(amdOSParitySeedOrgTypeLabel($0))" } ?? "") · \(seed.researcherName ?? "—")\(seed.labName.map { " / \($0)" } ?? "")")
                            .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        Text(seed.summary ?? "概要なし").lineLimit(2)
                        HStack(spacing: 12) {
                            Text("\(amdOSParitySeedDomainLabel(seed.domainLane)) · TRL \(seed.trl.map(String.init) ?? "·") / \(seed.brl.map(String.init) ?? "·") / \(seed.hrl.map(String.init) ?? "·")")
                            Text(seed.amdRating.map { String(repeating: "★", count: $0) + String(repeating: "☆", count: max(0, 5 - $0)) } ?? "☆☆☆☆☆").foregroundStyle(.orange)
                            if let owner = ownerName(for: seed) { Text("担当 \(owner)") }
                            Spacer()
                            Button("詳細") { onSelectSeed(seed.id) }.buttonStyle(.bordered)
                            if seed.deepDiveMaterialURL?.trimmedNonEmpty != nil {
                                Button("深掘り資料") { previewSeed = seed }.buttonStyle(.bordered)
                            }
                        }.font(.caption2).foregroundStyle(AMDOSDesign.muted)
                        if !fundingPrograms(for: seed).isEmpty || fundingTotal(for: seed) > 0 {
                            Text(fundingSummary(for: seed))
                                .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                        }
                        HStack {
                            if let next = seed.nextAction { Label(next, systemImage: "arrow.right").font(.caption).foregroundStyle(AMDOSDesign.success) }
                            Spacer()
                            Text(lastContact(for: seed).map { "最終接触 \($0)" } ?? "最終接触 —").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                }
            }
        }
        .task { await store.load() }
        .sheet(isPresented: $showingEditor) { AMDOSParitySeedEditor(seed: editorSeed) { Task { await store.load() } } }
        .sheet(item: $previewSeed) { seed in AMDOSParitySeedDeepDiveSheet(seed: seed, store: store) }
    }
}

private struct AMDOSParitySeedDeepDiveSheet: View {
    let seed: AMDOSParitySeed
    @ObservedObject var store: AMDOSSeedParityStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "doc.text").font(.title3).foregroundStyle(AMDOSDesign.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text(store.deepDive?.document?.fileName ?? seed.title).font(.title3.bold()).lineLimit(1)
                    Text(store.deepDive?.document.map { "\(amdOSParitySeedByteCount($0.fileSizeBytes)) / Markdown" } ?? "深掘り資料")
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                Spacer()
                if let link = store.deepDive?.document?.webViewLink ?? seed.deepDiveMaterialURL,
                   let url = URL(string: link) {
                    Link(destination: url) { Label("Driveで開く", systemImage: "arrow.up.right.square") }.buttonStyle(.bordered)
                }
                Button("閉じる") { dismiss() }.keyboardShortcut(.cancelAction)
            }
            .padding(20)
            Divider()
            if let markdown = store.deepDive?.markdown {
                ScrollView {
                    Text(amdOSParitySeedMarkdown(markdown))
                        .frame(maxWidth: 920, alignment: .leading)
                        .textSelection(.enabled)
                        .padding(28)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            } else if let error = store.deepDive?.error ?? store.message {
                ContentUnavailableView("資料を開けなかった", systemImage: "exclamationmark.triangle", description: Text(error))
            } else {
                ProgressView("深掘り資料を読み込み中…").frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(minWidth: 760, idealWidth: 980, minHeight: 560, idealHeight: 760)
        .task { await store.loadDeepDive(seedID: seed.id) }
    }
}

private func amdOSParitySeedMarkdown(_ markdown: String) -> AttributedString {
    (try? AttributedString(markdown: markdown, options: .init(interpretedSyntax: .full))) ?? AttributedString(markdown)
}

private func amdOSParitySeedByteCount(_ bytes: Int) -> String {
    guard bytes > 0 else { return "サイズ不明" }
    if bytes < 1_024 { return "\(bytes) B" }
    if bytes < 1_048_576 { return "\(Int((Double(bytes) / 1_024).rounded())) KB" }
    return String(format: "%.1f MB", Double(bytes) / 1_048_576)
}

private func amdOSParitySeedStatusLabel(_ value: String) -> String {
    ["candidate": "候補", "investigating": "調査中", "contacted": "接触済", "discussing": "協議中", "spun_off": "スピンアウト済み", "declined": "見送り"][value] ?? value
}

private func amdOSParitySeedStatusTint(_ value: String) -> Color {
    switch value { case "investigating": return AMDOSDesign.blue; case "contacted": return AMDOSDesign.warning; case "discussing": return AMDOSDesign.success; case "spun_off": return .purple; default: return AMDOSDesign.muted }
}

private func amdOSParitySeedOrgTypeLabel(_ value: String) -> String {
    ["university": "大学", "national_lab": "国研", "kosen": "高専", "private_lab": "民間研", "other": "その他"][value] ?? value
}

private func amdOSParitySeedDomainLabel(_ value: String?) -> String {
    guard let value else { return "—" }
    return ["gx_energy": "GX/エネルギー", "gx_circular": "GX/サーキュラー", "life": "ライフ/医療", "materials": "素材/ナノ", "robo": "ロボ/農・モビ", "ict": "ICT", "other": "その他"][value] ?? value
}

private func amdOSParitySeedSourceLabel(_ value: String) -> String {
    ["introduction": "紹介", "web_search": "Web検索", "conference": "学会", "referral": "リファラル", "cold": "コールド", "grant_db": "助成DB", "researchmap": "researchmap", "other": "その他"][value] ?? value
}

private func amdOSParitySeedFundingStatusLabel(_ value: String) -> String {
    ["awarded": "採択", "ongoing": "実施中", "completed": "完了", "rejected": "不採択", "pending": "申請中"][value] ?? value
}

private func amdOSParitySeedNewsKindLabel(_ value: String) -> String {
    ["publication": "論文", "press": "プレス", "grant": "助成", "patent": "特許", "event": "イベント", "other": "その他"][value] ?? value
}

private func amdOSParitySeedContactMethodLabel(_ value: String) -> String {
    ["email": "メール", "phone": "電話", "meeting": "面談", "event": "イベント", "referral": "紹介", "visit": "訪問", "other": "その他"][value] ?? value
}

private func amdOSParitySeedJPY(_ value: Double) -> String {
    if value >= 1_000_000_000_000 { return String(format: "%.1f兆", value / 1_000_000_000_000) }
    if value >= 100_000_000 { return String(format: "%.1f億", value / 100_000_000) }
    if value >= 10_000 { return "\(Int((value / 10_000).rounded()))万" }
    return "\(Int(value.rounded()))"
}

private func amdOSParitySeedCompare<Value: Comparable>(_ lhs: Value, _ rhs: Value) -> ComparisonResult {
    if lhs < rhs { return .orderedAscending }
    if lhs > rhs { return .orderedDescending }
    return .orderedSame
}

struct AMDOSParitySeedDetailView: View {
    let seedID: String?
    let onClose: () -> Void
    @StateObject private var store = AMDOSSeedParityStore()
    @State private var showingEditor = false
    @State private var showingDeepDive = false
    @State private var confirmingDelete = false
    @State private var deleting = false
    @State private var actionError: String?

    var body: some View {
        AMDOSPageScaffold(eyebrow: "SEED DETAIL", title: store.seeds.first(where: { $0.id == seedID })?.title ?? "シーズ詳細", subtitle: "研究シーズの概要・AMD評価・資金・接触・ニュースを管理する") {
            AMDOSStateNotice(state: store.state) { if let seedID { Task { await store.load(seedID: seedID) } } }
            if let seedID, let seed = store.seeds.first(where: { $0.id == seedID }) {
                let seedProjectRows = store.seedProjects.filter { $0.seedID == seed.id }
                HStack(spacing: 10) {
                    Button("← Seedsリスト", action: onClose).buttonStyle(.bordered)
                    AMDOSStatusBadge(text: amdOSParitySeedStatusLabel(seed.status), tint: amdOSParitySeedStatusTint(seed.status))
                    Text(seed.amdRating.map { String(repeating: "★", count: $0) + String(repeating: "☆", count: max(0, 5 - $0)) } ?? "☆☆☆☆☆").foregroundStyle(.orange)
                    if let projectRow = seedProjectRows.first {
                        Text("AMD PJ: \(projectName(projectRow.projectID))").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.blue)
                    }
                    if let owner = store.members.first(where: { $0.id == seed.amdOwnerMemberID })?.codeName {
                        Text("担当: \(owner)").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer()
                    Button("編集") { showingEditor = true }.buttonStyle(.bordered)
                    Button("削除…", role: .destructive) { confirmingDelete = true }.buttonStyle(.bordered).disabled(deleting)
                }
                if let actionError { Text(actionError).font(.caption).foregroundStyle(.red) }
                AMDOSSectionCard("シーズ概要", systemImage: "leaf.fill") {
                    LabeledContent("概要", value: seed.summary ?? "—")
                    LabeledContent("領域", value: amdOSParitySeedDomainLabel(seed.domainLane))
                    LabeledContent("成熟度 (TRL/BRL/HRL)", value: "\(seed.trl.map(String.init) ?? "·") / \(seed.brl.map(String.init) ?? "·") / \(seed.hrl.map(String.init) ?? "·")")
                    LabeledContent("応用先", value: (seed.industryTarget ?? []).joined(separator: ", ").nilIfEmpty ?? "—")
                    LabeledContent("キーワード", value: (seed.keywords ?? []).joined(separator: ", ").nilIfEmpty ?? "—")
                }
                AMDOSSectionCard("機関 / 研究者", systemImage: "building.2") {
                    if let url = seed.orgURL.flatMap(URL.init(string:)) { LabeledContent("機関") { Link("\(seed.orgName) ↗", destination: url) } } else { LabeledContent("機関", value: seed.orgName) }
                    LabeledContent("種別 / 地域", value: [seed.orgType.map(amdOSParitySeedOrgTypeLabel), seed.orgRegion].compactMap { $0 }.joined(separator: " · ").nilIfEmpty ?? "—")
                    LabeledContent("PI", value: [seed.researcherName, seed.researcherTitle].compactMap { $0 }.joined(separator: " · ").nilIfEmpty ?? "—")
                    LabeledContent("研究室", value: seed.labName ?? "—")
                    if let text = seed.researcherURL, let url = URL(string: text) { LabeledContent("researcher URL") { Link(text, destination: url).lineLimit(1) } }
                }
                AMDOSSectionCard("AMD評価", systemImage: "star.fill") {
                    LabeledContent("ステータス", value: amdOSParitySeedStatusLabel(seed.status))
                    LabeledContent("評価", value: seed.amdRating.map { String(repeating: "★", count: $0) } ?? "—")
                    LabeledContent("評価コメント", value: seed.amdRatingNote ?? "—")
                    LabeledContent("次の一手", value: seed.nextAction ?? "—")
                    LabeledContent("社内メモ", value: seed.internalNotes ?? "—")
                    LabeledContent("担当", value: store.members.first(where: { $0.id == seed.amdOwnerMemberID })?.codeName ?? "—")
                }
                AMDOSSectionCard("AMD シーズ事業化PJ", systemImage: "briefcase.fill") {
                    if seedProjectRows.isEmpty {
                        Text("AMDとの契約PJはまだない。シーズ情報とSPSは、このままカタログへ蓄積する。")
                            .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    } else {
                        ForEach(seedProjectRows) { row in
                            let project = store.projects.first(where: { $0.id == row.projectID })
                            VStack(alignment: .leading, spacing: 5) {
                                HStack {
                                    Text(project?.name ?? row.projectID).font(.headline)
                                    Spacer()
                                    AMDOSStatusBadge(text: project?.status ?? "状態不明", tint: AMDOSDesign.blue)
                                }
                                Text([row.commercializationStage, row.commercializationRoute, row.ventureName, row.targetMarket]
                                    .compactMap { $0?.trimmedNonEmpty }
                                    .joined(separator: " · ")
                                    .nilIfEmpty ?? "事業化固有情報は未入力")
                                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                            }
                        }
                    }
                    Text("SPSは個別シーズ評価。研究機関ECRとは合算しない。")
                        .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                }
                AMDOSSectionCard("ソース / 関連", systemImage: "link") {
                    LabeledContent("発見経路", value: [seed.source.map(amdOSParitySeedSourceLabel), seed.sourceDetail].compactMap { $0 }.joined(separator: " · ").nilIfEmpty ?? "—")
                    LabeledContent("公開可", value: seed.isPublic ? "Yes" : "No")
                    if let summary = seed.publicSummary { LabeledContent("公開要約", value: summary) }
                    LabeledContent("スピンアウト先（旧互換）", value: seed.spunOffProjectID.map(projectName) ?? "—")
                    LabeledContent("登録日", value: String(seed.createdAt?.prefix(10) ?? "—"))
                    LabeledContent("更新日", value: String(seed.updatedAt?.prefix(10) ?? "—"))
                    if seed.deepDiveMaterialURL != nil {
                        Button("深掘り資料を開く") { showingDeepDive = true }.buttonStyle(.bordered)
                    }
                }
                AMDOSParitySeedFundingSection(seedID: seed.id, rows: store.funding.filter { $0.seedID == seed.id }, onChanged: reload)
                AMDOSParitySeedContactSection(seedID: seed.id, rows: store.contacts.filter { $0.seedID == seed.id }, members: store.members, onChanged: reload)
                AMDOSParitySeedNewsSection(seedID: seed.id, rows: store.news.filter { $0.seedID == seed.id }, onChanged: reload)
            } else if seedID != nil {
                Text("指定されたシーズが見つからないよ。").foregroundStyle(AMDOSDesign.muted)
            }
        }
        .task { if let seedID { await store.load(seedID: seedID) } }
        .sheet(isPresented: $showingEditor) {
            if let seed = store.seeds.first(where: { $0.id == seedID }) { AMDOSParitySeedEditor(seed: seed) { if let seedID { Task { await store.load(seedID: seedID) } } } }
        }
        .sheet(isPresented: $showingDeepDive) {
            if let seed = store.seeds.first(where: { $0.id == seedID }) { AMDOSParitySeedDeepDiveSheet(seed: seed, store: store) }
        }
        .confirmationDialog("このシーズを削除する？", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("削除", role: .destructive) { deleteSeed() }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("シーズ「\(store.seeds.first(where: { $0.id == seedID })?.title ?? "")」を削除するよ。")
        }
    }

    private func reload() { if let seedID { Task { await store.load(seedID: seedID) } } }

    private func projectName(_ id: String) -> String {
        store.projectVentures.first(where: { $0.id == id })?.shortLabel?.trimmedNonEmpty
            ?? store.projects.first(where: { $0.id == id })?.name
            ?? id
    }

    private func deleteSeed() {
        guard let seedID else { return }
        deleting = true
        actionError = nil
        Task {
            do {
                try await AMDOSRESTClient.shared.deleteTable(table: "seeds", filters: ["id": "eq.\(seedID)"])
                onClose()
            } catch {
                actionError = error.localizedDescription
            }
            deleting = false
        }
    }
}

private struct AMDOSParitySeedFundingCreate: Encodable, Sendable {
    let seedID: String
    let program: String
    let programShort: String?
    let amountJPY: Double?
    let fiscalYear: Int?
    let status: String?
    let sourceURL: String?
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case seedID = "seed_id", program, programShort = "program_short", amountJPY = "amount_jpy", fiscalYear = "fiscal_year", status
        case sourceURL = "source_url", notes
    }
}

private struct AMDOSParitySeedContactCreate: Encodable, Sendable {
    let seedID: String
    let contactedOn: String
    let method: String?
    let memberID: String?
    let note: String
    let nextAction: String?
    enum CodingKeys: String, CodingKey {
        case seedID = "seed_id", contactedOn = "contacted_on", method, memberID = "amd_member_id", note, nextAction = "next_action"
    }
}

private struct AMDOSParitySeedNewsCreate: Encodable, Sendable {
    let seedID: String
    let kind: String
    let title: String
    let body: String?
    let occurredOn: String?
    let sourceURL: String?
    let ingestedBy: String
    let verified: Bool
    let dismissed: Bool
    enum CodingKeys: String, CodingKey {
        case seedID = "seed_id", kind, title, body, occurredOn = "occurred_on", sourceURL = "source_url"
        case ingestedBy = "ingested_by", verified, dismissed
    }
}

private struct AMDOSParitySeedFundingSection: View {
    let seedID: String
    let rows: [AMDOSParitySeedFunding]
    let onChanged: () -> Void
    @State private var showingAdd = false
    @State private var program = ""
    @State private var programShort = ""
    @State private var amount = ""
    @State private var fiscalYear = ""
    @State private var status = ""
    @State private var sourceURL = ""
    @State private var notes = ""
    @State private var busy = false
    @State private var error: String?
    @State private var pendingDeleteID: String?

    var body: some View {
        AMDOSSectionCard("補助金履歴 (\(rows.count))", systemImage: "yensign.circle") {
            HStack { Spacer(); Button(showingAdd ? "閉じる" : "+ 追加") { showingAdd.toggle() }.buttonStyle(.bordered) }
            if showingAdd {
                VStack(alignment: .leading, spacing: 10) {
                    HStack { AMDOSTextField(title: "プログラム名 *", text: $program); AMDOSTextField(title: "略号", text: $programShort) }
                    HStack { AMDOSTextField(title: "金額（円）", text: $amount); AMDOSTextField(title: "採択年度", text: $fiscalYear) }
                    HStack {
                        Picker("状態", selection: $status) {
                            Text("—").tag("")
                            ForEach(["awarded", "ongoing", "completed", "rejected", "pending"], id: \.self) { Text(amdOSParitySeedFundingStatusLabel($0)).tag($0) }
                        }
                        AMDOSTextField(title: "URL", text: $sourceURL)
                    }
                    AMDOSTextField(title: "メモ", text: $notes)
                    Button(busy ? "追加中…" : "追加") { add() }.buttonStyle(.borderedProminent).disabled(busy || program.trimmedNonEmpty == nil)
                }
                .padding(12).background(AMDOSDesign.panel.opacity(0.55), in: RoundedRectangle(cornerRadius: 10))
            }
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
            if rows.isEmpty { Text("なし").foregroundStyle(AMDOSDesign.muted) }
            ForEach(rows) { row in
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        if let text = row.sourceURL, let url = URL(string: text) { Link(row.program, destination: url).font(.subheadline.weight(.semibold)) }
                        else { Text(row.program).font(.subheadline.weight(.semibold)) }
                        Text([row.programShort, row.fiscalYear.map(String.init), row.amountJPY.map(amdOSParitySeedJPY), row.status.map(amdOSParitySeedFundingStatusLabel), row.notes].compactMap { $0 }.joined(separator: " · "))
                            .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer()
                    Button("削除", role: .destructive) { pendingDeleteID = row.id }.buttonStyle(.borderless)
                }
                Divider()
            }
        }
        .confirmationDialog("補助金履歴を削除する？", isPresented: Binding(get: { pendingDeleteID != nil }, set: { if !$0 { pendingDeleteID = nil } })) {
            Button("削除", role: .destructive) { if let id = pendingDeleteID { remove(id) } }
            Button("キャンセル", role: .cancel) { pendingDeleteID = nil }
        }
    }

    private func add() {
        guard let program = program.trimmedNonEmpty else { return }
        busy = true; error = nil
        let payload = AMDOSParitySeedFundingCreate(seedID: seedID, program: program, programShort: programShort.trimmedNonEmpty, amountJPY: Double(amount), fiscalYear: Int(fiscalYear), status: status.trimmedNonEmpty, sourceURL: sourceURL.trimmedNonEmpty, notes: notes.trimmedNonEmpty)
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.postTable(table: "seed_funding", body: payload)
                self.program = ""; programShort = ""; amount = ""; fiscalYear = ""; status = ""; sourceURL = ""; notes = ""; showingAdd = false
                onChanged()
            } catch { self.error = error.localizedDescription }
            busy = false
        }
    }

    private func remove(_ id: String) {
        pendingDeleteID = nil; error = nil
        Task { do { try await AMDOSRESTClient.shared.deleteTable(table: "seed_funding", filters: ["id": "eq.\(id)"]); onChanged() } catch { self.error = error.localizedDescription } }
    }
}

private struct AMDOSParitySeedContactSection: View {
    let seedID: String
    let rows: [AMDOSParitySeedContact]
    let members: [AMDOSParityMember]
    let onChanged: () -> Void
    @State private var showingAdd = false
    @State private var contactedOn = String(ISO8601DateFormatter().string(from: .now).prefix(10))
    @State private var method = ""
    @State private var memberID = ""
    @State private var note = ""
    @State private var nextAction = ""
    @State private var busy = false
    @State private var error: String?
    @State private var pendingDeleteID: String?

    var body: some View {
        AMDOSSectionCard("接触履歴 (\(rows.count))", systemImage: "person.2.wave.2") {
            HStack { Spacer(); Button(showingAdd ? "閉じる" : "+ 追加") { showingAdd.toggle() }.buttonStyle(.bordered) }
            if showingAdd {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        AMDOSTextField(title: "接触日 YYYY-MM-DD *", text: $contactedOn)
                        Picker("方法", selection: $method) {
                            Text("—").tag("")
                            ForEach(["email", "phone", "meeting", "event", "referral", "visit", "other"], id: \.self) { Text(amdOSParitySeedContactMethodLabel($0)).tag($0) }
                        }
                        Picker("担当", selection: $memberID) {
                            Text("—").tag("")
                            ForEach(members) { Text($0.codeName).tag($0.id) }
                        }
                    }
                    AMDOSTextField(title: "内容 *", text: $note, axis: .vertical)
                    AMDOSTextField(title: "次の一手", text: $nextAction)
                    Button(busy ? "追加中…" : "追加") { add() }.buttonStyle(.borderedProminent).disabled(busy || contactedOn.trimmedNonEmpty == nil || note.trimmedNonEmpty == nil)
                }
                .padding(12).background(AMDOSDesign.panel.opacity(0.55), in: RoundedRectangle(cornerRadius: 10))
            }
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
            if rows.isEmpty { Text("なし").foregroundStyle(AMDOSDesign.muted) }
            ForEach(rows) { row in
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(row.note).font(.subheadline)
                        Text(contactMetadata(row))
                            .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        if let action = row.nextAction { Text("→ \(action)").font(.caption).foregroundStyle(AMDOSDesign.success) }
                    }
                    Spacer()
                    Button("削除", role: .destructive) { pendingDeleteID = row.id }.buttonStyle(.borderless)
                }
                Divider()
            }
        }
        .confirmationDialog("接触履歴を削除する？", isPresented: Binding(get: { pendingDeleteID != nil }, set: { if !$0 { pendingDeleteID = nil } })) {
            Button("削除", role: .destructive) { if let id = pendingDeleteID { remove(id) } }
            Button("キャンセル", role: .cancel) { pendingDeleteID = nil }
        }
    }

    private func add() {
        guard let contactedOn = contactedOn.trimmedNonEmpty, let note = note.trimmedNonEmpty else { return }
        busy = true; error = nil
        let payload = AMDOSParitySeedContactCreate(seedID: seedID, contactedOn: contactedOn, method: method.trimmedNonEmpty, memberID: memberID.trimmedNonEmpty, note: note, nextAction: nextAction.trimmedNonEmpty)
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.postTable(table: "seed_contact_log", body: payload)
                self.contactedOn = String(ISO8601DateFormatter().string(from: .now).prefix(10)); method = ""; memberID = ""; self.note = ""; nextAction = ""; showingAdd = false
                onChanged()
            } catch { self.error = error.localizedDescription }
            busy = false
        }
    }

    private func contactMetadata(_ row: AMDOSParitySeedContact) -> String {
        let method = row.method.map(amdOSParitySeedContactMethodLabel)
        let member = row.memberID.flatMap { id in members.first(where: { $0.id == id })?.codeName }
        return [row.contactedOn, method, member].compactMap { $0 }.joined(separator: " / ")
    }

    private func remove(_ id: String) {
        pendingDeleteID = nil; error = nil
        Task { do { try await AMDOSRESTClient.shared.deleteTable(table: "seed_contact_log", filters: ["id": "eq.\(id)"]); onChanged() } catch { self.error = error.localizedDescription } }
    }
}

private struct AMDOSParitySeedNewsSection: View {
    let seedID: String
    let rows: [AMDOSParitySeedNews]
    let onChanged: () -> Void
    @State private var showingAdd = false
    @State private var kind = "publication"
    @State private var occurredOn = ""
    @State private var sourceURL = ""
    @State private var title = ""
    @State private var bodyText = ""
    @State private var busy = false
    @State private var error: String?
    @State private var pendingDeleteID: String?

    var body: some View {
        AMDOSSectionCard("ニュース・論文・プレス (\(rows.count))", systemImage: "newspaper") {
            HStack { Spacer(); Button(showingAdd ? "閉じる" : "+ 追加") { showingAdd.toggle() }.buttonStyle(.bordered) }
            if showingAdd {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Picker("種別", selection: $kind) {
                            ForEach(["publication", "press", "grant", "patent", "event", "other"], id: \.self) { Text(amdOSParitySeedNewsKindLabel($0)).tag($0) }
                        }
                        AMDOSTextField(title: "日付 YYYY-MM-DD", text: $occurredOn)
                        AMDOSTextField(title: "URL", text: $sourceURL)
                    }
                    AMDOSTextField(title: "タイトル *", text: $title)
                    AMDOSTextField(title: "要約 / 本文", text: $bodyText, axis: .vertical)
                    Button(busy ? "追加中…" : "追加") { add() }.buttonStyle(.borderedProminent).disabled(busy || title.trimmedNonEmpty == nil)
                }
                .padding(12).background(AMDOSDesign.panel.opacity(0.55), in: RoundedRectangle(cornerRadius: 10))
            }
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
            if rows.isEmpty { Text("なし").foregroundStyle(AMDOSDesign.muted) }
            ForEach(rows) { row in
                HStack(alignment: .top, spacing: 10) {
                    AMDOSStatusBadge(text: amdOSParitySeedNewsKindLabel(row.kind))
                    VStack(alignment: .leading, spacing: 3) {
                        if let text = row.sourceURL, let url = URL(string: text) { Link(row.title, destination: url).font(.subheadline.weight(.semibold)) }
                        else { Text(row.title).font(.subheadline.weight(.semibold)) }
                        Text(row.occurredOn ?? "—").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        if let body = row.body { Text(body).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    }
                    Spacer()
                    Button("削除", role: .destructive) { pendingDeleteID = row.id }.buttonStyle(.borderless)
                }
                Divider()
            }
        }
        .confirmationDialog("ニュースを削除する？", isPresented: Binding(get: { pendingDeleteID != nil }, set: { if !$0 { pendingDeleteID = nil } })) {
            Button("削除", role: .destructive) { if let id = pendingDeleteID { remove(id) } }
            Button("キャンセル", role: .cancel) { pendingDeleteID = nil }
        }
    }

    private func add() {
        guard let title = title.trimmedNonEmpty else { return }
        busy = true; error = nil
        let payload = AMDOSParitySeedNewsCreate(seedID: seedID, kind: kind, title: title, body: bodyText.trimmedNonEmpty, occurredOn: occurredOn.trimmedNonEmpty, sourceURL: sourceURL.trimmedNonEmpty, ingestedBy: "manual", verified: true, dismissed: false)
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.postTable(table: "seed_news", body: payload)
                kind = "publication"; occurredOn = ""; sourceURL = ""; self.title = ""; bodyText = ""; showingAdd = false
                onChanged()
            } catch { self.error = error.localizedDescription }
            busy = false
        }
    }

    private func remove(_ id: String) {
        pendingDeleteID = nil; error = nil
        Task { do { try await AMDOSRESTClient.shared.deleteTable(table: "seed_news", filters: ["id": "eq.\(id)"]); onChanged() } catch { self.error = error.localizedDescription } }
    }
}

struct AMDOSParitySeedInboxView: View {
    let onSelectSeed: (String) -> Void
    @StateObject private var store = AMDOSSeedParityStore()
    @State private var filter = "all"
    @State private var busyIDs: Set<String> = []
    private let domains = ["gx_circular", "gx_energy", "life", "materials", "robo"]
    private var allDiscovered: [AMDOSParitySeed] {
        store.seeds.filter { $0.discoveryStatus == "discovered" }.sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
    }
    private var discovered: [AMDOSParitySeed] { allDiscovered.filter { filter == "all" || $0.domainLane == filter } }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "SEED INBOX", title: "Seeds 受信箱", subtitle: "自動収集routeで見つけた候補。Verifyで採用、Dismissでノイズ扱いにする。LLM/web_searchの自動scheduleは現在停止中。") {
            HStack(spacing: 8) {
                if filter == "all" { Button("全領域  \(allDiscovered.count)") { filter = "all" }.buttonStyle(.borderedProminent) }
                else { Button("全領域  \(allDiscovered.count)") { filter = "all" }.buttonStyle(.bordered) }
                ForEach(domains, id: \.self) { domain in
                    if filter == domain {
                        Button("\(amdOSParitySeedDomainLabel(domain))  \(allDiscovered.filter { $0.domainLane == domain }.count)") { filter = domain }.buttonStyle(.borderedProminent)
                    } else {
                        Button("\(amdOSParitySeedDomainLabel(domain))  \(allDiscovered.filter { $0.domainLane == domain }.count)") { filter = domain }.buttonStyle(.bordered)
                    }
                }
            }
            AMDOSStateNotice(state: store.state) { Task { await store.loadInbox() } }
            if let message = store.message { Text(message).font(.caption).foregroundStyle(.red) }
            ForEach(discovered) { seed in
                AMDOSCard {
                    HStack(alignment: .top, spacing: 18) {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 8) {
                                AMDOSStatusBadge(text: "🆕 新規発見", tint: AMDOSDesign.blue)
                                if let domain = seed.domainLane { AMDOSStatusBadge(text: amdOSParitySeedDomainLabel(domain)) }
                                Text(seed.source == "web_search" ? "🤖 cron" : "✋ 手動").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                                Text(String(seed.createdAt?.prefix(10) ?? "")).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            }
                            Button(seed.title) { onSelectSeed(seed.id) }.buttonStyle(.plain).font(.headline)
                            Text("\(seed.orgName)\(seed.orgType.map { " (\(amdOSParitySeedOrgTypeLabel($0)))" } ?? "")\(seed.researcherName.map { " / \($0)" } ?? "")\(seed.researcherTitle.map { " \($0)" } ?? "")\(seed.labName.map { " / \($0)" } ?? "")")
                                .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        Text(seed.summary ?? "概要なし").lineLimit(3)
                            let programs = fundingPrograms(for: seed)
                            if !programs.isEmpty {
                                Text(fundingProgramText(programs))
                                    .font(.caption2).foregroundStyle(AMDOSDesign.success)
                            }
                            if let detail = seed.sourceDetail { Text("出典: \(detail)").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                            if let rating = seed.amdRating {
                                Text(String(repeating: "★", count: rating) + String(repeating: "☆", count: max(0, 5 - rating)) + (seed.amdRatingNote.map { "  \($0)" } ?? ""))
                                    .font(.caption).foregroundStyle(.orange)
                            }
                            if let next = seed.nextAction { Text("→ \(next)").font(.caption).foregroundStyle(AMDOSDesign.success) }
                        }
                        Spacer()
                        VStack(spacing: 8) {
                            Button("✓ Verify") { update(seed.id, status: "reviewed") }.buttonStyle(.borderedProminent).disabled(busyIDs.contains(seed.id))
                            Button("✕ Dismiss") { update(seed.id, status: "dismissed") }.buttonStyle(.bordered).disabled(busyIDs.contains(seed.id))
                        }
                    }
                }
            }
            if discovered.isEmpty && (store.state == .loaded || store.state == .empty) {
                ContentUnavailableView("未確認シーズなし", systemImage: "checkmark.circle", description: Text("次の cron は月曜 09:00 JST。"))
            }
        }.task { await store.loadInbox() }
    }

    private func fundingPrograms(for seed: AMDOSParitySeed) -> [(program: String, year: Int?)] {
        var seen = Set<String>()
        return store.funding.filter { $0.seedID == seed.id }.sorted { ($0.fiscalYear ?? -1) > ($1.fiscalYear ?? -1) }.compactMap { row in
            guard let program = row.programShort?.trimmedNonEmpty, seen.insert(program).inserted else { return nil }
            return (program, row.fiscalYear)
        }
    }

    private func fundingProgramText(_ programs: [(program: String, year: Int?)]) -> String {
        programs.map { item in
            guard let year = item.year else { return item.program }
            return "\(item.program) '\(String(year).suffix(2))"
        }.joined(separator: " · ")
    }

    private func update(_ id: String, status: String) {
        busyIDs.insert(id)
        Task { await store.updateDiscoveryStatus(id, status); busyIDs.remove(id) }
    }
}

private struct AMDOSParitySeedEditor: View {
    let seed: AMDOSParitySeed?
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var lookupStore = AMDOSSeedParityStore()
    @State private var title: String
    @State private var summary: String
    @State private var orgName: String
    @State private var orgType: String
    @State private var orgRegion: String
    @State private var orgURL: String
    @State private var researcherName: String
    @State private var researcherTitle: String
    @State private var labName: String
    @State private var researcherURL: String
    @State private var domainLane: String
    @State private var industryTarget: String
    @State private var keywords: String
    @State private var trl: String
    @State private var brl: String
    @State private var hrl: String
    @State private var status: String
    @State private var amdRating: String
    @State private var amdRatingNote: String
    @State private var ownerMemberID: String
    @State private var nextAction: String
    @State private var internalNotes: String
    @State private var publicSummary: String
    @State private var isPublic: Bool
    @State private var source: String
    @State private var sourceDetail: String
    @State private var deepDiveMaterialURL: String
    @State private var spunOffProjectID: String
    @State private var saving = false
    @State private var error: String?

    init(seed: AMDOSParitySeed?, onSaved: @escaping () -> Void) {
        self.seed = seed
        self.onSaved = onSaved
        _title = State(initialValue: seed?.title ?? "")
        _summary = State(initialValue: seed?.summary ?? "")
        _orgName = State(initialValue: seed?.orgName ?? "")
        _orgType = State(initialValue: seed?.orgType ?? "")
        _orgRegion = State(initialValue: seed?.orgRegion ?? "")
        _orgURL = State(initialValue: seed?.orgURL ?? "")
        _researcherName = State(initialValue: seed?.researcherName ?? "")
        _researcherTitle = State(initialValue: seed?.researcherTitle ?? "")
        _labName = State(initialValue: seed?.labName ?? "")
        _researcherURL = State(initialValue: seed?.researcherURL ?? "")
        _domainLane = State(initialValue: seed?.domainLane ?? "")
        _industryTarget = State(initialValue: (seed?.industryTarget ?? []).joined(separator: ", "))
        _keywords = State(initialValue: (seed?.keywords ?? []).joined(separator: ", "))
        _trl = State(initialValue: seed?.trl.map(String.init) ?? "")
        _brl = State(initialValue: seed?.brl.map(String.init) ?? "")
        _hrl = State(initialValue: seed?.hrl.map(String.init) ?? "")
        _status = State(initialValue: seed?.status ?? "candidate")
        _amdRating = State(initialValue: seed?.amdRating.map(String.init) ?? "")
        _amdRatingNote = State(initialValue: seed?.amdRatingNote ?? "")
        _ownerMemberID = State(initialValue: seed?.amdOwnerMemberID ?? "")
        _nextAction = State(initialValue: seed?.nextAction ?? "")
        _internalNotes = State(initialValue: seed?.internalNotes ?? "")
        _publicSummary = State(initialValue: seed?.publicSummary ?? "")
        _isPublic = State(initialValue: seed?.isPublic ?? false)
        _source = State(initialValue: seed?.source ?? "")
        _sourceDetail = State(initialValue: seed?.sourceDetail ?? "")
        _deepDiveMaterialURL = State(initialValue: seed?.deepDiveMaterialURL ?? "")
        _spunOffProjectID = State(initialValue: seed?.spunOffProjectID ?? "")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack { Text(seed == nil ? "新規シーズ" : "シーズ編集").font(.title2.bold()); Spacer(); Button("閉じる") { dismiss() } }
            ScrollView {
                Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 12) {
                    GridRow { AMDOSTextField(title: "シーズ名 *", text: $title); AMDOSTextField(title: "機関名 *", text: $orgName) }
                    GridRow { AMDOSTextField(title: "概要", text: $summary, axis: .vertical); AMDOSTextField(title: "地域", text: $orgRegion) }
                    GridRow { AMDOSTextField(title: "PI", text: $researcherName); AMDOSTextField(title: "役職", text: $researcherTitle); AMDOSTextField(title: "研究室", text: $labName) }
                    GridRow {
                        VStack(alignment: .leading) { Text("領域").font(.caption).foregroundStyle(AMDOSDesign.muted); Picker("領域", selection: $domainLane) { Text("—").tag(""); ForEach(["gx_energy", "gx_circular", "life", "materials", "robo", "ict", "other"], id: \.self) { Text(amdOSParitySeedDomainLabel($0)).tag($0) } }.labelsHidden() }
                        VStack(alignment: .leading) { Text("機関種別").font(.caption).foregroundStyle(AMDOSDesign.muted); Picker("機関種別", selection: $orgType) { Text("—").tag(""); ForEach(["university", "national_lab", "kosen", "private_lab", "other"], id: \.self) { Text(amdOSParitySeedOrgTypeLabel($0)).tag($0) } }.labelsHidden() }
                    }
                    GridRow { AMDOSTextField(title: "応用先（カンマ区切り）", text: $industryTarget); AMDOSTextField(title: "キーワード（カンマ区切り）", text: $keywords) }
                    GridRow { AMDOSTextField(title: "TRL", text: $trl); AMDOSTextField(title: "BRL", text: $brl); AMDOSTextField(title: "HRL", text: $hrl) }
                    GridRow {
                        VStack(alignment: .leading) { Text("状態").font(.caption).foregroundStyle(AMDOSDesign.muted); Picker("状態", selection: $status) { ForEach(["candidate", "investigating", "contacted", "discussing", "spun_off", "declined"], id: \.self) { Text(amdOSParitySeedStatusLabel($0)).tag($0) } }.labelsHidden() }
                        VStack(alignment: .leading) { Text("AMD評価").font(.caption).foregroundStyle(AMDOSDesign.muted); Picker("AMD評価", selection: $amdRating) { Text("—").tag(""); ForEach(1...5, id: \.self) { Text(String(repeating: "★", count: $0)).tag(String($0)) } }.labelsHidden() }
                        VStack(alignment: .leading) { Text("担当").font(.caption).foregroundStyle(AMDOSDesign.muted); Picker("担当", selection: $ownerMemberID) { Text("—").tag(""); ForEach(lookupStore.members) { Text($0.codeName).tag($0.id) } }.labelsHidden() }
                    }
                    GridRow { AMDOSTextField(title: "評価コメント", text: $amdRatingNote); AMDOSTextField(title: "次の一手", text: $nextAction) }
                    GridRow { AMDOSTextField(title: "社内メモ", text: $internalNotes, axis: .vertical); AMDOSTextField(title: "公開要約", text: $publicSummary, axis: .vertical) }
                    GridRow { AMDOSTextField(title: "機関URL", text: $orgURL); AMDOSTextField(title: "研究者URL", text: $researcherURL) }
                    GridRow {
                        VStack(alignment: .leading) { Text("発見経路").font(.caption).foregroundStyle(AMDOSDesign.muted); Picker("発見経路", selection: $source) { Text("—").tag(""); ForEach(["introduction", "web_search", "conference", "referral", "cold", "grant_db", "researchmap", "other"], id: \.self) { Text(amdOSParitySeedSourceLabel($0)).tag($0) } }.labelsHidden() }
                        VStack(alignment: .leading) { Text("スピンアウト先（旧互換）").font(.caption).foregroundStyle(AMDOSDesign.muted); Picker("スピンアウト先", selection: $spunOffProjectID) { Text("—").tag(""); ForEach(lookupStore.projectVentures) { venture in Text(venture.shortLabel ?? lookupStore.projects.first(where: { $0.id == venture.id })?.name ?? venture.id).tag(venture.id) } }.labelsHidden() }
                    }
                    GridRow { AMDOSTextField(title: "経路詳細", text: $sourceDetail); AMDOSTextField(title: "深掘り資料URL", text: $deepDiveMaterialURL) }
                    Toggle("公開可（URA / EIR に開放可）", isOn: $isPublic)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 12)
            }
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
            HStack { Spacer(); Button(saving ? "保存中…" : "保存") { save() }.buttonStyle(.borderedProminent).disabled(saving || title.trimmedNonEmpty == nil || orgName.trimmedNonEmpty == nil) }
        }
        .padding(24)
        .frame(minWidth: 760, minHeight: 620)
        .task { await lookupStore.loadLookups() }
    }

    private func list(_ value: String) -> [String]? { let result = value.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }; return result.isEmpty ? nil : result }
    private func int(_ value: String) -> Int? { Int(value.trimmingCharacters(in: .whitespacesAndNewlines)) }
    private func save() {
        guard let title = title.trimmedNonEmpty, let orgName = orgName.trimmedNonEmpty else { error = "シーズ名と機関名を入力してね"; return }
        for value in [trl, brl, hrl] { if let number = int(value), !(0...9).contains(number) { error = "TRL / BRL / HRL は0〜9で入力してね"; return } }
        if let rating = int(amdRating), !(1...5).contains(rating) { error = "AMD評価は1〜5で入力してね"; return }
        saving = true; error = nil
        let payload = AMDOSParitySeedPayload(title: title, summary: summary.trimmedNonEmpty, orgName: orgName, orgType: orgType.trimmedNonEmpty, orgRegion: orgRegion.trimmedNonEmpty, orgURL: orgURL.trimmedNonEmpty, researcherName: researcherName.trimmedNonEmpty, researcherTitle: researcherTitle.trimmedNonEmpty, labName: labName.trimmedNonEmpty, researcherURL: researcherURL.trimmedNonEmpty, domainLane: domainLane.trimmedNonEmpty, industryTarget: list(industryTarget), keywords: list(keywords), trl: int(trl), brl: int(brl), hrl: int(hrl), status: status, amdRating: int(amdRating), amdRatingNote: amdRatingNote.trimmedNonEmpty, amdOwnerMemberID: ownerMemberID.trimmedNonEmpty, nextAction: nextAction.trimmedNonEmpty, internalNotes: internalNotes.trimmedNonEmpty, publicSummary: publicSummary.trimmedNonEmpty, isPublic: isPublic, spunOffProjectID: spunOffProjectID.trimmedNonEmpty, source: source.trimmedNonEmpty, sourceDetail: sourceDetail.trimmedNonEmpty, deepDiveMaterialURL: deepDiveMaterialURL.trimmedNonEmpty, discoveryStatus: seed?.discoveryStatus ?? "reviewed", updatedAt: ISO8601DateFormatter().string(from: .now))
        Task {
            do {
                if let id = seed?.id { _ = try await AMDOSRESTClient.shared.patchTable(table: "seeds", filters: ["id": "eq.\(id)"], body: payload) }
                else { _ = try await AMDOSRESTClient.shared.postTable(table: "seeds", body: payload) }
                onSaved(); dismiss()
            } catch let saveError { error = saveError.localizedDescription; saving = false }
        }
    }
}

private struct AMDOSParityPocCompany: Codable, Identifiable, Sendable {
    let id: String; let companyName: String; let companySize: String?; let industryTags: [String]; let region: String?; let pocProfile: String?; let pocHistoryNote: String?; let incentiveNote: String?; let sourceKind: String?; let sourceRef: String?; let ownerMemberID: String?; let status: String; let nextAction: String?
    enum CodingKeys: String, CodingKey { case id, companyName = "company_name", companySize = "company_size", industryTags = "industry_tags", region, pocProfile = "poc_profile", pocHistoryNote = "poc_history_note", incentiveNote = "incentive_note", sourceKind = "source_kind", sourceRef = "source_ref", ownerMemberID = "owner_member_id", status, nextAction = "next_action" }
}
private struct AMDOSParityPocMatch: Codable, Identifiable, Sendable {
    let id: String; let seedID: String?; let companyID: String?; let projectID: String?; let matchTitle: String; let fitHypothesis: String?; let hearingQuestions: [String]; let pocGoal: String?; let rewardPlan: String?; let contractPlan: String?; let fundingPlan: String?; let revenueShareNote: String?; let status: String; let priority: String; let ownerMemberID: String?; let nextAction: String?; let sourceNote: String?
    enum CodingKeys: String, CodingKey { case id, seedID = "seed_id", companyID = "company_id", projectID = "project_id", matchTitle = "match_title", fitHypothesis = "fit_hypothesis", hearingQuestions = "hearing_questions", pocGoal = "poc_goal", rewardPlan = "reward_plan", contractPlan = "contract_plan", fundingPlan = "funding_plan", revenueShareNote = "revenue_share_note", status, priority, ownerMemberID = "owner_member_id", nextAction = "next_action", sourceNote = "source_note" }
}
private struct AMDOSParityPocSeed: Codable, Identifiable, Sendable { let id: String; let title: String; let summary: String?; let orgName: String; let industryTarget: [String]?; let keywords: [String]?; let status: String; let amdRating: Int?; let nextAction: String?; enum CodingKeys: String, CodingKey { case id, title, summary, orgName = "org_name", industryTarget = "industry_target", keywords, status, amdRating = "amd_rating", nextAction = "next_action" } }
private struct AMDOSParityPocProject: Codable, Identifiable, Sendable { let id: String; let name: String; let status: String; enum CodingKeys: String, CodingKey { case id = "project_id", name = "project_name", status } }
private struct AMDOSParityPocMember: Codable, Identifiable, Sendable { let id: String; let codeName: String; enum CodingKeys: String, CodingKey { case id = "member_id", codeName = "code_name" } }
private struct AMDOSParityPocCompanyPayload: Encodable, Sendable { let companyName: String; let companySize: String?; let industryTags: [String]; let region: String?; let pocProfile: String?; let pocHistoryNote: String?; let incentiveNote: String?; let ownerMemberID: String?; let status: String; let nextAction: String?; enum CodingKeys: String, CodingKey { case companyName = "company_name", companySize = "company_size", industryTags = "industry_tags", region, pocProfile = "poc_profile", pocHistoryNote = "poc_history_note", incentiveNote = "incentive_note", ownerMemberID = "owner_member_id", status, nextAction = "next_action" } }
private struct AMDOSParityPocSeedPayload: Encodable, Sendable { let title: String; let summary: String?; let orgName: String; let status: String; let discoveryStatus: String; enum CodingKeys: String, CodingKey { case title, summary, orgName = "org_name", status, discoveryStatus = "discovery_status" } }
private struct AMDOSParityPocMatchPayload: Encodable, Sendable { let seedID: String; let companyID: String; let matchTitle: String; let fitHypothesis: String; let hearingQuestions: [String]; let pocGoal: String; let status: String; let priority: String; let nextAction: String?; enum CodingKeys: String, CodingKey { case seedID = "seed_id", companyID = "company_id", matchTitle = "match_title", fitHypothesis = "fit_hypothesis", hearingQuestions = "hearing_questions", pocGoal = "poc_goal", status, priority, nextAction = "next_action" } }
private struct AMDOSParityPocStatusPatch: Encodable, Sendable { let status: String }

@MainActor
private final class AMDOSPocParityStore: ObservableObject {
    @Published var companies: [AMDOSParityPocCompany] = []
    @Published var matches: [AMDOSParityPocMatch] = []
    @Published var seeds: [AMDOSParityPocSeed] = []
    @Published var projects: [AMDOSParityPocProject] = []
    @Published var members: [AMDOSParityPocMember] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?
    func load() async {
        state = .loading; message = nil
        do {
            async let c = AMDOSRESTClient.shared.fetchTable(AMDOSParityPocCompany.self, table: "poc_companies", select: "*", order: "updated_at.desc", limit: 500)
            async let m = AMDOSRESTClient.shared.fetchTable(AMDOSParityPocMatch.self, table: "poc_matches", select: "*", order: "updated_at.desc", limit: 1000)
            async let s = AMDOSRESTClient.shared.fetchTable(AMDOSParityPocSeed.self, table: "seeds", select: "id,title,summary,org_name,industry_target,keywords,status,amd_rating,next_action", order: "updated_at.desc", limit: 500)
            async let p = AMDOSRESTClient.shared.fetchTable(AMDOSParityPocProject.self, table: "projects", select: "project_id,project_name,status", order: "project_name", limit: 500)
            async let mm = AMDOSRESTClient.shared.fetchTable(AMDOSParityPocMember.self, table: "members", select: "member_id,code_name", order: "code_name", limit: 500)
            companies = try await c; matches = try await m; seeds = try await s; projects = try await p; members = try await mm
            state = companies.isEmpty && matches.isEmpty && seeds.isEmpty ? .empty : .loaded
        } catch { message = error.localizedDescription; state = .failed(message ?? "PoCデータを取得できなかった") }
    }
    func updateCompany(_ id: String, status: String) async { do { _ = try await AMDOSRESTClient.shared.patchTable(table: "poc_companies", filters: ["id": "eq.\(id)"], body: AMDOSParityPocStatusPatch(status: status)); await load() } catch { message = error.localizedDescription } }
    func updateMatch(_ id: String, status: String) async { do { _ = try await AMDOSRESTClient.shared.patchTable(table: "poc_matches", filters: ["id": "eq.\(id)"], body: AMDOSParityPocStatusPatch(status: status)); await load() } catch { message = error.localizedDescription } }
}

struct AMDOSParityPoCView: View {
    @StateObject private var store = AMDOSPocParityStore()
    @State private var search = ""
    @State private var companyName = ""
    @State private var companySize = ""
    @State private var companyTags = ""
    @State private var companyRegion = ""
    @State private var companyProfile = ""
    @State private var seedTitle = ""
    @State private var seedSummary = ""
    @State private var seedOrg = ""
    @State private var selectedCompanyStatus = "candidate"
    @State private var selectedSeedStatus = "candidate"
    @State private var error: String?

    private var filteredCompanies: [AMDOSParityPocCompany] { store.companies.filter { search.isEmpty || [$0.companyName, $0.region, $0.pocProfile, $0.industryTags.joined(separator: " ")].compactMap { $0 }.joined(separator: " ").localizedCaseInsensitiveContains(search) } }
    private var filteredMatches: [AMDOSParityPocMatch] { store.matches.filter { search.isEmpty || [$0.matchTitle, $0.fitHypothesis, $0.pocGoal, $0.nextAction].compactMap { $0 }.joined(separator: " ").localizedCaseInsensitiveContains(search) } }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "POC", title: "PoC候補", subtitle: "PWAのPoC Hubと同じ研究シーズ × PoC先の組み合わせ、ヒアリング、PoC設計、案件化ステータスを操作する") {
            HStack { AMDOSMetricTile(label: "アクティブシーズ", value: "\(store.seeds.filter { $0.status != "declined" }.count)", detail: "研究シーズ"); AMDOSMetricTile(label: "PoC先", value: "\(store.companies.filter { $0.status != "archived" }.count)", detail: "現場候補", tint: AMDOSDesign.success); AMDOSMetricTile(label: "案件候補", value: "\(store.matches.filter { $0.status != "deal" && $0.status != "archived" }.count)", detail: "接続中", tint: AMDOSDesign.warning) }
            HStack { TextField("シーズ / PoC先 / 仮説で検索", text: $search).textFieldStyle(.roundedBorder); Spacer(); Button("再読み込み") { Task { await store.load() } } }
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            AMDOSSectionCard("新規登録", systemImage: "plus.circle") {
                Grid(alignment: .leading, horizontalSpacing: 14, verticalSpacing: 10) {
                    GridRow { AMDOSTextField(title: "PoC先会社名 *", text: $companyName); AMDOSTextField(title: "規模", text: $companySize); AMDOSTextField(title: "地域", text: $companyRegion) }
                    GridRow { AMDOSTextField(title: "業界タグ（カンマ区切り）", text: $companyTags); AMDOSTextField(title: "PoCプロフィール", text: $companyProfile, axis: .vertical) }
                    GridRow { AMDOSTextField(title: "研究シーズ名 *", text: $seedTitle); AMDOSTextField(title: "機関名 *", text: $seedOrg); AMDOSTextField(title: "シーズ概要", text: $seedSummary, axis: .vertical) }
                }
                HStack { Button("PoC先を登録") { createCompany() }.buttonStyle(.borderedProminent); Button("シーズを登録") { createSeed() }.buttonStyle(.bordered) }
            }
            AMDOSSectionCard("シーズ × PoC先の組み合わせ", systemImage: "arrow.triangle.2.circlepath") {
                ForEach(pairingRows, id: \.key) { row in
                    HStack(alignment: .top) {
                        VStack(alignment: .leading) { Text(row.seed.title).font(.headline); Text("× \(row.company.companyName)").font(.subheadline); Text(row.overlap.isEmpty ? "用途・業界の重なりをヒアリングで確認" : "重なるタグ: \(row.overlap.joined(separator: ", "))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        Spacer(); Button("候補を作成") { createMatch(seed: row.seed, company: row.company) }.buttonStyle(.bordered)
                    }
                }
                if pairingRows.isEmpty { Text("アクティブなシーズとPoC先がそろうと、重なりのある候補がここに出るよ。").foregroundStyle(AMDOSDesign.muted) }
            }
            AMDOSSectionCard("案件候補", systemImage: "list.bullet.clipboard") {
                ForEach(filteredMatches) { match in
                    AMDOSCard {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Text(match.matchTitle).font(.headline); Spacer(); Picker("状態", selection: Binding(get: { match.status }, set: { value in Task { await store.updateMatch(match.id, status: value) } })) { ForEach(["candidate", "hearing_design", "introduced", "hearing_done", "poc_design", "poc_running", "deal", "archived"], id: \.self) { Text($0).tag($0) } }.frame(width: 150) }
                            Text([match.fitHypothesis, match.pocGoal].compactMap { $0 }.joined(separator: "\n")).font(.caption)
                            if !match.hearingQuestions.isEmpty { Text("質問: \(match.hearingQuestions.joined(separator: " / "))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                            Text([match.nextAction, match.priority].compactMap { $0 }.joined(separator: " · ")).font(.caption2).foregroundStyle(AMDOSDesign.success)
                        }
                    }
                }
            }
            AMDOSSectionCard("PoC先", systemImage: "building.2") {
                ForEach(filteredCompanies) { company in
                    AMDOSCard {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Text(company.companyName).font(.headline); Spacer(); Picker("状態", selection: Binding(get: { company.status }, set: { value in Task { await store.updateCompany(company.id, status: value) } })) { ForEach(["candidate", "listed", "contacted", "hearing", "poc_ready", "archived"], id: \.self) { Text($0).tag($0) } }.frame(width: 140) }
                            Text([company.companySize, company.region, company.industryTags.joined(separator: ", ")].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                            Text(company.pocProfile ?? "PoCプロフィール未登録").font(.caption)
                        }
                    }
                }
            }
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
        }.task { await store.load() }
    }

    private var pairingRows: [(key: String, seed: AMDOSParityPocSeed, company: AMDOSParityPocCompany, overlap: [String])] {
        let activeSeeds = store.seeds.filter { $0.status != "declined" }.prefix(80)
        let activeCompanies = store.companies.filter { $0.status != "archived" }.prefix(80)
        return activeSeeds.flatMap { seed in activeCompanies.compactMap { company in
            if store.matches.contains(where: { $0.seedID == seed.id && $0.companyID == company.id }) { return nil }
            let seedTags = (seed.industryTarget ?? []) + (seed.keywords ?? [])
            let overlap = company.industryTags.filter { tag in seedTags.contains { normalize($0) == normalize(tag) || normalize($0).contains(normalize(tag)) || normalize(tag).contains(normalize($0)) } }
            if overlap.isEmpty && !search.isEmpty { return nil }
            return ("\(seed.id)-\(company.id)", seed, company, overlap)
        } }.prefix(20).map { $0 }
    }
    private func normalize(_ value: String) -> String { value.lowercased().replacingOccurrences(of: " ", with: "") }
    private func list(_ value: String) -> [String] { value.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty } }
    private func createCompany() {
        guard let name = companyName.trimmedNonEmpty else { error = "PoC先会社名を入力してね"; return }
        Task { do { _ = try await AMDOSRESTClient.shared.postTable(table: "poc_companies", body: AMDOSParityPocCompanyPayload(companyName: name, companySize: companySize.trimmedNonEmpty, industryTags: list(companyTags), region: companyRegion.trimmedNonEmpty, pocProfile: companyProfile.trimmedNonEmpty, pocHistoryNote: nil, incentiveNote: nil, ownerMemberID: nil, status: selectedCompanyStatus, nextAction: nil)); companyName = ""; await store.load() } catch let saveError { error = saveError.localizedDescription } }
    }
    private func createSeed() {
        guard let title = seedTitle.trimmedNonEmpty, let org = seedOrg.trimmedNonEmpty else { error = "シーズ名と機関名を入力してね"; return }
        Task { do { _ = try await AMDOSRESTClient.shared.postTable(table: "seeds", body: AMDOSParityPocSeedPayload(title: title, summary: seedSummary.trimmedNonEmpty, orgName: org, status: selectedSeedStatus, discoveryStatus: "reviewed")); seedTitle = ""; await store.load() } catch let saveError { error = saveError.localizedDescription } }
    }
    private func createMatch(seed: AMDOSParityPocSeed, company: AMDOSParityPocCompany) {
        let tags = company.industryTags.prefix(3).joined(separator: " / ")
        Task { do { _ = try await AMDOSRESTClient.shared.postTable(table: "poc_matches", body: AMDOSParityPocMatchPayload(seedID: seed.id, companyID: company.id, matchTitle: "\(seed.title) × \(company.companyName)", fitHypothesis: "\(seed.title)の用途仮説を\(company.companyName)の現場課題（\(tags.isEmpty ? "未設定" : tags)）へ当てられるかヒアリングで照合する。", hearingQuestions: ["現場の課題と導入条件は何か？", "PoCの成功指標と期間は何か？", "謝礼・契約・資金条件は何か？"], pocGoal: "仮説をヒアリングで検証する", status: "candidate", priority: "medium", nextAction: "初回ヒアリングを設定する")); await store.load() } catch let saveError { error = saveError.localizedDescription } }
    }
}

private struct AMDOSParityInstitution: Codable, Identifiable, Sendable { let id: String; let name: String; let shortName: String?; let type: String; let description: String?; let region: String?; let contractStatus: String?; let identityStatus: String?; enum CodingKeys: String, CodingKey { case id = "institution_id", name, shortName = "short_name", type, description, region, contractStatus = "contract_status", identityStatus = "identity_status" } }
private struct AMDOSParityInstitutionProject: Codable, Identifiable, Sendable {
    let projectID: String
    let institutionID: String
    let engagementScope: String?
    let targetUnit: String?
    let ecosystemGoal: String?
    let seedDiscoveryInScope: Bool
    var id: String { projectID }
    enum CodingKeys: String, CodingKey {
        case projectID = "project_id", institutionID = "institution_id"
        case engagementScope = "engagement_scope", targetUnit = "target_unit", ecosystemGoal = "ecosystem_goal"
        case seedDiscoveryInScope = "seed_discovery_in_scope"
    }
}
private struct AMDOSParityAxis: Codable, Identifiable, Sendable { let id: String; let axisNo: Int; let name: String; let correspondsXRL: String?; let weight: Double; let sortOrder: Int; enum CodingKeys: String, CodingKey { case id = "axis_id", axisNo = "axis_no", name, correspondsXRL = "corresponds_xrl", weight, sortOrder = "sort_order" } }
private struct AMDOSParityCriterion: Codable, Identifiable, Sendable { let id: String; let axisID: String; let code: String; let name: String; let rubric: [String: String]; let sortOrder: Int; enum CodingKeys: String, CodingKey { case id = "criterion_id", axisID = "axis_id", code, name, rubric, sortOrder = "sort_order" } }
private struct AMDOSParityAssessment: Codable, Identifiable, Sendable { let id: String; let institutionID: String; let criterionID: String; let level: Int?; let na: Bool; let note: String?; let evaluatedAt: String?; enum CodingKeys: String, CodingKey { case id = "assessment_id", institutionID = "institution_id", criterionID = "criterion_id", level, na, note, evaluatedAt = "evaluated_at" } }
private struct AMDOSParityPolicyItem: Codable, Identifiable, Sendable { let id: String; let category: String; let itemKind: String; let key: String; let label: String; let description: String?; let valueType: String; let sortOrder: Int; enum CodingKeys: String, CodingKey { case id = "policy_item_id", category, itemKind = "item_kind", key, label, description, valueType = "value_type", sortOrder = "sort_order" } }
private struct AMDOSParityPolicyAssessment: Codable, Identifiable, Sendable { let id: String; let institutionID: String; let policyItemID: String; let status: String; let attributeValue: String?; let evidenceNote: String?; let sourceType: String; let sourceURL: String?; let sourcePath: String?; let confirmedAt: String?; enum CodingKeys: String, CodingKey { case id = "assessment_id", institutionID = "institution_id", policyItemID = "policy_item_id", status, attributeValue = "attribute_value", evidenceNote = "evidence_note", sourceType = "source_type", sourceURL = "source_url", sourcePath = "source_path", confirmedAt = "confirmed_at" } }
private struct AMDOSParityInstitutionAssessmentPayload: Encodable, Sendable { let institutionID: String; let criterionID: String; let level: Int?; let na: Bool; let note: String?; enum CodingKeys: String, CodingKey { case institutionID = "institution_id", criterionID = "criterion_id", level, na, note } }
private struct AMDOSParityInstitutionPolicyPayload: Encodable, Sendable { let institutionID: String; let policyItemID: String; let status: String; let attributeValue: String?; let evidenceNote: String?; let sourceType: String; let sourceURL: String?; let sourcePath: String?; let confirmedAt: String?; enum CodingKeys: String, CodingKey { case institutionID = "institution_id", policyItemID = "policy_item_id", status, attributeValue = "attribute_value", evidenceNote = "evidence_note", sourceType = "source_type", sourceURL = "source_url", sourcePath = "source_path", confirmedAt = "confirmed_at" } }

private struct AMDOSParityInstitutionCell: Sendable { var level: Int?; var na: Bool; var note: String? }
private struct AMDOSParityPolicyCell: Sendable { var status: String; var attributeValue: String?; var evidenceNote: String?; var sourceType: String; var sourceURL: String?; var sourcePath: String?; var confirmedAt: String? }

@MainActor
private final class AMDOSInstitutionParityStore: ObservableObject {
    @Published var institutions: [AMDOSParityInstitution] = []
    @Published var axes: [AMDOSParityAxis] = []
    @Published var criteria: [AMDOSParityCriterion] = []
    @Published var assessments: [AMDOSParityAssessment] = []
    @Published var policyItems: [AMDOSParityPolicyItem] = []
    @Published var policyAssessments: [AMDOSParityPolicyAssessment] = []
    @Published var institutionProjects: [AMDOSParityInstitutionProject] = []
    @Published var projects: [AMDOSParityProjectRef] = []
    @Published var cells: [String: AMDOSParityInstitutionCell] = [:]
    @Published var policyCells: [String: AMDOSParityPolicyCell] = [:]
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?
    func load() async {
        state = .loading; message = nil
        do {
            async let i = AMDOSRESTClient.shared.fetchTable(AMDOSParityInstitution.self, table: "institutions", select: "*", order: "sort_order", limit: 300)
            async let a = AMDOSRESTClient.shared.fetchTable(AMDOSParityAxis.self, table: "institution_capability_axes", select: "*", order: "sort_order", limit: 100)
            async let c = AMDOSRESTClient.shared.fetchTable(AMDOSParityCriterion.self, table: "institution_capability_criteria", select: "*", order: "sort_order", limit: 1000)
            async let e = AMDOSRESTClient.shared.fetchTable(AMDOSParityAssessment.self, table: "institution_assessments", select: "*", order: "evaluated_at.desc", limit: 3000)
            async let pi = AMDOSRESTClient.shared.fetchTable(AMDOSParityPolicyItem.self, table: "institution_policy_items", select: "*", order: "sort_order", limit: 500)
            async let pa = AMDOSRESTClient.shared.fetchTable(AMDOSParityPolicyAssessment.self, table: "institution_policy_assessments", select: "*", order: "updated_at.desc", limit: 3000)
            async let ip = AMDOSRESTClient.shared.fetchTable(AMDOSParityInstitutionProject.self, table: "institution_projects", select: "project_id,institution_id,engagement_scope,target_unit,ecosystem_goal,seed_discovery_in_scope", limit: 500)
            async let p = AMDOSRESTClient.shared.fetchTable(AMDOSParityProjectRef.self, table: "projects", select: "project_id,project_name,status", order: "project_name", limit: 500)
            institutions = try await i; axes = try await a; criteria = try await c; assessments = try await e; policyItems = try await pi; policyAssessments = try await pa; institutionProjects = try await ip; projects = try await p
            rebuildCells(); state = institutions.isEmpty ? .empty : .loaded
        } catch { message = error.localizedDescription; state = .failed(message ?? "研究機関評価を取得できなかった") }
    }
    func rebuildCells() {
        var next: [String: AMDOSParityInstitutionCell] = [:]
        for item in institutions { for criterion in criteria { let row = assessments.first(where: { $0.institutionID == item.id && $0.criterionID == criterion.id }); next["\(item.id)::\(criterion.id)"] = AMDOSParityInstitutionCell(level: row?.level, na: row?.na ?? false, note: row?.note) } }
        cells = next
        var policies: [String: AMDOSParityPolicyCell] = [:]
        for item in institutions { for policy in policyItems { let row = policyAssessments.first(where: { $0.institutionID == item.id && $0.policyItemID == policy.id }); policies["\(item.id)::\(policy.id)"] = AMDOSParityPolicyCell(status: row?.status ?? "unknown", attributeValue: row?.attributeValue, evidenceNote: row?.evidenceNote, sourceType: row?.sourceType ?? "unknown", sourceURL: row?.sourceURL, sourcePath: row?.sourcePath, confirmedAt: row?.confirmedAt) } }
        policyCells = policies
    }
    func saveAssessment(institutionID: String, criterionID: String, cell: AMDOSParityInstitutionCell) async {
        do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/institutions/assess", body: AMDOSParityInstitutionAssessmentPayload(institutionID: institutionID, criterionID: criterionID, level: cell.na ? nil : cell.level, na: cell.na, note: cell.note)) } catch { message = error.localizedDescription }
    }
    func savePolicy(institutionID: String, itemID: String, cell: AMDOSParityPolicyCell) async {
        do { _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/institutions/policies", body: AMDOSParityInstitutionPolicyPayload(institutionID: institutionID, policyItemID: itemID, status: cell.status, attributeValue: cell.attributeValue, evidenceNote: cell.evidenceNote, sourceType: cell.sourceType, sourceURL: cell.sourceURL, sourcePath: cell.sourcePath, confirmedAt: cell.confirmedAt)) } catch { message = error.localizedDescription }
    }
}

private func amdOSParityECR(axes: [AMDOSParityAxis], criteria: [AMDOSParityCriterion], cells: [String: AMDOSParityInstitutionCell], institutionID: String) -> (value: Double?, axes: [(AMDOSParityAxis, Double?, Int, Int)]) {
    var totalWeighted = 0.0; var weightSum = 0.0
    let result = axes.sorted { $0.sortOrder < $1.sortOrder }.map { axis -> (AMDOSParityAxis, Double?, Int, Int) in
        let rows = criteria.filter { $0.axisID == axis.id }
        let scored = rows.compactMap { row -> Double? in let cell = cells["\(institutionID)::\(row.id)"]; guard let cell, !cell.na, let level = cell.level else { return nil }; return Double(max(1, min(5, level)) - 1) / 4 }
        let score = scored.isEmpty ? nil : scored.reduce(0, +) / Double(scored.count)
        if let score { totalWeighted += axis.weight * score; weightSum += axis.weight }
        return (axis, score, scored.count, rows.filter { cells["\(institutionID)::\($0.id)"]?.na != true }.count)
    }
    return (weightSum == 0 ? nil : totalWeighted / weightSum * 100, result)
}

struct AMDOSParityInstitutionsView: View {
    let onSelectInstitution: (String) -> Void
    @StateObject private var store = AMDOSInstitutionParityStore()
    @State private var query = ""
    @State private var viewMode = "catalog"

    private var rows: [AMDOSParityInstitution] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return store.institutions
            .filter { institution in
                normalized.isEmpty || [institution.name, institution.shortName, institution.region]
                    .compactMap { $0?.lowercased() }
                    .contains(where: { $0.contains(normalized) })
            }
            .sorted { lhs, rhs in
                let lhsLink = projectLink(for: lhs.id)
                let rhsLink = projectLink(for: rhs.id)
                let lhsPriority = amdOSParityInstitutionLifecycle(lhs, link: lhsLink)
                let rhsPriority = amdOSParityInstitutionLifecycle(rhs, link: rhsLink)
                if lhsPriority != rhsPriority { return lhsPriority < rhsPriority }
                return lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
            }
    }

    private func projectLink(for institutionID: String) -> AMDOSParityInstitutionProjectLink? {
        amdOSParityInstitutionProjectLink(
            for: institutionID,
            institutionProjects: store.institutionProjects,
            projects: store.projects,
            institutions: store.institutions
        )
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "INSTITUTIONS", title: "研究機関", subtitle: "AMDとの契約有無に関係なく全件を蓄積し、契約した機関には同じ行へPJ運用情報を重ねる") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if !store.institutions.isEmpty {
                HStack(spacing: 12) {
                    AMDOSMetricTile(label: "研究機関", value: "\(store.institutions.count)件", detail: "契約有無に依存しないカタログ", tint: AMDOSDesign.blue)
                    AMDOSMetricTile(label: "PJ化済み", value: "\(store.institutions.filter { amdOSParityInstitutionLifecycle($0, link: projectLink(for: $0.id)) == 0 }.count)件", detail: "研究機関PJ", tint: AMDOSDesign.success)
                    AMDOSMetricTile(label: "PJ化検討中", value: "\(store.institutions.filter { amdOSParityInstitutionLifecycle($0, link: projectLink(for: $0.id)) == 1 }.count)件", detail: "商談・契約検討", tint: AMDOSDesign.warning)
                }
                HStack {
                    TextField("機関名・略称・地域", text: $query).textFieldStyle(.roundedBorder)
                    Picker("表示", selection: $viewMode) {
                        Text("研究機関リスト").tag("catalog")
                        Text("ECR比較").tag("ecr")
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 320)
                }
                Text("\(rows.count) / \(store.institutions.count)件 · PJ化済み → PJ化検討中 → その他")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                ForEach(rows) { institution in
                    let ecr = amdOSParityECR(axes: store.axes, criteria: store.criteria, cells: store.cells, institutionID: institution.id)
                    let projectLink = projectLink(for: institution.id)
                    let lifecycle = amdOSParityInstitutionLifecycle(institution, link: projectLink)
                    Button { onSelectInstitution(institution.id) } label: {
                        AMDOSCard {
                            VStack(alignment: .leading, spacing: 10) {
                                if lifecycle < 2 {
                                    HStack(spacing: 6) {
                                        Image(systemName: lifecycle == 0 ? "briefcase.fill" : "clock.arrow.circlepath")
                                        Text("\(lifecycle == 0 ? "PJ化済み" : "PJ化検討中")\(projectLink.map { " · \($0.projectLabel)" } ?? "")")
                                    }
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(lifecycle == 0 ? Color.white : AMDOSDesign.warning)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(lifecycle == 0 ? AMDOSDesign.blue : AMDOSDesign.warning.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                                }
                                HStack {
                                    Text(institution.name).font(.headline)
                                    if institution.identityStatus == "candidate" { AMDOSStatusBadge(text: "名称未確認", tint: AMDOSDesign.warning) }
                                    Spacer()
                                    Text(ecr.value.map { "ECR \(Int($0.rounded()))%" } ?? "ECR 未評価")
                                        .font(.title3.bold()).foregroundStyle(ecr.value == nil ? AMDOSDesign.muted : AMDOSDesign.blue)
                                }
                                Text([institution.shortName, institution.type, institution.region].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                                if viewMode == "ecr" {
                                    HStack { ForEach(ecr.axes, id: \.0.id) { axis, score, assessed, total in VStack(alignment: .leading, spacing: 3) { Text("\(axis.axisNo) \(axis.name)").font(.caption2).lineLimit(1); ProgressView(value: score ?? 0).tint(score == nil ? AMDOSDesign.muted : AMDOSDesign.success); Text("\(score.map { Int(($0 * 100).rounded()) } ?? 0)% · \(assessed)/\(total)").font(.caption2).foregroundStyle(AMDOSDesign.muted) }.frame(maxWidth: .infinity, alignment: .leading) } }
                                } else {
                                    Text(projectLink?.relationLabel ?? (lifecycle == 1 ? "研究機関PJを検討中" : "未PJ化 · カタログ蓄積中"))
                                        .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                                }
                            }
                        }
                    }.buttonStyle(.plain)
                }
            }
        }.task { await store.load() }
    }
}

struct AMDOSParityInstitutionDetailView: View {
    let institutionID: String?
    @StateObject private var store = AMDOSInstitutionParityStore()
    var body: some View {
        AMDOSPageScaffold(eyebrow: "INSTITUTION DETAIL", title: store.institutions.first(where: { $0.id == institutionID })?.name ?? "研究機関詳細", subtitle: "ECRの8軸レーダー相当の軸別スコア、Lv1–5 rubric、最新評価メモを確認") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if let institutionID, let institution = store.institutions.first(where: { $0.id == institutionID }) {
                let ecr = amdOSParityECR(axes: store.axes, criteria: store.criteria, cells: store.cells, institutionID: institutionID)
                let projectLink = amdOSParityInstitutionProjectLink(for: institutionID, institutionProjects: store.institutionProjects, projects: store.projects, institutions: store.institutions)
                HStack {
                    AMDOSMetricTile(label: "ECR充足率", value: ecr.value.map { "\(Int($0.rounded()))%" } ?? "未評価", detail: "研究機関環境だけの評価", tint: AMDOSDesign.blue)
                    AMDOSMetricTile(label: "機関", value: institution.name, detail: [institution.type, institution.region].compactMap { $0 }.joined(separator: " · "))
                    AMDOSMetricTile(label: "AMD PJ", value: projectLink?.projectLabel ?? "なし", detail: projectLink?.relationLabel ?? "カタログ蓄積中", tint: projectLink == nil ? AMDOSDesign.muted : AMDOSDesign.success)
                }
                Text("ECRは研究機関環境、SPSは個別シーズ。単一スコアへ合算しない。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                AMDOSSectionCard("軸別サマリ", systemImage: "chart.radar") { ForEach(ecr.axes, id: \.0.id) { axis, score, assessed, total in HStack { Text("\(axis.axisNo)").font(.headline).foregroundStyle(AMDOSDesign.blue); Text(axis.name); Spacer(); Text(score.map { "\(Int(($0 * 100).rounded()))%" } ?? "未評価"); Text("\(assessed)/\(total)").font(.caption).foregroundStyle(AMDOSDesign.muted) } } }
                ForEach(store.axes.sorted { $0.sortOrder < $1.sortOrder }) { axis in
                    AMDOSSectionCard("\(axis.axisNo) · \(axis.name)", systemImage: "scope") {
                        if let xrl = axis.correspondsXRL { Text("対応XRL: \(xrl)").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        ForEach(store.criteria.filter { $0.axisID == axis.id }.sorted { $0.sortOrder < $1.sortOrder }) { criterion in
                            let cell = store.cells["\(institutionID)::\(criterion.id)"]
                            VStack(alignment: .leading, spacing: 5) {
                                HStack { Text(criterion.code).font(.caption.monospaced()); Text(criterion.name).font(.subheadline.weight(.medium)); Spacer(); AMDOSStatusBadge(text: cell?.na == true ? "N/A" : cell?.level.map { "Lv\($0)" } ?? "未評価") }
                                if let level = cell?.level, let rubric = criterion.rubric[String(level)] { Text(rubric).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                                if let note = cell?.note, !note.isEmpty { Text("📝 \(note)").font(.caption).foregroundStyle(AMDOSDesign.warning) }
                            }
                        }
                    }
                }
            }
        }.task { await store.load() }
    }
}

struct AMDOSParityInstitutionAssessView: View {
    @StateObject private var store = AMDOSInstitutionParityStore()
    @State private var selectedInstitution = ""
    @State private var tab = "ecr"
    var body: some View {
        AMDOSPageScaffold(eyebrow: "INSTITUTION ASSESS", title: "ECR 評価入力", subtitle: "PWAのLv1–5 / N/A・根拠メモと制度整備・規程比較を、同じAPIへ自動保存") {
            Picker("機関", selection: $selectedInstitution) { Text("機関を選択").tag(""); ForEach(store.institutions) { Text($0.name).tag($0.id) } }
            Picker("タブ", selection: $tab) { Text("ECR評価").tag("ecr"); Text("制度・規程").tag("policy") }.pickerStyle(.segmented)
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if let institution = store.institutions.first(where: { $0.id == selectedInstitution }) {
                if tab == "ecr" { ecrForm(institution: institution) } else { policyForm(institution: institution) }
            } else { Text("機関を選ぶと評価セルを編集できるよ。").foregroundStyle(AMDOSDesign.muted) }
            if let message = store.message { Text(message).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
        }.task { await store.load(); if selectedInstitution.isEmpty { selectedInstitution = store.institutions.first?.id ?? "" } }
    }
    @ViewBuilder private func ecrForm(institution: AMDOSParityInstitution) -> some View {
        ForEach(store.axes.sorted { $0.sortOrder < $1.sortOrder }) { axis in AMDOSSectionCard("\(axis.axisNo) · \(axis.name)", systemImage: "list.number") { ForEach(store.criteria.filter { $0.axisID == axis.id }.sorted { $0.sortOrder < $1.sortOrder }) { criterion in criterionEditor(institution: institution, criterion: criterion) } } }
    }
    @ViewBuilder private func criterionEditor(institution: AMDOSParityInstitution, criterion: AMDOSParityCriterion) -> some View {
        let key = "\(institution.id)::\(criterion.id)"
        let current = store.cells[key] ?? AMDOSParityInstitutionCell(level: nil, na: false, note: nil)
        VStack(alignment: .leading, spacing: 7) {
            HStack { Text("\(criterion.code) \(criterion.name)").font(.subheadline.weight(.medium)); Spacer(); Text(current.na ? "N/A" : current.level.map { "Lv\($0)" } ?? "未評価").foregroundStyle(AMDOSDesign.muted) }
            ForEach(1...5, id: \.self) { level in Button { var next = current; next.level = current.level == level && !current.na ? nil : level; next.na = next.level == nil; store.cells[key] = next; Task { await store.saveAssessment(institutionID: institution.id, criterionID: criterion.id, cell: next) } } label: { HStack(alignment: .top) { Image(systemName: current.level == level && !current.na ? "checkmark.circle.fill" : "circle"); Text("Lv\(level): \(criterion.rubric[String(level)] ?? "基準未登録")").font(.caption); Spacer() } }.buttonStyle(.plain) }
            HStack { AMDOSTextField(title: "根拠メモ", text: Binding(get: { current.note ?? "" }, set: { value in var next = current; next.note = value.trimmedNonEmpty; store.cells[key] = next })) ; Button("メモを保存") { Task { await store.saveAssessment(institutionID: institution.id, criterionID: criterion.id, cell: store.cells[key] ?? current) } }.buttonStyle(.bordered) }
            Button(current.na ? "N/Aを解除" : "N/Aにする") { var next = current; next.na.toggle(); if next.na { next.level = nil }; store.cells[key] = next; Task { await store.saveAssessment(institutionID: institution.id, criterionID: criterion.id, cell: next) } }.buttonStyle(.bordered)
        }.padding(.vertical, 6)
    }
    @ViewBuilder private func policyForm(institution: AMDOSParityInstitution) -> some View {
        ForEach(store.policyItems.sorted { $0.sortOrder < $1.sortOrder }) { item in
            let key = "\(institution.id)::\(item.id)"; let current = store.policyCells[key] ?? AMDOSParityPolicyCell(status: "unknown", attributeValue: nil, evidenceNote: nil, sourceType: "unknown", sourceURL: nil, sourcePath: nil, confirmedAt: nil)
            AMDOSSectionCard(item.label, systemImage: item.itemKind == "attribute" ? "slider.horizontal.3" : "checkmark.seal") {
                Text([item.category, item.description].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                Picker("状態", selection: Binding(get: { current.status }, set: { value in var next = current; next.status = value; store.policyCells[key] = next; Task { await store.savePolicy(institutionID: institution.id, itemID: item.id, cell: next) } })) { ForEach(["unknown", "not_started", "drafting", "established"], id: \.self) { Text($0).tag($0) } }
                AMDOSTextField(title: item.itemKind == "attribute" ? "属性値" : "根拠メモ", text: Binding(get: { item.itemKind == "attribute" ? (current.attributeValue ?? "") : (current.evidenceNote ?? "") }, set: { value in var next = current; if item.itemKind == "attribute" { next.attributeValue = value } else { next.evidenceNote = value }; store.policyCells[key] = next }))
                AMDOSTextField(title: "出典URL / パス", text: Binding(get: { current.sourceURL ?? current.sourcePath ?? "" }, set: { value in var next = current; next.sourceURL = value.trimmedNonEmpty; store.policyCells[key] = next }))
                Button("制度情報を保存") { Task { await store.savePolicy(institutionID: institution.id, itemID: item.id, cell: store.policyCells[key] ?? current) } }.buttonStyle(.bordered)
            }
        }
    }
}

/// 研究機関カタログへ重ねるAMD契約PJ。対応の正本は `institution_projects`。
private struct AMDOSParityInstitutionProjectLink: Sendable {
    let institutionID: String
    let projectID: String
    let projectLabel: String
    let projectStatus: String
    let relationLabel: String
    let cockpitTitle: String
    let cockpitSummary: String
}

private func amdOSParityProjectLifecycle(_ status: String?) -> Int {
    let normalized = (status ?? "").lowercased()
    if ["active", "ended", "frozen"].contains(normalized) { return 0 }
    if ["sales", "draft"].contains(normalized) { return 1 }
    return 2
}

private func amdOSParityInstitutionLifecycle(
    _ institution: AMDOSParityInstitution,
    link: AMDOSParityInstitutionProjectLink?
) -> Int {
    let linked = amdOSParityProjectLifecycle(link?.projectStatus)
    if linked < 2 { return linked }
    let contract = (institution.contractStatus ?? "").lowercased()
    if ["active", "past"].contains(contract) { return 0 }
    if ["draft", "prospect"].contains(contract) { return 1 }
    return 2
}

private func amdOSParityInstitutionProjectLink(
    for institutionID: String?,
    institutionProjects: [AMDOSParityInstitutionProject],
    projects: [AMDOSParityProjectRef],
    institutions: [AMDOSParityInstitution]
) -> AMDOSParityInstitutionProjectLink? {
    guard let institutionID else { return nil }
    let rows = institutionProjects.filter { $0.institutionID == institutionID }
    guard let row = rows.sorted(by: { lhs, rhs in
        let lhsPriority = amdOSParityProjectLifecycle(projects.first(where: { $0.id == lhs.projectID })?.status)
        let rhsPriority = amdOSParityProjectLifecycle(projects.first(where: { $0.id == rhs.projectID })?.status)
        if lhsPriority != rhsPriority { return lhsPriority < rhsPriority }
        return lhs.projectID > rhs.projectID
    }).first else { return nil }
    let project = projects.first(where: { $0.id == row.projectID })
    let institutionName = institutions.first(where: { $0.id == institutionID })?.name ?? institutionID
    let scopeLabel = row.engagementScope == "university_wide" ? "全学エコシステム構築PJ" : "研究機関PJ"
    return AMDOSParityInstitutionProjectLink(
        institutionID: institutionID,
        projectID: row.projectID,
        projectLabel: project?.name ?? row.projectID,
        projectStatus: project?.status ?? "状態不明",
        relationLabel: scopeLabel,
        cockpitTitle: "\(institutionName) 研究機関コックピット",
        cockpitSummary: row.ecosystemGoal?.trimmedNonEmpty
            ?? "研究機関カタログとECRはこの画面に残し、契約・進捗・月次・MTG・タスクは関連PJの運用情報として重ねて表示する。"
    )
}

private struct AMDOSParityInstitutionCockpitMeeting: Codable, Identifiable, Sendable {
    let meetingID: String
    let ym: String?
    let meetingDate: String?
    let title: String?
    let summaryShort: String?
    let narrativeMD: String?
    let sourceKinds: String?

    var id: String { meetingID }

    enum CodingKeys: String, CodingKey {
        case meetingID = "meeting_id", ym, meetingDate = "meeting_date", title
        case summaryShort = "summary_short", narrativeMD = "narrative_md", sourceKinds = "source_kinds"
    }
}

private struct AMDOSParityInstitutionMeetingMonth: Identifiable {
    let ym: String
    let meetings: [AMDOSParityInstitutionCockpitMeeting]

    var id: String { ym }
}

private func amdOSParityInstitutionMeetingYM(_ meeting: AMDOSParityInstitutionCockpitMeeting) -> String {
    if let ym = meeting.ym, ym.count >= 6 {
        return String(ym.prefix(6))
    }
    if let date = meeting.meetingDate {
        let digits = date.filter(\.isNumber)
        if digits.count >= 6 { return String(digits.prefix(6)) }
    }
    return "000000"
}

private func amdOSParityInstitutionYMLabel(_ ym: String) -> String {
    guard ym.count >= 6 else { return ym }
    return "\(ym.prefix(4))/\(ym.suffix(2))"
}

struct AMDOSParityInstitutionCockpitView: View {
    let institutionID: String?
    let onOpenProjectCockpit: (String, String?) -> Void
    let onOpenProjectConfig: (String) -> Void
    let onOpenInstitutionDetail: (String) -> Void

    @StateObject private var store = AMDOSInstitutionParityStore()
    @State private var meetings: [AMDOSParityInstitutionCockpitMeeting] = []
    @State private var meetingState: AMDOSFeatureLoadState = .idle
    @State private var expandedMeetingMonths: Set<String> = []
    @State private var activeTab = "progress"

    private var projectLink: AMDOSParityInstitutionProjectLink? {
        amdOSParityInstitutionProjectLink(
            for: institutionID,
            institutionProjects: store.institutionProjects,
            projects: store.projects,
            institutions: store.institutions
        )
    }

    private var meetingMonths: [AMDOSParityInstitutionMeetingMonth] {
        let grouped = Dictionary(grouping: meetings, by: amdOSParityInstitutionMeetingYM)
        return grouped
            .map { AMDOSParityInstitutionMeetingMonth(ym: $0.key, meetings: $0.value) }
            .sorted { $0.ym > $1.ym }
            .prefix(8)
            .map { $0 }
    }

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "INSTITUTION COCKPIT",
            title: projectLink?.cockpitTitle ?? "研究機関コックピット",
            subtitle: "研究機関カタログとECRへ、institution_projects正本の契約・進捗・月次・MTG履歴を重ねて確認"
        ) {
            AMDOSStateNotice(state: store.state) { Task { await reload() } }
            if let projectLink {
                if let institution = store.institutions.first(where: { $0.id == projectLink.institutionID }) {
                    cockpitHeader(institution: institution, link: projectLink)
                    readinessSummary(institutionID: institution.id)
                    Picker("表示", selection: $activeTab) {
                        Text("進捗管理").tag("progress")
                        Text("スコア詳細").tag("score-detail")
                    }
                    .pickerStyle(.segmented)

                    if activeTab == "progress" {
                        progressTab(link: projectLink)
                    } else {
                        scoreDetail(institutionID: institution.id)
                    }
                } else if store.state == .loaded {
                    AMDOSSectionCard("研究機関", systemImage: "exclamationmark.triangle") {
                        Text("研究機関ERSのデータを取得できなかったよ。").foregroundStyle(AMDOSDesign.muted)
                    }
                }
            } else if store.state == .loaded || store.state == .empty {
                AMDOSSectionCard("関連PJ", systemImage: "exclamationmark.triangle") {
                    Text("この研究機関には、まだAMDとの研究機関PJがありません。研究機関カタログとECRは契約なしでも蓄積するよ。")
                        .foregroundStyle(AMDOSDesign.muted)
                }
            }
        }
        .task(id: institutionID) { await reload() }
    }

    @ViewBuilder
    private func cockpitHeader(institution: AMDOSParityInstitution, link: AMDOSParityInstitutionProjectLink) -> some View {
        let ecr = amdOSParityECR(axes: store.axes, criteria: store.criteria, cells: store.cells, institutionID: institution.id)
        AMDOSCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 8) {
                            Text(link.cockpitTitle).font(.title2.weight(.bold))
                            AMDOSStatusBadge(text: institution.type, tint: AMDOSDesign.blue)
                            AMDOSStatusBadge(text: link.relationLabel, tint: AMDOSDesign.success)
                        }
                        Text(institution.name).font(.subheadline.weight(.medium))
                        Text(institution.region?.trimmedNonEmpty ?? "地域未登録")
                            .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        Text(link.cockpitSummary).font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 8) {
                        Button("ECR詳細を開く") { onOpenInstitutionDetail(institution.id) }.buttonStyle(.bordered)
                        Button("通常PJコックピットを開く") { onOpenProjectCockpit(link.projectID, nil) }.buttonStyle(.borderedProminent)
                    }
                }
                HStack(spacing: 12) {
                    AMDOSMetricTile(
                        label: "ECR充足率",
                        value: ecr.value.map { "\(Int($0.rounded()))%" } ?? "未評価",
                        detail: "評価済 \(ecr.axes.reduce(0) { $0 + $1.2 })/\(store.criteria.count)",
                        tint: AMDOSDesign.blue
                    )
                    AMDOSMetricTile(label: "関連PJ", value: link.projectLabel, detail: "\(link.relationLabel) · \(link.projectStatus)", tint: AMDOSDesign.success)
                    AMDOSMetricTile(label: "MTG履歴", value: "\(meetings.count)件", detail: meetings.first?.title ?? "履歴なし")
                }
            }
        }
    }

    @ViewBuilder
    private func readinessSummary(institutionID: String) -> some View {
        let ecr = amdOSParityECR(axes: store.axes, criteria: store.criteria, cells: store.cells, institutionID: institutionID)
        let assessed = ecr.axes.filter { $0.1 != nil }
        let strong = assessed.sorted { ($0.1 ?? 0) > ($1.1 ?? 0) }.prefix(3)
        let weak = assessed.sorted { ($0.1 ?? 0) < ($1.1 ?? 0) }.prefix(3)
        AMDOSSectionCard("Readiness snapshot", systemImage: "chart.bar.xaxis") {
            HStack(alignment: .top, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(ecr.value.map { "\(Int($0.rounded()))%" } ?? "未評価").font(.system(size: 28, weight: .bold, design: .rounded))
                    Text("ECR / 評価済 \(ecr.axes.reduce(0) { $0 + $1.2 })/\(store.criteria.count)")
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    ProgressView(value: (ecr.value ?? 0) / 100).tint(AMDOSDesign.blue)
                }
                institutionAxisMiniList(title: "強い軸", axes: Array(strong))
                institutionAxisMiniList(title: "確認したい軸", axes: Array(weak))
            }
        }
    }

    @ViewBuilder
    private func institutionAxisMiniList(title: String, axes: [(AMDOSParityAxis, Double?, Int, Int)]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
            if axes.isEmpty {
                Text("評価待ち").font(.caption).foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(axes, id: \.0.id) { axis, score, _, _ in
                    HStack(spacing: 6) {
                        Text("\(axis.axisNo). \(axis.name)").font(.caption).lineLimit(1)
                        Spacer()
                        Text(score.map { "\(Int(($0 * 100).rounded()))%" } ?? "--")
                            .font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.muted)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func progressTab(link: AMDOSParityInstitutionProjectLink) -> some View {
        AMDOSSectionCard("関連PJコックピット", systemImage: "rectangle.3.group.fill") {
            HStack(alignment: .center, spacing: 12) {
                Text("研究機関の箱はこの画面に残し、MS進捗・MTGサマリ・月次サマリは既存の関連PJデータをそのまま使う。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("通常PJコックピットを開く") { onOpenProjectCockpit(link.projectID, nil) }.buttonStyle(.bordered)
            }
        }
        AMDOSParityProjectCockpitView(
            projectId: link.projectID,
            onOpenConfig: onOpenProjectConfig,
            embedded: true
        )
        meetingTree(link: link)
    }

    @ViewBuilder
    private func scoreDetail(institutionID: String) -> some View {
        let ecr = amdOSParityECR(axes: store.axes, criteria: store.criteria, cells: store.cells, institutionID: institutionID)
        AMDOSSectionCard("研究機関スコア詳細", systemImage: "chart.radar") {
            Text("ここはSU向けAMD Scoreではなく、研究機関ECRの8軸と評価根拠を見るタブ。制度整備・規程比較の詳細は評価画面で扱う。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            ForEach(ecr.axes, id: \.0.id) { axis, score, assessed, total in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Axis \(axis.axisNo)").font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                            Text(axis.name).font(.headline)
                            if let xrl = axis.correspondsXRL { Text(xrl).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(score.map { "\(Int(($0 * 100).rounded()))%" } ?? "--").font(.title3.weight(.bold))
                            Text("\(assessed)/\(total)").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                    ProgressView(value: score ?? 0).tint(score == nil ? AMDOSDesign.muted : AMDOSDesign.blue)
                    ForEach(store.criteria.filter { $0.axisID == axis.id }.sorted { $0.sortOrder < $1.sortOrder }) { criterion in
                        let cell = store.cells["\(institutionID)::\(criterion.id)"]
                        HStack(alignment: .top, spacing: 8) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("\(criterion.code) \(criterion.name)").font(.subheadline.weight(.medium))
                                if let note = cell?.note?.trimmedNonEmpty { Text(note).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2) }
                            }
                            Spacer()
                            AMDOSStatusBadge(text: cell?.na == true ? "N/A" : cell?.level.map { "Lv\($0)" } ?? "未評価")
                        }
                        .padding(8)
                        .background(AMDOSDesign.muted.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    @ViewBuilder
    private func meetingTree(link: AMDOSParityInstitutionProjectLink) -> some View {
        AMDOSSectionCard("MTGツリー", systemImage: "point.3.connected.trianglepath.dotted") {
            HStack(alignment: .top, spacing: 12) {
                Text("\(link.projectLabel)の会議履歴を月ごとに束ねる。各行から既存のMTG詳細を開ける。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("MTG一覧を開く") { onOpenProjectCockpit(link.projectID, nil) }.buttonStyle(.bordered)
            }
            AMDOSStateNotice(state: meetingState) { Task { await loadMeetings() } }
            if meetingState == .empty {
                Text("まだMTG履歴がありません。関連PJ側に予定MTGカードまたは開催済み議事録が入ると、ここに月別で並ぶよ。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(meetingMonths) { month in
                DisclosureGroup("\(amdOSParityInstitutionYMLabel(month.ym)) (\(month.meetings.count)件)", isExpanded: meetingMonthExpandedBinding(month.id)) {
                    ForEach(month.meetings) { meeting in
                        Button { onOpenProjectCockpit(link.projectID, meeting.meetingID) } label: {
                            HStack(alignment: .top, spacing: 10) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(meeting.title?.trimmedNonEmpty ?? "無題MTG").font(.subheadline.weight(.medium))
                                    Text(meeting.summaryShort?.trimmedNonEmpty ?? meeting.narrativeMD?.replacingOccurrences(of: "\\n", with: " ").trimmedNonEmpty ?? "サマリ未作成")
                                        .font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                                }
                                Spacer()
                                AMDOSStatusBadge(text: meeting.sourceKinds == "upcoming" ? "予定" : meeting.sourceKinds == "dialogue" ? "提案整理" : "議事録")
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.vertical, 6)
                    }
                }
                .padding(10)
                .background(AMDOSDesign.muted.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    private func reload() async {
        await store.load()
        if projectLink != nil { await loadMeetings() }
    }

    private func loadMeetings() async {
        guard let projectID = projectLink?.projectID else {
            meetings = []
            meetingState = .empty
            return
        }
        meetingState = .loading
        do {
            meetings = try await AMDOSRESTClient.shared.fetchTable(
                AMDOSParityInstitutionCockpitMeeting.self,
                table: "project_meeting_summaries",
                select: "meeting_id,ym,meeting_date,title,summary_short,narrative_md,source_kinds",
                filters: ["project_id": "eq.\(projectID)"],
                order: "meeting_date.desc",
                limit: 80
            )
            if let firstMonth = meetingMonths.first?.id, expandedMeetingMonths.isEmpty {
                expandedMeetingMonths.insert(firstMonth)
            }
            meetingState = meetings.isEmpty ? .empty : .loaded
        } catch {
            meetings = []
            meetingState = .failed(error.localizedDescription)
        }
    }

    private func meetingMonthExpandedBinding(_ monthID: String) -> Binding<Bool> {
        Binding(
            get: { expandedMeetingMonths.contains(monthID) },
            set: { isExpanded in
                if isExpanded {
                    expandedMeetingMonths.insert(monthID)
                } else {
                    expandedMeetingMonths.remove(monthID)
                }
            }
        )
    }
}

private struct AMDOSParityScholarRow: Decodable, Sendable {
    let lane: String
    let observedAt: String
    let paperCount: Double
    let source: String
    enum CodingKeys: String, CodingKey { case lane, observedAt = "observed_at", paperCount = "paper_count", source }
}

private struct AMDOSParityScholarQuarter: Identifiable, Sendable {
    let id: String
    let observedAt: String
    let counts: [String: Double]
}

@MainActor
private final class AMDOSParityScholarStore: ObservableObject {
    @Published var rows: [AMDOSParityScholarRow] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    func load() async {
        state = .loading
        do {
            rows = try await AMDOSRESTClient.shared.fetchTable(AMDOSParityScholarRow.self, table: "papers_log", select: "lane,observed_at,paper_count,source", order: "observed_at", limit: 2_000)
            state = rows.isEmpty ? .empty : .loaded
        } catch { state = .failed(error.localizedDescription) }
    }
}

struct AMDOSParityScholarView: View {
    private let lanes: [(id: String, label: String, color: Color)] = [
        ("advanced_ict", "通信・ICT", Color(red: 0.220, green: 0.741, blue: 0.973)),
        ("advanced_materials_manufacturing", "先端材料・製造", Color(red: 0.961, green: 0.620, blue: 0.043)),
        ("ai_technologies", "AI", Color(red: 0.655, green: 0.545, blue: 0.980)),
        ("biotechnology", "バイオ・医療", Color(red: 0.925, green: 0.282, blue: 0.600)),
        ("defence_space_robotics_transport", "防衛・宇宙・ロボ", Color(red: 0.133, green: 0.773, blue: 0.369)),
        ("energy_environment", "エネルギー・環境", Color(red: 0.063, green: 0.725, blue: 0.506)),
        ("quantum", "量子", Color(red: 0.506, green: 0.549, blue: 0.973)),
        ("sensing_timing_navigation", "センシング", Color(red: 0.078, green: 0.722, blue: 0.651))
    ]
    @StateObject private var store = AMDOSParityScholarStore()
    @State private var selectedLane: String?

    private var quarters: [AMDOSParityScholarQuarter] {
        var grouped: [String: (date: String, values: [String: Double])] = [:]
        for row in store.rows {
            guard lanes.contains(where: { $0.id == row.lane }) else { continue }
            let pieces = row.observedAt.split(separator: "-")
            guard pieces.count >= 2, let month = Int(pieces[1]) else { continue }
            let quarter = "\(pieces[0])-Q\((month - 1) / 3 + 1)"
            grouped[quarter, default: (row.observedAt, [:])].values[row.lane] = row.paperCount
        }
        return grouped.map { AMDOSParityScholarQuarter(id: $0.key, observedAt: $0.value.date, counts: $0.value.values) }.sorted { $0.observedAt < $1.observedAt }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "SCHOLAR", title: "Scholar — 学術トレンド (μ_A 観測量 N)", subtitle: "OpenAlexからASPI 8 domain × quarterの論文出版件数を読む。Triple Helix観測モデル C の N→μ_A loading 0.90 の入力") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if quarters.isEmpty && store.state == .empty {
                AMDOSSectionCard("papers_log", systemImage: "graduationcap") { Text("ASPI 8 domainの論文件数がまだないよ。週次取得が完了するとここに表示されるよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            } else if !quarters.isEmpty {
                laneCards
                chart
                quarterlyTable
            }
        }.task { await store.load() }
    }

    @ViewBuilder private var laneCards: some View {
        let recent = quarters
        HStack(alignment: .top, spacing: 8) {
            ForEach(lanes, id: \.id) { lane in
                let values = recent.compactMap { $0.counts[lane.id] }
                let current = values.last ?? 0
                let yearAgo = values.count > 4 ? values[values.count - 5] : 0
                let yoy = yearAgo > 0 ? ((current - yearAgo) / yearAgo) * 100 : nil
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 4) { HStack { Circle().fill(lane.color).frame(width: 8, height: 8); Text(lane.label).font(.caption).lineLimit(2) }; Text(Int(current).formatted()).font(.headline.monospacedDigit()); Text("本 / 直近Q").font(.caption2).foregroundStyle(AMDOSDesign.muted); if let yoy { Text("前年同期比 \(yoy >= 0 ? "+" : "")\(yoy, specifier: "%.1f")%").font(.caption2).foregroundStyle(yoy > 5 ? AMDOSDesign.success : yoy < -5 ? AMDOSDesign.warning : AMDOSDesign.muted) } }
                }
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(selectedLane == lane.id ? lane.color : .clear, lineWidth: 2))
                .onHover { selectedLane = $0 ? lane.id : nil }
                .frame(maxWidth: .infinity)
            }
        }
    }

    @ViewBuilder private var chart: some View {
        let yMax = max(1, quarters.flatMap { $0.counts.values }.max() ?? 1)
        AMDOSSectionCard("観測値 yN（lane × quarter, 本/Q）", systemImage: "chart.xyaxis.line") {
            GeometryReader { proxy in
                Canvas { context, size in
                    let left: CGFloat = 38; let right: CGFloat = 8; let top: CGFloat = 12; let bottom: CGFloat = 20
                    let width = max(1, size.width - left - right); let height = max(1, size.height - top - bottom)
                    for step in 0...4 { let y = top + height * CGFloat(step) / 4; var grid = Path(); grid.move(to: CGPoint(x: left, y: y)); grid.addLine(to: CGPoint(x: size.width - right, y: y)); context.stroke(grid, with: .color(AMDOSDesign.muted.opacity(0.22)), style: StrokeStyle(lineWidth: 0.6, dash: [2, 3])) }
                    for lane in lanes {
                        var path = Path(); var started = false
                        for (index, quarter) in quarters.enumerated() {
                            guard let value = quarter.counts[lane.id] else { continue }
                            let x = left + width * (quarters.count > 1 ? CGFloat(index) / CGFloat(quarters.count - 1) : 0.5)
                            let y = top + height * (1 - CGFloat(value / yMax))
                            if !started { path.move(to: CGPoint(x: x, y: y)); started = true } else { path.addLine(to: CGPoint(x: x, y: y)) }
                            context.fill(Path(ellipseIn: CGRect(x: x - 2, y: y - 2, width: 4, height: 4)), with: .color(lane.color.opacity(selectedLane == nil || selectedLane == lane.id ? 1 : 0.2)))
                        }
                        context.stroke(path, with: .color(lane.color.opacity(selectedLane == nil || selectedLane == lane.id ? 1 : 0.2)), lineWidth: selectedLane == lane.id ? 2.5 : 1.2)
                    }
                }
            }.frame(height: 260)
            HStack { ForEach(quarters.indices.filter { $0 % 4 == 0 || $0 == quarters.count - 1 }, id: \.self) { index in Text(quarters[index].id).font(.caption2.monospacedDigit()).foregroundStyle(AMDOSDesign.muted); if index != quarters.count - 1 { Spacer() } } }
        }
    }

    @ViewBuilder private var quarterlyTable: some View {
        let recent = Array(quarters.suffix(8))
        AMDOSSectionCard("Quarterly table", systemImage: "tablecells") {
            ForEach(lanes, id: \.id) { lane in HStack { Circle().fill(lane.color).frame(width: 8, height: 8); Text(lane.label).frame(width: 190, alignment: .leading).font(.caption); ForEach(recent) { quarter in Text(quarter.counts[lane.id].map { Int($0).formatted() } ?? "—").font(.caption.monospacedDigit()).frame(maxWidth: .infinity, alignment: .trailing) } } }
        }
    }
}

private struct AMDOSParityKnowledgeProtocol: Decodable, Identifiable, Sendable { let id: String; let title: String; let content: String?; let status: String?; let importance: Double?; enum CodingKeys: String, CodingKey { case id = "protocol_id", title, content, status, importance } }
private struct AMDOSParityKnowledgeProjectFact: Decodable, Identifiable, Sendable { let id: String; let projectID: String; let category: String; let entityName: String; let factText: String?; let confidence: String?; let status: String?; enum CodingKeys: String, CodingKey { case id, projectID = "project_id", category, entityName = "entity_name", factText = "fact_text", confidence, status } }
private struct AMDOSParityKnowledgeMemberFact: Decodable, Identifiable, Sendable { let id: String; let codeName: String; let category: String; let summary: String?; let status: String; enum CodingKeys: String, CodingKey { case id, codeName = "code_name", category, summary, status } }
private struct AMDOSParityKnowledgeMeeting: Decodable, Identifiable, Sendable { let id: String; let projectID: String; let title: String; let summary: String; let date: String; enum CodingKeys: String, CodingKey { case id = "meeting_id", projectID = "project_id", title, summary = "summary_short", date = "meeting_date" } }
private struct AMDOSParityKnowledgeSignal: Decodable, Identifiable, Sendable { let id: String; let projectID: String; let title: String; let summary: String; let status: String; let impactLevel: String; enum CodingKeys: String, CodingKey { case id = "signal_id", projectID = "project_id", title, summary, status, impactLevel = "impact_level" } }
private struct AMDOSParityKnowledgeXRL: Decodable, Identifiable, Sendable { let id: String; let projectID: String; let axis: String; let kind: String; let summary: String; let status: String; enum CodingKeys: String, CodingKey { case id = "evidence_id", projectID = "project_id", axis, kind = "evidence_kind", summary, status } }
private struct AMDOSParityKnowledgeReport: Decodable, Identifiable, Sendable { let id: String; let projectID: String; let ym: String; let status: String?; enum CodingKeys: String, CodingKey { case id = "report_id", projectID = "project_id", ym, status } }
private struct AMDOSParityKnowledgeTextbook: Decodable, Identifiable, Sendable { let id: String; let targetID: String; let topic: String; let title: String; let status: String; let priority: Double; enum CodingKeys: String, CodingKey { case id = "candidate_id", targetID = "target_id", topic, title, status, priority } }

@MainActor
private final class AMDOSParityKnowledgeStore: ObservableObject {
    @Published var materials = AMDOSMaterialsResponse(ok: nil, elements: [], minerals: [], polymers: [], materials: [])
    @Published var protocols: [AMDOSParityKnowledgeProtocol] = []
    @Published var projectFacts: [AMDOSParityKnowledgeProjectFact] = []
    @Published var memberFacts: [AMDOSParityKnowledgeMemberFact] = []
    @Published var meetings: [AMDOSParityKnowledgeMeeting] = []
    @Published var signals: [AMDOSParityKnowledgeSignal] = []
    @Published var xrl: [AMDOSParityKnowledgeXRL] = []
    @Published var reports: [AMDOSParityKnowledgeReport] = []
    @Published var textbooks: [AMDOSParityKnowledgeTextbook] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?
    func load() async {
        state = .loading; message = nil
        do {
            async let materialRows = AMDOSRESTClient.shared.fetchPWA(AMDOSMaterialsResponse.self, path: "/api/macos/materials")
            async let protocolRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityKnowledgeProtocol.self, table: "protocols", select: "protocol_id,title,content,status,importance", order: "updated_at.desc", limit: 100)
            async let projectRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityKnowledgeProjectFact.self, table: "project_knowledge", select: "id,project_id,category,entity_name,fact_text,confidence,status", filters: ["status": "eq.active"], order: "updated_at.desc", limit: 200)
            async let memberRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityKnowledgeMemberFact.self, table: "member_knowledge", select: "id,code_name,category,summary,status", filters: ["status": "eq.active"], order: "updated_at.desc", limit: 200)
            async let meetingRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityKnowledgeMeeting.self, table: "project_meeting_summaries", select: "meeting_id,project_id,title,summary_short,meeting_date", order: "meeting_date.desc", limit: 200)
            async let signalRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityKnowledgeSignal.self, table: "project_strategy_signals", select: "signal_id,project_id,title,summary,status,impact_level", order: "updated_at.desc", limit: 200)
            async let xrlRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityKnowledgeXRL.self, table: "project_xrl_evidence", select: "evidence_id,project_id,axis,evidence_kind,summary,status", order: "updated_at.desc", limit: 200)
            async let reportRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityKnowledgeReport.self, table: "monthly_reports", select: "report_id,project_id,ym,status", order: "ym.desc", limit: 200)
            async let textbookRows = AMDOSRESTClient.shared.fetchTable(AMDOSParityKnowledgeTextbook.self, table: "textbook_insight_candidates", select: "candidate_id,target_id,topic,title,status,priority", order: "updated_at.desc", limit: 200)
            materials = try await materialRows; protocols = try await protocolRows; projectFacts = try await projectRows; memberFacts = try await memberRows; meetings = try await meetingRows; signals = try await signalRows; xrl = try await xrlRows; reports = try await reportRows; textbooks = try await textbookRows
            state = .loaded
        } catch { message = error.localizedDescription; state = .failed(message ?? "知識地図を取得できなかったよ") }
    }
}

private enum AMDOSParityMaterialsTab: String, CaseIterable, Identifiable {
    case overview, elements, minerals, polymers, map, compare

    var id: String { rawValue }
    var label: String {
        switch self {
        case .overview: return "全体"
        case .elements: return "元素"
        case .minerals: return "鉱物・鉱石"
        case .polymers: return "樹脂・高分子"
        case .map: return "材料マップ"
        case .compare: return "比較"
        }
    }

    var image: String {
        switch self {
        case .overview: return "rectangle.3.group"
        case .elements: return "atom"
        case .minerals: return "diamond"
        case .polymers: return "testtube.2"
        case .map: return "point.3.connected.trianglepath.dotted"
        case .compare: return "rectangle.split.3x1"
        }
    }
}

private enum AMDOSParityKnowledgeDomain: String, CaseIterable, Identifiable {
    case all, protocols = "protocol", project, people, meeting, signal, readiness, monthly, textbook

    var id: String { rawValue }
    var label: String {
        switch self {
        case .all: return "全体"
        case .protocols: return "判断プロトコル"
        case .project: return "PJ知識"
        case .people: return "人と実行力"
        case .meeting: return "MTG記憶"
        case .signal: return "経営ハイライト"
        case .readiness: return "Readiness根拠"
        case .monthly: return "月次断面"
        case .textbook: return "教科書化"
        }
    }
}

struct AMDOSParityKnowledgeMapView: View {
    @StateObject private var store = AMDOSParityKnowledgeStore()
    @State private var tab: AMDOSParityMaterialsTab = .overview
    @State private var materialQuery = ""
    @State private var knowledgeQuery = ""
    @State private var knowledgeDomain: AMDOSParityKnowledgeDomain = .all
    @State private var heatAxis = "heat"
    @State private var selectedMaterial: AMDOSMaterialItem?
    @State private var materialDetailOpen = false
    @State private var compareIDs: [String] = []

    private var allMaterials: [AMDOSMaterialItem] {
        let primary = store.materials.materials
        if !primary.isEmpty { return primary }
        return store.materials.elements.compactMap(\.detail) + store.materials.minerals + store.materials.polymers
    }

    private var selectedCompareItems: [AMDOSMaterialItem] {
        compareIDs.compactMap { id in allMaterials.first { $0.stableID == id } }
            .sorted { materialTotal($0) > materialTotal($1) }
    }

    private var filteredMaterials: [AMDOSMaterialItem] {
        guard let query = materialQuery.trimmedNonEmpty else { return allMaterials }
        return allMaterials.filter { materialSearchText($0).localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "KNOWLEDGE MAP",
            title: "AMD Materials / Knowledge Map",
            subtitle: "PWAと同じ材料台帳・118元素・知識ノードを、読み取り専用で横断する"
        ) {
            materialsHeader
            Picker("表示", selection: $tab) {
                ForEach(AMDOSParityMaterialsTab.allCases) { tab in
                    Label(tab.label, systemImage: tab.image).tag(tab)
                }
            }
            .pickerStyle(.segmented)

            AMDOSStateNotice(state: store.state) { Task { await store.load() } }

            if !compareIDs.isEmpty && tab != .compare { compareTray }

            switch tab {
            case .overview: overviewView
            case .elements: elementsView
            case .minerals: catalogueView(title: "鉱物・鉱石・原料", subtitle: "採掘形態・副産物構造・精製工程を、PWAと同じ材料台帳から確認する。", items: store.materials.minerals)
            case .polymers: catalogueView(title: "樹脂・高分子", subtitle: "原料、物性、用途、規制、循環性を一続きの材料の流れとして見る。", items: store.materials.polymers)
            case .map: knowledgeMapView
            case .compare: compareView
            }
        }
        .sheet(isPresented: $materialDetailOpen) {
            if let selectedMaterial {
                AMDOSParityMaterialDetailSheet(
                    item: selectedMaterial,
                    isCompared: compareIDs.contains(selectedMaterial.stableID),
                    compareFull: compareIDs.count >= 4,
                    onToggleCompare: { toggleCompare(selectedMaterial.stableID) }
                )
            }
        }
        .task { await store.load() }
    }

    @ViewBuilder
    private var materialsHeader: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 18) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("AMD / 世界の材料データベース")
                            .font(.caption.monospaced().weight(.semibold))
                            .foregroundStyle(AMDOSDesign.muted)
                        Text("元素から製品まで、世界の材料事情をつかむ。")
                            .font(.title2.weight(.bold))
                        Text("周期表、鉱物・鉱石、樹脂・高分子を、需要・供給不安・代替のしやすさ・再利用・AMDとの接点で横断する。未評価を低評価として扱わない。")
                            .font(.caption)
                            .foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer(minLength: 0)
                    HStack(spacing: 8) {
                        AMDOSMetricTile(label: "元素", value: "\(store.materials.elements.compactMap(\.detail).count) / \(store.materials.elements.count)", detail: "評価済み / 全元素", tint: AMDOSDesign.blue)
                        AMDOSMetricTile(label: "鉱物・原料", value: "\(store.materials.minerals.count)", detail: "材料チェーン", tint: AMDOSDesign.warning)
                        AMDOSMetricTile(label: "樹脂", value: "\(store.materials.polymers.count)", detail: "高分子", tint: AMDOSDesign.success)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var overviewView: some View {
        let imbalanced = allMaterials
            .filter { $0.supplyDemand?.direction != "おおむね均衡" }
            .sorted {
                let left = $0.supplyDemand
                let right = $1.supplyDemand
                if (left?.severity ?? 0) != (right?.severity ?? 0) { return (left?.severity ?? 0) > (right?.severity ?? 0) }
                return ($0.scores?["supplyRisk"] ?? 0) > ($1.scores?["supplyRisk"] ?? 0)
            }
            .prefix(10)

        AMDOSSectionCard("需給の崩れランキング", systemImage: "chart.bar.xaxis") {
            Text("不足だけでなく、供給過剰や価格乱高下も「需給の崩れ」に含める。評価の根拠と詰まる工程まで同じ材料データから読む。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            if imbalanced.isEmpty {
                Text("材料の初期評価を読み込み中だよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(Array(imbalanced.enumerated()), id: \.element.stableID) { index, item in
                    Button { openDetail(item) } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Text("\(index + 1)").font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.muted).frame(width: 22, alignment: .leading)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(materialName(item)).font(.subheadline.weight(.semibold))
                                Text(item.supplyDemand?.cause ?? item.summary ?? "評価理由なし")
                                    .font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                                Text("詰まる工程: \(item.supplyDemand?.bottleneck ?? "未評価")")
                                    .font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(1)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                AMDOSStatusBadge(text: item.supplyDemand?.direction ?? "未評価", tint: materialHeatColor(item.supplyDemand?.severity))
                                Text("偏り \(item.supplyDemand?.severity ?? 0)/5 · \(item.supplyDemand?.confidence ?? "—")")
                                    .font(.caption2.monospacedDigit()).foregroundStyle(AMDOSDesign.muted)
                            }
                        }
                        .padding(.vertical, 5)
                    }
                    .buttonStyle(.plain)
                }
            }
        }

        AMDOSSectionCard("材料の入口", systemImage: "square.grid.3x3") {
            HStack(alignment: .top, spacing: 12) {
                materialFamilyEntry(icon: "atom", kicker: "評価済み \(store.materials.elements.compactMap(\.detail).count) / 全\(store.materials.elements.count)元素", title: "元素周期表", text: "4つの評価軸で全体を走査する。", tab: .elements)
                materialFamilyEntry(icon: "diamond", kicker: "\(store.materials.minerals.count) 原料", title: "鉱物・鉱石", text: "原料から用途まで追う。", tab: .minerals)
                materialFamilyEntry(icon: "testtube.2", kicker: "\(store.materials.polymers.count) 樹脂", title: "樹脂・高分子", text: "原料・作り方・循環性を比較する。", tab: .polymers)
            }
        }

        AMDOSSectionCard("注目材料", systemImage: "sparkles") {
            let leaders = allMaterials.sorted { materialTotal($0) > materialTotal($1) }.prefix(8)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 10)], spacing: 10) {
                ForEach(leaders, id: \.stableID) { item in
                    Button { openDetail(item) } label: {
                        VStack(alignment: .leading, spacing: 7) {
                            HStack { Text(materialName(item)).font(.headline); Spacer(); Text("\(materialTotal(item))/20").font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.muted) }
                            Text(item.summary ?? "評価の要約なし").font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                            HStack(spacing: 5) { scorePill(item, "heat"); scorePill(item, "demand"); scorePill(item, "supplyRisk"); scorePill(item, "amdFit") }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(AMDOSDesign.muted.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private var elementsView: some View {
        AMDOSSectionCard("元素周期表", systemImage: "atom") {
            Picker("評価軸", selection: $heatAxis) {
                Text("注目度").tag("heat")
                Text("需要").tag("demand")
                Text("供給不安").tag("supplyRisk")
                Text("AMD相性").tag("amdFit")
            }
            .pickerStyle(.segmented)
            Text("評価済みの元素は選んで詳細を開ける。淡色の元素は未評価で、低評価という意味ではない。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(minimum: 28), spacing: 3), count: 18), spacing: 3) {
                ForEach(store.materials.elements.sorted { $0.atomicNumber < $1.atomicNumber }) { element in
                    let detail = element.detail
                    Button {
                        if let detail { openDetail(detail) }
                    } label: {
                        VStack(spacing: 1) {
                            Text("\(element.atomicNumber)").font(.system(size: 7, design: .monospaced)).foregroundStyle(.secondary)
                            Text(element.symbol).font(.caption.weight(.bold))
                            if let value = detail?.scores?[heatAxis] { Text("\(value)").font(.system(size: 8, design: .monospaced)) }
                        }
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .foregroundStyle(detail == nil ? AMDOSDesign.muted : .white)
                        .background(materialHeatColor(detail?.scores?[heatAxis]), in: RoundedRectangle(cornerRadius: 5))
                        .opacity(detail == nil ? 0.42 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(detail == nil)
                    .help([element.name, element.glanceUse, element.supplyAlert].compactMap { $0 }.joined(separator: " · "))
                }
            }
            HStack(spacing: 10) {
                ForEach(1...5, id: \.self) { value in
                    HStack(spacing: 4) { Circle().fill(materialHeatColor(value)).frame(width: 9, height: 9); Text("\(value)").font(.caption2) }
                }
                Text("未評価は灰色").font(.caption2).foregroundStyle(AMDOSDesign.muted)
            }
        }
    }

    @ViewBuilder
    private func catalogueView(title: String, subtitle: String, items: [AMDOSMaterialItem]) -> some View {
        TextField("名前・原料・用途・供給国で検索", text: $materialQuery).textFieldStyle(.roundedBorder)
        AMDOSSectionCard(title, systemImage: "square.stack.3d.up") {
            Text(subtitle).font(.caption).foregroundStyle(AMDOSDesign.muted)
            let rows = items.filter { item in
                guard let query = materialQuery.trimmedNonEmpty else { return true }
                return materialSearchText(item).localizedCaseInsensitiveContains(query)
            }
            if rows.isEmpty {
                Text("該当する材料がないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(rows, id: \.stableID) { item in
                    Button { openDetail(item) } label: {
                        HStack(alignment: .top, spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(materialName(item)).font(.subheadline.weight(.semibold))
                                Text(item.summary ?? "要約なし").font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                                Text((item.uses ?? []).prefix(3).joined(separator: " / ")).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(1)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 5) {
                                Text("\(materialTotal(item))/20").font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.muted)
                                HStack(spacing: 4) { scorePill(item, "demand"); scorePill(item, "supplyRisk") }
                            }
                        }
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private var compareTray: some View {
        AMDOSSectionCard("比較トレイ", systemImage: "rectangle.split.3x1") {
            HStack {
                Text("最大4件を同じ4軸で比較する。\(compareIDs.count)/4件を選択中。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("比較を開く") { tab = .compare }.buttonStyle(.borderedProminent)
            }
            HStack(spacing: 7) {
                ForEach(selectedCompareItems, id: \.stableID) { item in
                    Button("\(materialName(item)) ×") { toggleCompare(item.stableID) }.buttonStyle(.bordered)
                }
            }
        }
    }

    @ViewBuilder
    private var compareView: some View {
        AMDOSSectionCard("材料比較", systemImage: "rectangle.split.3x1") {
            if selectedCompareItems.isEmpty {
                Text("元素・鉱物・樹脂の詳細から最大4件を比較トレイに追加してね。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            } else {
                Text("同じ4軸と、需給・循環性・AMD適合を横に並べる。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                ForEach(selectedCompareItems, id: \.stableID) { item in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack { Button(materialName(item)) { openDetail(item) }.buttonStyle(.link).font(.headline); Spacer(); Button("外す") { toggleCompare(item.stableID) }.buttonStyle(.bordered) }
                        HStack(spacing: 7) { scorePill(item, "heat"); scorePill(item, "demand"); scorePill(item, "supplyRisk"); scorePill(item, "amdFit") }
                        Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 5) {
                            GridRow { Text("需給").foregroundStyle(AMDOSDesign.muted); Text(item.supplyDemand?.direction ?? "未評価") }
                            GridRow { Text("供給国").foregroundStyle(AMDOSDesign.muted); Text((item.supplyCountries ?? []).joined(separator: " / ").trimmedNonEmpty ?? "未登録") }
                            GridRow { Text("循環性").foregroundStyle(AMDOSDesign.muted); Text(item.circularity ?? "未登録") }
                            GridRow { Text("AMD相性").foregroundStyle(AMDOSDesign.muted); Text(item.amdFitNote ?? "未登録") }
                        }
                        Divider()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var knowledgeMapView: some View {
        let knowledgeNodeCount = store.protocols.count
            + store.projectFacts.count
            + store.memberFacts.count
            + store.meetings.count
            + store.signals.count
            + store.xrl.count
            + store.reports.count
            + store.textbooks.count
        AMDOSSectionCard("AMDノウハウ", systemImage: "point.3.connected.trianglepath.dotted") {
            Text("PWAのKnowledge Mapと同じ、Protocol・PJ知識・人・MTG・Signal・XRL・月次・教科書化候補を一つの地図として読む。raw全文は入れない。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            HStack(spacing: 8) {
                AMDOSMetricTile(label: "L2ノード", value: "\(knowledgeNodeCount)", detail: "構造化知識")
                AMDOSMetricTile(label: "PJ知識", value: "\(store.projectFacts.count)", detail: "active")
                AMDOSMetricTile(label: "確認待ち", value: "\(store.signals.filter { $0.status == "candidate" }.count)", detail: "signal")
            }
        }
        Picker("ノード領域", selection: $knowledgeDomain) {
            ForEach(AMDOSParityKnowledgeDomain.allCases) { domain in Text(domain.label).tag(domain) }
        }
        .pickerStyle(.segmented)
        TextField("知識項目・PJ・本文を検索", text: $knowledgeQuery).textFieldStyle(.roundedBorder)

        if knowledgeDomain == .all || knowledgeDomain == .protocols {
            knowledgeSection("判断プロトコル", systemImage: "list.number", items: store.protocols.filter { knowledgeMatches([$0.title, $0.content]) }.map { ("\($0.title)", $0.content ?? "", $0.status ?? "") })
        }
        if knowledgeDomain == .all || knowledgeDomain == .project {
            knowledgeSection("PJ知識", systemImage: "folder.fill", items: store.projectFacts.filter { knowledgeMatches([$0.projectID, $0.entityName, $0.factText]) }.map { ("\($0.projectID) / \($0.entityName)", $0.factText ?? $0.category, $0.confidence ?? $0.status ?? "") })
        }
        if knowledgeDomain == .all || knowledgeDomain == .people {
            knowledgeSection("人と実行力", systemImage: "person.2.fill", items: store.memberFacts.filter { knowledgeMatches([$0.codeName, $0.category, $0.summary]) }.map { ("\($0.codeName) / \($0.category)", $0.summary ?? "", $0.status) })
        }
        if knowledgeDomain == .all || knowledgeDomain == .meeting {
            knowledgeSection("MTG記憶", systemImage: "person.3.fill", items: store.meetings.filter { knowledgeMatches([$0.projectID, $0.title, $0.summary]) }.map { ("\($0.projectID) / \($0.title)", $0.summary, $0.date) })
        }
        if knowledgeDomain == .all || knowledgeDomain == .signal {
            knowledgeSection("経営ハイライト", systemImage: "exclamationmark.bubble", items: store.signals.filter { knowledgeMatches([$0.projectID, $0.title, $0.summary]) }.map { ("\($0.projectID) / \($0.title)", $0.summary, "\($0.impactLevel) · \($0.status)") })
        }
        if knowledgeDomain == .all || knowledgeDomain == .readiness {
            knowledgeSection("Readiness根拠", systemImage: "scope", items: store.xrl.filter { knowledgeMatches([$0.projectID, $0.axis, $0.summary]) }.map { ("\($0.projectID) / \($0.axis)", $0.summary, $0.kind) })
        }
        if knowledgeDomain == .all || knowledgeDomain == .monthly {
            knowledgeSection("月次断面", systemImage: "calendar", items: store.reports.filter { knowledgeMatches([$0.projectID, $0.ym, $0.status]) }.map { ("\($0.projectID) / \($0.ym)", "月次レポート", $0.status ?? "pending") })
        }
        if knowledgeDomain == .all || knowledgeDomain == .textbook {
            knowledgeSection("教科書化", systemImage: "book.closed", items: store.textbooks.filter { knowledgeMatches([$0.topic, $0.title, $0.targetID]) }.map { ("\($0.topic) / \($0.title)", $0.targetID, "\($0.status) · 優先度 \(Int($0.priority))") })
        }
    }

    @ViewBuilder
    private func materialFamilyEntry(icon: String, kicker: String, title: String, text: String, tab: AMDOSParityMaterialsTab) -> some View {
        Button { self.tab = tab } label: {
            VStack(alignment: .leading, spacing: 6) {
                Label(kicker, systemImage: icon).font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.blue)
                Text(title).font(.headline)
                Text(text).font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(AMDOSDesign.blue.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func scorePill(_ item: AMDOSMaterialItem, _ axis: String) -> some View {
        let value = item.scores?[axis]
        Text("\(materialAxisLabel(axis)) \(value.map(String.init) ?? "—")")
            .font(.caption2.monospacedDigit())
            .padding(.horizontal, 6).padding(.vertical, 3)
            .foregroundStyle(value == nil ? AMDOSDesign.muted : .white)
            .background(materialHeatColor(value), in: Capsule())
    }

    @ViewBuilder
    private func knowledgeSection(_ title: String, systemImage: String, items: [(String, String, String)]) -> some View {
        AMDOSSectionCard(title, systemImage: systemImage) {
            if items.isEmpty {
                Text("該当する正本データはないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(Array(items.prefix(12).enumerated()), id: \.offset) { _, item in
                    AMDOSLineItem(title: item.0, subtitle: item.1, status: item.2)
                }
                if items.count > 12 { Text("ほか \(items.count - 12) 件").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            }
        }
    }

    private func openDetail(_ item: AMDOSMaterialItem) {
        selectedMaterial = item
        materialDetailOpen = true
    }

    private func toggleCompare(_ id: String) {
        if let index = compareIDs.firstIndex(of: id) {
            compareIDs.remove(at: index)
        } else if compareIDs.count < 4 {
            compareIDs.append(id)
        }
    }

    private func materialSearchText(_ item: AMDOSMaterialItem) -> String {
        ([item.name, item.symbol, item.code, item.summary, item.amdFitNote, item.balance, item.circularity, item.reserves]
            .compactMap { $0 } + (item.properties ?? []) + (item.uses ?? []) + (item.supplyCountries ?? []) + (item.chain ?? []))
            .joined(separator: " ")
    }

    private func materialName(_ item: AMDOSMaterialItem) -> String { item.name ?? item.code ?? item.symbol ?? "材料" }
    private func materialTotal(_ item: AMDOSMaterialItem) -> Int { (item.scores ?? [:]).values.reduce(0, +) }
    private func materialAxisLabel(_ axis: String) -> String { ["heat": "注目", "demand": "需要", "supplyRisk": "供給", "amdFit": "AMD"][axis] ?? axis }
    private func materialHeatColor(_ value: Int?) -> Color {
        switch value ?? 0 {
        case 5: return Color(red: 0.88, green: 0.0, blue: 0.17)
        case 4: return Color(red: 0.92, green: 0.31, blue: 0.08)
        case 3: return Color(red: 0.94, green: 0.55, blue: 0.04)
        case 2: return Color(red: 0.34, green: 0.58, blue: 0.63)
        case 1: return Color(red: 0.42, green: 0.48, blue: 0.47)
        default: return AMDOSDesign.muted.opacity(0.35)
        }
    }
    private func knowledgeMatches(_ values: [String?]) -> Bool {
        guard let query = knowledgeQuery.trimmedNonEmpty else { return true }
        return values.compactMap { $0 }.joined(separator: " ").localizedCaseInsensitiveContains(query)
    }
}

private struct AMDOSParityMaterialDetailSheet: View {
    let item: AMDOSMaterialItem
    let isCompared: Bool
    let compareFull: Bool
    let onToggleCompare: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.name ?? item.code ?? item.symbol ?? "材料").font(.title2.weight(.bold))
                        Text([item.code, item.family, item.category].compactMap { $0 }.joined(separator: " · "))
                            .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer()
                    Button(isCompared ? "比較から外す" : compareFull ? "比較は4件まで" : "比較に追加") { onToggleCompare() }
                        .buttonStyle(.borderedProminent)
                        .disabled(!isCompared && compareFull)
                }

                Text(item.summary ?? "要約なし").textSelection(.enabled)
                if let chain = item.chain, !chain.isEmpty {
                    detailSection("材料の流れ") { Text(chain.joined(separator: "  →  ")).font(.caption).textSelection(.enabled) }
                }
                detailSection("4軸の初期評価") {
                    Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                        ForEach(["heat", "demand", "supplyRisk", "amdFit"], id: \.self) { axis in
                            GridRow {
                                Text(["heat": "注目度", "demand": "需要", "supplyRisk": "供給不安", "amdFit": "AMD相性"][axis] ?? axis).foregroundStyle(AMDOSDesign.muted)
                                Text(item.scores?[axis].map { "\($0)/5" } ?? "未評価").font(.body.monospacedDigit())
                                Text(item.scoreReasons?[axis] ?? "根拠未登録").font(.caption).foregroundStyle(AMDOSDesign.muted)
                            }
                        }
                    }
                }
                if let supplyDemand = item.supplyDemand {
                    detailSection("需給の状況") {
                        Text("\(supplyDemand.direction) · 偏り \(supplyDemand.severity)/5 · 確からしさ \(supplyDemand.confidence) · \(supplyDemand.asOf)").font(.caption.weight(.semibold))
                        Text(supplyDemand.cause).textSelection(.enabled)
                        Text("詰まる工程: \(supplyDemand.bottleneck)").font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
                    }
                }
                detailSection("材料特性") {
                    detailRow("性質", (item.properties ?? []).joined(separator: " / "))
                    detailRow("主な用途", (item.uses ?? []).joined(separator: " / "))
                    detailRow("主な供給国", (item.supplyCountries ?? []).joined(separator: " / "))
                    detailRow("埋蔵", item.reserves ?? "未登録")
                    detailRow("需給", item.balance ?? "未登録")
                    detailRow("循環性", item.circularity ?? "未登録")
                    detailRow("AMDとの接点", item.amdFitNote ?? "未登録")
                }
                if let manufacturing = item.manufacturing {
                    detailSection("原料と作り方") {
                        detailRow("原料", manufacturing.feedstock)
                        detailRow("工程", manufacturing.process)
                    }
                }
                if let market = item.market {
                    detailSection("市場・供給") {
                        detailRow("指標", "\(market.benchmark) / \(market.unit)")
                        detailRow("メモ", market.note)
                        detailRow("供給の根拠", market.supplyBasis)
                        if !market.supplyShares.isEmpty {
                            Text(market.supplyShares.map { "\($0.country) \(Int($0.share.rounded()))%" }.joined(separator: " / "))
                                .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                }
                if let sources = item.sources, !sources.isEmpty {
                    detailSection("出典") {
                        ForEach(sources) { source in
                            if let url = URL(string: source.href) {
                                Link(destination: url) { Label("\(source.label) · \(source.asOf)", systemImage: "arrow.up.right.square") }.font(.caption)
                            } else {
                                Text("\(source.label) · \(source.asOf)").font(.caption)
                            }
                        }
                    }
                }
                if let reviewed = item.lastReviewed { Text("最終確認: \(reviewed)").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
            }
            .padding(22)
            .frame(minWidth: 560, maxWidth: 760, alignment: .leading)
        }
    }

    @ViewBuilder
    private func detailSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(AMDOSDesign.muted.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func detailRow(_ label: String, _ value: String) -> some View {
        if !value.isEmpty {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                Text(value).font(.caption).textSelection(.enabled)
            }
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

// MARK: - VC parity

private struct AMDOSParityVCBase: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let nameEn: String?
    let slug: String?
    let type: String?
    let thesis: String?
    let stageFocus: [String]?
    let ticketMin: Double?
    let ticketMax: Double?
    let hq: String?
    let website: String?
    let logoURL: String?
    let notes: String?
    let investmentConstraints: String?
    let amdRating: Int?
    let amdRatingNote: String?
    let amdRatingUpdatedBy: String?
    let amdRatingUpdatedAt: String?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, name, nameEn = "name_en", slug, type, thesis, stageFocus = "stage_focus"
        case ticketMin = "ticket_min_jpy", ticketMax = "ticket_max_jpy", hq, website, logoURL = "logo_url", notes
        case investmentConstraints = "investment_constraints"
        case amdRating = "amd_rating", amdRatingNote = "amd_rating_note", amdRatingUpdatedBy = "amd_rating_updated_by", amdRatingUpdatedAt = "amd_rating_updated_at", updatedAt = "updated_at"
    }
}

private struct AMDOSParityVCFundRow: Codable, Identifiable, Sendable {
    let id: String
    let vcId: String
    let fundNo: Int
    let name: String?
    let size: Double?
    let sizeLow: Double?
    let sizeHigh: Double?
    let vintageYear: Int?
    let status: String?
    let firstCloseAt: String?
    let finalCloseAt: String?
    let targetCloseAt: String?
    let dryPowderLow: Double?
    let dryPowderHigh: Double?
    let dryPowderSource: String?
    let dryPowderHeardFrom: String?
    let dryPowderNote: String?
    let dryPowderUpdatedAt: String?
    let sourceURL: String?
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case id, vcId = "vc_id", fundNo = "fund_no", name
        case size = "size_jpy", sizeLow = "size_jpy_low", sizeHigh = "size_jpy_high"
        case vintageYear = "vintage_year", status
        case firstCloseAt = "first_close_at", finalCloseAt = "final_close_at", targetCloseAt = "target_close_at"
        case dryPowderLow = "dry_powder_jpy_low", dryPowderHigh = "dry_powder_jpy_high"
        case dryPowderSource = "dry_powder_source", dryPowderHeardFrom = "dry_powder_heard_from", dryPowderNote = "dry_powder_note", dryPowderUpdatedAt = "dry_powder_updated_at"
        case sourceURL = "source_url", notes
    }
}

private struct AMDOSParityVCInvestmentRow: Codable, Identifiable, Sendable {
    let id: String
    let vcId: String
    let fundId: String?
    let targetCompany: String
    let targetCompanyEn: String?
    let ourProjectId: String?
    let amount: Double?
    let round: String?
    let investedAt: String?
    let isLead: Bool?
    let sourceURL: String?
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case id, vcId = "vc_id", fundId = "fund_id", targetCompany = "target_company", targetCompanyEn = "target_company_en"
        case ourProjectId = "our_project_id", amount = "amount_jpy", round, investedAt = "invested_at", isLead = "is_lead", sourceURL = "source_url", notes
    }
}

private struct AMDOSParityVCContactRow: Codable, Identifiable, Sendable {
    let id: String
    let vcId: String
    let name: String
    let role: String?
    let email: String?
    let phone: String?
    let linkedin: String?
    let notes: String?
    enum CodingKeys: String, CodingKey { case id, vcId = "vc_id", name, role, email, phone, linkedin, notes }
}

private struct AMDOSParityVCRelationRow: Codable, Identifiable, Sendable {
    let id: String
    let vcId: String
    let projectId: String
    let status: String
    let lastTouchAt: String?
    let vcContactId: String?
    let amdOwnerMemberId: String?
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case id, vcId = "vc_id", projectId = "project_id", status, lastTouchAt = "last_touch_at", vcContactId = "vc_contact_id", amdOwnerMemberId = "amd_owner_member_id", notes
    }
}

private struct AMDOSParityVCNewsRow: Codable, Identifiable, Sendable {
    let id: String
    let vcId: String
    let title: String
    let body: String?
    let kind: String
    let occurredOn: String?
    let sourceURL: String?
    let ingestedBy: String?
    let verified: Bool
    let dismissed: Bool
    let suggestedFundPatch: AMDOSParityVCFundPatch?
    enum CodingKeys: String, CodingKey {
        case id, vcId = "vc_id", title, body, kind, occurredOn = "occurred_on", sourceURL = "source_url", ingestedBy = "ingested_by", verified, dismissed, suggestedFundPatch = "suggested_fund_patch"
    }
}

private struct AMDOSParityVCFundPatch: Codable, Sendable {
    let fundNo: Int?
    let status: String?
    let size: Double?
    let sizeLow: Double?
    let sizeHigh: Double?
    let targetCloseAt: String?
    let finalCloseAt: String?
    let firstCloseAt: String?
    let vintageYear: Int?
    let sourceURL: String?
    enum CodingKeys: String, CodingKey {
        case fundNo = "fund_no", status, size = "size_jpy", sizeLow = "size_jpy_low", sizeHigh = "size_jpy_high", targetCloseAt = "target_close_at", finalCloseAt = "final_close_at", firstCloseAt = "first_close_at", vintageYear = "vintage_year", sourceURL = "source_url"
    }
}

private struct AMDOSParityVCPatch: Encodable, Sendable {
    let name: String?
    let nameEn: String?
    let slug: String?
    let type: String?
    let thesis: String?
    let stageFocus: [String]?
    let ticketMin: Double?
    let ticketMax: Double?
    let hq: String?
    let website: String?
    let logoURL: String?
    let notes: String?
    let investmentConstraints: String?
    let amdRating: Int?
    let amdRatingNote: String?
    let amdRatingUpdatedBy: String?
    let amdRatingUpdatedAt: String?
    enum CodingKeys: String, CodingKey {
        case name, nameEn = "name_en", slug, type, thesis, stageFocus = "stage_focus", ticketMin = "ticket_min_jpy", ticketMax = "ticket_max_jpy", hq, website, logoURL = "logo_url", notes, investmentConstraints = "investment_constraints", amdRating = "amd_rating", amdRatingNote = "amd_rating_note", amdRatingUpdatedBy = "amd_rating_updated_by", amdRatingUpdatedAt = "amd_rating_updated_at"
    }
}

private struct AMDOSParityVCFundWrite: Encodable, Sendable {
    let vcId: String
    let fundNo: Int
    let name: String?
    let size: Double?
    let sizeLow: Double?
    let sizeHigh: Double?
    let status: String
    let vintageYear: Int?
    let firstCloseAt: String?
    let finalCloseAt: String?
    let targetCloseAt: String?
    let dryPowderLow: Double?
    let dryPowderHigh: Double?
    let dryPowderSource: String?
    let dryPowderHeardFrom: String?
    let dryPowderNote: String?
    let dryPowderUpdatedAt: String?
    let sourceURL: String?
    enum CodingKeys: String, CodingKey {
        case vcId = "vc_id", fundNo = "fund_no", name, size = "size_jpy", sizeLow = "size_jpy_low", sizeHigh = "size_jpy_high", status, vintageYear = "vintage_year", firstCloseAt = "first_close_at", finalCloseAt = "final_close_at", targetCloseAt = "target_close_at", dryPowderLow = "dry_powder_jpy_low", dryPowderHigh = "dry_powder_jpy_high", dryPowderSource = "dry_powder_source", dryPowderHeardFrom = "dry_powder_heard_from", dryPowderNote = "dry_powder_note", dryPowderUpdatedAt = "dry_powder_updated_at", sourceURL = "source_url"
    }
}

private struct AMDOSParityVCInvestmentWrite: Encodable, Sendable {
    let vcId: String
    let targetCompany: String
    let targetCompanyEn: String?
    let fundId: String?
    let ourProjectId: String?
    let amount: Double?
    let round: String?
    let investedAt: String?
    let isLead: Bool?
    let sourceURL: String?
    let notes: String?
    enum CodingKeys: String, CodingKey { case vcId = "vc_id", targetCompany = "target_company", targetCompanyEn = "target_company_en", fundId = "fund_id", ourProjectId = "our_project_id", amount = "amount_jpy", round, investedAt = "invested_at", isLead = "is_lead", sourceURL = "source_url", notes }
}

private struct AMDOSParityVCContactWrite: Encodable, Sendable {
    let vcId: String
    let name: String
    let role: String?
    let email: String?
    let phone: String?
    let linkedin: String?
    let notes: String?
    enum CodingKeys: String, CodingKey { case vcId = "vc_id", name, role, email, phone, linkedin, notes }
}

private struct AMDOSParityVCRelationWrite: Encodable, Sendable {
    let vcId: String
    let projectId: String
    let status: String
    let vcContactId: String?
    let lastTouchAt: String?
    let notes: String?
    enum CodingKeys: String, CodingKey { case vcId = "vc_id", projectId = "project_id", status, vcContactId = "vc_contact_id", lastTouchAt = "last_touch_at", notes }
}

private struct AMDOSParityVCProject: Codable, Identifiable, Sendable {
    let projectId: String
    let name: String
    var id: String { projectId }
    enum CodingKeys: String, CodingKey { case projectId = "project_id", name = "project_name" }
}

private struct AMDOSParityVCListItem: Identifiable, Sendable {
    let id: String
    let base: AMDOSParityVCBase
    let activeFund: AMDOSParityVCFundRow?
    let fundCount: Int
    let dryPowderLow: Double?
    let dryPowderHigh: Double?
    let investmentProjects: [(id: String, name: String, amount: Double?)]
    let contactProjects: [(id: String, name: String, status: String, contacts: [String], lastTouchAt: String?)]
    let relationCount: Int
    let lastTouchAt: String?
    let unverifiedNewsCount: Int
}

@MainActor
private final class AMDOSParityVCStore: ObservableObject {
    @Published var vcs: [AMDOSParityVCBase] = []
    @Published var funds: [AMDOSParityVCFundRow] = []
    @Published var investments: [AMDOSParityVCInvestmentRow] = []
    @Published var contacts: [AMDOSParityVCContactRow] = []
    @Published var relations: [AMDOSParityVCRelationRow] = []
    @Published var news: [AMDOSParityVCNewsRow] = []
    @Published var projects: [AMDOSParityVCProject] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?

    func load() async {
        state = .loading
        do {
            async let vcs = AMDOSRESTClient.shared.fetchTable(AMDOSParityVCBase.self, table: "vcs", select: "*", order: "amd_rating.desc.nullslast", limit: 500)
            async let funds = AMDOSRESTClient.shared.fetchTable(AMDOSParityVCFundRow.self, table: "vc_funds", select: "*", order: "fund_no", limit: 1_000)
            async let investments = AMDOSRESTClient.shared.fetchTable(AMDOSParityVCInvestmentRow.self, table: "vc_investments", select: "*", order: "invested_at.desc.nullslast", limit: 2_000)
            async let contacts = AMDOSRESTClient.shared.fetchTable(AMDOSParityVCContactRow.self, table: "vc_contacts", select: "*", order: "name", limit: 1_000)
            async let relations = AMDOSRESTClient.shared.fetchTable(AMDOSParityVCRelationRow.self, table: "project_vc_relations", select: "*", order: "last_touch_at.desc.nullslast", limit: 2_000)
            async let news = AMDOSRESTClient.shared.fetchTable(AMDOSParityVCNewsRow.self, table: "vc_news", select: "*", order: "occurred_on.desc.nullslast", limit: 2_000)
            async let projects = AMDOSRESTClient.shared.fetchTable(AMDOSParityVCProject.self, table: "projects", select: "project_id,project_name", order: "project_name", limit: 1_000)
            self.vcs = try await vcs
            self.funds = try await funds
            self.investments = try await investments
            self.contacts = try await contacts
            self.relations = try await relations
            self.news = try await news
            self.projects = try await projects
            state = self.vcs.isEmpty ? .empty : .loaded
        } catch { state = .failed(error.localizedDescription) }
    }

    func projectName(_ id: String) -> String { projects.first(where: { $0.id == id })?.name ?? id }

    func listItems() -> [AMDOSParityVCListItem] {
        vcs.map { vc in
            let vcFunds = funds.filter { $0.vcId == vc.id }
            let active = vcFunds.filter { ["raising", "investing", "first_closed", "final_closed"].contains($0.status) }.max { ($0.fundNo) < ($1.fundNo) }
            let dpLow = vcFunds.filter { ["raising", "investing", "first_closed", "final_closed"].contains($0.status) }.compactMap(\.dryPowderLow).reduce(nil) { ($0 ?? 0) + $1 }
            let dpHigh = vcFunds.filter { ["raising", "investing", "first_closed", "final_closed"].contains($0.status) }.compactMap(\.dryPowderHigh).reduce(nil) { ($0 ?? 0) + $1 }
            let investments = investments.filter { $0.vcId == vc.id && $0.ourProjectId != nil }.map { ($0.ourProjectId!, projectName($0.ourProjectId!), $0.amount) }.sorted { ($0.2 ?? -1) > ($1.2 ?? -1) }
            let investedIds = Set(investments.map(\.0))
            let contactMap = Dictionary(grouping: contacts.filter { $0.vcId == vc.id }, by: { $0.id }).mapValues { $0.first?.name ?? "" }
            let grouped = Dictionary(grouping: relations.filter { $0.vcId == vc.id }, by: { $0.projectId })
            let contactProjects = grouped.compactMap { projectId, rows -> (id: String, name: String, status: String, contacts: [String], lastTouchAt: String?)? in
                guard !investedIds.contains(projectId) else { return nil }
                let names = rows.compactMap { $0.vcContactId.flatMap { contactMap[$0] } }
                return (projectId, projectName(projectId), rows.first?.status ?? "未設定", names, rows.compactMap(\.lastTouchAt).max())
            }.sorted { ($0.lastTouchAt ?? "") > ($1.lastTouchAt ?? "") }
            let relationRows = relations.filter { $0.vcId == vc.id }
            return AMDOSParityVCListItem(id: vc.id, base: vc, activeFund: active, fundCount: vcFunds.count, dryPowderLow: dpLow, dryPowderHigh: dpHigh, investmentProjects: investments, contactProjects: contactProjects, relationCount: relationRows.count, lastTouchAt: relationRows.compactMap(\.lastTouchAt).max(), unverifiedNewsCount: news.filter { $0.vcId == vc.id && !$0.verified && !$0.dismissed }.count)
        }
    }

    func saveVC(_ id: String, patch: AMDOSParityVCPatch) async { await perform { _ = try await AMDOSRESTClient.shared.patchTable(table: "vcs", filters: ["id": "eq.\(id)"], body: patch) } }
    func saveFund(_ fund: AMDOSParityVCFundWrite, id: String? = nil) async { await perform { if let id { _ = try await AMDOSRESTClient.shared.patchTable(table: "vc_funds", filters: ["id": "eq.\(id)"], body: fund) } else { _ = try await AMDOSRESTClient.shared.postTable(table: "vc_funds", body: fund) } } }
    func deleteFund(_ id: String) async { await perform { try await AMDOSRESTClient.shared.deleteTable(table: "vc_funds", filters: ["id": "eq.\(id)"]) } }
    func saveInvestment(_ investment: AMDOSParityVCInvestmentWrite, id: String? = nil) async { await perform { if let id { _ = try await AMDOSRESTClient.shared.patchTable(table: "vc_investments", filters: ["id": "eq.\(id)"], body: investment) } else { _ = try await AMDOSRESTClient.shared.postTable(table: "vc_investments", body: investment) } } }
    func deleteInvestment(_ id: String) async { await perform { try await AMDOSRESTClient.shared.deleteTable(table: "vc_investments", filters: ["id": "eq.\(id)"]) } }
    func saveContact(_ contact: AMDOSParityVCContactWrite, id: String? = nil) async { await perform { if let id { _ = try await AMDOSRESTClient.shared.patchTable(table: "vc_contacts", filters: ["id": "eq.\(id)"], body: contact) } else { _ = try await AMDOSRESTClient.shared.postTable(table: "vc_contacts", body: contact) } } }
    func deleteContact(_ id: String) async { await perform { try await AMDOSRESTClient.shared.deleteTable(table: "vc_contacts", filters: ["id": "eq.\(id)"]) } }
    func saveRelation(_ relation: AMDOSParityVCRelationWrite) async { await perform { _ = try await AMDOSRESTClient.shared.postTable(table: "project_vc_relations", body: relation) } }
    func reviewNews(_ id: String, verified: Bool, dismissed: Bool) async { await perform { _ = try await AMDOSRESTClient.shared.patchTable(table: "vc_news", filters: ["id": "eq.\(id)"], body: AMDOSParityVCNewsReview(verified: verified, dismissed: dismissed, updatedAt: ISO8601DateFormatter().string(from: .now))) } }

    private func perform(_ operation: @escaping @Sendable () async throws -> Void) async {
        do { try await operation(); message = "VCデータを保存したよ"; await load() } catch { message = error.localizedDescription }
    }
}

private struct AMDOSParityVCNewsReview: Encodable, Sendable {
    let verified: Bool
    let dismissed: Bool
    let updatedAt: String
    enum CodingKeys: String, CodingKey { case verified, dismissed, updatedAt = "updated_at" }
}

struct AMDOSParityVCListView: View {
    let onSelectVC: (String) -> Void
    @StateObject private var store = AMDOSParityVCStore()
    @State private var search = ""
    @State private var filterType = "all"
    @State private var onlyRaising = false
    @State private var sort = "investment"

    private var rows: [AMDOSParityVCListItem] {
        store.listItems().filter { row in
            let query = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let matchesType = filterType == "all" || row.base.type == filterType
            let matchesStatus = !onlyRaising || row.activeFund?.status == "raising"
            let matchesSearch = query.isEmpty || row.base.name.lowercased().contains(query) || (row.base.nameEn ?? "").lowercased().contains(query) || (row.base.thesis ?? "").lowercased().contains(query)
            return matchesType && matchesStatus && matchesSearch
        }.sorted { left, right in
            switch sort {
            case "name": return left.base.name.localizedStandardCompare(right.base.name) == .orderedAscending
            case "rating": return (left.base.amdRating ?? 0) > (right.base.amdRating ?? 0)
            case "relations": return left.relationCount > right.relationCount
            default: return (left.investmentProjects.map { $0.2 ?? 0 }.reduce(0, +)) > (right.investmentProjects.map { $0.2 ?? 0 }.reduce(0, +))
            }
        }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "VC", title: "VC List", subtitle: "PWA fetchVcListと同じく、VC・ファンド・AMD PJ出資・コンタクト・接触日・未確認ニュースを集約") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            HStack {
                TextField("名前 / テーゼで検索", text: $search).textFieldStyle(.roundedBorder)
                Picker("type", selection: $filterType) { Text("全type").tag("all"); ForEach(Array(Set(store.vcs.compactMap(\.type)).sorted()), id: \.self) { Text($0).tag($0) } }.frame(width: 170)
                Toggle("募集中のみ", isOn: $onlyRaising).toggleStyle(.checkbox)
                Picker("並び", selection: $sort) { Text("AMD PJ出資額").tag("investment"); Text("評価").tag("rating"); Text("接点数").tag("relations"); Text("名前").tag("name") }.frame(width: 180)
                Spacer()
                Text("\(rows.count) / \(store.vcs.count)").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            if rows.isEmpty && store.state == .loaded {
                Text("該当するVCがありません").foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(rows) { row in AMDOSParityVCListRowView(row: row) { onSelectVC(row.id) } }
            }
        }
        .task { await store.load() }
    }
}

private struct AMDOSParityVCListRowView: View {
    let row: AMDOSParityVCListItem
    let onOpen: () -> Void
    var body: some View {
        Button(action: onOpen) {
            AMDOSCard {
                VStack(alignment: .leading, spacing: 9) {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) { Text(row.base.name).font(.headline); Text([row.base.type, row.base.hq].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        Spacer()
                        Text(row.base.amdRating.map { String(repeating: "★", count: $0) + String(repeating: "☆", count: max(0, 5 - $0)) } ?? "未評価").foregroundStyle(.orange)
                    }
                    HStack(alignment: .top, spacing: 18) {
                        AMDOSParityVCValue(label: "active fund", value: row.activeFund.map { "#\($0.fundNo) \($0.status ?? "")" } ?? "—")
                        AMDOSParityVCValue(label: "size", value: currencyRange(row.activeFund?.size ?? row.activeFund?.sizeLow, high: row.activeFund?.sizeHigh))
                        AMDOSParityVCValue(label: "DPE残", value: currencyRange(row.dryPowderLow, high: row.dryPowderHigh))
                        AMDOSParityVCValue(label: "fund#", value: String(row.fundCount))
                        AMDOSParityVCValue(label: "AMD PJ計", value: currency(row.investmentProjects.map { $0.2 ?? 0 }.reduce(0, +)))
                        AMDOSParityVCValue(label: "接点数", value: String(row.relationCount))
                        AMDOSParityVCValue(label: "未確認", value: String(row.unverifiedNewsCount))
                        Spacer()
                    }
                    if let thesis = row.base.thesis?.trimmedNonEmpty { Text(thesis).font(.caption).lineLimit(2) }
                    HStack {
                        if !row.investmentProjects.isEmpty { Text("出資: " + row.investmentProjects.map(\.1).joined(separator: " / ")).font(.caption2) }
                        if !row.contactProjects.isEmpty { Text("接点: " + row.contactProjects.map(\.1).joined(separator: " / ")).font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                        Spacer()
                        Text(row.lastTouchAt?.prefix(10) ?? "最終接触なし").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                }
            }
        }.buttonStyle(.plain)
    }
    private func currency(_ value: Double) -> String { value == 0 ? "—" : currencyRange(value, high: nil) }
    private func currencyRange(_ low: Double?, high: Double?) -> String {
        guard let low = low ?? high else { return "—" }
        func format(_ v: Double) -> String { if v >= 100_000_000 { return String(format: "%.1f億", v / 100_000_000) }; if v >= 10_000 { return String(format: "%.0f万", v / 10_000) }; return String(Int(v)) }
        return high != nil && high != low ? "\(format(low))〜\(format(high!))円" : "\(format(low))円"
    }
}

private struct AMDOSParityVCValue: View {
    let label: String
    let value: String
    var body: some View { VStack(alignment: .leading, spacing: 2) { Text(label).font(.caption2).foregroundStyle(AMDOSDesign.muted); Text(value).font(.caption.monospaced()) }.frame(minWidth: 82, alignment: .leading) }
}

struct AMDOSParityVCDetailView: View {
    let vcId: String?
    @EnvironmentObject private var auth: AMDOSAuthStore
    @StateObject private var store = AMDOSParityVCStore()
    @State private var draftVCId = ""
    @State private var name = ""
    @State private var nameEn = ""
    @State private var slug = ""
    @State private var type = ""
    @State private var thesis = ""
    @State private var stageFocus = ""
    @State private var ticketMin = ""
    @State private var ticketMax = ""
    @State private var hq = ""
    @State private var website = ""
    @State private var logoURL = ""
    @State private var notes = ""
    @State private var constraints = ""
    @State private var rating = ""
    @State private var ratingNote = ""
    @State private var fundEditingID: String?
    @State private var fundNo = ""
    @State private var fundName = ""
    @State private var fundStatus = "unknown"
    @State private var fundSize = ""
    @State private var fundSizeLow = ""
    @State private var fundSizeHigh = ""
    @State private var fundVintage = ""
    @State private var fundFirstCloseAt = ""
    @State private var fundFinalCloseAt = ""
    @State private var fundTargetCloseAt = ""
    @State private var fundDryLow = ""
    @State private var fundDryHigh = ""
    @State private var fundDrySource = ""
    @State private var fundDryHeardFrom = ""
    @State private var fundDryNote = ""
    @State private var fundSourceURL = ""
    @State private var investmentEditingID: String?
    @State private var investmentCompany = ""
    @State private var investmentCompanyEn = ""
    @State private var investmentFundID = ""
    @State private var investmentProject = ""
    @State private var investmentAmount = ""
    @State private var investmentRound = ""
    @State private var investmentDate = ""
    @State private var investmentLead = false
    @State private var investmentSourceURL = ""
    @State private var investmentNotes = ""
    @State private var contactEditingID: String?
    @State private var contactName = ""
    @State private var contactRole = ""
    @State private var contactEmail = ""
    @State private var contactPhone = ""
    @State private var contactLinkedIn = ""
    @State private var relationProject = ""
    @State private var relationStatus = "not_contacted"
    @State private var relationContact = ""

    private var selectedId: String { vcId ?? store.vcs.first?.id ?? "" }
    private var selected: AMDOSParityVCBase? { store.vcs.first(where: { $0.id == selectedId }) }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "VC DETAIL", title: selected?.name ?? "VC詳細", subtitle: "PWA VcDetailBody / VcEditBodyのファンド・出資先・担当者・PJ関係・ニュースを読み書きする") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if let selected {
                AMDOSParityVCBaseEditor(
                    name: $name, nameEn: $nameEn, slug: $slug, type: $type, thesis: $thesis, stageFocus: $stageFocus, ticketMin: $ticketMin, ticketMax: $ticketMax, hq: $hq, website: $website, logoURL: $logoURL, notes: $notes, constraints: $constraints, rating: $rating, ratingNote: $ratingNote,
                    onSave: saveBase
                )
                AMDOSParityVCFundsEditor(
                    vcId: selected.id, funds: store.funds.filter { $0.vcId == selected.id }, contacts: store.contacts.filter { $0.vcId == selected.id }, editingID: $fundEditingID, fundNo: $fundNo, fundName: $fundName, status: $fundStatus, size: $fundSize, sizeLow: $fundSizeLow, sizeHigh: $fundSizeHigh, vintage: $fundVintage, firstCloseAt: $fundFirstCloseAt, finalCloseAt: $fundFinalCloseAt, targetCloseAt: $fundTargetCloseAt, dryLow: $fundDryLow, dryHigh: $fundDryHigh, drySource: $fundDrySource, dryHeardFrom: $fundDryHeardFrom, dryNote: $fundDryNote, sourceURL: $fundSourceURL,
                    onEdit: beginFundEdit, onDelete: { id in Task { await store.deleteFund(id) } }, onSave: saveFund, onClear: clearFund
                )
                AMDOSParityVCInvestmentsEditor(
                    vcId: selected.id, investments: store.investments.filter { $0.vcId == selected.id }, funds: store.funds.filter { $0.vcId == selected.id }, projects: store.projects, editingID: $investmentEditingID, company: $investmentCompany, companyEn: $investmentCompanyEn, fundID: $investmentFundID, projectId: $investmentProject, amount: $investmentAmount, round: $investmentRound, investedAt: $investmentDate, isLead: $investmentLead, sourceURL: $investmentSourceURL, notes: $investmentNotes,
                    projectName: store.projectName, onEdit: beginInvestmentEdit, onDelete: { id in Task { await store.deleteInvestment(id) } }, onSave: saveInvestment, onClear: clearInvestment
                )
                AMDOSParityVCContactsEditor(
                    vcId: selected.id, contacts: store.contacts.filter { $0.vcId == selected.id }, editingID: $contactEditingID, name: $contactName, role: $contactRole, email: $contactEmail, phone: $contactPhone, linkedIn: $contactLinkedIn,
                    onEdit: beginContactEdit, onDelete: { id in Task { await store.deleteContact(id) } }, onSave: saveContact, onClear: clearContact
                )
                AMDOSSectionCard("PJとの関係", systemImage: "arrow.left.arrow.right") {
                    ForEach(store.relations.filter { $0.vcId == selected.id }) { relation in
                        AMDOSCard { HStack { VStack(alignment: .leading) { Text(store.projectName(relation.projectId)).font(.headline); Text([relation.status, relation.lastTouchAt?.prefix(10).description, relation.vcContactId].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted); if let notes = relation.notes { Text(notes).font(.caption) } }; Spacer(); Button("削除") { Task { try? await AMDOSRESTClient.shared.deleteTable(table: "project_vc_relations", filters: ["id": "eq.\(relation.id)"]); await store.load() } }.buttonStyle(.bordered) } }
                    }
                    if store.relations.filter({ $0.vcId == selected.id }).isEmpty { Text("PJ接点がありません").foregroundStyle(AMDOSDesign.muted) }
                    AMDOSTextField(title: "PJ ID", text: $relationProject)
                    HStack { TextField("status", text: $relationStatus).textFieldStyle(.roundedBorder); TextField("contact ID", text: $relationContact).textFieldStyle(.roundedBorder); Button("PJ関係を追加") { saveRelation(selected.id) }.buttonStyle(.borderedProminent) }
                }
                AMDOSParityVCNewsSection(vcId: selected.id, news: store.news.filter { $0.vcId == selected.id }, store: store)
                if let message = store.message { Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning) }
            } else if store.state == .loaded {
                Text("VCが見つかりません").foregroundStyle(AMDOSDesign.muted)
            }
        }
        .task { await store.load(); seedBase() }
        .onChange(of: store.vcs.count) { _, _ in seedBase() }
    }

    private func parse(_ text: String) -> Double? { Double(text.trimmingCharacters(in: .whitespacesAndNewlines)) }
    private func seedBase() {
        guard let selected, selected.id != draftVCId else { return }
        draftVCId = selected.id
        name = selected.name
        nameEn = selected.nameEn ?? ""
        slug = selected.slug ?? ""
        type = selected.type ?? ""
        thesis = selected.thesis ?? ""
        stageFocus = selected.stageFocus?.joined(separator: ", ") ?? ""
        ticketMin = selected.ticketMin.map { String($0) } ?? ""
        ticketMax = selected.ticketMax.map { String($0) } ?? ""
        hq = selected.hq ?? ""
        website = selected.website ?? ""
        logoURL = selected.logoURL ?? ""
        notes = selected.notes ?? ""
        constraints = selected.investmentConstraints ?? ""
        rating = selected.amdRating.map { String($0) } ?? ""
        ratingNote = selected.amdRatingNote ?? ""
    }
    private func saveBase() {
        guard !selectedId.isEmpty else { return }
        let nextRating = Int(rating)
        let ratingChanged = selected?.amdRating != nextRating
        let actingMemberID: String? = {
            guard let memberID = auth.workspaceAccess?.memberId else { return nil }
            return memberID.trimmedNonEmpty
        }()
        guard !ratingChanged || actingMemberID != nil else {
            store.message = "AMD相性評価の更新者を確認できないため保存しなかったよ。ログインをやり直してね。"
            return
        }
        let ratingUpdatedAt = !ratingChanged
            ? selected?.amdRatingUpdatedAt
            : ISO8601DateFormatter().string(from: .now)
        let ratingUpdatedBy = !ratingChanged ? selected?.amdRatingUpdatedBy : actingMemberID
        Task {
            await store.saveVC(
                selectedId,
                patch: AMDOSParityVCPatch(
                    name: name.trimmedNonEmpty,
                    nameEn: nameEn.trimmedNonEmpty,
                    slug: slug.trimmedNonEmpty,
                    type: type.trimmedNonEmpty,
                    thesis: thesis.trimmedNonEmpty,
                    stageFocus: stageFocus.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty },
                    ticketMin: parse(ticketMin),
                    ticketMax: parse(ticketMax),
                    hq: hq.trimmedNonEmpty,
                    website: website.trimmedNonEmpty,
                    logoURL: logoURL.trimmedNonEmpty,
                    notes: notes.trimmedNonEmpty,
                    investmentConstraints: constraints.trimmedNonEmpty,
                    amdRating: nextRating,
                    amdRatingNote: ratingNote.trimmedNonEmpty,
                    amdRatingUpdatedBy: ratingUpdatedBy,
                    amdRatingUpdatedAt: ratingUpdatedAt
                )
            )
        }
    }
    private func clearFund() {
        fundEditingID = nil; fundNo = ""; fundName = ""; fundStatus = "unknown"; fundSize = ""; fundSizeLow = ""; fundSizeHigh = ""; fundVintage = ""
        fundFirstCloseAt = ""; fundFinalCloseAt = ""; fundTargetCloseAt = ""; fundDryLow = ""; fundDryHigh = ""; fundDrySource = ""; fundDryHeardFrom = ""; fundDryNote = ""; fundSourceURL = ""
    }
    private func beginFundEdit(_ row: AMDOSParityVCFundRow) {
        fundEditingID = row.id; fundNo = String(row.fundNo); fundName = row.name ?? ""; fundStatus = row.status ?? "unknown"; fundSize = row.size.map { String($0) } ?? ""; fundSizeLow = row.sizeLow.map { String($0) } ?? ""; fundSizeHigh = row.sizeHigh.map { String($0) } ?? ""; fundVintage = row.vintageYear.map { String($0) } ?? ""
        fundFirstCloseAt = row.firstCloseAt ?? ""; fundFinalCloseAt = row.finalCloseAt ?? ""; fundTargetCloseAt = row.targetCloseAt ?? ""; fundDryLow = row.dryPowderLow.map { String($0) } ?? ""; fundDryHigh = row.dryPowderHigh.map { String($0) } ?? ""; fundDrySource = row.dryPowderSource ?? ""; fundDryHeardFrom = row.dryPowderHeardFrom ?? ""; fundDryNote = row.dryPowderNote ?? ""; fundSourceURL = row.sourceURL ?? ""
    }
    private func saveFund() {
        guard let no = Int(fundNo), !selectedId.isEmpty else { return }
        let hasDryPowder = parse(fundDryLow) != nil || parse(fundDryHigh) != nil
        Task {
            await store.saveFund(
                AMDOSParityVCFundWrite(
                    vcId: selectedId, fundNo: no, name: fundName.trimmedNonEmpty, size: parse(fundSize), sizeLow: parse(fundSizeLow), sizeHigh: parse(fundSizeHigh), status: fundStatus, vintageYear: Int(fundVintage), firstCloseAt: fundFirstCloseAt.trimmedNonEmpty, finalCloseAt: fundFinalCloseAt.trimmedNonEmpty, targetCloseAt: fundTargetCloseAt.trimmedNonEmpty, dryPowderLow: parse(fundDryLow), dryPowderHigh: parse(fundDryHigh), dryPowderSource: fundDrySource.trimmedNonEmpty, dryPowderHeardFrom: fundDryHeardFrom.trimmedNonEmpty, dryPowderNote: fundDryNote.trimmedNonEmpty, dryPowderUpdatedAt: hasDryPowder ? ISO8601DateFormatter().string(from: .now) : nil, sourceURL: fundSourceURL.trimmedNonEmpty
                ),
                id: fundEditingID
            )
            clearFund()
        }
    }
    private func clearInvestment() {
        investmentEditingID = nil; investmentCompany = ""; investmentCompanyEn = ""; investmentFundID = ""; investmentProject = ""; investmentAmount = ""; investmentRound = ""; investmentDate = ""; investmentLead = false; investmentSourceURL = ""; investmentNotes = ""
    }
    private func beginInvestmentEdit(_ row: AMDOSParityVCInvestmentRow) {
        investmentEditingID = row.id; investmentCompany = row.targetCompany; investmentCompanyEn = row.targetCompanyEn ?? ""; investmentFundID = row.fundId ?? ""; investmentProject = row.ourProjectId ?? ""; investmentAmount = row.amount.map { String($0) } ?? ""; investmentRound = row.round ?? ""; investmentDate = row.investedAt ?? ""; investmentLead = row.isLead ?? false; investmentSourceURL = row.sourceURL ?? ""; investmentNotes = row.notes ?? ""
    }
    private func saveInvestment() {
        guard !(investmentCompany.trimmedNonEmpty ?? "").isEmpty else { return }
        Task {
            await store.saveInvestment(
                AMDOSParityVCInvestmentWrite(
                    vcId: selectedId, targetCompany: investmentCompany, targetCompanyEn: investmentCompanyEn.trimmedNonEmpty, fundId: investmentFundID.trimmedNonEmpty, ourProjectId: investmentProject.trimmedNonEmpty, amount: parse(investmentAmount), round: investmentRound.trimmedNonEmpty, investedAt: investmentDate.trimmedNonEmpty, isLead: investmentLead, sourceURL: investmentSourceURL.trimmedNonEmpty, notes: investmentNotes.trimmedNonEmpty
                ),
                id: investmentEditingID
            )
            clearInvestment()
        }
    }
    private func clearContact() { contactEditingID = nil; contactName = ""; contactRole = ""; contactEmail = ""; contactPhone = ""; contactLinkedIn = "" }
    private func beginContactEdit(_ row: AMDOSParityVCContactRow) { contactEditingID = row.id; contactName = row.name; contactRole = row.role ?? ""; contactEmail = row.email ?? ""; contactPhone = row.phone ?? ""; contactLinkedIn = row.linkedin ?? "" }
    private func saveContact() { guard !(contactName.trimmedNonEmpty ?? "").isEmpty else { return }; Task { await store.saveContact(AMDOSParityVCContactWrite(vcId: selectedId, name: contactName, role: contactRole.trimmedNonEmpty, email: contactEmail.trimmedNonEmpty, phone: contactPhone.trimmedNonEmpty, linkedin: contactLinkedIn.trimmedNonEmpty, notes: nil), id: contactEditingID); clearContact() } }
    private func saveRelation(_ id: String) { guard !(relationProject.trimmedNonEmpty ?? "").isEmpty else { return }; Task { await store.saveRelation(AMDOSParityVCRelationWrite(vcId: id, projectId: relationProject, status: relationStatus, vcContactId: relationContact.trimmedNonEmpty, lastTouchAt: nil, notes: nil)); relationProject = ""; await store.load() } }
}

private struct AMDOSParityVCBaseEditor: View {
    @Binding var name: String
    @Binding var nameEn: String
    @Binding var slug: String
    @Binding var type: String
    @Binding var thesis: String
    @Binding var stageFocus: String
    @Binding var ticketMin: String
    @Binding var ticketMax: String
    @Binding var hq: String
    @Binding var website: String
    @Binding var logoURL: String
    @Binding var notes: String
    @Binding var constraints: String
    @Binding var rating: String
    @Binding var ratingNote: String
    let onSave: () -> Void

    var body: some View {
        AMDOSSectionCard("VC基本情報 + AMD相性", systemImage: "building.columns") {
            Grid(horizontalSpacing: 12, verticalSpacing: 8) {
                GridRow {
                    AMDOSTextField(title: "VC名（正式）", text: $name)
                    AMDOSTextField(title: "英名", text: $nameEn)
                    AMDOSTextField(title: "種別", text: $type)
                }
                GridRow {
                    AMDOSTextField(title: "本拠", text: $hq)
                    AMDOSTextField(title: "投資額 下限（円）", text: $ticketMin)
                    AMDOSTextField(title: "投資額 上限（円）", text: $ticketMax)
                }
                GridRow {
                    AMDOSTextField(title: "Webサイト", text: $website)
                    AMDOSTextField(title: "ロゴURL", text: $logoURL)
                    AMDOSTextField(title: "URL用slug", text: $slug)
                }
                GridRow {
                    AMDOSTextField(title: "注力ステージ（カンマ区切り）", text: $stageFocus)
                    ratingPicker
                    Spacer()
                }
            }
            AMDOSTextField(title: "投資テーゼ", text: $thesis, axis: .vertical)
            AMDOSTextField(title: "投資制約 / 適用条件", text: $constraints, axis: .vertical)
            AMDOSTextField(title: "備考", text: $notes, axis: .vertical)
            AMDOSTextField(title: "AMD相性の評価メモ", text: $ratingNote, axis: .vertical)
            HStack {
                Spacer()
                Button("VC基本情報を保存", action: onSave).buttonStyle(.borderedProminent)
            }
        }
    }

    private var ratingPicker: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("AMD相性評価").font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker("AMD相性評価", selection: $rating) {
                Text("未評価").tag("")
                ForEach(1...5, id: \.self) { value in
                    Text(String(repeating: "★", count: value)).tag(String(value))
                }
            }
            .labelsHidden()
        }
    }
}

private func amdOSParityVCFundStatusLabel(_ value: String) -> String {
    switch value {
    case "raising": return "募集中"
    case "first_closed": return "1st クローズ"
    case "final_closed": return "ファイナルクローズ"
    case "investing": return "投資中"
    case "harvesting": return "ハーベスト"
    case "closed": return "クローズ済"
    default: return "不明"
    }
}

private func amdOSParityVCDryPowderSourceLabel(_ value: String) -> String {
    switch value {
    case "estimated": return "推定"
    case "heard_from_contact": return "担当直聞き"
    case "public_disclosure": return "公表値"
    default: return "—"
    }
}

private struct AMDOSParityVCFundsEditor: View {
    let vcId: String
    let funds: [AMDOSParityVCFundRow]
    let contacts: [AMDOSParityVCContactRow]
    @Binding var editingID: String?
    @Binding var fundNo: String
    @Binding var fundName: String
    @Binding var status: String
    @Binding var size: String
    @Binding var sizeLow: String
    @Binding var sizeHigh: String
    @Binding var vintage: String
    @Binding var firstCloseAt: String
    @Binding var finalCloseAt: String
    @Binding var targetCloseAt: String
    @Binding var dryLow: String
    @Binding var dryHigh: String
    @Binding var drySource: String
    @Binding var dryHeardFrom: String
    @Binding var dryNote: String
    @Binding var sourceURL: String
    let onEdit: (AMDOSParityVCFundRow) -> Void
    let onDelete: (String) -> Void
    let onSave: () -> Void
    let onClear: () -> Void

    var body: some View {
        AMDOSSectionCard("ファンド", systemImage: "banknote") {
            if funds.isEmpty {
                Text("未登録").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(funds) { fund in
                fundRow(fund)
            }
            Divider()
            Text(editingID == nil ? "ファンド追加" : "ファンド編集").font(.headline)
            Grid(horizontalSpacing: 12, verticalSpacing: 8) {
                GridRow {
                    AMDOSTextField(title: "ファンド番号", text: $fundNo)
                    AMDOSTextField(title: "正式名", text: $fundName)
                    statusPicker
                }
                GridRow {
                    AMDOSTextField(title: "規模（円）", text: $size)
                    AMDOSTextField(title: "規模レンジ 下限", text: $sizeLow)
                    AMDOSTextField(title: "規模レンジ 上限", text: $sizeHigh)
                }
                GridRow {
                    AMDOSTextField(title: "ビンテージ年", text: $vintage)
                    AMDOSTextField(title: "1stクローズ日（YYYY-MM-DD）", text: $firstCloseAt)
                    AMDOSTextField(title: "最終クローズ日（YYYY-MM-DD）", text: $finalCloseAt)
                }
            }
            AMDOSTextField(title: "目標クローズ日（募集中、YYYY-MM-DD）", text: $targetCloseAt)
            Divider()
            Text("ドライパウダー").font(.subheadline.weight(.semibold))
            Grid(horizontalSpacing: 12, verticalSpacing: 8) {
                GridRow {
                    AMDOSTextField(title: "DPE残レンジ 下限（円）", text: $dryLow)
                    AMDOSTextField(title: "DPE残レンジ 上限（円）", text: $dryHigh)
                    dryPowderSourcePicker
                }
                GridRow {
                    heardFromPicker
                    AMDOSTextField(title: "出所URL", text: $sourceURL)
                    Spacer()
                }
            }
            AMDOSTextField(title: "DPE備考", text: $dryNote, axis: .vertical)
            HStack {
                Button("保存", action: onSave).buttonStyle(.borderedProminent)
                Button("入力をクリア", action: onClear)
            }
        }
    }

    @ViewBuilder
    private func fundRow(_ fund: AMDOSParityVCFundRow) -> some View {
        AMDOSCard {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("#\(fund.fundNo) \(fund.name ?? "")").font(.headline)
                    Text([amdOSParityVCFundStatusLabel(fund.status ?? "unknown"), fund.vintageYear.map(String.init), fund.size.map { String(Int($0)) + "円" }].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    Text("DPE \(fund.dryPowderLow.map { String(Int($0)) } ?? "—")〜\(fund.dryPowderHigh.map { String(Int($0)) } ?? "—")")
                        .font(.caption2)
                    if let dates = closeDatesText(for: fund) {
                        Text(dates).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    if let source = fund.dryPowderSource?.trimmedNonEmpty {
                        Text("DPE出所: \(amdOSParityVCDryPowderSourceLabel(source))\(heardFromText(for: fund).map { " · \($0)" } ?? "")")
                            .font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    if let url = fund.sourceURL?.trimmedNonEmpty {
                        Text("出所URL: \(url)").font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                Button("編集") { onEdit(fund) }
                Button("削除") { onDelete(fund.id) }.buttonStyle(.bordered)
            }
        }
    }

    private var statusPicker: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("状態").font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker("状態", selection: $status) {
                ForEach(["raising", "first_closed", "final_closed", "investing", "harvesting", "closed", "unknown"], id: \.self) { value in
                    Text(amdOSParityVCFundStatusLabel(value)).tag(value)
                }
            }
            .labelsHidden()
        }
    }

    private var dryPowderSourcePicker: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("DPE出所").font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker("DPE出所", selection: $drySource) {
                Text("—").tag("")
                ForEach(["estimated", "heard_from_contact", "public_disclosure"], id: \.self) { value in
                    Text(amdOSParityVCDryPowderSourceLabel(value)).tag(value)
                }
            }
            .labelsHidden()
        }
    }

    private var heardFromPicker: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("誰から聞いたか").font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker("誰から聞いたか", selection: $dryHeardFrom) {
                Text("—").tag("")
                ForEach(contacts) { contact in
                    Text(contact.role.map { "\(contact.name)（\($0)）" } ?? contact.name).tag(contact.id)
                }
            }
            .labelsHidden()
        }
    }

    private func closeDatesText(for fund: AMDOSParityVCFundRow) -> String? {
        let values = [
            fund.firstCloseAt?.trimmedNonEmpty.map { "1st \($0)" },
            fund.finalCloseAt?.trimmedNonEmpty.map { "最終 \($0)" },
            fund.targetCloseAt?.trimmedNonEmpty.map { "目標 \($0)" },
        ].compactMap { $0 }
        return values.isEmpty ? nil : values.joined(separator: " · ")
    }

    private func heardFromText(for fund: AMDOSParityVCFundRow) -> String? {
        guard let contactID = fund.dryPowderHeardFrom?.trimmedNonEmpty,
              let contact = contacts.first(where: { $0.id == contactID }) else { return nil }
        return "\(contact.name)から聞いた"
    }
}

private struct AMDOSParityVCInvestmentsEditor: View {
    let vcId: String
    let investments: [AMDOSParityVCInvestmentRow]
    let funds: [AMDOSParityVCFundRow]
    let projects: [AMDOSParityVCProject]
    @Binding var editingID: String?
    @Binding var company: String
    @Binding var companyEn: String
    @Binding var fundID: String
    @Binding var projectId: String
    @Binding var amount: String
    @Binding var round: String
    @Binding var investedAt: String
    @Binding var isLead: Bool
    @Binding var sourceURL: String
    @Binding var notes: String
    let projectName: (String) -> String
    let onEdit: (AMDOSParityVCInvestmentRow) -> Void
    let onDelete: (String) -> Void
    let onSave: () -> Void
    let onClear: () -> Void

    var body: some View {
        AMDOSSectionCard("出資先", systemImage: "arrow.down.right.and.arrow.up.left") {
            if investments.isEmpty {
                Text("未登録").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(investments) { investment in
                investmentRow(investment)
            }
            Divider()
            Text(editingID == nil ? "出資先追加" : "出資先編集").font(.headline)
            Grid(horizontalSpacing: 12, verticalSpacing: 8) {
                GridRow {
                    AMDOSTextField(title: "投資先名", text: $company)
                    AMDOSTextField(title: "英名", text: $companyEn)
                    fundPicker
                }
                GridRow {
                    projectPicker
                    AMDOSTextField(title: "金額（円）", text: $amount)
                    AMDOSTextField(title: "ラウンド", text: $round)
                }
                GridRow {
                    AMDOSTextField(title: "投資日（YYYY-MM-DD）", text: $investedAt)
                    Toggle("リード投資", isOn: $isLead).toggleStyle(.checkbox)
                    Spacer()
                }
            }
            AMDOSTextField(title: "出所URL", text: $sourceURL)
            AMDOSTextField(title: "備考", text: $notes, axis: .vertical)
            HStack {
                Button("保存", action: onSave).buttonStyle(.borderedProminent)
                Button("入力をクリア", action: onClear)
            }
        }
    }

    @ViewBuilder
    private func investmentRow(_ investment: AMDOSParityVCInvestmentRow) -> some View {
        AMDOSCard {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(investment.ourProjectId.map(projectName) ?? investment.targetCompany).font(.headline)
                    Text([investment.targetCompany, investment.round, investment.investedAt?.prefix(10).description].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(AMDOSDesign.muted)
                    Text(investment.amount.map { String(Int($0)) + "円" } ?? "金額未登録").font(.caption2)
                    if let fundName = fundName(for: investment.fundId) {
                        Text("ファンド: \(fundName)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    if let url = investment.sourceURL?.trimmedNonEmpty {
                        Text("出所URL: \(url)").font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(1)
                    }
                    if let note = investment.notes?.trimmedNonEmpty {
                        Text(note).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                    }
                }
                Spacer(minLength: 0)
                Button("編集") { onEdit(investment) }
                Button("削除") { onDelete(investment.id) }.buttonStyle(.bordered)
            }
        }
    }

    private var fundPicker: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("ファンド").font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker("ファンド", selection: $fundID) {
                Text("不明").tag("")
                ForEach(funds) { fund in
                    Text("#\(fund.fundNo) \(fund.name ?? "")").tag(fund.id)
                }
            }
            .labelsHidden()
        }
    }

    private var projectPicker: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("自社PJ（該当なし=空）").font(.caption).foregroundStyle(AMDOSDesign.muted)
            Picker("自社PJ", selection: $projectId) {
                Text("—").tag("")
                ForEach(projects) { project in
                    Text(project.name).tag(project.projectId)
                }
            }
            .labelsHidden()
        }
    }

    private func fundName(for id: String?) -> String? {
        guard let id, let fund = funds.first(where: { $0.id == id }) else { return nil }
        return "#\(fund.fundNo) \(fund.name ?? "")"
    }
}

private struct AMDOSParityVCContactsEditor: View {
    let vcId: String; let contacts: [AMDOSParityVCContactRow]; @Binding var editingID: String?; @Binding var name: String; @Binding var role: String; @Binding var email: String; @Binding var phone: String; @Binding var linkedIn: String; let onEdit: (AMDOSParityVCContactRow) -> Void; let onDelete: (String) -> Void; let onSave: () -> Void; let onClear: () -> Void
    var body: some View { AMDOSSectionCard("VC担当者", systemImage: "person.2") { ForEach(contacts) { contact in AMDOSCard { HStack { VStack(alignment: .leading) { Text(contact.name).font(.headline); Text([contact.role, contact.email, contact.phone].compactMap { $0?.trimmedNonEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted) }; Spacer(); Button("編集") { onEdit(contact) }; Button("削除") { onDelete(contact.id) }.buttonStyle(.bordered) } } }; Divider(); Text(editingID == nil ? "担当者追加" : "担当者編集").font(.headline); Grid(horizontalSpacing: 12, verticalSpacing: 8) { GridRow { AMDOSTextField(title: "名前", text: $name); AMDOSTextField(title: "役職", text: $role); AMDOSTextField(title: "email", text: $email) }; GridRow { AMDOSTextField(title: "phone", text: $phone); AMDOSTextField(title: "LinkedIn", text: $linkedIn); Spacer() } }; HStack { Button("保存", action: onSave).buttonStyle(.borderedProminent); Button("入力をクリア", action: onClear) } } }
}

private struct AMDOSParityVCNewsSection: View {
    let vcId: String; let news: [AMDOSParityVCNewsRow]; @ObservedObject var store: AMDOSParityVCStore
    var body: some View {
        AMDOSSectionCard("VCニュース", systemImage: "newspaper") {
            if news.isEmpty {
                Text("ニュースなし").foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(news) { item in
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            AMDOSStatusBadge(text: item.kind)
                            Text(item.occurredOn ?? "日時未登録").font(.caption).foregroundStyle(AMDOSDesign.muted)
                            Spacer()
                            AMDOSStatusBadge(text: item.verified ? "verified" : item.dismissed ? "dismissed" : "未確認", tint: item.verified ? AMDOSDesign.success : AMDOSDesign.warning)
                        }
                        Text(item.title).font(.headline)
                        if let body = item.body { Text(body).font(.caption) }
                        HStack {
                            if !item.verified && !item.dismissed {
                                Button("Verify") { Task { await store.reviewNews(item.id, verified: true, dismissed: false) } }
                                Button("Dismiss") { Task { await store.reviewNews(item.id, verified: false, dismissed: true) } }
                            }
                        }
                    }
                }
            }
        }
    }
}

struct AMDOSParityVCInboxView: View {
    let onSelectVC: (String) -> Void
    @StateObject private var store = AMDOSParityVCStore()
    @State private var filter = "all"
    var body: some View {
        AMDOSPageScaffold(eyebrow: "VC INBOX", title: "VCニュース受信箱", subtitle: "PWAの未確認ニュースをVerify / Dismissし、提案ファンドを同じRLS境界へ反映") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            Picker("種類", selection: $filter) {
                Text("全").tag("all")
                Text("fundraise").tag("fundraise")
                Text("fund_close").tag("fund_close")
                Text("investment").tag("investment")
            }
            .pickerStyle(.segmented)
            let items = store.news.filter { !$0.verified && !$0.dismissed && (filter == "all" || $0.kind == filter) }
            if items.isEmpty && store.state == .loaded {
                Text("未確認ニュースなし").foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(items) { item in
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            AMDOSStatusBadge(text: item.kind)
                            Text(store.vcs.first(where: { $0.id == item.vcId })?.name ?? item.vcId).font(.headline)
                            Spacer()
                            Text(item.occurredOn ?? "日時未登録").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                        Text(item.title).font(.headline)
                        Text(item.body ?? "本文なし").font(.caption)
                        if let patch = item.suggestedFundPatch, let no = patch.fundNo {
                            Text("提案: #\(no) \(patch.status ?? "unknown") · \(patch.size.map { String(Int($0)) + "円" } ?? "")")
                                .font(.caption).foregroundStyle(AMDOSDesign.success)
                            Button("ファンド反映してVerify") { Task { await applyFund(item: item, patch: patch, no: no) } }
                        }
                        HStack {
                            Button("Verify") { Task { await store.reviewNews(item.id, verified: true, dismissed: false) } }
                            Button("Dismiss") { Task { await store.reviewNews(item.id, verified: false, dismissed: true) } }
                            Button("VC詳細") { onSelectVC(item.vcId) }
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
        }
        .task { await store.load() }
    }
    private func applyFund(item: AMDOSParityVCNewsRow, patch: AMDOSParityVCFundPatch, no: Int) async { await store.saveFund(AMDOSParityVCFundWrite(vcId: item.vcId, fundNo: no, name: nil, size: patch.size, sizeLow: patch.sizeLow, sizeHigh: patch.sizeHigh, status: patch.status ?? "unknown", vintageYear: patch.vintageYear, firstCloseAt: patch.firstCloseAt, finalCloseAt: patch.finalCloseAt, targetCloseAt: patch.targetCloseAt, dryPowderLow: nil, dryPowderHigh: nil, dryPowderSource: nil, dryPowderHeardFrom: nil, dryPowderNote: nil, dryPowderUpdatedAt: nil, sourceURL: patch.sourceURL), id: nil); await store.reviewNews(item.id, verified: true, dismissed: false) }
}

// MARK: - Management Score

private indirect enum AMDOSManagementJSON: Codable, Sendable {
    case object([String: AMDOSManagementJSON])
    case array([AMDOSManagementJSON])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null; return }
        if let value = try? container.decode([String: AMDOSManagementJSON].self) { self = .object(value); return }
        if let value = try? container.decode([AMDOSManagementJSON].self) { self = .array(value); return }
        if let value = try? container.decode(String.self) { self = .string(value); return }
        if let value = try? container.decode(Double.self) { self = .number(value); return }
        if let value = try? container.decode(Bool.self) { self = .bool(value); return }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "unsupported management JSON")
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    var text: String? {
        switch self {
        case .string(let value): return value
        case .number(let value): return value.formatted(.number.precision(.fractionLength(0...2)))
        case .bool(let value): return value ? "true" : "false"
        case .null: return nil
        case .array(let values): return values.compactMap(\.text).joined(separator: " / ")
        case .object(let values): return values.keys.sorted().compactMap { key in values[key]?.text.map { "\(key): \($0)" } }.joined(separator: " / ")
        }
    }

    var strings: [String] {
        switch self {
        case .array(let values): return values.compactMap(\.text)
        case .string(let value): return [value]
        default: return []
        }
    }
}

private struct AMDOSManagementSnapshot: Decodable, Sendable {
    let id: String?
    let ym: String
    let totalScore: Double?
    let initiativeScore: Double?
    let financeScore: Double?
    let retentionScore: Double?
    let pipelineScore: Double?
    let directionScore: Double?
    let confidence: Double?
    let inputs: AMDOSManagementJSON?
    let nextActions: AMDOSManagementJSON?
    let summary: String?
    let financeCap: String?
    let createdAt: String?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, ym
        case totalScore = "total_score", initiativeScore = "initiative_score", financeScore = "finance_score"
        case retentionScore = "retention_score", pipelineScore = "pipeline_score", directionScore = "direction_score"
        case confidence, inputs = "inputs_json", nextActions = "next_actions_json", summary
        case financeCap = "finance_cap_applied", createdAt = "created_at", updatedAt = "updated_at"
    }
}

private struct AMDOSManagementHistoryRow: Decodable, Sendable {
    let ym: String
    let totalScore: Double?
    let initiativeScore: Double?
    let financeScore: Double?
    let retentionScore: Double?
    let pipelineScore: Double?
    let directionScore: Double?
    let confidence: Double?
    let createdAt: String?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey {
        case ym, totalScore = "total_score", initiativeScore = "initiative_score", financeScore = "finance_score"
        case retentionScore = "retention_score", pipelineScore = "pipeline_score", directionScore = "direction_score"
        case confidence, createdAt = "created_at", updatedAt = "updated_at"
    }
}

private struct AMDOSManagementBudgetActual: Decodable, Sendable, Identifiable {
    let id = UUID()
    let ym: String
    let scope: String
    let projectID: String?
    let category: String
    let accountName: String?
    let budgetAmount: Double?
    let actualAmount: Double?
    let variance: Double?
    let cashAmount: Double?
    let runwayMonths: Double?
    let budgetVersion: String?
    enum CodingKeys: String, CodingKey {
        case ym, scope, projectID = "project_id", category, accountName = "account_name"
        case budgetAmount = "budget_amount_yen", actualAmount = "actual_amount_yen", variance = "variance_yen"
        case cashAmount = "cash_amount_yen", runwayMonths = "runway_months", budgetVersion = "budget_version"
    }
}

private struct AMDOSManagementBudgetInput: Decodable, Sendable, Identifiable {
    let id = UUID()
    let inputKind: String
    let source: String?
    let version: String?
    let sourceID: String?
    let label: String?
    let payload: AMDOSManagementJSON?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey {
        case inputKind = "input_kind", source, version, sourceID = "source_id", label, payload, updatedAt = "updated_at"
    }
}

private struct AMDOSManagementFreshnessRow: Decodable, Sendable, Identifiable {
    let id = UUID()
    let ym: String
    let category: String
    let sourceRef: String?
    let importedAt: String?
    enum CodingKeys: String, CodingKey { case ym, category, sourceRef = "source_ref", importedAt = "imported_at" }
}

private struct AMDOSManagementSourceRun: Decodable, Sendable, Identifiable {
    let id: String
    let ym: String
    let sourceKind: String?
    let status: String?
    let stats: AMDOSManagementJSON?
    let error: String?
    let startedAt: String?
    let finishedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, ym, sourceKind = "source_kind", status, stats, error, startedAt = "started_at", finishedAt = "finished_at"
    }
}

private struct AMDOSManagementSimulationRun: Decodable, Sendable, Identifiable {
    let id: String
    let scenarioID: String?
    let version: String
    let engineVersion: String?
    let ranAt: String?
    enum CodingKeys: String, CodingKey { case id, scenarioID = "scenario_id", version, engineVersion = "engine_version", ranAt = "ran_at" }
}

private struct AMDOSManagementVarianceNote: Decodable, Sendable, Identifiable {
    let id: String
    let ym: String
    let category: String?
    let varianceKind: String
    let note: String
    let confidence: Double?
    let status: String
    enum CodingKeys: String, CodingKey { case id, ym, category, varianceKind = "variance_kind", note, confidence, status }
}

private struct AMDOSManagementEvidence: Decodable, Sendable, Identifiable {
    let id: String
    let snapshotID: String?
    let ym: String
    let axis: String
    let kind: String
    let summary: String
    let sourceType: String?
    let sourceRef: String?
    let impact: Double?
    let confidence: Double?
    let payload: AMDOSManagementJSON?
    enum CodingKeys: String, CodingKey {
        case id, snapshotID = "snapshot_id", ym, axis, kind = "evidence_kind", summary
        case sourceType = "source_type", sourceRef = "source_ref", impact, confidence, payload
    }
}

private struct AMDOSManagementSignalReview: Decodable, Sendable, Identifiable {
    let id: String
    let ym: String
    let status: String
    let summary: String
    let forecastSummary: String?
    let costActions: AMDOSManagementJSON?
    let pipelineActions: AMDOSManagementJSON?
    let varianceFindings: AMDOSManagementJSON?
    let riskAlerts: AMDOSManagementJSON?
    let decisionSignals: AMDOSManagementJSON?
    let sourceRefs: AMDOSManagementJSON?
    let codexThreadID: String?
    let reviewedAt: String?
    enum CodingKeys: String, CodingKey {
        case id, ym, status, summary, forecastSummary = "forecast_summary", costActions = "cost_actions"
        case pipelineActions = "pipeline_actions", varianceFindings = "variance_findings", riskAlerts = "risk_alerts"
        case decisionSignals = "decision_signals", sourceRefs = "source_refs_json", codexThreadID = "codex_thread_id", reviewedAt = "reviewed_at"
    }
}

private struct AMDOSManagementStrategySignal: Decodable, Sendable, Identifiable {
    let id: String
    let projectID: String
    let ym: String?
    let signalType: String
    let impactLevel: String
    let decisionState: String
    let title: String
    let summary: String?
    let signalDate: String?
    let confirmedAt: String?
    let polarity: String?
    let scoreImpactSummary: String?
    let sourceRefs: AMDOSManagementJSON?
    enum CodingKeys: String, CodingKey {
        case id = "signal_id", projectID = "project_id", ym, signalType = "signal_type", impactLevel = "impact_level"
        case decisionState = "decision_state", title, summary, signalDate = "signal_date", confirmedAt = "confirmed_at"
        case polarity, scoreImpactSummary = "score_impact_summary", sourceRefs = "source_refs_json"
    }
}

@MainActor
private struct AMDOSManagementSimulationInputsEnvelope: Decodable, Sendable {
    let ok: Bool
    let source: String?
    let inputs: AMDOSManagementJSON?
    let warnings: [String]?
    let error: String?
}
private struct AMDOSManagementSimulationRequest: Encodable, Sendable {
    let inputs: AMDOSManagementJSON
    let scenarioId: String?
    let persist = false
    let version = "interactive-preview"
    let sourceRef = "/management-score"
    enum CodingKeys: String, CodingKey { case inputs, scenarioId, persist, version, sourceRef }
}
private struct AMDOSManagementSimulationResponse: Decodable, Sendable {
    let ok: Bool
    let error: String?
    let result: AMDOSManagementSimulationResult?
}
private struct AMDOSManagementSimulationResult: Decodable, Sendable {
    let rows: [AMDOSManagementSimulationRow]
}
private struct AMDOSManagementSimulationRow: Decodable, Sendable, Identifiable {
    let ym: Int
    let revenue: Double
    let operatingProfit: Double
    let netCashFlow: Double
    let cashBalance: Double
    let runway: Double
    var id: Int { ym }
    enum CodingKeys: String, CodingKey { case ym, revenue, operatingProfit = "operatingProfit", netCashFlow = "netCashFlow", cashBalance = "cashBalance", runway }
}
private struct AMDOSManagementSimulationScenario: Identifiable, Sendable {
    let id: String
    let name: String
}

private final class AMDOSManagementParityStore: ObservableObject {
    @Published var snapshots: [AMDOSManagementSnapshot] = []
    @Published var history: [AMDOSManagementHistoryRow] = []
    @Published var budget: [AMDOSManagementBudgetActual] = []
    @Published var inputs: [AMDOSManagementBudgetInput] = []
    @Published var freshness: [AMDOSManagementFreshnessRow] = []
    @Published var sourceRuns: [AMDOSManagementSourceRun] = []
    @Published var simulationRuns: [AMDOSManagementSimulationRun] = []
    @Published var notes: [AMDOSManagementVarianceNote] = []
    @Published var evidence: [AMDOSManagementEvidence] = []
    @Published var reviews: [AMDOSManagementSignalReview] = []
    @Published var signals: [AMDOSManagementStrategySignal] = []
    @Published var simulation: AMDOSManagementSimulationResult?
    @Published var simulationSource: String?
    @Published var simulationWarnings: [String] = []
    @Published var simulationScenarios: [AMDOSManagementSimulationScenario] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?

    func load() async {
        state = .loading
        message = nil
        do {
            let cap = AMDOSManagementCalendar.currentYM
            async let nextSnapshots = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementSnapshot.self,
                table: "amd_management_score_snapshots",
                select: "id,ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,inputs_json,next_actions_json,summary,finance_cap_applied,created_at,updated_at",
                filters: ["ym": "lte.\(cap)"], order: "ym.desc", limit: 6
            )
            async let nextHistory = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementHistoryRow.self,
                table: "amd_management_score_snapshots",
                select: "ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,created_at,updated_at",
                filters: ["ym": "lte.\(cap)"], order: "ym.desc", limit: 25
            )
            async let nextBudget = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementBudgetActual.self,
                table: "company_budget_actual_monthly",
                select: "ym,scope,project_id,category,account_name,budget_amount_yen,actual_amount_yen,variance_yen,cash_amount_yen,runway_months,budget_version",
                limit: 2000
            )
            async let nextInputs = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementBudgetInput.self,
                table: "company_budget_inputs",
                select: "input_kind,source,version,source_id,label,payload,updated_at",
                filters: ["source": "eq.gas_monthly_pl"], order: "input_kind.asc", limit: 500
            )
            async let nextFreshness = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementFreshnessRow.self,
                table: "company_actual_monthly",
                select: "ym,category,source_ref,imported_at",
                filters: ["scope": "eq.company", "ym": "lte.\(cap)"], order: "imported_at.desc", limit: 500
            )
            async let nextSourceRuns = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementSourceRun.self,
                table: "amd_management_score_source_runs",
                select: "id,ym,source_kind,status,stats,error,started_at,finished_at",
                filters: ["ym": "lte.\(cap)"], order: "started_at.desc", limit: 8
            )
            async let nextSimulationRuns = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementSimulationRun.self,
                table: "company_budget_simulation_runs",
                select: "id,scenario_id,version,engine_version,ran_at",
                order: "ran_at.desc", limit: 1
            )
            async let nextNotes = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementVarianceNote.self,
                table: "company_budget_variance_notes",
                select: "id,ym,category,variance_kind,note,confidence,status",
                order: "created_at.desc", limit: 8
            )
            async let nextEvidence = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementEvidence.self,
                table: "amd_management_score_evidence",
                select: "id,snapshot_id,ym,axis,evidence_kind,summary,source_type,source_ref,impact,confidence,payload",
                order: "created_at.desc", limit: 200
            )
            async let nextReviews = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementSignalReview.self,
                table: "company_management_signal_reviews",
                select: "id,ym,status,summary,forecast_summary,cost_actions,pipeline_actions,variance_findings,risk_alerts,decision_signals,source_refs_json,codex_thread_id,reviewed_at",
                filters: ["ym": "lte.\(cap)"], order: "ym.desc", limit: 12
            )
            async let nextSignals = AMDOSRESTClient.shared.fetchTable(
                AMDOSManagementStrategySignal.self,
                table: "project_strategy_signals",
                select: "signal_id,project_id,ym,signal_type,impact_level,decision_state,title,summary,signal_date,confirmed_at,polarity,score_impact_summary,source_refs_json",
                filters: ["status": "eq.confirmed", "decision_state": "in.(decided,executing,revised)", "ym": "lte.\(cap)"],
                order: "confirmed_at.desc", limit: 40
            )
            snapshots = try await nextSnapshots
            history = try await nextHistory
            budget = try await nextBudget
            inputs = try await nextInputs
            freshness = try await nextFreshness
            sourceRuns = try await nextSourceRuns
            simulationRuns = try await nextSimulationRuns
            notes = try await nextNotes
            evidence = try await nextEvidence
            reviews = try await nextReviews
            signals = try await nextSignals
            state = snapshots.isEmpty && budget.isEmpty && evidence.isEmpty ? .empty : .loaded
        } catch {
            message = error.localizedDescription
            state = .failed(message ?? "経営状況を取得できなかった")
        }
    }

    func runSimulation(scenarioID: String?) async {
        do {
            let inputEnvelope = try await AMDOSRESTClient.shared.fetchPWA(
                AMDOSManagementSimulationInputsEnvelope.self,
                path: "/api/macos/management-score/inputs"
            )
            guard inputEnvelope.ok, let inputs = inputEnvelope.inputs else {
                throw AMDOSNetworkError.http(inputEnvelope.error ?? "シミュレーション入力を取得できなかった")
            }
            simulationScenarios = scenarioOptions(from: inputs)
            let data = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/management-score/finance/simulate",
                body: AMDOSManagementSimulationRequest(inputs: inputs, scenarioId: scenarioID)
            )
            let response = try JSONDecoder().decode(AMDOSManagementSimulationResponse.self, from: data)
            guard response.ok, let result = response.result else {
                throw AMDOSNetworkError.http(response.error ?? "シミュレーションを実行できなかった")
            }
            simulation = result
            simulationSource = inputEnvelope.source
            simulationWarnings = inputEnvelope.warnings ?? []
        } catch {
            message = error.localizedDescription
        }
    }

    private func scenarioOptions(from inputs: AMDOSManagementJSON) -> [AMDOSManagementSimulationScenario] {
        guard case .object(let root) = inputs, case .array(let rows)? = root["scenarios"] else { return [] }
        let candidates: [AMDOSManagementSimulationScenario] = rows.compactMap { row in
            guard case .object(let value) = row,
                  case .string(let id)? = value["scenarioId"] else { return nil }
            let name: String
            if case .string(let value)? = value["scenarioName"], !value.isEmpty { name = value } else { name = id }
            return AMDOSManagementSimulationScenario(id: id, name: name)
        }
        return candidates.reduce(into: [AMDOSManagementSimulationScenario]()) { result, item in
            if !result.contains(where: { $0.id == item.id }) { result.append(item) }
        }
    }
}

private enum AMDOSManagementCalendar {
    static var currentYM: String {
        let components = Calendar(identifier: .gregorian).dateComponents(in: TimeZone(identifier: "Asia/Tokyo") ?? .current, from: .now)
        return String(format: "%04d%02d", components.year ?? 0, components.month ?? 0)
    }
}

private struct AMDOSManagementMetric: View {
    let label: String
    let value: String
    let detail: String?
    var tint: Color = AMDOSDesign.ink
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 5) {
                Text(label).font(.caption).foregroundStyle(AMDOSDesign.muted)
                Text(value).font(.system(size: 21, weight: .semibold, design: .rounded)).foregroundStyle(tint)
                if let detail { Text(detail).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(2) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct AMDOSManagementBar: View {
    let label: String
    let value: Double?
    let detail: String
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(label).font(.caption.weight(.semibold))
                Spacer()
                Text(value.map { "\(Int($0.rounded()))%" } ?? "—").font(.caption.monospacedDigit()).foregroundStyle(AMDOSManagementColor.score(value))
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(AMDOSDesign.border)
                    Capsule().fill(AMDOSManagementColor.score(value)).frame(width: proxy.size.width * CGFloat(max(0, min(100, value ?? 0)) / 100))
                }
            }
            .frame(height: 7)
            Text(detail).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
        }
    }
}

private enum AMDOSManagementColor {
    static func score(_ value: Double?) -> Color {
        guard let value else { return AMDOSDesign.muted }
        if value >= 75 { return AMDOSDesign.success }
        if value >= 55 { return AMDOSDesign.warning }
        return .red
    }
}

private func amdOSManagementYen(_ value: Double?) -> String {
    guard let value else { return "—" }
    return "¥\(Int(value.rounded()).formatted())"
}

private func amdOSManagementDate(_ value: String?) -> String {
    guard let value, let date = ISO8601DateFormatter().date(from: value) else { return value ?? "—" }
    return date.formatted(date: .abbreviated, time: .shortened)
}

private func amdOSManagementCategory(_ value: String) -> String {
    [
        "revenue": "売上", "cost_member": "メンバー原価", "cost_closer": "クローザー原価", "gross_profit": "粗利",
        "fixed_cost": "固定費", "social_insurance": "社保", "operating_profit": "営業利益", "loan_payment": "借入返済",
        "loan_interest": "支払利息", "tax_payment_consumption": "消費税", "tax_payment_corporate": "法人税", "net_cash_flow": "純CF"
    ][value] ?? value
}

struct AMDOSParityManagementScoreView: View {
    @StateObject private var store = AMDOSManagementParityStore()
    @State private var evidenceAxis = "すべて"
    @State private var simulationScenarioID = ""
    private let axes = [("initiative", "先手"), ("finance", "財務"), ("retention", "継続"), ("pipeline", "新規"), ("direction", "方向")]

    private var score: AMDOSManagementSnapshot? { store.snapshots.first(where: { $0.ym <= AMDOSManagementCalendar.currentYM }) }
    private var previous: AMDOSManagementHistoryRow? {
        guard let score else { return nil }
        return store.history.first(where: { $0.ym < score.ym })
    }
    private var filteredEvidence: [AMDOSManagementEvidence] {
        guard evidenceAxis != "すべて" else { return store.evidence }
        return store.evidence.filter { $0.axis == evidenceAxis }
    }
    private var latestBudgetRows: [AMDOSManagementBudgetActual] {
        guard let ym = store.budget.filter({ $0.scope == "company" }).map(\.ym).max() else { return [] }
        return store.budget.filter { $0.scope == "company" && $0.ym == ym }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "AMD MANAGEMENT SCORE", title: "経営状況", subtitle: "PWAの会社全体スコア・月次試算表・根拠・経営シグナルを同じデータ境界で確認") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if let score {
                let delta = score.totalScore.flatMap { current in previous?.totalScore.map { current - $0 } }
                HStack(spacing: 8) {
                    Text("対象月 \(score.ym)").font(.caption.weight(.semibold))
                    Text("前月比 \(delta.map { String(format: "%+.0f", $0) } ?? "—")").font(.caption).foregroundStyle(AMDOSManagementColor.score(delta))
                    Text("confidence \(score.confidence.map { "\(Int($0 * 100))%" } ?? "—")").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    Spacer()
                    if let run = store.simulationRuns.first { Text("計算 \(amdOSManagementDate(run.ranAt))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                }
                if let summary = score.summary?.trimmedNonEmpty {
                    AMDOSSectionCard("今月の結論", systemImage: "text.quote") { Text(summary).textSelection(.enabled) }
                }
                if let cap = score.financeCap?.trimmedNonEmpty {
                    AMDOSCard { Label("finance cap 適用中: \(cap)", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
                }
                if let next = score.nextActions?.strings, !next.isEmpty {
                    AMDOSSectionCard("次の一手", systemImage: "arrow.forward.circle.fill") { ForEach(next, id: \.self) { Text("・\($0)").textSelection(.enabled) } }
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), alignment: .top)], spacing: 12) {
                    AMDOSManagementMetric(label: "Total", value: score.totalScore.map { "\(Int($0))%" } ?? "—", detail: "前月比 \(delta.map { String(format: "%+.0f", $0) } ?? "—")", tint: AMDOSManagementColor.score(score.totalScore))
                    AMDOSManagementMetric(label: "先手力", value: score.initiativeScore.map { "\(Int($0))%" } ?? "—", detail: "initiative", tint: AMDOSManagementColor.score(score.initiativeScore))
                    AMDOSManagementMetric(label: "財務", value: score.financeScore.map { "\(Int($0))%" } ?? "—", detail: "finance", tint: AMDOSManagementColor.score(score.financeScore))
                    AMDOSManagementMetric(label: "継続", value: score.retentionScore.map { "\(Int($0))%" } ?? "—", detail: "retention", tint: AMDOSManagementColor.score(score.retentionScore))
                    AMDOSManagementMetric(label: "新規", value: score.pipelineScore.map { "\(Int($0))%" } ?? "—", detail: "pipeline", tint: AMDOSManagementColor.score(score.pipelineScore))
                    AMDOSManagementMetric(label: "方向", value: score.directionScore.map { "\(Int($0))%" } ?? "—", detail: "direction", tint: AMDOSManagementColor.score(score.directionScore))
                }
                AMDOSSectionCard("各軸の変動理由", systemImage: "arrow.up.right.and.arrow.down.left") {
                    ForEach(axes, id: \.0) { axis, label in
                        let current = amdOSManagementAxisValue(score, axis: axis)
                        let prior = previous.flatMap { amdOSManagementAxisValue($0, axis: axis) }
                        let axisEvidence = store.evidence.filter { $0.axis == axis && ($0.snapshotID == score.id || $0.ym == score.ym) }.sorted { abs($0.impact ?? 0) > abs($1.impact ?? 0) }
                        let deltaText = current.flatMap { currentValue in prior.flatMap { priorValue in String(format: "%+.0f", currentValue - priorValue) } } ?? "—"
                        AMDOSManagementBar(label: label, value: current, detail: "前月比 \(deltaText) · 根拠 \(axisEvidence.count)件")
                        if let first = axisEvidence.first { Text(first.summary).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2) }
                    }
                }
            } else if store.state == .loaded || store.state == .empty {
                AMDOSSectionCard("スコアデータ待ち", systemImage: "chart.bar.xaxis") { Text("amd_management_score_snapshots に現在月以前のsnapshotがありません。PWAと同じく最新のraw収集・再計算を確認してね。") }
            }
            AMDOSManagementCashSection(rows: store.budget)
            AMDOSSectionCard("月次PLシミュレーション", systemImage: "chart.line.uptrend.xyaxis") {
                HStack {
                    Picker("シナリオ", selection: $simulationScenarioID) {
                        Text("ベースライン").tag("")
                        ForEach(store.simulationScenarios) { scenario in Text(scenario.name).tag(scenario.id) }
                    }
                    Button("シミュレーション実行") { Task { await store.runSimulation(scenarioID: simulationScenarioID.trimmedNonEmpty) } }.buttonStyle(.borderedProminent)
                }
                Text("PWAと同じlive inputを取得して、保存せず既存のfinance simulation APIで再計算する。 ").font(.caption).foregroundStyle(AMDOSDesign.muted)
                if let source = store.simulationSource { Text("入力: \(source)").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                ForEach(store.simulationWarnings, id: \.self) { Text("注意: \($0)").font(.caption2).foregroundStyle(AMDOSDesign.warning) }
                if let simulation = store.simulation {
                    ForEach(simulation.rows) { row in
                        AMDOSLineItem(title: "\(row.ym)", subtitle: "売上 \(amdOSManagementYen(row.revenue)) · 営業利益 \(amdOSManagementYen(row.operatingProfit)) · CF \(amdOSManagementYen(row.netCashFlow)) · Cash \(amdOSManagementYen(row.cashBalance))", status: "runway \(Int(row.runway))月")
                    }
                }
            }
            AMDOSSectionCard("スコア推移", systemImage: "chart.xyaxis.line") {
                if store.history.isEmpty { Text("データ待ち").foregroundStyle(AMDOSDesign.muted) }
                ForEach(store.history.reversed(), id: \.ym) { row in
                    HStack {
                        Text(row.ym).font(.caption.monospacedDigit()).frame(width: 60, alignment: .leading)
                        AMDOSManagementBar(label: "Total", value: row.totalScore, detail: "先手 \(row.initiativeScore.map { "\(Int($0))%" } ?? "—") · 財務 \(row.financeScore.map { "\(Int($0))%" } ?? "—")")
                    }
                }
            }
            AMDOSSectionCard("根拠", systemImage: "checkmark.seal.fill") {
                Picker("軸", selection: $evidenceAxis) {
                    Text("すべて").tag("すべて")
                    ForEach(axes, id: \.0) { Text($0.1).tag($0.0) }
                }
                .pickerStyle(.segmented)
                if filteredEvidence.isEmpty { Text("evidence データ待ち").foregroundStyle(AMDOSDesign.muted) }
                ForEach(filteredEvidence.prefix(40)) { row in
                    AMDOSCard {
                        HStack(alignment: .top) {
                            AMDOSStatusBadge(text: row.axis, tint: (row.impact ?? 0) >= 0 ? AMDOSDesign.success : .red)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(row.kind).font(.caption.weight(.semibold))
                                Text(row.summary).font(.subheadline)
                                Text("impact \(row.impact.map { String(format: "%+.1f", $0) } ?? "—") · conf \(row.confidence.map { "\(Int($0 * 100))%" } ?? "—") · \(row.sourceType ?? "source不明") \(row.sourceRef ?? "")").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            }
                        }
                    }
                }
            }
            AMDOSManagementSignalSection(reviews: store.reviews)
            AMDOSManagementConfirmedSignalSection(signals: store.signals)
            AMDOSSectionCard("差分メモ", systemImage: "note.text") {
                if store.notes.isEmpty { Text("データ待ち").foregroundStyle(AMDOSDesign.muted) }
                ForEach(store.notes) { note in
                    AMDOSLineItem(title: "\(note.ym) / \(amdOSManagementCategory(note.category ?? note.varianceKind))", subtitle: note.note, status: note.status)
                }
            }
            AMDOSSectionCard("月次試算・実績の鮮度", systemImage: "clock.arrow.circlepath") {
                ForEach(store.inputs.prefix(10)) { input in
                    AMDOSLineItem(title: input.label ?? input.inputKind, subtitle: "\(input.inputKind) · \(input.version ?? "—") · \(amdOSManagementDate(input.updatedAt))", status: input.source)
                }
                ForEach(store.sourceRuns.prefix(8)) { run in
                    AMDOSLineItem(title: "raw \(run.ym) / \(run.sourceKind ?? "—")", subtitle: "\(run.status ?? "—") · \(amdOSManagementDate(run.finishedAt ?? run.startedAt))", status: run.error ?? run.stats?.text)
                }
            }
        }
        .task { await store.load() }
    }
}

private func amdOSManagementAxisValue(_ row: AMDOSManagementSnapshot, axis: String) -> Double? {
    switch axis { case "initiative": return row.initiativeScore; case "finance": return row.financeScore; case "retention": return row.retentionScore; case "pipeline": return row.pipelineScore; case "direction": return row.directionScore; default: return nil }
}

private func amdOSManagementAxisValue(_ row: AMDOSManagementHistoryRow, axis: String) -> Double? {
    switch axis { case "initiative": return row.initiativeScore; case "finance": return row.financeScore; case "retention": return row.retentionScore; case "pipeline": return row.pipelineScore; case "direction": return row.directionScore; default: return nil }
}

private struct AMDOSManagementCashSection: View {
    let rows: [AMDOSManagementBudgetActual]
    private var companyRows: [AMDOSManagementBudgetActual] { rows.filter { $0.scope == "company" } }
    private var months: [String] { Array(Set(companyRows.map(\.ym))).sorted().suffix(18) }
    var body: some View {
        AMDOSSectionCard("キャッシュ判断 / 月次試算表", systemImage: "yensign.circle") {
            if companyRows.isEmpty { Text("company_budget_actual_monthly のデータ待ち").foregroundStyle(AMDOSDesign.muted) }
            ForEach(months, id: \.self) { ym in
                let monthRows = companyRows.filter { $0.ym == ym }
                let budget = monthRows.compactMap(\.budgetAmount).reduce(0, +)
                let actual = monthRows.compactMap(\.actualAmount).reduce(0, +)
                let cash = monthRows.compactMap(\.cashAmount).max()
                HStack {
                    Text(ym).font(.caption.monospacedDigit()).frame(width: 58, alignment: .leading)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("予算 \(amdOSManagementYen(budget)) / 実績 \(amdOSManagementYen(actual))").font(.caption)
                        Text("差分 \(amdOSManagementYen(actual - budget)) · cash \(amdOSManagementYen(cash)) · \(monthRows.count)行").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    Spacer()
                    AMDOSStatusBadge(text: actual - budget < 0 ? "下振れ" : "確認", tint: actual - budget < 0 ? .red : AMDOSDesign.success)
                }
            }
        }
    }
}

private struct AMDOSManagementSignalSection: View {
    let reviews: [AMDOSManagementSignalReview]
    var body: some View {
        AMDOSSectionCard("経営シグナル評価", systemImage: "waveform.path.ecg") {
            if reviews.isEmpty { Text("月末レビュー待ち").foregroundStyle(AMDOSDesign.muted) }
            ForEach(reviews) { review in
                DisclosureGroup {
                    Text(review.summary).textSelection(.enabled)
                    if let forecast = review.forecastSummary { Text(forecast).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    ForEach([
                        ("コスト", review.costActions), ("パイプライン", review.pipelineActions), ("差分", review.varianceFindings),
                        ("リスク", review.riskAlerts), ("判断", review.decisionSignals)
                    ], id: \.0) { label, data in
                        if let text = data?.text, !text.isEmpty { AMDOSLineItem(title: label, subtitle: text, status: nil) }
                    }
                    Text("作成 \(amdOSManagementDate(review.reviewedAt)) · \(review.codexThreadID ?? "Codex評価待ち")").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                } label: {
                    HStack { AMDOSStatusBadge(text: review.status); Text(review.ym).font(.caption.monospacedDigit()); Text(review.summary).font(.subheadline).lineLimit(1) }
                }
            }
        }
    }
}

private struct AMDOSManagementConfirmedSignalSection: View {
    let signals: [AMDOSManagementStrategySignal]
    var body: some View {
        AMDOSSectionCard("議論から確認済みの経営シグナル", systemImage: "bubble.left.and.waveform") {
            if signals.isEmpty { Text("confirmed signal データ待ち").foregroundStyle(AMDOSDesign.muted) }
            ForEach(signals) { signal in
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack { AMDOSStatusBadge(text: signal.signalType); Text(signal.projectID).font(.caption); AMDOSStatusBadge(text: signal.decisionState, tint: AMDOSDesign.success); Spacer(); Text(signal.confirmedAt ?? signal.ym ?? "—").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                        Text(signal.title).font(.subheadline.weight(.semibold))
                        if let summary = signal.summary { Text(summary).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                        if let impact = signal.scoreImpactSummary { Text(impact).font(.caption).foregroundStyle(AMDOSDesign.blue) }
                    }
                }
            }
        }
    }
}

// MARK: - Proactive TODO

private struct AMDOSParityProactiveTodo: Decodable, Sendable, Identifiable {
    let id: String
    let projectID: String
    let triggerKind: String
    let sourceMeetingID: String?
    let sourceEventID: String?
    let title: String
    let detail: String?
    let ballOwner: String
    let dueAt: String
    let priority: String
    let status: String
    let resolvedNote: String?
    let resolvedBy: String?
    let createdAt: String
    let updatedAt: String
    enum CodingKeys: String, CodingKey {
        case id, projectID = "project_id", triggerKind = "trigger_kind", sourceMeetingID = "source_meeting_id", sourceEventID = "source_event_id"
        case title, detail, ballOwner = "ball_owner", dueAt = "due_at", priority, status, resolvedNote = "resolved_note", resolvedBy = "resolved_by"
        case createdAt = "created_at", updatedAt = "updated_at"
    }
}

private struct AMDOSParityProjectName: Decodable, Sendable {
    let id: String
    let name: String
    enum CodingKeys: String, CodingKey { case id = "project_id", name = "project_name" }
}

private struct AMDOSProactiveReopenPatch: Encodable, Sendable {
    let status: String
    let resolvedNote: String?
    let resolvedBy: String?
    let resolvedAt: String?
    enum CodingKeys: String, CodingKey { case status, resolvedNote = "resolved_note", resolvedBy = "resolved_by", resolvedAt = "resolved_at" }
}

@MainActor
private final class AMDOSProactiveParityStore: ObservableObject {
    @Published var todos: [AMDOSParityProactiveTodo] = []
    @Published var projects: [String: String] = [:]
    @Published var tab = "open"
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?
    @Published var busyID: String?

    func load() async {
        state = .loading
        message = nil
        do {
            async let nextTodos = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityProactiveTodo.self,
                table: "proactive_todos",
                select: "id,project_id,trigger_kind,source_meeting_id,source_event_id,title,detail,ball_owner,due_at,priority,status,resolved_note,resolved_by,created_at,updated_at",
                filters: ["status": "eq.\(tab)"], order: "priority.asc,due_at.asc", limit: 200
            )
            async let nextProjects = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityProjectName.self,
                table: "projects",
                select: "project_id,project_name",
                limit: 500
            )
            todos = try await nextTodos
            projects = Dictionary(uniqueKeysWithValues: try await nextProjects.map { ($0.id, $0.name) })
            state = todos.isEmpty ? .empty : .loaded
        } catch {
            message = error.localizedDescription
            state = .failed(message ?? "先手TODOを取得できなかった")
        }
    }

    func resolve(_ todo: AMDOSParityProactiveTodo, action: String, note: String?) async {
        busyID = todo.id
        defer { busyID = nil }
        do {
            _ = try await AMDOSRESTClient.shared.sendPWA(path: "/api/proactive-todos/\(todo.id)/resolve", body: AMDOSProactiveResolveInput(action: action, note: note?.trimmedNonEmpty))
            await load()
        } catch { message = error.localizedDescription }
    }

    func reopen(_ todo: AMDOSParityProactiveTodo) async {
        busyID = todo.id
        defer { busyID = nil }
        do {
            _ = try await AMDOSRESTClient.shared.patchTable(table: "proactive_todos", filters: ["id": "eq.\(todo.id)"], body: AMDOSProactiveReopenPatch(status: "open", resolvedNote: nil, resolvedBy: nil, resolvedAt: nil))
            await load()
        } catch { message = error.localizedDescription }
    }
}

private func amdOSProactiveDue(_ iso: String) -> (String, Bool) {
    guard let date = ISO8601DateFormatter().date(from: iso) else { return (iso, false) }
    let hours = Int(date.timeIntervalSinceNow / 3600)
    if hours < 0 {
        let overdue = abs(hours)
        return (overdue >= 24 ? "\(overdue / 24)日超過" : "\(overdue)h超過", true)
    }
    if hours <= 24 { return ("残\(hours)h", false) }
    if hours <= 72 { return ("残\(hours)h", false) }
    return ("残\(max(1, hours / 24))日", false)
}

private func amdOSProactiveTrigger(_ value: String) -> String {
    ["meeting_next_action": "MTG決定事項", "next_meeting_prep": "次回MTG準備", "email_action_request": "メール依頼"][value] ?? value
}

private func amdOSProactiveBall(_ value: String) -> String {
    ["amd": "AMDボール", "ambiguous": "ボール曖昧", "counterpart": "相手ボール"][value] ?? value
}

struct AMDOSParityProactiveView: View {
    let onSelectProject: (String) -> Void
    @StateObject private var store = AMDOSProactiveParityStore()
    @State private var expandedID: String?
    @State private var blockNote = ""
    private let tabs = [("open", "未対応"), ("blocked", "ブロック中"), ("done", "完了"), ("dismissed", "関係ない")]
    var body: some View {
        AMDOSPageScaffold(eyebrow: "PROACTIVE TODO", title: "先手TODO", subtitle: "全PJ横断・期限順。MTGのnext_action、次回準備、期限付きメール依頼をadmin権限で消化") {
            Picker("状態", selection: Binding(get: { store.tab }, set: { store.tab = $0; Task { await store.load() } })) {
                ForEach(tabs, id: \.0) { Text($0.1).tag($0.0) }
            }
            .pickerStyle(.segmented)
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if let message = store.message { Text(message).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
            if store.tab == "open" {
                let overdue = store.todos.filter { amdOSProactiveDue($0.dueAt).1 }.count
                if overdue > 0 { AMDOSCard { Label("期限超過 \(overdue)件", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) } }
            }
            ForEach(store.todos) { todo in
                let expanded = expandedID == todo.id
                let due = amdOSProactiveDue(todo.dueAt)
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Button { expandedID = expanded ? nil : todo.id } label: {
                            HStack(alignment: .top, spacing: 8) {
                                AMDOSStatusBadge(text: due.0, tint: due.1 ? .red : AMDOSDesign.warning)
                                AMDOSStatusBadge(text: amdOSProactiveTrigger(todo.triggerKind))
                                AMDOSStatusBadge(text: amdOSProactiveBall(todo.ballOwner), tint: todo.ballOwner == "amd" ? AMDOSDesign.blue : AMDOSDesign.muted)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(store.projects[todo.projectID] ?? todo.projectID).font(.caption.weight(.semibold))
                                    Text(todo.title.replacingOccurrences(of: "^[a-z0-9]+\\s", with: "", options: .regularExpression)).font(.subheadline).multilineTextAlignment(.leading)
                                }
                                Spacer()
                                Image(systemName: expanded ? "chevron.up" : "chevron.down").foregroundStyle(AMDOSDesign.muted)
                            }
                        }
                        .buttonStyle(.plain)
                        if expanded {
                            if let detail = todo.detail?.trimmedNonEmpty { Text(detail).font(.caption).textSelection(.enabled) }
                            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 5) {
                                GridRow { Text("期限").foregroundStyle(AMDOSDesign.muted); Text(amdOSManagementDate(todo.dueAt)) }
                                GridRow { Text("検知").foregroundStyle(AMDOSDesign.muted); Text(amdOSProactiveTrigger(todo.triggerKind)) }
                                GridRow { Text("ボール").foregroundStyle(AMDOSDesign.muted); Text(amdOSProactiveBall(todo.ballOwner)) }
                                GridRow { Text("優先度").foregroundStyle(AMDOSDesign.muted); Text(todo.priority == "red" ? "🔴 red" : "通常") }
                                GridRow { Text("作成 / 更新").foregroundStyle(AMDOSDesign.muted); Text("\(amdOSManagementDate(todo.createdAt)) / \(amdOSManagementDate(todo.updatedAt))") }
                                if let meeting = todo.sourceMeetingID { GridRow { Text("元MTG").foregroundStyle(AMDOSDesign.muted); Text(meeting) } }
                                if let event = todo.sourceEventID { GridRow { Text("元予定MTG").foregroundStyle(AMDOSDesign.muted); Text(event) } }
                                if let note = todo.resolvedNote { GridRow { Text("メモ").foregroundStyle(AMDOSDesign.muted); Text(note) } }
                                if let by = todo.resolvedBy { GridRow { Text("処理者").foregroundStyle(AMDOSDesign.muted); Text(by) } }
                            }
                            if todo.status == "open" || todo.status == "blocked" {
                                HStack {
                                    Button("完了") { Task { await store.resolve(todo, action: "done", note: nil) } }.buttonStyle(.borderedProminent).tint(AMDOSDesign.success)
                                    if todo.status == "open" {
                                        TextField("ブロック理由 (任意・1行)", text: $blockNote)
                                        Button("ブロック中 (3日後に復帰)") { Task { await store.resolve(todo, action: "blocked", note: blockNote) } }.buttonStyle(.bordered).tint(AMDOSDesign.warning)
                                    }
                                    Button("関係ない (二度と出さない)") { Task { await store.resolve(todo, action: "dismissed", note: nil) } }.buttonStyle(.bordered).tint(AMDOSDesign.muted)
                                }
                            } else {
                                Button("未対応に戻す") { Task { await store.reopen(todo) } }.buttonStyle(.bordered)
                            }
                            Button("\(store.projects[todo.projectID] ?? todo.projectID) のcockpitを開く") {
                                onSelectProject(todo.projectID)
                            }
                            .buttonStyle(.link)
                        }
                    }
                }
                .opacity(store.busyID == todo.id ? 0.55 : 1)
            }
        }
        .task { await store.load() }
    }
}

// MARK: - Atlas decisions

private struct AMDOSParityAtlasDecisionRow: Codable, Identifiable, Sendable {
    let id: String
    let topicID: String?
    let decidedAt: String
    let action: String
    let rationale: String?
    let outcomeEvalAt: String?
    let outcome: String?
    let createdAt: String?
    enum CodingKeys: String, CodingKey {
        case id, topicID = "topic_id", decidedAt = "decided_at", action, rationale
        case outcomeEvalAt = "outcome_eval_at", outcome, createdAt = "created_at"
    }
}

private struct AMDOSParityAtlasDecisionCreate: Encodable, Sendable {
    let topicID: String?
    let action: String
    let rationale: String?
    let decidedAt: String
    let outcomeEvalAt: String?
    enum CodingKeys: String, CodingKey { case topicID = "topicId", action, rationale, decidedAt, outcomeEvalAt }
}

private struct AMDOSParityAtlasDecisionPatch: Encodable, Sendable {
    let id: String
    let action: String?
    let rationale: String?
    let outcomeEvalAt: String?
    let outcome: String?
    enum CodingKeys: String, CodingKey { case id, action, rationale, outcomeEvalAt, outcome }
}

@MainActor
private final class AMDOSParityAtlasDecisionStore: ObservableObject {
    @Published var rows: [AMDOSParityAtlasDecisionRow] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?

    func load() async {
        state = .loading
        do {
            rows = try await AMDOSRESTClient.shared.fetchTable(
                AMDOSParityAtlasDecisionRow.self,
                table: "atlas_decisions",
                select: "id,topic_id,decided_at,action,rationale,outcome_eval_at,outcome,created_at",
                order: "decided_at.desc",
                limit: 500
            )
            state = rows.isEmpty ? .empty : .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func create(topicID: String?, action: String, rationale: String?, decidedAt: String?, outcomeEvalAt: String?) async -> Bool {
        await write {
            let data = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/atlas/decisions",
                body: AMDOSParityAtlasDecisionCreate(topicID: topicID, action: action, rationale: rationale, decidedAt: decidedAt ?? ISO8601DateFormatter().string(from: .now), outcomeEvalAt: outcomeEvalAt)
            )
            let response = try JSONDecoder().decode(AMDOSParityAtlasMutationResponse.self, from: data)
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "判断ログを保存できなかった") }
        }
    }

    func update(_ id: String, action: String?, rationale: String?, outcomeEvalAt: String?, outcome: String?) async -> Bool {
        await write {
            let data = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/atlas/decisions",
                method: "PATCH",
                body: AMDOSParityAtlasDecisionPatch(id: id, action: action, rationale: rationale, outcomeEvalAt: outcomeEvalAt, outcome: outcome)
            )
            let response = try JSONDecoder().decode(AMDOSParityAtlasMutationResponse.self, from: data)
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "判断ログを更新できなかった") }
        }
    }

    private func write(_ operation: @escaping @Sendable () async throws -> Void) async -> Bool {
        do {
            try await operation()
            message = "判断ログを保存したよ"
            await load()
            return true
        } catch {
            message = error.localizedDescription
            return false
        }
    }
}

struct AMDOSParityAtlasDecisionsView: View {
    let onOpenAtlas: () -> Void
    @StateObject private var store = AMDOSParityAtlasDecisionStore()
    @State private var action = "保留"
    @State private var rationale = ""
    @State private var decidedAt = amdOSParityAtlasDateInput(from: ISO8601DateFormatter().string(from: .now))
    @State private var outcomeEvalAt = ""
    @State private var selectedID: String?
    @State private var outcome = ""
    private let actions = ["起業", "スタジオ", "支援", "スルー", "保留"]

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ATLAS DECISIONS", title: "判断ログ", subtitle: "PWAのatlas_decisionsと同じ判断・理由・振り返り予定・結果を記録する") {
            HStack {
                Button("← Atlas", action: onOpenAtlas).buttonStyle(.link)
                Spacer()
            }
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            AMDOSSectionCard("判断を記録", systemImage: "plus.circle") {
                Picker("判断", selection: $action) { ForEach(actions, id: \.self) { Text($0).tag($0) } }.pickerStyle(.segmented)
                AMDOSTextField(title: "判断理由", text: $rationale, axis: .vertical)
                Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 8) {
                    GridRow { AMDOSTextField(title: "判断日 YYYY-MM-DD", text: $decidedAt); AMDOSTextField(title: "振り返り予定日 YYYY-MM-DD", text: $outcomeEvalAt) }
                }
                Button("判断を保存") {
                    guard amdOSParityAtlasDateInputIsValid(decidedAt), amdOSParityAtlasDateInputIsValid(outcomeEvalAt) else {
                        store.message = "日付は YYYY-MM-DD で入力してね"
                        return
                    }
                    let decisionISO = decidedAt.trimmedNonEmpty.flatMap(amdOSParityAtlasDateInputToISO)
                    let evaluationISO = outcomeEvalAt.trimmedNonEmpty.flatMap(amdOSParityAtlasDateInputToISO)
                    Task {
                        guard await store.create(topicID: nil, action: action, rationale: rationale.trimmedNonEmpty, decidedAt: decisionISO, outcomeEvalAt: evaluationISO) else { return }
                        // PWAの作成モーダルが閉じた後に次回は新規入力になるのと同じ状態へ戻す。
                        action = "保留"
                        rationale = ""
                        decidedAt = amdOSParityAtlasDateInput(from: ISO8601DateFormatter().string(from: .now))
                        outcomeEvalAt = ""
                    }
                }.buttonStyle(.borderedProminent)
                if let message = store.message { Text(message).font(.caption).foregroundStyle(AMDOSDesign.muted) }
            }
            ForEach(store.rows) { row in
                AMDOSSectionCard(row.rationale?.trimmedNonEmpty ?? "判断ログ", systemImage: "checkmark.seal") {
                    let isEvalDue = amdOSParityAtlasDate(from: row.outcomeEvalAt).map { $0 <= .now } == true && row.outcome?.trimmedNonEmpty == nil
                    HStack { AMDOSStatusBadge(text: row.action, tint: amdOSAtlasDecisionColor(row.action)); Spacer(); Text(amdOSParityAtlasLocalDate(row.decidedAt)).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    if let topicID = row.topicID { Text("topic \(topicID)").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                    if let eval = row.outcomeEvalAt { Text("振り返り予定 \(amdOSParityAtlasLocalDate(eval))\(isEvalDue ? " ⚠️" : "")").font(.caption).foregroundStyle(isEvalDue ? AMDOSDesign.warning : AMDOSDesign.muted) }
                    if let result = row.outcome?.trimmedNonEmpty { Text("結果: \(result)").font(.caption).textSelection(.enabled) }
                    Button(selectedID == row.id ? "編集を閉じる" : "結果を追記") {
                        if selectedID == row.id { selectedID = nil }
                        else { selectedID = row.id; action = row.action; rationale = row.rationale ?? ""; outcomeEvalAt = amdOSParityAtlasDateInput(from: row.outcomeEvalAt); outcome = row.outcome ?? "" }
                    }.buttonStyle(.bordered)
                    if selectedID == row.id {
                        Picker("判断", selection: $action) { ForEach(actions, id: \.self) { Text($0).tag($0) } }
                        AMDOSTextField(title: "理由", text: $rationale, axis: .vertical)
                        AMDOSTextField(title: "振り返り予定日 YYYY-MM-DD", text: $outcomeEvalAt)
                        AMDOSTextField(title: "結果", text: $outcome, axis: .vertical)
                        Button("更新") {
                            guard amdOSParityAtlasDateInputIsValid(outcomeEvalAt) else {
                                store.message = "日付は YYYY-MM-DD で入力してね"
                                return
                            }
                            let evaluationISO = outcomeEvalAt.trimmedNonEmpty.flatMap(amdOSParityAtlasDateInputToISO)
                            Task {
                                if await store.update(row.id, action: action, rationale: rationale.trimmedNonEmpty, outcomeEvalAt: evaluationISO, outcome: outcome.trimmedNonEmpty) {
                                    selectedID = nil
                                }
                            }
                        }.buttonStyle(.borderedProminent)
                    }
                }
            }
        }.task { await store.load() }
    }
}

private func amdOSAtlasDecisionColor(_ action: String) -> Color {
    switch action { case "起業": return AMDOSDesign.success; case "スタジオ": return AMDOSDesign.blue; case "支援": return .purple; case "スルー": return AMDOSDesign.muted; default: return AMDOSDesign.warning }
}

/// PWAの `new Date(yyyy-MM-dd + "T00:00:00").toISOString()` と同じ日付変換。
/// 入力は端末のローカル日付として解釈し、DBにはUTC ISO8601を送る。
private func amdOSParityAtlasDateInputToISO(_ value: String) -> String? {
    guard let date = amdOSParityAtlasDateInputFormatter.date(from: value), amdOSParityAtlasDateInputFormatter.string(from: date) == value else { return nil }
    return ISO8601DateFormatter().string(from: date)
}

private func amdOSParityAtlasDateInputIsValid(_ value: String) -> Bool {
    guard let value = value.trimmedNonEmpty else { return true }
    return amdOSParityAtlasDateInputToISO(value) != nil
}

private func amdOSParityAtlasDateInput(from iso: String?) -> String {
    guard let date = amdOSParityAtlasDate(from: iso) else { return "" }
    return amdOSParityAtlasDateInputFormatter.string(from: date)
}

private func amdOSParityAtlasLocalDate(_ iso: String) -> String {
    guard let date = amdOSParityAtlasDate(from: iso) else { return iso }
    return amdOSParityAtlasDisplayDateFormatter.string(from: date)
}

private func amdOSParityAtlasDate(from iso: String?) -> Date? {
    guard let iso else { return nil }
    return ISO8601DateFormatter().date(from: iso)
}

private let amdOSParityAtlasDateInputFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .current
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    return formatter
}()

private let amdOSParityAtlasDisplayDateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "ja_JP")
    formatter.timeZone = .current
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.dateStyle = .medium
    formatter.timeStyle = .none
    return formatter
}()

// MARK: - Atlas Macrotrends

/// The PWA macrotrend map is a taxonomy/evidence surface, rather than a list
/// of atlas signals. Keep the taxonomy local (it is the same published
/// taxonomy as the PWA) and load every changing count from the authenticated
/// Supabase boundary below.
private struct AMDOSMacroSubIssue: Identifiable, Sendable {
    let title: String
    let seedFit: String
    let keywords: [String]
    let domains: [String]
    var id: String { title }
}

private struct AMDOSMacroIssue: Identifiable, Sendable {
    let id: String
    let title: String
    let summary: String
    let horizon: String
    let keywords: [String]
    let authoritativeMap: [String]
    let evidenceClaims: [(source: String, claim: String)]
    let subIssues: [AMDOSMacroSubIssue]
    let thesis2030: String
    let thesis2040: String
    let thesis2050: String
    let coverageBasis: String
}

private struct AMDOSMacroStoryRow: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let summary: String?
    let tags: [String]?
    let primaryDomain: String?
    let importance: String?
    enum CodingKeys: String, CodingKey {
        case id, title, summary, tags, primaryDomain = "primary_domain", importance
    }
}

private struct AMDOSMacroSignalRow: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let content: String
    let sourceURL: String?
    let sourceType: String?
    let domain: String?
    let importance: String?
    let status: String?
    let suggestedTags: [String]?
    enum CodingKeys: String, CodingKey {
        case id, title, content, sourceURL = "source_url", sourceType = "source_type", domain, importance, status, suggestedTags = "suggested_tags"
    }
}

private struct AMDOSMacroThemeRow: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let primaryDomain: String?
    let tagKeywords: [String]?
    enum CodingKeys: String, CodingKey {
        case id, name, description, primaryDomain = "primary_domain", tagKeywords = "tag_keywords"
    }
}

private struct AMDOSMacroDivergenceRow: Decodable, Identifiable, Sendable {
    let id: String
    let themeID: String
    let globalSummary: String?
    let japanSummary: String?
    let divergenceMessage: String?
    let divergenceScore: Double?
    let globalSignalCount: Int?
    let japanSignalCount: Int?
    enum CodingKeys: String, CodingKey {
        case id, themeID = "theme_id", globalSummary = "global_summary", japanSummary = "japan_summary"
        case divergenceMessage = "divergence_message", divergenceScore = "divergence_score"
        case globalSignalCount = "global_signal_count", japanSignalCount = "japan_signal_count"
    }
}

private struct AMDOSMacroDivergence: Identifiable, Sendable {
    let row: AMDOSMacroDivergenceRow
    let theme: AMDOSMacroThemeRow
    var id: String { row.id }
}

private struct AMDOSMacroPaperRow: Decodable, Sendable {
    let lane: String
    let observedAt: String
    let paperCount: Double
    enum CodingKeys: String, CodingKey { case lane, observedAt = "observed_at", paperCount = "paper_count" }
}

private struct AMDOSMacroMetrics: Sendable {
    let papers: Int
    let news: Int
    let divergences: Int
    let seeds: Int
    let momentum: Int
    let coverage: Int
    let gap: Int
    let actionLabel: String
    let actionReason: String
    let intensity: String
}

private struct AMDOSMacroGroup: Identifiable, Sendable {
    let issue: AMDOSMacroIssue
    let stories: [AMDOSMacroStoryRow]
    let signals: [AMDOSMacroSignalRow]
    let divergences: [AMDOSMacroDivergence]
    let seeds: [AMDOSParitySeed]
    let urgency: Int
    let coverage: Int
    var id: String { issue.id }
}

@MainActor
private final class AMDOSParityMacrotrendsStore: ObservableObject {
    @Published var stories: [AMDOSMacroStoryRow] = []
    @Published var signals: [AMDOSMacroSignalRow] = []
    @Published var divergences: [AMDOSMacroDivergence] = []
    @Published var seeds: [AMDOSParitySeed] = []
    @Published var papers: [AMDOSMacroPaperRow] = []
    @Published var state: AMDOSFeatureLoadState = .idle

    func load() async {
        state = .loading
        do {
            async let storyRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSMacroStoryRow.self,
                table: "atlas_stories",
                select: "id,title,summary,tags,primary_domain,importance",
                order: "last_updated_at.desc",
                limit: 500
            )
            async let signalRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSMacroSignalRow.self,
                table: "atlas_signals",
                select: "id,title,content,source_url,source_type,domain,importance,status,suggested_tags",
                filters: ["status": "eq.accepted"],
                order: "submitted_at.desc",
                limit: 500
            )
            async let themeRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSMacroThemeRow.self,
                table: "atlas_themes",
                select: "id,name,description,primary_domain,tag_keywords",
                filters: ["status": "eq.active"],
                limit: 500
            )
            async let divergenceRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSMacroDivergenceRow.self,
                table: "atlas_divergences",
                select: "id,theme_id,global_summary,japan_summary,divergence_message,divergence_score,global_signal_count,japan_signal_count",
                order: "divergence_score.desc",
                limit: 500
            )
            async let seedRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParitySeed.self,
                table: "seeds",
                select: "id,title,summary,org_name,org_type,org_region,org_url,researcher_name,researcher_title,lab_name,researcher_url,domain_lane,industry_target,keywords,trl,brl,hrl,status,amd_rating,amd_rating_note,amd_owner_member_id,next_action,internal_notes,public_summary,is_public,spun_off_project_id,source,source_detail,deep_dive_material_url,discovery_status,created_at,updated_at",
                order: "updated_at.desc",
                limit: 500
            )
            async let paperRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSMacroPaperRow.self,
                table: "papers_log",
                select: "lane,observed_at,paper_count",
                order: "observed_at.asc",
                limit: 2_000
            )
            let (loadedStories, loadedSignals, themes, loadedDivergences, loadedSeeds, loadedPapers) = try await (storyRows, signalRows, themeRows, divergenceRows, seedRows, paperRows)
            let themeByID = Dictionary(uniqueKeysWithValues: themes.map { ($0.id, $0) })
            stories = loadedStories
            signals = loadedSignals
            seeds = loadedSeeds
            papers = loadedPapers
            divergences = loadedDivergences.compactMap { row in
                guard let theme = themeByID[row.themeID] else { return nil }
                return AMDOSMacroDivergence(row: row, theme: theme)
            }
            state = stories.isEmpty && signals.isEmpty && divergences.isEmpty && seeds.isEmpty && papers.isEmpty ? .empty : .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

private enum AMDOSMacroTaxonomy {
    static let issues: [AMDOSMacroIssue] = [
        AMDOSMacroIssue(
            id: "advanced_ict", title: "通信・ICT", summary: "計算基盤、通信網、クラウド/エッジ、サイバーセキュリティを同じ観測laneで見る。", horizon: "2026 / 2030 / 2040",
            keywords: ["ict", "communication", "computing", "cloud", "edge", "cyber", "通信", "計算", "クラウド", "エッジ", "サイバー"],
            authoritativeMap: ["ASPI: advanced_ict", "WEF: cyber insecurity / infrastructure disruption", "UN SDG9", "UN SDG16", "UN SDG17"],
            evidenceClaims: [("ASPI Critical Technology Tracker", "Advanced ICT は計算、通信、分散台帳、サイバー防御などをまとめるASPI domain。AMD ScoreのM算定と同じlaneを使う。"), ("WEF Global Risks", "Cyber insecurity、critical infrastructure disruption、mis/disinformation と結びつく横断リスクとして扱う。")],
            subIssues: [
                AMDOSMacroSubIssue(title: "高性能計算・クラウド/エッジ", seedFit: "HPC、edge AI、低遅延処理、分散推論基盤", keywords: ["HPC", "高性能計算", "クラウド", "エッジ", "edge", "computing"], domains: ["advanced_ict", "ai_technologies"]),
                AMDOSMacroSubIssue(title: "光/無線/海底通信インフラ", seedFit: "光通信、RF、衛星/海底通信、耐障害ネットワーク", keywords: ["光通信", "無線", "海底", "通信", "radiofrequency", "optical"], domains: ["advanced_ict", "sensing_timing_navigation"]),
                AMDOSMacroSubIssue(title: "サイバー防御・分散台帳", seedFit: "認証、改ざん検知、ゼロトラスト、分散記録", keywords: ["サイバー", "暗号", "認証", "分散台帳", "cyber", "ledger"], domains: ["advanced_ict"])
            ],
            thesis2030: "AI利用増と地政学的分断で、計算資源・通信・サイバー防御が産業インフラになる。", thesis2040: "クラウド中心から、エッジ・衛星・海底・分散計算を組み合わせる耐障害ネットワークへ移る。", thesis2050: "情報通信は単独産業ではなく、全deeptechの観測・制御・安全保障レイヤーになる。", coverageBasis: "ASPI 8 domainの1つとしてM算定のlaneと一致。WEFのcyber / infrastructure / misinformation系riskを重ねる。"
        ),
        AMDOSMacroIssue(
            id: "advanced_materials_manufacturing", title: "先端材料・製造", summary: "材料性能、重要鉱物、半導体、積層造形、製造プロセスを同じ観測laneで見る。", horizon: "2030 / 2040",
            keywords: ["materials", "manufacturing", "mineral", "semiconductor", "metamaterial", "素材", "材料", "製造", "鉱物", "半導体"],
            authoritativeMap: ["ASPI: advanced_materials_manufacturing", "WEF: strategic resources / supply chain", "UN SDG9", "UN SDG12"],
            evidenceClaims: [("ASPI Critical Technology Tracker", "Advanced materials and manufacturing は材料・製造技術のASPI domainで、AMDの既存PJ laneにも接続する。"), ("WEF Global Risks", "Strategic resources、supply chain disruption、geoeconomic confrontation と重なる。")],
            subIssues: [
                AMDOSMacroSubIssue(title: "重要鉱物・分離精製", seedFit: "低使用量設計、分離精製、代替材料、回収技術", keywords: ["鉱物", "分離", "精製", "回収", "critical minerals", "mineral"], domains: ["advanced_materials_manufacturing", "energy_environment"]),
                AMDOSMacroSubIssue(title: "高機能材料・メタマテリアル", seedFit: "断熱、超電導、スマート材料、複合材、保護材料", keywords: ["メタマテリアル", "複合材", "断熱", "超電導", "smart materials"], domains: ["advanced_materials_manufacturing"]),
                AMDOSMacroSubIssue(title: "先端製造・積層造形", seedFit: "積層造形、精密加工、連続フロー合成、製造検査", keywords: ["積層造形", "精密加工", "製造", "additive manufacturing", "machining"], domains: ["advanced_materials_manufacturing", "sensing_timing_navigation"])
            ],
            thesis2030: "材料供給制約と性能要求が、事業成立のボトルネックとして前面に出る。", thesis2040: "材料は性能だけでなく、調達可能性・製造可能性・循環可能性で評価される。", thesis2050: "先端材料と製造プロセスは、エネルギー、宇宙、防衛、医療の共通基盤になる。", coverageBasis: "ASPI 8 domainの材料/製造lane。旧materials/gx_circularの多くがここまたはenergy_environmentへ移行済み。"
        ),
        AMDOSMacroIssue(
            id: "ai_technologies", title: "AI", summary: "生成AI、機械学習、computer vision、AI hardware、adversarial AIを同じ観測laneで見る。", horizon: "2026 / 2030 / 2040",
            keywords: ["ai", "machine learning", "generative", "vision", "adversarial", "生成AI", "機械学習", "画像認識"],
            authoritativeMap: ["ASPI: ai_technologies", "WEF: adverse outcomes of AI / misinformation", "UN SDG8", "UN SDG9"],
            evidenceClaims: [("ASPI Critical Technology Tracker", "AI technologies はAI algorithms、hardware accelerators、advanced analytics、NLP、computer vision、generative AIを含む。"), ("WEF Global Risks", "AIはfrontier technology risk、mis/disinformation、talent and labour shiftsと接続する。")],
            subIssues: [
                AMDOSMacroSubIssue(title: "生成AI・基盤モデル", seedFit: "業務自動化、設計支援、科学探索、生成AI安全性", keywords: ["生成AI", "基盤モデル", "LLM", "generative", "language model"], domains: ["ai_technologies", "advanced_ict"]),
                AMDOSMacroSubIssue(title: "Computer vision・高度分析", seedFit: "検査、医療画像、環境監視、現場認識", keywords: ["画像認識", "検査", "vision", "analytics", "computer vision"], domains: ["ai_technologies", "sensing_timing_navigation"]),
                AMDOSMacroSubIssue(title: "Adversarial AI・信頼性", seedFit: "安全評価、異常検知、検証、攻撃耐性", keywords: ["adversarial", "AI安全", "信頼性", "異常検知", "safety"], domains: ["ai_technologies", "advanced_ict"])
            ],
            thesis2030: "生成AIは情報処理だけでなく、設計・研究・現場判断の標準機能になる。", thesis2040: "AIは物理世界のセンサ、ロボット、材料探索、医療判断へ深く入り込む。", thesis2050: "AIの価値は性能だけでなく、信頼性・安全性・検証可能性で決まる。", coverageBasis: "ASPI 8 domainのAI lane。MacrotrendではM算定と同じlaneでpapers_logを読む。"
        ),
        AMDOSMacroIssue(
            id: "biotechnology", title: "バイオ・医療", summary: "創薬、合成生物学、ゲノム、ワクチン、再生医療、BCI/神経補綴を同じ観測laneで見る。", horizon: "2030 / 2040 / 2050",
            keywords: ["bio", "biotechnology", "medical", "health", "genome", "synthetic biology", "バイオ", "医療", "創薬", "ゲノム", "再生医療"],
            authoritativeMap: ["ASPI: biotechnology", "WEF: infectious diseases / health decline", "UN SDG3", "UN SDG10"],
            evidenceClaims: [("ASPI Critical Technology Tracker", "Biotechnology はsynthetic biology、genetic engineering、genomic sequencing、vaccines、neuroprostheticsなどを含む。"), ("UN 2030 Agenda", "健康、福祉、格差、医療アクセスの課題をdeeptech seedへ接続する。")],
            subIssues: [
                AMDOSMacroSubIssue(title: "創薬・ゲノム・遺伝子技術", seedFit: "創薬AI、ゲノム解析、遺伝子治療、核医学", keywords: ["創薬", "ゲノム", "遺伝子", "drug discovery", "genomic", "gene therapy"], domains: ["biotechnology", "ai_technologies"]),
                AMDOSMacroSubIssue(title: "合成生物学・バイオ製造", seedFit: "微生物生産、バイオ素材、ワクチン/抗ウイルス", keywords: ["合成生物学", "バイオ製造", "ワクチン", "synthetic biology", "vaccine"], domains: ["biotechnology", "advanced_materials_manufacturing"]),
                AMDOSMacroSubIssue(title: "再生医療・神経補綴", seedFit: "再生医療、BCI、リハビリ、身体/認知機能支援", keywords: ["再生医療", "神経", "リハビリ", "BCI", "neuroprosthetics"], domains: ["biotechnology", "sensing_timing_navigation"])
            ],
            thesis2030: "創薬・診断・バイオ製造のデータ駆動化が進む。", thesis2040: "医療は治療中心から、予測・予防・機能維持へ比重が移る。", thesis2050: "バイオ技術は医療だけでなく、材料、食料、環境適応の基盤技術になる。", coverageBasis: "ASPI 8 domainのバイオlane。ケア/健康リスクはUN/WEF overlayとして扱う。"
        ),
        AMDOSMacroIssue(
            id: "defence_space_robotics_transport", title: "防衛・宇宙・ロボ", summary: "ロボティクス、ドローン、宇宙、輸送、防衛技術を同じ観測laneで見る。", horizon: "2026 / 2030 / 2040",
            keywords: ["robot", "space", "defence", "transport", "drone", "satellite", "ロボ", "宇宙", "防衛", "ドローン", "輸送"],
            authoritativeMap: ["ASPI: defence_space_robotics_transport", "WEF: armed conflict / infrastructure", "UN SDG9", "UN SDG11"],
            evidenceClaims: [("ASPI Critical Technology Tracker", "Defence, space, robotics and transport はadvanced robotics、autonomous systems、drones、small satellitesなどを含む。"), ("WEF Global Risks", "State-based conflict、critical infrastructure disruption、strategic technologies concentrationと重なる。")],
            subIssues: [
                AMDOSMacroSubIssue(title: "自律ロボ・ドローン群", seedFit: "現場ロボ、群制御、遠隔操作、農業/点検ロボ", keywords: ["ロボ", "ドローン", "群制御", "自律", "robot", "drone"], domains: ["defence_space_robotics_transport", "ai_technologies"]),
                AMDOSMacroSubIssue(title: "小型衛星・宇宙輸送", seedFit: "衛星通信、リモートセンシング、打上げ、宇宙データ", keywords: ["衛星", "宇宙", "打上げ", "satellite", "space launch"], domains: ["defence_space_robotics_transport", "sensing_timing_navigation", "advanced_ict"]),
                AMDOSMacroSubIssue(title: "防衛・高速輸送技術", seedFit: "先進エンジン、極超音速、耐障害輸送、安全保障用途", keywords: ["防衛", "輸送", "エンジン", "極超音速", "hypersonic"], domains: ["defence_space_robotics_transport", "advanced_materials_manufacturing"])
            ],
            thesis2030: "ロボットと宇宙データが、人手不足・安全保障・インフラ点検の共通解になる。", thesis2040: "自律システムは単体機械ではなく、AI/通信/センサと結合した運用ネットワークになる。", thesis2050: "宇宙・防衛・ロボ技術は民生インフラの安全性と競争力にも深く接続する。", coverageBasis: "ASPI 8 domainの防衛/宇宙/ロボlane。AI/ICT/センシングとの重複はnode edgeで表現する。"
        ),
        AMDOSMacroIssue(
            id: "energy_environment", title: "エネルギー・環境", summary: "電池、水素、再エネ、核、グリッド、炭素回収、循環、気候適応を同じ観測laneで見る。", horizon: "2030 / 2040 / 2050",
            keywords: ["energy", "environment", "battery", "hydrogen", "grid", "renewable", "climate", "エネルギー", "環境", "電池", "水素", "グリッド", "再エネ", "気候"],
            authoritativeMap: ["ASPI: energy_environment", "WEF: extreme weather / resources", "UN SDG6", "UN SDG7", "UN SDG13"],
            evidenceClaims: [("ASPI Critical Technology Tracker", "Energy and environment は電池、水素/アンモニア、核、太陽光、grid integrationなどを含む。"), ("WEF Global Risks", "Extreme weather、natural resource shortages、critical infrastructure disruptionと重なる。")],
            subIssues: [
                AMDOSMacroSubIssue(title: "電池・supercapacitor・蓄電", seedFit: "次世代電池、蓄電制御、電力変換、材料リサイクル", keywords: ["電池", "蓄電", "supercapacitor", "battery", "storage"], domains: ["energy_environment", "advanced_materials_manufacturing"]),
                AMDOSMacroSubIssue(title: "水素・アンモニア・核エネルギー", seedFit: "水素製造、アンモニア利用、核融合/核廃棄物、熱変換", keywords: ["水素", "アンモニア", "核", "核融合", "hydrogen", "ammonia", "nuclear"], domains: ["energy_environment", "advanced_materials_manufacturing"]),
                AMDOSMacroSubIssue(title: "グリッド統合・再エネ制約", seedFit: "系統制御、需要応答、再エネ予測、出力抑制対策", keywords: ["グリッド", "系統", "再エネ", "需要応答", "grid", "renewable"], domains: ["energy_environment", "advanced_ict", "ai_technologies"]),
                AMDOSMacroSubIssue(title: "炭素回収・循環・地球工学", seedFit: "CCUS、資源循環、環境計測、気候適応", keywords: ["炭素", "循環", "CCUS", "気候", "geoengineering", "circular"], domains: ["energy_environment", "sensing_timing_navigation"])
            ],
            thesis2030: "電力需要増、再エネ接続、重要鉱物、気候リスクが同時に制約として現れる。", thesis2040: "発電量よりも、需給調整・蓄電・系統制御・資源循環が競争力になる。", thesis2050: "エネルギー/環境技術は社会インフラ、産業立地、都市運営の前提条件になる。", coverageBasis: "ASPI 8 domainのenergy_environment lane。旧gx_energy/gx_circularの主な受け皿で、M算定と一致させる。"
        ),
        AMDOSMacroIssue(
            id: "quantum", title: "量子", summary: "量子計算、量子通信、量子センサ、ポスト量子暗号を同じ観測laneで見る。", horizon: "2030 / 2040",
            keywords: ["quantum", "post-quantum", "量子", "量子計算", "量子通信", "量子センサ", "暗号"],
            authoritativeMap: ["ASPI: quantum", "WEF: frontier technologies / cyber security", "UN SDG9"],
            evidenceClaims: [("ASPI Critical Technology Tracker", "Quantum はquantum computing、communication、sensors、post-quantum cryptographyを含む。"), ("WEF Global Risks", "Frontier technology outcomes、cyber insecurity、strategic technology concentrationと接続する。")],
            subIssues: [
                AMDOSMacroSubIssue(title: "量子計算", seedFit: "量子アルゴリズム、材料探索、最適化、誤り訂正", keywords: ["量子計算", "量子アルゴリズム", "quantum computing", "error correction"], domains: ["quantum", "advanced_ict"]),
                AMDOSMacroSubIssue(title: "量子通信・ポスト量子暗号", seedFit: "暗号移行、量子鍵配送、通信安全性", keywords: ["量子通信", "ポスト量子", "暗号", "quantum communication", "post-quantum"], domains: ["quantum", "advanced_ict"]),
                AMDOSMacroSubIssue(title: "量子センサ", seedFit: "高感度計測、医療/資源探査、測位、環境検知", keywords: ["量子センサ", "計測", "測位", "quantum sensor"], domains: ["quantum", "sensing_timing_navigation"])
            ],
            thesis2030: "量子は事業化の不確実性が高いが、暗号・計測・最適化で早期用途が出る。", thesis2040: "量子計算と量子センサが材料、医療、資源、安全保障の探索能力を変える。", thesis2050: "量子は独立市場というより、計算・通信・計測の基盤技術として埋め込まれる。", coverageBasis: "ASPI 8 domainのquantum lane。M算定ではpapers_logの独立laneとして保持する。"
        ),
        AMDOSMacroIssue(
            id: "sensing_timing_navigation", title: "センシング", summary: "光センサ、レーダ、測位、原子時計、ハイパースペクトル、音響センサを同じ観測laneで見る。", horizon: "2030 / 2040",
            keywords: ["sensor", "sensing", "radar", "navigation", "timing", "photonic", "センシング", "センサ", "レーダ", "測位", "計測"],
            authoritativeMap: ["ASPI: sensing_timing_navigation", "WEF: infrastructure / climate / security monitoring", "UN SDG9", "UN SDG11", "UN SDG13"],
            evidenceClaims: [("ASPI Critical Technology Tracker", "Sensing, timing and navigation はatomic clocks、radar、photonic sensors、satellite positioningなどを含む。"), ("UN 2030 Agenda", "都市、インフラ、気候、健康、海洋などを観測可能にする横断レイヤーとして扱う。")],
            subIssues: [
                AMDOSMacroSubIssue(title: "光/レーダ/ハイパースペクトル計測", seedFit: "非破壊検査、環境監視、医療画像、農業センシング", keywords: ["光センサ", "レーダ", "ハイパースペクトル", "検査", "photonic", "radar"], domains: ["sensing_timing_navigation", "ai_technologies"]),
                AMDOSMacroSubIssue(title: "測位・航法・原子時計", seedFit: "衛星測位、慣性航法、時刻同期、インフラ監視", keywords: ["測位", "航法", "原子時計", "GNSS", "navigation", "atomic clock"], domains: ["sensing_timing_navigation", "defence_space_robotics_transport"]),
                AMDOSMacroSubIssue(title: "社会/環境の早期警戒", seedFit: "災害予測、水/土壌監視、設備異常検知、見守り", keywords: ["早期警戒", "災害", "環境監視", "異常検知", "見守り"], domains: ["sensing_timing_navigation", "energy_environment", "biotechnology"])
            ],
            thesis2030: "センサとAIで、点検・医療・環境・防災の観測密度が上がる。", thesis2040: "社会インフラは事後対応から、連続観測と予兆介入へ移る。", thesis2050: "センシングはあらゆるdeeptechの状態把握と制御の基盤になる。", coverageBasis: "ASPI 8 domainのsensing/timing/navigation lane。他domainとのedgeが多い横断観測レイヤーとして扱う。"
        )
    ]

    static let colors: [String: Color] = [
        "advanced_ict": .cyan, "advanced_materials_manufacturing": .orange, "ai_technologies": .purple,
        "biotechnology": .green, "defence_space_robotics_transport": .pink, "energy_environment": .teal,
        "quantum": .indigo, "sensing_timing_navigation": .mint
    ]

    static let atlasPrefixes: [String: [String]] = [
        "advanced_ict": ["I.", "R."], "advanced_materials_manufacturing": ["C.", "E."], "ai_technologies": ["I."],
        "biotechnology": ["F."], "defence_space_robotics_transport": ["G.", "J."], "energy_environment": ["D.", "O.", "N."],
        "quantum": ["P."], "sensing_timing_navigation": ["Q."]
    ]
}

struct AMDOSParityMacrotrendsView: View {
    @StateObject private var store = AMDOSParityMacrotrendsStore()
    @State private var selectedDomain = AMDOSMacroTaxonomy.issues.first?.id ?? "advanced_ict"
    @State private var selectedSubIssue: String?

    private var groups: [AMDOSMacroGroup] {
        AMDOSMacroTaxonomy.issues.map { issue in
            let stories = store.stories.filter { story in
                amdOSMacroMatches(issue: issue, parts: [story.title, story.summary ?? "", (story.tags ?? []).joined(separator: " "), story.primaryDomain ?? ""]) || amdOSMacroDomainMatches(issue: issue, domain: story.primaryDomain)
            }
            let signals = store.signals.filter { signal in
                amdOSMacroMatches(issue: issue, parts: [signal.title, signal.content, signal.domain ?? "", (signal.suggestedTags ?? []).joined(separator: " ")]) || amdOSMacroDomainMatches(issue: issue, domain: signal.domain)
            }
            let divergences = store.divergences.filter { divergence in
                amdOSMacroMatches(issue: issue, parts: [divergence.theme.name, divergence.theme.description ?? "", divergence.row.divergenceMessage ?? "", divergence.row.globalSummary ?? "", divergence.row.japanSummary ?? ""]) || amdOSMacroDomainMatches(issue: issue, domain: divergence.theme.primaryDomain)
            }
            let seeds = store.seeds.filter { seed in
                amdOSMacroMatches(issue: issue, parts: [seed.title, seed.summary ?? "", seed.domainLane ?? "", (seed.industryTarget ?? []).joined(separator: " "), (seed.keywords ?? []).joined(separator: " ")]) || amdOSMacroSeedLane(seed.domainLane) == issue.id
            }
            let urgency = min(99, 38 + stories.count * 4 + signals.filter { $0.importance == "high" }.count * 7 + divergences.count * 5)
            let coverage = min(99, 24 + seeds.count * 5)
            return AMDOSMacroGroup(issue: issue, stories: stories, signals: signals, divergences: divergences, seeds: seeds, urgency: urgency, coverage: coverage)
        }
    }

    private var activeGroup: AMDOSMacroGroup? { groups.first(where: { $0.id == selectedDomain }) ?? groups.first }

    private var activeSub: AMDOSMacroSubIssue? {
        guard let group = activeGroup else { return nil }
        return group.issue.subIssues.first(where: { $0.title == selectedSubIssue }) ?? group.issue.subIssues.first
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "MACROTREND / ATLAS / SEEDS", title: "ASPI 8 domainで見るMacrotrend Map", subtitle: "AMD ScoreのM算定と同じ8分類に、Atlas evidence・Seeds・OpenAlex papers・世界/日本の乖離を重ねる") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if let group = activeGroup, store.state == .loaded || store.state == .empty {
                evidenceSummary
                domainChooser
                mindmap(group)
                selectedDomainPanel(group)
                if let sub = activeSub { selectedSubPanel(group, sub: sub) }
                taxonomyPanel(group)
            }
        }
        .task { await store.load() }
    }

    @ViewBuilder private var evidenceSummary: some View {
        HStack(spacing: 10) {
            AMDOSMetricTile(label: "Atlas signal", value: "\(store.signals.count)", detail: "accepted")
            AMDOSMetricTile(label: "Stories", value: "\(store.stories.count)", detail: "last updated")
            AMDOSMetricTile(label: "World / Japan diff", value: "\(store.divergences.count)", detail: "active theme")
            AMDOSMetricTile(label: "Seeds", value: "\(store.seeds.count)", detail: "research candidates")
            AMDOSMetricTile(label: "Paper lanes", value: "\(Set(store.papers.map(\.lane)).count)", detail: "papers_log")
        }
    }

    @ViewBuilder private var domainChooser: some View {
        AMDOSSectionCard("ASPI Domain / Issue Node", systemImage: "circle.grid.3x3.fill") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 170), spacing: 8)], spacing: 8) {
                ForEach(groups) { group in
                    Button {
                        selectedDomain = group.id
                        selectedSubIssue = nil
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack { Circle().fill(AMDOSMacroTaxonomy.colors[group.id] ?? AMDOSDesign.blue).frame(width: 8, height: 8); Text(group.issue.title).font(.subheadline.weight(.semibold)); Spacer(); Text("\(group.issue.subIssues.count) nodes").font(.caption2) }
                            Text("Atlas \(group.signals.count) · diff \(group.divergences.count) · seeds \(group.seeds.count)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            Text("gap \(amdOSMacroDomainGap(group, papers: store.papers)) · urgency \(group.urgency)").font(.caption2.monospacedDigit()).foregroundStyle(AMDOSDesign.warning)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(9)
                        .background((selectedDomain == group.id ? (AMDOSMacroTaxonomy.colors[group.id] ?? AMDOSDesign.blue).opacity(0.17) : AMDOSDesign.panel))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(selectedDomain == group.id ? (AMDOSMacroTaxonomy.colors[group.id] ?? AMDOSDesign.blue) : AMDOSDesign.border, lineWidth: selectedDomain == group.id ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder private func mindmap(_ group: AMDOSMacroGroup) -> some View {
        AMDOSSectionCard("Macrotrend Mindmap / \(group.issue.title)", systemImage: "point.3.connected.trianglepath.dotted") {
            Text("小項目nodeを選ぶと、papers / news / diff / seeds / gap / actionと、次のAMD actionを右側の判断面で確認できるよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            ForEach(group.issue.subIssues) { sub in
                let metrics = amdOSMacroMetrics(group: group, sub: sub, papers: store.papers)
                Button {
                    selectedSubIssue = sub.title
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Circle().fill(selectedSubIssue == sub.title ? AMDOSDesign.warning : (AMDOSMacroTaxonomy.colors[group.id] ?? AMDOSDesign.blue)).frame(width: 11, height: 11).padding(.top, 4)
                        VStack(alignment: .leading, spacing: 4) {
                            HStack { Text(sub.title).font(.subheadline.weight(.semibold)); AMDOSStatusBadge(text: metrics.actionLabel, tint: amdOSMacroIntensityColor(metrics.intensity)); Spacer(); Text("gap \(metrics.gap)").font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.warning) }
                            Text(sub.seedFit).font(.caption).foregroundStyle(AMDOSDesign.muted)
                            HStack(spacing: 12) { Text("papers \(metrics.papers)"); Text("news \(metrics.news)"); Text("diff \(metrics.divergences)"); Text("seeds \(metrics.seeds)"); Text("cover \(metrics.coverage)") }.font(.caption2.monospacedDigit()).foregroundStyle(AMDOSDesign.muted)
                        }
                        Image(systemName: selectedSubIssue == sub.title ? "chevron.down" : "chevron.right").foregroundStyle(AMDOSDesign.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(9)
                    .background(selectedSubIssue == sub.title ? AMDOSDesign.blue.opacity(0.1) : AMDOSDesign.panel)
                    .overlay(RoundedRectangle(cornerRadius: 7).stroke(selectedSubIssue == sub.title ? AMDOSDesign.blue : AMDOSDesign.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder private func selectedDomainPanel(_ group: AMDOSMacroGroup) -> some View {
        AMDOSSectionCard("Selected ASPI Domain / \(group.issue.title)", systemImage: "scope") {
            HStack(spacing: 10) {
                AMDOSMetricTile(label: "urgency", value: "\(group.urgency)", detail: "story / signal / diff", tint: AMDOSDesign.warning)
                AMDOSMetricTile(label: "seed cover", value: "\(group.coverage)", detail: "candidate count", tint: AMDOSDesign.success)
                AMDOSMetricTile(label: "horizon", value: group.issue.horizon, detail: "PWA taxonomy")
            }
            Text(group.issue.summary).font(.subheadline)
            HStack(alignment: .top, spacing: 8) {
                AMDOSMacroThesis(year: "2030", text: group.issue.thesis2030)
                AMDOSMacroThesis(year: "2040", text: group.issue.thesis2040)
                AMDOSMacroThesis(year: "2050", text: group.issue.thesis2050)
            }
            AMDOSSectionCard("Coverage basis", systemImage: "checkmark.seal") {
                Text(group.issue.coverageBasis).font(.caption).foregroundStyle(AMDOSDesign.muted)
                HStack(spacing: 5) { ForEach(group.issue.authoritativeMap, id: \.self) { AMDOSStatusBadge(text: $0) } }
            }
        }
    }

    @ViewBuilder private func selectedSubPanel(_ group: AMDOSMacroGroup, sub: AMDOSMacroSubIssue) -> some View {
        let metrics = amdOSMacroMetrics(group: group, sub: sub, papers: store.papers)
        AMDOSSectionCard("Selected node / \(sub.title)", systemImage: "scope") {
            HStack(spacing: 8) {
                AMDOSMetricTile(label: "papers", value: "\(metrics.papers)", detail: "latest lanes")
                AMDOSMetricTile(label: "news", value: "\(metrics.news)", detail: "Atlas evidence")
                AMDOSMetricTile(label: "diff", value: "\(metrics.divergences)", detail: "world / Japan")
                AMDOSMetricTile(label: "seeds", value: "\(metrics.seeds)", detail: "direct keyword")
                AMDOSMetricTile(label: "gap", value: "\(metrics.gap)", detail: metrics.intensity, tint: amdOSMacroIntensityColor(metrics.intensity))
            }
            AMDOSCard {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "arrow.right.circle.fill").foregroundStyle(amdOSMacroIntensityColor(metrics.intensity))
                    VStack(alignment: .leading, spacing: 4) { Text(metrics.actionLabel).font(.headline); Text(metrics.actionReason).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                }
            }
            HStack(alignment: .top, spacing: 10) {
                AMDOSSectionCard("Atlas evidence", systemImage: "antenna.radiowaves.left.and.right") {
                    ForEach(group.signals.filter { amdOSMacroKeywordMatch(sub.keywords, parts: [$0.title, $0.content, $0.domain ?? "", ($0.suggestedTags ?? []).joined(separator: " ")]) }.prefix(8)) { signal in
                        AMDOSLineItem(title: signal.title, subtitle: signal.content, status: signal.importance ?? signal.sourceType)
                    }
                    ForEach(group.stories.filter { amdOSMacroKeywordMatch(sub.keywords, parts: [$0.title, $0.summary ?? "", ($0.tags ?? []).joined(separator: " "), $0.primaryDomain ?? ""]) }.prefix(5)) { story in
                        AMDOSLineItem(title: story.title, subtitle: story.summary ?? "要約なし", status: "story")
                    }
                    if group.signals.filter({ amdOSMacroKeywordMatch(sub.keywords, parts: [$0.title, $0.content, $0.domain ?? ""]) }).isEmpty && group.stories.filter({ amdOSMacroKeywordMatch(sub.keywords, parts: [$0.title, $0.summary ?? ""]) }).isEmpty { Text("この小項目に直接一致するAtlas evidenceはないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                }
                AMDOSSectionCard("World / Japan divergence", systemImage: "arrow.triangle.branch") {
                    ForEach(group.divergences.filter { amdOSMacroKeywordMatch(sub.keywords, parts: [$0.theme.name, $0.theme.description ?? "", $0.row.divergenceMessage ?? "", $0.row.globalSummary ?? "", $0.row.japanSummary ?? ""]) }.prefix(8)) { divergence in
                        AMDOSLineItem(title: divergence.theme.name, subtitle: divergence.row.divergenceMessage ?? divergence.row.globalSummary ?? "乖離の要約なし", status: "gap \(Int(divergence.row.divergenceScore ?? 0))")
                    }
                    if group.divergences.filter({ amdOSMacroKeywordMatch(sub.keywords, parts: [$0.theme.name, $0.theme.description ?? "", $0.row.divergenceMessage ?? ""]) }).isEmpty { Text("この小項目に直接一致する乖離はないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                }
                AMDOSSectionCard("Seeds / research candidates", systemImage: "leaf.fill") {
                    ForEach(group.seeds.filter { amdOSMacroKeywordMatch(sub.keywords, parts: [$0.title, $0.summary ?? "", $0.domainLane ?? "", ($0.industryTarget ?? []).joined(separator: " "), ($0.keywords ?? []).joined(separator: " ")]) }.prefix(8)) { seed in
                        AMDOSLineItem(title: seed.title, subtitle: "\(seed.orgName) · \(seed.nextAction ?? "次アクション未設定")", status: seed.status)
                    }
                    if group.seeds.filter({ amdOSMacroKeywordMatch(sub.keywords, parts: [$0.title, $0.summary ?? "", $0.domainLane ?? "", ($0.keywords ?? []).joined(separator: " ")]) }).isEmpty { Text("この小項目に直接一致するseedはないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                }
            }
        }
    }

    @ViewBuilder private func taxonomyPanel(_ group: AMDOSMacroGroup) -> some View {
        AMDOSSectionCard("What the sources say / taxonomy alignment", systemImage: "books.vertical") {
            ForEach(Array(group.issue.evidenceClaims.enumerated()), id: \.offset) { _, claim in AMDOSLineItem(title: claim.source, subtitle: claim.claim, status: "source") }
            Text("主nodeは papers_log / macro_index_log / project_ventures.lanes と同じASPI 8 domain。UN SDGsとWEF riskは上位分類ではなく、証拠ネットワークのoverlayとして表示しているよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            ForEach(group.issue.subIssues) { sub in
                AMDOSLineItem(title: sub.title, subtitle: "交差lane: \(sub.domains.joined(separator: " · ")) · seed fit: \(sub.seedFit)", status: "node")
            }
        }
    }
}

private struct AMDOSMacroThesis: View {
    let year: String
    let text: String
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 5) { Text(year).font(.caption.weight(.bold)).foregroundStyle(AMDOSDesign.blue); Text(text).font(.caption).foregroundStyle(AMDOSDesign.muted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private func amdOSMacroMatches(issue: AMDOSMacroIssue, parts: [String]) -> Bool {
    let haystack = parts.joined(separator: " ").lowercased()
    return issue.keywords.contains { haystack.contains($0.lowercased()) } || haystack.contains(issue.id.lowercased())
}

private func amdOSMacroKeywordMatch(_ keywords: [String], parts: [String]) -> Bool {
    let haystack = parts.joined(separator: " ").lowercased()
    return keywords.contains { haystack.contains($0.lowercased()) }
}

private func amdOSMacroDomainMatches(issue: AMDOSMacroIssue, domain: String?) -> Bool {
    guard let domain else { return false }
    return AMDOSMacroTaxonomy.atlasPrefixes[issue.id, default: []].contains { domain.hasPrefix($0) }
}

private func amdOSMacroSeedLane(_ lane: String?) -> String? {
    switch lane {
    case "gx_energy": return "energy_environment"
    case "gx_circular", "materials": return "advanced_materials_manufacturing"
    case "life": return "biotechnology"
    case "robo": return "defence_space_robotics_transport"
    case "ict": return "advanced_ict"
    default: return nil
    }
}

private func amdOSMacroPaperCount(_ papers: [AMDOSMacroPaperRow], issue: AMDOSMacroIssue, sub: AMDOSMacroSubIssue) -> Int {
    let lanes = sub.domains.isEmpty ? [issue.id] : sub.domains
    var latest: [String: AMDOSMacroPaperRow] = [:]
    for row in papers where lanes.contains(row.lane) {
        if latest[row.lane] == nil || latest[row.lane]!.observedAt < row.observedAt { latest[row.lane] = row }
    }
    return Int(latest.values.reduce(0) { $0 + $1.paperCount })
}

private func amdOSMacroSubSeeds(_ seeds: [AMDOSParitySeed], sub: AMDOSMacroSubIssue) -> [AMDOSParitySeed] {
    seeds.filter { seed in amdOSMacroKeywordMatch(sub.keywords, parts: [seed.title, seed.summary ?? "", seed.domainLane ?? "", (seed.industryTarget ?? []).joined(separator: " "), (seed.keywords ?? []).joined(separator: " ")]) }.prefix(3).map { $0 }
}

private func amdOSMacroMetrics(group: AMDOSMacroGroup, sub: AMDOSMacroSubIssue, papers: [AMDOSMacroPaperRow]) -> AMDOSMacroMetrics {
    let paperCount = amdOSMacroPaperCount(papers, issue: group.issue, sub: sub)
    let news = group.signals.filter { amdOSMacroKeywordMatch(sub.keywords, parts: [$0.title, $0.content, $0.domain ?? "", ($0.suggestedTags ?? []).joined(separator: " ")]) }.count
        + group.stories.filter { amdOSMacroKeywordMatch(sub.keywords, parts: [$0.title, $0.summary ?? "", ($0.tags ?? []).joined(separator: " "), $0.primaryDomain ?? ""]) }.count
    let divergenceCount = group.divergences.filter { amdOSMacroKeywordMatch(sub.keywords, parts: [$0.theme.name, $0.theme.description ?? "", $0.row.divergenceMessage ?? "", $0.row.globalSummary ?? "", $0.row.japanSummary ?? ""]) }.count
    let seedCount = amdOSMacroSubSeeds(group.seeds, sub: sub).count
    let paperMomentum = min(44, Int((log10(Double(max(10, paperCount))) * 9).rounded()))
    let momentum = min(99, max(0, paperMomentum + news * 8 + divergenceCount * 10))
    let coverage = min(99, max(0, 18 + seedCount * 22))
    let gap = min(99, max(0, momentum - coverage + (divergenceCount > 0 ? 12 : 0)))
    if gap >= 55 && seedCount <= 1 { return AMDOSMacroMetrics(papers: paperCount, news: news, divergences: divergenceCount, seeds: seedCount, momentum: momentum, coverage: coverage, gap: gap, actionLabel: "Seed search", actionReason: "研究量や外部反応に対してAMD内のseed被覆が薄い。大学・論文・候補技術を先に掘る対象。", intensity: "hot-gap") }
    if divergenceCount > 0 && news > 0 { return AMDOSMacroMetrics(papers: paperCount, news: news, divergences: divergenceCount, seeds: seedCount, momentum: momentum, coverage: coverage, gap: gap, actionLabel: "Japan gap review", actionReason: "世界側の反応と日本側の露出差が見えている。国内プレイヤー不在か、観測不足かを切り分ける。", intensity: "evidence") }
    if seedCount >= 3 { return AMDOSMacroMetrics(papers: paperCount, news: news, divergences: divergenceCount, seeds: seedCount, momentum: momentum, coverage: coverage, gap: gap, actionLabel: "Venture thesis", actionReason: "既存Seedsが複数あるので、個別案件ではなく束ねた事業仮説・共通基盤を作る対象。", intensity: "covered") }
    if news >= 4 || paperCount >= 50_000 { return AMDOSMacroMetrics(papers: paperCount, news: news, divergences: divergenceCount, seeds: seedCount, momentum: momentum, coverage: coverage, gap: gap, actionLabel: "Atlas synthesis", actionReason: "研究量または外部signalは十分。一次情報を束ねて、AMDが取りに行く論点へ翻訳する。", intensity: "evidence") }
    return AMDOSMacroMetrics(papers: paperCount, news: news, divergences: divergenceCount, seeds: seedCount, momentum: momentum, coverage: coverage, gap: gap, actionLabel: "Evidence watch", actionReason: "まだ明確な投資仮説にするには薄い。Atlas signalとOpenAlex推移を継続観測する。", intensity: "watch")
}

private func amdOSMacroDomainGap(_ group: AMDOSMacroGroup, papers: [AMDOSMacroPaperRow]) -> Int {
    let values = group.issue.subIssues.map { amdOSMacroMetrics(group: group, sub: $0, papers: papers).gap }
    guard !values.isEmpty else { return 0 }
    return Int((Double(values.reduce(0, +)) / Double(values.count)).rounded())
}

private func amdOSMacroIntensityColor(_ intensity: String) -> Color {
    switch intensity { case "hot-gap": return .red; case "evidence": return AMDOSDesign.warning; case "covered": return AMDOSDesign.success; default: return AMDOSDesign.muted }
}

// MARK: - Atlas workspace parity
//
// Atlas is deliberately modelled from the same story/signal contracts used by
// pwa/src/app/(app)/atlas.  The Mac presentation is native, but filters,
// review transitions and admin-only mutation routes are the PWA routes rather
// than a second, approximate Atlas data model.

private indirect enum AMDOSParityAtlasJSON: Decodable, Sendable {
    case object([String: AMDOSParityAtlasJSON])
    case array([AMDOSParityAtlasJSON])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null; return }
        if let value = try? container.decode(Bool.self) { self = .bool(value); return }
        if let value = try? container.decode(Double.self) { self = .number(value); return }
        if let value = try? container.decode(String.self) { self = .string(value); return }
        if let value = try? container.decode([AMDOSParityAtlasJSON].self) { self = .array(value); return }
        if let value = try? container.decode([String: AMDOSParityAtlasJSON].self) { self = .object(value); return }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported Atlas JSON value")
    }

    func stringValue(for key: String) -> String? {
        guard case let .object(value) = self, case let .string(result)? = value[key] else { return nil }
        return result
    }
}

private struct AMDOSParityAtlasStory: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let summary: String?
    let status: String?
    let importance: String?
    let tags: [String]?
    let primaryDomain: String?
    let startedAt: String?
    let lastUpdatedAt: String?
    let signalCount: Int?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, summary, status, importance, tags
        case primaryDomain = "primary_domain"
        case startedAt = "started_at"
        case lastUpdatedAt = "last_updated_at"
        case signalCount = "signal_count"
        case createdAt = "created_at"
    }

    var visibleTags: [String] { tags ?? [] }
}

private struct AMDOSParityAtlasSignal: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let content: String
    let sourceURL: String?
    let sourceType: String?
    let domain: String?
    let suggestedTags: [String]?
    let importance: String?
    let status: String?
    let targetNodeID: String?
    let storyID: String?
    let submittedAt: String?
    let reviewedAt: String?
    let createdAt: String?
    let metadata: AMDOSParityAtlasJSON?

    enum CodingKeys: String, CodingKey {
        case id, title, content, domain, importance, status, metadata
        case sourceURL = "source_url"
        case sourceType = "source_type"
        case suggestedTags = "suggested_tags"
        case targetNodeID = "target_node_id"
        case storyID = "story_id"
        case submittedAt = "submitted_at"
        case reviewedAt = "reviewed_at"
        case createdAt = "created_at"
    }

    var visibleTags: [String] { suggestedTags ?? [] }
}

private struct AMDOSParityAtlasDivergenceRow: Decodable, Identifiable, Sendable {
    let id: String
    let themeID: String
    let globalSummary: String?
    let japanSummary: String?
    let divergenceMessage: String?
    let divergenceScore: Double?
    let globalIntensity: Double?
    let japanIntensity: Double?
    let globalSignalCount: Int?
    let japanSignalCount: Int?
    let signalBreakdown: AMDOSParityAtlasJSON?
    let generatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case themeID = "theme_id"
        case globalSummary = "global_summary"
        case japanSummary = "japan_summary"
        case divergenceMessage = "divergence_message"
        case divergenceScore = "divergence_score"
        case globalIntensity = "global_intensity"
        case japanIntensity = "japan_intensity"
        case globalSignalCount = "global_signal_count"
        case japanSignalCount = "japan_signal_count"
        case signalBreakdown = "signal_breakdown"
        case generatedAt = "generated_at"
    }
}

private struct AMDOSParityAtlasTheme: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let primaryDomain: String?
    let tagKeywords: [String]?

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case primaryDomain = "primary_domain"
        case tagKeywords = "tag_keywords"
    }

    var visibleKeywords: [String] { tagKeywords ?? [] }
}

private struct AMDOSParityAtlasDivergence: Identifiable, Sendable {
    let row: AMDOSParityAtlasDivergenceRow
    let theme: AMDOSParityAtlasTheme
    var id: String { row.id }
}

private struct AMDOSParityAtlasMutationResponse: Decodable, Sendable {
    let ok: Bool?
    let error: String?
    let newStoryID: String?
    enum CodingKeys: String, CodingKey { case ok, error, newStoryID = "newStoryId" }
}

private struct AMDOSParityAtlasMoveRequest: Encodable, Sendable {
    let signalID: String
    let action: String
    let targetStoryID: String?
    let newStoryTitle: String?
    let newStorySummary: String?
    let useLlmProposal: Bool?
    enum CodingKeys: String, CodingKey {
        case signalID = "signalId", action
        case targetStoryID = "targetStoryId"
        case newStoryTitle, newStorySummary, useLlmProposal
    }
}

private struct AMDOSParityAtlasMergeRequest: Encodable, Sendable {
    let from: String
    let to: String
    let reason: String?
}

private struct AMDOSParityAtlasSignalReviewRequest: Encodable, Sendable {
    let signalID: String?
    let status: String
    let targetNodeID: String?
    let allInbox: Bool
    enum CodingKeys: String, CodingKey { case signalID = "signalId", status, targetNodeID = "targetNodeId", allInbox }
}

private struct AMDOSParityAtlasSignalSubmitRequest: Encodable, Sendable {
    let title: String
    let content: String
    let sourceURL: String?
    let sourceType: String
    let domain: String?
    let suggestedTags: [String]
    let importance: String
    enum CodingKeys: String, CodingKey {
        case title, content, domain, importance
        case sourceURL = "sourceUrl"
        case sourceType = "sourceType"
        case suggestedTags = "suggestedTags"
    }
}

private struct AMDOSParityAtlasAutoTagRequest: Encodable, Sendable {
    let title: String
    let content: String
    let domain: String?
}

private struct AMDOSParityAtlasAutoTagResponse: Decodable, Sendable {
    let tags: [String]?
    let importance: String?
}

private struct AMDOSParityAtlasThemesListResponse: Decodable, Sendable {
    let ok: Bool?
    let themes: [AMDOSParityAtlasExistingTheme]?
    let error: String?
}

private struct AMDOSParityAtlasExistingTheme: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let primaryDomain: String?
    let tagKeywords: [String]?
    let storyCount: Int?
    enum CodingKeys: String, CodingKey {
        case id, name, description
        case primaryDomain = "primary_domain"
        case tagKeywords = "tag_keywords"
        case storyCount = "story_count"
    }
}

private struct AMDOSParityAtlasThemeProposal: Codable, Identifiable, Sendable {
    var id: String?
    var name: String
    var description: String
    var primaryDomain: String
    var tagKeywords: [String]
    var storyIDs: [String]

    var stableID: String { id ?? "\(name)|\(storyIDs.joined(separator: ","))" }
    enum CodingKeys: String, CodingKey {
        case id, name, description
        case primaryDomain = "primary_domain"
        case tagKeywords = "tag_keywords"
        case storyIDs = "story_ids"
    }
}

extension AMDOSParityAtlasThemeProposal {
    var proposalID: String { stableID }
}

private struct AMDOSParityAtlasThemesClusterResponse: Decodable, Sendable {
    let ok: Bool?
    let disabled: Bool?
    let reason: String?
    let themes: [AMDOSParityAtlasThemeProposal]?
    let totalStories: Int?
    let error: String?
    enum CodingKeys: String, CodingKey { case ok, disabled, reason, themes, totalStories = "total_stories", error }
}

private struct AMDOSParityAtlasThemesApplyRequest: Encodable, Sendable {
    let themes: [AMDOSParityAtlasThemeProposal]
    let replace: Bool
}

private struct AMDOSParityAtlasThemesApplyResponse: Decodable, Sendable {
    let ok: Bool?
    let created: Int?
    let updated: Int?
    let linksInserted: Int?
    let errors: [String]?
    let error: String?
    enum CodingKeys: String, CodingKey { case ok, created, updated, linksInserted = "links_inserted", errors, error }
}

@MainActor
private final class AMDOSParityAtlasStore: ObservableObject {
    @Published var stories: [AMDOSParityAtlasStory] = []
    @Published var acceptedSignals: [AMDOSParityAtlasSignal] = []
    @Published var inboxSignals: [AMDOSParityAtlasSignal] = []
    @Published var divergences: [AMDOSParityAtlasDivergence] = []
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?
    @Published var isWriting = false

    func loadHome() async {
        state = .loading
        do {
            async let storyRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityAtlasStory.self,
                table: "atlas_stories",
                select: "id,title,summary,status,importance,tags,primary_domain,started_at,last_updated_at,signal_count,created_at",
                order: "last_updated_at.desc",
                limit: 500
            )
            async let signalRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityAtlasSignal.self,
                table: "atlas_signals",
                select: "id,title,content,source_url,source_type,domain,suggested_tags,importance,status,target_node_id,story_id,submitted_at,reviewed_at,created_at,metadata",
                filters: ["status": "eq.accepted"],
                order: "submitted_at.asc",
                limit: 2_000
            )
            let (loadedStories, loadedSignals) = try await (storyRows, signalRows)
            let signalCounts = Dictionary(grouping: loadedSignals.compactMap { signal in
                signal.storyID.map { ($0, signal) }
            }, by: { $0.0 }).mapValues(\.count)
            stories = loadedStories.sorted {
                let leftCount = signalCounts[$0.id] ?? 0
                let rightCount = signalCounts[$1.id] ?? 0
                if leftCount != rightCount { return leftCount > rightCount }
                return ($0.lastUpdatedAt ?? "") > ($1.lastUpdatedAt ?? "")
            }
            acceptedSignals = loadedSignals
            state = stories.isEmpty && acceptedSignals.isEmpty ? .empty : .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func loadInbox() async {
        state = .loading
        do {
            inboxSignals = try await AMDOSRESTClient.shared.fetchTable(
                AMDOSParityAtlasSignal.self,
                table: "atlas_signals",
                select: "id,title,content,source_url,source_type,domain,suggested_tags,importance,status,target_node_id,story_id,submitted_at,reviewed_at,created_at,metadata",
                filters: ["status": "eq.inbox"],
                order: "submitted_at.desc",
                limit: 1_000
            )
            state = inboxSignals.isEmpty ? .empty : .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func loadDivergence() async {
        state = .loading
        do {
            async let themeRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityAtlasTheme.self,
                table: "atlas_themes",
                select: "id,name,description,primary_domain,tag_keywords",
                filters: ["status": "eq.active"],
                limit: 500
            )
            async let divergenceRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityAtlasDivergenceRow.self,
                table: "atlas_divergences",
                select: "id,theme_id,global_summary,japan_summary,divergence_message,divergence_score,global_intensity,japan_intensity,global_signal_count,japan_signal_count,signal_breakdown,generated_at",
                order: "divergence_score.desc",
                limit: 500
            )
            let (themes, rows) = try await (themeRows, divergenceRows)
            let themeByID = Dictionary(uniqueKeysWithValues: themes.map { ($0.id, $0) })
            divergences = rows.compactMap { row in themeByID[row.themeID].map { AMDOSParityAtlasDivergence(row: row, theme: $0) } }
            state = divergences.isEmpty ? .empty : .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func review(_ signal: AMDOSParityAtlasSignal, status: String) async {
        await write(success: "シグナルを更新したよ") {
            let data = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/atlas/signals/review",
                body: AMDOSParityAtlasSignalReviewRequest(signalID: signal.id, status: status, targetNodeID: nil, allInbox: false)
            )
            let response = try JSONDecoder().decode(AMDOSParityAtlasMutationResponse.self, from: data)
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "シグナルを更新できなかった") }
        } after: { await self.loadInbox() }
    }

    func acceptAllInbox() async {
        await write(success: "InboxをすべてAcceptしたよ") {
            let data = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/atlas/signals/review",
                body: AMDOSParityAtlasSignalReviewRequest(signalID: nil, status: "accepted", targetNodeID: nil, allInbox: true)
            )
            let response = try JSONDecoder().decode(AMDOSParityAtlasMutationResponse.self, from: data)
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "Inboxを更新できなかった") }
        } after: { await self.loadInbox() }
    }

    func move(signal: AMDOSParityAtlasSignal, action: String, targetStoryID: String? = nil, newTitle: String? = nil, newSummary: String? = nil, useLlmProposal: Bool? = nil) async {
        await write(success: "ストーリーとの紐付けを更新したよ") {
            let data = try await AMDOSRESTClient.shared.sendPWA(
                path: "/api/atlas/move-signal",
                body: AMDOSParityAtlasMoveRequest(signalID: signal.id, action: action, targetStoryID: targetStoryID, newStoryTitle: newTitle, newStorySummary: newSummary, useLlmProposal: useLlmProposal)
            )
            let response = try JSONDecoder().decode(AMDOSParityAtlasMutationResponse.self, from: data)
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "シグナルを移動できなかった") }
        } after: { await self.loadHome() }
    }

    func merge(from: AMDOSParityAtlasStory, to targetID: String, reason: String?) async {
        await write(success: "ストーリーを統合したよ") {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/atlas/merge-stories", body: AMDOSParityAtlasMergeRequest(from: from.id, to: targetID, reason: reason))
            let response = try JSONDecoder().decode(AMDOSParityAtlasMutationResponse.self, from: data)
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "ストーリーを統合できなかった") }
        } after: { await self.loadHome() }
    }

    private func write(success: String, operation: @escaping @Sendable () async throws -> Void, after: @escaping @MainActor () async -> Void) async {
        isWriting = true
        defer { isWriting = false }
        do {
            try await operation()
            message = success
            await after()
        } catch {
            message = "エラー: \(error.localizedDescription)"
        }
    }
}

// Keep the Atlas domain normalization in lockstep with
// pwa/src/lib/atlas-domains.ts.  The stored value can be either a bare key
// ("C") or the full selectable label ("C.素材・原料"); the PWA deliberately
// looks only at its first character.
private let amdOSParityAtlasDomainLabels: [String: String] = [
    "A": "地政学", "B": "規制", "C": "素材", "D": "エネルギー", "E": "製造",
    "F": "バイオ", "G": "モビリティ", "H": "建築", "I": "ICT/AI", "J": "宇宙",
    "K": "食/農", "L": "金融", "M": "社会", "N": "海洋", "O": "サーキュラー",
    "P": "量子", "Q": "センシング", "R": "通信",
]

private let amdOSParityAtlasDomainColors: [String: Color] = [
    "A": Color(red: 239.0 / 255.0, green: 68.0 / 255.0, blue: 68.0 / 255.0),
    "B": Color(red: 220.0 / 255.0, green: 38.0 / 255.0, blue: 38.0 / 255.0),
    "C": Color(red: 59.0 / 255.0, green: 130.0 / 255.0, blue: 246.0 / 255.0),
    "D": Color(red: 234.0 / 255.0, green: 179.0 / 255.0, blue: 8.0 / 255.0),
    "E": Color(red: 34.0 / 255.0, green: 197.0 / 255.0, blue: 94.0 / 255.0),
    "F": Color(red: 236.0 / 255.0, green: 72.0 / 255.0, blue: 153.0 / 255.0),
    "G": Color(red: 168.0 / 255.0, green: 85.0 / 255.0, blue: 247.0 / 255.0),
    "H": Color(red: 146.0 / 255.0, green: 64.0 / 255.0, blue: 14.0 / 255.0),
    "I": Color(red: 99.0 / 255.0, green: 102.0 / 255.0, blue: 241.0 / 255.0),
    "J": Color(red: 30.0 / 255.0, green: 41.0 / 255.0, blue: 59.0 / 255.0),
    "K": Color(red: 132.0 / 255.0, green: 204.0 / 255.0, blue: 22.0 / 255.0),
    "L": Color(red: 16.0 / 255.0, green: 185.0 / 255.0, blue: 129.0 / 255.0),
    "M": Color(red: 249.0 / 255.0, green: 115.0 / 255.0, blue: 22.0 / 255.0),
    "N": Color(red: 6.0 / 255.0, green: 182.0 / 255.0, blue: 212.0 / 255.0),
    "O": Color(red: 20.0 / 255.0, green: 184.0 / 255.0, blue: 166.0 / 255.0),
    "P": Color(red: 139.0 / 255.0, green: 92.0 / 255.0, blue: 246.0 / 255.0),
    "Q": Color(red: 14.0 / 255.0, green: 165.0 / 255.0, blue: 233.0 / 255.0),
    "R": Color(red: 113.0 / 255.0, green: 113.0 / 255.0, blue: 122.0 / 255.0),
]

private func amdOSParityAtlasDomainKey(_ domain: String?) -> String? {
    guard let domain, let first = domain.first else { return nil }
    let key = String(first).uppercased()
    return amdOSParityAtlasDomainLabels[key] == nil ? nil : key
}

private func amdOSParityAtlasDomainLabel(_ domain: String?) -> String {
    guard let key = amdOSParityAtlasDomainKey(domain) else { return "—" }
    return amdOSParityAtlasDomainLabels[key] ?? "—"
}

private func amdOSParityAtlasDomainColor(_ domain: String?) -> Color {
    guard let key = amdOSParityAtlasDomainKey(domain) else {
        return Color(red: 148.0 / 255.0, green: 163.0 / 255.0, blue: 184.0 / 255.0)
    }
    return amdOSParityAtlasDomainColors[key] ?? Color(red: 148.0 / 255.0, green: 163.0 / 255.0, blue: 184.0 / 255.0)
}

private func amdOSParityAtlasDate(_ value: String?) -> String {
    guard let value, !value.isEmpty else { return "—" }
    let iso = ISO8601DateFormatter()
    if let date = iso.date(from: value) {
        return date.formatted(.dateTime.year().month().day().hour().minute())
    }
    return value
}

private func amdOSParityAtlasImportanceColor(_ importance: String?) -> Color {
    switch importance {
    case "high": return AMDOSDesign.warning
    case "low": return AMDOSDesign.muted
    default: return AMDOSDesign.blue
    }
}

private func amdOSParityAtlasSourceTypeLabel(_ sourceType: String?) -> String {
    switch sourceType {
    case "news": return "NEWS"
    case "report": return "REPORT"
    case "data": return "DATA"
    case "manual": return "MEMO"
    case "policy": return "POLICY"
    default: return "SOURCE"
    }
}

private struct AMDOSParityAtlasSignalMoveSelection: Identifiable {
    let signal: AMDOSParityAtlasSignal
    let sourceTitle: String
    var id: String { signal.id }
}

private struct AMDOSParityAtlasPendingSignalAction: Identifiable {
    enum Action: String {
        case detach
        case createNew
    }

    let signal: AMDOSParityAtlasSignal
    let action: Action
    var id: String { "\(signal.id)-\(action.rawValue)" }
}

struct AMDOSParityAtlasHomeView: View {
    let onNavigate: (AMDOSScreenID) -> Void
    @StateObject private var store = AMDOSParityAtlasStore()
    @State private var search = ""
    @State private var highOnly = false
    @State private var domainFilter: String?
    @State private var tagFilter: String?
    @State private var expandedStoryID: String?
    @State private var showOrphans = false
    @State private var mergeSource: AMDOSParityAtlasStory?
    @State private var moveSelection: AMDOSParityAtlasSignalMoveSelection?
    @State private var pendingSignalAction: AMDOSParityAtlasPendingSignalAction?

    init(onNavigate: @escaping (AMDOSScreenID) -> Void = { _ in }) {
        self.onNavigate = onNavigate
    }

    private var signalsByStory: [String: [AMDOSParityAtlasSignal]] {
        var grouped: [String: [AMDOSParityAtlasSignal]] = [:]
        for signal in store.acceptedSignals {
            guard let storyID = signal.storyID else { continue }
            grouped[storyID, default: []].append(signal)
        }
        return grouped.mapValues { values in
            values.sorted { ($0.submittedAt ?? "") < ($1.submittedAt ?? "") }
        }
    }

    private var orphanSignals: [AMDOSParityAtlasSignal] {
        store.acceptedSignals.filter { $0.storyID == nil }
    }

    private var domainCounts: [(String, Int)] {
        let values = store.stories.compactMap { amdOSParityAtlasDomainKey($0.primaryDomain) }
        return Dictionary(grouping: values, by: { $0 }).map { ($0.key, $0.value.count) }.sorted { $0.1 > $1.1 }
    }

    private var tagCounts: [(String, Int)] {
        var counts: [String: Int] = [:]
        // PWA Atlasのフィルタ母数はストーリー自身の補助タグではなく、
        // accepted signal の suggested_tags（+ orphan）だけ。表示対象の数え方も揃える。
        for story in store.stories {
            for signal in signalsByStory[story.id] ?? [] {
                for tag in signal.visibleTags { counts[tag, default: 0] += 1 }
            }
        }
        for signal in orphanSignals {
            for tag in signal.visibleTags { counts[tag, default: 0] += 1 }
        }
        return counts.map { ($0.key, $0.value) }.sorted { $0.1 == $1.1 ? $0.0 < $1.0 : $0.1 > $1.1 }
    }

    private var filteredStories: [AMDOSParityAtlasStory] {
        store.stories.filter { story in
            if highOnly && story.importance != "high" { return false }
            if let domainFilter, amdOSParityAtlasDomainKey(story.primaryDomain) != domainFilter { return false }
            if let tagFilter, !story.visibleTags.contains(tagFilter) && !(signalsByStory[story.id] ?? []).contains(where: { $0.visibleTags.contains(tagFilter) }) { return false }
            let term = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !term.isEmpty else { return true }
            let haystack = ([story.title, story.summary ?? ""] + story.visibleTags + (signalsByStory[story.id] ?? []).flatMap { [$0.title, $0.content] + $0.visibleTags }).joined(separator: " ").lowercased()
            return haystack.contains(term)
        }
    }

    // Same ranking as the PWA merge dialog: domain match, tag overlap, then
    // the actual number of accepted signals.  `atlas_stories.signal_count`
    // is intentionally not used because the PWA derives this from the loaded
    // accepted signal list too.
    private func mergeCandidates(for source: AMDOSParityAtlasStory) -> [AMDOSParityAtlasStory] {
        let sourceDomain = amdOSParityAtlasDomainKey(source.primaryDomain)
        let sourceTags = Set(source.visibleTags)
        return store.stories
            .filter { $0.id != source.id }
            .enumerated()
            .map { index, story in
                let sameDomain = amdOSParityAtlasDomainKey(story.primaryDomain) == sourceDomain ? 1 : 0
                let tagOverlap = story.visibleTags.filter(sourceTags.contains).count
                let signalCount = signalsByStory[story.id]?.count ?? 0
                return (index: index, story: story, score: sameDomain * 100 + tagOverlap * 10 + signalCount)
            }
            .sorted {
                if $0.score != $1.score { return $0.score > $1.score }
                return $0.index < $1.index
            }
            .prefix(50)
            .map(\.story)
    }

    // Same ranking as the PWA move dialog.  A signal can be moved from an
    // orphan as well, so only its current story (when any) is excluded.
    private func moveCandidates(for signal: AMDOSParityAtlasSignal) -> [AMDOSParityAtlasStory] {
        let signalDomain = amdOSParityAtlasDomainKey(signal.domain)
        let signalTags = Set(signal.visibleTags)
        return store.stories
            .filter { $0.id != signal.storyID }
            .enumerated()
            .map { index, story in
                let sameDomain = amdOSParityAtlasDomainKey(story.primaryDomain) == signalDomain ? 1 : 0
                let tagOverlap = story.visibleTags.filter(signalTags.contains).count
                let signalCount = signalsByStory[story.id]?.count ?? 0
                return (index: index, story: story, score: sameDomain * 100 + tagOverlap * 10 + signalCount)
            }
            .sorted {
                if $0.score != $1.score { return $0.score > $1.score }
                return $0.index < $1.index
            }
            .prefix(50)
            .map(\.story)
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ATLAS", title: "AMD Atlas", subtitle: "PWAと同じストーリー・シグナルを、検索・整理・統合する") {
            HStack(spacing: 8) {
                Button("Map") { onNavigate(.atlasMap) }.buttonStyle(.borderedProminent)
                Button("トレンド") { onNavigate(.atlasDivergence) }.buttonStyle(.bordered)
                Button("判断ログ") { onNavigate(.atlasDecisions) }.buttonStyle(.bordered)
                Button("Inbox") { onNavigate(.atlasInbox) }.buttonStyle(.bordered)
                Button("テーマ管理") { onNavigate(.atlasThemes) }.buttonStyle(.bordered)
                Spacer()
            }
            HStack(spacing: 14) {
                AMDOSMetricTile(label: "ストーリー", value: "\(store.stories.count)", detail: highOnly ? "HIGHで絞り込み中" : "稼働中の変化のまとまり")
                AMDOSMetricTile(label: "シグナル", value: "\(store.acceptedSignals.count)", detail: "Accept済みの観測")
                AMDOSMetricTile(label: "未紐付け", value: "\(orphanSignals.count)", detail: "ストーリーへ整理待ち")
            }
            AMDOSStateNotice(state: store.state) { Task { await store.loadHome() } }
            if let message = store.message { Text(message).font(.caption).foregroundStyle(store.message?.hasPrefix("エラー:") == true ? AMDOSDesign.warning : AMDOSDesign.muted) }

            VStack(alignment: .leading, spacing: 10) {
                TextField("タイトル・本文・タグを検索", text: $search).textFieldStyle(.roundedBorder)
                HStack(alignment: .top, spacing: 8) {
                    if highOnly {
                        Button("HIGHのみを解除") { highOnly.toggle() }.buttonStyle(.borderedProminent)
                    } else {
                        Button("HIGHのみ") { highOnly.toggle() }.buttonStyle(.bordered)
                    }
                    if search.trimmedNonEmpty != nil || highOnly || domainFilter != nil || tagFilter != nil {
                        Button("フィルタを解除") { search = ""; highOnly = false; domainFilter = nil; tagFilter = nil }.buttonStyle(.borderless)
                    }
                }
                if !domainCounts.isEmpty {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("分野").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                        FlowLayout(spacing: 6) {
                            ForEach(domainCounts, id: \.0) { domain, count in
                                if domainFilter == domain {
                                    Button("\(amdOSParityAtlasDomainLabel(domain))  \(count)") { domainFilter = nil }
                                        .buttonStyle(.borderedProminent)
                                        .tint(amdOSParityAtlasDomainColor(domain))
                                } else {
                                    Button("\(amdOSParityAtlasDomainLabel(domain))  \(count)") { domainFilter = domain }
                                        .buttonStyle(.bordered)
                                        .tint(AMDOSDesign.muted)
                                }
                            }
                        }
                    }
                }
                if !tagCounts.isEmpty {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("タグ").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                        FlowLayout(spacing: 6) {
                            ForEach(tagCounts.prefix(40), id: \.0) { tag, count in
                                if tagFilter == tag {
                                    Button("#\(tag)  \(count)") { tagFilter = nil }
                                        .buttonStyle(.borderedProminent)
                                        .tint(AMDOSDesign.blue)
                                } else {
                                    Button("#\(tag)  \(count)") { tagFilter = tag }
                                        .buttonStyle(.bordered)
                                        .tint(AMDOSDesign.muted)
                                }
                            }
                        }
                    }
                }
            }

            if filteredStories.isEmpty && orphanSignals.isEmpty && store.state == .loaded {
                ContentUnavailableView("該当するストーリーはないよ", systemImage: "magnifyingglass", description: Text("検索条件を変えるか、InboxからシグナルをAcceptしてね"))
            } else {
                VStack(spacing: 10) {
                    ForEach(filteredStories) { story in
                        let signals = signalsByStory[story.id] ?? []
                        DisclosureGroup(isExpanded: Binding(
                            get: { expandedStoryID == story.id },
                            set: { expanded in expandedStoryID = expanded ? story.id : nil }
                        )) {
                            VStack(alignment: .leading, spacing: 12) {
                                if let summary = story.summary?.trimmedNonEmpty { Text(summary).font(.subheadline).foregroundStyle(AMDOSDesign.muted) }
                                HStack(spacing: 8) {
                                    Text("更新 \(amdOSParityAtlasDate(story.lastUpdatedAt))").font(.caption).foregroundStyle(AMDOSDesign.muted)
                                    Text("初出 \(amdOSParityAtlasDate(story.startedAt))").font(.caption).foregroundStyle(AMDOSDesign.muted)
                                }
                                if !story.visibleTags.isEmpty {
                                    FlowLayout(spacing: 5) {
                                        ForEach(story.visibleTags, id: \.self) { tag in
                                            Button("#\(tag)") { tagFilter = tagFilter == tag ? nil : tag }
                                                .buttonStyle(.bordered)
                                                .tint(tagFilter == tag ? AMDOSDesign.blue : AMDOSDesign.muted)
                                        }
                                    }
                                }
                                HStack {
                                    Button("ストーリーを統合", systemImage: "arrow.triangle.merge") { mergeSource = story }.buttonStyle(.bordered)
                                    Spacer()
                                    Text("\(signals.count) signals").font(.caption.weight(.medium)).foregroundStyle(AMDOSDesign.muted)
                                }
                                if signals.isEmpty {
                                    Text("このストーリーに紐づくAccept済みシグナルはまだないよ").font(.caption).foregroundStyle(AMDOSDesign.muted)
                                } else {
                                    VStack(alignment: .leading, spacing: 8) {
                                        ForEach(signals) { signal in
                                            AMDOSParityAtlasSignalTimelineRow(signal: signal, tint: amdOSParityAtlasDomainColor(story.primaryDomain), onDetach: {
                                                pendingSignalAction = .init(signal: signal, action: .detach)
                                            }, onMove: {
                                                moveSelection = AMDOSParityAtlasSignalMoveSelection(signal: signal, sourceTitle: story.title)
                                            }, onCreate: {
                                                pendingSignalAction = .init(signal: signal, action: .createNew)
                                            }, onSelectTag: { tag in
                                                tagFilter = tagFilter == tag ? nil : tag
                                            })
                                        }
                                    }
                                }
                            }
                            .padding(.top, 12)
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                VStack(spacing: 1) {
                                    Text("\(signals.count)").font(.title3.weight(.bold))
                                    Text("signals").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                                }.frame(width: 48)
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack(spacing: 6) {
                                            AMDOSStatusBadge(text: amdOSParityAtlasDomainLabel(story.primaryDomain), tint: amdOSParityAtlasDomainColor(story.primaryDomain))
                                        AMDOSStatusBadge(text: (story.importance ?? "medium").uppercased(), tint: amdOSParityAtlasImportanceColor(story.importance))
                                        if let status = story.status, status != "ongoing" { AMDOSStatusBadge(text: status) }
                                    }
                                    Text(story.title).font(.headline)
                                    if expandedStoryID != story.id, let summary = story.summary?.trimmedNonEmpty { Text(summary).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(2) }
                                }
                            }
                        }
                        .padding(15)
                        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(AMDOSDesign.border, lineWidth: 1))
                    }
                }
            }

            if !orphanSignals.isEmpty && search.trimmedNonEmpty == nil && !highOnly && domainFilter == nil && tagFilter == nil {
                DisclosureGroup("未紐付けシグナル (\(orphanSignals.count))", isExpanded: $showOrphans) {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(orphanSignals) { signal in
                            AMDOSCard {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(signal.title).font(.subheadline.weight(.semibold))
                                    Text(signal.content).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(3)
                                    if !signal.visibleTags.isEmpty {
                                        FlowLayout(spacing: 5) {
                                            ForEach(signal.visibleTags, id: \.self) { tag in
                                                Button("#\(tag)") { tagFilter = tagFilter == tag ? nil : tag }
                                                    .buttonStyle(.bordered)
                                                    .tint(tagFilter == tag ? AMDOSDesign.blue : AMDOSDesign.muted)
                                            }
                                        }
                                    }
                                    HStack {
                                        AMDOSStatusBadge(text: (signal.importance ?? "medium").uppercased(), tint: amdOSParityAtlasImportanceColor(signal.importance))
                                        Spacer()
                                        Button("既存ストーリーへ移す") { moveSelection = AMDOSParityAtlasSignalMoveSelection(signal: signal, sourceTitle: "未紐付け") }.buttonStyle(.bordered)
                                        Button("新しいストーリーにする") { pendingSignalAction = .init(signal: signal, action: .createNew) }.buttonStyle(.bordered)
                                    }
                                }
                            }
                        }
                    }.padding(.top, 10)
                }
            }
        }
        .task { await store.loadHome() }
        .sheet(item: $mergeSource) { source in
            AMDOSParityAtlasMergeSheet(source: source, candidates: mergeCandidates(for: source)) { targetID, reason in
                expandedStoryID = nil
                Task { await store.merge(from: source, to: targetID, reason: reason) }
            }
        }
        .sheet(item: $moveSelection) { selection in
            AMDOSParityAtlasMoveSheet(selection: selection, candidates: moveCandidates(for: selection.signal)) { targetID, title, summary, useLlm in
                Task {
                    if let targetID { await store.move(signal: selection.signal, action: "moveToExisting", targetStoryID: targetID) }
                    else { await store.move(signal: selection.signal, action: "createNew", newTitle: title, newSummary: summary, useLlmProposal: useLlm) }
                }
            }
        }
        .confirmationDialog(
            pendingSignalAction?.action == .detach
                ? "「\(pendingSignalAction?.signal.title ?? "このシグナル")」を未紐付けに戻す？"
                : "「\(pendingSignalAction?.signal.title ?? "このシグナル")」を新規ストーリーとして切り出す？",
            isPresented: Binding(
                get: { pendingSignalAction != nil },
                set: { if !$0 { pendingSignalAction = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let pendingSignalAction {
                Button(
                    pendingSignalAction.action == .detach ? "未紐付けに戻す" : "新規ストーリーにする",
                    role: pendingSignalAction.action == .detach ? .destructive : nil
                ) {
                    let pending = pendingSignalAction
                    self.pendingSignalAction = nil
                    Task {
                        switch pending.action {
                        case .detach:
                            await store.move(signal: pending.signal, action: "detach")
                        case .createNew:
                            await store.move(signal: pending.signal, action: "createNew", useLlmProposal: true)
                        }
                    }
                }
            }
            Button("キャンセル", role: .cancel) { pendingSignalAction = nil }
        } message: {
            Text(pendingSignalAction?.action == .detach
                ? "PWAと同じく、このシグナルのストーリー紐付けを外す。"
                : "PWAと同じく、タイトルと要約はAIの提案を使って新規ストーリーを作る。")
        }
    }
}

private struct AMDOSParityAtlasSignalTimelineRow: View {
    let signal: AMDOSParityAtlasSignal
    let tint: Color
    let onDetach: () -> Void
    let onMove: () -> Void
    let onCreate: () -> Void
    let onSelectTag: (String) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle().fill(tint).frame(width: 9, height: 9).padding(.top, 5)
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text(signal.title).font(.subheadline.weight(.semibold))
                    Spacer()
                    Text(amdOSParityAtlasDate(signal.submittedAt)).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                }
                Text(signal.content).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(5)
                if let raw = signal.sourceURL, let url = URL(string: raw) {
                    Link(destination: url) { Label(signal.sourceType?.uppercased() ?? "SOURCE", systemImage: "arrow.up.right.square").font(.caption) }
                }
                if !signal.visibleTags.isEmpty {
                    FlowLayout(spacing: 4) {
                        ForEach(signal.visibleTags, id: \.self) { tag in
                            Button("#\(tag)") { onSelectTag(tag) }.buttonStyle(.bordered)
                        }
                    }
                }
                Menu("整理", systemImage: "ellipsis.circle") {
                    Button("未紐付けに戻す", action: onDetach)
                    Button("既存ストーリーへ移す", action: onMove)
                    Button("新しいストーリーに切り出す", action: onCreate)
                }.menuStyle(.borderlessButton)
            }
        }
    }
}

private struct AMDOSParityAtlasMergeSheet: View {
    @Environment(\.dismiss) private var dismiss
    let source: AMDOSParityAtlasStory
    let candidates: [AMDOSParityAtlasStory]
    let onMerge: (String, String?) -> Void
    @State private var targetID = ""
    @State private var reason = ""
    @State private var search = ""

    private var visibleCandidates: [AMDOSParityAtlasStory] {
        let term = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !term.isEmpty else { return candidates }
        return candidates.filter { story in
            ([story.title, story.summary ?? ""] + story.visibleTags)
                .joined(separator: " ")
                .lowercased()
                .contains(term)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("ストーリーを統合").font(.title3.weight(.bold))
            Text("「\(source.title)」のシグナルを統合先に移し、このストーリーを閉じる。PWAの `/api/atlas/merge-stories` と同じ処理だよ。").font(.subheadline).foregroundStyle(AMDOSDesign.muted)
            TextField("統合先を絞り込み", text: $search).textFieldStyle(.roundedBorder)
            Picker("統合先", selection: $targetID) {
                Text("選んでね").tag("")
                ForEach(visibleCandidates) { story in
                    Text("\(amdOSParityAtlasDomainLabel(story.primaryDomain)) · \(story.title)").tag(story.id)
                }
            }
            AMDOSTextField(title: "統合理由（任意）", text: $reason, axis: .vertical)
            HStack { Spacer(); Button("キャンセル") { dismiss() }; Button("統合する") { onMerge(targetID, reason.trimmedNonEmpty); dismiss() }.buttonStyle(.borderedProminent).disabled(targetID.isEmpty) }
        }
        .padding(24)
        .frame(width: 520)
    }
}

private struct AMDOSParityAtlasMoveSheet: View {
    @Environment(\.dismiss) private var dismiss
    let selection: AMDOSParityAtlasSignalMoveSelection
    let candidates: [AMDOSParityAtlasStory]
    let onCommit: (String?, String?, String?, Bool) -> Void
    @State private var mode = "existing"
    @State private var targetID = ""
    @State private var title = ""
    @State private var summary = ""
    @State private var useLlm = true
    @State private var search = ""

    private var visibleCandidates: [AMDOSParityAtlasStory] {
        let term = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !term.isEmpty else { return candidates }
        return candidates.filter { story in
            ([story.title, story.summary ?? ""] + story.visibleTags)
                .joined(separator: " ")
                .lowercased()
                .contains(term)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("シグナルを整理").font(.title3.weight(.bold))
            Text("「\(selection.signal.title)」を\(selection.sourceTitle)から移す。").font(.subheadline).foregroundStyle(AMDOSDesign.muted)
            Picker("移動先", selection: $mode) { Text("既存ストーリー").tag("existing"); Text("新しいストーリー").tag("new") }.pickerStyle(.segmented)
            if mode == "existing" {
                TextField("移植先を絞り込み", text: $search).textFieldStyle(.roundedBorder)
                Picker("ストーリー", selection: $targetID) {
                    Text("選んでね").tag("")
                    ForEach(visibleCandidates) { story in
                        Text("\(amdOSParityAtlasDomainLabel(story.primaryDomain)) · \(story.title)").tag(story.id)
                    }
                }
            } else {
                Toggle("AIにタイトルと要約を提案させる", isOn: $useLlm)
                AMDOSTextField(title: "タイトル（AI提案を使わない時だけ必要）", text: $title)
                AMDOSTextField(title: "要約（任意）", text: $summary, axis: .vertical)
            }
            HStack { Spacer(); Button("キャンセル") { dismiss() }; Button(mode == "existing" ? "移す" : "新規ストーリーへ") { onCommit(mode == "existing" ? targetID : nil, mode == "new" ? title.trimmedNonEmpty : nil, mode == "new" ? summary.trimmedNonEmpty : nil, mode == "new" ? useLlm : false); dismiss() }.buttonStyle(.borderedProminent).disabled(mode == "existing" && targetID.isEmpty) }
        }
        .padding(24)
        .frame(width: 540)
    }
}

private struct AMDOSParityFlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 10_000
        var cursor = CGPoint.zero
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if cursor.x > 0, cursor.x + size.width > width {
                cursor.x = 0
                cursor.y += rowHeight + spacing
                rowHeight = 0
            }
            cursor.x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width, height: cursor.y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var cursor = CGPoint(x: bounds.minX, y: bounds.minY)
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if cursor.x > bounds.minX, cursor.x + size.width > bounds.maxX {
                cursor.x = bounds.minX
                cursor.y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: cursor, proposal: ProposedViewSize(size))
            cursor.x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// `FlowLayout` is kept local to the Atlas additions so the design primitives
// remain independent from a route feature.  The views above use it for the
// same dense tag filters the PWA exposes.
private typealias FlowLayout = AMDOSParityFlowLayout

struct AMDOSParityAtlasInboxView: View {
    let onOpenAtlas: () -> Void
    let onOpenSubmit: () -> Void
    @StateObject private var store = AMDOSParityAtlasStore()
    @State private var sourceFilter = "all"
    @State private var confirmAcceptAll = false

    private var visibleSignals: [AMDOSParityAtlasSignal] {
        store.inboxSignals.filter { signal in
            switch sourceFilter {
            case "policy": return signal.sourceType == "policy"
            case "news": return signal.sourceType != "policy"
            default: return true
            }
        }
    }

    private func count(_ filter: String) -> Int {
        switch filter {
        case "policy": return store.inboxSignals.filter { $0.sourceType == "policy" }.count
        case "news": return store.inboxSignals.filter { $0.sourceType != "policy" }.count
        default: return store.inboxSignals.count
        }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ATLAS INBOX", title: "Atlas Inbox", subtitle: "PWAと同じ inbox → accepted / held / rejected の審査境界") {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Button("← Atlas", action: onOpenAtlas)
                        .buttonStyle(.link)
                    Text(store.inboxSignals.isEmpty ? "キューは空です" : "\(visibleSignals.count)/\(store.inboxSignals.count)件を表示")
                        .font(.subheadline).foregroundStyle(AMDOSDesign.muted)
                    HStack(spacing: 6) {
                        ForEach([("all", "全部"), ("news", "ニュース"), ("policy", "政策")], id: \.0) { value, label in
                            if sourceFilter == value {
                                Button("\(label) (\(count(value)))") { sourceFilter = value }.buttonStyle(.borderedProminent)
                            } else {
                                Button("\(label) (\(count(value)))") { sourceFilter = value }.buttonStyle(.bordered)
                            }
                        }
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 8) {
                    HStack(spacing: 8) {
                        Button("全件Accept (\(store.inboxSignals.count))", systemImage: "checkmark.circle") { confirmAcceptAll = true }
                            .buttonStyle(.borderedProminent)
                            .tint(AMDOSDesign.success)
                            .disabled(store.inboxSignals.isEmpty || store.isWriting)
                        Button("+ 投入", action: onOpenSubmit)
                            .buttonStyle(.borderedProminent)
                    }
                }
            }
            AMDOSStateNotice(state: store.state) { Task { await store.loadInbox() } }
            if let message = store.message { Text(message).font(.caption).foregroundStyle(message.hasPrefix("エラー:") ? AMDOSDesign.warning : AMDOSDesign.muted) }
            if store.inboxSignals.isEmpty && (store.state == .loaded || store.state == .empty) {
                ContentUnavailableView("全件審査完了", systemImage: "checkmark.seal", description: Text("新しいシグナルはAtlasシグナル送信からInboxに追加できるよ"))
            } else if visibleSignals.isEmpty, store.state == .loaded {
                ContentUnavailableView("該当するシグナルはないよ", systemImage: "line.3.horizontal.decrease.circle")
            } else {
                ForEach(visibleSignals) { signal in
                    AMDOSCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(alignment: .top, spacing: 8) {
                                AMDOSStatusBadge(text: (signal.importance ?? "medium").uppercased(), tint: amdOSParityAtlasImportanceColor(signal.importance))
                                if signal.sourceType == "policy" {
                                    AMDOSStatusBadge(text: signal.metadata?.stringValue(for: "ministry") ?? "政策", tint: .indigo)
                                }
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(signal.title).font(.headline)
                                    if let domain = signal.domain?.trimmedNonEmpty { Text(domain).font(.caption).foregroundStyle(AMDOSDesign.muted) }
                                }
                                Spacer()
                                Text(amdOSParityAtlasDate(signal.submittedAt)).font(.caption).foregroundStyle(AMDOSDesign.muted)
                            }
                            Text(signal.content).font(.subheadline).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
                            if let source = signal.sourceURL, let url = URL(string: source) {
                                Link(destination: url) { Label(source, systemImage: "arrow.up.right.square").lineLimit(1).font(.caption) }
                            }
                            if !signal.visibleTags.isEmpty {
                                FlowLayout(spacing: 5) { ForEach(signal.visibleTags, id: \.self) { tag in AMDOSStatusBadge(text: "#\(tag)", tint: AMDOSDesign.blue) } }
                            }
                            HStack(spacing: 8) {
                                Button("Accept") { Task { await store.review(signal, status: "accepted") } }
                                    .buttonStyle(.borderedProminent).tint(AMDOSDesign.success).disabled(store.isWriting)
                                Button("Hold") { Task { await store.review(signal, status: "held") } }
                                    .buttonStyle(.bordered).disabled(store.isWriting)
                                Button("Reject") { Task { await store.review(signal, status: "rejected") } }
                                    .buttonStyle(.bordered).tint(.red).disabled(store.isWriting)
                            }
                        }
                    }
                }
            }
        }
        .task { await store.loadInbox() }
        .confirmationDialog("Inboxの\(store.inboxSignals.count)件すべてをAcceptする？", isPresented: $confirmAcceptAll, titleVisibility: .visible) {
            Button("全件Accept", role: .destructive) { Task { await store.acceptAllInbox() } }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("PWAと同じく、すべての inbox シグナルを accepted へ更新する")
        }
    }
}

struct AMDOSParityAtlasSubmitView: View {
    let onOpenInbox: () -> Void
    @State private var title = ""
    @State private var sourceURL = ""
    @State private var sourceType = "news"
    @State private var importance = "medium"
    @State private var content = ""
    @State private var domain = ""
    @State private var tags = ""
    @State private var isSubmitting = false
    @State private var isAutoTagging = false
    @State private var message: String?

    private let domains = [
        "A.地政学・マクロ経済", "B.規制・政策", "C.素材・原料", "D.エネルギー", "E.製造・プロセス技術", "F.バイオ・医療", "G.モビリティ・ロボティクス", "H.建築・インフラ", "I.ICT・AI", "J.宇宙・防衛", "K.食・農・水産", "L.金融・資本市場", "M.社会構造・社会課題", "N.海洋・水資源", "O.サーキュラーエコノミー", "P.量子・量子計算", "Q.センシング・計測", "R.先端通信"
    ]

    private var parsedTags: [String] {
        amdOSParityAtlasDeduplicatedTags(
            tags.split(whereSeparator: { $0 == "," || $0 == "、" || $0.isWhitespace })
                .map(String.init)
                .compactMap(\.trimmedNonEmpty)
        )
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ATLAS SUBMIT", title: "シグナル投入", subtitle: "全方位アンテナの根拠URLを必須にして、PWAと同じInboxへ送る") {
            Button("← Inbox", action: onOpenInbox)
                .buttonStyle(.link)
            AMDOSTextField(title: "タイトル *", text: $title)
            AMDOSTextField(title: "ソースURL *", text: $sourceURL)
            HStack(spacing: 14) {
                Picker("ソース種別", selection: $sourceType) {
                    Text("ニュース・記事").tag("news"); Text("レポート・論文").tag("report"); Text("データ・統計").tag("data"); Text("メモ・手動").tag("manual")
                }
                Picker("重要度", selection: $importance) {
                    Text("HIGH — 即時Push候補").tag("high"); Text("MEDIUM — 通常").tag("medium"); Text("LOW — 参考情報").tag("low")
                }
            }
            AMDOSTextField(title: "内容サマリ *", text: $content, axis: .vertical)
            Picker("分野（任意）", selection: $domain) {
                Text("— 選択しない —").tag("")
                ForEach(domains, id: \.self) { Text($0).tag($0) }
            }
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("タグ（カンマ・空白区切り）").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    Spacer()
                    Button(isAutoTagging ? "自動タグ付け中…" : "自動でタグ付け") { autoTag() }.buttonStyle(.bordered).disabled(isAutoTagging)
                }
                TextField("未入力なら投入時にも自動付与", text: $tags).textFieldStyle(.roundedBorder)
            }
            if let message { Text(message).font(.caption).foregroundStyle(message.hasPrefix("エラー:") ? AMDOSDesign.warning : AMDOSDesign.muted) }
            Button(isSubmitting ? "Inboxへ投入中…" : "Inboxに投入する") { submit() }
                .buttonStyle(.borderedProminent).disabled(isSubmitting)
        }
    }

    private func autoTag() {
        guard let cleanTitle = title.trimmedNonEmpty, let cleanContent = content.trimmedNonEmpty else {
            message = "エラー: タイトルと内容を先に入れてね"; return
        }
        Task {
            isAutoTagging = true
            defer { isAutoTagging = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/atlas/auto-tag", body: AMDOSParityAtlasAutoTagRequest(title: cleanTitle, content: cleanContent, domain: domain.trimmedNonEmpty))
                let result = try JSONDecoder().decode(AMDOSParityAtlasAutoTagResponse.self, from: data)
                guard let suggested = result.tags, !suggested.isEmpty else { message = "エラー: 自動タグ生成に失敗したよ"; return }
                // JS の `Array.from(new Set([...existing, ...tags]))` と同じく、
                // 既存の入力順を残したまま後続の重複だけを除く。
                tags = amdOSParityAtlasDeduplicatedTags(parsedTags + suggested).joined(separator: ", ")
                if let suggestedImportance = result.importance, ["high", "medium", "low"].contains(suggestedImportance) { importance = suggestedImportance }
                message = "自動タグを反映したよ"
            } catch { message = "エラー: \(error.localizedDescription)" }
        }
    }

    private func submit() {
        guard let cleanTitle = title.trimmedNonEmpty, let cleanContent = content.trimmedNonEmpty else { message = "エラー: タイトルと内容は必須"; return }
        guard let cleanURL = sourceURL.trimmedNonEmpty else { message = "エラー: ソースURLは必須（全方位アンテナの原則）"; return }
        // PWA input[type=url] と同じく、空欄でないだけの文字列は送信しない。
        guard let url = URL(string: cleanURL), let scheme = url.scheme, !scheme.isEmpty else {
            message = "エラー: ソースURLの形式を確認してね"; return
        }
        Task {
            isSubmitting = true
            defer { isSubmitting = false }
            do {
                var finalTags = parsedTags
                var finalImportance = importance
                if finalTags.isEmpty {
                    let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/atlas/auto-tag", body: AMDOSParityAtlasAutoTagRequest(title: cleanTitle, content: cleanContent, domain: domain.trimmedNonEmpty))
                    let generated = try JSONDecoder().decode(AMDOSParityAtlasAutoTagResponse.self, from: data)
                    finalTags = generated.tags ?? []
                    if let generatedImportance = generated.importance, ["high", "medium", "low"].contains(generatedImportance) { finalImportance = generatedImportance }
                }
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/atlas/signals/submit",
                    body: AMDOSParityAtlasSignalSubmitRequest(title: cleanTitle, content: cleanContent, sourceURL: cleanURL, sourceType: sourceType, domain: domain.trimmedNonEmpty, suggestedTags: finalTags, importance: finalImportance)
                )
                let response = try JSONDecoder().decode(AMDOSParityAtlasMutationResponse.self, from: data)
                guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "Inboxへ投入できなかった") }
                title = ""; sourceURL = ""; content = ""; domain = ""; tags = ""; importance = "medium"; sourceType = "news"
                message = "Inboxへ投入したよ"
                onOpenInbox()
            } catch { message = "エラー: \(error.localizedDescription)" }
        }
    }
}

/// `Array.from(new Set(values))` のJavaScriptと同じ、先に出現した値を残す重複除去。
/// Swift の `Set` をそのまま配列化すると順序がランダムになり、PWAのタグ表示順とずれる。
private func amdOSParityAtlasDeduplicatedTags(_ values: [String]) -> [String] {
    var seen: Set<String> = []
    return values.filter { seen.insert($0).inserted }
}

private struct AMDOSParityAtlasEmptyRequest: Encodable, Sendable {}

@MainActor
private final class AMDOSParityAtlasThemesStore: ObservableObject {
    @Published var existing: [AMDOSParityAtlasExistingTheme] = []
    @Published var proposals: [AMDOSParityAtlasThemeProposal] = []
    @Published var totalStories = 0
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var isClustering = false
    @Published var isApplying = false
    @Published var message: String?

    func load() async {
        state = .loading
        do {
            let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSParityAtlasThemesListResponse.self, path: "/api/atlas/themes/list")
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "テーマを取得できなかった") }
            existing = response.themes ?? []
            state = existing.isEmpty ? .empty : .loaded
        } catch { state = .failed(error.localizedDescription) }
    }

    func cluster() async {
        isClustering = true
        defer { isClustering = false }
        do {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/atlas/themes/cluster", body: AMDOSParityAtlasEmptyRequest())
            let response = try JSONDecoder().decode(AMDOSParityAtlasThemesClusterResponse.self, from: data)
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "クラスタリングできなかった") }
            if response.disabled == true { message = "クラスタリングは現在無効: \(response.reason ?? "background anthropic disabled")"; return }
            proposals = response.themes ?? []
            totalStories = response.totalStories ?? 0
            message = "\(proposals.count)件のテーマ候補を生成（\(totalStories)ストーリー対象）"
        } catch { message = "エラー: \(error.localizedDescription)" }
    }

    func apply(replace: Bool) async {
        guard !proposals.isEmpty else { return }
        isApplying = true
        defer { isApplying = false }
        do {
            let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/atlas/themes/apply", body: AMDOSParityAtlasThemesApplyRequest(themes: proposals, replace: replace))
            let response = try JSONDecoder().decode(AMDOSParityAtlasThemesApplyResponse.self, from: data)
            guard response.ok == true else { throw AMDOSNetworkError.http(response.error ?? "テーマを保存できなかった") }
            message = "保存OK: created=\(response.created ?? 0) updated=\(response.updated ?? 0) links=\(response.linksInserted ?? 0)"
            if let errors = response.errors, !errors.isEmpty { message? += " errors=\(errors.count)" }
            proposals = []
            await load()
        } catch { message = "エラー: \(error.localizedDescription)" }
    }
}

struct AMDOSParityAtlasThemesView: View {
    let onOpenAtlas: () -> Void
    @StateObject private var store = AMDOSParityAtlasThemesStore()
    @State private var replaceMode = false
    @State private var confirmApply = false
    // テーマ管理PWAのセレクトは A〜O まで。Atlas全体の taxonomy をそのまま
    // 混ぜず、この画面で選べる値だけに限定する。
    private let domains = ["", "A.地政学・マクロ経済", "B.規制・政策", "C.素材・原料", "D.エネルギー", "E.製造・プロセス技術", "F.バイオ・医療", "G.モビリティ・ロボティクス", "H.建築・インフラ", "I.ICT・AI", "J.宇宙・防衛", "K.食・農・水産", "L.金融・資本市場", "M.社会構造・社会課題", "N.海洋・水資源", "O.サーキュラーエコノミー"]

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ATLAS THEMES", title: "Atlas テーマ管理", subtitle: "世界×日本のズレマップで使うテーマを、PWAの管理APIで編集・確定する") {
            Button("← Atlas", action: onOpenAtlas)
                .buttonStyle(.link)
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if let message = store.message { Text(message).font(.caption).foregroundStyle(message.hasPrefix("エラー:") ? AMDOSDesign.warning : AMDOSDesign.muted) }
            AMDOSSectionCard("既存テーマ (\(store.existing.count))", systemImage: "square.stack.3d.up") {
                if store.existing.isEmpty {
                    Text("まだテーマが定義されていない。下のクラスタリングから候補を作れるよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                } else {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        ForEach(store.existing) { theme in
                            AMDOSCard {
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack { AMDOSStatusBadge(text: amdOSParityAtlasDomainLabel(theme.primaryDomain), tint: amdOSParityAtlasDomainColor(theme.primaryDomain)); Spacer(); Text("\(theme.storyCount ?? 0) stories").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                                    Text(theme.name).font(.headline)
                                    if let description = theme.description?.trimmedNonEmpty { Text(description).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(3) }
                                    if let keywords = theme.tagKeywords, !keywords.isEmpty { FlowLayout(spacing: 4) { ForEach(keywords.prefix(8), id: \.self) { AMDOSStatusBadge(text: $0) } } }
                                }
                            }
                        }
                    }
                }
            }
            AMDOSSectionCard("クラスタリング実行", systemImage: "sparkles") {
                Text("既存ストーリーをPWAのテーマクラスタリングAPIで解析する。候補を確認・編集して「テーマ確定」を押すまでDBには保存しない。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                Button(store.isClustering ? "解析中…" : "クラスタリング実行") { Task { await store.cluster() } }.buttonStyle(.borderedProminent).disabled(store.isClustering || store.isApplying)
            }
            if !store.proposals.isEmpty {
                AMDOSSectionCard("提案テーマ (\(store.proposals.count))", systemImage: "checklist") {
                    HStack {
                        Text("対象ストーリー \(store.totalStories)件 / 紐付け \(store.proposals.reduce(0) { $0 + $1.storyIDs.count })件").font(.caption).foregroundStyle(AMDOSDesign.muted)
                        Spacer()
                        Toggle("既存紐付けを置き換える", isOn: $replaceMode).toggleStyle(.checkbox)
                        Button(store.isApplying ? "保存中…" : "これでテーマ確定") { confirmApply = true }.buttonStyle(.borderedProminent).tint(AMDOSDesign.success).disabled(store.isApplying)
                    }
                    ForEach(store.proposals.indices, id: \.self) { index in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                TextField("テーマ名", text: $store.proposals[index].name).textFieldStyle(.roundedBorder)
                                Picker("分野", selection: $store.proposals[index].primaryDomain) { ForEach(domains, id: \.self) { value in Text(value.isEmpty ? "分野" : value).tag(value) } }.frame(width: 190)
                                Text("\(store.proposals[index].storyIDs.count) stories").font(.caption).foregroundStyle(AMDOSDesign.muted)
                                Button("削除", role: .destructive) { store.proposals.remove(at: index) }.buttonStyle(.borderless)
                            }
                            TextField("説明", text: $store.proposals[index].description, axis: .vertical).textFieldStyle(.roundedBorder)
                            TextField("タグキーワード（カンマ区切り）", text: Binding(get: { store.proposals[index].tagKeywords.joined(separator: ", ") }, set: { store.proposals[index].tagKeywords = $0.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } })).textFieldStyle(.roundedBorder)
                        }
                        .padding(.vertical, 8)
                        Divider()
                    }
                }
            }
        }
        .task { await store.load() }
        .confirmationDialog("\(store.proposals.count)個のテーマを保存する？", isPresented: $confirmApply, titleVisibility: .visible) {
            Button("テーマ確定", role: .destructive) { Task { await store.apply(replace: replaceMode) } }
            Button("キャンセル", role: .cancel) {}
        } message: {
            let links = store.proposals.reduce(0) { $0 + $1.storyIDs.count }
            Text("\(store.proposals.count)個のテーマを保存し、合計\(links)件の紐付けを作る。\(replaceMode ? "対象ストーリーの既存紐付けは置き換える。" : "既存紐付けは保持して追記する。")")
        }
    }
}

private enum AMDOSParityAtlasDivergenceViewMode: String, CaseIterable, Identifiable {
    case cards, scatter, heatmap
    var id: String { rawValue }
    var label: String {
        switch self { case .cards: return "カード"; case .scatter: return "散布図"; case .heatmap: return "ヒートマップ" }
    }
}

private enum AMDOSParityAtlasDivergenceSort: String, CaseIterable, Identifiable {
    case global, japan, divergence
    var id: String { rawValue }
    var label: String {
        switch self { case .global: return "世界の動き順"; case .japan: return "日本の動き順"; case .divergence: return "ギャップ順" }
    }
}

private extension AMDOSParityAtlasJSON {
    var atlasObject: [String: AMDOSParityAtlasJSON]? { if case let .object(value) = self { return value }; return nil }
    var atlasArray: [AMDOSParityAtlasJSON]? { if case let .array(value) = self { return value }; return nil }
    var atlasString: String? { if case let .string(value) = self { return value }; return nil }
}

private struct AMDOSParityAtlasSignalReference: Identifiable {
    let title: String
    let url: String?
    let date: String?
    let ministry: String?
    var id: String { "\(title)|\(url ?? "")|\(date ?? "")" }
}

private func amdOSParityAtlasReferences(_ json: AMDOSParityAtlasJSON?, key: String) -> [AMDOSParityAtlasSignalReference] {
    guard let values = json?.atlasObject?[key]?.atlasArray else { return [] }
    return values.compactMap { entry in
        guard let object = entry.atlasObject, let title = object["title"]?.atlasString?.trimmedNonEmpty else { return nil }
        return AMDOSParityAtlasSignalReference(title: title, url: object["url"]?.atlasString, date: object["date"]?.atlasString, ministry: object["ministry"]?.atlasString)
    }
}

struct AMDOSParityAtlasDivergenceView: View {
    let onOpenAtlas: () -> Void
    @StateObject private var store = AMDOSParityAtlasStore()
    @State private var viewMode: AMDOSParityAtlasDivergenceViewMode = .cards
    @State private var sort: AMDOSParityAtlasDivergenceSort = .global
    @State private var heatmapAxis: AMDOSParityAtlasDivergenceSort = .global
    @State private var domainFilter: String?
    @State private var selectedThemeID: String?

    init(onOpenAtlas: @escaping () -> Void = {}) {
        self.onOpenAtlas = onOpenAtlas
    }

    private var domainCounts: [(String, Int)] {
        Dictionary(grouping: store.divergences.compactMap { amdOSParityAtlasDomainKey($0.theme.primaryDomain) }, by: { $0 }).map { ($0.key, $0.value.count) }.sorted { $0.1 > $1.1 }
    }

    private var filtered: [AMDOSParityAtlasDivergence] {
        store.divergences.filter { domainFilter == nil || amdOSParityAtlasDomainKey($0.theme.primaryDomain) == domainFilter }.sorted { lhs, rhs in
            let left: Double
            let right: Double
            switch sort {
            case .global: left = lhs.row.globalIntensity ?? 0; right = rhs.row.globalIntensity ?? 0
            case .japan: left = lhs.row.japanIntensity ?? 0; right = rhs.row.japanIntensity ?? 0
            case .divergence: left = lhs.row.divergenceScore ?? 0; right = rhs.row.divergenceScore ?? 0
            }
            return left > right
        }
    }

    private var selected: AMDOSParityAtlasDivergence? {
        guard let selectedThemeID else { return nil }
        return filtered.first(where: { $0.row.themeID == selectedThemeID })
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ATLAS DIVERGENCE", title: "マクロトレンドマップ", subtitle: "世界の動き × 日本の動き × ギャップをPWAと同じ atlas_divergences から確認") {
            Button("← Atlas", action: onOpenAtlas).buttonStyle(.link)
            AMDOSStateNotice(state: store.state) { Task { await store.loadDivergence() } }
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(filtered.count) themes").font(.subheadline).foregroundStyle(AMDOSDesign.muted)
                    if let generatedAt = store.divergences.first?.row.generatedAt { Text("最終生成: \(amdOSParityAtlasDate(generatedAt))").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                }
                Spacer()
                Picker("表示", selection: $viewMode) { ForEach(AMDOSParityAtlasDivergenceViewMode.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented).frame(width: 300)
            }
            if viewMode == .cards {
                Picker("並び順", selection: $sort) { ForEach(AMDOSParityAtlasDivergenceSort.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented)
            }
            if viewMode == .heatmap {
                Picker("色軸", selection: $heatmapAxis) { ForEach(AMDOSParityAtlasDivergenceSort.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented)
            }
            if !domainCounts.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(domainCounts, id: \.0) { domain, count in
                        if domainFilter == domain {
                            Button("\(amdOSParityAtlasDomainLabel(domain))  \(count)") { domainFilter = nil }
                                .buttonStyle(.borderedProminent)
                                .tint(amdOSParityAtlasDomainColor(domain))
                        } else {
                            Button("\(amdOSParityAtlasDomainLabel(domain))  \(count)") { domainFilter = domain }
                                .buttonStyle(.bordered)
                                .tint(amdOSParityAtlasDomainColor(domain))
                        }
                    }
                    if domainFilter != nil { Button("解除") { domainFilter = nil }.buttonStyle(.borderless) }
                }
            }
            if filtered.isEmpty && (store.state == .loaded || store.state == .empty) {
                ContentUnavailableView("該当するテーマはないよ", systemImage: "chart.xyaxis.line")
            } else {
                switch viewMode {
                case .cards:
                    VStack(spacing: 10) { ForEach(filtered) { item in AMDOSParityAtlasDivergenceCard(item: item, selected: selectedThemeID == item.row.themeID) { selectedThemeID = item.row.themeID } } }
                case .scatter:
                    AMDOSParityAtlasDivergenceScatter(items: filtered, selectedThemeID: $selectedThemeID)
                case .heatmap:
                    AMDOSParityAtlasDivergenceHeatmap(items: filtered, axis: heatmapAxis, selectedThemeID: $selectedThemeID)
                }
            }
            if let selected { AMDOSParityAtlasDivergenceDetail(item: selected) }
        }
        .task { await store.loadDivergence() }
    }
}

private struct AMDOSParityAtlasDivergenceCard: View {
    let item: AMDOSParityAtlasDivergence
    let selected: Bool
    let onSelect: () -> Void
    var body: some View {
        Button(action: onSelect) {
            AMDOSCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 5) {
                            AMDOSStatusBadge(text: amdOSParityAtlasDomainLabel(item.theme.primaryDomain), tint: amdOSParityAtlasDomainColor(item.theme.primaryDomain))
                            Text(item.theme.name).font(.headline)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 3) {
                            Text("🌍 \(Int(((item.row.globalIntensity ?? 0) * 100).rounded()))").font(.caption.monospacedDigit()).foregroundStyle(.blue)
                            Text("🗾 \(Int(((item.row.japanIntensity ?? 0) * 100).rounded()))").font(.caption.monospacedDigit()).foregroundStyle(.red)
                            Text("⚡ \(Int(((item.row.divergenceScore ?? 0) * 100).rounded()))").font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.muted)
                        }
                    }
                    HStack(alignment: .top, spacing: 18) {
                        AMDOSParityAtlasDivergenceNarrative(title: "🌍 世界の動き", count: item.row.globalSignalCount ?? 0, content: item.row.globalSummary, tint: .blue)
                        Divider()
                        AMDOSParityAtlasDivergenceNarrative(title: "🗾 日本の動き", count: item.row.japanSignalCount ?? 0, content: item.row.japanSummary, tint: .red)
                    }
                    if let message = item.row.divergenceMessage?.trimmedNonEmpty { Label(message, systemImage: "bolt.fill").font(.caption).foregroundStyle(AMDOSDesign.warning).lineLimit(2) }
                }
            }
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? AMDOSDesign.blue : .clear, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }
}

private struct AMDOSParityAtlasDivergenceNarrative: View {
    let title: String
    let count: Int
    let content: String?
    let tint: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack { Text(title).font(.caption.weight(.bold)).foregroundStyle(tint); Spacer(); Text("\(count) signals").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
            Text(content?.trimmedNonEmpty ?? "該当シグナル少").font(.caption).foregroundStyle(content?.trimmedNonEmpty == nil ? AMDOSDesign.muted : AMDOSDesign.ink).lineLimit(5)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct AMDOSParityAtlasDivergenceScatter: View {
    let items: [AMDOSParityAtlasDivergence]
    @Binding var selectedThemeID: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text("横軸: 世界の動き").font(.caption).foregroundStyle(.blue); Spacer(); Text("縦軸: 日本の動き").font(.caption).foregroundStyle(.red) }
            GeometryReader { proxy in
                ZStack(alignment: .bottomLeading) {
                    Path { path in
                        path.move(to: CGPoint(x: 30, y: proxy.size.height - 30)); path.addLine(to: CGPoint(x: proxy.size.width - 15, y: proxy.size.height - 30))
                        path.move(to: CGPoint(x: 30, y: proxy.size.height - 30)); path.addLine(to: CGPoint(x: 30, y: 15))
                    }.stroke(AMDOSDesign.border, lineWidth: 1)
                    ForEach(items) { item in
                        let global = max(0, min(1, item.row.globalIntensity ?? 0))
                        let japan = max(0, min(1, item.row.japanIntensity ?? 0))
                        let gap = max(0, min(1, item.row.divergenceScore ?? 0))
                        let point = CGPoint(x: 30 + global * max(1, proxy.size.width - 50), y: proxy.size.height - 30 - japan * max(1, proxy.size.height - 50))
                        Button { selectedThemeID = item.row.themeID } label: {
                            VStack(spacing: 2) {
                                Circle().fill(amdOSParityAtlasDomainColor(item.theme.primaryDomain)).frame(width: 18 + gap * 28, height: 18 + gap * 28).overlay(Circle().stroke(selectedThemeID == item.row.themeID ? Color.white : .clear, lineWidth: 3))
                                Text(item.theme.name).font(.caption2).lineLimit(1).frame(maxWidth: 100)
                            }
                        }.buttonStyle(.plain).position(point)
                    }
                }
            }.frame(height: 420).background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 14))
        }
    }
}

private struct AMDOSParityAtlasDivergenceHeatmap: View {
    let items: [AMDOSParityAtlasDivergence]
    let axis: AMDOSParityAtlasDivergenceSort
    @Binding var selectedThemeID: String?
    private var columns: [GridItem] { Array(repeating: GridItem(.flexible(), spacing: 6), count: 4) }
    private func value(_ item: AMDOSParityAtlasDivergence) -> Double {
        switch axis { case .global: return item.row.globalIntensity ?? 0; case .japan: return item.row.japanIntensity ?? 0; case .divergence: return item.row.divergenceScore ?? 0 }
    }
    private func color(_ value: Double) -> Color {
        let opacity = 0.15 + max(0, min(1, value)) * 0.8
        switch axis { case .global: return .blue.opacity(opacity); case .japan: return .red.opacity(opacity); case .divergence: return value > 0.6 ? .red.opacity(opacity) : .orange.opacity(opacity) }
    }
    var body: some View {
        LazyVGrid(columns: columns, spacing: 6) {
            ForEach(items) { item in
                Button { selectedThemeID = item.row.themeID } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.theme.name).font(.caption.weight(.semibold)).lineLimit(2)
                        Text("\(Int((value(item) * 100).rounded()))").font(.title3.monospacedDigit().weight(.bold))
                    }.frame(maxWidth: .infinity, minHeight: 82, alignment: .leading).padding(10).background(color(value(item)), in: RoundedRectangle(cornerRadius: 9)).overlay(RoundedRectangle(cornerRadius: 9).stroke(selectedThemeID == item.row.themeID ? AMDOSDesign.ink : .clear, lineWidth: 2))
                }.buttonStyle(.plain)
            }
        }
    }
}

private struct AMDOSParityAtlasDivergenceDetail: View {
    let item: AMDOSParityAtlasDivergence
    var body: some View {
        AMDOSSectionCard("\(item.theme.name) の根拠", systemImage: "doc.text.magnifyingglass") {
            if let description = item.theme.description?.trimmedNonEmpty { Text(description).font(.subheadline).foregroundStyle(AMDOSDesign.muted) }
            if let message = item.row.divergenceMessage?.trimmedNonEmpty {
                Label(message, systemImage: "bolt.fill").font(.subheadline).foregroundStyle(AMDOSDesign.warning)
            }
            HStack(alignment: .top, spacing: 18) {
                AMDOSParityAtlasDivergenceNarrative(
                    title: "🌍 世界の動き · 活発度 \(Int(((item.row.globalIntensity ?? 0) * 100).rounded()))",
                    count: item.row.globalSignalCount ?? 0,
                    content: item.row.globalSummary,
                    tint: .blue
                )
                Divider()
                AMDOSParityAtlasDivergenceNarrative(
                    title: "🗾 日本の動き · 活発度 \(Int(((item.row.japanIntensity ?? 0) * 100).rounded()))",
                    count: item.row.japanSignalCount ?? 0,
                    content: item.row.japanSummary,
                    tint: .red
                )
            }
            HStack(alignment: .top, spacing: 18) {
                AMDOSParityAtlasDivergenceReferenceList(title: "世界側の観測", refs: amdOSParityAtlasReferences(item.row.signalBreakdown, key: "global"), tint: .blue)
                AMDOSParityAtlasDivergenceReferenceList(title: "日本側の観測", refs: amdOSParityAtlasReferences(item.row.signalBreakdown, key: "japan"), tint: .red)
            }
            if !item.theme.visibleKeywords.isEmpty { FlowLayout(spacing: 5) { ForEach(item.theme.visibleKeywords, id: \.self) { AMDOSStatusBadge(text: "#\($0)") } } }
            if let generatedAt = item.row.generatedAt { Text("生成日時: \(amdOSParityAtlasDate(generatedAt))").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
        }
    }
}

private struct AMDOSParityAtlasDivergenceReferenceList: View {
    let title: String
    let refs: [AMDOSParityAtlasSignalReference]
    let tint: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.caption.weight(.bold)).foregroundStyle(tint)
            if refs.isEmpty { Text("参照シグナルは記録されていないよ").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            ForEach(refs) { ref in
                VStack(alignment: .leading, spacing: 2) {
                    Text(ref.title).font(.caption.weight(.medium))
                    if let urlText = ref.url, let url = URL(string: urlText) { Link(urlText, destination: url).font(.caption2).lineLimit(1) }
                    if let date = ref.date { Text(date).font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                }
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

private enum AMDOSParityAtlasMapRange: String, CaseIterable, Identifiable {
    case all, d30, d7, h24
    var id: String { rawValue }
    var label: String { switch self { case .all: return "全期間"; case .d30: return "30日"; case .d7: return "7日"; case .h24: return "24h" } }
    var seconds: TimeInterval? { switch self { case .all: return nil; case .d30: return 30 * 24 * 3600; case .d7: return 7 * 24 * 3600; case .h24: return 24 * 3600 } }
}

private struct AMDOSParityAtlasMapLink: Identifiable {
    let sourceID: String
    let targetID: String
    let weight: Int
    var id: String { "\(sourceID)__\(targetID)" }
}

private func amdOSParityAtlasDateValue(_ value: String?) -> Date? {
    guard let value else { return nil }
    let formatter = ISO8601DateFormatter()
    return formatter.date(from: value)
}

private func amdOSParityAtlasMapLinks(_ stories: [AMDOSParityAtlasStory], signalsByStory: [String: [AMDOSParityAtlasSignal]]) -> [AMDOSParityAtlasMapLink] {
    func tags(for story: AMDOSParityAtlasStory) -> Set<String> { Set(story.visibleTags + (signalsByStory[story.id] ?? []).flatMap(\.visibleTags)) }
    var result: [AMDOSParityAtlasMapLink] = []
    var seen: Set<String> = []
    for sourceIndex in stories.indices {
        let source = stories[sourceIndex]
        let sourceTags = tags(for: source)
        var candidates: [(index: Int, overlap: Int)] = []
        for targetIndex in stories.indices where sourceIndex != targetIndex {
            let overlap = sourceTags.intersection(tags(for: stories[targetIndex])).count
            if overlap >= 3 { candidates.append((targetIndex, overlap)) }
        }
        for candidate in candidates.sorted(by: { $0.overlap > $1.overlap }).prefix(2) {
            let target = stories[candidate.index]
            let key = [source.id, target.id].sorted().joined(separator: "__")
            guard seen.insert(key).inserted else { continue }
            result.append(AMDOSParityAtlasMapLink(sourceID: source.id, targetID: target.id, weight: candidate.overlap))
        }
    }
    return result
}

struct AMDOSParityAtlasMapView: View {
    let onOpenAtlas: () -> Void
    @StateObject private var store = AMDOSParityAtlasStore()
    @State private var range: AMDOSParityAtlasMapRange = .d30
    @State private var domainFilters: Set<String> = []
    @State private var tagFilters: Set<String> = []
    @State private var selectedStoryID: String?

    init(onOpenAtlas: @escaping () -> Void = {}) {
        self.onOpenAtlas = onOpenAtlas
    }

    private var signalsByStory: [String: [AMDOSParityAtlasSignal]] {
        var grouped: [String: [AMDOSParityAtlasSignal]] = [:]
        for signal in store.acceptedSignals {
            guard let storyID = signal.storyID else { continue }
            grouped[storyID, default: []].append(signal)
        }
        return grouped
    }
    private var rangedStories: [AMDOSParityAtlasStory] {
        let cutoff = range.seconds.map { Date().addingTimeInterval(-$0) }
        return store.stories.filter { story in
            guard !(signalsByStory[story.id] ?? []).isEmpty else { return false }
            guard let cutoff else { return true }
            return (amdOSParityAtlasDateValue(story.lastUpdatedAt) ?? .distantPast) >= cutoff
        }
    }
    private var visibleStories: [AMDOSParityAtlasStory] {
        rangedStories.filter { story in
            if !domainFilters.isEmpty && !domainFilters.contains(amdOSParityAtlasDomainKey(story.primaryDomain) ?? "") { return false }
            if !tagFilters.isEmpty {
                let tags = Set(story.visibleTags + (signalsByStory[story.id] ?? []).flatMap(\.visibleTags))
                if tags.intersection(tagFilters).isEmpty { return false }
            }
            return true
        }
    }
    private var domainCounts: [(String, Int)] { Dictionary(grouping: rangedStories.compactMap { amdOSParityAtlasDomainKey($0.primaryDomain) }, by: { $0 }).map { ($0.key, $0.value.count) }.sorted { $0.1 > $1.1 } }
    private var tagCounts: [(String, Int)] {
        var values: [String: Int] = [:]
        for story in rangedStories { Set(story.visibleTags + (signalsByStory[story.id] ?? []).flatMap(\.visibleTags)).forEach { values[$0, default: 0] += 1 } }
        return values.map { ($0.key, $0.value) }.sorted { $0.1 > $1.1 }
    }
    private var selected: AMDOSParityAtlasStory? { visibleStories.first(where: { $0.id == selectedStoryID }) }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "ATLAS MAP", title: "Atlas Map", subtitle: "共通タグ3個以上で結んだストーリー関係を、期間・分野・タグでたどる") {
            Button("← Atlas", action: onOpenAtlas).buttonStyle(.link)
            AMDOSStateNotice(state: store.state) { Task { await store.loadHome() } }
            HStack {
                Text("\(visibleStories.count) stories · \(amdOSParityAtlasMapLinks(visibleStories, signalsByStory: signalsByStory).count) 共通テーマ接続").font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Picker("期間", selection: $range) { ForEach(AMDOSParityAtlasMapRange.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented).frame(width: 310)
            }
            if !domainCounts.isEmpty {
                VStack(alignment: .leading, spacing: 5) {
                    Text("分野（複数可）").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                    FlowLayout(spacing: 6) {
                        ForEach(domainCounts, id: \.0) { domain, count in
                            if domainFilters.contains(domain) {
                                Button("\(amdOSParityAtlasDomainLabel(domain))  \(count)") { domainFilters.remove(domain) }
                                    .buttonStyle(.borderedProminent)
                                    .tint(amdOSParityAtlasDomainColor(domain))
                            } else {
                                Button("\(amdOSParityAtlasDomainLabel(domain))  \(count)") { domainFilters.insert(domain) }
                                    .buttonStyle(.bordered)
                                    .tint(amdOSParityAtlasDomainColor(domain))
                            }
                        }
                    }
                }
            }
            if !tagCounts.isEmpty {
                VStack(alignment: .leading, spacing: 5) {
                    Text("タグ（複数可）").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                    FlowLayout(spacing: 6) {
                        ForEach(tagCounts.prefix(14), id: \.0) { tag, count in
                            if tagFilters.contains(tag) {
                                Button("#\(tag)  \(count)") { tagFilters.remove(tag) }.buttonStyle(.borderedProminent)
                            } else {
                                Button("#\(tag)  \(count)") { tagFilters.insert(tag) }.buttonStyle(.bordered)
                            }
                        }
                    }
                }
            }
            if !domainFilters.isEmpty || !tagFilters.isEmpty { Button("フィルタを解除") { domainFilters = []; tagFilters = [] }.buttonStyle(.borderless) }
            if visibleStories.isEmpty && (store.state == .loaded || store.state == .empty) {
                ContentUnavailableView("表示できるストーリーはないよ", systemImage: "point.3.connected.trianglepath.dotted", description: Text("期間を広げるかフィルタを解除してね"))
            } else {
                AMDOSParityAtlasMapCanvas(stories: visibleStories, signalsByStory: signalsByStory, selectedStoryID: $selectedStoryID)
            }
            if let selected {
                AMDOSParityAtlasMapDetail(
                    story: selected,
                    signals: (signalsByStory[selected.id] ?? []).sorted { ($0.submittedAt ?? "") < ($1.submittedAt ?? "") },
                    onClose: { selectedStoryID = nil },
                    onSelectTag: { tag in
                        if tagFilters.contains(tag) { tagFilters.remove(tag) }
                        else { tagFilters.insert(tag) }
                    },
                    onOpenAtlas: onOpenAtlas
                )
            }
        }
        .task { await store.loadHome() }
    }
}

private struct AMDOSParityAtlasMapCanvas: View {
    let stories: [AMDOSParityAtlasStory]
    let signalsByStory: [String: [AMDOSParityAtlasSignal]]
    @Binding var selectedStoryID: String?

    private func positions(in size: CGSize) -> [String: CGPoint] {
        guard !stories.isEmpty else { return [:] }
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let maximum = min(size.width, size.height) * 0.38
        return Dictionary(uniqueKeysWithValues: stories.enumerated().map { index, story in
            let angle = Double(index) * 2.399963229728653
            let radius = maximum * sqrt(Double(index + 1) / Double(stories.count + 1))
            return (story.id, CGPoint(x: center.x + cos(angle) * radius, y: center.y + sin(angle) * radius))
        })
    }

    var body: some View {
        GeometryReader { proxy in
            let positions = positions(in: proxy.size)
            let links = amdOSParityAtlasMapLinks(stories, signalsByStory: signalsByStory)
            ZStack {
                Canvas { context, _ in
                    for link in links {
                        guard let source = positions[link.sourceID], let target = positions[link.targetID] else { continue }
                        var path = Path(); path.move(to: source); path.addLine(to: target)
                        context.stroke(path, with: .color(AMDOSDesign.muted.opacity(0.28)), lineWidth: CGFloat(0.4 + min(2.4, Double(link.weight) * 0.4)))
                    }
                }
                ForEach(stories) { story in
                    if let point = positions[story.id] {
                        let signals = signalsByStory[story.id] ?? []
                        Button { selectedStoryID = story.id } label: {
                            VStack(spacing: 3) {
                                Circle().fill(amdOSParityAtlasDomainColor(story.primaryDomain)).frame(width: CGFloat(22 + min(30, signals.count * 4 + (story.importance == "high" ? 8 : 0))), height: CGFloat(22 + min(30, signals.count * 4 + (story.importance == "high" ? 8 : 0)))).overlay(Circle().stroke(selectedStoryID == story.id ? Color.white : .clear, lineWidth: 3))
                                Text(story.title).font(.caption2).lineLimit(2).multilineTextAlignment(.center).frame(width: 100)
                            }
                        }.buttonStyle(.plain).position(point)
                    }
                }
            }
        }
        .frame(height: 560)
        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(AMDOSDesign.border, lineWidth: 1))
    }
}

private struct AMDOSParityAtlasMapDetail: View {
    let story: AMDOSParityAtlasStory
    let signals: [AMDOSParityAtlasSignal]
    let onClose: () -> Void
    let onSelectTag: (String) -> Void
    let onOpenAtlas: () -> Void
    var body: some View {
        AMDOSSectionCard("\(story.title) の時系列", systemImage: "timeline.selection") {
            HStack(spacing: 6) {
                AMDOSStatusBadge(text: amdOSParityAtlasDomainLabel(story.primaryDomain), tint: amdOSParityAtlasDomainColor(story.primaryDomain))
                AMDOSStatusBadge(text: (story.importance ?? "medium").uppercased(), tint: amdOSParityAtlasImportanceColor(story.importance))
                Text("\(signals.count) signals").font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button("閉じる", action: onClose).buttonStyle(.borderless)
            }
            if let summary = story.summary?.trimmedNonEmpty { Text(summary).font(.subheadline).foregroundStyle(AMDOSDesign.muted) }
            if !story.visibleTags.isEmpty {
                FlowLayout(spacing: 5) {
                    ForEach(story.visibleTags.prefix(10), id: \.self) { tag in
                        Button("#\(tag)") { onSelectTag(tag) }.buttonStyle(.bordered)
                    }
                }
            }
            ForEach(signals) { signal in
                HStack(alignment: .top, spacing: 10) {
                    Circle().fill(amdOSParityAtlasDomainColor(story.primaryDomain)).frame(width: 8, height: 8).padding(.top, 4)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(signal.title).font(.subheadline.weight(.semibold))
                        Text(signal.content).font(.caption).foregroundStyle(AMDOSDesign.muted).lineLimit(4)
                        Text(amdOSParityAtlasDate(signal.submittedAt)).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                        if let rawURL = signal.sourceURL, let url = URL(string: rawURL) {
                            HStack(spacing: 5) {
                                AMDOSStatusBadge(text: amdOSParityAtlasSourceTypeLabel(signal.sourceType))
                                Link(rawURL, destination: url).font(.caption2).lineLimit(1)
                            }
                        }
                    }
                }
            }
            Button("Atlasで詳細を見る →", action: onOpenAtlas).buttonStyle(.borderedProminent)
        }
    }
}
