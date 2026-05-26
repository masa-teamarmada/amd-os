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

export type ManualAudience = "user" | "developer";
export type ManualChapterAudience = ManualAudience | "both";
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
  audience: ManualAudience;
  chapterSlugs: string[];
  relatedTopicKeys: string[];
}

export interface ManualChapterConfig {
  slug: string;
  number: string;
  title: string;
  summary: string;
  audience: ManualChapterAudience;
  topics: string[];
  screens?: string[];
  tables?: string[];
}

export const MANUAL_SECTIONS: ManualSectionConfig[] = [
  {
    key: "entry",
    label: "入口",
    description: "AMD OS の目的、想定ユーザー、読み方。",
    slugs: ["00-intro"],
  },
  {
    key: "usage",
    label: "まず使う人向け",
    description: "画面の見方、日常業務、月次運用をざっくり掴む章。",
    slugs: [
      "08-member-quick-start",
      "10-member-workflows-quick-start",
      "01-pj-cockpit",
      "02-amd-cockpit",
      "09-research-assets-quick-start",
      "04-admin-ops",
    ],
  },
  {
    key: "architecture",
    label: "OS の基本構造",
    description: "画面、データ、L2、通知、正本反映ゲートの地図。",
    slugs: [
      "20-system-architecture",
      "03-data-and-extraction",
      "22-notifications-and-tsukuyomi",
    ],
  },
  {
    key: "decision",
    label: "経営判断エンジン",
    description: "Atlas、AMD Protocol、AMD Score、XRL、Management Score など判断ロジックの章。",
    slugs: [
      "07-atlas-protocol-score-macrotrend",
      "34-atlas-macrotrend-signal-spec",
      "21-amd-score-spec",
      "35-frl-related-members-score-spec",
      "29-management-score-and-finance-simulation-spec",
      "37-venture-status-narrative-pl-xrl-spec",
      "36-ms-progress-monthly-report-revision-spec",
    ],
  },
  {
    key: "assets",
    label: "外部探索・事業アセット",
    description: "Seeds、VC、Scholar、Venture Map、HUD など外部探索と事業化アセットの章。",
    slugs: [
      "33-research-assets-vc-seeds-scholar-spec",
      "23-hud-and-venture-map-spec",
    ],
  },
  {
    key: "admin-finance",
    label: "Admin / Finance / 月次オペ",
    description: "設定、台帳、請求、入金確認、支払通知書、メンバー向け月次運用の仕様。",
    slugs: [
      "24-operations-settings-spec",
      "30-admin-projects-members-ledger-spec",
      "32-invoice-and-billing-routine-spec",
      "25-finance-payment-confirm-spec",
      "31-admin-payouts-reward-notice-spec",
      "26-member-billing-prompts-spec",
    ],
  },
  {
    key: "knowledge-automation",
    label: "Knowledge / Automation",
    description: "Knowledge Admin、つくよみ、通知レビュー、経営ハイライト、L2 抽出 routine の仕様。",
    slugs: [
      "27-knowledge-admin-tsukuyomi-spec",
      "28-notification-review-and-strategy-signals-spec",
      "38-l2-extraction-routines-spec",
    ],
  },
  {
    key: "developer-history",
    label: "開発者・履歴",
    description: "開発手順、過去判断、事故ログ、設計 md の読み方。",
    slugs: [
      "05-decisions-and-history",
      "06-developer",
    ],
  },
];

