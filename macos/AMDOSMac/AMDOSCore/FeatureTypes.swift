import Foundation

enum AMDOSFeatureLoadState: Equatable, Sendable {
    case idle
    case loading
    case loaded
    case empty
    case failed(String)
}

struct AMDOSDashboardData: Sendable {
    var projects: [AMDOSProject] = []
    var managementScores: [AMDOSManagementScore] = []
    var scoreInputs: [AMDOSScoreInput] = []
    var proactiveTodos: [AMDOSProactiveTodo] = []
    var actionItems: [AMDOSActionItem] = []
    var authorityError: String?
}

struct AMDOSProjectMember: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let memberId: String
    let role: String?
    let roleLabel: String?
    let isActive: Bool
    let isPm: Bool
    let isPl: Bool

    enum CodingKeys: String, CodingKey { case id, projectId = "project_id", memberId = "member_id", role, roleLabel = "role_label", isActive = "is_active", isPm = "is_pm", isPl = "is_pl" }
}

struct AMDOSBillingCycle: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let ym: String
    let budgetYen: Int?
    let status: String
    let meetingStartAt: String?
    let reportFixedAt: String?
    let invoiceSentAt: String?
    let paymentConfirmedAt: String?
    let invoiceIssuedAt: String?
    let rewardPaidAt: String?
    let freeeInvoiceNumber: String?

    enum CodingKeys: String, CodingKey {
        case id, projectId = "project_id", ym, budgetYen = "budget_yen", status, meetingStartAt = "meeting_start_at", reportFixedAt = "report_fixed_at", invoiceSentAt = "invoice_sent_at", paymentConfirmedAt = "payment_confirmed_at", invoiceIssuedAt = "invoice_issued_at", rewardPaidAt = "reward_paid_at", freeeInvoiceNumber = "freee_invoice_number"
    }
}

struct AMDOSValuePlan: Codable, Identifiable, Sendable {
    let id: String
    let planCycleId: String
    let projectId: String
    let status: String
    let budgetYen: Int
    let totalPoints: Int
    let periodStartYm: String
    let periodEndYm: String
    enum CodingKeys: String, CodingKey { case id, planCycleId = "plan_cycle_id", projectId = "project_id", status, budgetYen = "budget_yen", totalPoints = "total_points", periodStartYm = "period_start_ym", periodEndYm = "period_end_ym" }
}

struct AMDOSMilestone: Codable, Identifiable, Sendable {
    let id: String
    let milestoneId: String
    let planCycleId: String
    let title: String
    let points: Int
    let tag: String
    let goalLevel: String?
    let isActive: Bool
    let successCriteria: String?
    let sortOrder: Int
    let targetYm: String?
    enum CodingKeys: String, CodingKey { case id, milestoneId = "milestone_id", planCycleId = "plan_cycle_id", title, points, tag, goalLevel = "goal_level", isActive = "is_active", successCriteria = "success_criteria", sortOrder = "sort_order", targetYm = "target_ym" }
}

struct AMDOSMilestoneProgress: Codable, Identifiable, Sendable {
    let id: String
    let milestoneKey: String
    let ym: String
    let progressPct: Double?
    let consumedPt: Double?
    let source: String?
    let note: String?
    let confirmedAt: String?
    enum CodingKeys: String, CodingKey { case id, milestoneKey = "milestone_key", ym, progressPct = "progress_pct", consumedPt = "consumed_pt", source, note, confirmedAt = "confirmed_at" }
}

struct AMDOSStrategySignal: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let signalType: String?
    let title: String?
    let body: String?
    let status: String?
    let createdAt: String?
    enum CodingKeys: String, CodingKey { case id = "signal_id", projectId = "project_id", signalType = "signal_type", title, body = "summary", status, createdAt = "created_at" }
}

struct AMDOSMeetingSummary: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let meetingDate: String?
    let title: String?
    let summary: String?
    let status: String?
    let createdAt: String?
    enum CodingKeys: String, CodingKey { case id = "meeting_id", projectId = "project_id", meetingDate = "meeting_date", title, summary = "summary_short", status = "prep_status", createdAt = "created_at" }
}

struct AMDOSXrlEvidence: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let title: String?
    let body: String?
    let status: String?
    let evidenceType: String?
    let createdAt: String?
    enum CodingKeys: String, CodingKey { case id = "evidence_id", projectId = "project_id", title = "axis", body = "summary", status, evidenceType = "evidence_kind", createdAt = "created_at" }
}

struct AMDOSScoreInput: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let evaluatedAt: String
    let muA: Double?
    let muI: Double?
    let muG: Double?
    let trl: Double?
    let brl: Double?
    let grl: Double?
    let srl: Double?
    let hrl: Double?
    let frl: Double?
    let prsPotential: Double?
    let prsRNet: Double?
    let xrlNotes: String?
    let frlNotes: String?
    enum CodingKeys: String, CodingKey { case id, projectId = "project_id", evaluatedAt = "evaluated_at", muA = "mu_a", muI = "mu_i", muG = "mu_g", trl, brl, grl, srl, hrl, frl, prsPotential = "prs_potential", prsRNet = "prs_r_net", xrlNotes = "xrl_notes", frlNotes = "frl_notes" }
}

