// BZM 1.0 本書 §3 と §18.6.7 の有界分布。
// 各推定者の分布: (a,0),(q10,.1),(q50,.5),(q90,.9),(b,1) を結ぶ区分線形の累積分布。
// 同じ値の節は、その点の確率質量（右連続）。2名の再推定後の分布は等重み混合。
// 分位点は下側分位点 inf{x : F(x) >= p}。端 a, b は入力で必須。創作しない。
// すべての戻り値は JSON にそのまま直せる素のデータ。

const LEVELS = [0, 0.1, 0.5, 0.9, 1];
const EPS = 1e-12;

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function checkDomain(domain) {
  const d = domain ?? {};
  for (const k of ["min", "max"]) {
    if (d[k] !== undefined && d[k] !== null && !isNum(d[k])) {
      throw new TypeError(`domain.${k} は有限の数値で指定してください`);
    }
  }
  const min = isNum(d.min) ? d.min : null;
  const max = isNum(d.max) ? d.max : null;
  if (min !== null && max !== null && min > max) {
    throw new RangeError("domain.min が domain.max を超えています");
  }
  return { min, max };
}

function knotsOf(o) {
  return [
    [o.a, LEVELS[0]],
    [o.q10, LEVELS[1]],
    [o.q50, LEVELS[2]],
    [o.q90, LEVELS[3]],
    [o.b, LEVELS[4]],
  ];
}

// 1名分の入力を検証して素の {a,q10,q50,q90,b} を返す。端の欠測は補わず例外。
function validateFive(input, domain) {
  if (input === null || typeof input !== "object") {
    throw new TypeError("推定は {a,q10,q50,q90,b} のオブジェクトで指定してください");
  }
  const out = {};
  for (const k of ["a", "q10", "q50", "q90", "b"]) {
    if (!isNum(input[k])) {
      throw new TypeError(`${k} は有限の数値が必要です（支持端も創作しません）`);
    }
    out[k] = input[k];
  }
  if (!(out.a <= out.q10 && out.q10 <= out.q50 && out.q50 <= out.q90 && out.q90 <= out.b)) {
    throw new RangeError("a <= q10 <= q50 <= q90 <= b を満たす必要があります");
  }
  const { min, max } = checkDomain(domain);
  if (min !== null && out.a < min) throw new RangeError(`a が domain.min (${min}) を下回ります`);
  if (max !== null && out.b > max) throw new RangeError(`b が domain.max (${max}) を上回ります`);
  return out;
}

// 分布（単独または混合）を [{knots, w}] に展開。
function resolve(dist) {
  if (dist === null || typeof dist !== "object") {
    throw new TypeError("分布が不正です");
  }
  if (Array.isArray(dist.components)) {
    const ws = dist.weights;
    if (!Array.isArray(ws) || !ws.length || ws.length !== dist.components.length) {
      throw new TypeError("混合の weights が components と一致しません");
    }
    if (ws.some((w) => !isNum(w) || w <= 0) || Math.abs(ws.reduce((s, w) => s + w, 0) - 1) > 1e-9) {
      throw new RangeError("混合の weights は正で、合計 1 が必要です");
    }
    return dist.components.map((c, i) => ({
      knots: knotsOf(validateFive(c)),
      w: ws[i],
    }));
  }
  return [{ knots: knotsOf(validateFive(dist)), w: 1 }];
}

function cdfOne(knots, x) {
  const n = knots.length;
  if (x < knots[0][0]) return 0;
  if (x >= knots[n - 1][0]) return 1;
  let i = 0;
  for (let k = 0; k < n; k++) if (knots[k][0] <= x) i = k;
  if (knots[i][0] === x) return knots[i][1]; // 重複節は最大の確率（右連続）
  const [x0, p0] = knots[i];
  const [x1, p1] = knots[i + 1];
  return p0 + ((p1 - p0) * (x - x0)) / (x1 - x0);
}

// 左極限 F(x-)
function cdfLeftOne(knots, x) {
  let i = -1;
  for (let k = 0; k < knots.length; k++) if (knots[k][0] < x) i = k;
  if (i < 0) return 0;
  if (i === knots.length - 1) return 1;
  const [x0, p0] = knots[i];
  const [x1, p1] = knots[i + 1]; // x1 >= x > x0
  return p0 + ((p1 - p0) * (x - x0)) / (x1 - x0);
}

function mixCdf(parts, x, left = false) {
  let s = 0;
  for (const { knots, w } of parts) s += w * (left ? cdfLeftOne(knots, x) : cdfOne(knots, x));
  return s;
}

