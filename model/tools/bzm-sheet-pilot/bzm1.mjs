// BZM 1.0 版の評価記録（試作）。教科書 §9.5 / 第12〜14章の「節目の決定木」の経路を、入力から再計算する。
// 範囲: 月次の全体シミュレーション（第4〜7章）ではない。節目の成否確率・収支・割引率を入力として与え、
//   その条件付き期待値（式 14.1）を後ろ向きに集計する。9.5.1 の 151.9 / 12.69 はこの固定入力の算術の結果。
// 旧版（BZM 3.0 内部版）の計算・状態は使わない。Sheets 連携（read / apply）と init の土台だけ pilot.mjs を再利用する。
import { readFileSync } from 'node:fs';
import { PilotError, sha256, canon, stateHash, isDate, isIso, cell, appendReq, round, dayOf, PLANNED_RE, init } from './pilot.mjs';
import { boundedOpinion, mixBoundedOpinions, boundedCdf, boundedNodes } from './book-distribution.mjs';

export const EVAL_MODEL_VERSION = 'bzm1.0-decision-tree-9.5/1';
/** 参照する本書の原稿（BZM 1.0）。評価の前提欄に記録する。 */
export const BOOK_REFERENCE = Object.freeze({ project: 'BZM 1.0', manuscriptCommit: 'b63a642', manuscriptVersion: 'v1.2.2' });
const BOOK_SUPPLEMENTS = ['cash_balance', 'plan_change', 'application_pending'];
export const STATE_V = 'bzm1-1';
export const TAB_NAMES1 = { eval: '評価履歴', reg: '登録簿', fc: '予測・実績', log: '処理記録' };
export const HEADERS1 = {
  eval: ['版', '基準日時', '経過月', '更新の分類', '評価モデル版', '前版', 'ICV平均(億円)', 'rNPV平均(億円)', '保有資金・自由(億円)',
    '将来の正味価値(億円)', '使途限定資金・別掲(億円)', 'ICV 10%点', 'ICV 50%点', 'ICV 90%点', 'rNPV 10%点', 'rNPV 50%点', 'rNPV 90%点',
    '分位点の状態', '入力の組数', '同月・更新前ICV', '同月・更新前rNPV', '前版ICV', '前版rNPV', '前版からのICV増減', '前版からのrNPV増減',
    '反映した事象ID', '入力ハッシュ', '評価時入力(JSON)', '根拠資料', '前提・重み・版(JSON)'],
  reg: ['事象ID', '日付', '種類', '要旨', '出所タグ', '契約主体', '反映先の分類', '変更内容', '記録者と評価版',
    '確認者', '確認日', '根拠資料(版)', '根拠の引用', '段落ハッシュ', '入力変更(JSON)', '確率分布の混合(JSON)', '明細ハッシュ', '教材の仮定'],
  fc: ['区分', '予測ID', '記録日時', '質問', '確率', '期限', '判定基準', '出来事', '結果', '参照事象ID', '観測日', '引用',
    '予測時の版', '予測時ICV', '予測時rNPV'],
  log: ['処理日時', '版', '評価キー', '内容'],
};

const MAN = 1e-4;            // 万円 → 億円
const STREAM_TERMS = 6000;   // 原典計算（評価額の推移_計算.py）と同じ項数
const MAX_DRAWS = 2000;
const MAX_CELL = 45000;
const TARGETS = ['観測状態', 'プロジェクトパラメータ', '資金調達の機会', '計画の規則'];
const SOURCE_TAGS = ['文書', '面談', '第三者証言', '公開情報'];
const HUMAN_BAD = /^(ai|llm|gemini|claude|gpt|model|bot)/i;

// ───────────────────────────────────────────────────────── 入力（単位つき）

const SCALARS = ['sales', 'purchase', 'labor', 'tax', 'ramp', 'upfront', 'qk', 'lag', 'royrate', 'netshare'];
const UNIT_TOP = { p: '確率', l: '確率', sales: '億円/年', purchase: '億円/年', labor: '億円/年', tax: '割合', ramp: '月', upfront: '億円',
  qk: '確率', lag: '月', royrate: '割合', netshare: '割合', A: '万円/月', flowsDown: '万円', financing: '億円', cash0: '億円', restricted: '億円' };
const UNIT_RATE = { private: '年率', industrial: '年率', hazard: '1/年' };
const UNIT01 = new Set(['p', 'l', 'qk', 'tax', 'royrate', 'netshare']);

export const unitOf = (path) => {
  const [h, k] = path.split('.');
  return h === 'rates' ? UNIT_RATE[k] : UNIT_TOP[h];
};
function checkValue(path, v) {
  const [h, k] = path.split('.');
  const bad = typeof v !== 'number' || !Number.isFinite(v)
    || (UNIT01.has(h) && (v < 0 || v > 1))
    || (h === 'ramp' && v < 1) || (h === 'lag' && v < 0) || ((h === 'sales' || h === 'purchase' || h === 'labor') && v < 0)
    || (h === 'rates' && (k === 'hazard' ? v < 0 || v > 12 : v <= -1));
  if (bad) throw new PilotError('invalid_input_value', path);
  return v;
}
const NUM = (path, v) => { if (typeof v !== 'number') throw new PilotError('missing_input', path); return checkValue(path, v); };

/** 入力を検査して内部形へ。欠けた値は 0 にせず止める。flowsMonthly は 1..最終月を区間で隙間なく与える。 */
export function normalizeInputs(raw) {
  if (!raw || typeof raw !== 'object') throw new PilotError('missing_input', 'inputs');
  if (!isDate(raw.evaluationDate)) throw new PilotError('missing_input', 'evaluationDate');
  const ms = raw.milestones;
  if (!Array.isArray(ms) || !ms.length || ms.some((m, i) => !Number.isInteger(m) || m < 1 || (i && m <= ms[i - 1]))) throw new PilotError('missing_input', 'milestones');
  const H = ms[ms.length - 1];
  const P = { evaluationDate: raw.evaluationDate, horizon: H, milestones: ms.slice(),
    cash0: NUM('cash0', raw.cash0), restricted: NUM('restricted', raw.restricted),
    rates: {}, p: {}, l: {}, flowsDown: {}, financing: {}, A: {} };
  for (const k of Object.keys(UNIT_RATE)) P.rates[k] = NUM(`rates.${k}`, raw.rates?.[k]);
  for (const k of SCALARS) P[k] = NUM(k, raw[k]);
  for (const m of ms) {
    P.p[m] = NUM(`p.${m}`, raw.p?.[m]); P.l[m] = NUM(`l.${m}`, raw.l?.[m]); P.flowsDown[m] = NUM(`flowsDown.${m}`, raw.flowsDown?.[m]);
  }
  if (!raw.financing || typeof raw.financing !== 'object') throw new PilotError('missing_input', 'financing');   // 空 {} は「出資なし」の明示
  for (const [k, v] of Object.entries(raw.financing)) {
    if (!Number.isInteger(Number(k)) || Number(k) < 1 || Number(k) > H) throw new PilotError('invalid_input_value', `financing.${k}`);
    P.financing[Number(k)] = NUM(`financing.${k}`, v);
  }
  if (!Array.isArray(raw.flowsMonthly)) throw new PilotError('missing_input', 'flowsMonthly');
  for (const s of raw.flowsMonthly) {
    if (!Number.isInteger(s?.from) || !Number.isInteger(s?.to) || s.from < 1 || s.to > H || s.from > s.to) throw new PilotError('invalid_input_value', 'flowsMonthly');
    for (let m = s.from; m <= s.to; m++) {
      if (m in P.A) throw new PilotError('flow_overlap', String(m));
      P.A[m] = NUM(`A.${m}`, s.value);
    }
  }
  for (let m = 1; m <= H; m++) if (!(m in P.A)) throw new PilotError('flow_missing', String(m));
  return P;
}

export function leafPaths(P) {
  const out = ['evaluationDate', 'milestones', 'cash0', 'restricted', ...SCALARS];
  for (const k of Object.keys(P.rates)) out.push(`rates.${k}`);
  for (const g of ['p', 'l', 'flowsDown', 'financing', 'A']) for (const k of Object.keys(P[g])) out.push(`${g}.${k}`);
  return out;
}

/** すべての入力に出所・種別・教材の区別を付ける。付いていない入力があれば止める。 */
export function checkProvenance(prov, P) {
  if (!Array.isArray(prov) || !prov.length) throw new PilotError('provenance_missing', 'base.provenance');
  const covered = new Set();
  for (const it of prov) {
    const ok = Array.isArray(it?.paths) && it.paths.length && ['observation', 'estimate'].includes(it.kind)
      && typeof it.basis === 'string' && it.basis && typeof it.teaching === 'boolean'
      && (it.teaching ? it.basis === 'textbook_fixture' && typeof it.citation === 'string' && it.citation : typeof it.by === 'string' && it.by && !HUMAN_BAD.test(it.by));
    if (!ok) throw new PilotError('provenance_invalid', JSON.stringify(it?.paths));
    // 教材以外の推定値は、評価者2名の分布（coveredByPool）か、資料で固定された値（fixedBy）のどちらかで裏づける。創作した値は置かない
    if (!it.teaching && it.kind === 'estimate') {
      const fb = it.fixedBy;
      const fixed = fb && sameStr(fb.docId) && sameStr(fb.revision) && sameStr(fb.quote) && fb.quote.length <= 400;
      if (!fixed && !sameStr(it.coveredByPool)) throw new PilotError('base_uncertain_unpooled', JSON.stringify(it.paths));
    }
    for (const p of it.paths) covered.add(p);
  }
  for (const lp of leafPaths(P)) {
    const top = lp.split('.')[0];
    if (!covered.has(lp) && !covered.has(top) && !covered.has(lp.split('.').slice(0, 2).join('.'))) throw new PilotError('provenance_missing', lp);
  }
}

function setPath(P, path, v, unit) {
  const [h, k] = path.split('.');
  const ok = (k === undefined && (SCALARS.includes(h) || h === 'cash0' || h === 'restricted'))
    || (h === 'rates' && Object.hasOwn(P.rates, k)) || (['p', 'l', 'flowsDown', 'financing', 'A'].includes(h) && k !== undefined && Object.hasOwn(P[h], k));
  if (!ok) throw new PilotError('unknown_input_path', path);
  if (unit !== undefined && unit !== unitOf(path)) throw new PilotError('unit_mismatch', `${path}: ${unit} != ${unitOf(path)}`);
  checkValue(path, v);
  if (k === undefined) P[h] = v; else P[h][k] = v;
}

