import Foundation
import SwiftUI

private struct AMDOSP1Setting: Codable, Identifiable, Sendable {
    let key: String
    let label: String?
    let value: String?
    let type: String?
    let description: String?
    let updatedAt: String?

    var id: String { key }

    enum CodingKeys: String, CodingKey {
        case key, label, value, type, description
        case updatedAt = "updated_at"
    }
}

private struct AMDOSP1SettingsEnvelope: Codable, Sendable {
    let ok: Bool?
    let settings: [AMDOSP1Setting]?
    let catalog: AMDOSP1OperationsCatalog?
    let error: String?
}

private struct AMDOSP1OperationsCatalog: Codable, Sendable {
    let rawDataSources: [AMDOSP1RuntimeSource]
    let l2Datasets: [AMDOSP1RuntimeDataset]
    let cronOperations: [AMDOSP1CronOperation]
}

private struct AMDOSP1SettingMutation: Codable, Sendable {
    let ok: Bool?
    let setting: AMDOSP1Setting?
    let key: String?
    let error: String?
}

private struct AMDOSP1SettingDraft: Encodable, Sendable {
    var isNew: Bool
    var key: String
    var label: String
    var value: String
    var type: String
    var description: String

    init() {
        isNew = true
        key = ""
        label = ""
        value = ""
        type = "string"
        description = ""
    }

    init(setting: AMDOSP1Setting) {
        isNew = false
        key = setting.key
        label = setting.label ?? ""
        value = setting.value ?? ""
        type = setting.type ?? "string"
        description = setting.description ?? ""
    }

    enum CodingKeys: String, CodingKey { case key, label, value, type, description }
}

private struct AMDOSP1EmptyBody: Encodable, Sendable {}

private struct AMDOSP1RuntimeSource: Codable, Identifiable, Sendable {
    let id: String
    let label: String
    let owner: String
    let refresh: String
    let landsIn: [String]
    let notes: String
}

private struct AMDOSP1RuntimeDataset: Codable, Identifiable, Sendable {
    let id: String
    let label: String
    let tier: String
    let table: String
    var source: String? = nil
    let cadence: String
    let purpose: String
}

private struct AMDOSP1CronOperation: Codable, Identifiable, Sendable {
    let id: String
    let label: String
    let layer: String
    let cadence: String
    let trigger: String
    let defaultParams: String
    let input: String?
    let output: String?
    let runType: String?
    let manualReason: String?

    var isManual: Bool { runType == "manual" }
    var reason: String? { manualReason }
}

private let amdosp1RuntimeSources: [AMDOSP1RuntimeSource] = [
    .init(id: "calendar", label: "Google Calendar", owner: "GAS", refresh: "毎時0分", landsIn: ["project_meeting_summaries", "meeting_notifications", "project_strategy_signals", "contract_signals"], notes: "会議eventを主軸に、終了後のPJ関連MTGを拾う。"),
    .init(id: "notion-minutes", label: "Notion AI 議事録", owner: "GAS", refresh: "Calendar polling / 03:00 fallback", landsIn: ["project_meeting_summaries", "project_strategy_signals", "contract_signals"], notes: "eventIdや日付が空でもtitle+date fallbackで拾う。"),
    .init(id: "gmail", label: "Gmail / CircleBack / Meet", owner: "GAS + PWA", refresh: "MTG抽出時 / source collect時", landsIn: ["project_meeting_summaries", "source_cache", "member_activities"], notes: "報告メール・録画通知・関係先往復を拾う。"),
    .init(id: "slack", label: "Slack", owner: "GAS/PWA connectors", refresh: "backfill / L2 source collect", landsIn: ["project_meeting_summaries", "member_activities", "source_cache"], notes: "PJ channel / threadから進捗・論点・メンバー活動を抽出。"),
    .init(id: "drive", label: "Google Drive", owner: "GAS/PWA", refresh: "monthly / backfill / source collect", landsIn: ["project_meeting_summaries", "monthly_reports", "source_cache"], notes: "議事録doc、月次資料、PJ関連ファイルを情報源にする。"),
    .init(id: "web-external", label: "Web / 外部シグナル", owner: "PWA + Codex automation", refresh: "daily / weekly / monthly", landsIn: ["atlas_stories", "atlas_signals", "macro_index_log", "vc_news"], notes: "Atlas、政策、VC、Macrotrend系の外部観測。"),
]

