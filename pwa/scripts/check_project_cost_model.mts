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
// 2026-09-14 まさ指摘⑤: 顧客側に残る運転の時間は「知ったこっちゃなくない？SXのコストに含まれないじゃん」
// — 顧客がやる作業の時間や円は、計算にも画面にも出さない。
// 2026-09-14 まさ指摘⑥:「繰り返し使える色素分解の方が金属回収より高いのが変。もともと10回使える前提でしょ？」
// 「リアクターは顧客が買う前提だよ」「汚泥の処理単価とかあるけど、これは顧客側がやることじゃないの？」
// — 明細に誰が持つか (bearer) を持たせ、SX が持つ明細だけを SX の原価に入れる。オンサイトの槽を持つのは前提で持つ。
// 2026-09-14 まさ指摘⑦:「年間の生産能力は入力値じゃなくて計算結果にしてほしい。入力は、年間何立米の廃水を処理するか、にして」
// 「この計算はIPOできるレベルの大量生産状態を前提にしたいので、売上100億到達レベルを前提にしたパラメータにして」
// — 年に作る量 = 年間処理量 × 使い切る菌体量 ÷ 販売率。製造拠点の明細を培養設備の1系列として、必要な数だけ並べる。
//
// 正本: pwa/spec/5-13-project-cost-model-current-spec.md
// fixture: scripts/__fixtures__/sx_cost_model_two_stage.json（migration 405 適用後の SX データ）
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ITEM_BEARERS,
  METHODS,
  PRODUCTION_TASK_DRIVERS,
  TASK_DRIVERS,
  TASK_PERFORMERS,
  TEXT_CHOICE_ROLES,
  biomassOf,
  computeBiomassCost,
  computeCostModel,
  computeTaskFlow,
  deriveCostBasis,
  resolveBearer,
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
/** 年間処理量の前提を外し、年間生産能力を入力として持つ「これまでの形」に戻す（系列は1つ、製造拠点の作業は固定の回数）。 */
const capacityShape = (bundle: CostModelBundle): CostModelBundle => {
  const b: CostModelBundle = JSON.parse(JSON.stringify(bundle));
  b.assumptions = b.assumptions.filter((a) => a.roleKey !== "business_annual_volume");
  for (const a of b.assumptions) if (a.roleKey === "culture_line_capacity_kg_year") a.roleKey = "culture_capacity_kg_year";
  for (const t of b.tasks ?? []) if (t.countDriver === "production_line") t.countDriver = "fixed";
  return b;
};
const task = (bundle: CostModelBundle, id: string) => {
  const t = bundle.tasks.find((x) => x.costTaskId === id);
  assert.ok(t, `task ${id}`);
  return t;
};

// 1. 旧版と同じ条件へ戻すと、260820版の検証値（原典スプレッドシート一致済み）に戻る
{
  const legacy = capacityShape(fixture); // 旧版は菌体の製造拠点の年間生産能力を入力として持っていた
  for (const a of legacy.assumptions) if (a.roleKey === "uptake_alpha" && a.application === "metal" && a.strain === "wild") a.value = 0.05;
  legacy.tasks = []; // 人件費と巡回は旧版に無い（閉鎖系の作業は強化株のみで、自然株には元から乗らない）
  for (const i of legacy.items) i.bearer = "sx"; // 旧版は設備も槽も SX の原価に入れていた
  for (const a of legacy.assumptions) if (a.roleKey === "onsite_tank_bearer") a.valueText = "sx";
  for (const i of legacy.items) {
    if (i.costItemId === "ci_260820_133") i.unitPrice = 5;
    if (i.costItemId === "ci_260820_141") i.unitPrice = 4;
  }
  const expected: Record<string, number> = { "循環-既設": 582.4, "循環-新設": 642.4, "投入-既設": 349.7, "投入-新設": 409.7 };
  for (const [key, want] of Object.entries(expected)) near(scenario(legacy, "wild", "metal", key).totalPerUnit, want, 0.05, `旧版再現 ${key}`);
}

// 2. 第2段の菌体費 ÷ 使った菌体量 ＝ その用途の第1段の原価。用途で違うのは、拠点に1つの作業が作る量で薄まる分だけ
for (const strain of ["enhanced", "wild"] as const) {
  const c = computeCostModel(fixture, { strain });
  for (const s of c.scenarios) {
    const perKg = computeBiomassCost(fixture, strain, s.application).perKg;
    assert.ok(perKg > 0, `${strain} 第1段の原価が出ている`);
    near(s.centralTotalPerUnit / s.biomassKgPerUnit, perKg, 1e-6, `${strain} ${s.key} の菌体1kg原価が第1段と一致`);
    near(biomassOf(c, s.application).perKg, perKg, 1e-12, `${strain} ${s.key} 画面が引く第1段も同じ`);
  }
  const dye = computeBiomassCost(fixture, strain, "dye");
  const metal = computeBiomassCost(fixture, strain, "metal");
  near(dye.perKg - dye.siteTasksAnnual / dye.soldKgYear, metal.perKg - metal.siteTasksAnnual / metal.soldKgYear, 1e-9, `${strain} 拠点に1つの作業を除けば、1kgあたりの原価は用途で同じ`);
}

