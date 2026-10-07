import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSameOriginWorkspaceMutation } from '@/lib/workspace-mutation-origin';
import { PROJECT_SURFACES } from '@/lib/project-surface-permissions';
export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requireAdmin(); if (!auth.ok) return auth.errorResponse;
  const db = createAdminClient();
  async function all(table: string, fields: string, order: string) {
    const rows: Record<string, unknown>[] = [];
    for (let n = 0; n < 100000; n += 1000) {
      const {data,error} = await db.from(table).select(fields).order(order).range(n,n+999);
      if (error) throw new Error('load_failed');
      rows.push(...(data ?? []) as unknown as Record<string,unknown>[]);
      if (!data || data.length < 1000) return rows;
    }
    throw new Error('row_limit');
  }
  try {
    const [projects,members,projectMembers,memberGrants,accounts,projectMemberships,ddPackages,ddGrants] = await Promise.all([
      all('projects','project_id,project_name,status','project_id'),
      all('members','member_id,member_name,code_name,email,status,is_admin,os_access_scope','member_id'),
      all('project_members','project_id,member_id,is_active','id'),
      all('project_surface_member_permissions','project_id,member_id,surface,permission,updated_at','member_id'),
      all('workspace_user_accounts','id,email,display_name,affiliation,status','id'),
      all('project_access_memberships','id,project_id,user_account_id,role,status','id'),
      all('dd_packages','id,project_id,slug,title,status,created_at','created_at'),
      all('dd_package_grants','id,package_id,user_account_id,status,capabilities,expires_at','id'),
    ]);
    return NextResponse.json({projects,members,projectMembers,memberGrants,accounts,projectMemberships,ddPackages,ddGrants},{headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'一覧を読み込めない。もう一度読み込む。'},{status:500}); }
}
export async function POST(request: Request) {
  const auth = await requireAdmin(); if (!auth.ok) return auth.errorResponse;
  if (!isSameOriginWorkspaceMutation(request)) return NextResponse.json({error:'same_origin_required'},{status:403});
  const body = await request.json().catch(()=>null);
  if (!body || typeof body.memberId !== 'string' || typeof body.projectId !== 'string' || !PROJECT_SURFACES.includes(body.surface) || !['view','edit'].includes(body.permission)) return NextResponse.json({error:'invalid_grant'},{status:400});
  const db = createAdminClient();
  const {data:actor,error:actorError} = await db.from('members').select('member_id').ilike('email',auth.user.email).eq('status','active').eq('is_admin',true).maybeSingle();
  if (actorError || !actor) return NextResponse.json({error:'Forbidden'},{status:403});
  const {error} = await db.rpc('amd_os_admin_grant_project_surface',{p_actor_member_id:actor.member_id,p_member_id:body.memberId,p_project_id:body.projectId,p_surface:body.surface,p_permission:body.permission});
  if (error) return NextResponse.json({error:'権限を保存できない。対象メンバーとPJを確認する。'},{status:400});
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
