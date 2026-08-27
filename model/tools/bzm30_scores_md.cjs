#!/usr/bin/env node
'use strict';
/*
 * BZM 3.0 — 算出済みのスコアを md の表として出す
 *
 * スコアの正本は DB（seed_bzm30_scores）と OS の画面。この表はその写しで、
 * **手で数字を書き換えない**。係数か入力を変えたら bzm30_score_seeds.cjs で計算し直し、
 * これを実行して貼り替える。
 *
 *   node model/tools/bzm30_scores_md.cjs
 */

const path = require('node:path');
const { createClient } = require(path.join(__dirname, '..', '..', 'pwa', 'node_modules', '@supabase/supabase-js'));

for (const line of require('node:fs').readFileSync(path.join(__dirname, '..', '..', 'pwa', '.env.local'), 'utf8').split('\n')) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

// 1億円未満は万円で出す。億へ丸めると、天井を SOM で絞ったあとの小さい額が
// すべて「0億」に潰れて、案件どうしの差が読めなくなる（BUGS.md 2026-08-27）。
const oku = (yen) => {
  if (yen === null || yen === undefined) return '—';
  const v = Number(yen);
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}億`;
  return `${Math.round(v / 1e4).toLocaleString('ja-JP')}万`;
};

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: scores, error } = await supabase
    .from('seed_bzm30_scores')
    .select('*')
    .order('computed_at', { ascending: false });
  if (error) throw error;

  // シーズごとに最新の1件だけ
  const latest = new Map();
  for (const s of scores) if (!latest.has(s.seed_id)) latest.set(s.seed_id, s);

  const ids = [...latest.keys()];
  const [{ data: seeds }, { data: links }, { data: inputs }] = await Promise.all([
    supabase.from('seeds').select('id, title').in('id', ids),
    supabase.from('seed_projects').select('seed_id, project_id, venture_name').in('seed_id', ids),
    supabase.from('seed_bzm30_inputs').select('seed_id, process_type, reg_class, evidence_stage, incorporated').in('seed_id', ids),
  ]);

  const byId = (rows, key) => new Map((rows || []).map((r) => [r[key], r]));
  const seedMap = byId(seeds, 'id');
  const linkMap = byId(links, 'seed_id');
  const inputMap = byId(inputs, 'seed_id');

  const rows = ids.map((id) => {
    const s = latest.get(id);
    const seed = seedMap.get(id) || {};
    const link = linkMap.get(id) || {};
    const inp = inputMap.get(id) || {};
    return {
      pj: link.project_id || '—',
      name: link.venture_name || seed.title || id.slice(0, 8),
      title: seed.title || '',
      lower: s.score_lower_yen, median: s.score_median_yen, upper: s.score_upper_yen,
      v: s.v_median, ceiling: s.ceiling_total_yen,
      ratio: s.score_lower_yen ? Number(s.score_upper_yen) / Number(s.score_lower_yen) : null,
      type: inp.process_type, reg: inp.reg_class, stage: inp.evidence_stage, inc: inp.incorporated,
      pM4: s.p_reach_m4,
    };
  });

  rows.sort((a, b) => (Number(b.median || 0) - Number(a.median || 0)));

  console.log('| 順位 | PJ | 案件 | 下限(10%) | **中央(50%)** | 上限(90%) | 幅の倍率 | 天井（年額の純増） | 天井1円あたり | 型×規制 | 現在地 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  let rank = 0;
  for (const r of rows) {
    const label = r.median === null ? '—' : String(++rank);
    const stage = r.stage === null || r.stage === undefined ? '未入力' : `段階${r.stage}`;
    console.log(
      `| ${label} | ${r.pj} | ${r.name} | ${oku(r.lower)} | **${oku(r.median)}** | ${oku(r.upper)} | ` +
      `${r.ratio ? `${r.ratio.toFixed(1)}倍` : '—'} | ${oku(r.ceiling)}／年 | ${Number(r.v).toFixed(3)} | ` +
      `${r.type || '—'}×${(r.reg || '').replace('REG', 'REG-')} | ${stage}${r.inc ? '・会社化済み' : ''} |`,
    );
  }
  process.stderr.write(`\n${rows.length} 件（うち金額が出たのは ${rows.filter((r) => r.median !== null).length} 件）\n`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
