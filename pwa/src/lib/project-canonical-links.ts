import {canonicalPageForChapter} from './project-canonical-pages.ts';
import type {ProjectSurface} from './project-surface-permissions.ts';
export type CanonicalReportNavigation={projectId:string;surface:ProjectSurface;chapters?:readonly string[]};
const hashes:Record<string,string>={gantt:'project-gantt',partners:'partner-ledger',technology:'technology','poc-list':'poc-list',competition:'competition','business-model':'business-model','business-plan':'business-plan','development-issues':'development-issues','financial-projection':'financial-projection','capital-plan':'capital-plan','cost-model':'cost-model',ip:'project-ip',company:'company-overview','organization-chart':'organization-chart',contracts:'contracts'};
/** 同じスペースにある参照先は、そのスペースの既存ページで開く。 */
export function canonicalChapterHref(slug:string,chapter:string,navigation?:CanonicalReportNavigation,address?:string){
  const fallback=`/dd/${encodeURIComponent(slug)}?chapter=${encodeURIComponent(chapter)}${address?'#cell-'+encodeURIComponent(address):''}`;
  if(!navigation||navigation.surface==='dd')return fallback;
  const page=canonicalPageForChapter(chapter);if(!page||(navigation.chapters&&!navigation.chapters.includes(chapter))||page.startsWith('report:')&&!navigation.chapters?.includes(chapter))return fallback;
  const base=`/project/${encodeURIComponent(navigation.projectId)}`;
  const query=new URLSearchParams({chapter});
  if(navigation.surface==='cockpit'){query.set('tab',page);return `${base}/cockpit?${query}${address?'#cell-'+encodeURIComponent(address):''}`;}
  const hash=hashes[page]??(page.startsWith('report:')?page:null);return hash?`${base}/workspace?${query}#${hash}`:fallback;
}
export function canonicalReportHref(href:string|null,slug:string,navigation?:CanonicalReportNavigation){
  if(!href||!href.startsWith(`/dd/${encodeURIComponent(slug)}?chapter=`))return href;
  const url=new URL(href,'https://local.invalid'),chapter=url.searchParams.get('chapter');
  return chapter?canonicalChapterHref(slug,chapter,navigation,/^#cell-/.test(url.hash)?url.hash.slice(6):undefined):href;
}
