/**
 * BZM (Before Zero Model) 教科書の目次メタデータ。
 *
 * manual-chapters.ts と同じ思想:
 *  - **slug 自体が part-chapter 番号を含む** (例: `5-1-amd-score-integration` → 第 5 部の 1 章 → 番号 "5-1")。
 *  - 表示番号は `applyBzmBookNumbering()` が BZM_PARTS の順に振る。
 *
 * 内容正本は `pwa/bzm/{slug}.md` (= git 管理)。理論正本は
 * `before-zero/theory/*.md` と `pwa/design/amd_score.md` / `institution_readiness.md`。
 */

export interface BzmPartConfig {
  key: string;
  label: string;
  description: string;
  slugs: string[];
}

export interface BzmChapterConfig {
  slug: string;
  title: string;
  summary: string;
}

export interface BzmNumberedChapter extends BzmChapterConfig {
  number: string;
}

export const BZM_PARTS: BzmPartConfig[] = [
  {
    key: "preface",
    label: "序章",
    description: "この教科書のねらい、想定読者、二層構造の見取り図、読み方ガイド。",
    slugs: ["0-1-preface"],
  },
  {
    key: "why",
    label: "第 1 部 — なぜ Before Zero なのか",
    description: "Valuation の限界と、BZM が解く問題設定・四つの設計原則。",
    slugs: ["1-1-why-before-zero"],
  },
  {
    key: "macro",
    label: "第 2 部 — マクロ環境 σ_SU と Triple Helix",
    description: "学・産・官の追い風を測る。Triple Helix と状態空間モデル。",
    slugs: ["2-1-sigma-su-triple-helix", "2-2-state-space-model"],
  },
  {
    key: "xrl",
    label: "第 3 部 — XRL 群",
    description: "技術・事業・規制・社会・人材の 5 つの Readiness Level。",
    slugs: ["3-1-xrl-group"],
  },
  {
    key: "frl",
    label: "第 4 部 — FRL（創業者リーダーシップ）",
    description: "なぜ CEO の質を独立軸にするのか。ALQ + Grit + Resilience。",
    slugs: ["4-1-frl-founder-readiness"],
  },
  {
    key: "amd-score",
    label: "第 5 部 — AMD Score の統合",
    description: "7 軸を Cobb-Douglas で一つの数値にまとめる。律速判定。",
    slugs: ["5-1-amd-score-integration"],
  },
  {
    key: "verification",
    label: "第 6 部 — 検証（9 PJ retrofit）",
    description: "過去事例でモデルの妥当性を確かめる。ティエム「5 年早かった」の定量化。",
    slugs: ["6-1-retrofit-verification"],
  },
  {
    key: "ers",
    label: "第 7 部 — ERS（苗床レイヤー）",
    description: "研究機関の整備度を測り、支援ギャップを見せる。AMD Score との二層構造。",
    slugs: ["7-1-ers-ecosystem-readiness"],
  },
  {
    key: "operations",
    label: "第 8 部 — 運用（AMD OS への実装）",
    description: "理論を日々の経営判断に落とす。重みスライダー、律速表示、Shallow Tech。",
    slugs: ["8-1-amd-os-operations"],
  },
  {
    key: "appendix",
    label: "巻末資料",
    description: "統合参考文献・記号一覧・用語集・ERS rubric 付録。全部を横断して参照する資料集。",
    slugs: ["9-1-references", "9-2-notation", "9-3-glossary", "9-4-ers-rubric"],
  },
];

