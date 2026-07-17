import SwiftUI
import AppKit
import UniformTypeIdentifiers

struct AMDOSScreenView: View {
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
        case .monthlyAgreement: MonthlyAgreementScreen()
        case .adminHome: AdminHomeScreen()
        case .account: AccountScreen()
        case .reimbursements: SimpleLandingScreen(title: "立替", subtitle: "申請と確認をひとつの場所で")
        case .atlas: ExploreScreen(title: "Atlas", subtitle: "世界の変化から、次の一手を見つける", cards: ["技術の動き", "市場の変化", "気になるシグナル"])
        case .materials: ExploreScreen(title: "材料", subtitle: "素材の特徴と使い道を比べる", cards: ["元素・鉱物", "樹脂・複合材", "用途から探す"])
        case .seeds: ExploreScreen(title: "研究シーズ", subtitle: "研究の芽を、育てる相手と出会わせる", cards: ["新しい研究", "技術の強み", "育て方の候補"])
        case .poc: ExploreScreen(title: "PoC候補", subtitle: "技術と現場の組み合わせを考える", cards: ["候補案件", "試してみたいこと", "次の打ち合わせ"])
        case .vcs: ExploreScreen(title: "投資候補", subtitle: "相性のよいパートナーを見つける", cards: ["投資家の動き", "紹介のきっかけ", "準備するもの"])
        case .scholar: ExploreScreen(title: "研究動向", subtitle: "学術の流れを、仕事の視点で読む", cards: ["注目のテーマ", "新しい論文", "研究者の動き"])
        case .institutions: ExploreScreen(title: "研究機関", subtitle: "研究機関とのつながりを整理する", cards: ["研究機関", "連携の可能性", "関係するPJ"])
        case .amdScore: ExploreScreen(title: "プロジェクトの見立て", subtitle: "技術と事業の現在地を根拠と一緒に見る", cards: ["技術の準備", "事業の準備", "次に確かめること"])
        case .adminInvoices: AdminSectionScreen(title: "請求書", subtitle: "締めた仕事の請求を確認する", icon: "doc.text.fill")
        case .adminFinance: AdminSectionScreen(title: "財務", subtitle: "支払と資金の流れを確認する", icon: "yensign.circle.fill")
        case .adminPayouts: AdminSectionScreen(title: "支払", subtitle: "報酬と支払の状態を確認する", icon: "banknote.fill")
        case .adminContracts: AdminSectionScreen(title: "契約", subtitle: "契約条件と更新時期を確認する", icon: "signature")
        case .adminMembers: AdminSectionScreen(title: "メンバー", subtitle: "メンバーと役割を確認する", icon: "person.2.fill")
        case .adminGovernance: AdminSectionScreen(title: "会社情報", subtitle: "会社の大切な情報を確認する", icon: "building.columns")
        case .adminPrivateWiki: AdminSectionScreen(title: "人物メモ", subtitle: "チームの文脈を安全に引き継ぐ", icon: "lock.document")
        case .adminManagementKnowledge: AdminSectionScreen(title: "経営ノウハウ", subtitle: "次の判断に活かせる知恵を探す", icon: "lightbulb.fill")
        case .adminSchedule: AdminSectionScreen(title: "運営カレンダー", subtitle: "これからの締切と予定を見通す", icon: "calendar")
        case .adminMsOverview: AdminSectionScreen(title: "マイルストーン", subtitle: "プロジェクトの節目を確認する", icon: "chart.bar.doc.horizontal")
        case .adminSeasonPl: AdminSectionScreen(title: "シーズン予実", subtitle: "シーズンの計画と実績を比べる", icon: "chart.bar.fill")
        case .adminWeekly: AdminSectionScreen(title: "週次活動", subtitle: "今週の動きと積み重ねを確認する", icon: "calendar.badge.clock")
        case .hud: AdminSectionScreen(title: "状況モニター", subtitle: "チームとプロジェクトの状態を俯瞰する", icon: "display")
        case .manual: SimpleLandingScreen(title: "使い方", subtitle: "AMD OSを気持ちよく使うための案内")
        case .spec: SimpleLandingScreen(title: "設計書", subtitle: "チームの仕事を支える考え方")
        case .bzm: SimpleLandingScreen(title: "教科書", subtitle: "Before Zeroの考え方を読む")
        }
    }
}

