import Foundation

/// 画面の識別子と、Macでのナビゲーション順だけを持つ。
/// データ境界の追跡は開発用ドキュメントに置き、画面へ渡さない。
enum AMDOSParityCatalog {
    static func userTitle(for id: AMDOSScreenID) -> String {
        switch id {
        case .today: return "今日"
        case .projects: return "プロジェクト"
        case .projectDetail: return "プロジェクト詳細"
        case .notifications: return "お知らせ"
        case .reimbursements: return "立替"
        case .businessCards: return "名刺"
        case .monthlyAgreement: return "月初の確認"
        case .atlas: return "Atlas"
        case .materials: return "材料"
        case .seeds: return "研究シーズ"
        case .poc: return "PoC候補"
        case .vcs: return "投資候補"
        case .scholar: return "研究動向"
        case .institutions: return "研究機関"
        case .amdScore: return "プロジェクトの見立て"
        case .adminHome: return "管理ホーム"
        case .adminInvoices: return "請求書"
        case .adminFinance: return "財務"
        case .adminPayouts: return "支払"
        case .adminContracts: return "契約"
        case .adminMembers: return "メンバー"
        case .adminGovernance: return "会社情報"
        case .adminPrivateWiki: return "人物メモ"
        case .adminManagementKnowledge: return "経営ノウハウ"
        case .adminSchedule: return "運営カレンダー"
        case .adminMsOverview: return "マイルストーン"
        case .adminSeasonPl: return "シーズン予実"
        case .adminWeekly: return "週次活動"
        case .hud: return "状況モニター"
        case .manual: return "使い方"
        case .spec: return "設計書"
        case .bzm: return "教科書"
        case .account: return "アカウント"
        }
    }

    static func areaLabel(_ area: AMDOSArea) -> String {
        switch area {
        case .work: return "仕事のメニュー"
        case .explore: return "探索のメニュー"
        case .admin: return "管理のメニュー"
        case .settings: return "設定のメニュー"
        }
    }

    static func navigation(for area: AMDOSArea, isAdmin: Bool) -> [AMDOSScreenID] {
        switch area {
        case .work: return [.today, .projects, .notifications, .reimbursements, .businessCards, .monthlyAgreement]
        case .explore: return [.atlas, .materials, .seeds, .poc, .vcs, .scholar, .institutions, .amdScore]
        case .admin:
            return isAdmin ? [.adminHome, .adminInvoices, .adminFinance, .adminPayouts, .adminContracts, .adminMembers, .adminGovernance, .adminPrivateWiki, .adminManagementKnowledge, .adminSchedule, .adminMsOverview, .adminSeasonPl, .adminWeekly] : []
        case .settings: return [.hud, .manual, .spec, .bzm, .account]
        }
    }
}
