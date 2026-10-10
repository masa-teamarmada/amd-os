import {workflowProgress,type WorkflowStatus} from '@/lib/workflows';

export function WorkflowProgress({status,requester,approver,signedArtifact=false}:{status:WorkflowStatus;requester:string;approver:string;signedArtifact?:boolean}) {
 const steps=workflowProgress(status,requester,approver,signedArtifact);
 const current=steps.find(step=>step.state==='current');
 const labels={done:'完了',current:'現在',pending:'これから',stopped:'停止'};
 return <section aria-label="フローのステップ" className="border-y border-border">
  <div className="bg-muted/30 px-3 py-2">
   <h3 className="font-semibold">フローの進み方</h3>
   <p className="mt-1 text-sm leading-6">{current?<><strong>{current.label}</strong> / 担当：{current.owner}<br/>{current.detail}</>:status==='cancelled'?'このフローは取り下げられた。履歴は保存されている。':'きよの締結版照合が完了。'}</p>
  </div>
  <ol className="divide-y divide-border">
   {steps.map((step,index)=><li key={step.label} aria-current={step.state==='current'?'step':undefined} className={`grid grid-cols-[24px_minmax(0,1fr)_64px] items-center gap-2 px-3 py-2 ${step.state==='current'?'bg-primary/5':''}`}>
    <span className={`text-xs tabular-nums ${step.state==='current'?'font-semibold text-primary':'text-muted-foreground'}`}>{index+1}</span>
    <div className="min-w-0"><p className={`text-sm ${step.state==='current'?'font-semibold':''}`}>{step.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{step.owner==='—'?'照合結果の記録':`担当：${step.owner}`}</p></div>
    <span className={`text-right text-xs ${step.state==='current'?'font-semibold text-primary':'text-muted-foreground'}`}>{labels[step.state]}</span>
   </li>)}
  </ol>
 </section>;
}
