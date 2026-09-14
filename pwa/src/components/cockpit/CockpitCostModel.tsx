"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  APPLICATION_LABEL,
  LOCATION_DESCRIPTION,
  LOCATION_SHORT_LABEL,
  METHODS,
  METHOD_DESCRIPTION,
  METHOD_LABEL,
  STRAIN_LABEL,
  computeCostModel,
  computeTaskFlow,
  type CostApplication,
  type CostLocation,
  type CostMethod,
  type CostModelBundle,
  type CostStrain,
  type CostTankMode,
} from "@/lib/project-cost-model";
import {
  applyDraft,
  draftToPatches,
  dropDraftKeys,
  formatDraftValue,
  listDraftChanges,
  pruneDraft,
  setDraftValue,
  type CostDraft,
  type DraftEntity,
  type DraftField,
  type DraftValue,
} from "@/lib/project-cost-model-draft";
import {
  loadProjectCostModel,
  peekProjectCostModel,
  saveCostPatches,
} from "@/lib/project-cost-model-client";
import { Segmented, num } from "@/components/cockpit/CockpitCostModelParts";
import { CostControlsPanel } from "@/components/cockpit/CockpitCostModelControls";
import { CostResultsPanel, CostResultsSummaryBar, type CostViewSelection } from "@/components/cockpit/CockpitCostModelResults";
import { CostReadingSections } from "@/components/cockpit/CockpitCostModelReading";

// PJコックピット / PJワークスペース「コスト試算」タブ。全PJ共通の雛形。
//
// このタブ単体で次が分かることを要件にしている (2026-08-23 まさ指摘):
//   1. どういう系を想定して、どういう計算をしているか
//   2. CAPEX と OPEX がそれぞれいくらか
//   3. いくら以下ならユニットエコノミクスが成立するか
//   4. どのパラメータの確度が低いせいで精度が落ちているか
//
// シミュレーター型 (2026-09-13 まさFB):
//   - 操作パネル (株・用途・方式・装置の切り替え＋前提・作業リスト・明細) と結果を同じ画面に並べる。
//     槽は上端に出さない (まさ 2026-09-14「「槽　顧客の設備」ってのが最上段にある意味がわからん。特出しするものでもないと思うので削除して」)。
//     オンサイトの槽を SX が持つ形にしたときだけ、操作パネルの CAPEX「槽」で既設・新設を選ぶ。
//     デスクトップ 1440×900 では、操作パネルの中だけがスクロールし、結果はスクロールせずに見える。
//     スマホ幅では結果の要約を上に固定する
//   - 未確定の数字はすべて画面で書き換えられる。書き換えはその場で再計算するだけで保存しない (試算)。
//     正本へ書くのは、admin が「この値を保存」を押したときだけ
//   - 人件費は作業リスト (工数 × 作業単価) で持つ。人件費だけを抜いた総コストの併記はしない
//
//   - 結果の欄に、方式・装置ごとの総コストを内訳の色で積んだ棒と、選んだ組み合わせの内訳 (区分ごとの棒と割合)、作業工数の合計を出す。
//     操作パネルの一番上に「作業の流れと工数」を置く
//   - 切り替えは 方式 (オンサイト / オフサイト) と 装置 (循環カートリッジ / 直接投入) を分ける (まさ 2026-09-14)
//
// 二段階の計算 (2026-09-13 まさ確定): 第1段 株ごとの菌体1kgの原価 → 第2段 用途ごとの処理原価。
// 正本は project_cost_* (migration 320/324/392/394/396)。計算結果は保存しない。保存するのは前提・明細・作業だけで、数字は常に導出する。

interface Props {
  projectId: string;
  /** ワークスペース側など、保存させない面では false。試算 (画面上の書き換え) はどちらの面でもできる。 */
  allowEdit?: boolean;
}

interface ViewState {
  strain: CostStrain | null;
  application: CostApplication | null;
  location: CostLocation;
  method: CostMethod;
  tankMode: CostTankMode;
}

// 試算中の変更と表示の選択は、タブを行き来しても消えないようにモジュールに持つ (再読み込みで消える)。
const draftMemory = new Map<string, CostDraft>();
const viewMemory = new Map<string, ViewState>();
// 開いたときの株は自然株 (まさ 2026-09-14「デフォルトが強化株になってるから、自然株に変えて」)。自然株が無い試算は最初の株。
const DEFAULT_VIEW: ViewState = { strain: "wild", application: null, location: "onsite", method: "投入", tankMode: "既設" };

