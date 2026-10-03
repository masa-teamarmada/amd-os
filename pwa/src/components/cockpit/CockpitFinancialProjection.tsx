"use client";

import { ProjectFinanceFormat } from "./ProjectFinanceFormat";

/**
 * 試算表タブ。全PJで標準フォーマット（ProjectFinanceFormat）だけを描く（spec 3-23）。
 * PJ専用の表やグラフをここへ足さない。新しい数字は標準フォーマットの行・グラフへデータとして流し込む。
 */
export function CockpitFinancialProjection({ projectId }: { projectId: string }) {
  return <ProjectFinanceFormat key={projectId} projectId={projectId} />;
}
