import Foundation

// MARK: - listProjects

struct ProjectListData: Decodable {
    let projects: [GASProject]
}

enum BillingDocumentType: String {
    case invoice
    case quotation

    var issueButtonLabel: String {
        switch self {
        case .invoice: return "請求書を発行する"
        case .quotation: return "見積書を発行する"
        }
    }

    var title: String {
        switch self {
        case .invoice: return "請求書発行"
        case .quotation: return "見積書発行"
        }
    }

    var numberLabel: String {
        switch self {
        case .invoice: return "請求書番号"
        case .quotation: return "見積書番号"
        }
    }
}

let ctbEstimateDoneMarkerDescription = "[[CTB_ESTIMATE_SENT]]"

struct GASProject: Decodable, Identifiable, Hashable {
    var id: String { projectId }
    let projectId: String
    let projectName: String
    let clientName: String
    let status: String
    let startYm: String
    let endYm: String
    let projectType: String?

    var isCTB: Bool { (projectType ?? "").lowercased() == "ctb" }
}

// MARK: - routineFlowFull（8ステップ版）

/// PWA API の data 層（routineFlowFull は cockpit_api_getRoutineFlow を直接返す）
struct RoutineFlowFullData: Decodable {
    let ok: Bool
    let flows: [RoutineFlow]
    let today: String?
    let calendarYm: String?
}

struct RoutineFlow: Decodable, Identifiable {
    var id: String { bizYm }
    let bizYm: String          // "202604"
    let role: String           // "main" | "prev" | "next"
    let steps: [RoutineStep]
    let isDeferred: Bool
    let hasCycle: Bool?
    let invoiceYm: String?
    let batchTargetYms: [String]?

    /// "202604" → "2026年04月"
    var displayYm: String {
        guard bizYm.count == 6 else { return bizYm }
        let y = bizYm.prefix(4)
        let m = bizYm.suffix(2)
        return "\(y)年\(m)月"
    }

    init(
        bizYm: String,
        role: String,
        steps: [RoutineStep],
        isDeferred: Bool,
        hasCycle: Bool?,
        invoiceYm: String?,
        batchTargetYms: [String]?
    ) {
        self.bizYm = bizYm
        self.role = role
        self.steps = steps
        self.isDeferred = isDeferred
        self.hasCycle = hasCycle
        self.invoiceYm = invoiceYm
        self.batchTargetYms = batchTargetYms
    }
}

struct RoutineStep: Decodable, Identifiable {
    var id: String { stepId }
    let stepId: String        // "budget" | "meeting" | "reportFix" | ...
    let label: String
    let status: String        // "done" | "current" | "warn" | "overdue" | "future" | "deferred" | "pending"
    let done: Bool
    let doneAt: AnyCodable?
    let deadline: String?
    let href: String?
    let action: String?
    let deferred: Bool
    let isTappable: Bool      // Edge Function が計算して返す

    var isDone: Bool { done }
    var isDeferred: Bool { deferred || status == "deferred" }

    enum CodingKeys: String, CodingKey {
        case stepId = "id"
        case label, status, done, doneAt, deadline, href, action, deferred, isTappable
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        stepId     = try c.decode(String.self, forKey: .stepId)
        label      = try c.decode(String.self, forKey: .label)
        status     = (try? c.decode(String.self, forKey: .status)) ?? "future"
        done       = (try? c.decode(Bool.self,   forKey: .done))   ?? false
        doneAt     = try? c.decodeIfPresent(AnyCodable.self, forKey: .doneAt)
        deadline   = try? c.decodeIfPresent(String.self, forKey: .deadline)
        href       = try? c.decodeIfPresent(String.self, forKey: .href)
        action     = try? c.decodeIfPresent(String.self, forKey: .action)
        deferred   = (try? c.decode(Bool.self, forKey: .deferred))   ?? false
        // Edge Function から返される isTappable を使用。
        // フォールバック: href か action が空でなければタップ可能（GAS互換）
        if let serverTappable = try? c.decodeIfPresent(Bool.self, forKey: .isTappable) {
            isTappable = serverTappable
        } else {
            let h = (try? c.decodeIfPresent(String.self, forKey: .href)) ?? nil
            let a = (try? c.decodeIfPresent(String.self, forKey: .action)) ?? nil
            isTappable = (h != nil && !(h!.isEmpty)) || (a != nil && !(a!.isEmpty))
        }
    }