struct AMDOSProjectDocument: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let fileName: String
    let mimeType: String
    let fileSizeBytes: Int64
    let uploadStatus: String
    let createdAt: String
    enum CodingKeys: String, CodingKey { case id = "document_id", projectId = "project_id", fileName = "file_name", mimeType = "mime_type", fileSizeBytes = "file_size_bytes", uploadStatus = "upload_status", createdAt = "created_at" }
}

struct AMDOSReimbursement: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let projectName: String?
    let date: String
    let category: String
    let amount: Double
    let taxRate: Double
    let description: String?
    let transportMode: String?
    let transportFrom: String?
    let transportTo: String?
    let transportTrip: String?
    let status: String
    let createdBy: String
    let pmApprovedBy: String?
    let pmApprovedAt: String?
    let adminApprovedBy: String?
    let adminApprovedAt: String?
    let receiptStoragePaths: [String]?
    let receiptFileNames: [String]?
    enum CodingKeys: String, CodingKey { case id = "reimbursement_id", projectId = "project_id", projectName = "project_name", date, category, amount, taxRate = "tax_rate", description, transportMode = "transport_mode", transportFrom = "transport_from", transportTo = "transport_to", transportTrip = "transport_trip", status, createdBy = "created_by", pmApprovedBy = "pm_approved_by", pmApprovedAt = "pm_approved_at", adminApprovedBy = "admin_approved_by", adminApprovedAt = "admin_approved_at", receiptStoragePaths = "receipt_storage_paths", receiptFileNames = "receipt_file_names" }
}

struct AMDOSBusinessCard: Codable, Identifiable, Sendable {
    let id: String
    let name: String?
    let company: String?
    let title: String?
    let email: String?
    let phone: String?
    let status: String?
    let ocrStatus: String?
    let createdAt: String?
    enum CodingKeys: String, CodingKey { case id, name = "full_name", company = "company_name", title = "job_title", email, phone, status, ocrStatus = "ocr_status", createdAt = "created_at" }
}

struct AMDOSAtlasStory: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let summary: String?
    let importance: String?
    let signalCount: Int?
    let startedAt: String?
    let lastUpdatedAt: String?
    let tags: [String]?
    enum CodingKeys: String, CodingKey { case id, title, summary, importance, signalCount = "signal_count", startedAt = "started_at", lastUpdatedAt = "last_updated_at", tags }
}

struct AMDOSAtlasSignal: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let content: String
    let sourceUrl: String?
    let sourceType: String?
    let domain: String?
    let importance: String?
    let status: String
    let storyId: String?
    let submittedAt: String?
    let suggestedTags: [String]?
    enum CodingKeys: String, CodingKey { case id, title, content, sourceUrl = "source_url", sourceType = "source_type", domain, importance, status, storyId = "story_id", submittedAt = "submitted_at", suggestedTags = "suggested_tags" }
}

struct AMDOSSeed: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let orgName: String
    let researcherName: String?
    let labName: String?
    let summary: String?
    let domainLane: String?
    let status: String
    let discoveryStatus: String?
    let amdRating: Int?
    let trl: Int?
    let amdOwnerMemberId: String?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id, title, orgName = "org_name", researcherName = "researcher_name", labName = "lab_name", summary, domainLane = "domain_lane", status, discoveryStatus = "discovery_status", amdRating = "amd_rating", trl, amdOwnerMemberId = "amd_owner_member_id", updatedAt = "updated_at" }
}

struct AMDOSSeedFunding: Codable, Identifiable, Sendable {
    let id: String
    let seedId: String
    let program: String
    let programShort: String?
    let amountJpy: Double?
    let status: String?
    let fiscalYear: Int?
    enum CodingKeys: String, CodingKey { case id, seedId = "seed_id", program, programShort = "program_short", amountJpy = "amount_jpy", status, fiscalYear = "fiscal_year" }
}

struct AMDOSSeedNews: Codable, Identifiable, Sendable {
    let id: String
    let seedId: String
    let title: String
    let kind: String
    let occurredOn: String?
    let dismissed: Bool
    enum CodingKeys: String, CodingKey { case id, seedId = "seed_id", title, kind, occurredOn = "occurred_on", dismissed }
}

struct AMDOSVC: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let nameEn: String?
    let type: String?
    let thesis: String?
    let stageFocus: [String]?
    let ticketMinJpy: Double?
    let ticketMaxJpy: Double?
    let amdRating: Int?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id, name, nameEn = "name_en", type, thesis, stageFocus = "stage_focus", ticketMinJpy = "ticket_min_jpy", ticketMaxJpy = "ticket_max_jpy", amdRating = "amd_rating", updatedAt = "updated_at" }
}

struct AMDOSVCFund: Codable, Identifiable, Sendable {
    let id: String
    let vcId: String
    let fundNo: Int
    let name: String?
    let sizeJpy: Double?
    let status: String
    let vintageYear: Int?
    let dryPowderLow: Double?
    let dryPowderHigh: Double?
    enum CodingKeys: String, CodingKey { case id, vcId = "vc_id", fundNo = "fund_no", name, sizeJpy = "size_jpy", status, vintageYear = "vintage_year", dryPowderLow = "dry_powder_jpy_low", dryPowderHigh = "dry_powder_jpy_high" }
}

