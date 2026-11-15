import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plan, validateEntry, replay, downAt, cashAt, failureValue, compareGateOutcomes, compareAllGates, continuationOptions, openFailedContinuation,
  appendContinuationStep, verifyContinuation, evaluateContinuation, expenseScheduleValue, waitingBalances } from './bzm1.mjs';

const FIX = JSON.parse(readFileSync(new URL('./textbook-plan-input.json', import.meta.url), 'utf8'));
const clone = (x) => structuredClone(x);
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);
const T = replay(clone(FIX), { keepInputs: true });
const G = Object.fromEntries(T.gates.map((g) => [g.month, g]));
const dateAt = (m) => `${2026 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`;
const EV = { docId: 'doc-1', revision: 'r1', quote: '判定の結果、基準に届かなかったと確認した' };
const open = (m = 15) => openFailedContinuation(G[m].inputs, { gate: { month: m, passed: false }, gatesPassed: G[m].gatesBefore, date: dateAt(m), recordedAt: dateAt(m), evidence: EV });
const step = (m, type, extra = {}) => ({ id: `${type}-${m}-${extra.expenseId ?? ''}`, type, date: dateAt(m), recordedAt: dateAt(m), evidence: EV, ...extra });
const EXP = [16, 17, 18, 19, 20, 21].map((month) => ({ id: `x${month}`, month, amountMan: 150, label: '署名待ちの支出' }));

test('不成立月の rNPV / ICV が本の印字値（節目 8/15/27/39 の順）', () => {
  const want = { 8: ['0.00', '0.0'], 15: ['3.09', '110.6'], 27: ['5.19', '161.0'], 39: ['5.79', '193.9'] };
  for (const m of [8, 15, 27, 39]) {
    const g = G[m]; const fv = failureValue(g.inputs, m, g.gatesBefore);
    assert.deepEqual([g.downTotal.toFixed(2), g.downInd.toFixed(1)], want[m], `追跡 ${m}`);
    assert.deepEqual([fv.rnpv.toFixed(2), fv.icv.toFixed(1)], want[m], `不成立値 ${m}`);
    assert.equal(fv.rnpv, downAt(g.inputs, m).total); assert.equal(fv.icv, downAt(g.inputs, m).ind);
  }
});

test('通過側と不成立側の比較（UI 用）と節目の順序検査', () => {
  const all = compareAllGates(G[8].inputs);
  assert.equal(all.length, 4);
  const c = compareGateOutcomes(G[15].inputs, 15, G[15].gatesBefore);
  near(c.expected.rnpv, c.p * c.up.rnpv + (1 - c.p) * c.down.rnpv, 1e-12);
  assert.ok(c.up.rnpv > c.down.rnpv);
  assert.throws(() => failureValue(G[15].inputs, 15, []), /gate_out_of_order/);
  assert.throws(() => failureValue(G[15].inputs, 15, [8, 15]), /gate_already_passed/);
});

test('開始には観測した不成立・月の一致・実際の根拠が要る', () => {
  const P = G[15].inputs; const base = { gate: { month: 15, passed: false }, gatesPassed: [8], date: dateAt(15), recordedAt: dateAt(15), evidence: EV };
  assert.throws(() => openFailedContinuation(P, { ...base, gate: { month: 15, passed: true } }), /continuation_requires_observed_failure/);
  assert.throws(() => openFailedContinuation(P, { ...base, date: dateAt(16), recordedAt: dateAt(16) }), /failure_month_mismatch/);
  assert.throws(() => openFailedContinuation(P, { ...base, evidence: { ...EV, quote: '来月に判定する予定' } }), /planned_not_actual/);
  assert.throws(() => openFailedContinuation(P, { ...base, evidence: null }), /continuation_evidence_missing/);
});

