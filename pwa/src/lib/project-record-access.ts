import type {DdLiveProjectPage} from '@/lib/dd-project-page-types';
/** 保存内容へ触れず、同じ本人の操作権限を既存の各部品へ渡す。 */
export function projectRecordAccess(record:DdLiveProjectPage|null,canEdit:boolean):DdLiveProjectPage|null{
 if(!record)return null;
 const data=structuredClone(record);
 if('poc' in data)data.poc.canEdit=canEdit;
 if('tech' in data)data.tech.canEdit=canEdit;
 if('tree' in data)data.tree.canManage=canEdit;
 if('management' in data)data.management.canManage=canEdit;
 if('contracts' in data)data.contracts.canManage=canEdit;
 if('portfolio' in data)data.portfolio.canEdit=canEdit;
 if('costs' in data){if(data.costs.main)data.costs.main.canEdit=canEdit;if(data.costs.fuel)data.costs.fuel.canEdit=canEdit;}
 if('businessSummary' in data&&data.businessSummary?.viewer)data.businessSummary.viewer.canEdit=canEdit;
 return data;
}

