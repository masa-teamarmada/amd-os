import {projectPageCapabilities} from './project-page-capabilities';
import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {getCurrentMemberAccess} from '@/lib/project-workspace';
import {resolveSharedWorkspaceAccess} from '@/lib/project-shared-workspace-access';
import {memberSurfacePermission,type ProjectSurface} from '@/lib/project-surface-permissions';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {hasDdCapability,type DdViewerAccess} from '@/lib/dd-package-core';
import {projectPageId} from './project-page-registry';
import {projectPageSource,readProjectReportPage} from './project-page-server';
import type {ProjectPageActor} from './project-page-actor';
import type {ProjectCanonicalPageKey} from './project-canonical-pages';
export type CanonicalPageAccess={projectId:string;surface:ProjectSurface;external:boolean;canEdit:boolean;actorId?:string;dd:DdViewerAccess|null};
/** スペースの認可は入口だけで行う。ページ本体の処理へ渡さない。 */
export async function resolveCanonicalPageAccess(projectId:string,surface:ProjectSurface,slug?:string):Promise<CanonicalPageAccess|null>{
 if(surface==='dd'){if(!slug)return null;const dd=await resolveDdPackageAccess(slug);return dd&&dd.projectId===projectId?{projectId,surface,external:dd.principal==='workspace_account',canEdit:hasDdCapability(dd,'dd.edit'),actorId:dd.principal==='workspace_account'?undefined:dd.memberId,dd}:null;}
 if(surface==='workspace'){const access=await resolveSharedWorkspaceAccess(projectId);return access?{projectId,surface,external:access.principal==='workspace_account',canEdit:access.canManage,actorId:access.principal==='workspace_account'?undefined:access.memberId,dd:null}:null;}
 const member=await getCurrentMemberAccess();if(!member)return null;const permission=memberSurfacePermission(member,projectId,'cockpit');
 return permission?{projectId,surface,external:false,canEdit:permission==='edit',actorId:member.memberId,dd:null}:null;
}
/** 同じ本人の操作権限。現在開いているスペース名では本文・操作を変えない。 */
export async function projectPageActor(access:CanonicalPageAccess):Promise<ProjectPageActor>{
 const member=await getCurrentMemberAccess(),shared=await resolveSharedWorkspaceAccess(access.projectId);
 let dd=access.dd;
 if(!dd){const p=await createAdminClient().from('dd_packages').select('slug').eq('project_id',access.projectId).order('created_at',{ascending:true}).limit(1).maybeSingle();if(p.error)throw new Error('閲覧範囲を確認できない');if(p.data)dd=await resolveDdPackageAccess(p.data.slug);}
 const viewer=member??shared??(dd?.principal==='workspace_account'?{principal:'workspace_account' as const,memberId:null,accountId:dd.accountId,email:dd.email,displayName:'共有閲覧者',role:'readonly' as const,scope:'project' as const,isAdmin:false as const,canEditEffort:false as const,canManage:false as const,projects:[{projectId:access.projectId,projectName:access.projectId}]}:null);
 if(!viewer)throw new Error('閲覧者を確認できない');
 const capabilities=projectPageCapabilities(member,access.projectId,dd);
 return {...capabilities,disclosures:{workspace:Boolean(shared),dd:Boolean(dd)},memberId:member?.memberId,viewer,workspaceAccess:{...viewer,projects:viewer.projects.some(p=>p.projectId===access.projectId)?viewer.projects:[...viewer.projects,{projectId:access.projectId,projectName:access.projectId}],canManage:capabilities.canEditRecords}};
}
export async function canSaveCanonicalInputs(access:CanonicalPageAccess,page:ProjectCanonicalPageKey){return page==='cost-model'&&(await projectPageActor(access)).canSaveInputs;}
export async function canonicalReportEdition(access:CanonicalPageAccess,_page:ProjectCanonicalPageKey){
 const source=await projectPageSource(access.projectId,await projectPageActor(access));return source.edition?{edition:source.edition,slug:source.slug,projectName:source.identity.display_name||source.identity.project_name}:null;
}
/** 旧APIは単一ページ取得への互換経路。別の取得処理を持たない。 */
export async function loadProjectCanonicalPage(access:CanonicalPageAccess,page:ProjectCanonicalPageKey){
 const id=projectPageId(page);if(!id)return null;return readProjectReportPage(access.projectId,id,await projectPageActor(access));
}
