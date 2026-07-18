import SwiftUI

/// `/payment-confirm?token=...` のネイティブ実装。
///
/// 署名済み token の検証・入金確認の記録は PWA 側の
/// `/api/admin/payment-confirm` だけが行う。Mac は token を解釈・再署名せず、
/// PWA と同じ API 契約を使ってフォームを表示する。
struct AMDOSPaymentConfirmView: View {
    let token: String?

    @State private var meta: AMDOSPaymentConfirmMeta?
    @State private var amount = ""
    @State private var note = ""
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var completion: AMDOSPaymentConfirmCompletion?

    private var normalizedToken: String? { token?.trimmedNonEmpty }
    private var amountYen: Int? {
        let digits = String(amount.unicodeScalars.filter { CharacterSet.decimalDigits.contains($0) })
        guard let value = Int(digits), value > 0 else { return nil }
        return value
    }

    var body: some View {
        ZStack {
            AMDOSDesign.page.ignoresSafeArea()

            ScrollView {
                VStack {
                    Spacer(minLength: 42)
                    content
                        .frame(maxWidth: 560)
                    Spacer(minLength: 42)
                }
                .frame(maxWidth: .infinity, minHeight: 580)
                .padding(.horizontal, 24)
                .padding(.vertical, 28)
            }
        }
        .task(id: token) {
            await load()
        }
    }

    @ViewBuilder
    private var content: some View {
        if normalizedToken == nil {
            AMDOSPaymentConfirmMessageView(
                title: "リンクが足りない",
                message: "Slackのボタンからもう一度開いてね。",
                tone: .error
            )
        } else if isLoading && meta == nil {
            AMDOSPaymentConfirmMessageView(
                title: "確認中",
                message: "入金確認リンクを確認してる...",
                tone: .muted,
                isLoading: true
            )
        } else if let meta {
            form(meta: meta)
        } else if let errorMessage {
            AMDOSPaymentConfirmMessageView(
                title: "リンクを確認できなかった",
                message: errorMessage,
                tone: .error,
                retry: { Task { await load() } }
            )
        } else {
            AMDOSPaymentConfirmMessageView(
                title: "確認中",
                message: "入金確認リンクを確認してる...",
                tone: .muted,
                isLoading: true
            )
        }
    }

    private func form(meta: AMDOSPaymentConfirmMeta) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 5) {
                Text("AMD OS 入金確認")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMDOSDesign.success)
                Text(meta.projectName)
                    .font(.system(size: 24, weight: .semibold))
                Text("入金月 \(AMDOSPaymentConfirmFormatter.ym(meta.invoiceYm)) / 対象 \(meta.sourceYms.map(AMDOSPaymentConfirmFormatter.ym).joined(separator: ", "))")
                    .font(.subheadline)
                    .foregroundStyle(AMDOSDesign.muted)
            }

            VStack(spacing: 9) {
                HStack {
                    Text("入金予定額")
                        .foregroundStyle(AMDOSDesign.muted)
                    Spacer()
                    Text(AMDOSPaymentConfirmFormatter.yen(meta.expectedAmountYen))
                        .fontWeight(.semibold)
                }
                HStack {
                    Text("請求額（税抜）")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                    Spacer()
                    Text(AMDOSPaymentConfirmFormatter.yen(meta.expectedNetAmountYen))
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                }
            }
            .padding(16)
            .background(AMDOSDesign.panel.opacity(0.72), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(AMDOSDesign.border))

            VStack(alignment: .leading, spacing: 7) {
                Text("実際の入金額")
                    .font(.subheadline.weight(.medium))
                TextField("実際の入金額", text: $amount)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 18, weight: .semibold))
                    .multilineTextAlignment(.trailing)
                    .accessibilityLabel("実際の入金額")
            }

            VStack(alignment: .leading, spacing: 7) {
                Text("メモ")
                    .font(.subheadline.weight(.medium))
                TextEditor(text: $note)
                    .font(.body)
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .frame(minHeight: 92)
                    .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(AMDOSDesign.border))
                    .accessibilityLabel("メモ")
                Text("差額理由など")
                    .font(.caption)
                    .foregroundStyle(AMDOSDesign.muted)
            }

            if let errorMessage {
                AMDOSPaymentConfirmAlertView(message: errorMessage, tone: .error)
            }
            if let completion {
                AMDOSPaymentConfirmCompletionView(completion: completion)
            }

            Button(action: submit) {
                HStack(spacing: 8) {
                    if isSaving { ProgressView().controlSize(.small) }
                    Text(isSaving ? "反映中..." : "この金額で入金確認する")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(AMDOSDesign.ink)
            .controlSize(.large)
            .disabled(isSaving || completion != nil)
        }
        .padding(28)
        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(AMDOSDesign.border))
        .shadow(color: .black.opacity(0.08), radius: 25, y: 12)
    }

    private func load() async {
        guard let token = normalizedToken else {
            meta = nil
            amount = ""
            note = ""
            errorMessage = nil
            completion = nil
            isLoading = false
            return
        }

        isLoading = true
        meta = nil
        amount = ""
        note = ""
        errorMessage = nil
        completion = nil
        defer { isLoading = false }

        do {
            let response = try await AMDOSRESTClient.shared.fetchPWA(
                AMDOSPaymentConfirmMetaResponse.self,
                path: "/api/admin/payment-confirm",
                query: ["token": token]
            )
            guard response.ok, let confirmedMeta = response.meta else {
                errorMessage = response.error ?? "入金確認リンクを確認できなかった"
                return
            }
            meta = confirmedMeta
            amount = String(confirmedMeta.expectedAmountYen)
        } catch {
            errorMessage = AMDOSPaymentConfirmError.message(from: error)
        }
    }

    private func submit() {
        guard let token = normalizedToken else {
            errorMessage = "Slackのボタンからもう一度開いてね。"
            return
        }
        guard let amountYen else {
            errorMessage = "入金額を入れてね"
            return
        }

        isSaving = true
        errorMessage = nil
        completion = nil
        Task {
            defer { isSaving = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/admin/payment-confirm",
                    body: AMDOSPaymentConfirmSubmitRequest(token: token, amountYen: amountYen, note: note.trimmedNonEmpty)
                )
                let response = try JSONDecoder().decode(AMDOSPaymentConfirmSubmitResponse.self, from: data)
                guard response.ok else {
                    errorMessage = response.error ?? "更新に失敗した"
                    return
                }
                completion = AMDOSPaymentConfirmCompletion(
                    updated: response.updated ?? 0,
                    alreadyConfirmed: response.alreadyConfirmed ?? 0
                )
            } catch {
                errorMessage = AMDOSPaymentConfirmError.message(from: error)
            }
        }
    }
}

