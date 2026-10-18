import type {ReactNode} from 'react';
import {DD_EXECUTION_GROUPS,DD_EXECUTION_WINDOWS,ddExecutionQuarters,ddExecutionSpan,ddExecutionTasks,ddMonthLabel} from '@/lib/dd-report-execution-plan';
import type {DdReportCell,DdReportRow} from '@/lib/dd-report-types';

function positionTaskDetails(row:HTMLElement){const tooltip=row.querySelector<HTMLElement>('.ddr-execution-tooltip');if(tooltip)tooltip.dataset.below=String(row.getBoundingClientRect().top<(tooltip.offsetHeight||240)+16);}

export function DdExecutionGantt({rows,cell,windowIndex=0,onWindowChange,print=false}:{rows:DdReportRow[];cell:(c:DdReportCell)=>ReactNode;windowIndex?:number;onWindowChange?:(index:number)=>void;print?:boolean}){
  const tasks=ddExecutionTasks(rows),window=DD_EXECUTION_WINDOWS[windowIndex]??DD_EXECUTION_WINDOWS[0],quarters=ddExecutionQuarters(window),visible=tasks.filter(t=>ddExecutionSpan(t,window));
  return <section className={`ddr-execution-gantt${print?' ddr-execution-print':''}`} aria-label="短中期の実行工程ガント">
    {!print&&<div className="ddr-execution-windows" role="group" aria-label="工程の表示期間">{DD_EXECUTION_WINDOWS.map((w,i)=><button key={i} type="button" aria-pressed={i===windowIndex} onClick={()=>onWindowChange?.(i)}><strong>{w.label}</strong><span>{ddMonthLabel(w.start)}〜{ddMonthLabel(w.end)}</span></button>)}</div>}
    <p className="ddr-execution-help">{ddMonthLabel(window.start)}〜{ddMonthLabel(window.end)} · {visible.length}工程{print?'。担当・先行条件・完了条件の全文は同梱Excelの同名シートに収録。':'。矢羽にマウスを重ねるか、選択すると担当・先行条件・完了条件を表示。'}</p>
    <div className="ddr-execution-axis"><span>仕事・工程ID</span><div>{quarters.map(q=><span key={q.start}>{q.label.replace(' Q',' / Q')}</span>)}</div></div>
    {DD_EXECUTION_GROUPS.filter(group=>visible.some(t=>t.group===group)).map(group=><section key={group} className={`ddr-execution-group ddr-execution-group-${DD_EXECUTION_GROUPS.indexOf(group)}`}><h3>{group}<small>{visible.filter(t=>t.group===group).length}工程</small></h3>{visible.filter(t=>t.group===group).map(task=>{
      const span=ddExecutionSpan(task,window)!;
      return <div className="ddr-execution-row" data-task-id={task.id} key={task.id} onMouseEnter={e=>positionTaskDetails(e.currentTarget)} onFocus={e=>positionTaskDetails(e.currentTarget)}>
        <div className="ddr-execution-label"><span className="ddr-execution-id">{cell(task.cells[1])}</span><span>{cell({...task.cells[2],value:task.title})}</span><span className="ddr-visually-hidden">{cell(task.cells[0])}</span></div>
        <div className="ddr-execution-track" style={{backgroundSize:`${300/(window.end-window.start+1)}% 100%`}}><button type="button" className={`ddr-execution-arrow${span.continuesBefore?' ddr-from-before':''}${span.continuesAfter?' ddr-to-after':''}`} style={{left:span.left+'%',width:span.width+'%'}} aria-label={`${task.id} ${task.title}：${ddMonthLabel(task.start)}〜${ddMonthLabel(task.end)}${task.ongoing?'以降も継続':''}`} aria-describedby={'ddr-task-'+task.id} onKeyDown={e=>{if(e.key==='Escape')e.currentTarget.blur();}}><span>{ddMonthLabel(Math.max(task.start,window.start))}〜{span.continuesAfter?'継続':ddMonthLabel(task.end)}</span></button></div>
        {!print&&<div className="ddr-execution-tooltip" id={'ddr-task-'+task.id} role="tooltip"><strong>{task.id}　{task.title}</strong><p className="ddr-execution-dates">{ddMonthLabel(task.start)}〜{ddMonthLabel(task.end)}{task.ongoing?'以降も継続':''}</p><dl>{['担当','先行条件','完了条件・成果'].map((label,i)=><div key={label}><dt>{label}</dt><dd>{cell(task.cells[i+3])}</dd></div>)}</dl></div>}
      </div>;
    })}</section>)}
    <p className="ddr-execution-legend"><span>▶ 期間内に完了</span><span>» 表示期間の後も継続</span></p>
  </section>;
}

export function DdDevelopmentRoadmap({rows}:{rows:DdReportRow[]}){
  const tasks=ddExecutionTasks(rows),technical=tasks[0]?.group==='技術開発',lanes=technical?{P:'装置・工場',E:'性能・採算評価',S:'製造・品質・供給',R:'大学研究・燃料'}:{M:'経営・契約・上場',F:'資金調達・財務',O:'採用・組織',B:'顧客・事業拡大'};
  const years=Array.from({length:15},(_,i)=>2026+i);
  return <figure className="ddr-development-roadmap"><figcaption>長期の工程構成<span>短中期の個別作業は下のガントで確認</span></figcaption><div className="ddr-roadmap-head"><span>領域</span><div>{years.map(y=><span key={y}>{y}</span>)}</div></div>{Object.entries(lanes).map(([prefix,label])=>{const group=tasks.filter(t=>t.id.startsWith(prefix));return <div className="ddr-roadmap-lane" key={prefix}><strong>{label}</strong><div>{years.map(year=>{const count=group.filter(t=>Math.floor(t.start/12)<=year&&(t.ongoing||Math.floor(t.end/12)>=year)).length;return <span key={year} className={count?'ddr-roadmap-active':''} title={`${year}年：${count}工程`}>{count||''}</span>;})}</div></div>;})}<p>色の付いた年は実行する工程がある期間。数字はその年に実行する工程数。</p></figure>;
}
