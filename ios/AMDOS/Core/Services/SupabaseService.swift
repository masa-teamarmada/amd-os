import Foundation
import Supabase

/// Supabase への直接アクセスクライアント
/// GAS経由を廃止し、Supabase REST API を直接叩く
actor SupabaseService {
    static let shared = SupabaseService()

    private let client: SupabaseClient

    private init() {
        client = SupabaseClient(
            supabaseURL: URL(string: "https://nbnhrhybjslbawdukvvk.supabase.co")!,
            // anon key — RLS はユーザーセッション JWT で制御する
            supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ibmhyaHlianNsYmF3ZHVrdnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDEzNjUsImV4cCI6MjA5MTAxNzM2NX0.X16kjZlqeUCHKinkiAodSXrI1iQi47Z4dPZxt_Ja4Bg"
        )
    }

    private let edgeFunctionBaseURL = URL(string: "https://nbnhrhybjslbawdukvvk.supabase.co/functions/v1")!
    // Edge Function の JWT ミドルウェアは ES256 非対応のため anon key（HS256）を使用
    // Edge Function は内部で service_role key を使うためユーザー JWT は不要
    private let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ibmhyaHlianNsYmF3ZHVrdnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDEzNjUsImV4cCI6MjA5MTAxNzM2NX0.X16kjZlqeUCHKinkiAodSXrI1iQi47Z4dPZxt_Ja4Bg"

    private func dataWithHardTimeout(for request: URLRequest, seconds: Double) async throws -> (Data, URLResponse) {
        try await withThrowingTaskGroup(of: (Data, URLResponse).self) { group in
            group.addTask {
                let configuration = URLSessionConfiguration.ephemeral
                configuration.waitsForConnectivity = false
                configuration.timeoutIntervalForRequest = seconds
                configuration.timeoutIntervalForResource = seconds
                let session = URLSession(configuration: configuration)
                defer { session.invalidateAndCancel() }
                return try await session.data(for: request)
            }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw NSError(
                    domain: "NetworkTimeout",
                    code: -1001,
                    userInfo: [NSLocalizedDescriptionKey: "通信がタイムアウトしました"]
                )
            }
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }

    // MARK: - Auth

    func signInWithGoogle(idToken: String, accessToken: String? = nil, nonce: String? = nil) async throws {
        try await client.auth.signInWithIdToken(
            credentials: .init(provider: .google, idToken: idToken, accessToken: accessToken, nonce: nonce)
        )
    }

    func currentUserEmail() -> String? {
        client.auth.currentUser?.email
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    func refreshSession() async throws {
        _ = try await client.auth.refreshSession()
    }

    /// 現在のセッションアクセストークンを取得（Edge Function / raw REST 呼び出し用）
    private func accessToken() async throws -> String {
        do {
            return try await client.auth.session.accessToken
        } catch {
            // セッション切れの場合はリフレッシュを試みる
            return try await client.auth.refreshSession().accessToken
        }
    }

    // MARK: - Projects

    /// アクティブプロジェクト一覧を取得（Supabase直接）
    func fetchActiveProjects() async throws -> [SupabaseProject] {
        let response: [SupabaseProject] = try await client.database
            .from("projects")
            .select("project_id, project_name, client_name, status, start_ym, end_ym, project_type")
            .eq("status", value: "active")
            .order("project_id")
            .execute()
            .value
        return response
    }

    // MARK: - Billing Cycle Writes（Supabase直接）

    private func nowISO() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    /// billing_cycles を UPDATE（project_id + ym で絞り込み）
    private func updateCycle<T: Encodable>(_ value: T, projectId: String, ym: String) async throws {
        try await client.database
            .from("billing_cycles")
            .update(value)
            .eq("project_id", value: projectId)
            .eq("ym", value: ym)
            .execute()
    }

    private struct InvoiceSentUpdate: Encodable {
        let invoice_sent_at: String
    }

    private struct ReportFixUpdate: Encodable {
        let report_fixed_at: String
        let report_fixed_by: String
    }

    func markInvoiceSent(projectId: String, ym: String) async throws {
        try await updateCycle(InvoiceSentUpdate(invoice_sent_at: nowISO()),
                              projectId: projectId, ym: ym)
    }

    private struct InvoiceYmUpdate: Encodable {
        let invoice_ym: String
    }

    func updateInvoiceYm(projectId: String, ym: String, invoiceYm: String) async throws {
        try await updateCycle(InvoiceYmUpdate(invoice_ym: invoiceYm),
                              projectId: projectId, ym: ym)
    }

    func fixReport(projectId: String, ym: String, fixedBy: String) async throws {
        try await updateCycle(ReportFixUpdate(report_fixed_at: nowISO(), report_fixed_by: fixedBy),
                              projectId: projectId, ym: ym)
    }

    // MARK: - Routine: Monthly Report（Supabase直読み）

    /// monthly_reports テーブルから報告書を直接取得
    func fetchMonthlyReport(projectId: String, ym: String) async throws -> MonthlyReportData {
        struct MonthlyReportRow: Decodable {
            let reportId: String?
            let projectId: String?
            let ym: String?
            let draftContent: String?
            let finalContent: String?
            let status: String?
            let generatedAt: String?
            enum CodingKeys: String, CodingKey {
                case reportId = "report_id"
                case projectId = "project_id"
                case ym
                case draftContent = "draft_content"
                case finalContent = "final_content"
                case status
                case generatedAt = "generated_at"
            }
        }
        let rows: [MonthlyReportRow] = try await client.database
            .from("monthly_reports")
            .select("report_id, project_id, ym, draft_content, final_content, status, generated_at")
            .eq("project_id", value: projectId)
            .eq("ym", value: ym)
            .execute()
            .value
        guard let row = rows.first else {
            return MonthlyReportData(success: false, exists: false, report: nil, error: "報告書が見つかりません")
        }
        let content = MonthlyReportContent(
            reportId: row.reportId,
            projectId: row.projectId,
            ym: row.ym,
            draftContent: row.draftContent,
            finalContent: row.finalContent,
            status: row.status,
            generatedAtJst: row.generatedAt.flatMap { utcIsoToJstDateString($0) },
            approvedAtJst: nil,
            submittedAtJst: nil
        )
        return MonthlyReportData(success: true, exists: true, report: content, error: nil)
    }

    private nonisolated func utcIsoToJstDateString(_ iso: String) -> String? {
        guard !iso.isEmpty else { return nil }
        var f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = f.date(from: iso)
        if date == nil {
            f.formatOptions = [.withInternetDateTime]
            date = f.date(from: iso)
        }
        guard let d = date else { return String(iso.prefix(10)) }
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd HH:mm"
        fmt.timeZone = TimeZone(identifier: "Asia/Tokyo")
        return fmt.string(from: d)
    }

    // MARK: - Routine: Invoice Preview（Supabase直読み）

    /// billing_cycles + reimbursements から請求書プレビューデータを組み立てる
    func fetchInvoicePreview(
        projectId: String,
        ym: String,
        documentType: BillingDocumentType = .invoice
    ) async throws -> InvoicePreviewData {
        struct CycleRow: Decodable {
            let invoiceBaseLinesJson: String?
            let invoiceSubject: String?
            let freeeInvoiceNumber: String?
            let invoicePdfUrl: String?
            let invoiceIssuedAt: String?
            let budgetYen: Double?
            enum CodingKeys: String, CodingKey {
                case invoiceBaseLinesJson = "invoice_base_lines_json"
                case invoiceSubject = "invoice_subject"
                case freeeInvoiceNumber = "freee_invoice_number"
                case invoicePdfUrl = "invoice_pdf_url"
                case invoiceIssuedAt = "invoice_issued_at"
                case budgetYen = "budget_yen"
            }
        }
        struct ProjectRow: Decodable {
            let projectName: String
            enum CodingKeys: String, CodingKey { case projectName = "project_name" }
        }
        struct ReimbRow: Decodable {
            let description: String?
            let amount: Double?
            let date: String?
            let category: String?
            enum CodingKeys: String, CodingKey { case description, amount, date, category }
        }

        let nextMonthStart = nextMonthStartDate(ym: ym)

        async let cycleResult: [CycleRow] = client.database
            .from("billing_cycles")
            .select("invoice_base_lines_json, invoice_subject, freee_invoice_number, invoice_pdf_url, invoice_issued_at, budget_yen")
            .eq("project_id", value: projectId)
            .eq("ym", value: ym)
            .execute().value
        async let projectResult: [ProjectRow] = client.database
            .from("projects")
            .select("project_name")
            .eq("project_id", value: projectId)
            .execute().value
        async let reimbResult: [ReimbRow] = client.database
            .from("reimbursements")
            .select("description, amount, date, category")
            .eq("project_id", value: projectId)
            .eq("status", value: "approved")
            .gte("date", value: "\(ym.prefix(4))-\(ym.suffix(2))-01")
            .lt("date", value: nextMonthStart)
            .execute().value

        let (cycles, projects, reimbs) = try await (cycleResult, projectResult, reimbResult)
        let cycle = cycles.first
        let projectName = projects.first?.projectName ?? projectId

        // baseLines パース
        var baseLines: [InvoiceBaseLine] = []
        var fromPrevMonth = false
        if let raw = stripCTBEstimateMarker(from: cycle?.invoiceBaseLinesJson), !raw.isEmpty,
           let arr = try? JSONDecoder().decode([[String: AnyCodable]].self, from: Data(raw.utf8)) {
            baseLines = arr.compactMap { d -> InvoiceBaseLine? in
                guard let desc = d["description"]?.value as? String, !desc.isEmpty else { return nil }
                let qty = d["quantity"]?.value as? Double ?? 1
                let price = d["unit_price"]?.value as? Double ?? 0
                let type_ = d["type"]?.value as? String
                return InvoiceBaseLine(type: type_, description: desc, quantity: qty, unit_price: price)
            }
        }
        // 今月データがなければ前月を踏襲
        if baseLines.isEmpty {
            let prevYm = prevMonthYm(ym)
            if let prevCycles: [CycleRow] = try? await client.database
                .from("billing_cycles")
                .select("invoice_base_lines_json, invoice_subject")
                .eq("project_id", value: projectId)
                .eq("ym", value: prevYm)
                .execute().value,
               let raw = stripCTBEstimateMarker(from: prevCycles.first?.invoiceBaseLinesJson), !raw.isEmpty,
               let arr = try? JSONDecoder().decode([[String: AnyCodable]].self, from: Data(raw.utf8)) {
                baseLines = arr.compactMap { d -> InvoiceBaseLine? in
                    guard let desc = d["description"]?.value as? String, !desc.isEmpty else { return nil }
                    let qty = d["quantity"]?.value as? Double ?? 1
                    let price = d["unit_price"]?.value as? Double ?? 0
                    let type_ = d["type"]?.value as? String
                    return InvoiceBaseLine(type: type_, description: desc, quantity: qty, unit_price: price)
                }
                fromPrevMonth = true
            }
        }
        if baseLines.isEmpty {
            let ymY = String(ym.prefix(4))
            let ymM = String(Int(String(ym.suffix(2))) ?? 0)
            baseLines = [InvoiceBaseLine(type: "item", description: "\(ymY)年\(ymM)月分　業務委託費",
                                         quantity: 1, unit_price: cycle?.budgetYen ?? 0)]
        }

        let reimbItems = reimbs.map { r in
            InvoiceReimbItem(description: r.description, amount: r.amount, date: r.date, category: r.category)
        }
        let reimbYen = reimbs.reduce(0.0) { $0 + ($1.amount ?? 0) }

        let issuedAt = documentType == .quotation ? "" : (cycle?.invoiceIssuedAt ?? "")
        let documentNumber = documentType == .quotation ? "" : (cycle?.freeeInvoiceNumber ?? "")
        let pdfUrl = documentType == .quotation ? "" : (cycle?.invoicePdfUrl ?? "")

        return InvoicePreviewData(
            ok: true,
            projectId: projectId,
            ym: ym,
            projectName: projectName,
            baseLines: baseLines,
            reimbItems: reimbItems,
            reimbYen: reimbYen,
            gross: nil,
            suggestedIssueDate: nil,
            suggestedDueDate: nil,
            invoiceSubject: cycle?.invoiceSubject ?? "",
            fromPrevMonth: fromPrevMonth,
            issuedAt: issuedAt,
            freeeInvoiceNumber: documentNumber,
            invoicePdfUrl: pdfUrl,
            message: nil
        )
    }

    /// 請求書下書き保存（freee発行なし、billing_cyclesに直接書き込む）
    func saveInvoiceDraft(
        projectId: String,
        ym: String,
        invoiceSubject: String?,
        allLinesJson: String?,
        documentType: BillingDocumentType = .invoice
    ) async throws {
        var body: [String: Any] = [:]
        if let s = invoiceSubject, !s.isEmpty { body["invoice_subject"] = s }
        let normalizedLinesJson: String?
        if documentType == .quotation {
            normalizedLinesJson = ensureCTBEstimateMarker(in: allLinesJson)
        } else {
            normalizedLinesJson = allLinesJson
        }
        if let j = normalizedLinesJson, !j.isEmpty { body["invoice_base_lines_json"] = j }
        if body.isEmpty { return }
        try await patchBillingCycle(projectId: projectId, ym: ym, body: body)
    }

    // MARK: - Edge Function ヘルパー

    /// Supabase Edge Function を POST で呼び出す汎用ヘルパー
    func callEdgeFunction<T: Decodable>(_ name: String, body: [String: Any]) async throws -> T {
        var request = URLRequest(url: edgeFunctionBaseURL.appendingPathComponent(name))
        request.httpMethod = "POST"
        request.timeoutInterval = 8
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            let body = String(data: data, encoding: .utf8) ?? "(empty)"
            throw NSError(domain: name, code: http.statusCode,
                          userInfo: [NSLocalizedDescriptionKey: "\(name) \(http.statusCode): \(body)"])
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    /// GET パラメータ付き Edge Function 呼び出し
    func callEdgeFunctionGET<T: Decodable>(_ name: String, params: [String: String]) async throws -> T {
        var comps = URLComponents(url: edgeFunctionBaseURL.appendingPathComponent(name), resolvingAgainstBaseURL: false)!
        comps.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        var request = URLRequest(url: comps.url!)
        request.timeoutInterval = 8
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            let body = String(data: data, encoding: .utf8) ?? "(empty)"
            throw NSError(domain: name, code: http.statusCode,
                          userInfo: [NSLocalizedDescriptionKey: "\(name) \(http.statusCode): \(body)"])
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - Private Helpers

    private nonisolated func nextMonthStartDate(ym: String) -> String {
        guard ym.count == 6,
              let y = Int(ym.prefix(4)), let m = Int(ym.suffix(2)) else { return "" }
        let nextM = m >= 12 ? 1 : m + 1
        let nextY = m >= 12 ? y + 1 : y
        return String(format: "%04d-%02d-01", nextY, nextM)
    }

    private nonisolated func prevMonthYm(_ ym: String) -> String {
        guard ym.count == 6,
              let y = Int(ym.prefix(4)), let m = Int(ym.suffix(2)) else { return "" }
        let prevM = m <= 1 ? 12 : m - 1
        let prevY = m <= 1 ? y - 1 : y
        return String(format: "%04d%02d", prevY, prevM)
    }

    // MARK: - Reimbursements（Supabase直接）

    /// 自分の立替一覧を取得（email でフィルタ）
    func fetchReimbursements(email: String) async throws -> [ReimburseItem] {
        let rows: [SupabaseReimburse] = try await client.database
            .from("reimbursements")
            .select()
            .eq("created_by", value: email.lowercased())
            .order("date", ascending: false)
            .execute()
            .value
        return rows.map { $0.toReimburseItem() }
    }

    /// 立替を新規保存。戻り値は生成された reimbursementId
    func saveReimbursement(email: String, input: ReimburseFormInput, projectName: String) async throws -> String {
        let rid = UUID().uuidString
        let row = SupabaseReimburse.new(
            id: rid, email: email, projectName: projectName, input: input
        )
        try await client.database.from("reimbursements").insert(row).execute()
        return rid
    }

    /// 立替を更新（submitted 状態のみ）
    func updateReimbursement(_ reimbursementId: String, email: String, input: ReimburseFormInput, projectName: String) async throws {
        let update = SupabaseReimburseUpdate(input: input, projectName: projectName)
        try await client.database
            .from("reimbursements")
            .update(update)
            .eq("reimbursement_id", value: reimbursementId)
            .eq("created_by", value: email.lowercased())
            .eq("status", value: "submitted")
            .execute()
    }

    /// 立替を削除（submitted 状態のみ）
    func deleteReimbursement(_ reimbursementId: String, email: String) async throws {
        try await client.database
            .from("reimbursements")
            .delete()
            .eq("reimbursement_id", value: reimbursementId)
            .eq("created_by", value: email.lowercased())
            .eq("status", value: "submitted")
            .execute()
    }

    // MARK: - Admin: Access Control

    /// members テーブルの is_admin を参照してサーバー側で判定する（ハードコード廃止）
    func fetchIsAdmin(email: String) async throws -> Bool {
        struct IsAdminRow: Decodable {
            let isAdmin: Bool
            enum CodingKeys: String, CodingKey { case isAdmin = "is_admin" }
        }
        let rows: [IsAdminRow] = try await client.database
            .from("members")
            .select("is_admin")
            .eq("email", value: email.lowercased())
            .limit(1)
            .execute()
            .value
        return rows.first?.isAdmin ?? false
    }

    // MARK: - Admin: All Projects (active + ended + frozen)

    func fetchAllVisibleProjects() async throws -> [SupabaseProject] {
        let response: [SupabaseProject] = try await client.database
            .from("projects")
            .select("project_id, project_name, client_name, status, start_ym, end_ym, project_type")
            .in("status", values: ["active", "ended", "frozen"])
            .order("project_id")
            .execute()
            .value
        return response
    }

    // MARK: - Admin: Billing Matrix

    func fetchBillingMatrix() async throws -> [BillingMatrixRow] {
        let cal = Calendar.current
        let now = Date()
        var yms: [String] = []
        for i in -11...1 {
            if let d = cal.date(byAdding: .month, value: i, to: now) {
                let y = cal.component(.year, from: d)
                let m = cal.component(.month, from: d)
                yms.append(String(format: "%04d%02d", y, m))
            }
        }
        let rows: [BillingMatrixRow] = try await client.database
            .from("billing_cycles")
            .select("*")
            .in("ym", values: yms)
            .execute()
            .value
        return rows
    }

    func updateBillingMatrixCell(projectId: String, ym: String, taskKey: String, newStatus: String, byEmail: String) async throws {
        let now = ISO8601DateFormatter().string(from: Date())
        var body: [String: Any] = [:]
        switch taskKey {
        case "estimateSend":
            try await setCTBEstimateSentStatus(projectId: projectId, bizYm: ym, newStatus: newStatus)
            return
        case "budget":
            body["status"] = newStatus == "done" ? "allocation_confirmed" : "not_started"
            body["budget_confirmed_at"] = newStatus == "done" ? now : NSNull()
            body["budget_confirmed_by"] = newStatus == "done" ? byEmail : NSNull()
        case "meeting":
            if newStatus == "skip" {
                body["meeting_event_id"] = "skipped"
            } else if newStatus == "done" {
                body["meeting_event_id"] = "admin_done"
            } else {
                body["meeting_event_id"] = NSNull()
            }
        case "reportFix":
            body["report_fixed_at"] = newStatus == "done" ? now : NSNull()
            body["report_fixed_by"] = newStatus == "done" ? byEmail : NSNull()
        case "invoice":
            body["invoice_issued_at"] = newStatus == "done" ? now : NSNull()
            body["invoice_issued_by"] = newStatus == "done" ? byEmail : NSNull()
            if newStatus == "undone" { body["invoice_sent_at"] = NSNull() }
        case "invoiceSent":
            body["invoice_sent_at"] = newStatus == "done" ? now : NSNull()
        case "paymentNotice":
            body["payout_notice_uploaded_at"] = newStatus == "done" ? now : NSNull()
        case "payment":
            body["payment_confirmed_at"] = newStatus == "done" ? now : NSNull()
            body["payment_confirmed_by"] = newStatus == "done" ? byEmail : NSNull()
        case "rewardPaid":
            body["reward_paid_at"] = newStatus == "done" ? now : NSNull()
            body["reward_paid_by"] = newStatus == "done" ? byEmail : NSNull()
        default:
            throw NSError(domain: "AdminError", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unknown taskKey: \(taskKey)"])
        }
        try await patchBillingCycle(projectId: projectId, ym: ym, body: body)
    }

    private struct CTBEstimateCycleRow: Decodable {
        let invoiceBaseLinesJson: String?
        let invoiceSubject: String?
        enum CodingKeys: String, CodingKey {
            case invoiceBaseLinesJson = "invoice_base_lines_json"
            case invoiceSubject = "invoice_subject"
        }
    }

    private func setCTBEstimateSentStatus(projectId: String, bizYm: String, newStatus: String) async throws {
        let estimateYm = bizYm
        let existingRows: [CTBEstimateCycleRow] = (try? await client.database
            .from("billing_cycles")
            .select("invoice_base_lines_json, invoice_subject")
            .eq("project_id", value: projectId)
            .eq("ym", value: estimateYm)
            .limit(1)
            .execute().value) ?? []

        let existing = existingRows.first
        let updatedJson = newStatus == "done"
            ? ensureCTBEstimateMarker(in: existing?.invoiceBaseLinesJson)
            : stripCTBEstimateMarker(from: existing?.invoiceBaseLinesJson)

        if existing == nil {
            guard newStatus == "done", let updatedJson else { return }
            try await upsertBillingCycle(
                projectId: projectId,
                ym: estimateYm,
                body: ["invoice_base_lines_json": updatedJson]
            )
            return
        }

        var body: [String: Any] = [:]
        body["invoice_base_lines_json"] = (updatedJson?.isEmpty == false) ? updatedJson! : NSNull()
        try await patchBillingCycle(projectId: projectId, ym: estimateYm, body: body)
    }

    private func markLegacyBillingCycleFullyDone(projectId: String, ym: String, byEmail: String) async throws {
        let now = ISO8601DateFormatter().string(from: Date())
        let body: [String: Any] = [
            "status": "payment_confirmed",
            "budget_confirmed_at": now,
            "budget_confirmed_by": byEmail,
            "meeting_event_id": "legacy_auto_completed",
            "report_fixed_at": now,
            "report_fixed_by": byEmail,
            "invoice_issued_at": now,
            "invoice_issued_by": byEmail,
            "invoice_sent_at": now,
            "payout_notice_uploaded_at": now,
            "payment_confirmed_at": now,
            "payment_confirmed_by": byEmail,
            "reward_paid_at": now,
            "reward_paid_by": byEmail
        ]
        try await patchBillingCycle(projectId: projectId, ym: ym, body: body)
    }

    func autoCompleteLegacyCycles(projectId: String, upToYm: String = "202512") async {
        struct CycleRow: Decodable {
            let ym: String?
            let rewardPaidAt: String?
            enum CodingKeys: String, CodingKey {
                case ym
                case rewardPaidAt = "reward_paid_at"
            }
        }

        let rows: [CycleRow] = (try? await client.database
            .from("billing_cycles")
            .select("ym, reward_paid_at")
            .eq("project_id", value: projectId)
            .lte("ym", value: upToYm)
            .execute().value) ?? []

        for row in rows {
            guard let ym = row.ym, !ym.isEmpty else { continue }
            if (row.rewardPaidAt ?? "").isEmpty {
                try? await markLegacyBillingCycleFullyDone(
                    projectId: projectId,
                    ym: ym,
                    byEmail: "ctb_auto_completed"
                )
            }
        }
    }

    func autoCompleteLegacyCTBCycles(projectId: String, upToYm: String = "202512") async {
        await autoCompleteLegacyCycles(projectId: projectId, upToYm: upToYm)
    }

    func fetchCTBEstimateDraftMap(projectId: String, yms: [String]) async throws -> [String: Bool] {
        struct CycleRow: Decodable {
            let ym: String?
            let invoiceBaseLinesJson: String?
            let invoiceSubject: String?
            let invoiceIssuedAt: String?
            enum CodingKeys: String, CodingKey {
                case ym
                case invoiceBaseLinesJson = "invoice_base_lines_json"
                case invoiceSubject = "invoice_subject"
                case invoiceIssuedAt = "invoice_issued_at"
            }
        }

        let targets = Array(Set(yms)).sorted()
        guard !targets.isEmpty else { return [:] }

        let rows: [CycleRow] = (try? await client.database
            .from("billing_cycles")
            .select("ym, invoice_base_lines_json, invoice_subject, invoice_issued_at")
            .eq("project_id", value: projectId)
            .in("ym", values: targets)
            .execute().value) ?? []

        return Dictionary(uniqueKeysWithValues: rows.compactMap { row in
            guard let ym = row.ym, !ym.isEmpty else { return nil }
            let hasDraft = (row.invoiceBaseLinesJson?.isEmpty == false) ||
                (row.invoiceSubject?.isEmpty == false) ||
                (row.invoiceIssuedAt?.isEmpty == false)
            return (ym, hasDraft)
        })
    }

    func fetchReimbursementCompletionMap(projectId: String, yms: [String]) async throws -> [String: Bool] {
        struct Row: Decodable {
            let date: String?
            let status: String?
        }

        let targets = Array(Set(yms)).sorted()
        guard let firstYm = targets.first,
              let lastYm = targets.last,
              let start = ymDayString(firstYm, day: 1),
              let endBase = ymDayString(nextYmString(from: lastYm), day: 1) else {
            return [:]
        }

        let rows: [Row] = (try? await client.database
            .from("reimbursements")
            .select("date, status")
            .eq("project_id", value: projectId)
            .gte("date", value: start)
            .lt("date", value: endBase)
            .execute().value) ?? []

        var hasPending: [String: Bool] = Dictionary(uniqueKeysWithValues: targets.map { ($0, false) })
        for row in rows {
            guard let date = row.date, date.count >= 7 else { continue }
            let ym = String(date.prefix(4)) + String(date.dropFirst(5).prefix(2))
            guard hasPending[ym] != nil else { continue }
            let status = (row.status ?? "").lowercased()
            if status == "submitted" || status == "pmapproved" {
                hasPending[ym] = true
            }
        }

        return Dictionary(uniqueKeysWithValues: hasPending.map { ($0.key, !$0.value) })
    }

    // MARK: - Routine: Budget Step（Supabase直読み）

    /// 予算確定ステップのデータをSupabaseから直接取得
    func fetchBillingBudget(projectId: String, ym: String) async throws -> BillingBudgetData {
        // billing_cycles から当該行を取得
        struct CycleRow: Decodable {
            let status: String?
            let budgetReportedAmount: Double?
            let budgetBufferAmount: Int?
            let budgetReportedAt: String?
            let budgetReportedBy: String?
            let budgetConfirmedAt: String?
            let budgetYen: Double?
            let memberAllocationsJson: [String: Int]?
            enum CodingKeys: String, CodingKey {
                case status
                case budgetReportedAmount = "budget_reported_amount"
                case budgetBufferAmount = "budget_buffer_amount"
                case budgetReportedAt = "budget_reported_at"
                case budgetReportedBy = "budget_reported_by"
                case budgetConfirmedAt = "budget_confirmed_at"
                case budgetYen = "budget_yen"
                case memberAllocationsJson = "member_allocations_json"
            }
        }
        struct ProjectRow: Decodable {
            let projectName: String
            let feeType: String?
            let feeAmount: Double?
            enum CodingKeys: String, CodingKey {
                case projectName = "project_name"
                case feeType = "fee_type"
                case feeAmount = "fee_amount"
            }
        }

        async let cycleResult: [CycleRow] = client.database
            .from("billing_cycles")
            .select("status, budget_reported_amount, budget_buffer_amount, budget_reported_at, budget_reported_by, budget_confirmed_at, budget_yen, member_allocations_json")
            .eq("project_id", value: projectId)
            .eq("ym", value: ym)
            .execute()
            .value
        async let projectResult: [ProjectRow] = client.database
            .from("projects")
            .select("project_name, fee_type, fee_amount")
            .eq("project_id", value: projectId)
            .execute()
            .value

        let (cycles, projects) = try await (cycleResult, projectResult)
        let cycle = cycles.first
        let project = projects.first
        let projectName = project?.projectName ?? projectId

        return BillingBudgetData(
            ok: true,
            projectId: projectId,
            ym: ym,
            projectName: projectName,
            feeType: project?.feeType,
            feeAmount: project?.feeAmount,
            status: cycle?.status,
            budgetReportedAmount: cycle?.budgetReportedAmount,
            budgetBufferAmount: cycle?.budgetBufferAmount,
            budgetReportedAt: cycle?.budgetReportedAt,
            budgetReportedBy: cycle?.budgetReportedBy,
            budgetConfirmedAt: cycle?.budgetConfirmedAt,
            budgetYen: cycle?.budgetYen,
            memberAllocationsJson: cycle?.memberAllocationsJson,
            message: nil
        )
    }

    /// 変動PJの予算確定で「前月の請求額」をプレースホルダーに表示するための補助。
    /// currentYm より前の最も新しい billing_cycles 行の budget_reported_amount を返す。
    /// 何も無ければ nil。
    func fetchPreviousInvoiceAmount(projectId: String, currentYm: String) async throws -> Double? {
        struct Row: Decodable {
            let ym: String?
            let budgetReportedAmount: Double?
            enum CodingKeys: String, CodingKey {
                case ym
                case budgetReportedAmount = "budget_reported_amount"
            }
        }
        let rows: [Row] = (try? await client.database
            .from("billing_cycles")
            .select("ym, budget_reported_amount")
            .eq("project_id", value: projectId)
            .lt("ym", value: currentYm)
            .order("ym", ascending: false)
            .limit(6)
            .execute().value) ?? []

        for row in rows {
            if let amount = row.budgetReportedAmount, amount > 0 {
                return amount
            }
        }
        return nil
    }

    // MARK: - My Profile

    struct MyProfile: Decodable {
        let memberId: String
        let codeName: String?
        let memberName: String?
        let memberAddress: String?
        let bankInfo: String?

        enum CodingKeys: String, CodingKey {
            case memberId = "member_id"
            case codeName = "code_name"
            case memberName = "member_name"
            case memberAddress = "member_address"
            case bankInfo = "bank_info"
        }
    }

    /// メールアドレスで自分のプロフィールを取得
    func fetchMyProfile(email: String) async throws -> MyProfile? {
        let rows: [MyProfile] = try await client.database
            .from("members")
            .select("member_id, code_name, member_name, member_address, bank_info")
            .eq("email", value: email.lowercased())
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    /// 自分の住所・振込先を更新
    func updateMyPayoutInfo(memberId: String, memberAddress: String, bankInfo: String) async throws {
        try await client.database
            .from("members")
            .update([
                "member_address": memberAddress.isEmpty ? nil : memberAddress,
                "bank_info": bankInfo.isEmpty ? nil : bankInfo,
            ])
            .eq("member_id", value: memberId)
            .execute()
    }

    // MARK: - Project Members

    /// プロジェクトのアクティブメンバー一覧を取得（project_members → members JOIN）
    func fetchProjectMembers(projectId: String) async throws -> [ProjectMember] {
        struct PMRow: Decodable {
            let memberId: String
            enum CodingKeys: String, CodingKey { case memberId = "member_id" }
        }
        // まず project_members でアクティブ member_id 一覧を取得
        let pmRows: [PMRow] = try await client.database
            .from("project_members")
            .select("member_id")
            .eq("project_id", value: projectId)
            .eq("is_active", value: true)
            .execute()
            .value
        let memberIds = pmRows.map { $0.memberId }
        guard !memberIds.isEmpty else { return [] }
        // members テーブルから詳細取得
        let members: [ProjectMember] = try await client.database
            .from("members")
            .select("member_id, code_name, email, slack_id")
            .in("member_id", values: memberIds)
            .order("member_id")
            .execute()
            .value
        return members
    }

    // MARK: - Admin: Budget Approval

    func fetchBudgetPending() async throws -> [BudgetPendingItem] {
        let rows: [BudgetPendingItem] = try await client.database
            .from("billing_cycles")
            .select("project_id, ym, status, budget_reported_amount, budget_buffer_amount, budget_reported_at, budget_reported_by, member_allocations_json")
            .eq("status", value: "reported")
            .execute()
            .value
        return rows
    }

    // MARK: - Admin: Knowledge Session

    func fetchKnowledgeSessionsTimeline(monthsBack: Int = 11) async throws -> [KnowledgeSessionRecord] {
        let yms = generateTargetYms(monthsBack: monthsBack).sorted(by: >)
        let fallback = yms.map { KnowledgeSessionRecord.placeholder(baseYm: $0) }
        guard !yms.isEmpty else { return [] }
        do {
            let rows: [KnowledgeSessionRecord] = try await client.database
                .from("knowledge_sessions")
                .select("base_ym, offline_enabled, event_date, venue_name, venue_address, venue_link, participant_member_ids, message_to_pm, announcement_draft, announcement_posted_at, announcement_posted_by, updated_at")
                .in("base_ym", values: yms)
                .execute()
                .value
            let rowMap = Dictionary(uniqueKeysWithValues: rows.map { ($0.baseYm, $0) })
            return yms.map { rowMap[$0] ?? KnowledgeSessionRecord.placeholder(baseYm: $0) }
        } catch {
            return fallback
        }
    }

    func fetchKnowledgeSession(baseYm: String) async throws -> KnowledgeSessionRecord? {
        let rows: [KnowledgeSessionRecord] = try await client.database
            .from("knowledge_sessions")
            .select("base_ym, offline_enabled, event_date, venue_name, venue_address, venue_link, participant_member_ids, message_to_pm, announcement_draft, announcement_posted_at, announcement_posted_by, updated_at")
            .eq("base_ym", value: baseYm)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    func fetchKnowledgeVenueHistory(limit: Int = 20) async throws -> [KnowledgeVenueHistory] {
        let rows: [KnowledgeVenueHistory] = try await client.database
            .from("knowledge_sessions")
            .select("base_ym, venue_name, venue_address, venue_link, event_date")
            .eq("offline_enabled", value: true)
            .order("updated_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        var seen = Set<String>()
        return rows.filter { row in
            guard let name = row.venueName?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !name.isEmpty else { return false }
            if seen.contains(name) { return false }
            seen.insert(name)
            return true
        }
    }

    func fetchActiveMembersForKnowledge() async throws -> [KnowledgeMember] {
        let query = "member_id, code_name, email, slack_id"
        if let activeRows: [KnowledgeMember] = try? await client.database
            .from("members")
            .select(query)
            .eq("status", value: "active")
            .order("member_id")
            .execute()
            .value {
            if !activeRows.isEmpty { return activeRows }
        }
        return try await client.database
            .from("members")
            .select(query)
            .order("member_id")
            .execute()
            .value
    }

    func upsertKnowledgeSession(
        baseYm: String,
        offlineEnabled: Bool,
        eventDate: String?,
        venueName: String?,
        venueAddress: String?,
        venueLink: String?,
        participantMemberIds: [String],
        messageToPm: String?
    ) async throws {
        struct Row: Encodable {
            let base_ym: String
            let offline_enabled: Bool
            let event_date: String?
            let venue_name: String?
            let venue_address: String?
            let venue_link: String?
            let participant_member_ids: [String]
            let message_to_pm: String?
            let updated_at: String
        }
        let row = Row(
            base_ym: baseYm,
            offline_enabled: offlineEnabled,
            event_date: eventDate.nilIfEmpty,
            venue_name: venueName.nilIfEmpty,
            venue_address: venueAddress.nilIfEmpty,
            venue_link: venueLink.nilIfEmpty,
            participant_member_ids: participantMemberIds,
            message_to_pm: messageToPm.nilIfEmpty,
            updated_at: nowISO()
        )
        try await client.database
            .from("knowledge_sessions")
            .upsert(row, onConflict: "base_ym")
            .execute()
    }

    func draftKnowledgeAnnouncement(
        baseYm: String,
        eventDate: String?,
        venueName: String?,
        venueAddress: String?,
        venueLink: String?,
        participantNames: [String],
        messageToPm: String?,
        revisionPrompt: String?,
        previousDraft: String?
    ) async throws -> KnowledgeAnnouncementDraftResult {
        let body: [String: Any] = [
            "action": "draft",
            "baseYm": baseYm,
            "eventDate": eventDate ?? "",
            "venueName": venueName ?? "",
            "venueAddress": venueAddress ?? "",
            "venueLink": venueLink ?? "",
            "participantNames": participantNames,
            "messageToPm": messageToPm ?? "",
            "revisionPrompt": revisionPrompt ?? "",
            "previousDraft": previousDraft ?? "",
        ]
        return try await callEdgeFunction("knowledge-session-slack", body: body)
    }

    func postKnowledgeAnnouncement(
        baseYm: String,
        text: String,
        channelId: String,
        postedByEmail: String,
        isTest: Bool
    ) async throws -> KnowledgeAnnouncementPostResult {
        let body: [String: Any] = [
            "action": "post",
            "baseYm": baseYm,
            "text": text,
            "channelId": channelId,
            "postedByEmail": postedByEmail,
            "isTest": isTest,
        ]
        return try await callEdgeFunction("knowledge-session-slack", body: body)
    }

    /// PM予算申告: Supabaseに直接書き込み（配賦額 JSON 含む）
    func submitBudgetReport(
        projectId: String, ym: String,
        invoiceAmount: Double, bufferAmount: Int, byEmail: String,
        allocations: [String: Int]   // memberId → amount
    ) async throws {
        var body: [String: Any] = [
            "status": "reported",
            "budget_reported_amount": invoiceAmount,
            "budget_buffer_amount": bufferAmount,
            "budget_reported_at": ISO8601DateFormatter().string(from: Date()),
            "budget_reported_by": byEmail
        ]
        if !allocations.isEmpty {
            body["member_allocations_json"] = allocations
        }
        try await patchBillingCycle(projectId: projectId, ym: ym, body: body)

        // admin に Slack DM で承認 nudge（失敗しても申告自体はノーエラー）
        Task.detached { [self] in
            try? await self.sendBudgetApprovalNudge(projectId: projectId, ym: ym, pmEmail: byEmail)
        }
    }

    func sendBudgetApprovalNudge(projectId: String, ym: String, pmEmail: String) async throws {
        struct NudgeResult: Decodable { let ok: Bool }
        let _: NudgeResult = try await callEdgeFunction("send-budget-approval-nudge", body: [
            "projectId": projectId,
            "ym": ym,
            "pmEmail": pmEmail
        ])
    }

    /// 予算承認: 請求額 × 65% - バッファ = PJ予算（budget_yen）
    func approveBudget(projectId: String, ym: String, invoiceAmount: Double, bufferAmount: Int, byEmail: String) async throws {
        let pjBudget = max(0, Int((invoiceAmount * 0.65).rounded()) - bufferAmount)
        let body: [String: Any] = [
            "status": "allocation_confirmed",
            "budget_yen": pjBudget,
            "budget_confirmed_at": ISO8601DateFormatter().string(from: Date()),
            "budget_confirmed_by": byEmail
        ]
        try await patchBillingCycle(projectId: projectId, ym: ym, body: body)
    }

    /// 予算取り下げ: status を draft に戻し、申告・承認関連のフィールドを全て NULL クリア。
    /// PM 申告後でも、admin 承認後でも、いつでも呼べる。配賦額（member_allocations_json）も
    /// クリアして、ゼロから入力し直せる状態にする。
    func withdrawBudget(projectId: String, ym: String) async throws {
        let body: [String: Any] = [
            "status": "draft",
            "budget_reported_amount": NSNull(),
            "budget_buffer_amount": NSNull(),
            "budget_reported_at": NSNull(),
            "budget_reported_by": NSNull(),
            "budget_yen": NSNull(),
            "budget_confirmed_at": NSNull(),
            "budget_confirmed_by": NSNull(),
            "member_allocations_json": NSNull()
        ]
        try await patchBillingCycle(projectId: projectId, ym: ym, body: body)
    }

    /// billing_cycles の status だけを軽量取得（マイページ TODO フィルタ用）
    func fetchBillingCycleStatusSimple(projectId: String, ym: String) async throws -> String? {
        struct Row: Decodable {
            let status: String?
        }
        let rows: [Row] = (try? await client.database
            .from("billing_cycles")
            .select("status")
            .eq("project_id", value: projectId)
            .eq("ym", value: ym)
            .limit(1)
            .execute().value) ?? []
        return rows.first?.status
    }

    // MARK: - Members (Admin)

    /// Admin メンバーリスト用：全メンバーを取得
    func fetchAllMembersAdmin() async throws -> [AdminMemberRow] {
        let rows: [AdminMemberRow] = (try? await client.database
            .from("members")
            .select("member_id, code_name, member_name, email, slack_id, member_address, bank_info, is_admin, status, exclude_from_payout_notice, joined_at, left_at, slack_plan, google_plan")
            .order("status", ascending: false)
            .order("code_name")
            .execute().value) ?? []
        return rows
    }

    /// Admin: 1メンバーの詳細フィールドを更新
    func updateMemberAdmin(memberId: String, body: [String: Any]) async throws {
        let encoded = memberId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? memberId
        guard let url = URL(string: "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/members?member_id=eq.\(encoded)") else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.timeoutInterval = 8
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            let body = String(data: data, encoding: .utf8) ?? "(empty)"
            throw NSError(domain: "members.PATCH", code: http.statusCode,
                          userInfo: [NSLocalizedDescriptionKey: "members PATCH \(http.statusCode): \(body)"])
        }
    }

    // MARK: - Admin Pending Tasks Summary

    /// Admin の「今月やること」カード用サマリ
    func fetchAdminPendingSummary() async throws -> AdminPendingSummary {
        struct ProjRow: Decodable {
            let projectId: String?
            enum CodingKeys: String, CodingKey { case projectId = "project_id" }
        }
        struct CycleRow: Decodable {
            let projectId: String?
            let ym: String?
            let status: String?
            let invoiceIssuedAt: String?
            let invoiceSentAt: String?
            let payoutNoticeUploadedAt: String?
            let paymentConfirmedAt: String?
            let rewardPaidAt: String?
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case ym
                case status
                case invoiceIssuedAt = "invoice_issued_at"
                case invoiceSentAt = "invoice_sent_at"
                case payoutNoticeUploadedAt = "payout_notice_uploaded_at"
                case paymentConfirmedAt = "payment_confirmed_at"
                case rewardPaidAt = "reward_paid_at"
            }
        }

        // 1. active PJ id 一覧
        let projects: [ProjRow] = (try? await client.database
            .from("projects")
            .select("project_id")
            .eq("status", value: "active")
            .execute().value) ?? []
        let activeProjectIds = projects.compactMap(\.projectId).filter { !$0.isEmpty }
        guard !activeProjectIds.isEmpty else {
            return AdminPendingSummary(
                budgetApprovalCount: 0,
                payoutNoticeCount: 0,
                paymentUnconfirmedCount: 0,
                rewardUnpaidCount: 0
            )
        }

        // 2. active PJ の billing_cycles（直近6ヶ月で十分）
        let now = Date()
        let cal = Calendar(identifier: .gregorian)
        let comps = cal.dateComponents(in: TimeZone(identifier: "Asia/Tokyo") ?? .current, from: now)
        let curY = comps.year ?? 2026
        let curM = comps.month ?? 1
        var ymCandidates: [String] = []
        for offset in -6...0 {
            var m = curM + offset
            var y = curY
            while m <= 0 { m += 12; y -= 1 }
            while m > 12 { m -= 12; y += 1 }
            ymCandidates.append(String(format: "%04d%02d", y, m))
        }

        let cycles: [CycleRow] = (try? await client.database
            .from("billing_cycles")
            .select("project_id, ym, status, invoice_issued_at, invoice_sent_at, payout_notice_uploaded_at, payment_confirmed_at, reward_paid_at")
            .in("project_id", values: activeProjectIds)
            .in("ym", values: ymCandidates)
            .execute().value) ?? []

        var budgetApproval = 0
        var payoutNotice = 0
        var paymentUnconfirmed = 0
        var rewardUnpaid = 0

        for cycle in cycles {
            // 予算承認待ち（status='reported'）
            if cycle.status == "reported" {
                budgetApproval += 1
            }
            // 支払通知書未送付（請求書発行済み かつ 通知書未送付）
            if (cycle.invoiceIssuedAt?.isEmpty == false) && (cycle.payoutNoticeUploadedAt?.isEmpty != false) {
                payoutNotice += 1
            }
            // 入金未確認（請求書送付済み かつ 入金未確認）
            if (cycle.invoiceSentAt?.isEmpty == false) && (cycle.paymentConfirmedAt?.isEmpty != false) {
                paymentUnconfirmed += 1
            }
            // 報酬未支払い（入金確認済み かつ 報酬未支払い）
            if (cycle.paymentConfirmedAt?.isEmpty == false) && (cycle.rewardPaidAt?.isEmpty != false) {
                rewardUnpaid += 1
            }
        }

        return AdminPendingSummary(
            budgetApprovalCount: budgetApproval,
            payoutNoticeCount: payoutNotice,
            paymentUnconfirmedCount: paymentUnconfirmed,
            rewardUnpaidCount: rewardUnpaid
        )
    }

    // MARK: - Payout Notice (Member-grouped Admin View)

    /// 指定 ym の支払通知書一覧を「すべての active メンバー × すべての active 参加PJ」で組み立てる。
    /// - members.status = 'active' を起点
    /// - project_members.is_active = true で参加PJを決定
    /// - **PJ自体が active かつ ym が start_ym〜end_ym の範囲内** であるPJに限定
    /// - billing_cycles.member_allocations_json[member_id] があれば yen を反映、無ければ未設定として表示
    /// - 1つも参加PJが無い active メンバーは結果から除外
    /// - 範囲外の billing_cycles 行（status=ended/frozen や ym 範囲外）は読みに行く前にクリーンアップする
    func fetchPayoutNoticeMembers(ym: String) async throws -> [PayoutNoticeMemberRow] {
        // active じゃない PJ に紐づく billing_cycles は事前に削除（運用ノイズ除去）
        try? await pruneInactiveBillingCycles(ym: ym)

        struct CycleRow: Decodable {
            let projectId: String
            let memberAllocations: [String: Int]?
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case memberAllocations = "member_allocations_json"
            }
        }
        struct ProjRow: Decodable {
            let projectId: String
            let projectName: String
            let status: String?
            let startYm: String?
            let endYm: String?
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case projectName = "project_name"
                case status
                case startYm = "start_ym"
                case endYm = "end_ym"
            }
        }
        struct MemberRow: Decodable {
            let memberId: String
            let codeName: String?
            let email: String?
            enum CodingKeys: String, CodingKey {
                case memberId = "member_id"
                case codeName = "code_name"
                case email
            }
        }
        struct PMRow: Decodable {
            let memberId: String
            let projectId: String
            enum CodingKeys: String, CodingKey {
                case memberId = "member_id"
                case projectId = "project_id"
            }
        }
        struct NoticeRow: Decodable {
            let memberId: String
            let sentAt: String?
            let noticeNo: String?
            enum CodingKeys: String, CodingKey {
                case memberId = "member_id"
                case sentAt = "sent_at"
                case noticeNo = "notice_no"
            }
        }

        async let cyclesTask: [CycleRow] = client.database
            .from("billing_cycles")
            .select("project_id, member_allocations_json")
            .eq("ym", value: ym)
            .execute().value
        async let projectsTask: [ProjRow] = client.database
            .from("projects")
            .select("project_id, project_name, status, start_ym, end_ym")
            .eq("status", value: "active")
            .execute().value
        // exclude_from_payout_notice = true のメンバーは支払通知書送付対象から除外する
        // (役員報酬・無償出向など、ARMADA から金銭を払わないメンバー)
        async let membersTask: [MemberRow] = client.database
            .from("members")
            .select("member_id, code_name, email")
            .eq("status", value: "active")
            .eq("exclude_from_payout_notice", value: false)
            .execute().value
        async let projectMembersTask: [PMRow] = client.database
            .from("project_members")
            .select("member_id, project_id")
            .eq("is_active", value: true)
            .execute().value
        async let noticesTask: [NoticeRow] = client.database
            .from("payout_notices")
            .select("member_id, sent_at, notice_no")
            .eq("ym", value: ym)
            .execute().value

        let (cycles, projects, members, projectMembers, notices) =
            try await (cyclesTask, projectsTask, membersTask, projectMembersTask, noticesTask)

        // ym がそのPJの稼働期間内かどうか（start_ym <= ym <= end_ym）
        let activeProjectsForYm: [ProjRow] = projects.filter { p in
            if let startYm = p.startYm?.trimmingCharacters(in: .whitespacesAndNewlines),
               !startYm.isEmpty, ym < startYm { return false }
            if let endYm = p.endYm?.trimmingCharacters(in: .whitespacesAndNewlines),
               !endYm.isEmpty, ym > endYm { return false }
            return true
        }
        let activeProjectIds = Set(activeProjectsForYm.map(\.projectId))

        let projectMap = Dictionary(uniqueKeysWithValues: activeProjectsForYm.map { ($0.projectId, $0.projectName) })
        let memberMap  = Dictionary(uniqueKeysWithValues: members.map { ($0.memberId, $0) })
        let noticeMap  = Dictionary(uniqueKeysWithValues: notices.map { ($0.memberId, $0) })
        // billing_cycles も active な PJ のものだけに絞り込む
        let cycleMap   = Dictionary(uniqueKeysWithValues:
            cycles.filter { activeProjectIds.contains($0.projectId) }
                  .map { ($0.projectId, $0.memberAllocations ?? [:]) }
        )

        // member_id → 参加PJのproject_id 集合（project_members 起点 / active PJ のみ）
        var memberProjects: [String: Set<String>] = [:]
        for pm in projectMembers where memberMap[pm.memberId] != nil && activeProjectIds.contains(pm.projectId) {
            memberProjects[pm.memberId, default: []].insert(pm.projectId)
        }
        // billing_cycles.member_allocations_json に名前が出るが project_members に無い
        // 「過去のメンバー」もカバー（active PJ の場合だけ）
        for (pid, allocs) in cycleMap {
            for mid in allocs.keys where memberMap[mid] != nil {
                memberProjects[mid, default: []].insert(pid)
            }
        }

        let rows: [PayoutNoticeMemberRow] = memberMap.compactMap { (mid, m) in
            guard let pjIds = memberProjects[mid], !pjIds.isEmpty else { return nil }
            let breakdown: [PayoutNoticeMemberPJ] = pjIds.map { pid in
                let allocs = cycleMap[pid] ?? [:]
                if let yen = allocs[mid] {
                    return PayoutNoticeMemberPJ(
                        projectId:   pid,
                        projectName: projectMap[pid] ?? pid,
                        yen:         yen,
                        isAllocated: true
                    )
                } else {
                    return PayoutNoticeMemberPJ(
                        projectId:   pid,
                        projectName: projectMap[pid] ?? pid,
                        yen:         0,
                        isAllocated: false
                    )
                }
            }.sorted(by: { $0.projectName < $1.projectName })

            let n = noticeMap[mid]
            return PayoutNoticeMemberRow(
                memberId:  mid,
                codeName:  m.codeName ?? mid,
                email:     m.email,
                breakdown: breakdown,
                sentAt:    n?.sentAt,
                noticeNo:  n?.noticeNo
            )
        }
        return rows.sorted { lhs, rhs in
            if lhs.isSent != rhs.isSent { return !lhs.isSent } // 未送付を上に
            return lhs.codeName < rhs.codeName
        }
    }

    /// 指定 ym で「active じゃないPJ」または「ym が稼働範囲外のPJ」の billing_cycles 行を削除する。
    /// active 判定: projects.status = 'active' かつ start_ym <= ym <= end_ym。
    /// それ以外（status=frozen/ended、ym < start_ym、ym > end_ym など）の行はノイズとして除去。
    /// 注意: 1リクエストでまとめて削除（project_id IN (...) & ym = ym）。
    func pruneInactiveBillingCycles(ym: String) async throws {
        struct ProjRow: Decodable {
            let projectId: String
            let status: String?
            let startYm: String?
            let endYm: String?
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case status
                case startYm = "start_ym"
                case endYm = "end_ym"
            }
        }
        let projects: [ProjRow] = (try? await client.database
            .from("projects")
            .select("project_id, status, start_ym, end_ym")
            .execute().value) ?? []

        let invalid: [String] = projects.compactMap { p in
            let status = (p.status ?? "").lowercased()
            if status != "active" { return p.projectId }
            if let s = p.startYm?.trimmingCharacters(in: .whitespacesAndNewlines),
               !s.isEmpty, ym < s { return p.projectId }
            if let e = p.endYm?.trimmingCharacters(in: .whitespacesAndNewlines),
               !e.isEmpty, ym > e { return p.projectId }
            return nil
        }
        guard !invalid.isEmpty else { return }

        // PostgREST: in.(a,b,c) は () カンマ区切り
        let inList = invalid.joined(separator: ",")
        guard let encodedIn = inList.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let encodedYm = ym.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/billing_cycles?project_id=in.(\(encodedIn))&ym=eq.\(encodedYm)") else {
            return
        }
        let token = try await accessToken()
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            let message = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw NSError(
                domain: "SupabaseREST",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        }
    }

    /// 支払通知書PDFを生成（プレビューまたは送付）
    /// - Parameter mode: "preview" or "send"
    /// - Returns: Edge Function の戻り値（pdfUrl, noticeNo など）
    func payoutNoticeGenerate(memberId: String, ym: String, mode: String) async throws -> PayoutNoticeEdgeResult {
        let bodyDict: [String: Any] = [
            "memberId": memberId,
            "ym":       ym,
            "mode":     mode,
        ]
        // PDF生成は時間がかかるのでタイムアウトを長めに
        var request = URLRequest(url: edgeFunctionBaseURL.appendingPathComponent("send-payout-notice"))
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: bodyDict)
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            let body = String(data: data, encoding: .utf8) ?? "(empty)"
            throw NSError(domain: "send-payout-notice", code: http.statusCode,
                          userInfo: [NSLocalizedDescriptionKey: "send-payout-notice \(http.statusCode): \(body)"])
        }
        return try JSONDecoder().decode(PayoutNoticeEdgeResult.self, from: data)
    }

    // MARK: - Admin: Step 7 & 8 Writes

    private struct PaymentConfirmUpdate: Encodable {
        let payment_confirmed_at: String
        let payment_confirmed_by: String
    }

    func confirmPayment(projectId: String, ym: String, byEmail: String) async throws {
        try await updateCycle(PaymentConfirmUpdate(
            payment_confirmed_at: nowISO(),
            payment_confirmed_by: byEmail
        ), projectId: projectId, ym: ym)
    }

    private struct PayoutPaidUpdate: Encodable {
        let reward_paid_at: String
        let reward_paid_by: String
    }

    func markPayoutPaid(projectId: String, ym: String, byEmail: String) async throws {
        try await updateCycle(PayoutPaidUpdate(
            reward_paid_at: nowISO(),
            reward_paid_by: byEmail
        ), projectId: projectId, ym: ym)
    }

    // MARK: - Admin: REST PATCH helper (dynamic JSON body)

    private func patchBillingCycle(projectId: String, ym: String, body: [String: Any]) async throws {
        guard let encodedPid = projectId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let encodedYm = ym.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/billing_cycles?project_id=eq.\(encodedPid)&ym=eq.\(encodedYm)") else {
            throw URLError(.badURL)
        }
        let token = try await accessToken()
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            let message = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw NSError(
                domain: "SupabaseREST",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        }
    }

    private func upsertBillingCycle(projectId: String, ym: String, body: [String: Any]) async throws {
        guard let url = URL(string: "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/billing_cycles?on_conflict=project_id,ym") else {
            throw URLError(.badURL)
        }
        let token = try await accessToken()
        var payload = body
        payload["project_id"] = projectId
        payload["ym"] = ym

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: [payload])
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            let message = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw NSError(
                domain: "SupabaseREST",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        }
    }

    private func ensureCTBEstimateMarker(in rawJson: String?) -> String? {
        guard let base = updatedCTBEstimateLinesJSON(from: rawJson, includeMarker: true) else {
            return ctbEstimateMarkerLinesJSON()
        }
        return base
    }

    private func updatedCTBEstimateLinesJSON(from rawJson: String?, includeMarker: Bool) -> String? {
        var rows: [[String: Any]] = []
        if let rawJson, !rawJson.isEmpty {
            guard let data = rawJson.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                return rawJson
            }
            rows = parsed
        }

        rows.removeAll { ($0["description"] as? String) == ctbEstimateDoneMarkerDescription }
        if includeMarker {
            rows.append([
                "type": "text",
                "description": ctbEstimateDoneMarkerDescription
            ])
        }
        guard !rows.isEmpty,
              let data = try? JSONSerialization.data(withJSONObject: rows),
              let output = String(data: data, encoding: .utf8) else {
            return nil
        }
        return output
    }

    struct PaymentDelayNudgeResult: Decodable {
        let ok: Bool
        let message: String?
        let sentCount: Int?
    }

    struct AppMemberNotification: Decodable, Identifiable {
        let id: String
        let notificationType: String?
        let title: String
        let body: String
        let projectId: String?
        let ym: String?
        let createdAt: String?

        enum CodingKeys: String, CodingKey {
            case id
            case notificationType = "notification_type"
            case title
            case body
            case projectId = "project_id"
            case ym
            case createdAt = "created_at"
        }
    }

    private struct PullAppNotificationsResponse: Decodable {
        let ok: Bool
        let notifications: [AppMemberNotification]?
        let message: String?
    }

    func sendPaymentDelayNudge(projectId: String, ym: String, missingStepLabels: [String]) async throws -> PaymentDelayNudgeResult {
        try await callEdgeFunction(
            "send-payment-delay-nudge",
            body: [
                "projectId": projectId,
                "ym": ym,
                "missingStepLabels": missingStepLabels
            ]
        )
    }

    func fetchPendingAppNotifications(email: String) async throws -> [AppMemberNotification] {
        var request = URLRequest(url: edgeFunctionBaseURL.appendingPathComponent("pull-app-notifications"))
        request.httpMethod = "POST"
        request.timeoutInterval = 4
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email])

        let (data, urlResponse) = try await URLSession.shared.data(for: request)
        if let http = urlResponse as? HTTPURLResponse, http.statusCode >= 400 {
            let body = String(data: data, encoding: .utf8) ?? "(empty)"
            throw NSError(
                domain: "pull-app-notifications",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: "pull-app-notifications \(http.statusCode): \(body)"]
            )
        }

        let decoded = try JSONDecoder().decode(PullAppNotificationsResponse.self, from: data)
        if decoded.ok {
            return decoded.notifications ?? []
        }
        throw NSError(
            domain: "pull-app-notifications",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: decoded.message ?? "通知取得に失敗しました"]
        )
    }

    // MARK: - Admin: Project Config

    func fetchProjectConfigs() async throws -> [ProjectConfigRow] {
        let response: [ProjectConfigRow] = try await client.database
            .from("projects")
            .select("""
                project_id, project_name, client_name, status, start_ym, end_ym,
                report_emails, project_type, fee_type, fee_amount,
                invoice_send_deadline_rule, payment_due_rule, invoice_send_manual,
                invoice_to_emails, invoice_cc_emails, invoice_bcc_emails
            """)
            .order("project_id")
            .execute()
            .value
        return response
    }

    func updateProjectConfig(projectId: String, body: [String: Any]) async throws {
        guard let encodedPid = projectId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/projects?project_id=eq.\(encodedPid)") else {
            throw URLError(.badURL)
        }
        let token = try await accessToken()
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            let message = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw NSError(
                domain: "SupabaseREST",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        }

        let status = String(body["status"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if status == "ended" {
            let current = try await fetchProjectConfigStatus(projectId: projectId)
            if let endYm = current?.endYm, !endYm.isEmpty {
                try await pruneFutureBillingCycles(projectId: projectId, endYm: endYm)
            }
        }
    }

    private struct ProjectConfigStatusRow: Decodable {
        let status: String?
        let endYm: String?
        enum CodingKeys: String, CodingKey {
            case status
            case endYm = "end_ym"
        }
    }

    private func fetchProjectConfigStatus(projectId: String) async throws -> ProjectConfigStatusRow? {
        let rows: [ProjectConfigStatusRow] = try await client.database
            .from("projects")
            .select("status, end_ym")
            .eq("project_id", value: projectId)
            .limit(1)
            .execute().value
        return rows.first
    }

    private func pruneFutureBillingCycles(projectId: String, endYm: String) async throws {
        let cleanEndYm = endYm.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleanEndYm.count == 6, cleanEndYm.allSatisfy(\.isNumber) else { return }

        guard let encodedPid = projectId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/billing_cycles?project_id=eq.\(encodedPid)&ym=gt.\(cleanEndYm)") else {
            throw URLError(.badURL)
        }

        let token = try await accessToken()
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")

        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            let message = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw NSError(
                domain: "SupabaseREST",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        }
    }

    // MARK: - My Page

    /// マイページ用データを一括取得
    /// email → memberId 解決 → 参加PJ → billing_cycles + milestones + progress
    func fetchMyPageData(email: String) async throws -> MyPageData {
        // --- Phase 1: メンバー解決 + PJ一覧（並列）---
        struct MemberRow: Decodable {
            let memberId: String?
            let codeName: String?
            enum CodingKeys: String, CodingKey {
                case memberId = "member_id"
                case codeName = "code_name"
            }
        }
        struct PMRow: Decodable {
            let projectId: String?
            enum CodingKeys: String, CodingKey { case projectId = "project_id" }
        }
        struct ProjRow: Decodable {
            let projectId: String?
            let projectName: String?
            let status: String?
            let projectType: String?
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case projectName = "project_name"
                case status
                case projectType = "project_type"
            }
        }

        let memberRows: [MemberRow] = (try? await client.database
            .from("members")
            .select("member_id, code_name")
            .eq("email", value: email.lowercased())
            .limit(1)
            .execute().value) ?? []
        guard let me = memberRows.first,
              let memberId = me.memberId,
              !memberId.isEmpty else {
            return MyPageData(memberId: "", codeName: "", months: [])
        }

        // memberId で project_members を再取得（email != member_id の場合があるため）
        let pmRows: [PMRow] = (try? await client.database
            .from("project_members")
            .select("project_id")
            .eq("member_id", value: memberId)
            .eq("is_active", value: true)
            .execute().value) ?? []
        let projectIds = pmRows.compactMap(\.projectId)
        guard !projectIds.isEmpty else {
            return MyPageData(memberId: memberId, codeName: me.codeName ?? "", months: [])
        }

        // PJ名取得
        let projects: [ProjRow] = (try? await client.database
            .from("projects")
            .select("project_id, project_name, status, project_type")
            .in("project_id", values: projectIds)
            .execute().value) ?? []
        let projNameMap = Dictionary(uniqueKeysWithValues: projects.compactMap { row -> (String, String)? in
            guard let projectId = row.projectId, !projectId.isEmpty else { return nil }
            return (projectId, row.projectName ?? projectId)
        })

        // --- Phase 2: billing_cycles + milestones + progress（並列）---
        let targetYms = generateTargetYms(monthsBack: 6)  // 当月 + 過去6ヶ月

        struct CycleRow: Decodable {
            let projectId: String?
            let ym: String?
            let status: String?
            let memberAllocationsJson: [String: Int]?
            let rewardSummaryJson: MyPageRewardSummary?
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case ym, status
                case memberAllocationsJson = "member_allocations_json"
                case rewardSummaryJson = "reward_summary_json"
            }
        }
        struct MyPageRewardSummary: Decodable {
            let members: [RewardMemberRow]?
        }
        struct RewardMemberRow: Decodable {
            let memberId: String?
            let memberName: String?
            let earnedPt: Double?
            let totalPay: Double?
        }
        struct PlanCycleRow: Decodable {
            let planCycleId: String?
            let projectId: String?
            let totalPoints: Int?
            let periodStartYm: String?
            let periodEndYm: String?
            enum CodingKeys: String, CodingKey {
                case planCycleId = "plan_cycle_id"
                case projectId = "project_id"
                case totalPoints = "total_points"
                case periodStartYm = "period_start_ym"
                case periodEndYm = "period_end_ym"
            }
        }
        struct MSRow: Decodable {
            let planCycleId: String?
            let milestoneId: String?
            let title: String?
            let points: Int?
            let tag: String?
            let isActive: Bool?
            enum CodingKeys: String, CodingKey {
                case planCycleId = "plan_cycle_id"
                case milestoneId = "milestone_id"
                case title, points, tag
                case isActive = "is_active"
            }
        }
        struct ProgressRow: Decodable {
            let milestoneKey: String?
            let ym: String?
            let progressPct: Double?
            let source: String?
            let note: String?
            enum CodingKeys: String, CodingKey {
                case milestoneKey = "milestone_key"
                case ym
                case progressPct = "progress_pct"
                case source
                case note
            }
        }
        struct MonthlyReportRow: Decodable {
            let projectId: String?
            let ym: String?
            let sectionMembers: String?
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case ym
                case sectionMembers = "section_members"
            }
        }
        struct SafePlan {
            let planCycleId: String
            let projectId: String
            let totalPoints: Int?
            let periodStartYm: String?
            let periodEndYm: String?
        }
        struct SafeMilestone {
            let planCycleId: String
            let milestoneId: String
            let title: String?
            let points: Int?
            let tag: String?
        }
        struct SafeCycle {
            let projectId: String
            let ym: String
            let status: String?
            let memberAllocationsJson: [String: Int]?
            let rewardSummaryJson: MyPageRewardSummary?
        }
        struct SafeProgress {
            let milestoneKey: String
            let ym: String
            let progressPct: Double?
            let source: String?
            let note: String?
        }

        async let cyclesTask: [CycleRow] = (try? client.database
            .from("billing_cycles")
            .select("project_id, ym, status, member_allocations_json, reward_summary_json")
            .in("project_id", values: projectIds)
            .in("ym", values: targetYms)
            .execute().value) ?? []
        async let plansTask: [PlanCycleRow] = (try? client.database
            .from("value_plan_cycles")
            .select("plan_cycle_id, project_id, total_points, period_start_ym, period_end_ym")
            .in("project_id", values: projectIds)
            .eq("status", value: "fixed")
            .execute().value) ?? []
        async let reportsTask: [MonthlyReportRow] = (try? client.database
            .from("monthly_reports")
            .select("project_id, ym, section_members")
            .in("project_id", values: projectIds)
            .in("ym", values: targetYms)
            .execute().value) ?? []

        let (cycles, plans, reports) = await (cyclesTask, plansTask, reportsTask)

        // plan_cycle_id → milestones → progress を順番に取得
        // milestone_monthly_progress に plan_cycle_id カラムはないため milestone_key で絞る
        let safePlans = plans.compactMap { row -> SafePlan? in
            guard let projectId = row.projectId, !projectId.isEmpty,
                  let planCycleId = row.planCycleId, !planCycleId.isEmpty else { return nil }
            return SafePlan(
                planCycleId: planCycleId,
                projectId: projectId,
                totalPoints: row.totalPoints,
                periodStartYm: row.periodStartYm,
                periodEndYm: row.periodEndYm
            )
        }
        let planCycleIds = safePlans.map(\.planCycleId)
        let progressYms = generateTargetYms(monthsBack: 7)
        var msRows: [MSRow] = []
        var progressRows: [ProgressRow] = []
        if !planCycleIds.isEmpty {
            msRows = (try? await client.database
                .from("value_milestones")
                .select("plan_cycle_id, milestone_id, title, points, tag, is_active")
                .in("plan_cycle_id", values: planCycleIds)
                .eq("is_active", value: true)
                .execute().value) ?? []
            let milestoneIds = msRows.compactMap(\.milestoneId)
            if !milestoneIds.isEmpty {
                progressRows = (try? await client.database
                    .from("milestone_monthly_progress")
                    .select("milestone_key, ym, progress_pct, source, note")
                    .in("milestone_key", values: milestoneIds)
                    .in("ym", values: progressYms)
                    .execute().value) ?? []
            }
        }

        // --- Phase 3: 組み立て ---
        let planByProject = Dictionary(grouping: safePlans, by: \.projectId).compactMapValues { $0.first }
        let msByPlan = Dictionary(grouping: msRows.compactMap { row -> SafeMilestone? in
            guard let planCycleId = row.planCycleId, !planCycleId.isEmpty,
                  let milestoneId = row.milestoneId, !milestoneId.isEmpty else { return nil }
            return SafeMilestone(
                planCycleId: planCycleId,
                milestoneId: milestoneId,
                title: row.title,
                points: row.points,
                tag: row.tag
            )
        }, by: \.planCycleId)
        let cycleMap = Dictionary(grouping: cycles.compactMap { row -> SafeCycle? in
            guard let projectId = row.projectId, !projectId.isEmpty,
                  let ym = row.ym, !ym.isEmpty else { return nil }
            return SafeCycle(projectId: projectId, ym: ym, status: row.status, memberAllocationsJson: row.memberAllocationsJson, rewardSummaryJson: row.rewardSummaryJson)
        }) { "\($0.projectId)_\($0.ym)" }
        let progressMap = Dictionary(grouping: progressRows.compactMap { row -> SafeProgress? in
            guard let milestoneKey = row.milestoneKey, !milestoneKey.isEmpty,
                  let ym = row.ym, !ym.isEmpty else { return nil }
            return SafeProgress(milestoneKey: milestoneKey, ym: ym, progressPct: row.progressPct, source: row.source, note: row.note)
        }) { "\($0.milestoneKey)_\($0.ym)" }
        let reportMap: [String: MonthlyReportRow] = Dictionary(
            reports.compactMap { row -> (String, MonthlyReportRow)? in
                guard let projectId = row.projectId, !projectId.isEmpty,
                      let ym = row.ym, !ym.isEmpty else { return nil }
                return ("\(projectId)_\(ym)", row)
            },
            uniquingKeysWith: { _, last in last }
        )

        let currentYm = currentYmString()

        var months: [MyPageMonth] = []
        for ym in targetYms.sorted().reversed() {
            let prevYm = prevMonthYm(ym)
            var monthProjects: [MyPageProject] = []

            for pid in projectIds {
                let cycleKey = "\(pid)_\(ym)"
                let cycle = cycleMap[cycleKey]?.first
                let myAllocation = cycle?.memberAllocationsJson?[memberId]

                let allocationStatus: MyPageProject.AllocationStatus
                if let status = cycle?.status {
                    if status == "allocation_confirmed" || status == "budget_confirmed" {
                        allocationStatus = .confirmed
                    } else if status == "reported" {
                        allocationStatus = .reported
                    } else {
                        allocationStatus = .notSet
                    }
                } else {
                    allocationStatus = .notSet
                }

                // Milestones — 当月差分があったものだけ表示（その月に進捗がなかったMSは載せない）
                var milestones: [MyPageMilestone] = []
                if let plan = planByProject[pid],
                   let msOfPlan = msByPlan[plan.planCycleId] {
                    milestones = msOfPlan.compactMap { ms -> MyPageMilestone? in
                        let msKey = ms.milestoneId
                        let progKey = "\(msKey)_\(ym)"
                        let prevKey = "\(msKey)_\(prevYm)"
                        let currentRow = progressMap[progKey]?.first
                        let curPct = currentRow?.progressPct ?? 0
                        let prevPct = progressMap[prevKey]?.first?.progressPct ?? 0
                        let monthlyPct = max(0, curPct - prevPct)
                        guard monthlyPct > 0.01 else { return nil }
                        return MyPageMilestone(
                            milestoneKey: msKey,
                            title: ms.title ?? msKey,
                            maxPoints: ms.points ?? 0,
                            tag: ms.tag ?? "normal",
                            progressPct: curPct,
                            monthlyProgressPct: monthlyPct,
                            monthlyNote: currentRow?.note,
                            monthlySource: currentRow?.source
                        )
                    }.sorted { $0.milestoneKey < $1.milestoneKey }
                }

                let report = reportMap["\(pid)_\(ym)"]
                let myRewardRow = cycle?.rewardSummaryJson?.members?.first(where: { $0.memberId == memberId })
                monthProjects.append(MyPageProject(
                    projectId: pid,
                    projectName: projNameMap[pid] ?? pid,
                    allocation: myAllocation,
                    allocationStatus: allocationStatus,
                    milestones: milestones,
                    billingStatus: cycle?.status ?? "not_started",
                    sectionMembers: report?.sectionMembers,
                    monthlyEstimatedRewardYen: myRewardRow?.totalPay,
                    monthlyEarnedPt: myRewardRow?.earnedPt
                ))
            }

            // allocation のある PJ を上に
            monthProjects.sort { ($0.allocation ?? 0) > ($1.allocation ?? 0) }

            months.append(MyPageMonth(
                ym: ym,
                isCurrent: ym == currentYm,
                projects: monthProjects
            ))
        }

        return MyPageData(memberId: memberId, codeName: me.codeName ?? "", months: months)
    }

    /// マイページ上部の「今やること通知」を取得
    /// 参加中PJの routine-flow(main) から current/warn/overdue/pending のステップを抽出
    func fetchMyPageNotifications(email: String, limit: Int = 6) async throws -> [MyPageNotification] {
        struct MemberRow: Decodable {
            let memberId: String?
            enum CodingKeys: String, CodingKey { case memberId = "member_id" }
        }
        struct PMRow: Decodable {
            let projectId: String?
            enum CodingKeys: String, CodingKey { case projectId = "project_id" }
        }
        struct ProjRow: Decodable {
            let projectId: String?
            let projectName: String?
            let status: String?
            let projectType: String?
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case projectName = "project_name"
                case status
                case projectType = "project_type"
            }
        }

        let members: [MemberRow] = (try? await client.database
            .from("members")
            .select("member_id")
            .eq("email", value: email.lowercased())
            .limit(1)
            .execute().value) ?? []
        guard let memberId = members.first?.memberId, !memberId.isEmpty else { return [] }

        let pms: [PMRow] = (try? await client.database
            .from("project_members")
            .select("project_id")
            .eq("member_id", value: memberId)
            .eq("is_active", value: true)
            .execute().value) ?? []
        let projectIds = Array(Set(pms.compactMap(\.projectId))).sorted()
        guard !projectIds.isEmpty else { return [] }

        let projects: [ProjRow] = (try? await client.database
            .from("projects")
            .select("project_id, project_name, status, project_type")
            .in("project_id", values: projectIds)
            .execute().value) ?? []
        let activeProjects = projects.compactMap { row -> ProjRow? in
            guard let projectId = row.projectId, !projectId.isEmpty else { return nil }
            return ProjRow(
                projectId: projectId,
                projectName: row.projectName,
                status: row.status,
                projectType: row.projectType
            )
        }.filter { ($0.status ?? "").lowercased() == "active" }
        let activeProjectIds = activeProjects.compactMap(\.projectId)
        guard !activeProjectIds.isEmpty else { return [] }
        let projNameMap = Dictionary(uniqueKeysWithValues: activeProjects.compactMap { row -> (String, String)? in
            guard let projectId = row.projectId else { return nil }
            return (projectId, row.projectName ?? projectId)
        })
        let projTypeMap = Dictionary(uniqueKeysWithValues: activeProjects.compactMap { row -> (String, String)? in
            guard let projectId = row.projectId,
                  let projectType = row.projectType else { return nil }
            return (projectId, projectType)
        })

        var collected: [MyPageNotification] = []
        await withTaskGroup(of: [MyPageNotification].self) { group in
            for pid in activeProjectIds {
                group.addTask {
                    guard let flowData = try? await self.fetchRoutineFlow(projectId: pid) else {
                        return []
                    }
                    guard let flow = flowData.flows.first(where: { $0.role == "main" }) ?? flowData.flows.first else {
                        return []
                    }
                    let actionableStatuses: Set<String> = ["current", "warn", "overdue", "pending"]
                    let projectType = projTypeMap[pid]
                    let ctbEstimateDraftMap: [String: Bool]
                    if (projectType ?? "").lowercased() == "ctb" {
                        ctbEstimateDraftMap = (try? await self.fetchCTBEstimateDraftMap(
                            projectId: pid,
                            yms: [flow.bizYm]
                        )) ?? [:]
                    } else {
                        ctbEstimateDraftMap = [:]
                    }
                    let reimbursementDoneMap = (try? await self.fetchReimbursementCompletionMap(
                        projectId: pid,
                        yms: [flow.bizYm]
                    )) ?? [:]
                    // billing_cycles.status を取得して「申告済み＝admin待ち」の budget ステップを PM 側 TODO から除外
                    let billingStatus = (try? await self.fetchBillingCycleStatusSimple(projectId: pid, ym: flow.bizYm)) ?? "draft"

                    let notes = visibleRoutineSteps(
                        for: projectType,
                        in: flow,
                        ctbEstimateDraftMap: ctbEstimateDraftMap,
                        reimbursementDoneMap: reimbursementDoneMap
                    )
                        .filter { step in
                            actionableStatuses.contains(step.status) &&
                            !step.done &&
                            !step.isDeferred &&
                            step.isTappable &&
                            // PM が申告済み（reported）なら budget ステップは admin 待ち → PM 側 TODO から除外
                            !(step.stepId == "budget" && billingStatus == "reported")
                        }
                        .map { step in
                            MyPageNotification(
                                id: "\(pid)_\(step.stepId)_\(flow.bizYm)",
                                projectId: pid,
                                projectName: projNameMap[pid] ?? pid,
                                bizYm: flow.bizYm,
                                stepId: step.stepId,
                                stepLabel: step.label,
                                status: step.status,
                                deadline: step.deadline
                            )
                        }
                    return notes
                }
            }
            for await notifications in group {
                collected.append(contentsOf: notifications)
            }
        }

        func rank(_ status: String) -> Int {
            switch status {
            case "overdue": return 0
            case "warn": return 1
            case "current": return 2
            case "pending": return 3
            default: return 9
            }
        }

        let legacyTargets = Array(
            Dictionary(
                collected
                    .filter { $0.bizYm <= "202512" }
                    .map { ("\($0.projectId)_\($0.bizYm)", ($0.projectId, $0.bizYm)) },
                uniquingKeysWith: { first, _ in first }
            ).values
        )
        if !legacyTargets.isEmpty {
            for (projectId, bizYm) in legacyTargets {
                try? await markLegacyBillingCycleFullyDone(projectId: projectId, ym: bizYm, byEmail: email)
            }
        }

        return collected
            .filter { $0.bizYm > "202512" }
            .sorted {
                if rank($0.status) != rank($1.status) { return rank($0.status) < rank($1.status) }
                return $0.title < $1.title
            }
            .prefix(max(1, limit))
            .map { $0 }
    }

    // MARK: - MyPage Helpers

    private nonisolated func currentYmString() -> String {
        let cal = Calendar.current
        let now = Date()
        let y = cal.component(.year, from: now)
        let m = cal.component(.month, from: now)
        return String(format: "%04d%02d", y, m)
    }

    private nonisolated func generateTargetYms(monthsBack: Int) -> [String] {
        let cal = Calendar.current
        let now = Date()
        var yms: [String] = []
        for i in (-monthsBack)...0 {
            if let d = cal.date(byAdding: .month, value: i, to: now) {
                let y = cal.component(.year, from: d)
                let m = cal.component(.month, from: d)
                yms.append(String(format: "%04d%02d", y, m))
            }
        }
        return yms
    }

    // MARK: - Cockpit

    /// PJコックピット全体データを取得（MS一覧 + 月次カード）
    func fetchCockpitData(projectId: String) async throws -> CockpitData {
        struct PlanRow: Decodable {
            let planCycleId: String
            let status: String?
            let totalPoints: Int?
            let periodStartYm: String?
            let periodEndYm: String?
            enum CodingKeys: String, CodingKey {
                case planCycleId = "plan_cycle_id"
                case status
                case totalPoints = "total_points"
                case periodStartYm = "period_start_ym"
                case periodEndYm = "period_end_ym"
            }
        }
        struct MSRow: Decodable {
            let milestoneId: String
            let title: String?
            let points: Int?
            let tag: String?
            let orderNo: Int?
            let successCriteria: String?
            enum CodingKeys: String, CodingKey {
                case milestoneId = "milestone_id"
                case title, points, tag
                case orderNo = "sort_order"
                case successCriteria = "success_criteria"
            }
        }
        struct SubItemRow: Decodable {
            let subItemId: String
            let milestoneId: String
            let orderNo: Int?
            let title: String?
            let status: String?
            enum CodingKeys: String, CodingKey {
                case subItemId = "sub_item_id"
                case milestoneId = "milestone_id"
                case orderNo = "weight"
                case title
                case status
            }
        }
        struct ProgressRow: Decodable {
            let milestoneKey: String
            let ym: String
            let progressPct: Double?
            let source: String?
            let note: String?
            enum CodingKeys: String, CodingKey {
                case milestoneKey = "milestone_key"
                case ym
                case progressPct = "progress_pct"
                case source
                case note
            }
        }
        struct RewardMemberRow: Decodable {
            let memberId: String?
            let memberName: String?
            let earnedPt: Double?
            let totalPay: Double?
            enum CodingKeys: String, CodingKey {
                case memberId
                case memberName
                case earnedPt
                case totalPay
            }
        }
        struct RewardSummaryRow: Decodable {
            let expectedRate: Double?
            let ptUnit: Double?
            let members: [RewardMemberRow]?
            enum CodingKeys: String, CodingKey {
                case expectedRate
                case ptUnit
                case members
            }
        }
        struct CycleRow: Decodable {
            let ym: String
            let status: String?
            let budgetYen: Double?
            let rewardSummary: RewardSummaryRow?
            enum CodingKeys: String, CodingKey {
                case ym, status
                case budgetYen = "budget_yen"
                case rewardSummary = "reward_summary_json"
            }
        }
        struct ReportRow: Decodable {
            let ym: String
            let status: String?
            enum CodingKeys: String, CodingKey { case ym, status }
        }

        // Phase 1: project + plan cycle (parallel)
        async let projectTask: [SupabaseProject] = client.database
            .from("projects")
            .select("project_id, project_name, client_name, status, start_ym, end_ym")
            .eq("project_id", value: projectId)
            .execute().value
        async let planTask: [PlanRow] = client.database
            .from("value_plan_cycles")
            .select("plan_cycle_id, status, total_points, period_start_ym, period_end_ym")
            .eq("project_id", value: projectId)
            .in("status", values: ["active", "confirmed", "fixed", "draft"])
            .order("period_start_ym", ascending: false)
            .execute().value

        let (projects, planRows) = try await (projectTask, planTask)
        guard let project = projects.first else {
            throw NSError(domain: "Cockpit", code: 404,
                          userInfo: [NSLocalizedDescriptionKey: "プロジェクトが見つかりません"])
        }

        func ymInt(_ ym: String?) -> Int? {
            guard let ym, ym.count == 6 else { return nil }
            return Int(ym)
        }
        let currentYm = ymInt(currentYmString()) ?? 0
        let sortedPlans = planRows.sorted { lhs, rhs in
            let lhsEnd = ymInt(lhs.periodEndYm) ?? -1
            let rhsEnd = ymInt(rhs.periodEndYm) ?? -1
            if lhsEnd != rhsEnd { return lhsEnd > rhsEnd }
            let lhsStart = ymInt(lhs.periodStartYm) ?? -1
            let rhsStart = ymInt(rhs.periodStartYm) ?? -1
            if lhsStart != rhsStart { return lhsStart > rhsStart }
            return lhs.planCycleId > rhs.planCycleId
        }
        let selectedPlan = sortedPlans.first(where: { plan in
            guard let start = ymInt(plan.periodStartYm) else { return false }
            let end = ymInt(plan.periodEndYm)
            if let end { return start <= currentYm && currentYm <= end }
            return start <= currentYm
        }) ?? sortedPlans.first

        // Phase 2: milestones + progress (if plan exists)
        let targetYms = generateTargetYms(monthsBack: 5)
        var planCycle: CockpitPlanCycle?
        var milestones: [CockpitMilestone] = []
        var progressRows: [ProgressRow] = []

        if let plan = selectedPlan {
            planCycle = CockpitPlanCycle(
                planCycleId: plan.planCycleId,
                status: plan.status ?? "active",
                totalPoints: plan.totalPoints ?? 0,
                periodStartYm: plan.periodStartYm ?? "",
                periodEndYm: plan.periodEndYm ?? ""
            )
            let msRows: [MSRow] = try await client.database
                .from("value_milestones")
                .select("milestone_id, title, points, tag, sort_order, success_criteria")
                .eq("plan_cycle_id", value: plan.planCycleId)
                .eq("is_active", value: true)
                .order("sort_order")
                .execute().value

            let milestoneIds = msRows.map(\.milestoneId)
            var subItemMap: [String: [CockpitSubItem]] = [:]
            if !milestoneIds.isEmpty {
                let subRows: [SubItemRow] = try await client.database
                    .from("milestone_sub_items")
                    .select("sub_item_id, milestone_id, weight, title, status")
                    .in("milestone_id", values: milestoneIds)
                    .order("weight")
                    .execute().value
                for row in subRows {
                    let item = CockpitSubItem(
                        id: row.subItemId,
                        subItemId: row.subItemId,
                        title: row.title ?? "",
                        startYm: nil,
                        targetYm: nil,
                        isDone: (row.status ?? "open").lowercased() == "done",
                        orderNo: row.orderNo ?? 0
                    )
                    subItemMap[row.milestoneId, default: []].append(item)
                }
            }
            if !milestoneIds.isEmpty {
                progressRows = try await client.database
                    .from("milestone_monthly_progress")
                    .select("milestone_key, ym, progress_pct, source, note")
                    .in("milestone_key", values: milestoneIds)
                    .in("ym", values: generateTargetYms(monthsBack: 7))
                    .execute().value
            }

            let progressMap = Dictionary(grouping: progressRows) { "\($0.milestoneKey)_\($0.ym)" }
            let curYm = currentYmString()
            milestones = msRows.map { ms in
                let rawCurPct = progressMap["\(ms.milestoneId)_\(curYm)"]?.first?.progressPct ?? 0
                let curPct = rawCurPct.isFinite ? min(max(rawCurPct, 0), 100) : 0
                return CockpitMilestone(
                    id: ms.milestoneId,
                    milestoneId: ms.milestoneId,
                    title: ms.title ?? ms.milestoneId,
                    points: ms.points ?? 0,
                    tag: ms.tag ?? "normal",
                    targetYm: nil,
                    successCriteria: ms.successCriteria ?? "",
                    currentProgressPct: curPct
                    ,
                    subItems: subItemMap[ms.milestoneId, default: []]
                )
            }
        }

        // Phase 3: billing_cycles + monthly_reports (parallel)
        async let cyclesTask: [CycleRow] = client.database
            .from("billing_cycles")
            .select("ym, status, budget_yen, reward_summary_json")
            .eq("project_id", value: projectId)
            .in("ym", values: targetYms)
            .execute().value
        async let reportsTask: [ReportRow] = client.database
            .from("monthly_reports")
            .select("ym, status")
            .eq("project_id", value: projectId)
            .in("ym", values: targetYms)
            .execute().value

        let (cycles, reports) = try await (cyclesTask, reportsTask)
        let cycleMap = Dictionary(cycles.map { ($0.ym, $0) }, uniquingKeysWith: { _, l in l })
        let reportMap = Dictionary(reports.map { ($0.ym, $0) }, uniquingKeysWith: { _, l in l })
        let progressByMs = Dictionary(grouping: progressRows, by: \.milestoneKey)
        func expectedPctByPlan(for ym: String) -> Double? {
            guard let plan = selectedPlan,
                  let start = ymInt(plan.periodStartYm),
                  let end = ymInt(plan.periodEndYm),
                  let target = ymInt(ym),
                  start <= end else { return nil }
            let startY = start / 100
            let startM = start % 100
            let endY = end / 100
            let endM = end % 100
            let targetY = target / 100
            let targetM = target % 100
            let totalMonths = (endY - startY) * 12 + (endM - startM) + 1
            let elapsed = (targetY - startY) * 12 + (targetM - startM) + 1
            guard totalMonths > 0 else { return nil }
            let ratio = min(max(Double(elapsed) / Double(totalMonths), 0), 1)
            return ratio * 100
        }

        let monthlyCards: [CockpitMonthCard] = targetYms.sorted().reversed().map { ym in
            let prevYm = prevMonthYm(ym)
            let cycle = cycleMap[ym]
            let report = reportMap[ym]
            let rewardSummary = cycle?.rewardSummary

            let msItems: [MonthMsItem] = milestones.map { ms in
                let rows = progressByMs[ms.milestoneId] ?? []
                let currentRow = rows.first(where: { $0.ym == ym })
                let rawCurPct = currentRow?.progressPct ?? 0
                let rawPrevPct = rows.first(where: { $0.ym == prevYm })?.progressPct ?? 0
                let curPct = rawCurPct.isFinite ? min(max(rawCurPct, 0), 100) : 0
                let prevPct = rawPrevPct.isFinite ? min(max(rawPrevPct, 0), 100) : 0
                return MonthMsItem(
                    id: "\(ms.milestoneId)_\(ym)",
                    milestoneId: ms.milestoneId,
                    title: ms.title,
                    points: ms.points,
                    tag: ms.tag,
                    cumulativePct: curPct,
                    monthlyPct: max(0, curPct - prevPct),
                    monthlySource: currentRow?.source,
                    monthlyNote: currentRow?.note
                )
            }
            let totalPt = msItems.reduce(0.0) { partial, item in
                let normalized = item.monthlyPct.isFinite ? item.monthlyPct : 0
                return partial + (normalized / 100.0) * Double(item.points)
            }
            let memberRewards: [CockpitMemberReward] = (rewardSummary?.members ?? []).enumerated().map { idx, member in
                let memberId = member.memberId ?? "member_\(idx)"
                let name = (member.memberName?.isEmpty == false) ? (member.memberName ?? memberId) : memberId
                return CockpitMemberReward(
                    id: "\(ym)_\(memberId)_\(idx)",
                    memberId: memberId,
                    memberName: name,
                    earnedPt: member.earnedPt ?? 0,
                    estimatedRewardYen: member.totalPay ?? 0
                )
            }.sorted { $0.earnedPt > $1.earnedPt }

            return CockpitMonthCard(
                id: ym,
                ym: ym,
                displayYm: ymDisplay(ym),
                billingStatus: cycle?.status ?? "not_started",
                budgetYen: cycle?.budgetYen,
                msItems: msItems,
                expectedPct: rewardSummary?.expectedRate ?? expectedPctByPlan(for: ym),
                memberRewards: memberRewards,
                reportStatus: report?.status,
                totalMonthlyPt: totalPt
            )
        }

        return CockpitData(
            project: project,
            planCycle: planCycle,
            milestones: milestones,
            monthlyCards: monthlyCards
        )
    }

    /// プランを fixed に確定する（active / confirmed / draft → fixed）
    /// fixed に上げると GAS 側が billing_cycles.reward_summary_json を計算する。
    func fixPlanCycle(planCycleId: String) async throws {
        struct Row: Encodable { let status: String }
        try await client.database
            .from("value_plan_cycles")
            .update(Row(status: "fixed"))
            .eq("plan_cycle_id", value: planCycleId)
            .execute()
    }

    /// MS月次進捗を UPSERT（milestone_monthly_progress テーブル）
    func upsertMilestoneProgress(milestoneId: String, ym: String, progressPct: Double) async throws {
        struct Row: Encodable {
            let milestone_key: String
            let ym: String
            let progress_pct: Double
        }
        try await client.database
            .from("milestone_monthly_progress")
            .upsert(Row(milestone_key: milestoneId, ym: ym, progress_pct: progressPct),
                    onConflict: "milestone_key,ym")
            .execute()
    }

    func updateCockpitMilestones(planCycleId: String, milestones: [CockpitMilestoneDraft], newTotalPoints: Int) async throws {
        struct Row: Encodable {
            let milestone_id: String
            let plan_cycle_id: String
            let title: String
            let points: Int
            let tag: String
            let sort_order: Int
            let success_criteria: String
            let is_active: Bool
        }
        let rows = milestones.map { draft in
            Row(
                milestone_id: draft.milestoneId,
                plan_cycle_id: planCycleId,
                title: draft.title,
                points: draft.points,
                tag: draft.tag,
                sort_order: draft.orderNo,
                success_criteria: draft.successCriteria,
                is_active: true
            )
        }
        try await client.database
            .from("value_milestones")
            .upsert(rows, onConflict: "milestone_id")
            .execute()

        struct PlanUpdate: Encodable { let total_points: Int }
        try await client.database
            .from("value_plan_cycles")
            .update(PlanUpdate(total_points: newTotalPoints))
            .eq("plan_cycle_id", value: planCycleId)
            .execute()
    }

    func replaceMilestoneSubItems(milestoneId: String, items: [CockpitSubItemDraft]) async throws {
        let existing: [SubItemIdRow] = try await client.database
            .from("milestone_sub_items")
            .select("sub_item_id")
            .eq("milestone_id", value: milestoneId)
            .execute().value
        let keepIds = Set(items.compactMap { $0.subItemId.nilIfEmpty })
        let deleteIds = existing.map(\.subItemId).filter { !keepIds.contains($0) }
        if !deleteIds.isEmpty {
            try await client.database
                .from("milestone_sub_items")
                .delete()
                .in("sub_item_id", values: deleteIds)
                .execute()
        }

        struct Row: Encodable {
            let sub_item_id: String
            let milestone_id: String
            let weight: Int
            let title: String
            let status: String
        }
        let rows = items.enumerated().map { index, item in
            Row(
                sub_item_id: item.subItemId.nilIfEmpty ?? UUID().uuidString.lowercased(),
                milestone_id: milestoneId,
                weight: index + 1,
                title: item.title,
                status: item.isDone ? "done" : "open"
            )
        }
        guard !rows.isEmpty else { return }
        try await client.database
            .from("milestone_sub_items")
            .upsert(rows, onConflict: "sub_item_id")
            .execute()
    }

    func toggleCockpitSubItemDone(subItemId: String, isDone: Bool) async throws {
        struct Row: Encodable { let status: String }
        try await client.database
            .from("milestone_sub_items")
            .update(Row(status: isDone ? "done" : "open"))
            .eq("sub_item_id", value: subItemId)
            .execute()
    }

    func applyCriteriaProgress(milestoneId: String, ym: String, successCriteria: String) async throws {
        let lines = successCriteria
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        guard !lines.isEmpty else { return }
        let doneCount = lines.filter { $0.lowercased().hasPrefix("[x") }.count
        let pct = (Double(doneCount) / Double(lines.count)) * 100
        try await upsertMilestoneProgress(milestoneId: milestoneId, ym: ym, progressPct: pct)
    }

    // MARK: - Routine Flow (Edge Function)

    /// ルーティンフローを Edge Function から取得
    func fetchRoutineFlow(projectId: String) async throws -> RoutineFlowFullData {
        var components = URLComponents(url: edgeFunctionBaseURL.appendingPathComponent("routine-flow"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "projectId", value: projectId),
            URLQueryItem(name: "project_id", value: projectId)
        ]
        guard let url = components?.url else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "projectId": projectId,
            "project_id": projectId
        ])

        let (data, response) = try await dataWithHardTimeout(for: request, seconds: 8)
        guard let http = response as? HTTPURLResponse else {
            throw NSError(
                domain: "routine-flow",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "routine-flow response missing"]
            )
        }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? "unknown error"
            throw NSError(
                domain: "routine-flow",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: "routine-flow \(http.statusCode): \(body)"]
            )
        }
        return try JSONDecoder().decode(RoutineFlowFullData.self, from: data)
    }
    // MARK: - MS Activities (memberごとの「やったこと」narrative)

    /// member × ym で MS narrative を取得（マイページMS表示用）
    func fetchMyMsActivities(memberId: String, ym: String) async throws -> [String: MemberMsActivity] {
        struct Row: Decodable {
            let memberId: String
            let milestoneId: String
            let ym: String
            let narrative: String?
            let learnedAddendum: String?
            let generatedAt: String?
            enum CodingKeys: String, CodingKey {
                case memberId = "member_id"
                case milestoneId = "milestone_id"
                case ym
                case narrative
                case learnedAddendum = "learned_addendum"
                case generatedAt = "generated_at"
            }
        }
        let rows: [Row] = (try? await client.database
            .from("member_ms_activities")
            .select("member_id, milestone_id, ym, narrative, learned_addendum, generated_at")
            .eq("member_id", value: memberId)
            .eq("ym", value: ym)
            .execute().value) ?? []
        var map: [String: MemberMsActivity] = [:]
        let isoFmt = ISO8601DateFormatter()
        isoFmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        for r in rows {
            // narrative or learned_addendum どちらかがあれば返す
            let hasNarrative = (r.narrative ?? "").isEmpty == false
            let hasLearned = (r.learnedAddendum ?? "").isEmpty == false
            guard hasNarrative || hasLearned else { continue }
            let date = r.generatedAt.flatMap { isoFmt.date(from: $0) }
            map[r.milestoneId] = MemberMsActivity.make(
                memberId: r.memberId,
                milestoneId: r.milestoneId,
                ym: r.ym,
                narrative: r.narrative ?? "",
                learnedAddendum: r.learnedAddendum,
                generatedAt: date
            )
        }
        return map
    }

    /// 必要に応じて attribute-ms-activity Edge Function を呼んでキャッシュ生成
    func generateMsActivities(projectId: String, ym: String) async {
        let url = edgeFunctionBaseURL.appendingPathComponent("attribute-ms-activity")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        let body: [String: Any] = ["project_id": projectId, "ym": ym]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        _ = try? await dataWithHardTimeout(for: req, seconds: 30)
    }

    // MARK: - Proposals

    /// 提案を作成（メンバーから）+ 1件目メッセージとして本文を保存
    func createProposal(
        memberId: String,
        projectId: String,
        milestoneId: String,
        ym: String,
        suggestedPct: Double?,
        suggestedText: String
    ) async throws -> String {
        struct InsertRow: Encodable {
            let member_id: String
            let project_id: String
            let milestone_id: String
            let ym: String
            let suggested_pct: Double?
            let suggested_text: String
            let status: String
        }
        struct Returned: Decodable { let id: String }
        let row = InsertRow(
            member_id: memberId,
            project_id: projectId,
            milestone_id: milestoneId,
            ym: ym,
            suggested_pct: suggestedPct,
            suggested_text: suggestedText,
            status: "pending"
        )
        let inserted: [Returned] = try await client.database
            .from("ms_progress_proposals")
            .insert(row)
            .select("id")
            .execute().value
        guard let id = inserted.first?.id else {
            throw NSError(domain: "Proposal", code: 0, userInfo: [NSLocalizedDescriptionKey: "提案IDが返らなかった"])
        }
        // 本文を最初のメッセージとして保存
        struct MsgRow: Encodable {
            let proposal_id: String
            let sender_kind: String
            let body: String
        }
        try await client.database
            .from("ms_proposal_messages")
            .insert(MsgRow(proposal_id: id, sender_kind: "member", body: suggestedText))
            .execute()
        return id
    }

    /// 自分の提案 + メッセージスレッドを取得（マイページ用、特定MS×ym絞り込み可）
    func fetchMyProposals(
        memberId: String,
        milestoneId: String? = nil,
        ym: String? = nil
    ) async throws -> [MsProgressProposal] {
        struct Row: Decodable {
            let id: String
            let memberId: String
            let projectId: String
            let milestoneId: String
            let ym: String
            let suggestedPct: Double?
            let suggestedText: String?
            let status: String
            let rejectReasonRaw: String?
            let createdAt: String?
            let reviewedAt: String?
            enum CodingKeys: String, CodingKey {
                case id
                case memberId = "member_id"
                case projectId = "project_id"
                case milestoneId = "milestone_id"
                case ym
                case suggestedPct = "suggested_pct"
                case suggestedText = "suggested_text"
                case status
                case rejectReasonRaw = "reject_reason_raw"
                case createdAt = "created_at"
                case reviewedAt = "reviewed_at"
            }
        }
        var query = client.database
            .from("ms_progress_proposals")
            .select("id, member_id, project_id, milestone_id, ym, suggested_pct, suggested_text, status, reject_reason_raw, created_at, reviewed_at")
            .eq("member_id", value: memberId)
        if let milestoneId { query = query.eq("milestone_id", value: milestoneId) }
        if let ym { query = query.eq("ym", value: ym) }
        let rows: [Row] = (try? await query.order("created_at", ascending: false).execute().value) ?? []
        if rows.isEmpty { return [] }

        let messages = try await fetchProposalMessages(proposalIds: rows.map(\.id))
        let isoFmt = ISO8601DateFormatter()
        isoFmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        return rows.map { r in
            MsProgressProposal(
                id: r.id,
                memberId: r.memberId,
                memberName: nil,
                projectId: r.projectId,
                projectName: nil,
                milestoneId: r.milestoneId,
                milestoneTitle: nil,
                ym: r.ym,
                suggestedPct: r.suggestedPct,
                suggestedText: r.suggestedText,
                status: MsProposalStatus(rawValue: r.status) ?? .pending,
                rejectReasonRaw: r.rejectReasonRaw,
                createdAt: r.createdAt.flatMap { isoFmt.date(from: $0) },
                reviewedAt: r.reviewedAt.flatMap { isoFmt.date(from: $0) },
                messages: messages[r.id] ?? []
            )
        }
    }

    /// pending な全提案（admin タブ提案箱）
    func fetchPendingProposals() async throws -> [MsProgressProposal] {
        struct Row: Decodable {
            let id: String
            let memberId: String
            let projectId: String
            let milestoneId: String
            let ym: String
            let suggestedPct: Double?
            let suggestedText: String?
            let status: String
            let rejectReasonRaw: String?
            let createdAt: String?
            let reviewedAt: String?
            enum CodingKeys: String, CodingKey {
                case id
                case memberId = "member_id"
                case projectId = "project_id"
                case milestoneId = "milestone_id"
                case ym
                case suggestedPct = "suggested_pct"
                case suggestedText = "suggested_text"
                case status
                case rejectReasonRaw = "reject_reason_raw"
                case createdAt = "created_at"
                case reviewedAt = "reviewed_at"
            }
        }
        let rows: [Row] = (try? await client.database
            .from("ms_progress_proposals")
            .select("id, member_id, project_id, milestone_id, ym, suggested_pct, suggested_text, status, reject_reason_raw, created_at, reviewed_at")
            .eq("status", value: "pending")
            .order("created_at", ascending: false)
            .execute().value) ?? []
        if rows.isEmpty { return [] }

        // 表示補助: member name / project name / milestone title
        let memberIds = Array(Set(rows.map(\.memberId)))
        let projIds = Array(Set(rows.map(\.projectId)))
        let msIds = Array(Set(rows.map(\.milestoneId)))

        struct MemberLite: Decodable {
            let memberId: String
            let codeName: String?
            enum CodingKeys: String, CodingKey {
                case memberId = "member_id"
                case codeName = "code_name"
            }
        }
        struct ProjLite: Decodable {
            let projectId: String
            let projectName: String?
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case projectName = "project_name"
            }
        }
        struct MsLite: Decodable {
            let milestoneId: String
            let title: String?
            enum CodingKeys: String, CodingKey {
                case milestoneId = "milestone_id"
                case title
            }
        }

        async let mTask: [MemberLite] = (try? client.database
            .from("members").select("member_id, code_name").in("member_id", values: memberIds).execute().value) ?? []
        async let pTask: [ProjLite] = (try? client.database
            .from("projects").select("project_id, project_name").in("project_id", values: projIds).execute().value) ?? []
        async let mmTask: [MsLite] = (try? client.database
            .from("value_milestones").select("milestone_id, title").in("milestone_id", values: msIds).execute().value) ?? []
        let (members, projects, msArr) = await (mTask, pTask, mmTask)

        let memberMap = Dictionary(uniqueKeysWithValues: members.map { ($0.memberId, $0.codeName ?? $0.memberId) })
        let projMap = Dictionary(uniqueKeysWithValues: projects.map { ($0.projectId, $0.projectName ?? $0.projectId) })
        let msMap = Dictionary(uniqueKeysWithValues: msArr.map { ($0.milestoneId, $0.title ?? $0.milestoneId) })

        let messages = try await fetchProposalMessages(proposalIds: rows.map(\.id))
        let isoFmt = ISO8601DateFormatter()
        isoFmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        return rows.map { r in
            MsProgressProposal(
                id: r.id,
                memberId: r.memberId,
                memberName: memberMap[r.memberId],
                projectId: r.projectId,
                projectName: projMap[r.projectId],
                milestoneId: r.milestoneId,
                milestoneTitle: msMap[r.milestoneId],
                ym: r.ym,
                suggestedPct: r.suggestedPct,
                suggestedText: r.suggestedText,
                status: MsProposalStatus(rawValue: r.status) ?? .pending,
                rejectReasonRaw: r.rejectReasonRaw,
                createdAt: r.createdAt.flatMap { isoFmt.date(from: $0) },
                reviewedAt: r.reviewedAt.flatMap { isoFmt.date(from: $0) },
                messages: messages[r.id] ?? []
            )
        }
    }

    private func fetchProposalMessages(proposalIds: [String]) async throws -> [String: [MsProposalMessage]] {
        struct Row: Decodable {
            let id: String
            let proposalId: String
            let senderKind: String
            let body: String
            let createdAt: String?
            enum CodingKeys: String, CodingKey {
                case id
                case proposalId = "proposal_id"
                case senderKind = "sender_kind"
                case body
                case createdAt = "created_at"
            }
        }
        if proposalIds.isEmpty { return [:] }
        let rows: [Row] = (try? await client.database
            .from("ms_proposal_messages")
            .select("id, proposal_id, sender_kind, body, created_at")
            .in("proposal_id", values: proposalIds)
            .order("created_at", ascending: true)
            .execute().value) ?? []
        let isoFmt = ISO8601DateFormatter()
        isoFmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var result: [String: [MsProposalMessage]] = [:]
        for r in rows {
            let kind = MsProposalSenderKind(rawValue: r.senderKind) ?? .member
            let item = MsProposalMessage(
                id: r.id,
                proposalId: r.proposalId,
                senderKind: kind,
                body: r.body,
                createdAt: r.createdAt.flatMap { isoFmt.date(from: $0) }
            )
            result[r.proposalId, default: []].append(item)
        }
        return result
    }

    /// 承認: pending → approved。同時に suggested_pct があれば milestone_monthly_progress に反映 + learned_addendum 追記
    func approveProposal(proposalId: String, adminId: String) async throws {
        struct Row: Decodable {
            let memberId: String
            let milestoneId: String
            let ym: String
            let projectId: String
            let suggestedPct: Double?
            let suggestedText: String?
            enum CodingKeys: String, CodingKey {
                case memberId = "member_id"
                case milestoneId = "milestone_id"
                case ym
                case projectId = "project_id"
                case suggestedPct = "suggested_pct"
                case suggestedText = "suggested_text"
            }
        }
        let rows: [Row] = (try? await client.database
            .from("ms_progress_proposals")
            .select("member_id, milestone_id, ym, project_id, suggested_pct, suggested_text")
            .eq("id", value: proposalId)
            .limit(1)
            .execute().value) ?? []
        guard let p = rows.first else {
            throw NSError(domain: "Proposal", code: 404, userInfo: [NSLocalizedDescriptionKey: "提案が見つかりません"])
        }
        struct UpdateRow: Encodable {
            let status: String
            let reviewed_by: String
            let reviewed_at: String
        }
        let nowIso = ISO8601DateFormatter().string(from: Date())
        try await client.database
            .from("ms_progress_proposals")
            .update(UpdateRow(status: "approved", reviewed_by: adminId, reviewed_at: nowIso))
            .eq("id", value: proposalId)
            .execute()

        // 進捗率の更新（提案された場合のみ）
        if let pct = p.suggestedPct {
            try await upsertMilestoneProgress(milestoneId: p.milestoneId, ym: p.ym, progressPct: pct)
        }

        // 学習: suggested_text を learned_addendum に追記
        if let text = p.suggestedText, !text.isEmpty {
            await appendLearnedAddendum(
                memberId: p.memberId,
                milestoneId: p.milestoneId,
                ym: p.ym,
                suggestedText: text
            )
        }

        // approved 通知メッセージを 1 件挿入（admin としての確認文）
        struct MsgRow: Encodable {
            let proposal_id: String
            let sender_kind: String
            let body: String
        }
        try await client.database
            .from("ms_proposal_messages")
            .insert(MsgRow(proposal_id: proposalId, sender_kind: "tsukuyomi", body: "提案が承認されたよ🌙 反映しといた！"))
            .execute()

        // narrative も再生成（学習データを反映）
        Task {
            await self.generateMsActivities(projectId: p.projectId, ym: p.ym)
        }
    }

    /// 承認時に「学習データ」として suggested_text を member_ms_activities.learned_addendum に追記
    private func appendLearnedAddendum(memberId: String, milestoneId: String, ym: String, suggestedText: String) async {
        struct ExistingRow: Decodable {
            let learnedAddendum: String?
            enum CodingKeys: String, CodingKey { case learnedAddendum = "learned_addendum" }
        }
        let existing: [ExistingRow] = (try? await client.database
            .from("member_ms_activities")
            .select("learned_addendum")
            .eq("member_id", value: memberId)
            .eq("milestone_id", value: milestoneId)
            .eq("ym", value: ym)
            .limit(1)
            .execute().value) ?? []

        let nowStamp = ISO8601DateFormatter().string(from: Date())
        let appendBlock = "[\(nowStamp)] \(suggestedText)"
        let merged: String
        if let prev = existing.first?.learnedAddendum, !prev.isEmpty {
            merged = prev + "\n" + appendBlock
        } else {
            merged = appendBlock
        }

        struct UpsertRow: Encodable {
            let member_id: String
            let milestone_id: String
            let ym: String
            let learned_addendum: String
        }
        _ = try? await client.database
            .from("member_ms_activities")
            .upsert(
                UpsertRow(member_id: memberId, milestone_id: milestoneId, ym: ym, learned_addendum: merged),
                onConflict: "member_id,milestone_id,ym"
            )
            .execute()
    }

    // MARK: - MS Progress Revisions (PM ↔ つくよみ)

    /// PM が修正依頼を投げる → revise-ms-progress Edge Function 呼び出し
    func requestMsRevision(
        projectId: String,
        milestoneId: String,
        ym: String,
        requestText: String,
        requestedBy: String,
        existingRevisionId: String? = nil
    ) async throws -> String {
        struct Resp: Decodable {
            let ok: Bool?
            let revision_id: String?
            let error: String?
        }
        let url = edgeFunctionBaseURL.appendingPathComponent("revise-ms-progress")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        var body: [String: Any] = [
            "project_id": projectId,
            "milestone_id": milestoneId,
            "ym": ym,
            "request_text": requestText,
            "requested_by": requestedBy
        ]
        if let existingRevisionId, !existingRevisionId.isEmpty {
            body["revision_id"] = existingRevisionId
        }
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await dataWithHardTimeout(for: req, seconds: 60)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let s = String(data: data, encoding: .utf8) ?? ""
            throw NSError(domain: "revise-ms-progress", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: s])
        }
        let decoded = try JSONDecoder().decode(Resp.self, from: data)
        return decoded.revision_id ?? ""
    }

    /// MS x ym の pending revision を取得
    func fetchMsRevisions(milestoneId: String, ym: String) async throws -> [MsProgressRevision] {
        struct Row: Decodable {
            let id: String
            let projectId: String
            let milestoneId: String
            let ym: String
            let currentPct: Double?
            let currentNote: String?
            let revisedPct: Double?
            let revisedNote: String?
            let status: String
            let requestedBy: String?
            let confirmedBy: String?
            let confirmedAt: String?
            let createdAt: String?
            enum CodingKeys: String, CodingKey {
                case id
                case projectId = "project_id"
                case milestoneId = "milestone_id"
                case ym
                case currentPct = "current_pct"
                case currentNote = "current_note"
                case revisedPct = "revised_pct"
                case revisedNote = "revised_note"
                case status
                case requestedBy = "requested_by"
                case confirmedBy = "confirmed_by"
                case confirmedAt = "confirmed_at"
                case createdAt = "created_at"
            }
        }
        let rows: [Row] = (try? await client.database
            .from("ms_progress_revisions")
            .select("id, project_id, milestone_id, ym, current_pct, current_note, revised_pct, revised_note, status, requested_by, confirmed_by, confirmed_at, created_at")
            .eq("milestone_id", value: milestoneId)
            .eq("ym", value: ym)
            .order("created_at", ascending: false)
            .execute().value) ?? []
        if rows.isEmpty { return [] }

        struct MsgRow: Decodable {
            let id: String
            let revisionId: String
            let senderKind: String
            let body: String
            let createdAt: String?
            enum CodingKeys: String, CodingKey {
                case id
                case revisionId = "revision_id"
                case senderKind = "sender_kind"
                case body
                case createdAt = "created_at"
            }
        }
        let revIds = rows.map(\.id)
        let msgRows: [MsgRow] = (try? await client.database
            .from("ms_revision_messages")
            .select("id, revision_id, sender_kind, body, created_at")
            .in("revision_id", values: revIds)
            .order("created_at", ascending: true)
            .execute().value) ?? []

        let isoFmt = ISO8601DateFormatter()
        isoFmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var msgsByRev: [String: [MsRevisionMessage]] = [:]
        for m in msgRows {
            let kind = MsRevisionSenderKind(rawValue: m.senderKind) ?? .pm
            msgsByRev[m.revisionId, default: []].append(
                MsRevisionMessage(
                    id: m.id, revisionId: m.revisionId,
                    senderKind: kind, body: m.body,
                    createdAt: m.createdAt.flatMap { isoFmt.date(from: $0) }
                )
            )
        }
        return rows.map { r in
            MsProgressRevision(
                id: r.id,
                projectId: r.projectId,
                milestoneId: r.milestoneId,
                ym: r.ym,
                currentPct: r.currentPct,
                currentNote: r.currentNote,
                revisedPct: r.revisedPct,
                revisedNote: r.revisedNote,
                status: MsRevisionStatus(rawValue: r.status) ?? .pending,
                requestedBy: r.requestedBy,
                confirmedBy: r.confirmedBy,
                confirmedAt: r.confirmedAt.flatMap { isoFmt.date(from: $0) },
                createdAt: r.createdAt.flatMap { isoFmt.date(from: $0) },
                messages: msgsByRev[r.id] ?? []
            )
        }
    }

    /// PMが「OK」を押した: milestone_monthly_progress を更新 + activity を再生成キック + revision を confirmed
    func confirmMsRevision(revisionId: String, confirmedBy: String) async throws {
        struct Row: Decodable {
            let projectId: String
            let milestoneId: String
            let ym: String
            let revisedPct: Double?
            let revisedNote: String?
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case milestoneId = "milestone_id"
                case ym
                case revisedPct = "revised_pct"
                case revisedNote = "revised_note"
            }
        }
        let rows: [Row] = (try? await client.database
            .from("ms_progress_revisions")
            .select("project_id, milestone_id, ym, revised_pct, revised_note")
            .eq("id", value: revisionId)
            .limit(1)
            .execute().value) ?? []
        guard let r = rows.first else {
            throw NSError(domain: "Revision", code: 404, userInfo: [NSLocalizedDescriptionKey: "revision が見つかりません"])
        }

        // milestone_monthly_progress upsert
        if let pct = r.revisedPct {
            struct UpsertProgress: Encodable {
                let milestone_key: String
                let ym: String
                let progress_pct: Double
                let note: String?
                let source: String
            }
            try await client.database
                .from("milestone_monthly_progress")
                .upsert(
                    UpsertProgress(
                        milestone_key: r.milestoneId,
                        ym: r.ym,
                        progress_pct: pct,
                        note: r.revisedNote,
                        source: "tsukuyomi_revision"
                    ),
                    onConflict: "milestone_key,ym"
                )
                .execute()
        }

        // revision を confirmed に
        struct UpdateRow: Encodable {
            let status: String
            let confirmed_by: String
            let confirmed_at: String
        }
        try await client.database
            .from("ms_progress_revisions")
            .update(UpdateRow(status: "confirmed", confirmed_by: confirmedBy, confirmed_at: ISO8601DateFormatter().string(from: Date())))
            .eq("id", value: revisionId)
            .execute()

        // メンバー narrative を再生成（バックグラウンド）
        Task {
            await self.generateMsActivities(projectId: r.projectId, ym: r.ym)
        }
    }

    /// 「破棄する」: revision を discarded に
    func discardMsRevision(revisionId: String) async throws {
        struct UpdateRow: Encodable { let status: String }
        try await client.database
            .from("ms_progress_revisions")
            .update(UpdateRow(status: "discarded"))
            .eq("id", value: revisionId)
            .execute()
    }

    // MARK: - PJ Config 予算額連動: fee_amount 変更時に未確定月の budget_yen を一括更新

    /// fee_amount を更新するとともに、未確定月（budget_confirmed_at が null）の billing_cycles を新 fee_amount 基準で書き換える
    /// status='not_started' の月だけ対象（reported / approved 系は触らない）
    /// reward_summary_json はクリア
    /// member_allocations_json は触らない（PMが予算確定で再入力する想定）
    /// 戻り値: 更新した月数
    @discardableResult
    func cascadeFeeAmountToFutureCycles(projectId: String, newFeeAmount: Double) async -> Int {
        let currentYm = currentYmString()
        struct CycleRow: Decodable {
            let ym: String
            let status: String?
            let budgetConfirmedAt: String?
            enum CodingKeys: String, CodingKey {
                case ym, status
                case budgetConfirmedAt = "budget_confirmed_at"
            }
        }
        let rows: [CycleRow] = (try? await client.database
            .from("billing_cycles")
            .select("ym, status, budget_confirmed_at")
            .eq("project_id", value: projectId)
            .gte("ym", value: currentYm)
            .execute().value) ?? []
        // 未確定月（budget_confirmed_at が null かつ status が承認系でない）
        let targetYms = rows.compactMap { row -> String? in
            if let confirmedAt = row.budgetConfirmedAt, !confirmedAt.isEmpty { return nil }
            let status = (row.status ?? "").lowercased()
            if status == "allocation_confirmed" || status == "budget_confirmed" || status == "approved" { return nil }
            return row.ym
        }
        guard !targetYms.isEmpty else { return 0 }

        // RLS 越しに UPDATE するため、ユーザーJWT を使用
        let token: String
        do {
            token = try await accessToken()
        } catch {
            return 0
        }
        let baseURL = URL(string: "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/billing_cycles")!
        let inFilter = "in.(\(targetYms.joined(separator: ",")))"
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "project_id", value: "eq.\(projectId)"),
            URLQueryItem(name: "ym", value: inFilter)
        ]
        var req = URLRequest(url: components.url!)
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        let payload: [String: Any] = [
            "budget_yen": newFeeAmount,
            "reward_summary_json": NSNull()
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
                let msg = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
                print("[cascadeFeeAmount] failed: \(http.statusCode) \(msg)")
                return 0
            }
            return targetYms.count
        } catch {
            print("[cascadeFeeAmount] error: \(error)")
            return 0
        }
    }

    /// 差し戻し: tsukuyomi-rephrase Edge Function を呼ぶ
    func rejectProposal(proposalId: String, adminId: String, rawReason: String) async throws {
        let url = edgeFunctionBaseURL.appendingPathComponent("tsukuyomi-rephrase")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        let body: [String: Any] = [
            "proposal_id": proposalId,
            "raw_reason": rawReason,
            "admin_id": adminId
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await dataWithHardTimeout(for: req, seconds: 30)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let s = String(data: data, encoding: .utf8) ?? ""
            throw NSError(domain: "tsukuyomi-rephrase", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: s])
        }
    }

    // MARK: 学習を tsukuyomi_learnings に追加
    func addTsukuyomiLearning(
        scope: String,
        scopeKey: String?,
        content: String,
        source: String,
        sourceRef: String?,
        createdBy: String
    ) async throws {
        guard let token = try? await client.auth.session.accessToken else { return }
        let urlStr = "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/tsukuyomi_learnings"
        guard let url = URL(string: urlStr) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        var body: [String: Any] = [
            "scope": scope,
            "content": content,
            "source": source,
            "created_by": createdBy,
        ]
        if let sk = scopeKey { body["scope_key"] = sk }
        if let sr = sourceRef { body["source_ref"] = sr }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, _) = try await URLSession.shared.data(for: req)
    }

    // MARK: 学習一覧を取得
    func fetchTsukuyomiLearnings(scope: String? = nil) async throws -> [TsukuyomiLearningRow] {
        struct Row: Decodable {
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
            enum CodingKeys: String, CodingKey {
                case id, scope, content, source, status
                case scopeKey = "scope_key"
                case sourceRef = "source_ref"
                case createdAt = "created_at"
                case createdBy = "created_by"
                case removedAt = "removed_at"
                case removedReason = "removed_reason"
            }
        }
        var filterQuery = client.database
            .from("tsukuyomi_learnings")
            .select("id, scope, scope_key, content, source, source_ref, status, created_at, created_by, removed_at, removed_reason")
        if let sc = scope {
            filterQuery = filterQuery.eq("scope", value: sc)
        }
        let rows: [Row] = try await filterQuery.order("created_at", ascending: false).execute().value
        return rows.map { r in
            TsukuyomiLearningRow(
                id: r.id,
                scope: r.scope,
                scopeKey: r.scopeKey,
                content: r.content,
                source: r.source,
                sourceRef: r.sourceRef,
                status: r.status,
                createdAt: r.createdAt,
                createdBy: r.createdBy,
                removedAt: r.removedAt,
                removedReason: r.removedReason
            )
        }
    }

    // MARK: 「覚えないで」→ soft delete + 反学習を追加
    func unlearnTsukuyomi(learningId: String, reason: String, removedBy: String) async throws {
        guard let token = try? await client.auth.session.accessToken else {
            throw SupabaseError.authRequired
        }
        let now = ISO8601DateFormatter().string(from: Date())
        let urlStr = "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/tsukuyomi_learnings?id=eq.\(learningId)"
        guard let url = URL(string: urlStr) else { throw SupabaseError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        var body: [String: Any] = [
            "status": "removed",
            "removed_at": now,
            "removed_by": removedBy,
        ]
        if !reason.isEmpty { body["removed_reason"] = reason }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, _) = try await URLSession.shared.data(for: req)

        let metaContent = reason.isEmpty
            ? "（削除：\(learningId)）"
            : "覚えないでほしいこと: \(reason)"
        try await addTsukuyomiLearning(
            scope: "meta",
            scopeKey: nil,
            content: metaContent,
            source: "admin_unlearn",
            sourceRef: learningId,
            createdBy: removedBy
        )
    }
}

