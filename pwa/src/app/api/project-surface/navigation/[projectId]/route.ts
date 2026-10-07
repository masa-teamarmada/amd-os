import { NextResponse } from 'next/server';
import { getCurrentMemberAccess } from '@/lib/project-workspace';
import { memberSurfacePermission } from '@/lib/project-surface-permissions';
import { getDdPackageSummary } from '@/lib/dd-package-summary';

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const member = await getCurrentMemberAccess();
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const canCockpit = !!memberSurfacePermission(member, projectId, 'cockpit');
  const canWorkspace = !!memberSurfacePermission(member, projectId, 'workspace');
  const ddPermission = memberSurfacePermission(member, projectId, 'dd');
  if (!canCockpit && !canWorkspace && !ddPermission) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let ddHref: string | undefined;
  if (member.isAdmin) ddHref = `/project/${encodeURIComponent(projectId)}/dd`;
  else if (ddPermission) {
    const pkg = await getDdPackageSummary(projectId);
    if (pkg && pkg.status !== 'closed' && (pkg.status === 'open' || ddPermission === 'edit')) ddHref = `/dd/${encodeURIComponent(pkg.slug)}`;
  }
  return NextResponse.json({ canCockpit, canWorkspace, ddHref }, { headers: { 'Cache-Control': 'no-store' } });
}
