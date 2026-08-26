import { loadCurrentFormulas } from "@/app/(app)/model/current-formulas";

/**
 * BZM 3.0 の式を、モデルページの正本（model/MODEL_VERSION_LEDGER.md）から拾う。
 *
 * 画面が式を書き起こさないための層。正本の $$…$$ をそのまま出し、
 * 「何の式か」と「主な記号の意味」も正本の地の文と記号表から取る
 * （`@/app/(app)/model/current-formulas` が抽出まで済ませている）。
 *
 * ここでやるのは**並べ替えと選別だけ**。シーズ詳細のような小さな面では
 * 正本の19本すべてを出すと読めないので、スコアの筋道に沿って並べ直す。
 * 目印（needle）は式に含まれる文字列で、正本の式が書き換わって見つからなくなった行は
 * 静かに落ちる（画面が古い式を持ち続けるより、出ないほうが安全）。
 */

export interface Bzm30Formula {
  id: string;
  /** TeX 本体（正本の `$$` の中身そのまま） */
  tex: string;
  /** 画面での見出し。何を決めている式か */
  title: string;
  /** 正本の節番号（画面ではモデルページへのリンクに使う） */
  section: string;
  /** モデルページ内のアンカー id */
  anchor: string;
  /** 主な記号の意味（正本の記号表から） */
  symbols: { symbol: string; meaning: string }[];
  /** この式に案件ごとの入力が直接入るか。入るならその入力の名前 */
  seedInputs?: string[];
}

const WANTED: { id: string; needle: string; title: string; section: string; seedInputs?: string[] }[] = [
  {
    id: "score",
    needle: "\\int \\mathbb{E}\\big[\\Pi(\\omega)",
    title: "スコア — 案件が国内に生む付加価値の現在価値（円）",
    section: "§5",
  },
  {
    id: "report",
    needle: "v(\\theta) \\;=\\;",
    title: "報告様式 — 案件パラメータを固定した価値と、その重ね合わせ",
    section: "§5.8",
  },
  {
    id: "value",
    needle: "\\Pi(\\omega) \\;=\\;",
    title: "シナリオの価値 — 実現した月ごとの国内純増を割り引いて足す",
    section: "§5.7",
    seedInputs: ["天井 P̄_u", "置き換え分 δ_u", "前倒し期間 L_u"],
  },
  {
    id: "theta",
    needle: "\\theta = \\big(c,",
    title: "案件パラメータ — 直接は測れず、評価日の証拠から推定する量",
    section: "§5.3",
    seedInputs: ["専有可能性 κ_IP", "産官学モメンタム σ", "工程の型 τ_proc", "自走力 r"],
  },
  {
    id: "state",
    needle: "x_t = \\big(g_t",
    title: "観測状態 — 月ごとに更新する、外から見える状態",
    section: "§5.2",
    seedInputs: ["証拠水準 g_0", "自由資金 s^f_0", "会社化 ι_0", "権利残件 R_0"],
  },
  {
    id: "cash",
    needle: "s^{\\mathrm{f}}_{t+1}",
    title: "資金の遷移 — 残高がゼロに届いた月にシナリオは終わる",
    section: "§5.2",
  },
  {
    id: "adv",
    needle: "p^{\\mathrm{adv}}_t =",
    title: "ステージゲートの前進 — 次のゲートを今月越える確率",
    section: "§5.4",
    seedInputs: ["工程の型 τ_proc（基準速度 κ_g）"],
  },
  {
    id: "kappa",
    needle: "\\kappa_g \\;\\equiv\\;",
    title: "基準速度の変換 — 所要月数を、準備期間と待ち時間の2段に分ける",
    section: "§6.I-1-1",
  },
  {
    id: "eta",
    needle: "\\eta_t = \\prod",
    title: "担い手の充足 — 空席は減点ではなく遅延として効く",
    section: "§5.4",
  },
  {
    id: "award",
    needle: "p^{\\mathrm{award}}_w",
    title: "資金調達の採択 — 採択は補給であって前進ではない",
    section: "§5.4",
  },
  {
    id: "mecon",
    needle: "m_\\theta \\;=\\;",
    title: "経済性の乗数 — 筋がいい案件ほど資金が付く",
    section: "§5.4",
    seedInputs: ["天井 P̄_u", "単位採算 m_u"],
  },
  {
    id: "phi",
    needle: "\\phi = \\mathrm{clip}",
    title: "採択関数の具体形と基準化条件",
    section: "§6.I-4-1",
  },
  {
    id: "offer",
    needle: "p^{\\mathrm{offer}}_{k,t}",
    title: "実現の申し出 — ライセンス・M&A・知財売却の引き合い",
    section: "§5.4",
    seedInputs: ["専有可能性 κ_IP"],
  },
  {
    id: "contract",
    needle: "p^{\\mathrm{offer}}_{c,t}",
    title: "受託の申し出 — 稼ぎが立つ経路と、それが前進を食う度合い",
    section: "§5.4",
    seedInputs: ["自走力 r"],
  },
  {
    id: "rights",
    needle: "p^{\\mathrm{res}}_{i,t}",
    title: "権利・承認の解決 — 未解決の残件は前進と会社化を塞ぐ",
    section: "§5.4",
  },
  {
    id: "exitpaths",
    needle: "\\pi^{\\mathrm{use}}",
    title: "撤退の四経路 — 自走が続かなくなっても単一の終端に落ちない",
    section: "§5.7-2",
  },
  {
    id: "continuation",
    needle: "C(x_T, \\theta)",
    title: "継続価値 — 評価期間の先に残る分",
    section: "§6.E-3",
  },
];

export function loadBzm30Formulas(): Bzm30Formula[] {
  // シーズ詳細では記号の意味を切り詰めない（/model の一覧は行が高くなるので30字で切っている）。
  const all = loadCurrentFormulas({ meaningMaxLen: 400 });
  const out: Bzm30Formula[] = [];
  const used = new Set<number>();

  for (const want of WANTED) {
    const hit = all.find((f, i) => !used.has(i) && f.tex.includes(want.needle));
    if (!hit) continue;
    used.add(all.indexOf(hit));
    out.push({
      id: want.id,
      tex: hit.tex,
      title: want.title,
      section: want.section,
      anchor: hit.anchor,
      symbols: hit.symbols,
      seedInputs: want.seedInputs,
    });
  }
  return out;
}
