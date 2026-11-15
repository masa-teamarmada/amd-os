// 書籍第4〜7章の1か月の遷移の試験。実行: node --test book-monthly.test.mjs
// 期待値は書籍本文に印刷された数値（BOOK_MONTHLY_EXAMPLES の printed）。実装の出力から作った値は使わない。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOK_MONTHLY_EXAMPLES, textbookCases, stepBookMonth, replayObserved, openingState, selfSufficient12,
  additionalFundingParams, gateTimes, stagnationThreshold,
} from './book-monthly.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: 実装 ${a} / 印刷値 ${b} / 許容 ${tol}`);

for (const ex of textbookCases()) {
  test(`${ex.section} ${ex.label}`, () => {
    const actual = ex.run();
    for (const e of ex.expect) near(actual[e.key], e.printed, e.tol, `${ex.id}.${e.key}`);
  });
}
test('例の一覧が公開される', () => assert.equal(textbookCases(), BOOK_MONTHLY_EXAMPLES));

// ---- 通し事例の設定（書籍 §2.4.5 / §7.5.1 の値を入力として渡す） ----
const cfg = (extra = {}) => ({
  gates: [
    { id: 'T3', M: 28, stage: 3, psi: 0.8, gated: true },
    { id: 'M2', M: 15, stage: 4, psi: 1, gated: true }, // §4.9 表の標準 M=15（準備 6）
  ],
  spending: { preInc: 150, postInc: 450, postIncResearch: 150 },
  preProdSales: { 2: { pre: 0, post: 0 }, 3: { pre: 15, post: 30 }, 4: { pre: 52.5, post: 105 } },
  r3: { requiredGateId: 'M2' }, r4: { gStar: 3 },
  ...extra,
});
const univ = { gross: 60, directCost: 48, indirectRate: 0.3, university: true, ledger: 'restricted', rho: 0.2, gamma: 0 };

test('§7.4/§2.4.5 8か月目: T3通過、使途限定1567.2、自由15（量産前売上は通過後の段階で計上）', () => {
  const c = cfg();
  const st = { ...openingState({ gates: c.gates, elapsedInGate: 11, sr: 1708.8, sf: 0, stage: 2, contract: univ }), month: 7 };
  assert.equal(st.prepRemaining, 0);
  const r = stepBookMonth(st, c, { outcomes: { advance: 'pass' } });
  near(r.state.sr, 1567.2, 1e-6, 'sr'); near(r.state.sf, 15, 1e-6, 'sf');
  assert.equal(r.state.stage, 3);
  assert.equal(r.state.prepRemaining, gateTimes(15).Mmin); // 通過月は次の準備に数えない
});

test('§7.4/§2.4.5 15か月目: 出資は支払いより先、会社化、契約は会社名義へ。使途限定567.6、自由11982', () => {
  const c = cfg();
  const st = { ...openingState({ gates: c.gates, gateIdx: 1, elapsedInGate: 8, sr: 717.6, sf: 105, stage: 3, contract: univ, openItems: 0, passedGates: ['T3'] }), month: 14 };
  const r = stepBookMonth(st, c, {
    outcomes: { advance: 'pass', foundingEquity: 12000 },
    contractAfterIncorporation: { net: 72, ledger: 'free', rho: 0.3, gamma: 0 },
  });
  assert.equal(r.state.incorporated, true);
  near(r.state.sr, 567.6, 1e-6, 'sr'); near(r.state.sf, 11982, 1e-6, 'sf');
  assert.equal(r.state.stage, 4);
  assert.equal(r.terminated, null); // 会社化月は残高が6か月分を超えるのでR6に当たらない
});

test('§2.4.5 19か月目: 使途限定が尽き、不足分を自由資金から払う（自由 11457.6、使途限定 0）', () => {
  const c = cfg();
  const st = { ...openingState({ gates: [], sr: 117.6, sf: 11613, stage: 4, incorporated: true, contract: { net: 72, ledger: 'free', rho: 0.3 } }), month: 18 };
  const r = stepBookMonth(st, c, {});
  near(r.state.sr, 0, 1e-9, 'sr'); near(r.state.sf, 11457.6, 1e-6, 'sf');
});

