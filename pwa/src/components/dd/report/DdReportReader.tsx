'use client';
import {formatDdReportValue} from '../../../lib/dd-report-format';
import {canonicalChapterHref,type CanonicalReportNavigation} from '../../../lib/project-canonical-links';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ddLegacyIpDestination,orderDdReading,ddReportFilename,ddReportBundleFilename} from '@/lib/dd-report-navigation';
import {useRouter} from 'next/navigation';
import type {DdReportChapter,DdReportChapterSummary,DdReportGlossary,DdReportInput,DdReportValue} from '@/lib/dd-report-types';
import {DdReportContent} from './DdReportContent';
import {DD_REPORT_CSS} from './dd-report-style';
import {installDdGlossaryInteractions} from '@/lib/dd-glossary-interactions';
import type {DdDownloadRelease} from '@/lib/dd-report-download-policy';

type Props={slug:string;title:string;revision:number;sourceVersion:string;documentVersion?:string|null;downloadRelease?:DdDownloadRelease;chapter:DdReportChapter;index:DdReportChapterSummary[];canDownload:boolean;pdfReady:boolean;inputs?:DdReportInput[];overrides?:Record<string,DdReportValue>;glossary?:DdReportGlossary;reportEndpoint?:string;assetUrls?:Record<string,string>;navigation?:CanonicalReportNavigation;canSaveInputs?:boolean;saveInputs?:DdReportInput[];onCommitted?:()=>void};
export function DdReportReader(props:Props) {
  const {slug,chapter,index,canDownload,revision}=props,router=useRouter(),company=props.title.split('｜')[0];
  const reader=useRef<HTMLElement>(null);const lastFollowedAnchor=useRef('');
  useEffect(()=>{const relocate=()=>{const address=/^#cell-([A-Z]+\d+)$/.exec(window.location.hash)?.[1];const destination=address?chapter.body.linkRedirects?.[address]:null;if(!destination){const anchor=chapter.slug+window.location.hash;if(address&&lastFollowedAnchor.current!==anchor){const target=reader.current?.querySelector<HTMLElement>('#cell-'+address);if(target){target.scrollIntoView({block:'start'});lastFollowedAnchor.current=anchor;}}return;}const [target,cell]=destination.split('#');router.replace(canonicalChapterHref(slug,target,props.navigation,cell));};relocate();window.addEventListener('hashchange',relocate);return()=>window.removeEventListener('hashchange',relocate);},[chapter,slug,props.navigation,router]);
  useEffect(()=>{
    if(chapter.slug!=='ip-contracts'||!index.some(c=>c.slug==='contracts'))return;
    const relocate=()=>{const match=/^#cell-([A-Z]+\d+)$/.exec(window.location.hash),target=ddLegacyIpDestination(match?.[1]);if(target){const url=new URL(window.location.href);url.searchParams.set('chapter',target.chapter);url.hash='cell-'+target.address;router.replace(url.pathname+url.search+url.hash);}};
    relocate();window.addEventListener('hashchange',relocate);return()=>window.removeEventListener('hashchange',relocate);
  },[chapter.slug,index,router]);

  const downloadRevision=props.downloadRelease?.revision??revision,downloadVersion=props.downloadRelease?.documentVersion??props.documentVersion,exportsPaused=props.downloadRelease?.paused??false;
  const versionQuery=downloadVersion?'&version='+encodeURIComponent(downloadVersion):'';
  const [displayChapter,setDisplayChapter]=useState(chapter),[scenario,setScenario]=useState<Record<string,DdReportValue>>({}),[draft,setDraft]=useState<Record<string,DdReportValue>>({}),[calculating,setCalculating]=useState(false),[simulationMessage,setSimulationMessage]=useState('');
  const [savingInputs,setSavingInputs]=useState(false),[saveMessage,setSaveMessage]=useState('');
  const changedInputs=(props.saveInputs??props.inputs??[]).filter(input=>Object.hasOwn(draft,`${input.sheet}!${input.address}`));
  const validDraft=changedInputs.every(input=>Object.is(scenario[`${input.sheet}!${input.address}`],draft[`${input.sheet}!${input.address}`]));
  const [scenarioRestored,setScenarioRestored]=useState(false);
  const [executionWindow,setExecutionWindow]=useState(0);
  const storageKey=`amie-dd-scenario:${slug}:r${revision}`;
  const preview=async(values:Record<string,DdReportValue>,signal?:AbortSignal)=>{
    const r=await fetch(props.reportEndpoint??`/api/dd/${encodeURIComponent(slug)}/report/simulate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,chapter:chapter.slug,values}),signal});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'試算できなかった');return data.chapter as DdReportChapter;
  };
  useEffect(()=>{
    let values:Record<string,DdReportValue>={};
    try{values=JSON.parse(sessionStorage.getItem(storageKey)||'{}');}catch{sessionStorage.removeItem(storageKey);}
    setDraft(values);setScenarioRestored(true);
  },[storageKey,chapter.slug]);
  useEffect(()=>{
    if(!scenarioRestored)return;
    const controller=new AbortController();
    if(!Object.keys(draft).length){setCalculating(false);setDisplayChapter(chapter);setScenario({});sessionStorage.removeItem(storageKey);return()=>controller.abort();}
    sessionStorage.setItem(storageKey,JSON.stringify(draft));setCalculating(true);setSimulationMessage('条件を反映中…');
    const timer=setTimeout(()=>{void preview(draft,controller.signal).then(c=>{if(!controller.signal.aborted){setDisplayChapter(c);setScenario(draft);setSimulationMessage('このブラウザの試算条件をUE・資金繰表にも適用中。');}}).catch(e=>{if(!controller.signal.aborted)setSimulationMessage(e instanceof Error?e.message:'試算できなかった');}).finally(()=>{if(!controller.signal.aborted)setCalculating(false);});},120);
    return()=>{clearTimeout(timer);controller.abort();};
    // A newer selection cancels the previous request; only its own result may replace the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[scenarioRestored,draft,storageKey,chapter.slug]);
  async function saveConditions(keys:string[]){
    if(!props.canSaveInputs||!props.reportEndpoint||!keys.length||calculating||savingInputs)return;
    setSavingInputs(true);setSaveMessage('保存中…');
    try{
      const values=Object.fromEntries(keys.map(key=>[key,draft[key]]));
      const response=await fetch(props.reportEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save-inputs',revision,chapter:chapter.slug,values})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'保存できなかった。');
      const remaining=Object.fromEntries(Object.entries(draft).filter(([key])=>!keys.includes(key)));
      sessionStorage.removeItem(storageKey);if(Object.keys(remaining).length)sessionStorage.setItem(`amie-dd-scenario:${slug}:r${result.revision}`,JSON.stringify(remaining));
      setDraft(remaining);setSaveMessage(result.displayPending?'保存済み。ローカル確認を再起動すると最新版を表示できる。':'計画に保存した。');props.onCommitted?.();router.refresh();
    }catch(error){setSaveMessage(error instanceof Error?error.message:'保存できなかった。');}finally{setSavingInputs(false);}
  }
  function resetScenario(){sessionStorage.removeItem(storageKey);setScenario({});setDraft({});setDisplayChapter(chapter);setSimulationMessage('計画値を表示中。');}

  useEffect(()=>reader.current?installDdGlossaryInteractions(reader.current):undefined,[]);
  const [prepared,setPrepared]=useState(props.pdfReady);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const ordered=orderDdReading(index),position=ordered.findIndex(c=>c.slug===chapter.slug);
  useEffect(()=>{
    if(prepared||!canDownload||exportsPaused)return;
    let cancelled=false,timer:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    async function poll(){
      try {
        const r=await fetch(`/api/dd/${encodeURIComponent(slug)}/report/export?format=pdf&scope=all&status=1&revision=${revision}${versionQuery}`,{cache:'no-store',signal:controller.signal});
        if(r.status===409){router.refresh();return;}
        const data=await r.json();if(r.ok&&data.ready){if(!cancelled)setPrepared(true);return;}
      }catch{if(controller.signal.aborted)return;}
      if(!cancelled)timer=setTimeout(poll,5000);
    }
    timer=setTimeout(poll,3000);return()=>{cancelled=true;controller.abort();clearTimeout(timer);};
  },[prepared,canDownload,exportsPaused,slug,revision,router,versionQuery]);
  async function download(format:'zip'|'xlsx',all=false,href?:string) {
    setBusy(true);setMessage(format==='zip'?'PDFとExcelをまとめてダウンロード中…':'Excelをダウンロード中…');
    try {
      const endpointUrl=new URL(href??`/api/dd/${encodeURIComponent(slug)}/report/export?format=${format}${all?'&scope=all':`&chapter=${chapter.slug}`}`,window.location.origin);
      endpointUrl.searchParams.set('revision',String(downloadRevision));if(downloadVersion)endpointUrl.searchParams.set('version',downloadVersion);
      const endpoint=endpointUrl.pathname+endpointUrl.search;
      const r=await fetch(endpoint,{cache:'no-store'});
      if(!r.ok||r.status===202){const data=await r.json().catch(()=>({}));throw new Error(data.error||'出力できなかった');}
      const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=format==='zip'?ddReportBundleFilename({title:props.title,revision:downloadRevision,document_version:downloadVersion}):ddReportFilename({title:props.title,revision:downloadRevision,document_version:downloadVersion},'xlsx');a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage('出力済み。');
    }catch(error){setMessage(error instanceof Error?error.message:'出力できなかった');}finally{setBusy(false);}
  }
  return <article ref={reader} className="ddr" aria-busy={calculating} data-testid="dd-report-reader" data-chapter={chapter.slug}>
    <style>{DD_REPORT_CSS}</style>
    <header className="ddr-header">
      <div className="ddr-header-top"><div className="ddr-kicker">{company} · {chapter.group_label}</div><div className="ddr-controls">
        {canDownload&&<button disabled={busy||!prepared} onClick={()=>download('zip',true)} title="本文・図解のPDFと表・数式付きExcelをZIPでダウンロード" className="ddr-button">{prepared?(exportsPaused?`配布版 v${downloadVersion} PDF+Excel`:Object.keys(scenario).length?'計画値のPDF+Excel':'PDF+Excel一括ダウンロード'):exportsPaused?'配布版の更新停止中':'PDF更新中…'}</button>}
      </div></div>

      <h1>{chapter.title==='UE'?'UE（ユニットエコノミクス）':chapter.title}</h1>
      {canDownload&&exportsPaused&&<p className="ddr-export-hint">ダウンロード版：v{downloadVersion}（自動更新停止中）。画面の修正は区切りがついてからまとめて反映。</p>}
    </header>
    {message&&<p role="status" className="ddr-message">{message}</p>}
    {((props.inputs?.length??0)>0||Object.keys(scenario).length>0)&&<div className="ddr-simulation-toolbar"><div><strong>試算条件</strong><span> 条件を切り替えると自動計算し、UEと資金繰表にも反映する。</span></div><button className="ddr-button" disabled={savingInputs} onClick={resetScenario}>計画値に戻す</button></div>}
    {changedInputs.length>0&&<section className="ddr-changes" aria-label="変更した試算条件">
      <div className="ddr-simulation-toolbar"><strong>変更した条件 {changedInputs.length}件</strong><div>{props.canSaveInputs&&<button className="ddr-button" disabled={calculating||savingInputs||!validDraft} onClick={()=>void saveConditions(changedInputs.map(input=>`${input.sheet}!${input.address}`))}>全件を計画に保存</button>}<button className="ddr-button" disabled={savingInputs} onClick={resetScenario}>すべて取消</button></div></div>
      <ul style={{listStyle:'none',padding:0,margin:'4px 0'}}>{changedInputs.map(input=>{const key=`${input.sheet}!${input.address}`;return <li key={key} style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',padding:'4px 0',borderBottom:'1px solid #e5e5e7'}}><span style={{flex:'1 1 260px'}}>{input.sheet} · {input.label} <small>({input.address})</small></span><strong>{formatDdReportValue(draft[key],input.format)}</strong>{props.canSaveInputs&&<button className="ddr-button" disabled={calculating||savingInputs||!validDraft} onClick={()=>void saveConditions([key])}>この条件を保存</button>}<button className="ddr-button" disabled={savingInputs} onClick={()=>setDraft(current=>Object.fromEntries(Object.entries(current).filter(([name])=>name!==key)))}>取消</button></li>;})}</ul>
    </section>}
    {saveMessage&&<p role="status" className="ddr-message">{saveMessage}</p>}
    {simulationMessage&&<p className="ddr-simulation-message" role="status">{simulationMessage}</p>}

    <DdReportContent navigation={props.navigation} assetUrls={props.assetUrls} chapter={displayChapter} executionWindow={executionWindow} onExecutionWindowChange={setExecutionWindow} simulationActive={Object.keys(draft).length>0} inputControls={{inputs:props.inputs??[],sheet:chapter.source_sheet,values:{...props.overrides,...draft},disabled:savingInputs,change:(key,value)=>{setDraft(current=>({...current,[key]:value}));}}} slug={slug} index={index} glossary={props.glossary} canDownload={canDownload} revision={revision} onDownloadExcel={href=>{if(!busy)void download('xlsx',true,href);}}/>
    <footer className="ddr-chapter-footer">{position>0?<Link prefetch={false} href={canonicalChapterHref(slug,ordered[position-1].slug,props.navigation)}>← {ordered[position-1].title}</Link>:<span/>}{position<ordered.length-1&&<Link prefetch={false} href={canonicalChapterHref(slug,ordered[position+1].slug,props.navigation)}>{ordered[position+1].title} →</Link>}</footer>
  </article>;
}
