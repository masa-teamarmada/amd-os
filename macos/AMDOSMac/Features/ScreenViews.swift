import SwiftUI
import AppKit
import UniformTypeIdentifiers

struct AMDOSScreenView: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    let screen: AMDOSScreenID
    @Binding var selectedProjectId: String?
    let onSelectProject: (String) -> Void

    var body: some View {
        switch screen {
        case .today: TodayScreen(onSelectProject: onSelectProject)
        case .projects: ProjectsScreen(onSelectProject: onSelectProject)
        case .projectDetail: ProjectDetailScreen(projectId: selectedProjectId)
        case .notifications: NotificationScreen()
        case .businessCards: BusinessCardScreen()
        case .adminHome: AdminHomeScreen()
        case .account: AccountScreen()
        default: ParityScreen(descriptor: AMDOSParityCatalog.descriptor(for: screen))
        }
    }
}

private struct ScreenHeader: View {
    let descriptor: AMDOSScreenDescriptor

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(descriptor.eyebrow.uppercased())
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AMDOSDesign.blue)
                    Text(descriptor.title)
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                }
                Spacer()
                AMDOSStatusBadge(status: descriptor.readStatus)
            }
            Text(descriptor.purpose)
                .font(.body)
                .foregroundStyle(AMDOSDesign.muted)
                .frame(maxWidth: 760, alignment: .leading)
        }
        .padding(.horizontal, 30)
        .padding(.top, 28)
        .padding(.bottom, 18)
    }
}

private struct TodayScreen: View {
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    let onSelectProject: (String) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(descriptor: AMDOSParityCatalog.descriptor(for: .today))
                if let errorMessage = workspace.errorMessage { ErrorBanner(message: errorMessage) }
                HStack(spacing: 16) {
                    SummaryMetric(title: "アクティブPJ", value: "\(workspace.projects.count)", detail: "projects.status=active")
                    SummaryMetric(title: "未読通知", value: "\(workspace.notifications.filter(\.isUnread).count)", detail: "app_notifications")
                    SummaryMetric(title: "Mac移植", value: "P0–P2", detail: "実装状況をPARITYで管理")
                }
                .padding(.horizontal, 30)
                Text("PJの現在地")
                    .font(.title2.weight(.semibold))
                    .padding(.horizontal, 30)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 16)], spacing: 16) {
                    ForEach(workspace.projects) { project in
                        Button { onSelectProject(project.id) } label: {
                            ProjectCard(project: project)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 30)
                if workspace.projects.isEmpty && !workspace.isLoading {
                    EmptyState(title: "PJがまだ読み込まれていないよ", detail: "右上の再読み込みでSupabaseの現在値を取り直してね。")
                        .padding(.horizontal, 30)
                }
            }
            .padding(.bottom, 30)
        }
        .background(AMDOSDesign.page)
        .toolbar { ReloadToolbar { Task { await workspace.loadHome() } } }
    }
}

private struct ProjectsScreen: View {
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    let onSelectProject: (String) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(descriptor: AMDOSParityCatalog.descriptor(for: .projects))
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 16)], spacing: 16) {
                    ForEach(workspace.projects) { project in
                        Button { onSelectProject(project.id) } label: { ProjectCard(project: project) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 30)
            }
            .padding(.bottom, 30)
        }
        .background(AMDOSDesign.page)
        .toolbar { ReloadToolbar { Task { await workspace.loadProjects() } } }
    }
}

private struct ProjectDetailScreen: View {
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    let projectId: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(descriptor: AMDOSParityCatalog.descriptor(for: .projectDetail))
                if let project = workspace.projectDetail {
                    AMDOSCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(project.project.name).font(.title2.weight(.semibold))
                            Text(project.project.clientName ?? "顧客名未設定")
                                .foregroundStyle(AMDOSDesign.muted)
                            Divider()
                            LabeledContent("状態", value: project.project.status)
                            LabeledContent("期間", value: [project.project.startYm, project.project.endYm].compactMap { $0 }.joined(separator: " – "))
                            LabeledContent("読み取り元", value: project.source)
                        }
                    }
                    .padding(.horizontal, 30)
                    AMDOSCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("移植の境界", systemImage: "arrow.triangle.branch")
                                .font(.headline)
                            Text(project.summary)
                                .foregroundStyle(AMDOSDesign.muted)
                            Text("MSの確定・変更は保存前検算を通す既存PWA/APIへ委譲し、Mac側で任意のREST更新は行わない。")
                                .font(.callout)
                        }
                    }
                    .padding(.horizontal, 30)
                } else {
                    EmptyState(title: "PJを選んでね", detail: "一覧のカードをクリックすると、ここに詳細が開くよ。")
                        .padding(.horizontal, 30)
                }
            }
            .padding(.bottom, 30)
        }
        .background(AMDOSDesign.page)
        .task(id: projectId) {
            if let projectId { await workspace.loadProjectDetail(projectId) }
        }
    }
}

