import type {ReactNode} from 'react';
import type {DdReportInput,DdReportValue} from '@/lib/dd-report-types';
export type DdSimulationControls={inputs:DdReportInput[];sheet:string;values:Record<string,DdReportValue>;disabled:boolean;change:(key:string,value:DdReportValue)=>void};
/** Inputs stay beside their source labels; the PDF has no provider and keeps the value. */
export function DdReportInputValue({address,children,controls:ctx}:{address:string;children:ReactNode;controls?:DdSimulationControls}){
  const input=ctx?.inputs.find(i=>i.sheet===ctx.sheet&&i.address===address);
  if(!ctx||!input)return children;
  const key=`${input.sheet}!${input.address}`,value=ctx.values[key]??input.value;
  if(input.options?.length)return <select className="ddr-simulation-input" aria-label={input.label} value={String(value??'')} disabled={ctx.disabled} onChange={e=>ctx.change(key,e.target.value)}>{input.options.map(v=><option key={v} value={v}>{v}</option>)}</select>;
  if(typeof input.value==='number')return <input className="ddr-simulation-input" aria-label={input.label} type="number" step="any" value={value===null?'':String(value)} disabled={ctx.disabled} onChange={e=>{if(e.target.value.trim()!==''&&Number.isFinite(Number(e.target.value)))ctx.change(key,Number(e.target.value));}}/>;
  return children;
}
