import { createClient } from "@/lib/supabase/server";
import { AdminProjectsTable, type ProjectRow } from "@/components/admin/AdminProjectsTable";

export default async function AdminProjectsPage() {
  const supabase = await createClient();
  const { data: pjData, error } = await supabase
    .from("projects")
    .select("*")
    .order("status")
    .order("project_name");

  // 全 PJ の メンバー × 役割 を 1 クエリで取って、各 PJ ごとに code_name の配列にまとめる
  const { data: pmData } = await supabase
    .from("project_members")
    .select("project_id, member_id, is_pm, is_closer, is_pl, is_active")
    .eq("is_active", true);
  const memberIds = Array.from(new Set((pmData ?? []).map((r) => r.member_id)));
  const { data: memberData } = memberIds.length > 0
    ? await supabase.from("members").select("member_id, code_name, email").in("member_id", memberIds)
    : { data: [] };
  const memberMap = new Map<string, { codeName: string; email: string | null }>();
  for (const m of memberData ?? []) {
    memberMap.set(m.member_id, { codeName: m.code_name || m.member_id, email: m.email ?? null });
  }
  const rolesByPj = new Map<string, { pms: string[]; closers: string[]; pls: string[] }>();
  for (const r of pmData ?? []) {
    const acc = rolesByPj.get(r.project_id) ?? { pms: [], closers: [], pls: [] };
    const name = memberMap.get(r.member_id)?.codeName || r.member_id;
    if (r.is_pm) acc.pms.push(name);
    if (r.is_closer) acc.closers.push(name);
    if (r.is_pl) acc.pls.push(name);
    rolesByPj.set(r.project_id, acc);
  }

  const projects: ProjectRow[] = (pjData ?? []).map((p) => {
    const r = rolesByPj.get(p.project_id) ?? { pms: [], closers: [], pls: [] };
    return {
      id: p.id,
      project_id: p.project_id,
      project_name: p.project_name,
      client_name: p.client_name ?? null,
      status: p.status,
      slack_channel_id: p.slack_channel_id ?? null,
      drive_folder_id: p.drive_folder_id ?? null,
      freee_partner_id: p.freee_partner_id ?? null,
      report_emails: p.report_emails ?? null,
      start_ym: p.start_ym ?? null,
      end_ym: p.end_ym ?? null,
      invoice_send_manual: !!p.invoice_send_manual,
      invoice_to_emails: p.invoice_to_emails ?? null,
      invoice_cc_emails: p.invoice_cc_emails ?? null,
      invoice_bcc_emails: p.invoice_bcc_emails ?? null,
      payment_due_day: p.payment_due_day ?? null,
      freeze_from_ym: p.freeze_from_ym ?? null,
      restart_expected_ym: p.restart_expected_ym ?? null,
      pms: r.pms,
      closers: r.closers,
      pls: r.pls,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });

  if (error) console.error("AdminProjectsPage:", error.message);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-lg font-semibold">PJ台帳</h1>
        <span className="text-sm text-muted-foreground">DB_Projects — {projects.length} 件</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        PJ情報の一覧。編集ボタンで請求先・Slack・Drive・メール・PL/PM/クローザー・ステータス・支払期日等を変更できます。
      </p>
      <AdminProjectsTable projects={projects} />
    </div>
  );
}
