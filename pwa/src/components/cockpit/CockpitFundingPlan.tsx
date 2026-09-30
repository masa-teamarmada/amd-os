"use client";
import { useState } from 'react';
import type { FundingPlan, FundingScenarioMonth } from '@/lib/project-funding-plan';
const million=(v:number)=> (v===0?0:v/1e6).toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2});
const money=(v:number)=>Math.abs(v)>=1e8?`${(v/1e8).toLocaleString('ja-JP',{maximumFractionDigits:2})}億円`:`${Math.round(v/1e4).toLocaleString('ja-JP')}万円`;
const ym=(v:string)=>`${v.slice(0,4)}年${Number(v.slice(5))}月`;
const cell='whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right tabular-nums';

function CashChart({rows,reserve}:{rows:Array<FundingScenarioMonth&{ym:string}>;reserve:number}) {
 const values=rows.map(r=>r.closingYen/1e6), upper=Math.ceil(Math.max(...values,reserve/1e6)/25)*25;
 const lower=Math.min(0,Math.floor(Math.min(...values)/25)*25), height=upper-lower || 1;
 const x=(i:number)=>50+i*650/Math.max(1,rows.length-1), y=(v:number)=>25+(upper-v)/height*185;
 const path=values.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' ');
 return <figure className="min-w-0"><figcaption className="mb-3 text-sm font-semibold text-slate-800">月末現金残高 <span className="font-normal text-slate-500">（百万円）</span></figcaption>
  <svg viewBox="0 0 740 265" className="block w-full" role="img" aria-label={`月末現金残高。${rows.map(r=>`${ym(r.ym)} ${money(r.closingYen)}`).join('、')}`}>
   {[lower,(upper+lower)/2,upper].map(v=><g key={v}><line x1="50" x2="710" y1={y(v)} y2={y(v)} stroke="#e2e8f0"/><text x="42" y={y(v)+5} textAnchor="end" className="text-[28px] sm:text-[14px]" fill="#64748b">{v}</text></g>)}
   <line x1="50" x2="710" y1={y(reserve/1e6)} y2={y(reserve/1e6)} stroke="#64748b" strokeDasharray="6 5"/>
   <path d={path} fill="none" stroke="#2563eb" strokeWidth="3"/>
   {values.map((v,i)=><g key={rows[i].ym}><circle cx={x(i)} cy={y(v)} r="3.5" fill="#2563eb"/><title>{`${ym(rows[i].ym)}：${million(rows[i].closingYen)}百万円`}</title>{(i%2===0||i===7||i===rows.length-1)&&<text x={x(i)} y="239" textAnchor="middle" className={`${i===0||i===7||i===rows.length-1?"":"hidden sm:inline"} text-[28px] sm:text-[14px]`} fill="#475569">{rows[i].ym.slice(2).replace('-','/')}</text>}</g>)}
  </svg><p className="text-sm text-slate-500">破線：通常支出3か月分 {million(reserve)}百万円。純改善目標は月次残高に未計上。</p></figure>;
}
const cashMetrics:Array<{label:string;key:keyof FundingScenarioMonth;negative?:boolean;balance?:boolean}>=[
 {label:'月初現金',key:'openingYen',balance:true},{label:'通常支出（税込）',key:'ordinarySpendYen',negative:true},
 {label:'設備・初期費用（税込）',key:'equipmentSpendYen',negative:true},{label:'融資利息・手数料',key:'interestYen',negative:true},
 {label:'シード入金',key:'seedInflowYen'},{label:'ブリッジ出資',key:'bridgeInflowYen'},
 {label:'支払前の借入',key:'loanDrawdownYen'},{label:'NEDO入金',key:'grantReceiptYen'},{label:'同月の元本返済',key:'loanRepaymentYen',negative:true},
 {label:'月間資金増減',key:'netCashFlowYen'},{label:'月末現金',key:'closingYen',balance:true},{label:'月末借入残高',key:'loanBalanceYen',balance:true},
];
export function CockpitFundingPlan({plan}:{plan:FundingPlan}) {
 const [scenario,setScenario]=useState('adopted');
 const s=plan.summary;
 const rows=plan.months.map(m=>({...m.planning_details_json.scenarios.find(x=>x.key===scenario)!,ym:m.ym}));
 const last=rows.at(-1)!;
 const bridge=rows.reduce((a,r)=>a+r.bridgeInflowYen,0);
 const spend=rows.reduce((a,r)=>a+r.ordinarySpendYen+r.equipmentSpendYen+r.interestYen,0);
 return <section data-testid="current-funding-plan" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 sm:p-6">
  <header className="border-b border-slate-200 pb-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">シードからシリーズAまでの資金計画</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">{s.asOf}改定・計画値</span></div>
   <p className="mt-2 leading-6">{ym(s.startYm)}〜{ym(s.endYm)}。シード{money(s.seedAmountYen)}を起点に、{ym(s.nextRoundYm)}のシリーズA払込を目指す。</p>
   <p className="mt-1 leading-6 text-slate-500">シリーズAの新規調達額：{s.nextRoundAmountYen===null?'必要額を再精査':money(s.nextRoundAmountYen)}。事業化目標は有償PoC 3件と、顧客・技術・採算・供給・体制の検証。</p>
  </header>
  <div className="my-5 flex flex-wrap gap-2" role="group" aria-label="資金計画のケース">
   {plan.months[0].planning_details_json.scenarios.map(c=><button key={c.key} type="button" aria-pressed={c.key===scenario} onClick={()=>setScenario(c.key)} className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${c.key===scenario?'border-blue-600 bg-blue-600 text-white':'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{c.label}</button>)}
  </div>
  <p className="mb-5 leading-6">{s.cases.find(c=>c.key===scenario)?.description}</p>
  <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
   <CashChart rows={rows} reserve={s.reserveYen}/>
   <div className="flex flex-col justify-center gap-4 border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
    <div><p className="text-slate-500">{ym(s.endYm)}末の現金</p><p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{money(last.closingYen)}</p></div>
    <div><p className="text-slate-500">支出総額（{rows.length}か月）</p><p className="mt-1 text-xl font-semibold">{money(spend)}</p></div>
    <div><p className="text-slate-500">計上するブリッジ出資</p><p className="mt-1 text-xl font-semibold">{bridge?money(bridge):'なし'}</p></div>
    <div className="border-t border-slate-200 pt-4 text-blue-700"><p>未達の純改善目標 ＋{money(s.improvementTargetYen)}</p><p className="mt-1 font-semibold">達成時の6月末現金 {money(last.closingYen+s.improvementTargetYen)}</p></div>
   </div>
  </div>
  <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-y border-slate-200 py-4">
   <span>J-KISS 2.0／シード{money(s.seedAmountYen)}</span><span>ポストキャップ{money(s.postMoneyCapYen)}</span><span>ディスカウント{Math.round(s.discount*100)}％</span><span>転換条件案：次回の新規株式調達{money(s.conversionTriggerYen)}以上</span>
  </div>
  <p className="mt-4 leading-6">期間中の最大借入残高 {money(Math.max(...rows.map(r=>r.peakLoanYen)))}。融資相談枠の目安 {money(s.loanFacilityTargetYen)}（未合意）。</p>
  <h3 className="mb-3 mt-6 text-base font-semibold text-slate-900">月次の入出金と残高 <span className="text-sm font-normal text-slate-500">単位：百万円</span></h3>
  <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100"><th className={`${cell} sticky left-0 z-10 bg-slate-100 text-left`}>項目</th>{rows.map(r=><th key={r.ym} className={cell}>{r.ym.slice(2).replace('-','/')}</th>)}</tr></thead>
   <tbody>{cashMetrics.map(metric=><tr key={metric.key} className={metric.key==='closingYen'?'bg-blue-50 font-semibold':''}><th scope="row" className={`${cell} sticky left-0 z-10 text-left ${metric.key==='closingYen'?'bg-blue-50':'bg-white'}`}>{metric.label}</th>{rows.map(r=><td key={r.ym} className={cell}>{million((r[metric.key] as number)*(metric.negative?-1:1))}</td>)}</tr>)}</tbody></table></div>
  <p className="mt-2 leading-6 text-slate-500">支払前に借り入れ、NEDO入金のある月に元本を返済。端数は円単位で調整し、表示は四捨五入。6月末借入には7月支払に備えた借入を含む。</p>
  {s.bridgePolicy.length>0&&<><h3 className="mb-3 mt-7 text-base font-semibold text-slate-900">採択・不採択時の調達方針</h3>
  <div className="space-y-3 leading-6">{s.bridgePolicy.map(t=><p key={t}>{t}</p>)}</div></>}
  <div className="mt-7 grid gap-6 xl:grid-cols-2">
   <div><h3 className="mb-3 text-base font-semibold text-slate-900">通常費用の前提 <span className="text-sm font-normal text-slate-500">百万円／月・税抜等</span></h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className={`${cell} text-left`}>費用</th><th className={cell}>月額</th><th className={cell}>扱い</th></tr></thead><tbody>{s.monthlyCosts.map(c=><tr key={c.label}><th className={`${cell} whitespace-normal text-left font-normal`}>{c.label}</th><td className={cell}>{million(c.amountYen)}</td><td className={cell}>{c.status}</td></tr>)}</tbody></table></div><p className="mt-2 leading-6 text-slate-500">大学研究費は年1,000万円・間接経費込み。表は月割り、支払計画は四半期末。消費税・社保等は試算の前提に従う。</p></div>
   <div><h3 className="mb-3 text-base font-semibold text-slate-900">設備・初期費用の予算 <span className="text-sm font-normal text-slate-500">百万円・税込等</span></h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className={`${cell} text-left`}>項目</th><th className={cell}>支出額</th><th className={cell}>納品等</th></tr></thead><tbody>{s.equipment.map(c=><tr key={c.label}><th className={`${cell} whitespace-normal text-left font-normal`} title={c.note||undefined}>{c.label}</th><td className={cell}>{million(c.amountYen)}</td><td className={cell}>{c.deliveryYm.slice(2).replace('-','/')}</td></tr>)}</tbody></table></div><p className="mt-2 leading-6 text-slate-500">各費用は見積前の仮配賦。支払は前払・納品時などの条件を月次計画に反映。</p></div>
  </div>
  {s.assumptions.length>0&&<details className="mt-7 rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer font-semibold text-slate-900">STS対象経費・支払時期・未確定条件</summary><div className="mt-4 space-y-3 leading-6">{s.assumptions.map(t=><p key={t}>{t}</p>)}</div></details>}
  <p className="mt-4 leading-6 text-slate-500">{s.source.adoptedMaterial?`採用資料：${s.source.adoptedMaterial}。`:''}{s.source.cutoff}</p>
 </section>;
}
