/**
 * 設計書 (/spec) の目次メタデータ。
 *
 * manual-chapters.ts / bzm-chapters.ts と同じ思想:
 *  - **slug 自体が section-chapter 番号を含む** (例: `2-3-cockpit` → section 2 の 3 章 → 番号 "2-3")。
 *  - 表示番号は `applySpecBookNumbering()` が SPEC_SECTIONS の順に振る (1 始まり)。
 *
 * 内容正本は `pwa/spec/{slug}.md` (= git 管理かつ OS 画面表示)。
 * 設計書は AMD OS の「確定した実装仕様」の正本。数式・理論は /bzm、使い方は /manual。
 * `pwa/design/*.md` から章単位で移行中。移行済み章だけ /spec を正本にする。
 */

export interface SpecSectionConfig {
  key: string;
  label: string;
  description: string;
  slugs: string[];
}

export interface SpecChapterConfig {
  slug: string;
  title: string;
  summary: string;
}

export interface SpecNumberedChapter extends SpecChapterConfig {
  number: string;
}

/**
 * section 構成。フェーズ B で旧 design/ の S ファイルと manual の -spec 章を
 * ここへ集約する。現状は overview と移行マップ (= 方針を固める段階)。
 */
export const SPEC_SECTIONS: SpecSectionConfig[] = [
  {
    key: "overview",
    label: "はじめに",
    description: "設計書セクションの目的、3 層ドキュメント体系、移行中の正本境界。",
    slugs: ["1-1-overview", "1-2-document-layer-migration-map", "1-3-reconstruction-coverage-audit"],
  },
  {
    key: "platform",
    label: "PWA 基盤",
    description: "PWA の実行環境、route、API、cron、auth 境界。",
    slugs: [
      "2-1-pwa-runtime-routes",
      "2-2-pwa-surface-inventory-current-spec",
      "2-3-supabase-data-model-current-spec",
      "2-4-proactive-todo-current-spec",
      "2-5-business-cards-current-spec",
      "2-6-bzm-theory-map-current-spec",
    ],
  },
  {
    key: "data-automation",
    label: "データ / Automation",
    description: "5 生データ、M/W/D/H L2、outbox、LaunchAgent、採否ループ。",
    slugs: [
      "3-1-l2-data-extraction-current-spec",
      "3-2-monthly-reports-current-spec",
      "3-3-meeting-flow-current-spec",
      "3-4-registry-diffs-current-spec",
      "3-5-xrl-evidence-current-spec",
      "3-6-strategy-signals-current-spec",
      "3-7-notifications-current-spec",
      "3-8-cockpit-current-spec",
      "3-9-l2-protocol-current-spec",
      "3-10-l2-ms-progress-current-spec",
      "3-11-l2-project-knowledge-current-spec",
      "3-12-l2-member-knowledge-current-spec",
      "3-13-l2-textbook-insights-current-spec",
      "3-14-monthly-work-agreement-current-spec",
      "3-15-management-guardrails-current-spec",
      "3-16-project-weekly-control-current-spec",
      "3-17-project-navigation-current-spec",
    ],
  },
  {
    key: "decision-engine",
    label: "経営判断エンジン",
    description: "AMD Score、FRL、XRL、経営判断ロジックの確定実装仕様。",
    slugs: [
      "4-1-frl-ces-current-spec",
      "4-2-amd-score-current-spec",
      "4-3-ers-current-spec",
      "4-4-management-score-company-vital-scope-plan",
      "4-5-management-score-rebuild-plan",
    ],
  },
  {
    key: "governance-ops",
    label: "開発統制 / 運用",
    description: "ドキュメント統制、開発/deploy、automation責務分担、判断履歴、附則。",
    slugs: [
      "5-1-document-governance-current-spec",
      "5-2-development-operations-current-spec",
      "5-3-automation-responsibility-current-spec",
      "5-4-decision-history-current-spec",
      "5-5-cross-platform-gas-ios-current-spec",
      "5-6-contracts-management-current-spec",
      "5-7-task-management-current-spec",
      "5-8-l1-l3-codex-migration-current-spec",
    ],
  },
  {
    key: "appendix",
    label: "附則",
    description: "設計書の変更履歴。append-only。",
    slugs: ["6-1-appendix-changelog"],
  },
];

