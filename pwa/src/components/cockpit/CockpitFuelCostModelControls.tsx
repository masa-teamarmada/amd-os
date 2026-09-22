"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { CO2_FLUE_GAS_ROLE, ITEM_INLINE_ROLES, STRAIN_LABEL, isScaledCapex, WASTE_MEDIUM_REDUCTION_ROLE, WASTE_MEDIUM_ROLE, WASTE_HEAT_ROLE, flueGasOn, wasteMediumOn, wasteHeatOn, type CostAssumption, type CostItem, type CostModelBundle, type CostTask } from "@/lib/project-cost-model";
import {
  FUEL_CULTURE_LABEL,
  FUEL_SECRETION_YIELD_ROLES,
  FUEL_SECRETION_YIELD_ROLE_LABEL,
  LIPID_SECRETION_ROLE,
  fuelBasisLabelOf,
  fuelSecretionAssumptionOf,
  fuelSelectionOf,
  FUEL_PARAM_BLOCKS,
  FUEL_PARAM_GROUPS,
  FUEL_PLANT_LABEL,
  FUEL_ROLE_KEYS,
  FUEL_SCOPE_LABEL,
  FUEL_TASK_DRIVER_LABEL,
  FUEL_TEXT_CHOICE_ROLES,
  FUEL_YIELD_CASES,
  FUEL_YIELD_CASE_LABEL,
  FUEL_YIELD_ROLES,
  FUEL_YIELD_ROLE_LABEL,
  findFuelScenario,
  fuelAssumptionOf,
  fuelBreakdownKeyOf,
  fuelCultureItemPerKg,
  fuelDriverUsesCount,
  fuelItemAnnual,
  fuelItemCalc,
  fuelItemLabel,
  fuelParamGroupOfItem,
  fuelParamGroupOfRole,
  fuelRowApplies,
  fuelTaskAmount,
  type FuelComputation,
  type FuelParamGroup,
  type FuelPriceContext,
  type FuelScenarioResult,
  type FuelScope,
  type FuelTaskDriver,
  type FuelTaskFlow,
} from "@/lib/project-fuel-cost-model";
import type { DraftEntity, DraftField, DraftValue } from "@/lib/project-cost-model-draft";
import { ConfidenceTag, FlueGasSwitch, NumberField, Swatch, WasteHeatSwitch, WasteMediumSwitch, int, num, yen } from "@/components/cockpit/CockpitCostModelParts";
import { FUEL_CATEGORY_COLOR, fuelSelectionLabel } from "@/components/cockpit/CockpitFuelCostModelResults";
import { CostBreakdownGuide, flashElement, type BreakdownGuideDriver } from "@/components/cockpit/CockpitCostBreakdownGuide";
import { ItemCalcLine, ItemNoteLine } from "@/components/cockpit/CockpitCostItemCalc";

// コスト試算（燃料）の操作パネル。まだ確定できない数字を、すべてここで動かせるようにする。
// 書き換えはその場で再計算するだけで保存しない。保存は上の「保存していない変更」から admin が行う。
// 一番上に「総コストの内訳（大きい順）」、次に「作業の流れと工数」、その下に「事業と製造の条件 / CAPEX / OPEX」の区分と小分けを並べる
// (排水処理のコスト試算の まさ 2026-09-14「CAPEXとOPEXに分けて、さらにそれぞれのサブグループに分けるなどして整理してほしい」)。
// 内訳の区分の札を押すと、その額を乗せている小分けへ移る (まさ 2026-09-14「一番大きく占めているところが左カラムのどこにあるのか分かりにくい」)。

export type FuelChangeHandler = (entity: DraftEntity, id: string, field: DraftField, value: DraftValue) => void;

interface Props {
  saved: CostModelBundle;
  working: CostModelBundle;
  computed: FuelComputation;
  current: FuelScenarioResult;
  flow: FuelTaskFlow;
  onChange: FuelChangeHandler;
  scrollable: boolean;
}

const NAV_BUTTON = "min-h-[36px] shrink-0 rounded-md px-2 text-[11px] font-semibold text-[#3c3c43] hover:bg-[#e8f3fc] hover:text-[#0267b2] xl:min-h-[26px]";
const stepAnchorId = (label: string) => `fuel-step-${label}`;

/**
 * 内訳の区分の額を比例して動かす前提 (金額の行ではない)。燃料1Lに要る菌体の量に比例する区分は、収率の表を動かすと額が動く。
 * 菌体費は、菌体の原価を上書きしても動く。
 */
const YIELD_DRIVER: BreakdownGuideDriver = { groupKey: "cond-yield", label: "収率（燃料1Lに要る量）" };
const FUEL_BREAKDOWN_DRIVERS: Record<string, BreakdownGuideDriver[]> = {
  biomass: [YIELD_DRIVER, { groupKey: "cond-biomass", label: "第1段の原価（上書き）" }],
  recovery: [YIELD_DRIVER],
  residue: [YIELD_DRIVER],
  capex: [YIELD_DRIVER],
};