private struct PageHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(eyebrow.uppercased())
                .font(.caption.weight(.semibold))
                .tracking(1.4)
                .foregroundStyle(AMDOSDesign.blue)
            Text(title)
                .font(.system(size: 30, weight: .bold, design: .rounded))
            Text(subtitle)
                .font(.body)
                .foregroundStyle(AMDOSDesign.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ContentShell<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        ScrollView {
            content
                .frame(maxWidth: 1060, alignment: .leading)
                .padding(32)
                .padding(.bottom, 24)
        }
        .background(AMDOSDesign.page)
    }
}

private struct TodayScreen: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    let onSelectProject: (String) -> Void

    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader(eyebrow: "TODAY", title: "今日", subtitle: "いま動かす仕事と、チームの現在地をひとつに")
                HStack(spacing: 14) {
                    TodayMetric(title: "進行中のプロジェクト", value: "\(workspace.projects.count)", icon: "rectangle.3.group.fill", tint: AMDOSDesign.blue)
                    TodayMetric(title: "確認するお知らせ", value: "\(workspace.notifications.count)", icon: "bell.fill", tint: AMDOSDesign.warning)
                    TodayMetric(title: "次に進めること", value: workspace.projects.isEmpty ? "—" : "1", icon: "arrow.right.circle.fill", tint: AMDOSDesign.success)
                }
                HStack(alignment: .top, spacing: 20) {
                    AMDOSCard {
                        VStack(alignment: .leading, spacing: 14) {
                            SectionTitle(title: "プロジェクト", action: nil, systemImage: "rectangle.3.group.fill")
                            if workspace.projects.isEmpty {
                                EmptyState(title: "プロジェクトを読み込んでいるよ", detail: "接続できると、ここに参加中のプロジェクトが並ぶよ。")
                            } else {
                                ForEach(workspace.projects.prefix(5)) { project in
                                    Button { onSelectProject(project.id) } label: {
                                        ProjectRow(project: project)
                                    }
                                    .buttonStyle(.plain)
                                    if project.id != workspace.projects.prefix(5).last?.id { Divider() }
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    AMDOSCard {
                        VStack(alignment: .leading, spacing: 14) {
                            SectionTitle(title: "今日の流れ", action: nil, systemImage: "sun.max.fill")
                            FlowRow(number: "01", title: "状況を見る", detail: "進行中のPJを確認")
                            FlowRow(number: "02", title: "ひとつ決める", detail: "先に進めることを選ぶ")
                            FlowRow(number: "03", title: "チームに渡す", detail: "次の動きを共有")
                        }
                    }
                    .frame(width: 300)
                }
            }
        }
        .toolbar { ReloadToolbar { Task { await workspace.loadHome(email: auth.email) } } }
    }
}

private struct ProjectsScreen: View {
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    let onSelectProject: (String) -> Void

    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader(eyebrow: "WORK", title: "プロジェクト", subtitle: "一覧から選んで、詳細と次の一歩を確認")
                if workspace.projects.isEmpty {
                    EmptyState(title: "プロジェクトがまだありません", detail: "右上の更新ボタンで最新の状態を読み込めるよ。")
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 290), spacing: 16)], spacing: 16) {
                        ForEach(workspace.projects) { project in
                            Button { onSelectProject(project.id) } label: { ProjectCard(project: project) }
                                .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .toolbar { ReloadToolbar { Task { await workspace.loadProjects() } } }
    }
}

