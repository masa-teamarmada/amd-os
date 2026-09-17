"use client";

import CapitalPlanWorkspace from "./CapitalPlanWorkspace";

/** 事業計画と連動して更新する、将来前提の資本政策表。 */
export function CockpitCapitalPlan({ projectId, projectName }: { projectId: string; projectName: string }) {
  return <CapitalPlanWorkspace projectId={projectId} projectName={projectName} />;
}
