import 'server-only';
import {createAdminClient} from './supabase/admin.ts';
import {getCurrentMemberAccess} from './project-workspace.ts';
import {resolveSharedWorkspaceAccess} from './project-shared-workspace-access.ts';
import {memberSurfacePermission,type ProjectSurface} from './project-surface-permissions.ts';
import {resolveDdPackageAccess} from './dd-access.ts';
import {hasDdCapability,type DdViewerAccess} from './dd-package-core.ts';
import {projectFormatTypeOf} from './project-formats.ts';
import {canonicalPageVisible,canonicalPageForChapter,canonicalPageDefinition,type ProjectCanonicalPageKey} from './project-canonical-pages.ts';
import {canEditDdReport,loadDdReportEdition,loadProjectReportEdition,loadDdReportChapterIndex,loadDdReportChapter,evaluatedDdReportChapter,loadDdReportModel,redactDdReport} from './dd-report-server.ts';
import {loadDdProjectPage} from './dd-project-pages-server.ts';
import {ddReportDownloadRelease} from './dd-report-download-policy.ts';
import type {ProjectCanonicalPageData} from './project-canonical-page-types.ts';
import type {DdReportEdition,DdReportChapter} from './dd-report-types.ts';

export type CanonicalPageAccess={projectId:string;surface:ProjectSurface;external:boolean;canEdit:boolean;actorId?:string;dd:DdViewerAccess|null};
/** 本文・版・PJの存在を読む前に、要求されたスペースへの入場を検証する。 */
export async function resolveCanonicalPageAccess(projectId:string,surface:ProjectSurface,slug?:string):Promise<CanonicalPageAccess|null>{
  if(surface==='dd'){
    if(!slug)return null;const dd=await resolveDdPackageAccess(slug);
    return dd&&dd.projectId===projectId?{projectId,surface,external:dd.principal==='workspace_account',canEdit:false,actorId:dd.principal==='workspace_account'?undefined:dd.memberId,dd}:null;
  }
  if(surface==='workspace'){
    const access=await resolveSharedWorkspaceAccess(projectId);if(!access)return null;
    return {projectId,surface,external:access.principal==='workspace_account',canEdit:access.canManage,actorId:access.principal==='workspace_account'?undefined:access.memberId,dd:null};
  }
  const member=await getCurrentMemberAccess();if(!member)return null;
  const permission=memberSurfacePermission(member,projectId,'cockpit');
  return permission?{projectId,surface,external:false,canEdit:permission==='edit',actorId:member.memberId,dd:null}:null;
}
export function canSaveCanonicalInputs(access:CanonicalPageAccess,page:ProjectCanonicalPageKey){
  return page==='cost-model'&&!access.external&&Boolean(access.actorId)&&(access.surface==='cockpit'?access.canEdit:access.surface==='dd'&&!!access.dd&&canEditDdReport(access.dd));
}
export async function canonicalReportEdition(access:CanonicalPageAccess,page:ProjectCanonicalPageKey):Promise<{edition:DdReportEdition;slug:string;projectName:string}|null>{
  const db=createAdminClient();
  const identity=await db.from('projects').select('project_id,project_name,display_name,project_category').eq('project_id',access.projectId).maybeSingle();
  if(identity.error)throw new Error('ページを読み込めなかった');if(!identity.data)return null;
  const type=projectFormatTypeOf({projectId:access.projectId,projectCategory:identity.data.project_category});
  if(!canonicalPageVisible(page,access.surface,type))throw new Error('page_not_allowed');
  if(access.dd){const edition=await loadDdReportEdition(access.dd);return edition?{edition,slug:access.dd.slug,projectName:identity.data.display_name||identity.data.project_name}:null;}
  // スペースの許可で取得できるのは、そのスペースに表示するページの本文だけ。
  const pkg=await db.from('dd_packages').select('id,slug').eq('project_id',access.projectId).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(1).maybeSingle();
  if(pkg.error)throw new Error('共通本文の版を読み込めなかった');if(!pkg.data)return null;
  const edition=await loadProjectReportEdition(pkg.data.id,!access.external);
  return edition?{edition,slug:pkg.data.slug,projectName:identity.data.display_name||identity.data.project_name}:null;
}
export async function loadProjectCanonicalPage(access:CanonicalPageAccess,page:ProjectCanonicalPageKey):Promise<ProjectCanonicalPageData|null>{
  const source=await canonicalReportEdition(access,page);if(!source)return null;
  const {edition,slug,projectName}=source,definition=canonicalPageDefinition(page,access.projectId);
  const [allIndex,model]=await Promise.all([loadDdReportChapterIndex(edition.id),loadDdReportModel(edition)]);
  const identity=await createAdminClient().from('projects').select('project_category').eq('project_id',access.projectId).single();
  if(identity.error)throw new Error('ページの分類を読み込めなかった');
  const type=projectFormatTypeOf({projectId:access.projectId,projectCategory:identity.data.project_category});
  const index=access.surface==='dd'?allIndex:allIndex.filter(chapter=>{const key=canonicalPageForChapter(chapter.slug);return key&&canonicalPageVisible(key,access.surface,type);});
  if(!definition.chapters.every(slug=>allIndex.some(chapter=>chapter.slug===slug)))throw new Error('共通本文の章が不足している。原記録は保持されている。');
  const chapters=(await Promise.all(definition.chapters.map(async key=>{
    const raw=await loadDdReportChapter(edition.id,key);return raw?await evaluatedDdReportChapter(edition,raw):null;
  }))).filter((chapter):chapter is DdReportChapter=>chapter!==null);
  // 版の欠落を旧計画で埋めない。本文の取得不備として表示する。
  if(!chapters.length)throw new Error('共通本文が未登録。元の記録は原記録から確認できる。');
  const inputs=model.inputs.filter(input=>chapters.some(c=>c.source_sheet===input.sheet)&&['cyanobacteria-cost','reactor-cost','metal-cost','fame-cost','assumptions'].some(key=>chapters.some(c=>c.slug===key&&c.source_sheet===input.sheet)));
  const records=access.surface==='dd'&&definition.records?await loadDdProjectPage(access.projectId,definition.records,true):null;
  return redactDdReport(access.projectId,{projectId:access.projectId,page,projectName,slug,edition:{id:edition.id,title:edition.title,revision:edition.revision,sourceVersion:edition.source_version,documentVersion:edition.document_version,sourceSha256:edition.source_sha256,glossary:edition.glossary},chapters,index,inputs,overrides:Object.fromEntries(Object.entries(edition.input_overrides).filter(([key])=>inputs.some(i=>`${i.sheet}!${i.address}`===key))),records,canEditRecords:access.canEdit,canSaveInputs:canSaveCanonicalInputs(access,page),canDownload:!!access.dd&&hasDdCapability(access.dd,'dd.download'),downloadRelease:ddReportDownloadRelease(edition)});
}
