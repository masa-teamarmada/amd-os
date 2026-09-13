"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  COST_ROLE_KEYS,
  PRODUCTION_SITE_DESCRIPTION,
  PRODUCTION_SITE_LABEL,
  SCENARIO_SCOPE_LABEL,
  TASK_DRIVERS,
  TASK_DRIVER_LABEL,
  annualAmount,
  centralItemPerKg,
  costItemLabel,
  resolveAssumption,
  scopeApplies,
  taskAmount,
  type CostAssumption,
  type CostComputation,
  type CostItem,
  type CostModelBundle,
  type CostScenarioScope,
  type CostSelection,
  type CostTask,
  type CostTaskDriver,
} from "@/lib/project-cost-model";
import type { DraftEntity, DraftField, DraftValue } from "@/lib/project-cost-model-draft";
import { ConfidenceTag, NumberField, ScopeTag, int, num, yen } from "@/components/cockpit/CockpitCostModelParts";
import type { CostViewSelection } from "@/components/cockpit/CockpitCostModelResults";

// コスト試算タブの操作パネル。まだ確定できない数字を、すべてここで動かせるようにする (まさ 2026-09-13)。
// 書き換えはその場で再計算するだけで保存しない。保存は上の「保存していない変更」から admin が行う。

export type CostChangeHandler = (entity: DraftEntity, id: string, field: DraftField, value: DraftValue) => void;

interface Props {
  /** 保存値。入力欄の「保存値と違う」の判定に使う。 */
  saved: CostModelBundle;
  /** 保存値に試算中の変更を重ねた束。 */
  working: CostModelBundle;
  computed: CostComputation;
  selection: CostViewSelection;
  unit: string;
  onChange: CostChangeHandler;
  /** 操作パネル自体がスクロールする枠か (デスクトップ)。目次の移動先を枠の中にする。 */
  scrollable: boolean;
}

interface Section {
  id: string;
  title: string;
  node: ReactNode;
}

