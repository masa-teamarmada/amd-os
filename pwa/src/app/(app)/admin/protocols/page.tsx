import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "AMD Protocol - AMD OS" } };

import { createClient } from "@/lib/supabase/server";
import { AdminProtocolsClient } from "@/components/admin/AdminProtocolsClient";

export default async function AdminProtocolsPage() {
  const supabase = await createClient();

  const [protocolsRes, projectsRes, examplesRes] = await Promise.all([
    supabase.from("protocols").select("*").order("updated_at", { ascending: false }),
    supabase.from("projects").select("project_id, project_name").order("project_name"),
    supabase
      .from("protocol_examples")
      .select("protocol_id, project_id, occurred_on, summary, branch_point, criteria, action_taken, result, source_meeting_id")
      .order("occurred_on", { ascending: false, nullsFirst: false }),
  ]);

  // protocol_id → examples[] map
  const examplesByProtocol = new Map<string, unknown[]>();
  for (const e of (examplesRes.data ?? []) as { protocol_id: string }[]) {
    const list = examplesByProtocol.get(e.protocol_id) ?? [];
    list.push(e);
    examplesByProtocol.set(e.protocol_id, list);
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">AMD プロトコル</h1>
        <span className="text-sm text-muted-foreground">
          {(protocolsRes.data ?? []).length} プロトコル / {(examplesRes.data ?? []).length} 事例
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        ★ プロトコルは <strong>普遍的な意思決定パターン</strong>。具体事例は 1 プロトコル : N 事例で蓄積される。
        単純な事実 (設立日 / 終了日 等) は PJ ナレッジ側に分類されます。
      </p>
      <AdminProtocolsClient
        protocols={(protocolsRes.data ?? []).map((p) => ({
          ...p,
          examples: (examplesByProtocol.get(p.protocol_id as string) ?? []) as never[],
        }))}
        projects={(projectsRes.data ?? []).map((p) => ({ id: p.project_id, name: p.project_name }))}
      />
    </div>
  );
}
