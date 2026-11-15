#!/usr/bin/env node
// BZM Google Sheets 試作 CLI（Node 標準ライブラリのみ）。
// コマンド: extract / plan / read / init / apply。入出力は stdin / stdout の JSON。
// 詳細は README.md。モデルの計算は ../bzm30_forward.cjs を、ロックのSHA照合のうえで呼ぶだけ。
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.resolve(HERE, '..');         // model/tools
const MODEL_DIR = path.resolve(HERE, '..', '..');   // model
const require = createRequire(import.meta.url);

export class PilotError extends Error {
  constructor(code, detail) { super(detail ? `${code}: ${detail}` : code); this.code = code; }
}

const sha256 = (x) => createHash('sha256').update(x).digest('hex');
const canon = (o) => JSON.stringify(sortKeys(o));
function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  return o;
}
const stateHash = (st) => (st == null ? 'null' : sha256(canon(st)));
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const isIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

// ───────────────────────────────────────────────────────── 定数

export const DISPLAY_NAME = '産業創出価値(BZM 3.0内部版)';
export const CATEGORIES = ['cash_balance_yen', 'monthly_burn_yen', 'annual_net_impact_yen',
  'trial_result', 'grant_awarded', 'grant_received', 'paid_contract'];
const YEN_CATS = new Set(['cash_balance_yen', 'monthly_burn_yen', 'annual_net_impact_yen',
  'grant_awarded', 'grant_received', 'paid_contract']);
const INPUT_CATS = ['cash_balance_yen', 'monthly_burn_yen', 'annual_net_impact_yen'];
const PLANNED_RE = /予定|見込|予想|予測|目標|見通し|計画/;   // 予定を実績にしない安全網
// 年額純増だけの例外: 「…見込みを…へ改めることを決定」のように、見積の採用そのものが過去の事実のとき。
const ADOPTED_TAIL_RE = /(決定|採用|承認|確定)(し(た|ました)|され(た|ました)|済み?)?。?$/;
function isPlanned(c, quote) {
  if (c.status === 'planned') return true;
  if (!PLANNED_RE.test(quote)) return false;
  return !(c.category === 'annual_net_impact_yen' && ADOPTED_TAIL_RE.test(quote.trim())
    && !PLANNED_RE.test(quote.replace(/見込み?/g, '')));
}
// モデルが actual とした採択・試験・有償契約の引用が、文を分けると末尾に別の予定の文を含むとき、
// 予定を含まない先頭側の文だけに狭める。曖昧（先頭側にも予定がある・全文が予定・分けられない）なら元のまま。
const NARROW_CATS = new Set(['grant_awarded', 'trial_result', 'paid_contract']);
function narrowQuote(c, paraText) {
  if (c.status !== 'actual' || !NARROW_CATS.has(c.category) || !PLANNED_RE.test(c.quote)) return c.quote;
  const sentences = c.quote.match(/[^。]+。?/g) || [];
  if (sentences.length < 2) return c.quote;
  let end = sentences.length;
  while (end > 1 && PLANNED_RE.test(sentences[end - 1])) end--;
  if (end === sentences.length) return c.quote;
  const head = sentences.slice(0, end).join('').trim();
  return head && !PLANNED_RE.test(head) && paraText.includes(head) ? head : c.quote;
}
const MAX_BYTES = 10000;
const MAX_QUOTE = 400;
const MAX_STATE_CHARS = 45000;   // Sheets の1セル上限 50000 字の手前

export const TAB_NAMES = { eval: '評価履歴', obs: '観測', fc: '予測・実績', log: '処理記録' };
export const HEADERS = {
  eval: ['評価日時', '表示名', 'モデル版', '承認番号(ロック)', '採用番号', '型', '規制', '次ゲート', '会社化済み',
    '現金(万円)', '毎月支出(万円)', '年額純増(億円・推定前提)', 'v10(円/年額純増1円)', 'v50(円/年額純増1円)', 'v90(円/年額純増1円)',
    'v10(億円)', 'v50(億円)', 'v90(億円)', '前回v50差(億円)', '採用候補ID', '引用', '元ファイル', '評価時入力', 'ロックSHA'],
  obs: ['観測日', 'カテゴリ', '値', '名称', '引用', '候補ID', '採用番号', '採用日時', '元ファイル'],
  fc: ['区分', '予測ID', '記録日時', '質問', '確率', '期限', '判定基準', '出来事', '結果', '参照候補ID', '観測日', '引用', '系統'],
  log: ['処理日時', '採用番号', '評価キー', '内容'],
};
const FC_LINE = '利用者が固定した予測';

