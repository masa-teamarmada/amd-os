import Foundation
import SwiftUI

private struct AMDOSP1ScheduleMember: Codable, Identifiable, Sendable {
    let memberID: String
    let codeName: String?
    let memberName: String?

    var id: String { memberID }
    var label: String { memberName?.trimmedNonEmpty ?? codeName?.trimmedNonEmpty ?? memberID }

    enum CodingKeys: String, CodingKey {
        case memberID = "member_id"
        case codeName = "code_name"
        case memberName = "member_name"
    }
}

private struct AMDOSP1ScheduleProject: Codable, Identifiable, Sendable {
    let projectID: String
    let projectName: String

    var id: String { projectID }

    enum CodingKeys: String, CodingKey {
        case projectID = "project_id"
        case projectName = "project_name"
    }
}

private struct AMDOSP1ScheduleLatestAction: Codable, Sendable {
    let action: String
    let reason: String?
    let evidenceRef: String?

    enum CodingKeys: String, CodingKey {
        case action, reason
        case evidenceRef = "evidence_ref"
    }
}

private struct AMDOSP1ScheduleOccurrence: Codable, Identifiable, Sendable {
    let occurrenceID: String
    let category: String?
    let eventKind: String?
    let title: String
    let dueOn: String?
    let dueYM: String?
    let periodKey: String?
    let datePrecision: String?
    let dateKind: String?
    let amountYen: Double?
    let amountStatus: String?
    let amountRole: String?
    let projectID: String?
    let ownerMemberID: String?
    let ownerLabel: String?
    let projectLabel: String?
    let sourceKind: String?
    let sourceID: String?
    let ruleVersion: String?
    let missingReason: String?
    let notificationOwner: String?
    let latestAction: AMDOSP1ScheduleLatestAction?
    let freshnessState: String?
    let computedStatus: String?

    var id: String { occurrenceID }

    enum CodingKeys: String, CodingKey {
        case occurrenceID = "occurrence_id"
        case category
        case eventKind = "event_kind"
        case title
        case dueOn = "due_on"
        case dueYM = "due_ym"
        case periodKey = "period_key"
        case datePrecision = "date_precision"
        case dateKind = "date_kind"
        case amountYen = "amount_yen"
        case amountStatus = "amount_status"
        case amountRole = "amount_role"
        case projectID = "project_id"
        case ownerMemberID = "owner_member_id"
        case ownerLabel = "owner_label"
        case projectLabel = "project_label"
        case sourceKind = "source_kind"
        case sourceID = "source_id"
        case ruleVersion = "rule_version"
        case missingReason = "missing_reason"
        case notificationOwner = "notification_owner"
        case latestAction = "latest_action"
        case freshnessState = "freshness_state"
        case computedStatus = "computed_status"
    }
}

private struct AMDOSP1ScheduleMeta: Codable, Sendable {
    let generatedCount: Int?
    let needsSourceCount: Int?
    let staleRuleCount: Int?
    let staleOccurrenceCount: Int?
    let lastGeneratedAt: String?
    let schemaReady: Bool?
    let errors: [String]?
}

private struct AMDOSP1ScheduleData: Codable, Sendable {
    let from: String?
    let to: String?
    let occurrences: [AMDOSP1ScheduleOccurrence]?
    let members: [AMDOSP1ScheduleMember]?
    let projects: [AMDOSP1ScheduleProject]?
    let meta: AMDOSP1ScheduleMeta?
}

private struct AMDOSP1ScheduleRebuild: Encodable, Sendable {
    let reason: String
    let from: String?
    let to: String?
}

private struct AMDOSP1ScheduleActionPayload: Encodable, Sendable {
    let occurrenceID: String
    let action: String
    let evidenceRef: String?
    let reason: String?

    enum CodingKeys: String, CodingKey {
        case occurrenceID = "occurrenceId"
        case action, evidenceRef, reason
    }
}

private enum AMDOSP1ScheduleMode: String, CaseIterable, Identifiable {
    case operations
    case calendar

    var id: String { rawValue }
    var label: String { self == .operations ? "年間運営" : "日付カレンダー" }
}

private let amdosp1ScheduleCategories: [String: String] = [
    "tax": "税務", "labor": "労務", "contract": "契約", "report": "報告",
    "invoice": "請求", "receipt": "入金", "payment": "支払", "governance": "経営",
]