// 3. 強化株は閉鎖系の追加費用で自然株より高い。自然株には強化株の行が1円も乗らない
{
  const enh = computeBiomassCost(fixture, "enhanced", "dye");
  const wild = computeBiomassCost(fixture, "wild", "dye");
  assert.ok(enh.perKg > wild.perKg, "強化株の菌体原価 > 自然株");
  assert.ok(enh.strainSpecificPerKg > 0, "強化株に株固有の行が乗る");
  assert.equal(wild.strainSpecificPerKg, 0, "自然株に強化株の行は乗らない");
  assert.ok(enh.tasksAnnual > 0 && wild.tasksAnnual === 0, "製造拠点の作業（閉鎖系）は強化株だけ");
  for (const s of computeCostModel(fixture, { strain: "wild" }).scenarios) assert.equal(s.strainSpecificPerUnit, 0, `自然株 ${s.key} に閉鎖系の追加費用なし`);
}

// 4. 菌体使用回数を2倍にすると、菌体費は半分になる（旧版の頭打ちを戻さない）。
//    年に作る量も半分になるので、拠点に1つの作業（強化株の安全委員会）だけは1m³あたり変わらない
{
  const doubled = clone();
  for (const a of doubled.assumptions) if (a.roleKey === "reuse_count" && a.application === "dye") a.value = (a.value ?? 1) * 2;
  const wildBase = scenario(fixture, "wild", "dye", "投入-既設");
  const wildTwice = scenario(doubled, "wild", "dye", "投入-既設");
  near(wildTwice.centralTotalPerUnit, wildBase.centralTotalPerUnit / 2, 1e-6, "拠点に1つの作業が無い自然株は、使用回数2倍で菌体費がちょうど半分");
  const base = scenario(fixture, "enhanced", "dye", "投入-既設");
  const twice = scenario(doubled, "enhanced", "dye", "投入-既設");
  const bio = computeBiomassCost(fixture, "enhanced", "dye");
  const sitePerUnit = bio.siteTasksAnnual / bio.businessVolume;
  assert.ok(sitePerUnit > 0, "強化株には拠点に1つの作業がある");
  near(twice.centralTotalPerUnit, (base.centralTotalPerUnit - sitePerUnit) / 2 + sitePerUnit, 1e-6, "強化株は、拠点に1つの作業を除いた菌体費が半分");
  near(twice.biomassKgPerUnit, base.biomassKgPerUnit / 2, 1e-9, "使用回数2倍で菌体量が半分");
  const capBase = scenario(capacityShape(fixture), "enhanced", "dye", "投入-既設");
  near(scenario(capacityShape(doubled), "enhanced", "dye", "投入-既設").centralTotalPerUnit, capBase.centralTotalPerUnit / 2, 1e-6, "年間生産能力を入力で持つ形では、ちょうど半分");
}

// 5. 用途の行は他の用途に混ざらない（色素分解に酸処理は乗らない。金属回収に汚泥処分は乗らない）
{
  const metalItems = new Set(fixture.items.filter((i) => i.application === "metal").map((i) => i.costItemId));
  assert.ok(fixture.items.some((i) => i.application === "dye") && metalItems.size > 0, "用途別の行がある");
  const dye = scenario(fixture, "wild", "dye", "投入-既設");
  const metal = scenario(fixture, "wild", "metal", "投入-既設");
  // 色素分解の汚泥の処分は、オンサイトでは顧客が持つので SX工場で処理するオフサイトで見る
  assert.ok(scenario(fixture, "wild", "dye", "オフサイト-投入-新設").postProcessPerUnit > 0 && metal.postProcessPerUnit > 0, "両用途に後処理がある");
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
  // 移動: 訪問回数 = 300 ÷ max(色素分解の使用回数10, 1回の搬入でまかなう5) = 30、(2時間 × 4,000 + 車両費5,000) × 30
  const travel = taskAmount(task(fixture, "ct_travel"), fixture.assumptions, derived, { strain: "enhanced", application: "dye" });
  near(travel.occurrences, 30, 1e-9, "訪問回数");
  near(travel.annual, 30 * (2 * 4000 + 5000), 1e-6, "移動 = 訪問回数 × (工数 × 単価 + 1回の経費)");

  // 工数を2倍にすると、その分だけ作業費が増える（SX が運転するオフサイトで見る）
  const moreHours = clone();
  task(moreHours, "ct_run_injection").hoursPerOccurrence = 15;
  const offBase = scenario(fixture, "enhanced", "dye", "オフサイト-投入-新設");
  near(scenario(moreHours, "enhanced", "dye", "オフサイト-投入-新設").siteTaskPerUnit - offBase.siteTaskPerUnit, (7.5 * 4000 * 300) / derived.annualVolume, 1e-9, "工数2倍で運転の作業費が2倍");
  near(scenario(moreHours, "enhanced", "dye", "投入-既設").totalPerUnit, s.totalPerUnit, 1e-9, "オンサイトでは顧客の運転の工数を増やしても SX の総コストは変わらない");
  near(scenario(moreHours, "enhanced", "dye", "投入-既設").siteTaskHours, s.siteTaskHours, 1e-9, "オンサイトでは顧客の運転の工数を増やしても SX の作業工数は変わらない");
  // 行に作業単価を入れると共通の単価より優先する。共通の単価を変えても、その行は動かない
  const ownRate = clone();
  task(ownRate, "ct_run_injection").hourlyRate = 6000;
  for (const a of ownRate.assumptions) if (a.roleKey === "labor_rate") a.value = 5000;
  const ownRun = taskAmount(task(ownRate, "ct_run_injection"), ownRate.assumptions, derived, { strain: "enhanced", application: "dye" });
  near(ownRun.annual, 7.5 * 6000 * 300, 1e-6, "行の作業単価が優先");
  near(taskAmount(task(ownRate, "ct_delivery"), ownRate.assumptions, derived, { strain: "enhanced", application: "dye" }).annual, 30 * 1 * 5000, 1e-6, "単価が空欄の行は共通の作業単価に連動");
  // 工数が空欄（未確認）の行は0時間。経費だけが乗る
  const integrity = taskAmount(task(fixture, "ct_s_integrity_test"), fixture.assumptions, derived, { strain: "enhanced", application: "dye" });
  assert.equal(task(fixture, "ct_s_integrity_test").hoursPerOccurrence, null, "工数未確認の行は空欄");
  near(integrity.annual, 150000, 1e-6, "工数空欄は0時間として数え、経費だけ乗る");
  // 製造拠点の作業は第1段の固定費に入る（生産量で割って1kgあたり）
  const enh = computeBiomassCost(fixture, "enhanced", "dye");
  near(enh.rows.find((r) => r.key === "tasks")!.perKg, enh.tasksAnnual / enh.capacityKgYear, 1e-9, "製造拠点の作業 ÷ 年に作る量");
  near(enh.tasksAnnual, enh.lineTasksAnnual + enh.siteTasksAnnual, 1e-6, "製造拠点の作業 = 系列ごと + 拠点に1つ");
  // 内訳を足すと総コストになる
  for (const strain of ["enhanced", "wild"] as const) {
    for (const x of computeCostModel(fixture, { strain }).scenarios) {
      near(x.breakdown.reduce((t, b) => t + b.perUnit, 0), x.totalPerUnit, 1e-9, `${strain} ${x.key} 内訳の合計 = 総コスト`);
    }
  }
}

