import Foundation

// MARK: - Billing Matrix

struct BillingMatrixRow: Identifiable, Decodable {
    var id: String { "\(projectId)_\(ym)" }
    let projectId: String
    let ym: String
    let invoiceYm: String?
    let invoiceBaseLinesJson: String?
    let invoiceSubject: String?
    let budgetConfirmedAt: String?
    let meetingEventId: String?
    let reportFixedAt: String?
    let invoiceIssuedAt: String?
    let invoiceSentAt: String?
    let payoutNoticeUploadedAt: String?
    let paymentConfirmedAt: String?
    let rewardPaidAt: String?

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case ym
        case invoiceYm = "invoice_ym"
        case invoiceBaseLinesJson = "invoice_base_lines_json"
        case invoiceSubject = "invoice_subject"
        case budgetConfirmedAt = "budget_confirmed_at"
        case meetingEventId = "meeting_event_id"
        case reportFixedAt = "report_fixed_at"
        case invoiceIssuedAt = "invoice_issued_at"
        case invoiceSentAt = "invoice_sent_at"
        case payoutNoticeUploadedAt = "payout_notice_uploaded_at"
        case paymentConfirmedAt = "payment_confirmed_at"
        case rewardPaidAt = "reward_paid_at"
    }

    func stepStatus(for taskKey: String) -> MatrixCellStatus {
        switch taskKey {
        case "budget":
            return (budgetConfirmedAt != nil && !(budgetConfirmedAt ?? "").isEmpty) ? .done : .undone
        case "meeting":
            let eid = meetingEventId ?? ""
            if eid == "skipped" { return .skip }
            return !eid.isEmpty ? .done : .undone
        case "reportFix":
            return (reportFixedAt != nil && !(reportFixedAt ?? "").isEmpty) ? .done : .undone
        case "invoice":
            return (invoiceIssuedAt != nil && !(invoiceIssuedAt ?? "").isEmpty) ? .done : .undone
        case "invoiceSent":
            return (invoiceSentAt != nil && !(invoiceSentAt ?? "").isEmpty) ? .done : .undone
        case "paymentNotice":
            return (payoutNoticeUploadedAt != nil && !(payoutNoticeUploadedAt ?? "").isEmpty) ? .done : .undone
        case "payment":
            return (paymentConfirmedAt != nil && !(paymentConfirmedAt ?? "").isEmpty) ? .done : .undone
        case "rewardPaid":
            return (rewardPaidAt != nil && !(rewardPaidAt ?? "").isEmpty) ? .done : .undone
        default:
            return .undone
        }
    }

    var effectiveInvoiceYm: String {
        let raw = invoiceYm?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return raw.isEmpty ? ym : raw
    }

    var hasCTBEstimateMarker: Bool {
        (invoiceBaseLinesJson ?? "").contains(ctbEstimateDoneMarkerDescription)
    }
}

enum MatrixCellStatus {
    case done, undone, skip
}

struct MatrixStepDef {
    let key: String
    let label: String
    let canSkip: Bool
}

struct ProjectConfigRow: Identifiable, Decodable {
    var id: String { projectId }
    let projectId: String
    let projectName: String
    let clientName: String?
    let status: String
    let startYm: String?
    let endYm: String?
    let reportEmails: String?
    let projectType: String?
    let feeType: String?
    let feeAmount: Double?
    let invoiceSendDeadlineRule: String?
    let paymentDueRule: String?
    let invoiceSendManual: Bool?
    let invoiceToEmails: String?
    let invoiceCcEmails: String?
    let invoiceBccEmails: String?

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case projectName = "project_name"
        case clientName = "client_name"
        case status
        case startYm = "start_ym"
        case endYm = "end_ym"
        case reportEmails = "report_emails"
        case projectType = "project_type"
        case feeType = "fee_type"
        case feeAmount = "fee_amount"
        case invoiceSendDeadlineRule = "invoice_send_deadline_rule"
        case paymentDueRule = "payment_due_rule"
        case invoiceSendManual = "invoice_send_manual"
        case invoiceToEmails = "invoice_to_emails"
        case invoiceCcEmails = "invoice_cc_emails"
        case invoiceBccEmails = "invoice_bcc_emails"
    }
}

