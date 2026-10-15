import {NextRequest,NextResponse} from "next/server";
import {requireMember} from "@/lib/supabase/api-auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {hasSharedWorkspaceProjectReadAccess} from "@/lib/shared-workspace-project-read-access";
import {canEditProjectSurface} from "@/lib/project-surface-access";
import {loadProjectPocList} from "@/lib/project-poc-list-server";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const projectId=req.nextUrl.searchParams.get("projectId");if(!projectId)return NextResponse.json({error:"projectId required"},{status:400});
 const auth=await requireMember();
 if(!auth.ok&&!await hasSharedWorkspaceProjectReadAccess(projectId))return auth.errorResponse;
 try{const data=await loadProjectPocList(auth.ok?auth.supabase:createAdminClient(),projectId,auth.ok?"internal":"shared",auth.ok&&(await canEditProjectSurface(projectId,"cockpit")||await canEditProjectSurface(projectId,"workspace")));return NextResponse.json({ok:true,...data},{headers:{"Cache-Control":"private, no-store"}});}catch{return NextResponse.json({error:"PoCリストを読み込めなかった"},{status:500});}
}
