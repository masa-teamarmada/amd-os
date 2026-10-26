import type {DdReportVisual as Visual,DdReportGlossary} from '@/lib/dd-report-types';
import {DdReportRichText} from './DdReportRichText';
import {DdProcessIllustration,ddProcessIllustrationKind} from './DdProcessIllustration';


function monthIndex(month:string){const [y,m]=month.split('-').map(Number);return y*12+m-1;}
function DdPlanTimeline({visual,slug,glossary,allRows}:{visual:Visual;slug:string;glossary?:DdReportGlossary;allRows?:boolean}) {
  const time=visual.timeline!;const start=monthIndex(time.start),end=monthIndex(time.end),total=end-start+1,prelude=5;
  const column=(month:string)=>2+prelude+monthIndex(month)-start;
  const ticks=[{month:'2027-04',label:'2027年4月'},{month:'2027-10',label:'10月'},{month:'2028-04',label:'2028年4月'},{month:'2028-10',label:'10月'},{month:'2029-02',label:'2029年2月'}];
  return <div className="ddr-plan-timeline-scroll"><figure className={`ddr-plan-timeline${allRows?' ddr-plan-timeline-print':''}`} aria-label={visual.title}>
    <figcaption>{visual.title}</figcaption><div className="ddr-plan-timeline-axis"><span>時期</span><span className="ddr-plan-prelude">設立前<br/>〜2027年3月</span>{ticks.filter(t=>monthIndex(t.month)>=start&&monthIndex(t.month)<=end).map((t,i)=><span key={t.month} className={`ddr-plan-tick${i===ticks.length-1?' ddr-plan-last':''}`} style={{gridColumn:`${column(t.month)} / span 3`}}>{t.label}</span>)}</div>
    {time.lanes.map((lane,li)=><div key={lane} className="ddr-plan-timeline-lane" role="group" aria-label={lane}><h3>{lane}</h3>{visual.nodes.filter(n=>n.period?.lane===li).map((n,ni)=>{
      const p=n.period!,first=p.start?column(p.start):2,last=p.contentEnd?column(p.contentEnd)+1:p.start?(p.end?column(p.end)+1:column(p.start)+1):2+prelude;
      const periodSpan=p.start?(p.end?monthIndex(p.end)-monthIndex(p.start)+1:1):prelude;
      return <article key={n.title} className="ddr-plan-timeline-item" data-point={p.point||undefined} data-start={p.start??'prelude'} data-end={p.end??p.start??'2027-03'} style={{gridColumn:`${first} / ${Math.min(last,2+prelude+total)}`}}><div className="ddr-plan-period" style={{width:`${100*periodSpan/(last-first)}%`}}/><div className="ddr-plan-timeline-date">{p.label}</div><strong>{n.title}</strong><div className="ddr-plan-timeline-text"><DdReportRichText text={n.text} id={`timeline-${visual.afterRow}-${li}-${ni}`} slug={slug} glossary={glossary} interactive={!allRows} emphasize/></div></article>;
    })}</div>)}
  </figure></div>;
}

/** Content-defined diagrams use the same versioned body in the browser and PDF. */
export function DdReportVisual({visual,slug,glossary,allRows}:{visual:Visual;slug:string;glossary?:DdReportGlossary;allRows?:boolean}) {
  if(visual.timeline)return <DdPlanTimeline visual={visual} slug={slug} glossary={glossary} allRows={allRows}/>;
  const metalFlow=visual.kind==='flow'&&visual.nodes.some(n=>/金属/.test(n.title+n.text))&&visual.nodes.some(n=>/抽出|分離/.test(n.title));
  return <figure className={`ddr-visual ddr-visual-${visual.kind}`} aria-label={visual.title}>
    <figcaption>{visual.title}</figcaption><ol>{visual.nodes.map((node,i)=>{const art=node.illustration??(metalFlow?ddProcessIllustrationKind(node.title):null);return <li key={i} className={art?'ddr-visual-with-art':undefined}>
      {art&&<DdProcessIllustration kind={art}/>}<div>
      <div className="ddr-visual-step"><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span><strong>{node.title}</strong></div>
      <div className="ddr-visual-text"><DdReportRichText text={node.text} id={`visual-${visual.afterRow}-${i}`} slug={slug} glossary={glossary} interactive={!allRows} emphasize/></div>
      </div>
      {visual.kind==='flow'&&i<visual.nodes.length-1&&<svg className="ddr-visual-arrow" viewBox="0 0 24 16" aria-hidden="true"><path d="M1 8h20m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>}
    </li>;})}</ol>
  </figure>;
}
