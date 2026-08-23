import {
  extractSymbolTables,
  findCanonSentence,
  parseCanonSections,
  symbolKey,
  takeParagraphs,
  type CanonSection,
} from "@/lib/model-formula-extract";
import { readModelCanonFile } from "@/lib/model-canon-source";
import { headingAnchorId } from "@/lib/heading-anchor";

/**
 * `/model/formulas` — BZM 2.2 の「現行の式」一覧のデータ層。
 *
 * 【この画面が何を解いているか】
 * 現行の式は正本 `bzm/bzm-2-2-strategic-slack-and-propulsion.md`（1579行）の中に、
 * 論証・監査・批判・演習と混ざって置かれている。「いまの式はどれか」を知りたいとき、
 * 章を通読して数式を拾い直すしかなかった。ここはその拾い直しを固定する。
 *
 * 【式を書き写さない理由】
 * TeX をこのファイルへ複製すると、`model/LOCK.json` で sha256 凍結した正本と画面が
 * 別々に動きうる。model/README.md (e) が禁じている二重管理そのものになるので、
 * ここが持つのは「正本のどの見出しの、何番目の数式か」というポインタだけにする。
 * TeX と記号の説明は毎回 md から読む。正本が変われば画面も変わる。
 *
 * 【ずれたら気づける仕組み】
 * 各ポインタは `expect`（抽出結果に必ず含まれる TeX 断片）を持つ。見出しの改名や
 * 式の並べ替えでポインタが別の式を指したら `resolved: false` になり、画面は
 * 欠落を明示し、`npm run test:model-formula-canon` が落ちる。黙って別の式を出さない。
 */

/**
 * 画面が式と記号を読み出す正本文書。
 *
 * まさ確定 2026-08-23「正本は UI 上のものを指してる。UI 上にないとだめ」。
 * モデルを構成する式と記号は、どれか一つの文書に閉じず複数の正本に分かれているので、
 * 画面はそのすべてから読み出して1枚に並べる。「文書を開けば書いてある」は正本ではない。
 */
export const CANON_DOCS = {
  bzm22: {
    root: "bzm" as const,
    slug: "bzm-2-2-strategic-slack-and-propulsion",
    file: "bzm-2-2-strategic-slack-and-propulsion.md",
    title: "BZM 2.2 — 戦略余力と推進力の動学",
  },
  ledger: {
    root: "model" as const,
    slug: "MODEL_VERSION_LEDGER",
    file: "MODEL_VERSION_LEDGER.md",
    title: "版数台帳",
  },
  reach: {
    root: "bzm" as const,
    slug: "sps-current-reachability-model",
    file: "sps-current-reachability-model.md",
    title: "到達見込みモデル — 資金の崖が締切を作る",
  },
  bzm21: {
    root: "bzm" as const,
    slug: "bzm-2-1-dynamic-business-value-model",
    file: "bzm-2-1-dynamic-business-value-model.md",
    title: "BZM 2.1 — 動的な事業価値モデル",
  },
} as const;

export type CanonDocKey = keyof typeof CANON_DOCS;

export const BZM_2_2_CANON_SLUG = CANON_DOCS.bzm22.slug;

export interface FormulaPointer {
  /** ページ内アンカー。 */
  id: string;
  /** どの正本文書から読むか。省略時は BZM 2.2 の正本。 */
  doc?: CanonDocKey;
  /** 表示名。正本の見出し・本文の呼び方に合わせる（新しい命名をしない）。 */
  label: string;
  /** 正本 md の見出しテキスト（`##` / `###` を外したもの）と完全一致させる。 */
  section: string;
  /** その見出しの中で何番目の数式グループか（1始まり）。 */
  group: number;
  /** 抽出した TeX に必ず含まれる断片。取り違えの検出用。 */
  expect: string[];
  /** 導入文として残す段落数（末尾から）。既定1。 */
  lead?: number;
  /** 定義・注意として残す段落数（先頭から）。既定2。 */
  tail?: number;
}

/**
 * 層の導入文を、正本のどの一文から引くかを指すポインタ。
 *
 * ここを「画面用に書いた要約」にすると、正本より強い主張や正本にない限定が
 * 静かに混ざる。実際に一度混ぜた（$Q$ と $S$ についての「未校正」「画面用の射影」を
 * $J$・$P$ まで広げて書いた、2026-08-23 まさ指摘）。
 * それ以降、層の導入文はモデルについて画面が言うのをやめ、正本の一文をそのまま引く。
 */
