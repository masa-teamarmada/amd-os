"use client";
import { prefetchGovernance } from "./governance-client";
import { prefetchBusinessSummary } from "./business-summary-client";
import { prefetchProjectTech } from "./project-tech-client";
import { prefetchProjectBusinessPlan } from "./project-business-plan-client";
import { prefetchProjectCostModel, prefetchProjectFuelCostModel } from "./project-cost-model-client";
import { prefetchQuestionTree } from "./question-tree-client";
import { loadProjectContracts } from "./project-contract-list-client";

/** 内部/共有面の選択ページだけを既存の認可付きAPIで先読みする。DDでは使わない。 */
export function prefetchProjectPage(projectId: string, page: string) {
  switch (page) {
    case "company": prefetchBusinessSummary(projectId); prefetchGovernance(projectId); break;
    case "capital-policy": prefetchGovernance(projectId); break;
    case "technology": case "competition": case "business-model": prefetchProjectTech(projectId); break;
    case "business-plan": prefetchProjectBusinessPlan(projectId); break;
    case "cost": case "cost-model": case "cost-fuel": prefetchProjectCostModel(projectId); prefetchProjectFuelCostModel(projectId); break;
    case "gantt": case "issues": prefetchQuestionTree(projectId); break;
    case "contracts": void loadProjectContracts(projectId).catch(() => {}); break;
  }
}
