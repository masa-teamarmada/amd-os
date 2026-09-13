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
// 2026-09-13 まさ指摘③: 「金属回収は1回しか無理。使えるのは色素分解だけ」— 金属回収の菌体使用回数は1回で固定する。
// 合計の作業工数と作業の流れ（段ごとの工数）を見せる。コストの内訳を棒グラフで常に見せる。
// オンサイトと、排液をSX工場まで運んで処理するオフサイトを比べられるようにする。
// 2026-09-14 まさ指摘④: 「方式がオンサイトとオフサイトの2種類になってない。循環と投入ってなに？」— 方式と装置を分ける。
// 「工数のほとんどが排液処理のところにかかってるけど、これは顧客側がやること。全顧客の工場にSXの社員が張り付くってありえない」
// — 作業に誰がやるかを持たせ、SX がやる作業だけを SX の原価に入れる。
//
// 正本: pwa/spec/5-13-project-cost-model-current-spec.md
// fixture: scripts/__fixtures__/sx_cost_model_two_stage.json（migration 399 適用後の SX データ）
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  METHODS,
  TASK_DRIVERS,
  TASK_PERFORMERS,
  computeBiomassCost,
  computeCostModel,
  computeTaskFlow,
  deriveCostBasis,
  resolvePerformer,
  rowAppliesTo,
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
  assert.ok(s.siteTaskPerUnit > 0, "SX がやる作業（巡回など）が総コストに入っている");
  for (const forbidden of ["totalWithoutLaborPerUnit", "profitWithoutLaborPerUnit", "laborPerUnit", "patrolPerUnit", "referenceLaborPerUnit"]) {
    assert.ok(!(forbidden in s), `「人件費を除くと」系の値 ${forbidden} を戻さない`);
  }
  // 処理の運転（直接投入）: 7.5時間 × 共通4,000円 × 300バッチ
  const run = taskAmount(task(fixture, "ct_run_injection"), fixture.assumptions, derived, { strain: "enhanced", application: "dye" });
  near(run.annual, 7.5 * 4000 * 300, 1e-6, "処理の運転 = 工数 × 共通の作業単価 × 年間バッチ数");
  assert.equal(run.usesCommonRate, true, "作業単価が空欄なら共通の作業単価");
  // 移動: 訪問回数 = 300 ÷ max(使用回数1, 1回の搬入でまかなう5) = 60、(2時間 × 4,000 + 車両費5,000) × 60
  const travel = taskAmount(task(fixture, "ct_travel"), fixture.assumptions, derived, { strain: "enhanced", application: "dye" });
  near(travel.occurrences, 60, 1e-9, "訪問回数");
  near(travel.annual, 60 * (2 * 4000 + 5000), 1e-6, "移動 = 訪問回数 × (工数 × 単価 + 1回の経費)");

  // 工数を2倍にすると、その分だけ作業費が増える（SX が運転するオフサイトで見る）
  const moreHours = clone();
  task(moreHours, "ct_run_injection").hoursPerOccurrence = 15;
  const offBase = scenario(fixture, "enhanced", "dye", "オフサイト-投入-新設");
  near(scenario(moreHours, "enhanced", "dye", "オフサイト-投入-新設").siteTaskPerUnit - offBase.siteTaskPerUnit, (7.5 * 4000 * 300) / derived.annualVolume, 1e-9, "工数2倍で運転の作業費が2倍");
  near(scenario(moreHours, "enhanced", "dye", "投入-既設").customerTaskHours - s.customerTaskHours, 7.5 * 300, 1e-9, "オンサイトでは顧客の工数が増える");
  near(scenario(moreHours, "enhanced", "dye", "投入-既設").totalPerUnit, s.totalPerUnit, 1e-9, "オンサイトでは顧客の運転の工数を増やしても SX の総コストは変わらない");
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

// 8. 仕様書の検証表と一致する（オンサイト・直接投入・既設槽）。2026-09-14 から処理の運転（7.5時間×300バッチ＝300円/m³）は顧客の作業で含まない
near(computeBiomassCost(fixture, "enhanced").perKg, 127.1, 0.05, "強化株 菌体原価");
near(computeBiomassCost(fixture, "wild").perKg, 98.5, 0.05, "自然株 菌体原価");
near(scenario(fixture, "enhanced", "dye", "投入-既設").totalPerUnit, 578.0, 0.05, "強化株 色素 オンサイト直接投入既設");
near(scenario(fixture, "enhanced", "metal", "投入-既設").totalPerUnit, 415.0, 0.05, "強化株 金属 オンサイト直接投入既設");
near(scenario(fixture, "wild", "dye", "投入-既設").totalPerUnit, 526.5, 0.05, "自然株 色素 オンサイト直接投入既設");
near(scenario(fixture, "wild", "metal", "投入-既設").totalPerUnit, 408.1, 0.05, "自然株 金属 オンサイト直接投入既設");