export interface LayerQuote {
  /** どの正本文書から引くか。省略時は層の既定文書。 */
  doc?: CanonDocKey;
  /** 正本 md の見出しテキスト（`##` / `###` を外したもの）。 */
  section: string;
  /** 引きたい一文に必ず含まれる文字列。ここから文全体を復元する。 */
  match: string;
}

export interface FormulaLayer {
  key: string;
  /** この層の式が載っている既定の正本文書。 */
  doc?: CanonDocKey;
  /** 層の名前。見出しであって、モデルについて何も主張しない。 */
  title: string;
  /** その層が何を決めているかを述べた、正本の一文への参照。 */
  quote: LayerQuote;
  entries: FormulaPointer[];
}

/**
 * 現行 BZM 2.2 の式の並び。正本の §4→§5→§6→§7→§9→§15/§16 の順をそのまま層にした。
 * 層の見出し (title) は道案内のラベルで、モデルについて何も主張しない。
 * その層が何を決めているかを述べる文は、画面で書かずに正本の一文を quote で引く。
 */
export const MODEL_FORMULA_LAYERS: FormulaLayer[] = [
  {
    key: "output",
    title: "0. 出力 — 一次選別に使う SPS",
    doc: "ledger",
    quote: { section: "2. 現行の式と記号", match: "価値実現経路ごとの到達確率と条件付き価値の積" },
    entries: [
      {
        id: "sps-full",
        label: "SPS（正式・全経路の和）",
        doc: "ledger",
        section: "2. 現行の式と記号",
        group: 1,
        expect: ["\\mathrm{SPS}=\\sum_{o\\in\\mathcal O}", "P^{\\mathrm{ind}}_o"],
        tail: 2,
      },
      {
        id: "sps-tier0",
        label: "SPS（Tier 0 の単一経路への縮退形）",
        doc: "ledger",
        section: "2. 現行の式と記号",
        group: 2,
        expect: ["\\mathrm{SPS}=P^{\\mathrm{ind}}\\times"],
        tail: 1,
      },
    ],
  },
  {
    key: "reach",
    title: "0-b. 到達見込み q（BZM 2.0）",
    doc: "ledger",
    quote: { section: "q — 到達見込み", match: "計画期限内かつ戦略余力を失う前に資本自立へ着く確率" },
    entries: [
      {
        id: "q-plan",
        label: "計画達成診断 q",
        doc: "ledger",
        section: "q — 到達見込み",
        group: 1,
        expect: ["q_{\\mathrm{plan},\\tau}(H_v)", "T_C<T_Y"],
        tail: 2,
      },
      {
        id: "q-self",
        label: "資本自立の到達目標（二条件）",
        doc: "ledger",
        section: "q — 到達見込み",
        group: 2,
        expect: ["R_{\\mathrm{rep}}", "E_{\\mathrm{req}}"],
        tail: 2,
      },
      {
        id: "q-horizon",
        label: "共通期間比較と評価地平",
        doc: "ledger",
        section: "H_econ — 共通経済評価地平",
        group: 2,
        expect: ["Q_\\tau(h)"],
        lead: 1,
        tail: 2,
      },
    ],
  },
  {
    key: "state",
    title: "1. 状態",
    quote: { section: "八層状態は資源の棚卸しではない", match: "八つの型へ分けて保持する" },
    entries: [
      {
        id: "state-eight-layer",
        label: "八層状態",
        section: "4. 2.2の状態",
        group: 1,
        expect: ["\\mathbf s_t", "\\boldsymbol\\ell_t", "\\widehat{\\mathbf c}_t"],
        tail: 2,
      },
      {
        id: "state-belief",
        label: "未確定事象への信念",
        section: "能力と信念の識別境界",
        group: 1,
        expect: ["\\mathbf b_t", "\\Pr^{\\mathbb P}(\\theta\\mid\\mathcal I_t)"],
        tail: 1,
      },
    ],
  },
  {
    key: "action",
    title: "2. 行動と制約",
    quote: { section: "5. 行動ごとの制約を置く", match: "投入する現金、工数、設備、権利の束" },
    entries: [
      {
        id: "action-control",
        label: "制御（行動と投入束）",
        section: "5. 行動ごとの制約を置く",
        group: 1,
        expect: ["\\mathbf z_t=(a_t,\\mathbf i_t)", "\\mathcal Z_t^{\\mathrm{reg}}"],
        tail: 1,
      },
      {
        id: "action-sigma",
        label: "制約の三値",
        section: "5. 行動ごとの制約を置く",
        group: 2,
        expect: ["\\sigma_j(\\mathbf s_t,\\mathbf z)", "\\mathrm{unknown}"],
        tail: 1,
      },
      {
        id: "action-g",
        label: "数量・時間で測れる制約",
        section: "5. 行動ごとの制約を置く",
        group: 3,
        expect: ["g_j(\\mathbf s_t,\\mathbf z)\\le 0"],
        tail: 1,
      },
      {
        id: "action-gamma-exec",
        label: "確認済み実行可能集合",
        section: "5. 行動ごとの制約を置く",
        group: 4,
        expect: ["\\Gamma_{\\mathrm{exec}}^{\\mathrm{reg}}", "\\sigma_j(\\mathbf s_t,\\mathbf z)=\\mathrm{met}"],
        tail: 1,
      },
      {
        id: "action-gamma-open",
        label: "未確認だけが残る集合",
        section: "5. 行動ごとの制約を置く",
        group: 5,
        expect: ["\\Gamma_{\\mathrm{open}}^{\\mathrm{reg}}"],
        tail: 3,
      },
      {
        id: "action-margin",
        label: "数量制約の余裕",
        section: "制約の型",
        group: 1,
        expect: ["m_j(\\mathbf s_t,\\mathbf z)=-g_j(\\mathbf s_t,\\mathbf z)"],
        tail: 1,
      },
      {
        id: "action-portfolio",
        label: "複数PJの共同実行可能集合",
        section: "複数PJの共有資源",
        group: 1,
        expect: ["\\Gamma_{\\mathrm{portfolio}}^{\\mathrm{reg}}"],
        tail: 2,
      },
    ],
  },
  {
    key: "transition",
    title: "3. 遷移と推進力",
    quote: { section: "16. OS画面を使って式を読む", match: "同じ支出を「費用」と「能力向上の価値」として二度足すことがない" },
    entries: [
      {
        id: "transition-kernel",
        label: "状態遷移と所要時間",
        section: "6. 支出は負のまま、状態変化を価値へ入れる",
        group: 1,
        expect: ["\\mathbb P^{\\mathrm{stress}}_{\\delta}", "\\Delta t_{k+1}"],
        tail: 3,
      },
      {
        id: "transition-marginal",
        label: "限界投資価値",
        section: "6. 支出は負のまま、状態変化を価値へ入れる",
        group: 2,
        expect: ["\\Delta J_{u_d}"],
        lead: 2,
        tail: 2,
      },
    ],
  },
  {
    key: "slack",
    title: "4. 戦略余力",
    quote: { section: "2.2で改めるもの", match: "固定成分の合計または最小時計としない" },
    entries: [
      {
        id: "slack-tau",
        label: "目標到達時間と許容不能状態への到達時間",
        section: "7. 戦略余力は目標到達経路の壊れにくさである",
        group: 1,
        expect: ["\\tau_{\\mathcal T}^{\\pi}", "\\tau_{\\mathcal F}^{\\pi}"],
        tail: 3,
      },
      {
        id: "slack-qrob",
        label: "頑健到達見込み",
        section: "ショックと方針の情報順序",
        group: 1,
        expect: ["q_{\\mathrm{rob}}^{-}(\\mathbf s,h;\\Delta)", "\\Pi_d^{\\mathrm{reg,NA}}"],
        lead: 2,
        tail: 3,
      },
      {
        id: "slack-capture",
        label: "頑健捕捉領域",
        section: "頑健捕捉領域",
        group: 1,
        expect: ["\\mathcal K_{\\mathcal T}^{-}(\\alpha,h;\\Delta)"],
        tail: 2,
      },
      {
        id: "slack-ty",
        label: "戦略余力喪失時間 T_Y（2.2版）",
        section: "2.2の$T_Y$",
        group: 1,
        expect: ["T_Y^{2.2,\\pi_d^*}", "\\mathcal H_{\\mathrm{dec}}^{\\pi_d^*}"],
        tail: 3,
      },
      {
        id: "slack-rho-monotone",
        label: "ショック集合の単調性",
        section: "ショック別の許容量",
        group: 1,
        expect: ["\\Delta_{\\ell}(\\rho_1)\\subseteq\\Delta_{\\ell}(\\rho_2)"],
        tail: 1,
      },
      {
        id: "slack-rho",
        label: "ショック別の許容量",
        section: "ショック別の許容量",
        group: 2,
        expect: ["\\rho_{\\ell}^{*}(\\mathbf s_t)"],
        tail: 3,
      },
      {
        id: "slack-theta",
        label: "評価契約",
        section: "評価契約を凍結する",
        group: 1,
        expect: ["\\Theta_v", "\\mathbf q^{\\mathrm{alloc}}"],
        tail: 2,
      },
    ],
  },
  {
    key: "value",
    title: "5. 価値評価（BZM 2.1へ接続）",
    quote: { section: "9. 2.1の価値評価へ接続する", match: "2.2は価値式を別物へ置き換えない" },
    entries: [
      {
        id: "value-terminal",
        label: "終端の境界条件",
        section: "9. 2.1の価値評価へ接続する",
        group: 1,
        expect: ["RV_r(\\zeta)", "RV_{u_d}(\\zeta)"],
        lead: 2,
        tail: 1,
      },
      {
        id: "value-action",
        label: "行動価値",
        section: "9. 2.1の価値評価へ接続する",
        group: 2,
        expect: ["J_{u_d}^*(\\mathbf s,\\mathbf z)", "CF_{u_d}^{\\mathrm{PV}}"],
        tail: 2,
      },
      {
        id: "value-optimal",
        label: "最適値と方針",
        section: "9. 2.1の価値評価へ接続する",
        group: 3,
        expect: ["V_{u_d}^*(\\mathbf s)", "\\pi_d^*(\\mathbf s)", "\\arg\\max"],
        lead: 2,
        tail: 1,
      },
      {
        id: "value-forced",
        label: "実行可能集合が空のとき",
        section: "9. 2.1の価値評価へ接続する",
        group: 4,
        expect: ["\\zeta_{\\mathrm{forced}}(\\mathbf s)", "is undefined"],
        tail: 1,
      },
      {
        id: "value-perspective",
        label: "評価視点別の再評価",
        section: "9. 2.1の価値評価へ接続する",
        group: 5,
        expect: ["V_r^{\\pi_d^*}(\\mathbf s)", "C_r^{\\mathrm{now}}"],
        tail: 3,
      },
    ],
  },
  {
    key: "pilot",
    title: "6. pilot画面の四記号（表示契約）",
    // 正本が「未校正」「画面用の射影」と限定しているのは Q と S だけである（§15、
    // 台帳 #bzm-q「現pilotでは未校正であり、確率と呼ばない」、#bzm-s「この S は
    // 戦略余力そのものではない」）。J と P は登録方針の下で計算した現在価値で、
    // 未校正とは書かれていない。4記号すべてへ広げると正本より強い主張になるので広げない。
    quote: { section: "pilot画面の四指標", match: "UI用のpilot記号であり" },
    entries: [
      {
        id: "pilot-discount",
        label: "割引係数と経路生存重み",
        section: "pilot画面の四指標",
        group: 1,
        expect: ["d_t=(1+r_d)^{-t/12}", "W_t(a)=\\prod_{i\\in G:t_i\\le t}p_i(a)"],
        lead: 2,
        tail: 1,
      },
      {
        id: "pilot-j",
        label: "J — 全経路を重みづけした現在価値",
        section: "pilot画面の四指標",
        group: 2,
        expect: ["J_r^{\\pi_{\\mathrm{reg}}}"],
        lead: 0,
        tail: 1,
      },
      {
        id: "pilot-p",
        label: "P — 成功条件付きの現在価値",
        section: "pilot画面の四指標",
        group: 3,
        expect: ["P_{r\\mid G}^{\\pi_{\\mathrm{reg}}}"],
        lead: 0,
        tail: 3,
      },
      {
        id: "pilot-q",
        label: "Q — 基準到達指数",
        section: "pilot画面の四指標",
        group: 5,
        expect: ["Q=\\prod_{i\\in G}p_i"],
        lead: 0,
        tail: 1,
      },
      {
        id: "pilot-s",
        label: "S — 逆風耐久指数",
        section: "pilot画面の四指標",
        group: 6,
        expect: ["S=\\min_{\\delta\\in\\Delta_{\\mathrm{reg}}}\\prod_{i\\in G}(p_i m_{i\\delta})"],
        lead: 0,
        tail: 2,
      },
      {
        id: "pilot-pi",
        label: "gate通過値の条件",
        section: "pilot画面の四指標",
        group: 7,
        expect: ["G_i\\mid G_1,\\ldots,G_{i-1}", "\\mathcal I_{\\tau}"],
        lead: 2,
        tail: 3,
      },
      {
        id: "pilot-branch",
        label: "分岐があるときの価値",
        section: "pilot画面の四指標",
        group: 8,
        expect: ["d_{\\tau}RV(s_{\\tau})"],
        lead: 2,
        tail: 2,
      },
      {
        id: "pilot-complete",
        label: "四記号の完全式",
        section: "$J$、$P$、$Q$、$S$を一つの点数にしない",
        group: 1,
        expect: ["d_HQ\\,TV", "P=\\sum_{t=1}^{H}d_tCF_t+d_HTV", "S=\\min_{\\delta\\in\\Delta_{\\mathrm{reg}}}"],
        tail: 2,
      },
      {
        id: "pilot-jqp",
        label: "J ≠ QP の差",
        section: "なぜ$J\\neq QP$なのか",
        group: 1,
        expect: ["J-QP"],
        lead: 2,
        tail: 2,
      },
    ],
  },
  {
    key: "bzm21",
    title: "7. BZM 2.1 の行動価値（この上の遷移を受け取る側）",
    doc: "ledger",
    quote: { section: "正本間の未解決不整合（まさ判断待ち）— 1.x の9軸", match: "行動 $a$ を一度だけ選び" },
    entries: [
      {
        id: "bzm21-action-value",
        label: "行動価値（2.1）",
        doc: "ledger",
        section: "正本間の未解決不整合（まさ判断待ち）— 1.x の9軸",
        group: 1,
        expect: ["J^{\\pi}_{r,\\tau}(n,a)", "w_{r,\\tau}(n,a,n')"],
        tail: 2,
      },
    ],
  },
  {
    key: "retired",
    title: "8. 退役した式（参照専用・計算に使わない）",
    doc: "ledger",
    quote: { section: "旧9軸の式（退役済み・参照専用）", match: "退役" },
    entries: [
      {
        id: "retired-9axis",
        label: "旧9軸の統合スコア（2026-08-15 退役）",
        doc: "ledger",
        section: "旧9軸の式（退役済み・参照専用）",
        group: 1,
        expect: ["\\text{統合スコア}", "\\prod_{i=1}^{9}"],
        tail: 2,
      },
    ],
  },
];

