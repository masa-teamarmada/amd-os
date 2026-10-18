import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {createAdminClient} from './supabase/admin';
import {ddReportOutputState} from './dd-report-output-state';
import {DD_REPORT_BUCKET,ddReportAsset,loadDdReportChapter,loadDdReportChapterIndex,loadDdReportModel,updateDdReportBody} from './dd-report-server';
import {DdReportCalculator} from './dd-report-model';
import {ddReportPdf,ddReportXlsx,orderedDdChapters} from './dd-report-export';
import {deduplicateDdPdfStreams,finalizeDdPdfNavigation} from './dd-report-pdf';
import type {DdPdfIndex} from './dd-report-navigation';
import {renderWorkspaceDocumentHtmlToPdf} from './workspace-document-html-pdf';
import {redactProjectPartnerNames} from './project-partner-disclosure';
import type {DdReportChapterSummary,DdReportEdition} from './dd-report-types';

export const DD_PDF_BATCH=4;
type OutputArgs={edition:DdReportEdition;index:DdReportChapterSummary[];selected:DdReportChapterSummary[];slug:string;hidden:Awaited<ReturnType<typeof ddReportOutputState>>['hidden'];format:'pdf'|'xlsx';includeCover?:boolean;includeGlossary?:boolean;all?:boolean;focusSheet?:string;pdfIndex?:DdPdfIndex};
export async function createDdReportOutput({edition,index,selected,slug,hidden,format,includeCover=true,includeGlossary=true,all=false,focusSheet,pdfIndex}:OutputArgs) {
  const model=await loadDdReportModel(edition),calc=new DdReportCalculator(model,edition.input_overrides);
  const loaded=await Promise.all(selected.map(c=>loadDdReportChapter(edition.id,c.slug)));
  if(loaded.some(c=>!c))throw new Error('資料本文が不足している');
  const chapters=redactProjectPartnerNames(loaded.map(c=>({...c!,body:updateDdReportBody(c!.body,c!.source_sheet,calc)})),hidden);
  if(format==='xlsx'){
    const source=await createAdminClient().storage.from(DD_REPORT_BUCKET).download(edition.xlsx_storage_path);if(source.error)throw new Error('Excelを読み込めなかった');
    const bytes=new Uint8Array(await source.data.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==edition.source_sha256)throw new Error('Excel原本の版が一致しない');
    return ddReportXlsx(bytes,edition,model,chapters,text=>redactProjectPartnerNames(text,hidden),focusSheet,`https://amd-os-pwa.vercel.app/dd/${encodeURIComponent(slug)}`,pdfIndex);
  }
  const keys=[...new Set(chapters.flatMap(c=>c.body.objects.flatMap(o=>o.kind==='image'?[o.assetKey]:[])))],assetUrls:Record<string,string>={};
  await Promise.all(keys.map(async assetKey=>{const a=await ddReportAsset(edition.id,assetKey);if(!a)throw new Error('図版が不足している');assetUrls[assetKey]=`data:${a.meta.mime_type};base64,${a.bytes.toString('base64')}`;}));
  return ddReportPdf({edition,chapters,index,slug,assetUrls,includeCover,includeGlossary,glossaryAll:all,deferNavigation:all&&selected.length<index.length},html=>renderWorkspaceDocumentHtmlToPdf(html,{tagged:false,pageWidthPx:794,compactPagination:true}));
}

const running=new Map<string,Promise<void>>();
export async function prepareDdReportPdf(edition:DdReportEdition,projectId:string,slug:string) {
  const freshEdition=await createAdminClient().from('dd_report_editions').select('*').eq('id',edition.id).single();
  if(freshEdition.error||freshEdition.data.revision!==edition.revision||freshEdition.data.status==='archived')return;
  edition=freshEdition.data as DdReportEdition;
  const state=await ddReportOutputState(edition,projectId);if(state.ready)return;
  const prior=running.get(state.key);if(prior)return prior;
  const work=(async()=>{
    const db=createAdminClient(),bucket=db.storage.from(DD_REPORT_BUCKET),lease=`${state.prefix}-building.json`,token=randomUUID();
    const claim=()=>bucket.upload(lease,JSON.stringify({startedAt:Date.now(),token}),{contentType:'application/json',upsert:false});
    let claimed=await claim();
    if(claimed.error){
      const old=await bucket.download(lease);if(old.error)throw claimed.error;
      const lock=await old.data.text().then(JSON.parse);if(Date.now()-Number(lock.startedAt)<360000)return;
      await bucket.remove([lease]);claimed=await claim();if(claimed.error)return;
    }
    try {
      const index=await loadDdReportChapterIndex(edition.id),ordered=orderedDdChapters(index),batches=Math.ceil(ordered.length/DD_PDF_BATCH),paths:string[]=[];
      for(let batch=0;batch<batches;batch++){
        const key=`${state.prefix}-part-${batch}.pdf`;paths.push(key);if(!(await bucket.info(key)).error)continue;
        const current=await db.from('dd_report_editions').select('revision,status').eq('id',edition.id).single();
        if(current.error||current.data.revision!==edition.revision||current.data.status==='archived')return;
        const bytes=await createDdReportOutput({edition,index,selected:ordered.slice(batch*DD_PDF_BATCH,(batch+1)*DD_PDF_BATCH),slug,hidden:state.hidden,format:'pdf',includeCover:batch===0,includeGlossary:batch===batches-1,all:true});
        const saved=await bucket.upload(key,bytes,{contentType:'application/pdf',upsert:false});if(saved.error&&!/already exists|Duplicate/i.test(saved.error.message))throw saved.error;
      }
      const output=await PDFDocument.create();
      for(const path of paths){const part=await bucket.download(path);if(part.error)throw part.error;const pdf=await PDFDocument.load(await part.data.arrayBuffer());for(const page of await output.copyPages(pdf,pdf.getPageIndices()))output.addPage(page);}
      output.setTitle(edition.title);output.setSubject(`DD revision ${edition.revision}; source ${edition.source_version}; prose and figures`);await finalizeDdPdfNavigation(output,edition,ordered,slug);deduplicateDdPdfStreams(output);
      const current=await db.from('dd_report_editions').select('revision,status').eq('id',edition.id).single(),fresh=await ddReportOutputState(edition,projectId);
      if(current.error||current.data.revision!==edition.revision||current.data.status==='archived'||fresh.key!==state.key)return;
      const saved=await bucket.upload(state.key,await output.save(),{contentType:'application/pdf',upsert:false});if(saved.error&&!/already exists|Duplicate/i.test(saved.error.message))throw saved.error;
    } finally {await bucket.remove([lease]);}
  })();
  running.set(state.key,work);try{await work;}finally{running.delete(state.key);}
}