    init(
        stepId: String,
        label: String,
        status: String,
        done: Bool,
        doneAt: AnyCodable?,
        deadline: String?,
        href: String?,
        action: String?,
        deferred: Bool,
        isTappable: Bool
    ) {
        self.stepId = stepId
        self.label = label
        self.status = status
        self.done = done
        self.doneAt = doneAt
        self.deadline = deadline
        self.href = href
        self.action = action
        self.deferred = deferred
        self.isTappable = isTappable
    }
}

extension RoutineStep {
    func renamed(_ newLabel: String) -> RoutineStep {
        RoutineStep(
            stepId: stepId,
            label: newLabel,
            status: status,
            done: done,
            doneAt: doneAt,
            deadline: deadline,
            href: href,
            action: action,
            deferred: deferred,
            isTappable: isTappable
        )
    }

    func markedDone() -> RoutineStep {
        RoutineStep(
            stepId: stepId,
            label: label,
            status: "done",
            done: true,
            doneAt: doneAt,
            deadline: deadline,
            href: href,
            action: action,
            deferred: deferred,
            isTappable: isTappable
        )
    }

    func updated(deadline: String? = nil, status: String? = nil, label: String? = nil) -> RoutineStep {
        RoutineStep(
            stepId: stepId,
            label: label ?? self.label,
            status: status ?? self.status,
            done: done,
            doneAt: doneAt,
            deadline: deadline ?? self.deadline,
            href: href,
            action: action,
            deferred: deferred,
            isTappable: isTappable
        )
    }
}

private let standardVisibleStepOrder = [
    "budget",
    "meeting",
    "reportFix",
    "reimburseConfirm",
    "invoiceIssue",
    "invoiceSend",
    "payoutNotice",
    "payment",
    "payout"
]

private let ctbVisibleStepOrder = [
    "estimateSend",
    "budget",
    "meeting",
    "invoiceIssue",
    "invoiceSend",
    "reportFix",
    "reimburseConfirm",
    "payoutNotice",
    "payment",
    "payout"
]

private let ctbEstimateStepId = "estimateSend"
private let reimburseConfirmStepId = "reimburseConfirm"

func visibleRoutineSteps(
    for projectType: String?,
    in flow: RoutineFlow,
    ctbEstimateDraftMap: [String: Bool] = [:],
    reimbursementDoneMap: [String: Bool] = [:]
) -> [RoutineStep] {
    let baseSteps = flow.steps
    let isCTB = (projectType ?? "").lowercased() == "ctb"
    var adjustedSteps = Dictionary(uniqueKeysWithValues: baseSteps.map { step in
        (step.stepId, adjustedVisibleStep(step, in: flow, isCTB: isCTB))
    })
    adjustedSteps[reimburseConfirmStepId] = makeReimburseConfirmStep(
        flow: flow,
        done: reimbursementDoneMap[flow.bizYm] ?? true,
        isCTB: isCTB,
        reference: adjustedSteps["reportFix"] ?? adjustedSteps["invoiceIssue"]
    )
    guard isCTB else {
        return standardVisibleStepOrder.compactMap { adjustedSteps[$0] }
    }

    let draftDone = flow.bizYm <= "202512" ? true : (ctbEstimateDraftMap[flow.bizYm] ?? false)
    let estimateReference = adjustedSteps["budget"] ?? adjustedSteps["invoiceIssue"]
    adjustedSteps[ctbEstimateStepId] = makeCTBEstimateStep(
        flow: flow,
        estimateYm: flow.bizYm,
        draftDone: draftDone,
        reference: estimateReference
    )

    return ctbVisibleStepOrder.compactMap { stepId in
        adjustedSteps[stepId]
    }
}