export function FuelControlsPanel({ saved, working, computed, current, flow, onChange, scrollable }: Props) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const tasks = working.tasks ?? [];

  // 第1段で数える単位の呼び名 (脂質分泌株なら「脂肪酸」、そうでなければ「菌体」) と、株で効く行の絞り込み。
  const u = current.yield.unitLabel;
  const sel = fuelSelectionOf(working.assumptions);

  const assumptionsByGroup = useMemo(() => {
    const map = new Map<string, CostAssumption[]>();
    for (const g of FUEL_PARAM_GROUPS) {
      if (g.key === "cond-yield") continue;
      map.set(g.key, g.roles.flatMap((role) => {
        // 排ガス利用可能は CO2 の明細の行に出す (まさ 2026-09-14「CO2コストのところに設置してほしい」)
        if (ITEM_INLINE_ROLES.has(role)) return [];
        // 脂質分泌株は枠の上端のスイッチで切り替える
        if (role === LIPID_SECRETION_ROLE) return [];
        const a = fuelAssumptionOf(working.assumptions, role, fuelSelectionOf(working.assumptions));
        return a ? [a] : [];
      }));
    }
    return map;
  }, [working.assumptions]);

  const allItems = working.items.filter((i) => !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考");
  const itemsOfGroup = (key: string) => allItems.filter((i) => fuelParamGroupOfItem(i)?.key === key);
  const savedAssumption = (id: string) => saved.assumptions.find((a) => a.costAssumptionId === id);

  const jump = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (scrollable && paneRef.current) {
      const pane = paneRef.current;
      const navHeight = pane.querySelector("nav")?.getBoundingClientRect().height ?? 40;
      const top = pane.scrollTop + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - navHeight - 8;
      pane.scrollTo({ top, behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const jumpToGroup = (groupKey: string) => {
    jump(`fuel-g-${groupKey}`);
    flashElement(`fuel-g-${groupKey}`);
  };
  const groupTitleOf = (key: string) => FUEL_PARAM_GROUPS.find((g) => g.key === key)?.title;

  const s = current.scale;
  const b = current.biomass;
  const derivedBox = (key: string): ReactNode => {
    switch (key) {
      case "cond-scale":
        return (
          <Formula testId="fuel-business-scale">
            売上 ＝ 年間の燃料の量 {int(s.annualLiters)} L × 想定売価 {int(current.salePrice)} 円/L ＝{" "}
            <span className="font-semibold tabular-nums">{yen(current.revenueAnnual)}/年</span>。
            年に要る{u} ＝ {int(s.annualLiters)} L × 燃料1Lに要る{u} {num(current.yield.unitKgPerLiter, 2)} kg（収率{FUEL_YIELD_CASE_LABEL[current.yieldCase]}）＝{" "}
            <span className="font-semibold tabular-nums">{int(s.unitKgYear / 1000)} t/年</span>。{FUEL_CULTURE_LABEL} {int(s.cultureLines)} 系列・{FUEL_PLANT_LABEL} {num(s.plantLines, 1)} 系列。
          </Formula>
        );
      case "cond-biomass":
        return <BiomassFormula scenario={current} />;
      case "capex-culture":
        return (
          <Formula testId="fuel-culture-capacity">
            {s.secreting && (
              <>
                1系列の培養液 ＝ 1系列が年に作れる菌体 {int(s.cultureLineCapacityKgDcwYear)} kg ÷（菌体の生産性 {num(s.cultureBiomassProductivity, 2)} g/L/日 × 稼働 {int(s.cultureOperatingDays)} 日）＝{" "}
                <span className="font-semibold tabular-nums">{num(s.cultureLineVolumeM3, 1)} m³</span>。
                1系列が年に出す脂肪酸 ＝ {num(s.cultureLineVolumeM3, 1)} m³ × 分泌速度 {num(current.yield.secretionRatePerLiterDay, 3)} g/L/日 × {int(s.cultureOperatingDays)} 日 ＝{" "}
                <span className="font-semibold tabular-nums">{int(s.cultureLineCapacityUnitYear)} kg/年</span>。{" "}
              </>
            )}
            年に要る{u} {int(s.unitKgYear)} kg ÷ 1系列 {int(s.cultureLineCapacityUnitYear)} kg ＝ <span className="font-semibold tabular-nums">{int(s.cultureLines)} 系列</span>。
            初期投資 <span className="font-semibold tabular-nums">{yen(b.capexInitial)}</span>（1系列 {yen(b.lineCapexInitial)}）。償却は{u}1kgあたり {num(b.rows.find((r) => r.key === "capex")?.perKg ?? 0)} 円として{u}費に入る
          </Formula>
        );
      case "capex-plant":
        return (
          <Formula>
            年に要る{u} {int(s.unitKgYear)} kg ÷ 1系列 {int(s.plantLineCapacityKgYear)} kg ＝ <span className="font-semibold tabular-nums">{num(s.plantLines, 2)} 系列</span>。
            {FUEL_PLANT_LABEL}の初期投資 <span className="font-semibold tabular-nums">{yen(current.plantCapexInitial)}</span>（1系列 {yen(current.plantLineCapexInitial)}、FAME転換を{current.conversion === "inhouse" ? "自社で行う設備を含む" : "委託するので転換の設備は含まない"}）。
            償却は燃料1Lあたり {num(current.breakdown.find((x) => x.key === "capex")?.perLiter ?? 0)} 円
          </Formula>
        );
      case "opex-labor":
        return (
          <Formula>
            作業の年間回数: {FUEL_CULTURE_LABEL} {int(s.cultureLines)} 系列・{FUEL_PLANT_LABEL} {num(s.plantLines, 2)} 系列・出荷 {int(s.shipmentsPerYear)} 台・品質確認 {int(s.lotsPerYear)} ロット（年）
          </Formula>
        );
      case "opex-residue":
        return (
          <Formula testId="fuel-residue-formula">
            残渣の処理 ＝ 残渣の量 {num(current.residue.dryKgPerKgDcw, 3)} kg/kg-DCW{" "}
            {s.secreting ? `× 脂肪酸1kgあたりに入れ替える菌体 ${num(s.cellMakeupPerUnit, 2)} kg ` : ""}×{" "}
            {current.residue.route === "disposal"
              ? `（湿重量倍率 × 処分単価）${num(current.residue.pricePerKgDry, 1)} 円/kg`
              : `正味の費用 ${num(current.residue.pricePerKgDry, 1)} 円/kg`}{" "}
            ＝ {u}1kgあたり {num(current.residue.perKgDcw, 2)} 円 × 燃料1Lに要る{u} {num(current.yield.unitKgPerLiter, 2)} kg ＝{" "}
            <span className="font-semibold tabular-nums">{num(current.breakdown.find((x) => x.key === "residue")?.perLiter ?? 0)} 円/L</span>
          </Formula>
        );
      case "opex-shipping":
        return (
          <Formula>
            出荷の台数 ＝ {int(s.annualLiters)} L ÷ {int(s.truckCapacityLiters)} L ＝ <span className="font-semibold tabular-nums">{int(s.shipmentsPerYear)} 台/年</span>。
            品質確認のロット数 ＝ {int(s.annualLiters)} L ÷ {int(s.lotSizeLiters)} L ＝ <span className="font-semibold tabular-nums">{int(s.lotsPerYear)} ロット/年</span>
          </Formula>
        );
      default:
        return null;
    }
  };

  const renderGroup = (g: FuelParamGroup) => {
    const groupItems = itemsOfGroup(g.key);
    const visibleItems = showAllRows ? groupItems : groupItems.filter((i) => fuelRowApplies(i, current.conversion, sel));
    const hasTasks = !!g.tasks && tasks.length > 0;
    const rows = assumptionsByGroup.get(g.key) ?? [];
    const box = derivedBox(g.key);
    if (g.key !== "cond-yield" && rows.length === 0 && groupItems.length === 0 && !hasTasks) return null;
    const inactive = groupItems.length > 0 && groupItems.every((i) => !fuelRowApplies(i, current.conversion, sel)) && rows.length === 0;
    return (
      <section key={g.key} id={`fuel-g-${g.key}`} aria-label={g.title} className="scroll-mt-12 border-t border-[#f0f0f2] pt-2 first:border-t-0 first:pt-0">
        <h5 className="flex flex-wrap items-baseline gap-x-2">
          <span className={`text-[12px] font-semibold ${inactive ? "text-[#86868b]" : "text-[#1d1d1f]"}`}>{g.title}</span>
          <span className="text-[10px] leading-4 text-[#6e6e73]">{g.hint}</span>
        </h5>
        {g.key === "cond-yield" ? (
          <YieldTable saved={saved} working={working} computed={computed} current={current} onChange={onChange} />
        ) : (
          rows.length > 0 && (
            <ul className="flex flex-col divide-y divide-[#f0f0f2]">
              {rows.map((a) => (
                <AssumptionControl key={a.costAssumptionId} assumption={a} saved={savedAssumption(a.costAssumptionId)} onChange={onChange} />
              ))}
              {g.key === "cond-scale" && <TargetControl saved={saved} working={working} onChange={onChange} />}
            </ul>
          )
        )}
        {box}
        {hasTasks && <FuelTaskList saved={saved} working={working} current={current} flow={flow} onChange={onChange} />}
        {groupItems.length > 0 &&
          (visibleItems.length > 0 ? (
            <FuelItemRows saved={saved} working={working} current={current} items={visibleItems} onChange={onChange} />
          ) : (
            <p className="mt-1 text-[11px] text-[#86868b]">選んだFAME転換では発生しない（{groupItems.length}行。上の「すべての行を出す」で見られる）</p>
          ))}
      </section>
    );
  };

  const blocks = FUEL_PARAM_BLOCKS.map((block) => {
    const rendered = FUEL_PARAM_GROUPS.filter((g) => g.block === block.key)
      .map((g) => ({ g, node: renderGroup(g) }))
      .filter((x) => x.node !== null);
    return { block, rendered };
  }).filter((x) => x.rendered.length > 0);

  return (
    <div ref={paneRef} className={scrollable ? "h-full overflow-y-auto overscroll-contain" : ""} data-testid="fuel-cost-controls">
      <nav
        aria-label="操作パネルの目次"
        className={`${scrollable ? "sticky top-0" : ""} z-10 flex flex-wrap items-center gap-x-0.5 gap-y-0 border-b border-[#e5e5e7] bg-white px-2 py-1`}
      >
        <button type="button" onClick={() => jump("fuel-breakdown")} className={NAV_BUTTON}>
          内訳
        </button>
        {tasks.length > 0 && (
          <button type="button" onClick={() => jump("fuel-flow")} className={NAV_BUTTON}>
            作業の流れと工数
          </button>
        )}
        {blocks.map(({ block }) => (
          <button key={block.key} type="button" onClick={() => jump(`fuel-block-${block.key}`)} className={NAV_BUTTON}>
            {block.title}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAllRows((v) => !v)}
          aria-pressed={showAllRows}
          className="ml-auto min-h-[36px] rounded-md border border-[#d2d2d7] bg-white px-2 text-[11px] font-semibold text-[#3c3c43] hover:border-[#7cbceb] xl:min-h-[26px]"
          title="明細の行を、選んだFAME転換で発生する行だけにするか、すべて出すか"
        >
          {showAllRows ? "選んだFAME転換の行だけにする" : `すべての行を出す（明細${allItems.length}行）`}
        </button>
      </nav>
      <div className="flex flex-col gap-4 px-3 pb-6 pt-3">
        <CostBreakdownGuide
          id="fuel-breakdown"
          testId="fuel-breakdown-guide"
          slices={current.breakdown.map((x) => ({
            key: x.key,
            label: x.label,
            color: FUEL_CATEGORY_COLOR[x.key],
            amount: x.perLiter,
            parts: x.parts.map((p) => ({ label: p.label, amount: p.perLiter, groupKey: p.groupKey })),
          }))}
          unit="L"
          scenarioLabel={fuelSelectionLabel(current)}
          groupTitle={groupTitleOf}
          drivers={FUEL_BREAKDOWN_DRIVERS}
          onJump={jumpToGroup}
        />
        {tasks.length > 0 && (
          <section id="fuel-flow" aria-label="作業の流れと工数" className="scroll-mt-12">
            <h4 className="mb-1 text-[12px] font-semibold text-[#1d1d1f]">作業の流れと工数</h4>
            <FuelTaskFlowOverview flow={flow} current={current} onJumpStep={(label) => jump(stepAnchorId(label))} />
          </section>
        )}
        {blocks.map(({ block, rendered }) => (
          <section key={block.key} id={`fuel-block-${block.key}`} aria-label={block.title} className="scroll-mt-12 rounded-lg border border-[#e5e5e7] px-2.5 py-2">
            <h4 className="text-[13px] font-semibold text-[#1d1d1f]">{block.title}</h4>
            <p className="text-[10px] leading-4 text-[#6e6e73]">{block.hint}</p>
            <div className="mt-1 flex flex-wrap gap-x-1 gap-y-0.5" aria-label={`${block.title}の区分`}>
              {rendered.map(({ g }) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => jump(`fuel-g-${g.key}`)}
                  className="min-h-[32px] rounded-full border border-[#e5e5e7] bg-[#fafafa] px-2 text-[10px] font-medium text-[#3c3c43] hover:border-[#7cbceb] hover:text-[#0267b2] xl:min-h-[22px]"
                >
                  {g.title}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-3">{rendered.map(({ node }) => node)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** 前提の下に出す、いまの数字での割り算の箱。 */
function Formula({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className="mt-1.5 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43]" data-testid={testId}>
      {children}
    </p>
  );
}

/** スマホ幅で入力欄をマスいっぱいに広げる。 */
const FILL = "flex w-full items-center gap-1 xl:inline-flex xl:w-auto";

/** 表の1マス。スマホ幅は見出しを上・入力を下に置き、デスクトップは見出しを表の頭に出して入力だけを置く。 */
function Cell({ label, children, className = "", align = "end" }: { label: string; children: ReactNode; className?: string; align?: "start" | "end" }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] leading-4 text-[#6e6e73] xl:hidden">{label}</span>
      <div className={`flex min-w-0 items-center gap-1 ${align === "end" ? "xl:justify-end" : ""}`}>{children}</div>
    </div>
  );
}

function NoteToggle({ note }: { note: string | null }) {
  const [open, setOpen] = useState(false);
  if (!note) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="ml-1 rounded px-1 text-[10px] font-semibold text-[#0267b2] hover:underline">
        {open ? "説明を閉じる" : "説明"}
      </button>
      {open && <span className="mt-0.5 block text-[11px] leading-5 text-[#6e6e73]">{note}</span>}
    </>
  );
}

function AssumptionControl({ assumption: a, saved, onChange }: { assumption: CostAssumption; saved: CostAssumption | undefined; onChange: FuelChangeHandler }) {
  const choices = a.roleKey ? FUEL_TEXT_CHOICE_ROLES[a.roleKey] : undefined;
  if (choices) {
    const current = a.valueText ?? choices[0].value;
    const baseline = saved?.valueText ?? choices[0].value;
    return (
      <li className="flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:gap-2">
        <div className="min-w-0 flex-1 text-[12px] leading-5 text-[#1d1d1f]">
          {a.label}
          <span className="ml-1 align-middle"><ConfidenceTag value={a.confidence} /></span>
          <NoteToggle note={a.note} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <select
            aria-label={a.label}
            value={current}
            onChange={(e) => onChange("assumption", a.costAssumptionId, "valueText", e.target.value)}
            className={`min-h-[44px] rounded-md border px-2 text-[16px] text-[#1d1d1f] xl:h-7 xl:min-h-0 xl:text-[12px] ${
              baseline !== current ? "border-[#027fdc] bg-[#e8f3fc]" : "border-[#d2d2d7] bg-white"
            }`}
          >
            {choices.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <span className="w-16 text-[11px] text-[#6e6e73]" />
        </div>
      </li>
    );
  }
  const isOverride = a.roleKey === "biomass_cost_per_kg_override";
  return (
    <li className="flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:gap-2">
      <div className="min-w-0 flex-1 text-[12px] leading-5 text-[#1d1d1f]">
        {a.label}
        <span className="ml-1 align-middle"><ConfidenceTag value={a.confidence} /></span>
        <NoteToggle note={a.note} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <NumberField
          ariaLabel={a.label}
          value={a.value}
          baseline={saved?.value ?? null}
          onChange={(v) => onChange("assumption", a.costAssumptionId, "value", v)}
          allowNull={isOverride}
          min={isOverride ? 0 : undefined}
          placeholder={isOverride ? "空欄＝計算値" : undefined}
          widthClass="w-36 xl:w-24"
        />
        <span className="w-16 text-[11px] text-[#6e6e73]">{a.unit}</span>
      </div>
    </li>
  );
}

function TargetControl({ saved, working, onChange }: { saved: CostModelBundle; working: CostModelBundle; onChange: FuelChangeHandler }) {
  return (
    <li className="flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:gap-2">
      <div className="min-w-0 flex-1 text-[12px] leading-5 text-[#1d1d1f]">
        総コスト目標（粗利30%を残す原価）
        <NoteToggle note={working.model.targetNote} />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <NumberField
          ariaLabel="総コスト目標"
          value={working.model.targetTotalCostPerUnit}
          baseline={saved.model.targetTotalCostPerUnit}
          allowNull
          min={0}
          placeholder="空欄＝目標なし"
          widthClass="w-36 xl:w-24"
          onChange={(v) => onChange("model", working.model.costModelId, "targetTotalCostPerUnit", v)}
        />
        <span className="w-16 text-[11px] text-[#6e6e73]">円/L</span>
      </div>
    </li>
  );
}

/** 収率の3ケースを横に並べて書き換える。掛け合わせた「燃料1Lに要る菌体」をケースごとに出す。 */
function YieldTable({
  saved,
  working,
  computed,
  current,
  onChange,
}: {
  saved: CostModelBundle;
  working: CostModelBundle;
  computed: FuelComputation;
  current: FuelScenarioResult;
  onChange: FuelChangeHandler;
}) {
  const suffix = { low: "_low", base: "", high: "_high" } as const;
  const density = fuelAssumptionOf(working.assumptions, "fame_density");
  const savedOf = (id: string) => saved.assumptions.find((a) => a.costAssumptionId === id);
  const secreting = current.yield.secreting;
  const u = current.yield.unitLabel;
  return (
    <div className="mt-1.5" data-testid="fuel-yield-table">
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,4.5rem))] items-end gap-x-1.5 border-b border-[#e5e5e7] pb-1 text-[10px] font-medium text-[#6e6e73] xl:grid-cols-[minmax(0,1fr)_repeat(3,5.25rem)]">
        <span>項目（%）</span>
        {FUEL_YIELD_CASES.map((y) => (
          <span key={y} className={`text-right ${y === current.yieldCase ? "font-semibold text-[#0267b2]" : ""}`}>{FUEL_YIELD_CASE_LABEL[y]}</span>
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-[#f0f0f2]">
        {/* 脂質分泌株のときだけ効く行 (分泌速度・培養液からの回収率)。菌体を集めて取り出す形の3つは、そのとき効かないので薄く出す */}
        {secreting &&
          FUEL_SECRETION_YIELD_ROLES.map((role) => {
            const baseRow = fuelSecretionAssumptionOf(working.assumptions, role, "base");
            const unit = role === "secretion_rate" ? "g/L/日" : "%";
            return (
              <li key={role} className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,4.5rem))] items-center gap-x-1.5 py-1.5 xl:grid-cols-[minmax(0,1fr)_repeat(3,5.25rem)]">
                <span className="min-w-0 text-[12px] leading-5 text-[#1d1d1f]">
                  {FUEL_SECRETION_YIELD_ROLE_LABEL[role]}
                  <span className="ml-1 text-[10px] text-[#6e6e73]">（{unit}）</span>
                  {baseRow && <span className="ml-1 align-middle"><ConfidenceTag value={baseRow.confidence} /></span>}
                  {baseRow && <NoteToggle note={baseRow.note} />}
                </span>
                {FUEL_YIELD_CASES.map((y) => {
                  const a = fuelAssumptionOf(working.assumptions, `${role}${suffix[y]}`) ?? (y === "base" ? baseRow : undefined);
                  if (!a) return <span key={y} className="text-right text-[11px] text-[#86868b]">基準と同じ</span>;
                  return (
                    <NumberField
                      key={y}
                      ariaLabel={`${FUEL_SECRETION_YIELD_ROLE_LABEL[role]}（${FUEL_YIELD_CASE_LABEL[y]}）`}
                      value={a.value}
                      baseline={savedOf(a.costAssumptionId)?.value ?? null}
                      onChange={(v) => onChange("assumption", a.costAssumptionId, "value", v)}
                      min={0}
                      max={role === "broth_recovery" ? 100 : undefined}
                      compact
                      widthClass="w-full"
                      wrapperClass="flex w-full items-center"
                    />
                  );
                })}
              </li>
            );
          })}
        {FUEL_YIELD_ROLES.map((role) => {
          const baseRow = fuelAssumptionOf(working.assumptions, role);
          // 分泌株のときは、菌体を集めて壊す段の3つが効かない
          const unused = secreting && (role === "fame_potential" || role === "harvest_recovery" || role === "extraction_recovery");
          if (unused) {
            return (
              <li key={role} className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,4.5rem))] items-center gap-x-1.5 py-1.5 opacity-50 xl:grid-cols-[minmax(0,1fr)_repeat(3,5.25rem)]">
                <span className="min-w-0 text-[12px] leading-5 text-[#1d1d1f]">{FUEL_YIELD_ROLE_LABEL[role]}</span>
                <span className="col-span-3 text-right text-[11px] text-[#86868b]">脂質分泌株では使わない</span>
              </li>
            );
          }
          return (
            <li key={role} className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,4.5rem))] items-center gap-x-1.5 py-1.5 xl:grid-cols-[minmax(0,1fr)_repeat(3,5.25rem)]">
              <span className="min-w-0 text-[12px] leading-5 text-[#1d1d1f]">
                {FUEL_YIELD_ROLE_LABEL[role]}
                {baseRow && <span className="ml-1 align-middle"><ConfidenceTag value={baseRow.confidence} /></span>}
                {baseRow && <NoteToggle note={baseRow.note} />}
              </span>
              {FUEL_YIELD_CASES.map((y) => {
                const a = fuelAssumptionOf(working.assumptions, `${role}${suffix[y]}`) ?? (y === "base" ? baseRow : undefined);
                if (!a) return <span key={y} className="text-right text-[11px] text-[#86868b]">基準と同じ</span>;
                return (
                  <NumberField
                    key={y}
                    ariaLabel={`${FUEL_YIELD_ROLE_LABEL[role]}（${FUEL_YIELD_CASE_LABEL[y]}）`}
                    value={a.value}
                    baseline={savedOf(a.costAssumptionId)?.value ?? null}
                    onChange={(v) => onChange("assumption", a.costAssumptionId, "value", v)}
                    min={0}
                    max={100}
                    compact
                    widthClass="w-full"
                    wrapperClass="flex w-full items-center"
                  />
                );
              })}
            </li>
          );
        })}
        {density && (
          <li className="flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:gap-2">
            <div className="min-w-0 flex-1 text-[12px] leading-5 text-[#1d1d1f]">
              {density.label}（3ケース共通）
              <span className="ml-1 align-middle"><ConfidenceTag value={density.confidence} /></span>
              <NoteToggle note={density.note} />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <NumberField
                ariaLabel={density.label}
                value={density.value}
                baseline={savedOf(density.costAssumptionId)?.value ?? null}
                onChange={(v) => onChange("assumption", density.costAssumptionId, "value", v)}
                min={0.1}
                widthClass="w-36 xl:w-24"
              />
              <span className="w-16 text-[11px] text-[#6e6e73]">{density.unit}</span>
            </div>
          </li>
        )}
      </ul>
      <div className="mt-1.5 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43]" data-testid="fuel-yield-formula">
        <p>
          {secreting
            ? "燃料1Lに要る脂肪酸 ＝ 密度 ÷（培養液からの回収率 × メチル化反応率 × FAME精製回収率）。分泌速度は、要る培養液の量（培養設備の系列数）を決める"
            : "燃料1Lに要る菌体 ＝ 密度 ÷（FAMEポテンシャル × 菌体回収率 × 脂質抽出回収率 × メチル化反応率 × FAME精製回収率）"}
        </p>
        <ul>
          {FUEL_YIELD_CASES.map((y) => {
            const sc = findFuelScenario(computed, current.conversion, y);
            if (!sc) return null;
            return (
              <li key={y} className={`flex flex-wrap justify-between gap-x-2 ${y === current.yieldCase ? "font-semibold text-[#1d1d1f]" : ""}`}>
                <span>
                  {FUEL_YIELD_CASE_LABEL[y]}: {secreting ? "脂肪酸" : "乾燥菌体"}1kgから精製FAME {num(sc.yield.fameKgPerKgDcw * 1000, 1)} g（{num(sc.yield.litersPerKgDcw * 1000, 1)} mL）
                  {secreting ? `・1系列が年に出す脂肪酸 ${int(sc.scale.cultureLineCapacityUnitYear)} kg` : ""}
                </span>
                <span className="tabular-nums">燃料1Lに{u} {num(sc.yield.unitKgPerLiter, 2)} kg</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** 第1段の割り算を、いまの数字で見せる。 */
function BiomassFormula({ scenario }: { scenario: FuelScenarioResult }) {
  const b = scenario.biomass;
  const s = scenario.scale;
  const row = (key: string) => b.rows.find((x) => x.key === key)?.perKg ?? 0;
  const life = b.usefulLifeMinYears === null ? "—" : b.usefulLifeMinYears === b.usefulLifeMaxYears ? `${b.usefulLifeMinYears}年` : `${b.usefulLifeMinYears}〜${b.usefulLifeMaxYears}年`;
  const u = scenario.yield.unitLabel;
  const lines: Array<[string, string, number]> = [
    ["培養設備の償却", `1系列の初期投資 ${yen(b.lineCapexInitial)} ÷ 耐用 ${life} ÷ 1系列 ${int(s.cultureLineCapacityUnitYear)} kg`, row("capex")],
    ["年ごとの固定費", `1系列の年額 ${yen(b.cultureLines > 0 ? b.fixedOpexAnnual / b.cultureLines : 0)} ÷ 1系列 ${int(s.cultureLineCapacityUnitYear)} kg`, row("fixed")],
    ["培養の作業", `年 ${yen(b.tasksAnnual)} ÷ 年に要る${u} ${int(s.unitKgYear)} kg（作業リスト）`, row("tasks")],
    [`${u}の量に比例する費用`, s.secreting ? `培地・CO2・溶媒など 1kgあたりの単価（菌体1kgあたりの行は 入れ替える菌体 ${num(s.cellMakeupPerUnit, 2)} kg を掛ける）` : "培地・CO2・濃縮など 1kgあたりの単価", row("variable")],
  ];
  return (
    <div className="mt-1.5 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43]" data-testid="fuel-biomass-formula">
      <p className="font-semibold text-[#1d1d1f]">
        {u}1kgの原価 <span className="tabular-nums">{num(b.computedPerKg)} 円/kg</span>
        <span className="font-normal text-[#6e6e73]">（明細と作業から計算。設備は系列の数だけ並べるので、1kgあたりは作る量でほとんど変わらない）</span>
      </p>
      <ul className="mt-0.5">
        {lines.map(([label, formula, perKg]) => (
          <li key={label} className="flex justify-between gap-2">
            <span className="min-w-0">
              {label}
              <span className="ml-1 text-[10px] text-[#6e6e73]">{formula}</span>
            </span>
            <span className="shrink-0 tabular-nums">{num(perKg)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-0.5">
        {u}費 ＝ {num(b.perKg)} 円/kg × 燃料1Lに要る{u} {num(scenario.yield.unitKgPerLiter, 2)} kg ＝{" "}
        <span className="font-semibold tabular-nums">{num(scenario.biomassPerLiter)} 円/L</span>
      </p>
      {b.overridePerKg !== null && <p className="mt-0.5 font-semibold text-[#b45309]">上書き値 {num(b.overridePerKg)} 円/kg で計算中</p>}
    </div>
  );
}

const DRIVER_EXPLAIN = (driver: string, s: FuelScenarioResult["scale"]): string =>
  driver === "production_line" ? `${int(s.cultureLines)}系列`
  : driver === "plant_line" ? `${num(s.plantLines, 2)}系列`
  : driver === "truck_trip" ? `${int(s.shipmentsPerYear)}台`
  : driver === "batch" ? `${int(s.lotsPerYear)}ロット`
  : "";

function FuelTaskFlowOverview({ flow, current, onJumpStep }: { flow: FuelTaskFlow; current: FuelScenarioResult; onJumpStep: (label: string) => void }) {
  const maxHours = Math.max(1, ...flow.steps.map((st) => st.hours));
  return (
    <div data-testid="fuel-task-flow">
      <p className="text-[11px] leading-5 text-[#3c3c43]">
        <span className="text-[#6e6e73]">{fuelSelectionLabel(current)}</span>
        <br />
        <span className="font-semibold text-[#1d1d1f]">作業工数 年 {int(flow.plantHours + flow.cultureHours)}時間（事業全体）</span>
        ・作業費 {num(flow.perLiter)} 円/L（年 {yen(flow.annual)}）
        {flow.unknownCount > 0 && <>／工数が未確認の作業 {flow.unknownCount}件は0時間で数えている</>}
      </p>
      <ol className="mt-1.5 flex flex-col" aria-label="作業の流れ">
        {flow.steps.map((st, i) => {
          const allUnknown = st.unknownCount === st.rows.length;
          const key = st.rows[0] ? fuelBreakdownKeyOf(st.rows[0].task) : "recovery";
          return (
            <li key={st.label} className="relative grid grid-cols-[22px_minmax(0,1fr)] gap-x-2 pb-2 last:pb-0">
              {i < flow.steps.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[10.5px] top-[22px] w-px bg-[#d2d2d7]" />}
              <span className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#7cbceb] bg-white text-[11px] font-semibold text-[#0267b2]">{i + 1}</span>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onJumpStep(st.label)}
                  title="作業リストのこの段へ移る"
                  className="grid min-h-[36px] w-full grid-cols-[minmax(0,1fr)_64px] items-center gap-x-2 rounded text-left hover:bg-[#f5f5f7] sm:grid-cols-[minmax(0,1fr)_minmax(80px,180px)_92px_64px] xl:min-h-[22px]"
                >
                  <span className="min-w-0 text-[12px] font-semibold text-[#1d1d1f] sm:truncate">{st.label}</span>
                  <span className="hidden sm:block">
                    <span className="relative block h-2 w-full" aria-hidden="true">
                      <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `max(${st.hours > 0 ? 2 : 0}px, ${(st.hours / maxHours) * 100}%)`, backgroundColor: FUEL_CATEGORY_COLOR[key] }} />
                    </span>
                  </span>
                  <span className={`hidden text-right text-[11px] tabular-nums sm:block ${allUnknown ? "text-[#6e6e73]" : "text-[#1d1d1f]"}`}>{allUnknown ? "未確認" : `${int(st.hours)}時間`}</span>
                  <span className="text-right text-[11px] tabular-nums text-[#3c3c43]">{num(st.perLiter)} 円</span>
                </button>
                <p className="text-[10px] leading-4 text-[#6e6e73]">
                  {st.rows.map((r, j) => (
                    <span key={r.task.costTaskId}>
                      {j > 0 && "・"}
                      {r.task.label} {r.amount.occurrences < 10 ? num(r.amount.occurrences, 2) : int(r.amount.occurrences)}回×
                      {r.task.hoursPerOccurrence === null ? <span className="font-semibold text-[#3c3c43]">工数未確認</span> : `${Number(r.amount.hours.toFixed(2)).toLocaleString("ja-JP")}時間`}
                      {r.task.expensePerOccurrence > 0 ? `＋${yen(r.task.expensePerOccurrence)}` : ""}
                    </span>
                  ))}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] leading-4 text-[#6e6e73]">
        <span>棒は1年分の工数（人時、事業全体）。右端は円/L。色は内訳の区分と同じ。</span>
        <span className="inline-flex items-center gap-1"><Swatch color={FUEL_CATEGORY_COLOR.biomass} />培養（菌体費に入る）</span>
      </p>
    </div>
  );
}

function FuelTaskList({
  saved,
  working,
  current,
  flow,
  onChange,
}: {
  saved: CostModelBundle;
  working: CostModelBundle;
  current: FuelScenarioResult;
  flow: FuelTaskFlow;
  onChange: FuelChangeHandler;
}) {
  const tasks = [...(working.tasks ?? [])].sort((x, y) => x.sortOrder - y.sortOrder);
  const groups = [...new Set(tasks.map((t) => t.groupLabel ?? "作業"))];
  const rate = fuelAssumptionOf(working.assumptions, "labor_rate")?.value ?? 4000;
  const sel = fuelSelectionOf(working.assumptions);
  const u = current.yield.unitLabel;
  const perLiterOf = (t: CostTask) => {
    if (!fuelRowApplies(t, current.conversion, sel)) return null;
    const annual = fuelTaskAmount(t, working.assumptions, current.scale).annual;
    if (t.scenario === "中央培養") {
      return current.biomass.overridePerKg !== null ? 0 : (current.scale.unitKgYear > 0 ? annual / current.scale.unitKgYear : 0) * current.yield.unitKgPerLiter;
    }
    return current.scale.annualLiters > 0 ? annual / current.scale.annualLiters : 0;
  };
  return (
    <div>
      <p className="mb-1.5 mt-1.5 text-[11px] leading-5 text-[#6e6e73]">
        年額 ＝ 年間回数 ×（1回の工数 × 作業単価 {int(rate)}円/時 ＋ 1回の経費）。作業単価は上の共通の1つ。工数が空欄の行は未確認で、0時間として数える。
        {FUEL_CULTURE_LABEL}の作業は{u}費に入る。選んだFAME転換や株で発生しない行は薄く出す。
      </p>
      <div className="hidden xl:grid xl:grid-cols-[minmax(0,1fr)_78px_130px_92px_56px] xl:gap-x-1.5 xl:border-b xl:border-[#e5e5e7] xl:pb-1 xl:text-[10px] xl:font-medium xl:text-[#6e6e73]">
        <span>作業</span>
        <span className="text-right">1回の工数(時)</span>
        <span>年間回数</span>
        <span className="text-right">1回の経費(円)</span>
        <span className="text-right">円/L</span>
      </div>
      {groups.map((g) => {
        const stepIndex = flow.steps.findIndex((st) => st.label === g);
        const step = stepIndex >= 0 ? flow.steps[stepIndex] : null;
        return (
          <div key={g} id={stepAnchorId(g)} className="mt-1.5 scroll-mt-12">
            <p className={`flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold ${step ? "text-[#1d1d1f]" : "text-[#86868b]"}`}>
              <span>{step ? `${stepIndex + 1}. ` : ""}{g}</span>
              <span className="text-[10px] font-normal text-[#6e6e73]">
                {!step
                  ? "選んだFAME転換では発生しない"
                  : [`年 ${int(step.hours)}時間`, `${num(step.perLiter)} 円/L`, step.unknownCount > 0 ? `工数未確認 ${step.unknownCount}件` : null].filter(Boolean).join("・")}
              </span>
            </p>
            <ul className="flex flex-col divide-y divide-[#f0f0f2]">
              {tasks
                .filter((t) => (t.groupLabel ?? "作業") === g)
                .map((t) => {
                  const base = (saved.tasks ?? []).find((x) => x.costTaskId === t.costTaskId);
                  const applies = fuelRowApplies(t, current.conversion, sel);
                  const amt = fuelTaskAmount(t, working.assumptions, current.scale);
                  const perLiter = perLiterOf(t);
                  const driver = t.countDriver as string;
                  const usesCount = fuelDriverUsesCount(driver);
                  return (
                    <li
                      key={t.costTaskId}
                      className={`grid grid-cols-2 gap-x-2 gap-y-1 py-1.5 xl:grid-cols-[minmax(0,1fr)_78px_130px_92px_56px] xl:items-center xl:gap-x-1.5 ${applies ? "" : "opacity-50"}`}
                    >
                      <div className="col-span-2 min-w-0 text-[12px] leading-5 text-[#1d1d1f] xl:col-span-1">
                        {t.label}
                        <span className="ml-1 align-middle"><ConfidenceTag value={t.confidence} /></span>
                        <span className="block text-[10px] leading-4 text-[#6e6e73]">
                          {FUEL_SCOPE_LABEL[t.scenario as FuelScope] ?? t.scenario}・年 {yen(amt.annual)}
                          {amt.annualHours > 0 ? `（${int(amt.annualHours)}時間）` : ""}
                          <NoteToggle note={t.note} />
                        </span>
                      </div>
                      <Cell label="1回の工数（時間）">
                        <NumberField
                          ariaLabel={`${t.label} 1回の工数`}
                          value={t.hoursPerOccurrence}
                          baseline={base?.hoursPerOccurrence ?? null}
                          allowNull
                          min={0}
                          placeholder="未確認"
                          compact
                          widthClass="w-full xl:w-[4.5rem]"
                          wrapperClass={FILL}
                          onChange={(v) => onChange("task", t.costTaskId, "hoursPerOccurrence", v)}
                        />
                      </Cell>
                      <Cell label={`年間回数（${FUEL_TASK_DRIVER_LABEL[driver as FuelTaskDriver] ?? driver}）`} className="col-span-2 xl:col-span-1" align="start">
                        {usesCount ? (
                          <>
                            <NumberField
                              ariaLabel={`${t.label} 年間回数`}
                              value={t.countPerYear}
                              baseline={base?.countPerYear ?? null}
                              min={0}
                              compact
                              widthClass="w-16 xl:w-12"
                              onChange={(v) => onChange("task", t.costTaskId, "countPerYear", v ?? 0)}
                            />
                            <span className="text-[10px] leading-4 text-[#6e6e73]">
                              {driver === "fixed" ? "回" : `回 × ${DRIVER_EXPLAIN(driver, current.scale)}`}
                            </span>
                          </>
                        ) : (
                          <span className="text-[12px] tabular-nums text-[#1d1d1f] xl:text-[11px]">
                            {int(amt.occurrences)}回<span className="ml-1 text-[10px] text-[#6e6e73]">（{FUEL_TASK_DRIVER_LABEL[driver as FuelTaskDriver] ?? driver}）</span>
                          </span>
                        )}
                      </Cell>
                      <Cell label="1回の経費（円）">
                        <NumberField
                          ariaLabel={`${t.label} 1回の経費`}
                          value={t.expensePerOccurrence}
                          baseline={base?.expensePerOccurrence ?? 0}
                          min={0}
                          compact
                          widthClass="w-full xl:w-[5.5rem]"
                          wrapperClass={FILL}
                          onChange={(v) => onChange("task", t.costTaskId, "expensePerOccurrence", v ?? 0)}
                        />
                      </Cell>
                      <Cell label="円/L">
                        <span className="min-h-[44px] w-full text-right text-[13px] font-semibold leading-[44px] tabular-nums text-[#1d1d1f] xl:min-h-0 xl:text-[11px] xl:font-normal xl:leading-normal">
                          {perLiter === null ? "—" : num(perLiter, 2)}
                        </span>
                      </Cell>
                    </li>
                  );
                })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 区分の明細の行。数量・単価・耐用年数を動かす。
 * 数量 × 単価 は行の「〜あたり」の額なので、右端の円/Lまでの掛け算を行の下に「計算」として出し、数の出どころを「根拠」として出す
 * (まさ 2026-09-14「そもそも「数量」「単価」って何？…これに数量をかけると右の「円/L」になる？ならないよね？」)。
 */
function FuelItemRows({
  saved,
  working,
  current,
  items,
  onChange,
}: {
  saved: CostModelBundle;
  working: CostModelBundle;
  current: FuelScenarioResult;
  items: CostItem[];
  onChange: FuelChangeHandler;
}) {
  // CO2 と培養ロス補充の単価は、前提 (排ガス利用可能) とほかの行から出す
  const ctx: FuelPriceContext = { assumptions: working.assumptions, items: working.items };
  const flueGas = fuelAssumptionOf(working.assumptions, CO2_FLUE_GAS_ROLE);
  const sel = fuelSelectionOf(working.assumptions);
  const savedFlueGas = flueGas ? saved.assumptions.find((a) => a.costAssumptionId === flueGas.costAssumptionId) : undefined;
  // 培地の原料の行に置く「工場の排液を培地に使える」のスイッチ（減る割合は前提の一覧で変える）
  const wasteMedium = fuelAssumptionOf(working.assumptions, WASTE_MEDIUM_ROLE);
  const savedWasteMedium = wasteMedium ? saved.assumptions.find((a) => a.costAssumptionId === wasteMedium.costAssumptionId) : undefined;
  const mediumReduction = fuelAssumptionOf(working.assumptions, WASTE_MEDIUM_REDUCTION_ROLE)?.value ?? 0;
  // 加温の熱の行に置く「排熱利用可能」のスイッチ
  const wasteHeat = fuelAssumptionOf(working.assumptions, WASTE_HEAT_ROLE);
  const savedWasteHeat = wasteHeat ? saved.assumptions.find((a) => a.costAssumptionId === wasteHeat.costAssumptionId) : undefined;
  return (
    <div className="mt-1.5">
      <div className="hidden xl:grid xl:grid-cols-[minmax(0,1fr)_64px_128px_64px_60px] xl:gap-x-1.5 xl:border-b xl:border-[#e5e5e7] xl:pb-1 xl:text-[10px] xl:font-medium xl:text-[#6e6e73]">
        <span>明細（行の下に計算と根拠）</span>
        <span className="text-right" title="行の「〜あたり」（1系列・1kg・燃料1L など）に使う量。単位は行の下の計算に出す">数量</span>
        <span className="text-right" title="数量の単位1つあたりの値段">単価</span>
        <span className="text-right">耐用年数</span>
        <span className="text-right" title="数量 × 単価 を燃料1Lあたりに直した額。掛け算は行の下の計算に出す">円/L</span>
      </div>
      <ul className="flex flex-col divide-y divide-[#f0f0f2]">
        {items.map((i) => {
          const base = saved.items.find((x) => x.costItemId === i.costItemId);
          const applies = fuelRowApplies(i, current.conversion, sel);
          const isCulture = i.scenario === "中央培養";
          const perKg = isCulture ? fuelCultureItemPerKg(i, current.scale.cultureLineCapacityUnitYear, ctx, current.scale) : 0;
          const right = !applies
            ? null
            : isCulture
              ? current.biomass.overridePerKg !== null ? 0 : perKg * current.yield.unitKgPerLiter
              : current.scale.annualLiters > 0 ? fuelItemAnnual(i, current.scale, ctx) / current.scale.annualLiters : 0;
          const flueGasSwitch = i.priceRule === "co2_supply" && flueGas;
          const mediumSwitch = i.priceRule === "medium_supply" && wasteMedium;
          const heatSwitch = i.priceRule === "heat_supply" && wasteHeat;
          return (
            <li
              key={i.costItemId}
              className={`grid grid-cols-2 gap-x-2 gap-y-1 py-1.5 xl:grid-cols-[minmax(0,1fr)_64px_128px_64px_60px] xl:items-center xl:gap-x-1.5 ${applies ? "" : "opacity-50"}`}
            >
              <div className="col-span-2 min-w-0 text-[12px] leading-5 text-[#1d1d1f] xl:col-span-1">
                {fuelItemLabel(i)}
                {i.midLabel && i.leafLabel && i.costType === "CAPEX" && <span className="ml-1 text-[10px] text-[#6e6e73]">{i.leafLabel}</span>}
                <span className="ml-1 align-middle"><ConfidenceTag value={i.confidence} /></span>
                <span className="block text-[10px] leading-4 text-[#6e6e73]">
                  {FUEL_SCOPE_LABEL[i.scenario as FuelScope] ?? i.scenario}・{fuelBasisLabelOf(i, current.scale)}{i.strain ? `・${STRAIN_LABEL[i.strain]}のときだけ` : ""}
                </span>
                {flueGasSwitch && (
                  <FlueGasSwitch
                    on={flueGasOn(flueGasSwitch)}
                    baselineOn={flueGasOn(savedFlueGas)}
                    onToggle={(on) => onChange("assumption", flueGasSwitch.costAssumptionId, "valueText", on ? "on" : "off")}
                  />
                )}
                {heatSwitch && (
                  <WasteHeatSwitch
                    on={wasteHeatOn(heatSwitch)}
                    baselineOn={wasteHeatOn(savedWasteHeat)}
                    onToggle={(on) => onChange("assumption", heatSwitch.costAssumptionId, "valueText", on ? "on" : "off")}
                  />
                )}
                {mediumSwitch && (
                  <WasteMediumSwitch
                    on={wasteMediumOn(mediumSwitch)}
                    baselineOn={wasteMediumOn(savedWasteMedium)}
                    reductionPct={mediumReduction}
                    onToggle={(on) => onChange("assumption", mediumSwitch.costAssumptionId, "valueText", on ? "on" : "off")}
                  />
                )}
              </div>
              <Cell label={`数量（${i.quantityUnit ?? ""}）`}>
                <NumberField
                  ariaLabel={`${fuelItemLabel(i)} 数量`}
                  value={i.quantity}
                  baseline={base?.quantity ?? i.quantity}
                  min={0}
                  compact
                  widthClass="w-full xl:w-14"
                  wrapperClass={FILL}
                  onChange={(v) => onChange("item", i.costItemId, "quantity", v ?? 0)}
                />
              </Cell>
              <Cell label={`単価（${i.unitPriceUnit ?? "円"}）`}>
                {i.priceRule === "culture_loss" ? (
                  <span className="min-h-[44px] w-full text-right text-[11px] leading-[44px] text-[#6e6e73] xl:min-h-0 xl:leading-normal">原料の合計</span>
                ) : (
                  <>
                    <NumberField
                      ariaLabel={`${fuelItemLabel(i)} ${i.priceRule === "co2_supply" ? "買値" : "単価"}`}
                      value={i.unitPrice}
                      baseline={base?.unitPrice ?? i.unitPrice}
                      min={0}
                      compact
                      widthClass="w-full xl:w-[5.5rem]"
                      wrapperClass={FILL}
                      onChange={(v) => onChange("item", i.costItemId, "unitPrice", v ?? 0)}
                    />
                    <span className="hidden w-8 shrink-0 text-[10px] text-[#6e6e73] xl:inline">{(i.unitPriceUnit ?? "").replace(/^円\//, "/")}</span>
                  </>
                )}
              </Cell>
              <Cell label="耐用年数">
                {i.basis === "初期投資配賦" || isScaledCapex(i) ? (
                  <NumberField
                    ariaLabel={`${fuelItemLabel(i)} 耐用年数`}
                    value={i.usefulLifeYears}
                    baseline={base?.usefulLifeYears ?? i.usefulLifeYears}
                    min={0.5}
                    compact
                    widthClass="w-full xl:w-12"
                    wrapperClass={FILL}
                    onChange={(v) => onChange("item", i.costItemId, "usefulLifeYears", v)}
                  />
                ) : (
                  <span className="min-h-[44px] w-full text-right leading-[44px] text-[#86868b] xl:min-h-0 xl:leading-normal">—</span>
                )}
              </Cell>
              <Cell label="円/L">
                <span className="min-h-[44px] w-full text-right text-[13px] font-semibold leading-[44px] tabular-nums text-[#1d1d1f] xl:min-h-0 xl:text-[11px] xl:font-normal xl:leading-normal">
                  {right === null ? "—" : num(right, 2)}
                </span>
              </Cell>
              <div className="col-span-2 flex flex-col gap-0.5 xl:col-span-5">
                {right !== null && <ItemCalcLine calc={fuelItemCalc(i, current, ctx)} />}
                <ItemNoteLine note={i.note} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 読み物から使う: 計算に使う前提か。 */
export function isFuelCalcRole(roleKey: string | null): boolean {
  return roleKey !== null && FUEL_ROLE_KEYS.has(roleKey) && !!fuelParamGroupOfRole(roleKey);
}
