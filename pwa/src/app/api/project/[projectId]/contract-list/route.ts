import { NextResponse } from "next/server";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageContractDisclosure, projectContractGroups, PROJECT_CONTRACT_LIST_SCOPES } from "@/lib/project-contract-list";
import { loadProjectContractEvidence, loadProjectContractList, loadProjectContractSources } from "@/lib/project-contract-list-server";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ projectId: string }> };

export async function GET(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const access = await resolveSharedWorkspaceAccess(projectId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const search = new URL(req.url).searchParams;
  const contractId = search.get("contractId");
  const before = search.get("before");
  const beforeId = search.get("beforeId");
  if ((before || beforeId) && (!contractId || !before || !beforeId || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(before) || Number.isNaN(Date.parse(before)) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(beforeId))) return NextResponse.json({ error: "Invalid cursor" }, { status: 400, headers });
  if (contractId !== null && (!contractId || contractId.length > 80)) return NextResponse.json({ error: "Invalid contract" }, { status: 400, headers });
  try {
    if (contractId) {
      const evidence = await loadProjectContractEvidence(createAdminClient(), projectId, contractId, before && beforeId ? { occurredAt: before, id: beforeId } : undefined);
      return evidence ? NextResponse.json({ ok: true, ...evidence }, { headers }) : NextResponse.json({ error: "Not found" }, { status: 404, headers });
    }
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
