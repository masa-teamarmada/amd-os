import SwiftUI
#if canImport(UIKit)
import UIKit
import QuickLook
#endif

/// 支払通知書 — メンバー単位の詳細・プレビュー・送付画面。
/// 1メンバーの当月分（複数PJ）を1枚にまとめたPDFを生成し、Drive上のURLを開く。
struct PayoutNoticePerMemberView: View {
    let memberId: String
    let codeName: String
    let ym: String
    var onChange: (() -> Void)? = nil

    @State private var isLoading = true
    @State private var detail: PayoutNoticeMemberRow?
    @State private var errorMessage: String?

    @State private var isPreviewing = false
    @State private var isSending = false
    @State private var toastMessage: String?
    @State private var toastIsError = false
    @State private var showSendConfirm = false
    @State private var previewLocalURL: URL?
    @State private var budgetEditTarget: PayoutBudgetEditTarget?

    private var ymLabel: String { ymDisplayAdmin(ym) }
    private var totalYen: Int { detail?.totalYen ?? 0 }
    /// 配賦額が1つ以上入っているか。未設定だけ並んでる状態では PDF を生成できない。
    private var hasAllocated: Bool {
        (detail?.breakdown.contains(where: { $0.isAllocated && $0.yen > 0 }) ?? false)
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView("読み込み中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundStyle(.orange)
                    Text(errorMessage).multilineTextAlignment(.center)
                    Button("再試行") { Task { await loadData() } }
                        .buttonStyle(.bordered)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                content
            }
        }
        .navigationTitle("支払通知書")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadData() }
        .confirmationDialog(
            "\(codeName) さんに送付しますか？",
            isPresented: $showSendConfirm,
            titleVisibility: .visible
        ) {
            Button("送付する") { Task { await runSend() } }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("\(ymLabel)分・合計 \(formatYenAdmin(Double(totalYen))) の支払通知書をメール添付で送付します")
        }
        #if canImport(UIKit)
        .quickLookPreview($previewLocalURL)
        #endif
        .sheet(item: $budgetEditTarget) { target in
            BudgetStepView(projectId: target.projectId, bizYm: target.ym)
                .onDisappear {
                    Task { await loadData() }
                    onChange?()
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard
                breakdownCard
                actionButtons

                if let msg = toastMessage {
                    Text(msg)
                        .font(.caption)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(toastIsError ? Color.red.opacity(0.1) : Color.green.opacity(0.1))
                        .foregroundStyle(toastIsError ? .red : .green)
                        .cornerRadius(8)
                }
            }
            .padding()
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(codeName)
                        .font(.title3)
                        .fontWeight(.semibold)
                    Text(memberId)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let sentAt = detail?.sentAt, !sentAt.isEmpty {
                    Label("送付済み", systemImage: "checkmark.seal.fill")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.green.opacity(0.14))
                        .foregroundStyle(.green)
                        .clipShape(Capsule())
                }
            }
            HStack {
                Text(ymLabel)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formatYenAdmin(Double(totalYen)))
                    .font(.title2)
                    .fontWeight(.bold)
                    .fontDesign(.monospaced)
            }
            if let email = detail?.email, !email.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "envelope")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(email)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                Label("メールアドレス未登録", systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var breakdownCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("PJ内訳")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("タップで予算確定画面へ")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 8)

            ForEach(detail?.breakdown ?? [], id: \.projectId) { pj in
                Button {
                    budgetEditTarget = PayoutBudgetEditTarget(
                        projectId: pj.projectId,
                        ym: ym
                    )
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(pj.projectName)
                                .font(.subheadline)
                                .foregroundStyle(.primary)
                            Text(pj.projectId)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if pj.isAllocated {
                            Text(formatYenAdmin(Double(pj.yen)))
                                .font(.body)
                                .fontDesign(.monospaced)
                                .foregroundStyle(.primary)
                        } else {
                            Text("未設定")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(.orange)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.orange.opacity(0.12))
                                .clipShape(Capsule())
                        }
                        Image(systemName: "chevron.right")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    .contentShape(Rectangle())
                    .padding(.vertical, 8)
                }
                .buttonStyle(.plain)
                if pj.projectId != detail?.breakdown.last?.projectId {
                    Divider()
                }
            }

            Divider().padding(.vertical, 4)

            HStack {
                Text("合計")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formatYenAdmin(Double(totalYen)))
                    .font(.body)
                    .fontWeight(.bold)
                    .fontDesign(.monospaced)
            }

            if (detail?.hasUnsetPJ ?? false) {
                Text("未設定PJはこの通知書には含まれません。配賦が確定したら再送付してください。")
                    .font(.caption2)
                    .foregroundStyle(.orange)
                    .padding(.top, 6)
            }
        }
        .padding(14)
        .background(Color(.systemBackground))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.separator), lineWidth: 0.5)
        )
        .cornerRadius(12)
    }

    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button {
                Task { await runPreview() }
            } label: {
                HStack {
                    Spacer()
                    Label(
                        isPreviewing ? "PDF生成中..." : "PDFをプレビュー",
                        systemImage: isPreviewing ? "hourglass" : "doc.text.magnifyingglass"
                    )
                    Spacer()
                }
            }
            .buttonStyle(.bordered)
            .disabled(!hasAllocated || isPreviewing || isSending)

            Button {
                showSendConfirm = true
            } label: {
                HStack {
                    Spacer()
                    Label(
                        isSending ? "送付中..." : ((detail?.isSent ?? false) ? "再送付する" : "送付する"),
                        systemImage: isSending ? "hourglass" : "paperplane.fill"
                    )
                    .fontWeight(.semibold)
                    Spacer()
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(!hasAllocated || isPreviewing || isSending || (detail?.email ?? "").isEmpty)
        }
    }

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let all = try await SupabaseService.shared.fetchPayoutNoticeMembers(ym: ym)
            detail = all.first(where: { $0.memberId == memberId })
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func runPreview() async {
        isPreviewing = true
        toastMessage = nil
        defer { isPreviewing = false }
        do {
            let result = try await SupabaseService.shared.payoutNoticeGenerate(
                memberId: memberId, ym: ym, mode: "preview"
            )
            guard result.ok else {
                toastMessage = result.message ?? "プレビュー生成に失敗しました"
                toastIsError = true
                return
            }
            // GAS は base64 で PDF バイナリを返す（Drive URL は HTML 確認ページ
            // を返してくる事故が多いため、base64 を経由してローカルに書き出す）
            if let b64 = result.pdfBase64, !b64.isEmpty,
               let data = Data(base64Encoded: b64) {
                await openPreviewFromData(data)
            } else if let urlStr = result.pdfUrl, let url = URL(string: urlStr) {
                await openPreview(remoteURL: url)
            } else {
                toastMessage = "PDFデータが空でした"
                toastIsError = true
            }
        } catch {
            toastMessage = error.localizedDescription
            toastIsError = true
        }
    }

    private func openPreviewFromData(_ data: Data) async {
        #if canImport(UIKit)
        do {
            let tmp = FileManager.default.temporaryDirectory
                .appendingPathComponent("payout_preview_\(memberId)_\(ym)_\(UUID().uuidString.prefix(6)).pdf")
            try data.write(to: tmp)
            previewLocalURL = tmp
        } catch {
            toastMessage = "PDFの保存に失敗: \(error.localizedDescription)"
            toastIsError = true
        }
        #else
        toastMessage = "プレビューは iOS でのみ利用可能です"
        toastIsError = true
        #endif
    }

    private func openPreview(remoteURL: URL) async {
        #if canImport(UIKit)
        do {
            let (data, response) = try await URLSession.shared.data(from: remoteURL)
            if let mime = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type"),
               !mime.contains("pdf") && !mime.contains("octet-stream") {
                toastMessage = "PDFを取得できませんでした（mime=\(mime)）"
                toastIsError = true
                return
            }
            await openPreviewFromData(data)
        } catch {
            toastMessage = "PDFのダウンロードに失敗: \(error.localizedDescription)"
            toastIsError = true
        }
        #else
        toastMessage = "プレビューは iOS でのみ利用可能です"
        toastIsError = true
        #endif
    }

    private func runSend() async {
        isSending = true
        toastMessage = nil
        defer { isSending = false }
        do {
            let result = try await SupabaseService.shared.payoutNoticeGenerate(
                memberId: memberId, ym: ym, mode: "send"
            )
            if result.ok {
                toastMessage = result.message ?? "送付しました"
                toastIsError = false
                onChange?()
                await loadData()
            } else {
                toastMessage = result.message ?? "送付に失敗しました"
                toastIsError = true
            }
        } catch {
            toastMessage = error.localizedDescription
            toastIsError = true
        }
    }
}

/// PJ内訳タップで開く BudgetStepView シートの対象指定用。
private struct PayoutBudgetEditTarget: Identifiable {
    let projectId: String
    let ym: String
    var id: String { "\(projectId)_\(ym)" }
}
