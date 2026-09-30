"use client";
import { useEffect, useState } from 'react';
import { Bzm22TimeLedgerSection } from './Bzm22TimeLedgerSection';
import { CockpitPlMonthlySection } from './CockpitPlMonthlySection';
import { AnnualProjectionTable } from './CockpitBusinessPlan';
import { CockpitFundingPlan } from './CockpitFundingPlan';
import { getCachedFundingPlan, loadFundingPlan } from './funding-plan-client';
import type { FundingPlan } from '@/lib/project-funding-plan';

export function CockpitFinancialProjection({ projectId, showSxDetail = false, showTimeLedger = false }: {
 projectId: string; showSxDetail?: boolean; showTimeLedger?: boolean;
}) {
 const [current,setCurrent]=useState<FundingPlan|null|undefined>(()=>projectId==='p21'?getCachedFundingPlan(projectId):null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;
  setCurrent(projectId==='p21'?getCachedFundingPlan(projectId):null);setError('');
  if(projectId==='p21') loadFundingPlan(projectId).then(p=>{if(!cancelled)setCurrent(p)}).catch(()=>{if(!cancelled)setError('資金計画を読み込めません。再読み込みしてください。')});
  return ()=>{cancelled=true};
 },[projectId]);
 const prior=<>{showTimeLedger&&<Bzm22TimeLedgerSection projectId={projectId}/>}<CockpitPlMonthlySection projectId={projectId}/>{showSxDetail&&<AnnualProjectionTable/>}</>;
 if(error) return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{error}</p>;
 if(current===undefined) return <div className="min-h-80 animate-pulse rounded-xl bg-slate-100 p-6 text-sm text-slate-500">資金計画を読み込み中…</div>;
 return <div className="min-w-0 space-y-5">{current?<>
  <CockpitFundingPlan plan={current}/>
  <details className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-700">従来の長期P/L・設備投資シミュレーション（再精査前の参考）</summary><p className="my-4 text-sm leading-6 text-slate-500">従来の売上・工場投資・資金調達の仮定を含む参考計画。今回の管理用支払予算とは会計上の費用認識・対象期間が異なる。シリーズA以降の損益・投資・調達の接続は再精査する。</p><div className="space-y-5">{prior}</div></details>
 </>:prior}</div>;
}
