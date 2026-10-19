import {Fragment,type ReactNode} from 'react';
import {DdReportInputValue,type DdSimulationControls} from './DdReportSimulation';
import {DdBiographies} from './DdBiographies';
import {DdReportSectionIcon} from './DdReportSectionIcon';
import {DdSourceFlow,DdSourceGantt,DdUeProcess,isDdGantt} from './DdSourceDiagrams';
import {DdJkissExplanation} from './DdJkissExplanation';
import {DdReportVisual} from './DdReportVisual';
import {DdReportRichText} from './DdReportRichText';
import {DdReportDirectory} from './DdReportDirectory';
import {DdCapitalFundingFigure,DdInvestorReturnNote} from './DdCapitalFundingFigure';
import {DdExecutionGantt,DdDevelopmentRoadmap} from './DdExecutionGantt';
import {DdDevelopmentDependencies} from './DdReportCompleteness';
import {DD_REPORT_INTRODUCTIONS} from '@/lib/dd-report-introductions';
import {ddDevelopmentTarget} from '@/lib/dd-report-development-plans';
import {ddExecutionTasks} from '@/lib/dd-report-execution-plan';
import type {DdReportCell,DdReportChapter,DdReportChapterSummary,DdReportChart,DdReportRow,DdReportGlossary} from '@/lib/dd-report-types';
import {formatDdReportValue} from '@/lib/dd-report-format';
import {ddPdfMarker} from '@/lib/dd-report-navigation';

const palette=['#147d92','#193d52','#48a49a','#c99745','#6985aa','#a7b7bf','#566a66','#aa7171'];
export function ddReportHref(slug:string,sheet:string,index:DdReportChapterSummary[],address?:string) {
  const chapter=index.find(c=>c.source_sheet===sheet&&(sheet!=='計画詳細'||c.slug===ddDevelopmentTarget(address)))??index.find(c=>c.source_sheet===sheet);return chapter?`/dd/${encodeURIComponent(slug)}?chapter=${chapter.slug}${address?'#cell-'+address:''}`:null;
}
function resolveLink(link:string|undefined,slug:string,index:DdReportChapterSummary[]) {
  if(!link)return null;if(/^https?:\/\//i.test(link))return link;
  const m=/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)/.exec(link);return m?ddReportHref(slug,m[1],index,m[2]+m[3]):null;
}
function CellValue({cell,slug,index,glossary,allRows,emphasize=false,chapterSlug,inputControls}:{cell:DdReportCell;slug:string;index:DdReportChapterSummary[];glossary?:DdReportGlossary;allRows?:boolean;emphasize?:boolean;chapterSlug?:string;inputControls?:DdSimulationControls}) {
  const displayCell=chapterSlug==='capital-plan'&&['B177','F177','N177','R177'].includes(cell.address)&&typeof cell.value==='number'?{...cell,value:cell.value/1e8,format:'0.00"億円"'}:cell;
  const text=formatDdReportValue(displayCell.value,displayCell.format),href=resolveLink(cell.link,slug,index);
  const target=href?.startsWith('/dd/')?index.find(c=>new URL(href,'https://amd-os-pwa.vercel.app').searchParams.get('chapter')===c.slug):null;
  const content=<DdReportRichText text={text} id={cell.address} slug={slug} glossary={glossary} interactive={!allRows} emphasize={emphasize}/>;
  return <span id={`cell-${cell.address}`}>{allRows&&chapterSlug&&<a className="ddr-pdf-anchor" href={ddPdfMarker(slug,chapterSlug,cell.address)} aria-hidden="true">.</a>}{href?<>{content} <a href={href}>{target?`「${target.title==='UE'?'UE（ユニットエコノミクス）':target.title}」`:'出典'} ↗</a></>:allRows?content:<DdReportInputValue address={cell.address} controls={inputControls}>{content}</DdReportInputValue>}</span>;
}
export function DdReportChartFigure({chart}:{chart:DdReportChart}) {
  const series=chart.series.filter(s=>s.values.length),labels=series.find(s=>s.categories.length)?.categories??[];
  if(!series.length)return null;
  const count=Math.max(...series.map(s=>s.values.length)),width=count>36?1200:count>12?960:count<=6?640:760,height=chart.horizontal?Math.min(280,110+count*28):260,pad={l:90,r:24,t:24,b:72},w=width-pad.l-pad.r,h=height-pad.t-pad.b;
  const sums=Array.from({length:count},(_,i)=>series.reduce((n,s)=>n+Math.max(0,s.values[i]??0),0));
  const ns=series.flatMap(s=>s.values).filter(Number.isFinite),high=Math.max(1,...ns,...(chart.stacked?sums:[])),low=Math.min(0,...ns),range=(high-low)*1.08;
  const y=(n:number)=>pad.t+(high+(high-low)*.04-n)/range*h;
  const line=chart.chartType==='lineChart'||chart.chartType==='scatterChart';
  const axisNumber=(n:number)=>formatDdReportValue(n,chart.numberFormat??'General');
  const shownLabels=Array.from({length:count},(_,i)=>i).filter(i=>count<=12||i%Math.ceil(count/10)===0||i===count-1);
  return <figure className="ddr-chart" style={{maxWidth:width+22}}>
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
      {chart.horizontal?shownLabels.map(i=><text key={i} x={pad.l-12} y={pad.t+(i+.5)*h/count+5} textAnchor="end" fontSize="12">{String(labels[i]||i+1).replace(/^(20\d{2})\.0$/,'$1')}</text>):shownLabels.map(i=><text key={i} x={pad.l+(line?i/(count-1||1):(i+.5)/count)*w} y={height-32} textAnchor="middle" fontSize="13" fill="#425966">{String(labels[i]||i+1).replace(/^(20\d{2})\.0$/,'$1')}</text>)}
    </svg></div>
    <div className="ddr-legend">{series.map((s,i)=><span key={i}><i style={{background:palette[i%palette.length]}}/>{s.name||`系列${i+1}`}</span>)}</div>
  </figure>;
}

