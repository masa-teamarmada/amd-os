import 'server-only';
import {resolveCanonicalPageAccess,projectPageActor} from './project-canonical-page-server';
import {projectPageSource,readProjectPage} from './project-page-server';
import {projectPageId} from './project-page-registry';
import {projectSurfacePageGroups,projectSurfaceShowsPage} from './project-page-visibility';
import {projectFormatTypeOf,DEFAULT_TABS} from './project-formats';
import {resolveExecutiveMeetingViewer} from '@/lib/project-executive-meeting-access';
import type {ProjectSurface} from '@/lib/project-surface-permissions';
/** 入口は入場確認・表示するIDの選択だけを担当する。本文の取得は単一ページへ渡す。 */
export async function projectSurfaceEntry(projectId:string,surface:ProjectSurface,requested?:string,slug?:string){
 const access=await resolveCanonicalPageAccess(projectId,surface,slug);if(!access)return null;
 const actor=await projectPageActor(access);
 const [source,executive]=await Promise.all([projectPageSource(projectId,actor),resolveExecutiveMeetingViewer(projectId)]);
 const groups=projectSurfacePageGroups(surface,projectFormatTypeOf({projectId,projectCategory:source.identity.project_category}),source.index,Boolean(executive));
 const candidate=projectPageId(requested??(surface==='cockpit'?DEFAULT_TABS.cockpit:surface==='workspace'?(actor.external?'issues':'weekly'):'report:source-index'));
 const pageId=candidate&&projectSurfaceShowsPage(candidate,groups)?candidate:groups[0]?.children[0]?.key;
 if(!pageId)return null;
 return {source,actor,executive:Boolean(executive),runtime:await readProjectPage(projectId,pageId,actor,source)};
}