struct AMDOSVCContact: Codable, Identifiable, Sendable {
    let id: String
    let vcId: String
    let name: String
    let role: String?
    let email: String?
    let phone: String?
    let notes: String?
    enum CodingKeys: String, CodingKey { case id, vcId = "vc_id", name, role, email, phone, notes }
}

struct AMDOSVCNews: Codable, Identifiable, Sendable {
    let id: String
    let vcId: String
    let title: String
    let kind: String
    let occurredOn: String?
    let verified: Bool?
    let dismissed: Bool?
    enum CodingKeys: String, CodingKey { case id, vcId = "vc_id", title, kind, occurredOn = "occurred_on", verified, dismissed }
}

struct AMDOSInstitution: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let type: String
    let region: String?
    let description: String?
    enum CodingKeys: String, CodingKey { case id = "institution_id", name, type, region, description }
}

struct AMDOSInstitutionAxis: Codable, Identifiable, Sendable {
    let id: String
    let axisNo: Int
    let name: String
    let sortOrder: Int
    let correspondsXrl: String?
    enum CodingKeys: String, CodingKey { case id = "axis_id", axisNo = "axis_no", name, sortOrder = "sort_order", correspondsXrl = "corresponds_xrl" }
}

struct AMDOSInstitutionAssessment: Codable, Identifiable, Sendable {
    let id: String
    let institutionId: String
    let criterionId: String?
    let level: Int?
    let note: String?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id = "assessment_id", institutionId = "institution_id", criterionId = "criterion_id", level, note, updatedAt = "updated_at" }
}

struct AMDOSManagementScore: Codable, Identifiable, Sendable {
    let id: String?
    let ym: String
    let totalScore: Double?
    let initiativeScore: Double?
    let financeScore: Double?
    let retentionScore: Double?
    let pipelineScore: Double?
    let directionScore: Double?
    let confidence: Double?
    let summary: String?
    enum CodingKeys: String, CodingKey { case id, ym, totalScore = "total_score", initiativeScore = "initiative_score", financeScore = "finance_score", retentionScore = "retention_score", pipelineScore = "pipeline_score", directionScore = "direction_score", confidence, summary }
}

struct AMDOSProactiveTodo: Codable, Identifiable, Sendable {
    let id: String
    let projectID: String
    let triggerKind: String
    let title: String
    let detail: String?
    let ballOwner: String
    let status: String
    let priority: String
    let dueAt: String
    let resolvedNote: String?
    enum CodingKeys: String, CodingKey {
        case id, projectID = "project_id", triggerKind = "trigger_kind", title, detail
        case ballOwner = "ball_owner", status, priority, dueAt = "due_at", resolvedNote = "resolved_note"
    }
}

struct AMDOSActionItem: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let summary: String?
    let status: String
    let priority: String?
    let dueAt: String?
    let projectId: String?
    enum CodingKeys: String, CodingKey { case id = "action_id", title, summary, status, priority, dueAt = "due_at", projectId = "project_id" }
}

struct AMDOSNotificationCandidate: Codable, Identifiable, Sendable {
    let id: String
    let kind: String
    let title: String
    let body: String?
    let projectId: String?
    let targetId: String?
    let scopeKey: String?
    let readAt: String?
    let createdAt: String?
    enum CodingKeys: String, CodingKey { case id = "notification_id", kind, title, body, projectId = "project_id", targetId = "target_id", scopeKey = "scope_key", readAt = "read_at", createdAt = "created_at" }
}

struct AMDOSAgreementResponse: Codable, Sendable {
    let ok: Bool
    let bundle: AMDOSAgreementBundle?
    let error: String?
}

struct AMDOSAgreementBundle: Codable, Sendable {
    let ym: String
    let member: AMDOSAgreementMember?
    let status: String
    let currentHash: String
    let latestAgreement: AMDOSAgreementRecord?
    let tableReady: Bool
    let canAgree: Bool
    let exclusionReason: String?
    let snapshot: AMDOSAgreementSnapshot
    let revisionRequests: [AMDOSAgreementRevisionRecord]
    enum CodingKeys: String, CodingKey { case ym, member, status, currentHash, latestAgreement, tableReady, canAgree, exclusionReason, snapshot, revisionRequests }
}

struct AMDOSAgreementSnapshot: Codable, Sendable {
    let schemaVersion: String?
    let ym: String?
    let member: AMDOSAgreementMember
    let projects: [AMDOSAgreementProject]
    let totals: AMDOSAgreementTotals
}

struct AMDOSAgreementMember: Codable, Sendable {
    let memberId: String
    let codeName: String
    let email: String?
    let isAdmin: Bool?
    let excludeFromPayoutNotice: Bool?
    enum CodingKeys: String, CodingKey { case memberId, codeName, email, isAdmin, excludeFromPayoutNotice }
}