// ───────────────────────────────────────────────────────── 計算本体（原典: 評価額の推移_計算.py の移植）

const disc = (m, r) => (1 + r) ** (-m / 12);
function stream(P, annual, rate) {
  const lam = P.rates.hazard; let s = 0;
  for (let j = 1; j <= STREAM_TERMS; j++) s += (annual / 12) * Math.min(j / P.ramp, 1) * (1 - lam / 12) ** j * (1 + rate) ** (-j / 12);
  return s;
}
function pieces(P) {
  const K = P.rates.private, D = P.rates.industrial;
  const f = (P.sales - P.purchase - P.labor) * (1 - P.tax), va = P.netshare * (P.sales - P.purchase), roy = P.royrate * P.sales;
  const G = stream(P, va, D), F = stream(P, f, K);
  const licP = P.upfront + P.qk * stream(P, roy, K) * disc(P.lag, K);
  const licI = P.qk * G * disc(P.lag, D);
  return { K, D, F, G, licP, licI };
}
/** 月 t の出入りを済ませた時点で、節目を順に越えてきた案件の将来の正味価値 W と産業創出価値 I（億円）。 */
export function valuesAt(P, t) {
  const { K, D, F, G, licP, licI } = pieces(P);
  let W = F, I = G;
  for (let m = P.horizon - 1; m >= t; m--) {
    const nx = m + 1;
    if (P.milestones.includes(nx)) {
      const p = P.p[nx], l = P.l[nx];
      const upW = P.A[nx] * MAN + W, dnW = P.flowsDown[nx] * MAN + l * disc(6, K) * licP;
      const dnI = l * disc(6, D) * licI;
      W = disc(1, K) * (p * upW + (1 - p) * dnW); I = disc(1, D) * (p * I + (1 - p) * dnI);
    } else { W = disc(1, K) * (P.A[nx] * MAN + W); I = disc(1, D) * I; }
  }
  return { W, I };
}
/** 自由に使える保有資金（億円）。使途限定資金は含めない。 */
export function cashAt(P, t) {
  let c = P.cash0;
  for (let s = 1; s <= t; s++) c += P.A[s] * MAN + (P.financing[s] ?? 0);
  return c;
}
/** 月 t の評価。pendingGate=t なら、その節目の成否と出資を反映する前（時間の経過だけ）の値。 */
export function evaluateAt(P, month, { gates = {}, pendingGate = null } = {}) {
  if (!Number.isInteger(month) || month < 0 || month > P.horizon) throw new PilotError('month_out_of_range', String(month));
  for (const m of P.milestones) if (m <= month && m !== pendingGate && !gates[m]) throw new PilotError('gate_not_confirmed', String(m));
  let cash, W, I;
  if (pendingGate !== null) {
    if (pendingGate !== month) throw new PilotError('pending_gate_month_mismatch', String(month));
    const v = valuesAt(P, month - 1); cash = cashAt(P, month - 1);
    W = v.W * (1 + P.rates.private) ** (1 / 12); I = v.I * (1 + P.rates.industrial) ** (1 / 12);
  } else { ({ W, I } = valuesAt(P, month)); cash = cashAt(P, month); }
  return { cash, future: W, total: cash + W, ind: I, restricted: P.restricted };
}
export function downAt(P, t) {
  const { K, D, licP, licI } = pieces(P); const l = P.l[t];
  return { total: cashAt(P, t - 1) + P.flowsDown[t] * MAN + l * disc(6, K) * licP, ind: l * disc(6, D) * licI };
}

/** 教科書の通し事例の推移（表 14.1 / 14.2）。events: [{month, changes:[{path,to}]}]。全節目を越える経路。 */
export function trajectory(P0, events, { keepInputs = false } = {}) {
  const P = structuredClone(P0); const byMonth = new Map();
  for (const e of events) { if (P.milestones.includes(e.month)) throw new PilotError('event_on_gate_month', String(e.month)); byMonth.set(e.month, e.changes); }
  const gates = {}; const rows = []; const gateInfo = [];
  const initial = evaluateAt(P, 0);
  for (let t = 1; t <= P.horizon; t++) {
    if (P.milestones.includes(t)) {
      const before = evaluateAt(P, t, { gates, pendingGate: t }); const dn = downAt(P, t);
      gates[t] = true; const after = evaluateAt(P, t, { gates });
      rows.push({ month: t, kind: '節目', before: before.total, after: after.total, icvBefore: before.ind, icvAfter: after.ind });
      gateInfo.push({ month: t, cash: after.cash, future: after.future, total: after.total, ind: after.ind, downTotal: dn.total, downInd: dn.ind, p: P.p[t], ...(keepInputs ? { inputs: structuredClone(P), gatesBefore: gateInfo.map((g) => g.month) } : {}) });
    } else if (byMonth.has(t)) {
      const before = evaluateAt(P, t, { gates });
      for (const c of byMonth.get(t)) setPath(P, c.path, c.to);
      const after = evaluateAt(P, t, { gates });
      rows.push({ month: t, kind: '出来事', before: before.total, after: after.total, icvBefore: before.ind, icvAfter: after.ind });
    }
  }
  return { initial, rows, gates: gateInfo };
}

// ───────────────────────────────────────────────────────── 入力の組（有限・重み付き）の集計

function weightedQuantile(items, q) {
  const s = [...items].sort((a, b) => a.x - b.x); let c = 0;
  for (const it of s) { c += it.w; if (c >= q - 1e-12) return it.x; }
  return s[s.length - 1].x;
}
/** 入力の組ごとに ICV と rNPV（節目の確率の期待値は組の内側）を計算し、外側で重み付き平均・10/50/90%点。 */
export function ensemble(P, draws, month, opts = {}) {
  if (!Array.isArray(draws) || !draws.length) throw new PilotError('no_draws');
  const sum = draws.reduce((a, d) => a + d.weight, 0);
  if (draws.some((d) => !(d.weight > 0) || !Number.isFinite(d.weight)) || Math.abs(sum - 1) > 1e-6) throw new PilotError('bad_weights', String(sum));
  const ev = draws.map((d) => {
    const Pd = structuredClone(P);
    for (const [path, v] of Object.entries(d.values || {})) setPath(Pd, path, v);
    return { w: d.weight / sum, ...evaluateAt(Pd, month, opts) };
  });
  const mean = (f) => ev.reduce((a, e) => a + e.w * f(e), 0);
  const out = { n: draws.length, icv: mean((e) => e.ind), rnpv: mean((e) => e.total), cash: mean((e) => e.cash), future: mean((e) => e.future), restricted: P.restricted };
  out.quantiles = draws.length === 1 ? { status: 'uncalculated', reason: 'single_fixed_input' }
    : { status: 'calculated', icv: Object.fromEntries([['p10', 0.1], ['p50', 0.5], ['p90', 0.9]].map(([k, q]) => [k, weightedQuantile(ev.map((e) => ({ x: e.ind, w: e.w })), q)])),
      rnpv: Object.fromEntries([['p10', 0.1], ['p50', 0.5], ['p90', 0.9]].map(([k, q]) => [k, weightedQuantile(ev.map((e) => ({ x: e.total, w: e.w })), q)])) };
  return out;
}

// ───────────────────────────────────────────────────────── 13.3.1 独立2名の分布 → 線形混合