// MARK: - Tsukuyomi Report Revision

extension SupabaseService {

    func requestMonthlyReportRevision(
        projectId: String,
        ym: String,
        instruction: String,
        requestedBy: String,
        revisionId: String? = nil
    ) async throws -> MonthlyReportRevisionResult {
        var bodyDict: [String: Any] = [
            "project_id": projectId,
            "ym": ym,
            "instruction": instruction,
            "requested_by": requestedBy,
        ]
        if let rid = revisionId, !rid.isEmpty {
            bodyDict["revision_id"] = rid
        }
        return try await callEdgeFunction("revise-monthly-report", body: bodyDict)
    }

    func applyMonthlyReportRevision(projectId: String, ym: String, finalContent: String) async throws {
        guard let token = try? await client.auth.session.accessToken else {
            throw SupabaseError.authRequired
        }
        let urlStr = "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1/monthly_reports?project_id=eq.\(projectId)&ym=eq.\(ym)"
        guard let url = URL(string: urlStr) else { throw SupabaseError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        let body: [String: Any] = ["final_content": finalContent]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, http.statusCode >= 300 {
            throw SupabaseError.httpError(http.statusCode)
        }
    }
}

// MARK: - Notification Inbox / Feedback

extension SupabaseService {

    func fetchNotificationInbox(limit: Int = 100) async throws -> NotificationInboxData {
        struct L2Row: Decodable {
            let notificationId: String
            let l2Kind: String
            let targetId: String
            let scopeKey: String
            let title: String
            let summary: String?
            let savedCount: Int
            let totalCount: Int
            let importance: Int
            let metadataJson: [String: AnyCodable]?
            let notifiedAt: String?
            let createdAt: String

            enum CodingKeys: String, CodingKey {
                case notificationId = "notification_id"
                case l2Kind = "l2_kind"
                case targetId = "target_id"
                case scopeKey = "scope_key"
                case title, summary, importance
                case metadataJson = "metadata_json"
                case savedCount = "saved_count"
                case totalCount = "total_count"
                case notifiedAt = "notified_at"
                case createdAt = "created_at"
            }
        }
        struct MeetingRow: Decodable {
            let meetingId: String
            let projectId: String
            let title: String
            let sourceKinds: String
            let summaryShort: String
            let notifiedAt: String?
            let createdAt: String

            enum CodingKeys: String, CodingKey {
                case meetingId = "meeting_id"
                case projectId = "project_id"
                case title
                case sourceKinds = "source_kinds"
                case summaryShort = "summary_short"
                case notifiedAt = "notified_at"
                case createdAt = "created_at"
            }
        }
        struct ProjectLite: Decodable {
            let projectId: String
            let projectName: String
            enum CodingKeys: String, CodingKey {
                case projectId = "project_id"
                case projectName = "project_name"
            }
        }
        struct AppNotificationRow: Decodable {
            let id: String
            let title: String
            let body: String?
            let link: String?
            let meta: [String: AnyCodable]?
            let readAt: String?
            let dismissedAt: String?
            let createdAt: String
            let updatedAt: String

            enum CodingKeys: String, CodingKey {
                case id
                case title
                case body
                case link
                case meta
                case readAt = "read_at"
                case dismissedAt = "dismissed_at"
                case createdAt = "created_at"
                case updatedAt = "updated_at"
            }

            func stringMeta(_ key: String) -> String? {
                guard let raw = meta?[key]?.value as? String, !raw.isEmpty else { return nil }
                return raw
            }
        }

        async let l2Task: [L2Row] = client.database
            .from("l2_notifications")
            .select("notification_id, l2_kind, target_id, scope_key, title, summary, saved_count, total_count, importance, metadata_json, notified_at, created_at")
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        async let meetingTask: [MeetingRow] = client.database
            .from("meeting_notifications")
            .select("meeting_id, project_id, title, source_kinds, summary_short, notified_at, created_at")
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        async let connectorAuthTask: [AppNotificationRow] = client.database
            .from("app_notifications")
            .select("id, title, body, link, meta, read_at, dismissed_at, created_at, updated_at")
            .eq("kind", value: "connector_auth")
            .is("dismissed_at", value: nil)
            .order("updated_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        async let feedbackTask: [NotificationFeedback] = client.database
            .from("l2_feedbacks")
            .select("feedback_id, l2_kind, target_id, scope_key, notification_id, meeting_id, feedback_text, status, created_by, created_at, applied_count, last_applied_at")
            .order("created_at", ascending: false)
            .limit(300)
            .execute()
            .value
        async let projectTask: [ProjectLite] = client.database
            .from("projects")
            .select("project_id, project_name")
            .execute()
            .value

        let (l2Rows, meetingRows, connectorAuthRows, feedbacks, projects) = try await (l2Task, meetingTask, connectorAuthTask, feedbackTask, projectTask)
        var items: [NotificationInboxItem] = []
        items += l2Rows.map {
            NotificationInboxItem(
                id: "l2-\($0.notificationId)",
                kind: "l2",
                notificationId: $0.notificationId,
                meetingId: nil,
                l2Kind: $0.l2Kind,
                targetId: $0.targetId,
                projectId: nil,
                scopeKey: $0.scopeKey,
                title: $0.title,
                body: $0.summary ?? "",
                countText: "\($0.savedCount)/\($0.totalCount)",
                importance: $0.importance,
                sourceKinds: nil,
                notifiedAt: $0.notifiedAt,
                createdAt: $0.createdAt,
                metadata: $0.metadataJson,
                reauthUrl: nil,
                connector: nil,
                reason: nil
            )
        }
        items += meetingRows.map {
            NotificationInboxItem(
                id: "meeting-\($0.meetingId)",
                kind: "meeting",
                notificationId: nil,
                meetingId: $0.meetingId,
                l2Kind: "meeting_summary",
                targetId: $0.projectId,
                projectId: $0.projectId,
                scopeKey: $0.meetingId,
                title: "議事録: \($0.title)",
                body: $0.summaryShort,
                countText: nil,
                importance: 1,
                sourceKinds: $0.sourceKinds,
                notifiedAt: $0.notifiedAt,
                createdAt: $0.createdAt,
                metadata: nil,
                reauthUrl: nil,
                connector: nil,
                reason: nil
            )
        }
        items += connectorAuthRows.map {
            let connector = $0.stringMeta("connector") ?? "connector"
            let reason = $0.stringMeta("reason")
            let context = $0.stringMeta("context") ?? connector
            return NotificationInboxItem(
                id: "connector-auth-\($0.id)",
                kind: "connector_auth",
                notificationId: $0.id,
                meetingId: nil,
                l2Kind: "connector_auth",
                targetId: $0.id,
                projectId: nil,
                scopeKey: context,
                title: $0.title,
                body: $0.body ?? "",
                countText: nil,
                importance: 3,
                sourceKinds: reason,
                notifiedAt: $0.readAt,
                createdAt: $0.createdAt,
                metadata: $0.meta,
                reauthUrl: $0.stringMeta("reauth_url") ?? $0.stringMeta("reauth_install_url") ?? $0.stringMeta("reauth_app_url") ?? $0.link,
                connector: connector,
                reason: reason
            )
        }
        items.sort { $0.createdAt > $1.createdAt }

        return NotificationInboxData(
            items: items,
            feedbacks: feedbacks,
            projectMap: Dictionary(uniqueKeysWithValues: projects.map { ($0.projectId, $0.projectName) })
        )
    }

    func markNotificationRead(_ item: NotificationInboxItem) async throws {
        try await markNotificationRead(target: item.responseTarget)
    }

    private func markNotificationRead(target: NotificationResponseTarget) async throws {
        let iso = ISO8601DateFormatter().string(from: Date())
        if target.kind == "connector_auth" {
            try await client.database
                .from("app_notifications")
                .update(AppNotificationReadUpdate(read_at: iso, updated_at: iso))
                .eq("id", value: target.notificationId ?? target.targetId)
                .execute()
        } else if target.kind == "meeting", let meetingId = target.meetingId {
            try await client.database
                .from("meeting_notifications")
                .update(NotificationReadUpdate(notified_at: iso))
                .eq("meeting_id", value: meetingId)
                .execute()
        } else if let notificationId = target.notificationId {
            try await client.database
                .from("l2_notifications")
                .update(NotificationReadUpdate(notified_at: iso))
                .eq("notification_id", value: notificationId)
                .execute()
        } else if let l2Kind = target.l2Kind {
            try await client.database
                .from("l2_notifications")
                .update(NotificationReadUpdate(notified_at: iso))
                .eq("l2_kind", value: l2Kind)
                .eq("target_id", value: target.feedbackTargetId)
                .eq("scope_key", value: target.feedbackScopeKey)
                .execute()
        }
    }

    func fetchNotificationDetails(for item: NotificationInboxItem) async throws -> [NotificationDetailLine] {
        switch item.responseTarget.feedbackKind {
        case "meeting_summary":
            return try await fetchMeetingNotificationDetails(meetingId: item.responseTarget.feedbackScopeKey)
        case "ms_progress":
            return try await fetchMsProgressNotificationDetails(projectId: item.responseTarget.feedbackTargetId, ym: item.responseTarget.feedbackScopeKey)
        case "project_registry_diff":
            return try await fetchRegistryDiffNotificationDetails(projectId: item.responseTarget.feedbackTargetId, scopeKey: item.responseTarget.feedbackScopeKey)
        case "xrl_evidence":
            return try await fetchXrlEvidenceNotificationDetails(projectId: item.responseTarget.feedbackTargetId, scopeKey: item.responseTarget.feedbackScopeKey)
        case "coverage_gap":
            return try await fetchCoverageGapNotificationDetails(item: item)
        default:
            return []
        }
    }

    func submitNotificationResponse(
        target: NotificationResponseTarget,
        action: NotificationInboxAction,
        comment: String,
        email: String?
    ) async throws -> NotificationResponseResult {
        if target.feedbackKind == "coverage_gap" {
            return try await submitCoverageGapResponseThroughPwa(target: target, action: action, comment: comment)
        }
        let trimmed = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        if action == .comment && trimmed.isEmpty {
            throw NSError(domain: "NotificationFeedback", code: 400, userInfo: [NSLocalizedDescriptionKey: "コメントが空だよ"])
        }
        guard !target.feedbackKind.isEmpty, !target.feedbackTargetId.isEmpty else {
            throw NSError(domain: "NotificationFeedback", code: 400, userInfo: [NSLocalizedDescriptionKey: "通知の回答対象が足りない"])
        }

        let createdBy = try await resolveNotificationActor(email: email)
        let feedbackId = try await insertNotificationFeedback(
            target: target,
            action: action,
            comment: trimmed,
            createdBy: createdBy
        )
        let applyMessage = try await applyNotificationAction(
            target: target,
            action: action,
            comment: trimmed,
            createdBy: createdBy
        )
        try? await insertNotificationLearning(
            target: target,
            action: action,
            comment: trimmed,
            applyMessage: applyMessage,
            feedbackId: feedbackId,
            createdBy: createdBy
        )
        try? await markNotificationRead(target: target)
        return NotificationResponseResult(
            feedbackId: feedbackId,
            message: applyMessage.isEmpty ? "\(action.label)を保存したよ" : applyMessage
        )
    }

    func submitNotificationResponse(
        item: NotificationInboxItem,
        action: NotificationInboxAction,
        comment: String,
        email: String?
    ) async throws -> NotificationResponseResult {
        try await submitNotificationResponse(target: item.responseTarget, action: action, comment: comment, email: email)
    }

    private func fetchCoverageGapNotificationDetails(item: NotificationInboxItem) async throws -> [NotificationDetailLine] {
        struct Row: Decodable {
            let title: String?
            let summary: String?
            let proposedTarget: String?
            let reviewStatus: String?
            enum CodingKeys: String, CodingKey {
                case title, summary
                case proposedTarget = "proposed_target_l2"
                case reviewStatus = "review_status"
            }
        }
        let rows: [Row] = try await client.database
            .from("l2_coverage_gaps")
            .select("title, summary, proposed_target_l2, review_status")
            .eq("gap_id", value: item.responseTarget.feedbackScopeKey)
            .limit(1)
            .execute()
            .value
        guard let row = rows.first else { return [] }
        guard row.proposedTarget == "shareholder_meeting" else {
            return [NotificationDetailLine(title: "確認候補", body: row.summary ?? row.title ?? "詳細なし", footnote: nil)]
        }
        let contract = item.governanceActionContract
        return [
            NotificationDetailLine(
                title: "会社概要に追加する開催履歴",
                body: contract.changes.joined(separator: "\n"),
                footnote: "状態: \(row.reviewStatus ?? "candidate")。\(contract.approvalEffect)"
            )
        ]
    }

    private func submitCoverageGapResponseThroughPwa(
        target: NotificationResponseTarget,
        action: NotificationInboxAction,
        comment: String
    ) async throws -> NotificationResponseResult {
        let trimmed = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        if action == .comment && trimmed.isEmpty {
            throw NSError(domain: "NotificationFeedback", code: 400, userInfo: [NSLocalizedDescriptionKey: "コメントが空だよ"])
        }
        guard let url = URL(string: "https://amd-os-pwa.vercel.app/api/notifications/feedback") else {
            throw NSError(domain: "NotificationFeedback", code: 500, userInfo: [NSLocalizedDescriptionKey: "通知APIのURLが不正"])
        }
        let token = try await accessToken()
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var payload: [String: Any] = [
            "l2_kind": target.feedbackKind,
            "target_id": target.feedbackTargetId,
            "scope_key": target.feedbackScopeKey,
            "feedback_text": trimmed,
            "action": action.rawValue,
        ]
        if let notificationId = target.notificationId { payload["notification_id"] = notificationId }
        if let meetingId = target.meetingId { payload["meeting_id"] = meetingId }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let (data, response) = try await dataWithHardTimeout(for: request, seconds: 22)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw NSError(domain: "NotificationFeedback", code: (response as? HTTPURLResponse)?.statusCode ?? 500, userInfo: [NSLocalizedDescriptionKey: "開催履歴の回答を送れなかった: \(body)"])
        }
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let feedback = json?["feedback"] as? [String: Any]
        let feedbackId = feedback?["feedback_id"] as? String ?? ""
        let applyResult = json?["applyResult"] as? [String: Any]
        let message = applyResult?["message"] as? String
            ?? (action == .yes ? "開催履歴を追加したよ" : action == .no ? "開催履歴は追加しないで完了したよ" : "コメントを保存したよ")
        return NotificationResponseResult(feedbackId: feedbackId, message: message)
    }

