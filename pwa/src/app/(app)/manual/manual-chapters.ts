export interface ManualSectionConfig {
  key: string;
  label: string;
  description: string;
  slugs: string[];
}

export type ManualTopicIcon =
  | "book"
  | "dashboard"
  | "calendar"
  | "brain"
  | "search"
  | "database"
  | "settings"
  | "code";

export type ManualTopicColor =
  | "blue"
  | "cyan"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "teal"
  | "slate"
  | "indigo";

export interface ManualTopicNodeConfig {
  key: string;
  label: string;
  description: string;
  icon: ManualTopicIcon;
  color: ManualTopicColor;
  chapterSlugs: string[];
  relatedTopicKeys: string[];
}

/**
 * 章メタデータ。
 *
 * **slug 自体が section-chapter 番号を含む** (= 2026-05-27 まさ確定で
 * `audience` 概念を廃止し、ファイル名と章番号を一致させる方針に refactor)。
 * 例: `7-1-reward-calc-spec` → section 7 の 1 番目 → 章番号 "7-1"。
 *
 * `applyManualBookNumbering()` は MANUAL_SECTIONS の順序通りに番号を振るだけ。
 * audience filter なし、全章を全 user に見せる。
 */
export interface ManualChapterConfig {
  slug: string;
  title: string;
  summary: string;
  topics: string[];
  screens?: string[];
  tables?: string[];
}

/**
 * `applyManualBookNumbering()` の戻り値。 `number` は section-chapter 形式 (= "7-1" など)。
 * UI 表示はすべてこれを使う。
 */
export interface ManualNumberedChapter extends ManualChapterConfig {
  number: string;
}

export const MANUAL_SECTIONS: ManualSectionConfig[] = [
  {
    key: "entry",
    label: "入口",
    description: "AMD OS の目的、想定ユーザー、読み方。",
    slugs: ["1-1-intro"],
  },
  {
    key: "usage",
    label: "まず使う人向け",
    description: "画面の見方、日常業務、月次運用をざっくり掴む章。",
    slugs: [
      "2-1-member-quick-start",
      "2-2-member-workflows-quick-start",
      "2-3-pj-cockpit",
      "2-4-amd-cockpit",
      "2-5-research-assets-quick-start",
      "2-6-admin-ops",
      "2-7-task-management",
    ],
  },
  {
    key: "architecture",
    label: "OS の基本構造",
    description: "画面、データ、L2、通知、正本反映ゲートの地図。",
    slugs: [
      "3-1-system-architecture",
      "3-2-data-and-extraction",
      "3-3-notifications-and-tsukuyomi",
    ],
  },
  {
    key: "decision",
    label: "経営判断エンジン",
    description: "Atlas、AMD Protocol、AMD Score、XRL、Management Score、卒業検出など判断ロジックの章。",
    slugs: [
      "4-1-atlas-protocol-score-macrotrend",
      "4-2-atlas-macrotrend-signal-spec",
      "4-3-amd-score-spec",
      "4-4-frl-related-members-score-spec",
      "4-5-management-score-and-finance-simulation-spec",
      "4-6-graduation-detection-spec",
      "4-7-venture-status-narrative-pl-xrl-spec",
      "4-8-ms-progress-monthly-report-revision-spec",
      "4-9-institution-ers-spec",
    ],
  },
  {
    key: "assets",
    label: "外部探索・事業アセット",
    description: "Seeds、VC、Scholar、Venture Map、HUD など外部探索と事業化アセットの章。",
    slugs: [
      "5-1-research-assets-vc-seeds-scholar-spec",
      "5-2-hud-and-venture-map-spec",
    ],
  },
  {
    key: "admin-finance",
    label: "Admin / Finance / 月次オペ",
    description: "設定、台帳、請求、入金確認、支払通知書、メンバー向け月次運用の仕様。",
    slugs: [
      "6-1-operations-settings-spec",
      "6-2-admin-projects-members-ledger-spec",
      "6-3-invoice-and-billing-routine-spec",
      "6-4-finance-payment-confirm-spec",
      "6-5-admin-payouts-reward-notice-spec",
      "6-6-member-billing-prompts-spec",
      "6-7-contracts-management-spec",
    ],
  },
  {
    key: "reward-contract",
    label: "報酬・契約",
    description: "メンバー報酬がどう決まるか (= 計算ロジック正本)。",
    slugs: [
      "7-1-reward-calc-spec",
    ],
  },
  {
    key: "knowledge-automation",
    label: "Knowledge / Automation",
    description: "Knowledge Admin、つくよみ、通知レビュー、経営ハイライト、L2 抽出 routine の仕様。",
    slugs: [
      "8-1-knowledge-admin-tsukuyomi-spec",
      "8-2-notification-review-and-strategy-signals-spec",
      "8-3-l2-extraction-routines-spec",
    ],
  },
  {
    key: "developer-history",
    label: "開発者・履歴",
    description: "開発手順、過去判断、事故ログ、設計 md の読み方。",
    slugs: [
      "9-1-decisions-and-history",
      "9-2-developer",
      "9-3-appendix-changelog",
    ],
  },
];