export interface ResolvedFormula extends FormulaPointer {
  resolved: boolean;
  /** 解決できたときの TeX（正本の並び順のまま）。 */
  tex: string[];
  lead_text: string;
  tail_text: string;
  /** 正本 md の見出し行番号。 */
  source_line: number | null;
  /** 正本ページでその見出しへ跳ぶアンカー。 */
  source_anchor: string;
  /** この式を読み出した正本文書。 */
  source_doc: CanonDocKey;
  /** 解決に失敗した理由（画面と検査で同じ文言を出す）。 */
  problem: string | null;
}

export interface ResolvedLayer extends Omit<FormulaLayer, "entries"> {
  entries: ResolvedFormula[];
  /** 正本から引いた導入の一文。引けなければ null (画面は欠落を出し、検査が落ちる)。 */
  quote_text: string | null;
  /** 引用元の節見出しへ跳ぶアンカー。 */
  quote_anchor: string;
  /** 引用元の正本文書。 */
  quote_doc: CanonDocKey;
}

export interface ModelSymbol {
  /** 記号 (TeX のまま)。 */
  symbol: string;
  /** 正本が書いている意味。画面では言い換えない。 */
  meaning: string;
  /** その説明が載っている正本文書。 */
  doc: CanonDocKey;
  /** 説明が載っている節の見出しと、そこへ跳ぶアンカー。 */
  section: string;
  anchor: string;
  /** 同じ記号を別の正本も説明している場合の、追加の出典。 */
  also: { doc: CanonDocKey; section: string; meaning: string; anchor: string }[];
}

