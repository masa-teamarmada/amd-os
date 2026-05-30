/**
 * XRL チェックリスト初期投入 (えいみ案、まさ承認 2026-05-30)。
 *
 * 各PJの最新評価行(evaluated_at<=today)の現在XRL値を「達成レベル」とみなし、
 * floor(値) 以下の全レベルの全 checklist 項目を true にした xrl_checklist を生成して update。
 * 段階数・項目数は src/lib/xrl-level-definitions.ts から機械抽出 (原典準拠)。
 *
 * 運用: これは初期値。まさがスコア詳細ページで各PJ確認して修正する。
 * 実行: node scripts/seed_xrl_checklist.mjs   (.env.local の SERVICE_ROLE_KEY 使用)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// --- .env.local から SERVICE_ROLE_KEY ---
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, "");
const URL = "https://nbnhrhybjslbawdukvvk.supabase.co/rest/v1";
if (!KEY) throw new Error("no service role key");

// --- 定義ファイルから 各軸×各レベルの checklist 項目数を抽出 ---
const src = fs.readFileSync(path.join(ROOT, "src/lib/xrl-level-definitions.ts"), "utf8");
const AXES = ["trl", "brl", "grl", "srl", "hrl"];
const itemCounts = {}; // { trl: { 1: n, ... } }
for (const ax of AXES) {
  const re = new RegExp(`export const ${ax.toUpperCase()}_DEFINITION[\\s\\S]*?levels: \\[([\\s\\S]*?)\\n  \\],`);
  const body = src.match(re)[1];
  const levelRe = /\{ level: (\d+),[\s\S]*?checklist: \[([\s\S]*?)\] \}/g;
  const counts = {};
  let m;
  while ((m = levelRe.exec(body))) {
    const lv = +m[1];
    const items = (m[2].match(/"/g) || []).length / 2; // "..." ペア数
    counts[lv] = items;
  }
  itemCounts[ax] = counts;
}
console.log("item counts:", JSON.stringify(itemCounts));

// --- 各PJの最新行 (id + XRL値) ---
// SQL で取得済みの値をハードコード (evaluated_at<=now の distinct on 最新)
const ROWS = [
  { pj: "p03", id: "a2bdce6f-58a5-47a9-a123-b6eb3acce20a", trl: 6, brl: 3, grl: 5, srl: 4, hrl: 2 },
  { pj: "p04", id: "744a6ae0-d551-45ba-b34e-8e92408304a0", trl: 6, brl: 5, grl: 4, srl: 5, hrl: 4 },
  { pj: "p06", id: "0f785a63-4229-4da5-90e3-b4d85a59d242", trl: 6, brl: 4, grl: 8, srl: 7, hrl: 6 },
  { pj: "p07", id: "6245aede-4bb6-431a-b1b6-2ea440ae7d9e", trl: 7, brl: 6.8, grl: 6, srl: 7, hrl: 7 },
  { pj: "p09", id: "bf4bc5ee-9833-4d6d-8e34-570f35c97ad1", trl: 6, brl: 6, grl: 6, srl: 6, hrl: 5 },
  { pj: "p11", id: "23c7b4ef-9515-473a-b484-ff2944b386c4", trl: 6, brl: 6, grl: 8, srl: 7, hrl: 5 },
  { pj: "p18", id: "060cd878-d5f3-4cf0-895d-b219afb7ef14", trl: 4, brl: 1, grl: 4, srl: 4, hrl: 2 },
  { pj: "p20", id: "c5f071f1-d1e3-43c6-bbab-36493f227bfa", trl: 4, brl: 5, grl: 6, srl: 6, hrl: 5 },
  { pj: "p21", id: "27e32917-170a-4fbd-80ad-86ef9dc00692", trl: 4, brl: 4, grl: 7, srl: 5, hrl: 4 },
  { pj: "p24", id: "9aa2db07-a554-4b44-aff4-c588c7ef8f37", trl: 6, brl: 2.5, grl: 4.5, srl: 4, hrl: 2.5 },
  { pj: "p26", id: "11743c9f-309c-474d-bdc2-b8930f6b8959", trl: 4, brl: 1.5, grl: 1, srl: 1.5, hrl: 2.5 },
];

function buildChecklist(row) {
  const cl = {};
  for (const ax of AXES) {
    const achieved = Math.floor(row[ax] ?? 0); // 小数は切り捨て (控えめ初期値)
    const axisObj = {};
    for (let lv = 1; lv <= achieved; lv++) {
      const n = itemCounts[ax][lv] ?? 0;
      axisObj[String(lv)] = new Array(n).fill(true);
    }
    if (Object.keys(axisObj).length) cl[ax] = axisObj;
  }
  return cl;
}

const results = [];
for (const row of ROWS) {
  const checklist = buildChecklist(row);
  const res = await fetch(`${URL}/amd_score_inputs?id=eq.${row.id}`, {
    method: "PATCH",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ xrl_checklist: checklist }),
  });
  const ok = res.ok;
  const lv = AXES.map((a) => `${a.toUpperCase()}${Math.floor(row[a])}`).join("/");
  console.log(`${row.pj} ${ok ? "OK" : "FAIL " + res.status} [${lv}]`);
  results.push({ pj: row.pj, ok });
}
console.log(`\nDone: ${results.filter((r) => r.ok).length}/${results.length} updated`);
