#!/usr/bin/env node
'use strict';
/*
 * BZM 3.0 — 案件ごとに産業創出価値 V を算出して OS へ書き戻す
 *
 * まさ 2026-08-27「OSの全データとネット上の情報を使って算出するようにして」（承認 #2026-08-27-1）。
 *
 * 読むもの:
 *   seed_bzm30_inputs   … 工程の型 × 規制属性、評価日の証拠水準、観測状態、案件パラメータ
 *   seed_value_ceilings … 用途ごとの天井 P̄_u と置き換え分 δ_u
 * 書くもの:
 *   seed_bzm30_scores   … 天井1円あたりの現在価値 v（10%点・中央・90%点）と、天井を掛けた金額
 *
 * 1件あたり2〜3分かかる。並列で回すため、引数に seed_id を1件だけ渡す形にしてある。
 *   node model/tools/bzm30_score_seeds.cjs --list          … 対象の seed_id を1行ずつ出す
 *   node model/tools/bzm30_score_seeds.cjs <seed_id>       … 1件を計算して書き戻す
 *   node model/tools/bzm30_score_seeds.cjs <seed_id> --dry … 書き戻さず結果だけ出す
 *
 * 天井が未調査の案件も計算する。v は出るので、天井が入った時点で金額になる。
 */

const path = require('node:path');
const { createClient } = require(path.join(__dirname, '..', '..', 'pwa', 'node_modules', '@supabase/supabase-js'));
// 参照実装は --impl で差し替えられる。**未承認の改訂が既定に入っているあいだ、承認済みの版で計算するため**
// （model/README.md (b): 提案中の概念・値は承認まで評価にも本番表示にも使わない）。
const implArg = process.argv.indexOf('--impl');
const IMPL_PATH = implArg >= 0 ? path.resolve(process.argv[implArg + 1]) : path.join(__dirname, 'bzm30_forward.cjs');
const { CFG, runTheta } = require(IMPL_PATH);
const { gateForStage } = require('./bzm30_export.cjs');

// dotenv は pwa 側に入っていないので、KEY=VALUE を自前で読む（値のクォートだけ外す）。
for (const line of require('node:fs').readFileSync(path.join(__dirname, '..', '..', 'pwa', '.env.local'), 'utf8').split('\n')) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const MODEL_VERSION = 'bzm-3.0';
const APPROVAL_REF = '2026-08-27-1';

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が要る');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** 用途の天井を合計して、価値の式に入る年額の純増（円）を出す。未調査の用途は数えない。 */
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
 * DB の入力を、参照実装が受け取る init へ写す。
 * 埋まっていない項目は渡さない（参照実装が Tier 0 の既定を使う）。
 */
function toInit(row, ceilingYen) {
  const type = row.process_type;
  const reg = row.reg_class;
  if (!type || !reg) return null;

  const init = {};
  if (row.evidence_stage !== null && row.evidence_stage !== undefined && row.evidence_stage > 0) {
    const gate = gateForStage(type, reg, row.evidence_stage);
    if (gate) init.gate = gate;
  }
  if (row.incorporated) init.incorporated = true;
  if (row.free_cash_yen !== null && row.free_cash_yen !== undefined) {
    init.cashMan = Math.round(Number(row.free_cash_yen) / 10000);   // 円 → 万円
  }
  if (row.rights_open !== null && row.rights_open !== undefined) init.rightsOpen = row.rights_open;
  if (row.under_contract) init.underContract = true;
  if (row.sigma !== null && row.sigma !== undefined) init.sigma = row.sigma;
  if (row.evangelist_e !== null && row.evangelist_e !== undefined) init.e = Number(row.evangelist_e);
  if (row.kappa_ip !== null && row.kappa_ip !== undefined) init.kIP = Number(row.kappa_ip);
  if (row.self_revenue_yen_month !== null && row.self_revenue_yen_month !== undefined) {
    init.rMan = Math.round(Number(row.self_revenue_yen_month) / 10000);
  }
  if (row.unit_margin_positive !== null && row.unit_margin_positive !== undefined) {
    init.unitMarginPositive = row.unit_margin_positive;
  }
  if (row.use_case_left !== null && row.use_case_left !== undefined) init.uLeft = Number(row.use_case_left);
  // 経済性の乗数は天井の純増（億円）で決まる。未調査なら既定（基準値＝乗数1）のまま
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

  const implIdx = args.indexOf('--impl');
  const seedId = args.find((a, i) => !a.startsWith('--') && i !== implIdx + 1);
  if (!seedId) throw new Error('seed_id を渡す（--list で一覧）');
  const dry = args.includes('--dry');

  const { data: inputRow, error: e1 } = await supabase
    .from('seed_bzm30_inputs').select('*').eq('seed_id', seedId).single();
  if (e1) throw e1;

  const { data: ceilings, error: e2 } = await supabase
    .from('seed_value_ceilings').select('*').eq('seed_id', seedId);
  if (e2) throw e2;

  const total = ceilingTotal(ceilings || []);
  const spec = toInit(inputRow, total);
  if (!spec) {
    console.error(`${seedId}: 工程の型または規制属性が未判定なので計算できない`);
    return;
  }

  const t0 = Date.now();
  const r = runTheta(spec.type, spec.reg, CFG, Object.keys(spec.init).length ? spec.init : undefined);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);

  const yen = (v) => (total === null ? null : Math.round(v * total));
  const payload = {
    seed_id: seedId,
    model_version: MODEL_VERSION,
    approval_ref: APPROVAL_REF,
    v_lower: r.v10, v_median: r.v50, v_upper: r.v90,
    score_lower_yen: yen(r.v10), score_median_yen: yen(r.v50), score_upper_yen: yen(r.v90),
    ceiling_total_yen: total,
    p_reach_m4: r.pM4,
    months_to_m4: r.m4mean,
    continuation_ratio: r.cRatio,
    outcome: r.outcome,
    inputs: { type: spec.type, reg: spec.reg, ...spec.init, impl: path.basename(IMPL_PATH) },
  };

  const oku = (v) => (v === null ? '—' : `${(v / 1e8).toFixed(0)}億`);
  console.log(`${seedId} ${spec.type}×${spec.reg} ${elapsed}s  v=${r.v50.toFixed(3)}  ` +
    `${oku(payload.score_lower_yen)}〜${oku(payload.score_median_yen)}〜${oku(payload.score_upper_yen)}`);

  if (dry) return;
  // 並列で走らせると書き込みが一時的に落ちることがある（fetch failed）。
  // 計算に2〜3分かけたあとなので、ここで捨てずに数回やり直す。
  let lastErr = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const { error: e3 } = await supabase.from('seed_bzm30_scores').insert(payload);
      if (!e3) return;
      lastErr = e3;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw lastErr;
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