/**
 * すべての正本の記号表を1つの索引へまとめる。
 *
 * 記号の意味は画面側で書かない。正本の `| 記号 | 意味 |` 表をそのまま読む。
 * 同じ記号を複数の正本が説明している場合は、台帳（モデルの入口として作られた文書）を
 * 主にし、残りを「別の正本での説明」として併記する。どちらかを消して1つに丸めない。
 */
function buildSymbolIndex(): ModelSymbol[] {
  const DOC_PRIORITY: CanonDocKey[] = ["ledger", "bzm22", "reach", "bzm21"];
  const merged = new Map<string, ModelSymbol>();

  for (const docKey of DOC_PRIORITY) {
    const doc = CANON_DOCS[docKey];
    const md = readModelCanonFile(doc.root, doc.file);
    if (!md) continue;
    const sections = parseCanonSections(md);
    const anchorOf = (heading: string) => {
      const sec = sections.find((x) => x.heading === heading);
      return sec?.explicitId ?? headingAnchorId(heading);
    };

    for (const row of extractSymbolTables(md)) {
      const key = symbolKey(row.symbol);
      if (!key) continue;
      const anchor = anchorOf(row.section);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, {
          symbol: row.symbol,
          meaning: row.meaning,
          doc: docKey,
          section: row.section,
          anchor,
          also: [],
        });
        continue;
      }
      // 同じ文書内の重複（同じ意味の再掲）は増やさない。
      const dup =
        existing.meaning === row.meaning ||
        existing.also.some((a) => a.meaning === row.meaning);
      if (dup) continue;
      existing.also.push({ doc: docKey, section: row.section, meaning: row.meaning, anchor });
    }
  }

  return Array.from(merged.values());
}