export const SPEC_CHAPTERS: SpecChapterConfig[] = [
  { slug: "1-1-overview", title: "設計書について", summary: "確定仕様の正本。manual / spec / bzm の 3 層体系と、OS 画面で正本管理する理由。" },
  { slug: "1-2-document-layer-migration-map", title: "ドキュメント3層移行マップ", summary: "manual / design / bzm / spec の重複・衝突、移行優先順位、章単位の移行ゲート。" },
  { slug: "1-3-reconstruction-coverage-audit", title: "再構築カバレッジ監査", summary: "設計書だけで current OS を再構築できるかを領域別に評価し、不足と確認済み実装を明示。" },
  { slug: "2-1-pwa-runtime-routes", title: "PWA ランタイム / ルート仕様", summary: "Next.js PWA の実行環境、主要 route、API / cron / auth の現行契約。" },
  { slug: "2-2-pwa-surface-inventory-current-spec", title: "PWA 画面 / API Surface 仕様", summary: "現行 PWA の画面 route、API route groups、auth/authority、failure mode、検証入口。" },
  { slug: "2-3-supabase-data-model-current-spec", title: "Supabase Data Model 仕様", summary: "Supabase schema の source of truth、domain別 table map、status convention、DDL/dump手順。" },
  { slug: "2-4-proactive-todo-current-spec", title: "先手 TODO", summary: "MTG next_actions と次回MTG予定から自動抽出する全PJ横断の先手TODOリスト。/proactive で期限順表示、3ボタン完了UI、毎朝 cron で proactive_todos に upsert。旧『ループカーネル × 役割レンズ』の白紙やり直し版 (2026-06-27)。" },
  { slug: "2-5-business-cards-current-spec", title: "名刺管理 / OCR / PJ Knowledge 連携仕様", summary: "スマホ撮影、非公開画像保存、DB管理promptによるOCR、人の確認、複数PJ紐づけ、D-3人物knowledge同期の契約。" },
  { slug: "2-6-bzm-theory-map-current-spec", title: "BZM 2.0 理論マップ仕様", summary: "`/bzm/map` の論証台帳。1 Markdown = 1 ノード、8 relation、frontmatter schema、parser/validator、画面フィルタとカバレッジ欠落検知の契約。" },
  { slug: "3-1-l2-data-extraction-current-spec", title: "L2 データ抽出 / Outbox 仕様", summary: "5 生データ、M/W/D/H L2、subscription automation、outbox / LaunchAgent 反映の確定仕様。" },
  { slug: "3-2-monthly-reports-current-spec", title: "M-1 Monthly Reports 仕様", summary: "monthly_reports の writer、上書き禁止、source refs、outbox 反映、旧 R313 / PWA route の扱い。" },
  { slug: "3-3-meeting-flow-current-spec", title: "H-1 Meeting Flow 仕様", summary: "MTGサマリ、予定MTGカード、Drive資料同期、TODO、Calendar作業枠、Gmail draft の現行仕様。" },
  { slug: "3-4-registry-diffs-current-spec", title: "D-5 OS 台帳差分仕様", summary: "5 生データと OS 台帳の差分候補、project_registry_diffs、通知採否、allowlist 適用の契約。" },
  { slug: "3-5-xrl-evidence-current-spec", title: "M-2 XRL 根拠仕様", summary: "XRL / AMD Score 根拠、project_xrl_evidence、関連メンバー、HRL 算定境界の契約。" },
  { slug: "3-6-strategy-signals-current-spec", title: "D-6 経営ハイライト仕様", summary: "project_strategy_signals、cockpit 表示、通知採否、dialogue 接続の契約。" },
  { slug: "3-7-notifications-current-spec", title: "Notifications / 採否ゲート仕様", summary: "/notifications と /api/notifications/feedback の admin gate、入力、status 遷移、failure mode。" },
  { slug: "3-8-cockpit-current-spec", title: "PJ Cockpit 仕様", summary: "PJ cockpit の data bundle、初期 modal rules、monthly/reward modal、資料・MTG・D-6 表示、Edge Function bridge 境界。" },
  { slug: "3-9-l2-protocol-current-spec", title: "D-1 AMD Protocol 仕様", summary: "protocols / protocol_examples / result observations の writer、input、dedupe、通知採否、停止済みGAS境界。" },
  { slug: "3-10-l2-ms-progress-current-spec", title: "D-2 MS Progress 仕様", summary: "milestone_monthly_progress / project_monthly_notes / progress_estimate_state の抽出、guard、cockpit反映。" },
  { slug: "3-11-l2-project-knowledge-current-spec", title: "D-3 Project Knowledge 仕様", summary: "project_knowledge の9カテゴリ、汚染防御、DB upsert、通知採否、MMO automation contract。" },
  { slug: "3-12-l2-member-knowledge-current-spec", title: "D-4 Member Knowledge 仕様", summary: "member_knowledge の7カテゴリ、3 section input、本人帰属guard、DB upsert、通知採否。" },
  { slug: "3-13-l2-textbook-insights-current-spec", title: "D-7 Textbook Insights 仕様", summary: "教科書追記候補、candidate DB、通知採否、approved 後の local BZM applier contract。" },
  { slug: "3-14-monthly-work-agreement-current-spec", title: "月初タスク・報酬合意 仕様", summary: "当月の遂行対象・報酬条件を本人が確認し、snapshot hash つきで合意するDB/API/UI/admin管理契約。" },
  { slug: "3-15-management-guardrails-current-spec", title: "経営ガードレール仕様", summary: "まさの予防ノウハウをタグ付きカード化し、PJ / アクションタグとの照合で高リスク見落としを通知する契約。" },
  { slug: "3-16-project-weekly-control-current-spec", title: "PJ週次管制画面 仕様", summary: "既存計画から週次差分・判断・介入を確認し、論点と仮説を担当・期限・検証・根拠へ接続して放置を防ぐ別URL画面。" },
  { slug: "3-17-project-navigation-current-spec", title: "SX PJ管制ダッシュボード 仕様", summary: "階層WBSガント、重要経路、技術試験・論点の掘り下げ、関係先7段階比較、同一画面での追加・編集を扱う別URL画面。RSC境界へは最小view modelだけを渡す。" },
  { slug: "4-1-frl-ces-current-spec", title: "FRL CES 実装仕様", summary: "F_character × F_capability の CES 合成、DB列、実装関数、後方互換の現行契約。" },
  { slug: "4-2-amd-score-current-spec", title: "AMD Score 実装仕様", summary: "SPS (シーズ有望度、旧PRS) primary、legacy AMD comparison、DB、route、bottleneck、FRL 境界の契約。" },
  { slug: "4-3-ers-current-spec", title: "ECR 実装仕様", summary: "研究機関 ECR の route、DB、fetch bundle、assessment upsert API、admin gate。" },
  { slug: "4-4-management-score-company-vital-scope-plan", title: "Management Score 会社バイタル分類 本修正案", summary: "Management Score材料を会社バイタル/PJ個別へ分けるDB分類、L2抽出validator、backfill、snapshot再計算の未適用設計案。" },
  { slug: "4-5-management-score-rebuild-plan", title: "Management Score 再設計案", summary: "スコア対象・表示対象・未同期/未実装・根拠impactを分け、P0/P1/P2点検で経営スコアを監査する設計案。" },
  { slug: "5-1-document-governance-current-spec", title: "ドキュメント統制仕様", summary: "manual / spec / bzm の責務分離、附則更新ゲート、再構築要件。" },
  { slug: "5-2-development-operations-current-spec", title: "開発 / デプロイ運用仕様", summary: "repo、PWA技術スタック、deploy、build version、Supabase DDL、GAS deploy、検証 gate。" },
  { slug: "5-3-automation-responsibility-current-spec", title: "Automation 責務分担仕様", summary: "M/W/D/H L2 writer、停止済み LLM cron、allowed cron、outbox applier、再発防止。" },
  { slug: "5-4-decision-history-current-spec", title: "判断履歴 / 事故ログ仕様", summary: "LLM cron 廃止、経営ハイライト再設計、dialogue、new_business、主要事故ログ。" },
  { slug: "5-5-cross-platform-gas-ios-current-spec", title: "GAS / iOS 役割境界仕様", summary: "PWA、GAS、iOS の責務境界、current/deprecated の入口、未確認点。" },
  { slug: "5-6-contracts-management-current-spec", title: "契約管理仕様", summary: "/admin/contracts、契約予定枠、Drive metadata版管理、5生データ予兆dry-run、Slack nudge dry-runの仕様。" },
  { slug: "5-7-task-management-current-spec", title: "Task Data / API 互換仕様", summary: "廃止済み /tasks 画面と、H-1 / cockpit 互換のため残す tasks table / API の境界。" },
  { slug: "5-8-l1-l3-codex-migration-current-spec", title: "L1-L3 Codex移植仕様", summary: "Claude routines停止前提で、L1/L2/L3抽出をCodex側へ移す inventory、優先順位、approval bundle、RED運用の current truth。" },
  { slug: "6-1-appendix-changelog", title: "附則（設計書変更履歴）", summary: "/spec の追加・変更・削除を append-only で記録する変更履歴。" },
];