private let amdosp1ScheduleStatuses: [String: String] = [
    "overdue": "期限超過", "due_today": "今日", "due_soon": "近い期限",
    "open": "未完了", "completed": "完了", "cancelled": "取消", "needs_source": "根拠不足",
]

struct AMDOSP1ScheduleView: View {
    @State private var data: AMDOSP1ScheduleData?
    @State private var from = amdosp1ScheduleDefaultRange().from
    @State private var to = amdosp1ScheduleDefaultRange().to
    @State private var selectedYear = amdosp1ScheduleCurrentYear()
    @State private var displayedMonth = amdosp1ScheduleCurrentMonth()
    @State private var mode: AMDOSP1ScheduleMode = .operations
    @State private var categoryFilter = ""
    @State private var projectFilter = ""
    @State private var ownerFilter = ""
    @State private var statusFilter = ""
    @State private var rebuildReason = ""
    @State private var selected: AMDOSP1ScheduleOccurrence?
    @State private var actionReason = ""
    @State private var evidenceRef = ""
    @State private var state: AMDOSFeatureLoadState = .idle
    @State private var message: String?
    @State private var rebuilding = false
    @State private var acting = false

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "ADMIN / OPERATIONS",
            title: "運営カレンダー",
            subtitle: "正本から生成した期限を確認し、日付・金額・担当者はここで直接変更しない"
        ) {
            rebuildPanel
            AMDOSStateNotice(state: state) { load() }
            AMDOSP1AdminMessage(text: message)
            if let errors = data?.meta?.errors, !errors.isEmpty {
                AMDOSSectionCard("読み込み状態", systemImage: "exclamationmark.triangle") {
                    Text("正本テーブルの読み込みに失敗している項目があるよ。生成元を確認してから再生成して。")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.warning)
                    ForEach(errors, id: \.self) { Text($0).font(.caption2).textSelection(.enabled) }
                }
            }
            if let data {
                metrics(data)
                filterPanel(data)
                Picker("表示", selection: $mode) {
                    ForEach(AMDOSP1ScheduleMode.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                if mode == .operations { annualView(data) } else { calendarView(data) }
                supplementalView(data)
            }
        }
        .task { load() }
        .sheet(item: $selected) { row in detailSheet(row) }
    }

    private var rebuildPanel: some View {
        AMDOSSectionCard("正本から再生成", systemImage: "arrow.clockwise") {
            HStack(alignment: .bottom, spacing: 12) {
                AMDOSTextField(title: "再生成理由 *", text: $rebuildReason)
                    .frame(maxWidth: .infinity)
                AMDOSTextField(title: "From", text: $from).frame(width: 128)
                AMDOSTextField(title: "To", text: $to).frame(width: 128)
                Button(rebuilding ? "再生成中…" : "再生成") { rebuild() }
                    .buttonStyle(.borderedProminent)
                    .disabled(rebuilding || rebuildReason.trimmedNonEmpty == nil || !amdosp1IsISODate(from) || !amdosp1IsISODate(to))
            }
            Text("日付・金額・担当者の手入力はできない。元の契約・債務・報告書・action itemを直してから再生成する。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
        }
    }

    @ViewBuilder private func metrics(_ data: AMDOSP1ScheduleData) -> some View {
        HStack(spacing: 12) {
            AMDOSMetricTile(label: "生成済み", value: "\(data.meta?.generatedCount ?? 0)", detail: "この期間の生成件数")
            AMDOSMetricTile(label: "根拠不足", value: "\(data.meta?.needsSourceCount ?? 0)", detail: "確認が必要", tint: AMDOSDesign.warning)
            AMDOSMetricTile(label: "鮮度・ルール", value: "\((data.meta?.staleOccurrenceCount ?? 0) + (data.meta?.staleRuleCount ?? 0))", detail: "再確認", tint: AMDOSDesign.warning)
            AMDOSMetricTile(label: "表示件数", value: "\(filteredOccurrences.count)", detail: "絞り込み後")
        }
    }

    @ViewBuilder private func filterPanel(_ data: AMDOSP1ScheduleData) -> some View {
        AMDOSSectionCard("絞り込み", systemImage: "line.3.horizontal.decrease.circle") {
            HStack(alignment: .bottom, spacing: 10) {
                Picker("カテゴリ", selection: $categoryFilter) {
                    Text("すべて").tag("")
                    ForEach(categoryOptions, id: \.self) { option in Text(amdosp1ScheduleCategories[option] ?? option).tag(option) }
                }
                Picker("プロジェクト", selection: $projectFilter) {
                    Text("すべて").tag("")
                    ForEach(data.projects ?? []) { project in Text(project.projectName).tag(project.projectID) }
                }
                Picker("担当", selection: $ownerFilter) {
                    Text("すべて").tag("")
                    ForEach(data.members ?? []) { member in Text(member.label).tag(member.memberID) }
                }
                Picker("状態", selection: $statusFilter) {
                    Text("すべて").tag("")
                    ForEach(statusOptions, id: \.self) { option in Text(amdosp1ScheduleStatuses[option] ?? option).tag(option) }
                }
                Spacer()
                Button("リセット") {
                    categoryFilter = ""; projectFilter = ""; ownerFilter = ""; statusFilter = ""
                }
                .buttonStyle(.bordered)
            }
        }
    }

    @ViewBuilder private func annualView(_ data: AMDOSP1ScheduleData) -> some View {
        let years = scheduleYears(data)
        AMDOSSectionCard("年間運営", systemImage: "calendar.badge.clock") {
            HStack {
                Picker("対象年", selection: $selectedYear) {
                    ForEach(years, id: \.self) { Text("\($0)年").tag($0) }
                }
                .frame(width: 130)
                Spacer()
                Text("納付を先に確認し、提出・契約は補助レーンで追う。")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
            }
            let months = Array(1...12)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 14)], spacing: 14) {
                ForEach(months, id: \.self) { month in
                    monthCard(year: selectedYear, month: month)
                }
            }
        }
    }

    @ViewBuilder private func monthCard(year: Int, month: Int) -> some View {
        let rows = filteredOccurrences.filter { amdosp1OccurrenceMonth($0) == String(format: "%04d%02d", year, month) }
        AMDOSCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("\(month)月").font(.headline)
                    Spacer()
                    Text("\(rows.count)件").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                if rows.isEmpty {
                    Text("該当なし").font(.caption).foregroundStyle(AMDOSDesign.muted)
                } else {
                    ForEach(rows) { row in scheduleRow(row, compact: true) }
                }
            }
        }
    }

    @ViewBuilder private func calendarView(_ data: AMDOSP1ScheduleData) -> some View {
        AMDOSSectionCard("日付カレンダー", systemImage: "calendar") {
            HStack {
                Button { shiftMonth(-1) } label: { Image(systemName: "chevron.left") }.buttonStyle(.bordered)
                Spacer()
                Text(amdosp1MonthTitle(displayedMonth)).font(.headline)
                Spacer()
                Button { displayedMonth = amdosp1ScheduleCurrentMonth() } label: { Text("今日") }.buttonStyle(.bordered)
                Button { shiftMonth(1) } label: { Image(systemName: "chevron.right") }.buttonStyle(.bordered)
            }
            HStack(spacing: 0) {
                ForEach(["月", "火", "水", "木", "金", "土", "日"], id: \.self) { weekday in
                    Text(weekday).font(.caption.weight(.semibold)).frame(maxWidth: .infinity)
                }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 1), count: 7), spacing: 1) {
                ForEach(Array(monthCells.enumerated()), id: \.offset) { _, day in
                    calendarCell(day)
                }
            }
            Text("月内・日付未確定の予定も年間運営で確認できる。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
        }
    }

    @ViewBuilder private func calendarCell(_ date: Date?) -> some View {
        let key = date.map(amdosp1ISODate)
        let rows = key.map { day in filteredOccurrences.filter { $0.dueOn == day } } ?? []
        VStack(alignment: .leading, spacing: 3) {
            Text(date.map { String(amdosp1Calendar().component(.day, from: $0)) } ?? "")
                .font(.caption.weight(.semibold))
                .foregroundStyle(date == nil ? AMDOSDesign.border : AMDOSDesign.muted)
            ForEach(rows.prefix(3)) { row in
                Button { select(row) } label: {
                    Text(row.title)
                        .font(.caption2)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .padding(4)
                .background(amdosp1StatusColor(row.computedStatus).opacity(0.12), in: RoundedRectangle(cornerRadius: 5))
            }
            if rows.count > 3 { Text("ほか\(rows.count - 3)件").font(.caption2).foregroundStyle(AMDOSDesign.muted) }
            Spacer(minLength: 1)
        }
        .frame(minHeight: 92, maxHeight: 122, alignment: .topLeading)
        .padding(6)
        .background(AMDOSDesign.panel.opacity(date == nil ? 0.35 : 1), in: RoundedRectangle(cornerRadius: 6))
    }

    @ViewBuilder private func supplementalView(_ data: AMDOSP1ScheduleData) -> some View {
        let nearest = filteredOccurrences.filter { ["completed", "cancelled"].contains($0.computedStatus ?? "") == false }.prefix(8)
        let unknown = filteredOccurrences.filter { ($0.computedStatus == "needs_source") && $0.dueOn == nil && $0.dueYM == nil && $0.periodKey == nil }
        HStack(alignment: .top, spacing: 14) {
            AMDOSSectionCard("次に見る", systemImage: "arrow.right.circle") {
                if nearest.isEmpty { Text("確認対象はないよ。").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                ForEach(Array(nearest)) { row in scheduleRow(row, compact: false) }
            }
            AMDOSSectionCard("日付を生成できない締切", systemImage: "questionmark.diamond") {
                if unknown.isEmpty { Text("該当なし").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                ForEach(unknown) { row in scheduleRow(row, compact: false) }
            }
        }
    }

    @ViewBuilder private func scheduleRow(_ row: AMDOSP1ScheduleOccurrence, compact: Bool) -> some View {
        Button { select(row) } label: {
            HStack(alignment: .top, spacing: 8) {
                Circle().fill(amdosp1StatusColor(row.computedStatus)).frame(width: 8, height: 8).padding(.top, 4)
                VStack(alignment: .leading, spacing: 3) {
                    Text(row.title).font(compact ? .caption.weight(.semibold) : .subheadline.weight(.semibold)).lineLimit(compact ? 2 : 3)
                    Text("\(amdosp1ScheduleDateLabel(row)) · \(amdosp1ScheduleCategories[row.category ?? ""] ?? row.category ?? "—")")
                        .font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(1)
                    if !compact, let project = row.projectLabel { Text(project).font(.caption2).foregroundStyle(AMDOSDesign.muted).lineLimit(1) }
                }
                Spacer(minLength: 3)
                AMDOSStatusBadge(text: amdosp1ScheduleStateLabel(row), tint: amdosp1StatusColor(row.computedStatus))
            }
            .padding(.vertical, compact ? 2 : 4)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder private func detailSheet(_ row: AMDOSP1ScheduleOccurrence) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    AMDOSSectionCard(row.title, systemImage: "calendar.badge.exclamationmark") {
                        HStack {
                            AMDOSStatusBadge(text: amdosp1ScheduleStateLabel(row), tint: amdosp1StatusColor(row.computedStatus))
                            Spacer()
                            AMDOSStatusBadge(text: row.category.flatMap { amdosp1ScheduleCategories[$0] } ?? row.category ?? "—")
                        }
                        scheduleDetailLine("期限", amdosp1ScheduleFullDateLabel(row))
                        scheduleDetailLine("金額", amdosp1ScheduleAmountLabel(row))
                        scheduleDetailLine("担当", row.ownerLabel ?? "担当未確定")
                        scheduleDetailLine("プロジェクト", row.projectLabel ?? "会社全体")
                        scheduleDetailLine("生成状態", [amdosp1ScheduleStateLabel(row), row.sourceKind, row.ruleVersion].compactMap { $0 }.joined(separator: " / "))
                        if let reason = row.missingReason, !reason.isEmpty {
                            Text("根拠が足りない理由  \(reason)").font(.caption).foregroundStyle(AMDOSDesign.warning).textSelection(.enabled)
                        }
                        if let source = row.sourceKind {
                            Text("正本 / 根拠  \(source)\(row.sourceID.map { ":\($0)" } ?? "")")
                                .font(.caption).foregroundStyle(AMDOSDesign.muted).textSelection(.enabled)
                        }
                    }
                    if row.notificationOwner == "payment_obligation" {
                        AMDOSSectionCard("行動履歴", systemImage: "lock") {
                            Text("支払義務の完了は既存の支払正本で更新する。ここから行動履歴は追加できない。")
                                .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        }
                    } else {
                        AMDOSSectionCard("行動履歴を追加", systemImage: "checklist") {
                            Text("日付・金額・担当者の変更ではなく、確認・完了の履歴だけを追記する。")
                                .font(.caption).foregroundStyle(AMDOSDesign.muted)
                            AMDOSTextField(title: "理由", text: $actionReason, axis: .vertical)
                            AMDOSTextField(title: "根拠リンク / 参照先", text: $evidenceRef)
                            HStack {
                                Button(acting ? "記録中…" : "完了にする") { recordAction(row, "completed") }
                                    .buttonStyle(.borderedProminent).disabled(acting || !hasActionEvidence)
                                Button("対象外") { recordAction(row, "not_applicable") }
                                    .buttonStyle(.bordered).disabled(acting || !hasActionEvidence)
                                if row.latestAction != nil {
                                    Button("完了を取り消す") { recordAction(row, "reopened") }
                                        .buttonStyle(.bordered).disabled(acting)
                                }
                            }
                        }
                    }
                }
                .padding(22)
            }
            .navigationTitle("予定の詳細")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { selected = nil } } }
        }
        .onAppear { actionReason = ""; evidenceRef = "" }
    }

    private var filteredOccurrences: [AMDOSP1ScheduleOccurrence] {
        (data?.occurrences ?? []).filter { row in
            if !categoryFilter.isEmpty, row.category != categoryFilter { return false }
            if !projectFilter.isEmpty, row.projectID != projectFilter { return false }
            if !ownerFilter.isEmpty, row.ownerMemberID != ownerFilter { return false }
            if !statusFilter.isEmpty, row.computedStatus != statusFilter { return false }
            return true
        }
    }

    private var categoryOptions: [String] {
        Array(Set((data?.occurrences ?? []).compactMap(\.category))).sorted()
    }

    private var statusOptions: [String] {
        Array(Set((data?.occurrences ?? []).compactMap(\.computedStatus))).sorted()
    }

    private var hasActionEvidence: Bool { actionReason.trimmedNonEmpty != nil || evidenceRef.trimmedNonEmpty != nil }

    private var monthCells: [Date?] {
        let calendar = amdosp1Calendar()
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: displayedMonth)) ?? displayedMonth
        let firstWeekday = (calendar.component(.weekday, from: monthStart) + 5) % 7
        let days = calendar.range(of: .day, in: .month, for: monthStart)?.count ?? 0
        let leading = Array(repeating: Optional<Date>.none, count: firstWeekday)
        let dates = (0..<days).compactMap { calendar.date(byAdding: .day, value: $0, to: monthStart) }.map(Optional.some)
        let result = leading + dates
        let trailing = (7 - result.count % 7) % 7
        return result + Array(repeating: Optional<Date>.none, count: trailing)
    }

    private func scheduleYears(_ data: AMDOSP1ScheduleData) -> [Int] {
        let values = [data.from, data.to].compactMap { value -> Int? in
            guard let value, value.count >= 4 else { return nil }
            return Int(value.prefix(4))
        }
        let fallback = amdosp1ScheduleCurrentYear()
        let first = values.min() ?? fallback
        let last = values.max() ?? fallback
        return Array(first...max(first, last))
    }

    private func select(_ row: AMDOSP1ScheduleOccurrence) {
        actionReason = ""
        evidenceRef = ""
        selected = row
    }

    private func shiftMonth(_ value: Int) {
        displayedMonth = amdosp1Calendar().date(byAdding: .month, value: value, to: displayedMonth) ?? displayedMonth
    }

    private func load() {
        Task {
            state = .loading
            do {
                let loaded = try await AMDOSRESTClient.shared.fetchPWA(
                    AMDOSP1ScheduleData.self,
                    path: "/api/admin/schedule",
                    query: ["from": from, "to": to]
                )
                data = loaded
                if let firstYear = scheduleYears(loaded).first, !scheduleYears(loaded).contains(selectedYear) {
                    selectedYear = firstYear
                }
                state = (loaded.occurrences ?? []).isEmpty ? .empty : .loaded
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    private func rebuild() {
        guard let reason = rebuildReason.trimmedNonEmpty else { return }
        rebuilding = true
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/schedule/rebuild",
                    body: AMDOSP1ScheduleRebuild(reason: reason, from: from, to: to)
                )
                rebuildReason = ""
                message = "元正本から再生成したよ"
                load()
            } catch {
                message = error.localizedDescription
            }
            rebuilding = false
        }
    }

    private func recordAction(_ row: AMDOSP1ScheduleOccurrence, _ action: String) {
        guard action == "reopened" || hasActionEvidence else { return }
        acting = true
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/schedule/actions",
                    body: AMDOSP1ScheduleActionPayload(
                        occurrenceID: row.occurrenceID,
                        action: action,
                        evidenceRef: evidenceRef.trimmedNonEmpty,
                        reason: actionReason.trimmedNonEmpty
                    )
                )
                selected = nil
                message = "行動履歴を追加したよ"
                load()
            } catch {
                message = error.localizedDescription
            }
            acting = false
        }
    }

    @ViewBuilder private func scheduleDetailLine(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).font(.caption).foregroundStyle(AMDOSDesign.muted).frame(width: 76, alignment: .leading)
            Text(value).font(.caption).textSelection(.enabled)
            Spacer()
        }
    }
}

