import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeInputs, trajectory, evaluateAt, ensemble, buildPool, plan, replay, validateEntry, init1, TAB_NAMES1 } from './bzm1.mjs';

const FIX = JSON.parse(readFileSync(new URL('./textbook-plan-input.json', import.meta.url), 'utf8'));
const clone = (x) => structuredClone(x);
const tabs = { 評価履歴: 1, 登録簿: 1001, '予測・実績': 1002, 処理記録: 1003 };
const run = (state, asOf, extra = {}, registry = FIX.registry) =>
  plan({ spreadsheetId: 's', tabs, state, base: FIX.base, registry: clone(registry), docs: [], asOf, ...extra });
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);

test('初回: ICV と rNPV が教科書 §9.5.1 の 151.9 / 12.69', () => {
  const P = normalizeInputs(FIX.base.inputs);
  const r = ensemble(P, [{ weight: 1, values: {} }], 0);
  near(r.icv, 151.9, 0.05, 'ICV'); near(r.rnpv, 12.69, 0.005, 'rNPV');
  assert.equal(r.quantiles.status, 'uncalculated');           // 固定入力1組は分位点を作らない
});

test('通し事例: 13行（節目4・出来事9）、節目を越えた後は 保有資金+将来 = 評価額', () => {
  const T = replay(clone(FIX));
  assert.equal(T.rows.length, 13);
  assert.equal(T.gates.length, 4);
  for (const g of T.gates) near(g.total, g.cash + g.future, 1e-9);
  const ms = T.rows.map((r) => r.month);
  assert.deepEqual(ms, [...ms].sort((a, b) => a - b));
});

test('節目の直前と直後で、保有資金・確率の効果が分かれる（前は時間の経過だけ）', () => {
  const T = replay(clone(FIX));
  const g8 = T.rows.find((r) => r.month === 8);
  assert.notEqual(g8.before, g8.after);
});

test('入力が欠けたら 0 にせず止まる / 単位違反は止まる', () => {
  const b = clone(FIX.base.inputs); delete b.sales;
  assert.throws(() => normalizeInputs(b), /missing_input/);
  const e = clone(FIX.registry.find((x) => x.eventId === 'E-11')); e.inputChanges[0].unit = '万円/月';
  assert.throws(() => validateEntry(e), /entry_invalid/);
});

test('確認前の明細は評価に入らない / 未来日の明細も入らない', () => {
  const reg = clone(FIX.registry);
  delete reg.find((e) => e.eventId === 'E-03').review;
  const r0 = run(null, '2026-04-01T12:00:00+09:00', {}, reg);
  assert.ok(r0.summary.pending.some((p) => p.id === 'E-03' && p.reason === 'unreviewed'));
  const r1 = run(null, '2026-04-01T12:00:00+09:00');
  assert.ok(r1.summary.pending.some((p) => p.id === 'E-05' && p.reason === 'future_event_date'));
  assert.ok(!r1.summary.adopted.includes('E-05'));
});

test('版の連鎖: 前版との差と同月・更新前が記録され、同じ入力の再実行は書込なし', () => {
  const a = run(null, '2026-01-01T12:00:00+09:00');
  assert.equal(a.summary.evaluation.classification, 'initial');
  const b = run(a.state, '2026-04-01T12:00:00+09:00');
  const ev = b.summary.evaluation;
  assert.equal(ev.prior.version, 1);
  assert.notEqual(ev.before, 'unavailable');
  assert.notEqual(ev.icv, ev.before.icv);
  const again = run(b.state, '2026-04-01T12:00:00+09:00');
  assert.equal(again.summary.status, 'no_change');
});

test('採用済みの明細は書き換えできない', () => {
  const a = run(null, '2026-04-01T12:00:00+09:00');
  const reg = clone(FIX.registry); reg.find((e) => e.eventId === 'E-03').inputChanges[0].to = 0.9;
  assert.throws(() => run(a.state, '2026-04-02T12:00:00+09:00', {}, reg), /entry_modified/);
});

