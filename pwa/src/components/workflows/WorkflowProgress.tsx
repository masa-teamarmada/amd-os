import {ArrowRight,ArrowDown,Check} from 'lucide-react';
import {workflowProgress,type WorkflowStatus} from '@/lib/workflows';
// Intent: show the handoff from requester to Kiyo as a connected route, not six unrelated rows.
// Paper/ink/quiet rules; completed check, current outline, and five directional connectors.
export function WorkflowProgress({status,requester,approver,signedArtifact=false}:{status:WorkflowStatus;requester:string;approver:string;signedArtifact?:boolean}) {
 const steps=workflowProgress(status,requester,approver,signedArtifact);const current=steps.find(step=>step.state==='current');
 const lines=[['開始'],['契約書の','準備'],['きよの承認'],['押印','締結版保存'],['締結版の','照合'],['完了']];
 const labels={done:'完了',current:'現在',pending:'これから',stopped:'停止'};
 return <section aria-label="フローのステップ" className="space-y-3 border-y border-border py-3">
  <h3 className="font-semibold">フローの進み方</h3>
  <ol className="grid gap-6 md:grid-cols-6" aria-label="開始から完了までの契約フロー">
   {steps.map((step,index)=><li key={step.label} aria-current={step.state==='current'?'step':undefined} className="relative min-w-0">
    <div className={`flex h-full min-w-0 items-center gap-3 border p-3 md:flex-col md:items-start md:gap-2 md:p-2 ${step.state==='current'?'border-primary bg-primary/5':'border-border bg-background'}`}>
     <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums ${step.state==='done'?'border-foreground bg-foreground text-background':step.state==='current'?'border-primary font-semibold text-primary':'border-border text-foreground/70'}`}>{step.state==='done'?<Check aria-hidden="true" className="size-3.5"/>:index+1}<span className="sr-only">ステップ{index+1}</span></span>
     <div className="min-w-0 flex-1"><p className={`break-words text-sm leading-5 ${step.state==='current'?'font-semibold':''}`}><span className="md:hidden">{step.label}</span><span className="hidden md:block">{lines[index].map((line,i)=><span className="block" key={i}>{line}</span>)}</span></p><p className="mt-1 break-words text-xs leading-5 text-foreground/70">{step.owner==='—'?'照合を記録':`担当：${step.owner}`}</p></div>
     <span className={`shrink-0 text-xs md:mt-auto ${step.state==='current'?'font-semibold text-primary':'text-foreground/70'}`}>{labels[step.state]}</span>
    </div>
    {index<steps.length-1&&<span aria-hidden="true" data-workflow-connector className={`absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center justify-center md:bottom-auto md:left-auto md:-right-5 md:top-1/2 md:translate-x-0 md:-translate-y-1/2 ${step.state==='done'?'text-foreground':'text-foreground/70'}`}><ArrowDown className="size-4 md:hidden"/><ArrowRight className="hidden size-4 md:block"/></span>}
   </li>)}
  </ol>
  <div className="border-l-2 border-primary bg-muted/30 px-3 py-2"><p className="text-sm leading-6">{current?<><strong>次にやること：{current.detail}</strong><br/><span className="text-foreground/70">担当：{current.owner}</span></>:status==='cancelled'?'このフローは取り下げられた。履歴は保存されている。':'きよの締結版照合が完了。'}</p></div>
 </section>;
}
