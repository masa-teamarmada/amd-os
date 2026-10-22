import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveExecutiveMeetingViewer } from "@/lib/project-executive-meeting-access";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string }> };
const noStore = { "Cache-Control": "no-store" };
const fail = (status: number, message: string) => NextResponse.json({ error: message }, { status, headers: noStore });

export async function GET(request: Request, { params }: Context) {
  const { projectId } = await params;
  const viewer = await resolveExecutiveMeetingViewer(projectId);
  if (!viewer) return fail(404, "経営会議を開けない");
  if (new URL(request.url).searchParams.get("eligibility") === "1") {
    return NextResponse.json({ eligible: true }, { headers: noStore });
  }
  const db = createAdminClient();
  const agendaResult = await db.from("project_meeting_agendas")
    .select("id,project_id,meeting_kind,title,motion,materials,proposed_by_kind,proposed_by_id,status,rule_version_id,opened_at,opened_by_kind,opened_by_id,deadline_at,closed_at,outcome,cancel_reason,supersedes_agenda_id,created_at")
    .eq("project_id", projectId).eq("meeting_kind", "management")
    .order("created_at", { ascending: false }).limit(200);
  if (agendaResult.error) return fail(500, "議案を読み込めない");
  let agendas = agendaResult.data;
  const due = (agendas ?? []).filter((agenda) => agenda.status === "open" && agenda.deadline_at && Date.parse(agenda.deadline_at) <= Date.now());
  if (due.length) {
    await Promise.all(due.map((agenda) => db.rpc("project_meeting_finish_vote", { p_agenda_id: agenda.id })));
    const refreshed = await db.from("project_meeting_agendas")
      .select("id,project_id,meeting_kind,title,motion,materials,proposed_by_kind,proposed_by_id,status,rule_version_id,opened_at,opened_by_kind,opened_by_id,deadline_at,closed_at,outcome,cancel_reason,supersedes_agenda_id,created_at")
      .eq("project_id", projectId).eq("meeting_kind", "management")
      .order("created_at", { ascending: false }).limit(200);
    if (refreshed.error) return fail(500, "議案を読み込めない");
    agendas = refreshed.data;
  }
  const [ruleResult, ruleVersionsResult, rosterResult] = await Promise.all([
    db.from("project_meeting_rule_versions")
      .select("id,version,source_title,source_text,quorum_numerator,quorum_denominator,quorum_strict,approval_basis,approval_numerator,approval_denominator,approval_strict,close_mode,manual_close_role,deadline_minutes,clause_reference,published_at")
      .eq("project_id", projectId).eq("meeting_kind", "management")
      .order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("project_meeting_rule_versions")
      .select("id,version,source_title,source_text,quorum_numerator,quorum_denominator,quorum_strict,approval_basis,approval_numerator,approval_denominator,approval_strict,close_mode,manual_close_role,deadline_minutes,clause_reference,published_at")
      .eq("project_id", projectId).eq("meeting_kind", "management")
      .order("version", { ascending: false }),
    db.from("project_executive_members").select("member_id,workspace_account_id")
      .eq("project_id", projectId).eq("active", true),
  ]);
  if (ruleResult.error || ruleVersionsResult.error || rosterResult.error) return fail(500, "経営会議の設定を読み込めない");
  const agendaIds = (agendas ?? []).filter((a) => a.status !== "draft").map((a) => a.id);
  const electorateResult = agendaIds.length
    ? await db.from("project_meeting_electorate").select("id,agenda_id,member_id,workspace_account_id").in("agenda_id", agendaIds)
    : { data: [], error: null };
  if (electorateResult.error) return fail(500, "採決の記録を読み込めない");
  const electorate = electorateResult.data ?? [];
  const electorateIds = electorate.map((entry) => entry.id);
  const ballotResult = electorateIds.length
    ? await db.from("project_meeting_ballots").select("electorate_id,choice,cast_at").in("electorate_id", electorateIds)
    : { data: [], error: null };
  if (ballotResult.error) return fail(500, "投票を読み込めない");
  const ballotByElectorate = new Map((ballotResult.data ?? []).map((b) => [b.electorate_id, b]));
  const agendaSummary = (agendas ?? []).map((agenda) => {
    const eligible = electorate.filter((entry) => entry.agenda_id === agenda.id);
    const votes = eligible.map((entry) => ballotByElectorate.get(entry.id)).filter((b) => !!b);
    const mine = eligible.find((entry) => viewer.kind === "member"
      ? entry.member_id === viewer.id : entry.workspace_account_id === viewer.id);
    return {
      ...agenda,
      eligible_count: eligible.length,
      cast_count: votes.length,
      my_vote: mine ? ballotByElectorate.get(mine.id)?.choice ?? null : null,
      can_vote: !!mine,
      tally: agenda.status === "closed" ? {
        yes: votes.filter((vote) => vote?.choice === "yes").length,
        no: votes.filter((vote) => vote?.choice === "no").length,
        abstain: votes.filter((vote) => vote?.choice === "abstain").length,
      } : null,
    };
  });
  return NextResponse.json({ viewer, rule: ruleResult.data, rule_versions: ruleVersionsResult.data, roster_count: rosterResult.data?.length ?? 0, agendas: agendaSummary }, { headers: noStore });
}

