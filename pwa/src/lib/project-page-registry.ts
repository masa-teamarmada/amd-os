import {PROJECT_CANONICAL_PAGES,isProjectReportPageKey} from './project-canonical-pages.ts';
import {PROJECT_PAGE_LABELS} from './project-formats.ts';

/** ページはこの登録に一つだけ存在する。スペースは登録済みIDの集合を選ぶ。 */
export const PROJECT_OPERATION_PAGE_IDS = [
  'issues','tasks','weekly','progress','meetings','slack','score-detail','overview',
  'project-contracts','project-finance','monthly-reports','proper-nouns','card-designs',
  'employee-register','killer-factors','capital-policy','shareholder-meeting','board-meeting','executive-meeting','documents',
  'seeds','regulations',
] as const;
export type ProjectOperationPageId = typeof PROJECT_OPERATION_PAGE_IDS[number];
export type ProjectPageId = keyof typeof PROJECT_CANONICAL_PAGES | ProjectOperationPageId | `report:${string}`;
export type ProjectPageDefinition = {
  id:ProjectPageId; label:string; chapters:readonly string[]; operation:ProjectOperationPageId|string|null;
};
const operationSet = new Set<string>(PROJECT_OPERATION_PAGE_IDS);
const chapterPages = new Map<string,ProjectPageId>();
for(const [id,definition] of Object.entries(PROJECT_CANONICAL_PAGES))
  for(const chapter of definition.chapters)chapterPages.set(chapter,id as ProjectPageId);
const aliases:Readonly<Record<string,string>> = {
  cost:'cost-model','cost-fuel':'cost-model',drive:'documents','monthly-trial':'financial-projection',
  'objective-structure':'gantt','technical-explanation':'technology',
};
export function projectPageId(value:string):ProjectPageId|null {
  const alias=aliases[value]??value;
  const fromChapter=chapterPages.get(alias);
  if(fromChapter)return fromChapter;
  if(Object.hasOwn(PROJECT_CANONICAL_PAGES,alias)||operationSet.has(alias))return alias as ProjectPageId;
  if(isProjectReportPageKey(alias))return chapterPages.get(alias.slice(7))??alias;
  return null;
}
export function projectPageForChapter(chapter:string):ProjectPageId {
  return chapterPages.get(chapter)??`report:${chapter}`;
}
export function projectPageDefinition(value:string):ProjectPageDefinition|null {
  const id=projectPageId(value);if(!id)return null;
  if(Object.hasOwn(PROJECT_CANONICAL_PAGES,id)){
    const definition=PROJECT_CANONICAL_PAGES[id as keyof typeof PROJECT_CANONICAL_PAGES];
    return {id,label:PROJECT_PAGE_LABELS[id]??definition.label,chapters:definition.chapters,operation:definition.records};
  }
  if(id.startsWith('report:'))return {id,label:id.slice(7),chapters:[id.slice(7)],operation:null};
  return {id,label:PROJECT_PAGE_LABELS[id]??id,chapters:[],operation:id};
}
export const PROJECT_PAGE_OPERATION_KINDS = {
  read:'read', simulate:'simulate', saveInputs:'save-inputs', records:'records',
} as const;
