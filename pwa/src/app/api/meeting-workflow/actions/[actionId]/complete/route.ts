/**
 * POST /api/meeting-workflow/actions/:actionId/complete
 *
 * Event-driven completion hook for MTG prep actions.
 * No LLM call, no polling. Slack buttons, OS UI, Drive/Notion webhooks, or a
 * trusted workflow caller can mark an action done and refresh the prep status.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ actionId: string }> };

async function authorize(req: NextRequest): Promise<{ ok: true; actor: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const workflowSecret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (workflowSecret && auth === `Bearer ${workflowSecret}`) return { ok: true, actor: "workflow" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { ok: true, actor: member.code_name || user.email };
}

export async function POST(req: NextRequest, context: Params) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const { actionId } = await context.params;
  const id = String(actionId || "").trim();
  if (!id) return NextResponse.json({ error: "actionId required" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const completionSource = typeof body.completion_source === "string" ? body.completion_source : "manual";
  const evidenceUrl = typeof body.completion_evidence_url === "string" ? body.completion_evidence_url : null;
  const now = new Date().toISOString();

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("meeting_action_items")
    .update({
      status: "done",
      completion_source: completionSource,
      completion_evidence_url: evidenceUrl,
      completed_at: now,
    })
    .eq("action_id", id)
    .select("action_id, prep_meeting_id, project_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "action not found" }, { status: 404 });

  const prepMeetingId = String(updated.prep_meeting_id || "");
  let prepStatus = "done";
  if (prepMeetingId) {
    const { data: openRows, error: openError } = await admin
      .from("meeting_action_items")
      .select("action_id")
      .eq("prep_meeting_id", prepMeetingId)
      .in("status", ["todo", "nudged", "blocked"]);
    if (openError) return NextResponse.json({ error: openError.message }, { status: 500 });
    prepStatus = (openRows ?? []).length === 0 ? "ready" : "nudging";
    await admin
      .from("project_meeting_summaries")
      .update({ prep_status: prepStatus, updated_at: now })
      .eq("meeting_id", prepMeetingId);
  }

  return NextResponse.json({
    ok: true,
    action_id: id,
    prep_meeting_id: prepMeetingId || null,
    prep_status: prepStatus,
    actor: authz.actor,
  });
}
