"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APPLICATION_LABEL,
  CONFIDENCE_LABEL,
  STRAIN_LABEL,
  annualAmount,
  centralItemPerKg,
  computeCostModel,
  costItemLabel,
  scopeApplies,
  type CostApplication,
  type CostAssumption,
  type CostComputation,
  type CostItem,
  type CostModelBundle,
  type CostNote,
  type CostNoteSection,
  type CostScenarioResult,
  type CostSelection,
  type CostStrain,
} from "@/lib/project-cost-model";
import {
  loadProjectCostModel,
  peekProjectCostModel,
  saveCostAssumptionValue,
} from "@/lib/project-cost-model-client";

// PJコックピット / PJワークスペース「コスト試算」タブ。全PJ共通の雛形。
//
// このタブ単体で次が分かることを要件にしている (2026-08-23 まさ指摘):
//   1. どういう系を想定して、どういう計算をしているか
//   2. CAPEX と OPEX がそれぞれいくらか
//   3. いくら以下ならユニットエコノミクスが成立するか
//   4. どのパラメータの確度が低いせいで精度が落ちているか
//
// 二段階で見せる (2026-09-13 まさ確定):
//   第1段 株 (強化株 / 自然株) ごとの菌体の製造原価。上部のスイッチで株を選ぶ。保存しない。
//   第2段 第1段の原価を一定として、用途 (色素分解 / 金属回収) を横に並べる。下の詳細は用途のタブで切り替える。
//
// 正本は project_cost_* (migration 320/324/392)。計算結果は保存しない。保存するのは前提と明細だけで、数字は常に導出する。

const num = (v: number, digits = 1) =>
  v.toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const int = (v: number) => Math.round(v).toLocaleString("ja-JP");
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const signed = (v: number, digits = 1) => `${v >= 0 ? "+" : ""}${num(v, digits)}`;

const CONFIDENCE_STYLE: Record<string, string> = {
  S: "bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]",
  A: "bg-[#e8f5e9] text-[#2e7d32] border-[#c8e6c9]",
  B: "bg-[#e3f2fd] text-[#1565c0] border-[#bbdefb]",
  C: "bg-[#fff8e1] text-[#8d6e00] border-[#ffe082]",
  H: "bg-[#ffebee] text-[#b71c1c] border-[#ffcdd2]",
  未設定: "bg-[#f2f2f4] text-[#6e6e73] border-[#d2d2d7]",
};