export const MANUAL_CHAPTERS: ManualChapterConfig[] = [
  { slug: "00-intro", number: "00", title: "AMD OS とは", summary: "OS の目的、想定ユーザー、5 生データ、L2 9 種、読み方ガイド。", audience: "user", topics: ["start", "system"], screens: ["/manual"], tables: ["L2 9 種"] },
  { slug: "08-member-quick-start", number: "10", title: "はじめて使う人向け", summary: "最初に見る画面と、ざっくりした使い方。", audience: "user", topics: ["start", "cockpit"], screens: ["/dashboard", "/project/{projectId}/cockpit", "/mypage"] },
  { slug: "10-member-workflows-quick-start", number: "11", title: "メンバーの日常ワークフロー", summary: "マイページ、立替、週次活動、月次 TODO の日常導線。", audience: "user", topics: ["start", "monthly"], screens: ["/mypage", "/reimburse"] },
  { slug: "01-pj-cockpit", number: "12", title: "PJ コックピットの見方", summary: "PJ Status、MS 進捗、経営ハイライト、月次ルーティンの読み方。", audience: "user", topics: ["cockpit", "decision", "monthly"], screens: ["/project/{projectId}/cockpit"] },
  { slug: "02-amd-cockpit", number: "13", title: "AMD 全体コックピットの見方", summary: "p00、Management Score、提案前の論点整理の使い方。", audience: "user", topics: ["start", "decision"], screens: ["/project/p00/cockpit"] },
  { slug: "09-research-assets-quick-start", number: "14", title: "探索系アセットの使い方", summary: "Atlas、Seeds、VC、Scholar をまず触るための入口。", audience: "user", topics: ["discovery", "start"], screens: ["/atlas", "/seeds", "/vcs", "/scholar"] },
  { slug: "04-admin-ops", number: "15", title: "月次ルーティン早見表", summary: "支払、請求、立替、報告書、入金確認の締切と流れ。", audience: "user", topics: ["monthly", "admin"], screens: ["/admin/billing", "/admin/payouts"] },

  { slug: "20-system-architecture", number: "20", title: "全体設計", summary: "画面、データ、書き込み経路、設計 md 索引まで含む OS の地図。", audience: "developer", topics: ["system-dev", "developer"], screens: ["/manual"], tables: ["projects", "members", "billing_cycles"] },
  { slug: "03-data-and-extraction", number: "21", title: "データと抽出", summary: "5 生データ、L2 9 種、抽出 pipeline、復旧状況の開発者向け正本。", audience: "developer", topics: ["system-dev", "knowledge-dev"], tables: ["source_cache", "project_meeting_summaries", "project_strategy_signals"] },
  { slug: "22-notifications-and-tsukuyomi", number: "22", title: "通知・修正依頼・正本反映ゲート", summary: "通知、つくよみ、ユーザー確認、正本反映の考え方。", audience: "user", topics: ["knowledge", "system"], screens: ["/notifications"], tables: ["l2_notifications", "l2_feedbacks"] },

  { slug: "07-atlas-protocol-score-macrotrend", number: "30", title: "判断エンジン overview", summary: "Atlas、AMD Protocol、AMD Score、Macrotrend の関係。", audience: "user", topics: ["decision", "discovery"], screens: ["/atlas", "/venture-map/amd-score"] },
  { slug: "34-atlas-macrotrend-signal-spec", number: "31", title: "Atlas / Macrotrend 詳細仕様", summary: "signal、story、theme、divergence の詳細。", audience: "developer", topics: ["decision", "discovery", "system-dev"], screens: ["/atlas", "/atlas/macrotrends"], tables: ["atlas_signals", "atlas_stories", "atlas_themes"] },
  { slug: "21-amd-score-spec", number: "32", title: "AMD Score 詳細仕様", summary: "Before Zero Theory、7 軸、算出式、未来予測修正 loop。", audience: "user", topics: ["decision", "cockpit"], screens: ["/venture-map/amd-score", "/project/{projectId}/cockpit"], tables: ["amd_score_inputs", "amd_score_alpha"] },
  { slug: "35-frl-related-members-score-spec", number: "33", title: "FRL / HRL / 関連メンバー詳細仕様", summary: "Founding Readiness、関連メンバー、HRL、Grit / Resilience。", audience: "developer", topics: ["decision", "cockpit", "system-dev"], tables: ["project_founding_members", "project_venture_members"] },
  { slug: "29-management-score-and-finance-simulation-spec", number: "34", title: "AMD Management Score / Finance Simulation", summary: "会社全体の経営スコア、財務耐久、GAS 月次試算表移植。", audience: "developer", topics: ["decision", "admin-dev"], screens: ["/management-score"], tables: ["amd_management_score_*"] },
  { slug: "37-venture-status-narrative-pl-xrl-spec", number: "35", title: "Venture Status / Narrative / PL / XRL", summary: "SU の事業概要、沿革、PL hearing、XRL 修正導線。", audience: "developer", topics: ["decision", "cockpit", "system-dev"], screens: ["/project/{projectId}/cockpit"], tables: ["project_ventures", "project_xrl_log"] },
  { slug: "36-ms-progress-monthly-report-revision-spec", number: "36", title: "MS Progress / Monthly Report / Revision Loop", summary: "MS 進捗、月次報告書、月次ノート、つくよみ修正依頼 loop。", audience: "developer", topics: ["cockpit", "monthly", "system-dev"], screens: ["/project/{projectId}/cockpit"], tables: ["milestone_monthly_progress", "ms_progress_revisions"] },

  { slug: "33-research-assets-vc-seeds-scholar-spec", number: "40", title: "Seeds / VC / Scholar 詳細仕様", summary: "研究シーズ、VC、Scholar の DB、inbox、cron route。", audience: "developer", topics: ["discovery", "admin-dev"], screens: ["/seeds", "/vcs", "/scholar"], tables: ["seeds", "vcs", "papers_log"] },
  { slug: "23-hud-and-venture-map-spec", number: "41", title: "HUD / Venture Map 仕様", summary: "HUD mirror、Venture Map、実験ビュー、ルート一覧。", audience: "developer", topics: ["discovery", "system-dev"], screens: ["/hud", "/venture-map"] },

  { slug: "24-operations-settings-spec", number: "50", title: "Operations Settings", summary: "Raw Data、L2 Data、Cron Control、運用設定画面。", audience: "developer", topics: ["admin-dev", "system-dev"], screens: ["/admin/settings"] },
  { slug: "30-admin-projects-members-ledger-spec", number: "51", title: "Admin Projects / Members 台帳", summary: "PJ 台帳、AMD メンバー台帳、契約・請求・支払条件。", audience: "developer", topics: ["admin-dev", "monthly"], screens: ["/admin/projects", "/admin/members"], tables: ["projects", "members", "project_members"] },
  { slug: "32-invoice-and-billing-routine-spec", number: "52", title: "Invoice / Billing Routine", summary: "請求書、見積書、freee 発行、請求・月次ルーティン仕様。", audience: "developer", topics: ["monthly", "admin-dev"], screens: ["/admin/billing"], tables: ["billing_cycles", "billing_log"] },
  { slug: "25-finance-payment-confirm-spec", number: "53", title: "Finance / Payment Confirm", summary: "admin finance、入金確認 nudge、signed token、freee 同期。", audience: "developer", topics: ["monthly", "admin-dev"], screens: ["/admin/finance", "/payment-confirm"], tables: ["company_finance_*", "billing_cycles"] },
  { slug: "31-admin-payouts-reward-notice-spec", number: "54", title: "Admin Payouts / 支払通知書", summary: "報酬キャッシュ、支払通知書 PDF、支払月判定。", audience: "developer", topics: ["monthly", "admin-dev"], screens: ["/admin/payouts"], tables: ["payout_notices", "billing_cycles"] },
  { slug: "26-member-billing-prompts-spec", number: "55", title: "Member Ops / Billing / Prompt", summary: "mypage、reimburse、admin billing、prompt 管理の仕様。", audience: "developer", topics: ["monthly", "admin-dev"], screens: ["/mypage", "/reimburse", "/admin/prompts"] },

  { slug: "27-knowledge-admin-tsukuyomi-spec", number: "60", title: "Knowledge Admin / Tsukuyomi", summary: "AMD Protocol、contexts、つくよみ学習、feedback API。", audience: "developer", topics: ["knowledge-dev", "admin-dev"], screens: ["/admin/protocols", "/admin/contexts", "/admin/tsukuyomi"], tables: ["protocols", "tsukuyomi_context"] },
  { slug: "28-notification-review-and-strategy-signals-spec", number: "61", title: "通知レビュー UI / 経営ハイライト確認", summary: "notifications 実 UI、経営ハイライト、修正依頼履歴。", audience: "developer", topics: ["knowledge-dev", "decision", "cockpit"], screens: ["/notifications", "/project/{projectId}/cockpit"], tables: ["project_strategy_signals", "l2_feedbacks"] },
  { slug: "38-l2-extraction-routines-spec", number: "62", title: "L2 Extraction Routines", summary: "L2 ②④⑤⑥ の Claude routine、GAS dryRun、ghost 復旧状況。", audience: "developer", topics: ["knowledge-dev", "developer"], tables: ["project_knowledge", "member_knowledge", "protocols"] },

  { slug: "05-decisions-and-history", number: "90", title: "過去判断と経緯", summary: "cron 廃止経緯、責務分担、過去事故ログ、判断履歴。", audience: "developer", topics: ["developer", "system-dev"] },
  { slug: "06-developer", number: "91", title: "開発者向け", summary: "環境、実装、検証、デプロイ、設計変更時の運用。", audience: "developer", topics: ["developer", "system-dev"] },
];