// ───────────────────────────────────────────────────────── ロック照合とBZM呼び出し

export function verifyLock() {
  const lock = JSON.parse(readFileSync(path.join(MODEL_DIR, 'LOCK.json'), 'utf8'));
  const entry = (lock.files || []).find((f) => f.path === 'model/tools/bzm30_forward.cjs');
  if (!entry) throw new PilotError('lock_entry_missing');
  const forwardSha = sha256(readFileSync(path.join(TOOLS_DIR, 'bzm30_forward.cjs')));
  if (forwardSha !== entry.sha256) throw new PilotError('lock_mismatch', 'bzm30_forward.cjs');
  const mvPath = path.join(TOOLS_DIR, 'model_version.cjs');
  const mv = require(mvPath);
  if (mv.currentApprovalRef() !== lock.approval_ref) throw new PilotError('lock_mismatch', 'approval_ref');
  // model_version.cjs は LOCK.json に載っていないため、SHA は記録だけする
  return { modelVersion: mv.MODEL_VERSION, approvalRef: lock.approval_ref, forwardSha,
    modelVersionFileSha: sha256(readFileSync(mvPath)) };
}

function defaultBzmRun(type, reg, init) {
  const { runTheta, CFG } = require(path.join(TOOLS_DIR, 'bzm30_forward.cjs'));
  return runTheta(type, reg, CFG, init);
}

// ───────────────────────────────────────────────────────── extract

function splitParagraphs(text) {
  return text.replace(/\r\n/g, '\n').split(/\n[ \t　]*\n/).map((s) => s.trim().normalize('NFC')).filter(Boolean);
}

function renderPrompt(templatePath, packed) {
  const tpl = readFileSync(templatePath, 'utf8');
  const paras = packed.map((p) => `[${p.label}]\n${p.text}`).join('\n\n');
  return tpl.replace('{{categories}}', () => CATEGORIES.join(', ')).replace('{{paragraphs}}', () => paras);
}

// Gemini の responseJsonSchema（型・anyOf・properties・required・enum だけ使う）。値は正規化せず型で要求する。
const COMMON_PROPS = {
  paragraph: { type: 'string' },
  event_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  name: { type: 'string' },
  quote: { type: 'string' },
  status: { type: 'string', enum: ['actual', 'planned'] },
};
const COMMON_REQUIRED = ['paragraph', 'category', 'event_date', 'quote', 'status'];
export const RESPONSE_JSON_SCHEMA = {
  type: 'array',
  items: {
    anyOf: [
      { type: 'object',
        properties: { ...COMMON_PROPS, category: { type: 'string', enum: ['trial_result'] },
          value: { type: 'string', enum: ['achieved', 'not_achieved'] } },
        required: [...COMMON_REQUIRED, 'value', 'name'] },
      { type: 'object',
        properties: { ...COMMON_PROPS, category: { type: 'string', enum: CATEGORIES.filter((c) => c !== 'trial_result') },
          value: { type: 'integer' } },
        required: [...COMMON_REQUIRED, 'value'] },
    ],
  },
};

async function callGemini({ apiKey, model, prompt, fetchImpl, timeoutMs }) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, responseMimeType: 'application/json',
            responseJsonSchema: RESPONSE_JSON_SCHEMA,
            thinkingConfig: { thinkingLevel: 'minimal' } },
        }),
      });
    if (!res.ok) return { status: 'http_error', httpStatus: res.status };
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    return { status: 'ok', text, usageMetadata: data?.usageMetadata || null };
  } catch (e) {
    return { status: e?.name === 'AbortError' ? 'timeout' : 'network_error' };   // 本文・キーは出さない
  } finally { clearTimeout(timer); }
}

