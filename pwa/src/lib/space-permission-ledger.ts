import { memberSurfacePermission, type MemberSurfaceGrant, type ProjectSurface, type SurfacePermission } from './project-surface-permissions';
export type PermissionLedgerData = {
 projects:{project_id:string;project_name:string;status:string}[];
 members:{member_id:string;member_name:string|null;code_name:string;email:string;status:string;is_admin:boolean;os_access_scope:'portfolio'|'project'}[];
 projectMembers:{project_id:string;member_id:string;is_active:boolean}[];
 memberGrants:MemberSurfaceGrant[];
 accounts:{id:string;email:string;display_name:string|null;status:string}[];
 projectMemberships:{id:string;project_id:string;user_account_id:string;role:string;status:string}[];
 ddPackages:{id:string;project_id:string;slug:string;title:string;status:string;created_at?:string}[];
 ddGrants:{id:string;package_id:string;user_account_id:string;status:string;capabilities:string[];expires_at:string|null}[];
};
export type LedgerPermission = {permission:SurfacePermission|null;note:string;grantId?:string;packageId?:string;capabilities?:string[]};
export type PermissionLedgerRow = {key:string;projectId:string;projectName:string;name:string;email:string;memberId?:string;accountId?:string;status:string;isAdmin:boolean;permissions:Record<ProjectSurface,LedgerPermission>};
export type PermissionMatrixPerson = Pick<PermissionLedgerRow,'name'|'email'|'memberId'|'accountId'|'isAdmin'> & {key:string;projects:Record<string,PermissionLedgerRow>};
// 表示対象の状態はアカウント/メンバーとPJの正本から取る。
// invitedは初回ログイン前なのでこの現役一覧には含めず、外部アクセス管理で扱う。
export function buildSpacePermissionMatrix(data:PermissionLedgerData,now=Date.now()) {
 const activeData={...data,projects:data.projects.filter(p=>p.status==='active'),members:data.members.filter(m=>m.status==='active'),accounts:data.accounts.filter(a=>a.status==='active')};
 const people=new Map<string,PermissionMatrixPerson>();
 for(const row of buildSpacePermissionRows(activeData,now)) {
  let person=people.get(row.email);
  if(!person) {person={key:row.email,name:row.name,email:row.email,memberId:row.memberId,accountId:row.accountId,isAdmin:row.isAdmin,projects:{}};people.set(row.email,person);}
  person.projects[row.projectId]=row;
 }
 return {projects:activeData.projects,people:[...people.values()]};
}
// 既存DD管理・ナビと同じ、PJで最初に作成した正本パッケージ。動作確認用をUUID順で選ばない。
export function canonicalProjectDdPackage(packages:PermissionLedgerData['ddPackages'],projectId:string) {
 return packages.filter(p=>p.project_id===projectId).sort((a,b)=>(a.created_at??'').localeCompare(b.created_at??''))[0];
}
export function buildSpacePermissionRows(data:PermissionLedgerData,now=Date.now()):PermissionLedgerRow[] {
 const people = new Map<string,{member?:PermissionLedgerData['members'][number];account?:PermissionLedgerData['accounts'][number]}>();
 for (const m of data.members) people.set(m.email.toLowerCase(),{member:m});
 for (const a of data.accounts) {const email=a.email.toLowerCase(); people.set(email,{...people.get(email),account:a});}
 const rows:PermissionLedgerRow[]=[];
 for (const project of data.projects) for (const [email,{member,account}] of people) {
  const permissions:Record<ProjectSurface,LedgerPermission>={cockpit:{permission:null,note:''},workspace:{permission:null,note:''},dd:{permission:null,note:''}};
  if (member?.status === 'active') for (const surface of ['cockpit','workspace','dd'] as const) {
   const grant=data.memberGrants.find(g=>g.member_id===member.member_id && g.project_id===project.project_id && g.surface===surface);
   const permission=memberSurfacePermission({memberId:member.member_id,isAdmin:member.is_admin,scope:member.os_access_scope,projects:data.projectMembers.filter(p=>p.is_active&&p.member_id===member.member_id).map(p=>({projectId:p.project_id})),surfaceGrants:data.memberGrants.filter(g=>g.member_id===member.member_id)},project.project_id,surface);
   const pkg=canonicalProjectDdPackage(data.ddPackages,project.project_id);
   permissions[surface]={permission,note:member.is_admin?'管理者':grant?'個別付与':permission?'既存権限':'',packageId:pkg?.id};
   if(surface==='workspace' && !member.is_admin && !grant && data.projectMembers.some(p=>p.is_active&&p.member_id===member.member_id&&p.project_id===project.project_id)) permissions.workspace={permission:'edit',note:'資料編集（既存所属）'};
   if(surface==='cockpit' && !member.is_admin && !grant && member.os_access_scope==='portfolio') permissions.cockpit={permission:'edit',note:'共有情報の編集（社内）'};
   if(surface==='dd' && permission && !member.is_admin && (!pkg || pkg.status==='closed' || (pkg.status==='draft'&&permission!=='edit'))) permissions.dd.note=!pkg?'パッケージ未作成':pkg.status==='draft'?'公開待ち':'受付終了';
  }
  if (account) {
   const m=data.projectMemberships.find(m=>m.project_id===project.project_id&&m.user_account_id===account.id);
   if (m && ['active','invited'].includes(m.status)) {
    const permission=m.role==='readonly'?'view':'edit';
    if(!permissions.workspace.permission || permission==='edit'&&permissions.workspace.permission!=='edit') permissions.workspace={permission,note:account.status==='suspended'?'アカウント停止中':m.status==='invited'?'初回ログイン待ち':m.role==='contributor'?'資料追加のみ':m.role==='manager'?'共有資料の編集':'個別付与',grantId:m.id};
   }
   const pkg=canonicalProjectDdPackage(data.ddPackages,project.project_id);
   const g=pkg&&data.ddGrants.find(g=>g.package_id===pkg.id&&g.user_account_id===account.id);
   if(g && ['active','invited'].includes(g.status) && g.capabilities.includes('dd.view')) {
    const permission=g.capabilities.includes('dd.edit')?'edit':'view';
    const expired=!!g.expires_at&&(!Number.isFinite(Date.parse(g.expires_at))||Date.parse(g.expires_at)<=now);
    if(!permissions.dd.permission || permission==='edit'&&permissions.dd.permission!=='edit') permissions.dd={permission,note:account.status==='suspended'?'アカウント停止中':expired?'期限切れ':pkg!.status!=='open'?'公開待ち':g.status==='invited'?'初回ログイン待ち':'個別付与',grantId:g.id,packageId:pkg!.id,capabilities:g.capabilities};
   }
  }
  rows.push({key:`${project.project_id}:${email}`,projectId:project.project_id,projectName:project.project_name,name:member?.member_name||member?.code_name||account?.display_name||'名前未登録',email,memberId:member?.member_id,accountId:account?.id,status:member?.status||account?.status||'',isAdmin:member?.status==='active'&&member.is_admin===true,permissions});
 }
 return rows;
}
