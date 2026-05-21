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

type FeedbackAction = "yes" | "no" | "comment";

// 展開時に lazy fetch する実データの型
type DetailRow = {
  loading: boolean;
  error?: string;
  // 1 行 = 1 抽出項目
  rows?: Array<{ heading: string; body: string; sub?: string }>;
};

function parseProtocolNotificationScope(scopeKey: string): { ym: string; protocolId: string | null } {
  const scoped = scopeKey.match(/^(20\d{4}):protocol:([^:]+)$/);
  if (scoped) {
    return { ym: scoped[1], protocolId: scoped[2] };
  }
  const ym = scopeKey.match(/20\d{4}/)?.[0] ?? scopeKey.slice(0, 6);
  return { ym, protocolId: null };
}

export function NotificationsClient({ l2, mtg, feedbacks, projectMap }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [feedbackTexts, setFeedbackTexts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [localFeedbacks, setLocalFeedbacks] = useState<Feedback[]>(feedbacks);
  const [answeredMap, setAnsweredMap] = useState<Record<string, FeedbackAction>>({});
  const [filter, setFilter] = useState<"open" | "unread" | "answered" | "feedback">("open");
  // 展開時に取得した実データ (key = itemKey(item))
  const [details, setDetails] = useState<Record<string, DetailRow>>({});
  // read_at の楽観的更新 (展開時に即既読にするため)
  // key = itemKey(item) → ISO 文字列 (= now() で UPDATE 済 の表示用)
  const [readMap, setReadMap] = useState<Record<string, string>>({});
  // 「未読に戻す」で server read_at=null にした項目の override
  // (= props 由来の i.data.read_at を上書きして未読表示するため)
  const [unreadOverride, setUnreadOverride] = useState<Set<string>>(new Set());
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

  // 表示判定: server の read_at (= 永続)、回答済み feedback、または readMap (= 当該セッションで開いた)
  const itemKey = (i: UnifiedItem): string =>
    i.kind === "l2" ? `l2-${i.data.notification_id}` : `mtg-${i.data.meeting_id}`;
  const serverReadAt = (i: UnifiedItem): string | null => i.data.read_at ?? null;
  const findFeedbacksFor = (i: UnifiedItem): Feedback[] => {
    if (i.kind === "l2") {
      return localFeedbacks.filter(
        (f) => f.l2_kind === i.data.l2_kind && f.target_id === i.data.target_id && f.scope_key === i.data.scope_key
      );
    }
    return localFeedbacks.filter((f) => f.l2_kind === "meeting_summary" && f.meeting_id === i.data.meeting_id);
  };
  const responseActionFor = (key: string, feedbacksForItem: Feedback[]): FeedbackAction | null => {
    if (answeredMap[key]) return answeredMap[key];
    const latest = feedbacksForItem[0]?.feedback_text?.trim() ?? "";
    if (!latest) return null;
    if (latest.startsWith("[はい]")) return "yes";
    if (latest.startsWith("[いいえ]")) return "no";
    return "comment";
  };
  const isAnswered = (i: UnifiedItem): boolean => !!responseActionFor(itemKey(i), findFeedbacksFor(i));
  const hasFeedbackForItem = (i: UnifiedItem): boolean => findFeedbacksFor(i).length > 0;
  const isReadUi = (i: UnifiedItem): boolean => {
    const key = itemKey(i);
    if (unreadOverride.has(key)) return false;
    return !!serverReadAt(i) || !!readMap[key] || !!answeredMap[key] || hasFeedbackForItem(i);
  };

  // フィルタ: 回答済み通知はその場で未読から外す。
  const filtered = useMemo(() => {
    if (filter === "open") {
      return items.filter((i) => !isAnswered(i));
    }
    if (filter === "unread") {
      return items.filter((i) => !isReadUi(i) && !isAnswered(i));
    }
    if (filter === "answered") {
      return items.filter((i) => isAnswered(i));
    }
    if (filter === "feedback") {
      return items.filter((i) => hasFeedbackForItem(i));
    }
    return items.filter((i) => !isAnswered(i));
  }, [answeredMap, items, filter, localFeedbacks]);

  // 展開した瞬間に未読なら read_at = now() で UPDATE → 楽観的に readMap に反映
  // (= 既読セクションには次回再描画時に移る、ただし当該カードは展開状態で残す)
  const markAsRead = useCallback(async (i: UnifiedItem) => {
    const key = itemKey(i);
    setUnreadOverride((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    if (serverReadAt(i)) return; // 既読は何もしない
    const nowIso = new Date().toISOString();
    setReadMap((prev) => ({ ...prev, [key]: nowIso }));
    try {
      const supabase = createClient();
      if (i.kind === "l2") {
        await supabase
          .from("l2_notifications")
          .update({ read_at: nowIso })
          .eq("notification_id", i.data.notification_id);
      } else {
        await supabase
          .from("meeting_notifications")
          .update({ read_at: nowIso })
          .eq("meeting_id", i.data.meeting_id);
      }
    } catch (e) {
      // RLS / network などで失敗しても UI は楽観的に既読のまま (= 次回再読込で server と整合)
      console.warn("[notifications] markAsRead failed:", e);
    }
  }, []);

  /** 「未読に戻す」: server read_at=null + 当該セッション中は未読表示 (unreadOverride) */
  const markAsUnread = useCallback(async (i: UnifiedItem) => {
    const key = itemKey(i);
    setReadMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setUnreadOverride((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    try {
      const supabase = createClient();
      if (i.kind === "l2") {
        await supabase
          .from("l2_notifications")
          .update({ read_at: null })
          .eq("notification_id", i.data.notification_id);
      } else {
        await supabase
          .from("meeting_notifications")
          .update({ read_at: null })
          .eq("meeting_id", i.data.meeting_id);
      }
    } catch (e) {
      console.warn("[notifications] markAsUnread failed:", e);
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
          // 2026-05-20 以降、通知は YYYYMM:protocol:<protocol_id> で 1 protocol = 1 通知。
          const { ym, protocolId } = parseProtocolNotificationScope(n.scope_key);
          const y = Number(ym.slice(0, 4));
          const m = Number(ym.slice(4, 6));
          const ymStart = `${y}-${String(m).padStart(2, "0")}-01`;
          const ymNextStart = m === 12
            ? `${y + 1}-01-01`
            : `${y}-${String(m + 1).padStart(2, "0")}-01`;
          let examplesQuery = supabase
            .from("protocol_examples")
            .select("protocol_id, occurred_on, summary, branch_point, action_taken, result")
            .eq("project_id", n.target_id)
            .gte("occurred_on", ymStart)
            .lt("occurred_on", ymNextStart);
          if (protocolId) {
            examplesQuery = examplesQuery.eq("protocol_id", protocolId);
          }
          const { data: examples, error: exErr } = await examplesQuery
            .order("occurred_on", { ascending: false })
            .limit(50);
          if (exErr) throw exErr;
          const ids = protocolId
            ? [protocolId]
            : Array.from(new Set((examples ?? []).map((e) => e.protocol_id as string)));
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
        } else if (n.l2_kind === "founding_members") {
          // Phase 1-E (founding-members-extract cron):
          // - target_id = project_id
          // - scope_key = 抽出日 (YYYY-MM-DD)
          // 通知日以降に updated_at された project_founding_members 行が当該通知の対象。
          const { data, error } = await supabase
            .from("project_founding_members")
            .select("person_name, affiliation, role, role_label_jp, category, responsibility, contribution, notes, status, first_observed_at, last_observed_at, updated_at")
            .eq("project_id", n.target_id)
            .gte("updated_at", n.scope_key)
            .order("updated_at", { ascending: false })
            .limit(50);
          if (error) throw error;
          rows = (data ?? []).map((r) => {
            const tagBits = [r.category, r.role_label_jp || r.role].filter((s) => !!s && s !== "unknown").join(" / ");
            const heading = tagBits
              ? `${r.person_name} (${tagBits})`
              : String(r.person_name ?? "");
            const bodyParts: string[] = [];
            if (r.responsibility) bodyParts.push(`担当: ${r.responsibility}`);
            if (r.contribution) bodyParts.push(`貢献: ${r.contribution}`);
            if (r.notes) bodyParts.push(`メモ: ${r.notes}`);
            const subBits = [r.affiliation, r.status, r.first_observed_at ? `初観測 ${r.first_observed_at}` : null].filter(Boolean).join(" · ");
            return {
              heading,
              body: bodyParts.join("\n") || "—",
              sub: subBits || undefined,
            };
          });
        } else if (n.l2_kind === "ms_progress") {
          // 通常の進捗更新通知に加えて、Codex automation が作る pending revision も同じ通知から見せる。
          const [{ data: progRows }, { data: revisionRows }] = await Promise.all([
            supabase
            .from("milestone_monthly_progress")
            .select("milestone_key, progress_pct, consumed_pt, source, note")
              .eq("ym", n.scope_key),
            supabase
              .from("ms_progress_revisions")
              .select("milestone_id, current_pct, current_note, revised_pct, revised_note, status, created_at")
              .eq("project_id", n.target_id)
              .eq("ym", n.scope_key)
              .order("created_at", { ascending: false }),
          ]);
          const keys = Array.from(new Set([
            ...(progRows ?? []).map((r) => String(r.milestone_key)),
            ...(revisionRows ?? []).map((r) => String(r.milestone_id)),
          ]));
          const [{ data: msRows }, { data: pcRows }] = await Promise.all([
            supabase
            .from("value_milestones")
              .select("milestone_id, title, points, plan_cycle_id")
              .in("milestone_id", keys.length > 0 ? keys : ["__none__"]),
            supabase
            .from("value_plan_cycles")
            .select("plan_cycle_id, project_id")
              .eq("project_id", n.target_id),
          ]);
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
          const revisionDetails = (revisionRows ?? [])
            .filter((r) => msMap[String(r.milestone_id)])
            .map((r) => {
              const m = msMap[String(r.milestone_id)];
              const status =
                r.status === "pending" ? "確認待ち" :
                r.status === "confirmed" ? "確定済" :
                r.status === "discarded" ? "破棄" :
                String(r.status ?? "");
              return {
                heading: `修正案: ${m.title} (${m.points}pt)`,
                body: `現在 ${r.current_pct ?? "?"}% → 提案 ${r.revised_pct ?? "?"}% [${status}]\n${r.revised_note ?? ""}`,
                sub: r.current_note ? `現在メモ: ${r.current_note}` : undefined,
              };
            });
          const progressDetails = (progRows ?? [])
            .filter((p) => msMap[p.milestone_key])
            .map((p) => {
              const m = msMap[p.milestone_key];
              return {
                heading: `${m.title} (${m.points}pt)`,
                body: `進捗 ${p.progress_pct}% (consumed ${p.consumed_pt}pt) [source=${p.source ?? ""}]`,
                sub: p.note ? `📝 ${p.note}` : undefined,
              };
            });
          rows = [...revisionDetails, ...progressDetails];
        } else if (n.l2_kind === "raw_data_ingested") {
          const ym = n.scope_key.slice(0, 6);
          const { data, error } = await supabase
            .from("source_cache")
            .select("source, title, item_date, content_text, metadata_json")
            .eq("project_id", n.target_id)
            .eq("ym", ym)
            .in("source", ["gmail_message", "gmail"])
            .order("item_date", { ascending: false })
            .limit(50);
          if (error) throw error;
          rows = (data ?? []).map((r) => {
            const meta = (r.metadata_json ?? {}) as Record<string, unknown>;
            const from = typeof meta.from === "string" ? meta.from : "";
            const snippet = typeof meta.snippet === "string" ? meta.snippet : "";
            const messageCount = typeof meta.message_count === "number" ? `thread messages: ${meta.message_count}` : "";
            const matchedCount = typeof meta.matched_message_count === "number" ? `saved messages: ${meta.matched_message_count}` : "";
            return {
              heading: `${r.source === "gmail_message" ? "メール" : "スレッド"}: ${r.title ?? "(no title)"}`,
              body: r.source === "gmail_message"
                ? [
                    snippet ? `Snippet: ${snippet}` : "",
                    "本文全文は通知には表示しない。必要な情報はL2抽出結果として別通知・別テーブルに保存する。",
                  ].filter(Boolean).join("\n")
                : "Gmailスレッドを取り込み済み。通知詳細ではメール単位の参照のみ表示する。",
              sub: [r.item_date, from, messageCount, matchedCount].filter(Boolean).join(" · ") || undefined,
            };
          });
        } else if (n.l2_kind === "raw_data_gap") {
          const ym = n.scope_key.slice(0, 6);
          const { data, error } = await supabase
            .from("source_cache")
            .select("source, item_id, title, item_date, content_text, metadata_json, collected_at")
            .eq("project_id", n.target_id)
            .eq("ym", ym)
            .order("item_date", { ascending: false })
            .limit(80);
          if (error) throw error;
          rows = (data ?? []).map((r) => {
            const meta = (r.metadata_json ?? {}) as Record<string, unknown>;
            const metaBits = [
              typeof meta.sender === "string" ? `sender=${meta.sender}` : "",
              typeof meta.channel === "string" ? `channel=${meta.channel}` : "",
              typeof meta.file_id === "string" ? `file=${meta.file_id}` : "",
              typeof meta.kind === "string" ? `kind=${meta.kind}` : "",
              r.item_id ? `item=${r.item_id}` : "",
            ].filter(Boolean);
            return {
              heading: `${String(r.source).toUpperCase()}: ${r.title ?? "(no title)"}`,
              body: [
                String(r.content_text ?? ""),
                Object.keys(meta).length > 0 ? `metadata: ${formatJsonCompact(meta)}` : "",
              ].filter(Boolean).join("\n"),
              sub: [
                r.item_date ? formatJST(String(r.item_date)) : "",
                r.collected_at ? `collected=${formatJST(String(r.collected_at))}` : "",
                ...metaBits,
              ].filter(Boolean).join(" · ") || undefined,
            };
          });
        } else if (n.l2_kind === "project_registry_diff") {
          const query = supabase
            .from("project_registry_diffs")
            .select("diff_kind, target_table, target_key, current_snapshot_json, proposed_patch_json, evidence_refs_json, confidence, status, review_comment, created_at, applied_at")
            .eq("project_id", n.target_id);
          const scopedQuery = n.scope_key === "global"
            ? query.is("ym", null)
            : query.eq("ym", n.scope_key);
          const { data, error } = await scopedQuery.order("created_at", { ascending: false }).limit(50);
          if (error) throw error;
          rows = (data ?? []).map((r) => {
            const evidence = Array.isArray(r.evidence_refs_json) ? r.evidence_refs_json : [];
            const evidenceText = evidence
              .slice(0, 3)
              .map((e) => {
                const ref = e && typeof e === "object" ? e as Record<string, unknown> : {};
                return [
                  ref.source || ref.type || "source",
                  ref.date || ref.item_date || "",
                  ref.snippet || ref.summary || "",
                ].filter(Boolean).join(" / ");
              })
              .filter(Boolean)
              .join("\n");
            return {
              heading: `${r.diff_kind} → ${r.target_table}${r.status ? ` [${r.status}]` : ""}`,
              body: [
                `提案: ${formatJsonCompact(r.proposed_patch_json)}`,
                evidenceText ? `根拠:\n${evidenceText}` : "",
                r.review_comment ? `コメント: ${r.review_comment}` : "",
              ].filter(Boolean).join("\n"),
              sub: [
                r.target_key ? `target=${r.target_key}` : "",
                r.confidence != null ? `confidence=${Number(r.confidence).toFixed(2)}` : "",
                r.applied_at ? `applied=${formatJST(String(r.applied_at))}` : "",
              ].filter(Boolean).join(" · ") || undefined,
            };
          });
        } else if (n.l2_kind === "xrl_evidence") {
          const query = supabase
            .from("project_xrl_evidence")
            .select("axis, evidence_kind, summary, structured_value_json, source_refs_json, confidence, status, created_at, confirmed_at")
            .eq("project_id", n.target_id);
          const scopedQuery = n.scope_key === "global"
            ? query.is("ym", null)
            : query.eq("ym", n.scope_key);
          const { data, error } = await scopedQuery.order("created_at", { ascending: false }).limit(50);
          if (error) throw error;
          rows = (data ?? []).map((r) => {
            const refs = Array.isArray(r.source_refs_json) ? r.source_refs_json : [];
            const refText = refs
              .slice(0, 3)
              .map((e) => {
                const ref = e && typeof e === "object" ? e as Record<string, unknown> : {};
                return [
                  ref.source || ref.type || "source",
                  ref.date || ref.item_date || "",
                  ref.snippet || ref.summary || "",
                ].filter(Boolean).join(" / ");
              })
              .filter(Boolean)
              .join("\n");
            return {
              heading: `${String(r.axis).toUpperCase()} / ${r.evidence_kind} [${r.status}]`,
              body: [
                String(r.summary ?? ""),
                Object.keys((r.structured_value_json ?? {}) as Record<string, unknown>).length > 0
                  ? `構造化値: ${formatJsonCompact(r.structured_value_json)}`
                  : "",
                refText ? `根拠:\n${refText}` : "",
              ].filter(Boolean).join("\n"),
              sub: [
                r.confidence != null ? `confidence=${Number(r.confidence).toFixed(2)}` : "",
                r.confirmed_at ? `confirmed=${formatJST(String(r.confirmed_at))}` : "",
              ].filter(Boolean).join(" · ") || undefined,
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
        if (!serverReadAt(i)) {
          void markAsRead(i);
        }
      }
      return next;
    });
  };

  const submitFeedback = async (i: UnifiedItem, action: FeedbackAction = "comment") => {
    const key = itemKey(i);
    const text = (feedbackTexts[key] ?? "").trim();
    if (action === "comment" && !text) return;
    setSubmitting((s) => new Set(s).add(key));
    try {
      const body = i.kind === "l2"
        ? {
            l2_kind: i.data.l2_kind,
            target_id: i.data.target_id,
            scope_key: i.data.scope_key,
            notification_id: i.data.notification_id,
            action,
            feedback_text: text,
          }
        : {
            l2_kind: "meeting_summary",
            target_id: i.data.project_id,
            scope_key: i.data.meeting_id,
            meeting_id: i.data.meeting_id,
            action,
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
      setAnsweredMap((prev) => ({ ...prev, [key]: action }));
      setFeedbackTexts((prev) => ({ ...prev, [key]: "" }));
      void markAsRead(i);
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

  const responseLabel = (action: FeedbackAction) => {
    if (action === "yes") return "はい・反映";
    if (action === "no") return "いいえ・不採用";
    return "コメント送信済み";
  };

  return (
    <div>
      {/* フィルタタブ */}
      <div className="flex gap-2 mb-4">
        <FilterButton active={filter === "open"} onClick={() => setFilter("open")}>
          未対応 ({items.filter((i) => !isAnswered(i)).length})
        </FilterButton>
        <FilterButton active={filter === "unread"} onClick={() => setFilter("unread")}>
          未読 ({items.filter((i) => !isReadUi(i) && !isAnswered(i)).length})
        </FilterButton>
        <FilterButton active={filter === "answered"} onClick={() => setFilter("answered")}>
          回答済み ({items.filter((i) => isAnswered(i)).length})
        </FilterButton>
        <FilterButton active={filter === "feedback"} onClick={() => setFilter("feedback")}>
          修正依頼あり ({localFeedbacks.length > 0 ? items.filter((i) => findFeedbacksFor(i).length > 0).length : 0})
        </FilterButton>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">該当する通知はありません</p>
      )}

      {(() => {
        // 未読/既読に分ける。単に開いた通知はセッション中は未読側に残し、
        // はい/いいえ/コメントで回答した通知だけ即座に既読側へ移動する。
        const isReadBucket = (i: UnifiedItem) => {
          const key = itemKey(i);
          return !!serverReadAt(i) || !!answeredMap[key] || findFeedbacksFor(i).length > 0;
        };
        const unansweredItems = filtered.filter((i) => !isAnswered(i));
        const unreadItems = unansweredItems.filter((i) => !isReadBucket(i));
        const readItems = unansweredItems.filter((i) => isReadBucket(i));
        const answeredItems = filtered.filter((i) => isAnswered(i));

        const renderCard = (i: UnifiedItem) => {
          const key = itemKey(i);
          const isExpanded = expanded.has(key);
          const isSubmitting = submitting.has(key);
          const itemFeedbacks = findFeedbacksFor(i);
          const responseAction = responseActionFor(key, itemFeedbacks);
          return (
            <div
              key={key}
              className={`border rounded-lg overflow-hidden ${
                isReadUi(i) ? "bg-card" : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
              }`}
            >
              {/* ヘッダ (クリック展開) */}
              <div
                role="button"
                tabIndex={0}
                className="w-full flex items-start justify-between p-3 hover:bg-muted/50 text-left cursor-pointer"
                onClick={() => toggleExpand(i)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(i); } }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm leading-snug">{sanitizeMeetingTitle(i.data.title)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatJST(i.data.created_at)} ・{" "}
                    {i.kind === "l2"
                      ? `${i.data.l2_kind} / ${displayTarget(i.data.target_id, i.data.scope_key, projectMap)}`
                      : `meeting / ${projectMap[i.data.project_id] ?? i.data.project_id}`}
                    {!isReadUi(i) && <span className="ml-2 text-blue-600 dark:text-blue-400">● 未読</span>}
                    {(() => {
                      const kindKey = i.kind === "l2" ? i.data.l2_kind : "meeting_summary";
                      const cost = NOTIFICATION_COST_ESTIMATE_JPY[kindKey];
                      if (cost == null) return null;
                      return (
                        <span
                          className="ml-2 text-muted-foreground"
                          title="この通知 1 件あたりの LLM 抽出コスト概算 (token 実測ではなく入出力推定ベース)"
                        >
                          {formatCostJpy(cost)}
                        </span>
                      );
                    })()}
                    {itemFeedbacks.length > 0 && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">⚠️ 修正依頼 {itemFeedbacks.length} 件</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {isReadUi(i) && !responseAction && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void markAsUnread(i); }}
                      className="text-[11px] px-2 py-0.5 rounded border border-border bg-background hover:bg-muted text-muted-foreground"
                      title="この通知を未読に戻す"
                    >
                      ↺ 未読に戻す
                    </button>
                  )}
                  <span className="text-muted-foreground text-xs">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

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

                  {/* 回答フォーム */}
                  <div className="border-t pt-3">
                    {responseAction ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-500/25 bg-emerald-500/8 px-3 py-2">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          回答済み: {responseLabel(responseAction)}
                        </span>
                        {isSubmitting && <span className="text-[11px] text-muted-foreground">送信中...</span>}
                      </div>
                    ) : (
                      <>
                        <label className="text-xs font-medium block mb-1">回答・コメント</label>
                        <p className="mb-2 text-[11px] text-muted-foreground">
                          反映してよければ「はい・反映」、違っていれば「いいえ・不採用」。補足だけ残すならコメントだけ送信。
                        </p>
                        <textarea
                          className="w-full text-sm border rounded p-2 min-h-[60px] bg-background"
                          placeholder="任意コメント。例: 今回は契約レビューだけなのでPJメンバーには入れない / 品質確認として継続参加なので登録してOK"
                          value={feedbackTexts[key] ?? ""}
                          onChange={(e) => setFeedbackTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                          disabled={isSubmitting}
                        />
                        <div className="flex flex-wrap justify-end gap-2 mt-2">
                          <button
                            className="text-xs px-3 py-1.5 border border-emerald-500 text-emerald-700 rounded hover:bg-emerald-50 disabled:opacity-50"
                            onClick={() => submitFeedback(i, "yes")}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "送信中..." : "はい・反映"}
                          </button>
                          <button
                            className="text-xs px-3 py-1.5 border border-red-400 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
                            onClick={() => submitFeedback(i, "no")}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "送信中..." : "いいえ・不採用"}
                          </button>
                          <button
                            className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                            onClick={() => submitFeedback(i, "comment")}
                            disabled={isSubmitting || !(feedbackTexts[key] ?? "").trim()}
                          >
                            {isSubmitting ? "送信中..." : "コメントだけ送信"}
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          はい/いいえ/コメントは admin/tsukuyomi の学習リストに残る。安全に反映できる候補は「はい」でSupabaseへ反映する。
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <>
            {filter === "answered" && answeredItems.length > 0 && (
              <div className="space-y-3">
                {answeredItems.map((i) => renderCard(i))}
              </div>
            )}

            {/* 未読 */}
            {filter !== "answered" && unreadItems.length > 0 && (
              <div className="space-y-3">
                {unreadItems.map((i) => renderCard(i))}
              </div>
            )}

            {/* 既読 (デフォルト折りたたみ) */}
            {filter !== "answered" && readItems.length > 0 && (
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
    case "protocols": {
      const { ym, protocolId } = parseProtocolNotificationScope(n.scope_key);
      return (
        <a className="text-blue-600 hover:underline" href="/admin/protocols">
          /admin/protocols (project={n.target_id}, ym={ym}{protocolId ? `, protocol=${protocolId}` : ""} の candidate 行)
        </a>
      );
    }
    case "ms_progress":
      return (
        <a className="text-blue-600 hover:underline" href={`/project/${n.target_id}/cockpit?ym=${n.scope_key}`}>
          /project/{n.target_id}/cockpit?ym={n.scope_key} (対象月の月次モーダル)
        </a>
      );
    case "founding_members":
      return (
        <a className="text-blue-600 hover:underline" href={`/project/${n.target_id}/cockpit`}>
          /project/{n.target_id}/cockpit (メンバーカードで確認)
        </a>
      );
    case "project_member_candidate":
      return (
        <a className="text-blue-600 hover:underline" href={`/admin/projects`}>
          /admin/projects (PJメンバー候補を確認)
        </a>
      );
    case "project_contact_candidate":
    case "project_config_gap":
      return (
        <a className="text-blue-600 hover:underline" href={`/admin/projects`}>
          /admin/projects (PJ台帳を確認)
        </a>
      );
    case "raw_data_gap":
      return (
        <a className="text-blue-600 hover:underline" href={`/project/${n.target_id}/cockpit?ym=${n.scope_key.slice(0, 6)}`}>
          /project/{n.target_id}/cockpit?ym={n.scope_key.slice(0, 6)} (通知詳細の source_cache とあわせて確認)
        </a>
      );
    case "raw_data_ingested":
      return (
        <a className="text-blue-600 hover:underline" href={`/project/${n.target_id}/cockpit`}>
          /project/{n.target_id}/cockpit (取り込み済み生データを通知詳細で確認)
        </a>
      );
    case "project_registry_diff":
      return (
        <a className="text-blue-600 hover:underline" href={`/admin/projects`}>
          /admin/projects (OS台帳差分を確認)
        </a>
      );
    case "xrl_evidence":
      return (
        <a className="text-blue-600 hover:underline" href={`/project/${n.target_id}/cockpit`}>
          /project/{n.target_id}/cockpit (XRL / AMD Score 根拠を確認)
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
 * 各 l2_kind / meeting_summary 通知の 1 件あたり LLM 抽出コスト概算 (円)。
 * 実測 token は log されていない (将来課題) ため、コード推定値:
 *
 * - Gemini 2.5 Flash (input $0.10/MTok / output $0.40/MTok ≈ ¥0.015 / ¥0.06 per Ktok):
 *   - member_knowledge (in 3K / out 1K) → ¥0.045 + ¥0.06 = ~¥0.1
 *   - project_knowledge (in 5K / out 1.5K) → ¥0.075 + ¥0.09 = ~¥0.2
 *   - protocols (in 8K / out 2K) → ¥0.12 + ¥0.12 = ~¥0.3
 *   - ms_progress (in 3K / out 1K) → ~¥0.1
 *   - meeting_summary (in 8K / out 1.5K) → ¥0.12 + ¥0.09 = ~¥0.2
 *   - ※ 無料枠 (RPD/分の制限内) で動いている分は実質 ¥0
 * - Anthropic Sonnet 4.5 (input $3/MTok / output $15/MTok ≈ ¥0.45 / ¥2.25 per Ktok):
 *   - founding_members (in 10K / out 2K) → ¥4.5 + ¥4.5 = ~¥9 → 切り上げ ~¥10
 */
const NOTIFICATION_COST_ESTIMATE_JPY: Record<string, number> = {
  member_knowledge: 0.1,
  project_knowledge: 0.2,
  protocols: 0.3,
  ms_progress: 0.1,
  project_member_candidate: 0.1,
  project_contact_candidate: 0.1,
  raw_data_gap: 0.1,
  raw_data_ingested: 0.1,
  project_config_gap: 0.1,
  project_registry_diff: 0.2,
  xrl_evidence: 2,
  founding_members: 10,
  meeting_summary: 0.2,
};

function formatJsonCompact(value: unknown): string {
  try {
    const s = JSON.stringify(value ?? {}, null, 0);
    return s.length > 260 ? `${s.slice(0, 260)}...` : s;
  } catch {
    return String(value ?? "");
  }
}

function formatCostJpy(n: number): string {
  if (n < 1) return `~¥${n.toFixed(1)}`;
  return `~¥${Math.round(n)}`;
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
