"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CO2_FLUE_GAS_ROLE, WASTE_HEAT_ROLE, WASTE_MEDIUM_ROLE, flueGasOn, wasteHeatOn, wasteMediumOn, type CostModelBundle } from "@/lib/project-cost-model";
import {
  FUEL_CONVERSIONS,
  FUEL_CONVERSION_DESCRIPTION,
  FUEL_CONVERSION_LABEL,
  FUEL_RESIDUE_ROUTE_LABEL,
  FUEL_YIELD_CASES,
  LIPID_SECRETION_CHOICES,
  LIPID_SECRETION_DESCRIPTION,
  LIPID_SECRETION_LABEL,
  LIPID_SECRETION_ROLE,
  fuelAssumptionOf,
  fuelSecretionOn,
  FUEL_YIELD_CASE_DESCRIPTION,
  FUEL_YIELD_CASE_LABEL,
  computeFuelCostModel,
  computeFuelTaskFlow,
  findFuelScenario,
  isFuelModel,
  type FuelConversion,
  type FuelResidueRoute,
  type FuelYieldCase,
} from "@/lib/project-fuel-cost-model";
import {
  applyDraft,
  draftToPatches,
  dropDraftKeys,
  formatDraftValue,
  listDraftChanges,
  pruneDraft,
  setDraftValue,
  type CostDraft,
  type DraftChange,
  type DraftEntity,
  type DraftField,
  type DraftValue,
} from "@/lib/project-cost-model-draft";
import { loadProjectFuelCostModel, peekProjectFuelCostModel, saveFuelCostPatches } from "@/lib/project-cost-model-client";
import { FactoryUtilitySwitches, Segmented } from "@/components/cockpit/CockpitCostModelParts";
import { FuelControlsPanel } from "@/components/cockpit/CockpitFuelCostModelControls";
import { FuelResultsPanel, FuelResultsSummaryBar } from "@/components/cockpit/CockpitFuelCostModelResults";
import { FuelReadingSections } from "@/components/cockpit/CockpitFuelCostModelReading";

// PJコックピット「事業計画」グループの「コスト試算（燃料）」タブ（コスト試算（廃液）の右隣。2026-09-14 に技術タブの中から移した）。
// まさ 2026-09-14「OSの技術ページに、新たに『コスト試算（燃料）』を追加してほしい。
// そんで廃液処理のコスト試算と同様にバイオディーゼル事業のコスト試算シートを作ってほしい」。
//
// 排水処理の「コスト試算」タブ (CockpitCostModel) と同じ形のシミュレーター:
//   - 操作パネル (前提・作業リスト・明細) と結果を同じ枠に並べる。デスクトップは操作パネルの中だけがスクロールし、結果はスクロールせずに見える。
//     スマホ幅は結果の要約を上に固定する
//   - 未確定の数字はすべて画面で書き換えられる。書き換えはその場で再計算するだけで保存しない。admin だけ「この値を保存」で正本へ書く
//   - 前提・作業・明細は「事業と製造の条件 / CAPEX / OPEX」の区分に並べる。数字の欄は3桁カンマ。作業単価は共通の1つ
// 切り替えは FAME転換 (外部に委託 / 自社で行う) と 収率 (低位 / 基準 / 改善)。
// 正本は project_cost_* の case_kind = 'biodiesel' の試算 (migration 411/412)。計算は project-fuel-cost-model.ts。

interface Props {
  projectId: string;
  /** ワークスペース側など、保存させない面では false。試算 (画面上の書き換え) はどちらの面でもできる。 */
  allowEdit?: boolean;
}

export interface FuelViewState {
  conversion: FuelConversion;
  yieldCase: FuelYieldCase;
}

// 試算中の変更と表示の選択は、タブを行き来しても消えないようにモジュールに持つ (再読み込みで消える)。
const draftMemory = new Map<string, CostDraft>();
const viewMemory = new Map<string, FuelViewState>();
// 開いたときは、事業概要 (2026-09-03) の分担どおり FAME転換を外部に委託し、収率は基準。
const DEFAULT_VIEW: FuelViewState = { conversion: "outsourced", yieldCase: "base" };