// 7. 販売率: 売れ残りも作った分の費用はかかるので、第1段の全費用を売れた量で割る。
//    年間処理量から出す形では、売る量は変わらず作る量が増える（系列ごとの費用と比例費は増え、拠点に1つの作業は増えない）
{
  const rate = (bundle: CostModelBundle, pctValue: number) => {
    const b: CostModelBundle = JSON.parse(JSON.stringify(bundle));
    const row = b.assumptions.find((a) => a.roleKey === "sales_rate");
    assert.ok(row, "販売率の前提がある");
    row.value = pctValue;
    return b;
  };
  const full = computeBiomassCost(fixture, "enhanced", "dye");
  const half = computeBiomassCost(rate(fixture, 50), "enhanced", "dye");
  near(full.salesRate, 1, 1e-12, "既定は全量が売れる100%");
  near(half.soldKgYear, full.soldKgYear, 1e-6, "売る量（年間処理量 × 使い切る菌体量）は販売率で変わらない");
  near(half.capacityKgYear, full.capacityKgYear * 2, 1e-6, "販売率50%なら、売る量をまかなうために作る量が2倍");
  near(half.soldKgYear, half.capacityKgYear * 0.5, 1e-9, "売れる量 = 年に作る量 × 販売率");
  for (const key of ["capex", "fixed", "variable"]) {
    near(half.rows.find((r) => r.key === key)!.perKg, full.rows.find((r) => r.key === key)!.perKg * 2, 1e-9, `販売率50%で ${key} の行は2倍`);
  }
  near(half.lineTasksAnnual, full.lineTasksAnnual * 2, 1e-6, "系列ごとの作業は作る量に合わせて2倍");
  near(half.siteTasksAnnual, full.siteTasksAnnual, 1e-9, "拠点に1つの作業は増えない");
  near(
    half.rows.find((r) => r.key === "tasks")!.perKg,
    full.rows.find((r) => r.key === "tasks")!.perKg * 2 - full.siteTasksAnnual / full.soldKgYear,
    1e-9,
    "製造拠点の作業の行は、系列ごとの分だけ2倍"
  );
  // 年間生産能力を入力で持つ形では、これまでどおり全行がちょうど2倍
  const fullCap = computeBiomassCost(capacityShape(fixture), "enhanced", "dye");
  const halfCap = computeBiomassCost(rate(capacityShape(fixture), 50), "enhanced", "dye");
  near(halfCap.perKg, fullCap.perKg * 2, 1e-9, "年間生産能力を入力で持つ形は、販売率50%で菌体1kgの原価が2倍");
  for (const key of ["capex", "fixed", "tasks", "variable"]) {
    near(halfCap.rows.find((r) => r.key === key)!.perKg, fullCap.rows.find((r) => r.key === key)!.perKg * 2, 1e-9, `年間生産能力を入力で持つ形は ${key} の行も2倍`);
  }
  near(halfCap.soldKgYear, fullCap.capacityKgYear * 0.5, 1e-9, "年間生産能力を入力で持つ形: 売れる量 = 生産能力 × 販売率");
  near(computeBiomassCost(rate(fixture, 0), "enhanced", "dye").salesRate, 0.01, 1e-12, "販売率は1%より下げない（0で割らない）");
  const noRow = clone();
  noRow.assumptions = noRow.assumptions.filter((a) => a.roleKey !== "sales_rate");
  near(computeBiomassCost(noRow, "enhanced", "dye").perKg, full.perKg, 1e-9, "販売率の前提が無い試算は100%と同じ");
  // 上書き値も販売率で割る
  const over = rate(fixture, 50);
  for (const a of over.assumptions) if (a.roleKey === "biomass_cost_per_kg_override") a.value = 400;
  near(computeBiomassCost(over, "enhanced", "dye").perKg, 800, 1e-9, "上書き値 ÷ 販売率");
}

