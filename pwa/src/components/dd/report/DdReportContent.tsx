import type {ReactNode} from 'react';
import type {DdReportCell,DdReportChapter,DdReportChapterSummary,DdReportChart,DdReportRow} from '@/lib/dd-report-types';
import {formatDdReportValue} from '@/lib/dd-report-format';

const palette=['#147d92','#193d52','#48a49a','#c99745','#6985aa','#a7b7bf','#566a66','#aa7171'];
export function ddReportHref(slug:string,sheet:string,index:DdReportChapterSummary[],address?:string) {
  const chapter=index.find(c=>c.source_sheet===sheet);return chapter?`/dd/${encodeURIComponent(slug)}?chapter=${chapter.slug}${address?'#cell-'+address:''}`:null;
}
function resolveLink(link:string|undefined,slug:string,index:DdReportChapterSummary[]) {
  if(!link)return null;if(/^https?:\/\//i.test(link))return link;
  const m=/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)/.exec(link);return m?ddReportHref(slug,m[1],index,m[2]+m[3]):null;
}
function linkedText(text:string,slug:string,index:DdReportChapterSummary[]):ReactNode {
  return text.split(/(https?:\/\/[^\s）)<>]+|SIER)/g).map((part,i)=>part==='SIER'?<a key={i} href={ddReportHref(slug,'SIER',index)??'#'}>{part}</a>:/^https?:\/\//.test(part)?<a key={i} href={part} target="_blank" rel="noreferrer">出所を開く ↗</a>:part);
}
function CellValue({cell,slug,index}:{cell:DdReportCell;slug:string;index:DdReportChapterSummary[]}) {
  const text=formatDdReportValue(cell.value,cell.format),href=resolveLink(cell.link,slug,index);
  const content=linkedText(text,slug,index);
  return <span id={`cell-${cell.address}`}>{href&&text.length<100?<a href={href}>{text}</a>:href?<>{content} <a href={href}>参照資料 ↗</a></>:content}</span>;
}
export function DdReportChartFigure({chart}:{chart:DdReportChart}) {
  const series=chart.series.filter(s=>s.values.length),labels=series.find(s=>s.categories.length)?.categories??[];
  if(!series.length)return null;
  const count=Math.max(...series.map(s=>s.values.length)),width=1000,height=390,pad={l:90,r:24,t:24,b:72},w=width-pad.l-pad.r,h=height-pad.t-pad.b;
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

type ContentProps={chapter:DdReportChapter;slug:string;index:DdReportChapterSummary[];assetUrls?:Record<string,string>;allRows?:boolean};
function ReportTable({rows,slug,index,allRows}:{rows:DdReportRow[];slug:string;index:DdReportChapterSummary[];allRows?:boolean}) {
  const maxColumns=Math.max(...rows.map(r=>r.cells.length));
  const columns=[...new Set(rows.flatMap(r=>r.cells.map(c=>c.column)))].sort((a,b)=>a-b);
  const table=<div className={`ddr-table-scroll ${maxColumns>16?'ddr-wide':''}`} tabIndex={0} aria-label="資料の表"><table><tbody>{rows.map((r,i)=>{
    const header=r.cells.every(c=>c.heading)||(i===0&&(maxColumns>16||r.cells.every(c=>typeof c.value==='string'&&c.value.length<90)));
    const cells:ReactNode[]=[];let next=0;
    for(const c of r.cells){const start=columns.indexOf(c.column);while(next<start){cells.push(<td key={'blank-'+next}/>);next++;}const span=Math.max(1,columns.filter(col=>col>=c.column&&col<c.column+c.span).length);const Tag=header?'th':'td';cells.push(<Tag scope={header?'col':undefined} colSpan={span} key={c.address} className={typeof c.value==='number'?'ddr-number':c.value==='成立'?'ddr-positive':c.value==='不成立'?'ddr-negative':''}><CellValue cell={c} slug={slug} index={index}/></Tag>);next=start+span;}
    return <tr key={r.row} className={header?'ddr-table-head':''}>{cells}</tr>;
  })}</tbody></table></div>;
  return !allRows&&rows.length>30?<details className="ddr-detail"><summary>明細を表示 · {rows.length}行</summary>{table}</details>:table;
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
function EquityDiagram({chapter,slug,index}:ContentProps) {
  const cells=new Map(chapter.body.rows.flatMap(r=>r.cells).map(c=>[c.address,c]));
  const phases=[['B',13,15,19,22,26],['G',13,15,19,22,26],['L',13,15,19,22,26],['L',32,34,38,41,45],['G',32,34,38,41,45],['B',32,34,38,41,45]] as const;
  return <div className="ddr-equity-flow">{phases.map(([col,...rs],i)=><section key={col+rs[0]} className="ddr-phase">
    {rs.map((r,j)=>{const cell=cells.get(col+r);return cell?j===0?<h3 key={r}><CellValue cell={cell} slug={slug} index={index}/></h3>:<div key={r} className={j===2?'ddr-phase-funding':''}><CellValue cell={cell} slug={slug} index={index}/></div>:null;})}
    {i<5&&<span className="ddr-flow-arrow" aria-hidden="true">→</span>}
  </section>)}</div>;
}
/** Source cells become prose, comparisons, diagrams and charts. Whitespace-only rows disappear. */
export function DdReportContent(props:ContentProps) {
  const {chapter,slug,index,assetUrls,allRows}=props,body=chapter.body;
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
  const flush=()=>{if(tableRows.length){blocks.push(<ReportTable key={'table-'+tableRows[0].row} rows={tableRows} slug={slug} index={index} allRows={allRows}/>);tableRows=[];}};
  const addObjects=(row:number)=>{while(objectIndex<objects.length&&objects[objectIndex].row<=row){flush();const o=objects[objectIndex++];blocks.push(o.kind==='chart'?<DdReportChartFigure key={'object-'+objectIndex} chart={o}/>:<figure className="ddr-image" key={'object-'+objectIndex}>{/* Original approved workbook figures retain their pixels. */}<img loading={allRows?'eager':'lazy'} src={assetUrls?.[o.assetKey]??`/api/dd/${encodeURIComponent(slug)}/report/assets/${o.assetKey}`} alt={o.caption||`${chapter.title}の図解`} />{o.caption&&<figcaption>{o.caption}</figcaption>}</figure>);}};
  for(const row of body.rows){
    if(row.row<=2)continue;
    addObjects(row.row);
    if(chapter.slug==='equity-story'&&row.row>=12&&row.row<=50){if(row.row===12){flush();blocks.push(<EquityDiagram key="equity-diagram" {...props}/>);}continue;}
    const head=row.cells.length===1&&row.cells[0].heading;
    const prose=row.cells.length===1&&typeof row.cells[0].value==='string'&&row.cells[0].span>=5;
    if(head||prose){flush();const cell=row.cells[0];blocks.push(head?<h2 key={row.row} id={'section-'+row.row}><CellValue cell={cell} slug={slug} index={index}/></h2>:<p key={row.row} className={cell.value&&String(cell.value).length<80?'ddr-intro':''}><CellValue cell={cell} slug={slug} index={index}/></p>);}
    else tableRows.push(row);
  }
  flush();addObjects(Infinity);
  return <div className="ddr-content">{blocks}</div>;
}
