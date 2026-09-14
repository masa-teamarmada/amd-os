"use client";

import type { CostAssumption, CostItem, CostModelBundle, CostNote, CostNoteSection } from "@/lib/project-cost-model";
import { CO2_FLUE_GAS_ROLE, CONFIDENCE_LABEL, flueGasOn } from "@/lib/project-cost-model";
import {
  FUEL_BASIS_LABEL,
  FUEL_CONVERSION_LABEL,
  FUEL_CULTURE_LABEL,
  FUEL_PARAM_BLOCKS,
  FUEL_PARAM_GROUPS,
  FUEL_PLANT_LABEL,
  FUEL_ROLE_KEYS,
  FUEL_SCOPE_LABEL,
  FUEL_TASK_DRIVER_LABEL,
  FUEL_TEXT_CHOICE_ROLES,
  FUEL_YIELD_CASE_LABEL,
  fuelAssumptionOf,
  fuelCultureItemPerKg,
  fuelEffectiveUnitPrice,
  fuelItemAnnual,
  fuelItemLabel,
  fuelParamGroupOfItem,
  fuelParamGroupOfRole,
  fuelRowApplies,
  fuelTaskAmount,
  type FuelComputation,
  type FuelPriceContext,
  type FuelScenarioResult,
  type FuelScope,
  type FuelTaskDriver,
} from "@/lib/project-fuel-cost-model";
import { Card, ConfidenceTag, MiniMarkdown, int, num, pct, yen } from "@/components/cockpit/CockpitCostModelParts";

// コスト試算（燃料）の読み物。結果の枠の下に置く。数字は試算中の変更を重ねた値で、書き換えた欄に「試算中」の印を付ける。
// 並びは排水処理のコスト試算と同じ: この試算について → 想定している系 → 注意 → 6通りの内訳 → 確からしさ → 確認事項
// → ベンチマーク → 見方 → すべての前提 → 作業リスト → 費用明細 → 版の履歴。

interface Props {
  saved: CostModelBundle;
  working: CostModelBundle;
  computed: FuelComputation;
  current: FuelScenarioResult;
}