    private func fetchMeetingNotificationDetails(meetingId: String) async throws -> [NotificationDetailLine] {
        struct Row: Decodable {
            let title: String
            let meetingDate: String
            let summaryShort: String
            let sourceKinds: String?
            let sourceUrl: String?
            let notionUrl: String?
            let generatedAt: String?
            enum CodingKeys: String, CodingKey {
                case title
                case meetingDate = "meeting_date"
                case summaryShort = "summary_short"
                case sourceKinds = "source_kinds"
                case sourceUrl = "source_url"
                case notionUrl = "notion_url"
                case generatedAt = "generated_at"
            }
        }
        let rows: [Row] = (try? await client.database
            .from("project_meeting_summaries")
            .select("title, meeting_date, summary_short, source_kinds, source_url, notion_url, generated_at")
            .eq("meeting_id", value: meetingId)
            .limit(1)
            .execute()
            .value) ?? []
        guard let row = rows.first else { return [] }
        return [
            NotificationDetailLine(
                title: "\(row.meetingDate) / \(row.title)",
                body: row.summaryShort.isEmpty ? "サマリ本文は空" : row.summaryShort,
                footnote: [row.sourceKinds, row.sourceUrl, row.notionUrl, row.generatedAt].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " / ")
            )
        ]
    }

