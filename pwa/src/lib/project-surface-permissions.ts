// 権限は追加型。既存の管理者・社内閲覧・PJ所属と、明示付与を別に保つ。
export const PROJECT_SURFACES = ['cockpit', 'workspace', 'dd'] as const;
export type ProjectSurface = typeof PROJECT_SURFACES[number];
export type SurfacePermission = 'view' | 'edit';
export type MemberSurfaceGrant = { project_id: string; member_id: string; surface: ProjectSurface; permission: SurfacePermission };
export type SurfaceMember = { memberId: string; isAdmin: boolean; scope: 'portfolio' | 'project'; projects: { projectId: string }[]; surfaceGrants?: MemberSurfaceGrant[] };
export function memberSurfacePermission(member: SurfaceMember, projectId: string, surface: ProjectSurface): SurfacePermission | null {
  if (member.isAdmin) return 'edit';
  const grant = member.surfaceGrants?.find(g => g.member_id === member.memberId && g.project_id === projectId && g.surface === surface);
  if (grant?.permission === 'edit') return 'edit';
  if (surface === 'workspace' && member.scope === 'portfolio') return 'edit';
  if (surface !== 'dd' && member.scope === 'portfolio') return 'view';
  if (surface === 'workspace' && member.projects.some(p => p.projectId === projectId)) return 'view';
  return grant?.permission ?? null;
}