private struct NotificationScreen: View {
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ScreenHeader(descriptor: AMDOSParityCatalog.descriptor(for: .notifications))
                DecisionRail().padding(.horizontal, 30)
                ForEach(workspace.notifications) { notification in
                    NotificationCard(notification: notification)
                        .padding(.horizontal, 30)
                }
                if workspace.notifications.isEmpty {
                    EmptyState(title: "判断待ちの通知はないよ", detail: "読み取り元はapp_notifications。")
                        .padding(.horizontal, 30)
                }
            }
            .padding(.bottom, 30)
        }
        .background(AMDOSDesign.page)
        .toolbar { ReloadToolbar { Task { await workspace.loadHome() } } }
    }
}

private struct BusinessCardScreen: View {
    @State private var stagedFile: URL?
    @State private var isDropTargeted = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ScreenHeader(descriptor: AMDOSParityCatalog.descriptor(for: .businessCards))
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Label("Macの主導線", systemImage: "rectangle.and.hand.point.up.left.fill")
                            .font(.headline)
                        Text("ファイル選択・ドラッグ&ドロップ・クリップボード貼付を入口にして、OCR候補は必ず人が確認してから確定するよ。")
                            .foregroundStyle(AMDOSDesign.muted)
                        HStack {
                            Button("ファイルを選ぶ", systemImage: "plus") { chooseFile() }
                                .buttonStyle(.borderedProminent)
                                .tint(AMDOSDesign.blue)
                            Button("クリップボードから") { stageClipboard() }
                                .buttonStyle(.bordered)
                            Spacer()
                        }
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(isDropTargeted ? AMDOSDesign.blue : AMDOSDesign.border, style: StrokeStyle(lineWidth: 2, dash: [8]))
                            .frame(height: 150)
                            .overlay {
                                VStack(spacing: 8) {
                                    Image(systemName: "arrow.down.doc")
                                        .font(.title2)
                                    Text(stagedFile?.lastPathComponent ?? "名刺画像をここへドロップ")
                                        .foregroundStyle(AMDOSDesign.muted)
                                }
                            }
                            .onDrop(of: [UTType.fileURL.identifier], isTargeted: $isDropTargeted) { providers in
                                guard let provider = providers.first else { return false }
                                provider.loadObject(ofClass: URL.self) { url, _ in
                                    DispatchQueue.main.async { stagedFile = url }
                                }
                                return true
                            }
                    }
                }
                .padding(.horizontal, 30)
                if stagedFile != nil {
                    AMDOSCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("人の確認待ち", systemImage: "person.crop.circle.badge.questionmark")
                                .font(.headline)
                            Text("このMac版は画像を勝手に確定しない。既存の `/api/business-cards` でOCR候補を作り、氏名とPJを確認したPATCHだけを確定経路にする。")
                                .foregroundStyle(AMDOSDesign.muted)
                            Button("PWAの名刺確認面を開く") { openPWA(path: "/business-cards") }
                                .buttonStyle(.bordered)
                        }
                    }
                    .padding(.horizontal, 30)
                }
            }
            .padding(.bottom, 30)
        }
        .background(AMDOSDesign.page)
    }

    private func chooseFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.image]
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK { stagedFile = panel.url }
    }

    private func stageClipboard() {
        if NSPasteboard.general.canReadObject(forClasses: [NSImage.self]) {
            stagedFile = URL(fileURLWithPath: "クリップボードの画像")
        }
    }
}

private struct AdminHomeScreen: View {
    @EnvironmentObject private var auth: AMDOSAuthStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(descriptor: AMDOSParityCatalog.descriptor(for: .adminHome))
                if !auth.isAdmin {
                    EmptyState(title: "管理画面はadmin専用だよ", detail: "members.is_admin=true の権限境界をMac側でも守っているよ。")
                        .padding(.horizontal, 30)
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 250), spacing: 16)], spacing: 16) {
                        ForEach([AMDOSScreenID.adminInvoices, .adminFinance, .adminPayouts, .adminSchedule], id: \.self) { id in
                            let item = AMDOSParityCatalog.descriptor(for: id)
                            AMDOSCard {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(item.title).font(.headline)
                                    Text(item.purpose).font(.callout).foregroundStyle(AMDOSDesign.muted)
                                    AMDOSStatusBadge(status: item.readStatus)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 30)
                }
            }
            .padding(.bottom, 30)
        }
        .background(AMDOSDesign.page)
    }
}

