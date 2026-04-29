import SwiftUI

struct CockpitView: View {
    @EnvironmentObject private var authService: AuthService
    @State private var projects: [SupabaseProject] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("読み込み中...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 48))
                            .foregroundStyle(.orange)
                        Text(err)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                        Button("再読み込み") { Task { await loadData() } }
                            .buttonStyle(.borderedProminent)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if projects.isEmpty {
                    ContentUnavailableView(
                        "PJなし",
                        systemImage: "briefcase",
                        description: Text("アクティブなプロジェクトがありません")
                    )
                } else {
                    List(projects) { project in
                        NavigationLink(destination: CockpitDetailView(project: project)) {
                            projectRow(project)
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("PJ進捗")
            .refreshable { await loadData() }
        }
        .task { await loadData() }
    }

    private func projectRow(_ project: SupabaseProject) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if let client = project.clientName, !client.isEmpty {
                Text(client)
                    .font(.caption)
                    .fontWeight(.bold)
                    .tracking(1.2)
                    .textCase(.uppercase)
                    .foregroundStyle(AMD.textTertiary)
            }
            Text(project.projectName)
                .font(.headline)
                .foregroundStyle(AMD.text)
            if let start = project.startYm, !start.isEmpty {
                Text(ymDisplay(start) + "〜")
                    .font(.caption)
                    .foregroundStyle(AMD.textSub)
            }
        }
        .padding(.vertical, 4)
    }

    private func loadData() async {
        isLoading = true
        errorMessage = nil
        do {
            projects = try await SupabaseService.shared.fetchActiveProjects()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
