// 書籍（BZM 1.0 教科書 第12章 12.3.1〜12.3.6）の「出来事の24の種類」を、資料に明示された記述だけから候補にする抽出の検証部。
// pilot.mjs の validateCandidates と同じ呼び出し形（raw, byLabel, docMeta, reasons）で差し替えて使う。この単独ファイルは何も書き込まない。
// 方針: 候補は人が9列へ記入して確認する材料。AIは種類・要旨・引用・日付だけを返し、値や確率は選ばない。
//   - 引用は段落に一字一句含まれるものだけ。日付は段落に明記された暦日だけ。
//   - 現金残高の金額だけが value を持てる。金額は引用中の表記から機械的に求め、一致しなければ落とす。
//   - 予定（予定・見込・目標など）は status=planned。実績にしない。
//   - 種類に当たらない現金残高・計画の変更・応募中は event_type=null と supplement で区別する（12.3.6 の補助記録）。
import { createHash } from 'node:crypto';

const sha256 = (x) => createHash('sha256').update(x).digest('hex');
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const MAX_QUOTE = 400;
const MAX_NAME = 60;
const MAX_REASON = 200;

// ───────────────────────────────────────────────────────── 定数（12.3.1〜12.3.5 の24種）

export const BOOK_EVENT_TYPES = Object.freeze([
  { no: 1, group: '資金と資金調達', name: '公的資金の採択' },
  { no: 2, group: '資金と資金調達', name: '公的資金の不採択' },
  { no: 3, group: '資金と資金調達', name: '採択計画の評価と変更' },
  { no: 4, group: '資金と資金調達', name: '資金調達の機会の一覧の更新' },
  { no: 5, group: '資金と資金調達', name: '民間調達の交渉と払込の記録' },
  { no: 6, group: '権利と承認', name: '権利と承認の審議の提出、継続審議、差し戻し' },
  { no: 7, group: '権利と承認', name: '権利と承認の解決' },
  { no: 8, group: '権利と承認', name: '権利と承認の未解決の件の新規の判明' },
  { no: 9, group: '検証と市場', name: 'ゲートの通過' },
  { no: 10, group: '検証と市場', name: '検証の試行の不成立' },
  { no: 11, group: '検証と市場', name: 'オフテイカーの関心の表明の文書' },
  { no: 12, group: '検証と市場', name: '需要と証拠の撤回と失効' },
  { no: 13, group: '検証と市場', name: '受託、共同研究、有償PoCの契約の締結、変更、満了' },
  { no: 14, group: '検証と市場', name: '会社化、大学発ベンチャーの称号の付与' },
  { no: 15, group: '人と組織', name: '人の着任、退任、実働、担当合意と現況確認の記録' },
  { no: 16, group: '人と組織', name: '人の異動、定年、卒業の判明' },
  { no: 17, group: '人と組織', name: '研究室と組織の体制の変化' },
  { no: 18, group: '環境、パラメータ、売上', name: '競合の出願、参入、撤退、実用化' },
  { no: 19, group: '環境、パラメータ、売上', name: '用途の拡張の証拠' },
  { no: 20, group: '環境、パラメータ、売上', name: '工程と原価の情報' },
  { no: 21, group: '環境、パラメータ、売上', name: '分野環境の観測' },
  { no: 22, group: '環境、パラメータ、売上', name: '天井と置き換え分の再推定' },
  { no: 23, group: '環境、パラメータ、売上', name: '経過報告' },
  { no: 24, group: '環境、パラメータ、売上', name: '稼働している用途の売上の実績と見込みの改定' },
]);
const TYPE_NOS = new Set(BOOK_EVENT_TYPES.map((t) => t.no));

