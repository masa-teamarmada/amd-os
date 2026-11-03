'use client';
import dynamic from 'next/dynamic';
import {ProjectPageLoading} from '@/components/project-space/ProjectPageLoading';
import {ProjectDiligenceSection,type ResolutionDocument} from '@/components/project-workspace/ProjectDiligenceSection';
import type {DdLiveProjectPage} from '@/lib/dd-project-page-types';
const ProjectTechnicalEvidence=dynamic(()=>import('@/components/project-workspace/ProjectTechnicalEvidence').then(m=>m.ProjectTechnicalEvidence),{loading:ProjectPageLoading});
const ProjectMarketResearch=dynamic(()=>import('@/components/project-workspace/ProjectMarketResearch').then(m=>m.ProjectMarketResearch),{loading:ProjectPageLoading});
const ProjectProductDescription=dynamic(()=>import('@/components/project-workspace/ProjectProductDescription').then(m=>m.ProjectProductDescription),{loading:ProjectPageLoading});
const PlanDocument=dynamic(()=>import('@/components/dd/DdShortTermPlan').then(m=>m.DdShortTermPlan),{loading:ProjectPageLoading});
const ProjectLongTermPlan=dynamic(()=>import('@/components/project-workspace/ProjectLongTermPlan').then(m=>m.ProjectLongTermPlan),{loading:ProjectPageLoading});
const ProjectNextRoundOverview=dynamic(()=>import('@/components/project-workspace/ProjectNextRoundOverview').then(m=>m.ProjectNextRoundOverview),{loading:ProjectPageLoading});
export function ProjectRecordSupplement({data,resolutionDocuments=[]}:{data:DdLiveProjectPage;resolutionDocuments?:ResolutionDocument[]}){
 if('empty' in data){
  if(data.page==='technical-evidence')return <ProjectTechnicalEvidence data={data.technicalEvidence??null}/>;
  if(data.page==='market-research')return <ProjectMarketResearch data={data.marketResearch??null}/>;
  if(data.page==='product-description')return <ProjectProductDescription data={data.productDescription??null}/>;
  if(data.page==='founding-background')return <ProjectProductDescription data={data.foundingBackground??null} founding/>;
  return <ProjectDiligenceSection page={data.page} managementMinutes={data.managementMinutes} resolutionDocuments={resolutionDocuments} organizationChart={data.organizationChart} biographies={data.biographies}/>;
 }
 if(data.page==='short-term-plan')return <PlanDocument available={data.available} html={data.html}/>;
 if(data.page==='long-term-plan')return data.available?<PlanDocument available html={data.html} term="long"/>:<ProjectLongTermPlan plan={data.plan}/>;
 if(data.page==='next-round-overview')return <ProjectNextRoundOverview data={data.capital}/>;
 return null;
}
