"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  APPLICATION_LABEL,
  CO2_FLUE_GAS_ROLE,
  COST_PARAM_BLOCKS,
  COST_PARAM_GROUPS,
  COST_ROLE_KEYS,
  ITEM_BEARERS,
  ITEM_BEARER_LABEL,
  ITEM_BEARER_SHORT_LABEL,
  ITEM_INLINE_ROLES,
  LOCATION_SHORT_LABEL,
  METAL_SINGLE_USE_NOTE,
  METHOD_LABEL,
  PRODUCTION_SITE_DESCRIPTION,
  PRODUCTION_SITE_LABEL,
  PRODUCTION_TASK_DRIVERS,
  SCENARIO_SCOPE_LABEL,
  TASK_DRIVERS,
  TASK_DRIVER_LABEL,
  TASK_PERFORMERS,
  TASK_PERFORMER_LABEL,
  TASK_PERFORMER_SHORT_LABEL,
  TEXT_CHOICE_ROLES,
  annualAmount,
  biomassOf,
  centralItemPerKg,
  costItemCalc,
  costItemLabel,
  derivedOf,
  driverUsesCount,
  flueGasOn,
  paramGroupOfItem,
  paramGroupOfRole,
  resolveAssumption,
  resolveBearer,
  resolvePerformer,
  rolesInEffect,
  rowAppliesTo,
  taskAmount,
  type CostAssumption,
  type CostBiomassCost,
  type CostComputation,
  type CostItem,
  type CostItemBearer,
  type CostModelBundle,
  type CostParamGroup,
  type CostScenarioScope,
  type CostSelection,
  type CostTask,
  type CostTaskDriver,
  type CostTaskFlow,
  type CostTaskPerformer,
  type CostTankMode,
} from "@/lib/project-cost-model";
import type { DraftEntity, DraftField, DraftValue } from "@/lib/project-cost-model-draft";
import { CATEGORY_COLOR, ConfidenceTag, FlueGasSwitch, NumberField, ScopeTag, Segmented, int, num, yen } from "@/components/cockpit/CockpitCostModelParts";
import { CostTaskFlowOverview, stepAnchorId } from "@/components/cockpit/CockpitCostModelFlow";
import { findScenario, selectionLabel, type CostViewSelection } from "@/components/cockpit/CockpitCostModelResults";
import { CostBreakdownGuide, flashElement, type BreakdownGuideDriver } from "@/components/cockpit/CockpitCostBreakdownGuide";
import { ItemCalcLine, ItemNoteLine } from "@/components/cockpit/CockpitCostItemCalc";

// コスト試算タブの操作パネル。まだ確定できない数字を、すべてここで動かせるようにする (まさ 2026-09-13)。
// 書き換えはその場で再計算するだけで保存しない。保存は上の「保存していない変更」から admin が行う。
// 一番上に「総コストの内訳（大きい順）」を置き、区分の札を押すとその額を乗せている小分けへ移る
// (まさ 2026-09-14「右カラムに出てるこのサマリの内訳が、左カラムの一番上に出るようにしてほしい。一番大きく占めているところが左カラムのどこにあるのか分かりにくい」)。
// その次に「作業の流れと工数」を置き、作業リストも同じ段の順に並べる (まさ 2026-09-13)。
// 前提・作業・明細は「事業と処理の条件 / CAPEX / OPEX」の区分と、その中の小分け (COST_PARAM_GROUPS) に並べる
// (まさ 2026-09-14「ページのあちこちに散らばってて、どこにあるか分からん。CAPEXとOPEXに分けて、さらにそれぞれのサブグループに分けるなどして整理してほしい」)。
// 選んだ組み合わせで効かない前提は、明細や作業と同じく薄く出す (まさ 2026-09-14「オンサイトを選んだときもグレーアウトしてないのでグレーアウトさせて」)。
// 槽の既設・新設は、オンサイトの槽を SX が持つときだけ CAPEX の「槽」で選ぶ (上端には出さない。まさ 2026-09-14「特出しするものでもない」)。

export type CostChangeHandler = (entity: DraftEntity, id: string, field: DraftField, value: DraftValue) => void;

interface Props {
  /** 保存値。入力欄の「保存値と違う」の判定に使う。 */
  saved: CostModelBundle;
  /** 保存値に試算中の変更を重ねた束。 */
  working: CostModelBundle;
  computed: CostComputation;
  selection: CostViewSelection;
  /** 選んだ株・用途・方式の作業の流れ。 */
  flow: CostTaskFlow;
  unit: string;
  onChange: CostChangeHandler;
  /** 操作パネル自体がスクロールする枠か (デスクトップ)。目次の移動先を枠の中にする。 */
  scrollable: boolean;
  /** オンサイトの槽を SX が持つときの、既設・新設の切り替え。 */
  onSelectTankMode: (tankMode: CostTankMode) => void;
}

