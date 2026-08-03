import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

type HistoryRow = {
  id: string;
  report_kind: "internal" | "external";
  action: "generate" | "draft_save" | "confirm" | "external_save" | "legacy_seed";
  actor_kind: "member" | "automation" | "system" | "legacy";
  actor_member_id: string | null;
  actor_label: string | null;
  changed_sections: unknown;
  detail_available: boolean;
  source: string | null;
  created_at: string;
};

function validQuery(projectId: string, ym: string): boolean {
  return projectId.length > 0 && /^\d{6}$/u.test(ym);
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const projectId = req.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  const ym = req.nextUrl.searchParams.get("ym")?.trim() ?? "";
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!validQuery(projectId, ym)) {
    return NextResponse.json({ error: "projectId and ym (YYYYMM) required" }, { status: 400 });
  }

  if (id) {
    const { data, error } = await auth.supabase
      .from("monthly_report_edit_history")
      .select("id,content_before,content_after,detail_available")
      .eq("id", id)
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "History not found" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      detail: {
        id: data.id,
        before: data.content_before ?? "",
        after: data.content_after ?? "",
        detailAvailable: data.detail_available === true,
      },
    });
  }

  const { data, error } = await auth.supabase
    .from("monthly_report_edit_history")
    .select("id,report_kind,action,actor_kind,actor_member_id,actor_label,changed_sections,detail_available,source,created_at")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as HistoryRow[];
  const memberIds = [...new Set(rows.map((row) => row.actor_member_id).filter((value): value is string => Boolean(value)))];
  const memberNames = new Map<string, string>();
  if (memberIds.length > 0) {
    const membersResult = await auth.supabase
      .from("members")
      .select("member_id,code_name,member_name")
      .in("member_id", memberIds);
    if (membersResult.error) return NextResponse.json({ error: membersResult.error.message }, { status: 500 });
    for (const member of membersResult.data ?? []) {
      memberNames.set(member.member_id, member.code_name || member.member_name || member.member_id);
    }
  }

  return NextResponse.json({
    ok: true,
    history: rows.map((row) => ({
      id: row.id,
      reportKind: row.report_kind,
      action: row.action,
      actorKind: row.actor_kind,
      actorMemberId: row.actor_member_id,
      actorName: row.actor_member_id
        ? memberNames.get(row.actor_member_id) || row.actor_label || row.actor_member_id
        : row.actor_label || (row.actor_kind === "automation" ? "AMD OS（自動処理）" : "システム"),
      changedSections: Array.isArray(row.changed_sections)
        ? row.changed_sections.filter((item): item is string => typeof item === "string")
        : [],
      detailAvailable: row.detail_available,
      source: row.source,
      createdAt: row.created_at,
    })),
  });
}
