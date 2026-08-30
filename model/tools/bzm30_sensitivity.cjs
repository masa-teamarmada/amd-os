#!/usr/bin/env node
'use strict';
/*
 * BZM 3.0 — 入力を1つずつ振ったときの産業創出価値の曲線を先に計算して OS へ書く
 *
 * まさ 2026-08-30「全案件のスコアが表形式で並んでて、右側の列にずらーっと各パラメータが並んでて、
 * それらのパラメータを変えたときにSPSが変わる様子がUI上で見れるといいかもって思った。」
 *
 * 前向き計算は1件あたり10秒〜数分かかるので画面のリクエストの中では走らせられない
 * （model/README.md (g)）。パラメータを1本ずつ振った曲線を先に計算して行として持ち、画面はその上を滑らせる。
 *
 *   node model/tools/bzm30_sensitivity.cjs --list            … 対象の seed_id を1行ずつ出す
 *   node model/tools/bzm30_sensitivity.cjs <seed_id>         … 1件ぶんの全パラメータを計算して書き戻す
 *   node model/tools/bzm30_sensitivity.cjs <seed_id> --dry   … 書き戻さず結果だけ出す
 *   node model/tools/bzm30_sensitivity.cjs <seed_id> --param free_cash   … 1パラメータだけ
 *
 * 入力を DB の init へ写す規則（toInit）は bzm30_score_seeds.cjs から読む。
 * 二か所に書くと、曲線の基準点と seed_bzm30_scores の値が静かに食い違う。
 */

const path = require('node:path');
const seeds = require('./bzm30_score_seeds.cjs');
const { CFG, runTheta } = require(seeds.IMPL_PATH);

const TABLE = 'seed_bzm30_sensitivity';

/** 万円へ丸めた表示（画面が数字の整形を二重に持たないよう、ラベルはここで作る） */
function manLabel(yen) {
  const man = Math.round(Number(yen) / 10000);
  if (Math.abs(man) >= 10000) return `${(man / 10000).toFixed(man % 10000 === 0 ? 0 : 1)}億円`;
  return `${man.toLocaleString('ja-JP')}万円`;
}
function okuPerYearLabel(yen) {
  return `${(Number(yen) / 1e8).toFixed(1)}億円／年`;
}

/**
 * 案件ごとに振るパラメータの定義。
 * `values(base)` は基準の入力から曲線の点を作る。基準そのものの点を必ず1つ含める（is_base）。
 * `apply(init, v)` はその点の init を作る。`skip(row)` が真なら、その案件ではその行を出さない。
 */