test('予測は固定され、確率の書換えは止まる。期限が記録日以前なら保存しない', () => {
  const f = { question: '8か月の節目を通過するか', probability: 0.62, deadline: '2026-12-31', criterion: '実環境の検証の完了報告', event: '節目8の通過' };
  const a = run(null, '2026-01-01T12:00:00+09:00', { forecast: f });
  assert.ok(a.summary.forecastSaved);
  assert.throws(() => run(a.state, '2026-02-01T12:00:00+09:00', { forecast: { ...f, probability: 0.9 } }), /forecast_immutable/);
  assert.throws(() => run(null, '2026-01-01T12:00:00+09:00', { forecast: { ...f, deadline: '2026-01-01' } }), /forecast_deadline_not_future/);
});

test('旧版の状態は受け付けない', () => {
  assert.throws(() => run({ v: 1 }, '2026-01-01T12:00:00+09:00'), /legacy_state_rejected/);
});

const pool = (over = {}) => ({
  id: 'p1', quantities: [{ path: 'p.8', unit: '確率' }], dependency: { kind: 'independent', reason: '量が1つ' },
  exchange: { date: '2026-02-01', sharedSources: [{ title: '測定報告' }] },
  evaluators: [
    { id: '評価者A', initial: { submittedAt: '2026-01-20', rationale: '根拠A', marginals: { 'p.8': { kind: 'discrete', points: [{ value: 0.5, weight: 0.5 }, { value: 0.7, weight: 0.5 }] } } },
      reaffirmed: { submittedAt: '2026-02-01', rationale: '資料交換後も変えない' } },
    { id: '評価者B', initial: { submittedAt: '2026-01-21', rationale: '根拠B', marginals: { 'p.8': { kind: 'discrete', points: [{ value: 0.6, weight: 1 }] } } },
      revised: { submittedAt: '2026-02-02', rationale: '再推定', marginals: { 'p.8': { kind: 'discrete', points: [{ value: 0.4, weight: 1 }] } } } },
  ], ...over,
});

test('2名の分布の等重み混合: 重みの合計1、分位点が計算される', () => {
  const m = buildPool(pool());
  near(m.draws.reduce((a, d) => a + d.weight, 0), 1, 1e-12);
  assert.equal(m.draws.length, 3);
  const P = normalizeInputs(FIX.base.inputs);
  const r = ensemble(P, m.draws, 0);
  assert.equal(r.quantiles.status, 'calculated');
  assert.ok(r.quantiles.icv.p10 <= r.quantiles.icv.p50 && r.quantiles.icv.p50 <= r.quantiles.icv.p90);
  // 平均は各組の平均と一致（外側の期待値）
  const direct = [0.5, 0.7, 0.4].map((v, i) => ({ v, w: [0.25, 0.25, 0.5][i] }))
    .reduce((a, { v, w }) => { const Q = clone(P); Q.p[8] = v; return a + w * evaluateAt(Q, 0).total; }, 0);
  near(r.rnpv, direct, 1e-9);
});

test('buildPool: 区分線形2名の量の要約は厳密な混合CDF（平均は2名の平均の平均、分位点は単調、CDFは1で終わる）', () => {
  const five = (a, q10, q50, q90, b) => ({ kind: 'piecewise', a, q10, q50, q90, b });
  const p = pool();
  p.evaluators[0].initial.marginals['p.8'] = five(0.2, 0.3, 0.5, 0.7, 0.9);
  p.evaluators[0].reaffirmed = { submittedAt: '2026-02-01', rationale: '変えない' };
  p.evaluators[1].initial.marginals['p.8'] = five(0.3, 0.4, 0.6, 0.8, 0.95);
  p.evaluators[1].revised = { submittedAt: '2026-02-02', rationale: '変えない', keepInitial: true };
  const s = buildPool(p).summaries['p.8'];
  assert.equal(s.mixed.method, 'exact_piecewise_cdf');
  const [fa, fb] = Object.values(s.final);
  near(s.mixed.mean, 0.5 * (fa.mean + fb.mean), 1e-9, '混合平均');
  assert.ok(s.mixed.p10 <= s.mixed.p50 && s.mixed.p50 <= s.mixed.p90);
  near(s.mixed.cdf[s.mixed.cdf.length - 1].F, 1, 1e-9, 'CDF終端');
});