struct AMDOSAgreementTotals: Codable, Sendable {
    let expectedRewardYen: Double
    let stockYen: Double
    let paidActualYen: Double?
    let unverifiedPaidYen: Double?
    let futurePayoutYen: Double?
    let projectCount: Int
    let reviewRequiredCount: Int
    enum CodingKeys: String, CodingKey { case expectedRewardYen, stockYen, paidActualYen, unverifiedPaidYen, futurePayoutYen, projectCount, reviewRequiredCount }
}
struct AMDOSAgreementProject: Codable, Identifiable, Sendable {
    let projectId: String
    let projectName: String
    let projectStatus: String?
    let roleLabel: String?
    let isPm: Bool?
    let isPl: Bool?
    let billingStatus: String?
    let allocationStatus: String?
    let expectedRewardYen: Double?
    let payoutYen: Double?
    let currentCyclePayoutYen: Double?
    let paymentYm: String?
    let stockYen: Double?
    let grossDueYen: Double?
    let carryInYen: Double?
    let earnedPt: Double?
    let conditionState: String
    let conditions: [String]
    let reviewReasons: [String]
    let milestones: [AMDOSAgreementMilestone]
    let payoutSchedule: [AMDOSAgreementPayoutScheduleEntry]
    let routineExpectations: [String]
    enum CodingKeys: String, CodingKey { case projectId, projectName, projectStatus, roleLabel, isPm, isPl, billingStatus, allocationStatus, expectedRewardYen, payoutYen, currentCyclePayoutYen, paymentYm, stockYen, grossDueYen, carryInYen, earnedPt, conditionState, conditions, reviewReasons, milestones, payoutSchedule, routineExpectations }
    var id: String { projectId }
}
struct AMDOSAgreementMilestone: Codable, Identifiable, Sendable {
    let milestoneId: String
    let title: String
    let points: Int
    let plannedShare: Double?
    let role: String?
    let taskDescription: String?
    let progressPct: Double?
    let monthlyProgressPct: Double?
    let expectedRewardYen: Double?
    let earnedPt: Double?
    let conditions: [String]
    let state: String
    enum CodingKeys: String, CodingKey { case milestoneId, title, points, plannedShare, role, taskDescription, progressPct, monthlyProgressPct, expectedRewardYen, earnedPt, conditions, state }
    var id: String { milestoneId }
}

struct AMDOSAgreementPayoutScheduleEntry: Codable, Identifiable, Sendable {
    let sourceYm: String
    let paymentYm: String
    let status: String?
    let basePayYen: Double
    let carryInYen: Double
    let grossDueYen: Double
    let totalPayYen: Double
    let totalPayTaxIncludedYen: Double
    let stockYen: Double
    let isCurrentYm: Bool
    let isProtected: Bool
    let isActualPaid: Bool
    let amountSource: String
    var id: String { "\(sourceYm)-\(paymentYm)-\(amountSource)" }
}

struct AMDOSAgreementRecord: Codable, Identifiable, Sendable {
    let id: String
    let ym: String
    let memberId: String
    let status: String
    let agreedAt: String?
    let agreedBy: String?
    let snapshotHash: String
    let currentHash: String?
    let invalidatedAt: String?
    let invalidationReason: String?
    enum CodingKeys: String, CodingKey { case id, ym, memberId, status, agreedAt, agreedBy, snapshotHash, currentHash, invalidatedAt, invalidationReason }
}

struct AMDOSAgreementRevisionRecord: Codable, Identifiable, Sendable {
    let id: String
    let ym: String?
    let memberId: String?
    let projectId: String?
    let requestType: String
    let body: String
    let status: String
    let snapshotHash: String?
    let createdAt: String
    let resolvedAt: String?
    enum CodingKeys: String, CodingKey { case id, ym, memberId, projectId, requestType, body, status, snapshotHash, createdAt, resolvedAt }
}

struct AMDOSAPIStatus: Codable, Sendable { let ok: Bool?; let error: String? }

struct AMDOSL2Notification: Codable, Identifiable, Sendable {
    let id: String
    let kind: String
    let targetId: String
    let scopeKey: String
    let title: String
    let summary: String?
    let importance: Int
    let readAt: String?
    let createdAt: String
    enum CodingKeys: String, CodingKey { case id = "notification_id", kind = "l2_kind", targetId = "target_id", scopeKey = "scope_key", title, summary, importance, readAt = "read_at", createdAt = "created_at" }
}
struct AMDOSMeetingNotification: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let title: String
    let summary: String
    let readAt: String?
    let createdAt: String
    enum CodingKeys: String, CodingKey { case id = "meeting_id", projectId = "project_id", title, summary = "summary_short", readAt = "read_at", createdAt = "created_at" }
}
struct AMDOSAppNotification: Codable, Identifiable, Sendable {
    let id: String
    let kind: String
    let title: String
    let body: String?
    let readAt: String?
    let dismissedAt: String?
    let createdAt: String
    enum CodingKeys: String, CodingKey { case id, kind, title, body, readAt = "read_at", dismissedAt = "dismissed_at", createdAt = "created_at" }
}

struct AMDOSMonthlyReport: Codable, Identifiable, Sendable {
    let id: String
    let reportId: String
    let projectId: String
    let ym: String
    let draftContent: String?
    let finalContent: String?
    let status: String?
    let generatedAt: String?
    let fixedAt: String?
    enum CodingKeys: String, CodingKey { case id, reportId = "report_id", projectId = "project_id", ym, draftContent = "draft_content", finalContent = "final_content", status, generatedAt = "generated_at", fixedAt = "fixed_at" }
}

struct AMDOSMaterialSource: Codable, Hashable, Identifiable, Sendable {
    let label: String
    let href: String
    let asOf: String
    var id: String { "\(label)::\(href)" }
}

