import Foundation

struct AMDTask: Identifiable, Codable {
    let id: String
    let projectId: String
    let title: String
    let status: TaskStatus
    let source: TaskSource
    let dueDate: Date?
    let assigneeCodeName: String?

    enum TaskStatus: String, Codable, CaseIterable {
        case pending    // LLM抽出待ち承認
        case todo
        case doing
        case done
    }

    enum TaskSource: String, Codable {
        case tsukuyomi  // LLMが抽出
        case manual     // 手動作成
    }
}

struct TsukuyomiMessage: Identifiable, Codable {
    let id: String
    let projectId: String?
    let role: MessageRole
    let content: String
    let createdAt: Date

    enum MessageRole: String, Codable {
        case user
        case assistant
    }
}
