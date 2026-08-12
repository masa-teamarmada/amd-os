import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { canAccessWorkspaceProject, getCurrentMemberAccess } from "@/lib/project-workspace";
import { parseSharedProjectControlPublication } from "@/lib/shared-project-control";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PILLARS = new Set([
  "business_development",
  "technology_development",
  "organizational_building",
  "funding",
]);
const SOURCES = new Set([
  "project_management_milestones",
  "project_management_issues",
  "project_management_decisions",
  "project_management_action_items",
  "project_management_partner_work_items",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublicationParty = {
  partyId: string;
  kind: "amd" | "research" | "startup";
  partyRole: string;
  displayLabel: string;
};

type PublicationContext = {
  configured: boolean;
  actorPrincipalId: string | null;
  actorPartyIds: string[];
  parties: PublicationParty[];
  latestRevision: { id: string; number: number } | null;
};

type SourceRef = {
  sourceTable: string;
  sourceId: string;
  sourceVersion: number;
  pillarKey: string;
  ballPartyIds: string[];
  jointDecision: boolean;
  criticalRank: number | null;
  dependencyItemIds: string[];
};

function invalid(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function asContext(value: unknown): PublicationContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.configured !== "boolean" || !Array.isArray(row.actorPartyIds) || !Array.isArray(row.parties)) return null;
  return value as PublicationContext;
}

function sourceRefs(value: unknown): SourceRef[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 60) return null;
  const refs: SourceRef[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    if (Object.keys(row).sort().join(",") !== [
      "ballPartyIds", "criticalRank", "dependencyItemIds", "jointDecision",
      "pillarKey", "sourceId", "sourceTable", "sourceVersion",
    ].sort().join(",")) return null;
    if (
      typeof row.sourceTable !== "string" || !SOURCES.has(row.sourceTable)
      || typeof row.sourceId !== "string" || !UUID.test(row.sourceId)
      || !Number.isSafeInteger(row.sourceVersion) || Number(row.sourceVersion) < 1
      || typeof row.pillarKey !== "string" || !PILLARS.has(row.pillarKey)
      || !Array.isArray(row.ballPartyIds) || row.ballPartyIds.some((id) => typeof id !== "string" || !UUID.test(id))
      || new Set(row.ballPartyIds).size !== row.ballPartyIds.length
      || typeof row.jointDecision !== "boolean"
      || (row.criticalRank !== null && (!Number.isSafeInteger(row.criticalRank) || Number(row.criticalRank) < 1))
      || !Array.isArray(row.dependencyItemIds) || row.dependencyItemIds.some((id) => typeof id !== "string" || !id.trim())
      || new Set(row.dependencyItemIds).size !== row.dependencyItemIds.length
    ) return null;
    refs.push(row as SourceRef);
  }
  return refs;
}

async function publicationContext(memberId: string, projectId: string): Promise<PublicationContext | null> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("workspace_admin_project_publication_context", {
    p_actor_member_id: memberId,
    p_project_id: projectId,
  });
  if (error) throw new Error(error.message);
  return asContext(data);
}

async function currentPublication(memberId: string, projectId: string) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("project_read_published_revision_for_member", {
    p_member_id: memberId,
    p_project_id: projectId,
  });
  if (error) throw new Error(error.message);
  return parseSharedProjectControlPublication(data);
}

