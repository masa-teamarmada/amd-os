import type { ProjectManagementBiographies } from "./project-management-biographies";
import type { ProjectProductDescriptionData } from "./project-product-description";
import type { ProjectOrganizationChartData } from "./project-organization-chart";
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

import type { ProjectContractListData } from "./project-contract-list";
import type { DdEmptyPageKey } from "./dd-pages";

import type { ProjectDevelopmentIssuesData } from "./project-development-issues";

type Identity = { kind: "project_page"; projectId: string; projectName: string };
export type DdLiveProjectPage = Identity & (
  | { page: DdEmptyPageKey; empty: true; biographies?: ProjectManagementBiographies | null; organizationChart?: ProjectOrganizationChartData | null; productDescription?: ProjectProductDescriptionData | null }
  | { page: "technology" | "competition" | "business-model"; tech: ProjectTechResponse }
  | { page: "financial-projection" | "monthly-trial"; finance: ProjectFinancePageData }
  | { page: "capital-plan" | "next-round-overview"; capital: CapitalPlanPageData }
  | { page: "cost-model"; costs: { main: CostModelResponse; fuel: CostModelResponse } }
  | { page: "short-term-plan"; available: boolean }
  | { page: "gantt"; tree: QuestionTreeBundle }
  | { page: "partners"; management: SxManagementBundle }
  | { page: "business-plan" | "long-term-plan"; plan: ProjectBusinessPlan | null }
  | { page: "development-issues"; issues: ProjectDevelopmentIssuesData | null }
  | { page: "contracts"; contracts: ProjectContractListData }
  | { page: "ip"; portfolio: IpPortfolioBundle }
  | { page: "company" | "capital-policy"; governance: CompanyOverviewData; businessSummary?: BusinessSummaryResponse }
  | { page: "activity"; grants: Grant[]; acquisitions: Bzm22AcquisitionApiPayload; contributions: AmdContributionsPayload; showAcquisitions: boolean }
);
