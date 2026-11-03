import 'server-only';
import {loadProjectStrategicResources} from './project-strategic-resources-server';
import {resolveExecutiveMeetingViewer} from './project-executive-meeting-access';
import {ddReportOutputState,queueDdReportPdf} from '@/lib/dd-report-output-state';
import {ddReportDownloadEdition} from '@/lib/dd-report-download-policy';
import {projectRecordSnapshot} from './project-page-snapshot';
import {createAdminClient} from '@/lib/supabase/admin';
import {loadProjectReportEdition,loadDdReportChapterIndex,loadDdReportChapter,evaluatedDdReportChapter,loadDdReportModel,redactDdReport} from '@/lib/dd-report-server';
import {ddReportDownloadRelease} from '@/lib/dd-report-download-policy';
import {projectPageDefinition,type ProjectPageId} from './project-page-registry';
import {loadProjectPageRecord} from './project-page-record-server';
import {getProjectWorkspaceBundle} from '@/lib/project-workspace';
import {fetchCockpitFromSupabase,type CockpitData} from '@/lib/supabase-data';
import type {ProjectCanonicalPageData} from '@/lib/project-canonical-page-types';
import type {ProjectCanonicalPageKey} from '@/lib/project-canonical-pages';
import type {ProjectPageActor} from './project-page-actor';
import type {ProjectPageRuntime} from './project-page-runtime-types';
/** 一つのページ保存元。入場認可済みの本人だけを受け取り、スペース名は受け取らない。 */
export async function projectPageSource(projectId:string,actor:ProjectPageActor){
 const db=createAdminClient();
 const identity=await db.from('projects').select('project_id,project_name,display_name,project_category,status,client_name').eq('project_id',projectId).maybeSingle();
 if(identity.error||!identity.data)throw new Error('ページを読み込めなかった');
 const pkg=await db.from('dd_packages').select('id,slug').eq('project_id',projectId).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(1).maybeSingle();
 if(pkg.error)throw new Error('資料の登録を読み込めなかった');
 const edition=pkg.data?await loadProjectReportEdition(pkg.data.id,actor.canReadDraft):null;
 const index=edition?await loadDdReportChapterIndex(edition.id):[];
 return {identity:identity.data,slug:pkg.data?.slug??'',edition,index};
}
export async function readProjectReportPage(projectId:string,pageId:ProjectPageId,actor:ProjectPageActor,source?:Awaited<ReturnType<typeof projectPageSource>>,includeRecords=true):Promise<ProjectCanonicalPageData|null>{
 const definition=projectPageDefinition(pageId);if(!definition)throw new Error('ページ未登録');
 const current=source??await projectPageSource(projectId,actor),{edition,index}=current;
 if(!edition||!definition.chapters.length)return null;
 if(!definition.chapters.every(slug=>index.some(c=>c.slug===slug)))throw new Error('共通ページの本文が不足している');
 const [chapters,model,records]=await Promise.all([
  Promise.all(definition.chapters.map(async slug=>{const raw=await loadDdReportChapter(edition.id,slug);if(!raw)throw new Error('本文を読み込めなかった');return evaluatedDdReportChapter(edition,raw);})),
  loadDdReportModel(edition),
  includeRecords&&definition.operation?loadProjectPageRecord(projectId,definition.operation,actor):Promise.resolve(null),
 ]);
 const inputs=model.inputs.filter(input=>chapters.some(c=>c.source_sheet===input.sheet)&&['cyanobacteria-cost','reactor-cost','metal-cost','fame-cost','assumptions'].some(key=>chapters.some(c=>c.slug===key&&c.source_sheet===input.sheet)));
 const data:ProjectCanonicalPageData={projectId,page:pageId as ProjectCanonicalPageKey,projectName:current.identity.display_name||current.identity.project_name,slug:current.slug,edition:{id:edition.id,title:edition.title,revision:edition.revision,sourceVersion:edition.source_version,documentVersion:edition.document_version,sourceSha256:edition.source_sha256,glossary:edition.glossary},chapters,index,inputs,overrides:Object.fromEntries(Object.entries(edition.input_overrides).filter(([key])=>inputs.some(i=>`${i.sheet}!${i.address}`===key))),records,canEditRecords:actor.canEditRecords,canSaveInputs:pageId==='cost-model'&&actor.canSaveInputs,canDownload:actor.canDownload,downloadRelease:ddReportDownloadRelease(edition)};
 return actor.external?redactDdReport(projectId,data):data;
}
function emptyCockpit(source:Awaited<ReturnType<typeof projectPageSource>>):CockpitData{
 const p=source.identity;return {project:{projectId:p.project_id,projectName:p.display_name||p.project_name,projectCategory:p.project_category,status:p.status,clientName:p.client_name??''},currentYm:new Date().toISOString().slice(0,7).replace('-',''),billingCycles:[],planCycle:null,milestones:[],progress:[],reports:[],members:[],nudges:[],tasks:[],subItems:[],responsibilities:[],memberMap:{},pastPlanCycles:[],msActivities:[],memberActivities:[],strategySignals:[],msChangeHistory:[],seasonFinance:null} as unknown as CockpitData;
}
export async function readProjectPage(projectId:string,pageId:ProjectPageId,actor:ProjectPageActor,source?:Awaited<ReturnType<typeof projectPageSource>>,includeOperations=false):Promise<ProjectPageRuntime>{
 const current=source??await projectPageSource(projectId,actor),definition=projectPageDefinition(pageId);if(!definition)throw new Error('ページ未登録');
 const loadOperations=includeOperations||!definition.chapters.length;
 const control=loadOperations&&['weekly','gantt','partners','issues'].includes(definition.operation??'');
 const needsCockpit=loadOperations&&['progress','overview','project-contracts','project-finance','monthly-reports','score-detail','tasks'].includes(definition.operation??'');
 const [report,cockpit,workspace,strategicResources]=await Promise.all([
  readProjectReportPage(projectId,pageId,actor,current,loadOperations&&pageId!=='partners'),
  actor.external||!needsCockpit?Promise.resolve(emptyCockpit(current)):fetchCockpitFromSupabase(projectId,createAdminClient()),
  control?(actor.external&&!actor.disclosures.workspace?readDdOnlyWorkspace(projectId,current,actor):getProjectWorkspaceBundle(projectId,actor.workspaceAccess)):Promise.resolve(undefined),
  pageId==='strategic-resources'?loadProjectStrategicResources(projectId):Promise.resolve(undefined),
 ]);
 cockpit.canViewAdminMonthlyReports = 'isAdmin' in actor.viewer && actor.viewer.isAdmin === true;
 const canExecutiveMeeting = pageId === 'executive-meeting' ? Boolean(await resolveExecutiveMeetingViewer(projectId)) : false;
 const output=report&&actor.canDownload&&current.edition?await ddReportOutputState(ddReportDownloadEdition(current.edition),projectId):null;
 if(report&&current.edition&&actor.canDownload&&!report.downloadRelease.paused&&!output?.ready)queueDdReportPdf(current.edition,projectId,current.slug);
 const record=pageId==='partners'&&workspace?{kind:'project_page' as const,page:'partners' as const,projectId,projectName:current.identity.display_name||current.identity.project_name,management:workspace.sxManagement}:report?.records??(loadOperations&&pageId==='capital-policy'?await loadProjectPageRecord(projectId,'capital-policy',actor):null);
 if(report)report.records=record;
 const recordWorkspace=record&&'tree' in record?projectRecordSnapshot(record).operations.workspace:undefined;
 return {pageId,projectId,projectName:current.identity.display_name||current.identity.project_name,strategicResources,pdfReady:output?.ready??false,report,operations:{canExecutiveMeeting,recordAudience:actor.external?"shared":"internal",loaded:loadOperations,cockpit,workspace:workspace??recordWorkspace,viewer:actor.viewer,record,canEdit:actor.canEditRecords,canDownload:actor.canDownload}};
}

async function readDdOnlyWorkspace(projectId:string,source:Awaited<ReturnType<typeof projectPageSource>>,actor:ProjectPageActor){
 const record=await loadProjectPageRecord(projectId,'partners',actor);if(!('management' in record))throw new Error('管理記録がない');
 const today=new Date().toISOString().slice(0,10);
 return {project:{projectId,projectName:source.identity.display_name||source.identity.project_name,projectCategory:source.identity.project_category,clientName:null,status:source.identity.status,displayName:source.identity.display_name},currentWeekStart:today,currentMonth:today.slice(0,7).replace('-',''),memberCount:0,evidenceCount:0,effort:{plannedHours:0,actualHours:0,calendarHours:0,enteredHours:0,tallyDevelopmentHours:0,tallyMeetingHours:0,tallyTotalHours:0,tallySyncedAt:null,categories:{basic:0,applied:0,development:0,su:0,coordination:0},hasEntries:false,links:[]},members:[],milestones:[],themes:[],allMeetings:[],evidenceByMonth:[],evidenceBySource:[],weeklyTrend:[],sxManagement:record.management};
}
