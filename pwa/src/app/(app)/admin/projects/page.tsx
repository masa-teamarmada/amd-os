import { createClient } from "@/lib/supabase/server";
import { AdminProjectsTable, type ProjectRow } from "@/components/admin/AdminProjectsTable";

export default async function AdminProjectsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("status")
    .order("project_name");

  const projects: ProjectRow[] = (data ?? []).map((p) => ({
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
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  if (error) console.error("AdminProjectsPage:", error.message);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-lg font-semibold">PJ台帳</h1>
        <span className="text-sm text-muted-foreground">DB_Projects — {projects.length} 件</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        PJ情報の一覧。編集ボタンで請求先・Slack・Drive・メール・ステータス等を変更できます。
      </p>
      <AdminProjectsTable projects={projects} />
    </div>
  );
}
