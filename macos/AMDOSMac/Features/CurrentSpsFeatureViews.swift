import SwiftUI

@MainActor
private final class AMDOSCurrentSpsStore: ObservableObject {
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var projects: [AMDOSCurrentProject] = []
    @Published var assessments: [AMDOSCurrentSpsAssessment] = []

    struct AMDOSCurrentProject: Identifiable, Sendable {
        let id: String
        let name: String
        let status: String
    }

    func load() async {
        state = .loading
        do {
            let response = try await AMDOSRESTClient.shared.fetchPWA(AMDOSHUDResponse.self, path: "/api/hud/dashboard")
            projects = response.projects.map { .init(id: $0.projectId, name: $0.projectName, status: $0.status ?? "未設定") }
            assessments = response.currentSps ?? []
            state = projects.isEmpty ? .empty : .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func assessment(for projectId: String) -> AMDOSCurrentSpsAssessment? {
        assessments.first { $0.projectId == projectId }
    }
}

struct AMDOSCurrentSpsView: View {
    let onSelectProject: (String) -> Void
    @StateObject private var store = AMDOSCurrentSpsStore()

    var body: some View {
        AMDOSPageScaffold(eyebrow: "CURRENT SPS", title: "現行SPS", subtitle: "産業創出価値版の凍結評価だけを表示") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            ForEach(store.projects) { project in
                let assessment = store.assessment(for: project.id)
                Button { onSelectProject(project.id) } label: {
                    AMDOSCard {
                        HStack(spacing: 14) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(project.name).font(.headline)
                                Text("\(project.id) · \(project.status)").font(.caption).foregroundStyle(AMDOSDesign.muted)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 3) {
                                Text(assessment?.status == "assessed" ? bandText(assessment) : "最新版未評価").font(.headline.monospacedDigit())
                                Text(assessment?.assessmentId ?? "no current assessment").font(.caption2.monospaced()).foregroundStyle(AMDOSDesign.muted)
                            }
                            AMDOSStatusBadge(text: assessment?.status == "assessed" ? "評価済み" : "最新版未評価", tint: assessment?.status == "assessed" ? AMDOSDesign.success : AMDOSDesign.warning)
                        }
                    }
                }.buttonStyle(.plain)
            }
            Text("sps-ind-v1 / q-eval-v2 / rubric-v1.1 / p-ind-v1。旧版へのfallbackはしない。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
        }.task { await store.load() }
    }
}

struct AMDOSCurrentSpsDetailView: View {
    let projectId: String?
    @StateObject private var store = AMDOSCurrentSpsStore()

    var body: some View {
        let project = store.projects.first { $0.id == projectId }
        let assessment = projectId.flatMap(store.assessment(for:))
        AMDOSPageScaffold(eyebrow: "CURRENT SPS DETAIL", title: project?.name ?? projectId ?? "現行SPS", subtitle: "SPS = Σ qₒ Pⁱⁿᵈₒ") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            AMDOSSectionCard("産業創出価値", systemImage: "scope") {
                HStack {
                    AMDOSMetricTile(label: "SPS帯", value: assessment?.status == "assessed" ? bandText(assessment) : "最新版未評価", detail: assessment?.assessedAt?.prefix(10).description ?? "評価なし", tint: assessment?.status == "assessed" ? AMDOSDesign.success : AMDOSDesign.warning)
                    AMDOSMetricTile(label: "根拠Lv", value: "Lv\(assessment?.evidenceLevel ?? 0)", detail: "評価成熟度")
                }
                Text("版: \(assessment?.model.measureVersion ?? "sps-ind-v1") / \(assessment?.model.qModelVersion ?? "q-eval-v2") / \(assessment?.model.qRulesetVersion ?? "rubric-v1.1") / \(assessment?.model.pModelVersion ?? "p-ind-v1")")
                    .font(.caption.monospaced()).foregroundStyle(AMDOSDesign.muted)
                Text("assessment: \(assessment?.assessmentId ?? "none")").font(.caption2.monospaced()).foregroundStyle(AMDOSDesign.muted)
            }
            AMDOSSectionCard("BZM 2.2", systemImage: "function") {
                Text("BZM 2.2のJ/P/Q/SはSPSとは別の暫定パイロット。現行SPSへ合算しない。")
                    .foregroundStyle(AMDOSDesign.muted)
            }
        }.task { await store.load() }
    }
}

struct AMDOSRetiredScoreRouteView: View {
    var body: some View {
        AMDOSPageScaffold(eyebrow: "RETIRED", title: "旧スコア導線は退役済み", subtitle: "現行SPSは評価候補・review・publishで更新") {
            AMDOSSectionCard("書込み停止", systemImage: "lock.shield") {
                Text("旧9軸、SPS 2.1、α再計算は使わない。既存行は監査履歴として残し、現行値へfallbackしない。")
            }
        }
    }
}

func bandText(_ assessment: AMDOSCurrentSpsAssessment?) -> String {
    guard let lower = assessment?.spsLowerYen, let upper = assessment?.spsUpperYen else { return "—" }
    return "\(formatOku(lower))〜\(formatOku(upper))"
}

private func formatOku(_ yen: Double) -> String {
    let oku = yen / 100_000_000
    return String(format: oku < 10 ? "%.1f億円" : "%.0f億円", oku)
}
