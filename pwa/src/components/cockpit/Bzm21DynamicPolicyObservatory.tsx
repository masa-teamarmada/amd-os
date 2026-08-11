"use client";

import { Tex } from "@/components/venture-map/Tex";
import {
  BZM21_OBJECTIVE_KINDS,
  type Bzm21ObjectiveKind,
  type Bzm21PolicyEvaluation,
  type Bzm21PolicyKind,
  type Bzm21PolicyModelLedger,
} from "@/lib/bzm-2-1-policy-model";

const OBJECTIVE_LABEL: Record<Bzm21ObjectiveKind, string> = {
  company: "会社PJ価値",
  bzsf: "BZSF投資価値",
  public: "基金財政・社会価値",
};

const POLICY_LABEL: Record<Bzm21PolicyKind, string> = {
  fixed_baseline: "固定方針",
  optimized: "選択方針",
};

function formatValue(value: number | null | undefined, suffix = "百万円") {
  if (value === null || value === undefined) return "未計算";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value)} ${suffix}`;
}

function formatProbability(value: number | null | undefined) {
  if (value === null || value === undefined) return "未計算";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function evaluationFor(
  model: Bzm21PolicyModelLedger,
  objectiveKind: Bzm21ObjectiveKind,
  policyKind: Bzm21PolicyKind,
) {
  return model.policyViews.find(
    (view) => view.objectiveKind === objectiveKind && view.policyKind === policyKind,
  )?.current ?? null;
}

function DerivedMetrics({ evaluation }: { evaluation: Bzm21PolicyEvaluation | null }) {
  const rows = [
    ["到達時条件付き正味値", evaluation?.conditionalGoalValue],
    ["累積必要資金", evaluation?.expectedCumulativeFundingMillionJpy],
    ["失敗経路損失", evaluation?.expectedFailureLossMillionJpy],
    ["撤退・転用価値", evaluation?.expectedExitValueMillionJpy],
    ["終端価値", evaluation?.expectedTerminalValueMillionJpy],
    ["費用", evaluation?.expectedCostMillionJpy],
    ["便益", evaluation?.expectedBenefitMillionJpy],
  ] as const;

  return (
    <details className="mt-1 border-t border-[#e0e7ea] pt-1 text-[10px] text-[#5f6f76]">
      <summary className="cursor-pointer font-semibold text-[#41555e]">派生値を開く</summary>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <span>{label}</span>
            <span className="text-right tabular-nums">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

export function Bzm21DynamicPolicyObservatory({
  model,
}: {
  model: Bzm21PolicyModelLedger;
}) {
  const revision = model.currentRevision;
  const rows = BZM21_OBJECTIVE_KINDS.flatMap((objectiveKind) =>
    (["fixed_baseline", "optimized"] as const).map((policyKind) => ({
      objectiveKind,
      policyKind,
      evaluation: evaluationFor(model, objectiveKind, policyKind),
    })),
  );
  const companySelected = evaluationFor(model, "company", "optimized");

  return (
    <section
      aria-labelledby="bzm21-observatory-title"
      className="overflow-hidden rounded-xl border border-[#b9cbd3] bg-[#f7fafb]"
    >
      <header className="grid gap-2 border-b border-[#cbd8dd] bg-[#edf4f6] px-3 py-2 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 id="bzm21-observatory-title" className="text-[13px] font-semibold text-[#234c5f]">
            SPS 2.1 動的方針評価
          </h2>
          <p className="text-[10px] leading-4 text-[#607078]">
            一つの選択方針を三視点で再評価。生データと推定値を分離し、前向き検証前として表示する。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[#ccd8dc] bg-[#ccd8dc] text-center text-[10px]">
          <div className="bg-white px-2 py-1"><span className="block text-[#718087]">主値</span><b className="tabular-nums text-[#244d5e]">{formatValue(companySelected?.expectedNetValue)}</b></div>
          <div className="bg-white px-2 py-1"><span className="block text-[#718087]">到達見込み</span><b className="tabular-nums text-[#244d5e]">{formatProbability(companySelected?.goalProbability)}</b></div>
          <div className="bg-white px-2 py-1"><span className="block text-[#718087]">版</span><b className="text-[#244d5e]">{revision?.revisionKey ?? "未登録"}</b></div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[10px] leading-4">
          <thead className="bg-[#f2f6f7] text-left text-[#50636c]">
            <tr>
              <th className="px-2 py-1.5">視点</th>
              <th className="px-2 py-1.5">方針</th>
              <th className="px-2 py-1.5">状態</th>
              <th className="px-2 py-1.5 text-right">到達見込み</th>
              <th className="px-2 py-1.5 text-right">期待正味値</th>
              <th className="px-2 py-1.5 text-right">基準線との差</th>
              <th className="px-2 py-1.5 text-right">柔軟性価値</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ objectiveKind, policyKind, evaluation }) => (
              <tr key={`${objectiveKind}-${policyKind}`} className="border-t border-[#dce5e8] align-top even:bg-white/60">
                <td className="px-2 py-1.5 font-semibold text-[#334d59]">{OBJECTIVE_LABEL[objectiveKind]}</td>
                <td className="px-2 py-1.5 text-[#51636b]">{POLICY_LABEL[policyKind]}</td>
                <td className="px-2 py-1.5 text-[#6a777d]">{evaluation?.evaluationStatus ?? "未登録"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatProbability(evaluation?.goalProbability)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatValue(evaluation?.expectedNetValue)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatValue(evaluation?.valueDifferenceFromBaseline)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatValue(evaluation?.controllerOptionValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 border-t border-[#cbd8dd] bg-white/70 px-3 py-2 md:grid-cols-2">
        <div className="text-[10px] leading-4 text-[#607078]">
          <div className="font-semibold text-[#415b67]">現在の計算契約</div>
          <div>保存状態: {model.storageState} ／ 測定状態: {revision?.measurementStatus ?? "未登録"}</div>
          <div className="mt-1"><Tex tex={String.raw`E[V_r^{\mathrm{net},\pi}\mid G]`} /> は到達時条件付き正味値。</div>
        </div>
        <DerivedMetrics evaluation={companySelected} />
      </div>
    </section>
  );
}