const PARAMS = [
  {
    key: 'free_cash',
    label: '自由資金の残高',
    unit: '円',
    baseOf: (row) => Number(row.free_cash_yen),
    skip: (row) => row.free_cash_yen === null || row.free_cash_yen === undefined,
    values: (base) => [0.25, 0.5, 0.75, 1, 1.5, 2, 3].map((m) => Math.round(base * m)),
    apply: (init, v) => ({ ...init, cashMan: Math.round(v / 10000) }),
    labelOf: (v) => manLabel(v),
  },
  {
    key: 'burn',
    label: 'バーンレート（月）',
    unit: '円/月',
    baseOf: (row) => Number(row.burn_rate_yen_month),
    skip: (row) => row.burn_rate_yen_month === null || row.burn_rate_yen_month === undefined,
    values: (base) => [0.5, 0.75, 1, 1.5, 2, 3].map((m) => Math.round(base * m)),
    apply: (init, v) => ({ ...init, burnMan: Math.round(v / 10000) }),
    labelOf: (v) => `${manLabel(v)}／月`,
  },
  {
    key: 'ceiling',
    label: '用途の天井の合計（年額の純増）',
    unit: '円/年',
    baseOf: (_row, ceiling) => ceiling,
    skip: (_row, ceiling) => ceiling === null,
    values: (base) => [0.25, 0.5, 0.75, 1, 1.5, 2, 4].map((m) => Math.round(base * m)),
    // 天井は金額に線形に効くだけでなく、経済性の乗数（§6.I-10 の pNet）を通して到達確率にも効く。
    // だから掛け算で済ませず、点ごとに計算し直す。
    apply: (init, v) => ({ ...init, pNetOku: v / 1e8 }),
    labelOf: (v) => okuPerYearLabel(v),
    ceilingOverride: true,
  },
  {
    key: 'evidence_stage',
    label: '評価日の証拠水準',
    unit: '段階',
    baseOf: (row) => Number(row.evidence_stage ?? 0),
    values: () => [0, 1, 2, 3, 4, 5, 6],
    apply: (init, v, ctx) => {
      const next = { ...init };
      delete next.gate;
      if (v > 0) {
        const gate = ctx.gateForStage(ctx.type, ctx.reg, v);
        if (gate) next.gate = gate;
      }
      return next;
    },
    labelOf: (v) => `段階${v}`,
  },
  {
    key: 'e',
    label: '担い手（機能1 エバンジェリスト）',
    unit: '0〜1',
    baseOf: (row) => (row.evangelist_e === null || row.evangelist_e === undefined ? 0.5 : Number(row.evangelist_e)),
    values: (base) => Array.from(new Set([0.2, 0.35, 0.5, 0.65, 0.8, base].map((x) => Number(x.toFixed(2))))).sort((a, b) => a - b),
    apply: (init, v) => ({ ...init, e: v }),
    labelOf: (v) => v.toFixed(2),
  },
  {
    key: 'c',
    label: '変換能力',
    unit: '倍',
    baseOf: (row) => (row.conversion_c === null || row.conversion_c === undefined ? 1.0 : Number(row.conversion_c)),
    values: (base) => Array.from(new Set([0.1, 0.25, 0.5, 1.0, 1.5, 2.0, base].map((x) => Number(x.toFixed(2))))).sort((a, b) => a - b),
    apply: (init, v) => ({ ...init, c: v }),
    labelOf: (v) => `${v.toFixed(2)} 倍`,
  },
  {
    key: 'quiet_months',
    label: '無風期間',
    unit: '月',
    baseOf: (row) => (row.quiet_months === null || row.quiet_months === undefined ? 0 : Number(row.quiet_months)),
    values: (base) => Array.from(new Set([0, 6, 12, 18, 24, 36, base])).sort((a, b) => a - b),
    apply: (init, v) => ({ ...init, quietMonths: v }),
    labelOf: (v) => `${v}か月`,
  },
  {
    key: 'kappa_ip',
    label: '専有可能性',
    unit: '0〜1',
    baseOf: (row) => (row.kappa_ip === null || row.kappa_ip === undefined ? 0.55 : Number(row.kappa_ip)),
    values: (base) => Array.from(new Set([0.15, 0.35, 0.55, 0.75, base].map((x) => Number(x.toFixed(2))))).sort((a, b) => a - b),
    apply: (init, v) => ({ ...init, kIP: v }),
    labelOf: (v) => v.toFixed(2),
  },
  {
    key: 'sigma',
    label: '産官学モメンタム',
    unit: '-1/0/+1',
    baseOf: (row) => (row.sigma === null || row.sigma === undefined ? 0 : Number(row.sigma)),
    values: () => [-1, 0, 1],
    apply: (init, v) => ({ ...init, sigma: v }),
    labelOf: (v) => (v > 0 ? '追い風 (+1)' : v < 0 ? '向かい風 (-1)' : '中立 (0)'),
  },
];

