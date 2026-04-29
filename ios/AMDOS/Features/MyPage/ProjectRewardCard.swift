import SwiftUI

struct ProjectRewardCard: View {
    let project: MyPageProject
    let codeName: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: PJ name + allocation
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.projectName)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    statusBadge
                }
                Spacer()
                if let amount = project.allocation {
                    Text(formatYen(amount))
                        .font(.title3)
                        .fontWeight(.bold)
                        .fontDesign(.monospaced)
                } else {
                    Text("未確定")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            // 今月想定（MS 進捗から計算された想定報酬）
            estimatedRewardRow

            // Milestones
            if !project.milestones.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(project.milestones) { ms in
                        milestoneRow(ms)
                    }
                }
            }

            // 今月の活動（section_members からコードネーム部分を抽出）
            if let activityText = myActivityText {
                Divider()
                VStack(alignment: .leading, spacing: 6) {
                    Label("今月の活動", systemImage: "text.badge.checkmark")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)
                    Text(activityText)
                        .font(.caption)
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(14)
        .background(Color(.systemBackground))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.separator).opacity(0.4), lineWidth: 0.5)
        )
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
    }

    // MARK: - Estimated Reward Row

    @ViewBuilder
    private var estimatedRewardRow: some View {
        HStack(spacing: 6) {
            Image(systemName: "sparkles")
                .font(.system(size: 10))
                .foregroundStyle(.indigo)
            Text("今月想定")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            if let yen = project.monthlyEstimatedRewardYen, yen > 0 {
                if let pt = project.monthlyEarnedPt, pt > 0 {
                    Text(String(format: "%.1f pt", pt))
                        .font(.caption2)
                        .foregroundStyle(AMD.textSub)
                        .monospacedDigit()
                }
                Text(formatYen(Int(yen.rounded())))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.indigo)
                    .monospacedDigit()
            } else {
                Text("未計算")
                    .font(.caption2)
                    .foregroundStyle(AMD.textTertiary)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.indigo.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Activity Text

    private var myActivityText: String? {
        guard let text = project.sectionMembers, !codeName.isEmpty else { return nil }
        return extractMemberSection(from: text, codeName: codeName)
    }

    private func extractMemberSection(from text: String, codeName: String) -> String? {
        let lines = text.components(separatedBy: "\n")
        var inSection = false
        var result: [String] = []
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("##") {
                if inSection { break }
                if trimmed.lowercased().contains(codeName.lowercased()) {
                    inSection = true
                }
            } else if inSection {
                result.append(line)
            }
        }
        let content = result.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        return content.isEmpty ? nil : content
    }

    // MARK: - Status Badge

    @ViewBuilder
    private var statusBadge: some View {
        switch project.allocationStatus {
        case .confirmed:
            Label("確定", systemImage: "checkmark.circle.fill")
                .font(.caption2).foregroundColor(.green)
        case .reported:
            Label("申告中", systemImage: "clock")
                .font(.caption2).foregroundColor(.orange)
        case .notSet:
            Label("未設定", systemImage: "minus.circle")
                .font(.caption2).foregroundColor(.secondary)
        }
    }

    // MARK: - Milestone Row

    private func milestoneRow(_ ms: MyPageMilestone) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                HStack(spacing: 4) {
                    Text(ms.title)
                        .font(.caption)
                        .lineLimit(1)
                    if !ms.tagLabel.isEmpty {
                        Text(ms.tagLabel)
                            .font(.system(size: 9))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(tagBackground(ms.tag))
                            .cornerRadius(3)
                    }
                }
                Spacer()
                Text("\(ms.maxPoints)pt")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .fontDesign(.monospaced)
            }
            HStack(spacing: 6) {
                ProgressView(value: min(ms.progressPct, 100), total: 100)
                    .tint(progressColor(ms.progressPct))
                Text("\(Int(ms.progressPct))%")
                    .font(.system(size: 10))
                    .fontDesign(.monospaced)
                    .foregroundStyle(.secondary)
                    .frame(width: 30, alignment: .trailing)
                if ms.monthlyProgressPct > 0 {
                    Text("+\(String(format: "%.1f", ms.monthlyProgressPct))%")
                        .font(.system(size: 9))
                        .foregroundColor(ms.isEstimatedDelta ? .orange : .green)
                }
            }
            // 月次モーダルと同じ delta summary text
            Text(ms.deltaSummaryText)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        }
    }

    // MARK: - Helpers

    private func tagBackground(_ tag: String) -> Color {
        switch tag {
        case "routine": return Color.blue.opacity(0.12)
        case "buffer":  return Color.orange.opacity(0.12)
        default:        return Color.gray.opacity(0.12)
        }
    }

    private func progressColor(_ pct: Double) -> Color {
        if pct >= 80 { return .green }
        if pct >= 40 { return .blue }
        return .orange
    }

    private func formatYen(_ amount: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        let s = f.string(from: NSNumber(value: amount)) ?? "\(amount)"
        return "¥\(s)"
    }
}