    private func fetchMsProgressNotificationDetails(projectId: String, ym: String) async throws -> [NotificationDetailLine] {
        struct RevisionRow: Decodable {
            let id: String
            let milestoneId: String
            let currentPct: Double?
            let currentNote: String?
            let revisedPct: Double?
            let revisedNote: String?
            let status: String
            let createdAt: String?
            enum CodingKeys: String, CodingKey {
                case id
                case milestoneId = "milestone_id"
                case currentPct = "current_pct"
                case currentNote = "current_note"
                case revisedPct = "revised_pct"
                case revisedNote = "revised_note"
                case status
                case createdAt = "created_at"
            }
        }
        struct MsRow: Decodable {
            let milestoneId: String
            let title: String
            enum CodingKeys: String, CodingKey {
                case milestoneId = "milestone_id"
                case title
            }
        }
        let revisions: [RevisionRow] = (try? await client.database
            .from("ms_progress_revisions")
            .select("id, milestone_id, current_pct, current_note, revised_pct, revised_note, status, created_at")
            .eq("project_id", value: projectId)
            .eq("ym", value: ym)
            .order("created_at", ascending: false)
            .execute()
            .value) ?? []

        let milestoneIds = Array(Set(revisions.map(\.milestoneId)))
        let msRows: [MsRow] = (try? await client.database
            .from("value_milestones")
            .select("milestone_id, title")
            .in("milestone_id", values: milestoneIds.isEmpty ? ["__none__"] : milestoneIds)
            .execute()
            .value) ?? []
        let titleMap = Dictionary(uniqueKeysWithValues: msRows.map { ($0.milestoneId, $0.title) })

        return revisions.map { row in
            let title = titleMap[row.milestoneId] ?? row.milestoneId
            let pctText = "現在 \(formatPct(row.currentPct)) -> 提案 \(formatPct(row.revisedPct))"
            let notes = [row.revisedNote, row.currentNote.map { "現在メモ: \($0)" }].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: "\n")
            return NotificationDetailLine(
                title: "\(title) [\(statusLabel(row.status))]",
                body: [pctText, notes].filter { !$0.isEmpty }.joined(separator: "\n"),
                footnote: row.createdAt
            )
        }
    }

    private func fetchRegistryDiffNotificationDetails(projectId: String, scopeKey: String) async throws -> [NotificationDetailLine] {
        struct Row: Decodable {
            let diffId: String
            let diffKind: String
            let targetTable: String
            let targetKey: String?
            let confidence: Double
            let status: String
            let reviewComment: String?
            let createdAt: String?
            let appliedAt: String?
            enum CodingKeys: String, CodingKey {
                case diffId = "diff_id"
                case diffKind = "diff_kind"
                case targetTable = "target_table"
                case targetKey = "target_key"
                case confidence
                case status
                case reviewComment = "review_comment"
                case createdAt = "created_at"
                case appliedAt = "applied_at"
            }
        }
        var query = client.database
            .from("project_registry_diffs")
            .select("diff_id, diff_kind, target_table, target_key, confidence, status, review_comment, created_at, applied_at")
            .eq("project_id", value: projectId)
        if scopeKey == "global" {
            query = query.is("ym", value: nil)
        } else {
            query = query.eq("ym", value: scopeKey)
        }
        let rows: [Row] = (try? await query.order("created_at", ascending: false).limit(30).execute().value) ?? []
        return rows.map { row in
            NotificationDetailLine(
                title: "\(row.diffKind) -> \(row.targetTable) [\(statusLabel(row.status))]",
                body: [
                    row.targetKey.map { "target: \($0)" },
                    "confidence: \(String(format: "%.2f", row.confidence))",
                    row.reviewComment.map { "comment: \($0)" },
                ].compactMap { $0 }.joined(separator: "\n"),
                footnote: [row.diffId, row.createdAt, row.appliedAt.map { "applied: \($0)" }].compactMap { $0 }.joined(separator: " / ")
            )
        }
    }

    private func fetchXrlEvidenceNotificationDetails(projectId: String, scopeKey: String) async throws -> [NotificationDetailLine] {
        struct Row: Decodable {
            let evidenceId: String
            let axis: String
            let evidenceKind: String
            let summary: String
            let confidence: Double
            let status: String
            let createdAt: String?
            let confirmedAt: String?
            enum CodingKeys: String, CodingKey {
                case evidenceId = "evidence_id"
                case axis
                case evidenceKind = "evidence_kind"
                case summary
                case confidence
                case status
                case createdAt = "created_at"
                case confirmedAt = "confirmed_at"
            }
        }
        var query = client.database
            .from("project_xrl_evidence")
            .select("evidence_id, axis, evidence_kind, summary, confidence, status, created_at, confirmed_at")
            .eq("project_id", value: projectId)
        if scopeKey == "global" {
            query = query.is("ym", value: nil)
        } else {
            query = query.eq("ym", value: scopeKey)
        }
        let rows: [Row] = (try? await query.order("created_at", ascending: false).limit(30).execute().value) ?? []
        return rows.map { row in
            NotificationDetailLine(
                title: "\(row.axis.uppercased()) / \(row.evidenceKind) [\(statusLabel(row.status))]",
                body: row.summary,
                footnote: [
                    row.evidenceId,
                    "confidence: \(String(format: "%.2f", row.confidence))",
                    row.createdAt,
                    row.confirmedAt.map { "confirmed: \($0)" },
                ].compactMap { $0 }.joined(separator: " / ")
            )
        }
    }

    private func insertNotificationFeedback(
        target: NotificationResponseTarget,
        action: NotificationInboxAction,
        comment: String,
        createdBy: String?
    ) async throws -> String {
        struct Row: Encodable {
            let l2_kind: String
            let target_id: String
            let scope_key: String
            let notification_id: String?
            let meeting_id: String?
            let feedback_text: String
            let status: String
            let created_by: String?
        }
        struct Returned: Decodable {
            let feedbackId: String
            enum CodingKeys: String, CodingKey { case feedbackId = "feedback_id" }
        }

        let feedbackText = action == .comment
            ? comment
            : "[\(action.label)]\(comment.isEmpty ? "" : " \(comment)")"
        let rows: [Returned] = try await client.database
            .from("l2_feedbacks")
            .insert(Row(
                l2_kind: target.feedbackKind,
                target_id: target.feedbackTargetId,
                scope_key: target.feedbackScopeKey,
                notification_id: target.notificationId,
                meeting_id: target.meetingId,
                feedback_text: String(feedbackText.prefix(4000)),
                status: "active",
                created_by: createdBy
            ))
            .select("feedback_id")
            .execute()
            .value
        return rows.first?.feedbackId ?? ""
    }

    private func applyNotificationAction(
        target: NotificationResponseTarget,
        action: NotificationInboxAction,
        comment: String,
        createdBy: String?
    ) async throws -> String {
        guard action != .comment else { return "コメントを保存したよ。つくよみの再抽出材料になる。" }

        switch target.feedbackKind {
        case "ms_progress":
            return try await applyMsProgressNotificationAction(target: target, action: action, createdBy: createdBy)
        case "project_registry_diff":
            return try await applyRegistryDiffNotificationAction(target: target, action: action, comment: comment, createdBy: createdBy)
        case "xrl_evidence":
            return try await applyXrlEvidenceNotificationAction(target: target, action: action, createdBy: createdBy)
        default:
            return "\(action.label)を保存したよ。自動DB反映がない種類だから、つくよみ学習に回した。"
        }
    }

    private func applyMsProgressNotificationAction(
        target: NotificationResponseTarget,
        action: NotificationInboxAction,
        createdBy: String?
    ) async throws -> String {
        struct Row: Decodable { let id: String }
        let rows: [Row] = (try? await client.database
            .from("ms_progress_revisions")
            .select("id")
            .eq("project_id", value: target.feedbackTargetId)
            .eq("ym", value: target.feedbackScopeKey)
            .eq("status", value: "pending")
            .execute()
            .value) ?? []
        if rows.isEmpty { return "MS進捗の pending revision はなかったよ" }

        if action == .yes {
            for row in rows {
                try await confirmMsRevision(revisionId: row.id, confirmedBy: createdBy ?? "ios")
            }
            return "MS進捗 revision \(rows.count)件を確定したよ"
        } else {
            for row in rows {
                try await discardMsRevision(revisionId: row.id)
            }
            return "MS進捗 revision \(rows.count)件を破棄したよ"
        }
    }

    private func applyRegistryDiffNotificationAction(
        target: NotificationResponseTarget,
        action: NotificationInboxAction,
        comment: String,
        createdBy: String?
    ) async throws -> String {
        struct UpdateRow: Encodable {
            let status: String
            let reviewed_by: String?
            let review_comment: String?
            let reviewed_at: String
        }
        struct IdRow: Decodable {
            let diffId: String
            enum CodingKeys: String, CodingKey { case diffId = "diff_id" }
        }
        let newStatus = action == .yes ? "accepted" : "rejected"
        var query = try client.database
            .from("project_registry_diffs")
            .update(UpdateRow(
                status: newStatus,
                reviewed_by: createdBy,
                review_comment: comment.isEmpty ? nil : comment,
                reviewed_at: ISO8601DateFormatter().string(from: Date())
            ))
            .eq("project_id", value: target.feedbackTargetId)
            .in("status", values: ["pending", "accepted"])
        if target.feedbackScopeKey == "global" {
            query = query.is("ym", value: nil)
        } else {
            query = query.eq("ym", value: target.feedbackScopeKey)
        }
        let rows: [IdRow] = try await query.select("diff_id").execute().value
        return action == .yes
            ? "OS台帳差分 \(rows.count)件を accepted にしたよ。安全な実反映はPWA/helper側の apply で続く。"
            : "OS台帳差分 \(rows.count)件を rejected にしたよ"
    }

    private func applyXrlEvidenceNotificationAction(
        target: NotificationResponseTarget,
        action: NotificationInboxAction,
        createdBy: String?
    ) async throws -> String {
        struct UpdateRow: Encodable {
            let status: String
            let confirmed_by: String?
            let confirmed_at: String
        }
        struct IdRow: Decodable {
            let evidenceId: String
            enum CodingKeys: String, CodingKey { case evidenceId = "evidence_id" }
        }
        let newStatus = action == .yes ? "confirmed" : "rejected"
        var query = try client.database
            .from("project_xrl_evidence")
            .update(UpdateRow(
                status: newStatus,
                confirmed_by: createdBy,
                confirmed_at: ISO8601DateFormatter().string(from: Date())
            ))
            .eq("project_id", value: target.feedbackTargetId)
            .eq("status", value: "candidate")
        if target.feedbackScopeKey == "global" {
            query = query.is("ym", value: nil)
        } else {
            query = query.eq("ym", value: target.feedbackScopeKey)
        }
        let rows: [IdRow] = try await query.select("evidence_id").execute().value
        return action == .yes
            ? "XRL根拠 \(rows.count)件を confirmed にしたよ"
            : "XRL根拠 \(rows.count)件を rejected にしたよ"
    }

    private func insertNotificationLearning(
        target: NotificationResponseTarget,
        action: NotificationInboxAction,
        comment: String,
        applyMessage: String,
        feedbackId: String,
        createdBy: String?
    ) async throws {
        struct Row: Encodable {
            let scope: String
            let scope_key: String
            let content: String
            let source: String
            let source_ref: String?
            let created_by: String?
        }
        let content = [
            "通知回答: \(action.label)",
            "kind=\(target.feedbackKind)",
            "target=\(target.feedbackTargetId)",
            "scope=\(target.feedbackScopeKey)",
            comment.isEmpty ? nil : "comment=\(comment)",
            applyMessage.isEmpty ? nil : "result=\(applyMessage)",
        ].compactMap { $0 }.joined(separator: "\n")
        try await client.database
            .from("tsukuyomi_learnings")
            .insert(Row(
                scope: "notification_response",
                scope_key: "\(target.feedbackKind):\(target.feedbackTargetId)",
                content: content,
                source: "ios_notification_feedback",
                source_ref: feedbackId.isEmpty ? nil : feedbackId,
                created_by: createdBy
            ))
            .execute()
    }

    private func resolveNotificationActor(email: String?) async throws -> String? {
        guard let email, !email.isEmpty else { return nil }
        return try await fetchMyProfile(email: email)?.codeName ?? email
    }

    private func formatPct(_ value: Double?) -> String {
        guard let value else { return "?" }
        return value.truncatingRemainder(dividingBy: 1) == 0
            ? "\(Int(value))%"
            : String(format: "%.1f%%", value)
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "pending": return "確認待ち"
        case "accepted": return "承認済"
        case "applied": return "反映済"
        case "confirmed": return "確定済"
        case "discarded": return "破棄"
        case "rejected": return "却下"
        default: return status
        }
    }

    // MARK: - HUD Control Center (直読み)
    // PWA /hud/dashboard と同じ素データを Supabase から直読みする（API 不要・会場ネット非依存）。

    func fetchHudManagementSnapshots() async throws -> [HudMgmtSnapshotRow] {
        try await client.database
            .from("amd_management_score_snapshots")
            .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,updated_at")
            .order("ym", ascending: true)
            .order("updated_at", ascending: true)
            .execute()
            .value
    }

    func fetchHudBillingCycles(ym: String) async throws -> [HudBillingRow] {
        try await client.database
            .from("billing_cycles")
            .select("project_id,ym,status,budget_yen,meeting_start_at,report_fixed_at,invoice_sent_at,payment_confirmed_at")
            .eq("ym", value: ym)
            .execute()
            .value
    }

    func fetchHudMonthlyReports(ym: String) async throws -> [HudReportRow] {
        try await client.database
            .from("monthly_reports")
            .select("project_id,status,fixed_at")
            .eq("ym", value: ym)
            .execute()
            .value
    }

    /// 現在のセッションを @supabase/ssr 互換 cookie に変換（PWA 詳細ページを WebView で認証付き表示するため）。
    /// cookie 名: sb-<ref>-auth-token、値: "base64-" + base64url(session JSON)、長い場合は .0/.1 で chunk 分割。
    func hudWebAuthCookies() async throws -> [HTTPCookie] {
        let session: Session
        do { session = try await client.auth.refreshSession() }
        catch { session = try await client.auth.session }

        let userData = try JSONEncoder().encode(session.user)
        let userObj = try JSONSerialization.jsonObject(with: userData)

        var dict: [String: Any] = [
            "access_token": session.accessToken,
            "token_type": session.tokenType,
            "expires_in": session.expiresIn,
            "refresh_token": session.refreshToken,
            "user": userObj,
            "expires_at": Int(session.expiresAt),
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: dict, options: [])
        let b64 = jsonData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        let value = "base64-" + b64

        let name = "sb-nbnhrhybjslbawdukvvk-auth-token"
        let domain = "amd-os-pwa.vercel.app"
        let maxChunk = 3180

        func cookie(_ n: String, _ v: String) -> HTTPCookie? {
            HTTPCookie(properties: [
                .domain: domain, .path: "/", .name: n, .value: v, .secure: "TRUE",
                .expires: Date(timeIntervalSince1970: TimeInterval(session.expiresAt)),
            ])
        }

        if value.count <= maxChunk {
            return [cookie(name, value)].compactMap { $0 }
        }
        var cookies: [HTTPCookie] = []
        let chars = Array(value)
        var i = 0
        var idx = 0
        while i < chars.count {
            let end = min(i + maxChunk, chars.count)
            if let c = cookie("\(name).\(idx)", String(chars[i..<end])) { cookies.append(c) }
            i = end
            idx += 1
        }
        return cookies
    }
}