func buildLegacyRoutineFlows(
    project: GASProject,
    billingRows: [BillingMatrixRow],
    now: Date = Date()
) -> [RoutineFlow] {
    let cal = Calendar(identifier: .gregorian)
    let comps = cal.dateComponents(in: TimeZone(identifier: "Asia/Tokyo") ?? .current, from: now)
    let currentYm = String(format: "%04d%02d", comps.year ?? 2026, comps.month ?? 1)
    let bizMain = prevYmString(from: currentYm)
    let bizPrev = prevYmString(from: bizMain)
    let bizNext = nextYmString(from: bizMain)
    let bizNext2 = nextYmString(from: bizNext)
    let targetYms = [bizPrev, bizMain, bizNext, bizNext2]

    let rowMap = Dictionary(uniqueKeysWithValues: billingRows.map { ($0.ym, $0) })

    return targetYms.enumerated().compactMap { index, bizYm in
        let row = rowMap[bizYm]
        let role = index == 0 ? "prev" : (index == 1 ? "main" : "next")
        if role != "main", row == nil {
            return nil
        }

        let rawInvoiceYm = row?.invoiceYm?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let effectiveInvoiceYm = rawInvoiceYm.isEmpty ? bizYm : rawInvoiceYm
        let isDeferred = effectiveInvoiceYm != bizYm
        let deferredLabel = isDeferred ? "\(Int(effectiveInvoiceYm.suffix(2)) ?? 0)月にまとめて請求" : ""
        let batchTargetYms = billingRows.compactMap { candidate -> String? in
            let candidateInvoiceYm = candidate.invoiceYm?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard candidate.ym != bizYm, candidateInvoiceYm == bizYm else { return nil }
            return candidate.ym
        }

        let invoiceIssueLabel: String
        if isDeferred {
            invoiceIssueLabel = deferredLabel
        } else if !batchTargetYms.isEmpty {
            invoiceIssueLabel = "請求書発行（\(batchTargetYms.count + 1)ヶ月分）"
        } else {
            invoiceIssueLabel = "請求書発行"
        }

        let invoiceDeferredStepIds: Set<String> = ["invoiceIssue", "invoiceSend", "payoutNotice", "payment", "payout"]

        let steps: [RoutineStep] = [
            makeLegacyRoutineStep(id: "budget", label: "請求額確定", doneAt: row?.budgetConfirmedAt, deferred: false),
            makeLegacyRoutineStep(id: "meeting", label: "報告会日程調整", doneAt: row?.meetingEventId, deferred: false),
            makeLegacyRoutineStep(id: "reportFix", label: "月次報告書FIX", doneAt: row?.reportFixedAt, deferred: false),
            makeLegacyRoutineStep(id: "invoiceIssue", label: invoiceIssueLabel, doneAt: row?.invoiceIssuedAt, deferred: isDeferred && invoiceDeferredStepIds.contains("invoiceIssue")),
            makeLegacyRoutineStep(id: "invoiceSend", label: isDeferred ? deferredLabel : "請求書送付", doneAt: row?.invoiceSentAt, deferred: isDeferred && invoiceDeferredStepIds.contains("invoiceSend")),
            makeLegacyRoutineStep(id: "payoutNotice", label: isDeferred ? deferredLabel : "支払通知書確認", doneAt: row?.payoutNoticeUploadedAt, deferred: isDeferred && invoiceDeferredStepIds.contains("payoutNotice")),
            makeLegacyRoutineStep(id: "payment", label: isDeferred ? deferredLabel : "入金確認", doneAt: row?.paymentConfirmedAt, deferred: isDeferred && invoiceDeferredStepIds.contains("payment")),
            makeLegacyRoutineStep(id: "payout", label: isDeferred ? deferredLabel : "報酬支払い", doneAt: row?.rewardPaidAt, deferred: isDeferred && invoiceDeferredStepIds.contains("payout"))
        ]

        if role == "prev" && steps.allSatisfy(\.isDone) {
            return nil
        }

        return RoutineFlow(
            bizYm: bizYm,
            role: role,
            steps: steps,
            isDeferred: isDeferred,
            hasCycle: row != nil,
            invoiceYm: effectiveInvoiceYm,
            batchTargetYms: batchTargetYms
        )
    }
}

