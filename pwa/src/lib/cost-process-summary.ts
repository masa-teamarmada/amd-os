import {
  annualAmount, biomassOf, centralItemPerKg, costItemLabel, derivedOf,
  effectiveUnitPrice, isScaledCapex, resolveAssumption, resolveBearer,
  resolvePerformer, scopeApplies, scopesFor, taskAmount,
  type CostComputation, type CostItem, type CostModelBundle, type CostSelection,
  type CostLocation, type CostMethod, type CostTankMode, type CostTask,
} from "./project-cost-model.ts";

export type CostProcessKey = "culture" | "concentrate" | "prepare" | "deliver" | "install" | "treat" | "collect" | "finish";
export type ProcessSelection = CostSelection & { location: CostLocation; method: CostMethod; tankMode: CostTankMode };
export interface ProcessCostRow {
  id: string;
  label: string;
  payer: "sx" | "customer";
  type: "CAPEX" | "OPEX";
  perUnit: number;
  initial: number;
  initialScope: "production" | "site" | "recovery";
  unknown: boolean;
  note?: string;
}
export interface CostProcessStep {
  key: CostProcessKey;
  title: string;
  description: string;
  rows: ProcessCostRow[];
  capex: number;
  opex: number;
  sx: number;
  customer: number;
  cumulative: number;
  gaps: string[];
}
export interface CostProcessSummary {
  steps: CostProcessStep[];
  sx: number;
  customer: number;
  capex: number;
  opex: number;
  total: number;
  overridden: boolean;
  invalidVolume: boolean;
}

const divide = (n: number, d: number) => d > 0 ? n / d : 0;
const textOf = (i: CostItem) => [i.groupLabel, i.midLabel, i.leafLabel].filter(Boolean).join(" ");

/** Classify the physical cost source, never a project ID or a guessed percentage. */
export function processOfItem(i: CostItem): CostProcessKey {
  const text = textOf(i);
  if (i.scenario === "中央培養") {
    if (/濃縮/.test(text)) return "concentrate";
    if (/品質確認|サンプリング|保管|梱包|充填|区別保管/.test(text)) return "prepare";
    return "culture";
  }
  if (i.priceRule === "recovery_capex" || /シアノ回収後処理|使用済み菌体の処分|酸処理|中和|残渣処分|回収物分析/.test(text)) return "finish";
  if (/使用済み.*保管|回収残渣/.test(text)) return "collect";
  if (/搬送費|輸送費|運賃/.test(text)) return "deliver";
  if (/保管容器|梱包|充填/.test(text)) return "prepare";
  // All permanent reactor equipment is installed once. Its operation reuses it.
  if (i.costType === "CAPEX") return "install";
  if (/交換費|交換部品/.test(text) || i.priceRule === "module_swap") return "collect";
  return "treat";
}

export function processOfTask(t: CostTask): CostProcessKey {
  if (t.scenario === "中央培養") {
    if (/充填|検査|品質|梱包/.test(t.label)) return "prepare";
    if (/濃縮/.test(t.label) && !/培養/.test(t.label)) return "concentrate";
    return "culture";
  }
  if (/後処理|酸処理|金属の回収|脱水|処分/.test(`${t.groupLabel} ${t.label}`)) return "finish";
  if (t.countDriver === "truck_trip" || /移動|輸送|往復/.test(t.label)) return "deliver";
  if (/搬入|設置|取付|受け入れ|教育訓練/.test(t.label)) return "install";
  if (/交換|取り外し|搬出/.test(t.label)) return "collect";
  return "treat";
}

