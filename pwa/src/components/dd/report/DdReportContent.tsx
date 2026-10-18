import type {ReactNode} from 'react';
import {DdReportVisual} from './DdReportVisual';
import {DdReportRichText} from './DdReportRichText';
import {DdReportDirectory} from './DdReportDirectory';
import type {DdReportCell,DdReportChapter,DdReportChapterSummary,DdReportChart,DdReportRow,DdReportGlossary} from '@/lib/dd-report-types';
import {formatDdReportValue} from '@/lib/dd-report-format';
import {ddPdfMarker} from '@/lib/dd-report-navigation';

const palette=['#147d92','#193d52','#48a49a','#c99745','#6985aa','#a7b7bf','#566a66','#aa7171'];
export function ddReportHref(slug:string,sheet:string,index:DdReportChapterSummary[],address?:string) {
  const chapter=index.find(c=>c.source_sheet===sheet);return chapter?`/dd/${encodeURIComponent(slug)}?chapter=${chapter.slug}${address?'#cell-'+address:''}`:null;
}
function resolveLink(link:string|undefined,slug:string,index:DdReportChapterSummary[]) {
  if(!link)return null;if(/^https?:\/\//i.test(link))return link;
  const m=/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)/.exec(link);return m?ddReportHref(slug,m[1],index,m[2]+m[3]):null;
}
function CellValue({cell,slug,index,glossary,allRows,emphasize=false,chapterSlug}:{cell:DdReportCell;slug:string;index:DdReportChapterSummary[];glossary?:DdReportGlossary;allRows?:boolean;emphasize?:boolean;chapterSlug?:string}) {
  const text=formatDdReportValue(cell.value,cell.format),href=resolveLink(cell.link,slug,index);
  const target=href?.startsWith('/dd/')?index.find(c=>new URL(href,'https://amd-os-pwa.vercel.app').searchParams.get('chapter')===c.slug):null;
  const content=<DdReportRichText text={text} id={cell.address} slug={slug} glossary={glossary} interactive={!allRows} emphasize={emphasize}/>;
  return <span id={`cell-${cell.address}`}>{allRows&&chapterSlug&&<a className="ddr-pdf-anchor" href={ddPdfMarker(slug,chapterSlug,cell.address)} aria-hidden="true">.</a>}{href?<>{content} <a href={href}>{target?`「${target.title==='UE'?'UE（ユニットエコノミクス）':target.title}」`:'出典'} ↗</a></>:content}</span>;
}
export function DdReportChartFigure({chart}:{chart:DdReportChart}) {
  const series=chart.series.filter(s=>s.values.length),labels=series.find(s=>s.categories.length)?.categories??[];
  if(!series.length)return null;
  const count=Math.max(...series.map(s=>s.values.length)),width=1000,height=chart.horizontal?Math.min(320,100+count*38):320,pad={l:90,r:24,t:24,b:72},w=width-pad.l-pad.r,h=height-pad.t-pad.b;
  const sums=Array.from({length:count},(_,i)=>series.reduce((n,s)=>n+Math.max(0,s.values[i]??0),0));
  const ns=series.flatMap(s=>s.values).filter(Number.isFinite),high=Math.max(1,...ns,...(chart.stacked?sums:[])),low=Math.min(0,...ns),range=(high-low)*1.08;
  const y=(n:number)=>pad.t+(high+(high-low)*.04-n)/range*h;
  const line=chart.chartType==='lineChart'||chart.chartType==='scatterChart';
  const axisNumber=(n:number)=>formatDdReportValue(n,chart.numberFormat??'General');
  const shownLabels=Array.from({length:count},(_,i)=>i).filter(i=>count<=12||i%Math.ceil(count/10)===0||i===count-1);
  return <figure className="ddr-chart">
    <figcaption>{chart.title||'計画の推移'}</figcaption>
    <div className="ddr-chart-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title||'計画の推移'}>
      {Array.from({length:5},(_,i)=>{const n=low+(high-low)*i/4;return chart.horizontal?<g key={i}><line x1={pad.l+i*w/4} x2={pad.l+i*w/4} y1={pad.t} y2={height-pad.b} stroke="#dce5e8"/><text x={pad.l+i*w/4} y={height-32} textAnchor="middle" fontSize="14" fill="#425966">{axisNumber(n)}</text></g>:<g key={i}><line x1={pad.l} x2={width-pad.r} y1={y(n)} y2={y(n)} stroke="#dce5e8"/><text x={pad.l-12} y={y(n)+5} textAnchor="end" fontSize="14" fill="#425966">{axisNumber(n)}</text></g>;})}
      {line?series.map((s,j)=><polyline key={j} fill="none" stroke={palette[j%palette.length]} strokeWidth="3" points={s.values.map((v,i)=>`${pad.l+(i/(count-1||1))*w},${y(v)}`).join(' ')}/>):chart.horizontal?series.map((s,j)=><g key={j}>{s.values.map((v,i)=>{
        const start=chart.stacked?series.slice(0,j).reduce((n,p)=>n+(p.values[i]??0),0):0;
        const barH=Math.min(64,h/count/(chart.stacked?1:series.length)*.72),yy=pad.t+(i+.5)*h/count+(chart.stacked?0:(j-(series.length-1)/2)*barH);
        return <rect key={i} x={pad.l+start/(high||1)*w} y={yy-barH/2} width={Math.max(0,v/(high||1)*w)} height={barH} fill={palette[j%palette.length]}/>;
      })}</g>):series.map((s,j)=><g key={j}>{s.values.map((v,i)=>{
        const start=chart.stacked?series.slice(0,j).reduce((n,p)=>n+(p.values[i]??0),0):0;
        const barW=w/count/(chart.stacked?1:series.length)*.72;
        const xx=pad.l+(i+.5)*w/count+(chart.stacked?0:(j-(series.length-1)/2)*barW);
        return <rect key={i} x={xx-barW/2} y={y(Math.max(start+v,start))} width={Math.max(.7,barW)} height={Math.max(.7,Math.abs(y(start+v)-y(start)))} fill={palette[j%palette.length]}/>;
      })}</g>)}
      {chart.horizontal?shownLabels.map(i=><text key={i} x={pad.l-12} y={pad.t+(i+.5)*h/count+5} textAnchor="end" fontSize="12">{labels[i]||i+1}</text>):shownLabels.map(i=><text key={i} x={pad.l+(line?i/(count-1||1):(i+.5)/count)*w} y={height-32} textAnchor="middle" fontSize="13" fill="#425966">{labels[i]||i+1}</text>)}
    </svg></div>
    <div className="ddr-legend">{series.map((s,i)=><span key={i}><i style={{background:palette[i%palette.length]}}/>{s.name||`系列${i+1}`}</span>)}</div>
  </figure>;
}

