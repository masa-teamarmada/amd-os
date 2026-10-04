import type { QuestionTreeBundle } from "./question-tree-types";
import type { SxManagementBundle } from "./sx-management";
import type { ProjectBusinessPlan } from "./project-business-plan";
import type { CompanyOverviewData } from "./company-overview";
import type { IpPortfolioBundle } from "@/components/cockpit/CockpitIpPortfolio";
import type { Grant } from "@/components/cockpit/CockpitGrants";
import type { Bzm22AcquisitionApiPayload } from "./bzm-2-2-acquisitions";
import type { AmdContributionsPayload } from "./amd-contributions";

type Identity = { kind: "project_page"; projectId: string; projectName: string };
export type DdLiveProjectPage = Identity & (
  | { page: "gantt"; tree: QuestionTreeBundle }
  | { page: "partners"; management: SxManagementBundle }
  | { page: "business-plan"; plan: ProjectBusinessPlan | null }
  | { page: "ip"; portfolio: IpPortfolioBundle }
  | { page: "company" | "capital-policy"; governance: CompanyOverviewData }
  | { page: "activity"; grants: Grant[]; acquisitions: Bzm22AcquisitionApiPayload; contributions: AmdContributionsPayload; showAcquisitions: boolean }
);