private let amdosp1RuntimeDatasets: [AMDOSP1RuntimeDataset] = [
    .init(id: "monthly_reports", label: "M-1 月次報告書", tier: "L2", table: "monthly_reports", cadence: "daily 05:30 JST / ACTIVE", purpose: "PJごとの月次報告書。後続L2の基礎。"),
    .init(id: "protocols", label: "D-1 AMDプロトコル", tier: "L2", table: "protocols / protocol_examples", cadence: "daily 08:00 JST 相当", purpose: "経営判断を分岐点・判断材料・アクション・結果に構造化。"),
    .init(id: "ms_progress", label: "D-2 MS進捗", tier: "L2", table: "milestone_monthly_progress", cadence: "毎時0分相当", purpose: "月次進捗を推定し、乖離revisionを扱う。"),
    .init(id: "project_knowledge", label: "D-3 PJナレッジ", tier: "L2", table: "project_knowledge", cadence: "daily 08:15 JST 相当", purpose: "PJの人物・組織・事実・進行中事項を更新。"),
    .init(id: "member_knowledge", label: "D-4 メンバーナレッジ", tier: "L2", table: "member_knowledge", cadence: "daily 08:30 JST 相当", purpose: "メンバーの強み・スキル・関心・活動を抽出。"),
    .init(id: "meeting_summaries", label: "H-1 MTGフロー", tier: "L2", table: "project_meeting_summaries", cadence: "毎時 09:00-21:00 JST / ACTIVE", purpose: "会議の要約、判断、要対応を記録。"),
    .init(id: "registry_diffs", label: "D-5 OS台帳差分", tier: "L2", table: "project_registry_diffs", cadence: "review batch", purpose: "生データとOS台帳の差分候補。"),
    .init(id: "xrl_evidence", label: "M-2 XRL根拠", tier: "L2", table: "project_xrl_evidence", cadence: "month-end", purpose: "XRLの根拠候補。"),
    .init(id: "project_strategy_signals", label: "D-6 経営ハイライト", tier: "L2", table: "project_strategy_signals", cadence: "daily 03:20 JST / ACTIVE", purpose: "経営判断へ繋がるPJシグナル。"),
    .init(id: "textbook_insight_candidates", label: "D-7 Textbook Insights", tier: "L2", table: "textbook_insight_candidates", cadence: "TBD / manual", purpose: "既存OSデータからの再利用可能な示唆。"),
    .init(id: "atlas_signals", label: "D-8 Atlas外部シグナル", tier: "L2", table: "atlas_signals / atlas_stories", cadence: "daily 08:10 JST / ACTIVE", purpose: "外部環境の観測。"),
    .init(id: "macrotrend_index", label: "D-9 Macrotrend", tier: "L2", table: "macro_index_log", cadence: "月初04:00 JST", purpose: "マクロ観測のindex。"),
    .init(id: "member_activities", label: "D-10 メンバー活動根拠", tier: "L2", table: "member_activities", cadence: "daily 18:30 JST", purpose: "メンバー活動の根拠。"),
    .init(id: "media_mentions", label: "D-11 メディア掲載根拠", tier: "L2", table: "media_mentions", cadence: "未実装", purpose: "外部掲載の根拠。"),
    .init(id: "finance_freee_actuals", label: "D-12 Finance / freee実績", tier: "L1", table: "company_actual_monthly", cadence: "daily (non-LLM sync)", purpose: "会計実績。"),
    .init(id: "contract_signals", label: "D-13 契約予兆", tier: "L2", table: "contract_signals", cadence: "daily target", purpose: "契約に関するシグナル。"),
    .init(id: "action_items", label: "D-14 要対応", tier: "L2", table: "action_items", cadence: "daily target", purpose: "実行待ちの要対応。"),
    .init(id: "coverage_gaps", label: "L3-1 Coverage Scanner", tier: "L3", table: "coverage_gaps", cadence: "daily target", purpose: "情報の不在検知。"),
    .init(id: "vc_news_funding", label: "W-1 VCニュース・資金調達", tier: "L2", table: "vc_news / vcs", cadence: "土曜 09:00 JST / ACTIVE", purpose: "VCと資金調達の観測。"),
    .init(id: "management_monthly_signal", label: "M-3 月末の会社評価文", tier: "L2", table: "management_monthly_signals", cadence: "未実装", purpose: "会社評価の根拠。"),
    .init(id: "amd_score_inputs", label: "Score Inputs", tier: "L2", table: "amd_score_inputs", cadence: "停止中", purpose: "PJごとのM/X/F入力値と根拠。"),
]

private func amdosp1ManualOperation(_ id: String, _ label: String, layer: String = "PWA", cadence: String = "停止中", trigger: String = "disabled", params: String = "{\"disabled\":true}", reason: String = "停止中。Codex automation / 明示的な手動review batchへ移管済み。Run Nowで直接起動しない。") -> AMDOSP1CronOperation {
    AMDOSP1CronOperation(id: id, label: label, layer: layer, cadence: cadence, trigger: trigger, defaultParams: params, input: nil, output: nil, runType: "manual", manualReason: reason)
}

private func amdosp1PWAOperation(_ id: String, _ label: String, cadence: String, trigger: String, params: String = "{}") -> AMDOSP1CronOperation {
    AMDOSP1CronOperation(id: id, label: label, layer: "PWA", cadence: cadence, trigger: trigger, defaultParams: params, input: nil, output: nil, runType: "pwa", manualReason: nil)
}