/** 量の定義域。単位から決まる範囲に、量ごとの domain {min,max} をさらに狭める形で重ねる。 */
function domainOf(path, qDomain) {
  const [h, k] = path.split('.');
  let min = null, max = null;
  if (UNIT01.has(h)) { min = 0; max = 1; }
  else if (h === 'ramp') min = 1;
  else if (h === 'lag' || h === 'sales' || h === 'purchase' || h === 'labor') min = 0;
  else if (h === 'rates' && k === 'hazard') { min = 0; max = 12; }
  for (const [key, v] of [['min', qDomain?.min], ['max', qDomain?.max]]) {
    if (v === undefined || v === null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new PilotError('bad_distribution', `${path}:domain.${key}`);
    if (key === 'min') min = min === null ? v : Math.max(min, v); else max = max === null ? v : Math.min(max, v);
  }
  return { min, max };
}
const fiveOf = (m) => ((m.a !== undefined || m.b !== undefined || m.q10 !== undefined)
  ? { a: m.a, q10: m.q10, q50: m.q50, q90: m.q90, b: m.b } : { a: m.lower, q10: m.p10, q50: m.p50, q90: m.p90, b: m.upper });

/** 1量の周辺分布 → 求積の節点。区分線形は本書の分布計算（端点・定義域・質量を検証）の節点を使う。 */
function marginalOf(m, path, qDomain) {
  if (m?.kind === 'discrete') {
    const pts = m.points;
    if (!Array.isArray(pts) || !pts.length || pts.some((p) => !(p.weight > 0)) || Math.abs(pts.reduce((a, p) => a + p.weight, 0) - 1) > 1e-6) throw new PilotError('bad_distribution', path);
    return { points: pts.map((p) => ({ value: checkValue(path, p.value), weight: p.weight })), five: null, domain: null };
  }
  if (m?.kind === 'piecewise') {
    const five = fiveOf(m);
    for (const k of ['a', 'q10', 'q50', 'q90', 'b']) {
      if (typeof five[k] !== 'number' || !Number.isFinite(five[k])) throw new PilotError('bad_distribution', `${path}.${k}`);   // 支持の端も創作しない
      checkValue(path, five[k]);
    }
    const domain = domainOf(path, m.domain);
    const n = m.n ?? 10;
    if (!Number.isInteger(n) || n < 1 || n > 50) throw new PilotError('bad_distribution', path);
    try { boundedOpinion(five, domain); } catch (er) { throw new PilotError('bad_distribution', `${path}:${er.message}`); }
    return { points: boundedNodes(five, n).nodes, five, domain };
  }
  throw new PilotError('bad_distribution', path);
}
function numericSummary(draws, path) {
  const items = draws.map((d) => ({ x: d.values[path], w: d.weight }));
  const tot = items.reduce((a, i) => a + i.w, 0);
  const norm = items.map((i) => ({ x: i.x, w: i.w / tot }));
  return { method: 'numeric_from_draws', mean: norm.reduce((a, i) => a + i.w * i.x, 0), p10: weightedQuantile(norm, 0.1), p50: weightedQuantile(norm, 0.5), p90: weightedQuantile(norm, 0.9) };
}
/** 1名の分布 → 同時の節点（周辺分布を独立に掛け合わせる、または明示の同時分布）。量ごとの周辺情報も返す。 */
function distDraws(dist, quantities, dependency) {
  if (Array.isArray(dist?.jointDraws)) {
    const sum = dist.jointDraws.reduce((a, d) => a + d.weight, 0);
    if (!dist.jointDraws.length || Math.abs(sum - 1) > 1e-6) throw new PilotError('bad_distribution', 'jointDraws');
    const draws = dist.jointDraws.map((d) => {
      if (!(d.weight > 0)) throw new PilotError('bad_distribution', 'jointDraws');
      for (const q of quantities) checkValue(q.path, d.values?.[q.path]);   // 欠けた量は 0 にしない
      return { weight: d.weight, values: Object.fromEntries(quantities.map((q) => [q.path, d.values[q.path]])) };
    });
    return { draws, margs: {} };
  }
  if (!dist?.marginals) throw new PilotError('bad_distribution', 'marginals');
  if (quantities.length > 1 && (dependency?.kind !== 'independent' || typeof dependency.reason !== 'string' || !dependency.reason)) throw new PilotError('dependency_undeclared');
  let draws = [{ weight: 1, values: {} }]; const margs = {};
  for (const q of quantities) {
    const mg = marginalOf(dist.marginals[q.path], q.path, q.domain); margs[q.path] = mg;
    draws = draws.flatMap((d) => mg.points.map((p) => ({ weight: d.weight * p.weight, values: { ...d.values, [q.path]: p.value } })));
    if (draws.length > MAX_DRAWS) throw new PilotError('joint_too_large', String(draws.length));
  }
  return { draws, margs };
}
const opinionSummary = (mg, draws, path) => (mg?.five
  ? { method: 'exact_piecewise_cdf', ...boundedOpinion(mg.five, mg.domain) }
  : numericSummary(draws, path));
/** 量ごとの要約。2名がともに区分線形なら混合CDFから平均・10/50/90%点・CDFを厳密に出す。それ以外は節点から数値で出す（方法を明記）。 */
function mixedSummary(finals, path) {
  const [x, y] = finals;
  if (x.margs[path]?.five && y.margs[path]?.five) {
    const dom = x.margs[path].domain;
    const mix = mixBoundedOpinions(x.margs[path].five, y.margs[path].five, dom);
    const xs = [...new Set([...Object.values(x.margs[path].five), ...Object.values(y.margs[path].five)])].sort((u, v) => u - v);
    return { method: 'exact_piecewise_cdf', mean: mix.mean, p10: mix.p10, p50: mix.p50, p90: mix.p90, support: mix.support, cdf: xs.map((v) => ({ x: v, F: boundedCdf(mix, v) })) };
  }
  return numericSummary(finals.flatMap((f) => f.draws.map((d) => ({ weight: d.weight * 0.5, values: d.values }))), path);
}
/** 評価者2名（別ID）が資料を独立に読んで初期分布 → 根拠交換日・共有資料 → 各1回の再推定（変更なしなら明示の再確認）→ 等重み混合。 */
export function buildPool(pool) {
  const ok = pool && typeof pool.id === 'string' && pool.id && Array.isArray(pool.quantities) && pool.quantities.length && Array.isArray(pool.evaluators) && pool.evaluators.length === 2;
  if (!ok) throw new PilotError('pool_invalid');
  const norm = (s) => String(s ?? '').normalize('NFC').trim();
  const [a, b] = pool.evaluators;
  if (!norm(a.id) || !norm(b.id) || norm(a.id) === norm(b.id) || [a.id, b.id].some((i) => HUMAN_BAD.test(norm(i)))) throw new PilotError('evaluators_not_distinct');
  if ([a, b].some((e) => e.weight !== undefined && e.weight !== 0.5)) throw new PilotError('weights_must_be_equal');
  const ex = pool.exchange;
  if (!isDate(ex?.date) || !Array.isArray(ex.sharedSources) || !ex.sharedSources.length || ex.sharedSources.some((s) => !s || typeof s.title !== 'string' || !s.title)) throw new PilotError('exchange_missing');
  for (const q of pool.quantities) if (!unitOf(q.path) || q.unit !== unitOf(q.path)) throw new PilotError('unit_mismatch', String(q?.path));
  if (pool.retired !== undefined && !(Array.isArray(pool.retired) && pool.retired.every((r) => sameStr(r?.path) && sameStr(r.reason) && unitOf(r.path) && r.unit === unitOf(r.path)
    && !pool.quantities.some((q) => q.path === r.path)))) throw new PilotError('pool_retired_invalid');
  let max = ex.date; const finals = []; const adoption = [];
  for (const e of [a, b]) {
    if (!isDate(e.initial?.submittedAt) || e.initial.submittedAt > ex.date || typeof e.initial.rationale !== 'string' || !e.initial.rationale) throw new PilotError('initial_invalid', e.id);
    const ini = distDraws(e.initial, pool.quantities, pool.dependency);   // 初期分布も検証する
    const re = e.revised ?? e.reaffirmed;                                  // 交換後の再推定。変更なしでも明示の再確認が必要
    if (!re) throw new PilotError('reaffirmation_missing', e.id);
    if (!isDate(re.submittedAt) || re.submittedAt < ex.date || typeof re.rationale !== 'string' || !re.rationale) throw new PilotError('revised_invalid', e.id);
    if (re.submittedAt > max) max = re.submittedAt;
    const keptInitial = !e.revised || e.revised.keepInitial === true;
    const fin = keptInitial ? ini : distDraws(e.revised, pool.quantities, pool.dependency);
    finals.push({ id: e.id, keptInitial, draws: fin.draws, margs: fin.margs, iniMargs: ini.margs, iniDraws: ini.draws });
    adoption.push({ evaluator: e.id, initialSubmittedAt: e.initial.submittedAt, finalSource: keptInitial ? 'initial_reaffirmed' : 'revised', finalSubmittedAt: re.submittedAt,
      initialRationale: e.initial.rationale, finalRationale: re.rationale });
  }
  const draws = finals.flatMap((f) => f.draws.map((d) => ({ weight: d.weight * 0.5, values: d.values, evaluator: f.id })));
  if (draws.length > MAX_DRAWS * 2) throw new PilotError('joint_too_large');
  const summaries = {};
  for (const q of pool.quantities) {
    summaries[q.path] = { unit: q.unit,
      initial: Object.fromEntries(finals.map((f) => [f.id, opinionSummary(f.iniMargs[q.path], f.iniDraws, q.path)])),
      final: Object.fromEntries(finals.map((f) => [f.id, opinionSummary(f.margs[q.path], f.draws, q.path)])),
      initialMixed: mixedSummary(finals.map((f) => ({ margs: f.iniMargs, draws: f.iniDraws })), q.path),
      mixed: mixedSummary(finals, q.path) };
  }
  return { id: pool.id, quantities: pool.quantities, draws, lastEvidenceDate: max, keptInitial: Object.fromEntries(finals.map((f) => [f.id, f.keptInitial])),
    summaries, adoption: { exchangeDate: ex.date, sharedSources: ex.sharedSources, weights: [0.5, 0.5], evaluators: adoption },
    method: finals.some((f) => Object.values(f.margs).some((m) => m?.five))   // 出力の節点に区分線形の周辺分布を射影したときだけ近似
      ? { approximate: true, kind: 'quadrature_nodes', note: '評価値の分位点は節点（区間ごとの中点則、点質量は厳密保持）から数値で求める。量ごとの要約は区分線形CDFから厳密に求める（混合の平均・10/50/90%点・CDF）' }
      : { approximate: false, kind: 'discrete_mixture' },
    hash: sha256(canon(pool)) };
}

// ───────────────────────────────────────────────────────── 登録簿（12.2 の9列）と採否

const monthsBetween = (a, b) => {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma) - (db < da ? 1 : 0);
};
const sameStr = (x) => typeof x === 'string' && x.trim().length > 0;

export function validateEntry(e) {
  const bad = (f) => { throw new PilotError('entry_invalid', `${e?.eventId ?? '?'}:${f}`); };
  if (!e || !sameStr(e.eventId)) bad('eventId');
  if (!isDate(e.date)) bad('date');
  const supOk = e.supplement === undefined || (e.type === null && BOOK_SUPPLEMENTS.includes(e.supplement));
  if (!(Number.isInteger(e.type) && e.type >= 1 && e.type <= 24) && !(e.type === null && (e.teaching === true || BOOK_SUPPLEMENTS.includes(e.supplement)))) bad('type');
  if (!supOk) bad('supplement');
  if (e.supplement === 'application_pending' && (e.inputChanges?.length || e.gate || e.pool || e.observation)) bad('pending_must_not_change_valuation');
  if (!sameStr(e.summary)) bad('summary');
  if (!SOURCE_TAGS.includes(e.sourceTag)) bad('sourceTag');
  if (!('contractParty' in e) || !(e.contractParty === null || sameStr(e.contractParty))) bad('contractParty');
  if (!Array.isArray(e.targets) || !e.targets.length || e.targets.some((t) => !TARGETS.includes(t))) bad('targets');
  if (!sameStr(e.changeText)) bad('changeText');
  if (!sameStr(e.recordedBy) || HUMAN_BAD.test(e.recordedBy)) bad('recordedBy');
  if (!Array.isArray(e.inputChanges)) bad('inputChanges');
  for (const c of e.inputChanges) {
    if (!['observation', 'estimate'].includes(c.kind) || typeof c.path !== 'string' || !unitOf(c.path) || c.unit !== unitOf(c.path)) bad(`change:${c.path}`);
    checkValue(c.path, c.to);
    // 教材以外の推定は点推定でモデルを動かさない。評価者2名の分布（pool）を通す。資料に書かれた確定値は observation で入れる
    if (c.kind === 'estimate' && e.teaching !== true) bad(`estimate_requires_pool:${c.path}`);
    if (c.kind === 'estimate' && !(sameStr(c.estimate?.by) && sameStr(c.estimate?.rationale) && (e.teaching === true ? true : !HUMAN_BAD.test(c.estimate.by)))) bad(`estimate:${c.path}`);
  }
  if (e.gate && !(Number.isInteger(e.gate.month) && typeof e.gate.passed === 'boolean')) bad('gate');
  // 不成立は、観測した結果（achieved:false）と実際の資料の根拠があるときだけ受け付ける。無ければ従来どおり止める
  if (e.gate && e.gate.passed === false && e.observation?.achieved !== false) throw new PilotError('gate_failure_not_supported', e.eventId);
  if (e.observation && !(sameStr(e.observation.event) && typeof e.observation.achieved === 'boolean')) bad('observation');
  const nativeOk = sameStr(e.source?.docId) && sameStr(e.source?.revision) && sameStr(e.source?.quote) && e.source.quote.length <= 400;
  if (e.gate && e.gate.passed === false) {
    if (!nativeOk) throw new PilotError('gate_failure_not_supported', e.eventId);
    if (e.inputChanges.length || e.pool) bad('failure_entry_must_not_change_inputs');
  }
  if (e.teaching === true) {
    if (!(e.source?.fixture === true && sameStr(e.source.citation))) bad('source');
    // 教材の入力に、実際の資料の根拠を併記できる（併記するなら3点そろえる）。併記しなければ従来の教材明細
    if (['docId', 'revision', 'quote'].some((k) => e.source[k] !== undefined) && !nativeOk) bad('source_native');
  } else if (!nativeOk) bad('source');
  if (e.candidateId !== undefined && !(sameStr(e.candidateId) && nativeOk)) bad('candidateId');
  if (e.teaching !== true && e.gate && !(e.observation?.achieved === e.gate.passed)) bad('gate_observed_result');   // 節目の通過は観測した結果を明記する
  if (e.pool?.retired !== undefined && !Array.isArray(e.pool.retired)) bad('pool_retired');
  if (e.pool) { if (e.inputChanges.some((c) => e.pool.quantities?.some((q) => q.path === c.path))) bad('pool_overlap'); buildPool(e.pool); }
  return e;
}

