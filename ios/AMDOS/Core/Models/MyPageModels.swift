import Foundation

// MARK: - MyPage Data Models

struct MyPageData {
    let memberId: String
    let codeName: String
    let months: [MyPageMonth]
}

struct MyPageNotification: Identifiable {
    let id: String
    let projectId: String
    let projectName: String
    let bizYm: String
    let stepId: String
    let stepLabel: String
    let status: String
    let deadline: String?

    var title: String { "\(projectName): \(stepLabel)" }
}

struct MyPageMonth: Identifiable {
    var id: String { ym }
    let ym: String              // "202604"
    let isCurrent: Bool
    let projects: [MyPageProject]

    var totalAllocation: Int {
        projects.compactMap(\.allocation).reduce(0, +)
    }

    /// "2026年4月"
    var displayYm: String {
        guard ym.count == 6,
              let m = Int(ym.suffix(2)) else { return ym }
        return "\(ym.prefix(4))年\(m)月"
    }
}

struct MyPageProject: Identifiable {
    var id: String { projectId }
    let projectId: String
    let projectName: String
    let allocation: Int?            // member_allocations_json[myId] — nil = 未確定
    let allocationStatus: AllocationStatus
    let milestones: [MyPageMilestone]
    let billingStatus: String       // billing_cycle status
    let sectionMembers: String?     // monthly_reports.section_members（GAS生成マークダウン）
    let monthlyEstimatedRewardYen: Double?  // billing_cycles.reward_summary_json.members[me].totalPay
    let monthlyEarnedPt: Double?            // 同 .members[me].earnedPt

    enum AllocationStatus: String {
        case confirmed = "confirmed"        // allocation_confirmed
        case reported  = "reported"         // 申告済み（承認待ち）
        case notSet    = "not_set"          // 未設定
    }
}

struct MyPageMilestone: Identifiable {
    var id: String { milestoneKey }
    let milestoneKey: String
    let title: String
    let maxPoints: Int
    let tag: String                 // "normal" / "routine" / "buffer"
    let progressPct: Double         // 累積進捗率 (0-100)
    let monthlyProgressPct: Double  // 当月増分 (0-100)
    let monthlyNote: String?        // milestone_monthly_progress.note（当月）
    let monthlySource: String?      // milestone_monthly_progress.source（当月）

    var tagLabel: String {
        switch tag {
        case "routine": return "定常"
        case "buffer":  return "バッファ"
        default:        return ""
        }
    }

    var tagColor: String {
        switch tag {
        case "routine": return "blue"
        case "buffer":  return "orange"
        default:        return "gray"
        }
    }

    var isEstimatedDelta: Bool {
        (monthlySource ?? "").lowercased() == "tsukuyomi_estimate"
    }

    /// 月次モーダル (MonthlyModal.deltaSummaryText) と同じ文面ロジック
    var deltaSummaryText: String {
        if let note = monthlyNote?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
            return note
        }
        if monthlyProgressPct <= 0.01 {
            return "先月からの進捗差分はありません。"
        }
        let deltaPt = (monthlyProgressPct / 100.0) * Double(maxPoints)
        if isEstimatedDelta {
            return String(format: "AI推定: 先月から +%.0f%%（+%.1fpt）進捗見込み。", monthlyProgressPct, deltaPt)
        }
        return String(format: "先月から +%.0f%%（+%.1fpt）進捗しました。", monthlyProgressPct, deltaPt)
    }
}