private func makeLegacyRoutineStep(id: String, label: String, doneAt: String?, deferred: Bool) -> RoutineStep {
    let normalizedDoneAt = doneAt?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return RoutineStep(
        stepId: id,
        label: label,
        status: deferred ? "deferred" : (normalizedDoneAt.isEmpty ? "future" : "done"),
        done: !normalizedDoneAt.isEmpty && !deferred,
        doneAt: normalizedDoneAt.isEmpty ? nil : AnyCodable(value: normalizedDoneAt),
        deadline: nil,
        href: nil,
        action: nil,
        deferred: deferred,
        isTappable: !deferred
    )
}

func forceAllStepsDone(in flow: RoutineFlow) -> RoutineFlow {
    RoutineFlow(
        bizYm: flow.bizYm,
        role: flow.role,
        steps: flow.steps.map { $0.markedDone() },
        isDeferred: flow.isDeferred,
        hasCycle: flow.hasCycle,
        invoiceYm: flow.invoiceYm,
        batchTargetYms: flow.batchTargetYms
    )
}

private func makeCTBEstimateStep(
    flow: RoutineFlow,
    estimateYm: String,
    draftDone: Bool,
    reference: RoutineStep?
) -> RoutineStep {
    let baseStatus = reference?.status ?? "current"
    let status: String
    if draftDone {
        status = "done"
    } else if baseStatus == "done" {
        status = "warn"
    } else {
        status = baseStatus
    }

    return RoutineStep(
        stepId: ctbEstimateStepId,
        label: "見積書送付",
        status: status,
        done: draftDone,
        doneAt: nil,
        deadline: ctbEstimateSendDeadline(for: flow),
        href: nil,
        action: estimateYm,
        deferred: false,
        isTappable: true
    )
}

private func adjustedVisibleStep(_ step: RoutineStep, in flow: RoutineFlow, isCTB: Bool) -> RoutineStep {
    switch step.stepId {
    case "budget":
        return step.updated(
            deadline: isCTB ? ctbBudgetDeadline(for: flow) : standardBudgetDeadline(for: flow),
            status: recomputedStatus(for: step, deadline: isCTB ? ctbBudgetDeadline(for: flow) : standardBudgetDeadline(for: flow))
        )
    case "meeting":
        let deadline = standardMeetingDeadline(for: flow)
        return step.updated(deadline: deadline, status: recomputedStatus(for: step, deadline: deadline))
    case "reportFix":
        let deadline = standardReportFixDeadline(for: flow)
        return step.updated(deadline: deadline, status: recomputedStatus(for: step, deadline: deadline))
    case "invoiceIssue":
        let deadline = isCTB ? ctbInvoiceIssueDeadline(for: flow) : standardInvoiceIssueDeadline(for: flow)
        return step.updated(deadline: deadline, status: recomputedStatus(for: step, deadline: deadline))
    case "invoiceSend":
        let deadline = isCTB ? ctbInvoiceSendDeadline(for: flow) : standardInvoiceSendDeadline(for: flow)
        return step.updated(deadline: deadline, status: recomputedStatus(for: step, deadline: deadline))
    case "payoutNotice":
        let deadline = standardPayoutNoticeDeadline(for: flow)
        return step.updated(deadline: deadline, status: recomputedStatus(for: step, deadline: deadline))
    case "payment":
        let deadline = isCTB ? ctbPaymentDeadline(for: flow) : standardPaymentDeadline(for: flow)
        return step.updated(deadline: deadline, status: recomputedStatus(for: step, deadline: deadline))
    case "payout":
        let deadline = isCTB ? ctbPayoutDeadline(for: flow) : standardPayoutDeadline(for: flow)
        return step.updated(deadline: deadline, status: recomputedStatus(for: step, deadline: deadline))
    default:
        return step
    }
}

private func makeReimburseConfirmStep(
    flow: RoutineFlow,
    done: Bool,
    isCTB: Bool,
    reference: RoutineStep?
) -> RoutineStep {
    let deadline = standardReimburseConfirmDeadline(for: flow)
    let baseStatus = reference?.status ?? "future"
    let status = done ? "done" : recomputedPendingStatus(deadline: deadline, fallback: baseStatus)
    return RoutineStep(
        stepId: reimburseConfirmStepId,
        label: "立替精算確認",
        status: status,
        done: done,
        doneAt: nil,
        deadline: deadline,
        href: nil,
        action: "reimburse",
        deferred: false,
        isTappable: true
    )
}

