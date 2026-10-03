/**
 * 書斎の本棚（manifest）。原稿の場所と並び順の正本はここ。
 *
 * ファイル名の規則から自動で拾わないのは、台帳 md や草稿メモが同じフォルダに混ざるため。
 * 検査（node --experimental-strip-types）から読むので、`@/` を使わず拡張子付きの相対 import だけにする。
 */
import { BZM_CHAPTERS, BZM_PARTS } from "../../app/(app)/bzm/bzm-chapters.ts";
import type { ReaderBookManifest, ReaderChapterManifest } from "./types.ts";

/** BZM 3.0 教科書。題は BZM_3_0_TEXTBOOK_PLAN.md §1 の 16 本。未執筆の章は plannedTitle で目次に出す */
const BZM30_CHAPTERS: Array<{ name: string; plannedTitle: string }> = [
  { name: "introduction", plannedTitle: "序 — 何を測り、なぜ作り直したか" },
  { name: "industrial-value", plannedTitle: "第1章 — 産業創出価値と最上段の式" },
  { name: "observed-state", plannedTitle: "第2章 — 観測状態と資金の二勘定" },
  { name: "parameters", plannedTitle: "第3章 — 案件パラメータと事前分布" },
  { name: "stage-gates", plannedTitle: "第4章 — 標準ゲート表と前進の式" },
  { name: "team-functions", plannedTitle: "第5章 — 担い手の八機能と充足係数" },
  { name: "funding-and-offers", plannedTitle: "第6章 — 資金調達、実現の申し出、受託、権利の解決" },
  { name: "transition-and-plan-rules", plannedTitle: "第7章 — 一か月の遷移と計画の規則" },
  { name: "scenario-value", plannedTitle: "第8章 — シナリオの価値、割引、継続価値、撤退の四経路" },
  { name: "score-and-report", plannedTitle: "第9章 — スコアの三つの数と報告様式" },
  { name: "registry", plannedTitle: "第10章 — 観測を状態へ移す登録簿" },
  { name: "coefficients", plannedTitle: "第11章 — 係数を置く規約と初期値の総覧" },
  { name: "verification", plannedTitle: "第12章 — 検算、弾力性、較正計画" },
  { name: "foundations", plannedTitle: "第13章 — 巨人の肩 — 要件ごとの既存理論" },
  { name: "limits", plannedTitle: "第14章 — モデルが表現していないこと、近似、反証条件" },
  { name: "appendix", plannedTitle: "付録 — 記号一覧、用語、参考文献" },
];

const bzm30Chapters: ReaderChapterManifest[] = BZM30_CHAPTERS.map(({ name, plannedTitle }) => {
  const slug = `bzm-3-0-textbook-${name}`;
  return { slug, file: `${slug}.md`, plannedTitle };
});

/** Book A の章。BZM_PARTS の key "book-a" の並びと BZM_CHAPTERS の題をそのまま使う（章の追加で二重管理にしない） */
function buildBookAChapters(): ReaderChapterManifest[] {
  const part = BZM_PARTS.find((p) => p.key === "book-a");
  if (!part) return [];
  const titleBySlug = new Map(BZM_CHAPTERS.map((chapter) => [chapter.slug, chapter.title]));
  return part.slugs.map((slug) => ({ slug, file: `${slug}.md`, title: titleBySlug.get(slug) }));
}

const bzm22Chapters: ReaderChapterManifest[] = [
  { slug: "bzm-2-2-textbook-introduction", file: "bzm-2-2-textbook-introduction.md" },
  { slug: "bzm-2-2-textbook-states-and-actions", file: "bzm-2-2-textbook-states-and-actions.md" },
  { slug: "bzm-2-2-textbook-value-and-indices", file: "bzm-2-2-textbook-value-and-indices.md" },
  {
    slug: "bzm-2-2-textbook-context-and-limits",
    file: "bzm-2-2-textbook-context-and-limits.md",
    plannedTitle: "第III部 — 文脈と限界",
  },
];

const courseChapters: ReaderChapterManifest[] = [
  "course-bzm-foundations-index",
  "course-bzm-foundations-s00",
  "course-bzm-foundations-s01",
].map((slug) => ({ slug, file: `${slug}.md` }));

/** 補足資料の題。各 md は `## SM-X. …` で始まり `# ` 見出しが無いので、題はここで持つ */
const SUPPLEMENT_TITLES: Array<{ letter: string; title: string }> = [
  { letter: "A", title: "SM-A. Notation and complete model equations" },
  { letter: "B", title: "SM-B. Gate table, carrier-function table, event-registry format, and plan-rule template" },
  { letter: "C", title: "SM-C. Coefficient tables, declared approximations, and elasticities" },
  { letter: "D", title: "SM-D. Application detail" },
  { letter: "E", title: "SM-E. Derivation log and audit record" },
  { letter: "F", title: "SM-F. Calibration plan, identification constraints, and the falsification-condition registry" },
  { letter: "G", title: "SM-G. Version freeze" },
];

const supplementChapters: ReaderChapterManifest[] = SUPPLEMENT_TITLES.map(({ letter, title }) => ({
  slug: `sm-${letter.toLowerCase()}`,
  file: `sm_v2/SM-${letter}.md`,
  title,
}));

/** 棚の順は設計正本 §3 の表の順。accent は棚のカードで白文字を載せるので、どれも白との比が 4.5:1 以上 */
export const READER_LIBRARY: ReaderBookManifest[] = [
  {
    id: "bzm30-textbook",
    title: "BZM 3.0教科書",
    description: "産業創出価値の最上段の式から、状態、遷移、登録簿、検算までを16本で通読",
    kind: "textbook",
    lang: "ja",
    // 白文字を載せる色帯。#027fdc は白との比が 4.14:1 で足りないので 5.8:1 の濃さにする
    accent: "#0366b8",
    chapters: bzm30Chapters,
  },
  {
    id: "book-a",
    title: "ディープテック起業の経営学",
    description: "設立前を経営学の対象にする理論の集大成。序から15章、読書案内まで",
    kind: "book",
    lang: "ja",
    accent: "#1f6f5c",
    chapters: buildBookAChapters(),
  },
  {
    id: "bzm22-textbook",
    title: "BZM 2.2教科書",
    description: "八層の状態、行動の制約、価値の式と四指標を扱う旧版の教科書",
    kind: "textbook",
    lang: "ja",
    accent: "#7a4b2a",
    chapters: bzm22Chapters,
  },
  {
    id: "bzm-course",
    title: "BZM 批判的基礎講座",
    description: "二つの観測対象と測定尺度を批判的に学ぶ講義資料",
    kind: "course",
    lang: "ja",
    accent: "#5a4fcf",
    chapters: courseChapters,
  },
  {
    id: "p1-paper",
    title: "The Before Zero Model（第1論文）",
    description: "設立前の大学発ディープテック案件を付加価値で評価する枠組みの論文草稿（英語）",
    kind: "paper",
    lang: "en",
    accent: "#3a3a3c",
    chapters: [{ slug: "paper", file: "PAPER_P1_DRAFT_V2.md", split: "h1" }],
  },
  {
    id: "p1-supplement",
    title: "第1論文 補足資料",
    description: "記号と全式、係数表、適用の詳細、検証計画を収めた補足資料 SM-A〜SM-G（英語）",
    kind: "paper",
    lang: "en",
    accent: "#8a5a1c",
    chapters: supplementChapters,
  },
];
