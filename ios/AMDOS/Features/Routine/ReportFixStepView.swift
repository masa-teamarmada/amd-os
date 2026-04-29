import SwiftUI

/// Step 3「月次報告書FIX」ネイティブSheet
/// レポート本文を表示し、PC編集依頼（Slack DM）+ FIXボタンを提供する。
struct ReportFixStepView: View {
    let step: RoutineStep
    let projectId: String
    let bizYm: String

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var authService: AuthService

    @State private var isLoading = true
    @State private var reportData: MonthlyReportData? = nil
    @State private var errorMessage: String? = nil
    @State private var isFixing = false
    @State private var isRequestingEdit = false
    @State private var toastMessage: String? = nil
    @State private var toastIsError = false

    private var ymLabel: String {
        guard bizYm.count == 6 else { return bizYm }
        let y = String(bizYm.prefix(4))
        let m = Int(bizYm.suffix(2)) ?? 0
        return "\(y)年\(m)月"
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("読み込み中...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle).foregroundColor(.orange)
                        Text(error).multilineTextAlignment(.center)
                        Button("再試行") { Task { await loadReport() } }.buttonStyle(.bordered)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let d = reportData {
                    contentView(d)
                }
            }
            .navigationTitle("月次報告書FIX")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
        }
        .task { await loadReport() }
    }

    // MARK: - Content

    private func contentView(_ d: MonthlyReportData) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerRow
                if !d.exists || d.report == nil {
                    noReportView
                } else {
                    reportContentView(d.report!)
                }
                if let msg = toastMessage {
                    Text(msg)
                        .font(.caption)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(toastIsError ? Color.red.opacity(0.1) : Color.green.opacity(0.1))
                        .foregroundColor(toastIsError ? .red : .green)
                        .cornerRadius(8)
                        .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
    }

    private var headerRow: some View {
        HStack {
            Text(ymLabel).font(.subheadline).fontWeight(.semibold)
            Spacer()
            if step.isDone {
                Label("確定済み", systemImage: "checkmark.circle.fill")
                    .font(.caption).foregroundColor(.green)
            }
        }
        .padding(.horizontal)
        .padding(.top, 4)
    }

    private var noReportView: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text")
                .font(.largeTitle).foregroundColor(.secondary)
            Text("まだレポートが生成されていません")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Text("コックピットから月次報告書を生成してください")
                .font(.caption).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(32)
    }

    private func reportContentView(_ r: MonthlyReportContent) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // ステータスバッジ
            if let status = r.status, !status.isEmpty {
                HStack(spacing: 6) {
                    Circle().fill(statusColor(status)).frame(width: 8, height: 8)
                    Text(statusLabel(status)).font(.caption).foregroundStyle(.secondary)
                    if let gen = r.generatedAtJst, !gen.isEmpty {
                        Text("生成: \(fmtDate(gen))").font(.caption2).foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal)
            }

            // レポート本文
            let content = r.finalContent?.isEmpty == false ? r.finalContent! : (r.draftContent ?? "")
            if content.isEmpty {
                Text("レポート本文がありません")
                    .font(.caption).foregroundStyle(.secondary)
                    .padding(.horizontal)
            } else {
                Text(content)
                    .font(.system(size: 13))
                    .lineSpacing(4)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.systemGray6))
                    .cornerRadius(10)
                    .padding(.horizontal)
            }

            // アクションボタン群（未FIX時のみ）
            if !step.isDone {
                VStack(spacing: 10) {
                    // PCで編集依頼 → Slack DM
                    Button {
                        Task { await requestEditOnPC() }
                    } label: {
                        Label(
                            isRequestingEdit ? "送信中..." : "PCで内容を編集する",
                            systemImage: "desktopcomputer"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isRequestingEdit || isFixing)

                    // FIXボタン
                    Button {
                        Task { await fixReport() }
                    } label: {
                        Label(isFixing ? "処理中..." : "レポートをFIXする", systemImage: "checkmark.seal")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isFixing || isRequestingEdit || content.isEmpty)
                }
                .padding(.horizontal)
                .padding(.top, 4)
            }
        }
    }

    // MARK: - API

    private func loadReport() async {
        isLoading = true
        errorMessage = nil
        do {
            reportData = try await SupabaseService.shared.fetchMonthlyReport(
                projectId: projectId, ym: bizYm
            )
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func requestEditOnPC() async {
        guard let email = authService.userEmail else {
            toastMessage = "ログイン情報が取得できません"
            toastIsError = true
            return
        }
        isRequestingEdit = true
        toastMessage = nil
        do {
            let result: RequestReportEditResult = try await SupabaseService.shared.callEdgeFunction(
                "send-slack-dm",
                body: ["projectId": projectId, "ym": bizYm, "email": email]
            )
            if result.ok {
                toastMessage = result.message ?? "Slackに送ったよ！"
                toastIsError = false
            } else {
                toastMessage = result.message ?? "エラーが発生しました"
                toastIsError = true
            }
        } catch {
            toastMessage = error.localizedDescription
            toastIsError = true
        }
        isRequestingEdit = false
    }

    private func fixReport() async {
        let email = authService.userEmail ?? "unknown"
        isFixing = true
        toastMessage = nil
        do {
            try await SupabaseService.shared.fixReport(
                projectId: projectId,
                ym: bizYm,
                fixedBy: email
            )
            toastMessage = "レポートをFIXしました"
            toastIsError = false
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            dismiss()
        } catch {
            toastMessage = error.localizedDescription
            toastIsError = true
        }
        isFixing = false
    }

    // MARK: - Helpers

    private func statusColor(_ s: String) -> Color {
        switch s {
        case "draft": return .orange
        case "approved": return .blue
        case "submitted": return .green
        default: return .secondary
        }
    }

    private func statusLabel(_ s: String) -> String {
        switch s {
        case "draft": return "ドラフト"
        case "approved": return "承認済み"
        case "submitted": return "提出済み"
        default: return s
        }
    }

    private func fmtDate(_ val: String) -> String {
        guard !val.isEmpty else { return "—" }
        let parts = val.prefix(10).split(separator: "-")
        if parts.count == 3, let m = Int(parts[1]), let d = Int(parts[2]) {
            return "\(m)/\(d)"
        }
        return val
    }
}