private enum SupabaseError: Error {
    case authRequired
    case invalidURL
    case httpError(Int)
}

// MARK: - HUD Control Center 直読み行

struct HudMgmtSnapshotRow: Decodable {
    let ym: String?
    let total_score: Double?
    let initiative_score: Double?
    let finance_score: Double?
    let retention_score: Double?
    let pipeline_score: Double?
    let direction_score: Double?
    let confidence: Double?
}

struct HudBillingRow: Decodable {
    let project_id: String
    let ym: String?
    let status: String?
    let budget_yen: Double?
    let meeting_start_at: String?
    let report_fixed_at: String?
    let invoice_sent_at: String?
    let payment_confirmed_at: String?
}

struct HudReportRow: Decodable {
    let project_id: String?
    let status: String?
    let fixed_at: String?
}

private struct NotificationReadUpdate: Encodable {
    let notified_at: String
}

private struct AppNotificationReadUpdate: Encodable {
    let read_at: String
    let updated_at: String
}

struct NotificationInboxData {
    let items: [NotificationInboxItem]
    let feedbacks: [NotificationFeedback]
    let projectMap: [String: String]
}

struct NotificationInboxItem: Identifiable, Hashable {
    let id: String
    let kind: String
    let notificationId: String?
    let meetingId: String?
    let l2Kind: String?
    let targetId: String
    let projectId: String?
    let scopeKey: String
    let title: String
    let body: String
    let countText: String?
    let importance: Int
    let sourceKinds: String?
    let notifiedAt: String?
    let createdAt: String
    let metadata: [String: AnyCodable]?
    let reauthUrl: String?
    let connector: String?
    let reason: String?

