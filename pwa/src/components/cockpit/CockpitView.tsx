'use client';
import {ProjectSurfaceView} from '../project-pages/ProjectSurfaceView';
import type {ProjectPageRuntime} from '@/lib/project-page-runtime-types';
import type {ProjectOperationsPageProps} from '../project-pages/ProjectOperationsPage';
export {COCKPIT_TABS} from '../../lib/cockpit-tabs';
export type {CockpitTab} from '../../lib/cockpit-tabs';
/** 旧入口の互換。ページ本体・取得・操作をここへ追加しない。 */
export function CockpitView(props:ProjectOperationsPageProps&{hideNavigation?:boolean;initialRuntime?:ProjectPageRuntime;canExecutiveMeeting?:boolean}){
 return <ProjectSurfaceView projectId={props.cockpit.project.projectId} projectName={props.cockpit.project.projectName} projectCategory={props.cockpit.project.projectCategory} surface="cockpit" initialPage={props.activeTab} initialModalYm={props.initialModalYm} initialRuntime={props.initialRuntime} canExecutiveMeeting={props.canExecutiveMeeting} embedded={props.hideNavigation} onPageChange={props.onTabChange as never}/>;
}
