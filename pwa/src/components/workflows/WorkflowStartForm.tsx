'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {WORKFLOW_CONTRACT_TYPES,type WorkflowContract} from '@/lib/workflows';

export type WorkflowStartInput={action:'start';startId:string;contractId:string;projectId:string;contractTitle:string;counterpartyName:string;contractType:string;purpose:string;desiredDate:string};
export const workflowInputClass='min-h-11 w-full min-w-0 rounded-none border border-border bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary';
export function WorkflowStartForm({contracts,contractCount,projects,busy,error,initialContractId='',onSearch,onStart,onClose}:{contracts:WorkflowContract[];contractCount:number;projects:Array<{project_id:string;project_name:string}>;busy:boolean;error:string;initialContractId?:string;onSearch:(query:string)=>Promise<void>;onStart:(input:WorkflowStartInput)=>Promise<void>;onClose:()=>void}) {
 const [mode,setMode]=useState<'new'|'existing'>(initialContractId?'existing':'new');
 const [startId]=useState(()=>crypto.randomUUID());
 const [contractId,setContractId]=useState(initialContractId);const [search,setSearch]=useState('');
 const [projectId,setProjectId]=useState('');const [contractTitle,setContractTitle]=useState('');const [counterpartyName,setCounterpartyName]=useState('');const [contractType,setContractType]=useState('');const [purpose,setPurpose]=useState('');const [desiredDate,setDesiredDate]=useState('');const [partyConfirmed,setPartyConfirmed]=useState(false);
 const selected=contracts.find(c=>c.contract_id===contractId);
 return <form className="space-y-4" onSubmit={event=>{event.preventDefault();void onStart({action:'start',startId,contractId:mode==='existing'?contractId:'',projectId,contractTitle,counterpartyName,contractType,purpose,desiredDate});}}>
  <fieldset disabled={busy} className="space-y-4">
   <legend className="sr-only">開始する契約</legend>
   <div className="grid grid-cols-2 border-b border-border" role="group" aria-label="契約の登録方法">{([['new','新しい契約'],['existing','登録済みの契約']] as const).map(([value,label])=><Button key={value} type="button" variant="ghost" aria-pressed={mode===value} className={`min-h-11 rounded-none border-b-2 ${mode===value?'border-primary font-semibold':'border-transparent text-muted-foreground'}`} onClick={()=>setMode(value)}>{label}</Button>)}</div>
   {mode==='new'?<>
    <div className="grid gap-3 sm:grid-cols-2">
     <label className="block text-sm font-medium">相手先<input autoFocus required maxLength={240} className={`mt-1 ${workflowInputClass}`} value={counterpartyName} onChange={e=>setCounterpartyName(e.target.value)} placeholder="会社・団体の正式名称"/></label>
     <label className="block text-sm font-medium">契約の種類<select required className={`mt-1 ${workflowInputClass}`} value={contractType} onChange={e=>setContractType(e.target.value)}><option value="">種類を選択</option>{Object.entries(WORKFLOW_CONTRACT_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <label className="block text-sm font-medium">契約名<input required maxLength={240} className={`mt-1 ${workflowInputClass}`} value={contractTitle} onChange={e=>setContractTitle(e.target.value)} placeholder="相手先との契約を識別できる名前"/></label>
    <label className="block text-sm font-medium">対象PJ<select required className={`mt-1 ${workflowInputClass}`} value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">対象PJを選択</option>{projects.map(project=><option value={project.project_id} key={project.project_id}>{project.project_name}</option>)}</select></label>
    <label className="flex min-h-11 items-start gap-2 text-sm leading-6"><input required type="checkbox" className="mt-1 size-5 shrink-0" checked={partyConfirmed} onChange={e=>setPartyConfirmed(e.target.checked)}/><span>株式会社チームアルマダが当事者となる契約</span></label>
   </>:<>
    <div><label className="block text-sm font-medium" htmlFor="workflow-contract-search">契約を検索</label><div className="mt-1 flex gap-2"><input id="workflow-contract-search" className={workflowInputClass} value={search} onChange={e=>setSearch(e.target.value)} placeholder="契約名・相手先"/><Button className="min-h-11 shrink-0" type="button" variant="outline" onClick={()=>void onSearch(search)}>検索</Button></div></div>
    <label className="block text-sm font-medium">契約<select required className={`mt-1 ${workflowInputClass}`} value={contractId} onChange={e=>setContractId(e.target.value)}><option value="">未締結の契約を選択</option>{contracts.map(c=><option key={c.contract_id} value={c.contract_id}>{c.contract_title} / {c.counterparty_name||'相手先未確認'}</option>)}</select></label>
    {contractCount>100&&<p className="text-xs text-muted-foreground">候補は最新100件。契約名・相手先で検索。</p>}
    {selected&&<dl className="grid gap-3 border-y border-border py-3 sm:grid-cols-2">{[['相手先',selected.counterparty_name||'未確認'],['契約の種類',WORKFLOW_CONTRACT_TYPES[selected.contract_type]||selected.contract_type]].map(([label,value])=><div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl>}
   </>}
   <label className="block text-sm font-medium">契約の目的・確認してほしい点<textarea className={`mt-1 ${workflowInputClass}`} rows={3} required maxLength={2000} value={purpose} onChange={e=>setPurpose(e.target.value)}/></label>
   <label className="block text-sm font-medium">押印希望日（任意）<input type="date" className={`mt-1 ${workflowInputClass}`} value={desiredDate} onChange={e=>setDesiredDate(e.target.value)}/></label>
  </fieldset>
  <div className="border-y border-border bg-muted/30 px-3 py-2 text-xs leading-6"><p className="font-medium">開始後の流れ</p><p>契約書の準備 → きよの承認 → 押印・締結版の保存 → 締結版の照合 → 完了</p></div>
  {error&&<p role="alert" className="text-destructive">{error}</p>}
  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3"><Button className="min-h-11" type="button" variant="outline" disabled={busy} onClick={onClose}>閉じる</Button><Button className="min-h-11" disabled={busy} type="submit">{busy?'開始中…':'契約フローを開始'}</Button></div>
 </form>;
}