private let amdosp1CronOperations: [AMDOSP1CronOperation] = [
    amdosp1ManualOperation("gas-meeting-hourly", "MTGサマリ hourly polling", layer: "GAS", cadence: "停止中 / 旧頻度: 毎時0分", trigger: "nav_meeting_pollRecentlyEndedEvents"),
    amdosp1ManualOperation("gas-monthly-fallback", "MTGサマリ daily fallback", layer: "GAS", cadence: "停止中 / 旧頻度: 03:00 daily", trigger: "nav_cronMonthlyExtractAt3"),
    amdosp1ManualOperation("gas-reward-v2-estimate", "Reward V2 progress estimate", layer: "GAS", cadence: "停止中 / 旧頻度: 03:30 daily", trigger: "cron_progressEstimateDaily_"),
    amdosp1ManualOperation("gas-reward-scoring-events", "進捗イベント差分抽出", layer: "GAS", cadence: "停止中 / 旧頻度: 04:00 daily", trigger: "reward_trigger_dailyExtract"),
    amdosp1ManualOperation("gas-l2-member-knowledge", "メンバーナレッジ抽出", layer: "GAS", cadence: "停止中 / 旧頻度: 毎時", trigger: "nav_member_knowledge_pollAll"),
    amdosp1ManualOperation("gas-l2-project-knowledge", "PJナレッジ抽出", layer: "GAS", cadence: "停止中 / 旧頻度: 毎時", trigger: "nav_project_knowledge_pollAll"),
    amdosp1ManualOperation("gas-l2-protocols", "AMDプロトコル抽出", layer: "GAS", cadence: "停止中 / 旧頻度: 毎時", trigger: "nav_protocol_pollAll"),
    amdosp1ManualOperation("pwa-hourly-estimate", "MS進捗 hourly estimate (旧PWA)", cadence: "停止中 / 旧頻度: 毎時0分 JST", trigger: "/api/cron/hourly-estimate"),
    amdosp1ManualOperation("pwa-lane-suggest", "ASPI lane suggest", cadence: "停止中 / 旧頻度: 週次", trigger: "/api/cron/lane-suggest"),
    amdosp1ManualOperation("pwa-kaken-ingest", "KAKEN ingest", cadence: "停止中 / 旧頻度: 週次", trigger: "/api/cron/kaken-ingest"),
    amdosp1ManualOperation("pwa-grant-ingest", "Grant ingest", cadence: "停止中 / 旧頻度: 週次", trigger: "/api/cron/grant-ingest"),
    amdosp1ManualOperation("pwa-vc-investment-ingest", "VC investment ingest", cadence: "停止中 / 旧頻度: 週次", trigger: "/api/cron/vc-investment-ingest"),
    amdosp1ManualOperation("pwa-atlas-daily", "Atlas daily report", trigger: "/api/cron/atlas-daily"),
    amdosp1ManualOperation("pwa-atlas-weekly", "Atlas weekly report", trigger: "/api/cron/atlas-weekly"),
    amdosp1ManualOperation("pwa-atlas-monthly", "Atlas monthly report", trigger: "/api/cron/atlas-monthly"),
    amdosp1ManualOperation("pwa-atlas-collect", "Atlas collect", trigger: "/api/cron/atlas-collect"),
    amdosp1ManualOperation("pwa-atlas-collect-policy", "Atlas policy collect", trigger: "/api/cron/atlas-collect-policy"),
    amdosp1ManualOperation("pwa-atlas-divergence", "Atlas divergence", trigger: "/api/cron/atlas-divergence"),
    amdosp1ManualOperation("pwa-member-activities", "PJメンバー活動抽出", trigger: "/api/cron/member-activities"),
    amdosp1ManualOperation("manual-monthly-reports-backfill", "Monthly reports backfill", cadence: "on-demand", trigger: "/api/cron/monthly-reports-backfill", params: "{\"query\":{\"limit\":6,\"concurrency\":5}}", reason: "Sonnetで月次報告書を生成する重いbackfill。対象月・件数を確認してCodex側で実行する。"),
    amdosp1ManualOperation("pwa-member-weekly-activities", "メンバー週次活動抽出", trigger: "/api/cron/member-weekly-activities"),
    amdosp1ManualOperation("pwa-venture-narrative-refresh", "Venture narrative refresh", trigger: "/api/cron/venture-narrative-refresh"),
    amdosp1ManualOperation("pwa-venture-xrl-refresh", "Venture XRL refresh", trigger: "/api/cron/venture-xrl-refresh"),
    amdosp1ManualOperation("pwa-relearn-lane-weights", "ASPI lane weights relearn", trigger: "/api/cron/relearn-lane-weights"),
    amdosp1ManualOperation("pwa-founding-members-extract", "関連メンバー抽出", trigger: "/api/cron/founding-members-extract"),
    amdosp1ManualOperation("codex-project-strategy-signals", "経営ハイライト L2レビュー", layer: "Codex", cadence: "日次 03:20 JST", trigger: "Codex automation amd-os", params: "(SKILL.md に従う)", reason: "Codex automationがoutboxを作り、LaunchAgentの非LLM applierが反映する。"),
    amdosp1ManualOperation("pwa-seeds-ingest", "Seeds ingest", trigger: "/api/cron/seeds-ingest"),
    amdosp1ManualOperation("pwa-vc-discover", "VC discover", trigger: "/api/cron/vc-discover"),
    amdosp1PWAOperation("pwa-papers-quarterly-ingest", "Papers quarterly ingest", cadence: "週次 火03:20 JST", trigger: "/api/cron/papers-quarterly-ingest"),
    amdosp1PWAOperation("pwa-sync-pj-facts", "PJ facts sync", cadence: "日次 04:00 JST", trigger: "/api/cron/sync-pj-facts"),
    amdosp1PWAOperation("pwa-macro-aggregate-indicators", "Macro aggregate indicators", cadence: "月次 2日04:00 JST", trigger: "/api/cron/macro-aggregate-indicators", params: "{\"query\":{\"since\":\"YYYY-MM\"}}"),
    amdosp1ManualOperation("pwa-macro-backfill-historical", "Macro historical backfill", trigger: "/api/cron/macro-backfill-historical"),
    amdosp1ManualOperation("manual-triple-helix-recompute", "Triple Helix recompute", cadence: "on-demand", trigger: "/api/cron/triple-helix-recompute", reason: "実行範囲と時間を見て手動で起動する。"),
    amdosp1ManualOperation("pwa-frl-grit-resilience", "FRL grit/resilience", trigger: "/api/cron/frl-grit-resilience-extract"),
    amdosp1ManualOperation("manual-freeze-period-backfill", "Freeze period backfill", cadence: "on-demand", trigger: "/api/cron/freeze-period-backfill", reason: "対象PJと再開月を確認してから手動で起動する。"),
    amdosp1ManualOperation("pwa-amd-score-l2", "AMD Score L2 refresh", trigger: "/api/cron/amd-score-l2-refresh"),
    amdosp1PWAOperation("pwa-freee-payment-sync", "freee入金同期", cadence: "日次 09:10 JST", trigger: "/api/cron/freee-payment-sync", params: "{\"query\":{\"ym\":\"YYYYMM\",\"dryRun\":0}}"),
    amdosp1PWAOperation("pwa-payment-confirm-nudges", "入金確認nudge", cadence: "日次 09:30 JST", trigger: "/api/cron/payment-confirm-nudges", params: "{\"query\":{\"ym\":\"YYYYMM\",\"dryRun\":0}}"),
    amdosp1PWAOperation("pwa-payout-reward-cache-refresh", "報酬キャッシュ再計算", cadence: "日次 03:05 JST", trigger: "/api/cron/payout-reward-cache-refresh", params: "{\"query\":{\"ym\":\"YYYYMM\"}}"),
    amdosp1PWAOperation("pwa-management-score-refresh", "Management Score / 月次試算表更新", cadence: "日次 06:00 JST", trigger: "/api/cron/management-score-refresh", params: "{\"query\":{\"ym\":\"YYYYMM\"}}"),
    amdosp1ManualOperation("manual-management-score-raw", "Management Score raw data", cadence: "manual", trigger: "/api/cron/management-score-raw-data", reason: "手動実行はCodex automation側で対象月を明示して行う。"),
    amdosp1ManualOperation("manual-management-score-calc", "Management Score calculate", cadence: "manual / after raw", trigger: "/api/cron/management-score-calculate", reason: "手動実行はCodex automation側でraw収集後に行う。"),
    amdosp1ManualOperation("codex-l1-monthly-report-extract", "M-1 月次報告抽出 (Codex automation)", layer: "Codex", cadence: "daily 05:30 JST", trigger: "AMD OS M-1 月次報告抽出", params: "(SKILL.md に従う)", reason: "Codex automationがoutboxを作り、LaunchAgentの非LLM applierが反映する。"),
    amdosp1ManualOperation("claude-l2-protocol-extract", "D-1 AMDプロトコル抽出 (MMO Codex)", layer: "Codex", cadence: "daily 08:00 JST", trigger: "amd-os-l2-protocol-extract"),
    amdosp1ManualOperation("claude-l3-ms-progress-extract", "D-2 MS進捗推定 (MMO Codex + non-LLM)", layer: "Codex", cadence: "毎時0分 JST", trigger: "amd-os-l3-ms-progress-extract"),
    amdosp1ManualOperation("claude-l4-project-knowledge-extract", "D-3 PJナレッジ抽出 (MMO Codex)", layer: "Codex", cadence: "daily 08:15 JST", trigger: "amd-os-l4-project-knowledge-extract"),
    amdosp1ManualOperation("claude-l5-member-knowledge-extract", "D-4 メンバーナレッジ抽出 (MMO Codex)", layer: "Codex", cadence: "daily 08:30 JST", trigger: "amd-os-l5-member-knowledge-extract"),
    amdosp1ManualOperation("claude-l6-meeting-extract", "H-1 MTGフロー (MMO / Mac Codex)", layer: "Codex", cadence: "毎時 09:00-21:00 JST", trigger: "amd-os-l6-meeting-flow-launcher"),
    amdosp1ManualOperation("claude-l7-registry-diff-extract", "D-5 OS台帳差分抽出 (Codex second wave)", layer: "Codex", cadence: "daily target / second wave", trigger: "amd-os-l7-registry-diff-extract"),
    amdosp1ManualOperation("claude-l8-xrl-evidence-extract", "M-2 XRL根拠抽出 (Codex second wave)", layer: "Codex", cadence: "month-end / second wave", trigger: "amd-os-l8-xrl-evidence-extract"),
    amdosp1ManualOperation("claude-l9-strategy-signal-extract", "D-6 経営ハイライト抽出 (Codex automation)", layer: "Codex", cadence: "daily 03:20 JST", trigger: "amd-os-l9-strategy-signal-extract"),
    amdosp1ManualOperation("claude-l10-textbook-insight-extract", "D-7 Textbook Insights 抽出 (local worker)", layer: "Codex", cadence: "TBD / manual start", trigger: "amd-os-l10-textbook-insight-extract"),
]

