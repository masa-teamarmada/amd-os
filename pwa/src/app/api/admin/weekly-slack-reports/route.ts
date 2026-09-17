import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  isWeeklySlackReportProjectId,
  weeklySlackReportSettingKey,
  weeklySlackReportStatuses,
  type WeeklySlackReportSettingRow,
} from "@/lib/weekly-slack-report-settings";

export const runtime = "nodejs";

type UpdatePayload = {
  projectId?: unknown;
  enabled?: unknown;
};

function responseFromRows(rows: WeeklySlackReportSettingRow[]) {
  return NextResponse.json({ ok: true, reports: weeklySlackReportStatuses(rows) });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { data, error } = await createAdminClient()
    .from("settings")
    .select("key,value,updated_at,updated_by")
    .in("key", [weeklySlackReportSettingKey("ctb"), weeklySlackReportSettingKey("se")]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return responseFromRows(data ?? []);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let payload: UpdatePayload;
  try {
    payload = await request.json() as UpdatePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!isWeeklySlackReportProjectId(payload.projectId) || typeof payload.enabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "projectId and boolean enabled are required" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("settings")
    .upsert(
      {
        key: weeklySlackReportSettingKey(payload.projectId),
        value: String(payload.enabled),
        updated_by: auth.user.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data, error: readError } = await createAdminClient()
    .from("settings")
    .select("key,value,updated_at,updated_by")
    .in("key", [weeklySlackReportSettingKey("ctb"), weeklySlackReportSettingKey("se")]);
  if (readError) return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });

  return responseFromRows(data ?? []);
}