async function loadCandidates(projectId: string) {
  const db = createAdminClient();
  const [milestones, issues, decisions, actions, workItems] = await Promise.all([
    db.from("project_management_milestones").select("id,title,version,track,status,planned_end,forecast_end,criticality,sort_order").eq("project_id", projectId).is("deleted_at", null).order("sort_order"),
    db.from("project_management_issues").select("id,title,version,track,status,due_date,sort_order").eq("project_id", projectId).is("deleted_at", null).order("sort_order"),
    db.from("project_management_decisions").select("id,title,version,decision_state,due_date,sort_order").eq("project_id", projectId).is("deleted_at", null).order("sort_order"),
    db.from("project_management_action_items").select("id,title,version,status,due_date,decision_id").eq("project_id", projectId).is("deleted_at", null).order("due_date"),
    db.from("project_management_partner_work_items").select("id,title,version,status,due_date,partner_id,sort_order").eq("project_id", projectId).is("deleted_at", null).order("sort_order"),
  ]);
  const failed = [milestones, issues, decisions, actions, workItems].find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
  return [
    ...(milestones.data ?? []).map((row) => ({
      sourceTable: "project_management_milestones", sourceId: row.id, sourceVersion: row.version,
      label: row.title, pillarKey: row.track, state: row.status,
      dueDate: row.forecast_end ?? row.planned_end, group: "MS",
    })),
    ...(issues.data ?? []).map((row) => ({
      sourceTable: "project_management_issues", sourceId: row.id, sourceVersion: row.version,
      label: row.title, pillarKey: row.track, state: row.status, dueDate: row.due_date, group: "論点",
    })),
    ...(decisions.data ?? []).map((row) => ({
      sourceTable: "project_management_decisions", sourceId: row.id, sourceVersion: row.version,
      label: row.title, pillarKey: null, state: row.decision_state, dueDate: row.due_date, group: "判断",
    })),
    ...(actions.data ?? []).map((row) => ({
      sourceTable: "project_management_action_items", sourceId: row.id, sourceVersion: row.version,
      label: row.title, pillarKey: null, state: row.status, dueDate: row.due_date, group: "実行",
    })),
    ...(workItems.data ?? []).map((row) => ({
      sourceTable: "project_management_partner_work_items", sourceId: row.id, sourceVersion: row.version,
      label: row.title, pillarKey: null, state: row.status, dueDate: row.due_date, group: "関係先",
    })),
  ];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const access = await getCurrentMemberAccess();
  if (!access) return invalid("unauthorized", 401);
  if (!canAccessWorkspaceProject(access, projectId)) return invalid("not_found", 404);

  try {
    const [publication, candidates, context] = await Promise.all([
      currentPublication(access.memberId, projectId),
      loadCandidates(projectId),
      access.isAdmin ? publicationContext(access.memberId, projectId) : Promise.resolve(null),
    ]);
    return NextResponse.json({ ok: true, publication, candidates, context }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[shared-publication] load failed:", error instanceof Error ? error.message : error);
    return invalid("shared_publication_load_failed", 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const access = await getCurrentMemberAccess();
  if (!access) return invalid("unauthorized", 401);
  if (!access.isAdmin) return invalid("forbidden", 403);
  if (!canAccessWorkspaceProject(access, projectId)) return invalid("not_found", 404);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return invalid("invalid_json");
  }
  if (Object.keys(body).sort().join(",") !== ["audiencePartyIds", "sourceRefs"].sort().join(",")) {
    return invalid("invalid_fields");
  }
  const refs = sourceRefs(body.sourceRefs);
  const audiencePartyIds = Array.isArray(body.audiencePartyIds)
    ? body.audiencePartyIds.filter((id): id is string => typeof id === "string" && UUID.test(id))
    : [];
  if (!refs || audiencePartyIds.length === 0 || audiencePartyIds.length !== (body.audiencePartyIds as unknown[]).length) {
    return invalid("invalid_publication_request");
  }

  try {
    const context = await publicationContext(access.memberId, projectId);
    if (!context?.configured || !context.actorPrincipalId) return invalid("publication_not_configured", 409);
    const allowedAudience = new Set(context.parties.filter((party) => party.kind !== "amd").map((party) => party.partyId));
    if (new Set(audiencePartyIds).size !== audiencePartyIds.length || audiencePartyIds.some((id) => !allowedAudience.has(id))) {
      return invalid("invalid_audience");
    }
    const allAudiencePartyIds = [...new Set([...context.actorPartyIds, ...audiencePartyIds])];
    const db = createAdminClient();
    const { error } = await db.rpc("project_publish_control_revision", {
      p_request_id: `cockpit-publication:${randomUUID()}`,
      p_actor_principal_id: context.actorPrincipalId,
      p_project_id: projectId,
      p_as_of: new Date().toISOString(),
      p_source_refs: refs,
      p_audience_party_ids: allAudiencePartyIds,
      p_supersedes_revision_id: context.latestRevision?.id ?? null,
    });
    if (error) throw new Error(error.message);
    const publication = await currentPublication(access.memberId, projectId);
    if (publication.state !== "published") throw new Error("sealed revision was not readable after publish");
    return NextResponse.json({ ok: true, publication });
  } catch (error) {
    console.error("[shared-publication] publish failed:", error instanceof Error ? error.message : error);
    return invalid("publication_failed", 500);
  }
}
