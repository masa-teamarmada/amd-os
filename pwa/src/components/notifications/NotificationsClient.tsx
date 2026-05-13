"use client";

import { useState, useMemo, useCallback } from "react";
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

// 展開時に lazy fetch する実データの型
type DetailRow = {
  loading: boolean;
  error?: string;
  // 1 行 = 1 抽出項目
  rows?: Array<{ heading: string; body: string; sub?: string }>;
};

export function NotificationsClient({ l2, mtg, feedbacks, projectMap }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [feedbackTexts, setFeedbackTexts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [localFeedbacks, setLocalFeedbacks] = useState<Feedback[]>(feedbacks);
  const [filter, setFilter] = useState<"all" | "unread" | "feedback">("all");
  // 展開時に取得した実データ (key = itemKey(item))
  const [details, setDetails] = useState<Record<string, DetailRow>>({});
  // notified_at の楽観的更新 (展開時に即既読にするため)
  // key = itemKey(item) → ISO 文字列 (= now() で UPDATE 済 の表示用)
  const [readMap, setReadMap] = useState<Record<string, string>>({});
  // 既読セクション全体のトグル (default 折りたたみ)
  const [readSectionOpen, setReadSectionOpen] = useState<boolean>(false);

  // 通知を時系列でマージ (l2 + meeting)
  const items: UnifiedItem[] = useMemo(() => {
    const merged: UnifiedItem[] = [
      ...l2.map((x) => ({ kind: "l2" as const, data: x })),
      ...mtg.map((x) => ({ kind: "meeting" as const, data: x })),
    ];
    merged.sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());
    return merged;
  }, [l2, mtg]);

  // 表示判定: server の notified_at (= 永続) または readMap (= 当該セッションで開いた)
  // これでバッジ/背景は即座に既読化される一方、グループ分け (= server 値だけで判定) は
  // 当該セッション内では未読セクションのまま → 次回再読込で既読セクションに自然移動
  const itemKey = (i: UnifiedItem): string =>
    i.kind === "l2" ? `l2-${i.data.notification_id}` : `mtg-${i.data.meeting_id}`;
  const isReadUi = (i: UnifiedItem): boolean => !!i.data.notified_at || !!readMap[itemKey(i)];

  // フィルタ (バッジ表示は readMap 反映、ただしグループ分けは server 値だけで判定)
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

  // 展開した瞬間に未読なら notified_at = now() で UPDATE → 楽観的に readMap に反映
  // (= 既読セクションには次回再描画時に移る、ただし当該カードは展開状態で残す)
  const markAsRead = useCallback(async (i: UnifiedItem) => {
    if (i.data.notified_at) return; // 既読は何もしない
    const key = itemKey(i);
    const nowIso = new Date().toISOString();
    setReadMap((prev) => ({ ...prev, [key]: nowIso }));
    try {
      const supabase = createClient();
      if (i.kind === "l2") {
        await supabase
          .from("l2_notifications")
          .update({ notified_at: nowIso })
          .eq("notification_id", i.data.notification_id);
      } else {
        await supabase
          .from("meeting_notifications")
          .update({ notified_at: nowIso })
          .eq("meeting_id", i.data.meeting_id);
      }
    } catch (e) {
      // RLS / network などで失敗しても UI は楽観的に既読のまま (= 次回再読込で server と整合)
      console.warn("[notifications] markAsRead failed:", e);
    }
  }, []);

  const loadDetails = useCallback(async (i: UnifiedItem) => {
    const key = itemKey(i);
    setDetails((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      const supabase = createClient();
      let rows: DetailRow["rows"] = [];

      if (i.kind === "l2") {
        const n = i.data;
        if (n.l2_kind === "member_knowledge") {
          const { data, error } = await supabase
            .from("member_knowledge")
            .select("category, summary, updated_at")
            .eq("code_name", n.target_id)
            .order("updated_at", { ascending: false });
          if (error) throw error;
          rows = (data ?? []).map((r) => ({
            heading: String(r.category),
            body: String(r.summary ?? ""),
          }));
        } else if (n.l2_kind === "project_knowledge") {
          // 当該 PJ × 当該 ym で source='l2_hourly_extract' なものを優先表示
          const { data, error } = await supabase
            .from("project_knowledge")
            .select("category, entity_name, fact_text, confidence, updated_at, source")
            .eq("project_id", n.target_id)
            .eq("source", "l2_hourly_extract")
            .order("updated_at", { ascending: false })
            .limit(50);
          if (error) throw error;
          rows = (data ?? []).map((r) => ({
            heading: `[${r.category}] ${r.entity_name}`,
            body: String(r.fact_text ?? ""),
            sub: r.confidence ? `confidence: ${r.confidence}` : undefined,
          }));
        } else if (n.l2_kind === "protocols") {
          // Phase 4.5 (2026-05-11): protocols は universal (project_id=null, protocol_id=p4u-...)
          // PJ × ym の紐付けは protocol_examples 経由 (occurred_on で ym 範囲を絞る)
          const ym = n.scope_key;
          const y = Number(ym.slice(0, 4));
          const m = Number(ym.slice(4, 6));
          const ymStart = `${y}-${String(m).padStart(2, "0")}-01`;
          const ymNextStart = m === 12
            ? `${y + 1}-01-01`
            : `${y}-${String(m + 1).padStart(2, "0")}-01`;
          const { data: examples, error: exErr } = await supabase
            .from("protocol_examples")
            .select("protocol_id, occurred_on, summary, branch_point, action_taken, result")
            .eq("project_id", n.target_id)
            .gte("occurred_on", ymStart)
            .lt("occurred_on", ymNextStart)
            .order("occurred_on", { ascending: false })
            .limit(50);
          if (exErr) throw exErr;
          const ids = Array.from(new Set((examples ?? []).map((e) => e.protocol_id as string)));
          if (ids.length === 0) {
            rows = [];
          } else {
            const { data: protocols, error: pErr } = await supabase
              .from("protocols")
              .select("protocol_id, title, content, status, importance, tags, updated_at")
              .in("protocol_id", ids)
              .order("updated_at", { ascending: false });
            if (pErr) throw pErr;
            const examplesByPid = new Map<string, Array<{ occurred_on: string | null; summary: string | null; branch_point: string | null; action_taken: string | null; result: string | null }>>();
            for (const e of (examples ?? [])) {
              const pid = e.protocol_id as string;
              const list = examplesByPid.get(pid) ?? [];
              list.push({
                occurred_on: e.occurred_on as string | null,
                summary: e.summary as string | null,
                branch_point: e.branch_point as string | null,
                action_taken: e.action_taken as string | null,
                result: e.result as string | null,
              });
              examplesByPid.set(pid, list);
            }
            rows = (protocols ?? []).map((r) => {
              const exs = examplesByPid.get(r.protocol_id as string) ?? [];
              const exText = exs
                .map((e) => `・[${e.occurred_on ?? "—"}] ${e.summary ?? ""}`)
                .join("\n");
              const body = String(r.content ?? "") + (exText ? `\n\n📂 関連事例:\n${exText}` : "");
              return {
                heading: `${"⭐".repeat(Math.max(1, Math.min(3, Number(r.importance ?? 1))))} ${r.title} [${r.status}]`,
                body,
                sub: r.tags ? `tags: ${r.tags}` : undefined,
              };
            });
          }
        } else if (n.l2_kind === "ms_progress") {
          // milestone_monthly_progress + value_milestones JOIN は client では難しいので 2 回 fetch
          const { data: progRows } = await supabase
            .from("milestone_monthly_progress")
            .select("milestone_key, progress_pct, consumed_pt, source, note")
            .eq("ym", n.scope_key);
          const keys = (progRows ?? []).map((r) => r.milestone_key);
          // 当該 PJ の milestones だけにフィルタ
          const { data: msRows } = await supabase
            .from("value_milestones")
            .select("milestone_id, title, points, plan_cycle_id, value_plan_cycles!inner(project_id)")
            .in("milestone_id", keys.length > 0 ? keys : ["__none__"]);
          // value_plan_cycles ⇄ project_id でフィルタするため別 fetch
          const { data: pcRows } = await supabase
            .from("value_plan_cycles")
            .select("plan_cycle_id, project_id")
            .eq("project_id", n.target_id);
          const validPlanIds = new Set((pcRows ?? []).map((p) => p.plan_cycle_id));
          const msMap: Record<string, { title: string; points: number }> = {};
          for (const m of msRows ?? []) {
            if (validPlanIds.has(String(m.plan_cycle_id))) {
              msMap[String(m.milestone_id)] = {
                title: String(m.title ?? ""),
                points: Number(m.points ?? 0),
              };
            }
          }
          rows = (progRows ?? [])
            .filter((p) => msMap[p.milestone_key])
            .map((p) => {
              const m = msMap[p.milestone_key];
              return {
                heading: `${m.title} (${m.points}pt)`,
                body: `進捗 ${p.progress_pct}% (consumed ${p.consumed_pt}pt) [source=${p.source ?? ""}]`,
                sub: p.note ? `📝 ${p.note}` : undefined,
              };
            });
        }
      } else {
        // meeting_summary: project_meeting_summaries から実内容取得
        const m = i.data;
        const { data, error } = await supabase
          .from("project_meeting_summaries")
          .select("meeting_date, title, summary_short, decided, progress, next_actions, risks, source_kinds")
          .eq("meeting_id", m.meeting_id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const r = data as {
            meeting_date: string;
            title: string;
            summary_short: string;
            decided: string[] | null;
            progress: string[] | null;
            next_actions: string[] | null;
            risks: string[] | null;
            source_kinds: string;
          };
          rows = [
            { heading: "概要", body: r.summary_short || "(なし)", sub: `${r.meeting_date} ・ source=${r.source_kinds}` },
            ...(r.decided && r.decided.length > 0
              ? [{ heading: "決定事項", body: r.decided.map((s) => `・${s}`).join("\n") }]
              : []),
            ...(r.progress && r.progress.length > 0
              ? [{ heading: "進捗", body: r.progress.map((s) => `・${s}`).join("\n") }]
              : []),
            ...(r.next_actions && r.next_actions.length > 0
              ? [{ heading: "次のアクション", body: r.next_actions.map((s) => `・${s}`).join("\n") }]
              : []),
            ...(r.risks && r.risks.length > 0
              ? [{ heading: "リスク", body: r.risks.map((s) => `・${s}`).join("\n") }]
              : []),
          ];
        }
      }

      setDetails((prev) => ({ ...prev, [key]: { loading: false, rows } }));
    } catch (e) {
      setDetails((prev) => ({
        ...prev,
        [key]: { loading: false, error: e instanceof Error ? e.message : "fetch error" },
      }));
    }
  }, []);

  const toggleExpand = (i: UnifiedItem) => {
    const key = itemKey(i);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // 初回展開時に lazy fetch + 即既読化
        if (!details[key]) {
          void loadDetails(i);
        }
        if (!i.data.notified_at) {
          void markAsRead(i);
        }
      }
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
          未読 ({items.filter((i) => !isReadUi(i)).length})
        </FilterButton>
        <FilterButton active={filter === "feedback"} onClick={() => setFilter("feedback")}>
          修正依頼あり ({localFeedbacks.length > 0 ? items.filter((i) => findFeedbacksFor(i).length > 0).length : 0})
        </FilterButton>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">該当する通知はありません</p>
      )}

      {(() => {
        // 未読/既読に分ける (= readMap で楽観的に既読化されたものは、開いたままでも既読扱い)
        // グループ分けは server 値だけで判定 (= 開いてもセッション中は未読セクションに残す)
        // バッジ/背景の既読化は isReadUi で即時、リロードで初めて既読セクションへ移動 (まさの仕様)
        const unreadItems = filtered.filter((i) => !i.data.notified_at);
        const readItems = filtered.filter((i) => !!i.data.notified_at);

        const renderCard = (i: UnifiedItem) => {
          const key = itemKey(i);
          const isExpanded = expanded.has(key);
          const isSubmitting = submitting.has(key);
          const itemFeedbacks = findFeedbacksFor(i);
          return (
            <div
              key={key}
              className={`border rounded-lg overflow-hidden ${
                isReadUi(i) ? "bg-card" : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
              }`}
            >
              {/* ヘッダ (クリック展開) */}
              <button
                className="w-full flex items-start justify-between p-3 hover:bg-muted/50 text-left"
                onClick={() => toggleExpand(i)}
              >
                <div className="flex-1">
                  <div className="font-medium text-sm leading-snug">{sanitizeMeetingTitle(i.data.title)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatJST(i.data.created_at)} ・{" "}
                    {i.kind === "l2"
                      ? `${i.data.l2_kind} / ${displayTarget(i.data.target_id, i.data.scope_key, projectMap)}`
                      : `meeting / ${projectMap[i.data.project_id] ?? i.data.project_id}`}
                    {!isReadUi(i) && <span className="ml-2 text-blue-600 dark:text-blue-400">● 未読</span>}
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
                  {/* 通知 summary (上流が付けた一覧用見出し) */}
                  {i.kind === "l2" ? (
                    <div className="text-xs text-muted-foreground italic">
                      通知ヘッドライン: {i.data.summary || "(なし)"}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">
                      通知ヘッドライン: {i.data.summary_short || `[${i.data.source_kinds}]`}
                    </div>
                  )}

                  {/* 実データ (lazy fetch) */}
                  <DetailSection detail={details[key]} />

                  {/* 元データへの deep link */}
                  <div className="text-xs">
                    <span className="text-muted-foreground">他の場所でも確認: </span>
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
        };

        return (
          <>
            {/* 未読 */}
            {unreadItems.length > 0 && (
              <div className="space-y-3">
                {unreadItems.map((i) => renderCard(i))}
              </div>
            )}

            {/* 既読 (デフォルト折りたたみ) */}
            {readItems.length > 0 && (
              <div className={unreadItems.length > 0 ? "mt-6" : ""}>
                <button
                  onClick={() => setReadSectionOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-2 w-full text-left"
                  aria-expanded={readSectionOpen}
                >
                  <span>{readSectionOpen ? "▼" : "▶"}</span>
                  <span>既読 ({readItems.length} 件)</span>
                </button>
                {readSectionOpen && (
                  <div className="space-y-3 mt-2 opacity-80">
                    {readItems.map((i) => renderCard(i))}
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}
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

// 展開時の実データ表示セクション
function DetailSection({ detail }: { detail: DetailRow | undefined }) {
  if (!detail) return null;
  if (detail.loading) {
    return <div className="text-xs text-muted-foreground italic">📥 抽出された内容を読み込み中...</div>;
  }
  if (detail.error) {
    return <div className="text-xs text-red-500">読み込み失敗: {detail.error}</div>;
  }
  const rows = detail.rows ?? [];
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground italic">抽出された行が見つかりませんでした (= まだ DB に反映されてない可能性あり)</div>;
  }
  return (
    <div className="space-y-2 bg-muted/30 rounded p-2">
      <div className="text-xs font-medium text-muted-foreground">📦 抽出された内容 ({rows.length} 件)</div>
      {rows.map((r, idx) => (
        <div key={idx} className="border-l-2 border-primary/30 pl-2 py-0.5">
          <div className="text-sm font-medium">{r.heading}</div>
          <div className="text-sm whitespace-pre-wrap text-foreground/80">{r.body}</div>
          {r.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{r.sub}</div>}
        </div>
      ))}
    </div>
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

/**
 * Notion AI 自動生成議事録ページ由来の汚れ (ISO 8601 / mention-date / @今日) を、
 * PWA 標準形式 (= YYYY/MM/DD HH:mm JST) に正規化する。
 * GAS 側 (gas/074_MeetingSummaryRepo.js: `_meeting_sanitizeTitle_`) と同じロジックの保険。
 * GAS 側 push 反映前 or 既存 DB 行で生 ISO が残っている場合に効く。
 */
function sanitizeMeetingTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw);
  s = s.replace(/\s*(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})[^\s]*/g, " $1/$2/$3 $4:$5");
  s = s.replace(/\s*<mention-date[^>]*>[^<]*<\/mention-date>/g, "");
  s = s.replace(/\s*<mention-date[^>]*>/g, "");
  s = s.replace(/\s*@今日[^\s]*/g, "");
  return s.replace(/\s+/g, " ").trim();
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
