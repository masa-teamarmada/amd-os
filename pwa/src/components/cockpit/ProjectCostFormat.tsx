"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { COST_FORMAT_SECTIONS } from "@/lib/project-formats";
import type { CostModelBundle } from "@/lib/project-cost-model";
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
import { loadProjectCostModel, peekProjectCostModel, saveCostPatches } from "@/lib/project-cost-model-client";
import { computeItemsCost, itemsVolumeCases, roleNumber } from "@/lib/project-cost-items-engine";
import { costFormatBreakdown, costFormatInputGroups, costFormatStatus } from "@/lib/project-cost-format";
import { Delta, Segmented, Swatch, int } from "@/components/cockpit/CockpitCostModelParts";
import {
  CostFormatControls,
  CostFormatReading,
  CostFormatResults,
  amount,
  caseOptionLabel,
} from "@/components/cockpit/ProjectCostFormatSections";

// コスト試算タブの標準フォーマット（spec 3-23 §7、定義は src/lib/project-formats.ts の COST_FORMAT_*）。
// 2026-10-03 まさ確定「原価計算は、フォーマットは共通させることを前提にcxのもちゃんと入れて」。
//
// どのPJの試算も、同じ区画・同じ内訳の行・同じグラフで描く。PJごとの違いはデータだけで出す（PJ番号で分けない）。
// 操作の形は SX の試算（2026-09-13〜15 まさ確定）と同じ:
//   - 前提・明細・作業の数字は画面で書き換えられ、その場で再計算する。書き換えは保存しない（試算）。
//     正本へ書くのは、admin が「この値を保存」「すべて保存」を押したときだけ
//   - デスクトップでは操作パネル（前提と作業）と結果を左右に並べ、操作パネルの中だけをスクロールする。
//     スマホ幅では結果の要約を上に固定する
//   - ケース（年間の量）を切り替えると、量で薄まる費用（設備の償却・年額の費用・作業）がどう変わるかを比べられる
// 計算は汎用の計算（project-cost-items-engine.ts）。SX の廃液・燃料の試算は、それぞれの画面で描く（移行は次の段）。

interface Props {
  projectId: string;
  /** ワークスペース・DD など、保存させない面では false。試算（画面上の書き換え）はどの面でもできる。 */
  allowEdit?: boolean;
}

// 試算中の変更とケースの選択は、タブを行き来しても消えないようにモジュールに持つ（再読み込みで消える）。
const draftMemory = new Map<string, CostDraft>();
const caseMemory = new Map<string, string>();

const sectionLabel = (key: (typeof COST_FORMAT_SECTIONS)[number]["key"]) => COST_FORMAT_SECTIONS.find((s) => s.key === key)?.label ?? key;