// 8. 仕様書の検証表と一致する（オンサイト・直接投入・顧客の槽）。2026-09-14 から処理の運転は顧客の作業、リアクターと槽は顧客が買い、
//    色素分解の汚泥の処分は顧客がやる。色素分解の菌体使用回数は10回
//    年間処理量は2,000万m³（売上100億円）。年に作る量から培養設備の系列数を出す
near(computeBiomassCost(fixture, "enhanced", "dye").perKg, 120.1, 0.05, "強化株 菌体原価（色素分解で年に作る量）");
near(computeBiomassCost(fixture, "enhanced", "metal").perKg, 120.0, 0.05, "強化株 菌体原価（金属回収で年に作る量）");
near(computeBiomassCost(fixture, "wild", "dye").perKg, 98.5, 0.05, "自然株 菌体原価");
near(scenario(fixture, "enhanced", "dye", "投入-既設").totalPerUnit, 101.8, 0.05, "強化株 色素 オンサイト直接投入");
near(scenario(fixture, "enhanced", "metal", "投入-既設").totalPerUnit, 289.5, 0.05, "強化株 金属 オンサイト直接投入");
near(scenario(fixture, "wild", "dye", "投入-既設").totalPerUnit, 81.1, 0.05, "自然株 色素 オンサイト直接投入");
near(scenario(fixture, "wild", "metal", "投入-既設").totalPerUnit, 291.5, 0.05, "自然株 金属 オンサイト直接投入");
assert.ok(
  scenario(fixture, "enhanced", "dye", "投入-既設").totalPerUnit < scenario(fixture, "enhanced", "metal", "投入-既設").totalPerUnit,
  "使い回せる色素分解は、使い捨ての金属回収より安い（まさ 2026-09-14）"
);

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
  const lineDraft = setDraftValue({}, bundle, "task", "ct_c_safety_committee", "countDriver", "production_line");
  assert.deepEqual(draftToPatches(bundle, lineDraft)[0].patch, { count_driver: "production_line", count_per_year: 1 }, "培養設備の系列ごとへ変えると、1系列あたりの年間回数も送る");
  // 誰がやるかも下書きで変えられる。値は3つだけ
  const pf = setDraftValue({}, bundle, "task", "ct_run_injection", "performer", "sx");
  assert.deepEqual(draftToPatches(bundle, pf)[0].patch, { performer: "sx" }, "誰がやるかの patch は DB の列名");
  assert.equal(Object.keys(setDraftValue({}, bundle, "task", "ct_run_injection", "performer", "nobody")).length, 0, "誰がやるかは3つの値だけ");
  // 明細の誰が持つかと、選択肢から選ぶ前提も下書きで変えられる
  const bearerDraft = setDraftValue({}, bundle, "item", "ci_260820_092", "bearer", "sx");
  assert.deepEqual(draftToPatches(bundle, bearerDraft)[0].patch, { bearer: "sx" }, "誰が持つかの patch は DB の列名");
  assert.equal(Object.keys(setDraftValue({}, bundle, "item", "ci_260820_092", "bearer", "nobody")).length, 0, "誰が持つかは3つの値だけ");
  const tankDraft = setDraftValue({}, bundle, "assumption", "ca5_onsite_tank_bearer", "valueText", "sx");
  assert.deepEqual(draftToPatches(bundle, tankDraft)[0].patch, { value_text: "sx" }, "槽を持つのはの patch は value_text");
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
  assert.match(read(files[4]), /顧客がやる/, "作業の流れで顧客がやる作業に札を付ける");
  // 2026-09-14 まさ指摘⑤: 顧客側に残る運転の時間について「知ったこっちゃなくない？SXのコストに含まれないじゃん」
  // 顧客がやる作業の時間や円は、計算にも画面にも出さない。
  assert.doesNotMatch(ui, /customerHours|customerTask|顧客がやる作業の工数|顧客 年/, "顧客がやる作業の時間を画面に出さない");
  const engine = read("../src/lib/project-cost-model.ts");
  assert.doesNotMatch(engine, /customerHours|customerTask/, "計算エンジンは顧客がやる作業の時間・参考の年額を持たない");
  assert.match(controls, /METAL_SINGLE_USE_NOTE/, "金属回収は使用回数1回で固定と出す");
  assert.match(controls, /reuse_count" && application === "metal"/, "金属回収では使用回数の欄を出さない");
  const route = read("../src/app/api/project-cost-model/route.ts");
  for (const d of TASK_DRIVERS) assert.ok(route.includes(`"${d}"`), `API が回数の決め方 ${d} を受け付ける`);
  for (const pfv of TASK_PERFORMERS) assert.ok(route.includes(`"${pfv}"`), `API が誰がやるか ${pfv} を受け付ける`);
  // 2026-09-14 まさ指摘⑥
  assert.match(route, /ITEM_FIELDS = new Set\(\[[^\]]*"bearer"/, "API が明細の誰が持つかを書き込める");
  assert.match(controls, /誰が持つか/, "明細で誰が持つかを変えられる");
  assert.match(controls, /TEXT_CHOICE_ROLES/, "槽を持つのはを選択肢で選べる");
  assert.match(main, /顧客の設備/, "オンサイトの槽を顧客が持つときは、槽の切り替えの代わりに「顧客の設備」と出す");
  assert.match(read(files[3]), /誰が持つか/, "読み物の費用明細に誰が持つかの列");
  assert.match(read(files[3]), /SXの原価はオフサイトだけ（オンサイトは顧客）/, "精度を下げている項目で、オンサイトは顧客が持つ行にそう添える");
  // 2026-09-14 まさ指摘⑦
  assert.match(controls, /business_annual_volume/, "年間処理量から売上・顧客数・年に作る量を出す");
  assert.match(controls, /PRODUCTION_TASK_DRIVERS/, "製造拠点の作業は、固定の回数か培養設備の系列ごとを選べる");
  assert.doesNotMatch(controls, /disabled=\{isCentral\}/, "製造拠点の作業の回数の決め方を固定の回数に縛らない");
  assert.match(results, /cost-production-scale/, "結果の欄に年に作る量・培養設備の系列数・初期投資");
  assert.match(results, /事業全体の年間/, "結果の欄に事業全体の年間の売上・総コスト・利益");
  assert.doesNotMatch(ui, /菌体の製造拠点の年間生産能力/, "年間生産能力を入力として出さない");
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
  const dye20 = clone();
  for (const a of dye20.assumptions) if (a.roleKey === "reuse_count" && a.application === "dye") a.value = 20;
  near(scenario(dye20, "wild", "metal", "投入-既設").totalPerUnit, base.totalPerUnit, 1e-9, "色素分解の使用回数は金属回収に効かない");
  assert.ok(scenario(dye20, "wild", "dye", "投入-既設").totalPerUnit < scenario(fixture, "wild", "dye", "投入-既設").totalPerUnit, "色素分解は使い回すと下がる");
  assert.equal(fixture.assumptions.find((a) => a.roleKey === "reuse_count" && a.application === "dye")?.value, 10, "色素分解の使用回数は10回（2026-07 の設備アドオン試算と同じ前提。まさ 2026-09-14）");
}

// 13. 方式（オンサイト / オフサイト）× 装置（循環カートリッジ / 直接投入）
{
  const enh = computeCostModel(fixture, { strain: "enhanced" });
  assert.deepEqual(enh.locations, ["onsite", "offsite"], "方式はオンサイトとオフサイトの2つ");
  assert.equal(enh.onsiteTankBearer, "customer", "オンサイトの槽は顧客が持つ");
  assert.equal(enh.scenarios.length, 8, "2用途 × (オンサイト 装置2 ＋ オフサイト 装置2)。オンサイトの槽を顧客が持つので槽の2通りは無い");
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
  // 仕様書の表と一致する（年間処理量2,000万m³で年に作る量から出した菌体原価）
  near(off.totalPerUnit, 2880.0, 0.05, "強化株 色素 オフサイト直接投入");
  near(scenario(fixture, "enhanced", "dye", "オフサイト-循環-新設").totalPerUnit, 2815.4, 0.05, "強化株 色素 オフサイト循環（処理の運転は画面から顧客で保存）");
  near(scenario(fixture, "enhanced", "metal", "オフサイト-投入-新設").totalPerUnit, 3026.1, 0.05, "強化株 金属 オフサイト直接投入");
  near(scenario(fixture, "wild", "dye", "オフサイト-投入-新設").totalPerUnit, 2859.6, 0.05, "自然株 色素 オフサイト直接投入");
  near(scenario(fixture, "wild", "metal", "オフサイト-投入-新設").totalPerUnit, 3027.0, 0.05, "自然株 金属 オフサイト直接投入");
  near(scenario(fixture, "enhanced", "dye", "循環-既設").totalPerUnit, 381.6, 0.05, "強化株 色素 オンサイト循環");
}

// 15. 誰がやるか: SX がやる作業だけを SX の原価に入れる。顧客工場での処理の運転は顧客（オンサイト）、SX（オフサイト）
{
  const runs = fixture.tasks.filter((t) => t.costTaskId === "ct_run_circulation" || t.costTaskId === "ct_run_injection");
  assert.equal(runs.length, 2, "処理の運転の作業が2つある");
  assert.equal(task(fixture, "ct_run_injection").performer, "site", "直接投入の処理の運転は処理する場所の人がやる");
  for (const t of runs) {
    assert.equal(resolvePerformer(t, "onsite"), "customer", `${t.label} はオンサイトでは顧客`);
    assert.equal(resolvePerformer({ ...t, performer: "site" }, "offsite"), "sx", "場所によるはオフサイトでは SX");
    assert.equal(resolvePerformer({ ...t, performer: "customer" }, "offsite"), "customer", "顧客はオフサイトでも顧客");
  }
  for (const t of fixture.tasks.filter((x) => x.scenario === "中央培養")) {
    assert.equal(resolvePerformer({ ...t, performer: "customer" }, "onsite"), "sx", "製造拠点の作業は常に SX");
  }
  const on = scenario(fixture, "enhanced", "dye", "投入-既設");
  // SX が運転を請け負う形にすると、オンサイトでも運転の分だけ SX の原価と作業工数に入る
  const sxRuns = clone();
  task(sxRuns, "ct_run_injection").performer = "sx";
  near(scenario(sxRuns, "enhanced", "dye", "投入-既設").totalPerUnit - on.totalPerUnit, (7.5 * 4000 * 300) / 30000, 1e-9, "SX が運転すると 300円/m³ 上がる");
  near(scenario(sxRuns, "enhanced", "dye", "投入-既設").siteTaskHours - on.siteTaskHours, 7.5 * 300, 1e-9, "SX が運転すると SX の作業工数に 7.5時間 × 300バッチ が入る");
  // 顧客に運転を任せる形にすると、オフサイトでも SX の原価から外れる
  const customerRuns = clone();
  task(customerRuns, "ct_run_injection").performer = "customer";
  const offRun = scenario(fixture, "enhanced", "dye", "オフサイト-投入-新設");
  near(offRun.totalPerUnit - scenario(customerRuns, "enhanced", "dye", "オフサイト-投入-新設").totalPerUnit, (7.5 * 4000 * 300) / 30000, 1e-9, "顧客に任せるとオフサイトでも 300円/m³ 下がる");
  // SX の作業工数（強化株・色素・オンサイト直接投入）: 巡回 90（訪問30回 × 3時間）＋ 膜交換 2.67 ＋ 閉鎖系の立入制限と教育 10
  near(on.siteTaskHours, 102.7, 0.05, "強化株 色素 オンサイト直接投入 SX の作業工数（年）");
}

// 14. 作業の流れ: 段ごとの工数を足すと、方式の作業工数に一致する
{
  for (const strain of ["enhanced", "wild"] as const) {
    const c = computeCostModel(fixture, { strain });
    for (const application of ["dye", "metal"] as const) {
      for (const location of ["onsite", "offsite"] as const) {
        for (const method of METHODS) {
          const flow = computeTaskFlow(fixture, c, { application, location, method });
          const x = c.scenarios.find((y) => y.application === application && y.location === location && y.method === method);
          assert.ok(x, `${strain} ${application} ${location} ${method}`);
          const label = `${strain} ${application} ${location} ${method}`;
          near(flow.siteHours, x.siteTaskHours, 1e-9, `${label} 流れの SX の工数 = 作業工数`);
          near(flow.siteAnnual, x.siteTaskAnnual, 1e-6, `${label} 流れの年額 = SX の作業の年額`);
          near(flow.sitePerUnit, x.siteTaskPerUnit, 1e-9, `${label} 流れの1単位 = SX の作業の1単位`);
          near(flow.productionHours, biomassOf(c, application).taskHoursAnnual, 1e-9, `${strain} ${application} 製造拠点の工数（この用途で年に作る量の系列数で数える）`);
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
  // 顧客がやる作業は、工数が空欄でも「工数未確認」に数えない
  const unknownRun = clone();
  task(unknownRun, "ct_run_injection").hoursPerOccurrence = null;
  const unknownFlow = computeTaskFlow(unknownRun, computeCostModel(unknownRun, { strain: "enhanced" }), { application: "dye", location: "onsite", method: "投入" });
  assert.equal(unknownFlow.unknownCount, onFlow.unknownCount, "顧客がやる作業の空欄は工数未確認に数えない");
  const wildFlow = computeTaskFlow(fixture, computeCostModel(fixture, { strain: "wild" }), { application: "dye", location: "onsite", method: "投入" });
  assert.ok(!wildFlow.steps.some((st) => st.label.startsWith("閉鎖系")), "自然株に閉鎖系の管理の段は出ない");
  near(onFlow.siteHours, 102.7, 0.05, "強化株 色素 オンサイト直接投入 SX の作業工数（年）");
  near(computeTaskFlow(fixture, c, { application: "dye", location: "offsite", method: "投入" }).siteHours, 10052.7, 0.05, "強化株 色素 オフサイト直接投入 SX の作業工数（年）");
}

// 16. 誰が持つか: SX が持つ明細だけを SX の原価に入れる。顧客工場のリアクターと汚泥の処分は処理する場所の持ち主、オンサイトの槽は前提
{
  const onsiteScopes = new Set(["循環", "投入", "共通", "現場共通"]);
  const reactor = fixture.items.filter((i) => i.costType === "CAPEX" && onsiteScopes.has(i.scenario));
  assert.ok(reactor.length >= 20 && reactor.every((i) => i.bearer === "site"), "顧客工場に置くリアクター（オンサイトで効く CAPEX）は処理する場所の持ち主");
  assert.equal(fixture.items.find((i) => i.costItemId === "ci2_dye_disposal")?.bearer, "site", "色素分解の汚泥の処分は処理する場所の持ち主");
  assert.ok(fixture.items.filter((i) => i.scenario === "中央培養").every((i) => i.bearer === "sx"), "菌体の製造拠点の明細は SX");
  assert.equal(task(fixture, "ct4_post_dye").performer, "site", "色素分解の脱水と処分の手配は処理する場所の人");
  for (const b of ITEM_BEARERS) assert.ok(b in { sx: 1, customer: 1, site: 1 }, `誰が持つかの値 ${b}`);
  const sample = reactor[0];
  assert.equal(resolveBearer({ ...sample, bearer: "site" }, "onsite"), "customer", "場所によるはオンサイトで顧客");
  assert.equal(resolveBearer({ ...sample, bearer: "site" }, "offsite"), "sx", "場所によるはオフサイトで SX");
  assert.equal(resolveBearer({ ...sample, bearer: "customer" }, "offsite"), "customer", "顧客はどこでも顧客");
  assert.equal(resolveBearer({ ...sample, scenario: "中央培養", bearer: "customer" }, "onsite"), "sx", "製造拠点の明細は常に SX");
  assert.ok(TEXT_CHOICE_ROLES.onsite_tank_bearer?.some((c) => c.value === "customer"), "槽を持つのはを選択肢で持つ");

  const on = scenario(fixture, "enhanced", "dye", "投入-既設");
  const onMetal = scenario(fixture, "enhanced", "metal", "投入-既設");
  near(on.breakdown.find((b) => b.key === "capex")!.perUnit, 0, 1e-9, "オンサイトはリアクターと槽の償却が SX の原価に乗らない");
  near(on.breakdown.find((b) => b.key === "postProcess")!.perUnit, 0, 1e-9, "オンサイトの色素分解は汚泥の処分が SX の原価に乗らない");
  assert.ok(onMetal.breakdown.find((b) => b.key === "postProcess")!.perUnit > 0, "金属回収の酸処理は SX が持つ");
  const offDye = scenario(fixture, "enhanced", "dye", "オフサイト-投入-新設");
  assert.ok(offDye.breakdown.find((b) => b.key === "capex")!.perUnit > 60, "オフサイトは SX工場の設備と槽の償却が乗る");
  near(offDye.breakdown.find((b) => b.key === "postProcess")!.perUnit, 19.4, 0.05, "オフサイトの色素分解は SX工場で出る汚泥の処分が乗る");

  // SX が設備・槽・処分を持つ形に戻すと、その分だけ上がる（使用回数10回、年間処理量2,000万m³）
  const sxOwns = clone();
  for (const i of sxOwns.items) i.bearer = "sx";
  for (const a of sxOwns.assumptions) if (a.roleKey === "onsite_tank_bearer") a.valueText = "sx";
  near(scenario(sxOwns, "enhanced", "dye", "投入-既設").totalPerUnit, 239.2, 0.05, "SX が持つ形の色素分解");
  near(scenario(sxOwns, "enhanced", "metal", "投入-既設").totalPerUnit, 407.4, 0.05, "SX が持つ形の金属回収");
  near(scenario(capacityShape(sxOwns), "enhanced", "dye", "投入-既設").totalPerUnit, 240.0, 0.05, "年間生産能力を入力で持つ形では 2026-09-14 の直前の数字（240.0）");
  const sxTank = computeCostModel(sxOwns, { strain: "enhanced" });
  assert.equal(sxTank.scenarios.length, 12, "槽を SX が持つと、オンサイトは既設と新設の2通りに戻る");
  near(scenario(sxOwns, "enhanced", "dye", "投入-新設").totalPerUnit - scenario(sxOwns, "enhanced", "dye", "投入-既設").totalPerUnit, 18_000_000 / 10 / 30000, 1e-9, "新設の槽は60円/m³");
  // 1行だけ顧客に移すと、その行の額だけ下がる
  const oneRow = clone();
  const skid = oneRow.items.find((i) => i.costItemId === "ci_260820_092")!;
  skid.bearer = "customer";
  const offBefore = scenario(fixture, "enhanced", "dye", "オフサイト-投入-新設").totalPerUnit;
  near(offBefore - scenario(oneRow, "enhanced", "dye", "オフサイト-投入-新設").totalPerUnit, 8_000_000 / 10 / 30000, 1e-9, "UF/MFスキッド恒久部を顧客に移すとオフサイトでも26.7円/m³下がる");
  // 前提が無い試算は、これまでどおり槽も SX
  const noTank = clone();
  noTank.assumptions = noTank.assumptions.filter((a) => a.roleKey !== "onsite_tank_bearer");
  assert.equal(computeCostModel(noTank, { strain: "enhanced" }).onsiteTankBearer, "sx", "槽を持つのはの前提が無い試算は SX");
}

// 17. 年に作る量は年間処理量から計算する（入力ではない）。培養設備は系列を並べて増やす（まさ 2026-09-14）
{
  const vol = fixture.assumptions.find((a) => a.roleKey === "business_annual_volume");
  assert.ok(vol && vol.value === 20_000_000, "年間処理量は売上100億円に届く2,000万m³（売価500円/m³）");
  assert.ok(!fixture.assumptions.some((a) => a.roleKey === "culture_capacity_kg_year"), "年間生産能力を入力として持たない");
  assert.equal(fixture.assumptions.find((a) => a.roleKey === "culture_line_capacity_kg_year")?.value, 33333, "培養設備1系列の年間生産能力");
  const on = scenario(fixture, "enhanced", "dye", "投入-既設");
  near(on.businessRevenueAnnual, 10_000_000_000, 1e-3, "事業全体の売上 = 年間処理量 × 売価 = 100億円");
  near(on.customerCount, 20_000_000 / 30_000, 1e-9, "顧客数 = 年間処理量 ÷ 1社の年間処理量");
  near(on.businessTotalAnnual, on.totalPerUnit * 20_000_000, 1e-3, "事業全体の総コスト = 1m³あたり × 年間処理量");
  near(on.businessProfitAnnual, on.businessRevenueAnnual - on.businessTotalAnnual, 1e-3, "事業全体の利益 = 売上 − 総コスト");
  for (const strain of ["enhanced", "wild"] as const) {
    for (const application of ["dye", "metal"] as const) {
      const b = computeBiomassCost(fixture, strain, application);
      const d = deriveCostBasis(fixture.assumptions, { strain, application });
      assert.equal(b.fromVolume, true, `${strain} ${application} 年間処理量から出す`);
      near(b.capacityKgYear, (20_000_000 * d.biomassKgPerUnit) / b.salesRate, 1e-6, `${strain} ${application} 年に作る量 = 年間処理量 × 使い切る菌体量 ÷ 販売率`);
      near(b.productionLines, b.capacityKgYear / 33333, 1e-9, `${strain} ${application} 系列数 = 年に作る量 ÷ 1系列`);
      near(b.capexInitial, b.lineCapexInitial * b.productionLines, 1e-3, `${strain} ${application} 初期投資 = 1系列 × 系列数`);
      near(b.rows.find((r) => r.key === "capex")!.perKg * b.soldKgYear, b.capexAnnual, 1e-3, `${strain} ${application} 償却の年額（系列の数だけ）= 1kgあたり × 売る量`);
      near(b.rows.find((r) => r.key === "fixed")!.perKg * b.soldKgYear, b.fixedOpexAnnual, 1e-3, `${strain} ${application} 年ごとの固定費（系列の数だけ）= 1kgあたり × 売る量`);
    }
  }
  const dyeBio = computeBiomassCost(fixture, "enhanced", "dye");
  const metalBio = computeBiomassCost(fixture, "enhanced", "metal");
  assert.ok(metalBio.capacityKgYear > dyeBio.capacityKgYear * 9, "使い捨ての金属回収は、10回使い回す色素分解の9倍以上の菌体を作る");
  near(dyeBio.capacityKgYear, 2_222_222, 1, "強化株 色素分解で年に作る量");
  near(metalBio.productionLines, 628.9, 0.05, "強化株 金属回収の培養設備の系列数");
  // 系列ごとの作業は系列数に比例。拠点に1つの作業は変わらない
  const lineTasks = fixture.tasks.filter((t) => t.countDriver === "production_line").map((t) => t.costTaskId).sort();
  assert.deepEqual(lineTasks, ["ct4_culture_operation", "ct_c_filter_replace", "ct_c_integrity_test"], "培養設備の系列ごとの作業");
  assert.ok(fixture.tasks.filter((t) => t.countDriver === "production_line").every((t) => t.scenario === "中央培養"), "系列ごとは製造拠点の作業だけ");
  assert.equal(task(fixture, "ct_c_safety_committee").countDriver, "fixed", "安全委員会の運営は拠点に1つ");
  for (const d of PRODUCTION_TASK_DRIVERS) assert.ok(TASK_DRIVERS.includes(d), `製造拠点の作業の回数の決め方 ${d}`);
  const centralSel = { strain: "enhanced" as const, application: null };
  const lineDerived = { ...deriveCostBasis(fixture.assumptions, centralSel), productionLines: dyeBio.productionLines };
  near(taskAmount(task(fixture, "ct_c_filter_replace"), fixture.assumptions, lineDerived, centralSel).occurrences, 4 * dyeBio.productionLines, 1e-9, "除菌フィルター交換 = 1系列あたり4回 × 系列数");
  near(taskAmount(task(fixture, "ct_c_safety_committee"), fixture.assumptions, lineDerived, centralSel).occurrences, 1, 1e-12, "安全委員会は系列数によらず年1回");
  // 年間処理量を2倍にすると、系列数と初期投資が2倍。1kgあたりは、拠点に1つの作業が半分に薄まる分だけ下がる
  const doubleVol = clone();
  for (const a of doubleVol.assumptions) if (a.roleKey === "business_annual_volume") a.value = 40_000_000;
  const dyeBio2 = computeBiomassCost(doubleVol, "enhanced", "dye");
  near(dyeBio2.productionLines, dyeBio.productionLines * 2, 1e-9, "年間処理量2倍で系列数2倍");
  near(dyeBio2.capexInitial, dyeBio.capexInitial * 2, 1e-3, "年間処理量2倍で初期投資2倍");
  near(dyeBio.perKg - dyeBio2.perKg, dyeBio.siteTasksAnnual / dyeBio.soldKgYear / 2, 1e-9, "1kgあたりは拠点に1つの作業が薄まる分だけ下がる");
  near(scenario(doubleVol, "enhanced", "dye", "投入-既設").businessRevenueAnnual, 20_000_000_000, 1e-3, "年間処理量2倍で売上2倍");
  near(computeBiomassCost(doubleVol, "wild", "dye").perKg, computeBiomassCost(fixture, "wild", "dye").perKg, 1e-9, "拠点に1つの作業が無い自然株は、年間処理量で1kgあたりが変わらない");
  // 年間処理量の前提が無い試算は、これまでどおり年間生産能力をそのまま年に作る量として使う（系列は1つ）
  const capShape = capacityShape(fixture);
  const capBio = computeBiomassCost(capShape, "enhanced", "dye");
  assert.equal(capBio.fromVolume, false, "年間処理量が無ければ年間生産能力を使う");
  near(capBio.capacityKgYear, 33333, 1e-9, "年間生産能力をそのまま年に作る量に");
  near(capBio.productionLines, 1, 1e-12, "系列は1つ");
  near(capBio.perKg, 127.1, 0.05, "これまでの形では 127.1円/kg");
  near(scenario(capShape, "enhanced", "dye", "投入-既設").totalPerUnit, 102.6, 0.05, "これまでの形では 102.6円/m³");
  assert.equal(scenario(capShape, "enhanced", "dye", "投入-既設").businessVolume, 0, "年間処理量の前提が無い試算は事業全体の年額を出さない");
  // 1系列の前提が無く、年間生産能力だけを持つ試算に年間処理量を足すと、年間生産能力を1系列の量として使う
  const onlyCapacity = capacityShape(fixture);
  onlyCapacity.assumptions.push({ ...vol, costAssumptionId: "x_volume" });
  near(computeBiomassCost(onlyCapacity, "enhanced", "dye").lineCapacityKgYear, 33333, 1e-9, "年間生産能力を1系列の量として使う");
}

console.log("project-cost-model: OK");