function makeSteps(sel: ProcessSelection): CostProcessStep[] {
  const cartridge = sel.method === "循環";
  const offsite = sel.location === "offsite";
  const definitions: Array<[CostProcessKey, string, string]> = [
    ["culture", "シアノの培養", "光・CO₂・栄養を供給し、菌体を増やす"],
    ["concentrate", "回収・濃縮", "培養液から水を分け、菌体を濃くする"],
    ["prepare", cartridge ? "カートリッジ製造・出荷準備" : "菌体の充填・出荷準備", cartridge ? "充填・品質確認・密封・梱包" : "輸送容器に充填・品質確認・密封"],
    ["deliver", offsite ? "排液の引き取り・輸送" : "顧客への配送", offsite ? "顧客の排液を処理拠点へ運ぶ" : "製造拠点から顧客工場へ運ぶ"],
    ["install", cartridge ? "リアクターへの設置" : "リアクターへの投入準備", offsite ? "処理拠点で受け入れ・接続する" : cartridge ? "カートリッジを装着・配管を接続" : "菌体の搬入・投入設備を準備"],
    ["treat", "排水の処理", sel.application === "metal" ? "排水中の金属を菌体へ取り込む" : "排水を菌体に接触させ、色素を分解"],
    ["collect", cartridge ? "取り外し・回収" : "菌体の分離・回収", cartridge ? "停止・取り外し・使用済み品を密封" : "処理後の菌体を膜で分離・回収"],
    ["finish", offsite ? "回収後の処理" : "返送・回収後の処理", sel.application === "metal" ? "回収物を酸処理・金属回収・残渣処分" : "回収物を洗浄・分析し、再使用を評価／処分"],
  ];
  return definitions.map(([key, title, description]) => ({ key, title, description, rows: [], capex: 0, opex: 0, sx: 0, customer: 0, cumulative: 0, gaps: [] }));
}

/** Presentation-only ledger. Uses the existing engine's exact row contributions.
 * Joint source rows stay joint: no invented outbound/return or culture/concentration split.
 * Customer non-reactor rows are included separately from SX and customer reactor totals.
 */
