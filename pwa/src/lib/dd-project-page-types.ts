import type { QuestionTreeBundle } from "./question-tree-types";
import type { SxManagementBundle } from "./sx-management";
import type { ProjectBusinessPlan } from "./project-business-plan";
import type { CompanyOverviewData } from "./company-overview";
import type { IpPortfolioBundle } from "@/components/cockpit/CockpitIpPortfolio";
import type { Grant } from "@/components/cockpit/CockpitGrants";
import type { Bzm22AcquisitionApiPayload } from "./bzm-2-2-acquisitions";
import type { AmdContributionsPayload } from "./amd-contributions";

import type { BusinessSummaryResponse } from "./project-overview";
import type { ProjectTechResponse } from "./project-tech-client";
import type { ProjectFinancePageData } from "./project-finance-page-data";
import type { CapitalPlanPageData } from "./project-capital-plan-data";
import type { CostModelResponse } from "./project-cost-model-client";

import type { DdEmptyPageKey } from "./dd-pages";

type Identity = { kind: "project_page"; projectId: string; projectName: string };
export type DdLiveProjectPage = Identity & (
  | { page: DdEmptyPageKey; empty: true }
  | { page: "technology" | "competition" | "business-model"; tech: ProjectTechResponse }
  | { page: "financial-projection"; finance: ProjectFinancePageData }
  | { page: "capital-plan"; capital: CapitalPlanPageData }
  | { page: "cost-model"; costs: { main: CostModelResponse; fuel: CostModelResponse } }
  | { page: "gantt"; tree: QuestionTreeBundle }
  | { page: "partners"; management: SxManagementBundle }
  | { page: "business-plan"; plan: ProjectBusinessPlan | null }
  | { page: "ip"; portfolio: IpPortfolioBundle }
  | { page: "company" | "capital-policy"; governance: CompanyOverviewData; businessSummary?: BusinessSummaryResponse }
  | { page: "activity"; grants: Grant[]; acquisitions: Bzm22AcquisitionApiPayload; contributions: AmdContributionsPayload; showAcquisitions: boolean }
);
