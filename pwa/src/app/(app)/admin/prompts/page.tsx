import type { Metadata } from "next";
export const metadata: Metadata = { title: "LLM プロンプト" };

import { createClient } from "@/lib/supabase/server";
import { AdminPromptsClient } from "@/components/admin/AdminPromptsClient";

export default async function AdminPromptsPage() {
  const supabase = await createClient();
  const [{ data: prompts }, { data: contexts }] = await Promise.all([
    supabase
      .from("llm_prompts")
      .select("id, prompt_key, description, body, model, max_tokens, is_active, notes, updated_by, updated_at")
      .order("prompt_key"),
    // スプシ由来の旧つくよみ context (R172_TsukuyomiContextRepo がスプシから同期したもの)。
    // まさが「過去のスプシプロンプトが消えてる」と指摘した 20+ 件の本体。
    supabase
      .from("tsukuyomi_context")
      .select("context_id, tags, priority, system_prompt, status, updated_at")
      .eq("status", "active")
      .order("priority", { ascending: true, nullsFirst: false }),
  ]);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">📝 LLM プロンプト</h1>
        <span className="text-sm text-muted-foreground">
          AGENTS.common.md の絶対ルール: プロンプトはコードに書かず DB で管理する
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        各 prompt_key は LLM 機能識別子。body を編集して is_active=TRUE にすると、コード側の hardcoded fallback より優先される。
      </p>
      <AdminPromptsClient
        prompts={(prompts ?? []).map((p) => ({
          id: p.id as string,
          promptKey: p.prompt_key as string,
          description: (p.description as string | null) ?? "",
          body: (p.body as string | null) ?? "",
          model: (p.model as string | null) ?? "",
          maxTokens: (p.max_tokens as number | null) ?? null,
          isActive: !!p.is_active,
          notes: (p.notes as string | null) ?? "",
          updatedBy: (p.updated_by as string | null) ?? "",
          updatedAt: (p.updated_at as string | null) ?? "",
        }))}
        contexts={(contexts ?? []).map((c) => ({
          contextId: c.context_id as string,
          tags: (c.tags as string | null) ?? "",
          priority: (c.priority as number | null) ?? null,
          systemPrompt: (c.system_prompt as string | null) ?? "",
          updatedAt: (c.updated_at as string | null) ?? "",
        }))}
      />
    </div>
  );
}