function paragraphOf(text, quote) {
  const q = quote.normalize('NFC');
  return text.replace(/\r\n/g, '\n').split(/\n[ \t　]*\n/).map((s) => s.trim().normalize('NFC')).find((p) => p.includes(q)) || null;
}

/** 採否の判定。理由を返す（null なら採用してよい）。理由は記録に残す。 */
/** 抽出結果（input.extract）の検査。失敗なら理由を返し、スナップショットは進めない。候補は評価に使わない（登録簿の明細と照合するだけ）。 */
function checkExtract(extract, docMap) {
  if (extract === undefined || extract === null) return { present: false, valid: false, reason: 'extract_missing' };
  const fail = (reason) => ({ present: true, valid: false, reason });
  const doc = extract.doc;
  if (!sameStr(doc?.id) || !sameStr(doc?.revision) || !Array.isArray(extract.candidates)) return fail('extract_malformed');
  const d = docMap.get(doc.id);
  if (!d || d.revision !== doc.revision) return fail('extract_doc_revision_mismatch');
  const byId = new Map();
  for (const c of extract.candidates) {
    if (!c || !sameStr(c.id) || byId.has(c.id) || !['actual', 'planned'].includes(c.status) || !sameStr(c.quote)
      || c.doc?.id !== doc.id || c.doc?.revision !== doc.revision) return fail('extract_candidate_invalid');
    const para = paragraphOf(d.text, c.quote);
    if (!para || sha256(para) !== c.paragraph_hash) return fail('extract_candidate_not_in_document');
    byId.set(c.id, c);
  }
  // 実際の抽出器の出力（extraction / snapshot / llm）がある場合は、その記録を検査する。進めてよいのは llm が ok、または送信 0 件の skipped だけ
  const extractor = extract.extraction?.extractor ?? extract.snapshot?.extractor ?? extract.extractor ?? null;
  const metadata = extract.llm !== undefined || extract.extraction !== undefined || extract.snapshot !== undefined;
  if (metadata) {
    if (extract.extraction?.extractor !== undefined && extract.snapshot?.extractor !== undefined && extract.extraction.extractor !== extract.snapshot.extractor) return fail('extract_extractor_mismatch');
    const st = extract.llm?.status;
    if (!(st === 'ok' || (st === 'skipped' && extract.delta?.sent === 0))) return fail(`extract_llm_${typeof st === 'string' ? st : 'unknown'}`);
  }
  let cursor = null;
  if (extract.snapshot !== undefined && extract.snapshot !== null) {
    const s = extract.snapshot; const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);
    if (s.docId !== doc.id || s.revision !== doc.revision || !plain(s.paragraphs) || !plain(s.extracted) || !sameStr(s.extractor)
      || Object.values(s.paragraphs).some((n) => !Number.isInteger(n) || n < 1)) return fail('extract_snapshot_invalid');
    cursor = { docId: s.docId, revision: s.revision, paragraphs: s.paragraphs, extracted: s.extracted, extractor: s.extractor };
  }
  const audit = metadata ? { llmStatus: extract.llm?.status ?? null, model: extract.extraction?.model ?? extract.usage?.model ?? null,
    promptSha256: extract.extraction?.promptSha256 ?? null, schemaSha256: extract.extraction?.schemaSha256 ?? null,
    generation: extract.extraction?.generation ?? null, usage: extract.usage ?? null, sent: extract.delta?.sent ?? null } : null;
  return { present: true, valid: true, byId, extractor, audit,
    snapshot: { docId: doc.id, revision: doc.revision, extractor, candidateIds: [...byId.keys()].sort(),
      plannedIds: [...byId.values()].filter((c) => c.status === 'planned').map((c) => c.id).sort(),
      hash: cursor ? sha256(canon(cursor)) : sha256(canon(extract)), ...(cursor ? { cursor } : {}) } };
}

function eligibility(e, asOfDay, docs, ctx = {}) {
  const r = e.review;
  if (!r || !['adopt', 'reject'].includes(r.decision)) return { reason: 'unreviewed' };
  if (r.decision === 'reject') return { reason: 'rejected_by_reviewer' };
  if (e.date > asOfDay) return { reason: 'future_event_date' };
  if (e.teaching === true) { if (r.basis !== 'textbook_fixture' || r.teaching !== true) return { reason: 'unreviewed' }; }
  else {
    if (!sameStr(r.reviewer) || HUMAN_BAD.test(r.reviewer) || !isDate(r.reviewedAt)) return { reason: 'unreviewed' };
    if (r.reviewedAt > asOfDay) return { reason: 'review_after_asOf' };
  }
  if (e.pool) { try { if (buildPool(e.pool).lastEvidenceDate > asOfDay) return { reason: 'pool_evidence_after_asOf' }; } catch (er) { return { reason: er.code }; } }
  // 節目は予定月より前に反映しない（事象の日付が、基準日から節目の月数だけ進んだ日以降であること）
  if (e.gate && ctx.P0 && monthsBetween(ctx.P0.evaluationDate, e.date) < e.gate.month) return { reason: 'gate_before_scheduled_month' };
  let paragraphHash = null; let link = null;
  if (e.teaching !== true || e.source.docId !== undefined) {   // 教材の明細でも、実資料の根拠を併記したものは文書の版と引用を検査する
    const d = docs.get(e.source.docId);
    if (!d || d.revision !== e.source.revision) return { reason: 'source_revision_mismatch' };
    const para = paragraphOf(d.text, e.source.quote);
    if (!para) return { reason: 'quote_not_in_source' };
    if ((e.inputChanges.some((c) => c.kind === 'observation') || e.gate || e.observation) && PLANNED_RE.test(e.source.quote)) return { reason: 'planned_not_actual' };
    paragraphHash = sha256(para);
  }
  if (e.candidateId !== undefined) {
    const x = ctx.ext;
    if (!x?.valid) return { reason: x?.reason ?? 'extract_missing' };
    const c = x.byId.get(e.candidateId);
    if (!c) return { reason: 'candidate_not_in_extract' };
    if (c.status !== 'actual') return { reason: 'candidate_planned' };
    if (c.doc.id !== e.source.docId || c.doc.revision !== e.source.revision) return { reason: 'candidate_doc_mismatch' };
    if (c.quote.normalize('NFC') !== e.source.quote.normalize('NFC')) return { reason: 'candidate_quote_mismatch' };
    if (c.event_date !== e.date) return { reason: 'candidate_date_mismatch' };
    if ((c.event_type ?? null) !== e.type || (c.supplement ?? null) !== (e.supplement ?? null)) return { reason: 'candidate_type_mismatch' };
    if (c.paragraph_hash !== paragraphHash) return { reason: 'candidate_paragraph_mismatch' };
    link = { candidateId: c.id, paragraph: c.source?.paragraph ?? null, position: c.source?.position ?? null, extractor: x.extractor, extractHash: x.snapshot.hash };
  }
  return { reason: null, paragraphHash, link };
}

