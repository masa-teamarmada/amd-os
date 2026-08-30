#!/usr/bin/env node
'use strict';
/*
 * P1論文 §7 — 二重採点（records-only vs with-elicitation）
 *
 * 目的: 同じ凍結版モデル（model/tools/bzm30_forward.cjs の現在の main の版）で、21件のシーズを
 *   2回採点し、比を出す。「案件の順位は、運用記録が持っていない情報に支配される」という
 *   論文の主張の分布を作る。
 *
 *   (A) records-only        … seed_bzm30_inputs の *_reason 欄を読み、まさへの聞き取り由来
 *                              （聞き取り・ヒアリング・取締役会の口頭内容など、OSのデータベースに
 *                              独立に存在しない情報）に分類した値だけを、モデルページ §6.I-9-3
 *                              「Tier 0 の代表案件の前提」の既定値へ戻して採点する
 *   (B) with-elicitation    … 現在の入力（すでに DB にある値。まさへの聞き取りで得た事実を含む）
 *                              をそのまま使って採点する。§7 の定義どおり「現在の入力」
 *
 * 実装は model/tools/bzm30_score_seeds.cjs のコピー＋改造。model/ 配下のファイルは一切変更せず、
 * 前向き計算の実体（bzm30_forward.cjs）とゲート変換（bzm30_export.cjs の gateForStage）は
 * model/tools/ から require するだけ（読むだけ）。
 *
 * DB へは一切書き込まない。seed_bzm30_inputs は読むだけ、seed_bzm30_scores は
 * このツールから触れる経路が存在しない（insert 呼び出し自体を実装していない）。
 *
 * 使い方:
 *   node bzm/tools/dual_scoring.cjs --list                              … 対象 seed_id を1行ずつ
 *   node bzm/tools/dual_scoring.cjs <seed_id> --mode records             … records-only で1件
 *   node bzm/tools/dual_scoring.cjs <seed_id> --mode elicitation         … with-elicitation で1件
 *
 * 出力: 最終行に `RESULT_JSON: {...}` を1行だけ出す（並列実行時に集計しやすくするため）。
 */

const path = require('node:path');
const fs = require('node:fs');

const MODEL_DIR = path.join(__dirname, '..', '..', 'model', 'tools');
const { CFG, runTheta } = require(path.join(MODEL_DIR, 'bzm30_forward.cjs'));
const { gateForStage } = require(path.join(MODEL_DIR, 'bzm30_export.cjs'));

const { createClient } = require(path.join(__dirname, '..', '..', 'pwa', 'node_modules', '@supabase/supabase-js'));

