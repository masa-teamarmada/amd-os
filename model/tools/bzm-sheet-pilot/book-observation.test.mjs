// 書籍版の抽出（extractBook と validateBookCandidates）の試験。通信はモック。実行: node --test book-observation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBook, extract } from './pilot.mjs';
import { validateBookCandidates, bookYenAmounts, BOOK_RESPONSE_JSON_SCHEMA } from './book-observation.mjs';

const DOC = (text, revision = 'r1') => ({ id: 'doc1', title: '進捗メモ', revision, text });
const mockFetch = (items, calls = []) => async (url, init) => {
  calls.push(JSON.parse(init.body));
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(items) }] } }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 } }) };
};
const item = (o) => ({ paragraph: 'P1', event_type: null, supplement: null, fund: null, value: null, event_date: null,
  name: '名称', reason: '引用の語句から判断', quote: '', status: 'actual', ...o });

test('スキーマと書籍用の指示がモデル呼び出しへ渡る／出典位置・版登録情報が返る', async () => {
  const calls = [];
  const text = '前置きの段落。\n\n無償PoCの実施に合意した。試験は成功した。';
  const out = await extractBook({ doc: DOC(text) }, { apiKey: 'k', fetchImpl: mockFetch([
    item({ paragraph: 'P2', event_type: 11, quote: '無償PoCの実施に合意した。', name: '無償PoC合意' }),
    item({ paragraph: 'P2', event_type: 10, quote: '試験は成功した。', name: '試験', status: 'actual' }),
  ], calls) });
  assert.deepEqual(calls[0].generationConfig.responseJsonSchema, BOOK_RESPONSE_JSON_SCHEMA);
  assert.match(calls[0].contents[0].parts[0].text, /出来事の24の種類/);
  const [a, b] = out.candidates;
  assert.equal(a.event_type, 11); assert.equal(a.status, 'actual');
  assert.equal(a.source.position, 2);                       // 資料内の2番目の段落
  assert.equal(b.event_type, 10);                           // 後の試験結果は別の出来事
  assert.notEqual(a.id, b.id);
  const ex = out.extraction;
  assert.equal(ex.model, 'gemini-3.1-flash-lite');
  assert.match(ex.promptSha256, /^[0-9a-f]{64}$/);
  assert.equal(ex.generation.thinkingLevel, 'minimal');
  assert.deepEqual(ex.requestedBlocks.map((x) => x.position), [1, 2]);
  assert.equal(out.usage.totalTokens, 120);
  assert.ok(!JSON.stringify(ex).includes('前置き') && !JSON.stringify(ex).includes('"k"'));   // 本文・キーを含めない
});

test('同じ資料版の再実行ではモデルを呼ばない（抽出済みハッシュを再利用）', async () => {
  const text = '無償PoCの実施に合意した。';
  const first = await extractBook({ doc: DOC(text) }, { apiKey: 'k', fetchImpl: mockFetch([item({ event_type: 11, quote: text })]) });
  const calls = [];
  const again = await extractBook({ doc: DOC(text, 'r2'), state: first.snapshot }, { apiKey: 'k', fetchImpl: mockFetch([], calls) });
  assert.equal(calls.length, 0);
  assert.equal(again.llm.status, 'skipped');
  assert.equal(again.delta.pending, 0);
});

test('旧版の抽出済み印は書籍版では再利用しない', async () => {
  const text = '無償PoCの実施に合意した。';
  const legacy = await extract({ doc: DOC(text) }, { apiKey: 'k', fetchImpl: mockFetch([]) });
  const calls = [];
  await extractBook({ doc: DOC(text), state: legacy.snapshot }, { apiKey: 'k', fetchImpl: mockFetch([], calls) });
  assert.equal(calls.length, 1);
});