test('資金更新: 失効 ℓ は支出より先に使途限定資金から引く（例2.7: 1200→1120）', () => {
  const st = { ...openingState({ gates: [], sr: 1200, sf: 0, projectFunded: false }), month: 3 };
  const r = stepBookMonth(st, cfg(), { restrictedExpiry: 80 });
  near(r.state.sr, 1120, 1e-9, 'sr'); assert.equal(r.state.sf, 0); // 資金なしの期間は支出0
});

test('§7.5 R2: 3、6、14か月目の不成立 → 7か月目に用途変更の検討、15か月目に4つの分岐（研究への返却のみ）', () => {
  const c = cfg({ gates: [{ id: 'T3', M: 28, stage: 3, psi: 0.8, gated: true }] });
  const st = openingState({ gates: c.gates, elapsedInGate: 5, sr: 2700, stage: 2 });
  const ev = { 3: { outcomes: { registryFailure: true } }, 6: { outcomes: { registryFailure: true } }, 14: { outcomes: { registryFailure: true } }, 15: {} };
  const r = replayObserved(st, c, ev);
  const by = (t) => r.months.find((m) => m.month === t);
  assert.equal(by(6).probs.failuresBefore, 1);   // 6か月目の手順4は、直前までの1回だけを見る
  assert.equal(by(7).probs.failuresBefore, 2);
  assert.equal(by(7).probs.pivotReview, true);
  assert.equal(by(7).terminated, null);
  assert.equal(by(14).probs.pivotReview, undefined); // 検討は1回
  assert.equal(by(14).terminated, null);
  assert.equal(by(15).probs.failuresBefore, 3);
  assert.equal(r.state.terminated.reason, 'branch');
  assert.equal(r.state.terminated.trigger, 'R2');
  assert.equal(r.state.terminated.month, 15);
  assert.deepEqual(r.state.terminated.options, ['return_to_research']);
  assert.ok(by(7).probs.advance > 0); // 7か月目から確率判定が始まる
  assert.ok(by(6).probs.advance === undefined); // 6か月目まで準備中
});

test('§7.5 k_exit を4に緩めると15か月目も続く', () => {
  const c = cfg({ gates: [{ id: 'T3', M: 28, stage: 3, psi: 0.8, gated: true }], rules: { kExit: 4 } });
  const st = openingState({ gates: c.gates, elapsedInGate: 5, sr: 2700, stage: 2 });
  const r = replayObserved(st, c, { 3: { outcomes: { registryFailure: true } }, 6: { outcomes: { registryFailure: true } }, 14: { outcomes: { registryFailure: true } }, 15: {} });
  assert.equal(r.state.terminated, null);
});

test('§7.3.7 追加調達の値: 成立確率 0.40（機能5充足）/ 0.30（空席）、12か月分、最大2回', () => {
  const a = additionalFundingParams({ f5Vacant: false }), b = additionalFundingParams({ f5Vacant: true });
  near(a.p, 0.40, 1e-12, 'p'); near(b.p, 0.30, 1e-12, 'p空席'); assert.equal(a.months, 12); assert.equal(a.maxAttempts, 2);
});

const post = (sf, extra = {}) => ({ ...openingState({ gates: [], sr: 0, sf, stage: 4, incorporated: true, vacant: [5], contract: null, ...extra }), month: 20 });

test('§7.3.7 R6: 残高が6か月分（3105）未満なら追加調達。成立なら12か月分（6210）が入り継続', () => {
  const r = stepBookMonth(post(3000), cfg(), { outcomes: { additionalFunding: true } });
  near(r.probs.additionalFunding, 0.30, 1e-12, 'p');
  near(r.state.sf, 3000 - 450 + 105 + 6210, 1e-6, 'sf'); // 段階4・会社化後の量産前売上105を含む
  assert.equal(r.state.additionalAttempts, 1); assert.equal(r.terminated, null);
});