function applyEntries(P0, entries) {
  const P = structuredClone(P0); const gates = {}; let pool = null; let pooled = new Set(); let failure = null;
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.eventId < b.eventId ? -1 : 1));
  for (const e of sorted) {
    if (failure) {   // 不成立の後に、同じ分岐で節目の通過・入力の変更・分布を足さない（追記は continuation の手順で行う）
      if (e.gate || e.pool || e.inputChanges.length) throw new PilotError('entry_after_failed_gate', e.eventId);
      continue;
    }
    if (e.gate) {
      const m = e.gate.month;
      if (!P.milestones.includes(m)) throw new PilotError('gate_unknown', String(m));
      for (const ms of P.milestones) if (ms < m && !gates[ms]) throw new PilotError('gate_out_of_order', String(m));
      if (e.gate.passed === false) { failure = { entry: e, month: m, gatesPassed: P.milestones.filter((x) => x < m) }; continue; }
      gates[m] = true;
    }
    for (const c of e.inputChanges) {
      if (pooled.has(c.path)) throw new PilotError('pooled_path_overridden', c.path);
      setPath(P, c.path, c.to, c.unit);
    }
    if (e.pool) {
      const np = buildPool(e.pool);
      if (pool) {   // 後の分布が、前の分布の不確かな量を黙って落とさない。落とすなら理由と確定値を明示する
        const kept = new Set(np.quantities.map((q) => q.path));
        for (const q of pool.quantities) {
          if (kept.has(q.path)) continue;
          const r = (e.pool.retired || []).find((x) => x.path === q.path);
          if (!r || typeof r.to !== 'number') throw new PilotError('pool_discards_uncertainty', q.path);
          setPath(P, q.path, r.to, r.unit);
        }
      }
      pool = { entryId: e.eventId, ...np }; pooled = new Set(pool.quantities.map((q) => q.path));
    }
  }
  return { P, gates, pool, failure };
}
/** 不成立の登録明細から、分岐を開く（資料の根拠は明細の出所）。 */
function openFromFailure(P, failure) {
  const e = failure.entry; const rv = e.review?.reviewedAt;
  return openFailedContinuation(P, { gate: { month: failure.month, passed: false }, gatesPassed: failure.gatesPassed, date: e.date, recordedAt: rv && rv > e.date ? rv : e.date,
    evidence: { docId: e.source.docId, revision: e.source.revision, quote: e.source.quote } });
}
const truncateContinuation = (s, n) => ({ ...s, steps: s.steps.slice(0, n), head: n ? s.steps[n - 1].hash : stepHash(null, s.failure) });
const evalState = (P0, entries, month, pending = null, cont = null) => {
  const { P, gates, pool, failure } = applyEntries(P0, entries);
  if (failure) {
    if (pool) throw new PilotError('failed_continuation_pool_unsupported', '不成立の評価は固定入力1組だけ。分布を含む継続は未対応');
    const s = cont ?? openFromFailure(P, failure);
    const c = evaluateContinuation(P, s, month);
    return { P, pool: null, failure, cont: s, result: { n: 1, icv: c.icv, rnpv: c.rnpv, cash: c.cash, future: c.rnpv - c.cash, restricted: P.restricted,
      quantiles: { status: 'uncalculated', reason: 'failed_branch_fixed_input' }, method: { approximate: false, kind: 'fixed_input' }, continuation: c } };
  }
  const result = ensemble(P, pool ? pool.draws : [{ weight: 1, values: {} }], month, { gates, pendingGate: pending });
  result.method = pool ? pool.method : { approximate: false, kind: 'fixed_input' };   // 分位点が節点からの数値計算かどうか
  return { P, pool, result };
};

// ───────────────────────────────────────────────────────── plan

const emptyState = () => ({ v: STATE_V, seq: 0, baseHash: null, entries: {}, snapshots: [], forecasts: {}, actuals: {}, lastKey: null, extract: null, links: {} });
const fmt = (x) => (typeof x === 'number' ? round(x) : x ?? '');
const q3 = (r, k) => (r.quantiles.status === 'calculated' ? [r.quantiles[k].p10, r.quantiles[k].p50, r.quantiles[k].p90].map(round) : ['未計算', '未計算', '未計算']);

function validateForecast(f) {
  const ok = f && [f.question, f.criterion, f.event].every(sameStr) && typeof f.probability === 'number' && f.probability >= 0 && f.probability <= 1 && isDate(f.deadline);
  if (!ok) throw new PilotError('bad_forecast');
}
const forecastId = (f) => `fc-${sha256([f.question, f.deadline, f.event].join('\u0001')).slice(0, 10)}`;

