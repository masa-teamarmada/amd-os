// 重点テスト: node --test model/tools/bzm-sheet-pilot/
// 長いモデル計算は bzmRun の注入で回避する。ネットワークは使わない（fetch を差し替える）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { extract, plan, init, apply, verifyLock, TAB_NAMES } from './pilot.mjs';

const P1 = '2026年10月31日時点の現金残高は1,200万円である。';
const P2 = '毎月の支出は150万円である。';
const P3 = '2026年度の年額純増は30億円と算定した。';
const P4 = '2026年11月10日、第一相試験で主要評価項目を達成した。';
const P5 = '来年度に補助金3,000万円を受け取る予定である。';

const RAW = [
  { paragraph: 'P1', category: 'cash_balance_yen', value: 12000000, event_date: '2026-10-31', quote: '現金残高は1,200万円', status: 'actual' },
  { paragraph: 'P2', category: 'monthly_burn_yen', value: 1500000, event_date: '2026-10-31', quote: '毎月の支出は150万円', status: 'actual' },
  { paragraph: 'P3', category: 'annual_net_impact_yen', value: 3000000000, event_date: '2026-10-31', quote: '年額純増は30億円', status: 'actual' },
];
const RAW_TRIAL = { paragraph: 'P4', category: 'trial_result', value: 'achieved', event_date: '2026-11-10', name: '第一相試験', quote: '主要評価項目を達成した', status: 'actual' };

function fakeFetch(raw, calls) {
  return async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(raw) }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40, thoughtsTokenCount: 0, totalTokenCount: 140 } }) };
  };
}
const doc = (text, revision = 'r1') => ({ id: 'doc1', title: 'テスト文書', revision, text });
const tabs = { [TAB_NAMES.eval]: 10, [TAB_NAMES.obs]: 11, [TAB_NAMES.fc]: 12, [TAB_NAMES.log]: 13 };
const base = { type: 'F2', reg: 'REG0', gate: 'T2', incorporated: false };
const bzmRun = async () => ({ v10: 0.1, v50: 0.5, v90: 0.9 });
const run = (extractOut, state, extra = {}) => plan({ extract: extractOut, state, base, tabs, spreadsheetId: 'sheet1', ...extra }, { bzmRun });

test('ロックのSHA照合が通る', () => { assert.equal(verifyLock().modelVersion, 'bzm-3.0'); });

test('Gemini へ responseJsonSchema を送る（試験は文字列enum、他は整数）', async () => {
  const calls = [];
  await extract({ doc: doc(P1), state: null }, { apiKey: 'k', fetchImpl: fakeFetch([], calls) });
  const s = calls[0].generationConfig.responseJsonSchema;
  assert.equal(s.type, 'array');
  assert.equal(s.items.anyOf.length, 2);
  const [trial, other] = s.items.anyOf;
  assert.deepEqual(trial.properties.category.enum, ['trial_result']);
  assert.deepEqual(trial.properties.value.enum, ['achieved', 'not_achieved']);
  assert.equal(trial.properties.name.type, 'string');
  assert.ok(trial.required.includes('name'));
  assert.equal(other.properties.value.type, 'integer');
  assert.ok(!other.properties.category.enum.includes('trial_result'));
  assert.ok(other.properties.category.enum.includes('cash_balance_yen'));
});