struct AMDOSP1SettingsView: View {
    @State private var settings: [AMDOSP1Setting] = []
    @State private var rawDataSources = amdosp1RuntimeSources
    @State private var l2Datasets = amdosp1RuntimeDatasets
    @State private var cronOperations = amdosp1CronOperations
    @State private var editing: AMDOSP1SettingDraft?
    @State private var deleteCandidate: AMDOSP1Setting?
    @State private var selectedOperationID = amdosp1CronOperations.first?.id ?? ""
    @State private var paramsByID = Dictionary(uniqueKeysWithValues: amdosp1CronOperations.map { ($0.id, $0.defaultParams) })
    @State private var operationResult: String?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var saving = false
    @State private var runningOperationID: String?

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "ADMIN / OPERATIONS SETTINGS",
            title: "運用設定",
            subtitle: "Raw / L2 / Cron Control とDB設定をPWA共有の管理境界で扱う"
        ) {
            HStack(spacing: 12) {
                AMDOSMetricTile(label: "Raw", value: "\(rawDataSources.count)", detail: "source")
                AMDOSMetricTile(label: "L2", value: "\(l2Datasets.count)", detail: "dataset", tint: AMDOSDesign.success)
                AMDOSMetricTile(label: "Cron", value: "\(cronOperations.count)", detail: "operation", tint: AMDOSDesign.warning)
            }
            operationsCatalog
            settingsPanel
        }
        .task { load() }
        .alert("設定を削除", isPresented: Binding(get: { deleteCandidate != nil }, set: { if !$0 { deleteCandidate = nil } })) {
            Button("キャンセル", role: .cancel) { deleteCandidate = nil }
            Button("削除", role: .destructive) {
                if let setting = deleteCandidate { delete(setting) }
                deleteCandidate = nil
            }
        } message: {
            Text("この操作はPWAと同じく設定レコードを削除するよ。")
        }
    }

    private var operationsCatalog: some View {
        AMDOSSectionCard("Operations Settings", systemImage: "slider.horizontal.3") {
            Text("PWAの運用カタログ。停止中の操作はここから起動せず、既存のCodex/レビュー導線を使う。")
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Raw Data").font(.headline)
                    ForEach(rawDataSources) { source in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack { Text(source.label).font(.caption.weight(.semibold)); Spacer(); AMDOSStatusBadge(text: source.id, tint: AMDOSDesign.muted) }
                            Text("\(source.owner) / \(source.refresh)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            Text(source.notes).font(.caption2).foregroundStyle(AMDOSDesign.muted).fixedSize(horizontal: false, vertical: true)
                            Text(source.landsIn.joined(separator: " / ")).font(.caption2.monospaced()).foregroundStyle(AMDOSDesign.muted).lineLimit(2)
                        }
                        .padding(8).background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 8))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 10) {
                    Text("L2 Data").font(.headline)
                    ForEach(l2Datasets) { dataset in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack { Text(dataset.label).font(.caption.weight(.semibold)); Spacer(); AMDOSStatusBadge(text: dataset.tier, tint: dataset.tier == "L3" ? .purple : dataset.tier == "L1" ? AMDOSDesign.warning : AMDOSDesign.success) }
                            Text(dataset.table).font(.caption2.monospaced()).foregroundStyle(AMDOSDesign.muted)
                            if let source = dataset.source, !source.isEmpty {
                                Text("Source  \(source)").font(.caption2).foregroundStyle(AMDOSDesign.muted).fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
                            }
                            Text("\(dataset.cadence) · \(dataset.purpose)").font(.caption2).foregroundStyle(AMDOSDesign.muted).fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(8).background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 8))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Divider()
            cronControl
        }
    }

    private var cronControl: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Cron Control").font(.headline)
            HStack(alignment: .top, spacing: 12) {
                List(cronOperations, selection: $selectedOperationID) { operation in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(operation.label).font(.caption.weight(.semibold))
                        Text("\(operation.layer) / \(operation.cadence)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    .tag(operation.id)
                }
                .frame(minWidth: 260, idealWidth: 320, maxWidth: 350, minHeight: 330)
                if let operation = selectedOperation {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(operation.label).font(.headline)
                        HStack { AMDOSStatusBadge(text: operation.layer); Text(operation.trigger).font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled) }
                        if let input = operation.input, !input.isEmpty { operationInfoLine("Input", input) }
                        if let output = operation.output, !output.isEmpty { operationInfoLine("Output", output) }
                        Text("Run Params").font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
                        TextEditor(text: paramsBinding(operation.id))
                            .font(.system(.caption, design: .monospaced))
                            .frame(minHeight: 120)
                            .overlay(RoundedRectangle(cornerRadius: 7).stroke(AMDOSDesign.border))
                        if let reason = operation.reason {
                            Text(reason).font(.caption).foregroundStyle(AMDOSDesign.warning).fixedSize(horizontal: false, vertical: true)
                        }
                        HStack {
                            Button("Default") { paramsByID[operation.id] = operation.defaultParams }.buttonStyle(.bordered)
                            Button("Format") { formatParams(operation) }.buttonStyle(.bordered)
                            Spacer()
                            Button(runningOperationID == operation.id ? "実行中…" : operation.isManual ? "Stopped" : "Run Now") {
                                run(operation)
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(operation.isManual || runningOperationID != nil)
                        }
                        if let result = operationResult {
                            Text(result).font(.system(.caption2, design: .monospaced)).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(9).background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 7))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private var settingsPanel: some View {
        AMDOSSectionCard("DB Settings", systemImage: "gearshape.2") {
            HStack {
                Text("\(settings.count) 件").font(.caption).foregroundStyle(AMDOSDesign.muted)
                Spacer()
                Button { editing = AMDOSP1SettingDraft(); message = nil } label: { Label("追加", systemImage: "plus") }.buttonStyle(.borderedProminent)
            }
            AMDOSStateNotice(state: state) { load() }
            AMDOSP1AdminMessage(text: message)
            if let editing { settingEditor(editing) }
            if settings.isEmpty, state == .loaded || state == .empty {
                Text("設定がないよ。追加から登録できる。") .foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(settings) { setting in
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(setting.key).font(.caption.monospaced().weight(.semibold))
                        Text(setting.label?.trimmedNonEmpty ?? "—").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    }.frame(width: 220, alignment: .leading)
                    Text(setting.value ?? "—").font(.caption).frame(maxWidth: .infinity, alignment: .leading).textSelection(.enabled)
                    VStack(alignment: .trailing, spacing: 5) {
                        AMDOSStatusBadge(text: setting.type ?? "string", tint: AMDOSDesign.muted)
                        Text(amdosp1CompactDate(setting.updatedAt)).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    Button { editing = AMDOSP1SettingDraft(setting: setting); message = nil } label: { Image(systemName: "pencil") }.buttonStyle(.bordered)
                    Button(role: .destructive) { deleteCandidate = setting } label: { Image(systemName: "trash") }.buttonStyle(.bordered)
                }
                if let description = setting.description, !description.isEmpty {
                    Text(description).font(.caption2).foregroundStyle(AMDOSDesign.muted).padding(.leading, 232)
                }
                if setting.id != settings.last?.id { Divider() }
            }
        }
    }

    @ViewBuilder private func settingEditor(_ draft: AMDOSP1SettingDraft) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(draft.isNew ? "設定を追加" : "設定を編集").font(.headline)
            HStack(alignment: .bottom, spacing: 12) {
                AMDOSTextField(title: "Key", text: settingBinding(\.key)).disabled(!draft.isNew)
                AMDOSTextField(title: "ラベル", text: settingBinding(\.label))
                Picker("型", selection: settingBinding(\.type)) {
                    Text("string").tag("string"); Text("number").tag("number"); Text("boolean").tag("boolean")
                }.frame(width: 130)
            }
            AMDOSTextField(title: "値", text: settingBinding(\.value), axis: .vertical)
            AMDOSTextField(title: "説明", text: settingBinding(\.description), axis: .vertical)
            HStack { Spacer(); Button("キャンセル") { editing = nil }.buttonStyle(.bordered); Button(saving ? "保存中…" : "保存") { saveSetting(draft) }.buttonStyle(.borderedProminent).disabled(saving || draft.key.trimmedNonEmpty == nil) }
        }
        .padding(12).background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 9))
    }

    private var selectedOperation: AMDOSP1CronOperation? { cronOperations.first(where: { $0.id == selectedOperationID }) }

    @ViewBuilder private func operationInfoLine(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label).font(.caption2.weight(.semibold)).foregroundStyle(AMDOSDesign.muted)
            Text(value).font(.caption2).fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
        }
        .padding(8)
        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 7))
    }

    private func paramsBinding(_ id: String) -> Binding<String> {
        Binding(get: { paramsByID[id] ?? "{}" }, set: { paramsByID[id] = $0 })
    }

    private func settingBinding(_ keyPath: WritableKeyPath<AMDOSP1SettingDraft, String>) -> Binding<String> {
        Binding(get: { editing?[keyPath: keyPath] ?? "" }, set: { editing?[keyPath: keyPath] = $0 })
    }

    private func load() {
        Task {
            state = .loading
            do {
                let envelope = try await AMDOSRESTClient.shared.fetchPWA(AMDOSP1SettingsEnvelope.self, path: "/api/admin/settings")
                guard envelope.ok != false else { throw AMDOSNetworkError.http(envelope.error ?? "設定を取得できなかった") }
                settings = envelope.settings ?? []
                if let catalog = envelope.catalog {
                    rawDataSources = catalog.rawDataSources
                    l2Datasets = catalog.l2Datasets
                    cronOperations = catalog.cronOperations
                    paramsByID = Dictionary(uniqueKeysWithValues: catalog.cronOperations.map { ($0.id, $0.defaultParams) })
                    if !catalog.cronOperations.contains(where: { $0.id == selectedOperationID }) {
                        selectedOperationID = catalog.cronOperations.first?.id ?? ""
                    }
                }
                state = settings.isEmpty ? .empty : .loaded
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    private func saveSetting(_ draft: AMDOSP1SettingDraft) {
        guard draft.key.trimmedNonEmpty != nil else { message = "Keyは必須だよ"; return }
        saving = true
        Task {
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/settings", method: draft.isNew ? "POST" : "PATCH", body: draft)
                let result = try JSONDecoder().decode(AMDOSP1SettingMutation.self, from: data)
                guard result.ok != false, let setting = result.setting else { throw AMDOSNetworkError.http(result.error ?? "設定を保存できなかった") }
                if draft.isNew { settings.append(setting); settings.sort { $0.key < $1.key } }
                else { settings = settings.map { $0.key == setting.key ? setting : $0 } }
                editing = nil
                message = "\(setting.key) を保存したよ"
            } catch {
                message = error.localizedDescription
            }
            saving = false
        }
    }

    private func delete(_ setting: AMDOSP1Setting) {
        Task {
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/settings?key=\(setting.key.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? setting.key)", method: "DELETE", body: AMDOSP1EmptyBody())
                let result = try JSONDecoder().decode(AMDOSP1SettingMutation.self, from: data)
                guard result.ok != false else { throw AMDOSNetworkError.http(result.error ?? "設定を削除できなかった") }
                settings.removeAll { $0.key == setting.key }
                message = "\(setting.key) を削除したよ"
            } catch {
                message = error.localizedDescription
            }
        }
    }

    private func formatParams(_ operation: AMDOSP1CronOperation) {
        let raw = paramsByID[operation.id] ?? "{}"
        guard let data = raw.data(using: .utf8) else { return }
        do {
            let object = try JSONSerialization.jsonObject(with: data)
            let formatted = try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
            paramsByID[operation.id] = String(decoding: formatted, as: UTF8.self)
            operationResult = nil
        } catch {
            operationResult = "JSONが壊れてる: \(error.localizedDescription)"
        }
    }

    private func run(_ operation: AMDOSP1CronOperation) {
        guard !operation.isManual else { return }
        let params = paramsByID[operation.id] ?? "{}"
        guard let data = params.data(using: .utf8), (try? JSONSerialization.jsonObject(with: data)) != nil else {
            operationResult = "JSONが壊れてる"
            return
        }
        runningOperationID = operation.id
        operationResult = nil
        Task {
            do {
                struct Request: Encodable, Sendable { let operationID: String; let paramsText: String; enum CodingKeys: String, CodingKey { case operationID = "operationId"; case paramsText } }
                let response = try await AMDOSRESTClient.shared.sendPWA(path: "/api/settings/cron-run", body: Request(operationID: operation.id, paramsText: params))
                operationResult = String(decoding: response, as: UTF8.self)
            } catch {
                operationResult = error.localizedDescription
            }
            runningOperationID = nil
        }
    }
}

