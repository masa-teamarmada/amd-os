"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeCostModel,
  type CostAssumption,
  type CostItem,
  type CostModelBundle,
} from "@/lib/project-cost-model";

// PJコックピット / PJワークスペース「コスト試算」タブ。
// 正本は project_cost_* (migration 320)。前提を1つ動かすと4シナリオが即座に再計算される。
// 計算結果は保存しない。保存するのは前提と明細だけで、数字は常に導出する。

const yen = (v: number, digits = 1) =>
  v.toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const yen0 = (v: number) => Math.round(v).toLocaleString("ja-JP");

const CONFIDENCE_STYLE: Record<string, { label: string; cls: string }> = {
  S: { label: "確定", cls: "bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]" },
  A: { label: "A 概算", cls: "bg-[#e8f5e9] text-[#2e7d32] border-[#c8e6c9]" },
  B: { label: "B 見積前", cls: "bg-[#e3f2fd] text-[#1565c0] border-[#bbdefb]" },
  C: { label: "C 仮置き", cls: "bg-[#fff8e1] text-[#8d6e00] border-[#ffe082]" },
  H: { label: "H 仮説", cls: "bg-[#ffebee] text-[#b71c1c] border-[#ffcdd2]" },
};

function ConfidenceTag({ value }: { value: string | null }) {
  if (!value) return null;
  const s = CONFIDENCE_STYLE[value];
  if (!s) return null;
  return (
    <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-[1px] text-[10px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

interface Props {
  projectId: string;
  /** 表示のみに固定する面 (ワークスペース側) では false を渡す。 */
  allowEdit?: boolean;
}

export function CockpitCostModel({ projectId, allowEdit = true }: Props) {
  const [bundle, setBundle] = useState<CostModelBundle | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/project-cost-model?projectId=${encodeURIComponent(projectId)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "読み込みに失敗");
      setCanEdit(!!json.canEdit && allowEdit);
      if (!json.bundle) return setState("empty");
      setBundle(json.bundle as CostModelBundle);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗");
      setState("error");
    }
  }, [projectId, allowEdit]);

  useEffect(() => {
    void load();
  }, [load]);

  const computed = useMemo(() => (bundle ? computeCostModel(bundle) : null), [bundle]);

  // 前提の編集は楽観更新。DB書き込みが失敗したら読み直して戻す。
  async function patchAssumption(id: string, value: number) {
    if (!bundle) return;
    setBundle({
      ...bundle,
      assumptions: bundle.assumptions.map((a) => (a.costAssumptionId === id ? { ...a, value } : a)),
    });
    setSaving(id);
    try {
      const res = await fetch("/api/project-cost-model", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "assumption", id, patch: { value } }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
    } catch {
      await load();
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
    return (
      <div className="rounded-xl border border-[#e5e5e7] bg-white p-6 text-[13px] text-[#86868b]">
        このPJにはまだコスト試算が登録されていない。
      </div>
    );
  }

  const { model, assumptions, items, questions } = bundle;
  const { derived, scenarios } = computed;
  const keyAssumptions = assumptions.filter((a) => a.isKey && a.value !== null);
  const otherAssumptions = assumptions.filter((a) => !a.isKey);
  const openQuestions = questions.filter((q) => q.status === "open");

  // 中央培養コストが菌体1kgあたりいくらに相当するか。文献値と突き合わせる唯一の共通単位。
  const biomassKgPerM3 = derived.biomassWithLossPerM3 / derived.reuseCount / 1000;
  const central = scenarios[0];
  const impliedBiomassCost =
    biomassKgPerM3 > 0 ? (central.centralCapexPerM3 + central.centralOpexPerM3) / biomassKgPerM3 : 0;

  const byAddressee = openQuestions.reduce<Record<string, typeof openQuestions>>((acc, q) => {
    (acc[q.addressee] ||= []).push(q);
    return acc;
  }, {});
  const addresseeOrder = Object.keys(byAddressee).sort((a, b) => {
    const impact = (k: string) => Math.max(...byAddressee[k].map((q) => q.impactHigh ?? 0), 0);
    return impact(b) - impact(a);
  });

  return (
    <div className="flex flex-col gap-3">
      {/* ヘッダー: ケースを最初に出す。260820版はケース表記が無いまま金属の式で回っていた。 */}
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
        {model.summaryMd && (
          <p className="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-[#4b4b52]">{model.summaryMd}</p>
        )}
        {model.sourceNote && <p className="mt-2 text-[11px] text-[#86868b]">{model.sourceNote}</p>}
      </section>

      {/* 4シナリオ。人件費込みの行を必ず並べる (総コストから外している前提の影響を隠さない)。 */}
      <section className="rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">事業成立サマリー</h3>
        <p className="mt-1 text-[11px] leading-5 text-[#86868b]">
          売価 {yen(derived.salePrice, 0)} 円/m³ ・ 年間処理量 {yen0(derived.annualVolume)} m³/年。
          人件費は自動制御による無人運転前提で総コストに含めていない。下段に参考値を併記する。
        </p>
        <div className="mt-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[620px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[#e5e5e7] text-left text-[11px] text-[#86868b]">
                <th className="py-2 pr-2 font-medium">指標</th>
                {scenarios.map((s) => (
                  <th key={s.key} className="py-2 px-2 text-right font-medium whitespace-nowrap">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[
                { label: "現場設備コスト", get: (s: typeof scenarios[number]) => yen(s.siteTotalPerM3), muted: true },
                { label: "中央培養コスト", get: (s: typeof scenarios[number]) => yen(s.centralTotalPerM3), muted: true },
                { label: "事業全体 総コスト", get: (s: typeof scenarios[number]) => yen(s.totalPerM3), strong: true },
                { label: "営業利益（償却後）", get: (s: typeof scenarios[number]) => yen(s.profitPerM3), signed: true },
                { label: "利益率", get: (s: typeof scenarios[number]) => `${(s.marginRate * 100).toFixed(1)}%`, signed: true },
                { label: "初期投資（円）", get: (s: typeof scenarios[number]) => yen0(s.siteCapexTotal), muted: true },
              ].map((row) => (
                <tr key={row.label} className="border-b border-[#f0f0f2]">
                  <td className={`py-2 pr-2 ${row.strong ? "font-semibold text-[#1d1d1f]" : "text-[#4b4b52]"}`}>
                    {row.label}
                  </td>
                  {scenarios.map((s) => {
                    const v = row.get(s);
                    const negative = row.signed && (row.label === "利益率" ? s.marginRate < 0 : s.profitPerM3 < 0);
                    return (
                      <td
                        key={s.key}
                        className={`py-2 px-2 text-right whitespace-nowrap ${
                          row.strong ? "font-semibold" : ""
                        } ${negative ? "text-red-600" : row.muted ? "text-[#86868b]" : "text-[#1d1d1f]"}`}
                      >
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-b border-[#f0f0f2] bg-[#fafafa]">
                <td className="py-2 pr-2 text-[#86868b]">（参考）人件費 ※不算入</td>
                {scenarios.map((s) => (
                  <td key={s.key} className="py-2 px-2 text-right text-[#86868b] whitespace-nowrap">
                    {yen(s.referenceLaborPerM3)}
                  </td>
                ))}
              </tr>
              <tr className="bg-[#fafafa]">
                <td className="py-2 pr-2 text-[#4b4b52]">（参考）人件費を戻した利益</td>
                {scenarios.map((s) => (
                  <td
                    key={s.key}
                    className={`py-2 px-2 text-right whitespace-nowrap ${
                      s.profitWithLaborPerM3 < 0 ? "text-red-600" : "text-[#1d1d1f]"
                    }`}
                  >
                    {yen(s.profitWithLaborPerM3)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[#86868b]">単位は断りのない限り 円/m³。投資回収年数は設備保有主体の確定後に再設計するため保留。</p>
      </section>

      {/* 感度: 主要前提を動かすと上の表が即座に変わる。ここがスプシからDBへ移した理由。 */}
      <section className="rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">主要前提（動かすと上の表が変わる）</h3>
        <p className="mt-1 text-[11px] leading-5 text-[#86868b]">
          {canEdit ? "値を書き換えると4シナリオが再計算される。計算結果は保存せず、前提だけを保存する。" : "値の編集はadminのみ。"}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
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

        <div className="mt-4 rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-3">
          <h4 className="text-[12px] font-semibold text-[#1d1d1f]">前提から導かれる物量</h4>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4">
            {[
              ["必要菌体量", `${yen(derived.biomassWithLossPerM3, 0)} g-DCW/m³`],
              ["必要培養液量", `${yen(derived.requiredBrothPerM3, 0)} L/m³`],
              ["年間菌体量", `${yen(derived.annualBiomassKg, 0)} kg-DCW/年`],
              ["菌体製造原価の含意", `${yen(impliedBiomassCost, 0)} 円/kg-DCW`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[#86868b]">{k}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-[#1d1d1f]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] leading-5 text-[#86868b]">
            菌体製造原価の含意は、中央培養コストを年間菌体量で割った値。閉鎖系スピルリナの商用実績は
            $2.57〜5.10/kg（約390〜770円/kg）。この値がそれを大きく下回るなら、培養の物量条件を確認する。
          </p>
        </div>
      </section>

      {/* 確認事項: 相手別、インパクト順。会の時間配分をこの順で決める。 */}
      <section className="rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
          確認事項 <span className="ml-1 text-[11px] font-normal text-[#86868b]">未確定 {openQuestions.length}件</span>
        </h3>
        <p className="mt-1 text-[11px] leading-5 text-[#86868b]">
          研究者に円は聞かない。先生方へは量・回数・条件だけを聞き、円への変換はAMD側でやる。
          並びは「確定したときに総コストが動く幅」の大きい順。
        </p>
        <div className="mt-3 flex flex-col gap-3">
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
                            ±{yen0(q.impactHigh)} 円/m³
                          </span>
                        )}
                      </div>
                      {q.whyItMatters && (
                        <p className="mt-1.5 text-[11px] leading-5 text-[#86868b]">{q.whyItMatters}</p>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 費用明細。既定は畳む。 */}
      <section className="rounded-xl border border-[#e5e5e7] bg-white">
        <button
          type="button"
          onClick={() => setShowItems((v) => !v)}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-[13px] transition-colors hover:bg-[#fafafa]"
        >
          <span className={`shrink-0 text-[10px] text-[#86868b] transition-transform ${showItems ? "rotate-90" : ""}`}>▶</span>
          <span className="font-semibold text-[#1d1d1f]">費用明細</span>
          <span className="text-[11px] text-[#86868b]">{items.filter((i) => !i.isBreakdown).length}件</span>
        </button>
        {showItems && (
          <div className="px-4 pb-4">
            <ItemTable items={items} assumptions={assumptions} otherAssumptions={otherAssumptions} />
          </div>
        )}
      </section>
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
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(assumption.value ?? ""));
  // 楽観更新やDB再読込で prop が変わったら入力欄を追従させる。
  // effect ではなくレンダー中の調整 (React 公式の props 変化パターン) で行う。
  const [syncedValue, setSyncedValue] = useState(assumption.value);
  if (assumption.value !== syncedValue) {
    setSyncedValue(assumption.value);
    setDraft(String(assumption.value ?? ""));
  }

  return (
    <div className="rounded-lg border border-[#e5e5e7] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-[#1d1d1f]">{assumption.label}</p>
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
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const v = Number(draft);
              if (Number.isFinite(v) && v !== assumption.value) onChange(v);
            }}
            className="w-32 rounded border border-[#d2d2d7] px-2 py-1 text-right text-[13px] font-semibold tabular-nums text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none"
          />
        ) : (
          <span className="text-[13px] font-semibold tabular-nums text-[#1d1d1f]">
            {assumption.value?.toLocaleString("ja-JP")}
          </span>
        )}
        <span className="text-[11px] text-[#86868b]">{assumption.unit}</span>
        {saving && <span className="text-[10px] text-[#86868b]">保存中...</span>}
      </div>
      {assumption.note && <p className="mt-2 text-[11px] leading-5 text-[#86868b]">{assumption.note}</p>}
    </div>
  );
}

function ItemTable({
  items,
  assumptions,
  otherAssumptions,
}: {
  items: CostItem[];
  assumptions: CostAssumption[];
  otherAssumptions: CostAssumption[];
}) {
  const derived = useMemo(() => computeCostModel({ assumptions, items }).derived, [assumptions, items]);
  const visible = items.filter((i) => !i.isBreakdown);
  const groups = ["中央培養", "共通", "循環", "投入"] as const;

  return (
    <div className="flex flex-col gap-4">
      {otherAssumptions.length > 0 && (
        <details className="rounded-lg border border-[#e5e5e7]">
          <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-[#1d1d1f]">
            その他の前提 ({otherAssumptions.length}件)
          </summary>
          <ul className="divide-y divide-[#f0f0f2] px-3 pb-2">
            {otherAssumptions.map((a) => (
              <li key={a.costAssumptionId} className="flex items-center gap-2 py-1.5 text-[11px]">
                <span className="text-[#86868b]">{a.groupLabel}</span>
                <span className="flex-1 text-[#1d1d1f]">{a.label}</span>
                <span className="tabular-nums font-medium text-[#1d1d1f]">
                  {a.value !== null ? a.value.toLocaleString("ja-JP") : a.valueText}
                </span>
                <span className="w-16 text-right text-[#86868b]">{a.unit}</span>
                <ConfidenceTag value={a.confidence} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {groups.map((g) => {
        const rows = visible.filter((i) => i.scenario === g);
        if (rows.length === 0) return null;
        return (
          <div key={g}>
            <h4 className="text-[12px] font-semibold text-[#1d1d1f]">{g}</h4>
            <div className="mt-1.5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[680px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#e5e5e7] text-left text-[10px] text-[#86868b]">
                    <th className="py-1.5 pr-2 font-medium">項目</th>
                    <th className="py-1.5 px-2 font-medium">区分</th>
                    <th className="py-1.5 px-2 text-right font-medium">単価</th>
                    <th className="py-1.5 px-2 text-right font-medium">耐用</th>
                    <th className="py-1.5 px-2 text-right font-medium">年額(円)</th>
                    <th className="py-1.5 pl-2 font-medium">確度・出所</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((i) => {
                    const annual =
                      i.basis === "初期投資配賦"
                        ? (i.quantity * i.unitPrice * i.annualFactor) / (i.usefulLifeYears || 1)
                        : i.basis === "毎m³比例"
                        ? i.quantity * i.unitPrice * i.annualFactor * derived.annualVolume
                        : i.quantity * i.unitPrice * i.annualFactor;
                    return (
                      <tr key={i.costItemId} className="border-b border-[#f6f6f7] align-top">
                        <td className="py-1.5 pr-2 text-[#1d1d1f]">
                          {i.leafLabel || i.midLabel || i.groupLabel}
                          {i.priceRule && (
                            <span className="ml-1.5 rounded bg-[#eef2ff] px-1 py-[1px] text-[9px] font-medium text-[#3730a3]">
                              変数連動
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-[#86868b]">{i.costType}</td>
                        <td className="py-1.5 px-2 text-right text-[#4b4b52]">
                          {i.priceRule ? "—" : i.unitPrice.toLocaleString("ja-JP")}
                        </td>
                        <td className="py-1.5 px-2 text-right text-[#86868b]">
                          {i.usefulLifeYears ? `${i.usefulLifeYears}年` : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right text-[#1d1d1f]">
                          {i.priceRule ? "変数から算出" : yen0(annual)}
                        </td>
                        <td className="py-1.5 pl-2">
                          <div className="flex items-center gap-1.5">
                            <ConfidenceTag value={i.confidence} />
                            <span className="text-[10px] text-[#86868b]">{i.sourceKind}</span>
                          </div>
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