test('差分抽出: 同じ版は再抽出せず、変更分だけ送り、削除を報告する', async () => {
  const calls = [];
  const f = fakeFetch(RAW, calls);
  const a = await extract({ doc: doc([P1, P2, P3].join('\n\n')), state: null, rates: { input: 0.1, output: 0.4 } }, { apiKey: 'k', fetchImpl: f });
  assert.equal(calls.length, 1);
  assert.equal(a.candidates.length, 3);
  assert.equal(a.usage.inputTokens, 100);
  assert.ok(Math.abs(a.usage.costUsd - (100 * 0.1 + 40 * 0.4) / 1e6) < 1e-12);

  const same = await extract({ doc: doc([P1, P2, P3].join('\n\n'), 'r2'), state: a.snapshot }, { apiKey: 'k', fetchImpl: f });
  assert.equal(calls.length, 1, '同じ段落版では呼ばない');
  assert.equal(same.llm.status, 'skipped');

  const changed = await extract({ doc: doc([P1, P3, P4].join('\n\n'), 'r3'), state: a.snapshot }, { apiKey: 'k', fetchImpl: fakeFetch([RAW_TRIAL].map((c) => ({ ...c, paragraph: 'P1' })), calls) });
  assert.equal(calls.length, 2);
  assert.equal(changed.delta.sent, 1);               // P4 だけ
  assert.equal(changed.delta.removed.length, 1);     // P2 の削除
  const body = (i) => { const t = calls[i].contents[0].parts[0].text; return t.slice(t.lastIndexOf('\n# 段落\n')); };
  assert.ok(body(1).includes(P4));                   // 本文セクションで比較（定義文の「現金残高」とは無関係）
  for (const old of [P1, P2, P3]) assert.ok(!body(1).includes(old), '抽出済みの段落は本文に入れない');

  const P1b = '2026年10月31日時点の現金残高は1,300万円に改まった。';   // 改訂された段落は再送する
  await extract({ doc: doc([P1b, P3, P4].join('\n\n'), 'r4'), state: changed.snapshot }, { apiKey: 'k', fetchImpl: fakeFetch([], calls) });
  assert.ok(body(2).includes(P1b) && !body(2).includes(P1 + '\n') && !body(2).includes(P4));
});

test('年額純増の採用済み試算だけ actual。将来の入金は planned のまま', async () => {
  const q = '国内付加価値の年額純増の見込みを1.2億円から1.35億円へ改めることを決定';
  const para = `${q}した。`;
  const raw = [
    { paragraph: 'P1', category: 'annual_net_impact_yen', value: 135000000, event_date: '2026-11-10', quote: q, status: 'actual' },
    { paragraph: 'P1', category: 'annual_net_impact_yen', value: 200000000, event_date: null, quote: '年額純増は2億円を目標とする', status: 'actual' },
    { paragraph: 'P1', category: 'grant_received', value: 30000000, event_date: null, quote: '入金の見込みを3,000万円へ改めることを決定', status: 'actual' },
  ];
  const text = `${para}年額純増は2億円を目標とする。入金の見込みを3,000万円へ改めることを決定。`;
  const out = await extract({ doc: doc(text), state: null }, { apiKey: 'k', fetchImpl: fakeFetch(raw, []) });
  assert.deepEqual(out.candidates.map((c) => c.status), ['actual', 'planned', 'planned']);
});

test('採択の引用に次の予定の文が混ざっても直接根拠の文へ狭める。採択予定は planned のまま', async () => {
  const s1 = '2026-10-07、事務局から補助金400万円の採択通知を受領した。';
  const para = `${s1}入金は翌月予定。`;
  const raw = [
    { paragraph: 'P1', category: 'grant_awarded', value: 4000000, event_date: '2026-10-07', quote: para, status: 'actual' },
    { paragraph: 'P2', category: 'grant_awarded', value: 4000000, event_date: null, quote: '補助金400万円の採択予定。', status: 'actual' },
  ];
  const out = await extract({ doc: doc([para, '補助金400万円の採択予定。'].join('\n\n')), state: null }, { apiKey: 'k', fetchImpl: fakeFetch(raw, []) });
  assert.deepEqual(out.candidates.map((c) => c.status), ['actual', 'planned']);
  assert.equal(out.candidates[0].quote, s1);
  assert.equal(out.candidates[0].quote_original, para);
  assert.equal(out.candidates[1].quote_original, undefined);
});

test('評価に関係ない新規段落でも、正常処理ならカーソルだけ保存する（評価0行）。再実行は書かない', async () => {
  const f = fakeFetch([], []);
  const ex = await extract({ doc: doc('社内の雑談です。'), state: null }, { apiKey: 'k', fetchImpl: f });
  const p = await run(ex, null, { asOf: '2026-11-15T00:00:00Z' });
  assert.equal(p.summary.status, 'cursor_only');
  assert.ok(p.state.doc.extracted && Object.keys(p.state.doc.extracted).length === 1);
  assert.ok(!p.requests.some((r) => r.appendCells && r.appendCells.sheetId === tabs[TAB_NAMES.eval]));
  const calls = [];
  const again = await extract({ doc: doc('社内の雑談です。', 'r2'), state: p.state.doc }, { apiKey: 'k', fetchImpl: fakeFetch([], calls) });
  assert.equal(calls.length, 0);
  assert.equal((await run(again, p.state, { asOf: '2026-11-16T00:00:00Z' })).requests.length, 0);
});