/** 「保存していない変更」の一覧の値。選択肢で持つ前提 (残渣の行き先・脂質分泌株) は呼び名で出す。 */
export function formatFuelDraftValue(change: Pick<DraftChange, "field">, value: DraftValue): string {
  if (change.field === "valueText" && typeof value === "string" && value in FUEL_RESIDUE_ROUTE_LABEL) {
    return FUEL_RESIDUE_ROUTE_LABEL[value as FuelResidueRoute];
  }
  if (change.field === "valueText" && typeof value === "string") {
    const choice = LIPID_SECRETION_CHOICES.find((c) => c.value === value);
    if (choice) return `${LIPID_SECRETION_LABEL}を${choice.label}`;
  }
  return formatDraftValue(change.field, value);
}

export function CockpitFuelCostModel({ projectId, allowEdit = true }: Props) {
  const cached = peekProjectFuelCostModel(projectId);
  const [bundle, setBundle] = useState<CostModelBundle | null>(cached?.bundle ?? null);
  const [canEdit, setCanEdit] = useState(!!cached?.canEdit && allowEdit);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">(
    cached ? (cached.bundle ? "ready" : "empty") : "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraftState] = useState<CostDraft>(() => draftMemory.get(projectId) ?? {});
  const [view, setViewState] = useState<FuelViewState>(() => ({ ...DEFAULT_VIEW, ...viewMemory.get(projectId) }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [paneHeight, setPaneHeight] = useState<number | null>(null);
  const panesRef = useRef<HTMLDivElement>(null);

  const setDraft = useCallback(
    (update: (d: CostDraft) => CostDraft) => {
      setDraftState((d) => {
        const next = update(d);
        draftMemory.set(projectId, next);
        return next;
      });
    },
    [projectId]
  );
  const setView = useCallback(
    (patch: Partial<FuelViewState>) => {
      setViewState((v) => {
        const next = { ...v, ...patch };
        viewMemory.set(projectId, next);
        return next;
      });
    },
    [projectId]
  );

  const load = useCallback(
    async (force = false) => {
      try {
        const res = await loadProjectFuelCostModel(projectId, { force });
        setCanEdit(res.canEdit && allowEdit);
        if (!res.bundle || !isFuelModel(res.bundle.model)) return setState("empty");
        const next = res.bundle;
        setBundle(next);
        setDraft((d) => pruneDraft(next, d));
        setState("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : "読み込みに失敗");
        setState("error");
      }
    },
    [projectId, allowEdit, setDraft]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const working = useMemo(() => (bundle ? applyDraft(bundle, draft) : null), [bundle, draft]);
  const computed = useMemo(() => (working ? computeFuelCostModel(working) : null), [working]);
  const hasDraft = Object.keys(draft).length > 0;
  const baseline = useMemo(() => (bundle && computed ? (hasDraft ? computeFuelCostModel(bundle) : computed) : null), [bundle, computed, hasDraft]);
  const changes = useMemo(() => (bundle ? listDraftChanges(bundle, draft) : []), [bundle, draft]);

  // デスクトップでは、操作パネルと結果の高さを「画面の下端まで」にそろえ、操作パネルの中だけをスクロールさせる。
  useLayoutEffect(() => {
    if (state !== "ready") return;
    const measure = () => {
      const el = panesRef.current;
      if (!el || !window.matchMedia("(min-width: 1280px)").matches) {
        setPaneHeight(null);
        return;
      }
      const top = el.getBoundingClientRect().top + window.scrollY;
      setPaneHeight(Math.round(Math.min(Math.max(window.innerHeight - top - 12, 520), 1000)));
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [state]);

  const onChange = useCallback(
    (entity: DraftEntity, id: string, field: DraftField, value: DraftValue) => {
      if (!bundle) return;
      setDraft((d) => setDraftValue(d, bundle, entity, id, field, value));
    },
    [bundle, setDraft]
  );

  async function save(keys: string[]) {
    if (!bundle || keys.length === 0 || !canEdit) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveFuelCostPatches(projectId, draftToPatches(bundle, draft, keys));
      setBundle(applyDraft(bundle, Object.fromEntries(keys.map((k) => [k, draft[k]]))));
      setDraft((d) => dropDraftKeys(d, keys));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗");
    } finally {
      setSaving(false);
      void load(true);
    }
  }

  const revert = (keys: string[]) => setDraft((d) => dropDraftKeys(d, keys));

  if (state === "loading") {
    return <div className="h-[520px] animate-pulse rounded-xl border border-[#e5e5e7] bg-[#fafafa]" data-testid="fuel-cost-loading" />;
  }
  if (state === "error") {
    return <div className="rounded-xl border border-[#e5e5e7] bg-white p-6 text-[13px] text-[#be123c]">{error}</div>;
  }
  if (state === "empty" || !bundle || !working || !computed || !baseline) {
    return (
      <div className="rounded-xl border border-dashed border-[#d2d2d7] bg-white p-6">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">このPJには燃料のコスト試算がない</h3>
        <p className="mt-2 max-w-2xl text-[12px] leading-6 text-[#3c3c43]">
          燃料（バイオディーゼル）を作って売る事業の、燃料1Lあたりの総コストを試算する面。前提・明細・作業を登録すると、数字を書き換えたときに6通りの総コストがその場で再計算される。
        </p>
      </div>
    );
  }

  const { model } = working;
  const current = findFuelScenario(computed, view.conversion, view.yieldCase) ?? computed.scenarios[0];
  const currentBase = findFuelScenario(baseline, current.conversion, current.yieldCase);
  const flow = computeFuelTaskFlow(working, current);
  // 株の切り替え (前提 lipid_secreting_strain)。保存値と違うときは枠を光らせる。
  const secretionAssumption = fuelAssumptionOf(working.assumptions, LIPID_SECRETION_ROLE);
  const secreting = fuelSecretionOn(working.assumptions);
  const secretionChanged = secreting !== fuelSecretionOn(bundle.assumptions);
  // 枠の上端に並べる「工場から」の3つ（排液・排ガス・排熱）。明細の行のスイッチと同じ前提を切り替える
  // （まさ 2026-09-15「一番上の「株」「用途」「方式」「装置」の切り替えスイッチの右にも並べてほしい」）
  const factoryUtilities = [
    { key: WASTE_MEDIUM_ROLE, label: "排液", on: wasteMediumOn, hint: "工場の排液を培地に使える（培地の原料の買値が減る割合だけ引かれる）" },
    { key: CO2_FLUE_GAS_ROLE, label: "排ガス", on: flueGasOn, hint: "工場の排ガスを使える（CO2 が0円）" },
    { key: WASTE_HEAT_ROLE, label: "排熱", on: wasteHeatOn, hint: "工場の排熱を使える（培養の加温の熱が0円）" },
  ].flatMap(({ key, label, on, hint }) => {
    const a = fuelAssumptionOf(working.assumptions, key);
    if (!a) return [];
    const saved = bundle.assumptions.find((x) => x.costAssumptionId === a.costAssumptionId);
    return [{
      key,
      label,
      hint,
      on: on(a),
      baselineOn: on(saved),
      onToggle: (next: boolean) => onChange("assumption", a.costAssumptionId, "valueText", next ? "on" : "off"),
    }];
  });
  const baselineFlow = hasDraft && currentBase ? computeFuelTaskFlow(bundle, currentBase) : flow;
  const showFlow = () => {
    const target = document.getElementById("fuel-flow");
    const pane = target?.closest<HTMLElement>('[data-testid="fuel-cost-controls"]');
    if (pane && pane.scrollHeight > pane.clientHeight) pane.scrollTo({ top: 0, behavior: "smooth" });
    else target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="fuel-cost-model">
      <div className="rounded-xl border border-[#e5e5e7] bg-white" data-testid="fuel-cost-simulator">
        <h2 className="sr-only">{model.title}</h2>
        {/* スマホ幅: 結果の要約を上に固定する */}
        <div className="sticky top-0 z-20 xl:hidden">
          <FuelResultsSummaryBar current={current} baseline={currentBase} target={computed.targetTotalPerLiter} changeCount={changes.length} />
        </div>

        {/* 切り替えと、保存していない変更 */}
        <div className="relative flex flex-col gap-2 border-b border-[#e5e5e7] px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center xl:gap-x-4">
            {/* 見出しが株・用途より長いので、切り替えの部品の外に置いて幅を取らせる */}
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="w-[4.5rem] shrink-0 text-[11px] font-semibold text-[#3c3c43] xl:w-auto">FAME転換</span>
              <div className="min-w-0 flex-1 xl:flex-none">
                <Segmented
                  ariaLabel="FAME転換の切り替え"
                  options={FUEL_CONVERSIONS.map((c) => ({ value: c, label: FUEL_CONVERSION_LABEL[c] }))}
                  value={current.conversion}
                  onChange={(v) => setView({ conversion: v })}
                />
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="w-[4.5rem] shrink-0 text-[11px] font-semibold text-[#3c3c43] xl:w-auto">収率</span>
              <div className="min-w-0 flex-1 xl:flex-none">
                <Segmented
                  ariaLabel="収率の切り替え"
                  options={FUEL_YIELD_CASES.map((y) => ({ value: y, label: FUEL_YIELD_CASE_LABEL[y] }))}
                  value={current.yieldCase}
                  onChange={(v) => setView({ yieldCase: v })}
                />
              </div>
            </div>
            {/* 株の切り替え。FAME転換・収率と違って前提 (保存する値) なので、切り替えると「保存していない変更」に出る
                (まさ 2026-09-14「コスト試算表を「脂質分泌株」のスイッチオンオフで切り替えられるようにしてほしい」) */}
            {secretionAssumption && (
              <div className="flex min-w-0 items-center gap-1.5" data-testid="fuel-strain-switch">
                <span className="w-[4.5rem] shrink-0 text-[11px] font-semibold text-[#3c3c43] xl:w-auto">株</span>
                <div className={`min-w-0 flex-1 rounded-lg xl:flex-none ${secretionChanged ? "ring-2 ring-[#7cbceb]" : ""}`}>
                  <Segmented
                    ariaLabel="脂質分泌株の切り替え"
                    options={[
                      { value: "off" as const, label: "菌体から取り出す" },
                      { value: "on" as const, label: LIPID_SECRETION_LABEL },
                    ]}
                    value={secreting ? "on" : "off"}
                    onChange={(v) => onChange("assumption", secretionAssumption.costAssumptionId, "valueText", v)}
                  />
                </div>
              </div>
            )}
            <FactoryUtilitySwitches items={factoryUtilities} />
            <p className="text-[10px] leading-4 text-[#6e6e73] sm:col-span-2 xl:basis-full" data-testid="fuel-selection-note">
              {FUEL_CONVERSION_LABEL[current.conversion]}＝{FUEL_CONVERSION_DESCRIPTION[current.conversion]}。収率{FUEL_YIELD_CASE_LABEL[current.yieldCase]}＝{FUEL_YIELD_CASE_DESCRIPTION[current.yieldCase]}。
              {secretionAssumption && <>{LIPID_SECRETION_LABEL}を{secreting ? "使う" : "使わない"}＝{LIPID_SECRETION_DESCRIPTION[secreting ? "on" : "off"]}。</>}
              {factoryUtilities.length > 0 && (
                <>
                  工場から＝
                  {factoryUtilities.some((u) => u.on)
                    ? `${factoryUtilities.filter((u) => u.on).map((u) => u.label).join("・")}をもらう前提（培養の拠点を工場の隣に置く）`
                    : "何ももらわない（すべて買う）"}
                  。
                </>
              )}
            </p>
          </div>
          {/* 書き換え中に保存のボタンが2段に折り返さないよう、右端は縮めない (説明の一文の方を折り返す) */}
          <div className="flex flex-wrap items-center gap-1.5 xl:shrink-0 xl:flex-nowrap xl:self-start">
            {model.versionLabel && changes.length === 0 && (
              <span className="inline-flex items-center rounded-full border border-[#d2d2d7] px-2 py-0.5 text-[11px] text-[#3c3c43]">{model.versionLabel}</span>
            )}
            <a href="#fuel-guide" className="text-[11px] font-medium text-[#0267b2] underline underline-offset-2">見方</a>
            {changes.length === 0 ? (
              <span className="text-[11px] text-[#6e6e73]" title="数字を書き換えると、保存せずにその場で再計算する">保存値で表示中</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setChangesOpen((v) => !v)}
                  aria-expanded={changesOpen}
                  className="min-h-[40px] rounded-md bg-[#e8f3fc] px-2.5 text-[12px] font-semibold text-[#0267b2] hover:bg-[#d6eafa] xl:min-h-[30px]"
                >
                  保存していない変更 {changes.length}件 {changesOpen ? "▲" : "▼"}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(() => ({}))}
                  className="min-h-[40px] rounded-md border border-[#d2d2d7] bg-white px-2.5 text-[12px] font-semibold text-[#3c3c43] hover:border-[#7cbceb] xl:min-h-[30px]"
                >
                  すべて戻す
                </button>
                {canEdit && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void save(changes.map((c) => c.key))}
                    className="min-h-[40px] rounded-md bg-[#027fdc] px-2.5 text-[12px] font-semibold text-white hover:bg-[#0267b2] disabled:opacity-60 xl:min-h-[30px]"
                  >
                    {saving ? "保存中..." : "すべて保存"}
                  </button>
                )}
              </>
            )}
            {saveError && <span className="text-[11px] font-semibold text-[#be123c]">保存できなかった: {saveError}</span>}
          </div>

          {changesOpen && changes.length > 0 && (
            <div className="absolute right-3 top-full z-30 mt-1 w-[min(600px,calc(100vw-2.5rem))] rounded-lg border border-[#d2d2d7] bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.14)]">
              <p className="px-1 pb-1 text-[11px] leading-5 text-[#6e6e73]">
                {canEdit
                  ? "書き換えた数字の一覧。「この値を保存」を押すと正本に書き、全員の画面に反映される。"
                  : "書き換えた数字の一覧。保存はコックピットの管理者だけができる。ここでの書き換えは、再読み込みすると消える。"}
              </p>
              <ul className="max-h-[360px] divide-y divide-[#f0f0f2] overflow-y-auto">
                {changes.map((c) => (
                  <li key={c.key} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 py-1.5 text-[12px]">
                    <span className="min-w-0 flex-1 text-[#1d1d1f]">
                      {c.label}
                      {c.fieldLabel && <span className="text-[#6e6e73]">・{c.fieldLabel}</span>}
                    </span>
                    <span className="tabular-nums text-[#3c3c43]">
                      {formatFuelDraftValue(c, c.before)} → <span className="font-semibold text-[#0267b2]">{formatFuelDraftValue(c, c.after)}</span>
                      {c.unit && <span className="ml-0.5 text-[11px] text-[#6e6e73]">{c.unit}</span>}
                    </span>
                    <button type="button" onClick={() => revert([c.key])} className="min-h-[36px] rounded px-1.5 text-[11px] font-semibold text-[#3c3c43] hover:bg-[#f5f5f7] xl:min-h-0">
                      戻す
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void save([c.key])}
                        className="min-h-[36px] rounded bg-[#027fdc] px-1.5 text-[11px] font-semibold text-white hover:bg-[#0267b2] disabled:opacity-60 xl:min-h-0 xl:py-0.5"
                      >
                        この値を保存
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 操作パネル（左）と結果（右）。デスクトップは画面の下端まで、操作パネルの中だけスクロールする */}
        <div
          ref={panesRef}
          className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px]"
          style={paneHeight ? { height: paneHeight } : undefined}
        >
          <div className="order-2 min-h-0 xl:order-1 xl:border-r xl:border-[#e5e5e7]">
            <FuelControlsPanel
              saved={bundle}
              working={working}
              computed={computed}
              current={current}
              flow={flow}
              onChange={onChange}
              scrollable={paneHeight !== null}
            />
          </div>
          <div className="order-1 min-h-0 border-b border-[#e5e5e7] p-3 xl:order-2 xl:overflow-y-auto xl:border-b-0">
            <FuelResultsPanel
              computed={computed}
              baseline={baseline}
              current={current}
              flow={flow}
              baselineFlow={baselineFlow}
              onSelect={(conversion, yieldCase) => setView({ conversion, yieldCase })}
              onShowFlow={showFlow}
            />
          </div>
        </div>
      </div>

      {/* ここから下は読み物。表の数字は試算中の変更を重ねた値 */}
      <FuelReadingSections saved={bundle} working={working} computed={computed} current={current} />
    </div>
  );
}