private struct ProjectDetailScreen: View {
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel
    let projectId: String?

    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                if let project = workspace.projectDetail {
                    PageHeader(eyebrow: "PROJECT", title: project.project.name, subtitle: project.project.clientName ?? "チームで進めるプロジェクト")
                    HStack(alignment: .top, spacing: 18) {
                        AMDOSCard {
                            VStack(alignment: .leading, spacing: 14) {
                                Label("現在地", systemImage: "location.fill").font(.headline).foregroundStyle(AMDOSDesign.blue)
                                Text(project.project.status.capitalized)
                                    .font(.system(size: 24, weight: .bold, design: .rounded))
                                Text("このプロジェクトの情報を確認しながら、次の一歩を決められるよ。")
                                    .foregroundStyle(AMDOSDesign.muted)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        AMDOSCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Label("期間", systemImage: "calendar").font(.headline)
                                Text([project.project.startYm, project.project.endYm].compactMap { $0 }.joined(separator: " 〜 ").ifEmpty("設定なし"))
                                    .font(.title3.weight(.semibold))
                                Text(project.project.projectType ?? "プロジェクト")
                                    .foregroundStyle(AMDOSDesign.muted)
                            }
                        }
                        .frame(width: 270)
                    }
                    AMDOSCard {
                        VStack(alignment: .leading, spacing: 14) {
                            SectionTitle(title: "次に確認すること", action: nil, systemImage: "checklist")
                            DetailRow(icon: "flag.fill", title: "節目", detail: "今月の進み具合を確認")
                            DetailRow(icon: "doc.text.fill", title: "資料", detail: "関係する資料をまとめて見る")
                            DetailRow(icon: "person.2.fill", title: "チーム", detail: "関わるメンバーを確認")
                        }
                    }
                } else {
                    PageHeader(eyebrow: "PROJECT", title: "プロジェクト詳細", subtitle: "一覧からプロジェクトを選んでね")
                    EmptyState(title: "プロジェクトを選んでね", detail: "左の一覧から選ぶと、ここに詳細が開くよ。")
                }
            }
        }
        .task(id: projectId) {
            if let projectId { await workspace.loadProjectDetail(projectId) }
        }
    }
}

private struct NotificationScreen: View {
    @EnvironmentObject private var auth: AMDOSAuthStore
    @EnvironmentObject private var workspace: AMDOSWorkspaceModel

    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader(eyebrow: "INBOX", title: "お知らせ", subtitle: "チームから届いた、確認しておきたいこと")
                if workspace.notifications.isEmpty {
                    EmptyState(title: "いま確認することはないよ", detail: "新しいお知らせが届いたら、ここに表示されるよ。")
                } else {
                    ForEach(workspace.notifications) { notification in
                        NotificationCard(notification: notification)
                    }
                }
            }
        }
        .toolbar { ReloadToolbar { Task { await workspace.loadHome(email: auth.email) } } }
    }
}

private struct BusinessCardScreen: View {
    @State private var stagedFile: URL?
    @State private var isDropTargeted = false

    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader(eyebrow: "CONTACTS", title: "名刺", subtitle: "Macに届いた名刺を、確認しながらチームの資産へ")
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 16) {
                        SectionTitle(title: "名刺画像を追加", action: nil, systemImage: "person.text.rectangle")
                        Text("ファイルを選ぶ、ここへドロップする、画像を貼り付ける。どの入口からでも、候補を確認してから保存できるよ。")
                            .foregroundStyle(AMDOSDesign.muted)
                        HStack(spacing: 10) {
                            Button("ファイルを選ぶ", systemImage: "plus") { chooseFile() }
                                .buttonStyle(.borderedProminent).tint(AMDOSDesign.blue)
                            Button("画像を貼り付ける", systemImage: "doc.on.clipboard") { stageClipboard() }
                                .buttonStyle(.bordered)
                        }
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(isDropTargeted ? AMDOSDesign.blue : AMDOSDesign.border, style: StrokeStyle(lineWidth: 2, dash: [8]))
                            .frame(height: 170)
                            .overlay {
                                VStack(spacing: 8) {
                                    Image(systemName: "arrow.down.doc.fill").font(.title2).foregroundStyle(AMDOSDesign.blue)
                                    Text(stagedFile?.lastPathComponent ?? "名刺画像をここへドロップ")
                                        .foregroundStyle(AMDOSDesign.muted)
                                }
                            }
                            .onDrop(of: [UTType.fileURL.identifier], isTargeted: $isDropTargeted) { providers in
                                guard let provider = providers.first else { return false }
                                _ = provider.loadObject(ofClass: URL.self) { url, _ in
                                    DispatchQueue.main.async { stagedFile = url }
                                }
                                return true
                            }
                    }
                }
                if stagedFile != nil {
                    AMDOSCard {
                        Label("確認してから保存", systemImage: "checkmark.seal.fill")
                            .font(.headline)
                            .foregroundStyle(AMDOSDesign.success)
                        Text("読み取り候補は自動で確定しないよ。氏名や所属、関係するプロジェクトを確認してから保存する流れ。")
                            .foregroundStyle(AMDOSDesign.muted)
                            .padding(.top, 4)
                        AMDOSExternalLink(path: "/business-cards") {
                            Label("候補を確認する", systemImage: "arrow.up.right.square")
                        }
                        .padding(.top, 4)
                    }
                }
            }
        }
    }

    private func chooseFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.image]
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK { stagedFile = panel.url }
    }

    private func stageClipboard() {
        guard NSPasteboard.general.canReadObject(forClasses: [NSImage.self]) else { return }
        stagedFile = URL(fileURLWithPath: "貼り付けた画像")
    }
}

