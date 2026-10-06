"use client";
import dynamic from "next/dynamic";
import { ProjectPageLoading } from "@/components/project-space/ProjectPageLoading";

import { ProjectDiligenceSection } from "@/components/project-workspace/ProjectDiligenceSection";
import type { DdLiveProjectPage } from "@/lib/dd-project-page-types";

// 選んだページの部品だけを取得し、他ページのJSを初期表示の待ち時間に積まない。
const ProjectContractList = dynamic(() => import("@/components/project-workspace/ProjectContractList").then((module) => module.ProjectContractList), { loading: ProjectPageLoading });
const QuestionTreeView = dynamic(() => import("@/components/question-tree/QuestionTreeView").then((module) => module.QuestionTreeView), { loading: ProjectPageLoading });
const SxPartnerPipeline = dynamic(() => import("@/components/project-workspace/SxPartnerPipeline").then((module) => module.SxPartnerPipeline), { loading: ProjectPageLoading });
const CockpitBusinessPlan = dynamic(() => import("@/components/cockpit/CockpitBusinessPlan").then((module) => module.CockpitBusinessPlan), { loading: ProjectPageLoading });
const CockpitIpPortfolio = dynamic(() => import("@/components/cockpit/CockpitIpPortfolio").then((module) => module.CockpitIpPortfolio), { loading: ProjectPageLoading });
const CockpitCompanyOverview = dynamic(() => import("@/components/cockpit/CockpitCompanyOverview").then((module) => module.CockpitCompanyOverview), { loading: ProjectPageLoading });
const CockpitCapitalPolicy = dynamic(() => import("@/components/cockpit/CockpitCapitalPolicy").then((module) => module.CockpitCapitalPolicy), { loading: ProjectPageLoading });
const CockpitGrants = dynamic(() => import("@/components/cockpit/CockpitGrants").then((module) => module.CockpitGrants), { loading: ProjectPageLoading });
const Bzm22AcquisitionLedger = dynamic(() => import("@/components/cockpit/Bzm22AcquisitionLedger").then((module) => module.Bzm22AcquisitionLedger), { loading: ProjectPageLoading });
const CockpitAmdContributions = dynamic(() => import("@/components/cockpit/CockpitAmdContributions").then((module) => module.CockpitAmdContributions), { loading: ProjectPageLoading });
const CockpitTechnology = dynamic(() => import("@/components/cockpit/CockpitTechnology").then((module) => module.CockpitTechnology), { loading: ProjectPageLoading });
const CockpitFinancialProjection = dynamic(() => import("@/components/cockpit/CockpitFinancialProjection").then((module) => module.CockpitFinancialProjection), { loading: ProjectPageLoading });
const CockpitCapitalPlan = dynamic(() => import("@/components/cockpit/CockpitCapitalPlan").then((module) => module.CockpitCapitalPlan), { loading: ProjectPageLoading });
const CockpitCostTab = dynamic(() => import("@/components/cockpit/CockpitCostTab").then((module) => module.CockpitCostTab), { loading: ProjectPageLoading });

const ProjectLongTermPlan = dynamic(() => import("@/components/project-workspace/ProjectLongTermPlan").then((module) => module.ProjectLongTermPlan), { loading: ProjectPageLoading });

const ProjectNextRoundOverview = dynamic(() => import("@/components/project-workspace/ProjectNextRoundOverview").then(module => module.ProjectNextRoundOverview), { loading: ProjectPageLoading });

const ProjectDevelopmentIssues = dynamic(() => import("@/components/project-workspace/ProjectDevelopmentIssues").then(module => module.ProjectDevelopmentIssues), { loading: ProjectPageLoading });

const DdShortTermPlan = dynamic(() => import("./DdShortTermPlan").then(module => module.DdShortTermPlan), { loading: ProjectPageLoading });
const ProjectProductDescription = dynamic(() => import("@/components/project-workspace/ProjectProductDescription").then(module => module.ProjectProductDescription), { loading: ProjectPageLoading });

const noop = () => {};
const ProjectMarketResearch = dynamic(() => import("@/components/project-workspace/ProjectMarketResearch").then(module => module.ProjectMarketResearch), { loading: ProjectPageLoading });
export function DdProjectPageBody({data,canDownload=false}:{data:DdLiveProjectPage;canDownload?:boolean}) {
  if ("empty" in data && data.page === "market-research") return <ProjectMarketResearch data={data.marketResearch ?? null} />;
  if ("empty" in data && data.page === "product-description") return <ProjectProductDescription data={data.productDescription ?? null} />;
  if ("empty" in data) return <ProjectDiligenceSection page={data.page} organizationChart={data.organizationChart} biographies={data.biographies} />;
  switch(data.page) {
    case "development-issues": return <ProjectDevelopmentIssues projectId={data.projectId} initialData={data.issues} />;
    case "contracts": return <ProjectContractList projectId={data.projectId} initialData={data.contracts} />;
    case "technology": case "competition": case "business-model": return <CockpitTechnology key={`${data.projectId}:${data.page}`} projectId={data.projectId} mode={data.page} initialData={data.tech} />;
    case "monthly-trial": case "financial-projection": return <CockpitFinancialProjection projectId={data.projectId} initialData={data.finance} readOnly monthlyOnly={data.page === "monthly-trial"} />;
    case "next-round-overview": return <ProjectNextRoundOverview data={data.capital} />;
    case "capital-plan": return <CockpitCapitalPlan projectId={data.projectId} projectName={data.projectName} initialData={data.capital} readOnly />;
    case "cost-model": return <CockpitCostTab projectId={data.projectId} allowEdit={false} initialData={data.costs} />;
    case "short-term-plan": return <DdShortTermPlan available={data.available} />;
    case "gantt": return <QuestionTreeView initialBundle={data.tree} projectId={data.projectId} projectName={data.projectName} embedded mode="gantt" />;
    case "partners": return <SxPartnerPipeline management={data.management} projectId={data.projectId} onManagementChange={noop} />;
    case "long-term-plan": return <ProjectLongTermPlan plan={data.plan} />;
    case "business-plan": return <CockpitBusinessPlan projectId={data.projectId} projectName={data.projectName} initialPlan={data.plan} canDownload={canDownload} />;
    case "ip": return <CockpitIpPortfolio projectId={data.projectId} initialData={data.portfolio} />;
    case "company": return <CockpitCompanyOverview projectId={data.projectId} projectName={data.projectName} readOnly initialData={data.governance} initialBusinessSummary={data.businessSummary} canDownload={canDownload} />;
    case "capital-policy": return <CockpitCapitalPolicy projectId={data.projectId} readOnly initialData={data.governance} />;
    case "activity": return <div className="space-y-3"><CockpitGrants projectId={data.projectId} initialGrants={data.grants} disableAttachments />{data.showAcquisitions&&<Bzm22AcquisitionLedger projectId={data.projectId} initialPayload={data.acquisitions} />}<CockpitAmdContributions projectId={data.projectId} initialPayload={data.contributions} /></div>;
  }
}