export async function POST(request: Request, { params }: Context) {
  const { projectId } = await params;
  if (!isSameOriginWorkspaceMutation(request)) return fail(403, "操作元を確認できない");
  const viewer = await resolveExecutiveMeetingViewer(projectId);
  if (!viewer) return fail(404, "経営会議を開けない");
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return fail(400, "操作を確認できない");
  const db = createAdminClient();
  const action = body.action;
  if (action === "create") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const motion = typeof body.motion === "string" ? body.motion.trim() : "";
    const materials = typeof body.materials === "string" ? body.materials.trim() : "";
    if (!title || title.length > 200 || !motion || motion.length > 20000 || materials.length > 100000) return fail(400, "議案の入力を確認して");
    const supersedesId = typeof body.supersedesAgendaId === "string" ? body.supersedesAgendaId : null;
    if (supersedesId) {
      const { data: previous } = await db.from("project_meeting_agendas")
        .select("id,status").eq("id", supersedesId).eq("project_id", projectId).eq("meeting_kind", "management").maybeSingle();
      if (!previous || previous.status === "draft") return fail(400, "元の議案を確認できない");
    }
    const { data, error } = await db.from("project_meeting_agendas").insert({
      project_id: projectId, meeting_kind: "management", title, motion, materials,
      proposed_by_kind: viewer.kind, proposed_by_id: viewer.id,
      supersedes_agenda_id: supersedesId,
    }).select("id").single();
    if (error) return fail(400, "議案を保存できない");
    return NextResponse.json({ id: data.id }, { headers: noStore });
  }
  const agendaId = typeof body.agendaId === "string" ? body.agendaId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(agendaId)) return fail(400, "議案を確認できない");
  const { data: agenda, error: agendaError } = await db.from("project_meeting_agendas")
    .select("id,status,proposed_by_kind,proposed_by_id").eq("id", agendaId)
    .eq("project_id", projectId).eq("meeting_kind", "management").maybeSingle();
  if (agendaError || !agenda) return fail(404, "議案が見つからない");
  if (action === "update") {
    if (agenda.status !== "draft" || agenda.proposed_by_kind !== viewer.kind || agenda.proposed_by_id !== viewer.id) return fail(403, "この下書きは編集できない");
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const motion = typeof body.motion === "string" ? body.motion.trim() : "";
    const materials = typeof body.materials === "string" ? body.materials.trim() : "";
    if (!title || title.length > 200 || !motion || motion.length > 20000 || materials.length > 100000) return fail(400, "議案の入力を確認して");
    const { data, error } = await db.from("project_meeting_agendas")
      .update({ title, motion, materials, updated_at: new Date().toISOString() })
      .eq("id", agendaId).eq("status", "draft").select("id").maybeSingle();
    if (error || !data) return fail(409, "採決開始後の議案は変更できない。新しい議案を作って");
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (action === "start") {
    const { error } = await db.rpc("project_meeting_start_vote", {
      p_agenda_id: agendaId, p_actor_kind: viewer.kind, p_actor_id: viewer.id,
    });
    if (error) return fail(409, "採決を始められない。規程と経営陣の登録、議案の状態を確認して");
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (action === "vote") {
    if (!(["yes", "no", "abstain"] as unknown[]).includes(body.choice)) return fail(400, "票を確認できない");
    const { error } = await db.rpc("project_meeting_cast_vote", {
      p_agenda_id: agendaId, p_actor_kind: viewer.kind, p_actor_id: viewer.id, p_choice: body.choice,
    });
    if (error) return fail(409, "投票できない。資格・期限・投票済みかを確認して");
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (action === "close") {
    const { error } = await db.rpc("project_meeting_finish_vote", {
      p_agenda_id: agendaId, p_actor_kind: viewer.kind, p_actor_id: viewer.id,
    });
    if (error) return fail(409, "採決を締められない。規程の締切条件を確認して");
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (action === "cancel") {
    if (!viewer.isAdmin || viewer.kind !== "member" || typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 1000) return fail(403, "取消できない");
    const { error } = await db.rpc("project_meeting_cancel_vote", {
      p_agenda_id: agendaId, p_actor_member_id: viewer.id, p_reason: body.reason.trim(),
    });
    if (error) return fail(409, "採決を取り消せない");
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  return fail(400, "操作を確認できない");
}