function ConfidenceTag({ value }: { value: string | null }) {
  if (!value) return null;
  const cls = CONFIDENCE_STYLE[value];
  if (!cls) return null;
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded border px-1.5 py-[1px] text-[10px] font-semibold ${cls}`}>
      {CONFIDENCE_LABEL[value] ?? value}
    </span>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
      <h3 className="text-[13px] font-semibold text-[#1d1d1f]">{title}</h3>
      {hint && <p className="mt-1 text-[11px] leading-5 text-[#86868b]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

interface Props {
  projectId: string;
  /** ワークスペース側など、表示のみに固定する面では false。 */
  allowEdit?: boolean;
}

export function CockpitCostModel({ projectId, allowEdit = true }: Props) {
  const cached = peekProjectCostModel(projectId);
  const [bundle, setBundle] = useState<CostModelBundle | null>(cached?.bundle ?? null);
  const [canEdit, setCanEdit] = useState(!!cached?.canEdit && allowEdit);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">(
    cached ? (cached.bundle ? "ready" : "empty") : "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  // 株と用途は見るための切り替え。保存しない。
  const [strain, setStrain] = useState<CostStrain | null>(null);
  const [application, setApplication] = useState<CostApplication | null>(null);

  const load = useCallback(
    async (force = false) => {
      try {
        const res = await loadProjectCostModel(projectId, { force });
        setCanEdit(res.canEdit && allowEdit);
        if (!res.bundle) return setState("empty");
        setBundle(res.bundle);
        setState("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : "読み込みに失敗");
        setState("error");
      }
    },
    [projectId, allowEdit]
  );

  // 初回だけ読む。キャッシュが温まっていれば即描画され、裏で最新を確認する。
  useEffect(() => {
    void load();
  }, [load]);

  const computed = useMemo(
    () => (bundle ? computeCostModel({ ...bundle, model: bundle.model }, { strain }) : null),
    [bundle, strain]
  );

  async function patchAssumption(id: string, value: number | null) {
    if (!bundle) return;
    setBundle({
      ...bundle,
      assumptions: bundle.assumptions.map((a) => (a.costAssumptionId === id ? { ...a, value } : a)),
    });
    setSaving(id);
    try {
      await saveCostAssumptionValue(projectId, id, value);
    } catch {
      await load(true);
    } finally {
      setSaving(null);
    }
  }

  if (state === "loading") {
    return <div className="rounded-xl border border-[#e5e5e7] bg-white p-6 text-[13px] text-[#86868b]">読み込み中...</div>;
  }
  if (state === "error") {
    return <div className="rounded-xl border border-[#e5e5e7] bg-white p-6 text-[13px] text-red-600">{error}</div>;
  }
  if (state === "empty" || !bundle || !computed) {
    return <EmptyState canEdit={canEdit} />;
  }

  // LiSTie は、現時点で全工程の原価式ではなく取締役会資料にある
  // 「膜＋電力」の部分試算だけが根拠付きで存在する。SX の4シナリオ式を
  // 流用すると総原価のように誤読されるため、専用の表示に分ける。
  if (bundle.model.caseKind === "other" && bundle.model.caseLabel === "LiSTie 膜＋電力 部分試算") {
    return <LiSTiePartialCostModel bundle={bundle} />;
  }

  const { model, assumptions, items, questions, notes } = bundle;
  const notesOf = (section: CostNoteSection) =>
    (notes ?? []).filter((n) => n.section === section).sort((a, b) => a.sortOrder - b.sortOrder);
  const unit = model.unitBasisLabel || "m³";
  const { strains, applications, biomass } = computed;
  const activeApp: CostApplication | null =
    application && applications.includes(application) ? application : applications[0] ?? null;
  const selection: CostSelection = { strain: computed.strain, application: activeApp };
  const scenarios = computed.scenarios.filter((s) => s.application === activeApp);
  const derived = computed.derivedByApplication.find((d) => d.application === activeApp)?.derived ?? computed.derived;
  const strainLabel = computed.strain ? STRAIN_LABEL[computed.strain] : "";
  const appLabel = activeApp ? APPLICATION_LABEL[activeApp] : "";
  const keyAssumptions = assumptions.filter(
    (a) => a.isKey && (a.value !== null || a.roleKey === "biomass_cost_per_kg_override") && scopeApplies(a, selection)
  );
  const openQuestions = questions.filter((q) => q.status === "open");
  const hasLegacyReference = scenarios.some((s) => s.referenceLaborPerUnit > 0);

  // 精度を下げている項目は方式ごとに違うので、両方式の既設ケースを混ぜて金額順に出す。
  const uncertainAcrossMethods = (() => {
    const seen = new Map<string, (typeof scenarios)[number]["topUncertain"][number]>();
    for (const s of scenarios.filter((x) => x.tankMode === "既設")) {
      for (const u of s.topUncertain) {
        const prev = seen.get(u.costItemId);
        if (!prev || u.perUnit > prev.perUnit) seen.set(u.costItemId, u);
      }
    }
    return [...seen.values()].sort((a, b) => b.perUnit - a.perUnit).slice(0, 10);
  })();

  const byAddressee = openQuestions.reduce<Record<string, typeof openQuestions>>((acc, q) => {
    (acc[q.addressee] ||= []).push(q);
    return acc;
  }, {});
  const addresseeOrder = Object.keys(byAddressee).sort(
    (a, b) =>
      Math.max(...byAddressee[b].map((q) => q.impactHigh ?? 0), 0) -
      Math.max(...byAddressee[a].map((q) => q.impactHigh ?? 0), 0)
  );

  return (
    <div className="flex flex-col gap-3">
      {/* 1. 何の試算か。株のスイッチもここに置く。 */}
      <section className="rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[#1d1d1f] px-2.5 py-1 text-[11px] font-semibold text-white">
            ケース: {model.caseLabel}
          </span>
          {model.versionLabel && (
            <span className="inline-flex items-center rounded-full border border-[#d2d2d7] px-2.5 py-1 text-[11px] text-[#4b4b52]">
              {model.versionLabel}
            </span>
          )}
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">{model.title}</h2>
          {model.sourceUrl && (
            <a
              href={model.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-[12px] font-medium text-[#0071e3] underline underline-offset-2"
            >
              原典スプレッドシート
            </a>
          )}
        </div>
        {strains.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-[#e5e5e7] bg-[#fafafa] px-3 py-2.5">
            <span className="text-[12px] font-semibold text-[#1d1d1f]">株</span>
            <Segmented
              ariaLabel="株の切り替え"
              options={strains.map((s) => ({ value: s, label: STRAIN_LABEL[s] }))}
              value={computed.strain}
              onChange={(v) => setStrain(v)}
            />
            <span className="text-[11px] leading-5 text-[#86868b]">切り替えは保存されない。菌体の製造原価と、株に効く前提・明細が入れ替わる。</span>
          </div>
        )}
        {model.summaryMd && (
          <div className="mt-3">
            <MiniMarkdown text={model.summaryMd} />
          </div>
        )}
        {model.sourceNote && <p className="mt-2 text-[11px] text-[#86868b]">{model.sourceNote}</p>}
      </section>

      {/* 2. どういう系を想定しているか */}
      {model.systemScopeMd && (
        <Card title="想定している系" hint="この試算がどんな構成・規模・収益モデルを前提にしているか。">
          <MiniMarkdown text={model.systemScopeMd} />
        </Card>
      )}

      {/* 2b. 注意して読むところ。原典シートの注記行はここへ集める。 */}
      {notesOf("caveat").length > 0 && (
        <Card title="注意して読むところ" hint="この数字を読むときに、先に知っておかないと誤解する前提。">
          <NoteList notes={notesOf("caveat")} />
        </Card>
      )}

      {/* 3. 第1段 菌体の製造原価。用途では変わらない。 */}
      {biomass.capacityKgYear > 0 || biomass.overridePerKg !== null ? (
        <Card
          title="第1段 菌体の製造原価"
          hint="乾燥菌体1kgをつくる原価。同じ株なら、色素分解でも金属回収でも同じ原価を使う。株を選ぶと下の第2段がこの原価で再計算される。"
        >
          {computed.biomassByStrain.length > 1 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {computed.biomassByStrain.map((b) => {
                const active = b.strain === computed.strain;
                return (
                  <button
                    key={b.strain ?? "all"}
                    type="button"
                    onClick={() => b.strain && setStrain(b.strain)}
                    aria-pressed={active}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      active ? "border-[#1d1d1f] bg-white shadow-[0_0_0_1px_#1d1d1f]" : "border-[#e5e5e7] bg-[#fafafa] hover:border-[#c7c7cc]"
                    }`}
                  >
                    <p className="text-[11px] font-semibold text-[#4b4b52]">{b.strainLabel}</p>
                    <p className="mt-1 text-[20px] font-semibold tabular-nums text-[#1d1d1f]">
                      {num(b.perKg)} <span className="text-[12px] font-medium text-[#6e6e73]">円/kg-DCW</span>
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-[#86868b]">
                      {b.overridePerKg !== null
                        ? "上書き値で計算中"
                        : b.strainSpecificPerKg > 0
                          ? `うち株固有の費用（閉鎖系の追加など） ${num(b.strainSpecificPerKg)} 円/kg`
                          : "株固有の費用なし"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          <div className={`${computed.biomassByStrain.length > 1 ? "mt-3" : ""} -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0`}>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[#e5e5e7] text-left text-[11px] text-[#86868b]">
                  <th className="py-2 pr-2 font-medium">{strainLabel ? `${strainLabel}の内訳` : "内訳"}</th>
                  <th className="px-2 py-2 text-right font-medium">円/kg-DCW</th>
                  <th className="pl-2 py-2 text-right font-medium">うち株固有</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {biomass.rows.map((r) => (
                  <tr key={r.key} className="border-b border-[#f0f0f2]">
                    <td className="py-2 pr-2 text-[#4b4b52]">
                      {r.label}
                      <span className="block text-[10px] leading-4 text-[#86868b]">{biomassRowFormula(r.key, biomass)}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-[#1d1d1f]">{num(r.perKg)}</td>
                    <td className="whitespace-nowrap py-2 pl-2 text-right text-[#86868b]">{r.strainSpecificPerKg > 0 ? num(r.strainSpecificPerKg) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-b border-[#f0f0f2]">
                  <td className="py-2 pr-2 font-semibold text-[#1d1d1f]">明細から計算した原価</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-[#1d1d1f]">{num(biomass.computedPerKg)}</td>
                  <td className="whitespace-nowrap py-2 pl-2 text-right text-[#86868b]">
                    {biomass.overridePerKg === null && biomass.strainSpecificPerKg > 0 ? num(biomass.strainSpecificPerKg) : "—"}
                  </td>
                </tr>
                {biomass.overridePerKg !== null && (
                  <tr className="border-b border-[#f0f0f2] bg-[#fff8e1]">
                    <td className="py-2 pr-2 font-semibold text-[#8d6e00]">上書き値（第2段はこちらで計算）</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-[#8d6e00]">{num(biomass.overridePerKg)}</td>
                    <td className="py-2 pl-2" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[#86868b]">
            CAPEXは「初期投資 ÷ 耐用年数 ÷ 年間生産能力」で1kgあたりにしている。年間生産能力の量を作って使い切る前提なので、実際の供給量が能力を下回ると1kgあたりの原価は上がる。
            閉鎖系スピルリナの商用実績は約390〜770円/kg。
          </p>
        </Card>
      ) : null}

      {/* 4. 第2段 用途を横に並べる。 */}
      {applications.length > 0 && (
        <Card
          title="第2段 用途別の処理原価"
          hint={`第1段の原価（${strainLabel ? `${strainLabel}・` : ""}${num(biomass.perKg)} 円/kg-DCW）を一定として、用途ごとに1${unit}あたりの総コストを並べる。下段の小さい数字は人件費を除いた値。`}
        >
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[#e5e5e7] text-left text-[11px] text-[#86868b]">
                  <th className="py-2 pr-2 font-medium">シナリオ</th>
                  {applications.map((a) => (
                    <th key={a} className="whitespace-nowrap px-2 py-2 text-right font-medium">{APPLICATION_LABEL[a]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {computed.scenarios
                  .filter((s) => s.application === applications[0])
                  .map((row) => (
                    <tr key={row.label} className="border-b border-[#f0f0f2]">
                      <td className="whitespace-nowrap py-2 pr-2 text-[#1d1d1f]">{row.label}</td>
                      {applications.map((a) => {
                        const s = computed.scenarios.find((x) => x.application === a && x.method === row.method && x.tankMode === row.tankMode);
                        if (!s) return <td key={a} className="px-2 py-2 text-right">—</td>;
                        const ok = s.gapToAllowedPerUnit >= 0;
                        return (
                          <td key={a} className="px-2 py-2 text-right align-top">
                            <span className={`whitespace-nowrap font-semibold ${ok ? "text-[#1b5e20]" : "text-[#b71c1c]"}`}>{num(s.totalPerUnit)}</span>
                            <span className="block text-[10px] leading-4 text-[#86868b]">
                              人件費を除くと <span className="whitespace-nowrap">{num(s.totalWithoutLaborPerUnit)}</span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                <SectionRow label="用途で変わる量（方式・槽によらず同じ）" span={applications.length + 1} />
                {([
                  ["使い切る菌体量（kg-DCW/" + unit + "）", (s: CostScenarioResult) => num(s.biomassKgPerUnit, 3)],
                  ["菌体費（円/" + unit + "）", (s: CostScenarioResult) => num(s.centralTotalPerUnit)],
                  ["使用済み菌体の後処理（円/" + unit + "）", (s: CostScenarioResult) => num(s.postProcessPerUnit)],
                ] as Array<[string, (s: CostScenarioResult) => string]>).map(([label, fmt]) => (
                  <tr key={label} className="border-b border-[#f0f0f2]">
                    <td className="py-2 pr-2 text-[#4b4b52]">{label}</td>
                    {applications.map((a) => {
                      const s = computed.scenarios.find((x) => x.application === a);
                      return (
                        <td key={a} className="whitespace-nowrap px-2 py-2 text-right align-top text-[#1d1d1f]">{s ? fmt(s) : "—"}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[#86868b]">
            緑は売価 {num(derived.salePrice, 0)} 円/{unit} 以下、赤は超過。用途で違うのは、使い切る菌体の量（対象物質の濃度 ÷ 取り込み効率 ÷ 菌体使用回数）と後処理だけ。
          </p>
        </Card>
      )}

      {/* 4b. 下の詳細を見る用途 */}
      {applications.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[#e5e5e7] bg-white px-4 py-3">
          <span className="text-[12px] font-semibold text-[#1d1d1f]">ここから下の詳細</span>
          <Segmented
            ariaLabel="詳細を見る用途"
            options={applications.map((a) => ({ value: a, label: APPLICATION_LABEL[a] }))}
            value={activeApp}
            onChange={(v) => setApplication(v)}
          />
          <span className="text-[11px] text-[#86868b]">{strainLabel && `${strainLabel}・`}{appLabel}の4シナリオで出す。</span>
        </div>
      )}

      {/* 5. 成立ライン。表より先に「いくらならOKか」を出す。 */}
      <Card
        title={appLabel ? `成立ライン（${appLabel}）` : "成立ライン"}
        hint={`売価 ${num(derived.salePrice, 0)} 円/${unit} ・ 年間処理量 ${int(derived.annualVolume)} ${unit}/年 ・ 年間売上 ${int(scenarios[0].revenueAnnual)} 円。`}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <Metric
            label="総コストの許容上限"
            value={`${num(scenarios[0].allowedTotalCostPerUnit)} 円/${unit}`}
            note={
              model.targetMarginRate
                ? `売価 × (1 − 目標利益率 ${pct(model.targetMarginRate)})`
                : "売価と同額（利益0の損益分岐）"
            }
          />
          <Metric
            label="総コスト目標"
            value={model.targetTotalCostPerUnit !== null ? `${num(model.targetTotalCostPerUnit, 0)} 円/${unit}` : "未設定"}
            note={model.targetNote ?? "PJとして置いている目標値。未設定なら損益分岐だけで判定する。"}
          />
          <Metric
            label={strainLabel ? `菌体の製造原価（第1段・${strainLabel}）` : "菌体の製造原価（第1段）"}
            value={`${num(biomass.perKg, 0)} 円/kg-DCW`}
            note="閉鎖系スピルリナの商用実績は約390〜770円/kg。"
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {scenarios.map((s) => {
            const ok = s.gapToAllowedPerUnit >= 0;
            return (
              <div
                key={s.key}
                className={`rounded-lg border p-3 ${ok ? "border-[#c8e6c9] bg-[#f4fbf5]" : "border-[#ffcdd2] bg-[#fff7f7]"}`}
              >
                <p className="text-[11px] font-semibold text-[#1d1d1f]">{s.label}</p>
                <p className={`mt-1 text-[18px] font-semibold tabular-nums ${ok ? "text-[#1b5e20]" : "text-[#b71c1c]"}`}>
                  {signed(s.gapToAllowedPerUnit)}
                </p>
                <p className="mt-0.5 text-[10px] leading-4 text-[#86868b]">
                  {ok ? `円/${unit} の余裕` : `円/${unit} 超過（あとこれだけ下げないと成立しない）`}
                </p>
                <dl className="mt-2 space-y-0.5 text-[10px] text-[#6e6e73]">
                  <div className="flex justify-between gap-2">
                    <dt>損益分岐売価</dt>
                    <dd className="tabular-nums font-medium text-[#1d1d1f]">{num(s.breakEvenPricePerUnit)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>人件費を除くと</dt>
                    <dd className={`tabular-nums font-medium ${s.allowedTotalCostPerUnit - s.totalWithoutLaborPerUnit >= 0 ? "text-[#1b5e20]" : "text-[#b71c1c]"}`}>
                      {signed(s.allowedTotalCostPerUnit - s.totalWithoutLaborPerUnit)}
                    </dd>
                  </div>
                  {s.gapToTargetPerUnit !== null && (
                    <div className="flex justify-between gap-2">
                      <dt>目標総コストとの差</dt>
                      <dd className={`tabular-nums font-medium ${s.gapToTargetPerUnit >= 0 ? "text-[#1b5e20]" : "text-[#b71c1c]"}`}>
                        {signed(s.gapToTargetPerUnit)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 5b. 外部ベンチマークと出典。置いた値が相場から外れていないかを突き合わせる。 */}
      {notesOf("benchmark").length > 0 && (
        <Card title="外部ベンチマークと出典" hint="モデルに置いた値を、外の相場や一次情報と突き合わせるための材料。">
          <NoteList notes={notesOf("benchmark")} />
        </Card>
      )}

      {/* 6. CAPEX / OPEX を分けた損益。円/単位と円/年を併記する。 */}
      <Card
        title={appLabel ? `事業成立サマリー（${strainLabel ? `${strainLabel}・` : ""}${appLabel}）` : "事業成立サマリー"}
        hint={`CAPEXは償却後の年額換算。人件費は手動運用の作業時間で総コストに含め、除いた値を最下段に置く。単位は 円/${unit}（括弧内は 円/年）。`}
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[720px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[#e5e5e7] text-left text-[11px] text-[#86868b]">
                <th className="py-2 pr-2 font-medium">指標</th>
                {scenarios.map((s) => (
                  <th key={s.key} className="whitespace-nowrap px-2 py-2 text-right font-medium">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <SectionRow label="菌体（第1段の原価 × 使い切る菌体量）" span={scenarios.length + 1} />
              <Row label={`　使い切る菌体量（kg-DCW/${unit}）`} scenarios={scenarios} get={(s) => [s.biomassKgPerUnit, null]} digits={3} muted />
              <Row label="　菌体費" scenarios={scenarios} get={(s) => [s.centralTotalPerUnit, s.centralCapexAnnual + s.centralOpexAnnual]} />

              <SectionRow label="現場設備（顧客工場1拠点あたり）" span={scenarios.length + 1} />
              <Row label="　OPEX" scenarios={scenarios} get={(s) => [s.siteOpexPerUnit, s.siteOpexAnnual]} />
              <Row label="　CAPEX 年額（槽含む）" scenarios={scenarios} get={(s) => [s.siteCapexPerUnit, s.siteCapexAnnual]} />
              <Row label="　小計" scenarios={scenarios} get={(s) => [s.siteTotalPerUnit, null]} sub />
              <Row
                label="　初期投資（総額・円）"
                scenarios={scenarios}
                get={(s) => [null, s.siteCapexTotal]}
                muted
              />

              <SectionRow label="総コストに含む主な内訳" span={scenarios.length + 1} />
              <Row label="　人件費（現場の運転）" scenarios={scenarios} get={(s) => [s.laborPerUnit, null]} />
              <Row label="　巡回サービス（搬入・搬出・交換作業）" scenarios={scenarios} get={(s) => [s.patrolPerUnit, null]} />
              <Row label="　閉鎖系の追加（強化株のみ。第1段の分を含む）" scenarios={scenarios} get={(s) => [s.strainSpecificPerUnit, null]} />
              <Row label="　使用済み菌体の後処理" scenarios={scenarios} get={(s) => [s.postProcessPerUnit, null]} />

              <SectionRow label="事業全体" span={scenarios.length + 1} />
              <Row label="　OPEX 合計" scenarios={scenarios} get={(s) => [s.opexTotalPerUnit, s.opexTotalAnnual]} />
              <Row label="　CAPEX 合計（年額）" scenarios={scenarios} get={(s) => [s.capexTotalPerUnit, s.capexTotalAnnual]} />
              <Row label="　総コスト" scenarios={scenarios} get={(s) => [s.totalPerUnit, s.totalAnnual]} strong />
              <Row label="　営業利益（償却後）" scenarios={scenarios} get={(s) => [s.profitPerUnit, s.profitAnnual]} signedRow />
              <tr className="border-b border-[#f0f0f2]">
                <td className="py-2 pr-2 text-[#4b4b52]">　利益率</td>
                {scenarios.map((s) => (
                  <td
                    key={s.key}
                    className={`whitespace-nowrap px-2 py-2 text-right font-semibold ${s.marginRate < 0 ? "text-red-600" : "text-[#1d1d1f]"}`}
                  >
                    {pct(s.marginRate)}
                  </td>
                ))}
              </tr>

              <SectionRow label="人件費を除くと（無人運転に近づけた場合の目安）" span={scenarios.length + 1} />
              <Row label="　総コスト" scenarios={scenarios} get={(s) => [s.totalWithoutLaborPerUnit, null]} sub />
              <Row label="　営業利益" scenarios={scenarios} get={(s) => [s.profitWithoutLaborPerUnit, null]} signedRow />

              {hasLegacyReference && (
                <>
                  <SectionRow label="参考：人件費（総コストに不算入）" span={scenarios.length + 1} />
                  <Row label="　人件費" scenarios={scenarios} get={(s) => [s.referenceLaborPerUnit, null]} muted />
                  <Row label="　人件費を戻した利益" scenarios={scenarios} get={(s) => [s.profitWithLaborPerUnit, null]} signedRow />
                </>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[#86868b]">
          投資回収年数は、現場設備の保有主体（顧客購入か SX 保有か）が決まっていないため保留。
        </p>
      </Card>

      {/* 6b. この表の読み方。 */}
      {notesOf("reading_guide").length > 0 && (
        <Card title="この表の読み方" hint="各行が何を見るためのものか。投資回収を保留にしている理由もここ。">
          <NoteList notes={notesOf("reading_guide")} />
        </Card>
      )}

      {/* 7. この数字の確からしさ */}
      <Card
        title={appLabel ? `この数字の確からしさ（${appLabel}）` : "この数字の確からしさ"}
        hint="総コストのうち、どの確度の行がいくらを占めているか。仮説(H)と仮置き(C)の比率が高いほど、確定作業で数字は動く。菌体費は第1段の行ごとに配って数えている。"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {scenarios.map((s) => (
            <div key={s.key} className="rounded-lg border border-[#e5e5e7] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12px] font-semibold text-[#1d1d1f]">{s.label}</p>
                <p className="text-[11px] text-[#86868b]">
                  仮説+仮置き{" "}
                  <span className="font-semibold text-[#b71c1c]">
                    {pct(
                      s.confidenceBreakdown
                        .filter((c) => c.grade === "H" || c.grade === "C")
                        .reduce((t, c) => t + c.share, 0)
                    )}
                  </span>
                </p>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#f2f2f4]">
                {s.confidenceBreakdown.map((c) => (
                  <div
                    key={c.grade}
                    style={{ width: `${Math.max(c.share * 100, 0)}%` }}
                    className={
                      c.grade === "H" ? "bg-[#e57373]"
                      : c.grade === "C" ? "bg-[#ffd54f]"
                      : c.grade === "B" ? "bg-[#64b5f6]"
                      : c.grade === "A" || c.grade === "S" ? "bg-[#81c784]"
                      : "bg-[#d2d2d7]"
                    }
                    title={`${CONFIDENCE_LABEL[c.grade]} ${num(c.perUnit)} 円/${unit}`}
                  />
                ))}
              </div>
              <ul className="mt-2 space-y-1">
                {s.confidenceBreakdown.map((c) => (
                  <li key={c.grade} className="flex items-center gap-2 text-[11px]">
                    <ConfidenceTag value={c.grade} />
                    <span className="flex-1 tabular-nums text-[#4b4b52]">{num(c.perUnit)} 円/{unit}</span>
                    <span className="tabular-nums text-[#86868b]">{pct(c.share)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <h4 className="mt-4 text-[12px] font-semibold text-[#1d1d1f]">精度を下げている項目（金額順）</h4>
        <p className="mt-1 text-[11px] text-[#86868b]">確度が仮説(H)・仮置き(C)のまま金額が大きい行。ここを潰すと数字が締まる。</p>
        <div className="mt-2 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-[#e5e5e7] text-left text-[10px] text-[#86868b]">
                <th className="py-1.5 pr-2 font-medium">項目</th>
                <th className="px-2 py-1.5 font-medium">方式</th>
                <th className="px-2 py-1.5 text-right font-medium">円/{unit}</th>
                <th className="px-2 py-1.5 font-medium">確度</th>
                <th className="px-2 py-1.5 font-medium">出所</th>
                <th className="pl-2 py-1.5 font-medium">確認先</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {uncertainAcrossMethods.map((u) => (
                  <tr key={u.costItemId} className="border-b border-[#f6f6f7]">
                    <td className="py-1.5 pr-2 text-[#1d1d1f]">{u.label}</td>
                    <td className="px-2 py-1.5 text-[#86868b]">{u.scenario}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-[#1d1d1f]">{num(u.perUnit)}</td>
                    <td className="px-2 py-1.5"><ConfidenceTag value={u.confidence} /></td>
                    <td className="px-2 py-1.5 text-[#86868b]">{u.sourceKind}</td>
                    <td className="py-1.5 pl-2 text-[#86868b]">{u.owner}</td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 8. 主要前提 */}
      <Card
        title="主要前提（動かすと上の表が変わる）"
        hint={
          canEdit
            ? `表示中の${strainLabel ? `株（${strainLabel}）と` : ""}用途${appLabel ? `（${appLabel}）` : ""}に効く前提だけを出す。値を書き換えると再計算される。計算結果は保存せず、前提だけを保存する。`
            : "値の編集はコックピット側のadminのみ。"
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {keyAssumptions.map((a) => (
            <AssumptionRow
              key={a.costAssumptionId}
              assumption={a}
              canEdit={canEdit}
              saving={saving === a.costAssumptionId}
              onChange={(v) => patchAssumption(a.costAssumptionId, v)}
            />
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-3">
          <h4 className="text-[12px] font-semibold text-[#1d1d1f]">前提から導かれる物量{appLabel ? `（${appLabel}）` : ""}</h4>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4">
            {[
              ["必要菌体量（ロス込）", `${num(derived.biomassWithLossPerM3, 0)} g-DCW/${unit}`],
              ["使い切る菌体量（使用回数で割った後）", `${num(derived.biomassKgPerUnit, 3)} kg-DCW/${unit}`],
              ["年間菌体量", `${num(derived.annualBiomassKg, 0)} kg-DCW/年`],
              ["年間バッチ回数", `${num(derived.annualBatches, 0)} 回/年`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[#86868b]">{k}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-[#1d1d1f]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      {/* 9. すべての前提 (既定で開く) */}
      <Card title="すべての前提" hint="計算に入っている変数の全件。確度と確認先つき。株・用途の印がある行は、その株・用途のときだけ効く。">
        <AssumptionTable assumptions={assumptions} selection={selection} />
      </Card>

      {/* 10. 確認事項 */}
      <Card
        title={`確認事項（未確定 ${openQuestions.length}件）`}
        hint="研究者に円は聞かない。先生方へは量・回数・条件だけを聞き、円への変換はAMD側でやる。並びは「確定したときに総コストが動く幅」の大きい順。"
      >
        <div className="flex flex-col gap-3">
          {addresseeOrder.map((addressee) => (
            <div key={addressee} className="rounded-lg border border-[#e5e5e7]">
              <div className="flex items-center gap-2 border-b border-[#e5e5e7] bg-[#fafafa] px-3 py-2">
                <span className="text-[12px] font-semibold text-[#1d1d1f]">{addressee}</span>
                <span className="text-[11px] text-[#86868b]">{byAddressee[addressee].length}件</span>
              </div>
              <ul className="divide-y divide-[#f0f0f2]">
                {byAddressee[addressee]
                  .slice()
                  .sort((a, b) => (b.impactHigh ?? 0) - (a.impactHigh ?? 0))
                  .map((q) => (
                    <li key={q.costQuestionId} className="px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-[12px] leading-6 text-[#1d1d1f]">{q.question}</p>
                        {q.impactHigh !== null && (
                          <span className="shrink-0 rounded bg-[#1d1d1f] px-1.5 py-[2px] text-[10px] font-semibold tabular-nums text-white">
                            ±{int(q.impactHigh)} 円/{unit}
                          </span>
                        )}
                      </div>
                      {q.whyItMatters && <p className="mt-1.5 text-[11px] leading-5 text-[#86868b]">{q.whyItMatters}</p>}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* 10b. 版の履歴と、この試算が答えていないこと。 */}
      {notesOf("history").length > 0 && (
        <Card title="版の履歴と、この試算が答えていないこと" hint="前版との落差と、まだモデルに入っていない論点。">
          <NoteList notes={notesOf("history")} />
        </Card>
      )}

      {/* 11. 費用明細 (既定で開く) */}
      <Card
        title="費用明細"
        hint={`計算に入っている全 ${items.filter((i) => !i.isBreakdown).length} 行。内訳行は親の小計に含まれるため金額を持たない。表示中の株・用途で発生しない行は薄く出し、金額を空欄にする。`}
      >
        <ItemTable items={items} assumptions={assumptions} unit={unit} computed={computed} selection={selection} />
      </Card>
    </div>
  );
}

/** 第1段の各行が、何を何で割った値かを数字で示す。 */
function biomassRowFormula(key: "capex" | "fixed" | "variable", b: CostComputation["biomass"]): string {
  const cap = `年間生産能力 ${int(b.capacityKgYear)} kg`;
  if (key === "capex") {
    const life =
      b.usefulLifeMinYears === null
        ? "耐用年数 —"
        : b.usefulLifeMinYears === b.usefulLifeMaxYears
          ? `耐用 ${b.usefulLifeMinYears}年`
          : `耐用 ${b.usefulLifeMinYears}〜${b.usefulLifeMaxYears}年`;
    return `初期投資 ${int(b.capexInitial)} 円 ÷ ${life}（償却 年 ${int(b.capexAnnual)} 円）÷ ${cap}`;
  }
  if (key === "fixed") return `年 ${int(b.fixedOpexAnnual)} 円 ÷ ${cap}`;
  return "菌体1kgあたりの単価を足し上げ";
}

function Segmented<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-lg border border-[#d2d2d7] bg-white p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`min-h-[32px] rounded-md px-3 text-[12px] font-semibold transition-colors ${
              active ? "bg-[#1d1d1f] text-white" : "text-[#4b4b52] hover:bg-[#f2f2f4]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ScopeTag({ strain, application }: { strain: CostStrain | null; application: CostApplication | null }) {
  const parts = [strain ? `${STRAIN_LABEL[strain]}のみ` : null, application ? `${APPLICATION_LABEL[application]}のみ` : null].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <span className="ml-1 inline-flex shrink-0 items-center whitespace-nowrap rounded border border-[#d6d3f5] bg-[#f3f1ff] px-1.5 py-[1px] align-middle text-[10px] font-semibold text-[#4a3fb0]">
      {parts.join("・")}
    </span>
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
        <p className="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-[#4b4b52]">{bundle.model.summaryMd}</p>
        {bundle.model.sourceNote && <p className="mt-2 text-[11px] text-[#86868b]">{bundle.model.sourceNote}</p>}
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

function NoteList({ notes }: { notes: CostNote[] }) {
  return (
    <div className="flex flex-col gap-3">
      {notes.map((n) => (
        <div key={n.costNoteId} className="rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-3">
          <h4 className="text-[12px] font-semibold text-[#1d1d1f]">{n.title}</h4>
          {n.bodyMd && (
            <div className="mt-1.5">
              <MiniMarkdown text={n.bodyMd} />
            </div>
          )}
          {(n.sourceLabel || n.sourceUrl) && (
            <p className="mt-2 text-[10px] text-[#86868b]">
              出所:{" "}
              {n.sourceUrl ? (
                <a
                  href={n.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0071e3] underline underline-offset-2"
                >
                  {n.sourceLabel || n.sourceUrl}
                </a>
              ) : (
                n.sourceLabel
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-3">
      <p className="text-[11px] text-[#86868b]">{label}</p>
      <p className="mt-1 text-[16px] font-semibold tabular-nums text-[#1d1d1f]">{value}</p>
      {note && <p className="mt-1 text-[10px] leading-4 text-[#86868b]">{note}</p>}
    </div>
  );
}

function SectionRow({ label, span }: { label: string; span: number }) {
  return (
    <tr className="bg-[#f5f5f7]">
      <td colSpan={span} className="py-1.5 pr-2 text-[11px] font-semibold text-[#4b4b52]">
        {label}
      </td>
    </tr>
  );
}

function Row({
  label,
  scenarios,
  get,
  strong,
  sub,
  muted,
  signedRow,
  digits = 1,
}: {
  label: string;
  scenarios: CostScenarioResult[];
  get: (s: CostScenarioResult) => [number | null, number | null];
  strong?: boolean;
  sub?: boolean;
  muted?: boolean;
  signedRow?: boolean;
  digits?: number;
}) {
  return (
    <tr className="border-b border-[#f0f0f2]">
      <td
        className={`py-2 pr-2 ${strong ? "font-semibold text-[#1d1d1f]" : sub ? "font-medium text-[#1d1d1f]" : muted ? "text-[#86868b]" : "text-[#4b4b52]"}`}
      >
        {label}
      </td>
      {scenarios.map((s) => {
        const [per, annual] = get(s);
        const negative = signedRow && (per ?? 0) < 0;
        return (
          <td
            key={s.key}
            className={`whitespace-nowrap px-2 py-2 text-right ${strong || sub ? "font-semibold" : ""} ${
              negative ? "text-red-600" : muted ? "text-[#86868b]" : "text-[#1d1d1f]"
            }`}
          >
            {per !== null && <span>{signedRow ? signed(per, digits) : num(per, digits)}</span>}
            {per !== null && annual !== null && <span className="text-[#86868b]"> </span>}
            {annual !== null && (
              <span className={per !== null ? "text-[10px] text-[#86868b]" : ""}>
                {per !== null ? `(${int(annual)})` : int(annual)}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

/**
 * 箇条書き・表・**強調** だけの軽量レンダラ。
 * 説明文のためだけに markdown ライブラリを足さない。
 */
function MiniMarkdown({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-[#1d1d1f]">{part.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  const cells = (row: string) =>
    row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  return (
    <div className="flex flex-col gap-2.5">
      {text.split(/\n{2,}/).map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;

        // markdown 表: 2行目が |---|---| の区切り行
        if (lines.length >= 2 && lines[0].trim().startsWith("|") && /^\|[\s:|-]+\|$/.test(lines[1].trim())) {
          const head = cells(lines[0]);
          const body = lines.slice(2).map(cells);
          return (
            <div key={bi} className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[360px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#d2d2d7] text-left text-[10px] text-[#86868b]">
                    {head.map((h, i) => (
                      <th key={i} className={`py-1.5 px-2 font-medium ${i > 0 ? "text-right" : ""}`}>{inline(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {body.map((row, ri) => (
                    <tr key={ri} className="border-b border-[#eaeaec]">
                      {row.map((c, ci) => (
                        <td key={ci} className={`py-1.5 px-2 text-[#1d1d1f] ${ci > 0 ? "text-right" : ""}`}>{inline(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // 番号付きリスト。"1. 〜" が並ぶブロックを ol として描く。
        const firstNumbered = lines.findIndex((l) => /^\s*\d+\.\s/.test(l));
        if (firstNumbered >= 0 && lines.slice(firstNumbered).every((l) => /^\s*\d+\.\s/.test(l))) {
          const lead = lines.slice(0, firstNumbered);
          const numbered = lines.slice(firstNumbered);
          return (
            <div key={bi} className="flex flex-col gap-1">
              {lead.map((l, li) => (
                <p key={li} className="text-[12px] leading-6 text-[#4b4b52]">{inline(l)}</p>
              ))}
              <ol className="ml-5 list-decimal space-y-1">
                {numbered.map((l, li) => (
                  <li key={li} className="text-[12px] leading-6 text-[#4b4b52]">
                    {inline(l.replace(/^\s*\d+\.\s/, ""))}
                  </li>
                ))}
              </ol>
            </div>
          );
        }

        // 箇条書きを含むブロック。先頭に見出し的なリード行があっても拾えるようにする。
        const firstBullet = lines.findIndex((l) => l.trim().startsWith("- "));
        if (firstBullet >= 0 && lines.slice(firstBullet).every((l) => l.trim().startsWith("- "))) {
          const lead = lines.slice(0, firstBullet);
          const bullets = lines.slice(firstBullet);
          return (
            <div key={bi} className="flex flex-col gap-1">
              {lead.map((l, li) => (
                <p key={li} className="text-[12px] leading-6 text-[#4b4b52]">{inline(l)}</p>
              ))}
              <ul className="ml-4 list-disc space-y-1">
                {bullets.map((l, li) => (
                  <li key={li} className="text-[12px] leading-6 text-[#4b4b52]">{inline(l.replace(/^\s*-\s/, ""))}</li>
                ))}
              </ul>
            </div>
          );
        }

        return (
          <p key={bi} className="text-[12px] leading-6 text-[#4b4b52]">
            {lines.map((l, li) => (
              <span key={li}>
                {inline(l)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function AssumptionRow({
  assumption,
  canEdit,
  saving,
  onChange,
}: {
  assumption: CostAssumption;
  canEdit: boolean;
  saving: boolean;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(assumption.value === null ? "" : String(assumption.value));
  // 楽観更新やDB再読込で prop が変わったら入力欄を追従させる (レンダー中の調整)。
  const [syncedValue, setSyncedValue] = useState(assumption.value);
  if (assumption.value !== syncedValue) {
    setSyncedValue(assumption.value);
    setDraft(assumption.value === null ? "" : String(assumption.value));
  }

  return (
    <div className="rounded-lg border border-[#e5e5e7] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-[#1d1d1f]">
            {assumption.label}
            <ScopeTag strain={assumption.strain} application={assumption.application} />
          </p>
          <p className="mt-0.5 text-[10px] text-[#86868b]">
            {assumption.groupLabel}
            {assumption.owner ? ` ・ 確認先 ${assumption.owner}` : ""}
            {assumption.sourceKind ? ` ・ ${assumption.sourceKind}` : ""}
          </p>
        </div>
        <ConfidenceTag value={assumption.confidence} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        {canEdit ? (
          <input
            type="number"
            step="any"
            value={draft}
            placeholder={assumption.value === null ? "空欄" : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim() === "") {
                if (assumption.value !== null) onChange(null);
                return;
              }
              const v = Number(draft);
              if (Number.isFinite(v) && v !== assumption.value) onChange(v);
            }}
            className="w-32 rounded border border-[#d2d2d7] px-2 py-1 text-right text-[13px] font-semibold tabular-nums text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none"
          />
        ) : (
          <span className="text-[13px] font-semibold tabular-nums text-[#1d1d1f]">
            {assumption.value === null ? "空欄" : assumption.value.toLocaleString("ja-JP")}
          </span>
        )}
        <span className="text-[11px] text-[#86868b]">{assumption.unit}</span>
        {saving && <span className="text-[10px] text-[#86868b]">保存中...</span>}
      </div>
      {assumption.note && <p className="mt-2 text-[11px] leading-5 text-[#86868b]">{assumption.note}</p>}
    </div>
  );
}

function AssumptionTable({ assumptions, selection }: { assumptions: CostAssumption[]; selection: CostSelection }) {
  const groups = [...new Set(assumptions.map((a) => a.groupLabel))];
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <div key={g}>
          <h4 className="text-[12px] font-semibold text-[#1d1d1f]">{g}</h4>
          <div className="mt-1.5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[600px] border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-[#e5e5e7] text-left text-[10px] text-[#86868b]">
                  <th className="py-1.5 pr-2 font-medium">変数</th>
                  <th className="px-2 py-1.5 text-right font-medium">値</th>
                  <th className="px-2 py-1.5 font-medium">単位</th>
                  <th className="px-2 py-1.5 font-medium">確度</th>
                  <th className="px-2 py-1.5 font-medium">出所</th>
                  <th className="pl-2 py-1.5 font-medium">確認先</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {assumptions
                  .filter((a) => a.groupLabel === g)
                  .map((a) => {
                    const applies = scopeApplies(a, selection);
                    return (
                      <tr key={a.costAssumptionId} className={`border-b border-[#f6f6f7] align-top ${applies ? "" : "opacity-50"}`}>
                        <td className="py-1.5 pr-2 text-[#1d1d1f]">
                          {a.label}
                          <ScopeTag strain={a.strain} application={a.application} />
                          {a.note && <p className="mt-0.5 text-[10px] leading-4 text-[#86868b]">{a.note}</p>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-[#1d1d1f]">
                          {a.value !== null ? a.value.toLocaleString("ja-JP") : a.valueText ?? "空欄"}
                        </td>
                        <td className="px-2 py-1.5 text-[#86868b]">{a.unit}</td>
                        <td className="px-2 py-1.5"><ConfidenceTag value={a.confidence} /></td>
                        <td className="px-2 py-1.5 text-[#86868b]">{a.sourceKind}</td>
                        <td className="py-1.5 pl-2 text-[#86868b]">{a.owner}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemTable({
  items,
  assumptions,
  unit,
  computed,
  selection,
}: {
  items: CostItem[];
  assumptions: CostAssumption[];
  unit: string;
  computed: CostComputation;
  selection: CostSelection;
}) {
  const derived = computed.derivedByApplication.find((d) => d.application === selection.application)?.derived ?? computed.derived;
  const centralSelection: CostSelection = { strain: selection.strain, application: null };
  const visible = items.filter((i) => !i.isBreakdown);
  const groups = ["中央培養", "共通", "循環", "投入"] as const;

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => {
        const rows = visible.filter((i) => i.scenario === g);
        if (rows.length === 0) return null;
        const capex = rows.filter((r) => r.costType === "CAPEX");
        const opex = rows.filter((r) => r.costType === "OPEX");
        const isCentral = g === "中央培養";
        return (
          <div key={g}>
            <h4 className="text-[12px] font-semibold text-[#1d1d1f]">
              {isCentral ? "中央培養（第1段）" : g}
              <span className="ml-2 text-[10px] font-normal text-[#86868b]">
                CAPEX {capex.length}行 / OPEX {opex.length}行
              </span>
            </h4>
            {isCentral && (
              <p className="mt-0.5 text-[10px] text-[#86868b]">中央培養の行は、菌体1kgあたりの原価へ畳んで第2段に配る。右端は 円/kg-DCW。</p>
            )}
            <div className="mt-1.5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[760px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#e5e5e7] text-left text-[10px] text-[#86868b]">
                    <th className="py-1.5 pr-2 font-medium">項目</th>
                    <th className="px-2 py-1.5 font-medium">区分</th>
                    <th className="px-2 py-1.5 font-medium">発生ロジック</th>
                    <th className="px-2 py-1.5 text-right font-medium">単価</th>
                    <th className="px-2 py-1.5 text-right font-medium">耐用</th>
                    <th className="px-2 py-1.5 text-right font-medium">年額(円)</th>
                    <th className="px-2 py-1.5 text-right font-medium">{isCentral ? "円/kg-DCW" : `円/${unit}`}</th>
                    <th className="pl-2 py-1.5 font-medium">確度・出所</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((i) => {
                    const sel = isCentral ? centralSelection : selection;
                    const applies = scopeApplies(i, sel);
                    const annual = applies ? annualAmount(i, assumptions, derived, sel) : null;
                    const perCol = !applies
                      ? null
                      : isCentral
                        ? centralItemPerKg(i, assumptions, computed.biomass.capacityKgYear, sel)
                        : (annual ?? 0) / (derived.annualVolume || 1);
                    return (
                      <tr key={i.costItemId} className={`border-b border-[#f6f6f7] align-top ${applies ? "" : "opacity-50"}`}>
                        <td className="py-1.5 pr-2 text-[#1d1d1f]">
                          {costItemLabel(i)}
                          {i.groupLabel && (
                            <span className="ml-1 text-[10px] text-[#86868b]">（{i.groupLabel}）</span>
                          )}
                          <ScopeTag strain={i.strain} application={i.application} />
                          {i.note && <p className="mt-0.5 max-w-[420px] text-[10px] leading-4 text-[#86868b]">{i.note}</p>}
                        </td>
                        <td className="px-2 py-1.5 text-[#86868b]">{i.costType}</td>
                        <td className="px-2 py-1.5 text-[#86868b]">
                          {i.basis}
                          {i.priceRule && (
                            <span className="ml-1 rounded bg-[#eef2ff] px-1 py-[1px] text-[9px] font-medium text-[#3730a3]">
                              変数連動
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-[#4b4b52]">
                          {i.priceRule ? "変数から算出" : i.unitPrice.toLocaleString("ja-JP")}
                        </td>
                        <td className="px-2 py-1.5 text-right text-[#86868b]">
                          {i.usefulLifeYears ? `${i.usefulLifeYears}年` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-[#1d1d1f]">{annual === null ? "—" : int(annual)}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-[#1d1d1f]">
                          {perCol === null ? "—" : num(perCol, 2)}
                        </td>
                        <td className="py-1.5 pl-2">
                          <div className="flex items-center gap-1.5">
                            <ConfidenceTag value={i.confidence} />
                            <span className="whitespace-nowrap text-[10px] text-[#86868b]">{i.sourceKind}</span>
                          </div>
                          {i.owner && <p className="mt-0.5 text-[10px] text-[#86868b]">確認先 {i.owner}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-[#d2d2d7] bg-white p-6">
      <h3 className="text-[13px] font-semibold text-[#1d1d1f]">このPJにはまだコスト試算がない</h3>
      <p className="mt-2 max-w-2xl text-[12px] leading-6 text-[#4b4b52]">
        このタブは、想定している系・CAPEX/OPEX の内訳・成立ライン・確度の低いパラメータを1画面で見るためのもの。
        正本は AMD OS の DB（<code className="rounded bg-[#f2f2f4] px-1 text-[11px]">project_cost_models</code> ほか）で、
        前提を1つ動かすとシナリオが再計算される。
      </p>
      <p className="mt-2 text-[11px] leading-5 text-[#86868b]">
        {canEdit
          ? "登録するときは SX (p21) の構成を雛形にする。変数に role_key を振ると計算エンジンが読む。"
          : "登録の依頼は AMD 側の管理者へ。"}
      </p>
    </div>
  );
}
