"use client";
import type { DdLiveProjectPage } from "@/lib/dd-project-page-types";
import { QuestionTreeView } from "@/components/question-tree/QuestionTreeView";
import { SxPartnerPipeline } from "@/components/project-workspace/SxPartnerPipeline";
import { CockpitBusinessPlan } from "@/components/cockpit/CockpitBusinessPlan";
import { CockpitIpPortfolio } from "@/components/cockpit/CockpitIpPortfolio";
import { CockpitCompanyOverview } from "@/components/cockpit/CockpitCompanyOverview";
import { CockpitCapitalPolicy } from "@/components/cockpit/CockpitCapitalPolicy";
import { CockpitGrants } from "@/components/cockpit/CockpitGrants";
import { Bzm22AcquisitionLedger } from "@/components/cockpit/Bzm22AcquisitionLedger";
import { CockpitAmdContributions } from "@/components/cockpit/CockpitAmdContributions";

const noop = () => {};
export function DdProjectPageBody({data,canDownload=false}:{data:DdLiveProjectPage;canDownload?:boolean}) {
  switch(data.page) {
    case "gantt": return <QuestionTreeView initialBundle={data.tree} projectId={data.projectId} projectName={data.projectName} embedded mode="gantt" />;
    case "partners": return <SxPartnerPipeline management={data.management} projectId={data.projectId} onManagementChange={noop} />;
    case "business-plan": return <CockpitBusinessPlan projectId={data.projectId} projectName={data.projectName} initialPlan={data.plan} canDownload={canDownload} />;
    case "ip": return <CockpitIpPortfolio projectId={data.projectId} initialData={data.portfolio} />;
    case "company": return <CockpitCompanyOverview projectId={data.projectId} projectName={data.projectName} surface="workspace" readOnly initialData={data.governance} canDownload={canDownload} />;
    case "capital-policy": return <CockpitCapitalPolicy projectId={data.projectId} readOnly initialData={data.governance} />;
    case "activity": return <div className="space-y-3"><CockpitGrants projectId={data.projectId} initialGrants={data.grants} disableAttachments />{data.showAcquisitions&&<Bzm22AcquisitionLedger projectId={data.projectId} initialPayload={data.acquisitions} />}<CockpitAmdContributions projectId={data.projectId} initialPayload={data.contributions} /></div>;
  }
}
