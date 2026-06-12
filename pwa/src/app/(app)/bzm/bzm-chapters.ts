/**
 * 教科書の目次メタデータ。
 *
 * 2026-06-13 全面改編 (まさ確定): 「章頭ストーリー型教科書」へ差し替え。
 *  - 章型 = 冒頭ストーリー → 解説 (数式・図を章内で出す) → 匿名化実例 → 章末の問い。
 *    詳細は `pwa/bzm/textbook/PUBLICATION_STRATEGY.md` §0。
 *  - 旧テキストブック (0-1〜9-4 の 24 章) は `pwa/bzm/legacy/` へ退避 (git 保全、表示はしない)。
 *    旧ナラティブ版 public-manuscript は `/bzm/public` でそのまま閲覧できる。
 *  - **slug は stable id**。part-chapter 番号を含めない (再配置に耐えるため)。
 *    表示番号は `applyBzmBookNumbering()` が BZM_PARTS の順に振る。
 *  - 章 md を追加したら、このファイルの BZM_PARTS / BZM_CHAPTERS に同じ commit で登録する。
 *    未登録の md は左ナビに出ない (prev/next 末尾には出る)。
 *
 * 内容正本は `pwa/bzm/{slug}.md` (= git 管理)。理論正本は
 * `BZSF/before_zero_theory.md` / `BZSF/PRS_STRATEGIC_SLACK_OVERVIEW_20260612.html`。
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
    description: "この本の読み方。研究成果が会社になる前の混乱を、現場 → モデル → 実践の順で読む。",
    slugs: [],
  },
  {
    key: "field",
    label: "第 I 部 — Before Zero の現場",
    description: "会社になる前に勝負が決まる場所。関係者の時計のズレ、鬼門、誰が何を背負うか。",
    slugs: [],
  },
  {
    key: "model",
    label: "第 II 部 — Before Zero Model",
    description: "PRS × 戦略余力。天井 P・到達度 R・生存確率 S と、その土台になる (x, y) の動学。",
    slugs: ["why-valuation-fails", "model-overview", "p-potential", "r-readiness", "strategic-slack"],
  },
  {
    key: "nursery",
    label: "第 III 部 — 苗床",
    description: "研究機関をベンチャーを生み育てる装置として読む。整備度の測り方と制度設計。",
    slugs: [],
  },
  {
    key: "toolkit",
    label: "第 IV 部 — 実践ツールキット",
    description: "面談の問い、開示台本、判断チェックリスト、90日 pilot charter。現場で使う道具集。",
    slugs: [],
  },
  {
    key: "appendix",
    label: "巻末資料",
    description: "附則 (変更履歴)。参考文献・記号・用語は各部の完成にあわせて再構築する。",
    slugs: ["9-5-appendix-changelog"],
  },
];

export const BZM_CHAPTERS: BzmChapterConfig[] = [
  {
    slug: "why-valuation-fails",
    title: "何を解くか — Valuation は Before Zero でなぜ機能しないのか",
    summary: "「5年後売上30億円」は何を測っていたのか。期待を単一値に圧縮する Valuation が設立前に突き当たる四つの壁を解き、天井P×到達R×生存Sの骨格を示す開幕章。",
  },
  {
    slug: "model-overview",
    title: "全体像 — 天井 × 到達 × 生存",
    summary: "評価は「天井P×到達R×生存S」の積で読む。判定層と動学層の二層構造、戦略余力を軸でなく動学に置く理由、モデル進化の三世代を一望する章。",
  },
  {
    slug: "p-potential",
    title: "潜在規模 P — 天井の大きさと、証拠の質",
    summary: "最大限うまくいったときの経済的インパクトの天井 P。市場規模の主張の大きさではなく証拠の質で測り、天井そのものを戦略で書き換える打ち手までを扱う。",
  },
  {
    slug: "r-readiness",
    title: "到達度 R — 不可逆な達成の蓄積",
    summary: "「技術はできています」は五枚に割れる。TRL/BRL/GRL/SRL/HRL の五軸と Yes/No 観測項目、研究室と自社の TRL ギャップ、達成 R と消費資源 y の線引き。",
  },
  {
    slug: "strategic-slack",
    title: "戦略余力 — 主導権を保って走り切る",
    summary: "事業化到達度 × 戦略余力の (x, y) 平面。y=0 主導権喪失ライン、鋸歯の補充、交渉力と KPI、開示 Lv1〜4、出口設計 (ライセンス vs 自社事業化)。",
  },
  {
    slug: "9-5-appendix-changelog",
    title: "附則（テキストブック変更履歴）",
    summary: "教科書の追加・変更・削除を日付つきで残す append-only の変更履歴。",
  },
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
 * 章番号を part-chapter 形式 (= "2-1" など) で振る。
 * 序章は part index 0。
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
