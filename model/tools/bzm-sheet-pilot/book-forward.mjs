// BZM 1.0 本書 第4〜7章の月次の例を再現する、前向き計算の薄い入口。
// 計算本体は作者の参照実装 book-forward-reference.cjs（教科書 §17 の数値の出所。書き換えない）。
// ここは入力の検証、結果の整形、CLI だけを持つ。外部通信・案件データ・API は使わない。
//
// 正本: bookshelf-armada/bzm/bzm-3-0-textbook-verification.md §17.2.2 / §17.3 / §17.5.7
// 出力の ICV は「用途の年額の純増 (P̄u − δu) を 1 とした単位の現在価値」。
// 国内で発生させられる割合 φu は計算に含まれている。換算は純増の年額を 1 回だけ掛け、φu を重ねて掛けない。
// rNPV はこの参照実装に無いので出さない。
//
// CLI:
//   node book-forward.mjs point <型> <規制> [--init JSON | --init-file F] [--dr-max N] [--net-ceiling X]
//   node book-forward.mjs full  <型> <規制> [同上]       （81 点の混合。数秒〜数十秒）
//   node book-forward.mjs diagnose-funds <型> <規制> [--init ...]   （会社化済みの追加調達の診断）
//   node book-forward.mjs benchmark                      （本書の公表値を JSON で出す。計算しない）

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const REF = require("./book-forward-reference.cjs");

export const TYPES = ["F1", "F2", "F3", "F4"];
export const REGS = ["REG0", "REG1", "REG2"];

// 参照実装の 9 区分（確率の合計が 1）。
export const NINE_KEYS = ["indep_in", "indep_out", "lic", "ma", "ips", "pivot", "exit", "liq", "cont"];

// 本書が明示する近似。ここにある項目だけが、この入口の結果に対して支持される前提。
export const SUPPORTED_APPROXIMATIONS = Object.freeze({
  A1: "自由資金と使途制限資金を単一の残高で近似し、充当不能分を控除する",
  A2: "受託契約を、契約なし／12か月の確認前／12か月に満たないと確認済みの3状態で近似する",
  A3: "稼働用途は M4 到達後の解析的な裾で扱う。反復収入自立には裾の qSelf 倍を付ける",
  A4: "権利・承認の残件を残件数だけで持ち、平均の解決率へ畳む",
  A5: "滞留の自動分岐をハザード位置での付加ハザードで近似する",
  A6: "天井を 1 に正規化する。出力は年額の純増 1 円あたりの現在価値",
  A7: "案件パラメータ θ の格子（81 点）による近似。V は有効数字 2 桁で読む",
  A10: "M4 到達で吸収する",
  A20: "月内の和は厳密だが、空席の持続・選別は経路に沿って保持しない",
  A22: "最低の正のグリッド点より小さい残高と会社化前のゼロは、そのグリッド点で代表する",
  A26: "小さい質量を省略するため、9 区分の合計は 1 から最大約 9e-9 ずれる",
});

export const NOT_IMPLEMENTED = Object.freeze([
  "rNPV（この参照実装には無い）",
  "天井の大きさに応じた経済性の乗数 m_θ の再計算（換算では再計算しない）",
  "価格の推定",
]);

const POINT_KEYS = new Set([
  "gate", "cashMan", "rightsOpen", "incorporated", "underContract", "m4Reached", "incRightsMode",
  "drUsed", "uLeft", "burnMan", "burnPostMan", "funcs", "sigma", "e", "kIP", "rMan", "c",
  "quietMonths", "unitMarginPositive", "pNetOku",
]);
const FUNC_KEYS = new Set(["f1Observed", "f2", "f3", "f4", "f5", "f6", "f7"]);
// 国内割合を二重に掛ける入力は受けない。
const FORBIDDEN_KEYS = new Set(["domesticShare", "phiU", "phi_u", "alphaLoc"]);

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ─────────────────────────────────────────────────────────── 検証

export function normalizeType(type) {
  const t = String(type ?? "").toUpperCase();
  if (!TYPES.includes(t)) throw new RangeError(`工程の型は F1〜F4: ${type}`);
  return t;
}

