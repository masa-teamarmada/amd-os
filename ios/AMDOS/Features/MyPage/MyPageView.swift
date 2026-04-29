import SwiftUI

struct MyPageView: View {
    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var navigation: AppNavigationState

    @State private var data: MyPageData?
    @State private var notifications: [MyPageNotification] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var expandedMonths: Set<String> = []

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("読み込み中...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = errorMessage {
                    errorView(err)
                } else if let data = data {
                    contentView(data)
                }
            }
            .navigationTitle("マイページ")
            .refreshable { await loadData() }
        }
        .task { await loadData() }
    }

    // MARK: - Content

    private func contentView(_ data: MyPageData) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                notificationCard

                // Header: codeName + 当月合計
                if let currentMonth = data.months.first(where: \.isCurrent) {
                    headerCard(codeName: data.codeName, month: currentMonth)
                }

                // Month sections
                ForEach(data.months) { month in
                    monthSection(month, codeName: data.codeName)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .background(Color(.systemGroupedBackground))
    }

    // MARK: - Header Card

    private var notificationCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "bell.badge.fill")
                    .foregroundStyle(.orange)
                Text("いまやること")
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }

            if notifications.isEmpty {
                Text("今すぐ対応が必要なタスクはありません")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(notifications) { note in
                    Button {
                        navigation.openRoutineTarget(
                            projectId: note.projectId,
                            projectName: note.projectName,
                            bizYm: note.bizYm,
                            stepId: note.stepId
                        )
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(colorForStatus(note.status).opacity(0.12))
                                    .frame(width: 36, height: 36)
                                Image(systemName: iconForStatus(note.status))
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(colorForStatus(note.status))
                            }

                            VStack(alignment: .leading, spacing: 3) {
                                Text(note.stepLabel)
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.primary)
                                Text(note.projectName)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if let deadline = note.deadline, !deadline.isEmpty {
                                    Text("期限: \(deadline)")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            Spacer(minLength: 8)

                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                                .padding(.top, 10)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(14)
        .background(Color(.systemBackground))
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }

    private func headerCard(codeName: String, month: MyPageMonth) -> some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(.blue.opacity(0.7))
                VStack(alignment: .leading, spacing: 2) {
                    Text(codeName)
                        .font(.headline)
                    Text(month.displayYm)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            Divider()
            HStack {
                Text("当月報酬合計")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formatYen(month.totalAllocation))
                    .font(.title)
                    .fontWeight(.bold)
                    .fontDesign(.monospaced)
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }

    // MARK: - Month Section

    private func monthSection(_ month: MyPageMonth, codeName: String) -> some View {
        let isExpanded = month.isCurrent || expandedMonths.contains(month.ym)

        return VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    if expandedMonths.contains(month.ym) {
                        expandedMonths.remove(month.ym)
                    } else {
                        expandedMonths.insert(month.ym)
                    }
                }
            } label: {
                HStack {
                    Text(month.displayYm)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    if month.isCurrent {
                        Text("当月")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.12))
                            .cornerRadius(4)
                    }
                    Spacer()
                    Text(formatYen(month.totalAllocation))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .fontDesign(.monospaced)
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .foregroundColor(.primary)
            }
            .buttonStyle(.plain)

            if isExpanded {
                if month.projects.isEmpty {
                    Text("参加PJなし")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 8)
                } else {
                    ForEach(month.projects) { project in
                        ProjectRewardCard(project: project, codeName: codeName)
                    }
                }
            }
        }
    }

    // MARK: - Error

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.orange)
            Text(message)
                .multilineTextAlignment(.center)
            Button("再試行") { Task { await loadData() } }
                .buttonStyle(.bordered)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Data

    private func loadData() async {
        guard let email = authService.userEmail else {
            errorMessage = "ログインしてください"
            isLoading = false
            return
        }
        isLoading = data == nil  // 初回のみフルローディング
        errorMessage = nil
        do {
            let pageData = try await SupabaseService.shared.fetchMyPageData(email: email)
            data = pageData
            isLoading = false
            Task {
                let loadedNotifications = (try? await SupabaseService.shared.fetchMyPageNotifications(email: email)) ?? []
                await MainActor.run {
                    notifications = loadedNotifications
                }
            }
        } catch {
            data = MyPageData(
                memberId: "",
                codeName: authService.userEmail ?? "",
                months: [MyPageMonth(ym: currentYmString(), isCurrent: true, projects: [])]
            )
            notifications = []
            errorMessage = nil
            isLoading = false
            return
        }
    }

    // MARK: - Helpers

    private func currentYmString() -> String {
        let cal = Calendar.current
        let now = Date()
        return String(format: "%04d%02d",
                      cal.component(.year, from: now),
                      cal.component(.month, from: now))
    }

    private func formatYen(_ amount: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        let s = f.string(from: NSNumber(value: amount)) ?? "\(amount)"
        return "¥\(s)"
    }

    private func colorForStatus(_ status: String) -> Color {
        switch status {
        case "overdue": return .red
        case "warn": return .orange
        case "current": return .blue
        default: return .gray
        }
    }

    private func iconForStatus(_ status: String) -> String {
        switch status {
        case "overdue", "warn":
            return "exclamationmark"
        case "current":
            return "bolt.fill"
        default:
            return "circle"
        }
    }
}
