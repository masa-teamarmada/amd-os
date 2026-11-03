import {COCKPIT_TAB_FORMATS,WORKSPACE_TAB_FORMATS,type ProjectFormatType} from './project-formats.ts';
import type {DdReportChapterSummary} from './dd-report-types.ts';
import type {ProjectSurface} from '@/lib/project-surface-permissions';
import {projectPageId,projectPageForChapter,projectPageDefinition,type ProjectPageId} from './project-page-registry.ts';
export type ProjectPageMenuGroup={key:string;label:string;children:{key:ProjectPageId;label:string}[]};
const labels:Record<string,string>={'progress-group':'進捗管理','business-plan-group':'事業計画','company-information-group':'会社情報','project-management-group':'PJ管理','documents-group':'ドライブ','seeds-group':'シーズ','regulations-group':'規程・内規','technology-group':'技術と実証'};
export function projectSurfacePageGroups(surface:ProjectSurface,type:ProjectFormatType,index:readonly DdReportChapterSummary[],executive:boolean,external=false):ProjectPageMenuGroup[]{
 const result:ProjectPageMenuGroup[]=[],seen=new Set<ProjectPageId>();
 const add=(groupKey:string,id:ProjectPageId,label?:string)=>{
  if(seen.has(id)||id==='executive-meeting'&&surface==='workspace'&&external&&!executive)return;seen.add(id);
  let group=result.find(g=>g.key===groupKey);if(!group){group={key:groupKey,label:labels[groupKey]??groupKey,children:[]};result.push(group);}
  const definition=projectPageDefinition(id)!,chapter=index.find(c=>definition.chapters.includes(c.slug));
  group.children.push({key:id,label:label??(id.startsWith('report:')?chapter?.title:undefined)??definition.label});
 };
 if(surface!=='dd')for(const group of (surface==='cockpit'?COCKPIT_TAB_FORMATS[type]:WORKSPACE_TAB_FORMATS[type]))
  for(const raw of group.tabs){const id=projectPageId(raw);if(id)add(group.group,id);}
 if(surface==='dd')add('business-plan-group','strategic-resources');
 if(surface==='cockpit'||surface==='dd')for(const chapter of index){
  const id=projectPageForChapter(chapter.slug),group=/技術|実証/.test(chapter.group_label)?'technology-group':/会社|体制/.test(chapter.group_label)?'company-information-group':'business-plan-group';add(group,id,id.startsWith('report:')?chapter.title:undefined);
 }
 return result.filter(g=>g.children.length);
}
export function projectSurfaceShowsPage(pageId:ProjectPageId,groups:readonly ProjectPageMenuGroup[]){return groups.some(g=>g.children.some(c=>c.key===pageId));}
