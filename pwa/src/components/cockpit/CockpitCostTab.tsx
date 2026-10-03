"use client";

import { useEffect, useState } from "react";
import { CockpitCostModel } from "@/components/cockpit/CockpitCostModel";
import { CockpitFuelCostModel } from "@/components/cockpit/CockpitFuelCostModel";
import { ProjectCostFormat } from "@/components/cockpit/ProjectCostFormat";
import { costFormatEngineOf } from "@/lib/project-cost-format";
import {
  loadProjectCostModel,
  loadProjectFuelCostModel,
  peekProjectCostModel,
  peekProjectFuelCostModel,
  type CostModelResponse,
} from "@/lib/project-cost-model-client";

// コスト試算タブの入口（コックピット・PJワークスペース・DDパッケージで共通）。
// データの形（project_cost_models.case_kind と明細・作業の有無）だけで画面を選ぶ。PJ番号では分けない（spec 3-23 §7）。
//   廃液処理の試算（case_kind = multi など）… これまでの廃液の画面（CockpitCostModel）。標準フォーマットへの移行は次の段
//   明細も作業も無い古い部分試算 … これまでの画面（標準フォーマットへ移すまでの間）
//   それ以外（汎用の計算で出せる試算・未登録）… 標準フォーマット（ProjectCostFormat）
// どちらの画面も同じ読み込み層（project-cost-model-client）を通すので、ここでの読み込みは画面側でキャッシュから即座に描かれる。
//
// 燃料の試算（case_kind = biodiesel）も、試算ごとにタブを足さず、このタブの中の切り替えで読む
// （2026-10-03 まさ「全部統一してないとだめ。OSの大原則。中身があるときだけ出るタブってなに？」）。
// 切り替えは、そのPJに試算が2つ以上あるときだけ出る（タブの中の中身。タブそのものは全PJ常設）。

interface Props {
  projectId: string;
  allowEdit?: boolean;
  /** 旧アドレス「コスト試算（燃料）」から開いたとき、燃料の試算を先に選ぶ。 */
  initialRenderer?: "fuel";
  /** 燃料の試算も読むか。DDパッケージは燃料の試算を別の区画で出すので読まない。 */
  includeFuel?: boolean;
}

type Choice = "main" | "fuel";

export function CockpitCostTab({ projectId, allowEdit = true, initialRenderer, includeFuel = true }: Props) {
  const [res, setRes] = useState<CostModelResponse | null>(() => peekProjectCostModel(projectId) ?? null);
  const [failed, setFailed] = useState(false);
  const [fuel, setFuel] = useState<CostModelResponse | null | undefined>(() => (includeFuel ? peekProjectFuelCostModel(projectId) : null));
  const [choice, setChoice] = useState<Choice>(initialRenderer === "fuel" ? "fuel" : "main");
  useEffect(() => {
    let cancelled = false;
    loadProjectCostModel(projectId)
      .then((r) => {
        if (!cancelled) setRes(r);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    if (includeFuel) {
      loadProjectFuelCostModel(projectId)
        .then((r) => {
          if (!cancelled) setFuel(r);
        })
        .catch(() => {
          if (!cancelled) setFuel(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [projectId, includeFuel]);

  if ((!res && !failed) || fuel === undefined) {
    return <div className="h-[520px] animate-pulse rounded-xl border border-[#e5e5e7] bg-[#fafafa]" data-testid="cost-tab-loading" />;
  }
  const bundle = res?.bundle ?? null;
  const fuelBundle = fuel?.bundle ?? null;
  const options: Array<{ key: Choice; label: string }> = [];
  if (bundle) options.push({ key: "main", label: bundle.model.caseLabel || bundle.model.title });
  if (fuelBundle) options.push({ key: "fuel", label: fuelBundle.model.caseLabel || fuelBundle.model.title });
  const active: Choice = options.some((option) => option.key === choice) ? choice : options[0]?.key ?? "main";

  const engine = costFormatEngineOf(bundle);
  const body = active === "fuel"
    ? <CockpitFuelCostModel projectId={projectId} allowEdit={allowEdit} />
    : engine === "wastewater" || (bundle && engine === null)
      ? <CockpitCostModel projectId={projectId} allowEdit={allowEdit} />
      : <ProjectCostFormat projectId={projectId} allowEdit={allowEdit} />;

  if (options.length < 2) return body;
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="cockpit-cost-tab">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e5e5e7] bg-white px-4 py-3">
        <span className="text-[12px] font-semibold text-[#1d1d1f]">試算</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="試算の切り替え" data-testid="cockpit-cost-model-switch">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={option.key === active}
              onClick={() => setChoice(option.key)}
              className={`min-h-9 rounded-md border px-3 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#027fdc] ${option.key === active ? "border-[#1d1d1f] bg-[#1d1d1f] text-white" : "border-[#d2d2d7] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {body}
    </div>
  );
}
