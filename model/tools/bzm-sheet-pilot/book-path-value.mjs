// BZM 1.0 本書 §9.2 と §9.4.1–4（第8章の月次経路）の ICV / rNPV を、明示した経路の重み付き平均として計算する。
// 完全な前向き計算エンジンの出力ではなく、呼び出し側が渡した経路・金額・割引率だけを使う純関数。
// 本書は一般の終端処理を定義していないため、終端は「最終月の金額」か「終端なし」を明示させる。
// 終端が未指定の入力の組は、ICV・rNPV を「算出不能」として返す（0 や直近値で補わない）。
// 金額の単位はすべて億円。月は評価月からの経過ではなく、基準日からの通し月（整数）。
// 金額の欠けは補わず、例外 PathValueError で止める。AI の推定で証拠を更新しない（入力の写しだけを扱う）。

export class PathValueError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'PathValueError';
    this.code = code;
  }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isMonth = (v) => Number.isInteger(v) && v >= 0;
const WEIGHT_TOL = 1e-9;

/** 月 m の 1 億円を評価月 t へ割り引く係数。年率 r、月数は /12 の指数。 */
export function discountFactor(annualRate, fromMonth, toMonth) {
  if (!isNum(annualRate) || annualRate <= -1) throw new PathValueError('bad_rate', String(annualRate));
  return (1 + annualRate) ** (-(fromMonth - toMonth) / 12);
}

function checkRates(rates, where) {
  if (!rates || !isNum(rates.industrial) || !isNum(rates.private) || rates.industrial <= -1 || rates.private <= -1) {
    throw new PathValueError('rates_missing', where);
  }
  return { industrial: rates.industrial, private: rates.private };
}

/** flows: [{month, amount, kind?}]。評価月より後だけを受ける。将来の出資（kind: 'equity'）は事業の将来価値に入れない。 */
function pvOfFlows(flows, rate, t, where) {
  if (!Array.isArray(flows)) throw new PathValueError('flows_missing', where);
  let pv = 0;
  const seen = new Set();
  for (const f of flows) {
    if (!f || !isMonth(f.month)) throw new PathValueError('bad_month', where);
    if (!isNum(f.amount)) throw new PathValueError('amount_missing', `${where}:月${f.month}`);   // 欠けた金額を 0 にしない
    if (f.kind === 'equity') throw new PathValueError('future_equity_in_operating_pv', `${where}:月${f.month}`);
    if (f.month <= t) throw new PathValueError('flow_not_after_evaluation', `${where}:月${f.month}`);   // 過去分は自由資金に含まれている
    if (seen.has(f.month)) throw new PathValueError('duplicate_month', `${where}:月${f.month}`);
    seen.add(f.month);
    pv += f.amount * discountFactor(rate, f.month, t);
  }
  return pv;
}

/**
 * 終端: { month, industrial, project }（最終月に置く金額、億円）または { absent: true }（終端なしを明示）。
 * 未指定・形が不明なものは「算出不能」。戻り値 null = 算出不能。
 */
function terminalOf(term, t, rates, where) {
  if (term === undefined || term === null || term.unknown === true) return null;
  if (term.absent === true) return { industrial: 0, project: 0 };
  if (!isMonth(term.month) || term.month <= t) throw new PathValueError('bad_terminal', `${where}:month`);
  for (const k of ['industrial', 'project']) if (!isNum(term[k])) throw new PathValueError('amount_missing', `${where}:terminal.${k}`);
  return {
    industrial: term.industrial * discountFactor(rates.industrial, term.month, t),
    project: term.project * discountFactor(rates.private, term.month, t),
  };
}

function scenarioValue(s, rates, t, drawTerm, where) {
  const ind = pvOfFlows(s.industrial, rates.industrial, t, `${where}:industrial`);
  const prj = pvOfFlows(s.project, rates.private, t, `${where}:project`);
  const term = terminalOf(s.terminal !== undefined ? s.terminal : drawTerm, t, rates, where);
  if (term === null) return { available: false, reason: 'terminal_unknown', industrialPv: ind, projectPv: prj };
  return { available: true, industrialPv: ind + term.industrial, projectPv: prj + term.project, terminalIndustrialPv: term.industrial, terminalProjectPv: term.project };
}

function weightedQuantile(items, q) {
  const s = [...items].sort((a, b) => a.x - b.x);
  let c = 0;
  for (const it of s) { c += it.w; if (c >= q - 1e-12) return it.x; }
  return s[s.length - 1].x;
}