private let standardMatrixStepDefs: [MatrixStepDef] = [
    MatrixStepDef(key: "budget",        label: "予算確定",   canSkip: false),
    MatrixStepDef(key: "meeting",       label: "報告会",     canSkip: true),
    MatrixStepDef(key: "reportFix",     label: "報告書",     canSkip: false),
    MatrixStepDef(key: "reimburseConfirm", label: "立替確認", canSkip: false),
    MatrixStepDef(key: "invoice",       label: "請求発行",   canSkip: false),
    MatrixStepDef(key: "invoiceSent",   label: "請求送付",   canSkip: false),
    MatrixStepDef(key: "paymentNotice", label: "支払通知",   canSkip: false),
    MatrixStepDef(key: "payment",       label: "入金確認",   canSkip: false),
    MatrixStepDef(key: "rewardPaid",    label: "報酬支払",   canSkip: false),
]

private let ctbMatrixStepDefs: [MatrixStepDef] = [
    MatrixStepDef(key: "budget",        label: "予算確定",   canSkip: false),
    MatrixStepDef(key: "estimateSend",  label: "見積送付",   canSkip: false),
    MatrixStepDef(key: "invoice",       label: "請求発行",   canSkip: false),
    MatrixStepDef(key: "meeting",       label: "報告会",     canSkip: true),
    MatrixStepDef(key: "invoiceSent",   label: "請求送付",   canSkip: false),
    MatrixStepDef(key: "reportFix",     label: "報告書",     canSkip: false),
    MatrixStepDef(key: "reimburseConfirm", label: "立替確認", canSkip: false),
    MatrixStepDef(key: "paymentNotice", label: "支払通知",   canSkip: false),
    MatrixStepDef(key: "payment",       label: "入金確認",   canSkip: false),
    MatrixStepDef(key: "rewardPaid",    label: "報酬支払",   canSkip: false),
]

func matrixStepDefs(for projectType: String?) -> [MatrixStepDef] {
    ((projectType ?? "").lowercased() == "ctb") ? ctbMatrixStepDefs : standardMatrixStepDefs
}

// MARK: - Budget Pending

struct BudgetPendingItem: Identifiable, Decodable {
    var id: String { "\(projectId)_\(ym)" }
    let projectId: String
    let ym: String
    let budgetReportedAmount: Double?   // 請求額（PMが申告）
    let budgetBufferAmount: Int?        // バッファ（PMが申告、任意）
    let budgetReportedAt: String?
    let budgetReportedBy: String?
    let status: String?
    let memberAllocationsJson: [String: Int]? // メンバー配賦額 {"ID001": 50000, ...}

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case ym
        case budgetReportedAmount = "budget_reported_amount"
        case budgetBufferAmount = "budget_buffer_amount"
        case budgetReportedAt = "budget_reported_at"
        case budgetReportedBy = "budget_reported_by"
        case status
        case memberAllocationsJson = "member_allocations_json"
    }

    /// 請求額 × 65% - バッファ = PJ予算
    func pjBudget(buffer: Int = 0) -> Int {
        max(0, Int(((budgetReportedAmount ?? 0) * 0.65).rounded()) - buffer)
    }

    /// 配賦額の合計
    var allocationTotal: Int {
        (memberAllocationsJson ?? [:]).values.reduce(0, +)
    }
}

// MARK: - Payout Notice (Member-grouped)

/// 支払通知書 — メンバー単位の集約行。
/// 指定 ym において、active メンバー × is_active な project_members の組み合わせを
/// 全部リストアップし、billing_cycles.member_allocations_json に金額があれば反映する。
struct PayoutNoticeMemberRow: Identifiable, Hashable {
    var id: String { memberId }
    let memberId: String
    let codeName: String
    let email: String?
    let breakdown: [PayoutNoticeMemberPJ]
    let sentAt: String?
    let noticeNo: String?

    /// 配賦が入力済みのPJの合計（未設定PJは含めない）
    var totalYen: Int { breakdown.filter(\.isAllocated).reduce(0) { $0 + $1.yen } }
    var isSent: Bool { (sentAt ?? "").isEmpty == false }
    /// 1つでも配賦未入力のPJがあるか（送付前の警告に使う）
    var hasUnsetPJ: Bool { breakdown.contains(where: { !$0.isAllocated }) }
}

/// メンバー × ym の中の1PJ
struct PayoutNoticeMemberPJ: Hashable {
    let projectId: String
    let projectName: String
    /// 配賦額（未設定なら 0）
    let yen: Int
    /// PMが billing_cycles.member_allocations_json でこのメンバーに配賦額を入れたか。
    /// false なら「未設定」表示にして、totalYen には加算しない。
    let isAllocated: Bool
}

/// AdminTabView 上部の「今月やること」カード用サマリ。
/// 各カウンタは active PJ × 直近6ヶ月の billing_cycles を集計したもの。
struct AdminPendingSummary: Equatable {
    let budgetApprovalCount: Int       // status='reported'
    let payoutNoticeCount: Int         // 請求書発行済み × 通知書未送付
    let paymentUnconfirmedCount: Int   // 請求書送付済み × 入金未確認
    let rewardUnpaidCount: Int         // 入金確認済み × 報酬未支払い

