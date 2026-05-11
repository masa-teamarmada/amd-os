import type { Metadata } from "next";
export const metadata: Metadata = { title: "AMD Protocol" };

import { createClient } from "@/lib/supabase/server";
import { AdminProtocolsClient } from "@/components/admin/AdminProtocolsClient";

export default async function AdminProtocolsPage() {
  const supabase = await createClient();

  const [protocolsRes, projectsRes] = await Promise.all([
    supabase.from("protocols").select("*").order("updated_at", { ascending: false }),
    supabase.from("projects").select("project_id, project_name").order("project_name"),
  ]);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">Protocol管理</h1>
        <span className="text-sm text-muted-foreground">DB_Protocols — {(protocolsRes.data ?? []).length} 件</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        候補→確定→アーカイブ。意思決定の判断基準をストックする正本。
      </p>
      <AdminProtocolsClient
        protocols={protocolsRes.data ?? []}
        projects={(projectsRes.data ?? []).map((p) => ({ id: p.project_id, name: p.project_name }))}
      />
    </div>
  );
}