function validateCandidates(raw, byLabel, docMeta, reasons) {
  const out = [];
  const bad = (r) => { reasons[r] = (reasons[r] || 0) + 1; };
  for (const c of raw) {
    const para = byLabel.get(c?.paragraph);
    if (!para) { bad('unknown_paragraph'); continue; }
    if (!CATEGORIES.includes(c.category)) { bad('category'); continue; }   // 「その他該当なし」もここで落ちる
    if (typeof c.quote !== 'string' || !c.quote || c.quote.length > MAX_QUOTE || !para.text.includes(c.quote)) { bad('quote_not_in_paragraph'); continue; }
    let value = c.value;
    if (YEN_CATS.has(c.category)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) { bad('value'); continue; }
      value = Math.round(value);
    } else if (!['achieved', 'not_achieved'].includes(value)) { bad('value'); continue; }
    if (c.category === 'trial_result' && !(typeof c.name === 'string' && c.name.trim())) { bad('name'); continue; }
    const eventDate = isDate(c.event_date) ? c.event_date : null;
    const quote = narrowQuote(c, para.text);
    const status = isPlanned(c, quote) ? 'planned' : 'actual';
    const id = sha256([docMeta.id, para.hash, c.category, quote, String(value)].join('\u0001')).slice(0, 16);
    if (out.some((o) => o.id === id)) continue;
    out.push({ id, category: c.category, value, event_date: eventDate, name: c.name ? String(c.name) : '',
      quote, ...(quote !== c.quote ? { quote_original: c.quote } : {}), status, paragraph_hash: para.hash, doc: docMeta });
  }
  return out;
}

export async function extract(input, opts = {}) {
  const { doc, state = null } = input || {};
  if (!doc || ![doc.id, doc.title, doc.revision, doc.text].every((v) => typeof v === 'string')) throw new PilotError('bad_doc');
  if (state && state.docId !== doc.id) throw new PilotError('state_doc_mismatch');
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const apiKey = opts.apiKey !== undefined ? opts.apiKey : process.env.GEMINI_API_KEY;
  const model = input.model || 'gemini-3.1-flash-lite';
  const promptPath = opts.promptPath || path.join(HERE, 'prompt.md');

  const paras = splitParagraphs(doc.text).map((text) => ({ text, hash: sha256(text) }));
  const counts = {}; const uniq = [];
  for (const p of paras) { if (!counts[p.hash]) uniq.push(p); counts[p.hash] = (counts[p.hash] || 0) + 1; }
  const prevCounts = state?.paragraphs || {};
  const extractedSet = { ...(state?.extracted || {}) };

  const added = uniq.filter((p) => counts[p.hash] > (prevCounts[p.hash] || 0)).map((p) => ({ hash: p.hash, count: counts[p.hash] }));
  const removed = Object.keys(prevCounts).filter((h) => (counts[h] || 0) < prevCounts[h])
    .map((h) => ({ hash: h, removedCount: prevCounts[h] - (counts[h] || 0) }));

  // 同じ段落版は再抽出しない: 過去に抽出済みのハッシュを除く
  const pending = uniq.filter((p) => !extractedSet[p.hash]);
  const packed = []; let bytes = 0;
  for (const p of pending) {
    const b = Buffer.byteLength(p.text, 'utf8');
    if (bytes + b > MAX_BYTES) continue;   // 超過分は次回へ繰り越す（抽出済みにしない）
    bytes += b; packed.push({ ...p, label: `P${packed.length + 1}` });
  }
  const deferred = pending.length - packed.length;

  const docMeta = { id: doc.id, title: doc.title, revision: doc.revision };
  const result = { doc: docMeta, delta: { added, removed, pending: pending.length, sent: packed.length, deferred },
    candidates: [], rejected: {}, usage: null, llm: { status: 'skipped' }, snapshot: null };

  if (packed.length && apiKey) {
    const prompt = renderPrompt(promptPath, packed);
    const r = await callGemini({ apiKey, model, prompt, fetchImpl, timeoutMs: opts.timeoutMs || 30000 });
    result.llm = { status: r.status, ...(r.httpStatus ? { httpStatus: r.httpStatus } : {}) };
    const u = r.usageMetadata;
    if (u) {
      const inTok = u.promptTokenCount || 0, outTok = u.candidatesTokenCount || 0, thTok = u.thoughtsTokenCount || 0;
      const rates = input.rates;
      result.usage = { model, inputTokens: inTok, outputTokens: outTok, thoughtTokens: thTok, totalTokens: u.totalTokenCount || inTok + outTok + thTok,
        costUsd: rates && Number.isFinite(rates.input) && Number.isFinite(rates.output)
          ? (inTok * rates.input + (outTok + thTok) * rates.output) / 1e6 : null };
    }
    if (r.status === 'ok') {
      let parsed;
      try { parsed = JSON.parse(r.text); } catch { result.llm.status = 'parse_failed'; }
      if (parsed !== undefined) {
        const list = Array.isArray(parsed) ? parsed : parsed?.candidates;
        if (!Array.isArray(list)) result.llm.status = 'parse_failed';
        else {
          result.candidates = validateCandidates(list, new Map(packed.map((p) => [p.label, p])), docMeta, result.rejected);
          for (const p of packed) extractedSet[p.hash] = 1;   // 成功した版だけ抽出済みにする
        }
      }
    }
  } else if (packed.length) result.llm = { status: 'no_api_key' };

  result.snapshot = { docId: doc.id, revision: doc.revision, paragraphs: counts, extracted: extractedSet };
  return result;
}

