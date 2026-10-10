import assert from "node:assert/strict";
import fs from "node:fs";
import {sharedMeetingNarrative, isSharedMeetingRecord} from "../src/lib/shared-meeting-content.ts";
import {matchesSlackArchiveTarget} from "../src/lib/slack/archive-boundary.ts";
assert.equal(sharedMeetingNarrative("Approved minutes\n\n---\n## 会議前準備メモ\nprivate planning"),"Approved minutes");
assert.equal(sharedMeetingNarrative("## 参考：会議前準備メモ\nprivate"),null);
assert.equal(isSharedMeetingRecord({meetingId:"upcoming:p21",sourceKinds:"upcoming"}),false);
assert.equal(isSharedMeetingRecord({meetingId:"actual",sourceKinds:"calendar+notion"}),true);
const targets=[{workspace_key:"external",channel_id:"C1",archive_enabled:true,workspace_shared:true},{workspace_key:"armada",channel_id:"C2",archive_enabled:true,workspace_shared:true},{workspace_key:"external",channel_id:"C3",archive_enabled:true,workspace_shared:false}];
const row=(channel:string,url:string)=>({item_id:`${channel}:1`,metadata_json:{channel_id:channel,permalink:url}});
assert.equal(matchesSlackArchiveTarget(row("C1","https://external.slack.com/archives/C1/p1"),targets,true),true);
for(const bad of [row("C2","https://teamarmadahq.slack.com/archives/C2/p1"),row("C1","https://teamarmadahq.slack.com/archives/C1/p1"),row("C1","https://external.slack.com.evil.example/C1"),row("C1","http://external.slack.com/archives/C1/p1"),row("C1",""),{item_id:"legacy",metadata_json:null},row("unknown","https://external.slack.com/archives/unknown/p1")])assert.equal(matchesSlackArchiveTarget(bad,targets,true),false);
assert.equal(matchesSlackArchiveTarget(row("C3","https://external.slack.com/archives/C3/p1"),targets,true),false);
assert.equal(matchesSlackArchiveTarget(row("C3","https://external.slack.com/archives/C3/p1"),targets,false),true);
assert.ok(fs.readFileSync("src/lib/slack/slack-messages-client.ts","utf8").includes("slack-messages:disclosure-v2:"));
const route=fs.readFileSync("src/app/api/slack/messages/route.ts","utf8");assert.ok(route.includes("matchesSlackArchiveTarget(row,targets,!auth.ok)"));assert.ok(route.includes("ymRows.filter"));assert.ok(route.includes("private, no-store"));
const meetings=fs.readFileSync("src/app/api/project/[projectId]/workspace-meetings/route.ts","utf8");assert.ok(meetings.includes("sharedOnly:true"));assert.ok(meetings.includes('.eq("workspace_shared",true)'));assert.ok(meetings.includes("prepDraftMd:null"));
const workspace=fs.readFileSync("src/lib/project-workspace.ts","utf8");assert.ok(workspace.includes('.eq("workspace_shared",true)'));assert.ok(!workspace.includes('select("meeting_id,title,meeting_date,prep_draft_md'));
const dd=fs.readFileSync("src/lib/dd-project-pages-server.ts","utf8");assert.ok(dd.includes("loadProjectManagementMinutes(db, projectId, true)"));assert.ok(dd.includes('item_date,extracted_at").eq("project_id",projectId).eq("workspace_shared",true)'));
assert.ok(dd.includes('notes:null'));
assert.ok(!dd.includes('period_start_ym,period_end_ym,notes'));
assert.ok(fs.readFileSync("src/components/dd/DdProjectPageBody.tsx","utf8").includes('initialPayload={data.contributions} sharedView'));
console.log("Disclosure boundary: positive provenance, channel publication, AMD/unknown/spoof rejection, prep and DD protection OK");