export const MANUAL_CHAPTERS: ManualChapterConfig[] = [
  { slug: "1-1-intro", title: "AMD OS とは", summary: "OS の目的、想定ユーザー、5 生データ、M/W/D/H L2、読み方ガイド。", topics: ["start", "system"], screens: ["/manual"], tables: ["M/W/D/H L2"] },

  { slug: "2-1-member-quick-start", title: "はじめて使う人向け", summary: "最初に見る画面と、ざっくりした使い方。", topics: ["start", "cockpit"], screens: ["/dashboard", "/project/{projectId}/cockpit", "/mypage"] },
  { slug: "2-2-member-workflows-quick-start", title: "メンバーの日常ワークフロー", summary: "マイページ、立替、週次活動、月次 TODO の日常導線。", topics: ["start", "monthly"], screens: ["/mypage", "/reimburse"] },
  { slug: "2-3-pj-cockpit", title: "PJ コックピットの見方", summary: "PJ Status、MS 進捗、経営ハイライト、月次ルーティンの読み方。", topics: ["cockpit", "decision", "monthly"], screens: ["/project/{projectId}/cockpit"] },
  { slug: "2-4-amd-cockpit", title: "AMD 全体コックピットの見方", summary: "p00、Management Score、提案前の論点整理の使い方。", topics: ["start", "decision"], screens: ["/project/p00/cockpit"] },
  { slug: "2-5-research-assets-quick-start", title: "探索系アセットの使い方", summary: "Atlas、Seeds、VC、Scholar をまず触るための入口。", topics: ["discovery", "start"], screens: ["/atlas", "/seeds", "/vcs", "/scholar"] },
  { slug: "2-6-admin-ops", title: "月次ルーティン早見表", summary: "支払、請求、立替、報告書、入金確認の締切と流れ。", topics: ["monthly", "admin"], screens: ["/admin/billing", "/admin/payouts"] },
  { slug: "2-7-task-management", title: "タスク管理", summary: "全PJ・全員のタスクをマインドマップ / ガントで見る。空白クリック作成、drag/drop親子edge、期間バーの使い方。", topics: ["start", "cockpit", "system"], screens: ["/tasks"], tables: ["tasks", "projects", "project_members", "members"] },

  { slug: "3-1-system-architecture", title: "全体設計", summary: "画面、データ、書き込み経路、設計 md 索引まで含む OS の地図。", topics: ["system-dev", "developer"], screens: ["/manual"], tables: ["projects", "members", "billing_cycles"] },
  { slug: "3-2-data-and-extraction", title: "データと抽出", summary: "5 生データ、M/W/D/H L2、抽出 pipeline、復旧状況の開発者向け正本。", topics: ["system-dev", "knowledge-dev"], tables: ["source_cache", "project_meeting_summaries", "project_strategy_signals"] },
  { slug: "3-3-notifications-and-tsukuyomi", title: "通知・修正依頼・正本反映ゲート", summary: "通知、つくよみ、ユーザー確認、正本反映の考え方。", topics: ["knowledge", "system"], screens: ["/notifications"], tables: ["l2_notifications", "l2_feedbacks"] },

  { slug: "4-1-atlas-protocol-score-macrotrend", title: "判断エンジン overview", summary: "Atlas、AMD Protocol、AMD Score、Macrotrend の関係。", topics: ["decision", "discovery"], screens: ["/atlas", "/venture-map/amd-score"] },
  { slug: "4-2-atlas-macrotrend-signal-spec", title: "Atlas / Macrotrend 詳細仕様", summary: "signal、story、theme、divergence の詳細。", topics: ["decision", "discovery", "system-dev"], screens: ["/atlas", "/atlas/macrotrends"], tables: ["atlas_signals", "atlas_stories", "atlas_themes"] },
  { slug: "4-3-amd-score-spec", title: "AMD Score 詳細仕様", summary: "PRS primary、legacy AMD comparison、算出式、未来予測修正 loop。", topics: ["decision", "cockpit"], screens: ["/venture-map/amd-score", "/project/{projectId}/cockpit"], tables: ["amd_score_inputs", "amd_score_alpha"] },
  { slug: "4-4-frl-related-members-score-spec", title: "FRL / HRL / 関連メンバー詳細仕様", summary: "Founding Readiness、関連メンバー、HRL、Grit / Resilience。", topics: ["decision", "cockpit", "system-dev"], tables: ["project_founding_members", "project_venture_members"] },
  { slug: "4-5-management-score-and-finance-simulation-spec", title: "AMD Management Score (= バイタルサイン) / Finance Simulation", summary: "会社全体の経営スコア、不可逆閾値、死亡判定、戦略接近度 6 入力、GAS 月次試算表移植。", topics: ["decision", "admin-dev", "cockpit"], screens: ["/management-score", "/project/p00/cockpit"], tables: ["amd_management_score_*", "company_budget_actual_monthly"] },
  { slug: "4-6-graduation-detection-spec", title: "卒業フェーズ検出", summary: "AMD 主導の卒業提案。 6 シグナル × 月次集計 → まさえいMTG 議題。 reputation flywheel。", topics: ["decision", "cockpit", "system-dev"], screens: ["/management-score", "/project/{projectId}/cockpit"], tables: ["project_graduation_signals", "project_ventures", "project_strategy_signals"] },
  { slug: "4-7-venture-status-narrative-pl-xrl-spec", title: "Venture Status / Narrative / PL / XRL", summary: "SU の事業概要、沿革、PL hearing、XRL 修正導線。", topics: ["decision", "cockpit", "system-dev"], screens: ["/project/{projectId}/cockpit"], tables: ["project_ventures", "project_xrl_log"] },
  { slug: "4-8-ms-progress-monthly-report-revision-spec", title: "MS Progress / Monthly Report / Revision Loop", summary: "MS 進捗、月次報告書、月次ノート、つくよみ修正依頼 loop。", topics: ["cockpit", "monthly", "system-dev"], screens: ["/project/{projectId}/cockpit"], tables: ["milestone_monthly_progress", "ms_progress_revisions"] },
  { slug: "4-9-institution-ers-spec", title: "研究機関 ERS (機関エコシステム整備度)", summary: "苗床レイヤー指標。8 軸 × サブ軸 Lv1-5 の加重和 (充足率)。AMD Score PRS primary (個体) とは別ロジックで σ_SU 経由で概念連動。二重計上しない。", topics: ["decision", "discovery", "system-dev"], screens: ["/institutions", "/institutions/{institutionId}", "/dashboard"], tables: ["institutions", "institution_assessments"] },

  { slug: "5-1-research-assets-vc-seeds-scholar-spec", title: "Seeds / VC / Scholar 詳細仕様", summary: "研究シーズ、VC、Scholar の DB、inbox、cron route。", topics: ["discovery", "admin-dev"], screens: ["/seeds", "/vcs", "/scholar"], tables: ["seeds", "vcs", "papers_log"] },
  { slug: "5-2-hud-and-venture-map-spec", title: "HUD / Venture Map 仕様", summary: "HUD mirror、Venture Map、実験ビュー、ルート一覧。", topics: ["discovery", "system-dev"], screens: ["/hud", "/venture-map"] },

  { slug: "6-1-operations-settings-spec", title: "Operations Settings", summary: "Raw Data、L2 Data、Cron Control、運用設定画面。", topics: ["admin-dev", "system-dev"], screens: ["/admin/settings"] },
  { slug: "6-2-admin-projects-members-ledger-spec", title: "Admin Projects / Members 台帳", summary: "PJ 台帳、AMD メンバー台帳、契約・請求・支払条件。", topics: ["admin-dev", "monthly"], screens: ["/admin/projects", "/admin/members"], tables: ["projects", "members", "project_members"] },
  { slug: "6-3-invoice-and-billing-routine-spec", title: "Invoice / Billing Routine", summary: "請求書、見積書、freee 発行、請求・月次ルーティン仕様。", topics: ["monthly", "admin-dev"], screens: ["/admin/billing"], tables: ["billing_cycles", "billing_log"] },
  { slug: "6-4-finance-payment-confirm-spec", title: "Finance / Payment Confirm", summary: "admin finance、入金確認 nudge、signed token、freee 同期。", topics: ["monthly", "admin-dev"], screens: ["/admin/finance", "/payment-confirm"], tables: ["company_finance_*", "billing_cycles"] },
  { slug: "6-5-admin-payouts-reward-notice-spec", title: "Admin Payouts / 支払通知書", summary: "報酬キャッシュ、MSなしPJ手入力報酬、支払通知書 PDF、支払月判定。", topics: ["monthly", "admin-dev"], screens: ["/admin/payouts"], tables: ["payout_notices", "billing_cycles"] },
  { slug: "6-6-member-billing-prompts-spec", title: "Member Ops / Billing / Prompt", summary: "mypage、reimburse、admin billing、prompt 管理の仕様。", topics: ["monthly", "admin-dev"], screens: ["/mypage", "/reimburse", "/admin/prompts"] },
  { slug: "6-7-contracts-management-spec", title: "契約管理", summary: "契約予定枠、version history、押印版metadata、予兆dry-run、Slack nudge dry-run。", topics: ["admin-dev", "monthly"], screens: ["/admin/contracts"], tables: ["contracts", "contract_documents", "contract_signals", "contract_nudges"] },

  { slug: "7-1-reward-calc-spec", title: "報酬計算ロジック 詳細仕様", summary: "メンバー報酬がどう決まるか。 計算式、入力データ、進捗ソース優先度、月次キャップ、繰越制御の正本。", topics: ["monthly", "decision", "admin-dev"], screens: ["/mypage", "/admin/payouts"], tables: ["billing_cycles", "value_milestones", "value_plan_cycles", "milestone_monthly_progress", "milestone_responsibility", "sub_item_responsibility", "pj_deductions"] },

  { slug: "8-1-knowledge-admin-tsukuyomi-spec", title: "Knowledge Admin / Tsukuyomi", summary: "AMD Protocol、contexts、つくよみ学習、feedback API。", topics: ["knowledge-dev", "admin-dev"], screens: ["/admin/protocols", "/admin/contexts", "/admin/tsukuyomi"], tables: ["protocols", "tsukuyomi_context"] },
  { slug: "8-2-notification-review-and-strategy-signals-spec", title: "通知レビュー UI / 経営ハイライト確認", summary: "notifications 実 UI、経営ハイライト、修正依頼履歴。", topics: ["knowledge-dev", "decision", "cockpit"], screens: ["/notifications", "/project/{projectId}/cockpit"], tables: ["project_strategy_signals", "l2_feedbacks"] },
  { slug: "8-3-l2-extraction-routines-spec", title: "L2 Extraction Routines", summary: "M/W/D/H L2 の現行 writer、MMOマシン automation、outbox/applier、local BZM applier、課金ルート、復旧時に見る場所。", topics: ["knowledge-dev", "developer"], tables: ["monthly_reports", "milestone_monthly_progress", "project_knowledge", "member_knowledge", "protocols", "textbook_insight_candidates"] },

  { slug: "9-1-decisions-and-history", title: "過去判断と経緯", summary: "過去判断の読者向け入口。実装制約の正本は /spec/5-3 / 5-4 に移行済み。", topics: ["developer", "system-dev"] },
  { slug: "9-2-developer", title: "開発者向け", summary: "開発者が最初に読む /spec 章への入口。deploy / DDL / automation 詳細は /spec に移行済み。", topics: ["developer", "system-dev"] },
  { slug: "9-3-appendix-changelog", title: "附則（変更履歴）", summary: "マニュアル本則の追加・変更・削除をすべて日付付きで記録する append-only の変更履歴。勝手な削除を検知するための正本。", topics: ["developer", "system-dev"] },
];