private func amdosp1ScheduleDefaultRange() -> (from: String, to: String) {
    let year = amdosp1ScheduleCurrentYear()
    return ("\(year - 1)-01-01", "\(year + 2)-12-31")
}

private func amdosp1ScheduleCurrentYear() -> Int { amdosp1Calendar().component(.year, from: Date()) }

private func amdosp1ScheduleCurrentMonth() -> Date {
    let calendar = amdosp1Calendar()
    return calendar.date(from: calendar.dateComponents([.year, .month], from: Date())) ?? Date()
}

private func amdosp1Calendar() -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Tokyo") ?? .current
    calendar.firstWeekday = 2
    return calendar
}

private func amdosp1ISODate(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.calendar = amdosp1Calendar()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(identifier: "Asia/Tokyo")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}

private func amdosp1IsISODate(_ value: String) -> Bool {
    value.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil
}

private func amdosp1MonthTitle(_ date: Date) -> String {
    let calendar = amdosp1Calendar()
    return "\(calendar.component(.year, from: date))年\(calendar.component(.month, from: date))月"
}

private func amdosp1OccurrenceMonth(_ row: AMDOSP1ScheduleOccurrence) -> String? {
    if let dueOn = row.dueOn, dueOn.count >= 7 { return String(dueOn.prefix(7)).replacingOccurrences(of: "-", with: "") }
    if let dueYM = row.dueYM { return dueYM }
    return row.periodKey?.prefix(6).description
}