/**
 * @param {object} input
 *   evaluationMonth: 評価月（整数）
 *   freeCash: 評価月末の自由に使える保有資金（億円）。使途限定資金は含めない
 *   restrictedCash?: 使途限定資金。別掲するだけで合計に入れない
 *   rates: { industrial, private }  年率。産業の増分（ICV）と事業の正味キャッシュフロー（rNPV）で別
 *   terminal?: 全経路共通の終端（経路ごとの terminal が優先）
 *   draws: [{ id, weight, rates?, terminal?, scenarios:[{id, probability, industrial:[{month,amount}], project:[{month,amount}], terminal?}],
 *             counterpart?: 同じ入力の組で比べる 1 経路（scenario と同じ形） }]
 * @returns 入力の組ごとの条件付き平均（組の内側で経路確率の期待値）→ 外側で重み付き平均・10/50/90%点
 */
export function valueBookPaths(input) {
  if (!input || typeof input !== 'object') throw new PathValueError('input_missing');
  const t = input.evaluationMonth;
  if (!isMonth(t)) throw new PathValueError('bad_evaluation_month', String(t));
  if (!isNum(input.freeCash)) throw new PathValueError('free_cash_missing');
  if (input.restrictedCash !== undefined && !isNum(input.restrictedCash)) throw new PathValueError('restricted_cash_bad');
  const baseRates = checkRates(input.rates, 'rates');
  const draws = input.draws;
  if (!Array.isArray(draws) || !draws.length) throw new PathValueError('no_draws');
  const wsum = draws.reduce((a, d) => a + (isNum(d?.weight) ? d.weight : NaN), 0);
  if (draws.some((d) => !(d?.weight > 0) || !isNum(d.weight)) || !(Math.abs(wsum - 1) <= 1e-6)) throw new PathValueError('bad_weights', String(wsum));

  const perDraw = draws.map((d, di) => {
    const id = d.id ?? `draw${di + 1}`;
    const rates = d.rates ? checkRates(d.rates, `${id}:rates`) : baseRates;
    if (!Array.isArray(d.scenarios) || !d.scenarios.length) throw new PathValueError('no_scenarios', id);
    const psum = d.scenarios.reduce((a, s) => a + (isNum(s?.probability) ? s.probability : NaN), 0);
    if (d.scenarios.some((s) => !(s?.probability > 0)) || !(Math.abs(psum - 1) <= WEIGHT_TOL)) throw new PathValueError('bad_path_probabilities', `${id}:${psum}`);
    const drawTerm = d.terminal !== undefined ? d.terminal : input.terminal;
    const vals = d.scenarios.map((s) => ({ id: s.id, probability: s.probability, ...scenarioValue(s, rates, t, drawTerm, `${id}/${s.id}`) }));
    const available = vals.every((v) => v.available);
    const out = { id, weight: d.weight, available, paths: vals };
    if (available) {
      out.icv = vals.reduce((a, v) => a + v.probability * v.industrialPv, 0);
      out.futureProject = vals.reduce((a, v) => a + v.probability * v.projectPv, 0);
      out.rnpv = input.freeCash + out.futureProject;
    } else {
      out.icv = null; out.rnpv = null; out.reason = 'terminal_unknown';
    }
    if (d.counterpart) {
      const c = scenarioValue(d.counterpart, rates, t, drawTerm, `${id}/counterpart`);
      out.counterpart = c.available
        ? { available: true, icv: c.industrialPv, rnpv: input.freeCash + c.projectPv }
        : { available: false, reason: c.reason };
    }
    return out;
  });

  const result = {
    evaluationMonth: t,
    freeCash: input.freeCash,
    restrictedCash: input.restrictedCash ?? null,   // 別掲。ICV・rNPV へ加えない
    perDraw,
  };
  const unavailable = perDraw.filter((p) => !p.available);
  if (unavailable.length) {
    // 一部でも終端が不明なら、外側の平均・分位点は出さない（欠けた組を除いた平均を全体として見せない）
    result.available = false;
    result.reason = 'terminal_unknown';
    result.unavailableDraws = unavailable.map((p) => p.id);
    result.icv = null; result.rnpv = null; result.quantiles = { status: 'unavailable', reason: 'terminal_unknown' };
    return result;
  }
  const wmean = (f) => perDraw.reduce((a, p) => a + (p.weight / wsum) * f(p), 0);
  result.available = true;
  result.icv = wmean((p) => p.icv);
  result.rnpv = wmean((p) => p.rnpv);
  result.quantiles = draws.length === 1
    ? { status: 'uncalculated', reason: 'single_fixed_input' }   // 1 組だけでは被覆を主張しない
    : {
      status: 'calculated',
      icv: Object.fromEntries([['p10', 0.1], ['p50', 0.5], ['p90', 0.9]].map(([k, q]) => [k, weightedQuantile(perDraw.map((p) => ({ x: p.icv, w: p.weight / wsum })), q)])),
      rnpv: Object.fromEntries([['p10', 0.1], ['p50', 0.5], ['p90', 0.9]].map(([k, q]) => [k, weightedQuantile(perDraw.map((p) => ({ x: p.rnpv, w: p.weight / wsum })), q)])),
    };
  return result;
}
