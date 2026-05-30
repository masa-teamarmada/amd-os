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
    slugs: ["1-1-overview", "1-2-document-layer-migration-map"],
  },
  {
    key: "platform",
    label: "PWA 基盤",
    description: "PWA の実行環境、route、API、cron、auth 境界。",
    slugs: ["2-1-pwa-runtime-routes"],
  },
  {
    key: "data-automation",
    label: "データ / Automation",
    description: "5 生データ、L2 ①〜⑨、outbox、LaunchAgent、採否ループ。",
    slugs: [
      "3-1-l2-data-extraction-current-spec",
      "3-2-monthly-reports-current-spec",
      "3-3-meeting-flow-current-spec",
      "3-4-registry-diffs-current-spec",
      "3-5-xrl-evidence-current-spec",
      "3-6-strategy-signals-current-spec",
    ],
  },
  {
    key: "decision-engine",
    label: "経営判断エンジン",
    description: "AMD Score、FRL、XRL、経営判断ロジックの確定実装仕様。",
    slugs: ["4-1-frl-ces-current-spec", "4-2-amd-score-current-spec"],
  },
];

export const SPEC_CHAPTERS: SpecChapterConfig[] = [
  { slug: "1-1-overview", title: "設計書について", summary: "確定仕様の正本。manual / spec / bzm の 3 層体系と、OS 画面で正本管理する理由。" },
  { slug: "1-2-document-layer-migration-map", title: "ドキュメント3層移行マップ", summary: "manual / design / bzm / spec の重複・衝突、移行優先順位、章単位の移行ゲート。" },
  { slug: "2-1-pwa-runtime-routes", title: "PWA ランタイム / ルート仕様", summary: "Next.js PWA の実行環境、主要 route、API / cron / auth の現行契約。" },
  { slug: "3-1-l2-data-extraction-current-spec", title: "L2 データ抽出 / Outbox 仕様", summary: "5 生データ、L2 ①〜⑨、subscription automation、outbox / LaunchAgent 反映の確定仕様。" },
  { slug: "3-2-monthly-reports-current-spec", title: "L2① Monthly Reports 仕様", summary: "monthly_reports の writer、上書き禁止、source refs、outbox 反映、旧 R313 / PWA route の扱い。" },
  { slug: "3-3-meeting-flow-current-spec", title: "L2⑥ Meeting Flow 仕様", summary: "MTGサマリ、予定MTGカード、Drive資料同期、TODO、Calendar作業枠、Gmail draft の現行仕様。" },
  { slug: "3-4-registry-diffs-current-spec", title: "L2⑦ OS 台帳差分仕様", summary: "5 生データと OS 台帳の差分候補、project_registry_diffs、通知採否、allowlist 適用の契約。" },
  { slug: "3-5-xrl-evidence-current-spec", title: "L2⑧ XRL 根拠仕様", summary: "XRL / AMD Score 根拠、project_xrl_evidence、関連メンバー、HRL 算定境界の契約。" },
  { slug: "3-6-strategy-signals-current-spec", title: "L2⑨ 経営ハイライト仕様", summary: "project_strategy_signals、cockpit 表示、通知採否、dialogue 接続の契約。" },
  { slug: "4-1-frl-ces-current-spec", title: "FRL CES 実装仕様", summary: "F_character × F_capability の CES 合成、DB列、実装関数、後方互換の現行契約。" },
  { slug: "4-2-amd-score-current-spec", title: "AMD Score 実装仕様", summary: "7 軸 Cobb-Douglas、M/X/F 表示、DB、route、bottleneck、FRL 境界の契約。" },
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
