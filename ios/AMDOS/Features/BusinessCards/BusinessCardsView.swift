import Foundation
import SwiftUI
import WebKit

/// iOS の名刺タブ。PWA の名刺専用 mobile shell を、現在の Supabase session で開く。
/// 撮影・OCR・確認・PJ Knowledge 同期は PWA と同じ API / DB contract を共有する。
struct BusinessCardsView: View {
    @State private var cookies: [HTTPCookie]?
    @State private var loadError: String?

    private let url = URL(string: "https://amd-os-pwa.vercel.app/native/business-cards")!

    var body: some View {
        ZStack {
            Color(.systemGroupedBackground).ignoresSafeArea()

            if let cookies {
                BusinessCardsWebContainer(
                    url: url,
                    cookies: cookies,
                    onFailure: { message in loadError = message }
                )
            } else {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("名刺台帳を開いてるよ…")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            if let loadError {
                VStack(spacing: 12) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 32))
                        .foregroundStyle(.orange)
                    Text("名刺台帳を開けなかったよ")
                        .font(.headline)
                    Text(loadError)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("もう一度") {
                        self.loadError = nil
                        cookies = nil
                        Task { await loadSession() }
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(24)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
                .padding(24)
            }
        }
        .task { await loadSession() }
    }

    private func loadSession() async {
        do {
            cookies = try await SupabaseService.shared.hudWebAuthCookies()
        } catch {
            loadError = error.localizedDescription
        }
    }
}

private struct BusinessCardsWebContainer: UIViewRepresentable {
    let url: URL
    let cookies: [HTTPCookie]
    let onFailure: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onFailure: onFailure)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .systemGroupedBackground
        webView.scrollView.backgroundColor = .systemGroupedBackground
        webView.customUserAgent = "AMDOS-iOS BusinessCards"

        let store = configuration.websiteDataStore.httpCookieStore
        guard !cookies.isEmpty else {
            webView.load(URLRequest(url: url))
            return webView
        }

        let group = DispatchGroup()
        for cookie in cookies {
            group.enter()
            store.setCookie(cookie) { group.leave() }
        }
        group.notify(queue: .main) {
            webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let onFailure: (String) -> Void

        init(onFailure: @escaping (String) -> Void) {
            self.onFailure = onFailure
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            onFailure(error.localizedDescription)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            onFailure(error.localizedDescription)
        }
    }
}