export const MANUAL_TOPIC_NODES: ManualTopicNodeConfig[] = [
  {
    key: "start",
    label: "まず触る",
    description: "初めて開く人が、OS の目的と日常画面を掴む入口。",
    icon: "book",
    color: "blue",
    audience: "user",
    chapterSlugs: ["00-intro", "08-member-quick-start", "10-member-workflows-quick-start", "01-pj-cockpit", "02-amd-cockpit"],
    relatedTopicKeys: ["cockpit", "monthly", "discovery"],
  },
  {
    key: "cockpit",
    label: "PJを見る",
    description: "PJ 状況、MS 進捗、経営ハイライト、XRL を見ながら判断する。",
    icon: "dashboard",
    color: "cyan",
    audience: "user",
    chapterSlugs: ["01-pj-cockpit", "21-amd-score-spec", "36-ms-progress-monthly-report-revision-spec", "37-venture-status-narrative-pl-xrl-spec", "28-notification-review-and-strategy-signals-spec"],
    relatedTopicKeys: ["decision", "monthly", "knowledge"],
  },
  {
    key: "monthly",
    label: "月次オペ",
    description: "月次 TODO、請求、入金確認、支払通知書、報酬の流れを追う。",
    icon: "calendar",
    color: "emerald",
    audience: "user",
    chapterSlugs: ["04-admin-ops", "10-member-workflows-quick-start", "32-invoice-and-billing-routine-spec", "25-finance-payment-confirm-spec", "31-admin-payouts-reward-notice-spec", "26-member-billing-prompts-spec"],
    relatedTopicKeys: ["admin", "cockpit", "system"],
  },
  {
    key: "decision",
    label: "経営判断",
    description: "外部 signal、AMD Protocol、AMD Score、XRL、Management Score をつなげる。",
    icon: "brain",
    color: "violet",
    audience: "user",
    chapterSlugs: ["07-atlas-protocol-score-macrotrend", "34-atlas-macrotrend-signal-spec", "21-amd-score-spec", "35-frl-related-members-score-spec", "29-management-score-and-finance-simulation-spec", "37-venture-status-narrative-pl-xrl-spec", "28-notification-review-and-strategy-signals-spec"],
    relatedTopicKeys: ["discovery", "cockpit", "knowledge"],
  },
  {
    key: "discovery",
    label: "外部探索",
    description: "Atlas、Macrotrend、Seeds、VC、Scholar、Venture Map から事業機会を見る。",
    icon: "search",
    color: "amber",
    audience: "user",
    chapterSlugs: ["09-research-assets-quick-start", "34-atlas-macrotrend-signal-spec", "33-research-assets-vc-seeds-scholar-spec", "23-hud-and-venture-map-spec"],
    relatedTopicKeys: ["decision", "admin", "developer"],
  },
  {
    key: "knowledge",
    label: "知識・通知",
    description: "5 生データ、L2、通知、修正依頼、つくよみ学習の流れを見る。",
    icon: "database",
    color: "teal",
    audience: "user",
    chapterSlugs: ["03-data-and-extraction", "22-notifications-and-tsukuyomi", "27-knowledge-admin-tsukuyomi-spec", "28-notification-review-and-strategy-signals-spec", "38-l2-extraction-routines-spec"],
    relatedTopicKeys: ["system", "decision", "developer"],
  },
  {
    key: "admin",
    label: "Admin設定",
    description: "台帳、設定、請求、支払、prompt、Knowledge Admin の運用を見る。",
    icon: "settings",
    color: "rose",
    audience: "user",
    chapterSlugs: ["04-admin-ops", "10-member-workflows-quick-start"],
    relatedTopicKeys: ["monthly", "knowledge", "system"],
  },
  {
    key: "system",
    label: "OSの構造",
    description: "画面、データ、通知、判断、月次オペの関係を俯瞰する。",
    icon: "database",
    color: "slate",
    audience: "user",
    chapterSlugs: ["00-intro", "22-notifications-and-tsukuyomi", "07-atlas-protocol-score-macrotrend", "04-admin-ops", "30-admin-projects-members-ledger-spec"],
    relatedTopicKeys: ["knowledge", "decision", "admin"],
  },
  {
    key: "developer",
    label: "設計・開発",
    description: "全体設計、設計 md、抽出 routine、過去判断、開発手順を見る。",
    icon: "code",
    color: "indigo",
    audience: "developer",
    chapterSlugs: [
      "20-system-architecture",
      "03-data-and-extraction",
      "34-atlas-macrotrend-signal-spec",
      "33-research-assets-vc-seeds-scholar-spec",
      "29-management-score-and-finance-simulation-spec",
      "35-frl-related-members-score-spec",
      "36-ms-progress-monthly-report-revision-spec",
      "37-venture-status-narrative-pl-xrl-spec",
      "38-l2-extraction-routines-spec",
      "05-decisions-and-history",
      "06-developer",
    ],
    relatedTopicKeys: ["system-dev", "knowledge-dev", "admin-dev"],
  },
  {
    key: "system-dev",
    label: "内部構造",
    description: "画面、DB、cron、書き込み経路、設計 md 索引を開発者向けに俯瞰する。",
    icon: "database",
    color: "slate",
    audience: "developer",
    chapterSlugs: ["20-system-architecture", "03-data-and-extraction", "24-operations-settings-spec", "34-atlas-macrotrend-signal-spec", "33-research-assets-vc-seeds-scholar-spec", "23-hud-and-venture-map-spec", "05-decisions-and-history", "06-developer"],
    relatedTopicKeys: ["developer", "knowledge-dev", "admin-dev"],
  },
  {
    key: "knowledge-dev",
    label: "抽出・復旧",
    description: "L2 抽出、Claude routine、停止中 job、復旧計画を開発者向けに見る。",
    icon: "database",
    color: "teal",
    audience: "developer",
    chapterSlugs: ["03-data-and-extraction", "38-l2-extraction-routines-spec", "22-notifications-and-tsukuyomi", "27-knowledge-admin-tsukuyomi-spec", "28-notification-review-and-strategy-signals-spec", "36-ms-progress-monthly-report-revision-spec"],
    relatedTopicKeys: ["developer", "system-dev", "admin-dev"],
  },
  {
    key: "admin-dev",
    label: "運用内部",
    description: "Operations Settings、Run Now、停止中 job、運用事故を開発者向けに確認する。",
    icon: "settings",
    color: "rose",
    audience: "developer",
    chapterSlugs: [
      "24-operations-settings-spec",
      "30-admin-projects-members-ledger-spec",
      "32-invoice-and-billing-routine-spec",
      "25-finance-payment-confirm-spec",
      "31-admin-payouts-reward-notice-spec",
      "26-member-billing-prompts-spec",
      "27-knowledge-admin-tsukuyomi-spec",
      "29-management-score-and-finance-simulation-spec",
      "05-decisions-and-history",
    ],
    relatedTopicKeys: ["system-dev", "developer", "knowledge-dev"],
  },
];

