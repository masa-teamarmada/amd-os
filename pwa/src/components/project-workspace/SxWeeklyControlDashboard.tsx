'use client';
import type {ProjectPageRuntime} from '@/lib/project-page-runtime-types';
import {ProjectSurfaceView} from '../project-pages/ProjectSurfaceView';
import type {ProjectWorkspaceBundle,CurrentMemberAccess} from '@/lib/project-workspace';
import type {SharedWorkspaceAccess} from '@/lib/project-shared-workspace-access';
export type {EditorState,SxWeeklyControlView} from '../project-pages/ProjectControlPage';
import type {SxWeeklyControlView} from '../project-pages/ProjectControlPage';
type Props={initialRuntime?:ProjectPageRuntime;bundle:ProjectWorkspaceBundle;access:{principal?:"member"|"workspace_account";memberId:string|null;displayName:string;scope:"portfolio"|"project";isAdmin:boolean;canCockpit?:boolean};view?:SxWeeklyControlView;embedded?:boolean;onViewChange?:(view:SxWeeklyControlView)=>void;ddHref?:string;canExecutiveMeeting?:boolean};
export function SxWeeklyControlDashboard({bundle,access,view,initialRuntime,embedded,onViewChange,ddHref,canExecutiveMeeting}:Props){
 return <ProjectSurfaceView projectId={bundle.project.projectId} projectName={bundle.project.projectName} projectCategory={bundle.project.projectCategory??undefined} surface="workspace" initialPage={view} initialRuntime={initialRuntime} embedded={embedded} onPageChange={onViewChange as never} external={'principal' in access&&access.principal==='workspace_account'} ddHref={ddHref} canExecutiveMeeting={canExecutiveMeeting}/>;
}
