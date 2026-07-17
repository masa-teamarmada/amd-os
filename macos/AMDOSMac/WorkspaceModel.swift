import Foundation
import Combine

@MainActor
final class AMDOSWorkspaceModel: ObservableObject {
    @Published private(set) var projects: [AMDOSProject] = []
    @Published private(set) var notifications: [AMDOSNotification] = []
    @Published private(set) var projectDetail: AMDOSProjectDetail?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let client: AMDOSRESTClient

    init(client: AMDOSRESTClient = .shared) { self.client = client }

    func loadHome(email: String? = nil) async {
        isLoading = true
        errorMessage = nil
        do { self.projects = try await client.fetchProjects() }
        catch { errorMessage = error.localizedDescription }
        // 通知はEdge Functionの認可済み配送経路だけを使う。取得できない場合も、
        // PJ一覧まで巻き戻したり権限エラーを画面へ露出させたりしない。
        if let email {
            self.notifications = (try? await client.fetchNotifications(email: email)) ?? []
        } else {
            self.notifications = []
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