    static func == (lhs: NotificationInboxItem, rhs: NotificationInboxItem) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    var isUnread: Bool { notifiedAt == nil }

    var isGovernanceHistoryCandidate: Bool {
        guard l2Kind == "coverage_gap" else { return false }
        return metadata?["proposed_target_l2"]?.value as? String == "shareholder_meeting"
    }

    var governanceActionContract: (destination: String, changes: [String], approvalLabel: String, rejectionLabel: String, approvalEffect: String) {
        let meetingType = (metadata?["meeting_type"]?.value as? String) ?? "未確認"
        let meetingDate = (metadata?["meeting_date"]?.value as? String) ?? "未確認"
        let agenda = (metadata?["agenda_summary"]?.value as? String) ?? "根拠欄で確認"
        let resolutionCount = metadata?["resolution_count"]?.value as? Double
        let resolution = (resolutionCount ?? 0) > 0 ? "\(Int(resolutionCount!))件" : "根拠欄で確認"
        return (
            destination: "会社概要 → 総会・取締役会",
            changes: [
                "会議種別: \(meetingType)",
                "開催日: \(meetingDate)",
                "議題: \(agenda)",
                "決議: \(resolution)",
                "添付: 根拠欄で確認",
            ],
            approvalLabel: "この開催履歴を追加する",
            rejectionLabel: "追加しない",
            approvalEffect: "会社概要の「総会・取締役会」に開催履歴を1件追加する。メール送信、資料アップロード、元メールや元資料の編集はしない。"
        )
    }

