import SwiftUI

struct ProjectListView: View {
    @EnvironmentObject private var navigation: AppNavigationState
    @State private var projects: [GASProject] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedProject: GASProject?

    var activeProjects: [GASProject] {
        projects.filter { $0.status.lowercased() == "active" }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AMD.bgPage.ignoresSafeArea()
                Group {
                    if isLoading && projects.isEmpty {
                        ProgressView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let error = errorMessage {
                        errorView(error)
                    } else if activeProjects.isEmpty {
                        ContentUnavailableView(
                            "プロジェクトなし",
                            systemImage: "hexagon",
                            description: Text("アクティブなプロジェクトがありません")
                        )
                    } else {
                        projectListContent
                    }
                }
            }
            .navigationTitle("月次ルーティン")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(item: $selectedProject) { project in
                RoutineFlowView(
                    project: project,
                    initialTarget: navigation.routineTarget?.projectId == project.projectId
                        ? navigation.routineTarget
                        : nil
                )
            }
            .task {
                guard projects.isEmpty else {
                    syncPendingNavigationIfNeeded()
                    return
                }
                await loadProjects()
            }
            .refreshable { await loadProjects() }
            .onChange(of: navigation.routineTarget?.id) { _, _ in
                syncPendingNavigationIfNeeded()
            }
        }
    }

    private var projectListContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("アクティブ・\(activeProjects.count)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 4)
                .padding(.bottom, 12)

                VStack(spacing: 10) {
                    ForEach(activeProjects) { project in
                        Button {
                            selectedProject = project
                        } label: {
                            ProjectCard(project: project)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.orange)
            Text(message)
                .multilineTextAlignment(.center)
            Button("再試行") { Task { await loadProjects() } }
                .buttonStyle(.bordered)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func loadProjects() async {
        isLoading = true
        errorMessage = nil
        do {
            let sbProjects = try await SupabaseService.shared.fetchActiveProjects()
            projects = sbProjects.map { $0.asGASProject }
            syncPendingNavigationIfNeeded()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func syncPendingNavigationIfNeeded() {
        guard let target = navigation.routineTarget else { return }
        guard let project = activeProjects.first(where: { $0.projectId == target.projectId }) else { return }
        selectedProject = project
    }
}

private struct ProjectCard: View {
    let project: GASProject

    var body: some View {
        HStack(spacing: 14) {
            hexagonIcon
            VStack(alignment: .leading, spacing: 3) {
                Text(project.projectName)
                    .font(.headline)
                    .foregroundStyle(.primary)
                if !project.clientName.isEmpty {
                    Text(project.clientName)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(Color(.tertiaryLabel))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }

    private var hexagonIcon: some View {
        ZStack {
            Circle()
                .fill(iconColor.opacity(0.1))
                .frame(width: 44, height: 44)
            Image(systemName: "hexagon")
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(iconColor)
        }
    }

    private var iconColor: Color {
        let palette: [Color] = [AMD.blue, .orange, .green, .purple, .teal, .indigo]
        let hash = abs(project.projectId.hashValue)
        return palette[hash % palette.count]
    }
}
