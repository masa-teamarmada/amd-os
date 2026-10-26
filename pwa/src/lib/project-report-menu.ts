import type {DdReportChapterSummary} from './dd-report-types.ts';
import {canonicalPageKey,canonicalPageDefinition} from './project-canonical-pages.ts';
import {applyCanonicalCockpitMenu,type CockpitGroup,type CockpitGroupKey,type CockpitTab} from './cockpit-tabs.ts';

/** 登録された資料を共通ページの目録として扱い、本文を複製せず既存分類へ配置する。 */
export function completeCockpitReportGroups(groups:readonly CockpitGroup[],index:readonly DdReportChapterSummary[],projectId?:string):CockpitGroup[]{
  groups=applyCanonicalCockpitMenu(groups,projectId,index.map(c=>c.slug));
  const result=groups.map(g=>({...g,children:[...g.children]}));
  const primary=new Set<string>();
  for(const group of groups)for(const tab of group.children){const key=canonicalPageKey(tab);if(key){const chapter=canonicalPageDefinition(key,projectId).chapters[0];if(chapter)primary.add(chapter);}}
  for(const chapter of index){
    if(primary.has(chapter.slug))continue;
    const key=`report:${chapter.slug}` as CockpitTab;
    if(result.some(g=>g.children.includes(key)))continue;
    const technical=chapter.slug==='technical-development-plan'||/技術|実証/.test(chapter.group_label);
    const company=/会社|体制|組織/.test(chapter.group_label);
    const groupKey:CockpitGroupKey=technical?'technology-group':company?'company-information-group':'business-plan-group';
    let target=result.find(g=>g.key===groupKey);
    if(!target){target={key:groupKey,label:technical?'技術と実証':company?'会社情報':'事業計画',children:[]};result.push(target);}
    target.children.push(key);
  }
  return result;
}