// Execute the actual handlers with controlled auth and PostgREST transports.
type ResolveContext = {parentURL?:string; conditions?:string[]; importAttributes?:Record<string,string>};
type ResolveResult = {url:string; shortCircuit?:boolean; format?:string};
const {registerHooks}=await import("node:module") as unknown as {registerHooks(hooks:{resolve(specifier:string,context:ResolveContext,next:(specifier:string,context:ResolveContext)=>ResolveResult):ResolveResult}):{deregister():void}};
let internal=false;
const fixtureRows=[
 {project_id:"fixture",source:"slack",ym:"202610",item_id:"C1:1",item_date:"2026-10-01",metadata_json:{channel_id:"C1",permalink:"https://external.slack.com/archives/C1/p1",text_full:"shared message"}},
 {project_id:"fixture",source:"slack",ym:"202609",item_id:"C2:1",metadata_json:{channel_id:"C2",permalink:"https://teamarmadahq.slack.com/archives/C2/p1",text_full:"internal secret"}},
 {project_id:"fixture",source:"slack",ym:"202608",item_id:"C3:1",metadata_json:{channel_id:"C3",permalink:"https://external.slack.com/archives/C3/p1",text_full:"unpublished"}},
 {project_id:"fixture",source:"slack",ym:"202607",item_id:"C1:2",metadata_json:{channel_id:"C1",text_full:"unknown origin"}},
];
const reads:Array<{table:string;filters:Array<[string,string,unknown]>}>=[];
const fakeDb={from(table:string){const filters:Array<[string,string,unknown]>=[];reads.push({table,filters});const query={select(){return query},eq(k:string,v:unknown){filters.push(["eq",k,v]);return query},in(k:string,v:unknown){filters.push(["in",k,v]);return query},order(){return query},range(){return query},limit(){return query},then(resolve:(r:unknown)=>void){let data:Record<string,unknown>[] = table==="project_slack_sources"?targets as unknown as Record<string,unknown>[]:table==="source_cache"?fixtureRows:table==="project_strategy_signals"?[{project_id:"fixture",workspace_shared:true,title:"shared signal",status:"confirmed"},{project_id:"fixture",workspace_shared:false,title:"private strategy",status:"confirmed"}]:[];data=data.filter(row=>filters.every(([op,k,v])=>{const value=k==="metadata_json->>channel_id"?(row.metadata_json as Record<string,unknown>)?.channel_id:row[k];return op==="eq"?value===v:!Array.isArray(v)||v.includes(value)}));resolve({data,error:null});}};return query}};
const state=globalThis as typeof globalThis & {amieBoundaryTest?:Record<string,unknown>};
state.amieBoundaryTest={db:fakeDb,member:()=>internal?{ok:true}:{ok:false,errorResponse:Response.json({ok:false},{status:401})},access:(id:string)=>id==="fixture",meetings:(_id:string,options:{sharedOnly?:boolean})=>{assert.equal(options.sharedOnly,true);return [{meetingId:"public",prepDraftMd:"private prep",prepWorkerSessionId:"private session",narrativeMd:"approved minutes\n## 会議前準備メモ\nprivate plan"}]}};
const data=(source:string)=>({url:"data:text/javascript,"+encodeURIComponent(source),shortCircuit:true});
const hook=registerHooks({resolve(specifier,context,next){
 if(specifier==="next/server")return data('export const NextRequest=Request;export const NextResponse=Response');
 if(specifier==="@/lib/supabase/api-auth")return data('export async function requireMember(){return globalThis.amieBoundaryTest.member()}');
 if(specifier==="@/lib/shared-workspace-project-read-access")return data('export async function hasSharedWorkspaceProjectReadAccess(id){return globalThis.amieBoundaryTest.access(id)}');
 if(specifier==="@/lib/project-shared-workspace-access")return data('export async function resolveSharedWorkspaceAccess(id){return globalThis.amieBoundaryTest.access(id)}');
 if(specifier==="@/lib/supabase/admin")return data('export function createAdminClient(){return globalThis.amieBoundaryTest.db}');
 if(specifier==="@/lib/supabase-data")return data('export async function fetchProjectMeetingSummaries(id,opts){return globalThis.amieBoundaryTest.meetings(id,opts)}');
 if(specifier==="@/lib/shared-meeting-content")return {url:new URL("../src/lib/shared-meeting-content.ts",import.meta.url).href,shortCircuit:true};
 if(specifier==="@/lib/slack/archive-boundary")return {url:new URL("../src/lib/slack/archive-boundary.ts",import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
try{
 // Project filters also apply to source registration.
 for(const t of targets)Object.assign(t,{project_id:"fixture"});
 const slackHandler=await import("../src/app/api/slack/messages/route.ts");
 const externalResult=await slackHandler.GET(new Request("https://app.test/api/slack/messages?projectId=fixture") as never);
 assert.equal(externalResult.status,200);assert.equal(externalResult.headers.get("Cache-Control"),"private, no-store, max-age=0");
 const result=await externalResult.json();assert.deepEqual(result.data.months,["202610"]);assert.deepEqual(result.data.messages.map((m:{text:string})=>m.text),["shared message"]);
 assert.equal((await slackHandler.GET(new Request("https://app.test/api/slack/messages?projectId=other") as never)).status,401);
 internal=true;const internalResult=await (await slackHandler.GET(new Request("https://app.test/api/slack/messages?projectId=fixture&ym=202608") as never)).json();assert.deepEqual(internalResult.data.messages.map((m:{text:string})=>m.text),["unpublished"]);
 const meetingsHandler=await import("../src/app/api/project/[projectId]/workspace-meetings/route.ts");
 const meetingResult=await (await meetingsHandler.GET(new Request("https://app.test/meetings"),{params:Promise.resolve({projectId:"fixture"})})).json();assert.equal(meetingResult.meetings[0].narrativeMd,"approved minutes");assert.equal(meetingResult.meetings[0].prepDraftMd,null);assert.equal(meetingResult.meetings[0].prepWorkerSessionId,null);assert.equal(meetingResult.signals.length,1);assert.equal(meetingResult.signals[0].title,"shared signal");
 assert.equal((await meetingsHandler.GET(new Request("https://app.test/meetings"),{params:Promise.resolve({projectId:"other"})})).status,404);
 console.log("Actual shared APIs: external scoped months/messages, internal retained archive, unpublished strategy/prep exclusion and unauthorized denial OK");
}finally{hook.deregister();delete state.amieBoundaryTest}