const sectionOrder = new Map(
  SPEC_SECTIONS.flatMap((section, sectionIdx) =>
    section.slugs.map((slug, slugIdx) => [slug, sectionIdx * 100 + slugIdx] as const),
  ),
);

const chapterBySlug = new Map(SPEC_CHAPTERS.map((chapter) => [chapter.slug, chapter]));

export function sortSpecSlugs(slugs: string[]) {
  return [...slugs].sort((a, b) => {
    const aOrder = sectionOrder.get(a);
    const bOrder = sectionOrder.get(b);
    if (aOrder != null && bOrder != null) return aOrder - bOrder;
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;
    return a.localeCompare(b);
  });
}

/**
 * 章番号を section-chapter 形式 (= "2-3" など) で振る。section は 1 始まり。
 */
export function applySpecBookNumbering(chapters: SpecChapterConfig[]): SpecNumberedChapter[] {
  const numberBySlug = new Map<string, string>();
  SPEC_SECTIONS.forEach((section, sectionIdx) => {
    section.slugs.forEach((slug, chapterIdx) => {
      numberBySlug.set(slug, `${sectionIdx + 1}-${chapterIdx + 1}`);
    });
  });
  return chapters.map((chapter) => ({
    ...chapter,
    number: numberBySlug.get(chapter.slug) ?? "--",
  }));
}

export function getSpecChapter(slug: string) {
  return chapterBySlug.get(slug) ?? null;
}