test('未来の日付は採用しない（JSTの暦日）', async () => {
  const ex = await extract({ doc: doc(P1), state: null }, { apiKey: 'k', fetchImpl: fakeFetch([RAW[0]], []) });   // 10-31
  const id = ex.candidates[0].id;
  const early = await run(ex, null, { approved: [id], asOf: '2026-10-30T20:00:00+09:00' });
  assert.equal(early.summary.rejected[0].reason, 'future_event_date');
  const ok = await run(ex, null, { approved: [id], asOf: '2026-10-31T00:30:00+09:00' });   // UTCでは10-30、JSTでは10-31
  assert.equal(ok.summary.adopted.length, 1);
});

test('実績: 名称不一致・期限前のno・期限当日の境界', async () => {
  const fc = { question: '第一相試験で達成するか', probability: 0.5, deadline: '2026-12-31', criterion: '達成', event: '第一相試験' };
  const fail = { ...RAW_TRIAL, value: 'not_achieved', quote: '主要評価項目を達成した' };
  const other = { ...RAW_TRIAL, name: '第二相試験' };
  const mk = async (raw) => extract({ doc: doc(P4), state: null }, { apiKey: 'k', fetchImpl: fakeFetch([{ ...raw, paragraph: 'P1' }], []) });
  const saved = await run(null, null, { asOf: '2026-11-01T00:00:00Z', forecast: fc });
  const fid = saved.summary.forecastSaved;
  const go = async (raw, asOf) => {
    const ex = await mk(raw); const id = ex.candidates[0].id;
    return run(ex, saved.state, { approved: [id], asOf, actual: { forecastId: fid, candidateId: id, outcome: raw.value === 'achieved' ? 'yes' : 'no' } });
  };
  await assert.rejects(go(other, '2026-11-15T00:00:00Z'), /trial_name_mismatch/);
  await assert.rejects(go(fail, '2026-11-15T00:00:00Z'), /no_before_deadline/);
  assert.equal((await go(fail, '2026-12-31T00:00:00+09:00')).summary.actualRecorded, fid);   // 期限当日
});

test('評価の重複は直前との比較だけ: A→B→A は再計算する', async () => {
  const mkEx = async (n) => extract({ doc: doc(`現金${n}`), state: null }, { apiKey: 'k',
    fetchImpl: fakeFetch([{ ...RAW[0], paragraph: 'P1', value: n * 1e4, quote: `現金${n}` }], []) });
  const a = await mkEx(1000), b = await mkEx(2000);
  const s1 = await run(a, null, { approved: [a.candidates[0].id], asOf: '2026-11-01T00:00:00Z' });
  const s2 = await run(b, s1.state, { approved: [b.candidates[0].id], asOf: '2026-11-02T00:00:00Z' });
  assert.ok(s2.summary.evaluation);
  const evalOf = (p) => p.requests.filter((r) => r.appendCells && r.appendCells.sheetId === tabs[TAB_NAMES.eval]).length;
  const s3 = await run(a, s2.state, { asOf: '2026-11-03T00:00:00Z' });   // 同じ入力 A の再採用は追記なし（採用済み）
  assert.equal(evalOf(s3), 0);
  const adoptedA = { ...s2.state, inputs: { ...s2.state.inputs, cash_balance_yen: s1.state.inputs.cash_balance_yen } };
  const s4 = await run(a, adoptedA, { asOf: '2026-11-04T00:00:00Z' });
  assert.equal(evalOf(s4), 1);
});

