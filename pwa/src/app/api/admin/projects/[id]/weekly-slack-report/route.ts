import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { weeklySlackReportEnabled, weeklySlackReportSettingKey } from "@/lib/weekly-slack-report";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { enabled?: unknown };
  try {
    body = await request.json() as { enabled?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "enabled must be boolean" }, { status: 400 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { data: project, error: projectError } = await db
    .from("projects")
    .select("project_id,slack_channel_id,slack_channel_not_required")
    .eq("id", id)
    .maybeSingle();
  if (projectError) return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ ok: false, error: "project not found" }, { status: 404 });
  if (body.enabled && (!project.slack_channel_id || project.slack_channel_not_required)) {
    return NextResponse.json({ ok: false, error: "Slack channel is required before enabling weekly Slack report" }, { status: 400 });
  }

  const key = weeklySlackReportSettingKey(project.project_id);
  const { error: writeError } = await db
    .from("settings")
    .upsert({ key, value: String(body.enabled), updated_by: auth.user.email, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (writeError) return NextResponse.json({ ok: false, error: writeError.message }, { status: 500 });

  const { data: settings, error: readError } = await db
    .from("settings")
    .select("key,value")
    .eq("key", key);
  if (readError) return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  return NextResponse.json({ ok: true, enabled: weeklySlackReportEnabled(project.project_id, settings ?? []) });
}
