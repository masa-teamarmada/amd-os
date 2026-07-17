import Foundation

enum AMDOSParityCatalog {
    static let descriptors: [AMDOSScreenID: AMDOSScreenDescriptor] = [
        .today: descriptor(.today, "今日", "自分の現在地", "参加PJの今月状況と、先に判断すべき通知をまとめて確認する", "PWA /mypage + app_notifications", "認証済みAMDメンバー", .implemented, [.notificationFeedback], nil),
        .projects: descriptor(.projects, "PJ", "仕事", "全PJを一覧で見て、選択したPJの詳細へ入る", "PWA /dashboard + projects", "認証済みAMDメンバー", .implemented, [], nil),
        .projectDetail: descriptor(.projectDetail, "PJ詳細", "仕事", "進捗・スコア・月次・資料・MTGを一覧と詳細で確認する", "PWA /project/[projectId]/cockpit + ios CockpitView", "認証済みAMDメンバー", .shell, [.milestoneProgress], "MS編集、MTG添付、会社概要の全項目は移植中"),
        .notifications: descriptor(.notifications, "通知", "判断", "観測から候補になった情報を一件ずつ確認し、判断コメントを残す", "PWA /notifications + l2_notifications / meeting_notifications", "admin gate / 通知対象", .shell, [.notificationFeedback], "確定処理は既存PWA/APIの安全な書込み経路へ委譲する"),
        .reimbursements: descriptor(.reimbursements, "立替", "仕事", "立替申請を確認し、必要な申請を作成する", "PWA /reimburse + reimbursements", "認証済みAMDメンバー", .shell, [.reimbursement], "画像添付・申請APIは移植中"),
        .businessCards: descriptor(.businessCards, "名刺", "仕事", "ファイル・ドラッグ・クリップボードから名刺候補を人が確認する", "PWA /business-cards + private Storage", "認証済みAMDメンバー", .shell, [.businessCardReview], "OCRと確定PATCHは既存APIへつなぐ"),
        .monthlyAgreement: descriptor(.monthlyAgreement, "月初合意", "仕事", "担当内容と予定額を同じ順序で確認して合意する", "PWA /monthly-agreement", "認証済みAMDメンバー", .shell, [.adminLedger], nil),
        .atlas: descriptor(.atlas, "Atlas", "探索", "外部シグナルをPJの判断材料として読む", "PWA /atlas/* + atlas_*", "認証済みAMDメンバー", .shell, [], "外部コネクタの読み取りとsource ref表示を移植中"),
        .materials: descriptor(.materials, "材料", "探索", "元素・鉱物・樹脂を供給と用途から比較する", "PWA /knowledge-map + materials-data", "認証済みAMDメンバー", .shell, [], "読み取り専用。DB書込みとLLM呼び出しは持たせない"),
        .seeds: descriptor(.seeds, "Seeds", "探索", "研究シーズをPoC候補へつなげる", "PWA /seeds/* + seeds", "認証済みAMDメンバー", .pending, [.adminLedger], nil),
        .poc: descriptor(.poc, "PoC", "探索", "研究シーズとPoC先の掛け合わせを案件化する", "PWA /poc + poc_*", "認証済みAMDメンバー", .pending, [.adminLedger], nil),
        .vcs: descriptor(.vcs, "VC", "探索", "VC候補と投資シグナルを確認する", "PWA /vcs/* + vcs", "認証済みAMDメンバー", .pending, [], nil),
        .scholar: descriptor(.scholar, "研究動向", "探索", "学術トレンドと研究機関のシグナルを読む", "PWA /scholar", "認証済みAMDメンバー", .pending, [], nil),
        .institutions: descriptor(.institutions, "研究機関", "探索", "ECRと関連PJの状況を研究機関単位で読む", "PWA /institutions/*", "認証済みAMDメンバー", .shell, [.adminLedger], nil),
        .amdScore: descriptor(.amdScore, "AMD Score", "探索", "PJの技術・事業準備度を根拠付きで確認する", "PWA /venture-map/amd-score", "認証済みAMDメンバー", .pending, [], nil),
        .adminHome: descriptor(.adminHome, "管理ホーム", "管理", "管理者が先に処理すべき台帳・請求・支払を見る", "PWA /admin", "members.is_admin=true", .shell, [.adminLedger], nil),
        .adminInvoices: descriptor(.adminInvoices, "請求書", "管理", "締め済み稼働月の請求書発行を処理する", "PWA /admin/invoices + issue-invoice", "admin", .pending, [.adminLedger], nil),
        .adminFinance: descriptor(.adminFinance, "財務", "管理", "法人の支払義務と資金繰りを確認する", "PWA /admin/finance", "admin", .pending, [.adminLedger], nil),
        .adminPayouts: descriptor(.adminPayouts, "支払", "管理", "報酬確認・支払通知・入金確認を扱う", "PWA /admin/payouts + payout notices", "admin", .shell, [.adminLedger], "PDF生成と送付はEdge/GAS契約へ委譲"),
        .adminContracts: descriptor(.adminContracts, "契約", "管理", "1契約1行で契約条件と根拠を確認する", "PWA /admin/contracts + contracts-ledger", "admin", .pending, [.adminLedger], nil),
        .adminMembers: descriptor(.adminMembers, "メンバー", "管理", "メンバー・権限・支払通知書対象を管理する", "PWA /admin/members + members", "admin", .pending, [.adminLedger], nil),
        .adminGovernance: descriptor(.adminGovernance, "会社概要・ガバナンス", "管理", "会社概要、持分、資本政策、総会記録を確認する", "PWA /admin/governance + project company overview", "認証済みAMDメンバー", .shell, [.adminLedger], "全メンバー編集可の契約を維持する"),
        .adminPrivateWiki: descriptor(.adminPrivateWiki, "裏wiki", "管理", "人物文脈をadmin-onlyで保存・検索する", "PWA /admin/private-wiki + private_wiki_entries", "admin", .pending, [.adminLedger], "個人情報はこの面から外へ複製しない"),
        .adminManagementKnowledge: descriptor(.adminManagementKnowledge, "経営ノウハウ", "管理", "PJ横断で再利用できる経営知を判断カードとして管理する", "PWA /admin/management-knowledge", "admin", .pending, [.adminLedger], nil),
        .adminSchedule: descriptor(.adminSchedule, "運営カレンダー", "管理", "正本から生成された年間締切を確認する", "PWA /admin/schedule", "admin", .pending, [], "画面から予定を直接追加・編集しない"),
        .adminMsOverview: descriptor(.adminMsOverview, "MS一覧", "管理", "MS設計と担当shareを保存前検算つきで管理する", "PWA /admin/ms-overview", "admin", .pending, [.milestoneProgress], nil),
        .adminSeasonPl: descriptor(.adminSeasonPl, "シーズン予実", "管理", "シーズンの請求・原資・支払・未払を検算する", "PWA /admin/season-pl", "admin", .pending, [], nil),
        .adminWeekly: descriptor(.adminWeekly, "週次活動", "管理", "週次活動と月次報酬を横断確認する", "PWA /admin/weekly", "admin", .pending, [], nil),
        .hud: descriptor(.hud, "HUD", "設定", "Management Score・System Status・PJ信号を投影用に読む", "PWA /hud/* + ios CockpitHUDView", "認証済みAMDメンバー", .shell, [], "表示専用。計器を常時回転させない"),
        .manual: descriptor(.manual, "マニュアル", "設定", "OSの使い方と運用手順を読む", "PWA /manual", "認証済みAMDメンバー", .shell, [], nil),
        .spec: descriptor(.spec, "設計書", "設定", "確定実装仕様を読む", "PWA /spec", "admin", .pending, [], nil),
        .bzm: descriptor(.bzm, "教科書", "設定", "Before Zeroの理論と章を読む", "PWA /bzm + bundled BZM", "認証済みAMDメンバー", .shell, [], "読み取り専用"),
        .account: descriptor(.account, "アカウント", "設定", "認証状態とセッションを管理する", "Supabase Auth / Google OAuth", "本人", .implemented, [], nil)
    ]

