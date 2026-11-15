// 本の読者向け月次評価アプリの表示データ。serve.mjs が buildDemoData() を同期で呼ぶ。
// 値はすべて ../book-monthly.mjs / ../bzm1.mjs の計算結果か、book-reference-grid.json（著者の計算結果）から作る。
// 本に書かれていない結果・確率・日付は作らない（未観測として注記する）。
import { readFileSync } from 'node:fs';
import { stepBookMonth, openingState, gateTimes, BOOK_VERSION } from '../book-monthly.mjs';
import {
  BOOK_REFERENCE, replay, compareGateOutcomes, failureValue, waitingBalances,
} from '../bzm1.mjs';

const FIXTURE = JSON.parse(readFileSync(new URL('../textbook-plan-input.json', import.meta.url), 'utf8'));
const GRID_URL = new URL('./book-reference-grid.json', import.meta.url);

// 本に印刷された値（検算用）。月 → [使途限定, 自由]（万円）
export const PRINTED_BALANCES = Object.freeze({
  1: [2558.4, 0], 8: [1567.2, 15], 15: [567.6, 11982], 19: [0, 11457.6],
});
// 不成立側の印刷値（節目の月 → [rNPV, ICV]）
export const PRINTED_DOWN = Object.freeze({
  8: ['0.00', '0.0'], 15: ['3.09', '110.6'], 27: ['5.19', '161.0'], 39: ['5.79', '193.9'],
});

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const sumFailures = (s) => Object.values(s.failures || {}).reduce((a, n) => a + n, 0);
const fmt = (x) => (Math.round(x * 1e6) / 1e6).toLocaleString('ja-JP', { maximumFractionDigits: 6 });
const sign = (x) => (x >= 0 ? `+${fmt(x)}` : `−${fmt(-x)}`);

// ---------------------------------------------------------------- 月次
const BASE_SPENDING = { preInc: 150, postInc: 450, postIncResearch: 150 };
const PRE_PROD_SALES = { 2: { pre: 0, post: 0 }, 3: { pre: 15, post: 30 }, 4: { pre: 52.5, post: 105 } };

function noteLines(r, before, after, gateLabel) {
  const notes = [];
  const dr = after.sr - before.sr, df = after.sf - before.sf;
  notes.push(`使途限定資金 ${sign(dr)}万円、自由資金 ${sign(df)}万円`);
  for (const l of r.log) {
    if (/^[34]:/.test(l)) notes.push(l.replace(/^\d:\s*/, '').replace(/R\d\s?/g, '').replace(/>=/g, '≥'));
  }
  if (r.unobserved.includes('advance')) notes.push(`${gateLabel}の判定結果は本に記載なし（未観測）`);
  for (const m of r.missing) notes.push(m);
  return notes;
}

function probabilityList(probs, gateId) {
  const out = [];
  if (probs.advance != null) out.push({ label: `${gateId}の月の前進確率`, value: probs.advance });
  if (probs.award != null) out.push({ label: '応募Aの採択確率', value: probs.award });
  if (probs.contract != null) out.push({ label: '受託の引き合い確率', value: probs.contract });
  if (probs.offer?.license != null) out.push({ label: 'ライセンスのオファー確率', value: probs.offer.license });
  return out;
}

function statusOf(r, prevGateIdx) {
  if (r.terminated) return '4つの分岐へ';
  if (r.state.gateIdx > prevGateIdx) return '節目を通過';
  if (r.probs.advance != null) return '判定月';
  return '準備中';
}

function snapshotRow(month, state, config, extras = {}) {
  return {
    month, stage: state.stage, next: config.gates[state.gateIdx]?.id ?? null,
    free: state.sf, restricted: state.sr, incorporated: state.incorporated,
    events: [], notes: [], probabilities: [], failureCount: sumFailures(state), status: '評価日', ...extras,
  };
}

