import {notFound,redirect} from 'next/navigation';
import {ProjectSurfaceView} from '@/components/project-pages/ProjectSurfaceView';
import {projectSurfaceEntry} from '@/lib/project-surface-entry';
export default async function CockpitPage({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<{tab?:string;ym?:string;meeting?:string}>}){
 const {projectId}=await params,query=await searchParams;
 if(query.tab==='dd')redirect('/project/'+encodeURIComponent(projectId)+'/dd');
 const entry=await projectSurfaceEntry(projectId,'cockpit',query.tab);if(!entry)notFound();
 return <ProjectSurfaceView projectId={projectId} projectName={entry.runtime.projectName} projectCategory={entry.source.identity.project_category??undefined} surface="cockpit" slug={entry.source.slug} initialPage={entry.runtime.pageId} initialRuntime={entry.runtime} initialModalYm={query.meeting?null:query.ym} canExecutiveMeeting={entry.executive}/>;
}