private struct MonthlyAgreementScreen: View {
    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader(eyebrow: "THIS MONTH", title: "月初の確認", subtitle: "今月やることと、報酬の見込みを同じ画面で確認")
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 16) {
                        Label("今月の仕事", systemImage: "list.bullet.clipboard")
                            .font(.headline).foregroundStyle(AMDOSDesign.blue)
                        AgreementRow(title: "担当する仕事", detail: "今月の遂行対象を確認")
                        AgreementRow(title: "見込みの報酬", detail: "仕事ごとの期待額を確認")
                        AgreementRow(title: "確認の履歴", detail: "合意した内容をいつでも見返す")
                        Divider()
                        AMDOSExternalLink(path: "/mypage") {
                            Label("今月の内容を開く", systemImage: "arrow.up.right.square")
                        }
                    }
                }
            }
        }
    }
}

private struct AdminHomeScreen: View {
    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader(eyebrow: "OPERATIONS", title: "管理ホーム", subtitle: "会社とチームの運営を、今日見るべき順番で")
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 240), spacing: 16)], spacing: 16) {
                    AdminTile(title: "今月の締め", detail: "請求・報酬・支払を確認", icon: "calendar.badge.clock")
                    AdminTile(title: "お金の流れ", detail: "財務と入出金を確認", icon: "yensign.circle.fill")
                    AdminTile(title: "チーム", detail: "メンバーと役割を確認", icon: "person.2.fill")
                    AdminTile(title: "会社情報", detail: "契約と大切な記録を確認", icon: "building.columns.fill")
                }
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("管理者向けの入口", systemImage: "sparkles")
                            .font(.headline).foregroundStyle(AMDOSDesign.blue)
                        Text("左のメニューから、必要な台帳を選んで確認できるよ。")
                            .foregroundStyle(AMDOSDesign.muted)
                    }
                }
            }
        }
    }
}

private struct AccountScreen: View {
    @EnvironmentObject private var auth: AMDOSAuthStore

    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader(eyebrow: "ACCOUNT", title: "アカウント", subtitle: "ログイン状態とAMD OSの接続を管理")
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 14) {
                        LabeledContent("メールアドレス", value: auth.email ?? "確認中")
                        Divider()
                        Button("サインアウト", role: .destructive) { auth.signOut() }
                    }
                }
            }
        }
    }
}

private struct ExploreScreen: View {
    let title: String
    let subtitle: String
    let cards: [String]

    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader(eyebrow: "EXPLORE", title: title, subtitle: subtitle)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 240), spacing: 16)], spacing: 16) {
                    ForEach(cards, id: \.self) { card in
                        AMDOSCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Image(systemName: "circle.grid.2x2.fill").foregroundStyle(AMDOSDesign.blue)
                                Text(card).font(.headline)
                                Text("気になる情報を集めて、チームの会話につなげる")
                                    .font(.callout).foregroundStyle(AMDOSDesign.muted)
                            }
                            .frame(maxWidth: .infinity, minHeight: 106, alignment: .leading)
                        }
                    }
                }
            }
        }
    }
}

private struct AdminSectionScreen: View {
    let title: String
    let subtitle: String
    let icon: String

    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader(eyebrow: "OPERATIONS", title: title, subtitle: subtitle)
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: icon).font(.title2).foregroundStyle(AMDOSDesign.blue)
                        Text("確認したい内容を選んで、最新の状態を見られるよ。")
                            .foregroundStyle(AMDOSDesign.muted)
                        AMDOSExternalLink(path: "/admin") {
                            Label("管理画面を開く", systemImage: "arrow.up.right.square")
                        }
                    }
                }
            }
        }
    }
}

private struct SimpleLandingScreen: View {
    let title: String
    let subtitle: String

    var body: some View {
        ContentShell {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader(eyebrow: "AMD OS", title: title, subtitle: subtitle)
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Image("AMDLogoMark").resizable().scaledToFit().frame(width: 48, height: 48)
                        Text("チームの仕事を支える情報を、ここから探せるよ。")
                            .foregroundStyle(AMDOSDesign.muted)
                    }
                }
            }
        }
    }
}

