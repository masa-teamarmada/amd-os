'use client';
import {readProjectPageRuntime} from '../../lib/project-page-client';

import {projectRecordSnapshot} from '../../lib/project-page-snapshot';
import {useCallback,useEffect,useId,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import dynamic from 'next/dynamic';
import {projectPageDefinition,projectPageId} from '../../lib/project-page-registry';
import type {ProjectPageRuntime} from '../../lib/project-page-runtime-types';
import {ProjectPageLoading} from '@/components/project-space/ProjectPageLoading';
import {CanonicalCapitalTemplateContext} from '../project-space/ProjectCanonicalContext';
import {ProjectPageRuntimeContext,ProjectPageRefreshContext,useProjectPageEnvironment} from './ProjectPageContext';
const ProjectStrategicResources=dynamic(()=>import('./ProjectStrategicResources').then(m=>m.ProjectStrategicResources),{loading:ProjectPageLoading});
const ProjectOperationsPage=dynamic(()=>import('./ProjectOperationsPage').then(m=>m.ProjectOperationsPage),{loading:ProjectPageLoading});
const DdReportReader=dynamic(()=>import('../dd/report/DdReportReader').then(m=>m.DdReportReader),{loading:ProjectPageLoading});

type Props={projectId:string;pageId:string;initialRuntime?:ProjectPageRuntime;initialChapter?:string;initialModalYm?:string|null};
/** 全スペースがこの本体を開く。子要素・スペース名・別の本体を受け付けない。 */
export function ProjectPageBody({projectId,pageId:requestedId,initialRuntime,initialChapter,initialModalYm}:Props){
  const environment=useProjectPageEnvironment(),query=useSearchParams(),id=useId();
  const pageId=projectPageId(requestedId),definition=pageId?projectPageDefinition(pageId):null;
  const [state,setState]=useState<{key:string;runtime:ProjectPageRuntime|null;error?:string}>(()=>({key:requestedId,runtime:initialRuntime??null}));
  const [attempt,setAttempt]=useState(0),[view,setView]=useState<'current'|'records'>(()=>query.get('records')===pageId?'records':'current');
  const [visited,setVisited]=useState(view==='records');
  const [chapterId,setChapterId]=useState(initialChapter??query.get('chapter')??'');
  const wantOperations=!definition?.chapters.length||view==='records'||visited;
  const endpoint=pageId?environment.endpoint(pageId)+(wantOperations?'&records=1':''):'';
  const recordEndpoint=pageId?environment.endpoint(pageId)+'&records=1':'';
  const refreshPage=useCallback(async()=>{
    const runtime=await readProjectPageRuntime(recordEndpoint);
    setState({key:requestedId,runtime});return runtime;
  },[recordEndpoint,requestedId]);
  useEffect(()=>{
    if(initialRuntime&&attempt===0&&(!wantOperations||initialRuntime.operations.loaded!==false)){setState({key:requestedId,runtime:initialRuntime});return;}
    if(!pageId)return;
    const controller=new AbortController();
    void readProjectPageRuntime(endpoint,controller.signal).then(runtime=>{
      if(!controller.signal.aborted)setState({key:requestedId,runtime});
    }).catch(error=>{if(!controller.signal.aborted)setState(current=>({key:requestedId,runtime:current.key===requestedId?current.runtime:null,error:error instanceof Error?error.message:'ページを読み込めなかった'}));});
    return()=>controller.abort();
  },[endpoint,pageId,requestedId,initialRuntime,attempt]);
  useEffect(()=>{if(query.get('records')===pageId){setVisited(true);setView('records');}else setView('current');if(query.get('chapter'))setChapterId(query.get('chapter')!);},[query,pageId]);
  const runtime=state.key===requestedId?state.runtime:null,report=runtime?.report;
  const chapter=report?.chapters.find(c=>c.slug===chapterId)??report?.chapters[0];
  const hasOperations=Boolean(definition?.operation),showOperations=hasOperations&&(!report||view==='records');
  useEffect(()=>{if(showOperations)setVisited(true);},[showOperations]);
  function selectView(next:'current'|'records'){
    if(next==='records')setVisited(true);setView(next);
    const url=new URL(window.location.href);
    if(next==='records'&&pageId)url.searchParams.set('records',pageId);else url.searchParams.delete('records');
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  if(!pageId||!definition)return <p role="alert">ページが登録されていない。</p>;
  if(state.key===requestedId&&state.error&&!runtime)return <div role="alert" className="rounded border border-[#F2A21B] p-3 text-sm"><p>{state.error}</p><button type="button" className="mt-2 min-h-9 rounded border px-3" onClick={()=>setAttempt(n=>n+1)}>再読込</button></div>;
  if(!runtime)return <ProjectPageLoading/>;
  const reportEndpoint=environment.reportEndpoint(pageId);
  const capitalTemplate=pageId==='capital-plan'&&report?.chapters[0]?{chapter:report.chapters[0],documentVersion:report.edition.documentVersion??report.edition.sourceVersion}:undefined;
  const overview=report?.chapters.find(c=>c.slug==='unit-economics');
  function selectChapter(slug:string){setChapterId(slug);const url=new URL(window.location.href);url.searchParams.set('chapter',slug);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
  function chapterButton(item:NonNullable<typeof report>['chapters'][number],label=item.title){return <button type="button" key={item.slug} aria-pressed={chapter?.slug===item.slug} onClick={()=>selectChapter(item.slug)} className={`min-h-9 rounded-md border px-2 py-1 text-xs hover:bg-[#f5f5f7] ${chapter?.slug===item.slug?'border-[#35B9D0] bg-[#ecf8fa] font-semibold':'border-[#e5e5e7]'}`}>{label}</button>;}
  return <ProjectPageRuntimeContext.Provider value={runtime}><ProjectPageRefreshContext.Provider value={refreshPage}><div className="min-w-0 space-y-2" data-project-page-id={pageId} data-page-owner="shared" data-canonical-page={pageId} data-canonical-revision={report?.edition.revision}>
    {pageId==='strategic-resources'&&<ProjectStrategicResources data={runtime.strategicResources??null}/>}
    {state.error&&<p role="alert" className="rounded border border-[#F2A21B] p-3 text-sm">{state.error}<button type="button" className="ml-3 underline" onClick={()=>setAttempt(n=>n+1)}>再読込</button></p>}
    {report&&<div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#e5e5e7] text-[13px]">
      {hasOperations&&<div role="tablist" aria-label="本文と管理記録" className="flex flex-wrap gap-1">
        {[['current','本文・計画'],['records','管理・履歴']].map(([key,label])=><button key={key} type="button" role="tab" id={id+'-'+key+'-tab'} aria-controls={id+'-'+key} aria-selected={view===key} tabIndex={view===key?0:-1} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'current':event.key==='End'?'records':view==='current'?'records':'current';selectView(next);document.getElementById(id+'-'+next+'-tab')?.focus();}}} onClick={()=>selectView(key as 'current'|'records')} className={`min-h-9 border-b-2 px-2 py-1 font-semibold ${view===key?'border-[#35B9D0] text-[#1d1d1f]':'border-transparent text-[#6e6e73]'}`}>{label}</button>)}
      </div>}
      <span className="ml-auto py-1 text-[11px] text-[#6e6e73]">共通ページ v{report.edition.documentVersion} · {report.edition.revision}版</span>
    </div>}
    {report&&chapter&&<div id={id+'-current'} role={hasOperations?'tabpanel':undefined} aria-labelledby={hasOperations?id+'-current-tab':undefined} hidden={showOperations}>
      {report.chapters.length>1&&<nav aria-label="ページの内容" className="mb-2 flex flex-wrap items-end gap-x-3 gap-y-2">
        {overview?<>{chapterButton(overview,'概要')}<div className="border-l border-[#d8e3e7] pl-3"><span className="mb-1 block text-[11px] text-[#6e6e73]">コストの内訳</span><div className="flex flex-wrap gap-1">{report.chapters.filter(c=>c!==overview).map(c=>chapterButton(c))}</div></div></>:report.chapters.map(c=>chapterButton(c))}
      </nav>}
      <DdReportReader key={chapter.slug+':'+report.edition.revision} slug={report.slug} title={report.edition.title} revision={report.edition.revision} sourceVersion={report.edition.sourceVersion} documentVersion={report.edition.documentVersion} chapter={chapter} index={report.index} inputs={report.inputs.filter(i=>i.sheet===chapter.source_sheet)} overrides={report.overrides} glossary={report.edition.glossary} canDownload={report.canDownload} pdfReady={runtime.pdfReady??true} downloadRelease={report.downloadRelease} reportEndpoint={reportEndpoint} canSaveInputs={report.canSaveInputs} saveInputs={report.inputs} onCommitted={()=>setAttempt(n=>n+1)} assetUrls={Object.fromEntries(chapter.body.objects.filter(o=>o.kind==='image').map(o=>[o.assetKey,reportEndpoint+'&chapter='+encodeURIComponent(chapter.slug)+'&asset='+encodeURIComponent(o.assetKey)]))} navigation={environment.navigation}/>
    </div>}
    {hasOperations&&<div id={id+'-records'} role={report?'tabpanel':undefined} aria-labelledby={report?id+'-records-tab':undefined} hidden={!showOperations}>
      {(showOperations||visited)&&(runtime.operations.loaded===false?<ProjectPageLoading/>:<CanonicalCapitalTemplateContext.Provider value={capitalTemplate}><ProjectOperationsPage key={JSON.stringify([runtime.operations.recordAudience,runtime.operations.canEdit,runtime.operations.canDownload,runtime.operations.viewer.memberId,"role" in runtime.operations.viewer?runtime.operations.viewer.role:null])} cockpit={runtime.operations.cockpit} tasks={runtime.operations.cockpit.tasks??[]} activeTab={definition.operation as never} initialModalYm={initialModalYm} onTabChange={environment.navigate}/></CanonicalCapitalTemplateContext.Provider>)}
    </div>}
  </div></ProjectPageRefreshContext.Provider></ProjectPageRuntimeContext.Provider>;
}

export function ProjectRecordSnapshot({data,canDownload=false,canEdit=false,resolutionDocuments=[]}:{data:import('@/lib/dd-project-page-types').DdLiveProjectPage;canDownload?:boolean;canEdit?:boolean;resolutionDocuments?:import('@/components/project-workspace/ProjectDiligenceSection').ResolutionDocument[]}){
 const runtime=projectRecordSnapshot(data,canDownload,canEdit);runtime.operations.resolutionDocuments=resolutionDocuments;
 return <ProjectPageRuntimeContext.Provider value={runtime}><ProjectOperationsPage cockpit={runtime.operations.cockpit} tasks={[]} activeTab={(projectPageDefinition(data.page)?.operation??data.page) as never}/></ProjectPageRuntimeContext.Provider>;
}
