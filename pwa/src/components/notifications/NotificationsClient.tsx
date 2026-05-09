"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Notification, MeetingNotification, Feedback } from "@/app/(app)/notifications/page";

type Props = {
  l2: Notification[];
  mtg: MeetingNotification[];
  feedbacks: Feedback[];
  projectMap: Record<string, string>;
};

type UnifiedItem =
  | { kind: "l2"; data: Notification }
  | { kind: "meeting"; data: MeetingNotification };

export function NotificationsClient({ l2, mtg, feedbacks, projectMap }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [feedbackTexts, setFeedbackTexts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [localFeedbacks, setLocalFeedbacks] = useState<Feedback[]>(feedbacks);
  const [filter, setFilter] = useState<"all" | "unread" | "feedback">("all");

  // 通知を時系列でマージ (l2 + meeting)
  const items: UnifiedItem[] = useMemo(() => {
    const merged: UnifiedItem[] = [
      ...l2.map((x) => ({ kind: "l2" as const, data: x })),
      ...mtg.map((x) => ({ kind: "meeting" as const, data: x })),
    ];
    merged.sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());
    return merged;
  }, [l2, mtg]);

  // フィルタ
  const filtered = useMemo(() => {
    if (filter === "unread") {
      return items.filter((i) => !i.data.notified_at);
    }
    if (filter === "feedback") {
      // feedback が紐づく通知だけ
      return items.filter((i) => {
        if (i.kind === "l2") {
          return localFeedbacks.some(
            (f) => f.l2_kind === i.data.l2_kind && f.target_id === i.data.target_id && f.scope_key === i.data.scope_key
          );
        }
        return localFeedbacks.some(
          (f) => f.l2_kind === "meeting_summary" && f.meeting_id === i.data.meeting_id
        );
      });
    }
    return items;
  }, [items, filter, localFeedbacks]);

  const itemKey = (i: UnifiedItem): string =>
    i.kind === "l2" ? `l2-${i.data.notification_id}` : `mtg-${i.data.meeting_id}`;

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submitFeedback = async (i: UnifiedItem) => {
    const key = itemKey(i);
    const text = (feedbackTexts[key] ?? "").trim();
    if (!text) return;
    setSubmitting((s) => new Set(s).add(key));
    try {
      const body = i.kind === "l2"
        ? {
            l2_kind: i.data.l2_kind,
            target_id: i.data.target_id,
            scope_key: i.data.scope_key,
            notification_id: i.data.notification_id,
            feedback_text: text,
          }
        : {
            l2_kind: "meeting_summary",
            target_id: i.data.project_id,
            scope_key: i.data.meeting_id,
            meeting_id: i.data.meeting_id,
            feedback_text: text,
          };
      const res = await fetch("/api/notifications/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(`送信失敗: ${e.error || res.statusText}`);
        return;
      }
      const created = await res.json();
      // 楽観的反映
      setLocalFeedbacks((prev) => [created.feedback as Feedback, ...prev]);
      setFeedbackTexts((prev) => ({ ...prev, [key]: "" }));
      alert("つくよみに修正依頼を送りました。次回の cron 抽出時に反映されます。");
    } catch (e) {
      alert(`送信エラー: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSubmitting((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  const findFeedbacksFor = (i: UnifiedItem): Feedback[] => {
    if (i.kind === "l2") {
      return localFeedbacks.filter(
        (f) => f.l2_kind === i.data.l2_kind && f.target_id === i.data.target_id && f.scope_key === i.data.scope_key
      );
    }
    return localFeedbacks.filter((f) => f.l2_kind === "meeting_summary" && f.meeting_id === i.data.meeting_id);
  };

  return (
    <div>
      {/* フィルタタブ */}
      <div className="flex gap-2 mb-4">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
          すべて ({items.length})
        </FilterButton>
        <FilterButton active={filter === "unread"} onClick={() => setFilter("unread")}>
          未読 ({items.filter((i) => !i.data.notified_at).length})
        </FilterButton>
        <FilterButton active={filter === "feedback"} onClick={() => setFilter("feedback")}>
          修正依頼あり ({localFeedbacks.length > 0 ? items.filter((i) => findFeedbacksFor(i).length > 0).length : 0})
        </FilterButton>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">該当する通知はありません</p>
      )}

      <div className="space-y-3">
        {filtered.map((i) => {
          const key = itemKey(i);
          const isExpanded = expanded.has(key);
          const isSubmitting = submitting.has(key);
          const itemFeedbacks = findFeedbacksFor(i);
          return (
            <div
              key={key}
              className={`border rounded-lg overflow-hidden ${
                i.data.notified_at ? "bg-card" : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
              }`}
            >
              {/* ヘッダ (クリック展開) */}
              <button
                className="w-full flex items-start justify-between p-3 hover:bg-muted/50 text-left"
                onClick={() => toggleExpand(key)}
              >
                <div className="flex-1">
                  <div className="font-medium text-sm leading-snug">{i.data.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatJST(i.data.created_at)} ・{" "}
                    {i.kind === "l2"
                      ? `${i.data.l2_kind} / ${displayTarget(i.data.target_id, i.data.scope_key, projectMap)}`
                      : `meeting / ${projectMap[i.data.project_id] ?? i.data.project_id}`}
                    {!i.data.notified_at && <span className="ml-2 text-blue-600 dark:text-blue-400">● 未読</span>}
                    {itemFeedbacks.length > 0 && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">⚠️ 修正依頼 {itemFeedbacks.length} 件</span>
                    )}
                  </div>
                </div>
                <span className="text-muted-foreground text-xs ml-2">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {/* 展開部 */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t pt-3 space-y-3">
                  {/* summary */}
                  {i.kind === "l2" ? (
                    <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {i.data.summary || "(summary なし)"}
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {i.data.summary_short || `[${i.data.source_kinds}]`}
                    </div>
                  )}

                  {/* 元データへのリンク */}
                  <div className="text-xs">
                    <span className="text-muted-foreground">元データ: </span>
                    {i.kind === "l2" ? (
                      <DeepLinkForL2 n={i.data} />
                    ) : (
                      <DeepLinkForMeeting n={i.data} />
                    )}
                  </div>

                  {/* 既存の修正依頼 */}
                  {itemFeedbacks.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded p-2 space-y-1">
                      <div className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        ⚠️ つくよみへの過去の修正依頼 ({itemFeedbacks.length})
                      </div>
                      {itemFeedbacks.map((f) => (
                        <div key={f.feedback_id} className="text-xs text-amber-900 dark:text-amber-200">
                          <span className="text-muted-foreground">
                            {formatJST(f.created_at)}
                            {f.applied_count > 0 ? ` (反映 ${f.applied_count} 回)` : " (未反映)"}:
                          </span>{" "}
                          {f.feedback_text}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 修正依頼フォーム */}
                  <div className="border-t pt-3">
                    <label className="text-xs font-medium block mb-1">⚠️ つくよみに修正依頼</label>
                    <textarea
                      className="w-full text-sm border rounded p-2 min-h-[60px] bg-background"
                      placeholder="例: BWE 総会の議事録に CX 神谷さんが入ってる。これは BWE PJ なので CX 関連の人物・議題を含めないでほしい。"
                      value={feedbackTexts[key] ?? ""}
                      onChange={(e) => setFeedbackTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                      disabled={isSubmitting}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                        onClick={() => submitFeedback(i)}
                        disabled={isSubmitting || !(feedbackTexts[key] ?? "").trim()}
                      >
                        {isSubmitting ? "送信中..." : "送信"}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      送信後、次回の cron 抽出時に LLM プロンプトに含まれる。永続的に「過去の指摘」として参照される。
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === Sub components ===

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`text-xs px-3 py-1.5 rounded ${active ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DeepLinkForL2({ n }: { n: Notification }) {
  switch (n.l2_kind) {
    case "member_knowledge":
      return (
        <span>
          <code className="text-xs bg-muted px-1 rounded">member_knowledge</code> code_name=
          <code className="text-xs bg-muted px-1 rounded">{n.target_id}</code>{" "}
          (admin/members などで該当行を確認)
        </span>
      );
    case "project_knowledge":
      return (
        <span>
          <code className="text-xs bg-muted px-1 rounded">project_knowledge</code> project=
          <code className="text-xs bg-muted px-1 rounded">{n.target_id}</code> ym=
          <code className="text-xs bg-muted px-1 rounded">{n.scope_key}</code>
        </span>
      );
    case "protocols":
      return (
        <a className="text-blue-600 hover:underline" href="/admin/protocols">
          /admin/protocols (project={n.target_id}, ym={n.scope_key} の candidate 行)
        </a>
      );
    case "ms_progress":
      return (
        <a className="text-blue-600 hover:underline" href={`/project/${n.target_id}/cockpit`}>
          /project/{n.target_id}/cockpit (月次モーダル ym={n.scope_key} の進捗バー)
        </a>
      );
    default:
      return <span>{n.l2_kind}</span>;
  }
}

function DeepLinkForMeeting({ n }: { n: MeetingNotification }) {
  return (
    <a className="text-blue-600 hover:underline" href={`/project/${n.project_id}/cockpit`}>
      /project/{n.project_id}/cockpit (MTGサマリ枠の {n.title})
    </a>
  );
}

function formatJST(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const mi = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${jst.getUTCFullYear()}/${m}/${day} ${h}:${mi}`;
}

function displayTarget(targetId: string, scopeKey: string, projectMap: Record<string, string>): string {
  // PJ 系なら project_name で表示、メンバー系ならそのまま (= code_name)
  if (projectMap[targetId]) {
    return scopeKey === "global" ? projectMap[targetId] : `${projectMap[targetId]} (${scopeKey})`;
  }
  return scopeKey === "global" ? targetId : `${targetId} (${scopeKey})`;
}