export function plan(input) {
  const { state: prev = null, base, registry, docs = [], asOf, forecast, actual, tabs, spreadsheetId, extract } = input || {};
  if (!isIso(asOf)) throw new PilotError('bad_asOf');
  if (typeof spreadsheetId !== 'string' || !spreadsheetId) throw new PilotError('bad_spreadsheetId');
  for (const n of Object.values(TAB_NAMES1)) if (!Number.isInteger(tabs?.[n])) throw new PilotError('bad_tabs', n);
  if (prev && prev.v !== STATE_V) throw new PilotError('legacy_state_rejected');
  if (!base || !Array.isArray(registry)) throw new PilotError('bad_input');
  const P0 = normalizeInputs(base.inputs); checkProvenance(base.provenance, P0);
  const baseHash = sha256(canon(base));
  const st = prev ? JSON.parse(JSON.stringify(prev)) : emptyState();
  if (st.baseHash && st.baseHash !== baseHash) throw new PilotError('base_changed');
  const asOfDay = dayOf(asOf); const month = monthsBetween(P0.evaluationDate, asOfDay);
  if (month < 0) throw new PilotError('month_out_of_range', String(month));   // 通常の予測の上限は、不成立が確定した後の継続評価では適用しない（下で再検査）
  const lastSnap = st.snapshots[st.snapshots.length - 1] || null;
  if (lastSnap && asOf < lastSnap.asOf) throw new PilotError('asOf_before_last_snapshot');
  const docMap = new Map((docs || []).map((d) => [d.id, d]));

  const ids = new Set();
  for (const e of registry) { validateEntry(e); if (ids.has(e.eventId)) throw new PilotError('entry_duplicate', e.eventId); ids.add(e.eventId); }
  const byId = new Map(registry.map((e) => [e.eventId, e]));
  const entryHash = (e) => sha256(canon(e));
  for (const [id, h] of Object.entries(st.entries)) {                 // 採用済みの明細は書き換え・削除できない
    if (!byId.has(id)) throw new PilotError('adopted_entry_missing', id);
    if (entryHash(byId.get(id)) !== h) throw new PilotError('entry_modified', id);
  }
  const prevEntries = Object.keys(st.entries).map((id) => byId.get(id));
  const newly = []; const pending = []; const hashes = {}; const links = {};
  const ext = checkExtract(extract, docMap);
  for (const e of [...registry].sort((a, b) => (a.eventId < b.eventId ? -1 : 1))) {
    if (st.entries[e.eventId]) continue;
    const el = eligibility(e, asOfDay, docMap, { P0, ext });
    if (el.reason) pending.push({ id: e.eventId, reason: el.reason }); else { newly.push(e); hashes[e.eventId] = el.paragraphHash; if (el.link) links[e.eventId] = el.link; }
  }
  // 抽出結果の検査に通ったときだけ、次の版へ引き継ぐスナップショットを進める。失敗時は前のまま
  const extractAdvanced = ext.valid && st.extract?.hash !== ext.snapshot.hash;
  if (extractAdvanced) st.extract = { ...ext.snapshot, asOf, ...(ext.audit ? { audit: ext.audit } : {}), previous: st.extract ? { docId: st.extract.docId, revision: st.extract.revision, hash: st.extract.hash } : null };
  const extractLog = ext.valid && ext.audit ? ` / 抽出 ${ext.audit.llmStatus} モデル ${ext.audit.model ?? '-'} プロンプト ${(ext.audit.promptSha256 ?? '-').slice(0, 12)} 設定 ${canon(ext.audit.generation)} 使用 ${canon(ext.audit.usage)}` : '';
  st.links ??= {};
  for (const [id, l] of Object.entries(links)) st.links[id] = l;

  // 予測の新規保存は評価計算より前に検証（期限は記録日より後）
  if (forecast) { validateForecast(forecast); if (!st.forecasts[forecastId(forecast)] && !(forecast.deadline > asOfDay)) throw new PilotError('forecast_deadline_not_future', forecastId(forecast)); }

  const allEntries = [...prevEntries, ...newly];
  // 教材以外の推定値は、採用済みの評価者2名の分布が覆うか、資料で固定された値であること
  for (const it of base.provenance) {
    if (it.teaching || it.kind !== 'estimate') continue;
    if (it.fixedBy) {
      const d = docMap.get(it.fixedBy.docId);
      if (!d || d.revision !== it.fixedBy.revision || !paragraphOf(d.text, it.fixedBy.quote)) throw new PilotError('base_fixed_source_invalid', JSON.stringify(it.paths));
      continue;
    }
    const pe = allEntries.find((e) => e.eventId === it.coveredByPool && e.pool);
    const qs = new Set((pe?.pool.quantities || []).map((q) => q.path));
    for (const p of it.paths) {
      const leaves = leafPaths(P0).filter((lp) => lp === p || lp.startsWith(`${p}.`));
      if (!pe || !leaves.length || leaves.some((lp) => !qs.has(lp))) throw new PilotError('base_uncertain_unpooled', p);
    }
  }
  // 不成立の分岐: 登録簿の不成立明細から開き、呼び出し側の追記（continuation か continuationSteps）を資料・日付・鎖で検証する
  const hasFailure = allEntries.some((e) => e.gate && e.gate.passed === false);
  if (month > P0.horizon && !hasFailure) throw new PilotError('month_out_of_range', String(month));
  if ((input.continuation !== undefined || input.continuationSteps !== undefined) && !hasFailure) throw new PilotError('continuation_without_failure');
  let branch = null;
  if (hasFailure) {
    const ap = applyEntries(P0, allEntries);
    if (ap.pool) throw new PilotError('failed_continuation_pool_unsupported', '不成立の評価は固定入力1組だけ。分布を含む継続は未対応');
    if (input.continuation !== undefined && input.continuationSteps !== undefined) throw new PilotError('continuation_input_ambiguous');
    const opened = openFromFailure(ap.P, ap.failure);
    let s = opened;
    if (input.continuation !== undefined) {
      s = input.continuation; verifyContinuation(ap.P, s);
      if (canon(s.failure) !== canon(opened.failure)) throw new PilotError('continuation_not_bound_to_failure');
      // 呼び出し側が鎖を再計算して作れる値に頼らず、各手順を開いた状態から順に追記し直して同一かを確かめる
      let rebuilt = opened;
      for (const x of s.steps) rebuilt = appendContinuationStep(ap.P, rebuilt, x);
      if (canon(rebuilt) !== canon(s)) throw new PilotError('continuation_not_canonical');
    } else if (input.continuationSteps !== undefined) {
      if (!Array.isArray(input.continuationSteps)) throw new PilotError('continuation_steps_invalid');
      for (const x of input.continuationSteps) s = appendContinuationStep(ap.P, s, x);
    }
    const old = st.failedBranch;   // 前回までの鎖は先頭から一致していること（追記のみ）。根拠の検査より先に行う
    if (old && (old.openHead !== opened.head || old.chain.length > s.steps.length || old.chain.some((h, i) => s.steps[i].hash !== h))) throw new PilotError('continuation_not_append_only');
    const checked = old ? old.chain.length : 0;   // 受理済みの手順の根拠は、確定した鎖の一致で足りる。新しい手順だけ最新の資料と照合する
    s.steps.forEach((x, i) => {
      if (x.date > asOfDay || x.recordedAt > asOfDay) throw new PilotError('continuation_future_step', x.id);   // 記録日より後の事実は入れない
      if (i < checked) return;
      const d = docMap.get(x.evidence.docId);
      if (!d || d.revision !== x.evidence.revision || !paragraphOf(d.text, x.evidence.quote)) throw new PilotError('continuation_evidence_unbound', x.id);
    });
    branch = { state: s, openHead: opened.head, prevCount: old ? old.chain.length : 0 };
    st.failedBranch = { month: ap.failure.month, openHead: opened.head, chain: s.steps.map((x) => x.hash), head: s.head };
  }
  const key = sha256(canon({ baseHash, month, ids: allEntries.map((e) => e.eventId).sort(), h: allEntries.map(entryHash).sort(), mv: EVAL_MODEL_VERSION, ...(branch ? { cont: branch.state.head } : {}) }));
  const requests = []; const evalRows = []; const regRows = []; const fcRows = [];
  let evaluation = null; const version = st.seq + 1;
  if (st.lastKey !== key) {
    const cur = evalState(P0, allEntries, month, null, branch?.state ?? null);
    // 同月・更新前: 前の入力のまま同じ月に評価。新しい節目が当月なら、その節目の成否を反映する前の値。
    let before = 'unavailable';
    if (lastSnap && !(month > P0.horizon && !prevEntries.some((e) => e.gate && e.gate.passed === false))) {
      const pg = newly.find((e) => e.gate && e.gate.month === month)?.gate.month ?? null;
      const prevFailed = prevEntries.some((e) => e.gate && e.gate.passed === false);
      try { before = evalState(P0, prevEntries, month, pg, prevFailed && branch ? truncateContinuation(branch.state, branch.prevCount) : null).result; }
      catch (er) { if (er.code !== 'gate_not_confirmed' && !prevFailed) throw er; }
    }
    const r = cur.result;
    const classification = !lastSnap ? 'initial' : !newly.length ? (branch && branch.state.steps.length > branch.prevCount ? 'continuation_update' : 'time_passage')
      : newly.some((e) => e.gate && e.gate.passed === false) ? 'gate_failure' : newly.some((e) => e.gate) ? 'gate_passage'
      : newly.every((e) => e.inputChanges.length && e.inputChanges.every((c) => c.kind === 'estimate') || e.pool) ? 'estimate_update'
        : newly.every((e) => e.inputChanges.length && e.inputChanges.every((c) => c.kind === 'observation')) ? 'observation_update' : 'mixed_update';
    const fb = cur.failure ? r.continuation : null;
    const inputHash = sha256(canon({ P: cur.P, pool: cur.pool?.hash ?? null, month, ...(cur.failure ? { cont: cur.cont.head } : {}) }));
    const srcLabel = (e) => (e.teaching ? `教材: ${e.source.citation}${e.source.docId ? ` / ${e.source.docId}@${e.source.revision}` : ''}` : `${e.source.docId}@${e.source.revision}`);
    const docsUsed = [...new Set(allEntries.map(srcLabel))];
    const inputJson = canon({ month, inputs: cur.P, pool: cur.pool ? { entryId: cur.pool.entryId, id: cur.pool.id, hash: cur.pool.hash, n: cur.pool.draws.length, keptInitial: cur.pool.keptInitial,
      summaries: Object.fromEntries(Object.entries(cur.pool.summaries).map(([p, s]) => [p, { unit: s.unit, initialMixed: s.initialMixed, mixed: s.mixed }])), method: cur.pool.method } : null,
      ...(cur.failure ? { failedBranch: { failure: cur.cont.failure, steps: cur.cont.steps, head: cur.cont.head } } : {}) });
    const teachingPaths = base.provenance.filter((it) => it.teaching).flatMap((it) => it.paths);
    const meta = canon({ evalModel: EVAL_MODEL_VERSION, bookReference: BOOK_REFERENCE, evaluatorWeights: cur.pool ? 'equal(0.5,0.5)' : 'none(fixed input)', provenance: base.provenance,
      selectedModel: { label: teachingPaths.length ? '教材モデル（textbook_fixture）を選択' : '教材モデルなし', teachingPaths },
      quantiles: r.quantiles.status, numericalMethod: r.method,
      ...(fb ? { failedBranch: { version: FAILED_CONT_VERSION, failureMonth: fb.failureMonth, stage: fb.stage, head: fb.head, steps: fb.steps } } : {}), scope: '決定木 §9.5 / 13 / 14（月次の全体シミュレーションではない）' });
    if (inputJson.length > MAX_CELL || meta.length > MAX_CELL) throw new PilotError('snapshot_too_large');
    // 差分は生の値で計算し、丸めるのはシートに書くときだけ
    const dI = lastSnap ? round(r.icv - lastSnap.icv) : '', dR = lastSnap ? round(r.rnpv - lastSnap.rnpv) : '';
    evalRows.push([version, asOf, month, classification, EVAL_MODEL_VERSION, lastSnap ? lastSnap.version : '', round(r.icv), round(r.rnpv), round(r.cash), round(r.future), round(r.restricted),
      ...q3(r, 'icv'), ...q3(r, 'rnpv'), r.quantiles.status === 'calculated' ? '計算済み' : `未計算(${r.quantiles.reason})`, r.n,
      before === 'unavailable' ? 'unavailable' : round(before.icv), before === 'unavailable' ? 'unavailable' : round(before.rnpv),
      lastSnap ? round(lastSnap.icv) : '', lastSnap ? round(lastSnap.rnpv) : '', dI, dR, newly.map((e) => e.eventId).join('\n'), inputHash, inputJson, docsUsed.join('\n'), meta]);
    for (const e of newly) {
      const json = canon(e);
      if (json.length > MAX_CELL) throw new PilotError('entry_too_large', e.eventId);
      st.entries[e.eventId] = entryHash(e);
      let poolJson = '';
      if (e.pool) {
        const bp = buildPool(e.pool);
        poolJson = canon({ pool: e.pool, summaries: bp.summaries, adoption: bp.adoption, method: bp.method });
        if (poolJson.length > MAX_CELL) throw new PilotError('entry_too_large', e.eventId);
      }
      const lk = links[e.eventId];
      const lkText = lk ? ` [抽出 ${lk.candidateId}${lk.paragraph ? ` ${lk.paragraph}` : ''}${lk.position != null ? ` 位置${typeof lk.position === 'object' ? canon(lk.position) : lk.position}` : ''}]` : '';
      regRows.push([e.eventId, e.date, e.type ?? (e.supplement ? `補足:${e.supplement}` : '教材:未割当'), e.summary, e.sourceTag, e.contractParty ?? '', e.targets.join('、'), e.changeText, `${e.recordedBy}、版 ${version}`,
        e.review.reviewer ?? '(教材の仮定)', e.review.reviewedAt ?? '', srcLabel(e) + lkText,
        e.source.quote ?? '', hashes[e.eventId] ?? '', canon(e.inputChanges), poolJson, st.entries[e.eventId], e.teaching ? 'はい' : 'いいえ']);
    }
    st.snapshots.push({ version, asOf, month, classification, key, icv: r.icv, rnpv: r.rnpv, entryIds: newly.map((e) => e.eventId) });   // 生の値（シートに書くときだけ丸める）
    st.seq = version; st.lastKey = key; st.baseHash = baseHash;
    evaluation = { version, month, classification, icv: r.icv, rnpv: r.rnpv, cash: r.cash, future: r.future, restricted: r.restricted, quantiles: r.quantiles,
      method: r.method, bookReference: BOOK_REFERENCE,
      ...(fb ? { failedBranch: { stage: fb.stage, failureMonth: fb.failureMonth, signMonth: fb.signMonth ?? null, expensePV: fb.expensePV, remainingExpenses: fb.remainingExpenses, steps: fb.steps, head: fb.head } } : {}),
      before: before === 'unavailable' ? before : { icv: before.icv, rnpv: before.rnpv }, prior: lastSnap ? { icv: lastSnap.icv, rnpv: lastSnap.rnpv, version: lastSnap.version } : null };
  }
  const snap = st.snapshots[st.snapshots.length - 1] || null;

  // 予測: 保存後は固定。その時点の版と値を併記する
  let forecastSaved = null;
  if (forecast) {
    const id = forecastId(forecast); const old = st.forecasts[id];
    if (old) { if (old.probability !== forecast.probability || old.criterion !== forecast.criterion) throw new PilotError('forecast_immutable', id); }
    else {
      if (!snap) throw new PilotError('forecast_needs_snapshot');
      st.forecasts[id] = { question: forecast.question, probability: forecast.probability, deadline: forecast.deadline, criterion: forecast.criterion, event: forecast.event, savedAt: asOf, version: snap.version };
      fcRows.push(['予測', id, asOf, forecast.question, forecast.probability, forecast.deadline, forecast.criterion, forecast.event, '', '', '', '', snap.version, snap.icv, snap.rnpv]);
      forecastSaved = id;
    }
  }
  // 実績: 以前の実行で固定した予測に、確認済み（採用）の観測だけで結果を付ける。評価値は書き換えない
  let actualRecorded = null;
  if (actual) {
    const fc = prev?.forecasts?.[actual.forecastId];
    if (!fc) throw new PilotError('forecast_not_saved', String(actual.forecastId));
    if (st.actuals[actual.forecastId]) throw new PilotError('actual_duplicate', actual.forecastId);
    const e = st.entries[actual.entryId] ? byId.get(actual.entryId) : null;
    if (!e?.observation) throw new PilotError('entry_not_adopted_observation', String(actual.entryId));
    const nm = (s) => String(s ?? '').normalize('NFC').trim();
    if (nm(e.observation.event) !== nm(fc.event)) throw new PilotError('event_name_mismatch');
    if (!(e.date > dayOf(fc.savedAt))) throw new PilotError('observation_not_after_forecast');
    if (!(e.date <= asOfDay)) throw new PilotError('observation_after_asOf');
    const derived = e.observation.achieved ? 'yes' : 'no';
    if (actual.outcome !== derived) throw new PilotError('outcome_mismatch');
    if (derived === 'yes' && e.date > fc.deadline) throw new PilotError('achieved_after_deadline');
    if (derived === 'no' && (asOfDay < fc.deadline || e.date < fc.deadline)) throw new PilotError('no_before_deadline');   // 「ならなかった」は期限当日以降の観測だけ
    st.actuals[actual.forecastId] = { outcome: derived, entryId: e.eventId, recordedAt: asOf };
    fcRows.push(['実績', actual.forecastId, asOf, '', '', '', '', '', derived, e.eventId, e.date, e.teaching ? `${e.source.citation}${e.source.quote ? ` / ${e.source.quote}` : ''}` : e.source.quote, fc.version, '', '']);
    actualRecorded = actual.forecastId;
  }

  if (evalRows.length) requests.push(appendReq(tabs[TAB_NAMES1.eval], evalRows));
  if (regRows.length) requests.push(appendReq(tabs[TAB_NAMES1.reg], regRows));
  if (fcRows.length) requests.push(appendReq(tabs[TAB_NAMES1.fc], fcRows));
  let newState = prev;
  if (requests.length || extractAdvanced) {
    newState = st;
    const json = canon(st);
    if (json.length > MAX_CELL) throw new PilotError('state_too_large');
    requests.push(appendReq(tabs[TAB_NAMES1.log], [[asOf, evaluation ? version : '', st.lastKey || '', `採用${newly.length}件 / 保留・不採用${pending.length}件 / 評価${evalRows.length}行 / 予測・実績${fcRows.length}行${extractLog}`]]));
    requests.push({ updateCells: { start: { sheetId: tabs[TAB_NAMES1.log], rowIndex: 1, columnIndex: 1 }, rows: [{ values: [cell(json)] }], fields: 'userEnteredValue' } });
  }
  return { kind: 'plan', spreadsheetId, prevStateHash: stateHash(prev), state: newState, requests,
    summary: { status: requests.length ? 'write' : 'no_change', extract: { status: !ext.present ? 'none' : ext.valid ? 'validated' : `failed:${ext.reason}`, snapshotAdvanced: extractAdvanced }, evaluation, adopted: newly.map((e) => e.eventId), pending, forecastSaved, actualRecorded,
      evalModel: EVAL_MODEL_VERSION } };
}