function runMonths({ id, title, section, state0, configFor, eventsByMonth, upto, labels = {}, prestep = {}, eventTexts = {} }) {
  const rows = [snapshotRow(0, state0, configFor(1), { events: ['評価日の開始状態'], notes: [`使途限定資金 ${fmt(state0.sr)}万円、自由資金 ${fmt(state0.sf)}万円`] })];
  let st = state0; let done = false;
  for (let t = 1; t <= upto && !done; t++) {
    if (prestep[t]) st = prestep[t](structuredClone(st));
    const cfg = configFor(t);
    const gateId = cfg.gates[st.gateIdx]?.id ?? '';
    const r = stepBookMonth(st, cfg, eventsByMonth[t] || {});
    const events = [...(eventTexts[t] || [])];
    if (r.probs.pivotReview) events.push('用途変更の検討を始める');
    if (r.terminated?.reason === 'branch') {
      const names = { return_to_research: '研究への返却', license_switch: 'ライセンスへの切替', acquisition_handover: '買収への引き渡し', pivot: '用途変更' };
      events.push(`4つの分岐へ。選べる行き先: ${r.terminated.options.map((o) => names[o] || o).join('、')}`);
    }
    rows.push({
      month: t, stage: r.state.stage, next: cfg.gates[r.state.gateIdx]?.id ?? null,
      free: r.state.sf, restricted: r.state.sr, incorporated: r.state.incorporated,
      events, notes: noteLines(r, st, r.state, labels[t] || gateId),
      probabilities: probabilityList(r.probs, gateId), failureCount: sumFailures(r.state),
      status: statusOf(r, st.gateIdx),
    });
    st = r.state; done = !!r.terminated;
  }
  return { id, title, section, rows };
}

function monthlyCase1() {
  const gates = [
    { id: 'T3', M: 28, stage: 3, psi: 0.8, gated: true },
    { id: 'M2', M: 15, stage: 4, psi: 1, gated: true }, // F1 の M2 は標準 M=15（準備 6 か月）
  ];
  const base = { gates, spending: BASE_SPENDING, preProdSales: PRE_PROD_SALES, r3: { requiredGateId: 'M2' }, r4: { gStar: 3 } };
  const first = { ...base, award: { sigma: 'neutral', sumP: 70, hasMomentum: true }, offers: { kappaIP: 0.5, quietMonths: 3 }, contractArrival: { r: 60 } };
  const contract = { gross: 60, directCost: 48, indirectRate: 0.3, university: true, ledger: 'restricted', rho: 0.2, gamma: 0 };
  const state0 = openingState({ gates, elapsedInGate: 5, sr: 2700, sf: 0, stage: 2, vacant: [3, 4, 5, 6], contract, openItems: 2,
    opportunities: [{ id: 'A', eligibility: { confirmed: true, signedBy: '評価者' } }] });
  return runMonths({
    id: 'case1', title: '通し事例: T3 通過、M2 通過と会社化', section: '§2.4.5 / §7.4',
    state0, configFor: (t) => (t === 1 ? first : base), upto: 19,
    eventsByMonth: {
      1: { outcomes: { award: { id: 'A', won: false } } },
      8: { outcomes: { advance: 'pass' } },
      9: { outcomes: { rightsResolved: 2 } },
      15: { outcomes: { advance: 'pass', foundingEquity: 12000 }, contractAfterIncorporation: { net: 72, ledger: 'free', rho: 0.3, gamma: 0 } },
    },
    prestep: { 2: (s) => ({ ...s, opportunities: [] }) },
    eventTexts: {
      1: ['応募Aは不採択'],
      8: ['T3 を通過'],
      9: ['権利の残件が 0 件になる'],
      15: ['M2 を通過', '出資 12000万円を支払いの前に自由資金へ入金', '会社化。受託契約は会社名義（月 72万円）へ'],
    },
  });
}

function monthlyCase2() {
  const gates = [{ id: 'T3', M: 28, stage: 3, psi: 0.8, gated: true }];
  const cfg = { gates, spending: BASE_SPENDING, preProdSales: PRE_PROD_SALES, r3: { requiredGateId: 'M2' }, r4: { gStar: 3 } };
  const fail = { outcomes: { registryFailure: true } };
  return runMonths({
    id: 'case2', title: 'T3 が 3、6、14 か月目に不成立となる場合', section: '§7.5.2',
    state0: openingState({ gates, elapsedInGate: 5, sr: 2700, stage: 2 }), configFor: () => cfg, upto: 15,
    eventsByMonth: { 3: fail, 6: fail, 14: fail, 15: {} },
    eventTexts: { 3: ['T3 の不成立を登録（1 回目）'], 6: ['T3 の不成立を登録（2 回目）'], 14: ['T3 の不成立を登録（3 回目）'] },
  });
}