test('段落に存在しない引用は候補にしない。予定は planned になる', async () => {
  const raw = [
    { ...RAW[0], quote: '存在しない引用' },
    { paragraph: 'P2', category: 'grant_received', value: 30000000, event_date: null, quote: '補助金3,000万円を受け取る予定', status: 'actual' },
  ];
  const out = await extract({ doc: doc([P1, P5].join('\n\n')), state: null }, { apiKey: 'k', fetchImpl: fakeFetch(raw, []) });
  assert.equal(out.rejected.quote_not_in_paragraph, 1);
  assert.equal(out.candidates.length, 1);
  assert.equal(out.candidates[0].status, 'planned');
  const p = await run(out, null, { approved: [out.candidates[0].id], asOf: '2026-11-15T00:00:00Z' });
  assert.equal(p.summary.rejected[0].reason, 'planned_not_actual');
});

test('キー無しでは呼ばず、抽出済みにもしない', async () => {
  const calls = [];
  const out = await extract({ doc: doc(P1), state: null }, { apiKey: '', fetchImpl: fakeFetch(RAW, calls) });
  assert.equal(calls.length, 0);
  assert.equal(out.llm.status, 'no_api_key');
  assert.deepEqual(out.snapshot.extracted, {});
});

test('plan: 採用後に評価・観測を追記し、同じ版は追記しない', async () => {
  const ex = await extract({ doc: doc([P1, P2, P3].join('\n\n')), state: null }, { apiKey: 'k', fetchImpl: fakeFetch(RAW, []) });
  const ids = ex.candidates.map((c) => c.id);
  const p1 = await run(ex, null, { approved: ids, asOf: '2026-11-01T00:00:00Z' });
  assert.equal(p1.summary.status, 'write');
  assert.equal(p1.summary.evaluation.v50Oku, 15);                    // 0.5 × 30億円
  assert.equal(p1.requests.filter((r) => r.appendCells).length, 3);  // 評価・観測・処理記録
  const evalRow = p1.requests[0].appendCells.rows[0].values.map((v) => Object.values(v.userEnteredValue)[0]);
  assert.equal(evalRow[1], '産業創出価値(BZM 3.0内部版)');
  assert.equal(evalRow[9], 1200);                                    // 円 → 万円

  const p2 = await run(ex, p1.state, { approved: ids, asOf: '2026-11-02T00:00:00Z' });
  assert.equal(p2.summary.status, 'no_change');
  assert.equal(p2.requests.length, 0);
  assert.equal(p2.prevStateHash, (await run(ex, p1.state, { approved: ids, asOf: '2026-11-02T00:00:00Z' })).prevStateHash);
});

test('予測: 事後の上書き不可・結果は別行・二重記録と事前の観測は不可', async () => {
  const text = [P1, P2, P3, P4].join('\n\n');
  const ex = await extract({ doc: doc(text), state: null }, { apiKey: 'k', fetchImpl: fakeFetch([...RAW, RAW_TRIAL], []) });
  const byCat = (c) => ex.candidates.find((x) => x.category === c).id;
  const fc = { question: '第一相試験で主要評価項目を達成するか', probability: 0.6, deadline: '2026-12-31', criterion: '主要評価項目の達成', event: '第一相試験' };
  const approvedInputs = ['cash_balance_yen', 'monthly_burn_yen', 'annual_net_impact_yen'].map(byCat);

  // 予測を 11/01 に保存。試験結果（11/10）は後から採用する
  const a = await run(ex, null, { approved: approvedInputs, asOf: '2026-11-01T00:00:00Z', forecast: fc });
  const fid = a.summary.forecastSaved;
  assert.ok(fid);
  await assert.rejects(run(ex, a.state, { forecast: { ...fc, probability: 0.9 }, asOf: '2026-11-02T00:00:00Z' }), /forecast_immutable/);

  const b = await run(ex, a.state, { approved: [byCat('trial_result')], asOf: '2026-11-15T00:00:00Z',
    actual: { forecastId: fid, candidateId: byCat('trial_result'), outcome: 'yes' } });
  const row = b.requests.find((r) => r.appendCells && r.appendCells.sheetId === tabs[TAB_NAMES.fc]).appendCells.rows[0].values;
  assert.equal(Object.values(row[0].userEnteredValue)[0], '実績');
  assert.equal(Object.values(row[8].userEnteredValue)[0], 'yes');
  await assert.rejects(run(ex, b.state, { asOf: '2026-11-16T00:00:00Z', actual: { forecastId: fid, candidateId: byCat('trial_result'), outcome: 'yes' } }), /actual_duplicate/);

  // 予測の保存より前に観測された結果は使えない
  const late = await run(ex, null, { approved: [...approvedInputs, byCat('trial_result')], asOf: '2026-11-12T00:00:00Z', forecast: fc });
  await assert.rejects(run(ex, late.state, { asOf: '2026-11-13T00:00:00Z',
    actual: { forecastId: late.summary.forecastSaved, candidateId: byCat('trial_result'), outcome: 'yes' } }), /observation_not_after_forecast/);
  // 結果と出力の食い違い
  await assert.rejects(run(ex, a.state, { approved: [byCat('trial_result')], asOf: '2026-11-15T00:00:00Z',
    actual: { forecastId: fid, candidateId: byCat('trial_result'), outcome: 'no' } }), /outcome_mismatch/);
});

