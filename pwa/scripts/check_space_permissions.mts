import assert from 'node:assert/strict';
import {memberSurfacePermission} from '../src/lib/project-surface-permissions.ts';
import {buildSpacePermissionRows,buildSpacePermissionMatrix,canonicalProjectDdPackage,type PermissionLedgerData} from '../src/lib/space-permission-ledger.ts';
import {newWorkspaceAccountIdentity} from '../src/lib/workspace-account-identity.ts';
const base={memberId:'ID2',isAdmin:false,scope:'project' as const,projects:[]};
const view={project_id:'p1',member_id:'ID2',surface:'cockpit' as const,permission:'view' as const};
assert.equal(memberSurfacePermission({...base,surfaceGrants:[view]},'p1','cockpit'),'view');
assert.equal(memberSurfacePermission({...base,surfaceGrants:[view]},'p2','cockpit'),null);
assert.equal(memberSurfacePermission({...base,surfaceGrants:[{...view,member_id:'someone_else'}]},'p1','cockpit'),null);
assert.equal(memberSurfacePermission({...base,surfaceGrants:[view]},'p1','workspace'),null);
assert.equal(memberSurfacePermission({...base,surfaceGrants:[view]},'p1','dd'),null);
assert.equal(memberSurfacePermission({...base,surfaceGrants:[{...view,permission:'edit'}]},'p1','cockpit'),'edit');
assert.equal(memberSurfacePermission({...base,isAdmin:true},'p1','dd'),'edit');
const data:PermissionLedgerData={projects:[{project_id:'p1',project_name:'PJ1',status:'active'}],members:[{member_id:'ID2',member_name:'Member',code_name:'member',email:'known@example.com',status:'active',is_admin:false,os_access_scope:'project'}],projectMembers:[],memberGrants:[view],accounts:[{id:'a1',email:'known@example.com',display_name:'Other Name',status:'active'}],projectMemberships:[{id:'m1',project_id:'p1',user_account_id:'a1',role:'manager',status:'active'}],ddPackages:[{id:'d1',project_id:'p1',slug:'test',title:'DD',status:'open'}],ddGrants:[{id:'g1',package_id:'d1',user_account_id:'a1',status:'active',capabilities:['dd.view','dd.edit'],expires_at:'2000-01-01T00:00:00Z'}]};
let rows=buildSpacePermissionRows(data);assert.equal(rows.length,1,'same email is one person');
assert.equal(rows[0].permissions.cockpit.permission,'view');assert.equal(rows[0].permissions.workspace.permission,'edit');assert.equal(rows[0].permissions.dd.note,'期限切れ');
rows=buildSpacePermissionRows({...data,accounts:[{...data.accounts[0],status:'suspended'}]});assert.equal(rows[0].permissions.workspace.note,'アカウント停止中');
rows=buildSpacePermissionRows({...data,projectMemberships:[{...data.projectMemberships[0],status:'revoked'}],ddGrants:[{...data.ddGrants[0],status:'revoked'}]});assert.equal(rows[0].permissions.workspace.permission,null);assert.equal(rows[0].permissions.dd.permission,null);
console.log('space permission project/surface isolation, edit, identity merge, suspended, expired and revoked: PASS');
// Inspect top-level mutation control flow so authentication cannot accidentally
// land inside the asset-only branch while other entities remain writable.
import {readFileSync} from 'node:fs';
import ts from 'typescript';
for (const name of ['project-tech','project-ip']) {
 const source=readFileSync(`src/app/api/${name}/route.ts`,'utf8');
 const ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true);
 for (const method of ['POST','PATCH','DELETE']) {
  const fn=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===method) as ts.FunctionDeclaration;
  assert.ok(fn?.body);
  const topLevel=fn.body.statements.find(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(ast)==='auth'&&d.initializer?.getText(ast).includes('requireProjectContentEditor(')));
  assert.ok(topLevel,`${name} ${method}: scope authorization must apply to every entity at function level`);
  const body=fn.body.getText(ast);
  const mutation=Math.max(body.indexOf('.insert('),body.indexOf('.update('),body.indexOf('.delete('));
  assert.ok(body.indexOf('requireProjectContentEditor(')<mutation,`${name} ${method}: check before writing`);
 }
 assert.match(source,/delete patch\.project_id;/);
}
const ip=readFileSync('src/app/api/project-ip/route.ts','utf8');
assert.match(ip,/resourceProjectId\(entity,body\.id\)/);
assert.match(ip,/resourceProjectId\(entity,id\)/);
assert.match(ip,/project_ip_rights["']\)\.select\(["']ip_asset_id/,'rights authorization follows its actual asset FK');
const dd=readFileSync('src/app/api/dd/[slug]/edit/route.ts','utf8');
assert.match(dd,/item\.package_id!==access\.packageId/);
assert.match(dd,/body\.packageId!==access\.packageId/);
assert.match(dd,/hasDdCapability\(access,'dd.edit'\)/);
assert.ok(!dd.includes("'create_grant'")&&!dd.includes("'update_grant'"));
console.log('content mutation authentication for every entity, FK ownership and DD package/action limits: PASS');

const navigation=readFileSync('src/app/api/project-surface/navigation/[projectId]/route.ts','utf8');
for(const surface of ['cockpit','workspace','dd']) assert.ok(navigation.includes(`memberSurfacePermission(member, projectId, '${surface}')`));
const surfaceNav=readFileSync('src/components/nav/ProjectSurfaceNav.tsx','utf8');
assert.ok(surfaceNav.includes('summary?.canWorkspace'));
assert.ok(surfaceNav.includes('summary?.canCockpit'));
console.log('surface navigation resolves all three grants independently: PASS');

const official={...data.ddPackages[0],id:'z-official',created_at:'2026-09-30T07:05:00Z'};
const verification={...official,id:'a-test',status:'closed',created_at:'2026-09-30T07:21:00Z'};
assert.equal(canonicalProjectDdPackage([verification,official],'p1')?.id,'z-official');
const officialRows=buildSpacePermissionRows({...data,ddPackages:[verification,official],ddGrants:[{...data.ddGrants[0],package_id:'z-official',expires_at:null}]});
assert.equal(officialRows[0].permissions.dd.permission,'edit');
assert.equal(officialRows[0].permissions.dd.packageId,'z-official');
console.log('canonical DD selection ignores UUID order and later verification packages: PASS');

const matrix=buildSpacePermissionMatrix({...data,
 projects:[...data.projects,{project_id:'p2',project_name:'PJ2',status:'active'},{project_id:'ended',project_name:'Ended',status:'ended'}],
 members:[...data.members,{...data.members[0],member_id:'inactive',email:'inactive@example.com',status:'inactive'}],
 accounts:[...data.accounts,{...data.accounts[0],id:'active-external',email:'external@example.com'},
  {...data.accounts[0],id:'pending',email:'pending@example.com',status:'invited'},
  {...data.accounts[0],id:'stopped',email:'stopped@example.com',status:'suspended'}],
 memberGrants:[...data.memberGrants,{...view,project_id:'p2',surface:'dd',permission:'edit'}],
 projectMemberships:[...data.projectMemberships,{...data.projectMemberships[0],id:'pending-view',user_account_id:'pending',role:'readonly',status:'invited'}],
 ddGrants:[...data.ddGrants,{...data.ddGrants[0],id:'pending-dd',user_account_id:'pending',status:'invited',capabilities:['dd.view'],expires_at:null}],
});
assert.deepEqual(matrix.projects.map(p=>p.project_id),['p1','p2']);
assert.equal(matrix.people.length,3,'active internal/external and invited people, one row each across all active projects');
const known=matrix.people.find(p=>p.memberId==='ID2')!;
assert.deepEqual(Object.keys(known.projects),['p1','p2']);
assert.equal(known.projects.p1.permissions.cockpit.permission,'view');
assert.equal(known.projects.p2.permissions.cockpit.permission,null);
assert.equal(known.projects.p2.permissions.dd.permission,'edit');
assert.ok(!matrix.people.some(p=>['inactive@example.com','stopped@example.com'].includes(p.email)));
const pending=matrix.people.find(p=>p.accountId==='pending')!;
assert.equal(pending.status,'invited');
assert.equal(pending.projects.p1.permissions.workspace.permission,'view','granted viewer stays visible before first login');
assert.equal(pending.projects.p1.permissions.dd.permission,'view');
assert.equal(pending.projects.p1.permissions.dd.note,'初回ログイン待ち');
assert.equal(pending.projects.p2.permissions.workspace.permission,null,'listing does not grant access to another PJ');
assert.equal(pending.projects.p1.permissions.cockpit.permission,null,'invitation never grants internal cockpit');
assert.ok(matrix.people.some(p=>p.email==='external@example.com'),'active member with no grants remains available for granting');
const unnamed=buildSpacePermissionMatrix({...data,accounts:[{...data.accounts[0],id:'unnamed',email:'unnamed@example.com',display_name:null,status:'invited'}]}).people.find(p=>p.accountId==='unnamed')!;
assert.equal(unnamed.name,'unnamed@example.com','unregistered names remain distinguishable without inventing names');
assert.equal(unnamed.projects.p1.permissions.dd.permission,null);
console.log('member-first matrix: active PJ/person and invited viewers, suspended exclusion, identity and grant isolation: PASS');

const identity=newWorkspaceAccountIdentity({email:' NEW@Example.com ',displayName:' New Person ',affiliation:' Research University '});
assert.deepEqual(identity,{ok:true,email:'new@example.com',display_name:'New Person',affiliation:'Research University'});
assert.equal(newWorkspaceAccountIdentity({email:'bad',displayName:'Person',affiliation:'University'}).ok,false);
assert.equal(newWorkspaceAccountIdentity({email:'new@example.com',displayName:' ',affiliation:'University'}).ok,false);
assert.equal(newWorkspaceAccountIdentity({email:'new@example.com',displayName:'Person',affiliation:' '}).ok,false);
assert.equal(newWorkspaceAccountIdentity({email:'new@example.com',displayName:'Person',affiliation:'x'.repeat(161)}).ok,false);
const withAffiliation=buildSpacePermissionMatrix({...data,accounts:[{...data.accounts[0],affiliation:'Research University'}]}).people[0];
assert.equal(withAffiliation.affiliation,'Research University');
assert.equal(withAffiliation.email,'known@example.com');
console.log('new member identity: independent name/email/affiliation, normalization and required field limits: PASS');

// Exercise the actual account mutation function against a narrow DB double.
// A stale UI must never turn a duplicate "new member" into an attribute update.
const accessSource=readFileSync('src/app/api/admin/workspace-access/route.ts','utf8');
const accessAst=ts.createSourceFile('access',accessSource,ts.ScriptTarget.Latest,true);
const createAccountNode=accessAst.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='createAccount')!;
const createAccountJs=ts.transpileModule(createAccountNode.getText(accessAst),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
async function accountCase(existing:{id:string;status:string}|null=null,internal=false,body:Record<string,unknown>={createOnly:true,email:' NEW@example.com ',displayName:' New Person ',affiliation:' Research University '}) {
 const writes:Record<string,unknown>[]=[],audits:unknown[]=[];
 const db={from(table:string){const chain={select(){return chain;},eq(){return chain;},ilike(){return chain;},async maybeSingle(){return {data:table==='members'?(internal?{member_id:'known'}:null):existing,error:null};},insert(row:Record<string,unknown>){writes.push(row);return chain;},update(row:Record<string,unknown>){writes.push(row);return chain;},async single(){return {data:{id:'new-account'},error:null};}};return chain;}};
 const result=(payload:unknown,status=200)=>({payload,status});
 const create=new Function('newWorkspaceAccountIdentity','normalizeWorkspaceEmail','text','hasField','bad','failed','conflict','recordWorkspaceAuditEvent','NextResponse',`${createAccountJs};return createAccount;`)(newWorkspaceAccountIdentity,(raw:unknown)=>typeof raw==='string'?raw.trim().toLowerCase():null,(raw:unknown,max:number)=>typeof raw==='string'?raw.trim().slice(0,max):'',(b:object,k:string)=>Object.hasOwn(b,k),(error:string)=>result({error},400),(error:string)=>result({error},500),(error:string)=>result({error},409),async(_db:unknown,event:unknown)=>{audits.push(event);},{json:(payload:unknown,options?:{status:number})=>result(payload,options?.status)}) as (db:unknown,body:Record<string,unknown>)=>Promise<{payload:unknown;status:number}>;
 return {response:await create(db,body),writes,audits};
}
const createdIdentity=await accountCase();
assert.equal(createdIdentity.response.status,200);
assert.deepEqual(createdIdentity.writes,[{email:'new@example.com',display_name:'New Person',affiliation:'Research University',status:'invited'}]);
assert.equal(createdIdentity.audits.length,1);
for(const existing of [{id:'existing',status:'invited'},{id:'existing',status:'active'},{id:'existing',status:'suspended'}]) {
 const duplicate=await accountCase(existing);assert.equal(duplicate.response.status,409);assert.equal(duplicate.writes.length,0);assert.equal(duplicate.audits.length,0);
}
const internalDuplicate=await accountCase(null,true);assert.equal(internalDuplicate.response.status,409);assert.equal(internalDuplicate.writes.length,0);
const missingAffiliation=await accountCase(null,false,{createOnly:true,email:'new@example.com',displayName:'Person'});assert.equal(missingAffiliation.response.status,400);assert.equal(missingAffiliation.writes.length,0);
console.log('account creation: independent invited identity and audit, stale duplicate/internal/suspended refusal without writes: PASS');
