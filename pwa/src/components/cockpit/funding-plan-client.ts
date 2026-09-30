import { createClient } from '@/lib/supabase/client';
import { loadReferenceData, peekReferenceData, invalidateReferenceData } from '@/lib/reference-data-cache';
import { resolveFundingPlan, type FundingPlan, type FundingPlanningDetails } from '@/lib/project-funding-plan';
const key=(id:string)=>`cockpit/funding-plan/${id}`;
export const getCachedFundingPlan=(id:string)=>peekReferenceData<FundingPlan|null>(key(id));
export const invalidateFundingPlan=(id:string)=>invalidateReferenceData(key(id));
export function loadFundingPlan(projectId:string):Promise<FundingPlan|null> {
  return loadReferenceData(key(projectId), async()=>{
    const supabase=createClient();
    const rows:Array<{ym:string;planning_details_json:FundingPlanningDetails|null}>=[];
    for(let from=0;;from+=500){
      const {data,error}=await supabase.from('project_monthly_cashflow').select('ym,planning_details_json')
        .eq('project_id',projectId).not('planning_details_json','is',null).order('ym').range(from,from+499);
      if(error) throw new Error('資金計画を読み込めません。再読み込みしてください。');
      rows.push(...(data??[]));
      if((data?.length??0)<500) break;
    }
    return resolveFundingPlan(rows);
  });
}
