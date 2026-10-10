import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/supabase/api-auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {workflowActor,verifyWorkflowPdf} from '@/lib/workflow-server';
import {readWorkflowDocument} from '@/lib/workflow-document-server';
import type {WorkflowRequest} from '@/lib/workflows';
export const runtime='nodejs';export const maxDuration=120;
export async function GET(_req:NextRequest,ctx:{params:Promise<{requestId:string}>}){
 const auth=await requireAdmin();if(!auth.ok)return auth.errorResponse;
 try{await workflowActor(auth.user.email);const {requestId}=await ctx.params;const db=createAdminClient();
 const [request,events]=await Promise.all([db.from('workflow_requests').select('*,contract:contracts(contract_id,contract_title,counterparty_name,contract_type,amd_entity_name,project_id,status,signed_document_id)').eq('request_id',requestId).single(),db.from('workflow_events').select('event_id,action,actor_member_id,note,created_at').eq('request_id',requestId).order('created_at',{ascending:true})]);
 if(request.error||events.error)throw new Error();
 const documents=await db.from('contract_documents').select('document_id,contract_id,file_name,version_label,drive_file_id,mime_type,is_latest,document_kind,received_at').eq('contract_id',request.data.contract_id).order('received_at',{ascending:false}).limit(100);
 if(documents.error)throw new Error();
 return NextResponse.json({ok:true,request:request.data,events:events.data,documents:documents.data},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({ok:false,error:'申請の履歴を読み込めなかった'},{status:404});}
}
export async function POST(req:NextRequest,ctx:{params:Promise<{requestId:string}>}){
 const auth=await requireAdmin();if(!auth.ok)return auth.errorResponse;
 try{
 const {requestId}=await ctx.params;const body=await req.json();const actor=await workflowActor(auth.user.email);const db=createAdminClient();
 const {data:request,error}=await db.from('workflow_requests').select('*').eq('request_id',requestId).single();if(error||!request)throw new Error('申請を確認できなかった');
 const action=body.action;
 if(action==='register_pdf'||action==='register_document'){
  if(actor.member_id!==request.requested_by||!['preparing','released'].includes(request.status))return NextResponse.json({ok:false,error:'この段階では申請者が文書を登録できない'},{status:403});
  let link:URL;try{link=new URL(String(body.driveLink));}catch{throw new Error('Driveの文書リンクを入力してください');}
  if(link.protocol!=='https:'||link.hostname!=='drive.google.com')throw new Error('Google Driveの文書リンクを入力してください');
  const fileId=link.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]||link.searchParams.get('id')||'';
  const kind=request.status==='released'?'signed':action==='register_pdf'?'revision':body.documentKind;
  if(!['draft','revision','signed'].includes(kind)||request.status==='preparing'&&kind==='signed')throw new Error('下書きか最終版を選択してください');
  const document=await readWorkflowDocument(fileId,kind);
  const {data:documentId,error:documentError}=await db.rpc('workflow_register_document',{p_actor:actor.member_id,p_request:requestId,p_file:fileId,p_name:document.info.name,p_size:document.bytes.length,p_mime:document.info.mimeType,p_kind:kind});
  if(documentError)throw new Error('文書を登録できなかった。フローと締結版の登録状況を更新して確認');
  return NextResponse.json({ok:true,documentId});
 }
const note=typeof body.note==='string'?body.note.trim().slice(0,2000):null;
 if(['approve','return','complete'].includes(action)&&actor.member_id!==request.approver_member_id)return NextResponse.json({ok:false,error:'きよの承認が必要'},{status:403});
 if(['cancel','release'].includes(action)&&actor.member_id!==request.requested_by)return NextResponse.json({ok:false,error:'申請者だけが操作できる'},{status:403});
 if(['approve','release','complete'].includes(action)&&body.confirmed!==true)throw new Error('対象の文書を確認してチェックを入れる');
 if(['approve','release'].includes(action))await verifyWorkflowPdf(request as WorkflowRequest);
 const {data,error:transitionError}=await db.rpc('workflow_transition',{p_actor:actor.member_id,p_request:requestId,p_action:action,p_note:note});
 if(transitionError)throw new Error('この状態では操作できない。文書変更や他の操作がないか最新の状態を確認');
 return NextResponse.json({ok:true,request:data});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'変更できなかった'},{status:422});}
}
