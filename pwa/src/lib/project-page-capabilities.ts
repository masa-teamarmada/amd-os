import {memberSurfacePermission,type SurfaceMember} from '@/lib/project-surface-permissions';
import {hasDdCapability,type DdViewerAccess} from './dd-package-core.ts';
/** 入場資格から本人の権限を１回解決する。現在のスペース名は受け取らない。 */
export function projectPageCapabilities(member:SurfaceMember|null,projectId:string,dd:DdViewerAccess|null){
 const privateRecords=Boolean(member&&(member.isAdmin||memberSurfacePermission(member,projectId,'cockpit')||memberSurfacePermission(member,projectId,'workspace')));
 const canEditRecords=Boolean(member&&(member.isAdmin||(['cockpit','workspace'] as const).some(kind=>memberSurfacePermission(member,projectId,kind)==='edit')));
 return {external:!privateRecords,canReadDraft:privateRecords||Boolean(dd?.preview),canEditRecords,canSaveInputs:canEditRecords||Boolean(dd&&hasDdCapability(dd,'dd.edit')),canDownload:privateRecords||Boolean(dd&&hasDdCapability(dd,'dd.download'))};
}

