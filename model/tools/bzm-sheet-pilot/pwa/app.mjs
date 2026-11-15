// 本の読者向け月次評価。数値はすべて /data.json から読み、画面側で作らない。
const $ = (s) => document.querySelector(s);
const nf = new Intl.NumberFormat('ja-JP');
const MAX_IMPORT = 512 * 1024;
const MAX_SNAPSHOTS = 2000;

const state = {
  data: null,
  tab: 'monthly',
  caseId: null,
  month: null,
  gate: 0,
  branch: 'up',
  imported: null,
  importError: '',
};

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? nf.format(v) : v == null ? '—' : String(v));
const pct = (v) => (typeof v === 'number' && Number.isFinite(v) ? `${nf.format(Math.round(v * 1000) / 10)}%` : '—');
const empty = (msg) => h('div', { class: 'empty' }, msg);
const man = (v) => (typeof v === 'number' && Number.isFinite(v) ? `${nf.format(v)}万円` : '—');
const oku = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(d)}億円` : '—');
const stageText = (s) => (s == null || s === '' ? '段階の記録なし' : /^\d+$/.test(String(s)) ? `段階${s}` : String(s));

function table(heads, rows, numCols = []) {
  return h('div', { class: 'tablewrap' }, h('table', {},
    h('thead', {}, h('tr', {}, heads.map((t, i) => h('th', { scope: 'col', class: numCols.includes(i) ? 'n' : '' }, t)))),
    h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c, i) => h(i === 0 ? 'th' : 'td', { class: numCols.includes(i) ? 'n' : '', scope: i === 0 ? 'row' : false }, c)))))));
}

/* ---- 月次シミュレーション ---- */
function currentCase() {
  const cases = state.data.monthly.cases;
  return cases.find((c) => c.id === state.caseId) || cases[0];
}

function renderMonthly() {
  const cases = state.data.monthly.cases;
  if (!cases.length) return empty('表示できる事例がありません。');
  const c = currentCase();
  const rows = c.rows || [];
  if (!rows.some((r) => r.month === state.month)) state.month = rows.length ? rows[0].month : null;
  const sel = rows.find((r) => r.month === state.month);

  const caseSel = h('select', { id: 'case-sel', onchange: (e) => { state.caseId = e.target.value; state.month = null; render(); $('#case-sel').focus(); } },
    cases.map((x) => h('option', { value: x.id, selected: x.id === c.id }, `${x.section ? x.section + ' ' : ''}${x.title}`)));

  const list = h('ul', { class: 'months', 'aria-label': '月の一覧' }, rows.map((r) => {
    const ev = (r.events || []).join('、');
    return h('li', {}, h('button', {
      type: 'button',
      'aria-current': r.month === state.month ? 'true' : false,
      onclick: () => { state.month = r.month; render(); const b = document.querySelector('ul.months [aria-current=true]'); if (b) b.focus(); },
    },
      h('span', { class: 'm-head' }, h('span', {}, `${r.month}か月目`), r.failureCount > 0 ? h('span', { class: 'fail' }, `不成立 ${r.failureCount}回`) : null),
      h('span', { class: 'm-ev' }, [stageText(r.stage), ev].filter(Boolean).join(' / '))));
  }));

  let detail;
  if (!sel) detail = empty('月を選ぶと、出来事と資金を表示します。');
  else {
    detail = h('div', { class: 'stack' },
      h('h2', {}, `${sel.month}か月目・${stageText(sel.stage)}`),
      h('p', { class: 'note' }, `次の節目: ${sel.next || '—'} / 状態: ${sel.status || '—'}`),
      h('p', { class: 'note' }, 'T3・M2・M3・M4 は本の節目の記号です。「次の節目」は、この月の時点で次に判定される節目を指します。'),
      h('div', {}, h('h3', {}, '出来事'), (sel.events || []).length ? h('ul', { class: 'chips' }, sel.events.map((e) => h('li', {}, e))) : h('p', { class: 'note' }, 'この月に記録された出来事はありません。')),
      h('div', { class: 'ledger', role: 'group', 'aria-label': '資金の2区分' },
        h('div', {}, h('p', { class: 'cap' }, '自由に使える資金'), h('p', { class: 'num' }, man(sel.free))),
        h('div', {}, h('p', { class: 'cap' }, '使途が限られた資金'), h('p', { class: 'num' }, man(sel.restricted)))),
      h('dl', { class: 'kv' }, h('dt', {}, '会社化'), h('dd', {}, sel.incorporated ? '会社化済み' : '会社化前'), h('dt', {}, '不成立回数'), h('dd', {}, `${num(sel.failureCount)}回`)),
      (sel.probabilities || []).length ? h('div', {}, h('h3', {}, '確率'), table(['項目', '値'], sel.probabilities.map((p) => [p.label, pct(p.value)]), [1])) : null,
      (sel.notes || []).length ? h('div', {}, h('h3', {}, '注記'), h('ul', {}, sel.notes.map((n) => h('li', {}, n)))) : null);
  }

  return h('div', {},
    h('div', { class: 'bar' }, h('label', {}, '事例', caseSel)),
    h('div', { class: 'split' }, h('div', { class: 'box' }, h('h2', {}, '月の一覧'), list), h('div', { class: 'box' }, detail)));
}

/* ---- 不成立後の評価 ---- */
function renderContinuation() {
  const { gates, waiting } = state.data.continuation;
  if (!gates.length) return empty('分岐の記録がありません。');
  if (state.gate >= gates.length) state.gate = 0;
  const g = gates[state.gate];
  const gateSel = h('select', { id: 'gate-sel', onchange: (e) => { state.gate = Number(e.target.value); render(); $('#gate-sel').focus(); } },
    gates.map((x, i) => h('option', { value: i, selected: i === state.gate }, `${x.month}か月目 ${x.label}`)));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': '強調する分岐' },
    [['up', '通過'], ['down', '不成立']].map(([k, t]) => h('button', {
      type: 'button', 'aria-pressed': String(state.branch === k),
      onclick: () => { state.branch = k; render(); document.querySelector(`.seg [aria-pressed=true]`)?.focus(); },
    }, t)));

  const card = (k, title, b) => h('section', { class: `branch ${k}`, 'data-active': String(state.branch === k), 'aria-label': title },
    h('h3', {}, title),
    h('dl', { class: 'kv' },
      h('dt', {}, 'ICV'), h('dd', { class: 'num' }, oku(b?.icv, 1)),
      h('dt', {}, 'rNPV'), h('dd', { class: 'num' }, oku(b?.rnpv, 2)),
      h('dt', {}, '資金'), h('dd', { class: 'num' }, man(typeof b?.cash === 'number' ? Math.round(b.cash * 10000 * 100) / 100 : b?.cash))));

  const wait = waiting && (waiting.rows || []).length
    ? h('div', { class: 'stack' }, h('h2', {}, waiting.title || '待機期間'),
      table(['月', '支出', '一時金', '一時金の入金前', '一時金の入金後'],
        waiting.rows.map((r) => [`${r.month}か月目`, man(r.expenseMan), man(r.upfrontMan), man(r.beforeUpfront), man(r.afterUpfront)]), [1, 2, 3, 4]),
      h('dl', { class: 'kv' }, h('dt', {}, '合計'), h('dd', {}, man(waiting.totalMan)), h('dt', {}, 'つなぎ資金'), h('dd', {}, man(waiting.bridgeMan)), h('dt', {}, '期末'), h('dd', {}, man(waiting.endMan))))
    : null;

  return h('div', { class: 'stack' },
    h('div', { class: 'bar' }, h('label', {}, '分岐点', gateSel), seg),
    h('p', { class: 'note' }, `通過確率 ${pct(g.p)}`),
    h('div', { class: 'compare' }, card('up', '通過', g.up), card('down', '不成立', g.down)),
    wait);
}

/* ---- 参照計算 ---- */
function renderReference() {
  const r = state.data.reference;
  if (!r.cases.length) return empty('参照計算の記録がありません。');
  return h('div', { class: 'stack' },
    h('h2', {}, '参照計算'),
    h('p', { class: 'note' }, `出典: ${r.source || '記録なし'}`),
    table(['種別', '登録', 'v', 'v10', 'v50', 'v90', 'pM4', 'm4平均', '由来'],
      r.cases.map((c) => [c.type, c.reg, num(c.v), num(c.v10), num(c.v50), num(c.v90), pct(c.pM4), num(c.m4mean), c.provenance || '—']), [2, 3, 4, 5, 6, 7]));
}

/* ---- 評価履歴 ---- */
function validateImport(obj) {
  const snaps = obj && obj.state && obj.state.snapshots;
  if (!Array.isArray(snaps)) throw new Error('state.snapshots の配列が見つかりません。');
  if (snaps.length > MAX_SNAPSHOTS) throw new Error(`件数が上限(${MAX_SNAPSHOTS})を超えています。`);
  return snaps.map((s, i) => {
    if (!s || !Number.isFinite(s.month) || !Number.isFinite(s.icv) || !Number.isFinite(s.rnpv)) throw new Error(`${i + 1}件目の month / icv / rnpv が数値ではありません。`);
    if (s.version != null && (typeof s.version !== 'string' && typeof s.version !== 'number')) throw new Error(`${i + 1}件目の version が不正です。`);
    return { month: s.month, version: s.version == null ? '' : String(s.version).slice(0, 40), icv: s.icv, rnpv: s.rnpv };
  });
}

async function onImport(e) {
  const f = e.target.files && e.target.files[0];
  state.importError = '';
  if (!f) return;
  if (f.size > MAX_IMPORT) state.importError = 'ファイルが大きすぎます(上限512KB)。';
  else {
    try {
      state.imported = validateImport(JSON.parse(await f.text()));
    } catch (err) {
      state.imported = null;
      state.importError = `読み込めません: ${err.message}`;
    }
  }
  render();
}

function renderHistory() {
  const hist = state.data.valuation.history;
  const imp = state.imported;
  return h('div', { class: 'stack' },
    h('h2', {}, '評価履歴'),
    hist.length
      ? table(['月', 'ICV', 'rNPV', '種別', '内容'], hist.map((x) => [`${x.month}か月目`, oku(x.icv, 1), oku(x.rnpv, 2), x.kind || '—', x.label || '—']), [1, 2])
      : empty('評価履歴の記録がありません。'),
    h('div', { class: 'box stack' },
      h('h3', {}, '手元の計画出力を開く(任意)'),
      h('p', { class: 'note' }, '前の試作で保存した評価ファイルを選ぶと、月と評価額を表示する。ファイルは送信しない。'),
      h('label', {}, 'JSONファイル', h('input', { type: 'file', accept: 'application/json,.json', onchange: onImport })),
      state.importError ? h('div', { class: 'error', role: 'alert' }, state.importError) : null,
      imp ? h('div', { class: 'stack' },
        table(['月', '版', 'ICV', 'rNPV'], imp.map((s) => [`${s.month}か月目`, s.version || '—', oku(s.icv, 1), oku(s.rnpv, 2)]), [2, 3]),
        h('button', { class: 'btn', type: 'button', onclick: () => { state.imported = null; render(); } }, '読み込んだ内容を消す')) : null));
}

/* ---- 共通 ---- */
const RENDERERS = { monthly: renderMonthly, continuation: renderContinuation, reference: renderReference, history: renderHistory };

function render() {
  for (const t of document.querySelectorAll('[role=tab]')) {
    const on = t.dataset.tab === state.tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  }
  const panel = $('#panel');
  panel.setAttribute('aria-labelledby', `tab-${state.tab}`);
  panel.replaceChildren(RENDERERS[state.tab]());
}

function setStatus(msg, isError) {
  const s = $('#status');
  s.replaceChildren();
  if (msg) s.append(h('div', { class: isError ? 'error' : 'note', role: isError ? 'alert' : false }, msg));
}

function wireTabs() {
  const tabs = [...document.querySelectorAll('[role=tab]')];
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { state.tab = t.dataset.tab; if (state.data) render(); });
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = tabs[(i + d + tabs.length) % tabs.length];
      state.tab = n.dataset.tab;
      if (state.data) render();
      n.focus();
    });
  });
}

function check(d) {
  const ok = d && d.book && d.monthly && Array.isArray(d.monthly.cases) && d.continuation && Array.isArray(d.continuation.gates)
    && d.reference && Array.isArray(d.reference.cases) && d.valuation && Array.isArray(d.valuation.history);
  if (!ok) throw new Error('データの形が想定と異なります。');
  return d;
}

/* ---- URL の直接リンク(読み取り専用・不正値は無視) ---- */
const VIEWS = ['monthly', 'continuation', 'reference', 'history'];
function readLink() {
  const p = new URLSearchParams(location.search);
  const out = {};
  const view = p.get('view');
  if (VIEWS.includes(view)) out.view = view;
  const cs = p.get('case');
  if (cs === '0' || cs === '1') out.case = Number(cs);
  const mo = p.get('month');
  if (mo !== null && /^\d{1,3}$/.test(mo)) out.month = Number(mo);
  const br = p.get('branch');
  if (br === 'down' || br === 'up') out.branch = br;
  return out;
}

function applyLink(link) {
  if (link.view) state.tab = link.view;
  if (link.branch) state.branch = link.branch;
  if (state.tab === 'continuation' && link.month !== undefined) {
    const i = state.data.continuation.gates.findIndex((g) => g.month === link.month);
    if (i >= 0) state.gate = i;
  }
  if (state.tab === 'monthly') {
    const cases = state.data.monthly.cases;
    const c = link.case !== undefined ? cases[link.case] : cases[0];
    if (c) {
      if (link.case !== undefined) state.caseId = c.id;
      if (link.month !== undefined && (c.rows || []).some((r) => r.month === link.month)) state.month = link.month;
    }
  }
}

async function load() {
  setStatus('データを読み込み中です。');
  try {
    const res = await fetch('/data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`データを取得できません(状態 ${res.status})。`);
    state.data = check(await res.json());
    const b = state.data.book;
    $('#book-meta').textContent = `本の版 ${b.version || '—'} / 記録 ${String(b.commit || '—').slice(0, 9)} / 読み取り専用`;
    setStatus('');
    applyLink(readLink());
    render();
  } catch (err) {
    $('#book-meta').textContent = '読み取り専用';
    setStatus(`${err.message} 画面を再読み込みしても直らない場合は、配信を起動し直してください。`, true);
    $('#panel').replaceChildren(empty('表示できるデータがありません。'));
  }
}

wireTabs();
load();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
