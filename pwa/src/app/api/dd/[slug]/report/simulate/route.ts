import {NextResponse} from 'next/server';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {isSameOriginWorkspaceMutation} from '@/lib/workspace-mutation-origin';
import {loadDdReportEdition,loadDdReportModel,loadDdReportChapter,updateDdReportBody,redactDdReport} from '@/lib/dd-report-server';
import {validateDdOverrides,verifyDdReportCalculation} from '@/lib/dd-report-model';
export const dynamic='force-dynamic';
export const maxDuration=300;
const headers={'Cache-Control':'private, no-store'};
/** A reader's scenario returns evaluated publication cells and never writes the shared plan. */
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params,access=await resolveDdPackageAccess(slug);
  if(!access)return NextResponse.json({error:'Not found'},{status:404,headers});
  if(!isSameOriginWorkspaceMutation(request))return NextResponse.json({error:'same_origin_required'},{status:403,headers});
  if(Number(request.headers.get('content-length')||0)>200000)return NextResponse.json({error:'request_too_large'},{status:413,headers});
  const edition=await loadDdReportEdition(access);if(!edition)return NextResponse.json({error:'Not found'},{status:404,headers});
  const body=await request.json().catch(()=>null);
  if(!body||body.revision!==edition.revision)return NextResponse.json({error:'資料が更新されたため、再読込が必要。'},{status:409,headers});
  if(typeof body.chapter!=='string')return NextResponse.json({error:'資料を指定する。'},{status:400,headers});
  const chapter=await loadDdReportChapter(edition.id,body.chapter);if(!chapter)return NextResponse.json({error:'Not found'},{status:404,headers});
  const model=await loadDdReportModel(edition);
  if(!validateDdOverrides(model,body.values))return NextResponse.json({error:'試算条件を確認する。'},{status:400,headers});
  try{
    const calc=verifyDdReportCalculation(model,{...edition.input_overrides,...body.values});
    const evaluated={...chapter,body:updateDdReportBody(chapter.body,chapter.source_sheet,calc)};
    return NextResponse.json({chapter:await redactDdReport(access.projectId,evaluated),revision:edition.revision},{headers});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'試算条件を確認する。'},{status:422,headers});}
}