private struct AMDOSPaymentConfirmMetaResponse: Decodable, Sendable {
    let ok: Bool
    let error: String?
    let projectName: String?
    let invoiceYm: String?
    let sourceYms: [String]?
    let expectedAmountYen: Int?
    let expectedNetAmountYen: Int?

    var meta: AMDOSPaymentConfirmMeta? {
        guard let projectName,
              let invoiceYm,
              let sourceYms,
              let expectedAmountYen,
              let expectedNetAmountYen else { return nil }
        return AMDOSPaymentConfirmMeta(
            projectName: projectName,
            invoiceYm: invoiceYm,
            sourceYms: sourceYms,
            expectedAmountYen: expectedAmountYen,
            expectedNetAmountYen: expectedNetAmountYen
        )
    }
}

private struct AMDOSPaymentConfirmMeta: Equatable, Sendable {
    let projectName: String
    let invoiceYm: String
    let sourceYms: [String]
    let expectedAmountYen: Int
    let expectedNetAmountYen: Int
}

private struct AMDOSPaymentConfirmSubmitRequest: Encodable, Sendable {
    let token: String
    let amountYen: Int
    let note: String?
}

private struct AMDOSPaymentConfirmSubmitResponse: Decodable, Sendable {
    let ok: Bool
    let error: String?
    let updated: Int?
    let alreadyConfirmed: Int?
}

private struct AMDOSPaymentConfirmCompletion: Equatable {
    let updated: Int
    let alreadyConfirmed: Int
}

private struct AMDOSPaymentConfirmMessageView: View {
    enum Tone { case muted, error }

    let title: String
    let message: String
    let tone: Tone
    var isLoading = false
    var retry: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 9) {
                if isLoading { ProgressView().controlSize(.small) }
                Text(title)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(tone == .error ? .red : AMDOSDesign.ink)
            }
            Text(message)
                .font(.subheadline)
                .foregroundStyle(AMDOSDesign.muted)
                .textSelection(.enabled)
            if let retry {
                Button("もう一度確認", action: retry)
                    .buttonStyle(.bordered)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(28)
        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(AMDOSDesign.border))
        .shadow(color: .black.opacity(0.08), radius: 25, y: 12)
    }
}

private struct AMDOSPaymentConfirmAlertView: View {
    enum Tone { case error }

    let message: String
    let tone: Tone

    var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(.red)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct AMDOSPaymentConfirmCompletionView: View {
    let completion: AMDOSPaymentConfirmCompletion

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(completion.updated) cycleを入金確認済みにしたよ")
                .font(.subheadline.weight(.medium))
            if completion.alreadyConfirmed > 0 {
                Text("このうち \(completion.alreadyConfirmed) cycle はすでに確認済みだったため、同じ入金確認として記録を更新したよ。")
                    .font(.caption)
            }
        }
        .foregroundStyle(AMDOSDesign.success)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(AMDOSDesign.success.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
    }
}

private enum AMDOSPaymentConfirmFormatter {
    static func yen(_ value: Int) -> String {
        "¥\(value.formatted(.number.grouping(.automatic)))"
    }

    static func ym(_ value: String) -> String {
        guard value.count == 6,
              value.allSatisfy(\.isNumber),
              let month = Int(value.suffix(2)) else { return value }
        return "\(value.prefix(4))年\(month)月"
    }
}

private enum AMDOSPaymentConfirmError {
    private struct APIError: Decodable {
        let error: String?
    }

    static func message(from error: Error) -> String {
        if case let AMDOSNetworkError.http(body) = error,
           let data = body.data(using: .utf8),
           let apiError = try? JSONDecoder().decode(APIError.self, from: data),
           let message = apiError.error?.trimmedNonEmpty {
            return message
        }
        return error.localizedDescription
    }
}
