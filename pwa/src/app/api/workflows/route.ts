import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {requireAdmin} from '@/lib/supabase/api-auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {readWorkflowPdf,workflowActor} from '@/lib/workflow-server';
export const runtime='nodejs';export const maxDuration=120;
export async function GET(req:NextRequest) {
 const auth=await requireAdmin();if(!auth.ok)return auth.errorResponse;
 try {
 const db=createAdminClient();const actor=await workflowActor(auth.user.email);
 const offset=Math.max(0,Math.min(10000,Number(req.nextUrl.searchParams.get('offset'))||0));
 const contractId=req.nextUrl.searchParams.get('contractId');
 if(contractId){
  const {data,error}=await db.from('contract_documents').select('document_id,contract_id,file_name,version_label,drive_file_id,mime_type,is_latest,document_kind').eq('contract_id',contractId).eq('is_latest',true).not('document_kind','in','(signed,draft)').eq('mime_type','application/pdf');
  if(error)throw error;return NextResponse.json({ok:true,documents:data});
 }
 let contracts=db.from('contracts').select('contract_id,contract_title,counterparty_name,contract_type,amd_entity_name,project_id,status,signed_document_id',{count:'exact'}).eq('relationship_scope','amd_contract').eq('registry_status','accepted').not('status','in','(signed,cancelled)').order('last_activity_at',{ascending:false}).limit(100);
 const search=(req.nextUrl.searchParams.get('search')||'').replace(/[%,()\\]/g,'').trim().slice(0,120);
 if(search)contracts=contracts.or(`contract_title.ilike.%${search}%,counterparty_name.ilike.%${search}%`);
 const focusContractId=req.nextUrl.searchParams.get('focusContractId');
 const results=await Promise.all([
 db.from('workflow_requests').select('*,contract:contracts(contract_id,contract_title,counterparty_name,contract_type,amd_entity_name,project_id,status,signed_document_id)',{count:'exact'}).order('created_at',{ascending:false}).range(offset,offset+49),
 contracts,
 db.from('workflow_mail_events').select('*',{count:'exact'}).order('occurred_at',{ascending:false}).limit(50),
 db.from('workflow_alert_deliveries').select('event_key,recipient_member_id,status,sent_at').order('attempted_at',{ascending:false,nullsFirst:false}).limit(200),
 db.from('workflow_monitor_state').select('last_checked_at,last_success_at,last_error,scanned_count').eq('rule_key','contract_seal').single(),
 db.from('workflow_rules').select('approver_member_id,mailbox_member_id,enabled,activated_at').eq('rule_key','contract_seal').single(),
 db.from('members').select('member_id,code_name').eq('status','active'),
 db.from('workflow_requests').select('request_id',{count:'exact',head:true}).eq('status','submitted'),db.from('projects').select('project_id,project_name').order('project_id'),focusContractId?db.from('contracts').select('contract_id,contract_title,counterparty_name,contract_type,amd_entity_name,project_id,status,signed_document_id').eq('contract_id',focusContractId).eq('relationship_scope','amd_contract').eq('registry_status','accepted').not('status','in','(signed,cancelled)').maybeSingle():Promise.resolve({data:null,error:null})]);
 for(const result of results)if(result.error)throw result.error;
 const [requests,options,mail,deliveries,monitor,rule,members,pending]=results;
 const candidates=[...(options.data||[])];const focused=results[9].data as typeof candidates[number]|null;if(focused&&!candidates.some(c=>c.contract_id===focused.contract_id))candidates.unshift(focused);
 return NextResponse.json({ok:true,actor:actor.member_id,requests:requests.data,requestCount:requests.count,pendingCount:pending.count,contracts:candidates,contractCount:options.count,mailEvents:mail.data,mailCount:mail.count,deliveries:deliveries.data,monitor:monitor.data,rule:rule.data,members:members.data,projects:results[8].data},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({ok:false,error:'業務フローを読み込めなかった。接続の確認が必要'},{status:500});}
}
export async function POST(req:NextRequest) {
 const auth=await requireAdmin();if(!auth.ok)return auth.errorResponse;
 try{
 const body=await req.json();const purpose=typeof body.purpose==='string'?body.purpose.trim():'';
 if(!purpose||purpose.length>2000)return NextResponse.json({ok:false,error:'契約の目的を2000文字以内で入力'},{status:400});
 const actor=await workflowActor(auth.user.email);const db=createAdminClient();
 const {data:rule,error:ruleError}=await db.from('workflow_rules').select('approver_member_id,enabled').eq('rule_key','contract_seal').single();
 if(ruleError||!rule?.enabled||actor.member_id===rule.approver_member_id)return NextResponse.json({ok:false,error:'きよは自分へ申請できない。申請者から申請'},{status:403});
 if(body.action==='start'){
  const {data:request,error:startError}=await db.rpc('workflow_start',{p_actor:actor.member_id,p_request:body.startId,p_contract:body.contractId||null,p_project:body.projectId||null,p_title:body.contractTitle||null,p_counterparty:body.counterpartyName||null,p_type:body.contractType||null,p_purpose:purpose,p_date:body.desiredDate||null}).single();
  if(startError)throw new Error(startError.message.includes('duplicate')?'この契約には進行中のフローがある。一覧から確認':'相手先・契約の種類・契約名・対象PJを確認して開始');
  if(!request||typeof request!=='object'||!('request_id' in request)||typeof request.request_id!=='string')throw new Error('開始結果を確認できなかった。最新のフローを確認');
  return NextResponse.json({ok:true,requestId:request.request_id});
 }
 const {data:active,error:activeError}=await db.from('workflow_requests').select('request_id,requested_by,status').eq('contract_id',body.contractId).in('status',['preparing','submitted','approved','released']).maybeSingle();
 if(activeError)throw new Error('進行中のフローを確認できなかった');
 if(active&&(active.status!=='preparing'||active.requested_by!==actor.member_id))throw new Error('進行中のフローがある。申請者が一覧から確認');
 const {data:doc,error}=await db.from('contract_documents').select('document_id,contract_id,drive_file_id,is_latest,document_kind,mime_type').eq('document_id',body.documentId).eq('contract_id',body.contractId).single();
 if(error||!doc?.is_latest||['signed','draft'].includes(doc.document_kind)||doc.mime_type!=='application/pdf')throw new Error('最新版の押印対象PDFを選択');
 const {data:terms,error:termsError}=await db.rpc('workflow_contract_snapshot',{p_contract:body.contractId});if(termsError)throw new Error('契約を確認できなかった');
 const pdf=await readWorkflowPdf(doc.drive_file_id);
 const copy=await pdf.drive.files.copy({fileId:doc.drive_file_id,supportsAllDrives:true,requestBody:{name:`押印申請_${randomUUID()}_${pdf.info.name}`,parents:pdf.info.parents},fields:'id'});
 if(!copy.data.id)throw new Error('承認対象文書を固定できなかった');
 const fixed=await readWorkflowPdf(copy.data.id);
 if(fixed.hash!==pdf.hash)throw new Error('文書が申請中に変わった。最新版を確認が必要');
 const {data:rid,error:submitError}=await db.rpc('workflow_submit',{p_actor:actor.member_id,p_contract:body.contractId,p_document:doc.document_id,p_purpose:purpose,p_date:body.desiredDate||null,p_source_hash:pdf.hash,p_snapshot_file:copy.data.id,p_snapshot_hash:fixed.hash,p_terms:terms});
 if(submitError)throw new Error(submitError.message.includes('duplicate')?'この契約には進行中の申請がある':'申請対象が変わっているか、申請できない状態。最新の状態を確認');
 return NextResponse.json({ok:true,requestId:rid});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'申請できなかった'},{status:422});}
}