test('抽出の位置: 成功した検査済みの位置は進み、no_api_key は進めない。同じ位置の再実行は進まない', () => {
  const doc = { id: 'd1', revision: 'r1', text: 'x' };
  const ex = (llm, extracted, sent = 1) => ({ doc: { id: 'd1', revision: 'r1' }, candidates: [], llm, delta: { sent },
    extraction: { extractor: 'x/1', model: 'm', promptSha256: 'a'.repeat(64), generation: { temperature: 0 } }, usage: { model: 'm', inputTokens: 1 },
    snapshot: { docId: 'd1', revision: 'r1', paragraphs: { h1: 1 }, extracted, extractor: 'x/1' } });
  const a = run(null, '2026-01-01T12:00:00+09:00', { docs: [doc], extract: ex({ status: 'ok' }, { h1: 1 }) });
  assert.equal(a.summary.extract.snapshotAdvanced, true);
  assert.deepEqual(a.state.extract.cursor.extracted, { h1: 1 });
  assert.equal(a.state.extract.audit.model, 'm');
  const b = run(a.state, '2026-01-01T12:00:00+09:00', { docs: [doc], extract: ex({ status: 'no_api_key' }, {}) });
  assert.equal(b.summary.extract.status, 'failed:extract_llm_no_api_key');
  assert.equal(b.summary.extract.snapshotAdvanced, false);
  assert.deepEqual(b.state.extract.cursor.extracted, { h1: 1 });
  const c = run(a.state, '2026-01-01T12:00:00+09:00', { docs: [doc], extract: ex({ status: 'skipped' }, { h1: 1 }, 0) });
  assert.equal(c.summary.extract.snapshotAdvanced, false);
});

test('評価者が同一ID・根拠交換なし・重み不等は止まる', () => {
  const dup = pool(); dup.evaluators[1].id = '評価者A';
  assert.throws(() => buildPool(dup), /evaluators_not_distinct/);
  assert.throws(() => buildPool(pool({ exchange: null })), /exchange_missing/);
  const w = pool(); w.evaluators[0].weight = 0.7;
  assert.throws(() => buildPool(w), /weights_must_be_equal/);
});

test('根拠交換後の再推定は、基準日以降の根拠を含むなら基準日前の評価に入らない', () => {
  const reg = clone(FIX.registry);
  reg.push({ eventId: 'PL-1', date: '2026-02-02', type: null, teaching: true, summary: '不確かな入力の混合', sourceTag: '文書', contractParty: null, targets: ['プロジェクトパラメータ'],
    changeText: 'p.8 の分布', recordedBy: '教科書の通し事例', inputChanges: [], pool: pool(), source: { fixture: true, citation: '教材' }, review: { decision: 'adopt', basis: 'textbook_fixture', teaching: true } });
  const early = run(null, '2026-02-01T12:00:00+09:00', {}, reg);
  assert.ok(early.summary.pending.some((p) => p.id === 'PL-1'));
  const late = run(null, '2026-02-02T12:00:00+09:00', {}, reg);
  assert.ok(late.summary.adopted.includes('PL-1'));
  assert.equal(late.summary.evaluation.quantiles.status, 'calculated');
});