// 9. 株・用途・作業を持たない試算（LiSTie の部分試算など）でも落ちない
{
  const c = computeCostModel({ assumptions: [], items: [] });
  assert.deepEqual(c.strains, []);
  assert.deepEqual(c.applications, []);
  assert.deepEqual(c.locations, ["onsite"], "オフサイトの行が無い試算にはオフサイトを出さない");
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
  // 誰がやるかも下書きで変えられる。値は3つだけ
  const pf = setDraftValue({}, bundle, "task", "ct_run_injection", "performer", "sx");
  assert.deepEqual(draftToPatches(bundle, pf)[0].patch, { performer: "sx" }, "誰がやるかの patch は DB の列名");
  assert.equal(Object.keys(setDraftValue({}, bundle, "task", "ct_run_injection", "performer", "nobody")).length, 0, "誰がやるかは3つの値だけ");
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
    "../src/components/cockpit/CockpitCostModelFlow.tsx",
  ];
  const ui = files.map(read).join("\n");
  const main = read(files[0]);
  const results = read(files[2]);
  const controls = read(files[1]);
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
  // 2026-09-13 まさ指摘③
  assert.match(controls, /id: "cm-flow",\s*title: "作業の流れと工数"/, "操作パネルの一番上に作業の流れと工数");
  assert.ok(controls.indexOf('id: "cm-flow"') < controls.indexOf("...early"), "作業の流れは前提の節より前");
  assert.match(results, /作業工数/, "結果の欄に作業工数の合計");
  assert.match(results, /aria-label="内訳の棒グラフ"/, "結果の欄に内訳の棒グラフ");
  assert.match(results, /StackedBar/, "方式ごとの総コストを内訳の色で積んだ棒で並べる");
  assert.match(results, /LOCATION_SHORT_LABEL\[slot\.location\]/, "オンサイトとオフサイトを分けて並べる");
  // 2026-09-14 まさ指摘④
  assert.match(main, /label="方式"[\s\S]*locations\.map\(\(l\) => \(\{ value: l, label: LOCATION_SHORT_LABEL\[l\] \}\)\)/, "方式の切り替えはオンサイト / オフサイト");
  assert.match(main, /label="装置"[\s\S]*METHODS\.map\(\(m\) => \(\{ value: m, label: METHOD_LABEL\[m\] \}\)\)/, "装置の切り替えは循環カートリッジ / 直接投入");
  assert.match(main, /METHOD_DESCRIPTION\[selection\.method\]/, "装置が何かを一文で出す");
  assert.doesNotMatch(ui, /A:循環|B:投入|C:オフサイト/, "画面の文言に A:循環 / B:投入 / C:オフサイト を出さない");
  assert.match(controls, /誰がやるか/, "作業リストで誰がやるかを変えられる");
  assert.match(read(files[4]), /顧客がやる/, "作業の流れに顧客がやる作業を分けて出す");
  assert.match(results, /customerHours/, "結果の欄に顧客がやる作業の工数を出す");
  assert.match(controls, /METAL_SINGLE_USE_NOTE/, "金属回収は使用回数1回で固定と出す");
  assert.match(controls, /reuse_count" && application === "metal"/, "金属回収では使用回数の欄を出さない");
  const route = read("../src/app/api/project-cost-model/route.ts");
  for (const d of TASK_DRIVERS) assert.ok(route.includes(`"${d}"`), `API が回数の決め方 ${d} を受け付ける`);
  for (const pfv of TASK_PERFORMERS) assert.ok(route.includes(`"${pfv}"`), `API が誰がやるか ${pfv} を受け付ける`);
}