function breakpoints(parts) {
  const set = new Set();
  for (const { knots } of parts) for (const [x] of knots) set.add(x);
  return [...set].sort((u, v) => u - v);
}

function meanOf(parts) {
  let m = 0;
  for (const { knots, w } of parts) {
    for (let i = 0; i + 1 < knots.length; i++) {
      const dp = knots[i + 1][1] - knots[i][1];
      m += w * dp * ((knots[i][0] + knots[i + 1][0]) / 2);
    }
  }
  return m;
}

/** x での累積確率 F(x)（右連続）。dist は boundedOpinion / mixBoundedOpinions の戻り値。 */
export function boundedCdf(dist, x) {
  if (!isNum(x)) throw new TypeError("x は有限の数値が必要です");
  return mixCdf(resolve(dist), x);
}

/** 下側分位点 inf{x : F(x) >= p}。p=0 は支持の下端。 */
export function boundedQuantile(dist, p) {
  if (!isNum(p) || p < 0 || p > 1) throw new RangeError("p は 0 以上 1 以下の数値が必要です");
  const parts = resolve(dist);
  const xs = breakpoints(parts);
  if (p === 0) return xs[0];
  for (let k = 0; k < xs.length; k++) {
    const Fk = mixCdf(parts, xs[k]);
    if (Fk < p - EPS) continue;
    if (k === 0) return xs[0]; // 下端の点質量
    const L = mixCdf(parts, xs[k], true);
    if (p >= L) return xs[k]; // 点質量の内部
    const F0 = mixCdf(parts, xs[k - 1]);
    return xs[k - 1] + ((p - F0) / (L - F0)) * (xs[k] - xs[k - 1]);
  }
  return xs[xs.length - 1];
}

function summaryFor(dist) {
  const parts = resolve(dist);
  return {
    p10: boundedQuantile(dist, 0.1),
    p50: boundedQuantile(dist, 0.5),
    p90: boundedQuantile(dist, 0.9),
    mean: meanOf(parts),
  };
}

/** 1名分の推定。戻り値は素のデータ（a,q10,q50,q90,b と p10,p50,p90,mean）。 */
export function boundedOpinion(input, domain) {
  const o = validateFive(input, domain);
  return { kind: "opinion", ...o, ...summaryFor(o) };
}

/** 再推定後の2名を等重み(0.5,0.5)で混合。分位点の値の平均ではなく CDF を混合する。 */
export function mixBoundedOpinions(op1, op2, domain) {
  const c1 = boundedOpinion(op1, domain);
  const c2 = boundedOpinion(op2, domain);
  const mix = {
    kind: "mixture",
    weights: [0.5, 0.5],
    components: [stripSummary(c1), stripSummary(c2)],
    support: { a: Math.min(c1.a, c2.a), b: Math.max(c1.b, c2.b) },
  };
  return { ...mix, ...summaryFor(mix) };
}

function stripSummary(o) {
  return { a: o.a, q10: o.q10, q50: o.q50, q90: o.q90, b: o.b };
}

/**
 * 1つの不確かな入力をエンジンへ通すための近似節点 {value, weight}。
 * ※数値近似: 点質量は正確な重みで保持し、連続部は区間ごとの中点則で離散化する。
 *   平均は厳密に保たれるが、エンジン出力の分布は近似である。
 * n は連続部全体の目安節点数（既定 64、区間ごとに最低 1 点）。決定的。
 */
export function boundedNodes(dist, n = 64) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError("n は 1 以上の整数が必要です");
  const parts = resolve(dist);
  const xs = breakpoints(parts);
  const nodes = [];
  for (let k = 0; k < xs.length; k++) {
    const left = k === 0 ? 0 : mixCdf(parts, xs[k], true);
    const atom = mixCdf(parts, xs[k]) - left;
    if (atom > EPS) nodes.push({ value: xs[k], weight: atom });
    if (k + 1 < xs.length) {
      const m = mixCdf(parts, xs[k + 1], true) - mixCdf(parts, xs[k]);
      if (m > EPS) {
        const s = Math.max(1, Math.ceil(n * m));
        const dx = (xs[k + 1] - xs[k]) / s;
        for (let j = 0; j < s; j++) {
          nodes.push({ value: xs[k] + (j + 0.5) * dx, weight: m / s });
        }
      }
    }
  }
  const total = nodes.reduce((t, v) => t + v.weight, 0);
  for (const v of nodes) v.weight /= total;
  return {
    approximate: true,
    method: "区間ごとの中点則（点質量は厳密保持）。数値近似であり厳密な分布ではない",
    nodes,
  };
}
