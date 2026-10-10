'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Upload,FileText,LoaderCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {createClient} from '@/lib/supabase/client';
import {WORKFLOW_UPLOAD_BUCKET,workflowFileType,workflowFileError,type WorkflowFileKind} from '@/lib/workflow-files';
type Ticket={uploadId:string;storagePath:string;uploadToken:string;mimeType:string;transferred:boolean};
// Intent: preparation starts with editable Word; evidence registration is separate from approval.
// Paper/ink/quiet rules, 4px spacing, 14px labels, 16px inputs, 44px controls.
export function WorkflowDocumentUpload({requestId,signed=false,busy,onBusy,onRegistered}:{requestId:string;signed?:boolean;busy:boolean;onBusy:(value:boolean)=>void;onRegistered:(kind:WorkflowFileKind)=>Promise<void>}){
 const picker=useRef<HTMLInputElement>(null);const ticket=useRef<Ticket|null>(null);
 const [file,setFile]=useState<File|null>(null);const [kind,setKind]=useState<WorkflowFileKind>(signed?'signed':'draft');
 const [dragging,setDragging]=useState(false);const [error,setError]=useState('');const [phase,setPhase]=useState('');const [driveLink,setDriveLink]=useState('');
 useEffect(()=>{if(!file)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[file]);
 const choose=(files:FileList|null)=>{
  if(busy||!files?.length)return;if(files.length!==1){setError('一度に1つの文書を選択してください');return;}
  const selected=files[0];const nextKind=signed?'signed':workflowFileType(selected.name)==='application/pdf'?kind:'draft';
  const problem=workflowFileError(selected.name,selected.size,nextKind);if(problem){setError(problem);return;}
  ticket.current=null;setFile(selected);setKind(nextKind);setError('');
 };
 const post=async(body:unknown,path=`/api/workflows/${requestId}/documents`)=>{
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();
  if(!response.ok||!result.ok)throw new Error(result.error||'登録できなかった。再試行してください');return result;
 };
 const upload=async()=>{
  if(!file){picker.current?.click();return;}const problem=workflowFileError(file.name,file.size,kind);if(problem){setError(problem);return;}
  onBusy(true);setError('');setPhase('文書登録を準備中…');
  try{
   if(!ticket.current){const result=await post({action:'prepare_upload',fileName:file.name,fileSize:file.size,documentKind:kind});ticket.current={...result,transferred:false};}
   const prepared=ticket.current!;
   if(!prepared.transferred){setPhase('ファイルを転送中…');const {error:transferError}=await createClient().storage.from(WORKFLOW_UPLOAD_BUCKET).uploadToSignedUrl(prepared.storagePath,prepared.uploadToken,file,{contentType:prepared.mimeType});
    if(transferError&&String((transferError as {statusCode?:string}).statusCode)!=='409')throw new Error('ファイルを転送できなかった。通信を確認して再試行してください');prepared.transferred=true;
   }
   setPhase('契約フォルダへ保存中…');await post({action:'finish_upload',uploadId:prepared.uploadId});
   await onRegistered(kind);ticket.current=null;setFile(null);if(picker.current)picker.current.value='';
  }catch(e){setError(e instanceof Error?e.message:'文書を登録できなかった');}finally{setPhase('');onBusy(false);}
 };
 const link=async(e:FormEvent)=>{
  e.preventDefault();onBusy(true);setError('');setPhase('文書のリンクを確認中…');
  try{await post({action:'register_document',documentKind:kind,driveLink},`/api/workflows/${requestId}`);await onRegistered(kind);setDriveLink('');}
  catch(e){setError(e instanceof Error?e.message:'リンクを登録できなかった');}finally{setPhase('');onBusy(false);}
 };
 return <div className="space-y-3" aria-label={signed?'締結版の文書登録':'契約文書の登録'} aria-busy={!!phase}>
  {!signed&&<fieldset className="flex flex-wrap gap-x-4 gap-y-1"><legend className="mb-1 text-sm font-medium">登録する文書</legend>{[['draft','下書き（Word・PDF）'],['revision','承認に出す最終版（PDF）']].map(([value,label])=><label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="radio" name={`document-kind-${requestId}`} value={value} checked={kind===value} disabled={busy} onChange={()=>{setKind(value as WorkflowFileKind);ticket.current=null;setError('');}} className="size-4 accent-primary"/>{label}</label>)}</fieldset>}
  <div onDragOver={e=>{e.preventDefault();if(!busy&&e.dataTransfer.types.includes('Files'))setDragging(true);}} onDragLeave={e=>{if(!(e.relatedTarget instanceof Node&&e.currentTarget.contains(e.relatedTarget)))setDragging(false);}} onDrop={e=>{e.preventDefault();setDragging(false);choose(e.dataTransfer.files);}}
   className={`space-y-2 border border-dashed p-4 text-center ${dragging?'border-primary bg-primary/5':'border-border bg-muted/20'} focus-within:ring-2 focus-within:ring-ring`}>
   <Upload aria-hidden="true" className="mx-auto size-5 text-foreground/70"/><p className="text-sm font-medium">ここへ文書をドラッグ＆ドロップ</p>
   <p className="text-xs leading-5 text-foreground/70">{signed||kind==='revision'?'PDF / 25MBまで':'Word（.docx・.doc）・PDF / 25MBまで'}・1つずつ登録</p>
   <input ref={picker} type="file" name="contract-file" aria-label="登録する契約ファイル" className="sr-only" accept={signed||kind==='revision'?'.pdf':'.docx,.doc,.pdf'} disabled={busy} onChange={e=>choose(e.target.files)}/>
   <Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>picker.current?.click()}>ファイルを選ぶ</Button>
  </div>
  {file&&<div className="flex items-start gap-2 border-b border-border pb-2"><FileText aria-hidden="true" className="mt-1 size-4 shrink-0"/><div className="min-w-0 flex-1"><p className="break-words font-medium">{file.name}</p><p className="mt-1 text-xs text-foreground/70">{new Intl.NumberFormat('ja-JP',{maximumFractionDigits:1}).format(file.size<1_000_000?file.size/1000:file.size/1_000_000)}{file.size<1_000_000?'KB':'MB'} / {kind==='draft'?'下書き':kind==='signed'?'締結版':'承認用の最終版'}</p></div><Button variant="ghost" className="min-h-11 shrink-0" disabled={busy} onClick={()=>{setFile(null);ticket.current=null;if(picker.current)picker.current.value='';}}>選び直す</Button></div>}
  {error&&<p role="alert" className="text-sm leading-6 text-destructive">{error}</p>}
  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs leading-5 text-foreground/70">保存先：管理部門の契約フォルダ</p><Button className="min-h-11" disabled={busy} onClick={()=>void upload()}>{phase?<><LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none"/>{phase}</>:kind==='draft'?'下書きを登録':kind==='signed'?'締結版を登録':'最終版を登録'}</Button></div>
  <details className="border-t border-border"><summary className="min-h-11 cursor-pointer py-3 text-sm text-foreground/70">Driveにある文書のリンクから登録</summary><form onSubmit={e=>void link(e)} className="flex flex-wrap items-end gap-2 pb-2"><label className="min-w-0 flex-[1_1_240px] text-sm font-medium">文書のDriveリンク<input name="drive-document-link" autoComplete="off" required type="url" spellCheck={false} value={driveLink} disabled={busy} onChange={e=>setDriveLink(e.target.value)} className="mt-1 min-h-11 w-full border border-border bg-background px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-ring" placeholder="https://drive.google.com/file/d/…"/></label><Button variant="outline" className="min-h-11" disabled={busy} type="submit">リンクを登録</Button></form></details>
  <p role="status" className={phase?'text-xs text-foreground/70':'sr-only'}>{phase}</p>
 </div>;
}
