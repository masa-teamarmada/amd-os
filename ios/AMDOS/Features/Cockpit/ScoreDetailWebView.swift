import SwiftUI
import WebKit

// MARK: - AMD Score 詳細ページ (PWA WebView)
//
// HUD の Project Signal Board でカードをタップすると開く。
// PWA /venture-map/amd-score/{projectId}（μ/XRL/FRL/CES・計算式の詳細）を、
// iOS の Supabase セッションを cookie 注入して認証付きで表示する。

struct ScoreDetailWebView: View {
    let projectId: String
    let projectName: String
    @Environment(\.dismiss) private var dismiss

    @State private var cookies: [HTTPCookie]?
    @State private var failed = false

    private var url: URL {
        URL(string: "https://amd-os-pwa.vercel.app/venture-map/amd-score/\(projectId)")!
    }

    var body: some View {
        ZStack {
            Color(r: 2, g: 8, b: 18).ignoresSafeArea()

            if let cookies {
                ScoreWebView(url: url, cookies: cookies)
                    .ignoresSafeArea(edges: .bottom)
            } else {
                VStack(spacing: 14) {
                    ProgressView().tint(Color(r: 50, g: 231, b: 255)).scaleEffect(1.3)
                    Text("LOADING AMD SCORE · \(projectId.uppercased())")
                        .font(.system(size: 11, weight: .bold, design: .monospaced)).tracking(2)
                        .foregroundStyle(Color(r: 143, g: 185, b: 198))
                }
            }

            VStack {
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("AMD SCORE")
                            .font(.system(size: 10, weight: .bold, design: .monospaced)).tracking(2)
                            .foregroundStyle(Color(r: 143, g: 185, b: 198))
                        Text(projectName)
                            .font(.system(size: 13, weight: .heavy, design: .monospaced))
                            .foregroundStyle(Color(r: 231, g: 251, b: 255)).lineLimit(1)
                    }
                    .padding(.leading, 18)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color(r: 231, g: 251, b: 255))
                            .frame(width: 38, height: 38)
                            .background(Color(r: 50, g: 231, b: 255).opacity(0.12))
                            .overlay(Circle().stroke(Color(r: 50, g: 231, b: 255).opacity(0.5), lineWidth: 1))
                            .clipShape(Circle())
                    }
                    .padding(.trailing, 16)
                }
                .padding(.top, 10)
                .padding(.bottom, 8)
                .background(Color(r: 2, g: 8, b: 18).opacity(0.92))
                Spacer()
            }
        }
        .preferredColorScheme(.dark)
        .task {
            do {
                cookies = try await SupabaseService.shared.hudWebAuthCookies()
            } catch {
                failed = true
                cookies = []   // 認証無しでもページを試行（最悪ログイン画面が出る）
            }
        }
    }
}

// MARK: WKWebView wrapper（cookie 注入後にロード）

private struct ScoreWebView: UIViewRepresentable {
    let url: URL
    let cookies: [HTTPCookie]

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black

        let store = config.websiteDataStore.httpCookieStore
        guard !cookies.isEmpty else {
            webView.load(URLRequest(url: url))
            return webView
        }
        let group = DispatchGroup()
        for c in cookies {
            group.enter()
            store.setCookie(c) { group.leave() }
        }
        group.notify(queue: .main) {
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
