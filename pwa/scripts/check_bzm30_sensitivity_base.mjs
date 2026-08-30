#!/usr/bin/env node
/**
 * 入力を動かして見る画面（/seeds/sensitivity）が読む曲線の「基準点」が、
 * シーズ詳細に出ている産業創出価値と一致していることを機械で確かめる。
 *
 * なぜ要るか:
 *   曲線は model/tools/bzm30_sensitivity.cjs が先に計算して seed_bzm30_sensitivity へ書く。
 *   スコアは model/tools/bzm30_score_seeds.cjs が seed_bzm30_scores へ書く。
 *   入力を DB から参照実装へ写す規則（toInit）は共有してあるが、係数か入力が変わったのに
 *   どちらか片方だけ計算し直すと、**同じ案件の同じ入力に対して画面が二つの違う金額を出す**。
 *   そのずれは目で見つけられないので、ここで落とす。
 *
 * 何を見るか:
 *   各案件・各パラメータの is_base = TRUE の行の v_median が、
 *   seed_bzm30_scores の最新行（同じ model_version / approval_ref）の v_median と一致すること。
 *   曲線が1本も無い案件は「まだ計算していない」であって失敗ではない（画面は「計算中」と出す）。
 *
 * 実行: node scripts/check_bzm30_sensitivity_base.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.join(HERE, '..', '.env.local');
if (fs.existsSync(ENV)) {
  for (const line of fs.readFileSync(ENV, 'utf8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('SKIP: Supabase の接続情報が無いので検査しない（CI の環境変数を確認する）');
  process.exit(0);
}

// 相対誤差の許容。参照実装は格子の上で解くので、同じ入力なら完全に一致する。
// 丸め以上のずれは「片方だけ計算し直した」の合図。
const TOLERANCE = 1e-9;

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: names } = await sb.from('seeds').select('id, title');
const titleOf = new Map((names || []).map((s) => [s.id, s.title]));

const { data: scores, error: e1 } = await sb
  .from('seed_bzm30_scores')
  .select('seed_id, model_version, approval_ref, v_median, created_at')
  .order('created_at', { ascending: false });
if (e1) throw e1;
const latest = new Map();
for (const r of scores) if (!latest.has(r.seed_id)) latest.set(r.seed_id, r);

const { data: curve, error: e2 } = await sb
  .from('seed_bzm30_sensitivity')
  .select('seed_id, model_version, approval_ref, param, v_median')
  .eq('is_base', true);
if (e2) throw e2;

const failures = [];
const bySeed = new Map();
for (const r of curve) {
  if (!bySeed.has(r.seed_id)) bySeed.set(r.seed_id, []);
  bySeed.get(r.seed_id).push(r);
}

for (const [seedId, rows] of bySeed) {
  const base = latest.get(seedId);
  const name = titleOf.get(seedId) || seedId;
  if (!base) {
    failures.push(`${name}: 曲線はあるのに産業創出価値の行が無い`);
    continue;
  }
  for (const r of rows) {
    if (r.model_version !== base.model_version || r.approval_ref !== base.approval_ref) {
      failures.push(
        `${name} / ${r.param}: 曲線は ${r.model_version}・${r.approval_ref} で計算されているが、` +
        `画面に出ている価値は ${base.model_version}・${base.approval_ref}。どちらかを計算し直す`,
      );
      continue;
    }
    const a = Number(r.v_median);
    const b = Number(base.v_median);
    const dev = Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
    if (dev > TOLERANCE) {
      failures.push(
        `${name} / ${r.param}: 曲線の基準点 v=${a.toFixed(6)} と、画面の価値 v=${b.toFixed(6)} が食い違う` +
        `（ずれ ${(dev * 100).toFixed(4)}%）`,
      );
    }
  }
}

const missing = [...latest.keys()].filter((id) => !bySeed.has(id));

if (failures.length) {
  console.error('入力を動かして見る画面の基準点が、シーズ詳細の金額と食い違っている:\n');
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    '\n直し方: 係数か入力を変えたら両方を計算し直す。\n' +
    '  node model/tools/bzm30_score_seeds.cjs <seed_id>\n' +
    '  node model/tools/bzm30_sensitivity.cjs <seed_id>\n',
  );
  process.exit(1);
}

console.log(
  `OK: 曲線のある ${bySeed.size} 件すべてで、基準点がシーズ詳細の金額と一致している` +
  (missing.length ? `（曲線がまだ無いのは ${missing.length} 件。画面は「計算中」と出す）` : ''),
);
