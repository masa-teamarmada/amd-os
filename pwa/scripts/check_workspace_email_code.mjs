// Actual callback route, fake Auth/DB boundaries. Never sends mail or contacts production.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { NextResponse } from 'next/server.js';
import { signWorkspaceSessionValue, verifyWorkspaceSessionValue } from '../src/lib/workspace-access-session-core.ts';
const state = globalThis.amieCodeTest = { verified: 0, signedOut: 0, account: true, grant: true, conflict: false, failActivation: false, validCode: true, used: false, audits: [] };
const secret = 'test-only-workspace-signing-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.example.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-test-role';
process.env.NODE_ENV = 'production';
const fake = `
export async function createClient(){return {auth:{verifyOtp:async ({email,token,type})=>{
 const s=globalThis.amieCodeTest;s.verified++;if(!s.validCode||s.used||token!=='12345678'||type!=='email')return {data:{user:null},error:{code:'otp_expired'}};
 s.used=true;return {data:{session:{},user:{id:'verified-user',email}},error:null};},signOut:async()=>{globalThis.amieCodeTest.signedOut++;return {error:null}}}}}
export function createServiceClient(){return {from:()=>{const q={select:()=>q,eq:()=>q,in:()=>q,update:()=>q,
 maybeSingle:async()=>({data:globalThis.amieCodeTest.account?{id:'account',email_normalized:'reader@example.test',status:'invited',auth_user_id:globalThis.amieCodeTest.conflict?'other-user':null}:null}),
 then:(yes,no)=>Promise.resolve({error:globalThis.amieCodeTest.failActivation?{}:null}).then(yes,no)};return q}}}
export async function cookies(){return {getAll:()=>[]}}
export async function resolveWorkspaceAccessForAccount(){return globalThis.amieCodeTest.grant?{projects:[{id:'p21'}],institutionWorkspaces:[]}:null}
export async function resolveDdViewerScopeForAccount(){return globalThis.amieCodeTest.grant?{}:null}
export async function recordWorkspaceAuditEvent(service,event){globalThis.amieCodeTest.audits.push(event)}
`;
const mockUrl = 'data:text/javascript,' + encodeURIComponent(fake);
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='next/server')return {url:import.meta.resolve('next/server.js'),shortCircuit:true};
 if(specifier==='@supabase/supabase-js')return {url:'data:text/javascript,'+encodeURIComponent('export {createServiceClient as createClient} from '+JSON.stringify(mockUrl)),shortCircuit:true};
 if(['@/lib/supabase/server','next/headers','@/lib/workspace-access-resolver','@/lib/dd-access','@/lib/workspace-access-audit'].includes(specifier))return {url:mockUrl,shortCircuit:true};
 if(specifier==='@/lib/workspace-access-session')return {url:'data:text/javascript,'+encodeURIComponent(`export const WORKSPACE_SESSION_COOKIE='amd_os_workspace_session';export const WORKSPACE_SESSION_MAX_AGE=2592000;export const createWorkspaceSessionCookieValue=globalThis.amieCodeSign;`),shortCircuit:true};
 if(specifier==='@/lib/project-workspace-session')return {url:'data:text/javascript,'+encodeURIComponent(`export const PROJECT_WORKSPACE_SESSION_COOKIE='unused';export const PROJECT_WORKSPACE_SESSION_MAX_AGE=1;export function createProjectWorkspaceSessionValue(){throw Error('Internal session must not be issued')}`),shortCircuit:true};
 if(specifier.startsWith('@/'))return nextResolve(new URL('../src/'+specifier.slice(2)+'.ts',import.meta.url).href,context);
 if(context.parentURL?.startsWith("data:"))return {url:import.meta.resolve(specifier),shortCircuit:true};
 return nextResolve(specifier,context);
}});
globalThis.amieCodeSign=(accountId,email)=>signWorkspaceSessionValue({accountId,email},secret);
try{
 const source=readFileSync(new URL('../src/app/auth/callback/route.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {POST}=await import('data:text/javascript,'+encodeURIComponent(js));
 const request=(fields={},origin='https://app.example.test')=>new Request('https://app.example.test/auth/callback',{method:'POST',headers:{origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:'reader@example.test',token:'12345678',next:'/dd/sol',...fields})});
 assert.equal((await POST(request({},'https://attacker.example.test'))).status,403);assert.equal(state.verified,0);
 assert.equal((await POST(request({token:'bad'}))).status,303);assert.equal(state.verified,0);
 const success=await POST(request());assert.ok(success instanceof NextResponse);assert.equal(success.status,303);assert.equal(success.headers.get('location'),'https://app.example.test/dd/sol');
 const cookie=success.cookies.get('amd_os_workspace_session');assert.ok(cookie);assert.equal(verifyWorkspaceSessionValue(cookie.value,secret).accountId,'account');assert.equal(success.cookies.getAll().length,1);assert.equal(success.headers.get('cache-control'),'no-store');assert.ok(success.headers.get('set-cookie').includes('HttpOnly'));assert.ok(success.headers.get('set-cookie').includes('Secure'));
 const replay=await POST(request());assert.equal(replay.cookies.get('amd_os_workspace_session'),undefined);assert.ok(replay.headers.get('location').includes('workspace_code_failed'));assert.ok(replay.headers.get('location').includes('next=%2Fdd%2Fsol'));
 for(const [key,expect] of [['account','workspace_account_not_found'],['grant','workspace_no_access'],['conflict','workspace_account_conflict'],['failActivation','workspace_activation_failed'],['validCode','workspace_code_failed']]){
  state.used=false;state[key]=!['account','grant','validCode'].includes(key);const result=await POST(request());assert.equal(result.status,303);assert.equal(result.cookies.get('amd_os_workspace_session'),undefined);assert.ok(result.headers.get('location').includes(expect),key);state[key]=['account','grant','validCode'].includes(key);
 }
 state.used=false;const safe=await POST(request({next:'https://attacker.example.test'}));assert.equal(safe.headers.get('location'),'https://app.example.test/workspaces');
 assert.ok(!JSON.stringify(state.audits).includes('12345678'));assert.ok(!JSON.stringify(state.audits).includes(secret));
 console.log('PASS: code callback works without PKCE cookies; cross-origin, invalid/reused/expired code, absent/stopped account, conflicting identity, absent grant and failed activation cannot issue sessions; narrow signed cookie and 303 redirect verified. No mail/network.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{hook.deregister();delete globalThis.amieCodeTest;delete globalThis.amieCodeSign;}