private func standardMeetingDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(flow.bizYm, day: 20)) ?? ""
}

private func standardBudgetDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(prevYmString(from: flow.bizYm), day: 25)) ?? ""
}

private func ctbBudgetDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(prevYmString(from: flow.bizYm), day: 28)) ?? ""
}

private func ctbEstimateSendDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(prevYmString(from: flow.bizYm), day: 28)) ?? ""
}

private func standardReportFixDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(nextYmString(from: flow.bizYm), day: 3)) ?? ""
}

private func standardReimburseConfirmDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(nextYmString(from: flow.bizYm), day: 4)) ?? ""
}

private func standardInvoiceIssueDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(nextYmString(from: flow.bizYm), day: 8)) ?? ""
}

private func ctbInvoiceIssueDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(flow.bizYm, day: 28)) ?? ""
}

private func standardInvoiceSendDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(nextYmString(from: flow.bizYm), day: 9)) ?? ""
}

private func ctbInvoiceSendDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(flow.bizYm, day: 28)) ?? ""
}

private func standardPayoutNoticeDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(nextYmString(from: flow.bizYm), day: 15)) ?? ""
}

private func standardPaymentDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(endOfYmString(nextYmString(from: flow.bizYm))) ?? ""
}

private func standardPayoutDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(nextYmString(from: nextYmString(from: flow.bizYm)), day: 7)) ?? ""
}

private func ctbPaymentDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(endOfYmString(nextYmString(from: flow.bizYm))) ?? ""
}

private func ctbPayoutDeadline(for flow: RoutineFlow) -> String {
    adjustedBusinessDay(ymDayString(nextYmString(from: nextYmString(from: flow.bizYm)), day: 7)) ?? ""
}

private func recomputedStatus(for step: RoutineStep, deadline: String?) -> String {
    if step.isDone { return "done" }
    if step.isDeferred { return "deferred" }
    return recomputedPendingStatus(deadline: deadline, fallback: step.status)
}

private func recomputedPendingStatus(deadline: String?, fallback: String) -> String {
    guard let deadline, let date = dateFromYmd(deadline) else { return fallback }
    let today = Calendar(identifier: .gregorian).startOfDay(for: Date())
    let target = Calendar(identifier: .gregorian).startOfDay(for: date)
    let daysLeft = Calendar(identifier: .gregorian).dateComponents([.day], from: today, to: target).day ?? 0
    if daysLeft < 0 { return "overdue" }
    if daysLeft <= 3 { return "warn" }
    return "future"
}

func nextYmString(from ym: String) -> String {
    guard ym.count == 6,
          let y = Int(ym.prefix(4)),
          let m = Int(ym.suffix(2)) else { return ym }
    let nextM = m == 12 ? 1 : m + 1
    let nextY = m == 12 ? y + 1 : y
    return String(format: "%04d%02d", nextY, nextM)
}

func prevYmString(from ym: String) -> String {
    guard ym.count == 6,
          let y = Int(ym.prefix(4)),
          let m = Int(ym.suffix(2)) else { return ym }
    let prevM = m == 1 ? 12 : m - 1
    let prevY = m == 1 ? y - 1 : y
    return String(format: "%04d%02d", prevY, prevM)
}

func ymDayString(_ ym: String, day: Int) -> String? {
    guard ym.count == 6,
          let y = Int(ym.prefix(4)),
          let m = Int(ym.suffix(2)),
          (1...31).contains(day) else { return nil }
    return String(format: "%04d-%02d-%02d", y, m, day)
}

func endOfYmString(_ ym: String) -> String? {
    guard ym.count == 6,
          let y = Int(ym.prefix(4)),
          let m = Int(ym.suffix(2)) else { return nil }
    var comps = DateComponents()
    comps.year = y
    comps.month = m + 1
    comps.day = 1
    let cal = Calendar(identifier: .gregorian)
    guard let firstOfNext = cal.date(from: comps),
          let lastOfMonth = cal.date(byAdding: .day, value: -1, to: firstOfNext) else { return nil }
    return ymdString(lastOfMonth)
}

