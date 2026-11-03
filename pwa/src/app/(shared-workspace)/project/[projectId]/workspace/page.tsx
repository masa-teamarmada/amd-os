import {notFound} from 'next/navigation';
import {ProjectSurfaceView} from '@/components/project-pages/ProjectSurfaceView';
import {projectSurfaceEntry} from '@/lib/project-surface-entry';
import {resolveDdViewerScope} from '@/lib/dd-access';
import {SharedWorkspaceScopeRibbon} from '@/components/project-workspace/SharedWorkspaceScopeRibbon';
import {PageHistoryToolbar} from '@/components/nav/PageHistoryToolbar';
import {externalWorkspaceRoleCapabilityLabel} from '@/lib/workspace-capabilities';
export default async function SharedWorkspacePage({params}:{params:Promise<{projectId:string}>}){
 const {projectId}=await params,entry=await projectSurfaceEntry(projectId,'workspace');if(!entry)notFound();
 const viewer=entry.actor.viewer,external='principal' in viewer&&viewer.principal==='workspace_account';
 const ddScope=external?await resolveDdViewerScope().catch(()=>null):null,dd=ddScope?.packages.find(p=>p.projectId===projectId);
 return <><PageHistoryToolbar/>{external&&<SharedWorkspaceScopeRibbon projectName={entry.runtime.projectName} roleLabel={externalWorkspaceRoleCapabilityLabel(viewer.role)} principal="workspace_account" projectId={projectId}/>}<ProjectSurfaceView projectId={projectId} projectName={entry.runtime.projectName} projectCategory={entry.source.identity.project_category??undefined} surface="workspace" slug={entry.source.slug} external={external} initialPage={entry.runtime.pageId} initialRuntime={entry.runtime} canExecutiveMeeting={entry.executive} ddHref={dd?'/dd/'+encodeURIComponent(dd.slug):undefined}/></>;
}
