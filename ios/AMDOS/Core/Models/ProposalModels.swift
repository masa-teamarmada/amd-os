import Foundation

// MARK: - MS活動 narrative（メンバー × MS × ym）

struct MemberMsActivity: Identifiable {
    let id: String
    let memberId: String
    let milestoneId: String
    let ym: String
    let narrative: String
    let learnedAddendum: String?
    let generatedAt: Date?

    static func make(memberId: String, milestoneId: String, ym: String, narrative: String, learnedAddendum: String?, generatedAt: Date?) -> MemberMsActivity {
        MemberMsActivity(
            id: "\(memberId)_\(milestoneId)_\(ym)",
            memberId: memberId,
            milestoneId: milestoneId,
            ym: ym,
            narrative: narrative,
            learnedAddendum: learnedAddendum,
            generatedAt: generatedAt
        )
    }
}

// MARK: - 提案

enum MsProposalStatus: String, Decodable {
    case pending
    case approved
    case rejected
}

struct MsProgressProposal: Identifiable {
    let id: String                  // UUID
    let memberId: String
    let memberName: String?         // 表示用に解決済み（Adminタブ向け）
    let projectId: String
    let projectName: String?
    let milestoneId: String
    let milestoneTitle: String?
    let ym: String
    let suggestedPct: Double?
    let suggestedText: String?
    let status: MsProposalStatus
    let rejectReasonRaw: String?
    let createdAt: Date?
    let reviewedAt: Date?
    let messages: [MsProposalMessage]
}

enum MsProposalSenderKind: String, Decodable {
    case member
    case admin
    case tsukuyomi
}

struct MsProposalMessage: Identifiable {
    let id: String
    let proposalId: String
    let senderKind: MsProposalSenderKind
    let body: String
    let createdAt: Date?
}