export const init1 = (input) => init(input, { tabs: TAB_NAMES1, headers: HEADERS1 });

// ───────────────────────────────────────────────────────── 節目の不成立後の継続（下書き分岐）
// 範囲: 第9章の固定の決定木は、不成立で節目の列を閉じる（月次の再試行は第7章 R2 の話で、ここでは扱わない）。
//   この分岐は、観測した不成立（passed:false）の後に、署名前 / 署名済み / ライセンスなし を、日付つきの追記だけで進める。
//   月次の全体エンジン（plan）には接続しない。純関数だけを出す。将来に実現する資金は入れない（recordedAt 以前の事実のみ）。
//   不成立後の評価額は downAt（式 14.1 の不成立側）と同じ式で、割引は署名までの 1 回だけ、実際の自由資金は 1 回だけ数える。

export const FAILED_CONT_VERSION = 'bzm1.0-failed-continuation/1';
export const FAILED_CONT_STATE_V = 'bzm1-failed-cont-1';
const WAIT_MONTHS = 6;   // 不成立から署名までの月数（downAt の disc(6, ·) と同じ）
const CONT_UPDATE_PATHS = new Set(['upfront', 'qk', 'lag', 'royrate', 'netshare', 'sales', 'purchase', 'labor', 'tax', 'ramp',
  'rates.private', 'rates.industrial', 'rates.hazard']);
const STEP_TYPES = ['input_update', 'expense_plan', 'expense_paid', 'expense_cancelled', 'signed', 'no_license'];
const REALIZED = new Set(['expense_paid', 'signed']);
const sumBy = (xs, f) => xs.reduce((a, x) => a + f(x), 0);

function checkEvidence(ev, where) {
  const ok = sameStr(ev?.docId) && sameStr(ev?.revision) && sameStr(ev?.quote) && ev.quote.length <= 400;
  if (!ok) throw new PilotError('continuation_evidence_missing', where);
  if (PLANNED_RE.test(ev.quote)) throw new PilotError('planned_not_actual', where);
  return { docId: ev.docId, revision: ev.revision, quote: ev.quote };
}
function checkGatesPassed(P, m, gatesPassed) {
  if (!P.milestones.includes(m)) throw new PilotError('gate_unknown', String(m));
  const gp = new Set(gatesPassed ?? []);
  for (const ms of P.milestones) {
    if (ms < m && !gp.has(ms)) throw new PilotError('gate_out_of_order', String(m));
    if (ms >= m && gp.has(ms)) throw new PilotError('gate_already_passed', String(ms));
  }
  return [...gp].sort((a, b) => a - b);
}
/** 不成立の月の、署名前評価（式 14.1 の不成立側）。downAt と同じ値。rNPV と ICV は億円。 */
export function failureValue(P, month, gatesPassed) {
  checkGatesPassed(P, month, gatesPassed);
  const d = downAt(P, month);
  return { month, rnpv: d.total, icv: d.ind, cash: cashAt(P, month - 1) + P.flowsDown[month] * MAN, licenseProbability: P.l[month], signMonth: month + WAIT_MONTHS };
}
/** UI 用: ある節目の通過側と不成立側を並べる。通過側は出資を含む。ordered は表示順（rNPV, ICV）。 */
export function compareGateOutcomes(P, month, gatesPassed) {
  const gp = checkGatesPassed(P, month, gatesPassed);
  const gates = Object.fromEntries(gp.map((m) => [m, true]));
  const before = evaluateAt(P, month, { gates, pendingGate: month });
  const upGates = { ...gates, [month]: true };
  const up = evaluateAt(P, month, { gates: upGates });
  const down = failureValue(P, month, gp);
  const p = P.p[month];
  return { month, p, before: { rnpv: before.total, icv: before.ind },
    up: { rnpv: up.total, icv: up.ind, cash: up.cash }, down: { rnpv: down.rnpv, icv: down.icv, cash: down.cash },
    ordered: { up: [up.total, up.ind], down: [down.rnpv, down.icv] },
    expected: { rnpv: p * up.total + (1 - p) * down.rnpv, icv: p * up.ind + (1 - p) * down.icv } };
}
/** UI 用: 全節目の比較（各節目は、それ以前をすべて通過した条件）。 */
export function compareAllGates(P) {
  return P.milestones.map((m) => compareGateOutcomes(P, m, P.milestones.filter((x) => x < m)));
}
/** UI 用: 不成立後に追記できる手順と、その条件。 */
export function continuationOptions(P, state, month) {
  const st = state?.steps ?? [];
  const has = (t) => st.some((s) => s.type === t);
  const closed = has('no_license'); const signed = has('signed');
  const unpaid = unresolvedExpenses(st);
  return [
    { type: 'expense_plan', available: !closed, needs: ['expenses[{id,month,amountMan,label}]', 'evidence'] },
    { type: 'expense_paid', available: !closed && unpaid.length > 0, needs: ['expenseId', 'amountMan', 'evidence'], candidates: unpaid.map((e) => e.id) },
    { type: 'expense_cancelled', available: !closed && unpaid.length > 0, needs: ['expenseId', 'evidence'], candidates: unpaid.map((e) => e.id) },
    { type: 'input_update', available: !closed, needs: ['changes[{path,to,unit}]', 'kind=observation', 'evidence'], paths: [...CONT_UPDATE_PATHS, `l.${state?.failure?.month ?? month}`] },
    { type: 'signed', available: !closed && !signed, needs: ['upfrontMan', 'evidence'] },
    { type: 'no_license', available: !closed && !signed, needs: ['evidence'] },
  ];
}
function unresolvedExpenses(steps) {
  const m = new Map();
  for (const s of steps) {
    if (s.type === 'expense_plan') for (const e of s.expenses) m.set(e.id, { ...e, status: 'planned' });
    else if (s.type === 'expense_paid' && s.expenseId && m.has(s.expenseId)) m.get(s.expenseId).status = 'paid';
    else if (s.type === 'expense_cancelled') m.get(s.expenseId).status = 'cancelled';
  }
  return [...m.values()].filter((e) => e.status === 'planned');
}

const stepHash = (prevHash, body) => sha256(canon({ prevHash, body }));
/** 観測した不成立から分岐を開く。passed:false の明示と、実際の根拠が要る。通過済みの節目も明示する。 */
export function openFailedContinuation(P, { gate, gatesPassed, date, recordedAt, evidence } = {}) {
  if (!gate || gate.passed !== false || !Number.isInteger(gate.month)) throw new PilotError('continuation_requires_observed_failure');
  const gp = checkGatesPassed(P, gate.month, gatesPassed);
  if (!isDate(date) || !isDate(recordedAt) || date > recordedAt) throw new PilotError('continuation_date_invalid');
  const month = monthsBetween(P.evaluationDate, date);
  if (month !== gate.month) throw new PilotError('failure_month_mismatch', `${month} != ${gate.month}`);
  const ev = checkEvidence(evidence, 'failure');
  const failure = { month: gate.month, date, recordedAt, gatesPassed: gp, evidence: ev, inputHash: sha256(canon(P)) };
  return { v: FAILED_CONT_STATE_V, version: FAILED_CONT_VERSION, failure, steps: [], head: stepHash(null, failure) };
}

