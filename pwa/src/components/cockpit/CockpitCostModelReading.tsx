"use client";

import {
  APPLICATION_LABEL,
  COST_ROLE_KEYS,
  CONFIDENCE_LABEL,
  PRODUCTION_SITE_LABEL,
  SCENARIO_SCOPE_LABEL,
  STRAIN_LABEL,
  TASK_DRIVER_LABEL,
  annualAmount,
  centralItemPerKg,
  costItemLabel,
  rowAppliesTo,
  scopeApplies,
  taskAmount,
  type CostComputation,
  type CostModelBundle,
  type CostNote,
  type CostNoteSection,
  type CostScenarioResult,
  type CostScenarioScope,
  type CostSelection,
} from "@/lib/project-cost-model";
import { Card, ConfidenceTag, MiniMarkdown, ScopeTag, int, num, pct, signed } from "@/components/cockpit/CockpitCostModelParts";
import type { CostViewSelection } from "@/components/cockpit/CockpitCostModelResults";

// コスト試算タブの読み物。操作パネルと結果の下に置く (まさ 2026-09-13「注記・明細などの読み物はその下」)。
// 表の数字は試算中の変更を重ねた値で出し、保存値と違う欄には「試算中」の印を付ける。
// 前提と明細の表は既定で展開する (畳まない。まさ 2026-08-23)。