export function normalizeReg(reg) {
  const m = /^(?:REG)?[-_ ]?([0-2])$/i.exec(String(reg ?? "").trim());
  if (!m) throw new RangeError(`規制の属性は REG0〜REG2（REG-0 も可）: ${reg}`);
  return `REG${m[1]}`;
}

function inRange(name, v, lo, hi) {
  if (!isNum(v) || v < lo || v > hi) throw new RangeError(`${name} は ${lo}〜${hi} の有限値: ${v}`);
}

// 入力を検証して、参照実装へ渡す形へ直す。未知のキーと国内割合のキーは拒否する。
export function validateScenario(input) {
  if (input === null || typeof input !== "object") throw new TypeError("入力はオブジェクト");
  const type = normalizeType(input.type);
  const reg = normalizeReg(input.reg);
  const init = input.init === undefined || input.init === null ? {} : input.init;
  if (typeof init !== "object" || Array.isArray(init)) throw new TypeError("init はオブジェクト");
  for (const k of Object.keys(init)) {
    if (FORBIDDEN_KEYS.has(k))
      throw new TypeError(`${k} は渡せない。出力の ICV に国内割合 φu が含まれており、二重に掛かる`);
    if (!POINT_KEYS.has(k)) throw new TypeError(`未知の init キー: ${k}`);
  }
  const seq = REF.gateSequence(type, reg);
  if (init.gate !== undefined && !seq.includes(init.gate))
    throw new RangeError(`未知のゲート ${init.gate}。${type}×${reg} の列: ${seq.join(", ")}`);
  if (init.cashMan !== undefined) inRange("cashMan", init.cashMan, 0, Infinity);
  if (init.rightsOpen !== undefined) {
    if (!Number.isInteger(init.rightsOpen) || init.rightsOpen < 0 || init.rightsOpen > REF.CFG.R0)
      throw new RangeError(`rightsOpen は 0〜${REF.CFG.R0} の整数`);
  }
  for (const k of ["incorporated", "underContract", "m4Reached", "unitMarginPositive"])
    if (init[k] !== undefined && typeof init[k] !== "boolean") throw new TypeError(`${k} は真偽値`);
  if (init.incRightsMode !== undefined && !["none", "all"].includes(init.incRightsMode))
    throw new RangeError("incRightsMode は none または all");
  if (init.drUsed !== undefined) {
    if (!Number.isInteger(init.drUsed) || init.drUsed < 0) throw new RangeError("drUsed は 0 以上の整数");
    if (!init.incorporated) throw new RangeError("drUsed は会社化済みの入力だけが持てる");
  }
  if (init.uLeft !== undefined) inRange("uLeft", init.uLeft, 0, 1);
  for (const k of ["burnMan", "burnPostMan"])
    if (init[k] !== undefined && !(isNum(init[k]) && init[k] > 0)) throw new RangeError(`${k} は正の数`);
  if (init.burnPostMan !== undefined && init.incorporated) throw new RangeError("burnPostMan は会社化前だけが使える");
  if (init.sigma !== undefined && ![-1, 0, 1].includes(init.sigma)) throw new RangeError("sigma は -1, 0, 1");
  if (init.e !== undefined) inRange("e", init.e, 0, 1);
  if (init.kIP !== undefined) inRange("kIP", init.kIP, 0, 1);
  if (init.rMan !== undefined) inRange("rMan", init.rMan, 0, Infinity);
  if (init.c !== undefined && !(isNum(init.c) && init.c > 0)) throw new RangeError("c は正の数");
  if (init.quietMonths !== undefined) inRange("quietMonths", init.quietMonths, 0, Infinity);
  if (init.pNetOku !== undefined && !(isNum(init.pNetOku) && init.pNetOku > 0)) throw new RangeError("pNetOku は正の数");
  if (init.funcs !== undefined) {
    const f = init.funcs;
    if (f === null || typeof f !== "object" || Array.isArray(f)) throw new TypeError("funcs はオブジェクト");
    for (const [k, v] of Object.entries(f)) {
      if (!FUNC_KEYS.has(k)) throw new TypeError(`未知の funcs キー: ${k}`);
      if (k === "f1Observed") {
        if (v !== 0 && v !== 1) throw new RangeError("f1Observed は実働確認に基づく 0 または 1");
      } else inRange(`funcs.${k}`, v, 0, 1);
    }
  }
  return { type, reg, init: clone(init) };
}

