import {ddRelocatedReportDestination} from '../../../lib/dd-report-relocations';
import {DdDailyExecutionPlan} from './DdDailyExecutionPlan';
import {canonicalReportHref,type CanonicalReportNavigation} from '../../../lib/project-canonical-links';
import {Fragment,isValidElement,type ReactNode} from 'react';
import {DdReportInputValue,type DdSimulationControls} from './DdReportSimulation';
import {DdBiographies} from './DdBiographies';
import {DdOrganizationChart} from './DdOrganizationChart';
import {DdEquityValuationChart} from './DdEquityValuationChart';
import {DdReportSectionIcon} from './DdReportSectionIcon';
import {DdSourceFlow,DdSourceGantt,DdUeProcess,isDdGantt} from './DdSourceDiagrams';
import {DdJkissExplanation} from './DdJkissExplanation';
import {DdReportChangeLog} from './DdReportChangeLog';
import {DdIpLandscape} from './DdIpLandscape';
import {DdPatentTable} from './DdPatentTable';
import {DdProgressOverview} from './DdProgressOverview';
import {DdReportVisual} from './DdReportVisual';
import {DdReportRichText,ddCostTerm} from './DdReportRichText';
import {DdReportDirectory} from './DdReportDirectory';
import {DdCapitalFundingFigure,DdInvestorReturnNote} from './DdCapitalFundingFigure';
import {DdExecutionGantt,DdDevelopmentRoadmap} from './DdExecutionGantt';
import {DdDevelopmentDependencies} from './DdReportCompleteness';
import {DdScaleInvestmentReference} from './DdScaleInvestmentReference';
import {DdPageIntroduction} from './DdPageIntroduction';
import {ddDevelopmentTarget} from '@/lib/dd-report-development-plans';
import {ddExecutionTasks} from '@/lib/dd-report-execution-plan';
import type {DdReportCell,DdReportChapter,DdReportChapterSummary,DdReportChart,DdReportRow,DdReportGlossary} from '@/lib/dd-report-types';
import {formatDdReportValue} from '@/lib/dd-report-format';
import {ddLegacyIpDestination,ddPdfMarker} from '@/lib/dd-report-navigation';

