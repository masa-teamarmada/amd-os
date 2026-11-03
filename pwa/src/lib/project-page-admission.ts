import 'server-only';
import {resolveExecutiveMeetingViewer} from '@/lib/project-executive-meeting-access';
import {resolveCanonicalPageAccess,projectPageActor} from './project-canonical-page-server';
import {projectFormatTypeOf} from '@/lib/project-formats';
import {projectPageId} from './project-page-registry';
import {projectSurfacePageGroups,projectSurfaceShowsPage} from './project-page-visibility';
import {projectPageSource} from './project-page-server';
import type {ProjectSurface} from '@/lib/project-surface-permissions';
export async function admitProjectPage(projectId:string,surface:ProjectSurface,requestedId:string,slug?:string){
 const pageId=projectPageId(requestedId);if(!pageId)return null;
 const access=await resolveCanonicalPageAccess(projectId,surface,slug);if(!access)return null;
 const actor=await projectPageActor(access),source=await projectPageSource(projectId,actor);
 const type=projectFormatTypeOf({projectId,projectCategory:source.identity.project_category});
 const executive=pageId==='executive-meeting'?Boolean(await resolveExecutiveMeetingViewer(projectId)):false;
 const groups=projectSurfacePageGroups(surface,type,source.index,executive,actor.external);
 if(!projectSurfaceShowsPage(pageId,groups))return null;
 return {pageId,actor,source};
}
