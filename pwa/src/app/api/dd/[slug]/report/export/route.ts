import {NextResponse} from 'next/server';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {hasDdCapability} from '@/lib/dd-package-core';
import {recordDdAccessEvent} from '@/lib/dd-package-server';
import {createAdminClient} from '@/lib/supabase/admin';
import {DD_REPORT_BUCKET,loadDdReportChapterIndex,loadDdReportEdition} from '@/lib/dd-report-server';
import {ddReportOutputState,queueDdReportPdf} from '@/lib/dd-report-output-state';
import {createDdReportOutput} from '@/lib/dd-report-output-server';

export const dynamic='force-dynamic';
export const maxDuration=300;
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params,access=await resolveDdPackageAccess(slug);
  if(!access||!hasDdCapability(access,'dd.download'))return NextResponse.json({error:'Not found'},{status:404,headers});
  const edition=await loadDdReportEdition(access);if(!edition)return NextResponse.json({error:'Not found'},{status:404,headers});
  const query=new URL(request.url).searchParams,format=query.get('format');
  if(format!=='pdf'&&format!=='xlsx'||query.has('prepareBatch'))return NextResponse.json({error:'出力形式が未対応。'},{status:400,headers});
  if(query.has('revision')&&query.get('revision')!==String(edition.revision))return NextResponse.json({error:'資料が更新済み。画面を更新してダウンロードする。'},{status:409,headers});
  const all=query.get('scope')==='all'||format==='xlsx',state=await ddReportOutputState(edition,access.projectId,format);
  if(query.get('status')==='1'){
    if(format!=='pdf'||!all)return NextResponse.json({error:'出力範囲が未対応。'},{status:400,headers});
    if(!state.ready)queueDdReportPdf(edition,access.projectId,slug);
    return NextResponse.json({ready:state.ready,revision:edition.revision},{headers});
  }
  // A download never starts or drives the full-package renderer.
  if(format==='pdf'&&all&&!state.ready)return NextResponse.json({error:'最新版のPDFを更新中。完了するとダウンロードできる。'},{status:409,headers});
  const index=await loadDdReportChapterIndex(edition.id),selected=all?index:index.filter(c=>c.slug===(query.get('chapter')??'business-plan'));
  if(!selected.length)return NextResponse.json({error:'Not found'},{status:404,headers});
  const focusSheet=format==='xlsx'?query.get('sheet'):null,focus=focusSheet?index.find(c=>c.source_sheet===focusSheet):null;
  if(focusSheet&&!focus)return NextResponse.json({error:'Not found'},{status:404,headers});
  const key=focus?`${state.prefix}-sheet-${focus.slug}.xlsx`:all?state.key:`${state.prefix}-${selected[0].slug}.${format}`,bucket=createAdminClient().storage.from(DD_REPORT_BUCKET);
  if((format!=='pdf'||!all)&&(await bucket.info(key)).error){
    const bytes=await createDdReportOutput({edition,index,selected,slug,hidden:state.hidden,format,all,focusSheet:focus?.source_sheet});
    const current=await loadDdReportEdition(access);if(current?.revision!==edition.revision)return NextResponse.json({error:'資料が更新済み。画面を更新してダウンロードする。'},{status:409,headers});
    const saved=await bucket.upload(key,bytes,{contentType:format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',upsert:false});if(saved.error&&!/already exists|Duplicate/i.test(saved.error.message))throw new Error('出力ファイルを保存できなかった');
  }
  await recordDdAccessEvent(access,'dd_file_downloaded',{pageKey:all?'report-all':selected[0].slug,contentHash:`${edition.source_sha256}:r${edition.revision}`});
  const name=`${edition.title.split('｜')[0].replace(/[\\/\x00-\x1f]/g,'_')}_DD_${format==='pdf'?'本文・図解':'全資料'}_r${edition.revision}.${format}`;
  const signed=await bucket.createSignedUrl(key,60,{download:name});if(signed.error)throw new Error('出力ファイルを開けなかった');
  return NextResponse.redirect(signed.data.signedUrl,{status:303,headers});
}
