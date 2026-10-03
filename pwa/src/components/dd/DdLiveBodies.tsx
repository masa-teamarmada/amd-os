"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { TopicCard } from "@/components/cockpit/CockpitTechnology";
import { CockpitCostTab } from "@/components/cockpit/CockpitCostTab";
import { CockpitFuelCostModel } from "@/components/cockpit/CockpitFuelCostModel";
import { FinanceFormatView } from "@/components/cockpit/ProjectFinanceFormat";
import { financeDatasetFromFundingPlan } from "@/lib/project-finance-format";
import { CapitalPlanMatrix } from "@/components/cockpit/CapitalPlanMatrix";
import { recalculateCapTable, safeDeriveCapitalPlan } from "@/lib/capital-plan";
import { primeProjectCostModel, primeProjectFuelCostModel } from "@/lib/project-cost-model-client";
import type { DdLiveCapitalPolicy, DdLiveCostModel, DdLiveFundingPlan, DdLiveTechTopic } from "@/lib/dd-payload";

// DDの項目の中身を、ワークスペース（とコックピット）と同じ部品で描く（2026-09-30 まさ「どこから見ても同じ内容」）。
// データはサーバが「DDで公開中の範囲」だけを読んで渡す。部品は見るだけ（編集・保存・追加の操作を出さない）。

const noop = () => {};
const subscribeNothing = () => noop;

/** 技術台帳のページ1枚。ワークスペースの技術・競合比較・ビジネスモデルのタブと同じ TopicCard。 */
export function DdTechTopicLive({ data }: { data: DdLiveTechTopic }) {
  return <TopicCard topic={data.topic} entries={data.entries} canEdit={false} projectId={data.projectId} onChanged={noop} />;
}

/** 資金計画。ワークスペースの試算表タブと同じ標準フォーマット（FinanceFormatView）を、公開中の計画だけで見るだけで描く。 */
export function DdFundingPlanLive({ data }: { data: DdLiveFundingPlan }) {
  const datasets = useMemo(() => [financeDatasetFromFundingPlan(data.plan)], [data.plan]);
  return (
    <FinanceFormatView
      projectId=""
      datasets={datasets}
      timelineItems={[]}
      pilot={null}
      incorporationYm={null}
      fundingEvents={[]}
      grants={[]}
      plRows={[]}
      readOnly
    />
  );
}

/** 資本政策。ワークスペースの資本政策表タブと同じ表（CapitalPlanMatrix）を、同じ計算エンジンで見るだけで描く。 */
export function DdCapitalPolicyLive({ data }: { data: DdLiveCapitalPolicy }) {
  const derived = useMemo(() => safeDeriveCapitalPlan(data.plan), [data.plan]);
  const events = useMemo(() => [...derived.plan.events].sort((a, b) => a.order - b.order), [derived]);
  const snapshots = useMemo(() => recalculateCapTable(derived.plan), [derived]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => events[0]?.id ?? null);
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] leading-6 text-[#424245]">
        {data.plan.name}。
        {data.basis === "frozen"
          ? `凍結済みの提出版 v${data.frozenVersion}。`
          : `作業中の案（第${data.planRevision}版）の最新。資本政策表を直すと、ここも同じように変わる。`}
      </p>
      {derived.error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">{derived.error}</p>
      )}
      <CapitalPlanMatrix
        plan={derived.plan}
        events={events}
        snapshots={snapshots}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
        onUpdateEvent={noop}
        onEditHolderAmount={noop}
        onEditHolderEventShares={noop}
        onEditHolderPostRatio={noop}
        onChangeCalculationBasis={noop}
        onAddHolder={noop}
        onAddEvent={noop}
        onRenameHolder={noop}
        readOnly
      />
    </div>
  );
}

/**
 * 採算（コスト試算）。ワークスペースのコスト試算タブと同じ CockpitCostTab（データの形で標準フォーマットか廃液の画面を選ぶ） / CockpitFuelCostModel（allowEdit=false）。
 * 投資家はコスト試算の API を叩けないので、サーバが渡した試算を手元のキャッシュへ置いてから描く。
 * 置くのはブラウザに来てから（サーバの描画では骨組みだけを出し、描画のずれを起こさない）。
 */
export function DdCostModelLive({ data }: { data: DdLiveCostModel }) {
  // サーバの描画と、ブラウザで最初に合わせる描画（hydration）は false、その後だけ true になる。
  const inBrowser = useSyncExternalStore(subscribeNothing, () => true, () => false);
  // 手元のキャッシュへ置くのはブラウザに来てからだけ（サーバの処理の中の共有メモリへは置かない）。何度呼んでも同じ結果になる。
  useMemo(() => {
    if (!inBrowser) return;
    const value = { canEdit: false, bundle: data.bundle };
    if (data.costKind === "fuel") primeProjectFuelCostModel(data.projectId, value);
    else primeProjectCostModel(data.projectId, value);
  }, [inBrowser, data]);
  if (!inBrowser) {
    return <div className="min-h-60 animate-pulse rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] p-6 text-[13px] text-[#6e6e73]">コスト試算を読み込み中…</div>;
  }
  return data.costKind === "fuel"
    ? <CockpitFuelCostModel projectId={data.projectId} allowEdit={false} />
    : <CockpitCostTab projectId={data.projectId} allowEdit={false} includeFuel={false} />;
}
