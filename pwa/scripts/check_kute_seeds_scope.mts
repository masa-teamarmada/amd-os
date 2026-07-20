import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  researchInstitutionSeedsOrgNameForProject,
  SEED_COMMERCIALIZATION_TYPE_LABEL,
  SEED_COMMERCIALIZATION_TYPE_ORDER,
} from "../src/lib/kute-seeds-scoring.ts";
import { SEED_PUBLIC_VIEW_COLUMNS } from "../src/types/seeds.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
function readSrc(relPath: string): string {
  return readFileSync(join(scriptDir, relPath), "utf8");
}

// 1. p25 → 工学院大学、それ以外は null (境界ヘルパーが唯一の scope 定義)
{
  assert.equal(researchInstitutionSeedsOrgNameForProject("p25"), "工学院大学", "p25 は工学院大学にマップされていません");
  assert.equal(researchInstitutionSeedsOrgNameForProject("p01"), null, "未定義の project_id は null を返すべきです");
  assert.equal(researchInstitutionSeedsOrgNameForProject(""), null, "空文字は null を返すべきです");
}

// 2. SeedPublicView のホワイトリストは confidential フィールドを含まない
{
  const forbidden = [
    "internal_notes",
    "source_detail",
    "amd_rating_note",
    "amd_owner_member_id",
    "amd_rating",
    "next_action",
    "created_by",
    "updated_by",
  ];
  for (const col of forbidden) {
    assert.ok(
      !(SEED_PUBLIC_VIEW_COLUMNS as readonly string[]).includes(col),
      `SEED_PUBLIC_VIEW_COLUMNS に confidential フィールド ${col} が含まれています`
    );
  }
  assert.ok(SEED_PUBLIC_VIEW_COLUMNS.includes("envisioned_use_case"), "公開面向け事業化詳細フィールドが欠けています");
  assert.ok(SEED_PUBLIC_VIEW_COLUMNS.includes("discovery_status"), "公開情報候補を区別する discovery_status が欠けています");
  assert.ok(
    !(SEED_PUBLIC_VIEW_COLUMNS as readonly string[]).some((c) => c.startsWith("kute_")),
    "SEED_PUBLIC_VIEW_COLUMNS に旧 kute_* 列名が残っています (187 で全国共通名へ改名済み)"
  );
}

// 3. 事業化タイプのラベル・順序は5種類そろっている
{
  const types = ["large_startup", "small_business_1b_yen", "license", "jv_ma", "joint_research_poc"];
  for (const t of types) {
    assert.ok(SEED_COMMERCIALIZATION_TYPE_LABEL[t], `${t} のラベルがありません`);
    assert.ok(SEED_COMMERCIALIZATION_TYPE_ORDER.includes(t), `${t} が順序リストにありません`);
  }
  assert.equal(SEED_COMMERCIALIZATION_TYPE_ORDER.length, 5);
}