test('§7.3.7 追加調達が不成立、または2回試し済みなら4つの分岐（段階4・会社化後はライセンスと買収も選べる）', () => {
  const fail = stepBookMonth(post(3000), cfg(), { outcomes: { additionalFunding: false } });
  assert.equal(fail.terminated.trigger, 'funds');
  assert.deepEqual(fail.terminated.options, ['return_to_research', 'license_switch', 'acquisition_handover']);
  const spent = stepBookMonth({ ...post(3000), additionalAttempts: 2 }, cfg(), { outcomes: { additionalFunding: true } });
  assert.equal(spent.terminated.trigger, 'funds');
  assert.equal(spent.state.additionalAttempts, 2); // 上限後は試みない
  const out = stepBookMonth(post(100), cfg(), { outcomes: { additionalFunding: true } }); // 自由資金が負になる月も同じ入口
  assert.ok(out.state.sf > 0);
});

test('初回自走が成立すれば R6 の分岐に入らない', () => {
  const c = cfg({ recurring: () => ({ spend: 450, revenue: (k) => 5000, purchases: () => 0 }) });
  const r = stepBookMonth(post(100), c, {});
  assert.equal(r.state.firstSelfSuffMonth, 21); assert.equal(r.terminated, null);
});

test('§2.4.5 40か月目の12か月自走判定: 最小の余剰は約2399.8、§7.1.1 の例 A は成立・B は不成立', () => {
  const ok = selfSufficient12({ spend: 450, revenue: (k) => 600000 / 12 * (k / 12), purchases: (k) => 200000 / 12 * (k / 12), contractEarn: 72, contractRemaining: 12 });
  assert.equal(ok.ok, true); near(ok.margins[0], 2399.8, 0.05, '1か月目の余剰');
  const A = selfSufficient12({ spend: 450, revenue: () => 350, purchases: () => 70, contractEarn: 180, contractRemaining: 12 });
  const B = selfSufficient12({ spend: 450, revenue: () => 350, purchases: () => 70, contractEarn: 180, contractRemaining: 4 });
  assert.equal(A.ok, true); assert.equal(B.ok, false);
  near(A.margins[0], 10, 1e-9, '本文: 1か月目の余剰10'); assert.equal(B.shortfallMonths[0], 5);
});

test('入金IDの重複は二重計上として拒否、応募資格が未確認の機会には応募しない、資格の上限超過の採択は入金しない', () => {
  const c = cfg();
  const st = { ...openingState({ gates: [], sr: 0, sf: 1000, stage: 2, projectFunded: false,
    opportunities: [{ id: 'U', eligibility: null }, { id: 'A', eligibility: { confirmed: true, maxAmount: 500 } }] }), month: 0 };
  const r = stepBookMonth(st, c, {
    receipts: [{ id: 'r1', amount: 20, ledger: 'free' }, { id: 'r1', amount: 20, ledger: 'free' }],
    outcomes: { award: { id: 'A', won: true, amount: 900, schedule: [{ month: 1, amount: 900 }] } },
  });
  near(r.state.sf, 1020, 1e-9, '一度だけ加算');
  assert.ok(r.missing.some((m) => m.includes('二重計上')));
  assert.ok(r.missing.some((m) => m.includes('応募資格が未確認: U')));
  assert.ok(r.missing.some((m) => m.includes('上限を超過')));
  assert.equal(r.state.receivables.length, 0);
});

test('期限月の機会は手順1で一覧から除かれる', () => {
  const st = { ...openingState({ gates: [], projectFunded: false, opportunities: [{ id: 'X', deadlineMonth: 1, eligibility: { confirmed: true } }] }), month: 0 };
  const r = stepBookMonth(st, cfg(), {});
  assert.equal(r.state.opportunities.length, 0); assert.equal(r.probs.award, undefined);
});