interface Props {
  saved: CostModelBundle;
  working: CostModelBundle;
  computed: CostComputation;
  selection: CostViewSelection;
  unit: string;
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
            <p className="mt-2 text-[10px] text-[#6e6e73]">
              出所:{" "}
              {n.sourceUrl ? (
                <a href={n.sourceUrl} target="_blank" rel="noreferrer" className="text-[#0267b2] underline underline-offset-2">
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

function Changed({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="ml-1 inline-flex items-center rounded bg-[#e8f3fc] px-1 text-[9px] font-semibold text-[#0267b2]" title="保存値から書き換えて試算している">
      試算中
    </span>
  );
}

function SectionRow({ label, span }: { label: string; span: number }) {
  return (
    <tr className="bg-[#f5f5f7]">
      <td colSpan={span} className="py-1.5 pr-2 text-[11px] font-semibold text-[#3c3c43]">{label}</td>
    </tr>
  );
}

function Row({
  label,
  scenarios,
  get,
  strong,
  muted,
  signedRow,
  digits = 1,
}: {
  label: string;
  scenarios: CostScenarioResult[];
  get: (s: CostScenarioResult) => [number | null, number | null];
  strong?: boolean;
  muted?: boolean;
  signedRow?: boolean;
  digits?: number;
}) {
  return (
    <tr className="border-b border-[#f0f0f2]">
      <td className={`py-2 pr-2 ${strong ? "font-semibold text-[#1d1d1f]" : muted ? "text-[#6e6e73]" : "text-[#3c3c43]"}`}>{label}</td>
      {scenarios.map((s) => {
        const [per, annual] = get(s);
        const negative = signedRow && (per ?? 0) < 0;
        return (
          <td
            key={s.key}
            className={`whitespace-nowrap px-2 py-2 text-right ${strong ? "font-semibold" : ""} ${negative ? "text-[#be123c]" : muted ? "text-[#6e6e73]" : "text-[#1d1d1f]"}`}
          >
            {per !== null && <span>{signedRow ? signed(per, digits) : num(per, digits)}</span>}
            {annual !== null && (
              <span className={per !== null ? "ml-1 text-[10px] text-[#6e6e73]" : ""}>{per !== null ? `(${int(annual)})` : int(annual)}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

export function CostReadingSections({ saved, working, computed, selection, unit }: Props) {
  const { model, assumptions, items, questions, notes } = working;
  const tasks = working.tasks ?? [];
  const notesOf = (section: CostNoteSection) =>
    (notes ?? []).filter((n) => n.section === section).sort((a, b) => a.sortOrder - b.sortOrder);
  const scenarios = computed.scenarios.filter((s) => s.application === selection.application);
  const strainLabel = computed.strain ? STRAIN_LABEL[computed.strain] : "";
  const appLabel = selection.application ? APPLICATION_LABEL[selection.application] : "";
  const sel: CostSelection = { strain: selection.strain, application: selection.application };
  const centralSel: CostSelection = { strain: selection.strain, application: null };
  const derived = computed.derivedByApplication.find((d) => d.application === selection.application)?.derived ?? computed.derived;
  const openQuestions = questions.filter((q) => q.status === "open");

  const uncertainAcrossMethods = (() => {
    const seen = new Map<string, CostScenarioResult["topUncertain"][number]>();
    for (const s of scenarios.filter((x) => x.tankMode === "既設" || x.location === "offsite")) {
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
    (a, b) => Math.max(...byAddressee[b].map((q) => q.impactHigh ?? 0), 0) - Math.max(...byAddressee[a].map((q) => q.impactHigh ?? 0), 0)
  );

  const savedAssumption = (id: string) => saved.assumptions.find((a) => a.costAssumptionId === id);
  const savedTask = (id: string) => (saved.tasks ?? []).find((t) => t.costTaskId === id);
  const savedItem = (id: string) => saved.items.find((i) => i.costItemId === id);
  const scenarioLabel = (s: CostScenarioScope) => SCENARIO_SCOPE_LABEL[s];

  return (
    <div className="flex flex-col gap-3">
      <Card id="cm-about" title="この試算について" hint={[model.caseLabel && `ケース: ${model.caseLabel}`, model.versionLabel].filter(Boolean).join(" ・ ")}>
        {model.summaryMd && <MiniMarkdown text={model.summaryMd} />}
        {(model.sourceNote || model.sourceUrl) && (
          <p className="mt-2 text-[11px] text-[#6e6e73]">
            {model.sourceNote}
            {model.sourceUrl && (
              <a href={model.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 font-medium text-[#0267b2] underline underline-offset-2">
                原典スプレッドシート
              </a>
            )}
          </p>
        )}
      </Card>

      {model.systemScopeMd && (
        <Card title="想定している系" hint="この試算がどんな構成・規模・収益モデルを前提にしているか。">
          <MiniMarkdown text={model.systemScopeMd} />
        </Card>
      )}

      {notesOf("caveat").length > 0 && (
        <Card title="注意して読むところ" hint="この数字を読むときに、先に知っておかないと誤解する前提。">
          <NoteList notes={notesOf("caveat")} />
        </Card>
      )}

      <Card
        title={`${scenarios.length}シナリオの内訳（${[strainLabel, appLabel].filter(Boolean).join("・") || "全体"}）`}
        hint={`CAPEXは償却後の年額換算。作業（人件費）は作業リストの年額で総コストに含む。単位は 円/${unit}（括弧内は 円/年）。`}
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[720px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[#e5e5e7] text-left text-[11px] text-[#6e6e73]">
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

              <SectionRow label="処理（顧客1社あたり。オンサイトは顧客工場、オフサイトはSX工場）" span={scenarios.length + 1} />
              <Row label="　消耗品・電力・放流など" scenarios={scenarios} get={(s) => [s.siteItemOpexPerUnit - s.postProcessPerUnit, s.siteItemOpexAnnual - s.postProcessPerUnit * derived.annualVolume]} />
              <Row label="　作業（運ぶ・運転・保守・管理）" scenarios={scenarios} get={(s) => [s.siteTaskPerUnit, s.siteTaskAnnual]} />
              <Row label="　うち運ぶ（巡回・輸送）" scenarios={scenarios} get={(s) => [s.transportPerUnit, null]} muted />
              <Row label="　作業工数（時間/年）" scenarios={scenarios} get={(s) => [null, s.siteTaskHours]} muted />
              <Row label="　使用済み菌体の後処理" scenarios={scenarios} get={(s) => [s.postProcessPerUnit, null]} />
              <Row label="　CAPEX 年額（槽含む）" scenarios={scenarios} get={(s) => [s.siteCapexPerUnit, s.siteCapexAnnual]} />
              <Row label="　小計" scenarios={scenarios} get={(s) => [s.siteTotalPerUnit, null]} strong />
              <Row label="　初期投資（総額・円）" scenarios={scenarios} get={(s) => [null, s.siteCapexTotal]} muted />

              <SectionRow label="事業全体" span={scenarios.length + 1} />
              <Row label="　うち閉鎖系の追加（強化株のみ）" scenarios={scenarios} get={(s) => [s.strainSpecificPerUnit, null]} muted />
              <Row label="　OPEX 合計" scenarios={scenarios} get={(s) => [s.opexTotalPerUnit, s.opexTotalAnnual]} />
              <Row label="　CAPEX 合計（年額）" scenarios={scenarios} get={(s) => [s.capexTotalPerUnit, s.capexTotalAnnual]} />
              <Row label="　総コスト" scenarios={scenarios} get={(s) => [s.totalPerUnit, s.totalAnnual]} strong />
              <Row label="　営業利益（償却後）" scenarios={scenarios} get={(s) => [s.profitPerUnit, s.profitAnnual]} signedRow />
              <tr className="border-b border-[#f0f0f2]">
                <td className="py-2 pr-2 text-[#3c3c43]">　利益率</td>
                {scenarios.map((s) => (
                  <td key={s.key} className={`whitespace-nowrap px-2 py-2 text-right font-semibold ${s.marginRate < 0 ? "text-[#be123c]" : "text-[#1d1d1f]"}`}>
                    {pct(s.marginRate)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[#6e6e73]">投資回収年数は、現場設備の保有主体（顧客購入か SX 保有か）が決まっていないため保留。</p>
      </Card>

      <Card
        title={appLabel ? `この数字の確からしさ（${appLabel}）` : "この数字の確からしさ"}
        hint="総コストのうち、どの確度の行がいくらを占めているか。仮説(H)と仮置き(C)の比率が高いほど、確定作業で数字は動く。菌体費は第1段の行ごとに配って数えている。"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {scenarios.map((s) => (
            <div key={s.key} className="rounded-lg border border-[#e5e5e7] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12px] font-semibold text-[#1d1d1f]">{s.label}</p>
                <p className="text-[11px] text-[#6e6e73]">
                  仮説+仮置き{" "}
                  <span className="font-semibold text-[#be123c]">
                    {pct(s.confidenceBreakdown.filter((c) => c.grade === "H" || c.grade === "C").reduce((t, c) => t + c.share, 0))}
                  </span>
                </p>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#f2f2f4]">
                {s.confidenceBreakdown.map((c) => (
                  <div
                    key={c.grade}
                    style={{ width: `${Math.max(c.share * 100, 0)}%` }}
                    className={
                      c.grade === "H" ? "bg-[#fb7185]"
                      : c.grade === "C" ? "bg-[#fbbf24]"
                      : c.grade === "B" || c.grade === "A" ? "bg-[#7cbceb]"
                      : c.grade === "S" ? "bg-[#34d399]"
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
                    <span className="flex-1 tabular-nums text-[#3c3c43]">{num(c.perUnit)} 円/{unit}</span>
                    <span className="tabular-nums text-[#6e6e73]">{pct(c.share)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <h4 className="mt-4 text-[12px] font-semibold text-[#1d1d1f]">精度を下げている項目（金額順）</h4>
        <p className="mt-1 text-[11px] text-[#6e6e73]">確度が仮説(H)・仮置き(C)のまま金額が大きい行。ここを潰すと数字が締まる。</p>
        <div className="mt-2 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-[#e5e5e7] text-left text-[10px] text-[#6e6e73]">
                <th className="py-1.5 pr-2 font-medium">項目</th>
                <th className="px-2 py-1.5 font-medium">どこで発生するか</th>
                <th className="px-2 py-1.5 text-right font-medium">円/{unit}</th>
                <th className="px-2 py-1.5 font-medium">確度</th>
                <th className="px-2 py-1.5 font-medium">出所</th>
                <th className="py-1.5 pl-2 font-medium">確認先</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {uncertainAcrossMethods.map((u) => (
                <tr key={u.costItemId} className="border-b border-[#f6f6f7]">
                  <td className="py-1.5 pr-2 text-[#1d1d1f]">{u.label}</td>
                  <td className="px-2 py-1.5 text-[#6e6e73]">{scenarioLabel(u.scenario as CostScenarioScope) ?? u.scenario}</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-[#1d1d1f]">{num(u.perUnit)}</td>
                  <td className="px-2 py-1.5"><ConfidenceTag value={u.confidence} /></td>
                  <td className="px-2 py-1.5 text-[#6e6e73]">{u.sourceKind}</td>
                  <td className="py-1.5 pl-2 text-[#6e6e73]">{u.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={`確認事項（未確定 ${openQuestions.length}件）`}
        hint="研究者に円は聞かない。先生方へは量・回数・条件だけを聞き、円への変換はAMD側でやる。並びは「確定したときに総コストが動く幅」の大きい順。"
      >
        <div className="flex flex-col gap-3">
          {addresseeOrder.map((addressee) => (
            <div key={addressee} className="rounded-lg border border-[#e5e5e7]">
              <div className="flex items-center gap-2 border-b border-[#e5e5e7] bg-[#fafafa] px-3 py-2">
                <span className="text-[12px] font-semibold text-[#1d1d1f]">{addressee}</span>
                <span className="text-[11px] text-[#6e6e73]">{byAddressee[addressee].length}件</span>
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
                      {q.whyItMatters && <p className="mt-1.5 text-[11px] leading-5 text-[#6e6e73]">{q.whyItMatters}</p>}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {notesOf("benchmark").length > 0 && (
        <Card title="外部ベンチマークと出典" hint="モデルに置いた値を、外の相場や一次情報と突き合わせるための材料。">
          <NoteList notes={notesOf("benchmark")} />
        </Card>
      )}

      {notesOf("reading_guide").length > 0 && (
        <Card id="cm-guide" title="この画面の見方" hint="各行が何を見るためのものか。投資回収を保留にしている理由もここ。">
          <NoteList notes={notesOf("reading_guide")} />
        </Card>
      )}

      <Card title="すべての前提" hint="計算に入っている変数の全件。確度と確認先つき。株・用途の印がある行は、その株・用途のときだけ効く。選んだ株・用途で効かない行は薄く出す。">
        <div className="flex flex-col gap-3">
          {[...new Set([...assumptions].sort((a, b) => a.sortOrder - b.sortOrder).map((a) => a.groupLabel))].map((g) => (
            <div key={g}>
              <h4 className="text-[12px] font-semibold text-[#1d1d1f]">{g}</h4>
              <div className="mt-1.5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[600px] border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-[#e5e5e7] text-left text-[10px] text-[#6e6e73]">
                      <th className="py-1.5 pr-2 font-medium">変数</th>
                      <th className="px-2 py-1.5 text-right font-medium">値</th>
                      <th className="px-2 py-1.5 font-medium">単位</th>
                      <th className="px-2 py-1.5 font-medium">確度</th>
                      <th className="px-2 py-1.5 font-medium">出所</th>
                      <th className="py-1.5 pl-2 font-medium">確認先</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {assumptions
                      .filter((a) => a.groupLabel === g)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((a) => {
                        const applies = scopeApplies(a, sel);
                        const base = savedAssumption(a.costAssumptionId);
                        return (
                          <tr key={a.costAssumptionId} className={`border-b border-[#f6f6f7] align-top ${applies ? "" : "opacity-50"}`}>
                            <td className="py-1.5 pr-2 text-[#1d1d1f]">
                              {a.label}
                              <ScopeTag strain={a.strain} application={a.application} />
                              {a.roleKey && !COST_ROLE_KEYS.has(a.roleKey) && <span className="ml-1 text-[10px] text-[#6e6e73]">（計算に使っていない）</span>}
                              {a.note && <p className="mt-0.5 text-[10px] leading-4 text-[#6e6e73]">{a.note}</p>}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-[#1d1d1f]">
                              {a.value !== null ? a.value.toLocaleString("ja-JP") : a.valueText ?? "空欄"}
                              <Changed on={!!base && base.value !== a.value} />
                            </td>
                            <td className="px-2 py-1.5 text-[#6e6e73]">{a.unit}</td>
                            <td className="px-2 py-1.5"><ConfidenceTag value={a.confidence} /></td>
                            <td className="px-2 py-1.5 text-[#6e6e73]">{a.sourceKind}</td>
                            <td className="py-1.5 pl-2 text-[#6e6e73]">{a.owner}</td>
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

      {tasks.length > 0 && (
        <Card title="作業リストの根拠と確認先" hint={`操作パネルの作業リストと同じ行。年額は選んだシナリオの物量（年間バッチ数 ${num(derived.annualBatches, 0)}・訪問回数 ${num(derived.visitsPerYear, 1)}・輸送 ${int(derived.truckTripsPerYear)}）で出す。`}>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[760px] border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-[#e5e5e7] text-left text-[10px] text-[#6e6e73]">
                  <th className="py-1.5 pr-2 font-medium">作業</th>
                  <th className="px-2 py-1.5 font-medium">どこで発生するか</th>
                  <th className="px-2 py-1.5 text-right font-medium">1回の工数</th>
                  <th className="px-2 py-1.5 font-medium">年間回数</th>
                  <th className="px-2 py-1.5 text-right font-medium">作業単価</th>
                  <th className="px-2 py-1.5 text-right font-medium">1回の経費</th>
                  <th className="px-2 py-1.5 text-right font-medium">年額(円)</th>
                  <th className="py-1.5 pl-2 font-medium">確度・出所</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...tasks].sort((a, b) => a.sortOrder - b.sortOrder).map((t) => {
                  const base = savedTask(t.costTaskId);
                  const isCentral = t.scenario === "中央培養";
                  const amt = taskAmount(t, assumptions, derived, isCentral ? centralSel : sel);
                  const applies = rowAppliesTo(t, selection.method, sel);
                  const changed = !!base && (base.hoursPerOccurrence !== t.hoursPerOccurrence || base.countDriver !== t.countDriver || base.countPerYear !== t.countPerYear || base.hourlyRate !== t.hourlyRate || base.expensePerOccurrence !== t.expensePerOccurrence);
                  return (
                    <tr key={t.costTaskId} className={`border-b border-[#f6f6f7] align-top ${applies ? "" : "opacity-50"}`}>
                      <td className="py-1.5 pr-2 text-[#1d1d1f]">
                        {t.label}
                        <ScopeTag strain={t.strain} application={t.application} />
                        <Changed on={changed} />
                        {t.note && <p className="mt-0.5 max-w-[420px] text-[10px] leading-4 text-[#6e6e73]">{t.note}</p>}
                      </td>
                      <td className="px-2 py-1.5 text-[#6e6e73]">{scenarioLabel(t.scenario)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-[#1d1d1f]">{t.hoursPerOccurrence === null ? "未確認" : `${num(t.hoursPerOccurrence, t.hoursPerOccurrence % 1 === 0 ? 0 : 2)}時間`}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-[#1d1d1f]">
                        {isCentral || t.countDriver === "fixed" ? `${num(t.countPerYear ?? 0, 0)}回` : `${TASK_DRIVER_LABEL[t.countDriver]}（${num(amt.occurrences, amt.occurrences < 10 ? 2 : 0)}回）`}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-[#1d1d1f]">{t.hourlyRate === null ? `共通 ${int(amt.rate)}円` : `${int(t.hourlyRate)}円`}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-[#1d1d1f]">{int(t.expensePerOccurrence)}円</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-[#1d1d1f]">{int(amt.annual)}</td>
                      <td className="py-1.5 pl-2">
                        <div className="flex items-center gap-1.5">
                          <ConfidenceTag value={t.confidence} />
                          <span className="whitespace-nowrap text-[10px] text-[#6e6e73]">{t.sourceKind}</span>
                        </div>
                        {t.owner && <p className="mt-0.5 text-[10px] text-[#6e6e73]">確認先 {t.owner}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card
        title="費用明細"
        hint={`計算に入っている全 ${items.filter((i) => !i.isBreakdown).length} 行。内訳行は親の小計に含まれるため金額を持たない。選んだ株・用途・方式で発生しない行は薄く出し、金額を空欄にする。`}
      >
        <div className="flex flex-col gap-4">
          {(["中央培養", "共通", "現場共通", "循環", "投入", "オフサイト"] as const).map((g) => {
            const rows = items.filter((i) => !i.isBreakdown && i.scenario === g);
            if (rows.length === 0) return null;
            const isCentral = g === "中央培養";
            return (
              <div key={g}>
                <h4 className="text-[12px] font-semibold text-[#1d1d1f]">
                  {scenarioLabel(g)}
                  <span className="ml-2 text-[10px] font-normal text-[#6e6e73]">
                    CAPEX {rows.filter((r) => r.costType === "CAPEX").length}行 / OPEX {rows.filter((r) => r.costType === "OPEX").length}行
                  </span>
                </h4>
                {isCentral && (
                  <p className="mt-0.5 text-[10px] text-[#6e6e73]">{PRODUCTION_SITE_LABEL}の行は、菌体1kgあたりの原価へ畳んで第2段に配る。右端は生産1kgあたりの円（販売率で割る前）。</p>
                )}
                <div className="mt-1.5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[760px] border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-[#e5e5e7] text-left text-[10px] text-[#6e6e73]">
                        <th className="py-1.5 pr-2 font-medium">項目</th>
                        <th className="px-2 py-1.5 font-medium">区分</th>
                        <th className="px-2 py-1.5 font-medium">発生ロジック</th>
                        <th className="px-2 py-1.5 text-right font-medium">単価</th>
                        <th className="px-2 py-1.5 text-right font-medium">耐用</th>
                        <th className="px-2 py-1.5 text-right font-medium">年額(円)</th>
                        <th className="px-2 py-1.5 text-right font-medium">{isCentral ? "円/kg" : `円/${unit}`}</th>
                        <th className="py-1.5 pl-2 font-medium">確度・出所</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {rows.map((i) => {
                        const rowSel = isCentral ? centralSel : sel;
                        const applies = rowAppliesTo(i, selection.method, sel);
                        const annual = applies ? annualAmount(i, assumptions, derived, rowSel) : null;
                        const right = !applies ? null : isCentral ? centralItemPerKg(i, assumptions, computed.biomass.capacityKgYear, rowSel) : (annual ?? 0) / (derived.annualVolume || 1);
                        const base = savedItem(i.costItemId);
                        const changed = !!base && (base.unitPrice !== i.unitPrice || base.quantity !== i.quantity || base.usefulLifeYears !== i.usefulLifeYears);
                        return (
                          <tr key={i.costItemId} className={`border-b border-[#f6f6f7] align-top ${applies ? "" : "opacity-50"}`}>
                            <td className="py-1.5 pr-2 text-[#1d1d1f]">
                              {costItemLabel(i)}
                              {i.groupLabel && <span className="ml-1 text-[10px] text-[#6e6e73]">（{i.groupLabel}）</span>}
                              <ScopeTag strain={i.strain} application={i.application} />
                              <Changed on={changed} />
                              {i.note && <p className="mt-0.5 max-w-[420px] text-[10px] leading-4 text-[#6e6e73]">{i.note}</p>}
                            </td>
                            <td className="px-2 py-1.5 text-[#6e6e73]">{i.costType}</td>
                            <td className="px-2 py-1.5 text-[#6e6e73]">
                              {i.basis}
                              {i.priceRule && <span className="ml-1 rounded bg-[#e8f3fc] px-1 py-[1px] text-[9px] font-medium text-[#0267b2]">前提から計算</span>}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right text-[#3c3c43]">{i.priceRule ? "—" : i.unitPrice.toLocaleString("ja-JP")}</td>
                            <td className="px-2 py-1.5 text-right text-[#6e6e73]">{i.usefulLifeYears ? `${i.usefulLifeYears}年` : "—"}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right text-[#1d1d1f]">{annual === null ? "—" : int(annual)}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-[#1d1d1f]">{right === null ? "—" : num(right, 2)}</td>
                            <td className="py-1.5 pl-2">
                              <div className="flex items-center gap-1.5">
                                <ConfidenceTag value={i.confidence} />
                                <span className="whitespace-nowrap text-[10px] text-[#6e6e73]">{i.sourceKind}</span>
                              </div>
                              {i.owner && <p className="mt-0.5 text-[10px] text-[#6e6e73]">確認先 {i.owner}</p>}
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
      </Card>

      {notesOf("history").length > 0 && (
        <Card title="版の履歴と、この試算が答えていないこと" hint="前版との落差と、まだモデルに入っていない論点。">
          <NoteList notes={notesOf("history")} />
        </Card>
      )}
    </div>
  );
}
