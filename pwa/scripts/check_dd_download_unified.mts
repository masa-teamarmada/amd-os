import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as core from '../src/lib/dd-package-core.ts';
import {memberSurfacePermission} from '../src/lib/project-surface-permissions';
import {DdAdminPanel} from '../src/components/dd/DdAdminPanel';
const account={id:'viewer',email_normalized:'viewer@example.test',auth_user_id:'auth',status:'active'};
const pkg={id:'package',slug:'sol',project_id:'p21',title:'SolvioraX DD資料',status:'open'};
let member:any=null,session:any={accountId:account.id,email:account.email_normalized},nda=true;
let grant:any={id:'grant',package_id:pkg.id,status:'active',capabilities:['dd.view'],expires_at:null};
function query(table:string){const q:any={select:()=>q,eq:()=>q,in:()=>q,maybeSingle:async()=>({data:table==='workspace_user_accounts'?account:pkg,error:null}),then:(resolve:any)=>Promise.resolve({data:table==='dd_package_grants'?[grant]:[pkg],error:null}).then(resolve)};return q;}
const mocks:any={
 'server-only':{},
 '../src/lib/dd-nda-server':{hasDdNdaConfirmation:async()=>nda},
 '../src/lib/supabase/admin':{createAdminClient:()=>({from:query})},
 '../src/lib/project-surface-permissions':{memberSurfacePermission},
 '../src/lib/project-workspace':{getCurrentMemberAccess:async()=>member},
 '../src/lib/workspace-access-session':{getWorkspaceAccessCandidateSession:async()=>session},
 '../src/lib/dd-package-core':core,
};
const source=ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'src/lib/dd-access.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out:any={};new Function('require','exports',source)((name:string)=>{assert(name in mocks,name);return mocks[name];},out);
let access=await out.resolveDdPackageAccess('sol');assert(access);assert(core.hasDdCapability(access,'dd.download'));assert(!core.hasDdCapability(access,'dd.edit'));
nda=false;assert.equal(await out.resolveDdPackageAccess('sol'),null,'NDA確認前はDLの認可まで進めない');nda=true;
for(const status of ['suspended','revoked','invited']){grant.status=status;assert.equal(await out.resolveDdPackageAccess('sol'),null,status);}grant.status='active';
grant.expires_at='2020-01-01T00:00:00Z';assert.equal(await out.resolveDdPackageAccess('sol'),null);grant.expires_at=null;
pkg.status='closed';assert.equal(await out.resolveDdPackageAccess('sol'),null);pkg.status='open';
account.status='suspended';assert.equal(await out.resolveDdPackageAccess('sol'),null);account.status='active';
session=null;assert.equal(await out.resolveDdPackageAccess('sol'),null);
member={memberId:'member',isAdmin:false,scope:'project',projects:[],surfaceGrants:[{project_id:'p21',member_id:'member',surface:'dd',permission:'view'}]};
access=await out.resolveDdPackageAccess('sol');assert(access);assert(core.hasDdCapability(access,'dd.download'));assert(!core.hasDdCapability(access,'dd.edit'));
member.surfaceGrants=[];assert.equal(await out.resolveDdPackageAccess('sol'),null,'別領域の所属からDDは許可されない');
const state:any={package:{...pkg,updated_at:'2026-10-20T00:00:00Z',notice_text:null},items:[],events:[],exports:[],grants:[{id:'grant',accountId:'viewer',email:'viewer@example.test',accountStatus:'active',status:'active',capabilities:['dd.view'],organizationName:'BNV',note:null,expiresAt:null,createdAt:'2026-10-20T00:00:00Z',updatedAt:'2026-10-20T00:00:00Z',lastLoginAt:null}]};
const html=renderToStaticMarkup(createElement(DdAdminPanel,{state,candidates:[],onChanged:()=>{}}));
assert(html.includes('閲覧・資料のダウンロード'));for(const text of ['ダウンロードを外す','ダウンロードを許可','添付のダウンロードも許可'])assert(!html.includes(text),text);
assert(html.includes('停止')&&html.includes('失効')&&html.includes('期限（任意）'));
for(const [rel,forbidden]of [['src/components/admin/WorkspaceAccessAdminPanel.tsx','ダウンロードも許可'],['src/components/admin/SpacePermissionsAdminPanel.tsx',"existing?.capabilities.includes('dd.download')"]])assert(!fs.readFileSync(path.join(process.cwd(),rel),'utf8').includes(forbidden));
console.log('PASS: legacy external + internal view grants include download / NDA + suspension + revocation + expiry + account + package checks retained / editing isolated / settings have no separate DL toggle');