// 4. CockpitKuteSeeds は比較テーブル UI (sticky/sort/filter) で、旧カード実装や
//    旧100点スコア・kute_score パターンを含まない
{
  const ui = readSrc("../src/components/cockpit/CockpitKuteSeeds.tsx");
  assert.ok(ui.includes("<table"), "テーブル要素が見つかりません");
  assert.ok(ui.includes("sticky"), "sticky 列/ヘッダーが見つかりません");
  assert.ok(ui.includes("toggleSort") || ui.includes("onSort"), "ソート機能が見つかりません");
  assert.ok(ui.includes("FilterSelect") || ui.includes("confidenceFilter"), "フィルタ機能が見つかりません");
  assert.ok(!/SeedCard/.test(ui), "旧 SeedCard パターンが残っています");
  assert.ok(!/CompactField/.test(ui), "旧 CompactField パターンが残っています");
  assert.ok(!/kute_score/.test(ui), "旧 kute_score パターンが残っています");
  assert.ok(!/100\s*点/.test(ui), "旧 100点スケール表記が残っています");
  // TRL/BRL/GRL/SRL/HRL は結合1セルではなく、各軸が独立した <th>/セル (AxisCell) を持つ
  assert.ok(!/function Metric/.test(ui), "旧 Metric mini-card 実装が残っています");
  assert.ok(!/axesText/.test(ui), "旧 XRL スラッシュ結合表示 (axesText) が残っています");
  assert.ok(/function AxisCell/.test(ui), "XRL 独立列用の AxisCell が見つかりません");
  for (const axisLabel of ["TRL", "BRL", "GRL", "SRL", "HRL"]) {
    assert.ok(
      new RegExp(`<th className="[^"]*">${axisLabel}</th>`).test(ui),
      `XRL の独立列見出し ${axisLabel} が見つかりません`
    );
  }
  // 行クリックは keyboard (Enter/Space) でも開けること
  assert.ok(/onKeyDown/.test(ui), "行の onKeyDown ハンドラが見つかりません");
  assert.ok(/e\.key === "Enter"/.test(ui) && /e\.key === " "/.test(ui), "Enter/Space での行オープンが見つかりません");
  // sticky 左セルは行 hover と一緒に視認できるよう group を使う
  assert.ok(/className="group /.test(ui), "行に group クラスが見つかりません");
  assert.ok(/group-hover:bg-/.test(ui), "sticky セルの group-hover 連動が見つかりません");
  // 資料アイコンは title/aria-label を持つ
  assert.ok(/aria-label="資料あり"/.test(ui), "資料アイコンの aria-label が見つかりません");
  assert.ok(/title="資料あり"/.test(ui), "資料アイコンの title が見つかりません");
  // letter spacing 指定 (tracking-*) を持たない
  assert.ok(!/tracking-\[/.test(ui) && !/\btracking-(tighter|tight|normal|wide|wider|widest)\b/.test(ui), "letter spacing (tracking-*) 指定が残っています");
  // 可視の操作説明・英語eyebrowを持たない
  assert.ok(!/並び替え: 列見出しクリック/.test(ui), "可視の操作説明(並び替え: 列見出しクリック)が残っています");
  assert.ok(!/>KUTE seeds</.test(ui), "英語eyebrow(KUTE seeds)が残っています");
  // 意思決定に必要な表セルは省略せず、セル内で全文を折り返す
  assert.ok(!/\btruncate\b/.test(ui), "KUTE比較表に1行省略(truncate)が残っています");
  assert.ok(!/\bline-clamp-\d+\b/.test(ui), "KUTE比較表に複数行省略(line-clamp)が残っています");
  assert.ok(/whitespace-normal/.test(ui) && /break-words/.test(ui), "KUTE比較表の全文折り返し指定が見つかりません");
  assert.ok(/1行＝技術 × 用途/.test(ui), "同じ研究者が複数シーズを持てる案件単位の説明が見つかりません");
  assert.ok(/公開情報候補/.test(ui), "大学・研究者確認前の公開情報候補表示が見つかりません");
}

// 5. KuteSeedDetailModal は定義リスト/テーブル形式で、ネストしたカード装飾を持たない
{
  const modal = readSrc("../src/components/seeds/KuteSeedDetailModal.tsx");
  assert.ok(modal.includes("<table"), "詳細モーダルにテーブルが見つかりません");
  assert.ok(modal.includes("M / P / R / S") || modal.includes("components.macro"), "M/P/R/S 内訳が見つかりません");
  assert.ok(modal.includes("TRL / BRL / GRL / SRL / HRL"), "XRL 軸の表示が見つかりません");
  assert.ok(!/rounded-lg border[^"]*bg-slate-50/.test(modal), "ネストしたカード装飾 (rounded + border + bg) が残っています");
}

// 6. 187: seed_sps_assessments は axis_evidence/evaluator を持つため anon_read policy が無い
{
  const ddl187 = readSrc("migrations/187_seed_sps_assessments.sql");
  assert.ok(!/CREATE POLICY anon_read ON seed_sps_assessments/.test(ddl187), "seed_sps_assessments に anon_read policy が復活しています");
  assert.ok(/DROP POLICY IF EXISTS anon_read ON seed_sps_assessments/.test(ddl187), "anon_read policy の削除文が見つかりません");
}

// 7. 188: 工学院大学6シーズの backfill が exactly 6件 insert + 存在数 assert を持つ
{
  const ddl188 = readSrc("migrations/188_seed_sps_kute_backfill.sql");
  const insertCount = (ddl188.match(/INSERT INTO seed_sps_assessments/g) ?? []).length;
  assert.equal(insertCount, 6, `188 の INSERT 文が6件ではありません (実際: ${insertCount})`);
  assert.ok(/RAISE EXCEPTION/.test(ddl188), "188 に存在数チェックの RAISE EXCEPTION がありません");
  assert.ok(/found_count\s*<>\s*6/.test(ddl188), "188 の存在数 assert が 6 件を検証していません");
  // 合計6件だけでなく、各 title が exactly 1 件かも検査する
  assert.ok(/FOREACH expected_title IN ARRAY/.test(ddl188), "188 に title ごとの FOREACH ループが見つかりません");
  assert.ok(/found_count\s*<>\s*1/.test(ddl188), "188 の title ごとの exactly-one assert が見つかりません");
  // axis_evidence は全件同一の note だけでなく、軸ごとの根拠を持つ
  for (const axisKey of [
    "mu_a",
    "mu_i",
    "mu_g",
    "potential",
    "trl",
    "brl",
    "grl",
    "srl",
    "hrl",
    "f_character",
    "f_cap",
    "r_net",
  ]) {
    const occurrences = (ddl188.match(new RegExp(`"${axisKey}":`, "g")) ?? []).length;
    assert.equal(occurrences, 6, `188 の axis_evidence に軸 ${axisKey} の根拠が6件分ありません (実際: ${occurrences})`);
  }
  // 危険な内容 (URL / secret) を axis_evidence に含めない
  assert.ok(!/https?:\/\//.test(ddl188), "188 の axis_evidence に URL が含まれています");
  // 軸の意味を取り違えた誤用語が残っていないこと (mu_iを競合密度、mu_gを市場成長、GRLをGTM、SRLを供給体制、R_netを外部連携ネットワークと書かない)
  assert.ok(!/競合・代替技術密度/.test(ddl188), "188 に mu_i の誤用語(競合・代替技術密度)が残っています");
  assert.ok(!/市場成長性/.test(ddl188), "188 に mu_g の誤用語(市場成長性)が残っています");
  assert.ok(!/GTM\(市場投入\)/.test(ddl188), "188 に grl の誤用語(GTM(市場投入))が残っています");
  assert.ok(!/供給・実証体制/.test(ddl188), "188 に srl の誤用語(供給・実証体制)が残っています");
  assert.ok(!/外部連携ネットワークからの収益/.test(ddl188), "188 に r_net の誤用語(外部連携ネットワークからの収益)が残っています");
  assert.ok(!/人材育成体制/.test(ddl188), "188 に hrl の誤用語(人材育成体制)が残っています");
}

// 8. 189: 公開調査の上位3件を review-first の discovered として追加し、
//    旧100点ルーブリック値を SPS/XRL へ流用しない
{
  const ddl189 = readSrc("migrations/189_kute_public_seed_candidates.sql");
  for (const title of [
    "165〜220nm次世代クリーンUV面光源",
    "金属フリー透明フレキシブル導電膜",
    "塩水・交流電気分解による都市鉱山金回収",
  ]) {
    assert.ok(ddl189.includes(title), `189 に追加候補「${title}」が見つかりません`);
  }
  assert.ok(/'discovered'/.test(ddl189), "189 の追加候補が review-first の discovered になっていません");
  assert.ok(!/INSERT INTO seed_sps_assessments/.test(ddl189), "189 が未確認候補へ SPS 評価を捏造投入しています");
  assert.ok(!/https?:\/\//.test(ddl189), "189 に一次ソースの生URLが含まれています");
  assert.ok(/found_count\s*<>\s*1/.test(ddl189), "189 に候補ごとの exactly-one assert がありません");
}

console.log("check_kute_seeds_scope.mts: all checks passed");