export function computeProcessSummary(bundle: CostModelBundle, computed: CostComputation, sel: ProcessSelection): CostProcessSummary | null {
  if (!bundle.items.some((i) => i.scenario === "中央培養")) return null;
  const scenario = computed.scenarios.find((s) => s.application === sel.application && s.location === sel.location && s.method === sel.method && s.tankMode === sel.tankMode);
  if (!scenario) return null;
  const steps = makeSteps(sel);
  const add = (key: CostProcessKey, row: ProcessCostRow) => steps.find((s) => s.key === key)!.rows.push(row);
  const biomass = biomassOf(computed, sel.application);
  const derived = derivedOf(computed, sel.application, sel.location);
  const volume = derived.annualVolume;
  const centralSel: CostSelection = { strain: computed.strain, application: null };
  const centralDerived = { ...derivedOf(computed, sel.application, "onsite"), productionLines: biomass.productionLines };
  const active = bundle.items.filter((i) => !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考");
  const scopes = scopesFor(sel.location, sel.method);

  if (biomass.overridePerKg !== null) {
    add("culture", { id: "biomass-override", label: "菌体の製造原価（上書き・①〜③合算）", payer: "sx", type: "OPEX", perUnit: scenario.centralTotalPerUnit, initial: 0, initialScope: "production", unknown: false, note: "上書き値のため、培養・濃縮・出荷準備とCAPEX/OPEXの内訳は分けられない。既存試算と同じくOPEXへ合算。" });
  } else {
    for (const i of active.filter((i) => i.scenario === "中央培養" && scopeApplies(i, centralSel))) {
      const perUnit = volume > 0 ? divide(centralItemPerKg(i, bundle.assumptions, biomass.lineCapacityKgYear, centralSel, bundle.items), biomass.salesRate) * derived.biomassKgPerUnit : 0;
      const initial = i.costType === "CAPEX"
        ? i.quantity * i.unitPrice * (isScaledCapex(i) ? biomass.capacityKgYear : biomass.productionLines) : 0;
      add(processOfItem(i), { id: i.costItemId, label: costItemLabel(i), payer: "sx", type: i.costType as "CAPEX" | "OPEX", perUnit, initial, initialScope: "production", unknown: false, note: /保管.*輸送/.test(textOf(i)) ? "保管と輸送の設備は③に合算。工程別の設備額は未分離。" : undefined });
    }
    for (const t of bundle.tasks.filter((t) => t.scenario === "中央培養" && scopeApplies(t, centralSel))) {
      const amount = taskAmount(t, bundle.assumptions, centralDerived, centralSel);
      add(processOfTask(t), { id: t.costTaskId, label: t.label, payer: "sx", type: "OPEX", perUnit: volume > 0 ? divide(divide(amount.annual, biomass.capacityKgYear), biomass.salesRate) * derived.biomassKgPerUnit : 0, initial: 0, initialScope: "production", unknown: t.hoursPerOccurrence === null, note: /培養.*濃縮/.test(t.label) ? "①の金額に②の運転作業を含む。工程別の工数は未分離。" : undefined });
    }
  }

  for (const i of active.filter((i) => scopes.includes(i.scenario) && scopeApplies(i, sel))) {
    const payer = resolveBearer(i, sel.location, computed.reactorCustomerBorne);
    let initial = i.costType === "CAPEX" ? i.quantity * i.unitPrice : 0;
    if (i.priceRule === "recovery_capex") {
      const value = (role: string) => resolveAssumption(bundle.assumptions, role, sel)?.value ?? 0;
      initial = value("recovery_facility_capex") * divide(biomass.soldKgYear, value("recovery_line_capacity_kg_year"));
    }
    add(processOfItem(i), { id: i.costItemId, label: costItemLabel(i), payer, type: i.costType as "CAPEX" | "OPEX", perUnit: divide(annualAmount(i, bundle.assumptions, derived, sel, bundle.items), volume), initial, initialScope: i.priceRule === "recovery_capex" ? "recovery" : "site", unknown: false });
  }
  for (const t of bundle.tasks.filter((t) => scopes.includes(t.scenario) && scopeApplies(t, sel))) {
    const amount = taskAmount(t, bundle.assumptions, derived, sel);
    add(processOfTask(t), { id: t.costTaskId, label: t.label, payer: resolvePerformer(t, sel.location, computed.reactorCustomerBorne), type: "OPEX", perUnit: divide(amount.annual, volume), initial: 0, initialScope: "site", unknown: t.hoursPerOccurrence === null, note: /往復/.test(t.label) ? "往復分を④にまとめて計上。⑧で返送費を重ねて加算しない。" : /搬入.*搬出/.test(t.label) ? "搬入・搬出を⑤にまとめて計上。⑦で搬出費を重ねて加算しない。" : undefined });
  }
  if (sel.tankMode === "新設") {
    add("install", { id: "new-tank", label: "新設槽", payer: "sx", type: "CAPEX", perUnit: scenario.tankPerUnit, initial: resolveAssumption(bundle.assumptions, "new_tank_capex", sel)?.value ?? 18_000_000, initialScope: "site", unknown: false });
  }
  // Missing process-specific sources stay visible; 0 registered cost is not zero real cost.
  if (bundle.tasks.some((t) => t.scenario === "中央培養" && /培養.*濃縮/.test(t.label) && scopeApplies(t, centralSel))) steps[1].gaps.push("運転工数は①の培養・濃縮合算に含む");
  if (!bundle.tasks.some((t) => (t.scenario === "中央培養" || scopes.includes(t.scenario)) && /充填|梱包/.test(t.label) && scopeApplies(t, sel))) steps[2].gaps.push("充填・梱包の工数は未計上");
  if (sel.method === "循環" && !bundle.items.some((i) => i.scenario === "中央培養" && i.costType === "CAPEX" && /充填/.test(textOf(i)))) steps[2].gaps.push("充填設備は未計上");
  if (sel.location === "onsite" && bundle.tasks.some((t) => scopes.includes(t.scenario) && /往復/.test(t.label) && scopeApplies(t, sel))) steps[7].gaps.push("返送費は④の往復分に含む");
  if (sel.application === "dye" && active.some((i) => /再利用前の洗浄/.test(textOf(i)) && effectiveUnitPrice(i, bundle.assumptions, derived, sel, bundle.items) === 0)) steps[7].gaps.push("再使用前の洗浄費は未確定");

  let cumulative = 0;
  for (const step of steps) {
    for (const row of step.rows) {
      if (row.type === "CAPEX") step.capex += row.perUnit;
      else step.opex += row.perUnit;
      if (row.payer === "sx") step.sx += row.perUnit;
      else step.customer += row.perUnit;
    }
    cumulative += step.capex + step.opex;
    step.cumulative = cumulative;
  }
  const sum = (key: "sx" | "customer" | "capex" | "opex") => steps.reduce((s, step) => s + step[key], 0);
  return { steps, sx: sum("sx"), customer: sum("customer"), capex: sum("capex"), opex: sum("opex"), total: cumulative, overridden: biomass.overridePerKg !== null, invalidVolume: volume <= 0 };
}