    var totalCount: Int {
        budgetApprovalCount + payoutNoticeCount + paymentUnconfirmedCount + rewardUnpaidCount
    }
}

/// send-payout-notice Edge Function の戻り値
struct PayoutNoticeEdgeResult: Decodable {
    let ok: Bool
    let mode: String?
    let memberId: String?
    let payeeName: String?
    let pdfUrl: String?
    let pdfBase64: String?    // preview モードで PDF をそのまま base64 で返す
    let noticeNo: String?
    let sentTo: String?
    let totalYen: Int?
    let message: String?
}

// MARK: - Helpers

func ymDisplayAdmin(_ ym: String) -> String {
    guard ym.count == 6 else { return ym }
    let y = ym.prefix(4)
    let m = Int(ym.suffix(2)) ?? 0
    return "\(y)年\(m)月"
}

func formatYenAdmin(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    return (formatter.string(from: NSNumber(value: Int(value))) ?? "\(Int(value))") + "円"
}

// MARK: - Knowledge Session

struct KnowledgeSessionRecord: Identifiable, Decodable {
    var id: String { baseYm }
    let baseYm: String
    let offlineEnabled: Bool
    let eventDate: String?
    let venueName: String?
    let venueAddress: String?
    let venueLink: String?
    let participantMemberIds: [String]?
    let messageToPm: String?
    let announcementDraft: String?
    let announcementPostedAt: String?
    let announcementPostedBy: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case baseYm = "base_ym"
        case offlineEnabled = "offline_enabled"
        case eventDate = "event_date"
        case venueName = "venue_name"
        case venueAddress = "venue_address"
        case venueLink = "venue_link"
        case participantMemberIds = "participant_member_ids"
        case messageToPm = "message_to_pm"
        case announcementDraft = "announcement_draft"
        case announcementPostedAt = "announcement_posted_at"
        case announcementPostedBy = "announcement_posted_by"
        case updatedAt = "updated_at"
    }

    static func placeholder(baseYm: String) -> KnowledgeSessionRecord {
        KnowledgeSessionRecord(
            baseYm: baseYm,
            offlineEnabled: false,
            eventDate: nil,
            venueName: nil,
            venueAddress: nil,
            venueLink: nil,
            participantMemberIds: [],
            messageToPm: nil,
            announcementDraft: nil,
            announcementPostedAt: nil,
            announcementPostedBy: nil,
            updatedAt: nil
        )
    }

    var timelineTitle: String {
        knowledgeSessionTimelineTitle(baseYm)
    }
}

struct KnowledgeMember: Identifiable, Decodable {
    var id: String { memberId }
    let memberId: String
    let codeName: String?
    let email: String?
    let slackId: String?

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case codeName = "code_name"
        case email
        case slackId = "slack_id"
    }

    var displayName: String { codeName ?? memberId }
}

struct KnowledgeVenueHistory: Identifiable, Decodable {
    var id: String { "\(venueName ?? "")_\(eventDate ?? "")" }
    let venueName: String?
    let venueAddress: String?
    let venueLink: String?
    let eventDate: String?
    let baseYm: String?

    enum CodingKeys: String, CodingKey {
        case venueName = "venue_name"
        case venueAddress = "venue_address"
        case venueLink = "venue_link"
        case eventDate = "event_date"
        case baseYm = "base_ym"
    }
}

struct KnowledgeAnnouncementDraftResult: Decodable {
    let ok: Bool
    let message: String?
    let draft: String?
}

struct KnowledgeAnnouncementPostResult: Decodable {
    let ok: Bool
    let message: String?
    let channel: String?
    let ts: String?
}

func knowledgeSessionTimelineTitle(_ baseYm: String) -> String {
    guard baseYm.count == 6,
          let y = Int(baseYm.prefix(4)),
          let m = Int(baseYm.suffix(2)) else {
        return "\(baseYm) 稼働分"
    }
    let nextM = m == 12 ? 1 : m + 1
    return "\(nextM)月第1週開催（\(y).\(String(format: "%02d", m))稼働分）"
}

func prevYmAdmin(_ ym: String) -> String {
    guard ym.count == 6,
          let y = Int(ym.prefix(4)),
          let m = Int(ym.suffix(2)) else { return ym }
    let prevM = m == 1 ? 12 : m - 1
    let prevY = m == 1 ? y - 1 : y
    return String(format: "%04d%02d", prevY, prevM)
}
