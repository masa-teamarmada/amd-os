/**
 * コスト試算の標準フォーマット（spec 3-23 §7）の汎用の計算と、画面への流し込みの契約検査。
 *
 * まさ確定 2026-10-03「原価計算は、フォーマットは共通させることを前提にcxのもちゃんと入れて」。
 * 1. CX の原価（成果物3 事業計画書 2026-09-30 NIMS提出版）を、汎用の計算が同じ額で出すか
 *    （12台/年の1台あたり ＝ 成果物3の2031年の売上原価 347,773,262円 ÷ 12台）
 * 2. 明細の行の下に出す式（ItemCalcLine）を計算した答えが、右端の1単位あたりの額と一致するか
 * 3. 内訳の行（COST_BREAKDOWN_ROWS）を足すと総コストになるか
 * 4. データの形だけで計算を選ぶか（PJ番号で分けない）
 * 5. 画面（ProjectCostFormat）が定義の区画をすべて描き、コスト試算タブの入口がこの画面か廃液の画面だけを選ぶか
 *
 * 実行: node --experimental-strip-types scripts/check_project_cost_items_engine.mts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateItemCalc } from "../src/lib/cost-item-calc.ts";
import { computeItemsCost, itemsVolumeCases } from "../src/lib/project-cost-items-engine.ts";
import { costFormatBreakdown, costFormatEngineOf, costFormatInputGroups, costFormatStatus } from "../src/lib/project-cost-format.ts";
import { COST_BREAKDOWN_ROWS, COST_FORMAT_SECTIONS } from "../src/lib/project-formats.ts";
import type { CostModelBundle } from "../src/lib/project-cost-model.ts";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const fixture = (name: string) => JSON.parse(read(`scripts/__fixtures__/${name}`)) as CostModelBundle;
let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}
const near = (actual: number, expected: number, tol: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} （期待 ${expected} ±${tol}）`);

const cx = fixture("cx_cost_items_260930.json");

check("CX の1台あたりの原価が成果物3と一致する", () => {
  const r12 = computeItemsCost(cx);
  near(r12.volume, 12, 0, "前提の年間の量");
  near(r12.totalPerUnit, 28981105.48, 0.5, "12台/年の1台あたり（成果物3の2031年 347,773,262円 ÷ 12台 ＝ 28,981,105円）");
  near(computeItemsCost(cx, 2).totalPerUnit, 31439557.86, 0.5, "2台/年");
  near(computeItemsCost(cx, 70).totalPerUnit, 28573704.8, 0.5, "70台/年");
  near(r12.capexInitial, 19144000, 0, "生産設備の初期投資");
  near(r12.hoursAnnual, 6000, 0, "作業工数 500時間 × 12台");
  near(r12.salePrice, 55000000, 0, "売価");
  near(r12.profitPerUnit, 55000000 - 28981105.48, 0.5, "1台あたりの利益");
  near(r12.revenueAnnual, 660000000, 0, "年間の売上（成果物3の2031年）");
});

check("比べる年間の量を読む", () => {
  const cases = itemsVolumeCases(cx.assumptions);
  assert.deepEqual(cases.map((c) => c.volume), [2, 12, 70]);
  assert.deepEqual(cases.map((c) => c.label), ["2028年の計画", "2031年の計画", "2035年の計画"]);
});

check("明細の行の式を計算した答えが、右端の1単位あたりの額と一致する", () => {
  for (const volume of [2, 12, 70]) {
    const r = computeItemsCost(cx, volume);
    for (const line of r.lines) near(evaluateItemCalc(line.calc), line.perUnit, 1e-6, `${line.label}（${volume}台/年）`);
  }
});

check("内訳の行を足すと総コストになり、行は標準の並び", () => {
  const r = computeItemsCost(cx);
  const groups = costFormatInputGroups(cx);
  const rows = costFormatBreakdown(r, groups);
  assert.deepEqual(rows.map((x) => x.key), COST_BREAKDOWN_ROWS.map((x) => x.key));
  near(rows.reduce((s, x) => s + x.amount, 0), r.totalPerUnit, 1e-6, "内訳の合計");
  near(rows.find((x) => x.key === "materials")?.amount ?? 0, 25614415, 0, "原料・部材 ＝ 部材費");
  near(rows.find((x) => x.key === "labor")?.amount ?? 0, 2875000, 0, "作業 ＝ 500時間 × 5,750円");
  near(rows.find((x) => x.key === "supplies")?.amount ?? 0, 250000, 1e-6, "消耗品・電力・施設 ＝ 工場の賃料 300万円 ÷ 12台");
  for (const row of rows) for (const part of row.parts) assert.ok(part.groupKey, `${part.label} の移り先（操作パネルの小分け）がある`);
});

check("データの形だけで計算を選ぶ（PJ番号で分けない）", () => {
  assert.equal(costFormatEngineOf(cx), "items");
  const wastewater = fixture("sx_cost_model_two_stage.json");
  assert.equal(costFormatEngineOf(wastewater), "wastewater");
  const fuel = fixture("sx_fuel_cost_model.json");
  assert.equal(costFormatEngineOf(fuel), "fuel");
  assert.equal(costFormatEngineOf({ ...cx, items: [], tasks: [] }), null, "明細も作業も無い試算は標準フォーマットの計算では読まない");
  assert.equal(costFormatEngineOf(null), null);
});

check("年間の量が無い部分試算（1単位あたりの明細だけ）でも数が壊れない", () => {
  const partial: CostModelBundle = {
    ...cx,
    model: { ...cx.model, unitBasisLabel: "kg" },
    assumptions: [],
    tasks: [],
    items: [
      { ...cx.items[0], costItemId: "membrane", leafLabel: "膜", quantity: 1, unitPrice: 265.3, formatRow: "supplies" },
      { ...cx.items[0], costItemId: "power", leafLabel: "電力", quantity: 1, unitPrice: 52.5, formatRow: "supplies" },
    ],
  };
  const r = computeItemsCost(partial);
  near(r.totalPerUnit, 317.8, 1e-9, "膜＋電力");
  assert.ok([r.totalAnnual, r.profitPerUnit, r.marginRate, r.revenueAnnual].every(Number.isFinite));
  assert.equal(itemsVolumeCases(partial.assumptions).length, 0);
});

check("成立ラインの判定は言葉で返す", () => {
  assert.deepEqual(costFormatStatus(100, 120, null, null), { label: "黒字", tone: "ok" });
  assert.deepEqual(costFormatStatus(130, 120, null, null), { label: "赤字", tone: "bad" });
  assert.deepEqual(costFormatStatus(100, 120, 90, null), { label: "目標超", tone: "warn" });
  assert.deepEqual(costFormatStatus(80, 120, 90, null), { label: "目標内", tone: "ok" });
  assert.deepEqual(costFormatStatus(100, 120, null, 0.3), { label: "上限超", tone: "bad" });
  assert.deepEqual(costFormatStatus(317.8, 0, null, null), { label: "売価未登録", tone: "none" }, "売価も目標も無い部分試算は黒字・赤字を言わない");
});

check("画面は定義の区画をすべて描き、入口はデータの形で画面を選ぶ", () => {
  const view = read("src/components/cockpit/ProjectCostFormat.tsx") + read("src/components/cockpit/ProjectCostFormatSections.tsx");
  for (const s of COST_FORMAT_SECTIONS) {
    assert.ok(new RegExp(`data-cost-section=(?:"${s.key}"|\\{s\\.key\\})|section="${s.key}"`).test(view), `区画「${s.label}」（${s.key}）を描く`);
  }
  assert.match(view, /COST_SUMMARY_ITEMS\.map\(/, "要約の欄は定義の順");
  assert.match(view, /COST_INPUT_BLOCKS\.map\(/, "前提と作業は条件・CAPEX・OPEX の3つ");
  assert.match(view, /saveCostPatches\(/, "保存は読み込み層を通す");
  assert.doesNotMatch(view, /fetch\(/, "画面から素の fetch をしない（spec 5-10）");
  assert.doesNotMatch(view, /億円|万円/, "金額は3桁ごとのカンマの円で出す（億・万に丸めない）");
  const tab = read("src/components/cockpit/CockpitCostTab.tsx");
  assert.match(tab, /costFormatEngineOf\(bundle\)/, "入口はデータの形で選ぶ");
  assert.doesNotMatch(tab, /["'`]p\d{2}["'`]/, "入口でPJ番号を名指ししない");
  // 燃料の試算もこの入口の中の切り替えで読む（2026-10-03 まさ「全部統一してないとだめ」）。入口に渡す追加の指定
  // （旧アドレスから燃料を先に選ぶ・DDでは燃料を別の区画で出す）は許す。
  for (const [file, mount] of [
    ["src/components/cockpit/CockpitView.tsx", "<CockpitCostTab projectId={project.projectId}"],
    ["src/components/project-workspace/SxWeeklyControlDashboard.tsx", "<CockpitCostTab projectId={bundle.project.projectId} allowEdit={false}"],
    ["src/components/dd/DdLiveBodies.tsx", "<CockpitCostTab projectId={data.projectId} allowEdit={false}"],
  ] as const) {
    assert.ok(read(file).includes(mount), `${file} はコスト試算タブを CockpitCostTab で描く`);
    assert.doesNotMatch(read(file), /<CockpitCostModel\b/, `${file} は廃液の画面を直に描かない（入口を通す）`);
  }
});

console.log(`✓ コスト試算の標準フォーマット（汎用の計算・流し込み・画面の入口） ${passed}件`);
