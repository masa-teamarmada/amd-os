import {NextResponse} from 'next/server';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {hasDdCapability} from '@/lib/dd-package-core';
import {recordDdAccessEvent} from '@/lib/dd-package-server';
import {createAdminClient} from '@/lib/supabase/admin';
import {DD_REPORT_BUCKET,loadDdReportChapterIndex,loadDdReportEdition} from '@/lib/dd-report-server';
import {ddReportOutputState,queueDdReportPdf} from '@/lib/dd-report-output-state';
import {createDdReportOutput} from '@/lib/dd-report-output-server';
import {zipSync} from 'fflate';
import {createHash} from 'node:crypto';

export const dynamic='force-dynamic';
export const maxDuration=300;
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params,access=await resolveDdPackageAccess(slug);
  if(!access||!hasDdCapability(access,'dd.download'))return NextResponse.json({error:'Not found'},{status:404,headers});
  const edition=await loadDdReportEdition(access);if(!edition)return NextResponse.json({error:'Not found'},{status:404,headers});
  const query=new URL(request.url).searchParams,format=query.get('format');
  if(format!=='pdf'&&format!=='xlsx'&&format!=='zip'||query.has('prepareBatch'))return NextResponse.json({error:'出力形式が未対応。'},{status:400,headers});
  if(query.has('revision')&&query.get('revision')!==String(edition.revision))return NextResponse.json({error:'資料が更新済み。画面を更新してダウンロードする。'},{status:409,headers});
  const outputFormat=format==='zip'?'xlsx':format;
  const all=query.get('scope')==='all'||format==='xlsx'||format==='zip',state=await ddReportOutputState(edition,access.projectId,outputFormat);
  const bundlePdf=format==='zip'?await ddReportOutputState(edition,access.projectId,'pdf'):null;
  if(query.get('status')==='1'){
    if(format!=='pdf'||!all)return NextResponse.json({error:'出力範囲が未対応。'},{status:400,headers});
    if(!state.ready)queueDdReportPdf(edition,access.projectId,slug);
    return NextResponse.json({ready:state.ready,revision:edition.revision},{headers});
  }
  // A download never starts or drives the full-package renderer.
  if((format==='pdf'&&all&&!state.ready)||(bundlePdf&&!bundlePdf.ready))return NextResponse.json({error:'最新版のPDFを更新中。完了するとダウンロードできる。'},{status:409,headers});
  if(bundlePdf&&JSON.stringify(bundlePdf.hidden)!==JSON.stringify(state.hidden))return NextResponse.json({error:'開示条件が更新済み。画面を更新してダウンロードする。'},{status:409,headers});
  const index=await loadDdReportChapterIndex(edition.id),selected=all?index:index.filter(c=>c.slug===(query.get('chapter')??'business-plan'));
  if(!selected.length)return NextResponse.json({error:'Not found'},{status:404,headers});
  const focusSheet=format==='xlsx'?query.get('sheet'):null,focus=focusSheet?index.find(c=>c.source_sheet===focusSheet):null;
  if(focusSheet&&!focus)return NextResponse.json({error:'Not found'},{status:404,headers});
  const key=focus?`${state.prefix}-sheet-${focus.slug}.xlsx`:all?state.key:`${state.prefix}-${selected[0].slug}.${format}`,bucket=createAdminClient().storage.from(DD_REPORT_BUCKET);
  if((format!=='pdf'||!all)&&(await bucket.info(key)).error){
    const bytes=await createDdReportOutput({edition,index,selected,slug,hidden:state.hidden,format:outputFormat,all,focusSheet:focus?.source_sheet});
    const current=await loadDdReportEdition(access);if(current?.revision!==edition.revision)return NextResponse.json({error:'資料が更新済み。画面を更新してダウンロードする。'},{status:409,headers});
    const saved=await bucket.upload(key,bytes,{contentType:outputFormat==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',upsert:false});if(saved.error&&!/already exists|Duplicate/i.test(saved.error.message))throw new Error('出力ファイルを保存できなかった');
  }
  const company=edition.title.split('｜')[0].replace(/[\\/\x00-\x1f]/g,'_');
  if(bundlePdf){
    const files=await Promise.all([bucket.download(bundlePdf.key),bucket.download(key)]);
    if(files.some(file=>file.error||!file.data))throw new Error('一括ダウンロードの資料を読み込めなかった');
    const bytes=await Promise.all(files.map(async file=>new Uint8Array(await file.data!.arrayBuffer())));
    const current=await loadDdReportEdition(access),fresh=await ddReportOutputState(edition,access.projectId,'pdf');
    if(current?.id!==edition.id||current?.revision!==edition.revision||current?.source_sha256!==edition.source_sha256||fresh.key!==bundlePdf.key||!fresh.ready)return NextResponse.json({error:'資料または開示条件が更新済み。画面を更新してダウンロードする。'},{status:409,headers});
    const archive=zipSync({[`${company}_DD_本文・図解_r${edition.revision}.pdf`]:bytes[0],[`${company}_DD_全資料_r${edition.revision}.xlsx`]:bytes[1]},{level:0});
    const bundleKey=`${bundlePdf.prefix}-pdf-excel-${createHash('sha256').update(key).digest('hex').slice(0,12)}.zip`;
    const saved=await bucket.upload(bundleKey,archive,{contentType:'application/zip',upsert:false});if(saved.error&&!/already exists|Duplicate/i.test(saved.error.message))throw new Error('一括ダウンロードの資料を保存できなかった');
    await recordDdAccessEvent(access,'dd_file_downloaded',{pageKey:'report-all',contentHash:`${edition.source_sha256}:r${edition.revision}`});
    const name=`${company}_DD_PDF+Excel_r${edition.revision}.zip`;
    const signed=await bucket.createSignedUrl(bundleKey,60,{download:name});if(signed.error)throw new Error('一括ダウンロードの資料を開けなかった');
    return NextResponse.redirect(signed.data.signedUrl,{status:303,headers});
  }
  await recordDdAccessEvent(access,'dd_file_downloaded',{pageKey:all?'report-all':selected[0].slug,contentHash:`${edition.source_sha256}:r${edition.revision}`});
  const name=`${company}_DD_${format==='pdf'?'本文・図解':'全資料'}_r${edition.revision}.${format}`;
  const signed=await bucket.createSignedUrl(key,60,{download:name});if(signed.error)throw new Error('出力ファイルを開けなかった');
  return NextResponse.redirect(signed.data.signedUrl,{status:303,headers});
}
