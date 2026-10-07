import assert from 'node:assert/strict';
import {memberSurfacePermission} from '../src/lib/project-surface-permissions.ts';
import {buildSpacePermissionRows,type PermissionLedgerData} from '../src/lib/space-permission-ledger.ts';
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
