import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "Admin 外部アクセス - AMD OS" } };

import { WorkspaceAccessAdminPanel } from "@/components/admin/WorkspaceAccessAdminPanel";

export const dynamic = "force-dynamic";

// The (app)/admin layout already gates this section on members.is_admin.
// Every read/write on this page goes through /api/admin/workspace-access,
// which re-checks requireAdmin() on the server for each request.
export default function AdminWorkspaceAccessPage() {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <h1 className="text-lg font-semibold">外部アクセス権限</h1>
        <span className="text-sm text-muted-foreground">人ごとに、見られる場所を管理</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        名前の横の「編集」から、ワークスペースとDDの閲覧権限を変更できる。
      </p>
      <WorkspaceAccessAdminPanel />
    </div>
  );
}
