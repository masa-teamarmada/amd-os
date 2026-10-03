"use client";

import { useEffect, useState } from "react";
import { CockpitCostModel } from "@/components/cockpit/CockpitCostModel";
import { ProjectCostFormat } from "@/components/cockpit/ProjectCostFormat";
import { costFormatEngineOf } from "@/lib/project-cost-format";
import { loadProjectCostModel, peekProjectCostModel, type CostModelResponse } from "@/lib/project-cost-model-client";

// コスト試算タブの入口（コックピット・PJワークスペース・DDパッケージで共通）。
// データの形（project_cost_models.case_kind と明細・作業の有無）だけで画面を選ぶ。PJ番号では分けない（spec 3-23 §7）。
//   廃液処理の試算（case_kind = multi など）… これまでの廃液の画面（CockpitCostModel）。標準フォーマットへの移行は次の段
//   明細も作業も無い古い部分試算 … これまでの画面（標準フォーマットへ移すまでの間）
//   それ以外（汎用の計算で出せる試算・未登録）… 標準フォーマット（ProjectCostFormat）
// どちらの画面も同じ読み込み層（project-cost-model-client）を通すので、ここでの読み込みは画面側でキャッシュから即座に描かれる。

interface Props {
  projectId: string;
  allowEdit?: boolean;
}

export function CockpitCostTab({ projectId, allowEdit = true }: Props) {
  const [res, setRes] = useState<CostModelResponse | null>(() => peekProjectCostModel(projectId) ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadProjectCostModel(projectId)
      .then((r) => {
        if (!cancelled) setRes(r);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!res && !failed) {
    return <div className="h-[520px] animate-pulse rounded-xl border border-[#e5e5e7] bg-[#fafafa]" data-testid="cost-tab-loading" />;
  }
  const bundle = res?.bundle ?? null;
  const engine = costFormatEngineOf(bundle);
  if (engine === "wastewater" || (bundle && engine === null)) {
    return <CockpitCostModel projectId={projectId} allowEdit={allowEdit} />;
  }
  return <ProjectCostFormat projectId={projectId} allowEdit={allowEdit} />;
}