struct AMDOSMaterialSupplyDemand: Codable, Hashable, Sendable {
    let direction: String
    let severity: Int
    let cause: String
    let bottleneck: String
    let asOf: String
    let confidence: String
}

struct AMDOSMaterialMarketPoint: Codable, Hashable, Sendable {
    let period: String
    let value: Double
}

struct AMDOSMaterialSupplyShare: Codable, Hashable, Sendable {
    let country: String
    let share: Double
}

struct AMDOSMaterialMarket: Codable, Hashable, Sendable {
    let benchmark: String
    let unit: String
    let series: [AMDOSMaterialMarketPoint]
    let note: String
    let supplyBasis: String
    let supplyShares: [AMDOSMaterialSupplyShare]
    let source: AMDOSMaterialSource
}

struct AMDOSMaterialManufacturing: Codable, Hashable, Sendable {
    let feedstock: String
    let process: String
}

/// `pwa/src/lib/materials-data.ts` の MaterialDetail と同じ読取モデル。
/// Swift 側で要約用に間引かず、材料詳細・比較・元データの根拠を同じJSONから扱う。
struct AMDOSMaterialItem: Codable, Identifiable, Sendable {
    let id: String?
    let name: String?
    let symbol: String?
    let code: String?
    let category: String?
    let family: String?
    let summary: String?
    let uses: [String]?
    let amdFitNote: String?
    let scores: [String: Int]?
    let atomicNumber: Int?
    let properties: [String]?
    let supplyCountries: [String]?
    let reserves: String?
    let balance: String?
    let circularity: String?
    let chain: [String]?
    let scoreReasons: [String: String]?
    let supplyDemand: AMDOSMaterialSupplyDemand?
    let sources: [AMDOSMaterialSource]?
    let lastReviewed: String?
    let market: AMDOSMaterialMarket?
    let manufacturing: AMDOSMaterialManufacturing?
    enum CodingKeys: String, CodingKey {
        case id, name, symbol, code, category, family, summary, uses, amdFitNote, scores, atomicNumber
        case properties, supplyCountries, reserves, balance, circularity, chain, scoreReasons, supplyDemand, sources, lastReviewed, market, manufacturing
    }
    var stableID: String { id ?? symbol ?? code ?? name ?? UUID().uuidString }
}

/// PWAの ELEMENTS は MaterialDetail ではなく、118元素の座標と必要時の詳細を持つ。
struct AMDOSMaterialElement: Codable, Identifiable, Sendable {
    let atomicNumber: Int
    let symbol: String
    let name: String
    let group: Int?
    let period: Int
    let displayColumn: Int
    let displayRow: Int
    let category: String
    let glanceUse: String?
    let supplyAlert: String?
    let detail: AMDOSMaterialItem?
    var id: String { "element-\(atomicNumber)" }
}

struct AMDOSMaterialsResponse: Codable, Sendable {
    let ok: Bool?
    let elements: [AMDOSMaterialElement]
    let minerals: [AMDOSMaterialItem]
    let polymers: [AMDOSMaterialItem]
    let materials: [AMDOSMaterialItem]
}

struct AMDOSHUDResponse: Codable, Sendable {
    let ok: Bool
    let ym: String?
    let projects: [AMDOSHUDProject]
    let billingStatus: [String: AMDOSHUDBillingStatus]
    let scoreHistory: [String: [Double]]
    let signalMetrics: [String: AMDOSHUDSignalMetrics]
    let primarySnapshots: [String: AMDOSHUDPrimarySnapshot]?
    let managementScore: AMDOSManagementScore?
    let managementHistory: [AMDOSManagementScore]
    let actionItems: [AMDOSActionItem]
    enum CodingKeys: String, CodingKey { case ok, ym, projects, billingStatus, scoreHistory, signalMetrics, primarySnapshots, managementScore, managementHistory, actionItems }
}
struct AMDOSHUDProject: Codable, Identifiable, Sendable {
    let projectId: String
    let projectName: String
    let clientName: String?
    let status: String?
    let startYm: String?
    let endYm: String?
    let displayName: String?
    let shortLabel: String?
    let roleLine: String?
    let projectCategory: String?
    let projectType: String?
    enum CodingKeys: String, CodingKey { case projectId, projectName, clientName, status, startYm, endYm, displayName, shortLabel, roleLine, projectCategory, projectType }
    var id: String { projectId }
}
struct AMDOSHUDPrimarySnapshot: Codable, Sendable {
    let score: Double?
    let status: String
    let missingAxes: [String]
    let legacyScore: Double?
    let components: AMDOSHUDPrimaryComponents
}
struct AMDOSHUDPrimaryComponents: Codable, Sendable {
    let macro: Double?
    let potential: Double?
    let reach: Double?
    let survival: Double?
}
struct AMDOSHUDBillingStatus: Codable, Sendable {
    let ym: String?
    let status: String?
    let budgetYen: Double?
    let meetingDone: Bool?
    let reportDone: Bool?
    let budgetDone: Bool?
    let allocationDone: Bool?
    let invoiceDone: Bool?
    let paymentDone: Bool?
    let billingAmount: Double?
    let invoiceYm: String?
    enum CodingKeys: String, CodingKey { case ym, status, budgetYen, meetingDone, reportDone, budgetDone, allocationDone, invoiceDone, paymentDone, billingAmount, invoiceYm }
}
struct AMDOSHUDSignalMetrics: Codable, Sendable {
    let m: Double
    let x: Double
    let f: Double
}

