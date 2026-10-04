"use client";

import type { CapitalPlanPageData } from "@/lib/project-capital-plan-data";
import CapitalPlanWorkspace from "./CapitalPlanWorkspace";

/** 事業計画と連動して更新する、将来前提の資本政策表。 */
export function CockpitCapitalPlan({ projectId, projectName, initialData, readOnly = false }: { projectId: string; projectName: string; initialData?: CapitalPlanPageData; readOnly?: boolean }) {
  return <CapitalPlanWorkspace projectId={projectId} projectName={projectName} initialData={initialData} readOnly={readOnly} />;
}
