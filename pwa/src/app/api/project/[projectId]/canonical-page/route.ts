import {canonicalPageKey,canonicalReportChapterAllowed,canonicalPageDefinition} from '@/lib/project-canonical-pages';
import {canSaveCanonicalInputs,resolveCanonicalPageAccess,canonicalReportEdition,loadProjectCanonicalPage} from '@/lib/project-canonical-page-server';
import {loadDdReportChapterIndex,loadDdReportChapter,loadDdReportModel,evaluatedDdReportChapter,updateDdReportBody,redactDdReport,ddReportAsset} from '@/lib/dd-report-server';
import {createAdminClient} from '@/lib/supabase/admin';
import {DdReportCalculator,validateDdOverrides,verifyDdReportCalculation} from '@/lib/dd-report-model';
import {isSameOriginWorkspaceMutation} from '@/lib/workspace-mutation-origin';
const headers={'Cache-Control':'private, no-store'};
const denied=()=>Response.json({error:'Not found'},{status:404,headers});
export const dynamic='force-dynamic';
export const maxDuration=300;
async function context(request:Request,projectId:string){
  const query=new URL(request.url).searchParams,page=canonicalPageKey(query.get('page')??''),surface=query.get('surface');
  if(!page||!['cockpit','workspace','dd'].includes(surface??''))return null;
  const access=await resolveCanonicalPageAccess(projectId,surface as 'cockpit'|'workspace'|'dd',query.get('slug')??undefined);
  return access?{query,page,access}:null;
}
export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,ctx=await context(request,projectId);if(!ctx)return denied();
  try{
    const assetKey=ctx.query.get('asset');
    if(assetKey){
      const chapterSlug=ctx.query.get('chapter');if(!chapterSlug||!canonicalReportChapterAllowed(ctx.page,chapterSlug,projectId))return denied();
      const source=await canonicalReportEdition(ctx.access,ctx.page);if(!source)return denied();
      const chapter=await loadDdReportChapter(source.edition.id,chapterSlug);
      if(!chapter?.body.objects.some(o=>o.kind==='image'&&o.assetKey===assetKey))return denied();
      const asset=await ddReportAsset(source.edition.id,assetKey);return asset?new Response(new Uint8Array(asset.bytes),{headers:{...headers,'Content-Type':asset.meta.mime_type,'X-Content-Type-Options':'nosniff'}}):denied();
    }
    return Response.json({page:await loadProjectCanonicalPage(ctx.access,ctx.page)},{headers});
  }catch(error){if(error instanceof Error&&error.message==='page_not_allowed')return denied();return Response.json({error:'共通本文を読み込めなかった。再読み込みが必要。'},{status:503,headers});}
}
/** 一時試算と、編集を許可された入力条件の版付き保存。配布版の生成は行わない。 */
export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  if(!isSameOriginWorkspaceMutation(request))return Response.json({error:'same_origin_required'},{status:403,headers});
  if(Number(request.headers.get('content-length')??0)>200000)return Response.json({error:'request_too_large'},{status:413,headers});
  const {projectId}=await params,ctx=await context(request,projectId);if(!ctx)return denied();
  const body=await request.json().catch(()=>null);if(!body||!canonicalReportChapterAllowed(ctx.page,body.chapter,projectId))return denied();
  try{
    const source=await canonicalReportEdition(ctx.access,ctx.page);if(!source)return denied();const {edition}=source;
    if(body.revision!==edition.revision)return Response.json({error:'資料が更新されたので再読み込みが必要。'},{status:409,headers});
    const model=await loadDdReportModel(edition);if(!validateDdOverrides(model,body.values))return Response.json({error:'入力値が指定された候補・範囲と一致しない。'},{status:422,headers});
    if(body.action==='save-inputs'){
      if(!canSaveCanonicalInputs(ctx.access,ctx.page))return denied();
      const index=await loadDdReportChapterIndex(edition.id),sheets=new Set(index.filter(chapter=>(canonicalPageDefinition(ctx.page,projectId).chapters as readonly string[]).includes(chapter.slug)).map(chapter=>chapter.source_sheet));
      const allowed=new Set(model.inputs.filter(input=>sheets.has(input.sheet)).map(input=>`${input.sheet}!${input.address}`));
      if(!Object.keys(body.values).every(key=>allowed.has(key)))return denied();
      const values={...edition.input_overrides,...body.values};
      if(!validateDdOverrides(model,values))return Response.json({error:'入力値が指定された候補・範囲と一致しない。'},{status:422,headers});
      verifyDdReportCalculation(model,values);
      const calculator=new DdReportCalculator(model,values);
      const chapters=await Promise.all(canonicalPageDefinition(ctx.page,projectId).chapters.map(key=>loadDdReportChapter(edition.id,key)));
      if(chapters.some(chapter=>!chapter))return Response.json({error:'コスト表をすべて読み込めなかった。再読み込みが必要。'},{status:503,headers});
      for(const chapter of chapters)if(chapter)updateDdReportBody(chapter.body,chapter.source_sheet,calculator);
      if(calculator.errors.length)throw new Error('計算条件から値を算出できない。入力した数値と選択肢を修正する。');
      if(Object.keys(body.values).every(key=>Object.hasOwn(edition.input_overrides,key)&&edition.input_overrides[key]===body.values[key]))return Response.json({ok:true,revision:edition.revision,unchanged:true},{headers});
      const committed=await createAdminClient().rpc('dd_report_commit_change',{p_edition_id:edition.id,p_expected_revision:edition.revision,p_actor:ctx.access.actorId,p_kind:'inputs',p_before:edition.input_overrides,p_after:values});
      if(committed.error)return Response.json({error:committed.error.code==='40001'?'別の更新を検出したので、最新版を読んでから保存する。':'保存できなかった。条件を保持したまま再試行する。'},{status:committed.error.code==='40001'?409:503,headers});
      return Response.json({ok:true,revision:committed.data},{headers});
    }
    const raw=await loadDdReportChapter(edition.id,body.chapter);if(!raw)return denied();
    return Response.json({chapter:await redactDdReport(projectId,await evaluatedDdReportChapter(edition,raw,{...edition.input_overrides,...body.values})),revision:edition.revision},{headers});
  }catch{return Response.json({error:'計算条件の検証が必要。'},{status:422,headers});}
}