test('未来の根拠は引用検証に使えない（実在しない版は採用しない）', () => {
  const e = clone(FIX.registry.find((x) => x.eventId === 'E-03'));
  delete e.teaching; e.type = 1; e.source = { docId: 'd1', revision: 'r9', quote: '合意した' }; e.recordedBy = '山田';
  e.review = { decision: 'adopt', reviewer: '佐藤', reviewedAt: '2026-04-01' };
  e.inputChanges = [];   // 版の不一致だけを独立に検査する（推定値は評価者2名の分布が必須）
  const out = plan({ spreadsheetId: 's', tabs, state: null, base: FIX.base, registry: [e], asOf: '2026-04-01T12:00:00+09:00', docs: [{ id: 'd1', revision: 'r1', text: '合意した' }] });
  assert.ok(out.summary.pending.some((p) => p.reason === 'source_revision_mismatch'));
});

test('同月・更新前と更新後: 3か月目で 152.7/13.00 → 157.7/13.62、前版は 151.9/12.69', () => {
  const a = run(null, '2026-01-01T12:00:00+09:00');
  const b = run(a.state, '2026-04-01T12:00:00+09:00');
  const ev = b.summary.evaluation;
  assert.equal(ev.month, 3);
  near(ev.before.icv, 152.7, 0.05, '更新前ICV'); near(ev.before.rnpv, 13.00, 0.005, '更新前rNPV');
  near(ev.icv, 157.7, 0.05, '更新後ICV'); near(ev.rnpv, 13.62, 0.005, '更新後rNPV');
  near(ev.prior.icv, 151.9, 0.05, '前版ICV'); near(ev.prior.rnpv, 12.69, 0.005, '前版rNPV');
});

test('G-08 / G-15: 通過直前の確率は表14.1どおり 0.55 / 0.78（初期値 0.62 / 0.74 は文面に併記）', () => {
  const T = replay(clone(FIX));
  assert.equal(T.gates.find((g) => g.month === 8).p, 0.55);
  assert.equal(T.gates.find((g) => g.month === 15).p, 0.78);
  const g8 = FIX.registry.find((e) => e.eventId === 'G-08'), g15 = FIX.registry.find((e) => e.eventId === 'G-15');
  assert.match(g8.changeText, /0\.55/); assert.match(g8.changeText, /初期値は 0\.62/);
  assert.match(g15.changeText, /0\.78/); assert.match(g15.changeText, /初期値は 0\.74/);
  assert.equal(FIX.base.inputs.p['8'], 0.62); assert.equal(FIX.base.inputs.p['15'], 0.74);   // 数値の入力は初期値のまま
});

test('G-08 通過: 条件（節目8）と見積の変更（p.8 = 0.55）が採用され、不成立は未対応で止まる', () => {
  const r = run(null, '2026-09-01T12:00:00+09:00');
  assert.ok(r.summary.adopted.includes('G-08'));
  assert.ok(r.summary.adopted.includes('E-05'));
  const g = clone(FIX.registry.find((e) => e.eventId === 'G-08')); g.gate.passed = false;
  assert.throws(() => validateEntry(g), /gate_failure_not_supported/);
  const e05 = FIX.registry.find((e) => e.eventId === 'E-05');
  assert.equal(e05.inputChanges[0].path, 'p.8'); assert.equal(e05.inputChanges[0].to, 0.55); assert.equal(e05.inputChanges[0].kind, 'estimate');
});