struct AMDOSVentureRecord: Codable, Identifiable, Sendable {
    let id: String
    let shortLabel: String?
    let lane: String?
    let foundedAt: String?
    let outcomePattern: String?
    let originOrg: String?
    let originPi: String?
    let amdRole: String?
    let shortDescription: String?
    let isPublic: Bool
    enum CodingKeys: String, CodingKey { case id = "project_id", shortLabel = "short_label", lane, foundedAt = "founded_at", outcomePattern = "outcome_pattern", originOrg = "origin_org", originPi = "origin_pi", amdRole = "amd_role", shortDescription = "short_description", isPublic = "is_public" }
}

struct AMDOSVentureXRLLog: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let observedAt: String
    let trl: Double?
    let brl: Double?
    let hrl: Double?
    let grl: Double?
    let srl: Double?
    let bottleneck: String?
    let milestoneLabel: String?
    let sourceNote: String?
    enum CodingKeys: String, CodingKey { case id, projectId = "project_id", observedAt = "observed_at", trl, brl, hrl, grl, srl, bottleneck, milestoneLabel = "milestone_label", sourceNote = "source_note" }
}

struct AMDOSMacroIndexLog: Codable, Identifiable, Sendable {
    let lane: String
    let observedAt: String
    let indexValue: Double
    let policyDensity: Double?
    let rawSignalCount: Int?
    var id: String { "\(lane)-\(observedAt)" }
    enum CodingKeys: String, CodingKey { case lane, observedAt = "observed_at", indexValue = "index_value", policyDensity = "policy_density", rawSignalCount = "raw_signal_count" }
}

struct AMDOSCockpitData: Sendable {
    let project: AMDOSProject
    let members: [AMDOSProjectMember]
    let billing: [AMDOSBillingCycle]
    let plans: [AMDOSValuePlan]
    let milestones: [AMDOSMilestone]
    let progress: [AMDOSMilestoneProgress]
    let strategySignals: [AMDOSStrategySignal]
    let meetings: [AMDOSMeetingSummary]
    let xrlEvidence: [AMDOSVentureXRLLog]
    let scores: [AMDOSScoreInput]
    let documents: [AMDOSProjectDocument]
}

struct AMDOSSeedData: Sendable { let seeds: [AMDOSSeed]; let funding: [AMDOSSeedFunding]; let news: [AMDOSSeedNews] }
struct AMDOSVCData: Sendable { let vcs: [AMDOSVC]; let funds: [AMDOSVCFund]; let contacts: [AMDOSVCContact]; let news: [AMDOSVCNews] }
struct AMDOSInstitutionData: Sendable { let institutions: [AMDOSInstitution]; let axes: [AMDOSInstitutionAxis]; let assessments: [AMDOSInstitutionAssessment] }
struct AMDOSAtlasData: Sendable { let stories: [AMDOSAtlasStory]; let signals: [AMDOSAtlasSignal] }

struct AMDOSAdminLedgerData: Sendable {
    let projects: [AMDOSProject]
    let members: [AMDOSMember]
    let billing: [AMDOSBillingCycle]
    let obligations: [AMDOSPaymentObligation]
    let payouts: [AMDOSPayoutNotice]
    let contracts: [AMDOSContract]
    let knowledge: [AMDOSKnowledgeEntry]
}

struct AMDOSMember: Codable, Identifiable, Sendable {
    let id: String
    let codeName: String
    let email: String
    let role: String?
    let status: String
    let isAdmin: Bool
    enum CodingKeys: String, CodingKey { case id = "member_id", codeName = "code_name", email, role, status, isAdmin = "is_admin" }
}

struct AMDOSPaymentObligation: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let amountYen: Double?
    let dueDate: String?
    let status: String
    let vendor: String?
    let note: String?
    enum CodingKeys: String, CodingKey { case id, title, amountYen = "amount_yen", dueDate = "due_date", status, vendor, note }
}

struct AMDOSPayoutNotice: Codable, Identifiable, Sendable {
    let id: String
    let ym: String
    let memberId: String
    let status: String
    let amountYen: Double?
    let sentAt: String?
    enum CodingKeys: String, CodingKey { case id, ym, memberId = "member_id", status, amountYen = "amount_yen", sentAt = "sent_at" }
}

struct AMDOSContract: Codable, Identifiable, Sendable {
    let id: String
    let contractName: String
    let counterparty: String?
    let status: String
    let effectiveFrom: String?
    let effectiveTo: String?
    let sourceRef: String?
    enum CodingKeys: String, CodingKey { case id = "contract_id", contractName = "contract_name", counterparty, status, effectiveFrom = "effective_from", effectiveTo = "effective_to", sourceRef = "source_ref" }
}

struct AMDOSKnowledgeEntry: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let category: String
    let summary: String?
    let body: String?
    let status: String
    let projectId: String?
    enum CodingKeys: String, CodingKey { case id, title, category, summary, body, status, projectId = "project_id" }
}