private func dateFromYmd(_ ymd: String) -> Date? {
    let parts = ymd.split(separator: "-")
    guard parts.count == 3,
          let y = Int(parts[0]),
          let m = Int(parts[1]),
          let d = Int(parts[2]) else { return nil }
    var comps = DateComponents()
    comps.year = y
    comps.month = m
    comps.day = d
    return Calendar(identifier: .gregorian).date(from: comps)
}

private func ymdString(_ date: Date) -> String {
    let comps = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", comps.year ?? 0, comps.month ?? 0, comps.day ?? 0)
}

func adjustedBusinessDay(_ ymd: String?) -> String? {
    guard var date = ymd.flatMap(dateFromYmd) else { return nil }
    let cal = Calendar(identifier: .gregorian)
    while cal.isDateInWeekend(date) {
        guard let previous = cal.date(byAdding: .day, value: -1, to: date) else { break }
        date = previous
    }
    return ymdString(date)
}

func ctbEstimateMarkerLinesJSON() -> String {
    #"[\{"type":"text","description":"\#(ctbEstimateDoneMarkerDescription)"}]"#
}

func stripCTBEstimateMarker(from rawJson: String?) -> String? {
    guard let rawJson, !rawJson.isEmpty else { return rawJson }
    guard let data = rawJson.data(using: .utf8),
          let array = try? JSONDecoder().decode([[String: AnyCodable]].self, from: data) else {
        return rawJson
    }
    let filtered = array.filter { row in
        let desc = row["description"]?.value as? String
        return desc != ctbEstimateDoneMarkerDescription
    }
    guard let outputData = try? JSONSerialization.data(withJSONObject: filtered),
          let output = String(data: outputData, encoding: .utf8) else {
        return rawJson
    }
    return output
}

// MARK: - BillingBudgetData (Step 1: 予算確定)

struct BillingBudgetData: Decodable {
    let ok: Bool
    let projectId: String?
    let ym: String?
    let projectName: String?
    let feeType: String?              // "fixed" | "variable" | etc.
    let feeAmount: Double?
    let status: String?               // "draft" | "reported" | "budget_confirmed" | "allocation_confirmed"
    let budgetReportedAmount: Double? // 請求額（PMが申告）
    let budgetBufferAmount: Int?      // バッファ（PMが申告、任意）
    let budgetReportedAt: String?
    let budgetReportedBy: String?
    let budgetConfirmedAt: String?
    let budgetYen: Double?            // PJ予算（承認後） ← budget_yen カラム
    let memberAllocationsJson: [String: Int]? // メンバー配賦額 {"ID001": 50000, ...}
    let message: String?
}

struct ReportBudgetResult: Decodable {
    let ok: Bool
    let message: String?
}

// MARK: - ProjectMember (メンバー情報)

