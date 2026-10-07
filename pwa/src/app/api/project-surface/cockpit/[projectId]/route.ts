import {NextResponse} from 'next/server';
import {getCurrentMemberAccess} from '@/lib/project-workspace';
import {memberSurfacePermission} from '@/lib/project-surface-permissions';
import {createAdminClient} from '@/lib/supabase/admin';
import {fetchCockpitFromSupabase} from '@/lib/supabase-data';
export async function GET(_request:Request,{params}:{params:Promise<{projectId:string}>}) {
 const {projectId}=await params; const member=await getCurrentMemberAccess();
 if (!member || !memberSurfacePermission(member,projectId,'cockpit')) return NextResponse.json({error:'Not found'},{status:404});
 try {return NextResponse.json(await fetchCockpitFromSupabase(projectId,createAdminClient()),{headers:{'Cache-Control':'no-store'}});} catch {return NextResponse.json({error:'PJを読み込めない'},{status:500});}
}