private struct AMDOSP1TsukuyomiContext: Codable, Identifiable, Sendable {
    let id: String
    let contextID: String
    let tags: String?
    let priority: Int?
    let systemPrompt: String
    let status: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case contextID = "context_id"
        case tags, priority
        case systemPrompt = "system_prompt"
        case status
        case updatedAt = "updated_at"
    }
}

private struct AMDOSP1TsukuyomiContextEnvelope: Codable, Sendable {
    let ok: Bool?
    let contexts: [AMDOSP1TsukuyomiContext]?
    let error: String?
}

private struct AMDOSP1TsukuyomiContextMutation: Codable, Sendable {
    let ok: Bool?
    let context: AMDOSP1TsukuyomiContext?
    let error: String?
}

private struct AMDOSP1TsukuyomiContextDraft: Encodable, Sendable {
    var isNew: Bool
    var contextID: String
    var systemPrompt: String
    var contextType: String
    var priority: Int
    var tags: String
    var status: String

    init() {
        isNew = true; contextID = ""; systemPrompt = ""; contextType = "tone"; priority = 10; tags = "tsukuyomi"; status = "active"
    }

    init(context: AMDOSP1TsukuyomiContext) {
        isNew = false
        contextID = context.contextID
        systemPrompt = context.systemPrompt
        contextType = amdosp1ContextLayer(tags: context.tags)
        priority = context.priority ?? 0
        tags = context.tags ?? ""
        status = context.status ?? "active"
    }