// 12. 金属回収の菌体使用回数は1回で固定。使い回せるのは色素分解だけ
{
  assert.ok(!fixture.assumptions.some((a) => a.roleKey === "reuse_count" && a.application === "metal"), "金属回収の使用回数の前提を置かない");
  const base = scenario(fixture, "wild", "metal", "投入-既設");
  const reuseRow = fixture.assumptions.find((a) => a.roleKey === "reuse_count");
  assert.ok(reuseRow, "色素分解の使用回数の前提がある");
  const withRows = clone();
  withRows.assumptions.push({ ...reuseRow, costAssumptionId: "x_metal_reuse", application: "metal", value: 5 });
  withRows.assumptions.push({ ...reuseRow, costAssumptionId: "x_common_reuse", application: null, value: 7 });
  near(scenario(withRows, "wild", "metal", "投入-既設").biomassKgPerUnit, base.biomassKgPerUnit, 1e-12, "金属回収は使用回数の前提があっても1回で数える");
  const derivedMetal = deriveCostBasis(withRows.assumptions, { strain: "wild", application: "metal" });
  assert.equal(derivedMetal.reuseCount, 1, "金属回収の使用回数は1");
  assert.equal(derivedMetal.reuseFixed, true, "金属回収は固定の印");
  assert.equal(deriveCostBasis(withRows.assumptions, { strain: "wild", application: "dye" }).reuseFixed, false, "色素分解は固定しない");
  const dye10 = clone();
  for (const a of dye10.assumptions) if (a.roleKey === "reuse_count" && a.application === "dye") a.value = 10;
  near(scenario(dye10, "wild", "metal", "投入-既設").totalPerUnit, base.totalPerUnit, 1e-9, "色素分解の使用回数は金属回収に効かない");
  assert.ok(scenario(dye10, "wild", "dye", "投入-既設").totalPerUnit < scenario(fixture, "wild", "dye", "投入-既設").totalPerUnit, "色素分解は使い回すと下がる");
}

// 13. 方式（オンサイト / オフサイト）× 装置（循環カートリッジ / 直接投入）
{
  const enh = computeCostModel(fixture, { strain: "enhanced" });
  assert.deepEqual(enh.locations, ["onsite", "offsite"], "方式はオンサイトとオフサイトの2つ");
  assert.equal(enh.scenarios.length, 12, "2用途 × (オンサイト 装置2×槽2 ＋ オフサイト 装置2)");
  const sel = { strain: "enhanced" as const, application: "dye" as const };
  const off = scenario(fixture, "enhanced", "dye", "オフサイト-投入-新設");
  assert.equal(off.location, "offsite");
  assert.ok(scenario(fixture, "enhanced", "dye", "オフサイト-循環-新設"), "オフサイトでも循環カートリッジを選べる");
  // 顧客工場への巡回と顧客工場内の区画・立入制限はオフサイトに乗らない。オフサイトの行はオンサイトに乗らない。装置の行は両方に乗る
  assert.ok(fixture.tasks.some((t) => t.scenario === "現場共通") && fixture.items.some((i) => i.scenario === "現場共通"), "現場共通の行がある");
  for (const r of [...fixture.tasks, ...fixture.items].filter((x) => x.scenario === "現場共通")) {
    const rsel = { strain: "enhanced" as const, application: r.application ?? ("dye" as const) };
    for (const m of METHODS) {
      assert.equal(rowAppliesTo(r, "offsite", m, rsel), false, "現場共通はオフサイトに乗らない");
      assert.equal(rowAppliesTo(r, "onsite", m, rsel), true, "現場共通はオンサイトに乗る");
    }
  }
  for (const r of [...fixture.tasks, ...fixture.items].filter((x) => x.scenario === "オフサイト")) {
    for (const m of METHODS) assert.equal(rowAppliesTo(r, "onsite", m, sel), false, "オフサイトの行はオンサイトに乗らない");
  }
  for (const r of fixture.items.filter((x) => x.scenario === "投入" || x.scenario === "循環")) {
    const rsel = { strain: "enhanced" as const, application: r.application ?? ("dye" as const) };
    const m = r.scenario as "投入" | "循環";
    assert.equal(rowAppliesTo(r, "onsite", m, rsel) && rowAppliesTo(r, "offsite", m, rsel), true, "装置の行はどちらの方式でも乗る");
    assert.equal(rowAppliesTo(r, "onsite", m === "投入" ? "循環" : "投入", rsel), false, "装置の行はもう一方の装置に乗らない");
  }
  // 運ぶ = 輸送の回数 × (工数 × 単価 + 経費)。輸送の回数 = 年間処理量 ÷ 1台の積載量
  const derived = deriveCostBasis(fixture.assumptions, sel);
  near(derived.truckTripsPerYear, 30000 / 10, 1e-9, "輸送の回数 = 年間処理量 ÷ 積載量");
  near(off.transportPerUnit, (3000 * (2.5 * 4000 + 10000)) / 30000, 1e-9, "運ぶ = 輸送の回数 × (工数 × 単価 + 経費) ÷ 年間処理量");
  const cap20 = clone();
  for (const a of cap20.assumptions) if (a.roleKey === "truck_capacity_m3") a.value = 20;
  near(scenario(cap20, "enhanced", "dye", "オフサイト-投入-新設").transportPerUnit, off.transportPerUnit / 2, 1e-9, "積載量2倍で運ぶ費用が半分");
  near(scenario(cap20, "enhanced", "dye", "投入-既設").totalPerUnit, scenario(fixture, "enhanced", "dye", "投入-既設").totalPerUnit, 1e-9, "輸送の前提はオンサイトに効かない");
  // 槽は SX工場に新設
  near(off.tankPerUnit, 18_000_000 / 10 / 30000, 1e-9, "オフサイトは槽の償却が必ず乗る");
  assert.ok(!enh.scenarios.some((x) => x.location === "offsite" && x.tankMode === "既設"), "オフサイトに既設の槽は無い");
  // 内訳の合計 = 総コスト、区分の中身の合計 = 区分の額
  for (const strain of ["enhanced", "wild"] as const) {
    for (const x of computeCostModel(fixture, { strain }).scenarios) {
      near(x.breakdown.reduce((t, b) => t + b.perUnit, 0), x.totalPerUnit, 1e-9, `${strain} ${x.key} 内訳の合計 = 総コスト`);
      for (const b of x.breakdown) near(b.parts.reduce((t, p) => t + p.perUnit, 0), b.perUnit, 1e-6, `${strain} ${x.key} ${b.key} の中身の合計`);
    }
  }
  // 仕様書の表と一致する（オフサイトは SX が運転するので 2026-09-14 の前後で不変）
  near(off.totalPerUnit, 3196.4, 0.05, "強化株 色素 オフサイト直接投入");
  near(scenario(fixture, "enhanced", "dye", "オフサイト-循環-新設").totalPerUnit, 3361.9, 0.05, "強化株 色素 オフサイト循環");
  near(scenario(fixture, "enhanced", "metal", "オフサイト-投入-新設").totalPerUnit, 3033.7, 0.05, "強化株 金属 オフサイト直接投入");
  near(scenario(fixture, "wild", "dye", "オフサイト-投入-新設").totalPerUnit, 3146.5, 0.05, "自然株 色素 オフサイト直接投入");
  near(scenario(fixture, "wild", "metal", "オフサイト-投入-新設").totalPerUnit, 3027.0, 0.05, "自然株 金属 オフサイト直接投入");
  near(scenario(fixture, "enhanced", "dye", "循環-既設").totalPerUnit, 813.5, 0.05, "強化株 色素 オンサイト循環既設");
}