test('旧版 extract() は従来どおり旧スキーマ・旧候補を返す', async () => {
  const calls = [];
  const text = '現金は1,200万円。';
  const out = await extract({ doc: DOC(text) }, { apiKey: 'k', fetchImpl: mockFetch([
    { paragraph: 'P1', category: 'cash_balance_yen', value: 12000000, event_date: null, quote: '現金は1,200万円', status: 'actual' }], calls) });
  assert.equal(out.candidates[0].category, 'cash_balance_yen');
  assert.notDeepEqual(calls[0].generationConfig.responseJsonSchema, BOOK_RESPONSE_JSON_SCHEMA);
});

const para = (text) => new Map([['P1', { text, hash: 'h1', label: 'P1', position: 1 }]]);
const run = (text, items) => { const rej = {}; return { out: validateBookCandidates(items, para(text), { id: 'd' }, rej), rej }; };

test('予定と実績: 目標を下回った は実績、予定の文は予定、予定の現金は落とす', () => {
  const t1 = '試作の歩留まりが目標を下回った。';
  assert.equal(run(t1, [item({ event_type: 20, quote: t1, status: 'planned' })]).out[0].status, 'actual');
  const t2 = '来月に試験を実施する予定である。';
  assert.equal(run(t2, [item({ event_type: 10, quote: t2 })]).out[0].status, 'planned');
  const t3 = '年度末の自由資金は1,000万円になる見込みである。';
  const r = run(t3, [item({ supplement: 'cash_balance', fund: 'free', value: 10000000, quote: t3 })]);
  assert.equal(r.out.length, 0); assert.equal(r.rej.cash_from_plan, 1);
});

test('無償PoCの合意は11。13にはしない。合意を9/10にもしない', () => {
  const t = '無償PoCの実施に合意した。';
  assert.equal(run(t, [item({ event_type: 11, quote: t })]).out.length, 1);
  assert.equal(run(t, [item({ event_type: 13, quote: t })]).rej.free_poc_is_type_11, 1);
  assert.equal(run(t, [item({ event_type: 9, quote: t })]).rej.agreement_not_result, 1);
});

const CASH = '2026年3月31日時点で、自由資金は0円、使途限定資金は2,700万円である。';
test('現金: 同じ段落の自由0円と限定2,700万円を取り違えない', () => {
  const ok = run(CASH, [
    item({ supplement: 'cash_balance', fund: 'free', value: 0, quote: CASH, event_date: '2026-03-31' }),
    item({ supplement: 'cash_balance', fund: 'restricted', value: 27000000, quote: CASH }),
  ]);
  assert.deepEqual(ok.out.map((o) => [o.fund, o.value]), [['free', 0], ['restricted', 27000000]]);
  assert.equal(ok.out[0].event_date, '2026-03-31');
  const bad = run(CASH, [
    item({ supplement: 'cash_balance', fund: 'free', value: 27000000, quote: CASH }),
    item({ supplement: 'cash_balance', fund: 'restricted', value: 0, quote: CASH }),
    item({ supplement: 'cash_balance', fund: 'unspecified', value: 27000000, quote: CASH }),
  ]);
  assert.equal(bad.out.length, 0);
  assert.equal(bad.rej.fund_mismatch, 3);
});

test('現金: 区分語が金額に結びつかないものは曖昧として落とす／区分なしの金額は unspecified で通す', () => {
  const amb = '自由資金と使途限定資金の合計は1,200万円である。';
  assert.equal(run(amb, [item({ supplement: 'cash_balance', fund: 'free', value: 12000000, quote: amb })]).out.length, 0);
  const plain = '2026年4月末の現金残高は1,200万円である。';
  assert.equal(run(plain, [item({ supplement: 'cash_balance', fund: 'unspecified', value: 12000000, quote: plain })]).out.length, 1);
  assert.deepEqual(bookYenAmounts('ゼロ円と0円と3千万円'), [0, 0, 30000000]);
});

test('日付は段落に無ければ null／引用が段落に無ければ落とす', () => {
  const t = '特許の共同出願に全員が同意した。';
  assert.equal(run(t, [item({ event_type: 7, quote: t, event_date: '2026-05-01' })]).out[0].event_date, null);
  assert.equal(run(t, [item({ event_type: 7, quote: '別の文' })]).rej.quote_not_in_paragraph, 1);
});
