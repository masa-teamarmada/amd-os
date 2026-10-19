'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {orderDdReading,ddReportFilename,ddReportBundleFilename} from '@/lib/dd-report-navigation';
import {useRouter} from 'next/navigation';
import type {DdReportChapter,DdReportChapterSummary,DdReportGlossary,DdReportInput,DdReportValue} from '@/lib/dd-report-types';
import {DdReportContent} from './DdReportContent';
import {DD_REPORT_CSS} from './dd-report-style';
import {installDdGlossaryInteractions} from '@/lib/dd-glossary-interactions';
import type {DdDownloadRelease} from '@/lib/dd-report-download-policy';

type Props={slug:string;title:string;revision:number;sourceVersion:string;documentVersion?:string|null;downloadRelease?:DdDownloadRelease;chapter:DdReportChapter;index:DdReportChapterSummary[];canDownload:boolean;pdfReady:boolean;inputs?:DdReportInput[];overrides?:Record<string,DdReportValue>;glossary?:DdReportGlossary};
export function DdReportReader(props:Props) {
  const {slug,chapter,index,canDownload,revision}=props,router=useRouter(),company=props.title.split('｜')[0];
  const reader=useRef<HTMLElement>(null);
  const downloadRevision=props.downloadRelease?.revision??revision,downloadVersion=props.downloadRelease?.documentVersion??props.documentVersion,exportsPaused=props.downloadRelease?.paused??false;
  const versionQuery=downloadVersion?'&version='+encodeURIComponent(downloadVersion):'';
  const [displayChapter,setDisplayChapter]=useState(chapter),[scenario,setScenario]=useState<Record<string,DdReportValue>>({}),[draft,setDraft]=useState<Record<string,DdReportValue>>({}),[calculating,setCalculating]=useState(false),[simulationMessage,setSimulationMessage]=useState('');
  const [executionWindow,setExecutionWindow]=useState(0);
  const storageKey=`amie-dd-scenario:${slug}:r${revision}`;
  const preview=async(values:Record<string,DdReportValue>,signal?:AbortSignal)=>{
    const r=await fetch(`/api/dd/${encodeURIComponent(slug)}/report/simulate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,chapter:chapter.slug,values}),signal});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'試算できなかった');return data.chapter as DdReportChapter;
  };
  useEffect(()=>{
    const controller=new AbortController();let values:Record<string,DdReportValue>={};
    try{values=JSON.parse(sessionStorage.getItem(storageKey)||'{}');}catch{sessionStorage.removeItem(storageKey);}
    if(Object.keys(values).length){setScenario(values);setDraft(values);setCalculating(true);setSimulationMessage('保存した試算条件で計算中…');
      void preview(values,controller.signal).then(c=>{setDisplayChapter(c);setSimulationMessage('このブラウザの試算条件を適用中。');}).catch(e=>{if(!controller.signal.aborted)setSimulationMessage(e instanceof Error?e.message:'試算できなかった');}).finally(()=>{if(!controller.signal.aborted)setCalculating(false);});}
    return()=>controller.abort();
    // Each chapter/revision mounts a fresh reader. The request uses exactly that chapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[storageKey,chapter.slug]);
  async function applyScenario(){setCalculating(true);setSimulationMessage('試算中…');try{const c=await preview(draft);setDisplayChapter(c);setScenario(draft);sessionStorage.setItem(storageKey,JSON.stringify(draft));setSimulationMessage('このブラウザの試算条件をUE・資金繰表にも適用。');}catch(e){setSimulationMessage(e instanceof Error?e.message:'試算できなかった');}finally{setCalculating(false);}}
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
  return <article ref={reader} className="ddr" data-testid="dd-report-reader" data-chapter={chapter.slug}>
    <style>{DD_REPORT_CSS}</style>
    <header className="ddr-header">
      <div className="ddr-header-top"><div className="ddr-kicker">{company} · {chapter.group_label}</div><div className="ddr-controls">
        {canDownload&&<button disabled={busy||!prepared} onClick={()=>download('zip',true)} title="本文・図解のPDFと表・数式付きExcelをZIPでダウンロード" className="ddr-button">{prepared?(exportsPaused?`配布版 v${downloadVersion} PDF+Excel`:Object.keys(scenario).length?'計画値のPDF+Excel':'PDF+Excel一括ダウンロード'):exportsPaused?'配布版の更新停止中':'PDF更新中…'}</button>}
      </div></div>

      <h1>{chapter.title==='UE'?'UE（ユニットエコノミクス）':chapter.title}</h1>
      {canDownload&&exportsPaused&&<p className="ddr-export-hint">ダウンロード版：v{downloadVersion}（自動更新停止中）。画面の修正は区切りがついてからまとめて反映。</p>}
    </header>
    {message&&<p role="status" className="ddr-message">{message}</p>}
    {((props.inputs?.length??0)>0||Object.keys(scenario).length>0)&&<div className="ddr-simulation-toolbar"><div><strong>試算条件</strong><span> 表の選択肢・数値を変更し、UEと資金繰表への影響を確認できる。</span></div><div>{(props.inputs?.length??0)>0&&<button className="ddr-button ddr-button-primary" disabled={calculating} onClick={()=>void applyScenario()}>{calculating?'試算中…':'この条件で試算'}</button>}<button className="ddr-button" disabled={calculating} onClick={resetScenario}>計画値に戻す</button></div></div>}
    {simulationMessage&&<p className="ddr-simulation-message" role="status">{simulationMessage}</p>}

    <DdReportContent chapter={displayChapter} executionWindow={executionWindow} onExecutionWindowChange={setExecutionWindow} simulationActive={Object.keys(scenario).length>0} inputControls={{inputs:props.inputs??[],sheet:chapter.source_sheet,values:{...props.overrides,...draft},disabled:calculating,change:(key,value)=>{setDraft(current=>({...current,[key]:value}));setSimulationMessage('条件を変更中。「この条件で試算」で結果を更新する。');}}} slug={slug} index={index} glossary={props.glossary} canDownload={canDownload} revision={revision} onDownloadExcel={href=>{if(!busy)void download('xlsx',true,href);}}/>
    <footer className="ddr-chapter-footer">{position>0?<Link href={`/dd/${slug}?chapter=${ordered[position-1].slug}`}>← {ordered[position-1].title}</Link>:<span/>}{position<ordered.length-1&&<Link href={`/dd/${slug}?chapter=${ordered[position+1].slug}`}>{ordered[position+1].title} →</Link>}</footer>
  </article>;
}