private struct AccountScreen: View {
    @EnvironmentObject private var auth: AMDOSAuthStore

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            ScreenHeader(descriptor: AMDOSParityCatalog.descriptor(for: .account))
            AMDOSCard {
                VStack(alignment: .leading, spacing: 12) {
                    LabeledContent("ログイン", value: auth.email ?? "確認中")
                    LabeledContent("権限", value: auth.isAdmin ? "admin" : "member")
                    Divider()
                    Button("ログアウト", role: .destructive) { auth.signOut() }
                }
            }
            .padding(.horizontal, 30)
            Spacer()
        }
        .background(AMDOSDesign.page)
    }
}

private struct ParityScreen: View {
    let descriptor: AMDOSScreenDescriptor

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ScreenHeader(descriptor: descriptor)
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("移植契約", systemImage: "checklist")
                            .font(.headline)
                        LabeledContent("読み取り元", value: descriptor.source)
                        LabeledContent("権限", value: descriptor.authority)
                        LabeledContent("書込み先", value: descriptor.writeTargets.isEmpty ? "書込みなし" : descriptor.writeTargets.map(\.rawValue).joined(separator: " / "))
                    }
                }
                .padding(.horizontal, 30)
                if let note = descriptor.note {
                    AMDOSCard {
                        Label("未完了の境界", systemImage: "exclamationmark.triangle")
                            .font(.headline)
                        Text(note).foregroundStyle(AMDOSDesign.muted)
                    }
                    .padding(.horizontal, 30)
                }
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("PARITYの扱い", systemImage: "arrow.triangle.2.circlepath")
                            .font(.headline)
                        Text("この画面はPWA route・iOS画面・データ境界を対応表に登録済み。実装済みだけを完了扱いにせず、未移植は削除せず残しているよ。")
                            .foregroundStyle(AMDOSDesign.muted)
                        Text("macos/PARITY.md を正本にして、NativeScreenID・読取元・書込み先・権限・回帰確認を追跡する。")
                            .font(.callout.weight(.semibold))
                    }
                }
                .padding(.horizontal, 30)
            }
            .padding(.bottom, 30)
        }
        .background(AMDOSDesign.page)
    }
}

private struct ProjectCard: View {
    let project: AMDOSProject

    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(project.name).font(.headline)
                    Spacer()
                    Text(project.status).font(.caption).foregroundStyle(AMDOSDesign.success)
                }
                Text(project.clientName ?? "顧客名未設定")
                    .font(.callout)
                    .foregroundStyle(AMDOSDesign.muted)
                if let projectType = project.projectType {
                    Text(projectType).font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
            }
        }
    }
}

private struct NotificationCard: View {
    let notification: AMDOSNotification

    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Label(notification.isUnread ? "未読" : "既読", systemImage: notification.isUnread ? "circle.fill" : "circle")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(notification.isUnread ? AMDOSDesign.blue : AMDOSDesign.muted)
                    Spacer()
                    Text(notification.kind ?? "OS通知").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                Text(notification.displayTitle).font(.headline)
                Text(notification.displayBody).font(.callout).foregroundStyle(AMDOSDesign.muted)
                HStack {
                    Text("押すと起きること：ブラウザ版の安全な判断経路を開く")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                    Spacer()
                    Button("判断を開く") { openPWA(path: "/notifications") }
                        .buttonStyle(.bordered)
                }
            }
        }
    }
}

private struct DecisionRail: View {
    var body: some View {
        HStack(spacing: 0) {
            ForEach(["観測", "候補", "判断", "正本"], id: \.self) { item in
                HStack(spacing: 8) {
                    Text(item).font(.caption.weight(item == "判断" ? .bold : .medium))
                    if item != "正本" { Image(systemName: "chevron.right").font(.caption2) }
                }
                .foregroundStyle(item == "判断" ? AMDOSDesign.blue : AMDOSDesign.muted)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(12)
        .background(AMDOSDesign.blue.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct SummaryMetric: View {
    let title: String
    let value: String
    let detail: String
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(.caption).foregroundStyle(AMDOSDesign.muted)
                Text(value).font(.system(size: 25, weight: .bold, design: .rounded))
                Text(detail).font(.caption2).foregroundStyle(AMDOSDesign.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct EmptyState: View {
    let title: String
    let detail: String
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.headline)
                Text(detail).foregroundStyle(AMDOSDesign.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct ErrorBanner: View {
    let message: String
    var body: some View {
        Text(message)
            .font(.callout)
            .foregroundStyle(.red)
            .padding(.horizontal, 30)
    }
}

private struct ReloadToolbar: ToolbarContent {
    let action: () -> Void
    var body: some ToolbarContent {
        ToolbarItem { Button("再読み込み", systemImage: "arrow.clockwise", action: action) }
    }
}

private func openPWA(path: String) {
    guard let url = URL(string: "https://amd-os-pwa.vercel.app\(path)") else { return }
    NSWorkspace.shared.open(url)
}

