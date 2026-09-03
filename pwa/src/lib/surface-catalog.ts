export type SurfaceStatus = "canonical" | "projection" | "transitional" | "mirror" | "deprecated";
export type SurfaceLens =
  | "amd_portfolio"
  | "amd_internal_project"
  | "amd_operations"
  | "shared_project"
  | "external_workspace"
  | "knowledge"
  | "exploration";
export type SurfaceDomain =
  | "portfolio"
  | "project_execution"
  | "organization_access"
  | "decision_review"
  | "knowledge_documents"
  | "company_operations"
  | "finance_contracts"
  | "platform";

export type SurfaceDefinition = {
  id: string;
  title: string;
  navLabel?: string;
  primaryPath?: string;
  domain: SurfaceDomain;
  lens: SurfaceLens;
  status: SurfaceStatus;
  exact?: readonly string[];
  prefixes?: readonly string[];
  patterns?: readonly RegExp[];
};

/**
 * User-facing surface registry.
 * Order is significant: specific routes must precede their broader parent prefixes.
 * A route may be a separate lens, but it must not imply a separate data writer.
 */
export const SURFACE_CATALOG: readonly SurfaceDefinition[] = [
  { id: "portfolio-home", title: "ダッシュボード", navLabel: "ホーム", primaryPath: "/dashboard", domain: "portfolio", lens: "amd_portfolio", status: "canonical", exact: ["/dashboard"] },
  { id: "institutions-detail", title: "研究機関 ECR 詳細", domain: "portfolio", lens: "amd_portfolio", status: "canonical", prefixes: ["/institutions/"] },
  { id: "institutions", title: "研究機関 ECR", navLabel: "研究機関", primaryPath: "/institutions", domain: "portfolio", lens: "amd_portfolio", status: "canonical", exact: ["/institutions"] },
  { id: "seeds-sensitivity", title: "入力を動かして見る", domain: "portfolio", lens: "amd_portfolio", status: "canonical", exact: ["/seeds/sensitivity"] },
  { id: "seeds", title: "Seeds", navLabel: "シーズ", primaryPath: "/seeds", domain: "portfolio", lens: "amd_portfolio", status: "canonical", exact: ["/seeds"] },
  { id: "shared-project-files", title: "PJ 資料室", domain: "knowledge_documents", lens: "shared_project", status: "canonical", patterns: [/^\/project\/[^/]+\/workspace\/files\/?$/] },
  { id: "shared-project", title: "PJ ワークスペース", domain: "project_execution", lens: "shared_project", status: "canonical", patterns: [/^\/project\/[^/]+\/workspace\/?$/] },
  { id: "weekly-control", title: "PJ ワークスペース", domain: "project_execution", lens: "shared_project", status: "deprecated", patterns: [/^\/project\/[^/]+\/weekly-control\/?$/] },
  { id: "project-navigation", title: "PJ管制ダッシュボード", domain: "project_execution", lens: "amd_internal_project", status: "transitional", patterns: [/^\/project\/[^/]+\/navigation\/?$/] },
  { id: "project-cockpit", title: "PJ コックピット", domain: "project_execution", lens: "amd_internal_project", status: "canonical", prefixes: ["/project/", "/projects/"] },
  { id: "my-projects", title: "参加PJ", primaryPath: "/my-projects", domain: "project_execution", lens: "amd_internal_project", status: "projection", exact: ["/my-projects"] },
  { id: "external-workspaces", title: "ワークスペース", primaryPath: "/workspaces", domain: "organization_access", lens: "external_workspace", status: "canonical", exact: ["/workspaces"] },
  { id: "institution-workspace", title: "研究機関ワークスペース", domain: "organization_access", lens: "external_workspace", status: "canonical", prefixes: ["/workspace/"] },
  { id: "login", title: "ログイン", domain: "organization_access", lens: "external_workspace", status: "canonical", prefixes: ["/auth/login"] },
  { id: "notifications", title: "通知", navLabel: "通知", primaryPath: "/notifications", domain: "decision_review", lens: "amd_operations", status: "transitional", exact: ["/notifications"] },
  { id: "proactive", title: "先手TODO", primaryPath: "/proactive", domain: "decision_review", lens: "amd_operations", status: "transitional", exact: ["/proactive"] },
  { id: "atlas-map", title: "Atlas Map", domain: "knowledge_documents", lens: "knowledge", status: "projection", prefixes: ["/atlas/map"] },
  { id: "atlas-inbox-submit", title: "Atlas Inbox 投稿", domain: "decision_review", lens: "knowledge", status: "projection", prefixes: ["/atlas/inbox/submit"] },
  { id: "atlas-inbox", title: "Atlas Inbox", domain: "decision_review", lens: "knowledge", status: "projection", prefixes: ["/atlas/inbox"] },
  { id: "atlas-divergence", title: "Atlas Divergence", domain: "knowledge_documents", lens: "knowledge", status: "projection", prefixes: ["/atlas/divergence"] },
  { id: "atlas-decisions", title: "Atlas Decisions", domain: "decision_review", lens: "knowledge", status: "projection", prefixes: ["/atlas/decisions"] },
  { id: "atlas-admin", title: "Atlas Admin", domain: "knowledge_documents", lens: "amd_operations", status: "projection", prefixes: ["/atlas/admin"] },
  { id: "atlas", title: "Atlas", primaryPath: "/atlas", domain: "knowledge_documents", lens: "knowledge", status: "canonical", exact: ["/atlas"] },
  { id: "knowledge-map", title: "AMD Materials", primaryPath: "/knowledge-map", domain: "knowledge_documents", lens: "knowledge", status: "canonical", prefixes: ["/knowledge-map"] },
  { id: "bzm-map", title: "BZM 理論マップ", domain: "knowledge_documents", lens: "knowledge", status: "canonical", exact: ["/bzm/map"] },
  { id: "bzm", title: "BZM 2.0", primaryPath: "/bzm", domain: "knowledge_documents", lens: "knowledge", status: "canonical", prefixes: ["/bzm"] },
  { id: "model", title: "モデル", primaryPath: "/model", domain: "platform", lens: "knowledge", status: "canonical", prefixes: ["/model"] },
  { id: "spec", title: "設計書", primaryPath: "/spec", domain: "platform", lens: "knowledge", status: "canonical", prefixes: ["/spec"] },
  { id: "manual", title: "マニュアル", primaryPath: "/manual", domain: "platform", lens: "knowledge", status: "canonical", prefixes: ["/manual"] },
  { id: "business-cards", title: "名刺", primaryPath: "/business-cards", domain: "knowledge_documents", lens: "amd_operations", status: "canonical", prefixes: ["/business-cards", "/native/business-cards"] },
  { id: "scholar", title: "Scholar", primaryPath: "/scholar", domain: "knowledge_documents", lens: "exploration", status: "canonical", exact: ["/scholar"] },
  { id: "current-sps", title: "現行SPS", domain: "portfolio", lens: "exploration", status: "canonical", prefixes: ["/venture-map/amd-score"] },
  { id: "venture-timeline", title: "Venture Timeline 3D", domain: "portfolio", lens: "exploration", status: "mirror", prefixes: ["/venture-map/timeline-3d"] },
  { id: "venture-oscillator", title: "Venture Oscillator", domain: "portfolio", lens: "exploration", status: "mirror", prefixes: ["/venture-map/oscillator"] },
  { id: "venture-state-space", title: "Venture State Space", domain: "portfolio", lens: "exploration", status: "mirror", prefixes: ["/venture-map/state-space"] },
  { id: "venture-su-detail", title: "SU Detail", domain: "portfolio", lens: "exploration", status: "projection", prefixes: ["/venture-map/su/"] },
  { id: "venture-map", title: "Venture Map", primaryPath: "/venture-map", domain: "portfolio", lens: "exploration", status: "canonical", exact: ["/venture-map"] },
  { id: "poc", title: "PoC案件化", primaryPath: "/poc", domain: "portfolio", lens: "exploration", status: "canonical", exact: ["/poc"] },
  { id: "vcs", title: "VC", primaryPath: "/vcs", domain: "portfolio", lens: "exploration", status: "canonical", exact: ["/vcs"] },
  { id: "mypage", title: "マイページ", primaryPath: "/mypage", domain: "company_operations", lens: "amd_operations", status: "canonical", exact: ["/mypage"] },
  { id: "monthly-agreement", title: "月初合意", primaryPath: "/monthly-agreement", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/monthly-agreement"] },
  { id: "company", title: "Company", primaryPath: "/company", domain: "company_operations", lens: "amd_operations", status: "canonical", exact: ["/company"] },
  { id: "contracts-member", title: "契約", primaryPath: "/contracts", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/contracts"] },
  { id: "reimburse", title: "立替", primaryPath: "/reimburse", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/reimburse"] },
  { id: "management-score", title: "Management Score", navLabel: "経営指標", primaryPath: "/management-score", domain: "company_operations", lens: "amd_operations", status: "canonical", prefixes: ["/management-score"] },

  { id: "admin-projects", title: "Admin PJ", navLabel: "PJ台帳", primaryPath: "/admin/projects", domain: "project_execution", lens: "amd_operations", status: "canonical", exact: ["/admin/projects"] },
  { id: "admin-members", title: "Admin メンバー", navLabel: "メンバー", primaryPath: "/admin/members", domain: "organization_access", lens: "amd_operations", status: "canonical", exact: ["/admin/members"] },
  { id: "admin-access", title: "Admin 外部アクセス", navLabel: "外部アクセス", primaryPath: "/admin/access", domain: "organization_access", lens: "amd_operations", status: "canonical", exact: ["/admin/access"] },
  { id: "admin-company", title: "Admin Company", navLabel: "会社情報", primaryPath: "/admin/company", domain: "company_operations", lens: "amd_operations", status: "canonical", exact: ["/admin/company"] },
  { id: "admin-governance", title: "株主・ガバナンス", navLabel: "株主・ガバナンス", primaryPath: "/admin/governance", domain: "company_operations", lens: "amd_operations", status: "canonical", exact: ["/admin/governance"] },
  { id: "admin-contracts", title: "Admin 契約", navLabel: "契約", primaryPath: "/admin/contracts", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/admin/contracts"] },
  { id: "admin-kiyo", title: "きよ", navLabel: "きよ", primaryPath: "/admin/kiyo", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/admin/kiyo"] },
  { id: "admin-invoices", title: "請求書発行", navLabel: "請求書発行", primaryPath: "/admin/invoices", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/admin/invoices"] },
  { id: "admin-billing", title: "請求書発行", navLabel: "旧請求入口", primaryPath: "/admin/billing", domain: "finance_contracts", lens: "amd_operations", status: "mirror", exact: ["/admin/billing"] },
  { id: "admin-payouts", title: "支払通知書", navLabel: "支払通知書", primaryPath: "/admin/payouts", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/admin/payouts"] },
  { id: "admin-monthly-agreements", title: "Admin 月初合意", navLabel: "月初合意", primaryPath: "/admin/monthly-work-agreements", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/admin/monthly-work-agreements"] },
  { id: "admin-season-pl", title: "シーズン予実", navLabel: "シーズン予実", primaryPath: "/admin/season-pl", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/admin/season-pl"] },
  { id: "admin-finance", title: "Admin Finance", navLabel: "財務", primaryPath: "/admin/finance", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/admin/finance"] },
  { id: "admin-project-profitability", title: "PJ別 利益構造", navLabel: "PJ別利益構造", primaryPath: "/admin/project-profitability", domain: "finance_contracts", lens: "amd_operations", status: "canonical", exact: ["/admin/project-profitability"] },
  { id: "admin-weekly", title: "週次活動", navLabel: "週次活動", primaryPath: "/admin/weekly", domain: "project_execution", lens: "amd_operations", status: "projection", exact: ["/admin/weekly"] },
  { id: "admin-protocols", title: "AMD Protocol", navLabel: "AMD Protocol", primaryPath: "/admin/protocols", domain: "decision_review", lens: "amd_operations", status: "canonical", exact: ["/admin/protocols"] },
  { id: "admin-ms-overview", title: "MS一覧", navLabel: "MS一覧", primaryPath: "/admin/ms-overview", domain: "project_execution", lens: "amd_operations", status: "projection", exact: ["/admin/ms-overview"] },
  { id: "admin-meeting-gaps", title: "議事録の抜け", navLabel: "議事録の抜け", primaryPath: "/admin/meeting-gaps", domain: "project_execution", lens: "amd_operations", status: "canonical", exact: ["/admin/meeting-gaps"] },
  { id: "admin-coverage", title: "Coverage Scanner", navLabel: "未充足データ", primaryPath: "/admin/coverage-gaps", domain: "project_execution", lens: "amd_operations", status: "projection", exact: ["/admin/coverage-gaps"] },
  { id: "admin-ip", title: "知財・IP", navLabel: "知財・IP", primaryPath: "/admin/ip", domain: "project_execution", lens: "amd_operations", status: "canonical", exact: ["/admin/ip"] },
  { id: "admin-japanese-culture", title: "日本文化マップ", navLabel: "日本文化", primaryPath: "/admin/japanese-culture-map", domain: "knowledge_documents", lens: "amd_operations", status: "canonical", exact: ["/admin/japanese-culture-map"] },
  { id: "admin-contexts", title: "Admin Contexts", navLabel: "LLM文脈", primaryPath: "/admin/contexts", domain: "knowledge_documents", lens: "amd_operations", status: "canonical", exact: ["/admin/contexts"] },
  { id: "admin-management-knowledge", title: "経営ノウハウ", navLabel: "経営ノウハウ", primaryPath: "/admin/management-knowledge", domain: "knowledge_documents", lens: "amd_operations", status: "canonical", exact: ["/admin/management-knowledge"] },
  { id: "admin-private-wiki", title: "裏wiki", navLabel: "非公開wiki", primaryPath: "/admin/private-wiki", domain: "knowledge_documents", lens: "amd_operations", status: "canonical", exact: ["/admin/private-wiki"] },
  { id: "admin-tsukuyomi", title: "Admin つくよみ", navLabel: "つくよみ", primaryPath: "/admin/tsukuyomi", domain: "knowledge_documents", lens: "amd_operations", status: "canonical", exact: ["/admin/tsukuyomi"] },
  { id: "admin-prompts", title: "LLM プロンプト", navLabel: "LLMプロンプト", primaryPath: "/admin/prompts", domain: "knowledge_documents", lens: "amd_operations", status: "canonical", exact: ["/admin/prompts"] },
  { id: "admin-payments", title: "納付", navLabel: "納付", primaryPath: "/admin/payments", domain: "company_operations", lens: "amd_operations", status: "canonical", exact: ["/admin/payments"] },
  { id: "admin-schedule", title: "管理カレンダー", navLabel: "管理カレンダー", primaryPath: "/admin/schedule", domain: "company_operations", lens: "amd_operations", status: "canonical", exact: ["/admin/schedule"] },
  { id: "admin-settings", title: "Admin 設定", navLabel: "設定", primaryPath: "/admin/settings", domain: "platform", lens: "amd_operations", status: "canonical", exact: ["/admin/settings"] },
  { id: "admin-fallback", title: "Admin", domain: "company_operations", lens: "amd_operations", status: "transitional", prefixes: ["/admin"] },

  { id: "dashboard-cyber-lab", title: "ダッシュボード実験", domain: "portfolio", lens: "amd_portfolio", status: "mirror", prefixes: ["/dashboard-cyber-3d-lab", "/dashboard-cyber-glass-cube", "/dashboard-cyber-hud-wall"] },
  { id: "hud", title: "HUD", domain: "portfolio", lens: "amd_portfolio", status: "mirror", prefixes: ["/hud"] },
] as const;

export const ADMIN_SURFACE_GROUPS = [
  { label: "納税・カレンダー", surfaceIds: ["admin-payments", "admin-schedule"] },
  { label: "組織・権限", surfaceIds: ["admin-projects", "admin-members", "admin-access", "admin-company", "admin-governance"] },
  { label: "契約・お金", surfaceIds: ["admin-contracts", "admin-kiyo", "admin-invoices", "admin-payouts", "admin-monthly-agreements", "admin-season-pl", "admin-finance", "admin-project-profitability"] },
  { label: "PJ・実行", surfaceIds: ["management-score", "admin-weekly", "admin-protocols", "admin-ms-overview", "admin-meeting-gaps", "admin-coverage", "admin-ip"] },
  { label: "知識・AI", surfaceIds: ["admin-japanese-culture", "admin-contexts", "admin-management-knowledge", "admin-private-wiki", "admin-tsukuyomi", "admin-prompts"] },
  { label: "運用", surfaceIds: ["admin-settings"] },
] as const;

const surfaceById = new Map(SURFACE_CATALOG.map((surface) => [surface.id, surface]));

function surfaceMatchesPath(surface: SurfaceDefinition, pathname: string) {
  if (surface.exact?.includes(pathname)) return true;
  if (surface.prefixes?.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return true;
  return surface.patterns?.some((pattern) => pattern.test(pathname)) ?? false;
}

export function getSurfaceByPath(pathname: string): SurfaceDefinition | null {
  if (!pathname || pathname === "/") return null;
  return SURFACE_CATALOG.find((surface) => surfaceMatchesPath(surface, pathname)) ?? null;
}

export function surfaceTitleForPath(pathname: string): string | null {
  return getSurfaceByPath(pathname)?.title ?? null;
}

export function getSurfaceById(id: string): SurfaceDefinition | null {
  return surfaceById.get(id) ?? null;
}