async function main() {
  const args = process.argv.slice(2);
  const supabase = seeds.db();

  if (args.includes('--list')) {
    const { data, error } = await supabase
      .from('seed_bzm30_inputs')
      .select('seed_id')
      .not('process_type', 'is', null)
      .not('reg_class', 'is', null);
    if (error) throw error;
    for (const r of data) console.log(r.seed_id);
    return;
  }

  // `--param` を渡していないとき indexOf は -1 になり、-1+1=0 で第1引数（seed_id そのもの）を
  // 除外してしまう。bzm30_score_seeds.cjs が同じ形で踏んだ罠なので、位置で明示的に除く。
  const paramIdx = args.indexOf('--param');
  const seedId = args.find((a, i) => !a.startsWith('--') && (paramIdx < 0 || i !== paramIdx + 1));
  if (!seedId) throw new Error('seed_id を渡す（--list で一覧）');
  const dry = args.includes('--dry');
  const only = paramIdx >= 0 ? args[paramIdx + 1] : null;

  const { data: row, error: e1 } = await supabase
    .from('seed_bzm30_inputs').select('*').eq('seed_id', seedId).single();
  if (e1) throw e1;
  const { data: ceilings, error: e2 } = await supabase
    .from('seed_value_ceilings').select('*').eq('seed_id', seedId);
  if (e2) throw e2;

  const ceiling = seeds.ceilingTotal(ceilings || []);
  const spec = seeds.toInit(row, ceiling);
  if (!spec) { console.error(`${seedId}: 工程の型または規制属性が未判定なので計算できない`); return; }

  const ctx = { type: spec.type, reg: spec.reg, gateForStage: require('./bzm30_export.cjs').gateForStage };
  const rows = [];
  const t0 = Date.now();

  for (const p of PARAMS) {
    if (only && p.key !== only) continue;
    if (p.skip && p.skip(row, ceiling)) {
      console.log(`  ${p.key}: 入力が無いので飛ばす`);
      continue;
    }
    const base = p.baseOf(row, ceiling);
    if (base === null || base === undefined || Number.isNaN(base)) continue;
    const values = p.values(base);
    for (let i = 0; i < values.length; i += 1) {
      const v = values[i];
      const init = p.apply({ ...spec.init }, v, ctx);
      const r = runTheta(spec.type, spec.reg, CFG, Object.keys(init).length ? init : undefined);
      // 天井を振る行では、金額はその点の天井で掛ける。それ以外は基準の天井で掛ける
      const totalForPoint = p.ceilingOverride ? v : ceiling;
      const yen = (x) => (totalForPoint === null ? null : Math.round(x * totalForPoint));
      const isBase = Math.abs(Number(v) - Number(base)) < 1e-9;
      rows.push({
        seed_id: seedId,
        model_version: seeds.MODEL_VERSION,
        approval_ref: seeds.APPROVAL_REF,
        param: p.key,
        point_index: i,
        is_base: isBase,
        param_value: v,
        param_label: p.labelOf(v),
        v_lower: r.v10, v_median: r.v50, v_upper: r.v90,
        score_lower_yen: yen(r.v10), score_median_yen: yen(r.v50), score_upper_yen: yen(r.v90),
        p_reach_m4: r.pM4,
        months_to_m4: r.m4mean === null || r.m4mean === undefined ? null : Number(r.m4mean),
      });
      const oku = totalForPoint === null ? '—' : `${(r.v50 * totalForPoint / 1e8).toFixed(2)}億`;
      console.log(`  ${p.key}[${i}] ${p.labelOf(v)}${isBase ? ' ←いまの値' : ''} → ${oku}  v=${r.v50.toFixed(4)}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`${seedId} ${spec.type}×${spec.reg} ${rows.length}点 ${elapsed}s`);
  if (dry) return;

  // 同じ案件・同じ承認の古い曲線は捨てて入れ直す（append-only にすると画面が版を選ぶ必要が出る）
  const delQ = supabase.from(TABLE).delete()
    .eq('seed_id', seedId).eq('model_version', seeds.MODEL_VERSION).eq('approval_ref', seeds.APPROVAL_REF);
  const { error: e3 } = only ? await delQ.eq('param', only) : await delQ;
  if (e3) throw e3;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const { error: e4 } = await supabase.from(TABLE).insert(rows);
    if (!e4) return;
    if (attempt === 5) throw e4;
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
