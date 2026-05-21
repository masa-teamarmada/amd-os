import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "Admin メンバー - AMD OS" } };

import { createClient } from "@/lib/supabase/server";
import { AdminMembersTable, type MemberRow } from "@/components/admin/AdminMembersTable";

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("last_login_at", { ascending: false, nullsFirst: false })
    .order("status")
    .order("code_name");

  const members: MemberRow[] = (data ?? []).map((m) => ({
    id: m.id,
    member_id: m.member_id,
    code_name: m.code_name,
    member_name: m.member_name ?? null,
    email: m.email,
    role: m.role ?? null,
    status: m.status,
    is_admin: m.is_admin,
    slack_id: m.slack_id ?? null,
    join_ym: m.join_ym ?? null,
    leave_ym: m.leave_ym ?? null,
    bank_info: m.bank_info ?? null,
    member_address: m.member_address ?? null,
    google_calendar_status: m.google_calendar_status ?? "missing",
    google_calendar_checked_at: m.google_calendar_checked_at ?? null,
    google_calendar_connected_at: m.google_calendar_connected_at ?? null,
    google_calendar_error: m.google_calendar_error ?? null,
    last_login_at: m.last_login_at ?? null,
    created_at: m.created_at,
    updated_at: m.updated_at,
  }));

  if (error) console.error("AdminMembersPage:", error.message);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-lg font-semibold">アカウント台帳</h1>
        <span className="text-sm text-muted-foreground">DB_Members — {members.length} 件</span>
      </div>
      <AdminMembersTable members={members} />
    </div>
  );
}