// ---------------------------------------------------------------- 節目と履歴
const monthsFrom = (from, iso) => {
  const a = new Date(from), b = new Date(iso);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
};

function fixtureReplay() {
  const T = replay(structuredClone(FIXTURE), { keepInputs: true });
  const ev = FIXTURE.base.inputs.evaluationDate;
  const gateLabel = {}, eventLabel = {};
  for (const e of FIXTURE.registry) {
    if (e.gate) gateLabel[e.gate.month] = e.summary;
    else eventLabel[monthsFrom(ev, e.date)] = e.summary;
  }
  return { T, gateLabel, eventLabel };
}

function continuationData(T, gateLabel) {
  const gates = T.gates.map((g) => {
    const c = compareGateOutcomes(g.inputs, g.month, g.gatesBefore);
    const fv = failureValue(g.inputs, g.month, g.gatesBefore);
    return { month: g.month, label: gateLabel[g.month] ?? `${g.month}か月目の節目`, p: c.p,
      up: { icv: c.up.icv, rnpv: c.up.rnpv, cash: c.up.cash },
      down: { icv: fv.icv, rnpv: fv.rnpv, cash: fv.cash } };
  });
  const EXP = [16, 17, 18, 19, 20, 21].map((month) => ({ id: `x${month}`, month, amountMan: 150, label: '署名待ちの支出' }));
  const w = waitingBalances({ initialCashMan: 120, expenses: EXP, upfront: { month: 21, amountMan: 5000 } });
  return { gates, waiting: { title: '署名待ちの支出と資金の推移（万円）', rows: w.rows, totalMan: w.totalMan, bridgeMan: w.bridgeMan, endMan: w.endMan } };
}

function historyData(T, gateLabel, eventLabel) {
  const history = [{ month: 0, icv: T.initial.ind, rnpv: T.initial.total, kind: '評価日', label: '評価日（通し事例の初期値）' }];
  for (const r of T.rows) {
    history.push({ month: r.month, icv: r.icvAfter, rnpv: r.after, kind: r.kind,
      label: (r.kind === '節目' ? gateLabel[r.month] : eventLabel[r.month]) ?? `${r.month}か月目` });
  }
  return history;
}

function referenceData() {
  const cases = JSON.parse(readFileSync(GRID_URL, 'utf8'));
  if (!Array.isArray(cases)) throw new Error('book-reference-grid.json は配列である必要があります');
  return { source: '第17章 表17.3・著者の計算結果', cases: cases.map(({ type, reg, v, v10, v50, v90, pM4, m4mean, provenance }) => ({ type, reg, v, v10, v50, v90, pM4, m4mean, provenance })) };
}

// ---------------------------------------------------------------- 公開
export function buildDemoData() {
  const case1 = monthlyCase1();
  for (const [m, [sr, sf]] of Object.entries(PRINTED_BALANCES)) {
    const row = case1.rows.find((r) => r.month === Number(m));
    if (!row || !near(row.restricted, sr) || !near(row.free, sf)) throw new Error(`通し事例 ${m} か月目が本の印刷値と一致しません`);
  }
  if (gateTimes(15).Mmin !== 6) throw new Error('M2 の準備期間が 6 か月ではありません');
  const { T, gateLabel, eventLabel } = fixtureReplay();
  const continuation = continuationData(T, gateLabel);
  for (const g of continuation.gates) {
    const want = PRINTED_DOWN[g.month];
    if (g.down.rnpv.toFixed(2) !== want[0] || g.down.icv.toFixed(1) !== want[1]) throw new Error(`${g.month} か月目の不成立値が本の印刷値と一致しません`);
  }
  const data = {
    book: { version: BOOK_VERSION, commit: 'd980da7' }, // 第4〜7章・第17章の記録。固定した旧ツリーの値は変えない（BOOK_REFERENCE.manuscriptCommit は計算側が参照）
    monthly: { cases: [case1, monthlyCase2()] },
    continuation,
    reference: referenceData(),
    valuation: { history: historyData(T, gateLabel, eventLabel) },
  };
  return JSON.parse(JSON.stringify(data));
}