struct AMDOSReportEntry: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let ym: String
    let body: String?
    let status: String?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id, projectId = "project_id", ym, body, status, updatedAt = "updated_at" }
}

struct AMDOSManualChapter: Identifiable, Sendable {
    let id: String
    let title: String
    let fileName: String
    let content: String
}

// MARK: - Route-owned response and write models

struct AMDOSProjectConfigEntry: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let key: String
    let value: String?
    let updatedAt: String?
    enum CodingKeys: String, CodingKey { case id, projectId = "project_id", key, value, updatedAt = "updated_at" }
}

struct AMDOSActionItemInput: Encodable, Sendable {
    let actionId: String?
    let title: String
    let summary: String?
    let status: String
    let priority: String?
    let dueAt: String?
    let projectId: String?
    enum CodingKeys: String, CodingKey { case actionId = "action_id", title, summary, status, priority, dueAt = "due_at", projectId = "project_id" }
}

struct AMDOSProgressConfirmInput: Encodable, Sendable {
    let projectId: String
    let ym: String
    let milestoneKey: String
    let progressPct: Double
    let note: String?
    enum CodingKeys: String, CodingKey { case projectId, ym, milestoneKey, progressPct, note }
}

struct AMDOSProgressRevisionInput: Encodable, Sendable {
    let projectId: String
    let ym: String
    let milestoneKey: String
    let reason: String
    enum CodingKeys: String, CodingKey { case projectId, ym, milestoneKey, reason }
}

struct AMDOSProgressActionInput: Encodable, Sendable {
    let projectId: String
    let ym: String
    let milestoneKey: String
    let action: String
    let reason: String?
    let newPct: Double?
}

struct AMDOSRevisionRequest: Encodable, Sendable {
    let projectId: String
    let milestoneId: String
    let ym: String
    let requestText: String
    let currentPct: Double
    let currentNote: String
    let milestoneTitle: String
    let revisionId: String?
}

struct AMDOSRevisionUpdate: Encodable, Sendable {
    let revisionId: String
    let action: String
}

struct AMDOSAgreementRequest: Encodable, Sendable {
    let ym: String
    let memberId: String?
    enum CodingKeys: String, CodingKey { case ym, memberId }
}

struct AMDOSAgreementRevisionRequest: Encodable, Sendable {
    let ym: String
    let memberId: String?
    let projectId: String?
    let requestType: String
    let body: String
    enum CodingKeys: String, CodingKey { case ym, memberId, projectId, requestType, body }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(ym, forKey: .ym)
        try container.encodeIfPresent(memberId, forKey: .memberId)
        if let projectId { try container.encode(projectId, forKey: .projectId) }
        else { try container.encodeNil(forKey: .projectId) }
        try container.encode(requestType, forKey: .requestType)
        try container.encode(body, forKey: .body)
    }
}

struct AMDOSReimbursementForm: Encodable, Sendable {
    let mode: String
    let reimbursementId: String?
    let projectId: String
    let projectName: String?
    let date: String
    let category: String
    let amount: String
    let taxRate: String
    let description: String
    let transportMode: String
    let transportFrom: String
    let transportTo: String
    let transportTrip: String
    enum CodingKeys: String, CodingKey { case mode, reimbursementId = "reimbursement_id", projectId = "project_id", projectName = "project_name", date, category, amount, taxRate = "tax_rate", description, transportMode = "transport_mode", transportFrom = "transport_from", transportTo = "transport_to", transportTrip = "transport_trip" }
}

struct AMDOSBusinessCardUpdate: Encodable, Sendable {
    let fullName: String?
    let companyName: String?
    let department: String?
    let jobTitle: String?
    let email: String?
    let phone: String?
    let mobile: String?
    let status: String
    enum CodingKeys: String, CodingKey { case fullName = "full_name", companyName = "company_name", department, jobTitle = "job_title", email, phone, mobile, status }
}

struct AMDOSAtlasSignalInput: Encodable, Sendable {
    let title: String
    let content: String
    let sourceUrl: String?
    let sourceType: String
    let domain: String?
    let importance: String
    let status: String
    enum CodingKeys: String, CodingKey { case title, content, sourceUrl = "source_url", sourceType = "source_type", domain, importance, status }
}

struct AMDOSAtlasAutoTagInput: Encodable, Sendable {
    let title: String
    let content: String
    let domain: String?
}

struct AMDOSAtlasAutoTagResponse: Decodable, Sendable {
    let tags: [String]?
    let importance: String?
}

struct AMDOSAtlasSignalInsert: Encodable, Sendable {
    let title: String
    let content: String
    let sourceUrl: String?
    let sourceType: String
    let domain: String?
    let suggestedTags: [String]
    let importance: String
    let status: String
    enum CodingKeys: String, CodingKey { case title, content, sourceUrl = "source_url", sourceType = "source_type", domain, suggestedTags = "suggested_tags", importance, status }
}

struct AMDOSAtlasSignalReviewPatch: Encodable, Sendable {
    let status: String
    let reviewedAt: String
    enum CodingKeys: String, CodingKey { case status, reviewedAt = "reviewed_at" }
}

struct AMDOSAtlasDecisionInsert: Encodable, Sendable {
    let topicId: String?
    let action: String
    let rationale: String?
    let decidedAt: String
    enum CodingKeys: String, CodingKey { case topicId = "topic_id", action, rationale, decidedAt = "decided_at" }
}