// 専用番号の無い補助記録（12.3.6）。cash_balance は評価日の資金残高、plan_change は計画の規則や事業計画の変更、
// application_pending は公募などへの応募中（結果待ち）。
export const BOOK_SUPPLEMENTS = Object.freeze(['cash_balance', 'plan_change', 'application_pending']);
// 資金残高は2つ（自由に使える資金／使途の限定された資金。第2章）。区別が書かれていないものは unspecified。
export const BOOK_FUNDS = Object.freeze(['free', 'restricted', 'unspecified']);
export const BOOK_CATEGORIES = Object.freeze(['book_event', 'book_supplement']);

// Gemini の responseJsonSchema（型・anyOf・properties・required・enum だけ使う）。候補0件は空配列。
export const BOOK_RESPONSE_JSON_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      paragraph: { type: 'string' },
      event_type: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
      supplement: { anyOf: [{ type: 'string', enum: [...BOOK_SUPPLEMENTS] }, { type: 'null' }] },
      fund: { anyOf: [{ type: 'string', enum: [...BOOK_FUNDS] }, { type: 'null' }] },
      value: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
      event_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      name: { type: 'string' },
      reason: { type: 'string' },
      quote: { type: 'string' },
      status: { type: 'string', enum: ['actual', 'planned'] },
    },
    required: ['paragraph', 'event_type', 'supplement', 'fund', 'value', 'event_date', 'name', 'reason', 'quote', 'status'],
  },
};

// ───────────────────────────────────────────────────────── 予定・実績の判定

// 予定を実績にしない安全網。「計画」だけでは予定にしない（「計画を変更した」「採択計画」は実績の文になりうる）。
const PLANNED_RE = /予定|見込|予想|予測|目標|見通し|方針|つもり|検討中|計画中|計画して|を計画|する計画/;
// 目標は「実績と比べる基準」として過去形で使われることがある（例: 歩留まりが目標を下回った）。この形の「目標」は予定の印にしない。
const TARGET_RESULT_RE = /目標(?:値)?を(?:下回|上回|超え|満た|割り込|達成|クリア)(?:った|えた|たした|んだ|した|ました|ってい|ており)|目標(?:値)?に(?:達しなかった|届かなかった|達していない|届いていない)|目標未達|目標達成(?:した|済)/g;
const isPlannedText = (q) => PLANNED_RE.test(q.replace(TARGET_RESULT_RE, ''));
export const BOOK_EXTRACTOR_VERSION = 'bzm1-book-observation/1';
// 試験の「合意」は合意という事実であり、ゲートの通過（9）・試行の不成立（10）ではない。
const AGREEMENT_RE = /合意|同意|了承|承諾/;
const RESULT_RE = /成功|不成立|通過|達成|未達|失敗|再現|完了|終了|クリア/;

// 実績とされた引用の末尾に別の予定の文があるとき、予定を含まない先頭側の文だけに狭める。曖昧なら元のまま。
function narrowQuote(quote) {
  const sentences = quote.match(/[^。]+。?/g) || [];
  if (sentences.length < 2) return quote;
  let end = sentences.length;
  while (end > 1 && isPlannedText(sentences[end - 1])) end--;
  if (end === sentences.length) return quote;
  const head = sentences.slice(0, end).join('').trim();
  return head && !isPlannedText(head) ? head : quote;
}

// ───────────────────────────────────────────────────────── 金額と日付（引用・段落に書かれた表記だけを根拠にする）

// 「1,200万円」「1億2,000万円」「5千万円」「3000000円」を円へ。引用中の全金額を返す。換算・推定はしない。
// 位置つき版: [{value, start, end}]。「ゼロ円」「零円」は0円。
function amountSpans(text) {
  const t = String(text).normalize('NFKC').replace(/(?:ゼロ|零)円/g, '0円');
  const out = [];
  for (const m of t.matchAll(/([\d,.億万千]+)円/g)) {
    let sum = 0; let found = false;
    for (const p of m[1].matchAll(/(\d[\d,]*(?:\.\d+)?)(千万|[億万千])?/g)) {
      const n = Number(p[1].replace(/,/g, ''));
      if (!Number.isFinite(n)) { found = false; break; }
      const unit = { 億: 1e8, 万: 1e4, 千: 1e3, 千万: 1e7 }[p[2]] || 1;
      sum += n * unit; found = true;
    }
    if (found) out.push({ value: Math.round(sum), start: m.index, end: m.index + m[0].length, text: t });
  }
  return out;
}
export function bookYenAmounts(text) { return amountSpans(text).map((s) => s.value); }

