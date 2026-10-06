import { NextResponse } from "next/server";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageContractDisclosure, projectContractGroups, PROJECT_CONTRACT_LIST_SCOPES } from "@/lib/project-contract-list";
import { loadProjectContractList, loadProjectContractSources } from "@/lib/project-contract-list-server";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const access = await resolveSharedWorkspaceAccess(projectId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    return NextResponse.json({ ok: true, ...await loadProjectContractList(createAdminClient(), projectId, false, canManageContractDisclosure(access)) }, { headers });
  } catch {
    return NextResponse.json({ error: "契約リストを取得できません。" }, { status: 500, headers });
  }
}

export async function PATCH(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const access = await resolveSharedWorkspaceAccess(projectId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  if (!canManageContractDisclosure(access) || !isSameOriginWorkspaceMutation(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.contractId !== "string" || typeof body.ddVisible !== "boolean") return NextResponse.json({ error: "Invalid input" }, { status: 400, headers });
  const db = createAdminClient();
  try {
    const groups = projectContractGroups(await loadProjectContractSources(db, projectId), projectId);
    const target = groups.find(row => row.contract_id === body.contractId);
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    const { error } = await db.from("contracts").update({ dd_visible: body.ddVisible, updated_by: access.email, updated_at: new Date().toISOString() })
      .eq("project_id", projectId).eq("registry_status", "accepted").in("project_contract_scope", [...PROJECT_CONTRACT_LIST_SCOPES]).in("contract_id", target.related_contract_ids);
    if (error) throw error;
    return NextResponse.json({ ok: true, ...await loadProjectContractList(db, projectId, false, true) }, { headers });
  } catch {
    return NextResponse.json({ error: "DDの表示設定を保存できません。" }, { status: 500, headers });
  }
}
