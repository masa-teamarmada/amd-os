import { createClient } from "@/lib/supabase/server";
import { AdminTsukuyomiClient } from "@/components/admin/AdminTsukuyomiClient";
import { AdminTsukuyomiPjStatusLearnings } from "@/components/admin/AdminTsukuyomiPjStatusLearnings";

export default async function AdminTsukuyomiPage() {
  const supabase = await createClient();

  const [projectsRes, contextsRes, learningsRes, statusLearningsRes, narrativeFeedbacksRes] = await Promise.all([
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
      .limit(100),
    supabase
      .from("tsukuyomi_learnings_status")
      .select("id, scope, target_project_id, lesson_text, source_feedback_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("narrative_feedbacks")
      .select("id, project_id, item_date, item_title, feedback, status, applied_at, applied_note, created_at")
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
      <AdminTsukuyomiPjStatusLearnings
        learnings={(statusLearningsRes.data ?? []).map((l) => ({
          id: l.id,
          scope: l.scope,
          targetProjectId: l.target_project_id ?? null,
          lessonText: l.lesson_text,
          sourceFeedbackId: l.source_feedback_id ?? null,
          createdAt: l.created_at ?? null,
        }))}
        feedbacks={(narrativeFeedbacksRes.data ?? []).map((f) => ({
          id: f.id,
          projectId: f.project_id,
          itemDate: f.item_date ?? null,
          itemTitle: f.item_title ?? null,
          feedback: f.feedback,
          status: f.status,
          appliedAt: f.applied_at ?? null,
          appliedNote: f.applied_note ?? null,
          createdAt: f.created_at ?? null,
        }))}
      />

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
        learnings={(learningsRes.data ?? []).map((l) => ({
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
        }))}
      />
    </div>
  );
}
