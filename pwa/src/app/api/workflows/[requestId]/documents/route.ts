import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/supabase/api-auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {workflowActor} from '@/lib/workflow-server';
import {workflowUploadFolder,saveWorkflowUpload} from '@/lib/workflow-document-server';
import {validateWorkflowBytes} from '@/lib/workflow-file-validation';
import {WORKFLOW_UPLOAD_BUCKET,workflowFileType,workflowFileError,type WorkflowFileKind} from '@/lib/workflow-files';
export const runtime='nodejs';export const maxDuration=120;
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest,ctx:{params:Promise<{requestId:string}>}){
 const auth=await requireAdmin();if(!auth.ok)return auth.errorResponse;
 try{
  const actor=await workflowActor(auth.user.email);const {requestId}=await ctx.params;const body=await req.json();const db=createAdminClient();
  const {data:request}=await db.from('workflow_requests').select('requested_by,status,contract_id,contract:contracts(project_id,signed_document_id)').eq('request_id',requestId).single();
  if(!request||request.requested_by!==actor.member_id)return json({ok:false,error:'この段階では申請者が文書を登録できません'},403);
  const contract=Array.isArray(request.contract)?request.contract[0]:request.contract;
  if(!contract)return json({ok:false,error:'契約を確認できません'},404);
  if(body.action==='finish_upload'){
   const {data:completed}=await db.from('workflow_document_uploads').select('document_id').eq('upload_id',body.uploadId).eq('request_id',requestId).eq('actor_member_id',actor.member_id).single();
   if(completed?.document_id)return json({ok:true,documentId:completed.document_id});
  }
  if(!['preparing','released'].includes(request.status))return json({ok:false,error:'この段階では文書を登録できません'},403);
  if(body.action==='prepare_upload'){
   if(request.status==='released'&&contract.signed_document_id)return json({ok:false,error:'締結版が登録されています。最新の状態を確認してください'},409);
   const kind:WorkflowFileKind=request.status==='released'?'signed':body.documentKind;
   if(!['draft','revision','signed'].includes(kind)||request.status==='preparing'&&kind==='signed')throw new Error('登録する文書の役割を選択してください');
   const name=String(body.fileName||'').replace(/[\/\\\u0000-\u001f]/g,'_').slice(0,240);const size=Number(body.fileSize);
   const problem=workflowFileError(name,size,kind);if(problem)throw new Error(problem);
   const {count,error:quotaError}=await db.from('workflow_document_uploads').select('*',{count:'exact',head:true}).eq('actor_member_id',actor.member_id).is('document_id',null).gt('expires_at',new Date().toISOString());
   if(quotaError)throw new Error('登録状況を確認できなかった。再試行してください');
   if((count||0)>=10)throw new Error('未完了の登録が多くなっています。選択中の文書を再試行するか、しばらくお待ちください');
   const {drive,folderId}=await workflowUploadFolder(contract.project_id,request.contract_id);
   const {data:ids}=await drive.files.generateIds({count:1,space:'drive',type:'files'});const driveId=ids.ids?.[0];if(!driveId)throw new Error('文書登録の準備ができなかった');
   const uploadId=randomUUID();const path=`${actor.member_id}/${requestId}/${uploadId}`;
   const {error}=await db.from('workflow_document_uploads').insert({upload_id:uploadId,request_id:requestId,actor_member_id:actor.member_id,storage_path:path,file_name:name,mime_type:workflowFileType(name),file_size_bytes:size,document_kind:kind,drive_file_id:driveId,drive_folder_id:folderId});if(error)throw new Error('文書登録の準備ができなかった');
   const {data:signed,error:signError}=await db.storage.from(WORKFLOW_UPLOAD_BUCKET).createSignedUploadUrl(path,{upsert:false});
   if(signError||!signed)throw new Error('文書登録の準備ができなかった');
   return json({ok:true,uploadId,storagePath:path,uploadToken:signed.token,mimeType:workflowFileType(name)});
  }
  if(body.action!=='finish_upload')throw new Error('登録操作を確認してください');
  const {data:upload}=await db.from('workflow_document_uploads').select('*').eq('upload_id',body.uploadId).eq('request_id',requestId).eq('actor_member_id',actor.member_id).single();
  if(!upload)throw new Error('文書登録の準備が見つからないよ。ファイルを選び直してください');
  if(upload.document_id)return json({ok:true,documentId:upload.document_id});
  if(Date.parse(upload.expires_at)<Date.now())throw new Error('登録の有効時間を過ぎています。ファイルを選び直してください');
  if(request.status==='preparing'&&upload.document_kind==='signed'||request.status==='released'&&upload.document_kind!=='signed')throw new Error('フローの段階が変わっています。最新の状態を確認してください');
  const {data:file,error:readError}=await db.storage.from(WORKFLOW_UPLOAD_BUCKET).download(upload.storage_path);
  if(readError||!file)throw new Error('ファイルの転送が完了していません。再試行してください');
  const bytes=Buffer.from(await file.arrayBuffer());if(bytes.length!==upload.file_size_bytes)throw new Error('ファイルの大きさが変わっています。選び直してください');
  validateWorkflowBytes(bytes,upload.mime_type);await saveWorkflowUpload(upload,bytes);
  const {data:documentId,error:registerError}=await db.rpc('workflow_register_document',{p_actor:actor.member_id,p_request:requestId,p_file:upload.drive_file_id,p_name:upload.file_name,p_size:bytes.length,p_mime:upload.mime_type,p_kind:upload.document_kind,p_source:'workflow_file_upload'});
  if(registerError)throw new Error('保存した文書の登録が完了していません。最新の状態を確認して再試行してください');
  const {error:completeError}=await db.from('workflow_document_uploads').update({document_id:documentId}).eq('upload_id',upload.upload_id);
  if(!completeError)await db.storage.from(WORKFLOW_UPLOAD_BUCKET).remove([upload.storage_path]);
  return json({ok:true,documentId});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:'文書を登録できなかった'},422);}
}
