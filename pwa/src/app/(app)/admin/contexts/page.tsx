import { createClient } from "@/lib/supabase/server";
import { AdminContextsTable, type ContextRow } from "@/components/admin/AdminContextsTable";

export default async function AdminContextsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tsukuyomi_context")
    .select("*")
    .order("priority", { ascending: false })
    .order("context_id");

  const contexts: ContextRow[] = (data ?? []).map((r) => ({
    id: r.id,
    context_id: r.context_id,
    tags: r.tags ?? "",
    priority: r.priority ?? 0,
    system_prompt: r.system_prompt ?? "",
    status: r.status ?? "active",
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  if (error) console.error("AdminContextsPage:", error.message);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">LLM Context</h1>
        <span className="text-sm text-muted-foreground">tsukuyomi_context — {contexts.length} 件</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        つくよみの人格・判断基準・PJ背景など。LLMのsystemPromptとして注入される正本。
      </p>
      <AdminContextsTable contexts={contexts} />
    </div>
  );
}
