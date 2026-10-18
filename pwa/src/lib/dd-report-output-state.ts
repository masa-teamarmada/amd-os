import 'server-only';
import {after} from 'next/server';
import {createHash} from 'node:crypto';
import {createAdminClient} from './supabase/admin';
import {loadProjectPartnerDisclosure} from './project-partner-disclosure-server';
import {DD_REPORT_BUCKET} from './dd-report-server';
import type {DdReportEdition} from './dd-report-types';

export async function ddReportOutputState(edition:DdReportEdition,projectId:string,format:'pdf'|'xlsx'='pdf') {
  const db=createAdminClient(),hidden=(await loadProjectPartnerDisclosure(db,projectId)).sort((a,b)=>a.id.localeCompare(b.id));
  const hash=createHash('sha256').update(JSON.stringify(hidden)).digest('hex').slice(0,16);
  const prefix=`${edition.package_id}/${edition.source_sha256}/exports/layout-v7-r${edition.revision}-${hash}`;
  const key=`${prefix}-all.${format}`,result=await db.storage.from(DD_REPORT_BUCKET).info(key);
  return {prefix,key,hidden,ready:!result.error};
}

/** Authoring starts preparation; readers only receive completed, revision-matched files. */
export function queueDdReportPdf(edition:DdReportEdition,projectId:string,slug:string) {
  after(async()=>{
    try {const {prepareDdReportPdf}=await import('./dd-report-output-server');await prepareDdReportPdf(edition,projectId,slug);}
    catch(error){console.error('DD PDF preparation failed',{editionId:edition.id,revision:edition.revision,error:error instanceof Error?error.message:'unknown'});}
  });
}