// 資金区分の語（自由に使える／使途の限定された）。同じ位置では自由側の語を先に判定する（「使途の限定されない」は自由）。
const FUND_WORD_RE = /(?<free>自由に使える|自由資金|自由|使途(?:の)?(?:限定|制約)(?:が)?(?:されない|ない|なし)|使途不問)|(?<res>使途(?:の)?限定(?:された)?|使途が限定(?:された)?|限定資金|限定された|拘束|制約付)/g;
const FUND_NEAR = 24;

// 引用中の各金額に、最も近い資金区分の語を割り当てる。最短距離が同点・遠すぎる場合は null（区分不明）。
function fundOfAmounts(text) {
  const spans = amountSpans(text);
  if (!spans.length) return spans;
  const t = spans[0].text;
  const words = [...t.matchAll(FUND_WORD_RE)].map((m) => ({ fund: m.groups.free ? 'free' : 'restricted', start: m.index, end: m.index + m[0].length }));
  const labels = spans.map(() => []);
  for (const w of words) {
    let prev = -1; let next = -1;
    spans.forEach((s, i) => { if (s.end <= w.start) prev = i; if (next < 0 && s.start >= w.end) next = i; });
    // 後ろ向き: 「0円の自由資金」「2,700万円（使途限定資金）」の形。前向き: 「自由資金は0円」の形（語の直後が は・が・:・=）。
    const back = prev >= 0 && /^[の（(]$/.test(t.slice(spans[prev].end, w.start));
    const tail = t.slice(w.end).match(/^(?:の?(?:資金|残高|預金|現金))*([はがも:：=])/);
    const fwd = next >= 0 && !!tail && spans[next].start - w.end <= FUND_NEAR && !/[。、,，;；]/.test(t.slice(w.end, spans[next].start));
    if (back === fwd) continue;   // どちらにも付かない、または両方に付き得る → 区分不明
    labels[back ? prev : next].push(w.fund);
  }
  return spans.map((s, i) => ({ value: s.value, fund: new Set(labels[i]).size === 1 ? labels[i][0] : null }));
}

// event_date（YYYY-MM-DD）が段落に暦日として明記されているか。西暦と令和・平成の年月日、/ - . 区切りを認める。年月だけ・相対表現は認めない。
export function bookDateInText(iso, text) {
  if (!isDate(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const t = String(text).normalize('NFKC');
  const years = [String(y)];
  if (y >= 2019) years.push(`令和${y - 2018}`);
  if (y >= 1989 && y <= 2019) years.push(`平成${y - 1988}`);
  return years.some((yy) => new RegExp(`(?<!\\d)${yy}\\s*[年/\\-.]\\s*0?${m}\\s*[月/\\-.]\\s*0?${d}(?!\\d)`).test(t));
}

// ───────────────────────────────────────────────────────── 検証

// raw: モデルの出力配列、byLabel: 段落ラベル→{text, hash}、docMeta: {id,title,revision}、reasons: 落とした件数の集計（呼び出し側の rejected）。
export function validateBookCandidates(raw, byLabel, docMeta, reasons = {}) {
  const out = [];
  const bad = (r) => { reasons[r] = (reasons[r] || 0) + 1; };
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!c || typeof c !== 'object') { bad('not_object'); continue; }
    const para = byLabel.get(c.paragraph);
    if (!para) { bad('unknown_paragraph'); continue; }

    // 種類は1〜24の整数か null。null のときは補助記録の区分が必須、番号があるときは補助を持たない
    let type;
    if (c.event_type === null) type = null;
    else if (Number.isInteger(c.event_type) && TYPE_NOS.has(c.event_type)) type = c.event_type;
    else { bad('event_type'); continue; }
    const sup = c.supplement ?? null;
    if (type === null) { if (!BOOK_SUPPLEMENTS.includes(sup)) { bad('supplement'); continue; } }
    else if (sup !== null) { bad('supplement_with_type'); continue; }

    if (!['actual', 'planned'].includes(c.status)) { bad('status'); continue; }
    const quoteIn = typeof c.quote === 'string' ? c.quote.normalize('NFC').trim() : '';
    if (!quoteIn || quoteIn.length > MAX_QUOTE || !para.text.includes(quoteIn)) { bad('quote_not_in_paragraph'); continue; }
    const name = typeof c.name === 'string' ? c.name.normalize('NFC').trim().slice(0, MAX_NAME) : '';
    if (!name) { bad('name'); continue; }
    const reason = typeof c.reason === 'string' ? c.reason.normalize('NFC').trim().slice(0, MAX_REASON) : '';
    if (!reason) { bad('reason'); continue; }

    // 予定の判定。実績とされた引用に別の予定の文が続くときは先頭側の文に狭める
    const quote = c.status === 'actual' && isPlannedText(quoteIn) ? narrowQuote(quoteIn) : quoteIn;
    // 「目標を下回った」のような実績の文は、モデルが planned と返しても実績にする。それ以外は予定の語があれば予定
    const targetResult = new RegExp(TARGET_RESULT_RE.source).test(quote);
    const status = isPlannedText(quote) || (c.status === 'planned' && !targetResult) ? 'planned' : 'actual';

    if ((type === 9 || type === 10) && AGREEMENT_RE.test(quote) && !RESULT_RE.test(quote)) { bad('agreement_not_result'); continue; }
    // 13 は有償の契約。無償 PoC の合意は 11
    if (type === 13 && /無償/.test(quote) && !/有償/.test(quote)) { bad('free_poc_is_type_11'); continue; }

    // 値は現金残高の金額だけ。引用に書かれた金額と一致するものだけ通す。それ以外の value は捨てる
    let value = null; let fund = null;
    if (sup === 'cash_balance') {
      fund = c.fund == null ? 'unspecified' : c.fund;
      if (!BOOK_FUNDS.includes(fund)) { bad('fund'); continue; }
      if (typeof c.value !== 'number' || !Number.isFinite(c.value)) { bad('value'); continue; }
      value = Math.round(c.value);
      if (status === 'planned') { bad('cash_from_plan'); continue; }   // 予定・見込みの金額は残高の観測にしない
      const spans = fundOfAmounts(quote).filter((s) => s.value === value);
      if (!spans.length) { bad('value_not_in_quote'); continue; }
      // 同じ段落に別の資金の金額があっても、請求した区分に結びつく金額（0円を含む）だけを通す
      if (fund === 'unspecified') { if (spans.some((s) => s.fund)) { bad('fund_mismatch'); continue; } }
      else if (!spans.some((s) => s.fund === fund)) { bad(spans.some((s) => s.fund === null) ? 'fund_ambiguous' : 'fund_mismatch'); continue; }
    }

    const eventDate = bookDateInText(c.event_date, para.text) ? c.event_date : null;
    const id = sha256([docMeta.id, para.hash, type === null ? 'book_supplement' : 'book_event', String(type ?? sup),
      fund ?? '', quote, String(value)].join('\u0001')).slice(0, 16);
    if (out.some((o) => o.id === id)) continue;
    out.push({ id, category: type === null ? 'book_supplement' : 'book_event', event_type: type,
      ...(type === null ? { supplement: sup } : {}), ...(fund ? { fund } : {}),
      value, event_date: eventDate, name, reason, quote,
      ...(para.position ? { source: { paragraph: c.paragraph, position: para.position } } : {}),
      ...(quote !== quoteIn ? { quote_original: quoteIn } : {}), status, paragraph_hash: para.hash, doc: docMeta });
  }
  return out;
}