struct AMDOSAtlasFeedbackInput: Encodable, Sendable {
    let l2Kind: String
    let targetId: String
    let scopeKey: String
    let feedbackText: String
    let action: String
    let notificationId: String?
    let meetingId: String?
    enum CodingKeys: String, CodingKey { case l2Kind = "l2_kind", targetId = "target_id", scopeKey = "scope_key", feedbackText = "feedback_text", action, notificationId = "notification_id", meetingId = "meeting_id" }
}

struct AMDOSSeedInput: Encodable, Sendable {
    let id: String?
    let title: String
    let orgName: String
    let summary: String?
    let domainLane: String?
    let status: String
    let discoveryStatus: String?
    let amdRating: Int?
    let trl: Int?
    let amdOwnerMemberId: String?
    enum CodingKeys: String, CodingKey { case id, title, orgName = "org_name", summary, domainLane = "domain_lane", status, discoveryStatus = "discovery_status", amdRating = "amd_rating", trl, amdOwnerMemberId = "amd_owner_member_id" }
}

struct AMDOSVCInput: Encodable, Sendable {
    let id: String?
    let name: String
    let nameEn: String?
    let type: String?
    let thesis: String?
    let stageFocus: [String]?
    let ticketMinJpy: Double?
    let ticketMaxJpy: Double?
    let amdRating: Int?
    enum CodingKeys: String, CodingKey { case id, name, nameEn = "name_en", type, thesis, stageFocus = "stage_focus", ticketMinJpy = "ticket_min_jpy", ticketMaxJpy = "ticket_max_jpy", amdRating = "amd_rating" }
}

struct AMDOSSeedReviewPatch: Encodable, Sendable {
    let discoveryStatus: String
    let updatedAt: String
    enum CodingKeys: String, CodingKey { case discoveryStatus = "discovery_status", updatedAt = "updated_at" }
}

struct AMDOSVCNewsReviewPatch: Encodable, Sendable {
    let verified: Bool?
    let dismissed: Bool?
    let updatedAt: String
    enum CodingKeys: String, CodingKey { case verified, dismissed, updatedAt = "updated_at" }
}

struct AMDOSInstitutionAssessmentInput: Encodable, Sendable {
    let institutionId: String
    let criterionId: String
    let level: Int?
    let na: Bool
    let note: String?
    enum CodingKeys: String, CodingKey { case institutionId = "institution_id", criterionId = "criterion_id", level, na, note }
}

struct AMDOSInstitutionPolicyInput: Encodable, Sendable {
    let institutionId: String
    let policyItemId: String
    let status: String
    let attributeValue: String?
    let evidenceNote: String?
    let sourceType: String
    let sourceUrl: String?
    let sourcePath: String?
    let confirmedAt: String?
    enum CodingKeys: String, CodingKey { case institutionId = "institution_id", policyItemId = "policy_item_id", status, attributeValue = "attribute_value", evidenceNote = "evidence_note", sourceType = "source_type", sourceUrl = "source_url", sourcePath = "source_path", confirmedAt = "confirmed_at" }
}

struct AMDOSProactiveResolveInput: Encodable, Sendable {
    let action: String
    let note: String?
}

struct AMDOSDocumentContentResponse: Codable, Sendable {
    let ok: Bool?
    let content: String?
    let title: String?
    let error: String?
    let kind: String?
    let slug: String?
    let chapters: [String]?
    let chapterMeta: [AMDOSDocumentChapter]?
    let isStub: Bool?

    enum CodingKeys: String, CodingKey {
        case ok, content, title, error, kind, slug, chapters
        case chapterMeta = "chapter_meta"
        case isStub = "is_stub"
    }
}

struct AMDOSDocumentChapter: Codable, Identifiable, Sendable {
    let slug: String
    let title: String
    let summary: String?
    let number: String?
    let groupKey: String?
    let groupLabel: String?
    let groupDescription: String?
    let status: String?
    let level: Int?
    let available: Bool

    var id: String { slug }

    enum CodingKeys: String, CodingKey {
        case slug, title, summary, number, status, level, available
        case groupKey = "group_key"
        case groupLabel = "group_label"
        case groupDescription = "group_description"
    }
}

struct AMDOSManualAskInput: Encodable, Sendable {
    let question: String
    let currentSlug: String?
    enum CodingKeys: String, CodingKey { case question, currentSlug }
}

struct AMDOSManualAskResponse: Codable, Sendable {
    let ok: Bool?
    let answer: String?
    let error: String?
}

struct AMDOSProjectUpdate: Encodable, Sendable {
    let status: String
    let startYm: String?
    let endYm: String?
    let projectType: String?
    let feeType: String?
    let feeAmount: Double?
    enum CodingKeys: String, CodingKey { case status, startYm = "start_ym", endYm = "end_ym", projectType = "project_type", feeType = "fee_type", feeAmount = "fee_amount" }
}

struct AMDOSReportGenerateInput: Encodable, Sendable {
    let projectId: String
    let ym: String
    let feedback: String?
}

struct AMDOSReportFixInput: Encodable, Sendable {
    let projectId: String
    let ym: String
}