export interface FormulaCanon {
  canon_slug: string;
  canon_path: string;
  layers: ResolvedLayer[];
  /** すべての正本から集めた記号の索引。 */
  symbols: ModelSymbol[];
  /** 解決できなかった式の数。0 でなければ画面上部で警告する。 */
  unresolved: number;
  /** 正本 md に存在するが、この一覧が拾っていない数式グループ。 */
  uncovered: { section: string; group: number; head: string }[];
}

function resolveOne(
  sections: CanonSection[],
  pointer: FormulaPointer,
  docKey: CanonDocKey,
): ResolvedFormula {
  const base: ResolvedFormula = {
    ...pointer,
    resolved: false,
    tex: [],
    lead_text: "",
    tail_text: "",
    source_line: null,
    source_anchor: headingAnchorId(pointer.section),
    source_doc: docKey,
    problem: null,
  };

  const section = sections.find((s) => s.heading === pointer.section);
  if (!section) {
    return { ...base, problem: `正本に見出し「${pointer.section}」が見つかりません` };
  }

  const group = section.groups[pointer.group - 1];
  if (!group) {
    return {
      ...base,
      source_line: section.line,
      problem: `見出し「${pointer.section}」に ${pointer.group} 番目の数式がありません（現在 ${section.groups.length} 個）`,
    };
  }

  const joined = group.tex.join("\n");
  const missing = pointer.expect.filter((fragment) => !joined.includes(fragment));
  if (missing.length > 0) {
    return {
      ...base,
      source_line: section.line,
      problem: `${pointer.group} 番目の数式が想定と違います（見つからない断片: ${missing.join(" / ")}）`,
    };
  }

  return {
    ...base,
    resolved: true,
    source_anchor: section.explicitId ?? headingAnchorId(section.heading),
    tex: group.tex,
    lead_text: takeParagraphs(group.lead, pointer.lead ?? 1, "tail"),
    tail_text: takeParagraphs(group.tail, pointer.tail ?? 2, "head"),
    source_line: section.line,
  };
}

