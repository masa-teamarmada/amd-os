'use client';
import {ProjectControlPage,type SxWeeklyControlView} from '../project-pages/ProjectControlPage';
import {useProjectPageRuntime} from '../project-pages/ProjectPageContext';
import {ProjectPageLoading} from '@/components/project-space/ProjectPageLoading';
export function CockpitProjectControl({view,onViewChange}:{projectId:string;view:SxWeeklyControlView;onViewChange?:(next:SxWeeklyControlView)=>void}){
 const runtime=useProjectPageRuntime();if(!runtime?.operations.workspace)return <ProjectPageLoading/>;
 return <ProjectControlPage bundle={runtime.operations.workspace} access={runtime.operations.viewer as never} view={view} embedded onViewChange={onViewChange}/>;
}
