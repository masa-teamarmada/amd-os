import 'server-only';
import {createHash} from 'node:crypto';
import {google} from 'googleapis';
import {getGoogleAuthAsync} from '@/lib/sources/google';
import {createAdminClient} from '@/lib/supabase/admin';
import type {WorkflowRequest} from './workflows';
export async function workflowActor(email:string) {
 const {data,error}=await createAdminClient().from('members').select('member_id,code_name,is_admin,status').eq('email',email.toLowerCase()).single();
 if(error||!data?.is_admin||data.status!=='active')throw new Error('操作権限がない');
 return data;
}
export async function readWorkflowPdf(fileId:string) {
 if(!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId))throw new Error('文書が未確認');
 const auth=await getGoogleAuthAsync();if(!auth)throw new Error('文書の接続の確認が必要');
 const drive=google.drive({version:'v3',auth});
 const info=await drive.files.get({fileId,fields:'id,mimeType,trashed,name,parents,size',supportsAllDrives:true});
 if(info.data.mimeType!=='application/pdf'||info.data.trashed||Number(info.data.size)>25_000_000)throw new Error('押印対象は25MB以下のPDFで登録');
 const response=await drive.files.get({fileId,alt:'media',supportsAllDrives:true},{responseType:'arraybuffer'});
 const bytes=Buffer.from(response.data as ArrayBuffer);
 if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('PDFを確認できなかった');
 return {drive,info:info.data,bytes,hash:createHash('sha256').update(bytes).digest('hex')};
}
export async function verifyWorkflowPdf(request:WorkflowRequest) {
 const db=createAdminClient();
 const {data:document,error}=await db.from('contract_documents').select('drive_file_id,is_latest,document_kind').eq('document_id',request.document_id).single();
 if(error||!document?.is_latest||document.document_kind==='signed')throw new Error('文書が更新されている。再申請が必要');
 const [source,snapshot]=await Promise.all([readWorkflowPdf(document.drive_file_id),readWorkflowPdf(request.snapshot_file_id)]);
 if(source.hash!==request.source_sha256||snapshot.hash!==request.snapshot_sha256) {
  const {error:updateError}=await db.from('workflow_requests').update({status:'superseded',updated_at:new Date().toISOString()}).eq('request_id',request.request_id).in('status',['submitted','approved','released']);
  if(updateError)throw new Error('文書変更の記録に失敗した');
  await db.from('workflow_events').insert({request_id:request.request_id,action:'superseded',note:'PDF内容の変更を検知。再申請が必要'});
  throw new Error('文書の内容が変わっている。再申請が必要');
 }
}
