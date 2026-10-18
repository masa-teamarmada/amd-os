import {NextResponse} from 'next/server';
import {deduplicateDdPdfStreams} from '@/lib/dd-report-pdf';
import {createHash} from 'node:crypto';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {hasDdCapability} from '@/lib/dd-package-core';
import {recordDdAccessEvent} from '@/lib/dd-package-server';
import {createAdminClient} from '@/lib/supabase/admin';
import {DD_REPORT_BUCKET,ddReportAsset,loadDdReportChapter,loadDdReportChapterIndex,loadDdReportEdition,loadDdReportModel,updateDdReportBody} from '@/lib/dd-report-server';
import {DdReportCalculator} from '@/lib/dd-report-model';
import {ddReportPdf,ddReportXlsx,orderedDdChapters} from '@/lib/dd-report-export';
import {renderWorkspaceDocumentHtmlToPdf} from '@/lib/workspace-document-html-pdf';
import {loadProjectPartnerDisclosure} from '@/lib/project-partner-disclosure-server';
import {redactProjectPartnerNames} from '@/lib/project-partner-disclosure';

export const dynamic='force-dynamic';
export const maxDuration=300;
const PDF_BATCH=4;
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params,access=await resolveDdPackageAccess(slug);
  if(!access||!hasDdCapability(access,'dd.download'))return NextResponse.json({error:'Not found'},{status:404});
  const edition=await loadDdReportEdition(access);if(!edition)return NextResponse.json({error:'Not found'},{status:404});
  const query=new URL(request.url).searchParams,format=query.get('format'),index=await loadDdReportChapterIndex(edition.id);
  if(format!=='pdf'&&format!=='xlsx')return NextResponse.json({error:'出力形式が未対応。'},{status:400});
  if(query.has('revision')&&query.get('revision')!==String(edition.revision))return NextResponse.json({error:'資料が更新済み。画面を更新して再度出力する。'},{status:409});
  const all=query.get('scope')==='all'||format==='xlsx',batches=Math.ceil(index.length/PDF_BATCH),preparing=query.has('prepareBatch'),batch=Number(query.get('prepareBatch'));
  if(preparing&&(format!=='pdf'||!all||!Number.isInteger(batch)||batch<0||batch>=batches))return NextResponse.json({error:'出力範囲が未対応。'},{status:400});
  const selected=preparing?orderedDdChapters(index).slice(batch*PDF_BATCH,(batch+1)*PDF_BATCH):all?index:index.filter(c=>c.slug===(query.get('chapter')??'business-plan'));
  if(!selected.length)return NextResponse.json({error:'Not found'},{status:404});
  const db=createAdminClient(),hidden=await loadProjectPartnerDisclosure(db,access.projectId);
  const disclosureHash=createHash('sha256').update(JSON.stringify(hidden)).digest('hex').slice(0,16);
  const prefix=`${edition.package_id}/${edition.source_sha256}/exports/layout-v3-r${edition.revision}-${disclosureHash}`;
  const key=`${prefix}-${preparing?'part-'+batch:all?'all':selected[0].slug}.${format}`;
  const outputName=`${edition.title.split('｜')[0].replace(/[\\/\x00-\x1f]/g,'_')}_DD_r${edition.revision}.${format}`;
  const bucket=db.storage.from(DD_REPORT_BUCKET),exists=await bucket.info(key);
  if(exists.error){
    let bytes:Uint8Array;
    if(format==='pdf'&&all&&!preparing){
      const keys=Array.from({length:batches},(_,i)=>`${prefix}-part-${i}.pdf`),ready=await Promise.all(keys.map(k=>bucket.info(k)));
      if(ready.some(r=>r.error))return NextResponse.json({needsPreparation:true,batches,revision:edition.revision},{status:202,headers:{'Cache-Control':'private, no-store'}});
      const {PDFDocument}=await import('pdf-lib'),output=await PDFDocument.create();
      for(const path of keys){const part=await bucket.download(path);if(part.error)throw new Error('PDFを読み込めなかった');const pdf=await PDFDocument.load(await part.data.arrayBuffer());for(const p of await output.copyPages(pdf,pdf.getPageIndices()))output.addPage(p);}
      output.setTitle(edition.title);output.setSubject(`DD revision ${edition.revision}; source ${edition.source_version}`);deduplicateDdPdfStreams(output);bytes=await output.save();
    }else{
      const model=await loadDdReportModel(edition),calc=new DdReportCalculator(model,edition.input_overrides);
      const loaded=await Promise.all(selected.map(c=>loadDdReportChapter(edition.id,c.slug)));
      if(loaded.some(c=>!c))throw new Error('資料本文が不足している');
      const chapters=redactProjectPartnerNames(loaded.map(c=>({...c!,body:updateDdReportBody(c!.body,c!.source_sheet,calc)})),hidden);
      if(format==='xlsx'){
        const source=await bucket.download(edition.xlsx_storage_path);if(source.error)throw new Error('Excelを読み込めなかった');
        const sourceBytes=new Uint8Array(await source.data.arrayBuffer());if(createHash('sha256').update(sourceBytes).digest('hex')!==edition.source_sha256)throw new Error('Excel原本の版が一致しない');
        bytes=ddReportXlsx(sourceBytes,edition,model,chapters,text=>redactProjectPartnerNames(text,hidden));
      }else{
        const keys=[...new Set(chapters.flatMap(c=>c.body.objects.flatMap(o=>o.kind==='image'?[o.assetKey]:[])))],assetUrls:Record<string,string>={};
        await Promise.all(keys.map(async assetKey=>{const a=await ddReportAsset(edition.id,assetKey);if(!a)throw new Error('図版が不足している');assetUrls[assetKey]=`data:${a.meta.mime_type};base64,${a.bytes.toString('base64')}`;}));
        bytes=await ddReportPdf({edition,chapters,index,slug,assetUrls,includeCover:!preparing||batch===0,includeGlossary:!preparing||batch===batches-1,glossaryAll:all},html=>renderWorkspaceDocumentHtmlToPdf(html,{tagged:false,pageWidthPx:794,compactPagination:true}));
      }
    }
    const current=await loadDdReportEdition(access);if(current?.revision!==edition.revision)return NextResponse.json({error:'資料が更新済み。画面を更新して再度出力する。'},{status:409});
    const upload=await bucket.upload(key,bytes,{contentType:format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',upsert:false});if(upload.error&&!/already exists|Duplicate/i.test(upload.error.message))throw new Error('出力ファイルを保存できなかった');
  }
  if(preparing)return NextResponse.json({ready:true,batch,batches,revision:edition.revision},{headers:{'Cache-Control':'private, no-store'}});
  await recordDdAccessEvent(access,'dd_file_downloaded',{pageKey:all?'report-all':selected[0].slug,contentHash:`${edition.source_sha256}:r${edition.revision}`});
  const signed=await bucket.createSignedUrl(key,60,{download:outputName});if(signed.error)throw new Error('出力ファイルを開けなかった');
  return NextResponse.redirect(signed.data.signedUrl,{status:303,headers:{'Cache-Control':'private, no-store'}});
}