struct ProjectMember: Decodable, Identifiable {
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

// MARK: - MeetingSlotsData (Step 2: 報告会日程調整)

struct MeetingSlotsData: Decodable {
    let ok: Bool
    let slots: [MeetingSlot]?
    let message: String?
}

struct MeetingSlot: Decodable, Identifiable {
    var id: String { startISO }
    let startISO: String
    let endISO: String
    let label: String   // "4/15(水) 10:00" 形式
}

struct ScheduleMeetingResult: Decodable {
    let ok: Bool
    let message: String?
}

// MARK: - MonthlyReportData (Step 3: 月次報告書FIX)

struct MonthlyReportData: Decodable {
    let success: Bool
    let exists: Bool
    let report: MonthlyReportContent?
    let error: String?
}

struct MonthlyReportContent: Decodable {
    let reportId: String?
    let projectId: String?
    let ym: String?
    let draftContent: String?
    let finalContent: String?
    let status: String?
    let generatedAtJst: String?
    let approvedAtJst: String?
    let submittedAtJst: String?
}

struct FixReportResult: Decodable {
    let ok: Bool
    let fixedAt: String?
    let message: String?
}

struct RequestReportEditResult: Decodable {
    let ok: Bool
    let message: String?
}

// MARK: - InvoicePreviewData (Step 4: 請求書発行)

struct InvoicePreviewData: Decodable {
    let ok: Bool
    let projectId: String?
    let ym: String?
    let projectName: String?
    let baseLines: [InvoiceBaseLine]?
    let reimbItems: [InvoiceReimbItem]?
    let reimbYen: Double?
    let gross: Double?
    let suggestedIssueDate: String?
    let suggestedDueDate: String?
    let invoiceSubject: String?
    let fromPrevMonth: Bool?
    let issuedAt: String?
    let freeeInvoiceNumber: String?
    let invoicePdfUrl: String?
    let message: String?
}

struct InvoiceBaseLine: Decodable {
    let type: String?
    let description: String
    let quantity: Double
    let unit_price: Double
}

struct InvoiceReimbItem: Decodable {
    let description: String?
    let amount: Double?
    let date: String?
    let category: String?
}

struct IssueInvoiceResult: Decodable {
    let ok: Bool
    let freeeInvoiceId: String?
    let freeeInvoiceNumber: String?
    let invoicePdfUrl: String?
    let gross: Double?
    let reimbYen: Double?
    let message: String?
}

struct SaveInvoiceDraftResult: Decodable {
    let ok: Bool
    let message: String?
}

struct CancelInvoiceResult: Decodable {
    let ok: Bool
    let message: String?
}

// MARK: - MarkInvoiceSentResult (Step 5: 請求書送付)

struct MarkInvoiceSentResult: Decodable {
    let ok: Bool
    let sentAt: String?
    let message: String?
}

// MARK: - AnyCodable

/// GASが返すany値（文字列・数値・null）を安全に保持するラッパー
struct AnyCodable: Decodable {
    let value: Any?

    init(value: Any?) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            value = nil
        } else if let s = try? c.decode(String.self) {
            value = s
        } else if let n = try? c.decode(Double.self) {
            value = n
        } else if let b = try? c.decode(Bool.self) {
            value = b
        } else {
            value = nil
        }
    }

    /// 表示用文字列（日付 "2026-04-10T..." → "4/10" に整形）
    var displayString: String? {
        guard let s = value as? String, !s.isEmpty, s != "done", s != "skipped" else { return nil }
        // ISO8601 → M/d
        if s.count >= 10, s.contains("-") {
            let parts = s.prefix(10).split(separator: "-")
            if parts.count == 3, let m = Int(parts[1]), let d = Int(parts[2]) {
                return "\(m)/\(d)"
            }
        }
        return s
    }
}

// MARK: - Monthly Report Revision (つくよみ修正フロー)

struct MonthlyReportRevisionResult: Decodable {
    let ok: Bool
    let revisionId: String?
    let revisedContent: String?
    let llmUsed: Bool?
    let error: String?
    enum CodingKeys: String, CodingKey {
        case ok, error
        case revisionId = "revision_id"
        case revisedContent = "revised_content"
        case llmUsed = "llm_used"
    }
}

enum HunkType: Equatable {
    case unchanged
    case insert
    case delete
    case replace
}

enum HunkStatus {
    case pending
    case approved
    case rejected
}

struct ReportHunk: Identifiable {
    let id: UUID
    let type: HunkType
    let beforeText: String?
    let afterText: String?
    var status: HunkStatus = .pending
    var rejectionReason: String = ""

    init(type: HunkType, beforeText: String? = nil, afterText: String? = nil) {
        self.id = UUID()
        self.type = type
        self.beforeText = beforeText
        self.afterText = afterText
    }
}

// MARK: - TsukuyomiLearnings

struct TsukuyomiLearningRow: Identifiable {
    let id: String
    let scope: String
    let scopeKey: String?
    let content: String
    let source: String?
    let sourceRef: String?
    let status: String
    let createdAt: String?
    let createdBy: String?
    let removedAt: String?
    let removedReason: String?

    var isActive: Bool { status == "active" }

    var sourceLabel: String {
        switch source {
        case "rejection_reason": return "却下理由"
        case "admin_unlearn":    return "覚えないで"
        case "auto":             return "自動"
        default:                 return source ?? "不明"
        }
    }

    var scopeDisplayLabel: String {
        switch scope {
        case "monthlyReport": return "月次レポート"
        case "msActivity":    return "MS活動"
        case "meta":          return "メタ"
        default:              return scope
        }
    }
}
