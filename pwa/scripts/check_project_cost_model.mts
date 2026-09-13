// コスト試算（二段階・作業リスト版）の計算エンジンと画面の契約チェック。DB接続なし。
// Run: npm run test:project-cost-model
//
// 【なぜこの guard があるか】
// 2026-09-13 まさ指摘①: 旧版は中央培養の設備償却を「排水1m³あたりの固定額」で置いており、
// 菌体使用回数を変えると菌体1kgあたりの原価が見かけ上 98円 → 約440円 → 約1,200円と動いた。
// 「製造原価は株で決まり、用途では変わらない。用途で変わるのは使い回せる回数」という事実と合わない計算を二度と戻さない。
// 2026-09-13 まさ指摘②: 「人件費を除くと」の併記はやめ、作業リスト（工数 × 作業単価）で人件費を動かす。
// 生産した菌体の何割が売れるか（販売率）を上下できるようにする。未確定の数字はすべて画面で変えられ、
// 操作と結果をスクロールせずに見比べられる形にする。
//
// 正本: pwa/spec/5-13-project-cost-model-current-spec.md
// fixture: scripts/__fixtures__/sx_cost_model_two_stage.json（migration 395 適用後の SX データ）
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  computeBiomassCost,
  computeCostModel,
  deriveCostBasis,
  taskAmount,
  type CostModelBundle,
} from "../src/lib/project-cost-model.ts";
import {
  applyDraft,
  draftKey,
  draftToPatches,
  listDraftChanges,
  pruneDraft,
  setDraftValue,
} from "../src/lib/project-cost-model-draft.ts";

const fixture = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sx_cost_model_two_stage.json", import.meta.url), "utf8")) as CostModelBundle;
const clone = (): CostModelBundle => JSON.parse(JSON.stringify(fixture));
const scenario = (bundle: CostModelBundle, strain: "enhanced" | "wild", app: "dye" | "metal", key: string) => {
  const s = computeCostModel(bundle, { strain }).scenarios.find((x) => x.key === `${app}:${key}`);
  assert.ok(s, `scenario ${strain} ${app} ${key}`);
  return s;
};
const near = (got: number, want: number, tol: number, label: string) =>
  assert.ok(Math.abs(got - want) <= tol, `${label}: got ${got.toFixed(4)}, want ${want} ±${tol}`);
const task = (bundle: CostModelBundle, id: string) => {
  const t = bundle.tasks.find((x) => x.costTaskId === id);
  assert.ok(t, `task ${id}`);
  return t;
};

// 1. 旧版と同じ条件へ戻すと、260820版の検証値（原典スプレッドシート一致済み）に戻る
{
  const legacy = clone();
  for (const a of legacy.assumptions) if (a.roleKey === "uptake_alpha" && a.application === "metal" && a.strain === "wild") a.value = 0.05;
  legacy.tasks = []; // 人件費と巡回は旧版に無い（閉鎖系の作業は強化株のみで、自然株には元から乗らない）
  for (const i of legacy.items) {
    if (i.costItemId === "ci_260820_133") i.unitPrice = 5;
    if (i.costItemId === "ci_260820_141") i.unitPrice = 4;
  }
  const expected: Record<string, number> = { "循環-既設": 582.4, "循環-新設": 642.4, "投入-既設": 349.7, "投入-新設": 409.7 };
  for (const [key, want] of Object.entries(expected)) near(scenario(legacy, "wild", "metal", key).totalPerUnit, want, 0.05, `旧版再現 ${key}`);
}

// 2. 菌体の製造原価は用途で変わらない（第2段の菌体費 ÷ 使った菌体量 ＝ 第1段の原価）
for (const strain of ["enhanced", "wild"] as const) {
  const perKg = computeBiomassCost(fixture, strain).perKg;
  assert.ok(perKg > 0, `${strain} 第1段の原価が出ている`);
  for (const s of computeCostModel(fixture, { strain }).scenarios) {
    near(s.centralTotalPerUnit / s.biomassKgPerUnit, perKg, 1e-6, `${strain} ${s.key} の菌体1kg原価が第1段と一致`);
  }
}

