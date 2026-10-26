'use client';
import {canonicalChapterHref} from '../../lib/project-canonical-links';
import {CanonicalCapitalTemplateContext,type CanonicalCapitalTemplate} from './ProjectCanonicalContext';
import {useRouter,useSearchParams} from 'next/navigation';
import {createContext,useCallback,useContext,useEffect,useId,useState,type ReactNode,type KeyboardEvent} from 'react';
import {canonicalPageKey,canonicalReportPath,canonicalPageDefinition,type ProjectCanonicalPageKey} from '../../lib/project-canonical-pages';
import type {ProjectSurface} from '../../lib/project-surface-permissions';
import type {ProjectCanonicalPageData} from '../../lib/project-canonical-page-types';
import dynamic from 'next/dynamic';
import {ProjectPageLoading} from './ProjectPageLoading';

const DdReportReader=dynamic(()=>import('../dd/report/DdReportReader').then(module=>module.DdReportReader),{loading:ProjectPageLoading});
const DdProjectPageBody=dynamic(()=>import('../dd/DdProjectPageBody').then(module=>module.DdProjectPageBody),{loading:ProjectPageLoading});

// 元の編集画面が別の共通ページを内包する場合も、同じ本文を二重に表示しない。
const CanonicalRecordsContext=createContext(false);
type Props={projectId:string;page:string;surface:ProjectSurface;slug?:string;initialData?:ProjectCanonicalPageData;initialChapter?:string;pdfReady?:boolean;children?:ReactNode};
export function ProjectCanonicalPage(props:Props){
  const inheritedRecords=useContext(CanonicalRecordsContext),page=canonicalPageKey(props.page),controlId=useId();
  const [originalVisited,setOriginalVisited]=useState(false);
  const [sourceState,setSourceState]=useState<{page:string|null;legacy:boolean;records:boolean;capitalTemplate?:CanonicalCapitalTemplate}>({page:null,legacy:false,records:false});
  const sourceChanged=useCallback((state:{legacy:boolean;records:boolean;capitalTemplate?:CanonicalCapitalTemplate})=>setSourceState({page,...state}),[page]);
  if(inheritedRecords)return <>{props.children}</>;
  const showOriginal=!page||(sourceState.page===page&&(sourceState.legacy||sourceState.records));
  useEffect(()=>{if(showOriginal)setOriginalVisited(true);},[showOriginal]);
  return <div className="min-w-0 space-y-2">
    {page&&<CanonicalPage key={`${props.projectId}:${page}:${props.surface}`} {...props} children={undefined} page={page} controlId={controlId} hasOriginalRecords={props.children!==undefined&&Boolean(canonicalPageDefinition(page).records)} sourceChanged={sourceChanged}/>}
    {props.children!==undefined&&<div hidden={!showOriginal} id={`${controlId}-records`} role={page?'tabpanel':undefined} aria-labelledby={page?`${controlId}-records-tab`:undefined} className="min-w-0 space-y-3">
      <CanonicalRecordsContext.Provider value><CanonicalCapitalTemplateContext.Provider value={page==='capital-plan'?(sourceState.page===page&&sourceState.capitalTemplate?sourceState.capitalTemplate:sourceState.page===page&&sourceState.legacy?undefined:null):undefined}>{page&&sourceState.records&&<p className="text-[12px] text-[#6e6e73]">原記録・登録条件・過去案。最新の計画は「最新の本文・計画」で確認できる。</p>}{(showOriginal||originalVisited)&&props.children}</CanonicalCapitalTemplateContext.Provider></CanonicalRecordsContext.Provider>
    </div>}
  </div>;
}
function CanonicalPage({projectId,page,surface,slug,initialData,initialChapter,pdfReady,controlId:id,hasOriginalRecords,sourceChanged}:Props&{page:ProjectCanonicalPageKey;controlId:string;hasOriginalRecords:boolean;sourceChanged:(state:{legacy:boolean;records:boolean;capitalTemplate?:CanonicalCapitalTemplate})=>void}){
  const router=useRouter(),query=useSearchParams(),requestedChapter=query.get('chapter'),requestedRecords=query.get('records');
  const [loaded,setLoaded]=useState<{data:ProjectCanonicalPageData|null}|null>(()=>initialData?{data:initialData}:null);
  const [error,setError]=useState(''),[attempt,setAttempt]=useState(0),[view,setView]=useState<'current'|'records'>('current'),[recordsVisited,setRecordsVisited]=useState(false);
  const [chapterKey,setChapterKey]=useState(initialChapter??'');
  const endpoint=canonicalReportPath(projectId,surface,page,slug);
  useEffect(()=>{
    if(initialData)return;
    const controller=new AbortController();
    void fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async response=>{
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||'共通本文を読み込めなかった。');
      if(!controller.signal.aborted){setLoaded({data:payload.page});setError('');}
    }).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'共通本文を読み込めなかった。');});
    return()=>controller.abort();
  },[endpoint,attempt,initialData]);
  useEffect(()=>{if(requestedChapter)setChapterKey(requestedChapter);if(requestedRecords===page){setRecordsVisited(true);setView('records');}},[page,requestedChapter,requestedRecords]);
  useEffect(()=>{if(initialChapter)setChapterKey(initialChapter);},[initialChapter]);
  function selectView(next:'current'|'records'){
    if(next==='records')setRecordsVisited(true);setView(next);
    const url=new URL(window.location.href);if(next==='records')url.searchParams.set('records',page);else url.searchParams.delete('records');
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  function moveTab(event:KeyboardEvent<HTMLButtonElement>){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||!hasRecords)return;
    event.preventDefault();const next=event.key==='Home'?'current':event.key==='End'?'records':view==='current'?'records':'current';selectView(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#${CSS.escape(id+'-'+next+'-tab')}`)?.focus();
  }
  const data=initialData??loaded?.data;
  useEffect(()=>{if(page==='gantt'&&data&&requestedChapter&&['business-development-plan','technical-development-plan'].includes(requestedChapter))router.replace(canonicalChapterHref(data.slug,requestedChapter,{projectId,surface,chapters:data.index.map(c=>c.slug)}));},[data,page,requestedChapter,projectId,surface,router]);
  useEffect(()=>sourceChanged({legacy:Boolean(loaded&&!data),records:view==='records',capitalTemplate:page==='capital-plan'&&data?{chapter:data.chapters[0],documentVersion:data.edition.documentVersion??data.edition.sourceVersion}:undefined}),[loaded,data,view,sourceChanged,page]);
  // レポートを採用していないPJは、従来の共通台帳をそのまま表示する。
  if(loaded&&!data)return null;
  const hasRecords=Boolean(hasOriginalRecords||data?.records),definition=canonicalPageDefinition(page);
  const chapter=data?.chapters.find(c=>c.slug===chapterKey)??data?.chapters[0];
  const overview=data?.chapters.find(c=>c.slug==='unit-economics');
  const costNavigation=overview&&data?.chapters.every(c=>c.slug==='unit-economics'||c.slug.endsWith('-cost'));
  function chapterButton(item:ProjectCanonicalPageData['chapters'][number],label=item.title==='UE'?'ユニットエコノミクス':item.title){
    return <button type="button" key={item.slug} aria-pressed={chapter?.slug===item.slug} onClick={()=>{setChapterKey(item.slug);const url=new URL(window.location.href);url.searchParams.set('chapter',item.slug);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}} className={`min-h-9 rounded-md border px-2 py-1 text-[12px] hover:bg-[#f5f5f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${chapter?.slug===item.slug?'border-[#35B9D0] bg-[#ecf8fa] font-semibold':'border-[#e5e5e7]'}`}>{label}</button>;
  }
  const assets=chapter?Object.fromEntries(chapter.body.objects.filter(o=>o.kind==='image').map(o=>[o.assetKey,`${endpoint}&chapter=${encodeURIComponent(chapter.slug)}&asset=${encodeURIComponent(o.assetKey)}`])):{};
  return <div className="min-w-0 space-y-2" data-canonical-page={page} data-canonical-edition={data?.edition.id} data-canonical-revision={data?.edition.revision}>
    {(data||error)&&<div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#e5e5e7] text-[13px]">
      <div role="tablist" aria-label="本文と原記録" className="flex flex-wrap gap-1">
        <button type="button" role="tab" id={`${id}-current-tab`} aria-controls={`${id}-current`} aria-selected={view==='current'} tabIndex={view==='current'?0:-1} onKeyDown={moveTab} onClick={()=>selectView('current')} className={`min-h-9 border-b-2 px-2 py-1 font-semibold hover:bg-[#f5f5f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${view==='current'?'border-[#35B9D0] text-[#1d1d1f]':'border-transparent text-[#6e6e73]'}`}>最新の本文・計画</button>
        {hasRecords&&<button type="button" role="tab" id={`${id}-records-tab`} aria-controls={`${id}-records`} aria-selected={view==='records'} tabIndex={view==='records'?0:-1} onKeyDown={moveTab} onClick={()=>selectView('records')} className={`min-h-9 border-b-2 px-2 py-1 font-semibold hover:bg-[#f5f5f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${view==='records'?'border-[#35B9D0] text-[#1d1d1f]':'border-transparent text-[#6e6e73]'}`}>{definition.label||'以前の登録内容'}</button>}
      </div>
      {data&&<span className="ml-auto py-1 text-[11px] text-[#6e6e73]">共通本文 v{data.edition.documentVersion} · {data.edition.revision}版</span>}
    </div>}
    <div role="tabpanel" id={`${id}-current`} aria-labelledby={`${id}-current-tab`} hidden={view!=='current'}>
      {error?<div role="alert" className="rounded-lg border border-[#F2A21B] p-3 text-[13px]"><p>{error}</p><button type="button" className="mt-2 min-h-9 rounded border px-3" onClick={()=>{setError('');setAttempt(v=>v+1);}}>再読込</button></div>:!data||!chapter?<ProjectPageLoading/>:<>
        {data.chapters.length>1&&(costNavigation&&overview?<nav aria-label="ユニットエコノミクスの内容" className="mb-3 flex flex-wrap items-end gap-x-3 gap-y-2">
          {chapterButton(overview,'概要')}
          <div role="group" aria-label="コストの内訳" className="min-w-0 border-l border-[#d8e3e7] pl-3">
            <span className="mb-1 block text-[11px] font-semibold text-[#6e6e73]">コストの内訳</span>
            <div className="flex flex-wrap gap-1">{data.chapters.filter(c=>c.slug!==overview.slug).map(c=>chapterButton(c))}</div>
          </div>
        </nav>:<div role="group" aria-label="計画・コストの内訳" className="mb-2 flex flex-wrap gap-1">{data.chapters.map(c=>chapterButton(c))}</div>)}
        <DdReportReader key={`${chapter.slug}:${data.edition.revision}`} slug={data.slug} title={data.edition.title} revision={data.edition.revision} sourceVersion={data.edition.sourceVersion} documentVersion={data.edition.documentVersion} chapter={chapter} index={data.index} inputs={data.inputs.filter(input=>input.sheet===chapter.source_sheet)} overrides={data.overrides} glossary={data.edition.glossary} canDownload={data.canDownload} pdfReady={pdfReady??true} downloadRelease={data.downloadRelease} reportEndpoint={endpoint} canSaveInputs={data.canSaveInputs} saveInputs={data.inputs} onCommitted={()=>{if(!initialData){setLoaded(null);setAttempt(value=>value+1);}}} assetUrls={assets} navigation={{projectId,surface,chapters:data.index.map(item=>item.slug)}}/>
      </>}
    </div>
    {hasRecords&&!hasOriginalRecords&&<div role="tabpanel" id={`${id}-records`} aria-labelledby={`${id}-records-tab`} hidden={view!=='records'}>
      {recordsVisited&&<CanonicalRecordsContext.Provider value><p className="mb-2 text-[12px] text-[#6e6e73]">原記録・登録条件・過去案。最新の計画は「最新の本文・計画」で確認できる。</p>{data?.records?<DdProjectPageBody data={data.records} canDownload={data.canDownload}/>:null}</CanonicalRecordsContext.Provider>}
    </div>}
  </div>;
}