// dotenv は pwa 側に入っていないので、KEY=VALUE を自前で読む（値のクォートだけ外す）。
for (const line of fs.readFileSync(path.join(__dirname, '..', '..', 'pwa', '.env.local'), 'utf8').split('\n')) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が要る');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─────────────────────────────────────────────────────────────────────────
// 分類表（本タスクの手作業レビューの結果）。
//
// seed_bzm30_inputs の各 *_reason 欄（self_revenue は self_revenue_note）を全件読み、
// 値の根拠を (a) OS のデータベースから引けるもの（採択記録・契約・特許・XRL・project_knowledge・
// 経営シグナル・資金繰り表・取締役会の「資料」「議事録」・市場調査レポートなど）と、
// (b) まさへの聞き取り由来のもの（聞き取り・ヒアリング・まさの口頭の観察や把握・
// project_org_observations に載る組織状況の口頭報告など、他のどの記録にも独立に存在しない情報）
// に分けた。判定の原則:
//   - 「（まさ 2026-08-28『全パラメータについて、空欄は一切認めない…』）」という定型句は、
//     空欄を許さないという運用ルールの引用であって、値そのものの出どころではないので、
//     これだけを理由に (b) とはしない。
//   - 「取締役会」であっても、引用元が議事録・資料（ページ番号つきの資金繰り表など）という
//     文書なら (a)。まさの口頭の伝聞（「まさが…と把握している」等）だけなら (b)。
//   - 一般的な業界動向（政策・大手の撤退など、公開情報で足りるもの）へのまさのコメントは、
//     まさがいなくても公開情報から同じ結論に届くので (a)。
//   - 反実仮想テスト: 「まさに聞かなかったら、この数値は何になっていたか」を毎回自問し、
//     公開情報や既存の文書だけでは同じ値に届かないと判断したものだけ (b) にした。
// 分類結果の全文（reason の引用つき）は bzm/paper_p1_dual_scoring.md の付表を参照。
// ─────────────────────────────────────────────────────────────────────────
const CLASSIFICATION = {
  '6c1ced6c-33b0-130b-4ced-99c79fc68243': { anon: 'A', pj: 'p22', name: 'OptQC', maskedB: [] },
  '8050097b-1d38-3a3b-c877-49f30794312c': { anon: 'B', pj: 'p05', name: 'マテリアル・コンセプト', maskedB: [] },
  '25f814a6-c151-098e-651f-6f23288fd829': { anon: 'C', pj: 'p20', name: 'CryoX', maskedB: ['conversion_c'] },
  '50fffaf7-8ab4-77fb-41c6-0e44d4ff890a': { anon: 'D', pj: 'p07', name: 'LiSTie', maskedB: ['burn_rate_yen_month'] },
  'bebf442f-fa5b-cdc9-de31-0d3fdf3e140d': { anon: 'E', pj: 'p29', name: 'KENQ', maskedB: [] },
  '3c5cdae2-cd9a-6c4c-b7e1-c381df4e1343': { anon: 'F', pj: 'p04', name: '輝翠', maskedB: [] },   // 修正 2026-08-30: p09/p04 が入れ替わっていた（DB seed_projects が正）
  '8b2ec717-027c-4cb5-9760-190ccf30f71a': { anon: 'G', pj: 'p26', name: 'VasculaX', maskedB: ['evangelist_e'] },
  '39585700-88a6-70f1-8e6a-fccb03641204': {
    anon: 'H', pj: 'p03', name: 'ティエムファクトリ',
    maskedB: ['free_cash_yen', 'burn_rate_yen_month', 'unit_margin_positive', 'evangelist_e', 'self_revenue_yen_month'],
  },
  '00bb86dd-e1e3-9a69-4861-280b04424273': { anon: 'I', pj: 'p08', name: 'Carbon Cryo Capture', maskedB: [] },
  '091afcac-a7c8-1b04-1690-2af19ea85a2f': { anon: 'J', pj: 'p01', name: 'OPTMASS', maskedB: [] },
  'f4f4e30e-35ff-4c95-b9b0-f5629237b28e': { anon: 'K', pj: 'p21', name: 'SolvioraX', maskedB: ['evangelist_e'] },
  'eeba1bfd-6020-225f-af8b-ed7717fc134e': { anon: 'L', pj: 'p09', name: 'JOYCLE', maskedB: [] },   // 同上
  '24c43617-8c3a-5b10-95e3-5fa16e4718fb': { anon: 'M', pj: 'p11', name: 'Blue Water Energy', maskedB: [] },
  '2d289848-9278-b741-3437-5856d8dce6ff': {
    anon: 'N', pj: 'p16', name: 'ORLIB',
    maskedB: ['free_cash_yen', 'burn_rate_yen_month', 'unit_margin_positive', 'evangelist_e', 'kappa_ip', 'self_revenue_yen_month', 'funcs_f2'],
  },
  '3c6c774d-4f8e-4d99-aa00-f149a75f98d5': { anon: 'O', pj: 'p31', name: 'ゼオライトNa電池材料', maskedB: [] },
  'a1390f71-3d7d-4bbc-9016-ca25bc901c34': { anon: 'P', pj: 'seed-a1390f71', name: 'フレキシブル熱電', maskedB: ['free_cash_yen', 'evangelist_e'] },
  '01f2dfcb-5ed8-83e7-c560-1be48459c7fa': { anon: 'Q', pj: 'p06', name: 'CrestecBio', maskedB: ['burn_rate_yen_month'] },
  '9a077ec6-79b7-051b-7a2e-b47401511cf0': { anon: 'R', pj: 'p24', name: 'チャレナジー', maskedB: ['free_cash_yen', 'unit_margin_positive', 'evangelist_e'] },
  'f18b5a65-9bed-ade4-7ed7-59d3d08ab86a': {
    anon: 'S', pj: 'p10', name: '翔エンジニアリング',
    maskedB: ['free_cash_yen', 'burn_rate_yen_month', 'unit_margin_positive', 'evangelist_e', 'funcs_f4'],
  },
  'b7ece08e-24c9-fd7c-c841-8f37aab8673f': { anon: 'T', pj: 'p18', name: 'Yellow Duck', maskedB: [] },
  '5a1f4784-414f-47e4-d716-4988aee6cd40': {
    anon: 'U', pj: 'p02', name: 'r3kt',
    maskedB: ['free_cash_yen', 'burn_rate_yen_month', 'unit_margin_positive', 'sigma', 'evangelist_e', 'self_revenue_yen_month'],
  },
};

