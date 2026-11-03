'use client';
import {ProjectSurfaceView} from '../project-pages/ProjectSurfaceView';
import type {ProjectSurface} from '@/lib/project-surface-permissions';
import type {ProjectCanonicalPageData} from '@/lib/project-canonical-page-types';
type Props={projectId:string;page:string;surface:ProjectSurface;slug?:string;initialData?:ProjectCanonicalPageData;initialChapter?:string;pdfReady?:boolean};
/** 旧入口の互換。ページ本体も子要素の差し込み口も持たない。 */
export function ProjectCanonicalPage({projectId,page,surface,slug,initialData,initialChapter}:Props){
 return <ProjectSurfaceView projectId={projectId} projectName={initialData?.projectName??projectId} surface={surface} slug={slug} initialPage={page} initialChapter={initialChapter}/>;
}