function solCostChapter(chapter:DdReportChapter):DdReportChapter {
  const preserve=new Set(['address','formula','link','source_sheet','sheet','assetKey','id','path','sourceUrl']);
  const copy=(value:unknown,key=''):unknown=>{
    if(preserve.has(key))return value;
    if(typeof value==='string')return value.includes('原価')?ddCostTerm(value,'sol'):value;
    if(Array.isArray(value)){const next=value.map(x=>copy(x));return next.some((x,i)=>x!==value[i])?next:value;}
    if(value&&typeof value==='object'){let changed=false;const entries=Object.entries(value).map(([k,v])=>{const next=copy(v,k);if(next!==v)changed=true;return[k,next];});return changed?Object.fromEntries(entries):value;}
    return value;
  };return copy(chapter) as DdReportChapter;
}
const palette=['#147d92','#193d52','#48a49a','#c99745','#6985aa','#a7b7bf','#566a66','#aa7171'];
export function ddReportHref(slug:string,sheet:string,index:DdReportChapterSummary[],address?:string) {
  const relocated=sheet==='知財・契約'?ddLegacyIpDestination(address):ddRelocatedReportDestination(sheet,address);if(relocated&&index.some(c=>c.slug===relocated.chapter))return `/dd/${encodeURIComponent(slug)}?chapter=${relocated.chapter}#cell-${relocated.address}`;
  const chapter=index.find(c=>c.source_sheet===sheet&&(sheet!=='計画詳細'||c.slug===ddDevelopmentTarget(address)))??index.find(c=>c.source_sheet===sheet)??index.find(c=>c.title===sheet||c.slug===sheet);return chapter?`/dd/${encodeURIComponent(slug)}?chapter=${chapter.slug}${address?'#cell-'+address:''}`:null;
}
function resolveLink(link:string|undefined,slug:string,index:DdReportChapterSummary[]) {
  if(!link)return null;if(/^https?:\/\//i.test(link))return link;
  const m=/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)/.exec(link);return m?ddReportHref(slug,m[1],index,m[2]+m[3]):null;
}
function financialDisplayCell(cell:DdReportCell,chapterSlug?:string):DdReportCell {
  if(chapterSlug!=='financial-plan'||typeof cell.value!=='number')return cell;
  const row=Number(cell.address.match(/\d+$/)?.[0]);
  if(cell.format.includes(',,')&&cell.format.includes('.'))return {...cell,value:cell.value!==0&&Math.abs(cell.value)<500000?(cell.value<0?'(＜1)':'＜1'):cell.value,format:'#,##0,,;\\(#,##0,,\\);"-"'};
  if(cell.format.includes('%')&&cell.format.includes('.'))return {...cell,format:'0%'};
  if(row>=305&&row<=314||row>=471&&row<=474||[64,165,179,967,968,969].includes(row))return {...cell,format:'#,##0;\\(#,##0\\);"-"'};
  return cell;
}
function CellValue({cell,slug,index,glossary,allRows,emphasize=false,chapterSlug,inputControls,navigation}:{cell:DdReportCell;slug:string;index:DdReportChapterSummary[];glossary?:DdReportGlossary;allRows?:boolean;emphasize?:boolean;chapterSlug?:string;inputControls?:DdSimulationControls;navigation?:CanonicalReportNavigation}) {
  const displayCell=financialDisplayCell(chapterSlug==='capital-plan'&&['B177','F177','N177','R177'].includes(cell.address)&&typeof cell.value==='number'?{...cell,value:cell.value/1e8,format:'0.00"億円"'}:cell,chapterSlug);
  const formatted=formatDdReportValue(displayCell.value,displayCell.format),leading=cell.prose?.replaceFirstParagraph!==undefined?[cell.prose.replaceFirstParagraph,...formatted.split('\n').slice(1)].join('\n'):formatted,text=[leading,cell.prose?.append].filter(Boolean).join('\n'),rawHref=resolveLink(cell.link,slug,index),href=canonicalReportHref(rawHref,slug,navigation);
  const target=rawHref?.startsWith('/dd/')?index.find(c=>new URL(rawHref,'https://amd-os-pwa.vercel.app').searchParams.get('chapter')===c.slug):null;
  const content=<DdReportRichText navigation={navigation} text={text} id={cell.address} slug={slug} glossary={glossary} interactive={!allRows} emphasize={emphasize} highlights={cell.highlights}/>;
  return <span id={`cell-${cell.address}`}>{allRows&&chapterSlug&&<a className="ddr-pdf-anchor" href={ddPdfMarker(slug,chapterSlug,cell.address)} aria-hidden="true">.</a>}{href?<>{content} <a href={href}>{target?`「${target.title==='UE'?'UE（ユニットエコノミクス）':target.title}」`:'出典'} ↗</a></>:allRows?content:<DdReportInputValue address={cell.address} controls={inputControls}>{content}</DdReportInputValue>}</span>;
}
export function DdReportChartFigure({chart,compact=false,narrow=false}:{chart:DdReportChart;compact?:boolean;narrow?:boolean}) {
  const series=chart.series.filter(s=>s.values.length),labels=series.find(s=>s.categories.length)?.categories??[];
  if(!series.length)return null;
  const count=Math.max(...series.map(s=>s.values.length)),width=narrow?640:compact?720:count>36?1200:count>12?960:count<=6?640:760,height=chart.horizontal?Math.min(280,110+count*28):narrow?248:compact?176:260,pad=narrow?{l:70,r:20,t:16,b:40}:compact?{l:64,r:16,t:16,b:40}:{l:90,r:24,t:24,b:72},w=width-pad.l-pad.r,h=height-pad.t-pad.b;
  const sums=Array.from({length:count},(_,i)=>series.reduce((n,s)=>n+Math.max(0,s.values[i]??0),0));
  const ns=series.flatMap(s=>s.values).filter(Number.isFinite),high=Math.max(1,...ns,...(chart.stacked?sums:[])),low=Math.min(0,...ns),range=(high-low)*1.08;
  const y=(n:number)=>pad.t+(high+(high-low)*.04-n)/range*h;
  const line=chart.chartType==='lineChart'||chart.chartType==='scatterChart';
  const axisNumber=(n:number)=>formatDdReportValue(n,chart.numberFormat??'General');
  const shownLabels=Array.from({length:count},(_,i)=>i).filter(i=>count<=12||i%Math.ceil(count/(narrow?5:10))===0||i===count-1);
  return <figure className={`ddr-chart${compact?' ddr-chart-compact':''}`} style={{maxWidth:width+22}}>
    <figcaption>{chart.title||'計画の推移'}</figcaption>{chart.readingNote&&<p className="ddr-figure-reading">{chart.readingNote}</p>}
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
      {chart.horizontal?shownLabels.map(i=><text key={i} x={pad.l-12} y={pad.t+(i+.5)*h/count+5} textAnchor="end" fontSize="12">{String(labels[i]||i+1).replace(/^(20\d{2})\.0$/,'$1')}</text>):shownLabels.map(i=><text key={i} x={pad.l+(line?i/(count-1||1):(i+.5)/count)*w} y={height-32} textAnchor={narrow?(i===0?'start':i===count-1?'end':'middle'):'middle'} fontSize={narrow?11:13} fill="#425966">{String(labels[i]||i+1).replace(/^(20\d{2})\.0$/,'$1')}</text>)}
    </svg></div>
    <div className="ddr-legend">{series.map((s,i)=><span key={i}><i style={{background:palette[i%palette.length]}}/>{s.name||`系列${i+1}`}</span>)}</div>
  </figure>;
}

