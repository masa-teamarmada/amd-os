import Foundation
import SwiftUI

// MARK: - Plan Cycle

struct CockpitPlanCycle {
    let planCycleId: String
    let status: String          // "active" / "fixed" / "confirmed" / "draft"
    let totalPoints: Int
    let periodStartYm: String
    let periodEndYm: String

    var displayPeriod: String {
        "\(ymDisplay(periodStartYm)) 〜 \(ymDisplay(periodEndYm))"
    }

    /// fixed に上げられる状態か（既に fixed なら不要）
    var isFixable: Bool {
        status == "active" || status == "confirmed" || status == "draft"
    }

    var statusLabel: String {
        switch status {
        case "fixed":     return "確定済"
        case "active":    return "編集中"
        case "confirmed": return "承認待"
        case "draft":     return "下書き"
        default:          return status
        }
    }
}

// MARK: - Milestone

struct CockpitMilestone: Identifiable {
    let id: String
    let milestoneId: String
    let title: String
    let points: Int
    let tag: String
    let targetYm: String?
    let successCriteria: String
    let currentProgressPct: Double
    let subItems: [CockpitSubItem]

    var tagLabel: String {
        switch tag {
        case "routine": return "ルーティン"
        case "buffer": return "バッファ"
        default: return "通常"
        }
    }

    var tagColor: Color {
        switch tag {
        case "routine": return .blue
        case "buffer": return .orange
        default: return AMD.blue
        }
    }
}

struct CockpitSubItem: Identifiable {
    let id: String
    let subItemId: String
    let title: String
    let startYm: String?
    let targetYm: String?
    let isDone: Bool
    let orderNo: Int

    var targetYmLabel: String? {
        guard let targetYm, !targetYm.isEmpty else { return nil }
        return ymDisplay(targetYm)
    }
}

// MARK: - Monthly Card Items

struct MonthMsItem: Identifiable {
    let id: String
    let milestoneId: String
    let title: String
    let points: Int
    let tag: String
    let cumulativePct: Double
    let monthlyPct: Double
    let monthlySource: String?
    let monthlyNote: String?

    var tagLabel: String {
        switch tag {
        case "routine": return "ルーティン"
        case "buffer": return "バッファ"
        default: return "通常"
        }
    }

    var prevCumulativePct: Double {
        max(0, cumulativePct - monthlyPct)
    }

    var isEstimatedDelta: Bool {
        (monthlySource ?? "").lowercased() == "tsukuyomi_estimate"
    }
}

struct CockpitMemberReward: Identifiable {
    let id: String
    let memberId: String
    let memberName: String
    let earnedPt: Double
    let estimatedRewardYen: Double
}

struct CockpitMonthCard: Identifiable {
    let id: String
    let ym: String
    let displayYm: String
    let billingStatus: String
    let budgetYen: Double?
    let msItems: [MonthMsItem]
    let expectedPct: Double?
    let memberRewards: [CockpitMemberReward]
    let reportStatus: String?
    let totalMonthlyPt: Double

    var isCurrent: Bool {
        ym == currentYm()
    }
}

// MARK: - Full Cockpit Data

struct CockpitData {
    let project: SupabaseProject
    let planCycle: CockpitPlanCycle?
    let milestones: [CockpitMilestone]
    let monthlyCards: [CockpitMonthCard]
}

// MARK: - Free-Function Helpers

func ymDisplay(_ ym: String) -> String {
    guard ym.count == 6 else { return ym }
    let y = String(ym.prefix(4))
    let m = String(Int(String(ym.suffix(2))) ?? 0)
    return "\(y)年\(m)月"
}

func currentYm() -> String {
    let cal = Calendar.current
    let now = Date()
    let y = cal.component(.year, from: now)
    let m = cal.component(.month, from: now)
    return String(format: "%04d%02d", y, m)
}