test('追記なしの評価は不成立値と完全一致（割引は署名までの1回）', () => {
  const s = open(15); const P = G[15].inputs;
  const e = evaluateContinuation(P, s, 15);
  assert.equal(e.stage, 'before_signature');
  assert.equal(e.rnpv, downAt(P, 15).total); assert.equal(e.icv, downAt(P, 15).ind);
  const e18 = evaluateContinuation(P, s, 18);   // 現金は動かさず、署名までの残りが 6→3 か月になるだけ
  near(e18.rnpv - e18.cash, (e.rnpv - e.cash) * (1 + P.rates.private) ** (3 / 12), 1e-12);
  near(e18.icv, e.icv * (1 + P.rates.industrial) ** (3 / 12), 1e-12);
  assert.equal(e18.cash, e.cash);
  assert.throws(() => evaluateContinuation(P, s, 22), /signature_overdue/);
});

test('署名待ちの支出: 900万円・つなぎ780万円・残高 −780 / 4220、評価日の現在価値と経路の確率', () => {
  const w = waitingBalances({ initialCashMan: 120, expenses: EXP, upfront: { month: 21, amountMan: 5000 } });
  assert.deepEqual(w.rows.map((r) => r.beforeUpfront), [-30, -180, -330, -480, -630, -780]);
  assert.equal(w.rows[5].afterUpfront, 4220); assert.equal(w.totalMan, 900); assert.equal(w.bridgeMan, 780);
  near(expenseScheduleValue(G[15].inputs, EXP, 0), 0.0777, 5e-5, '評価日の現在価値');
  const P = G[15].inputs; let s = open(15);
  s = appendContinuationStep(P, s, step(15, 'expense_plan', { expenses: EXP }));
  const e = evaluateContinuation(P, s, 15); const fv = failureValue(P, 15, G[15].gatesBefore);
  near(e.rnpv, fv.rnpv - P.l[15] * expenseScheduleValue(P, EXP, 15), 1e-12);   // 確率 l を掛けた経路の評価
  assert.equal(e.expensePV, expenseScheduleValue(P, EXP, 15));
  assert.deepEqual(e.remainingExpenses, EXP.map((x) => x.id));
});

test('支払・署名の事実を追記: 現金は1回だけ、将来の実現資金は入れない', () => {
  const P = G[15].inputs; const base = failureValue(P, 15, G[15].gatesBefore).cash;
  let s = appendContinuationStep(P, open(15), step(15, 'expense_plan', { expenses: EXP }));
  for (const x of EXP) s = appendContinuationStep(P, s, step(x.month, 'expense_paid', { expenseId: x.id, amountMan: x.amountMan }));
  s = appendContinuationStep(P, s, step(21, 'signed', { upfrontMan: 5000 }));
  const e17 = evaluateContinuation(P, s, 17);   // 18 か月目以降の支払・署名はまだ入らない
  near(e17.cash, base - 2 * 150 * 1e-4, 1e-12); assert.equal(e17.stage, 'before_signature');
  assert.deepEqual(e17.remainingExpenses, ['x18', 'x19', 'x20', 'x21']);
  const e21 = evaluateContinuation(P, s, 21);
  near(e21.cash, base + (5000 - 900) * 1e-4, 1e-12); assert.equal(e21.stage, 'signed'); assert.equal(e21.expensePV, 0);
  near(e21.rnpv, e21.cash + e21.license.royalty, 1e-12);
  assert.throws(() => evaluateContinuation(P, s, 46), /beyond_explicit_horizon/);
  assert.throws(() => appendContinuationStep(P, s, step(21, 'expense_paid', { expenseId: 'x21', amountMan: 150, id: 'dup' })), /expense_not_planned/);   // 二重払いは入らない
  // 日付と記録日が一致する（有効な）追記で、計画にない支出を払うと止まる。日付が記録日より後なら別の理由（continuation_date_invalid）で止まる
  assert.throws(() => appendContinuationStep(P, open(15), { ...step(16, 'expense_paid', { expenseId: 'x16', amountMan: 1 }), date: dateAt(20), recordedAt: dateAt(20) }), /expense_not_planned/);
  assert.throws(() => appendContinuationStep(P, open(15), { ...step(16, 'expense_paid', { expenseId: 'x16', amountMan: 1 }), date: dateAt(20) }), /continuation_date_invalid/);
  const p2 = appendContinuationStep(P, open(15), step(15, 'expense_plan', { expenses: EXP }));
  assert.throws(() => appendContinuationStep(P, p2, { ...step(16, 'expense_paid', { expenseId: 'x16', amountMan: 150 }), date: dateAt(17), recordedAt: dateAt(16) }), /continuation_date_invalid/);
});