    enum CodingKeys: String, CodingKey {
        case contextID = "contextId"
        case systemPrompt, contextType, priority, tags, status
    }
}

private struct AMDOSP1TsukuyomiLearning: Codable, Identifiable, Sendable {
    let id: String
    let scope: String?
    let scopeKey: String?
    let content: String
    let source: String?
    let sourceRef: String?
    let status: String?
    let createdAt: String?
    let createdBy: String?
    let removedReason: String?

    enum CodingKeys: String, CodingKey {
        case id, scope, content, source, status
        case scopeKey = "scope_key"
        case sourceRef = "source_ref"
        case createdAt = "created_at"
        case createdBy = "created_by"
        case removedReason = "removed_reason"
    }
}

private struct AMDOSP1TsukuyomiStatusLearning: Codable, Identifiable, Sendable {
    let id: String
    let scope: String?
    let targetProjectID: String?
    let lessonText: String
    let sourceFeedbackID: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, scope
        case targetProjectID = "target_project_id"
        case lessonText = "lesson_text"
        case sourceFeedbackID = "source_feedback_id"
        case createdAt = "created_at"
    }
}

private struct AMDOSP1TsukuyomiLearningDisplay: Identifiable {
    let id: String
    let scope: String
    let scopeKey: String?
    let content: String
    let source: String?
    let sourceRef: String?
    let status: String
    let createdAt: String?
    let createdBy: String?
    let removedReason: String?
}