private func amdosp1ScheduleDateLabel(_ row: AMDOSP1ScheduleOccurrence) -> String {
    if let due = row.dueOn, due.count >= 10 { return due }
    if let ym = row.dueYM, ym.count == 6 { return "\(ym.prefix(4))年\(Int(ym.suffix(2)) ?? 0)月（日付未確定）" }
    if let period = row.periodKey { return "\(period)（日付未確定）" }
    return "期限未確定"
}

private func amdosp1ScheduleFullDateLabel(_ row: AMDOSP1ScheduleOccurrence) -> String {
    "\(amdosp1ScheduleDateLabel(row))\(row.dateKind.map { " / \($0)" } ?? "")"
}

private func amdosp1ScheduleAmountLabel(_ row: AMDOSP1ScheduleOccurrence) -> String {
    if row.amountStatus == "not_applicable" { return "金額なし" }
    guard let amount = row.amountYen, row.amountStatus != "unknown" else { return "金額未確定" }
    let formatted = Int(amount.rounded()).formatted(.number.locale(Locale(identifier: "ja_JP")))
    let prefix = row.amountStatus == "estimated" ? "概算 " : ""
    let role: String
    switch row.amountRole {
    case "outgoing": role = "支出"
    case "incoming": role = "入金"
    case "contract_reference": role = "契約参照額"
    default: role = "情報"
    }
    return "\(prefix)¥\(formatted) / \(role)"
}

private func amdosp1ScheduleStateLabel(_ row: AMDOSP1ScheduleOccurrence) -> String {
    if row.missingReason?.isEmpty == false || row.computedStatus == "needs_source" { return "根拠不足" }
    switch row.freshnessState {
    case "source_stale": return "正本の鮮度要確認"
    case "generation_stale": return "再生成待ち"
    case "rule_stale": return "ルール再確認"
    default: return amdosp1ScheduleStatuses[row.computedStatus ?? ""] ?? row.computedStatus ?? "未確認"
    }
}

private func amdosp1StatusColor(_ status: String?) -> Color {
    switch status {
    case "overdue": return .red
    case "due_today", "due_soon", "needs_source": return AMDOSDesign.warning
    case "completed": return AMDOSDesign.success
    case "cancelled": return AMDOSDesign.muted
    default: return AMDOSDesign.blue
    }
}