// ───────────────────────────────────────────────────────── plan

const emptyState = () => ({ v: 1, seq: 0, doc: null, inputs: {}, adopted: {}, forecasts: {}, actuals: {}, evalKeys: [], lastEval: null });
const cell = (v) => (typeof v === 'number' ? { userEnteredValue: { numberValue: v } } : { userEnteredValue: { stringValue: String(v ?? '') } });
const appendReq = (sheetId, rows) => ({ appendCells: { sheetId, rows: rows.map((r) => ({ values: r.map(cell) })), fields: 'userEnteredValue' } });
const round = (x) => (typeof x === 'number' && Number.isFinite(x) ? Number(x.toPrecision(8)) : '');
const srcLabel = (d) => `${d.title} (${d.id}@${d.revision})`;
const dayOf = (iso) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);   // JSTの暦日

function validateForecast(f) {
  const ok = f && [f.question, f.criterion, f.event].every((s) => typeof s === 'string' && s.trim())
    && typeof f.probability === 'number' && f.probability >= 0 && f.probability <= 1 && isDate(f.deadline);
  if (!ok) throw new PilotError('bad_forecast');
}

export async function plan(input, opts = {}) {
  const lock = verifyLock();
  const { extract: ex = null, state: prev = null, approved = [], base, asOf, forecast, actual, tabs, spreadsheetId } = input || {};
  if (!isIso(asOf)) throw new PilotError('bad_asOf');
  if (typeof spreadsheetId !== 'string' || !spreadsheetId) throw new PilotError('bad_spreadsheetId');
  for (const n of Object.values(TAB_NAMES)) if (!Number.isInteger(tabs?.[n])) throw new PilotError('bad_tabs', n);
  if (!base || !['F1', 'F2', 'F3', 'F4'].includes(base.type) || !['REG0', 'REG1', 'REG2'].includes(base.reg) || typeof base.gate !== 'string') throw new PilotError('bad_base');
  if (!Array.isArray(approved) || approved.some((a) => typeof a !== 'string')) throw new PilotError('bad_approved');

  const st = prev ? JSON.parse(JSON.stringify(prev)) : emptyState();
  const prevHash = stateHash(prev);
  const exCands = new Map((ex?.candidates || []).map((c) => [c.id, c]));
  const rejected = [];
  const newly = [];
  for (const id of [...new Set(approved)]) {
    if (st.adopted[id]) continue;                                   // 採用済みは追記しない
    const c = exCands.get(id);
    if (!c) throw new PilotError('unknown_candidate', id);
    if (c.status !== 'actual') { rejected.push({ id, reason: 'planned_not_actual' }); continue; }
    if (c.event_date && c.event_date > dayOf(asOf)) { rejected.push({ id, reason: 'future_event_date' }); continue; }
    if (INPUT_CATS.includes(c.category) && !c.event_date) { rejected.push({ id, reason: 'no_event_date' }); continue; }
    newly.push(c);
  }
  const adoptionNo = st.seq + 1;
  const requests = []; let evalRows = [], obsRows = [], fcRows = [];

  // 採用 → 観測行と入力の更新
  for (const c of newly) {
    st.adopted[c.id] = { id: c.id, category: c.category, value: c.value, event_date: c.event_date, name: c.name,
      quote: c.quote, doc: c.doc, adoptionNo, adoptedAt: asOf };
    obsRows.push([c.event_date || '', c.category, typeof c.value === 'number' ? c.value : String(c.value), c.name, c.quote,
      c.id, adoptionNo, asOf, srcLabel(c.doc)]);
    if (INPUT_CATS.includes(c.category)) {
      const cur = st.inputs[c.category];
      if (!cur || c.event_date >= cur.event_date) st.inputs[c.category] = { value: c.value, event_date: c.event_date, candidateId: c.id };
    }
  }
  if (ex?.snapshot) st.doc = ex.snapshot;

  // 新規の予測は期限が記録日(JST暦日)より後でなければ拒否する。固定済みの同一予測の再実行は対象外。評価計算より前に検証する
  if (forecast) {
    validateForecast(forecast);
    const fid = `fc-${sha256([forecast.question, forecast.deadline, forecast.event].join('\u0001')).slice(0, 10)}`;
    if (!st.forecasts[fid] && !(forecast.deadline > dayOf(asOf))) throw new PilotError('forecast_deadline_not_future', fid);
  }

  // 評価（採用済み入力が揃い、かつ同じ版が未記録のときだけ）
  const inp = st.inputs;
  let evaluation = null;
  if (inp.cash_balance_yen || inp.monthly_burn_yen) {
    const evalKey = sha256(canon({ inp: Object.fromEntries(Object.entries(inp).map(([k, v]) => [k, v.value])), base,
      mv: lock.modelVersion, ref: lock.approvalRef, fwd: lock.forwardSha })).slice(0, 16);
    if (st.lastEval?.evalKey !== evalKey) {   // 直前の評価との比較だけ（A→B→A は再計算する）
      const init = { gate: base.gate, incorporated: Boolean(base.incorporated) };
      const cash = inp.cash_balance_yen?.value, burn = inp.monthly_burn_yen?.value, annual = inp.annual_net_impact_yen?.value;
      if (cash >= 0) init.cashMan = cash / 1e4;                    // 円 → 万円
      if (burn > 0) init.burnMan = burn / 1e4;
      if (annual > 0) init.pNetOku = annual / 1e8;                 // 円 → 億円
      const run = await (opts.bzmRun || defaultBzmRun)(base.type, base.reg, init);
      const oku = (v) => (annual > 0 ? round((v * annual) / 1e8) : '');
      const prevV50 = st.lastEval?.v50Oku;
      const v50Oku = oku(run.v50);
      const refs = Object.entries(inp).map(([k, v]) => ({ k, v })).filter((x) => st.adopted[x.v.candidateId]);
      const ids = refs.map((x) => x.v.candidateId);
      const docs = [...new Set(ids.map((id) => srcLabel(st.adopted[id].doc)))];
      evalRows.push([asOf, DISPLAY_NAME, lock.modelVersion, lock.approvalRef, adoptionNo, base.type, base.reg, base.gate,
        init.incorporated ? 'はい' : 'いいえ', cash >= 0 ? round(cash / 1e4) : '', burn > 0 ? round(burn / 1e4) : '',
        annual > 0 ? round(annual / 1e8) : '', round(run.v10), round(run.v50), round(run.v90), oku(run.v10), v50Oku, oku(run.v90),
        typeof prevV50 === 'number' && typeof v50Oku === 'number' ? round(v50Oku - prevV50) : '',
        ids.join('\n'), refs.map((x) => `[${x.k}] ${st.adopted[x.v.candidateId].quote}`).join('\n'), docs.join('\n'),
        canon({ inputs: Object.fromEntries(Object.entries(inp).map(([k, v]) => [k, v.value])), base, init }),
        lock.forwardSha]);
      st.lastEval = { v50Oku: typeof v50Oku === 'number' ? v50Oku : null, evalKey, asOf };
      evaluation = { evalKey, v10: run.v10, v50: run.v50, v90: run.v90, v50Oku };
    }
  }

  // 予測の保存（保存後は上書き不可）
  let forecastSaved = null;
  if (forecast) {
    validateForecast(forecast);
    const id = `fc-${sha256([forecast.question, forecast.deadline, forecast.event].join('\u0001')).slice(0, 10)}`;
    const old = st.forecasts[id];
    if (old) {
      if (old.probability !== forecast.probability || old.criterion !== forecast.criterion) throw new PilotError('forecast_immutable', id);
    } else {
      st.forecasts[id] = { question: forecast.question, probability: forecast.probability, deadline: forecast.deadline,
        criterion: forecast.criterion, event: forecast.event, savedAt: asOf };
      fcRows.push(['予測', id, asOf, forecast.question, forecast.probability, forecast.deadline, forecast.criterion,
        forecast.event, '', '', '', '', FC_LINE]);
      forecastSaved = id;
    }
  }

  // 実績の記録（別行・二重記録不可）
  let actualRecorded = null;
  if (actual) {
    const fc = prev?.forecasts?.[actual.forecastId];   // 以前の実行で保存済みの予測だけが対象
    if (!fc) throw new PilotError('forecast_not_saved', actual.forecastId);
    if (st.actuals[actual.forecastId]) throw new PilotError('actual_duplicate', actual.forecastId);
    const cand = st.adopted[actual.candidateId];
    if (!cand) throw new PilotError('candidate_not_adopted', actual.candidateId);
    if (cand.category !== 'trial_result') throw new PilotError('candidate_not_trial_result');
    if (!cand.event_date) throw new PilotError('no_event_date');
    const nm = (s) => String(s ?? '').normalize('NFC').trim();
    if (nm(cand.name) !== nm(fc.event)) throw new PilotError('trial_name_mismatch');
    if (!(cand.event_date > dayOf(fc.savedAt))) throw new PilotError('observation_not_after_forecast');
    if (!(cand.event_date <= dayOf(asOf))) throw new PilotError('observation_after_asOf');
    const derived = cand.value === 'achieved' ? 'yes' : 'no';
    if (!['yes', 'no'].includes(actual.outcome) || actual.outcome !== derived) throw new PilotError('outcome_mismatch');
    if (derived === 'yes' && cand.event_date > fc.deadline) throw new PilotError('achieved_after_deadline');
    if (derived === 'no' && dayOf(asOf) < fc.deadline) throw new PilotError('no_before_deadline');   // 期限前の失敗では確定しない
    st.actuals[actual.forecastId] = { outcome: derived, candidateId: cand.id, recordedAt: asOf };
    fcRows.push(['実績', actual.forecastId, asOf, '', '', '', '', '', derived, cand.id, cand.event_date, cand.quote, FC_LINE]);
    actualRecorded = actual.forecastId;
  }

  // 書き込みを組む（追記のみ。状態セルだけ更新）
  if (evalRows.length) requests.push(appendReq(tabs[TAB_NAMES.eval], evalRows));
  if (obsRows.length) requests.push(appendReq(tabs[TAB_NAMES.obs], obsRows));
  if (fcRows.length) requests.push(appendReq(tabs[TAB_NAMES.fc], fcRows));
  let newState = prev;
  const dataWrite = requests.length > 0;
  // 評価に関係ない新規段落をAIが正常に処理したときも、カーソルだけ保存する（評価履歴は追記しない）
  const cur = (d) => (d ? canon({ docId: d.docId, paragraphs: d.paragraphs, extracted: d.extracted }) : null);   // 版番号だけの違いでは書かない
  if (ex?.snapshot && prev?.doc && ex.snapshot.docId !== prev.doc.docId) throw new PilotError('state_doc_mismatch');
  const cursorChanged = Boolean(ex?.snapshot) && cur(ex.snapshot) !== cur(prev?.doc);
  if (dataWrite || cursorChanged) {
    if (dataWrite) st.seq = adoptionNo;
    newState = st;
    const json = canon(st);
    if (json.length > MAX_STATE_CHARS) throw new PilotError('state_too_large');
    const note = dataWrite ? `採用${newly.length}件 / 評価${evalRows.length}行 / 予測・実績${fcRows.length}行`
      : '評価に関係しない新規段落の処理のみ（評価0行）';
    requests.push(appendReq(tabs[TAB_NAMES.log], [[asOf, dataWrite ? adoptionNo : '', st.lastEval?.evalKey || '', note]]));
    requests.push({ updateCells: { start: { sheetId: tabs[TAB_NAMES.log], rowIndex: 1, columnIndex: 1 },
      rows: [{ values: [cell(json)] }], fields: 'userEnteredValue' } });
  }
  return { kind: 'plan', spreadsheetId, prevStateHash: prevHash, state: newState, requests,
    summary: { status: dataWrite ? 'write' : cursorChanged ? 'cursor_only' : 'no_change', adoptionNo: dataWrite ? adoptionNo : null,
      adopted: newly.map((c) => c.id), rejected, evaluation, forecastSaved, actualRecorded,
      lock: { modelVersion: lock.modelVersion, approvalRef: lock.approvalRef, forwardSha: lock.forwardSha, modelVersionFileSha: lock.modelVersionFileSha } } };
}