// 3. 強化株は閉鎖系の追加費用で自然株より高い。自然株には強化株の行が1円も乗らない
{
  const enh = computeBiomassCost(fixture, "enhanced");
  const wild = computeBiomassCost(fixture, "wild");
  assert.ok(enh.perKg > wild.perKg, "強化株の菌体原価 > 自然株");
  assert.ok(enh.strainSpecificPerKg > 0, "強化株に株固有の行が乗る");
  assert.equal(wild.strainSpecificPerKg, 0, "自然株に強化株の行は乗らない");
  assert.ok(enh.tasksAnnual > 0 && wild.tasksAnnual === 0, "製造拠点の作業（閉鎖系）は強化株だけ");
  for (const s of computeCostModel(fixture, { strain: "wild" }).scenarios) assert.equal(s.strainSpecificPerUnit, 0, `自然株 ${s.key} に閉鎖系の追加費用なし`);
}

// 4. 菌体使用回数を2倍にすると、菌体費はちょうど半分になる（旧版の頭打ちを戻さない）
{
  const base = scenario(fixture, "enhanced", "dye", "投入-既設");
  const doubled = clone();
  for (const a of doubled.assumptions) if (a.roleKey === "reuse_count" && a.application === "dye") a.value = (a.value ?? 1) * 2;
  const twice = scenario(doubled, "enhanced", "dye", "投入-既設");
  near(twice.centralTotalPerUnit, base.centralTotalPerUnit / 2, 1e-6, "使用回数2倍で菌体費が半分");
  near(twice.biomassKgPerUnit, base.biomassKgPerUnit / 2, 1e-9, "使用回数2倍で菌体量が半分");
}

// 5. 用途の行は他の用途に混ざらない（色素分解に酸処理は乗らない。金属回収に汚泥処分は乗らない）
{
  const metalItems = new Set(fixture.items.filter((i) => i.application === "metal").map((i) => i.costItemId));
  assert.ok(fixture.items.some((i) => i.application === "dye") && metalItems.size > 0, "用途別の行がある");
  const dye = scenario(fixture, "wild", "dye", "投入-既設");
  const metal = scenario(fixture, "wild", "metal", "投入-既設");
  assert.ok(dye.postProcessPerUnit > 0 && metal.postProcessPerUnit > 0, "両用途に後処理がある");
  const dyeOnly = clone();
  dyeOnly.items = dyeOnly.items.filter((i) => !metalItems.has(i.costItemId));
  near(scenario(dyeOnly, "wild", "dye", "投入-既設").totalPerUnit, dye.totalPerUnit, 1e-9, "金属専用の行を消しても色素分解は変わらない");
}