    var responseTarget: NotificationResponseTarget {
        NotificationResponseTarget(
            kind: kind,
            l2Kind: l2Kind,
            targetId: targetId,
            scopeKey: scopeKey,
            notificationId: notificationId,
            meetingId: meetingId,
            projectId: projectId
        )!
    }

    func displayTarget(projectMap: [String: String]) -> String {
        let pid = projectId ?? targetId
        if let name = projectMap[pid] {
            return scopeKey == "global" ? name : "\(name) / \(scopeKey)"
        }
        return scopeKey == "global" ? pid : "\(pid) / \(scopeKey)"
    }
}

struct NotificationFeedback: Decodable, Identifiable, Hashable {
    let feedbackId: String
    let l2Kind: String
    let targetId: String
    let scopeKey: String
    let notificationId: String?
    let meetingId: String?
    let feedbackText: String
    let status: String
    let createdBy: String?
    let createdAt: String
    let appliedCount: Int
    let lastAppliedAt: String?

    var id: String { feedbackId }

    enum CodingKeys: String, CodingKey {
        case feedbackId = "feedback_id"
        case l2Kind = "l2_kind"
        case targetId = "target_id"
        case scopeKey = "scope_key"
        case notificationId = "notification_id"
        case meetingId = "meeting_id"
        case feedbackText = "feedback_text"
        case status
        case createdBy = "created_by"
        case createdAt = "created_at"
        case appliedCount = "applied_count"
        case lastAppliedAt = "last_applied_at"
    }
}