function checkStep(P, state, step) {
  const f = state.failure; const bad = (c, d) => { throw new PilotError(c, d ?? step?.id ?? '?'); };
  if (state.v !== FAILED_CONT_STATE_V) bad('continuation_state_invalid');
  if (sha256(canon(P)) !== f.inputHash) bad('continuation_input_changed');
  if (!step || !sameStr(step.id) || !STEP_TYPES.includes(step.type)) bad('continuation_step_invalid');
  if (state.steps.some((s) => s.id === step.id)) bad('continuation_step_duplicate');
  if (!isDate(step.date) || !isDate(step.recordedAt) || step.date > step.recordedAt) bad('continuation_date_invalid');
  const month = monthsBetween(P.evaluationDate, step.date);
  if (month < f.month) bad('continuation_before_failure');
  const last = state.steps[state.steps.length - 1];
  if (last && (step.date < last.date || step.recordedAt < last.recordedAt)) bad('continuation_out_of_order');   // 追記のみ・日付は戻さない
  if (step.recordedAt < f.recordedAt) bad('continuation_out_of_order');
  if (step.type !== 'expense_cancelled' && state.steps.some((s) => s.type === 'no_license')) bad('continuation_closed');   // 閉じた後は、未払い支出の取消だけ追記できる
  const ev = checkEvidence(step.evidence, step.id);
  const body = { id: step.id, type: step.type, date: step.date, recordedAt: step.recordedAt, month, evidence: ev };
  const planned = new Map(); for (const e of unresolvedExpenses(state.steps)) planned.set(e.id, e);
  const known = new Map(); for (const s of state.steps) if (s.type === 'expense_plan') for (const e of s.expenses) known.set(e.id, e);
  switch (step.type) {
    case 'input_update': {
      if (step.kind !== 'observation') bad('estimate_requires_pool');
      if (!Array.isArray(step.changes) || !step.changes.length) bad('continuation_changes_missing');
      body.kind = 'observation';
      body.changes = step.changes.map((c) => {
        if (!(CONT_UPDATE_PATHS.has(c.path) || c.path === `l.${f.month}`)) bad('continuation_path_not_allowed', c.path);
        if (c.unit !== unitOf(c.path)) bad('unit_mismatch', c.path);
        checkValue(c.path, c.to);
        return { path: c.path, to: c.to, unit: c.unit };
      });
      if (state.steps.some((s) => s.type === 'signed') && body.changes.some((c) => c.path.startsWith('l.'))) bad('license_probability_after_signature');
      break;
    }
    case 'expense_plan': {
      if (!Array.isArray(step.expenses) || !step.expenses.length) bad('continuation_expenses_missing');
      if (state.steps.some((s) => s.type === 'signed')) bad('plan_after_signature_requires_new_step');
      const ids = new Set();
      body.expenses = step.expenses.map((e) => {
        if (!sameStr(e.id) || known.has(e.id) || ids.has(e.id) || !sameStr(e.label)) bad('expense_invalid', e?.id);
        if (!Number.isInteger(e.month) || e.month <= month || !(typeof e.amountMan === 'number' && Number.isFinite(e.amountMan) && e.amountMan >= 0)) bad('expense_invalid', e.id);
        ids.add(e.id);
        return { id: e.id, month: e.month, amountMan: e.amountMan, label: e.label };
      });
      break;
    }
    case 'expense_paid': {
      const e = planned.get(step.expenseId);
      if (!e) bad('expense_not_planned', String(step.expenseId));
      if (!(typeof step.amountMan === 'number' && Number.isFinite(step.amountMan) && step.amountMan >= 0)) bad('expense_invalid', step.id);
      body.expenseId = e.id; body.amountMan = step.amountMan;   // 計画の金額は書き換えない。実際の額を別に持つ
      break;
    }
    case 'expense_cancelled': {
      if (!planned.has(step.expenseId)) bad('expense_not_planned', String(step.expenseId));
      body.expenseId = step.expenseId;
      break;
    }
    case 'signed': {
      if (state.steps.some((s) => s.type === 'signed')) bad('continuation_already_signed');
      if (month <= f.month) bad('signature_not_after_failure');
      if (!(typeof step.upfrontMan === 'number' && Number.isFinite(step.upfrontMan) && step.upfrontMan >= 0)) bad('upfront_missing');   // 署名の一時金を推定で作らない
      body.upfrontMan = step.upfrontMan;
      break;
    }
    case 'no_license': break;
    default: bad('continuation_step_invalid');
  }
  return { body, month };
}
/** 追記。既存の手順は変えない。返す状態は新しいオブジェクト。 */
export function appendContinuationStep(P, state, step) {
  const { body, month } = checkStep(P, state, step);
  const hash = stepHash(state.head, body);
  return { ...state, steps: [...state.steps, { ...body, month, prevHash: state.head, hash }], head: hash };
}
/** 追記の鎖を検証する（途中の書き換え・削除を検知）。 */
export function verifyContinuation(P, state) {
  if (state?.v !== FAILED_CONT_STATE_V) throw new PilotError('continuation_state_invalid');
  let h = stepHash(null, state.failure);
  for (const s of state.steps) {
    const { prevHash, hash, ...body } = s;
    if (prevHash !== h || stepHash(h, body) !== hash) throw new PilotError('continuation_chain_broken', s.id);
    h = hash;
  }
  if (h !== state.head) throw new PilotError('continuation_chain_broken', 'head');
  if (sha256(canon(P)) !== state.failure.inputHash) throw new PilotError('continuation_input_changed');
  return true;
}

/** 説明用の署名待ち支出の評価日現在価値（億円）。各月の支出を割引率 K で t 月へ割り引く。 */
export function expenseScheduleValue(P, expenses, t = 0) {
  return sumBy(expenses, (e) => (e.amountMan * MAN) * disc(e.month - t, P.rates.private));
}
/** 署名待ちの資金の推移（万円）。支出のあと・一時金の前後の残高。資金の不足は負の残高。 */
export function waitingBalances({ initialCashMan, expenses, upfront }) {
  if (typeof initialCashMan !== 'number' || !Number.isFinite(initialCashMan)) throw new PilotError('missing_input', 'initialCashMan');
  let bal = initialCashMan; const rows = [];
  for (const e of [...expenses].sort((a, b) => a.month - b.month)) {
    const inc = upfront && upfront.month === e.month ? upfront.amountMan : 0;
    bal -= e.amountMan;
    rows.push({ month: e.month, expenseMan: e.amountMan, upfrontMan: inc, beforeUpfront: bal, afterUpfront: bal + inc });
    bal += inc;
  }
  const total = sumBy(expenses, (e) => e.amountMan);
  return { rows, totalMan: total, bridgeMan: upfront ? total - initialCashMan : null, endMan: bal };
}

/** 月 t の評価。steps のうち month<=t の事実だけを使い、将来に実現する資金は入れない。 */
export function evaluateContinuation(P0, state, month) {
  verifyContinuation(P0, state);
  const f = state.failure; const t = month;
  if (!Number.isInteger(t) || t < f.month) throw new PilotError('month_out_of_range', String(t));
  const used = state.steps.filter((s) => s.month <= t);
  const P = structuredClone(P0);
  for (const s of used) if (s.type === 'input_update') for (const c of s.changes) setPath(P, c.path, c.to, c.unit);
  const exp = new Map(); let cash = cashAt(P0, f.month - 1) + P0.flowsDown[f.month] * MAN;   // 不成立月の実際の自由資金（1 回だけ）
  let signed = null; let closed = null;
  for (const s of used) {
    if (s.type === 'expense_plan') for (const e of s.expenses) exp.set(e.id, { ...e, status: 'planned' });
    else if (s.type === 'expense_paid') { cash -= s.amountMan * MAN; exp.get(s.expenseId).status = 'paid'; }
    else if (s.type === 'expense_cancelled') exp.get(s.expenseId).status = 'cancelled';
    else if (s.type === 'signed') { signed = s; cash += s.upfrontMan * MAN; }
    else if (s.type === 'no_license') closed = s;
  }
  const remaining = [...exp.values()].filter((e) => e.status === 'planned');
  const overdue = remaining.find((e) => e.month <= t);
  if (overdue) throw new PilotError('expense_unconfirmed', overdue.id);   // 月が来た支出は、支払か取消の事実が要る
  const K = P.rates.private; const D = P.rates.industrial; const { licP, licI } = pieces(P); const l = P.l[f.month];
  const pv = expenseScheduleValue(P, remaining, t);
  const base = { month: t, failureMonth: f.month, cash, expensePV: pv, remainingExpenses: remaining.map((e) => e.id), steps: used.length, head: state.head };
  if (closed) {
    if (remaining.length) throw new PilotError('expenses_pending_after_close', remaining[0].id);   // 閉じた後の未払い支出は、取消の事実を追記してから
    return { ...base, stage: 'no_license', rnpv: cash, icv: 0, license: null };
  }
  if (signed) {
    const end = signed.month + P.lag;
    if (t > end) throw new PilotError('beyond_explicit_horizon', String(t));   // 量産契約後の収入は明示の入力がなければ作らない
    const roy = P.qk * stream(P, P.royrate * P.sales, K) * disc(end - t, K);
    const { G } = pieces(P);
    return { ...base, stage: 'signed', signMonth: signed.month, rnpv: cash + roy - pv, icv: P.qk * G * disc(end - t, D), license: { royalty: roy, upfrontReceivedMan: signed.upfrontMan } };
  }
  const S = f.month + WAIT_MONTHS;
  if (t > S) throw new PilotError('signature_overdue', String(t));   // 署名か不成立の事実が無いまま署名予定月を過ぎたら止める
  const lic = l * disc(S - t, K) * licP;
  return { ...base, stage: 'before_signature', signMonth: S, rnpv: cash + lic - l * pv, icv: l * disc(S - t, D) * licI, license: { probability: l, valueAtSignature: licP } };
}

// ───────────────────────────────────────────────────────── CLI 用

/** 教科書の推移を、登録簿の教材明細（review が adopt のもの）から再計算して表 14.1 / 14.2 の形で返す。 */
export function replay(input, opts) {
  const P0 = normalizeInputs(input.base.inputs); checkProvenance(input.base.provenance, P0);
  const events = [];
  for (const e of input.registry) {
    validateEntry(e);
    if (e.review?.decision !== 'adopt' || e.teaching !== true) throw new PilotError('replay_requires_adopted_teaching_entries', e.eventId);
    if (e.pool) throw new PilotError('replay_pool_unsupported', e.eventId);
    if (e.gate) continue;
    events.push({ month: monthsBetween(P0.evaluationDate, e.date), changes: e.inputChanges.map((c) => ({ path: c.path, to: c.to })) });
  }
  return trajectory(P0, events, opts);
}
export const replayCli = (input) => replay(input);

export function planCli(input, { readFile, asOf } = {}) {
  const out = { ...input };
  if (readFile) {
    const all = JSON.parse(readFileSync(readFile, 'utf8')); const r = all.sheet;
    if (!r) throw new PilotError('bad_read_file');
    if (all.doc) out.docs = [...(out.docs || []), all.doc];
    out.spreadsheetId = r.spreadsheetId; out.tabs = r.tabs; out.state = r.state ?? null;
  }
  if (asOf) out.asOf = asOf;
  return plan(out);
}
