import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { memberSurfacePermission } from "@/lib/project-surface-permissions";
import { canEditProjectSurface, requireProjectContentEditor } from "@/lib/project-surface-access";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProjectProperNounHandlers } from "@/lib/project-proper-nouns-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = createProjectProperNounHandlers({
  createDb: createAdminClient,
  writeAccess: requireProjectContentEditor,
  readAccess: async (projectId) => {
    const member = await getCurrentMemberAccess();
    const internal = member && (memberSurfacePermission(member, projectId, "cockpit") || memberSurfacePermission(member, projectId, "workspace"));
    if (!internal && !await resolveSharedWorkspaceAccess(projectId)) return null;
    return { canEdit: Boolean(member) && (await canEditProjectSurface(projectId, "cockpit") || await canEditProjectSurface(projectId, "workspace")) };
  },
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
