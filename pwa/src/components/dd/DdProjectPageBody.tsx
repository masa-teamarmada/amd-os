'use client';
import {ProjectRecordSnapshot} from '../project-pages/ProjectPageBody';
import type {DdLiveProjectPage} from '@/lib/dd-project-page-types';
import type {ResolutionDocument} from '@/components/project-workspace/ProjectDiligenceSection';
/** 過去の保存版も共通ページへ渡すだけにする。 */
export function DdProjectPageBody({data,canDownload=false,canEditPocList=false,resolutionDocuments=[]}:{data:DdLiveProjectPage;canDownload?:boolean;canEditPocList?:boolean;resolutionDocuments?:ResolutionDocument[]}){
 return <ProjectRecordSnapshot data={data} canDownload={canDownload} canEdit={canEditPocList} resolutionDocuments={resolutionDocuments}/>;
}