struct AMDOSP1TsukuyomiView: View {
    @State private var contexts: [AMDOSP1TsukuyomiContext] = []
    @State private var learnings: [AMDOSP1TsukuyomiLearningDisplay] = []
    @State private var learningStatus = "active"
    @State private var learningQuery = ""
    @State private var contextStatus = "active"
    @State private var contextTag = ""
    @State private var editing: AMDOSP1TsukuyomiContextDraft?
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var contextState: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var saving = false

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "ADMIN / TSUKUYOMI",
            title: "Tsukuyomi",
            subtitle: "学習メモと人格Contextを確認・管理する"
        ) {
            AMDOSSectionCard("PJチャンネルへの発言", systemImage: "paperplane") {
                Text("PWAの投稿ブリッジは未実装のまま。Mac側も投稿操作を有効化しない。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            learningPanel
            contextPanel
        }
        .task { load() }
    }

    private var learningPanel: some View {
        AMDOSSectionCard("つくよみ学習状況", systemImage: "brain") {
            Text("修正依頼や確定内容から蓄積された学習メモ。") .font(.caption).foregroundStyle(AMDOSDesign.muted)
            HStack(alignment: .bottom, spacing: 12) {
                Picker("status", selection: $learningStatus) {
                    Text("all").tag(""); Text("active").tag("active"); Text("removed").tag("removed")
                }.frame(width: 130)
                AMDOSTextField(title: "検索", text: $learningQuery).frame(maxWidth: .infinity)
                Text("\(filteredLearnings.count) / \(learnings.count) 件").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            AMDOSStateNotice(state: state) { load() }
            if filteredLearnings.isEmpty, state == .loaded || state == .empty {
                Text("学習メモはまだないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(filteredLearnings.prefix(30)) { learning in
                VStack(alignment: .leading, spacing: 5) {
                    HStack {
                        AMDOSStatusBadge(text: learning.status, tint: learning.status == "active" ? AMDOSDesign.success : AMDOSDesign.muted)
                        AMDOSStatusBadge(text: learning.scope, tint: AMDOSDesign.muted)
                        if let key = learning.scopeKey { Text(key).font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                        if let source = learning.source { Text(source).font(.caption2).foregroundStyle(AMDOSDesign.blue) }
                        Spacer()
                        Text(amdosp1CompactDate(learning.createdAt)).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    }
                    Text(learning.content).font(.caption).fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
                    HStack(spacing: 8) {
                        if let by = learning.createdBy { Text("by \(by)").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                        if let reference = learning.sourceRef { Text("ref \(String(reference.prefix(8)))").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
                        if let removed = learning.removedReason { Text("removed: \(removed)").font(.caption2).foregroundStyle(AMDOSDesign.warning) }
                    }
                }
                .padding(8).background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private var contextPanel: some View {
        AMDOSSectionCard("人格DB", systemImage: "person.text.rectangle") {
            HStack(alignment: .bottom, spacing: 12) {
                Picker("status", selection: $contextStatus) {
                    Text("all").tag(""); Text("active").tag("active"); Text("archived").tag("archived")
                }.frame(width: 130)
                AMDOSTextField(title: "tagフィルタ", text: $contextTag).frame(width: 220)
                Button("一覧ロード") { loadContexts() }.buttonStyle(.bordered)
                Spacer()
                Button { editing = AMDOSP1TsukuyomiContextDraft(); message = nil } label: { Label("新規", systemImage: "plus") }.buttonStyle(.borderedProminent)
            }
            AMDOSStateNotice(state: contextState) { loadContexts() }
            AMDOSP1AdminMessage(text: message)
            if let editing { contextEditor(editing) }
            ForEach(amdosp1ContextLayers, id: \.self) { layer in
                let rows = contexts.filter { amdosp1ContextLayer(tags: $0.tags) == layer }
                DisclosureGroup("\(amdosp1ContextLayerLabel(layer)) (\(rows.count))", isExpanded: .constant(true)) {
                    if rows.isEmpty { Text("ここは空。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    ForEach(rows) { context in contextRow(context) }
                }
                .padding(8).background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    @ViewBuilder private func contextRow(_ context: AMDOSP1TsukuyomiContext) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    AMDOSStatusBadge(text: context.status ?? "active", tint: context.status == "active" ? AMDOSDesign.success : AMDOSDesign.muted)
                    Text("p=\(context.priority ?? 0)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                    Text(context.tags ?? "").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                }
                Text(context.contextID).font(.caption.weight(.semibold)).textSelection(.enabled)
                Text(context.systemPrompt).font(.system(.caption2, design: .monospaced)).foregroundStyle(AMDOSDesign.muted).lineLimit(3).textSelection(.enabled)
            }
            Spacer()
            VStack(spacing: 7) {
                Button { editing = AMDOSP1TsukuyomiContextDraft(context: context); message = nil } label: { Image(systemName: "pencil") }.buttonStyle(.bordered)
                Button(context.status == "active" ? "archive" : "active") { toggle(context) }.buttonStyle(.bordered)
            }
        }
        .padding(.vertical, 5)
    }

    @ViewBuilder private func contextEditor(_ draft: AMDOSP1TsukuyomiContextDraft) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(draft.isNew ? "新規Context" : "Contextを編集").font(.headline)
            HStack(alignment: .bottom, spacing: 12) {
                AMDOSTextField(title: "context_id", text: contextBinding(\.contextID)).disabled(!draft.isNew)
                Picker("layer", selection: contextBinding(\.contextType)) {
                    ForEach(amdosp1ContextLayers, id: \.self) { Text($0).tag($0) }
                }.frame(width: 130)
                VStack(alignment: .leading, spacing: 5) {
                    Text("priority").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    TextField("priority", value: contextIntBinding(\.priority), format: .number).textFieldStyle(.roundedBorder).frame(width: 100)
                }
                Picker("status", selection: contextBinding(\.status)) { Text("active").tag("active"); Text("archived").tag("archived") }.frame(width: 120)
            }
            AMDOSTextField(title: "tags", text: contextBinding(\.tags))
            AMDOSTextField(title: "systemPrompt", text: contextBinding(\.systemPrompt), axis: .vertical)
            HStack { Spacer(); Button("キャンセル") { editing = nil }.buttonStyle(.bordered); Button(saving ? "保存中…" : "保存") { saveContext(draft) }.buttonStyle(.borderedProminent).disabled(saving || draft.contextID.trimmedNonEmpty == nil || draft.systemPrompt.trimmedNonEmpty == nil) }
        }
        .padding(12).background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 9))
    }

    private var filteredLearnings: [AMDOSP1TsukuyomiLearningDisplay] {
        let needle = learningQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return learnings.filter { item in
            if !learningStatus.isEmpty, item.status != learningStatus { return false }
            guard !needle.isEmpty else { return true }
            return [item.scope, item.scopeKey, item.content, item.source].compactMap { $0 }.joined(separator: " ").lowercased().contains(needle)
        }
    }

    private func contextBinding(_ keyPath: WritableKeyPath<AMDOSP1TsukuyomiContextDraft, String>) -> Binding<String> {
        Binding(get: { editing?[keyPath: keyPath] ?? "" }, set: { editing?[keyPath: keyPath] = $0 })
    }

    private func contextIntBinding(_ keyPath: WritableKeyPath<AMDOSP1TsukuyomiContextDraft, Int>) -> Binding<Int> {
        Binding(get: { editing?[keyPath: keyPath] ?? 0 }, set: { editing?[keyPath: keyPath] = $0 })
    }

    private func load() {
        Task {
            state = .loading
            do {
                async let regular = AMDOSRESTClient.shared.fetchTable(AMDOSP1TsukuyomiLearning.self, table: "tsukuyomi_learnings", select: "id,scope,scope_key,content,source,source_ref,status,created_at,created_by,removed_reason", order: "created_at.desc", limit: 200)
                async let status = AMDOSRESTClient.shared.fetchTable(AMDOSP1TsukuyomiStatusLearning.self, table: "tsukuyomi_learnings_status", select: "id,scope,target_project_id,lesson_text,source_feedback_id,created_at", order: "created_at.desc", limit: 200)
                let (regularRows, statusRows) = try await (regular, status)
                learnings = regularRows.map {
                    AMDOSP1TsukuyomiLearningDisplay(id: $0.id, scope: $0.scope ?? "memory", scopeKey: $0.scopeKey, content: $0.content, source: $0.source, sourceRef: $0.sourceRef, status: $0.status ?? "active", createdAt: $0.createdAt, createdBy: $0.createdBy, removedReason: $0.removedReason)
                } + statusRows.map {
                    AMDOSP1TsukuyomiLearningDisplay(id: "status-\($0.id)", scope: "memory", scopeKey: $0.targetProjectID ?? "all", content: $0.lessonText, source: "pj_status:\($0.scope ?? "all")", sourceRef: $0.sourceFeedbackID, status: "active", createdAt: $0.createdAt, createdBy: "tsukuyomi", removedReason: nil)
                }
                learnings.sort { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
                state = learnings.isEmpty ? .empty : .loaded
                loadContexts()
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    private func loadContexts() {
        Task {
            contextState = .loading
            do {
                var query: [String: String] = [:]
                if !contextStatus.isEmpty { query["status"] = contextStatus }
                if let tag = contextTag.trimmedNonEmpty { query["tag"] = tag }
                let envelope = try await AMDOSRESTClient.shared.fetchPWA(AMDOSP1TsukuyomiContextEnvelope.self, path: "/api/admin/tsukuyomi/context", query: query)
                guard envelope.ok != false else { throw AMDOSNetworkError.http(envelope.error ?? "Contextを取得できなかった") }
                contexts = envelope.contexts ?? []
                contextState = contexts.isEmpty ? .empty : .loaded
            } catch {
                contextState = .failed(error.localizedDescription)
            }
        }
    }

    private func saveContext(_ draft: AMDOSP1TsukuyomiContextDraft) {
        guard draft.contextID.trimmedNonEmpty != nil, draft.systemPrompt.trimmedNonEmpty != nil else { message = "context_id と systemPrompt は必須だよ"; return }
        saving = true
        Task {
            do {
                let response = try await AMDOSRESTClient.shared.sendPWA(path: "/api/admin/tsukuyomi/context", method: draft.isNew ? "POST" : "PATCH", body: draft)
                let result = try JSONDecoder().decode(AMDOSP1TsukuyomiContextMutation.self, from: response)
                guard result.ok != false, let context = result.context else { throw AMDOSNetworkError.http(result.error ?? "Contextを保存できなかった") }
                if draft.isNew { contexts.insert(context, at: 0) }
                else { contexts = contexts.map { $0.contextID == context.contextID ? context : $0 } }
                contexts.sort { ($0.priority ?? 0) > ($1.priority ?? 0) }
                editing = nil
                message = "\(context.contextID) を保存したよ"
            } catch {
                message = error.localizedDescription
            }
            saving = false
        }
    }

    private func toggle(_ context: AMDOSP1TsukuyomiContext) {
        var draft = AMDOSP1TsukuyomiContextDraft(context: context)
        draft.status = context.status == "active" ? "archived" : "active"
        saveContext(draft)
    }
}

private let amdosp1ContextLayers = ["judge", "role", "memory", "tone", "safety"]

private func amdosp1ContextLayer(tags: String?) -> String {
    let values = (tags ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
    return amdosp1ContextLayers.first(where: { values.contains($0) }) ?? "tone"
}

private func amdosp1ContextLayerLabel(_ layer: String) -> String {
    switch layer {
    case "judge": return "判断"
    case "role": return "役割"
    case "memory": return "記憶"
    case "tone": return "口調"
    case "safety": return "安全"
    default: return layer
    }
}