/** 用途の天井を合計して、価値の式に入る年額の純増（円）を出す。未調査の用途は数えない。
 *  天井（seed_value_ceilings）は分類の対象外——まさへの聞き取りではなく市場調査に基づく入力なので、
 *  records-only / with-elicitation の両方で同じ値を使う。 */
function ceilingTotal(ceilings) {
  let total = 0;
  let known = false;
  for (const c of ceilings) {
    if (c.ceiling_yen === null || c.ceiling_yen === undefined) continue;
    known = true;
    total += Number(c.ceiling_yen) - Number(c.displacement_yen || 0);
  }
  return known ? total : null;
}

/**
 * DB の入力を、参照実装が受け取る init へ写す。model/tools/bzm30_score_seeds.cjs の toInit と
 * 同じロジックだが、mode==='records' のときは maskedFields に載った列を「入っていない」ものとして
 * 読み飛ばす——参照実装は省略された項目を Tier 0 の代表案件の前提（既定）で埋める
 * （bzm30_forward.cjs 391-392行「省略時は Tier 0 の代表案件の前提…で、従来と同じ結果になる」）ので、
 * これで「(b) の値だけを Tier 0 の既定へ戻す」が実現する。
 */
function toInit(row, ceilingYen, maskedFields) {
  const type = row.process_type;
  const reg = row.reg_class;
  if (!type || !reg) return null;
  const masked = (col) => maskedFields.has(col);

  const init = {};
  if (!masked('evidence_stage') && row.evidence_stage !== null && row.evidence_stage !== undefined && row.evidence_stage > 0) {
    const gate = gateForStage(type, reg, row.evidence_stage);
    if (gate) init.gate = gate;
  }
  if (!masked('incorporated') && row.incorporated) init.incorporated = true;
  if (!masked('free_cash_yen') && row.free_cash_yen !== null && row.free_cash_yen !== undefined) {
    init.cashMan = Math.round(Number(row.free_cash_yen) / 10000);   // 円 → 万円
  }
  if (!masked('rights_open') && row.rights_open !== null && row.rights_open !== undefined) init.rightsOpen = row.rights_open;
  if (!masked('under_contract') && row.under_contract) init.underContract = true;
  if (!masked('sigma') && row.sigma !== null && row.sigma !== undefined) init.sigma = row.sigma;
  if (!masked('evangelist_e') && row.evangelist_e !== null && row.evangelist_e !== undefined) init.e = Number(row.evangelist_e);
  if (!masked('kappa_ip') && row.kappa_ip !== null && row.kappa_ip !== undefined) init.kIP = Number(row.kappa_ip);
  if (!masked('self_revenue_yen_month') && row.self_revenue_yen_month !== null && row.self_revenue_yen_month !== undefined) {
    init.rMan = Math.round(Number(row.self_revenue_yen_month) / 10000);
  }
  if (!masked('unit_margin_positive') && row.unit_margin_positive !== null && row.unit_margin_positive !== undefined) {
    init.unitMarginPositive = row.unit_margin_positive;
  }
  if (!masked('use_case_left') && row.use_case_left !== null && row.use_case_left !== undefined) init.uLeft = Number(row.use_case_left);
  if (!masked('conversion_c') && row.conversion_c !== null && row.conversion_c !== undefined) init.c = Number(row.conversion_c);
  if (!masked('quiet_months') && row.quiet_months !== null && row.quiet_months !== undefined) init.quietMonths = Number(row.quiet_months);
  const funcs = {};
  for (const n of [2, 3, 4, 5, 6, 7]) {
    const col = `funcs_f${n}`;
    if (masked(col)) continue;
    const v = row[col];
    if (v !== null && v !== undefined) funcs[`f${n}`] = Number(v);
  }
  if (Object.keys(funcs).length > 0) init.funcs = funcs;
  if (!masked('burn_rate_yen_month') && row.burn_rate_yen_month !== null && row.burn_rate_yen_month !== undefined) {
    init.burnMan = Math.round(Number(row.burn_rate_yen_month) / 10000);
  }
  // 会社化後の計画バーン（#2026-08-29-3。会社化前の案件のみ）。
  // 参照実装 model/tools/bzm30_score_seeds.cjs の toInit と揃える——これを落とすと
  // burn_post_yen_month を持つ CryoX・SolvioraX で凍結版のスコアを再現できない。
  if (!masked('burn_post_yen_month') && !row.incorporated
      && row.burn_post_yen_month !== null && row.burn_post_yen_month !== undefined) {
    init.burnPostMan = Math.round(Number(row.burn_post_yen_month) / 10000);
  }
  // 天井（pNetOku）はマスク対象外（上のコメント参照）。
  if (ceilingYen !== null) init.pNetOku = ceilingYen / 1e8;

  return { type, reg, init };
}