export const MANUAL_TOPIC_NODES: ManualTopicNodeConfig[] = [
  {
    key: "start",
    label: "まず触る",
    description: "初めて開く人が、OS の目的と日常画面を掴む入口。",
    icon: "book",
    color: "blue",
    chapterSlugs: ["1-1-intro", "2-1-member-quick-start", "2-2-member-workflows-quick-start", "2-3-pj-cockpit", "2-4-amd-cockpit", "2-7-task-management"],
    relatedTopicKeys: ["cockpit", "monthly", "discovery"],
  },
  {
    key: "cockpit",
    label: "PJを見る",
    description: "PJ 状況、MS 進捗、経営ハイライト、XRL、卒業準備度を見ながら判断する。",
    icon: "dashboard",
    color: "cyan",
    chapterSlugs: ["2-3-pj-cockpit", "4-3-amd-score-spec", "4-8-ms-progress-monthly-report-revision-spec", "4-7-venture-status-narrative-pl-xrl-spec", "8-2-notification-review-and-strategy-signals-spec", "4-6-graduation-detection-spec"],
    relatedTopicKeys: ["decision", "monthly", "knowledge"],
  },
  {
    key: "monthly",
    label: "月次オペ",
    description: "月次 TODO、請求、入金確認、支払通知書、報酬の流れを追う。",
    icon: "calendar",
    color: "emerald",
    chapterSlugs: ["2-6-admin-ops", "2-2-member-workflows-quick-start", "6-3-invoice-and-billing-routine-spec", "6-4-finance-payment-confirm-spec", "6-5-admin-payouts-reward-notice-spec", "6-6-member-billing-prompts-spec", "6-7-contracts-management-spec", "7-1-reward-calc-spec"],
    relatedTopicKeys: ["admin", "cockpit", "system"],
  },
  {
    key: "decision",
    label: "経営判断",
    description: "外部 signal、AMD Protocol、AMD Score、XRL、Management Score、卒業検出をつなげる。",
    icon: "brain",
    color: "violet",
    chapterSlugs: ["4-1-atlas-protocol-score-macrotrend", "4-2-atlas-macrotrend-signal-spec", "4-3-amd-score-spec", "4-4-frl-related-members-score-spec", "4-5-management-score-and-finance-simulation-spec", "4-6-graduation-detection-spec", "4-7-venture-status-narrative-pl-xrl-spec", "4-9-institution-ers-spec", "8-2-notification-review-and-strategy-signals-spec"],
    relatedTopicKeys: ["discovery", "cockpit", "knowledge"],
  },
  {
    key: "discovery",
    label: "外部探索",
    description: "Atlas、Macrotrend、Seeds、VC、Scholar、Venture Map から事業機会を見る。",
    icon: "search",
    color: "amber",
    chapterSlugs: ["2-5-research-assets-quick-start", "4-2-atlas-macrotrend-signal-spec", "5-1-research-assets-vc-seeds-scholar-spec", "5-2-hud-and-venture-map-spec", "4-9-institution-ers-spec"],
    relatedTopicKeys: ["decision", "admin", "developer"],
  },
  {
    key: "knowledge",
    label: "知識・通知",
    description: "5 生データ、L2、通知、修正依頼、つくよみ学習の流れを見る。",
    icon: "database",
    color: "teal",
    chapterSlugs: ["3-2-data-and-extraction", "3-3-notifications-and-tsukuyomi", "8-1-knowledge-admin-tsukuyomi-spec", "8-2-notification-review-and-strategy-signals-spec", "8-3-l2-extraction-routines-spec"],
    relatedTopicKeys: ["system", "decision", "developer"],
  },
  {
    key: "admin",
    label: "Admin設定",
    description: "台帳、設定、請求、支払、prompt、Knowledge Admin の運用を見る。",
    icon: "settings",
    color: "rose",
    chapterSlugs: ["2-6-admin-ops", "2-2-member-workflows-quick-start"],
    relatedTopicKeys: ["monthly", "knowledge", "system"],
  },
  {
    key: "system",
    label: "OSの構造",
    description: "画面、データ、通知、判断、月次オペの関係を俯瞰する。",
    icon: "database",
    color: "slate",
    chapterSlugs: ["1-1-intro", "3-3-notifications-and-tsukuyomi", "4-1-atlas-protocol-score-macrotrend", "2-6-admin-ops", "6-2-admin-projects-members-ledger-spec"],
    relatedTopicKeys: ["knowledge", "decision", "admin"],
  },
  {
    key: "developer",
    label: "設計・開発",
    description: "全体設計、設計 md、抽出 routine、過去判断、開発手順を見る。",
    icon: "code",
    color: "indigo",
    chapterSlugs: [
      "3-1-system-architecture",
      "3-2-data-and-extraction",
      "4-2-atlas-macrotrend-signal-spec",
      "5-1-research-assets-vc-seeds-scholar-spec",
      "4-5-management-score-and-finance-simulation-spec",
      "4-6-graduation-detection-spec",
      "4-4-frl-related-members-score-spec",
      "4-8-ms-progress-monthly-report-revision-spec",
      "4-7-venture-status-narrative-pl-xrl-spec",
      "8-3-l2-extraction-routines-spec",
      "9-1-decisions-and-history",
      "9-2-developer",
    ],
    relatedTopicKeys: ["system-dev", "knowledge-dev", "admin-dev"],
  },
  {
    key: "system-dev",
    label: "内部構造",
    description: "画面、DB、cron、書き込み経路、設計 md 索引を開発者向けに俯瞰する。",
    icon: "database",
    color: "slate",
    chapterSlugs: ["3-1-system-architecture", "3-2-data-and-extraction", "6-1-operations-settings-spec", "4-2-atlas-macrotrend-signal-spec", "5-1-research-assets-vc-seeds-scholar-spec", "5-2-hud-and-venture-map-spec", "9-1-decisions-and-history", "9-2-developer"],
    relatedTopicKeys: ["developer", "knowledge-dev", "admin-dev"],
  },
  {
    key: "knowledge-dev",
    label: "抽出・復旧",
    description: "L2 抽出、MMOマシン automation、outbox/applier、停止済み旧経路、復旧手順を開発者向けに見る。",
    icon: "database",
    color: "teal",
    chapterSlugs: ["3-2-data-and-extraction", "8-3-l2-extraction-routines-spec", "3-3-notifications-and-tsukuyomi", "8-1-knowledge-admin-tsukuyomi-spec", "8-2-notification-review-and-strategy-signals-spec", "4-8-ms-progress-monthly-report-revision-spec"],
    relatedTopicKeys: ["developer", "system-dev", "admin-dev"],
  },
  {
    key: "admin-dev",
    label: "運用内部",
    description: "Operations Settings、Run Now、停止中 job、運用事故を開発者向けに確認する。",
    icon: "settings",
    color: "rose",
    chapterSlugs: [
      "6-1-operations-settings-spec",
      "6-2-admin-projects-members-ledger-spec",
      "6-3-invoice-and-billing-routine-spec",
      "6-4-finance-payment-confirm-spec",
      "6-5-admin-payouts-reward-notice-spec",
      "6-6-member-billing-prompts-spec",
      "7-1-reward-calc-spec",
      "8-1-knowledge-admin-tsukuyomi-spec",
      "4-5-management-score-and-finance-simulation-spec",
      "9-1-decisions-and-history",
    ],
    relatedTopicKeys: ["system-dev", "developer", "knowledge-dev"],
  },
];