export function CostControlsPanel({ saved, working, computed, selection, unit, onChange, scrollable }: Props) {
  const paneRef = useRef<HTMLDivElement>(null);
  const derived = computed.derivedByApplication.find((d) => d.application === selection.application)?.derived ?? computed.derived;
  const scenario = computed.scenarios.find(
    (s) => s.application === selection.application && s.method === selection.method && s.tankMode === selection.tankMode
  );

  // 操作パネルに出す前提 = 計算が読む role_key で、いまの株・用途で実際に採られている行。
  const { strain, application } = selection;
  const groups = useMemo(() => {
    const sel: CostSelection = { strain, application };
    const shown = working.assumptions.filter(
      (a) => a.roleKey !== null && COST_ROLE_KEYS.has(a.roleKey) && resolveAssumption(working.assumptions, a.roleKey, sel) === a
    );
    const byGroup = new Map<string, CostAssumption[]>();
    for (const a of [...shown].sort((x, y) => x.sortOrder - y.sortOrder)) {
      const list = byGroup.get(a.groupLabel) ?? [];
      list.push(a);
      byGroup.set(a.groupLabel, list);
    }
    return [...byGroup.entries()].map(([title, rows]) => ({ title, rows, minSort: Math.min(...rows.map((r) => r.sortOrder)) }));
  }, [working.assumptions, strain, application]);

  const savedAssumption = (id: string) => saved.assumptions.find((a) => a.costAssumptionId === id)?.value ?? null;
  const roles = (rows: CostAssumption[]) => new Set(rows.map((r) => r.roleKey));

  const renderGroup = (g: (typeof groups)[number]): Section => {
    const rs = roles(g.rows);
    return {
      id: `cm-group-${g.minSort}`,
      title: g.title,
      node: (
        <>
          {(rs.has("culture_capacity_kg_year") || rs.has("sales_rate")) && <BiomassFormula computed={computed} />}
          <ul className="flex flex-col divide-y divide-[#f0f0f2]">
            {g.rows.map((a) => (
              <AssumptionControl key={a.costAssumptionId} assumption={a} baseline={savedAssumption(a.costAssumptionId)} onChange={onChange} />
            ))}
            {rs.has("sale_price") && (
              <TargetControl saved={saved} working={working} unit={unit} onChange={onChange} />
            )}
          </ul>
          {(rs.has("target_concentration") || rs.has("uptake_alpha") || rs.has("reuse_count")) && (
            <p className="mt-1.5 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43]">
              必要な菌体 {num(derived.biomassWithLossPerM3, 0)} g/{unit}（濃度 ÷ 取り込み効率 ÷ 回収率）÷ 使用回数 {num(derived.reuseCount, 0)} ＝ 使い切る菌体{" "}
              <span className="font-semibold tabular-nums">{num(derived.biomassKgPerUnit, 3)} kg/{unit}</span>
              {scenario && <>。菌体費は {num(computed.biomass.perKg)} 円/kg × この量 ＝ <span className="font-semibold tabular-nums">{num(scenario.centralTotalPerUnit)} 円/{unit}</span></>}
            </p>
          )}
          {(rs.has("labor_rate") || rs.has("patrol_batches_per_delivery")) && (
            <p className="mt-1.5 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43]">
              作業リストの年間回数: 年間バッチ数 {num(derived.annualBatches, 0)}・訪問回数 {num(derived.visitsPerYear, 1)}・モジュール交換 {num(derived.moduleSwapsPerYear, 1)}・膜交換 {num(derived.membraneSwapsPerYear, 2)}（回/年）
            </p>
          )}
        </>
      ),
    };
  };

  const early = groups.filter((g) => g.minSort < 40).map(renderGroup);
  const late = groups.filter((g) => g.minSort >= 40).map(renderGroup);
  const tasks = working.tasks ?? [];
  const sections: Section[] = [
    ...early,
    ...(tasks.length > 0
      ? [{
          id: "cm-tasks",
          title: "作業リスト",
          node: <TaskList saved={saved} working={working} computed={computed} selection={selection} unit={unit} onChange={onChange} />,
        }]
      : []),
    ...late,
    {
      id: "cm-items",
      title: "設備・消耗品の明細",
      node: <ItemEditor saved={saved} working={working} computed={computed} selection={selection} unit={unit} onChange={onChange} />,
    },
  ];

  const jump = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (scrollable && paneRef.current) {
      const pane = paneRef.current;
      const top = pane.scrollTop + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 40;
      pane.scrollTo({ top, behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      ref={paneRef}
      className={scrollable ? "h-full overflow-y-auto overscroll-contain" : ""}
      data-testid="cost-controls"
    >
      <nav
        aria-label="操作パネルの目次"
        className={`${scrollable ? "sticky top-0" : ""} z-10 flex flex-wrap gap-x-0.5 gap-y-0 border-b border-[#e5e5e7] bg-white px-2 py-1`}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jump(s.id)}
            className="min-h-[36px] shrink-0 rounded-md px-2 text-[11px] font-semibold text-[#3c3c43] hover:bg-[#e8f3fc] hover:text-[#0267b2] xl:min-h-[26px]"
          >
            {s.title}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-4 px-3 pb-6 pt-3">
        {sections.map((s) => (
          <section key={s.id} id={s.id} aria-label={s.title} className="scroll-mt-12">
            <h4 className="mb-1 text-[12px] font-semibold text-[#1d1d1f]">{s.title}</h4>
            {s.node}
          </section>
        ))}
      </div>
    </div>
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
  onChange,
}: {
  assumption: CostAssumption;
  baseline: number | null;
  onChange: CostChangeHandler;
}) {
  const isOverride = a.roleKey === "biomass_cost_per_kg_override";
  const isSalesRate = a.roleKey === "sales_rate";
  const set = (v: number | null) => onChange("assumption", a.costAssumptionId, "value", v);
  return (
    <li className="flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:gap-2">
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
        />
        <span className="w-16 text-[11px] text-[#6e6e73]">{a.unit}</span>
      </div>
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
  return (
    <li className="flex flex-col gap-1 py-1.5 xl:flex-row xl:items-center xl:gap-2">
      <div className="min-w-0 flex-1 text-[12px] leading-5 text-[#1d1d1f]">
        総コスト目標
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
          onChange={(v) => onChange("model", working.model.costModelId, "targetTotalCostPerUnit", v)}
        />
        <span className="w-16 text-[11px] text-[#6e6e73]">円/{unit}</span>
      </div>
    </li>
  );
}

/** 第1段の割り算を、いまの数字で見せる。 */
function BiomassFormula({ computed }: { computed: CostComputation }) {
  const b = computed.biomass;
  const r = b.salesRate;
  const row = (key: string) => b.rows.find((x) => x.key === key)?.perKg ?? 0;
  const life =
    b.usefulLifeMinYears === null ? "—"
    : b.usefulLifeMinYears === b.usefulLifeMaxYears ? `${b.usefulLifeMinYears}年`
    : `${b.usefulLifeMinYears}〜${b.usefulLifeMaxYears}年`;
  const lines: Array<[string, string, number]> = [
    ["培養設備の償却", `初期投資 ${yen(b.capexInitial)} ÷ 耐用 ${life} ÷ 生産 ${int(b.capacityKgYear)}kg`, row("capex")],
    ["年ごとの固定費", `年 ${yen(b.fixedOpexAnnual)} ÷ 生産 ${int(b.capacityKgYear)}kg`, row("fixed")],
    ["製造拠点の作業", `年 ${yen(b.tasksAnnual)} ÷ 生産 ${int(b.capacityKgYear)}kg（作業リスト）`, row("tasks")],
    ["菌体量に比例する費用", "培地・CO2・濃縮など 1kgあたりの単価", row("variable")],
  ];
  return (
    <div className="mb-1.5 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43]">
      <p className="font-semibold text-[#1d1d1f]">
        {b.strainLabel ? `${b.strainLabel}の` : ""}菌体1kgの原価{" "}
        <span className="tabular-nums">{num(b.perKg)} 円/kg</span>
        <span className="font-normal text-[#6e6e73]">（{PRODUCTION_SITE_LABEL}＝{PRODUCTION_SITE_DESCRIPTION}）</span>
      </p>
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
  const scopeOk = task.scenario === "中央培養" || task.scenario === "共通" || task.scenario === selection.method;
  return scopeOk && scopeApplies(task, { strain: selection.strain, application: selection.application });
}

function TaskList({
  saved,
  working,
  computed,
  selection,
  unit,
  onChange,
}: {
  saved: CostModelBundle;
  working: CostModelBundle;
  computed: CostComputation;
  selection: CostViewSelection;
  unit: string;
  onChange: CostChangeHandler;
}) {
  const sel: CostSelection = { strain: selection.strain, application: selection.application };
  const derived = computed.derivedByApplication.find((d) => d.application === selection.application)?.derived ?? computed.derived;
  // 製造拠点の作業は固定の回数で数えるので、物量 (derived) には依存しない。
  const centralSel: CostSelection = { strain: selection.strain, application: null };
  const b = computed.biomass;
  const tasks = [...(working.tasks ?? [])].sort((x, y) => x.sortOrder - y.sortOrder);
  const scenario = computed.scenarios.find(
    (s) => s.application === selection.application && s.method === selection.method && s.tankMode === selection.tankMode
  );
  const commonRate = resolveAssumption(working.assumptions, "labor_rate", sel)?.value ?? 4000;
  const groups = [...new Set(tasks.map((t) => t.groupLabel ?? "作業"))];

  const perUnitOf = (t: CostTask) => {
    if (!taskApplies(t, selection)) return null;
    if (t.scenario === "中央培養") {
      const annual = taskAmount(t, working.assumptions, derived, centralSel).annual;
      return b.capacityKgYear > 0 ? (annual / b.capacityKgYear / b.salesRate) * derived.biomassKgPerUnit : 0;
    }
    return derived.annualVolume > 0 ? taskAmount(t, working.assumptions, derived, sel).annual / derived.annualVolume : 0;
  };

  return (
    <div>
      <p className="mb-1.5 text-[11px] leading-5 text-[#6e6e73]">
        年額 ＝ 年間回数 ×（1回の工数 × 作業単価 ＋ 1回の経費）。作業単価が空欄の行は共通の作業単価（{int(commonRate)}円/時）を使う。工数が空欄の行は未確認で、0時間として数える。
        {PRODUCTION_SITE_LABEL}の作業は菌体費に入る。選んだシナリオで発生しない行は薄く出す。
      </p>
      <div className="hidden xl:grid xl:grid-cols-[minmax(0,1fr)_78px_150px_92px_92px_56px] xl:gap-x-1.5 xl:border-b xl:border-[#e5e5e7] xl:pb-1 xl:text-[10px] xl:font-medium xl:text-[#6e6e73]">
        <span>作業</span>
        <span className="text-right">1回の工数(時)</span>
        <span>年間回数</span>
        <span className="text-right">作業単価(円/時)</span>
        <span className="text-right">1回の経費(円)</span>
        <span className="text-right">円/{unit}</span>
      </div>
      {groups.map((g) => (
        <div key={g} className="mt-1.5">
          <p className="text-[11px] font-semibold text-[#3c3c43]">{g}</p>
          <ul className="flex flex-col divide-y divide-[#f0f0f2]">
            {tasks
              .filter((t) => (t.groupLabel ?? "作業") === g)
              .map((t) => {
                const base = (saved.tasks ?? []).find((x) => x.costTaskId === t.costTaskId);
                const applies = taskApplies(t, selection);
                const amt = taskAmount(t, working.assumptions, derived, t.scenario === "中央培養" ? centralSel : sel);
                const perUnit = perUnitOf(t);
                const isCentral = t.scenario === "中央培養";
                return (
                  <li
                    key={t.costTaskId}
                    className={`grid grid-flow-row-dense grid-cols-2 gap-x-2 gap-y-1 py-1.5 xl:grid-flow-row xl:grid-cols-[minmax(0,1fr)_78px_150px_92px_92px_56px] xl:items-center xl:gap-x-1.5 ${applies ? "" : "opacity-50"}`}
                  >
                    <div className="col-span-2 min-w-0 text-[12px] leading-5 text-[#1d1d1f] xl:col-span-1">
                      {t.label}
                      <ScopeTag strain={t.strain} application={t.application} />
                      <span className="ml-1 align-middle"><ConfidenceTag value={t.confidence} /></span>
                      <span className="block text-[10px] leading-4 text-[#6e6e73]">
                        {SCENARIO_SCOPE_LABEL[t.scenario as CostScenarioScope]}・年 {yen(amt.annual)}
                        {amt.annualHours > 0 ? `（${num(amt.annualHours, 0)}時間）` : ""}
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
                    <Cell label="年間回数" className="col-span-2 xl:col-span-1" align="start">
                      <select
                        aria-label={`${t.label} 年間回数の決め方`}
                        value={t.countDriver}
                        disabled={isCentral}
                        title={isCentral ? `${PRODUCTION_SITE_LABEL}の作業は固定の回数だけ` : undefined}
                        onChange={(e) => {
                          const next = e.target.value as CostTaskDriver;
                          if (next === "fixed" && t.countPerYear === null) {
                            onChange("task", t.costTaskId, "countPerYear", Math.round(amt.occurrences * 100) / 100);
                          }
                          onChange("task", t.costTaskId, "countDriver", next);
                        }}
                        className={`min-h-[44px] min-w-0 flex-1 rounded-md border px-1 text-[16px] text-[#1d1d1f] disabled:text-[#6e6e73] xl:h-7 xl:min-h-0 xl:max-w-[6.75rem] xl:flex-none xl:text-[11px] ${
                          base && base.countDriver !== t.countDriver ? "border-[#027fdc] bg-[#e8f3fc]" : "border-[#d2d2d7] bg-white"
                        }`}
                      >
                        {TASK_DRIVERS.map((d) => (
                          <option key={d} value={d}>{TASK_DRIVER_LABEL[d]}</option>
                        ))}
                      </select>
                      {t.countDriver === "fixed" || isCentral ? (
                        <NumberField
                          ariaLabel={`${t.label} 年間回数`}
                          value={t.countPerYear}
                          baseline={base?.countPerYear ?? null}
                          min={0}
                          compact
                          widthClass="w-16 xl:w-12"
                          onChange={(v) => onChange("task", t.costTaskId, "countPerYear", v ?? 0)}
                        />
                      ) : (
                        <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-[#1d1d1f] xl:w-auto xl:text-[11px]">
                          {num(amt.occurrences, amt.occurrences < 10 ? 2 : 0)}回
                        </span>
                      )}
                    </Cell>
                    <Cell label="作業単価（円/時）">
                      <NumberField
                        ariaLabel={`${t.label} 作業単価`}
                        value={t.hourlyRate}
                        baseline={base?.hourlyRate ?? null}
                        allowNull
                        min={0}
                        placeholder={`共通 ${int(commonRate)}`}
                        compact
                        widthClass="w-full xl:w-[5.5rem]"
                        wrapperClass={FILL}
                        onChange={(v) => onChange("task", t.costTaskId, "hourlyRate", v)}
                      />
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
      ))}
      {scenario && (
        <p className="mt-1.5 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[11px] leading-5 text-[#3c3c43]">
          選んだシナリオの現場と巡回の作業 <span className="font-semibold tabular-nums">{num(scenario.siteTaskPerUnit)} 円/{unit}</span>
          （年 {yen(scenario.siteTaskAnnual)}）。{PRODUCTION_SITE_LABEL}の作業は年 {yen(b.tasksAnnual)} で、菌体1kgあたり {num(b.rows.find((r) => r.key === "tasks")?.perKg ?? 0)} 円として菌体費に入る。
        </p>
      )}
    </div>
  );
}

const SCOPE_ORDER: CostScenarioScope[] = ["中央培養", "共通", "循環", "投入"];

function itemApplies(item: CostItem, selection: CostViewSelection) {
  if (item.scenario === "中央培養") return scopeApplies(item, { strain: selection.strain, application: null });
  return (item.scenario === "共通" || item.scenario === selection.method) && scopeApplies(item, { strain: selection.strain, application: selection.application });
}

function ItemEditor({
  saved,
  working,
  computed,
  selection,
  unit,
  onChange,
}: {
  saved: CostModelBundle;
  working: CostModelBundle;
  computed: CostComputation;
  selection: CostViewSelection;
  unit: string;
  onChange: CostChangeHandler;
}) {
  const [onlyApplicable, setOnlyApplicable] = useState(true);
  const sel: CostSelection = { strain: selection.strain, application: selection.application };
  const centralSel: CostSelection = { strain: selection.strain, application: null };
  const derived = computed.derivedByApplication.find((d) => d.application === selection.application)?.derived ?? computed.derived;
  const b = computed.biomass;
  const rows = working.items.filter((i) => !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考");
  const visible = rows.filter((i) => !onlyApplicable || itemApplies(i, selection));

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[#6e6e73]">
        <span>数量・単価・耐用年数を動かせる。前提から計算する行（電力・モジュール交換費など）は前提の欄で動かす。</span>
        <button
          type="button"
          onClick={() => setOnlyApplicable((v) => !v)}
          aria-pressed={!onlyApplicable}
          className="min-h-[36px] rounded-md border border-[#d2d2d7] bg-white px-2 font-semibold text-[#3c3c43] hover:border-[#7cbceb] xl:min-h-[26px]"
        >
          {onlyApplicable ? `すべての行を出す（${rows.length}行）` : "選んだシナリオに効く行だけにする"}
        </button>
      </div>
      {SCOPE_ORDER.map((scope) => {
        const list = visible.filter((i) => i.scenario === scope);
        if (list.length === 0) return null;
        const isCentral = scope === "中央培養";
        return (
          <div key={scope} className="mt-2">
            <p className="text-[11px] font-semibold text-[#3c3c43]">
              {SCENARIO_SCOPE_LABEL[scope]}
              <span className="ml-1 font-normal text-[#6e6e73]">{list.length}行・右端は {isCentral ? "円/kg（生産1kgあたり）" : `円/${unit}`}</span>
            </p>
            <ul className="flex flex-col divide-y divide-[#f0f0f2]">
              {list.map((i) => {
                const base = saved.items.find((x) => x.costItemId === i.costItemId);
                const applies = itemApplies(i, selection);
                const right = !applies
                  ? null
                  : isCentral
                    ? centralItemPerKg(i, working.assumptions, b.capacityKgYear, centralSel)
                    : derived.annualVolume > 0 ? annualAmount(i, working.assumptions, derived, sel) / derived.annualVolume : 0;
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
                        {i.costType}・{i.basis}{i.groupLabel ? `・${i.groupLabel}` : ""}
                        <NoteToggle note={i.note} />
                      </span>
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
                      {i.priceRule ? (
                        <span className="min-h-[44px] w-full text-right text-[11px] leading-[44px] text-[#6e6e73] xl:min-h-0 xl:leading-normal">前提から計算</span>
                      ) : (
                        <>
                          <NumberField
                            ariaLabel={`${costItemLabel(i)} 単価`}
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