test('署名の一時金は明示が必要 / 期限の月が来た支出は事実が要る', () => {
  const P = G[15].inputs;
  assert.throws(() => appendContinuationStep(P, open(15), step(21, 'signed')), /upfront_missing/);
  assert.throws(() => appendContinuationStep(P, open(15), step(15, 'signed', { upfrontMan: 5000 })), /signature_not_after_failure/);
  const s = appendContinuationStep(P, open(15), step(15, 'expense_plan', { expenses: EXP }));
  assert.throws(() => evaluateContinuation(P, s, 17), /expense_unconfirmed/);
});

test('ライセンスなし: 実際の現金だけ・ICV 0・以後の追記は止まる', () => {
  const P = G[27].inputs;
  let s = appendContinuationStep(P, open(27), step(27, 'expense_plan', { expenses: [{ id: 'y1', month: 33, amountMan: 150, label: '署名待ちの支出' }] }));
  s = appendContinuationStep(P, s, step(30, 'no_license'));
  assert.throws(() => evaluateContinuation(P, s, 30), /expenses_pending_after_close/);
  s = appendContinuationStep(P, s, { ...step(30, 'expense_cancelled', { expenseId: 'y1' }) });
  assert.throws(() => appendContinuationStep(P, s, step(31, 'signed', { upfrontMan: 1 })), /continuation_closed/);
});

test('ライセンスなし（支出なし）の評価と取消順序', () => {
  const P = G[27].inputs; const s = appendContinuationStep(P, open(27), step(29, 'no_license'));
  const e = evaluateContinuation(P, s, 29);
  assert.equal(e.stage, 'no_license'); assert.equal(e.icv, 0); assert.equal(e.rnpv, e.cash);
  assert.equal(e.cash, failureValue(P, 27, G[27].gatesBefore).cash);
});

test('追記のみ: 元の状態は変わらず、書き換えは鎖で検知', () => {
  const P = G[15].inputs; const s0 = open(15); const frozen = JSON.stringify(s0);
  const s1 = appendContinuationStep(P, s0, step(15, 'expense_plan', { expenses: EXP }));
  assert.equal(JSON.stringify(s0), frozen); assert.equal(s1.steps.length, 1);
  assert.ok(verifyContinuation(P, s1));
  const t = clone(s1); t.steps[0].expenses[0].amountMan = 1;
  assert.throws(() => verifyContinuation(P, t), /continuation_chain_broken/);
  assert.throws(() => appendContinuationStep(P, s1, step(15, 'expense_plan', { expenses: EXP })), /continuation_step_duplicate/);
  assert.throws(() => appendContinuationStep(P, s1, step(15, 'expense_plan', { id: 'again', expenses: EXP })), /expense_invalid/);   // 凍結した予測は上書きしない
  assert.throws(() => appendContinuationStep({ ...clone(P), upfront: 0.4 }, s1, step(16, 'no_license')), /continuation_input_changed/);
});

test('日付つきの入力更新: 観測の確率だけ。推定・過去の入力は変えない', () => {
  const P = G[15].inputs; const s = open(15);
  const upd = (changes, kind = 'observation') => step(16, 'input_update', { kind, changes });
  assert.throws(() => appendContinuationStep(P, s, upd([{ path: 'l.15', to: 0.3, unit: '確率' }], 'estimate')), /estimate_requires_pool/);
  assert.throws(() => appendContinuationStep(P, s, upd([{ path: 'l.8', to: 0.3, unit: '確率' }])), /continuation_path_not_allowed/);
  assert.throws(() => appendContinuationStep(P, s, upd([{ path: 'financing.15', to: 0, unit: '億円' }])), /continuation_path_not_allowed/);
  assert.throws(() => appendContinuationStep(P, s, upd([{ path: 'l.15', to: 0.3, unit: '月' }])), /unit_mismatch/);
  const s2 = appendContinuationStep(P, s, upd([{ path: 'l.15', to: 0.3, unit: '確率' }]));
  const e = evaluateContinuation(P, s2, 16); const e0 = evaluateContinuation(P, s, 16);
  near(e.rnpv - e.cash, (e0.rnpv - e0.cash) * (0.3 / P.l[15]), 1e-12);
  assert.equal(evaluateContinuation(P, s2, 15).rnpv, downAt(P, 15).total);   // 更新前の月には効かない
});

