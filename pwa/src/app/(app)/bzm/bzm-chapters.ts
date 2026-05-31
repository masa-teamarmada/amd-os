/**
 * BZM (Before Zero Model) 教科書の目次メタデータ。
 *
 * manual-chapters.ts と同じ思想:
 *  - **slug は既存リンク互換の stable id**。初期は part-chapter 番号を含んでいたが、
 *    Textbook 全体構成の再配置後も既存 slug を保持する。
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
    description: "Before Zero 実践テキストとしてのねらい、読み方、後半に置く BZM 理論への接続。",
    slugs: ["0-1-preface"],
  },
  {
    key: "before-zero",
    label: "第 1 部 — Before Zero とは何か",
    description: "会社化・事業化の前に勝負が決まる理由と、研究・技術・知財・人・制度・顧客の不確実性。",
    slugs: ["1-1-why-before-zero", "1-2-before-zero-field-landscape"],
  },
  {
    key: "field-frictions",
    label: "第 2 部 — Before Zero の現場で実際に起きること",
    description: "研究者、大学・研究機関、企業、VC、行政、知財の間で何がズレるか。",
    slugs: ["1-3-field-frictions-and-patterns"],
  },
  {
    key: "judgment-gates",
    label: "第 3 部 — 鬼門と判断分岐",
    description: "外部開示、論文化前/知財前、会社化タイミング、GO / WAIT / NO_GO / HOLD。",
    slugs: ["1-4-gates-and-judgment-branches"],
  },
  {
    key: "relationships-learning",
    label: "第 4 部 — 関係構築と失敗からの学習",
    description: "研究者、大学・研究機関、企業、VC、行政との関係構築と、失敗・手戻りの学習化。",
    slugs: ["1-5-relationships-and-learning"],
  },
  {
    key: "field-elements",
    label: "第 5 部 — BZM を構成する現場要素",
    description: "各パラメータを、現場でなぜ大事かから説明し、後半の理論変数へ接続する。",
    slugs: ["1-6-field-elements-to-bzm-variables"],
  },
  {
    key: "theory",
    label: "第 6 部 — BZM 理論パート",
    description: "既存の σ_SU、状態空間、XRL、FRL、AMD Score、retrofit、ERS 章を温存し、道具として後半に置く。",
    slugs: [
      "2-1-sigma-su-triple-helix",
      "2-2-state-space-model",
      "3-1-xrl-group",
      "4-1-frl-founder-readiness",
      "5-1-amd-score-integration",
      "6-1-retrofit-verification",
      "7-1-ers-ecosystem-readiness",
    ],
  },
  {
    key: "operations",
    label: "第 7 部 — ケーススタディ / チェックリスト / AMD OS 運用",
    description: "L2⑩承認済み知見の受け皿、AMD OS 実装、現場判断・失敗・関係構築・チェックポイント。",
    slugs: [
      "8-1-amd-os-operations",
      "8-2-field-decisions-and-branches",
      "8-3-failures-pivots-and-revisions",
      "8-4-relationship-playbook",
      "8-5-before-zero-checkpoints",
    ],
  },
  {
    key: "appendix",
    label: "巻末資料",
    description: "統合参考文献・記号一覧・用語集・ERS rubric・附則。全部を横断して参照する資料集。",
    slugs: ["9-1-references", "9-2-notation", "9-3-glossary", "9-4-ers-rubric", "9-5-appendix-changelog"],
  },
];

export const BZM_CHAPTERS: BzmChapterConfig[] = [
  { slug: "0-1-preface", title: "この教科書について", summary: "Before Zero 実践テキストとしてのねらい、現場から入り後半で BZM 理論を道具として読むガイド。" },
  { slug: "1-1-why-before-zero", title: "なぜ Before Zero なのか", summary: "「ゼロ」の定義、Valuation の限界、問題設定、四つの設計原則。" },
  { slug: "1-2-before-zero-field-landscape", title: "Before Zero とは何か — 会社になる前に勝負が決まる場所", summary: "研究・技術・知財・人・制度・顧客がまだ形になる前の不確実性と典型フェーズ。" },
  { slug: "1-3-field-frictions-and-patterns", title: "Before Zero の現場で実際に起きること", summary: "研究者、大学・研究機関、企業、VC、行政、知財のズレと「良い技術なのに進まない」典型パターン。" },
  { slug: "1-4-gates-and-judgment-branches", title: "鬼門と判断分岐 — 進める、待つ、止めるを分ける", summary: "外部開示、論文化前/知財前、会社化タイミング、GO / WAIT / NO_GO / HOLD の判断ログ。" },
  { slug: "1-5-relationships-and-learning", title: "関係構築と失敗からの学習", summary: "研究者・大学・企業・VC・行政との関係構築と、失敗・手戻りを次の判断資産へ変える学習ループ。" },
  { slug: "1-6-field-elements-to-bzm-variables", title: "BZM を構成する現場要素 — 現場の問いから理論変数へ", summary: "σ_SU、TRL、BRL、GRL、SRL、HRL、FRL、F_character、F_capability、frl_cap_amd、ERS、AMD Score を現場語から接続する。" },
  { slug: "2-1-sigma-su-triple-helix", title: "マクロ環境 σ_SU と Triple Helix", summary: "学 μ_A・産 μ_I・官 μ_G の幾何平均で σ_SU を作る。観測モデル。" },
  { slug: "2-2-state-space-model", title: "状態空間モデルによるマクロ推定", summary: "状態空間モデル、固有値分解が「螺旋」を正当化、マクロ/ミクロ二軸判定。" },
  { slug: "3-1-xrl-group", title: "XRL 群 — 5 つの Readiness Level", summary: "TRL/BRL/GRL/SRL/HRL の定義、9 段階、σ_SU/SRL の重なり、Shallow Tech。" },
  { slug: "4-1-frl-founder-readiness", title: "FRL — 創業者リーダーシップを独立軸にする", summary: "なぜ HRL では足りないか、ALQ 4 次元 + Grit + Resilience、計算式。" },
  { slug: "5-1-amd-score-integration", title: "AMD Score — 7 軸を一つの数値に統合する", summary: "Cobb-Douglas、シフト方式、IPO=100,000 校正、重み α、律速判定。" },
  { slug: "6-1-retrofit-verification", title: "検証 — 9 PJ retrofit でモデルを確かめる", summary: "ティエム時系列、「5 年早かった」を約 23 倍差で定量化、他 PJ 試算。" },
  { slug: "7-1-ers-ecosystem-readiness", title: "ERS — 苗床（研究機関）の整備度を測る", summary: "加重和（充足率）、8 軸 × サブ軸 × Lv1-5、二重計上を避ける二層構造。" },
  { slug: "8-1-amd-os-operations", title: "運用 — AMD OS への実装", summary: "各軸のデータソース、M×X×F、重みスライダーと K 自動再校正、律速表示。" },
  { slug: "8-2-field-decisions-and-branches", title: "現場判断と分岐 — Before Zero を進める意思決定", summary: "GO / WAIT / NO_GO、設立時期、律速軸、資源配分を再利用できる判断パターンとして整理する。" },
  { slug: "8-3-failures-pivots-and-revisions", title: "失敗・ピボット・仮説修正 — 消耗を学習に変える", summary: "早すぎた設立、顧客仮説の外れ、VC拒絶、制度・技術の詰まりを判断ルールへ変換する。" },
  { slug: "8-4-relationship-playbook", title: "関係構築プレイブック — 研究者・大学・企業・VC・行政", summary: "Before Zero で誰とどう関係を作り、何を先に握るかを相手カテゴリごとに整理する。" },
  { slug: "8-5-before-zero-checkpoints", title: "Before Zero チェックポイント — 次に何を見るか", summary: "フェーズごとの確認項目、赤信号、次アクション、再利用できる問いを整理する。" },
  { slug: "9-1-references", title: "統合参考文献", summary: "BZM 教科書が引用した学術文献・公的資料・内部正本を一箇所に集約。" },
  { slug: "9-2-notation", title: "記号一覧", summary: "マクロ → 個体 → 苗床の順に、数学記号の意味・値域・初出をまとめた notation table。" },
  { slug: "9-3-glossary", title: "用語集", summary: "Before Zero・Triple Helix・律速・retrofit・ERS など主要用語の定義。" },
  { slug: "9-4-ers-rubric", title: "付録：ERS 全 8 軸 rubric", summary: "第 7 部 ERS の 8 軸 × サブ軸 × Lv1〜5 到達状態定義を全軸ぶん集約。本書だけで機関評価を再現できる。" },
  { slug: "9-5-appendix-changelog", title: "附則（テキストブック変更履歴）", summary: "BZM 教科書の追加・変更・削除を日付つきで残す append-only の変更履歴。" },
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
