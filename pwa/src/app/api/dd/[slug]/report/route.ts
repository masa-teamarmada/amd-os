import {NextResponse} from 'next/server';
import {queueDdReportPdf} from '@/lib/dd-report-output-state';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {isSameOriginWorkspaceMutation} from '@/lib/workspace-mutation-origin';
import {createAdminClient} from '@/lib/supabase/admin';
import {canEditDdReport,evaluatedDdReportChapter,loadDdReportChapter,loadDdReportChapterIndex,loadDdReportEdition,loadDdReportModel,storeDdReportBody,redactDdReport} from '@/lib/dd-report-server';
import {validateDdOverrides,verifyDdReportCalculation} from '@/lib/dd-report-model';
import {recordDdAccessEvent} from '@/lib/dd-package-server';
const denied=()=>NextResponse.json({error:'Not found'},{status:404,headers:{'Cache-Control':'no-store'}});
const headers={'Cache-Control':'private, no-store'};
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params,access=await resolveDdPackageAccess(slug);if(!access)return denied();
  const edition=await loadDdReportEdition(access);if(!edition)return denied();
  const chapterSlug=new URL(request.url).searchParams.get('chapter');
  if(chapterSlug){const chapter=await loadDdReportChapter(edition.id,chapterSlug);if(!chapter)return denied();await recordDdAccessEvent(access,'dd_package_viewed',{pageKey:chapterSlug,contentHash:`${edition.source_sha256}:r${edition.revision}`});return NextResponse.json({chapter:await redactDdReport(access.projectId,await evaluatedDdReportChapter(edition,chapter)),revision:edition.revision},{headers});}
  const chapters=await loadDdReportChapterIndex(edition.id);
  const model=canEditDdReport(access)?await loadDdReportModel(edition):null;
  return NextResponse.json({edition:{id:edition.id,title:edition.title,sourceVersion:edition.source_version,revision:edition.revision,status:edition.status,summary:edition.summary},chapters,inputs:model?.inputs??[],overrides:canEditDdReport(access)?edition.input_overrides:{},canEdit:canEditDdReport(access)},{headers});
}
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params,access=await resolveDdPackageAccess(slug);if(!access||!canEditDdReport(access))return denied();
  if(!isSameOriginWorkspaceMutation(request))return NextResponse.json({error:'same_origin_required'},{status:403});
  if(Number(request.headers.get('content-length')||0)>200000)return NextResponse.json({error:'request_too_large'},{status:413});
  const edition=await loadDdReportEdition(access);if(!edition)return denied();
  const body=await request.json().catch(()=>null);if(!body||body.revision!==edition.revision)return NextResponse.json({error:'別の更新を検出。画面を再読込してから保存する。'},{status:409});
  const db=createAdminClient();
  async function commit(args:Record<string,unknown>){
    const r=await db.rpc('dd_report_commit_change',{p_edition_id:edition!.id,p_expected_revision:edition!.revision,p_actor:access!.principal==='workspace_account'?'':access!.memberId,...args});
    if(r.error){if(r.error.code==='40001')return NextResponse.json({error:'別の更新を検出。画面を再読込してから保存する。'},{status:409});throw r.error;}
    queueDdReportPdf({...edition!,revision:Number(r.data)},access!.projectId,slug);
    return NextResponse.json({ok:true,revision:r.data},{headers});
  }
  if(body.action==='inputs'){
    const model=await loadDdReportModel(edition);if(!validateDdOverrides(model,body.values))return NextResponse.json({error:'入力値を確認する。'},{status:400});
    try{verifyDdReportCalculation(model,body.values);}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'計算条件を確認する。'},{status:422});}
    return commit({p_kind:'inputs',p_before:edition.input_overrides,p_after:body.values});
  }
  if(body.action==='text'&&typeof body.chapter==='string'&&typeof body.address==='string'&&typeof body.value==='string'&&body.value.length<=100000){
    const chapter=await loadDdReportChapter(edition.id,body.chapter);if(!chapter||chapter.revision!==body.chapterRevision)return NextResponse.json({error:'資料が更新済み。再読込が必要。'},{status:409});
    const model=await loadDdReportModel(edition);
    const cell=chapter.body.rows.filter(r=>r.row>2).flatMap(r=>r.cells).find(c=>c.address===body.address);if(!cell||cell.formula||typeof cell.value!=='string'||cell.span<5||model.inputs.some(i=>i.sheet===chapter.source_sheet&&i.address===cell.address))return denied();
    const canonical=chapter.slug.endsWith('-development-plan')?await loadDdReportChapter(edition.id,'execution-plan'):chapter;if(!canonical||canonical.revision!==chapter.revision)return denied();
    const canonicalCell=canonical.body.rows.flatMap(r=>r.cells).find(c=>c.address===cell.address);if(!canonicalCell)return denied();
    const before=canonicalCell.value;canonicalCell.value=body.value;
    const storedBody=await storeDdReportBody(edition,canonical);
    return commit({p_kind:'chapter',p_before:{address:body.address,value:before},p_after:{address:body.address,value:body.value},p_chapter_id:canonical.id,p_chapter_revision:canonical.revision,p_body:storedBody});
  }
  return NextResponse.json({error:'操作が未指定。'},{status:400});
}