type ContentProps={chapter:DdReportChapter;slug:string;index:DdReportChapterSummary[];assetUrls?:Record<string,string>;allRows?:boolean;glossary?:DdReportGlossary;canDownload?:boolean;revision?:number;pdfWorkbookName?:string;onDownloadExcel?:(href:string)=>void};
function ReportTable({rows,slug,index,allRows,glossary,pageScroll=false,chapterSlug}:{rows:DdReportRow[];slug:string;index:DdReportChapterSummary[];allRows?:boolean;glossary?:DdReportGlossary;pageScroll?:boolean;chapterSlug?:string}) {
  const maxColumns=Math.max(...rows.map(r=>r.cells.length));
  const columns=[...new Set(rows.flatMap(r=>r.cells.map(c=>c.column)))].sort((a,b)=>a-b);
  const weights=columns.map(col=>Math.sqrt(Math.max(8,...rows.flatMap(r=>r.cells.filter(c=>c.column===col).map(c=>Math.min(120,String(c.value??'').length)/Math.max(1,columns.filter(p=>p>=c.column&&p<c.column+c.span).length))))));
  const compact=chapterSlug==='financial-plan'||chapterSlug==='capital-plan';
  const table=<div className={`ddr-table-scroll ${maxColumns>16?'ddr-wide':''} ${compact?'ddr-financial-table':''} ${pageScroll?'ddr-table-page-scroll':''}`} tabIndex={0} aria-label="資料の表"><table>{allRows&&<colgroup>{weights.map((w,i)=><col key={i} style={{width:(100*w/weights.reduce((a,b)=>a+b,0))+'%'}}/>)}</colgroup>}<tbody>{rows.map((r,i)=>{
    const header=r.cells.every(c=>c.heading)||(i===0&&(maxColumns>16||r.cells.every(c=>typeof c.value==='string'&&c.value.length<90)));
    const cells:ReactNode[]=[];let next=0;
    for(const c of r.cells){const start=columns.indexOf(c.column);while(next<start){cells.push(<td key={'blank-'+next}/>);next++;}const span=Math.max(1,columns.filter(col=>col>=c.column&&col<c.column+c.span).length);const Tag=header?'th':'td';cells.push(<Tag scope={header?'col':undefined} colSpan={span} key={c.address} className={typeof c.value==='number'?'ddr-number':c.value==='成立'?'ddr-positive':c.value==='不成立'?'ddr-negative':''}><CellValue cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapterSlug}/></Tag>);next=start+span;}
    return <tr key={r.row} data-source-row={r.row} className={header?'ddr-table-head':''}>{cells}</tr>;
  })}</tbody></table></div>;
  return !allRows&&!compact&&rows.length>30?<details className="ddr-detail"><summary>明細を表示 · {rows.length}行</summary>{table}</details>:table;
}
function Organization({chapter}:{chapter:DdReportChapter}) {
  const cells=new Map(chapter.body.rows.flatMap(r=>r.cells).map(c=>[c.address,String(c.value)]));
  const node=(a:string,cls='')=><div className={`ddr-org-node ${cls}`}>{cells.get(a)}</div>;
  return <div className="ddr-org-scroll"><div className="ddr-org">
    <div className="ddr-org-trunk">{node('M6')}{node('M11','ddr-org-ceo')}</div>
    <div className="ddr-org-branches">
      <section>{node('E19','ddr-org-lead')}<div className="ddr-org-stem"/><div className="ddr-org-dept"><h3>{cells.get('C27')}</h3>{['D31','D35','D39','D43'].map(a=><div key={a}>{node(a)}</div>)}</div></section>
      <section>{node('V19','ddr-org-lead')}<div className="ddr-org-stem"><div className="ddr-org-advisor">{cells.get('AE23')}</div></div><div className="ddr-org-dept"><h3>{cells.get('R27')}</h3>{['T31','T35','T39'].map(a=><div key={a}>{node(a)}</div>)}</div></section>
    </div><p>{cells.get('B50')}</p>
  </div></div>;
}
function EquityDiagram({chapter,slug,index,glossary,allRows}:ContentProps) {
  const cells=new Map(chapter.body.rows.flatMap(r=>r.cells).map(c=>[c.address,c]));
  const phases=[['B',13,15,19,22,26],['G',13,15,19,22,26],['L',13,15,19,22,26],['L',32,34,38,41,45],['G',32,34,38,41,45],['B',32,34,38,41,45]] as const;
  return <><div className="ddr-equity-flow">{phases.map(([col,...rs],i)=><section key={col+rs[0]} className="ddr-phase">
    {rs.map((r,j)=>{const cell=cells.get(col+r);return cell?j===0?<h3 key={r}><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug}/></h3>:<div key={r} className={j===2?'ddr-phase-funding':''}><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug}/></div>:null;})}
    {i<5&&<span className="ddr-flow-arrow" aria-hidden="true">→</span>}
  </section>)}</div><div className="ddr-equity-notes">{["B29","K29","B49","K49"].map(a=>{const cell=cells.get(a);return cell?<p key={a}><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug}/></p>:null;})}</div></>;
}
/** Source cells become prose, comparisons, diagrams and charts. Whitespace-only rows disappear. */
export function DdReportContent(props:ContentProps) {
  const {chapter,slug,index,assetUrls,allRows,glossary,canDownload,revision,pdfWorkbookName,onDownloadExcel}=props,body=chapter.body;
  const excelHref=allRows&&pdfWorkbookName?encodeURI(pdfWorkbookName):`/api/dd/${encodeURIComponent(slug)}/report/export?format=xlsx&scope=all&sheet=${encodeURIComponent(chapter.source_sheet)}${revision?`&revision=${revision}`:""}`;
  let tableNoticeShown=false,tableCount=0;
  if(chapter.slug==='organization')return <Organization chapter={chapter}/>;
  const objects=[...body.objects].sort((a,b)=>a.row-b.row),blocks:ReactNode[]=[];let tableRows:DdReportRow[]=[];let objectIndex=0;
  const primary:Record<string,{address:string;label:string;unit:string}>={
    'cyanobacteria-cost':{address:'E20',label:'出荷する菌体1kgの原価',unit:'円/kg-DCW'},
    'reactor-cost':{address:'E20',label:'SOLの廃液処理直接原価',unit:'円/m³'},
    'metal-cost':{address:'E24',label:'精製・出荷まで含む販売金属の原価',unit:'円/kg金属'},
    'fame-cost':{address:'E20',label:'FAME 1Lの総原価',unit:'円/L'},
  };
  const metric=primary[chapter.slug],result=metric?body.rows.flatMap(r=>r.cells).find(c=>c.address===metric.address):null;
  if(metric&&result)blocks.push(<div className="ddr-primary-result" key="primary-result"><div>{metric.label}</div><strong>{typeof result.value==='number'?result.value.toLocaleString('ja-JP',{maximumFractionDigits:1}):String(result.value)}</strong><span>{metric.unit}</span></div>);
  const flush=()=>{if(!tableRows.length)return;
    const pageScroll=chapter.slug==='assumptions'&&tableCount===0;tableCount++;
    if(allRows&&body.excel?.mode!=='pdf'){if(!tableNoticeShown){blocks.push(<p className="ddr-table-export-note" key="excel-note"><a className="ddr-pdf-anchor" href={ddPdfMarker(slug,chapter.slug)+'#excel-tables'} aria-hidden="true">.</a>表・計算条件は同梱Excelの「{chapter.source_sheet}」シートに収録。 <a href={excelHref}>{pdfWorkbookName?"同梱Excelを開く":"表をExcelでダウンロード"} ↗</a></p>);tableNoticeShown=true;}}
    else blocks.push(<div className="ddr-table-block" key={'table-'+tableRows[0].row}>{canDownload&&body.excel?.mode!=='pdf'&&<div className="ddr-table-tools"><a href={excelHref} download onClick={onDownloadExcel?event=>{event.preventDefault();onDownloadExcel(excelHref);}:undefined}>表をExcelでダウンロード ↗</a></div>}<ReportTable rows={tableRows} slug={slug} index={index} allRows={allRows} glossary={glossary} pageScroll={pageScroll} chapterSlug={chapter.slug}/></div>);
    tableRows=[];
  };
  const addObjects=(row:number)=>{while(objectIndex<objects.length&&objects[objectIndex].row<=row){flush();const o=objects[objectIndex++];blocks.push(o.kind==='chart'?<DdReportChartFigure key={'object-'+objectIndex} chart={o}/>:<figure className="ddr-image" key={'object-'+objectIndex}>{/* Original approved workbook figures retain their pixels. */}<img loading={allRows?'eager':'lazy'} src={assetUrls?.[o.assetKey]??`/api/dd/${encodeURIComponent(slug)}/report/assets/${o.assetKey}`} alt={o.caption||`${chapter.title}の図解`} />{o.caption&&<figcaption>{o.caption}</figcaption>}</figure>);}};
  if(chapter.slug==='source-index')blocks.push(<DdReportDirectory key="directory" index={index} rows={body.rows} slug={slug}/>,<h2 key="overview">事業と資金計画の概要</h2>);
  for(const row of body.rows){
    if(row.row<=2||(chapter.slug==='source-index'&&(row.row<=6||(row.row>=21&&row.row<=62))))continue;
    addObjects(row.row);
    if(row.calculationDetail){tableRows.push(row);continue;}
    if(chapter.slug==='equity-story'&&row.row>=12&&row.row<=50){if(row.row===12){flush();blocks.push(<EquityDiagram key="equity-diagram" {...props}/>);}continue;}
    const head=row.cells.length===1&&row.cells[0].heading;
    const prose=!row.exportTable&&row.cells.length===1&&typeof row.cells[0].value==='string'&&row.cells[0].span>=5;
    const numbered=prose&&String(row.cells[0].value).split('\n');
    if(numbered&&numbered.length>1&&numbered.slice(1).every(line=>/^[①-⑩] .+｜.+/.test(line))){flush();const cell=row.cells[0];blocks.push(<div key={row.row} id={'cell-'+cell.address}><p><DdReportRichText text={numbered[0]} id={cell.address+'-intro'} slug={slug} glossary={glossary} interactive={!allRows} emphasize/></p><ol className="ddr-business-list">{numbered.slice(1).map((line,i)=>{const [name,...description]=line.split('｜');return <li key={i}><strong>{name}</strong><span><DdReportRichText text={description.join('｜')} id={cell.address+'-'+i} slug={slug} glossary={glossary} interactive={!allRows}/></span></li>;})}</ol></div>);continue;}
    if(head||prose){flush();const cell=row.cells[0];blocks.push(head?<h2 aria-label={String(cell.value)} key={row.row} id={'section-'+row.row}><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug}/></h2>:<p key={row.row} className={cell.value&&String(cell.value).length<80?'ddr-intro':''}><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug}/></p>);}
    else {if(allRows&&tableRows.length){const positions=new Set([...tableRows.flatMap(r=>r.cells.map(c=>c.column)),...row.cells.map(c=>c.column)]);if(positions.size>Math.max(row.cells.length,...tableRows.map(r=>r.cells.length))*1.25)flush();}tableRows.push(row);}
    for(const visual of body.visuals?.filter(v=>v.afterRow===row.row)??[]){flush();blocks.push(<DdReportVisual key={'visual-'+visual.afterRow} visual={visual} slug={slug} glossary={glossary} allRows={allRows}/>);}
  }
  flush();addObjects(Infinity);
  return <div className="ddr-content">{blocks}</div>;
}
