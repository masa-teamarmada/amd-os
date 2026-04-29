import Foundation

// MARK: - MS進捗 修正依頼（PM ↔ つくよみ）

enum MsRevisionStatus: String, Decodable {
    case pending
    case confirmed
    case discarded
}

enum MsRevisionSenderKind: String, Decodable {
    case pm
    case tsukuyomi
}

struct MsRevisionMessage: Identifiable {
    let id: String
    let revisionId: String
    let senderKind: MsRevisionSenderKind
    let body: String
    let createdAt: Date?
}

struct MsProgressRevision: Identifiable {
    let id: String
    let projectId: String
    let milestoneId: String
    let ym: String
    let currentPct: Double?
    let currentNote: String?
    let revisedPct: Double?
    let revisedNote: String?
    let status: MsRevisionStatus
    let requestedBy: String?
    let confirmedBy: String?
    let confirmedAt: Date?
    let createdAt: Date?
    let messages: [MsRevisionMessage]
}