export function ProjectCostFormat({ projectId, allowEdit = true }: Props) {
  const cached = peekProjectCostModel(projectId);
  const [bundle, setBundle] = useState<CostModelBundle | null>(cached?.bundle ?? null);
  const [canEdit, setCanEdit] = useState(!!cached?.canEdit && allowEdit);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">(cached ? (cached.bundle ? "ready" : "empty") : "loading");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraftState] = useState<CostDraft>(() => draftMemory.get(projectId) ?? {});
  const [caseKey, setCaseKeyState] = useState<string | null>(() => caseMemory.get(projectId) ?? null);
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
  const setCaseKey = useCallback(
    (key: string) => {
      caseMemory.set(projectId, key);
      setCaseKeyState(key);
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

  useEffect(() => {
    void load();
  }, [load]);

  const working = useMemo(() => (bundle ? applyDraft(bundle, draft) : null), [bundle, draft]);
  const cases = useMemo(() => (working ? itemsVolumeCases(working.assumptions) : []), [working]);
  const baseVolume = working ? roleNumber(working.assumptions, "business_annual_volume", 0) : 0;
  const current = cases.find((c) => c.key === caseKey) ?? cases.find((c) => c.volume === baseVolume) ?? cases[0] ?? null;
  const volume = current?.volume ?? baseVolume;
  const result = useMemo(() => (working ? computeItemsCost(working, volume) : null), [working, volume]);
  const baseline = useMemo(() => (bundle ? computeItemsCost(bundle, volume) : null), [bundle, volume]);
  const caseResults = useMemo(() => (working ? cases.map((c) => computeItemsCost(working, c.volume)) : []), [working, cases]);
  const groups = useMemo(() => (working ? costFormatInputGroups(working) : []), [working]);
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
      await saveCostPatches(projectId, draftToPatches(bundle, draft, keys));
      setBundle(applyDraft(bundle, Object.fromEntries(keys.map((k) => [k, draft[k]]))));
      setDraft((d) => dropDraftKeys(d, keys));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗");
    } finally {
      setSaving(false);
      void load(true);
    }
  }

  if (state === "loading") {
    return <div className="h-[520px] animate-pulse rounded-xl border border-[#e5e5e7] bg-[#fafafa]" data-testid="cost-format-loading" />;
  }
  if (state === "error") {
    return <div className="rounded-xl border border-[#e5e5e7] bg-white p-6 text-[13px] text-[#be123c]">{error}</div>;
  }
  if (state === "empty" || !bundle || !working || !result || !baseline) {
    return <CostFormatEmpty canEdit={canEdit} />;
  }

  const { model } = working;
  const unit = model.unitBasisLabel || "単位";
  const target = model.targetTotalCostPerUnit;
  const marginRate = model.targetMarginRate;
  const status = costFormatStatus(result.totalPerUnit, result.salePrice, target, marginRate);
  const rows = costFormatBreakdown(result, groups);
  const caseLabel = current ? `${caseOptionLabel(current, unit)}/年${current.label ? `（${current.label}）` : ""}` : `${int(volume)}${unit}/年`;

  return (
    <div className="flex flex-col gap-3" data-testid="project-cost-format">
      <div className="rounded-xl border border-[#e5e5e7] bg-white">
        <h2 className="sr-only">{model.title}</h2>
        {/* スマホ幅: 結果の要約を上に固定する */}
        <div className="sticky top-0 z-20 border-b border-[#e5e5e7] bg-white/95 px-3 py-1.5 backdrop-blur xl:hidden" data-testid="cost-format-summary-bar">
          <p className="truncate text-[10px] text-[#6e6e73]">
            {caseLabel}
            {changes.length > 0 && <span className="ml-1 font-semibold text-[#0267b2]">試算中 {changes.length}件</span>}
          </p>
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[16px] font-semibold tabular-nums text-[#1d1d1f]">{amount(result.totalPerUnit)}</span>
            <span className="text-[11px] text-[#6e6e73]">円/{unit}</span>
            <span className={`text-[11px] font-semibold ${status.tone === "bad" ? "text-[#be123c]" : status.tone === "warn" ? "text-[#b45309]" : "text-[#1d1d1f]"}`}>{status.label}</span>
            <Delta value={result.totalPerUnit - baseline.totalPerUnit} digits={Math.abs(result.totalPerUnit) >= 1000 ? 0 : 1} className="text-[11px]" />
          </p>
          <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-[#f0f0f2]" aria-hidden="true">
            {rows
              .filter((r) => r.amount > 0)
              .map((r) => (
                <span key={r.key} className="h-full" style={{ flexGrow: r.amount, backgroundColor: r.color }} />
              ))}
          </div>
        </div>

        {/* 試算とケース、保存していない変更 */}
        <section
          data-cost-section="selection"
          aria-label={sectionLabel("selection")}
          className="relative flex flex-col gap-2 border-b border-[#e5e5e7] px-3 py-2 xl:flex-row xl:items-center xl:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1.5">
            {cases.length > 1 && (
              <Segmented
                label="年間の量"
                ariaLabel="年間の量の切り替え"
                options={cases.map((c) => ({ value: c.key, label: caseOptionLabel(c, unit) }))}
                value={current?.key ?? null}
                onChange={(v) => setCaseKey(v)}
              />
            )}
            <p className="text-[10px] leading-4 text-[#6e6e73]" data-testid="cost-format-selection-note">
              {model.caseLabel ? `${model.caseLabel}。` : ""}
              {caseLabel}で割った1{unit}あたりの原価。1{unit}あたりの明細に、年額の費用・設備の償却・作業の年額を年間の量で割って足す。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 xl:shrink-0 xl:flex-nowrap xl:self-start">
            {model.versionLabel && changes.length === 0 && (
              <span className="inline-flex items-center rounded-full border border-[#d2d2d7] px-2 py-0.5 text-[11px] text-[#3c3c43]">{model.versionLabel}</span>
            )}
            <a href="#cf-about" className="text-[11px] font-medium text-[#0267b2] underline underline-offset-2">
              見方
            </a>
            {changes.length === 0 ? (
              <span className="text-[11px] text-[#6e6e73]" title="数字を書き換えると、保存せずにその場で再計算する">
                保存値で表示中
              </span>
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
                    <button
                      type="button"
                      onClick={() => setDraft((d) => dropDraftKeys(d, [c.key]))}
                      className="min-h-[36px] rounded px-1.5 text-[11px] font-semibold text-[#3c3c43] hover:bg-[#f5f5f7] xl:min-h-0"
                    >
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
        </section>

        {/* 前提と作業（左）と、要約・ケースの比較・原価の内訳（右）。デスクトップは画面の下端まで、操作パネルの中だけスクロールする */}
        <div ref={panesRef} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px]" style={paneHeight ? { height: paneHeight } : undefined}>
          <section data-cost-section="inputs" aria-label={sectionLabel("inputs")} className="order-2 min-h-0 xl:order-1 xl:border-r xl:border-[#e5e5e7]">
            <CostFormatControls
              saved={bundle}
              working={working}
              result={result}
              groups={groups}
              unit={unit}
              caseLabel={caseLabel}
              onChange={onChange}
              scrollable={paneHeight !== null}
            />
          </section>
          <section
            data-cost-section="results"
            aria-label={sectionLabel("results")}
            className="order-1 min-h-0 border-b border-[#e5e5e7] p-3 xl:order-2 xl:overflow-y-auto xl:border-b-0"
          >
            <CostFormatResults
              unit={unit}
              result={result}
              baseline={baseline}
              cases={cases}
              caseResults={caseResults}
              currentKey={current?.key ?? ""}
              groups={groups}
              target={target}
              targetMarginRate={marginRate}
              targetNote={model.targetNote}
              onSelectCase={setCaseKey}
            />
          </section>
        </div>
      </div>

      {/* ここから下は読み物。表の数字は試算中の変更を重ねた値で、書き換えた欄には「試算中」の印が付く */}
      <CostFormatReading saved={bundle} working={working} unit={unit} cases={cases} caseResults={caseResults} result={result} groups={groups} />
    </div>
  );
}

/** 試算が未登録のPJ。区画は消さずに「未登録」と出す（spec 3-23「データが無い区画も消さずに未登録と出す」）。 */
function CostFormatEmpty({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-[#d2d2d7] bg-white p-4 sm:p-5" data-testid="project-cost-format-empty">
      <h3 className="text-[13px] font-semibold text-[#1d1d1f]">このPJのコスト試算は未登録</h3>
      <p className="mt-1 max-w-2xl text-[12px] leading-6 text-[#3c3c43]">
        想定している系、CAPEX と OPEX の内訳、売価との差（成立ライン）、確度の低い数字を、全PJ共通の形で1画面に並べるタブ。
        前提・明細・作業を登録すると、数字を書き換えたときにその場で再計算される。
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {COST_FORMAT_SECTIONS.map((s) => (
          <li key={s.key} data-cost-section={s.key} className="flex items-center justify-between rounded-md bg-[#fafafa] px-2 py-1.5 text-[12px] text-[#3c3c43]">
            <span className="inline-flex items-center gap-1.5">
              <Swatch color="#d2d2d7" />
              {s.label}
            </span>
            <span className="text-[11px] text-[#86868b]">未登録</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-5 text-[#6e6e73]">{canEdit ? "登録は、前提（売価・年間の量・作業単価）・明細（CAPEX と OPEX）・作業から。" : "登録の依頼は AMD 側の管理者へ。"}</p>
    </div>
  );
}