// ───────────────────────────────────────────────────────── Google 連携（read / init / apply）

const DOCS = 'https://docs.googleapis.com/v1/documents';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const A1 = (sheet, range) => encodeURIComponent(`'${sheet}'!${range}`);

async function gfetch(url, token, fetchImpl, init = {}) {
  if (!token) throw new PilotError('no_google_token');
  const res = await fetchImpl(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  if (!res.ok) throw new PilotError(`google_http_${res.status}`);   // 応答本文は出さない
  return res.json();
}

function collectParagraphs(content, out) {
  for (const el of content || []) {
    if (el.paragraph) {
      const t = (el.paragraph.elements || []).map((e) => e.textRun?.content || '').join('').replace(/\n$/, '').replace(/\n/g, ' ');
      if (t.trim()) out.push(t);
    } else if (el.table) {
      for (const row of el.table.tableRows || []) for (const c of row.tableCells || []) collectParagraphs(c.content, out);
    }
  }
}

export async function readSheetInfo(spreadsheetId, { token, fetchImpl }) {
  const meta = await gfetch(`${SHEETS}/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`, token, fetchImpl);
  const sheets = meta.sheets.map((s) => ({ sheetId: s.properties.sheetId, title: s.properties.title }));
  const tabs = Object.fromEntries(sheets.map((s) => [s.title, s.sheetId]));
  let state = null;
  if (tabs[TAB_NAMES.log] !== undefined) {
    const v = await gfetch(`${SHEETS}/${spreadsheetId}/values/${A1(TAB_NAMES.log, 'B2')}`, token, fetchImpl);
    const raw = v.values?.[0]?.[0];
    if (raw) { try { state = JSON.parse(raw); } catch { throw new PilotError('state_unreadable'); } }
  }
  let empty = false;
  if (sheets.length === 1) {
    const v = await gfetch(`${SHEETS}/${spreadsheetId}/values/${A1(sheets[0].title, 'A1:Z50')}`, token, fetchImpl);
    empty = !(v.values || []).some((row) => row.some((x) => String(x).trim()));
  }
  return { spreadsheetId, title: meta.properties.title, sheets, tabs, empty, state };
}

export async function read({ docId, spreadsheetId }, { token, fetchImpl = globalThis.fetch }) {
  const out = {};
  if (docId) {
    const d = await gfetch(`${DOCS}/${docId}?fields=title,revisionId,body.content`, token, fetchImpl);
    const paras = []; collectParagraphs(d.body?.content, paras);
    out.doc = { id: docId, title: d.title, revision: d.revisionId, text: paras.join('\n\n') };
  }
  if (spreadsheetId) out.sheet = await readSheetInfo(spreadsheetId, { token, fetchImpl });
  return out;
}

export function init(input) {
  const sh = input?.sheet;
  if (!sh || !Array.isArray(sh.sheets)) throw new PilotError('bad_sheet_info');
  if (!sh.empty || sh.sheets.length !== 1) throw new PilotError('not_empty_initial_file');   // 非空・複数タブは初期化しない
  const first = sh.sheets[0];
  const names = Object.values(TAB_NAMES);
  const used = new Set([first.sheetId]);
  let next = 1001; const ids = {};
  for (const n of names) {
    if (n === TAB_NAMES.eval) { ids[n] = first.sheetId; continue; }
    while (used.has(next)) next++;
    ids[n] = next; used.add(next);
  }
  const requests = [];
  if (first.title !== TAB_NAMES.eval) requests.push({ updateSheetProperties: { properties: { sheetId: first.sheetId, title: TAB_NAMES.eval }, fields: 'title' } });
  for (const n of names) if (n !== TAB_NAMES.eval) requests.push({ addSheet: { properties: { sheetId: ids[n], title: n } } });
  const hdr = (n, row) => ({ updateCells: { start: { sheetId: ids[n], rowIndex: 0, columnIndex: 0 },
    rows: [{ values: row.map(cell) }], fields: 'userEnteredValue' } });
  requests.push(hdr(TAB_NAMES.eval, HEADERS.eval), hdr(TAB_NAMES.obs, HEADERS.obs), hdr(TAB_NAMES.fc, HEADERS.fc), hdr(TAB_NAMES.log, HEADERS.log));
  requests.push({ updateCells: { start: { sheetId: ids[TAB_NAMES.log], rowIndex: 1, columnIndex: 0 },
    rows: [{ values: [cell('状態(JSON)')] }], fields: 'userEnteredValue' } });
  return { kind: 'init', spreadsheetId: sh.spreadsheetId, prevStateHash: 'null', tabs: ids, requests };
}

export async function apply(p, { spreadsheetId, doApply, token, fetchImpl = globalThis.fetch }) {
  if (!p || !Array.isArray(p.requests)) throw new PilotError('bad_plan');
  if (!doApply) return { dryRun: true, requestCount: p.requests.length, spreadsheetId: p.spreadsheetId };
  if (!spreadsheetId || spreadsheetId !== p.spreadsheetId) throw new PilotError('spreadsheet_mismatch');
  if (!p.requests.length) return { applied: false, reason: 'no_requests' };
  const cur = await readSheetInfo(spreadsheetId, { token, fetchImpl });
  if (p.kind === 'init' && !cur.empty) throw new PilotError('not_empty_initial_file');
  if (stateHash(cur.state) !== p.prevStateHash) throw new PilotError('state_changed');   // 単一書き手: 他の更新があれば止める
  const res = await gfetch(`${SHEETS}/${spreadsheetId}:batchUpdate`, token, fetchImpl, {
    method: 'POST', body: JSON.stringify({ requests: p.requests, includeSpreadsheetInResponse: false }) });
  return { applied: true, replies: (res.replies || []).length };
}

// ───────────────────────────────────────────────────────── CLI

function argOf(args, name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }
const readStdin = () => JSON.parse(readFileSync(0, 'utf8'));

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  let out;
  if (cmd === 'extract') out = await extract(readStdin(), { promptPath: argOf(args, '--prompt') });
  else if (cmd === 'plan') out = await plan(readStdin());
  else if (cmd === 'read') out = await read({ docId: argOf(args, '--doc'), spreadsheetId: argOf(args, '--sheet') }, { token });
  else if (cmd === 'init') out = init(readStdin());
  else if (cmd === 'apply') out = await apply(readStdin(), { spreadsheetId: argOf(args, '--spreadsheet'), doApply: args.includes('--apply'), token });
  else throw new PilotError('usage', 'extract | plan | read | init | apply');
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write(`${JSON.stringify({ error: e instanceof PilotError ? e.code : 'internal_error' })}\n`);
    process.exit(1);
  });
}
