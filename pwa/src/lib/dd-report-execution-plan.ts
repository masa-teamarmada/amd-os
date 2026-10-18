import type {DdReportCell,DdReportRow} from './dd-report-types';

export const DD_EXECUTION_GROUPS=['事業開発','技術開発'] as const;
export type DdExecutionTask={row:number;group:typeof DD_EXECUTION_GROUPS[number];id:string;title:string;start:number;end:number;ongoing:boolean;cells:DdReportCell[]};
export const ddMonth=(year:number,month:number)=>year*12+month-1;
export const ddMonthLabel=(month:number)=>`${Math.floor(month/12)}/${String(month%12+1).padStart(2,'0')}`;
export const DD_EXECUTION_WINDOWS=[
  {label:'設立・初期実証',start:ddMonth(2026,10),end:ddMonth(2029,12)},
  {label:'量産・供給拡張',start:ddMonth(2030,1),end:ddMonth(2034,12)},
  {label:'IPO・海外展開',start:ddMonth(2035,1),end:ddMonth(2040,3)},
] as const;

/** Dates and details stay tied to the original task records, not a second schedule. */
export function ddExecutionTasks(rows:DdReportRow[]):DdExecutionTask[]{
  return rows.flatMap(row=>{
    const cells=row.cells,group=String(cells[0]?.value);
    if(cells.length!==6||!DD_EXECUTION_GROUPS.includes(group as typeof DD_EXECUTION_GROUPS[number])||!/^\w\d{2}$/.test(String(cells[1]?.value)))return [];
    const text=String(cells[2].value),dates=/(20\d{2})\/(\d{1,2})[〜～~](20\d{2})\/(\d{1,2})(以降も継続)?$/.exec(text);
    if(!dates)throw Error('工程の期間を確認できない: '+cells[1].value);
    const start=ddMonth(Number(dates[1]),Number(dates[2])),end=ddMonth(Number(dates[3]),Number(dates[4]));
    if(end<start)throw Error('工程の開始・終了が逆: '+cells[1].value);
    return [{row:row.row,group:group as DdExecutionTask['group'],id:String(cells[1].value),title:text.slice(0,dates.index).trim(),start,end,ongoing:!!dates[5],cells}];
  });
}
export function ddExecutionSpan(task:DdExecutionTask,window:typeof DD_EXECUTION_WINDOWS[number]){
  const end=task.ongoing?Math.max(task.end,window.end):task.end;
  if(task.start>window.end||end<window.start)return null;
  const count=window.end-window.start+1;
  return {left:(Math.max(task.start,window.start)-window.start)/count*100,width:(Math.min(end,window.end)-Math.max(task.start,window.start)+1)/count*100,continuesBefore:task.start<window.start,continuesAfter:end>window.end||task.ongoing};
}
export function ddExecutionQuarters(window:typeof DD_EXECUTION_WINDOWS[number]){
  const result:{label:string;start:number;months:number}[]=[];
  for(let start=window.start;start<=window.end;start+=3)result.push({label:`${Math.floor(start/12)} Q${Math.floor(start%12/3)+1}`,start,months:Math.min(3,window.end-start+1)});
  return result;
}