private struct SectionTitle: View {
    let title: String
    let action: String?
    let systemImage: String

    var body: some View {
        HStack {
            Label(title, systemImage: systemImage).font(.headline)
            Spacer()
            if let action { Text(action).font(.caption).foregroundStyle(AMDOSDesign.blue) }
        }
    }
}

private struct TodayMetric: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color

    var body: some View {
        AMDOSCard {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.title3).foregroundStyle(tint)
                VStack(alignment: .leading, spacing: 4) {
                    Text(value).font(.title2.weight(.bold))
                    Text(title).font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct ProjectRow: View {
    let project: AMDOSProject

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 4).fill(AMDOSDesign.blue).frame(width: 4, height: 38)
            VStack(alignment: .leading, spacing: 4) {
                Text(project.name).font(.headline)
                Text(project.clientName ?? "チームのプロジェクト").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(AMDOSDesign.muted)
        }
        .contentShape(Rectangle())
    }
}

private struct ProjectCard: View {
    let project: AMDOSProject

    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(project.name).font(.headline)
                    Spacer()
                    Circle().fill(AMDOSDesign.success).frame(width: 8, height: 8)
                }
                Text(project.clientName ?? "チームのプロジェクト")
                    .font(.callout).foregroundStyle(AMDOSDesign.muted)
                Divider()
                HStack {
                    Text(project.projectType ?? "プロジェクト")
                    Spacer()
                    Image(systemName: "arrow.up.right").font(.caption)
                }
                .font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            .frame(maxWidth: .infinity, minHeight: 112, alignment: .leading)
        }
    }
}

private struct NotificationCard: View {
    let notification: AMDOSNotification

    var body: some View {
        AMDOSCard {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: "bell.fill").foregroundStyle(AMDOSDesign.blue)
                VStack(alignment: .leading, spacing: 6) {
                    Text(notification.displayTitle).font(.headline)
                    Text(notification.displayBody).font(.callout).foregroundStyle(AMDOSDesign.muted)
                }
                Spacer()
                Text("確認") .font(.caption.weight(.semibold)).foregroundStyle(AMDOSDesign.blue)
            }
        }
    }
}

private struct DetailRow: View {
    let icon: String
    let title: String
    let detail: String
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(AMDOSDesign.blue).frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.callout).foregroundStyle(AMDOSDesign.muted)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(AMDOSDesign.muted)
        }
    }
}

private struct FlowRow: View {
    let number: String
    let title: String
    let detail: String
    var body: some View {
        HStack(spacing: 10) {
            Text(number).font(.caption.monospacedDigit().weight(.bold)).foregroundStyle(AMDOSDesign.blue)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
        }
    }
}

private struct AgreementRow: View {
    let title: String
    let detail: String
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.callout).foregroundStyle(AMDOSDesign.muted)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(AMDOSDesign.muted)
        }
    }
}

private struct AdminTile: View {
    let title: String
    let detail: String
    let icon: String
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: icon).font(.title3).foregroundStyle(AMDOSDesign.blue)
                Text(title).font(.headline)
                Text(detail).font(.callout).foregroundStyle(AMDOSDesign.muted)
            }
            .frame(maxWidth: .infinity, minHeight: 94, alignment: .leading)
        }
    }
}

private struct EmptyState: View {
    let title: String
    let detail: String
    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 7) {
                Text(title).font(.headline)
                Text(detail).font(.callout).foregroundStyle(AMDOSDesign.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct ReloadToolbar: ToolbarContent {
    let action: () -> Void
    var body: some ToolbarContent {
        ToolbarItem { Button("更新", systemImage: "arrow.clockwise", action: action).help("最新の状態に更新") }
    }
}

private struct AMDOSExternalLink<Label: View>: View {
    let url: URL
    @ViewBuilder let label: () -> Label

    init(path: String, @ViewBuilder label: @escaping () -> Label) {
        self.url = URL(string: "https://amd-os-pwa.vercel.app\(path)")!
        self.label = label
    }

    var body: some View {
        Link(destination: url, label: label)
            .buttonStyle(.bordered)
            .accessibilityHint("Commandキーを押しながらクリックすると新しいタブで開ける")
    }
}

private extension String {
    func ifEmpty(_ fallback: String) -> String { isEmpty ? fallback : self }
}