test('UI 用の選択肢: 閉じると全て不可、署名後は署名・なしが不可', () => {
  const P = G[15].inputs; const s = open(15);
  assert.ok(continuationOptions(P, s, 15).filter((o) => o.available).map((o) => o.type).includes('signed'));
  const sg = appendContinuationStep(P, s, step(21, 'signed', { upfrontMan: 5000 }));
  const av = continuationOptions(P, sg, 21).filter((o) => o.available).map((o) => o.type);
  assert.ok(!av.includes('signed') && !av.includes('no_license'));
  const nl = appendContinuationStep(P, s, step(20, 'no_license'));
  assert.equal(continuationOptions(P, nl, 20).filter((o) => o.available).length, 0);
});

// ───── 通常の plan への接続（不成立の確定と、追記だけの継続）
const TABS = { 評価履歴: 1, 登録簿: 1001, '予測・実績': 1002, 処理記録: 1003 };
const DOC = { id: 'doc-f', revision: 'r1', text: '判定の結果、基準に届かなかったと確認した。\n\n署名待ちの支出の一覧を取り交わした。\n\n5月に150万円を支払った。\n\n6月に150万円を支払った。' };
const ev = (quote) => ({ docId: 'doc-f', revision: 'r1', quote });
const FAIL_REG = () => {
  const reg = clone(FIX.registry).filter((e) => e.date <= '2027-04-01');
  const g = reg.find((e) => e.eventId === 'G-15');
  g.gate.passed = false; g.summary = '節目15の判定で不成立'; g.changeText = '節目15か月で不成立と確認';
  g.observation = { event: '節目15の通過', achieved: false };
  g.source = { fixture: true, citation: 'BZM 1.0 教科書 §14.2 表14.1', docId: 'doc-f', revision: 'r1', quote: '判定の結果、基準に届かなかったと確認した' };
  return reg;
};
const runP = (state, asOf, extra = {}, registry = FAIL_REG()) => plan({ spreadsheetId: 's', tabs: TABS, state, base: FIX.base, registry, docs: [DOC], asOf, ...extra });
const STEPS = [
  { id: 'p1', type: 'expense_plan', date: '2027-04-01', recordedAt: '2027-04-01', evidence: ev('署名待ちの支出の一覧を取り交わした'), expenses: EXP },
  { id: 'x16', type: 'expense_paid', date: '2027-05-01', recordedAt: '2027-05-01', evidence: ev('5月に150万円を支払った'), expenseId: 'x16', amountMan: 150 },
  { id: 'x17', type: 'expense_paid', date: '2027-06-01', recordedAt: '2027-06-01', evidence: ev('6月に150万円を支払った'), expenseId: 'x17', amountMan: 150 },
];

test('plan: 不成立の根拠がなければ従来どおり止まる（教材のみ・観測なし）', () => {
  const g = clone(FIX.registry.find((e) => e.eventId === 'G-08')); g.gate.passed = false;
  assert.throws(() => validateEntry(g), /gate_failure_not_supported/);
  g.observation = { event: '節目8の通過', achieved: false };   // 観測はあっても実際の資料の根拠がない
  assert.throws(() => validateEntry(g), /gate_failure_not_supported/);
});