    static func descriptor(_ id: AMDOSScreenID, _ title: String, _ eyebrow: String, _ purpose: String, _ source: String, _ authority: String, _ status: AMDOSParityStatus, _ writes: [AMDOSSafeWrite], _ note: String?) -> AMDOSScreenDescriptor {
        AMDOSScreenDescriptor(id: id, title: title, eyebrow: eyebrow, purpose: purpose, source: source, authority: authority, readStatus: status, writeTargets: writes, note: note)
    }

    static func descriptor(for id: AMDOSScreenID) -> AMDOSScreenDescriptor {
        descriptors[id]!
    }

    static func navigation(for area: AMDOSArea, isAdmin: Bool) -> [AMDOSScreenID] {
        switch area {
        case .work: return [.today, .projects, .notifications, .reimbursements, .businessCards, .monthlyAgreement]
        case .explore: return [.atlas, .materials, .seeds, .poc, .vcs, .scholar, .institutions, .amdScore]
        case .admin: return isAdmin ? [.adminHome, .adminInvoices, .adminFinance, .adminPayouts, .adminContracts, .adminMembers, .adminGovernance, .adminPrivateWiki, .adminManagementKnowledge, .adminSchedule, .adminMsOverview, .adminSeasonPl, .adminWeekly] : []
        case .settings: return [.hud, .manual, .spec, .bzm, .account]
        }
    }
}
