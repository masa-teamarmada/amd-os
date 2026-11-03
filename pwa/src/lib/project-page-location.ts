import type {ProjectSurface} from '@/lib/project-surface-permissions';
import {projectPageForChapter} from './project-page-registry.ts';
export const PROJECT_PAGE_HASHES:Record<string,string>={issues:'issue-hypothesis',weekly:'weekly-change',gantt:'project-gantt',partners:'partner-ledger',company:'company-overview',ip:'project-ip',documents:'project-drive'};
export function projectPageLocation(current:string,surface:ProjectSurface,id:string,chapters:readonly {slug:string}[],defaultId:string){
 const url=new URL(current);if(id==='poc-list')url.searchParams.delete('tech');url.searchParams.delete('records');url.searchParams.delete('chapter');
 if(surface==='cockpit'){if(id===defaultId)url.searchParams.delete('tab');else url.searchParams.set('tab',id);}
 else if(surface==='workspace')url.hash=PROJECT_PAGE_HASHES[id]??id;
 else{const chapter=chapters.find(c=>projectPageForChapter(c.slug)===id);if(chapter)url.searchParams.set('chapter',chapter.slug);}
 return url.pathname+url.search+url.hash;
}

export function legacyPocListLocation(current:string){const url=new URL(current);url.searchParams.delete("tech");if(url.pathname.endsWith("/cockpit"))url.searchParams.set("tab","poc-list");else url.hash="poc-list";return url.toString();}