export function CockpitCostModel({ projectId, allowEdit = true }: Props) {
  const cached = peekProjectCostModel(projectId);
  const [bundle, setBundle] = useState<CostModelBundle | null>(cached?.bundle ?? null);
  const [canEdit, setCanEdit] = useState(!!cached?.canEdit && allowEdit);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">(
    cached ? (cached.bundle ? "ready" : "empty") : "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraftState] = useState<CostDraft>(() => draftMemory.get(projectId) ?? {});
  const [view, setViewState] = useState<ViewState>(() => ({ ...DEFAULT_VIEW, ...viewMemory.get(projectId) }));
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
    (patch: Partial<ViewState>) => {
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
        const res = await loadProjectCostModel(projectId, { force });
        setCanEdit(res.canEdit && allowEdit);
        if (!res.bundle) return setState("empty");
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

  // 初回だけ読む。キャッシュが温まっていれば即描画される。
  useEffect(() => {
    void load();
  }, [load]);

  const working = useMemo(() => (bundle ? applyDraft(bundle, draft) : null), [bundle, draft]);
  const computed = useMemo(() => (working ? computeCostModel(working, { strain: view.strain }) : null), [working, view.strain]);
  const hasDraft = Object.keys(draft).length > 0;
  const baseline = useMemo(
    () => (bundle && computed ? (hasDraft ? computeCostModel(bundle, { strain: computed.strain }) : computed) : null),
    [bundle, computed, hasDraft]
  );
  const otherStrain = useMemo(() => {
    if (!working || !computed || computed.strains.length < 2) return null;
    const other = computed.strains.find((s) => s !== computed.strain);
    return other ? computeCostModel(working, { strain: other }) : null;
  }, [working, computed]);
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

  /** 作業を「固定の回数」に変えた変更は、年間回数と一緒に扱う。 */
  const withCompanions = (keys: string[]) => {
    const out = new Set(keys);
    for (const k of keys) {
      if (k.startsWith("task:") && k.endsWith(":countDriver")) {
        const companion = k.replace(/:countDriver$/, ":countPerYear");
        if (companion in draft) out.add(companion);
      }
    }
    return [...out];
  };

  async function save(keys: string[]) {
    if (!bundle || keys.length === 0 || !canEdit) return;
    const target = withCompanions(keys);
    setSaving(true);
    setSaveError(null);
    try {
      await saveCostPatches(projectId, draftToPatches(bundle, draft, target));
      setBundle(applyDraft(bundle, Object.fromEntries(target.map((k) => [k, draft[k]]))));
      setDraft((d) => dropDraftKeys(d, target));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗");
    } finally {
      setSaving(false);
      void load(true);
    }
  }

  const revert = (keys: string[]) => setDraft((d) => dropDraftKeys(d, withCompanions(keys)));

  if (state === "loading") {
    return <div className="rounded-xl border border-[#e5e5e7] bg-white p-6 text-[13px] text-[#6e6e73]">読み込み中...</div>;
  }
  if (state === "error") {
    return <div className="rounded-xl border border-[#e5e5e7] bg-white p-6 text-[13px] text-[#be123c]">{error}</div>;
  }
  if (state === "empty" || !bundle || !working || !computed || !baseline) {
    return <EmptyState canEdit={canEdit} />;
  }

  // LiSTie は、現時点で全工程の原価式ではなく取締役会資料にある
  // 「膜＋電力」の部分試算だけが根拠付きで存在する。SX の4シナリオ式を
  // 流用すると総原価のように誤読されるため、専用の表示に分ける。
  if (bundle.model.caseKind === "other" && bundle.model.caseLabel === "LiSTie 膜＋電力 部分試算") {
    return <LiSTiePartialCostModel bundle={bundle} />;
  }

  const { model } = working;
  const unit = model.unitBasisLabel || "m³";
  const { strains, applications, locations } = computed;
  const location: CostLocation = locations.includes(view.location) ? view.location : "onsite";
  const selection: CostViewSelection = {
    strain: computed.strain,
    application: view.application && applications.includes(view.application) ? view.application : applications[0] ?? null,
    location,
    method: METHODS.includes(view.method) ? view.method : "投入",
    // オフサイトは SX工場に槽を新設する。オンサイトの槽を顧客が持つときは、SX の原価に槽が乗らないので「既設」(SX の負担0) だけ。
    // オンサイトで槽を SX が持つ形へ戻したときは、前に選んでいた槽に戻る。
    tankMode: location === "offsite" ? "新設" : computed.onsiteTankBearer === "customer" ? "既設" : view.tankMode,
    onsiteTankBearer: computed.onsiteTankBearer,
  };
  const hasMargin = model.targetMarginRate !== null && model.targetMarginRate > 0;
  const flowSel = { application: selection.application, location: selection.location, method: selection.method };
  const flow = computeTaskFlow(working, computed, flowSel);
  const baselineFlow = hasDraft ? computeTaskFlow(bundle, baseline, flowSel) : flow;
  const showFlow = () => {
    const target = document.getElementById("cm-flow");
    const pane = target?.closest<HTMLElement>('[data-testid="cost-controls"]');
    if (pane && pane.scrollHeight > pane.clientHeight) pane.scrollTo({ top: 0, behavior: "smooth" });
    else target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-[#e5e5e7] bg-white" data-testid="cost-simulator">
        <h2 className="sr-only">{model.title}</h2>
        {/* スマホ幅: 結果の要約を上に固定する */}
        <div className="sticky top-0 z-20 xl:hidden">
          <CostResultsSummaryBar
            unit={unit}
            computed={computed}
            baseline={baseline}
            selection={selection}
            hasMargin={hasMargin}
            changeCount={changes.length}
          />
        </div>

        {/* 切り替えと、保存していない変更 */}
        <div className="relative flex flex-col gap-2 border-b border-[#e5e5e7] px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center xl:gap-x-4">
            {strains.length > 0 && (
              <Segmented
                label="株"
                ariaLabel="株の切り替え"
                options={strains.map((s) => ({ value: s, label: STRAIN_LABEL[s] }))}
                value={computed.strain}
                onChange={(v) => setView({ strain: v })}
              />
            )}
            {applications.length > 0 && (
              <Segmented
                label="用途"
                ariaLabel="用途の切り替え"
                options={applications.map((a) => ({ value: a, label: APPLICATION_LABEL[a] }))}
                value={selection.application}
                onChange={(v) => setView({ application: v })}
              />
            )}
            {locations.length > 1 && (
              <Segmented
                label="方式"
                ariaLabel="方式の切り替え"
                options={locations.map((l) => ({ value: l, label: LOCATION_SHORT_LABEL[l] }))}
                value={selection.location}
                onChange={(v) => setView({ location: v })}
              />
            )}
            <Segmented
              label="装置"
              ariaLabel="装置の切り替え"
              options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
              value={selection.method}
              onChange={(v) => setView({ method: v })}
            />
            <p className="text-[10px] leading-4 text-[#6e6e73] sm:col-span-2 xl:basis-full" data-testid="cost-selection-note">
              {locations.length > 1 && <>{LOCATION_SHORT_LABEL[selection.location]}＝{LOCATION_DESCRIPTION[selection.location]}。</>}
              {METHOD_LABEL[selection.method]}＝{METHOD_DESCRIPTION[selection.method]}。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 xl:self-start">
            {/* 書き換え中は「保存していない変更」のボタンを1行に収めるため、版ラベルを隠す（版は読み物の「この試算について」にも出る） */}
            {model.versionLabel && changes.length === 0 && (
              <span className="inline-flex items-center rounded-full border border-[#d2d2d7] px-2 py-0.5 text-[11px] text-[#3c3c43]">{model.versionLabel}</span>
            )}
            <a href="#cm-guide" className="text-[11px] font-medium text-[#0267b2] underline underline-offset-2">見方</a>
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
                      {formatDraftValue(c.field, c.before)} → <span className="font-semibold text-[#0267b2]">{formatDraftValue(c.field, c.after)}</span>
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
            <CostControlsPanel
              saved={bundle}
              working={working}
              computed={computed}
              selection={selection}
              flow={flow}
              unit={unit}
              onChange={onChange}
              scrollable={paneHeight !== null}
              onSelectTankMode={(tankMode) => setView({ tankMode })}
            />
          </div>
          <div className="order-1 min-h-0 border-b border-[#e5e5e7] p-3 xl:order-2 xl:overflow-y-auto xl:border-b-0">
            <CostResultsPanel
              unit={unit}
              computed={computed}
              baseline={baseline}
              otherStrain={otherStrain}
              selection={selection}
              hasMargin={hasMargin}
              targetTotal={model.targetTotalCostPerUnit}
              flow={flow}
              baselineFlow={baselineFlow}
              onSelectStrain={(s) => setView({ strain: s })}
              onSelectScenario={(a, l, m) => setView({ application: a, location: l, method: m })}
              onShowFlow={showFlow}
            />
          </div>
        </div>
      </div>

      {/* ここから下は読み物。表の数字は試算中の変更を重ねた値で、書き換えた欄には「試算中」の印が付く */}
      <CostReadingSections saved={bundle} working={working} computed={computed} selection={selection} unit={unit} />
    </div>
  );
}

function LiSTiePartialCostModel({ bundle }: { bundle: CostModelBundle }) {
  const byRole = new Map(bundle.assumptions.map((a) => [a.roleKey, a]));
  const value = (roleKey: string) => byRole.get(roleKey)?.value ?? 0;
  const target = byRole.get("target_total_cost_usd_per_kg")?.valueText ?? "3 USD/kg 以下";

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[#1d1d1f] px-2.5 py-1 text-[11px] font-semibold text-white">部分試算</span>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">{bundle.model.title}</h2>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-[#3c3c43]">{bundle.model.summaryMd}</p>
        {bundle.model.sourceNote && <p className="mt-2 text-[11px] text-[#6e6e73]">{bundle.model.sourceNote}</p>}
      </section>

      <section className="rounded-xl border border-[#f0c36d] bg-[#fffaf0] p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">事業としての総コスト目標</h3>
        <p className="mt-1 text-[24px] font-semibold tabular-nums text-[#1d1d1f]">{target}</p>
        <p className="mt-1 text-[11px] leading-5 text-[#6e6e73]">この目標は全工程の総コスト。下の円/kg試算は膜＋電力だけで、為替換算や全体原価との比較はまだしていない。</p>
      </section>

      <section className="rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">5Aケースの膜＋電力コスト</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Metric label="膜＋電力" value={`${num(value("partial_cost_5a_total"))} 円/kg`} note="全工程の総原価ではない" />
          <Metric label="うち膜" value={`${num(value("partial_cost_5a_membrane"))} 円/kg`} />
          <Metric label="うち電力" value={`${num(value("partial_cost_5a_power"))} 円/kg`} />
        </div>
      </section>

      <section className="rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">膜寿命の感度</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Metric label="膜寿命2年の場合" value={`${num(value("partial_cost_membrane_life_2y"))} 円/kg`} note="膜＋電力の部分試算" />
          <Metric label="5Aケースからの低下" value={`${num(value("partial_cost_membrane_life_2y_reduction"))}%`} note="膜寿命の改善が優先論点" />
        </div>
      </section>

      <section className="rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">膜単価の前提</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Metric label="従来前提" value={`${num(value("membrane_price_old"), 0)} 千円/m²`} />
          <Metric label="2028年目安" value={`${num(value("membrane_price_2028"), 0)} 千円/m²`} note="資料中の提示値。見積確定値ではない" />
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-3">
      <p className="text-[11px] text-[#6e6e73]">{label}</p>
      <p className="mt-1 text-[16px] font-semibold tabular-nums text-[#1d1d1f]">{value}</p>
      {note && <p className="mt-1 text-[10px] leading-4 text-[#6e6e73]">{note}</p>}
    </div>
  );
}

function EmptyState({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-[#d2d2d7] bg-white p-6">
      <h3 className="text-[13px] font-semibold text-[#1d1d1f]">このPJにはまだコスト試算がない</h3>
      <p className="mt-2 max-w-2xl text-[12px] leading-6 text-[#3c3c43]">
        このタブは、想定している系・CAPEX/OPEX の内訳・成立ライン・確度の低いパラメータを1画面で見るためのもの。
        正本は AMD OS の DB（<code className="rounded bg-[#f2f2f4] px-1 text-[11px]">project_cost_models</code> ほか）で、
        前提や作業の数字を書き換えるとシナリオがその場で再計算される。
      </p>
      <p className="mt-2 text-[11px] leading-5 text-[#6e6e73]">
        {canEdit
          ? "登録するときは SX (p21) の構成を雛形にする。変数に role_key を振ると計算エンジンが読む。"
          : "登録の依頼は AMD 側の管理者へ。"}
      </p>
    </div>
  );
}
