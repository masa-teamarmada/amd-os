'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import type {DdReportChapter,DdReportChapterSummary,DdReportGlossary} from '@/lib/dd-report-types';
import {DdReportContent} from './DdReportContent';
import {DD_REPORT_CSS} from './dd-report-style';
import {installDdGlossaryInteractions} from '@/lib/dd-glossary-interactions';

type Props={slug:string;title:string;revision:number;sourceVersion:string;chapter:DdReportChapter;index:DdReportChapterSummary[];canDownload:boolean;pdfReady:boolean;glossary?:DdReportGlossary};
export function DdReportReader(props:Props) {
  const {slug,chapter,index,canDownload,sourceVersion,revision}=props,router=useRouter(),company=props.title.split('｜')[0];
  const reader=useRef<HTMLElement>(null);
  useEffect(()=>reader.current?installDdGlossaryInteractions(reader.current):undefined,[]);
  const [prepared,setPrepared]=useState(props.pdfReady);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const ordered=[index.find(c=>c.slug==='source-index')!,...index.filter(c=>c.slug!=='source-index'&&c.slug!=='assumptions'),...index.filter(c=>c.slug==='assumptions')],position=ordered.findIndex(c=>c.slug===chapter.slug);
  const sections=chapter.body.rows.filter(r=>r.cells.length===1&&r.cells[0].heading&&r.row>2);
  useEffect(()=>{
    if(prepared||!canDownload)return;
    let cancelled=false,timer:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    async function poll(){
      try {
        const r=await fetch(`/api/dd/${encodeURIComponent(slug)}/report/export?format=pdf&scope=all&status=1&revision=${revision}`,{cache:'no-store',signal:controller.signal});
        if(r.status===409){router.refresh();return;}
        const data=await r.json();if(r.ok&&data.ready){if(!cancelled)setPrepared(true);return;}
      }catch{if(controller.signal.aborted)return;}
      if(!cancelled)timer=setTimeout(poll,5000);
    }
    timer=setTimeout(poll,3000);return()=>{cancelled=true;controller.abort();clearTimeout(timer);};
  },[prepared,canDownload,slug,revision,router]);
  async function download(format:'zip'|'xlsx',all=false,href?:string) {
    setBusy(true);setMessage(format==='zip'?'PDFとExcelをまとめてダウンロード中…':'Excelをダウンロード中…');
    try {
      const endpoint=href??`/api/dd/${encodeURIComponent(slug)}/report/export?format=${format}&revision=${revision}${all?'&scope=all':`&chapter=${chapter.slug}`}`;
      const r=await fetch(endpoint,{cache:'no-store'});
      if(!r.ok||r.status===202){const data=await r.json().catch(()=>({}));throw new Error(data.error||'出力できなかった');}
      const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=`${company}_DD_${format==='zip'?'PDF+Excel':'数値計画・一覧表'}_r${revision}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage('出力済み。');
    }catch(error){setMessage(error instanceof Error?error.message:'出力できなかった');}finally{setBusy(false);}
  }
  return <article ref={reader} className="ddr" data-testid="dd-report-reader" data-chapter={chapter.slug}>
    <style>{DD_REPORT_CSS}</style>
    <header className="ddr-header">
      <div className="ddr-header-top"><div className="ddr-kicker">{company} · {chapter.group_label}</div><div className="ddr-controls">
        {canDownload&&<button disabled={busy||!prepared} onClick={()=>download('zip',true)} title="本文・図解のPDFと表・数式付きExcelをZIPでダウンロード" className="ddr-button">{prepared?'PDF+excel一括ダウンロード':'PDF更新中…'}</button>}
      </div></div>

      <h1>{chapter.title==='UE'?'UE（ユニットエコノミクス）':chapter.title}</h1>
      <div className="ddr-version">資料版 {revision} · 移行元 {sourceVersion} · 全{index.length}資料{Object.keys(props.glossary??{}).length>0&&<span className="ddr-term-hint">点線の用語にマウスを重ねるか、タップすると説明を表示</span>}</div>
    </header>
    <p className="ddr-export-hint">PDFとExcelをZIPで一括保存。事業説明・図解・経歴はPDF、数値計画・原価試算・一覧表はExcelで開く。</p>
    {message&&<p role="status" className="ddr-message">{message}</p>}
    {chapter.slug!=='source-index'&&sections.length>2&&<nav className="ddr-section-nav" aria-label="この資料の目次">{sections.map(r=><a key={r.row} href={'#section-'+r.row}>{String(r.cells[0].value)}</a>)}</nav>}
    <DdReportContent chapter={chapter} slug={slug} index={index} glossary={props.glossary} canDownload={canDownload} revision={revision} onDownloadExcel={href=>{if(!busy)void download('xlsx',true,href);}}/>
    <footer className="ddr-chapter-footer">{position>0?<Link href={`/dd/${slug}?chapter=${ordered[position-1].slug}`}>← {ordered[position-1].title}</Link>:<span/>}{position<ordered.length-1&&<Link href={`/dd/${slug}?chapter=${ordered[position+1].slug}`}>{ordered[position+1].title} →</Link>}</footer>
  </article>;
}