const order = new Map(MANUAL_SECTIONS.flatMap((section, sectionIdx) =>
  section.slugs.map((slug, slugIdx) => [slug, sectionIdx * 100 + slugIdx] as const),
));

const chapterBySlug = new Map(MANUAL_CHAPTERS.map((chapter) => [chapter.slug, chapter]));
const topicByKey = new Map(MANUAL_TOPIC_NODES.map((topic) => [topic.key, topic]));

export function sortManualSlugs(slugs: string[]) {
  return [...slugs].sort((a, b) => {
    const aOrder = order.get(a);
    const bOrder = order.get(b);
    if (aOrder != null && bOrder != null) return aOrder - bOrder;
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;
    return a.localeCompare(b);
  });
}

/**
 * 章番号を section-chapter 形式 (= "7-1" など) で振る。
 *
 * 2026-05-27 まさ確定: audience 概念を廃止し、 全章を全 user に見せる。
 * 章番号は MANUAL_SECTIONS の順 × section 内 slug 順で固定。
 * slug 自体に番号を含む (例: `7-1-reward-calc-spec`) ので、 計算結果は
 * 常に slug prefix と一致する。
 *
 * 返り値: `ManualNumberedChapter[]` = 章メタ + `number` フィールド。
 * MANUAL_SECTIONS に登録されていない章は `number: "--"` を持つ
 * (= 設計上はすべての章を MANUAL_SECTIONS に登録する前提)。
 */
