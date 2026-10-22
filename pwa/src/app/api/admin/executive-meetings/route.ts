import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: noStore });

async function activeAdminMemberId(email: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("members")
    .select("member_id").ilike("email", email).eq("status", "active").eq("is_admin", true).maybeSingle();
  return error ? null : data?.member_id ?? null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  if (!await activeAdminMemberId(auth.user.email)) return fail(403, "管理者権限を確認できない");
  const db = createAdminClient();
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    const [projects, members, accounts] = await Promise.all([
      db.from("projects").select("project_id,project_name,status").order("project_id"),
      db.from("members").select("member_id,member_name,code_name,email,status,is_executive").order("member_name"),
      db.from("workspace_user_accounts").select("id,display_name,email,status,is_executive").order("email"),
    ]);
    if (projects.error || members.error || accounts.error) return fail(500, "経営会議の設定を読み込めない");
    return NextResponse.json({ projects: projects.data, members: members.data, accounts: accounts.data }, { headers: noStore });
  }
  const [project, members, accounts, roster, rules] = await Promise.all([
    db.from("projects").select("project_id,project_name").eq("project_id", projectId).maybeSingle(),
    db.from("members").select("member_id,member_name,code_name,email,status,is_admin,is_executive,os_access_scope").order("member_name"),
    db.from("workspace_user_accounts").select("id,display_name,email,status,is_executive").order("email"),
    db.from("project_executive_members").select("id,member_id,workspace_account_id,active,added_at,removed_at,added_by_member_id,removed_by_member_id").eq("project_id", projectId).order("added_at"),
    db.from("project_meeting_rule_versions").select("*").eq("project_id", projectId).eq("meeting_kind", "management").order("version", { ascending: false }),
  ]);
  if (project.error || !project.data || members.error || accounts.error || roster.error || rules.error) return fail(500, "経営会議の設定を読み込めない");
  const [projectMembers, grants, memberships] = await Promise.all([
    db.from("project_members").select("member_id").eq("project_id", projectId).eq("is_active", true),
    db.from("project_surface_member_permissions").select("member_id,surface").eq("project_id", projectId).in("surface", ["cockpit", "workspace"]),
    db.from("project_access_memberships").select("user_account_id").eq("project_id", projectId).eq("status", "active"),
  ]);
  if (projectMembers.error || grants.error || memberships.error) return fail(500, "閲覧資格を読み込めない");
  const memberIds = new Set((projectMembers.data ?? []).map((row) => row.member_id));
  const grantIds = new Set((grants.data ?? []).map((row) => row.member_id));
  const accountIds = new Set((memberships.data ?? []).map((row) => row.user_account_id));
  return NextResponse.json({
    project: project.data,
    members: members.data,
    accounts: accounts.data,
    eligible_member_ids: (members.data ?? []).filter((member) => member.status === "active" && member.is_executive && (member.is_admin || member.os_access_scope !== "project" || memberIds.has(member.member_id) || grantIds.has(member.member_id))).map((member) => member.member_id),
    eligible_account_ids: (accounts.data ?? []).filter((account) => account.status === "active" && account.is_executive && accountIds.has(account.id)).map((account) => account.id),
    roster: roster.data,
    rules: rules.data,
  }, { headers: noStore });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  if (!isSameOriginWorkspaceMutation(request)) return fail(403, "操作元を確認できない");
  const actorId = await activeAdminMemberId(auth.user.email);
  if (!actorId) return fail(403, "管理者権限を確認できない");
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return fail(400, "入力を確認できない");
  const db = createAdminClient();
  if (body.action === "set_attribute") {
    if (!(["member", "workspace_account"] as unknown[]).includes(body.kind)
      || typeof body.principalId !== "string" || typeof body.active !== "boolean") return fail(400, "対象を確認できない");
    const { error } = await db.rpc("project_meeting_set_executive_attribute", {
      p_target_kind: body.kind, p_target_id: body.principalId,
      p_active: body.active, p_actor_member_id: actorId,
    });
    if (error) return fail(400, "経営陣属性を更新できない");
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (typeof body.projectId !== "string") return fail(400, "PJを選んで");
  const projectId = body.projectId;
  const { data: project } = await db.from("projects").select("project_id").eq("project_id", projectId).maybeSingle();
  if (!project) return fail(404, "PJが見つからない");
  if (body.action === "add" || body.action === "remove") {
    if (!(["member", "workspace_account"] as unknown[]).includes(body.kind) || typeof body.principalId !== "string") return fail(400, "対象を確認できない");
    const kind = body.kind as "member" | "workspace_account";
    const id = body.principalId;
    if (body.action === "add") {
      // 経営陣登録だけで新たなスペース閲覧権限を作らない。既存のPJ入場権限を先に確認する。
      if (kind === "member") {
        const { data: member } = await db.from("members").select("member_id,is_admin,is_executive,os_access_scope,status").eq("member_id", id).maybeSingle();
        if (!member || member.status !== "active" || !member.is_executive) return fail(400, "経営陣属性のあるメンバーを選んで");
        if (!member.is_admin && member.os_access_scope === "project") {
          const [membership, grants] = await Promise.all([
            db.from("project_members").select("id").eq("project_id", projectId).eq("member_id", id).eq("is_active", true).limit(1),
            db.from("project_surface_member_permissions").select("member_id").eq("project_id", projectId).eq("member_id", id).in("surface", ["cockpit", "workspace"]).limit(1),
          ]);
          if (!membership.data?.length && !grants.data?.length) return fail(400, "先にこのPJのコックピットかワークスペースの閲覧権限を付けて");
        }
      } else {
        const [account, membership] = await Promise.all([
          db.from("workspace_user_accounts").select("id,status,is_executive").eq("id", id).maybeSingle(),
          db.from("project_access_memberships").select("id").eq("project_id", projectId).eq("user_account_id", id).eq("status", "active").maybeSingle(),
        ]);
        if (account.data?.status !== "active" || !account.data.is_executive || !membership.data) return fail(400, "経営陣属性とこのPJのワークスペース閲覧権限を確認して");
      }
    }
    const { error } = await db.rpc("project_meeting_set_executive", {
      p_project_id: projectId, p_actor_member_id: actorId,
      p_target_kind: kind, p_target_id: id, p_active: body.action === "add",
    });
    if (error) return fail(400, "経営陣登録を更新できない");
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (body.action === "publish_rule") {
    const sourceTitle = typeof body.sourceTitle === "string" ? body.sourceTitle.trim() : "";
    const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
    const clauseReference = typeof body.clauseReference === "string" ? body.clauseReference.trim() : "";
    const quorumNumerator = Number(body.quorumNumerator);
    const quorumDenominator = Number(body.quorumDenominator);
    const approvalNumerator = Number(body.approvalNumerator);
    const approvalDenominator = Number(body.approvalDenominator);
    const approvalBasis = body.approvalBasis;
    const closeMode = body.closeMode;
    const manualCloseRole = closeMode === "manual" ? body.manualCloseRole : null;
    const deadlineMinutes = closeMode === "deadline" ? Number(body.deadlineMinutes) : null;
    if (sourceTitle.length < 1 || sourceTitle.length > 200 || sourceText.length < 20 || sourceText.length > 100000
      || clauseReference.length < 1 || clauseReference.length > 1000
      || ![quorumNumerator, quorumDenominator, approvalNumerator, approvalDenominator].every(Number.isInteger)
      || quorumNumerator < 1 || quorumNumerator > quorumDenominator
      || approvalNumerator < 1 || approvalNumerator > approvalDenominator
      || !(["eligible", "cast", "non_abstain"] as unknown[]).includes(approvalBasis)
      || !(["manual", "all_cast", "deadline"] as unknown[]).includes(closeMode)
      || (closeMode === "manual" && !(["any_executive", "initiator", "admin"] as unknown[]).includes(manualCloseRole))
      || (closeMode === "deadline" && (!Number.isInteger(deadlineMinutes) || deadlineMinutes! < 1 || deadlineMinutes! > 525600))) return fail(400, "規程原文と判定条件を確認して");
    const sourceSha = createHash("sha256").update(sourceText, "utf8").digest("hex");
    const { error } = await db.rpc("project_meeting_publish_rule", {
      p_project_id: projectId, p_source_title: sourceTitle, p_source_text: sourceText, p_source_sha256: sourceSha,
      p_quorum_numerator: quorumNumerator, p_quorum_denominator: quorumDenominator, p_quorum_strict: body.quorumStrict === true,
      p_approval_basis: approvalBasis, p_approval_numerator: approvalNumerator, p_approval_denominator: approvalDenominator,
      p_approval_strict: body.approvalStrict === true, p_close_mode: closeMode,
      p_manual_close_role: manualCloseRole, p_deadline_minutes: deadlineMinutes,
      p_clause_reference: clauseReference, p_actor_member_id: actorId,
    });
    if (error) return fail(400, "規程を登録できない。原文と条件を確認して");
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  return fail(400, "操作を確認できない");
}
