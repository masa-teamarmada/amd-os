import 'server-only';
import {Readable} from 'node:stream';
import {google} from 'googleapis';
import {validateWorkflowBytes} from '@/lib/workflow-file-validation';
import {getGoogleAuthAsync} from '@/lib/sources/google';
import {WORD_DOC,WORD_DOCX,workflowFileError,type WorkflowFileKind} from './workflow-files';

export async function workflowDrive(){
 const auth=await getGoogleAuthAsync();if(!auth)throw new Error('文書の保存先への接続を確認する必要があります');
 return google.drive({version:'v3',auth});
}
export async function readWorkflowDocument(fileId:string,kind:WorkflowFileKind){
 if(!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId))throw new Error('文書のリンクを確認してください');
 const drive=await workflowDrive();
 const {data:info}=await drive.files.get({fileId,fields:'id,name,mimeType,size,trashed',supportsAllDrives:true});
 if(info.trashed||!info.name||!info.mimeType)throw new Error('文書を確認できなかった');
 const error=workflowFileError(info.name,Number(info.size),kind);if(error)throw new Error(error);
 if(!['application/pdf',WORD_DOC,WORD_DOCX].includes(info.mimeType))throw new Error('WordかPDFのリンクを登録してください');
 const response=await drive.files.get({fileId,alt:'media',supportsAllDrives:true},{responseType:'arraybuffer'});
 const bytes=Buffer.from(response.data as ArrayBuffer);validateWorkflowBytes(bytes,info.mimeType);
 return {info,bytes};
}
export async function workflowUploadFolder(projectId:string,contractId:string){
 const rootId=process.env.CONTRACTS_DRIVE_FOLDER_ID;
 if(!rootId)throw new Error('契約文書の保存先が未設定です。管理者が契約フォルダの接続を設定してください');
 const drive=await workflowDrive();
 const {data:rootInfo}=await drive.files.get({fileId:rootId,fields:'mimeType,trashed,capabilities(canAddChildren)',supportsAllDrives:true});
 if(rootInfo.trashed||rootInfo.mimeType!=='application/vnd.google-apps.folder'||!rootInfo.capabilities?.canAddChildren)throw new Error('契約フォルダへ保存できません。管理者が保存先の接続を確認してください');
 const child=async(parent:string,name:string)=>{
  const q=`'${parent.replace(/'/g,"\\'")}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const {data:found}=await drive.files.list({q,fields:'files(id)',pageSize:1,supportsAllDrives:true,includeItemsFromAllDrives:true});
  if(found.files?.[0]?.id)return found.files[0].id;
  const {data:created}=await drive.files.create({requestBody:{name,mimeType:'application/vnd.google-apps.folder',parents:[parent]},fields:'id',supportsAllDrives:true});
  if(!created.id)throw new Error('文書の保存先を作れなかった');return created.id;
 };
 const projectFolder=await child(rootId,projectId);
 return {drive,folderId:await child(projectFolder,contractId)};
}
export async function saveWorkflowUpload(row:{drive_file_id:string;drive_folder_id:string;file_name:string;mime_type:string},bytes:Buffer){
 const drive=await workflowDrive();
 try{
  await drive.files.get({fileId:row.drive_file_id,fields:'id',supportsAllDrives:true});
 }catch(error){
  if((error as {code?:number}).code!==404)throw error;
  try{await drive.files.create({requestBody:{id:row.drive_file_id,name:row.file_name,parents:[row.drive_folder_id]},media:{mimeType:row.mime_type,body:Readable.from(bytes)},fields:'id',supportsAllDrives:true});}
  catch(createError){if((createError as {code?:number}).code!==409)throw createError;}
 }
}