test('会社化前の資金なしでは T3 の前進率が0（受託契約の月は通常率×(1-γρ)）', () => {
  const c = cfg();
  const base = { ...openingState({ gates: c.gates, elapsedInGate: 11, projectFunded: false, stage: 2 }), month: 5 };
  assert.equal(stepBookMonth(base, c, {}).probs.advance, 0);
  const withContract = { ...base, contract: { ...univ, gamma: 0.5 } };
  const p0 = stepBookMonth({ ...base, projectFunded: true }, c, {}).probs.advance;
  const p1 = stepBookMonth(withContract, c, {}).probs.advance;
  assert.ok(p1 > 0 && p1 < p0);
});

test('§6.7/§7.1.1 権利確認は手順4の R3 より前に未了件数を減らす（件数は未了を超えない）', () => {
  const c = cfg();
  const mk = (openItems) => ({ ...openingState({ gates: c.gates, gateIdx: 1, elapsedInGate: 8, sr: 717.6, sf: 105, stage: 3, openItems, passedGates: ['T3'] }), month: 14 });
  const ev = (rightsResolved) => ({ outcomes: { advance: 'pass', foundingEquity: 12000, rightsResolved } });
  assert.equal(stepBookMonth(mk(2), c, ev(undefined)).state.incorporated, false); // 暗黙の解消はしない
  assert.equal(stepBookMonth(mk(2), c, ev(1)).state.incorporated, false);
  const done = stepBookMonth(mk(2), c, ev(2));
  assert.equal(done.state.incorporated, true); assert.equal(done.state.openItems, 0);
  const over = stepBookMonth(mk(1), c, ev(3));
  assert.equal(over.state.openItems, 0); assert.ok(over.missing.some((m) => m.includes('超過')));
  assert.equal(stepBookMonth(mk(2), c, ev(['a', 'a', 'b'])).state.openItems, 0); // ID は重複を除く
});

test('§7.3.3 例7.3: 85%点は開始から61か月・評価日から56か月。ex7.2 は同じ空席で採択 .157378・ライセンス .0011', () => {
  const eta = 0.95 ** 4;
  assert.equal(stagnationThreshold({ M: 28, psi: 0.8, eta }).months, 61);
  assert.equal(stagnationThreshold({ M: 28, psi: 0.8, eta, elapsedInGate: 5 }).monthsFromNow, 56);
});

test('§7.3.3 滞留の自動不成立は閾値を超えた月に1回だけ。R2 は翌月、未観測は不成立でない', () => {
  const c = cfg({ gates: [{ id: 'T3', M: 28, stage: 3, psi: 0.8, gated: true, stagnationThreshold: 61 }] });
  let st = { ...openingState({ gates: c.gates, elapsedInGate: 60, sr: 2700, stage: 2 }), month: 55, failures: { T3: 2 }, pivotConsidered: { T3: true } };
  let r = stepBookMonth(st, c, {}); // 経過61: まだ超えない
  assert.equal(r.state.failures.T3, 2); assert.ok(r.unobserved.includes('advance'));
  r = stepBookMonth(r.state, c, {}); // 経過62: 超過 → 1回だけ加算
  assert.equal(r.state.failures.T3, 3); assert.equal(r.terminated, null);
  r = stepBookMonth(r.state, c, {}); // 翌月の手順4で R2
  assert.equal(r.terminated.trigger, 'R2'); assert.equal(r.state.failures.T3, 3);
  const noRule = openingState({ gates: [{ id: 'T3', M: 28, stage: 3, psi: 0.8, gated: true }], elapsedInGate: 90, sr: 2700, stage: 2 });
  assert.equal(stepBookMonth(noRule, { ...c, gates: [{ id: 'T3', M: 28, stage: 3, psi: 0.8, gated: true }] }, {}).state.failures.T3, undefined);
});

test('結果が未指定の項目は未観測として返り、起きなかったとは扱わない', () => {
  const c = cfg();
  const st = { ...openingState({ gates: c.gates, elapsedInGate: 11, sr: 1000, stage: 2 }), month: 7 };
  const r = stepBookMonth(st, c, {});
  assert.ok(r.unobserved.includes('advance')); assert.ok(r.unobserved.includes('loss'));
  assert.equal(r.state.gateIdx, 0);
});
