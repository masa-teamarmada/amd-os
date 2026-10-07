import 'server-only';
import { NextResponse } from 'next/server';
import { getCurrentMemberAccess } from '@/lib/project-workspace';
import { type ProjectSurface } from '@/lib/project-surface-permissions';
import { isSameOriginWorkspaceMutation } from '@/lib/workspace-mutation-origin';
export async function canEditProjectSurface(projectId: string, surface: ProjectSurface) {
  const member = await getCurrentMemberAccess();
  return !!member && (member.isAdmin || member.surfaceGrants?.some(g => g.member_id === member.memberId && g.project_id === projectId && g.surface === surface && g.permission === 'edit') === true);
}
// 委譲は対象PJのコンテンツ操作に限る。管理画面・権限付与へ流用しない。
export async function requireProjectContentEditor(request: Request, projectId: string) {
  const member = await getCurrentMemberAccess();
  if (!member || !projectId || !(member.isAdmin || member.surfaceGrants?.some(g => g.member_id === member.memberId && g.project_id === projectId && (g.surface === 'cockpit' || g.surface === 'workspace') && g.permission === 'edit'))) {
    return { ok: false as const, user: null, errorResponse: NextResponse.json({error:'Forbidden'}, {status:403}) };
  }
  const nativeBearer = /^Bearer [A-Za-z0-9._-]+$/.test(request.headers.get('authorization') ?? '') && !request.headers.has('cookie') && !request.headers.has('origin');
  if (!nativeBearer && !isSameOriginWorkspaceMutation(request)) return { ok:false as const, user:null, errorResponse:NextResponse.json({error:'same_origin_required'},{status:403}) };
  return { ok:true as const, user:{email:member.email,id:member.memberId}, errorResponse:null };
}