type ContentProps={chapter:DdReportChapter;slug:string;index:DdReportChapterSummary[];assetUrls?:Record<string,string>;allRows?:boolean;glossary?:DdReportGlossary;canDownload?:boolean;revision?:number;pdfWorkbookName?:string;onDownloadExcel?:(href:string)=>void;inputControls?:DdSimulationControls;simulationActive?:boolean;executionWindow?:number;onExecutionWindowChange?:(index:number)=>void};
function ReportTable({rows,slug,index,allRows,glossary,pageScroll=false,chapterSlug,inputControls}:{rows:DdReportRow[];slug:string;index:DdReportChapterSummary[];allRows?:boolean;glossary?:DdReportGlossary;pageScroll?:boolean;chapterSlug?:string;inputControls?:DdSimulationControls}) {
  if(isDdGantt(rows))return <DdSourceGantt rows={rows} cell={c=><CellValue cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapterSlug} inputControls={inputControls}/>}/>;
  if(!allRows&&chapterSlug?.endsWith('-cost')){
    const noteColumns=[...new Set(rows.flatMap(r=>r.cells.filter(c=>c.column>r.cells[0].column&&typeof c.value==='string'&&c.value.length>150).map(c=>c.column)))].filter(col=>rows.every(r=>r.cells.filter(c=>c.column===col).every(c=>typeof c.value==='string'&&!inputControls?.inputs.some(i=>i.address===c.address))));
    if(noteColumns.length){
      const notes=rows.map(r=>({row:r,cells:r.cells.filter(c=>noteColumns.includes(c.column))})).filter(n=>n.cells.length),grid=rows.map(r=>({...r,cells:r.cells.filter(c=>!noteColumns.includes(c.column))}));
      const value=(c:DdReportCell)=><CellValue cell={c} slug={slug} index={index} glossary={glossary} chapterSlug={chapterSlug} inputControls={inputControls}/>;
      return <div className="ddr-cost-detail"><ReportTable rows={grid} slug={slug} index={index} glossary={glossary} pageScroll={pageScroll} chapterSlug={chapterSlug} inputControls={inputControls}/><section className="ddr-cost-notes" aria-label="条件・費目ごとの根拠全文"><h3>条件・費目ごとの根拠</h3>{notes.map(({row:r,cells})=><div className="ddr-cost-note" key={r.row}><a href={'#cell-'+r.cells[0].address}>{String(r.cells[0].value)} ↑</a><div>{cells.map(c=><p key={c.address}>{value(c)}</p>)}</div></div>)}</section></div>;
    }
  }
  const maxColumns=Math.max(...rows.map(r=>r.cells.length));
  const columns=[...new Set(rows.flatMap(r=>r.cells.map(c=>c.column)))].sort((a,b)=>a-b);
  const weights=columns.map(col=>Math.sqrt(Math.max(8,...rows.flatMap(r=>r.cells.filter(c=>c.column===col).map(c=>Math.min(120,String(c.value??'').length)/Math.max(1,columns.filter(p=>p>=c.column&&p<c.column+c.span).length))))));
  const compact=chapterSlug==='financial-plan'||chapterSlug==='capital-plan';
  const table=<div className={`ddr-table-scroll ${maxColumns>16?'ddr-wide':''} ${compact?'ddr-financial-table':''} ${pageScroll?'ddr-table-page-scroll':''}`} tabIndex={0} aria-label="資料の表"><table>{allRows&&<colgroup>{weights.map((w,i)=><col key={i} style={{width:(100*w/weights.reduce((a,b)=>a+b,0))+'%'}}/>)}</colgroup>}<tbody>{rows.map((r,i)=>{
    const header=r.cells.every(c=>c.heading)||(i===0&&!r.cells.some(c=>inputControls?.inputs.some(i=>i.address===c.address))&&(maxColumns>16||r.cells.every(c=>typeof c.value==='string'&&c.value.length<90)));
    const cells:ReactNode[]=[];let next=0;
    for(const c of r.cells){const start=columns.indexOf(c.column);while(next<start){cells.push(<td key={'blank-'+next}/>);next++;}const span=Math.max(1,columns.filter(col=>col>=c.column&&col<c.column+c.span).length);const Tag=header?'th':'td';cells.push(<Tag scope={header?'col':undefined} colSpan={span} key={c.address} className={typeof c.value==='number'?'ddr-number':c.value==='成立'?'ddr-positive':c.value==='不成立'?'ddr-negative':''}><CellValue cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapterSlug} inputControls={inputControls}/></Tag>);next=start+span;}
    if(!allRows&&chapterSlug?.endsWith('-cost'))while(next<columns.length){const col=columns[next],unitLabel=header&&chapterSlug?.endsWith('-cost')?(col===18?'数量単位':col===19?'単価単位':''):'';cells.push(header?<th key={'trailing-'+next}>{unitLabel}</th>:<td key={'trailing-'+next}/>);next++;}
    return <tr key={r.row} data-source-row={r.row} className={header?'ddr-table-head':''}>{cells}</tr>;
  })}</tbody></table></div>;
  return table;
}
function Organization({chapter}:{chapter:DdReportChapter}) {
  const cells=new Map(chapter.body.rows.flatMap(r=>r.cells).map(c=>[c.address,String(c.value)]));
  const node=(a:string,cls='')=><div className={`ddr-org-node ${cls}`}>{cells.get(a)}</div>;
  return <div className="ddr-org-scroll"><div className="ddr-org">
    <div className="ddr-org-trunk">{node('M6')}{node('M11','ddr-org-ceo')}</div>
    <div className="ddr-org-branches">
      <section>{node('E19','ddr-org-lead')}<div className="ddr-org-stem"/><div className="ddr-org-dept"><h3>{cells.get('C27')}</h3>{['D31','D35','D39','D43'].map(a=><div key={a}>{node(a)}</div>)}</div></section>
      <section>{node('V19','ddr-org-lead')}<div className="ddr-org-stem"><div className="ddr-org-advisor">{cells.get('AE23')}</div></div><div className="ddr-org-dept"><h3>{cells.get('R27')}</h3>{['T31','T35','T39'].map(a=><div key={a}>{node(a)}</div>)}</div></section>
    </div><p>{cells.get('B50')}</p>{cells.get('B52')&&<p>{cells.get('B52')}</p>}
  </div></div>;
}
function EquityDiagram({chapter,slug,index,glossary,allRows,inputControls}:ContentProps) {
  const cells=new Map(chapter.body.rows.flatMap(r=>r.cells).map(c=>[c.address,c]));
  const phases=[['B',13,15,19,22,26],['G',13,15,19,22,26],['L',13,15,19,22,26],['L',32,34,38,41,45],['G',32,34,38,41,45],['B',32,34,38,41,45]] as const;
  return <><div className="ddr-equity-flow">{phases.map(([col,...rs],i)=><section key={col+rs[0]} className="ddr-phase">
    {rs.map((r,j)=>{const cell=cells.get(col+r);return cell?j===0?<h3 key={r}><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug} inputControls={inputControls}/></h3>:<div key={r} className={j===2?'ddr-phase-funding':''}><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug} inputControls={inputControls}/></div>:null;})}
    {i<5&&<span className="ddr-flow-arrow" aria-hidden="true">→</span>}
  </section>)}</div><div className="ddr-equity-notes">{["B29","K29","B49","K49"].map(a=>{const cell=cells.get(a);return cell?<p key={a}><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug} inputControls={inputControls}/></p>:null;})}</div></>;
}
/** Source cells become prose, comparisons, diagrams and charts. Whitespace-only rows disappear. */
export function DdReportContent(props:ContentProps) {
  const {chapter,slug,index,assetUrls,allRows,glossary,canDownload,revision,pdfWorkbookName,onDownloadExcel,inputControls,simulationActive}=props,body=chapter.body;
  const excelHref=allRows&&pdfWorkbookName?encodeURI(pdfWorkbookName):`/api/dd/${encodeURIComponent(slug)}/report/export?format=xlsx&scope=all&sheet=${encodeURIComponent(chapter.source_sheet)}${revision?`&revision=${revision}`:""}`;
  let tableNoticeShown=false,tableCount=0;
  if(chapter.slug==='biographies')return <DdBiographies chapter={chapter} slug={slug} glossary={glossary} allRows={allRows}/>;
  if(chapter.slug==='organization')return <><p className="ddr-page-introduction"><DdReportRichText text={DD_REPORT_INTRODUCTIONS[chapter.slug]} id="page-introduction" slug={slug} glossary={glossary} interactive={!allRows} emphasize/></p><Organization chapter={chapter}/></>;
  const objects=[...body.objects].sort((a,b)=>a.row-b.row),blocks:ReactNode[]=[];let tableRows:DdReportRow[]=[];let objectIndex=0;
  if(DD_REPORT_INTRODUCTIONS[chapter.slug])blocks.push(<p className="ddr-page-introduction" key="page-introduction"><DdReportRichText text={DD_REPORT_INTRODUCTIONS[chapter.slug]} id="page-introduction" slug={slug} glossary={glossary} interactive={!allRows} emphasize/></p>);
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
    if(chapter.slug.endsWith('-development-plan')&&ddExecutionTasks(tableRows).length){blocks.push(<DdExecutionGantt key="execution-gantt" rows={tableRows} windowIndex={props.executionWindow} onWindowChange={props.onExecutionWindowChange} print={allRows} cell={c=><CellValue cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug}/>}/>);}
    else if(allRows&&body.excel?.mode!=='pdf'){if(!tableNoticeShown){blocks.push(<p className="ddr-table-export-note" key="excel-note"><a className="ddr-pdf-anchor" href={ddPdfMarker(slug,chapter.slug)+'#excel-tables'} aria-hidden="true">.</a>表・計算条件は同梱Excelの「{chapter.slug.endsWith('-development-plan')?chapter.title:formatDdReportValue(chapter.source_sheet)}」シートに収録。 <a href={excelHref}>{pdfWorkbookName?"同梱Excelを開く":"表をExcelでダウンロード"} ↗</a></p>);tableNoticeShown=true;}}
    else blocks.push(<div className="ddr-table-block" key={'table-'+tableRows[0].row}>{canDownload&&body.excel?.mode!=='pdf'&&<div className="ddr-table-tools"><a href={excelHref} download onClick={onDownloadExcel?event=>{event.preventDefault();onDownloadExcel(excelHref);}:undefined}>{simulationActive?'計画値の表をExcelでダウンロード':'表をExcelでダウンロード'} ↗</a></div>}<ReportTable rows={tableRows} slug={slug} index={index} allRows={allRows} glossary={glossary} pageScroll={pageScroll} chapterSlug={chapter.slug} inputControls={inputControls}/></div>);
    tableRows=[];
  };
  const renderChart=(o:DdReportChart,key:string)=>chapter.slug==='capital-plan'&&o.row===64?<DdCapitalFundingFigure key={key} chapter={chapter}/>:<Fragment key={key}><DdReportChartFigure chart={o}/>{chapter.slug==='capital-plan'&&o.row===129&&<DdInvestorReturnNote chapter={chapter}/>}</Fragment>;
  const addObjects=(row:number)=>{
    while(objectIndex<objects.length&&objects[objectIndex].row<=row){
      flush();const o=objects[objectIndex++];
      if(o.kind==='chart'){
        const charts=[o];
        while(objectIndex<objects.length&&objects[objectIndex].kind==='chart'&&objects[objectIndex].row===o.row)charts.push(objects[objectIndex++] as DdReportChart);
        blocks.push(charts.length>1?<div className="ddr-chart-grid" key={'charts-'+o.row}>{charts.map((c,i)=>renderChart(c,'chart-'+i))}</div>:renderChart(o,'object-'+objectIndex));
      }else blocks.push(<figure className="ddr-image" style={{maxWidth:chapter.slug==='sier'?1000:860}} key={'object-'+objectIndex}>{/* Approved source figures retain their pixels. */}<img loading={allRows?'eager':'lazy'} src={assetUrls?.[o.assetKey]??`/api/dd/${encodeURIComponent(slug)}/report/assets/${o.assetKey}`} alt={o.caption||`${chapter.title}の図解`} />{o.caption&&<figcaption>{o.caption}</figcaption>}</figure>);
    }
  };
  if(chapter.slug==='source-index')blocks.push(<DdReportDirectory key="directory" index={index} rows={body.rows} slug={slug}/>,<h2 key="overview">事業と資金計画の概要</h2>);

  for(const [rowIndex,row] of body.rows.entries()){
    if(row.row<=2||(chapter.slug==='source-index'&&(row.row<=6||(row.row>=21&&row.row<=62))))continue;
    addObjects(row.row);
    if(chapter.slug.endsWith('-development-plan')&&row.row===12){flush();blocks.push(<DdDevelopmentRoadmap key="development-roadmap" rows={body.rows}/>);continue;}
    if(chapter.slug.endsWith('-development-plan')&&(row.row>=407&&row.row<=410||row.row>=507&&row.row<=511)){
      if(row.row===507&&body.dependencies){flush();blocks.push(<DdDevelopmentDependencies key="development-dependencies" diagram={body.dependencies}/>);}
      if(row.row===407||row.row===507){flush();const start=row.row,end=start===407?410:511;
        blocks.push(<div className="ddr-development-workstreams" key="development-workstreams">{body.rows.filter(r=>r.row>=start&&r.row<=end).map((r,i)=>{const c=r.cells[0],[title,...text]=String(c.value).split('｜');return <section key={r.row}><h3><span>{String(i+1).padStart(2,'0')}</span>{title.replace(/^[①-⑩]\s*/, '')}</h3><p><CellValue cell={{...c,value:text.join('｜')}} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug}/></p></section>;})}</div>);
      }continue;
    }
    if(chapter.slug==='unit-economics'&&row.row>=5&&row.row<=11){if(row.row===5){flush();blocks.push(<DdUeProcess key="ue-process" rows={body.rows.filter(r=>r.row>=5&&r.row<=11)} cell={c=><CellValue cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug} inputControls={inputControls}/>}/>);}continue;}
    if(chapter.slug==='capital-plan'&&row.row===181&&body.jkiss){flush();blocks.push(<div key="jkiss-summary" id="cell-B181">{allRows&&<a className="ddr-pdf-anchor" href={ddPdfMarker(slug,chapter.slug,'B181')} aria-hidden="true">.</a>}<DdJkissExplanation summary={body.jkiss}/></div>);continue;}
    // Detailed rows stay in Excel/PDF's existing projection; the web still parses their headings and prose.
    if(allRows&&row.calculationDetail){tableRows.push(row);continue;}
    if(chapter.slug==='equity-story'&&row.row>=12&&row.row<=50){if(row.row===12){flush();blocks.push(<EquityDiagram key="equity-diagram" {...props}/>);}continue;}
    const preceding=tableRows.at(-1);
    if(row.cells.length>1&&row.cells.every(c=>String(c.value).trim()==='→')&&preceding&&preceding.cells.length===row.cells.length+1&&preceding.cells.every(c=>typeof c.value==='string')){
      tableRows.pop();flush();blocks.push(<DdSourceFlow key={'flow-'+preceding.row} nodes={preceding} arrows={row} cell={c=><CellValue cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug} inputControls={inputControls}/>}/>);continue;
    }
    const head=row.cells.length===1&&row.cells[0].heading;
    // Copied worksheet titles/notes can be unmerged and lack heading styles.
    // They are document text, not extra columns in the following numerical grid.
    const nextGrid=!allRows&&row.cells.length<=2?body.rows.slice(rowIndex+1).find(r=>r.cells.length>=3):undefined;
    const previousRow=body.rows[rowIndex-1],nextRow=body.rows[rowIndex+1];
    const standaloneText=!allRows&&!row.exportTable&&row.cells.length<=2&&row.cells.every(c=>typeof c.value==='string')&&(
      (row.cells.length===1&&(String(row.cells[0].value).length>70||!previousRow||previousRow.cells.length<=2||!nextRow||nextRow.cells.length<=2))||
      (nextGrid&&nextGrid.cells.length>16&&row.cells[0].column<nextGrid.cells[0].column)||
      (row.cells.length===1&&previousRow&&nextRow&&Math.max(previousRow.cells.length,nextRow.cells.length)>16&&Math.min(previousRow.cells.length,nextRow.cells.length)<Math.max(previousRow.cells.length,nextRow.cells.length)*.5)
    );
    if(standaloneText&&!head&&!row.cells.some(c=>c.span>=5)){flush();blocks.push(<div key={'text-'+row.row} className="ddr-source-note">{row.cells.map(cell=><p key={cell.address}><CellValue cell={cell} slug={slug} index={index} glossary={glossary} chapterSlug={chapter.slug} inputControls={inputControls}/></p>)}</div>);continue;}
    const prose=!row.exportTable&&row.cells.length===1&&typeof row.cells[0].value==='string'&&row.cells[0].span>=5;
    const numbered=prose&&String(row.cells[0].value).split('\n');
    if(numbered&&numbered.length>1&&numbered.slice(1).every(line=>/^[①-⑩] .+｜.+/.test(line))){flush();const cell=row.cells[0];blocks.push(<div key={row.row} id={'cell-'+cell.address}><p><DdReportRichText text={numbered[0]} id={cell.address+'-intro'} slug={slug} glossary={glossary} interactive={!allRows} emphasize/></p><ol className="ddr-business-list">{numbered.slice(1).map((line,i)=>{const [name,...description]=line.split('｜');return <li key={i}><strong>{name}</strong><span><DdReportRichText text={description.join('｜')} id={cell.address+'-'+i} slug={slug} glossary={glossary} interactive={!allRows}/></span></li>;})}</ol></div>);continue;}
    if(head||prose){flush();const cell=row.cells[0];blocks.push(head?<h2 aria-label={String(cell.value)} key={row.row} id={'section-'+row.row}><DdReportSectionIcon title={String(cell.value)}/><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug} inputControls={inputControls}/></h2>:<p key={row.row} className={cell.value&&String(cell.value).length<80?'ddr-intro':''}><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug} inputControls={inputControls}/></p>);}
    else {if(tableRows.length){const lastGrid=[...tableRows].reverse().find(r=>r.cells.length>2);const positions=new Set([...(allRows?tableRows.flatMap(r=>r.cells.map(c=>c.column)):(lastGrid??tableRows[tableRows.length-1]).cells.map(c=>c.column)),...row.cells.map(c=>c.column)]);const widthsChanged=!allRows&&lastGrid&&row.cells.length>2&&Math.max(row.cells.length,lastGrid.cells.length)>16&&Math.min(row.cells.length,lastGrid.cells.length)<Math.max(row.cells.length,lastGrid.cells.length)*.5&&!row.cells.some(c=>c.span>1)&&!lastGrid.cells.some(c=>c.span>1);if(row.row-tableRows[tableRows.length-1].row>8||widthsChanged||positions.size>Math.max(row.cells.length,...tableRows.map(r=>r.cells.length))*1.25)flush();}tableRows.push(row);}
    for(const visual of body.visuals?.filter(v=>v.afterRow===row.row)??[]){flush();blocks.push(<DdReportVisual key={'visual-'+visual.afterRow} visual={visual} slug={slug} glossary={glossary} allRows={allRows}/>);}
  }
  flush();addObjects(Infinity);
  return <div className="ddr-content">{blocks}</div>;
}