async function main() {
  const args = process.argv.slice(2);
  const supabase = db();

  if (args.includes('--list')) {
    const { data, error } = await supabase
      .from('seed_bzm30_inputs')
      .select('seed_id, process_type, reg_class')
      .not('process_type', 'is', null)
      .not('reg_class', 'is', null);
    if (error) throw error;
    for (const r of data) console.log(r.seed_id);
    return;
  }

  const modeIdx = args.indexOf('--mode');
  const mode = modeIdx >= 0 ? args[modeIdx + 1] : 'elicitation';
  if (mode !== 'records' && mode !== 'elicitation') throw new Error("--mode は records か elicitation");
  const seedId = args.find((a, i) => !a.startsWith('--') && (modeIdx < 0 || i !== modeIdx + 1));
  if (!seedId) throw new Error('seed_id を渡す（--list で一覧）');

  // 凍結した分類（bzm/paper_p1_input_classification.json、CLASSIFICATION_FREEZE.md に sha256）を読む。
  // c_items = 既定へ戻す項目、b_items = 記録が与える境界値で置き換える項目。
  const FROZEN = JSON.parse(require('node:fs').readFileSync(
    path.join(__dirname, '..', 'paper_p1_input_classification.json'), 'utf8'));
  const info = FROZEN[seedId];
  if (!info) throw new Error(`${seedId}: 凍結した分類表に無い（対象21件の外）`);
  const cItems = info.c_items || [];
  const bItems = info.b_items || {};

  // --only <field>: その1項目だけを (c) 扱いにする（寄与の分離＝leave-one-out 用）
  const onlyIdx = args.indexOf('--only');
  const onlyField = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
  const maskedFields = new Set(
    onlyField ? (cItems.includes(onlyField) ? [onlyField] : [])
              : (mode === 'records' ? cItems : []));
  // 境界値の置換は records 条件でのみ適用する（--only のときは対象の1項目だけ）
  const boundOverrides = (mode === 'records')
    ? (onlyField ? (bItems[onlyField] !== undefined ? { [onlyField]: bItems[onlyField] } : {}) : bItems)
    : {};

  // 読むだけ。書き込みは一切行わない（このツールに insert/update 経路は無い）。
  const { data: inputRow, error: e1 } = await supabase
    .from('seed_bzm30_inputs').select('*').eq('seed_id', seedId).single();
  if (e1) throw e1;
  // (b) 記録が与える境界値で置き換える（DB は書き換えない。メモリ上の行だけ）
  for (const [f, v] of Object.entries(boundOverrides)) inputRow[f] = v;

  const { data: ceilings, error: e2 } = await supabase
    .from('seed_value_ceilings').select('*').eq('seed_id', seedId);
  if (e2) throw e2;

  const total = ceilingTotal(ceilings || []);
  const spec = toInit(inputRow, total, maskedFields);
  if (!spec) {
    console.error(`${seedId}: 工程の型または規制属性が未判定なので計算できない`);
    console.log(`RESULT_JSON: ${JSON.stringify({ seed_id: seedId, anon: info.anon, mode, error: 'type_or_reg_missing' })}`);
    return;
  }

  const t0 = Date.now();
  const r = runTheta(spec.type, spec.reg, CFG, Object.keys(spec.init).length ? spec.init : undefined);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);

  const yen = (v) => (total === null ? null : Math.round(v * total));
  const result = {
    seed_id: seedId,
    anon: info.anon,
    pj: info.pj,
    name: info.name,
    mode,
    masked_fields: [...maskedFields],
    process_type: spec.type,
    reg_class: spec.reg,
    v_lower: r.v10, v_median: r.v50, v_upper: r.v90,
    score_lower_yen: yen(r.v10), score_median_yen: yen(r.v50), score_upper_yen: yen(r.v90),
    ceiling_total_yen: total,
    p_reach_m4: r.pM4,
    months_to_m4: r.m4mean,
    continuation_ratio: r.cRatio,
    inputs_used: spec.init,
    elapsed_s: Number(elapsed),
  };

  const oku = (v) => (v === null ? '—' : `${(v / 1e8).toFixed(2)}億`);
  console.error(`[${info.anon}] ${seedId} ${info.name} mode=${mode} ${spec.type}×${spec.reg} ${elapsed}s  v=${r.v50.toFixed(4)}  ` +
    `${oku(result.score_lower_yen)}〜${oku(result.score_median_yen)}〜${oku(result.score_upper_yen)}` +
    (maskedFields.size ? `  masked=[${[...maskedFields].join(',')}]` : ''));
  console.log(`RESULT_JSON: ${JSON.stringify(result)}`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