function buildCfg(options = {}) {
  const cfg = clone(REF.CFG);
  if (options.drMax !== undefined) {
    if (!Number.isInteger(options.drMax) || options.drMax < 0 || options.drMax > REF.CFG.dr.max)
      throw new RangeError(`drMax は 0〜${REF.CFG.dr.max} の整数`);
    cfg.dr.max = options.drMax;
  }
  return cfg;
}

// ─────────────────────────────────────────────────────────── 結果の整形

const SCALAR_DIAG = ["pivotTransitions", "drAttempt", "drSuccess", "r6BranchMass", "m4AfterRevenueIndependence"];

function pickDiag(diag) {
  const out = {};
  for (const k of SCALAR_DIAG) if (isNum(diag?.[k])) out[k] = diag[k];
  return out;
}

// 9 区分の確率分布を検査する。負、欠落、合計が 1 から外れるものは例外。
export function validateNineOutcome(nine, tolerance = 1e-6) {
  if (nine === null || typeof nine !== "object") throw new TypeError("9 区分はオブジェクト");
  let sum = 0;
  for (const k of NINE_KEYS) {
    const v = nine[k];
    if (!isNum(v)) throw new TypeError(`9 区分の ${k} が数値でない`);
    if (v < -1e-9) throw new RangeError(`9 区分の ${k} が負: ${v}`);
    sum += v;
  }
  if (Math.abs(sum - 1) > tolerance) throw new RangeError(`9 区分の合計が 1 でない: ${sum}`);
  const indep = nine.indep_in + nine.indep_out;
  return {
    sum,
    // 国内に付加価値が生まれうる 4 区分（量産契約到達または反復収入自立／ライセンス／知財売却／買収）
    domesticValueClasses: { indep, lic: nine.lic, ips: nine.ips, ma: nine.ma, total: indep + nine.lic + nine.ips + nine.ma },
  };
}

function formatResult(res, scenario, cfg, kind) {
  const nine = {};
  for (const k of NINE_KEYS) nine[k] = res.nineOutcome[k] ?? 0;
  const check = validateNineOutcome(nine);
  const phiU = domesticShareIncluded(scenario.init.kIP ?? cfg.kIP);
  const out = {
    kind,
    type: scenario.type,
    reg: scenario.reg,
    init: scenario.init,
    drMax: cfg.dr.max,
    unit: "用途の年額の純増 (P̄u − δu) 1 円あたりの現在価値（国内割合 φu 込み）",
    domesticShareIncluded: phiU,
    nineOutcome: nine,
    nineSum: check.sum,
    domesticValueClasses: check.domesticValueClasses,
    pM4: res.pM4 ?? res.m4mass,
    m4MeanMonthsGivenReached: res.m4mean ?? null,
    terminalValueRatioReference: res.cRatio ?? null,
    diag: pickDiag(res.diag),
    notImplemented: NOT_IMPLEMENTED,
  };
  if (kind === "point") {
    out.icv = res.v;
  } else {
    // 平均と分位点は別の量。V の中心値は平均で、v10/v50/v90 は 81 点の混合の分位点。
    out.icvMean = res.v;
    out.icvQuantiles = { q10: res.v10, q50: res.v50, q90: res.v90 };
  }
  return out;
}

export function domesticShareIncluded(kIP = REF.CFG.kIP) {
  return REF.CFG.phiU0 + REF.CFG.phiU1 * kIP;
}

// ─────────────────────────────────────────────────────────── 計算