export const BZM_CHAPTERS: BzmChapterConfig[] = [
  { slug: "0-1-preface", title: "この教科書について", summary: "BZM のねらい、3 つの想定読者、AMD Score / ERS の二層構造、読み方ガイド。" },
  { slug: "1-1-why-before-zero", title: "なぜ Before Zero なのか", summary: "「ゼロ」の定義、Valuation の限界、問題設定、四つの設計原則。" },
  { slug: "2-1-sigma-su-triple-helix", title: "マクロ環境 σ_SU と Triple Helix", summary: "学 μ_A・産 μ_I・官 μ_G の幾何平均で σ_SU を作る。観測モデル。" },
  { slug: "2-2-state-space-model", title: "状態空間モデルによるマクロ推定", summary: "状態空間モデル、固有値分解が「螺旋」を正当化、マクロ/ミクロ二軸判定。" },
  { slug: "3-1-xrl-group", title: "XRL 群 — 5 つの Readiness Level", summary: "TRL/BRL/GRL/SRL/HRL の定義、9 段階、σ_SU/SRL の重なり、Shallow Tech。" },
  { slug: "4-1-frl-founder-readiness", title: "FRL — 創業者リーダーシップを独立軸にする", summary: "なぜ HRL では足りないか、ALQ 4 次元 + Grit + Resilience、計算式。" },
  { slug: "5-1-amd-score-integration", title: "AMD Score — 7 軸を一つの数値に統合する", summary: "Cobb-Douglas、シフト方式、IPO=100,000 校正、重み α、律速判定。" },
  { slug: "6-1-retrofit-verification", title: "検証 — 9 PJ retrofit でモデルを確かめる", summary: "ティエム時系列、「5 年早かった」を約 23 倍差で定量化、他 PJ 試算。" },
  { slug: "7-1-ers-ecosystem-readiness", title: "ERS — 苗床（研究機関）の整備度を測る", summary: "加重和（充足率）、8 軸 × サブ軸 × Lv1-5、二重計上を避ける二層構造。" },
  { slug: "8-1-amd-os-operations", title: "運用 — AMD OS への実装", summary: "各軸のデータソース、M×X×F、重みスライダーと K 自動再校正、律速表示。" },
  { slug: "9-1-references", title: "統合参考文献", summary: "全 10 章が引用した学術文献・公的資料・内部正本を一箇所に集約。" },
  { slug: "9-2-notation", title: "記号一覧", summary: "マクロ → 個体 → 苗床の順に、数学記号の意味・値域・初出をまとめた notation table。" },
  { slug: "9-3-glossary", title: "用語集", summary: "Before Zero・Triple Helix・律速・retrofit・ERS など主要用語の定義。" },
  { slug: "9-4-ers-rubric", title: "付録：ERS 全 8 軸 rubric", summary: "第 7 部 ERS の 8 軸 × サブ軸 × Lv1〜5 到達状態定義を全軸ぶん集約。本書だけで機関評価を再現できる。" },
];

const partOrder = new Map(
  BZM_PARTS.flatMap((part, partIdx) => part.slugs.map((slug, slugIdx) => [slug, partIdx * 100 + slugIdx] as const)),
);

const chapterBySlug = new Map(BZM_CHAPTERS.map((chapter) => [chapter.slug, chapter]));

export function sortBzmSlugs(slugs: string[]) {
  return [...slugs].sort((a, b) => {
    const aOrder = partOrder.get(a);
    const bOrder = partOrder.get(b);
    if (aOrder != null && bOrder != null) return aOrder - bOrder;
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;
    return a.localeCompare(b);
  });
}

/**
 * 章番号を part-chapter 形式 (= "5-1" など) で振る。
 * 序章は part index 0 なので "0-1"。
 */
export function applyBzmBookNumbering(chapters: BzmChapterConfig[]): BzmNumberedChapter[] {
  const numberBySlug = new Map<string, string>();
  BZM_PARTS.forEach((part, partIdx) => {
    part.slugs.forEach((slug, chapterIdx) => {
      numberBySlug.set(slug, `${partIdx}-${chapterIdx + 1}`);
    });
  });
  return chapters.map((chapter) => ({
    ...chapter,
    number: numberBySlug.get(chapter.slug) ?? "--",
  }));
}

export function getBzmChapter(slug: string) {
  return chapterBySlug.get(slug) ?? null;
}
