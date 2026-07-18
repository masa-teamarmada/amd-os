import Foundation
import Combine

@MainActor
final class AMDOSWorkspaceModel: ObservableObject {
    @Published private(set) var projects: [AMDOSProject] = []
    @Published private(set) var notifications: [AMDOSNotification] = []
    @Published private(set) var projectDetail: AMDOSProjectDetail?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var notificationsErrorMessage: String?
    /// ログイン前に届いた universal link も落とさず、workspace が表示された時点で消費する。
    @Published private(set) var pendingRoute: AMDOSPWAPathRoute?

    private let client: AMDOSRESTClient

    init(client: AMDOSRESTClient = .shared) { self.client = client }

    func acceptNavigationURL(_ url: URL) {
        pendingRoute = AMDOSPWAPathRouter.route(for: url)
    }

    func consumePendingRoute() -> AMDOSPWAPathRoute? {
        defer { pendingRoute = nil }
        return pendingRoute
    }

    func loadHome(email: String? = nil) async {
        isLoading = true
        errorMessage = nil
        notificationsErrorMessage = nil
        do { self.projects = try await client.fetchProjects() }
        catch { errorMessage = error.localizedDescription }
        // 通知はEdge Functionの認可済み配送経路だけを使う。
        // 権限拒否・配送障害を「0件」として扱わない。
        if let email {
            do {
                self.notifications = try await client.fetchNotifications(email: email)
            } catch {
                self.notifications = []
                self.notificationsErrorMessage = error.localizedDescription
            }
        } else {
            self.notifications = []
            self.notificationsErrorMessage = "通知を読むためのログイン情報を確認できなかったよ。"
        }
        isLoading = false
    }

    func loadProjects() async {
        do { projects = try await client.fetchProjects(activeOnly: false) }
        catch { errorMessage = error.localizedDescription }
    }

    func loadProjectDetail(_ projectId: String) async {
        do { projectDetail = try await client.fetchProjectDetail(projectId: projectId) }
        catch { errorMessage = error.localizedDescription }
    }
}
