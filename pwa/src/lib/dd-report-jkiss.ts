import {DdReportCalculator} from './dd-report-model';
export type DdJkissCase={pre:number;rule:string;price:number;before:number;after:number};
export type DdJkissSummary={seed:number;cap:number;discount:number;pre:number;funding:number;qualifying:number;rule:string;price:number;shares:number;before:number;after:number;theoreticalBoundary:number;discountMaxPre:number;cases:DdJkissCase[]};
/** Compare illustrative A valuations with the actual capital-policy formula engine. */
export function ddJkissSummary(calc:DdReportCalculator):DdJkissSummary|undefined {
  const sheet='資本政策表';if(!calc.model.sheets[sheet]?.cells.L215||!calc.model.sheets['共通前提']?.cells.C20)return;
  const n=(a:string)=>Number(calc.get(sheet,a));
  const seed=n('L191'),cap=n('L192'),discount=n('L193'),pre=n('L194'),funding=n('L195');
  const theoreticalBoundary=cap/(1-discount),discountMaxPre=(n('L199')-1)*(n('L190')+n('L200'))/(1-discount);
  const values=[theoreticalBoundary*.8,pre,Math.round(theoreticalBoundary/1e6-1)*1e6,theoreticalBoundary,theoreticalBoundary*1.2];
  const cases=[...new Set(values.map(Math.round))].filter(v=>v>seed/(1-discount)).sort((a,b)=>a-b).map(v=>{
    const c=new DdReportCalculator(calc.model,{...calc.overrides,'共通前提!C20':v});
    return {pre:v,rule:String(c.get(sheet,'L202')),price:Number(c.get(sheet,'L206')),before:Number(c.get(sheet,'L214')),after:Number(c.get(sheet,'L215'))};
  });
  return {seed,cap,discount,pre,funding,qualifying:n('L196'),rule:String(calc.get(sheet,'L202')),price:n('L206'),shares:n('L207'),before:n('L214'),after:n('L215'),theoreticalBoundary,discountMaxPre,cases};
}
