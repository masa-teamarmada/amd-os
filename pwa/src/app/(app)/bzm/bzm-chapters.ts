/**
 * 教科書の目次メタデータ。
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
    description: "研究成果が会社になる前の混乱を、誰かのせいにせず判断へ変えるための読書ガイド。",
    slugs: ["0-1-preface"],
  },
  {
    key: "research-to-company",
    label: "第 1 部 — 研究成果はなぜ会社にならないのか",
    description: "技術が強いだけでは進まない理由と、会社になる前に勝負が決まる場所を描く。",
    slugs: ["1-1-why-before-zero", "1-2-before-zero-field-landscape"],
  },
  {
    key: "field",
    label: "第 2 部 — Before Zero の現場",
    description: "研究者、大学・研究機関、企業、VC、行政、支援者が別々の時計で動く現場を見る。",
    slugs: ["1-3-field-frictions-and-patterns", "1-5-relationships-and-learning"],
  },
  {
    key: "traps",
    label: "第 3 部 — 会社になる前の鬼門",
    description: "早すぎる会社化、開示、顧客検証、支援制度、失敗学習で詰まりやすい構造を読む。",
    slugs: ["1-4-gates-and-judgment-branches", "8-2-field-decisions-and-branches", "8-3-failures-pivots-and-revisions"],
  },
  {
    key: "questions",
    label: "第 4 部 — Before Zero で見るべき問い",
    description: "いま会社にするべきか、誰が何を背負うのか、何が揃えば進めるのかを問える形にする。",
    slugs: ["8-5-before-zero-checkpoints", "8-4-relationship-playbook"],
  },
  {
    key: "field-elements",
    label: "第 5 部 — 現場要素からBZMへ",
    description: "創業者、研究機関、技術、事業、制度、社会、追い風を現場語から評価変数へ接続する。",
    slugs: ["1-6-field-elements-to-bzm-variables", "2-1-sigma-su-triple-helix", "3-1-xrl-group", "4-1-frl-founder-readiness", "7-1-ers-ecosystem-readiness"],
  },
  {
    key: "theory",
    label: "第 6 部 — BZM理論",
    description: "前半で見た混乱を、状態空間、統合評価、retrofitで扱える理論地図として整理する。",
    slugs: [
      "2-2-state-space-model",
      "5-1-amd-score-integration",
      "6-1-retrofit-verification",
    ],
  },
  {
    key: "operations",
    label: "第 7 部 — 実践ツール",
    description: "研究者、産連・URA、VC/CVC、支援者が自分の現場で使えるチェックリストと運用へ戻す。",
    slugs: ["8-1-amd-os-operations"],
  },
  {
    key: "appendix",
    label: "巻末資料",
    description: "統合参考文献・記号一覧・用語集・ERS rubric・附則。全部を横断して参照する資料集。",
    slugs: ["9-1-references", "9-2-notation", "9-3-glossary", "9-4-ers-rubric", "9-5-appendix-changelog"],
  },
];

export const BZM_CHAPTERS: BzmChapterConfig[] = [
  { slug: "0-1-preface", title: "この教科書について", summary: "研究成果が会社になる前の混乱を読み、現場の違和感からBZM理論と実践ツールへ進むためのガイド。" },
  { slug: "1-1-why-before-zero", title: "研究成果はなぜ会社にならないのか", summary: "技術が強い、制度もある、人も動いている。それでも会社化が止まる理由を、Before Zero の入口として整理する。" },
  { slug: "1-2-before-zero-field-landscape", title: "会社になる前に勝負が決まる場所", summary: "研究・技術・知財・人・制度・顧客がまだ形になる前の不確実性と、会社化前に起きる典型フェーズ。" },
  { slug: "1-3-field-frictions-and-patterns", title: "Before Zero の現場で実際に起きること", summary: "研究者、大学・研究機関、企業、VC、行政、知財のズレと「良い技術なのに進まない」典型パターン。" },
  { slug: "1-5-relationships-and-learning", title: "支援が増えても孤独になる構造", summary: "関係者が善意で動いても研究者や事業化主体が孤立する理由と、関係構築を判断資産に変える入口。" },
  { slug: "1-4-gates-and-judgment-branches", title: "鬼門と判断分岐 — 進める、待つ、止めるを分ける", summary: "外部開示、論文化前/知財前、会社化タイミング、GO / WAIT / NO_GO / HOLD の判断ログ。" },
  { slug: "8-2-field-decisions-and-branches", title: "現場判断と分岐 — Before Zero を進める意思決定", summary: "GO / WAIT / NO_GO、設立時期、律速軸、資源配分を再利用できる判断パターンとして整理する。" },
  { slug: "8-3-failures-pivots-and-revisions", title: "失敗・ピボット・仮説修正 — 消耗を学習に変える", summary: "早すぎた設立、顧客仮説の外れ、VC拒絶、制度・技術の詰まりを判断ルールへ変換する。" },
  { slug: "8-5-before-zero-checkpoints", title: "会社にする前に聞く問い", summary: "フェーズごとの確認項目、赤信号、次アクション、再利用できる問いを整理する。" },
  { slug: "8-4-relationship-playbook", title: "誰が何を背負うのか — 関係構築プレイブック", summary: "Before Zero で誰とどう関係を作り、何を先に握るかを相手カテゴリごとに整理する。" },
  { slug: "1-6-field-elements-to-bzm-variables", title: "現場の問いからBZM変数へ", summary: "創業者、研究機関、技術、事業、制度、社会、追い風を現場語からBZMの評価変数へ接続する。" },
  { slug: "2-1-sigma-su-triple-helix", title: "追い風は本当に追い風か — σ_SU と Triple Helix", summary: "政策・産業・研究・資本・社会の流れを熱量ではなく条件として読み、学 μ_A・産 μ_I・官 μ_G の観測へ接続する。" },
  { slug: "3-1-xrl-group", title: "何がどこまで準備できているか — XRL 群", summary: "TRL/BRL/GRL/SRL/HRL を、会社化前に見るべき準備度の束として読む。" },
  { slug: "4-1-frl-founder-readiness", title: "創業者の素質はどこに現れるか — FRL", summary: "ピッチ力や肩書きではなく、曖昧な責任を引き受け続ける力として創業者準備度を読む。" },
  { slug: "7-1-ers-ecosystem-readiness", title: "研究機関は苗床になっているか — ERS", summary: "知財、契約、EIR/CXO、資金接続、研究者保護、制度設計を持つ環境として研究機関を評価する。" },
  { slug: "2-2-state-space-model", title: "状態空間モデルとしてのBefore Zero", summary: "前半で見たズレや追い風を、時間と状態の変化として扱うための理論地図。" },
  { slug: "5-1-amd-score-integration", title: "統合評価 — 複数軸を一つの判断へ束ねる", summary: "Cobb-Douglas、シフト方式、IPO=100,000 校正、重み α、律速判定。" },
  { slug: "6-1-retrofit-verification", title: "retrofit — 過去ケースからモデルを検証する", summary: "過去事例を使って、会社化タイミングや支援条件の差をモデルで読み直す。" },
  { slug: "8-1-amd-os-operations", title: "実践ツールとしての運用", summary: "理論を日々の判断、チェックリスト、ケース、データ更新へ戻すための運用章。" },
  { slug: "9-1-references", title: "統合参考文献", summary: "教科書が引用した学術文献・公的資料・内部正本を一箇所に集約。" },
  { slug: "9-2-notation", title: "記号一覧", summary: "マクロ → 個体 → 苗床の順に、数学記号の意味・値域・初出をまとめた notation table。" },
  { slug: "9-3-glossary", title: "用語集", summary: "Before Zero・Triple Helix・律速・retrofit・ERS など主要用語の定義。" },
  { slug: "9-4-ers-rubric", title: "付録：ERS 全 8 軸 rubric", summary: "第 7 部 ERS の 8 軸 × サブ軸 × Lv1〜5 到達状態定義を全軸ぶん集約。本書だけで機関評価を再現できる。" },
  { slug: "9-5-appendix-changelog", title: "附則（テキストブック変更履歴）", summary: "教科書の追加・変更・削除を日付つきで残す append-only の変更履歴。" },
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