// 代表 1 点（c=1, ψ=段階0の中央値 0.45, σ=0, e=0.5, r=0.75 r_base）。§17.2 / §17.5 の条件。
export function computePoint(input, options = {}) {
  const sc = validateScenario(input);
  const cfg = buildCfg(options);
  const { type, reg, init } = sc;
  const cfgL = init.kIP !== undefined ? Object.assign(clone(cfg), { kIP: init.kIP }) : cfg;
  let psiStage = 0;
  if (init.m4Reached === true) psiStage = 6;
  else if (init.gate !== undefined) {
    const B = REF.buildPositions(type, reg, cfgL);
    psiStage = B.stageAt[B.gateStart[B.seq.indexOf(init.gate)]];
  }
  const psi = cfgL.psiByStage[Math.min(cfgL.psiByStage.length - 1, psiStage)];
  const rBase = init.rMan !== undefined ? init.rMan : cfgL.rDef[type];
  const theta = {
    c: init.c ?? 1.0,
    psi,
    sigma: init.sigma ?? 0,
    e: init.e ?? cfgL.eMed,
    r: rBase * (1 - cfgL.rZeroProb),
  };
  const res = REF.runOneClassified(type, reg, cfgL, theta, init);
  return formatResult(res, sc, cfgL, "point");
}

// 案件パラメータ θ の 81 点の混合。数秒〜数十秒かかる。
export function computeFull(input, options = {}) {
  const sc = validateScenario(input);
  const cfg = buildCfg(options);
  const res = REF.runTheta(sc.type, sc.reg, cfg, sc.init);
  return formatResult(res, sc, cfg, "full");
}

// 年額の純増（円など、使う単位のまま）を 1 回だけ掛ける。φu は出力に含まれるので掛けない。
export function toYen(icv, netCeilingAnnual) {
  if (!isNum(icv)) throw new TypeError("icv は有限の数値");
  if (!(isNum(netCeilingAnnual) && netCeilingAnnual > 0)) throw new RangeError("年額の純増は正の有限値");
  return icv * netCeilingAnnual;
}

// 会社化済みの案件の追加調達（第7章 7.3.7 項）の診断。既定（最大 2 回）と 0 回の代表 1 点を比べる。
export function diagnoseAdditionalFunds(input, options = {}) {
  const sc = validateScenario(input);
  if (!sc.init.incorporated) throw new RangeError("追加調達の診断は会社化済み（init.incorporated）の入力だけ");
  const withDr = computePoint(sc, { ...options, drMax: options.drMax ?? REF.CFG.dr.max });
  const noDr = computePoint({ ...sc, init: { ...sc.init, drUsed: undefined } }, { ...options, drMax: 0 });
  return {
    type: sc.type,
    reg: sc.reg,
    icvWithAdditionalFunds: withDr.icv,
    icvWithoutAdditionalFunds: noDr.icv,
    ratioWithoutOverWith: withDr.icv > 0 ? noDr.icv / withDr.icv : null,
    drMax: withDr.drMax,
    drAttempt: withDr.diag.drAttempt ?? 0,
    drSuccess: withDr.diag.drSuccess ?? 0,
  };
}

// ─────────────────────────────────────────────────────────── 本書の公表値（計算しない）

