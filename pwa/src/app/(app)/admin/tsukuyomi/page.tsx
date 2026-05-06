import { createClient } from "@/lib/supabase/server";
import { AdminTsukuyomiClient } from "@/components/admin/AdminTsukuyomiClient";

export default async function AdminTsukuyomiPage() {
  const supabase = await createClient();

  const [projectsRes, contextsRes, learningsRes, statusLearningsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("project_id, project_name, status, slack_channel_id")
      .in("status", ["active"])
      .order("project_name"),
    supabase
      .from("tsukuyomi_context")
      .select("context_id, tags, status")
      .eq("status", "active")
      .order("context_id"),
    supabase
      .from("tsukuyomi_learnings")
      .select("id, scope, scope_key, content, source, source_ref, status, created_at, created_by, removed_at, removed_by, removed_reason")
      .order("created_at", { ascending: false })
      .limit(200),
    // PJ Status コックピットからの学習も同じリストに統合表示する
    // (scope='memory' に振り、source='pj_status:<narrative|xrl|description|pl_hearing|all>' で由来を残す)
    supabase
      .from("tsukuyomi_learnings_status")
      .select("id, scope, target_project_id, lesson_text, source_feedback_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">🌙 Tsukuyomi</h1>
        <span className="text-sm text-muted-foreground">PJチャンネルへの強制発言 / Contextプレビュー</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        PJチャンネルへAIで生成したナッジを送信したり、LLM Contextを確認できます。
        実際の発言はGAS（AMD-Slack）のWebApp経由で実行されます。
      </p>
      <AdminTsukuyomiClient
        projects={(projectsRes.data ?? []).map((p) => ({
          id: p.project_id,
          name: p.project_name,
          slackChannelId: p.slack_channel_id ?? null,
        }))}
        contexts={(contextsRes.data ?? []).map((c) => ({
          contextId: c.context_id,
          tags: c.tags ?? "",
        }))}
        learnings={[
          ...(learningsRes.data ?? []).map((l) => ({
            id: l.id,
            scope: l.scope,
            scopeKey: l.scope_key ?? null,
            content: l.content,
            source: l.source ?? null,
            sourceRef: l.source_ref ?? null,
            status: l.status,
            createdAt: l.created_at ?? null,
            createdBy: l.created_by ?? null,
            removedAt: l.removed_at ?? null,
            removedBy: l.removed_by ?? null,
            removedReason: l.removed_reason ?? null,
          })),
          // PJ Status コックピットからの学習を memory layer に投入
          ...(statusLearningsRes.data ?? []).map((l) => ({
            id: l.id,
            scope: "memory",                                    // 既存 layer に揃えて memory 扱い
            scopeKey: l.target_project_id ?? "all",             // 全 PJ なら "all"、PJ 個別なら project_id
            content: l.lesson_text,
            source: `pj_status:${l.scope}`,                     // narrative / xrl / description / pl_hearing / all
            sourceRef: l.source_feedback_id ?? null,
            status: "active",
            createdAt: l.created_at ?? null,
            createdBy: "tsukuyomi",
            removedAt: null,
            removedBy: null,
            removedReason: null,
          })),
        ]}
      />
    </div>
  );
}
