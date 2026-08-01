import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "Admin 外部アクセス - AMD OS" } };

import { WorkspaceAccessAdminPanel } from "@/components/admin/WorkspaceAccessAdminPanel";

// The (app)/admin layout already gates this section on members.is_admin.
// Every read/write on this page goes through /api/admin/workspace-access,
// which re-checks requireAdmin() on the server for each request.
export default function AdminWorkspaceAccessPage() {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <h1 className="text-lg font-semibold">外部アクセス権限</h1>
        <span className="text-sm text-muted-foreground">外部の人がAMD OSのどこに入れるかの台帳</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        メールアドレスだけが外部の人の識別子。ここに登録された権限だけが認可の根拠で、メールのドメインが合っているだけでは誰も入れない。
      </p>
      <WorkspaceAccessAdminPanel />
    </div>
  );
}