test('plan: 節目15の不成立を保存すると 3.09 / 110.6、通過した場合の経路は閉じる', () => {
  const a = runP(null, '2027-04-01T12:00:00+09:00');
  assert.ok(a.summary.adopted.includes('G-15'));
  const e = a.summary.evaluation;
  assert.deepEqual([e.rnpv.toFixed(2), e.icv.toFixed(1)], ['3.09', '110.6']);
  near(e.rnpv, downAt(G[15].inputs, 15).total, 1e-9); near(e.icv, downAt(G[15].inputs, 15).ind, 1e-9);
  assert.equal(e.classification, 'initial');
  assert.equal(e.failedBranch.stage, 'before_signature');
  assert.equal(a.state.failedBranch.chain.length, 0);
  const later = FAIL_REG().concat(clone(FIX.registry.filter((x) => x.eventId === 'G-27')));
  assert.throws(() => runP(null, '2028-04-01T12:00:00+09:00', {}, later), /entry_after_failed_gate/);   // 不成立の後に通過は入らない
});

test('plan: 不成立の後の追記が評価に入り、鎖の先頭は固定され、将来・未確認の根拠は入らない', () => {
  const a = runP(null, '2027-04-01T12:00:00+09:00');
  const frozen = JSON.stringify(a.state);
  const b = runP(a.state, '2027-06-15T12:00:00+09:00', { continuationSteps: STEPS });
  assert.equal(JSON.stringify(a.state), frozen);
  const s = appendContinuationStep(G[15].inputs, appendContinuationStep(G[15].inputs, appendContinuationStep(G[15].inputs, open(15),
    step(15, 'expense_plan', { expenses: EXP })), step(16, 'expense_paid', { expenseId: 'x16', amountMan: 150 })), step(17, 'expense_paid', { expenseId: 'x17', amountMan: 150 }));
  const want = evaluateContinuation(G[15].inputs, s, 17);
  const e = b.summary.evaluation;
  assert.equal(e.classification, 'continuation_update');
  near(e.rnpv, want.rnpv, 1e-9); near(e.cash, want.cash, 1e-9);
  assert.deepEqual(e.failedBranch.remainingExpenses, ['x18', 'x19', 'x20', 'x21']);
  assert.notEqual(e.before, 'unavailable');
  assert.deepEqual(a.summary.evaluation.rnpv.toFixed(2), '3.09');   // 保存済みの版は変わらない
  assert.equal(b.state.snapshots[0].rnpv, a.state.snapshots[0].rnpv);
  // 同じ入力の再実行は書込なし
  assert.equal(runP(b.state, '2027-06-15T12:00:00+09:00', { continuationSteps: STEPS }).summary.status, 'no_change');
  // 先頭の追記を落とす・並べ替える・書き換えると止まる
  assert.throws(() => runP(b.state, '2027-06-20T12:00:00+09:00', { continuationSteps: STEPS.slice(0, 2) }), /continuation_not_append_only/);
  assert.throws(() => runP(b.state, '2027-06-20T12:00:00+09:00'), /continuation_not_append_only/);
  const alt = clone(STEPS); alt[1].amountMan = 140;
  assert.throws(() => runP(b.state, '2027-06-20T12:00:00+09:00', { continuationSteps: alt }), /continuation_not_append_only/);
  // 記録日より後の事実・資料にない根拠・分岐のない継続は入らない
  assert.throws(() => runP(a.state, '2027-05-15T12:00:00+09:00', { continuationSteps: STEPS }), /continuation_future_step/);
  const unbound = clone(STEPS); unbound[0].evidence = ev('資料にない文');
  assert.throws(() => runP(a.state, '2027-06-15T12:00:00+09:00', { continuationSteps: unbound }), /continuation_evidence_unbound/);
  assert.throws(() => runP(a.state, '2027-06-15T12:00:00+09:00', { continuationSteps: STEPS, continuation: {} }), /continuation_input_ambiguous/);
  assert.throws(() => run0(), /continuation_without_failure/);
});
const run0 = () => plan({ spreadsheetId: 's', tabs: TABS, state: null, base: FIX.base, registry: clone(FIX.registry), docs: [], asOf: '2026-01-01T12:00:00+09:00', continuationSteps: [] });