/**
 * 隣り合う式の説明文の重複を消す。
 *
 * 正本は「A を次で表す。$$…$$ 次に B を次で表す。$$…$$」と鎖状に書いてあるので、
 * ある式の直後の地の文が、そのまま次の式の導入文になっていることが多い。
 * そのまま出すと同じ一文が2枚のカードに並ぶ。後ろのカードの導入文を残し、
 * 前のカードの説明文からその分を落とす。
 */
function dedupeAdjacentProse(entries: ResolvedFormula[]): ResolvedFormula[] {
  return entries.map((entry, i) => {
    const nextLead = entries[i + 1]?.lead_text;
    if (!entry.tail_text || !nextLead || !entry.tail_text.includes(nextLead)) return entry;
    const trimmed = entry.tail_text.replace(nextLead, "").trim();
    return { ...entry, tail_text: trimmed };
  });
}

/** 層の引用と同じ一文が先頭カードの導入文にも入っていたら、カード側を落とす。 */
function dropLeadEqualToQuote(
  entries: ResolvedFormula[],
  quote: string | null,
): ResolvedFormula[] {
  if (!quote) return entries;
  return entries.map((entry, i) =>
    i === 0 && entry.lead_text && quote.includes(entry.lead_text)
      ? { ...entry, lead_text: "" }
      : entry,
  );
}

