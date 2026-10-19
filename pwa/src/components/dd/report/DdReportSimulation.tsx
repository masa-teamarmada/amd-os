import type {ReactNode} from 'react';
import type {DdReportInput,DdReportValue} from '@/lib/dd-report-types';
export type DdSimulationControls={inputs:DdReportInput[];sheet:string;values:Record<string,DdReportValue>;disabled:boolean;change:(key:string,value:DdReportValue)=>void};
/** Inputs stay beside their source labels; the PDF has no provider and keeps the value. */
export function DdReportInputValue({address,children,controls:ctx}:{address:string;children:ReactNode;controls?:DdSimulationControls}){
  const input=ctx?.inputs.find(i=>i.sheet===ctx.sheet&&i.address===address);
  if(!ctx||!input)return children;
  const key=`${input.sheet}!${input.address}`,value=ctx.values[key]??input.value;
  if(input.options?.length===1)return children;
  if(input.options?.length)return <span className="ddr-choice-switch" role="group" aria-label={input.label}>{input.options.map(option=><button key={option} type="button" aria-pressed={value===option} disabled={ctx.disabled} onClick={()=>ctx.change(key,option)}>{option}</button>)}</span>;
  if(typeof input.value==='number'){
    const percentage=/%/.test(input.format.replace(/"(?:[^"]|"")*"/g,'').replace(/\\./g,'')),scale=percentage?100:1;
    const display=value===null?'':percentage?String(Number((Number(value)*scale).toPrecision(12))):String(value);
    return <span className="ddr-number-input-group"><input className="ddr-simulation-input" aria-label={input.label} type="number" step="any" value={display} disabled={ctx.disabled} onChange={e=>{if(e.target.value.trim()!==''&&Number.isFinite(Number(e.target.value)))ctx.change(key,Number(e.target.value)/scale);}}/>{percentage&&<span>%</span>}</span>;
  }
  return children;
}