type ContentProps={chapter:DdReportChapter;slug:string;index:DdReportChapterSummary[];assetUrls?:Record<string,string>;allRows?:boolean;glossary?:DdReportGlossary;canDownload?:boolean;revision?:number;pdfWorkbookName?:string;onDownloadExcel?:(href:string)=>void;inputControls?:DdSimulationControls;simulationActive?:boolean;executionWindow?:number;onExecutionWindowChange?:(index:number)=>void;navigation?:CanonicalReportNavigation};
function ReportTable({rows,slug,index,allRows,glossary,pageScroll=false,chapterSlug,inputControls,navigation}:{rows:DdReportRow[];slug:string;index:DdReportChapterSummary[];allRows?:boolean;glossary?:DdReportGlossary;pageScroll?:boolean;chapterSlug?:string;inputControls?:DdSimulationControls;navigation?:CanonicalReportNavigation}) {
  if(isDdGantt(rows))return <DdSourceGantt rows={rows} cell={c=><CellValue navigation={navigation} cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapterSlug} inputControls={inputControls}/>}/>;
  if(chapterSlug==='unit-economics'&&rows.some(r=>r.row===18)&&rows.some(r=>r.row===21)){
    const common=rows.find(r=>r.row===18)!;const value=(address:string)=>{const cell=common.cells.find(c=>c.address===address);return cell&&<CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapterSlug} inputControls={inputControls} navigation={navigation}/>;};
    return <><ReportTable rows={rows.filter(r=>r.row!==18)} slug={slug} index={index} allRows={allRows} glossary={glossary} pageScroll={pageScroll} chapterSlug={chapterSlug} inputControls={inputControls} navigation={navigation}/><section className="ddr-ue-common-biomass"><h3>{value('B18')}</h3><dl><div><dt>{ddCostTerm('生産原価',slug)}</dt><dd>{value('G18')}</dd></div><div><dt>{ddCostTerm('廃液処理料金から逆算した許容原価',slug)}</dt><dd>{value('E18')}</dd></div><div><dt>{ddCostTerm('許容原価との差',slug)}</dt><dd>{value('I18')}</dd></div></dl><p>単位：円/kg-DCW（乾燥菌体１kg）。設備・材料・作業を含む菌体の生産費を、使用量に応じて上の{ddCostTerm('事業原価',slug)}へ割り当てる。{ddCostTerm('許容原価',slug)}との差は、独立した事業の利益へ加算しない。</p></section></>;
  }
  if(chapterSlug==='financial-plan'&&!allRows&&rows[0]?.row===268){
    const monthly=rows.filter(r=>r.row>=269&&r.row<=277);
    const categories=([['F','人件費'],['G','研究費'],['H','販売費'],['I','その他費用']] as const).map(([col,label])=>({label,total:monthly.reduce((sum,r)=>sum+Number(r.cells.find(c=>c.address===`${col}${r.row}`)?.value??0),0)}));
    const total=categories.reduce((sum,c)=>sum+c.total,0);
    return <section className="ddr-precompany-budget" aria-label="設立前研究プロジェクト予算の要約">
      <p><strong>これは会社設立前の研究プロジェクトの参考予算。</strong>株式会社SOLの売上・月末現金を計算する資金繰表には含めない。原資料の費目別総額を９か月に均等配分したもので、毎月この額を発注・支払う予定ではない。</p>
      <table><thead><tr><th scope="col">原資料の費目</th><th scope="col">９か月の予算額</th></tr></thead><tbody>{categories.map(c=><tr key={c.label}><th scope="row">{c.label}</th><td>{formatDdReportValue(c.total/10000,'#,##0')}万円</td></tr>)}<tr className="ddr-precompany-total"><th scope="row">合計</th><td>{formatDdReportValue(total/10000,'#,##0')}万円</td></tr></tbody></table>
      <p>財源の確定額、各費目の中身と実際の支払日は、この配分表からは分からない。設立後の会社の月次計画は2027年４月から始まる。</p>
      <details><summary>原資料の月別均等配分を見る</summary><ReportTable rows={rows} slug={slug} index={index} allRows glossary={glossary} pageScroll={pageScroll} chapterSlug={chapterSlug} inputControls={inputControls} navigation={navigation}/></details>
    </section>;
  }
  if(!allRows&&chapterSlug?.endsWith('-cost')){
    const noteColumns=[...new Set(rows.flatMap(r=>r.cells.filter(c=>c.column>r.cells[0].column&&typeof c.value==='string'&&c.value.length>150).map(c=>c.column)))].filter(col=>rows.every(r=>r.cells.filter(c=>c.column===col).every(c=>typeof c.value==='string'&&!inputControls?.inputs.some(i=>i.address===c.address))));
    if(noteColumns.length){
      const notes=rows.map(r=>({row:r,cells:r.cells.filter(c=>noteColumns.includes(c.column))})).filter(n=>n.cells.length),grid=rows.map(r=>({...r,cells:r.cells.filter(c=>!noteColumns.includes(c.column))}));
      const value=(c:DdReportCell)=><CellValue navigation={navigation} cell={c} slug={slug} index={index} glossary={glossary} chapterSlug={chapterSlug} inputControls={inputControls}/>;
      return <div className="ddr-cost-detail"><ReportTable navigation={navigation} rows={grid} slug={slug} index={index} glossary={glossary} pageScroll={pageScroll} chapterSlug={chapterSlug} inputControls={inputControls}/><section className="ddr-cost-notes" aria-label="条件・費目ごとの根拠全文"><h3>条件・費目ごとの根拠</h3>{notes.map(({row:r,cells})=><div className="ddr-cost-note" key={r.row}><a href={'#cell-'+r.cells[0].address}>{String(r.cells[0].value)} ↑</a><div>{cells.map(c=><p key={c.address}>{value(c)}</p>)}</div></div>)}</section></div>;
    }
  }
  const maxColumns=Math.max(...rows.map(r=>r.cells.length));
  const columns=[...new Set(rows.flatMap(r=>r.cells.map(c=>c.column)))].sort((a,b)=>a-b);
  const weights=columns.map(col=>Math.sqrt(Math.max(8,...rows.flatMap(r=>r.cells.filter(c=>c.column===col).map(c=>Math.min(120,String(c.value??'').length)/Math.max(1,columns.filter(p=>p>=c.column&&p<c.column+c.span).length))))));
  const narrative=!allRows&&maxColumns<=3&&rows.every(r=>r.cells.every(c=>typeof c.value==='string'))&&rows.some(r=>r.cells.some(c=>Boolean(c.prose)||String(c.value).length>100));
  const compact=(chapterSlug==='financial-plan'||chapterSlug==='capital-plan')&&!narrative;
  const table=<div className={`ddr-table-scroll ${maxColumns>16?'ddr-wide':''} ${compact?'ddr-financial-table':''} ${narrative?'ddr-narrative-table':''} ${pageScroll?'ddr-table-page-scroll':''}`} tabIndex={0} aria-label="資料の表"><table>{allRows&&<colgroup>{weights.map((w,i)=><col key={i} style={{width:(100*w/weights.reduce((a,b)=>a+b,0))+'%'}}/>)}</colgroup>}<tbody>{rows.map((r,i)=>{
    const header=r.cells.every(c=>c.heading)||(chapterSlug!=='development-issues'&&i===0&&!r.cells.some(c=>inputControls?.inputs.some(i=>i.address===c.address))&&(maxColumns>16||r.cells.every(c=>typeof c.value==='string'&&c.value.length<90)));
    const cells:ReactNode[]=[];let next=0;
    for(const c of r.cells){const start=columns.indexOf(c.column);while(next<start){cells.push(<td key={'blank-'+next}/>);next++;}const span=Math.max(1,columns.filter(col=>col>=c.column&&col<c.column+c.span).length);const rowHeader=chapterSlug==='development-issues'&&maxColumns===2&&c.column===columns[0];const Tag=header||rowHeader?'th':'td';
      const trendRow=chapterSlug==='financial-plan'&&[12,19,30,61,236,241,245].includes(r.row),previous=trendRow?r.cells.find(p=>p.column===c.column-1):undefined,delta=typeof c.value==='number'&&typeof previous?.value==='number'?c.value-previous.value:0,trend=trendRow&&c.column>=6&&Math.abs(delta)>=.5?(delta>0?'up':'down'):null;
      const yearStart=chapterSlug==='financial-plan'&&r.row>=7&&r.row<=62&&c.column>=5&&(c.column-5)%12===0;
      const classes=[typeof c.value==='number'?'ddr-number':c.value==='成立'?'ddr-positive':c.value==='不成立'?'ddr-negative':c.value==='条件付き成立'?'ddr-conditional':'',yearStart?'ddr-financial-year-start':'',trend?'ddr-financial-'+trend:''].filter(Boolean).join(' ');
      cells.push(<Tag scope={header?'col':rowHeader?'row':undefined} colSpan={span} key={c.address} className={classes}><CellValue navigation={navigation} cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapterSlug} inputControls={inputControls}/>{trend&&<span className="ddr-financial-trend" title={`${r.row>=235?'前年度':'前月'}より${trend==='up'?'増加':'減少'}：${formatDdReportValue(Math.abs(delta),'#,##0')}円`} aria-label={`${r.row>=235?'前年度':'前月'}より${trend==='up'?'増加':'減少'}`}>{trend==='up'?'↑':'↓'}</span>}</Tag>);next=start+span;}
    if(!allRows&&chapterSlug?.endsWith('-cost'))while(next<columns.length){const col=columns[next],unitLabel=header&&chapterSlug?.endsWith('-cost')?(col===18?'数量単位':col===19?'単価単位':''):'';cells.push(header?<th key={'trailing-'+next}>{unitLabel}</th>:<td key={'trailing-'+next}/>);next++;}
    return <tr key={r.row} data-source-row={r.row} className={header?'ddr-table-head':''}>{cells}</tr>;
  })}</tbody></table></div>;
  return table;
}
function EquityDiagram({chapter,slug,index,glossary,allRows,inputControls,navigation}:ContentProps) {
  const cells=new Map(chapter.body.rows.flatMap(r=>r.cells).map(c=>[c.address,c]));
  const gap=cells.get('B9');
  const phases=[['B',13,15,19,22,26],['G',13,15,19,22,26],['L',13,15,19,22,26],['L',32,34,38,41,45],['G',32,34,38,41,45],['B',32,34,38,41,45]] as const;
  const value=(cell:DdReportCell)=><CellValue navigation={navigation} cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug} inputControls={inputControls}/>;
  const fields=[{index:1,label:'投資家へ示す成果'},{index:2,label:'調達条件・金額'},{index:3,label:'この資金で実現する成果'},{index:4,label:'次の評価額を支える理由'}];
  return <>
    {gap&&<section className="ddr-phase ddr-phase-gap"><h3>GAPファンド</h3><div>{value(gap)}</div></section>}
    <p className="ddr-equity-chart-note">Aは参考キャップ＋進捗による評価増＋シード転換元本＝今回プレ、新規調達を加えて今回ポスト。B以降は前回ポスト＋評価増＋新規調達＝今回ポスト。金額は計画値（億円）。縦軸は各ラウンドの金額に合わせる。</p>
    <div className="ddr-equity-scroll" tabIndex={0} aria-label="シードからIPOまでのラウンド比較"><table className="ddr-equity-matrix">
      <colgroup><col className="ddr-equity-label-column"/>{phases.map((_,i)=><col key={i}/>)}</colgroup>
      <thead><tr><th scope="col">比較項目</th>{phases.map(([col,row])=>{const cell=cells.get(col+row);return <th scope="col" key={col+row}>{cell&&value(cell)}</th>;})}</tr></thead>
      <tbody>{fields.map(field=><tr key={field.index}><th scope="row">{field.label}</th>{phases.map(([col,...rs],i)=>{const cell=cells.get(col+rs[field.index]);if(!cell)return <td key={i}>—</td>;const lines=String(cell.value).split('\n');const display=field.index!==2&&lines.length>1?{...cell,value:lines.slice(1).join('\n')}:cell;return <td key={i} data-phase={i}>
        {field.index===2&&chapter.body.equityValuations?.[i]&&<DdEquityValuationChart round={chapter.body.equityValuations[i]}/>}
        {value(display)}
        {i===5&&field.index===4&&<p className="ddr-equity-validation">評価額は計画値。収益倍率・希薄化・投資家収益率は資本政策表で確認できる。</p>}
      </td>;})}</tr>)}</tbody>
    </table></div>
    <div className="ddr-equity-notes">{["B29","K29"].map(a=>{const cell=cells.get(a);return cell?<p key={a}><CellValue navigation={navigation} cell={a==='B29'?{...cell,value:'台数は小型・商用・大型の検収累計。月間処理量は各装置の検収翌月から積み上げる。投資額と到達時の体制・損益は下の比較表で確認できる。'}:cell} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug} inputControls={inputControls}/></p>:null;})}</div>
  </>;
}
function EquityResources({chapter,slug,index,glossary,allRows,navigation}:ContentProps){
  const cells=new Map(chapter.body.rows.flatMap(r=>r.cells).map(c=>[c.address,c]));
  const stages=['シード','シリーズA','シリーズB','シリーズC','シリーズD','IPO'];
  const value=(address:string,transform?:(value:string)=>string)=>{const cell=cells.get(address);return cell?<CellValue navigation={navigation} cell={transform?{...cell,value:transform(String(cell.value))}:cell} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug}/>:null;};
  const cols=['D','F','H','J','L','N'];
  return <figure className="ddr-equity-resources"><figcaption>各ラウンドの投資額・到達時の体制と損益</figcaption><div className="ddr-table-scroll"><table><thead><tr><th>項目</th>{stages.map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>
    <tr><th>実行期間</th>{cols.map(col=><td key={col}>{(()=>{const c=cells.get(col+'260');return c?valuePeriod(c):null;})()}</td>)}</tr>
    {['大学委託・研究開発費／億円','設備支払／億円','到達時の雇用／FTE'].map((label,i)=><tr key={label}><th>{label}</th>{[78,98,118,138,158,178].map(row=><td className="ddr-number" key={row}>{value(['B','F','I'][i]+row)}</td>)}</tr>)}
    {[['到達時の売上／億円',287],['同営業損益／億円',291]].map(([label,row])=><tr key={row}><th>{label}</th>{cols.map(col=><td className="ddr-number" key={col}>{value(col+row)}</td>)}</tr>)}
    <tr><th>生産拠点</th>{cols.map(col=><td key={col}>{value(col+'276',v=>v.replace(/／雇用[^\n]*/,''))}</td>)}</tr>
  </tbody></table></div><p className="ddr-equity-resource-note">{value('B300')}</p></figure>;
  function valuePeriod(cell:DdReportCell){return <CellValue navigation={navigation} cell={{...cell,value:String(cell.value).split('\n').slice(1).join('\n')}} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug}/>;}
}
/** Source cells become prose, comparisons, diagrams and charts. Whitespace-only rows disappear. */
export function DdReportContent(props:ContentProps) {
  if(props.slug==='sol')props={...props,chapter:solCostChapter(props.chapter)};
  const {chapter,slug,index,assetUrls,allRows,glossary,canDownload,revision,pdfWorkbookName,onDownloadExcel,inputControls,simulationActive,navigation}=props;
  const introduction=<DdPageIntroduction chapterSlug={chapter.slug} slug={slug} glossary={glossary} allRows={allRows} navigation={navigation}/>;
  if(chapter.body.executionPlan?.data&&allRows){const data=chapter.body.executionPlan.data;return <>{introduction}<p>日次作業{data.tasks.length.toLocaleString('ja-JP')}項目と担当工数{data.allocations.length.toLocaleString('ja-JP')}件の全明細を、同梱Excelの「日次実行計画」「日次担当工数」に収録する。開始日・終了日・責任担当・完了条件・依存関係と、日付別の担当時間を掲載する。</p><h2>初期３台の主な工程</h2>{chapter.body.rows.filter(r=>r.row>=4).map(r=><p key={r.row}><strong>{String(r.cells[0].value)}　{String(r.cells[1].value)}</strong><br/>{String(r.cells[2].value)} ／ {String(r.cells[3].value)}</p>)}</>;}
  if(chapter.body.executionPlan?.data&&!allRows)return <>{introduction}<DdDailyExecutionPlan data={chapter.body.executionPlan.data}/></>;
  if(chapter.body.changeLog)return <DdReportChangeLog data={chapter.body.changeLog} slug={slug}/>;
  if(chapter.body.progress)return <DdProgressOverview navigation={navigation} data={chapter.body.progress} slug={slug} index={index} print={allRows}/>;
  const productionLink=chapter.slug==='business-plan'?chapter.body.rows.find(r=>r.cells.some(c=>c.address==='B4'&&c.link?.includes('生産・拠点計画'))):undefined;
  const body=productionLink&&chapter.body.rows.some(r=>r.row===207)?{...chapter.body,rows:chapter.body.rows.filter(r=>r!==productionLink).flatMap(r=>r.row===207?[r,{...productionLink,row:208,cells:productionLink.cells.map(c=>({...c,value:'増産に必要な培養量・敷地・増設時期・候補地は、生産・拠点計画に示す。'}))}]:[r])}:chapter.body;
  const excelHref=allRows&&pdfWorkbookName?encodeURI(pdfWorkbookName):`/api/dd/${encodeURIComponent(slug)}/report/export?format=xlsx&scope=all&sheet=${encodeURIComponent(chapter.source_sheet)}${revision?`&revision=${revision}`:""}`;
  let tableNoticeShown=false,tableCount=0;
  if(chapter.slug==='biographies')return <>{introduction}<DdBiographies chapter={chapter} slug={slug} glossary={glossary} allRows={allRows}/></>;
  if(chapter.slug==='organization')return <>{introduction}<DdOrganizationChart chapter={chapter}/></>;
  const financeCharts=chapter.slug==='business-plan'?body.objects.filter((o):o is DdReportChart=>o.kind==='chart'&&o.row===231):[];
  const objects=body.objects.filter(o=>!financeCharts.includes(o as DdReportChart)&&!(chapter.slug==='equity-story'&&o.kind==='chart'&&o.title?.startsWith('目標評価額の成長'))&&!(chapter.slug==='unit-economics'&&o.kind==='chart'&&o.title?.startsWith('シアノ生産'))).sort((a,b)=>a.row-b.row),blocks:ReactNode[]=[];let tableRows:DdReportRow[]=[];let objectIndex=0;
  blocks.push(<Fragment key="page-introduction">{introduction}</Fragment>);
  const primary:Record<string,{address:string;label:string;unit:string}>={
    'cyanobacteria-cost':{address:'E20',label:'出荷する菌体1kgの原価',unit:'円/kg-DCW'},
    'reactor-cost':{address:'E20',label:'SOLの廃液処理直接原価',unit:'円/m³'},
    'metal-cost':{address:'E24',label:'精製・出荷まで含む販売金属の原価',unit:'円/kg金属'},
    'fame-cost':{address:'E20',label:'FAME 1Lの総原価',unit:'円/L'},
  };
  const metric=primary[chapter.slug],result=metric?body.rows.flatMap(r=>r.cells).find(c=>c.address===metric.address):null;
  if(metric&&result)blocks.push(<div className="ddr-primary-result" key="primary-result"><div>{ddCostTerm(metric.label,slug)}</div><strong>{typeof result.value==='number'?result.value.toLocaleString('ja-JP',{maximumFractionDigits:0}):String(result.value)}</strong><span>{metric.unit}</span></div>);
  const flush=()=>{if(!tableRows.length)return;
    const pageScroll=chapter.slug==='assumptions'&&tableCount===0;tableCount++;
    if(chapter.slug.endsWith('-development-plan')&&ddExecutionTasks(tableRows).length){blocks.push(<DdExecutionGantt key="execution-gantt" rows={tableRows} windowIndex={props.executionWindow} onWindowChange={props.onExecutionWindowChange} print={allRows} cell={c=><CellValue navigation={navigation} cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug}/>}/>);}
    else if(allRows&&body.excel?.mode!=='pdf'){if(!tableNoticeShown){blocks.push(<p className="ddr-table-export-note" key="excel-note"><a className="ddr-pdf-anchor" href={ddPdfMarker(slug,chapter.slug)+'#excel-tables'} aria-hidden="true">.</a>表・計算条件は同梱Excelの「{chapter.slug.endsWith('-development-plan')?chapter.title:formatDdReportValue(chapter.source_sheet)}」シートに収録。 <a href={excelHref}>{pdfWorkbookName?"同梱Excelを開く":"表をExcelでダウンロード"} ↗</a></p>);tableNoticeShown=true;}}
    else blocks.push(<div className="ddr-table-block" key={'table-'+tableRows[0].row}>{canDownload&&body.excel?.mode!=='pdf'&&<div className="ddr-table-tools"><a href={excelHref} download onClick={onDownloadExcel?event=>{event.preventDefault();onDownloadExcel(excelHref);}:undefined}>{simulationActive?'計画値の表をExcelでダウンロード':'表をExcelでダウンロード'} ↗</a></div>}<ReportTable navigation={navigation} rows={tableRows} slug={slug} index={index} allRows={allRows} glossary={glossary} pageScroll={pageScroll} chapterSlug={chapter.slug} inputControls={inputControls}/></div>);
    tableRows=[];
  };
  const renderChart=(o:DdReportChart,key:string)=>chapter.slug==='capital-plan'&&o.row===64?<Fragment key={key}>{o.readingNote&&<p className="ddr-figure-reading">{o.readingNote}</p>}<DdCapitalFundingFigure chapter={chapter}/></Fragment>:<Fragment key={key}><DdReportChartFigure chart={o} compact={chapter.slug==='equity-story'}/>{chapter.slug==='capital-plan'&&o.row===129&&<DdInvestorReturnNote chapter={chapter}/>}</Fragment>;
  const addObjects=(row:number)=>{
    while(objectIndex<objects.length&&objects[objectIndex].row<=row){
      flush();const o=objects[objectIndex++];
      if(o.kind==='chart'){
        const charts=[o];
        while(objectIndex<objects.length&&objects[objectIndex].kind==='chart'&&objects[objectIndex].row===o.row)charts.push(objects[objectIndex++] as DdReportChart);
        blocks.push(charts.length>1?<div className="ddr-chart-grid" key={'charts-'+o.row}>{charts.map((c,i)=>renderChart(c,'chart-'+i))}</div>:renderChart(o,'object-'+objectIndex));
      }else blocks.push(<figure className="ddr-image" style={{maxWidth:chapter.slug==='sier'?1000:860}} key={'object-'+objectIndex}>{/* Approved source figures retain their pixels. */}<img loading={allRows?'eager':'lazy'} src={assetUrls?.[o.assetKey]??`/api/dd/${encodeURIComponent(slug)}/report/assets/${o.assetKey}`} alt={o.caption||`${chapter.title}の図解`} />{(o.caption||o.readingNote)&&<figcaption>{o.caption}{o.readingNote&&<p className="ddr-figure-reading">{o.readingNote}</p>}</figcaption>}</figure>);
    }
  };
  if(chapter.slug==='source-index')blocks.push(<DdReportDirectory key="directory" index={index} rows={body.rows} slug={slug}/>,<h2 key="overview">事業と資金計画の概要</h2>);

  for(const [rowIndex,row] of body.rows.entries()){
    if(row.row<=2||(chapter.slug==='source-index'&&(row.row<=6||(row.row>=21&&row.row<=62))))continue;
    if(financeCharts.length&&row.row>=226&&row.row<=252){
      if(row.row===226){flush();blocks.push(<section key="finance-summary" className="ddr-finance-layout" aria-label="収益・資金計画の説明と推移"><div className="ddr-finance-copy">{body.rows.filter(r=>r.row>=226&&r.row<=252).flatMap(r=>r.cells.map(c=><p key={c.address}><CellValue navigation={navigation} cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug} inputControls={inputControls}/></p>))}</div><div className="ddr-finance-charts">{financeCharts.map((c,i)=><DdReportChartFigure key={i} chart={c} narrow/>)}</div></section>);}
      continue;
    }
    addObjects(row.row);
    const readingNotes=body.readingNotes?.filter(note=>note.beforeRow===row.row)??[];
    if(readingNotes.length){flush();readingNotes.forEach((note,i)=>blocks.push(<p key={'reading-'+row.row+'-'+i} className="ddr-figure-reading"><DdReportRichText navigation={navigation} text={note.text} id={'reading-'+row.row+'-'+i} slug={slug} glossary={glossary} interactive={!allRows} emphasize/></p>));}
    if(chapter.slug==='financial-plan'&&row.row>=252&&row.row<=258){
      if(row.row===252){flush();const title=row.cells[0];const groups=[{row:253,title:'計算の基礎と研究拠点'},{row:254,title:'顧客料金の上限'},{row:255,title:'菌体原価と改善目標'},{row:256,title:'燃料開発の予算'},{row:257,title:'商用拡大と資金調達'},{row:258,title:'入出金・税金の時期'}];
        blocks.push(<section key="financial-assumptions"><h2><DdReportSectionIcon title={String(title.value)}/><CellValue cell={title} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug} navigation={navigation}/></h2><div className="ddr-financial-assumptions">{groups.map(group=>{const cell=body.rows.find(r=>r.row===group.row)?.cells[0];return cell&&<section key={group.row}><h3>{ddCostTerm(group.title,slug)}</h3><p><CellValue cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug} inputControls={inputControls} navigation={navigation}/></p></section>;})}</div></section>);
      }continue;
    }
    if(chapter.slug==='ip-contracts'&&row.row===7&&body.ipLandscape){flush();blocks.push(<DdIpLandscape key="ip-landscape" data={body.ipLandscape} print={allRows} projectId={navigation?.projectId}/>);}
    if(chapter.slug==='ip-contracts'&&body.patentTable&&[body.patentTable.headerRow,...body.patentTable.recordRows].includes(row.row)){if(row.row===body.patentTable.headerRow){flush();const patentRows=[body.patentTable.headerRow,...body.patentTable.recordRows].flatMap(n=>body.rows.filter(r=>r.row===n));blocks.push(<DdPatentTable key="patent-table" rows={patentRows} summary={body.patentTable.summary} landscape={body.ipLandscape} print={allRows} cell={c=><CellValue navigation={navigation} cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug}/>}/>);}continue;}
    if(chapter.slug.endsWith('-development-plan')&&row.row===12){flush();blocks.push(<DdDevelopmentRoadmap key="development-roadmap" rows={body.rows}/>);continue;}
    if(chapter.slug.endsWith('-development-plan')&&(row.row>=407&&row.row<=410||row.row>=507&&row.row<=511)){
      if(row.row===507&&body.dependencies){flush();blocks.push(<DdDevelopmentDependencies key="development-dependencies" diagram={body.dependencies}/>);}
      if(row.row===407||row.row===507){flush();const start=row.row,end=start===407?410:511;
        blocks.push(<div className="ddr-development-workstreams" key="development-workstreams">{body.rows.filter(r=>r.row>=start&&r.row<=end).map((r,i)=>{const c=r.cells[0],[title,...text]=String(c.value).split('｜');return <section key={r.row}><h3><span>{String(i+1).padStart(2,'0')}</span>{title.replace(/^[①-⑩]\s*/, '')}</h3><p><CellValue navigation={navigation} cell={{...c,value:text.join('｜')}} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug}/></p></section>;})}</div>);
      }continue;
    }
    if(chapter.slug==='unit-economics'&&row.row>=5&&row.row<=11){if(row.row===5){flush();blocks.push(<DdUeProcess key="ue-process" rows={body.rows.filter(r=>r.row>=5&&r.row<=11)} cell={c=><CellValue navigation={navigation} cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug} inputControls={inputControls}/>}/>);}continue;}
    if(chapter.slug==='capital-plan'&&row.row===181&&body.jkiss){flush();blocks.push(<div key="jkiss-summary" id="cell-B181">{allRows&&<a className="ddr-pdf-anchor" href={ddPdfMarker(slug,chapter.slug,'B181')} aria-hidden="true">.</a>}<DdJkissExplanation summary={body.jkiss}/></div>);continue;}
    // Detailed rows stay in Excel/PDF's existing projection; the web still parses their headings and prose.
    if(allRows&&row.calculationDetail){tableRows.push(row);continue;}
    if(chapter.slug==='equity-story'&&row.cells.length===1&&row.cells[0].address==='B9')continue;
    if(chapter.slug==='equity-story'&&row.row>=12&&row.row<=50){if(row.row===12){flush();blocks.push(<EquityDiagram key="equity-diagram" {...props}/>);}continue;}
    if(chapter.slug==='equity-story'&&row.row>=67&&row.row<=231){if(row.row===67){flush();blocks.push(<EquityResources key="equity-resources" {...props}/>);}continue;}
    if(chapter.slug==='equity-story'&&row.row>=257)continue;
    if(chapter.slug==='equity-story'&&row.row===232){flush();blocks.push(<DdScaleInvestmentReference key="scale-investment-reference"/>);continue;}
    if(chapter.slug==='equity-story'&&[235,240].includes(row.row))continue;
    const preceding=tableRows.at(-1);
    if(row.cells.length>1&&row.cells.every(c=>String(c.value).trim()==='→')&&preceding&&preceding.cells.length===row.cells.length+1&&preceding.cells.every(c=>typeof c.value==='string')){
      tableRows.pop();flush();blocks.push(<DdSourceFlow key={'flow-'+preceding.row} nodes={preceding} arrows={row} cell={c=><CellValue navigation={navigation} cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug} inputControls={inputControls}/>}/>);continue;
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
    if(standaloneText&&!head&&!row.cells.some(c=>c.span>=5)){flush();blocks.push(<div key={'text-'+row.row} className="ddr-source-note">{row.cells.map(cell=><p key={cell.address}><CellValue navigation={navigation} cell={cell} slug={slug} index={index} glossary={glossary} emphasize chapterSlug={chapter.slug} inputControls={inputControls}/></p>)}</div>);continue;}
    const prose=!row.exportTable&&row.cells.length===1&&typeof row.cells[0].value==='string'&&row.cells[0].span>=5;
    const numbered=prose&&String(row.cells[0].value).split('\n');
    if(numbered&&numbered.length>1&&numbered.slice(1).every(line=>/^[①-⑩] .+｜.+/.test(line))){flush();const cell=row.cells[0];blocks.push(<div key={row.row} id={'cell-'+cell.address}><p><DdReportRichText navigation={navigation} text={numbered[0]} id={cell.address+'-intro'} slug={slug} glossary={glossary} interactive={!allRows} emphasize/></p><ol className="ddr-business-list">{numbered.slice(1).map((line,i)=>{const [name,...description]=line.split('｜');return <li key={i}><strong>{name}</strong><span><DdReportRichText navigation={navigation} text={description.join('｜')} id={cell.address+'-'+i} slug={slug} glossary={glossary} interactive={!allRows}/></span></li>;})}</ol></div>);continue;}
    if(head||prose){flush();const cell=row.cells[0];blocks.push(head?<h2 aria-label={String(cell.value)} key={row.row} id={'section-'+row.row}><DdReportSectionIcon title={String(cell.value)}/><CellValue navigation={navigation} cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug} inputControls={inputControls}/></h2>:<p key={row.row} className={cell.value&&String(cell.value).length<80?'ddr-intro':''}><CellValue navigation={navigation} cell={cell} slug={slug} index={index} glossary={glossary} allRows={allRows} emphasize chapterSlug={chapter.slug} inputControls={inputControls}/></p>);}
    else {if(tableRows.length){const lastGrid=[...tableRows].reverse().find(r=>r.cells.length>2);const positions=new Set([...(allRows?tableRows.flatMap(r=>r.cells.map(c=>c.column)):(lastGrid??tableRows[tableRows.length-1]).cells.map(c=>c.column)),...row.cells.map(c=>c.column)]);const widthsChanged=!allRows&&lastGrid&&row.cells.length>2&&Math.max(row.cells.length,lastGrid.cells.length)>16&&Math.min(row.cells.length,lastGrid.cells.length)<Math.max(row.cells.length,lastGrid.cells.length)*.5&&!row.cells.some(c=>c.span>1)&&!lastGrid.cells.some(c=>c.span>1);if(row.row-tableRows[tableRows.length-1].row>8||widthsChanged||positions.size>Math.max(row.cells.length,...tableRows.map(r=>r.cells.length))*1.25)flush();}tableRows.push(row);}
    for(const visual of body.visuals?.filter(v=>v.afterRow===row.row)??[]){flush();blocks.push(<DdReportVisual key={`visual-${visual.afterRow}-${visual.title}`} visual={visual} slug={slug} glossary={glossary} allRows={allRows}/>);}
  }
  flush();addObjects(Infinity);
  if(chapter.slug==='ip-contracts'&&body.patentTable&&body.ipLandscape){
    const patentRows=[body.patentTable.headerRow,...body.patentTable.recordRows].flatMap(n=>body.rows.filter(r=>r.row===n));
    blocks.push(<section key="other-patents" id="other-patents"><h2>他者特許一覧</h2><DdPatentTable rows={patentRows} landscape={body.ipLandscape} group="other" print={allRows} cell={c=><CellValue navigation={navigation} cell={c} slug={slug} index={index} glossary={glossary} allRows={allRows} chapterSlug={chapter.slug}/>}/></section>);
  }
  let orderedBlocks:ReactNode[]=blocks;
  if(body.sectionOrder?.length){
    const leading:ReactNode[]=[],sections=new Map<number,ReactNode[]>();let current:ReactNode[]=leading;
    for(const block of blocks){if(isValidElement<{id?:string}>(block)&&block.type==='h2'){const match=/^section-(\d+)$/.exec(block.props.id??'');if(match){current=[];sections.set(Number(match[1]),current);}}current.push(block);}
    const ordered=body.sectionOrder.filter(id=>sections.has(id));
    orderedBlocks=body.introAfterSection==null?[...leading]:[];
    for(const id of ordered){orderedBlocks.push(...sections.get(id)!);if(id===body.introAfterSection)orderedBlocks.push(...leading);}
    for(const [id,content] of sections)if(!ordered.includes(id))orderedBlocks.push(...content);
  }
  return <div className="ddr-content">{orderedBlocks}</div>;
}
