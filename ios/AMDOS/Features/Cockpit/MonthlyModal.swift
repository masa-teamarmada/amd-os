import SwiftUI

struct MonthlyModal: View {
    let projectId: String
    let projectName: String
    let monthCard: CockpitMonthCard

    @State private var selectedTab = 0
    @State private var reportContent: String?
    @State private var reportStatus: String?
    @State private var isLoadingReport = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $selectedTab) {
                    Text("進捗確認").tag(0)
                    Text("報告書").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(AMD.bgPage)

                TabView(selection: $selectedTab) {
                    progressTab.tag(0)
                    reportTab.tag(1)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut(duration: 0.2), value: selectedTab)
            }
            .background(AMD.bgPage)
            .navigationTitle(monthCard.displayYm)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("閉じる") { dismiss() }
                }
            }
        }
    }

    // MARK: - Tab 1: 進捗確認

    private var progressTab: some View {
        ScrollView {
            VStack(spacing: 14) {
                summaryCard
                if monthCard.msItems.isEmpty {
                    ContentUnavailableView(
                        "MSなし",
                        systemImage: "chart.bar",
                        description: Text("バリュープランが設定されていません")
                    )
                    .padding(.top, 40)
                } else {
                    ForEach(monthCard.msItems) { item in
                        msProgressCard(item)
                    }
                }
                memberRewardCard
            }
            .padding(16)
            .padding(.bottom, 32)
        }
    }

    private var summaryCard: some View {
        HStack(spacing: 0) {
            summaryCell(
                label: "今月消化",
                value: String(format: "%.1f pt", monthCard.totalMonthlyPt),
                valueColor: AMD.blue
            )
            Divider().frame(height: 40)
            summaryCell(
                label: "予算",
                value: monthCard.budgetYen.map { "¥\(Int($0).formatted())" } ?? "—",
                valueColor: AMD.text
            )
            Divider().frame(height: 40)
            summaryCell(
                label: "ステータス",
                value: billingStatusLabel(monthCard.billingStatus),
                valueColor: billingStatusColor(monthCard.billingStatus)
            )
        }
        .padding(.vertical, 14)
        .background(AMD.card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func summaryCell(label: String, value: String, valueColor: Color) -> some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.caption)
                .foregroundStyle(AMD.textTertiary)
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(valueColor)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
    }

    private func msProgressCard(_ item: MonthMsItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(AMD.text)
                    Text(item.tagLabel)
                        .font(.system(size: 10, weight: .medium))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(AMD.bgDeep)
                        .foregroundStyle(AMD.textSub)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(Int(item.cumulativePct))%")
                        .font(.title3)
                        .fontWeight(.bold)
                        .monospacedDigit()
                        .foregroundStyle(AMD.text)
                    if item.monthlyPct > 0.01 {
                        Text(String(format: "+%.0f%% 先月差分", item.monthlyPct))
                            .font(.caption)
                            .foregroundStyle(item.isEstimatedDelta ? .orange : .green)
                    } else {
                        Text("差分なし")
                            .font(.caption)
                            .foregroundStyle(AMD.textSub)
                    }
                }
            }

            // Stacked progress bar (previous + monthly delta)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(AMD.bgDeep)
                        .frame(height: 10)

                    let cumulativePct = min(max(item.cumulativePct, 0), 100)
                    let cumulativeW = geo.size.width * CGFloat(cumulativePct / 100)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(AMD.blue)
                        .frame(width: cumulativeW, height: 10)

                    let priorPct = min(max(item.prevCumulativePct, 0), 100)
                    let priorW = geo.size.width * CGFloat(priorPct / 100)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.green.opacity(0.72))
                        .frame(width: priorW, height: 10)
                        .zIndex(1)

                    let deltaPct = max(0, min(item.monthlyPct, 100))
                    let deltaW = geo.size.width * CGFloat(deltaPct / 100)
                    if item.isEstimatedDelta && deltaW > 0 {
                        StripedOverlay()
                            .frame(width: deltaW, height: 10)
                            .offset(x: priorW)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                            .zIndex(2)
                    }

                    if let expectedPct = monthCard.expectedPct, expectedPct.isFinite {
                        let clamped = min(max(expectedPct, 0), 100)
                        Rectangle()
                            .fill(.orange)
                            .frame(width: 2, height: 14)
                            .offset(x: geo.size.width * CGFloat(clamped / 100) - 1, y: -2)
                    }
                }
            }
            .frame(height: 10)

            HStack {
                Text("\(item.points) pt")
                    .font(.caption)
                    .foregroundStyle(AMD.textSub)
                Spacer()
                let earnedPt = (item.monthlyPct / 100.0) * Double(item.points)
                Text(String(format: "先月比 +%.1f pt", max(0, earnedPt)))
                    .font(.caption)
                    .foregroundStyle(item.isEstimatedDelta ? .orange : .green)
            }

            Text(deltaSummaryText(for: item))
                .font(.caption)
                .foregroundStyle(AMD.textSub)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(AMD.card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var memberRewardCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("メンバー獲得pt / 想定報酬")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(AMD.text)

            if monthCard.memberRewards.isEmpty {
                Text("この月の報酬サマリーは未計算です")
                    .font(.caption)
                    .foregroundStyle(AMD.textSub)
            } else {
                ForEach(monthCard.memberRewards) { member in
                    HStack(spacing: 8) {
                        Text(member.memberName)
                            .font(.subheadline)
                            .foregroundStyle(AMD.text)
                        Spacer()
                        Text(String(format: "%.2f pt", member.earnedPt))
                            .font(.caption)
                            .foregroundStyle(AMD.textSub)
                        Text("¥\(Int(member.estimatedRewardYen).formatted())")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .monospacedDigit()
                            .foregroundStyle(AMD.blue)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .padding(14)
        .background(AMD.card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Tab 2: 報告書

    private var reportTab: some View {
        Group {
            if isLoadingReport {
                ProgressView("読み込み中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let content = reportContent, !content.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if let st = reportStatus {
                            HStack(spacing: 6) {
                                Image(systemName: reportStatusIcon(st))
                                    .font(.caption)
                                Text(reportStatusLabel(st))
                                    .font(.caption)
                                    .fontWeight(.medium)
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(reportStatusColor(st).opacity(0.1))
                            .foregroundStyle(reportStatusColor(st))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        Text(content)
                            .font(.body)
                            .foregroundStyle(AMD.text)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                    .padding(16)
                    .padding(.bottom, 32)
                }
            } else {
                ContentUnavailableView(
                    "報告書なし",
                    systemImage: "doc.text",
                    description: Text("\(monthCard.displayYm)の報告書はまだ作成されていません")
                )
            }
        }
        .task { await loadReport() }
    }

    // MARK: - Helpers

    private func billingStatusLabel(_ status: String) -> String {
        switch status {
        case "not_started":         return "未開始"
        case "reported":            return "申告済"
        case "allocation_confirmed": return "配賦確定"
        case "invoice_issued":      return "請求書発行"
        case "payment_confirmed":   return "入金確認"
        default:                    return status
        }
    }

    private func billingStatusColor(_ status: String) -> Color {
        switch status {
        case "not_started":          return AMD.textSub
        case "reported":             return .orange
        case "allocation_confirmed": return AMD.blue
        case "invoice_issued", "payment_confirmed": return .green
        default:                     return AMD.textSub
        }
    }

    private func reportStatusLabel(_ status: String) -> String {
        switch status {
        case "draft":     return "下書き"
        case "approved":  return "承認済"
        case "submitted": return "提出済"
        default:          return status
        }
    }

    private func reportStatusIcon(_ status: String) -> String {
        switch status {
        case "draft":     return "doc.text"
        case "approved":  return "checkmark.circle.fill"
        case "submitted": return "paperplane.fill"
        default:          return "doc"
        }
    }

    private func reportStatusColor(_ status: String) -> Color {
        switch status {
        case "draft":     return .orange
        case "approved":  return .green
        case "submitted": return AMD.blue
        default:          return .secondary
        }
    }

    private func loadReport() async {
        guard !isLoadingReport else { return }
        isLoadingReport = true
        if let data = try? await SupabaseService.shared.fetchMonthlyReport(
            projectId: projectId, ym: monthCard.ym
        ) {
            reportContent = data.report?.finalContent ?? data.report?.draftContent
            reportStatus = data.report?.status
        }
        isLoadingReport = false
    }

    private func deltaSummaryText(for item: MonthMsItem) -> String {
        if let note = item.monthlyNote?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
            return note
        }
        if item.monthlyPct <= 0.01 {
            return "先月からの進捗差分はありません。"
        }
        let deltaPt = (item.monthlyPct / 100.0) * Double(item.points)
        if item.isEstimatedDelta {
            return String(format: "AI推定: 先月から +%.0f%%（+%.1fpt）進捗見込み。", item.monthlyPct, deltaPt)
        }
        return String(format: "先月から +%.0f%%（+%.1fpt）進捗しました。", item.monthlyPct, deltaPt)
    }
}

private struct StripedOverlay: View {
    var body: some View {
        GeometryReader { geo in
            Canvas { context, size in
                let stripeColor = Color.white.opacity(0.45)
                let spacing: CGFloat = 6
                var x: CGFloat = -size.height
                while x < size.width + size.height {
                    var path = Path()
                    path.move(to: CGPoint(x: x, y: size.height))
                    path.addLine(to: CGPoint(x: x + size.height, y: 0))
                    context.stroke(path, with: .color(stripeColor), lineWidth: 2)
                    x += spacing
                }
            }
        }
    }
}