test('新規予測の期限は記録日(JST暦日)より後のみ。同日・過去は拒否、翌日は可、固定済みの再実行は可', async () => {
  const text = [P1, P2, P3].join('\n\n');
  const ex = await extract({ doc: doc(text), state: null }, { apiKey: 'k', fetchImpl: fakeFetch(RAW, []) });
  const ids = ex.candidates.filter((c) => c.status === 'actual').map((c) => c.id);
  const fc = { question: '期限の境界', probability: 0.5, deadline: '2026-11-02', criterion: '基準', event: '出来事' };
  const asOf = '2026-11-01T16:00:00Z';   // JSTでは 11/02 01:00
  await assert.rejects(run(ex, null, { approved: ids, asOf, forecast: fc }), /forecast_deadline_not_future/);
  await assert.rejects(run(ex, null, { approved: ids, asOf, forecast: { ...fc, deadline: '2026-10-01' } }), /forecast_deadline_not_future/);
  const ok = await run(ex, null, { approved: ids, asOf, forecast: { ...fc, deadline: '2026-11-03' } });
  assert.ok(ok.summary.forecastSaved);
  // 固定済みと同じ予測を、期限が過ぎた後に再実行しても拒否されない
  const again = await run(ex, ok.state, { asOf: '2026-11-05T00:00:00Z', forecast: { ...fc, deadline: '2026-11-03' } });
  assert.equal(again.summary.forecastSaved, null);
});

test('予測・実績が無くても動く／init は非空ファイルを拒否する', async () => {
  const ex = await extract({ doc: doc(P1), state: null }, { apiKey: 'k', fetchImpl: fakeFetch([RAW[0]], []) });
  const p = await run(ex, null, { approved: [ex.candidates[0].id], asOf: '2026-11-01T00:00:00Z' });
  assert.equal(p.summary.forecastSaved, null);
  assert.equal(p.summary.evaluation.v50Oku, '');                    // 年額純増が無ければ億円換算は空欄
  assert.throws(() => init({ sheet: { spreadsheetId: 's', sheets: [{ sheetId: 0, title: 'Sheet1' }], empty: false } }), /not_empty_initial_file/);
  const ok = init({ sheet: { spreadsheetId: 's', sheets: [{ sheetId: 0, title: 'Sheet1' }], empty: true } });
  assert.equal(ok.requests.filter((r) => r.addSheet).length, 3);
});

test('apply: --apply と予定IDの一致が無ければ書かず、状態が変わっていれば止める', async () => {
  const p = { kind: 'plan', spreadsheetId: 's1', prevStateHash: 'null', requests: [{ appendCells: {} }] };
  assert.equal((await apply(p, { spreadsheetId: 's1', doApply: false })).dryRun, true);
  await assert.rejects(apply(p, { spreadsheetId: 'other', doApply: true, token: 't' }), /spreadsheet_mismatch/);
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, method: init?.method });
    const json = url.includes('/values/') ? { values: [['{"v":1}']] } : { properties: { title: 'x' }, sheets: [{ properties: { sheetId: 13, title: TAB_NAMES.log } }] };
    return { ok: true, json: async () => json };
  };
  await assert.rejects(apply(p, { spreadsheetId: 's1', doApply: true, token: 't', fetchImpl: f }), /state_changed/);
  assert.ok(!calls.some((c) => c.method === 'POST'));
});
