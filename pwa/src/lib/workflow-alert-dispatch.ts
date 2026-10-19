import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {formatContractMailAlert,WORKFLOW_STATUS,type WorkflowMailEvent,type WorkflowStatus} from './workflows';
// 押印申請の通知outboxを、申請・承認の操作直後と業務フロー画面の表示時に配信する（契約メール監視は2026-10-20に停止）。
const BASE='https://amd-os-pwa.vercel.app';
const slackText=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
async function alertText(key:string){
 const db=createAdminClient();
 if(key.startsWith('mail:')){
 const {data,error}=await db.from('workflow_mail_events').select('*').eq('event_id',key.slice(5)).single();if(error)throw error;const event=data as WorkflowMailEvent;
 return formatContractMailAlert(event,BASE);
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