test('予測と実績: 予測は前後で不変、確認済みの観測だけが後の時点で結果を付け、不一致・重複は止まる', () => {
  const f = { question: '8か月の節目を通過するか', probability: 0.62, deadline: '2026-12-31', criterion: '実環境の検証の完了報告', event: '節目8の通過' };
  const reg = clone(FIX.registry);
  reg.find((e) => e.eventId === 'G-08').observation = { event: '節目8の通過', achieved: true };
  const a = run(null, '2026-01-01T12:00:00+09:00', { forecast: f }, reg);
  const id = a.summary.forecastSaved; assert.ok(id);
  const saved = clone(a.state.forecasts[id]);
  assert.equal(saved.version, 1);
  // 同じ時点（G-08 が未来日）では結果を付けられない
  assert.throws(() => run(a.state, '2026-02-01T12:00:00+09:00', { actual: { forecastId: id, entryId: 'G-08', outcome: 'yes' } }, reg), /entry_not_adopted_observation/);
  // 結果は観測日以降の別の実行で付く
  const b = run(a.state, '2026-09-01T12:00:00+09:00', { actual: { forecastId: id, entryId: 'G-08', outcome: 'yes' } }, reg);
  assert.equal(b.summary.actualRecorded, id);
  assert.deepEqual(b.state.forecasts[id], saved);                       // 予測（確率・版）は実績の記録後も同じ
  assert.equal(b.state.actuals[id].outcome, 'yes');
  assert.equal(b.state.actuals[id].entryId, 'G-08');
  // 観測と食い違う結果は止まる
  assert.throws(() => run(a.state, '2026-09-01T12:00:00+09:00', { actual: { forecastId: id, entryId: 'G-08', outcome: 'no' } }, reg), /outcome_mismatch/);
  // 同じ予測に2回目の結果は付かない
  assert.throws(() => run(b.state, '2026-09-02T12:00:00+09:00', { actual: { forecastId: id, entryId: 'G-08', outcome: 'yes' } }, reg), /actual_duplicate/);
  // 保存されていない予測には付かない
  assert.throws(() => run(a.state, '2026-09-01T12:00:00+09:00', { actual: { forecastId: 'fc-none', entryId: 'G-08', outcome: 'yes' } }, reg), /forecast_not_saved/);
});

test('通し事例の表14.1: 全行に 更新前・更新後の rNPV と ICV があり、節目は4行・出来事は9行', () => {
  const T = replay(clone(FIX));
  for (const r of T.rows) for (const k of ['before', 'after', 'icvBefore', 'icvAfter']) assert.ok(Number.isFinite(r[k]), `${r.month}か月 ${k}`);
  assert.equal(T.rows.filter((r) => r.kind === '節目').length, 4);
  assert.equal(T.rows.filter((r) => r.kind === '出来事').length, 9);
  for (const g of T.gates) for (const k of ['cash', 'future', 'total', 'ind', 'downTotal', 'downInd']) assert.ok(Number.isFinite(g[k]), `${g.month}か月 ${k}`);
  near(T.initial.total, 12.69, 0.005, '初期rNPV'); near(T.initial.ind, 151.9, 0.05, '初期ICV');
});

test('init1: 評価履歴のタブを 26 列 → 30 列に広げてから見出しを書く / 空でない・複数タブは止まる', () => {
  const r = init1({ sheet: { spreadsheetId: 's', empty: true, sheets: [{ sheetId: 0, title: 'Sheet1', columnCount: 26 }] } });
  const grow = r.requests.findIndex((q) => q.updateSheetProperties?.properties?.gridProperties?.columnCount === 30);
  const write = r.requests.findIndex((q) => q.updateCells?.start?.sheetId === 0);
  assert.ok(grow >= 0, '列数を 30 に広げる');
  assert.ok(write > grow, '広げる前に見出しを書かない');
  assert.throws(() => init1({ sheet: { spreadsheetId: 's', empty: false, sheets: [{ sheetId: 0, title: 'Sheet1' }] } }), /not_empty_initial_file/);
  assert.throws(() => init1({ sheet: { spreadsheetId: 's', empty: true, sheets: [{ sheetId: 0, title: 'a' }, { sheetId: 1, title: 'b' }] } }), /not_empty_initial_file/);
});

test('init1: 4タブと列見出しを作る', () => {
  const r = init1({ sheet: { spreadsheetId: 's', empty: true, sheets: [{ sheetId: 0, title: 'Sheet1' }] } });
  assert.deepEqual(Object.keys(r.tabs).sort(), Object.values(TAB_NAMES1).sort());
});