export function applyManualBookNumbering(chapters: ManualChapterConfig[]): ManualNumberedChapter[] {
  const numberBySlug = new Map<string, string>();

  MANUAL_SECTIONS.forEach((section, sectionIdx) => {
    section.slugs.forEach((slug, chapterIdx) => {
      numberBySlug.set(slug, `${sectionIdx + 1}-${chapterIdx + 1}`);
    });
  });

  return chapters.map((chapter) => ({
    ...chapter,
    number: numberBySlug.get(chapter.slug) ?? "--",
  }));
}

export function getManualChapter(slug: string) {
  return chapterBySlug.get(slug) ?? null;
}

export function getManualTopic(key: string) {
  return topicByKey.get(key) ?? null;
}

/**
 * 章 slug から「{number}. {title}」 の表示文字列を返す。
 */
export function getManualDisplayTitle(slug: string, fallbackTitle = slug) {
  const chapter = getManualChapter(slug);
  if (!chapter) return fallbackTitle;
  const numbered = applyManualBookNumbering(MANUAL_CHAPTERS).find((c) => c.slug === slug);
  return numbered ? `${numbered.number}. ${numbered.title}` : chapter.title;
}

export function getManualRelatedChapterSlugs(slug: string, limit = 8) {
  const chapter = getManualChapter(slug);
  if (!chapter) return [];

  const related = new Map<string, number>();
  for (const topicKey of chapter.topics) {
    const topic = getManualTopic(topicKey);
    if (!topic) continue;
    topic.chapterSlugs.forEach((relatedSlug, idx) => {
      if (relatedSlug === slug) return;
      related.set(relatedSlug, Math.max(related.get(relatedSlug) ?? 0, 100 - idx));
    });
  }

  return [...related.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([relatedSlug]) => relatedSlug)
    .slice(0, limit);
}
