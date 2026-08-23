"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CONFIDENCE_LABEL,
  annualAmount as annualAmountImpl,
  computeCostModel,
  costItemLabel,
  type CostAssumption,
  type CostItem,
  type CostModelBundle,
  type CostScenarioResult,
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
// 正本は project_cost_* (migration 320/324)。前提を1つ動かすと4シナリオが再計算される。
// 計算結果は保存しない。保存するのは前提と明細だけで、数字は常に導出する。

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
    <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-[1px] text-[10px] font-semibold ${cls}`}>
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
  const [started, setStarted] = useState(false);
  if (!started) {
    setStarted(true);
    void load();
  }

  const computed = useMemo(
    () => (bundle ? computeCostModel({ ...bundle, model: bundle.model }) : null),
    [bundle]
  );

  async function patchAssumption(id: string, value: number) {
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

  const { model, assumptions, items, questions } = bundle;
  const { derived, scenarios } = computed;
  const unit = model.unitBasisLabel || "m³";
  const keyAssumptions = assumptions.filter((a) => a.isKey && a.value !== null);
  const openQuestions = questions.filter((q) => q.status === "open");

  // 中央培養コストが菌体1kgあたりいくらに相当するか。文献値と突き合わせる共通単位。
  const biomassKgPerUnit = derived.biomassWithLossPerM3 / derived.reuseCount / 1000;
  const impliedBiomassCost =
    biomassKgPerUnit > 0 ? scenarios[0].centralTotalPerUnit / biomassKgPerUnit : 0;

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
      {/* 1. 何の試算か */}
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

      {/* 2. どういう系を想定しているか */}
      {model.systemScopeMd && (
        <Card title="想定している系" hint="この試算がどんな構成・規模・収益モデルを前提にしているか。">
          <MiniMarkdown text={model.systemScopeMd} />
        </Card>
      )}

      {/* 3. 成立ライン。表より先に「いくらならOKか」を出す。 */}
      <Card
        title="成立ライン"
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
            label="必要菌体量あたり原価の含意"
            value={`${num(impliedBiomassCost, 0)} 円/kg-DCW`}
            note="中央培養コスト ÷ 年間菌体量。閉鎖系スピルリナの商用実績は約390〜770円/kg。"
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

      {/* 4. CAPEX / OPEX を分けた損益。円/単位と円/年を併記する。 */}
      <Card
        title="事業成立サマリー"
        hint={`CAPEXは償却後の年額換算。人件費は無人運転前提で総コストへ算入せず、最下段に参考値として置く。単位は 円/${unit}（括弧内は 円/年）。`}
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

              <SectionRow label="中央培養拠点（全顧客共通・供給拠点数で配賦）" span={scenarios.length + 1} />
              <Row label="　OPEX" scenarios={scenarios} get={(s) => [s.centralOpexPerUnit, s.centralOpexAnnual]} />
              <Row label="　CAPEX 年額" scenarios={scenarios} get={(s) => [s.centralCapexPerUnit, s.centralCapexAnnual]} />
              <Row label="　小計" scenarios={scenarios} get={(s) => [s.centralTotalPerUnit, null]} sub />

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

              <SectionRow label="参考：人件費（総コストに不算入）" span={scenarios.length + 1} />
              <Row label="　人件費" scenarios={scenarios} get={(s) => [s.referenceLaborPerUnit, null]} muted />
              <Row label="　人件費を戻した利益" scenarios={scenarios} get={(s) => [s.profitWithLaborPerUnit, null]} signedRow />
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[#86868b]">
          投資回収年数は、現場設備の保有主体（顧客購入か SX 保有か）が決まっていないため保留。
        </p>
      </Card>

      {/* 5. この数字の確からしさ */}
      <Card
        title="この数字の確からしさ"
        hint="総コストのうち、どの確度の行がいくらを占めているか。仮説(H)と仮置き(C)の比率が高いほど、確定作業で数字は動く。"
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
              {scenarios[0].topUncertain.concat(
                scenarios[2].topUncertain.filter(
                  (u) => !scenarios[0].topUncertain.some((x) => x.costItemId === u.costItemId)
                )
              )
                .sort((a, b) => b.perUnit - a.perUnit)
                .slice(0, 10)
                .map((u) => (
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

      {/* 6. 主要前提 */}
      <Card
        title="主要前提（動かすと上の表が変わる）"
        hint={canEdit ? "値を書き換えると4シナリオが再計算される。計算結果は保存せず、前提だけを保存する。" : "値の編集はコックピット側のadminのみ。"}
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
          <h4 className="text-[12px] font-semibold text-[#1d1d1f]">前提から導かれる物量</h4>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4">
            {[
              ["必要菌体量", `${num(derived.biomassWithLossPerM3, 0)} g-DCW/${unit}`],
              ["必要培養液量", `${num(derived.requiredBrothPerM3, 0)} L/${unit}`],
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

      {/* 7. すべての前提 (既定で開く) */}
      <Card title="すべての前提" hint="計算に入っている変数の全件。確度と確認先つき。">
        <AssumptionTable assumptions={assumptions} />
      </Card>

      {/* 8. 確認事項 */}
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

      {/* 9. 費用明細 (既定で開く) */}
      <Card title="費用明細" hint={`計算に入っている全 ${items.filter((i) => !i.isBreakdown).length} 行。内訳行は親の小計に含まれるため金額を持たない。`}>
        <ItemTable items={items} assumptions={assumptions} unit={unit} />
      </Card>
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
}: {
  label: string;
  scenarios: CostScenarioResult[];
  get: (s: CostScenarioResult) => [number | null, number | null];
  strong?: boolean;
  sub?: boolean;
  muted?: boolean;
  signedRow?: boolean;
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
            {per !== null && <span>{signedRow ? signed(per) : num(per)}</span>}
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

/** 見出し・箇条書き・**強調** だけの軽量レンダラ。系の説明にライブラリを足さない。 */
function MiniMarkdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-[#1d1d1f]">{part.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={bi} className="ml-4 list-disc space-y-1">
              {lines.map((l, li) => (
                <li key={li} className="text-[12px] leading-6 text-[#4b4b52]">{inline(l.replace(/^\s*-\s/, ""))}</li>
              ))}
            </ul>
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
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(assumption.value ?? ""));
  // 楽観更新やDB再読込で prop が変わったら入力欄を追従させる (レンダー中の調整)。
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

function AssumptionTable({ assumptions }: { assumptions: CostAssumption[] }) {
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
                  .map((a) => (
                    <tr key={a.costAssumptionId} className="border-b border-[#f6f6f7] align-top">
                      <td className="py-1.5 pr-2 text-[#1d1d1f]">
                        {a.label}
                        {a.note && <p className="mt-0.5 text-[10px] leading-4 text-[#86868b]">{a.note}</p>}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-[#1d1d1f]">
                        {a.value !== null ? a.value.toLocaleString("ja-JP") : a.valueText}
                      </td>
                      <td className="px-2 py-1.5 text-[#86868b]">{a.unit}</td>
                      <td className="px-2 py-1.5"><ConfidenceTag value={a.confidence} /></td>
                      <td className="px-2 py-1.5 text-[#86868b]">{a.sourceKind}</td>
                      <td className="py-1.5 pl-2 text-[#86868b]">{a.owner}</td>
                    </tr>
                  ))}
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
}: {
  items: CostItem[];
  assumptions: CostAssumption[];
  unit: string;
}) {
  const { derived } = useMemo(() => computeCostModel({ assumptions, items }), [assumptions, items]);
  const visible = items.filter((i) => !i.isBreakdown);
  const groups = ["中央培養", "共通", "循環", "投入"] as const;

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => {
        const rows = visible.filter((i) => i.scenario === g);
        if (rows.length === 0) return null;
        const capex = rows.filter((r) => r.costType === "CAPEX");
        const opex = rows.filter((r) => r.costType === "OPEX");
        return (
          <div key={g}>
            <h4 className="text-[12px] font-semibold text-[#1d1d1f]">
              {g}
              <span className="ml-2 text-[10px] font-normal text-[#86868b]">
                CAPEX {capex.length}行 / OPEX {opex.length}行
              </span>
            </h4>
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
                    <th className="px-2 py-1.5 text-right font-medium">円/{unit}</th>
                    <th className="pl-2 py-1.5 font-medium">確度・出所</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((i) => {
                    const annual = annualAmountOf(i, assumptions, derived);
                    return (
                      <tr key={i.costItemId} className="border-b border-[#f6f6f7] align-top">
                        <td className="py-1.5 pr-2 text-[#1d1d1f]">
                          {costItemLabel(i)}
                          {i.groupLabel && (
                            <span className="ml-1 text-[10px] text-[#86868b]">（{i.groupLabel}）</span>
                          )}
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
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-[#1d1d1f]">{int(annual)}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-[#1d1d1f]">
                          {num(annual / (derived.annualVolume || 1), 2)}
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

// ItemTable から使う。lib 側の annualAmount と同じ計算を呼ぶだけの薄い包み。
function annualAmountOf(
  item: CostItem,
  assumptions: CostAssumption[],
  derived: ReturnType<typeof computeCostModel>["derived"]
): number {
  return annualAmountImpl(item, assumptions, derived);
}
