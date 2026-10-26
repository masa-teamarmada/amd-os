'use client';
import {ddEmphasize} from './DdReportRichText';
import {DdPageIntroduction} from './DdPageIntroduction';
import {canonicalChapterHref,type CanonicalReportNavigation} from '../../../lib/project-canonical-links';
import {useEffect,useRef,useState} from 'react';
import type {DdProgressCategory,DdProgressEntry,DdProgressOverview as Progress,DdReportChapterSummary} from '../../../lib/dd-report-types';
const LANES:{key:DdProgressCategory;label:string}[]=[
  {key:'technology',label:'技術'},{key:'business',label:'事業'},{key:'organization',label:'組織・資金'},
];
const labels=Object.fromEntries(LANES.map(c=>[c.key,c.label]));
const states={confirmed:'確認済み',reported:'研究者報告',ongoing:'進行中',decision:'決定'};
export function DdProgressOverview({data,slug,index,print=false,navigation}:{data:Progress;slug:string;index:DdReportChapterSummary[];print?:boolean;navigation?:CanonicalReportNavigation}){
  const [activeId,setActiveId]=useState<string|null>(null);
  const dialogRef=useRef<HTMLDialogElement>(null);
  const active=data.entries.find(e=>e.id===activeId);
  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!dialog)return;
    if(activeId&&!dialog.open)dialog.showModal();
    if(!activeId&&dialog.open)dialog.close();
  },[activeId]);
  const entries=data.entries;
  const lanes=LANES;
  const periods=[...new Map(entries.map(e=>[e.period,e.periodLabel])).entries()];
  const milestone=data.milestone;
  const todos=milestone.todos;
  const href=(chapter:string,address?:string)=>index.some(c=>c.slug===chapter)?canonicalChapterHref(slug,chapter,navigation,address):undefined;
  const details=(entry:DdProgressEntry)=><>
    <div className="ddr-progress-detail-meta"><span>{entry.dateLabel}</span><span>{labels[entry.category]}</span><span className={'ddr-progress-state ddr-progress-state-'+entry.status}>{states[entry.status]}</span></div>
    <section><h3>実現・決定したこと</h3><p>{ddEmphasize(entry.result,true)}</p></section>
    <section><h3>何が前進したか</h3><p>{ddEmphasize(entry.impact,true)}</p></section>
    <section><h3>次に実施すること</h3><p>{ddEmphasize(entry.next,true)}</p></section>
    <div className="ddr-progress-detail-source">根拠：<a href={href(entry.sourceChapter,entry.sourceAddress)}>{entry.sourceLabel} ↗</a></div>
  </>;
  return <div className="ddr-progress">
    <DdPageIntroduction chapterSlug="progress" slug={slug} allRows={print} navigation={navigation}/>
    <div className="ddr-progress-asof">{data.asOf}時点</div>
    <section className="ddr-progress-milestone" aria-label="次のマイルストーンに向けたTODO">
      <div className="ddr-progress-milestone-label">次のマイルストーン</div>
      <div className="ddr-progress-milestone-heading"><h2>{milestone.title}</h2><span>{milestone.target}</span></div>
      <p className="ddr-progress-milestone-context">{ddEmphasize(milestone.context,true)} <a href={href(milestone.sourceChapter,milestone.sourceAddress)}>{milestone.sourceLabel} ↗</a></p>
      <p className="ddr-progress-rate-note">{ddEmphasize(milestone.progressNote,true)}</p>
      <div className="ddr-progress-todo-columns" aria-hidden="true"><span>完了させること</span><span>完了条件</span><span>担当・計画</span></div>
      <ol className="ddr-progress-todos">{todos.map(todo=>{
        const done=todo.checkpoints.filter(c=>c.done).length,total=todo.checkpoints.length,percent=total?Math.round(done/total*100):0;
        return <li key={todo.id} data-status={todo.status}>
          <div className="ddr-progress-todo-title"><h3>{todo.title}</h3>
            <div className="ddr-progress-rate"><strong>{percent}<span>%</span></strong><span>完了 {done} / {total} 項目</span></div>
            <div className="ddr-progress-bar" role="progressbar" aria-label={todo.title+'：達成率'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}%（${total}項目中${done}項目完了）`}><span style={{width:percent+'%'}} /></div>
          </div>
          <div className="ddr-progress-todo-evidence"><p className="ddr-progress-todo-completion">{ddEmphasize(todo.completion,true)}</p>
            <details className="ddr-progress-checkpoints" open={print||undefined}><summary>確認項目と根拠</summary><ul>{todo.checkpoints.map(check=><li key={check.id} data-done={check.done}>
              <span className="ddr-progress-check-state">{check.done?'完了':'未完了'}</span><div><strong>{check.title}</strong><p>{ddEmphasize(check.evidence,true)} <a href={href(check.sourceChapter,check.sourceAddress)}>根拠 ↗</a></p></div>
            </li>)}</ul></details>
          </div>
          <div className="ddr-progress-todo-owner"><span>{todo.owner}</span><a href={href(todo.sourceChapter,todo.sourceAddress)}>計画・根拠 ↗</a></div>
        </li>;
      })}</ol>
    </section>
    <div id="progress-timeline" className="ddr-progress-list-heading"><h2>これまでの進捗</h2></div>
    {print?<ol className="ddr-progress-print-list">{entries.map(entry=><li key={entry.id} className={'ddr-progress-entry ddr-progress-'+entry.category}><h2>{entry.title}</h2>{details(entry)}</li>)}</ol>:
      <section className="ddr-progress-timeline" aria-label="分野別の進捗タイムライン">
        <div className="ddr-progress-timeline-head"><span>時期</span>{lanes.map(lane=><h3 key={lane.key} className={'ddr-progress-lane-'+lane.key}>{lane.label}</h3>)}</div>
        {periods.map(([period,label])=><div key={period} className="ddr-progress-timeline-row" data-period={period}>
          <h3 className="ddr-progress-period">{label}</h3>
          {lanes.map(lane=><ul key={lane.key} className={'ddr-progress-timeline-lane ddr-progress-lane-'+lane.key} aria-label={`${label}の${lane.label}の進捗`}>
            {entries.filter(entry=>entry.period===period&&entry.category===lane.key).map(entry=><li key={entry.id} id={'progress-'+entry.id}>
              <button type="button" className="ddr-progress-event" aria-haspopup="dialog" aria-label={'詳細：'+entry.title} onClick={()=>setActiveId(entry.id)}>{entry.title}</button>
            </li>)}
          </ul>)}
        </div>)}
      </section>}
    {data.selectionNote&&<p className="ddr-progress-selection-note">{ddEmphasize(data.selectionNote,true)}</p>}
    {!print&&<dialog ref={dialogRef} className="ddr-progress-dialog" aria-labelledby="ddr-progress-dialog-title" onClose={()=>setActiveId(null)}>
      <div className="ddr-progress-dialog-toolbar"><span>進捗の詳細</span><button type="button" autoFocus onClick={()=>dialogRef.current?.close()}>閉じる <span aria-hidden="true">×</span></button></div>
      {active&&<div className="ddr-progress-dialog-body"><h2 id="ddr-progress-dialog-title">{active.title}</h2>{details(active)}</div>}
    </dialog>}
  </div>;
}
