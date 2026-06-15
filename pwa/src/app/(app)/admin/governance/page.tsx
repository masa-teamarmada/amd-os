import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "Admin 株主・ガバナンス - AMD OS" } };

import { createClient } from "@/lib/supabase/server";
import { AdminGovernanceClient, type PjOption } from "@/components/admin/AdminGovernanceClient";

export const dynamic = "force-dynamic";

/**
 * /admin/governance — 株主 / 資金調達ラウンド / 株主総会・決議 / 要対応 の手動記録の場所。
 * 設計: pwa/design/governance_action_items.md
 * 機密 RLS は API (/api/governance, /api/action-items) 側の requireAdmin で担保。
 */
export default async function AdminGovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("project_id, project_name, status")
    .order("status")
    .order("project_name");

  const projects: PjOption[] = (data ?? []).map((p) => ({
    projectId: p.project_id as string,
    projectName: (p.project_name as string) || (p.project_id as string),
    status: (p.status as string) || "",
  }));

  return (
    <div className="container mx-auto max-w-5xl py-6 px-4">
      <h1 className="text-lg font-semibold mb-1">🏛 株主・ガバナンス 記録</h1>
      <p className="text-xs text-muted-foreground mb-4">
        各PJの株主構成・資金調達ラウンド/バリュエーション・株主総会と決議・要対応案件を記録する。終了PJも対象。
      </p>
      <AdminGovernanceClient projects={projects} initialProjectId={sp.projectId ?? null} />
    </div>
  );
}