export const BENCHMARKS = Object.freeze({
  source: "bzm-3-0-textbook-verification.md §17.2.2 / §17.3.1 / §17.5.7（book d980da7 v1.2.3）",
  tolerance: { point: 1e-4, quantile: 6e-4, probabilityPoints: 0.06 },
  // 代表 1 点（会社化前、段階0。§17.2.2 採用刻み 1/2）
  point: [
    { type: "F1", reg: "REG0", icv: 2.8232 },
    { type: "F2", reg: "REG0", icv: 3.1169 },
    { type: "F3", reg: "REG0", icv: 4.2184 },
    { type: "F4", reg: "REG0", icv: 4.3656 },
    { type: "F1", reg: "REG2", icv: 1.2036 },
  ],
  // 会社化済みの開始状態（§17.5.7）。withDr は既定の追加調達、noDr は回数の上限 0
  additionalFunds: [
    { type: "F1", reg: "REG0", withDr: 0.7384, noDr: 0.3210 },
    { type: "F3", reg: "REG0", withDr: 2.2202, noDr: 1.3585 },
    { type: "F1", reg: "REG2", withDr: 0.4681, noDr: 0.2563 },
  ],
  // 81 点の混合（§17.3.1）。pM4 と m4Mean は到達に条件づけた月数。q は分位点で、平均ではない
  full: [
    { type: "F1", reg: "REG0", pM4: 0.331, m4Mean: 124, q10: 1.563, q50: 2.776, q90: 3.708 },
    { type: "F1", reg: "REG1", pM4: 0.265, m4Mean: 135, q10: 1.307, q50: 2.426, q90: 3.294 },
    { type: "F1", reg: "REG2", pM4: 0.0, m4Mean: 205, q10: 0.717, q50: 1.132, q90: 1.546 },
    { type: "F2", reg: "REG0", pM4: 0.364, m4Mean: 115, q10: 1.899, q50: 3.078, q90: 3.952 },
    { type: "F2", reg: "REG1", pM4: 0.294, m4Mean: 127, q10: 1.600, q50: 2.706, q90: 3.515 },
    { type: "F2", reg: "REG2", pM4: 0.042, m4Mean: 149, q10: 1.340, q50: 1.940, q90: 2.442 },
    { type: "F3", reg: "REG0", pM4: 0.487, m4Mean: 72, q10: 3.206, q50: 4.213, q90: 4.915 },
    { type: "F3", reg: "REG1", pM4: 0.393, m4Mean: 85, q10: 2.681, q50: 3.642, q90: 4.311 },
    { type: "F3", reg: "REG2", pM4: 0.139, m4Mean: 96, q10: 2.463, q50: 3.107, q90: 3.589 },
    { type: "F4", reg: "REG0", pM4: 0.510, m4Mean: 69, q10: 3.465, q50: 4.407, q90: 5.163 },
    { type: "F4", reg: "REG1", pM4: 0.412, m4Mean: 83, q10: 2.938, q50: 3.829, q90: 4.541 },
    { type: "F4", reg: "REG2", pM4: 0.157, m4Mean: 95, q10: 2.599, q50: 3.220, q90: 3.835 },
  ],
});

// ─────────────────────────────────────────────────────────── CLI

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith("--")) throw new TypeError(`--${key} に値が必要`);
      flags[key] = val;
      i++;
    } else pos.push(a);
  }
  return { pos, flags };
}

function scenarioFromArgs({ pos, flags }) {
  if (pos.length < 3) throw new TypeError("型と規制が必要。例: point F1 REG0");
  let init = {};
  if (flags.init !== undefined && flags["init-file"] !== undefined) throw new TypeError("--init と --init-file は同時に指定できない");
  if (flags.init !== undefined) init = JSON.parse(flags.init);
  if (flags["init-file"] !== undefined) init = JSON.parse(readFileSync(flags["init-file"], "utf8"));
  return { type: pos[1], reg: pos[2], init };
}

function optionsFromFlags(flags) {
  const options = {};
  if (flags["dr-max"] !== undefined) options.drMax = Number(flags["dr-max"]);
  return options;
}

export function runCli(argv, write = (s) => process.stdout.write(s)) {
  const args = parseArgs(argv);
  const cmd = args.pos[0];
  const options = optionsFromFlags(args.flags);
  let out;
  if (cmd === "benchmark") out = BENCHMARKS;
  else if (cmd === "point" || cmd === "full" || cmd === "diagnose-funds") {
    const sc = scenarioFromArgs(args);
    if (cmd === "diagnose-funds") out = diagnoseAdditionalFunds(sc, options);
    else {
      out = cmd === "point" ? computePoint(sc, options) : computeFull(sc, options);
      if (args.flags["net-ceiling"] !== undefined) {
        const ceiling = Number(args.flags["net-ceiling"]);
        const v = cmd === "point" ? out.icv : out.icvMean;
        out.converted = { netCeilingAnnual: ceiling, fromIcv: cmd === "point" ? "icv" : "icvMean", value: toYen(v, ceiling) };
        if (cmd === "full")
          out.converted.quantiles = Object.fromEntries(Object.entries(out.icvQuantiles).map(([k, x]) => [k, toYen(x, ceiling)]));
      }
    }
  } else throw new TypeError("コマンドは point / full / diagnose-funds / benchmark");
  write(JSON.stringify(out, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`エラー: ${e.message}\n`);
    process.exitCode = 1;
  }
}