const order = new Map(MANUAL_SECTIONS.flatMap((section, sectionIdx) =>
  section.slugs.map((slug, slugIdx) => [slug, sectionIdx * 100 + slugIdx] as const),
));

const chapterBySlug = new Map(MANUAL_CHAPTERS.map((chapter) => [chapter.slug, chapter]));
const topicByKey = new Map(MANUAL_TOPIC_NODES.map((topic) => [topic.key, topic]));

export function isChapterVisibleForAudience(chapter: ManualChapterConfig, audience: ManualAudience) {
  return chapter.audience === "both" || chapter.audience === audience;
}

export function isTopicVisibleForAudience(topic: ManualTopicNodeConfig, audience: ManualAudience) {
  return topic.audience === audience;
}

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

export function applyManualBookNumbering(chapters: ManualChapterConfig[]) {
  const visibleSlugs = new Set(chapters.map((chapter) => chapter.slug));
  const numberBySlug = new Map<string, string>();
  let visibleSectionIndex = 0;

  for (const section of MANUAL_SECTIONS) {
    const sectionSlugs = section.slugs.filter((slug) => visibleSlugs.has(slug));
    if (sectionSlugs.length === 0) continue;

    visibleSectionIndex += 1;
    sectionSlugs.forEach((slug, chapterIndex) => {
      numberBySlug.set(slug, `${visibleSectionIndex}-${chapterIndex + 1}`);
    });
  }

  return chapters.map((chapter) => ({
    ...chapter,
    number: numberBySlug.get(chapter.slug) ?? chapter.number,
  }));
}

export function getManualChapter(slug: string) {
  return chapterBySlug.get(slug) ?? null;
}

export function getManualTopic(key: string) {
  return topicByKey.get(key) ?? null;
}

export function getManualDisplayTitle(slug: string, fallbackTitle = slug) {
  const chapter = getManualChapter(slug);
  return chapter ? `${chapter.number}. ${chapter.title}` : fallbackTitle;
}

export function getManualRelatedChapterSlugs(slug: string, limit = 8, audience?: ManualAudience) {
  const chapter = getManualChapter(slug);
  if (!chapter) return [];

  const related = new Map<string, number>();
  for (const topicKey of chapter.topics) {
    const topic = getManualTopic(topicKey);
    if (!topic) continue;
    topic.chapterSlugs.forEach((relatedSlug, idx) => {
      if (relatedSlug === slug) return;
      const relatedChapter = getManualChapter(relatedSlug);
      if (audience && relatedChapter && !isChapterVisibleForAudience(relatedChapter, audience)) return;
      related.set(relatedSlug, Math.max(related.get(relatedSlug) ?? 0, 100 - idx));
    });
  }

  return [...related.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([relatedSlug]) => relatedSlug)
    .slice(0, limit);
}