/**
 * 正本 md を読み、層ごとに式を解決して返す。
 * 正本が読めない場合は null（呼び出し側が「正本を読めません」を出す）。
 */
export function loadBzmFormulaCanon(): FormulaCanon | null {
  // すべての正本文書を読み、節へ割っておく。式も記号の説明も、ここから取り出す。
  const parsed = {} as Record<CanonDocKey, CanonSection[] | null>;
  for (const key of Object.keys(CANON_DOCS) as CanonDocKey[]) {
    const doc = CANON_DOCS[key];
    const md = readModelCanonFile(doc.root, doc.file);
    parsed[key] = md ? parseCanonSections(md) : null;
  }
  if (!parsed.bzm22) return null;

  const layers: ResolvedLayer[] = MODEL_FORMULA_LAYERS.map((layer) => {
    const layerDoc: CanonDocKey = layer.doc ?? "bzm22";
    const quoteDoc: CanonDocKey = layer.quote.doc ?? layerDoc;
    const quoteSections = parsed[quoteDoc] ?? [];
    const found = findCanonSentence(quoteSections, layer.quote.section, layer.quote.match);
    const quoteSection = quoteSections.find((sec) => sec.heading === layer.quote.section);
    return {
      ...layer,
      // 層の引用と先頭カードの導入文が同じ一文になることがある (正本の節が
      // その一文で始まっているとき)。同じ文を2回出さない。
      entries: dropLeadEqualToQuote(
        dedupeAdjacentProse(
          layer.entries.map((pointer) => {
            const docKey: CanonDocKey = pointer.doc ?? layerDoc;
            return resolveOne(parsed[docKey] ?? [], pointer, docKey);
          }),
        ),
        found?.text ?? null,
      ),
      quote_text: found?.text ?? null,
      quote_doc: quoteDoc,
      quote_anchor: quoteSection?.explicitId ?? headingAnchorId(layer.quote.section),
    };
  });

  // 未収録の検出は BZM 2.2 の正本に対して行う (現行の式の本体がここにあるため)。
  const covered = new Set(
    MODEL_FORMULA_LAYERS.flatMap((layer) =>
      layer.entries
        .filter((entry) => (entry.doc ?? layer.doc ?? "bzm22") === "bzm22")
        .map((entry) => `${entry.section}#${entry.group}`),
    ),
  );
  const uncovered: FormulaCanon["uncovered"] = [];
  for (const section of parsed.bzm22) {
    section.groups.forEach((group, index) => {
      const key = `${section.heading}#${index + 1}`;
      if (covered.has(key)) return;
      uncovered.push({
        section: section.heading,
        group: index + 1,
        head: group.tex[0].split("\n").join(" ").slice(0, 60),
      });
    });
  }

  return {
    canon_slug: CANON_DOCS.bzm22.slug,
    canon_path: `bzm/${CANON_DOCS.bzm22.file}`,
    layers,
    symbols: buildSymbolIndex(),
    unresolved: layers.reduce(
      (sum, layer) =>
        sum +
        layer.entries.filter((entry) => !entry.resolved).length +
        (layer.quote_text === null ? 1 : 0),
      0,
    ),
    uncovered,
  };
}