// 6. 作業リスト: 年額 = 年間回数 × (1回の工数 × 作業単価 + 1回の経費)。人件費を除いた値は持たない
{
  const s = scenario(fixture, "enhanced", "dye", "投入-既設");
  const derived = deriveCostBasis(fixture.assumptions, { strain: "enhanced", application: "dye" });
  assert.ok(s.siteTaskPerUnit > 0, "現場と巡回の作業が総コストに入っている");
  for (const forbidden of ["totalWithoutLaborPerUnit", "profitWithoutLaborPerUnit", "laborPerUnit", "patrolPerUnit", "referenceLaborPerUnit"]) {
    assert.ok(!(forbidden in s), `「人件費を除くと」系の値 ${forbidden} を戻さない`);
  }
  // 現場の運転（B:投入）: 7.5時間 × 共通4,000円 × 300バッチ
  const run = taskAmount(task(fixture, "ct_run_injection"), fixture.assumptions, derived, { strain: "enhanced", application: "dye" });
  near(run.annual, 7.5 * 4000 * 300, 1e-6, "現場の運転 = 工数 × 共通の作業単価 × 年間バッチ数");
  assert.equal(run.usesCommonRate, true, "作業単価が空欄なら共通の作業単価");
  // 移動: 訪問回数 = 300 ÷ max(使用回数1, 1回の搬入でまかなう5) = 60、(2時間 × 4,000 + 車両費5,000) × 60
  const travel = taskAmount(task(fixture, "ct_travel"), fixture.assumptions, derived, { strain: "enhanced", application: "dye" });
  near(travel.occurrences, 60, 1e-9, "訪問回数");
  near(travel.annual, 60 * (2 * 4000 + 5000), 1e-6, "移動 = 訪問回数 × (工数 × 単価 + 1回の経費)");

  // 工数を2倍にすると、その分だけ作業費が増える
  const moreHours = clone();
  task(moreHours, "ct_run_injection").hoursPerOccurrence = 15;
  near(scenario(moreHours, "enhanced", "dye", "投入-既設").siteTaskPerUnit - s.siteTaskPerUnit, (7.5 * 4000 * 300) / derived.annualVolume, 1e-9, "工数2倍で運転の作業費が2倍");
  // 行に作業単価を入れると共通の単価より優先する。共通の単価を変えても、その行は動かない
  const ownRate = clone();
  task(ownRate, "ct_run_injection").hourlyRate = 6000;
  for (const a of ownRate.assumptions) if (a.roleKey === "labor_rate") a.value = 5000;
  const ownRun = taskAmount(task(ownRate, "ct_run_injection"), ownRate.assumptions, derived, { strain: "enhanced", application: "dye" });
  near(ownRun.annual, 7.5 * 6000 * 300, 1e-6, "行の作業単価が優先");
  near(taskAmount(task(ownRate, "ct_delivery"), ownRate.assumptions, derived, { strain: "enhanced", application: "dye" }).annual, 60 * 1 * 5000, 1e-6, "単価が空欄の行は共通の作業単価に連動");
  // 工数が空欄（未確認）の行は0時間。経費だけが乗る
  const integrity = taskAmount(task(fixture, "ct_s_integrity_test"), fixture.assumptions, derived, { strain: "enhanced", application: "dye" });
  assert.equal(task(fixture, "ct_s_integrity_test").hoursPerOccurrence, null, "工数未確認の行は空欄");
  near(integrity.annual, 150000, 1e-6, "工数空欄は0時間として数え、経費だけ乗る");
  // 製造拠点の作業は第1段の固定費に入る（生産量で割って1kgあたり）
  const enh = computeBiomassCost(fixture, "enhanced");
  near(enh.rows.find((r) => r.key === "tasks")!.perKg, enh.tasksAnnual / enh.capacityKgYear, 1e-9, "製造拠点の作業 ÷ 生産能力");
  // 内訳を足すと総コストになる
  for (const strain of ["enhanced", "wild"] as const) {
    for (const x of computeCostModel(fixture, { strain }).scenarios) {
      near(x.breakdown.reduce((t, b) => t + b.perUnit, 0), x.totalPerUnit, 1e-9, `${strain} ${x.key} 内訳の合計 = 総コスト`);
    }
  }
}

