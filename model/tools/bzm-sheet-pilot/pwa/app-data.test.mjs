// 表示データの試験。実行: node --test app-data.test.mjs
// 期待値は本の印刷値。実装の出力から作った値は使わない。
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData, PRINTED_BALANCES } from './app-data.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const D = buildDemoData();
const row = (c, m) => c.rows.find((r) => r.month === m);

test('契約の形（同期で呼べ、JSON として往復できる）', () => {
  assert.deepEqual(Object.keys(D).sort(), ['book', 'continuation', 'monthly', 'reference', 'valuation']);
  assert.equal(typeof D.book.version, 'string'); assert.equal(typeof D.book.commit, 'string');
  assert.deepEqual(JSON.parse(JSON.stringify(D)), D);
  assert.deepEqual(buildDemoData(), D);   // 呼ぶたびに同じ結果
  for (const c of D.monthly.cases) for (const r of c.rows) {
    assert.deepEqual(Object.keys(r).sort(), ['events', 'failureCount', 'free', 'incorporated', 'month', 'next', 'notes', 'probabilities', 'restricted', 'stage', 'status']);
  }
});

test('通し事例: 本に印刷された資金残高（1、8、15、19 か月目）', () => {
  const c = D.monthly.cases[0];
  assert.equal(c.rows.length, 20);   // 0..19
  for (const [m, [sr, sf]] of Object.entries(PRINTED_BALANCES)) {
    near(row(c, Number(m)).restricted, sr, 1e-6, `${m} 使途限定`); near(row(c, Number(m)).free, sf, 1e-6, `${m} 自由`);
  }
  near(row(c, 0).restricted, 2700, 0, '評価日'); assert.equal(row(c, 0).free, 0);
  near(row(c, 7).restricted, 1708.8, 1e-6, '7 か月目');
  near(row(c, 14).restricted, 717.6, 1e-6, '14 か月目'); near(row(c, 14).free, 105, 1e-6, '14 か月目');
  near(row(c, 18).restricted, 117.6, 1e-6, '18 か月目'); near(row(c, 18).free, 11613, 1e-6, '18 か月目');
});

test('通し事例: 節目の月・会社化・準備期間（M2 は 6 か月）', () => {
  const c = D.monthly.cases[0];
  assert.equal(row(c, 7).stage, 2); assert.equal(row(c, 8).stage, 3); assert.equal(row(c, 8).status, '節目を通過');
  assert.equal(row(c, 8).next, 'M2');
  for (const m of [9, 14]) assert.equal(row(c, m).status, '準備中');
  assert.equal(row(c, 15).stage, 4); assert.equal(row(c, 15).incorporated, true); assert.equal(row(c, 14).incorporated, false);
  assert.equal(row(c, 15).next, null);
  assert.ok(row(c, 15).events.some((e) => e.includes('12000')));
  assert.ok(row(c, 7).notes.some((n) => n.includes('未観測')));   // 7 か月目の結果は本に記載なし
  assert.equal(row(c, 7).failureCount, 0);
  const p1 = row(c, 1).probabilities;
  near(p1.find((p) => p.label.includes('採択')).value, 0.157378, 1e-6, '採択確率');
  near(p1.find((p) => p.label.includes('受託')).value, 0.037, 0.001, '受託の引き合い');
});

test('通し事例: 空席は機能 3〜6、9 か月目に確認済み権利 2 件を反映', () => {
  const c = D.monthly.cases[0];
  assert.ok(row(c, 9).notes.some((n) => n.includes('権利確認 2 件') && n.includes('未了 0')));
  assert.ok(!row(c, 9).notes.some((n) => n.includes('超過')));
});

test('第2事例: 3、6、14 か月目の不成立 → 7 か月目に用途変更の検討、15 か月目に研究への返却', () => {
  const c = D.monthly.cases[1];
  assert.equal(c.rows.length, 16);
  assert.deepEqual([3, 6, 7, 14, 15].map((m) => row(c, m).failureCount), [1, 2, 2, 3, 3]);
  assert.equal(row(c, 6).failureCount, 2); assert.equal(row(c, 5).failureCount, 1);
  assert.ok(row(c, 7).events.some((e) => e.includes('用途変更の検討')));
  assert.ok(!row(c, 14).events.some((e) => e.includes('用途変更の検討')));
  assert.equal(row(c, 14).status, '判定月');
  assert.equal(row(c, 15).status, '4つの分岐へ');
  assert.ok(row(c, 15).events.some((e) => e.includes('研究への返却')));
  assert.ok(!row(c, 15).events.some((e) => e.includes('ライセンス')));
  assert.ok(row(c, 7).probabilities.some((p) => p.value > 0)); assert.equal(row(c, 6).probabilities.length, 0);
  near(row(c, 15).restricted, 2700 - 15 * 150, 1e-9, '使途限定');
});

test('継続の比較: 不成立側の印刷値（8/15/27/39）と通過側との大小', () => {
  const want = { 8: ['0.00', '0.0'], 15: ['3.09', '110.6'], 27: ['5.19', '161.0'], 39: ['5.79', '193.9'] };
  assert.deepEqual(D.continuation.gates.map((g) => g.month), [8, 15, 27, 39]);
  for (const g of D.continuation.gates) {
    assert.deepEqual([g.down.rnpv.toFixed(2), g.down.icv.toFixed(1)], want[g.month]);
    assert.ok(g.p > 0 && g.p < 1); assert.ok(g.up.rnpv > g.down.rnpv); assert.equal(typeof g.label, 'string');
  }
});

test('署名待ち: 120 万円から 150×6、一時金 5000 万円（21 か月目）', () => {
  const w = D.continuation.waiting;
  assert.deepEqual(w.rows.map((r) => r.beforeUpfront), [-30, -180, -330, -480, -630, -780]);
  assert.equal(w.rows[5].afterUpfront, 4220); assert.equal(w.rows[5].upfrontMan, 5000);
  assert.equal(w.totalMan, 900); assert.equal(w.bridgeMan, 780); assert.equal(w.endMan, 4220);
});

test('評価額の履歴: 初期値と 13 の出来事・節目', () => {
  const h = D.valuation.history;
  assert.equal(h.length, 14); assert.equal(h[0].month, 0);
  assert.deepEqual(h.slice(1).map((x) => x.month), [3, 5, 8, 9, 11, 15, 18, 21, 24, 27, 31, 35, 39].sort((a, b) => a - b));
  assert.equal(h.filter((x) => x.kind === '節目').length, 4);
  assert.ok(h.every((x) => x.label && Number.isFinite(x.icv) && Number.isFinite(x.rnpv)));
  assert.ok(h.find((x) => x.month === 8).label.includes('実環境'));
});

test('著者の計算結果の表', () => {
  const r = D.reference;
  assert.ok(r.source.includes('17.3')); assert.ok(r.cases.length > 0);
  for (const c of r.cases) {
    assert.ok(['F1', 'F2', 'F3', 'F4'].includes(c.type)); assert.ok(['REG0', 'REG1', 'REG2'].includes(c.reg));
    for (const k of ['v', 'v10', 'v50', 'v90', 'pM4', 'm4mean']) assert.ok(Number.isFinite(c[k]), `${c.type}${c.reg}.${k}`);
    assert.equal(typeof c.provenance, 'string');
  }
});