export function CostControlsPanel({ saved, working, computed, selection, flow, unit, onChange, scrollable, onSelectTankMode }: Props) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [showAllRows, setShowAllRows] = useState(false);
  // 選んだ方式の物量。オフサイトは対象物質の濃さを別に持てるので、使い切る菌体の量が方式で変わる。
  const derived = derivedOf(computed, selection.application, selection.location);
  const concentrationUnit =
    resolveAssumption(
      working.assumptions,
      selection.location === "offsite" && derived.offsiteConcentrationSeparate ? "offsite_target_concentration" : "target_concentration",
      { strain: selection.strain, application: selection.application }
    )?.unit ?? "";
  const scenario = findScenario(computed, selection.application, selection.location, selection.method, selection.tankMode);
  const biomass = biomassOf(computed, selection.application);
  const { strain, application } = selection;
  const tasks = working.tasks ?? [];

  // 前提は区分 (COST_PARAM_GROUPS) の role_key の順に、いまの株・用途で採られている行だけを並べる。
  // 金属回収の菌体使用回数は1回で固定なので、前提があっても出さない。
  const assumptionRows = useMemo(() => {
    const sel: CostSelection = { strain, application };
    const byGroup = new Map<string, CostAssumption[]>();
    for (const g of COST_PARAM_GROUPS) {
      const rows = g.roles.flatMap((role) => {
        if (role === "reuse_count" && application === "metal") return [];
        // 排ガス利用可能は CO2 の明細の行に出す (まさ 2026-09-14「CO2コストのところに設置してほしい」)
        if (ITEM_INLINE_ROLES.has(role)) return [];
        const a = resolveAssumption(working.assumptions, role, sel);
        return a ? [a] : [];
      });
      byGroup.set(g.key, rows);
    }
    // 区分が決まっていない計算用の前提 (ほかのPJ) は「事業と処理の条件」の最後にまとめる。
    const unplaced = working.assumptions.filter(
      (a) => a.roleKey !== null && COST_ROLE_KEYS.has(a.roleKey) && !paramGroupOfRole(a.roleKey) && resolveAssumption(working.assumptions, a.roleKey, sel) === a
    );
    return { byGroup, unplaced };
  }, [working.assumptions, strain, application]);

  // 選んだ組み合わせで値を変えても SX の数字が動かない前提 (オンサイトの新設槽の費用など) は薄く出す。
  const { location, method, tankMode } = selection;
  const inEffect = useMemo(
    () => rolesInEffect(working, { strain, application, location, method, tankMode }),
    [working, strain, application, location, method, tankMode]
  );
  const muted = (a: CostAssumption) => a.roleKey !== null && COST_ROLE_KEYS.has(a.roleKey) && !inEffect.has(a.roleKey);
  const mutedNote = `選んだ組み合わせ（${LOCATION_SHORT_LABEL[location]}・${METHOD_LABEL[method]}）では計算に使わない`;

  const allItems = working.items.filter((i) => !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考");
  const itemsOfGroup = (key: string) => allItems.filter((i) => paramGroupOfItem(i)?.key === key);

  const savedAssumption = (id: string) => saved.assumptions.find((a) => a.costAssumptionId === id)?.value ?? null;
  const savedAssumptionText = (id: string) => saved.assumptions.find((a) => a.costAssumptionId === id)?.valueText ?? null;

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
    jump(`cm-g-${groupKey}`);
    flashElement(`cm-g-${groupKey}`);
  };
  const groupTitleOf = (key: string) => COST_PARAM_GROUPS.find((g) => g.key === key)?.title;

  /** 区分の下に出す、いまの数字での割り算。 */
  const derivedBox = (key: string): ReactNode => {
    switch (key) {
      case "cond-scale":
        return biomass.fromVolume ? (
          <Formula testId="cost-business-scale">
            {biomass.offsiteVolumeSeparate ? "オンサイトの売上" : "売上"} ＝ 年間処理量 {int(biomass.onsiteVolume)} {unit} × 売価 {int(derived.salePrice)} 円/{unit} ＝{" "}
            <span className="font-semibold tabular-nums">{yen(biomass.onsiteVolume * derived.salePrice)}/年</span>。
            顧客1社あたり年 {int(derived.annualVolume)} {unit} で約{int(safeRatio(biomass.onsiteVolume, derived.annualVolume))}社分。
            {biomass.offsiteVolumeSeparate && (
              <>
                <br />
                オフサイトの売上 ＝ 年間処理量 {int(biomass.offsiteVolume)} {unit} × 売価 {int(derived.offsiteSalePrice)} 円/{unit} ＝{" "}
                <span className="font-semibold tabular-nums">{yen(biomass.offsiteVolume * derived.offsiteSalePrice)}/年</span>（約
                {num(safeRatio(biomass.offsiteVolume, derived.annualVolume), 1).replace(/\.0$/, "")}社分）。
              </>
            )}
            <br />
            {PRODUCTION_SITE_LABEL}で年に作る菌体は、{biomass.offsiteVolumeSeparate ? "オンサイトとオフサイトの年間処理量に、それぞれの濃さで使い切る菌体の量を掛けて足した量" : "この量"}から計算する（{selectionAppLabel(selection)}で{" "}
            <span className="font-semibold tabular-nums">{int(biomass.capacityKgYear / 1000)} t/年</span>・培養設備 {num(biomass.productionLines, 1)} 系列）。
          </Formula>
        ) : null;
      case "cond-site":
        return (
          <Formula>
            顧客1社の年間処理量 ＝ バッチ容量 × 稼働日 × 稼働率 ＝ <span className="font-semibold tabular-nums">{int(derived.annualVolume)} {unit}/年</span>（年間バッチ数 {num(derived.annualBatches, 0)}）
          </Formula>
        );
      case "cond-substance":
        return (
          <Formula testId="cost-substance-formula">
            {/* 選んだ方式の濃さで出す。オフサイトの濃さを別に置いているときは、どちらの濃さかを添える (まさ 2026-09-14「置いて」) */}
            {derived.offsiteConcentrationSeparate && (
              <>
                {LOCATION_SHORT_LABEL[selection.location]}の濃さ{" "}
                <span className="tabular-nums">{int(derived.targetConcentration)}{concentrationUnit}</span>
                {selection.location === "offsite" ? "（オフサイトで引き取る液の濃さ）" : "（顧客工場の排水の濃さ）"}で、
              </>
            )}
            必要な菌体 {num(derived.biomassWithLossPerM3, 0)} g/{unit}（濃度 ÷ 取り込み効率 ÷ 回収率）÷ 使用回数 {num(derived.reuseCount, 0)}
            {derived.reuseFixed && <span className="text-[#6e6e73]">（{METAL_SINGLE_USE_NOTE}）</span>} ＝ 使い切る菌体{" "}
            <span className="font-semibold tabular-nums">{num(derived.biomassKgPerUnit, 3)} kg/{unit}</span>
            {scenario && <>。菌体費は {num(biomass.perKg)} 円/kg × この量 ＝ <span className="font-semibold tabular-nums">{num(scenario.centralTotalPerUnit)} 円/{unit}</span></>}
          </Formula>
        );
      case "cond-biomass":
        return <BiomassFormula biomass={biomass} unit={unit} />;
      case "capex-production":
        return (
          <Formula>
            {biomass.fromVolume ? (
              <>
                年に作る量 {int(biomass.capacityKgYear)} kg ÷ 1系列 {int(biomass.lineCapacityKgYear)} kg ＝{" "}
                <span className="font-semibold tabular-nums">{num(biomass.productionLines, 1)} 系列</span>。初期投資{" "}
                <span className="font-semibold tabular-nums">{yen(biomass.capexInitial)}</span>（1系列 {yen(biomass.lineCapexInitial)}）
              </>
            ) : (
              <>初期投資 <span className="font-semibold tabular-nums">{yen(biomass.capexInitial)}</span></>
            )}
            。償却は菌体1kgあたり {num(biomass.rows.find((r) => r.key === "capex")?.perKg ?? 0)} 円として菌体費に入る
          </Formula>
        );
      case "capex-tank": {
        const capex = resolveAssumption(working.assumptions, "new_tank_capex", { strain, application })?.value ?? 0;
        const life = resolveAssumption(working.assumptions, "tank_life_years", { strain, application })?.value ?? 0;
        return (
          <Formula muted={!inEffect.has("new_tank_capex")}>
            新設した槽の償却 ＝ {yen(capex)} ÷ {num(life, 0)}年 ÷ 年間処理量 {int(derived.annualVolume)} {unit} ＝{" "}
            <span className="font-semibold tabular-nums">{num(safeRatio(safeRatio(capex, life), derived.annualVolume))} 円/{unit}</span>（SXが持つ槽だけ）
          </Formula>
        );
      }
      case "opex-labor":
        return (
          <Formula>
            作業リストの年間回数: 年間バッチ数 {num(derived.annualBatches, 0)}・訪問回数 {num(derived.visitsPerYear, 1)}・モジュール交換 {num(derived.moduleSwapsPerYear, 1)}・膜交換 {num(derived.membraneSwapsPerYear, 2)}・輸送 {int(derived.truckTripsPerYear)}・培養設備 {num(derived.productionLines, 1)} 系列（回/年）
          </Formula>
        );
      case "opex-transport":
        return (
          <Formula>
            訪問回数 ＝ 年間バッチ数 {num(derived.annualBatches, 0)} ÷ 大きい方（使用回数 {num(derived.reuseCount, 0)}、1回の搬入でまかなうバッチ数）＝{" "}
            <span className="font-semibold tabular-nums">{num(derived.visitsPerYear, 1)} 回/年</span>。輸送の回数 ＝ 年間処理量 {int(derived.annualVolume)} {unit} ÷ 1台の積載量 {num(derived.truckCapacity, 1)} ＝{" "}
            <span className="font-semibold tabular-nums">{int(derived.truckTripsPerYear)} 回/年</span>（オフサイトのときだけ効く）
          </Formula>
        );
      default:
        return null;
    }
  };

  const renderGroup = (g: CostParamGroup) => {
    const rows = [...(assumptionRows.byGroup.get(g.key) ?? []), ...(g.key === "cond-biomass" ? assumptionRows.unplaced : [])];
    const groupItems = itemsOfGroup(g.key);
    const visibleItems = showAllRows ? groupItems : groupItems.filter((i) => itemApplies(i, selection));
    const hasTasks = !!g.tasks && tasks.length > 0;
    const box = derivedBox(g.key);
    if (rows.length === 0 && groupItems.length === 0 && !hasTasks) return null;
    return (
      <section key={g.key} id={`cm-g-${g.key}`} aria-label={g.title} className="scroll-mt-12 border-t border-[#f0f0f2] pt-2 first:border-t-0 first:pt-0">
        <h5 className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[12px] font-semibold text-[#1d1d1f]">{g.title}</span>
          <span className="text-[10px] leading-4 text-[#6e6e73]">{g.hint}</span>
        </h5>
        {rows.length > 0 && (
          <ul className="flex flex-col divide-y divide-[#f0f0f2]">
            {rows.map((a) => (
              <AssumptionControl
                key={a.costAssumptionId}
                assumption={a}
                baseline={savedAssumption(a.costAssumptionId)}
                baselineText={savedAssumptionText(a.costAssumptionId)}
                onChange={onChange}
                mutedNote={muted(a) ? mutedNote : null}
              />
            ))}
            {g.key === "cond-scale" && <TargetControl saved={saved} working={working} unit={unit} onChange={onChange} />}
            {g.key === "capex-tank" && location === "onsite" && selection.onsiteTankBearer === "sx" && (
              <TankModeControl value={tankMode} onChange={onSelectTankMode} />
            )}
          </ul>
        )}
        {box}
        {hasTasks && <TaskList saved={saved} working={working} computed={computed} selection={selection} flow={flow} unit={unit} onChange={onChange} />}
        {groupItems.length > 0 &&
          (visibleItems.length > 0 ? (
            <ItemRows saved={saved} working={working} computed={computed} selection={selection} unit={unit} items={visibleItems} onChange={onChange} />
          ) : (
            <p className="mt-1 text-[11px] text-[#86868b]">選んだ組み合わせでは発生しない（{groupItems.length}行。上の「すべての行を出す」で見られる）</p>
          ))}
      </section>
    );
  };

  const blocks = COST_PARAM_BLOCKS.map((block) => {
    const groups = COST_PARAM_GROUPS.filter((g) => g.block === block.key);
    const rendered = groups.map((g) => ({ g, node: renderGroup(g) })).filter((x) => x.node !== null);
    return { block, rendered };
  }).filter((b) => b.rendered.length > 0);

  return (
    <div
      ref={paneRef}
      className={scrollable ? "h-full overflow-y-auto overscroll-contain" : ""}
      data-testid="cost-controls"
    >
      <nav
        aria-label="操作パネルの目次"
        className={`${scrollable ? "sticky top-0" : ""} z-10 flex flex-wrap items-center gap-x-0.5 gap-y-0 border-b border-[#e5e5e7] bg-white px-2 py-1`}
      >
        {scenario && (
          <button type="button" onClick={() => jump("cm-breakdown")} className={NAV_BUTTON}>
            内訳
          </button>
        )}
        {tasks.length > 0 && (
          <button type="button" onClick={() => jump("cm-flow")} className={NAV_BUTTON}>
            作業の流れと工数
          </button>
        )}
        {blocks.map(({ block }) => (
          <button key={block.key} type="button" onClick={() => jump(`cm-block-${block.key}`)} className={NAV_BUTTON}>
            {block.title}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAllRows((v) => !v)}
          aria-pressed={showAllRows}
          className="ml-auto min-h-[36px] rounded-md border border-[#d2d2d7] bg-white px-2 text-[11px] font-semibold text-[#3c3c43] hover:border-[#7cbceb] xl:min-h-[26px]"
          title="明細の行を、選んだ株・用途・方式・装置に効く行だけにするか、すべて出すか"
        >
          {showAllRows ? "選んだ組み合わせの行だけにする" : `すべての行を出す（明細${allItems.length}行）`}
        </button>
      </nav>
      <div className="flex flex-col gap-4 px-3 pb-6 pt-3">
        {scenario && (
          <CostBreakdownGuide
            id="cm-breakdown"
            testId="cost-breakdown-guide"
            slices={scenario.breakdown.map((x) => ({
              key: x.key,
              label: x.label,
              color: CATEGORY_COLOR[x.key],
              amount: x.perUnit,
              parts: x.parts.map((p) => ({ label: p.label, amount: p.perUnit, groupKey: p.groupKey })),
            }))}
            unit={unit}
            scenarioLabel={selectionLabel(selection)}
            groupTitle={groupTitleOf}
            drivers={COST_BREAKDOWN_DRIVERS}
            onJump={jumpToGroup}
          />
        )}
        {tasks.length > 0 && (
          <section id="cm-flow" aria-label="作業の流れと工数" className="scroll-mt-12">
            <h4 className="mb-1 text-[12px] font-semibold text-[#1d1d1f]">作業の流れと工数</h4>
            <CostTaskFlowOverview flow={flow} unit={unit} scenarioLabel={selectionLabel(selection)} onJumpStep={(label) => jump(stepAnchorId(label))} />
          </section>
        )}
        {blocks.map(({ block, rendered }) => (
          <section key={block.key} id={`cm-block-${block.key}`} aria-label={block.title} className="scroll-mt-12 rounded-lg border border-[#e5e5e7] px-2.5 py-2">
            <h4 className="text-[13px] font-semibold text-[#1d1d1f]">{block.title}</h4>
            <p className="text-[10px] leading-4 text-[#6e6e73]">{block.hint}</p>
            <div className="mt-1 flex flex-wrap gap-x-1 gap-y-0.5" aria-label={`${block.title}の区分`}>
              {rendered.map(({ g }) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => jump(`cm-g-${g.key}`)}
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

const NAV_BUTTON = "min-h-[36px] shrink-0 rounded-md px-2 text-[11px] font-semibold text-[#3c3c43] hover:bg-[#e8f3fc] hover:text-[#0267b2] xl:min-h-[26px]";

/**
 * 内訳の区分の額を比例して動かす前提 (金額の行ではない)。菌体費は使い切る菌体の量と、菌体1kgの原価の割り算 (販売率・上書き) で動く。
 * 運ぶは、運ぶ回数と台数を決める前提で動く (工数と経費は人件費の作業)。
 */
const COST_BREAKDOWN_DRIVERS: Record<string, BreakdownGuideDriver[]> = {
  biomass: [
    { groupKey: "cond-substance", label: "対象物質と菌体の量（使い切る菌体の量）" },
    { groupKey: "cond-biomass", label: "菌体の製造量と原価（販売率・上書き）" },
  ],
  transport: [{ groupKey: "opex-transport", label: "運ぶ（回数と台数を決める前提）" }],
};

/** 前提の下に出す、いまの数字での割り算の箱。選んだ組み合わせで効かない割り算は薄く出す。 */
function Formula({ children, testId, muted = false }: { children: ReactNode; testId?: string; muted?: boolean }) {
  return (
    <p className={`mt-1.5 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43] ${muted ? "opacity-50" : ""}`} data-testid={testId}>
      {children}
    </p>
  );
}

/** スマホ幅で入力欄をマスいっぱいに広げる。 */
const FILL = "flex w-full items-center gap-1 xl:inline-flex xl:w-auto";

/** 表の1マス。スマホ幅は見出しを上・入力を下に置き、デスクトップは見出しを表の頭に出して入力だけを置く。 */
function Cell({
  label,
  children,
  className = "",
  align = "end",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="ml-1 rounded px-1 text-[10px] font-semibold text-[#0267b2] hover:underline"
      >
        {open ? "説明を閉じる" : "説明"}
      </button>
      {open && <span className="mt-0.5 block text-[11px] leading-5 text-[#6e6e73]">{note}</span>}
    </>
  );
}

function AssumptionControl({
  assumption: a,
  baseline,
  baselineText,
  onChange,
  mutedNote,
}: {
  assumption: CostAssumption;
  baseline: number | null;
  baselineText: string | null;
  onChange: CostChangeHandler;
  /** 選んだ組み合わせで計算に使わないとき、その理由。薄く出して title に添える (書き換えはできる)。 */
  mutedNote: string | null;
}) {
  const choices = a.roleKey ? TEXT_CHOICE_ROLES[a.roleKey] : undefined;
  const rowClass = `flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:gap-2 ${mutedNote ? "opacity-50" : ""}`;
  if (choices) {
    const current = a.valueText ?? choices[choices.length - 1].value;
    return (
      <li className={rowClass} title={mutedNote ?? undefined}>
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
              (baselineText ?? choices[choices.length - 1].value) !== current ? "border-[#027fdc] bg-[#e8f3fc]" : "border-[#d2d2d7] bg-white"
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
  const isSalesRate = a.roleKey === "sales_rate";
  const set = (v: number | null) => onChange("assumption", a.costAssumptionId, "value", v);
  return (
    <li className={rowClass} title={mutedNote ?? undefined}>
      <div className="min-w-0 flex-1 text-[12px] leading-5 text-[#1d1d1f]">
        {a.label}
        <ScopeTag strain={a.strain} application={a.application} />
        <span className="ml-1 align-middle"><ConfidenceTag value={a.confidence} /></span>
        <NoteToggle note={a.note} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {isSalesRate && (
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            aria-label={`${a.label}（つまみ）`}
            value={a.value ?? 100}
            onChange={(e) => set(Number(e.target.value))}
            className="w-28 accent-[#027fdc]"
          />
        )}
        <NumberField
          ariaLabel={a.label}
          value={a.value}
          baseline={baseline}
          onChange={set}
          allowNull={isOverride}
          min={isSalesRate ? 1 : undefined}
          max={isSalesRate ? 100 : undefined}
          placeholder={isOverride ? "空欄＝計算値" : undefined}
          // 3桁カンマ入りの大きい数字（20,000,000 など）がスマホの16pxでも欄に収まる幅
          widthClass="w-36 xl:w-24"
        />
        <span className="w-16 text-[11px] text-[#6e6e73]">{a.unit}</span>
      </div>
    </li>
  );
}

/** オンサイトの槽を SX が持つときだけ、既設か新設かを選ぶ (槽を顧客が持つとき・オフサイトは選ぶものが無いので出さない)。 */
function TankModeControl({ value, onChange }: { value: CostTankMode; onChange: (tankMode: CostTankMode) => void }) {
  return (
    <li className="flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:gap-2">
      <div className="min-w-0 flex-1 text-[12px] leading-5 text-[#1d1d1f]">
        オンサイトの槽は既設か新設か
        <span className="block text-[10px] leading-4 text-[#6e6e73]">既設はSXの負担0円、新設は新設槽CAPEX ÷ 償却年数</span>
      </div>
      <Segmented
        ariaLabel="オンサイトの槽の既設・新設"
        options={(["既設", "新設"] as CostTankMode[]).map((t) => ({ value: t, label: t }))}
        value={value}
        onChange={onChange}
      />
    </li>
  );
}

function TargetControl({
  saved,
  working,
  unit,
  onChange,
}: {
  saved: CostModelBundle;
  working: CostModelBundle;
  unit: string;
  onChange: CostChangeHandler;
}) {
  const offsitePriced = typeof resolveAssumption(working.assumptions, "offsite_sale_price")?.value === "number";
  return (
    <li className="flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:gap-2">
      <div className="min-w-0 flex-1 text-[12px] leading-5 text-[#1d1d1f]">
        総コスト目標{offsitePriced ? "（オンサイト）" : ""}
        <NoteToggle note={working.model.targetNote} />
        {offsitePriced && <span className="block text-[10px] leading-4 text-[#6e6e73]">売価を別に置いたオフサイトは、売価との差だけを見る</span>}
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
        <span className="w-16 text-[11px] text-[#6e6e73]">円/{unit}</span>
      </div>
    </li>
  );
}

const safeRatio = (a: number, b: number) => (b > 0 ? a / b : 0);
/** 菌体の製造拠点の作業にだけ使う回数の決め方。現場の作業の選択肢には出さない。 */
const PRODUCTION_ONLY_DRIVERS = new Set<CostTaskDriver>(["production_line"]);
const selectionAppLabel = (selection: CostViewSelection) => (selection.application ? APPLICATION_LABEL[selection.application] : "この試算");

/** 第1段の割り算を、いまの数字で見せる。年に作る量は年間処理量から計算し、培養設備を系列の数だけ並べる。 */
function BiomassFormula({ biomass: b, unit }: { biomass: CostBiomassCost; unit: string }) {
  const r = b.salesRate;
  const row = (key: string) => b.rows.find((x) => x.key === key)?.perKg ?? 0;
  const life =
    b.usefulLifeMinYears === null ? "—"
    : b.usefulLifeMinYears === b.usefulLifeMaxYears ? `${b.usefulLifeMinYears}年`
    : `${b.usefulLifeMinYears}〜${b.usefulLifeMaxYears}年`;
  const perLine = (total: string, line: string) => (b.fromVolume ? `${total}（1系列 ${line} × ${num(b.productionLines, 1)}系列）` : total);
  const produced = `生産 ${int(b.capacityKgYear)}kg`;
  const lines: Array<[string, string, number]> = [
    ["培養設備の償却", `初期投資 ${perLine(yen(b.capexInitial), yen(b.lineCapexInitial))} ÷ 耐用 ${life} ÷ ${produced}`, row("capex")],
    ["年ごとの固定費", `年 ${perLine(yen(b.fixedOpexAnnual), yen(safeRatio(b.fixedOpexAnnual, b.productionLines)))} ÷ ${produced}`, row("fixed")],
    [
      "製造拠点の作業",
      b.fromVolume
        ? `年 ${yen(b.tasksAnnual)}（系列ごと ${yen(b.lineTasksAnnual)} ＋ 拠点に1つ ${yen(b.siteTasksAnnual)}）÷ ${produced}`
        : `年 ${yen(b.tasksAnnual)} ÷ ${produced}（作業リスト）`,
      row("tasks"),
    ],
    ["菌体量に比例する費用", "培地・CO2・濃縮など 1kgあたりの単価", row("variable")],
  ];
  return (
    <div className="mb-1.5 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43]" data-testid="cost-biomass-formula">
      <p className="font-semibold text-[#1d1d1f]">
        {b.strainLabel ? `${b.strainLabel}の` : ""}菌体1kgの原価{" "}
        <span className="tabular-nums">{num(b.perKg)} 円/kg</span>
        <span className="font-normal text-[#6e6e73]">（{PRODUCTION_SITE_LABEL}＝{PRODUCTION_SITE_DESCRIPTION}）</span>
      </p>
      {b.fromVolume && (
        <p className="mt-0.5" data-testid="cost-production-formula">
          {/* オフサイトは引き取る液の濃さが違うので、方式ごとに使い切る菌体の量を掛けてから足す (まさ 2026-09-14「置いて」) */}
          {b.offsiteVolumeSeparate
            ? `年に作る量 ＝（オンサイト ${int(b.onsiteVolume)} ${unit} × 使い切る菌体 ${num(b.onsiteBiomassKgPerUnit, 3)} kg/${unit} ＋ オフサイト ${int(b.offsiteVolume)} ${unit} × 使い切る菌体 ${num(b.offsiteBiomassKgPerUnit, 3)} kg/${unit}）`
            : `年に作る量 ＝ 年間処理量 ${int(b.businessVolume)} ${unit} × 使い切る菌体 ${num(b.onsiteBiomassKgPerUnit, 3)} kg/${unit}`}
          {r < 1 ? ` ÷ 販売率 ${num(r * 100, 0)}%` : ""} ＝ <span className="font-semibold tabular-nums">{int(b.capacityKgYear)} kg/年</span>
          <span className="text-[#6e6e73]">
            {" "}→ 培養設備1系列 {int(b.lineCapacityKgYear)} kg/年 で {num(b.productionLines, 1)} 系列。系列ごとの費用は1kgあたり変わらず、拠点に1つの作業だけが量で薄まる
          </span>
        </p>
      )}
      <ul className="mt-0.5">
        {lines.map(([label, formula, perKg]) => (
          <li key={label} className="flex justify-between gap-2">
            <span className="min-w-0">
              {label}
              <span className="ml-1 text-[10px] text-[#6e6e73]">{formula}{r < 1 ? ` ÷ 販売率 ${num(r * 100, 0)}%` : ""}</span>
            </span>
            <span className="shrink-0 tabular-nums">{num(perKg)}</span>
          </li>
        ))}
      </ul>
      {b.overridePerKg !== null && (
        <p className="mt-0.5 font-semibold text-[#b45309]">上書き値 {num(b.overridePerKg)} 円/kg{r < 1 ? ` ÷ 販売率 ${num(r * 100, 0)}%` : ""} で第2段を計算中</p>
      )}
    </div>
  );
}

function taskApplies(task: CostTask, selection: CostViewSelection) {
  return rowAppliesTo(task, selection.location, selection.method, { strain: selection.strain, application: selection.application });
}

function TaskList({
  saved,
  working,
  computed,
  selection,
  flow,
  unit,
  onChange,
}: {
  saved: CostModelBundle;
  working: CostModelBundle;
  computed: CostComputation;
  selection: CostViewSelection;
  flow: CostTaskFlow;
  unit: string;
  onChange: CostChangeHandler;
}) {
  const sel: CostSelection = { strain: selection.strain, application: selection.application };
  const derived = derivedOf(computed, selection.application, selection.location);
  // 製造拠点の作業は、拠点に1つの作業 (固定の回数) か培養設備の系列ごと (derived.productionLines を掛ける) で数える。
  const centralSel: CostSelection = { strain: selection.strain, application: null };
  const b = biomassOf(computed, selection.application);
  const tasks = [...(working.tasks ?? [])].sort((x, y) => x.sortOrder - y.sortOrder);
  const scenario = findScenario(computed, selection.application, selection.location, selection.method, selection.tankMode);
  const commonRate = resolveAssumption(working.assumptions, "labor_rate", sel)?.value ?? 4000;
  const groups = [...new Set(tasks.map((t) => t.groupLabel ?? "作業"))];

  const perUnitOf = (t: CostTask) => {
    if (!taskApplies(t, selection) || resolvePerformer(t, selection.location) === "customer") return null;
    if (t.scenario === "中央培養") {
      const annual = taskAmount(t, working.assumptions, derived, centralSel).annual;
      return b.capacityKgYear > 0 ? (annual / b.capacityKgYear / b.salesRate) * derived.biomassKgPerUnit : 0;
    }
    return derived.annualVolume > 0 ? taskAmount(t, working.assumptions, derived, sel).annual / derived.annualVolume : 0;
  };

  return (
    <div>
      <p className="mb-1.5 mt-1.5 text-[11px] leading-5 text-[#6e6e73]">
        年額 ＝ 年間回数 ×（1回の工数 × 作業単価 {int(commonRate)}円/時 ＋ 1回の経費）。作業単価は上の共通の1つで、作業ごとには持たない。工数が空欄の行は未確認で、0時間として数える。
        {PRODUCTION_SITE_LABEL}の作業は菌体費に入り、年間回数は「固定の回数」（拠点に1つの作業）か「系列ごと」（培養設備1系列あたりの回数 × 系列数）で数える。「誰がやるか」が顧客の作業は、SXの原価にも作業時間にも数えない（円/{unit}は「—」）。段は「作業の流れと工数」と同じ順。選んだ方式・装置で発生しない段と行は薄く出す。
      </p>
      <div className="hidden xl:grid xl:grid-cols-[minmax(0,1fr)_78px_150px_92px_56px] xl:gap-x-1.5 xl:border-b xl:border-[#e5e5e7] xl:pb-1 xl:text-[10px] xl:font-medium xl:text-[#6e6e73]">
        <span>作業</span>
        <span className="text-right">1回の工数(時)</span>
        <span>年間回数</span>
        <span className="text-right">1回の経費(円)</span>
        <span className="text-right">円/{unit}</span>
      </div>
      {groups.map((g) => {
        const stepIndex = flow.steps.findIndex((s) => s.label === g);
        const step = stepIndex >= 0 ? flow.steps[stepIndex] : null;
        return (
        <div key={g} id={stepAnchorId(g)} className="mt-1.5 scroll-mt-12">
          <p className={`flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold ${step ? "text-[#1d1d1f]" : "text-[#86868b]"}`}>
            <span>{step ? `${stepIndex + 1}. ` : ""}{g}</span>
            <span className="text-[10px] font-normal text-[#6e6e73]">
              {!step
                ? "選んだ方式・装置では発生しない"
                : step.rows.every((r) => r.performer === "customer")
                  ? "顧客がやる（SXの原価に入れない）"
                  : [
                      `SX 年 ${int(step.siteHours + step.productionHours)}時間${step.productionHours > 0 && step.siteHours === 0 ? "（拠点全体）" : ""}`,
                      `${num(step.perUnit)} 円/${unit}`,
                      step.unknownCount > 0 ? `工数未確認 ${step.unknownCount}件` : null,
                    ].filter(Boolean).join("・")}
            </span>
          </p>
          <ul className="flex flex-col divide-y divide-[#f0f0f2]">
            {tasks
              .filter((t) => (t.groupLabel ?? "作業") === g)
              .map((t) => {
                const base = (saved.tasks ?? []).find((x) => x.costTaskId === t.costTaskId);
                const applies = taskApplies(t, selection);
                const amt = taskAmount(t, working.assumptions, derived, t.scenario === "中央培養" ? centralSel : sel);
                const perUnit = perUnitOf(t);
                const isCentral = t.scenario === "中央培養";
                const doneBy = resolvePerformer(t, selection.location);
                return (
                  <li
                    key={t.costTaskId}
                    className={`grid grid-flow-row-dense grid-cols-2 gap-x-2 gap-y-1 py-1.5 xl:grid-flow-row xl:grid-cols-[minmax(0,1fr)_78px_150px_92px_56px] xl:items-center xl:gap-x-1.5 ${applies ? "" : "opacity-50"}`}
                  >
                    <div className="col-span-2 min-w-0 text-[12px] leading-5 text-[#1d1d1f] xl:col-span-1">
                      {t.label}
                      <ScopeTag strain={t.strain} application={t.application} />
                      <span className="ml-1 align-middle"><ConfidenceTag value={t.confidence} /></span>
                      <span className="block text-[10px] leading-4 text-[#6e6e73]">
                        {SCENARIO_SCOPE_LABEL[t.scenario as CostScenarioScope]}
                        {doneBy === "customer" ? (
                          <span className="font-semibold text-[#3c3c43]">・顧客がやる（SXの原価に入れない）</span>
                        ) : (
                          <>
                            ・年 {yen(amt.annual)}
                            {amt.annualHours > 0 ? `（${num(amt.annualHours, 0)}時間）` : ""}
                            {t.countDriver === "production_line" && `（1系列 ${num(t.countPerYear ?? 0, 0)}回 × ${num(derived.productionLines, 1)}系列）`}
                          </>
                        )}
                        <NoteToggle note={t.note} />
                      </span>
                      {!isCentral && (
                        <label className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] text-[#6e6e73]">
                          <span className="whitespace-nowrap">誰がやるか</span>
                          <select
                            aria-label={`${t.label} 誰がやるか`}
                            value={t.performer}
                            title={TASK_PERFORMER_LABEL[t.performer]}
                            onChange={(e) => onChange("task", t.costTaskId, "performer", e.target.value as CostTaskPerformer)}
                            className={`min-h-[36px] max-w-full rounded-md border px-1 text-[16px] text-[#1d1d1f] xl:h-6 xl:min-h-0 xl:text-[11px] ${
                              base && base.performer !== t.performer ? "border-[#027fdc] bg-[#e8f3fc]" : "border-[#d2d2d7] bg-white"
                            }`}
                          >
                            {TASK_PERFORMERS.map((pf) => (
                              <option key={pf} value={pf}>{TASK_PERFORMER_SHORT_LABEL[pf]}</option>
                            ))}
                          </select>
                          {t.performer === "site" && <span className="whitespace-nowrap">（オンサイトは顧客・オフサイトはSX）</span>}
                        </label>
                      )}
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
                    <Cell label="年間回数" className="col-span-2 xl:col-span-1" align="start">
                      <select
                        aria-label={`${t.label} 年間回数の決め方`}
                        value={t.countDriver}
                        title={isCentral ? `${PRODUCTION_SITE_LABEL}の作業は、拠点に1つの作業（固定の回数）か、培養設備の系列ごと（1系列あたりの回数 × 系列数）。系列ごとのときは回数の欄に1系列あたりの回数を入れる` : undefined}
                        onChange={(e) => {
                          const next = e.target.value as CostTaskDriver;
                          if (driverUsesCount(next) && t.countPerYear === null) {
                            onChange("task", t.costTaskId, "countPerYear", Math.round(amt.occurrences * 100) / 100);
                          }
                          onChange("task", t.costTaskId, "countDriver", next);
                        }}
                        className={`min-h-[44px] min-w-0 flex-1 rounded-md border px-1 text-[16px] text-[#1d1d1f] xl:h-7 xl:min-h-0 xl:max-w-[6.75rem] xl:flex-none xl:text-[11px] ${
                          base && base.countDriver !== t.countDriver ? "border-[#027fdc] bg-[#e8f3fc]" : "border-[#d2d2d7] bg-white"
                        }`}
                      >
                        {(isCentral ? PRODUCTION_TASK_DRIVERS : TASK_DRIVERS.filter((d) => !PRODUCTION_ONLY_DRIVERS.has(d))).map((d) => (
                          <option key={d} value={d}>{TASK_DRIVER_LABEL[d]}</option>
                        ))}
                      </select>
                      {driverUsesCount(t.countDriver) || isCentral ? (
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
                        </>
                      ) : (
                        <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-[#1d1d1f] xl:w-auto xl:text-[11px]">
                          {num(amt.occurrences, amt.occurrences < 10 ? 2 : 0)}回
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
                    <Cell label={`円/${unit}`}>
                      <span className="min-h-[44px] w-full text-right text-[13px] font-semibold leading-[44px] tabular-nums text-[#1d1d1f] xl:min-h-0 xl:text-[11px] xl:font-normal xl:leading-normal">
                        {perUnit === null ? "—" : num(perUnit)}
                      </span>
                    </Cell>
                  </li>
                );
              })}
          </ul>
        </div>
        );
      })}
      {scenario && (
        <p className="mt-1.5 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43]">
          選んだ方式・装置でSXがやる作業（運ぶ・運転・保守・管理） <span className="font-semibold tabular-nums">{num(scenario.siteTaskPerUnit)} 円/{unit}</span>
          （年 {yen(scenario.siteTaskAnnual)}・{int(scenario.siteTaskHours)}時間）。
{PRODUCTION_SITE_LABEL}の作業は年 {yen(b.tasksAnnual)}（{int(b.taskHoursAnnual)}時間）で、菌体1kgあたり {num(b.rows.find((r) => r.key === "tasks")?.perKg ?? 0)} 円として菌体費に入る。
        </p>
      )}
    </div>
  );
}

function itemApplies(item: CostItem, selection: CostViewSelection) {
  return rowAppliesTo(item, selection.location, selection.method, { strain: selection.strain, application: selection.application });
}

/**
 * 区分の明細の行。数量・単価・耐用年数・誰が持つかを動かす。前提から計算する行は、同じ区分の前提で動かす。
 * 数量 × 単価 は行の「〜あたり」の額なので、右端の額までの掛け算を行の下に「計算」として出し、数の出どころを「根拠」として出す
 * (まさ 2026-09-14「そもそも「数量」「単価」って何？…これに数量をかけると右の「円/L」になる？ならないよね？」)。
 */
function ItemRows({
  saved,
  working,
  computed,
  selection,
  unit,
  items,
  onChange,
}: {
  saved: CostModelBundle;
  working: CostModelBundle;
  computed: CostComputation;
  selection: CostViewSelection;
  unit: string;
  items: CostItem[];
  onChange: CostChangeHandler;
}) {
  const sel: CostSelection = { strain: selection.strain, application: selection.application };
  const centralSel: CostSelection = { strain: selection.strain, application: null };
  const derived = derivedOf(computed, selection.application, selection.location);
  const b = biomassOf(computed, selection.application);
  // CO2 の行に置く「排ガス利用可能」のスイッチ。前提が無い試算 (ほかのPJ) には出さない
  const flueGas = resolveAssumption(working.assumptions, CO2_FLUE_GAS_ROLE, centralSel);
  const savedFlueGas = flueGas ? saved.assumptions.find((a) => a.costAssumptionId === flueGas.costAssumptionId) : undefined;

  return (
    <div className="mt-1.5">
      <div className="hidden xl:grid xl:grid-cols-[minmax(0,1fr)_64px_128px_64px_56px] xl:gap-x-1.5 xl:border-b xl:border-[#e5e5e7] xl:pb-1 xl:text-[10px] xl:font-medium xl:text-[#6e6e73]">
        <span>明細（行の下に計算と根拠）</span>
        <span className="text-right" title="行の「〜あたり」（1系列・菌体1kg・処理量1単位 など）に使う量。単位は行の下の計算に出す">数量</span>
        <span className="text-right" title="数量の単位1つあたりの値段">単価</span>
        <span className="text-right">耐用年数</span>
        <span className="text-right" title={`数量 × 単価 を右端の単位に直した額（菌体の製造拠点の行は円/kg）。掛け算は行の下の計算に出す`}>円/{unit}</span>
      </div>
      <ul className="flex flex-col divide-y divide-[#f0f0f2]">
        {items.map((i) => {
          const base = saved.items.find((x) => x.costItemId === i.costItemId);
          const applies = itemApplies(i, selection);
          const isCentral = i.scenario === "中央培養";
          const paidBy = resolveBearer(i, selection.location);
          const right = !applies || paidBy === "customer"
            ? null
            : isCentral
              ? centralItemPerKg(i, working.assumptions, b.lineCapacityKgYear, centralSel, working.items)
              : derived.annualVolume > 0 ? annualAmount(i, working.assumptions, derived, sel, working.items) / derived.annualVolume : 0;
          const flueGasSwitch = i.priceRule === "co2_supply" && flueGas;
          const flueGasActive = !!flueGasSwitch && flueGasOn(flueGas);
          return (
            <li
              key={i.costItemId}
              className={`grid grid-cols-2 gap-x-2 gap-y-1 py-1.5 xl:grid-cols-[minmax(0,1fr)_64px_128px_64px_56px] xl:items-center xl:gap-x-1.5 ${applies ? "" : "opacity-50"}`}
            >
              <div className="col-span-2 min-w-0 text-[12px] leading-5 text-[#1d1d1f] xl:col-span-1">
                {costItemLabel(i)}
                <ScopeTag strain={i.strain} application={i.application} />
                <span className="ml-1 align-middle"><ConfidenceTag value={i.confidence} /></span>
                <span className="block text-[10px] leading-4 text-[#6e6e73]">
                  {SCENARIO_SCOPE_LABEL[i.scenario as CostScenarioScope]}・{i.basis}{i.groupLabel ? `・${i.groupLabel}` : ""}
                  {paidBy === "customer" && <span className="font-semibold text-[#3c3c43]">・顧客が持つ（SXの原価に入れない）</span>}
                </span>
                {!isCentral && (
                  <label className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] text-[#6e6e73]">
                    <span className="whitespace-nowrap">誰が持つか</span>
                    <select
                      aria-label={`${costItemLabel(i)} 誰が持つか`}
                      value={i.bearer}
                      title={ITEM_BEARER_LABEL[i.bearer]}
                      onChange={(e) => onChange("item", i.costItemId, "bearer", e.target.value as CostItemBearer)}
                      className={`min-h-[36px] max-w-full rounded-md border px-1 text-[16px] text-[#1d1d1f] xl:h-6 xl:min-h-0 xl:text-[11px] ${
                        base && base.bearer !== i.bearer ? "border-[#027fdc] bg-[#e8f3fc]" : "border-[#d2d2d7] bg-white"
                      }`}
                    >
                      {ITEM_BEARERS.map((bv) => (
                        <option key={bv} value={bv}>{ITEM_BEARER_SHORT_LABEL[bv]}</option>
                      ))}
                    </select>
                    {i.bearer === "site" && <span className="whitespace-nowrap">（オンサイトは顧客・オフサイトはSX）</span>}
                  </label>
                )}
                {flueGasSwitch && (
                  <FlueGasSwitch
                    on={flueGasActive}
                    baselineOn={flueGasOn(savedFlueGas)}
                    onToggle={(on) => onChange("assumption", flueGasSwitch.costAssumptionId, "valueText", on ? "on" : "off")}
                  />
                )}
              </div>
              <Cell label="数量">
                <NumberField
                  ariaLabel={`${costItemLabel(i)} 数量`}
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
                {i.priceRule && i.priceRule !== "co2_supply" ? (
                  <span className="min-h-[44px] w-full text-right text-[11px] leading-[44px] text-[#6e6e73] xl:min-h-0 xl:leading-normal">
                    {i.priceRule === "culture_loss" ? "原料の合計" : "前提から計算"}
                  </span>
                ) : (
                  <>
                    <NumberField
                      ariaLabel={`${costItemLabel(i)} ${i.priceRule === "co2_supply" ? "買値" : "単価"}`}
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
                {i.basis === "初期投資配賦" ? (
                  <NumberField
                    ariaLabel={`${costItemLabel(i)} 耐用年数`}
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
              <Cell label={isCentral ? "円/kg" : `円/${unit}`}>
                <span className="min-h-[44px] w-full text-right text-[13px] font-semibold leading-[44px] tabular-nums text-[#1d1d1f] xl:min-h-0 xl:text-[11px] xl:font-normal xl:leading-normal">
                  {right === null ? "—" : num(right, 2)}
                  {right !== null && isCentral && <span className="ml-0.5 hidden text-[9px] font-normal text-[#6e6e73] xl:inline">/kg</span>}
                </span>
              </Cell>
              <div className="col-span-2 flex flex-col gap-0.5 xl:col-span-5">
                {right !== null && (
                  <ItemCalcLine calc={costItemCalc(i, working.assumptions, derived, sel, { capacity: b.lineCapacityKgYear, sel: centralSel }, unit, working.items)} />
                )}
                <ItemNoteLine note={i.note} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