// 7. 販売率: 売れ残りも作った分の費用はかかるので、第1段の全費用を売れた量で割る
{
  const rate = (bundle: CostModelBundle, pctValue: number) => {
    const b: CostModelBundle = JSON.parse(JSON.stringify(bundle));
    const row = b.assumptions.find((a) => a.roleKey === "sales_rate");
    assert.ok(row, "販売率の前提がある");
    row.value = pctValue;
    return b;
  };
  const full = computeBiomassCost(fixture, "enhanced");
  const half = computeBiomassCost(rate(fixture, 50), "enhanced");
  near(full.salesRate, 1, 1e-12, "既定は全量が売れる100%");
  near(half.perKg, full.perKg * 2, 1e-9, "販売率50%で菌体1kgの原価が2倍（比例費も含めて全部）");
  for (const key of ["capex", "fixed", "tasks", "variable"]) {
    near(half.rows.find((r) => r.key === key)!.perKg, full.rows.find((r) => r.key === key)!.perKg * 2, 1e-9, `販売率50%で ${key} の行も2倍`);
  }
  near(half.soldKgYear, full.capacityKgYear * 0.5, 1e-9, "売れる量 = 生産能力 × 販売率");
  near(computeBiomassCost(rate(fixture, 0), "enhanced").salesRate, 0.01, 1e-12, "販売率は1%より下げない（0で割らない）");
  const noRow = clone();
  noRow.assumptions = noRow.assumptions.filter((a) => a.roleKey !== "sales_rate");
  near(computeBiomassCost(noRow, "enhanced").perKg, full.perKg, 1e-9, "販売率の前提が無い試算は100%と同じ");
  // 上書き値も販売率で割る
  const over = rate(fixture, 50);
  for (const a of over.assumptions) if (a.roleKey === "biomass_cost_per_kg_override") a.value = 400;
  near(computeBiomassCost(over, "enhanced").perKg, 800, 1e-9, "上書き値 ÷ 販売率");
}

// 8. 仕様書の検証表と一致する（B:投入／既設）。作業リストへ移しても数字は変わっていない
near(computeBiomassCost(fixture, "enhanced").perKg, 127.1, 0.05, "強化株 菌体原価");
near(computeBiomassCost(fixture, "wild").perKg, 98.5, 0.05, "自然株 菌体原価");
near(scenario(fixture, "enhanced", "dye", "投入-既設").totalPerUnit, 878.0, 0.05, "強化株 色素 B既設");
near(scenario(fixture, "enhanced", "metal", "投入-既設").totalPerUnit, 715.0, 0.05, "強化株 金属 B既設");
near(scenario(fixture, "wild", "dye", "投入-既設").totalPerUnit, 826.5, 0.05, "自然株 色素 B既設");
near(scenario(fixture, "wild", "metal", "投入-既設").totalPerUnit, 708.1, 0.05, "自然株 金属 B既設");

// 9. 株・用途・作業を持たない試算（LiSTie の部分試算など）でも落ちない
{
  const c = computeCostModel({ assumptions: [], items: [] });
  assert.deepEqual(c.strains, []);
  assert.deepEqual(c.applications, []);
  assert.equal(c.scenarios.length, 4, "用途なしは従来どおり4シナリオ");
  assert.ok(c.scenarios.every((s) => Number.isFinite(s.totalPerUnit)), "空でも数値が有限");
}

