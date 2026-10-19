import type {ReactNode} from 'react';
import type {DdReportCell,DdReportRow} from '@/lib/dd-report-types';

export function isDdGantt(rows:DdReportRow[]){return rows.length>2&&rows[0].cells.length>=4&&rows.slice(1).some(r=>r.cells.slice(1).some(c=>c.value==='実施'))&&rows.slice(1).every(r=>r.cells.slice(1).every(c=>c.value==='実施'||c.value===''));}
export function DdSourceGantt({rows,cell}:{rows:DdReportRow[];cell:(c:DdReportCell)=>ReactNode}){
  const periods=rows[0].cells.slice(1);
  return <figure className="ddr-source-gantt" aria-label="作業ごとの開始・終了と実施期間"><div className="ddr-gantt-heading"><span>{cell(rows[0].cells[0])}</span><div style={{gridTemplateColumns:`repeat(${periods.length},minmax(0,1fr))`}}>{periods.map(p=><span key={p.address}>{cell(p)}</span>)}</div></div>
    {rows.slice(1).map(r=>{const active=r.cells.slice(1).filter(c=>c.value==='実施').map(c=>({index:periods.findIndex(p=>p.column===c.column),cell:c})).filter(a=>a.index>=0);const groups:{start:number;end:number;cells:DdReportCell[]}[]=[];for(const a of active){const last=groups.at(-1);if(last&&last.end===a.index){last.end++;last.cells.push(a.cell);}else groups.push({start:a.index,end:a.index+1,cells:[a.cell]});}
      return <div className="ddr-gantt-row" key={r.row}><div className="ddr-gantt-task">{cell(r.cells[0])}</div><div className="ddr-gantt-track" style={{gridTemplateColumns:`repeat(${periods.length},minmax(0,1fr))`,backgroundSize:`${100/periods.length}% 100%`}}>{groups.map(g=><div className="ddr-gantt-bar" key={g.start} style={{gridColumn:`${g.start+1}/${g.end+1}`}} aria-label={`${r.cells[0].value}：${periods[g.start].value}〜${periods[g.end-1].value}`}><span className="ddr-visually-hidden">{g.cells.map(c=><span key={c.address}>{cell(c)}</span>)}</span></div>)}</div></div>;
    })}</figure>;
}
export function DdSourceFlow({nodes,arrows,cell}:{nodes:DdReportRow;arrows:DdReportRow;cell:(c:DdReportCell)=>ReactNode}){
  return <ol className="ddr-source-flow" aria-label="供給と工程の流れ">{nodes.cells.map((n,i)=><li key={n.address}><span className="ddr-flow-step">{String(i+1).padStart(2,'0')}</span><div>{cell(n)}</div>{arrows.cells[i]&&<span className="ddr-source-connector">{cell(arrows.cells[i])}</span>}</li>)}</ol>;
}
export function DdUeProcess({rows,cell}:{rows:DdReportRow[];cell:(c:DdReportCell)=>ReactNode}){
  const cells=new Map(rows.flatMap(r=>r.cells).map(c=>[c.address,c]));
  // Previously published editions retain their source-defined shared-culture route.
  if(!cells.has('B8')){
    const node=(a:string,cls:string)=>{const c=cells.get(a);return c?<div className={`ddr-ue-node ${cls}`}>{cell(c)}</div>:null;};
    const arrow=(a:string,cls:string)=>{const c=cells.get(a);return c?<div className={`ddr-ue-arrow ${cls}`} aria-hidden="true">{cell(c)}</div>:null;};
    return <figure className="ddr-ue-process" aria-label="自社培養から各工程への流れ"><div className="ddr-ue-grid">
      {node('B5','ddr-ue-production')}{arrow('E5','ddr-ue-to-holding')}{node('F5','ddr-ue-holding')}{arrow('I5','ddr-ue-to-shipping')}{node('J5','ddr-ue-shipping')}{arrow('F7','ddr-ue-to-fuel')}{arrow('J7','ddr-ue-to-treatment')}{node('F8','ddr-ue-fuel')}{node('J8','ddr-ue-treatment')}{arrow('J10','ddr-ue-to-metal')}{node('J11','ddr-ue-metal')}
    </div></figure>;
  }
  const path=(label:string,addresses:string[])=> <div className="ddr-ue-path"><strong>{label}</strong><ol>{addresses.map(address=>{const c=cells.get(address);return c?<li className="ddr-ue-node" key={address}>{cell(c)}</li>:null;})}</ol></div>;
  return <figure className="ddr-ue-process" aria-label="廃液処理用と燃料用を分けた培養・回収工程">
    <figcaption>用途ごとの培養・工程費用を積み上げ、全社の採算を評価する</figcaption>
    {path('廃液処理・金属資源化',['B5','F5','J5','J11'])}
    {path('バイオ燃料',['B8','F8','J8'])}
  </figure>;
}