// 15. 誰がやるか: SX がやる作業だけを SX の原価に入れる。顧客工場での処理の運転は顧客（オンサイト）、SX（オフサイト）
{
  const runs = fixture.tasks.filter((t) => t.costTaskId === "ct_run_circulation" || t.costTaskId === "ct_run_injection");
  assert.equal(runs.length, 2, "処理の運転の作業が2つある");
  for (const t of runs) {
    assert.equal(t.performer, "site", `${t.label} は処理する場所の人がやる`);
    assert.equal(resolvePerformer(t, "onsite"), "customer", "オンサイトでは顧客");
    assert.equal(resolvePerformer(t, "offsite"), "sx", "オフサイトでは SX");
  }
  for (const t of fixture.tasks.filter((x) => x.scenario === "中央培養")) {
    assert.equal(resolvePerformer({ ...t, performer: "customer" }, "onsite"), "sx", "製造拠点の作業は常に SX");
  }
  const on = scenario(fixture, "enhanced", "dye", "投入-既設");
  near(on.customerTaskHours, 7.5 * 300, 1e-9, "オンサイト直接投入の顧客の工数 = 7.5時間 × 300バッチ");
  near(on.customerTaskAnnual, 7.5 * 4000 * 300, 1e-6, "顧客の作業の参考年額");
  // SX が運転を請け負う形にすると、オンサイトでも運転の分だけ SX の原価に入る
  const sxRuns = clone();
  task(sxRuns, "ct_run_injection").performer = "sx";
  near(scenario(sxRuns, "enhanced", "dye", "投入-既設").totalPerUnit - on.totalPerUnit, (7.5 * 4000 * 300) / 30000, 1e-9, "SX が運転すると 300円/m³ 上がる");
  near(scenario(sxRuns, "enhanced", "dye", "投入-既設").customerTaskHours, 0, 1e-9, "顧客の工数は0");
  // 顧客に運転を任せる形にすると、オフサイトでも SX の原価から外れる
  const customerRuns = clone();
  task(customerRuns, "ct_run_injection").performer = "customer";
  const offRun = scenario(fixture, "enhanced", "dye", "オフサイト-投入-新設");
  near(offRun.totalPerUnit - scenario(customerRuns, "enhanced", "dye", "オフサイト-投入-新設").totalPerUnit, (7.5 * 4000 * 300) / 30000, 1e-9, "顧客に任せるとオフサイトでも 300円/m³ 下がる");
  // SX の作業工数（オンサイト直接投入）: 巡回 180 ＋ 膜交換 2.67 ＋ 閉鎖系の立入制限と教育 10（強化株）
  near(on.siteTaskHours, 192.7, 0.05, "強化株 色素 オンサイト直接投入 SX の作業工数（年）");
}