// 10. 試算中の変更: 保存値はそのまま持ち、書き換えは下書きに持つ。保存するときだけ API の patch にする
{
  const bundle = { ...clone(), questions: [], notes: [] };
  const alpha = bundle.assumptions.find((a) => a.costAssumptionId === "ca2_uptake_alpha_dye");
  assert.ok(alpha, "色素の取り込み効率の前提がある");
  let draft = setDraftValue({}, bundle, "assumption", alpha.costAssumptionId, "value", 0.1);
  draft = setDraftValue(draft, bundle, "task", "ct_run_injection", "hoursPerOccurrence", 3);
  draft = setDraftValue(draft, bundle, "item", "ci_260820_092", "unitPrice", 6_000_000);
  draft = setDraftValue(draft, bundle, "model", bundle.model.costModelId, "targetTotalCostPerUnit", 400);
  assert.equal(Object.keys(draft).length, 4, "4つの書き換えが下書きに入る");
  assert.equal(alpha.value, 0.05, "保存値は書き換わらない");
  const working = applyDraft(bundle, draft);
  assert.ok(scenario(working, "enhanced", "dye", "投入-既設").totalPerUnit < scenario(bundle, "enhanced", "dye", "投入-既設").totalPerUnit, "下書きを重ねると再計算される");
  assert.equal(setDraftValue(draft, bundle, "assumption", alpha.costAssumptionId, "value", 0.05)[draftKey("assumption", alpha.costAssumptionId, "value")], undefined, "保存値と同じに戻すと下書きから消える");
  assert.equal(setDraftValue({}, bundle, "item", "ci_260820_092", "unitPrice", -1)[draftKey("item", "ci_260820_092", "unitPrice")], undefined, "負の単価は受け付けない");
  assert.equal(listDraftChanges(bundle, draft).length, 4, "変更の一覧");
  const patches = draftToPatches(bundle, draft);
  assert.deepEqual(patches.find((p) => p.entity === "task")?.patch, { hours_per_occurrence: 3 }, "作業の patch は DB の列名");
  assert.deepEqual(patches.find((p) => p.entity === "model")?.patch, { target_total_cost_per_m3: 400 }, "目標の patch");
  // 作業を固定の回数に変えるときは、年間回数も一緒に送る（DB の制約）
  let fixed = setDraftValue({}, bundle, "task", "ct_delivery", "countPerYear", 60);
  fixed = setDraftValue(fixed, bundle, "task", "ct_delivery", "countDriver", "fixed");
  assert.deepEqual(draftToPatches(bundle, fixed, [draftKey("task", "ct_delivery", "countDriver")])[0].patch, { count_driver: "fixed", count_per_year: 60 }, "固定の回数へ変えると年間回数も送る");
  // 読み直した保存値と同じになった下書きは落ちる
  const reloaded = applyDraft(bundle, { [draftKey("task", "ct_run_injection", "hoursPerOccurrence")]: 3 });
  assert.equal(Object.keys(pruneDraft(reloaded, draft)).length, 3, "保存済みの下書きは落ちる");
}

// 11. 画面の契約（静的確認）
{
  const read = (p: string) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const files = [
    "../src/components/cockpit/CockpitCostModel.tsx",
    "../src/components/cockpit/CockpitCostModelControls.tsx",
    "../src/components/cockpit/CockpitCostModelResults.tsx",
    "../src/components/cockpit/CockpitCostModelReading.tsx",
  ];
  const ui = files.map(read).join("\n");
  const main = read(files[0]);
  assert.match(main, /computeCostModel\(working, \{ strain/, "画面は選んだ株と試算中の変更で計算する");
  assert.match(main, /CostControlsPanel[\s\S]*CostResultsPanel/, "操作パネルと結果を同じ枠に並べる");
  assert.match(main, /xl:grid-cols-\[minmax\(0,1fr\)_460px\]/, "デスクトップは操作パネルと結果の2列");
  assert.match(main, /CostResultsSummaryBar/, "スマホ幅は結果の要約を上に固定する");
  assert.match(main, /sticky top-0 z-20 xl:hidden/, "要約はスマホ幅だけ固定");
  assert.match(main, /この値を保存/, "保存は admin の「この値を保存」から");
  assert.match(main, /canEdit &&[\s\S]*すべて保存/, "保存ボタンは編集できる人だけ");
  assert.doesNotMatch(main, /saveCostAssumptionValue|onBlur=\{\(\) => \{[\s\S]*saveCost/, "入力のたびに保存しない（試算は保存しない）");
  assert.match(ui, /作業リスト/, "作業リストがある");
  assert.match(ui, /販売率/, "販売率が見える");
  assert.match(ui, /PRODUCTION_SITE_LABEL/, "中央培養は「菌体の製造拠点」と呼ぶ");
  assert.doesNotMatch(ui, /人件費を除/, "「人件費を除くと」を出さない");
  assert.doesNotMatch(ui.replace(/"中央培養"/g, ""), /中央培養/, "画面の文言に「中央培養」を出さない（DB の値との比較だけ許す）");
  assert.match(ui, /第1段/, "第1段の表示がある");
}

console.log("project-cost-model: OK");