test('plan: 節目39の不成立の後は通常の上限を超えても、署名予定の45か月まで継続評価できる', () => {
  const reg = clone(FIX.registry).filter((e) => e.date <= '2029-04-01');
  const g = reg.find((e) => e.eventId === 'G-39');
  g.gate.passed = false; g.summary = '節目39の判定で不成立'; g.changeText = '節目39か月で不成立と確認';
  g.observation = { event: '節目39の通過', achieved: false };
  g.source = { fixture: true, citation: 'BZM 1.0 教科書 §14.2 表14.1', docId: 'doc-f', revision: 'r1', quote: '判定の結果、基準に届かなかったと確認した' };
  const doc = { id: 'doc-f', revision: 'r1', text: `${DOC.text}\n\n署名した。一時金は5000万円。` };
  const run = (state, asOf, extra = {}) => plan({ spreadsheetId: 's', tabs: TABS, state, base: FIX.base, registry: reg, docs: [doc], asOf, ...extra });
  const a = run(null, '2029-04-01T12:00:00+09:00');
  assert.equal(a.summary.evaluation.failedBranch.stage, 'before_signature');
  const at45 = dateAt(45);   // 2029-10-01: 署名待ちのまま
  const w = run(a.state, `${at45}T12:00:00+09:00`);
  assert.equal(w.summary.evaluation.failedBranch.stage, 'before_signature');
  const sg = { id: 's45', type: 'signed', date: at45, recordedAt: at45, evidence: { docId: 'doc-f', revision: 'r1', quote: '署名した' }, upfrontMan: 5000 };
  const b = run(a.state, `${at45}T12:00:00+09:00`, { continuationSteps: [sg] });
  assert.equal(b.summary.evaluation.failedBranch.stage, 'signed');
  assert.throws(() => run(a.state, `${dateAt(46)}T12:00:00+09:00`), /signature_overdue/);   // 署名の事実がないまま過ぎれば止まる
  assert.throws(() => runP(null, `${at45}T12:00:00+09:00`, {}, clone(FIX.registry).filter((e) => e.date <= '2029-04-01')), /month_out_of_range/);   // 不成立がなければ従来どおり上限で止まる
});

test('plan: 同じ文書の新しい版で追記でき、受理済みの根拠と鎖の書き換え拒否は保たれる', () => {
  const a = runP(null, '2027-04-01T12:00:00+09:00');
  const b = runP(a.state, '2027-06-15T12:00:00+09:00', { continuationSteps: STEPS });
  const DOC2 = { id: 'doc-f', revision: 'r2', text: '判定の結果、基準に届かなかったと確認した。\n\n7月に150万円を支払った。' };   // 旧版の引用（5月・6月の段落）は含まない
  const st3 = { id: 'x18', type: 'expense_paid', date: '2027-07-01', recordedAt: '2027-07-01', evidence: { docId: 'doc-f', revision: 'r2', quote: '7月に150万円を支払った' }, expenseId: 'x18', amountMan: 150 };
  const c = runP(b.state, '2027-07-15T12:00:00+09:00', { continuationSteps: [...STEPS, st3], docs: [DOC2] });
  assert.equal(c.summary.evaluation.classification, 'continuation_update');
  assert.equal(c.state.failedBranch.chain.length, 4);
  assert.deepEqual(c.state.failedBranch.chain.slice(0, 3), b.state.failedBranch.chain);
  const bad = { ...st3, evidence: { ...st3.evidence, quote: '資料にない文' } };
  assert.throws(() => runP(b.state, '2027-07-15T12:00:00+09:00', { continuationSteps: [...STEPS, bad], docs: [DOC2] }), /continuation_evidence_unbound/);
  const alt = clone(STEPS); alt[1].amountMan = 140;
  assert.throws(() => runP(b.state, '2027-07-15T12:00:00+09:00', { continuationSteps: [...alt, st3], docs: [DOC2] }), /continuation_not_append_only/);
});

test('固定の通し事例は不変（151.9 / 12.69 と13行）', () => {
  assert.equal(replay(clone(FIX)).rows.length, 13);
  assert.equal(cashAt(G[15].inputs, 14) + G[15].inputs.flowsDown[15] * 1e-4, failureValue(G[15].inputs, 15, [8]).cash);
});
