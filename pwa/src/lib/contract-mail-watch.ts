import 'server-only';
import {randomUUID} from 'node:crypto';
import {google,type gmail_v1} from 'googleapis';
import {createAdminClient} from '@/lib/supabase/admin';
import {getGoogleAuthAsync} from '@/lib/sources/google';
import {classifyContractMail,MAIL_EVENT_LABEL,WORKFLOW_STATUS,type WorkflowMailEvent,type WorkflowStatus} from './workflows';
const BASE='https://amd-os-pwa.vercel.app';
function header(message:gmail_v1.Schema$Message,name:string){return message.payload?.headers?.find(h=>h.name?.toLowerCase()===name.toLowerCase())?.value||'';}
function mimeBody(part:gmail_v1.Schema$MessagePart|undefined,mime:string):string {
 if(!part||part.filename)return '';
 if(part.mimeType===mime&&part.body?.data)return Buffer.from(part.body.data,'base64url').toString('utf8');
 return (part.parts||[]).map(child=>mimeBody(child,mime)).find(Boolean)||'';
}
function body(part:gmail_v1.Schema$MessagePart|undefined):string {
 const plain=mimeBody(part,'text/plain');if(plain)return plain;
 return mimeBody(part,'text/html').replace(/<(script|style)[\s\S]*?<\/\1>/gi,'').replace(/<blockquote[\s\S]*?<\/blockquote>/gi,'').replace(/<br\s*\/?>|<\/p>/gi,'\n').replace(/<[^>]+>/g,' ');
}
function filenames(part:gmail_v1.Schema$MessagePart|undefined):string[]{return part?[part.filename||'',...(part.parts||[]).flatMap(filenames)].filter(Boolean):[];}
function safeSubject(subject:string){return subject.replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+/g,'[参照]').replace(/[\x00-\x1f<>]/g,' ').slice(0,160);}
const slackText=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export async function scanContractMail(dryRun=false){
 const db=createAdminClient();const token=randomUUID();
 const {data:rule,error:ruleError}=await db.from('workflow_rules').select('*').eq('rule_key','contract_seal').single();if(ruleError)throw ruleError;if(!rule.enabled)return {enabled:false,scanned:0,detected:0};
 const {data:claimed,error:claimError}=await db.rpc('workflow_claim_monitor',{p_token:token});if(claimError)throw claimError;if(!claimed)return {busy:true,scanned:0,detected:0};
 try{
 const auth=await getGoogleAuthAsync();if(!auth)throw new Error('gmail_connection_missing');
 const gmail=google.gmail({version:'v1',auth});const profile=await gmail.users.getProfile({userId:'me'});
 const {data:mailbox,error:memberError}=await db.from('members').select('email').eq('member_id',rule.mailbox_member_id).single();if(memberError)throw memberError;
 if(profile.data.emailAddress?.toLowerCase()!==mailbox.email.toLowerCase())throw new Error('mailbox_identity_mismatch');
 const {data:state,error:stateError}=await db.from('workflow_monitor_state').select('*').eq('rule_key','contract_seal').single();if(stateError)throw stateError;
 if(!state.history_id){
  if(!dryRun){const {error}=await db.from('workflow_monitor_state').update({history_id:profile.data.historyId,last_success_at:new Date().toISOString(),last_error:null}).eq('rule_key','contract_seal').eq('lease_token',token);if(error)throw error;}
  return {initialized:true,scanned:0,detected:0};
 }
 let ids:string[]=state.buffered_message_ids||[];let nextPage:string|null=state.next_page_token;let target:string|null=state.target_history_id;let recoverySince:string|null=state.scan_after;
 const recovery=async()=>{
  recoverySince=recoverySince||new Date(Math.max(new Date(rule.activated_at).getTime(),new Date(state.last_success_at||rule.activated_at).getTime()-3600_000)).toISOString();
  const listed=await gmail.users.messages.list({userId:'me',q:`after:${Math.floor(new Date(recoverySince).getTime()/1000)} -in:drafts -in:spam -in:trash -in:chats`,pageToken:nextPage||undefined,maxResults:40});
  ids=(listed.data.messages||[]).map(m=>m.id).filter((id):id is string=>!!id);nextPage=listed.data.nextPageToken||null;target=target||profile.data.historyId||null;
 };
 if(!ids.length){
  try{
   if(recoverySince){await recovery();}else{
   const history=await gmail.users.history.list({userId:'me',startHistoryId:state.history_id,pageToken:nextPage||undefined,maxResults:100,historyTypes:['messageAdded','labelAdded']});
   ids=Array.from(new Set((history.data.history||[]).flatMap(h=>[...(h.messagesAdded||[]).map(m=>m.message?.id),...(h.labelsAdded||[]).filter(m=>m.labelIds?.includes('SENT')).map(m=>m.message?.id)]).filter((id):id is string=>!!id)));
   nextPage=history.data.nextPageToken||null;target=history.data.historyId||profile.data.historyId||null;
   }
  }catch(e){
   // A history gap is visible. Recover new messages using a bounded, paginated list.
   if((e as {code?:number}).code!==404)throw e;
   nextPage=null;await recovery();
  }
  if(!dryRun){const {error}=await db.from('workflow_monitor_state').update({buffered_message_ids:ids,next_page_token:nextPage,target_history_id:target,scan_after:recoverySince}).eq('rule_key','contract_seal').eq('lease_token',token);if(error)throw error;}
 }
 let scanned=0;let detected=0;const preview:Array<{direction:string;kind:string;subject:string}>=[];
 for(const id of ids.slice(0,40)){
  let message:gmail_v1.Schema$Message;
  try{message=(await gmail.users.messages.get({userId:'me',id,format:'full'})).data;}catch(e){if((e as {code?:number}).code===404){scanned++;continue;}throw e;}
  const occurredAt=new Date(Number(message.internalDate||0));
  if(occurredAt.getTime()<new Date(rule.activated_at).getTime()){scanned++;continue;}
  const {data:known,error:knownError}=await db.from('workflow_mail_events').select('contract_id').eq('thread_id',message.threadId).eq('mailbox_member_id',rule.mailbox_member_id).limit(1);if(knownError)throw knownError;
  const subject=header(message,'Subject');const kind=classifyContractMail({subject,body:body(message.payload)||message.snippet||'',filenames:filenames(message.payload),labels:message.labelIds||[],from:header(message,'From'),bulk:!!header(message,'List-Unsubscribe'),knownThread:!!known?.length});
  if(kind){
   const direction=message.labelIds?.includes('SENT')?'sent':'received';const safe=safeSubject(subject)||'契約に関する連絡';
   if(dryRun)preview.push({direction,kind,subject:safe});
   else{
    const {error}=await db.from('workflow_mail_events').upsert({mailbox_member_id:rule.mailbox_member_id,message_id:id,thread_id:message.threadId,direction,event_kind:kind,subject:safe,source_url:`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(mailbox.email)}#all/${id}`,occurred_at:occurredAt.toISOString(),contract_id:known?.[0]?.contract_id||null},{onConflict:'mailbox_member_id,message_id',ignoreDuplicates:true});if(error)throw error;
   }
   detected++;
  }
  scanned++;
 }
 if(!dryRun){
 const remaining=ids.slice(scanned);const done=!remaining.length&&!nextPage;
 const {error}=await db.from('workflow_monitor_state').update({buffered_message_ids:remaining,next_page_token:nextPage,target_history_id:done?null:target,...(done?{history_id:target||state.history_id,last_success_at:new Date().toISOString(),scan_after:null}:{}),scanned_count:state.scanned_count+scanned,last_error:null}).eq('rule_key','contract_seal').eq('lease_token',token);if(error)throw error;
 }
 return {scanned,detected,pending:Math.max(0,ids.length-scanned),more:!!nextPage,...(dryRun?{preview}: {})};
 }catch(e){
 const code=(e as {code?:number}).code;const safe=code===401?'メール接続の再認証が必要':code===403?'メール接続の権限の確認が必要':e instanceof Error&&e.message==='mailbox_identity_mismatch'?'監視対象と接続アカウントが一致しない':'メール監視が停止中。接続の確認が必要';
 await db.from('workflow_monitor_state').update({last_error:safe}).eq('rule_key','contract_seal').eq('lease_token',token);throw new Error(safe);
 }finally{await db.from('workflow_monitor_state').update({lease_until:null,lease_token:null}).eq('rule_key','contract_seal').eq('lease_token',token);}
}
async function alertText(key:string){
 const db=createAdminClient();
 if(key.startsWith('mail:')){
 const {data,error}=await db.from('workflow_mail_events').select('*').eq('event_id',key.slice(5)).single();if(error)throw error;const event=data as WorkflowMailEvent;
 return [MAIL_EVENT_LABEL[event.event_kind],`${event.direction==='sent'?'まさの送信':'まさの受信'} / ${new Date(event.occurred_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}`,slackText(event.subject),event.event_kind==='completion'?'締結・押印完了の連絡を検知。きよの承認記録との照合が必要。':'契約のやりとりを検知。押印する前に、きよの承認の確認が必要。',`<${BASE}/admin/workflows|OSで確認>`].join('\n');
 }
 const {data:event,error}=await db.from('workflow_events').select('*').eq('event_id',key.slice(6)).single();if(error)throw error;
 const {data:request,error:requestError}=await db.from('workflow_requests').select('terms_snapshot,status').eq('request_id',event.request_id).single();if(requestError)throw requestError;
 const labels:Record<string,string>={submitted:'押印申請・きよ承認待ち',approve:'きよが押印申請を承認',return:'押印申請を差戻し',superseded:'文書変更・押印申請の再承認が必要',release:'承認対象の押印手続きへ進行',complete:'きよが締結版の照合を完了',cancel:'押印申請を取下げ'};
 return [labels[event.action]||'押印申請の更新',slackText(String(request.terms_snapshot.contract_title)),`現在：${WORKFLOW_STATUS[request.status as WorkflowStatus]}`,`<${BASE}/admin/workflows?requestId=${event.request_id}|OSで確認>`].join('\n');
}
export async function dispatchWorkflowAlerts(dryRun=false,deadline=Date.now()+150_000){
 const db=createAdminClient();
 // A lost acknowledgement is never silently retried: visible uncertain status.
 if(!dryRun)await db.from('workflow_alert_deliveries').update({status:'uncertain',error_code:'acknowledgement_unknown'}).eq('status','sending').lt('attempted_at',new Date(Date.now()-240_000).toISOString());
 const {data:rows,error}=await db.from('workflow_alert_deliveries').select('*').in('status',['pending','failed']).limit(20);if(error)throw error;
 let sent=0;let failed=0;
 for(const row of rows||[]){
  if(Date.now()>deadline-45000)break;
  const {data:member,error:memberError}=await db.from('members').select('slack_id,status').eq('member_id',row.recipient_member_id).single();if(memberError||member?.status!=='active'||!/^U[A-Z0-9]+$/.test(member.slack_id||'')){failed++;continue;}
  const text=await alertText(row.event_key);if(dryRun)continue;
  const {data:claimed,error:claimError}=await db.from('workflow_alert_deliveries').update({status:'sending',attempted_at:new Date().toISOString(),error_code:null}).eq('event_key',row.event_key).eq('recipient_member_id',row.recipient_member_id).eq('status',row.status).select('event_key');if(claimError)throw claimError;if(!claimed?.length)continue;
  try{
   const base=process.env.NEXT_PUBLIC_GAS_WEBAPP_URL;const key=process.env.NEXT_PUBLIC_GAS_API_KEY||process.env.PWA_API_KEY||process.env.CRON_SECRET;if(!base||!key)throw new Error('gas_connection_missing');
   const url=new URL(base);url.searchParams.set('mode','pwaApi');url.searchParams.set('key',key);url.searchParams.set('action','runFunc');
   // Same fixed GAS sender as scripts/send-eimi-slack.mjs. Never use another persona.
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fn:'slackNotifyPostToChannelTsukuyomi_',args:[member.slack_id,{text}]}),signal:AbortSignal.timeout(40000)});
   const result=await response.json();const posted=result?.data?.result;
   if(!result.ok||!posted?.ok){await db.from('workflow_alert_deliveries').update({status:'failed',error_code:'slack_rejected'}).eq('event_key',row.event_key).eq('recipient_member_id',row.recipient_member_id);failed++;continue;}
   const {error:ackError}=await db.from('workflow_alert_deliveries').update({status:'sent',sent_at:new Date().toISOString(),channel_id:posted.channel,slack_ts:posted.ts,error_code:null}).eq('event_key',row.event_key).eq('recipient_member_id',row.recipient_member_id);if(ackError)throw ackError;sent++;
  }catch{
   await db.from('workflow_alert_deliveries').update({status:'uncertain',error_code:'delivery_confirmation_required'}).eq('event_key',row.event_key).eq('recipient_member_id',row.recipient_member_id);failed++;
  }
 }
 return {pending:rows?.length||0,sent,failed,dryRun};
}
