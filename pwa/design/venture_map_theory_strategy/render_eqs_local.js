// 完全ローカルで LaTeX → PDF → PNG を生成
// tectonic (LaTeX engine) + Swift PDFKit (rasterize)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HERE = __dirname;
const TEX_DIR = path.join(HERE, 'tex');
const OUT_DIR = path.join(HERE, 'eqs');
const TECTONIC = `${process.env.HOME}/.local/bin/tectonic`;
const SWIFT_SCRIPT = path.join(HERE, 'pdf2png.swift');
const DPI = 300;

fs.mkdirSync(TEX_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const PREAMBLE = `\\documentclass[border=4pt,varwidth]{standalone}
\\usepackage{amsmath,amssymb}
\\usepackage{xcolor}
\\definecolor{myc}{HTML}{4A4A4A}
\\begin{document}
\\color{myc}
`;

function render(name, latex) {
  const texPath = path.join(TEX_DIR, name + '.tex');
  const pdfPath = path.join(TEX_DIR, name + '.pdf');
  const pngPath = path.join(OUT_DIR, name + '.png');

  fs.writeFileSync(texPath, PREAMBLE + '$' + latex + '$\n\\end{document}\n');

  // Compile via tectonic
  execSync(`${TECTONIC} -X compile --outdir ${TEX_DIR} ${texPath}`, { stdio: 'pipe' });
  if (!fs.existsSync(pdfPath)) throw new Error(`PDF not generated for ${name}`);

  // Rasterize via Swift PDFKit
  const dim = execSync(`swift ${SWIFT_SCRIPT} ${pdfPath} ${pngPath} ${DPI}`, { encoding: 'utf8' }).trim();
  console.log(`✓ ${name}: ${dim}`);
}

const eqs = [
  // === 数式①: マクロトレンド指数 ===
  ['eq1',
    'M_i(t) \\;=\\; \\alpha_i \\int_{t-\\tau}^{t} P_i(s)\\, e^{-\\lambda_i(t-s)}\\, ds + \\beta_i\\, B_i(t) + \\gamma_i\\, V_i(t) + \\delta_i\\, R_i(t)'],

  // === 数式②: 事業化適温度 ===
  ['eq2',
    'T_i(t) \\;=\\; M_i(t) \\cdot S_i^{\\kappa} \\cdot \\bigl(1 - C_i(t)\\bigr)^{\\eta_i}'],

  // === 数式③ a: 一階微分 D ===
  ['eq3a',
    'D_i(t) \\;=\\; \\frac{dN_i}{dt} - \\frac{dM_i}{dt}'],

  // === 数式③ b: 二階微分 D' ===
  ['eq3b',
    "D^{\\,\\prime}_i(t) \\;=\\; \\frac{d^{2} N_i}{dt^{2}} - \\frac{d^{2} M_i}{dt^{2}}"],

  // === 数式④: 投入シグナル σ_SU ===
  ['eq4',
    '\\sigma_{\\mathrm{SU}} \\;=\\; \\frac{1}{\\Delta t} \\int_{t_0 - \\Delta t}^{t_0} T_i(s)\\, ds + \\mu \\cdot \\left.\\frac{d^{2} M_i}{dt^{2}}\\right|_{t_0}'],

  // === 合成確率モデル ===
  ['eq_composite',
    '\\Pr(\\mathrm{launch},\\, t) \\;=\\; \\sigma_{\\mathrm{SU}}(t) \\,\\cdot\\, A_{\\mathrm{CEO}}(t) \\,\\cdot\\, A_{\\mathrm{seed}}(t)'],

  // === 一行 (Slide 2 用、D と D′ を並べる) ===
  ['eq3_combined',
    "D_i(t) = \\frac{dN_i}{dt} - \\frac{dM_i}{dt} \\qquad D^{\\,\\prime}_i(t) = \\frac{d^{2} N_i}{dt^{2}} - \\frac{d^{2} M_i}{dt^{2}}"],

  // ============================================================
  // === v0.2 改訂版 (批判 18 点を反映) ===
  // ============================================================

  // === 改訂式①: マクロトレンド指数 (1.1〜1.4 反映) ===
  // - 1.1 各変数に独立ラグ・指数減衰
  // - 1.2 P/B/V/R すべてに減衰積分
  // - 1.3 シグモイドで閾値・飽和効果
  // - 1.4 レーン間相互作用項
  ['eq1_v2',
    'M_i(t) \\;=\\; \\sigma\\!\\left( \\sum_{X \\in \\{P,B,V,R\\}} \\int_{t-\\tau}^{t} w_i^{X}\\, X_i(s)\\, e^{-\\lambda_i^{X}(t-s)}\\, ds \\;+\\; \\sum_{j \\neq i} \\omega_{ij}\\, M_j(t - \\tau_{ij}) \\right)'],

  // === 改訂式②: 事業化期待値 (2.1〜2.4 反映) ===
  // - 2.1 S(t) を時間関数化
  // - 2.2 全項を [0,1] に正規化
  // - 2.3 同質競合度 d_i 導入
  // - 2.4 「適温度」→「事業化期待値」に概念定義し直し
  ['eq2_v2',
    '\\mathbb{E}[\\text{launch}_i](t) \\;=\\; M_i(t) \\cdot S_i(t)^{\\kappa} \\cdot \\bigl(1 - d_i\\, C_i(t)\\bigr)^{\\eta_i}'],

  // === 改訂式③: 論文-政策乖離 (3.1〜3.4 反映) ===
  // - 3.1 対数微分 (相対成長率) で単位整合
  // - 3.2 スムージング (~) を明示
  // - 3.3 論文の質 q_i, 政策コミット強度 c_i で加重
  // - 3.4 役割分担: D′ 極大 = 先行指標
  ['eq3_v2',
    "D_i(t) \\;=\\; q_i(t)\\, \\frac{d \\log \\tilde{N}_i}{dt} \\;-\\; c_i(t)\\, \\frac{d \\log \\tilde{M}_i}{dt}"],

  // === 改訂式④: 投入シグナル (4.1〜4.4 反映) ===
  // - 4.1 各項を正規化 (* で typical scale)
  // - 4.2 Δt_i レーン依存
  // - 4.3 D′ を組み込み (3 軸合成)
  // - 4.4 平均-分散最適化のリスク項
  ['eq4_v2',
    "\\sigma_{\\mathrm{SU},i}(t_0) \\;=\\; \\langle T_i \\rangle_{\\Delta t_i} \\;+\\; \\mu_M \\frac{\\ddot{M}_i|_{t_0}}{\\ddot{M}^{*}_i} \\;+\\; \\mu_D \\frac{D^{\\prime}_i|_{t_0}}{{D^{\\prime}}^{*}_i} \\;-\\; \\rho \\cdot \\mathrm{Var}[T_i]_{\\Delta t_i}"]
];

for (const [name, latex] of eqs) {
  render(name, latex);
}

console.log(`\nAll equations rendered to ${OUT_DIR}`);
