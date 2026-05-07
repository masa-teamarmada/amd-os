/**
 * POST /api/admin/project-members
 * body: { projectId: string, members: ProjectMemberInput[] }
 *
 * project_members テーブルの「全削除→再挿入」を service_role で行う。
 *
 * 旧実装は anon クライアント直叩きで RLS 違反になっていた:
 *   "new row violates row-level security policy for table \"project_members\""
 * service_role なら RLS bypass できる。requireAdmin で先に admin チェック。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

interface ProjectMemberInput {
  member_id: string;
  is_pm: boolean;
  is_closer: boolean;
  is_pl: boolean;
  role_label: string | null;
  join_ym: string | null;
  leave_ym: string | null;
  is_active: boolean;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { projectId?: string; members?: ProjectMemberInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid JSON" }, { status: 400 });
  }
  const { projectId, members } = body;
  if (!projectId || !Array.isArray(members)) {
    return NextResponse.json({ ok: false, message: "projectId and members required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error: delErr } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId);
  if (delErr) return NextResponse.json({ ok: false, message: delErr.message }, { status: 500 });

  const rows = members
    .filter((m) => m.member_id && m.member_id.trim().length > 0)
    .map((m) => ({
      project_id: projectId,
      member_id: m.member_id.trim(),
      is_pm: !!m.is_pm,
      is_closer: !!m.is_closer,
      is_pl: !!m.is_pl,
      role_label: m.role_label || null,
      join_ym: m.join_ym || null,
      leave_ym: m.leave_ym || null,
      is_active: m.is_active !== false,
    }));

  if (rows.length === 0) return NextResponse.json({ ok: true, saved: 0 });

  const { error: insErr } = await supabase.from("project_members").insert(rows);
  if (insErr) return NextResponse.json({ ok: false, message: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, saved: rows.length });
}