// 14. 作業の流れ: 段ごとの工数を足すと、方式の作業工数に一致する
{
  for (const strain of ["enhanced", "wild"] as const) {
    const c = computeCostModel(fixture, { strain });
    for (const application of ["dye", "metal"] as const) {
      for (const location of ["onsite", "offsite"] as const) {
        for (const method of METHODS) {
          const flow = computeTaskFlow(fixture, c, { application, location, method });
          const x = c.scenarios.find((y) => y.application === application && y.location === location && y.method === method && y.tankMode === "新設");
          assert.ok(x, `${strain} ${application} ${location} ${method}`);
          const label = `${strain} ${application} ${location} ${method}`;
          near(flow.siteHours, x.siteTaskHours, 1e-9, `${label} 流れの SX の工数 = 作業工数`);
          near(flow.customerHours, x.customerTaskHours, 1e-9, `${label} 流れの顧客の工数`);
          near(flow.siteAnnual, x.siteTaskAnnual, 1e-6, `${label} 流れの年額 = SX の作業の年額`);
          near(flow.sitePerUnit, x.siteTaskPerUnit, 1e-9, `${label} 流れの1単位 = SX の作業の1単位`);
          near(flow.productionHours, c.biomass.taskHoursAnnual, 1e-9, `${strain} 製造拠点の工数`);
          const orders = flow.steps.map((st) => Math.min(...st.rows.map((r) => r.task.sortOrder)));
          assert.deepEqual(orders, [...orders].sort((a, b) => a - b), "段は sort_order の順");
          const ids = flow.steps.flatMap((st) => st.rows.map((r) => r.task.costTaskId));
          assert.equal(new Set(ids).size, ids.length, "作業は1つの段に1回だけ");
        }
      }
    }
  }
  const c = computeCostModel(fixture, { strain: "enhanced" });
  const onFlow = computeTaskFlow(fixture, c, { application: "dye", location: "onsite", method: "投入" });
  assert.deepEqual(
    onFlow.steps.map((st) => st.label),
    ["菌体をつくる", "菌体を運ぶ", "排液を処理する", "設備を保つ", "使用済み菌体を後処理する", "閉鎖系を管理する（強化株のみ）"],
    "オンサイトの流れ"
  );
  assert.deepEqual(
    computeTaskFlow(fixture, c, { application: "dye", location: "offsite", method: "投入" }).steps.map((st) => st.label),
    ["菌体をつくる", "排液を運ぶ", "排液を処理する", "設備を保つ", "使用済み菌体を後処理する", "閉鎖系を管理する（強化株のみ）"],
    "オフサイトの流れ"
  );
  const treat = onFlow.steps.find((st) => st.label === "排液を処理する");
  assert.ok(treat && treat.rows.every((r) => r.performer === "customer") && treat.siteHours === 0 && treat.perUnit === 0, "オンサイトの処理の運転は顧客がやり、SX の工数と原価に入らない");
  const wildFlow = computeTaskFlow(fixture, computeCostModel(fixture, { strain: "wild" }), { application: "dye", location: "onsite", method: "投入" });
  assert.ok(!wildFlow.steps.some((st) => st.label.startsWith("閉鎖系")), "自然株に閉鎖系の管理の段は出ない");
  near(onFlow.siteHours, 192.7, 0.05, "強化株 色素 オンサイト直接投入 SX の作業工数（年）");
  near(onFlow.customerHours, 2250, 1e-9, "強化株 色素 オンサイト直接投入 顧客の作業工数（年）");
  near(computeTaskFlow(fixture, c, { application: "dye", location: "offsite", method: "投入" }).siteHours, 10052.7, 0.05, "強化株 色素 オフサイト直接投入 SX の作業工数（年）");
}

console.log("project-cost-model: OK");