function NoteList({ notes }: { notes: CostNote[] }) {
  return (
    <div className="flex flex-col gap-3">
      {notes.map((n) => (
        <div key={n.costNoteId} className="rounded-lg border border-[#e5e5e7] p-3">
          <p className="text-[12px] font-semibold text-[#1d1d1f]">{n.title}</p>
          {n.bodyMd && (
            <div className="mt-1.5">
              <MiniMarkdown text={n.bodyMd} />
            </div>
          )}
          {n.sourceUrl && (
            <a href={n.sourceUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[11px] font-medium text-[#0267b2] underline underline-offset-2">
              {n.sourceLabel || "出典"}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function Changed({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="ml-1 inline-flex items-center rounded bg-[#e8f3fc] px-1 text-[9px] font-semibold text-[#0267b2]" title="保存値から書き換えて試算している">
      試算中
    </span>
  );
}

type MetricRow = {
  label: string;
  get: (s: FuelScenarioResult) => string;
  strong?: boolean;
  muted?: boolean;
  danger?: (s: FuelScenarioResult) => boolean;
};

export function FuelReadingSections({ saved, working, computed, current }: Props) {
  const { model, assumptions, items, questions } = working;
  // CO2 と培養ロス補充の単価は、前提 (排ガス利用可能) とほかの行から出す
  const priceCtx: FuelPriceContext = { assumptions, items };
  // 第1段で数える単位の呼び名 (脂質分泌株なら「脂肪酸」、そうでなければ「菌体」)
  const unitLabel = current.yield.unitLabel;
  const tasks = working.tasks ?? [];
  const notesOf = (section: CostNoteSection) => (working.notes ?? []).filter((n) => n.section === section).sort((a, b) => a.sortOrder - b.sortOrder);
  const scenarios = computed.scenarios;
  const openQuestions = questions.filter((q) => q.status === "open").sort((a, b) => (b.impactHigh ?? 0) - (a.impactHigh ?? 0));
  const savedAssumption = (id: string) => saved.assumptions.find((a) => a.costAssumptionId === id);
  const savedTask = (id: string) => (saved.tasks ?? []).find((t) => t.costTaskId === id);
  const savedItem = (id: string) => saved.items.find((i) => i.costItemId === id);

  const metrics: Array<{ section: string; rows: MetricRow[] }> = [
    {
      section: "燃料1Lあたり（円/L）",
      rows: [
        ...current.breakdown.map((slice) => ({ label: `　${slice.label}`, get: (s: FuelScenarioResult) => num(s.breakdown.find((x) => x.key === slice.key)?.perLiter ?? 0) })),
        { label: "　総コスト", get: (s) => num(s.totalPerLiter), strong: true, danger: (s) => s.gapToPricePerLiter < 0 },
        { label: "　うちCAPEX（培養設備と燃料化設備の償却）", get: (s) => num(s.capexPerLiter), muted: true },
        { label: "　うちOPEX", get: (s) => num(s.opexPerLiter), muted: true },
        { label: "　売価との差", get: (s) => num(s.gapToPricePerLiter), danger: (s) => s.gapToPricePerLiter < 0 },
      ],
    },
    {
      section: "物量と設備",
      rows: [
        { label: `　燃料1Lに要る${unitLabel}（kg/L）`, get: (s) => num(s.yield.unitKgPerLiter, 2) },
        { label: `　${unitLabel}1kgの原価（円/kg）`, get: (s) => num(s.biomass.perKg) },
        { label: `　年に要る${unitLabel}（t/年）`, get: (s) => int(s.scale.unitKgYear / 1000) },
        { label: `　${FUEL_CULTURE_LABEL}（系列）`, get: (s) => int(s.scale.cultureLines) },
        { label: `　${FUEL_PLANT_LABEL}（系列）`, get: (s) => num(s.scale.plantLines, 2) },
        { label: "　初期投資（培養設備＋燃料化設備）", get: (s) => yen(s.capexInitial) },
        { label: "　作業工数（時間/年、燃料化の工場）", get: (s) => int(s.plantTaskHours) },
      ],
    },
    {
      section: "事業全体（年間）",
      rows: [
        { label: "　売上", get: (s) => yen(s.revenueAnnual) },
        { label: "　総コスト", get: (s) => yen(s.totalAnnual), strong: true },
        { label: "　営業利益（償却後）", get: (s) => yen(s.profitAnnual), danger: (s) => s.profitAnnual < 0 },
        { label: "　利益率", get: (s) => pct(s.marginRate), danger: (s) => s.marginRate < 0 },
        { label: `　売価で成立する${unitLabel}の原価（円/kg 以下）`, get: (s) => (s.breakEvenBiomassPerKg > 0 ? num(s.breakEvenBiomassPerKg) : `${unitLabel}がタダでも赤字`), danger: (s) => s.breakEvenBiomassPerKg <= 0 },
      ],
    },
  ];

  // 確からしさ・精度を下げている項目は、選んだFAME転換の3ケースから行ごとに最大を拾う。
  const uncertain = (() => {
    const seen = new Map<string, FuelScenarioResult["topUncertain"][number]>();
    for (const s of scenarios.filter((x) => x.conversion === current.conversion)) {
      for (const u of s.topUncertain) {
        const prev = seen.get(u.id);
        if (!prev || u.perLiter > prev.perLiter) seen.set(u.id, u);
      }
    }
    return [...seen.values()].sort((a, b) => b.perLiter - a.perLiter).slice(0, 10);
  })();

  const roleIndex = (a: CostAssumption) => {
    const g = fuelParamGroupOfRole(a.roleKey);
    if (!g || !a.roleKey) return 0;
    const baseRole = a.roleKey.replace(/_(low|high)$/, "");
    return g.roles.indexOf(baseRole) * 3 + (a.roleKey.endsWith("_low") ? 0 : a.roleKey.endsWith("_high") ? 2 : 1);
  };
  const assumptionSections = FUEL_PARAM_BLOCKS.map((block) => ({
    key: block.key,
    title: block.title,
    groups: FUEL_PARAM_GROUPS.filter((g) => g.block === block.key)
      .map((g) => ({
        key: g.key,
        title: g.title,
        rows: assumptions
          .filter((a) => a.roleKey !== null && FUEL_ROLE_KEYS.has(a.roleKey) && fuelParamGroupOfRole(a.roleKey)?.key === g.key)
          .sort((a, b) => roleIndex(a) - roleIndex(b) || a.sortOrder - b.sortOrder),
      }))
      .filter((g) => g.rows.length > 0),
  })).filter((x) => x.groups.length > 0);
  const unusedAssumptions = assumptions.filter((a) => a.roleKey === null || !FUEL_ROLE_KEYS.has(a.roleKey));

  const itemSections: Array<{ key: string; prefix: string; title: string; rows: CostItem[] }> = FUEL_PARAM_GROUPS.filter((g) => g.block !== "conditions")
    .map((g) => ({ key: g.key, prefix: g.block === "capex" ? "CAPEX" : "OPEX", title: g.title, rows: items.filter((i) => !i.isBreakdown && fuelParamGroupOfItem(i)?.key === g.key) }))
    .filter((x) => x.rows.length > 0);
  const rate = assumptions.find((a) => a.roleKey === "labor_rate")?.value ?? 4000;

  const assumptionValue = (a: CostAssumption) => {
    const choices = a.roleKey ? FUEL_TEXT_CHOICE_ROLES[a.roleKey] : undefined;
    if (choices) return choices.find((c) => c.value === a.valueText)?.label ?? a.valueText ?? "";
    return a.value === null ? "空欄" : a.value.toLocaleString("ja-JP", { maximumFractionDigits: 6 });
  };
  const assumptionChanged = (a: CostAssumption) => {
    const b = savedAssumption(a.costAssumptionId);
    return !!b && (b.value !== a.value || b.valueText !== a.valueText);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="fuel-cost-reading">
      <Card id="fuel-about" title="この試算について" hint={[model.caseLabel && `ケース: ${model.caseLabel}`, model.versionLabel].filter(Boolean).join(" ・ ")}>
        {model.summaryMd && <MiniMarkdown text={model.summaryMd} />}
        {model.sourceNote && <p className="mt-2 text-[11px] text-[#6e6e73]">元にした資料: {model.sourceNote}</p>}
      </Card>

      {model.systemScopeMd && (
        <Card title="想定している系" hint="この試算がどんな製品・工程・分担・規模を前提にしているか。">
          <MiniMarkdown text={model.systemScopeMd} />
        </Card>
      )}

      {notesOf("caveat").length > 0 && (
        <Card title="注意して読むところ" hint="この数字を読むときに、先に知っておかないと誤解する前提。">
          <NoteList notes={notesOf("caveat")} />
        </Card>
      )}

      <Card title="6通りの内訳" hint="FAME転換（外部に委託 / 自社で行う）× 収率（低位 / 基準 / 改善）。CAPEX は初期投資 ÷ 耐用年数の年額を燃料1Lあたりに割った値。">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[760px] border-collapse text-[12px]" data-testid="fuel-scenario-table">
            <thead>
              <tr className="border-b border-[#e5e5e7] text-left text-[11px] text-[#6e6e73]">
                <th className="py-2 pr-2 font-medium">指標</th>
                {scenarios.map((s) => (
                  <th key={s.key} className={`whitespace-nowrap px-2 py-2 text-right font-medium ${s.key === current.key ? "text-[#0267b2]" : ""}`}>
                    {FUEL_CONVERSION_LABEL[s.conversion]}・{FUEL_YIELD_CASE_LABEL[s.yieldCase]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {metrics.map((m) => (
                <MetricSection key={m.section} label={m.section} rows={m.rows} scenarios={scenarios} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="この数字の確からしさ" hint={`FAME転換を${FUEL_CONVERSION_LABEL[current.conversion]}の3ケース。総コストのうち、どの確度の行がいくらを占めているか。仮説(H)と仮置き(C)の比率が高いほど、確定作業で数字は動く。`}>
        <div className="grid gap-3 lg:grid-cols-3">
          {scenarios
            .filter((s) => s.conversion === current.conversion)
            .map((s) => (
              <div key={s.key} className="rounded-lg border border-[#e5e5e7] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[12px] font-semibold text-[#1d1d1f]">収率{FUEL_YIELD_CASE_LABEL[s.yieldCase]}</p>
                  <p className="text-[11px] text-[#6e6e73]">
                    仮説+仮置き{" "}
                    <span className="font-semibold text-[#be123c]">{pct(s.confidenceBreakdown.filter((c) => c.grade === "H" || c.grade === "C").reduce((t, c) => t + c.share, 0))}</span>
                  </p>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#f2f2f4]">
                  {s.confidenceBreakdown.map((c) => (
                    <div
                      key={c.grade}
                      style={{ width: `${Math.max(c.share * 100, 0)}%` }}
                      className={c.grade === "H" ? "bg-[#fb7185]" : c.grade === "C" ? "bg-[#fbbf24]" : c.grade === "B" || c.grade === "A" ? "bg-[#7cbceb]" : c.grade === "S" ? "bg-[#34d399]" : "bg-[#d2d2d7]"}
                      title={`${CONFIDENCE_LABEL[c.grade]} ${num(c.perLiter)} 円/L`}
                    />
                  ))}
                </div>
                <ul className="mt-2 space-y-1">
                  {s.confidenceBreakdown.map((c) => (
                    <li key={c.grade} className="flex items-center gap-2 text-[11px]">
                      <ConfidenceTag value={c.grade} />
                      <span className="flex-1 tabular-nums text-[#3c3c43]">{num(c.perLiter)} 円/L</span>
                      <span className="tabular-nums text-[#6e6e73]">{pct(c.share)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
        <h4 className="mt-4 text-[12px] font-semibold text-[#1d1d1f]">精度を下げている項目（金額順）</h4>
        <p className="mt-1 text-[11px] text-[#6e6e73]">確度が仮説(H)・仮置き(C)のまま金額が大きい行。3ケースのうち大きい方の額。培養設備の行は第1段（菌体費）に配った額。</p>
        <div className="mt-2 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-[#e5e5e7] text-left text-[10px] text-[#6e6e73]">
                <th className="py-1.5 pr-2 font-medium">項目</th>
                <th className="px-2 py-1.5 font-medium">どこで発生するか</th>
                <th className="px-2 py-1.5 text-right font-medium">円/L</th>
                <th className="px-2 py-1.5 font-medium">確度</th>
                <th className="px-2 py-1.5 font-medium">出所</th>
                <th className="py-1.5 pl-2 font-medium">確認先</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {uncertain.map((u) => (
                <tr key={u.id} className="border-b border-[#f6f6f7]">
                  <td className="py-1.5 pr-2 text-[#1d1d1f]">{u.label}</td>
                  <td className="px-2 py-1.5 text-[#6e6e73]">{FUEL_SCOPE_LABEL[u.scope as FuelScope] ?? u.scope}</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-[#1d1d1f]">{num(u.perLiter)}</td>
                  <td className="px-2 py-1.5"><ConfidenceTag value={u.confidence} /></td>
                  <td className="px-2 py-1.5 text-[#6e6e73]">{u.sourceKind}</td>
                  <td className="py-1.5 pl-2 text-[#6e6e73]">{u.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`確認事項（未確定 ${openQuestions.length}件）`} hint="並びは「確定したときに総コスト（外部に委託・収率基準）が動く幅」の大きい順。研究者には円ではなく量・回数・条件を聞き、円への変換はAMD側でやる。">
        <ul className="flex flex-col divide-y divide-[#f0f0f2] rounded-lg border border-[#e5e5e7]" data-testid="fuel-questions">
          {openQuestions.map((q) => (
            <li key={q.costQuestionId} className="px-3 py-2.5">
              <div className="flex flex-wrap items-start gap-2">
                <span className="shrink-0 rounded border border-[#d2d2d7] bg-[#fafafa] px-1.5 py-[1px] text-[10px] font-semibold text-[#3c3c43]">{q.addressee}</span>
                <p className="min-w-0 flex-1 text-[12px] leading-6 text-[#1d1d1f]">{q.question}</p>
                {q.impactHigh !== null && (
                  <span className="shrink-0 rounded bg-[#1d1d1f] px-1.5 py-[2px] text-[10px] font-semibold tabular-nums text-white">
                    {q.impactLow !== null && q.impactLow !== q.impactHigh ? `${int(q.impactLow)}〜` : ""}
                    {int(q.impactHigh)} 円/L
                  </span>
                )}
              </div>
              {q.whyItMatters && <p className="mt-1.5 text-[11px] leading-5 text-[#6e6e73]">{q.whyItMatters}</p>}
            </li>
          ))}
        </ul>
      </Card>

      {notesOf("benchmark").length > 0 && (
        <Card title="外部ベンチマークと出典" hint="モデルに置いた値を、外の相場や一次情報と突き合わせるための材料。">
          <NoteList notes={notesOf("benchmark")} />
        </Card>
      )}

      {notesOf("reading_guide").length > 0 && (
        <Card id="fuel-guide" title="この画面の見方" hint="各部分が何を見るためのものか。">
          <NoteList notes={notesOf("reading_guide")} />
        </Card>
      )}

      <Card title="すべての前提" hint="計算に入っている前提の全件を、操作パネルと同じ「事業と製造の条件 / CAPEX / OPEX」の区分で並べる。確度と確認先つき。">
        <div className="flex flex-col gap-4">
          {assumptionSections.map((section) => (
            <div key={section.key}>
              <h4 className="text-[12px] font-semibold text-[#1d1d1f]">{section.title}</h4>
              {section.groups.map((g) => (
                <div key={g.key} className="mt-2">
                  <p className="text-[11px] font-semibold text-[#3c3c43]">{g.title}</p>
                  <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <table className="w-full min-w-[640px] table-fixed border-collapse text-[11px]">
                      <colgroup>
                        <col className="w-[30%]" />
                        <col className="w-[16%]" />
                        <col className="w-[10%]" />
                        <col className="w-[14%]" />
                        <col className="w-[30%]" />
                      </colgroup>
                      <tbody>
                        {g.rows.map((a) => (
                          <tr key={a.costAssumptionId} className="border-b border-[#f6f6f7] align-top">
                            <td className="py-1.5 pr-2 text-[#1d1d1f]">{a.label}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-[#1d1d1f]">
                              {assumptionValue(a)} <span className="text-[10px] text-[#6e6e73]">{a.unit ?? ""}</span>
                              <Changed on={assumptionChanged(a)} />
                            </td>
                            <td className="px-2 py-1.5"><ConfidenceTag value={a.confidence} /></td>
                            <td className="px-2 py-1.5 text-[#6e6e73]">{[a.sourceKind, a.owner].filter(Boolean).join("・")}</td>
                            <td className="py-1.5 pl-2 text-[10px] leading-4 text-[#6e6e73]">{a.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {unusedAssumptions.length > 0 && (
            <p className="text-[11px] text-[#6e6e73]">計算に使っていない前提: {unusedAssumptions.map((a) => a.label).join("、")}</p>
          )}
        </div>
      </Card>

      <Card title="作業リストの根拠と確認先" hint={`操作パネルの OPEX「人件費（作業）」と同じ行。作業単価はすべての作業で共通の ${int(rate)}円/時。年額は選んだ組み合わせ（${FUEL_CONVERSION_LABEL[current.conversion]}・収率${FUEL_YIELD_CASE_LABEL[current.yieldCase]}）の物量で出す。`}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[720px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-[#e5e5e7] text-left text-[10px] text-[#6e6e73]">
                <th className="py-1.5 pr-2 font-medium">段・作業</th>
                <th className="px-2 py-1.5 font-medium">どこで発生するか</th>
                <th className="px-2 py-1.5 text-right font-medium">年間回数</th>
                <th className="px-2 py-1.5 text-right font-medium">1回の工数</th>
                <th className="px-2 py-1.5 text-right font-medium">1回の経費</th>
                <th className="px-2 py-1.5 text-right font-medium">年額</th>
                <th className="px-2 py-1.5 font-medium">確度・確認先</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...tasks].sort((a, b) => a.sortOrder - b.sortOrder).map((t) => {
                const amt = fuelTaskAmount(t, assumptions, current.scale);
                const applies = fuelRowApplies(t, current.conversion);
                const base = savedTask(t.costTaskId);
                const changed = !!base && (base.hoursPerOccurrence !== t.hoursPerOccurrence || base.countPerYear !== t.countPerYear || base.expensePerOccurrence !== t.expensePerOccurrence);
                return (
                  <tr key={t.costTaskId} className={`border-b border-[#f6f6f7] align-top ${applies ? "" : "text-[#86868b]"}`}>
                    <td className="py-1.5 pr-2 text-[#1d1d1f]">
                      <span className="text-[10px] text-[#6e6e73]">{t.groupLabel}</span>
                      <br />
                      {t.label}
                      <Changed on={changed} />
                      {t.note && <span className="mt-0.5 block text-[10px] leading-4 text-[#6e6e73]">{t.note}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-[#6e6e73]">{FUEL_SCOPE_LABEL[t.scenario as FuelScope] ?? t.scenario}</td>
                    <td className="px-2 py-1.5 text-right">
                      {int(amt.occurrences)}
                      <span className="block text-[10px] text-[#6e6e73]">{FUEL_TASK_DRIVER_LABEL[t.countDriver as FuelTaskDriver] ?? t.countDriver}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right">{t.hoursPerOccurrence === null ? "未確認" : `${num(t.hoursPerOccurrence, 1)}時間`}</td>
                    <td className="px-2 py-1.5 text-right">{yen(t.expensePerOccurrence)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{applies ? yen(amt.annual) : "—"}</td>
                    <td className="px-2 py-1.5 text-[#6e6e73]">
                      <ConfidenceTag value={t.confidence} /> {[t.sourceKind, t.owner].filter(Boolean).join("・")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="費用明細" hint="明細の全件を、操作パネルと同じ CAPEX / OPEX の区分で並べる。培養設備の行は第1段の単位1kgあたりと、選んだ収率での燃料1Lあたり。選んだFAME転換で発生しない行は薄く出し、金額を空欄にする。">
        <div className="flex flex-col gap-3">
          {itemSections.map((section) => (
            <div key={section.key}>
              <p className="text-[11px] font-semibold text-[#3c3c43]">
                <span className="mr-1 rounded bg-[#f2f2f4] px-1 text-[9px] text-[#6e6e73]">{section.prefix}</span>
                {section.title}
              </p>
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[720px] table-fixed border-collapse text-[11px]">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[14%]" />
                    <col className="w-[16%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <tbody className="tabular-nums">
                    {section.rows.map((i) => {
                      const applies = fuelRowApplies(i, current.conversion);
                      const isCulture = i.scenario === "中央培養";
                      const perKg = isCulture ? fuelCultureItemPerKg(i, current.scale.cultureLineCapacityUnitYear, priceCtx, current.scale) : null;
                      const perLiter = !applies ? null : isCulture ? (perKg ?? 0) * current.yield.unitKgPerLiter : current.scale.annualLiters > 0 ? fuelItemAnnual(i, current.scale, priceCtx) / current.scale.annualLiters : 0;
                      const shownPrice = fuelEffectiveUnitPrice(i, priceCtx);
                      const base = savedItem(i.costItemId);
                      const changed = !!base && (base.quantity !== i.quantity || base.unitPrice !== i.unitPrice || base.usefulLifeYears !== i.usefulLifeYears);
                      return (
                        <tr key={i.costItemId} className={`border-b border-[#f6f6f7] align-top ${applies ? "" : "text-[#86868b]"}`}>
                          <td className="py-1.5 pr-2 text-[#1d1d1f]">
                            {fuelItemLabel(i)}
                            <Changed on={changed} />
                            <span className="block text-[10px] leading-4 text-[#6e6e73]">{FUEL_SCOPE_LABEL[i.scenario as FuelScope] ?? i.scenario}・{FUEL_BASIS_LABEL[i.basis] ?? i.basis}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {i.quantity.toLocaleString("ja-JP", { maximumFractionDigits: 6 })} <span className="text-[10px] text-[#6e6e73]">{i.quantityUnit}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {shownPrice.toLocaleString("ja-JP", { maximumFractionDigits: 2 })} <span className="text-[10px] text-[#6e6e73]">{i.unitPriceUnit}</span>
                            {i.priceRule === "co2_supply" && (
                              <span className="block text-[10px] text-[#6e6e73]">
                                排ガス利用可能 {flueGasOn(fuelAssumptionOf(assumptions, CO2_FLUE_GAS_ROLE)) ? `ON（買うなら ${i.unitPrice.toLocaleString("ja-JP")}）` : "OFF"}
                              </span>
                            )}
                            {i.priceRule === "culture_loss" && <span className="block text-[10px] text-[#6e6e73]">上の原料の合計</span>}
                            {i.usefulLifeYears ? <span className="block text-[10px] text-[#6e6e73]">{num(i.usefulLifeYears, 0)}年</span> : null}
                          </td>
                          <td className="px-2 py-1.5 text-right">{perKg === null ? "" : `${num(perKg, 2)}/kg`}</td>
                          <td className="px-2 py-1.5 text-right font-semibold">{perLiter === null ? "" : num(perLiter, 2)}</td>
                          <td className="px-2 py-1.5 text-[10px] leading-4 text-[#6e6e73]">
                            <ConfidenceTag value={i.confidence} /> {[i.sourceKind, i.owner].filter(Boolean).join("・")}
                            {i.note && <span className="mt-0.5 block">{i.note}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {notesOf("history").length > 0 && (
        <Card title="版の履歴と、この試算が答えていないこと" hint="この版で何を元にしたか、まだモデルに入っていない論点。">
          <NoteList notes={notesOf("history")} />
        </Card>
      )}
    </div>
  );
}

function MetricSection({ label, rows, scenarios }: { label: string; rows: MetricRow[]; scenarios: FuelScenarioResult[] }) {
  return (
    <>
      <tr className="border-b border-[#e5e5e7] bg-[#fafafa]">
        <td colSpan={scenarios.length + 1} className="py-1.5 pr-2 text-[11px] font-semibold text-[#3c3c43]">{label}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.label} className="border-b border-[#f0f0f2]">
          <td className={`whitespace-nowrap py-1.5 pr-2 ${r.muted ? "text-[#6e6e73]" : "text-[#3c3c43]"}`}>{r.label}</td>
          {scenarios.map((s) => (
            <td
              key={s.key}
              className={`whitespace-nowrap px-2 py-1.5 text-right ${r.strong ? "font-semibold" : ""} ${r.danger?.(s) ? "text-[#be123c]" : r.muted ? "text-[#6e6e73]" : "text-[#1d1d1f]"}`}
            >
              {r.get(s)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
