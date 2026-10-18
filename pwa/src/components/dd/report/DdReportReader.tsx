'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import type {DdReportChapter,DdReportChapterSummary,DdReportInput,DdReportValue} from '@/lib/dd-report-types';
import {DdReportContent} from './DdReportContent';
import {DD_REPORT_CSS} from './dd-report-style';

type Props={slug:string;title:string;revision:number;sourceVersion:string;chapter:DdReportChapter;index:DdReportChapterSummary[];canEdit:boolean;canDownload:boolean;inputs:DdReportInput[];overrides:Record<string,DdReportValue>};
export function DdReportReader(props:Props) {
  const {slug,chapter,index,canEdit,canDownload,inputs,sourceVersion,revision}=props,router=useRouter(),company=props.title.split('｜')[0];
  const [panel,setPanel]=useState<'inputs'|'text'|null>(null),[values,setValues]=useState(props.overrides),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState('');
  const [inputSheet,setInputSheet]=useState(inputs.some(i=>i.sheet===chapter.source_sheet)?chapter.source_sheet:'共通前提');
  const [editAddress,setEditAddress]=useState(''),[editValue,setEditValue]=useState('');
  const ordered=[index.find(c=>c.slug==='source-index')!,...index.filter(c=>c.slug!=='source-index')],position=ordered.findIndex(c=>c.slug===chapter.slug);
  const sections=chapter.body.rows.filter(r=>r.cells.length===1&&r.cells[0].heading&&r.row>2);
  const textCells=chapter.body.rows.filter(r=>r.row>2).flatMap(r=>r.cells).filter(c=>typeof c.value==='string'&&!c.formula&&c.span>=5&&!inputs.some(i=>i.sheet===chapter.source_sheet&&i.address===c.address));
  async function save(action:'inputs'|'text') {
    setBusy(true);setMessage('計算と保存を実行中…');
    try {
      const r=await fetch(`/api/dd/${encodeURIComponent(slug)}/report`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='inputs'?{action,revision,values}:{action,revision,chapter:chapter.slug,chapterRevision:chapter.revision,address:editAddress,value:editValue})});
      const result=await r.json();if(!r.ok)throw new Error(result.error||'保存できなかった');
      setMessage(`保存済み。資料版 ${result.revision} に更新済み。`);router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:'保存できなかった');}finally{setBusy(false);}
  }
  async function download(format:'pdf'|'xlsx',all=false) {
    setBusy(true);setMessage(format==='pdf'?'PDFを作成中…':'数式付きExcelを作成中…');
    try {
      const r=await fetch(`/api/dd/${encodeURIComponent(slug)}/report/export?format=${format}${all?'&scope=all':`&chapter=${chapter.slug}`}`,{cache:'no-store'});
      if(!r.ok){const data=await r.json().catch(()=>({}));throw new Error(data.error||'出力できなかった');}
      const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=`${company}_DD_${all?'全資料':chapter.title}_r${revision}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage('出力済み。');
    }catch(error){setMessage(error instanceof Error?error.message:'出力できなかった');}finally{setBusy(false);}
  }
  return <article className="ddr" data-testid="dd-report-reader" data-chapter={chapter.slug}>
    <style>{DD_REPORT_CSS}</style>
    <header className="ddr-header">
      <div className="ddr-header-top"><div className="ddr-kicker">{company} · {chapter.group_label}</div><div className="ddr-controls">
        {canDownload&&<><button disabled={busy} onClick={()=>download('pdf')} className="ddr-button">この資料をPDF</button><button disabled={busy} onClick={()=>download('pdf',true)} className="ddr-button">一括PDF</button><button disabled={busy} onClick={()=>download('xlsx',true)} className="ddr-button ddr-button-primary">数式付きExcel</button></>}
        {canEdit&&<><button className="ddr-button" onClick={()=>setPanel(panel==='inputs'?null:'inputs')} aria-expanded={panel==='inputs'}>計算条件を編集</button><button className="ddr-button" onClick={()=>setPanel(panel==='text'?null:'text')} aria-expanded={panel==='text'}>本文を編集</button></>}
      </div></div>

      <h1>{chapter.title==='UE'?'UE（ユニットエコノミクス）':chapter.title}</h1>
      <div className="ddr-version">資料版 {revision} · 移行元 {sourceVersion} · 全{index.length}資料</div>
    </header>
    {message&&<p role="status" className="ddr-message">{message}</p>}
    {panel==='inputs'&&<section className="ddr-parameter" aria-label="計算条件を編集"><h3>計算条件</h3><p>保存すると、原価・売上・損益・現金残高・持株比率・IRRを同じ計算モデルで更新する。</p>
      <div className="ddr-controls"><label className="ddr-field">対象資料<select value={inputSheet} onChange={e=>setInputSheet(e.target.value)}>{[...new Set(inputs.map(i=>i.sheet))].map(s=><option key={s}>{s}</option>)}</select></label><label className="ddr-field">条件を探す<input type="search" placeholder="人件費、価格、キャップなど" value={filter} onChange={e=>setFilter(e.target.value)}/></label></div>
      <div className="ddr-parameter-grid">{inputs.filter(i=>i.sheet===inputSheet&&(i.label.includes(filter)||i.address.includes(filter))).map(i=>{const key=i.sheet+'!'+i.address,current=values[key]??i.value;return <label key={key} className="ddr-field"><span>{i.label}</span>{i.options?<select value={String(current)} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}>{i.options.map(o=><option key={o}>{o}</option>)}</select>:<input type="number" step="any" value={typeof current==='number'?current:''} onChange={e=>setValues(v=>({...v,[key]:e.target.value===''?null:Number(e.target.value)}))}/>}<small>{i.sheet} · {i.address}{i.format.includes('%')?' · 比率は小数で入力（20%＝0.2）':''}</small></label>;})}</div>
      <div className="ddr-controls" style={{marginTop:16}}><button disabled={busy} className="ddr-button ddr-button-primary" onClick={()=>save('inputs')}>保存して全計画を更新</button><button disabled={busy} className="ddr-button" onClick={()=>setValues({})}>移行時の計算条件に戻す</button></div>
    </section>}
    {panel==='text'&&<section className="ddr-editor"><h3>本文を編集</h3><label className="ddr-field">編集する文章<select value={editAddress} onChange={e=>{setEditAddress(e.target.value);setEditValue(String(textCells.find(c=>c.address===e.target.value)?.value??''));}}><option value="">文章を選択</option>{textCells.map(c=><option value={c.address} key={c.address}>{String(c.value).slice(0,75)}</option>)}</select></label>{editAddress&&<><textarea aria-label="本文" value={editValue} onChange={e=>setEditValue(e.target.value)}/><button className="ddr-button ddr-button-primary" disabled={busy} onClick={()=>save('text')}>本文を保存</button></>}</section>}
    {chapter.slug==='source-index'&&<><p>事業計画とエクイティストーリーで事業全体と成長の道筋を把握し、資本政策・資金繰り・採算を確認する。各資料の説明、図表と計算根拠は、この目録から開ける。</p><div className="ddr-table-scroll"><table><tbody>{ordered.filter(c=>c.slug!=='source-index').map((c,i)=><tr key={c.slug}><td>{String(i+1).padStart(2,'0')}</td><td><Link href={`/dd/${encodeURIComponent(slug)}?chapter=${c.slug}`}>{c.title}</Link></td><td>{c.group_label}</td></tr>)}</tbody></table></div><h2>資料概要と計画の前提</h2></>}
    {sections.length>2&&<nav className="ddr-section-nav" aria-label="この資料の目次">{sections.map(r=><a key={r.row} href={'#section-'+r.row}>{String(r.cells[0].value)}</a>)}</nav>}
    <DdReportContent chapter={chapter} slug={slug} index={index}/>
    <footer className="ddr-chapter-footer">{position>0?<Link href={`/dd/${slug}?chapter=${ordered[position-1].slug}`}>← {ordered[position-1].title}</Link>:<span/>}{position<ordered.length-1&&<Link href={`/dd/${slug}?chapter=${ordered[position+1].slug}`}>{ordered[position+1].title} →</Link>}</footer>
  </article>;
}
