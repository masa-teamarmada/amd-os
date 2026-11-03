import 'server-only';
import {createDdReferenceCache} from './dd-reference-cache';
import type {DdLiveProjectPage} from './dd-project-page-types';
const pageCache=createDdReferenceCache<DdLiveProjectPage>();
const uncachedPages=new Set(["poc-list","technology","technical-evidence","contracts","governance","partners","activity","short-term-plan","long-term-plan"]);
import {DD_PAGE_KEYS} from '@/lib/dd-pages';
import {loadProjectPageRecord} from './project-page-record-server';
import {redactProjectPartnerNames} from '@/lib/project-partner-disclosure';
import {loadProjectPartnerDisclosure} from '@/lib/project-partner-disclosure-server';
import {createAdminClient} from '@/lib/supabase/admin';
/** 旧保存版・配布物の取得互換口。呼出元が入場を確認済み。元のDD開示範囲で共通取得へ委譲する。 */
export async function loadDdProjectPage(projectId:string,page:string,fresh=false){
 if(!DD_PAGE_KEYS.includes(page)||page==='documents')throw new Error('Unsupported DD page');
 const content=await pageCache.load(JSON.stringify([projectId, page]),()=>loadProjectPageRecord(projectId,page,{external:true,canEditRecords:false,disclosures:{workspace:false,dd:true}}),fresh||uncachedPages.has(page));
 const hidden=await loadProjectPartnerDisclosure(createAdminClient(), projectId);
 return redactProjectPartnerNames(content, hidden);
}
