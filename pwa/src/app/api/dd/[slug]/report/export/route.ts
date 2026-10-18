import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {hasDdCapability} from '@/lib/dd-package-core';
import {recordDdAccessEvent} from '@/lib/dd-package-server';
import {createAdminClient} from '@/lib/supabase/admin';
import {DD_REPORT_BUCKET,ddReportAsset,loadDdReportChapter,loadDdReportChapterIndex,loadDdReportEdition,loadDdReportModel,redactDdReport,updateDdReportBody} from '@/lib/dd-report-server';
import {DdReportCalculator} from '@/lib/dd-report-model';
import {ddReportHtml,ddReportXlsx} from '@/lib/dd-report-export';
import {renderWorkspaceDocumentHtmlToPdf} from '@/lib/workspace-document-html-pdf';
import {loadProjectPartnerDisclosure} from '@/lib/project-partner-disclosure-server';
import {redactProjectPartnerNames} from '@/lib/project-partner-disclosure';

export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params,access=await resolveDdPackageAccess(slug);
  if(!access||!hasDdCapability(access,'dd.download'))return NextResponse.json({error:'Not found'},{status:404});
  const edition=await loadDdReportEdition(access);if(!edition)return NextResponse.json({error:'Not found'},{status:404});
  const query=new URL(request.url).searchParams,format=query.get('format'),index=await loadDdReportChapterIndex(edition.id);
  if(format!=='pdf'&&format!=='xlsx')return NextResponse.json({error:'出力形式が未対応。'},{status:400});
  const selected=query.get('scope')==='all'||format==='xlsx'?index:index.filter(c=>c.slug===(query.get('chapter')??'business-plan'));
  if(!selected.length)return NextResponse.json({error:'Not found'},{status:404});
  const db=createAdminClient(),hidden=await loadProjectPartnerDisclosure(db,access.projectId);
  const disclosureHash=createHash('sha256').update(JSON.stringify(hidden)).digest('hex').slice(0,16);
  const key=`${edition.package_id}/${edition.source_sha256}/exports/layout-v1-r${edition.revision}-${disclosureHash}-${selected.length===index.length?'all':selected[0].slug}.${format}`;
  const outputName=`${edition.title.split('｜')[0].replace(/[\\/\x00-\x1f]/g,'_')}_DD_r${edition.revision}.${format}`;
  const bucket=db.storage.from(DD_REPORT_BUCKET),exists=await bucket.info(key);
  if(exists.error){
    const model=await loadDdReportModel(edition),calc=new DdReportCalculator(model,edition.input_overrides);
    const loaded=await Promise.all(selected.map(c=>loadDdReportChapter(edition.id,c.slug)));
    if(loaded.some(c=>!c))throw new Error('資料本文が不足している');
    const chapters=await redactDdReport(access.projectId,loaded.map(c=>({...c!,body:updateDdReportBody(c!.body,c!.source_sheet,calc)})));
    let bytes:Uint8Array;
    if(format==='xlsx'){
      const source=await bucket.download(edition.xlsx_storage_path);if(source.error)throw new Error('Excelを読み込めなかった');
      const sourceBytes=new Uint8Array(await source.data.arrayBuffer());if(createHash('sha256').update(sourceBytes).digest('hex')!==edition.source_sha256)throw new Error('Excel原本の版が一致しない');
      bytes=ddReportXlsx(sourceBytes,edition,model,chapters,text=>redactProjectPartnerNames(text,hidden));
    }else{
      const keys=[...new Set(chapters.flatMap(c=>c.body.objects.flatMap(o=>o.kind==='image'?[o.assetKey]:[])))],assetUrls:Record<string,string>={};
      await Promise.all(keys.map(async assetKey=>{const a=await ddReportAsset(edition.id,assetKey);if(!a)throw new Error('図版が不足している');assetUrls[assetKey]=`data:${a.meta.mime_type};base64,${a.bytes.toString('base64')}`;}));
      bytes=await renderWorkspaceDocumentHtmlToPdf(await ddReportHtml({edition,chapters,index,slug,assetUrls}),{tagged:false,pageWidthPx:794,compactPagination:true});
    }
    const current=await loadDdReportEdition(access);if(current?.revision!==edition.revision)return NextResponse.json({error:'資料が更新済み。再度出力する。'},{status:409});
    const upload=await bucket.upload(key,bytes,{contentType:format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',upsert:false});if(upload.error&&!/already exists|Duplicate/i.test(upload.error.message))throw new Error('出力ファイルを保存できなかった');
  }
  await recordDdAccessEvent(access,'dd_file_downloaded',{pageKey:selected.length===index.length?'report-all':selected[0].slug,contentHash:`${edition.source_sha256}:r${edition.revision}`});
  const signed=await bucket.createSignedUrl(key,60,{download:outputName});if(signed.error)throw new Error('出力ファイルを開けなかった');
  return NextResponse.redirect(signed.data.signedUrl,{status:303,headers:{'Cache-Control':'private, no-store'}});
}