struct NotificationDetailLine: Identifiable, Hashable {
    let id = UUID().uuidString
    let title: String
    let body: String
    let footnote: String?
}

struct NotificationResponseResult {
    let feedbackId: String
    let message: String
}

// MARK: - Models

struct SupabaseProject: Decodable, Identifiable {
    var id: String { projectId }
    let projectId: String
    let projectName: String
    let clientName: String?
    let status: String
    let startYm: String?
    let endYm: String?
    let projectType: String?

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case projectName = "project_name"
        case clientName = "client_name"
        case status
        case startYm = "start_ym"
        case endYm = "end_ym"
        case projectType = "project_type"
    }

    /// GASProject との互換変換
    var asGASProject: GASProject {
        GASProject(
            projectId: projectId,
            projectName: projectName,
            clientName: clientName ?? "",
            status: status,
            startYm: startYm ?? "",
            endYm: endYm ?? "",
            projectType: projectType
        )
    }
}

struct CockpitMilestoneDraft: Identifiable {
    let id: String
    let milestoneId: String
    let orderNo: Int
    let tag: String
    var title: String
    var points: Int
    var targetYm: String?
    var successCriteria: String
    var subItems: [CockpitSubItemDraft]
}

struct CockpitSubItemDraft: Identifiable {
    let id: String
    var subItemId: String?
    var title: String
    var startYm: String?
    var targetYm: String?
    var isDone: Bool
}

private struct SubItemIdRow: Decodable {
    let subItemId: String
    enum CodingKeys: String, CodingKey { case subItemId = "sub_item_id" }
}

private extension Optional where Wrapped == String {
    var nilIfEmpty: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}

// MARK: - Supabase Reimbursements Model

struct SupabaseReimburse: Codable {
    let reimbursementId: String
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

    enum CodingKeys: String, CodingKey {
        case reimbursementId = "reimbursement_id"
        case projectId = "project_id"
        case projectName = "project_name"
        case date, category, amount
        case taxRate = "tax_rate"
        case description
        case transportMode = "transport_mode"
        case transportFrom = "transport_from"
        case transportTo = "transport_to"
        case transportTrip = "transport_trip"
        case status
        case createdBy = "created_by"
        case pmApprovedBy = "pm_approved_by"
        case pmApprovedAt = "pm_approved_at"
        case adminApprovedBy = "admin_approved_by"
        case adminApprovedAt = "admin_approved_at"
    }

    func toReimburseItem() -> ReimburseItem {
        let catLabels: [String: String] = [
            "transport": "交通費", "lodging": "宿泊", "supplies": "消耗品",
            "meal": "会議費", "other": "その他"
        ]
        let stLabels: [String: String] = [
            "submitted": "申請中", "pmApproved": "PM承認済", "approved": "承認済",
            "rejected": "却下", "paid": "支払済"
        ]
        let displayAmount = (transportTrip ?? "") == "round" && amount > 0 ? amount * 2 : amount
        let pmAt = pmApprovedAt.flatMap { $0.isEmpty ? nil : String($0.prefix(10)) }
        let adAt = adminApprovedAt.flatMap { $0.isEmpty ? nil : String($0.prefix(10)) }

        return ReimburseItem(
            reimbursementId: reimbursementId,
            date: date,
            projectId: projectId,
            projectName: projectName ?? "",
            category: category,
            categoryLabel: catLabels[category] ?? category,
            amount: displayAmount,
            taxRate: taxRate,
            desc: description ?? "",
            status: status,
            statusLabel: stLabels[status] ?? status,
            pmApproved: pmApprovedBy != nil || pmApprovedAt != nil,
            pmApprovedByLabel: pmApprovedBy,
            pmApprovedAt: pmAt,
            adminApproved: adminApprovedBy != nil || adminApprovedAt != nil,
            adminApprovedByLabel: adminApprovedBy,
            adminApprovedAt: adAt,
            canEdit: status == "submitted",
            canDelete: status == "submitted",
            transportMode: transportMode,
            transportFrom: transportFrom,
            transportTo: transportTo,
            transportTrip: transportTrip
        )
    }

    static func new(id: String, email: String, projectName: String, input: ReimburseFormInput) -> SupabaseReimburse {
        let amt = input.amountDouble ?? 0
        let finalAmt = input.category == .transport && input.transportTrip == .round ? amt * 2 : amt
        return SupabaseReimburse(
            reimbursementId: id,
            projectId: input.projectId,
            projectName: projectName,
            date: input.dateString,
            category: input.category.rawValue,
            amount: finalAmt,
            taxRate: input.taxRate.doubleValue,
            description: input.desc,
            transportMode: input.category == .transport ? input.transportMode.rawValue : nil,
            transportFrom: input.category == .transport ? input.transportFrom : nil,
            transportTo: input.category == .transport ? input.transportTo : nil,
            transportTrip: input.category == .transport ? input.transportTrip.rawValue : nil,
            status: "submitted",
            createdBy: email.lowercased(),
            pmApprovedBy: nil, pmApprovedAt: nil,
            adminApprovedBy: nil, adminApprovedAt: nil
        )
    }
}

/// UPDATE用（status・承認フィールドは変更しない）
struct SupabaseReimburseUpdate: Encodable {
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

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case projectName = "project_name"
        case date, category, amount
        case taxRate = "tax_rate"
        case description
        case transportMode = "transport_mode"
        case transportFrom = "transport_from"
        case transportTo = "transport_to"
        case transportTrip = "transport_trip"
    }

    init(input: ReimburseFormInput, projectName: String) {
        let amt = input.amountDouble ?? 0
        let finalAmt = input.category == .transport && input.transportTrip == .round ? amt * 2 : amt
        self.projectId = input.projectId
        self.projectName = projectName
        self.date = input.dateString
        self.category = input.category.rawValue
        self.amount = finalAmt
        self.taxRate = input.taxRate.doubleValue
        self.description = input.desc
        self.transportMode = input.category == .transport ? input.transportMode.rawValue : nil
        self.transportFrom = input.category == .transport ? input.transportFrom : nil
        self.transportTo = input.category == .transport ? input.transportTo : nil
        self.transportTrip = input.category == .transport ? input.transportTrip.rawValue : nil
    }
}
