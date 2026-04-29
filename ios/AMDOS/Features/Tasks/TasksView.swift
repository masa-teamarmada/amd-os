import SwiftUI

struct TasksView: View {
    @State private var tasks: [AMDTask] = []
    @State private var selectedStatus: AMDTask.TaskStatus? = nil

    var filteredTasks: [AMDTask] {
        if let status = selectedStatus {
            return tasks.filter { $0.status == status }
        }
        return tasks
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // ステータスフィルタ
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(title: "すべて", isSelected: selectedStatus == nil) {
                            selectedStatus = nil
                        }
                        ForEach(AMDTask.TaskStatus.allCases, id: \.self) { status in
                            FilterChip(title: status.label, isSelected: selectedStatus == status) {
                                selectedStatus = status
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }

                Divider()

                if tasks.isEmpty {
                    ContentUnavailableView("タスクなし", systemImage: "checklist", description: Text("つくよみが抽出したタスクや手動タスクが表示されます"))
                } else {
                    List(filteredTasks) { task in
                        TaskRow(task: task)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("タスク")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color(.systemGray5))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
    }
}

struct TaskRow: View {
    let task: AMDTask

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(task.title)
                    .font(.body)
                Spacer()
                if task.source == .tsukuyomi {
                    Image(systemName: "sparkles")
                        .foregroundStyle(.purple)
                        .font(.caption)
                }
            }
            HStack(spacing: 8) {
                Text(task.status.label)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(task.status.color.opacity(0.15))
                    .foregroundStyle(task.status.color)
                    .clipShape(Capsule())
                if let assignee = task.assigneeCodeName {
                    Text(assignee)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

extension AMDTask.TaskStatus {
    var label: String {
        switch self {
        case .pending: return "承認待ち"
        case .todo: return "TODO"
        case .doing: return "進行中"
        case .done: return "完了"
        }
    }

    var color: Color {
        switch self {
        case .pending: return .orange
        case .todo: return .blue
        case .doing: return .green
        case .done: return .gray
        }
    }
}
