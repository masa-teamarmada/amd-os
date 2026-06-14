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
    slugs: ["preface"],
  },
  {
    key: "field",
    label: "第 I 部 — Before Zero の現場",
    description: "会社になる前に勝負が決まる場所。関係者の時計のズレ、鬼門、誰が何を背負うか。",
    slugs: ["field-before-zero", "field-clocks", "field-gates", "field-who-carries"],
  },
  {
    key: "model",
    label: "第 II 部 — Before Zero Model",
    description: "PRS × 戦略余力。天井 P・到達度 R・生存確率 S と、その土台になる (x, y) の動学。",
    slugs: [
      "why-valuation-fails",
      "model-overview",
      "p-potential",
      "r-readiness",
      "s-survival",
      "score-and-bottleneck",
      "strategic-slack",
      "model-critiques",
      "retrofit-verification",
    ],
  },
  {
    key: "nursery",
    label: "第 III 部 — 苗床",
    description: "研究機関をベンチャーを生み育てる装置として読む。整備度の測り方と制度設計。",
    slugs: ["nursery-ers"],
  },
  {
    key: "toolkit",
    label: "第 IV 部 — 実践ツールキット",
    description: "面談の問い、開示台本、判断チェックリスト、90日 pilot charter。現場で使う道具集。",
    slugs: ["field-toolkit"],
  },
  {
    key: "appendix",
    label: "巻末資料",
    description: "著者性・利害・倫理への批判と、附則 (変更履歴)。参考文献・記号・用語は各部の完成にあわせて再構築する。",
    slugs: ["ethics-and-authorship", "9-5-appendix-changelog"],
  },
];

export const BZM_CHAPTERS: BzmChapterConfig[] = [
  {
    slug: "preface",
    title: "序章 — この本の読み方",
    summary: "誰のための本か、四部構成で何が手に入るか、どこから読むか、本書が約束しないこと。実例はすべて匿名化 composite であることの明記。",
  },
  {
    slug: "field-before-zero",
    title: "Before Zero — 会社になる前に勝負が決まる",
    summary: "技術が強く、制度も人もあるのに事業化が止まるのはなぜか。会社が生まれる前の時間「Before Zero」を定義し、七つの不確実性の地図と、早すぎる設立・遅すぎる決断の両側を示す開幕章。",
  },
  {
    slug: "field-clocks",
    title: "関係者の時計 — 善意のズレが研究者を孤立させる",
    summary: "研究者・大学・企業・VC・行政・支援者は別々の関心と時計で動く。悪意なき「正しい圧力の未調整」が研究者を急がせ孤立させる構造と、相手の時計から逆算する会話設計。",
  },
  {
    slug: "field-gates",
    title: "鬼門 — 進める、待つ、止めるを分ける",
    summary: "外部開示の順序、会社化のタイミング、CEO機能の早すぎる要求。GO/WAIT/NO_GO/HOLD の語彙で空気から判断を取り戻し、戻る条件を書いた WAIT が未来の GO を作る。",
  },
  {
    slug: "field-who-carries",
    title: "誰が何を背負うのか — 創業者機能の分解と、失敗を学習に変える",
    summary: "最後に研究人生を背負うのは研究者一人。創業者機能を五つに分解し「誰が・いつまで・どこまで」を九十日メモで合意する方法と、失敗を判断ルールへ変える記録の粒度。",
  },
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
    slug: "s-survival",
    title: "生存確率 S — 死なずに、主導権を保って走り切れるか",
    summary: "死因第一位「本命が整う前の資金切れ」を測る因子 S。生存条件式 B−R_net≤F、互いに補い合う三要素、資質×経営実行力の CES 合成、設立を遅らせる選択肢。",
  },
  {
    slug: "score-and-bottleneck",
    title: "計算式と律速診断 — 9つの軸をひとつの判断へ",
    summary: "9軸を +1 シフトの Cobb-Douglas 積で統合スコアへ。重み α と K の校正、律速診断 argmax α/(X+1) で「次の一手」を機械的に取り出す。手計算の例題つき。",
  },
  {
    slug: "strategic-slack",
    title: "戦略余力 — 主導権を保って走り切る",
    summary: "事業化到達度 × 戦略余力の (x, y) 平面。y=0 主導権喪失ライン、鋸歯の補充、交渉力と KPI、開示 Lv1〜4、出口設計 (ライセンス vs 自社事業化)。",
  },
  {
    slug: "model-critiques",
    title: "モデルの限界と批判 — この物差しが測れないもの",
    summary: "割引率の三つの仕事のうち S が肩代わりできるのは失敗リスク補正だけ。経済学からの5批判・経営学からの6批判を正面から認め、道具が役に立つ条件を明確にする。",
  },
  {
    slug: "retrofit-verification",
    title: "検証 — 過去の軌跡がモデルを鍛える",
    summary: "モデルは信じるものではなく検証するもの。blind retrofit と事前予測で後知恵を断ち、見送り案件を対照群に、軌跡の型と R/y の線引きを実データで確かめる。",
  },
  {
    slug: "nursery-ers",
    title: "苗床 — 研究機関は、ベンチャーを生み育てる装置になっているか",
    summary: "同じシーズでも機関の土壌で事業化速度はまるで違う。機関整備度を8軸×Lv1〜5で測る ERS、案件評価 (掛け算) と異なる加重和を採る理由、弱い軸の外部連携と90日 pilot。",
  },
  {
    slug: "field-toolkit",
    title: "実践ツールキット — 明日の面談から使う道具",
    summary: "初回面談の問いから機関の九十日 pilot まで、本書各章の考え方を現場の紙に落とした七つの道具集。いつ使うか・道具本体・注意の順で参照できる。",
  },
  {
    slug: "ethics-and-authorship",
    title: "著者性・利害・倫理 — この本はどこから語っているのか",
    summary: "出版時に問われる著者の立場、利害関係、匿名化実例、当事者経験の扱い、評価バイアス、研究者の主導権、執筆責任への批判を巻末で正面から扱う補論。",
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
