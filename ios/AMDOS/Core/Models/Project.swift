import Foundation

struct Project: Identifiable, Codable {
    let id: String
    let codeName: String      // 実名表示禁止 → codeName-onlyルール
    let clientName: String
    let status: String
    let phase: String?
    let currentYm: Int?       // yyyymm形式
}

struct MilestoneProgress: Identifiable, Codable {
    let id: String
    let projectId: String
    let ym: Int               // yyyymm形式
    let progressPct: Int
    let source: ProgressSource
    let comment: String?

    enum ProgressSource: String, Codable {
        case tsukuyomiEstimate = "tsukuyomi_estimate"
        case pmConfirmed = "pm_confirmed"
        case pmManual = "pm_manual"
        case pmRejected = "pm_rejected"
    }
}

struct RewardSummary: Codable {
    let projectId: String
    let ym: Int
    let baseAmount: Int
    let bonusAmount: Int
    let totalAmount: Int
}
