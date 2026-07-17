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

    func loadHome() async {
        isLoading = true
        errorMessage = nil
        do {
            async let projects = client.fetchProjects()
            async let notifications = client.fetchNotifications()
            self.projects = try await projects
            self.notifications = try await notifications
        } catch {
            errorMessage = error.localizedDescription
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

